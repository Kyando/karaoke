import { beforeAll, describe, expect, it } from 'vitest'
import kuromoji from 'kuromoji'
import type { Tokenizer } from 'kuromoji/build/kuromoji.js'
import { groupTokens, kanaToRomaji, splitFurigana } from './japanese'
import { annotateJapanese, detectScript } from './transliterate'
import { parseLrc } from './parseLrc'
import type { RubySegment } from './types'

let tokenizer: Tokenizer

beforeAll(async () => {
  // no Node usamos o pacote normal, lendo o dicionário direto do node_modules
  tokenizer = await new Promise((resolve, reject) =>
    kuromoji
      .builder({ dicPath: 'node_modules/kuromoji/dict' })
      .build((err, t) => (err ? reject(err) : resolve(t))),
  )
}, 30_000)

const show = (ruby: RubySegment[]) => ruby.map((r) => (r.reading ? `${r.text}(${r.reading})` : r.text)).join('')
const units = (s: string) => groupTokens(tokenizer.tokenize(s))

describe('furigana', () => {
  it('põe a leitura só sobre os kanjis', () => {
    expect(splitFurigana('呼ん', 'よん')).toEqual([{ text: '呼', reading: 'よ' }, { text: 'ん' }])
    expect(splitFurigana('お茶', 'おちゃ')).toEqual([{ text: 'お' }, { text: '茶', reading: 'ちゃ' }])
    expect(splitFurigana('ねこ', 'ねこ')).toEqual([{ text: 'ねこ' }])
  })
  it('kana no meio da palavra fica com a leitura inteira', () => {
    expect(splitFurigana('取り扱', 'とりあつか')).toEqual([{ text: '取り扱', reading: 'とりあつか' }])
  })
})

describe('palavras japonesas', () => {
  it('gruda partículas e terminações na palavra anterior', () => {
    const u = units('君の名前を呼んだ')
    expect(u.map((x) => x.text)).toEqual(['君の', '名前を', '呼んだ'])
    expect(u.map((x) => show(x.ruby))).toEqual(['君(きみ)の', '名前(なまえ)を', '呼(よ)んだ'])
  })

  it('romaniza com as partículas pronunciadas (は = wa, を = o)', () => {
    expect(units('東京は夜の七時').map((x) => x.roman)).toEqual(['toukyou wa', 'yoru no', 'nanaji'])
    expect(units('君の名前を呼んだ').map((x) => x.roman)).toEqual(['kimi no', 'namae o', 'yonda'])
    expect(units('今日は雨が降っている').map((x) => x.roman)).toEqual(['kyou wa', 'ame ga', 'futteiru'])
  })

  it('corrige leituras de palavras comuns em letras que o dicionário erra', () => {
    const u = units('二人だけの空')
    expect(show(u[0].ruby)).toBe('二人(ふたり)だけの')
    expect(u[0].roman).toBe('futari dake no')
  })

  it('romaniza sons estrangeiros e vogais longas', () => {
    expect(['フェンス', 'ファン', 'パーティー', 'ウォー', 'ヴァイオリン', 'がっこう'].map(kanaToRomaji)).toEqual([
      'fensu', 'fan', 'paatii', 'woo', 'vaiorin', 'gakkou',
    ])
  })

  it('mantém inglês no meio da letra', () => {
    const u = groupTokens(tokenizer.tokenize('Life'))
    expect(u[0]).toMatchObject({ text: 'Life', roman: 'Life' })
  })
})

describe('letra japonesa', () => {
  const lrc = '[00:10.00]君の名前を呼んだ\n[00:14.00]Life will change\n[00:18.00]'

  it('detecta o idioma pela presença de kana', () => {
    expect(detectScript(parseLrc(lrc).lines)).toBe('ja')
    expect(detectScript(parseLrc('[00:01.00]어두워진 밤').lines)).toBe('ko')
    expect(detectScript(parseLrc('[00:01.00]hello').lines)).toBeNull()
  })

  it('divide a linha em palavras com tempo, leitura e romaji', () => {
    const [ja, en] = annotateJapanese(parseLrc(lrc).lines, tokenizer)
    expect(ja.lang).toBe('ja')
    expect(ja.words.map((w) => w.text)).toEqual(['君の', '名前を', '呼んだ'])
    expect(ja.words[0].start).toBe(10)
    expect(ja.words[2].end).toBeLessThanOrEqual(14)
    // palavras com mais moras ganham mais tempo
    expect(ja.words[1].end - ja.words[1].start).toBeGreaterThan(ja.words[0].end - ja.words[0].start)
    // linha só em inglês fica como estava
    expect(en.lang).toBeUndefined()
  })
})
