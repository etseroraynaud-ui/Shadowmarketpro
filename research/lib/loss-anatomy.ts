// Anatomie des pertes (research/preregistration/loss-anatomy.md) : classes de perdants selon la MFE,
// et contrefactuel de premier ordre « stop au point mort après +1 R » sur le trajet intrabarre du
// moteur (ouverture → extrême le plus proche → l'autre → clôture, comme broker.ts).

import type { Bars } from '../../lib/backtest/types.ts'

export type LossClass = 'A' | 'B' | 'C' | 'W'

/** A : MFE < 0,5 R ; B : 0,5 ≤ MFE < 1 R ; C : MFE ≥ 1 R (perdants, R ≤ 0) ; W : gagnant. */
export const lossClass = (R: number, mfeR: number): LossClass => (R > 0 ? 'W' : mfeR < 0.5 ? 'A' : mfeR < 1 ? 'B' : 'C')

/** Trajet supposé d'une bougie : ouverture, extrême le plus proche de l'ouverture, l'autre, clôture. */
export function tvPath(o: number, h: number, l: number, c: number): number[] {
  return h - o < o - l ? [o, h, l, c] : [o, l, h, c]
}

/**
 * Premier passage à +1 R puis retour au prix d'entrée avant la sortie réelle. Bougies i + 1 … j − 1
 * entières (position ouverte d'un bout à l'autre), bougie de sortie j : ouverture seulement.
 */
export function breakevenAfter1R(b: Bars, i: number, j: number, dir: 1 | -1, entry: number, stopDist: number): { reached: boolean; beHit: boolean } {
  let reached = false
  for (let k = i + 1; k <= j && k < b.n; k++) {
    const pts = k < j ? tvPath(b.o[k], b.h[k], b.l[k], b.c[k]) : [b.o[k]]
    for (const x of pts) {
      const fav = dir * (x - entry)
      if (!reached) { if (fav >= stopDist) reached = true }
      else if (fav <= 0) return { reached, beHit: true }
    }
  }
  return { reached, beHit: false }
}

/**
 * R contrefactuel si le point mort est touché : part du TP1 déjà exécutée (le TP1 est atteint avant
 * +1 R quand son niveau est ≤ 1 R), reste fermé au prix d'entrée, commissions du trade réel.
 */
export function breakevenR(useTP1: boolean, tp1R: number, tp1Qty: number, feesR: number): number {
  return (useTP1 && tp1R <= 1 ? tp1Qty * tp1R : 0) - feesR
}
