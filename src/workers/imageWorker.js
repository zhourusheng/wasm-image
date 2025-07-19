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
            throw new Error(`Failed to fetch wasm: ${response.status} ${response.statusText}`);
        }
        const buffer = await response.arrayBuffer();
        self.Module.wasmBinary = buffer;
        self.importScripts('/js/opencv.js');
    } catch (error) {
        console.error("Failed to load OpenCV in worker:", error);
        postMessage({ type: 'error', payload: 'Failed to initialize OpenCV.' });
    }
})();


self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'image-process') {
        if (self.cv) {
            processImage(payload.imageData, payload.action);
        } else {
            // This should not happen if the UI waits for 'opencv-loaded'
            console.error("OpenCV is not ready yet.");
            postMessage({ type: 'error', payload: 'OpenCV is not ready.' });
        }
    }
};

function processImage(imageData, action) {
    try {
        const src = self.cv.matFromImageData(imageData);
        const dst = new self.cv.Mat();
        
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
        dst.delete();
        if (displayMat !== dst) {
            displayMat.delete();
        }

    } catch (error) {
        console.error("Error in processImage:", error);
        self.postMessage({ type: 'error', payload: error.toString() });
    }
} 