// Optimisation par grille sur une ou deux variables d'entrée du script.
// La recherche se fait sur la période d'échantillon seulement ; la meilleure combinaison est
// ensuite rejouée sur la période hors échantillon, qu'elle n'a jamais vue.

import type { Bars, Metrics, Settings } from './types.ts'
import { compileScript } from './script/compile.ts'
import { runBacktest, windowIndices } from './engine.ts'

export type Objective = 'sharpe' | 'totalReturn' | 'cagr' | 'profitFactor' | 'calmar' | 'sortino'

export interface OptParam {
  name: string
  from: number
  to: number
  step: number
}

export interface OptCell {
  values: number[]
  score: number
  totalReturn: number
  sharpe: number
  maxDrawdown: number
  trades: number
  /** false si trop peu de trades pour être noté. */
  valid: boolean
}

export interface OptResult {
  params: OptParam[]
  axes: number[][]
  cells: OptCell[]
  best: OptCell | null
  objective: Objective
  minTrades: number
  /** Mesures de la meilleure combinaison : en échantillon, hors échantillon (null sans split). */
  bestIn: Metrics | null
  bestOut: Metrics | null
}

export const MAX_RUNS = 900

export function axisValues(p: OptParam): number[] {
  const out: number[] = []
  if (!(p.step > 0) || !(p.to >= p.from)) return [p.from]
  for (let v = p.from, k = 0; v <= p.to + p.step * 1e-9 && k < 60; v = p.from + ++k * p.step) out.push(Number(v.toFixed(10)))
  return out
}

export function scoreOf(m: Metrics, o: Objective): number {
  const v = m[o]
  if (!Number.isFinite(v)) return v === Infinity ? 1e9 : -1e9
  return v
}

/**
 * Grille générique : `evalIn` mesure une combinaison sur l'échantillon, `evalFull` rejoue la
 * meilleure sur toute la période (mesures échantillon / hors échantillon).
 */
export function gridSearch(
  params: OptParam[],
  evalIn: (values: number[]) => Metrics | null,
  evalFull: (values: number[]) => { bestIn: Metrics | null; bestOut: Metrics | null },
  objective: Objective,
  minTrades = 5,
  onProgress?: (done: number, total: number) => void,
): OptResult {
  const axes = params.map(axisValues)
  const total = axes.reduce((a, x) => a * x.length, 1)
  if (total > MAX_RUNS) throw new Error(`too many combinations (${total} > ${MAX_RUNS})`)
  const cells: OptCell[] = []
  const evalCell = (values: number[]): OptCell => {
    let m: Metrics | null = null
    try {
      m = evalIn(values)
    } catch {
      m = null
    }
    if (!m) return { values, score: NaN, totalReturn: NaN, sharpe: NaN, maxDrawdown: NaN, trades: 0, valid: false }
    return { values, score: scoreOf(m, objective), totalReturn: m.totalReturn, sharpe: m.sharpe, maxDrawdown: m.maxDrawdown, trades: m.trades, valid: m.trades >= minTrades }
  }
  let done = 0
  const rec = (k: number, acc: number[]) => {
    if (k === axes.length) {
      cells.push(evalCell(acc.slice()))
      done++
      if (onProgress && (done % 10 === 0 || done === total)) onProgress(done, total)
      return
    }
    for (const v of axes[k]) {
      acc.push(v)
      rec(k + 1, acc)
      acc.pop()
    }
  }
  rec(0, [])
  let best: OptCell | null = null
  for (const c of cells) if (c.valid && (!best || c.score > best.score)) best = c
  const full = best ? evalFull(best.values) : { bestIn: null, bestOut: null }
  return { params, axes, cells, best, objective, minTrades, bestIn: full.bestIn, bestOut: full.bestOut }
}

/** Réglages de la période d'échantillon : tout jusqu'au début de la validation. */
export function inSampleSettings(bars: Bars, settings: Settings): Settings {
  const hasSplit = windowIndices(bars, settings).split > 0
  return hasSplit ? { ...settings, to: settings.splitTime! - 1, splitTime: null } : { ...settings, splitTime: null }
}

export function optimize(
  bars: Bars,
  script: string,
  baseOverrides: Record<string, number>,
  params: OptParam[],
  settings: Settings,
  objective: Objective,
  minTrades = 5,
  onProgress?: (done: number, total: number) => void,
): OptResult {
  const inSettings = inSampleSettings(bars, settings)
  const over = (values: number[]) => {
    const ov = { ...baseOverrides }
    params.forEach((p, k) => { ov[p.name] = values[k] })
    return ov
  }
  return gridSearch(
    params,
    values => runBacktest(bars, compileScript(script, bars, over(values)).signals, inSettings).metrics,
    values => {
      const res = runBacktest(bars, compileScript(script, bars, over(values)).signals, settings)
      return { bestIn: res.inSample ?? res.metrics, bestOut: res.outSample }
    },
    objective,
    minTrades,
    onProgress,
  )
}
