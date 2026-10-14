// Inférence statistique sur Shock Engine V1 figée (research/preregistration/v1-inference.md) : IC du score du signal,
// IR contre le buy & hold 50/50, appraisal ratio (M2 de l'étude d'alpha résiduel), intervalle et significativité du
// Sharpe, avec correction de la dépendance temporelle. Descriptif, lecture seule, aucune optimisation.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/v1-inference.ts [controls]
//
// Sortie : research/reports/shock-fade/v1-inference/{report.md, results.json}.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15 } from '../../lib/regime-er.ts'
import { dailyOf as dailyOfEq } from '../../lib/variant-eval.ts'
import { calmOnly } from '../../lib/calm-only.ts'
import { costsFor } from '../../lib/frozen-shock.ts'
import type { SleeveKey } from '../../lib/frozen-shock.ts'
import { normCdf, normInv, psr } from '../../lib/overfit.ts'
import { referenceSleeve } from '../../proba/dataset.ts'
import { signalFeatures } from '../../proba/features.ts'
import { HORIZONS } from '../../proba/config.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'

const MODE = process.argv[2] ?? 'run'
const ROOT = join(import.meta.dirname, '../../..')
const OUT = join(ROOT, 'research/reports/shock-fade/v1-inference')
const DAY = P.DAY, ANN = P.ANN, ANNF = Math.sqrt(ANN)
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const fail = (m: string) => { throw new Error(`contrôle en échec : ${m}`) }
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))

// ================================================================ V1 et signaux
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const REFS = KEYS.map(k => referenceSleeve(k))
const S = REFS.map(r => r.sleeve)
const SIG = REFS.map((r, j) => calmOnly(r.signals, S[j].select))
const RUNS = S.map((s, j) => simulate(s.m, s.preset.sets, costsFor(KEYS[j], 1), s.lo, s.end, s.select, SIG[j]))
const tStart = Math.max(...S.map(s => s.bars.t[s.lo])), tEnd = Math.min(...S.map(s => s.bars.t[s.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1, T = PD1 - PD0 + 1
const DAYS = Array.from({ length: T }, (_, k) => PD0 + k)
const SL = S.map((s, j) => dailyOfEq(s.bars, RUNS[j].equity, s.lo, s.end, PD0, PD1).r)
const V1 = P.book(SL[0], SL[1]).r
const srAnn = (x: ArrayLike<number>) => P.dailyMetrics(Array.from(x), DAYS).sharpe

// ================================================================ facteurs de l'étude d'alpha résiduel (copie de research/shock/residual-alpha.ts)
const COMM = 0.045 / 100
const bars = Object.fromEntries(KEYS.map((k, j) => [k, S[j].bars])) as Record<SleeveKey, (typeof S)[0]['bars']>
function closesOf(key: SleeveKey) {
  const b = bars[key], first = Math.floor(b.t[0] / DAY), all: number[] = []
  for (let d = first; d <= PD1; d++) all.push(d)
  const last = (() => { let lo = 0, hi = b.n; const ms = (PD1 + 1) * DAY; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < ms) lo = m + 1; else hi = m } return lo - 1 })()
  const { eq: close } = P.dayCloses(b.t, b.c, 0, last, all, b.c[0])
  return { all, close, at: all.indexOf(PD0), last }
}
const DL = Object.fromEntries(KEYS.map(k => [k, closesOf(k)])) as Record<SleeveKey, ReturnType<typeof closesOf>>
type Pos = Int8Array
function rollMax(c: ArrayLike<number>, n: number): Float64Array {
  const out = new Float64Array(c.length).fill(NaN), q = new Int32Array(c.length)
  let h = 0, t = 0
  for (let i = 0; i < c.length; i++) {
    if (i >= n) { while (h < t && q[h] < i - n) h++; out[i] = c[q[h]] }
    while (h < t && c[q[t - 1]] <= c[i]) t--
    q[t++] = i
  }
  return out
}
const rollMin = (c: ArrayLike<number>, n: number) => { const neg = Float64Array.from(c as ArrayLike<number>, x => -x); return rollMax(neg, n).map(x => -x) }
function tsmom(c: ArrayLike<number>, L: number): Pos { const p = new Int8Array(c.length); for (let i = L; i < c.length; i++) { const r = c[i] / c[i - L] - 1; p[i] = r > 0 ? 1 : r < 0 ? -1 : 0 } return p }
function donch(c: ArrayLike<number>, ne: number, nx: number): Pos {
  const p = new Int8Array(c.length), hiE = rollMax(c, ne), loE = rollMin(c, ne), hiX = rollMax(c, nx), loX = rollMin(c, nx)
  let s = 0
  for (let i = 0; i < c.length; i++) {
    if (i >= ne) { if (s === 1 && c[i] < loX[i]) s = 0; else if (s === -1 && c[i] > hiX[i]) s = 0; if (s === 0) { if (c[i] > hiE[i]) s = 1; else if (c[i] < loE[i]) s = -1 } }
    p[i] = s
  }
  return p
}
function ema(c: ArrayLike<number>, f: number, sl: number): Pos {
  const p = new Int8Array(c.length), af = 2 / (f + 1), as = 2 / (sl + 1)
  let ef = c[0], es = c[0]
  for (let i = 0; i < c.length; i++) { if (i) { ef += af * (c[i] - ef); es += as * (c[i] - es) } p[i] = ef > es ? 1 : -1 }
  return p
}
function stratReturns(c: ArrayLike<number>, p: Pos, cost: number): Float64Array {
  const r = new Float64Array(c.length)
  for (let i = 0; i + 1 < c.length; i++) r[i + 1] = p[i] * (c[i + 1] / c[i] - 1) - cost * Math.abs(p[i] - (i ? p[i - 1] : 0))
  return r
}
type Spec = { id: string; kind: 'bh' | 'tsmom' | 'donch' | 'ema' | 'donch15'; a?: number; b?: number }
const posDaily = (s: Spec, c: ArrayLike<number>): Pos => (s.kind === 'bh' ? new Int8Array(c.length).fill(1) : s.kind === 'tsmom' ? tsmom(c, s.a!) : s.kind === 'donch' ? donch(c, s.a!, s.b!) : ema(c, s.a!, s.b!))
function benchDaily(key: SleeveKey, s: Spec, cost: number): number[] {
  const d = DL[key]
  if (s.kind !== 'donch15') return Array.from(stratReturns(d.close, posDaily(s, d.close), s.kind === 'bh' ? 0 : cost).subarray(d.at, d.at + T))
  const b = bars[key], c = b.c.subarray(0, d.last + 1), r = stratReturns(c, donch(c, s.a!, s.b!), cost)
  const eq = new Float64Array(c.length)
  let v = 1
  for (let i = 0; i < c.length; i++) { v *= 1 + r[i]; eq[i] = v }
  return P.returnsOf(P.dayCloses(b.t, eq, 0, d.last, d.all, 1).eq, 1).slice(d.at, d.at + T)
}
const MAIN: Spec[] = [{ id: 'TSMOM30', kind: 'tsmom', a: 30 }, { id: 'TSMOM90', kind: 'tsmom', a: 90 }, { id: 'TSMOM180', kind: 'tsmom', a: 180 }, { id: 'DONCH55/20', kind: 'donch', a: 55, b: 20 }, { id: 'EMA20/100', kind: 'ema', a: 20, b: 100 }]
const INTRA: Spec = { id: 'DONCH15 96/48', kind: 'donch15', a: 96, b: 48 }
const F: Record<string, { BTC: number[]; ETH: number[] }> = {}
for (const s of [{ id: 'BH', kind: 'bh' } as Spec, ...MAIN, INTRA]) F[s.id] = { BTC: benchDaily('btc', s, COMM), ETH: benchDaily('ethusdt', s, COMM) }
const half = (a: number[], b: number[]) => a.map((x, i) => 0.5 * (x + b[i]))
const designOf = (trend: string[]) => [F.BH.BTC, F.BH.ETH, ...trend.map(id => half(F[id].BTC, F[id].ETH))]
const XM0 = designOf([]), XM1 = designOf(MAIN.map(s => s.id)), XM2 = designOf([...MAIN.map(s => s.id), INTRA.id])
const BH = P.book(F.BH.BTC, F.BH.ETH).r

// ================================================================ MCO (Newey–West) et appraisal ratio
function solve(A: number[][], y: number[]): number[] {
  const n = A.length, M = A.map((r, i) => [...r, y[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => r[n] / r[i])
}
const nwLag = (n: number) => Math.floor(4 * Math.pow(n / 100, 2 / 9))
const LAG = nwLag(T)
/** MCO sur les jours idx (constante + X) : coefficients, résidus, t de Newey–West de la constante (si nw). */
function ols(y: ArrayLike<number>, X: number[][], idx: ArrayLike<number>, nw = false) {
  const n = idx.length, k = X.length + 1, r = new Float64Array(k)
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0)
  for (let q = 0; q < n; q++) { const i = idx[q]; r[0] = 1; for (let a = 1; a < k; a++) r[a] = X[a - 1][i]; for (let a = 0; a < k; a++) { Xty[a] += r[a] * y[i]; for (let b = 0; b < k; b++) XtX[a][b] += r[a] * r[b] } }
  const coef = solve(XtX, Xty)
  const resid = new Float64Array(n)
  for (let q = 0; q < n; q++) { const i = idx[q]; let f = coef[0]; for (let a = 1; a < k; a++) f += coef[a] * X[a - 1][i]; resid[q] = y[i] - f }
  const sdE = Math.sqrt(P.mean(Array.from(resid, e => e * e)) - P.mean(resid) ** 2)
  let tAlpha = NaN
  if (nw) {
    const Q = Array.from({ length: k }, (_, j) => solve(XtX, Array.from({ length: k }, (__, i) => (i === j ? 1 : 0))))
    const row = (q: number) => { const i = idx[q]; return [1, ...X.map(x => x[i])] }
    const xe = Array.from({ length: n }, (_, q) => row(q).map(v => v * resid[q]))
    const Sm = Array.from({ length: k }, () => new Array(k).fill(0))
    for (let l = 0; l <= LAG; l++) { const w = l === 0 ? 1 : 1 - l / (LAG + 1); for (let q = l; q < n; q++) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { const v = xe[q][a] * xe[q - l][b]; Sm[a][b] += l === 0 ? v : w * (v + xe[q - l][a] * xe[q][b]) } }
    let v00 = 0
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) v00 += Q[0][a] * Sm[a][b] * Q[b][0]
    tAlpha = coef[0] / Math.sqrt(v00)
  }
  return { coef, sdE, ar: (coef[0] / sdE) * ANNF, alphaAnn: coef[0] * ANN, tAlpha }
}
const ALL = Int32Array.from({ length: T }, (_, i) => i)

// ================================================================ contrôles
const v1Trades = RUNS.map((r, j) => r.positions.filter(p => !p.exits.includes('END') && S[j].bars.t[p.entryIdx] >= REF[0] && S[j].bars.t[p.entryIdx] < REF[1]))
if (v1Trades[0].length !== 358 || v1Trades[1].length !== 358) fail('716 trades')
if (Math.abs(srAnn(V1) - 2.0242079) > 1e-6) fail(`Sharpe V1 ${srAnn(V1)}`)
const SITE = json('lib/research/btc-eth-portfolio.json')
if (Math.abs(srAnn(BH) - SITE.buyHold.sharpe) > 1e-6) fail(`Sharpe buy & hold ${srAnn(BH)} ≠ ${SITE.buyHold.sharpe}`)
const RA = json('research/reports/residual-alpha/residual-alpha.json')
const raM2 = (RA.models ?? RA.results ?? []).find((m: any) => m.model === 'M2' && m.series === 'portfolio') ?? { alphaAnn: SITE.residualAlpha.alphaAnn, t: SITE.residualAlpha.t, ir: SITE.residualAlpha.ir }
const M2 = ols(V1, XM2, ALL, true)
if (Math.abs(M2.alphaAnn - raM2.alphaAnn) > 1e-6 || Math.abs(M2.tAlpha - raM2.t) > 1e-4 || Math.abs(M2.ar - raM2.ir) > 1e-3) fail(`M2 : α ${M2.alphaAnn} t ${M2.tAlpha} AR ${M2.ar} ≠ ${raM2.alphaAnn} / ${raM2.t} / ${raM2.ir}`)
const CONTROLS = [`V1 : 716 trades, Sharpe ${srAnn(V1).toFixed(4)}`, `buy & hold 50/50 : Sharpe ${srAnn(BH).toFixed(4)} (fiche)`,
  `M2 : α ${(100 * M2.alphaAnn).toFixed(1)} %, t ${M2.tAlpha.toFixed(2)}, ratio résiduel ${M2.ar.toFixed(2)} (étude d'alpha résiduel)`]
if (MODE === 'controls') { console.log('contrôles OK :\n- ' + CONTROLS.join('\n- ')); process.exit(0) }

// ================================================================ outils
const rng = P.rng(20261014)
const B = 5000, BAR = 2000
/** Indices d'un tirage bootstrap circulaire par blocs de L jours (L = 0 : mois calendaires). */
const months: number[][] = []
{ let cur = NaN; DAYS.forEach((d, k) => { const m = P.monthKey(d); if (m !== cur) { months.push([]); cur = m } months[months.length - 1].push(k) }) }
function draw(L: number): Int32Array {
  const out = new Int32Array(T)
  let n = 0
  if (L === 0) { while (n < T) { const g = months[Math.floor(rng() * months.length)]; for (const k of g) { if (n >= T) break; out[n++] = k } } return out }
  while (n < T) { const s = Math.floor(rng() * T); for (let k = 0; k < L && n < T; k++) out[n++] = (s + k) % T }
  return out
}
const shIdx = (x: ArrayLike<number>, idx: ArrayLike<number>) => { let s = 0, q = 0; for (let k = 0; k < idx.length; k++) { const v = x[idx[k]]; s += v; q += v * v } const n = idx.length, m = s / n, v = q / n - m * m; return v > 0 ? (m / Math.sqrt(v)) * ANNF : 0 }
const ci = (xs: number[]) => ({ lo: P.quantile(xs, 0.025), hi: P.quantile(xs, 0.975) })
const BLOCKS = [5, 21, 63, 126, 0]
const blockLabel = (L: number) => (L === 0 ? 'mois calendaires' : `${L} jours`)
const m0 = (x: ArrayLike<number>) => { const n = x.length; let m = 0; for (let i = 0; i < n; i++) m += x[i]; m /= n; let m2 = 0, m3 = 0, m4 = 0; for (let i = 0; i < n; i++) { const d = x[i] - m; m2 += d * d; m3 += d ** 3; m4 += d ** 4 } m2 /= n; m3 /= n; m4 /= n; const sd = Math.sqrt(m2); return { n, mean: m, sd, skew: m3 / sd ** 3, kurt: m4 / sd ** 4 } }
const acf = (x: ArrayLike<number>, k: number) => { const m = m0(x); let s = 0; for (let i = k; i < m.n; i++) s += (x[i] - m.mean) * (x[i - k] - m.mean); return s / m.n / (m.sd * m.sd) }

// ================================================================ 4. Sharpe : estimations, erreurs types, bootstrap, PSR
function sharpeBlock(x: number[]) {
  const m = m0(x), sr = m.mean / m.sd
  const rho = Array.from({ length: 10 }, (_, k) => acf(x, k + 1))
  const q = 365
  const eta = q / Math.sqrt(q + 2 * rho.reduce((s, r, k) => s + (q - (k + 1)) * r, 0))
  const seNorm = Math.sqrt((1 + sr * sr / 2) / m.n), seMert = Math.sqrt((1 - m.skew * sr + ((m.kurt - 1) / 4) * sr * sr) / (m.n - 1))
  const seHac = (L: number) => {
    const g = Array.from({ length: m.n }, (_, t) => [x[t] - m.mean, (x[t] - m.mean) ** 2 - m.sd * m.sd])
    const O = [[0, 0], [0, 0]]
    for (let l = 0; l <= L; l++) { const w = l === 0 ? 1 : 1 - l / (L + 1); for (let t = l; t < m.n; t++) for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const v = g[t][a] * g[t - l][b] / m.n; O[a][b] += l === 0 ? v : w * (v + g[t - l][a] * g[t][b] / m.n) } }
    const gr = [1 / m.sd, -m.mean / (2 * m.sd ** 3)]
    return Math.sqrt((gr[0] * (O[0][0] * gr[0] + O[0][1] * gr[1]) + gr[1] * (O[1][0] * gr[0] + O[1][1] * gr[1])) / m.n)
  }
  const lb = m.n * (m.n + 2) * rho.reduce((s, r, k) => s + r * r / (m.n - (k + 1)), 0)
  const lbP = Math.exp(-lb / 2) * [0, 1, 2, 3, 4].reduce((s, j) => s + (lb / 2) ** j / [1, 1, 2, 6, 24][j], 0) // khi-deux à 10 degrés (pair)
  const per = (key: (d: number) => number) => P.periodReturns(x, DAYS, key).map(p => p.ret)
  const wk = per(P.weekKey), mo = per(P.monthKey), mw = m0(wk), mm = m0(mo)
  const boot = BLOCKS.map(L => { const xs: number[] = []; for (let b = 0; b < B; b++) xs.push(shIdx(x, draw(L))); return { L, ...ci(xs), sd: Math.sqrt(m0(xs).sd ** 2) } })
  const hac = [LAG, 21, 63].map(L => ({ L, se: seHac(L) * ANNF }))
  return {
    sr: sr * ANNF, srWeekly: (mw.mean / mw.sd) * Math.sqrt(ANN / 7), srMonthly: (mm.mean / mm.sd) * Math.sqrt(12), srLo: sr * eta, eta,
    skew: m.skew, kurt: m.kurt, rho: rho.slice(0, 5), lb, lbP,
    se: { norm: seNorm * ANNF, mertens: seMert * ANNF, hac }, boot,
  }
}
const SRV1 = sharpeBlock(V1)
const srBH = srAnn(BH)
const psrOf = (srA: number, ref: number, seA: number) => normCdf((srA - ref) / seA)
const PSR = [0, srBH].map(ref => ({ ref, std: psr(V1, ref / ANNF).p, hac: psrOf(SRV1.sr, ref, SRV1.se.hac[0].se) }))

// ================================================================ 2. IR contre le buy & hold
const act = V1.map((v, t) => v - BH[t])
const irAnn = (x: ArrayLike<number>, idx: ArrayLike<number>) => shIdx(x, idx)
const irPoint = irAnn(act, ALL)
const irT = ols(act, [], ALL, true).tAlpha
const IRB = BLOCKS.map(L => { const xs: number[] = []; for (let b = 0; b < B; b++) xs.push(irAnn(act, draw(L))); return { L, ...ci(xs) } })
const beta = (() => { const r = ols(V1, [BH], ALL); return r.coef[1] })()
const te = m0(act).sd * ANNF

// ================================================================ 3. Appraisal ratio
const M0 = ols(V1, XM0, ALL, true), M1 = ols(V1, XM1, ALL, true)
const ARB = BLOCKS.map(L => { const xs: number[] = []; for (let b = 0; b < BAR; b++) xs.push(ols(V1, XM2, draw(L)).ar); return { L, ...ci(xs) } })

// ================================================================ 1. IC du score du signal
interface Ev { j: number; dir: 1 | -1; month: number; s: number; r: (number | null)[] }
const EV: Ev[] = []
let gaps = 0
S.forEach((s, j) => {
  const { t, c } = s.bars, ctx = REFS[j].ctx
  for (let i = s.lo; i <= s.end; i++) {
    if (t[i] < REF[0] || t[i] >= REF[1]) continue
    for (const dir of [1, -1] as const) {
      if (!(dir === 1 ? SIG[j].long[i] : SIG[j].short[i])) continue
      const f = signalFeatures(ctx, i, dir)
      const r = HORIZONS.map(h => {
        const Tt = t[i] + (h + 1) * M15
        let k = i
        while (k + 1 < s.bars.n && t[k + 1] + M15 <= Tt) k++
        if (t[k] + M15 !== Tt) { gaps++; return null }
        return (dir * Math.log(c[k] / c[i])) / f.atrPct
      })
      const d = new Date(t[i] + M15)
      EV.push({ j, dir, month: d.getUTCFullYear() * 12 + d.getUTCMonth(), s: f.absZ, r })
    }
  }
})
const spearman = (a: number[], b: number[]) => P.pearson(P.ranks(a), P.ranks(b))
function monthBoot<T extends { month: number }>(rows: T[], stat: (xs: T[]) => number, nb = B) {
  const by = new Map<number, T[]>()
  for (const r of rows) { if (!by.has(r.month)) by.set(r.month, []); by.get(r.month)!.push(r) }
  const ms = [...by.keys()], xs: number[] = []
  for (let b = 0; b < nb; b++) { const sel: T[] = []; for (let k = 0; k < ms.length; k++) sel.push(...by.get(ms[Math.floor(rng() * ms.length)])!); xs.push(stat(sel)) }
  const est = stat(rows)
  return { est, ...ci(xs), p: Math.min(1, 2 * Math.min(xs.filter(v => v <= 0).length, xs.filter(v => v >= 0).length) / nb), n: rows.length }
}
const icOf = (rows: Ev[], hk: number) => { const v = rows.filter(e => e.r[hk] !== null); return spearman(v.map(e => e.s), v.map(e => e.r[hk]!)) }
const meanOf = (rows: Ev[], hk: number) => P.mean(rows.filter(e => e.r[hk] !== null).map(e => e.r[hk]!))
const SUB: [string, (e: Ev) => boolean][] = [['tous', () => true], ['longs', e => e.dir === 1], ['shorts', e => e.dir === -1], ['BTC', e => e.j === 0], ['ETH', e => e.j === 1]]
const IC = SUB.map(([lab, f]) => { const rows = EV.filter(f); return { lab, n: rows.length, h: HORIZONS.map((_, hk) => ({ ic: monthBoot(rows, xs => icOf(xs, hk)), mean: monthBoot(rows, xs => meanOf(xs, hk), 2000) })) } })
const holmIC = (() => { const ps = IC[0].h.map(x => x.ic.p), o = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0]), out = new Array(ps.length).fill(1); let acc = 0; o.forEach(([p, i], r) => { acc = Math.max(acc, Math.min(1, (ps.length - r) * p)); out[i] = acc }); return out })()
const sCuts = [0.2, 0.4, 0.6, 0.8].map(q => P.quantile(EV.map(e => e.s), q))
const quint = (e: Ev) => sCuts.filter(c => e.s > c).length
const QUINT = [0, 1, 2, 3, 4].map(q => ({ q, n: EV.filter(e => quint(e) === q).length, sMed: P.quantile(EV.filter(e => quint(e) === q).map(e => e.s), 0.5), mean: HORIZONS.map((_, hk) => meanOf(EV.filter(e => quint(e) === q), hk)) }))
// Secondaire : trades exécutés, score à l'entrée contre R final
const TR = S.flatMap((s, j) => v1Trades[j].map(p => {
  const risk = s.preset.sets[p.set].atrStopMult * Math.max(p.atrAtEntry, s.preset.mintick), d = new Date(s.bars.t[p.entryIdx] + M15)
  return { month: d.getUTCFullYear() * 12 + d.getUTCMonth(), s: signalFeatures(REFS[j].ctx, p.entryIdx, p.dir).absZ, R: p.pnl / (p.qty * risk) }
}))
const ICT = monthBoot(TR, xs => spearman(xs.map(x => x.s), xs.map(x => x.R)))

// ================================================================ 6. addendum : croissance composée contre le buy & hold
const lv = V1.map(r => Math.log(1 + r)), lb = BH.map(r => Math.log(1 + r)), dl = lv.map((v, t) => v - lb[t])
const meanIdx = (x: ArrayLike<number>, idx: ArrayLike<number>) => { let s = 0; for (let k = 0; k < idx.length; k++) s += x[idx[k]]; return s / idx.length }
const dg = meanIdx(dl, ALL) * ANN
const dgT = ols(dl, [], ALL, true).tAlpha
const DGB = BLOCKS.map(L => { const xs: number[] = []; for (let b = 0; b < B; b++) xs.push(meanIdx(dl, draw(L)) * ANN); return { L, ...ci(xs), pNeg: xs.filter(v => v <= 0).length / B } })
const DSB = BLOCKS.map(L => { const xs: number[] = []; for (let b = 0; b < B; b++) { const d = draw(L); xs.push(shIdx(V1, d) - shIdx(BH, d)) } return { L, ...ci(xs), pNeg: xs.filter(v => v <= 0).length / B } })
const dec = (x: number[]) => { const m = m0(x); return { arith: m.mean * ANN, drag: 0.5 * m.sd * m.sd * ANN, vol: m.sd * ANNF, logg: P.mean(x.map(r => Math.log(1 + r))) * ANN } }
const DEC = { v1: dec(V1), bh: dec(BH), cagrV1: Math.exp(P.mean(lv) * ANN) - 1, cagrBH: Math.exp(P.mean(lb) * ANN) - 1 }

// ================================================================ rapport
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const sg = (x: number, d = 2) => (Number.isFinite(x) ? fr((x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const pc = (x: number, d = 1) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(100 * x).toFixed(d) + ' %') : '—')
/** Probabilité : « > 99,99 % » plutôt qu'un 100 % arrondi. */
const pp = (x: number) => (x > 0.9999 ? '> 99,99 %' : pc(x, 2))
const bg = (h: number) => `${h} bougie${h > 1 ? 's' : ''}`
const iv = (b: { lo: number; hi: number }, d = 2, f = sg) => `[${f(b.lo, d)} ; ${f(b.hi, d)}]`
const tb = (h: string[], rows: (string | number)[][]) => [`| ${h.join(' | ')} |`, `|${h.map((_, k) => (k ? '---:' : '---')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)]
const b21 = (xs: { L: number; lo: number; hi: number }[]) => xs.find(x => x.L === 21)!
const L: string[] = []
L.push('# Shock Engine V1 — inférence statistique : IC, IR, appraisal ratio, intervalle du Sharpe', '',
  'Protocole : `research/preregistration/v1-inference.md` (commité avant tout calcul). Généré par `research/fade/v1/v1-inference.ts`. V1 figée, lecture seule, aucune optimisation. '
  + `Portefeuille BTC/ETH 50/50, ${T} jours (${P.isoDay(PD0)} → ${P.isoDay(PD1)}), commissions de la fiche. **Tout est mesuré sur l'historique qui a servi à concevoir V1 : précision et significativité du résultat historique, pas validation prospective.**`, '',
  'Contrôles : ' + CONTROLS.join(' ; ') + '.', '',
  '## Résumé', '',
  ...tb(['mesure', 'estimation', 'intervalle à 95 % (blocs de 21 jours)', 'lecture'], [
    ['Sharpe de V1 (annualisé)', n(SRV1.sr), iv(b21(SRV1.boot), 2, n), `PSR(0) ${pp(PSR[0].hac)} ; PSR(SR* = buy & hold ${n(srBH)}) ${pp(PSR[1].hac)} (erreur type non iid)`],
    ['IR contre le buy & hold 50/50', n(irPoint), iv(b21(IRB)), `t de Newey–West ${n(irT)}`],
    ['Appraisal ratio (M2)', n(M2.ar), iv(b21(ARB), 2, n), `α ${pc(M2.alphaAnn)} par an, t ${n(M2.tAlpha)}`],
    [`IC du score |z|, horizon ${bg(HORIZONS[3])} (tous signaux)`, sg(IC[0].h[3].ic.est, 3), iv(IC[0].h[3].ic, 3), `p ${n(IC[0].h[3].ic.p, 3)} (Holm sur 4 horizons : ${n(holmIC[3], 3)})`],
  ]), '', `DSR (scénario prudent, \`dsr-reeval\`) : 98,9 %, non recalculé ici.`, '',
  '## 1. Coefficient d\'information du score du signal', '',
  `${EV.length} signaux d'entrée de V1 (${IC[1].n} longs, ${IC[2].n} shorts ; BTC ${IC[3].n}, ETH ${IC[4].n}), exécutés ou non ; ${gaps} fenêtres traversant un trou exclues. Score S = |z| du choc ; R_h = rendement log dans le sens du trade sur h bougies de 15 min, en ATR. `
  + 'IC = corrélation de Spearman ; intervalle à 95 % et p bilatéral par bootstrap des mois d\'événements (5 000 tirages).', '',
  ...tb(['événements', 'n', ...HORIZONS.map(h => `IC à ${bg(h)} [IC 95 %] · p`)], IC.map(g => [g.lab, g.n, ...g.h.map(x => `${sg(x.ic.est, 3)} ${iv(x.ic, 3)} · ${n(x.ic.p, 3)}`)])), '',
  `Holm sur les 4 horizons (tous événements) : ${HORIZONS.map((h, k) => `${h} : ${n(holmIC[k], 3)}`).join(' ; ')}.`, '',
  '**Rendement moyen dans le sens du trade (en ATR) et par quintile du score** : un IC nul n\'exclut pas une continuation moyenne positive.', '',
  ...tb(['événements', ...HORIZONS.map(h => `R moyen à ${bg(h)} [IC 95 %]`)], IC.map(g => [g.lab, ...g.h.map(x => `${sg(x.mean.est, 3)} ${iv(x.mean, 3)}`)])), '',
  ...tb(['quintile de |z|', 'n', '|z| médian', ...HORIZONS.map(h => `R moyen à ${bg(h)}`)], QUINT.map(q => [q.q + 1, q.n, n(q.sMed), ...q.mean.map(v => sg(v, 3))])), '',
  `Secondaire — ${TR.length} trades exécutés, |z| à l'entrée contre R final du trade : IC ${sg(ICT.est, 3)} ${iv(ICT, 3)}, p ${n(ICT.p, 3)}.`, '',
  '## 2. Ratio d\'information contre le buy & hold BTC/ETH 50/50', '',
  `Rendement actif a = r_V1 − r_BH (mêmes jours ; BH sans rebalancement, Sharpe ${n(srBH)}). IR ${n(irPoint)}, t de Newey–West ${n(irT)} (retard ${LAG}). Tracking error ${pc(te)} par an ; bêta de V1 sur le BH ${n(beta, 3)}.`, '',
  ...tb(['blocs', 'IC à 95 % de l\'IR'], IRB.map(x => [blockLabel(x.L), iv(x)])), '',
  '## 3. Appraisal ratio (alpha par unité de risque résiduel)', '',
  ...tb(['modèle', 'α par an', 't (Newey–West)', 'appraisal ratio'], [['M0 : buy & hold BTC, ETH', pc(M0.alphaAnn), n(M0.tAlpha), n(M0.ar)], ['M1 : + 5 tendances journalières', pc(M1.alphaAnn), n(M1.tAlpha), n(M1.ar)], ['**M2 : + Donchian 15 min (principal)**', pc(M2.alphaAnn), n(M2.tAlpha), `**${n(M2.ar)}**`]]), '',
  ...tb(['blocs (régression réestimée à chaque tirage, 2 000 tirages)', 'IC à 95 % de l\'appraisal ratio M2'], ARB.map(x => [blockLabel(x.L), iv(x, 2, n)])), '',
  '## 4. Intervalle de confiance et significativité du Sharpe de V1', '',
  `Rendements journaliers : asymétrie ${n(SRV1.skew)}, kurtosis ${n(SRV1.kurt, 1)} ; autocorrélations des retards 1 à 5 : ${SRV1.rho.map(r => sg(r, 3)).join(', ')} ; Q de Ljung–Box (10) = ${n(SRV1.lb, 1)}, p = ${n(SRV1.lbP, 3)}.`, '',
  ...tb(['estimation du Sharpe annualisé', 'valeur'], [['journalier × √365,25', n(SRV1.sr)], ['hebdomadaire × √52,18', n(SRV1.srWeekly)], ['mensuel × √12', n(SRV1.srMonthly)], [`journalier, annualisation corrigée de Lo (2002), retards 1 à 10 (η = ${n(SRV1.eta, 2)} contre √365 = ${n(Math.sqrt(365), 2)})`, n(SRV1.srLo)]]), '',
  ...tb(['méthode', 'erreur type', 'intervalle à 95 %'], [
    ['iid normale', n(SRV1.se.norm, 3), iv({ lo: SRV1.sr - 1.96 * SRV1.se.norm, hi: SRV1.sr + 1.96 * SRV1.se.norm }, 2, n)],
    ['iid non normale (Mertens)', n(SRV1.se.mertens, 3), iv({ lo: SRV1.sr - 1.96 * SRV1.se.mertens, hi: SRV1.sr + 1.96 * SRV1.se.mertens }, 2, n)],
    ...SRV1.se.hac.map(h => [`non iid, Newey–West retard ${h.L}${h.L === LAG ? ' (principal)' : ''}`, n(h.se, 3), iv({ lo: SRV1.sr - 1.96 * h.se, hi: SRV1.sr + 1.96 * h.se }, 2, n)]),
    ...SRV1.boot.map(b => [`bootstrap par blocs, ${blockLabel(b.L)}${b.L === 21 ? ' (principal)' : ''}`, n(b.sd, 3), iv(b, 2, n)]),
  ]), '',
  ...tb(['PSR : P(vrai Sharpe > SR*)', 'erreur type de Mertens (PSR standard)', 'erreur type non iid (Newey–West)'], PSR.map(p => [p.ref === 0 ? 'SR* = 0' : `SR* = ${n(p.ref)} (buy & hold 50/50, même période)`, pp(p.std), pp(p.hac)])), '',
  'DSR : 98,9 % dans le scénario prudent (essais réellement en concurrence, corrélations mesurées, sélection supposée sur le portefeuille, 7 fois plus de procédures) ; 87,6 % avec le décompte pré-enregistré initial (222 essais, σ 0,602). Voir `research/reports/shock-fade/dsr-reeval/`.', '',
  '## 5. Croissance composée contre le buy & hold (addendum)', '',
  `Δg = écart des rendements logarithmiques annualisés = ln((1 + CAGR V1) / (1 + CAGR BH)). CAGR V1 ${pc(DEC.cagrV1)}, BH ${pc(DEC.cagrBH)} : Δg = ${pc(dg)} par an, soit une croissance relative de ${pc(Math.exp(dg) - 1)} par an. t de Newey–West ${n(dgT)}.`, '',
  ...tb(['blocs', 'IC à 95 % de Δg', 'P(Δg ≤ 0)', 'IC à 95 % de l\'écart de Sharpe V1 − BH', 'P(écart ≤ 0)'], BLOCKS.map((L, k) => [blockLabel(L), iv(DGB[k], 1, (x: number) => pc(x)).replace(/[+]/g, ''), n(DGB[k].pNeg, 3), iv(DSB[k]), n(DSB[k].pNeg, 4)])), '',
  `Écart de Sharpe V1 − BH : ${sg(SRV1.sr - srBH)}.`, '',
  ...tb(['décomposition (annualisée)', 'V1', 'buy & hold', 'écart'], [
    ['rendement arithmétique moyen', pc(DEC.v1.arith), pc(DEC.bh.arith), pc(DEC.v1.arith - DEC.bh.arith)],
    ['volatilité', pc(DEC.v1.vol), pc(DEC.bh.vol), pc(DEC.v1.vol - DEC.bh.vol)],
    ['frein de volatilité (½ variance)', pc(DEC.v1.drag), pc(DEC.bh.drag), pc(DEC.v1.drag - DEC.bh.drag)],
    ['croissance logarithmique', pc(DEC.v1.logg), pc(DEC.bh.logg), pc(DEC.v1.logg - DEC.bh.logg)],
  ]), '',
  `L'écart de croissance vient ${Math.abs(DEC.v1.arith - DEC.bh.arith) < Math.abs(DEC.v1.drag - DEC.bh.drag) ? 'surtout de la moindre volatilité (moindre frein de volatilité), pas d\'un rendement moyen plus élevé' : 'surtout d\'un rendement moyen plus élevé'} ; son incertitude est dominée par la volatilité du buy & hold.`, '',
  '## Lecture', '',
  `- **Sharpe.** ${n(SRV1.sr)} sur les rendements journaliers, intervalle à 95 % ${iv(b21(SRV1.boot), 2, n)} ; toutes les méthodes (analytiques non iid, bootstrap de 5 à 126 jours, mois) donnent entre ${n(Math.min(...SRV1.boot.map(b => b.lo), ...SRV1.se.hac.map(h => SRV1.sr - 1.96 * h.se)))} et ${n(Math.max(...SRV1.boot.map(b => b.hi), ...SRV1.se.hac.map(h => SRV1.sr + 1.96 * h.se)))}. `
  + `Les rendements journaliers sont positivement autocorrélés (Ljung–Box p ${n(SRV1.lbP, 3)}) : l'annualisation par √365 surestime le Sharpe annuel. Corrigé (Lo) ou mesuré sur semaines ou mois, il vaut ${n(Math.min(SRV1.srLo, SRV1.srWeekly, SRV1.srMonthly))} à ${n(Math.max(SRV1.srLo, SRV1.srWeekly, SRV1.srMonthly))}, toujours nettement au-dessus de 0 et du buy & hold (${n(srBH)}).`,
  `- **Alpha.** Après neutralisation du buy & hold et des six facteurs de tendance, l'appraisal ratio vaut ${n(M2.ar)} ${iv(b21(ARB), 2, n)}, stable quelle que soit la longueur des blocs : l'alpha par unité de risque résiduel est la mesure la plus solide de l'étude.`,
  `- **IR contre le buy & hold : ≈ 0** (${n(irPoint)} ${iv(b21(IRB))}). V1 obtient un rendement moyen comparable à celui du buy & hold avec un bêta de ${n(beta, 2)} et beaucoup moins de risque ; la différence de rendements est dominée par la volatilité du buy & hold (tracking error ${pc(te, 0)}). Ce n'est pas la bonne mesure pour une stratégie peu exposée, mais le résultat est conservé tel quel.`,
  `- **Croissance composée contre le buy & hold : grande mais incertaine.** CAGR ${pc(DEC.cagrV1)} contre ${pc(DEC.cagrBH)}, soit ${pc(dg)} par an d'écart logarithmique ; intervalle à 95 % ${iv(b21(DGB), 1, (x: number) => pc(x)).replace(/[+]/g, '')}, P(écart ≤ 0) = ${n(b21(DGB).pNeg, 2)}. `
  + `Le rendement moyen est le même (${pc(DEC.v1.arith)} contre ${pc(DEC.bh.arith)}) : tout l'écart vient du moindre frein de volatilité, et la volatilité du buy & hold rend l'écart de croissance statistiquement non significatif sur 8 ans. `
  + `Ce qui est significatif, c'est l'écart de rendement ajusté du risque : Sharpe ${sg(SRV1.sr - srBH)} ${iv(b21(DSB))}, P(≤ 0) = ${n(b21(DSB).pNeg, 3)}.`,
  `- **IC du score : ≈ 0** à tous les horizons (de ${sg(Math.min(...IC[0].h.map(x => x.ic.est)), 3)} à ${sg(Math.max(...IC[0].h.map(x => x.ic.est)), 3)}, aucun significatif après Holm). Un choc plus fort que le seuil n'annonce pas une meilleure continuation. `
  + `En revanche, la continuation moyenne après un signal est nettement positive à tous les horizons (${sg(IC[0].h[0].mean.est, 2)} ATR à 1 bougie, ${sg(IC[0].h[3].mean.est, 2)} ATR à 64 bougies, intervalles hors de zéro) : la valeur vient de l'occurrence du signal, pas de l'intensité du score. Il n'y a donc pas lieu de moduler la taille des positions selon |z|.`, '',
  '## Limites', '',
  '- Historique unique, déjà utilisé pour concevoir V1 : ces intervalles mesurent l\'incertitude d\'échantillonnage du résultat historique, pas le biais de sélection (traité par le DSR) ni la persistance.',
  '- L\'IC porte sur le score de déclenchement (|z|) parmi des signaux déjà filtrés par ce score : il mesure si un choc plus fort annonce une meilleure continuation, pas si le signal a de la valeur (mesuré par les rendements moyens et l\'alpha).',
  '- L\'IR contre le buy & hold compare une stratégie exposée environ 16 % du temps à un actif très volatil ; l\'appraisal ratio, qui retire l\'exposition au marché et aux tendances, est la mesure pertinente de l\'alpha.', '')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n'))
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ protocol: 'research/preregistration/v1-inference.md', controls: CONTROLS, T, sharpe: SRV1, psr: PSR, srBH, ir: { point: irPoint, t: irT, boot: IRB, te, beta },
  appraisal: { M0: { alphaAnn: M0.alphaAnn, t: M0.tAlpha, ar: M0.ar }, M1: { alphaAnn: M1.alphaAnn, t: M1.tAlpha, ar: M1.ar }, M2: { alphaAnn: M2.alphaAnn, t: M2.tAlpha, ar: M2.ar }, boot: ARB },
  ic: { events: EV.length, gaps, groups: IC, holm: holmIC, quintiles: QUINT, trades: ICT }, growth: { dg, dgT, boot: DGB, sharpeDiffBoot: DSB, decomposition: DEC } },
(_, x) => (typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(8) : String(x)) : x), 1) + '\n')
console.log(`Sharpe ${SRV1.sr.toFixed(2)} [${b21(SRV1.boot).lo.toFixed(2)} ; ${b21(SRV1.boot).hi.toFixed(2)}] · IR ${irPoint.toFixed(2)} · AR ${M2.ar.toFixed(2)} · IC64 ${IC[0].h[3].ic.est.toFixed(3)}`)
