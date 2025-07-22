import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Crop, Download, Folder, SlidersHorizontal, Trash2, Undo, Redo, ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, ImagePlay, Check, X, Sun, Contrast, Droplets, Palette, Copy, Wand2, Eye, FileOutput, GripVertical
} from 'lucide-react';
import { loadImageFromFile, getImageDataFromImage, exportImage, copyImageToClipboard } from './utils/imageUtils';
import HistoryManager from './utils/historyManager';
import { logPerformanceToConsole } from './utils/performanceLogger';
import { compressCanvasImage, formatFileSize } from './utils/filters';
import {
  createHorizontalCollage,
  createVerticalCollage,
  createGridCollage,
  loadImagesFromFiles
} from './utils/imageCollageUtils';

/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 */
class PerformanceTimer {
  constructor(operationName, metadata = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.step('start');
  }

  step(stepName) {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

  end() {
    this.step('end');
    const totalTime = this.lastStepTime - this.startTime;
    return {
      operation: this.operationName,
      metadata: this.metadata,
      totalTime: parseFloat(totalTime.toFixed(2)),
      steps: this.steps,
      timestamp: new Date().toISOString(),
    };
  }
}

function App() {
  const [image, setImage] = useState(null);
  const [originalFileInfo, setOriginalFileInfo] = useState({ size: 0, name: '' });
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
  const canvasContainerRef = useRef(null);
  
  // 新增：右侧参数面板相关状态
  const [activeTool, setActiveTool] = useState(null);
  const [toolParams, setToolParams] = useState({});
  const [stagedImage, setStagedImage] = useState(null); // 用于暂存进入工具调整前的图像状态

  // 新增：导出面板相关状态
  const [isExportPanelOpen, setIsExportPanelOpen] = useState(false);
  const [isGeneratingExport, setIsGeneratingExport] = useState(false);
  const [exportParams, setExportParams] = useState({
    quality: 0.8,
    scale: 1.0,
    format: 'image/jpeg',
    previewSize: null,
    originalSize: null,
    originalSizeBytes: null,
    compressedBlob: null,
    previewUrl: null,
  });

  // 控制画布渲染后显示，避免白框闪烁
  const [isCanvasRendered, setIsCanvasRendered] = useState(false);
  const loaderTimeoutRef = useRef(null); // 用于延迟显示加载动画

  // 视图缩放与显示模式状态
  const [zoom, setZoom] = useState(1); // 当前画布的缩放比例
  const [fitZoom, setFitZoom] = useState(1); // 由程序计算的"最佳适应"缩放比例
  const [userHasZoomed, setUserHasZoomed] = useState(false); // 新增：跟踪用户是否手动缩放过

  // 新增：拼接模式相关状态
  const [isCollageMode, setIsCollageMode] = useState(false);

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
            case 'compress-preview-ready':
                // 处理压缩预览的结果
                console.log('Worker 完成压缩预览');
                if (payload.perfLog) {
                    logPerformanceToConsole(payload.perfLog);
                }
                
                // 创建 Blob 对象和预览 URL
                const blob = new Blob([payload.compressedBuffer], { type: payload.format });
                const url = URL.createObjectURL(blob);
                
                // 获取原始大小信息用于显示
                const originalSizeBytes = toolParams.originalSizeBytes || 0;
                
                // 导入格式化函数并更新工具参数
                import('./utils/filters').then(({ formatFileSize }) => {
                    // 更新工具参数
                    setToolParams(prev => ({
                        ...prev,
                        previewSize: formatFileSize(payload.size),
                        previewUrl: url,
                        compressedBlob: blob,
                        compressedSize: payload.size
                    }));
                });
                
                // 显示结果
                if (payload.imageData) {
                    setImageSize({ width: payload.imageData.width, height: payload.imageData.height });
                    setIsCanvasRendered(true);
                }
                
                clearTimeout(loaderTimeoutRef.current);
                setLoading(false);
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
      originalImageRef.current = imageData; // 存储原始图像数据
      historyManager.clear();
      forceUpdate();
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData, action: 'original' } });
      
      // 重置用户缩放标记，这样新图片会使用自适应缩放
      setUserHasZoomed(false);
    }
  }, [image, workerReady]);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 关键修复：在这里捕获真实的文件信息
    setOriginalFileInfo({ size: file.size, name: file.name });
    
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
  
  const handleRevertToOriginal = () => {
    if (!originalImageRef.current || loading) return;

    if (confirm('您确定要撤销所有操作，恢复到原始图像吗？')) {
      setLoading(true);
      setActiveTool(null); // 关闭右侧参数面板
      setStagedImage(null); // 清除预览状态
      // 清空历史记录
      historyManager.clear();
      // 直接将原始图像数据发给 worker 处理，这会自动成为新的历史记录起点
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: originalImageRef.current, action: 'original' } });
      forceUpdate(); // 立即更新UI状态
    }
  };

  const handleEnterCollageMode = () => {
    // 如果当前有图片，询问用户是否要将其用作拼接的第一张图
    if (image) {
      if (confirm('您想将当前编辑的图片添加到拼接中吗？')) {
        const currentImageData = historyManager.getCurrentState();
        // 我们将在进入模式后处理它
        setIsCollageMode(true);
        // 通过 useEffect 触发，传递当前图像
        setTimeout(() => {
          const collageInputElement = document.getElementById('collage-file-input');
          if (collageInputElement) {
            // 这部分有点hacky，理想情况下我们会有更好的状态管理
            // 但为了简单起见，我们暂时这样做
            window.initialCollageImage = currentImageData;
          }
        }, 0);
        return;
      }
    }
    setIsCollageMode(true);
  };

  const handleExitCollageMode = (newImageData) => {
    setIsCollageMode(false);
    if (newImageData) {
      // 将拼接结果设置为新图片
      const newImage = new Image();
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = newImageData.width;
      tempCanvas.height = newImageData.height;
      tempCanvas.getContext('2d').putImageData(newImageData, 0, 0);
      
      newImage.onload = () => {
        setOriginalFileInfo({ size: 0, name: 'collage.png' });
        setImage(newImage);
      };
      newImage.src = tempCanvas.toDataURL();
    }
  };


  const handleCompareStart = () => {
    if (!originalImageRef.current || loading) return;
    // 发送原始图像用于预览，标记为历史导航以避免存入历史记录
    imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: originalImageRef.current, action: 'original', isHistoryNavigation: true } });
  };

  const handleCompareEnd = () => {
    if (!historyManager.getCurrentState() || loading) return;
    // 发送当前最新的编辑状态用于预览，恢复视图
    imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: historyManager.getCurrentState(), action: 'original', isHistoryNavigation: true } });
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
  const handleToolActivate = async (toolName, defaultParams = {}) => {
    if (!image) {
        alert('请先上传一张图片');
        return;
    }

    // 如果再次点击同一个工具图标，则取消操作
    if (activeTool === toolName) {
      handleCancelTool();
      return;
    }

    // 保存当前状态
    const currentState = historyManager.getCurrentState();
    setStagedImage(currentState);

    // 设置初始参数
    let initialParams = { ...defaultParams };
    
    // 如果是压缩工具，需要特殊处理
    if (toolName === 'compress') {
      initialParams = {
        quality: 0.8,
        scale: 1.0,
        format: 'image/jpeg',
        ...defaultParams
      };
      
      // 获取原始图像大小信息
      try {
        const { getOriginalImageSize, formatFileSize } = await import('./utils/filters');
        
        // 优先使用当前状态来计算大小
        const sourceForSize = currentState || originalImageRef.current;
        if (sourceForSize) {
          const origSize = await getOriginalImageSize(sourceForSize);
          if (origSize) {

            initialParams.originalSize = formatFileSize(origSize);
            initialParams.originalSizeBytes = origSize;
          }
        }
      } catch (error) {
        console.error('获取原始图像大小失败:', error);
      }
      
      setActiveTool(toolName);
      setToolParams(initialParams);
      
      // 对压缩工具使用特殊预览处理
      if (currentState) {
        handleCompressPreview(currentState, initialParams);
      }
      return;
    }

    // 其他常规工具处理
    setActiveTool(toolName);
    setToolParams(initialParams);
    
    // 立即应用一次默认效果作为预览
    if (currentState && Object.keys(initialParams).length > 0) {
      processEdit(toolName, initialParams, true);
    }
  };
  
  const handleParamsChange = (newParams) => {
    const updatedParams = { ...toolParams, ...newParams };
    setToolParams(updatedParams);
    
    if (activeTool === 'compress') {
      handleCompressPreview(stagedImage, updatedParams);
    } else {
      processEdit(activeTool, updatedParams, true);
    }
  };

  // 处理图片压缩预览
  const handleCompressPreview = async (imageData, params) => {
    if (!imageData || !canvasRef.current) return;
    
    const { quality = 0.8, scale = 1.0, format = 'image/jpeg' } = params;
    
    // 1. 先应用缩放处理（如果需要）
    // 注意：不能直接操作已转移到 OffscreenCanvas 的 canvas
    // 需要通过 Worker 进行处理
    processEdit('compress', { scale, quality, format, isCompressPreview: true }, true);
    
    // 2. 获取原始图像大小（如果未设置）并更新参数
    try {
      let originalSize = params.originalSize;
      let originalSizeBytes = params.originalSizeBytes;
      
      // 如果尚未设置原始大小
      if (!originalSize) {
        const { getOriginalImageSize, formatFileSize } = await import('./utils/filters');
        
        // 优先使用 imageData 来计算大小
        const sourceForSize = imageData;
        if (sourceForSize) {
          const origSize = await getOriginalImageSize(sourceForSize);
          if (origSize) {

            originalSize = formatFileSize(origSize);
            originalSizeBytes = origSize;
            
            // 更新工具参数以包含原始大小信息
            setToolParams(prev => ({
              ...prev,
              originalSize,
              originalSizeBytes
            }));
          }
        }
      }
    } catch (error) {
      console.error('获取原始图像大小失败:', error);
    }
  };

  // --- 导出功能重构 ---
  const handleOpenExportPanel = async () => {
    if (!image) {
      alert('请先上传一张图片');
      return;
    }

    // 关闭任何可能已打开的工具面板
    if (activeTool) {
      handleCancelTool();
    }
    
    setIsExportPanelOpen(true);

    // 使用我们保存的真实文件信息
    const origSize = originalFileInfo.size;
    
    // 关键修复：先构建一个完整的初始参数对象，避免使用陈旧的状态
    const initialExportParams = {
      quality: 0.8,
      scale: 1.0,
      format: 'image/jpeg',
      previewSize: null,
      originalSizeBytes: origSize,
      originalSize: origSize ? formatFileSize(origSize) : '未知',
      compressedBlob: null,
      previewUrl: null,
    };
    
    // 使用这个完整、全新的对象来触发第一次预览生成
    await handleExportParamsChange(initialExportParams);
  };

  const handleCloseExportPanel = () => {
    // 清理可能已创建的Blob URL
    if (exportParams.previewUrl) {
      URL.revokeObjectURL(exportParams.previewUrl);
    }
    setIsExportPanelOpen(false);
    // 重置为默认值
    setExportParams({
      quality: 0.8,
      scale: 1.0,
      format: 'image/jpeg',
      previewSize: null,
      originalSize: null,
      originalSizeBytes: null,
      compressedBlob: null,
      previewUrl: null,
    });
  };

  const handleExportParamsChange = async (newParams) => {
    const updatedParams = { ...exportParams, ...newParams };
    setExportParams(updatedParams);
    setIsGeneratingExport(true);

    const currentImageData = historyManager.getCurrentState();
    if (!currentImageData) {
      setIsGeneratingExport(false);
      return;
    }

    const timer = new PerformanceTimer('export_preview', {
      scale: updatedParams.scale,
      format: updatedParams.format,
      quality: updatedParams.quality,
    });

    // 为了预览，我们需要一个临时的canvas来绘制缩放后的图像
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // 计算缩放后的尺寸
    const newWidth = Math.round(currentImageData.width * updatedParams.scale);
    const newHeight = Math.round(currentImageData.height * updatedParams.scale);
    tempCanvas.width = newWidth;
    tempCanvas.height = newHeight;
    
    // 将当前图像数据绘制到临时画布上，并进行缩放
    const tempImage = await createImageBitmap(currentImageData);
    timer.step('create_image_bitmap');
    
    tempCtx.drawImage(tempImage, 0, 0, newWidth, newHeight);
    timer.step('draw_image_scaled');

    try {
      const { blob, size, url } = await compressCanvasImage(tempCanvas, updatedParams.quality, updatedParams.format);
      timer.step('compress_to_blob');
      
      // 清理上一个预览的URL
      if (exportParams.previewUrl) {
        URL.revokeObjectURL(exportParams.previewUrl);
      }
      
      setExportParams(prev => ({
        ...prev,
        ...updatedParams,
        previewSize: formatFileSize(size),
        compressedBlob: blob,
        previewUrl: url,
      }));
    } catch(err) {
      console.error("无法生成导出预览:", err);
    } finally {
      setIsGeneratingExport(false);
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
    }
  };
  
  const handleConfirmExport = () => {
    if (!exportParams.compressedBlob || !exportParams.previewUrl) {
      alert("导出文件尚未准备好，请稍等。");
      return;
    }
    
    const extension = exportParams.format.split('/')[1] || 'jpg';
    const originalName = originalFileInfo.name.split('.').slice(0, -1).join('.');
    const filename = `${originalName}-edited.${extension}`;

    const link = document.createElement('a');
    link.href = exportParams.previewUrl;
    link.download = filename;
    link.click();
    
    // 下载后关闭面板
    handleCloseExportPanel();
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
      // 如果是压缩工具，需要清理预览URL
      if (activeTool === 'compress' && toolParams.previewUrl) {
        URL.revokeObjectURL(toolParams.previewUrl);
      }
      
      imageWorker.current.postMessage({ type: 'image-process', payload: { imageData: stagedImage, action: 'original', isHistoryNavigation: true } });
    }
    setActiveTool(null);
    setStagedImage(null);
  };

  // --- 视图缩放功能 ---
  const handleManualZoom = (newZoom) => {
    const clampedZoom = Math.max(0.01, Math.min(newZoom, 10)); // 缩放范围限制
    setZoom(clampedZoom);
    setUserHasZoomed(true); // 标记用户已手动缩放
  };
  
  // 关键修复：分离 "初始适应" 和 "响应式适应" 的逻辑
  useEffect(() => {
    // 仅在图片尺寸变化时（即新图片加载时）执行
    if (!imageSize.width || !canvasContainerRef.current) return;

    const container = canvasContainerRef.current;
    const containerWidth = container.clientWidth - 32;
    const containerHeight = container.clientHeight - 32;
    const scaleX = containerWidth / imageSize.width;
    const scaleY = containerHeight / imageSize.height;
    const newFitZoom = Math.min(scaleX, scaleY);

    setFitZoom(newFitZoom);
    
    // 修复：仅在首次加载图片且用户未手动缩放时应用自适应缩放
    if (!userHasZoomed) {
      setZoom(newFitZoom); // 设置初始的适应缩放
    }
  }, [imageSize, userHasZoomed]);

  useEffect(() => {
    // 仅在窗口大小变化时更新 fitZoom，不影响当前的 zoom
    if (!canvasContainerRef.current) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && imageSize.width > 0) {
        const { width, height } = entry.contentRect;
        const containerWidth = width - 32;
        const containerHeight = height - 32;
        const scaleX = containerWidth / imageSize.width;
        const scaleY = containerHeight / imageSize.height;
        const newFitZoom = Math.min(scaleX, scaleY);
        setFitZoom(newFitZoom);
        // 移除这里可能存在的 setZoom 调用，确保不覆盖用户的手动缩放
      }
    });

    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [imageSize]); // 依赖 imageSize 以便在图片变化时重新观察

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
      
      // 修复：显示裁剪画布
      cropCanvas.style.display = 'block';
      
      // 设置裁剪画布的分辨率并绘制当前图像
      const currentImageData = historyManager.getCurrentState();
      if (currentImageData) {
        cropCanvas.width = currentImageData.width;
        cropCanvas.height = currentImageData.height;
        const cropCtx = cropCanvas.getContext('2d');
        cropCtx.putImageData(currentImageData, 0, 0);
      }
      setCropArea(null); // 重置裁剪区域
    } else {
      // 修复：退出裁剪模式时隐藏裁剪画布
      if (cropCanvasRef.current) {
        cropCanvasRef.current.style.display = 'none';
      }
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
    
    // 修复：确认裁剪后隐藏裁剪画布
    if (cropCanvasRef.current) {
      cropCanvasRef.current.style.display = 'none';
    }
  };

  const handleCropCancel = () => {
    setIsCropMode(false);
    setCropArea(null);
    // 修复：取消裁剪时隐藏裁剪画布
    if (cropCanvasRef.current) {
      cropCanvasRef.current.style.display = 'none';
    }
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
        case 'compress':
          return (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="quality" className="text-sm">压缩质量</label>
                <input id="quality" type="range" min="0.1" max="1" step="0.1" value={toolParams.quality || 0.8}
                  onChange={(e) => handleParamsChange({ ...toolParams, quality: parseFloat(e.target.value) })}/>
                <div className="text-center text-sm">{Math.round((toolParams.quality || 0.8) * 100)}%</div>
              </div>
              <div className="space-y-2">
                <label htmlFor="scale" className="text-sm">调整大小</label>
                <input id="scale" type="range" min="0.1" max="1" step="0.1" value={toolParams.scale || 1}
                  onChange={(e) => handleParamsChange({ ...toolParams, scale: parseFloat(e.target.value) })}/>
                <div className="text-center text-sm">{Math.round((toolParams.scale || 1) * 100)}%</div>
              </div>
              <div className="space-y-2">
                <label className="text-sm">图片格式</label>
                <div className="flex gap-2">
                  <button 
                    className={`px-2 py-1 rounded ${toolParams.format === 'image/jpeg' || !toolParams.format ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
                    onClick={() => handleParamsChange({ ...toolParams, format: 'image/jpeg' })}
                  >
                    JPEG
                  </button>
                  <button 
                    className={`px-2 py-1 rounded ${toolParams.format === 'image/png' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
                    onClick={() => handleParamsChange({ ...toolParams, format: 'image/png' })}
                  >
                    PNG
                  </button>
                  <button 
                    className={`px-2 py-1 rounded ${toolParams.format === 'image/webp' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
                    onClick={() => handleParamsChange({ ...toolParams, format: 'image/webp' })}
                  >
                    WebP
                  </button>
                </div>
              </div>
              {toolParams.previewSize && (
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
                  <div className="text-sm font-medium">预估大小</div>
                  <div className="mt-2">
                    <div className="text-sm mb-2">原始: {toolParams.originalSize || '未知'}</div>
                    <div className="text-sm">压缩后: {toolParams.previewSize || '未知'}</div>
                  </div>
                </div>
              )}
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
          <button className="icon-btn" onClick={handleEnterCollageMode} disabled={loading} title="图片拼接">
            <GripVertical size={20} />
          </button>
          <button className="icon-btn" onClick={handleOpenExportPanel} title="导出图像">
            <FileOutput size={20} />
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧工具栏 */}
        <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-4 text-xs overflow-y-auto">
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

        {isCollageMode ? (
          <CollageModePanel onExit={handleExitCollageMode} />
        ) : (
          <>
            {/* 主内容区和底部栏的包装器 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* 主内容 - 关键修复：添加 min-h-0 允许内容区收缩 */}
              <main className="flex-1 flex flex-col min-h-0">
                {/* 主内容顶部栏 */}
                <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <button className="icon-btn" onClick={handleUndo} disabled={!historyManager.canUndo() || loading} title="撤销">
                      <Undo size={20} />
                    </button>
                    <button className="icon-btn" onClick={handleRedo} disabled={!historyManager.canRedo() || loading} title="重做">
                      <Redo size={20} />
                    </button>
                    <button className="icon-btn" onClick={handleRevertToOriginal} disabled={!image || loading} title="重置所有操作">
                      <Trash2 size={20} />
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
                <div ref={canvasContainerRef} className="flex-1 grid place-items-center p-4 bg-gray-200 dark:bg-gray-800/30 overflow-auto relative">
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200/50 dark:bg-gray-800/50 backdrop-blur-sm z-20">
                      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  <canvas 
                    id="canvas" 
                    ref={canvasRef} 
                    className={`shadow-lg rounded-md ${!isCanvasRendered ? 'invisible' : ''}`}
                    style={{
                      width: `${imageSize.width * zoom}px`,
                      height: `${imageSize.height * zoom}px`,
                    }}
                  ></canvas>
                  <canvas
                    id="crop-canvas"
                    ref={cropCanvasRef}
                    className="absolute"
                    style={{ display: 'none' }}
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
              </main>
              
              {/* 底部状态/工具栏 - 关键修复：添加 flex-shrink-0 防止被挤压 */}
              <footer className="h-10 flex-shrink-0 flex items-center justify-center px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm z-10 relative">
                <div className="text-center">
                  <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : '无图像'}</span>
                </div>
                {image && (
                  <div className="absolute right-4 flex items-center space-x-2">
                    <button 
                      className={`icon-btn`}
                      title="适应屏幕"
                      onClick={() => setZoom(fitZoom)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M3 3h6v6M21 21h-6v-6"/></svg>
                    </button>
                    <button 
                      className={`icon-btn`}
                      title="实际尺寸 (100%)"
                      onClick={() => setZoom(1)}
                    >
                      <span className="font-semibold text-sm">1:1</span>
                    </button>
                    
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

                    <button 
                      className="icon-btn"
                      title="按住查看原图"
                      onMouseDown={handleCompareStart}
                      onMouseUp={handleCompareEnd}
                      onMouseLeave={handleCompareEnd}
                    >
                      <Eye size={18} />
                    </button>
                    
                    <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

                    <button className="icon-btn" onClick={() => handleManualZoom(zoom - 0.1)}><ZoomOut size={18} /></button>
                    <span 
                      className="w-16 text-center" 
                      onDoubleClick={() => setZoom(1)} 
                      title="双击重置为100%"
                    >
                      {`${Math.round(zoom * 100)}%`}
                    </span>
                    <button className="icon-btn" onClick={() => handleManualZoom(zoom + 0.1)}><ZoomIn size={18} /></button>
                  </div>
                )}
              </footer>
            </div>
          
            {/* 右侧参数面板 - 工具编辑 */}
            {activeTool && <ParamsPanel />}
          </>
        )}
        
        {/* 新的右侧导出面板 */}
        {isExportPanelOpen && (
          <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">导出设置</h3>
              <button onClick={handleCloseExportPanel} className="icon-btn">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 flex-1 overflow-y-auto pr-2">
              {/* 尺寸调整 */}
              <div className="space-y-2">
                <label htmlFor="export-scale" className="text-sm font-medium">尺寸</label>
                <div className="flex items-center space-x-2">
                  <input id="export-scale" type="range" min="0.1" max="2" step="0.05" value={exportParams.scale}
                    onChange={(e) => handleExportParamsChange({ ...exportParams, scale: parseFloat(e.target.value) })}
                    className="w-full"
                  />
                  <span className="text-sm w-16 text-center">{Math.round(exportParams.scale * 100)}%</span>
                </div>
              </div>

              {/* 格式选择 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">格式</label>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {['image/jpeg', 'image/png', 'image/webp'].map(format => (
                    <button key={format}
                      onClick={() => handleExportParamsChange({ ...exportParams, format })}
                      className={`py-1 rounded text-center border ${exportParams.format === format ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
                    >
                      {format.split('/')[1].toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* 质量调整 (仅JPEG/WebP) */}
              {['image/jpeg', 'image/webp'].includes(exportParams.format) && (
                <div className="space-y-2">
                  <label htmlFor="export-quality" className="text-sm font-medium">质量</label>
                  <div className="flex items-center space-x-2">
                    <input id="export-quality" type="range" min="0.1" max="1" step="0.05" value={exportParams.quality}
                      onChange={(e) => handleExportParamsChange({ ...exportParams, quality: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                    <span className="text-sm w-16 text-center">{Math.round(exportParams.quality * 100)}</span>
                  </div>
                </div>
              )}
              
              {/* 预览大小 */}
              <div className="space-y-2 text-sm">
                <div className="font-medium">文件大小预览</div>
                <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
                  <div>原始: <span className="font-mono">{exportParams.originalSize || '...'}</span></div>
                  <div className="mt-1">预估: <span className="font-mono">{isGeneratingExport ? '计算中...' : (exportParams.previewSize || '...')}</span></div>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-4">
              <button 
                onClick={handleConfirmExport} 
                className="w-full px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400"
                disabled={isGeneratingExport}
              >
                {isGeneratingExport ? '正在生成...' : '导出文件'}
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

// 新增：拼接模式组件
function CollageModePanel({ onExit }) {
  const [images, setImages] = useState([]);
  const [layout, setLayout] = useState('vertical'); // 'vertical', 'horizontal', 'grid'
  const [options, setOptions] = useState({
    gap: 10,
    backgroundColor: '#ffffff',
    columns: 2, // for grid layout
  });
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // 检查是否有从主编辑器传递过来的初始图片
    if (window.initialCollageImage) {
      setImages([window.initialCollageImage]);
      delete window.initialCollageImage;
    }
  }, []);
  
  // 当图片或选项变化时，重新生成预览
  useEffect(() => {
    if (images.length === 0) {
      setPreviewData(null);
      return;
    }

    const generatePreview = async () => {
      setLoading(true);
      try {
        let result;
        if (layout === 'horizontal') {
          result = createHorizontalCollage(images, options);
        } else if (layout === 'vertical') {
          result = createVerticalCollage(images, options);
        } else if (layout === 'grid') {
          result = createGridCollage(images, options);
        }
        setPreviewData(result);
      } catch (error) {
        console.error("创建拼接预览失败:", error);
        alert("创建拼接预览失败: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    generatePreview();
  }, [images, layout, options]);

  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const newImages = await loadImagesFromFiles(files);
      setImages(prev => [...prev, ...newImages]);
    } catch (error) {
      alert("加载图片失败: " + error.message);
    } finally {
      setLoading(false);
    }
    // 重置 input 以便可以再次选择相同的文件
    e.target.value = null;
  };

  const handleImageRemove = (indexToRemove) => {
    setImages(prev => prev.filter((_, index) => index !== indexToRemove));
  };
  
  const handleApply = () => {
    if (!previewData) {
      alert("没有可应用的拼接图像。");
      return;
    }
    onExit(previewData);
  };
  
  return (
    <div className="flex-1 flex bg-gray-200 dark:bg-gray-900 overflow-hidden">
      {/* 左侧设置面板 */}
      <aside className="w-80 bg-white dark:bg-gray-800 p-4 overflow-y-auto flex flex-col border-r border-gray-300 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">图片拼接</h2>
        
        <div className="space-y-4">
          <div>
            <label className="font-medium">布局</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button onClick={() => setLayout('vertical')} className={`layout-btn ${layout === 'vertical' ? 'active' : ''}`}>垂直</button>
              <button onClick={() => setLayout('horizontal')} className={`layout-btn ${layout === 'horizontal' ? 'active' : ''}`}>水平</button>
              <button onClick={() => setLayout('grid')} className={`layout-btn ${layout === 'grid' ? 'active' : ''}`}>网格</button>
            </div>
          </div>
          
          {layout === 'grid' && (
            <div>
              <label htmlFor="columns" className="font-medium">列数</label>
              <input 
                id="columns" 
                type="number" 
                min="1" 
                value={options.columns} 
                onChange={e => setOptions(o => ({ ...o, columns: parseInt(e.target.value, 10) || 1 }))} 
                className="w-full mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700" 
              />
            </div>
          )}

          <div>
            <label htmlFor="gap" className="font-medium">间距 ({options.gap}px)</label>
            <input id="gap" type="range" min="0" max="100" value={options.gap} onChange={e => setOptions(o => ({ ...o, gap: parseInt(e.target.value, 10) }))} className="w-full mt-1" />
          </div>

          <div>
            <label htmlFor="bgColor" className="font-medium">背景色</label>
            <input id="bgColor" type="color" value={options.backgroundColor} onChange={e => setOptions(o => ({ ...o, backgroundColor: e.target.value }))} className="w-full h-10 mt-1 p-1" />
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <h3 className="font-medium mb-2">已添加图片 ({images.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {images.map((img, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <span className="text-sm truncate">图片 {index + 1} ({img.width}x{img.height})</span>
                <button onClick={() => handleImageRemove(index)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => fileInputRef.current.click()} className="w-full mt-2 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            添加图片
          </button>
          <input 
            id="collage-file-input"
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="mt-auto pt-4 space-x-2 flex">
          <button onClick={() => onExit(null)} className="flex-1 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
          <button onClick={handleApply} className="flex-1 py-2 rounded bg-green-500 text-white hover:bg-green-600" disabled={!previewData || loading}>
            {loading ? '生成中...' : '应用'}
          </button>
        </div>
      </aside>
      
      {/* 右侧预览区 */}
      <main className="flex-1 grid place-items-center p-4 overflow-auto">
        {loading && (
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        )}
        {previewData && !loading ? (
          <CanvasPreview imageData={previewData} />
        ) : (
          !loading && <div className="text-center text-gray-500">请添加图片以开始拼接</div>
        )}
      </main>
    </div>
  );
}

// 帮助预览拼接结果的组件
function CanvasPreview({ imageData }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && imageData) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
    }
  }, [imageData]);

  return <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-lg" />;
}

export default App; 