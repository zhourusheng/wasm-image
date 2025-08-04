import React, { useEffect, useRef, Suspense, lazy } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Toolbar from './components/layout/Toolbar';
import Canvas from './components/layout/Canvas';
import useImageProcessing from './hooks/useImageProcessing';
import useEditorStore from './store/editorStore';
import useUiStore from './store/uiStore';

// 懒加载的组件 - 这些组件不会包含在初始bundle中
const ParamsPanel = lazy(() => import('./components/panels/ParamsPanel'));
const ExportPanel = lazy(() => import('./components/panels/ExportPanel'));
const CollageMode = lazy(() => import('./components/modes/CollageMode'));

const App: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const { handleWorkerMessage } = useImageProcessing();
  const { setImageWorker, activeTool, isCollageMode } = useEditorStore();

  useEffect(() => {
    // 告诉 Vite 将 worker 文件作为模块内联处理
    const worker = new Worker(
      new URL('./utils/imageWorker.js?worker&inline', import.meta.url)
    );
    setImageWorker(worker);

    worker.onmessage = (e: MessageEvent) => {
      const { type } = e.data;

      if (type === 'opencv-loaded') {
        useEditorStore.getState().setOpenCVLoaded(true);
      } else if (type === 'worker-ready') {
        useEditorStore.getState().setWorkerReady(true);
      }

      handleWorkerMessage(e);
    };

    return () => worker.terminate();
  }, [handleWorkerMessage, setImageWorker]);

  return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <div
          className={`flex-1 flex overflow-hidden ${
            isCollageMode ? 'hidden' : 'flex'
          }`}
        >
          <Toolbar />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Canvas containerRef={canvasContainerRef} />
            <Footer containerRef={canvasContainerRef} />
          </div>
          {activeTool && (
            <Suspense
              fallback={
                <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-300 dark:border-gray-600 flex items-center justify-center">
                  <div className="text-sm text-gray-500">加载中...</div>
                </div>
              }
            >
              <ParamsPanel />
            </Suspense>
          )}
        </div>

        {isCollageMode && (
          <Suspense
            fallback={
              <div className="flex-1 bg-white dark:bg-gray-800 flex items-center justify-center">
                <div className="text-sm text-gray-500">加载拼贴模式...</div>
              </div>
            }
          >
            <CollageMode />
          </Suspense>
        )}
      </div>

      {/* 导出面板作为弹窗 */}
      <Suspense fallback={null}>
        <ExportPanel />
      </Suspense>
    </div>
  );
};

export default App;