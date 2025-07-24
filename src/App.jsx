import React, { useEffect, useRef } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Toolbar from './components/layout/Toolbar';
import Canvas from './components/layout/Canvas';
import ParamsPanel from './components/panels/ParamsPanel';
import ExportPanel from './components/panels/ExportPanel';
import CollageMode from './components/modes/CollageMode';
import useImageProcessing from './hooks/useImageProcessing';
import useEditorStore from './store/editorStore';
import useUiStore from './store/uiStore';

function App() {
  const canvasContainerRef = useRef(null);
  const { handleWorkerMessage } = useImageProcessing();
  const { setImageWorker, activeTool, isCollageMode } = useEditorStore();
  
  useEffect(() => {
    // 告诉 Vite 将 worker 文件作为模块内联处理
    const worker = new Worker(new URL('./workers/imageWorker.js?worker&inline', import.meta.url));
    setImageWorker(worker);
    
    worker.onmessage = (e) => {
      const { type } = e.data;
      
      if (type === 'opencv-loaded') {
        useEditorStore.getState().setOpenCVLoaded(true);
      } else if (type === 'worker-ready') {
        useEditorStore.getState().setWorkerReady(true);
      }
      
      handleWorkerMessage(e);
    };
    
    return () => worker.terminate();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <div className={`flex-1 flex overflow-hidden ${isCollageMode ? 'hidden' : 'flex'}`}>
          <Toolbar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Canvas containerRef={canvasContainerRef} />
            <Footer containerRef={canvasContainerRef} />
          </div>
          {activeTool && <ParamsPanel />}
        </div>
        
        {isCollageMode && <CollageMode />}
      </div>
      
      {/* 导出面板作为弹窗 */}
      <ExportPanel />
    </div>
  );
}

export default App; 