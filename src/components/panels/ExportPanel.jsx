import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { Slider, Button } from 'antd'; // 引入 antd Slider 和 Button
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import { formatFileSize } from '../../utils/filters';

const ExportPanel = () => {
  const { getCurrentImageData, originalFileInfo } = useImageStore();
  const { 
    exportParams, 
    updateExportParams, 
    closeExportPanel, 
    isGeneratingExport,
    generateExportPreview
  } = useUiStore();

  useEffect(() => {
    const currentImageData = getCurrentImageData();
    if (currentImageData) {
      const initialParams = {
        quality: 0.8,
        scale: 1.0,
        format: 'image/jpeg',
        originalSizeBytes: originalFileInfo.size || 0,
        originalSize: originalFileInfo.size ? formatFileSize(originalFileInfo.size) : '未知'
      };
      updateExportParams(initialParams);
      generateExportPreview(currentImageData, initialParams);
    }
  }, []);

  const handleParamChange = (newParams) => {
    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;
    const updatedParams = { ...exportParams, ...newParams };
    updateExportParams(updatedParams);
    generateExportPreview(currentImageData, updatedParams);
  };

  const handleConfirmExport = () => {
    if (!exportParams.compressedBlob || !exportParams.previewUrl) {
      alert("导出文件尚未准备好，请稍等。");
      return;
    }
    
    const extension = exportParams.format.split('/')[1] || 'jpg';
    const originalName = originalFileInfo.name.split('.').slice(0, -1).join('.');
    const filename = `${originalName}-edited.${extension}`;

    const link = document.createElement('a');
    link.href = exportParams.previewUrl;
    link.download = filename;
    link.click();
    
    closeExportPanel();
  };

  return (
    <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">导出设置</h3>
        <Button type="text" icon={<X size={20} />} onClick={closeExportPanel} />
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">尺寸: {Math.round(exportParams.scale * 100)}%</label>
          <Slider min={0.1} max={2} step={0.05} value={exportParams.scale} onChange={(val) => handleParamChange({ scale: val })} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">格式</label>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {['image/jpeg', 'image/png', 'image/webp'].map(format => (
              <Button key={format}
                onClick={() => handleParamChange({ format })}
                type={exportParams.format === format ? 'primary' : 'default'}
              >
                {format.split('/')[1].toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {['image/jpeg', 'image/webp'].includes(exportParams.format) && (
          <div className="space-y-2">
            <label className="text-sm font-medium">质量: {Math.round(exportParams.quality * 100)}</label>
            <Slider min={0.1} max={1} step={0.05} value={exportParams.quality} onChange={(val) => handleParamChange({ quality: val })} />
          </div>
        )}
        
        <div className="space-y-2 text-sm">
          <div className="font-medium">文件大小预览</div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
            <div>原始: <span className="font-mono">{exportParams.originalSize || '...'}</span></div>
            <div className="mt-1">预估: <span className="font-mono">{isGeneratingExport ? '计算中...' : (exportParams.previewSize || '...')}</span></div>
          </div>
        </div>

        {exportParams.previewUrl && (
          <div className="space-y-2">
            <div className="font-medium text-sm">预览</div>
            <img 
              src={exportParams.previewUrl} 
              alt="Preview"
              className="w-full rounded border border-gray-200 dark:border-gray-700"
            />
          </div>
        )}
      </div>

      <div className="mt-auto pt-4">
        <Button 
          type="primary"
          block
          onClick={handleConfirmExport} 
          loading={isGeneratingExport}
        >
          {isGeneratingExport ? '正在生成...' : '导出文件'}
        </Button>
      </div>
    </aside>
  );
};

export default ExportPanel; 