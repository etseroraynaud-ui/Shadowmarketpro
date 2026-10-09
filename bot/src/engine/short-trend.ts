// Condition de la version publique du Shock Engine sur les shorts : une entrée short n'est autorisée
// que si le régime de tendance journalier est baissier, soit clôture journalière sous sa moyenne
// 50 jours et moyenne en baisse sur 10 jours, au dernier jour clos avant la clôture de la bougie
// (classify, lib/strategies/shock/regimes.ts). Même définition que la recherche (research/lib/e2.ts).
//
// Le moteur figé (lib/strategies/shock/*) n'est pas modifié : la condition passe par la liste
// d'entrées de ShockStrategy (EntryOverride), recalculée après chaque bougie. Seules les entrées
// short changent ; les longs, les sorties et le flip sur choc opposé restent ceux du moteur.
//
// Désactivée par défaut : BOT_SHORT_TREND_FILTER=1 l'active (bot/src/config.ts).

import type { Bars } from '../../../lib/backtest/types.ts'
import { ShockRunner, ShockSession } from '../../../lib/strategies/shock/live.ts'
import type { Bar, SessionStep, ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { Market } from '../../../lib/strategies/shock/market.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import type { Prepared } from '../../../lib/strategies/shock/market.ts'
import type { Costs, ShockParams } from '../../../lib/strategies/shock/params.ts'
import { ShockStrategy } from '../../../lib/strategies/shock/strategy.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import type { StrategyState } from '../../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../../lib/strategies/shock/broker.ts'
import { classify } from '../../../lib/strategies/shock/regimes.ts'

/** 1 quand le régime de tendance journalier (dernier jour clos) est baissier. */
export function shortTrendMask(bars: Bars, tfMin: number, regimeBars: Bars): Uint8Array {
  const reg = classify(bars, tfMin, regimeBars)
  const out = new Uint8Array(bars.n)
  for (let i = 0; i < bars.n; i++) out[i] = reg.id[i] >= 0 && reg.id[i] >> 1 === 2 ? 1 : 0
  return out
}

/** Entrées que le moteur prend de lui-même (impulse ou fade du jeu actif), shorts limités au masque. */
function entriesOf(prs: Prepared[], select: Int8Array | null, n: number, trend: Uint8Array): EntryOverride {
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = select ? select[i] : 0
    if (e < 0) continue
    const R = prs[e]
    if (R.impulseEntryLong[i] || R.fadeEntryLong[i]) long[i] = 1
    if ((R.impulseEntryShort[i] || R.fadeEntryShort[i]) && trend[i]) short[i] = 1
  }
  return { long, short }
}

/** Liste d'entrées du backtest en bloc (simulate) avec la condition sur les shorts. */
export function shortTrendEntries(m: Market, sets: ShockParams[], select: Int8Array | null, tfMin: number, regimeBars: Bars | undefined): EntryOverride {
  return entriesOf(sets.map(p => prepare(m, p)), select, m.bars.n, shortTrendMask(m.bars, tfMin, regimeBars ?? m.htf))
}

const FILTERED = new WeakSet<ShockRunner>()
export const isFiltered = (r: ShockRunner) => FILTERED.has(r)

/**
 * Pose la condition sur un runner : sa stratégie reçoit une liste d'entrées (état du script
 * conservé), recalculée après chaque bougie ajoutée, sur les séries que le runner vient de préparer.
 */
export function withShortTrendFilter(runner: ShockRunner): ShockRunner {
  if (FILTERED.has(runner)) return runner
  const ov: EntryOverride = { long: new Uint8Array(0), short: new Uint8Array(0) }
  const refresh = () => {
    const e = entriesOf(runner.strategy.prs, runner.select, runner.n, shortTrendMask(runner.m.bars, runner.cfg.tfMin, runner.regimeBars ?? runner.m.htf))
    ov.long = e.long
    ov.short = e.short
  }
  runner.strategy = new ShockStrategy(runner.m, runner.cfg.sets, runner.cfg.mintick, runner.select, ov, runner.strategy.state)
  refresh()
  const push = runner.push.bind(runner)
  runner.push = (bar: Bar, regimeBars?: Bars) => {
    const r = push(bar, regimeBars)
    refresh()
    return r
  }
  FILTERED.add(runner)
  return runner
}

/** Runner du bot, avec ou sans la condition. */
export function newRunner(cfg: ShockConfig, history: Bars, opts: { regimeBars?: Bars; state?: StrategyState }, filter: boolean): ShockRunner {
  const r = new ShockRunner(cfg, history, opts)
  return filter ? withShortTrendFilter(r) : r
}

/**
 * Backtest pas à pas avec la condition : la boucle de ShockSession (lib/strategies/shock/live.ts),
 * la condition posée avant de rejouer l'historique.
 */
export class FilteredSession {
  readonly runner: ShockRunner
  readonly broker: SimBroker
  readonly equity: number[] = []
  readonly entries: { long: number[]; short: number[] } = { long: [], short: [] }
  readonly start: number

  constructor(cfg: ShockConfig, costs: Costs, history: Bars, start: number, opts: { regimeBars?: Bars } = {}) {
    this.runner = withShortTrendFilter(new ShockRunner(cfg, history, opts))
    this.broker = new SimBroker(this.runner.m, cfg.sets, costs, (set, i) => this.runner.strategy.prs[set].atr[i])
    this.start = start
    for (let i = 0; i < start; i++) this.equity.push(costs.capital)
    for (let i = start; i < this.runner.n; i++) this.step(i)
  }

  private step(i: number): Omit<SessionStep, 't' | 'missing'> {
    const before = this.broker.positions.length
    this.broker.beforeClose(i)
    const decision = this.runner.decide(i, this.broker.view(), false)
    const sent = this.broker.afterClose(i, decision, false)
    if (sent.long) this.entries.long.push(i)
    if (sent.short) this.entries.short.push(i)
    const equity = this.broker.capitalNow(i)
    this.equity.push(equity)
    return { i, decision, sent, closed: this.broker.positions.slice(before), position: this.broker.pos, equity }
  }

  push(bar: Bar, regimeBars?: Bars): SessionStep {
    const { i, missing } = this.runner.push(bar, regimeBars)
    this.broker.setMarket(this.runner.m)
    return { ...this.step(i), t: bar.t, missing }
  }
}

/** Ce que le bot utilise d'une session (ShockSession ou FilteredSession). */
export type Session = Pick<ShockSession, 'runner' | 'broker' | 'equity' | 'entries' | 'start' | 'push'>

/** Session du bot : celle du moteur sans la condition (comportement inchangé), la filtrée avec. */
export function newSession(cfg: ShockConfig, costs: Costs, history: Bars, start: number, opts: { regimeBars?: Bars }, filter: boolean): Session {
  return filter ? new FilteredSession(cfg, costs, history, start, opts) : new ShockSession(cfg, costs, history, start, opts)
}
