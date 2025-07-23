import { useEffect } from 'react';
import useImageStore from '../store/imageStore';
import useUiStore from '../store/uiStore';

const useZoom = (canvasContainerRef) => {
  const { imageSize } = useImageStore();
  const { zoom, setZoom, fitZoom, setFitZoom, userHasZoomed, setUserHasZoomed } = useUiStore();

  // 处理手动缩放
  const handleManualZoom = (newZoom) => {
    setZoom(newZoom);
    setUserHasZoomed(true);
  };

  // 重置到适应屏幕的缩放
  const resetToFitZoom = () => {
    setZoom(fitZoom);
  };

  // 重置到100%缩放
  const resetToOriginalZoom = () => {
    setZoom(1);
    setUserHasZoomed(true);
  };

  // 初始计算适应缩放
  useEffect(() => {
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
  }, [imageSize, userHasZoomed, canvasContainerRef, setFitZoom, setZoom]);

  // 监听容器大小变化，更新适应缩放
  useEffect(() => {
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
      }
    });

    observer.observe(canvasContainerRef.current);
    return () => observer.disconnect();
  }, [imageSize, canvasContainerRef, setFitZoom]);

  return {
    handleManualZoom,
    resetToFitZoom,
    resetToOriginalZoom
  };
};

export default useZoom; 