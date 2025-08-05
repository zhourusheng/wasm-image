import {
  CompressOutlined,
  EyeOutlined,
  OneToOneOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import React, { RefObject, useRef } from 'react';
import useZoom from '../../hooks/useZoom';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';

interface FooterProps {
  containerRef: RefObject<HTMLDivElement | null>;
}

const Footer: React.FC<FooterProps> = ({ containerRef }) => {
  const { currentImage, originalImage, originalFileInfo, setImage } =
    useImageStore();
  const { zoom, imageWorker, workerReady } = useEditorStore();
  const { loading } = useUiStore();
  const { handleManualZoom, resetToFitZoom, resetToOriginalZoom } =
    useZoom(containerRef);

  // 用于保存比较前的图像状态
  const imageBeforeCompareRef = useRef<typeof currentImage>(null);

  const handleCompareStart = (): void => {
    if (
      !originalImage ||
      !currentImage ||
      loading ||
      !imageWorker ||
      !workerReady
    ) {
      return;
    }

    // 保存当前图像状态
    imageBeforeCompareRef.current = currentImage;

    // 临时切换到原始图像进行显示
    setImage(originalImage);

    // 通过Worker重新渲染原始图像
    imageWorker.postMessage({
      type: 'image-process',
      payload: {
        imageData: originalImage,
        action: 'original',
        isHistoryNavigation: true, // 标记为历史导航，不添加到历史记录
      },
    });
  };

  const handleCompareEnd = (): void => {
    if (
      !imageBeforeCompareRef.current ||
      loading ||
      !imageWorker ||
      !workerReady
    ) {
      return;
    }

    // 恢复比较前的图像状态
    const savedImage = imageBeforeCompareRef.current;
    setImage(savedImage);

    // 通过Worker重新渲染保存的图像
    imageWorker.postMessage({
      type: 'image-process',
      payload: {
        imageData: savedImage,
        action: 'original',
        isHistoryNavigation: true, // 标记为历史导航，不添加到历史记录
      },
    });

    // 清空保存的状态
    imageBeforeCompareRef.current = null;
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

          <Tooltip title={originalImage ? '按住查看原图' : '没有原始图像'}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onMouseDown={handleCompareStart}
              onMouseUp={handleCompareEnd}
              onMouseLeave={handleCompareEnd}
              disabled={loading || !originalImage}
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
