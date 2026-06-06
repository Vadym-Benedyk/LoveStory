import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Modules import tokens explicitly via: @use '@/styles/tokens' as t;
        api: 'modern-compiler',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ['@mui/material', '@mui/icons-material'],
        },
      },
    },
  },
});
