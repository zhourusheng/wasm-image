import { useState, useRef, useEffect } from 'react';
import { FILTERS } from './utils/filters';
import HistoryManager from './utils/historyManager';

const history = new HistoryManager();

function App() {
  const [image, setImage] = useState(null);
  const canvasRef = useRef(null);
  const [opencvLoaded, setOpencvLoaded] = useState(false);
  const workerRef = useRef(null);
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    workerRef.current = new Worker(new URL('./workers/imageWorker.js', import.meta.url));

    workerRef.current.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'opencv-loaded') {
        setOpencvLoaded(true);
        console.log('OpenCV loaded in worker');
      } else if (type === 'image-processed') {
        const { imageData } = payload;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        ctx.putImageData(imageData, 0, 0);
        history.add(imageData);
        setLoading(false);
      } else if (type === 'error') {
        console.error('Error from worker:', payload);
        setLoading(false);
      }
    };

    return () => {
      workerRef.current.terminate();
    };
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImage(img);
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          history.clear();
          history.add(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const applyFilter = (filter) => {
    if (!image || !opencvLoaded) return;
    setLoading(true);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    workerRef.current.postMessage({ type: 'image-process', payload: { imageData, action: filter } });
  };

  const handleUndo = () => {
    if (!history.canUndo()) return;
    const lastState = history.undo();
    if (lastState) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = lastState.width;
      canvas.height = lastState.height;
      ctx.putImageData(lastState, 0, 0);
    }
  };

  const handleRedo = () => {
    if (!history.canRedo()) return;
    const nextState = history.redo();
    if (nextState) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      canvas.width = nextState.width;
      canvas.height = nextState.height;
      ctx.putImageData(nextState, 0, 0);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center my-4">Wasm Image Filter</h1>
      
      <div className="my-4">
        <label className="block mb-2 text-sm font-medium text-gray-900" htmlFor="file_input">Upload file</label>
        <input 
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none" 
          id="file_input" 
          type="file" 
          onChange={handleImageUpload} 
          accept="image/*"
        />
      </div>

      {opencvLoaded ? <p className="text-center text-green-500">OpenCV Ready</p> : <p className="text-center text-red-500">Loading OpenCV...</p>}
      {loading && <p className="text-center">Processing...</p>}

      <div className="flex justify-center my-4 space-x-2">
        <button onClick={handleUndo} disabled={!history.canUndo()} className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400">Undo</button>
        <button onClick={handleRedo} disabled={!history.canRedo()} className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400">Redo</button>
      </div>

      <div className="my-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            onClick={() => applyFilter(filter.id)}
            disabled={!image || !opencvLoaded || loading}
            className="px-4 py-2 bg-indigo-500 text-white rounded disabled:bg-gray-400"
          >
            {filter.name}
          </button>
        ))}
      </div>

      <div className="flex justify-center">
        <canvas ref={canvasRef} className="border border-gray-400"></canvas>
      </div>

    </div>
  );
}

export default App; 