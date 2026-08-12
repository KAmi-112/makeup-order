import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // Local development uses the root; GitHub Pages uses the repository path.
  base: command === 'serve' ? '/' : '/makeup-order/',
}))
