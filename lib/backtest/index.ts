// Point d'entrée du moteur : une stratégie (script ou signaux importés) + des barres + des
// réglages donnent un résultat complet.

import type { BacktestResult, Bars, InputDef, Msg, Plot, Settings, Signals } from './types.ts'
import { compileScript } from './script/compile.ts'
import { runBacktest } from './engine.ts'
import { signalsFromFile } from './signals.ts'
import type { SignalFile, SignalOptions } from './signals.ts'

export type StrategySource =
  | { kind: 'script'; code: string; overrides: Record<string, number> }
  | { kind: 'signals'; file: SignalFile; options: SignalOptions }

export interface RunOutput {
  result: BacktestResult
  signals: Signals
  plots: Plot[]
  inputs: InputDef[]
  name: string | null
  warnings: Msg[]
  ms: number
}

export function runStrategy(bars: Bars, source: StrategySource, settings: Settings): RunOutput {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  let signals: Signals
  let inputs: InputDef[] = []
  let name: string | null = null
  const warnings: Msg[] = []
  if (source.kind === 'script') {
    const comp = compileScript(source.code, bars, source.overrides)
    signals = comp.signals
    inputs = comp.inputs
    name = comp.name
    warnings.push(...comp.warnings)
  } else {
    const r = signalsFromFile(bars, source.file, source.options)
    signals = r.signals
    warnings.push(...r.warnings)
  }
  const result = runBacktest(bars, signals, settings)
  warnings.push(...result.warnings)
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return { result, signals, plots: signals.plots, inputs, name, warnings, ms: t1 - t0 }
}

export * from './types.ts'
export { compileScript, scriptInputs } from './script/compile.ts'
export { ScriptError } from './script/parser.ts'
export { runBacktest, windowIndices } from './engine.ts'
export { computeMetrics, periodReturns } from './metrics.ts'
export { loadBarsFromCsv, barsFromRecords, sliceBars, resample, timeframeLabel, DataError } from './data.ts'
export { readSignalCsv, signalsFromFile, defaultSignalColumn, guessMode } from './signals.ts'
export type { SignalFile, SignalOptions, SignalMode } from './signals.ts'
export { convertPine } from './pine.ts'
export { randomEntryTest, tradeBootstrap } from './robustness.ts'
export { optimize, axisValues, MAX_RUNS } from './optimize.ts'
export type { Objective, OptParam, OptResult, OptCell } from './optimize.ts'
export { TEMPLATES } from './templates.ts'
