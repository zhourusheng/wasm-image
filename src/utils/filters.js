// src/utils/filters.js
export const FILTERS = [
    { id: 'grayscale', name: '灰度' },
    { id: 'blur', name: '模糊' },
    { id: 'canny', name: '边缘检测' },
    { id: 'threshold', name: '阈值' },
    { id: 'original', name: '原图' },
];

/**
 * 使用纯 JavaScript 在主线程上对 ImageData 应用高斯模糊。
 * 这是一个高效的、分为两遍（水平和垂直）的实现。
 * @param {ImageData} originalData 原始图像数据。
 * @param {object} params - 包含模糊参数的对象。
 * @param {number} params.ksize - 核心大小（必须是奇数）。
 * @returns {ImageData} 应用模糊后的新图像数据。
 */
export function applyGaussianBlurJS(originalData, { ksize }) {
  if (ksize % 2 === 0) ksize += 1; // 确保 ksize 是奇数

  const { data, width, height } = originalData;
  const radius = (ksize - 1) / 2;

  // 1. 创建高斯核
  // 使用简化的高斯函数 e^(-x^2 / (2*sigma^2))
  // 根据经验，可以设置 sigma ≈ radius / 2
  const sigma = radius / 2;
  const sigma2 = 2 * sigma * sigma;
  const kernel = [];
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

  return new ImageData(finalData, width, height);
} 