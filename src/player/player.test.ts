import { describe, expect, it } from 'vitest'
import { MediaClock } from './clock'
import { parseVideoId } from './YouTubePlayer'

function fakeWall() {
  let t = 0
  return { now: () => t, advance: (ms: number) => (t += ms) }
}

describe('MediaClock', () => {
  it('fica parado enquanto pausado', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(5, false)
    wall.advance(1000)
    expect(c.now()).toBe(5)
  })

  it('extrapola entre leituras enquanto toca', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(10, true)
    wall.advance(100)
    expect(c.now()).toBeCloseTo(10.1)
  })

  it('respeita a velocidade de reprodução', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(0, true, 0.5)
    wall.advance(1000)
    expect(c.now()).toBeCloseTo(0.5)
  })

  it('suaviza pequenos erros em vez de pular', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(0, true)
    wall.advance(250)
    c.sample(0.29, true) // player diz 40 ms à frente da previsão
    const t = c.now()
    expect(t).toBeGreaterThan(0.25)
    expect(t).toBeLessThan(0.29)
    expect(c.stats.lastErrorMs).toBeCloseTo(40)
  })

  it('reancora na hora num seek', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(0, true)
    wall.advance(250)
    c.sample(60, true)
    expect(c.now()).toBe(60)
    expect(c.stats.hardResyncs).toBe(1)
  })

  it('converge para o tempo real do player', () => {
    const wall = fakeWall()
    const c = new MediaClock(wall.now)
    c.sample(0, true)
    // player 3% mais rápido que o relógio do navegador
    for (let i = 1; i <= 40; i++) {
      wall.advance(250)
      c.sample(i * 0.25 * 1.03, true)
    }
    expect(Math.abs(c.now() - 40 * 0.25 * 1.03)).toBeLessThan(0.03)
  })
})

describe('parseVideoId', () => {
  it.each([
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?si=abc', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
  ])('%s', (input, id) => {
    expect(parseVideoId(input)).toBe(id)
  })

  it('recusa texto que não é link', () => {
    expect(parseVideoId('não é um link')).toBeNull()
  })
})
