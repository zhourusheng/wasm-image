import React from 'react';
import { ZoomIn, ZoomOut, Eye } from 'lucide-react';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useZoom from '../../hooks/useZoom';

const Footer = ({ canvasContainerRef }) => {
  const { image, imageSize, originalImage, originalFileInfo, getCurrentImageData } = useImageStore();
  const { imageWorker, loading } = useEditorStore();
  const { zoom, fitZoom } = useUiStore();
  const { handleManualZoom, resetToFitZoom, resetToOriginalZoom } = useZoom(canvasContainerRef);

  // 原图对比功能
  const handleCompareStart = () => {
    if (!originalImage || loading) return;
    // 发送原始图像用于预览，标记为历史导航以避免存入历史记录
    imageWorker.postMessage({ 
      type: 'image-process', 
      payload: { 
        imageData: originalImage, 
        action: 'original', 
        isHistoryNavigation: true 
      } 
    });
  };

  const handleCompareEnd = () => {
    const currentState = getCurrentImageData();
    if (!currentState || loading) return;
    // 发送当前最新的编辑状态用于预览，恢复视图
    imageWorker.postMessage({ 
      type: 'image-process', 
      payload: { 
        imageData: currentState, 
        action: 'original', 
        isHistoryNavigation: true 
      } 
    });
  };

  return (
    <footer className="h-10 flex-shrink-0 flex items-center justify-center px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm z-10 relative">
      {image && (
        <div className="absolute left-4 text-gray-500 dark:text-gray-400 truncate max-w-xs" title={originalFileInfo.name}>
          <span>{originalFileInfo.name}</span>
        </div>
      )}
      <div className="text-center">
        <span>{imageSize.width > 0 ? `${imageSize.width}x${imageSize.height}` : '无图像'}</span>
      </div>
      {image && (
        <div className="absolute right-4 flex items-center space-x-2">
          <button 
            className="icon-btn"
            title="适应屏幕"
            onClick={resetToFitZoom}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M3 3h6v6M21 21h-6v-6"/></svg>
          </button>
          <button 
            className="icon-btn"
            title="实际尺寸 (100%)"
            onClick={resetToOriginalZoom}
          >
            <span className="font-semibold text-sm">1:1</span>
          </button>
          
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <button 
            className="icon-btn"
            title="按住查看原图"
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
          >
            <Eye size={18} />
          </button>
          
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <button className="icon-btn" onClick={() => handleManualZoom(zoom - 0.1)}>
            <ZoomOut size={18} />
          </button>
          <span 
            className="w-16 text-center" 
            onDoubleClick={resetToOriginalZoom} 
            title="双击重置为100%"
          >
            {`${Math.round(zoom * 100)}%`}
          </span>
          <button className="icon-btn" onClick={() => handleManualZoom(zoom + 0.1)}>
            <ZoomIn size={18} />
          </button>
        </div>
      )}
    </footer>
  );
};

export default Footer; 