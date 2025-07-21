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
                dst = src.roi(rect);
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
        // If the output is single-channel (like grayscale, canny), convert it back to RGBA for display
        if (dst.channels() === 1) {
            displayMat = new self.cv.Mat();
            self.cv.cvtColor(dst, displayMat, self.cv.COLOR_GRAY2RGBA);
        }
        
        const newImageData = new ImageData(
            new Uint8ClampedArray(displayMat.data),
            displayMat.cols,
            displayMat.rows
        );
        
        self.postMessage({ type: 'image-processed', payload: { imageData: newImageData } });
        
        src.delete();
        // If roi was used, dst is a reference not a new Mat, so don't delete it if it's pointing to src's data
        if (action !== 'crop') {
            dst.delete();
        }
        if (displayMat !== dst) {
            displayMat.delete();
        }

    } catch (error) {
        console.error("processImage 中出错:", error);
        self.postMessage({ type: 'error', payload: error.toString() });
    }
} 