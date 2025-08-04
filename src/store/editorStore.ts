import { create } from 'zustand';
import type { 
  EditorStoreState,
  ToolType,
  FilterParams,
  CropArea,
  WorkerMessage
} from '../types';

const useEditorStore = create<EditorStoreState>((set, get) => ({
  // Worker和OpenCV状态
  workerReady: false,
  opencvLoaded: false,
  imageWorker: null,
  
  // 工具状态
  activeTool: null,
  toolParams: {},
  
  // 编辑模式状态
  isCropMode: false,
  cropArea: null,
  isCollageMode: false,
  
  // 视图状态
  zoom: 1,
  pan: { x: 0, y: 0 },
  
  // 设置Worker和OpenCV状态
  setWorkerReady: (isReady: boolean) => set({ workerReady: isReady }),
  setOpenCVLoaded: (isLoaded: boolean) => set({ opencvLoaded: isLoaded }),
  
  // 设置Worker实例
  setImageWorker: (worker: Worker | null) => {
    set({ imageWorker: worker });
  },
  
  // 工具相关方法
  setActiveTool: (tool: ToolType, defaultParams: FilterParams = {}) => {
    set({ 
      activeTool: tool, 
      toolParams: defaultParams 
    });
  },
  
  updateToolParams: (newParams: Partial<FilterParams>) => {
    set(state => ({
      toolParams: { ...state.toolParams, ...newParams }
    }));
  },
  
  // 裁剪相关方法
  setCropMode: (enabled: boolean) => {
    set({ isCropMode: enabled });
  },
  
  setCropArea: (area: CropArea | null) => {
    set({ cropArea: area });
  },
  
  // 拼接模式相关方法
  setCollageMode: (enabled: boolean) => {
    set({ isCollageMode: enabled });
  },
  
  // 视图控制方法
  setZoom: (zoom: number) => {
    const clampedZoom = Math.max(0.01, Math.min(zoom, 10));
    set({ zoom: clampedZoom });
  },
  
  setPan: (pan: { x: number; y: number }) => {
    set({ pan });
  },
  
  resetView: () => {
    set({ zoom: 1, pan: { x: 0, y: 0 } });
  }
}));

export default useEditorStore;