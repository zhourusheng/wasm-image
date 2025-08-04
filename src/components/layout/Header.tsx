import React, { useRef } from 'react';
import {
  Folder,
  Copy,
  FileOutput,
  ImagePlay,
  GripVertical,
} from 'lucide-react';
import { Button, Tooltip } from 'antd';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useCollageStore from '../../store/collageStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import {
  loadImageFromFile,
  copyImageToClipboard,
  getImageDataFromImage,
} from '../../utils/imageUtils';
import notificationService from '../../utils/notificationService';

const Header: React.FC = () => {
  const {
    currentImage,
    getCurrentImageData,
    originalFileInfo,
    setOriginalFileInfo,
  } = useImageStore();
  const { isCollageMode, setCollageMode } = useEditorStore();
  const { loading, toggleExportPanel } = useUiStore();
  const { setInitialImage } = useCollageStore();
  const { processNewImage } = useImageProcessing();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = (): void => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // 1. 保存文件信息到 store
      setOriginalFileInfo({ size: file.size, name: file.name });

      // 2. 从文件加载图片对象
      const loadedImage = await loadImageFromFile(file);

      // 3. 从图片对象获取 ImageData
      const imageData = getImageDataFromImage(loadedImage);

      // 4. 将 ImageData 发送给 worker 处理
      processNewImage(imageData);
    } catch (error) {
      console.error('文件加载失败:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      notificationService.error('加载图片失败: ' + errorMessage);
    }

    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  };

  const handleCopyClick = async (): Promise<void> => {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    if (!canvas) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    try {
      await copyImageToClipboard(canvas);
      notificationService.success('已复制到剪贴板！');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '复制失败';
      notificationService.error(errorMessage);
    }
  };

  const handleEnterCollageMode = (): void => {
    if (currentImage) {
      notificationService.confirm(
        '进入拼图模式',
        '您想将当前编辑的图片添加到拼接中吗？',
        () => {
          const currentImageData = getCurrentImageData();
          if (currentImageData) {
            setInitialImage({
              imageData: currentImageData,
              name: originalFileInfo.name || `image-${Date.now()}.png`,
            });
          }
          setCollageMode(true);
        },
        () => {
          setInitialImage(null);
          setCollageMode(true);
        }
      );
    } else {
      setInitialImage(null);
      setCollageMode(true);
    }
  };

  return (
    <header className="flex items-center justify-between px-4 h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 z-10">
      <div className="flex items-center space-x-2">
        <ImagePlay size={28} className="text-blue-500" />
        <h1 className="font-semibold text-lg">Wasm 图像编辑器</h1>
      </div>
      <div className="flex items-center space-x-2">
        {!isCollageMode ? (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/png, image/jpeg, image/webp"
            />
            <Tooltip title="打开文件">
              <Button
                type="text"
                icon={<Folder size={20} />}
                onClick={handleUploadClick}
              />
            </Tooltip>
            <Tooltip title="复制图像">
              <Button
                type="text"
                icon={<Copy size={20} />}
                onClick={handleCopyClick}
                disabled={!currentImage || loading}
              />
            </Tooltip>
            <Tooltip title="图片拼接">
              <Button
                type="text"
                icon={<GripVertical size={20} />}
                onClick={handleEnterCollageMode}
                disabled={loading}
              />
            </Tooltip>
            <Tooltip title="导出图像">
              <Button
                type="text"
                icon={<FileOutput size={20} />}
                onClick={toggleExportPanel}
                disabled={!currentImage || loading}
              />
            </Tooltip>
          </>
        ) : (
          <h2 className="font-semibold text-lg text-blue-500">拼图模式</h2>
        )}
      </div>
    </header>
  );
};

export default Header;
