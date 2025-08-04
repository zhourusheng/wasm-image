import { useRef, useCallback, RefObject } from 'react';
import type { CropArea } from '../types';
import useImageStore from '../store/imageStore';
import useEditorStore from '../store/editorStore';
import useUiStore from '../store/uiStore';

interface CanvasCoordinates {
  x: number;
  y: number;
}

interface UseCanvasReturn {
  canvasRef: RefObject<HTMLCanvasElement>;
  cropCanvasRef: RefObject<HTMLCanvasElement>;
  canvasContainerRef: RefObject<HTMLDivElement>;
  getCanvasCoordinates: (e: MouseEvent | React.MouseEvent) => CanvasCoordinates;
  handleCanvasMouseDown: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseMove: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  handleCanvasMouseUp: () => void;
}

const useCanvas = (
  containerRef: RefObject<HTMLDivElement>
): UseCanvasReturn => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = containerRef;

  const { imageSize } = useImageStore();
  const { isCropMode, cropArea, setCropArea, zoom, pan } = useEditorStore();

  // 内部状态管理
  const isDragging = useRef<boolean>(false);
  const dragStart = useRef<CanvasCoordinates>({ x: 0, y: 0 });
  const dragMode = useRef<'create' | 'move'>('create');
  const dragOffset = useRef<CanvasCoordinates>({ x: 0, y: 0 });

  // 获取画布坐标转换
  const getCanvasCoordinates = useCallback(
    (e: MouseEvent | React.MouseEvent): CanvasCoordinates => {
      const canvas = cropCanvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const clientX = 'clientX' in e ? e.clientX : (e as MouseEvent).clientX;
      const clientY = 'clientY' in e ? e.clientY : (e as MouseEvent).clientY;

      const x = (clientX - rect.left) * scaleX;
      const y = (clientY - rect.top) * scaleY;

      return { x, y };
    },
    []
  );

  // 画布鼠标事件处理函数
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isCropMode) return;

      const coords = getCanvasCoordinates(e);

      // 检查是否点击了已存在的裁剪区域
      if (cropArea) {
        // 检查点击是否在裁剪区域内
        if (
          coords.x >= cropArea.x &&
          coords.x <= cropArea.x + cropArea.width &&
          coords.y >= cropArea.y &&
          coords.y <= cropArea.y + cropArea.height
        ) {
          // 点击在裁剪区域内，进入移动模式
          dragMode.current = 'move';
          dragOffset.current = {
            x: coords.x - cropArea.x,
            y: coords.y - cropArea.y,
          };
          isDragging.current = true;
          return;
        }
      }

      // 点击在裁剪区域外或没有裁剪区域，创建新的裁剪区域
      dragMode.current = 'create';
      isDragging.current = true;
      dragStart.current = coords;
      setCropArea({
        x: coords.x,
        y: coords.y,
        width: 0,
        height: 0,
      });
    },
    [isCropMode, cropArea, getCanvasCoordinates, setCropArea]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isCropMode || !isDragging.current) return;

      const coords = getCanvasCoordinates(e);

      if (dragMode.current === 'create') {
        // 创建或调整裁剪区域
        const width = coords.x - dragStart.current.x;
        const height = coords.y - dragStart.current.y;

        setCropArea({
          x: width >= 0 ? dragStart.current.x : coords.x,
          y: height >= 0 ? dragStart.current.y : coords.y,
          width: Math.abs(width),
          height: Math.abs(height),
        });
      } else if (dragMode.current === 'move') {
        // 移动已存在的裁剪区域
        if (cropArea) {
          setCropArea({
            ...cropArea,
            x: coords.x - dragOffset.current.x,
            y: coords.y - dragOffset.current.y,
          });
        }
      }
    },
    [isCropMode, getCanvasCoordinates, setCropArea, cropArea]
  );

  const handleCanvasMouseUp = useCallback(() => {
    if (!isCropMode) return;
    isDragging.current = false;
  }, [isCropMode]);

  return {
    canvasRef,
    cropCanvasRef,
    canvasContainerRef,
    getCanvasCoordinates,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  };
};

export default useCanvas;
