import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Slider, Button, Tooltip, Spin } from 'antd'; // 引入 Tooltip
import useCollageStore from '../../store/collageStore';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import { getImageDataFromImage } from '../../utils/imageUtils';

const CanvasPreview = ({ imageData }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && imageData) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
    }
  }, [imageData]);

  return <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-lg" />;
};

const CollageMode = () => {
  const { 
    images, 
    layout, 
    options, 
    previewData, 
    loading, 
    reset: resetCollage,
    setLayout,
    updateOptions,
    addImages,
    removeImage,
    generatePreview,
  } = useCollageStore();
  
  const { setIsCollageMode } = useEditorStore();
  const { processNewImage } = useImageProcessing();
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    if (images.length > 0) {
      generatePreview();
    }
  }, [images.length]);

  const handleFileChange = (e) => {
    addImages(e.target.files);
    e.target.value = null;
  };
  
  const handleApply = async () => {
    if (!previewData) {
      alert("没有可应用的拼接图像。");
      return;
    }

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = previewData.width;
      tempCanvas.height = previewData.height;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.putImageData(previewData, 0, 0);

      const blob = await new Promise(resolve => tempCanvas.toBlob(resolve, 'image/png'));
      const newImage = new Image();
      const newImageSrc = URL.createObjectURL(blob);
      
      newImage.onload = () => {
        const newImageData = getImageDataFromImage(newImage);
        processNewImage(newImageData);
        
        useImageStore.getState().setImage(newImage);
        useImageStore.getState().setOriginalFileInfo({ size: blob.size, name: 'collage.png' });
        
        URL.revokeObjectURL(newImageSrc);
        handleExit();
      };
      
      newImage.src = newImageSrc;
    } catch (error) {
      console.error("处理拼接图像时出错:", error);
      alert("处理拼接后的图像时发生错误。");
    }
  };
  
  const handleExit = () => {
    resetCollage();
    setIsCollageMode(false);
  };

  return (
    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-900 z-30 flex">
      {/* 左侧设置面板 */}
      <aside className="w-80 bg-white dark:bg-gray-800 p-4 overflow-y-auto flex flex-col border-r border-gray-300 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">图片拼接</h2>
        
        <div className="space-y-4">
          <div>
            <label className="font-medium">布局</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Tooltip title="垂直布局">
                <Button onClick={() => setLayout('vertical')} type={layout === 'vertical' ? 'primary' : 'default'}>垂直</Button>
              </Tooltip>
              <Tooltip title="水平布局">
                <Button onClick={() => setLayout('horizontal')} type={layout === 'horizontal' ? 'primary' : 'default'}>水平</Button>
              </Tooltip>
              <Tooltip title="网格布局">
                <Button onClick={() => setLayout('grid')} type={layout === 'grid' ? 'primary' : 'default'}>网格</Button>
              </Tooltip>
            </div>
          </div>
          
          {layout === 'grid' && (
            <div>
              <label htmlFor="columns" className="font-medium">列数</label>
              <input 
                id="columns" 
                type="number" 
                min="1" 
                value={options.columns} 
                onChange={e => updateOptions({ columns: parseInt(e.target.value, 10) || 1 })} 
                className="w-full mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700" 
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">间距: {options.gap}px</label>
            <Slider min={0} max={100} step={1} value={options.gap} onChange={(val) => updateOptions({ gap: val })} />
          </div>

          <div>
            <label htmlFor="bgColor" className="font-medium">背景色</label>
            <input 
              id="bgColor" 
              type="color" 
              value={options.backgroundColor} 
              onChange={e => updateOptions({ backgroundColor: e.target.value })} 
              className="w-full h-10 mt-1 p-1" 
            />
          </div>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <h3 className="font-medium mb-2">已添加图片 ({images.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {images.map((img, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <span className="text-sm truncate" title={img.name}>
                  {img.name} ({img.imageData.width}x{img.imageData.height})
                </span>
                <button onClick={() => removeImage(index)} className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          <button 
            onClick={() => fileInputRef.current.click()} 
            className="w-full mt-2 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            添加图片
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="mt-auto pt-4 space-x-2 flex">
          <Button block onClick={handleExit}>取消</Button>
          <Button block type="primary" onClick={handleApply} disabled={!previewData || loading} loading={loading}>
            {loading ? '生成中...' : '应用'}
          </Button>
        </div>
      </aside>
      
      {/* 右侧预览区 */}
      <main className="flex-1 grid place-items-center p-4 overflow-auto relative">
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex justify-center items-center z-10">
            <Spin size="large" tip="正在生成预览..."/>
          </div>
        )}
        
        {previewData && !loading ? (
          <CanvasPreview imageData={previewData} />
        ) : (
          !loading && <div className="text-center text-gray-500">请添加图片以开始拼接</div>
        )}
      </main>
    </div>
  );
};

export default CollageMode; 