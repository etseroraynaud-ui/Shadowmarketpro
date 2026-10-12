// Étude d'exécution : exécutabilité des ordres du Shock Engine à 500 k$ et 1 M$
// (research/preregistration/execution-fills-500k-1m.md), étape 1 : mesures exécution par exécution
// sur les transactions Binance USDⓈ-M.
//
// Pour chaque exécution du portefeuille E2 dans la fenêtre Binance : prix de référence, heure de
// franchissement (stops, TP1), demi-spread effectif, dérive à T + 0,5 / 1 / 3 / 5 s, ordres
// agresseurs réels autour de l'arrivée (coût des Q premiers dollars, part restée à moins de 50 pb,
// délai jusqu'au premier ordre réel de taille ≥ Q), et passage du prix à travers le niveau des TP1.
// Les lignes (instants et sens des trades du backtest) restent hors du dépôt
// (research/data/binance/derived/fills-*.jsonl) ; seuls des agrégats en sortent (fills-report.ts).
// Reprend là où il s'est arrêté ; archives supprimées après lecture.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/fills-measure.ts [btc|ethusdt]

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SleeveKey } from '../capacity/lib.ts'
import { DATA, SYM, fetchVerified, isoDay, loadTradesWindows } from '../capacity/binance.ts'
import type { Trades } from '../capacity/binance.ts'
import type { Event } from '../capacity/events.ts'

export const LAT_S = [0.5, 1, 3, 5]
export const SIZES = [62_500, 125e3, 250e3, 500e3, 1e6, 2e6]
export const LIMIT_BPS = 50
const SWEEP_WIN = 120000
const HS_WIN = 30 * 60000
const M15 = 15 * 60000
const DAY = 864e5
const PREFETCH = 4

export interface SizeStat { n: number; med: number | null; within: number | null; afterMs: number | null }
export interface FillRow {
  key: SleeveKey; fi: number; pos: number; family: string; kind: string; side: 1 | -1; frac: number
  tRef: number; crossFound: boolean | null; P0: number | null; hs: number | null
  drift: Record<string, number | null>
  sweeps: Record<string, SizeStat[]>
  tp1Through: boolean | null; tp1Touched: boolean | null
  sigma60: number; v24: number; depth1: number; trades: number
}

const lastAtOrBefore = (tr: Trades, t: number) => { let lo = 0, hi = tr.t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (tr.t[md] <= t) lo = md + 1; else hi = md } return lo - 1 }
const firstAtOrAfter = (tr: Trades, t: number) => { let lo = 0, hi = tr.t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (tr.t[md] < t) lo = md + 1; else hi = md } return lo }
const median = (xs: number[]) => { if (!xs.length) return null; const a = [...xs].sort((u, v) => u - v); const h = (a.length - 1) / 2; return (a[Math.floor(h)] + a[Math.ceil(h)]) / 2 }

/** Fenêtre de transactions nécessaire à une exécution. */
export function windowOf(e: Event): [number, number] {
  if (e.family === 'entry' || e.family === 'close') return [e.t - HS_WIN, e.t + 5000 + SWEEP_WIN + 1000]
  const bar = Math.floor(e.t / M15) * M15
  return [Math.min(e.t, bar) - HS_WIN, bar + M15 + 5000 + SWEEP_WIN + 1000]
}

/** Ordres agresseurs reconstitués : transactions consécutives de même milliseconde et de même côté. */
export interface Sweep { t: number; buy: number; usd: number; levels: [number, number][] }
export function sweepsIn(tr: Trades, a: number, b: number, buy: number): Sweep[] {
  const out: Sweep[] = []
  let cur: Sweep | null = null
  for (let i = firstAtOrAfter(tr, a); i < tr.t.length && tr.t[i] <= b; i++) {
    if (cur && cur.t === tr.t[i] && cur.buy === tr.buy[i]) { cur.levels.push([tr.px[i], tr.qty[i]]); cur.usd += tr.px[i] * tr.qty[i]; continue }
    if (cur && cur.buy === buy) out.push(cur)
    cur = { t: tr.t[i], buy: tr.buy[i], usd: tr.px[i] * tr.qty[i], levels: [[tr.px[i], tr.qty[i]]] }
  }
  if (cur && cur.buy === buy) out.push(cur)
  return out
}

/** Coût (pb du premier prix) des Q premiers dollars d'un ordre réel, et écart du dernier niveau touché. */
export function firstDollars(s: Sweep, Q: number): { cost: number; worst: number } {
  const p0 = s.levels[0][0], side = s.buy ? 1 : -1
  let rem = Q, val = 0, qty = 0, last = p0
  for (const [p, q] of s.levels) {
    const take = Math.min(p * q, rem)
    val += take; qty += take / p; rem -= take; last = p
    if (rem <= 1e-9) break
  }
  return { cost: side * (val / qty / p0 - 1) * 1e4, worst: side * (last / p0 - 1) * 1e4 }
}

export function measure(e: Event, tr: Trades): FillRow {
  const side = e.side
  const bar = Math.floor(e.t / M15) * M15
  let tRef = e.t, P0: number | null = null, crossFound: boolean | null = null
  let tp1Through: boolean | null = null, tp1Touched: boolean | null = null
  if (e.family === 'entry' || e.family === 'close') {
    const i0 = lastAtOrBefore(tr, e.t - 1)
    if (i0 >= 0 && tr.t[i0] >= e.t - 60000) P0 = tr.px[i0]
  } else if (e.family === 'stop') {
    const L = e.ref
    const hit = (p: number) => (side === -1 ? p <= L : p >= L)
    const find = (a: number, b: number) => { for (let i = firstAtOrAfter(tr, a); i < tr.t.length && tr.t[i] < b; i++) if (hit(tr.px[i])) return tr.t[i]; return null }
    const t = find(e.t, e.t + 60000) ?? find(bar, bar + M15)
    crossFound = t != null
    if (t != null) tRef = t
    P0 = L
  } else {
    // TP1 : ordre limite au repos au niveau L ; une transaction au-delà prouve que le niveau a été épuisé.
    const L = e.ref
    let through = false, touched = false
    for (let i = firstAtOrAfter(tr, bar); i < tr.t.length && tr.t[i] < bar + M15; i++) {
      const p = tr.px[i]
      if (side === -1 ? p >= L : p <= L) touched = true
      if (side === -1 ? p > L : p < L) { through = true; break }
    }
    tp1Through = through
    tp1Touched = touched
    P0 = L
  }
  // Demi-spread effectif : secondes avec achats et ventes agresseurs, 30 min avant la référence.
  const sec = new Map<number, [number, number, number, number]>()
  for (let i = firstAtOrAfter(tr, tRef - HS_WIN); i < tr.t.length && tr.t[i] < tRef; i++) {
    const k = Math.floor(tr.t[i] / 1000)
    const x = sec.get(k) ?? [0, 0, 0, 0]
    if (tr.buy[i]) { x[0] += tr.px[i] * tr.qty[i]; x[1] += tr.qty[i] } else { x[2] += tr.px[i] * tr.qty[i]; x[3] += tr.qty[i] }
    sec.set(k, x)
  }
  const hsList = [...sec.values()].filter(x => x[1] > 0 && x[3] > 0).map(x => { const pb = x[0] / x[1], ps = x[2] / x[3]; return (pb - ps) / 2 / ((pb + ps) / 2) * 1e4 })
  const drift: Record<string, number | null> = {}
  const sweeps: Record<string, SizeStat[]> = {}
  if (P0 != null && e.family !== 'tp1') {
    const all = sweepsIn(tr, tRef - SWEEP_WIN, tRef + 5000 + SWEEP_WIN, side === 1 ? 1 : 0)
    for (const L of LAT_S) {
      const ta = tRef + L * 1000
      const i = lastAtOrBefore(tr, ta)
      drift[`${L}s`] = i >= 0 && tr.t[i] >= tRef - 60000 ? side * (tr.px[i] / P0 - 1) * 1e4 : null
      const win = all.filter(s => s.t >= ta - SWEEP_WIN && s.t <= ta + SWEEP_WIN)
      sweeps[`${L}s`] = SIZES.map(Q => {
        const big = win.filter(s => s.usd >= Q)
        const f = big.map(s => firstDollars(s, Q))
        const after = big.find(s => s.t >= ta)
        return { n: big.length, med: median(f.map(x => x.cost)), within: f.length ? f.filter(x => x.worst <= LIMIT_BPS).length / f.length : null, afterMs: after ? after.t - ta : null }
      })
    }
  }
  const [a, b] = windowOf(e)
  return {
    key: e.key, fi: e.fi, pos: e.pos, family: e.family, kind: e.kind, side, frac: e.frac, tRef, crossFound, P0, hs: median(hsList),
    drift, sweeps, tp1Through, tp1Touched, sigma60: e.sigma60, v24: e.v24, depth1: e.depth1, trades: firstAtOrAfter(tr, b) - firstAtOrAfter(tr, a),
  }
}

function concat(a: Trades | null, b: Trades): Trades {
  if (!a || !a.t.length) return b
  const cat = <T extends Float64Array | Uint8Array>(x: T, y: T, C: new (n: number) => T) => { const o = new C(x.length + y.length); o.set(x); o.set(y, x.length); return o }
  return { t: cat(a.t, b.t, Float64Array), px: cat(a.px, b.px, Float64Array), qty: cat(a.qty, b.qty, Float64Array), buy: cat(a.buy, b.buy, Uint8Array) }
}
function after(tr: Trades, t: number): Trades {
  const i = firstAtOrAfter(tr, t)
  return { t: tr.t.subarray(i), px: tr.px.subarray(i), qty: tr.qty.subarray(i), buy: tr.buy.subarray(i) }
}

async function run(key: SleeveKey) {
  const t0 = Date.now()
  const log = (s: string) => process.stderr.write(`[${key}] ${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
  const events: Event[] = (JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8')) as Event[]).filter(e => e.key === key)
  const out = join(DATA, 'derived', `fills-${SYM[key]}.jsonl`)
  mkdirSync(join(DATA, 'derived'), { recursive: true })
  const done = new Set(existsSync(out) ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => (JSON.parse(l) as FillRow).fi) : [])
  const todo = events.filter(e => !done.has(e.fi))
  // Jours nécessaires et fenêtres par jour ; une exécution est mesurée quand son dernier jour est lu.
  const wins = new Map<number, [number, number][]>()
  const lastDay = new Map<number, number>()
  for (const e of todo) {
    const [a, b] = windowOf(e)
    for (let d = Math.floor(a / DAY); d <= Math.floor(b / DAY); d++) wins.set(d, [...(wins.get(d) ?? []), [a, b]])
    lastDay.set(e.fi, Math.floor(b / DAY))
  }
  const days = [...wins.keys()].sort((x, y) => x - y).slice(0, Number(process.env.FILLS_LIMIT_DAYS ?? Infinity))
  log(`${todo.length} exécutions à mesurer (${done.size} déjà faites), ${days.length} jours`)
  const rel = (d: number) => `daily/aggTrades/${SYM[key]}/${SYM[key]}-aggTrades-${isoDay(d * DAY)}.zip`
  const pending = new Map<number, Promise<unknown>>()
  let buf: Trades | null = null
  let prevDay = -Infinity
  for (let k = 0; k < days.length; k++) {
    for (let j = k; j < Math.min(days.length, k + PREFETCH); j++) if (!pending.has(days[j])) pending.set(days[j], fetchVerified(rel(days[j])).catch(() => null))
    const d = days[k]
    await pending.get(d)
    pending.delete(d)
    let tr: Trades
    try {
      tr = (await loadTradesWindows(SYM[key], isoDay(d * DAY), wins.get(d)!)).tr
    } catch (err) {
      log(`jour ${isoDay(d * DAY)} illisible : ${String(err)}`)
      tr = { t: new Float64Array(0), px: new Float64Array(0), qty: new Float64Array(0), buy: new Uint8Array(0) }
    }
    buf = d === prevDay + 1 && buf ? concat(after(buf, (d - 1) * DAY), tr) : tr
    prevDay = d
    for (const e of todo.filter(x => lastDay.get(x.fi) === d)) appendFileSync(out, JSON.stringify(measure(e, buf)) + '\n')
    if ((k + 1) % 25 === 0) log(`${k + 1}/${days.length} jours`)
  }
  log('terminé')
}

if (process.argv[1]?.endsWith('fills-measure.ts')) {
  const keys = (process.argv[2] ? [process.argv[2]] : ['btc', 'ethusdt']) as SleeveKey[]
  await Promise.all(keys.map(run))
}
