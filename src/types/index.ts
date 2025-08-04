// 全局类型定义文件

// 图像数据接口 - 兼容标准ImageData
export interface ImageDataInterface {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace?: PredefinedColorSpace; // 兼容标准ImageData
}

// 滤镜参数接口
export interface FilterParams {
  [key: string]: number | string | boolean;
}

// 性能监控接口
export interface PerformanceMetrics {
  operation: string;
  totalTime: number;
  steps: Array<{ name: string; elapsed: number }>;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

// Worker 消息类型
export interface WorkerMessage {
  type: string;
  payload?: unknown;
  id?: string;
  error?: string;
}

// 图像处理操作类型
export type ImageOperation =
  | 'grayscale'
  | 'sepia'
  | 'brightness'
  | 'contrast'
  | 'blur'
  | 'sharpen'
  | 'canny'
  | 'threshold'
  | 'crop'
  | 'rotate'
  | 'flip';

// 导出格式类型
export type ExportFormat = 'png' | 'jpeg' | 'webp';

// 导出参数接口
export interface ExportParams {
  format: ExportFormat;
  quality: number;
  scale: number;
  width?: number;
  height?: number;
}

// 导出预览接口
export interface ExportPreview {
  blob: Blob;
  size: number;
  url: string;
  format: ExportFormat;
  quality: number;
  dimensions: {
    width: number;
    height: number;
  };
}

// 历史记录项接口
export interface HistoryItem {
  id: string;
  imageData: ImageDataInterface;
  operation?: string;
  params?: FilterParams;
  timestamp: number;
}

// 工具类型
export type ToolType =
  | 'crop'
  | 'rotate'
  | 'flip'
  | 'filter'
  | 'brightness'
  | 'contrast'
  | 'blur'
  | 'sharpen'
  | 'saturation'
  | 'colorBalance'
  | 'compress'
  | null;

// 裁剪区域接口
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// 拼贴项接口
export interface CollageItem {
  id: string;
  imageData: ImageDataInterface;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  rotation: number;
  zIndex: number;
}

// 设备信息接口
export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  orientation: 'portrait' | 'landscape';
  pixelRatio: number;
  touchSupport: boolean;
}

// 特性检测结果接口
export interface FeatureSupport {
  webAssembly: boolean;
  offscreenCanvas: boolean;
  webWorkers: boolean;
  sharedArrayBuffer: boolean;
  webGL: boolean;
  webGPU: boolean;
}

// Zustand Store 状态接口
export interface ImageStoreState {
  currentImage: ImageDataInterface | null;
  originalImage: ImageDataInterface | null;
  history: HistoryItem[];
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  // 方法
  setImage: (imageData: ImageDataInterface) => void;
  updateImage: (
    imageData: ImageDataInterface,
    operation?: string,
    params?: FilterParams
  ) => void;
  undo: () => ImageDataInterface | null;
  redo: () => ImageDataInterface | null;
  clearHistory: () => void;
}

export interface EditorStoreState {
  // 状态
  workerReady: boolean;
  opencvLoaded: boolean;
  imageWorker: Worker | null;
  activeTool: ToolType;
  toolParams: FilterParams;
  isCropMode: boolean;
  isCollageMode: boolean;
  cropArea: CropArea | null;
  zoom: number;
  pan: { x: number; y: number };
  // 方法
  setWorkerReady: (ready: boolean) => void;
  setOpenCVLoaded: (loaded: boolean) => void;
  setImageWorker: (worker: Worker | null) => void;
  setActiveTool: (tool: ToolType, defaultParams?: FilterParams) => void;
  updateToolParams: (params: Partial<FilterParams>) => void;
  setCropMode: (enabled: boolean) => void;
  setCollageMode: (enabled: boolean) => void;
  setCropArea: (area: CropArea | null) => void;
  setZoom: (zoom: number) => void;
  setPan: (pan: { x: number; y: number }) => void;
  resetView: () => void;
}

export interface UIStoreState {
  // 状态
  loading: boolean;
  loadingText: string;
  showExportPanel: boolean;
  showParamsPanel: boolean;
  darkMode: boolean;
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  }>;
  exportPreview: ExportPreview | null;
  deviceInfo: DeviceInfo;
  featureSupport: FeatureSupport;
  // 方法
  setLoading: (loading: boolean, text?: string) => void;
  showNotification: (
    type: 'success' | 'error' | 'warning' | 'info',
    message: string
  ) => void;
  hideNotification: (id: string) => void;
  toggleExportPanel: () => void;
  toggleParamsPanel: () => void;
  toggleDarkMode: () => void;
  setExportPreview: (preview: ExportPreview | null) => void;
  updateDeviceInfo: (info: Partial<DeviceInfo>) => void;
  updateFeatureSupport: (support: Partial<FeatureSupport>) => void;
  generateExportPreview: (
    imageData: ImageDataInterface,
    params: ExportParams
  ) => Promise<void>;
}

export interface CollageStoreState {
  // 状态
  items: CollageItem[];
  selectedItemId: string | null;
  canvasSize: { width: number; height: number };
  backgroundGolor: string;
  // 方法
  addItem: (imageData: ImageDataInterface) => void;
  removeItem: (id: string) => void;
  updateItem: (id: string, updates: Partial<CollageItem>) => void;
  selectItem: (id: string | null) => void;
  reorderItem: (id: string, newZIndex: number) => void;
  setCanvasSize: (size: { width: number; height: number }) => void;
  setBackgroundColor: (color: string) => void;
  clearCanvas: () => void;
  exportCollage: () => Promise<ImageDataInterface>;
}

// React 组件 Props 接口
export interface CanvasProps {
  imageData: ImageDataInterface | null;
  zoom: number;
  pan: { x: number; y: number };
  cropArea: CropArea | null;
  onImageLoad?: (imageData: ImageDataInterface) => void;
  onCropAreaChange?: (area: CropArea | null) => void;
}

export interface ToolbarProps {
  activeTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  disabled?: boolean;
}

export interface ParamsPanelProps {
  visible: boolean;
  tool: ToolType;
  params: FilterParams;
  onParamsChange: (params: FilterParams) => void;
  onApply: () => void;
  onCancel: () => void;
}

export interface ExportPanelProps {
  visible: boolean;
  imageData: ImageDataInterface | null;
  preview: ExportPreview | null;
  onExport: (params: ExportParams) => void;
  onClose: () => void;
}

// 高级类型工具
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// 工具函数类型
export type AsyncFunction<T = void, U = unknown> = (...args: U[]) => Promise<T>;
export type EventCallback<T = unknown> = (event: T) => void;
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T = keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// Canvas 上下文类型扩展
export interface CanvasRenderingContext2D {
  webkitImageSmoothingEnabled?: boolean;
  mozImageSmoothingEnabled?: boolean;
  msImageSmoothingEnabled?: boolean;
}

// Web Worker 全局类型扩展
declare global {
  interface Window {
    cv?: any; // OpenCV.js 全局对象
    webkitRequestAnimationFrame?: typeof requestAnimationFrame;
    mozRequestAnimationFrame?: typeof requestAnimationFrame;
    msRequestAnimationFrame?: typeof requestAnimationFrame;
  }

  interface WorkerGlobalScope {
    cv?: any; // OpenCV.js 在 Worker 中的全局对象
    Module?: any; // WebAssembly Module
  }
}

// 错误类型
export class ImageProcessingError extends Error {
  constructor(
    message: string,
    public operation?: string,
    public params?: FilterParams
  ) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

export class WorkerError extends Error {
  constructor(
    message: string,
    public workerType?: string
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}
