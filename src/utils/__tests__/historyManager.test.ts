import { beforeEach, describe, expect, it } from 'vitest';
import { createMockImageData } from '../../test/utils/testHelpers';
import type { ImageDataInterface } from '../../types';
import HistoryManager from '../historyManager';

describe('HistoryManager 单元测试', () => {
  let historyManager: HistoryManager;
  let mockImageData1: ImageDataInterface;
  let mockImageData2: ImageDataInterface;

  beforeEach(() => {
    historyManager = new HistoryManager(5); // 限制为5个历史记录
    mockImageData1 = createMockImageData(100, 100, [255, 0, 0, 255]); // 红色
    mockImageData2 = createMockImageData(100, 100, [0, 255, 0, 255]); // 绿色
  });

  describe('添加历史记录', () => {
    it('应该能够添加新的历史记录', () => {
      // 需要至少添加两个状态才能撤销
      historyManager.add(mockImageData1, 'original');
      historyManager.add(mockImageData2, 'blur', { intensity: 5 });

      expect(historyManager.canUndo()).toBe(true);
      expect(historyManager.canRedo()).toBe(false);
      expect(historyManager.getHistory()).toHaveLength(2);
    });

    it('应该为历史记录生成唯一ID和时间戳', () => {
      historyManager.add(mockImageData1, 'blur');
      const items = historyManager.getHistory();

      expect(items[0]?.id).toBeDefined();
      expect(items[0]?.timestamp).toBeDefined();
      expect(typeof items[0]?.id).toBe('string');
      expect(typeof items[0]?.timestamp).toBe('number');
    });

    it('应该限制历史记录的最大数量', () => {
      // 添加6个历史记录（超过限制的5个）
      for (let i = 0; i < 6; i++) {
        historyManager.add(
          createMockImageData(100, 100, [i * 40, 0, 0, 255]),
          `operation-${i}`
        );
      }

      expect(historyManager.getHistory()).toHaveLength(5);
      // 第一个应该被移除，现在第一个应该是 operation-1
      expect(historyManager.getHistory()[0]?.operation).toBe('operation-1');
    });
  });

  describe('撤销功能', () => {
    it('应该能够撤销到上一个状态', () => {
      historyManager.add(mockImageData1, 'original');
      historyManager.add(mockImageData2, 'blur');

      const undoResult = historyManager.undo();

      expect(undoResult).not.toBeNull();
      expect(undoResult?.width).toBe(mockImageData1.width);
      expect(undoResult?.height).toBe(mockImageData1.height);
    });

    it('在只有一个状态时不应该能够撤销', () => {
      historyManager.add(mockImageData1, 'original');

      const undoResult = historyManager.undo();

      expect(undoResult).toBeNull();
      expect(historyManager.canUndo()).toBe(false);
    });

    it('撤销后应该能够重做', () => {
      historyManager.add(mockImageData1, 'original');
      historyManager.add(mockImageData2, 'blur');

      historyManager.undo();
      expect(historyManager.canRedo()).toBe(true);

      const redoResult = historyManager.redo();
      expect(redoResult).not.toBeNull();
      expect(redoResult?.width).toBe(mockImageData2.width);
    });
  });

  describe('重做功能', () => {
    it('在没有撤销操作时不应该能够重做', () => {
      historyManager.add(mockImageData1, 'original');

      expect(historyManager.canRedo()).toBe(false);
      expect(historyManager.redo()).toBeNull();
    });

    it('添加新操作后应该清空重做栈', () => {
      historyManager.add(mockImageData1, 'original');
      historyManager.add(mockImageData2, 'blur');

      // 撤销一次
      historyManager.undo();
      expect(historyManager.canRedo()).toBe(true);

      // 添加新操作
      historyManager.add(
        createMockImageData(100, 100, [0, 0, 255, 255]),
        'sharpen'
      );
      expect(historyManager.canRedo()).toBe(false);
    });
  });

  describe('清空功能', () => {
    it('应该能够清空所有历史记录', () => {
      historyManager.add(mockImageData1, 'original');
      historyManager.add(mockImageData2, 'blur');

      historyManager.clear();

      expect(historyManager.canUndo()).toBe(false);
      expect(historyManager.canRedo()).toBe(false);
      expect(historyManager.getHistory()).toHaveLength(0);
    });
  });

  describe('历史记录查看', () => {
    it('应该返回正确的历史记录信息', () => {
      const operation = 'blur';
      const params = { intensity: 5, radius: 2 };

      historyManager.add(mockImageData1, operation, params);
      const items = historyManager.getHistory();

      expect(items).toHaveLength(1);
      expect(items[0]?.operation).toBe(operation);
      expect(items[0]?.params).toEqual(params);
      expect(items[0]?.imageData.width).toBe(mockImageData1.width);
      expect(items[0]?.imageData.height).toBe(mockImageData1.height);
    });
  });
});
