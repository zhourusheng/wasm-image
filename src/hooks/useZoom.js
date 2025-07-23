import { useEffect } from 'react';
import useImageStore from '../store/imageStore';
import useUiStore from '../store/uiStore';

const useZoom = (canvasContainerRef) => {
  const { imageSize } = useImageStore();
  const { zoom, setZoom, fitZoom, setFitZoom, userHasZoomed, setUserHasZoomed } = useUiStore();

  const handleManualZoom = (newZoom) => {
    setZoom(newZoom);
    setUserHasZoomed(true);
  };

  const resetToFitZoom = () => {
    setZoom(fitZoom);
  };

  const resetToOriginalZoom = () => {
    setZoom(1);
    setUserHasZoomed(true);
  };

  // 统一使用 ResizeObserver 进行精确的缩放计算
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && imageSize.width > 0) {
        // 使用 contentRect 可以精确获取内容区域的尺寸，无需手动减去 padding
        const { width: containerWidth, height: containerHeight } = entry.contentRect;
        
        const scaleX = containerWidth / imageSize.width;
        const scaleY = containerHeight / imageSize.height;
        const newFitZoom = Math.min(scaleX, scaleY);

        // 始终更新 "fitZoom" 的值，供按钮使用
        setFitZoom(newFitZoom);
        
        // 仅当用户未手动缩放时，才自动应用适应屏幕的缩放
        // 这会同时处理好初始加载和窗口尺寸变化两种情况
        if (!userHasZoomed) {
          setZoom(newFitZoom);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [imageSize, userHasZoomed, canvasContainerRef, setFitZoom, setZoom]);

  return {
    handleManualZoom,
    resetToFitZoom,
    resetToOriginalZoom
  };
};

export default useZoom; 