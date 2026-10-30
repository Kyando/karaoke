// Copia o dicionário do kuromoji (análise de japonês) para public/dict, de onde o app o
// baixa sob demanda, só quando a música tem letra em japonês. Roda antes do dev e do build.
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const from = fileURLToPath(new URL('../node_modules/kuromoji/dict/', import.meta.url))
const to = fileURLToPath(new URL('../public/dict/', import.meta.url))

if (!existsSync(from)) {
  console.error('Dicionário do kuromoji não encontrado. Rode npm install.')
  process.exit(1)
}
mkdirSync(to, { recursive: true })
cpSync(from, to, { recursive: true })
console.log('Dicionário japonês copiado para public/dict')
