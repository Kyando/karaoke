import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MediaClock } from '../player/clock'
import type { PlayerAdapter, PlayerState } from '../player/PlayerAdapter'
import { createYouTubePlayer, parseVideoId } from '../player/YouTubePlayer'
import { rankByDuration, searchLyrics, type LrclibRecord } from '../lyrics/lrclib'
import { parseLrc } from '../lyrics/parseLrc'
import { firstSungLine, median, tapDeviation } from '../lyrics/calibration'
import type { Line } from '../lyrics/types'
import { LyricsView } from './LyricsView'
import { DebugPanel } from './DebugPanel'
import { TEST_SONGS } from '../catalog/testSongs'

const POLL_MS = 250
/** Meta da F0: erro de sincronia abaixo disso. */
const TARGET_MS = 150

const DEFAULT_SONG = TEST_SONGS.find((s) => s.title === 'Golden') ?? TEST_SONGS[0]
const DEFAULT = {
  video: `https://www.youtube.com/watch?v=${DEFAULT_SONG.videoId}`,
  artist: DEFAULT_SONG.artist,
  track: DEFAULT_SONG.title,
}

function initialForm() {
  const q = new URLSearchParams(window.location.search)
  return {
    video: q.get('v') ?? DEFAULT.video,
    artist: q.get('artist') ?? DEFAULT.artist,
    track: q.get('track') ?? DEFAULT.track,
    lrclib: q.get('lrclib'),
  }
}

const offsetKey = (videoId: string, lrclibId: number) => `karaoke:offset:${videoId}:${lrclibId}`

function loadOffset(videoId: string, lrclibId: number): number {
  try {
    return Number(localStorage.getItem(offsetKey(videoId, lrclibId))) || 0
  } catch {
    return 0
  }
}

function saveOffset(videoId: string, lrclibId: number, ms: number) {
  try {
    localStorage.setItem(offsetKey(videoId, lrclibId), String(Math.round(ms)))
  } catch {
    /* modo privado: segue sem salvar */
  }
}

function fmtDuration(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
}

type CalibMode = 'idle' | 'first' | 'lines'

export function App() {
  const init = useMemo(initialForm, [])
  const [form, setForm] = useState({ video: init.video, artist: init.artist, track: init.track })
  const [formOpen, setFormOpen] = useState(true)
  const [videoId, setVideoId] = useState<string | null>(null)
  const [playerState, setPlayerState] = useState<PlayerState>('loading')
  const [duration, setDuration] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [autoplayBlocked, setAutoplayBlocked] = useState(false)
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<LrclibRecord[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(init.lrclib ? Number(init.lrclib) : null)
  const [manualPick, setManualPick] = useState(!!init.lrclib)
  const [offsetMs, setOffsetMs] = useState(0)
  const [calib, setCalib] = useState<CalibMode>('idle')
  const [deviations, setDeviations] = useState<number[]>([])
  const [toolsOpen, setToolsOpen] = useState(false)

  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<PlayerAdapter | null>(null)
  const [player, setPlayer] = useState<PlayerAdapter | null>(null)
  const clock = useMemo(() => new MediaClock(), [])

  const ranked = useMemo(() => rankByDuration(candidates, duration), [candidates, duration])
  const selected = ranked.find((r) => r.id === selectedId) ?? null
  const lyrics = useMemo(() => (selected?.syncedLyrics ? parseLrc(selected.syncedLyrics) : null), [selected])
  const lines = lyrics?.lines ?? []

  // Deslocamento total: lyricTime = videoTime − shift
  const shiftRef = useRef(0)
  shiftRef.current = offsetMs / 1000 + (lyrics?.fileOffset ?? 0)
  const getLyricTime = useCallback(() => clock.now() - shiftRef.current, [clock])

  // ---- carregar música ----
  const load = useCallback(
    async (f: typeof form) => {
      const id = parseVideoId(f.video)
      if (!id) {
        setError('Não reconheci esse link do YouTube. Cole o endereço do vídeo ou só o ID de 11 caracteres.')
        return
      }
      setError(null)
      setVideoId(id)
      setFormOpen(false)
      setSearching(true)
      setCandidates([])
      try {
        const results = await searchLyrics(f.track, f.artist)
        setCandidates(results)
        if (!results.some((r) => r.syncedLyrics)) {
          setError('Não achei letra sincronizada para essa busca no LRCLIB. Confira o nome da música e do artista.')
        }
      } catch (e) {
        setError(`Falha ao buscar a letra: ${(e as Error).message}`)
      } finally {
        setSearching(false)
      }
      const url = new URL(window.location.href)
      url.search = new URLSearchParams({ v: id, artist: f.artist, track: f.track }).toString()
      window.history.replaceState(null, '', url)
    },
    [],
  )

  useEffect(() => {
    void load(form)
    // carrega a música inicial (padrão ou vinda do link) uma vez
  }, [])

  // Escolhe a melhor letra sozinho, e refaz a escolha quando a duração do vídeo chega
  // (ela vem do player, normalmente depois dos resultados do LRCLIB). Para de mexer quando
  // a pessoa escolhe uma letra na lista ou abre um link com ?lrclib=.
  useEffect(() => {
    if (!ranked.length) return
    const keep = manualPick && ranked.some((r) => r.id === selectedId && r.syncedLyrics)
    if (!keep && ranked[0].id !== selectedId) setSelectedId(ranked[0].id)
  }, [ranked, selectedId, manualPick])

  // atraso salvo para este par vídeo + letra
  useEffect(() => {
    if (videoId && selected) setOffsetMs(loadOffset(videoId, selected.id))
  }, [videoId, selected])

  // mantém o link compartilhável com a letra escolhida
  useEffect(() => {
    if (!selected) return
    const url = new URL(window.location.href)
    url.searchParams.set('lrclib', String(selected.id))
    window.history.replaceState(null, '', url)
  }, [selected])

  const changeOffset = (ms: number) => {
    setOffsetMs(ms)
    if (videoId && selected) saveOffset(videoId, selected.id, ms)
  }

  // ---- player ----
  useEffect(() => {
    if (!videoId || !hostRef.current) return
    let cancelled = false
    let created: PlayerAdapter | null = null
    setPlayerState('loading')
    setDuration(null)
    setAutoplayBlocked(false)
    clock.sample(0, false)
    clock.resetStats()

    createYouTubePlayer(hostRef.current, videoId, {
      onState: (s) => {
        setPlayerState(s)
        if (s === 'playing') setAutoplayBlocked(false)
        const p = playerRef.current
        if (p) clock.sample(p.currentTime(), s === 'playing', p.playbackRate())
        if (p && s !== 'loading') setDuration(p.duration())
      },
      onError: (msg) => setError(msg),
      onAutoplayBlocked: () => setAutoplayBlocked(true),
    })
      .then((p) => {
        if (cancelled) return p.destroy()
        created = p
        playerRef.current = p
        setPlayer(p)
        setDuration(p.duration())
      })
      .catch((e: Error) => setError(e.message))

    return () => {
      cancelled = true
      created?.destroy()
      playerRef.current = null
      setPlayer(null)
    }
  }, [videoId, clock])

  // lê o tempo do player periodicamente; o relógio interpola entre as leituras
  useEffect(() => {
    if (!player) return
    const id = setInterval(() => {
      clock.sample(player.currentTime(), player.state() === 'playing', player.playbackRate())
    }, POLL_MS)
    return () => clearInterval(id)
  }, [player, clock])

  // tela sempre acesa enquanto toca
  useEffect(() => {
    if (playerState !== 'playing' || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock.request('screen').then((l) => (lock = l)).catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [playerState])

  const togglePlay = useCallback(() => {
    const p = playerRef.current
    if (!p) return
    if (p.state() === 'playing') p.pause()
    else p.play()
  }, [])

  const seekToLine = useCallback((line: Line) => {
    playerRef.current?.seek(line.start + shiftRef.current)
  }, [])

  // ---- calibração ----
  const first = firstSungLine(lines)

  const tap = useCallback(() => {
    if (calib === 'first' && first) {
      // a primeira linha começa agora: lyricTime(agora) = first.start
      const videoTime = clock.now()
      changeOffset((videoTime - first.start - (lyrics?.fileOffset ?? 0)) * 1000)
      setCalib('lines')
      setDeviations([])
    } else if (calib === 'lines') {
      const d = tapDeviation(lines, getLyricTime())
      if (d !== null) setDeviations((prev) => [...prev, d].slice(-12))
    }
  }, [calib, first, lines, lyrics, clock, getLyricTime])

  const medianMs = median(deviations) * 1000
  const applyCorrection = () => {
    changeOffset(offsetMs + medianMs)
    setDeviations([])
  }

  // teclado: espaço = tocar/pausar, T = marcar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select')) return
      if (e.code === 'Space') {
        e.preventDefault()
        togglePlay()
      } else if (e.key.toLowerCase() === 't' && calib !== 'idle') {
        tap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [togglePlay, tap, calib])

  const playing = playerState === 'playing'

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          <span>Karaokê</span>
          <span className="tag">F0 · prova de conceito</span>
        </div>
        <button type="button" className="btn ghost small" onClick={() => setFormOpen((o) => !o)}>
          {formOpen ? 'Fechar' : 'Músicas'}
        </button>
      </header>

      {formOpen && (
        <form
          className="loader"
          onSubmit={(e) => {
            e.preventDefault()
            setSelectedId(null)
            setManualPick(false)
            void load(form)
          }}
        >
          <label className="pick">
            <span>Músicas de teste</span>
            <select
              id="test-song"
              value=""
              onChange={(e) => {
                const song = TEST_SONGS[Number(e.target.value)]
                if (!song) return
                const next = { video: `https://www.youtube.com/watch?v=${song.videoId}`, artist: song.artist, track: song.title }
                setForm(next)
                setSelectedId(null)
                setManualPick(false)
                void load(next)
              }}
            >
              <option value="">Escolha uma música…</option>
              {[...new Set(TEST_SONGS.map((s) => s.group))].map((group) => (
                <optgroup key={group} label={group}>
                  {TEST_SONGS.map((s, i) =>
                    s.group === group ? (
                      <option key={s.videoId} value={i}>
                        {s.title}
                        {s.note ? ` (${s.note})` : ''}
                      </option>
                    ) : null,
                  )}
                </optgroup>
              ))}
            </select>
          </label>
          <span className="or">ou qualquer outra:</span>
          <label>
            <span>Link do vídeo no YouTube</span>
            <input
              id="video"
              value={form.video}
              onChange={(e) => setForm({ ...form, video: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              inputMode="url"
            />
          </label>
          <label>
            <span>Artista</span>
            <input id="artist" value={form.artist} onChange={(e) => setForm({ ...form, artist: e.target.value })} />
          </label>
          <label>
            <span>Música</span>
            <input id="track" value={form.track} onChange={(e) => setForm({ ...form, track: e.target.value })} required />
          </label>
          <button type="submit" className="btn">
            Carregar
          </button>
        </form>
      )}

      <main className={`stage ${toolsOpen ? 'tools-open' : ''}`}>
        <div className="video">
          <div className="video-host" ref={hostRef} />
        </div>

        <section className="lyrics-pane" aria-label="Letra">
          {lines.length > 0 ? (
            <LyricsView lines={lines} getLyricTime={getLyricTime} onLineClick={seekToLine} />
          ) : (
            <p className="empty">{searching ? 'Buscando a letra…' : error ?? 'Carregue uma música para começar.'}</p>
          )}
        </section>

        <section className="tools" aria-label="Controles">
          {error && lines.length > 0 && <p className="alert">{error}</p>}
          {autoplayBlocked && <p className="alert">O navegador bloqueou o play automático. Toque em Tocar.</p>}

          <div className="toolbar">
            <button type="button" className="btn play" onClick={togglePlay} disabled={!player}>
              {playing ? 'Pausar' : 'Tocar'}
            </button>
            <div className="offset" role="group" aria-label="Atraso da letra">
              <button type="button" className="btn ghost small coarse" onClick={() => changeOffset(offsetMs - 250)} aria-label="Letra 250 ms antes">
                «
              </button>
              <button type="button" className="btn ghost small" onClick={() => changeOffset(offsetMs - 50)} aria-label="Letra 50 ms antes">
                ‹
              </button>
              <button type="button" className="offset-value" onClick={() => changeOffset(0)} title="Zerar atraso">
                {offsetMs >= 0 ? '+' : ''}
                {(offsetMs / 1000).toFixed(2)} s
              </button>
              <button type="button" className="btn ghost small" onClick={() => changeOffset(offsetMs + 50)} aria-label="Letra 50 ms depois">
                ›
              </button>
              <button type="button" className="btn ghost small coarse" onClick={() => changeOffset(offsetMs + 250)} aria-label="Letra 250 ms depois">
                »
              </button>
            </div>
            <button type="button" className="btn ghost small tools-toggle" onClick={() => setToolsOpen((o) => !o)} aria-expanded={toolsOpen}>
              Ajustes
            </button>
          </div>

          <div className="panels">
            {ranked.length > 0 && (
              <div className="panel">
                <h2>Letra (LRCLIB)</h2>
                <select id="lyrics-choice" value={selectedId ?? ''} onChange={(e) => {
                    setManualPick(true)
                    setSelectedId(Number(e.target.value))
                  }}>
                  {ranked.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.syncedLyrics}>
                      {r.artistName} · {r.albumName || 'sem álbum'} · {fmtDuration(r.duration)}
                      {r.syncedLyrics ? '' : ' · sem sincronia'}
                    </option>
                  ))}
                </select>
                <p className="hint">
                  Vídeo: {duration ? fmtDuration(duration) : '—'} · Letra: {selected ? fmtDuration(selected.duration) : '—'}
                </p>
              </div>
            )}

            <div className="panel">
              <h2>Calibrar</h2>
              {calib === 'idle' && (
                <>
                  <p className="hint">Ajuste o atraso entre o vídeo e a letra marcando no ritmo da música.</p>
                  <div className="row">
                    <button type="button" className="btn small" onClick={() => setCalib('first')} disabled={!first}>
                      Marcar 1ª linha
                    </button>
                    <button
                      type="button"
                      className="btn ghost small"
                      onClick={() => {
                        setDeviations([])
                        setCalib('lines')
                      }}
                      disabled={!first}
                    >
                      Medir sincronia
                    </button>
                  </div>
                </>
              )}
              {calib === 'first' && first && (
                <p className="hint">
                  Toque play e aperte <b>Marcar</b> (ou T) no instante em que ouvir: <q>{first.text}</q>
                </p>
              )}
              {calib === 'lines' && (
                <>
                  <p className="hint">Aperte <b>Marcar</b> (ou T) no começo de cada linha cantada, no ritmo.</p>
                  <p className="measure">
                    {deviations.length === 0 ? (
                      'Nenhuma marcação ainda.'
                    ) : (
                      <>
                        {deviations.length} marcações · desvio mediano{' '}
                        <b className={Math.abs(medianMs) <= TARGET_MS ? 'good' : 'bad'}>
                          {medianMs >= 0 ? '+' : ''}
                          {medianMs.toFixed(0)} ms
                        </b>
                        {Math.abs(medianMs) <= TARGET_MS ? ' · dentro da meta' : ' · fora da meta'}
                      </>
                    )}
                  </p>
                </>
              )}
              {calib !== 'idle' && (
                <div className="row">
                  <button type="button" className="btn tap" onClick={tap}>
                    Marcar
                  </button>
                  {calib === 'lines' && deviations.length >= 3 && (
                    <button type="button" className="btn ghost small" onClick={applyCorrection}>
                      Aplicar correção
                    </button>
                  )}
                  <button type="button" className="btn ghost small" onClick={() => setCalib('idle')}>
                    Concluir
                  </button>
                </div>
              )}
            </div>

            <details className="panel">
              <summary>Medições técnicas</summary>
              <DebugPanel clock={clock} player={player} getLyricTime={getLyricTime} />
            </details>
          </div>
        </section>
      </main>
    </div>
  )
}
