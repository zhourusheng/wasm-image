// imageWorker.js
import { initWasm, processImage } from '../wasm/wasmBridge.js';

let opencvReady = false;

async function ensureOpenCV() {
  if (!opencvReady) {
    try {
      console.log('Worker: 开始加载 OpenCV...');
      
      // 使用 importScripts 加载 OpenCV
      importScripts('/wasm/opencv.js');
      console.log('Worker: OpenCV 脚本加载完成');
      
      // 等待 OpenCV 初始化
      if (typeof self.cv !== 'undefined') {
        console.log('Worker: cv 对象已存在');
        if (self.cv.Mat) {
          console.log('Worker: OpenCV 已初始化');
          opencvReady = true;
        } else {
          console.log('Worker: 等待 OpenCV 运行时初始化...');
          // 等待运行时初始化
          await new Promise((resolve) => {
            self.cv['onRuntimeInitialized'] = () => {
              console.log('Worker: OpenCV 运行时初始化完成');
              opencvReady = true;
              resolve();
            };
          });
        }
      } else {
        console.error('Worker: cv 对象未找到');
        throw new Error('OpenCV 加载失败');
      }
      
      await initWasm();
      console.log('Worker: OpenCV WebAssembly 初始化完成');
    } catch (err) {
      console.error('Worker: OpenCV WebAssembly 初始化失败:', err);
      throw new Error('无法初始化图像处理库: ' + err.message);
    }
  }
}

// 处理来自主线程的消息
self.onmessage = async function(e) {
  const { imageData, op, params } = e.data;
  
  try {
    console.log(`Worker: 收到操作请求: ${op}`);
    
    // 确保 OpenCV 已初始化
    await ensureOpenCV();
    
    console.time(`${op}-operation`);
    const result = await processImage(imageData, op, params);
    console.timeEnd(`${op}-operation`);
    
    console.log(`Worker: 操作 ${op} 完成`);
    
    // 将处理结果发送回主线程，使用 Transferable Objects 提升性能
    self.postMessage({ result }, [result.data.buffer]);
  } catch (err) {
    console.error(`Worker: 处理图像操作 '${op}' 时发生错误:`, err);
    self.postMessage({ 
      error: err.message || '处理图像时发生未知错误',
      operation: op
    });
  }
}; 