import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import useCollageStore from '../../store/collageStore';
import useEditorStore from '../../store/editorStore';
import ToolButton from '../common/ToolButton';
import LoadingOverlay from '../common/LoadingOverlay';
import Slider from '../common/Slider';

// 预览画布组件
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
    initialCollageImage,
    setLayout,
    updateOptions,
    addImages,
    removeImage,
    generatePreview,
  } = useCollageStore();
  
  const { setIsCollageMode, setJustExitedCollageMode, setExitModeType } = useEditorStore();
  const fileInputRef = useRef(null);
  
  // 初始化，如果有initialCollageImage，需要生成预览
  useEffect(() => {
    if (images.length > 0) {
      generatePreview();
    }
  }, []);
  
  // 文件上传处理
  const handleFileChange = (e) => {
    addImages(e.target.files);
  };
  
  // 布局和选项变更处理
  const handleLayoutChange = (newLayout) => {
    setLayout(newLayout);
  };
  
  const handleOptionsChange = (newOptions) => {
    updateOptions(newOptions);
  };
  
  // 应用和取消
  const handleApply = () => {
    if (!previewData) {
      alert("没有可应用的拼接图像。");
      return;
    }
    
    // 标记为退出应用拼图模式
    setExitModeType('apply');
    setJustExitedCollageMode(true);
    
    // 退出拼图模式，传入拼接结果
    setIsCollageMode(false);
  };
  
  const handleCancel = () => {
    // 标记为取消退出
    setExitModeType('cancel');
    setJustExitedCollageMode(true);
    
    // 退出拼图模式，不传递结果
    setIsCollageMode(false);
  };

  return (
    <div className="flex-1 flex bg-gray-200 dark:bg-gray-900 overflow-hidden">
      {/* 左侧设置面板 */}
      <aside className="w-80 bg-white dark:bg-gray-800 p-4 overflow-y-auto flex flex-col border-r border-gray-300 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">图片拼接</h2>
        
        <div className="space-y-4">
          <div>
            <label className="font-medium">布局</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <ToolButton 
                icon="垂直"
                title="垂直布局"
                onClick={() => handleLayoutChange('vertical')}
                isActive={layout === 'vertical'}
              />
              <ToolButton 
                icon="水平"
                title="水平布局"
                onClick={() => handleLayoutChange('horizontal')}
                isActive={layout === 'horizontal'}
              />
              <ToolButton 
                icon="网格"
                title="网格布局"
                onClick={() => handleLayoutChange('grid')}
                isActive={layout === 'grid'}
              />
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
                onChange={e => handleOptionsChange({ columns: parseInt(e.target.value, 10) || 1 })} 
                className="w-full mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700" 
              />
            </div>
          )}

          <Slider
            id="gap"
            label={`间距 (${options.gap}px)`}
            min={0}
            max={100}
            step={1}
            value={options.gap}
            onChange={(value) => handleOptionsChange({ gap: value })}
          />

          <div>
            <label htmlFor="bgColor" className="font-medium">背景色</label>
            <input 
              id="bgColor" 
              type="color" 
              value={options.backgroundColor} 
              onChange={e => handleOptionsChange({ backgroundColor: e.target.value })} 
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
          <button 
            onClick={handleCancel} 
            className="flex-1 py-2 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
          >
            取消
          </button>
          <button 
            onClick={handleApply} 
            className="flex-1 py-2 rounded bg-green-500 text-white hover:bg-green-600" 
            disabled={!previewData || loading}
          >
            {loading ? '生成中...' : '应用'}
          </button>
        </div>
      </aside>
      
      {/* 右侧预览区 */}
      <main className="flex-1 grid place-items-center p-4 overflow-auto relative">
        {loading && <LoadingOverlay />}
        
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