// imageWorker.ts
import type { ImageDataInterface, FilterParams } from '../types';
import { toStandardImageData } from '../types';

// Worker消息接口
interface WorkerMessageEvent {
  type: string;
  payload: {
    canvas?: OffscreenCanvas;
    imageData?: ImageDataInterface;
    action?: string;
    params?: FilterParams;
    isHistoryNavigation?: boolean;
    skipRendering?: boolean;
  };
}

// 声明Worker全局作用域
declare const self: DedicatedWorkerGlobalScope & {
  cv?: any;
  Module?: any;
  importScripts: (url: string) => void;
};

/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 * （注意：此类直接内联在此文件中，以避免在非模块 Worker 中处理导入/导出的复杂性）
 */
class PerformanceTimer {
  private operationName: string;
  private metadata: Record<string, unknown>;
  private steps: Array<{ name: string; elapsed: number }>;
  private startTime: number;
  private lastStepTime: number;

  constructor(operationName: string, metadata: Record<string, unknown> = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.step('start');
  }

  step(stepName: string): void {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

  end(): {
    operation: string;
    operationName: string;
    totalTime: number;
    steps: Array<{ name: string; elapsed: number }>;
    metadata: Record<string, unknown>;
  } {
    this.step('end');
    const totalTime = this.lastStepTime - this.startTime;
    return {
      operation: this.operationName,
      operationName: this.operationName,
      totalTime,
      steps: this.steps,
      metadata: this.metadata,
    };
  }
}

// --- 在 Worker 中运行的高效纯 JS 滤镜 ---

function applySepiaJS(imageData: ImageDataInterface): ImageDataInterface {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (r !== undefined && g !== undefined && b !== undefined) {
      const newR = r * 0.393 + g * 0.769 + b * 0.189;
      const newG = r * 0.349 + g * 0.686 + b * 0.168;
      const newB = r * 0.272 + g * 0.534 + b * 0.131;
      data[i] = Math.min(255, newR);
      data[i + 1] = Math.min(255, newG);
      data[i + 2] = Math.min(255, newB);
    }
  }
  return imageData;
}

function applyGrayscaleJS(imageData: ImageDataInterface): ImageDataInterface {
  const data = imageData.data;
  const LUMINANCE_R = 0.299,
    LUMINANCE_G = 0.587,
    LUMINANCE_B = 0.114;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (r !== undefined && g !== undefined && b !== undefined) {
      const gray = r * LUMINANCE_R + g * LUMINANCE_G + b * LUMINANCE_B;
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
  }
  return imageData;
}

function applyBrightnessJS(
  imageData: ImageDataInterface,
  params?: FilterParams
): ImageDataInterface {
  const data = imageData.data;
  const delta = (params?.delta as number) || 0;
  for (let i = 0; i < data.length; i += 4) {
    const currentR = data[i];
    const currentG = data[i + 1];
    const currentB = data[i + 2];
    if (
      currentR !== undefined &&
      currentG !== undefined &&
      currentB !== undefined
    ) {
      data[i] = Math.max(0, Math.min(255, currentR + delta));
      data[i + 1] = Math.max(0, Math.min(255, currentG + delta));
      data[i + 2] = Math.max(0, Math.min(255, currentB + delta));
    }
  }
  return imageData;
}

function applyContrastJS(
  imageData: ImageDataInterface,
  params?: FilterParams
): ImageDataInterface {
  const data = imageData.data;
  const factor = (params?.factor as number) || 1;
  const intercept = 128 - factor * 128;
  for (let i = 0; i < data.length; i += 4) {
    const currentValueR = data[i];
    const currentValueG = data[i + 1];
    const currentValueB = data[i + 2];
    if (
      currentValueR !== undefined &&
      currentValueG !== undefined &&
      currentValueB !== undefined
    ) {
      data[i] = Math.max(0, Math.min(255, currentValueR * factor + intercept));
      data[i + 1] = Math.max(
        0,
        Math.min(255, currentValueG * factor + intercept)
      );
      data[i + 2] = Math.max(
        0,
        Math.min(255, currentValueB * factor + intercept)
      );
    }
  }
  return imageData;
}

// 纯JS滤镜映射
const pureJsFilters: Record<
  string,
  (imageData: ImageDataInterface, params?: FilterParams) => ImageDataInterface
> = {
  sepia: applySepiaJS,
  grayscale: applyGrayscaleJS,
  brightness: applyBrightnessJS,
  contrast: applyContrastJS,
};

// --- Worker 设置与消息处理 ---

// 使用动态导入解决开发环境中的模块导入问题
let wasmProcessImage:
  | ((
      imageData: ImageDataInterface,
      op: string,
      params: FilterParams,
      ctx: OffscreenCanvasRenderingContext2D,
      timer: PerformanceTimer,
      skipRendering?: boolean
    ) => Promise<ImageDataInterface>)
  | null = null;

// 异步加载wasmBridge模块
const loadWasmBridge = async () => {
  if (!wasmProcessImage) {
    try {
      const wasmBridge = await import('./wasmBridge.js');
      wasmProcessImage = wasmBridge.wasmProcessImage;
    } catch (error) {
      console.error('Failed to load wasmBridge:', error);
      throw error;
    }
  }
  return wasmProcessImage;
};

// 初始化Module
self.Module = {
  noInitialRun: true,
  onRuntimeInitialized: () => {
    self.postMessage({ type: 'opencv-loaded' });
  },
  wasmBinary: null,
};

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

// 异步加载OpenCV
(async () => {
  try {
    const response = await fetch(
      'https://wasm-worker.oss-cn-nanjing.aliyuncs.com/opencv.wasm'
    );
    if (!response.ok) {
      throw new Error(
        `加载 wasm 失败： ${response.status} ${response.statusText}`
      );
    }
    const buffer = await response.arrayBuffer();
    self.Module.wasmBinary = buffer;
    self.importScripts(
      'https://wasm-worker.oss-cn-nanjing.aliyuncs.com/opencv.js'
    );
  } catch (error) {
    console.error('在 worker 中加载 OpenCV 失败:', error);
    self.postMessage({ type: 'error', payload: '初始化 OpenCV 失败。' });
  }
})();

// 消息处理
self.onmessage = async (e: MessageEvent<WorkerMessageEvent>) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      if (payload.canvas) {
        offscreenCanvas = payload.canvas;
        ctx = offscreenCanvas.getContext('2d');
        console.log('Worker: OffscreenCanvas 初始化成功');
        self.postMessage({ type: 'worker-ready' });
      }
      break;

    case 'image-process':
      if (!payload.imageData || !payload.action) {
        self.postMessage({
          type: 'error',
          payload: '缺少必要的图像数据或操作类型',
        });
        return;
      }

      const jsFilter = pureJsFilters[payload.action];

      if (!self.cv && !jsFilter) {
        console.error('OpenCV 尚未准备好。');
        self.postMessage({ type: 'error', payload: 'OpenCV 尚未就绪。' });
        return;
      }

      if (!ctx) {
        console.error('OffscreenCanvas 尚未初始化。');
        self.postMessage({
          type: 'error',
          payload: 'OffscreenCanvas 尚未初始化。',
        });
        return;
      }

      const timer = new PerformanceTimer(payload.action, {
        width: payload.imageData.width,
        height: payload.imageData.height,
      });

      try {
        let resultImageData: ImageDataInterface;

        if (jsFilter) {
          timer.step('js_filter_start');
          // 直接修改了 payload.imageData
          resultImageData = jsFilter(payload.imageData, payload.params);
          timer.step('js_filter_end');

          // 由于 JS 方案不经过 Wasm，需要手动渲染
          ctx.canvas.width = resultImageData.width;
          ctx.canvas.height = resultImageData.height;

          // 新增：如果有skipRendering标记，跳过绘制到canvas
          if (!payload.skipRendering) {
            ctx.putImageData(toStandardImageData(resultImageData), 0, 0);
            timer.step('render_to_offscreen');
          }
        } else {
          // 对于所有其他操作，使用 WebAssembly
          // 确保wasmBridge已加载
          const wasmProcessor = await loadWasmBridge();
          if (!wasmProcessor) {
            throw new Error('WASM处理器加载失败');
          }

          resultImageData = await wasmProcessor(
            payload.imageData,
            payload.action,
            payload.params || {},
            ctx,
            timer,
            payload.skipRendering // 传递skipRendering参数给wasmProcessImage
          );
        }

        timer.step('image_processed_in_worker');
        const perfLog = timer.end();

        self.postMessage(
          {
            type: 'image-processed',
            payload: {
              imageData: resultImageData,
              isHistoryNavigation: payload.isHistoryNavigation || false,
              perfLog: perfLog,
            },
          },
          [resultImageData.data.buffer]
        );
      } catch (error) {
        console.error('图像处理时发生错误:', error);
        const errorMessage =
          error instanceof Error ? error.message : '未知错误';
        self.postMessage({ type: 'error', payload: errorMessage });
      }
      break;

    default:
      console.warn(`未知的Worker消息类型: ${type}`);
      break;
  }
};
