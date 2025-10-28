import './App.css';
import {useState, useEffect, useCallback} from 'react'
import {fetchCSV} from "./utils/helper";
import ScatterplotContainer from "./components/scatterplot/ScatterplotContainer";
import MatrixContainer from "./components/matrix/MatrixContainer";

// Simple title component for visualizations
function VisualizationTitle({ title }) {
    return (
        <div className="visualization-title">
            {title}
        </div>
    );
}

function App() {
    console.log("App component function call...")
    const [data, setData] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [hoveredItems, setHoveredItems] = useState([]);
    const [brushedItems, setBrushedItems] = useState(null);
    const [isFiltered, setIsFiltered] = useState(false); // Track if we're in a filtered view
    
    // History tracking for back/forward navigation
    const [dataHistory, setDataHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // every time the component re-render
    useEffect(() => {
        console.log("App useEffect (called each time App re-renders)");
    }); // if no dependencies, useEffect is called at each re-render

    useEffect(() => {
        console.log("App did mount");
        fetchCSV("data/Housing.csv", (response) => {
            console.log("initial setData() ...");
            const initialData = response.data;
            setData(initialData);
            // Initialize history with the full dataset
            setDataHistory([initialData]);
            setHistoryIndex(0);
        })
        return () => {
            console.log("App did unmount");
        }
    }, []);

    const handleBrushSelection = useCallback((items) => {
        setBrushedItems(items);
        if (items && items.length > 0) {
            const selectedData = items.map(item => ({...item, selected: true}));
            setSelectedItems(selectedData);
            setIsFiltered(true); // We're now in a filtered view
            
            // Add to history and update data
            const newHistory = dataHistory.slice(0, historyIndex + 1);
            newHistory.push(items);
            setDataHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setData(items);
        }
    }, [dataHistory, historyIndex]);

    const handleMatrixSelection = useCallback((items) => {
        if (items && items.length > 0) {
            const selectedData = items.map(item => ({...item, selected: true}));
            setSelectedItems(selectedData);
            setIsFiltered(true); // We're now in a filtered view
            
            // Add to history and update data
            const newHistory = dataHistory.slice(0, historyIndex + 1);
            newHistory.push(items);
            setDataHistory(newHistory);
            setHistoryIndex(newHistory.length - 1);
            setData(items);
        }
    }, [dataHistory, historyIndex]);

    const handleMatrixHover = useCallback((items) => {
        setHoveredItems(items.map(item => ({...item, hovered: true})));
    }, []);

    // Navigation functions
    const goBack = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setData(dataHistory[newIndex]);
            setSelectedItems([]);
            setBrushedItems(null);
            // Update filtered state based on whether we're at the initial data
            setIsFiltered(newIndex > 0);
        }
    }, [historyIndex, dataHistory]);

    const goForward = useCallback(() => {
        if (historyIndex < dataHistory.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setData(dataHistory[newIndex]);
            setSelectedItems([]);
            setBrushedItems(null);
            // Update filtered state based on whether we're at the initial data
            setIsFiltered(newIndex > 0);
        }
    }, [historyIndex, dataHistory]);

    const scatterplotControllerMethods = {
        updateSelectedItems: handleBrushSelection
    };

    const matrixControllerMethods = {
        updateSelectedItems: handleMatrixSelection,
        updateHoveredItems: handleMatrixHover,
        clearHoveredItems: () => setHoveredItems([])
    };

    // Use current data from history
    const displayData = data;

    return (
        <div className="App">
            <div id="NavigationControls" className="navigation-controls">
                <button 
                    onClick={goBack} 
                    disabled={historyIndex <= 0}
                    className="nav-button"
                >
                    ← Back
                </button>
                <span className="history-info">
                    {data.length} houses
                </span>
                <button 
                    onClick={goForward} 
                    disabled={historyIndex >= dataHistory.length - 1}
                    className="nav-button"
                >
                    Forward →
                </button>
            </div>
            <div id={"MultiviewContainer"} className={"row"}>
                <div className="col2">
                    <VisualizationTitle title="Price vs Area (Use brush to filter)" />
                    <ScatterplotContainer 
                        scatterplotData={data} 
                        xAttribute={"area"} 
                        yAttribute={"price"} 
                        selectedItems={isFiltered ? hoveredItems : [...selectedItems, ...hoveredItems]} 
                        isFiltered={isFiltered}
                        scatterplotControllerMethods={scatterplotControllerMethods}
                    />
                </div>
                <div className="col2">
                    <VisualizationTitle title="Bedrooms/Bathrooms Matrix (Click or drag to select cells, then hover for details)" />
                    <MatrixContainer 
                        data={displayData}
                        selectedItems={selectedItems}
                        matrixControllerMethods={matrixControllerMethods}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;
