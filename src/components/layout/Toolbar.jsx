import React from 'react';
import {
  Sun, Contrast, Droplets, Palette, SlidersHorizontal,
  Crop, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Wand2,
  Aperture, SquarePen, Eclipse, History // 替换字母图标
} from 'lucide-react';
import { Tooltip } from 'antd'; // 只引入Tooltip组件
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import notificationService from '../../utils/notificationService';

// 完全自定义ToolButton组件
const ToolButton = ({ icon, isActive, onClick, disabled, title }) => {
  return (
    <Tooltip title={title} placement="right">
      <div 
        className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-colors ${
          isActive ? 'bg-blue-500 text-white' : 'bg-transparent hover:bg-gray-100 text-gray-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={!disabled ? onClick : undefined}
      >
        <div className="flex items-center justify-center">
          {icon}
        </div>
      </div>
    </Tooltip>
  );
};

const Toolbar = () => {
  const { image, getCurrentImageData } = useImageStore();
  const { activeTool, setActiveTool, setStagedImage, toggleCropMode, loading } = useEditorStore();
  const { processEdit } = useImageProcessing();

  // 工具激活处理
  const handleToolActivate = (toolName, defaultParams = {}) => {
    if (!image) {
      notificationService.warning('请先上传一张图片');
      return;
    }

    // 如果再次点击同一个工具图标，则取消操作，并恢复暂存的图像
    if (activeTool === toolName) {
      const { stagedImage, imageWorker } = useEditorStore.getState();
      if (stagedImage && imageWorker) {
        imageWorker.postMessage({ type: 'image-process', payload: { imageData: stagedImage, action: 'original', isHistoryNavigation: true } });
      }
      setActiveTool(null);
      setStagedImage(null);
      return;
    }

    // 暂存当前图像状态
    const currentState = getCurrentImageData();
    setStagedImage(currentState);

    // 设置新工具并立即应用一次默认效果作为预览
    setActiveTool(toolName, defaultParams);
    if (currentState && Object.keys(defaultParams).length > 0) {
      processEdit(toolName, defaultParams, true);
    }
  };

  // 裁剪工具处理
  const handleCropModeToggle = () => {
    if (!image) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    toggleCropMode();
  };

  // 直接应用效果（无需参数面板）的工具
  const handleDirectEffect = (effect) => {
    if (!image) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit(effect);
  };

  // 图像变换工具
  const handleRotateCw = () => processEdit('rotate', { angle: 90 });
  const handleRotateCcw = () => processEdit('rotate', { angle: -90 });
  const handleFlipH = () => processEdit('flip', { mode: 0 });
  const handleFlipV = () => processEdit('flip', { mode: 1 });

  return (
    <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-2 text-xs overflow-y-auto">
      {/* 调整工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500">调整</span>
        <ToolButton 
          icon={<Sun size={20} />}
          title="亮度"
          isActive={activeTool === 'brightness'}
          onClick={() => handleToolActivate('brightness', { delta: 0 })}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Contrast size={20} />}
          title="对比度"
          isActive={activeTool === 'contrast'}
          onClick={() => handleToolActivate('contrast', { factor: 1 })}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Droplets size={20} />}
          title="饱和度"
          isActive={activeTool === 'saturation'}
          onClick={() => handleToolActivate('saturation', { factor: 1 })}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Palette size={20} />}
          title="色彩平衡"
          isActive={activeTool === 'colorBalance'}
          onClick={() => handleToolActivate('colorBalance', { red: 0, green: 0, blue: 0 })}
          disabled={!image || loading}
        />
      </div>
      
      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 效果工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500">效果</span>
        <ToolButton 
          icon={<SlidersHorizontal size={20} />}
          title="灰度"
          onClick={() => handleDirectEffect('grayscale')}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Aperture size={20} />}
          title="模糊"
          isActive={activeTool === 'blur'}
          onClick={() => handleToolActivate('blur', { ksize: 5 })}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<SquarePen size={20} />}
          title="边缘检测"
          onClick={() => handleDirectEffect('canny')}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Eclipse size={20} />}
          title="阈值"
          onClick={() => handleDirectEffect('threshold')}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<Wand2 size={20} />}
          title="浮雕"
          onClick={() => handleDirectEffect('emboss')}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<History size={20} />}
          title="复古"
          onClick={() => handleDirectEffect('sepia')}
          disabled={!image || loading}
        />
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 变换工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500">变换</span>
        <ToolButton 
          icon={<Crop size={20} />}
          title="裁剪"
          onClick={handleCropModeToggle}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<RotateCw size={20} />}
          title="顺时针旋转"
          onClick={handleRotateCw}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<RotateCcw size={20} />}
          title="逆时针旋转"
          onClick={handleRotateCcw}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<FlipHorizontal size={20} />}
          title="水平翻转"
          onClick={handleFlipH}
          disabled={!image || loading}
        />
        <ToolButton 
          icon={<FlipVertical size={20} />}
          title="垂直翻转"
          onClick={handleFlipV}
          disabled={!image || loading}
        />
      </div>
    </aside>
  );
};

export default Toolbar; 