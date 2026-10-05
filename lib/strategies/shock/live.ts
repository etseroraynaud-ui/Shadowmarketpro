// Shock Engine · moteur barre par barre, pour le bot live et le shadow mode.
//
// Le bot reçoit une bougie close à la fois. Ce module garde tout l'historique depuis la même
// première barre que le backtest, recalcule les séries à chaque clôture et appelle la même
// stratégie (strategy.ts), dont l'état est conservé d'une barre à l'autre. Les calculs sont
// causaux : ajouter une barre ne change aucune valeur des barres déjà vues. Rejouer un historique
// bougie par bougie redonne donc exactement le backtest calculé d'un bloc (test de parité).
//
// Rien ici ne dépend d'un exchange : les données entrent sous forme de barres, les décisions
// sortent sous forme de `Decision`.

import type { Bars } from '../../backtest/types.ts'
import { resample } from '../../backtest/data.ts'
import { makeMarket } from './market.ts'
import type { Market } from './market.ts'
import { ShockStrategy, initialState } from './strategy.ts'
import type { Decision, PositionView, StrategyState } from './strategy.ts'
import { SimBroker } from './broker.ts'
import type { PositionRecord, SimPosition } from './broker.ts'
import { classify, volatilitySelect } from './regimes.ts'
import { DEFAULT_PARAMS } from './params.ts'
import type { Costs, ShockParams } from './params.ts'
import { ADAPTIVE15, ADAPTIVE30 } from './presets.ts'

export interface Bar {
  /** Ouverture de la bougie, ms UTC. */
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

export interface ShockConfig {
  /** Jeux de réglages ; en mode adaptatif, [calme, agité]. */
  sets: ShockParams[]
  adaptive: boolean
  /** Timeframe du graphique, en minutes. */
  tfMin: number
  /** Pas de cotation de l'instrument (syminfo.mintick). */
  mintick: number
}

/** Préréglage adaptatif volatilité, construit comme sur le site (défauts du script + écarts). */
export function adaptivePreset(tfMin: 15 | 30, mintick: number): ShockConfig {
  const pr = tfMin === 15 ? ADAPTIVE15 : ADAPTIVE30
  if (!pr.calm || !pr.agitated) throw new Error('préréglage adaptatif incomplet')
  return { sets: [{ ...DEFAULT_PARAMS, ...pr.calm }, { ...DEFAULT_PARAMS, ...pr.agitated }], adaptive: true, tfMin, mintick }
}

/** Marché du moteur à partir des barres du graphique, construit comme sur le site. */
export function marketFor(bars: Bars, tfMin: number, mintick: number): Market {
  const htf = tfMin < 60 ? resample(bars, 3600000) : bars
  return makeMarket(bars, tfMin, htf, tfMin < 60 ? 60 : tfMin, mintick)
}

/**
 * Jeu qui décide des entrées à chaque barre. `regimeBars` : barres horaires ou journalières d'où
 * le régime de volatilité est tiré ; par défaut, les barres 60 min du marché, comme sur le site.
 */
export function selectFor(cfg: ShockConfig, m: Market, regimeBars?: Bars): { select: Int8Array | null; agitated: Float64Array | null } {
  if (!cfg.adaptive) return { select: null, agitated: null }
  return volatilitySelect(classify(m.bars, cfg.tfMin, regimeBars ?? m.htf), m.bars.n, 0, 1)
}

function toBars(cols: number[][]): Bars {
  const [t, o, h, l, c, v] = cols.map(x => Float64Array.from(x))
  return { n: t.length, t, o, h, l, c, v }
}

/** Historique + stratégie : une décision par bougie close. */
export class ShockRunner {
  readonly cfg: ShockConfig
  private cols: number[][]
  m: Market
  strategy: ShockStrategy
  select: Int8Array | null
  agitated: Float64Array | null
  regimeBars: Bars | undefined

  constructor(cfg: ShockConfig, history: Bars, opts: { regimeBars?: Bars; state?: StrategyState } = {}) {
    this.cfg = cfg
    this.cols = [Array.from(history.t), Array.from(history.o), Array.from(history.h), Array.from(history.l), Array.from(history.c), Array.from(history.v)]
    this.regimeBars = opts.regimeBars
    this.m = marketFor(history, cfg.tfMin, cfg.mintick)
    const sel = selectFor(cfg, this.m, this.regimeBars)
    this.select = sel.select
    this.agitated = sel.agitated
    this.strategy = new ShockStrategy(this.m, cfg.sets, cfg.mintick, this.select, undefined, opts.state ?? initialState())
  }

  get n(): number {
    return this.m.bars.n
  }

  get lastTime(): number {
    return this.n ? this.m.bars.t[this.n - 1] : -Infinity
  }

  /**
   * Ajoute la bougie close suivante et recalcule les séries. `regimeBars` remplace la source du
   * régime (nouvelle bougie journalière close). Refuse une bougie qui n'est pas strictement après
   * la précédente. Renvoie l'indice de la barre et le nombre de bougies manquantes avant elle.
   */
  push(bar: Bar, regimeBars?: Bars): { i: number; missing: number } {
    if (!(bar.t > this.lastTime)) throw new Error(`bougie ${new Date(bar.t).toISOString()} pas après la précédente`)
    const step = this.cfg.tfMin * 60000
    const missing = this.n ? Math.round((bar.t - this.lastTime) / step) - 1 : 0
    const row = [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v]
    for (let k = 0; k < 6; k++) this.cols[k].push(row[k])
    if (regimeBars) this.regimeBars = regimeBars
    this.m = marketFor(toBars(this.cols), this.cfg.tfMin, this.cfg.mintick)
    const sel = selectFor(this.cfg, this.m, this.regimeBars)
    this.select = sel.select
    this.agitated = sel.agitated
    this.strategy.setMarket(this.m, this.select)
    return { i: this.n - 1, missing }
  }

  /** Calcul du script à la clôture de la barre i (la dernière en live). */
  decide(i: number, pos: PositionView | null, last = false): Decision {
    return this.strategy.onClose(i, pos, last)
  }

  /** Valeurs des indicateurs à la barre i, pour le journal. */
  context(i: number) {
    const set = this.select ? this.select[i] : 0
    const sets = this.strategy.prs.map((p, k) => ({
      set: k, z: p.z[i], atr: p.atr[i], volZ: p.volZ[i], lamPct: p.lamPct[i], htf: p.htfVal[i], vwap: p.vwap[i],
    }))
    return { t: this.m.bars.t[i], close: this.m.bars.c[i], regime: this.agitated ? this.agitated[i] : NaN, entrySet: set, sets }
  }
}

/** Ce qui s'est passé à la clôture d'une barre en shadow mode. */
export interface SessionStep {
  i: number
  t: number
  missing: number
  decision: Decision
  sent: { long: boolean; short: boolean }
  /** Positions fermées pendant cette barre (dans la barre ou à sa clôture). */
  closed: PositionRecord[]
  position: SimPosition | null
  equity: number
}

/**
 * Backtest pas à pas : stratégie + broker simulé, exactement la boucle de simulate(), une bougie
 * à la fois. C'est le moteur du shadow mode.
 */
export class ShockSession {
  readonly runner: ShockRunner
  readonly broker: SimBroker
  readonly equity: number[] = []
  readonly entries: { long: number[]; short: number[] } = { long: [], short: [] }
  readonly start: number

  constructor(cfg: ShockConfig, costs: Costs, history: Bars, start: number, opts: { regimeBars?: Bars } = {}) {
    this.runner = new ShockRunner(cfg, history, opts)
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

  /** Bougie close suivante : recalcul, puis la barre est jouée comme dans le backtest. */
  push(bar: Bar, regimeBars?: Bars): SessionStep {
    const { i, missing } = this.runner.push(bar, regimeBars)
    this.broker.setMarket(this.runner.m)
    return { ...this.step(i), t: bar.t, missing }
  }
}
