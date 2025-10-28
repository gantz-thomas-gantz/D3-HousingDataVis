import * as d3 from 'd3'
// import { getDefaultFontSize } from '../../utils/helper';

class ScatterplotD3 {
    constructor(el) {
        this.margin = {top: 100, right: 10, bottom: 50, left: 100};
        this.size = null;
        this.height = null;
        this.width = null;
        this.matSvg = null;
        this.brush = null;
        this.defaultOpacity = 0.3;
        this.transitionDuration = 1000;
        this.circleRadius = 3;
        this.xScale = null;
        this.yScale = null;
        this.allData = null;
        this.el = el;
    }

    create(config) {
        this.size = {width: config.size.width, height: config.size.height};

        // get the effect size of the view by subtracting the margin
        this.width = this.size.width - this.margin.left - this.margin.right;
        this.height = this.size.height - this.margin.top - this.margin.bottom ;
        console.log("create SVG width=" + (this.width + this.margin.left + this.margin.right ) + " height=" + (this.height+ this.margin.top + this.margin.bottom));
        
        // initialize the svg and keep it in a class property to reuse it in renderScatterplot()
        const svg = d3.select(this.el).append("svg")
            .attr("width", this.width + this.margin.left + this.margin.right)
            .attr("height", this.height + this.margin.top + this.margin.bottom);

        // Add clip path
        svg.append("defs").append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("width", this.width)
            .attr("height", this.height);

        this.matSvg = svg.append("g")
            .attr("class","matSvgG")
            .attr("transform", "translate(" + this.margin.left + "," + this.margin.top + ")");

        this.xScale = d3.scaleLinear().range([0,this.width]);
        this.yScale = d3.scaleLinear().range([this.height,0]);

        // build xAxisG
        this.matSvg.append("g")
            .attr("class","xAxisG")
            .attr("transform","translate(0,"+this.height+")");

        this.matSvg.append("g")
            .attr("class","yAxisG");

        // Add axis labels
        this.matSvg.append("text")
            .attr("class", "xLabel")
            .attr("text-anchor", "middle")
            .attr("x", this.width / 2)
            .attr("y", this.height + 40)
            .text("Area (m²)");

        this.matSvg.append("text")
            .attr("class", "yLabel")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("x", -this.height / 2)
            .attr("y", -60)
            .text("Price");

        // Initialize brush
        this.brush = d3.brush()
            .extent([[0, 0], [this.width, this.height]])
            .on("end", (event) => this.brushed(event));

        // Add brush group
        this.matSvg.append("g")
            .attr("class", "brush");
    }

    brushed(event) {
        if (!this.allData || !event) return;

        const selection = event.selection;
        let selectedData = [];

        if (selection) {
            // Get the current brush coordinates
            const [[x0, y0], [x1, y1]] = selection;

            // Filter the data points that fall within the brushed area
            selectedData = this.allData.filter(d => {
                const x = this.xScale(d.area);
                const y = this.yScale(d.price);
                return x >= x0 && x <= x1 && y >= y0 && y <= y1;
            });

            // Update the view with the selected/unselected points
            this.matSvg.selectAll(".markerG")
                .style("opacity", d => {
                    const x = this.xScale(d.area);
                    const y = this.yScale(d.price);
                    return (x >= x0 && x <= x1 && y >= y0 && y <= y1)
                        ? 1
                        : 0.1;
                });

            // Call the callback with the selected items
            if (this.brushCallback && selectedData.length > 0) {
                this.brushCallback(selectedData);
            }
        } else {
            // Reset opacity if brush is cleared
            this.matSvg.selectAll(".markerG")
                .style("opacity", this.defaultOpacity);
            
            // Clear selection by calling callback with empty array
            if (this.brushCallback) {
                this.brushCallback([]);
            }
        }
    }

    changeBorderAndOpacity(selection, selected) {
        selection
            .style("opacity", selected ? 1 : this.defaultOpacity);

        selection.select(".markerCircle")
            .attr("stroke-width", selected ? 2 : 0);
    }

    updateMarkers(selection, xAttribute, yAttribute) {
        // transform selection
        selection
            .transition().duration(this.transitionDuration)
            .attr("transform", (item) => {
                // use scales to return shape position from data values
                const xPos = this.xScale(item[xAttribute]);
                const yPos = this.yScale(item[yAttribute]);
                return "translate(" + xPos + "," + yPos + ")";
            });
        this.changeBorderAndOpacity(selection, false);
    }

    highlightSelectedItems(selectedItems, isFiltered) {
        if (!selectedItems || !Array.isArray(selectedItems) || selectedItems.length === 0) {
            // Reset all points to default opacity with no border
            this.matSvg.selectAll(".markerG")
                .style("opacity", this.defaultOpacity)
                .select(".markerCircle")
                .attr("stroke-width", 0);
            return;
        }

        // Create a Set of selected indices for faster lookup
        const selectedIndices = new Set(selectedItems.map(d => d.index));

        if (isFiltered) {
            // When in filtered view (only showing a subset of data):
            // Hovered items get full opacity and red border
            // Non-hovered items maintain default opacity (light grey)
            this.matSvg.selectAll(".markerG")
                .style("opacity", d => selectedIndices.has(d.index) ? 1 : this.defaultOpacity)
                .select(".markerCircle")
                .attr("stroke-width", d => selectedIndices.has(d.index) ? 2 : 0);
        } else {
            // When not in filtered view (showing all data):
            // Highlight selected items with increased opacity and red border
            this.matSvg.selectAll(".markerG")
                .style("opacity", d => selectedIndices.has(d.index) ? 1 : this.defaultOpacity)
                .select(".markerCircle")
                .attr("stroke-width", d => selectedIndices.has(d.index) ? 2 : 0);
        }
    }

    updateAxis(visData, xAttribute, yAttribute) {
        // compute min max using d3.min/max(visData.map(item=>item.attribute))
        const minXAxis = d3.min(visData.map((item)=>{return item[xAttribute]}));
        const maxXAxis = d3.max(visData.map((item)=>{return item[xAttribute]}));
        const minYAxis = d3.min(visData.map((item)=>{return item[yAttribute]}));
        const maxYAxis = d3.max(visData.map((item)=>{return item[yAttribute]}));

        this.xScale.domain([minXAxis,maxXAxis]);
        this.yScale.domain([minYAxis,maxYAxis]);

        // create axis with computed scales
        this.matSvg.select(".xAxisG")
            .transition().duration(500)
            .call(d3.axisBottom(this.xScale))
        ;
        this.matSvg.select(".yAxisG")
            .transition().duration(500)
            .call(d3.axisLeft(this.yScale))
    }


    renderScatterplot(visData, xAttribute, yAttribute, controllerMethods) {
        console.log("render scatterplot with a new data list ...")
        // Store all data for brush filtering
        this.allData = visData;
        this.brushCallback = controllerMethods.handleOnClick;
        
        // build the size scales and x,y axis
        this.updateAxis(visData, xAttribute, yAttribute);

        // Clear and reapply brush
        this.matSvg.select(".brush").remove();
        this.matSvg.append("g")
            .attr("class", "brush")
            .call(this.brush);

        this.matSvg.selectAll(".markerG")
            // all elements with the class .markerG (empty the first time)
            .data(visData,(itemData)=>itemData.index)
            .join(
                enter=>{
                    // all data items to add:
                    // doesn’exist in the select but exist in the new array
                    const itemG=enter.append("g")
                        .attr("class","markerG")
                        .style("opacity",this.defaultOpacity)
                        .on("click", (event, itemData) => {
                            controllerMethods.handleOnClick([itemData]);
                        })
                    ;
                    // render element as child of each element "g"
                    itemG.append("circle")
                        .attr("class","markerCircle")
                        .attr("r",this.circleRadius)
                        .attr("stroke","red")
                    ;
                    this.updateMarkers(itemG,xAttribute,yAttribute);
                },
                update=>{
                    this.updateMarkers(update,xAttribute,yAttribute)
                },
                exit =>{
                    exit.remove()
                    ;
                }

            )
    }

    clear() {
        d3.select(this.el).selectAll("*").remove();
    }
}
export default ScatterplotD3;