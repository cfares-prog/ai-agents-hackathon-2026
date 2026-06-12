import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy targets 127.0.0.1 explicitly: another local app may occupy [::1]:5000,
// while the backend listens on the IPv4 loopback.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:5000', changeOrigin: true },
    },
  },
})
