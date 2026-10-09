// Alpha résiduel du Shock Engine face à des stratégies de tendance simples, standard, non optimisées.
// Pré-spécification (commitée avant tout calcul) : research/preregistration/residual-alpha.md.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/residual-alpha.ts
//
// Rendements du Shock Engine : CSV publié du portefeuille (version publique, --variant e2). Références :
// buy & hold, TSMOM, Donchian, EMA (journalières) et Donchian 15 min, calculées sur les mêmes barres
// que les sleeves, position décidée à la clôture t et appliquée au rendement suivant, commission de
// 0,045 % par unité de variation de position. Régressions MCO, t de Newey–West, bootstrap par mois.
// Sorties : research/reports/residual-alpha/ (Markdown, JSON).

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSleeve } from '../lib/frozen-shock.ts'
import type { SleeveKey } from '../lib/frozen-shock.ts'
import * as P from '../lib/portfolio.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/residual-alpha')
const PRESPEC = 'research/preregistration/residual-alpha.md'
const CSV = 'research/reports/btc-eth-portfolio-e2/portfolio_daily_returns.csv'
const SUMMARY = 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'
const DAY = P.DAY, ANN = P.ANN
const COMM = 0.045 / 100
const SEED = 20261009
const NBOOT = 5000
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ================================================================ rendements du Shock Engine
const rows = readFileSync(join(ROOT, CSV), 'utf8').trim().split('\n')
const head = rows[0].split(',')
const col = (name: string) => { const i = head.indexOf(name); if (i < 0) throw new Error(`colonne absente : ${name}`); return i }
const recs = rows.slice(1).map(s => s.split(','))
const days = recs.map(r => Math.round(Date.parse(r[col('date')] + 'T00:00:00Z') / DAY))
const SE = {
  portfolio: recs.map(r => +r[col('portfolio_return')]),
  btc: recs.map(r => +r[col('btc_return')]),
  eth: recs.map(r => +r[col('eth_return')]),
}
const ND = days.length, D0 = days[0], D1 = days[ND - 1]
for (let k = 1; k < ND; k++) if (days[k] !== days[k - 1] + 1) throw new Error(`jour manquant après ${P.isoDay(days[k - 1])}`)
const summary = JSON.parse(readFileSync(join(ROOT, SUMMARY), 'utf8'))
log(`Shock Engine : ${P.isoDay(D0)} → ${P.isoDay(D1)}, ${ND} jours`)

// ================================================================ barres et clôtures journalières
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const NAME: Record<SleeveKey, 'BTC' | 'ETH'> = { btc: 'BTC', ethusdt: 'ETH' }
const bars = Object.fromEntries(KEYS.map(k => [k, loadSleeve(k).bars])) as Record<SleeveKey, ReturnType<typeof loadSleeve>['bars']>
log('barres chargées')

/** Jours de l'historique complet de l'actif (premier jour de barre → D1) et clôtures journalières. */
function dailyOf(key: SleeveKey) {
  const b = bars[key]
  const first = Math.floor(b.t[0] / DAY)
  const all: number[] = []
  for (let d = first; d <= D1; d++) all.push(d)
  const last = (() => { let lo = 0, hi = b.n; const ms = (D1 + 1) * DAY; while (lo < hi) { const m = (lo + hi) >> 1; if (b.t[m] < ms) lo = m + 1; else hi = m } return lo - 1 })()
  const { eq: close } = P.dayCloses(b.t, b.c, 0, last, all, b.c[0])
  return { all, close, at: all.indexOf(D0), last }
}
const DL = Object.fromEntries(KEYS.map(k => [k, dailyOf(k)])) as Record<SleeveKey, ReturnType<typeof dailyOf>>

// ================================================================ références (positions)
type Pos = Int8Array
function rollMax(c: ArrayLike<number>, n: number): Float64Array {
  // max(c[i-n..i-1]) par file monotone ; NaN tant que la fenêtre n'est pas pleine.
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

function tsmom(c: ArrayLike<number>, L: number): Pos {
  const p = new Int8Array(c.length)
  for (let i = L; i < c.length; i++) { const r = c[i] / c[i - L] - 1; p[i] = r > 0 ? 1 : r < 0 ? -1 : 0 }
  return p
}
function donch(c: ArrayLike<number>, ne: number, nx: number): Pos {
  const p = new Int8Array(c.length)
  const hiE = rollMax(c, ne), loE = rollMin(c, ne), hiX = rollMax(c, nx), loX = rollMin(c, nx)
  let s = 0
  for (let i = 0; i < c.length; i++) {
    if (i >= ne) {
      if (s === 1 && c[i] < loX[i]) s = 0
      else if (s === -1 && c[i] > hiX[i]) s = 0
      if (s === 0) { if (c[i] > hiE[i]) s = 1; else if (c[i] < loE[i]) s = -1 }
    }
    p[i] = s
  }
  return p
}
function ema(c: ArrayLike<number>, f: number, sl: number): Pos {
  const p = new Int8Array(c.length), af = 2 / (f + 1), as = 2 / (sl + 1)
  let ef = c[0], es = c[0]
  for (let i = 0; i < c.length; i++) {
    if (i) { ef += af * (c[i] - ef); es += as * (c[i] - es) }
    p[i] = ef > es ? 1 : -1
  }
  return p
}
const bh = (c: ArrayLike<number>): Pos => new Int8Array(c.length).fill(1)

/** Rendements d'une suite de positions : r[i+1] = pos[i]·(c[i+1]/c[i] − 1) − coût·|pos[i] − pos[i−1]|. */
function stratReturns(c: ArrayLike<number>, p: Pos, cost: number): Float64Array {
  const r = new Float64Array(c.length)
  for (let i = 0; i + 1 < c.length; i++) r[i + 1] = p[i] * (c[i + 1] / c[i] - 1) - cost * Math.abs(p[i] - (i ? p[i - 1] : 0))
  return r
}

type Spec = { id: string; kind: 'bh' | 'tsmom' | 'donch' | 'ema' | 'donch15'; a?: number; b?: number }
const posDaily = (s: Spec, c: ArrayLike<number>): Pos =>
  s.kind === 'bh' ? bh(c) : s.kind === 'tsmom' ? tsmom(c, s.a!) : s.kind === 'donch' ? donch(c, s.a!, s.b!) : ema(c, s.a!, s.b!)

/** Rendements journaliers de la référence sur la période commune (2 952 jours). */
function benchDaily(key: SleeveKey, s: Spec, cost: number): number[] {
  const d = DL[key]
  if (s.kind !== 'donch15') {
    const r = stratReturns(d.close, posDaily(s, d.close), s.kind === 'bh' ? 0 : cost)
    return Array.from(r.subarray(d.at, d.at + ND))
  }
  const b = bars[key], c = b.c.subarray(0, d.last + 1)
  const r = stratReturns(c, donch(c, s.a!, s.b!), cost)
  const eq = new Float64Array(c.length)
  let v = 1
  for (let i = 0; i < c.length; i++) { v *= 1 + r[i]; eq[i] = v }
  const de = P.dayCloses(b.t, eq, 0, d.last, d.all, 1).eq
  const dr = P.returnsOf(de, 1)
  return dr.slice(d.at, d.at + ND)
}

const MAIN: Spec[] = [
  { id: 'TSMOM30', kind: 'tsmom', a: 30 }, { id: 'TSMOM90', kind: 'tsmom', a: 90 }, { id: 'TSMOM180', kind: 'tsmom', a: 180 },
  { id: 'DONCH55/20', kind: 'donch', a: 55, b: 20 }, { id: 'EMA20/100', kind: 'ema', a: 20, b: 100 },
]
const INTRA: Spec = { id: 'DONCH15 96/48', kind: 'donch15', a: 96, b: 48 }
const GRID: Spec[] = [
  ...[10, 20, 30, 60, 90, 120, 180, 250].map(L => ({ id: `TSMOM${L}`, kind: 'tsmom' as const, a: L })),
  ...[[20, 10], [55, 20], [100, 50]].map(([a, b]) => ({ id: `DONCH${a}/${b}`, kind: 'donch' as const, a, b })),
  ...[[10, 50], [20, 100], [50, 200]].map(([a, b]) => ({ id: `EMA${a}/${b}`, kind: 'ema' as const, a, b })),
  ...[[48, 24], [96, 48], [192, 96]].map(([a, b]) => ({ id: `DONCH15 ${a}/${b}`, kind: 'donch15' as const, a, b })),
]
const BH: Spec = { id: 'BH', kind: 'bh' }

/** Facteurs : par actif, et versions 50/50 du portefeuille (rebalancées chaque jour). */
function factorsFor(specs: Spec[], cost: number) {
  const per: Record<string, Record<'BTC' | 'ETH', number[]>> = {}
  for (const s of specs) per[s.id] = { BTC: benchDaily('btc', s, cost), ETH: benchDaily('ethusdt', s, cost) }
  return per
}
log('références…')
const F = factorsFor([BH, ...MAIN, INTRA], COMM)
log('références calculées')

// ================================================================ MCO, Newey–West, bootstrap
function solve(A: number[][], y: number[]): number[] {
  const n = A.length, M = A.map((r, i) => [...r, y[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    if (Math.abs(M[c][c]) < 1e-300) throw new Error('matrice singulière')
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k] }
  }
  return M.map((r, i) => r[n] / r[i])
}
const inverse = (A: number[][]) => A.map((_, j) => solve(A, A.map((__, i) => (i === j ? 1 : 0))))
const nwLag = (T: number) => Math.floor(4 * Math.pow(T / 100, 2 / 9))

interface Fit { coef: number[]; se: number[]; t: number[]; r2: number; r2adj: number; resid: number[]; n: number; k: number }
/** MCO avec constante (colonne 0) ; écarts types de Newey–West (Bartlett, retard `lag`). */
function ols(y: number[], X: number[][], lag: number): Fit {
  const n = y.length, k = X.length + 1
  const row = (i: number) => [1, ...X.map(x => x[i])]
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0)
  for (let i = 0; i < n; i++) { const r = row(i); for (let a = 0; a < k; a++) { Xty[a] += r[a] * y[i]; for (let b = 0; b < k; b++) XtX[a][b] += r[a] * r[b] } }
  const coef = solve(XtX, Xty)
  const resid = new Array(n)
  for (let i = 0; i < n; i++) { const r = row(i); let f = 0; for (let a = 0; a < k; a++) f += r[a] * coef[a]; resid[i] = y[i] - f }
  const S = Array.from({ length: k }, () => new Array(k).fill(0))
  const xe: number[][] = []
  for (let i = 0; i < n; i++) xe.push(row(i).map(v => v * resid[i]))
  for (let l = 0; l <= lag; l++) {
    const w = l === 0 ? 1 : 1 - l / (lag + 1)
    for (let i = l; i < n; i++) for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
      const v = xe[i][a] * xe[i - l][b]
      S[a][b] += l === 0 ? v : w * (v + xe[i - l][a] * xe[i][b])
    }
  }
  const Q = inverse(XtX)
  const V = Q.map(r => Q[0].map((_, j) => r.reduce((s, q, m) => s + q * S[m].reduce((u, sv, p) => u + sv * Q[p][j], 0), 0)))
  const se = V.map((r, i) => Math.sqrt(r[i]))
  const my = P.mean(y)
  let ssr = 0, sst = 0
  for (let i = 0; i < n; i++) { ssr += resid[i] ** 2; sst += (y[i] - my) ** 2 }
  const r2 = 1 - ssr / sst
  return { coef, se, t: coef.map((c, i) => c / se[i]), r2, r2adj: 1 - (1 - r2) * (n - 1) / (n - k), resid, n, k }
}
/** Constante seule des MCO (bootstrap) : mêmes équations normales, sans écarts types. */
function olsAlpha(y: number[], X: number[][]): number {
  const n = y.length, k = X.length + 1, r = new Float64Array(k)
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), Xty = new Array(k).fill(0)
  for (let i = 0; i < n; i++) {
    r[0] = 1
    for (let a = 1; a < k; a++) r[a] = X[a - 1][i]
    for (let a = 0; a < k; a++) { Xty[a] += r[a] * y[i]; const ra = r[a], row = XtX[a]; for (let b = 0; b < k; b++) row[b] += ra * r[b] }
  }
  return solve(XtX, Xty)[0]
}
/** White (HC0), écrit séparément pour le contrôle « retard 0 = White ». */
function whiteSe(y: number[], X: number[][]): number[] {
  const f = ols(y, X, 0), n = y.length, k = X.length + 1
  const row = (i: number) => [1, ...X.map(x => x[i])]
  const XtX = Array.from({ length: k }, () => new Array(k).fill(0)), M = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = 0; i < n; i++) { const r = row(i), e2 = f.resid[i] ** 2; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) { XtX[a][b] += r[a] * r[b]; M[a][b] += e2 * r[a] * r[b] } }
  const Q = inverse(XtX)
  const mul = (A: number[][], B: number[][]) => A.map(r => B[0].map((_, j) => r.reduce((s, v, m) => s + v * B[m][j], 0)))
  const V = mul(mul(Q, M), Q)
  return V.map((r, i) => Math.sqrt(r[i]))
}

interface Res { model: string; series: string; n: number; alphaAnn: number; t: number; ir: number; r2: number; r2adj: number; meanAnn: number; unexplained: number; betas: { name: string; beta: number; t: number }[] }
function fitModel(model: string, series: string, y: number[], names: string[], X: number[][], lag: number): Res {
  const f = ols(y, X, lag)
  const sdE = P.sd(f.resid)
  const meanAnn = P.mean(y) * ANN
  return {
    model, series, n: f.n, alphaAnn: f.coef[0] * ANN, t: f.t[0], ir: (f.coef[0] / sdE) * Math.sqrt(ANN), r2: f.r2, r2adj: f.r2adj,
    meanAnn, unexplained: (f.coef[0] * ANN) / meanAnn,
    betas: names.map((name, i) => ({ name, beta: f.coef[i + 1], t: f.t[i + 1] })),
  }
}

const half = (a: number[], b: number[]) => a.map((x, i) => 0.5 * (x + b[i]))
/** Régresseurs d'un modèle : portefeuille (BH des deux actifs, tendances en 50/50) ou sleeve (actif seul). */
function design(fac: Record<string, Record<'BTC' | 'ETH', number[]>>, trend: string[], who: 'portfolio' | 'BTC' | 'ETH') {
  const names: string[] = [], X: number[][] = []
  if (who === 'portfolio') { names.push('BH BTC', 'BH ETH'); X.push(fac.BH.BTC, fac.BH.ETH) }
  else { names.push(`BH ${who}`); X.push(fac.BH[who]) }
  for (const id of trend) { names.push(id); X.push(who === 'portfolio' ? half(fac[id].BTC, fac[id].ETH) : fac[id][who]) }
  return { names, X }
}
const MODELS: Record<string, string[]> = {
  M0: [],
  M1: MAIN.map(s => s.id),
  M2: [...MAIN.map(s => s.id), INTRA.id],
}
const LAG = nwLag(ND)

// ================================================================ contrôles
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); log(`${ok ? '✔' : '✘'} ${name} · ${detail}`) }

{
  const pub = { portfolio: summary.series.portfolio.m.sharpe, btc: summary.series.btc.m.sharpe, eth: summary.series.eth.m.sharpe }
  const got = { portfolio: P.dailyMetrics(SE.portfolio, days).sharpe, btc: P.dailyMetrics(SE.btc, days).sharpe, eth: P.dailyMetrics(SE.eth, days).sharpe }
  const err = Math.max(...(['portfolio', 'btc', 'eth'] as const).map(k => Math.abs(got[k] - pub[k])))
  check('Shock Engine returns reproduce the published Sharpe ratios', err < 1e-6, `portfolio ${got.portfolio.toFixed(6)} vs ${pub.portfolio.toFixed(6)}, BTC ${got.btc.toFixed(6)}, ETH ${got.eth.toFixed(6)}; max error ${err.toExponential(1)}`)
  const c = P.pearson(F.BH.BTC, F.BH.ETH), pc = summary.correlation.underlyingDaily
  check('Spot daily returns reproduce the published BTC/ETH correlation (same daily convention)', Math.abs(c - pc) < 1e-9, `${c.toFixed(10)} vs ${pc.toFixed(10)}`)
}
{
  // Pas de regard vers le futur : perturber les prix après une date ne change aucune position jusqu'à elle.
  const rand = P.rng(SEED + 1)
  const specs: Spec[] = [...GRID]
  let worst = 0, tested = 0
  for (const key of KEYS) {
    const d = DL[key], b = bars[key]
    for (const s of specs) {
      const intra = s.kind === 'donch15'
      const c = intra ? Array.from(b.c.subarray(0, d.last + 1)) : d.close
      const pos = intra ? donch(c, s.a!, s.b!) : posDaily(s, c)
      for (let k = 0; k < 200; k++) {
        const t = Math.floor(rand() * (c.length - 2))
        const pert = c.slice()
        for (let i = t + 1; i < pert.length; i++) pert[i] *= 0.5 + rand()
        const p2 = intra ? donch(pert, s.a!, s.b!) : posDaily(s, pert)
        let diff = 0
        for (let i = 0; i <= t; i++) if (p2[i] !== pos[i]) diff++
        worst = Math.max(worst, diff); tested++
      }
    }
  }
  check('No look-ahead: perturbing prices after a date leaves every earlier position unchanged', worst === 0, `${tested} perturbations (200 dates × ${GRID.length} references × 2 assets), positions changed: ${worst}`)
}
{
  // MCO et Newey–West sur données simulées.
  const g = P.gauss(P.rng(SEED + 2)), n = 3000
  const x1 = Array.from({ length: n }, () => g()), x2 = Array.from({ length: n }, () => g())
  const y = x1.map((v, i) => 0.001 + 0.5 * v - 0.3 * x2[i] + 0.2 * g())
  const f = ols(y, [x1, x2], 5)
  const ok = Math.abs(f.coef[1] - 0.5) < 4 * f.se[1] && Math.abs(f.coef[2] + 0.3) < 4 * f.se[2] && Math.abs(f.coef[0] - 0.001) < 4 * f.se[0]
  check('OLS recovers known coefficients on simulated data', ok, `β = ${f.coef.map(v => v.toFixed(4)).join(', ')} (true 0.001, 0.5, −0.3)`)
  const w = whiteSe(y, [x1, x2]), nw0 = ols(y, [x1, x2], 0).se
  const e = Math.max(...w.map((v, i) => Math.abs(v - nw0[i]) / v))
  check('Newey–West with lag 0 equals White standard errors', e < 1e-10, `max relative difference ${e.toExponential(1)}`)
  const fa = olsAlpha(y, [x1, x2])
  check('Bootstrap OLS (constant only) equals the full OLS', Math.abs(fa - f.coef[0]) < 1e-15, `${fa.toExponential(6)} vs ${f.coef[0].toExponential(6)}`)
}

// ================================================================ modèles principaux
const results: Res[] = []
for (const who of ['portfolio', 'BTC', 'ETH'] as const) {
  const y = who === 'portfolio' ? SE.portfolio : who === 'BTC' ? SE.btc : SE.eth
  for (const [m, trend] of Object.entries(MODELS)) {
    const { names, X } = design(F, trend, who)
    results.push(fitModel(m, who, y, names, X, LAG))
  }
}
const main = results.find(r => r.model === 'M2' && r.series === 'portfolio')!
log(`M2 portefeuille : α ${(main.alphaAnn * 100).toFixed(1)} %/an, t ${main.t.toFixed(2)}`)

// Bootstrap par mois civils, mêmes mois pour toutes les séries.
const months = (() => { const m = new Map<number, number[]>(); days.forEach((d, i) => { const k = P.monthKey(d); if (!m.has(k)) m.set(k, []); m.get(k)!.push(i) }); return [...m.values()] })()
function bootAlpha(nRep: number, seed: number) {
  const rand = P.rng(seed), { X } = design(F, MODELS.M2, 'portfolio'), out: number[] = []
  for (let r = 0; r < nRep; r++) {
    const idx: number[] = []
    for (let j = 0; j < months.length; j++) idx.push(...months[Math.floor(rand() * months.length)])
    out.push(olsAlpha(idx.map(i => SE.portfolio[i]), X.map(x => idx.map(i => x[i]))) * ANN)
  }
  return out
}
{
  const a = bootAlpha(30, SEED), b = bootAlpha(30, SEED)
  check('Bootstrap is deterministic (same seed, same draws)', a.every((v, i) => v === b[i]), '30 replications computed twice')
}
log('bootstrap…')
const boot = bootAlpha(NBOOT, SEED)
const bootStats = {
  reps: NBOOT, seed: SEED, months: months.length,
  p2_5: P.quantile(boot, 0.025), p5: P.quantile(boot, 0.05), median: P.quantile(boot, 0.5), p95: P.quantile(boot, 0.95), p97_5: P.quantile(boot, 0.975),
  pNonPositive: boot.filter(x => x <= 0).length / boot.length,
}
log('bootstrap terminé')

// ================================================================ références : métriques et corrélations
const benchTable = [BH, ...MAIN, INTRA].map(s => {
  const r = { BTC: F[s.id].BTC, ETH: F[s.id].ETH, '50/50': half(F[s.id].BTC, F[s.id].ETH) }
  return {
    id: s.id,
    ...Object.fromEntries(Object.entries(r).map(([k, x]) => { const m = P.dailyMetrics(x, days); return [k, { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD }] })),
    corrPortfolio: P.pearson(SE.portfolio, r['50/50']), corrBtcSleeve: P.pearson(SE.btc, r.BTC), corrEthSleeve: P.pearson(SE.eth, r.ETH),
  }
})

// ================================================================ sensibilités
const sens: Record<string, unknown> = {}
{
  // S1 : grille complète (19 régresseurs).
  const FG = factorsFor([BH, ...GRID], COMM)
  const { names, X } = design(FG, GRID.map(s => s.id), 'portfolio')
  sens.S1 = fitModel('S1 grid', 'portfolio', SE.portfolio, names, X, LAG)
  // S2 : demi-périodes (bornes du portefeuille publié).
  const sp = summary.stability.subPeriods
  for (const [k, p] of [['first', sp.firstHalf], ['second', sp.secondHalf]] as const) {
    const a = days.indexOf(Math.round(Date.parse(p.from + 'T00:00:00Z') / DAY)), b = days.indexOf(Math.round(Date.parse(p.to + 'T00:00:00Z') / DAY))
    const dh = design(F, MODELS.M2, 'portfolio')
    sens[`S2 ${k}`] = { from: p.from, to: p.to, ...fitModel(`S2 ${k}`, 'portfolio', SE.portfolio.slice(a, b + 1), dh.names, dh.X.map(x => x.slice(a, b + 1)), nwLag(b - a + 1)) }
  }
  // S3 : hebdomadaire (semaines ISO complètes ou non, rendements composés).
  const wk = new Map<number, number[]>()
  days.forEach((d, i) => { const k = P.weekKey(d); if (!wk.has(k)) wk.set(k, []); wk.get(k)!.push(i) })
  const W = [...wk.values()]
  const comp = (x: number[]) => W.map(ix => ix.reduce((v, i) => v * (1 + x[i]), 1) - 1)
  const dw = design(F, MODELS.M2, 'portfolio')
  const fw = ols(comp(SE.portfolio), dw.X.map(comp), nwLag(W.length))
  const sdw = P.sd(fw.resid)
  sens.S3 = { weeks: W.length, lag: nwLag(W.length), alphaAnn: fw.coef[0] * (ANN / 7), t: fw.t[0], r2: fw.r2, ir: (fw.coef[0] / sdw) * Math.sqrt(ANN / 7), names: dw.names }
  // S4 : références sans frais.
  const F0 = factorsFor([BH, ...MAIN, INTRA], 0)
  const d0 = design(F0, MODELS.M2, 'portfolio')
  sens.S4 = fitModel('S4 frictionless', 'portfolio', SE.portfolio, d0.names, d0.X, LAG)
}
log('sensibilités calculées')

// ================================================================ verdict et rapport
const allOk = checks.every(c => c.ok)
const verdict = !allOk ? 'aucun verdict (contrôle en échec)'
  : main.alphaAnn > 0 && main.t >= 3 && bootStats.pNonPositive <= 0.01 ? 'alpha résiduel démontré (en échantillon)'
  : main.t >= 2 ? 'indicatif' : 'non démontré'

let commit = 'inconnu'
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim() } catch { /* hors git */ }
const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d).replace('-', '−')} %` : '—')
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('-', '−') : '—')
const L: string[] = []
L.push('# Alpha résiduel du Shock Engine face à des stratégies de tendance simples', '')
L.push(`Pré-spécification : \`${PRESPEC}\` (commitée avant tout calcul). Produit par \`node research/shock/residual-alpha.ts\` (commit \`${commit.slice(0, 7)}\`). Shock Engine : version publique (shorts seulement en régime de tendance journalier baissier), rendements journaliers ${P.isoDay(D0)} → ${P.isoDay(D1)} (${ND} jours), après commissions. Références : mêmes barres, positions ±1 décidées à la clôture et appliquées au jour suivant, commission 0,045 % par unité de variation de position, sans funding. Écarts types de Newey–West, retard ${LAG}.`, '')
L.push('**En échantillon.** Les règles du Shock Engine ont été choisies sur des données qui couvrent la période et la condition de tendance des shorts a été spécifiée après étude de cette période : l\'étude dit si des facteurs simples reproduisent le résultat historique, pas si l\'alpha persistera.', '')
L.push(`## Verdict (fixé d'avance, M2, portefeuille 50/50) : **${verdict}**`, '')
L.push(`α = ${pct(main.alphaAnn)} par an, t de Newey–West = ${num(main.t)}, P(α ≤ 0) bootstrap = ${num(bootStats.pNonPositive, 4)} (${NBOOT} tirages de ${months.length} mois). Intervalle à 90 % de α : ${pct(bootStats.p5)} à ${pct(bootStats.p95)} ; à 95 % : ${pct(bootStats.p2_5)} à ${pct(bootStats.p97_5)}. Rendement moyen du Shock Engine : ${pct(main.meanAnn)} par an (arithmétique) ; part non expliquée par les facteurs : ${pct(main.unexplained, 0)}. R² = ${num(main.r2, 3)}.`, '')
L.push('## Modèles', '')
L.push('| Série | Modèle | α annualisé | t (Newey–West) | Ratio d\'information résiduel | R² | R² ajusté | Part non expliquée |', '|---|---|---:|---:|---:|---:|---:|---:|')
for (const r of results) L.push(`| ${r.series} | ${r.model} | ${pct(r.alphaAnn)} | ${num(r.t)} | ${num(r.ir)} | ${num(r.r2, 3)} | ${num(r.r2adj, 3)} | ${pct(r.unexplained, 0)} |`)
L.push('', 'M0 : buy & hold. M1 : M0 + TSMOM 30/90/180, Donchian 55/20, EMA 20/100. M2 : M1 + Donchian 15 min 96/48.', '')
L.push('## Expositions de M2 (portefeuille 50/50)', '', '| Facteur | β | t |', '|---|---:|---:|')
for (const b of main.betas) L.push(`| ${b.name} | ${num(b.beta, 3)} | ${num(b.t)} |`)
L.push('', '## Références seules', '', '| Référence | Sharpe BTC | Sharpe ETH | Sharpe 50/50 | CAGR 50/50 | Drawdown 50/50 | Corrélation avec le portefeuille | avec la sleeve BTC | avec la sleeve ETH |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|')
for (const b of benchTable) {
  const x = b as unknown as Record<string, { sharpe: number; cagr: number; maxDD: number }> & { id: string; corrPortfolio: number; corrBtcSleeve: number; corrEthSleeve: number }
  L.push(`| ${b.id} | ${num(x.BTC.sharpe)} | ${num(x.ETH.sharpe)} | ${num(x['50/50'].sharpe)} | ${pct(x['50/50'].cagr)} | ${pct(x['50/50'].maxDD)} | ${num(b.corrPortfolio)} | ${num(b.corrBtcSleeve)} | ${num(b.corrEthSleeve)} |`)
}
L.push('', 'Shock Engine sur la même période : Sharpe ' + num(summary.series.portfolio.m.sharpe) + ' (portefeuille), ' + num(summary.series.btc.m.sharpe) + ' (BTC), ' + num(summary.series.eth.m.sharpe) + ' (ETH).', '')
L.push('## Sensibilités (descriptives)', '', '| Sensibilité | α annualisé | t | R² | Ratio d\'information |', '|---|---:|---:|---:|---:|')
const s1 = sens.S1 as Res, s4 = sens.S4 as Res, s3 = sens.S3 as { alphaAnn: number; t: number; r2: number; ir: number; weeks: number }
const s2a = sens['S2 first'] as Res & { from: string; to: string }, s2b = sens['S2 second'] as Res & { from: string; to: string }
L.push(`| S1 · grille complète, 19 régresseurs (avantage aux références) | ${pct(s1.alphaAnn)} | ${num(s1.t)} | ${num(s1.r2, 3)} | ${num(s1.ir)} |`)
L.push(`| S2 · ${s2a.from} → ${s2a.to} | ${pct(s2a.alphaAnn)} | ${num(s2a.t)} | ${num(s2a.r2, 3)} | ${num(s2a.ir)} |`)
L.push(`| S2 · ${s2b.from} → ${s2b.to} | ${pct(s2b.alphaAnn)} | ${num(s2b.t)} | ${num(s2b.r2, 3)} | ${num(s2b.ir)} |`)
L.push(`| S3 · hebdomadaire (${s3.weeks} semaines) | ${pct(s3.alphaAnn)} | ${num(s3.t)} | ${num(s3.r2, 3)} | ${num(s3.ir)} |`)
L.push(`| S4 · références sans frais | ${pct(s4.alphaAnn)} | ${num(s4.t)} | ${num(s4.r2, 3)} | ${num(s4.ir)} |`)
L.push('', '## Contrôles', '')
for (const c of checks) L.push(`- ${c.ok ? '✔' : '✘'} ${c.name} · ${c.detail}`)
L.push('')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'residual-alpha.md'), L.join('\n'))
writeFileSync(join(OUT, 'residual-alpha.json'), JSON.stringify({ prespec: PRESPEC, commit, period: [P.isoDay(D0), P.isoDay(D1)], days: ND, nwLag: LAG, verdict, checks, main, bootstrap: bootStats, models: results, benchmarks: benchTable, sensitivities: sens },
  (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(8) : x), 1))
log(`écrit ${OUT}/residual-alpha.{md,json}`)
if (!allOk) process.exitCode = 1
