import * as d3 from 'd3';

class MatrixD3 {
    margin = {top: 20, right: 20, bottom: 20, left: 20};
    size;
    height;
    width;
    matSvg;
    // Scales
    colorScale;
    // Visual parameters
    defaultOpacity = 0.7;
    transitionDuration = 1000;
    cellPadding = 10; // Padding within each small multiple cell
    labelHeight = 25; // Height reserved for labels in each cell
    selectedCells = new Set(); // Track selected bedroom/bathroom combinations
    // Brush selection
    isDragging = false;
    dragStartCell = null;
    dragMoved = false; // Track if the mouse moved during drag

    constructor(el) {
        this.el = el;
        this.removedIndices = new Set(); // Track removed house indices
    }

    create(config) {
        this.size = {width: config.size.width, height: config.size.height};
        this.width = this.size.width - this.margin.left - this.margin.right;
        this.height = this.size.height - this.margin.top - this.margin.bottom;

        // Initialize SVG
        const svg = d3.select(this.el)
            .append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        this.matSvg = svg.append("g")
            .attr("transform", `translate(${this.margin.left},${this.margin.top})`);

        this.colorScale = d3.scaleSequential(d3.interpolateBlues);
        
        // Set up global mouse up handler for drag selection
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        // Store reference to bound handler for cleanup
        this.mouseUpHandler = () => {
            if (this.isDragging) {
                // Only apply selection if we actually dragged (moved across cells)
                if (this.dragMoved && this.controllerMethods) {
                    this.updateFilteredData(this.controllerMethods);
                }
                this.isDragging = false;
                this.dragMoved = false;
            }
        };
        
        document.addEventListener('mouseup', this.mouseUpHandler);
    }

    groupDataByBedBath(data) {
        // Group data by bedroom-bathroom combinations
        const grouped = d3.group(data, d => `${d.bedrooms}-${d.bathrooms}`);
        const cellData = [];
        
        for (const [key, items] of grouped.entries()) {
            const [bedrooms, bathrooms] = key.split("-").map(Number);
            cellData.push({
                bedrooms,
                bathrooms,
                items: items,
                count: items.length
            });
        }
        
        return cellData;
    }

    calculateGridLayout(cellData) {
        // Get unique bedroom and bathroom values
        const bedroomValues = [...new Set(cellData.map(d => d.bedrooms))].sort((a, b) => a - b);
        const bathroomValues = [...new Set(cellData.map(d => d.bathrooms))].sort((a, b) => a - b);
        
        const numCols = bedroomValues.length;
        const numRows = bathroomValues.length;
        
        const cellWidth = this.width / numCols;
        const cellHeight = this.height / numRows;
        
        return {
            bedroomValues,
            bathroomValues,
            numCols,
            numRows,
            cellWidth,
            cellHeight
        };
    }

    packCircles(items, cellWidth, cellHeight, globalRadiusScale) {
        // Calculate available space for circles (accounting for padding and label)
        const packWidth = cellWidth - this.cellPadding * 2;
        const packHeight = cellHeight - this.cellPadding * 2 - this.labelHeight;
        
        // Use the global radius scale to determine circle sizes
        // This ensures consistent sizing across all cells
        const itemsWithRadius = items.map(d => ({
            ...d,
            globalRadius: globalRadiusScale(d.area)
        }));
        
        // Create a custom pack layout
        const pack = d3.pack()
            .size([packWidth, packHeight])
            .padding(3);

        // Create hierarchy from items using the global radius scale
        // We use the squared radius as the value to get proper circle sizes
        const root = d3.hierarchy({children: itemsWithRadius})
            .sum(d => d.globalRadius * d.globalRadius);

        // Apply packing
        pack(root);

        // Return the positioned nodes (excluding root) with the global radius
        return root.leaves().map(node => ({
            ...node.data,
            x: node.x,
            y: node.y,
            r: node.data.globalRadius // Use the globally calculated radius
        }));
    }

    highlightSelectedItems(selectedItems) {
        if (!selectedItems || !Array.isArray(selectedItems)) {
            // Reset all to default opacity
            this.matSvg.selectAll(".house")
                .style("opacity", this.defaultOpacity);
            return;
        }

        // Create a Set of selected indices for faster lookup
        const selectedIndices = new Set(selectedItems.map(d => d.index));
        
        this.matSvg.selectAll(".house")
            .style("opacity", d => 
                selectedIndices.has(d.index) ? 1 : 0.2
            );
    }

    selectCellsInRange(startBed, startBath, endBed, endBath) {
        // Select all cells in the rectangular range
        const minBed = Math.min(startBed, endBed);
        const maxBed = Math.max(startBed, endBed);
        const minBath = Math.min(startBath, endBath);
        const maxBath = Math.max(startBath, endBath);
        
        const cellsToSelect = new Set();
        for (let bed = minBed; bed <= maxBed; bed++) {
            for (let bath = minBath; bath <= maxBath; bath++) {
                cellsToSelect.add(`${bed}-${bath}`);
            }
        }
        
        return cellsToSelect;
    }

    toggleCellSelection(bedrooms, bathrooms, controllerMethods) {
        const cellKey = `${bedrooms}-${bathrooms}`;
        
        if (this.selectedCells.has(cellKey) && this.selectedCells.size === 1) {
            // If this is the only selected cell, deselect it (go back to full view)
            this.selectedCells.clear();
        } else {
            // Select only this cell (replace any previous selections)
            this.selectedCells.clear();
            this.selectedCells.add(cellKey);
        }
        
        // Update visual state of cells
        this.updateCellVisualState();
        
        // Update filtered data
        this.updateFilteredData(controllerMethods);
    }

    updateFilteredData(controllerMethods) {
        // If any cells are selected, filter data from the full dataset
        if (this.selectedCells.size > 0) {
            const filteredData = this.fullData.filter(d => 
                this.selectedCells.has(`${d.bedrooms}-${d.bathrooms}`)
            );
            controllerMethods.updateSelectedItems(filteredData);
        } else {
            // No cells selected, show all data
            controllerMethods.updateSelectedItems(this.fullData);
        }
    }

    updateCellVisualState() {
        const selectedCells = this.selectedCells; // Capture in closure
        this.matSvg.selectAll(".small-multiple")
            .each(function(d) {
                const cellKey = `${d.bedrooms}-${d.bathrooms}`;
                const isSelected = selectedCells.has(cellKey);
                
                d3.select(this).select(".cell-background")
                    .attr("fill", isSelected ? "#e3f2fd" : "#f9f9f9")
                    .attr("stroke", isSelected ? "#1976d2" : "#ccc")
                    .attr("stroke-width", isSelected ? 3 : 1);
                    
                d3.select(this).select(".label-text")
                    .style("fill", isSelected ? "#1976d2" : "#333")
                    .style("font-weight", isSelected ? "bold" : "bold");
            });
    }

    renderMatrix(data, controllerMethods) {
        // Store controller methods for use in global handlers
        this.controllerMethods = controllerMethods;
        
        // Store the original full dataset on first render
        if (!this.fullData) {
            this.fullData = data;
        }
        
        // Store data for interactions
        this.allData = data;
        
        // Only clear selected cells if data has changed from external source
        // (e.g., brush selection from scatterplot), NOT from our own filtering
        // Check if the data change is from an external source by comparing with fullData
        const isExternalChange = this.lastDataLength !== undefined && 
                                 this.lastDataLength !== data.length &&
                                 this.selectedCells.size === 0;
        
        if (isExternalChange) {
            this.fullData = data; // Update the full dataset reference
        }
        
        this.lastDataLength = data.length;

        // Update color scale for price per square meter (price/m²)
        const pricePerSqM = data.map(d => d.price / d.area);
        const minPricePerSqM = d3.min(pricePerSqM);
        const maxPricePerSqM = d3.max(pricePerSqM);
        
        // Create color scale from green (low price/m²) to red (high price/m²)
        // Using RdYlGn reversed (so green is low, red is high)
        this.colorScale = d3.scaleSequential()
            .domain([maxPricePerSqM, minPricePerSqM]) // Reversed domain for RdYlGn
            .interpolator(d3.interpolateRdYlGn);

        // Create a global radius scale based on all currently shown data
        // This ensures consistent circle sizes across all cells
        const areas = data.map(d => d.area);
        const minArea = d3.min(areas);
        const maxArea = d3.max(areas);
        
        // Use a sqrt scale for radius (since area is proportional to r²)
        // The range [2, 20] can be adjusted based on desired min/max circle sizes
        const globalRadiusScale = d3.scaleSqrt()
            .domain([minArea, maxArea])
            .range([2, 20]); // Adjust these values to control min/max circle sizes
        
        // Store for use in packCircles
        this.globalRadiusScale = globalRadiusScale;

        // Group data by bedroom-bathroom combinations
        const cellData = this.groupDataByBedBath(data);
        
        // Calculate grid layout
        const layout = this.calculateGridLayout(cellData);

        // Create small multiple cells
        const cells = this.matSvg.selectAll(".small-multiple")
            .data(cellData, d => `${d.bedrooms}-${d.bathrooms}`)
            .join(
                enter => {
                    const cell = enter.append("g")
                        .attr("class", "small-multiple");
                    
                    // Add background rectangle for each cell
                    cell.append("rect")
                        .attr("class", "cell-background")
                        .attr("fill", "#f9f9f9")
                        .attr("stroke", "#ccc")
                        .attr("stroke-width", 1)
                        .style("cursor", "pointer")
                        .on("mousedown", (event, d) => {
                            event.preventDefault();
                            this.isDragging = true;
                            this.dragMoved = false; // Reset drag moved flag
                            this.dragStartCell = {bedrooms: d.bedrooms, bathrooms: d.bathrooms};
                            // Store the state before starting drag/click
                            this.preClickState = new Set(this.selectedCells);
                        })
                        .on("mouseenter", (event, d) => {
                            if (this.isDragging && this.dragStartCell) {
                                // Check if we moved to a different cell
                                if (d.bedrooms !== this.dragStartCell.bedrooms || 
                                    d.bathrooms !== this.dragStartCell.bathrooms) {
                                    this.dragMoved = true;
                                    // Now we're dragging - clear selections and select range
                                    const cellsInRange = this.selectCellsInRange(
                                        this.dragStartCell.bedrooms, 
                                        this.dragStartCell.bathrooms,
                                        d.bedrooms, 
                                        d.bathrooms
                                    );
                                    this.selectedCells = cellsInRange;
                                    this.updateCellVisualState();
                                }
                            }
                        })
                        .on("click", (event, d) => {
                            // Only toggle on click if we didn't drag to multiple cells
                            if (!this.dragMoved) {
                                event.stopPropagation();
                                this.toggleCellSelection(d.bedrooms, d.bathrooms, controllerMethods);
                            }
                        });
                    
                    // Add label group
                    const labelGroup = cell.append("g")
                        .attr("class", "cell-label")
                        .style("pointer-events", "none");
                    
                    labelGroup.append("text")
                        .attr("class", "label-text")
                        .attr("text-anchor", "middle")
                        .attr("dominant-baseline", "middle")
                        .style("font-size", "12px")
                        .style("font-weight", "bold")
                        .style("fill", "#333");
                    
                    // Add container for circles
                    cell.append("g")
                        .attr("class", "circles-container");
                    
                    return cell;
                },
                update => update,
                exit => exit.remove()
            );

        // Position cells in grid and update labels
        cells.attr("transform", d => {
            const col = layout.bedroomValues.indexOf(d.bedrooms);
            const row = layout.bathroomValues.indexOf(d.bathrooms);
            const x = col * layout.cellWidth;
            const y = row * layout.cellHeight;
            return `translate(${x},${y})`;
        });

        // Update cell backgrounds
        cells.select(".cell-background")
            .attr("width", layout.cellWidth)
            .attr("height", layout.cellHeight);

        // Update labels
        cells.select(".label-text")
            .attr("x", layout.cellWidth / 2)
            .attr("y", this.labelHeight / 2)
            .text(d => `${d.bedrooms}BR / ${d.bathrooms}BA (${d.count})`);

        // Update visual state based on selected cells
        this.updateCellVisualState();

        // For each cell, pack and render circles
        cells.each((cellDatum, cellIndex, cellNodes) => {
            const cellGroup = d3.select(cellNodes[cellIndex]);
            const packedItems = this.packCircles(cellDatum.items, layout.cellWidth, layout.cellHeight, this.globalRadiusScale);
            
            // Render circles within this cell
            const circles = cellGroup.select(".circles-container")
                .selectAll(".house")
                .data(packedItems, d => d.index)
                .join(
                    enter => {
                        const house = enter.append("g")
                            .attr("class", "house")
                            .style("opacity", this.defaultOpacity)
                            .style("cursor", "pointer");

                        // Add circle for each house
                        house.append("circle")
                            .attr("fill", d => this.colorScale(d.price / d.area))
                            .attr("stroke", "black")
                            .attr("stroke-width", 1)
                            .attr("r", 0); // Start with r=0 for smooth entry

                        // Add tooltip
                        house.append("title")
                            .text(d => `Price: €${d.price ? d.price.toLocaleString() : 'N/A'}
Price/m²: €${d.price && d.area ? Math.round(d.price/d.area) : 'N/A'}
Area: ${d.area || 'N/A'}m²
Bedrooms: ${d.bedrooms ?? 'N/A'}
Bathrooms: ${d.bathrooms ?? 'N/A'}
Stories: ${d.stories ?? 'N/A'}
Main Road: ${d.mainroad || 'N/A'}
Guest Room: ${d.guestroom || 'N/A'}
Basement: ${d.basement || 'N/A'}
Hot Water Heating: ${d.hotwaterheating || 'N/A'}
Air Conditioning: ${d.airconditioning || 'N/A'}
Parking: ${d.parking ?? 'N/A'}
Preferred Area: ${d.prefarea || 'N/A'}
Furnishing Status: ${d.furnishingstatus || 'N/A'}`);

                        return house;
                    },
                    update => update,
                    exit => exit.transition()
                        .duration(this.transitionDuration / 2)
                        .style("opacity", 0)
                        .remove()
                );

            // Position houses
            circles
                .attr("transform", d => `translate(${d.x + this.cellPadding},${d.y + this.cellPadding + this.labelHeight})`);

            // Animate circles with transition, then reattach event handlers
            circles.select("circle")
                .transition()
                .duration(this.transitionDuration)
                .attr("r", d => d.r)
                .attr("fill", d => this.colorScale(d.price / d.area))
                .end()
                .then(() => {
                    // After transition, ensure event handlers are attached
                    this.attachEventHandlers(cellGroup, controllerMethods);
                })
                .catch(() => {
                    // Even if transition is interrupted, attach handlers
                    this.attachEventHandlers(cellGroup, controllerMethods);
                });
            
            // Immediately attach handlers for non-transitioning elements
            this.attachEventHandlers(cellGroup, controllerMethods);
        });
    }

    attachEventHandlers(cellGroup, controllerMethods) {
        cellGroup.selectAll(".house")
            .on("click", function(event, d) {
                event.stopPropagation();
                // Circle click: highlight in scatterplot (no filtering)
                controllerMethods.updateHoveredItems([d]);
            })
            .on("contextmenu", (event, d) => {
                event.preventDefault(); // Prevent default context menu
                event.stopPropagation();
                
                // Add this house to removed indices
                this.removedIndices.add(d.index);
                
                // Filter out the removed house and update
                const filteredData = this.allData.filter(item => !this.removedIndices.has(item.index));
                
                // Update the full data to exclude removed items
                this.fullData = this.fullData.filter(item => !this.removedIndices.has(item.index));
                
                // Re-render with filtered data
                this.renderMatrix(filteredData, controllerMethods);
                
                // Update controller with filtered data
                if (this.selectedCells.size > 0) {
                    // If cells are selected, filter by both selection and removed items
                    const selectedFilteredData = filteredData.filter(item => 
                        this.selectedCells.has(`${item.bedrooms}-${item.bathrooms}`)
                    );
                    controllerMethods.updateSelectedItems(selectedFilteredData);
                } else {
                    controllerMethods.updateSelectedItems(filteredData);
                }
            })
            .on("mouseenter", function(event, d) {
                // Show in scatterplot on hover
                controllerMethods.updateHoveredItems([d]);
            })
            .on("mouseleave", function(event, d) {
                controllerMethods.clearHoveredItems();
            });
    }

    clear() {
        // Remove global event listener
        if (this.mouseUpHandler) {
            document.removeEventListener('mouseup', this.mouseUpHandler);
        }
        d3.select(this.el).selectAll("*").remove();
    }
}

export default MatrixD3;