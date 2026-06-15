import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Allow importing type-only modules from ../shared (outside app root).
    fs: { allow: ['..'] },
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
