import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function copyPublicOnWatch() {
  return {
    name: 'copy-public-on-watch',
    writeBundle() {
      const src = path.resolve(__dirname, 'public')
      const dest = path.resolve(__dirname, 'dist')
      if (!fs.existsSync(src)) return
      function copyDir(s, d) {
        fs.mkdirSync(d, { recursive: true })
        for (const entry of fs.readdirSync(s, { withFileTypes: true })) {
          const sp = path.join(s, entry.name), dp = path.join(d, entry.name)
          if (entry.isDirectory()) copyDir(sp, dp)
          else fs.copyFileSync(sp, dp)
        }
      }
      copyDir(src, dest)
    },
  }
}

export default defineConfig({
  plugins: [react(), copyPublicOnWatch()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 3010,
  },
})
