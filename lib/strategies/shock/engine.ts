// Shock Engine Intraday 15/day : port fidèle du script Pine v6, avec l'exécution du
// simulateur de TradingView (« broker emulator ») tel que le script le configure.
//
// Trois parties, une seule implémentation partagée par le backtest et le bot live :
// - market.ts : indicateurs et signaux bruts, sans lecture du futur ;
// - strategy.ts : décision du script à la clôture de chaque barre, et ses variables « var » ;
// - broker.ts : exécution simulée (backtest, shadow mode) ; en live réel, l'exchange exécute.
//
// simulate() enchaîne, pour chaque barre : sorties dans la barre (broker), calcul du script à la
// clôture (stratégie), exécutions à la clôture (broker).

import type { Costs, ShockParams } from './params.ts'
import type { Market, Prepared } from './market.ts'
import { ShockStrategy } from './strategy.ts'
import type { Decision, EntryOverride } from './strategy.ts'
import { SimBroker } from './broker.ts'
import type { PositionRecord } from './broker.ts'

export * from './market.ts'
export * from './strategy.ts'
export * from './broker.ts'

export interface ShockResult {
  equity: Float64Array
  position: Int8Array
  positions: PositionRecord[]
  fills: number
  start: number
  end: number
  /** Barre et prix de la liquidation du compte, ou null. */
  liquidation: { i: number; price: number } | null
  /** Ordres d'entrée passés (signal effectif), pour les diagnostics. */
  entryLong: Uint8Array
  entryShort: Uint8Array
  prep: Prepared
}

export function runShock(m: Market, p: ShockParams, costs: Costs, start = 0, end = m.bars.n - 1, override?: EntryOverride): ShockResult {
  return simulate(m, [p], costs, start, end, null, override)
}

/**
 * Exécution avec plusieurs jeux de paramètres : `select[i]` donne le jeu qui décide des entrées à
 * la barre i (-1 = pas de nouvelle entrée). Une position garde jusqu'à sa sortie les réglages du
 * jeu qui l'a ouverte (stop, TP1, trailing, VWAP, flip). Avec un seul jeu et `select` nul, c'est
 * exactement le script. `trace` reçoit la décision de chaque barre (contrôle de parité avec le live).
 */
export function simulate(
  m: Market, sets: ShockParams[], costs: Costs, start = 0, end = m.bars.n - 1, select: Int8Array | null = null, override?: EntryOverride,
  trace?: (i: number, d: Decision) => void,
): ShockResult {
  const n = m.bars.n
  const strategy = new ShockStrategy(m, sets, costs.mintick, select, override)
  const broker = new SimBroker(m, sets, costs, (set, i) => strategy.prs[set].atr[i])
  const equity = new Float64Array(n)
  const position = new Int8Array(n)
  const entryLong = new Uint8Array(n)
  const entryShort = new Uint8Array(n)
  for (let i = 0; i < start; i++) equity[i] = costs.capital
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    if (trace) trace(i, d)
    const sent = broker.afterClose(i, d, last)
    if (sent.long) entryLong[i] = 1
    if (sent.short) entryShort[i] = 1
    position[i] = broker.dir()
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, position, positions: broker.positions, fills: broker.fills, start, end, liquidation: broker.liquidation, entryLong, entryShort, prep: strategy.prs[0] }
}
