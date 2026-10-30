import { useEffect, useRef } from 'react'
import type { Line } from '../lyrics/types'
import { findLineIndex, wordProgress } from '../lyrics/timeline'

interface Props {
  lines: Line[]
  /** Tempo atual na linha do tempo da letra (já com o atraso aplicado). */
  getLyricTime: () => number
  onLineClick?: (line: Line) => void
}

/** Altura (fração do painel) onde a linha atual fica, como no Spotify. */
const FOCUS_AT = 0.38

/**
 * Renderiza as linhas uma vez com React; a animação por quadro mexe direto no DOM
 * (classe da linha e variável --p de cada palavra), sem re-render.
 */
export function LyricsView({ lines, getLyricTime, onLineClick }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lineEls = useRef<(HTMLDivElement | null)[]>([])
  const wordEls = useRef<(HTMLSpanElement | null)[][]>([])
  const timeRef = useRef(getLyricTime)
  timeRef.current = getLyricTime

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

    const frame = () => {
      const t = timeRef.current()
      const idx = findLineIndex(lines, t)
      const height = viewportRef.current?.clientHeight ?? 0

      if (idx !== current) {
        lineEls.current.forEach((el, i) => {
          if (!el) return
          el.classList.toggle('is-current', i === idx)
          el.classList.toggle('is-past', i < idx)
          if (i !== idx) wordEls.current[i]?.forEach((w) => w?.style.removeProperty('--p'))
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
        for (let i = 0; i < words.length; i++) {
          els?.[i]?.style.setProperty('--p', `${(wordProgress(words[i], t) * 100).toFixed(1)}%`)
        }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [lines])

  return (
    <div className="lyrics" ref={viewportRef}>
      <div className="lyrics-track" ref={trackRef}>
        {lines.map((line, i) => (
          <div
            key={i}
            className={line.words.length ? 'lyric-line' : 'lyric-line is-gap'}
            ref={(el) => {
              lineEls.current[i] = el
            }}
            onClick={() => onLineClick?.(line)}
          >
            {line.words.length === 0 ? (
              <span className="gap-note" aria-label="trecho instrumental">♪</span>
            ) : (
              line.words.map((w, j) => (
                <span
                  key={j}
                  className="word"
                  ref={(el) => {
                    ;(wordEls.current[i] ??= [])[j] = el
                  }}
                >
                  {w.text}
                </span>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
