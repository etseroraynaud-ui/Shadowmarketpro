// Optimisation du Shock Engine dans un Web Worker.

import { optimizeShock } from './optimize.ts'
import type { ShockSpec } from './adapter.ts'
import type { Objective, OptParam } from '../../backtest/optimize.ts'
import type { Bars, Settings } from '../../backtest/types.ts'

interface Job {
  bars: Bars
  spec: ShockSpec
  params: OptParam[]
  settings: Settings
  objective: Objective
  minTrades: number
}

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null
  postMessage: (m: unknown) => void
}

ctx.onmessage = e => {
  const j = e.data
  try {
    const result = optimizeShock(j.bars, j.spec, j.params, j.settings, j.objective, j.minTrades, (done, total) => ctx.postMessage({ type: 'progress', done, total }))
    ctx.postMessage({ type: 'done', result })
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
