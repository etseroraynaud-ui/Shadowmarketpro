// Harnais V1 de l'étude de transfert : le chemin de research/lib/frozen-shock.ts + E2 + calmOnly
// (zero-shot.ts --calm), avec le seul `kMain` du jeu calme qui peut changer. Le moteur et les
// préréglages ne sont pas modifiés : les entrées sont passées à simulate() comme liste imposée, et
// plusieurs valeurs de k coexistent comme jeux distincts (une position garde le jeu qui l'a ouverte).
//
// Coûts : le moteur tourne sans coûts ; les coûts des futures (frais en dollars par contrat, glissement
// en pas de cotation) sont convertis en fraction du nominal au prix de chaque exécution et appliqués
// comme facteur multiplicatif sur le capital (exact pour une taille de 100 % du capital, une seule
// position à la fois), protocole § 7.

import type { Bars } from '../../../lib/backtest/types.ts'
import { marketFor } from '../../../lib/strategies/shock/live.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import type { Market, Prepared } from '../../../lib/strategies/shock/market.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../../lib/strategies/shock/engine.ts'
import type { Costs, ShockParams } from '../../../lib/strategies/shock/params.ts'
import { classify, volatilitySelect } from '../../../lib/strategies/shock/regimes.ts'
import { trendDown } from '../../lib/e2.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import { calmSet, agitatedSet, withK } from './k-grid.ts'
import { DAY, M15 } from './proxy-data.ts'

export const ZERO_COSTS = (mintick: number): Costs => ({ capital: 10000, qtyPct: 100, commissionPct: 0, slippageTicks: 0, slippagePct: 0, mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 })

export interface Contract { name: string; multiplier: number; tick: number }
export const CONTRACTS: Record<'gold' | 'nasdaq', Contract> = {
  gold: { name: 'GC (COMEX, 100 onces)', multiplier: 100, tick: 0.1 },
  nasdaq: { name: 'NQ (CME E-mini Nasdaq-100, 20 $ × indice)', multiplier: 20, tick: 0.25 },
}
export interface CostScenario { key: string; label: string; feePerSide: number; slipTicks: number }
export const SCENARIOS: CostScenario[] = [
  { key: 'zero', label: 'sans coûts', feePerSide: 0, slipTicks: 0 },
  { key: 'low', label: 'bas (2,00 $ ; 0,5 pas)', feePerSide: 2, slipTicks: 0.5 },
  { key: 'base', label: 'référence (3,50 $ ; 1 pas)', feePerSide: 3.5, slipTicks: 1 },
  { key: 'high', label: 'haut (5,00 $ ; 2 pas)', feePerSide: 5, slipTicks: 2 },
  { key: 'stress', label: 'stress (5,00 $ ; 4 pas)', feePerSide: 5, slipTicks: 4 },
]
export const scenario = (key: string) => SCENARIOS.find(s => s.key === key)!
/** Multiple du scénario de référence (courbe de coûts) : frais et glissement × f. */
export const scaled = (f: number): CostScenario => ({ key: `base×${f}`, label: `référence × ${f}`, feePerSide: 3.5 * f, slipTicks: f })

/** Marché, régime, tendance E2 et masque des trous d'un instrument, comme zero-shot.ts pour un actif non crypto. */
export interface Universe {
  bars: Bars
  daily: Bars
  m: Market
  /** 0 calme, 1 agité, −1 inconnu (volatilitySelect, jours de séance). */
  regime: Int8Array
  trend: Uint8Array
  gap: Uint8Array
  mintick: number
  calm: ShockParams
  agitated: ShockParams
}

export function universe(bars: Bars, daily: Bars, mintick: number): Universe {
  const m = marketFor(bars, 15, mintick)
  const regime = volatilitySelect(classify(m.bars, 15, daily), m.bars.n, 0, 1).select
  const trend = trendDown(m.bars, daily)
  const gap = new Uint8Array(bars.n)
  for (let i = 1; i < bars.n; i++) gap[i] = bars.t[i] - bars.t[i - 1] > M15 ? 1 : 0
  return { bars, daily, m, regime, trend, gap, mintick, calm: calmSet(), agitated: agitatedSet() }
}

/**
 * Jeux et sélection pour une suite de valeurs de k (une par bougie) : `kAt(i)` renvoie le k du jeu calme
 * à la bougie i, ou NaN pour aucune entrée (pli non tradé). Jeux : [calme(k₁), …, calme(kₘ), agité].
 * En régime agité, `select` vaut l'indice du jeu agité, comme dans V1 (il n'y ouvre rien : entrées retirées).
 */
export function setsFor(u: Universe, lo: number, end: number, kAt: (i: number) => number) {
  const ks: number[] = []
  const index = new Map<number, number>()
  const sel = new Int8Array(u.bars.n).fill(-1)
  const kOfBar = new Float64Array(u.bars.n).fill(NaN)
  for (let i = lo; i <= end; i++) {
    const k = kAt(i)
    kOfBar[i] = k
    if (Number.isNaN(k)) continue
    if (!index.has(k)) { index.set(k, ks.length); ks.push(k) }
  }
  const agi = ks.length
  for (let i = lo; i <= end; i++) {
    const r = u.regime[i]
    if (r < 0) continue
    if (r === 1) { sel[i] = agi; continue }
    const k = kOfBar[i]
    sel[i] = Number.isNaN(k) ? -1 : index.get(k)!
  }
  const sets = [...ks.map(k => withK(u.calm, k)), u.agitated]
  return { sets, select: sel, ks }
}

/**
 * Entrées V1 : impulse du jeu qui décide, bougie après trou exclue, shorts en régime de tendance
 * baissier (E2), aucune entrée en régime agité (V1). Identique à calmOnly(E2(frozen-shock)) quand un seul
 * k (celui du préréglage) est utilisé.
 */
export function v1Signals(u: Universe, sets: ShockParams[], select: Int8Array, lo: number, end: number, prs?: Prepared[]) {
  const P = prs ?? sets.map(p => prepare(u.m, p))
  const agi = sets.length - 1
  const n = u.bars.n
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = lo; i <= end; i++) {
    const e = select[i]
    if (e < 0 || e === agi || u.gap[i]) continue
    const S = sets[e], R = P[e]
    if (S.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (S.allowShort && R.impulseEntryShort[i] && u.trend[i]) short[i] = 1
  }
  return { long, short }
}

export interface Run {
  res: ShockResult
  /** Capital après coûts du scénario, à chaque clôture. */
  equity: Float64Array
  /** Rendement net par position (pnl / capital à l'entrée, coûts déduits), ordre des positions. */
  net: number[]
  costFrac: number[]
}

/** Coût d'une exécution en fraction du nominal (frais en dollars par contrat, glissement en pas). */
export const execCost = (price: number, c: Contract, s: CostScenario) => s.feePerSide / (price * c.multiplier) + (s.slipTicks * c.tick) / price

/** Applique un scénario de coûts à un run sans coûts. */
export function withCosts(res: ShockResult, c: Contract, s: CostScenario): Run {
  return withCostFn(res, price => execCost(price, c, s))
}

/** Applique un coût par exécution (fraction du nominal, fonction du prix) à un run sans coûts. */
export function withCostFn(res: ShockResult, cost: (price: number) => number): Run {
  const n = res.equity.length
  const mult = new Float64Array(n).fill(1)
  const net: number[] = [], costFrac: number[] = []
  for (const p of res.positions) {
    const cin = cost(p.entryPrice), cout = cost(p.exitPrice)
    mult[p.entryIdx] *= 1 - cin
    mult[p.exitIdx] *= 1 - cout
    net.push((1 + p.pnl / p.equityAtEntry) * (1 - cin) * (1 - cout) - 1)
    costFrac.push(cin + cout)
  }
  const equity = new Float64Array(n)
  let f = 1
  for (let i = 0; i < n; i++) { f *= mult[i]; equity[i] = res.equity[i] * f }
  return { res, equity, net, costFrac }
}

/** Simulation V1 sans coûts sur [lo, end] pour des jeux, une sélection et des entrées donnés. */
export function runV1(u: Universe, sets: ShockParams[], select: Int8Array, signals: { long: Uint8Array; short: Uint8Array }, lo: number, end: number): ShockResult {
  return simulate(u.m, sets, ZERO_COSTS(u.mintick), lo, end, select, signals)
}

/** Rendements journaliers UTC (convention du projet, dailyOf) entre deux dates incluses. */
export function daily(u: Universe, equity: Float64Array, lo: number, end: number, from: number, to: number) {
  return dailyOf(u.bars, equity, lo, end, Math.ceil(from / DAY), Math.floor(to / DAY))
}

/** Indice de la première bougie à partir d'un instant. */
export function idxAt(t: Float64Array, ms: number): number {
  let a = 0, z = t.length
  while (a < z) { const k = (a + z) >> 1; if (t[k] < ms) a = k + 1; else z = k }
  return a
}
