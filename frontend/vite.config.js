import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 9000,
    proxy: {
      // Local dev: proxy to backend services (run compliance 8080, alerts 8081, simulator 8082, telemetry 8083)
      '/api/compliance': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/compliance/, ''),
      },
      '/api/alerts': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/alerts/, ''),
      },
      '/api/simulator': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/simulator/, ''),
      },
      '/api/telemetry': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/telemetry/, ''),
      },
    },
  },
});
