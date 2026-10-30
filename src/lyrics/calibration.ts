import type { Line } from './types'

/** Toques mais longe do que isso de qualquer início de linha são ignorados. */
const MAX_TAP_DISTANCE = 1.5

/**
 * Desvio entre um toque e o início de linha mais próximo, em segundos.
 * Positivo = a letra está adiantada em relação ao que a pessoa ouviu.
 */
export function tapDeviation(lines: readonly Line[], tapLyricTime: number): number | null {
  let best: number | null = null
  for (const line of lines) {
    if (line.words.length === 0) continue
    const d = tapLyricTime - line.start
    if (Math.abs(d) <= MAX_TAP_DISTANCE && (best === null || Math.abs(d) < Math.abs(best))) best = d
  }
  return best
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0
  const s = [...values].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Primeira linha com texto (pula marcações instrumentais vazias). */
export function firstSungLine(lines: readonly Line[]): Line | undefined {
  return lines.find((l) => l.words.length > 0)
}
