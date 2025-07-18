/**
 * 图像处理工具类
 * 提供图片上传、处理和导出功能
 */

/**
 * 从文件对象加载图片
 * @param {File} file - 用户上传的文件对象
 * @returns {Promise<HTMLImageElement>} - 返回加载完成的图片元素
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    // 检查文件是否为图片
    if (!file.type.match('image.*')) {
      reject(new Error('请选择图片文件'));
      return;
    }

    // 创建文件预览URL
    const imageUrl = URL.createObjectURL(file);
    
    // 创建图像对象
    const image = new Image();
    image.onload = () => {
      // 图像加载完成后返回
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('图片加载失败'));
    };
    
    // 开始加载图像
    image.src = imageUrl;
  });
}

/**
 * 将图像绘制到Canvas上
 * @param {HTMLImageElement} image - 图像元素
 * @param {HTMLCanvasElement} canvas - 目标Canvas
 * @returns {ImageData} - 返回画布上的图像数据
 */
export function drawImageToCanvas(image, canvas) {
  const ctx = canvas.getContext('2d');
  
  // 设置Canvas尺寸为图像尺寸
  canvas.width = image.width;
  canvas.height = image.height;
  
  // 清除画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 绘制图像
  ctx.drawImage(image, 0, 0);
  
  // 返回ImageData
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/**
 * 导出Canvas上的图像为文件
 * @param {HTMLCanvasElement} canvas - 源Canvas
 * @param {string} filename - 导出文件名
 * @param {string} format - 导出格式('image/jpeg', 'image/png', 'image/webp')
 * @param {number} quality - 导出质量(0-1，仅适用于jpeg和webp)
 */
export function exportImage(canvas, filename = 'image', format = 'image/jpeg', quality = 0.92) {
  // 创建下载链接
  const link = document.createElement('a');
  
  // 获取Canvas数据URL
  const dataUrl = canvas.toDataURL(format, quality);
  
  // 设置下载链接
  link.href = dataUrl;
  link.download = `${filename}.${format.split('/')[1]}`;
  
  // 触发下载
  document.body.appendChild(link);
  link.click();
  
  // 清理
  document.body.removeChild(link);
}

/**
 * 复制Canvas图像到剪贴板
 * @param {HTMLCanvasElement} canvas - 源Canvas
 * @returns {Promise<void>}
 */
export async function copyToClipboard(canvas) {
  try {
    // 将Canvas转换为Blob
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });
    
    // 复制到剪贴板
    await navigator.clipboard.write([
      new ClipboardItem({
        [blob.type]: blob
      })
    ]);
    
    return true;
  } catch (err) {
    console.error('复制到剪贴板失败:', err);
    return false;
  }
} 