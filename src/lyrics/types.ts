/** Tempos sempre em segundos, na linha do tempo da letra (antes de aplicar o atraso do vídeo). */
export interface Word {
  text: string
  start: number
  end: number
}

export interface Line {
  start: number
  /** Início da próxima linha (ou fim estimado da última). */
  end: number
  text: string
  words: Word[]
  /** 'word' = tempos por palavra vieram da fonte; 'estimated' = calculados por nós. */
  sync: 'word' | 'estimated'
}

export interface Lyrics {
  lines: Line[]
  /** Tag [offset:] do arquivo LRC, já convertida para segundos. */
  fileOffset: number
}
