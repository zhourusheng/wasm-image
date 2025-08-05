import { useCallback } from 'react';
import useEditorStore from '../store/editorStore';
import useImageStore from '../store/imageStore';
import useUiStore from '../store/uiStore';
import type {
  FilterParams,
  ImageDataInterface,
  PerformanceMetrics,
  WorkerMessage,
} from '../types';
import notificationService from '../utils/notificationService';
import { logPerformanceToConsole } from '../utils/performanceLogger';

interface ProcessedPayload {
  imageData?: ImageDataInterface;
  perfLog?: PerformanceMetrics;
  isHistoryNavigation?: boolean;
  error?: string;
}

export const useImageProcessing = () => {
  const { currentImage, updateImage, setImage, clearHistory } = useImageStore();
  const {
    imageWorker,
    workerReady,
    clearLastProcessedImageId,
    setCropMode,
    setActiveTool,
    updateToolParams,
  } = useEditorStore();
  const { setLoading, setCanvasRendered, updateDeviceInfo } = useUiStore();

  // 核心图像处理函数
  const processEdit = useCallback(
    (op: string, params: FilterParams = {}, isPreview: boolean = false) => {
      if (!imageWorker || !workerReady) {
        notificationService.warning('Worker 尚未准备好。');
        return;
      }

      if (!isPreview) {
        setLoading(true);
      }

      // 获取当前图像数据
      const baseImage = currentImage;
      if (!baseImage) {
        notificationService.warning('没有可用的图像数据。');
        setLoading(false);
        return;
      }

      console.log(`开始处理图像操作: ${op}`, params);

      // 发送处理请求到 Worker
      const message: WorkerMessage = {
        type: 'image-process',
        payload: {
          imageData: baseImage,
          action: op,
          params,
          isHistoryNavigation: isPreview,
        },
      };

      imageWorker.postMessage(message);
    },
    [workerReady, currentImage, imageWorker, setLoading]
  );

  // 处理 Worker 消息响应
  const handleWorkerMessage = useCallback((e: MessageEvent<WorkerMessage>) => {
    const { type, payload } = e.data;
    console.log('处理Worker消息:', type);

    switch (type) {
      case 'compress-preview-ready':
        handleCompressPreviewReady(payload as ProcessedPayload);
        break;
      case 'image-processed':
        handleImageProcessed(payload as ProcessedPayload);
        break;
      case 'error':
        handleWorkerError(payload as string);
        break;
      // 处理新图像加载
      case 'opencv-loaded':
      case 'worker-ready':
        // 已由App.tsx中处理
        break;
      default:
        console.log('未处理的Worker消息类型:', type);
        break;
    }
  }, []);

  // 处理新图像加载
  const processNewImage = useCallback(
    (imageData: ImageDataInterface) => {
      console.log('处理新图像');
      setLoading(true);
      setCanvasRendered(false);
      updateDeviceInfo({ touchSupport: 'ontouchstart' in window });

      // 重置所有编辑状态
      clearHistory(); // 清空历史记录
      clearLastProcessedImageId(); // 清除图像处理缓存，确保重新加载
      setCropMode(false); // 退出裁剪模式
      setActiveTool(null); // 清除激活的工具
      updateToolParams({}); // 重置工具参数
      // 注意：不重置canvasInitialized，因为Canvas控制权已经转移给Worker，不能重复转移

      setImage(imageData); // 设置图像到状态中，Canvas组件的useEffect会自动处理渲染

      // 注意：不需要手动发送Worker消息，Canvas组件的useEffect会监听currentImage变化并处理
    },
    [
      setLoading,
      setCanvasRendered,
      clearHistory,
      updateDeviceInfo,
      setImage,
      clearLastProcessedImageId,
      setCropMode,
      setActiveTool,
      updateToolParams,
    ]
  );

  // 处理压缩预览结果
  const handleCompressPreviewReady = useCallback(
    (payload: ProcessedPayload) => {
      console.log('Worker 完成压缩预览');
      if (payload.perfLog) {
        logPerformanceToConsole(payload.perfLog);
      }

      setLoading(false);

      if (payload.imageData) {
        setCanvasRendered(true);
      }

      return payload;
    },
    [setLoading, setCanvasRendered]
  );

  // 处理常规图像处理结果
  const handleImageProcessed = useCallback(
    (payload: ProcessedPayload) => {
      console.log('Worker 完成图像处理', {
        operation: payload.perfLog?.operation,
        isHistoryNavigation: payload.isHistoryNavigation,
      });

      if (payload.perfLog) {
        logPerformanceToConsole(payload.perfLog);
      }

      if (payload.imageData) {
        if (payload.perfLog?.operation === 'original') {
          // 对于original操作，需要区分不同情况
          if (payload.isHistoryNavigation) {
            // 历史导航：直接设置图像，不添加到历史记录
            console.log('历史导航操作，直接设置图像状态');
            // 注意：不调用setImage，因为undo/redo已经更新了imageStore状态
            // 只需要设置渲染状态
            setCanvasRendered(true);
          } else if (!currentImage) {
            // 首次加载：设置图像状态
            console.log('首次加载图像');
            setImage(payload.imageData);
            setCanvasRendered(true);
          } else {
            // 重复处理：只更新渲染状态
            setCanvasRendered(true);
          }
        } else {
          // 非original操作，正常更新图像数据
          if (!payload.isHistoryNavigation) {
            updateImage(payload.imageData);
          } else {
            // 预览时直接设置图像，不添加历史记录
            setImage(payload.imageData);
          }
          setCanvasRendered(true);
        }
      }

      setLoading(false);
      return payload;
    },
    [setLoading, updateImage, setImage, setCanvasRendered, currentImage]
  );

  // 处理Worker错误
  const handleWorkerError = useCallback(
    (error: string) => {
      console.error('来自 worker 的错误:', error);
      notificationService.error('图像处理期间发生错误： ' + error);
      setLoading(false);
    },
    [setLoading]
  );

  return {
    processEdit,
    handleWorkerMessage,
    handleCompressPreviewReady,
    handleImageProcessed,
    handleWorkerError,
    processNewImage,
  };
};
