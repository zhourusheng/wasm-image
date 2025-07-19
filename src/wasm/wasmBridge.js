// wasmBridge.js
// 使用 OpenCV.js 的 JavaScript API

let opencvReady = false;

export async function initWasm() {
  if (opencvReady) return;
  
  return new Promise((resolve, reject) => {
    // Check if cv is already defined
    if (typeof self.cv !== 'undefined') {
      if (self.cv.Mat) {
        opencvReady = true;
        resolve();
        return;
      }
    }
    
    // If cv exists but isn't initialized yet
    if (typeof self.cv !== 'undefined') {
      // 等待 OpenCV.js 加载完成
      self.cv['onRuntimeInitialized'] = () => {
        opencvReady = true;
        resolve();
      };
    } else {
      reject(new Error('OpenCV not found. Make sure it is imported in the worker.'));
    }
  });
}

export async function processImage(imageData, op, params) {
  await initWasm();
  
  // 创建 OpenCV Mat 对象
  const src = self.cv.matFromImageData(imageData);
  let dst;
  
  try {
    switch (op) {
      case 'crop': {
        const { x, y, width, height } = params;
        const rect = new self.cv.Rect(x, y, width, height);
        dst = src.roi(rect);
        break;
      }
      case 'rotate': {
        const { angle } = params;
        const center = new self.cv.Point(src.cols / 2, src.rows / 2);
        const matrix = self.cv.getRotationMatrix2D(center, angle, 1.0);
        dst = new self.cv.Mat();
        self.cv.warpAffine(src, dst, matrix, new self.cv.Size(src.cols, src.rows));
        matrix.delete();
        break;
      }
      case 'flip': {
        const { mode } = params;
        dst = new self.cv.Mat();
        self.cv.flip(src, dst, mode); // 0: x轴翻转(水平), 1: y轴翻转(垂直), -1: 同时翻转
        break;
      }
      case 'resize': {
        const { width, height } = params;
        dst = new self.cv.Mat();
        self.cv.resize(src, dst, new self.cv.Size(width, height), 0, 0, self.cv.INTER_AREA);
        break;
      }
      case 'brightness': {
        const { delta } = params;
        dst = new self.cv.Mat();
        src.convertTo(dst, -1, 1, delta); // -1表示与输入相同的类型
        break;
      }
      case 'contrast': {
        const { factor } = params;
        dst = new self.cv.Mat();
        src.convertTo(dst, -1, factor, 0);
        break;
      }
      case 'saturation': {
        const { factor } = params;
        dst = new self.cv.Mat();
        
        // 将图像转换为HSV颜色空间
        if (src.channels() === 4) {
          self.cv.cvtColor(src, dst, self.cv.COLOR_RGBA2RGB);
          self.cv.cvtColor(dst, dst, self.cv.COLOR_RGB2HSV);
        } else {
          self.cv.cvtColor(src, dst, self.cv.COLOR_RGB2HSV);
        }
        
        // 分离通道
        const channels = new self.cv.MatVector();
        self.cv.split(dst, channels);
        
        // 调整饱和度通道 (通道1是饱和度)
        const satChannel = channels.get(1);
        satChannel.convertTo(satChannel, -1, factor, 0);
        
        // 合并通道
        self.cv.merge(channels, dst);
        
        // 转换回RGB/RGBA
        if (src.channels() === 4) {
          self.cv.cvtColor(dst, dst, self.cv.COLOR_HSV2RGB);
          self.cv.cvtColor(dst, dst, self.cv.COLOR_RGB2RGBA);
        } else {
          self.cv.cvtColor(dst, dst, self.cv.COLOR_HSV2RGB);
        }
        
        // 清理
        channels.delete();
        break;
      }
      case 'blur': {
        const { ksize } = params;
        dst = new self.cv.Mat();
        const kernelSize = new self.cv.Size(ksize, ksize);
        self.cv.GaussianBlur(src, dst, kernelSize, 0);
        break;
      }
      case 'sharpen': {
        dst = new self.cv.Mat();
        
        // 创建锐化核心
        const kernel = self.cv.Mat.ones(3, 3, self.cv.CV_32F);
        kernel.floatPtr(1, 1)[0] = 5;
        kernel.floatPtr(0, 1)[0] = -1;
        kernel.floatPtr(1, 0)[0] = -1;
        kernel.floatPtr(2, 1)[0] = -1;
        kernel.floatPtr(1, 2)[0] = -1;
        
        // 应用过滤器
        self.cv.filter2D(src, dst, -1, kernel, new self.cv.Point(-1, -1), 0, self.cv.BORDER_DEFAULT);
        
        // 清理
        kernel.delete();
        break;
      }
      default:
        dst = src.clone();
        break;
    }
    
    // 转换回 ImageData
    // 使用 OffscreenCanvas 在 Web Worker 中工作
    const canvas = new OffscreenCanvas(dst.cols, dst.rows);
    const ctx = canvas.getContext('2d');
    
    // 创建临时对象来传递给 imshow
    const tempCanvas = {
      width: dst.cols,
      height: dst.rows,
      ctx: ctx,
      getContext: () => ctx
    };
    self.cv.imshow(tempCanvas, dst);
    const result = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    return result;
  } catch (error) {
    console.error('OpenCV处理错误:', error);
    throw new Error(`处理图像时出错: ${error.message}`);
  } finally {
    // 清理内存
    src.delete();
    if (dst && !dst.isDeleted()) {
      dst.delete();
    }
  }
} 