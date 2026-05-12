import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
// base 由环境变量决定，便于不同部署目标：
// - 本地 / Netlify / 自托管根路径：留空 → "/"
// - GitHub Pages 项目站点 (username.github.io/repo)：VITE_BASE_PATH=/repo/
export default defineConfig({
    base: process.env.VITE_BASE_PATH || '/',
    plugins: [react()],
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
});
