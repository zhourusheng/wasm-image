import { useCallback } from 'react';
import useImageStore from '../store/imageStore';
import useEditorStore from '../store/editorStore';
import useUiStore from '../store/uiStore';
import { logPerformanceToConsole } from '../utils/performanceLogger';

export const useImageProcessing = () => {
  const { getCurrentImageData, addToHistory, setImageSize, setOriginalImage } = useImageStore();
  const { imageWorker, workerReady, stagedImage } = useEditorStore();
  const { setLoading, startLoaderTimeout, clearLoaderTimeout, setCanvasRendered, setUserHasZoomed } = useUiStore();
  
  // 核心图像处理函数
  const processEdit = useCallback((op, params = {}, isPreview = false) => {
    if (!imageWorker || !workerReady) {
      alert("Worker 尚未准备好。");
      return;
    }
    
    clearLoaderTimeout();
    if (!isPreview) {
      setLoading(true);
    } else {
      // 仅当操作耗时较长时才显示加载动画，以避免预览时闪烁
      startLoaderTimeout(200);
    }

    // 预览时基于暂存的图像，否则基于历史记录的当前状态
    const baseImage = isPreview && stagedImage ? stagedImage : getCurrentImageData();
    if (!baseImage) {
      alert("没有可用的图像数据。");
      clearLoaderTimeout();
      setLoading(false);
      return;
    }

    console.log(`开始处理图像操作: ${op}`, params);
    
    // isHistoryNavigation 标志告诉 worker 这是否是一个不应保存到历史记录的预览操作
    imageWorker.postMessage({ 
      type: 'image-process', 
      payload: { 
        imageData: baseImage, 
        action: op, 
        params, 
        isHistoryNavigation: isPreview 
      } 
    });
    
  }, [workerReady, getCurrentImageData, stagedImage, imageWorker, setLoading, startLoaderTimeout, clearLoaderTimeout]);
  
  // 处理 Worker 消息响应
  const handleWorkerMessage = useCallback((e) => {
    const { type, payload } = e.data;
    console.log("处理Worker消息:", type);
    
    switch (type) {
      case 'compress-preview-ready':
        handleCompressPreviewReady(payload);
        break;
      case 'image-processed':
        handleImageProcessed(payload);
        break;
      case 'error':
        handleWorkerError(payload);
        break;
      // 处理新图像加载
      case 'opencv-loaded':
      case 'worker-ready':
        // 已由App.jsx中处理
        break;
      default:
        console.log("未处理的Worker消息类型:", type);
        break;
    }
  }, []);
  
  // 处理新图像加载
  const processNewImage = useCallback((imageData) => {
    console.log("处理新图像");
    setLoading(true);
    setCanvasRendered(false);
    setUserHasZoomed(false); // 修复：重置用户缩放状态
    
    // 保存原始图像用于后续比较
    setOriginalImage(imageData);
    
    // 清空历史记录并添加新图像
    useImageStore.getState().clearHistory();
    
    // 将图像发送给worker处理
    if (imageWorker) {
      imageWorker.postMessage({ 
        type: 'image-process', 
        payload: { 
          imageData, 
          action: 'original' 
        } 
      });
    }
  }, [imageWorker, setLoading, setCanvasRendered, setOriginalImage, setUserHasZoomed]);
  
  // 处理压缩预览结果
  const handleCompressPreviewReady = useCallback((payload) => {
    console.log('Worker 完成压缩预览');
    if (payload.perfLog) {
      logPerformanceToConsole(payload.perfLog);
    }
    
    clearLoaderTimeout();
    setLoading(false);
    
    if (payload.imageData) {
      setImageSize(payload.imageData.width, payload.imageData.height);
      setCanvasRendered(true);
    }
    
    return payload;
  }, [clearLoaderTimeout, setLoading, setImageSize, setCanvasRendered]);
  
  // 处理常规图像处理结果
  const handleImageProcessed = useCallback((payload) => {
    console.log('Worker 完成图像处理');
    if (payload.perfLog) {
      logPerformanceToConsole(payload.perfLog);
    }
    
    clearLoaderTimeout();
    
    if (payload.imageData) {
      setImageSize(payload.imageData.width, payload.imageData.height);
      // 仅当不是历史导航/预览时才添加到历史记录
      if (!payload.isHistoryNavigation) {
        addToHistory(payload.imageData);
      }
      setCanvasRendered(true);
    }
    
    setLoading(false);
    return payload;
  }, [clearLoaderTimeout, setLoading, setImageSize, addToHistory, setCanvasRendered]);
  
  // 处理Worker错误
  const handleWorkerError = useCallback((payload) => {
    console.error("来自 worker 的错误:", payload);
    clearLoaderTimeout();
    alert("图像处理期间发生错误： " + payload);
    setLoading(false);
  }, [clearLoaderTimeout, setLoading]);

  return {
    processEdit,
    handleWorkerMessage,
    handleCompressPreviewReady,
    handleImageProcessed,
    handleWorkerError,
    processNewImage
  };
};

export default useImageProcessing; 