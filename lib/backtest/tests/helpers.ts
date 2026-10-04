import type { Bars, Settings, Signals } from '../types.ts'
import { DEFAULT_SETTINGS } from '../types.ts'
import { rng } from '../robustness.ts'

/** Barres journalières à partir de lignes [open, high, low, close]. */
export function barsOf(rows: number[][], start = Date.UTC(2020, 0, 1)): Bars {
  const n = rows.length
  const b: Bars = {
    n, t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n),
    l: new Float64Array(n), c: new Float64Array(n), v: new Float64Array(n),
  }
  rows.forEach((r, i) => {
    b.t[i] = start + i * 86400000
    b.o[i] = r[0]; b.h[i] = r[1]; b.l[i] = r[2]; b.c[i] = r[3]; b.v[i] = r[4] ?? 1000
  })
  return b
}

/** Marche aléatoire log-normale reproductible. */
export function randomBars(n: number, seed = 1, start = 100): Bars {
  const R = rng(seed)
  const rows: number[][] = []
  let p = start
  for (let i = 0; i < n; i++) {
    const o = p
    const c = o * Math.exp((R() - 0.5) * 0.06)
    const h = Math.max(o, c) * (1 + R() * 0.02)
    const l = Math.min(o, c) * (1 - R() * 0.02)
    rows.push([o, h, l, c, 100 + R() * 900])
    p = c * Math.exp((R() - 0.5) * 0.004)
  }
  return barsOf(rows)
}

export function signalsOf(n: number, f: Partial<Record<'long' | 'exitLong' | 'short' | 'exitShort', number[]>>, extra: Partial<Signals> = {}): Signals {
  const mk = (idx?: number[]) => {
    const u = new Uint8Array(n)
    for (const i of idx ?? []) u[i] = 1
    return u
  }
  return {
    long: mk(f.long), exitLong: mk(f.exitLong), short: mk(f.short), exitShort: mk(f.exitShort),
    stopLoss: null, takeProfit: null, plots: [], ...extra,
  }
}

export function settings(s: Partial<Settings> = {}): Settings {
  return { ...DEFAULT_SETTINGS, feePct: 0, slippagePct: 0, ...s }
}

export function close(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b))
}
