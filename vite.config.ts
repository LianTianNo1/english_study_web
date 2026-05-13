import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// base 由环境变量决定，便于不同部署目标：
// - 本地 / Netlify / 自托管根路径：留空 → "/"
// - GitHub Pages 项目站点 (username.github.io/repo)：VITE_BASE_PATH=/repo/
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: 'English Hub · 私人学习日志',
        short_name: 'English Hub',
        description: '本地优先的英语单词与语法学习日志：每日新词、间隔复习、错题本、语法关卡，IndexedDB 永久离线。',
        theme_color: '#FBF7F0',
        background_color: '#FBF7F0',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'zh-CN',
        categories: ['education', 'productivity', 'books'],
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'favicon.svg', sizes: '64x64 128x128 256x256', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // 精确控制 precache：只缓存 app shell；词库走 runtimeCaching CacheFirst（按需下载）
        globPatterns: ['**/*.{js,css,html,svg,woff2,ico}'],
        globIgnores: ['**/data/**', '**/node_modules/**'],
        // 单文件上限保守值（app shell 文件都很小）
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // Google Fonts CSS — StaleWhileRevalidate（快速但偶尔更新）
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-stylesheets' },
          },
          {
            // 字体文件 — CacheFirst，年度有效（字体几乎不变）
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // 词库数据 (public/data/*.json) —— 大文件，长期缓存
            urlPattern: /\/data\/.*\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wordbook-data',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        navigateFallback: 'index.html',
        // AI 接口绝不走 SW 缓存：用户期望调用就是新的请求
        navigateFallbackDenylist: [/^\/api/, /openai\.com/, /googleapis\.com\/.*generative/],
      },
      devOptions: {
        // 本地开发也启用 SW，便于调试
        enabled: false,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    // 把大依赖拆出来，配合下面的 React.lazy 路由级分割
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            if (id.includes('dexie')) return 'vendor-dexie';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('@tanstack')) return 'vendor-virtual';
            return 'vendor';
          }
          // 把语法题库内容（GRAMMAR_LESSONS 几百 KB）拆开
          if (id.includes('/data/grammar-lessons')) return 'data-grammar';
        },
      },
    },
    chunkSizeWarningLimit: 700,
  },
});
