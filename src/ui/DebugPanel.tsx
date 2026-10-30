import { useEffect, useState } from 'react'
import type { MediaClock } from '../player/clock'
import type { PlayerAdapter } from '../player/PlayerAdapter'

interface Props {
  clock: MediaClock
  player: PlayerAdapter | null
  getLyricTime: () => number
}

/** Números para validar a F0: o relógio acompanha o player? quantos fps no aparelho? */
export function DebugPanel({ clock, player, getLyricTime }: Props) {
  const [, setTick] = useState(0)
  const [fps, setFps] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let frames = 0
    let since = performance.now()
    let raf = 0
    const loop = (now: number) => {
      frames++
      if (now - since >= 1000) {
        setFps(Math.round((frames * 1000) / (now - since)))
        frames = 0
        since = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const s = clock.stats
  const rows: [string, string][] = [
    ['Estado do player', player?.state() ?? '—'],
    ['Tempo do vídeo (player)', player ? player.currentTime().toFixed(3) + ' s' : '—'],
    ['Tempo interpolado', clock.now().toFixed(3) + ' s'],
    ['Tempo da letra', getLyricTime().toFixed(3) + ' s'],
    ['Erro médio do relógio', s.meanAbsErrorMs.toFixed(0) + ' ms'],
    ['Erro máximo do relógio', s.maxAbsErrorMs.toFixed(0) + ' ms'],
    ['Último erro', s.lastErrorMs.toFixed(0) + ' ms'],
    ['Leituras / reancoragens', `${s.samples} / ${s.hardResyncs}`],
    ['Quadros por segundo', String(fps)],
  ]

  return (
    <div className="debug">
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="btn ghost small" onClick={() => clock.resetStats()}>
        Zerar medições
      </button>
    </div>
  )
}
