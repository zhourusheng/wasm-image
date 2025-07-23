import React, { useRef } from 'react';
import { ImagePlay, Folder, Copy, GripVertical, FileOutput } from 'lucide-react';
import { Button, Tooltip } from 'antd'; // 引入 Tooltip
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useCollageStore from '../../store/collageStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import { loadImageFromFile, copyImageToClipboard, getImageDataFromImage } from '../../utils/imageUtils';

const Header = () => {
  const { image, getCurrentImageData, originalFileInfo, setOriginalFileInfo, setImage } = useImageStore();
  const { isCollageMode, setIsCollageMode } = useEditorStore();
  const { loading, openExportPanel } = useUiStore();
  const { setInitialImage } = useCollageStore();
  const { processNewImage } = useImageProcessing();
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // 1. 保存文件信息到 store
      setOriginalFileInfo({ size: file.size, name: file.name });
      
      // 2. 从文件加载图片对象
      const loadedImage = await loadImageFromFile(file);
      
      // 3. 将图片对象保存到 store 以更新UI
      setImage(loadedImage);
      
      // 4. 从图片对象获取 ImageData
      const imageData = getImageDataFromImage(loadedImage);

      // 5. 将 ImageData 发送给 worker 处理
      processNewImage(imageData);

    } catch (error) {
      console.error("文件加载失败:", error);
      alert("加载图片失败: " + error.message);
    }
    
    e.target.value = null;
  };

  const handleCopyClick = async () => {
    const canvas = document.getElementById('canvas');
    if (!canvas) {
      alert('请先上传一张图片');
      return;
    }
    try {
      await copyImageToClipboard(canvas);
      alert('已复制到剪贴板！');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleEnterCollageMode = () => {
    if (image) {
      if (confirm('您想将当前编辑的图片添加到拼接中吗？')) {
        const currentImageData = getCurrentImageData();
        setInitialImage({
          imageData: currentImageData,
          name: originalFileInfo.name || `image-${Date.now()}.png`
        });
      } else {
        setInitialImage(null);
      }
    }
    setIsCollageMode(true);
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
              <Button type="text" icon={<Folder size={20} />} onClick={handleUploadClick} />
            </Tooltip>
            <Tooltip title="复制图像">
              <Button type="text" icon={<Copy size={20} />} onClick={handleCopyClick} disabled={!image || loading} />
            </Tooltip>
            <Tooltip title="图片拼接">
              <Button type="text" icon={<GripVertical size={20} />} onClick={handleEnterCollageMode} disabled={loading} />
            </Tooltip>
            <Tooltip title="导出图像">
              <Button type="text" icon={<FileOutput size={20} />} onClick={openExportPanel} disabled={!image || loading} />
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