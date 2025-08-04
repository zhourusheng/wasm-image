import type { ImageDataInterface, FilterParams, ExportFormat } from '../types';

// 滤镜配置接口
export interface FilterConfig {
  id: string;
  name: string;
  description?: string;
  defaultParams?: FilterParams;
}

// 导出滤镜列表
export const FILTERS: FilterConfig[] = [
  { id: 'grayscale', name: '灰度' },
  { id: 'blur', name: '模糊' },
  { id: 'canny', name: '边缘检测' },
  { id: 'threshold', name: '阈值' },
  { id: 'original', name: '原图' },
  { id: 'compress', name: '图片压缩' },
  { id: 'sepia', name: '复古' },
  { id: 'brightness', name: '亮度' },
  { id: 'contrast', name: '对比度' },
  { id: 'sharpen', name: '锐化' },
];

// 高斯模糊参数接口
interface GaussianBlurParams {
  ksize: number;
}

// 压缩结果接口
interface CompressionResult {
  blob: Blob;
  size: number;
  url: string;
}

/**
 * 使用纯 JavaScript 在主线程上对 ImageData 应用高斯模糊。
 * 这是一个高效的、分为两遍（水平和垂直）的实现。
 */
export function applyGaussianBlurJS(
  originalData: ImageDataInterface, 
  { ksize }: GaussianBlurParams
): ImageDataInterface {
  let adjustedKsize = ksize;
  if (adjustedKsize % 2 === 0) adjustedKsize += 1; // 确保 ksize 是奇数

  const { data, width, height } = originalData;
  const radius = (adjustedKsize - 1) / 2;

  // 1. 创建高斯核
  // 使用简化的高斯函数 e^(-x^2 / (2*sigma^2))
  // 根据经验，可以设置 sigma ≈ radius / 2
  const sigma = radius / 2;
  const sigma2 = 2 * sigma * sigma;
  const kernel: number[] = [];
  let kernelSum = 0;
  
  for (let i = -radius; i <= radius; i++) {
    const value = Math.exp(-(i * i) / sigma2);
    kernel.push(value);
    kernelSum += value;
  }
  
  // 归一化
  for (let i = 0; i < kernel.length; i++) {
    kernel[i] /= kernelSum;
  }
  
  const tempR = new Uint8ClampedArray(data.length / 4);
  const tempG = new Uint8ClampedArray(data.length / 4);
  const tempB = new Uint8ClampedArray(data.length / 4);
  const finalData = new Uint8ClampedArray(data.length);

  // 2. 水平模糊
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let i = -radius; i <= radius; i++) {
        const pixelX = Math.max(0, Math.min(width - 1, x + i)); // 处理边缘
        const kernelValue = kernel[i + radius];
        const pixelIndex = (y * width + pixelX) * 4;
        r += data[pixelIndex] * kernelValue;
        g += data[pixelIndex + 1] * kernelValue;
        b += data[pixelIndex + 2] * kernelValue;
      }
      const tempIndex = y * width + x;
      tempR[tempIndex] = r;
      tempG[tempIndex] = g;
      tempB[tempIndex] = b;
    }
  }

  // 3. 垂直模糊
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let i = -radius; i <= radius; i++) {
        const pixelY = Math.max(0, Math.min(height - 1, y + i));
        const kernelValue = kernel[i + radius];
        const tempIndex = pixelY * width + x;
        r += tempR[tempIndex] * kernelValue;
        g += tempG[tempIndex] * kernelValue;
        b += tempB[tempIndex] * kernelValue;
      }
      const finalIndex = (y * width + x) * 4;
      finalData[finalIndex] = r;
      finalData[finalIndex + 1] = g;
      finalData[finalIndex + 2] = b;
      finalData[finalIndex + 3] = data[finalIndex + 3]; // 保持 alpha 通道
    }
  }

  return new ImageData(finalData, width, height) as ImageDataInterface;
}

/**
 * 应用复古滤镜
 */
export function applySepiaJS(imageData: ImageDataInterface): ImageDataInterface {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    data[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
    data[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
    data[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
  }
  
  return new ImageData(data, imageData.width, imageData.height) as ImageDataInterface;
}

/**
 * 应用灰度滤镜
 */
export function applyGrayscaleJS(imageData: ImageDataInterface): ImageDataInterface {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // 使用标准灰度转换公式
    const gray = Math.round(r * 0.299 + g * 0.587 + b * 0.114);
    
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  
  return new ImageData(data, imageData.width, imageData.height) as ImageDataInterface;
}

/**
 * 调整亮度
 */
export function adjustBrightnessJS(
  imageData: ImageDataInterface, 
  brightness: number
): ImageDataInterface {
  const data = new Uint8ClampedArray(imageData.data);
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + brightness));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + brightness));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + brightness));
  }
  
  return new ImageData(data, imageData.width, imageData.height) as ImageDataInterface;
}

/**
 * 调整对比度
 */
export function adjustContrastJS(
  imageData: ImageDataInterface, 
  contrast: number
): ImageDataInterface {
  const data = new Uint8ClampedArray(imageData.data);
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128));
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128));
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128));
  }
  
  return new ImageData(data, imageData.width, imageData.height) as ImageDataInterface;
}

/**
 * 将 Canvas 内容压缩为指定质量的图片
 */
export function compressCanvasImage(
  canvas: HTMLCanvasElement, 
  quality: number = 0.8, 
  format: string = 'image/jpeg'
): Promise<CompressionResult> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('创建 Blob 对象失败'));
          return;
        }
        
        const url = URL.createObjectURL(blob);
        const size = blob.size;
        
        resolve({
          blob,
          size,
          url
        });
      }, format, quality); // 使用指定格式和质量进行压缩
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 将 ImageData 转换为 Blob
 */
export function imageDataToBlob(
  imageData: ImageDataInterface,
  format: ExportFormat = 'png',
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('无法获取Canvas上下文'));
      return;
    }
    
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 
                     format === 'webp' ? 'image/webp' : 'image/png';
    
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('转换为Blob失败'));
      }
    }, mimeType, quality);
  });
}

/**
 * 计算文件大小的可读格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return bytes + ' B';
  } else if (bytes < 1024 * 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  } else {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

/**
 * 获取文件的MIME类型
 */
export function getFileMimeType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'bmp':
      return 'image/bmp';
    default:
      return 'image/png';
  }
}

/**
 * 检查浏览器是否支持某种图片格式
 */
export function isSupportedImageFormat(format: string): boolean {
  const canvas = document.createElement('canvas');
  const supportedFormats = ['image/png', 'image/jpeg', 'image/webp'];
  
  try {
    const dataURL = canvas.toDataURL(format);
    return dataURL.startsWith(`data:${format}`);
  } catch {
    return supportedFormats.includes(format);
  }
}