// Optimisation par grille des réglages du Shock Engine, même méthode que pour les scripts :
// recherche sur l'échantillon, meilleure combinaison rejouée hors échantillon.

import type { Bars, Settings } from '../../backtest/types.ts'
import { gridSearch, inSampleSettings } from '../../backtest/optimize.ts'
import type { Objective, OptParam, OptResult } from '../../backtest/optimize.ts'
import { runShockBacktest } from './adapter.ts'
import type { ShockSpec } from './adapter.ts'
import type { ShockParams } from './params.ts'

export function optimizeShock(
  bars: Bars,
  spec: ShockSpec,
  params: OptParam[],
  settings: Settings,
  objective: Objective,
  minTrades = 5,
  onProgress?: (done: number, total: number) => void,
): OptResult {
  const inSettings = inSampleSettings(bars, settings)
  const withValues = (values: number[]): ShockSpec => {
    const p = { ...spec.params } as Record<string, unknown>
    params.forEach((q, k) => { p[q.name] = values[k] })
    return { kind: 'shock', params: p as unknown as ShockParams, adaptive: null }
  }
  return gridSearch(
    params,
    values => runShockBacktest(bars, withValues(values), inSettings).result.metrics,
    values => {
      const r = runShockBacktest(bars, withValues(values), settings).result
      return { bestIn: r.inSample ?? r.metrics, bestOut: r.outSample }
    },
    objective,
    minTrades,
    onProgress,
  )
}
