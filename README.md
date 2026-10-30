# Karaokê

Karaokê web no estilo do Spotify: o vídeo do YouTube toca e a letra rola sozinha, com a palavra atual acesa. Roda inteiro no navegador e é publicado no GitHub Pages.

O plano completo está em [plano-karaoke.html](plano-karaoke.html). Estado atual: **F0, prova de conceito**.

## Rodar localmente

```bash
npm install
npm run dev
```

O servidor também abre na rede local (`--host`), então dá para testar no celular pelo IP do computador, ex.: `http://192.168.0.10:5173`.

```bash
npm test        # testes do parser, relógio e calibração
npm run build   # gera dist/ para publicação
```

## Como funciona

- **Música:** vídeo do YouTube via IFrame Player API (`src/player/YouTubePlayer.ts`). A letra nunca fica por cima do vídeo, por regra do YouTube.
- **Letra:** buscada no [LRCLIB](https://lrclib.net) pelo artista e título; a versão com duração mais próxima do vídeo é escolhida (`src/lyrics/lrclib.ts`).
- **Sincronia:** o tempo do player é lido a cada 250 ms e interpolado a cada quadro (`src/player/clock.ts`). As palavras de cada linha têm o tempo estimado pelo tamanho (`src/lyrics/estimateWords.ts`).
- **Atraso:** videoclipes têm introduções diferentes da versão de estúdio. O atraso é ajustado por vídeo com os botões ‹ › ou pela calibração por toque, e fica salvo no navegador.

## Precisa pré-processar as músicas?

Não. Qualquer música funciona na hora, desde que:

1. o vídeo do YouTube permita ser tocado fora do YouTube (a maioria permite);
2. o LRCLIB tenha a letra sincronizada (as músicas populares quase sempre têm).

O único ajuste por música é o **atraso** entre vídeo e letra, quando o vídeo tem introdução diferente da versão de estúdio. Lyric videos oficiais e "áudio oficial" geralmente batem sem ajuste. Na F0 o atraso fica salvo só no navegador de quem calibrou; na F1 ele passa a ser salvo no catálogo do repositório, para valer em todos os aparelhos.

As músicas de teste ficam em [src/catalog/testSongs.ts](src/catalog/testSongs.ts).

## Testando a F0

1. Abra o app, escolha uma música em **Músicas** e toque em **Tocar**.
2. Em **Ajustes → Calibrar**, use **Marcar 1ª linha** e aperte **Marcar** quando a primeira frase começar.
3. Em seguida, aperte **Marcar** no início de cada linha. O desvio mediano deve ficar abaixo de 150 ms.
4. **Medições técnicas** mostra o erro do relógio e os quadros por segundo do aparelho.

Links com `?v=<id>&artist=...&track=...` abrem direto numa música, o que facilita testar a mesma música em vários aparelhos.
