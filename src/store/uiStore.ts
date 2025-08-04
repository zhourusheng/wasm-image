import { create } from 'zustand';
import type {
  UIStoreState,
  ImageDataInterface,
  ExportParams,
  ExportPreview,
  DeviceInfo,
  FeatureSupport,
} from '../types';
import { formatFileSize } from '../utils/filters';
import { compressCanvasImage } from '../utils/filters';
import {
  logPerformanceToConsole,
  PerformanceTimer,
} from '../utils/performanceLogger';

interface ExportParamsInternal {
  quality: number;
  scale: number;
  format: string;
  previewSize: string | null;
  originalSize: string | null;
  originalSizeBytes: number | null;
  compressedBlob: Blob | null;
  previewUrl: string | null;
}

interface UIStoreInternalState {
  // 基础UI状态
  loading: boolean;
  loadingText: string;
  isCanvasRendered: boolean;
  loaderTimeout: NodeJS.Timeout | null;

  // 导出面板相关状态
  isExportPanelOpen: boolean;
  showExportPanel: boolean;
  showParamsPanel: boolean;
  isGeneratingExport: boolean;
  exportParams: ExportParamsInternal;
  exportPreview: ExportPreview | null;

  // 视图缩放与显示模式状态
  zoom: number;
  fitZoom: number;
  userHasZoomed: boolean;

  // 暗色模式和通知
  darkMode: boolean;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>;
  deviceInfo: DeviceInfo;
  featureSupport: FeatureSupport;
}

const defaultDeviceInfo: DeviceInfo = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  orientation: 'landscape',
  pixelRatio: 1,
  touchSupport: false,
};

const defaultFeatureSupport: FeatureSupport = {
  webAssembly: false,
  offscreenCanvas: false,
  webWorkers: false,
  sharedArrayBuffer: false,
  webGL: false,
  webGPU: false,
};

const useUiStore = create<UIStoreState & UIStoreInternalState>((set, get) => ({
  // 基础UI状态
  loading: false,
  loadingText: '',
  isCanvasRendered: false,
  loaderTimeout: null,

  // 导出面板相关状态
  isExportPanelOpen: false,
  showExportPanel: false,
  showParamsPanel: false,
  isGeneratingExport: false,
  exportParams: {
    quality: 0.8,
    scale: 1.0,
    format: 'image/jpeg',
    previewSize: null,
    originalSize: null,
    originalSizeBytes: null,
    compressedBlob: null,
    previewUrl: null,
  },
  exportPreview: null,

  // 视图缩放与显示模式状态
  zoom: 1,
  fitZoom: 1,
  userHasZoomed: false,

  // 暗色模式和通知
  darkMode: false,
  notifications: [],
  deviceInfo: defaultDeviceInfo,
  featureSupport: defaultFeatureSupport,

  // 加载状态方法
  setLoading: (state: boolean, text: string = '') => {
    set({ loading: state, loadingText: text });
  },

  startLoaderTimeout: (timeout: number = 200) => {
    const timeoutId = setTimeout(() => {
      set({ loading: true });
    }, timeout);
    set({ loaderTimeout: timeoutId as unknown as NodeJS.Timeout });
  },

  clearLoaderTimeout: () => {
    const { loaderTimeout } = get();
    if (loaderTimeout) {
      clearTimeout(loaderTimeout);
    }
    set({ loaderTimeout: null });
  },

  // 画布渲染状态
  setCanvasRendered: (isRendered: boolean) => {
    set({ isCanvasRendered: isRendered });
  },

  // 缩放相关方法
  setZoom: (newZoom: number) => {
    const clampedZoom = Math.max(0.01, Math.min(newZoom, 10));
    set({ zoom: clampedZoom });
  },

  setFitZoom: (newFitZoom: number) => {
    set({ fitZoom: newFitZoom });
  },

  setUserHasZoomed: (hasZoomed: boolean) => {
    set({ userHasZoomed: hasZoomed });
  },

  // 导出面板相关方法
  toggleExportPanel: () => {
    const { isExportPanelOpen } = get();
    if (isExportPanelOpen) {
      get().closeExportPanel();
    } else {
      set({ isExportPanelOpen: true, showExportPanel: true });
    }
  },

  toggleParamsPanel: () => {
    set(state => ({ showParamsPanel: !state.showParamsPanel }));
  },

  closeExportPanel: () => {
    const { exportParams } = get();
    // 清理可能已创建的Blob URL
    if (exportParams.previewUrl) {
      URL.revokeObjectURL(exportParams.previewUrl);
    }

    set({
      isExportPanelOpen: false,
      showExportPanel: false,
      exportParams: {
        quality: 0.8,
        scale: 1.0,
        format: 'image/jpeg',
        previewSize: null,
        originalSize: null,
        originalSizeBytes: null,
        compressedBlob: null,
        previewUrl: null,
      },
    });
  },

  updateExportParams: (newParams: Partial<ExportParamsInternal>) => {
    set(state => ({
      exportParams: { ...state.exportParams, ...newParams },
    }));
  },

  // 通知系统
  showNotification: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => {
    const id = `${Date.now()}-${Math.random()}`;
    set(state => ({
      notifications: [...state.notifications, { id, type, message }],
    }));

    // 自动移除通知
    setTimeout(() => {
      get().hideNotification(id);
    }, 5000);
  },

  hideNotification: (id: string) => {
    set(state => ({
      notifications: state.notifications.filter(
        notification => notification.id !== id
      ),
    }));
  },

  // 暗色模式
  toggleDarkMode: () => {
    set(state => ({ darkMode: !state.darkMode }));
  },

  // 设备信息和特性支持
  updateDeviceInfo: (info: Partial<DeviceInfo>) => {
    set(state => ({
      deviceInfo: { ...state.deviceInfo, ...info },
    }));
  },

  updateFeatureSupport: (support: Partial<FeatureSupport>) => {
    set(state => ({
      featureSupport: { ...state.featureSupport, ...support },
    }));
  },

  // 导出预览生成
  setExportPreview: (preview: ExportPreview | null) => {
    set({ exportPreview: preview });
  },

  generateExportPreview: async (
    currentImageData: ImageDataInterface,
    params: ExportParams
  ) => {
    if (!currentImageData) return;

    set({ isGeneratingExport: true });

    const timer = new PerformanceTimer('export_preview', {
      scale: params.scale,
      format: params.format,
      quality: params.quality,
    });

    try {
      // 创建临时Canvas进行缩放
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');

      if (!tempCtx) {
        throw new Error('无法获取Canvas上下文');
      }

      // 计算缩放后的尺寸
      const newWidth = Math.round(currentImageData.width * params.scale);
      const newHeight = Math.round(currentImageData.height * params.scale);
      tempCanvas.width = newWidth;
      tempCanvas.height = newHeight;

      // 将当前图像数据绘制到临时画布上，并进行缩放
      const tempImage = await createImageBitmap(currentImageData);
      timer.step('create_image_bitmap');

      tempCtx.drawImage(tempImage, 0, 0, newWidth, newHeight);
      timer.step('draw_image_scaled');

      // 压缩图像
      const { blob, size, url } = await compressCanvasImage(
        tempCanvas,
        params.quality,
        params.format
      );
      timer.step('compress_to_blob');

      // 清理上一个预览的URL
      const prevUrl = get().exportParams.previewUrl;
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }

      // 创建导出预览对象
      const exportPreview: ExportPreview = {
        blob,
        size,
        url,
        format: params.format,
        quality: params.quality,
        dimensions: {
          width: newWidth,
          height: newHeight,
        },
      };

      // 更新导出参数
      set(state => ({
        exportParams: {
          ...state.exportParams,
          quality: params.quality,
          scale: params.scale,
          format: params.format,
          previewSize: formatFileSize(size),
          compressedBlob: blob,
          previewUrl: url,
        },
        exportPreview,
        isGeneratingExport: false,
      }));

      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
    } catch (err) {
      console.error('无法生成导出预览:', err);
      set({ isGeneratingExport: false });
    }
  },
}));

export default useUiStore;
