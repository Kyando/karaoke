import type { Line, Lyrics, Word } from './types'
import { estimateWords } from './estimateWords'

/** Tag de tempo no começo da linha; aplicada repetidamente para "[00:10][01:20] refrão". */
const LINE_TAG = /^\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/
const WORD_TAG = /<(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)>/
const OFFSET_TAG = /^\[offset:\s*([+-]?\d+)\s*\]/i

/** Duração usada para a última linha, que não tem "próxima linha" para marcar o fim. */
const LAST_LINE_SECONDS = 6

function toSeconds(min: string, sec: string): number {
  return Number(min) * 60 + Number(sec.replace(':', '.'))
}

interface RawLine {
  start: number
  body: string
}

/**
 * Lê LRC simples ([mm:ss.xx] texto) e LRC estendido (<mm:ss.xx> antes de cada palavra).
 * Linhas com vários tempos ([00:10][01:20] refrão) viram várias linhas.
 */
export function parseLrc(source: string): Lyrics {
  let fileOffset = 0
  const raw: RawLine[] = []

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const offset = OFFSET_TAG.exec(line)
    if (offset) {
      // No LRC, offset positivo adianta a letra.
      fileOffset = -Number(offset[1]) / 1000
      continue
    }

    const starts: number[] = []
    let rest = line
    let match: RegExpExecArray | null
    while ((match = LINE_TAG.exec(rest))) {
      starts.push(toSeconds(match[1], match[2]))
      rest = rest.slice(match[0].length)
    }
    if (starts.length === 0) continue // metadados como [ar:], [ti:] ou lixo
    for (const start of starts) raw.push({ start, body: rest.trim() })
  }

  raw.sort((a, b) => a.start - b.start)

  const lines: Line[] = raw.map((r, i) => {
    const end = i + 1 < raw.length ? raw[i + 1].start : r.start + LAST_LINE_SECONDS
    return buildLine(r.start, end, r.body)
  })

  return { lines, fileOffset }
}

function buildLine(start: number, end: number, body: string): Line {
  if (!WORD_TAG.test(body)) {
    const text = body.replace(/\s+/g, ' ')
    return { start, end, text, words: estimateWords(text, start, end), sync: 'estimated' }
  }

  // LRC estendido: "<00:12.00> Never <00:12.40> gonna <00:12.70> give"
  const words: Word[] = []
  // split com grupos de captura devolve [antes, min, seg, texto, min, seg, texto, ...]
  const parts = body.split(new RegExp(WORD_TAG.source, 'g'))
  for (let i = 1; i < parts.length; i += 3) {
    const t = toSeconds(parts[i], parts[i + 1])
    const chunk = (parts[i + 2] ?? '').trim()
    if (!chunk) {
      // tag sem texto marca o fim da palavra anterior
      if (words.length) words[words.length - 1].end = t
      continue
    }
    for (const piece of chunk.split(/\s+/)) words.push({ text: piece, start: t, end: Number.NaN })
  }
  for (let i = 0; i < words.length; i++) {
    if (Number.isNaN(words[i].end)) words[i].end = i + 1 < words.length ? words[i + 1].start : end
  }
  const text = words.map((w) => w.text).join(' ')
  return { start: words[0]?.start ?? start, end, text, words, sync: 'word' }
}
