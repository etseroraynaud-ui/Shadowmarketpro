// Outils d'évaluation des variantes rejouées en portefeuille complet, sans modifier le moteur :
// boucle de simulate() avec une taille de position par jeu de réglages, rendements journaliers
// (convention de research/shock/portfolio.ts) et exposition.

import type { Bars } from '../../lib/backtest/types.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../lib/strategies/shock/broker.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import * as P from './portfolio.ts'

const DAY = 864e5
const M15 = 15 * 60000

export interface SizedRun {
  equity: Float64Array
  position: Int8Array
  /** Notionnel absolu de la position à la clôture de chaque bougie. */
  notional: Float64Array
  positions: PositionRecord[]
  start: number
  end: number
}

/**
 * La boucle de simulate() (lib/strategies/shock/engine.ts), avec une taille de position par jeu :
 * à l'ouverture décidée par le jeu e, le broker lit `qtyPct × scale[e]`. Le broker lit la taille à
 * chaque ouverture seulement ; aucune décision d'entrée ou de sortie n'en dépend (levier 1).
 */
export function simulateSized(m: Market, sets: ShockParams[], costs: Costs, start: number, end: number, select: Int8Array | null, override: EntryOverride | undefined, scale: number[]): SizedRun {
  const n = m.bars.n
  const c = { ...costs }
  const strategy = new ShockStrategy(m, sets, c.mintick, select, override)
  const broker = new SimBroker(m, sets, c, (set, i) => strategy.prs[set].atr[i])
  const equity = new Float64Array(n), position = new Int8Array(n), notional = new Float64Array(n)
  for (let i = 0; i < start; i++) equity[i] = c.capital
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    const e = d.long?.set ?? d.short?.set
    c.qtyPct = costs.qtyPct * (e === undefined ? 1 : scale[e] ?? 1)
    broker.afterClose(i, d, last)
    c.qtyPct = costs.qtyPct
    position[i] = broker.dir()
    equity[i] = broker.capitalNow(i)
    const q = broker.pos
    notional[i] = q ? q.qty * m.bars.c[i] : 0
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, position, notional, positions: broker.positions, start, end }
}

/** Rendements journaliers UTC sur les jours complets de [lo, end] (ou [D0, D1]), base = equity à lo − 1. */
export function dailyOf(b: Bars, equity: Float64Array, lo: number, end: number, D0?: number, D1?: number) {
  const t = b.t
  const d0 = D0 ?? Math.ceil(t[lo] / DAY), d1 = D1 ?? Math.floor((t[end] + M15) / DAY) - 1
  const idxAt = (ms: number) => { let a = 0, z = b.n; while (a < z) { const k = (a + z) >> 1; if (t[k] < ms) a = k + 1; else z = k } return a }
  const a = idxAt(d0 * DAY), z = idxAt((d1 + 1) * DAY) - 1
  const days: number[] = []
  for (let d = d0; d <= d1; d++) days.push(d)
  const base = equity[a - 1]
  const { eq } = P.dayCloses(t, equity, a, z, days, base)
  return { days, r: P.returnsOf(eq, base), a, z }
}

/** Part des bougies [a, z] avec une position, et notionnel / equity moyen. */
export function exposure(run: SizedRun, a: number, z: number) {
  let inPos = 0, gross = 0
  for (let i = a; i <= z; i++) { if (run.position[i] !== 0) inPos++; gross += run.notional[i] / run.equity[i] }
  const n = z - a + 1
  return { timeInMarket: inPos / n, avgGross: gross / n }
}
