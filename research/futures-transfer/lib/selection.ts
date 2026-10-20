// Sélection du seuil (protocole § 5 et § 6) : note S de regime-wf.ts (min des t par position sur les
// deux moitiés de l'entraînement, 15 positions par moitié), plateau sur ± 1 cran, choix et seuil 1 ;
// seuil quantile Q_0,99(|z|) sur les seules bougies d'entraînement.

import { quantile, tstat } from './stats.ts'

export interface Pos { entryIdx: number; exitIdx: number; net: number }

export const MIN_PER_HALF = 15
export const T_MIN = 1

/**
 * S sur la fenêtre [a, trainEnd) en indices de bougies : positions entrées à partir de a et sorties avant
 * trainEnd (purge), coupure au milieu de la fenêtre en nombre de bougies (comme `choose`).
 */
export function scoreS(ps: Pos[], a: number, trainEnd: number): { s: number; n1: number; n2: number; t1: number; t2: number } {
  const mid = Math.floor((a + trainEnd) / 2)
  const h1: number[] = [], h2: number[] = []
  for (const p of ps) {
    if (p.entryIdx < a || p.exitIdx >= trainEnd) continue
    ;(p.entryIdx < mid ? h1 : h2).push(p.net)
  }
  if (h1.length < MIN_PER_HALF || h2.length < MIN_PER_HALF) return { s: -Infinity, n1: h1.length, n2: h2.length, t1: NaN, t2: NaN }
  const t1 = tstat(h1), t2 = tstat(h2)
  return { s: Math.min(t1, t2), n1: h1.length, n2: h2.length, t1, t2 }
}

/**
 * Plateau et choix : P(k) = moyenne de S(k − 0,1), S(k), S(k + 0,1), pour les k de la grille qui ont leurs
 * deux voisins ; −∞ si l'un des trois est −∞. k* = argmax P (ex aequo : le plus grand) ; tradé si P(k*) ≥ 1.
 */
export function pickPlateau(ks: number[], S: number[]): { k: number; p: number; trade: boolean; plateau: number[] } {
  const plateau = ks.map((_, j) => {
    if (j === 0 || j === ks.length - 1) return -Infinity
    const v = [S[j - 1], S[j], S[j + 1]]
    return v.some(x => x === -Infinity) ? -Infinity : (v[0] + v[1] + v[2]) / 3
  })
  let best = -1
  for (let j = 0; j < ks.length; j++) if (plateau[j] > -Infinity && (best < 0 || plateau[j] >= plateau[best])) best = j
  if (best < 0) return { k: NaN, p: -Infinity, trade: false, plateau }
  return { k: ks[best], p: plateau[best], trade: plateau[best] >= T_MIN, plateau }
}

/** Largeur du plateau autour de k (C6) : k et ses voisins à ± 1 et ± 2 crans ont tous S ≥ 1. */
export function plateauOK(ks: number[], S: number[], k: number): { ok: boolean; values: (number | null)[] } {
  const j = ks.findIndex(x => Math.abs(x - k) < 1e-9)
  const values = [-2, -1, 0, 1, 2].map(d => (j + d >= 0 && j + d < ks.length ? S[j + d] : null))
  return { ok: values.every(v => v !== null && v >= T_MIN), values }
}

/** Seuil quantile (méthode B) : Q_q(|z|) sur les bougies admissibles de [a, trainEnd). */
export function quantileK(z: Float64Array, a: number, trainEnd: number, admissible: (i: number) => boolean, q = 0.99): number {
  const xs: number[] = []
  for (let i = a; i < trainEnd; i++) if (admissible(i) && Number.isFinite(z[i])) xs.push(Math.abs(z[i]))
  return quantile(xs, q)
}
