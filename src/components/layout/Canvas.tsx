import { Button, Tooltip } from 'antd';
import { Check, Redo, Trash2, Undo, X } from 'lucide-react';
import React, { RefObject, useEffect } from 'react';
import useCanvas from '../../hooks/useCanvas';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import { toStandardImageData } from '../../types';

import notificationService from '../../utils/notificationService';
import LoadingOverlay from '../common/LoadingOverlay';

// 空状态提示组件
const EmptyStatePrompt: React.FC = () => {
  const handleUploadClick = (): void => {
    const fileInput = document.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    fileInput?.click();
  };

  return (
    <div className="absolute flex items-center justify-center inset-0">
      <div className="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-xl backdrop-blur-sm">
        <h2 className="text-2xl font-semibold mb-2">未加载图像</h2>
        <p className="text-gray-500 dark:text-gray-400">上传一张图片开始编辑</p>
        <button
          onClick={handleUploadClick}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          上传图片
        </button>
      </div>
    </div>
  );
};

// 裁剪控制组件Props接口
interface CropControlsProps {
  onConfirm: () => void;
  onCancel: () => void;
}

// 裁剪控制组件
const CropControls: React.FC<CropControlsProps> = ({ onConfirm, onCancel }) => (
  <div className="flex items-center space-x-2">
    <Tooltip title="确认">
      <Button
        type="text"
        icon={<Check size={20} />}
        onClick={onConfirm}
        className="text-green-500 hover:text-green-600"
      />
    </Tooltip>
    <Tooltip title="取消">
      <Button
        type="text"
        icon={<X size={20} />}
        onClick={onCancel}
        className="text-red-500 hover:text-red-600"
      />
    </Tooltip>
  </div>
);

// Canvas组件Props接口
interface CanvasProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

const Canvas: React.FC<CanvasProps> = ({ containerRef }) => {
  const {
    currentImage,
    getCurrentImageData,
    canUndo,
    canRedo,
    undo,
    redo,
    clearHistory,
    revertToOriginal,
  } = useImageStore();

  const {
    isCropMode,
    setCropMode,
    cropArea,
    imageWorker,
    workerReady,
    opencvLoaded,
    zoom,
    lastProcessedImageId,
    setLastProcessedImageId,
    canvasInitialized,
    setCanvasInitialized,
  } = useEditorStore();

  const { loading, setLoading, setCanvasRendered } = useUiStore();
  const { processEdit } = useImageProcessing();

  const {
    canvasRef,
    cropCanvasRef,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  } = useCanvas(containerRef);

  // 初始化Canvas与Worker连接
  useEffect(() => {
    if (
      canvasRef.current &&
      imageWorker &&
      opencvLoaded &&
      !canvasInitialized
    ) {
      console.log('开始初始化Canvas与Worker连接');
      try {
        const offscreen = canvasRef.current.transferControlToOffscreen();
        imageWorker.postMessage(
          {
            type: 'init',
            payload: { canvas: offscreen },
          },
          [offscreen]
        );
        setCanvasInitialized(true);
      } catch (error) {
        console.warn('Canvas控制权转移失败:', error);
      }
    }
  }, [
    canvasRef,
    imageWorker,
    opencvLoaded,
    canvasInitialized,
    setCanvasInitialized,
  ]);

  // 当currentImage变化时，通过Worker处理图像显示
  // 使用全局状态来避免重复处理
  useEffect(() => {
    if (currentImage && workerReady && imageWorker) {
      // 生成图像的唯一标识，避免重复处理
      const imageId = `${currentImage.width}x${currentImage.height}-${currentImage.data.length}`;

      // 如果这个图像已经处理过，直接完成状态更新，不重复处理
      if (lastProcessedImageId === imageId) {
        setLoading(false);
        setCanvasRendered(true);
        return;
      }

      setLastProcessedImageId(imageId);

      // 通过Worker处理图像显示，而不是直接在主线程绘制
      imageWorker.postMessage({
        type: 'image-process',
        payload: {
          imageData: currentImage,
          action: 'original',
          isHistoryNavigation: false,
        },
      });
    }
  }, [
    currentImage,
    workerReady,
    imageWorker,
    setLoading,
    setCanvasRendered,
    lastProcessedImageId,
    setLastProcessedImageId,
  ]);

  // 历史记录操作
  const handleUndo = (): void => {
    if (!canUndo || loading) return;

    const prevState = undo();
    if (prevState && workerReady && imageWorker) {
      setLoading(true);

      // 清除重复检测缓存，确保Worker重新处理图像
      setLastProcessedImageId(null);

      imageWorker.postMessage({
        type: 'image-process',
        payload: {
          imageData: prevState,
          action: 'original',
          isHistoryNavigation: true,
        },
      });
    }
  };

  const handleRedo = (): void => {
    if (!canRedo || loading) return;

    const nextState = redo();
    if (nextState && workerReady && imageWorker) {
      setLoading(true);

      // 清除重复检测缓存，确保Worker重新处理图像
      setLastProcessedImageId(null);

      imageWorker.postMessage({
        type: 'image-process',
        payload: {
          imageData: nextState,
          action: 'original',
          isHistoryNavigation: true,
        },
      });
    }
  };

  const handleRevertToOriginal = (): void => {
    if (!currentImage || loading) return;

    notificationService.confirm(
      '恢复原始图像',
      '您确定要撤销所有操作，恢复到原始图像吗？',
      () => {
        setLoading(true);
        clearHistory();
        const originalImageData = revertToOriginal();

        if (originalImageData && workerReady && imageWorker) {
          // 通过Worker重新渲染原始图像
          imageWorker.postMessage({
            type: 'image-process',
            payload: {
              imageData: originalImageData,
              action: 'original',
              isHistoryNavigation: false,
            },
          });
        } else {
          setLoading(false);
          notificationService.warning('没有可用的原始图像');
        }
      }
    );
  };

  // 裁剪相关
  const handleCropConfirm = (): void => {
    if (!cropArea || cropArea.width < 10 || cropArea.height < 10) {
      notificationService.warning('请选择一个有效的裁剪区域');
      return;
    }

    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;

    const safeArea = {
      x: Math.round(Math.max(0, Math.min(cropArea.x, currentImageData.width))),
      y: Math.round(Math.max(0, Math.min(cropArea.y, currentImageData.height))),
      width: Math.round(
        Math.min(
          cropArea.width,
          currentImageData.width - Math.max(0, cropArea.x)
        )
      ),
      height: Math.round(
        Math.min(
          cropArea.height,
          currentImageData.height - Math.max(0, cropArea.y)
        )
      ),
    };

    processEdit('crop', safeArea);
    setCropMode(false);
  };

  const handleCropCancel = (): void => {
    setCropMode(false);
  };

  // 绘制裁剪选区覆盖层
  useEffect(() => {
    const cropCanvas = cropCanvasRef.current;
    if (!cropCanvas || !isCropMode) return;

    const cropCtx = cropCanvas.getContext('2d');
    const currentImageData = getCurrentImageData();

    if (!currentImageData || !cropCtx) return;

    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCanvas.width = currentImageData.width;
    cropCanvas.height = currentImageData.height;
    cropCtx.putImageData(toStandardImageData(currentImageData), 0, 0);

    if (!cropArea) return;

    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

    if (cropArea.width > 0 && cropArea.height > 0) {
      cropCtx.clearRect(
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height
      );
    }

    cropCtx.strokeStyle = '#00ff00';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
  }, [cropArea, isCropMode, getCurrentImageData, cropCanvasRef]);

  // 同步裁剪Canvas位置和大小
  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const cropCanvas = cropCanvasRef.current;
    if (!mainCanvas || !cropCanvas) return;

    if (isCropMode && currentImage) {
      const mainCanvasRect = mainCanvas.getBoundingClientRect();
      const parentElement = cropCanvas.parentElement;
      if (!parentElement) return;

      const parentRect = parentElement.getBoundingClientRect();

      cropCanvas.style.width = `${mainCanvasRect.width}px`;
      cropCanvas.style.height = `${mainCanvasRect.height}px`;
      cropCanvas.style.top = `${mainCanvasRect.top - parentRect.top}px`;
      cropCanvas.style.left = `${mainCanvasRect.left - parentRect.left}px`;

      cropCanvas.style.display = 'block';
    } else {
      cropCanvas.style.display = 'none';
    }
  }, [isCropMode, currentImage, zoom, canvasRef, cropCanvasRef]);

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* 主内容顶部栏 */}
      <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Tooltip title="撤销">
            <Button
              type="text"
              icon={<Undo size={20} />}
              onClick={handleUndo}
              disabled={!canUndo || loading}
            />
          </Tooltip>
          <Tooltip title="重做">
            <Button
              type="text"
              icon={<Redo size={20} />}
              onClick={handleRedo}
              disabled={!canRedo || loading}
            />
          </Tooltip>
          <Tooltip title="重置所有操作">
            <Button
              type="text"
              icon={<Trash2 size={20} />}
              onClick={handleRevertToOriginal}
              disabled={!currentImage || loading || !canUndo}
            />
          </Tooltip>
        </div>

        {isCropMode && (
          <CropControls
            onConfirm={handleCropConfirm}
            onCancel={handleCropCancel}
          />
        )}

        <div className="text-sm text-gray-500 dark:text-gray-400">
          {loading
            ? '处理中...'
            : workerReady
              ? 'Worker 已就绪'
              : opencvLoaded
                ? '正在初始化Canvas...'
                : '正在加载 OpenCV...'}
        </div>
      </div>

      {/* 画布区域 */}
      <div
        ref={containerRef}
        className="flex-1 grid place-items-center p-4 bg-gray-200 dark:bg-gray-800/30 overflow-auto relative"
      >
        {loading && <LoadingOverlay />}

        <canvas
          id="canvas"
          ref={canvasRef}
          className={`shadow-lg rounded-md ${!currentImage ? 'invisible' : ''}`}
          style={{
            width: currentImage ? `${currentImage.width * zoom}px` : 'auto',
            height: currentImage ? `${currentImage.height * zoom}px` : 'auto',
          }}
        />

        <canvas
          id="crop-canvas"
          ref={cropCanvasRef}
          className="absolute cursor-crosshair"
          style={{ display: 'none' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />

        {!currentImage && <EmptyStatePrompt />}
      </div>
    </main>
  );
};

export default Canvas;
