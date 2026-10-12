// Étude d'exécution, phase 1 : coût de la latence aux instants de signal
// (research/preregistration/execution-phase1-latency.md).
//
// Échantillon aléatoire simple d'exécutions à la clôture du portefeuille E2 (40 entrées et 15
// fermetures FLIP par actif), dérive dans le sens de l'ordre entre la clôture T et T + x secondes,
// sur les transactions agrégées Binance. Seuls des agrégats sont écrits dans le dépôt (les instants
// et sens des trades du backtest n'en sortent pas) ; les archives sont supprimées après lecture.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/latency-drift.ts

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { NAMES, ROOT, q } from '../capacity/lib.ts'
import type { SleeveKey } from '../capacity/lib.ts'
import { DATA, SYM, isoDay, loadTradesWindows } from '../capacity/binance.ts'
import type { Trades, TradesIntegrity } from '../capacity/binance.ts'
import type { Event } from '../capacity/events.ts'

const SEED = 20261013
const N: Record<'entry' | 'close', number> = { entry: 40, close: 15 }
export const X_S = [0.25, 0.5, 1, 2, 3, 4, 5, 7, 10, 15, 30]
const PAIRS: [number, number][] = [[0.5, 5], [1, 5], [2, 5], [0.5, 2]]
const NREP = 2000
const OUT = join(ROOT, 'research/reports/execution')
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ---------------------------------------------------------------- échantillon (§ 2)
const events: Event[] = JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8'))
const rand = P.rng(SEED)
const pick = <T>(xs: T[], n: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, n) }
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const sample: Event[] = []
const population: Record<string, number> = {}
for (const key of KEYS) for (const fam of ['entry', 'close'] as const) {
  const pop = events.filter(e => e.key === key && e.family === fam).sort((a, b) => a.t - b.t || a.fi - b.fi)
  population[`${NAMES[key]} ${fam}`] = pop.length
  sample.push(...pick(pop, N[fam]))
}
// Terciles de σ₆₀ fixés sur toute la population de l'actif (§ 4).
const terciles = Object.fromEntries(KEYS.map(key => {
  const s = events.filter(e => e.key === key && (e.family === 'entry' || e.family === 'close') && Number.isFinite(e.sigma60)).map(e => e.sigma60)
  return [key, [q(s, 1 / 3), q(s, 2 / 3)]]
})) as Record<SleeveKey, [number, number]>
const tercileOf = (e: Event) => !Number.isFinite(e.sigma60) ? null : e.sigma60 <= terciles[e.key][0] ? 'low' : e.sigma60 <= terciles[e.key][1] ? 'mid' : 'high'
log(`échantillon : ${sample.length} exécutions`)

// ---------------------------------------------------------------- transactions (§ 3)
const wins = new Map<string, [number, number][]>()
for (const e of sample) {
  const a = e.t - 60000, b = e.t + 60000
  for (let d = Math.floor(a / 864e5); d <= Math.floor(b / 864e5); d++) {
    const id = `${e.key}|${isoDay(d * 864e5)}`
    wins.set(id, [...(wins.get(id) ?? []), [a, b]])
  }
}
log(`${wins.size} fichiers quotidiens à lire`)
const parts = new Map<SleeveKey, Trades[]>()
const integrity: TradesIntegrity[] = []
let k = 0
for (const [id, ws] of [...wins].sort(([a], [b]) => a.localeCompare(b))) {
  const [key, day] = id.split('|') as [SleeveKey, string]
  const { tr, integrity: it } = await loadTradesWindows(SYM[key], day, ws)
  integrity.push(it)
  parts.set(key, [...(parts.get(key) ?? []), tr])
  if (++k % 10 === 0) log(`  ${k}/${wins.size}`)
}
function concat(ts: Trades[]): Trades {
  const all = ts.flatMap(t => Array.from(t.t, (_, i) => [t.t[i], t.px[i], t.qty[i], t.buy[i]] as const)).sort((a, b) => a[0] - b[0])
  return { t: Float64Array.from(all, r => r[0]), px: Float64Array.from(all, r => r[1]), qty: Float64Array.from(all, r => r[2]), buy: Uint8Array.from(all, r => r[3]) }
}
const trades = new Map(KEYS.map(key => [key, concat(parts.get(key) ?? [])]))

// ---------------------------------------------------------------- mesures (§ 4)
const lastAtOrBefore = (tr: Trades, t: number) => { let lo = 0, hi = tr.t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (tr.t[md] <= t) lo = md + 1; else hi = md } return lo - 1 }
interface Row { key: SleeveKey; family: string; tercile: string | null; d: number[]; tradesBy5s: number }
const rows: Row[] = []
let noRef = 0
for (const e of sample) {
  const tr = trades.get(e.key)!
  const i0 = lastAtOrBefore(tr, e.t - 1)
  if (i0 < 0 || tr.t[i0] < e.t - 60000) { noRef++; continue }
  const P0 = tr.px[i0]
  const d = X_S.map(x => { const i = lastAtOrBefore(tr, e.t + x * 1000); return e.side * (tr.px[i] / P0 - 1) })
  rows.push({ key: e.key, family: e.family, tercile: tercileOf(e), d, tradesBy5s: lastAtOrBefore(tr, e.t + 5000) - i0 })
}

const boot = (xs: number[], seed: number) => {
  const r = P.rng(seed), means: number[] = []
  for (let b = 0; b < NREP; b++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(r() * xs.length)]; means.push(s / xs.length) }
  return { meanBps: P.mean(xs) * 1e4, medianBps: q(xs, 0.5) * 1e4, loBps: q(means, 0.025) * 1e4, hiBps: q(means, 0.975) * 1e4, n: xs.length }
}
const curve = (rs: Row[]) => Object.fromEntries(X_S.map((x, j) => [`${x}s`, boot(rs.map(r => r.d[j]), SEED + j)]))
const marginal = (rs: Row[]) => Object.fromEntries(PAIRS.map(([a, b], j) => [`${a}s→${b}s`, boot(rs.map(r => r.d[X_S.indexOf(b)] - r.d[X_S.indexOf(a)]), SEED + 100 + j)]))
const groupsOf: [string, (r: Row) => boolean][] = [
  ['BTC entry', r => r.key === 'btc' && r.family === 'entry'], ['ETH entry', r => r.key === 'ethusdt' && r.family === 'entry'],
  ['BTC close', r => r.key === 'btc' && r.family === 'close'], ['ETH close', r => r.key === 'ethusdt' && r.family === 'close'],
  ['BTC all', r => r.key === 'btc'], ['ETH all', r => r.key === 'ethusdt'], ['all', () => true],
  ...(['low', 'mid', 'high'] as const).flatMap(t => [[`BTC σ60 ${t}`, (r: Row) => r.key === 'btc' && r.tercile === t], [`ETH σ60 ${t}`, (r: Row) => r.key === 'ethusdt' && r.tercile === t], [`all σ60 ${t}`, (r: Row) => r.tercile === t]] as [string, (r: Row) => boolean][]),
]
const results = Object.fromEntries(groupsOf.map(([name, f]) => { const rs = rows.filter(f); return [name, { n: rs.length, driftBps: curve(rs), marginalBps: marginal(rs), medianTradesWithin5s: q(rs.map(r => r.tradesBy5s), 0.5) }] }))

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'latency-drift.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), prespec: 'research/preregistration/execution-phase1-latency.md', seed: SEED, population, sampled: sample.length, measured: rows.length, noReferenceTrade: noRef,
  sigma60Terciles: Object.fromEntries(KEYS.map(k => [NAMES[k], terciles[k]])),
  integrity: { files: integrity.length, idGaps: integrity.reduce((a, x) => a + x.idGaps, 0), outOfOrder: integrity.reduce((a, x) => a + x.outOfOrder, 0), tradesKept: integrity.reduce((a, x) => a + x.kept, 0) },
  horizonsS: X_S, results,
}, null, 1))
for (const g of ['BTC entry', 'ETH entry', 'BTC close', 'ETH close', 'all']) {
  const r = results[g] as { n: number; driftBps: Record<string, { meanBps: number }>; marginalBps: Record<string, { meanBps: number; loBps: number; hiBps: number }> }
  log(`${g} (n ${r.n}) : dérive ${['0.5s', '1s', '2s', '5s', '10s'].map(x => `${x} ${r.driftBps[x].meanBps.toFixed(2)}`).join(' · ')} pb ; 1 s→5 s ${r.marginalBps['1s→5s'].meanBps.toFixed(2)} [${r.marginalBps['1s→5s'].loBps.toFixed(2)} ; ${r.marginalBps['1s→5s'].hiBps.toFixed(2)}]`)
}
