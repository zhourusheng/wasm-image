import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Slider, Button, Tooltip, Spin } from 'antd';
import useCollageStore from '../../store/collageStore';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import { getImageDataFromImage } from '../../utils/imageUtils';
import notificationService from '../../utils/notificationService';
import type { ImageDataInterface } from '../../types';

// Canvas预览组件Props接口
interface CanvasPreviewProps {
  imageData: ImageDataInterface;
}

// Canvas预览组件
const CanvasPreview: React.FC<CanvasPreviewProps> = ({ imageData }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && imageData) {
      canvas.width = imageData.width;
      canvas.height = imageData.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.putImageData(imageData, 0, 0);
      }
    }
  }, [imageData]);

  return <canvas ref={canvasRef} className="max-w-full max-h-full object-contain shadow-lg" />;
};

// 拼贴布局类型
type CollageLayout = 'vertical' | 'horizontal' | 'grid';

const CollageMode: React.FC = () => {
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
  
  const { setCollageMode } = useEditorStore();
  const { setOriginalFileInfo } = useImageStore();
  const { processNewImage } = useImageProcessing();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 当图片数量变化时重新生成预览
  useEffect(() => {
    if (images.length > 0) {
      generatePreview();
    }
  }, [images.length, generatePreview]);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const files = e.target.files;
    if (files && files.length > 0) {
      addImages(files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  };

  // 处理列数变更
  const handleColumnsChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const columns = parseInt(e.target.value, 10) || 1;
    updateOptions({ columns });
  };

  // 处理背景色变更
  const handleBackgroundColorChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    updateOptions({ backgroundColor: e.target.value });
  };

  // 处理间距变更
  const handleGapChange = (value: number): void => {
    updateOptions({ gap: value });
  };

  // 处理布局变更
  const handleLayoutChange = (newLayout: CollageLayout): void => {
    setLayout(newLayout);
  };

  // 移除图片
  const handleRemoveImage = (index: number): void => {
    removeImage(index);
  };

  // 添加图片按钮点击
  const handleAddImagesClick = (): void => {
    fileInputRef.current?.click();
  };
  
  // 应用拼贴结果
  const handleApply = async (): Promise<void> => {
    if (!previewData) {
      notificationService.warning("没有可应用的拼接图像。");
      return;
    }

    try {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = previewData.width;
      tempCanvas.height = previewData.height;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        throw new Error('无法获取Canvas上下文');
      }
      
      tempCtx.putImageData(previewData, 0, 0);

      const blob = await new Promise<Blob | null>(resolve => 
        tempCanvas.toBlob(resolve, 'image/png')
      );
      
      if (!blob) {
        throw new Error('无法生成图像Blob');
      }
      
      const newImage = new Image();
      const newImageSrc = URL.createObjectURL(blob);
      
      newImage.onload = () => {
        try {
          const newImageData = getImageDataFromImage(newImage);
          processNewImage(newImageData);
          
          // 更新文件信息
          setOriginalFileInfo({ size: blob.size, name: 'collage.png' });
          
          URL.revokeObjectURL(newImageSrc);
          handleExit();
          
          notificationService.success('拼贴图像已应用成功！');
        } catch (error) {
          console.error("处理拼接图像时出错:", error);
          notificationService.error("处理拼接后的图像时发生错误。");
          URL.revokeObjectURL(newImageSrc);
        }
      };
      
      newImage.onerror = () => {
        URL.revokeObjectURL(newImageSrc);
        notificationService.error("加载拼接图像失败。");
      };
      
      newImage.src = newImageSrc;
    } catch (error) {
      console.error("处理拼接图像时出错:", error);
      notificationService.error("处理拼接后的图像时发生错误。");
    }
  };
  
  // 退出拼贴模式
  const handleExit = (): void => {
    resetCollage();
    setCollageMode(false);
  };

  return (
    <div className="absolute inset-0 bg-gray-200 dark:bg-gray-900 z-30 flex">
      {/* 左侧设置面板 */}
      <aside className="w-80 bg-white dark:bg-gray-800 p-4 overflow-y-auto flex flex-col border-r border-gray-300 dark:border-gray-700">
        <h2 className="text-xl font-semibold mb-4">图片拼接</h2>
        
        <div className="space-y-4">
          {/* 布局选择 */}
          <div>
            <label className="font-medium">布局</label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Tooltip title="垂直布局">
                <Button 
                  onClick={() => handleLayoutChange('vertical')} 
                  type={layout === 'vertical' ? 'primary' : 'default'}
                >
                  垂直
                </Button>
              </Tooltip>
              <Tooltip title="水平布局">
                <Button 
                  onClick={() => handleLayoutChange('horizontal')} 
                  type={layout === 'horizontal' ? 'primary' : 'default'}
                >
                  水平
                </Button>
              </Tooltip>
              <Tooltip title="网格布局">
                <Button 
                  onClick={() => handleLayoutChange('grid')} 
                  type={layout === 'grid' ? 'primary' : 'default'}
                >
                  网格
                </Button>
              </Tooltip>
            </div>
          </div>
          
          {/* 网格布局列数设置 */}
          {layout === 'grid' && (
            <div>
              <label htmlFor="columns" className="font-medium">列数</label>
              <input 
                id="columns" 
                type="number" 
                min="1" 
                max="10"
                value={options.columns} 
                onChange={handleColumnsChange} 
                className="w-full mt-1 p-2 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600" 
              />
            </div>
          )}

          {/* 间距设置 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">间距: {options.gap}px</label>
            <Slider 
              min={0} 
              max={100} 
              step={1} 
              value={options.gap} 
              onChange={handleGapChange} 
            />
          </div>

          {/* 背景色设置 */}
          <div>
            <label htmlFor="bgColor" className="font-medium">背景色</label>
            <input 
              id="bgColor" 
              type="color" 
              value={options.backgroundColor} 
              onChange={handleBackgroundColorChange} 
              className="w-full h-10 mt-1 p-1 rounded border border-gray-300 dark:border-gray-600" 
            />
          </div>
        </div>
        
        {/* 图片列表 */}
        <div className="mt-4 pt-4 border-t border-gray-300 dark:border-gray-700">
          <h3 className="font-medium mb-2">已添加图片 ({images.length})</h3>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {images.map((img, index) => (
              <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 p-2 rounded">
                <span className="text-sm truncate" title={img.name}>
                  {img.name} ({img.imageData.width}x{img.imageData.height})
                </span>
                <button 
                  onClick={() => handleRemoveImage(index)} 
                  className="p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-full transition-colors"
                  aria-label="删除图片"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
          
          {/* 添加图片按钮 */}
          <Button 
            block
            type="dashed"
            onClick={handleAddImagesClick} 
            className="mt-2"
          >
            添加图片
          </Button>
          
          {/* 隐藏的文件输入框 */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            multiple 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        {/* 操作按钮 */}
        <div className="mt-auto pt-4 space-x-2 flex">
          <Button block onClick={handleExit}>
            取消
          </Button>
          <Button 
            block 
            type="primary" 
            onClick={handleApply} 
            disabled={!previewData || loading} 
            loading={loading}
          >
            {loading ? '生成中...' : '应用'}
          </Button>
        </div>
      </aside>
      
      {/* 右侧预览区 */}
      <main className="flex-1 grid place-items-center p-4 overflow-auto relative">
        {/* 加载覆盖层 */}
        {loading && (
          <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex justify-center items-center z-10">
            <Spin 
              spinning={true} 
              size="large" 
              tip="正在生成预览..." 
              wrapperClassName="flex flex-col items-center"
            >
              <div style={{ width: 300, height: 100 }} className="opacity-0"></div>
            </Spin>
          </div>
        )}
        
        {/* 预览内容 */}
        {previewData && !loading ? (
          <CanvasPreview imageData={previewData} />
        ) : (
          !loading && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <p className="text-lg mb-2">请添加图片以开始拼接</p>
              <p className="text-sm">支持选择多张图片进行拼接</p>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default CollageMode;