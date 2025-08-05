import type { ImageDataInterface } from '../../types';

/**
 * 创建测试用的ImageData
 */
export function createMockImageData(
  width: number = 100,
  height: number = 100,
  color: [number, number, number, number] = [255, 0, 0, 255] // 红色
): ImageDataInterface {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = color[0]; // R
    data[i + 1] = color[1]; // G
    data[i + 2] = color[2]; // B
    data[i + 3] = color[3]; // A
  }

  return new ImageData(data, width, height) as ImageDataInterface;
}

/**
 * 创建测试用的Canvas元素
 */
export function createMockCanvas(
  width: number = 100,
  height: number = 100
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * 比较两个ImageData是否相等
 */
export function compareImageData(
  imageData1: ImageDataInterface,
  imageData2: ImageDataInterface,
  tolerance: number = 0
): boolean {
  if (
    imageData1.width !== imageData2.width ||
    imageData1.height !== imageData2.height
  ) {
    return false;
  }

  for (let i = 0; i < imageData1.data.length; i++) {
    if (Math.abs(imageData1.data[i]! - imageData2.data[i]!) > tolerance) {
      return false;
    }
  }

  return true;
}

/**
 * 等待异步操作完成
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
