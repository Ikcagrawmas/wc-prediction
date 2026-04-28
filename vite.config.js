import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true, // fail loudly if 5173 is taken — never silently use 5174
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Log proxy activity so you can confirm forwarding in dev
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('[vite proxy error]', err.message)
          })
          proxy.on('proxyReq', (_, req) => {
            console.log('[vite proxy]', req.method, req.url, '→ :3001')
          })
        },
      },
    },
  },
})
