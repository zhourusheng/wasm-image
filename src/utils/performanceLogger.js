/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 */
export class PerformanceTimer {
  /**
   * @param {string} operationName 操作的名称 (e.g., 'blur', 'crop')
   * @param {object} metadata 其他元数据 (e.g., { width, height })
   */
  constructor(operationName, metadata = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;

    this.step('start');
  }

  /**
   * 记录一个时间点。
   * @param {string} stepName 步骤的名称
   */
  step(stepName) {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

  /**
   * 结束计时并生成最终的日志对象。
   * @returns {object} 包含所有性能数据的日志对象。
   */
  end() {
    this.step('end');
    const totalTime = this.lastStepTime - this.startTime;
    return {
      operation: this.operationName,
      metadata: this.metadata,
      totalTime: parseFloat(totalTime.toFixed(2)),
      steps: this.steps,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * 将性能日志对象格式化并打印到控制台。
 * @param {object} logData 从 PerformanceTimer.end() 返回的日志对象。
 */
export function logPerformanceToConsole(logData) {
  if (!logData) return;

  const { operation, metadata, totalTime, steps } = logData;

  // 使用 console.group 来组织输出
  console.group(`%cPerformance Log: %c${operation}`, 'font-weight: bold;', 'font-weight: normal;');

  console.log(`总耗时: ${totalTime}ms`);
  if (metadata && metadata.width && metadata.height) {
    console.log(`图像尺寸: ${metadata.width}x${metadata.height}`);
  }

  // 创建一个表格来展示每个步骤的耗时
  const tableData = steps.map(({ name, elapsed }) => ({
    '步骤 (Step)': name,
    '耗时 (ms)': elapsed,
  }));
  console.table(tableData);

  console.groupEnd();
} 