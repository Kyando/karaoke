// Build do kuromoji para navegador (o pacote principal depende de módulos do Node).
declare module 'kuromoji/build/kuromoji.js' {
  export interface KuromojiToken {
    surface_form: string
    pos: string
    pos_detail_1: string
    reading?: string
    pronunciation?: string
  }
  export interface Tokenizer {
    tokenize(text: string): KuromojiToken[]
  }
  const kuromoji: {
    builder(options: { dicPath: string }): {
      build(callback: (err: Error | null, tokenizer: Tokenizer) => void): void
    }
  }
  export default kuromoji
}

// Pacote principal (Node): usado só nos testes, com a mesma interface.
declare module 'kuromoji' {
  import kuromoji from 'kuromoji/build/kuromoji.js'
  export default kuromoji
}
