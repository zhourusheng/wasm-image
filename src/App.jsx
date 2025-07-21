import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Crop, Download, Folder, SlidersHorizontal, Trash2, Undo, Redo, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, ImagePlay, Check, X, Sun, Contrast, Droplets, Palette, Copy, Wand2
} from 'lucide-react';
import { loadImageFromFile, getImageDataFromImage, exportImage, copyImageToClipboard } from './utils/imageUtils';
import HistoryManager from './utils/historyManager';
import { logPerformanceToConsole } from './utils/performanceLogger';

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
  const originalImageRef = useRef(null);

  // worker 实例
  const imageWorker = useRef(null);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const [workerReady, setWorkerReady] = useState(false); // 跟踪 worker 是否准备好接收任务
  const [loading, setLoading] = useState(false);
  
  // 新增：右侧参数面板相关状态
  const [activeTool, setActiveTool] = useState(null);
  const [toolParams, setToolParams] = useState({});
  const [stagedImage, setStagedImage] = useState(null); // 用于暂存进入工具调整前的图像状态

  // 控制画布渲染后显示，避免白框闪烁
  const [isCanvasRendered, setIsCanvasRendered] = useState(false);
  const loaderTimeoutRef = useRef(null); // 用于延迟显示加载动画

  // 新增：视图缩放状态
  const [zoom, setZoom] = useState(1); // 1 = 100%

  // 一个简单的触发重新渲染的方法
  const [, setTick] = useState(0);
  const forceUpdate = () => setTick(tick => tick + 1);

  // 通用图像编辑处理函数
  const processEdit = useCallback((op, params = {}, isPreview = false) => {
    if (!canvasRef.current || !workerReady) {
        alert("Worker 尚未准备好。");
        return;
    }
    
    clearTimeout(loaderTimeoutRef.current);
    if (!isPreview) {
      setLoading(true);
    } else {
      // 仅当操作耗时较长时才显示加载动画，以避免预览时闪烁
      loaderTimeoutRef.current = setTimeout(() => {
        setLoading(true);
      }, 200);
    }

    // 预览时基于暂存的图像，否则基于历史记录的当前状态
    const baseImage = isPreview && stagedImage ? stagedImage : historyManager.getCurrentState();
    if (!baseImage) {
        alert("没有可用的图像数据。");
        clearTimeout(loaderTimeoutRef.current);
        setLoading(false);
        return;
    }

    console.log(`开始处理图像操作: ${op}`, params);
    
    // isHistoryNavigation 标志告诉 worker 这是否是一个不应保存到历史记录的预览操作
    imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: baseImage, action: op, params, isHistoryNavigation: isPreview } });
    
  }, [workerReady, historyManager, stagedImage]);
  
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
                if (payload.perfLog) {
                    logPerformanceToConsole(payload.perfLog);
                }
                clearTimeout(loaderTimeoutRef.current);
                if (payload.imageData) {
                    setImageSize({ width: payload.imageData.width, height: payload.imageData.height });
                    // 仅当不是历史导航/预览时才添加到历史记录
                    if (!payload.isHistoryNavigation) {
                        historyManager.add(payload.imageData);
                    }
                    setIsCanvasRendered(true); // 渲染完成后，标记画布为可显示
                    forceUpdate(); // 更新撤销/重做按钮状态
                }
                setLoading(false);
                break;
            case 'error':
                console.error("来自 worker 的错误:", payload);
                clearTimeout(loaderTimeoutRef.current);
                alert("图像处理期间发生错误： " + payload);
                setLoading(false);
                break;
        }
    };
    
    return () => {
      clearTimeout(loaderTimeoutRef.current);
      worker.terminate()
    };
  }, []); // 空依赖数组确保此 effect 仅在挂载时运行一次

  // 用于处理新图像加载的 effect
  useEffect(() => {
    if (image && workerReady) {
      setLoading(true);
      setIsCanvasRendered(false); // 加载新图片时，先隐藏画布
      const imageData = getImageDataFromImage(image);
      historyManager.clear();
      forceUpdate();
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData, action: 'original' } });
    }
  }, [image, workerReady]);

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
  
  const handleCopyClick = async () => {
    if (!image) {
      alert('请先上传一张图片');
      return;
    }
    try {
      await copyImageToClipboard(canvasRef.current);
      alert('已复制到剪贴板！');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUndo = () => {
    if (!historyManager.canUndo()) return;
    const prevState = historyManager.undo();
    if (prevState && workerReady) {
      setLoading(true);
      // 将历史状态发送给 worker 进行重绘，并标记为历史导航
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: prevState, action: 'original', isHistoryNavigation: true } });
      forceUpdate();
    }
  };
  
  const handleRedo = () => {
    if (!historyManager.canRedo()) return;
    const nextState = historyManager.redo();
    if (nextState && workerReady) {
      setLoading(true);
      // 将历史状态发送给 worker 进行重绘，并标记为历史导航
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: nextState, action: 'original', isHistoryNavigation: true } });
      forceUpdate();
    }
  };

  // --- 工具栏按钮现在用于激活工具 ---
  const handleToolActivate = (toolName, defaultParams = {}) => {
    if (!image) {
        alert('请先上传一张图片');
        return;
    }

    // 如果再次点击同一个工具图标，则取消操作
    if (activeTool === toolName) {
      handleCancelTool();
      return;
    }

    setActiveTool(toolName);
    setToolParams(defaultParams);
    setStagedImage(historyManager.getCurrentState());
    // 立即应用一次默认效果作为预览
    if (Object.keys(defaultParams).length > 0) {
      processEdit(toolName, defaultParams, true);
    }
  };
  
  const handleParamsChange = (newParams) => {
    const updatedParams = { ...toolParams, ...newParams };
    setToolParams(updatedParams);
    processEdit(activeTool, updatedParams, true);
  };

  const handleApplyTool = () => {
    processEdit(activeTool, toolParams, false); // isPreview is false to add to history
    setActiveTool(null);
    setStagedImage(null);
  };
  
  const handleCancelTool = () => {
    clearTimeout(loaderTimeoutRef.current);
    setLoading(false);
    // 恢复到未应用工具前的状态
    if (stagedImage) {
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: stagedImage, action: 'original', isHistoryNavigation: true } });
    }
    setActiveTool(null);
    setStagedImage(null);
  };

  // --- 视图缩放功能 ---
  const handleZoom = (newZoom) => {
    const clampedZoom = Math.max(0.1, Math.min(newZoom, 5)); // 限制缩放在 10% 到 500% 之间
    setZoom(clampedZoom);
  };
  
  // --- 原始编辑功能 ---
  const handleRotateCw = () => processEdit('rotate', { angle: 90 });
  const handleRotateCcw = () => processEdit('rotate', { angle: -90 });
  const handleFlipH = () => processEdit('flip', { mode: 0 });
  const handleFlipV = () => processEdit('flip', { mode: 1 });
  
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

      // 关键修复：获取主画布（可能被缩放）的视觉尺寸和位置
      const mainCanvasRect = mainCanvas.getBoundingClientRect();
      // 获取裁剪画布的父容器（即画布区域的根div）的位置
      const parentRect = cropCanvas.parentElement.getBoundingClientRect();

      // 将裁剪画布的CSS样式设置为与主画布的视觉大小和位置完全一致
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
  
  // 右侧参数面板组件
  const ParamsPanel = () => {
    if (!activeTool) return null;

    const getParamUI = () => {
      switch(activeTool) {
        case 'blur':
          return (
            <div className="space-y-2">
              <label htmlFor="ksize" className="text-sm">模糊半径</label>
              <input id="ksize" type="range" min="1" max="21" step="2" value={toolParams.ksize || 5}
                onChange={(e) => handleParamsChange({ ksize: parseInt(e.target.value, 10) })}/>
              <div className="text-center text-sm">{toolParams.ksize || 5}</div>
            </div>
          );
        case 'brightness':
          return (
            <div className="space-y-2">
              <label htmlFor="delta" className="text-sm">亮度</label>
              <input id="delta" type="range" min="-100" max="100" step="1" value={toolParams.delta || 0}
                onChange={(e) => handleParamsChange({ delta: parseInt(e.target.value, 10) })}/>
              <div className="text-center text-sm">{toolParams.delta || 0}</div>
            </div>
          );
        case 'contrast':
          return (
            <div className="space-y-2">
              <label htmlFor="factor" className="text-sm">对比度</label>
              <input id="factor" type="range" min="0.1" max="3" step="0.1" value={toolParams.factor || 1}
                onChange={(e) => handleParamsChange({ factor: parseFloat(e.target.value) })}/>
              <div className="text-center text-sm">{toolParams.factor || 1}</div>
            </div>
          );
        case 'saturation':
          return (
            <div className="space-y-2">
              <label htmlFor="factor" className="text-sm">饱和度</label>
              <input id="factor" type="range" min="0" max="3" step="0.1" value={toolParams.factor || 1}
                onChange={(e) => handleParamsChange({ factor: parseFloat(e.target.value) })}/>
              <div className="text-center text-sm">{toolParams.factor || 1}</div>
            </div>
          );
        case 'colorBalance':
          return (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="red" className="text-sm text-red-500">红色</label>
                <input id="red" type="range" min="-100" max="100" step="1" value={toolParams.red || 0}
                  onChange={(e) => handleParamsChange({ ...toolParams, red: parseInt(e.target.value, 10) })}/>
                <div className="text-center text-sm">{toolParams.red || 0}</div>
              </div>
              <div className="space-y-2">
                <label htmlFor="green" className="text-sm text-green-500">绿色</label>
                <input id="green" type="range" min="-100" max="100" step="1" value={toolParams.green || 0}
                  onChange={(e) => handleParamsChange({ ...toolParams, green: parseInt(e.target.value, 10) })}/>
                <div className="text-center text-sm">{toolParams.green || 0}</div>
              </div>
              <div className="space-y-2">
                <label htmlFor="blue" className="text-sm text-blue-500">蓝色</label>
                <input id="blue" type="range" min="-100" max="100" step="1" value={toolParams.blue || 0}
                  onChange={(e) => handleParamsChange({ ...toolParams, blue: parseInt(e.target.value, 10) })}/>
                <div className="text-center text-sm">{toolParams.blue || 0}</div>
              </div>
            </div>
          );
        default:
          return <p className="text-sm text-gray-500">该功能无参数可调。</p>;
      }
    };

    return (
      <aside className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
        <h3 className="text-lg font-semibold mb-4 capitalize">{activeTool}</h3>
        
        {getParamUI()}

        <div className="mt-auto pt-4 space-x-2 flex justify-end">
          <button onClick={handleCancelTool} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
          <button onClick={handleApplyTool} className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600">应用</button>
        </div>
      </aside>
    );
  };
  
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
          <button className="icon-btn" onClick={handleCopyClick} title="复制图像">
            <Copy size={20} />
          </button>
          <button className="icon-btn" onClick={handleDownloadClick} title="下载图像">
            <Download size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工具栏 */}
        <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-4 text-xs">
          {/* 调整 */}
          <div className="flex flex-col items-center space-y-1 w-full">
            <span className="font-medium text-gray-500">调整</span>
            <button className={`icon-btn-group ${activeTool === 'brightness' ? 'active' : ''}`} onClick={() => handleToolActivate('brightness', { delta: 0 })} disabled={!image || loading} title="亮度"><Sun size={20} /></button>
            <button className={`icon-btn-group ${activeTool === 'contrast' ? 'active' : ''}`} onClick={() => handleToolActivate('contrast', { factor: 1 })} disabled={!image || loading} title="对比度"><Contrast size={20} /></button>
            <button className={`icon-btn-group ${activeTool === 'saturation' ? 'active' : ''}`} onClick={() => handleToolActivate('saturation', { factor: 1 })} disabled={!image || loading} title="饱和度"><Droplets size={20} /></button>
             <button className={`icon-btn-group ${activeTool === 'colorBalance' ? 'active' : ''}`} onClick={() => handleToolActivate('colorBalance', { red: 0, green: 0, blue: 0 })} disabled={!image || loading} title="色彩平衡"><Palette size={20} /></button>
          </div>
          
          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

          {/* 效果 */}
          <div className="flex flex-col items-center space-y-1 w-full">
            <span className="font-medium text-gray-500">效果</span>
            <button className="icon-btn-group" onClick={() => processEdit('grayscale')} disabled={!image || loading} title="灰度"><SlidersHorizontal size={20} /></button>
            <button className={`icon-btn-group ${activeTool === 'blur' ? 'active' : ''}`} onClick={() => handleToolActivate('blur', { ksize: 5 })} disabled={!image || loading} title="模糊">B</button>
            <button className="icon-btn-group" onClick={() => processEdit('canny')} disabled={!image || loading} title="边缘检测">C</button>
            <button className="icon-btn-group" onClick={() => processEdit('threshold')} disabled={!image || loading} title="阈值">T</button>
            <button className="icon-btn-group" onClick={() => processEdit('emboss')} disabled={!image || loading} title="浮雕"><Wand2 size={20} /></button>
            <button className="icon-btn-group" onClick={() => processEdit('sepia')} disabled={!image || loading} title="复古">S</button>
          </div>

          <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

          {/* 变换 */}
          <div className="flex flex-col items-center space-y-1 w-full">
            <span className="font-medium text-gray-500">变换</span>
            <button className="icon-btn-group" onClick={handleCropModeToggle} disabled={!image || loading} title="裁剪"><Crop size={20} /></button>
            <button className="icon-btn-group" onClick={handleRotateCw} disabled={!image || loading} title="顺时针旋转"><RotateCw size={20} /></button>
            <button className="icon-btn-group" onClick={handleRotateCcw} disabled={!image || loading} title="逆时针旋转"><RotateCcw size={20} /></button>
            <button className="icon-btn-group" onClick={handleFlipH} disabled={!image || loading} title="水平翻转"><FlipHorizontal size={20} /></button>
            <button className="icon-btn-group" onClick={handleFlipV} disabled={!image || loading} title="垂直翻转"><FlipVertical size={20} /></button>
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
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm z-20">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
            <div style={{ transform: `scale(${zoom})` }}>
              <canvas 
                id="canvas" 
                ref={canvasRef} 
                className={`max-w-full max-h-full shadow-lg rounded-md ${!isCanvasRendered ? 'invisible' : ''}`}
              ></canvas>
            </div>
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
          <footer className="h-10 flex items-center justify-between px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm">
            <div>
              <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : '无图像'}</span>
            </div>
            {image && (
              <div className="flex items-center space-x-2">
                <button className="icon-btn" onClick={() => handleZoom(zoom - 0.1)}><ZoomOut size={18} /></button>
                <span className="w-12 text-center" onDoubleClick={() => handleZoom(1)} title="双击重置">{Math.round(zoom * 100)}%</span>
                <button className="icon-btn" onClick={() => handleZoom(zoom + 0.1)}><ZoomIn size={18} /></button>
              </div>
            )}
          </footer>
        </main>

        {/* 右侧参数面板 */}
        <ParamsPanel />
      </div>
    </div>
  );
}

export default App; 