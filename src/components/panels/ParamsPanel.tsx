import { UploadOutlined } from '@ant-design/icons';
import {
  Button,
  ColorPicker,
  Image,
  Input,
  Radio,
  Select,
  Slider,
  Switch,
  Upload,
} from 'antd';
import React from 'react';
import { useImageProcessing } from '../../hooks/useImageProcessing';
import useEditorStore from '../../store/editorStore';
import type { FilterParams } from '../../types';

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

// 水印控制面板（支持文字和图片水印）
const WatermarkControls: React.FC<ControlProps> = ({ params, onChange }) => {
  const type = (params.type as string) || 'text'; // 'text' 或 'image'
  const text = (params.text as string) || '水印文字';
  const x = (params.x as number) || 50;
  const y = (params.y as number) || 50;
  const fontSize = (params.fontSize as number) || 36;
  const color = (params.color as string) || '#ffffff';
  const opacity = (params.opacity as number) || 0.8;
  const fontFamily = (params.fontFamily as string) || 'Arial';
  const bold = (params.bold as boolean) || false;
  const italic = (params.italic as boolean) || false;
  const imageData = params.imageData as string; // base64 图片数据
  const scale = (params.scale as number) || 0.3; // 图片缩放比例

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    onChange({ ...params, text: e.target.value });
  };

  const handlePositionXChange = (value: number): void => {
    onChange({ ...params, x: value });
  };

  const handlePositionYChange = (value: number): void => {
    onChange({ ...params, y: value });
  };

  const handleFontSizeChange = (value: number): void => {
    onChange({ ...params, fontSize: value });
  };

  const handleColorChange = (color: any): void => {
    const hexColor = typeof color === 'string' ? color : color.toHexString();
    onChange({ ...params, color: hexColor });
  };

  const handleOpacityChange = (value: number): void => {
    onChange({ ...params, opacity: value });
  };

  const handleFontFamilyChange = (value: string): void => {
    onChange({ ...params, fontFamily: value });
  };

  const handleBoldChange = (checked: boolean): void => {
    onChange({ ...params, bold: checked });
  };

  const handleItalicChange = (checked: boolean): void => {
    onChange({ ...params, italic: checked });
  };

  const handleTypeChange = (e: any): void => {
    onChange({ ...params, type: e.target.value });
  };

  const handleScaleChange = (value: number): void => {
    onChange({ ...params, scale: value });
  };

  const handleImageUpload = (file: File): boolean => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      onChange({ ...params, imageData: result });
    };
    reader.readAsDataURL(file);
    return false; // 阻止默认上传行为
  };

  return (
    <div className="space-y-4">
      {/* 水印类型选择 */}
      <div>
        <label className="text-sm font-medium mb-2 block">水印类型</label>
        <Radio.Group value={type} onChange={handleTypeChange}>
          <Radio value="text">文字水印</Radio>
          <Radio value="image">图片水印</Radio>
        </Radio.Group>
      </div>

      {/* 文字水印配置 */}
      {type === 'text' && (
        <div>
          <label className="text-sm font-medium mb-2 block">水印文字</label>
          <Input
            value={text}
            onChange={handleTextChange}
            placeholder="请输入水印文字"
            maxLength={50}
          />
        </div>
      )}

      {/* 图片水印配置 */}
      {type === 'image' && (
        <div>
          <label className="text-sm font-medium mb-2 block">上传水印图片</label>
          <Upload
            beforeUpload={handleImageUpload}
            showUploadList={false}
            accept="image/*"
          >
            <Button icon={<UploadOutlined />}>选择图片</Button>
          </Upload>
          {imageData && (
            <div className="mt-2">
              <Image
                width={100}
                src={imageData}
                preview={false}
                style={{ border: '1px solid #d9d9d9', borderRadius: '4px' }}
              />
            </div>
          )}
        </div>
      )}

      {/* 位置控制 */}
      <div>
        <label className="text-sm font-medium mb-2 block">水平位置: {x}%</label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={x}
          onChange={handlePositionXChange}
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-2 block">垂直位置: {y}%</label>
        <Slider
          min={0}
          max={100}
          step={1}
          value={y}
          onChange={handlePositionYChange}
        />
      </div>

      {/* 图片缩放控制 */}
      {type === 'image' && (
        <div>
          <label className="text-sm font-medium mb-2 block">
            图片大小: {(scale * 100).toFixed(0)}%
          </label>
          <Slider
            min={0.1}
            max={2}
            step={0.1}
            value={scale}
            onChange={handleScaleChange}
          />
        </div>
      )}

      {/* 字体设置 - 仅文字水印 */}
      {type === 'text' && (
        <>
          <div>
            <label className="text-sm font-medium mb-2 block">字体</label>
            <Select
              value={fontFamily}
              onChange={handleFontFamilyChange}
              style={{ width: '100%' }}
              options={[
                { value: 'Arial', label: 'Arial' },
                { value: 'Helvetica', label: 'Helvetica' },
                { value: 'Times New Roman', label: 'Times New Roman' },
                { value: 'Georgia', label: 'Georgia' },
                { value: 'Verdana', label: 'Verdana' },
                { value: 'Courier New', label: 'Courier New' },
                { value: 'Microsoft YaHei', label: '微软雅黑' },
                { value: 'SimHei', label: '黑体' },
                { value: 'SimSun', label: '宋体' },
              ]}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">
              字体大小: {fontSize}px
            </label>
            <Slider
              min={12}
              max={120}
              step={2}
              value={fontSize}
              onChange={handleFontSizeChange}
            />
          </div>

          {/* 颜色 - 仅文字水印 */}
          <div>
            <label className="text-sm font-medium mb-2 block">颜色</label>
            <ColorPicker
              value={color}
              onChange={handleColorChange}
              showText
              style={{ width: '100%' }}
            />
          </div>
        </>
      )}

      <div>
        <label className="text-sm font-medium mb-2 block">
          透明度: {(opacity * 100).toFixed(0)}%
        </label>
        <Slider
          min={0.1}
          max={1}
          step={0.1}
          value={opacity}
          onChange={handleOpacityChange}
        />
      </div>

      {/* 字体样式 - 仅文字水印 */}
      {type === 'text' && (
        <div className="flex space-x-4">
          <div className="flex items-center space-x-2">
            <Switch checked={bold} onChange={handleBoldChange} size="small" />
            <span className="text-sm">粗体</span>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              checked={italic}
              onChange={handleItalicChange}
              size="small"
            />
            <span className="text-sm">斜体</span>
          </div>
        </div>
      )}
    </div>
  );
};

// 人脸美颜控制面板
const FaceBeautyControls: React.FC<ControlProps> = ({ params, onChange }) => {
  const skinSmooth = (params.skinSmooth as number) || 30;
  const skinWhiten = (params.skinWhiten as number) || 20;
  const faceSlim = (params.faceSlim as number) || 15;
  const eyeEnlarge = (params.eyeEnlarge as number) || 10;
  const enabled = (params.enabled as boolean) !== false;

  const handleSkinSmoothChange = (value: number): void => {
    onChange({ ...params, skinSmooth: value });
  };

  const handleSkinWhitenChange = (value: number): void => {
    onChange({ ...params, skinWhiten: value });
  };

  const handleFaceSlimChange = (value: number): void => {
    onChange({ ...params, faceSlim: value });
  };

  const handleEyeEnlargeChange = (value: number): void => {
    onChange({ ...params, eyeEnlarge: value });
  };

  const handleEnabledChange = (checked: boolean): void => {
    onChange({ ...params, enabled: checked });
  };

  return (
    <div className="space-y-4">
      {/* 美颜开关 */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">启用美颜</label>
        <Switch checked={enabled} onChange={handleEnabledChange} />
      </div>

      {enabled && (
        <>
          {/* 磨皮 */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              磨皮: {skinSmooth}%
            </label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={skinSmooth}
              onChange={handleSkinSmoothChange}
              tooltip={{ formatter: value => `${value}%` }}
            />
            <div className="text-xs text-gray-500 mt-1">
              平滑皮肤纹理，减少瑕疵
            </div>
          </div>

          {/* 美白 */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              美白: {skinWhiten}%
            </label>
            <Slider
              min={0}
              max={100}
              step={1}
              value={skinWhiten}
              onChange={handleSkinWhitenChange}
              tooltip={{ formatter: value => `${value}%` }}
            />
            <div className="text-xs text-gray-500 mt-1">
              提亮肤色，增加光泽感
            </div>
          </div>

          {/* 瘦脸 */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              瘦脸: {faceSlim}%
            </label>
            <Slider
              min={0}
              max={50}
              step={1}
              value={faceSlim}
              onChange={handleFaceSlimChange}
              tooltip={{ formatter: value => `${value}%` }}
            />
            <div className="text-xs text-gray-500 mt-1">
              收缩脸部轮廓，塑造立体感
            </div>
          </div>

          {/* 大眼 */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              大眼: {eyeEnlarge}%
            </label>
            <Slider
              min={0}
              max={30}
              step={1}
              value={eyeEnlarge}
              onChange={handleEyeEnlargeChange}
              tooltip={{ formatter: value => `${value}%` }}
            />
            <div className="text-xs text-gray-500 mt-1">
              适度放大眼部，增加灵动感
            </div>
          </div>

          {/* 提示信息 */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div className="text-xs text-blue-600 dark:text-blue-400">
              💡
              提示：AI美颜会自动检测人脸区域进行处理，建议从较低强度开始调整。
            </div>
          </div>
        </>
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
  watermark: '文字水印',
  faceBeauty: '人脸美颜',
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
      case 'watermark':
        return (
          <WatermarkControls
            params={toolParams}
            onChange={handleParamsChange}
          />
        );
      case 'faceBeauty':
        return (
          <FaceBeautyControls
            params={toolParams}
            onChange={handleParamsChange}
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
