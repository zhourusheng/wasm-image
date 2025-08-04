import { create } from 'zustand';
import type {
  ImageStoreState,
  ImageDataInterface,
  HistoryItem,
} from '../types';
import HistoryManager from '../utils/historyManager';
import { loadImageFromFile, getImageDataFromImage } from '../utils/imageUtils';
import notificationService from '../utils/notificationService';

interface FileInfo {
  size: number;
  name: string;
}

interface ImageStoreInternalState {
  // 图像状态
  currentImage: ImageDataInterface | null;
  originalImage: ImageDataInterface | null;
  history: HistoryItem[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  imageSize: { width: number; height: number };
  originalFileInfo: FileInfo;
  historyManager: HistoryManager;
}

const useImageStore = create<ImageStoreState & ImageStoreInternalState>(
  (set, get) => ({
    // 图像状态
    currentImage: null,
    originalImage: null,
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    imageSize: { width: 0, height: 0 },
    originalFileInfo: { size: 0, name: '' },
    historyManager: new HistoryManager(),

    // 图像加载和处理方法
    setImage: (imageData: ImageDataInterface) => {
      const historyManager = get().historyManager;

      // 添加到历史记录
      historyManager.add(imageData);

      // 如果是第一张图片，也设置为原始图片
      const state = get();
      if (!state.originalImage) {
        set({
          originalImage: imageData,
          currentImage: imageData,
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo(),
          history: historyManager.getHistory(),
          historyIndex: historyManager.getCurrentIndex(),
        });
      } else {
        set({
          currentImage: imageData,
          canUndo: historyManager.canUndo(),
          canRedo: historyManager.canRedo(),
          history: historyManager.getHistory(),
          historyIndex: historyManager.getCurrentIndex(),
        });
      }
    },

    updateImage: (imageData: ImageDataInterface) => {
      const historyManager = get().historyManager;

      historyManager.add(imageData);

      set({
        currentImage: imageData,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
        history: historyManager.getHistory(),
        historyIndex: historyManager.getCurrentIndex(),
      });
    },

    undo: () => {
      const historyManager = get().historyManager;
      if (!historyManager.canUndo()) return null;

      const imageData = historyManager.undo();

      set({
        currentImage: imageData,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
        history: historyManager.getHistory(),
        historyIndex: historyManager.getCurrentIndex(),
      });

      return imageData;
    },

    redo: () => {
      const historyManager = get().historyManager;
      if (!historyManager.canRedo()) return null;

      const imageData = historyManager.redo();

      set({
        currentImage: imageData,
        canUndo: historyManager.canUndo(),
        canRedo: historyManager.canRedo(),
        history: historyManager.getHistory(),
        historyIndex: historyManager.getCurrentIndex(),
      });

      return imageData;
    },

    clearHistory: () => {
      const historyManager = get().historyManager;
      historyManager.clear();

      set({
        history: [],
        historyIndex: -1,
        canUndo: false,
        canRedo: false,
      });
    },

    // 内部方法
    loadImage: async (file: File) => {
      if (!file) return;

      try {
        // 更新原始文件信息
        set({ originalFileInfo: { size: file.size, name: file.name } });
        const loadedImage = await loadImageFromFile(file);
        const imageData = await getImageDataFromImage(loadedImage);
        get().setImage(imageData);
      } catch (error) {
        console.error(error);
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        notificationService.error(errorMessage);
      }
    },

    setImageSize: (width: number, height: number) => {
      set({ imageSize: { width, height } });
    },

    setOriginalFileInfo: (fileInfo: FileInfo) => {
      set({ originalFileInfo: fileInfo });
    },

    getCurrentImageData: () => get().currentImage,

    revertToOriginal: () => {
      const originalImage = get().originalImage;
      if (!originalImage) return null;

      get().setImage(originalImage);
      return originalImage;
    },

    // 清理和重置
    reset: () => {
      const historyManager = get().historyManager;
      historyManager.clear();

      set({
        currentImage: null,
        originalImage: null,
        imageSize: { width: 0, height: 0 },
        history: [],
        historyIndex: -1,
        canUndo: false,
        canRedo: false,
      });
    },

    // 调用异步代码加载图像
    loadImageFromUrl: async (url: string): Promise<HTMLImageElement | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok)
          throw new Error(`Failed to fetch: ${response.statusText}`);

        const blob = await response.blob();
        const img = new Image();

        return new Promise((resolve, reject) => {
          img.onload = () => resolve(img);
          img.onerror = error => reject(error);
          img.src = URL.createObjectURL(blob);
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '加载图片失败';
        notificationService.error(errorMessage);
        return null;
      }
    },
  })
);

export default useImageStore;
