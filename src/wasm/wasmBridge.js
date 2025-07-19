// wasmBridge.js
// 使用 OpenCV.js 的 JavaScript API

let opencvReady = false;

export async function initWasm() {
  if (opencvReady) return;
  
  return new Promise((resolve) => {
    if (typeof cv !== 'undefined') {
      opencvReady = true;
      resolve();
      return;
    }
    
    // 等待 OpenCV.js 加载完成
    cv['onRuntimeInitialized'] = () => {
      opencvReady = true;
      resolve();
    };
  });
}

export async function processImage(imageData, op, params) {
  await initWasm();
  
  // 创建 OpenCV Mat 对象
  const src = cv.matFromImageData(imageData);
  let dst;
  
  switch (op) {
    case 'crop': {
      const { x, y, cropW, cropH } = params;
      const rect = new cv.Rect(x, y, cropW, cropH);
      dst = src.roi(rect);
      break;
    }
    case 'rotate': {
      const { angle } = params;
      const center = new cv.Point(src.cols / 2, src.rows / 2);
      const matrix = cv.getRotationMatrix2D(center, angle, 1.0);
      dst = new cv.Mat();
      cv.warpAffine(src, dst, matrix, new cv.Size(src.cols, src.rows));
      matrix.delete();
      break;
    }
    case 'flip': {
      const { mode } = params;
      dst = new cv.Mat();
      cv.flip(src, dst, mode); // 0: x轴, 1: y轴
      break;
    }
    case 'resize': {
      const { newW, newH } = params;
      dst = new cv.Mat();
      cv.resize(src, dst, new cv.Size(newW, newH));
      break;
    }
    case 'brightness': {
      const { delta } = params;
      dst = new cv.Mat();
      src.convertTo(dst, -1, 1, delta);
      break;
    }
    case 'contrast': {
      const { factor } = params;
      dst = new cv.Mat();
      src.convertTo(dst, -1, factor, 0);
      break;
    }
    case 'saturation': {
      const { factor } = params;
      dst = new cv.Mat();
      cv.cvtColor(src, dst, cv.COLOR_RGBA2RGB);
      cv.cvtColor(dst, dst, cv.COLOR_RGB2HSV);
      
      // 调整饱和度通道
      const channels = new cv.MatVector();
      cv.split(dst, channels);
      channels.get(1).convertTo(channels.get(1), -1, factor, 0);
      cv.merge(channels, dst);
      
      cv.cvtColor(dst, dst, cv.COLOR_HSV2RGB);
      cv.cvtColor(dst, dst, cv.COLOR_RGB2RGBA);
      
      channels.delete();
      break;
    }
    default:
      dst = src.clone();
      break;
  }
  
  // 转换回 ImageData
  const canvas = document.createElement('canvas');
  canvas.width = dst.cols;
  canvas.height = dst.rows;
  const ctx = canvas.getContext('2d');
  cv.imshow(canvas, dst);
  const result = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 清理内存
  src.delete();
  if (dst !== src) {
    dst.delete();
  }
  
  return result;
} 