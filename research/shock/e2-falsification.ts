// Falsification Monte-Carlo de E2, tests A et B : research/preregistration/e2-falsification.md (commité
// avant tout calcul). E2 figée ; données historiques BTC/ETH déjà vues. Le test C (marchés synthétiques)
// est dans research/shock/e2-synthetic.ts.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-falsification.ts
//
// A. 50 000 sélections aléatoires de shorts v1, autant que E2, stratifiées par actif et par année
//    (secondaire : par actif) ; EV, PF, payoff, D, Sharpe et drawdown de la stratégie complète.
// B. Décalages circulaires du régime E2 (kmin 180 jours ; sensibilité 90 et 365), BTC, ETH et
//    portefeuille égal séparément ; statistique D.
// La stratégie complète d'une sélection est calculée par retrait additif des contributions
// journalières des shorts non sélectionnés, vérifié contre la re-simulation exacte.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import type { Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { loadBtc } from '../lib/data.ts'
import * as P from '../lib/portfolio.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/e2-falsification')
const PRESPEC = 'research/preregistration/e2-falsification.md'
const DAY = P.DAY, M15 = 15 * 60000, ANN = P.ANN
const CUT = Date.parse('2026-10-01T00:00:00Z')
const SEED = 20261014
const NA = 50000, NA_EXACT = 1000
const KMINS = [180, 90, 365]
const COMM = 0.045 / 100
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const stopIfFailed = (stage: string) => { const bad = checks.filter(c => !c.ok); if (bad.length) throw new Error(`${stage} : ${bad.map(c => c.name).join(' ; ')}`) }

const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'lib/strategies/shock/live.ts': '05caf82ece9ad7f8c355f0390bbda4fe6e3bffe1802933d0952b5c3dc10edeb2',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
}
for (const [f, h] of Object.entries(FROZEN)) { const got = createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex'); check(`empreinte ${f}`, got === h, got.slice(0, 16)) }
stopIfFailed('empreintes')

// ================================================================ sleeves, E2, v1
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const NAME: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
const S: Record<SleeveKey, Sleeve> = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') }
const TREND = {} as Record<SleeveKey, Uint8Array>
for (const k of KEYS) {
  const reg = classify(S[k].m.bars, 15, k === 'btc' ? resample(loadBtc(60), DAY) : resample(S[k].bars, DAY))
  let bad = 0
  TREND[k] = new Uint8Array(S[k].bars.n)
  for (let i = 0; i < S[k].bars.n; i++) { const id = reg.id[i]; if ((id < 0 ? -1 : id % 2) !== S[k].select[i]) bad++; TREND[k][i] = id >= 0 && id >> 1 === 2 ? 1 : 0 }
  check(`${NAME[k]} : régime recalculé = régime du moteur`, bad === 0, `${bad} écart(s)`)
}
const run = (k: SleeveKey, short: Uint8Array): ShockResult => simulate(S[k].m, S[k].preset.sets, costsFor(k, 1), S[k].lo, S[k].end, S[k].select, { long: S[k].signals.long, short })
const V0 = { btc: run('btc', S.btc.signals.short), ethusdt: run('ethusdt', S.ethusdt.signals.short) }

// Période commune et rendements journaliers de la v1.
const tStart = Math.max(...KEYS.map(k => S[k].bars.t[S[k].lo])), tEnd = Math.min(...KEYS.map(k => S[k].bars.t[S[k].end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const pdays: number[] = []
for (let d = PD0; d <= PD1; d++) pdays.push(d)
const ND = pdays.length
const idxAt = (k: SleeveKey, ms: number) => { const t = S[k].bars.t; let lo = 0, hi = S[k].bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const WIN = Object.fromEntries(KEYS.map(k => [k, { a: idxAt(k, PD0 * DAY), b: idxAt(k, (PD1 + 1) * DAY) - 1 }])) as Record<SleeveKey, { a: number; b: number }>
const daily = (k: SleeveKey, eq: Float64Array) => { const { a, b } = WIN[k], base = eq[a - 1], c = P.dayCloses(S[k].bars.t, eq, a, b, pdays, base).eq; return { r: Float64Array.from(P.returnsOf(c, base)), closes: c, base } }
const D0 = { btc: daily('btc', V0.btc.equity), ethusdt: daily('ethusdt', V0.ethusdt.equity) }

// Clôture de chaque jour de la période (dernière barre du jour), pour la valorisation des positions.
const dayClose = Object.fromEntries(KEYS.map(k => {
  const t = S[k].bars.t, c = S[k].bars.c, out = new Float64Array(ND).fill(NaN)
  let i = WIN[k].a
  for (let j = 0; j < ND; j++) { const end = (pdays[j] + 1) * DAY; let last = -1; while (i <= WIN[k].b && t[i] < end) { last = i; i++ } out[j] = last >= 0 ? c[last] : j ? out[j - 1] : c[WIN[k].a - 1] }
  return [k, out]
})) as Record<SleeveKey, Float64Array>

/** Contribution journalière d'une position aux rendements de sa sleeve (indices de jour de la période, en part de l'equity de la veille). */
function contrib(k: SleeveKey, p: PositionRecord): { j: number; x: number }[] {
  const t = S[k].bars.t, jE = Math.floor(t[p.entryIdx] / DAY) - PD0, jX = Math.floor(t[p.exitIdx] / DAY) - PD0
  const entryFee = COMM * p.qty * p.entryPrice, exitFee = p.fees - entryFee
  // Clôture du jour j ; j = −1 : dernière barre avant la période.
  const closeAt = (j: number) => (j >= 0 ? dayClose[k][j] : j === -1 ? S[k].bars.c[WIN[k].a - 1] : NaN)
  const cash: { j: number; x: number }[] = []
  if (jX < 0) return []
  if (jE === jX) cash.push({ j: jE, x: p.pnl })
  else {
    if (jE >= 0) cash.push({ j: jE, x: p.dir * p.qty * (closeAt(jE) - p.entryPrice) - entryFee })
    for (let j = Math.max(jE + 1, 0); j < jX; j++) cash.push({ j, x: p.dir * p.qty * (closeAt(j) - closeAt(j - 1)) })
    cash.push({ j: jX, x: p.dir * p.qty * (p.exitPrice - closeAt(jX - 1)) - exitFee })
  }
  return cash.filter(c => c.j >= 0 && c.j < ND).map(c => ({ j: c.j, x: c.x / (c.j ? D0[k].closes[c.j - 1] : D0[k].base) }))
}
// Contrôle : la somme des contributions de toutes les positions redonne les rendements de la v1, sauf les
// jours touchés par un long à TP1 partiel (quantité réduite en cours de route, jamais retiré ici : les
// shorts n'ont pas de TP1).
for (const k of KEYS) {
  const sum = new Float64Array(ND), tp1Day = new Uint8Array(ND)
  let feeGap = 0, shortTp1 = 0
  for (const p of V0[k].positions) {
    if (!p.tp1Filled) feeGap = Math.max(feeGap, Math.abs(p.fees - COMM * p.qty * (p.entryPrice + p.exitPrice)) / p.fees)
    if (p.tp1Filled && p.dir === -1) shortTp1++
    for (const c of contrib(k, p)) { sum[c.j] += c.x; if (p.tp1Filled) tp1Day[c.j] = 1 }
  }
  let gap = 0, n = 0
  for (let j = 0; j < ND; j++) if (!tp1Day[j]) { n++; gap = Math.max(gap, Math.abs(sum[j] - D0[k].r[j])) }
  check(`${NAME[k]} : décomposition des rendements journaliers par position = rendements de la v1`, gap < 1e-9 && feeGap < 1e-9 && shortTp1 === 0, `écart max ${gap.toExponential(1)} sur ${n} jours (${ND - n} jours avec un long à TP1 partiel exclus) ; frais = 0,045 % × (entrée + sortie) à ${feeGap.toExponential(1)} près ; shorts à TP1 : ${shortTp1}`)
}

// ================================================================ échantillon de shorts
const dailyVol = (k: SleeveKey) => {
  const { t, c } = S[k].bars, close = new Map<number, number>()
  for (let i = 0; i < S[k].bars.n; i++) close.set(Math.floor(t[i] / DAY), c[i])
  const ds = [...close.keys()].sort((x, y) => x - y), out = new Map<number, number>(), lr: number[] = []
  for (let j = 1; j < ds.length; j++) { if (lr.length >= 30) out.set(ds[j], P.sd(lr.slice(-30))); lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0) }
  return out
}
const inSample = (k: SleeveKey, p: PositionRecord) => p.dir === -1 && !p.exits.includes('END') && S[k].bars.t[p.exitIdx] + M15 < CUT && p.entryIdx >= S[k].lo
const SH = KEYS.flatMap(k => { const vol = dailyVol(k); return V0[k].positions.filter(p => inSample(k, p)).map(p => { const t = S[k].bars.t[p.entryIdx], net = p.pnl / p.equityAtEntry; return { k, a: k === 'btc' ? 0 : 1, p, t, year: new Date(t).getUTCFullYear(), e2: TREND[k][p.entryIdx], net, R: net / vol.get(Math.floor(t / DAY))!, c: contrib(k, p) } }) })
const N = SH.length
const R = Float64Array.from(SH, x => x.R), NET = Float64Array.from(SH, x => x.net), AS = Uint8Array.from(SH, x => x.a)
const E2 = Uint8Array.from(SH, x => x.e2)
const fwdRef = JSON.parse(readFileSync(join(ROOT, 'research/reports/e2-forward/latest.json'), 'utf8')).history
const dPooled = (keep: ArrayLike<number>, only = -1) => { let s1 = 0, c1 = 0, s0 = 0, c0 = 0; for (let j = 0; j < N; j++) { if (only >= 0 && AS[j] !== only) continue; if (keep[j]) { s1 += R[j]; c1++ } else { s0 += R[j]; c0++ } } return c1 && c0 ? s1 / c1 - s0 / c0 : NaN }
check('échantillon = référence historique du forward', N === fwdRef.n1 + fwdRef.n0 && Math.abs(dPooled(E2) - fwdRef.d) < 1e-9, `${N} shorts, ${P.sum(E2)} en régime E2, D = ${dPooled(E2).toFixed(4)}`)
stopIfFailed('contrôles')
log('échantillon et décomposition')

// ================================================================ mesures d'une sélection
const rB = D0.btc.r, rE = D0.ethusdt.r
const wB = new Float64Array(ND), wE = new Float64Array(ND)
const ann = Math.sqrt(ANN)
function seriesStats(r: Float64Array) { let s = 0, s2 = 0, v = 1, pk = 1, dd = 0; for (let j = 0; j < ND; j++) { s += r[j]; s2 += r[j] * r[j]; v *= 1 + r[j]; if (v > pk) pk = v; if (v / pk - 1 < dd) dd = v / pk - 1 } const m = s / ND, sd = Math.sqrt(Math.max(s2 / ND - m * m, 0)); return { sharpe: sd > 0 ? (m / sd) * ann : NaN, maxDD: dd } }
/** 50/50 sans rebalancement : 50 dans chaque sleeve au jour 0, valeur = somme. */
function bookStats(a: Float64Array, b: Float64Array) { let va = 50, vb = 50, prev = 100, s = 0, s2 = 0, pk = 100, dd = 0; for (let j = 0; j < ND; j++) { va *= 1 + a[j]; vb *= 1 + b[j]; const v = va + vb, r = v / prev - 1; prev = v; s += r; s2 += r * r; if (v > pk) pk = v; if (v / pk - 1 < dd) dd = v / pk - 1 } const m = s / ND, sd = Math.sqrt(Math.max(s2 / ND - m * m, 0)); return { sharpe: sd > 0 ? (m / sd) * ann : NaN, maxDD: dd } }
const METRICS = ['EV', 'PF', 'payoff', 'D', 'sharpeBTC', 'ddBTC', 'sharpeETH', 'ddETH', 'sharpe5050', 'dd5050'] as const
type Metric = typeof METRICS[number]
function measure(keep: ArrayLike<number>): Record<Metric, number> {
  let sR = 0, n = 0, gp = 0, gl = 0, nw = 0, nl = 0
  wB.set(rB); wE.set(rE)
  for (let j = 0; j < N; j++) {
    if (keep[j]) { sR += R[j]; n++; const x = NET[j]; if (x > 0) { gp += x; nw++ } else if (x < 0) { gl -= x; nl++ } }
    else { const w = AS[j] ? wE : wB; for (const c of SH[j].c) w[c.j] -= c.x }
  }
  const sb = seriesStats(wB), se = seriesStats(wE), pf = bookStats(wB, wE)
  return { EV: sR / n, PF: gl > 0 ? gp / gl : NaN, payoff: nw && nl ? gp / nw / (gl / nl) : NaN, D: dPooled(keep), sharpeBTC: sb.sharpe, ddBTC: sb.maxDD, sharpeETH: se.sharpe, ddETH: se.maxDD, sharpe5050: pf.sharpe, dd5050: pf.maxDD }
}
const ALL = new Uint8Array(N).fill(1)
{
  const mAll = measure(ALL), ref = bookStats(rB, rE), pb = P.dailyMetrics(P.book(Array.from(rB), Array.from(rE)).r, pdays)
  check('mesure de la v1 complète = portefeuille publié', Math.abs(mAll.sharpe5050 - pb.sharpe) < 1e-9 && Math.abs(ref.maxDD - pb.maxDD) < 1e-9, `Sharpe ${mAll.sharpe5050.toFixed(6)} vs ${pb.sharpe.toFixed(6)}, drawdown ${pb.maxDD.toFixed(4)}`)
}
const ME2 = measure(E2)

// ================================================================ A. sélections aléatoires
const rand = P.rng(SEED)
const strataOf = (key: (j: number) => string) => { const m = new Map<string, number[]>(); for (let j = 0; j < N; j++) { const s = key(j); if (!m.has(s)) m.set(s, []); m.get(s)!.push(j) } return [...m.values()].map(idx => ({ idx, n: idx.filter(j => E2[j]).length })) }
const STRATA = { assetYear: strataOf(j => `${AS[j]}|${SH[j].year}`), asset: strataOf(j => String(AS[j])) }
const draw = (strata: { idx: number[]; n: number }[]) => { const keep = new Uint8Array(N); for (const g of strata) { const a = g.idx.slice(); for (let q = 0; q < g.n; q++) { const r = q + Math.floor(rand() * (a.length - q)); [a[q], a[r]] = [a[r], a[q]]; keep[a[q]] = 1 } } return keep }
const A: Record<string, Record<Metric, Float64Array>> = {}
const firstKeeps: Uint8Array[] = []
for (const [name, strata] of Object.entries(STRATA)) {
  A[name] = Object.fromEntries(METRICS.map(m => [m, new Float64Array(NA)])) as Record<Metric, Float64Array>
  for (let b = 0; b < NA; b++) {
    const keep = draw(strata)
    if (name === 'assetYear' && b < NA_EXACT) firstKeeps.push(keep)
    const m = measure(keep)
    for (const x of METRICS) A[name][x][b] = m[x]
  }
  log(`test A (${name}) : ${NA} tirages`)
}
// Validation du retrait additif : re-simulation exacte des 1 000 premières sélections (stratifiées par actif et par année).
function selectionRun(keep: ArrayLike<number>) {
  const out = {} as Record<SleeveKey, ShockResult>
  for (const k of KEYS) {
    const sel = new Uint8Array(S[k].bars.n)
    for (const p of V0[k].positions) if (p.dir === -1 && !inSample(k, p)) sel[p.entryIdx] = 1
    SH.forEach((x, j) => { if (x.k === k && keep[j]) sel[x.p.entryIdx] = 1 })
    out[k] = run(k, sel)
  }
  return bookStats(daily('btc', out.btc.equity).r, daily('ethusdt', out.ethusdt.equity).r)
}
const exact = { sharpe: new Float64Array(NA_EXACT), dd: new Float64Array(NA_EXACT) }
firstKeeps.forEach((keep, b) => { const e = selectionRun(keep); exact.sharpe[b] = e.sharpe; exact.dd[b] = e.maxDD; if ((b + 1) % 250 === 0) log(`re-simulation exacte ${b + 1}/${NA_EXACT}`) })
const E2exact = selectionRun(E2)
const errs = Array.from(exact.sharpe, (x, b) => Math.abs(x - A.assetYear.sharpe5050[b]))
const additiveOK = P.mean(errs) <= 0.02
log('test A : validation')

// ================================================================ B. décalages du régime
const GRID = Object.fromEntries(KEYS.map(k => {
  const t = S[k].bars.t, lo = t[S[k].lo], L = Math.round((CUT - lo) / M15), flag = new Uint8Array(L)
  let i = S[k].lo
  for (let s = 0; s < L; s++) { const ts = lo + s * M15; while (i + 1 < S[k].bars.n && t[i + 1] <= ts) i++; flag[s] = TREND[k][i] }
  return [k, { lo, L, flag, days: Math.floor(L / 96) }]
})) as Record<SleeveKey, { lo: number; L: number; flag: Uint8Array; days: number }>
const slot = SH.map(x => Math.round((x.t - GRID[x.k].lo) / M15))
const shifted = (kB: number, kE: number) => Uint8Array.from(SH, (x, j) => { const g = GRID[x.k], kd = x.a ? kE : kB, s = (((slot[j] - kd * 96) % g.L) + g.L) % g.L; return g.flag[s] })
check('décalage nul = E2', shifted(0, 0).every((v, j) => v === E2[j]), `${N} shorts`)
const dBTC = (keep: Uint8Array) => dPooled(keep, 0), dETH = (keep: Uint8Array) => dPooled(keep, 1)
const E2D = { btc: dBTC(E2), eth: dETH(E2), eq: (dBTC(E2) + dETH(E2)) / 2, pooled: dPooled(E2) }
// Propriétés du régime (au pas journalier, sur la fenêtre de chaque actif).
const regimeProps = (k: SleeveKey) => {
  const g = GRID[k], d = Array.from({ length: g.days }, (_, j) => g.flag[j * 96 + 95])
  const runs: { v: number; n: number }[] = []
  for (const v of d) { if (runs.length && runs[runs.length - 1].v === v) runs[runs.length - 1].n++; else runs.push({ v, n: 1 }) }
  const len = (v: number) => runs.filter(r => r.v === v).map(r => r.n)
  const m = P.mean(d), ac = (lag: number) => { let s = 0, s0 = 0; for (let j = 0; j + lag < d.length; j++) s += (d[j] - m) * (d[j + lag] - m); for (const x of d) s0 += (x - m) ** 2; return s / s0 }
  return { days: g.days, shareBear: m, runsBear: len(1).length, runsOther: len(0).length, meanBear: P.mean(len(1)), medianBear: P.quantile(len(1), 0.5), meanOther: P.mean(len(0)), medianOther: P.quantile(len(0), 0.5), ac90: ac(90), ac180: ac(180), ac365: ac(365) }
}
const PROPS = Object.fromEntries(KEYS.map(k => [NAME[k], regimeProps(k)]))
const B = KMINS.map(kmin => {
  const btc: number[] = [], eth: number[] = [], eq: number[] = [], pooled: number[] = [], sharpe: number[] = []
  for (let k = kmin; k <= GRID.btc.days - kmin; k++) btc.push(dBTC(shifted(k, 0)))
  for (let k = kmin; k <= GRID.ethusdt.days - kmin; k++) eth.push(dETH(shifted(0, k)))
  const Lmin = Math.min(GRID.btc.days, GRID.ethusdt.days)
  for (let k = kmin; k <= Lmin - kmin; k++) { const keep = shifted(k, k); const b = dBTC(keep), e = dETH(keep); eq.push((b + e) / 2); pooled.push(dPooled(keep)); if (kmin === 180) sharpe.push(measure(keep).sharpe5050) }
  return { kmin, btc, eth, eq, pooled, sharpe }
})
log('test B')

// ================================================================ sorties
const pMC = (xs: ArrayLike<number>, v: number) => { let c = 0, n = 0; for (let j = 0; j < xs.length; j++) { if (!Number.isFinite(xs[j])) continue; n++; if (xs[j] >= v) c++ } return (1 + c) / (1 + n) }
const pctl = (xs: ArrayLike<number>, v: number) => { let c = 0, n = 0; for (let j = 0; j < xs.length; j++) { if (!Number.isFinite(xs[j])) continue; n++; if (xs[j] < v) c++ } return (100 * c) / n }
const q = (xs: ArrayLike<number>) => { const a = Array.from(xs).filter(Number.isFinite); return { p5: P.quantile(a, 0.05), p50: P.quantile(a, 0.5), p95: P.quantile(a, 0.95), n: a.length } }
const num = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—')
const sgn = (x: number, d = 3) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + num(x, d) : '—')
const pv = (p: number) => (p < 0.0001 ? p.toExponential(1).replace('.', ',') : num(p, 4))
let commit = 'inconnu', clean = false
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); clean = execSync('git status --porcelain -- lib research/shock research/lib research/preregistration', { cwd: ROOT }).toString().trim() === '' } catch { /* hors git */ }
const LABEL: Record<Metric, string> = { EV: 'EV des shorts gardés (σ)', PF: 'PF des shorts gardés', payoff: 'Payoff des shorts gardés', D: 'D (gardés − rejetés, σ)', sharpeBTC: 'Sharpe sleeve BTC', ddBTC: 'Drawdown sleeve BTC', sharpeETH: 'Sharpe sleeve ETH', ddETH: 'Drawdown sleeve ETH', sharpe5050: 'Sharpe 50/50', dd5050: 'Drawdown 50/50' }
const fmt = (m: Metric, x: number) => (m.startsWith('dd') ? `${num(x * 100, 1)} %` : m === 'EV' || m === 'D' ? sgn(x) : num(x, 2))

const L: string[] = []
L.push('# Falsification Monte-Carlo de E2 · tests A et B', '')
L.push(`Pré-spécification : \`${PRESPEC}\` (commitée avant tout calcul). Produit par \`node research/shock/e2-falsification.ts\` au commit \`${commit.slice(0, 7)}\`${clean ? '' : ' (arbre de travail modifié)'}. E2 figée ; données historiques déjà vues ; simulation après coûts modélisés, pas une performance live.`, '')
L.push(`Échantillon : ${N} shorts v1 (BTC depuis 2017, ETH depuis 2018-09) fermés avant le 2026-10-01, dont ${P.sum(E2)} en régime E2 baissier. Stratégie complète : période commune 2018-09-01 → 2026-09-30.`, '')
L.push('## Test A — sélections aléatoires à fréquence égale', '')
L.push(`${NA} sélections par stratification, autant de shorts que E2 dans chaque strate. p = (1 + nombre ≥ E2) / (1 + ${NA}) ; percentile = part des sélections sous E2. Drawdowns : « ≥ » veut dire moins profond.`, '')
for (const [name, title] of [['assetYear', 'Stratifié par actif et par année (principal)'], ['asset', 'Stratifié par actif (secondaire)']] as const) {
  L.push(`### ${title}`, '')
  L.push('| Mesure | E2 | Placebo P5 | Médiane | P95 | Percentile de E2 | p Monte-Carlo |', '|---|---|---|---|---|---|---|')
  for (const m of METRICS) { const d = q(A[name][m]); L.push(`| ${LABEL[m]} | ${fmt(m, ME2[m])} | ${fmt(m, d.p5)} | ${fmt(m, d.p50)} | ${fmt(m, d.p95)} | ${num(pctl(A[name][m], ME2[m]), 1)} | ${pv(pMC(A[name][m], ME2[m]))} |`) }
  L.push('')
}
const ex = q(exact.sharpe)
L.push(`**Validation du retrait additif** (1 000 premières sélections actif × année, re-simulées exactement) : écart absolu moyen de Sharpe 50/50 ${num(P.mean(errs), 4)}, maximum ${num(Math.max(...errs), 4)} (seuil 0,02 : ${additiveOK ? 'retrait additif retenu' : 'la re-simulation exacte devient la référence'}). Re-simulation exacte : E2 ${num(E2exact.sharpe, 3)} (additif ${num(ME2.sharpe5050, 3)}), placebo P5 ${num(ex.p5, 2)}, médiane ${num(ex.p50, 2)}, P95 ${num(ex.p95, 2)}, p Monte-Carlo ${pv(pMC(exact.sharpe, E2exact.sharpe))} ; drawdown exact : p ${pv(pMC(exact.dd, E2exact.maxDD))}.`, '')
L.push('## Test B — décalages circulaires du régime', '')
L.push('Propriétés de la série E2 (pas journalier), conservées par le décalage sauf à la couture :', '')
L.push('| Actif | Jours | Part du temps baissier | Phases baissières · autres | Durée moyenne (médiane) baissière | Durée moyenne (médiane) autre | Autocorrélation 90 j · 180 j · 365 j |', '|---|---|---|---|---|---|---|')
for (const [a, p] of Object.entries(PROPS)) L.push(`| ${a} | ${p.days} | ${num(p.shareBear * 100, 1)} % | ${p.runsBear} · ${p.runsOther} | ${num(p.meanBear, 1)} j (${p.medianBear}) | ${num(p.meanOther, 1)} j (${p.medianOther}) | ${num(p.ac90, 2)} · ${num(p.ac180, 2)} · ${num(p.ac365, 2)} |`)
L.push('')
L.push('| kmin | Analyse | Décalages | D(E2) | Placebo P5 | Médiane | P95 | Percentile de E2 | p Monte-Carlo |', '|---|---|---|---|---|---|---|---|---|')
for (const b of B) {
  const rows: [string, number[], number][] = [['BTC', b.btc, E2D.btc], ['ETH', b.eth, E2D.eth], ['Portefeuille égal : D_eq', b.eq, E2D.eq], ['Shorts mis en commun : D', b.pooled, E2D.pooled]]
  for (const [n, xs, v] of rows) { const d = q(xs); L.push(`| ${b.kmin} j${b.kmin === 180 ? ' (principal)' : ''} | ${n} | ${xs.length} | ${sgn(v)} | ${sgn(d.p5)} | ${sgn(d.p50)} | ${sgn(d.p95)} | ${num(pctl(xs, v), 1)} | ${pv(pMC(xs, v))} |`) }
}
const sh = q(B[0].sharpe)
L.push('', `Sharpe 50/50 en ne gardant que les shorts du régime décalé (kmin 180, retrait additif) : E2 ${num(ME2.sharpe5050, 2)}, placebo P5 ${num(sh.p5, 2)}, médiane ${num(sh.p50, 2)}, P95 ${num(sh.p95, 2)}, p ${pv(pMC(B[0].sharpe, ME2.sharpe5050))}.`, '')
L.push('## Lecture pré-spécifiée', '')
const pA = pMC(A.assetYear.EV, ME2.EV), pB = pMC(B[0].eq, E2D.eq)
L.push(`- Test A (EV, actif × année) : p = ${pv(pA)} → ${pA <= 0.05 ? 'avantage **exceptionnel** face à ce test' : 'avantage **non exceptionnel** face à ce test'}.`)
L.push(`- Test B (D_eq, kmin 180) : p = ${pv(pB)} → ${pB <= 0.05 ? 'avantage **exceptionnel** face à ce test' : 'avantage **non exceptionnel** face à ce test'}.`)
L.push('- Données déjà vues : un résultat « exceptionnel » ici ne valide pas E2 ; il dit seulement que ces contrefactuels ne l\'expliquent pas.', '')
L.push(`## Contrôles (${checks.filter(c => c.ok).length}/${checks.length})`, '')
for (const c of checks) L.push(`- ${c.ok ? '✔' : '✘'} ${c.name} · ${c.detail}`)
L.push('')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'tests-ab.md'), L.join('\n'))
const summ = (xs: ArrayLike<number>, v: number) => ({ ...q(xs), percentile: pctl(xs, v), p: pMC(xs, v) })
writeFileSync(join(OUT, 'tests-ab.json'), JSON.stringify({
  prespec: PRESPEC, commit, sourcesClean: clean, generatedAt: new Date().toISOString(), n: N, e2: ME2, e2D: E2D,
  testA: Object.fromEntries(Object.entries(A).map(([name, a]) => [name, Object.fromEntries(METRICS.map(m => [m, summ(a[m], ME2[m])]))])),
  additive: { meanAbsErr: P.mean(errs), maxAbsErr: Math.max(...errs), retained: additiveOK, exactE2: E2exact, exactSharpe: summ(exact.sharpe, E2exact.sharpe), exactDD: summ(exact.dd, E2exact.maxDD) },
  testB: B.map(b => ({ kmin: b.kmin, btc: summ(b.btc, E2D.btc), eth: summ(b.eth, E2D.eth), eq: summ(b.eq, E2D.eq), pooled: summ(b.pooled, E2D.pooled), sharpe: b.sharpe.length ? summ(b.sharpe, ME2.sharpe5050) : null })),
  regime: PROPS, checks,
}, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(10) : x), 1))
log(`écrit ${OUT}/tests-ab.{md,json}`)
