import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: ['948874391e98.ngrok-free.app', 'localhost', '0.0.0.0', '.ngrok-free.app']
  }
})
