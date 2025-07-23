// src/utils/imageCollageUtils.js

import { loadImageFromFile, getImageDataFromImage, exportImage } from './imageUtils';

/**
 * 计算水平拼接时的总宽度和高度
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {number} gap - 图像之间的间距
 * @returns {{width: number, height: number}}
 */
export const calculateHorizontalDimensions = (images, gap) => {
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
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {number} gap - 图像之间的间距
 * @returns {{width: number, height: number}}
 */
export const calculateVerticalDimensions = (images, gap) => {
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
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {number} columns - 每行的图像数
 * @param {number} gap - 图像之间的间距
 * @returns {{width: number, height: number}}
 */
export const calculateGridDimensions = (images, columns, gap) => {
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
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + (columns - 1) * gap;
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + (rows - 1) * gap;
  
  return { width: totalWidth, height: totalHeight, colWidths, rowHeights };
};

/**
 * 从多个文件加载图片为ImageData数组
 * @param {FileList} files 
 * @returns {Promise<Array<{imageData: ImageData, name: string}>>}
 */
export async function loadImagesFromFiles(files) {
  const imagePromises = Array.from(files).map(async (file) => {
    const image = await loadImageFromFile(file);
    const imageData = getImageDataFromImage(image);
    return { imageData, name: file.name };
  });

  return Promise.all(imagePromises);
}

/**
 * 创建水平拼接的图片
 * @param {ImageData[]} imagesDataArray 
 * @param {{gap: number, backgroundColor: string}} options
 * @returns {ImageData}
 */
export function createHorizontalCollage(imagesDataArray, options) {
  const { gap = 10, backgroundColor = '#ffffff' } = options;

  if (imagesDataArray.length === 0) return null;

  const totalWidth = imagesDataArray.reduce((sum, img) => sum + img.width, 0) + gap * (imagesDataArray.length - 1);
  const maxHeight = Math.max(...imagesDataArray.map(img => img.height));

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, totalWidth, maxHeight);

  let currentX = 0;
  imagesDataArray.forEach(imageData => {
    ctx.putImageData(imageData, currentX, 0);
    currentX += imageData.width + gap;
  });

  return ctx.getImageData(0, 0, totalWidth, maxHeight);
}

/**
 * 创建垂直拼接的图片
 * @param {ImageData[]} imagesDataArray 
 * @param {{gap: number, backgroundColor: string}} options
 * @returns {ImageData}
 */
export function createVerticalCollage(imagesDataArray, options) {
  const { gap = 10, backgroundColor = '#ffffff' } = options;
  if (imagesDataArray.length === 0) return null;

  const totalHeight = imagesDataArray.reduce((sum, img) => sum + img.height, 0) + gap * (imagesDataArray.length - 1);
  const maxWidth = Math.max(...imagesDataArray.map(img => img.width));

  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, maxWidth, totalHeight);

  let currentY = 0;
  imagesDataArray.forEach(imageData => {
    ctx.putImageData(imageData, 0, currentY);
    currentY += imageData.height + gap;
  });

  return ctx.getImageData(0, 0, maxWidth, totalHeight);
}

/**
 * 创建网格拼接的图片
 * @param {ImageData[]} imagesDataArray 
 * @param {{gap: number, backgroundColor: string, columns: number}} options
 * @returns {ImageData}
 */
export function createGridCollage(imagesDataArray, options) {
  const { gap = 10, backgroundColor = '#ffffff', columns = 2 } = options;
  if (imagesDataArray.length === 0) return null;

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

  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0) + gap * (numColumns - 1);
  const totalHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gap * (numRows - 1);

  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, totalWidth, totalHeight);
  
  const colXOffsets = [0];
  for(let i = 1; i < numColumns; i++) {
    colXOffsets.push(colXOffsets[i-1] + colWidths[i-1] + gap);
  }

  const rowYOffsets = [0];
  for(let i = 1; i < numRows; i++) {
    rowYOffsets.push(rowYOffsets[i-1] + rowHeights[i-1] + gap);
  }

  imagesDataArray.forEach((imageData, index) => {
    const col = index % numColumns;
    const row = Math.floor(index / numColumns);
    const x = colXOffsets[col];
    const y = rowYOffsets[row];
    ctx.putImageData(imageData, x, y);
  });

  return ctx.getImageData(0, 0, totalWidth, totalHeight);
} 