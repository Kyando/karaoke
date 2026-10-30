import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base relativa: funciona em https://<user>.github.io/<repo>/ sem configurar o nome do repo
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
