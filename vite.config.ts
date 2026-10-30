import { createReadStream, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vitest/config'
import react from '@vitejs/plugin-react'

/**
 * O servidor de desenvolvimento entrega arquivos .gz com "Content-Encoding: gzip"; o
 * navegador descompacta sozinho e o kuromoji, que descompacta por conta própria, falha.
 * O GitHub Pages entrega os .gz crus, então isto só é necessário no `npm run dev`.
 */
function rawDictionary(): Plugin {
  const dictDir = fileURLToPath(new URL('./public/dict/', import.meta.url))
  return {
    name: 'raw-kuromoji-dictionary',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const match = req.url?.match(/\/dict\/([\w.]+\.dat\.gz)$/)
        const file = match && dictDir + match[1]
        if (!file || !existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/gzip')
        createReadStream(file).pipe(res)
      })
    },
  }
}

// base relativa: funciona em https://<user>.github.io/<repo>/ sem configurar o nome do repo
export default defineConfig({
  base: './',
  plugins: [react(), rawDictionary()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
