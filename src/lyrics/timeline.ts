import type { Line, Word } from './types'

/** Índice da última linha que já começou em `t`, ou -1 antes da primeira. Busca binária. */
export function findLineIndex(lines: readonly Line[], t: number): number {
  let lo = 0
  let hi = lines.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].start <= t) {
      ans = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** Quanto da palavra já foi cantado em `t`, de 0 a 1. */
export function wordProgress(word: Word, t: number): number {
  if (t <= word.start) return 0
  if (t >= word.end) return 1
  return (t - word.start) / (word.end - word.start)
}
