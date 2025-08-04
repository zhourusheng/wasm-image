// wasmBridge.ts
// 使用 OpenCV.js 的 JavaScript API

import type { ImageDataInterface, FilterParams, PerformanceMetrics } from '../types';

// 声明Worker全局作用域中的OpenCV
declare const self: DedicatedWorkerGlobalScope & {
  cv?: any;
  Module?: any;
};

// 性能计时器接口（内联版本）
interface PerformanceTimer {
  step(stepName: string): void;
  end(): PerformanceMetrics;
}

let opencvReady = false;

// 在 classic worker 中, 我们需要将函数附加到 self 全局对象
export async function wasmInit(): Promise<void> {
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

// 修改函数以接收 ctx 和 timer 并直接渲染
export async function wasmProcessImage(
  imageData: ImageDataInterface, 
  op: string, 
  params: FilterParams, 
  ctx: OffscreenCanvasRenderingContext2D, 
  timer: PerformanceTimer, 
  skipRendering: boolean = false
): Promise<ImageDataInterface> {
  if (!timer) {
    throw new Error("A PerformanceTimer instance must be provided.");
  }
  
  await wasmInit();
  timer.step('wasm_initialized');
  
  // 创建 OpenCV Mat 对象
  const src = self.cv.matFromImageData(imageData);
  let dst: any;
  timer.step('mat_from_imagedata');
  
  try {
    switch (op) {
      case 'crop': {
        const { x, y, width, height } = params as {
          x: number;
          y: number;
          width: number;
          height: number;
        };
        
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
        const { angle } = params as { angle: number };
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
        const { mode } = params as { mode: number };
        dst = new self.cv.Mat();
        self.cv.flip(src, dst, mode); // 0: x轴翻转(水平), 1: y轴翻转(垂直), -1: 同时翻转
        break;
      }
      
      case 'brightness': {
        const { delta } = params as { delta: number };
        dst = new self.cv.Mat();
        // 优化方案：使用 cv.add 替代通用的 convertTo
        // 创建一个与 src 大小相同，填充了 delta 值的矩阵
        const deltaMat = new self.cv.Mat(src.rows, src.cols, src.type(), new self.cv.Scalar(delta, delta, delta, 0));
        self.cv.add(src, deltaMat, dst); // 执行高效的矩阵加法
        deltaMat.delete(); // 清理临时矩阵
        break;
      }
      
      case 'contrast': {
        const { factor } = params as { factor: number };
        dst = new self.cv.Mat();
        src.convertTo(dst, -1, factor, 0);
        break;
      }
      
      case 'saturation': {
        const { factor } = params as { factor: number };
        
        // "终极"优化方案的 JS 模拟：
        // 直接在 Worker 中用一个循环完成所有计算，避免多次调用 Wasm 函数的开销。
        // 这模拟了单一 C++/Wasm 函数的架构，性能会远超之前的实现。
        const data = imageData.data;
        const R_LUMINANCE = 0.299, G_LUMINANCE = 0.587, B_LUMINANCE = 0.114;

        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          
          // 计算亮度 (grayscale value)
          const gray = r * R_LUMINANCE + g * G_LUMINANCE + b * B_LUMINANCE;

          // 应用饱和度公式: NewColor = Gray + factor * (Color - Gray)
          // 并确保结果在 0-255 范围内
          data[i] = Math.max(0, Math.min(255, gray + factor * (r - gray)));
          data[i + 1] = Math.max(0, Math.min(255, gray + factor * (g - gray)));
          data[i + 2] = Math.max(0, Math.min(255, gray + factor * (b - gray)));
        }

        // 尽管我们在 JS 中直接修改了数据，但为了适应现有的渲染流程，
        // 我们需要将修改后的数据重新转换回 Mat 对象。
        // 这个转换的开销远小于之前多个 OpenCV 函数调用的总开销。
        dst = self.cv.matFromImageData(imageData);
        break;
      }
      
      case 'emboss': {
        // 优化方案：在灰度图上应用卷积，将计算量减少为 1/3
        const gray = new self.cv.Mat();
        self.cv.cvtColor(src, gray, self.cv.COLOR_RGBA2GRAY);

        dst = new self.cv.Mat();
        const kernel = self.cv.matFromArray(3, 3, self.cv.CV_32F, [-2, -1, 0, -1, 1, 1, 0, 1, 2]);
        
        // 在单通道灰度图上执行 filter2D
        self.cv.filter2D(gray, dst, self.cv.CV_8U, kernel, new self.cv.Point(-1, -1), 128);
        
        kernel.delete();
        gray.delete();

        // 将结果转换回 RGBA 以便显示
        self.cv.cvtColor(dst, dst, self.cv.COLOR_GRAY2RGBA);
        break;
      }
      
      case 'sepia': {
        // 优化方案：手动计算通道，避免通用的、较慢的 cv.transform
        dst = new self.cv.Mat();
        const channels = new self.cv.MatVector();
        self.cv.split(src, channels);

        const r = channels.get(0);
        const g = channels.get(1);
        const b = channels.get(2);

        // Sepia 公示:
        // newR = R * 0.393 + G * 0.769 + B * 0.189
        // newG = R * 0.349 + G * 0.686 + B * 0.168
        // newB = R * 0.272 + G * 0.534 + B * 0.131
        
        // 为了在 OpenCV 中高效计算，我们创建临时 Mat
        const newR = new self.cv.Mat();
        const newG = new self.cv.Mat();
        const newB = new self.cv.Mat();
        
        // 计算 newR
        const r_r = new self.cv.Mat();
        const r_g = new self.cv.Mat();
        const r_b = new self.cv.Mat();
        self.cv.multiply(r, new self.cv.Mat(r.rows, r.cols, r.type(), new self.cv.Scalar(0.393)), r_r);
        self.cv.multiply(g, new self.cv.Mat(g.rows, g.cols, g.type(), new self.cv.Scalar(0.769)), r_g);
        self.cv.multiply(b, new self.cv.Mat(b.rows, b.cols, b.type(), new self.cv.Scalar(0.189)), r_b);
        self.cv.add(r_r, r_g, newR);
        self.cv.add(newR, r_b, newR);

        // 计算 newG
        const g_r = new self.cv.Mat();
        const g_g = new self.cv.Mat();
        const g_b = new self.cv.Mat();
        self.cv.multiply(r, new self.cv.Mat(r.rows, r.cols, r.type(), new self.cv.Scalar(0.349)), g_r);
        self.cv.multiply(g, new self.cv.Mat(g.rows, g.cols, g.type(), new self.cv.Scalar(0.686)), g_g);
        self.cv.multiply(b, new self.cv.Mat(b.rows, b.cols, b.type(), new self.cv.Scalar(0.168)), g_b);
        self.cv.add(g_r, g_g, newG);
        self.cv.add(newG, g_b, newG);

        // 计算 newB
        const b_r = new self.cv.Mat();
        const b_g = new self.cv.Mat();
        const b_b = new self.cv.Mat();
        self.cv.multiply(r, new self.cv.Mat(r.rows, r.cols, r.type(), new self.cv.Scalar(0.272)), b_r);
        self.cv.multiply(g, new self.cv.Mat(g.rows, g.cols, g.type(), new self.cv.Scalar(0.534)), b_g);
        self.cv.multiply(b, new self.cv.Mat(b.rows, b.cols, b.type(), new self.cv.Scalar(0.131)), b_b);
        self.cv.add(b_r, b_g, newB);
        self.cv.add(newB, b_b, newB);

        // 合并新通道
        const newChannels = new self.cv.MatVector();
        newChannels.push_back(newR);
        newChannels.push_back(newG);
        newChannels.push_back(newB);
        newChannels.push_back(channels.get(3)); // 保留原始 alpha 通道
        self.cv.merge(newChannels, dst);

        // 清理所有中间创建的 Mat 对象
        channels.delete();
        newChannels.delete();
        r_r.delete(); r_g.delete(); r_b.delete();
        g_r.delete(); g_g.delete(); g_b.delete();
        b_r.delete(); b_g.delete(); b_b.delete();
        newR.delete(); newG.delete(); newB.delete();
        // r, g, b, a 是指向 channels 内存的引用，不需要单独 delete
        
        break;
      }
      
      case 'colorBalance': {
        const { red = 0, green = 0, blue = 0 } = params as {
          red?: number;
          green?: number;
          blue?: number;
        };
        
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
        const ksize = ((params as { ksize?: number })?.ksize) || 5; // 提供默认值
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
      
      case 'compress': {
        // 在WebAssembly中，我们现在只关心缩放，因为所有压缩逻辑都在主线程的导出面板中处理。
        const { scale = 1.0 } = params as { scale?: number }; 
        
        // 计算新尺寸
        const newWidth = Math.round(src.cols * scale);
        const newHeight = Math.round(src.rows * scale);
        
        dst = new self.cv.Mat();
        const dsize = new self.cv.Size(newWidth, newHeight);
        
        // 使用双线性插值调整图像大小
        self.cv.resize(src, dst, dsize, 0, 0, self.cv.INTER_LINEAR);
        break;
      }
      
      default:
        dst = src.clone();
        break;
    }
    
    timer.step(`operation_${op}`);
    
    // 使用传入的 OffscreenCanvas Context 直接渲染，不再返回数据
    const targetCanvas = ctx.canvas;
    targetCanvas.width = dst.cols;
    targetCanvas.height = dst.rows;

    // 解决方案：由于 worker 中没有 HTMLCanvasElement，我们不使用 cv.imshow(canvas, mat)
    // 而是创建一个 ImageData，用 mat 的数据填充它，然后用 putImageData 渲染
    const resultImageData = ctx.createImageData(dst.cols, dst.rows);
    // 修复：直接从 dst.data 设置数据，之前的参数是错误的
    resultImageData.data.set(dst.data);
    
    // 新增：如果有skipRendering标记，跳过绘制到canvas
    if (!skipRendering) {
      ctx.putImageData(resultImageData, 0, 0);
      timer.step('render_to_offscreen');
    }

    // 将 ImageData 返回，以便 worker 可以将其发送回主线程用于历史记录
    return resultImageData as ImageDataInterface;

  } catch (error) {
    console.error(`OpenCV operation '${op}' failed:`, error);
    // 抛出更具体的错误信息
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`处理 '${op}' 操作时出错: ${errorMessage}`);
  } finally {
    // 清理内存
    src.delete();
    if (dst && !dst.isDeleted()) {
      dst.delete();
    }
    timer.step('memory_cleanup');
  }
}