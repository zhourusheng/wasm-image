import { create } from 'zustand';
import HistoryManager from '../utils/historyManager';
import { loadImageFromFile, getImageDataFromImage } from '../utils/imageUtils';

const useImageStore = create((set, get) => ({
  // 图像状态
  image: null,
  originalImage: null,
  imageSize: { width: 0, height: 0 },
  originalFileInfo: { size: 0, name: '' },
  historyManager: new HistoryManager(),
  
  // 图像加载和处理方法
  loadImage: async (file) => {
    if (!file) return;
    
    try {
      // 更新原始文件信息
      set({ originalFileInfo: { size: file.size, name: file.name } });
      const loadedImage = await loadImageFromFile(file);
      set({ image: loadedImage });
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
  },
  
  setImage: (image) => {
    set({ image });
  },

  setImageSize: (width, height) => {
    set({ imageSize: { width, height } });
  },
  
  setOriginalFileInfo: (fileInfo) => {
    set({ originalFileInfo: fileInfo });
  },
  
  getCurrentImageData: () => get().historyManager.getCurrentState(),
  
  // 历史记录管理
  addToHistory: (imageData) => {
    get().historyManager.add(imageData);
    set({}); // 触发更新
  },
  
  undo: () => {
    if (!get().historyManager.canUndo()) return null;
    return get().historyManager.undo();
  },
  
  redo: () => {
    if (!get().historyManager.canRedo()) return null;
    return get().historyManager.redo();
  },
  
  canUndo: () => get().historyManager.canUndo(),
  
  canRedo: () => get().historyManager.canRedo(),
  
  setOriginalImage: (imageData) => {
    set({ originalImage: imageData });
  },
  
  revertToOriginal: () => {
    if (!get().originalImage) return null;
    return get().originalImage;
  },
  
  // 清理和重置
  reset: () => {
    get().historyManager.clear();
    set({ image: null, originalImage: null, imageSize: { width: 0, height: 0 } });
  },
  
  clearHistory: () => {
    get().historyManager.clear();
    set({}); // 触发更新
  }
}));

export default useImageStore; 