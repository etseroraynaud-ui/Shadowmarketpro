// Mesures du surajustement de sélection sur une matrice de rendements journaliers (une série par
// configuration, mêmes jours) : CSCV-PBO (Bailey, Borwein, López de Prado et Zhu, 2017), Sharpe
// probabiliste et dégonflé (Bailey et López de Prado, 2012 et 2014), sélection walk-forward
// chronologique à fenêtre croissante. Fonctions pures, sans dépendance au moteur.

export const EULER = 0.5772156649015329

/** Fonction de répartition de la loi normale (erfc, précision ~1e-7). */
export function normCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2
  const t = 1 / (1 + 0.5 * z)
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))))
  return x >= 0 ? 1 - r / 2 : r / 2
}

/** Quantile de la loi normale (Acklam). */
export function normInv(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  const q = p - 0.5, r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Moyenne, écart type (population), asymétrie, kurtosis (non excédentaire : 3 pour la loi normale). */
export function moments(x: ArrayLike<number>) {
  const n = x.length
  let m = 0
  for (let i = 0; i < n; i++) m += x[i]
  m /= n
  let m2 = 0, m3 = 0, m4 = 0
  for (let i = 0; i < n; i++) { const d = x[i] - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d }
  m2 /= n; m3 /= n; m4 /= n
  const sd = Math.sqrt(m2)
  return { n, mean: m, sd, skew: sd > 0 ? m3 / sd ** 3 : 0, kurt: sd > 0 ? m4 / sd ** 4 : 3 }
}

/** Sharpe par période (non annualisé). */
export const sharpe = (x: ArrayLike<number>) => { const m = moments(x); return m.sd > 0 ? m.mean / m.sd : 0 }

/**
 * Sharpe probabiliste : P(vrai Sharpe > sr0) compte tenu de la longueur, de l'asymétrie et de la
 * kurtosis de la série (Sharpe par période).
 */
export function psr(x: ArrayLike<number>, sr0: number): { sr: number; z: number; p: number; skew: number; kurt: number; n: number } {
  const m = moments(x)
  const sr = m.sd > 0 ? m.mean / m.sd : 0
  const den = Math.sqrt(Math.max(1e-12, 1 - m.skew * sr + ((m.kurt - 1) / 4) * sr * sr))
  const z = ((sr - sr0) * Math.sqrt(m.n - 1)) / den
  return { sr, z, p: normCdf(z), skew: m.skew, kurt: m.kurt, n: m.n }
}

/** Espérance du maximum de N Sharpe sous l'hypothèse nulle (vrais Sharpe nuls), écart type des essais `sd`. */
export function expectedMaxSharpe(N: number, sd: number): number {
  if (N <= 1) return 0
  return sd * ((1 - EULER) * normInv(1 - 1 / N) + EULER * normInv(1 - 1 / (N * Math.E)))
}

/** Sharpe dégonflé : PSR contre le maximum attendu de N essais sans talent. */
export function dsr(x: ArrayLike<number>, N: number, trialSd: number) {
  const sr0 = expectedMaxSharpe(N, trialSd)
  return { sr0, ...psr(x, sr0) }
}

// ---------------------------------------------------------------- CSCV
/** Indice de bloc de chaque jour : S blocs contigus de tailles égales à un jour près. */
export function blockIndex(T: number, S: number): Int32Array {
  const b = new Int32Array(T)
  for (let i = 0; i < T; i++) b[i] = Math.floor((i * S) / T)
  return b
}

/** Toutes les combinaisons de k éléments parmi 0 … n − 1, dans l'ordre lexicographique. */
export function* combinations(n: number, k: number): Generator<number[]> {
  const c = Array.from({ length: k }, (_, i) => i)
  while (true) {
    yield c.slice()
    let i = k - 1
    while (i >= 0 && c[i] === n - k + i) i--
    if (i < 0) return
    c[i]++
    for (let j = i + 1; j < k; j++) c[j] = c[j - 1] + 1
  }
}

export interface Cscv {
  S: number
  splits: number
  /** Part des découpages où la configuration choisie dans l'échantillon finit sous la médiane hors échantillon (λ ≤ 0). */
  pbo: number
  /** Logit du rang relatif hors échantillon de la configuration choisie, par découpage. */
  lambda: Float64Array
  /** Index de la configuration choisie, par découpage. */
  chosen: Int32Array
  /** Sharpe (par période) dans et hors échantillon de la configuration choisie, par découpage. */
  isSharpe: Float64Array
  oosSharpe: Float64Array
  /** Nombre de fois où chaque configuration est choisie. */
  chosenCount: Int32Array
  /** Rang relatif moyen hors échantillon de chaque configuration (0–1), sur tous les découpages. */
  meanOosRank: Float64Array
  /** P(Sharpe hors échantillon de la configuration choisie < 0). */
  probLoss: number
  /** Pente et ordonnée de la régression du Sharpe hors échantillon sur le Sharpe dans l'échantillon (choisie). */
  slope: number
  intercept: number
}

/**
 * CSCV : la matrice (N séries de T jours) est coupée en S blocs contigus ; pour chaque choix de S/2
 * blocs d'entraînement, la configuration au meilleur Sharpe dans l'échantillon est retenue et son
 * rang relatif parmi les N est mesuré sur les S/2 autres blocs. Ex aequo : rang moyen.
 */
export function cscv(series: ArrayLike<number>[], S: number): Cscv {
  const N = series.length, T = series[0].length
  if (S % 2) throw new Error('S doit être pair')
  const blk = blockIndex(T, S)
  // sommes par configuration et par bloc
  const s1 = new Float64Array(N * S), s2 = new Float64Array(N * S), cnt = new Float64Array(S)
  for (let t = 0; t < T; t++) cnt[blk[t]]++
  for (let n = 0; n < N; n++) {
    const x = series[n]
    if (x.length !== T) throw new Error('séries de longueurs différentes')
    for (let t = 0; t < T; t++) { s1[n * S + blk[t]] += x[t]; s2[n * S + blk[t]] += x[t] * x[t] }
  }
  const shp = (n: number, mask: Uint8Array, inSet: number) => {
    let a = 0, q = 0, m = 0
    for (let s = 0; s < S; s++) if (mask[s] === inSet) { a += s1[n * S + s]; q += s2[n * S + s]; m += cnt[s] }
    const mu = a / m, v = q / m - mu * mu
    return v > 0 ? mu / Math.sqrt(v) : 0
  }
  const lambdas: number[] = [], chosen: number[] = [], isS: number[] = [], oosS: number[] = []
  const chosenCount = new Int32Array(N), rankSum = new Float64Array(N)
  const mask = new Uint8Array(S)
  const isv = new Float64Array(N), oos = new Float64Array(N)
  for (const c of combinations(S, S / 2)) {
    mask.fill(0)
    for (const s of c) mask[s] = 1
    let best = 0
    for (let n = 0; n < N; n++) { isv[n] = shp(n, mask, 1); oos[n] = shp(n, mask, 0); if (isv[n] > isv[best]) best = n }
    // rang hors échantillon (1 … N, ex aequo au rang moyen) de chaque configuration
    for (let n = 0; n < N; n++) {
      let below = 0, ties = 0
      for (let m = 0; m < N; m++) { if (m === n) continue; if (oos[m] < oos[n]) below++; else if (oos[m] === oos[n]) ties++ }
      const rank = below + 1 + ties / 2
      rankSum[n] += rank / (N + 1)
      if (n === best) { const w = rank / (N + 1); lambdas.push(Math.log(w / (1 - w))) }
    }
    chosen.push(best); chosenCount[best]++; isS.push(isv[best]); oosS.push(oos[best])
  }
  const K = lambdas.length
  let mx = 0, my = 0
  for (let k = 0; k < K; k++) { mx += isS[k]; my += oosS[k] }
  mx /= K; my /= K
  let sxx = 0, sxy = 0
  for (let k = 0; k < K; k++) { sxx += (isS[k] - mx) ** 2; sxy += (isS[k] - mx) * (oosS[k] - my) }
  const slope = sxx > 0 ? sxy / sxx : NaN
  return {
    S, splits: K, pbo: lambdas.filter(l => l <= 0).length / K, lambda: Float64Array.from(lambdas), chosen: Int32Array.from(chosen),
    isSharpe: Float64Array.from(isS), oosSharpe: Float64Array.from(oosS), chosenCount, meanOosRank: rankSum.map(x => x / K),
    probLoss: oosS.filter(x => x < 0).length / K, slope, intercept: my - slope * mx,
  }
}

// ---------------------------------------------------------------- walk-forward
export interface WalkForward {
  /** Pour chaque période de test : début (index de jour), fin exclue, configuration choisie. */
  folds: { from: number; to: number; chosen: number; trainSharpe: number }[]
  /** Rendements journaliers hors échantillon mis bout à bout (jours [folds[0].from, dernier to)). */
  oos: number[]
}

/**
 * Sélection chronologique : à chaque date de recalage `cuts[j]` (index de jour), la configuration au
 * meilleur Sharpe sur tous les jours avant cette date est appliquée jusqu'à la date suivante (la
 * dernière jusqu'à la fin). Rien d'après la date de recalage n'est lu.
 */
export function walkForward(series: ArrayLike<number>[], cuts: number[]): WalkForward {
  const T = series[0].length
  const folds: WalkForward['folds'] = []
  const oos: number[] = []
  for (let j = 0; j < cuts.length; j++) {
    const from = cuts[j], to = j + 1 < cuts.length ? cuts[j + 1] : T
    let best = 0, bs = -Infinity
    series.forEach((x, n) => { const s = sharpe(Array.prototype.slice.call(x, 0, from)); if (s > bs) { bs = s; best = n } })
    folds.push({ from, to, chosen: best, trainSharpe: bs })
    for (let t = from; t < to; t++) oos.push(series[best][t])
  }
  return { folds, oos }
}
