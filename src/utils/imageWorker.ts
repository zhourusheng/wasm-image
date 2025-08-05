// imageWorker.ts
// 按照技术文档方案实现 - 使用经典Worker + importScripts

// 图像数据接口 - 兼容标准ImageData
interface ImageDataInterface {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace?: PredefinedColorSpace;
}

// 滤镜参数接口
interface FilterParams {
  [key: string]: number | string | boolean;
}

// 转换为标准ImageData的辅助函数
function toStandardImageData(imgData: ImageDataInterface): ImageData {
  // 检查SharedArrayBuffer是否可用
  const isSharedArrayBufferAvailable = typeof SharedArrayBuffer !== 'undefined';

  // 确保 data 是 ArrayBuffer 而不是 SharedArrayBuffer
  const buffer = imgData.data.buffer;
  let uint8Array: Uint8ClampedArray;

  if (isSharedArrayBufferAvailable && buffer instanceof SharedArrayBuffer) {
    // 如果SharedArrayBuffer可用且buffer是SharedArrayBuffer，则复制数据
    uint8Array = new Uint8ClampedArray(buffer.slice(0));
  } else {
    // 否则直接使用原始buffer
    uint8Array = new Uint8ClampedArray(
      buffer,
      imgData.data.byteOffset,
      imgData.data.length
    );
  }

  // 使用类型断言来避免 TypeScript 的严格类型检查
  return new (ImageData as any)(uint8Array, imgData.width, imgData.height, {
    colorSpace: imgData.colorSpace,
  });
}

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

/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
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

// 引入wasmBridge处理函数
// 注意：在Worker环境中，我们需要直接内联wasmBridge的代码，避免import问题
async function processWithWasm(
  imageData: ImageDataInterface,
  action: string,
  params?: FilterParams
): Promise<ImageDataInterface> {
  // 直接调用wasmBridge逻辑
  if (!self.cv) {
    throw new Error('OpenCV未初始化');
  }

  const src = self.cv.matFromImageData(imageData);
  let dst: any;

  try {
    switch (action) {
      case 'crop': {
        const { x, y, width, height } = params as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        const rect = new self.cv.Rect(x, y, width, height);
        dst = src.roi(rect);
        break;
      }

      case 'rotate': {
        const { angle } = params as { angle: number };
        const center = new self.cv.Point(src.cols / 2, src.rows / 2);
        const rotationMatrix = self.cv.getRotationMatrix2D(center, angle, 1.0);

        // 计算旋转后的图像尺寸
        const radians = (angle * Math.PI) / 180;
        const cos = Math.abs(Math.cos(radians));
        const sin = Math.abs(Math.sin(radians));
        const newWidth = Math.round(src.cols * cos + src.rows * sin);
        const newHeight = Math.round(src.cols * sin + src.rows * cos);

        // 调整变换矩阵以居中图像
        rotationMatrix.data64F[2] += newWidth / 2 - src.cols / 2;
        rotationMatrix.data64F[5] += newHeight / 2 - src.rows / 2;

        dst = new self.cv.Mat();
        const dsize = new self.cv.Size(newWidth, newHeight);
        self.cv.warpAffine(src, dst, rotationMatrix, dsize);

        rotationMatrix.delete();
        break;
      }

      case 'flip': {
        const { mode } = params as { mode: number };
        dst = new self.cv.Mat();
        self.cv.flip(src, dst, mode);
        break;
      }

      case 'brightness': {
        const { delta } = params as { delta: number };
        dst = new self.cv.Mat();
        const deltaMat = new self.cv.Mat(
          src.rows,
          src.cols,
          src.type(),
          new self.cv.Scalar(delta, delta, delta, 0)
        );
        self.cv.add(src, deltaMat, dst);
        deltaMat.delete();
        break;
      }

      case 'contrast': {
        const { factor } = params as { factor: number };
        dst = new self.cv.Mat();
        src.convertTo(dst, -1, factor, 0);
        break;
      }

      case 'saturation': {
        const { factor } = params as { factor: number };
        const rgb = new self.cv.Mat();
        self.cv.cvtColor(src, rgb, self.cv.COLOR_RGBA2RGB);
        const srcChannels = new self.cv.MatVector();
        self.cv.split(src, srcChannels);
        const alpha = new self.cv.Mat();
        srcChannels.get(3).copyTo(alpha);
        const hsv = new self.cv.Mat();
        self.cv.cvtColor(rgb, hsv, self.cv.COLOR_RGB2HSV);
        const hsvChannels = new self.cv.MatVector();
        self.cv.split(hsv, hsvChannels);
        const satChannel = hsvChannels.get(1);
        satChannel.convertTo(satChannel, -1, factor, 0);
        self.cv.merge(hsvChannels, hsv);
        self.cv.cvtColor(hsv, rgb, self.cv.COLOR_HSV2RGB);
        dst = new self.cv.Mat();
        self.cv.cvtColor(rgb, dst, self.cv.COLOR_RGB2RGBA);
        const dstChannels = new self.cv.MatVector();
        self.cv.split(dst, dstChannels);
        const oldAlpha = dstChannels.get(3);
        dstChannels.set(3, alpha);
        self.cv.merge(dstChannels, dst);
        rgb.delete();
        srcChannels.delete();
        hsv.delete();
        hsvChannels.delete();
        dstChannels.delete();
        oldAlpha.delete();
        alpha.delete();
        break;
      }

      case 'colorBalance': {
        const { red, green, blue } = params as {
          red: number;
          green: number;
          blue: number;
        };

        // 分离RGBA通道
        const channels = new self.cv.MatVector();
        self.cv.split(src, channels);

        // 调整各通道
        if (red !== 0) {
          const rChannel = channels.get(0);
          rChannel.convertTo(rChannel, -1, 1, red);
        }
        if (green !== 0) {
          const gChannel = channels.get(1);
          gChannel.convertTo(gChannel, -1, 1, green);
        }
        if (blue !== 0) {
          const bChannel = channels.get(2);
          bChannel.convertTo(bChannel, -1, 1, blue);
        }

        dst = new self.cv.Mat();
        self.cv.merge(channels, dst);
        channels.delete();
        break;
      }

      case 'blur': {
        const { ksize = 5 } = params as { ksize?: number };
        // 确保 ksize 是奇数，符合高斯模糊要求
        const validKsize = ksize % 2 === 0 ? ksize + 1 : ksize;
        dst = new self.cv.Mat();
        const kernelSize = new self.cv.Size(validKsize, validKsize);
        // 使用高斯模糊，性能优于普通模糊
        self.cv.GaussianBlur(src, dst, kernelSize, 0);
        break;
      }

      // grayscale 操作由纯JS处理，性能更优

      case 'canny': {
        const { threshold1 = 50, threshold2 = 150 } = params as {
          threshold1?: number;
          threshold2?: number;
        };
        const rgb = new self.cv.Mat();
        self.cv.cvtColor(src, rgb, self.cv.COLOR_RGBA2RGB);
        const srcChannels = new self.cv.MatVector();
        self.cv.split(src, srcChannels);
        const alpha = new self.cv.Mat();
        srcChannels.get(3).copyTo(alpha);
        const gray = new self.cv.Mat();
        self.cv.cvtColor(rgb, gray, self.cv.COLOR_RGB2GRAY);
        const edges = new self.cv.Mat();
        self.cv.Canny(gray, edges, threshold1, threshold2);
        dst = new self.cv.Mat();
        self.cv.cvtColor(edges, dst, self.cv.COLOR_GRAY2RGBA);
        const dstChannels = new self.cv.MatVector();
        self.cv.split(dst, dstChannels);
        const oldAlpha = dstChannels.get(3);
        dstChannels.set(3, alpha);
        self.cv.merge(dstChannels, dst);
        rgb.delete();
        srcChannels.delete();
        gray.delete();
        edges.delete();
        dstChannels.delete();
        oldAlpha.delete();
        alpha.delete();
        break;
      }

      case 'threshold': {
        const {
          thresh = 127,
          maxval = 255,
          type = 0,
        } = params as { thresh?: number; maxval?: number; type?: number };
        const rgb = new self.cv.Mat();
        self.cv.cvtColor(src, rgb, self.cv.COLOR_RGBA2RGB);
        const srcChannels = new self.cv.MatVector();
        self.cv.split(src, srcChannels);
        const alpha = new self.cv.Mat();
        srcChannels.get(3).copyTo(alpha);
        const gray = new self.cv.Mat();
        self.cv.cvtColor(rgb, gray, self.cv.COLOR_RGB2GRAY);
        const thresholded = new self.cv.Mat();
        self.cv.threshold(gray, thresholded, thresh, maxval, type);
        dst = new self.cv.Mat();
        self.cv.cvtColor(thresholded, dst, self.cv.COLOR_GRAY2RGBA);
        const dstChannels = new self.cv.MatVector();
        self.cv.split(dst, dstChannels);
        const oldAlpha = dstChannels.get(3);
        dstChannels.set(3, alpha);
        self.cv.merge(dstChannels, dst);
        rgb.delete();
        srcChannels.delete();
        gray.delete();
        thresholded.delete();
        dstChannels.delete();
        oldAlpha.delete();
        alpha.delete();
        break;
      }

      case 'emboss': {
        const kernel = self.cv.matFromArray(
          3,
          3,
          self.cv.CV_32FC1,
          [-2, -1, 0, -1, 1, 1, 0, 1, 2]
        );
        dst = new self.cv.Mat();
        self.cv.filter2D(src, dst, -1, kernel);
        kernel.delete();
        break;
      }

      // sepia 操作由纯JS处理，性能更优

      case 'sharpen': {
        const kernel = self.cv.matFromArray(
          3,
          3,
          self.cv.CV_32FC1,
          [0, -1, 0, -1, 5, -1, 0, -1, 0]
        );
        dst = new self.cv.Mat();
        self.cv.filter2D(src, dst, -1, kernel);
        kernel.delete();
        break;
      }

      case 'compress': {
        // 压缩操作主要是调整质量，这里直接返回原图像
        // 实际的压缩会在导出时处理
        dst = src.clone();
        break;
      }

      default:
        throw new Error(`不支持的操作: ${action}`);
    }

    // 转换回ImageData
    const resultImageData = new ImageData(
      new Uint8ClampedArray(dst.data),
      dst.cols,
      dst.rows
    ) as ImageDataInterface;

    src.delete();
    dst.delete();

    return resultImageData;
  } catch (error) {
    src.delete();
    if (dst) dst.delete();
    throw error;
  }
}

// 初始化Module - 按照技术文档方案
(self as any).Module = {
  noInitialRun: true,
  onRuntimeInitialized: () => {
    self.postMessage({ type: 'opencv-loaded' });
  },
};

let offscreenCanvas: OffscreenCanvas | null = null;
let ctx: OffscreenCanvasRenderingContext2D | null = null;

// 按照技术文档方案 - 异步加载OpenCV
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
    (self as any).Module.wasmBinary = buffer;
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

    case 'image-process': {
      if (!payload.imageData || !payload.action) {
        self.postMessage({
          type: 'error',
          payload: '缺少必要的图像数据或操作类型',
        });
        return;
      }

      const jsFilter = pureJsFilters[payload.action];

      // 处理original操作（直接返回原图）
      if (payload.action === 'original') {
        const timer = new PerformanceTimer('original', {
          width: payload.imageData.width,
          height: payload.imageData.height,
        });

        timer.step('original_start');
        const resultImageData = payload.imageData;
        timer.step('original_end');

        // 渲染到canvas
        if (ctx) {
          ctx.canvas.width = resultImageData.width;
          ctx.canvas.height = resultImageData.height;
          ctx.putImageData(toStandardImageData(resultImageData), 0, 0);
          timer.step('render_to_offscreen');
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
        return;
      }

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
          timer.step('js_engine_start');
          console.log(`🚀 [纯JS引擎] 开始处理: ${payload.action}`);
          // 直接修改了 payload.imageData
          resultImageData = jsFilter(payload.imageData, payload.params);
          timer.step('js_engine_end');

          // 由于 JS 方案不经过 Wasm，需要手动渲染
          ctx.canvas.width = resultImageData.width;
          ctx.canvas.height = resultImageData.height;

          // 新增：如果有skipRendering标记，跳过绘制到canvas
          if (!payload.skipRendering) {
            ctx.putImageData(toStandardImageData(resultImageData), 0, 0);
            timer.step('render_to_offscreen');
          }
          console.log(`✅ [纯JS引擎] 完成处理: ${payload.action}`);
        } else if (self.cv) {
          // 使用OpenCV/WASM处理
          timer.step('wasm_engine_start');
          console.log(`⚡ [WASM引擎] 开始处理: ${payload.action} (OpenCV.js)`);
          resultImageData = await processWithWasm(
            payload.imageData,
            payload.action,
            payload.params
          );
          timer.step('wasm_engine_end');

          // 渲染到canvas
          ctx.canvas.width = resultImageData.width;
          ctx.canvas.height = resultImageData.height;

          if (!payload.skipRendering) {
            ctx.putImageData(toStandardImageData(resultImageData), 0, 0);
            timer.step('render_to_offscreen');
          }
          console.log(`🎯 [WASM引擎] 完成处理: ${payload.action}`);
        } else {
          // OpenCV未准备好，返回原图
          console.warn(
            `⚠️ [降级处理] OpenCV未准备好，操作 ${payload.action} 暂不支持，返回原图`
          );
          resultImageData = payload.imageData;
        }

        timer.step('image_processed_in_worker');
        const perfLog = timer.end();

        // 添加引擎信息到性能日志
        const engineType = jsFilter
          ? 'JavaScript'
          : self.cv
            ? 'WebAssembly (OpenCV.js)'
            : 'Fallback';
        const enhancedPerfLog = {
          ...perfLog,
          engine: engineType,
          metadata: {
            ...perfLog.metadata,
            processingEngine: engineType,
          },
        };

        // 在控制台输出详细的性能报告
        console.log(
          `📊 [性能报告] ${payload.action} | 引擎: ${engineType} | 耗时: ${perfLog.totalTime.toFixed(2)}ms`
        );

        self.postMessage(
          {
            type: 'image-processed',
            payload: {
              imageData: resultImageData,
              isHistoryNavigation: payload.isHistoryNavigation || false,
              perfLog: enhancedPerfLog,
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
    }

    default:
      console.warn(`未知的Worker消息类型: ${type}`);
      break;
  }
};
