/** Trecho de texto com leitura opcional por cima (furigana). */
export interface RubySegment {
  text: string
  reading?: string
}

/** Tempos sempre em segundos, na linha do tempo da letra (antes de aplicar o atraso do vídeo). */
export interface Word {
  text: string
  start: number
  end: number
  /** Pronúncia em letras latinas (romanização), quando a palavra é coreana ou japonesa. */
  roman?: string
  /** Texto dividido para mostrar a leitura em kana sobre os kanjis. */
  ruby?: RubySegment[]
}

export interface Line {
  start: number
  /** Início da próxima linha (ou fim estimado da última). */
  end: number
  text: string
  words: Word[]
  /** 'word' = tempos por palavra vieram da fonte; 'estimated' = calculados por nós. */
  sync: 'word' | 'estimated'
  /** Idioma que tem romanização nesta linha. */
  lang?: 'ko' | 'ja'
}

export interface Lyrics {
  lines: Line[]
  /** Tag [offset:] do arquivo LRC, já convertida para segundos. */
  fileOffset: number
}
