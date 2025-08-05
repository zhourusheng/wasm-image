import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 构建分析插件（仅在构建时启用）
    process.env.ANALYZE &&
      visualizer({
        filename: 'dist/stats.html',
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
  ].filter(Boolean),

  // 路径别名配置
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/components': resolve(__dirname, './src/components'),
      '@/hooks': resolve(__dirname, './src/hooks'),
      '@/store': resolve(__dirname, './src/store'),
      '@/utils': resolve(__dirname, './src/utils'),
      '@/types': resolve(__dirname, './src/types'),
    },
  },

  // 构建配置
  build: {
    target: 'es2020',
    sourcemap: true,
    cssCodeSplit: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    rollupOptions: {
      output: {
        // 手动分包配置
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'antd-vendor': ['antd'],
          'icons-vendor': ['@ant-design/icons', 'lucide-react'],
          'store-vendor': ['zustand'],
        },
        // 文件名配置
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: assetInfo => {
          const info = assetInfo.name?.split('.') || [];
          let extType = info[info.length - 1];

          if (
            /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/i.test(
              assetInfo.name || ''
            )
          ) {
            extType = 'media';
          } else if (
            /\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(assetInfo.name || '')
          ) {
            extType = 'img';
          } else if (
            /\.(woff2?|eot|ttf|otf)(\?.*)?$/i.test(assetInfo.name || '')
          ) {
            extType = 'fonts';
          }

          return `assets/${extType}/[name]-[hash][extname]`;
        },
      },
      // 外部依赖处理
      external: id => {
        // OpenCV.js 从CDN加载，不打包
        return id.includes('opencv');
      },
    },
    // 构建优化
    assetsInlineLimit: 4096, // 4kb以下的资源内联
    chunkSizeWarningLimit: 1000, // chunk大小警告阈值
  },

  // 开发服务器配置
  server: {
    port: 5173,
    host: true,
    open: true,
    cors: true,
    // 代理配置（如果需要）
    proxy: {
      // '/api': {
      //   target: 'http://localhost:3000',
      //   changeOrigin: true,
      //   secure: false,
      // },
    },
  },

  // 预览服务器配置
  preview: {
    port: 4173,
    host: true,
    open: true,
  },

  // 依赖预构建配置
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'antd',
      '@ant-design/icons',
      'lucide-react',
      'zustand',
    ],
    exclude: ['@vite/client', '@vite/env'],
    esbuildOptions: {
      target: 'es2020',
    },
  },

  // 环境变量配置
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __PROD__: JSON.stringify(process.env.NODE_ENV === 'production'),
  },

  // CSS配置
  css: {
    modules: {
      localsConvention: 'camelCase',
    },
    postcss: './postcss.config.js',
  },

  // Worker配置
  worker: {
    format: 'iife', // 改为iife格式以支持importScripts
    plugins: [
      // Worker特定插件
    ],
  },

  // 实验性功能
  experimental: {
    renderBuiltUrl(
      filename: string,
      { hostType }: { hostType: 'js' | 'css' | 'html' }
    ) {
      if (hostType === 'js') {
        return { js: `window.__prependStaticUrl("${filename}")` };
      } else {
        return { relative: true };
      }
    },
  },
});
