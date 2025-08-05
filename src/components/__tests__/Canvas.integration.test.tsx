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

// Mock useCanvas hook
vi.mock('../../hooks/useCanvas', () => ({
  useCanvas: () => ({
    canvasRef: { current: createMockCanvas() },
    drawImage: vi.fn(),
    clearCanvas: vi.fn(),
    getCanvasImageData: vi.fn(),
  }),
}));

describe('Canvas 集成测试', () => {
  let mockImageStore: any;
  let mockEditorStore: any;
  let mockUiStore: any;
  let containerRef: React.RefObject<HTMLDivElement | null>;

  beforeEach(() => {
    vi.clearAllMocks();
    containerRef = createRef<HTMLDivElement>();

    // Mock store返回值
    mockImageStore = {
      currentImage: createMockImageData(200, 200),
      hasImage: true,
    };

    mockEditorStore = {
      zoom: 1,
      pan: { x: 0, y: 0 },
      isCropMode: false,
      cropArea: null,
      isCollageMode: false,
      activeTool: null,
      setZoom: vi.fn(),
      setPan: vi.fn(),
      setCropArea: vi.fn(),
      canvasInitialized: true,
    };

    mockUiStore = {
      canvasRendered: true,
      setCanvasRendered: vi.fn(),
    };
    (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);
    (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);
    (useUiStore as unknown as Mock).mockReturnValue(mockUiStore);
  });

  describe('Canvas渲染集成', () => {
    it('应该正确渲染Canvas组件', () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });
      expect(canvas).toBeInTheDocument();
      expect(canvas).toHaveAttribute('width', '200');
      expect(canvas).toHaveAttribute('height', '200');
    });

    it('在没有图像时应该显示占位符', () => {
      mockImageStore.hasImage = false;
      mockImageStore.currentImage = null;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      render(<Canvas containerRef={containerRef} />);

      expect(screen.getByText(/请上传图像/i)).toBeInTheDocument();
    });
  });

  describe('缩放功能集成', () => {
    it('应该响应鼠标滚轮缩放', async () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });

      // 模拟向上滚动（放大）
      fireEvent.wheel(canvas, { deltaY: -100 });

      expect(mockEditorStore.setZoom).toHaveBeenCalled();
      const zoomCall = mockEditorStore.setZoom.mock.calls[0][0];
      expect(zoomCall).toBeGreaterThan(1); // 应该放大
    });

    it('应该响应触摸缩放手势', async () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });

      // 模拟双指缩放开始
      fireEvent.touchStart(canvas, {
        touches: [
          { clientX: 100, clientY: 100, identifier: 0 },
          { clientX: 200, clientY: 200, identifier: 1 },
        ],
      });

      // 模拟双指缩放移动（放大）
      fireEvent.touchMove(canvas, {
        touches: [
          { clientX: 80, clientY: 80, identifier: 0 },
          { clientX: 220, clientY: 220, identifier: 1 },
        ],
      });

      fireEvent.touchEnd(canvas);

      expect(mockEditorStore.setZoom).toHaveBeenCalled();
    });
  });

  describe('平移功能集成', () => {
    it('应该响应鼠标拖拽平移', async () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });

      // 模拟鼠标拖拽
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);

      expect(mockEditorStore.setPan).toHaveBeenCalled();
      const panCall = mockEditorStore.setPan.mock.calls[0][0];
      expect(panCall.x).toBeGreaterThan(0);
      expect(panCall.y).toBeGreaterThan(0);
    });

    it('应该响应触摸拖拽平移', async () => {
      render(<Canvas containerRef={containerRef} />);

      const canvas = screen.getByRole('img', { name: /图像画布/i });

      // 模拟单指触摸拖拽
      fireEvent.touchStart(canvas, {
        touches: [{ clientX: 100, clientY: 100, identifier: 0 }],
      });

      fireEvent.touchMove(canvas, {
        touches: [{ clientX: 150, clientY: 150, identifier: 0 }],
      });

      fireEvent.touchEnd(canvas);

      expect(mockEditorStore.setPan).toHaveBeenCalled();
    });
  });

  describe('裁剪模式集成', () => {
    it('应该在裁剪模式下显示裁剪框', () => {
      mockEditorStore.isCropMode = true;
      mockEditorStore.cropArea = { x: 50, y: 50, width: 100, height: 100 };
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      // 验证裁剪框相关元素存在
      const cropOverlay = screen.getByTestId('crop-overlay');
      expect(cropOverlay).toBeInTheDocument();
    });

    it('应该能够通过鼠标调整裁剪区域', async () => {
      mockEditorStore.isCropMode = true;
      mockEditorStore.cropArea = { x: 50, y: 50, width: 100, height: 100 };
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      const cropHandle = screen.getByTestId('crop-handle-se'); // 右下角控制点

      // 模拟拖拽调整大小
      fireEvent.mouseDown(cropHandle, { clientX: 150, clientY: 150 });
      fireEvent.mouseMove(document, { clientX: 200, clientY: 200 });
      fireEvent.mouseUp(document);

      expect(mockEditorStore.setCropArea).toHaveBeenCalled();
    });
  });

  describe('状态同步集成', () => {
    it('应该在图像变化时重新渲染Canvas', async () => {
      const { rerender } = render(<Canvas containerRef={containerRef} />);

      // 更改图像数据
      const newImageData = createMockImageData(300, 300, [0, 255, 0, 255]);
      mockImageStore.currentImage = newImageData;
      (useImageStore as unknown as Mock).mockReturnValue(mockImageStore);

      rerender(<Canvas containerRef={containerRef} />);

      await waitFor(() => {
        const canvas = screen.getByRole('img', { name: /图像画布/i });
        expect(canvas).toHaveAttribute('width', '300');
        expect(canvas).toHaveAttribute('height', '300');
      });
    });

    it('应该在缩放变化时更新Canvas样式', () => {
      mockEditorStore.zoom = 2;
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      const canvasContainer = screen.getByTestId('canvas-container');
      expect(canvasContainer).toHaveStyle('transform: scale(2)');
    });

    it('应该在平移变化时更新Canvas位置', () => {
      mockEditorStore.pan = { x: 50, y: 100 };
      (useEditorStore as unknown as Mock).mockReturnValue(mockEditorStore);

      render(<Canvas containerRef={containerRef} />);

      const canvasContainer = screen.getByTestId('canvas-container');
      expect(canvasContainer).toHaveStyle('transform: translate(50px, 100px)');
    });
  });

  describe('性能优化集成', () => {
    it('应该防止频繁的重绘操作', async () => {
      const mockDrawImage = vi.fn();
      vi.mocked(require('../../hooks/useCanvas').useCanvas).mockReturnValue({
        canvasRef: { current: createMockCanvas() },
        drawImage: mockDrawImage,
        clearCanvas: vi.fn(),
        getCanvasImageData: vi.fn(),
      });

      render(<Canvas containerRef={containerRef} />);

      // 快速连续触发多次缩放
      const canvas = screen.getByRole('img', { name: /图像画布/i });
      for (let i = 0; i < 5; i++) {
        fireEvent.wheel(canvas, { deltaY: -10 });
      }

      // 等待防抖
      await waitFor(
        () => {
          // 验证drawImage不会被过度调用
          expect(mockDrawImage).toHaveBeenCalledTimes(1);
        },
        { timeout: 1000 }
      );
    });
  });
});
