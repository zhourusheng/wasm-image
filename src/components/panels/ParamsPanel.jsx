import React from 'react';
import { Slider } from 'antd';
import useEditorStore from '../../store/editorStore';
import useImageProcessing from '../../hooks/useImageProcessing';

// 亮度控制面板
const BrightnessControls = ({ params, onChange }) => (
  <Slider
    min={-100} // 修复：字符串改为数字
    max={100}  // 修复：字符串改为数字
    step={1}   // 修复：字符串改为数字
    value={params.delta || 0}
    onChange={(value) => onChange({ delta: value })}
  />
);

// 对比度控制面板
const ContrastControls = ({ params, onChange }) => (
  <Slider
    min={0.1} // 修复：字符串改为数字
    max={3}   // 修复：字符串改为数字
    step={0.1} // 修复：字符串改为数字
    value={params.factor || 1}
    onChange={(value) => onChange({ factor: value })}
  />
);

// 饱和度控制面板
const SaturationControls = ({ params, onChange }) => (
  <Slider
    min={0}   // 修复：字符串改为数字
    max={3}   // 修复：字符串改为数字
    step={0.1} // 修复：字符串改为数字
    value={params.factor || 1}
    onChange={(value) => onChange({ factor: value })}
  />
);

// 模糊控制面板
const BlurControls = ({ params, onChange }) => (
  <Slider
    min={1}   // 修复：字符串改为数字
    max={21}  // 修复：字符串改为数字
    step={2}  // 修复：字符串改为数字
    value={params.ksize || 5}
    onChange={(value) => onChange({ ksize: value })}
  />
);

// 色彩平衡控制面板
const ColorBalanceControls = ({ params, onChange }) => (
  <div className="space-y-4">
    <div className="text-sm font-medium text-red-500">红色: {params.red || 0}</div>
    <Slider min={-100} max={100} step={1} value={params.red || 0} onChange={(val) => onChange({ red: val })} />
    
    <div className="text-sm font-medium text-green-500">绿色: {params.green || 0}</div>
    <Slider min={-100} max={100} step={1} value={params.green || 0} onChange={(val) => onChange({ green: val })} />
    
    <div className="text-sm font-medium text-blue-500">蓝色: {params.blue || 0}</div>
    <Slider min={-100} max={100} step={1} value={params.blue || 0} onChange={(val) => onChange({ blue: val })} />
  </div>
);

// 压缩控制面板
const CompressControls = ({ params, onChange }) => (
  <div className="space-y-4">
    <div>
      <label className="text-sm font-medium">压缩质量: {Math.round((params.quality || 0.8) * 100)}%</label>
      <Slider min={0.1} max={1} step={0.1} value={params.quality || 0.8} onChange={(val) => onChange({ ...params, quality: val })} />
    </div>
    <div>
      <label className="text-sm font-medium">调整大小: {Math.round((params.scale || 1) * 100)}%</label>
      <Slider min={0.1} max={1} step={0.1} value={params.scale || 1} onChange={(val) => onChange({ ...params, scale: val })} />
    </div>
    
    <div className="space-y-2">
      <label className="text-sm font-medium">图片格式</label>
      <div className="flex gap-2">
        <button 
          className={`px-2 py-1 rounded ${params.format === 'image/jpeg' || !params.format ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          onClick={() => onChange({ ...params, format: 'image/jpeg' })}
        >
          JPEG
        </button>
        <button 
          className={`px-2 py-1 rounded ${params.format === 'image/png' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          onClick={() => onChange({ ...params, format: 'image/png' })}
        >
          PNG
        </button>
        <button 
          className={`px-2 py-1 rounded ${params.format === 'image/webp' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-600'}`}
          onClick={() => onChange({ ...params, format: 'image/webp' })}
        >
          WebP
        </button>
      </div>
    </div>
    
    {params.previewSize && (
      <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded">
        <div className="text-sm font-medium">预估大小</div>
        <div className="mt-2">
          <div className="text-sm mb-2">原始: {params.originalSize || '未知'}</div>
          <div className="text-sm">压缩后: {params.previewSize || '未知'}</div>
        </div>
      </div>
    )}
  </div>
);

const ParamsPanel = () => {
  const { activeTool, toolParams, stagedImage, imageWorker, updateToolParams, clearActiveTool } = useEditorStore();
  const { processEdit } = useImageProcessing();

  if (!activeTool) return null;

  // 渲染对应工具的参数控制器
  const renderControls = () => {
    switch (activeTool) {
      case 'brightness':
        return <BrightnessControls params={toolParams} onChange={handleParamsChange} />;
      case 'contrast':
        return <ContrastControls params={toolParams} onChange={handleParamsChange} />;
      case 'saturation':
        return <SaturationControls params={toolParams} onChange={handleParamsChange} />;
      case 'blur':
        return <BlurControls params={toolParams} onChange={handleParamsChange} />;
      case 'colorBalance':
        return <ColorBalanceControls params={toolParams} onChange={handleParamsChange} />;
      case 'compress':
        return <CompressControls params={toolParams} onChange={handleCompressParamsChange} />;
      default:
        return <p className="text-sm text-gray-500">该功能无参数可调。</p>;
    }
  };

  // 参数变更处理
  const handleParamsChange = (newParams) => {
    const updatedParams = { ...toolParams, ...newParams };
    updateToolParams(updatedParams);
    processEdit(activeTool, updatedParams, true);
  };

  // 压缩参数变更处理
  const handleCompressParamsChange = (newParams) => {
    updateToolParams(newParams);
    
    // 处理图片压缩预览的特殊逻辑
    processEdit('compress', { 
      ...toolParams, 
      ...newParams, 
      isCompressPreview: true 
    }, true);
  };

  // 应用工具效果
  const handleApplyTool = () => {
    processEdit(activeTool, toolParams, false); // isPreview is false to add to history
    clearActiveTool();
  };

  // 取消工具
  const handleCancelTool = () => {
    // 恢复到进入工具前的状态
    if (stagedImage && imageWorker) {
      imageWorker.postMessage({ 
        type: 'image-process', 
        payload: { 
          imageData: stagedImage, 
          action: 'original', 
          isHistoryNavigation: true 
        } 
      });
    }
    clearActiveTool();
  };

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <h3 className="text-lg font-semibold mb-4 capitalize">
        {activeTool === 'colorBalance' ? '色彩平衡' : 
         activeTool === 'brightness' ? '亮度' :
         activeTool === 'contrast' ? '对比度' :
         activeTool === 'saturation' ? '饱和度' :
         activeTool === 'blur' ? '模糊' :
         activeTool === 'compress' ? '压缩' :
         activeTool}
      </h3>
      
      {renderControls()}

      <div className="mt-auto pt-4 space-x-2 flex justify-end">
        <button onClick={handleCancelTool} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">取消</button>
        <button onClick={handleApplyTool} className="px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600">应用</button>
      </div>
    </aside>
  );
};

export default ParamsPanel; 