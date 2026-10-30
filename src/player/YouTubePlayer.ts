import type { PlayerAdapter, PlayerEvents, PlayerState } from './PlayerAdapter'

let apiPromise: Promise<typeof YT> | null = null

/** Carrega o script da IFrame API uma única vez. */
function loadApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      resolve(window.YT!)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.onerror = () => {
      apiPromise = null
      reject(new Error('Não foi possível carregar o player do YouTube. Verifique a conexão.'))
    }
    document.head.appendChild(script)
  })
  return apiPromise
}

const ERRORS: Record<number, string> = {
  2: 'Link ou ID de vídeo inválido.',
  5: 'O navegador não conseguiu tocar este vídeo.',
  100: 'Vídeo não encontrado (removido ou privado).',
  101: 'O dono deste vídeo não permite tocá-lo fora do YouTube. Escolha outro vídeo.',
  150: 'O dono deste vídeo não permite tocá-lo fora do YouTube. Escolha outro vídeo.',
  153: 'O YouTube recusou o player por falta de identificação do site (erro 153).',
}

/** Aceita link completo, link curto, shorts, embed ou só o ID. */
export function parseVideoId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    if (url.hostname.endsWith('youtu.be')) return url.pathname.slice(1, 12) || null
    const v = url.searchParams.get('v')
    if (v) return v.slice(0, 11)
    const m = url.pathname.match(/\/(?:embed|shorts|live|v)\/([\w-]{11})/)
    return m?.[1] ?? null
  } catch {
    return null
  }
}

export async function createYouTubePlayer(
  host: HTMLElement,
  videoId: string,
  events: PlayerEvents = {},
): Promise<PlayerAdapter> {
  const api = await loadApi()
  // O YouTube troca o elemento pelo iframe; usamos um invólucro próprio para não confundir
  // o React e para o destroy remover só este player.
  const wrapper = document.createElement('div')
  wrapper.className = 'yt-wrapper'
  const mount = document.createElement('div')
  wrapper.appendChild(mount)
  host.appendChild(wrapper)

  let state: PlayerState = 'loading'
  const setState = (s: PlayerState) => {
    state = s
    events.onState?.(s)
  }

  const player = await new Promise<YT.Player>((resolve) => {
    const p = new api.Player(mount, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1, // iPhone: toca dentro da página, sem abrir tela cheia
        rel: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          setState('ready')
          resolve(p)
        },
        onStateChange: (e) => {
          const map: Record<number, PlayerState> = {
            [api.PlayerState.PLAYING]: 'playing',
            [api.PlayerState.PAUSED]: 'paused',
            [api.PlayerState.BUFFERING]: 'buffering',
            [api.PlayerState.ENDED]: 'ended',
            [api.PlayerState.CUED]: 'ready',
            [api.PlayerState.UNSTARTED]: 'ready',
          }
          setState(map[e.data] ?? state)
        },
        onError: (e) => {
          setState('error')
          events.onError?.(ERRORS[e.data] ?? `Erro do player do YouTube (${e.data}).`)
          resolve(p)
        },
        onAutoplayBlocked: () => events.onAutoplayBlocked?.(),
      },
    })
  })

  return {
    play: () => player.playVideo(),
    pause: () => player.pauseVideo(),
    seek: (s) => player.seekTo(Math.max(0, s), true),
    currentTime: () => player.getCurrentTime?.() ?? 0,
    duration: () => {
      const d = player.getDuration?.()
      return d && d > 0 ? d : null
    },
    playbackRate: () => player.getPlaybackRate?.() ?? 1,
    state: () => state,
    destroy: () => {
      player.destroy?.()
      wrapper.remove()
    },
  }
}
