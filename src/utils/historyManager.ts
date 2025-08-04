import type { ImageDataInterface, HistoryItem, FilterParams } from '../types';

/**
 * 历史记录管理类
 * 用于支持图像编辑的撤销/重做功能
 */
export default class HistoryManager {
  private undoStack: ImageDataInterface[];
  private redoStack: ImageDataInterface[];
  private maxHistory: number;
  private historyItems: HistoryItem[];

  /**
   * 创建一个历史管理器实例
   */
  constructor(maxHistory: number = 20) {
    this.undoStack = []; // 撤销栈
    this.redoStack = []; // 重做栈
    this.maxHistory = maxHistory; // 最大历史记录数
    this.historyItems = []; // 详细历史记录
  }

  /**
   * 添加状态到历史记录
   */
  add(
    imageData: ImageDataInterface,
    operation?: string,
    params?: Record<string, unknown>
  ): void {
    // 创建图像数据的深拷贝
    const clonedData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    ) as ImageDataInterface;

    // 添加到撤销栈
    this.undoStack.push(clonedData);

    // 创建历史项
    const historyItem: HistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      imageData: clonedData,
      operation,
      params: params as FilterParams | undefined,
      timestamp: Date.now(),
    };

    this.historyItems.push(historyItem);

    // 清空重做栈
    this.redoStack = [];

    // 限制历史记录长度
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
      this.historyItems.shift();
    }
  }

  /**
   * 撤销操作
   */
  undo(): ImageDataInterface | null {
    // 至少需要两个状态才能撤销（当前状态和上一个状态）
    if (this.undoStack.length <= 1) return null;

    // 从撤销栈中取出当前状态并放入重做栈
    const current = this.undoStack.pop();
    if (current) {
      this.redoStack.push(current);
    }

    // 返回新的当前状态（即上一个状态）
    return this.undoStack[this.undoStack.length - 1] || null;
  }

  /**
   * 重做操作
   */
  redo(): ImageDataInterface | null {
    // 重做栈为空则无法重做
    if (this.redoStack.length === 0) return null;

    // 从重做栈中取出状态并放入撤销栈
    const state = this.redoStack.pop();
    if (state) {
      this.undoStack.push(state);
      return state;
    }

    return null;
  }

  /**
   * 判断是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  /**
   * 判断是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * 清除所有历史记录
   */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.historyItems = [];
  }

  /**
   * 获取当前状态
   */
  getCurrentState(): ImageDataInterface | null {
    if (this.undoStack.length === 0) return null;
    const lastItem = this.undoStack[this.undoStack.length - 1];
    return lastItem || null;
  }

  /**
   * 获取当前历史索引
   */
  getCurrentIndex(): number {
    return this.undoStack.length - 1;
  }

  /**
   * 获取历史记录项列表
   */
  getHistory(): HistoryItem[] {
    return [...this.historyItems];
  }

  /**
   * 获取历史记录统计信息
   */
  getStats(): {
    undoStackSize: number;
    redoStackSize: number;
    totalHistoryItems: number;
    maxHistory: number;
    canUndo: boolean;
    canRedo: boolean;
  } {
    return {
      undoStackSize: this.undoStack.length,
      redoStackSize: this.redoStack.length,
      totalHistoryItems: this.historyItems.length,
      maxHistory: this.maxHistory,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
    };
  }

  /**
   * 设置最大历史记录数
   */
  setMaxHistory(maxHistory: number): void {
    this.maxHistory = Math.max(1, maxHistory);

    // 如果当前历史记录超过新的最大值，删除最早的记录
    while (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
      this.historyItems.shift();
    }
  }

  /**
   * 跳转到指定历史索引
   */
  jumpToIndex(index: number): ImageDataInterface | null {
    if (index < 0 || index >= this.undoStack.length) return null;

    const currentIndex = this.getCurrentIndex();

    if (index < currentIndex) {
      // 需要撤销
      const steps = currentIndex - index;
      for (let i = 0; i < steps; i++) {
        if (!this.canUndo()) break;
        this.undo();
      }
    } else if (index > currentIndex) {
      // 需要重做
      const steps = index - currentIndex;
      for (let i = 0; i < steps; i++) {
        if (!this.canRedo()) break;
        this.redo();
      }
    }

    return this.getCurrentState();
  }
}
