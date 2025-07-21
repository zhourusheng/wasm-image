// src/workers/imageWorker.js
importScripts('/src/wasm/wasmBridge.js'); // 导入 wasm 图像处理函数

// This is the correct way to load and initialize emscripten modules in a worker.
// 1. Define the Module object
// 2. Pre-fetch the wasm binary
// 3. Import the javascript glue code
self.Module = {
    // Don't run the main loop
    noInitialRun: true,
    // When the runtime is initialized, post a message to the main thread
    onRuntimeInitialized: () => {
        // self.cv is the global object that opencv.js creates.
        postMessage({ type: 'opencv-loaded' });
    },
    // We will fetch the wasm binary ourselves and place it here
    wasmBinary: null,
};

let offscreenCanvas = null;
let ctx = null;

// Fetch the wasm binary and then import the script
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
                try {
                    const resultImageData = await self.wasmProcessImage(payload.imageData, payload.action, payload.params, ctx);
                    // 将包含 ArrayBuffer 的结果发送回主线程，并将其标记为可转移
                    postMessage({ type: 'image-processed', payload: { imageData: resultImageData } }, [resultImageData.data.buffer]);
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

// 原始的 processImage 函数已被移除，因为它现在由 wasmBridge.js 提供 