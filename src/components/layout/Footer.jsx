import React from 'react';
import { ZoomInOutlined, ZoomOutOutlined, EyeOutlined, CompressOutlined, OneToOneOutlined } from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useZoom from '../../hooks/useZoom';

const Footer = ({ containerRef }) => {
  const { image, imageSize, originalImage, originalFileInfo, getCurrentImageData } = useImageStore();
  const { imageWorker, loading } = useEditorStore();
  const { zoom } = useUiStore();
  const { handleManualZoom, resetToFitZoom, resetToOriginalZoom } = useZoom(containerRef);

  const handleCompareStart = () => {
    if (!originalImage || loading) return;
    imageWorker.postMessage({ type: 'image-process', payload: { imageData: originalImage, action: 'original', isHistoryNavigation: true } });
  };

  const handleCompareEnd = () => {
    const currentState = getCurrentImageData();
    if (!currentState || loading) return;
    imageWorker.postMessage({ type: 'image-process', payload: { imageData: currentState, action: 'original', isHistoryNavigation: true } });
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
          <Tooltip title="适应屏幕">
            <Button type="text" icon={<CompressOutlined />} onClick={resetToFitZoom} />
          </Tooltip>
          <Tooltip title="实际尺寸 (100%)">
            <Button type="text" icon={<OneToOneOutlined />} onClick={resetToOriginalZoom} />
          </Tooltip>
          
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <Tooltip title="按住查看原图">
            <Button 
              type="text" 
              icon={<EyeOutlined />}
              onMouseDown={handleCompareStart}
              onMouseUp={handleCompareEnd}
              onMouseLeave={handleCompareEnd}
            />
          </Tooltip>
          
          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <Button type="text" icon={<ZoomOutOutlined />} onClick={() => handleManualZoom(zoom - 0.1)} />
          <span 
            className="w-16 text-center" 
            onDoubleClick={resetToOriginalZoom} 
            title="双击重置为100%"
          >
            {`${Math.round(zoom * 100)}%`}
          </span>
          <Button type="text" icon={<ZoomInOutlined />} onClick={() => handleManualZoom(zoom + 0.1)} />
        </div>
      )}
    </footer>
  );
};

export default Footer; 