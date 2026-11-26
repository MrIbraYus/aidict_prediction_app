import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// AIDICT UI prototype — design-only build. No backend, no real data.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
})
