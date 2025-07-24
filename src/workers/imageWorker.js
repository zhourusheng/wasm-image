// src/workers/imageWorker.js

/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 * （注意：此类直接内联在此文件中，以避免在非模块 Worker 中处理导入/导出的复杂性）
 */
class PerformanceTimer {
  constructor(operationName, metadata = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.step('start');
  }

  step(stepName) {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

  end() {
    this.step('end');
    const totalTime = this.lastStepTime - this.startTime;
    return {
      operation: this.operationName,
      metadata: this.metadata,
      totalTime: parseFloat(totalTime.toFixed(2)),
      steps: this.steps,
      timestamp: new Date().toISOString(),
    };
  }
}

// --- 在 Worker 中运行的高效纯 JS 滤镜 ---

function applySepiaJS(imageData) {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const newR = r * 0.393 + g * 0.769 + b * 0.189;
    const newG = r * 0.349 + g * 0.686 + b * 0.168;
    const newB = r * 0.272 + g * 0.534 + b * 0.131;
    data[i] = Math.min(255, newR);
    data[i+1] = Math.min(255, newG);
    data[i+2] = Math.min(255, newB);
  }
  return imageData;
}

function applyGrayscaleJS(imageData) {
  const data = imageData.data;
  const LUMINANCE_R = 0.299, LUMINANCE_G = 0.587, LUMINANCE_B = 0.114;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const gray = r * LUMINANCE_R + g * LUMINANCE_G + b * LUMINANCE_B;
    data[i] = data[i+1] = data[i+2] = gray;
  }
  return imageData;
}

function applyBrightnessJS(imageData, params) {
  const data = imageData.data;
  const delta = params.delta || 0;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.max(0, Math.min(255, data[i] + delta));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] + delta));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] + delta));
  }
  return imageData;
}

function applyContrastJS(imageData, params) {
  const data = imageData.data;
  const factor = params.factor || 1;
  const intercept = 128 - factor * 128;
  for (let i = 0; i < data.length; i += 4) {
    data[i]   = Math.max(0, Math.min(255, data[i] * factor + intercept));
    data[i+1] = Math.max(0, Math.min(255, data[i+1] * factor + intercept));
    data[i+2] = Math.max(0, Math.min(255, data[i+2] * factor + intercept));
  }
  return imageData;
}

const pureJsFilters = {
    sepia: applySepiaJS,
    grayscale: applyGrayscaleJS,
    brightness: applyBrightnessJS,
    contrast: applyContrastJS,
};

// --- Worker 设置与消息处理 ---

import { wasmProcessImage } from '../wasm/wasmBridge.js'; 

self.Module = {
    noInitialRun: true,
    onRuntimeInitialized: () => {
        postMessage({ type: 'opencv-loaded' });
    },
    wasmBinary: null,
};

let offscreenCanvas = null;
let ctx = null;

(async () => {
    try {
        const response = await fetch('https://wasm-worker.oss-cn-nanjing.aliyuncs.com/opencv.wasm');
        if (!response.ok) {
            throw new Error(`加载 wasm 失败： ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        self.Module.wasmBinary = buffer;
        self.importScripts('https://wasm-worker.oss-cn-nanjing.aliyuncs.com/opencv.js');
    } catch (error) {
        console.error("在 worker 中加载 OpenCV 失败:", error);
        postMessage({ type: 'error', payload: '初始化 OpenCV 失败。' });
    }
})();


self.onmessage = async (e) => {
    const { type, payload } = e.data;

    switch (type) {
        case 'init':
            offscreenCanvas = payload.canvas;
            ctx = offscreenCanvas.getContext('2d');
            console.log('Worker: OffscreenCanvas 初始化成功');
            postMessage({ type: 'worker-ready' });
            break;
        case 'image-process':
            const jsFilter = pureJsFilters[payload.action];

            if (!self.cv && !jsFilter) {
                 console.error("OpenCV 尚未准备好。");
                 postMessage({ type: 'error', payload: 'OpenCV 尚未就绪。' });
                 return;
            }
            if (!ctx) {
                console.error("OffscreenCanvas 尚未初始化。");
                postMessage({ type: 'error', payload: 'OffscreenCanvas 尚未初始化。' });
                return;
            }

            const timer = new PerformanceTimer(payload.action, {
                width: payload.imageData.width,
                height: payload.imageData.height,
            });

            try {
                let resultImageData;

                if (jsFilter) {
                    timer.step('js_filter_start');
                    // 直接修改了 payload.imageData
                    resultImageData = jsFilter(payload.imageData, payload.params);
                    timer.step('js_filter_end');

                    // 由于 JS 方案不经过 Wasm，需要手动渲染
                    ctx.canvas.width = resultImageData.width;
                    ctx.canvas.height = resultImageData.height;
                    
                    // 新增：如果有skipRendering标记，跳过绘制到canvas
                    if (!payload.skipRendering) {
                        ctx.putImageData(resultImageData, 0, 0);
                        timer.step('render_to_offscreen');
                    }

                } else {
                    // 对于所有其他操作，使用 WebAssembly
                    resultImageData = await wasmProcessImage(
                        payload.imageData, 
                        payload.action, 
                        payload.params, 
                        ctx, 
                        timer, 
                        payload.skipRendering // 传递skipRendering参数给wasmProcessImage
                    );
                }

                timer.step('image_processed_in_worker');
                const perfLog = timer.end();
                
                postMessage(
                    { 
                        type: 'image-processed', 
                        payload: { 
                            imageData: resultImageData, 
                            isHistoryNavigation: payload.isHistoryNavigation || false,
                            perfLog: perfLog,
                        } 
                    }, 
                    [resultImageData.data.buffer]
                );
            } catch (error) {
                console.error("图像处理时发生错误:", error);
                postMessage({ type: 'error', payload: error.message });
            }
            break;
    }
}; 