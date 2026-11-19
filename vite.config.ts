import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// El navegador siempre llama a /api/v1 (mismo origen): en dev y preview lo reenvía este
// proxy al backend local; en Oracle lo hace Caddy. Sin CORS en ningún modo.
const BACK = process.env.VITE_BACK_URL ?? 'http://localhost:3005'
const proxy = { '/api': { target: BACK, changeOrigin: true } }

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // host:true → se puede probar desde el celular en 192.168.x.x:5173
  server: { port: 5173, host: true, open: true, proxy },
  preview: { port: 4173, host: true, proxy },
})
