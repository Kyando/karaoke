import { useEffect, useRef, type ReactNode } from 'react'
import type { Line, Word } from '../lyrics/types'
import { findLineIndex, wordProgress } from '../lyrics/timeline'

/** Como mostrar a pronúncia de letras em coreano/japonês. */
export type Pronunciation = 'below' | 'only' | 'off'

export interface DisplayOptions {
  pronunciation: Pronunciation
  /** Leitura em kana sobre os kanjis (só japonês). */
  furigana: boolean
}

interface Props {
  lines: Line[]
  /** Tempo atual na linha do tempo da letra (já com o atraso aplicado). */
  getLyricTime: () => number
  display: DisplayOptions
  onLineClick?: (line: Line) => void
}

/** Altura (fração do painel) onde a linha atual fica, como no Spotify. */
const FOCUS_AT = 0.38

function renderOriginal(w: Word, furigana: boolean): ReactNode {
  if (!furigana || !w.ruby) return w.text
  return w.ruby.map((seg, i) =>
    seg.reading ? (
      <ruby key={i}>
        {seg.text}
        <rt>{seg.reading}</rt>
      </ruby>
    ) : (
      seg.text
    ),
  )
}

/**
 * Renderiza as linhas com React; a animação por quadro mexe direto no DOM
 * (classe da linha e variável --p de cada palavra), sem re-render.
 */
export function LyricsView({ lines, getLyricTime, display, onLineClick }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLDivElement | null)[]>([])
  // por linha, por palavra: todos os elementos que acompanham o progresso da palavra
  const wordEls = useRef<HTMLSpanElement[][][]>([])
  const timeRef = useRef(getLyricTime)
  timeRef.current = getLyricTime

  const register = (i: number, j: number) => (el: HTMLSpanElement | null) => {
    if (!el) return
    const perWord = ((wordEls.current[i] ??= [])[j] ??= [])
    if (!perWord.includes(el)) perWord.push(el)
  }

  // a cada mudança de letra ou de exibição os elementos são recriados
  wordEls.current = []

  useEffect(() => {
    let raf = 0
    let current = -2
    let lastHeight = 0

    const scrollTo = (idx: number) => {
      const viewport = viewportRef.current
      const track = trackRef.current
      const el = lineEls.current[Math.max(idx, 0)]
      if (!viewport || !track || !el) return
      const y = viewport.clientHeight * FOCUS_AT - (el.offsetTop + el.offsetHeight / 2)
      track.style.transform = `translate3d(0, ${y}px, 0)`
    }

    const setProgress = (i: number, p: string | null) =>
      wordEls.current[i]?.forEach((els) =>
        els.forEach((el) => (p === null ? el.style.removeProperty('--p') : el.style.setProperty('--p', p))),
      )

    const frame = () => {
      const t = timeRef.current()
      const idx = findLineIndex(lines, t)
      const height = viewportRef.current?.clientHeight ?? 0

      if (idx !== current) {
        lineEls.current.forEach((el, i) => {
          if (!el) return
          el.classList.toggle('is-current', i === idx)
          el.classList.toggle('is-past', i < idx)
          if (i !== idx) setProgress(i, null)
        })
        scrollTo(idx)
        current = idx
      } else if (height !== lastHeight) {
        scrollTo(idx) // rotação da tela ou redimensionamento
      }
      lastHeight = height

      if (idx >= 0) {
        const words = lines[idx].words
        const els = wordEls.current[idx]
        for (let j = 0; j < words.length; j++) {
          const p = `${(wordProgress(words[j], t) * 100).toFixed(1)}%`
          els?.[j]?.forEach((el) => el.style.setProperty('--p', p))
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [lines, display])

  return (
    <div className="lyrics" ref={viewportRef}>
      <div className="lyrics-track" ref={trackRef}>
        {lines.map((line, i) => {
          const hasRoman = !!line.lang && display.pronunciation !== 'off'
          const romanOnly = hasRoman && display.pronunciation === 'only'
          return (
            <div
              key={i}
              className={line.words.length ? 'lyric-line' : 'lyric-line is-gap'}
              ref={(el) => {
                lineEls.current[i] = el
              }}
              onClick={() => onLineClick?.(line)}
            >
              {line.words.length === 0 ? (
                <span className="gap-note" aria-label="trecho instrumental">
                  ♪
                </span>
              ) : (
                <>
                  <div
                    className={[
                      'lyric-row',
                      line.lang && !romanOnly ? `lang-${line.lang}` : '',
                      display.furigana && line.lang === 'ja' && !romanOnly ? 'has-ruby' : '',
                    ].join(' ')}
                  >
                    {line.words.map((w, j) => (
                      <span key={j} className="word" ref={register(i, j)}>
                        {romanOnly ? (w.roman ?? w.text) : renderOriginal(w, display.furigana)}
                      </span>
                    ))}
                  </div>
                  {hasRoman && !romanOnly && (
                    <div className="roman-row" lang="en">
                      {line.words.map((w, j) => (
                        <span key={j} className="word" ref={register(i, j)}>
                          {w.roman ?? w.text}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
