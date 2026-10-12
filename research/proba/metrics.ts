// Couche probabiliste · mesures de qualité des prévisions : scores des probabilités, calibration,
// quintiles, rangs, bootstrap par blocs de mois civils (apparié entre modèles), correction de Holm.

import { rng, spearman } from '../lib/portfolio.ts'
import { fitLogit, logit } from './models.ts'

const clip = (p: number) => Math.min(1 - 1e-15, Math.max(1e-15, p))

export const mean = (xs: ArrayLike<number>) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return xs.length ? s / xs.length : NaN }

export function brier(y: ArrayLike<number>, p: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < y.length; i++) s += (p[i] - y[i]) ** 2
  return s / y.length
}

export function logLoss(y: ArrayLike<number>, p: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < y.length; i++) s -= y[i] ? Math.log(clip(p[i])) : Math.log(1 - clip(p[i]))
  return s / y.length
}

export function mse(y: ArrayLike<number>, f: ArrayLike<number>): number {
  let s = 0
  for (let i = 0; i < y.length; i++) s += (f[i] - y[i]) ** 2
  return s / y.length
}

/** Aire sous la courbe ROC (Mann–Whitney, ex aequo comptés pour moitié). */
export function auc(y: ArrayLike<number>, p: ArrayLike<number>): number {
  const n = y.length
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => p[a] - p[b])
  let pos = 0, rankSum = 0
  for (let i = 0; i < n;) {
    let j = i
    while (j + 1 < n && p[idx[j + 1]] === p[idx[i]]) j++
    const r = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) if (y[idx[k]]) { pos++; rankSum += r }
    i = j + 1
  }
  const neg = n - pos
  return pos && neg ? (rankSum - (pos * (pos + 1)) / 2) / (pos * neg) : NaN
}

export { spearman }

/** Intervalle de Wilson d'une proportion. */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (!n) return [NaN, NaN]
  const ph = k / n, d = 1 + (z * z) / n
  const c = (ph + (z * z) / (2 * n)) / d
  const h = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d
  return [c - h, c + h]
}

/** Groupes d'effectifs égaux selon le rang de la prévision (0 = plus faible). */
export function binsByRank(f: ArrayLike<number>, k: number): Int32Array {
  const n = f.length
  const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => f[a] - f[b] || a - b)
  const out = new Int32Array(n)
  idx.forEach((i, r) => { out[i] = Math.min(k - 1, Math.floor((r * k) / n)) })
  return out
}

export interface BinRow { bin: number; n: number; meanPred: number; observed: number; lo: number; hi: number }

/** Calibration : prévision moyenne et fréquence observée par groupe de rang (Wilson 95 %). */
export function calibrationBins(y: ArrayLike<number>, p: ArrayLike<number>, k: number): BinRow[] {
  const b = binsByRank(p, k)
  return Array.from({ length: k }, (_, j) => {
    const ii = Array.from({ length: y.length }, (_, i) => i).filter(i => b[i] === j)
    const pos = ii.reduce((s, i) => s + y[i], 0)
    const [lo, hi] = wilson(pos, ii.length)
    return { bin: j + 1, n: ii.length, meanPred: mean(ii.map(i => p[i])), observed: pos / ii.length, lo, hi }
  })
}

/** Quintiles d'une prévision continue : moyenne prévue et réalisée. */
export function valueBins(y: ArrayLike<number>, f: ArrayLike<number>, k: number) {
  const b = binsByRank(f, k)
  return Array.from({ length: k }, (_, j) => {
    const ii = Array.from({ length: y.length }, (_, i) => i).filter(i => b[i] === j)
    return { bin: j + 1, n: ii.length, meanPred: mean(ii.map(i => f[i])), realized: mean(ii.map(i => y[i])) }
  })
}

/** Écart de la moyenne réalisée entre le groupe de rang supérieur et l'inférieur. */
export function topMinusBottom(y: ArrayLike<number>, f: ArrayLike<number>, k = 5): number {
  const b = binsByRank(f, k)
  let st = 0, nt = 0, sb = 0, nb = 0
  for (let i = 0; i < y.length; i++) {
    if (b[i] === k - 1) { st += y[i]; nt++ }
    if (b[i] === 0) { sb += y[i]; nb++ }
  }
  return st / nt - sb / nb
}

/** Calibration globale : écart moyen (prévu − observé) et pente de y sur logit(p). */
export function calibrationFit(y: ArrayLike<number>, p: ArrayLike<number>) {
  const f = fitLogit(Array.from(p, v => [logit(v)]), Array.from(y), 0)
  return { inTheLarge: mean(p) - mean(y), intercept: f.b0, slope: f.beta[0] }
}

/** Mois civil UTC (clé entière) d'un horodatage en ms. */
export const monthOf = (ms: number) => { const d = new Date(ms); return d.getUTCFullYear() * 12 + d.getUTCMonth() }

/**
 * Bootstrap par blocs (mois civils) : les mêmes blocs sont tirés pour toutes les statistiques
 * (comparaisons appariées). `stat` reçoit les indices de l'échantillon et renvoie un vecteur.
 */
export function blockBootstrap(groups: ArrayLike<number>, reps: number, seed: number, stat: (idx: number[]) => number[]): number[][] {
  const keys = [...new Set(Array.from(groups))].sort((a, b) => a - b)
  const members = new Map<number, number[]>(keys.map(k => [k, []]))
  for (let i = 0; i < groups.length; i++) members.get(groups[i])!.push(i)
  const R = rng(seed)
  const out: number[][] = []
  for (let r = 0; r < reps; r++) {
    const idx: number[] = []
    for (let k = 0; k < keys.length; k++) idx.push(...members.get(keys[Math.floor(R() * keys.length)])!)
    out.push(stat(idx))
  }
  return out
}

export function percentile(xs: number[], q: number): number {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return NaN
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Estimation, intervalle percentile et p unilatéral (H0 : Δ ≤ 0) = (1 + #{Δ* ≤ 0}) / (1 + B). */
export interface Interval { est: number; lo: number; hi: number; p: number; reps: number }

export function interval(est: number, draws: number[], level: number): Interval {
  const ok = draws.filter(Number.isFinite)
  const a = (1 - level) / 2
  return { est, lo: percentile(ok, a), hi: percentile(ok, 1 - a), p: (1 + ok.filter(d => d <= 0).length) / (1 + ok.length), reps: ok.length }
}

/** Correction de Holm : p ajustés, dans l'ordre d'entrée. */
export function holm(ps: number[]): number[] {
  const m = ps.length
  const order = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const adj = new Array<number>(m)
  let run = 0
  order.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run })
  return adj
}
