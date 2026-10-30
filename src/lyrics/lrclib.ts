const API = 'https://lrclib.net/api'
// O LRCLIB pede que o cliente se identifique; no navegador isso vai neste header.
const CLIENT = 'karaoke-web/0.0.1'

export interface LrclibRecord {
  id: number
  trackName: string
  artistName: string
  albumName: string | null
  duration: number
  instrumental: boolean
  hasWordSync?: boolean
  plainLyrics: string | null
  syncedLyrics: string | null
}

export async function searchLyrics(track: string, artist: string, signal?: AbortSignal): Promise<LrclibRecord[]> {
  const params = new URLSearchParams({ track_name: track })
  if (artist.trim()) params.set('artist_name', artist)
  const res = await fetch(`${API}/search?${params}`, { headers: { 'Lrclib-Client': CLIENT }, signal })
  if (!res.ok) throw new Error(`LRCLIB respondeu ${res.status}`)
  return (await res.json()) as LrclibRecord[]
}

/**
 * Ordena para a melhor letra vir primeiro: com sincronia, depois a duração mais próxima
 * da duração do vídeo (videoclipes costumam ser alguns segundos mais longos).
 */
export function rankByDuration(records: LrclibRecord[], videoDuration: number | null): LrclibRecord[] {
  return [...records]
    .filter((r) => !r.instrumental)
    .sort((a, b) => {
      const syncDiff = Number(!!b.syncedLyrics) - Number(!!a.syncedLyrics)
      if (syncDiff) return syncDiff
      if (videoDuration == null) return 0
      return Math.abs(a.duration - videoDuration) - Math.abs(b.duration - videoDuration)
    })
}
