// Grille du seuil de choc k pour l'étude de transfert GC / NQ (research/preregistration/futures-k-transfer.md).
//
// Seul `kMain` du jeu calme de V1 varie ; tout le reste (règles de qualification, filtres, régimes,
// sorties, taille, coûts) reste celui de V1. Aucune valeur de seuil n'est écrite ici : le jeu calme
// est lu dans lib/strategies/shock/presets.ts, qui n'est pas modifié.
//
// Ce que fait k dans le code d'origine (market.ts, strategy.ts) :
//   seuil micro effectif = mode High Activity ? max(kMicro − 0,2 ; 0,8) : kMicro
//   choc       = |z| > kMain  ou  (useMicroShock et |z| > seuil micro effectif)
//   choc principal = |z| > kMain  (étiquette IMP / μIMP, sortie sur signal inverse si flipMainOnly)
//   λ = rang centile de la moyenne exponentielle de `choc` → filtre des longs (λ > longLamPct)
// Avec useMicroShock = true et un seuil micro effectif sous kMain, kMain ne change aucun choc : seul
// le seuil micro décide. Le jeu calme de V1 a useMicroShock = false : kMain y est le seul seuil, et
// le faire varier déplace ensemble le déclencheur, le filtre λ et les sorties sur signal inverse.

import { DEFAULT_PARAMS } from '../../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../../lib/strategies/shock/params.ts'
import { ADAPTIVE15 } from '../../../lib/strategies/shock/presets.ts'

/** Grille pré-enregistrée : 1,5 à 4,0 par pas de 0,1 (26 valeurs). */
export function kGrid(): number[] {
  return Array.from({ length: 26 }, (_, j) => Math.round((1.5 + 0.1 * j) * 10) / 10)
}

/** Jeu calme de V1, construit comme adaptivePreset() (défauts du script + écarts du préréglage). */
export function calmSet(): ShockParams {
  if (!ADAPTIVE15.calm) throw new Error('préréglage calme absent')
  return { ...DEFAULT_PARAMS, ...ADAPTIVE15.calm }
}

/** Jeu agité de V1 (n'ouvre aucune position dans V1 : entrées en régime calme seulement). */
export function agitatedSet(): ShockParams {
  if (!ADAPTIVE15.agitated) throw new Error('préréglage agité absent')
  return { ...DEFAULT_PARAMS, ...ADAPTIVE15.agitated }
}

/** Le jeu calme de V1 avec kMain = k ; aucun autre réglage ne change. */
export function withK(base: ShockParams, k: number): ShockParams {
  return { ...base, kMain: k }
}

/** Seuil micro effectif du code d'origine (NaN si les micro-chocs sont coupés). */
export function effectiveMicro(p: ShockParams): number {
  if (!p.useMicroShock) return NaN
  return p.highActivityMode ? Math.max(p.kMicro - 0.2, 0.8) : p.kMicro
}

/**
 * Seuil qui décide réellement des chocs : kMain, ou le seuil micro effectif s'il est plus bas.
 * Deux valeurs de kMain qui restent au-dessus du seuil micro effectif donnent les mêmes chocs.
 */
export function shockThreshold(p: ShockParams): number {
  const m = effectiveMicro(p)
  return Number.isNaN(m) ? p.kMain : Math.min(p.kMain, m)
}

/** Empreinte d'une liste d'entrées et de sorties sur signal inverse (FNV-1a sur les indices actifs). */
export function signature(...vectors: ArrayLike<number>[]): string {
  let h = 0x811c9dc5
  for (const [v, x] of vectors.entries()) {
    h = Math.imul(h ^ (v + 1), 0x01000193) >>> 0
    for (let i = 0; i < x.length; i++) {
      if (!x[i]) continue
      h = Math.imul(h ^ (i & 0xffff), 0x01000193) >>> 0
      h = Math.imul(h ^ (i >>> 16), 0x01000193) >>> 0
    }
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * Configurations effectives : les valeurs de k dont les entrées et les sorties sur signal inverse
 * sont identiques sur les données forment une seule configuration (comptée une fois dans les
 * corrections pour tests multiples). `sig(k)` renvoie l'empreinte de k ; les groupes gardent l'ordre
 * de la grille.
 */
export function effectiveConfigs(ks: number[], sig: (k: number) => string): { key: string; ks: number[] }[] {
  const groups = new Map<string, number[]>()
  for (const k of ks) {
    const s = sig(k)
    const g = groups.get(s)
    if (g) g.push(k)
    else groups.set(s, [k])
  }
  return [...groups.entries()].map(([key, g]) => ({ key, ks: g }))
}
