import React, { useEffect, useRef } from 'react';
import { Check, X, Undo, Redo, Trash2 } from 'lucide-react';
import { Button, Tooltip } from 'antd'; // 引入 antd 组件
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useCanvas from '../../hooks/useCanvas';
import useImageProcessing from '../../hooks/useImageProcessing';
import LoadingOverlay from '../common/LoadingOverlay';
import notificationService from '../../utils/notificationService';

const EmptyStatePrompt = () => (
  <div className="absolute flex items-center justify-center inset-0">
    <div className="text-center p-8 bg-white/80 dark:bg-gray-900/80 rounded-lg shadow-xl backdrop-blur-sm">
      <h2 className="text-2xl font-semibold mb-2">未加载图像</h2>
      <p className="text-gray-500 dark:text-gray-400">上传一张图片开始编辑</p>
      <button onClick={() => document.querySelector('input[type="file"]').click()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
        上传图片
      </button>
    </div>
  </div>
);

const CropControls = ({ onConfirm, onCancel }) => (
  <div className="flex items-center space-x-2">
    <Tooltip title="确认">
      <Button type="text" icon={<Check size={20} />} onClick={onConfirm} className="text-green-500" />
    </Tooltip>
    <Tooltip title="取消">
      <Button type="text" icon={<X size={20} />} onClick={onCancel} className="text-red-500" />
    </Tooltip>
  </div>
);

const Canvas = ({ containerRef }) => { // 接收 ref
  const { 
    image, 
    imageSize,
    getCurrentImageData,
    canUndo,
    canRedo,
    undo,
    redo,
    originalImage,
    clearHistory,
  } = useImageStore();
  
  const { 
    isCropMode,
    toggleCropMode,
    cropArea,
    imageWorker, 
    workerReady, 
    opencvLoaded, 
    loading,
    clearActiveTool,
  } = useEditorStore();

  const { isCanvasRendered, zoom, setLoading, setUserHasZoomed } = useUiStore();
  const { processEdit } = useImageProcessing();
  
  const { 
    canvasRef, 
    cropCanvasRef, 
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
  } = useCanvas(containerRef); // 传递 ref

  useEffect(() => {
    if (canvasRef.current && imageWorker && opencvLoaded) {
      console.log("开始初始化Canvas与Worker连接");
      const offscreen = canvasRef.current.transferControlToOffscreen();
      imageWorker.postMessage({ 
        type: 'init', 
        payload: { canvas: offscreen } 
      }, [offscreen]);
    }
  }, [canvasRef, imageWorker, opencvLoaded]);

  // 历史记录操作
  const handleUndo = () => {
    if (!canUndo()) return;
    const prevState = undo();
    if (prevState && workerReady) {
      setLoading(true);
      imageWorker.postMessage({ type: 'image-process', payload: { imageData: prevState, action: 'original', isHistoryNavigation: true } });
    }
  };

  const handleRedo = () => {
    if (!canRedo()) return;
    const nextState = redo();
    if (nextState && workerReady) {
      setLoading(true);
      imageWorker.postMessage({ type: 'image-process', payload: { imageData: nextState, action: 'original', isHistoryNavigation: true } });
    }
  };

  const handleRevertToOriginal = () => {
    if (!originalImage || loading) return;

    notificationService.confirm(
      '恢复原始图像', 
      '您确定要撤销所有操作，恢复到原始图像吗？',
      () => {
        setLoading(true);
        clearActiveTool();
        clearHistory();
        setUserHasZoomed(false); // 修复：重置缩放状态
        imageWorker.postMessage({ type: 'image-process', payload: { imageData: originalImage, action: 'original' } });
      }
    );
  };

  // 裁剪相关
  const handleCropConfirm = () => {
    if (!cropArea || cropArea.width < 10 || cropArea.height < 10) {
      notificationService.warning('请选择一个有效的裁剪区域');
      return;
    }
    
    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;

    const safeArea = {
      x: Math.round(Math.max(0, Math.min(cropArea.x, currentImageData.width))),
      y: Math.round(Math.max(0, Math.min(cropArea.y, currentImageData.height))),
      width: Math.round(Math.min(cropArea.width, currentImageData.width - Math.max(0, cropArea.x))),
      height: Math.round(Math.min(cropArea.height, currentImageData.height - Math.max(0, cropArea.y)))
    };
    
    processEdit('crop', safeArea);
    toggleCropMode();
  };
  
  const handleCropCancel = () => {
    toggleCropMode();
  };
  
  // 绘制裁剪选区覆盖层
  useEffect(() => {
    const cropCanvas = cropCanvasRef.current;
    if (!cropCanvas || !isCropMode) return;
    
    const cropCtx = cropCanvas.getContext('2d');
    const currentImageData = getCurrentImageData();
    
    if (!currentImageData) return;

    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCanvas.width = currentImageData.width;
    cropCanvas.height = currentImageData.height;
    cropCtx.putImageData(currentImageData, 0, 0);

    if (!cropArea) return;

    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    if (cropArea.width > 0 && cropArea.height > 0) {
      cropCtx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }
    
    cropCtx.strokeStyle = '#00ff00';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
  }, [cropArea, isCropMode, getCurrentImageData, cropCanvasRef]);
  
  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const cropCanvas = cropCanvasRef.current;
    if (!mainCanvas || !cropCanvas) return;

    if (isCropMode) {
      const mainCanvasRect = mainCanvas.getBoundingClientRect();
      const parentRect = cropCanvas.parentElement.getBoundingClientRect();

      cropCanvas.style.width = `${mainCanvasRect.width}px`;
      cropCanvas.style.height = `${mainCanvasRect.height}px`;
      cropCanvas.style.top = `${mainCanvasRect.top - parentRect.top}px`;
      cropCanvas.style.left = `${mainCanvasRect.left - parentRect.left}px`;
      
      cropCanvas.style.display = 'block';
    } else {
      cropCanvas.style.display = 'none';
    }
  }, [isCropMode, imageSize, zoom, canvasRef, cropCanvasRef]);

  return (
    <main className="flex-1 flex flex-col min-h-0">
      {/* 主内容顶部栏 */}
      <div className="flex items-center justify-between p-2 h-12 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Tooltip title="撤销">
            <Button type="text" icon={<Undo size={20} />} onClick={handleUndo} disabled={!canUndo() || loading} />
          </Tooltip>
          <Tooltip title="重做">
            <Button type="text" icon={<Redo size={20} />} onClick={handleRedo} disabled={!canRedo() || loading} />
          </Tooltip>
          <Tooltip title="重置所有操作">
            <Button type="text" icon={<Trash2 size={20} />} onClick={handleRevertToOriginal} disabled={!image || loading} />
          </Tooltip>
        </div>
        
        {isCropMode && <CropControls onConfirm={handleCropConfirm} onCancel={handleCropCancel} />}
        
        <div className='text-sm text-gray-500'>
          {loading ? "处理中..." : (workerReady ? "Worker 已就绪" : (opencvLoaded ? "正在初始化Canvas..." : "正在加载 OpenCV..."))}
        </div>
      </div>

      {/* 画布区域 */}
      <div 
        ref={containerRef} // 使用传入的 ref
        className="flex-1 grid place-items-center p-4 bg-gray-200 dark:bg-gray-800/30 overflow-auto relative"
      >
        {loading && <LoadingOverlay />}
        
        <canvas 
          id="canvas" 
          ref={canvasRef} 
          className={`shadow-lg rounded-md ${!isCanvasRendered ? 'invisible' : ''}`}
          style={{
            width: `${imageSize.width * zoom}px`,
            height: `${imageSize.height * zoom}px`,
          }}
        ></canvas>
        
        <canvas
          id="crop-canvas"
          ref={cropCanvasRef}
          className="absolute"
          style={{ display: 'none' }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        ></canvas>
        
        {!image && <EmptyStatePrompt />}
      </div>
    </main>
  );
};

export default Canvas; 