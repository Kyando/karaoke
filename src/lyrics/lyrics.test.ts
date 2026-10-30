import { describe, expect, it } from 'vitest'
import { parseLrc } from './parseLrc'
import { estimateWords } from './estimateWords'
import { findLineIndex, wordProgress } from './timeline'
import { median, tapDeviation } from './calibration'
import { rankByDuration, type LrclibRecord } from './lrclib'

describe('parseLrc', () => {
  it('lê linhas simples e calcula o fim pela próxima linha', () => {
    const { lines } = parseLrc('[ar:Alguém]\n[00:01.50] Primeira linha\n[00:04.00] Segunda linha\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ start: 1.5, end: 4, text: 'Primeira linha', sync: 'estimated' })
    expect(lines[1].end).toBeCloseTo(10)
  })

  it('aceita minutos longos, milissegundos e o separador ":"', () => {
    const { lines } = parseLrc('[01:02.345]a\n[10:00:50]b')
    expect(lines[0].start).toBeCloseTo(62.345)
    expect(lines[1].start).toBeCloseTo(600.5)
  })

  it('expande linhas com vários tempos e ordena', () => {
    const { lines } = parseLrc('[00:30.00][00:10.00] Refrão\n[00:20.00] Verso')
    expect(lines.map((l) => [l.start, l.text])).toEqual([
      [10, 'Refrão'],
      [20, 'Verso'],
      [30, 'Refrão'],
    ])
  })

  it('mantém linhas vazias como trecho instrumental', () => {
    const { lines } = parseLrc('[00:01.00] Canta\n[00:03.00]\n[00:09.00] Volta')
    expect(lines[1]).toMatchObject({ text: '', words: [] })
  })

  it('converte a tag [offset:] (positivo adianta a letra)', () => {
    expect(parseLrc('[offset:+500]\n[00:01.00] x').fileOffset).toBeCloseTo(-0.5)
    expect(parseLrc('[offset:-250]\n[00:01.00] x').fileOffset).toBeCloseTo(0.25)
  })

  it('lê LRC estendido com tempo por palavra', () => {
    const { lines } = parseLrc('[00:12.00]<00:12.00> Cada <00:12.40> palavra <00:13.10> chega <00:13.60>\n[00:15.00] fim')
    const l = lines[0]
    expect(l.sync).toBe('word')
    expect(l.words.map((w) => [w.text, w.start, w.end])).toEqual([
      ['Cada', 12, 12.4],
      ['palavra', 12.4, 13.1],
      ['chega', 13.1, 13.6],
    ])
  })
})

describe('estimateWords', () => {
  it('divide pelo tamanho das palavras, em ordem e sem buracos', () => {
    const w = estimateWords('a palavra', 10, 20)
    expect(w[0].start).toBe(10)
    expect(w[1].start).toBeCloseTo(w[0].end)
    expect(w[1].end - w[1].start).toBeGreaterThan(w[0].end - w[0].start)
  })

  it('não estica uma linha curta até uma pausa longa', () => {
    const w = estimateWords('oi', 0, 30)
    expect(w[w.length - 1].end).toBeLessThan(3)
  })

  it('nunca passa do início da próxima linha', () => {
    const w = estimateWords('uma linha bem comprida de verdade mesmo', 0, 2)
    expect(w[w.length - 1].end).toBeCloseTo(2)
  })
})

describe('timeline', () => {
  const { lines } = parseLrc('[00:01.00] a\n[00:02.00] b\n[00:03.00] c')
  it('acha a linha atual por busca binária', () => {
    expect(findLineIndex(lines, 0.5)).toBe(-1)
    expect(findLineIndex(lines, 1)).toBe(0)
    expect(findLineIndex(lines, 2.99)).toBe(1)
    expect(findLineIndex(lines, 100)).toBe(2)
  })
  it('calcula o progresso da palavra entre 0 e 1', () => {
    const word = { text: 'x', start: 1, end: 2 }
    expect(wordProgress(word, 0)).toBe(0)
    expect(wordProgress(word, 1.25)).toBeCloseTo(0.25)
    expect(wordProgress(word, 3)).toBe(1)
  })
})

describe('calibração', () => {
  const { lines } = parseLrc('[00:10.00] a\n[00:20.00]\n[00:30.00] b')
  it('mede o desvio até o início de linha cantada mais próximo', () => {
    expect(tapDeviation(lines, 10.12)).toBeCloseTo(0.12)
    expect(tapDeviation(lines, 29.9)).toBeCloseTo(-0.1)
  })
  it('ignora toques longe de qualquer linha e linhas instrumentais', () => {
    expect(tapDeviation(lines, 20.05)).toBeNull()
  })
  it('usa a mediana para resistir a toques errados', () => {
    expect(median([0.1, 0.12, 0.11, 0.9])).toBeCloseTo(0.115)
    expect(median([])).toBe(0)
  })
})

describe('rankByDuration', () => {
  const rec = (id: number, duration: number, synced = true): LrclibRecord => ({
    id, duration, trackName: 't', artistName: 'a', albumName: null, instrumental: false,
    plainLyrics: 'x', syncedLyrics: synced ? '[00:01.00] x' : null,
  })
  it('prefere letra sincronizada e depois a duração mais próxima do vídeo', () => {
    const out = rankByDuration([rec(1, 200), rec(2, 213, false), rec(3, 215)], 213)
    expect(out.map((r) => r.id)).toEqual([3, 1, 2])
  })
})
