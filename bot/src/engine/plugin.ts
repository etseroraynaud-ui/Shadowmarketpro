// Point d'extension : variante de la stratégie chargée depuis un module hors du dépôt (BOT_PLUGIN).
//
// Le bot ne contient aucune règle de variante. Un module externe peut :
//   - remplacer la liste d'entrées (à partir de celle de la version jouée et du régime de chaque bougie) ;
//   - ajuster les sorties à la clôture d'une bougie sans entrée (position ouverte, bougies depuis l'entrée).
// Le moteur figé (lib/strategies/shock/*) n'est pas modifié : les entrées passent par la liste d'entrées
// de ShockStrategy (EntryOverride), les sorties par la décision, entre la stratégie et l'exécution,
// de la même façon dans le backtest en bloc, le backtest pas à pas (shadow mode) et le moteur live.
// Sans module (défaut), le comportement du bot est inchangé.

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { Bars } from '../../../lib/backtest/types.ts'
import { ShockRunner } from '../../../lib/strategies/shock/live.ts'
import type { Bar, SessionStep, ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { Costs, ShockParams } from '../../../lib/strategies/shock/params.ts'
import type { Market } from '../../../lib/strategies/shock/market.ts'
import { ShockStrategy } from '../../../lib/strategies/shock/strategy.ts'
import type { Decision, EntryOverride, StrategyState } from '../../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../../lib/strategies/shock/broker.ts'
import type { PositionRecord } from '../../../lib/strategies/shock/broker.ts'
import { entriesWithShortTrend, shortTrendMask } from '../../../lib/strategies/short-trend.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import type { Prepared } from '../../../lib/strategies/shock/market.ts'

/** Position ouverte telle qu'un module la lit à la clôture. */
export interface PluginPosition {
  dir: 1 | -1
  set: number
  /** Prix d'entrée moyen. */
  avg: number
  /** Plus haut et plus bas des bougies après la bougie d'entrée (prix d'entrée au départ). */
  hi: number
  lo: number
  atrAtEntry: number
}

export interface StrategyPlugin {
  /** Nom court, journalisé. */
  readonly name: string
  /** Le module n'est défini que sur la version publique (BOT_SHORT_TREND_FILTER=1). */
  readonly requiresShortTrend?: boolean
  /** Liste d'entrées à partir de celle de la version jouée et du jeu de réglages choisi à chaque bougie. */
  entries?(base: EntryOverride, select: Int8Array | null): EntryOverride
  /**
   * À la clôture d'une bougie sans entrée, position ouverte : peut modifier d.exits (stop, objectif,
   * suivi). Renvoie true si les sorties ont été modifiées.
   */
  exits?(d: Decision, pos: PluginPosition, sets: ShockParams[], mintick: number): boolean
}

/** Version jouée par le bot. */
export interface Variant {
  /** Version publique : shorts seulement en régime de tendance journalier baissier. */
  shortTrend: boolean
  plugin: StrategyPlugin | null
}

/** Variante d'une configuration ; un booléen désigne l'ancien réglage (filtre des shorts seul). */
export function variantOf(v: boolean | Variant | { shortTrendFilter: boolean; plugin?: StrategyPlugin | null }): Variant {
  if (typeof v === 'boolean') return { shortTrend: v, plugin: null }
  if ('shortTrend' in v) return v
  return { shortTrend: v.shortTrendFilter, plugin: v.plugin ?? null }
}

export function variantName(v: Variant): string {
  const base = v.shortTrend ? 'publique' : 'moteur'
  return v.plugin ? `${base} + module ${v.plugin.name}` : base
}

/** Charge le module d'une variante (BOT_PLUGIN) ; null sans chemin. */
export async function loadPlugin(path: string | null, shortTrend: boolean): Promise<StrategyPlugin | null> {
  if (!path) return null
  const file = resolve(path)
  if (!existsSync(file)) throw new Error(`BOT_PLUGIN : fichier introuvable (${file})`)
  const mod = (await import(pathToFileURL(file).href)) as { default?: StrategyPlugin }
  const p = mod.default
  if (!p || typeof p.name !== 'string' || (!p.entries && !p.exits)) throw new Error(`BOT_PLUGIN : ${file} doit exporter par défaut { name, entries?, exits? }`)
  if (p.requiresShortTrend && !shortTrend) throw new Error(`BOT_PLUGIN : le module ${p.name} exige BOT_SHORT_TREND_FILTER=1`)
  return p
}

function baseEntries(prs: Prepared[], select: Int8Array | null, n: number, trend: Uint8Array | null): EntryOverride {
  // Sans la condition sur les shorts : les entrées que le moteur prend de lui-même.
  return entriesWithShortTrend(prs, select, n, trend ?? new Uint8Array(n).fill(1))
}

/** Liste d'entrées du backtest en bloc pour la variante (undefined : entrées propres au moteur). */
export function variantEntries(m: Market, sets: ShockParams[], select: Int8Array | null, tfMin: number, regimeBars: Bars | undefined, v: Variant): EntryOverride | undefined {
  const entries = v.plugin?.entries
  if (!v.shortTrend && !entries) return undefined
  const base = baseEntries(sets.map(p => prepare(m, p)), select, m.bars.n, v.shortTrend ? shortTrendMask(m.bars, tfMin, regimeBars ?? m.htf) : null)
  return entries ? v.plugin!.entries!(base, select) : base
}

const WRAPPED = new WeakSet<ShockRunner>()

/**
 * Pose les entrées de la variante sur un runner : sa stratégie reçoit une liste d'entrées (état du
 * script conservé), recalculée après chaque bougie ajoutée, sur les séries que le runner vient de préparer.
 */
export function withEntries(runner: ShockRunner, v: Variant): ShockRunner {
  if (WRAPPED.has(runner) || (!v.shortTrend && !v.plugin?.entries)) return runner
  const ov: EntryOverride = { long: new Uint8Array(0), short: new Uint8Array(0) }
  const refresh = () => {
    let e = baseEntries(runner.strategy.prs, runner.select, runner.n, v.shortTrend ? shortTrendMask(runner.m.bars, runner.cfg.tfMin, runner.regimeBars ?? runner.m.htf) : null)
    if (v.plugin?.entries) e = v.plugin.entries(e, runner.select)
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
  WRAPPED.add(runner)
  return runner
}

/** Sorties du module, à la clôture d'une bougie sans entrée (une entrée inverse retourne la position). */
export function applyExits(d: Decision, q: PluginPosition | null, sets: ShockParams[], mintick: number, plugin: StrategyPlugin | null): boolean {
  if (!plugin?.exits || !q || !d.exits || d.long || d.short) return false
  return plugin.exits(d, q, sets, mintick)
}

/**
 * Backtest en bloc de la variante : la boucle de simulate() (lib/strategies/shock/engine.ts) à
 * l'identique, avec les sorties du module appliquées entre la décision et l'exécution.
 */
export function simulateVariant(
  m: Market, sets: ShockParams[], costs: Costs, start: number, end: number, select: Int8Array | null, override: EntryOverride | undefined, plugin: StrategyPlugin | null,
  trace?: (i: number, d: Decision) => void,
): { equity: Float64Array; positions: PositionRecord[]; adjusted: Set<number> } {
  const n = m.bars.n
  const strategy = new ShockStrategy(m, sets, costs.mintick, select, override)
  const broker = new SimBroker(m, sets, costs, (set, i) => strategy.prs[set].atr[i])
  const equity = new Float64Array(n)
  const adjusted = new Set<number>()
  for (let i = 0; i < start; i++) equity[i] = costs.capital
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    const q = broker.pos
    if (q && applyExits(d, q, sets, costs.mintick, plugin)) adjusted.add(q.entryIdx)
    if (trace) trace(i, d)
    broker.afterClose(i, d, last)
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, positions: broker.positions, adjusted }
}

/**
 * Backtest pas à pas de la variante (shadow mode, attente de la main du bot réel) : la boucle de
 * ShockSession, entrées de la variante et sorties du module entre décision et exécution.
 */
export class VariantSession {
  readonly runner: ShockRunner
  readonly broker: SimBroker
  readonly equity: number[] = []
  readonly entries: { long: number[]; short: number[] } = { long: [], short: [] }
  readonly start: number
  readonly variant: Variant
  readonly adjusted = new Set<number>()
  private readonly costs: Costs

  constructor(cfg: ShockConfig, costs: Costs, history: Bars, start: number, opts: { regimeBars?: Bars; state?: StrategyState }, v: Variant) {
    this.variant = v
    this.costs = costs
    this.runner = withEntries(new ShockRunner(cfg, history, opts), v)
    this.broker = new SimBroker(this.runner.m, cfg.sets, costs, (set, i) => this.runner.strategy.prs[set].atr[i])
    this.start = start
    for (let i = 0; i < start; i++) this.equity.push(costs.capital)
    for (let i = start; i < this.runner.n; i++) this.step(i)
  }

  private step(i: number): Omit<SessionStep, 't' | 'missing'> {
    const before = this.broker.positions.length
    this.broker.beforeClose(i)
    const decision = this.runner.decide(i, this.broker.view(), false)
    const q = this.broker.pos
    if (q && applyExits(decision, q, this.runner.cfg.sets, this.costs.mintick, this.variant.plugin)) this.adjusted.add(q.entryIdx)
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

/** Plus haut / plus bas des bougies strictement après la bougie d'entrée, jusqu'à i (prix d'entrée au départ). */
export function extremesSince(b: Bars, entryBarTime: number, i: number, avg: number): { hi: number; lo: number } {
  let lo = 0, hi = b.n
  while (lo < hi) { const md = (lo + hi) >> 1; if (b.t[md] <= entryBarTime) lo = md + 1; else hi = md }
  let H = avg, L = avg
  for (let k = lo; k <= i; k++) { H = Math.max(H, b.h[k]); L = Math.min(L, b.l[k]) }
  return { hi: H, lo: L }
}
