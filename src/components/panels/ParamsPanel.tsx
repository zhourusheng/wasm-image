import React from 'react';
import { Slider, Button } from 'antd';
import useEditorStore from '../../store/editorStore';
import useImageProcessing from '../../hooks/useImageProcessing';
import type { FilterParams, ToolType } from '../../types';

// 控制组件通用Props接口
interface ControlProps {
  params: FilterParams;
  onChange: (newParams: FilterParams) => void;
}

// 亮度控制面板
const BrightnessControls: React.FC<ControlProps> = ({ params, onChange }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">亮度: {params.delta || 0}</label>
    <Slider
      min={-100}
      max={100}
      step={1}
      value={(params.delta as number) || 0}
      onChange={(value: number) => onChange({ delta: value })}
    />
  </div>
);

// 对比度控制面板
const ContrastControls: React.FC<ControlProps> = ({ params, onChange }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">
      对比度: {((params.factor as number) || 1).toFixed(1)}
    </label>
    <Slider
      min={0.1}
      max={3}
      step={0.1}
      value={(params.factor as number) || 1}
      onChange={(value: number) => onChange({ factor: value })}
    />
  </div>
);

// 饱和度控制面板
const SaturationControls: React.FC<ControlProps> = ({ params, onChange }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">
      饱和度: {((params.factor as number) || 1).toFixed(1)}
    </label>
    <Slider
      min={0}
      max={3}
      step={0.1}
      value={(params.factor as number) || 1}
      onChange={(value: number) => onChange({ factor: value })}
    />
  </div>
);

// 模糊控制面板
const BlurControls: React.FC<ControlProps> = ({ params, onChange }) => (
  <div className="space-y-2">
    <label className="text-sm font-medium">模糊程度: {params.ksize || 5}</label>
    <Slider
      min={1}
      max={21}
      step={2}
      value={(params.ksize as number) || 5}
      onChange={(value: number) => onChange({ ksize: value })}
    />
  </div>
);

// 色彩平衡控制面板
const ColorBalanceControls: React.FC<ControlProps> = ({ params, onChange }) => {
  const handleRedChange = (value: number): void => {
    onChange({ ...params, red: value });
  };

  const handleGreenChange = (value: number): void => {
    onChange({ ...params, green: value });
  };

  const handleBlueChange = (value: number): void => {
    onChange({ ...params, blue: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-medium text-red-500 mb-2">
          红色: {(params.red as number) || 0}
        </div>
        <Slider
          min={-100}
          max={100}
          step={1}
          value={(params.red as number) || 0}
          onChange={handleRedChange}
        />
      </div>

      <div>
        <div className="text-sm font-medium text-green-500 mb-2">
          绿色: {(params.green as number) || 0}
        </div>
        <Slider
          min={-100}
          max={100}
          step={1}
          value={(params.green as number) || 0}
          onChange={handleGreenChange}
        />
      </div>

      <div>
        <div className="text-sm font-medium text-blue-500 mb-2">
          蓝色: {(params.blue as number) || 0}
        </div>
        <Slider
          min={-100}
          max={100}
          step={1}
          value={(params.blue as number) || 0}
          onChange={handleBlueChange}
        />
      </div>
    </div>
  );
};

// 压缩控制面板
const CompressControls: React.FC<ControlProps> = ({ params, onChange }) => {
  const quality = (params.quality as number) || 0.8;
  const scale = (params.scale as number) || 1;
  const format = (params.format as string) || 'jpeg';

  const handleQualityChange = (value: number): void => {
    onChange({ ...params, quality: value });
  };

  const handleScaleChange = (value: number): void => {
    onChange({ ...params, scale: value });
  };

  const handleFormatChange = (newFormat: string): void => {
    onChange({ ...params, format: newFormat });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">
          压缩质量: {Math.round(quality * 100)}%
        </label>
        <Slider
          min={0.1}
          max={1}
          step={0.1}
          value={quality}
          onChange={handleQualityChange}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">
          调整大小: {Math.round(scale * 100)}%
        </label>
        <Slider
          min={0.1}
          max={1}
          step={0.1}
          value={scale}
          onChange={handleScaleChange}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">图片格式</label>
        <div className="flex gap-2">
          {[
            { value: 'jpeg', label: 'JPEG' },
            { value: 'png', label: 'PNG' },
            { value: 'webp', label: 'WebP' },
          ].map(({ value, label }) => (
            <Button
              key={value}
              size="small"
              type={format === value ? 'primary' : 'default'}
              onClick={() => handleFormatChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {params.previewSize && (
        <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
          <div className="text-sm font-medium">预估大小</div>
          <div className="mt-2">
            <div className="text-sm mb-2">
              原始: {(params.originalSize as string) || '未知'}
            </div>
            <div className="text-sm">
              压缩后: {(params.previewSize as string) || '未知'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 工具名称映射
const TOOL_NAMES: Record<string, string> = {
  brightness: '亮度',
  contrast: '对比度',
  saturation: '饱和度',
  blur: '模糊',
  colorBalance: '色彩平衡',
  compress: '压缩',
};

const ParamsPanel: React.FC = () => {
  const { activeTool, toolParams, updateToolParams, setActiveTool } =
    useEditorStore();
  const { processEdit } = useImageProcessing();

  if (!activeTool) return null;

  // 渲染对应工具的参数控制器
  const renderControls = (): React.ReactNode => {
    switch (activeTool) {
      case 'brightness':
        return (
          <BrightnessControls
            params={toolParams}
            onChange={handleParamsChange}
          />
        );
      case 'contrast':
        return (
          <ContrastControls params={toolParams} onChange={handleParamsChange} />
        );
      case 'saturation':
        return (
          <SaturationControls
            params={toolParams}
            onChange={handleParamsChange}
          />
        );
      case 'blur':
        return (
          <BlurControls params={toolParams} onChange={handleParamsChange} />
        );
      case 'colorBalance':
        return (
          <ColorBalanceControls
            params={toolParams}
            onChange={handleParamsChange}
          />
        );
      case 'compress':
        return (
          <CompressControls
            params={toolParams}
            onChange={handleCompressParamsChange}
          />
        );
      default:
        return <p className="text-sm text-gray-500">该功能无参数可调。</p>;
    }
  };

  // 参数变更处理
  const handleParamsChange = (newParams: FilterParams): void => {
    const updatedParams = { ...toolParams, ...newParams };
    updateToolParams(updatedParams);
    processEdit(activeTool as string, updatedParams, true);
  };

  // 压缩参数变更处理
  const handleCompressParamsChange = (newParams: FilterParams): void => {
    updateToolParams(newParams);

    // 处理图片压缩预览的特殊逻辑
    processEdit(
      'compress',
      {
        ...toolParams,
        ...newParams,
        isCompressPreview: true,
      },
      true
    );
  };

  // 应用工具效果
  const handleApplyTool = (): void => {
    processEdit(activeTool as string, toolParams, false); // isPreview is false to add to history
    setActiveTool(null);
  };

  // 取消工具
  const handleCancelTool = (): void => {
    setActiveTool(null);
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-4">
        {TOOL_NAMES[activeTool as string] || activeTool}
      </h3>

      <div className="flex-1">{renderControls()}</div>

      <div className="pt-4 space-x-2 flex justify-end">
        <Button onClick={handleCancelTool}>取消</Button>
        <Button type="primary" onClick={handleApplyTool}>
          应用
        </Button>
      </div>
    </aside>
  );
};

export default ParamsPanel;
