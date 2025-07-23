import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import Slider from '../common/Slider';
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

  // 初始化导出设置
  useEffect(() => {
    const currentImageData = getCurrentImageData();
    if (currentImageData) {
      // 初始化导出参数
      const initialParams = {
        quality: 0.8,
        scale: 1.0,
        format: 'image/jpeg',
        originalSizeBytes: originalFileInfo.size || 0,
        originalSize: originalFileInfo.size ? formatFileSize(originalFileInfo.size) : '未知'
      };
      
      // 更新参数并生成预览
      updateExportParams(initialParams);
      generateExportPreview(currentImageData, initialParams);
    }
  }, []);

  // 处理参数更新
  const handleParamChange = (newParams) => {
    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;
    
    const updatedParams = { ...exportParams, ...newParams };
    updateExportParams(updatedParams);
    generateExportPreview(currentImageData, updatedParams);
  };

  // 导出确认
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
    
    // 下载后关闭面板
    closeExportPanel();
  };

  return (
    <aside className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-4 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">导出设置</h3>
        <button onClick={closeExportPanel} className="icon-btn">
          <X size={20} />
        </button>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto pr-2">
        {/* 尺寸调整 */}
        <Slider
          id="export-scale"
          label="尺寸"
          min={0.1}
          max={2}
          step={0.05}
          value={exportParams.scale}
          onChange={(value) => handleParamChange({ scale: value })}
          displayFunc={(value) => `${Math.round(value * 100)}%`}
        />

        {/* 格式选择 */}
        <div className="space-y-2">
          <label className="text-sm font-medium">格式</label>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {['image/jpeg', 'image/png', 'image/webp'].map(format => (
              <button key={format}
                onClick={() => handleParamChange({ format })}
                className={`py-1 rounded text-center border ${exportParams.format === format ? 'bg-blue-500 text-white border-blue-500' : 'bg-gray-100 dark:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500'}`}
              >
                {format.split('/')[1].toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* 质量调整 (仅JPEG/WebP) */}
        {['image/jpeg', 'image/webp'].includes(exportParams.format) && (
          <Slider
            id="export-quality"
            label="质量"
            min={0.1}
            max={1}
            step={0.05}
            value={exportParams.quality}
            onChange={(value) => handleParamChange({ quality: value })}
            displayFunc={(value) => `${Math.round(value * 100)}%`}
          />
        )}
        
        {/* 预览大小 */}
        <div className="space-y-2 text-sm">
          <div className="font-medium">文件大小预览</div>
          <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
            <div>原始: <span className="font-mono">{exportParams.originalSize || '...'}</span></div>
            <div className="mt-1">预估: <span className="font-mono">{isGeneratingExport ? '计算中...' : (exportParams.previewSize || '...')}</span></div>
          </div>
        </div>

        {/* 预览图 */}
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
        <button 
          onClick={handleConfirmExport} 
          className="w-full px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400"
          disabled={isGeneratingExport}
        >
          {isGeneratingExport ? '正在生成...' : '导出文件'}
        </button>
      </div>
    </aside>
  );
};

export default ExportPanel; 