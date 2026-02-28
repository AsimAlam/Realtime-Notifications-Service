import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true
      },
      '/notify': 'http://localhost:8080',
      '/presence': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080'
    }
  }
});
