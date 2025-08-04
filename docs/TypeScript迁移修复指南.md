# TypeScript 迁移修复指南

## 概述

本文档提供了在完成 JavaScript 到 TypeScript 迁移后，系统化修复类型错误、提升代码质量、实现代码质量极致化的完整方案。

## 一、全局修复思路与优先级

### 1.1 修复优先级排序

1. **优先修复类型错误**
   - TypeScript 类型报错会直接影响编译和运行，必须优先解决
   - 类型错误可能导致运行时错误，影响用户体验

2. **统一 ESLint/Prettier 规范**
   - 保证代码风格一致，减少低级错误
   - 提升代码可读性和可维护性

3. **完善类型声明**
   - 补全 `any`、`unknown`、隐式 `any`、第三方库类型等
   - 建立完整的类型安全体系

4. **消除所有 IDE/编译器红线**
   - 包括类型、语法、导入路径、依赖等
   - 确保开发环境无干扰

5. **引入自动化检查和格式化**
   - 保证后续开发不会反复出现低级问题
   - 建立代码质量保障机制

6. **逐步引入单元测试**
   - 保证重构和修复不会引入新 bug
   - 提升代码可靠性

### 1.2 修复原则

- **渐进式修复**：先保证编译通过，再逐步优化
- **类型安全优先**：优先解决类型问题，再处理风格问题
- **自动化优先**：能用工具自动修复的，不用手动修复
- **测试驱动**：重要修复要有测试保障

## 二、具体操作步骤

### 2.1 配置 TypeScript 严格模式

在 `tsconfig.json` 中开启所有严格选项：

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

这样可以最大程度暴露类型问题，确保类型安全。

### 2.2 配置 ESLint + Prettier + SonarJS

#### 2.2.1 安装依赖

```bash
# 代码质量工具链
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier
pnpm add -D husky lint-staged commitizen @commitlint/config-conventional
pnpm add -D sonarjs eslint-plugin-sonarjs
pnpm add -D @eslint/js eslint-plugin-react eslint-plugin-react-hooks
```

#### 2.2.2 ESLint 配置

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:sonarjs/recommended',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'sonarjs'],
  rules: {
    // 代码复杂度控制
    'sonarjs/cognitive-complexity': ['error', 15],
    'sonarjs/no-duplicate-string': ['error', 3],
    complexity: ['error', { max: 10 }],
    'max-lines-per-function': ['error', { max: 50 }],
    'max-depth': ['error', 4],

    // TypeScript 特定规则
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // React 特定规则
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',

    // 通用规则
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
```

#### 2.2.3 Prettier 配置

```json
// .prettierrc
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "avoid"
}
```

### 2.3 批量修复类型错误

#### 2.3.1 全局类型检查

```bash
# 运行 TypeScript 类型检查
pnpm tsc --noEmit

# 运行 ESLint 检查
pnpm lint

# 运行 Prettier 格式化
pnpm format
```

#### 2.3.2 修复策略

1. **IDE 批量修复**：使用 VSCode/JetBrains 的 TypeScript 工具
2. **优先修复核心类型**：如 `ImageData`、`FilterParams`、`Store` 等
3. **消除 any/unknown**：逐步将 `any` 替换为明确类型
4. **补全类型声明**：在 `src/types/index.ts` 中定义核心类型

#### 2.3.3 核心类型定义示例

```typescript
// src/types/index.ts
export interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export interface FilterParams {
  [key: string]: number | string | boolean;
}

export interface PerformanceMetrics {
  operation: string;
  totalTime: number;
  steps: Array<{ name: string; elapsed: number }>;
}

export interface EditorState {
  workerReady: boolean;
  opencvLoaded: boolean;
  imageWorker: Worker | null;
  activeTool: string | null;
  toolParams: FilterParams;
  isCropMode: boolean;
  isCollageMode: boolean;
}

export interface ImageState {
  currentImage: ImageData | null;
  originalImage: ImageData | null;
  history: ImageData[];
  historyIndex: number;
  maxHistory: number;
}

export interface UIState {
  loading: boolean;
  error: string | null;
  notification: {
    type: 'success' | 'error' | 'warning' | 'info';
    message: string;
  } | null;
}
```

### 2.4 处理第三方库类型问题

#### 2.4.1 安装类型包

```bash
# 安装常用类型包
pnpm add -D @types/node @types/react @types/react-dom
pnpm add -D @types/lodash @types/classnames
```

#### 2.4.2 自定义类型声明

对于没有类型声明的第三方库，创建类型声明文件：

```typescript
// src/types/global.d.ts
declare module '*.wasm' {
  const content: ArrayBuffer;
  export default content;
}

declare module '*.worker.js' {
  const workerConstructor: new () => Worker;
  export default workerConstructor;
}

// 全局变量声明
declare global {
  interface Window {
    cv: any; // OpenCV.js
    Module: any; // WebAssembly module
  }
}
```

### 2.5 统一导入路径和模块解析

#### 2.5.1 TypeScript 路径配置

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/utils/*": ["src/utils/*"],
      "@/types/*": ["src/types/*"],
      "@/store/*": ["src/store/*"],
      "@/hooks/*": ["src/hooks/*"]
    }
  }
}
```

#### 2.5.2 Vite 路径别名配置

```javascript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/store': path.resolve(__dirname, './src/store'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
    },
  },
});
```

### 2.6 代码风格和复杂度优化

#### 2.6.1 函数复杂度控制

```typescript
// 重构前：复杂函数
function processImage(
  imageData: ImageData,
  filters: FilterParams[]
): ImageData {
  // 50+ 行代码，复杂度高
}

// 重构后：拆分函数
function processImage(
  imageData: ImageData,
  filters: FilterParams[]
): ImageData {
  return filters.reduce((processed, filter) => {
    return applyFilter(processed, filter);
  }, imageData);
}

function applyFilter(imageData: ImageData, filter: FilterParams): ImageData {
  const { type, params } = filter;

  switch (type) {
    case 'brightness':
      return applyBrightness(imageData, params);
    case 'contrast':
      return applyContrast(imageData, params);
    default:
      return imageData;
  }
}
```

#### 2.6.2 文件大小控制

```typescript
// 拆分大文件
// 原文件：src/components/ImageEditor.tsx (500+ 行)
// 拆分为：
// - src/components/ImageEditor.tsx (主组件)
// - src/components/ImageEditor/ImageCanvas.tsx
// - src/components/ImageEditor/ImageToolbar.tsx
// - src/components/ImageEditor/ImagePanel.tsx
```

### 2.7 自动化工具链

#### 2.7.1 Husky + Lint-staged 配置

```json
// package.json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint --ext .ts,.tsx src/",
    "lint:fix": "eslint --ext .ts,.tsx src/ --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage"
  },
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{js,jsx,json,css,md}": ["prettier --write"]
  }
}
```

```bash
# 安装 husky
pnpm add -D husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

#### 2.7.2 Commitlint 配置

```javascript
// commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'chore',
        'revert',
        'ci',
        'build',
      ],
    ],
  },
};
```

### 2.8 持续集成与测试

#### 2.8.1 Vitest 配置

```javascript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

#### 2.8.2 测试示例

```typescript
// src/utils/__tests__/imageUtils.test.ts
import { describe, it, expect } from 'vitest';
import { applySepia, applyGrayscale } from '../imageUtils';

describe('imageUtils', () => {
  it('should apply sepia filter correctly', () => {
    const testImageData = new ImageData(
      new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
      2,
      1
    );

    const result = applySepia(testImageData);

    expect(result.data[0]).toBeGreaterThan(0);
    expect(result.data[1]).toBeGreaterThan(0);
    expect(result.data[2]).toBeGreaterThan(0);
  });
});
```

## 三、推荐的修复流程

### 3.1 阶段一：基础修复（1-2天）

1. **配置严格模式**

   ```bash
   # 更新 tsconfig.json，开启严格模式
   ```

2. **全局类型检查**

   ```bash
   pnpm tsc --noEmit
   # 记录所有类型报错
   ```

3. **安装和配置工具链**
   ```bash
   pnpm add -D eslint prettier husky lint-staged
   # 配置 .eslintrc.js, .prettierrc
   ```

### 3.2 阶段二：类型修复（3-5天）

1. **修复核心类型**
   - 补全 `src/types/index.ts`
   - 修复 Store 类型
   - 修复组件 Props 类型

2. **修复第三方库类型**
   - 安装缺失的类型包
   - 创建自定义类型声明

3. **消除 any/unknown**
   - 逐步替换为明确类型
   - 使用类型守卫和断言

### 3.3 阶段三：代码优化（2-3天）

1. **风格统一**

   ```bash
   pnpm lint:fix
   pnpm format
   ```

2. **复杂度优化**
   - 拆分大函数
   - 重构复杂逻辑

3. **自动化配置**
   - 配置 husky + lint-staged
   - 配置 commitlint

### 3.4 阶段四：测试保障（1-2天）

1. **单元测试**
   - 为核心工具函数写测试
   - 为关键业务逻辑写测试

2. **集成测试**
   - 测试组件交互
   - 测试状态管理

## 四、代码质量极致化的标准

### 4.1 类型安全标准

- ✅ 无 TypeScript 编译错误
- ✅ 无 `any` 类型（或极少且有注释说明）
- ✅ 所有核心类型有明确声明
- ✅ 第三方库类型完整

### 4.2 代码风格标准

- ✅ 无 ESLint 错误或警告
- ✅ 代码风格统一（Prettier）
- ✅ 函数复杂度控制在合理范围
- ✅ 文件大小控制在合理范围

### 4.3 自动化标准

- ✅ 所有提交都经过自动化检查
- ✅ 代码格式化自动化
- ✅ 类型检查自动化
- ✅ 测试运行自动化

### 4.4 测试覆盖标准

- ✅ 核心逻辑有单元测试覆盖
- ✅ 关键组件有集成测试
- ✅ 测试覆盖率 > 80%

## 五、常见问题与解决方案

### 5.1 类型错误修复

#### 问题：隐式 any 类型

```typescript
// 错误
function processData(data) {
  return data.map(item => item.value);
}

// 修复
function processData(data: Array<{ value: any }>) {
  return data.map(item => item.value);
}
```

#### 问题：第三方库无类型声明

```typescript
// 创建类型声明文件
// src/types/third-party.d.ts
declare module 'opencv-js' {
  export const cv: any;
}
```

### 5.2 导入路径问题

#### 问题：相对路径混乱

```typescript
// 错误
import { ImageUtils } from '../../../utils/imageUtils';

// 修复
import { ImageUtils } from '@/utils/imageUtils';
```

### 5.3 组件类型问题

#### 问题：Props 类型不明确

```typescript
// 错误
function ImageCanvas(props) {
  return <canvas {...props} />;
}

// 修复
interface ImageCanvasProps {
  width: number;
  height: number;
  className?: string;
}

function ImageCanvas(props: ImageCanvasProps) {
  return <canvas {...props} />;
}
```

## 六、可用脚本命令

### 6.1 package.json 脚本

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint --ext .ts,.tsx src/",
    "lint:fix": "eslint --ext .ts,.tsx src/ --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "test:ui": "vitest --ui",
    "prepare": "husky install",
    "commit": "git-cz"
  }
}
```

### 6.2 一键修复命令

```bash
# 一键修复所有可自动修复的问题
pnpm lint:fix && pnpm format && pnpm type-check
```

## 七、持续改进建议

### 7.1 定期检查

- 每周运行一次完整的代码质量检查
- 每月更新依赖包和类型定义
- 每季度审查和优化代码复杂度

### 7.2 团队协作

- 建立代码审查流程
- 制定代码质量标准
- 定期进行代码质量培训

### 7.3 工具升级

- 关注 TypeScript 新特性
- 及时升级 ESLint 规则
- 探索新的代码质量工具

## 总结

通过系统化的修复流程，可以逐步将项目从 JavaScript 迁移到高质量的 TypeScript 代码库。关键是要有耐心，分阶段推进，确保每个阶段都有明确的成果和标准。

最终目标是实现：

- **类型安全**：无类型错误，类型声明完整
- **代码质量**：风格统一，复杂度合理
- **自动化保障**：提交前自动检查，持续集成
- **测试覆盖**：核心逻辑有测试保障

这样的代码库不仅易于维护，也为后续的功能扩展和性能优化奠定了坚实的基础。
