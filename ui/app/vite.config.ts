import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4870',
      '/events': 'http://127.0.0.1:4870',
      '/health': 'http://127.0.0.1:4870',
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
  },
});
