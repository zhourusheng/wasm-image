import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Slider, Button, Modal, Input } from 'antd'; // 引入 Modal 和 Input
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
    generateExportPreview,
    isExportPanelOpen
  } = useUiStore();

  // 添加文件名状态
  const [filename, setFilename] = useState('');

  useEffect(() => {
    // 当面板打开时，初始化文件名
    if (isExportPanelOpen && originalFileInfo?.name) {
      const originalName = originalFileInfo.name.split('.').slice(0, -1).join('.');
      setFilename(`${originalName}-edited`);
    }
    
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
  }, [isExportPanelOpen]);

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
    // 使用用户输入的文件名
    const downloadFilename = `${filename || 'image'}.${extension}`;

    const link = document.createElement('a');
    link.href = exportParams.previewUrl;
    link.download = downloadFilename;
    link.click();
    
    closeExportPanel();
  };

  const modalContent = (
    <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
      {/* 文件名输入框 */}
      <div className="space-y-2">
        <label className="text-sm font-medium">文件名</label>
        <Input 
          value={filename}
          onChange={(e) => setFilename(e.target.value)}
          placeholder="输入文件名（无需扩展名）"
        />
        <div className="text-xs text-gray-500">文件扩展名将根据选择的格式自动添加</div>
      </div>
      
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
  );

  // 使用Modal组件替代右侧边栏
  return (
    <Modal
      title="导出设置"
      open={isExportPanelOpen}
      onCancel={closeExportPanel}
      width={520}
      footer={[
        <Button key="cancel" onClick={closeExportPanel}>
          取消
        </Button>,
        <Button 
          key="export" 
          type="primary"
          onClick={handleConfirmExport} 
          loading={isGeneratingExport}
        >
          {isGeneratingExport ? '正在生成...' : '导出文件'}
        </Button>
      ]}
    >
      {modalContent}
    </Modal>
  );
};

export default ExportPanel; 