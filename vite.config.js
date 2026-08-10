import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss()],
  // 开发端使用 localhost 根路径，生产构建使用 GitHub Pages 仓库子路径。
  base: command === 'serve' ? '/' : '/makeup-order/',
}))
