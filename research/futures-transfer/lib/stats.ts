// Statistiques de l'étude de transfert (research/preregistration/futures-k-transfer.md) : t robustes à
// la dépendance temporelle, Sharpe corrigé de l'autocorrélation (Lo, 2002), Holm, bootstrap par mois.
// Fonctions pures, sans dépendance au moteur.

import { normCdf } from '../../lib/overfit.ts'

export const mean = (xs: ArrayLike<number>) => { let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i]; return xs.length ? s / xs.length : NaN }

export function median(xs: ArrayLike<number>): number {
  const s = Array.from(xs).filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return NaN
  const k = s.length >> 1
  return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2
}

export function quantile(xs: ArrayLike<number>, q: number): number {
  const s = Array.from(xs).filter(Number.isFinite).sort((a, b) => a - b)
  if (!s.length) return NaN
  const p = (s.length - 1) * q, k = Math.floor(p), f = p - k
  return k + 1 < s.length ? s[k] + f * (s[k + 1] - s[k]) : s[k]
}

/** Écart type d'échantillon (n − 1). */
export function sdSample(xs: ArrayLike<number>): number {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  let v = 0
  for (let i = 0; i < n; i++) v += (xs[i] - m) ** 2
  return Math.sqrt(v / (n - 1))
}

/** t de regime-wf.ts : moyenne / écart type (n − 1) × √n ; −∞ sous 2 valeurs. */
export function tstat(xs: ArrayLike<number>): number {
  const n = xs.length
  if (n < 2) return -Infinity
  const m = mean(xs), s = sdSample(xs)
  return s > 0 ? (m / s) * Math.sqrt(n) : m > 0 ? Infinity : -Infinity
}

/** Générateur pseudo-aléatoire de zero-shot.ts (mulberry32), graine explicite. */
export function rng(seed: number) {
  let s = seed >>> 0
  return () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
}

/**
 * Bootstrap par mois civils (méthode de zero-shot.ts) : mois tirés avec remise, moyenne des valeurs
 * regroupées. Renvoie les bornes à 90 % et 95 % et P(moyenne > 0).
 */
export function bootMonths(groups: Map<number, number[]>, draws: number, rand: () => number) {
  const keys = [...groups.keys()]
  const sums = keys.map(k => groups.get(k)!.reduce((s, x) => s + x, 0)), cnts = keys.map(k => groups.get(k)!.length)
  const out = new Float64Array(draws)
  for (let d = 0; d < draws; d++) {
    let s = 0, c = 0
    for (let j = 0; j < keys.length; j++) { const k = Math.floor(rand() * keys.length); s += sums[k]; c += cnts[k] }
    out[d] = c ? s / c : 0
  }
  let pos = 0
  for (const x of out) if (x > 0) pos++
  return { ci90: [quantile(out, 0.05), quantile(out, 0.95)], ci95: [quantile(out, 0.025), quantile(out, 0.975)], pPos: pos / draws }
}

/** t de la moyenne avec erreur type robuste par grappes (ici les mois civils), correction G / (G − 1). */
export function clusterT(xs: ArrayLike<number>, cluster: ArrayLike<number>): number {
  const n = xs.length
  if (n < 2) return NaN
  const m = mean(xs)
  const acc = new Map<number, number>()
  for (let i = 0; i < n; i++) acc.set(cluster[i], (acc.get(cluster[i]) ?? 0) + (xs[i] - m))
  const G = acc.size
  if (G < 2) return NaN
  let v = 0
  for (const s of acc.values()) v += s * s
  const se = Math.sqrt((v * G) / (G - 1)) / n
  return se > 0 ? m / se : NaN
}

/** Retard de Newey–West automatique : ⌊4 (T / 100)^(2/9)⌋. */
export const nwLag = (T: number) => Math.floor(4 * Math.pow(T / 100, 2 / 9))

/** t de la moyenne d'une série avec erreur type de Newey–West (noyau de Bartlett, retard L). */
export function neweyWestT(xs: ArrayLike<number>, L: number): number {
  const T = xs.length
  if (T < 3) return NaN
  const m = mean(xs)
  const d = Float64Array.from(xs, x => x - m)
  let s = 0
  for (let t = 0; t < T; t++) s += d[t] * d[t]
  let lr = s / T
  for (let k = 1; k <= L; k++) {
    let g = 0
    for (let t = k; t < T; t++) g += d[t] * d[t - k]
    lr += 2 * (1 - k / (L + 1)) * (g / T)
  }
  const se = Math.sqrt(Math.max(lr, 0) / T)
  return se > 0 ? m / se : NaN
}

/** Autocorrélations d'ordre 1 à q. */
export function autocorr(xs: ArrayLike<number>, q: number): number[] {
  const T = xs.length, m = mean(xs)
  let g0 = 0
  for (let t = 0; t < T; t++) g0 += (xs[t] - m) ** 2
  const out: number[] = []
  for (let k = 1; k <= q; k++) {
    let g = 0
    for (let t = k; t < T; t++) g += (xs[t] - m) * (xs[t - k] - m)
    out.push(g0 > 0 ? g / g0 : 0)
  }
  return out
}

/**
 * Sharpe annualisé corrigé de l'autocorrélation (Lo, 2002) : SR_an = η(q) × SR par période,
 * η(q) = q / √(q + 2 Σ_{k=1}^{q−1} (q − k) ρ_k), ρ_k estimées jusqu'au retard `lags`, nulles au-delà.
 * q = nombre de périodes par an.
 */
export function loSharpe(xs: ArrayLike<number>, periodsPerYear: number, lags = 10): { sharpe: number; naive: number; eta: number; rho: number[] } {
  const m = mean(xs), s = sdSample(xs)
  const sr = s > 0 ? m / s : 0
  const q = periodsPerYear
  const rho = autocorr(xs, lags)
  let acc = q
  for (let k = 1; k <= Math.min(lags, q - 1); k++) acc += 2 * (q - k) * rho[k - 1]
  const eta = acc > 0 ? q / Math.sqrt(acc) : NaN
  return { sharpe: sr * eta, naive: sr * Math.sqrt(q), eta, rho }
}

/** p unilatéral (H1 : moyenne > 0) d'un t asymptotiquement normal. */
export const pOneSided = (t: number) => (Number.isFinite(t) ? 1 - normCdf(t) : t === Infinity ? 0 : 1)

/** p ajustés de Holm (pas à pas descendant), dans l'ordre d'entrée. */
export function holm(ps: number[]): number[] {
  const m = ps.length
  const idx = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const adj = new Array<number>(m)
  let run = 0
  idx.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (m - r) * p)); adj[i] = run })
  return adj
}
