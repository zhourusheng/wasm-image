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


importScripts('/src/wasm/wasmBridge.js'); // 导入 wasm 图像处理函数

// 这是在 worker 中加载和初始化 emscripten 模块的正确方法。
self.Module = {
    noInitialRun: true,
    onRuntimeInitialized: () => {
        postMessage({ type: 'opencv-loaded' });
    },
    wasmBinary: null,
};

let offscreenCanvas = null;
let ctx = null;

// 获取 wasm 二进制文件，然后导入脚本
(async () => {
    try {
        const response = await fetch('/js/opencv.wasm');
        if (!response.ok) {
            throw new Error(`加载 wasm 失败： ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        self.Module.wasmBinary = buffer;
        self.importScripts('/js/opencv.js');
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
            if (self.cv && ctx) {
                 const timer = new PerformanceTimer(payload.action, {
                    width: payload.imageData.width,
                    height: payload.imageData.height,
                });
                try {
                    const resultImageData = await self.wasmProcessImage(payload.imageData, payload.action, payload.params, ctx, timer);
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
            } else if (!self.cv) {
                console.error("OpenCV 尚未准备好。");
                postMessage({ type: 'error', payload: 'OpenCV 尚未就绪。' });
            } else {
                console.error("OffscreenCanvas 尚未初始化。");
                postMessage({ type: 'error', payload: 'OffscreenCanvas 尚未初始化。' });
            }
            break;
    }
}; 