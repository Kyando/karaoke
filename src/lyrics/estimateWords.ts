import type { Word } from './types'

/**
 * Tempo cantado estimado por caractere. Uma linha raramente ocupa todo o intervalo até a
 * próxima (há respiros e trechos instrumentais), então limitamos a duração por isso.
 */
const SECONDS_PER_CHAR = 0.16
const MIN_LINE_SECONDS = 1.2

/**
 * Nível 2 do plano: divide o tempo da linha entre as palavras pelo tamanho de cada uma.
 * O +1 conta o espaço/respiro entre palavras, para palavras curtas não ficarem instantâneas.
 */
export function estimateWords(text: string, start: number, end: number): Word[] {
  const pieces = text.split(/\s+/).filter(Boolean)
  if (pieces.length === 0) return []

  const weights = pieces.map((p) => p.length + 1)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const sungDuration = Math.min(end - start, Math.max(MIN_LINE_SECONDS, totalWeight * SECONDS_PER_CHAR))

  const words: Word[] = []
  let t = start
  for (let i = 0; i < pieces.length; i++) {
    const d = (sungDuration * weights[i]) / totalWeight
    words.push({ text: pieces[i], start: t, end: t + d })
    t += d
  }
  return words
}
