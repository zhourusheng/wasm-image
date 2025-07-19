// imageWorker.js
import { initWasm, processImage } from '../wasm/wasmBridge.js';

let opencvReady = false;

async function ensureOpenCV() {
  if (!opencvReady) {
    await initWasm();
    opencvReady = true;
  }
}

self.onmessage = async function(e) {
  const { imageData, op, params } = e.data;
  await ensureOpenCV();
  try {
    const result = await processImage(imageData, op, params);
    self.postMessage({ result }, [result.data.buffer]);
  } catch (err) {
    self.postMessage({ error: err.message });
  }
}; 