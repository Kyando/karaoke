import type { Tokenizer } from 'kuromoji/build/kuromoji.js'
import type { Line, Lyrics, Word } from './types'
import { estimateWeighted } from './estimateWords'
import { groupTokens, KANJI } from './japanese'

const HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/
const KANA = /[぀-ゟ゠-ヿ]/

/** Tempo cantado por mora (sílaba japonesa), para estimar palavras em japonês. */
const SECONDS_PER_MORA = 0.28

export type Script = 'ko' | 'ja'

/**
 * Idioma da música. Kana em qualquer linha → japonês (kanji sozinho poderia ser chinês).
 * Hangul → coreano.
 */
export function detectScript(lines: readonly Line[]): Script | null {
  const text = lines.map((l) => l.text).join('\n')
  if (KANA.test(text)) return 'ja'
  if (HANGUL.test(text)) return 'ko'
  return null
}

/** Acrescenta romanização (e furigana, no japonês) à letra. Devolve a mesma letra se não precisar. */
export async function transliterate(lyrics: Lyrics): Promise<Lyrics> {
  const script = detectScript(lyrics.lines)
  if (script === 'ko') return { ...lyrics, lines: await romanizeKorean(lyrics.lines) }
  if (script === 'ja') return { ...lyrics, lines: annotateJapanese(lyrics.lines, await loadTokenizer()) }
  return lyrics
}

// ---------- coreano ----------

async function romanizeKorean(lines: Line[]): Promise<Line[]> {
  const { romanize } = await import('es-hangul')
  return lines.map((line) => {
    if (!HANGUL.test(line.text)) return line
    const words = line.words.map((w) => (HANGUL.test(w.text) ? { ...w, roman: romanize(w.text) } : w))
    return { ...line, words, lang: 'ko' as const }
  })
}

// ---------- japonês ----------

let tokenizerPromise: Promise<Tokenizer> | null = null

/**
 * O kuromoji não repassa alguns erros de download (lança dentro do XHR), então sem prazo
 * a promessa ficaria pendente para sempre. 17 MB em 3G lento cabem com folga em 2 min.
 */
const DICTIONARY_TIMEOUT_MS = 120_000

/** Carrega o analisador e o dicionário (~17 MB) só na primeira música em japonês. */
export function loadTokenizer(): Promise<Tokenizer> {
  tokenizerPromise ??= import('kuromoji/build/kuromoji.js')
    .then(
      (mod) =>
        new Promise<Tokenizer>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Tempo esgotado ao baixar o dicionário japonês.')), DICTIONARY_TIMEOUT_MS)
          const kuromoji = mod.default
          kuromoji.builder({ dicPath: `${import.meta.env.BASE_URL}dict/` }).build((err, tokenizer) => {
            clearTimeout(timer)
            if (err) reject(err)
            else resolve(tokenizer)
          })
        }),
    )
    .catch((e) => {
      tokenizerPromise = null // permite tentar de novo
      throw e
    })
  return tokenizerPromise
}

export function annotateJapanese(lines: Line[], tokenizer: Tokenizer): Line[] {
  return lines.map((line) => {
    if (!KANA.test(line.text) && !KANJI.test(line.text)) return line

    if (line.sync === 'word') {
      // tempos por palavra vieram da fonte: só anota cada palavra, sem mudar a divisão
      const words: Word[] = line.words.map((w) => {
        const units = groupTokens(tokenizer.tokenize(w.text))
        return { ...w, ruby: units.flatMap((u) => u.ruby), roman: units.map((u) => u.roman).join(' ') }
      })
      return { ...line, words, lang: 'ja' as const }
    }

    // sem tempos por palavra: divide a linha em palavras japonesas e estima pelas moras
    const units = line.text
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((chunk) => groupTokens(tokenizer.tokenize(chunk)))
    const timed = estimateWeighted(
      units.map((u) => u.text),
      units.map((u) => u.morae + 0.5),
      line.start,
      line.end,
      SECONDS_PER_MORA,
    )
    const words = timed.map((w, i) => ({ ...w, ruby: units[i].ruby, roman: units[i].roman }))
    return { ...line, words, lang: 'ja' as const }
  })
}
