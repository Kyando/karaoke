/**
 * Músicas para testar a F0. Só referências: o vídeo é do YouTube e a letra é buscada no
 * LRCLIB na hora, pelo artista e título. Na F1 isto vira o catálogo com atraso calibrado.
 *
 * Preferimos lyric videos oficiais e "áudio oficial" (canais Topic), porque seguem o tempo
 * da versão de estúdio, igual às letras do LRCLIB. Videoclipes costumam ter introdução extra.
 */
export interface TestSong {
  group: string
  title: string
  artist: string
  videoId: string
  /** Atraso calibrado (ms) para este vídeo; vale até a pessoa calibrar no próprio aparelho. */
  offsetMs?: number
  /** Por que esta música está na lista, quando não é óbvio. */
  note?: string
}

export const TEST_SONGS: TestSong[] = [
  { group: 'Marília Mendonça', title: 'Infiel', artist: 'Marília Mendonça', videoId: 'eCyMh-mZ1B0', note: 'videoclipe' },
  { group: 'Marília Mendonça', title: 'Supera', artist: 'Marília Mendonça', videoId: '7fMttPxpcmg', note: 'ao vivo' },
  { group: 'Marília Mendonça', title: 'Todo Mundo Vai Sofrer', artist: 'Marília Mendonça', videoId: 'ILADw1aretk', note: 'ao vivo' },

  { group: 'Adele', title: 'Easy On Me', artist: 'Adele', videoId: 'X-yIEMduRXk' },
  { group: 'Adele', title: 'Someone Like You', artist: 'Adele', videoId: 'hLQl3WQQoQ0', note: 'videoclipe' },
  { group: 'Adele', title: 'Hello', artist: 'Adele', videoId: 'YQHsXMglC9A', note: 'clipe com introdução longa: teste de calibração' },

  { group: 'HUNTR/X', title: 'Golden', artist: 'HUNTR/X', videoId: 'yebNIHKAC4A', offsetMs: 3000, note: 'lyric video: 3 s de introdução' },
  { group: 'HUNTR/X', title: "How It's Done", artist: 'HUNTR/X', videoId: 'QGsevnbItdU', offsetMs: 6500, note: 'lyric video: ~6,5 s de introdução' },

  { group: 'Ed Sheeran', title: 'Perfect', artist: 'Ed Sheeran', videoId: 'iKzRIweSBLA' },
  { group: 'Ed Sheeran', title: 'Shape of You', artist: 'Ed Sheeran', videoId: '_dK2tDK9grQ' },
  { group: 'Ed Sheeran', title: 'Thinking Out Loud', artist: 'Ed Sheeran', videoId: 'Q5z6RHIpi2Y' },

  { group: 'Persona 5', title: 'Life Will Change', artist: 'Lyn', videoId: '2AWc3DRmj1U' },
  { group: 'Persona 5', title: 'Last Surprise', artist: 'Lyn', videoId: 'ZNGqBDRJgvo' },
  { group: 'Persona 5', title: 'Wake Up, Get Up, Get Out There', artist: 'Lyn', videoId: 'azNG-AU0eGg' },
  { group: 'Persona 5', title: '星と僕らと', artist: 'Lyn', videoId: 'ghmaEb5mThw', note: 'japonês' },

  { group: 'Japonês', title: '夜に駆ける', artist: 'YOASOBI', videoId: 'by4SYYWlhEs' },
  { group: 'Japonês', title: '紅蓮華', artist: 'LiSA', videoId: 'x1FV6IrjZCY', note: 'videoclipe' },
]
