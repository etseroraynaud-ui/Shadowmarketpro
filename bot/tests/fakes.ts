// Faux exchange et fausse source de bougies pour les tests du bot.

import type { Bar } from '../../lib/strategies/shock/live.ts'
import type { CandleApi, Interval } from '../src/data/candles.ts'
import { INTERVAL_MS, MAX_PER_CALL } from '../src/data/candles.ts'

/** Série reproductible de bougies alignées sur la grille. */
export function series(start: number, n: number, step: number, seed = 1, p0 = 60000): Bar[] {
  let s = seed >>> 0
  const R = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const out: Bar[] = []
  let p = p0
  for (let i = 0; i < n; i++) {
    const o = p
    const c = Math.round(o * Math.exp((R() - 0.5) * 0.01))
    const h = Math.max(o, c) + Math.round(R() * 60)
    const l = Math.min(o, c) - Math.round(R() * 60)
    out.push({ t: start + i * step, o, h, l, c, v: Math.round(10 + R() * 200) / 10 })
    p = c
  }
  return out
}

/** API de bougies en mémoire, avec la limite de 5000 bougies par appel et la bougie en cours. */
export class FakeCandleApi implements CandleApi {
  data: Record<Interval, Bar[]>
  calls = 0
  constructor(chart: Bar[], daily: Bar[]) {
    this.data = { '15m': chart, '1d': daily }
  }
  async candles(_coin: string, interval: Interval, startTime: number, endTime: number): Promise<Bar[]> {
    this.calls++
    return this.data[interval].filter(b => b.t >= startTime && b.t <= endTime).slice(0, MAX_PER_CALL).map(b => ({ ...b }))
  }
}

export const M15 = INTERVAL_MS['15m']
export const DAY = INTERVAL_MS['1d']
