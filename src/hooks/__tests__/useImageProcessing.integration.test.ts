import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import { createMockImageData } from '../../test/utils/testHelpers';
import { useImageProcessing } from '../useImageProcessing';

// Mock stores
vi.mock('../../store/imageStore');
vi.mock('../../store/editorStore');
vi.mock('../../store/uiStore');

// Mock notification service
vi.mock('../../utils/notificationService', () => ({
  notificationService: {
    warning: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useImageProcessing 集成测试', () => {
  let mockImageStore: any;
  let mockEditorStore: any;
  let mockUiStore: any;
  let mockWorker: any;

  beforeEach(() => {
    // 重置所有mock
    vi.clearAllMocks();

    // 创建mock worker
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock store返回值
    mockImageStore = {
      currentImage: createMockImageData(100, 100),
      updateImage: vi.fn(),
      setImage: vi.fn(),
      clearHistory: vi.fn(),
    };

    mockEditorStore = {
      imageWorker: mockWorker,
      workerReady: true,
      clearLastProcessedImageId: vi.fn(),
      setCropMode: vi.fn(),
      setActiveTool: vi.fn(),
      updateToolParams: vi.fn(),
    };

    mockUiStore = {
      setLoading: vi.fn(),
      setCanvasRendered: vi.fn(),
      updateDeviceInfo: vi.fn(),
    };

    // 配置mock返回值
    (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);
    (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);
    (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);
  });

  describe('图像处理流程集成', () => {
    it('应该完整执行图像处理流程', async () => {
      const { result } = renderHook(() => useImageProcessing());

      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 验证加载状态被设置
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(true);

      // 验证Worker收到正确的消息
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'image-process',
        payload: {
          imageData: mockImageStore.currentImage,
          action: 'blur',
          params: { intensity: 5 },
          isHistoryNavigation: false,
        },
      });
    });

    it('应该正确处理预览模式', async () => {
      const { result } = renderHook(() => useImageProcessing());

      act(() => {
        result.current.processEdit('sharpen', { intensity: 3 }, true);
      });

      // 预览模式不应该设置加载状态
      expect(mockUiStore.setLoading).not.toHaveBeenCalled();

      // 验证Worker收到预览标记
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'image-process',
        payload: {
          imageData: mockImageStore.currentImage,
          action: 'sharpen',
          params: { intensity: 3 },
          isHistoryNavigation: true,
        },
      });
    });

    it('应该处理Worker未准备的情况', async () => {
      // 设置Worker未准备
      mockEditorStore.workerReady = false;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      const { result } = renderHook(() => useImageProcessing());

      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 不应该发送消息到Worker
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
      // 应该重置加载状态
      expect(mockUiStore.setLoading).not.toHaveBeenCalled();
    });

    it('应该处理缺少图像数据的情况', async () => {
      // 设置没有当前图像
      mockImageStore.currentImage = null;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      const { result } = renderHook(() => useImageProcessing());

      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 不应该发送消息到Worker
      expect(mockWorker.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Worker消息处理集成', () => {
    it('应该正确处理成功的Worker响应', async () => {
      const { result } = renderHook(() => useImageProcessing());

      // 模拟Worker成功响应
      const processedImageData = createMockImageData(
        100,
        100,
        [0, 255, 0, 255]
      );
      const successMessage = {
        data: {
          type: 'image-processed',
          payload: {
            success: true,
            imageData: processedImageData,
            operation: 'blur',
            params: { intensity: 5 },
          },
        },
      };

      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 模拟Worker响应
      act(() => {
        const messageHandler = mockWorker.addEventListener.mock.calls.find(
          (call: any) => call[0] === 'message'
        )?.[1];
        if (messageHandler) {
          messageHandler(successMessage);
        }
      });

      // 验证图像被更新
      expect(mockImageStore.updateImage).toHaveBeenCalledWith(
        processedImageData,
        'blur',
        { intensity: 5 }
      );

      // 验证加载状态被重置
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(false);
    });

    it('应该正确处理Worker错误响应', async () => {
      const { result } = renderHook(() => useImageProcessing());

      // 模拟Worker错误响应
      const errorMessage = {
        data: {
          type: 'image-processed',
          payload: {
            success: false,
            error: '处理失败：参数无效',
          },
        },
      };

      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 模拟Worker错误响应
      act(() => {
        const messageHandler = mockWorker.addEventListener.mock.calls.find(
          (call: any) => call[0] === 'message'
        )?.[1];
        if (messageHandler) {
          messageHandler(errorMessage);
        }
      });

      // 验证图像不会被更新
      expect(mockImageStore.updateImage).not.toHaveBeenCalled();

      // 验证加载状态被重置
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(false);
    });
  });

  describe('多个操作的集成测试', () => {
    it('应该能够连续处理多个操作', async () => {
      const { result } = renderHook(() => useImageProcessing());

      // 第一个操作
      act(() => {
        result.current.processEdit('blur', { intensity: 5 });
      });

      // 第二个操作
      act(() => {
        result.current.processEdit('sharpen', { intensity: 3 });
      });

      // 验证两个操作都被发送
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(2);
      expect(mockWorker.postMessage).toHaveBeenNthCalledWith(1, {
        type: 'image-process',
        payload: {
          imageData: mockImageStore.currentImage,
          action: 'blur',
          params: { intensity: 5 },
          isHistoryNavigation: false,
        },
      });
      expect(mockWorker.postMessage).toHaveBeenNthCalledWith(2, {
        type: 'image-process',
        payload: {
          imageData: mockImageStore.currentImage,
          action: 'sharpen',
          params: { intensity: 3 },
          isHistoryNavigation: false,
        },
      });
    });
  });

  describe('状态同步集成测试', () => {
    it('应该在处理完成后正确同步所有相关状态', async () => {
      const { result } = renderHook(() => useImageProcessing());

      const processedImageData = createMockImageData(
        100,
        100,
        [0, 255, 0, 255]
      );
      const successMessage = {
        data: {
          type: 'image-processed',
          payload: {
            success: true,
            imageData: processedImageData,
            operation: 'crop',
            params: { x: 10, y: 10, width: 80, height: 80 },
          },
        },
      };

      act(() => {
        result.current.processEdit('crop', {
          x: 10,
          y: 10,
          width: 80,
          height: 80,
        });
      });

      // 模拟Worker成功响应
      act(() => {
        const messageHandler = mockWorker.addEventListener.mock.calls.find(
          (call: any) => call[0] === 'message'
        )?.[1];
        if (messageHandler) {
          messageHandler(successMessage);
        }
      });

      // 验证所有相关状态都被正确更新
      expect(mockImageStore.updateImage).toHaveBeenCalled();
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(false);
      expect(mockEditorStore.clearLastProcessedImageId).toHaveBeenCalled();
    });
  });
});
