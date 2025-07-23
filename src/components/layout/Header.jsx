import React, { useRef } from 'react';
import { ImagePlay, Folder, Copy, GripVertical, FileOutput } from 'lucide-react';
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import { loadImageFromFile, getImageDataFromImage, copyImageToClipboard } from '../../utils/imageUtils';

const Header = () => {
  const { image, loadImage, setOriginalFileInfo } = useImageStore();
  const { isCollageMode, setIsCollageMode, workerReady } = useEditorStore();
  const { loading, openExportPanel } = useUiStore();
  const { processNewImage } = useImageProcessing();
  const fileInputRef = useRef(null);

  const handleUploadClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      // 保存原始文件信息
      setOriginalFileInfo({ size: file.size, name: file.name });
      
      // 加载图片
      const loadedImage = await loadImageFromFile(file);
      
      // 获取ImageData
      const imageData = getImageDataFromImage(loadedImage);
      
      // 处理新图像
      processNewImage(imageData);
      
      // 更新UI状态 - 这一步必须在processNewImage之后
      useImageStore.getState().setImage(loadedImage);
      
    } catch (error) {
      console.error(error);
      alert(error.message);
    }
    
    // 重置 input 以便可以再次选择相同的文件
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
    // 进入拼图模式
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
            <button className="icon-btn" onClick={handleUploadClick} title="打开文件">
              <Folder size={20} />
            </button>
            <button className="icon-btn" onClick={handleCopyClick} title="复制图像">
              <Copy size={20} />
            </button>
            <button className="icon-btn" onClick={handleEnterCollageMode} disabled={loading} title="图片拼接">
              <GripVertical size={20} />
            </button>
            <button className="icon-btn" onClick={openExportPanel} title="导出图像">
              <FileOutput size={20} />
            </button>
          </>
        ) : (
          <h2 className="font-semibold text-lg text-blue-500">拼图模式</h2>
        )}
      </div>
    </header>
  );
};

export default Header; 