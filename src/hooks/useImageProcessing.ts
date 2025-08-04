import { useCallback } from 'react';
import type {
  ImageDataInterface,
  WorkerMessage,
  FilterParams,
  PerformanceMetrics,
} from '../types';
import useImageStore from '../store/imageStore';
import useEditorStore from '../store/editorStore';
import useUiStore from '../store/uiStore';
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
  const { imageWorker, workerReady, setImageWorker } = useEditorStore();
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

      // 清空历史记录并添加新图像
      clearHistory();

      // 将图像发送给worker处理
      if (imageWorker) {
        const message: WorkerMessage = {
          type: 'image-process',
          payload: {
            imageData,
            action: 'original',
          },
        };
        imageWorker.postMessage(message);
      }
    },
    [imageWorker, setLoading, setCanvasRendered, clearHistory, updateDeviceInfo]
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
      console.log('Worker 完成图像处理');
      if (payload.perfLog) {
        logPerformanceToConsole(payload.perfLog);
      }

      if (payload.imageData) {
        // 仅当不是历史导航/预览时才添加到历史记录
        if (!payload.isHistoryNavigation) {
          updateImage(payload.imageData);
        } else {
          // 预览时直接设置图像，不添加历史记录
          setImage(payload.imageData);
        }
        setCanvasRendered(true);
      }

      setLoading(false);
      return payload;
    },
    [setLoading, updateImage, setImage, setCanvasRendered]
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

export default useImageProcessing;
