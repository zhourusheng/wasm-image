// wasmBridge.js
// 使用 OpenCV.js 的 JavaScript API

let opencvReady = false;

// 在 classic worker 中, 我们需要将函数附加到 self 全局对象
self.wasmInit = async function() {
  if (opencvReady) return;
  
  return new Promise((resolve, reject) => {
    // 检查 cv 是否已定义
    if (typeof self.cv !== 'undefined') {
      if (self.cv.Mat) {
        opencvReady = true;
        resolve();
        return;
      }
    }
    
    // 如果 cv 存在但尚未初始化
    if (typeof self.cv !== 'undefined') {
      // 等待 OpenCV.js 加载完成
      self.cv['onRuntimeInitialized'] = () => {
        opencvReady = true;
        resolve();
      };
    } else {
      reject(new Error('未找到 OpenCV。请确保它已在 worker 中导入。'));
    }
  });
}

// 修改函数以接收 ctx 并直接渲染，而不是返回 ImageData
self.wasmProcessImage = async function(imageData, op, params, ctx) {
  await self.wasmInit();
  
  // 创建 OpenCV Mat 对象
  const src = self.cv.matFromImageData(imageData);
  let dst;
  
  try {
    switch (op) {
      case 'crop': {
        const { x, y, width, height } = params;
        // 添加一个健壮性检查，确保裁剪参数有效
        if (x >= 0 && y >= 0 && width > 0 && height > 0 && x + width <= src.cols && y + height <= src.rows) {
          const rect = new self.cv.Rect(x, y, width, height);
          const roi = src.roi(rect);
          // 关键修复：使用 copyTo 将 ROI 复制到一个新的 Mat 中
          dst = new self.cv.Mat();
          roi.copyTo(dst);
          roi.delete(); // 清理临时的 ROI header
        } else {
          // 如果裁剪参数无效，则返回原始图像，避免崩溃
          console.error('无效的裁剪参数，已回退到原始图像。', params);
          dst = src.clone();
        }
        break;
      }
      case 'rotate': {
        const { angle } = params;
        const center = new self.cv.Point(src.cols / 2, src.rows / 2);
        const matrix = self.cv.getRotationMatrix2D(center, angle, 1.0);
        
        // 计算旋转后的边界框
        const rad = Math.abs(angle) * Math.PI / 180;
        const sin = Math.abs(Math.sin(rad));
        const cos = Math.abs(Math.cos(rad));
        const newWidth = Math.ceil(src.cols * cos + src.rows * sin);
        const newHeight = Math.ceil(src.cols * sin + src.rows * cos);
        
        // 调整旋转矩阵以考虑平移
        matrix.data64F[2] += (newWidth / 2) - center.x;
        matrix.data64F[5] += (newHeight / 2) - center.y;
        
        dst = new self.cv.Mat();
        self.cv.warpAffine(src, dst, matrix, new self.cv.Size(newWidth, newHeight));
        matrix.delete();
        break;
      }
      case 'flip': {
        const { mode } = params;
        dst = new self.cv.Mat();
        self.cv.flip(src, dst, mode); // 0: x轴翻转(水平), 1: y轴翻转(垂直), -1: 同时翻转
        break;
      }
      case 'brightness': {
        const { delta } = params;
        dst = new self.cv.Mat();
        src.convertTo(dst, -1, 1, delta); // -1 表示与输入相同的类型
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
        self.cv.cvtColor(src, dst, self.cv.COLOR_RGBA2RGB); // 饱和度调整通常在 HSV 空间
        self.cv.cvtColor(dst, dst, self.cv.COLOR_RGB2HSV);
        
        const channels = new self.cv.MatVector();
        self.cv.split(dst, channels);
        const satChannel = channels.get(1);
        satChannel.convertTo(satChannel, -1, factor, 0);
        self.cv.merge(channels, dst);
        
        self.cv.cvtColor(dst, dst, self.cv.COLOR_HSV2RGB);
        self.cv.cvtColor(dst, dst, self.cv.COLOR_RGB2RGBA);
        
        channels.delete();
        satChannel.delete(); // 虽然satChannel是指向channels的，但显式删除更安全
        break;
      }
      case 'emboss': {
        dst = new self.cv.Mat();
        const kernel = self.cv.matFromArray(3, 3, self.cv.CV_32F, [-2, -1, 0, -1, 1, 1, 0, 1, 2]);
        self.cv.filter2D(src, dst, self.cv.CV_8U, kernel, new self.cv.Point(-1, -1), 128);
        kernel.delete();
        break;
      }
      case 'sepia': {
        dst = new self.cv.Mat();
        // 复古效果的转换矩阵
        const M = self.cv.matFromArray(3, 4, self.cv.CV_32F, [
          0.272, 0.534, 0.131, 0,
          0.349, 0.686, 0.168, 0,
          0.393, 0.769, 0.189, 0,
        ]);
        self.cv.transform(src, dst, M);
        M.delete();
        // OpenCV的transform可能会改变通道数，确保输出是4通道
        if (dst.channels() === 3) {
            self.cv.cvtColor(dst, dst, self.cv.COLOR_RGB2RGBA);
        }
        break;
      }
      case 'colorBalance': {
        const { red = 0, green = 0, blue = 0 } = params;
        dst = new self.cv.Mat();
        const channels = new self.cv.MatVector();
        self.cv.split(src, channels);

        // 调整 B, G, R 通道 (OpenCV中顺序是 BGR)
        const bChannel = channels.get(0);
        const gChannel = channels.get(1);
        const rChannel = channels.get(2);
        
        self.cv.add(bChannel, new self.cv.Mat(src.rows, src.cols, self.cv.CV_8U, new self.cv.Scalar(blue)), bChannel);
        self.cv.add(gChannel, new self.cv.Mat(src.rows, src.cols, self.cv.CV_8U, new self.cv.Scalar(green)), gChannel);
        self.cv.add(rChannel, new self.cv.Mat(src.rows, src.cols, self.cv.CV_8U, new self.cv.Scalar(red)), rChannel);

        self.cv.merge(channels, dst);
        channels.delete();
        // bChannel, gChannel, rChannel 只是引用，不需要单独 delete
        break;
      }
      case 'blur': {
        const ksize = (params && params.ksize) || 5; // 提供默认值
        // 确保 ksize 是一个奇数
        const validKsize = ksize % 2 === 0 ? ksize + 1 : ksize;
        dst = new self.cv.Mat();
        const kernelSize = new self.cv.Size(validKsize, validKsize);
        self.cv.GaussianBlur(src, dst, kernelSize, 0);
        break;
      }
      case 'grayscale': {
        dst = new self.cv.Mat();
        self.cv.cvtColor(src, dst, self.cv.COLOR_RGBA2GRAY, 0);
        // 为了显示，需要转换回RGBA
        self.cv.cvtColor(dst, dst, self.cv.COLOR_GRAY2RGBA, 0);
        break;
      }
      case 'canny': {
        // Canny 输出的是单通道灰度图
        const temp = new self.cv.Mat();
        self.cv.cvtColor(src, temp, self.cv.COLOR_RGBA2GRAY, 0);
        dst = new self.cv.Mat();
        self.cv.Canny(temp, dst, 50, 100, 3, false);
        // 为了显示，需要转换回RGBA
        self.cv.cvtColor(dst, dst, self.cv.COLOR_GRAY2RGBA, 0);
        temp.delete();
        break;
      }
      case 'threshold': {
        // Threshold 输出的是单通道灰度图
        const temp = new self.cv.Mat();
        self.cv.cvtColor(src, temp, self.cv.COLOR_RGBA2GRAY, 0);
        dst = new self.cv.Mat();
        self.cv.threshold(temp, dst, 127, 255, self.cv.THRESH_BINARY);
        // 为了显示，需要转换回RGBA
        self.cv.cvtColor(dst, dst, self.cv.COLOR_GRAY2RGBA, 0);
        temp.delete();
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
    
    // 使用传入的 OffscreenCanvas Context 直接渲染，不再返回数据
    const targetCanvas = ctx.canvas;
    targetCanvas.width = dst.cols;
    targetCanvas.height = dst.rows;

    // 解决方案：由于 worker 中没有 HTMLCanvasElement，我们不使用 cv.imshow(canvas, mat)
    // 而是创建一个 ImageData，用 mat 的数据填充它，然后用 putImageData 渲染
    const imageData = ctx.createImageData(dst.cols, dst.rows);
    // 修复：直接从 dst.data 设置数据，之前的参数是错误的
    imageData.data.set(dst.data);
    ctx.putImageData(imageData, 0, 0);

    // 将 ImageData 返回，以便 worker 可以将其发送回主线程用于历史记录
    return imageData;

  } catch (error) {
    console.error(`OpenCV operation '${op}' failed:`, error);
    // 抛出更具体的错误信息
    const errorMessage = error.message || 'An unknown error occurred';
    throw new Error(`处理 '${op}' 操作时出错: ${errorMessage}`);
  } finally {
    // 清理内存
    src.delete();
    if (dst && !dst.isDeleted()) {
      dst.delete();
    }
  }
} 