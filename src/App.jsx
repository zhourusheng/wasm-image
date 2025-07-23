import React, { useEffect } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Toolbar from './components/layout/Toolbar';
import Canvas from './components/layout/Canvas';
import ParamsPanel from './components/panels/ParamsPanel';
import ExportPanel from './components/panels/ExportPanel';
import CollageMode from './components/modes/CollageMode';
import useCanvas from './hooks/useCanvas';
import useImageProcessing from './hooks/useImageProcessing';
import useEditorStore from './store/editorStore';
import useUiStore from './store/uiStore';

function App() {
  const { canvasContainerRef } = useCanvas();
  const { handleWorkerMessage } = useImageProcessing();
  const { initWorker, setImageWorker, imageWorker, activeTool, isCollageMode } = useEditorStore();
  const { isExportPanelOpen } = useUiStore();
  
  // 初始化Worker
  useEffect(() => {
    // 初始化Worker并保存实例
    const worker = new Worker(new URL('./workers/imageWorker.js', import.meta.url));
    setImageWorker(worker);
    
    // 创建组合的消息处理函数
    worker.onmessage = (e) => {
      const { type } = e.data;
      console.log("收到Worker消息:", type);
      
      // 基本状态更新 (opencv-loaded, worker-ready)
      if (type === 'opencv-loaded') {
        useEditorStore.getState().setOpenCVLoaded(true);
        console.log("OpenCV 已在 worker 中加载。");
      } else if (type === 'worker-ready') {
        useEditorStore.getState().setWorkerReady(true);
        console.log("Worker 已准备好处理图像。");
      }
      
      // 处理图像数据相关消息
      handleWorkerMessage(e);
    };
    
    return () => {
      worker.terminate();
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        {isCollageMode ? (
          <CollageMode />
        ) : (
          <>
            <Toolbar />
            <div className="flex-1 flex flex-col overflow-hidden">
              <Canvas />
              <Footer canvasContainerRef={canvasContainerRef} />
            </div>
            {activeTool && <ParamsPanel />}
          </>
        )}
        
        {isExportPanelOpen && <ExportPanel />}
      </div>
    </div>
  );
}

export default App; 