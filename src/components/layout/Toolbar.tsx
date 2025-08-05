import { Tooltip } from 'antd';
import {
  Aperture,
  Contrast,
  Crop,
  Droplets,
  Eclipse,
  FlipHorizontal,
  FlipVertical,
  History,
  Palette,
  PersonStanding,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Smile,
  Sparkles,
  SquarePen,
  Sun,
  Type,
  Wand2,
} from 'lucide-react';
import React from 'react';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import type { FilterParams, ToolType } from '../../types';
import notificationService from '../../utils/notificationService';

// ToolButton组件的Props接口
interface ToolButtonProps {
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  title: string;
}

// 完全自定义ToolButton组件
const ToolButton: React.FC<ToolButtonProps> = ({
  icon,
  isActive = false,
  onClick,
  disabled = false,
  title,
}) => {
  return (
    <Tooltip title={title} placement="right">
      <div
        className={`w-12 h-12 flex items-center justify-center cursor-pointer transition-colors ${
          isActive
            ? 'bg-blue-500 text-white'
            : 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        onClick={!disabled ? onClick : undefined}
      >
        <div className="flex items-center justify-center">{icon}</div>
      </div>
    </Tooltip>
  );
};

const Toolbar: React.FC = () => {
  const { currentImage } = useImageStore();
  const { activeTool, setActiveTool, setCropMode } = useEditorStore();
  const { loading } = useUiStore();
  const { processEdit } = useImageProcessing();

  // 工具激活处理
  const handleToolActivate = (
    toolName: ToolType,
    defaultParams: FilterParams = {}
  ): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }

    // 如果再次点击同一个工具图标，则取消操作
    if (activeTool === toolName) {
      setActiveTool(null);
      return;
    }

    // 设置新工具并立即应用一次默认效果作为预览
    setActiveTool(toolName, defaultParams);
    if (Object.keys(defaultParams).length > 0) {
      processEdit(toolName as string, defaultParams, true);
    }
  };

  // 裁剪工具处理
  const handleCropModeToggle = (): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    setCropMode(true);
  };

  // 直接应用效果（无需参数面板）的工具
  const handleDirectEffect = (effect: string): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit(effect);
  };

  // 图像变换工具
  const handleRotateCw = (): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit('rotate', { angle: 90 });
  };

  const handleRotateCcw = (): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit('rotate', { angle: -90 });
  };

  const handleFlipH = (): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit('flip', { mode: 0 });
  };

  const handleFlipV = (): void => {
    if (!currentImage) {
      notificationService.warning('请先上传一张图片');
      return;
    }
    processEdit('flip', { mode: 1 });
  };

  return (
    <aside className="w-20 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-2 flex flex-col items-center space-y-2 text-xs overflow-y-auto">
      {/* 调整工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          调整
        </span>
        <ToolButton
          icon={<Sun size={20} />}
          title="亮度"
          isActive={activeTool === 'brightness'}
          onClick={() => handleToolActivate('brightness', { delta: 0 })}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Contrast size={20} />}
          title="对比度"
          isActive={activeTool === 'contrast'}
          onClick={() => handleToolActivate('contrast', { factor: 1 })}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Droplets size={20} />}
          title="饱和度"
          isActive={activeTool === 'saturation'}
          onClick={() => handleToolActivate('saturation', { factor: 1 })}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Palette size={20} />}
          title="色彩平衡"
          isActive={activeTool === 'colorBalance'}
          onClick={() =>
            handleToolActivate('colorBalance', { red: 0, green: 0, blue: 0 })
          }
          disabled={!currentImage || loading}
        />
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 效果工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          效果
        </span>
        <ToolButton
          icon={<SlidersHorizontal size={20} />}
          title="灰度"
          onClick={() => handleDirectEffect('grayscale')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Aperture size={20} />}
          title="模糊"
          isActive={activeTool === 'blur'}
          onClick={() => handleToolActivate('blur', { ksize: 5 })}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<SquarePen size={20} />}
          title="边缘检测"
          onClick={() => handleDirectEffect('canny')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Eclipse size={20} />}
          title="阈值"
          onClick={() => handleDirectEffect('threshold')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Wand2 size={20} />}
          title="浮雕"
          onClick={() => handleDirectEffect('emboss')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<History size={20} />}
          title="复古"
          onClick={() => handleDirectEffect('sepia')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<Sparkles size={20} />}
          title="图像增强"
          onClick={() => handleDirectEffect('enhance')}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<PersonStanding size={20} />}
          title="背景去除"
          onClick={() => handleDirectEffect('removeBackground')}
          disabled={!currentImage || loading}
        />
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 水印工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          水印
        </span>
        <ToolButton
          icon={<Type size={20} />}
          title="文字水印"
          isActive={activeTool === 'watermark'}
          onClick={() =>
            handleToolActivate('watermark', {
              type: 'text',
              text: '水印文字',
              x: 50,
              y: 50,
              fontSize: 36,
              color: '#ffffff',
              opacity: 0.8,
              fontFamily: 'Arial',
              bold: false,
              italic: false,
              scale: 0.3,
              imageData: null,
            })
          }
          disabled={!currentImage || loading}
        />
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* AI美颜工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          AI美颜
        </span>
        <ToolButton
          icon={<Smile size={20} />}
          title="人脸美颜"
          isActive={activeTool === 'faceBeauty'}
          onClick={() =>
            handleToolActivate('faceBeauty', {
              skinSmooth: 30,
              skinWhiten: 20,
              faceSlim: 15,
              eyeEnlarge: 10,
              enabled: true,
            })
          }
          disabled={!currentImage || loading}
        />
      </div>

      <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>

      {/* 变换工具组 */}
      <div className="flex flex-col items-center space-y-1 w-full">
        <span className="font-medium text-gray-500 dark:text-gray-400">
          变换
        </span>
        <ToolButton
          icon={<Crop size={20} />}
          title="裁剪"
          onClick={handleCropModeToggle}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<RotateCw size={20} />}
          title="顺时针旋转"
          onClick={handleRotateCw}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<RotateCcw size={20} />}
          title="逆时针旋转"
          onClick={handleRotateCcw}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<FlipHorizontal size={20} />}
          title="水平翻转"
          onClick={handleFlipH}
          disabled={!currentImage || loading}
        />
        <ToolButton
          icon={<FlipVertical size={20} />}
          title="垂直翻转"
          onClick={handleFlipV}
          disabled={!currentImage || loading}
        />
      </div>
    </aside>
  );
};

export default Toolbar;
