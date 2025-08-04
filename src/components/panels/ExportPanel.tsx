import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Slider, Button, Modal, Input, message } from 'antd';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import { formatFileSize } from '../../utils/filters';
import type { ExportFormat } from '../../types';

// 支持的导出格式
const EXPORT_FORMATS: Array<{ value: ExportFormat; label: string }> = [
  { value: 'jpeg', label: 'JPEG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

// 导出参数接口
interface ExportParamsUpdate {
  quality?: number;
  scale?: number;
  format?: ExportFormat;
  originalSize?: string;
  originalSizeBytes?: number;
}

const ExportPanel: React.FC = () => {
  const { getCurrentImageData, originalFileInfo } = useImageStore();
  const { 
    showExportPanel,
    toggleExportPanel,
    exportPreview,
    loading,
    generateExportPreview
  } = useUiStore();

  // 本地状态
  const [filename, setFilename] = useState<string>('');
  const [exportParams, setExportParams] = useState({
    quality: 0.8,
    scale: 1.0,
    format: 'jpeg' as ExportFormat,
    originalSize: '',
    originalSizeBytes: 0
  });

  // 初始化导出参数
  useEffect(() => {
    if (showExportPanel && originalFileInfo?.name) {
      const originalName = originalFileInfo.name.split('.').slice(0, -1).join('.');
      setFilename(`${originalName}-edited`);
      
      const initialParams = {
        quality: 0.8,
        scale: 1.0,
        format: 'jpeg' as ExportFormat,
        originalSizeBytes: originalFileInfo.size || 0,
        originalSize: originalFileInfo.size ? formatFileSize(originalFileInfo.size) : '未知'
      };
      
      setExportParams(initialParams);
      
      const currentImageData = getCurrentImageData();
      if (currentImageData) {
        generateExportPreview(currentImageData, initialParams);
      }
    }
  }, [showExportPanel, originalFileInfo, getCurrentImageData, generateExportPreview]);

  // 处理参数变更
  const handleParamChange = (newParams: Partial<ExportParamsUpdate>): void => {
    const currentImageData = getCurrentImageData();
    if (!currentImageData) return;
    
    const updatedParams = { ...exportParams, ...newParams };
    setExportParams(updatedParams);
    generateExportPreview(currentImageData, updatedParams);
  };

  // 处理文件名变更
  const handleFilenameChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFilename(e.target.value);
  };

  // 确认导出
  const handleConfirmExport = (): void => {
    if (!exportPreview?.blob || !exportPreview?.url) {
      message.warning("导出文件尚未准备好，请稍等。");
      return;
    }
    
    const extension = exportParams.format;
    const downloadFilename = `${filename || 'image'}.${extension}`;

    const link = document.createElement('a');
    link.href = exportPreview.url;
    link.download = downloadFilename;
    link.click();
    
    toggleExportPanel();
    message.success('文件已导出成功！');
  };

  // 处理取消
  const handleCancel = (): void => {
    toggleExportPanel();
  };

  // 模态框内容
  const modalContent = (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* 文件名输入框 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">文件名</label>
        <Input 
          value={filename}
          onChange={handleFilenameChange}
          placeholder="输入文件名（无需扩展名）"
        />
        <div className="text-xs text-gray-500">文件扩展名将根据选择的格式自动添加</div>
      </div>
      
      {/* 尺寸缩放 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">尺寸: {Math.round(exportParams.scale * 100)}%</label>
        <Slider 
          min={0.1} 
          max={2} 
          step={0.05} 
          value={exportParams.scale} 
          onChange={(val: number) => handleParamChange({ scale: val })} 
        />
      </div>

      {/* 格式选择 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">格式</label>
        <div className="grid grid-cols-3 gap-2 text-sm">
          {EXPORT_FORMATS.map(({ value, label }) => (
            <Button 
              key={value}
              onClick={() => handleParamChange({ format: value })}
              type={exportParams.format === value ? 'primary' : 'default'}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* 质量设置（仅JPEG和WebP格式需要） */}
      {['jpeg', 'webp'].includes(exportParams.format) && (
        <div className="space-y-2">
          <label className="text-sm font-medium">质量: {Math.round(exportParams.quality * 100)}%</label>
          <Slider 
            min={0.1} 
            max={1} 
            step={0.05} 
            value={exportParams.quality} 
            onChange={(val: number) => handleParamChange({ quality: val })} 
          />
        </div>
      )}
      
      {/* 文件大小预览 */}
      <div className="space-y-2 text-sm">
        <div className="font-medium">文件大小预览</div>
        <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-md">
          <div>原始: <span className="font-mono">{exportParams.originalSize || '...'}</span></div>
          <div className="mt-1">
            预估: <span className="font-mono">
              {loading ? '计算中...' : (exportPreview?.size ? formatFileSize(exportPreview.size) : '...')}
            </span>
          </div>
        </div>
      </div>

      {/* 预览图像 */}
      {exportPreview?.url && (
        <div className="space-y-2">
          <div className="font-medium text-sm">预览</div>
          <img 
            src={exportPreview.url} 
            alt="Export Preview"
            className="w-full rounded border border-gray-200 dark:border-gray-700"
          />
        </div>
      )}
    </div>
  );

  return (
    <Modal
      title="导出设置"
      open={showExportPanel}
      onCancel={handleCancel}
      width={520}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button 
          key="export" 
          type="primary"
          onClick={handleConfirmExport} 
          loading={loading}
          disabled={!exportPreview?.blob}
        >
          {loading ? '正在生成...' : '导出文件'}
        </Button>
      ]}
    >
      {modalContent}
    </Modal>
  );
};

export default ExportPanel;