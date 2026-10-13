// Couche probabiliste · modèles linéaires sans dépendance : transformation des variables (écrêtage
// aux quantiles et standardisation, estimés sur l'entraînement seulement), régression logistique L2
// (Newton–Raphson), ridge (forme fermée), calibration de Platt.

import { FEATURE_SPECS, WINSOR } from './config.ts'
import type { FeatureName } from './config.ts'
import type { SignalFeatures } from './features.ts'

// ---------------------------------------------------------------- algèbre

/** Résout A x = b pour A symétrique définie positive (Cholesky). */
export function cholSolve(A: number[][], b: number[]): number[] {
  const n = b.length
  const L = A.map(() => new Array<number>(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      if (i === j) {
        if (!(s > 0)) throw new Error('matrice non définie positive')
        L[i][i] = Math.sqrt(s)
      } else L[i][j] = s / L[j][j]
    }
  }
  const y = new Array<number>(n)
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * y[k]; y[i] = s / L[i][i] }
  const x = new Array<number>(n)
  for (let i = n - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i] }
  return x
}

export const sigmoid = (x: number) => (x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)))
export const logit = (p: number) => { const q = Math.min(1 - 1e-12, Math.max(1e-12, p)); return Math.log(q / (1 - q)) }

// ---------------------------------------------------------------- variables

/** Transformation fixe d'une caractéristique brute (§ 3 du plan). */
export function rawValue(f: SignalFeatures, name: FeatureName): number {
  const x = f[name]
  switch (FEATURE_SPECS[name].transform) {
    case 'log': return Math.log(x)
    case 'log1p': return Math.log1p(Math.max(0, x))
    default: return x
  }
}

function quantileSorted(s: number[], q: number): number {
  if (!s.length) return NaN
  const pos = (s.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Écrêtage et standardisation estimés sur un échantillon d'entraînement. */
export interface Transform {
  features: FeatureName[]
  lo: number[]
  hi: number[]
  /** Valeur de remplacement d'une valeur manquante (médiane d'entraînement). */
  fill: number[]
  mean: number[]
  sd: number[]
}

export function fitTransform(features: FeatureName[], rows: SignalFeatures[]): Transform {
  const lo: number[] = [], hi: number[] = [], fill: number[] = [], mean: number[] = [], sd: number[] = []
  for (const name of features) {
    const xs = rows.map(r => rawValue(r, name)).filter(Number.isFinite).sort((a, b) => a - b)
    const cont = FEATURE_SPECS[name].continuous
    const a = cont ? quantileSorted(xs, WINSOR[0]) : -Infinity, b = cont ? quantileSorted(xs, WINSOR[1]) : Infinity
    const med = quantileSorted(xs, 0.5)
    const vals = rows.map(r => { const v = rawValue(r, name); return Math.min(b, Math.max(a, Number.isFinite(v) ? v : med)) })
    const m = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length)
    const v2 = vals.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, vals.length)
    lo.push(a); hi.push(b); fill.push(med); mean.push(m); sd.push(Math.sqrt(v2))
  }
  return { features, lo, hi, fill, mean, sd }
}

/** Vecteur standardisé d'un signal ; une variable constante à l'entraînement vaut 0. */
export function applyTransform(T: Transform, f: SignalFeatures): number[] {
  return T.features.map((name, k) => {
    const v0 = rawValue(f, name)
    const v = Math.min(T.hi[k], Math.max(T.lo[k], Number.isFinite(v0) ? v0 : T.fill[k]))
    return T.sd[k] > 1e-12 ? (v - T.mean[k]) / T.sd[k] : 0
  })
}

// ---------------------------------------------------------------- estimation

export interface Fit { b0: number; beta: number[]; iters: number; converged: boolean }

/** Objectif pénalisé de la logistique : Σ log-loss + (λ/2) ‖β‖² (constante non pénalisée). */
export function logitObjective(X: number[][], y: number[], lambda: number, b0: number, beta: number[]): number {
  let s = 0
  for (let i = 0; i < X.length; i++) {
    let eta = b0
    for (let k = 0; k < beta.length; k++) eta += X[i][k] * beta[k]
    // log(1 + e^eta) − y·eta, stable
    s += (eta > 0 ? eta + Math.log1p(Math.exp(-eta)) : Math.log1p(Math.exp(eta))) - y[i] * eta
  }
  let r = 0
  for (const b of beta) r += b * b
  return s + 0.5 * lambda * r
}

/** Régression logistique L2 par Newton–Raphson avec recherche linéaire. */
export function fitLogit(X: number[][], y: number[], lambda: number, opt = { maxIter: 100, tol: 1e-10 }): Fit {
  const n = X.length, p = n ? X[0].length : 0
  const ybar = y.reduce((s, v) => s + v, 0) / Math.max(1, n)
  let th = [logit(Math.min(1 - 1e-6, Math.max(1e-6, ybar))), ...new Array<number>(p).fill(0)]
  let obj = logitObjective(X, y, lambda, th[0], th.slice(1))
  let iters = 0, converged = false
  for (; iters < opt.maxIter; iters++) {
    const g = new Array<number>(p + 1).fill(0)
    const H = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0))
    for (let i = 0; i < n; i++) {
      let eta = th[0]
      for (let k = 0; k < p; k++) eta += X[i][k] * th[k + 1]
      const mu = sigmoid(eta)
      const w = Math.max(mu * (1 - mu), 1e-12)
      const r = mu - y[i]
      g[0] += r
      H[0][0] += w
      for (let a = 0; a < p; a++) {
        const xa = X[i][a]
        g[a + 1] += r * xa
        H[0][a + 1] += w * xa
        for (let b = 0; b <= a; b++) H[a + 1][b + 1] += w * xa * X[i][b]
      }
    }
    for (let a = 0; a < p; a++) {
      g[a + 1] += lambda * th[a + 1]
      H[a + 1][a + 1] += lambda
      H[a + 1][0] = H[0][a + 1]
      for (let b = 0; b < a; b++) H[b + 1][a + 1] = H[a + 1][b + 1]
    }
    // Terme de stabilité (λ = 0, séparation) : ne change pas la solution quand H est régulière.
    for (let a = 0; a <= p; a++) H[a][a] += 1e-12
    const step = cholSolve(H, g)
    let t = 1, next = th, nobj = obj
    for (let k = 0; k < 40; k++) {
      next = th.map((v, j) => v - t * step[j])
      nobj = logitObjective(X, y, lambda, next[0], next.slice(1))
      if (nobj <= obj + 1e-12 * Math.abs(obj)) break
      t /= 2
    }
    const move = Math.max(...step.map(v => Math.abs(v * t)))
    th = next
    const dObj = obj - nobj
    obj = nobj
    if (move < opt.tol || dObj < 1e-14 * Math.max(1, Math.abs(obj))) { converged = true; iters++; break }
  }
  return { b0: th[0], beta: th.slice(1), iters, converged }
}

/** Ridge : min Σ (y − b0 − xβ)² + λ ‖β‖², constante non pénalisée. */
export function fitRidge(X: number[][], y: number[], lambda: number): Fit {
  const n = X.length, p = n ? X[0].length : 0
  const A = Array.from({ length: p + 1 }, () => new Array<number>(p + 1).fill(0))
  const b = new Array<number>(p + 1).fill(0)
  for (let i = 0; i < n; i++) {
    const x = [1, ...X[i]]
    for (let a = 0; a <= p; a++) {
      b[a] += x[a] * y[i]
      for (let c = 0; c <= a; c++) A[a][c] += x[a] * x[c]
    }
  }
  for (let a = 0; a <= p; a++) for (let c = 0; c < a; c++) A[c][a] = A[a][c]
  for (let a = 1; a <= p; a++) A[a][a] += lambda
  for (let a = 0; a <= p; a++) A[a][a] += 1e-12
  const th = cholSolve(A, b)
  return { b0: th[0], beta: th.slice(1), iters: 1, converged: true }
}

// ---------------------------------------------------------------- modèles ajustés

/** Modèle linéaire prêt à prédire depuis les caractéristiques brutes d'un signal. */
export interface LinearModel {
  kind: 'logit' | 'ridge' | 'const'
  features: FeatureName[]
  transform: Transform | null
  lambda: number
  b0: number
  beta: number[]
}

export function linearPredictor(m: LinearModel, f: SignalFeatures, beta = m.beta, b0 = m.b0): number {
  if (m.kind === 'const' || !m.transform) return b0
  const x = applyTransform(m.transform, f)
  let eta = b0
  for (let k = 0; k < x.length; k++) eta += x[k] * beta[k]
  return eta
}

export function predict(m: LinearModel, f: SignalFeatures): number {
  const eta = linearPredictor(m, f)
  return m.kind === 'logit' ? sigmoid(eta) : eta
}

export const constModel = (value: number): LinearModel => ({ kind: 'const', features: [], transform: null, lambda: 0, b0: value, beta: [] })

/** Calibration de Platt : P = σ(a + b·logit(p̂)). */
export interface Platt { a: number; b: number; n: number }

export function fitPlatt(p: number[], y: number[]): Platt {
  const fit = fitLogit(p.map(v => [logit(v)]), y, 0)
  return { a: fit.b0, b: fit.beta[0], n: p.length }
}

export const applyPlatt = (c: Platt, p: number) => sigmoid(c.a + c.b * logit(p))
