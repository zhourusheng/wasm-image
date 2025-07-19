// imageWorker.js
import { initWasm, processImage } from '../wasm/wasmBridge.js';

let opencvReady = false;

// Module workers don't support importScripts, so we need to wait for OpenCV to be loaded and passed from the main thread
let cvPromiseResolve;
const cvPromise = new Promise(resolve => {
  cvPromiseResolve = resolve;
});

async function ensureOpenCV() {
  if (!opencvReady) {
    try {
      await cvPromise; // Wait for OpenCV to be passed from main thread
      await initWasm();
      opencvReady = true;
      console.log('OpenCV WebAssembly 初始化完成');
    } catch (err) {
      console.error('OpenCV WebAssembly 初始化失败:', err);
      throw new Error('无法初始化图像处理库');
    }
  }
}

// 处理来自主线程的消息
self.onmessage = async function(e) {
  const { imageData, op, params, action } = e.data;
  
  // Check if this is the OpenCV initialization message
  if (action === 'init-opencv' && e.data.wasmBinary) {
    // Store the passed cv instance globally
    self.cv = e.data.cv;
    cvPromiseResolve(); // Resolve the promise to signal OpenCV is available
    return;
  }
  
  try {
    // 确保 OpenCV 已初始化
    await ensureOpenCV();
    
    console.time(`${op}-operation`);
    const result = await processImage(imageData, op, params);
    console.timeEnd(`${op}-operation`);
    
    // 将处理结果发送回主线程，使用 Transferable Objects 提升性能
    self.postMessage({ result }, [result.data.buffer]);
  } catch (err) {
    console.error(`处理图像操作 '${op}' 时发生错误:`, err);
    self.postMessage({ 
      error: err.message || '处理图像时发生未知错误',
      operation: op
    });
  }
}; 