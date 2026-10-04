import type { RunOutput, StrategySource } from '../../lib/backtest/index.ts'
import type { ShockSpec } from '../../lib/strategies/shock/adapter.ts'

/** Ce que la page backteste : un script, des signaux importés, ou le Shock Engine. */
export type AppSource = StrategySource | ShockSpec

export type AppOutput = Pick<RunOutput, 'result' | 'plots' | 'inputs' | 'name' | 'warnings' | 'ms'>
