# 测试文件说明

## 目录结构

```
src/test/
├── setup.ts                    # 测试环境配置
├── utils/
│   └── testHelpers.ts          # 测试工具函数
└── README.md                   # 本文件
```

## 文件说明

### setup.ts

测试环境的全局配置文件，包含：

- DOM测试库配置
- Canvas API Mock
- Worker API Mock
- ImageData API Mock

### testHelpers.ts

测试工具函数集合，提供：

- `createMockImageData()`: 创建测试用的图像数据
- `createMockCanvas()`: 创建测试用的Canvas元素
- `compareImageData()`: 比较两个ImageData是否相等
- `waitFor()`: 等待异步操作完成

## 使用示例

```typescript
import {
  createMockImageData,
  compareImageData,
} from '../test/utils/testHelpers';

// 创建测试图像数据
const redImage = createMockImageData(100, 100, [255, 0, 0, 255]);
const greenImage = createMockImageData(100, 100, [0, 255, 0, 255]);

// 比较图像数据
const isEqual = compareImageData(redImage, greenImage); // false
```
