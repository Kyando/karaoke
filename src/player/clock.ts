/**
 * Relógio interpolado. O player só informa o tempo de tempos em tempos (e com jitter);
 * entre leituras, extrapolamos com o relógio do navegador para animar a 60 fps.
 */

/** Acima disso a leitura é tratada como seek/travamento: reancora na hora. */
const HARD_RESYNC_SECONDS = 0.35
/** Fração do erro corrigida por leitura. Suaviza o jitter sem deixar o relógio derivar. */
const SOFT_CORRECTION = 0.3

export interface ClockStats {
  samples: number
  /** Erro da última leitura (leitura − previsão), em ms. */
  lastErrorMs: number
  /** Média do erro absoluto, em ms, ignorando reancoragens. */
  meanAbsErrorMs: number
  maxAbsErrorMs: number
  hardResyncs: number
}

export class MediaClock {
  private anchorMedia = 0
  private anchorWall = 0
  private playing = false
  private rate = 1
  private absErrorSum = 0
  private softSamples = 0
  readonly stats: ClockStats = { samples: 0, lastErrorMs: 0, meanAbsErrorMs: 0, maxAbsErrorMs: 0, hardResyncs: 0 }

  constructor(private readonly wallNow: () => number = () => performance.now()) {}

  /** Tempo atual da mídia, em segundos. */
  now(): number {
    if (!this.playing) return this.anchorMedia
    return this.anchorMedia + ((this.wallNow() - this.anchorWall) / 1000) * this.rate
  }

  isPlaying(): boolean {
    return this.playing
  }

  /** Recebe uma leitura do player. */
  sample(mediaTime: number, playing: boolean, rate = 1): void {
    const wall = this.wallNow()
    const predicted = this.now()
    const error = mediaTime - predicted
    const stateChanged = playing !== this.playing || rate !== this.rate
    this.stats.samples++
    this.stats.lastErrorMs = error * 1000

    if (stateChanged || !playing || Math.abs(error) > HARD_RESYNC_SECONDS) {
      if (playing && !stateChanged) this.stats.hardResyncs++
      this.anchorMedia = mediaTime
    } else {
      this.absErrorSum += Math.abs(error)
      this.softSamples++
      this.stats.meanAbsErrorMs = (this.absErrorSum / this.softSamples) * 1000
      this.stats.maxAbsErrorMs = Math.max(this.stats.maxAbsErrorMs, Math.abs(error) * 1000)
      this.anchorMedia = predicted + error * SOFT_CORRECTION
    }
    this.anchorWall = wall
    this.playing = playing
    this.rate = rate
  }

  resetStats(): void {
    this.absErrorSum = 0
    this.softSamples = 0
    Object.assign(this.stats, { samples: 0, lastErrorMs: 0, meanAbsErrorMs: 0, maxAbsErrorMs: 0, hardResyncs: 0 })
  }
}
