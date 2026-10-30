import { isKana, toHiragana, toRomaji } from 'wanakana'
import type { KuromojiToken } from 'kuromoji/build/kuromoji.js'
import type { RubySegment } from './types'

export const KANJI = /[㐀-䶿一-鿿々〆ヶ]/

/** Uma "palavra" para exibição: núcleo + partículas/terminações grudadas nele. */
export interface JaUnit {
  text: string
  ruby: RubySegment[]
  roman: string
  /** Número de kana da leitura: aproxima as sílabas cantadas (moras). */
  morae: number
}

// Partículas que se escrevem com um kana e se pronunciam com outro.
const PARTICLE_ROMAJI: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' }

/** Tokens que não começam palavra nova: partículas, auxiliares, sufixos, pontuação. */
function attachesToPrevious(t: KuromojiToken): boolean {
  return (
    t.pos === '助詞' ||
    t.pos === '助動詞' ||
    t.pos === '記号' ||
    t.pos_detail_1 === '接尾' ||
    t.pos_detail_1 === '非自立'
  )
}

function readingOf(t: KuromojiToken): string | null {
  return t.reading && t.reading !== '*' ? toHiragana(t.reading) : null
}

/**
 * Combinações com kana pequeno de palavras estrangeiras. O wanakana as trata como
 * sílabas separadas (フェンス → "fyensu", ファン → "fuan"), então convertemos antes.
 */
const FOREIGN_COMBOS: Record<string, string> = {
  ふぁ: 'fa', ふぃ: 'fi', ふぇ: 'fe', ふぉ: 'fo', ふゅ: 'fyu',
  てぃ: 'ti', でぃ: 'di', とぅ: 'tu', どぅ: 'du', てゅ: 'tyu', でゅ: 'dyu',
  うぃ: 'wi', うぇ: 'we', うぉ: 'wo',
  ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', ゔ: 'vu',
  しぇ: 'she', じぇ: 'je', ちぇ: 'che', つぁ: 'tsa', いぇ: 'ye',
}
const FOREIGN_RE = new RegExp(
  Object.keys(FOREIGN_COMBOS)
    .sort((a, b) => b.length - a.length)
    .join('|'),
  'g',
)

/** Kana → romaji (Hepburn), corrigindo as combinações estrangeiras e o ー (vogal longa). */
export function kanaToRomaji(kana: string): string {
  // mantém o ー: convertido cedo demais, ele vira "u" mesmo depois de "wo" (ウォー → "wou")
  const hira = toHiragana(kana, { convertLongVowelMark: false })
  let out = ''
  let last = 0
  for (const m of hira.matchAll(FOREIGN_RE)) {
    out += toRomaji(hira.slice(last, m.index)) + FOREIGN_COMBOS[m[0]]
    last = m.index + m[0].length
  }
  out += toRomaji(hira.slice(last))
  // o wanakana devolve o ー como "-": repete a vogal anterior (パーティー → "paatii")
  return out.replace(/([aeiou])(-+)/g, (_, v: string, dashes: string) => v + v.repeat(dashes.length))
}

/** Partículas que se escrevem separadas no romaji ("namae o"); as outras (て, ば…) grudam. */
const SPACED_PARTICLES = new Set(['格助詞', '係助詞', '副助詞', '連体化', '終助詞', '並立助詞'])

/**
 * Romaji de uma palavra. Os kana vizinhos são convertidos juntos para o っ dobrar a
 * consoante seguinte (降っ+て → "futte"); partículas de função ganham espaço antes.
 */
function romanizeUnit(tokens: KuromojiToken[]): string {
  const parts: string[] = []
  let kana = ''
  const flush = () => {
    if (kana) parts.push(kanaToRomaji(kana))
    kana = ''
  }
  tokens.forEach((t, k) => {
    if (t.pos === '記号') return
    const spaced = k > 0 && t.pos === '助詞' && SPACED_PARTICLES.has(t.pos_detail_1)
    if (spaced) {
      flush()
      parts.push(' ' + (PARTICLE_ROMAJI[t.surface_form] ?? kanaToRomaji(readingOf(t) ?? t.surface_form)))
      return
    }
    const reading = readingOf(t) ?? (isKana(t.surface_form) ? toHiragana(t.surface_form) : null)
    if (reading) {
      kana += reading
    } else {
      // sem leitura (inglês, números): fica como está
      flush()
      parts.push(t.surface_form)
    }
  })
  flush()
  return parts.join('').trim()
}

/**
 * Separa o furigana só sobre os kanjis: 呼ん + よん → 呼(よ) + ん.
 * Remove o kana igual no começo e no fim; o miolo fica com a leitura inteira.
 */
export function splitFurigana(surface: string, reading: string | null): RubySegment[] {
  if (!reading || !KANJI.test(surface)) return [{ text: surface }]
  let s = surface
  let r = reading
  let prefix = ''
  let suffix = ''
  while (s.length > 1 && r.length > 1 && !KANJI.test(s[0]) && toHiragana(s[0]) === r[0]) {
    prefix += s[0]
    s = s.slice(1)
    r = r.slice(1)
  }
  while (s.length > 1 && r.length > 1 && !KANJI.test(s.at(-1)!) && toHiragana(s.at(-1)!) === r.at(-1)) {
    suffix = s.at(-1)! + suffix
    s = s.slice(0, -1)
    r = r.slice(0, -1)
  }
  const out: RubySegment[] = []
  if (prefix) out.push({ text: prefix })
  out.push({ text: s, reading: r })
  if (suffix) out.push({ text: suffix })
  return out
}

/**
 * Palavras que o dicionário quebra em pedaços e lê errado (二人 → "ni nin"), comuns em
 * letras de música. A leitura é a usual em canções.
 */
const COMPOUND_READINGS: Record<string, string> = {
  二人: 'フタリ',
  一人: 'ヒトリ',
  独り: 'ヒトリ',
  一つ: 'ヒトツ',
  二つ: 'フタツ',
}

/** Junta tokens vizinhos que formam uma palavra da tabela acima. */
function mergeCompounds(tokens: KuromojiToken[]): KuromojiToken[] {
  const out: KuromojiToken[] = []
  for (let i = 0; i < tokens.length; i++) {
    const pair = tokens[i + 1] ? tokens[i].surface_form + tokens[i + 1].surface_form : ''
    if (COMPOUND_READINGS[pair]) {
      out.push({ ...tokens[i], surface_form: pair, pos: '名詞', pos_detail_1: '一般', reading: COMPOUND_READINGS[pair] })
      i++
    } else {
      out.push(tokens[i])
    }
  }
  return out
}

/** Agrupa os tokens de um trecho sem espaços em palavras de exibição. */
export function groupTokens(rawTokens: KuromojiToken[]): JaUnit[] {
  const tokens = mergeCompounds(rawTokens)
  const units: { tokens: KuromojiToken[] }[] = []
  for (const t of tokens) {
    if (!t.surface_form.trim()) continue
    const last = units.at(-1)
    if (last && attachesToPrevious(t)) last.tokens.push(t)
    else units.push({ tokens: [t] })
  }
  return units.map(({ tokens: ts }) => {
    const ruby = ts.flatMap((t) => splitFurigana(t.surface_form, readingOf(t)))
    // junta trechos vizinhos sem leitura, para o HTML ficar enxuto
    const merged: RubySegment[] = []
    for (const seg of ruby) {
      const prev = merged.at(-1)
      if (prev && !prev.reading && !seg.reading) prev.text += seg.text
      else merged.push({ ...seg })
    }
    const roman = romanizeUnit(ts)
    const morae = ts.reduce((n, t) => n + (readingOf(t) ?? t.surface_form).replace(/[ゃゅょぁぃぅぇぉ]/g, '').length, 0)
    return { text: ts.map((t) => t.surface_form).join(''), ruby: merged, roman, morae: Math.max(1, morae) }
  })
}
