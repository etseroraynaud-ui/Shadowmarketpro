// P1 de l'étude de capacité : courbe de capacité du Shock Engine (research/preregistration/capacity-p0p1.md, § 6.4 à 7).
//
// Pour chaque capital A (100 k$ à 5 M$, et une grille fine de 50 k$ à 100 M$) et chaque scénario
// d'impact, coût de chaque exécution de la fenêtre Binance (2020-01 → 2026-09), en points de base,
// hors commission (déjà dans le backtest) :
//   coût = demi-spread (mesuré, pilote) + impact (loi en racine carrée, Y du scénario, NON calibrée)
//        + dérive (mesurée trade par trade sur le perpétuel, exécution POV 10 % ; entrées et sorties à
//          la clôture) [+ poursuite après stop mesurée, scénario prudent].
// Puis Sharpe, CAGR, Sortino, drawdown nets du portefeuille, intervalles par bootstrap mensuel, et
// capital où chaque critère est atteint. Les limites de liquidité observables sont rapportées à part,
// sans être converties en coûts.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/capacity.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { BINANCE_START, KEYS, NAMES, OUT, crossing, loadPublished, monthDraws, netDaily, portfolio, q, sleeveDaily, statsOf, windowOf } from './lib.ts'
import type { Family, Fill, Run, SleeveKey, Stats } from './lib.ts'
import { buildEvents } from './events.ts'
import type { Event } from './events.ts'
import { loadDepth } from './binance.ts'
import { DEPTH_FROM, DEPTH_TO } from './data.ts'

const NREP = 2000
const NAMED = [100e3, 250e3, 500e3, 1e6, 5e6]
const FINE = Array.from({ length: 30 }, (_, k) => 50e3 * Math.pow(100e6 / 50e3, k / 29))
const GRID = [...new Set([...NAMED, ...FINE])].sort((a, b) => a - b)
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ---------------------------------------------------------------- entrées
const { events, runs } = await buildEvents()
const S = loadPublished()
const W = windowOf(S, 'binance', BINANCE_START)
const base = { btc: sleeveDaily(runs.btc, W), ethusdt: sleeveDaily(runs.ethusdt, W) }
const baseStats = statsOf(portfolio(base.btc, base.ethusdt), W.days)
const pilot = JSON.parse(readFileSync(join(OUT, 'p1-pilot.json'), 'utf8'))
const pilotRandom = JSON.parse(readFileSync(join(OUT, 'p1-pilot-random.json'), 'utf8'))
const HALF_SPREAD: Record<SleeveKey, number> = { btc: pilot.halfSpread.BTC.medianBps / 1e4, ethusdt: pilot.halfSpread.ETH.medianBps / 1e4 }
const STOP_CHASE_10S = pilot.stopChase['10s'].mean / 1e4
const LATENCY_2S: Record<SleeveKey, number> = { btc: pilotRandom.results.BTC['2s'].last.meanBps / 1e4, ethusdt: pilotRandom.results.ETH['2s'].last.meanBps / 1e4 }
log(`événements ${events.length}, Sharpe de base ${baseStats.sharpe.toFixed(4)} ; demi-spread BTC ${(HALF_SPREAD.btc * 1e4).toFixed(3)} pb, ETH ${(HALF_SPREAD.ethusdt * 1e4).toFixed(3)} pb ; poursuite après stop à 10 s ${(STOP_CHASE_10S * 1e4).toFixed(1)} pb`)

// ---------------------------------------------------------------- modèle de coût
interface Scenario { name: string; Y: number; sigma: 'h24' | 'max'; tp1Paid: boolean; stopChase: boolean | 'perTrade' }
const SCENARIOS: Scenario[] = [
  { name: 'optimistic', Y: 0.5, sigma: 'h24', tp1Paid: false, stopChase: false },
  { name: 'central', Y: 1.0, sigma: 'h24', tp1Paid: false, stopChase: false },
  { name: 'prudent', Y: 2.0, sigma: 'max', tp1Paid: true, stopChase: true },
]
type Policy = { name: string; kind: 'pov'; rho: number } | { name: string; kind: 'immediate' } | { name: string; kind: 'latency' }
const MAIN: Policy = { name: 'pov10', kind: 'pov', rho: 0.1 }
const SENS: Policy[] = [{ name: 'pov5', kind: 'pov', rho: 0.05 }, { name: 'pov20', kind: 'pov', rho: 0.2 }, { name: 'immediate', kind: 'immediate' }, { name: 'latency2s', kind: 'latency' }]

interface Cost { total: number; spread: number; impact: number; drift: number; chase: number; minutes: number; limited: boolean; imputed: boolean }
function costOf(e: Event, A: number, sc: Scenario, pol: Policy): Cost | null {
  const Q = e.frac * A / 2
  const hs = HALF_SPREAD[e.key]
  const sigma = sc.sigma === 'max' ? Math.max(e.sigma24, e.sigma60) : e.sigma24
  if (!(sigma > 0) || !(e.v24 > 0) || !Number.isFinite(e.ref)) return null
  const impact = sc.Y * sigma * Math.sqrt(Q / e.v24)
  const zero = { spread: 0, impact: 0, drift: 0, chase: 0, minutes: 0, limited: false, imputed: false }
  if (e.family === 'entry' || e.family === 'close') {
    let drift = 0, minutes = 0, limited = false
    if (pol.kind === 'pov') {
      const need = Q / pol.rho
      let k = 1
      while (k < e.cum.length - 1 && e.cum[k] < need) k++
      if (e.cum[k] < need) limited = true
      minutes = k
      drift = e.cumV[k] > 0 ? e.side * (e.cum[k] / e.cumV[k] / e.ref - 1) : NaN
    } else if (pol.kind === 'latency') drift = LATENCY_2S[e.key]
    if (!Number.isFinite(drift)) return null
    return { ...zero, total: hs + impact + drift, spread: hs, impact, drift, minutes, limited }
  }
  if (!e.located) return null
  if (e.family === 'stop') {
    // Poursuite : moyenne du pilote à 10 s (pré-enregistré), ou mesure propre au trade jusqu'à la fin de la minute du déclenchement (exploratoire).
    const chase = sc.stopChase === 'perTrade' ? (Number.isFinite(e.drift[0]) ? e.drift[0] : 0) : sc.stopChase ? STOP_CHASE_10S : 0
    return { ...zero, total: hs + impact + chase, spread: hs, impact, chase }
  }
  return sc.tp1Paid ? { ...zero, total: hs + impact, spread: hs, impact } : { ...zero, total: 0 }
}

/** Coûts de toutes les exécutions ; valeurs manquantes : médiane de l'actif, de la famille et du niveau. */
function costsFor(A: number, sc: Scenario, pol: Policy): Map<string, Cost> {
  const out = new Map<string, Cost>()
  const missing: Event[] = []
  for (const e of events) { const c = costOf(e, A, sc, pol); if (c) out.set(`${e.key}:${e.fi}`, c); else missing.push(e) }
  for (const e of missing) {
    const same = events.filter(x => x.key === e.key && x.family === e.family && out.has(`${x.key}:${x.fi}`)).map(x => out.get(`${x.key}:${x.fi}`)!)
    const pick = (f: keyof Cost) => q(same.map(c => c[f] as number), 0.5)
    out.set(`${e.key}:${e.fi}`, { total: pick('total'), spread: pick('spread'), impact: pick('impact'), drift: pick('drift'), chase: pick('chase'), minutes: pick('minutes'), limited: false, imputed: true })
  }
  return out
}

function netOf(costs: Map<string, Cost>) {
  const nd = (k: SleeveKey) => netDaily(runs[k], W, base[k], (f: Fill) => costs.get(`${k}:${runs[k].fills.indexOf(f)}`)?.total ?? 0)
  return { rb: nd('btc'), re: nd('ethusdt') }
}

// Indices des exécutions : netDaily passe chaque Fill ; on évite indexOf (lent) par une table.
const fiOf = new Map<Fill, number>()
for (const k of KEYS) runs[k].fills.forEach((f, i) => fiOf.set(f, i))
function netFast(costs: Map<string, Cost>) {
  const nd = (k: SleeveKey) => netDaily(runs[k], W, base[k], (f: Fill) => costs.get(`${k}:${fiOf.get(f)}`)?.total ?? 0)
  return { rb: nd('btc'), re: nd('ethusdt') }
}
void netOf

const md = monthDraws(W.days, NREP)
function bootStats(rb: number[], re: number[]) {
  const sh = new Float64Array(NREP), cg = new Float64Array(NREP)
  for (let rep = 0; rep < NREP; rep++) {
    let a = 50, b = 50, prev = 100, s = 0, s2 = 0, n = 0
    for (const j of md.draws[rep]) for (const i of md.blocks[j]) { a *= 1 + rb[i]; b *= 1 + re[i]; const v = a + b, x = v / prev - 1; prev = v; s += x; s2 += x * x; n++ }
    const mu = s / n, sd = Math.sqrt(Math.max(s2 / n - mu * mu, 0))
    sh[rep] = sd > 0 ? (mu / sd) * Math.sqrt(P.ANN) : 0
    cg[rep] = Math.pow(prev / 100, P.ANN / n) - 1
  }
  return { sharpe: { p5: q(sh, 0.05), p50: q(sh, 0.5), p95: q(sh, 0.95) }, cagr: { p5: q(cg, 0.05), p50: q(cg, 0.5), p95: q(cg, 0.95) } }
}

// ---------------------------------------------------------------- courbes
interface Point { A: number; stats: Stats; boot: ReturnType<typeof bootStats>; costBps: Record<Family, number> & { all: number }; dragPctYr: number; imputed: number; limitedEntries: number }
const meanCost = (costs: Map<string, Cost>, fam?: Family, field: keyof Cost = 'total') => {
  let s = 0, w = 0
  for (const e of events) { if (fam && e.family !== fam) continue; const c = costs.get(`${e.key}:${e.fi}`)!; s += (c[field] as number) * e.frac; w += e.frac }
  return (s / w) * 1e4
}
function pointOf(A: number, sc: Scenario, pol: Policy): Point {
  const costs = costsFor(A, sc, pol)
  const { rb, re } = netFast(costs)
  const r = portfolio(rb, re)
  const stats = statsOf(r, W.days)
  // Frein annuel : Σ coût × nominal / equity, rapporté au nombre d'années (sleeves pondérées 1/2).
  let drag = 0
  for (const k of KEYS) for (const e of events.filter(x => x.key === k)) { const f = runs[k].fills[e.fi]; drag += 0.5 * costs.get(`${k}:${e.fi}`)!.total * f.notional / f.eqBefore }
  return {
    A, stats, boot: bootStats(rb, re),
    costBps: { all: meanCost(costs), entry: meanCost(costs, 'entry'), stop: meanCost(costs, 'stop'), tp1: meanCost(costs, 'tp1'), close: meanCost(costs, 'close') },
    dragPctYr: drag / (W.days.length / P.ANN),
    imputed: [...costs.values()].filter(c => c.imputed).length,
    limitedEntries: events.filter(e => e.family === 'entry' && costs.get(`${e.key}:${e.fi}`)!.limited).length,
  }
}

const curves: Record<string, Point[]> = {}
for (const sc of SCENARIOS) { curves[sc.name] = GRID.map(A => pointOf(A, sc, MAIN)); log(`scénario ${sc.name}`) }
const sens: Record<string, Record<string, Point[]>> = {}
for (const pol of SENS) { sens[pol.name] = {}; for (const sc of SCENARIOS) sens[pol.name][sc.name] = NAMED.map(A => pointOf(A, sc, pol)) }
// Exploratoire (ajouté après lecture du pilote) : scénario prudent dont la poursuite après stop est
// mesurée trade par trade sur tout l'échantillon (bougies 1 min) au lieu de la moyenne du pilote stratifié.
const PRUDENT_PER_TRADE: Scenario = { ...SCENARIOS[2], name: 'prudentPerTradeChase', stopChase: 'perTrade' }
const exploratory = { prudentPerTradeChase: GRID.map(A => pointOf(A, PRUDENT_PER_TRADE, MAIN)), latency2s: Object.fromEntries(SCENARIOS.map(sc => [sc.name, GRID.map(A => pointOf(A, sc, SENS[3]))])) }
log('sensibilités')

// Seuils (§ 7) : point, et capital où les bornes à 90 % franchissent le seuil.
const thresholds = Object.fromEntries(SCENARIOS.map(sc => {
  const pts = curves[sc.name], A = pts.map(p => p.A)
  const at = (level: number, sel: (p: Point) => number) => crossing(A, pts.map(sel), level, true)
  return [sc.name, {
    C1_sharpe15: { point: at(1.5, p => p.stats.sharpe), fromLowerBound: at(1.5, p => p.boot.sharpe.p5), fromUpperBound: at(1.5, p => p.boot.sharpe.p95) },
    C2_sharpe10: { point: at(1.0, p => p.stats.sharpe), fromLowerBound: at(1.0, p => p.boot.sharpe.p5), fromUpperBound: at(1.0, p => p.boot.sharpe.p95) },
    C3_edgeLost: { lowerBoundAtZero: at(0, p => p.boot.sharpe.p5), medianAtZero: at(0, p => p.boot.sharpe.p50), pointAtZero: at(0, p => p.stats.sharpe) },
  }]
}))

// ---------------------------------------------------------------- limites de liquidité observables
const shareOf = (xs: boolean[]) => xs.filter(Boolean).length / xs.length
const sigma60p95: Record<SleeveKey, number> = { btc: q(events.filter(e => e.key === 'btc').map(e => e.sigma60).filter(Number.isFinite), 0.95), ethusdt: q(events.filter(e => e.key === 'ethusdt').map(e => e.sigma60).filter(Number.isFinite), 0.95) }
const isShock = (e: Event) => e.sigma60 >= sigma60p95[e.key] || (Number.isFinite(e.depth1) && Number.isFinite(e.depth1Median7d) && e.depth1 < 0.5 * e.depth1Median7d)
const liquidity = NAMED.map(A => {
  const Q = (e: Event) => e.frac * A / 2
  const ent = events.filter(e => e.family === 'entry')
  const minutesAt = (e: Event, rho: number) => { const need = Q(e) / rho; let k = 1; while (k < e.cum.length - 1 && e.cum[k] < need) k++; return e.cum[k] >= need ? k : Infinity }
  const tau = ent.map(e => minutesAt(e, 0.1))
  const stops = events.filter(e => e.family === 'stop' && e.located)
  const withDepth = events.filter(e => (e.family === 'entry' || e.family === 'stop') && Number.isFinite(e.depth1) && e.depth1 > 0)
  const shock = withDepth.filter(isShock)
  return {
    A,
    entries: {
      n: ent.length,
      participation1mOver10: shareOf(ent.map(e => Q(e) > 0.1 * e.cum[1])), participation1mOver25: shareOf(ent.map(e => Q(e) > 0.25 * e.cum[1])),
      participation5mOver10: shareOf(ent.map(e => Q(e) > 0.1 * e.cum[5])),
      pov10MinutesMedian: q(tau.filter(Number.isFinite), 0.5), pov10MinutesP90: q(tau.map(x => (Number.isFinite(x) ? x : 61)), 0.9),
      pov10Over15min: shareOf(tau.map(x => x > 15)), pov10Over60min: shareOf(tau.map(x => !Number.isFinite(x))),
    },
    stops: { n: stops.length, triggerMinuteOver10: shareOf(stops.map(e => Q(e) > 0.1 * e.cum[1])), triggerMinuteOver25: shareOf(stops.map(e => Q(e) > 0.25 * e.cum[1])), triggerMinuteOver100: shareOf(stops.map(e => Q(e) > e.cum[1])) },
    depth: {
      n: withDepth.length, note: 'aggregate ±1 % depth on the consumed side; a liquidity indicator, never a cost in bp',
      over10: shareOf(withDepth.map(e => Q(e) > 0.1 * e.depth1)), over50: shareOf(withDepth.map(e => Q(e) > 0.5 * e.depth1)), medianRatio: q(withDepth.map(e => Q(e) / e.depth1), 0.5),
      shock: { n: shock.length, over10: shock.length ? shareOf(shock.map(e => Q(e) > 0.1 * e.depth1)) : NaN, medianRatio: shock.length ? q(shock.map(e => Q(e) / e.depth1), 0.5) : NaN },
    },
  }
})

// Chocs : coût central à 1 M$ et 5 M$, exécutions en choc contre les autres.
const shockCost = Object.fromEntries([1e6, 5e6].map(A => {
  const costs = costsFor(A, SCENARIOS[1], MAIN)
  const fam = (f: Family, sh: boolean) => { const xs = events.filter(e => e.family === f && isShock(e) === sh); return { n: xs.length, meanBps: P.mean(xs.map(e => costs.get(`${e.key}:${e.fi}`)!.total)) * 1e4 } }
  return [String(A), { entry: { shock: fam('entry', true), normal: fam('entry', false) }, stop: { shock: fam('stop', true), normal: fam('stop', false) } }]
}))

// Jours de marché où la profondeur à ±1 % s'effondre (minimum du jour / médiane des 7 jours précédents).
const lowDepthDays: Record<string, { day: string; ratio: number }[]> = {}
for (const k of KEYS) {
  const { d } = await loadDepth(k === 'btc' ? 'BTCUSDT' : 'ETHUSDT', DEPTH_FROM, DEPTH_TO)
  const byDay = new Map<number, number[]>()
  for (let i = 0; i < d.t.length; i++) { const day = Math.floor(d.t[i] / 864e5); const x = d.bid1[i] + d.ask1[i]; if (!byDay.has(day)) byDay.set(day, []); byDay.get(day)!.push(x) }
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const med = new Map(days.map(day => [day, q(byDay.get(day)!, 0.5)]))
  const rows: { day: string; ratio: number }[] = []
  for (const day of days) {
    const prev = days.filter(x => x < day && x >= day - 7).map(x => med.get(x)!)
    if (prev.length < 5) continue
    rows.push({ day: P.isoDay(day), ratio: Math.min(...byDay.get(day)!) / q(prev, 0.5) })
  }
  lowDepthDays[NAMES[k]] = rows.sort((a, b) => a.ratio - b.ratio).slice(0, 12)
}
log('liquidité et chocs')

// ---------------------------------------------------------------- décomposition des coûts (scénario central)
const decomposition = NAMED.map(A => {
  const costs = costsFor(A, SCENARIOS[1], MAIN)
  return { A, ...Object.fromEntries((['entry', 'stop', 'tp1', 'close'] as Family[]).map(f => [f, { spread: meanCost(costs, f, 'spread'), impact: meanCost(costs, f, 'impact'), drift: meanCost(costs, f, 'drift'), total: meanCost(costs, f) }])) }
})

const slim = (p: Point) => ({ A: p.A, sharpe: p.stats.sharpe, cagr: p.stats.cagr, sortino: p.stats.sortino, maxDD: p.stats.maxDD, calmar: p.stats.calmar, sharpeP5: p.boot.sharpe.p5, sharpeP50: p.boot.sharpe.p50, sharpeP95: p.boot.sharpe.p95, cagrP5: p.boot.cagr.p5, cagrP95: p.boot.cagr.p95, costBps: p.costBps, dragPctYr: p.dragPctYr, imputed: p.imputed, limitedEntries: p.limitedEntries })
writeFileSync(join(OUT, 'p1-capacity.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), prespec: 'research/preregistration/capacity-p0p1.md', nRep: NREP,
  window: { from: P.isoDay(W.days[0]), to: P.isoDay(W.days[W.days.length - 1]), days: W.days.length },
  baseline: baseStats, inputs: { halfSpreadBps: { BTC: HALF_SPREAD.btc * 1e4, ETH: HALF_SPREAD.ethusdt * 1e4 }, stopChase10sBps: STOP_CHASE_10S * 1e4, latency2sBps: { BTC: LATENCY_2S.btc * 1e4, ETH: LATENCY_2S.ethusdt * 1e4 } },
  scenarios: SCENARIOS, mainPolicy: MAIN, sensitivities: SENS.map(p => p.name),
  curves: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, v.map(slim)])),
  named: Object.fromEntries(Object.entries(curves).map(([k, v]) => [k, v.filter(p => NAMED.includes(p.A)).map(slim)])),
  sensitivity: Object.fromEntries(Object.entries(sens).map(([pol, by]) => [pol, Object.fromEntries(Object.entries(by).map(([sc, pts]) => [sc, pts.map(slim)]))])),
  thresholds, liquidity, shockCost, lowDepthDays, decomposition,
  exploratory: {
    note: 'added after reading the pre-registered pilot; not pre-registered',
    prudentPerTradeChase: exploratory.prudentPerTradeChase.map(slim),
    latency2s: Object.fromEntries(Object.entries(exploratory.latency2s).map(([k, v]) => [k, v.map(slim)])),
    thresholds: Object.fromEntries([['prudentPerTradeChase', exploratory.prudentPerTradeChase], ...Object.entries(exploratory.latency2s).map(([k, v]) => [`latency2s_${k}`, v])].map(([name, pts]) => {
      const ps = pts as Point[], A = ps.map(p => p.A), at = (lv: number, sel: (p: Point) => number) => crossing(A, ps.map(sel), lv, true)
      return [name, { C1_sharpe15: at(1.5, p => p.stats.sharpe), C2_sharpe10: at(1.0, p => p.stats.sharpe), C3_lowerBoundAtZero: at(0, p => p.boot.sharpe.p5) }]
    })),
  },
  driftVwapVsLast1m: Object.fromEntries(KEYS.map(k => { const e = events.filter(x => x.key === k && x.family === 'entry'); return [NAMES[k], { vwapBps: P.mean(e.map(x => x.driftVwap[0]).filter(Number.isFinite)) * 1e4, lastBps: P.mean(e.map(x => x.drift[0]).filter(Number.isFinite)) * 1e4 }] })),
  counts: { events: events.length, byFamily: Object.fromEntries((['entry', 'stop', 'tp1', 'close'] as Family[]).map(f => [f, events.filter(e => e.family === f).length])), unlocated: events.filter(e => !e.located).length, shockEvents: events.filter(isShock).length },
}, null, 1))

// ---------------------------------------------------------------- résumé
const m$ = (A: number) => (Number.isFinite(A) ? (A >= 1e6 ? `${(A / 1e6).toFixed(2)} M$` : `${Math.round(A / 1e3)} k$`) : '> 100 M$')
process.stderr.write(`\nfenêtre ${P.isoDay(W.days[0])} → ${P.isoDay(W.days[W.days.length - 1])} · Sharpe sans coût ajouté ${baseStats.sharpe.toFixed(2)}, CAGR ${(baseStats.cagr * 100).toFixed(1)} %\n`)
for (const sc of SCENARIOS) {
  process.stderr.write(`\n${sc.name} (Y = ${sc.Y})\n`)
  for (const p of curves[sc.name].filter(x => NAMED.includes(x.A))) process.stderr.write(`  ${m$(p.A).padStart(8)} : coût moyen ${p.costBps.all.toFixed(1)} pb (entrée ${p.costBps.entry.toFixed(1)}, stop ${p.costBps.stop.toFixed(1)}) · Sharpe ${p.stats.sharpe.toFixed(2)} [${p.boot.sharpe.p5.toFixed(2)} ; ${p.boot.sharpe.p95.toFixed(2)}] · CAGR ${(p.stats.cagr * 100).toFixed(1)} % · frein ${(p.dragPctYr * 100).toFixed(1)} %/an\n`)
  const t = thresholds[sc.name]
  process.stderr.write(`  Sharpe < 1,5 dès ${m$(t.C1_sharpe15.point)} [${m$(t.C1_sharpe15.fromLowerBound)} ; ${m$(t.C1_sharpe15.fromUpperBound)}] · < 1,0 dès ${m$(t.C2_sharpe10.point)} [${m$(t.C2_sharpe10.fromLowerBound)} ; ${m$(t.C2_sharpe10.fromUpperBound)}] · avantage statistique perdu (borne basse ≤ 0) dès ${m$(t.C3_edgeLost.lowerBoundAtZero)}\n`)
}
for (const L of liquidity) process.stderr.write(`liquidité ${m$(L.A)} : entrées POV 10 % médiane ${L.entries.pov10MinutesMedian} min, > 15 min ${(L.entries.pov10Over15min * 100).toFixed(1)} % ; stops > 10 % de la minute ${(L.stops.triggerMinuteOver10 * 100).toFixed(1)} % ; Q > 10 % de la profondeur ±1 % : ${(L.depth.over10 * 100).toFixed(1)} %\n`)
