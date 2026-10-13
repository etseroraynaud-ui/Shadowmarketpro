// Étude point mort et volume directionnel 2 h / 4 h de Shock Engine V1 (research/preregistration/v1-be-volume.md).
//
//   python3 research/fade/v1/taker15.py                                                                     # volume 15 min (une fois)
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/be-volume-study.ts controls         # contrôles et données seuls
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/be-volume-study.ts                  # étude complète
//
// Lecture seule du moteur figé ; règles via la copie isolée trail-broker.ts / trail-sim.ts.
// Sortie : research/reports/shock-fade/v1-be-volume/{report.md, results.json}.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15, referenceAsset } from '../../lib/regime-er.ts'
import type { Asset } from '../../lib/regime-er.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../../lib/calm-only.ts'
import { cscv, dsr, sharpe, walkForward } from '../../lib/overfit.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import { simulateTrail } from './trail-sim.ts'
import type { TrailRun } from './trail-sim.ts'
import type { EarlyDecision, PositionRecord, TrailSpec } from './trail-broker.ts'

const MODE = process.argv[2] ?? 'run'
const ROOT = join(import.meta.dirname, '../../..')
const OUT = join(ROOT, 'research/reports/shock-fade/v1-be-volume')
const DAY = 864e5
const ANNF = Math.sqrt(P.ANN)
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const HALF = Date.parse('2022-07-01')
const B = 2000
const H2 = 2 * 3600e3, H4 = 4 * 3600e3

// ---------------------------------------------------------------- configurations (protocole, liste fermée)
interface Cfg { id: string; kind: 'base' | 'variant' | 'control' | 'diag'; label: string; beR?: number; h?: number; vol?: boolean; gain?: number; ctrl?: string }
const CFGS: Cfg[] = [
  { id: 'B0', kind: 'base', label: 'V1 inchangée' },
  { id: 'B1', kind: 'variant', label: 'point mort dès +2 R', beR: 2 },
  { id: 'B2', kind: 'variant', label: 'point mort dès +3 R', beR: 3 },
  { id: 'V1', kind: 'variant', label: '2 h : I < 0', h: H2, vol: true, ctrl: 'P1' },
  { id: 'V2', kind: 'variant', label: '4 h : I < 0', h: H4, vol: true, ctrl: 'P2' },
  { id: 'V3', kind: 'variant', label: '2 h : I < 0 et gain < +0,5 R', h: H2, vol: true, gain: 0.5, ctrl: 'P3' },
  { id: 'V4', kind: 'variant', label: '4 h : I < 0 et gain < +0,5 R', h: H4, vol: true, gain: 0.5, ctrl: 'P4' },
  { id: 'C1', kind: 'variant', label: 'point mort +3 R + V3', beR: 3, h: H2, vol: true, gain: 0.5, ctrl: 'PC1' },
  { id: 'C2', kind: 'variant', label: 'point mort +3 R + V4', beR: 3, h: H4, vol: true, gain: 0.5, ctrl: 'PC2' },
  { id: 'P1', kind: 'control', label: '2 h : gain < 0', h: H2, gain: 0 },
  { id: 'P2', kind: 'control', label: '4 h : gain < 0', h: H4, gain: 0 },
  { id: 'P3', kind: 'control', label: '2 h : gain < +0,5 R', h: H2, gain: 0.5 },
  { id: 'P4', kind: 'control', label: '4 h : gain < +0,5 R', h: H4, gain: 0.5 },
  { id: 'PC1', kind: 'control', label: 'point mort +3 R + P3', beR: 3, h: H2, gain: 0.5 },
  { id: 'PC2', kind: 'control', label: 'point mort +3 R + P4', beR: 3, h: H4, gain: 0.5 },
  { id: 'X2', kind: 'diag', label: 'sortie à 2 h', h: H2 },
  { id: 'X4', kind: 'diag', label: 'sortie à 4 h', h: H4 },
]
const VARS = CFGS.filter(c => c.kind === 'variant')
if (VARS.length !== 8) throw new Error('8 variantes attendues')
const cfg = (id: string) => CFGS.find(c => c.id === id)!

// ---------------------------------------------------------------- actifs et volume Binance
const A = [referenceAsset('btc'), referenceAsset('ethusdt')]
const SYM = ['BTCUSDT', 'ETHUSDT']
const v1Signals = (a: Asset) => calmOnly(a.signals, a.select)

interface Flow { T0: number; K: number; PV: Float64Array; PB: Float64Array; PN: Float64Array; C: Float64Array; imb: (from: number, to: number) => number; cover: (from: number, to: number) => number }
function loadFlow(sym: string): Flow {
  const buf = readFileSync(join(ROOT, `research/data/binance/fade/derived/taker15-${sym}.f64`))
  const x = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const rows = x.length / 6, T0 = x[0], K = (x[(rows - 1) * 6] - T0) / M15 + 1
  const V = new Float64Array(K), Bv = new Float64Array(K), N = new Float64Array(K), C = new Float64Array(K).fill(NaN)
  for (let r = 0; r < rows; r++) { const k = (x[r * 6] - T0) / M15; V[k] = x[r * 6 + 1]; Bv[k] = x[r * 6 + 2]; N[k] = x[r * 6 + 3]; C[k] = x[r * 6 + 5] }
  const pre = (a: Float64Array) => { const p = new Float64Array(K + 1); for (let k = 0; k < K; k++) p[k + 1] = p[k] + a[k]; return p }
  const PV = pre(V), PB = pre(Bv), PN = pre(N)
  const span = (from: number, to: number) => [(from - T0) / M15, (to - T0) / M15]
  const cover = (from: number, to: number) => { const [k0, k1] = span(from, to); return k0 < 0 || k1 > K ? 0 : (PN[k1] - PN[k0]) / ((to - from) / 60000) }
  const imb = (from: number, to: number) => {
    const [k0, k1] = span(from, to)
    if (k0 < 0 || k1 > K || cover(from, to) < 0.9) return NaN
    const v = PV[k1] - PV[k0], b = PB[k1] - PB[k0]
    return v > 0 ? (2 * b - v) / v : NaN
  }
  return { T0, K, PV, PB, PN, C, imb, cover }
}
const FLOW = SYM.map(loadFlow)

// ---------------------------------------------------------------- simulation
const specFor = (j: number, c: Cfg, log?: EarlyDecision[]): TrailSpec => ({
  kind: 'v1', beR: c.beR,
  early: c.h ? { horizonMs: c.h, imb: c.vol ? FLOW[j].imb : undefined, gainBelowR: c.gain, log } : undefined,
})
const run = (j: number, c: Cfg, ovr: EntryOverride, k = 1, log?: EarlyDecision[]): TrailRun => {
  const a = A[j]
  return simulateTrail(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, ovr, specFor(j, c, log))
}
const inRef = (a: Asset, ps: PositionRecord[]) => ps.filter(p => !p.exits.includes('END') && a.bars.t[p.entryIdx] >= REF[0] && a.bars.t[p.entryIdx] < REF[1])
const riskOf = (a: Asset, p: PositionRecord) => a.preset.sets[p.set].atrStopMult * Math.max(p.atrAtEntry, a.mintick)
const Rof = (a: Asset, p: PositionRecord) => p.pnl / (p.qty * riskOf(a, p))
const key = (j: number, i: number) => `${j}|${i}`

const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
function portfolio(runs: { equity: Float64Array; position: Int8Array }[]) {
  const sl = A.map((a, j) => dailyOf(a.bars, runs[j].equity, a.lo, a.end, PD0, PD1))
  const days = sl[0].days
  const port = P.book(sl[0].r, sl[1].r).r
  const tim = A.map((_, j) => { let c = 0; for (let i = sl[j].a; i <= sl[j].z; i++) if (runs[j].position[i] !== 0) c++; return c / (sl[j].z - sl[j].a + 1) })
  return { days, sl, port, m: P.dailyMetrics(port, days), mS: sl.map(s => P.dailyMetrics(s.r, days)), tim: P.mean(tim) }
}

// ---------------------------------------------------------------- contrôles
const fail = (msg: string) => { throw new Error(`contrôle en échec : ${msg}`) }
function samePositions(x: PositionRecord[], y: PositionRecord[], what: string) {
  if (x.length !== y.length) fail(`${what} : ${x.length} ≠ ${y.length} positions`)
  for (let k = 0; k < x.length; k++) {
    const p = x[k], q = y[k]
    if (p.entryIdx !== q.entryIdx || p.exitIdx !== q.exitIdx || p.pnl !== q.pnl || p.exits.join() !== q.exits.join()) fail(`${what} : position ${k} différente`)
  }
}
function sameEquity(x: Float64Array, y: Float64Array, what: string) { for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) fail(`${what} : equity différente à la barre ${i}`) }

const frozen = A.map(a => simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, v1Signals(a)))
A.forEach((a, j) => {
  const c = run(j, cfg('B0'), v1Signals(a))
  samePositions(frozen[j].positions, c.positions, `${a.key} copie V1`); sameEquity(frozen[j].equity, c.equity, `${a.key} copie V1`)
  const never: Cfg = { id: 'never', kind: 'diag', label: '', beR: 1e9, h: H2, vol: true, gain: -1e9 }
  const n = run(j, never, v1Signals(a))
  samePositions(frozen[j].positions, n.positions, `${a.key} règles impossibles`); sameEquity(frozen[j].equity, n.equity, `${a.key} règles impossibles`)
})
const OVR = A.map((a, j) => {
  const long = new Uint8Array(a.bars.n), short = new Uint8Array(a.bars.n)
  for (const p of frozen[j].positions) (p.dir === 1 ? long : short)[p.entryIdx] = 1
  return { long, short }
})
A.forEach((a, j) => samePositions(frozen[j].positions, run(j, cfg('B0'), OVR[j]).positions, `${a.key} rejeu apparié`))
const v1Trades = A.map((a, j) => inRef(a, frozen[j].positions))
if (v1Trades[0].length !== 358 || v1Trades[1].length !== 358) fail('358 + 358 trades')
const exitCount = (t: string) => v1Trades.flat().filter(p => p.exits.join('+') === t).length
if (exitCount('SL') !== 439 || exitCount('FLIP') !== 273 || exitCount('TRAIL') !== 4) fail('439 SL / 273 FLIP / 4 TRAIL')
const base = portfolio(frozen)
if (Math.abs(base.m.sharpe - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) > 1e-6) fail(`Sharpe ${base.m.sharpe}`)
if (Math.abs(base.m.cagr - 0.677) > 5e-4 || Math.abs(base.m.maxDD + 0.178) > 5e-4) fail(`CAGR ${base.m.cagr} / drawdown ${base.m.maxDD}`)
{ // trades exportés (v1-exits/trades.csv)
  const lines = readFileSync(join(ROOT, 'research/reports/shock-fade/v1-exits/trades.csv'), 'utf8').trim().split('\n')
  const h = lines[0].split(','), col = (n: string) => h.indexOf(n)
  const exp = new Map(lines.slice(1).map(l => { const x = l.split(','); return [`${x[col('asset')]}|${x[col('entry_time_utc')]}`, { exit: x[col('exit_time_utc')], tag: x[col('exit')], R: +x[col('R')] }] }))
  let n = 0
  A.forEach((a, j) => v1Trades[j].forEach(p => {
    const e = exp.get(`${a.key}|${new Date(a.bars.t[p.entryIdx] + M15).toISOString()}`)
    if (!e || e.exit !== new Date(a.bars.t[p.exitIdx] + M15).toISOString() || e.tag !== p.exits.join('+') || Math.abs(e.R - Rof(a, p)) > 1e-3) fail(`trade exporté ${a.key} ${p.entryIdx}`)
    n++
  }))
  if (n !== exp.size) fail('nombre de trades exportés')
}
const CONTROLS = [
  `rejeu de V1 : 716 trades (358 BTC / 358 ETH), Sharpe ${base.m.sharpe.toFixed(4)}, CAGR ${(100 * base.m.cagr).toFixed(1)} %, drawdown ${(100 * base.m.maxDD).toFixed(1)} %, sorties 439 SL / 273 FLIP / 4 TRAIL`,
  'copie isolée (spécification V1) = moteur figé, positions et equity au bit près, BTC et ETH',
  'copie avec point mort à +10⁹ R et sortie anticipée impossible = moteur figé au bit près (les ajouts sont inertes)',
  'rejeu apparié (entrées imposées) = 716 trades V1, identiques aux sorties exportées (v1-exits/trades.csv)',
  'exécution des nouvelles sorties (rejeux appariés) : sortie anticipée à la première clôture ≥ entrée + H au prix de clôture ; point mort au prix d\'entrée, à l\'ouverture en gap ou à la clôture d\'activation, jamais plus favorable que l\'entrée',
]

// ---------------------------------------------------------------- données de volume : couverture et correspondance
function dataChecks() {
  const out: Record<string, any> = {}
  A.forEach((a, j) => {
    const F = FLOW[j], t = a.bars.t, c = a.bars.c
    // rendements 15 min (bougies consécutives présentes des deux côtés)
    const x: number[] = [], y: number[] = []
    let eq = 0, both = 0
    for (let i = a.lo + 1; i <= a.end; i++) {
      if (t[i] < REF[0] || t[i] >= REF[1] || t[i] - t[i - 1] !== M15) continue
      const k = (t[i] - F.T0) / M15
      if (k < 1 || k >= F.K || !(F.C[k] > 0) || !(F.C[k - 1] > 0)) continue
      x.push(Math.log(c[i] / c[i - 1])); y.push(Math.log(F.C[k] / F.C[k - 1])); both++
      if (Math.abs(F.C[k] - c[i]) <= 1e-9 * c[i]) eq++
    }
    const win = [H2, H4].map(H => {
      let full = 0, ok = 0, miss = 0, agree = 0, n = 0, signImb = 0, nImb = 0
      const missing: string[] = []
      for (const p of v1Trades[j]) {
        const from = t[p.entryIdx] + M15, to = from + H
        const cv = F.cover(from, to)
        if (cv >= 1 - 1e-12) full++
        const I = F.imb(from, to)
        if (I === I) ok++; else { miss++; missing.push(`${a.key} ${new Date(from).toISOString().slice(0, 16)} (${(100 * cv).toFixed(0)} %)`) }
        // signe du rendement sur la fenêtre : V1 (clôture à entrée + H) contre Binance (dernière minute avant from / to)
        const iD = p.entryIdx + Math.round(H / M15)
        const kf = (from - F.T0) / M15 - 1, kt = (to - F.T0) / M15 - 1
        if (iD <= a.end && t[iD] + M15 === to && F.C[kf] > 0 && F.C[kt] > 0) {
          n++
          const rv = c[iD] - c[p.entryIdx], rb = F.C[kt] - F.C[kf]
          if (Math.sign(rv) === Math.sign(rb)) agree++
          if (I === I) { nImb++; if (Math.sign(I) === Math.sign(rb)) signImb++ }
        }
      }
      return { H: H / 3600e3, trades: v1Trades[j].length, full, ok, miss, missing, signAgree: agree / n, nSign: n, imbVsRet: signImb / nImb }
    })
    out[a.key] = { corr15: P.pearson(x, y), bars: both, closeEqual: eq / both, win }
  })
  return out
}
const DATA = dataChecks()
if (MODE === 'controls') {
  console.log('contrôles OK :\n- ' + CONTROLS.join('\n- '))
  for (const k of Object.keys(DATA)) {
    const d = DATA[k]
    console.log(`${k} : corrélation des rendements 15 min V1/Binance ${d.corr15.toFixed(3)}, clôtures égales ${(100 * d.closeEqual).toFixed(1)} % ; `
      + d.win.map((w: any) => `${w.H} h : ${w.ok}/${w.trades} fenêtres exploitables (${w.full} complètes), signe du rendement concordant ${(100 * w.signAgree).toFixed(0)} %`).join(' ; '))
  }
  process.exit(0)
}

// ---------------------------------------------------------------- outils statistiques
const rnd0 = P.rng
function monthGroups(days: number[]) {
  const g: number[][] = []
  let cur = NaN
  days.forEach((d, k) => { const m = P.monthKey(d); if (m !== cur) { g.push([]); cur = m } g[g.length - 1].push(k) })
  return g
}
const shPop = (n: number, s: number, q: number) => { const m = s / n, v = q / n - m * m; return v > 0 ? (m / Math.sqrt(v)) * ANNF : 0 }
const shOf = (x: number[]) => { let s = 0, q = 0; for (const v of x) { s += v; q += v * v } return shPop(x.length, s, q) }
/** ΔSharpe (x1 − x0) : bootstrap par blocs de mois calendaires. */
function bootMonths(x0: number[], x1: number[], groups: number[][], seed: number) {
  const G = groups.map(g => { let s0 = 0, q0 = 0, s1 = 0, q1 = 0; for (const k of g) { s0 += x0[k]; q0 += x0[k] ** 2; s1 += x1[k]; q1 += x1[k] ** 2 } return [g.length, s0, q0, s1, q1] })
  const rnd = rnd0(seed), dist: number[] = []
  for (let b = 0; b < B; b++) {
    let n = 0, s0 = 0, q0 = 0, s1 = 0, q1 = 0
    for (let k = 0; k < G.length; k++) { const g = G[Math.floor(rnd() * G.length)]; n += g[0]; s0 += g[1]; q0 += g[2]; s1 += g[3]; q1 += g[4] }
    dist.push(shPop(n, s1, q1) - shPop(n, s0, q0))
  }
  return { est: shOf(x1) - shOf(x0), lo: P.quantile(dist, 0.025), hi: P.quantile(dist, 0.975), p: (dist.filter(d => d <= 0).length + 1) / (B + 1) }
}
function holm(ps: number[]) {
  const o = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array(ps.length).fill(1)
  let acc = 0
  o.forEach(([p, i], r) => { acc = Math.max(acc, Math.min(1, (ps.length - r) * p)); out[i] = acc })
  return out
}
/** Statistique sur des lignes rattachées à un mois : bootstrap des mois. */
function monthBootStat<T extends { month: number }>(rows: T[], stat: (xs: T[]) => number, seed: number) {
  const by = new Map<number, T[]>()
  for (const r of rows) { if (!by.has(r.month)) by.set(r.month, []); by.get(r.month)!.push(r) }
  const ms = [...by.keys()], rnd = rnd0(seed), dist: number[] = []
  for (let b = 0; b < B && ms.length; b++) { const xs: T[] = []; for (let k = 0; k < ms.length; k++) xs.push(...by.get(ms[Math.floor(rnd() * ms.length)])!); dist.push(stat(xs)) }
  return { est: rows.length ? stat(rows) : NaN, lo: P.quantile(dist, 0.025), hi: P.quantile(dist, 0.975), n: rows.length }
}
const sumD = (xs: { d: number }[]) => P.sum(xs.map(x => x.d))
function spearmanPartial(x: number[], y: number[], z: number[]) {
  const rx = P.ranks(x), ry = P.ranks(y), rz = P.ranks(z)
  const rxy = P.pearson(rx, ry), rxz = P.pearson(rx, rz), ryz = P.pearson(ry, rz)
  return (rxy - rxz * ryz) / Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2))
}

// ---------------------------------------------------------------- trades V1 de référence
const monthOfT = (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() * 12 + d.getUTCMonth() }
interface T1 { j: number; asset: string; dir: 1 | -1; entryIdx: number; exitIdx: number; t: number; month: number; year: number; R: number }
const T1s: T1[] = A.flatMap((a, j) => v1Trades[j].map(p => {
  const t = a.bars.t[p.entryIdx] + M15
  return { j, asset: a.key, dir: p.dir, entryIdx: p.entryIdx, exitIdx: p.exitIdx, t, month: monthOfT(t), year: new Date(t).getUTCFullYear(), R: Rof(a, p) }
}))
const NTOP = Math.ceil(0.05 * T1s.length)
const TOP = new Set([...T1s].sort((x, y) => y.R - x.R).slice(0, NTOP).map(t => key(t.j, t.entryIdx)))
const YEARS = [...new Set(T1s.map(t => t.year))].sort()

// ---------------------------------------------------------------- rejeux
const groups = monthGroups(base.days)
const half0 = base.days.map(d => d * DAY < HALF)
const base2 = portfolio(A.map(a => simulate(a.m, a.preset.sets, a.costs(2), a.lo, a.end, a.select, v1Signals(a))))
const yearRet = (r: number[], days: number[]) => new Map(P.periodReturns(r, days, P.yearOf).map(p => [p.key, p.ret]))
const baseYear = yearRet(base.port, base.days)
const pfOf = (ps: PositionRecord[]) => { const r = ps.map(p => p.pnl / p.equityAtEntry); return P.sum(r.filter(x => x > 0)) / -P.sum(r.filter(x => x <= 0)) }

interface Res { c: Cfg; paired: any; full?: any; boot?: any; port?: number[]; sl?: number[][]; logs: EarlyDecision[][]; pairedR: Map<string, { R: number; exit: number; tags: string }> }
const RES = new Map<string, Res>()
for (const [ci, c] of CFGS.entries()) {
  if (c.id === 'B0') continue
  const logs: EarlyDecision[][] = [[], []]
  const paired = A.map((_, j) => run(j, c, OVR[j], 1, logs[j]))
  // Contrôles mécaniques : sortie anticipée à la première clôture ≥ entrée + H, au prix de clôture ; point mort au prix
  // d'entrée, à l'ouverture (gap) ou à la clôture d'activation, jamais au-dessus du prix d'entrée (long).
  A.forEach((a, j) => paired[j].positions.forEach(p => {
    const { t, o, c: cl } = a.bars, i = p.exitIdx
    if (p.exits.includes('EARLY') && (t[i] < t[p.entryIdx] + c.h! || t[i - 1] >= t[p.entryIdx] + c.h! || p.exitPrice !== cl[i])) fail(`${c.id} : sortie anticipée ${a.key} ${p.entryIdx}`)
    if (p.exits.includes('BE') && (![p.entryPrice, o[i], cl[i]].includes(p.exitPrice) || p.dir * (p.exitPrice - p.entryPrice) > 1e-9)) fail(`${c.id} : point mort ${a.key} ${p.entryIdx}`)
  }))
  const pairedR = new Map<string, { R: number; exit: number; tags: string }>()
  A.forEach((a, j) => inRef(a, paired[j].positions).forEach(p => pairedR.set(key(j, p.entryIdx), { R: Rof(a, p), exit: p.exitIdx, tags: p.exits.join('+') })))
  const rows = T1s.map(t => {
    const x = pairedR.get(key(t.j, t.entryIdx))
    if (!x) fail(`${c.id} : trade apparié manquant ${t.asset} ${t.entryIdx}`)
    return { t, month: t.month, d: x!.R - t.R, Rv: x!.R, changed: x!.exit !== t.exitIdx || Math.abs(x!.R - t.R) > 1e-9, top: TOP.has(key(t.j, t.entryIdx)), tags: x!.tags }
  })
  const ch = rows.filter(r => r.changed)
  const losers = rows.filter(r => r.t.R <= 0), winners = rows.filter(r => r.t.R > 0)
  const lg = logs.flat()
  const pairedRes = {
    evaluated: lg.length, missing: c.vol ? lg.filter(d => !(d.imb === d.imb)).length : 0, triggered: lg.filter(d => d.exit).length, late: lg.filter(d => d.late).length,
    beExits: rows.filter(r => r.tags.includes('BE')).length, earlyExits: rows.filter(r => r.tags.includes('EARLY')).length,
    changed: ch.length,
    split: { BTC: ch.filter(r => r.t.j === 0).length, ETH: ch.filter(r => r.t.j === 1).length, long: ch.filter(r => r.t.dir === 1).length, short: ch.filter(r => r.t.dir === -1).length,
      years: Object.fromEntries(YEARS.map(y => [y, ch.filter(r => r.t.year === y).length])) },
    saved: losers.filter(r => r.d > 1e-9).length, worsenedLosers: losers.filter(r => r.d < -1e-9).length, recovered: sumD(losers),
    cut: winners.filter(r => r.d < -1e-9).length, sacrificed: sumD(winners),
    topTouched: rows.filter(r => r.top && r.changed).length, topD: sumD(rows.filter(r => r.top)),
    meanD: monthBootStat(rows, xs => P.mean(xs.map(x => x.d)), 11 + ci), total: monthBootStat(rows, sumD, 31 + ci),
    totalBTC: sumD(rows.filter(r => r.t.j === 0)), totalETH: sumD(rows.filter(r => r.t.j === 1)),
    byYear: Object.fromEntries(YEARS.map(y => [y, sumD(rows.filter(r => r.t.year === y))])),
  }
  const res: Res = { c, paired: pairedRes, logs, pairedR }
  if (c.kind === 'variant' || c.kind === 'control') {
    const full = A.map((a, j) => run(j, c, v1Signals(a)))
    const pf = portfolio(full)
    const tr = A.map((a, j) => inRef(a, full[j].positions))
    const all = tr.flat()
    const Rs = A.flatMap((a, j) => tr[j].map(p => Rof(a, p)))
    const wins = Rs.filter(r => r > 0), losses = Rs.filter(r => r <= 0)
    const fullR = new Map<string, number>()
    A.forEach((a, j) => tr[j].forEach(p => fullR.set(key(j, p.entryIdx), Rof(a, p))))
    const topKept = T1s.filter(t => TOP.has(key(t.j, t.entryIdx))).filter(t => { const r = fullR.get(key(t.j, t.entryIdx)); return r !== undefined && r >= 0.75 * t.R }).length
    const yr = yearRet(pf.port, pf.days)
    res.full = {
      trades: [tr[0].length, tr[1].length], sharpe: pf.m.sharpe, cagr: pf.m.cagr, maxDD: pf.m.maxDD, calmar: pf.m.calmar, pf: pfOf(all),
      win: wins.length / Rs.length, payoff: P.mean(wins) / -P.mean(losses), Rtot: P.sum(Rs), tim: pf.tim,
      sharpeBTC: pf.mS[0].sharpe, sharpeETH: pf.mS[1].sharpe, cagrBTC: pf.mS[0].cagr, cagrETH: pf.mS[1].cagr, topKept,
      exits: { BE: all.filter(p => p.exits.includes('BE')).length, EARLY: all.filter(p => p.exits.includes('EARLY')).length },
      byYear: Object.fromEntries(YEARS.map(y => [y, (yr.get(y) ?? NaN) - (baseYear.get(y) ?? NaN)])),
    }
    if (c.kind === 'variant') res.full.sharpe2 = portfolio(A.map((a, j) => run(j, c, v1Signals(a), 2))).m.sharpe
    res.port = pf.port; res.sl = pf.sl.map(s => s.r)
    res.boot = {
      port: bootMonths(base.port, pf.port, groups, 101 + ci), btc: bootMonths(base.sl[0].r, pf.sl[0].r, groups, 201 + ci), eth: bootMonths(base.sl[1].r, pf.sl[1].r, groups, 301 + ci),
    }
  }
  RES.set(c.id, res)
}
const pH = holm(VARS.map(v => RES.get(v.id)!.boot.port.p))
VARS.forEach((v, i) => { RES.get(v.id)!.boot.port.pHolm = pH[i] })

// ---------------------------------------------------------------- volume contre prix
const halfSharpe = (x: number[], h: 0 | 1) => shOf(x.filter((_, k) => half0[k] === (h === 0)))
const VP = VARS.filter(v => v.ctrl).map((v, i) => {
  const r = RES.get(v.id)!, q = RES.get(v.ctrl!)!
  const bt = bootMonths(q.port!, r.port!, groups, 401 + i)
  const halves = [0, 1].map(h => halfSharpe(r.port!, h as 0 | 1) - halfSharpe(q.port!, h as 0 | 1))
  return { id: v.id, ctrl: v.ctrl!, sharpeV: r.full.sharpe, sharpeP: q.full.sharpe, boot: bt, halves, ok: bt.p < 0.05 && halves.every(x => x > 0) }
})
const VPok = new Map(VP.map(x => [x.id, x.ok]))

// Décomposition sur les trades ouverts à l'échéance (rejeux X2 / X4).
interface Open { t: T1; month: number; half: number; I: number; gain: number; keep: number }
function openAt(H: number): Open[] {
  const X = RES.get(H === H2 ? 'X2' : 'X4')!
  const out: Open[] = []
  A.forEach((a, j) => X.logs[j].forEach(d => {
    const t = T1s.find(u => u.j === j && u.entryIdx === d.entryIdx)
    if (!t) return
    const from = a.bars.t[d.entryIdx] + M15
    const I = FLOW[j].imb(from, from + H)
    out.push({ t, month: t.month, half: t.t < HALF ? 0 : 1, I: t.dir * I, gain: d.gainR, keep: t.R - X.pairedR.get(key(j, d.entryIdx))!.R })
  }))
  return out
}
const meanKeep = (xs: Open[]) => P.mean(xs.map(x => x.keep))
const DEC = [H2, H4].map((H, hi) => {
  const o = openAt(H), ok = o.filter(x => x.I === x.I)
  const cell = (f: (x: Open) => boolean, seed: number) => { const xs = ok.filter(f); return { n: xs.length, mean: monthBootStat(xs, meanKeep, seed), total: P.sum(xs.map(x => x.keep)) } }
  const grid = [
    { label: 'gain < 0 et I < 0', ...cell(x => x.gain < 0 && x.I < 0, 501 + hi) }, { label: 'gain < 0 et I ≥ 0', ...cell(x => x.gain < 0 && x.I >= 0, 511 + hi) },
    { label: '0 ≤ gain < +0,5 R et I < 0', ...cell(x => x.gain >= 0 && x.gain < 0.5 && x.I < 0, 521 + hi) }, { label: '0 ≤ gain < +0,5 R et I ≥ 0', ...cell(x => x.gain >= 0 && x.gain < 0.5 && x.I >= 0, 531 + hi) },
    { label: 'gain ≥ +0,5 R et I < 0', ...cell(x => x.gain >= 0.5 && x.I < 0, 541 + hi) }, { label: 'gain ≥ +0,5 R et I ≥ 0', ...cell(x => x.gain >= 0.5 && x.I >= 0, 551 + hi) },
  ]
  // V3/V4 contre P3/P4 : parmi gain < +0,5 R, écart de R_garder entre I < 0 et I ≥ 0, par moitié et par actif
  const low = ok.filter(x => x.gain < 0.5)
  const diff = (xs: Open[]) => meanKeep(xs.filter(x => x.I < 0)) - meanKeep(xs.filter(x => x.I >= 0))
  const sub = (f: (x: Open) => boolean, seed: number) => monthBootStat(low.filter(f), diff, seed)
  const lowDiff = { all: sub(() => true, 561 + hi), h0: sub(x => x.half === 0, 571 + hi), h1: sub(x => x.half === 1, 581 + hi), btc: sub(x => x.t.j === 0, 591 + hi), eth: sub(x => x.t.j === 1, 601 + hi) }
  const pc = (xs: Open[]) => spearmanPartial(xs.map(x => x.I), xs.map(x => x.keep), xs.map(x => x.gain))
  const part = (f: (x: Open) => boolean, seed: number) => monthBootStat(ok.filter(f), pc, seed)
  const partial = { all: part(() => true, 611 + hi), h0: part(x => x.half === 0, 621 + hi), h1: part(x => x.half === 1, 631 + hi), btc: part(x => x.t.j === 0, 641 + hi), eth: part(x => x.t.j === 1, 651 + hi) }
  return { H: H / 3600e3, open: o.length, missing: o.length - ok.length, negShare: ok.filter(x => x.I < 0).length / ok.length,
    negShareBTC: ok.filter(x => x.t.j === 0 && x.I < 0).length / ok.filter(x => x.t.j === 0).length, negShareETH: ok.filter(x => x.t.j === 1 && x.I < 0).length / ok.filter(x => x.t.j === 1).length,
    medI: P.quantile(ok.map(x => x.I), 0.5), grid, lowDiff, partial }
})

// ---------------------------------------------------------------- PBO, Sharpe dégonflé, walk-forward
const ids = ['B0', ...VARS.map(v => v.id)]
const series = [base.port, ...VARS.map(v => RES.get(v.id)!.port!)]
const CS = cscv(series, 16)
const shD = series.map(x => sharpe(x))
const bestI = 1 + shD.slice(1).indexOf(Math.max(...shD.slice(1)))
const dsrBest = dsr(series[bestI], 241, P.sd(shD))
const diffs = series.slice(1).map(x => x.map((y, t) => y - base.port[t]))
const dsrDiff = dsr(diffs[bestI - 1], VARS.length, P.sd(diffs.map(d => sharpe(d))))
const CUTS = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => base.days.indexOf(Math.floor(Date.parse(`${y}-01-01`) / DAY)))
const WF = walkForward(series, CUTS)
const wf = { oos: sharpe(WF.oos) * ANNF, b0: sharpe(base.port.slice(CUTS[0])) * ANNF, chosen: WF.folds.map(f => `${P.isoDay(base.days[f.from]).slice(0, 4)} : ${ids[f.chosen]}`) }

// ---------------------------------------------------------------- règle de décision
for (const v of VARS) {
  const r = RES.get(v.id)!, f = r.full
  r.paired.crit = {
    c1: r.boot.port.lo > 0 && r.boot.port.pHolm < 0.05,
    c2: f.sharpeBTC > base.mS[0].sharpe && f.sharpeETH > base.mS[1].sharpe,
    c3: f.maxDD >= base.m.maxDD,
    c4: f.sharpe2 > base2.m.sharpe,
    c5: f.topKept >= 30,
    c6: v.vol ? VPok.get(v.id)! : null,
  }
  r.paired.convincing = Object.values(r.paired.crit).every(x => x === null || x === true)
}
const winners = VARS.map(v => RES.get(v.id)!).filter(r => r.paired.convincing).sort((x, y) => x.paired.changed - y.paired.changed)
const decision = winners.length ? `variante candidate : ${winners[0].c.id} (${winners[0].c.label}), exploratoire jusqu'à validation prospective` : 'aucune variante convaincante : V1 conservée inchangée'

// ---------------------------------------------------------------- rapport
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 && +Math.abs(x).toFixed(d) !== 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const sg = (x: number, d = 2) => { if (!Number.isFinite(x)) return '—'; const a = Math.abs(x).toFixed(d); return fr((+a === 0 ? '' : x > 0 ? '+' : '−') + a) }
const pc = (x: number, d = 1) => (Number.isFinite(x) ? fr((x < 0 && +Math.abs(100 * x).toFixed(d) !== 0 ? '−' : '') + Math.abs(100 * x).toFixed(d) + ' %') : '—')
const ci = (b: { lo: number; hi: number }, d = 1) => `[${sg(b.lo, d)} ; ${sg(b.hi, d)}]`
const yes = (b: boolean | null) => (b === null ? 's. o.' : b ? 'oui' : 'non')
const tbl = (head: string[], rows: (string | number)[][]) => [`| ${head.join(' | ')} |`, `|${head.map((_, k) => (k ? '---:' : '---')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)]
const lab = (c: Cfg) => `${c.id} · ${c.label}`
const best = VARS.map(v => RES.get(v.id)!).reduce((x, y) => (y.boot.port.est > x.boot.port.est ? y : x))

const L: string[] = []
L.push('# Shock Engine V1 — point mort et volume directionnel 2 h / 4 h', '',
  'Protocole : `research/preregistration/v1-be-volume.md` (commité avant tout calcul de performance). Généré par `research/fade/v1/be-volume-study.ts` '
  + '(copie isolée `trail-broker.ts` / `trail-sim.ts`, volume `taker15.py`). Moteur figé, bot et site non modifiés. '
  + '**Tout est mesuré sur l\'historique qui a servi à développer V1 : une amélioration resterait exploratoire jusqu\'à validation prospective.**', '',
  '## Verdict', '', `**${decision}.**`, '',
  `- Rejeu complet : ΔSharpe de ${sg(Math.min(...VARS.map(v => RES.get(v.id)!.boot.port.est)))} à ${sg(Math.max(...VARS.map(v => RES.get(v.id)!.boot.port.est)))} ; meilleure variante ${best.c.id} (${sg(best.boot.port.est)}, IC ${ci(best.boot.port, 2)}, p Holm ${n(best.boot.port.pHolm, 3)}).`,
  `- Apparié : ΔR total de ${sg(Math.min(...VARS.map(v => RES.get(v.id)!.paired.total.est)), 0)} à ${sg(Math.max(...VARS.map(v => RES.get(v.id)!.paired.total.est)), 0)} R ; R récupérés sur les perdants ${sg(Math.min(...VARS.map(v => RES.get(v.id)!.paired.recovered)), 0)} à ${sg(Math.max(...VARS.map(v => RES.get(v.id)!.paired.recovered)), 0)} R, R sacrifiés sur les gagnants ${sg(Math.min(...VARS.map(v => RES.get(v.id)!.paired.sacrificed)), 0)} à ${sg(Math.max(...VARS.map(v => RES.get(v.id)!.paired.sacrificed)), 0)} R.`,
  `- Volume contre prix seul : ${VP.filter(x => x.boot.est > 0).length} / ${VP.length} variantes de volume font mieux que leur contrôle de prix ; ${VP.filter(x => x.ok).length} / ${VP.length} passent le critère 6.`,
  `- Critères remplis : ${VARS.map(v => `${v.id} ${Object.values(RES.get(v.id)!.paired.crit).filter(x => x === true).length}/${Object.values(RES.get(v.id)!.paired.crit).filter(x => x !== null).length}`).join(', ')}.`, '',
  '## 1. Vérification du moteur', '', ...CONTROLS.map(c => `- ${c} : OK`), '',
  '## 2. Données de volume (Binance comptant, 1 min)', '',
  'I_H = d · (V achat − V vente) / V total sur [entrée, entrée + H). Fenêtre exploitable : ≥ 90 % des minutes présentes et volume > 0 ; sinon pas de décision de volume (comportement de V1), jamais de volume remplacé par zéro.', '',
  ...tbl(['actif', 'corrélation des rendements 15 min V1 / Binance', 'clôtures 15 min identiques', 'fenêtres 2 h exploitables (complètes)', 'fenêtres 4 h exploitables (complètes)', 'signe du rendement 2 h / 4 h concordant', 'signe de I = signe du rendement Binance (2 h / 4 h)'],
    A.map(a => { const d = DATA[a.key]; return [a.key + (a.key === 'BTC' ? ' (V1 : Bitstamp)' : ' (V1 : Binance)'), n(d.corr15, 3), pc(d.closeEqual), `${d.win[0].ok} / ${d.win[0].trades} (${d.win[0].full})`, `${d.win[1].ok} / ${d.win[1].trades} (${d.win[1].full})`,
      `${pc(d.win[0].signAgree, 0)} / ${pc(d.win[1].signAgree, 0)}`, `${pc(d.win[0].imbVsRet, 0)} / ${pc(d.win[1].imbVsRet, 0)}`] })), '')
const miss = A.flatMap(a => DATA[a.key].win.flatMap((w: any) => w.missing.map((m: string) => `${m}, fenêtre ${w.H} h`)))
L.push(miss.length ? `Fenêtres non exploitables (couverture) : ${miss.join(' ; ')}.` : 'Aucune fenêtre non exploitable.',
  `Décisions décalées par un trou de la série V1 : ${VARS.filter(v => v.h).map(v => `${v.id} ${RES.get(v.id)!.paired.late}`).join(', ')}.`, '')

L.push('## 3. Tableau comparatif — portefeuille complet (entrées supplémentaires autorisées)', '',
  'ΔSharpe : bootstrap par blocs de mois (IC 95 %, p unilatéral, Holm sur les 8 variantes). Contrôles de prix en italique (hors Holm). Très gros gagnants conservés : 36 meilleurs trades V1, même entrée, R ≥ 75 % du R V1.', '')
const fullRow = (id: string, r: Res | null) => {
  const f = r ? r.full : null
  if (!f) return [`B0 · V1 inchangée`, v1Trades[0].length + v1Trades[1].length, n(base.m.sharpe), '—', '—', pc(base.m.cagr), pc(base.m.maxDD), n(base.m.calmar), n(pfOf(v1Trades.flat())),
    pc(T1s.filter(t => t.R > 0).length / T1s.length), n(P.mean(T1s.filter(t => t.R > 0).map(t => t.R)) / -P.mean(T1s.filter(t => t.R <= 0).map(t => t.R))), sg(P.sum(T1s.map(t => t.R)), 0),
    pc(base.tim), `${NTOP} / ${NTOP}`, n(base.mS[0].sharpe), n(base.mS[1].sharpe), n(base2.m.sharpe)]
  const it = r!.c.kind === 'control' ? (s: string) => `*${s}*` : (s: string) => s
  return [it(lab(r!.c)), f.trades[0] + f.trades[1], n(f.sharpe), `${sg(r!.boot.port.est)} ${ci(r!.boot.port, 2)}`, r!.c.kind === 'variant' ? n(r!.boot.port.pHolm, 3) : '—', pc(f.cagr), pc(f.maxDD), n(f.calmar), n(f.pf),
    pc(f.win), n(f.payoff), sg(f.Rtot, 0), pc(f.tim), `${f.topKept} / ${NTOP}`, `${n(f.sharpeBTC)} (${sg(r!.boot.btc.est)})`, `${n(f.sharpeETH)} (${sg(r!.boot.eth.est)})`, f.sharpe2 !== undefined ? n(f.sharpe2) : '—']
}
L.push(...tbl(['configuration', 'trades', 'Sharpe', 'ΔSharpe [IC 95 %]', 'p Holm', 'CAGR', 'drawdown', 'Calmar', 'PF', 'gagnants', 'payoff', 'R total', 'exposition', 'très gros gagnants', 'Sharpe BTC (Δ)', 'Sharpe ETH (Δ)', 'Sharpe coûts × 2'],
  [fullRow('B0', null), ...CFGS.filter(c => c.kind === 'variant' || c.kind === 'control').map(c => fullRow(c.id, RES.get(c.id)!))]), '',
  `CAGR par sleeve (BTC / ETH) — B0 : ${pc(base.mS[0].cagr)} / ${pc(base.mS[1].cagr)} ; ${VARS.map(v => `${v.id} : ${pc(RES.get(v.id)!.full.cagrBTC)} / ${pc(RES.get(v.id)!.full.cagrETH)}`).join(' ; ')}.`, '',
  `IC du ΔSharpe par sleeve (BTC ; ETH) : ${VARS.map(v => `${v.id} ${ci(RES.get(v.id)!.boot.btc, 2)} ; ${ci(RES.get(v.id)!.boot.eth, 2)}`).join(' · ')}.`, '')

L.push('## 4. R récupérés et R sacrifiés — 716 trades V1, mêmes entrées', '',
  'Rejeu apparié sur le chemin chronologique du simulateur. « Concernés » : sortie modifiée. R récupérés = Σ ΔR sur les perdants V1 (R ≤ 0) ; R sacrifiés = Σ ΔR sur les gagnants V1. IC 95 % : bootstrap des mois d\'entrée.', '',
  ...tbl(['configuration', 'évalués à l\'échéance', 'données manquantes', 'déclenchés', 'concernés', 'perdants sauvés (dégradés)', 'R récupérés', 'gagnants coupés', 'R sacrifiés', '36 meilleurs touchés (ΔR)', 'ΔR moyen [IC]', 'ΔR total [IC]', 'dont BTC', 'dont ETH'],
    CFGS.filter(c => c.kind !== 'base' && c.kind !== 'diag').map(c => {
      const p = RES.get(c.id)!.paired, it = c.kind === 'control' ? (s: string) => `*${s}*` : (s: string) => s
      return [it(lab(c)), c.h ? p.evaluated : '—', c.vol ? p.missing : '—', c.h ? p.triggered : '—', p.changed, `${p.saved} (${p.worsenedLosers})`, sg(p.recovered, 1), p.cut, sg(p.sacrificed, 1),
        `${p.topTouched} (${sg(p.topD, 1)})`, `${sg(p.meanD.est, 3)} ${ci(p.meanD, 3)}`, `${sg(p.total.est, 1)} ${ci(p.total)}`, sg(p.totalBTC, 1), sg(p.totalETH, 1)]
    })), '',
  '**Trades concernés par actif, sens et année** (variantes) :', '',
  ...tbl(['variante', 'BTC', 'ETH', 'long', 'short', ...YEARS.map(String)], VARS.map(v => { const s = RES.get(v.id)!.paired.split; return [v.id, s.BTC, s.ETH, s.long, s.short, ...YEARS.map(y => s.years[y])] })), '',
  '**ΔR apparié par année d\'entrée** :', '',
  ...tbl(['variante', ...YEARS.map(String)], VARS.map(v => [v.id, ...YEARS.map(y => sg(RES.get(v.id)!.paired.byYear[y], 1))])), '',
  '**Écart de rendement annuel du portefeuille (variante − B0, rejeu complet)** :', '',
  ...tbl(['variante', ...YEARS.map(String)], VARS.map(v => [v.id, ...YEARS.map(y => pc(RES.get(v.id)!.full.byYear[y]))])), '')

L.push('## 5. Diagnostic du volume directionnel à 2 h et 4 h', '',
  'Trades V1 encore ouverts à l\'échéance. R_garder = R final V1 − R obtenu en sortant à l\'échéance (rejeu X2 / X4, commission comprise) : > 0, garder valait mieux. IC 95 % : bootstrap des mois.', '')
for (const d of DEC) {
  L.push(`### ${d.H} h`, '',
    `${d.open} trades ouverts, ${d.missing} sans volume exploitable. Part avec I < 0 : ${pc(d.negShare, 0)} (BTC ${pc(d.negShareBTC, 0)}, ETH ${pc(d.negShareETH, 0)}) ; I médian ${sg(d.medI, 3)}.`, '',
    ...tbl(['groupe (connu à l\'échéance)', 'trades', 'R_garder moyen [IC]', 'R_garder total'], d.grid.map(g => [g.label, g.n, `${sg(g.mean.est)} ${ci(g.mean, 2)}`, sg(g.total, 1)])), '',
    `- Parmi les trades à gain < +0,5 R, écart de R_garder moyen entre I < 0 et I ≥ 0 (< 0 : le volume distingue les trades à couper) : ${sg(d.lowDiff.all.est)} ${ci(d.lowDiff.all, 2)} ; `
    + `2018-09 → 2022-06 : ${sg(d.lowDiff.h0.est)} ${ci(d.lowDiff.h0, 2)} ; 2022-07 → 2026-09 : ${sg(d.lowDiff.h1.est)} ${ci(d.lowDiff.h1, 2)} ; BTC ${sg(d.lowDiff.btc.est)} ${ci(d.lowDiff.btc, 2)} ; ETH ${sg(d.lowDiff.eth.est)} ${ci(d.lowDiff.eth, 2)}.`,
    `- Corrélation partielle de Spearman entre I et R_garder, à gain latent donné : ${sg(d.partial.all.est, 3)} ${ci(d.partial.all, 3)} ; par moitié ${sg(d.partial.h0.est, 3)} ${ci(d.partial.h0, 3)} puis ${sg(d.partial.h1.est, 3)} ${ci(d.partial.h1, 3)} ; BTC ${sg(d.partial.btc.est, 3)} ${ci(d.partial.btc, 3)}, ETH ${sg(d.partial.eth.est, 3)} ${ci(d.partial.eth, 3)}.`, '')
}
L.push('## 6. Le volume apporte-t-il plus que le prix ? (critère 6)', '',
  'Rejeu complet : Sharpe de la variante de volume contre son contrôle de prix seul (même échéance, même condition de gain). Bootstrap par mois, p unilatéral ; écart sur chaque moitié chronologique (2018-09 → 2022-06, 2022-07 → 2026-09), descriptif.', '',
  ...tbl(['variante', 'contrôle', 'Sharpe variante', 'Sharpe contrôle', 'écart [IC 95 %]', 'p', '1re moitié', '2e moitié', 'critère 6'],
    VP.map(x => [x.id, x.ctrl, n(x.sharpeV), n(x.sharpeP), `${sg(x.boot.est)} ${ci(x.boot, 2)}`, n(x.boot.p, 3), sg(x.halves[0]), sg(x.halves[1]), yes(x.ok)])), '')

L.push('## 7. Contrôles statistiques', '',
  `- CSCV-PBO (B0 + 8 variantes, 16 blocs) : **${pc(CS.pbo)}** ; configuration la plus souvent choisie : ${ids[CS.chosenCount.indexOf(Math.max(...CS.chosenCount))]}.`,
  `- Sharpe dégonflé de la meilleure variante (${ids[bestI]}, N = 241 essais connus, minimum) : ${n(dsrBest.p, 3)} — il reflète surtout le niveau hérité de V1 ; de son écart à B0 (N = 8), seul pertinent pour la décision : ${n(dsrDiff.p, 3)}.`,
  `- Walk-forward **rétrospectif** (recalage annuel 2020 → 2026, meilleur Sharpe passé parmi les 9) : Sharpe hors période d'entraînement ${n(wf.oos)} contre ${n(wf.b0)} pour B0 sur les mêmes jours ; choix : ${wf.chosen.join(', ')}. `
  + 'Ce n\'est pas une validation prospective indépendante : tout l\'historique a servi à développer V1.',
  '- Par actif et par année : sections 3 et 4.', '',
  '## 8. Règle de décision', '',
  ...tbl(['variante', '1 ΔSharpe > 0 (IC, Holm)', '2 BTC et ETH', '3 drawdown', '4 coûts × 2', '5 ≥ 30 / 36 très gros gagnants', '6 volume > prix', 'convaincante'],
    VARS.map(v => { const k = RES.get(v.id)!.paired.crit; return [v.id, yes(k.c1), yes(k.c2), yes(k.c3), yes(k.c4), yes(k.c5), yes(k.c6), `**${yes(RES.get(v.id)!.paired.convincing)}**`] })), '',
  '## 9. Limites', '',
  '- **BTC** : V1 trade Bitstamp, le volume agresseur vient de Binance comptant (proxy, voir section 2). Le flux des perpétuels, majoritaire, n\'est pas utilisé.',
  '- **Point mort** activé à la clôture de bougie (comportement d\'un script qui déplace son stop en fin de bougie) ; un stop modifié en cours de bougie donnerait d\'autres sorties.',
  '- **Un seul historique**, déjà utilisé pour développer V1 (≥ 241 essais connus) ; les règles de sortie précoce et de point mort avaient déjà été explorées sur E2 avec des résultats négatifs.',
  '- Le walk-forward est rétrospectif, et les moitiés chronologiques sont une lecture descriptive, pas un échantillon de validation.', '')

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n'))
const pick = (r: Res) => ({ id: r.c.id, paired: r.paired, full: r.full, boot: r.boot })
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ protocol: 'research/preregistration/v1-be-volume.md', controls: CONTROLS, data: DATA,
  base: { ...base.m, sharpeBTC: base.mS[0].sharpe, sharpeETH: base.mS[1].sharpe, sharpe2: base2.m.sharpe }, configs: [...RES.values()].map(pick),
  volumeVsPrice: VP, decomposition: DEC, pbo: CS.pbo, dsrBest: { id: ids[bestI], p: dsrBest.p }, dsrDiff: dsrDiff.p, wf, decision },
(_, x) => (typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(8) : String(x)) : x), 1) + '\n')
console.log(decision)
