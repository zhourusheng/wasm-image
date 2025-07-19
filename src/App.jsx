import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Crop, Download, Folder, SlidersHorizontal, Trash2, Undo, Redo, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, ImagePlay, Check, X
} from 'lucide-react';
import { loadImageFromFile, drawImageToCanvas, exportImage } from './utils/imageUtils';
import HistoryManager from './utils/historyManager';

function App() {
  const [image, setImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropArea, setCropArea] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const historyManager = useRef(new HistoryManager()).current;

  // New: worker instance
  const imageWorker = useRef(null);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // A simple way to trigger re-render
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(tick => tick + 1);

  useEffect(() => {
    // create worker
    imageWorker.current = new Worker(new URL('./workers/imageWorker.js', import.meta.url));
    
    imageWorker.current.onmessage = (e) => {
        const { type, payload } = e.data;
        if (type === 'opencv-loaded') {
            setOpencvLoaded(true);
            console.log("OpenCV loaded in worker.");
        } else if (type === 'image-processed') {
            updateCanvasWithState(payload.imageData);
            historyManager.add(payload.imageData);
            forceUpdate();
            setLoading(false);
        } else if (type === 'error') {
            console.error("Error from worker:", payload);
            alert("An error occurred during image processing: " + payload);
            setLoading(false);
        }
    };
    
    return () => imageWorker.current && imageWorker.current.terminate();
  }, []);

  const updateCanvasWithState = (imageData) => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = imageData.width;
      canvasRef.current.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);
      setImageSize({ width: imageData.width, height: imageData.height });
    }
  };
  
  // Generic function to handle image editing
  const processEdit = useCallback((op, params = {}) => {
    if (!canvasRef.current || !opencvLoaded) {
        alert("OpenCV is not ready yet.");
        return;
    }
    setLoading(true);
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    imageWorker.current.postMessage({ type: 'image-process', payload: { imageData, action: op, params } });
  }, [opencvLoaded]);


  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setLoading(true);
      const loadedImage = await loadImageFromFile(file);
      setImage(loadedImage);
      setImageSize({ width: loadedImage.width, height: loadedImage.height });
      const imageData = drawImageToCanvas(loadedImage, canvasRef.current);
      historyManager.clear();
      historyManager.add(imageData);
      forceUpdate();
    } catch (error) {
      console.error(error);
      alert(error.message);
    } finally {
        setLoading(false);
    }
  }, [historyManager]);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
  
  const handleDownloadClick = () => {
    if (!image) {
      alert('Please upload an image first');
      return;
    }
    exportImage(canvasRef.current, 'edited-image');
  };
  
  const handleUndo = () => {
    const prevState = historyManager.undo();
    if (prevState) {
      updateCanvasWithState(prevState);
      forceUpdate();
    }
  };
  
  const handleRedo = () => {
    const nextState = historyManager.redo();
    if (nextState) {
      updateCanvasWithState(nextState);
      forceUpdate();
    }
  };

  // --- All tool functions now use processEdit ---
  const handleRotateCw = () => processEdit('rotate', { angle: 90 });
  const handleRotateCcw = () => processEdit('rotate', { angle: -90 });
  const handleFlipH = () => processEdit('flip', { mode: 0 });
  const handleFlipV = () => processEdit('flip', { mode: 1 });
  const handleBlur = () => processEdit('blur');
  const handleGrayscale = () => processEdit('grayscale');
  const handleCanny = () => processEdit('canny');
  const handleThreshold = () => processEdit('threshold');


  // Crop related functions
  const handleCropModeToggle = () => {
    if (!image) {
      alert('Please upload an image first');
      return;
    }
    setIsCropMode(!isCropMode);
    if (isCropMode) {
      setCropArea(null);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropArea) {
      alert('Please select a crop area first');
      return;
    }
    if (cropArea.width < 10 || cropArea.height < 10) {
      alert('Crop area is too small');
      return;
    }
    processEdit('crop', cropArea);
    setIsCropMode(false);
    setCropArea(null);
  };

  const handleCropCancel = () => {
    setIsCropMode(false);
    setCropArea(null);
    // Restore canvas to original state before entering crop mode
    const currentState = historyManager.getCurrentState();
    if(currentState) {
        updateCanvasWithState(currentState);
    }
  };

  const getCanvasCoordinates = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleCanvasMouseDown = (e) => {
    if (!isCropMode) return;
    const coords = getCanvasCoordinates(e);
    setIsDragging(true);
    setDragStart(coords);
    setCropArea({
      x: coords.x,
      y: coords.y,
      width: 0,
      height: 0
    });
  };

  const handleCanvasMouseMove = (e) => {
    if (!isCropMode || !isDragging) return;
    const coords = getCanvasCoordinates(e);
    const canvas = canvasRef.current;
    const clampedX = Math.max(0, Math.min(coords.x, canvas.width));
    const clampedY = Math.max(0, Math.min(coords.y, canvas.height));
    const width = clampedX - dragStart.x;
    const height = clampedY - dragStart.y;
    setCropArea(prev => ({
      x: width >= 0 ? dragStart.x : clampedX,
      y: height >= 0 ? dragStart.y : clampedY,
      width: Math.abs(width),
      height: Math.abs(height)
    }));
  };

  const handleCanvasMouseUp = () => {
    if (!isCropMode) return;
    setIsDragging(false);
  };
  
  // Draw crop selection overlay
  useEffect(() => {
    if (!canvasRef.current || !isCropMode) return;
    
    // Redraw the current image state first to clear previous overlays
    const currentState = historyManager.getCurrentState();
    if(currentState) {
        updateCanvasWithState(currentState);
    }
    
    if (!cropArea) return;

    const ctx = canvasRef.current.getContext('2d');
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Clear the crop area from the overlay
    if(cropArea.width > 0 && cropArea.height > 0) {
        ctx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }

    // Draw crop border
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
  }, [cropArea, isCropMode]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <ImagePlay size={28} className="text-blue-500" />
          <h1 className="font-semibold text-lg">Wasm Image Editor</h1>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
          />
          <button className="icon-btn" onClick={handleUploadClick}>
            <Folder size={20} />
          </button>
          <button className="icon-btn" onClick={handleDownloadClick}>
            <Download size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-2">
           <button className="icon-btn" onClick={handleGrayscale} disabled={!image || loading}><SlidersHorizontal size={24} /></button>
           <button className="icon-btn" onClick={handleBlur} disabled={!image || loading}>B</button>
           <button className="icon-btn" onClick={handleCanny} disabled={!image || loading}>C</button>
           <button className="icon-btn" onClick={handleThreshold} disabled={!image || loading}>T</button>
           <button 
            className={`icon-btn ${isCropMode ? 'active' : ''}`}
            onClick={handleCropModeToggle}
            disabled={!image || loading}
           >
            <Crop size={24} />
          </button>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 w-full flex flex-col items-center space-y-2">
             <button className="icon-btn" onClick={handleRotateCw} disabled={!image || loading}>
              <RotateCw size={24} />
            </button>
            <button className="icon-btn" onClick={handleRotateCcw} disabled={!image || loading}>
              <RotateCcw size={24} />
            </button>
            <button className="icon-btn" onClick={handleFlipH} disabled={!image || loading}>
              <FlipHorizontal size={24} />
            </button>
             <button className="icon-btn" onClick={handleFlipV} disabled={!image || loading}>
              <FlipVertical size={24} />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar for main content */}
          <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <button className="icon-btn" onClick={handleUndo} disabled={!historyManager.canUndo() || loading}>
                <Undo size={20} />
              </button>
              <button className="icon-btn" onClick={handleRedo} disabled={!historyManager.canRedo() || loading}>
                <Redo size={20} />
              </button>
            </div>
            {isCropMode && (
              <div className="flex items-center space-x-2">
                <button className="icon-btn text-green-500" onClick={handleCropConfirm}>
                  <Check size={20} />
                </button>
                <button className="icon-btn text-red-500" onClick={handleCropCancel}>
                  <X size={20} />
                </button>
              </div>
            )}
            <div className='text-sm text-gray-500'>
                {loading ? "Processing..." : (opencvLoaded ? "OpenCV Ready" : "Loading OpenCV...")}
            </div>
          </div>

          {/* Canvas Area */}
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-200 dark:bg-gray-800/30 overflow-auto relative">
            <canvas 
              id="canvas" 
              ref={canvasRef} 
              className={`max-w-full max-h-full bg-white dark:bg-gray-700 shadow-lg rounded-md ${!image ? 'hidden' : ''} ${isCropMode ? 'cursor-crosshair' : ''}`}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            ></canvas>
            {!image && (
              <div className="absolute flex items-center justify-center inset-0">
                <div className="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-xl backdrop-blur-sm">
                  <h2 className="text-2xl font-semibold mb-2">No Image Loaded</h2>
                  <p className="text-gray-500 dark:text-gray-400">Upload an image to start editing</p>
                  <button onClick={handleUploadClick} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                    Upload Image
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <footer className="h-10 flex items-center justify-center px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
            <div>
              <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : 'No Image'}</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App; 