import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Crop, Download, Folder, SlidersHorizontal, Trash2, Undo, Redo, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, ImagePlay, Check, X
} from 'lucide-react';
import { loadImageFromFile, getImageDataFromImage, exportImage } from './utils/imageUtils';
import HistoryManager from './utils/historyManager';

function App() {
  const [image, setImage] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isCropMode, setIsCropMode] = useState(false);
  const [cropArea, setCropArea] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null); // 用于裁剪的覆盖层 Canvas
  const fileInputRef = useRef(null);
  const historyManager = useRef(new HistoryManager()).current;
  // 移除 cropBitmapRef，使用更简单的方法
  const originalImageRef = useRef(null);

  // worker 实例
  const imageWorker = useRef(null);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [workerReady, setWorkerReady] = useState(false); // 跟踪 worker 是否准备好接收任务
  const [loading, setLoading] = useState(false);
  
  // 一个简单的触发重新渲染的方法
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(tick => tick + 1);

  // 通用图像编辑处理函数
  // 将此函数定义移到所有调用它的函数之前
  const processEdit = useCallback((op, params = {}) => {
    if (!canvasRef.current || !workerReady) {
        alert("Worker 尚未准备好。");
        return;
    }
    setLoading(true);

    // 获取当前状态用于处理
    const currentImageData = historyManager.getCurrentState();
    if (!currentImageData) {
        alert("没有可用的图像数据。");
        setLoading(false);
        return;
    }

    console.log(`开始处理图像操作: ${op}`, params);
    
    // 发送当前图像数据和操作给 worker
    imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: currentImageData, action: op, params } });
    
  }, [workerReady, historyManager]);
  
  // 主 effect，用于 Worker 初始化，仅运行一次
  useEffect(() => {
    const worker = new Worker(new URL('./workers/imageWorker.js', import.meta.url));
    imageWorker.current = worker;
    
    worker.onmessage = (e) => {
        const { type, payload } = e.data;
        switch (type) {
            case 'opencv-loaded':
                setOpencvLoaded(true);
                console.log("OpenCV 已在 worker 中加载。");
                if (canvasRef.current) {
                    // 这一步现在只会执行一次
                    const offscreen = canvasRef.current.transferControlToOffscreen();
                    worker.postMessage({ type: 'init', payload: { canvas: offscreen } }, [offscreen]);
                }
                break;
            case 'worker-ready':
                setWorkerReady(true);
                console.log("Worker 已准备好处理图像。");
                break;
            case 'image-processed':
                console.log('Worker 完成图像处理');
                // 现在我们从 worker 接收 imageData 用于历史记录
                if (payload.imageData) {
                    setImageSize({ width: payload.imageData.width, height: payload.imageData.height });
                    historyManager.add(payload.imageData);
                    forceUpdate(); // 更新撤销/重做按钮状态
                }
                setLoading(false);
                break;
            case 'error':
                console.error("来自 worker 的错误:", payload);
                alert("图像处理期间发生错误： " + payload);
                setLoading(false);
                break;
        }
    };
    
    return () => worker.terminate();
  }, []); // 空依赖数组确保此 effect 仅在挂载时运行一次

  // 用于处理新图像加载的 effect
  useEffect(() => {
    if (image && workerReady) {
      setLoading(true);
      const imageData = getImageDataFromImage(image);
      historyManager.clear();
      forceUpdate();
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData, action: 'original' } });
    }
  }, [image, workerReady]);

  // 此处移除了 processEdit 的定义，因为它已被移到前面

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const loadedImage = await loadImageFromFile(file);
      // 仅更新 image state，触发上面的 useEffect 来处理后续逻辑
      setImage(loadedImage); 
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  }, []);

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
    if (!historyManager.canUndo()) return;
    const prevState = historyManager.undo();
    if (prevState && workerReady) {
      setLoading(true);
      // 将历史状态发送给 worker 进行重绘
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: prevState, action: 'original' } });
      forceUpdate();
    }
  };
  
  const handleRedo = () => {
    if (!historyManager.canRedo()) return;
    const nextState = historyManager.redo();
    if (nextState && workerReady) {
      setLoading(true);
      // 将历史状态发送给 worker 进行重绘
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: nextState, action: 'original' } });
      forceUpdate();
    }
  };

  // --- 所有工具函数现在都使用 processEdit ---
  const handleRotateCw = () => processEdit('rotate', { angle: 90 });
  const handleRotateCcw = () => processEdit('rotate', { angle: -90 });
  const handleFlipH = () => processEdit('flip', { mode: 0 });
  const handleFlipV = () => processEdit('flip', { mode: 1 });
  const handleBlur = () => processEdit('blur');
  const handleGrayscale = () => processEdit('grayscale');
  const handleCanny = () => processEdit('canny');
  const handleThreshold = () => processEdit('threshold');


  // 裁剪相关函数
  const handleCropModeToggle = () => {
    if (!image) {
      alert('请先上传一张图片');
      return;
    }
    const newCropMode = !isCropMode;
    setIsCropMode(newCropMode);

    if (newCropMode) {
      const mainCanvas = canvasRef.current;
      const cropCanvas = cropCanvasRef.current;

      if (!mainCanvas || !cropCanvas) return;

      const mainCanvasRect = mainCanvas.getBoundingClientRect();
      const parentRect = mainCanvas.parentElement.getBoundingClientRect();

      // 精确设置裁剪画布的尺寸和位置，使其与主画布完全重合，防止视觉跳动
      cropCanvas.style.width = `${mainCanvasRect.width}px`;
      cropCanvas.style.height = `${mainCanvasRect.height}px`;
      cropCanvas.style.top = `${mainCanvasRect.top - parentRect.top}px`;
      cropCanvas.style.left = `${mainCanvasRect.left - parentRect.left}px`;
      
      // 设置裁剪画布的分辨率并绘制当前图像
      const currentImageData = historyManager.getCurrentState();
      if (currentImageData) {
        cropCanvas.width = currentImageData.width;
        cropCanvas.height = currentImageData.height;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.putImageData(currentImageData, 0, 0);
      }
      setCropArea(null); // 重置裁剪区域
    }
  };

  const handleCropConfirm = () => {
    if (!cropArea || cropArea.width < 10 || cropArea.height < 10) {
      alert('请选择一个有效的裁剪区域');
      return;
    }
    
    // 确保裁剪区域不超出画布边界
    const currentImageData = historyManager.getCurrentState();
    if (!currentImageData) return;

    const safeArea = {
      x: Math.round(Math.max(0, Math.min(cropArea.x, currentImageData.width))),
      y: Math.round(Math.max(0, Math.min(cropArea.y, currentImageData.height))),
      width: Math.round(Math.min(cropArea.width, currentImageData.width - Math.max(0, cropArea.x))),
      height: Math.round(Math.min(cropArea.height, currentImageData.height - Math.max(0, cropArea.y)))
    };
    
    // 将裁剪任务发送给 Worker
    processEdit('crop', safeArea);
    
    // 退出裁剪模式
    setIsCropMode(false);
    setCropArea(null);
  };

  const handleCropCancel = () => {
    setIsCropMode(false);
    setCropArea(null);
  };

  const getCanvasCoordinates = (e) => {
    const canvas = cropCanvasRef.current; // 使用裁剪画布
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
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
  
  // 绘制裁剪选区覆盖层
  useEffect(() => {
    const cropCanvas = cropCanvasRef.current;
    if (!cropCanvas || !isCropMode) return;
    
    const cropCtx = cropCanvas.getContext('2d');
    const currentImageData = historyManager.getCurrentState();
    
    if (!currentImageData) return;

    // 清除并重绘原始图像到裁剪画布
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCanvas.width = currentImageData.width;
    cropCanvas.height = currentImageData.height;
    cropCtx.putImageData(currentImageData, 0, 0);

    if (!cropArea) return; // 如果没有裁剪区域，就只显示图像

    // 绘制半透明遮罩
    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // 清除裁剪区域的遮罩
    if (cropArea.width > 0 && cropArea.height > 0) {
      cropCtx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }
    
    // 绘制裁剪边框
    cropCtx.strokeStyle = '#00ff00';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
  }, [cropArea, isCropMode, historyManager]);
  
  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      {/* 头部 */}
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
        {/* 左侧工具栏 */}
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

        {/* 主内容 */}
        <main className="flex-1 flex flex-col">
          {/* 主内容顶部栏 */}
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
                {loading ? "处理中..." : (workerReady ? "Worker 已就绪" : (opencvLoaded ? "正在初始化Canvas..." : "正在加载 OpenCV..."))}
            </div>
          </div>

          {/* 画布区域 */}
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-200 dark:bg-gray-800/30 overflow-auto relative">
            <canvas 
              id="canvas" 
              ref={canvasRef} 
              className={`max-w-full max-h-full bg-white dark:bg-gray-700 shadow-lg rounded-md ${!image ? 'hidden' : ''}`}
            ></canvas>
            <canvas
              id="crop-canvas"
              ref={cropCanvasRef}
              className={`absolute ${!isCropMode ? 'hidden' : 'cursor-crosshair'}`}
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
          
          {/* 底部 */}
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