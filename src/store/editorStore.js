import { create } from 'zustand';
import { shallow } from 'zustand/shallow';
import { historyManager } from '../utils/historyManager';

const useEditorStore = create((set, get) => ({
  // Worker和OpenCV状态
  workerReady: false,
  opencvLoaded: false,
  imageWorker: null,
  
  // 工具状态
  activeTool: null,
  toolParams: {},
  stagedImage: null,
  
  // 编辑模式状态
  isCropMode: false,
  cropArea: null,
  isCollageMode: false,
  isDragging: false,
  dragStart: { x: 0, y: 0 },
  dragMode: 'create', // 'create', 'move'
  dragOffset: { x: 0, y: 0 },
  exitModeType: null, // 'cancel' 或 'apply'
  justExitedCollageMode: false,
  
  // 初始化Worker
  initWorker: () => {
    const worker = new Worker(new URL('../workers/imageWorker.js?worker&inline', import.meta.url));
    set({ imageWorker: worker });
    
    // 处理Worker消息
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      switch (type) {
        case 'opencv-loaded':
          set({ opencvLoaded: true });
          console.log("OpenCV 已在 worker 中加载。");
          break;
        case 'worker-ready':
          set({ workerReady: true });
          console.log("Worker 已准备好处理图像。");
          break;
      }
    };
    
    return () => {
      worker.terminate();
    };
  },
  
  // 设置Worker实例
  setImageWorker: (worker) => {
    set({ imageWorker: worker });
  },

  // 设置Worker和OpenCV状态
  setWorkerReady: (isReady) => set({ workerReady: isReady }),
  setOpenCVLoaded: (isLoaded) => set({ opencvLoaded: isLoaded }),
  
  // 工具相关方法
  setActiveTool: (tool, defaultParams = {}) => {
    set({ 
      activeTool: tool, 
      toolParams: defaultParams 
    });
  },
  
  updateToolParams: (newParams) => {
    set(state => ({
      toolParams: { ...state.toolParams, ...newParams }
    }));
  },
  
  setStagedImage: (imageData) => {
    set({ stagedImage: imageData });
  },
  
  clearActiveTool: () => {
    set({ activeTool: null, toolParams: {}, stagedImage: null });
  },
  
  // 裁剪相关方法
  toggleCropMode: () => {
    set(state => ({ isCropMode: !state.isCropMode }));
  },
  
  setCropArea: (area) => {
    set({ cropArea: area });
  },
  
  setIsDragging: (isDragging) => {
    set({ isDragging });
  },
  
  setDragStart: (point) => {
    set({ dragStart: point });
  },
  
  setDragMode: (mode) => {
    set({ dragMode: mode });
  },
  
  setDragOffset: (offset) => {
    set({ dragOffset: offset });
  },
  
  // 拼接模式相关方法
  setIsCollageMode: (isCollageMode) => {
    set({ isCollageMode });
  },
  
  setExitModeType: (type) => {
    set({ exitModeType: type });
  },
  
  setJustExitedCollageMode: (value) => {
    set({ justExitedCollageMode: value });
  }
}));

export default useEditorStore; 