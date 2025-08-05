import { beforeEach, describe, expect, it } from 'vitest';
import type { CropArea, FilterParams } from '../../types';
import useEditorStore from '../editorStore';

describe('EditorStore 单元测试', () => {
  beforeEach(() => {
    // 重置store状态
    useEditorStore.setState({
      workerReady: false,
      opencvLoaded: false,
      imageWorker: null,
      activeTool: null,
      toolParams: {},
      isCropMode: false,
      cropArea: null,
      isCollageMode: false,
      zoom: 1,
      pan: { x: 0, y: 0 },
      lastProcessedImageId: null,
      canvasInitialized: false,
    });
  });

  describe('Worker状态管理', () => {
    it('应该能够设置Worker准备状态', () => {
      const { setWorkerReady } = useEditorStore.getState();

      setWorkerReady(true);

      expect(useEditorStore.getState().workerReady).toBe(true);
    });

    it('应该能够设置OpenCV加载状态', () => {
      const { setOpenCVLoaded } = useEditorStore.getState();

      setOpenCVLoaded(true);

      expect(useEditorStore.getState().opencvLoaded).toBe(true);
    });

    it('应该能够设置Worker实例', () => {
      const mockWorker = new Worker('test-worker.js');
      const { setImageWorker } = useEditorStore.getState();

      setImageWorker(mockWorker);

      expect(useEditorStore.getState().imageWorker).toBe(mockWorker);
    });
  });

  describe('工具状态管理', () => {
    it('应该能够设置活动工具', () => {
      const { setActiveTool } = useEditorStore.getState();
      const defaultParams: FilterParams = { intensity: 5 };

      setActiveTool('blur', defaultParams);

      const state = useEditorStore.getState();
      expect(state.activeTool).toBe('blur');
      expect(state.toolParams).toEqual(defaultParams);
    });

    it('应该能够更新工具参数', () => {
      const { setActiveTool, updateToolParams } = useEditorStore.getState();

      setActiveTool('blur', { intensity: 5 });
      updateToolParams({ radius: 3 });

      const state = useEditorStore.getState();
      expect(state.toolParams).toEqual({ intensity: 5, radius: 3 });
    });

    it('更新工具参数时应该保留现有参数', () => {
      const { setActiveTool, updateToolParams } = useEditorStore.getState();

      setActiveTool('blur', { intensity: 5, radius: 2 });
      updateToolParams({ intensity: 8 }); // 只更新intensity

      const state = useEditorStore.getState();
      expect(state.toolParams).toEqual({ intensity: 8, radius: 2 });
    });
  });

  describe('裁剪模式管理', () => {
    it('应该能够启用裁剪模式', () => {
      const { setCropMode } = useEditorStore.getState();

      setCropMode(true);

      expect(useEditorStore.getState().isCropMode).toBe(true);
    });

    it('应该能够设置裁剪区域', () => {
      const { setCropArea } = useEditorStore.getState();
      const cropArea: CropArea = { x: 10, y: 20, width: 100, height: 80 };

      setCropArea(cropArea);

      expect(useEditorStore.getState().cropArea).toEqual(cropArea);
    });

    it('应该能够清除裁剪区域', () => {
      const { setCropArea } = useEditorStore.getState();
      const cropArea: CropArea = { x: 10, y: 20, width: 100, height: 80 };

      setCropArea(cropArea);
      expect(useEditorStore.getState().cropArea).toEqual(cropArea);

      setCropArea(null);
      expect(useEditorStore.getState().cropArea).toBeNull();
    });
  });

  describe('视图控制', () => {
    it('应该能够设置缩放级别', () => {
      const { setZoom } = useEditorStore.getState();

      setZoom(2.5);

      expect(useEditorStore.getState().zoom).toBe(2.5);
    });

    it('应该限制缩放级别在有效范围内', () => {
      const { setZoom } = useEditorStore.getState();

      // 测试最小值限制
      setZoom(-1);
      expect(useEditorStore.getState().zoom).toBe(0.01);

      // 测试最大值限制
      setZoom(20);
      expect(useEditorStore.getState().zoom).toBe(10);
    });

    it('应该能够设置平移位置', () => {
      const { setPan } = useEditorStore.getState();
      const panPosition = { x: 100, y: 200 };

      setPan(panPosition);

      expect(useEditorStore.getState().pan).toEqual(panPosition);
    });

    it('应该能够重置视图', () => {
      const { setZoom, setPan, resetView } = useEditorStore.getState();

      // 先设置一些非默认值
      setZoom(3);
      setPan({ x: 100, y: 200 });

      // 重置视图
      resetView();

      const state = useEditorStore.getState();
      expect(state.zoom).toBe(1);
      expect(state.pan).toEqual({ x: 0, y: 0 });
    });
  });

  describe('图像处理缓存管理', () => {
    it('应该能够设置最后处理的图像ID', () => {
      const { setLastProcessedImageId } = useEditorStore.getState();
      const imageId = 'test-image-123';

      setLastProcessedImageId(imageId);

      expect(useEditorStore.getState().lastProcessedImageId).toBe(imageId);
    });

    it('应该能够清除最后处理的图像ID', () => {
      const { setLastProcessedImageId, clearLastProcessedImageId } =
        useEditorStore.getState();

      setLastProcessedImageId('test-image-123');
      expect(useEditorStore.getState().lastProcessedImageId).toBe(
        'test-image-123'
      );

      clearLastProcessedImageId();
      expect(useEditorStore.getState().lastProcessedImageId).toBeNull();
    });

    it('应该能够设置Canvas初始化状态', () => {
      const { setCanvasInitialized } = useEditorStore.getState();

      setCanvasInitialized(true);

      expect(useEditorStore.getState().canvasInitialized).toBe(true);
    });
  });
});
