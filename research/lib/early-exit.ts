// Invalidation précoce (research/preregistration/early-invalidation.md) : mesures à la clôture de la
// bougie i + k pour un trade encore ouvert, et boucle de simulate() avec une fermeture au marché
// injectée à i + k si le prix n'a pas confirmé. La fermeture passe par le même chemin qu'une
// fermeture décidée par le script (Decision.close) ; le moteur n'est pas modifié.

import type { Bars } from '../../lib/backtest/types.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../lib/strategies/shock/broker.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

export interface Landmark {
  /** Encore ouvert une fois la bougie i + k jouée. */
  open: boolean
  /** d·(c[i+k] − prix d'entrée), en ATR d'entrée. */
  retAtr: number
  /** Même rendement en R (ATR / atrStopMult). */
  retR: number
  /** Part du mouvement de la bougie de choc rendue : d·(c[i] − c[i+k]) / d·(c[i] − c[i−1]). */
  retrace: number
  /** Clôture de i + k revenue de l'autre côté du niveau cassé. */
  reentered: boolean
  /** Volume moyen des bougies i + 1 … i + k / volume de la bougie de choc. */
  volRatio: number
  /** TP1 exécuté au plus tard à la clôture de i + k (posé à la clôture de i + 1, comme le moteur). */
  tp1: boolean
}

export function landmark(b: Bars, p: PositionRecord, k: number, level: number, P: ShockParams): Landmark {
  const i = p.entryIdx, d = p.dir, j = i + k
  const atr = p.atrAtEntry
  const shock = d * (b.c[i] - b.c[i - 1])
  let vol = 0
  for (let x = i + 1; x <= j; x++) vol += b.v[x]
  const tp1Dist = P.tp1AtrMult * Math.max(atr, 0)
  let tp1 = false
  if (P.useTP1) {
    if (d * (b.c[i + 1] - p.entryPrice) >= tp1Dist) tp1 = true
    for (let x = i + 2; x <= j && !tp1; x++) if (d * ((d === 1 ? b.h[x] : b.l[x]) - p.entryPrice) >= tp1Dist) tp1 = true
  }
  const retAtr = (d * (b.c[j] - p.entryPrice)) / atr
  return {
    open: p.exitIdx > j, retAtr, retR: retAtr / P.atrStopMult,
    retrace: shock !== 0 ? (d * (b.c[i] - b.c[j])) / shock : NaN,
    reentered: d * (b.c[j] - level) < 0,
    volRatio: b.v[i] > 0 ? vol / k / b.v[i] : NaN,
    tp1,
  }
}

/** R d'une fermeture à la clôture de i + k : part du TP1 déjà exécutée, reste au prix de clôture, commissions du trade réel. */
export function exitValueR(l: Landmark, P: ShockParams, feesR: number): number {
  const q = P.tp1QtyPct / 100, tp1R = P.tp1AtrMult / P.atrStopMult
  return (l.tp1 ? q * tp1R + (1 - q) * l.retR : l.retR) - feesR
}

export interface EarlyRun {
  equity: Float64Array
  position: Int8Array
  positions: PositionRecord[]
  /** Bougie d'entrée des positions fermées par la règle. */
  early: Set<number>
}

/**
 * La boucle de simulate() ; si `k` est donné, une position encore ouverte à la clôture de la bougie
 * entrée + k, dont le prix n'est pas au-dessus (long) ou au-dessous (short) du prix d'entrée, est
 * fermée au marché à cette clôture (comme une fermeture décidée par le script). Sans `k` : simulate().
 */
export function simulateEarlyExit(m: Market, sets: ShockParams[], costs: Costs, start: number, end: number, select: Int8Array | null, override: EntryOverride | undefined, k: number | null): EarlyRun {
  const n = m.bars.n
  const c = m.bars.c
  const strategy = new ShockStrategy(m, sets, costs.mintick, select, override)
  const broker = new SimBroker(m, sets, costs, (set, i) => strategy.prs[set].atr[i])
  const equity = new Float64Array(n), position = new Int8Array(n)
  const early = new Set<number>()
  for (let i = 0; i < start; i++) equity[i] = costs.capital
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    let d = strategy.onClose(i, broker.view(), last)
    const q = broker.pos
    if (k !== null && q && !d.close && i - q.entryIdx === k && q.dir * (c[i] - q.avg) <= 0) {
      d = { ...d, close: 'FLIP' }
      early.add(q.entryIdx)
    }
    broker.afterClose(i, d, last)
    position[i] = broker.dir()
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, position, positions: broker.positions, early }
}
