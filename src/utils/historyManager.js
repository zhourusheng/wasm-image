/**
 * 历史记录管理类
 * 用于支持图像编辑的撤销/重做功能
 */
export default class HistoryManager {
  /**
   * 创建一个历史管理器实例
   * @param {number} maxHistory - 最大历史记录数量
   */
  constructor(maxHistory = 20) {
    this.undoStack = []; // 撤销栈
    this.redoStack = []; // 重做栈
    this.maxHistory = maxHistory; // 最大历史记录数
  }
  
  /**
   * 添加状态到历史记录
   * @param {ImageData} imageData - 图像数据
   */
  addState(imageData) {
    // 创建图像数据的深拷贝
    const clonedData = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    );
    
    // 添加到撤销栈
    this.undoStack.push(clonedData);
    
    // 清空重做栈
    this.redoStack = [];
    
    // 限制历史记录长度
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
  }
  
  /**
   * 撤销操作
   * @returns {ImageData|null} 上一个状态的图像数据，如果没有则返回null
   */
  undo() {
    // 至少需要两个状态才能撤销（当前状态和上一个状态）
    if (this.undoStack.length <= 1) return null;
    
    // 从撤销栈中取出当前状态并放入重做栈
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    
    // 返回新的当前状态（即上一个状态）
    return this.undoStack[this.undoStack.length - 1];
  }
  
  /**
   * 重做操作
   * @returns {ImageData|null} 下一个状态的图像数据，如果没有则返回null
   */
  redo() {
    // 重做栈为空则无法重做
    if (this.redoStack.length === 0) return null;
    
    // 从重做栈中取出状态并放入撤销栈
    const state = this.redoStack.pop();
    this.undoStack.push(state);
    
    // 返回重做的状态
    return state;
  }
  
  /**
   * 判断是否可以撤销
   * @returns {boolean}
   */
  canUndo() {
    return this.undoStack.length > 1;
  }
  
  /**
   * 判断是否可以重做
   * @returns {boolean}
   */
  canRedo() {
    return this.redoStack.length > 0;
  }
  
  /**
   * 清除所有历史记录
   */
  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
} 