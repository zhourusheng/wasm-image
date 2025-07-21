// src/utils/imageUtils.js

/**
 * 从文件对象加载图片
 * @param {File} file - 用户选择的文件
 * @returns {Promise<HTMLImageElement>}
 */
export const loadImageFromFile = (file) => {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('请选择一个图片文件'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(new Error('加载图片失败: ' + err));
            img.src = e.target.result;
        };
        reader.onerror = (err) => reject(new Error('读取文件失败: ' + err));
        reader.readAsDataURL(file);
    });
};

/**
 * 将图片绘制到 Canvas 上
 * @param {HTMLImageElement} image - 要绘制的图片
 * @param {HTMLCanvasElement} canvas - 目标 Canvas
 * @returns {ImageData}
 */
export const drawImageToCanvas = (image, canvas) => {
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return ctx.getImageData(0, 0, image.width, image.height);
};

/**
 * 从图片元素中提取 ImageData，不修改任何现有的 canvas
 * @param {HTMLImageElement} image - 要从中提取数据的图片
 * @returns {ImageData}
 */
export const getImageDataFromImage = (image) => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, image.width, image.height);
    return ctx.getImageData(0, 0, image.width, image.height);
};


/**
 * 导出 Canvas 内容为图片文件
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @param {string} filename - 导出的文件名
 */
export const exportImage = (canvas, filename = 'edited-image.png') => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

/**
 * 将 Canvas 内容复制到剪贴板
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @returns {Promise<void>}
 */
export const copyImageToClipboard = async (canvas) => {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                return reject(new Error('无法创建 Blob 对象'));
            }
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                resolve();
            } catch (err) {
                console.error('复制到剪贴板失败:', err);
                reject(new Error('复制到剪贴板失败。浏览器可能不支持或未授予权限。'));
            }
        }, 'image/png');
    });
}; 