import './Matrix.css'
import { useEffect, useRef } from 'react';
import MatrixD3 from './Matrix-d3';

function MatrixContainer({ data, selectedItems, matrixControllerMethods }) {
    // useEffect for logging renders
    useEffect(() => {
        console.log("MatrixContainer useEffect (called each time matrix re-renders)");
    });

    const divContainerRef = useRef(null);
    const matrixD3Ref = useRef(null);

    const getChartSize = function() {
        let width, height;
        if (divContainerRef.current !== undefined) {
            width = divContainerRef.current.offsetWidth;
            height = divContainerRef.current.offsetHeight - 4;
        }
        return { width, height };
    }

    // Component mount effect
    useEffect(() => {
        console.log("MatrixContainer useEffect [] called once the component did mount");
        const matrixD3 = new MatrixD3(divContainerRef.current);
        matrixD3.create({ size: getChartSize() });
        matrixD3Ref.current = matrixD3;
        
        return () => {
            console.log("MatrixContainer useEffect [] return function, called when the component did unmount...");
            const matrixD3 = matrixD3Ref.current;
            matrixD3.clear();
        }
    }, []);

    // Data update effect
    const dataRef = useRef(data);
    useEffect(() => {
        console.log("MatrixContainer useEffect with dependency [data, matrixControllerMethods], called each time data changes...");

        const controllerMethods = {
            updateSelectedItems: (items) => {
                matrixControllerMethods.updateSelectedItems(items);
            },
            updateHoveredItems: (items) => {
                matrixControllerMethods.updateHoveredItems(items);
            },
            clearHoveredItems: () => {
                matrixControllerMethods.clearHoveredItems();
            }
        }

        if (dataRef.current !== data) {
            const matrixD3 = matrixD3Ref.current;
            matrixD3.renderMatrix(data, controllerMethods);
            dataRef.current = data;
        }
    }, [data, matrixControllerMethods]);

    // Selected items update effect
    useEffect(() => {
        console.log("MatrixContainer useEffect with dependency [selectedItems], called each time selectedItems changes...");
        const matrixD3 = matrixD3Ref.current;
        matrixD3.highlightSelectedItems(selectedItems);
    }, [selectedItems]);

    return (
        <div ref={divContainerRef} className="matrixDivContainer col2">
        </div>
    );
}

export default MatrixContainer;