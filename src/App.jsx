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
  // 移除 cropBitmapRef，使用更简单的方法
  const originalImageRef = useRef(null);

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
            console.log("OpenCV 已在 worker 中加载。");
        } else if (type === 'image-processed') {
            console.log(`收到处理后的图像数据: ${payload.imageData.width} x ${payload.imageData.height}`);
            updateCanvasWithState(payload.imageData);
            historyManager.add(payload.imageData);
            forceUpdate();
            setLoading(false);
        } else if (type === 'error') {
            console.error("来自 worker 的错误:", payload);
            alert("图像处理期间发生错误： " + payload);
            setLoading(false);
        }
    };
    
    return () => imageWorker.current && imageWorker.current.terminate();
  }, []);

  const updateCanvasWithState = (imageData) => {
    if (imageData && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      
      console.log(`更新画布: ${imageData.width} x ${imageData.height}`);
      
      // 确保画布尺寸与图像数据匹配
      canvasRef.current.width = imageData.width;
      canvasRef.current.height = imageData.height;
      
      try {
        ctx.putImageData(imageData, 0, 0);
        setImageSize({ width: imageData.width, height: imageData.height });
      } catch (e) {
        console.error('更新画布失败:', e);
        alert('更新画布失败: ' + e.message);
      }
    } else {
      console.warn('无法更新画布: 图像数据或画布引用无效');
    }
  };
  
  // Generic function to handle image editing
  const processEdit = useCallback((op, params = {}) => {
    if (!canvasRef.current || !opencvLoaded) {
        alert("OpenCV 尚未准备好。");
        return;
    }
    setLoading(true);
    const ctx = canvasRef.current.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    console.log(`开始处理图像操作: ${op}`, params);
    console.log(`源图像尺寸: ${imageData.width} x ${imageData.height}`);
    
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
      alert('请先上传一张图片');
      return;
    }
    exportImage(canvasRef.current, '已编辑图像');
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
      alert('请先上传一张图片');
      return;
    }
    const newCropMode = !isCropMode;
    setIsCropMode(newCropMode);

    if (newCropMode) {
      // 进入裁剪模式，保存当前图像状态
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      originalImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCropArea(null); // 重置裁剪区域
    } else {
      // 退出裁剪模式，恢复原始图像
      setCropArea(null);
      if (originalImageRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = originalImageRef.current.width;
        canvas.height = originalImageRef.current.height;
        ctx.putImageData(originalImageRef.current, 0, 0);
        originalImageRef.current = null;
      }
    }
  };

  const handleCropConfirm = () => {
    if (!cropArea) {
      alert('请先选择裁剪区域');
      return;
    }
    if (cropArea.width < 10 || cropArea.height < 10) {
      alert('裁剪区域太小');
      return;
    }
    
    console.log('裁剪区域:', cropArea);
    
    // 确保裁剪区域不超出画布边界
    const canvas = canvasRef.current;
    const safeArea = {
      x: Math.max(0, Math.min(cropArea.x, canvas.width)),
      y: Math.max(0, Math.min(cropArea.y, canvas.height)),
      width: Math.min(cropArea.width, canvas.width - Math.max(0, cropArea.x)),
      height: Math.min(cropArea.height, canvas.height - Math.max(0, cropArea.y))
    };
    
    console.log('安全裁剪区域:', safeArea);
    
    try {
      // 恢复原始图像（没有绿色边框的图像）
      const ctx = canvas.getContext('2d');
      if (originalImageRef.current) {
        ctx.putImageData(originalImageRef.current, 0, 0);
      }
      
      // 创建临时画布来处理裁剪
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCanvas.width = safeArea.width;
      tempCanvas.height = safeArea.height;
      
      // 将原始图像数据绘制到临时画布
      tempCtx.drawImage(
        canvas, 
        safeArea.x, safeArea.y, safeArea.width, safeArea.height, // 源矩形
        0, 0, safeArea.width, safeArea.height // 目标矩形
      );
      
      // 获取裁剪后的图像数据
      const croppedImageData = tempCtx.getImageData(0, 0, safeArea.width, safeArea.height);
      
      // 调整原始画布尺寸并绘制裁剪后的图像
      canvas.width = safeArea.width;
      canvas.height = safeArea.height;
      ctx.putImageData(croppedImageData, 0, 0);
      
      // 更新图像尺寸状态
      setImageSize({ width: safeArea.width, height: safeArea.height });
      
      // 将裁剪后的图像添加到历史记录
      historyManager.add(croppedImageData);
      
      // 清理并退出裁剪模式
      setIsCropMode(false);
      setCropArea(null);
      originalImageRef.current = null;
      
    } catch (e) {
      console.error('裁剪失败:', e);
      alert('裁剪操作失败: ' + e.message);
      
      // 恢复原始图像
      if (originalImageRef.current) {
        const ctx = canvas.getContext('2d');
        canvas.width = originalImageRef.current.width;
        canvas.height = originalImageRef.current.height;
        ctx.putImageData(originalImageRef.current, 0, 0);
      }
      
      setIsCropMode(false);
      setCropArea(null);
    }
  };

  const handleCropCancel = () => {
    setIsCropMode(false);
    setCropArea(null);
    
    // 恢复原始图像
    if (originalImageRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = originalImageRef.current.width;
      canvas.height = originalImageRef.current.height;
      ctx.putImageData(originalImageRef.current, 0, 0);
      originalImageRef.current = null;
    }
  };

  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // 计算鼠标在画布上的实际像素位置
    // 注意：这里我们需要考虑画布的CSS尺寸和实际像素尺寸之间的比例
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    // 将鼠标位置从客户端坐标系转换到画布坐标系
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    
    return { x, y };
  };

  // 添加一个新的状态来跟踪拖动模式
  const [dragMode, setDragMode] = useState('create'); // 'create', 'move'
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleCanvasMouseDown = (e) => {
    if (!isCropMode) return;
    
    const coords = getCanvasCoordinates(e);
    
    // 检查是否点击了已存在的裁剪区域
    if (cropArea) {
      // 检查点击是否在裁剪区域内
      if (coords.x >= cropArea.x && coords.x <= cropArea.x + cropArea.width &&
          coords.y >= cropArea.y && coords.y <= cropArea.y + cropArea.height) {
        // 点击在裁剪区域内，进入移动模式
        setDragMode('move');
        setDragOffset({
          x: coords.x - cropArea.x,
          y: coords.y - cropArea.y
        });
        setIsDragging(true);
        return;
      }
    }
    
    // 点击在裁剪区域外或没有裁剪区域，创建新的裁剪区域
    setDragMode('create');
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
    
    if (dragMode === 'create') {
      // 创建或调整裁剪区域
      const width = coords.x - dragStart.x;
      const height = coords.y - dragStart.y;
      
      setCropArea({
        x: width >= 0 ? dragStart.x : coords.x,
        y: height >= 0 ? dragStart.y : coords.y,
        width: Math.abs(width),
        height: Math.abs(height)
      });
    } else if (dragMode === 'move') {
      // 移动已存在的裁剪区域
      setCropArea(prev => ({
        ...prev,
        x: coords.x - dragOffset.x,
        y: coords.y - dragOffset.y
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    if (!isCropMode) return;
    setIsDragging(false);
  };
  
  // Draw crop selection overlay
  useEffect(() => {
    if (!canvasRef.current || !isCropMode) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // 如果没有选择区域，只需显示原始图像
    if (!cropArea) {
      if (originalImageRef.current) {
        ctx.putImageData(originalImageRef.current, 0, 0);
      }
      return;
    }
    
    // 重新绘制原始图像
    if (originalImageRef.current) {
      // 先清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // 绘制原始图像
      ctx.putImageData(originalImageRef.current, 0, 0);
      
      // 使用临时画布来创建裁剪预览效果
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      // 在临时画布上绘制半透明遮罩
      tempCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // 计算裁剪区域与画布的交集（用于显示）
      const visibleArea = {
        x: Math.max(0, Math.min(cropArea.x, canvas.width)),
        y: Math.max(0, Math.min(cropArea.y, canvas.height)),
        width: Math.min(cropArea.width, canvas.width - Math.max(0, cropArea.x)),
        height: Math.min(cropArea.height, canvas.height - Math.max(0, cropArea.y))
      };
      
      // 只有当有可见区域时才清除遮罩
      if (visibleArea.width > 0 && visibleArea.height > 0) {
        // 在临时画布上清除裁剪区域
        tempCtx.clearRect(visibleArea.x, visibleArea.y, visibleArea.width, visibleArea.height);
      }
      
      // 将临时画布上的遮罩绘制到主画布上
      ctx.drawImage(tempCanvas, 0, 0);
      
      // 绘制裁剪区域边框 - 只在预览时显示，不影响最终裁剪结果
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      
      // 修复边框绘制问题，确保四个边框都能正确显示
      // 使用四条线段分别绘制四个边框，而不是使用 strokeRect
      const x = Math.floor(cropArea.x) + 0.5; // 加0.5使线条居中在像素上
      const y = Math.floor(cropArea.y) + 0.5;
      const width = Math.floor(cropArea.width);
      const height = Math.floor(cropArea.height);
      
      ctx.beginPath();
      // 上边框
      ctx.moveTo(x, y);
      ctx.lineTo(x + width, y);
      // 右边框
      ctx.moveTo(x + width, y);
      ctx.lineTo(x + width, y + height);
      // 下边框
      ctx.moveTo(x + width, y + height);
      ctx.lineTo(x, y + height);
      // 左边框
      ctx.moveTo(x, y + height);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
  }, [cropArea, isCropMode]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
        <div className="flex items-center space-x-2">
          <ImagePlay size={28} className="text-blue-500" />
          <h1 className="font-semibold text-lg">Wasm 图像编辑器</h1>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
          />
          <button className="icon-btn" onClick={handleUploadClick} title="打开文件">
            <Folder size={20} />
          </button>
          <button className="icon-btn" onClick={handleDownloadClick} title="下载图像">
            <Download size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-2">
           <button className="icon-btn" onClick={handleGrayscale} disabled={!image || loading} title="灰度"><SlidersHorizontal size={24} /></button>
           <button className="icon-btn" onClick={handleBlur} disabled={!image || loading} title="模糊">B</button>
           <button className="icon-btn" onClick={handleCanny} disabled={!image || loading} title="边缘检测">C</button>
           <button className="icon-btn" onClick={handleThreshold} disabled={!image || loading} title="阈值">T</button>
           <button 
            className={`icon-btn ${isCropMode ? 'active' : ''}`}
            onClick={handleCropModeToggle}
            disabled={!image || loading}
            title="裁剪"
           >
            <Crop size={24} />
          </button>
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 w-full flex flex-col items-center space-y-2">
             <button className="icon-btn" onClick={handleRotateCw} disabled={!image || loading} title="顺时针旋转">
              <RotateCw size={24} />
            </button>
            <button className="icon-btn" onClick={handleRotateCcw} disabled={!image || loading} title="逆时针旋转">
              <RotateCcw size={24} />
            </button>
            <button className="icon-btn" onClick={handleFlipH} disabled={!image || loading} title="水平翻转">
              <FlipHorizontal size={24} />
            </button>
             <button className="icon-btn" onClick={handleFlipV} disabled={!image || loading} title="垂直翻转">
              <FlipVertical size={24} />
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col">
          {/* Top bar for main content */}
          <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <button className="icon-btn" onClick={handleUndo} disabled={!historyManager.canUndo() || loading} title="撤销">
                <Undo size={20} />
              </button>
              <button className="icon-btn" onClick={handleRedo} disabled={!historyManager.canRedo() || loading} title="重做">
                <Redo size={20} />
              </button>
            </div>
            {isCropMode && (
              <div className="flex items-center space-x-2">
                <button className="icon-btn text-green-500" onClick={handleCropConfirm} title="确认">
                  <Check size={20} />
                </button>
                <button className="icon-btn text-red-500" onClick={handleCropCancel} title="取消">
                  <X size={20} />
                </button>
              </div>
            )}
            <div className='text-sm text-gray-500'>
                {loading ? "处理中..." : (opencvLoaded ? "OpenCV 已就绪" : "正在加载 OpenCV...")}
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
                  <h2 className="text-2xl font-semibold mb-2">未加载图像</h2>
                  <p className="text-gray-500 dark:text-gray-400">上传一张图片开始编辑</p>
                  <button onClick={handleUploadClick} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
                    上传图片
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <footer className="h-10 flex items-center justify-center px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
            <div>
              <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : '无图像'}</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App; 