import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 构建分析插件 - 生成打包分析报告
    visualizer({
      filename: 'dist/stats.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  worker: {
    format: 'es'
  },
  build: {
    // 构建优化配置
    chunkSizeWarningLimit: 1000, // 提高警告阈值到1MB
    rollupOptions: {
      output: {
        // 手动分包配置，将大型依赖分离到独立chunks
        manualChunks: {
          // React相关库单独打包
          'react-vendor': ['react', 'react-dom'],
          // Ant Design相关库单独打包
          'antd-vendor': ['antd'],
          // 图标库单独打包
          'icons-vendor': ['@ant-design/icons', 'lucide-react'],
          // 状态管理库单独打包
          'store-vendor': ['zustand'],
        },
        // 为chunks添加hash以便于缓存
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
          if (facadeModuleId && facadeModuleId.includes('node_modules')) {
            return 'vendor/[name].[hash].js'
          }
          return 'js/[name].[hash].js'
        },
        // 为entry和assets添加hash
        entryFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'css/[name].[hash].css'
          }
          return 'assets/[name].[hash][extname]'
        }
      }
    },
    // 启用sourcemap便于调试（可选）
    sourcemap: false,
    // 启用代码压缩
    minify: 'terser',
    terserOptions: {
      compress: {
        // 移除console.log（生产环境）
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
  // 优化开发服务器
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      'zustand'
    ]
  }
}) 