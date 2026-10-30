// Tipos mínimos da YouTube IFrame Player API que usamos.
// Referência: https://developers.google.com/youtube/iframe_api_reference
declare namespace YT {
  const PlayerState: {
    UNSTARTED: -1
    ENDED: 0
    PLAYING: 1
    PAUSED: 2
    BUFFERING: 3
    CUED: 5
  }

  interface PlayerOptions {
    videoId?: string
    width?: string | number
    height?: string | number
    playerVars?: Record<string, string | number>
    events?: {
      onReady?: (e: { target: Player }) => void
      onStateChange?: (e: { target: Player; data: number }) => void
      onError?: (e: { target: Player; data: number }) => void
      onAutoplayBlocked?: (e: { target: Player }) => void
    }
  }

  class Player {
    constructor(element: HTMLElement | string, options: PlayerOptions)
    playVideo(): void
    pauseVideo(): void
    seekTo(seconds: number, allowSeekAhead: boolean): void
    getCurrentTime(): number
    getDuration(): number
    getPlaybackRate(): number
    getPlayerState(): number
    destroy(): void
  }
}

interface Window {
  YT?: typeof YT
  onYouTubeIframeAPIReady?: () => void
}
