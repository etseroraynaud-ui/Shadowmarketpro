// Optimisation dans un Web Worker : la page reste fluide pendant les centaines de backtests.

import { optimize } from './optimize.ts'
import type { Objective, OptParam } from './optimize.ts'
import type { Bars, Settings } from './types.ts'

interface Job {
  bars: Bars
  script: string
  overrides: Record<string, number>
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
    const result = optimize(j.bars, j.script, j.overrides, j.params, j.settings, j.objective, j.minTrades, (done, total) => ctx.postMessage({ type: 'progress', done, total }))
    ctx.postMessage({ type: 'done', result })
  } catch (err) {
    ctx.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
