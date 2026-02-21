import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    global: 'window',
    'process.env': {}
  },
  optimizeDeps: {
    include: ['sockjs-client', '@stomp/stompjs']
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/notify': 'http://localhost:8080',
      '/presence': 'http://localhost:8080',
      '/ws': { target: 'http://localhost:8080', ws: true }
    }
  }
})
