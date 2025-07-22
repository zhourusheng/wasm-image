// src/utils/imageCollageUtils.js

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
 * 执行水平拼接
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {Object} options - 拼接选项
 * @returns {ImageData} - 拼接后的图像
 */
export const createHorizontalCollage = (images, options) => {
  const { gap = 0, backgroundColor = 'rgba(255,255,255,1)', verticalAlign = 'middle' } = options;
  
  if (!images || images.length === 0) {
    throw new Error('没有图像可供拼接');
  }
  
  const { width, height } = calculateHorizontalDimensions(images, gap);
  
  // 创建Canvas和Context
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 填充背景颜色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // 绘制每个图像
  let xOffset = 0;
  images.forEach(img => {
    // 根据垂直对齐方式计算y偏移
    let yOffset = 0;
    switch (verticalAlign) {
      case 'top':
        yOffset = 0;
        break;
      case 'middle':
        yOffset = (height - img.height) / 2;
        break;
      case 'bottom':
        yOffset = height - img.height;
        break;
      default:
        yOffset = (height - img.height) / 2;
    }
    
    // 绘制当前图像
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.putImageData(img, 0, 0);
    
    ctx.drawImage(imgCanvas, xOffset, yOffset);
    
    // 更新x偏移，为下一个图像做准备
    xOffset += img.width + gap;
  });
  
  return ctx.getImageData(0, 0, width, height);
};

/**
 * 执行垂直拼接
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {Object} options - 拼接选项
 * @returns {ImageData} - 拼接后的图像
 */
export const createVerticalCollage = (images, options) => {
  const { gap = 0, backgroundColor = 'rgba(255,255,255,1)', horizontalAlign = 'center' } = options;
  
  if (!images || images.length === 0) {
    throw new Error('没有图像可供拼接');
  }
  
  const { width, height } = calculateVerticalDimensions(images, gap);
  
  // 创建Canvas和Context
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 填充背景颜色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // 绘制每个图像
  let yOffset = 0;
  images.forEach(img => {
    // 根据水平对齐方式计算x偏移
    let xOffset = 0;
    switch (horizontalAlign) {
      case 'left':
        xOffset = 0;
        break;
      case 'center':
        xOffset = (width - img.width) / 2;
        break;
      case 'right':
        xOffset = width - img.width;
        break;
      default:
        xOffset = (width - img.width) / 2;
    }
    
    // 绘制当前图像
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.putImageData(img, 0, 0);
    
    ctx.drawImage(imgCanvas, xOffset, yOffset);
    
    // 更新y偏移，为下一个图像做准备
    yOffset += img.height + gap;
  });
  
  return ctx.getImageData(0, 0, width, height);
};

/**
 * 执行网格拼接
 * @param {Array<ImageData>} images - 要拼接的图像数组
 * @param {Object} options - 拼接选项
 * @returns {ImageData} - 拼接后的图像
 */
export const createGridCollage = (images, options) => {
  const { columns = 2, gap = 0, backgroundColor = 'rgba(255,255,255,1)' } = options;
  
  if (!images || images.length === 0) {
    throw new Error('没有图像可供拼接');
  }
  
  const { width, height, colWidths, rowHeights } = calculateGridDimensions(images, columns, gap);
  
  // 创建Canvas和Context
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  // 填充背景颜色
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  
  // 计算每个单元格的位置
  const cellPositions = [];
  let yPos = 0;
  
  for (let row = 0; row < rowHeights.length; row++) {
    let xPos = 0;
    for (let col = 0; col < columns; col++) {
      cellPositions.push({ x: xPos, y: yPos });
      xPos += colWidths[col] + (col < columns - 1 ? gap : 0);
    }
    yPos += rowHeights[row] + (row < rowHeights.length - 1 ? gap : 0);
  }
  
  // 绘制每个图像
  images.forEach((img, index) => {
    if (index >= cellPositions.length) return;
    
    const { x, y } = cellPositions[index];
    
    // 居中图像
    const xOffset = x + (colWidths[index % columns] - img.width) / 2;
    const yOffset = y + (rowHeights[Math.floor(index / columns)] - img.height) / 2;
    
    // 绘制当前图像
    const imgCanvas = document.createElement('canvas');
    imgCanvas.width = img.width;
    imgCanvas.height = img.height;
    const imgCtx = imgCanvas.getContext('2d');
    imgCtx.putImageData(img, 0, 0);
    
    ctx.drawImage(imgCanvas, xOffset, yOffset);
  });
  
  return ctx.getImageData(0, 0, width, height);
};

/**
 * 从File对象加载多个图像
 * @param {Array<File>} files - 要加载的文件数组
 * @returns {Promise<Array<ImageData>>} - 加载的图像数组
 */
export const loadImagesFromFiles = async (files) => {
  const imagePromises = Array.from(files).map(file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // 创建Canvas并获取ImageData
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => reject(new Error(`无法加载图像：${file.name}`));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error(`无法读取文件：${file.name}`));
      reader.readAsDataURL(file);
    });
  });
  
  return Promise.all(imagePromises);
}; 