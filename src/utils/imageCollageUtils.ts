import type { ImageDataInterface } from '../types';
import { loadImageFromFile, getImageDataFromImage } from './imageUtils';

// 图像项接口
export interface ImageItem {
  imageData: ImageDataInterface;
  name: string;
  file?: File;
}

// 拼接选项接口
export interface CollageOptions {
  gap?: number;
  backgroundColor?: string;
  columns?: number;
}

// 尺寸信息接口
export interface Dimensions {
  width: number;
  height: number;
}

// 网格尺寸信息接口
export interface GridDimensions extends Dimensions {
  colWidths: number[];
  rowHeights: number[];
}

// 布局类型
export type CollageLayout = 'horizontal' | 'vertical' | 'grid';

/**
 * 计算水平拼接时的总宽度和高度
 */
export const calculateHorizontalDimensions = (
  images: ImageDataInterface[],
  gap: number
): Dimensions => {
  let totalWidth = 0;
  let maxHeight = 0;

  images.forEach((img, index) => {
    totalWidth += img.width;
    if (index < images.length - 1) {
      totalWidth += gap;
    }
    maxHeight = Math.max(maxHeight, img.height);
  });

  return { width: totalWidth, height: maxHeight };
};

/**
 * 计算垂直拼接时的总宽度和高度
 */
export const calculateVerticalDimensions = (
  images: ImageDataInterface[],
  gap: number
): Dimensions => {
  let maxWidth = 0;
  let totalHeight = 0;

  images.forEach((img, index) => {
    maxWidth = Math.max(maxWidth, img.width);
    totalHeight += img.height;
    if (index < images.length - 1) {
      totalHeight += gap;
    }
  });

  return { width: maxWidth, height: totalHeight };
};

/**
 * 计算网格拼接时的总宽度和高度
 */
export const calculateGridDimensions = (
  images: ImageDataInterface[],
  columns: number,
  gap: number
): GridDimensions => {
  const rows = Math.ceil(images.length / columns);

  // 计算每行的最大宽度和每列的最大高度
  const colWidths = new Array(columns).fill(0);
  const rowHeights = new Array(rows).fill(0);

  images.forEach((img, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;

    colWidths[col] = Math.max(colWidths[col], img.width);
    rowHeights[row] = Math.max(rowHeights[row], img.height);
  });

  // 计算总宽度和高度（包括间距）
  const totalWidth =
    colWidths.reduce((sum, w) => sum + w, 0) + (columns - 1) * gap;
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * gap;

  return { width: totalWidth, height: totalHeight, colWidths, rowHeights };
};

/**
 * 从多个文件加载图片为ImageData数组
 */
export async function loadImagesFromFiles(
  files: File[] | FileList
): Promise<ImageItem[]> {
  const fileArray = Array.isArray(files) ? files : Array.from(files);

  const imagePromises = fileArray.map(async file => {
    try {
      const image = await loadImageFromFile(file);
      const imageData = getImageDataFromImage(image);
      return { imageData, name: file.name, file };
    } catch (error) {
      console.error(`加载图片失败: ${file.name}`, error);
      throw new Error(`加载图片失败: ${file.name}`);
    }
  });

  return Promise.all(imagePromises);
}

/**
 * 创建水平拼接的图片
 */
export function createHorizontalCollage(
  imagesDataArray: ImageDataInterface[],
  options: CollageOptions = {}
): ImageDataInterface {
  const { gap = 10, backgroundColor = '#ffffff' } = options;

  if (imagesDataArray.length === 0) {
    throw new Error('没有图片可以拼接');
  }

  const totalWidth =
    imagesDataArray.reduce((sum, img) => sum + img.width, 0) +
    gap * (imagesDataArray.length - 1);
  const maxHeight = Math.max(...imagesDataArray.map(img => img.height));

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 填充背景色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, totalWidth, maxHeight);

  let currentX = 0;
  imagesDataArray.forEach(imageData => {
    // 垂直居中放置图片
    const yOffset = Math.floor((maxHeight - imageData.height) / 2);
    ctx.putImageData(imageData, currentX, yOffset);
    currentX += imageData.width + gap;
  });

  return ctx.getImageData(0, 0, totalWidth, maxHeight) as ImageDataInterface;
}

/**
 * 创建垂直拼接的图片
 */
export function createVerticalCollage(
  imagesDataArray: ImageDataInterface[],
  options: CollageOptions = {}
): ImageDataInterface {
  const { gap = 10, backgroundColor = '#ffffff' } = options;

  if (imagesDataArray.length === 0) {
    throw new Error('没有图片可以拼接');
  }

  const totalHeight =
    imagesDataArray.reduce((sum, img) => sum + img.height, 0) +
    gap * (imagesDataArray.length - 1);
  const maxWidth = Math.max(...imagesDataArray.map(img => img.width));

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 填充背景色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, maxWidth, totalHeight);

  let currentY = 0;
  imagesDataArray.forEach(imageData => {
    // 水平居中放置图片
    const xOffset = Math.floor((maxWidth - imageData.width) / 2);
    ctx.putImageData(imageData, xOffset, currentY);
    currentY += imageData.height + gap;
  });

  return ctx.getImageData(0, 0, maxWidth, totalHeight) as ImageDataInterface;
}

/**
 * 创建网格拼接的图片
 */
export function createGridCollage(
  imagesDataArray: ImageDataInterface[],
  options: CollageOptions = {}
): ImageDataInterface {
  const { gap = 10, backgroundColor = '#ffffff', columns = 2 } = options;

  if (imagesDataArray.length === 0) {
    throw new Error('没有图片可以拼接');
  }

  const numColumns = Math.min(columns, imagesDataArray.length);
  const numRows = Math.ceil(imagesDataArray.length / numColumns);

  // 计算每列的最大宽度和每行的最大高度
  const colWidths = new Array(numColumns).fill(0);
  const rowHeights = new Array(numRows).fill(0);

  imagesDataArray.forEach((img, index) => {
    const col = index % numColumns;
    const row = Math.floor(index / numColumns);
    if (img.width > colWidths[col]) {
      colWidths[col] = img.width;
    }
    if (img.height > rowHeights[row]) {
      rowHeights[row] = img.height;
    }
  });

  const totalWidth =
    colWidths.reduce((sum, w) => sum + w, 0) + gap * (numColumns - 1);
  const totalHeight =
    rowHeights.reduce((sum, h) => sum + h, 0) + gap * (numRows - 1);

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 填充背景色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  // 计算每列的X偏移量
  const colXOffsets = [0];
  for (let i = 1; i < numColumns; i++) {
    colXOffsets.push(colXOffsets[i - 1] + colWidths[i - 1] + gap);
  }

  // 计算每行的Y偏移量
  const rowYOffsets = [0];
  for (let i = 1; i < numRows; i++) {
    rowYOffsets.push(rowYOffsets[i - 1] + rowHeights[i - 1] + gap);
  }

  imagesDataArray.forEach((imageData, index) => {
    const col = index % numColumns;
    const row = Math.floor(index / numColumns);

    // 计算居中位置
    const xOffset =
      colXOffsets[col] + Math.floor((colWidths[col] - imageData.width) / 2);
    const yOffset =
      rowYOffsets[row] + Math.floor((rowHeights[row] - imageData.height) / 2);

    ctx.putImageData(imageData, xOffset, yOffset);
  });

  return ctx.getImageData(0, 0, totalWidth, totalHeight) as ImageDataInterface;
}

/**
 * 创建自定义布局的拼贴
 */
export function createCustomCollage(
  items: Array<{
    imageData: ImageDataInterface;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
  }>,
  canvasWidth: number,
  canvasHeight: number,
  backgroundColor: string = '#ffffff'
): ImageDataInterface {
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('无法获取Canvas上下文');
  }

  // 填充背景色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // 绘制每个图片项
  items.forEach(item => {
    const { imageData, x, y, width, height, rotation = 0 } = item;

    ctx.save();

    // 创建临时canvas来处理图片
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = imageData.width;
    tempCanvas.height = imageData.height;
    const tempCtx = tempCanvas.getContext('2d');

    if (!tempCtx) return;

    tempCtx.putImageData(imageData, 0, 0);

    // 应用变换
    ctx.translate(x, y);
    if (rotation !== 0) {
      ctx.rotate((rotation * Math.PI) / 180);
    }

    // 绘制图片（如果指定了宽高则缩放）
    if (width && height) {
      ctx.drawImage(tempCanvas, -width / 2, -height / 2, width, height);
    } else {
      ctx.drawImage(tempCanvas, -imageData.width / 2, -imageData.height / 2);
    }

    ctx.restore();
  });

  return ctx.getImageData(
    0,
    0,
    canvasWidth,
    canvasHeight
  ) as ImageDataInterface;
}

/**
 * 根据布局类型创建拼贴
 */
export function createCollageByLayout(
  layout: CollageLayout,
  images: ImageDataInterface[],
  options: CollageOptions = {}
): ImageDataInterface {
  switch (layout) {
    case 'horizontal':
      return createHorizontalCollage(images, options);
    case 'vertical':
      return createVerticalCollage(images, options);
    case 'grid':
      return createGridCollage(images, options);
    default:
      throw new Error(`不支持的布局类型: ${layout}`);
  }
}

/**
 * 获取拼贴的预估尺寸
 */
export function getCollageDimensions(
  layout: CollageLayout,
  images: ImageDataInterface[],
  options: CollageOptions = {}
): Dimensions {
  const { gap = 10, columns = 2 } = options;

  switch (layout) {
    case 'horizontal':
      return calculateHorizontalDimensions(images, gap);
    case 'vertical':
      return calculateVerticalDimensions(images, gap);
    case 'grid':
      return calculateGridDimensions(images, columns, gap);
    default:
      throw new Error(`不支持的布局类型: ${layout}`);
  }
}

/**
 * 验证拼贴参数
 */
export function validateCollageParams(
  images: ImageDataInterface[],
  options: CollageOptions = {}
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!images || images.length === 0) {
    errors.push('至少需要一张图片');
  }

  if (options.gap !== undefined && (options.gap < 0 || options.gap > 1000)) {
    errors.push('间距必须在0-1000像素之间');
  }

  if (
    options.columns !== undefined &&
    (options.columns < 1 || options.columns > 10)
  ) {
    errors.push('列数必须在1-10之间');
  }

  // 检查图片数据有效性
  images.forEach((img, index) => {
    if (!img || !img.data || img.width <= 0 || img.height <= 0) {
      errors.push(`第${index + 1}张图片数据无效`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}
