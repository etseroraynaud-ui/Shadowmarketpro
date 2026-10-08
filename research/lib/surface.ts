// Surface adaptative continue du Shock Engine (recherche) : état de marché journalier, poids
// continus des experts bas / moyen / haut de volatilité, réglages θ(t) qui en découlent, et
// conversion en jeux de réglages complets + `select` pour le moteur existant.
//
// Rien ici ne modifie le moteur : la surface figée devient un catalogue de jeux (un par état
// quantifié) et un `select` par bougie, exactement le mécanisme du mode adaptatif actuel. Le
// backtest et le bot passent donc par le même code (ShockStrategy, SimBroker) qu'aujourd'hui.
//
// Causalité : l'état d'une bougie est celui du dernier jour clos avant sa clôture ; chaque valeur
// journalière ne dépend que des jours précédents (rang parmi les H jours d'avant).

import type { Bars } from '../../lib/backtest/types.ts'
import { stdev } from '../../lib/backtest/indicators.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'

// ---------------------------------------------------------------- état journalier

export interface DayState {
  t: Float64Array
  /** Volatilité réalisée : écart type des rendements journaliers sur 20 jours (comme le régime actuel). */
  vol: Float64Array
  /** Rang percentile de vol parmi les H jours précédents (0..1). */
  p: Float64Array
  /** Instabilité de la volatilité : coefficient de variation de vol sur 60 jours, puis son rang. */
  vov: Float64Array
  qVov: Float64Array
  /** Tendance ↔ range : rapport d'efficacité sur 30 jours (|variation nette| / chemin parcouru), puis son rang. */
  tc: Float64Array
  qTc: Float64Array
}

/** Part des `h` valeurs précédentes (finies) inférieures ou égales à la valeur du jour ; NaN avec moins de 60. */
export function trailingRank(x: Float64Array, h: number, minObs = 60): Float64Array {
  const n = x.length
  const out = new Float64Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(x[i])) continue
    let below = 0
    let cnt = 0
    for (let k = Math.max(0, i - h); k < i; k++) {
      if (!Number.isFinite(x[k])) continue
      cnt++
      if (x[k] <= x[i]) below++
    }
    if (cnt >= minObs) out[i] = below / cnt
  }
  return out
}

/** État journalier ; H = profondeur du rang, en jours (183, 365, 548). */
export function dayState(daily: Bars, H: number, opt = { volLen: 20, vovLen: 60, tcLen: 30 }): DayState {
  const n = daily.n
  const c = daily.c
  const r = new Float64Array(n)
  for (let i = 1; i < n; i++) r[i] = Math.log(c[i] / c[i - 1])
  const vol = stdev(r, opt.volLen) as Float64Array
  const vov = new Float64Array(n).fill(NaN)
  for (let i = opt.vovLen - 1; i < n; i++) {
    let s = 0, s2 = 0, ok = true
    for (let k = i - opt.vovLen + 1; k <= i; k++) {
      if (!Number.isFinite(vol[k])) { ok = false; break }
      s += vol[k]; s2 += vol[k] * vol[k]
    }
    if (!ok) continue
    const m = s / opt.vovLen
    vov[i] = m > 0 ? Math.sqrt(Math.max(s2 / opt.vovLen - m * m, 0)) / m : NaN
  }
  const tc = new Float64Array(n).fill(NaN)
  for (let i = opt.tcLen; i < n; i++) {
    let path = 0
    for (let k = i - opt.tcLen + 1; k <= i; k++) path += Math.abs(c[k] - c[k - 1])
    tc[i] = path > 0 ? Math.abs(c[i] - c[i - opt.tcLen]) / path : NaN
  }
  return { t: daily.t, vol, p: trailingRank(vol, H), vov, qVov: trailingRank(vov, H), tc, qTc: trailingRank(tc, H) }
}

/** Jour de chaque bougie : dernier jour clos au plus tard à la clôture de la bougie (-1 sinon). */
export function barDay(bars: Bars, tfMin: number, daily: Bars): Int32Array {
  const out = new Int32Array(bars.n).fill(-1)
  const tfMs = tfMin * 60000
  let k = -1
  for (let i = 0; i < bars.n; i++) {
    const closeT = bars.t[i] + tfMs
    while (k + 1 < daily.n && daily.t[k + 1] + 86400000 <= closeT) k++
    out[i] = k
  }
  return out
}

// ---------------------------------------------------------------- poids des experts

/** Centres des experts bas / moyen / haut sur l'échelle du percentile, largeur des noyaux. */
export const CENTERS = [1 / 6, 1 / 2, 5 / 6]
export const SIGMA = 0.15

/** Poids continus : noyaux gaussiens normalisés (somme = 1, aucun saut). */
export function softWeights(p: number): number[] {
  const w = CENTERS.map(c => Math.exp(-((p - c) ** 2) / (2 * SIGMA * SIGMA)))
  const s = w[0] + w[1] + w[2]
  return w.map(x => x / s)
}

/** Affectation dure : l'expert dont le noyau domine (tiers du percentile). */
export function tertile(p: number): 0 | 1 | 2 {
  return p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2
}

// ---------------------------------------------------------------- réglages adaptatifs

/**
 * Réglages adaptatifs et leur grille de calibration. θ est manipulé en coordonnées de grille
 * (0 = premier cran, fractions permises) : c'est l'unité naturelle des plateaux, du
 * rétrécissement et de la pénalité de courbure. Entre deux crans, interpolation linéaire
 * (logarithmique pour le stop et le stop suiveur).
 */
export const DIMS = ['s', 'atrStopMult', 'atrTrailMult', 'rangeWin'] as const
export type Dim = (typeof DIMS)[number]
export const GRID: Record<Dim, number[]> = {
  s: [1.8, 2.0, 2.2, 2.45, 2.7, 2.95, 3.2],
  atrStopMult: [0.8, 1.1, 1.6, 2.3, 3.3, 4.5],
  atrTrailMult: [2.2, 3.2, 5, 10, 50],
  rangeWin: [15, 30, 50],
}
const LOG: Record<Dim, boolean> = { s: false, atrStopMult: true, atrTrailMult: true, rangeWin: false }
const tr = (d: Dim, v: number) => (LOG[d] ? Math.log(v) : v)
const untr = (d: Dim, v: number) => (LOG[d] ? Math.exp(v) : v)

/** Coordonnée de grille → valeur (extrapolation linéaire au-delà des bords). */
export function valueAt(d: Dim, x: number): number {
  const g = GRID[d]
  const k = Math.min(Math.max(Math.floor(x), 0), g.length - 2)
  const f = x - k
  return untr(d, tr(d, g[k]) + f * (tr(d, g[k + 1]) - tr(d, g[k])))
}

/** Valeur → coordonnée de grille (réciproque de valueAt). */
export function indexOf(d: Dim, v: number): number {
  const g = GRID[d]
  const y = tr(d, v)
  let k = 0
  while (k < g.length - 2 && y > tr(d, g[k + 1])) k++
  return k + (y - tr(d, g[k])) / (tr(d, g[k + 1]) - tr(d, g[k]))
}

// ---------------------------------------------------------------- réglages de base

/** Réglages de base (non adaptatifs) qui diffèrent entre les jeux calme et agité du préréglage. */
export const BASE_NUM = ['volWin', 'wickThr', 'htfEmaLen', 'volZWin', 'volZThr', 'atrLen', 'tp1AtrMult', 'cooldownBars', 'compThr'] as const
const INT = new Set(['volWin', 'htfEmaLen', 'volZWin', 'atrLen', 'cooldownBars', 'tp1QtyPct', 'rangeWin'])

export interface Base {
  calm: ShockParams
  agit: ShockParams
  /** Écart kMain − seuil effectif : 0 en calme (kMain est le seuil), 0,4 en agité (kMain dominé). */
  deltaCalm: number
  deltaAgit: number
}

/** Base tirée des deux jeux du préréglage. */
export function baseFrom(calm: ShockParams, agit: ShockParams): Base {
  const sCalm = calm.useMicroShock ? Math.min(calm.kMain, Math.max(calm.kMicro - 0.2, 0.8)) : calm.kMain
  const sAgit = agit.useMicroShock ? Math.min(agit.kMain, Math.max(agit.kMicro - 0.2, 0.8)) : agit.kMain
  return { calm, agit, deltaCalm: calm.kMain - sCalm, deltaAgit: agit.kMain - sAgit }
}

/** θ du préréglage (en coordonnées de grille) pour un côté. */
export function presetTheta(p: ShockParams): number[] {
  const s = p.useMicroShock ? Math.min(p.kMain, Math.max(p.kMicro - 0.2, 0.8)) : p.kMain
  return [indexOf('s', s), indexOf('atrStopMult', p.atrStopMult), indexOf('atrTrailMult', p.atrTrailMult), indexOf('rangeWin', p.rangeWin)]
}

// ---------------------------------------------------------------- surface

export interface Tilt {
  feature: 'qVov' | 'qTc'
  /** Écart de θ entre la moitié haute et la moitié basse de la variable, en coordonnées de grille. */
  delta: number[]
}

export interface SurfaceSpec {
  /** θ des experts : 1 (global), 2 (calme / agité, frontière à la médiane) ou 3 (bas / moyen / haut). */
  experts: number[][]
  /** Poids continus (sinon affectation dure). Sans effet avec 1 ou 2 experts. */
  soft: boolean
  /** Réglages de base interpolés avec les mêmes poids (sinon calme / agité à la médiane). */
  softBase: boolean
  tilts: Tilt[]
}

/** État quantifié d'un jour : percentile par pas de 5 %, variables secondaires par pas de 25 %. */
export interface QState { p: number; side: 0 | 1; hard: 0 | 1 | 2; qVov: number; qTc: number }

export function quantize(p: number, qVov: number, qTc: number): QState {
  return {
    p: Math.round(p * 20) / 20,
    side: p > 0.5 ? 1 : 0,
    hard: tertile(p),
    qVov: Number.isFinite(qVov) ? Math.round(qVov * 4) / 4 : 0.5,
    qTc: Number.isFinite(qTc) ? Math.round(qTc * 4) / 4 : 0.5,
  }
}

/** θ(t) en coordonnées de grille. */
export function thetaAt(spec: SurfaceSpec, q: QState): number[] {
  const E = spec.experts
  let w: number[]
  if (E.length === 1) w = [1]
  else if (E.length === 2) w = q.side ? [0, 1] : [1, 0]
  else w = spec.soft ? softWeights(q.p) : [0, 1, 2].map(k => (k === q.hard ? 1 : 0))
  const th = DIMS.map((_, d) => E.reduce((s, e, k) => s + w[k] * e[d], 0))
  for (const tl of spec.tilts) {
    const x = Math.min(Math.max(tl.feature === 'qVov' ? q.qVov : q.qTc, 0.25), 0.75)
    for (let d = 0; d < DIMS.length; d++) th[d] += 2 * (x - 0.5) * tl.delta[d]
  }
  return th.map((x, d) => Math.min(Math.max(x, -0.5), GRID[DIMS[d]].length - 0.5))
}

const round = (k: string, v: number) => (INT.has(k) ? Math.max(1, Math.round(v)) : v)

/** Jeu de réglages complet pour un état. */
export function paramsAt(spec: SurfaceSpec, base: Base, q: QState): ShockParams {
  const side = q.side ? base.agit : base.calm
  const out: ShockParams = { ...side }
  let delta = q.side ? base.deltaAgit : base.deltaCalm
  if (spec.softBase) {
    const w = softWeights(q.p)
    const wa = w[1] / 2 + w[2] // poids du jeu agité ; l'expert moyen est le milieu des deux jeux
    for (const k of BASE_NUM) {
      const v = (1 - wa) * (base.calm[k] as number) + wa * (base.agit[k] as number)
      ;(out as unknown as Record<string, number>)[k] = round(k, v)
    }
    delta = (1 - wa) * base.deltaCalm + wa * base.deltaAgit
  }
  const th = thetaAt(spec, q)
  const s = valueAt('s', th[0])
  out.useMicroShock = true
  out.kMicro = s + 0.2
  out.kMain = s + delta
  out.atrStopMult = valueAt('atrStopMult', th[1])
  out.atrTrailMult = valueAt('atrTrailMult', th[2])
  out.rangeWin = round('rangeWin', valueAt('rangeWin', th[3]))
  return out
}

/** Le préréglage actuel, exprimé comme une surface : 2 experts, base calme / agitée à la médiane. */
export function presetSpec(base: Base): SurfaceSpec {
  return { experts: [presetTheta(base.calm), presetTheta(base.agit)], soft: false, softBase: false, tilts: [] }
}
