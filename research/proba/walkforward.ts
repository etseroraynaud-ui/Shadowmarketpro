// Couche probabiliste · walk-forward chronologique.
//
// Plis de test trimestriels ; entraînement « expanding ». Pour chaque cible, un trade n'entre dans
// l'entraînement du pli k (début T_k) que si son label est connu au plus tard à T_k − embargo :
// clôture de la bougie de sortie pour R et ses événements, clôture prévue de la bougie i + h pour la
// continuation. Écrêtage, standardisation, choix de λ (validation interne chronologique purgée de la
// même façon), coefficients et calibration n'utilisent que l'entraînement du pli. La même fonction
// fitAll() estime chaque pli et le modèle figé.

import { createHash } from 'node:crypto'
import { DISPLAY_ORDER, EPV_MIN, HORIZONS, LAMBDAS, MODEL_FEATURES, WALK, CALIBRATION } from './config.ts'
import type { FeatureName, LogitModel } from './config.ts'
import type { TradeRow } from './dataset.ts'
import { applyPlatt, applyTransform, constModel, fitLogit, fitPlatt, fitRidge, fitTransform, logitObjective, predict } from './models.ts'
import type { LinearModel, Platt } from './models.ts'

export type ModelName = 'naive' | LogitModel
export type ERModel = 'naive' | 'ridge' | 'decompConst' | 'decompRidge'
export const ER_MODELS: ERModel[] = ['naive', 'ridge', 'decompConst', 'decompRidge']
export const LOGIT_MODELS: LogitModel[] = ['context', 'reduced', 'full']

/** Cible binaire : valeur (null = non définie) et date de connaissance du label. */
export interface BinaryTarget { key: string; label: string; y: (r: TradeRow) => number | null; known: (r: TradeRow) => number }

export const BINARY_TARGETS: BinaryTarget[] = [
  { key: 'win', label: 'R > 0', y: r => r.win, known: r => r.exitTime },
  { key: 'r1', label: 'R ≥ 1', y: r => r.r1, known: r => r.exitTime },
  { key: 'r2', label: 'R ≥ 2', y: r => r.r2, known: r => r.exitTime },
  { key: 'r3', label: 'R ≥ 3', y: r => r.r3, known: r => r.exitTime },
  ...HORIZONS.map(h => ({ key: `h${h}`, label: `continuation ${h} bougie${h > 1 ? 's' : ''}`, y: (r: TradeRow) => r.horizons[h]?.y ?? null, known: (r: TradeRow) => r.horizons[h]?.labelTime ?? Infinity })),
]
export const targetOf = (key: string) => BINARY_TARGETS.find(t => t.key === key)!

/** Cibles dont la probabilité affichée est calibrée (Platt) quand c'est possible (§ 7). */
export const CALIBRATED: Record<string, 'full' | 'display'> = { win: 'full', r2: 'display', h1: 'full', h4: 'full', h16: 'full', h64: 'full' }

const knownR = (r: TradeRow) => r.exitTime

// ---------------------------------------------------------------- estimation avec validation interne

/**
 * Validation interne chronologique : blocs d'effectifs égaux (ordre d'entrée), chaque bloc v ≥ 1
 * validé par un modèle estimé sur les blocs précédents dont le label est connu au début du bloc v
 * moins l'embargo. Renvoie le λ de plus faible perte totale (à égalité, le plus grand).
 */
export function chooseLambda(rows: TradeRow[], known: (r: TradeRow) => number, fit: (tr: TradeRow[], lambda: number) => LinearModel, loss: (m: LinearModel, va: TradeRow[]) => number, ok: (tr: TradeRow[]) => boolean): { lambda: number; losses: number[] } {
  const B = WALK.innerBlocks
  const n = rows.length
  const cuts = Array.from({ length: B + 1 }, (_, b) => Math.floor((b * n) / B))
  const losses = LAMBDAS.map(() => 0)
  let used = 0
  for (let v = 1; v < B; v++) {
    const va = rows.slice(cuts[v], cuts[v + 1])
    if (!va.length) continue
    const start = va[0].entryTime
    const tr = rows.slice(0, cuts[v]).filter(r => known(r) <= start - WALK.embargoMs)
    if (!ok(tr)) continue
    used++
    LAMBDAS.forEach((lam, j) => { losses[j] += loss(fit(tr, lam), va) })
  }
  let best = LAMBDAS.length - 1
  if (used) for (let j = LAMBDAS.length - 2; j >= 0; j--) if (losses[j] < losses[best] - 1e-12 * Math.abs(losses[best])) best = j
  return { lambda: LAMBDAS[best], losses }
}

const hasBoth = (y: (r: TradeRow) => number) => (tr: TradeRow[]) => { let p = 0; for (const r of tr) p += y(r); return p > 0 && p < tr.length }

function logitAt(tr: TradeRow[], features: FeatureName[], y: (r: TradeRow) => number, lambda: number): LinearModel {
  const T = fitTransform(features, tr.map(r => r.features))
  const X = tr.map(r => applyTransform(T, r.features))
  const f = fitLogit(X, tr.map(y), lambda)
  return { kind: 'logit', features, transform: T, lambda, b0: f.b0, beta: f.beta }
}

function ridgeAt(tr: TradeRow[], features: FeatureName[], y: (r: TradeRow) => number, lambda: number): LinearModel {
  const T = fitTransform(features, tr.map(r => r.features))
  const X = tr.map(r => applyTransform(T, r.features))
  const f = fitRidge(X, tr.map(y), lambda)
  return { kind: 'ridge', features, transform: T, lambda, b0: f.b0, beta: f.beta }
}

const logLossOf = (y: (r: TradeRow) => number) => (m: LinearModel, va: TradeRow[]) => {
  const X = va.map(r => applyTransform(m.transform!, r.features))
  return logitObjective(X, va.map(y), 0, m.b0, m.beta)
}
const sseOf = (y: (r: TradeRow) => number) => (m: LinearModel, va: TradeRow[]) => va.reduce((s, r) => s + (predict(m, r.features) - y(r)) ** 2, 0)

/** Logistique L2, λ choisi par validation interne (rows triés par heure d'entrée). */
export function fitLogitCV(rows: TradeRow[], features: FeatureName[], y: (r: TradeRow) => number, known: (r: TradeRow) => number): LinearModel {
  if (!hasBoth(y)(rows)) return constModel(rows.length ? rows.reduce((s, r) => s + y(r), 0) / rows.length : NaN)
  const { lambda } = chooseLambda(rows, known, (tr, lam) => logitAt(tr, features, y, lam), logLossOf(y), hasBoth(y))
  return logitAt(rows, features, y, lambda)
}

/** Ridge, λ choisi par validation interne (erreur quadratique). */
export function fitRidgeCV(rows: TradeRow[], features: FeatureName[], y: (r: TradeRow) => number, known: (r: TradeRow) => number): LinearModel {
  if (rows.length < 5) return constModel(rows.length ? rows.reduce((s, r) => s + y(r), 0) / rows.length : NaN)
  const { lambda } = chooseLambda(rows, known, (tr, lam) => ridgeAt(tr, features, y, lam), sseOf(y), tr => tr.length >= 5)
  return ridgeAt(rows, features, y, lambda)
}

// ---------------------------------------------------------------- un jeu de modèles

export interface TargetFit {
  nTrain: number
  nPos: number
  models: Partial<Record<ModelName, LinearModel>>
}

export interface ERFit {
  nTrain: number
  naive: LinearModel
  ridge: LinearModel
  /** Moyennes de R des gagnants et des perdants de l'entraînement. */
  meanWin: number
  meanLoss: number
  ridgeWin: LinearModel
  ridgeLoss: LinearModel
}

export interface FittedSet {
  /** Les labels sont connus au plus tard à cutoff − embargo. */
  cutoff: number
  binary: Record<string, TargetFit>
  er: ERFit
  /** Plus récente date de connaissance d'un label utilisé. */
  lastLabel: number
}

/** Modèles autorisés par la règle EPV, cible par cible (naïf toujours). */
export type Allowed = Record<string, ModelName[]>

export function trainingRows(rows: TradeRow[], t: BinaryTarget, cutoff: number): TradeRow[] {
  return rows.filter(r => t.y(r) !== null && t.known(r) <= cutoff - WALK.embargoMs)
}

export function epvAllowed(rows: TradeRow[], cutoff: number): Allowed {
  const out: Allowed = {}
  for (const t of BINARY_TARGETS) {
    const tr = trainingRows(rows, t, cutoff)
    const pos = tr.reduce((s, r) => s + (t.y(r) as number), 0)
    const minor = Math.min(pos, tr.length - pos)
    out[t.key] = ['naive', ...LOGIT_MODELS.filter(m => minor >= EPV_MIN * MODEL_FEATURES[m].length)]
  }
  return out
}

/** Modèle dont la probabilité est affichée pour une cible : complet, sinon réduit, sinon naïf. */
export const displayModel = (allowed: Allowed, key: string): ModelName => DISPLAY_ORDER.find(m => allowed[key].includes(m))!

/** Estime tous les modèles avec les labels connus à cutoff − embargo. rows : triés par heure d'entrée. */
export function fitAll(rows: TradeRow[], cutoff: number, allowed: Allowed): FittedSet {
  const binary: Record<string, TargetFit> = {}
  let lastLabel = -Infinity
  for (const t of BINARY_TARGETS) {
    const tr = trainingRows(rows, t, cutoff)
    const y = (r: TradeRow) => t.y(r) as number
    for (const r of tr) lastLabel = Math.max(lastLabel, t.known(r))
    const nPos = tr.reduce((s, r) => s + y(r), 0)
    const models: Partial<Record<ModelName, LinearModel>> = { naive: constModel(nPos / tr.length) }
    for (const m of LOGIT_MODELS) if (allowed[t.key].includes(m)) models[m] = fitLogitCV(tr, MODEL_FEATURES[m], y, t.known)
    binary[t.key] = { nTrain: tr.length, nPos, models }
  }
  const tr = rows.filter(r => knownR(r) <= cutoff - WALK.embargoMs)
  const yR = (r: TradeRow) => r.R
  const wins = tr.filter(r => r.win), losses = tr.filter(r => !r.win)
  const avg = (xs: TradeRow[]) => xs.reduce((s, r) => s + r.R, 0) / xs.length
  const er: ERFit = {
    nTrain: tr.length,
    naive: constModel(avg(tr)),
    ridge: fitRidgeCV(tr, MODEL_FEATURES.full, yR, knownR),
    meanWin: avg(wins),
    meanLoss: avg(losses),
    ridgeWin: fitRidgeCV(wins, MODEL_FEATURES.full, yR, knownR),
    ridgeLoss: fitRidgeCV(losses, MODEL_FEATURES.full, yR, knownR),
  }
  return { cutoff, binary, er, lastLabel }
}

/** P(gain | X) du modèle complet, base des décompositions. */
const pWin = (S: FittedSet, r: TradeRow) => predict(S.binary.win.models.full ?? S.binary.win.models.naive!, r.features)

export function predictER(S: FittedSet, r: TradeRow): Record<ERModel, number> {
  const p = pWin(S, r)
  return {
    naive: S.er.naive.b0,
    ridge: predict(S.er.ridge, r.features),
    decompConst: p * S.er.meanWin + (1 - p) * S.er.meanLoss,
    decompRidge: p * predict(S.er.ridgeWin, r.features) + (1 - p) * predict(S.er.ridgeLoss, r.features),
  }
}

export function predictBinary(S: FittedSet, r: TradeRow): Record<string, Partial<Record<ModelName, number>>> {
  const out: Record<string, Partial<Record<ModelName, number>>> = {}
  for (const t of BINARY_TARGETS) {
    const ms = S.binary[t.key].models
    out[t.key] = Object.fromEntries(Object.entries(ms).map(([k, m]) => [k, predict(m!, r.features)]))
  }
  return out
}

export const hashOf = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')

// ---------------------------------------------------------------- walk-forward

export interface Fold { k: number; start: number; end: number; test: TradeRow[] }

const addMonths = (ms: number, k: number) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1) }

/** Trimestres de test du premier (WALK.firstTest) au dernier trade ; le dernier pli prend la fin. */
export function makeFolds(rows: TradeRow[]): Fold[] {
  const last = rows[rows.length - 1].entryTime
  const folds: Fold[] = []
  for (let s = Date.parse(WALK.firstTest), k = 1; s <= last; s = addMonths(s, WALK.stepMonths), k++) {
    const e = addMonths(s, WALK.stepMonths)
    folds.push({ k, start: s, end: e, test: [] })
  }
  folds[folds.length - 1].end = Infinity
  for (const r of rows) {
    const f = folds.find(f => r.entryTime >= f.start && r.entryTime < f.end)
    if (f) f.test.push(r)
  }
  return folds
}

/**
 * Walk-forward d'une seule cible binaire et d'un seul modèle logistique (mêmes plis, même purge, même
 * estimation que walkForward) : sert au contrôle positif (labels synthétiques). Renvoie, pour chaque
 * trade hors entraînement, la prévision du modèle et celle du naïf.
 */
export function walkForwardTarget(rows: TradeRow[], t: BinaryTarget, model: LogitModel): { row: TradeRow; p: number; naive: number }[] {
  const out: { row: TradeRow; p: number; naive: number }[] = []
  for (const f of makeFolds(rows)) {
    const tr = trainingRows(rows, t, f.start)
    const y = (r: TradeRow) => t.y(r) as number
    const m = fitLogitCV(tr, MODEL_FEATURES[model], y, t.known)
    const base = tr.reduce((s, r) => s + y(r), 0) / tr.length
    for (const r of f.test) if (t.y(r) !== null) out.push({ row: r, p: predict(m, r.features), naive: base })
  }
  return out
}

export interface PredRow {
  row: TradeRow
  fold: number
  cutoff: number
  foldHash: string
  /** Probabilités par cible et par modèle ; `cal` : version calibrée (NaN si non disponible). */
  p: Record<string, Partial<Record<ModelName | 'cal', number>>>
  er: Record<ERModel, number>
}

export interface FoldInfo {
  k: number
  start: number
  end: number
  cutoff: number
  nTest: number
  hash: string
  fitted: FittedSet
  /** Calibrations de Platt utilisées dans ce pli (null : pas assez de prévisions antérieures). */
  platt: Record<string, Platt | null>
}

export interface WalkForward {
  folds: FoldInfo[]
  preds: PredRow[]
  allowed: Allowed
  display: Record<string, ModelName>
}

export function walkForward(rows: TradeRow[]): WalkForward {
  const folds = makeFolds(rows)
  const allowed = epvAllowed(rows, folds[0].start)
  const display = Object.fromEntries(BINARY_TARGETS.map(t => [t.key, displayModel(allowed, t.key)])) as Record<string, ModelName>
  const infos: FoldInfo[] = []
  const preds: PredRow[] = []
  for (const f of folds) {
    const S = fitAll(rows, f.start, allowed)
    const hash = hashOf(S)
    const platt: Record<string, Platt | null> = {}
    // Calibration : prévisions hors entraînement des plis précédents, labels connus à T_k − embargo.
    for (const [key, which] of Object.entries(CALIBRATED)) {
      const t = targetOf(key)
      const model = which === 'full' ? 'full' : display[key]
      if (model === 'naive' || !allowed[key].includes(model)) { platt[key] = null; continue }
      const prior = preds.filter(q => t.y(q.row) !== null && t.known(q.row) <= f.start - WALK.embargoMs)
      const y = prior.map(q => t.y(q.row) as number)
      const pos = y.reduce((s, v) => s + v, 0)
      platt[key] = prior.length >= CALIBRATION.minObs && pos >= CALIBRATION.minPos && prior.length - pos >= CALIBRATION.minNeg
        ? fitPlatt(prior.map(q => q.p[key][model]!), y) : null
    }
    for (const r of f.test) {
      const p = predictBinary(S, r)
      for (const [key, which] of Object.entries(CALIBRATED)) {
        const model = which === 'full' ? 'full' : display[key]
        const c = platt[key]
        p[key].cal = c && p[key][model] !== undefined ? applyPlatt(c, p[key][model]!) : NaN
      }
      preds.push({ row: r, fold: f.k, cutoff: f.start, foldHash: hash, p, er: predictER(S, r) })
    }
    infos.push({ k: f.k, start: f.start, end: f.end, cutoff: f.start, nTest: f.test.length, hash, fitted: S, platt })
  }
  return { folds: infos, preds, allowed, display }
}
