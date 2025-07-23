/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 */
class PerformanceTimer {
  constructor(operationName, metadata = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.step('start');
  }

  step(stepName) {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

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
 * 将性能日志输出到控制台
 * @param {Object} perfLog - 性能日志对象
 */
export function logPerformanceToConsole(perfLog) {
  if (!perfLog) return;
  
  console.group(`🕒 Performance: ${perfLog.operation} - ${perfLog.totalTime}ms`);
  
  if (Object.keys(perfLog.metadata || {}).length > 0) {
    console.log('📋 Metadata:', perfLog.metadata);
  }
  
  console.table(
    perfLog.steps.map(step => ({
      Step: step.name,
      'Time (ms)': step.elapsed,
    }))
  );
  
  console.log(`🕒 Total time: ${perfLog.totalTime}ms`);
  console.groupEnd();
}

export { PerformanceTimer }; 