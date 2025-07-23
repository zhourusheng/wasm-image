import React from 'react';
import {
  Sun, Contrast, Droplets, Palette, SlidersHorizontal,
  Crop, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Wand2,
  Aperture, SquarePen, Eclipse, History // 替换字母图标
} from 'lucide-react';
import { Tooltip, Button } from 'antd'; // 引入 Button
import useImageStore from '../../store/imageStore';
import useEditorStore from '../../store/editorStore';
import useUiStore from '../../store/uiStore';
import useImageProcessing from '../../hooks/useImageProcessing';

// 将 ToolButton 的逻辑直接移入 Toolbar
const ToolButton = ({ icon, isActive, ...props }) => {
  return (
    <Button
      type={isActive ? 'primary' : 'text'}
      icon={icon}
      className="!w-12 !h-12 !p-0 !text-center"
      style={{ lineHeight: '48px' }} // 48px is 3rem (h-12)
      {...props}
    />
  );
};

const Toolbar = () => {
  const { image, getCurrentImageData } = useImageStore();
  const { activeTool, setActiveTool, setStagedImage, toggleCropMode, loading } = useEditorStore();
  const { processEdit } = useImageProcessing();

  // 工具激活处理
  const handleToolActivate = (toolName, defaultParams = {}) => {
    if (!image) {
      alert('请先上传一张图片');
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
      alert('请先上传一张图片');
      return;
    }
    toggleCropMode();
  };

  // 直接应用效果（无需参数面板）的工具
  const handleDirectEffect = (effect) => {
    if (!image) {
      alert('请先上传一张图片');
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
        <Tooltip title="亮度" placement="right">
          <ToolButton 
            icon={<Sun size={20} />}
            title="亮度"
            variant="group"
            isActive={activeTool === 'brightness'}
            onClick={() => handleToolActivate('brightness', { delta: 0 })}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="对比度" placement="right">
          <ToolButton 
            icon={<Contrast size={20} />}
            title="对比度"
            variant="group"
            isActive={activeTool === 'contrast'}
            onClick={() => handleToolActivate('contrast', { factor: 1 })}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="饱和度" placement="right">
          <ToolButton 
            icon={<Droplets size={20} />}
            title="饱和度"
            variant="group"
            isActive={activeTool === 'saturation'}
            onClick={() => handleToolActivate('saturation', { factor: 1 })}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="色彩平衡" placement="right">
          <ToolButton 
            icon={<Palette size={20} />}
            title="色彩平衡"
            variant="group"
            isActive={activeTool === 'colorBalance'}
            onClick={() => handleToolActivate('colorBalance', { red: 0, green: 0, blue: 0 })}
            disabled={!image || loading}
          />
        </Tooltip>
      </div>
      
      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 效果工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500">效果</span>
        <Tooltip title="灰度" placement="right">
          <ToolButton 
            icon={<SlidersHorizontal size={20} />}
            title="灰度"
            variant="group"
            onClick={() => handleDirectEffect('grayscale')}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="模糊" placement="right">
          <ToolButton 
            icon={<Aperture size={20} />}
            title="模糊"
            variant="group"
            isActive={activeTool === 'blur'}
            onClick={() => handleToolActivate('blur', { ksize: 5 })}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="边缘检测" placement="right">
          <ToolButton 
            icon={<SquarePen size={20} />}
            title="边缘检测"
            variant="group"
            onClick={() => handleDirectEffect('canny')}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="阈值" placement="right">
          <ToolButton 
            icon={<Eclipse size={20} />}
            title="阈值"
            variant="group"
            onClick={() => handleDirectEffect('threshold')}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="浮雕" placement="right">
          <ToolButton 
            icon={<Wand2 size={20} />}
            title="浮雕"
            variant="group"
            onClick={() => handleDirectEffect('emboss')}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="复古" placement="right">
          <ToolButton 
            icon={<History size={20} />}
            title="复古"
            variant="group"
            onClick={() => handleDirectEffect('sepia')}
            disabled={!image || loading}
          />
        </Tooltip>
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 变换工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500">变换</span>
        <Tooltip title="裁剪" placement="right">
          <ToolButton 
            icon={<Crop size={20} />}
            title="裁剪"
            variant="group"
            onClick={handleCropModeToggle}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="顺时针旋转" placement="right">
          <ToolButton 
            icon={<RotateCw size={20} />}
            title="顺时针旋转"
            variant="group"
            onClick={handleRotateCw}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="逆时针旋转" placement="right">
          <ToolButton 
            icon={<RotateCcw size={20} />}
            title="逆时针旋转"
            variant="group"
            onClick={handleRotateCcw}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="水平翻转" placement="right">
          <ToolButton 
            icon={<FlipHorizontal size={20} />}
            title="水平翻转"
            variant="group"
            onClick={handleFlipH}
            disabled={!image || loading}
          />
        </Tooltip>
        <Tooltip title="垂直翻转" placement="right">
          <ToolButton 
            icon={<FlipVertical size={20} />}
            title="垂直翻转"
            variant="group"
            onClick={handleFlipV}
            disabled={!image || loading}
          />
        </Tooltip>
      </div>
    </aside>
  );
};

export default Toolbar; 