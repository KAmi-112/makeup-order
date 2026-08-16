import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const localBackgroundDir = path.resolve(projectDir, '..', '小荷背景')
const backgroundMime = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  // 当前测试目录里的 .heif 文件实际是 JPEG 编码。
  '.heif': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
}

function localOrderBackgrounds() {
  return {
    name: 'local-order-backgrounds',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/local-order-backgrounds', (req, res, next) => {
        if (!fs.existsSync(localBackgroundDir)) return next()
        const files = fs.readdirSync(localBackgroundDir).filter(name => backgroundMime[path.extname(name).toLowerCase()])
        if (req.url === '/' || req.url === '/index.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(JSON.stringify(files.map(name => ({ name, url: `/local-order-backgrounds/${encodeURIComponent(name)}` }))))
          return
        }
        const requested = decodeURIComponent((req.url || '').replace(/^\//, '').split('?')[0])
        if (!files.includes(requested)) return next()
        res.setHeader('Content-Type', backgroundMime[path.extname(requested).toLowerCase()])
        res.setHeader('Cache-Control', 'private, max-age=3600')
        fs.createReadStream(path.join(localBackgroundDir, requested)).pipe(res)
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), localOrderBackgrounds()],
  // Local development uses the root; GitHub Pages uses the repository path.
  base: command === 'serve' ? '/' : '/makeup-order/',
}))
