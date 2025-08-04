import React, { RefObject } from 'react';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  EyeOutlined,
  CompressOutlined,
  OneToOneOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useZoom from '../../hooks/useZoom';

interface FooterProps {
  containerRef: RefObject<HTMLDivElement>;
}

const Footer: React.FC<FooterProps> = ({ containerRef }) => {
  const { currentImage, originalFileInfo, getCurrentImageData } =
    useImageStore();
  const { imageWorker, zoom } = useEditorStore();
  const { loading } = useUiStore();
  const { handleManualZoom, resetToFitZoom, resetToOriginalZoom } =
    useZoom(containerRef);

  const handleCompareStart = (): void => {
    // 暂时注释掉原图比较功能，因为originalImage字段可能不存在
    // TODO: 实现原图比较功能
    console.log('Compare start - feature not implemented');
  };

  const handleCompareEnd = (): void => {
    // 暂时注释掉原图比较功能
    // TODO: 实现原图比较功能
    console.log('Compare end - feature not implemented');
  };

  const handleZoomOut = (): void => {
    handleManualZoom(zoom - 0.1);
  };

  const handleZoomIn = (): void => {
    handleManualZoom(zoom + 0.1);
  };

  const handleZoomReset = (): void => {
    resetToOriginalZoom();
  };

  return (
    <footer className="h-10 flex-shrink-0 flex items-center justify-center px-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 text-sm z-10 relative">
      {currentImage && (
        <div
          className="absolute left-4 text-gray-500 dark:text-gray-400 truncate max-w-xs"
          title={originalFileInfo.name}
        >
          <span>{originalFileInfo.name}</span>
        </div>
      )}
      <div className="text-center">
        <span>
          {currentImage && currentImage.width > 0
            ? `${currentImage.width}x${currentImage.height}`
            : '无图像'}
        </span>
      </div>
      {currentImage && (
        <div className="absolute right-4 flex items-center space-x-2">
          <Tooltip title="适应屏幕">
            <Button
              type="text"
              icon={<CompressOutlined />}
              onClick={resetToFitZoom}
            />
          </Tooltip>
          <Tooltip title="实际尺寸 (100%)">
            <Button
              type="text"
              icon={<OneToOneOutlined />}
              onClick={resetToOriginalZoom}
            />
          </Tooltip>

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <Tooltip title="按住查看原图">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onMouseDown={handleCompareStart}
              onMouseUp={handleCompareEnd}
              onMouseLeave={handleCompareEnd}
              disabled={loading}
            />
          </Tooltip>

          <div className="w-px h-4 bg-gray-200 dark:bg-gray-600"></div>

          <Button
            type="text"
            icon={<ZoomOutOutlined />}
            onClick={handleZoomOut}
            disabled={loading}
          />
          <span
            className="w-16 text-center cursor-pointer"
            onDoubleClick={handleZoomReset}
            title="双击重置为100%"
          >
            {`${Math.round(zoom * 100)}%`}
          </span>
          <Button
            type="text"
            icon={<ZoomInOutlined />}
            onClick={handleZoomIn}
            disabled={loading}
          />
        </div>
      )}
    </footer>
  );
};

export default Footer;
