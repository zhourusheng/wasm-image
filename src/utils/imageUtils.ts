import type { ImageDataInterface } from '../types';
import { toStandardImageData } from '../types';

/**
 * 从文件对象加载图片
 */
export const loadImageFromFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请选择一个图片文件'));
      return;
    }

    const reader = new FileReader();

    reader.onload = e => {
      const result = e.target?.result;
      if (typeof result !== 'string') {
        reject(new Error('文件读取结果无效'));
        return;
      }

      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = err => reject(new Error('加载图片失败: ' + err));
      img.src = result;
    };

    reader.onerror = err => reject(new Error('读取文件失败: ' + err));
    reader.readAsDataURL(file);
  });
};

/**
 * 从 URL 加载图片
 */
export const loadImageFromUrl = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // 支持跨域图片
    img.onload = () => resolve(img);
    img.onerror = err => reject(new Error('加载图片失败: ' + err));
    img.src = url;
  });
};

/**
 * 将图片绘制到 Canvas 上
 */
export const drawImageToCanvas = (
  image: HTMLImageElement,
  canvas: HTMLCanvasElement
): ImageDataInterface => {
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  ctx.drawImage(image, 0, 0, image.width, image.height);
  return ctx.getImageData(
    0,
    0,
    image.width,
    image.height
  ) as ImageDataInterface;
};

/**
 * 从图片元素中提取 ImageData，不修改任何现有的 canvas
 */
export const getImageDataFromImage = (
  image: HTMLImageElement
): ImageDataInterface => {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  ctx.drawImage(image, 0, 0, image.width, image.height);
  return ctx.getImageData(
    0,
    0,
    image.width,
    image.height
  ) as ImageDataInterface;
};

/**
 * 将 ImageData 转换为 Canvas
 */
export const imageDataToCanvas = (
  imageData: ImageDataInterface
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  canvas.width = imageData.width;
  canvas.height = imageData.height;
  ctx.putImageData(toStandardImageData(imageData), 0, 0);

  return canvas;
};

/**
 * 创建 ImageData 的深拷贝
 */
export const cloneImageData = (
  imageData: ImageDataInterface
): ImageDataInterface => {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  ) as ImageDataInterface;
};

/**
 * 导出 Canvas 内容为图片文件
 */
export const exportImage = (
  canvas: HTMLCanvasElement,
  filename: string = 'edited-image.png',
  format: string = 'image/png',
  quality?: number
): void => {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL(format, quality);
  link.click();
};

/**
 * 导出 ImageData 为图片文件
 */
export const exportImageData = (
  imageData: ImageDataInterface,
  filename: string = 'edited-image.png',
  format: string = 'image/png',
  quality?: number
): void => {
  const canvas = imageDataToCanvas(imageData);
  exportImage(canvas, filename, format, quality);
};

/**
 * 将 Canvas 内容复制到剪贴板
 */
export const copyImageToClipboard = async (
  canvas: HTMLCanvasElement
): Promise<void> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async blob => {
      if (!blob) {
        return reject(new Error('无法创建 Blob 对象'));
      }

      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        resolve();
      } catch (err) {
        console.error('复制到剪贴板失败:', err);
        reject(new Error('复制到剪贴板失败。浏览器可能不支持或未授予权限。'));
      }
    }, 'image/png');
  });
};

/**
 * 将 ImageData 复制到剪贴板
 */
export const copyImageDataToClipboard = async (
  imageData: ImageDataInterface
): Promise<void> => {
  const canvas = imageDataToCanvas(imageData);
  return copyImageToClipboard(canvas);
};

/**
 * 调整图片大小
 */
export const resizeImageData = (
  imageData: ImageDataInterface,
  newWidth: number,
  newHeight: number,
  smoothing: boolean = true
): ImageDataInterface => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 创建临时画布用于原始图像
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) {
    throw new Error('无法获取临时Canvas上下文');
  }

  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  tempCtx.putImageData(toStandardImageData(imageData), 0, 0);

  // 设置目标画布
  canvas.width = newWidth;
  canvas.height = newHeight;

  // 设置图像平滑
  ctx.imageSmoothingEnabled = smoothing;
  if (smoothing) {
    ctx.imageSmoothingQuality = 'high';
  }

  // 绘制调整大小后的图像
  ctx.drawImage(tempCanvas, 0, 0, newWidth, newHeight);

  return ctx.getImageData(0, 0, newWidth, newHeight) as ImageDataInterface;
};

/**
 * 旋转图片
 */
export const rotateImageData = (
  imageData: ImageDataInterface,
  angle: number
): ImageDataInterface => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 创建临时画布
  const tempCanvas = imageDataToCanvas(imageData);

  // 计算旋转后的尺寸
  const radians = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));

  const newWidth = Math.round(imageData.width * cos + imageData.height * sin);
  const newHeight = Math.round(imageData.width * sin + imageData.height * cos);

  canvas.width = newWidth;
  canvas.height = newHeight;

  // 移动到中心点并旋转
  ctx.translate(newWidth / 2, newHeight / 2);
  ctx.rotate(radians);
  ctx.drawImage(tempCanvas, -imageData.width / 2, -imageData.height / 2);

  return ctx.getImageData(0, 0, newWidth, newHeight) as ImageDataInterface;
};

/**
 * 翻转图片
 */
export const flipImageData = (
  imageData: ImageDataInterface,
  horizontal: boolean = true,
  vertical: boolean = false
): ImageDataInterface => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  canvas.width = imageData.width;
  canvas.height = imageData.height;

  // 设置变换
  const scaleX = horizontal ? -1 : 1;
  const scaleY = vertical ? -1 : 1;
  const translateX = horizontal ? -imageData.width : 0;
  const translateY = vertical ? -imageData.height : 0;

  ctx.scale(scaleX, scaleY);
  ctx.translate(translateX, translateY);

  // 绘制原始图像
  const tempCanvas = imageDataToCanvas(imageData);
  ctx.drawImage(tempCanvas, 0, 0);

  return ctx.getImageData(
    0,
    0,
    imageData.width,
    imageData.height
  ) as ImageDataInterface;
};

/**
 * 裁剪图片
 */
export const cropImageData = (
  imageData: ImageDataInterface,
  x: number,
  y: number,
  width: number,
  height: number
): ImageDataInterface => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 确保裁剪区域在图像范围内
  const clampedX = Math.max(0, Math.min(x, imageData.width));
  const clampedY = Math.max(0, Math.min(y, imageData.height));
  const clampedWidth = Math.max(1, Math.min(width, imageData.width - clampedX));
  const clampedHeight = Math.max(
    1,
    Math.min(height, imageData.height - clampedY)
  );

  canvas.width = clampedWidth;
  canvas.height = clampedHeight;

  // 创建临时画布
  const tempCanvas = imageDataToCanvas(imageData);

  // 绘制裁剪区域
  ctx.drawImage(
    tempCanvas,
    clampedX,
    clampedY,
    clampedWidth,
    clampedHeight,
    0,
    0,
    clampedWidth,
    clampedHeight
  );

  return ctx.getImageData(
    0,
    0,
    clampedWidth,
    clampedHeight
  ) as ImageDataInterface;
};

/**
 * 检查图片是否有效
 */
export const isValidImageData = (
  imageData: unknown
): imageData is ImageDataInterface => {
  return (
    imageData !== null &&
    typeof imageData === 'object' &&
    'data' in imageData &&
    'width' in imageData &&
    'height' in imageData &&
    imageData.data instanceof Uint8ClampedArray &&
    typeof imageData.width === 'number' &&
    typeof imageData.height === 'number' &&
    imageData.width > 0 &&
    imageData.height > 0
  );
};
