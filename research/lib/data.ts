// Chargement des barres BTC construites par research/data/build-btc.ts.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Bars } from '../../lib/backtest/types.ts'

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'data')
const cache = new Map<number, Bars>()

export function loadBtc(minutes: number): Bars {
  const hit = cache.get(minutes)
  if (hit) return hit
  const text = gunzipSync(readFileSync(join(DATA, `btcusd_${minutes}m.csv.gz`))).toString('latin1')
  const lines = text.split('\n')
  const n = lines.length - 2
  const b: Bars = {
    n: 0, t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n),
    l: new Float64Array(n), c: new Float64Array(n), v: new Float64Array(n),
  }
  let k = 0
  for (let i = 1; i < lines.length; i++) {
    const s = lines[i]
    if (!s) continue
    const p = s.split(',')
    b.t[k] = +p[0]; b.o[k] = +p[1]; b.h[k] = +p[2]; b.l[k] = +p[3]; b.c[k] = +p[4]; b.v[k] = +p[5]
    k++
  }
  const out: Bars = { n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) }
  cache.set(minutes, out)
  return out
}

export function dayMs(s: string): number {
  const t = Date.parse(s.length === 10 ? s + 'T00:00:00Z' : s)
  if (!Number.isFinite(t)) throw new Error(`date illisible : ${s}`)
  return t
}

export function indexAtOrAfter(b: Bars, t: number): number {
  let lo = 0
  let hi = b.n
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (b.t[m] < t) lo = m + 1
    else hi = m
  }
  return lo
}
