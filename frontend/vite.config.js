import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: true, // Membuka gerbang untuk semua host luar
    
    // Tambahkan baris client hmr di bawah ini:
    // hmr: default (localhost) — jika pakai LocalTunnel/ngrok,
    // override via VITE_HMR_HOST env var di .env.local
  }
})
