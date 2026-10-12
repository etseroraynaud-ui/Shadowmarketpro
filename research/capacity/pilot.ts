// P1 de l'étude de capacité : pilote `aggTrades` (research/preregistration/capacity-p0p1.md, § 8).
//
// 48 positions tirées au hasard (graine 20261012), 6 par actif et par strate : 5 % meilleures,
// 20 % plus mauvaises, volatilité 60 min à l'entrée dans le décile le plus haut, autres. Pour
// chacune, trade par trade sur le perpétuel :
// - entrée : dérive après la décision à 10 s, 30 s, 1, 3, 5 et 15 min (dernier prix et VWAP), volume ;
// - demi-spread effectif dans les 30 min avant la décision (achats et ventes agresseurs de la même
//   seconde) ;
// - stops : premier trade qui franchit le niveau converti, poursuite défavorable à 10, 30 et 60 s ;
// - cohérence avec les bougies 1 min (dérive à 1 min des deux sources).
// Les archives aggTrades sont supprimées après lecture ; seuls des agrégats sont écrits dans le dépôt.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { NAMES, OUT, SEED, q } from './lib.ts'
import type { SleeveKey } from './lib.ts'
import { DATA, SYM, isoDay, loadTradesWindows } from './binance.ts'
import type { Trades, TradesIntegrity } from './binance.ts'
import type { Event } from './events.ts'

const PER_STRATUM = 6
export const PILOT_S = [10, 30, 60, 180, 300, 900]
const STOP_S = [10, 30, 60]
const events: Event[] = JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8'))
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ---------------------------------------------------------------- échantillon
type Stratum = 'top5' | 'worst20' | 'highVol' | 'other'
const rand = P.rng(SEED)
const pick = <T>(xs: T[], n: number) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a.slice(0, n) }
const sample: { key: SleeveKey; pos: number; stratum: Stratum }[] = []
for (const key of ['btc', 'ethusdt'] as SleeveKey[]) {
  // Positions entrées et sorties dans la fenêtre : celles dont l'entrée est placée et qui ont au moins une sortie.
  const entries = events.filter(e => e.key === key && e.family === 'entry' && events.some(x => x.key === key && x.pos === e.pos && x.family !== 'entry'))
  const pnl = entries.map(e => e.pnlPct).sort((a, b) => a - b)
  const hiPnl = q(pnl, 0.95), loPnl = q(pnl, 0.2)
  const top = entries.filter(e => e.pnlPct >= hiPnl), worst = entries.filter(e => e.pnlPct <= loPnl)
  const rest = entries.filter(e => e.pnlPct > loPnl && e.pnlPct < hiPnl)
  const hiVol = q(rest.map(e => e.sigma60).filter(Number.isFinite), 0.9)
  const vol = rest.filter(e => e.sigma60 >= hiVol), other = rest.filter(e => !(e.sigma60 >= hiVol))
  for (const [s, xs] of [['top5', top], ['worst20', worst], ['highVol', vol], ['other', other]] as [Stratum, Event[]][]) for (const e of pick(xs, PER_STRATUM)) sample.push({ key, pos: e.pos, stratum: s })
}
log(`échantillon : ${sample.length} positions`)

// ---------------------------------------------------------------- fenêtres par jour
const evOf = (key: SleeveKey, pos: number) => events.filter(e => e.key === key && e.pos === pos)
const wins = new Map<string, [number, number][]>()
const addWin = (key: SleeveKey, a: number, b: number) => {
  for (let d = Math.floor(a / 864e5); d <= Math.floor(b / 864e5); d++) {
    const id = `${key}|${isoDay(d * 864e5)}`
    if (!wins.has(id)) wins.set(id, [])
    wins.get(id)!.push([a, b])
  }
}
for (const s of sample) for (const e of evOf(s.key, s.pos)) {
  if (e.family === 'entry' || e.family === 'close') addWin(s.key, e.t - 30 * 60000, e.t + 16 * 60000)
  else addWin(s.key, e.t - 5 * 60000, e.t + 3 * 60000)
}
log(`${wins.size} jours aggTrades à lire`)

const trades = new Map<string, Trades>()
const integrity: TradesIntegrity[] = []
let k = 0
for (const [id, ws] of wins) {
  const [key, day] = id.split('|') as [SleeveKey, string]
  const { tr, integrity: it } = await loadTradesWindows(SYM[key], day, ws)
  integrity.push(it)
  const prev = trades.get(key)
  trades.set(key, prev ? merge(prev, tr) : tr)
  if (++k % 10 === 0) log(`  ${k}/${wins.size} jours`)
}
function merge(a: Trades, b: Trades): Trades {
  const n = a.t.length + b.t.length
  const idx = Array.from({ length: n }, (_, i) => i).sort((i, j) => (i < a.t.length ? a.t[i] : b.t[i - a.t.length]) - (j < a.t.length ? a.t[j] : b.t[j - a.t.length]))
  const get = (arr: 't' | 'px' | 'qty', i: number) => (i < a.t.length ? a[arr][i] : b[arr][i - a.t.length])
  return { t: Float64Array.from(idx, i => get('t', i)), px: Float64Array.from(idx, i => get('px', i)), qty: Float64Array.from(idx, i => get('qty', i)), buy: Uint8Array.from(idx, i => (i < a.t.length ? a.buy[i] : b.buy[i - a.t.length])) }
}

// ---------------------------------------------------------------- mesures
const lastAtOrBefore = (tr: Trades, t: number) => { let lo = 0, hi = tr.t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (tr.t[md] <= t) lo = md + 1; else hi = md } return lo - 1 }
const firstAfter = (tr: Trades, t: number) => { let lo = 0, hi = tr.t.length; while (lo < hi) { const md = (lo + hi) >> 1; if (tr.t[md] < t) lo = md + 1; else hi = md } return lo }

interface PilotRow {
  key: SleeveKey; stratum: Stratum; family: string
  drift: number[]; driftVwap: number[]; volume: number[]
  halfSpread: number; klineDrift1m: number; tradeDrift1m: number; refGap: number
  stopFound?: boolean; stopChase?: number[]
}
const rows: PilotRow[] = []
for (const s of sample) {
  const tr = trades.get(s.key)!
  for (const e of evOf(s.key, s.pos)) {
    if (e.family === 'entry' || e.family === 'close') {
      const i0 = lastAtOrBefore(tr, e.t - 1)
      if (i0 < 0) continue
      const P0 = tr.px[i0]
      const drift = PILOT_S.map(sec => { const i = lastAtOrBefore(tr, e.t + sec * 1000); return e.side * (tr.px[i] / P0 - 1) })
      const vw = PILOT_S.map(sec => {
        let qv = 0, v = 0
        for (let i = firstAfter(tr, e.t); i < tr.t.length && tr.t[i] <= e.t + sec * 1000; i++) { qv += tr.px[i] * tr.qty[i]; v += tr.qty[i] }
        return { d: v > 0 ? e.side * (qv / v / P0 - 1) : NaN, usd: qv }
      })
      // Demi-spread : secondes avec achats et ventes agresseurs, dans les 30 min avant la décision.
      const sec = new Map<number, { b: number; bq: number; s: number; sq: number }>()
      for (let i = firstAfter(tr, e.t - 30 * 60000); i < tr.t.length && tr.t[i] < e.t; i++) {
        const key = Math.floor(tr.t[i] / 1000)
        const x = sec.get(key) ?? { b: 0, bq: 0, s: 0, sq: 0 }
        if (tr.buy[i]) { x.b += tr.px[i] * tr.qty[i]; x.bq += tr.qty[i] } else { x.s += tr.px[i] * tr.qty[i]; x.sq += tr.qty[i] }
        sec.set(key, x)
      }
      const hs = [...sec.values()].filter(x => x.bq > 0 && x.sq > 0).map(x => { const pb = x.b / x.bq, ps = x.s / x.sq; return (pb - ps) / 2 / ((pb + ps) / 2) })
      rows.push({
        key: s.key, stratum: s.stratum, family: e.family, drift, driftVwap: vw.map(x => x.d), volume: vw.map(x => x.usd),
        halfSpread: hs.length ? q(hs, 0.5) : NaN, klineDrift1m: e.drift[0], tradeDrift1m: drift[PILOT_S.indexOf(60)], refGap: P0 / e.ref - 1,
      })
    } else if (e.family === 'stop' && e.located) {
      const L = e.ref
      let i = firstAfter(tr, e.t)
      while (i < tr.t.length && tr.t[i] < e.t + 60000 && !(e.side === -1 ? tr.px[i] <= L : tr.px[i] >= L)) i++
      const found = i < tr.t.length && tr.t[i] < e.t + 60000
      const tt = found ? tr.t[i] : NaN
      rows.push({
        key: s.key, stratum: s.stratum, family: 'stop', drift: [], driftVwap: [], volume: [], halfSpread: NaN, klineDrift1m: NaN, tradeDrift1m: NaN, refGap: NaN,
        stopFound: found, stopChase: found ? STOP_S.map(sc => { const j = lastAtOrBefore(tr, tt + sc * 1000); return e.side * (tr.px[j] / L - 1) }) : undefined,
      })
    }
  }
}

// ---------------------------------------------------------------- agrégats
const bootCI = (xs: number[], nRep = 2000) => {
  const r = P.rng(SEED + 1), means: number[] = []
  for (let k = 0; k < nRep; k++) { let s = 0; for (let j = 0; j < xs.length; j++) s += xs[Math.floor(r() * xs.length)]; means.push(s / xs.length) }
  return { mean: P.mean(xs), median: q(xs, 0.5), lo: q(means, 0.025), hi: q(means, 0.975), n: xs.length }
}
const bps = (o: { mean: number; median: number; lo: number; hi: number; n: number }) => ({ mean: o.mean * 1e4, median: o.median * 1e4, lo: o.lo * 1e4, hi: o.hi * 1e4, n: o.n })
const entries = rows.filter(r => r.family === 'entry')
const decay = Object.fromEntries((['all', 'btc', 'ethusdt'] as const).map(g => {
  const xs = entries.filter(r => g === 'all' || r.key === g)
  return [g, Object.fromEntries(PILOT_S.map((s, j) => [`${s}s`, { last: bps(bootCI(xs.map(r => r.drift[j]).filter(Number.isFinite))), vwap: bps(bootCI(xs.map(r => r.driftVwap[j]).filter(Number.isFinite))) }]))]
}))
const byStratum = Object.fromEntries((['top5', 'worst20', 'highVol', 'other'] as Stratum[]).map(st => {
  const xs = entries.filter(r => r.stratum === st)
  return [st, Object.fromEntries(PILOT_S.map((s, j) => [`${s}s`, bps(bootCI(xs.map(r => r.drift[j]).filter(Number.isFinite)))]))]
}))
const stops = rows.filter(r => r.family === 'stop')
const stopChase = Object.fromEntries(STOP_S.map((s, j) => [`${s}s`, bps(bootCI(stops.filter(r => r.stopFound).map(r => r.stopChase![j])))]))
const halfSpread = Object.fromEntries((['btc', 'ethusdt'] as SleeveKey[]).map(k2 => [NAMES[k2], { medianBps: q(entries.filter(r => r.key === k2).map(r => r.halfSpread).filter(Number.isFinite), 0.5) * 1e4, p90Bps: q(entries.filter(r => r.key === k2).map(r => r.halfSpread).filter(Number.isFinite), 0.9) * 1e4 }]))
const volume = Object.fromEntries(PILOT_S.map((s, j) => [`${s}s`, { medianUsd: q(entries.map(r => r.volume[j]), 0.5), p10Usd: q(entries.map(r => r.volume[j]), 0.1) }]))
const cons = entries.filter(r => Number.isFinite(r.klineDrift1m) && Number.isFinite(r.tradeDrift1m))
const consistency = { n: cons.length, maxAbsGapBps: Math.max(...cons.map(r => Math.abs(r.klineDrift1m - r.tradeDrift1m))) * 1e4, maxRefGapBps: Math.max(...cons.map(r => Math.abs(r.refGap))) * 1e4 }
const integ = { days: integrity.length, rows: integrity.reduce((a, x) => a + x.rows, 0), idGaps: integrity.reduce((a, x) => a + x.idGaps, 0), outOfOrder: integrity.reduce((a, x) => a + x.outOfOrder, 0), daysWithIdGaps: integrity.filter(x => x.idGaps > 0).map(x => x.day) }

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'p1-pilot.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), prespec: 'research/preregistration/capacity-p0p1.md § 8', seed: SEED,
  sample: { positions: sample.length, perStratum: PER_STRATUM, entries: entries.length, closes: rows.filter(r => r.family === 'close').length, stops: stops.length, stopsFound: stops.filter(r => r.stopFound).length },
  integrity: integ, consistency, halfSpread, decay, byStratum, stopChase, volume,
}, null, 1))
log(`pilote : ${entries.length} entrées, ${stops.length} stops (${stops.filter(r => r.stopFound).length} déclenchements trouvés), ${integ.days} jours, ${integ.rows} trades lus, trous d'identifiants ${integ.idGaps}`)
for (const [g, d] of Object.entries(decay)) process.stderr.write(`dérive ${g} : ${Object.entries(d).map(([h, x]) => `${h} ${x.last.mean.toFixed(1)} pb [${x.last.lo.toFixed(1)} ; ${x.last.hi.toFixed(1)}]`).join(' · ')}\n`)
process.stderr.write(`poursuite après stop : ${Object.entries(stopChase).map(([h, x]) => `${h} ${x.mean.toFixed(1)} pb [${x.lo.toFixed(1)} ; ${x.hi.toFixed(1)}] n=${x.n}`).join(' · ')}\n`)
process.stderr.write(`demi-spread : ${JSON.stringify(halfSpread)}\ncohérence bougies / trades : ${JSON.stringify(consistency)}\n`)
