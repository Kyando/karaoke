const API = 'https://lrclib.net/api'
// O LRCLIB pede que o cliente se identifique; no navegador isso vai neste header.
const CLIENT = 'karaoke-web/0.0.1 (https://github.com/Kyando/karaoke)'

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
 * Uma sincronização distinta. O LRCLIB repete a mesma letra sincronizada em dezenas de
 * álbuns (coletâneas, remasters) com durações diferentes, então a duração de um registro
 * isolado não diz para qual versão da música a letra foi feita. Agrupando as cópias, a
 * duração mais comum do grupo é a melhor estimativa da versão original.
 */
export interface LyricsVersion {
  /** Registro representante (o de duração mais próxima da típica). */
  record: LrclibRecord
  ids: number[]
  copies: number
  /** Duração mais comum entre as cópias, em segundos inteiros. */
  typicalDuration: number
}

export function groupVersions(records: LrclibRecord[]): LyricsVersion[] {
  const groups = new Map<string, LrclibRecord[]>()
  for (const r of records) {
    if (!r.syncedLyrics || r.instrumental) continue
    const key = r.syncedLyrics.trim()
    groups.set(key, [...(groups.get(key) ?? []), r])
  }
  return [...groups.values()].map((recs) => {
    const typicalDuration = mode(recs.map((r) => Math.round(r.duration)))
    const record = [...recs].sort(
      (a, b) => Math.abs(a.duration - typicalDuration) - Math.abs(b.duration - typicalDuration),
    )[0]
    return { record, ids: recs.map((r) => r.id), copies: recs.length, typicalDuration }
  })
}

/** Diferenças de duração até isso contam como "mesma versão" (arredondamentos, silêncio no fim). */
const SAME_DURATION_SECONDS = 2

/**
 * Melhor versão primeiro: a de duração típica mais próxima do vídeo; entre as que batem
 * com o vídeo (ou empatam), a mais copiada, que tende a ser a sincronização mais usada.
 */
export function rankVersions(versions: LyricsVersion[], videoDuration: number | null): LyricsVersion[] {
  const distance = (v: LyricsVersion) =>
    videoDuration == null ? 0 : Math.max(0, Math.abs(v.typicalDuration - videoDuration) - SAME_DURATION_SECONDS)
  return [...versions].sort((a, b) => distance(a) - distance(b) || b.copies - a.copies)
}

function mode(values: number[]): number {
  const counts = new Map<number, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best = values[0]
  for (const [v, n] of counts) if (n > (counts.get(best) ?? 0)) best = v
  return best
}
