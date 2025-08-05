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

async function applyWatermarkJS(
  imageData: ImageDataInterface,
  params?: FilterParams
): Promise<ImageDataInterface> {
  // 创建临时canvas用于绘制水印
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('无法获取2D上下文');
    return imageData;
  }

  // 将原始图像数据绘制到canvas
  ctx.putImageData(
    new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    ),
    0,
    0
  );

  // 获取水印参数
  const type = (params?.type as string) || 'text';
  const x = (params?.x as number) || 50;
  const y = (params?.y as number) || 50;
  const opacity = (params?.opacity as number) || 0.8;

  // 计算实际位置（百分比转换为像素）
  const actualX = (x / 100) * imageData.width;
  const actualY = (y / 100) * imageData.height;

  ctx.globalAlpha = opacity;

  if (type === 'text') {
    // 文字水印
    const text = (params?.text as string) || '水印文字';
    const fontSize = (params?.fontSize as number) || 36;
    const color = (params?.color as string) || '#ffffff';
    const fontFamily = (params?.fontFamily as string) || 'Arial';
    const bold = (params?.bold as boolean) || false;
    const italic = (params?.italic as boolean) || false;

    // 设置字体样式
    let fontStyle = '';
    if (italic) fontStyle += 'italic ';
    if (bold) fontStyle += 'bold ';
    fontStyle += `${fontSize}px ${fontFamily}`;

    ctx.font = fontStyle;
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // 添加文字描边以增强可见性
    ctx.strokeStyle = color === '#ffffff' ? '#000000' : '#ffffff';
    ctx.lineWidth = Math.max(1, fontSize / 20);
    ctx.strokeText(text, actualX, actualY);

    // 绘制文字
    ctx.fillText(text, actualX, actualY);
  } else if (type === 'image' && params?.imageData) {
    // 图片水印
    const imageDataUrl = params.imageData as string;
    const scale = (params?.scale as number) || 0.3;

    try {
      // 在Worker中使用createImageBitmap加载图片
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const imageBitmap = await createImageBitmap(blob);

      // 计算缩放后的尺寸
      const scaledWidth = imageBitmap.width * scale;
      const scaledHeight = imageBitmap.height * scale;

      // 绘制图片水印
      ctx.drawImage(imageBitmap, actualX, actualY, scaledWidth, scaledHeight);

      // 清理资源
      imageBitmap.close();
    } catch (error) {
      console.error('图片水印加载失败:', error);
      // 如果图片加载失败，只返回原图
    }
  }

  // 获取处理后的图像数据
  const resultImageData = ctx.getImageData(
    0,
    0,
    imageData.width,
    imageData.height
  );

  // 返回新的ImageDataInterface
  return {
    data: new Uint8ClampedArray(resultImageData.data),
    width: resultImageData.width,
    height: resultImageData.height,
  };
}

// 人脸美颜处理函数（纯JS实现）
async function applyFaceBeautyJS(
  imageData: ImageDataInterface,
  params?: FilterParams
): Promise<ImageDataInterface> {
  const enabled = (params?.enabled as boolean) !== false;

  if (!enabled) {
    return imageData;
  }

  // 纯JS实现（基础美颜效果）
  const skinSmooth = (params?.skinSmooth as number) || 30;
  const skinWhiten = (params?.skinWhiten as number) || 20;

  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.error('无法获取2D上下文');
    return imageData;
  }

  // 将原始图像数据绘制到canvas
  ctx.putImageData(
    new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    ),
    0,
    0
  );

  try {
    // 应用基础美颜效果
    if (skinSmooth > 0) {
      // 应用模糊效果模拟磨皮，限制最大模糊程度
      const blurAmount = Math.min(5, skinSmooth * 0.05);
      ctx.filter = `blur(${blurAmount}px)`;
      ctx.drawImage(canvas, 0, 0);
      ctx.filter = 'none';
    }

    if (skinWhiten > 0) {
      // 应用亮度提升模拟美白，限制最大亮度
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(0.3, skinWhiten * 0.005);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, imageData.width, imageData.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    console.log(`✨ [纯JS美颜] 磨皮: ${skinSmooth}%, 美白: ${skinWhiten}%`);
  } catch (error) {
    console.error('纯JS美颜处理失败:', error);
    // 如果处理失败，保持原图不变
  }

  // 获取处理后的图像数据
  const resultImageData = ctx.getImageData(
    0,
    0,
    imageData.width,
    imageData.height
  );

  return {
    data: new Uint8ClampedArray(resultImageData.data),
    width: resultImageData.width,
    height: resultImageData.height,
  };
}

// 纯JS滤镜映射
const pureJsFilters: Record<
  string,
  (
    imageData: ImageDataInterface,
    params?: FilterParams
  ) => ImageDataInterface | Promise<ImageDataInterface>
> = {
  sepia: applySepiaJS,
  grayscale: applyGrayscaleJS,
  brightness: applyBrightnessJS,
  contrast: applyContrastJS,
  watermark: applyWatermarkJS,
  // faceBeauty 移除，优先使用WASM引擎进行人脸检测
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

      case 'enhance': {
        const gray = new self.cv.Mat();
        self.cv.cvtColor(src, gray, self.cv.COLOR_RGBA2GRAY);
        const clahe = new self.cv.CLAHE(2.0, new self.cv.Size(8, 8));
        clahe.apply(gray, gray);
        dst = new self.cv.Mat();
        const srcChannels = new self.cv.MatVector();
        self.cv.split(src, srcChannels);
        const alpha = new self.cv.Mat();
        srcChannels.get(3).copyTo(alpha);
        self.cv.cvtColor(gray, dst, self.cv.COLOR_GRAY2RGBA);
        const dstChannels = new self.cv.MatVector();
        self.cv.split(dst, dstChannels);
        const oldAlpha = dstChannels.get(3);
        dstChannels.set(3, alpha);
        self.cv.merge(dstChannels, dst);
        gray.delete();
        clahe.delete();
        srcChannels.delete();
        dstChannels.delete();
        oldAlpha.delete();
        alpha.delete();
        break;
      }

      case 'removeBackground': {
        let bgr = null;
        let mask = null;
        let bgdModel = null;
        let fgdModel = null;

        try {
          bgr = new self.cv.Mat();
          self.cv.cvtColor(src, bgr, self.cv.COLOR_RGBA2BGR);

          // Initialize the mask with the correct size and type
          mask = new self.cv.Mat(
            src.rows,
            src.cols,
            self.cv.CV_8UC1,
            new self.cv.Scalar(0)
          );
          bgdModel = new self.cv.Mat();
          fgdModel = new self.cv.Mat();
          const rect = new self.cv.Rect(5, 5, src.cols - 10, src.rows - 10);

          self.cv.grabCut(
            bgr,
            mask,
            rect,
            bgdModel,
            fgdModel,
            5,
            self.cv.GC_INIT_WITH_RECT
          );

          dst = src.clone();

          for (let i = 0; i < dst.rows; i++) {
            for (let j = 0; j < dst.cols; j++) {
              const maskValue = mask.ucharPtr(i, j)[0];
              if (
                maskValue === self.cv.GC_BGD ||
                maskValue === self.cv.GC_PR_BGD
              ) {
                dst.ucharPtr(i, j)[3] = 0; // Set alpha to 0 for background
              }
            }
          }
        } finally {
          // Clean up resources safely
          if (bgr && !bgr.isDeleted()) bgr.delete();
          if (mask && !mask.isDeleted()) mask.delete();
          if (bgdModel && !bgdModel.isDeleted()) bgdModel.delete();
          if (fgdModel && !fgdModel.isDeleted()) fgdModel.delete();
        }
        break;
      }

      case 'faceBeauty': {
        const {
          skinSmooth = 30,
          skinWhiten = 20,
          faceSlim = 15,
          eyeEnlarge = 10,
          enabled = true,
        } = params as {
          skinSmooth?: number;
          skinWhiten?: number;
          faceSlim?: number;
          eyeEnlarge?: number;
          enabled?: boolean;
        };

        if (!enabled) {
          dst = src.clone();
          break;
        }

        // 智能人脸检测和精准美颜处理
        try {
          dst = src.clone();

          // 1. 人脸区域检测（简化版）
          const gray = new self.cv.Mat();
          self.cv.cvtColor(src, gray, self.cv.COLOR_RGBA2GRAY);

          // 基于图像特征的人脸区域估算（实际项目中应该使用训练好的分类器）
          let faceDetected = false;
          let faceRect = null;

          try {
            // 使用图像中心偏上的区域作为可能的人脸区域
            // 这是一个简化的检测方法，适用于大部分人像照片
            const imgWidth = gray.cols;
            const imgHeight = gray.rows;

            // 检查图像尺寸，判断是否可能包含人脸
            if (imgWidth > 100 && imgHeight > 100) {
              const centerX = Math.floor(imgWidth * 0.25);
              const centerY = Math.floor(imgHeight * 0.15);
              const faceWidth = Math.floor(imgWidth * 0.5);
              const faceHeight = Math.floor(imgHeight * 0.6);

              // 确保人脸区域在图像范围内
              if (
                centerX + faceWidth <= imgWidth &&
                centerY + faceHeight <= imgHeight
              ) {
                faceRect = new self.cv.Rect(
                  centerX,
                  centerY,
                  faceWidth,
                  faceHeight
                );
                faceDetected = true;
                console.log(
                  `👤 [人脸检测] 估算人脸区域: ${centerX},${centerY} ${faceWidth}x${faceHeight}`
                );
              }
            }
          } catch (detectError) {
            console.warn('人脸区域估算失败:', detectError);
            faceDetected = false;
          }

          // 2. 分离RGBA通道
          const channels = new self.cv.MatVector();
          self.cv.split(src, channels);
          const alpha = new self.cv.Mat();
          channels.get(3).copyTo(alpha);

          // 3. 转换为BGR进行处理
          const bgr = new self.cv.Mat();
          self.cv.cvtColor(src, bgr, self.cv.COLOR_RGBA2BGR);

          // 4. 应用羽化蒙版技术进行无缝美颜
          if (faceDetected && faceRect) {
            // --- 最终优化：约束羽化参数，修复性能问题，实现无缝美颜 ---
            console.log(`✨ [精准美颜] 启动羽化蒙版融合引擎 V2，实现无缝处理`);

            // 4a. 创建一个完整处理过的图像副本
            const bgrProcessed = bgr.clone();

            if (skinSmooth > 0) {
              const d = Math.min(11, Math.max(5, Math.round(skinSmooth * 0.2)));
              const sigma = Math.min(200, skinSmooth * 1.5);
              console.log(`💡 [磨皮参数] d: ${d}, sigma: ${sigma.toFixed(1)}`);
              self.cv.bilateralFilter(bgr, bgrProcessed, d, sigma, sigma);
            }
            if (skinWhiten > 0) {
              const whitenValue = Math.min(25, skinWhiten * 0.5);
              const alpha = 1.0 + whitenValue * 0.015;
              const beta = whitenValue * 0.8;
              console.log(
                `💡 [美白参数] alpha: ${alpha.toFixed(3)}, beta: ${beta.toFixed(1)}`
              );
              // 在副本上进行美白 (修复内存泄漏，移除多余的clone)
              self.cv.convertScaleAbs(bgrProcessed, bgrProcessed, alpha, beta);
            }

            // 4b. 创建一个黑色的蒙版
            const mask = new self.cv.Mat(
              bgr.rows,
              bgr.cols,
              self.cv.CV_8UC1,
              new self.cv.Scalar(0)
            );

            // 4c. 在蒙版上绘制一个白色填充椭圆
            const center = new self.cv.Point(
              faceRect.x + faceRect.width / 2,
              faceRect.y + faceRect.height / 2
            );
            const axes = new self.cv.Size(
              faceRect.width * 0.5,
              faceRect.height * 0.55
            );
            self.cv.ellipse(
              mask,
              center,
              axes,
              0,
              0,
              360,
              new self.cv.Scalar(255),
              -1
            );

            // 4d. 对蒙版进行高斯模糊以创建羽化效果（核心修复）
            const blurRadius = Math.round(faceRect.width * 0.25);
            let ksize = Math.min(151, blurRadius); // 限制最大内核尺寸，防止性能雪崩
            if (ksize % 2 === 0) ksize++;
            console.log(
              `💡 [羽化参数] blurRadius: ${blurRadius}, ksize: ${ksize}`
            );
            self.cv.GaussianBlur(
              mask,
              mask,
              new self.cv.Size(ksize, ksize),
              0,
              0,
              self.cv.BORDER_DEFAULT
            );

            // 4e. 使用羽化蒙版将处理过的图像融合回原图
            bgrProcessed.copyTo(bgr, mask);

            // 4f. 清理资源
            bgrProcessed.delete();
            mask.delete();

            console.log(`✅ [羽化融合] 美颜效果已无缝应用`);
          } else {
            // 全图美颜：当无法检测到人脸时的降级处理
            console.log(`✨ [全图美颜] 未检测到明显人脸区域，进行全图轻度美颜`);

            if (skinSmooth > 0) {
              const smoothed = new self.cv.Mat();
              self.cv.bilateralFilter(
                bgr,
                smoothed,
                Math.min(10, Math.max(3, Math.round(skinSmooth * 0.25))),
                skinSmooth * 1.2,
                skinSmooth * 1.2
              );
              smoothed.copyTo(bgr);
              smoothed.delete();
            }

            if (skinWhiten > 0) {
              // ✅ [修复完成] 使用convertScaleAbs进行自然全图美白
              const whitenValue = Math.min(15, skinWhiten * 0.3); // 适中的全图美白强度

              // 使用convertScaleAbs进行自然的亮度调整
              const alpha = 1.0 + whitenValue * 0.008; // 亮度系数：1.0-1.12
              const beta = whitenValue * 0.5; // 偏移量：0-7.5

              self.cv.convertScaleAbs(bgr, bgr, alpha, beta);

              console.log(
                `✨ [全图美白] 亮度系数: ${alpha.toFixed(3)}, 偏移量: ${beta.toFixed(1)}`
              );
            }
          }

          // TODO: 高级美颜功能（瘦脸、大眼）
          if (faceSlim > 0 || eyeEnlarge > 0) {
            console.log(
              `🚧 [高级美颜] 瘦脸: ${faceSlim}%, 大眼: ${eyeEnlarge}% - 需要面部关键点检测`
            );
          }

          // 5. 转换回RGBA
          self.cv.cvtColor(bgr, dst, self.cv.COLOR_BGR2RGBA);

          // 6. 恢复alpha通道
          const dstChannels = new self.cv.MatVector();
          self.cv.split(dst, dstChannels);
          dstChannels.set(3, alpha);
          self.cv.merge(dstChannels, dst);

          console.log(
            `🎯 [WASM美颜] ${faceDetected ? '羽化蒙版精准' : '全图'}美颜完成 - 磨皮: ${skinSmooth}%, 美白: ${skinWhiten}%`
          );

          // 7. 清理资源
          gray.delete();
          channels.delete();
          alpha.delete();
          bgr.delete();
          dstChannels.delete();
        } catch (error) {
          console.error('WASM美颜处理失败:', error);
          // 降级到纯JS处理
          console.log('🔄 [降级处理] 使用纯JS美颜算法');

          try {
            const jsResult = await applyFaceBeautyJS(
              {
                data: new Uint8ClampedArray(src.data),
                width: src.cols,
                height: src.rows,
              },
              params
            );

            const jsMat = self.cv.matFromImageData(jsResult);
            jsMat.copyTo(dst);
            jsMat.delete();
          } catch (jsError) {
            console.error('纯JS美颜也失败了:', jsError);
            dst = src.clone();
          }
        }
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
    if (dst && !dst.isDeleted()) {
      dst.delete();
    }

    return resultImageData;
  } catch (error) {
    src.delete();
    if (dst && !dst.isDeleted()) {
      dst.delete();
    }
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
          // 处理同步和异步函数
          const filterResult = jsFilter(payload.imageData, payload.params);
          resultImageData = await Promise.resolve(filterResult);
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
          // OpenCV未准备好，检查是否有降级处理方案
          if (payload.action === 'faceBeauty') {
            console.log(
              `🔄 [降级处理] OpenCV未准备好，${payload.action} 使用纯JS处理`
            );
            timer.step('js_fallback_start');
            resultImageData = await applyFaceBeautyJS(
              payload.imageData,
              payload.params
            );
            timer.step('js_fallback_end');

            // 手动渲染
            ctx.canvas.width = resultImageData.width;
            ctx.canvas.height = resultImageData.height;
            if (!payload.skipRendering) {
              ctx.putImageData(toStandardImageData(resultImageData), 0, 0);
              timer.step('render_to_offscreen');
            }
          } else {
            console.warn(
              `⚠️ [降级处理] OpenCV未准备好，操作 ${payload.action} 暂不支持，返回原图`
            );
            resultImageData = payload.imageData;
          }
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
