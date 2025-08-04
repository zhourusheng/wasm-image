import { useEffect, RefObject } from 'react';
import useImageStore from '../store/imageStore';
import useUiStore from '../store/uiStore';
import useEditorStore from '../store/editorStore';

interface UseZoomReturn {
  handleManualZoom: (newZoom: number) => void;
  resetToFitZoom: () => void;
  resetToOriginalZoom: () => void;
}

const useZoom = (
  canvasContainerRef: RefObject<HTMLDivElement | null>
): UseZoomReturn => {
  const { currentImage } = useImageStore();
  const { setZoom, setUserHasZoomed } = useUiStore();
  const { setZoom: setEditorZoom } = useEditorStore();

  const handleManualZoom = (newZoom: number) => {
    const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));
    setZoom(clampedZoom);
    setEditorZoom(clampedZoom);
    setUserHasZoomed(true);
  };

  const resetToFitZoom = () => {
    if (!canvasContainerRef.current || !currentImage) return;

    const container = canvasContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    const scaleX = containerRect.width / currentImage.width;
    const scaleY = containerRect.height / currentImage.height;
    const fitZoom = Math.min(scaleX, scaleY, 1); // 不要超过100%

    setZoom(fitZoom);
    setEditorZoom(fitZoom);
    setUserHasZoomed(false);
  };

  const resetToOriginalZoom = () => {
    setZoom(1);
    setEditorZoom(1);
    setUserHasZoomed(true);
  };

  // 使用 ResizeObserver 进行精确的缩放计算
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !currentImage) return;

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry && currentImage.width > 0) {
        // 使用 contentRect 可以精确获取内容区域的尺寸
        const { width: containerWidth, height: containerHeight } =
          entry.contentRect;

        const scaleX = containerWidth / currentImage.width;
        const scaleY = containerHeight / currentImage.height;
        const newFitZoom = Math.min(scaleX, scaleY, 1); // 不要超过100%

        // 仅当用户未手动缩放时，才自动应用适应屏幕的缩放
        if (!useUiStore.getState().userHasZoomed) {
          setZoom(newFitZoom);
          setEditorZoom(newFitZoom);
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, [currentImage, canvasContainerRef, setZoom, setEditorZoom]);

  return {
    handleManualZoom,
    resetToFitZoom,
    resetToOriginalZoom,
  };
};

export default useZoom;
