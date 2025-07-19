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

  // 新增：worker实例（ES module方式）
  const imageWorker = useRef(null);
  useEffect(() => {
    // 创建worker
    imageWorker.current = new Worker(new URL('./workers/imageWorker.js', import.meta.url), { type: 'module' });
    
    return () => imageWorker.current && imageWorker.current.terminate();
  }, []);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const loadedImage = await loadImageFromFile(file);
      setImage(loadedImage);
      setImageSize({ width: loadedImage.width, height: loadedImage.height });
      const imageData = drawImageToCanvas(loadedImage, canvasRef.current);
      historyManager.clear();
      historyManager.addState(imageData);
      // Force update to enable/disable undo/redo buttons
      forceUpdate();
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }, [historyManager]);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
  
  const handleDownloadClick = () => {
    if (!image) {
      alert('请先上传一张图片');
      return;
    }
    exportImage(canvasRef.current, 'edited-image');
  };
  
  const updateCanvasWithState = (imageData) => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      canvasRef.current.width = imageData.width;
      canvasRef.current.height = imageData.height;
      ctx.putImageData(imageData, 0, 0);
      setImageSize({ width: imageData.width, height: imageData.height });
    }
  };
  
  // A simple way to trigger re-render
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(tick => tick + 1);

  // 新增：处理图像编辑的通用函数
  const processEdit = useCallback((op, params) => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    return new Promise((resolve, reject) => {
      imageWorker.current.onmessage = (e) => {
        if (e.data.error) {
          alert(e.data.error);
          reject(e.data.error);
        } else {
          updateCanvasWithState(e.data.result);
          historyManager.addState(e.data.result);
          forceUpdate();
          resolve();
        }
      };
      imageWorker.current.postMessage({ imageData, op, params });
    });
  }, [historyManager]);

  // 裁剪相关函数
  const handleCropModeToggle = () => {
    if (!image) {
      alert('请先上传一张图片');
      return;
    }
    setIsCropMode(!isCropMode);
    if (isCropMode) {
      setCropArea(null);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropArea) {
      alert('请先选择裁剪区域');
      return;
    }
    
    // 检查裁剪区域是否太小
    if (cropArea.width < 10 || cropArea.height < 10) {
      alert('裁剪区域太小，请选择更大的区域');
      return;
    }
    
    try {
      await processEdit('crop', cropArea);
      setIsCropMode(false);
      setCropArea(null);
    } catch (error) {
      console.error('裁剪失败:', error);
    }
  };

  const handleCropCancel = () => {
    setIsCropMode(false);
    setCropArea(null);
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
    
    // 确保坐标不超出画布边界
    const clampedX = Math.max(0, Math.min(coords.x, canvas.width));
    const clampedY = Math.max(0, Math.min(coords.y, canvas.height));
    
    // 计算裁剪区域，支持从任意方向拖拽
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

  // 旋转
  const handleRotateCw = () => processEdit('rotate', { angle: 90 });
  const handleRotateCcw = () => processEdit('rotate', { angle: -90 });
  // 翻转
  const handleFlipH = () => processEdit('flip', { mode: 0 });
  const handleFlipV = () => processEdit('flip', { mode: 1 });
  // 缩放（示例：放大1.2倍）
  const handleResize = () => {
    if (!canvasRef.current) return;
    const { width, height } = canvasRef.current;
    processEdit('resize', { width: Math.round(width * 1.2), height: Math.round(height * 1.2) });
  };
  // 亮度、对比度、饱和度调整
  const handleBrightness = (delta) => processEdit('brightness', { delta });
  const handleContrast = (factor) => processEdit('contrast', { factor });
  const handleSaturation = (factor) => processEdit('saturation', { factor });
  
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

  // 绘制裁剪框
  useEffect(() => {
    if (!canvasRef.current || !isCropMode || !cropArea) return;
    
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 重新绘制图像
    ctx.putImageData(imageData, 0, 0);
    
    // 绘制半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // 清除裁剪区域内的遮罩
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    ctx.globalCompositeOperation = 'source-over';
    
    // 绘制裁剪框边框
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
    // 重置虚线样式
    ctx.setLineDash([]);
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
            accept="image/png, image/jpeg, image/webp, image/gif"
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
          <button className="icon-btn active">
            <SlidersHorizontal size={24} />
          </button>
          <button 
            className={`icon-btn ${isCropMode ? 'active' : ''}`}
            onClick={handleCropModeToggle}
          >
            <Crop size={24} />
          </button>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 w-full flex flex-col items-center space-y-2">
             <button className="icon-btn" onClick={handleRotateCw}>
              <RotateCw size={24} />
            </button>
            <button className="icon-btn" onClick={handleRotateCcw}>
              <RotateCcw size={24} />
            </button>
            <button className="icon-btn" onClick={handleFlipH}>
              <FlipHorizontal size={24} />
            </button>
             <button className="icon-btn" onClick={handleFlipV}>
              <FlipVertical size={24} />
            </button>
            <button className="icon-btn" onClick={handleResize}>
              <ZoomIn size={24} />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar for main content */}
          <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <button className="icon-btn" onClick={handleUndo} disabled={!historyManager.canUndo()}>
                <Undo size={20} />
              </button>
              <button className="icon-btn" onClick={handleRedo} disabled={!historyManager.canRedo()}>
                <Redo size={20} />
              </button>
              <button className="icon-btn">
                <Trash2 size={20} />
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
            {isCropMode && image && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-md text-sm">
                拖拽鼠标选择裁剪区域，然后点击确认按钮
              </div>
            )}
          </div>
          
          {/* Footer */}
          <footer className="h-10 flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
            <div>
              <span>Zoom: 100%</span>
            </div>
            <div className="flex items-center space-x-2">
               <button className="icon-btn">
                <ZoomOut size={20} />
              </button>
              <input type="range" min="10" max="400" defaultValue="100" className="w-32" />
               <button className="icon-btn">
                <ZoomIn size={20} />
              </button>
            </div>
            <div>
              <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : 'No Image'}</span>
            </div>
          </footer>
        </main>

        {/* Right Properties Panel */}
        <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">Adjustments</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Brightness</label>
              <input type="range" className="w-full" min="-100" max="100" defaultValue="0" onChange={e => handleBrightness(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Contrast</label>
              <input type="range" className="w-full" min="0.1" max="3" step="0.01" defaultValue="1" onChange={e => handleContrast(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Saturation</label>
              <input type="range" className="w-full" min="0" max="3" step="0.01" defaultValue="1" onChange={e => handleSaturation(Number(e.target.value))} />
            </div>
             <div>
              <label className="block text-sm font-medium mb-1">Blur</label>
              <input type="range" className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Sharpen</label>
              <input type="range" className="w-full" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App; 