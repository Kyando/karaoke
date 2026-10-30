export type PlayerState = 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'

export interface PlayerEvents {
  onState?: (state: PlayerState) => void
  onError?: (message: string) => void
  /** O navegador bloqueou o play automático; é preciso um toque do usuário. */
  onAutoplayBlocked?: () => void
}

/**
 * Interface comum de player. O resto do app só conversa com isto, então a v2 pode
 * trocar o YouTube por um arquivo de áudio local sem mexer no palco.
 */
export interface PlayerAdapter {
  play(): void
  pause(): void
  seek(seconds: number): void
  currentTime(): number
  duration(): number | null
  playbackRate(): number
  state(): PlayerState
  destroy(): void
}
