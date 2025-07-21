// src/workers/imageWorker.js
importScripts('/src/wasm/wasmBridge.js'); // 导入 wasm 图像处理函数

// 这是在 worker 中加载和初始化 emscripten 模块的正确方法。
// 1. 定义 Module 对象
// 2. 预取 wasm 二进制文件
// 3. 导入 javascript 胶水代码
self.Module = {
    // 不运行主循环
    noInitialRun: true,
    // 当运行时初始化时，向主线程发送消息
    onRuntimeInitialized: () => {
        // self.cv 是 opencv.js 创建的全局对象。
        postMessage({ type: 'opencv-loaded' });
    },
    // 我们将自己获取 wasm 二进制文件并放在这里
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