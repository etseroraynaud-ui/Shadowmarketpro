// P1, complément EXPLORATOIRE (ajouté après lecture du pilote pré-enregistré, qui montrait une dérive
// concentrée dans les premières secondes) : échantillon aléatoire NON stratifié de 40 entrées par
// actif (graine 20261019), dérive du perpétuel à 1, 2, 5, 10, 30 et 60 s après la décision, dernier
// prix et VWAP. Sert à mesurer le coût du délai d'exécution sans le biais de stratification du pilote.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/pilot-random.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { NAMES, OUT, q } from './lib.ts'
import type { SleeveKey } from './lib.ts'
import { DATA, SYM, isoDay, loadTradesWindows } from './binance.ts'
import type { Event } from './events.ts'

const N = 40
const SEED_RANDOM = 20261019
const H = [1, 2, 5, 10, 30, 60]
const events: Event[] = JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8'))
const rand = P.rng(SEED_RANDOM)
const out: Record<string, unknown> = {}
const t0 = Date.now()
for (const key of ['btc', 'ethusdt'] as SleeveKey[]) {
  const pool = events.filter(e => e.key === key && e.family === 'entry')
  const a = [...pool]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  const sample = a.slice(0, N)
  const byDay = new Map<string, Event[]>()
  for (const e of sample) for (const d of new Set([isoDay(e.t - 60000), isoDay(e.t + 61000)])) { if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(e) }
  const rows: { last: number[]; vwap: number[] }[] = []
  const got = new Map<Event, { t: number[]; px: number[]; qty: number[] }>()
  for (const [day, es] of byDay) {
    const { tr } = await loadTradesWindows(SYM[key], day, es.map(e => [e.t - 60000, e.t + 61000] as [number, number]))
    for (const e of es) {
      const g = got.get(e) ?? { t: [], px: [], qty: [] }
      for (let i = 0; i < tr.t.length; i++) if (tr.t[i] >= e.t - 60000 && tr.t[i] <= e.t + 61000) { g.t.push(tr.t[i]); g.px.push(tr.px[i]); g.qty.push(tr.qty[i]) }
      got.set(e, g)
    }
  }
  for (const e of sample) {
    const g = got.get(e)!
    const idx = g.t.map((_, i) => i).sort((i, j) => g.t[i] - g.t[j])
    const T = idx.map(i => g.t[i]), PX = idx.map(i => g.px[i]), Q = idx.map(i => g.qty[i])
    let i0 = -1
    for (let i = 0; i < T.length && T[i] < e.t; i++) i0 = i
    if (i0 < 0) continue
    const P0 = PX[i0]
    const last = H.map(s => { let j = i0; while (j + 1 < T.length && T[j + 1] <= e.t + s * 1000) j++; return e.side * (PX[j] / P0 - 1) })
    const vwap = H.map(s => { let qv = 0, v = 0; for (let j = i0 + 1; j < T.length && T[j] <= e.t + s * 1000; j++) { qv += PX[j] * Q[j]; v += Q[j] } return v > 0 ? e.side * (qv / v / P0 - 1) : NaN })
    rows.push({ last, vwap })
  }
  const ci = (xs: number[]) => { xs = xs.filter(Number.isFinite); const r = P.rng(SEED_RANDOM + 1), m: number[] = []; for (let k = 0; k < 2000; k++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(r() * xs.length)]; m.push(s / xs.length) } return { meanBps: P.mean(xs) * 1e4, loBps: q(m, 0.025) * 1e4, hiBps: q(m, 0.975) * 1e4, n: xs.length } }
  out[NAMES[key]] = Object.fromEntries(H.map((s, j) => [`${s}s`, { last: ci(rows.map(r => r.last[j])), vwap: ci(rows.map(r => r.vwap[j])) }]))
  process.stderr.write(`${NAMES[key]} : ${rows.length} entrées · ${H.map((s, j) => `${s}s ${(P.mean(rows.map(r => r.last[j])) * 1e4).toFixed(1)} pb`).join(' · ')} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
}
writeFileSync(join(OUT, 'p1-pilot-random.json'), JSON.stringify({ generatedAt: new Date().toISOString(), exploratory: 'added after the pre-registered pilot showed front-loaded drift; not pre-registered', seed: SEED_RANDOM, perAsset: N, horizonsS: H, results: out }, null, 1))
