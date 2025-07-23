import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useCanvas from '../../hooks/useCanvas';
import useImageProcessing from '../../hooks/useImageProcessing';
import LoadingOverlay from '../common/LoadingOverlay';

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
  <div className="absolute top-2 right-2 flex items-center space-x-2 z-20">
    <button className="icon-btn text-green-500" onClick={onConfirm} title="确认">
      <Check size={20} />
    </button>
    <button className="icon-btn text-red-500" onClick={onCancel} title="取消">
      <X size={20} />
    </button>
  </div>
);

const Canvas = () => {
  const { 
    image, 
    imageSize,
    getCurrentImageData,
    historyManager
  } = useImageStore();
  
  const { 
    isCropMode,
    toggleCropMode,
    cropArea,
    imageWorker, 
    workerReady, 
    opencvLoaded, 
    loading
  } = useEditorStore();

  const { isCanvasRendered, zoom } = useUiStore();
  const { processEdit } = useImageProcessing();
  
  const { 
    canvasRef, 
    cropCanvasRef, 
    canvasContainerRef,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleCanvasMouseUp,
    initCanvasOffscreen
  } = useCanvas();

  // 初始化画布与Worker连接 - 修复：添加监听openCVLoaded状态
  useEffect(() => {
    if (canvasRef.current && imageWorker && opencvLoaded) {
      console.log("开始初始化Canvas与Worker连接");
      const offscreen = canvasRef.current.transferControlToOffscreen();
      imageWorker.postMessage({ 
        type: 'init', 
        payload: { canvas: offscreen } 
      }, [offscreen]);
    }
  }, [canvasRef.current, imageWorker, opencvLoaded]);

  // 裁剪相关
  const handleCropConfirm = () => {
    if (!cropArea || cropArea.width < 10 || cropArea.height < 10) {
      alert('请选择一个有效的裁剪区域');
      return;
    }
    
    // 确保裁剪区域不超出画布边界
    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;

    const safeArea = {
      x: Math.round(Math.max(0, Math.min(cropArea.x, currentImageData.width))),
      y: Math.round(Math.max(0, Math.min(cropArea.y, currentImageData.height))),
      width: Math.round(Math.min(cropArea.width, currentImageData.width - Math.max(0, cropArea.x))),
      height: Math.round(Math.min(cropArea.height, currentImageData.height - Math.max(0, cropArea.y)))
    };
    
    // 将裁剪任务发送给 Worker
    processEdit('crop', safeArea);
    
    // 退出裁剪模式
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

    // 清除并重绘原始图像到裁剪画布
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCanvas.width = currentImageData.width;
    cropCanvas.height = currentImageData.height;
    cropCtx.putImageData(currentImageData, 0, 0);

    if (!cropArea) return; // 如果没有裁剪区域，就只显示图像

    // 绘制半透明遮罩
    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    cropCtx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
    
    // 清除裁剪区域的遮罩
    if (cropArea.width > 0 && cropArea.height > 0) {
      cropCtx.clearRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    }
    
    // 绘制裁剪边框
    cropCtx.strokeStyle = '#00ff00';
    cropCtx.lineWidth = 2;
    cropCtx.strokeRect(cropArea.x, cropArea.y, cropArea.width, cropArea.height);
    
  }, [cropArea, isCropMode, getCurrentImageData, cropCanvasRef]);
  
  // 裁剪模式的样式调整
  useEffect(() => {
    const mainCanvas = canvasRef.current;
    const cropCanvas = cropCanvasRef.current;
    if (!mainCanvas || !cropCanvas) return;

    if (isCropMode) {
      // 关键修复：获取主画布（可能被缩放）的视觉尺寸和位置
      const mainCanvasRect = mainCanvas.getBoundingClientRect();
      // 获取裁剪画布的父容器（即画布区域的根div）的位置
      const parentRect = cropCanvas.parentElement.getBoundingClientRect();

      // 将裁剪画布的CSS样式设置为与主画布的视觉大小和位置完全一致
      cropCanvas.style.width = `${mainCanvasRect.width}px`;
      cropCanvas.style.height = `${mainCanvasRect.height}px`;
      cropCanvas.style.top = `${mainCanvasRect.top - parentRect.top}px`;
      cropCanvas.style.left = `${mainCanvasRect.left - parentRect.left}px`;
      
      // 修复：显示裁剪画布
      cropCanvas.style.display = 'block';
    } else {
      cropCanvas.style.display = 'none';
    }
  }, [isCropMode, imageSize, canvasRef, cropCanvasRef]);

  return (
    <div 
      ref={canvasContainerRef} 
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
      
      {isCropMode && (
        <CropControls 
          onConfirm={handleCropConfirm} 
          onCancel={handleCropCancel} 
        />
      )}
      
      {!image && <EmptyStatePrompt />}
      
      {/* 状态提示 */}
      <div className='absolute bottom-2 right-2 text-sm text-gray-500 bg-white/70 dark:bg-gray-800/70 px-2 py-1 rounded shadow'>
        {loading ? "处理中..." : (workerReady ? "Worker 已就绪" : (opencvLoaded ? "正在初始化Canvas..." : "正在加载 OpenCV..."))}
      </div>
    </div>
  );
};

export default Canvas; 