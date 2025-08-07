import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Canvas API
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    rotate: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    strokeRect: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
  }),
});

// Mock transferControlToOffscreen for OffscreenCanvas support
Object.defineProperty(
  HTMLCanvasElement.prototype,
  'transferControlToOffscreen',
  {
    value: vi.fn(() => {
      // 返回一个模拟的OffscreenCanvas对象
      return {
        getContext: vi.fn(() => ({
          canvas: { width: 100, height: 100 },
          clearRect: vi.fn(),
          drawImage: vi.fn(),
        })),
        width: 100,
        height: 100,
      };
    }),
  }
);

// Mock Worker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).Worker = class MockWorker {
  constructor(
    public stringUrl: string | URL,
    public options?: WorkerOptions
  ) {}

  postMessage = vi.fn();
  terminate = vi.fn();
  onmessage = vi.fn();
  onerror = vi.fn();
  onmessageerror = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
};

// Mock ImageData
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(global as any).ImageData = class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = 'srgb';

  constructor(
    data: Uint8ClampedArray | number,
    width?: number,
    height?: number
  ) {
    if (typeof data === 'number') {
      this.width = data;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.height = width!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.data = new Uint8ClampedArray(data * width! * 4);
    } else {
      this.data = data;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.width = width!;
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.height = height!;
    }
  }
};
