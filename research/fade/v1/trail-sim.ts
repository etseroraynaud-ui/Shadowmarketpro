// COPIE ISOLÉE de simulate() (lib/strategies/shock/engine.ts) avec le broker copié trail-broker.ts, pour
// l'étude du trailing stop (research/preregistration/v1-trailing.md). La stratégie (décisions à la clôture)
// est celle du moteur figé, importée sans modification. Seule différence : après les exécutions de la
// clôture, le broker peut activer le stop suiveur conditionnel au régime ([trailing] regimeClose), le point
// mort et la sortie anticipée ([be-volume] extraClose).

import type { Costs, ShockParams } from '../../../lib/strategies/shock/params.ts'
import type { Market } from '../../../lib/strategies/shock/market.ts'
import { ShockStrategy } from '../../../lib/strategies/shock/strategy.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import { TrailBroker } from './trail-broker.ts'
import type { PositionRecord, TrailSpec } from './trail-broker.ts'

export interface TrailRun {
  equity: Float64Array
  position: Int8Array
  positions: PositionRecord[]
}

export function simulateTrail(
  m: Market, sets: ShockParams[], costs: Costs, start: number, end: number, select: Int8Array | null, override: EntryOverride | undefined, spec: TrailSpec,
): TrailRun {
  const n = m.bars.n
  const strategy = new ShockStrategy(m, sets, costs.mintick, select, override)
  const broker = new TrailBroker(m, sets, costs, (set, i) => strategy.prs[set].atr[i], spec)
  const equity = new Float64Array(n)
  const position = new Int8Array(n)
  for (let i = 0; i < start; i++) equity[i] = costs.capital
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    broker.afterClose(i, d, last)
    if (!last) broker.regimeClose(i)
    if (!last) broker.extraClose(i)
    position[i] = broker.dir()
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, position, positions: broker.positions }
}
