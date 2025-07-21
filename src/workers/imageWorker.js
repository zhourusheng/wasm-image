// src/workers/imageWorker.js

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

    if (type === 'image-process') {
        if (self.cv) {
            processImage(payload.imageData, payload.action, payload.params);
        } else {
            // This should not happen if the UI waits for 'opencv-loaded'
            console.error("OpenCV 尚未准备好。");
            postMessage({ type: 'error', payload: 'OpenCV 尚未就绪。' });
        }
    }
};

function processImage(imageData, action, params) {
    try {
        const src = self.cv.matFromImageData(imageData);
        let dst = new self.cv.Mat();
        
        // Some operations require a grayscale image
        const needsGrayscale = ['canny', 'threshold'];
        let processSrc = src;
        if (needsGrayscale.includes(action)) {
            processSrc = new self.cv.Mat();
            self.cv.cvtColor(src, processSrc, self.cv.COLOR_RGBA2GRAY, 0);
        }

        switch (action) {
            case 'grayscale':
                self.cv.cvtColor(src, dst, self.cv.COLOR_RGBA2GRAY, 0);
                break;
            case 'blur':
                let ksize = new self.cv.Size(25, 25);
                self.cv.blur(src, dst, ksize, new self.cv.Point(-1, -1), self.cv.BORDER_DEFAULT);
                break;
            case 'canny':
                self.cv.Canny(processSrc, dst, 50, 100, 3, false);
                break;
            case 'threshold':
                self.cv.threshold(processSrc, dst, 127, 255, self.cv.THRESH_BINARY);
                break;
            case 'crop':
                const rect = new self.cv.Rect(params.x, params.y, params.width, params.height);
                console.log('OpenCV裁剪参数:', rect);
                console.log('源图像尺寸:', src.cols, 'x', src.rows);
                
                // 确保裁剪区域在图像范围内
                if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > src.cols || rect.y + rect.height > src.rows) {
                    console.error('裁剪区域超出图像范围，进行调整');
                    rect.x = Math.max(0, Math.min(rect.x, src.cols - 1));
                    rect.y = Math.max(0, Math.min(rect.y, src.rows - 1));
                    rect.width = Math.min(rect.width, src.cols - rect.x);
                    rect.height = Math.min(rect.height, src.rows - rect.y);
                }
                
                // 确保裁剪区域有效
                if (rect.width <= 0 || rect.height <= 0) {
                    console.error('无效的裁剪区域，使用原图');
                    src.copyTo(dst);
                } else {
                    try {
                        // 直接创建一个新的Mat，并使用src的ROI区域数据
                        dst = new self.cv.Mat();
                        const roi = src.roi(rect);
                        roi.copyTo(dst);
                        console.log('裁剪后尺寸:', dst.cols, 'x', dst.rows);
                        roi.delete(); // 释放临时ROI Mat
                    } catch (e) {
                        console.error('裁剪操作失败:', e);
                        // 出错时使用原图
                        src.copyTo(dst);
                    }
                }
                break;
            case 'rotate':
                let dsize = new self.cv.Size(src.rows, src.cols);
                let center = new self.cv.Point(src.cols / 2, src.rows / 2);
                let M = self.cv.getRotationMatrix2D(center, params.angle, 1);
                self.cv.warpAffine(src, dst, M, dsize, self.cv.INTER_LINEAR, self.cv.BORDER_CONSTANT, new self.cv.Scalar());
                M.delete();
                break;
            case 'flip':
                self.cv.flip(src, dst, params.mode);
                break;
            case 'original':
            default:
                // No action or unknown action, just clone the source
                src.copyTo(dst);
                break;
        }

        if (processSrc !== src) {
            processSrc.delete();
        }

        let displayMat = dst;
        // 如果处理后的图像是单通道，转换为RGBA以便显示
        if (dst.channels() === 1) {
            displayMat = new self.cv.Mat();
            self.cv.cvtColor(dst, displayMat, self.cv.COLOR_GRAY2RGBA);
        }
        
        // 确保结果图像有效
        if (!displayMat || displayMat.empty()) {
            console.error('处理后的图像无效');
            self.postMessage({ type: 'error', payload: '图像处理失败，结果无效' });
            return;
        }
        
        // 创建ImageData对象
        try {
            const newImageData = new ImageData(
                new Uint8ClampedArray(displayMat.data),
                displayMat.cols,
                displayMat.rows
            );
            
            console.log('处理后图像尺寸:', displayMat.cols, 'x', displayMat.rows);
            self.postMessage({ type: 'image-processed', payload: { imageData: newImageData } });
        } catch (e) {
            console.error('创建ImageData失败:', e);
            self.postMessage({ type: 'error', payload: '创建图像数据失败: ' + e.toString() });
        }
        
        src.delete();
        // If roi was used, dst is a reference not a new Mat, so don't delete it if it's pointing to src's data
        dst.delete();
        if (displayMat !== dst) {
            displayMat.delete();
        }

    } catch (error) {
        console.error("processImage 中出错:", error);
        self.postMessage({ type: 'error', payload: error.toString() });
    }
} 