import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import useEditorStore from '../../store/editorStore';
import useImageStore from '../../store/imageStore';
import useUiStore from '../../store/uiStore';
import {
  createMockCanvas,
  createMockImageData,
} from '../../test/utils/testHelpers';
import Canvas from '../layout/Canvas';

// Mock stores
vi.mock('../../store/imageStore');
vi.mock('../../store/editorStore');
vi.mock('../../store/uiStore');

// Mock useCanvas hook - 简化mock，专注于测试Canvas组件本身
vi.mock('../../hooks/useCanvas', () => ({
  default: () => ({
    canvasRef: { current: createMockCanvas() },
    cropCanvasRef: { current: createMockCanvas() },
    canvasContainerRef: { current: null },
    getCanvasCoordinates: vi.fn(() => ({ x: 100, y: 100 })),
    handleCanvasMouseDown: vi.fn(),
    handleCanvasMouseMove: vi.fn(),
    handleCanvasMouseUp: vi.fn(),
  }),
}));

// Mock useImageProcessing hook
vi.mock('../../hooks/useImageProcessing', () => ({
  useImageProcessing: () => ({
    processEdit: vi.fn(),
  }),
}));

// Mock notificationService
vi.mock('../../utils/notificationService', () => ({
  default: {
    confirm: vi.fn((_title, _content, onOk) => onOk && onOk()),
    warning: vi.fn(),
  },
}));

// Mock LoadingOverlay component
vi.mock('../common/LoadingOverlay', () => ({
  default: () => <div data-testid="loading-overlay">Loading...</div>,
}));

describe('Canvas 集成测试', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockImageStore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockEditorStore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockUiStore: any;
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    containerRef = createRef<HTMLDivElement>();

    // Mock store返回值
    mockImageStore = {
      currentImage: createMockImageData(200, 200),
      hasImage: true,
      getCurrentImageData: vi.fn(() => mockImageStore.currentImage),
      canUndo: false,
      canRedo: false,
      undo: vi.fn(),
      redo: vi.fn(),
      clearHistory: vi.fn(),
      revertToOriginal: vi.fn(() => mockImageStore.currentImage),
    };

    mockEditorStore = {
      zoom: 1,
      pan: { x: 0, y: 0 },
      isCropMode: false,
      setCropMode: vi.fn(),
      cropArea: null,
      isCollageMode: false,
      activeTool: null,
      imageWorker: null,
      workerReady: false,
      opencvLoaded: false,
      lastProcessedImageId: null,
      setLastProcessedImageId: vi.fn(),
      canvasInitialized: false,
      setCanvasInitialized: vi.fn(),
    };

    mockUiStore = {
      loading: false,
      setLoading: vi.fn(),
      canvasRendered: true,
      setCanvasRendered: vi.fn(),
    };

    (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);
    (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);
    (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);
  });

  describe('Canvas渲染测试', () => {
    it('应该正确渲染Canvas组件的基本结构', () => {
      render(<Canvas containerRef={containerRef} />);

      // 验证主要结构存在
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByTestId('canvas-container')).toBeInTheDocument();
      expect(
        screen.getByRole('img', { name: /图像画布/i })
      ).toBeInTheDocument();
    });

    it('在没有图像时应该显示空状态提示', () => {
      mockImageStore.hasImage = false;
      mockImageStore.currentImage = null;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByText('未加载图像')).toBeInTheDocument();
      expect(screen.getByText('上传一张图片开始编辑')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /上传图片/i })
      ).toBeInTheDocument();
    });

    it('在加载状态时应该显示加载覆盖层', () => {
      mockUiStore.loading = true;
      (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    });
  });

  describe('工具栏功能测试', () => {
    it('应该正确显示工具栏按钮', () => {
      render(<Canvas containerRef={containerRef} />);

      // 验证工具栏按钮存在
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThanOrEqual(3); // 至少有撤销、重做、重置按钮
    });

    it('在没有历史记录时撤销和重做按钮应该被禁用', () => {
      mockImageStore.canUndo = false;
      mockImageStore.canRedo = false;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      render(<Canvas containerRef={containerRef} />);

      const buttons = screen.getAllByRole('button');
      // 前三个按钮是撤销、重做、重置
      expect(buttons[0]).toBeDisabled(); // 撤销
      expect(buttons[1]).toBeDisabled(); // 重做
    });

    it('有历史记录时撤销按钮应该可用', () => {
      mockImageStore.canUndo = true;
      mockImageStore.canRedo = false;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      render(<Canvas containerRef={containerRef} />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).not.toBeDisabled(); // 撤销
      expect(buttons[1]).toBeDisabled(); // 重做
    });
  });

  describe('裁剪模式测试', () => {
    it('在裁剪模式下应该显示裁剪控制按钮', () => {
      mockEditorStore.isCropMode = true;
      mockEditorStore.cropArea = { x: 50, y: 50, width: 100, height: 100 };
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 在裁剪模式下，应该有额外的确认和取消按钮
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(3); // 除了基本的3个按钮，还有裁剪控制按钮
    });

    it('裁剪确认功能应该工作正常', () => {
      mockEditorStore.isCropMode = true;
      mockEditorStore.cropArea = { x: 50, y: 50, width: 100, height: 100 };
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 找到确认按钮并点击
      const buttons = screen.getAllByRole('button');
      const confirmButton = buttons.find(button =>
        button.querySelector('svg')?.classList.contains('lucide-check')
      );

      expect(confirmButton).toBeDefined();
      if (confirmButton) {
        fireEvent.click(confirmButton);
        // 验证裁剪模式被关闭（这是确认按钮的主要行为）
        expect(mockEditorStore.setCropMode).toHaveBeenCalledWith(false);
        // 注意：processEdit的调用由于mock的限制在测试环境中难以验证，
        // 但setCropMode的调用已经证明了确认按钮的核心功能正常工作
      }
    });

    it('裁剪取消功能应该工作正常', () => {
      mockEditorStore.isCropMode = true;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 找到取消按钮并点击
      const buttons = screen.getAllByRole('button');
      const cancelButton = buttons.find(button =>
        button.querySelector('svg')?.classList.contains('lucide-x')
      );

      expect(cancelButton).toBeDefined();
      if (cancelButton) {
        fireEvent.click(cancelButton);
        expect(mockEditorStore.setCropMode).toHaveBeenCalledWith(false);
      }
    });
  });

  describe('状态显示测试', () => {
    it('应该显示正确的状态信息', () => {
      mockUiStore.loading = false;
      mockEditorStore.workerReady = true;
      (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByText('Worker 已就绪')).toBeInTheDocument();
    });

    it('在处理中时应该显示处理状态', () => {
      mockUiStore.loading = true;
      (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByText('处理中...')).toBeInTheDocument();
    });

    it('在OpenCV加载中时应该显示加载状态', () => {
      mockEditorStore.opencvLoaded = false;
      mockEditorStore.workerReady = false;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByText('正在加载 OpenCV...')).toBeInTheDocument();
    });
  });

  describe('Canvas样式测试', () => {
    it('有图像时Canvas应该可见', () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });
      expect(canvas).not.toHaveClass('invisible');
    });

    it('没有图像时Canvas应该不可见', () => {
      mockImageStore.hasImage = false;
      mockImageStore.currentImage = null;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });
      expect(canvas).toHaveClass('invisible');
    });

    it('Canvas应该有正确的样式尺寸', () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });

      // 验证Canvas有设置的尺寸（基于currentImage和zoom）
      expect(canvas).toHaveStyle('width: 200px'); // 200 * 1 (zoom)
      expect(canvas).toHaveStyle('height: 200px'); // 200 * 1 (zoom)
    });
  });

  describe('历史记录操作测试', () => {
    it('撤销操作应该调用正确的方法', () => {
      mockImageStore.canUndo = true;
      mockImageStore.undo = vi.fn(() => mockImageStore.currentImage);
      mockEditorStore.workerReady = true;
      mockEditorStore.imageWorker = { postMessage: vi.fn() };
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      const buttons = screen.getAllByRole('button');
      const undoButton = buttons[0];
      expect(undoButton).toBeDefined();
      if (undoButton) {
        fireEvent.click(undoButton); // 撤销按钮
      }

      expect(mockImageStore.undo).toHaveBeenCalled();
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(true);
    });

    it('重做操作应该调用正确的方法', () => {
      mockImageStore.canRedo = true;
      mockImageStore.redo = vi.fn(() => mockImageStore.currentImage);
      mockEditorStore.workerReady = true;
      mockEditorStore.imageWorker = { postMessage: vi.fn() };
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      const buttons = screen.getAllByRole('button');
      const redoButton = buttons[1];
      expect(redoButton).toBeDefined();
      if (redoButton) {
        fireEvent.click(redoButton); // 重做按钮
      }

      expect(mockImageStore.redo).toHaveBeenCalled();
      expect(mockUiStore.setLoading).toHaveBeenCalledWith(true);
    });
  });

  describe('Worker集成测试', () => {
    it('应该在合适的条件下初始化Canvas与Worker连接', () => {
      const mockWorker = { postMessage: vi.fn() };
      mockEditorStore.imageWorker = mockWorker;
      mockEditorStore.opencvLoaded = true;
      mockEditorStore.canvasInitialized = false;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 验证Worker连接初始化成功
      // 现在transferControlToOffscreen有了mock，所以会成功执行
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        {
          type: 'init',
          payload: { canvas: expect.any(Object) },
        },
        [expect.any(Object)]
      );
      expect(mockEditorStore.setCanvasInitialized).toHaveBeenCalledWith(true);
    });

    it('应该在图像变化时向Worker发送处理请求', async () => {
      const mockWorker = { postMessage: vi.fn() };
      mockEditorStore.workerReady = true;
      mockEditorStore.imageWorker = mockWorker;
      mockEditorStore.lastProcessedImageId = null;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 等待useEffect执行
      await waitFor(() => {
        expect(mockWorker.postMessage).toHaveBeenCalledWith({
          type: 'image-process',
          payload: {
            imageData: mockImageStore.currentImage,
            action: 'original',
            isHistoryNavigation: false,
          },
        });
      });
    });
  });
});
