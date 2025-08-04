import type { PerformanceMetrics } from '../types';

interface PerformanceStep {
  name: string;
  elapsed: number;
}

interface PerformanceLogConfig {
  metadata?: Record<string, unknown>;
}

/**
 * 一个简单的性能计时器，用于记录多步骤操作的耗时。
 */
class PerformanceTimer {
  private operationName: string;
  private metadata: Record<string, unknown>;
  private steps: PerformanceStep[];
  private startTime: number;
  private lastStepTime: number;

  constructor(operationName: string, metadata: Record<string, unknown> = {}) {
    this.operationName = operationName;
    this.metadata = metadata;
    this.steps = [];
    this.startTime = performance.now();
    this.lastStepTime = this.startTime;
    this.step('start');
  }

  step(stepName: string): void {
    const now = performance.now();
    const elapsed = now - this.lastStepTime;
    this.steps.push({
      name: stepName,
      elapsed: parseFloat(elapsed.toFixed(2)),
    });
    this.lastStepTime = now;
  }

  end(): PerformanceMetrics {
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

  // 静态方法：创建一个快速的性能测量
  static measure<T>(
    operationName: string,
    operation: () => T,
    metadata?: Record<string, unknown>
  ): T {
    const timer = new PerformanceTimer(operationName, metadata);
    timer.step('operation_start');
    
    try {
      const result = operation();
      timer.step('operation_end');
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
      return result;
    } catch (error) {
      timer.step('operation_error');
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
      throw error;
    }
  }

  // 异步版本的静态方法
  static async measureAsync<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, unknown>
  ): Promise<T> {
    const timer = new PerformanceTimer(operationName, metadata);
    timer.step('operation_start');
    
    try {
      const result = await operation();
      timer.step('operation_end');
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
      return result;
    } catch (error) {
      timer.step('operation_error');
      const perfLog = timer.end();
      logPerformanceToConsole(perfLog);
      throw error;
    }
  }
}

/**
 * 将性能日志输出到控制台
 */
export function logPerformanceToConsole(perfLog: PerformanceMetrics): void {
  if (!perfLog) return;
  
  console.group(`🕒 Performance: ${perfLog.operation} - ${perfLog.totalTime}ms`);
  
  if (perfLog.metadata && Object.keys(perfLog.metadata).length > 0) {
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

/**
 * 性能监控装饰器（如果需要的话）
 */
export function performanceMonitor(operationName?: string) {
  return function <T extends (...args: any[]) => any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    const name = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: Parameters<T>) {
      return PerformanceTimer.measure(name, () => method.apply(this, args));
    } as T;

    return descriptor;
  };
}

/**
 * 异步性能监控装饰器
 */
export function asyncPerformanceMonitor(operationName?: string) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const method = descriptor.value!;
    const name = operationName || `${target.constructor.name}.${propertyName}`;

    descriptor.value = function (...args: Parameters<T>) {
      return PerformanceTimer.measureAsync(name, () => method.apply(this, args));
    } as T;

    return descriptor;
  };
}

export { PerformanceTimer };
export type { PerformanceStep, PerformanceLogConfig };