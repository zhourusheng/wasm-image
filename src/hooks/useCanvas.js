import { useRef, useEffect, useCallback } from 'react';
import useImageStore from '../store/imageStore';
import useEditorStore from '../store/editorStore';
import useUiStore from '../store/uiStore';

const useCanvas = () => {
  const canvasRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const canvasContainerRef = useRef(null);

  const { imageSize } = useImageStore();
  const { 
    imageWorker, 
    isCropMode, 
    cropArea, 
    setCropArea, 
    isDragging, 
    setIsDragging, 
    dragStart, 
    setDragStart, 
    dragMode,
    setDragMode,
    dragOffset,
    setDragOffset,
    workerReady
  } = useEditorStore();

  const { zoom } = useUiStore();

  // 获取画布坐标转换
  const getCanvasCoordinates = useCallback((e) => {
    const canvas = cropCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
  }, []);

  // 画布鼠标事件处理函数
  const handleCanvasMouseDown = useCallback((e) => {
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
  }, [isCropMode, cropArea, getCanvasCoordinates, setCropArea, setDragMode, setDragOffset, setIsDragging, setDragStart]);

  const handleCanvasMouseMove = useCallback((e) => {
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
  }, [isCropMode, isDragging, dragMode, dragStart, dragOffset, getCanvasCoordinates, setCropArea]);

  const handleCanvasMouseUp = useCallback(() => {
    if (!isCropMode) return;
    setIsDragging(false);
  }, [isCropMode, setIsDragging]);

  // 初始化画布与Worker的通信
  const initCanvasOffscreen = useCallback(() => {
    if (canvasRef.current && imageWorker && workerReady) {
      const offscreen = canvasRef.current.transferControlToOffscreen();
      imageWorker.postMessage({ 
        type: 'init', 
        payload: { canvas: offscreen } 
      }, [offscreen]);
    }
  }, [imageWorker, workerReady]);

  return {
    canvasRef,
    cropCanvasRef,
    canvasContainerRef,
    getCanvasCoordinates,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    initCanvasOffscreen,
  };
};

export default useCanvas; 