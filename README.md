# 🎨 WebAssembly 图像处理应用

<div align="center">

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2.0-blue?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.0.5-646CFF?logo=vite)](https://vitejs.dev/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-OpenCV.js-654FF0?logo=webassembly)](https://webassembly.org/)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](LICENSE)
[![Test Coverage](https://img.shields.io/badge/Coverage-20.8%25-orange)](docs/测试覆盖率改进计划.md)

**基于 React + TypeScript + WebAssembly 的高性能在线图像编辑器**

[🚀 在线体验](#) | [📖 文档](docs/) | [🧪 测试报告](docs/测试覆盖率改进计划.md) | [🔧 技术架构](docs/技术文档.md)

</div>

## ✨ 项目亮点

- 🚀 **混合处理引擎** - 智能选择 JavaScript/WebAssembly 引擎，性能与兼容性并重
- 🎯 **TypeScript 全栈** - 完整的类型安全体系，提升开发效率
- 🧩 **模块化架构** - 基于 Zustand 的四个独立 store，清晰的状态管理
- 🔄 **实时预览** - OffscreenCanvas 确保 UI 响应性，性能监控保证处理效率
- 🎨 **现代界面** - Ant Design + Tailwind CSS 的现代化 UI 设计
- 🧪 **测试驱动** - 完整的测试体系和代码质量保证流程

## 🎯 功能特性

### 🖼️ 基础图像编辑

- **文件操作**: 支持 JPEG、PNG、WebP 等格式的上传和导出
- **几何变换**: 裁剪、旋转（90°）、水平/垂直翻转
- **色彩调整**: 亮度、对比度、饱和度、色彩平衡
- **历史记录**: 完整的撤销/重做功能，支持历史记录管理

### 🎨 高级滤镜效果

**JavaScript 引擎**（轻量快速）：

- 复古滤镜（Sepia）
- 灰度转换
- 基础色彩调整

**WebAssembly 引擎**（高性能）：

- 高斯模糊
- 锐化滤镜
- 人脸美颜（磨皮 + 美白）

### 🖌️ 专业工具

- **文字水印**: 可调整字体、大小、颜色、透明度
- **图像压缩**: 可调节压缩质量，实时预览文件大小
- **交互式裁剪**: 拖拽选择裁剪区域，实时预览效果

### 🎪 拼贴模式

- **多种布局**: 垂直、水平、网格排列
- **样式定制**: 间距调整、背景色设置、圆角效果
- **智能预览**: 低分辨率预览 + 高分辨率导出

## 🏗️ 技术架构

### 核心技术栈

```
前端框架     React 18 + TypeScript 5.9.2
构建工具     Vite 7.0.5
UI 组件      Ant Design 5.26.6 + Tailwind CSS 3.4.17
状态管理     Zustand 5.0.6
图像处理     OpenCV.js (WebAssembly)
并行处理     Web Worker + OffscreenCanvas
测试框架     Vitest 1.6.0 + React Testing Library
代码质量     ESLint + Prettier + TypeScript 严格模式
包管理器     pnpm 10.11.0
```

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        主线程 (React)                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   用户界面       │    状态管理      │      组件层            │
│ (Ant Design +   │   (4个 Store)   │   (Layout/Panels/      │
│  Tailwind CSS)  │                 │    Modes/Tools)        │
└─────────────────┼─────────────────┼─────────────────────────┘
                  │                 │
┌─────────────────┼─────────────────┼─────────────────────────┐
│                 │  Web Worker 线程 │                        │
├─────────────────┴─────────────────┴─────────────────────────┤
│  imageWorker.ts  │  OpenCV.js     │  OffscreenCanvas       │
│  (混合引擎)       │  (WebAssembly)  │  (高性能渲染)           │
└─────────────────────────────────────────────────────────────┘
```

### 状态管理架构

- **imageStore**: 图像数据和历史记录管理
- **editorStore**: 编辑器状态和工具管理
- **uiStore**: UI 状态和用户交互管理
- **collageStore**: 图像拼贴功能专用状态

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- pnpm >= 8.0.0

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd wasm-image

# 安装依赖
pnpm install
```

### 开发环境

```bash
# 启动开发服务器
pnpm dev

# 在浏览器中访问 http://localhost:5173
```

### 构建部署

```bash
# 构建生产版本
pnpm build

# 预览构建结果
pnpm preview

# 构建分析
pnpm build:analyze
```

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行测试并生成覆盖率报告
pnpm test:coverage

# 监听模式运行测试
pnpm test:watch

# 可视化测试界面
pnpm test:ui
```

### 当前测试状况

- **整体覆盖率**: 20.8% (目标: 50%+)
- **已测试模块**: editorStore (97.93%), Canvas (90.39%), useImageProcessing (74.41%)
- **测试改进计划**: [查看详细计划](docs/测试覆盖率改进计划.md)

## 🔧 开发工具

### 代码质量

```bash
# ESLint 检查
pnpm lint

# 自动修复 ESLint 问题
pnpm lint:fix

# Prettier 格式化
pnpm format

# TypeScript 类型检查
pnpm type-check

# 完整验证（类型检查 + 代码检查 + 测试 + 覆盖率）
pnpm validate
```

### Git 钩子

项目配置了自动化的代码质量检查：

- **Pre-commit**: TypeScript 检查 + ESLint + Prettier + 相关测试
- **Pre-push**: 完整测试套件 + 覆盖率检查

## 📁 项目结构

```
wasm-image/
├── docs/                          # 项目文档
│   ├── 技术文档.md                  # 完整技术文档
│   ├── 测试覆盖率改进计划.md         # 测试改进计划
│   ├── 测试指南.md                  # 测试编写指南
│   ├── 文档代码同步方案.md           # 文档维护方案
│   └── prd.md                     # 产品需求文档
├── src/
│   ├── components/                # React 组件
│   │   ├── layout/               # 布局组件
│   │   ├── panels/               # 面板组件
│   │   ├── modes/                # 模式组件
│   │   └── common/               # 通用组件
│   ├── hooks/                    # 自定义 Hook
│   ├── store/                    # Zustand 状态管理
│   ├── utils/                    # 工具函数
│   ├── types/                    # TypeScript 类型定义
│   └── __tests__/                # 测试文件
├── public/                       # 静态资源
├── scripts/                      # 构建脚本
└── coverage/                     # 测试覆盖率报告
```

## 🎨 使用说明

### 基础操作

1. **上传图像**: 点击"打开文件"按钮或拖拽图像到画布区域
2. **选择工具**: 在左侧工具栏选择需要的编辑工具
3. **调整参数**: 在右侧参数面板调整效果强度
4. **实时预览**: 参数调整时可实时预览效果
5. **应用效果**: 点击"应用"按钮确认修改
6. **导出图像**: 点击"导出"按钮下载处理后的图像

### 高级功能

- **拼贴模式**: 点击顶部"拼贴"按钮进入多图像拼贴模式
- **历史记录**: 使用 Ctrl+Z/Ctrl+Y 进行撤销/重做操作
- **缩放平移**: 使用鼠标滚轮缩放，拖拽平移图像
- **键盘快捷键**: 支持常用快捷键操作

## 🌟 性能特性

### 智能引擎选择

- **简单滤镜**: 使用 JavaScript 引擎，启动快速
- **复杂算法**: 自动切换到 WebAssembly 引擎，性能优异
- **降级处理**: OpenCV 未就绪时自动降级到 JavaScript 处理

### 性能优化

- **组件懒加载**: 非核心组件按需加载
- **代码分割**: 智能分包，优化加载性能
- **OffscreenCanvas**: 后台渲染，确保 UI 响应性
- **性能监控**: 内置性能计时器，实时监控处理效率

## 🔍 浏览器兼容性

| 浏览器  | 版本要求 | WebAssembly | OffscreenCanvas | 状态     |
| ------- | -------- | ----------- | --------------- | -------- |
| Chrome  | >= 69    | ✅          | ✅              | 完全支持 |
| Firefox | >= 105   | ✅          | ✅              | 完全支持 |
| Safari  | >= 16.4  | ✅          | ✅              | 完全支持 |
| Edge    | >= 79    | ✅          | ✅              | 完全支持 |

### 降级方案

- 不支持 WebAssembly: 自动使用 JavaScript 引擎
- 不支持 OffscreenCanvas: 回退到主线程渲染
- 不支持 Web Worker: 降级到同步处理

## 🤝 贡献指南

### 开发流程

1. Fork 项目到个人账户
2. 创建功能分支: `git checkout -b feature/amazing-feature`
3. 提交更改: `git commit -m 'Add amazing feature'`
4. 推送分支: `git push origin feature/amazing-feature`
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 编写所有代码
- 遵循 ESLint 和 Prettier 配置
- 为新功能添加相应的测试
- 更新相关文档

### 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
feat: 新功能
fix: 修复问题
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建过程或辅助工具的变动
```

## 📚 相关文档

- [📖 技术文档](docs/技术文档.md) - 完整的技术实现文档
- [🧪 测试指南](docs/测试指南.md) - 测试编写和运行指南
- [📊 测试覆盖率改进计划](docs/测试覆盖率改进计划.md) - 测试覆盖率提升计划
- [🔄 文档同步方案](docs/文档代码同步方案.md) - 文档维护自动化方案
- [📋 产品需求文档](docs/prd.md) - 项目需求和规划

## 🔮 未来规划

### 短期目标 (1-3 个月)

- [ ] 提升测试覆盖率至 50%+
- [ ] 完善 UI 组件测试
- [ ] 优化性能监控系统
- [ ] 增加更多图像滤镜

### 中期目标 (3-6 个月)

- [ ] 集成 WebGPU 加速
- [ ] 添加批量处理功能
- [ ] 支持更多图像格式
- [ ] 移动端适配优化

### 长期目标 (6+ 个月)

- [ ] AI 功能集成
- [ ] 插件系统开发
- [ ] 云端同步功能
- [ ] 多用户协作编辑

## ❓ 常见问题

<details>
<summary><strong>Q: 为什么选择 WebAssembly 而不是纯 JavaScript？</strong></summary>

A: WebAssembly 在处理复杂图像算法时性能更优，特别是高斯模糊、锐化等计算密集型操作。同时项目采用混合引擎，简单操作仍使用 JavaScript，确保最佳的性能和兼容性平衡。

</details>

<details>
<summary><strong>Q: 图像处理是否会上传到服务器？</strong></summary>

A: 不会。所有图像处理都在浏览器客户端完成，保护用户隐私安全。OpenCV.js 通过 CDN 加载，图像数据不会离开用户设备。

</details>

<details>
<summary><strong>Q: 支持处理多大的图像？</strong></summary>

A: 项目支持最大 4K 分辨率的图像处理，具体限制取决于设备内存。大图像会自动进行内存优化处理。

</details>

<details>
<summary><strong>Q: 如何报告问题或建议新功能？</strong></summary>

A: 请在 GitHub Issues 中提交问题报告或功能建议，我们会及时响应和处理。

</details>

## 📄 许可证

本项目采用 [ISC License](LICENSE) 许可证。

## 🙏 致谢

- [OpenCV.js](https://opencv.org/) - 强大的计算机视觉库
- [React](https://reactjs.org/) - 优秀的前端框架
- [Ant Design](https://ant.design/) - 企业级 UI 组件库
- [Vite](https://vitejs.dev/) - 快速的构建工具
- [Zustand](https://github.com/pmndrs/zustand) - 轻量级状态管理

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给它一个 Star！**

Made with ❤️ by [开发团队]

</div>
