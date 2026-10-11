import type { RunOutput, StrategySource } from '../../lib/backtest/index.ts'

/** Ce que la page backteste : un script ou des signaux importés. */
export type AppSource = StrategySource

export type AppOutput = Pick<RunOutput, 'result' | 'plots' | 'inputs' | 'name' | 'warnings' | 'ms'>
