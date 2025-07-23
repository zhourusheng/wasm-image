import { create } from 'zustand';
import { formatFileSize } from '../utils/filters';
import { compressCanvasImage } from '../utils/filters';
import { logPerformanceToConsole } from '../utils/performanceLogger';
import { PerformanceTimer } from '../utils/performanceLogger';

const useUiStore = create((set, get) => ({
  // 基础UI状态
  loading: false,
  isCanvasRendered: false,
  loaderTimeout: null,
  
  // 导出面板相关状态
  isExportPanelOpen: false,
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
  
  // 视图缩放与显示模式状态
  zoom: 1,
  fitZoom: 1,
  userHasZoomed: false,
  
  // 加载状态方法
  setLoading: (state) => {
    set({ loading: state });
  },
  
  startLoaderTimeout: (timeout = 200) => {
    const timeoutId = setTimeout(() => {
      set({ loading: true });
    }, timeout);
    set({ loaderTimeout: timeoutId });
  },
  
  clearLoaderTimeout: () => {
    const { loaderTimeout } = get();
    if (loaderTimeout) {
      clearTimeout(loaderTimeout);
    }
    set({ loaderTimeout: null });
  },
  
  // 画布渲染状态
  setCanvasRendered: (isRendered) => {
    set({ isCanvasRendered: isRendered });
  },
  
  // 缩放相关方法
  setZoom: (newZoom) => {
    const clampedZoom = Math.max(0.01, Math.min(newZoom, 10));
    set({ zoom: clampedZoom });
  },
  
  setFitZoom: (newFitZoom) => {
    set({ fitZoom: newFitZoom });
  },
  
  setUserHasZoomed: (hasZoomed) => {
    set({ userHasZoomed: hasZoomed });
  },
  
  // 导出面板相关方法
  openExportPanel: () => {
    set({ isExportPanelOpen: true });
  },
  
  closeExportPanel: () => {
    const { exportParams } = get();
    // 清理可能已创建的Blob URL
    if (exportParams.previewUrl) {
      URL.revokeObjectURL(exportParams.previewUrl);
    }
    
    set({ 
      isExportPanelOpen: false,
      exportParams: {
        quality: 0.8,
        scale: 1.0,
        format: 'image/jpeg',
        previewSize: null,
        originalSize: null,
        originalSizeBytes: null,
        compressedBlob: null,
        previewUrl: null,
      }
    });
  },
  
  updateExportParams: (newParams) => {
    set(state => ({
      exportParams: { ...state.exportParams, ...newParams }
    }));
  },
  
  // 导出预览生成
  generateExportPreview: async (currentImageData, params) => {
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
      const { blob, size, url } = await compressCanvasImage(tempCanvas, params.quality, params.format);
      timer.step('compress_to_blob');
      
      // 清理上一个预览的URL
      const prevUrl = get().exportParams.previewUrl;
      if (prevUrl) {
        URL.revokeObjectURL(prevUrl);
      }
      
      // 更新导出参数
      set(state => ({
        exportParams: {
          ...state.exportParams,
          ...params,
          previewSize: formatFileSize(size),
          compressedBlob: blob,
          previewUrl: url,
        },
        isGeneratingExport: false
      }));
      
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
      
    } catch (err) {
      console.error("无法生成导出预览:", err);
      set({ isGeneratingExport: false });
    }
  }
}));

export default useUiStore; 