// Test zéro-shot du Shock Engine sur un autre actif : la stratégie figée, sans aucune variable
// ajoutée ni aucun réglage réestimé, appliquée telle quelle. Question posée : le phénomène
// « choc → continuation » existe-t-il hors de BTC ?
//
//   node research/shock/zero-shot.ts --asset xauusd [--file chemin.csv(.gz)] [--draws 200]
//   node research/shock/zero-shot.ts --asset btc            (témoin : mêmes calculs sur BTC)
//
// Fichiers attendus : sortie CSV de dukascopy-node (timestamp ms UTC, open, high, low, close,
// volume), 15 min, éventuellement compressée (.gz), par défaut research/data/<actif>_15m.csv.gz.
//
// Ce qui est figé : toute la logique d'entrée, de sortie et de risque du préréglage du bot (choisi
// sur BTC), en deux versions d'entrée : complète, et « cœur » (choc + cassure + bougie + tendance
// 60 min, sans volume ni lambda), qui ne dépend pas du volume (sur l'or au comptant, un simple
// nombre de ticks). Les valeurs d'origine du script ne servent pas de référence : elles perdent
// déjà sur BTC (Sharpe −1,6, frais) ; décision prise sur le témoin BTC, avant tout autre actif.
// Seule mesure ajoutée, déclarée avant le test : la première bougie après une fermeture du marché
// (week-end, pause quotidienne, jour férié, bougies manquantes) ne déclenche pas d'entrée — son
// rendement est un saut d'ouverture, pas un choc. Les positions restent exposées à ces sauts.
// Régime de volatilité : jours de séance clos à 22 h UTC (après la clôture des marchés américains
// des matières premières), comptés comme clos à minuit UTC suivant, donc jamais en avance.
//
// Lectures :
// 1. Étude d'événement : rendement après chaque événement, en ATR, dans le sens de l'événement,
//    moins le rendement moyen des bougies de la même année à la même heure (instants aléatoires
//    appariés). Événements : signaux d'entrée (complets, « cœur ») ; chocs bruts (|z| au-delà du
//    seuil du régime) ; chocs bruts dans le sens de la tendance 60 min. Bootstrap par mois.
// 2. Stratégie complète : coûts × 0, × 1, × 2 ; par année ; par régime ; bootstrap du Sharpe.
// 3. Entrées tirées au hasard (mêmes sorties, même nombre de trades) ; entrées décalées de
//    −2 à +4 bougies (−1 et −2 utilisent le futur : contrôle seulement).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadBtc } from '../lib/data.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import { sma, highest, lowest } from '../../lib/backtest/indicators.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Prepared } from '../../lib/strategies/shock/market.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const ASSET = opt('asset', 'xauusd')
const DRAWS = Number(opt('draws', '200'))
const DAY = 864e5
const M15 = 15 * 60000

// ---------------------------------------------------------------- actifs
interface Asset { label: string; mintick: number; slipPct: number; start: string; warm: string }
const ASSETS: Record<string, Asset> = {
  btc: { label: 'BTC/USD (Bitstamp)', mintick: 1, slipPct: 0, start: '2017-01-01', warm: '2016-01-01' },
  xauusd: { label: 'Or comptant XAU/USD (Dukascopy)', mintick: 0.01, slipPct: 0.01, start: '2013-01-01', warm: '2012-01-01' },
  lightcmdusd: { label: 'Pétrole WTI, CFD Dukascopy (LIGHT.CMD/USD)', mintick: 0.001, slipPct: 0.02, start: '2013-01-01', warm: '2012-01-01' },
}
const A = ASSETS[ASSET]
if (!A) throw new Error(`actif inconnu : ${ASSET}`)

function loadCsv(path: string): Bars {
  const raw = readFileSync(path)
  const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('latin1')
  const lines = text.split('\n')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  for (const s of lines) {
    if (!s || !/^\d/.test(s)) continue
    const p = s.split(',')
    const ts = +p[0]
    if (t.length && ts <= t[t.length - 1]) continue
    t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0))
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

/** Jours de séance clos à 22 h UTC, datés du lendemain minuit UTC (jamais vus avant leur clôture). */
function sessionDays(b: Bars): Bars {
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  let key = -1
  for (let i = 0; i < b.n; i++) {
    const k = Math.floor((b.t[i] + 2 * 3600000) / DAY)
    if (k !== key) { key = k; t.push(k * DAY); o.push(b.o[i]); h.push(b.h[i]); l.push(b.l[i]); c.push(b.c[i]); v.push(b.v[i]) }
    else { const j = t.length - 1; h[j] = Math.max(h[j], b.h[i]); l[j] = Math.min(l[j], b.l[i]); c[j] = b.c[i]; v[j] += b.v[i] }
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

let bars: Bars, daily: Bars
if (ASSET === 'btc') {
  const all = loadBtc(15)
  bars = sliceBars(all, Date.parse(A.warm), all.t[all.n - 1])
  daily = resample(loadBtc(60), DAY)
} else {
  const file = opt('file', `research/data/${ASSET}_15m.csv.gz`)
  if (!existsSync(file)) throw new Error(`fichier introuvable : ${file}`)
  const all = loadCsv(file)
  bars = sliceBars(all, Date.parse(A.warm), all.t[all.n - 1])
  daily = sessionDays(bars)
}
const n = bars.n
const { o, h, l, c, t } = bars
const idxAt = (ts: number) => { let lo = 0, hi = n; while (lo < hi) { const md = (lo + hi) >> 1; if (t[md] < ts) lo = md + 1; else hi = md } return lo }
const lo = idxAt(Date.parse(A.start)), end = n - 1
const iso = (i: number) => new Date(t[i]).toISOString().slice(0, 10)
const years = (t[end] - t[lo]) / (365.25 * DAY)

// ---------------------------------------------------------------- audit des données
const gap = new Uint8Array(n)
for (let i = 1; i < n; i++) gap[i] = t[i] - t[i - 1] > M15 ? 1 : 0
const ret = new Float64Array(n)
for (let i = 1; i < n; i++) ret[i] = Math.log(c[i] / c[i - 1])
let nGap = 0, sdIn = 0, cntIn = 0
for (let i = lo; i <= end; i++) { if (gap[i]) nGap++; else { sdIn += ret[i] ** 2; cntIn++ } }
sdIn = Math.sqrt(sdIn / cntIn)
const bigIn: { i: number; z: number }[] = [], bigGap: { i: number; z: number }[] = []
for (let i = lo; i <= end; i++) (gap[i] ? bigGap : bigIn).push({ i, z: ret[i] / sdIn })
bigIn.sort((a, b) => Math.abs(b.z) - Math.abs(a.z)); bigGap.sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
const zeroVol = (() => { let k = 0; for (let i = lo; i <= end; i++) if (!(bars.v[i] > 0)) k++; return k })()

// ---------------------------------------------------------------- stratégie figée
const COSTS = (k: number): Costs => ({ capital: 10000, qtyPct: 100, commissionPct: 0.045 * k, slippageTicks: 0, slippagePct: A.slipPct * k, mintick: A.mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 })
const m = marketFor(bars, 15, A.mintick)
const preset = adaptivePreset(15, A.mintick)
const sel = selectFor(preset, m, daily).select!
const VERSIONS = [
  { key: 'preset', label: 'préréglage du bot, entrées complètes', sets: preset.sets, select: sel as Int8Array | null },
  { key: 'core', label: 'préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)', sets: preset.sets, select: sel as Int8Array | null },
]
type Version = (typeof VERSIONS)[number]
const presetPrs = preset.sets.map(p => prepare(m, p))
const setAt = (v: Version, i: number) => (v.select ? v.select[i] : 0)
// Tendance 60 min des longs : clôture au-dessus de la moyenne 60 min et moyenne en hausse (règle du moteur).
const bullStrong = preset.sets.map((p, k) => {
  const s60 = sma(m.htf.c, p.htfEmaLen)
  const out = new Uint8Array(n)
  let kk = -1
  for (let i = 0; i < n; i++) {
    const ct = t[i] + M15
    while (kk + 1 < m.htf.n && m.htf.t[kk + 1] + 3600000 <= ct) kk++
    const prev = kk - p.htfSlopeBars >= 0 ? s60[kk - p.htfSlopeBars] : NaN
    const hv = presetPrs[k].htfVal[i]
    out[i] = c[i] > hv && hv > prev ? 1 : 0
  }
  return out
})

/** Signaux d'entrée, la bougie qui suit une fermeture exclue (option : sans ce masque). */
function signals(v: Version, mask = true) {
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = lo; i <= end; i++) {
    const e = setAt(v, i)
    if (e < 0 || (mask && gap[i])) continue
    const R = presetPrs[e], P = v.sets[e]
    if (v.key === 'preset') {
      if (P.allowLong && (R.impulseEntryLong[i] || R.fadeEntryLong[i])) long[i] = 1
      if (P.allowShort && (R.impulseEntryShort[i] || R.fadeEntryShort[i])) short[i] = 1
    } else {
      if (P.allowLong && R.impulseLong[i] && bullStrong[e][i]) long[i] = 1
      if (P.allowShort && R.impulseShort[i] && c[i] < R.htfVal[i]) short[i] = 1
    }
  }
  return { long, short }
}
const run = (v: Version, costs: Costs, ov: { long: Uint8Array; short: Uint8Array }) => simulate(m, v.sets, costs, lo, end, v.select, ov)

// ---------------------------------------------------------------- statistiques
const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN)
const sd = (xs: number[]) => { const mu = mean(xs); return Math.sqrt(mean(xs.map(x => (x - mu) ** 2))) }
const quantile = (xs: number[], q: number) => { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return NaN; const p = (s.length - 1) * q, k = Math.floor(p), f = p - k; return k + 1 < s.length ? s[k] + f * (s[k + 1] - s[k]) : s[k] }
let seed = 20261008
const rand = () => { seed = (seed + 0x6d2b79f5) >>> 0; let x = seed; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
const monthOf = (i: number) => { const d = new Date(t[i]); return d.getUTCFullYear() * 12 + d.getUTCMonth() }
const yearOf = (i: number) => new Date(t[i]).getUTCFullYear()

/** Bootstrap par mois : moyenne des valeurs regroupées par mois, mois tirés avec remise. */
function bootMean(groups: Map<number, number[]>, draws = 2000) {
  const keys = [...groups.keys()]
  const sums = keys.map(k => groups.get(k)!.reduce((s, x) => s + x, 0)), cnts = keys.map(k => groups.get(k)!.length)
  const out: number[] = []
  for (let d = 0; d < draws; d++) {
    let s = 0, c2 = 0
    for (let j = 0; j < keys.length; j++) { const k = Math.floor(rand() * keys.length); s += sums[k]; c2 += cnts[k] }
    out.push(c2 ? s / c2 : 0)
  }
  return { lo: quantile(out, 0.05), hi: quantile(out, 0.95), pPos: out.filter(x => x > 0).length / draws }
}

// ---------------------------------------------------------------- 1. étude d'événement
const HS = [1, 4, 16, 64]
const atrPreset = new Float64Array(n)
for (let i = 0; i < n; i++) { const e = sel[i]; atrPreset[i] = e >= 0 ? presetPrs[e].atr[i] : NaN }
// Mouvement moyen d'une bougie quelconque, par (année, heure du jour), en ATR.
function baseline(atr: ArrayLike<number>) {
  const out = HS.map(() => new Map<number, { s: number; k: number }>())
  for (let i = lo; i <= end; i++) {
    if (!(atr[i] > 0)) continue
    const key = yearOf(i) * 100 + Math.floor((t[i] % DAY) / M15)
    HS.forEach((hh, j) => {
      if (i + hh > end) return
      const x = (c[i + hh] - c[i]) / atr[i]
      const cell = out[j].get(key) ?? { s: 0, k: 0 }
      cell.s += x; cell.k++
      out[j].set(key, cell)
    })
  }
  return (j: number, i: number) => { const cell = out[j].get(yearOf(i) * 100 + Math.floor((t[i] % DAY) / M15)); return cell && cell.k ? cell.s / cell.k : 0 }
}
const basePreset = baseline(atrPreset)
const sPreset = preset.sets.map(p => (p.useMicroShock ? Math.min(p.kMain, p.highActivityMode ? Math.max(p.kMicro - 0.2, 0.8) : p.kMicro) : p.kMain))
interface Ev { i: number; dir: 1 | -1 }
const evSignals = (v: Version): Ev[] => { const s = signals(v); const out: Ev[] = []; for (let i = lo; i <= end; i++) { if (s.long[i]) out.push({ i, dir: 1 }); if (s.short[i]) out.push({ i, dir: -1 }) } return out }
const evShock = (trend: boolean): Ev[] => {
  const out: Ev[] = []
  for (let i = lo; i <= end; i++) {
    const e = sel[i]
    if (e < 0 || gap[i]) continue
    const z = presetPrs[e].z[i]
    if (!(Math.abs(z) > sPreset[e])) continue
    const dir = ret[i] > 0 ? 1 : -1
    if (trend) { const hv = presetPrs[e].htfVal[i]; if (!(dir === 1 ? c[i] > hv : c[i] < hv)) continue }
    out.push({ i, dir })
  }
  return out
}
const FAMILIES: { key: string; label: string; ev: Ev[]; atr: ArrayLike<number>; base: (j: number, i: number) => number }[] = [
  { key: 'sig-preset', label: 'signaux d\'entrée complets', ev: evSignals(VERSIONS[0]), atr: atrPreset, base: basePreset },
  { key: 'sig-core', label: 'signaux d\'entrée « cœur »', ev: evSignals(VERSIONS[1]), atr: atrPreset, base: basePreset },
  { key: 'shock', label: 'chocs bruts (|z| > seuil du régime)', ev: evShock(false), atr: atrPreset, base: basePreset },
  { key: 'shock-trend', label: 'chocs bruts dans le sens de la tendance 60 min', ev: evShock(true), atr: atrPreset, base: basePreset },
]
const mid = Math.floor((lo + end) / 2)
const events = FAMILIES.map(f => ({
  key: f.key, label: f.label, n: f.ev.length,
  byH: HS.map((hh, j) => {
    const raw: number[] = [], exc: number[] = []
    const byMonth = new Map<number, number[]>(), byYear = new Map<number, number[]>()
    const half: number[][] = [[], []]
    for (const { i, dir } of f.ev) {
      if (i + hh > end || !(f.atr[i] > 0)) continue
      const x = (dir * (c[i + hh] - c[i])) / f.atr[i]
      const e = x - dir * f.base(j, i)
      raw.push(x); exc.push(e)
      const mo = monthOf(i); if (!byMonth.has(mo)) byMonth.set(mo, []); byMonth.get(mo)!.push(e)
      const y = yearOf(i); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y)!.push(e)
      half[i < mid ? 0 : 1].push(e)
    }
    const b = bootMean(byMonth)
    const yr = [...byYear.values()].map(mean)
    return { h: hh, n: raw.length, raw: mean(raw), excess: mean(exc), ci: [b.lo, b.hi], pPos: b.pPos, halves: half.map(mean), yearsPos: yr.filter(x => x > 0).length / yr.length, nYears: yr.length }
  }),
}))

// ---------------------------------------------------------------- 2. stratégie complète
const dayEnds: number[] = []
for (let i = lo; i <= end; i++) if (i === end || Math.floor(t[i + 1] / DAY) !== Math.floor(t[i] / DAY)) dayEnds.push(i)
/** Sharpe des rendements journaliers et son intervalle à 90 % (bootstrap des mois). */
function bootSharpe(r: ShockResult) {
  const byMonth = new Map<number, number[]>()
  const all: number[] = []
  for (let d = 1; d < dayEnds.length; d++) {
    const x = r.equity[dayEnds[d]] / r.equity[dayEnds[d - 1]] - 1
    all.push(x)
    const mo = monthOf(dayEnds[d])
    if (!byMonth.has(mo)) byMonth.set(mo, [])
    byMonth.get(mo)!.push(x)
  }
  const keys = [...byMonth.keys()]
  const ann = Math.sqrt(all.length / years)
  const out: number[] = []
  for (let dd = 0; dd < 1000; dd++) {
    const xs: number[] = []
    for (let j = 0; j < keys.length; j++) xs.push(...byMonth.get(keys[Math.floor(rand() * keys.length)])!)
    const s = sd(xs)
    out.push(s > 0 ? (mean(xs) / s) * ann : 0)
  }
  const s = sd(all)
  return { sharpe: s > 0 ? (mean(all) / s) * ann : 0, lo: quantile(out, 0.05), hi: quantile(out, 0.95), pPos: out.filter(x => x > 0).length / out.length }
}
function stats(r: ShockResult, costs: Costs) {
  const mt = metricsOf(bars, r, lo, end)
  const ps = r.positions
  const rr = ps.map(q => q.pnl / q.equityAtEntry)
  const w = rr.filter(x => x > 0), ls = rr.filter(x => x <= 0)
  const mu = mean(rr), s = sd(rr)
  const skew = s > 0 ? mean(rr.map(x => ((x - mu) / s) ** 3)) : NaN
  const lr = rr.map(x => Math.log(1 + x)), tot = lr.reduce((a, b) => a + b, 0)
  const top5 = [...lr].sort((a, b) => b - a).slice(0, Math.max(1, Math.round(0.05 * lr.length))).reduce((a, b) => a + b, 0)
  const traded = ps.reduce((a, q) => a + q.notional, 0)
  const avgEq = mean(Array.from(r.equity.subarray(lo, end + 1)))
  const fees = ps.reduce((a, q) => a + q.fees, 0)
  const slip = (traded * 2 * costs.slippagePct) / 100
  return {
    totalReturn: mt.totalReturn, cagr: mt.cagr, sharpe: mt.sharpe, sortino: mt.sortino, pf: mt.profitFactor, dd: mt.maxDrawdown, calmar: mt.calmar,
    trades: ps.length, winRate: w.length / ps.length, avgWin: mean(w), avgLoss: mean(ls), payoff: mean(w) / -mean(ls), skew, exposure: mt.exposure,
    turnover: traded / avgEq / years, feesPct: fees / avgEq / years, slipPct: slip / avgEq / years, top5Share: tot !== 0 ? top5 / tot : NaN, meanTrade: mu,
  }
}
const yearly = (r: ShockResult) => {
  const out: { y: number; ret: number; sharpe: number; dd: number; trades: number }[] = []
  for (let y = yearOf(lo); y <= yearOf(end); y++) {
    const a = Math.max(lo, idxAt(Date.UTC(y, 0, 1))), b = Math.min(end, idxAt(Date.UTC(y + 1, 0, 1)) - 1)
    if (b - a < 96 * 20) continue
    const mt = metricsOf(bars, r, a, b)
    out.push({ y, ret: mt.totalReturn, sharpe: mt.sharpe, dd: mt.maxDrawdown, trades: mt.trades })
  }
  return out
}
const byRegime = (r: ShockResult, v: Version) => {
  const out: { set: number; dir: number; n: number; win: number; mean: number; sumLog: number }[] = []
  for (let e = 0; e < v.sets.length; e++) for (const d of [1, -1]) {
    const ps = r.positions.filter(q => q.set === e && q.dir === d)
    if (!ps.length) continue
    const rr = ps.map(q => q.pnl / q.equityAtEntry)
    out.push({ set: e, dir: d, n: ps.length, win: rr.filter(x => x > 0).length / rr.length, mean: mean(rr), sumLog: rr.reduce((a, x) => a + Math.log(1 + x), 0) })
  }
  return out
}

const strat: Record<string, unknown> = {}
const t0 = Date.now()
for (const v of VERSIONS) {
  const sig = signals(v)
  const base = run(v, COSTS(1), sig)
  const costRuns = [0, 1, 2].map(k => ({ k, s: stats(k === 1 ? base : run(v, COSTS(k), sig), COSTS(k)) }))
  const unmasked = stats(run(v, COSTS(1), signals(v, false)), COSTS(1))
  // Décalages : un signal à la bougie i donne une entrée à i + k (k < 0 : avance, utilise le futur).
  const shifts = [-2, -1, 1, 2, 4].map(k => {
    const long = new Uint8Array(n), short = new Uint8Array(n)
    for (let i = lo; i <= end; i++) { const j = i + k; if (j < lo || j > end) continue; if (sig.long[i]) long[j] = 1; if (sig.short[i]) short[j] = 1 }
    return { k, s: stats(run(v, COSTS(1), { long, short }), COSTS(1)) }
  })
  // Entrées au hasard : même sens permis, même régime, autant de trades que la stratégie.
  const pools: number[][] = v.sets.map(() => [])
  const nL = v.sets.map(() => 0), nS = v.sets.map(() => 0)
  for (let i = lo; i <= end; i++) { const e = setAt(v, i); if (e < 0 || gap[i]) continue; pools[e].push(i); nL[e] += sig.long[i]; nS[e] += sig.short[i] }
  const draw = (f: number) => {
    const long = new Uint8Array(n), short = new Uint8Array(n)
    v.sets.forEach((_, e) => {
      for (let j = 0; j < Math.round(nL[e] * f); j++) long[pools[e][Math.floor(rand() * pools[e].length)]] = 1
      for (let j = 0; j < Math.round(nS[e] * f); j++) short[pools[e][Math.floor(rand() * pools[e].length)]] = 1
    })
    return run(v, COSTS(1), { long, short })
  }
  let f = 1
  for (let it = 0; it < 4; it++) f *= base.positions.length / quantile(Array.from({ length: 4 }, () => draw(f).positions.length), 0.5)
  const rnd: number[] = [], rndTrades: number[] = []
  for (let d = 0; d < DRAWS; d++) { const r = draw(f); rnd.push(metricsOf(bars, r, lo, end).sharpe); rndTrades.push(r.positions.length) }
  const sh = costRuns[1].s.sharpe
  strat[v.key] = {
    label: v.label, costs: costRuns, unmasked, shifts, boot: bootSharpe(base), years: yearly(base), regimes: byRegime(base, v),
    random: { draws: DRAWS, trades: quantile(rndTrades, 0.5), median: quantile(rnd, 0.5), p95: quantile(rnd, 0.95), beaten: rnd.filter(x => x < sh).length / rnd.length },
  }
  process.stderr.write(`  ${v.key} : ${((Date.now() - t0) / 1000).toFixed(0)} s\n`)
}
// Achat conservé, même période.
const bhEq = dayEnds.map(i => c[i])
const bh = (() => {
  const r: number[] = []; let pk = bhEq[0], dd = 0
  for (let i = 1; i < bhEq.length; i++) { r.push(bhEq[i] / bhEq[i - 1] - 1); pk = Math.max(pk, bhEq[i]); dd = Math.min(dd, bhEq[i] / pk - 1) }
  const tot = c[end] / c[lo] - 1
  return { totalReturn: tot, cagr: Math.pow(1 + tot, 1 / years) - 1, sharpe: (mean(r) / sd(r)) * Math.sqrt(r.length / years), dd }
})()

// ---------------------------------------------------------------- verdict (critères fixés avant le test)
type S = ReturnType<typeof stats>
const strP = strat.preset as { costs: { k: number; s: S }[]; shifts: { k: number; s: S }[]; random: { beaten: number } }
const strC = strat.core as typeof strP
const evOK = (key: string) => {
  const e = events.find(x => x.key === key)!
  return [4, 16].every(hh => { const b = e.byH.find(x => x.h === hh)!; return b.ci[0] > 0 && b.halves.every(x => x > 0) && b.yearsPos >= 0.6 })
}
const stratOK = (s: typeof strP) => {
  const x1 = s.costs[1].s, d1 = s.shifts.find(x => x.k === 1)!.s
  return { pf: x1.pf > 1.1, sharpe: x1.sharpe > 0.3, random: s.random.beaten >= 0.9, delay: d1.meanTrade >= 0.5 * x1.meanTrade && x1.meanTrade > 0 }
}
const verdict = {
  eventsPreset: evOK('sig-preset'), eventsCore: evOK('sig-core'), eventsShock: evOK('shock'), eventsShockTrend: evOK('shock-trend'),
  preset: stratOK(strP), core: stratOK(strC),
}

// ---------------------------------------------------------------- rapport
const L: string[] = []
const table = (head: string[], rows: string[][]) => { L.push(`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`); for (const r of rows) L.push(`| ${r.join(' | ')} |`); L.push('') }
const sg = (x: number, d = 2) => (Number.isFinite(x) ? (x >= 0 ? '+' : '−') + Math.abs(x).toFixed(d) : '—')
const yes = (b: boolean) => (b ? 'oui' : '**non**')
L.push(
  `# Zéro-shot du Shock Engine · ${A.label}`,
  '',
  `15 min, ${iso(lo)} → ${iso(end)} (${years.toFixed(1)} ans, préchauffage depuis ${iso(0)}). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre${A.slipPct ? ` + glissement ${A.slipPct.toString().replace('.', ',')} % par ordre (données au prix acheteur)` : ''}, sans levier. Produit par \`node research/shock/zero-shot.ts --asset ${ASSET} --draws ${DRAWS}\`.`,
  '',
  '## Données',
  '',
  `- ${(end - lo + 1).toLocaleString('fr-FR')} bougies de 15 min ; ${nGap.toLocaleString('fr-FR')} suivent une fermeture (masquées pour les entrées) ; ${zeroVol.toLocaleString('fr-FR')} sans volume.`,
  `- Écart type d'un rendement 15 min hors fermetures : ${pct(sdIn, 3)}.`,
  `- Plus forts rendements 15 min **hors** fermetures (en écarts types) : ${bigIn.slice(0, 8).map(x => `${new Date(t[x.i]).toISOString().slice(0, 16).replace('T', ' ')} ${sg(x.z, 1)}`).join(' · ')}.`,
  `- Plus forts sauts **à l'ouverture** (masqués) : ${bigGap.slice(0, 6).map(x => `${new Date(t[x.i]).toISOString().slice(0, 16).replace('T', ' ')} ${sg(x.z, 1)}`).join(' · ')}.`,
  '',
  '## Verdict (critères fixés avant le test)',
  '',
)
L.push(`**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : ${yes(verdict.eventsShockTrend)}. Chocs bruts sans tendance : ${yes(verdict.eventsShock)}.`, '')
table(['critère', 'entrées complètes', 'entrées « cœur »'], [
  ['Étude d\'événement des signaux : même critère', yes(verdict.eventsPreset), yes(verdict.eventsCore)],
  ['Profit factor > 1,1 (coûts × 1)', yes(verdict.preset.pf), yes(verdict.core.pf)],
  ['Sharpe > 0,3 (coûts × 1)', yes(verdict.preset.sharpe), yes(verdict.core.sharpe)],
  ['Bat ≥ 90 % des entrées au hasard', yes(verdict.preset.random), yes(verdict.core.random)],
  ['Entrée retardée d\'une bougie : ≥ 50 % du gain moyen par trade', yes(verdict.preset.delay), yes(verdict.core.delay)],
])

L.push('## 1. Étude d\'événement', '', 'Rendement après l\'événement, en ATR de la bougie, dans le sens de l\'événement. Excès : moins le rendement moyen d\'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.', '')
for (const e of events) {
  L.push(`### ${e.label} · ${e.n.toLocaleString('fr-FR')} événements`, '')
  table(['horizon', 'événements', 'rendement brut (ATR)', 'excès (ATR)', 'intervalle 90 %', 'P(excès > 0)', '1re moitié', '2e moitié', 'années positives'], e.byH.map(b => [
    `${b.h} bougie${b.h > 1 ? 's' : ''} (${b.h * 15 >= 60 ? `${b.h / 4} h` : '15 min'})`, String(b.n), sg(b.raw, 3), sg(b.excess, 3), `${sg(b.ci[0], 3)} à ${sg(b.ci[1], 3)}`, pct(b.pPos, 0), sg(b.halves[0], 3), sg(b.halves[1], 3), `${pct(b.yearsPos, 0)} de ${b.nYears}`,
  ]))
}

L.push('## 2. Stratégie complète', '')
const rowS = (name: string, s: S) => [name, pct(s.totalReturn, 0), pct(s.cagr), num(s.sharpe), num(s.sortino), num(s.pf), pct(s.dd), num(s.calmar), String(s.trades), pct(s.winRate, 0), pct(s.avgWin, 2), pct(s.avgLoss, 2), num(s.payoff), num(s.skew), pct(s.top5Share, 0), pct(s.exposure, 0), num(s.turnover, 0) + '×', pct(s.feesPct), pct(s.slipPct)]
const headS = ['variante', 'rendement', 'CAGR', 'Sharpe', 'Sortino', 'PF', 'Max DD', 'Calmar', 'trades', 'gagnants', 'gain moyen', 'perte moyenne', 'payoff', 'skew', 'part des 5 % meilleurs', 'exposition', 'rotation / an', 'frais / an', 'glissement / an']
const rows: string[][] = []
for (const v of VERSIONS) {
  const s = strat[v.key] as typeof strP & { unmasked: S }
  for (const x of s.costs) rows.push(rowS(`${v.key} · coûts × ${x.k}`, x.s))
  rows.push(rowS(`${v.key} · coûts × 1, sans masque des ouvertures`, s.unmasked))
}
rows.push(['achat conservé', pct(bh.totalReturn, 0), pct(bh.cagr), num(bh.sharpe), '—', '—', pct(bh.dd), '—', '—', '—', '—', '—', '—', '—', '—', '100 %', '—', '—', '—'])
table(headS, rows)
for (const v of VERSIONS) {
  const s = strat[v.key] as { boot: { sharpe: number; lo: number; hi: number; pPos: number }; years: { y: number; ret: number; sharpe: number; dd: number; trades: number }[]; regimes: { set: number; dir: number; n: number; win: number; mean: number; sumLog: number }[]; random: { draws: number; trades: number; median: number; p95: number; beaten: number }; shifts: { k: number; s: S }[]; costs: { k: number; s: S }[] }
  L.push(`### ${v.label}`, '')
  L.push(`Sharpe journalier ${num(s.boot.sharpe)}, intervalle à 90 % (bootstrap des mois) ${num(s.boot.lo)} à ${num(s.boot.hi)}, P(Sharpe > 0) ${pct(s.boot.pPos, 0)}.`, '')
  table(['année', 'rendement', 'Sharpe', 'Max DD', 'trades'], s.years.map(y => [String(y.y), pct(y.ret, 0), num(y.sharpe), pct(y.dd), String(y.trades)]))
  table(['jeu', 'sens', 'trades', 'gagnants', 'moyenne par trade', 'somme (log)'], s.regimes.map(r => [v.sets.length > 1 ? (r.set ? 'agité' : 'calme') : 'unique', r.dir > 0 ? 'long' : 'short', String(r.n), pct(r.win, 0), pct(r.mean, 2), num(r.sumLog)]))
  L.push(`Entrées au hasard (${s.random.draws} tirages, mêmes sorties, ${s.random.trades} trades en médiane) : Sharpe médian ${num(s.random.median)}, 95e centile ${num(s.random.p95)} ; la stratégie en bat ${pct(s.random.beaten, 0)}.`, '')
  const x1 = s.costs[1].s
  table(['entrée', 'Sharpe', 'PF', 'trades', 'gain moyen par trade', 'part du gain moyen à l\'heure'], [
    ...s.shifts.filter(x => x.k < 0).map(x => [`${x.k} bougie${Math.abs(x.k) > 1 ? 's' : ''} (utilise le futur)`, num(x.s.sharpe), num(x.s.pf), String(x.s.trades), pct(x.s.meanTrade, 3), pct(x.s.meanTrade / x1.meanTrade, 0)]),
    ['à l\'heure', num(x1.sharpe), num(x1.pf), String(x1.trades), pct(x1.meanTrade, 3), '100 %'],
    ...s.shifts.filter(x => x.k > 0).map(x => [`+${x.k} bougie${x.k > 1 ? 's' : ''}`, num(x.s.sharpe), num(x.s.pf), String(x.s.trades), pct(x.s.meanTrade, 3), pct(x.s.meanTrade / x1.meanTrade, 0)]),
  ])
}
const out = `research/reports/shock-15m-zeroshot-${ASSET}`
writeFileSync(`${out}.md`, L.join('\n'))
writeFileSync(`${out}.json`, JSON.stringify({ asset: ASSET, label: A.label, period: [iso(lo), iso(end)], years, data: { bars: end - lo + 1, gaps: nGap, zeroVol, sd15: sdIn }, verdict, events, strategy: strat, buyHold: bh }, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)))
process.stderr.write(`écrit ${out}.md et ${out}.json en ${((Date.now() - t0) / 1000).toFixed(0)} s\n`)
