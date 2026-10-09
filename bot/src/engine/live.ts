// Moteur live : le Shock Engine (même stratégie que le backtest) + RiskEngine + ExecutionEngine.
//
// À chaque bougie close, comme le broker simulé du backtest (broker.ts) :
//   1. sorties survenues pendant la bougie (stop, TP1, stop suiveur, liquidation) : lues dans les
//      fills de l'exchange ;
//   2. décision du script à la clôture (ShockStrategy.onClose), avec la position réelle ;
//   3. exécution : niveaux des ordres de sortie (posés à la clôture qui suit l'entrée, comme le
//      script), fermeture au marché (VWAP, flip), entrées et retournements.
// Entre deux clôtures, le stop suiveur suit le prix (Hyperliquid n'a pas de trailing natif).
//
// Démarrage :
// - premier lancement : l'historique est rejoué avec le broker simulé (le backtest) ; le bot ne
//   prend la main que lorsque ce backtest est à plat, et seulement si le compte l'est aussi.
//   L'état du script est alors exactement celui du backtest ;
// - redémarrage : état relu, comparé à Hyperliquid (position, ordres, fills). Au moindre écart,
//   le bot n'envoie plus aucun ordre (halted) jusqu'à intervention manuelle.
//
// Pas d'ordre en double :
// - chaque ordre porte un identifiant client (cloid) écrit dans l'état avant l'envoi ; une réponse
//   incertaine (délai dépassé, connexion coupée) est résolue en demandant à l'exchange le statut
//   de ce cloid, jamais en renvoyant l'ordre ; au redémarrage, un ordre en suspens est retrouvé de
//   la même façon ;
// - le stop est déplacé en posant le nouveau avant d'annuler l'ancien (réduction seule : deux
//   stops ne peuvent pas fermer plus que la position, et la position n'est jamais sans stop) ;
// - à chaque clôture, les ordres du bot que l'état ne connaît pas sont annulés, un stop disparu
//   est reposé ; un ordre qui ne vient pas du bot arrête tout ;
// - une seule opération à la fois (bougie, prix, fills), un seul processus par compte (verrou).

import type { Bars } from '../../../lib/backtest/types.ts'
import type { ShockRunner } from '../../../lib/strategies/shock/live.ts'
import type { Bar, ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { Decision, EntryOrder } from '../../../lib/strategies/shock/strategy.ts'
import type { Costs } from '../../../lib/strategies/shock/params.ts'
import type { BotConfig } from '../config.ts'
import { tradedAccount } from '../config.ts'
import type { Exchange, OrderKind, OrderResult, Side } from '../exec/exchange.ts'
import { cloidKind, newCloid } from '../exec/exchange.ts'
import { midOf, spreadBps } from '../data/quotes.ts'
import type { Journal } from '../journal.ts'
import { RiskEngine } from './risk.ts'
import { SET_NAMES, iso, regimeName } from './shadow.ts'
import type { BotState, LivePosition } from './state.ts'
import { StateStore, indexOfTime, loadStrategy, saveStrategy } from './state.ts'
import { newRunner, newSession } from './short-trend.ts'
import type { Session } from './short-trend.ts'

export interface LiveOptions {
  cfg: BotConfig
  shock: ShockConfig
  exchange: Exchange
  journal: Journal
  store: StateStore
  network: 'testnet' | 'mainnet'
  now?: () => number
  /** Attente (remplaçable dans les tests). */
  sleep?: (ms: number) => Promise<void>
  /** Ignore l'état sauvegardé (le compte doit être à plat) : reprise après intervention manuelle. */
  resetState?: boolean
}

/** Coûts du backtest rejoué au premier lancement (ils n'influencent pas les signaux). */
export function handoffCosts(cfg: BotConfig, shock: ShockConfig): Costs {
  return { capital: 10000, qtyPct: cfg.equityPct, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: shock.mintick, leverage: cfg.leverage, maintenancePct: 0.5, fundingPct: 0 }
}

const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

export class LiveEngine {
  readonly o: LiveOptions
  readonly ex: Exchange
  readonly risk: RiskEngine
  readonly journal: Journal
  readonly tfMs: number
  runner: ShockRunner
  /** Premier lancement : backtest pas à pas jusqu'à ce qu'il soit à plat. */
  session: Session | null
  state: BotState
  private queue: Promise<unknown> = Promise.resolve()
  private lastMove = 0

  private constructor(o: LiveOptions, runner: ShockRunner, session: Session | null, state: BotState) {
    this.o = o
    this.ex = o.exchange
    this.risk = new RiskEngine(o.cfg, o.exchange.asset)
    this.journal = o.journal
    this.tfMs = o.shock.tfMin * 60000
    this.runner = runner
    this.session = session
    this.state = state
  }

  private now(): number {
    return this.o.now ? this.o.now() : Date.now()
  }

  private sleep(ms: number): Promise<void> {
    return this.o.sleep ? this.o.sleep(ms) : new Promise(r => setTimeout(r, ms))
  }

  get halted(): string | null {
    return this.state.halted
  }

  get position(): LivePosition | null {
    return this.state.position
  }

  get phase(): 'waiting' | 'trading' | 'halted' {
    return this.state.halted ? 'halted' : this.session ? 'waiting' : 'trading'
  }

  /** Les opérations du moteur s'exécutent une par une (bougie, prix, fills). */
  private serial<T>(f: () => Promise<T>): Promise<T> {
    const p = this.queue.then(f, f)
    this.queue = p.catch(() => undefined)
    return p
  }

  static async start(o: LiveOptions, chart: Bars, daily: Bars): Promise<LiveEngine> {
    const saved = o.resetState ? null : o.store.load()
    const now = o.now ? o.now() : Date.now()
    let eng: LiveEngine
    if (!saved) {
      const session = newSession(o.shock, handoffCosts(o.cfg, o.shock), chart, 0, { regimeBars: daily }, o.cfg.shortTrendFilter)
      const state: BotState = {
        version: 1, network: o.network, coin: o.cfg.coin, account: tradedAccount(o.cfg) ?? '', anchor: chart.t[0], lastBarTime: chart.t[chart.n - 1],
        strategy: saveStrategy(session.runner.strategy.state, chart.t), position: null, seenFills: [], lastFillTime: now, lastFundingTime: now, halted: null, pending: null,
      }
      eng = new LiveEngine(o, session.runner, session, state)
      o.journal.event('live_first_start', { bars: chart.n, simPosition: session.broker.pos ? (session.broker.pos.dir === 1 ? 'long' : 'short') : 'flat' })
      if (!session.broker.pos) eng.handoff()
      await eng.reconcile()
    } else {
      const bad = saved.anchor !== chart.t[0] ? 'première bougie de l\'historique différente' : saved.network !== o.network || saved.coin !== o.cfg.coin || saved.account !== (tradedAccount(o.cfg) ?? '') ? 'réseau, actif ou compte différent' : null
      const idx = indexOfTime(chart.t, saved.lastBarTime)
      if (bad || idx < 0) {
        const runner = newRunner(o.shock, chart, { regimeBars: daily }, o.cfg.shortTrendFilter)
        eng = new LiveEngine(o, runner, null, saved)
        eng.halt(`état sauvegardé incompatible avec l'historique : ${bad ?? 'dernière bougie traitée absente'}`)
        return eng
      }
      const runner = newRunner(o.shock, head(chart, idx + 1), { regimeBars: daily, state: loadStrategy(saved.strategy, chart.t) }, o.cfg.shortTrendFilter)
      eng = new LiveEngine(o, runner, null, saved)
      o.journal.event('live_restart', { lastBar: iso(saved.lastBarTime), missed: chart.n - 1 - idx, position: saved.position ? (saved.position.dir === 1 ? 'long' : 'short') : 'flat', halted: saved.halted })
      if (!saved.halted) {
        await eng.recoverPending()
        if (!eng.halted) await eng.reconcile()
        for (let i = idx + 1; i < chart.n && !eng.halted; i++) await eng.catchUp({ t: chart.t[i], o: chart.o[i], h: chart.h[i], l: chart.l[i], c: chart.c[i], v: chart.v[i] })
      }
    }
    if (!eng.halted) await eng.ex.setLeverage(eng.risk.accountLeverage())
    eng.save()
    return eng
  }

  /** Le backtest rejoué est à plat : le bot prend la main avec l'état du script à cet instant. */
  private handoff(): void {
    this.session = null
    this.state.strategy = saveStrategy(this.runner.strategy.state, this.runner.m.bars.t)
    this.journal.event('handoff', { bar: iso(this.state.lastBarTime + this.tfMs) })
  }

  halt(reason: string): void {
    if (!this.state.halted) {
      this.state.halted = reason
      this.journal.event('HALT', { reason })
    }
    this.save()
  }

  save(): void {
    this.o.store.save(this.state)
  }

  private lotEps(): number {
    return 0.5 * 10 ** -this.ex.asset.szDecimals
  }

  /** Compare l'état local et Hyperliquid ; au moindre écart, plus aucun ordre. */
  async reconcile(): Promise<void> {
    const orders = await this.ex.openOrders()
    const foreign = orders.filter(o => cloidKind(o.cloid) == null)
    if (foreign.length) return this.halt(`${foreign.length} ordre(s) ouvert(s) sur ${this.o.cfg.coin} qui ne viennent pas du bot`)
    await this.applyFills()
    await this.applyFunding()
    const acct = await this.ex.account()
    const pos = this.state.position
    const size = acct.position.size
    if (!pos) {
      if (Math.abs(size) > this.lotEps()) return this.halt(`position de ${size} ${this.o.cfg.coin} chez Hyperliquid, aucune position connue du bot`)
    } else {
      if (Math.sign(size) !== pos.dir || Math.abs(Math.abs(size) - pos.size) > this.lotEps()) {
        return this.halt(`position chez Hyperliquid ${size}, attendue ${pos.dir * pos.size}`)
      }
      if (pos.exitsActive && (pos.stopOid == null || !orders.some(o => o.oid === pos.stopOid))) return this.halt('stop du bot absent chez Hyperliquid')
      if (pos.tp1Oid != null && !pos.tp1Filled && !orders.some(o => o.oid === pos.tp1Oid)) return this.halt('ordre TP1 du bot absent chez Hyperliquid')
    }
    // Ordres du bot que l'état ne suit pas (doublon, reste d'une position fermée) : annulés.
    await this.cancelOrphans(orders)
    this.journal.event('reconciled', { position: size, equity: acct.equity, orders: orders.length })
  }

  /** Ordres ouverts du bot qui ne sont ni le stop, ni le TP1, ni le stop de sécurité de la position. */
  private async cancelOrphans(orders: { oid: number; cloid: string | null; triggerPx: number | null; limitPx: number; sz: number }[]): Promise<void> {
    const p = this.state.position
    const known = new Set([p?.stopOid, p?.tp1Oid, p?.emergencyOid].filter((x): x is number => x != null))
    const orphans = orders.filter(o => cloidKind(o.cloid) != null && !known.has(o.oid))
    if (!orphans.length) return
    const res = await this.ex.cancel(orphans.map(o => o.oid))
    this.journal.event('orphan_orders_canceled', {
      orders: orphans.map((o, k) => ({ oid: o.oid, cloid: o.cloid, kind: cloidKind(o.cloid), trigger: o.triggerPx, px: o.limitPx, sz: o.sz, ok: res[k]?.ok ?? false })),
    })
  }

  /**
   * Ordre envoyé juste avant un arrêt, sans issue connue : retrouvé chez l'exchange par son cloid,
   * jamais renvoyé. Jamais exécuté : oublié. Stop, TP1 ou stop de sécurité posés : adoptés par la
   * position (l'ancien ordre, s'il reste, est annulé comme orphelin). Tout le reste : arrêt.
   */
  async recoverPending(): Promise<void> {
    const p = this.state.pending
    if (!p) return
    const st = await this.ex.orderStatus(p.cloid)
    const fills = (await this.ex.fills(p.at - 60000)).filter(f => f.cloid === p.cloid)
    this.journal.event('pending_order_found', { cloid: p.cloid, kind: p.kind, side: p.side, sz: p.sz, at: iso(p.at), status: st.detail, fills: fills.length })
    const pos = this.state.position
    if (st.status === 'unknown' || ((st.status === 'canceled' || st.status === 'rejected') && !fills.length)) {
      this.state.pending = null
    } else if (pos && st.status === 'open' && st.oid != null && (p.kind === 'stop' || p.kind === 'tp1' || p.kind === 'emergency')) {
      if (p.kind === 'stop') { pos.stopOid = st.oid; pos.stopCloid = p.cloid; pos.stopTrigger = st.triggerPx; pos.stopSz = st.sz ?? pos.size }
      if (p.kind === 'tp1') { pos.tp1Oid = st.oid; pos.tp1Cloid = p.cloid }
      if (p.kind === 'emergency') pos.emergencyOid = st.oid
      pos.oids.push(st.oid)
      pos.cloids.push(p.cloid)
      this.state.pending = null
      this.journal.event('pending_order_adopted', { cloid: p.cloid, kind: p.kind, oid: st.oid })
    } else {
      return this.halt(`ordre ${p.kind} ${p.cloid} envoyé juste avant l'arrêt, état chez l'exchange : ${st.detail}, ${fills.length} fill(s) : vérifier le compte`)
    }
    this.save()
  }

  // ---------------------------------------------------------------- fills et financement

  /** Fills depuis le dernier connu : frais, PnL réalisé, sorties exécutées par l'exchange. */
  private async applyFills(): Promise<void> {
    const fills = (await this.ex.fills(this.state.lastFillTime - 60000)).sort((a, b) => a.time - b.time || a.tid - b.tid)
    const seen = new Set(this.state.seenFills)
    for (const f of fills) {
      if (seen.has(f.tid)) continue
      seen.add(f.tid)
      this.state.seenFills.push(f.tid)
      this.state.lastFillTime = Math.max(this.state.lastFillTime, f.time)
      const pos = this.state.position
      const kind = cloidKind(f.cloid)
      const mine = pos != null && (pos.oids.includes(f.oid) || (f.cloid != null && pos.cloids.includes(f.cloid)))
      if (!pos || (!mine && !f.liquidation)) {
        this.journal.event('fill_unmatched', { oid: f.oid, cloid: f.cloid, kind, side: f.side, px: f.px, sz: f.sz })
        continue
      }
      pos.fees += f.fee
      pos.closedPnl += f.closedPnl
      // Les ordres au marché du bot mettent la position à jour à leur exécution ; les ordres posés
      // chez l'exchange (stop, TP1, stop de sécurité) et les liquidations, ici.
      if (f.liquidation || kind === 'stop' || kind === 'tp1' || kind === 'emergency') {
        const tag = f.liquidation ? 'LIQ' : kind === 'tp1' ? 'TP1' : kind === 'emergency' ? 'EMERGENCY' : pos.stopTrigger != null && pos.stopTrigger !== pos.stop ? 'TRAIL' : 'SL'
        const ref = kind === 'tp1' ? pos.tp : pos.stopTrigger ?? f.px
        pos.slippage += pos.dir * (f.px - ref) * f.sz * -1
        this.exitFill(pos, f.px, f.sz, tag)
        if (kind === 'tp1') pos.tp1Filled = true
        this.journal.event('exit_fill', { tag, px: f.px, sz: f.sz, ref, left: pos.size, oid: f.oid })
      }
    }
    if (this.state.seenFills.length > 2000) this.state.seenFills = this.state.seenFills.slice(-1000)
    const pos = this.state.position
    if (pos && pos.size <= this.lotEps()) await this.finalize()
    else if (pos && pos.stopOid != null && pos.stopTrigger != null && (pos.stopSz ?? pos.size) > pos.size + this.lotEps()) {
      // Après un TP1, le stop est reposé sur le reste de la position.
      await this.setStop(pos, pos.stopTrigger)
    }
  }

  private async applyFunding(): Promise<void> {
    const ev = await this.ex.funding(this.state.lastFundingTime)
    for (const e of ev) {
      if (e.time < this.state.lastFundingTime) continue
      this.state.lastFundingTime = e.time + 1
      if (this.state.position) this.state.position.funding += e.usdc
    }
  }

  private exitFill(pos: LivePosition, px: number, sz: number, tag: string): void {
    pos.exitValue += px * sz
    pos.exitQty += sz
    pos.size = Math.max(0, +(pos.size - sz).toFixed(this.ex.asset.szDecimals + 2))
    if (pos.exits[pos.exits.length - 1] !== tag) pos.exits.push(tag)
  }

  /** Position terminée : ordres restants annulés, trade journalisé. */
  private async finalize(): Promise<void> {
    const p = this.state.position!
    const left = [p.stopOid, p.tp1Oid, p.emergencyOid].filter((x): x is number => x != null)
    const open = new Set((await this.ex.openOrders()).map(o => o.oid))
    const toCancel = left.filter(x => open.has(x))
    if (toCancel.length) await this.ex.cancel(toCancel)
    const exit = p.exitQty > 0 ? p.exitValue / p.exitQty : NaN
    const pnl = p.closedPnl - p.fees + p.funding
    this.journal.trade({
      mode: this.o.cfg.mode, side: p.dir === 1 ? 'long' : 'short', entryTime: iso(p.entryBar + this.tfMs), exitTime: iso(this.now()),
      entry: p.avg, exit, qty: p.exitQty, atr: p.atrAtEntry, regime: SET_NAMES[p.set] ?? String(p.set), set: p.set, tag: p.tag,
      shockZ: p.context.z, volumeZ: p.context.volZ, lambdaPct: p.context.lamPct,
      mae: p.dir === 1 ? p.lo - p.avg : p.avg - p.hi, mfe: p.dir === 1 ? p.hi - p.avg : p.avg - p.lo,
      fees: p.fees, funding: p.funding, slippage: p.slippage, pnl, pnlPct: pnl / (p.avg * p.exitQty), exits: p.exits.join('+'),
      spreadEntryBps: p.spreadEntryBps, spreadExitBps: p.spreadExitBps,
    })
    this.state.position = null
  }

  // ---------------------------------------------------------------- envoi des ordres

  /**
   * Envoi d'un ordre sans risque de doublon : l'intention (cloid) est écrite dans l'état avant
   * l'envoi ; une réponse incertaine est résolue en interrogeant l'exchange par ce cloid. L'intention
   * est effacée en mémoire et disparaît du disque avec l'état qui suit (position mise à jour).
   */
  private async place(kind: OrderKind, side: Side, sz: number, send: (cloid: string) => Promise<OrderResult>): Promise<OrderResult & { cloid: string }> {
    const cloid = newCloid(kind)
    this.state.pending = { cloid, kind, side, sz, at: this.now() }
    this.save()
    let r = await send(cloid)
    if (r.uncertain || (r.status === 'resting' && r.oid == null)) r = await this.resolve(cloid, r)
    this.state.pending = null
    return { ...r, cloid }
  }

  /** Issue réelle d'un ordre sans réponse claire, d'après son statut et ses fills chez l'exchange. */
  private async resolve(cloid: string, first: OrderResult): Promise<OrderResult> {
    for (let k = 1; k <= 4; k++) {
      await this.sleep(500 * k)
      const st = await this.ex.orderStatus(cloid).catch(e => {
        this.journal.event('order_status_failed', { cloid, error: e instanceof Error ? e.message : String(e) })
        return null
      })
      if (!st || st.status === 'unknown') continue
      const fills = (await this.ex.fills(this.now() - 3600000)).filter(f => f.cloid === cloid)
      let filledSz = fills.reduce((a, f) => a + f.sz, 0)
      const avgPx = filledSz > 0 ? fills.reduce((a, f) => a + f.px * f.sz, 0) / filledSz : null
      if (st.status === 'filled' && filledSz === 0) filledSz = st.sz ?? 0
      this.journal.event('order_resolved', { cloid, first: first.status, error: first.error ?? null, status: st.detail, oid: st.oid, filledSz })
      if (st.status === 'open' || st.status === 'triggered') return { status: 'resting', oid: st.oid, filledSz, avgPx }
      if (filledSz > 0) return { status: 'filled', oid: st.oid, filledSz, avgPx }
      return { status: 'error', oid: st.oid, filledSz: 0, avgPx: null, error: `${st.detail} (${first.error ?? 'sans réponse'})` }
    }
    this.journal.event('order_resolved', { cloid, first: first.status, error: first.error ?? null, status: 'unknown' })
    return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: `ordre inconnu de l'exchange après vérification (${first.error ?? 'sans réponse'})` }
  }

  // ---------------------------------------------------------------- appels du programme principal

  /** Bougie close. */
  onBar(bar: Bar, daily?: Bars): Promise<void> {
    return this.serial(async () => {
      if (this.session) {
        const st = this.session.push(bar, daily)
        this.state.lastBarTime = bar.t
        this.journal.event('waiting_bar', { bar: iso(bar.t + this.tfMs), simPosition: st.position ? (st.position.dir === 1 ? 'long' : 'short') : 'flat' })
        if (!st.position) this.handoff()
        this.save()
        return
      }
      if (this.state.halted) {
        this.journal.event('bar_halted', { bar: iso(bar.t + this.tfMs), reason: this.state.halted })
        return
      }
      await this.closeBar(bar, daily, true)
      this.save()
    })
  }

  /** Prix temps réel : stop suiveur et excursions. */
  onMid(mid: number): Promise<void> {
    return this.serial(async () => {
      const pos = this.state.position
      if (!pos || this.state.halted || this.session) return
      pos.hi = Math.max(pos.hi, mid)
      pos.lo = Math.min(pos.lo, mid)
      if (!pos.exitsActive) return
      this.trail(pos, mid)
      const before = pos.stopOid
      await this.refreshStop(false)
      if (this.state.position !== pos || pos.stopOid !== before) this.save()
    })
  }

  /** Lecture périodique des fills entre deux bougies (sorties exécutées par l'exchange). */
  syncFills(): Promise<void> {
    return this.serial(async () => {
      if (this.state.halted || this.session) return
      await this.applyFills()
      this.save()
    })
  }

  // ---------------------------------------------------------------- clôture d'une bougie

  /** Bougie manquée pendant un arrêt : seules des décisions sans ordre peuvent être rattrapées. */
  private async catchUp(bar: Bar): Promise<void> {
    await this.closeBar(bar, undefined, false)
    this.save()
  }

  private async closeBar(bar: Bar, daily: Bars | undefined, execute: boolean): Promise<void> {
    await this.applyFills()
    await this.applyFunding()
    const acct = await this.ex.account()
    let pos = this.state.position
    const size = acct.position.size
    if (pos ? Math.sign(size) !== pos.dir || Math.abs(Math.abs(size) - pos.size) > this.lotEps() : Math.abs(size) > this.lotEps()) {
      return this.halt(`position chez Hyperliquid ${size}, attendue ${pos ? pos.dir * pos.size : 0}`)
    }
    if (execute && !(await this.checkOrders())) return
    if (pos && bar.t > pos.entryBar) {
      pos.hi = Math.max(pos.hi, bar.h)
      pos.lo = Math.min(pos.lo, bar.l)
    }
    const { i, missing } = this.runner.push(bar, daily)
    if (missing > 0) this.journal.event('gap', { before: iso(bar.t), missing })
    const view = pos ? { dir: pos.dir, set: pos.set, avg: pos.avg } : null
    const d = this.runner.decide(i, view, false)
    const ctx = this.runner.context(i)
    this.state.lastBarTime = bar.t
    this.state.strategy = saveStrategy(this.runner.strategy.state, this.runner.m.bars.t)
    if (d.long || d.short || d.close) {
      this.journal.event('signal', {
        bar: iso(bar.t + this.tfMs), close: bar.c, long: d.long ? `${d.long.tag} ${SET_NAMES[d.long.set]}` : null,
        short: d.short ? `${d.short.tag} ${SET_NAMES[d.short.set]}` : null, exit: d.close, regime: regimeName(ctx.regime), sets: ctx.sets,
      })
    }
    if (!execute) {
      const levelsChanged = pos && d.exits && pos.exitsActive && (d.exits.stop !== pos.stop || d.exits.tp !== pos.tp || d.exits.trailDist !== pos.trailDist)
      if (d.long || d.short || d.close || (pos && d.exits && !pos.exitsActive) || levelsChanged) {
        return this.halt(`bougie ${iso(bar.t + this.tfMs)} manquée pendant l'arrêt avec une décision à exécuter`)
      }
      return
    }
    await this.execute(d, i, bar)
    pos = this.state.position
    this.journal.event('bar', {
      bar: iso(bar.t + this.tfMs), close: bar.c, regime: regimeName(ctx.regime), position: pos ? (pos.dir === 1 ? 'long' : 'short') : 'flat',
      size: pos?.size ?? 0, stop: pos?.stopTrigger ?? null, tp1: pos && pos.tp1Oid != null && !pos.tp1Filled ? pos.tp : null,
    })
  }

  /**
   * Ordres ouverts à la clôture : un ordre étranger arrête tout ; les ordres du bot que l'état ne
   * suit pas sont annulés ; un stop ou un TP1 disparu sans avoir été exécuté sera reposé.
   */
  private async checkOrders(): Promise<boolean> {
    const orders = await this.ex.openOrders()
    const foreign = orders.filter(o => cloidKind(o.cloid) == null)
    if (foreign.length) {
      this.halt(`${foreign.length} ordre(s) ouvert(s) sur ${this.o.cfg.coin} qui ne viennent pas du bot`)
      return false
    }
    await this.cancelOrphans(orders)
    const pos = this.state.position
    if (!pos) return true
    const open = new Set(orders.map(o => o.oid))
    const gone = async (oid: number | null, cloid: string | null | undefined): Promise<boolean> => {
      if (oid == null || open.has(oid)) return false
      // Exécuté mais pas encore dans les fills : on attend la prochaine lecture, rien n'est reposé.
      const st = cloid ? await this.ex.orderStatus(cloid).catch(() => null) : null
      return !(st && (st.status === 'filled' || st.status === 'triggered'))
    }
    if (await gone(pos.stopOid, pos.stopCloid)) {
      this.journal.event('stop_missing', { oid: pos.stopOid, trigger: pos.stopTrigger })
      pos.stopOid = null
      pos.stopCloid = null
    }
    if (!pos.tp1Filled && (await gone(pos.tp1Oid, pos.tp1Cloid))) {
      this.journal.event('tp1_missing', { oid: pos.tp1Oid, px: pos.tp })
      pos.tp1Oid = null
      pos.tp1Cloid = null
    }
    if (pos.emergencyOid != null && !open.has(pos.emergencyOid)) pos.emergencyOid = null
    return true
  }

  /** Exécution de la décision, dans l'ordre du broker simulé. */
  private async execute(d: Decision, i: number, bar: Bar): Promise<void> {
    let pos = this.state.position
    let placedNow = false
    if (pos && d.exits) {
      pos.stop = d.exits.stop
      pos.tp = d.exits.tp
      pos.trailDist = d.exits.trailDist
      pos.useTP1 = d.exits.useTP1
      pos.tp1QtyPct = d.exits.tp1QtyPct
      if (!pos.exitsActive) { pos.exitsActive = true; placedNow = true }
    }
    if (pos && d.close) await this.closePosition(d.close, bar.c)
    pos = this.state.position
    if (pos && !d.long && !d.short) await this.placeExits(pos, bar.c, placedNow)
    if (d.long) await this.enter(d.long, i, bar)
    if (d.short) await this.enter(d.short, i, bar)
  }

  private sideOut(pos: LivePosition): Side {
    return pos.dir === 1 ? 'sell' : 'buy'
  }

  /** Stop effectif : le stop du script, ou le stop suiveur s'il est plus serré. */
  private effStop(pos: LivePosition): number {
    if (!pos.trailActive) return pos.stop
    const t = pos.best - pos.dir * pos.trailDist
    return pos.dir === 1 ? Math.max(pos.stop, t) : Math.min(pos.stop, t)
  }

  private trail(pos: LivePosition, px: number): void {
    const act = pos.avg + pos.dir * pos.trailDist
    if (!pos.trailActive && (pos.dir === 1 ? px >= act : px <= act)) { pos.trailActive = true; pos.best = px }
    if (pos.trailActive) pos.best = pos.dir === 1 ? Math.max(pos.best, px) : Math.min(pos.best, px)
  }

  /** Ordres de sortie du script : stop (et TP1), posés à la clôture qui suit l'entrée. */
  private async placeExits(pos: LivePosition, close: number, placedNow: boolean): Promise<void> {
    if (placedNow) {
      // Comme le broker simulé : les ordres tout juste posés sont testés au prix de clôture.
      if (pos.dir === 1 ? close <= pos.stop : close >= pos.stop) {
        pos.stopTrigger = pos.stop
        return this.closePosition('SL', close)
      }
      this.trail(pos, close)
    }
    await this.refreshStop(true)
    if (!this.state.position || this.state.halted) return
    if (pos.emergencyOid != null && pos.stopOid != null) {
      // Le stop du script est posé : le stop de sécurité n'a plus lieu d'être.
      await this.ex.cancel([pos.emergencyOid])
      pos.emergencyOid = null
    }
    if (pos.useTP1 && !pos.tp1Filled && pos.tp1Oid == null) {
      const sz = this.risk.tp1Size(pos.size, pos.tp1QtyPct, pos.tp)
      if (sz > 0) {
        const side = this.sideOut(pos)
        const r = await this.place('tp1', side, sz, c => this.ex.limit(side, sz, pos.tp, true, c))
        if (r.status === 'error' || r.oid == null) return this.halt(`TP1 refusé : ${r.error}`)
        pos.tp1Oid = r.oid
        pos.tp1Cloid = r.cloid
        pos.oids.push(r.oid)
        pos.cloids.push(r.cloid)
        // Exécuté tout de suite (prix déjà au-delà) : la taille est mise à jour par son fill.
        if (r.status === 'filled') await this.applyFills()
      }
    }
  }

  /**
   * Pose ou déplace le stop au niveau effectif (le stop suiveur ne recule jamais). Entre deux
   * clôtures, le déplacement attend un pas minimal et un intervalle minimal (nombre d'ordres).
   */
  private async refreshStop(force: boolean): Promise<void> {
    const pos = this.state.position
    if (!pos || !pos.exitsActive) return
    const want = this.effStop(pos)
    if (pos.stopOid == null) {
      if (await this.setStop(pos, want)) return
      await this.closePosition('SL', want)
      return this.halt(`stop refusé par l'exchange : position fermée au marché`)
    }
    const gain = pos.stopTrigger == null ? Infinity : pos.dir === 1 ? want - pos.stopTrigger : pos.stopTrigger - want
    const tick = this.ex.asset.tick
    const minStep = force ? tick : Math.max(tick, (this.o.cfg.trailStepPct / 100) * pos.trailDist)
    if (!(gain >= minStep - 1e-9)) return
    if (!force && this.now() - this.lastMove < this.o.cfg.trailMinIntervalMs) return
    this.lastMove = this.now()
    await this.setStop(pos, want)
  }

  /**
   * Stop posé, déplacé ou retaillé : le nouveau est posé avant que l'ancien soit annulé, la position
   * n'est jamais sans stop ; en réduction seule, deux stops ne peuvent pas fermer plus qu'elle.
   * Renvoie false si l'exchange refuse le nouveau stop (l'ancien reste en place).
   */
  private async setStop(pos: LivePosition, trigger: number): Promise<boolean> {
    const side = this.sideOut(pos)
    const old = pos.stopOid
    const sz = pos.size
    const r = await this.place('stop', side, sz, c => this.ex.stop(side, sz, trigger, this.o.cfg.stopSlippagePct, c))
    if (r.status === 'error' || r.oid == null) {
      this.journal.event(old == null ? 'stop_rejected' : 'stop_move_failed', { error: r.error, trigger })
      return false
    }
    pos.stopOid = r.oid
    pos.stopCloid = r.cloid
    pos.stopTrigger = trigger
    pos.stopSz = sz
    pos.oids.push(r.oid)
    pos.cloids.push(r.cloid)
    this.journal.event(old == null ? 'stop_placed' : 'stop_moved', { trigger, size: sz, oid: r.oid })
    let oldFilled = false
    if (old != null) {
      const [c] = await this.ex.cancel([old])
      // Annulation refusée : l'ancien stop vient sans doute d'être exécuté ; les fills le diront.
      if (!c?.ok) { oldFilled = true; this.journal.event('stop_cancel_failed', { oid: old, error: c?.error }) }
    }
    if (r.status === 'filled' || oldFilled) await this.applyFills()
    return true
  }

  /** Fermeture au marché à la clôture (VWAP, flip, retournement, stop déjà franchi). */
  private async closePosition(tag: string, ref: number): Promise<void> {
    const pos = this.state.position!
    const resting = [pos.stopOid, pos.tp1Oid, pos.emergencyOid].filter((x): x is number => x != null)
    const canceled = resting.length ? await this.ex.cancel(resting) : []
    pos.stopOid = pos.tp1Oid = pos.emergencyOid = null
    if (canceled.some(c => !c.ok)) {
      // Un ordre de sortie a pu s'exécuter entre-temps : la position est relue avant de fermer.
      this.journal.event('cancel_failed', { results: canceled })
      await this.applyFills()
      if (this.state.position !== pos) return
    }
    const side = this.sideOut(pos)
    const q = await this.ex.quote()
    pos.spreadExitBps = spreadBps(q)
    const sz = pos.size
    const r = await this.place('close', side, sz, c => this.ex.market(side, sz, true, side === 'buy' ? q.ask : q.bid, this.o.cfg.maxSlippagePct, c))
    if (r.oid != null) pos.oids.push(r.oid)
    pos.cloids.push(r.cloid)
    if (r.status !== 'filled' || r.filledSz + this.lotEps() < sz) {
      return this.halt(`fermeture ${tag} incomplète : ${r.status} ${r.filledSz}/${sz} ${r.error ?? ''}`)
    }
    pos.slippage += pos.dir * (ref - (r.avgPx ?? ref)) * r.filledSz
    this.exitFill(pos, r.avgPx ?? ref, r.filledSz, tag)
    this.journal.event('exit', { tag, side, size: r.filledSz, avg: r.avgPx, ref, spreadBps: pos.spreadExitBps })
    await this.applyFills()
    if (this.state.position === pos) await this.finalize()
  }

  /** Entrée au marché à la clôture ; une position opposée est d'abord fermée (retournement). */
  private async enter(order: EntryOrder, i: number, bar: Bar): Promise<void> {
    const pos = this.state.position
    if (pos && pos.dir !== order.dir) await this.closePosition('REV', bar.c)
    if (this.state.position || this.state.halted) return
    const blocked = this.risk.entryBlocked(this.state.halted)
    const sideName = order.dir === 1 ? 'long' : 'short'
    if (blocked) return this.journal.event('entry_blocked', { reason: blocked, side: sideName })
    // Spread trop large : quelques secondes d'attente, puis l'entrée est abandonnée.
    let q = await this.ex.quote()
    for (let k = 0; spreadBps(q) > this.o.cfg.maxSpreadBps && k < 5; k++) {
      await this.sleep(2000)
      q = await this.ex.quote()
    }
    const spread = spreadBps(q)
    if (spread > this.o.cfg.maxSpreadBps) return this.journal.event('entry_skipped', { reason: `spread ${spread.toFixed(2)} pb > ${this.o.cfg.maxSpreadBps} pb`, side: sideName, bid: q.bid, ask: q.ask })
    const acct = await this.ex.account()
    const size = this.risk.entrySize(acct.equity, midOf(q))
    if (!size.ok) return this.journal.event('entry_skipped', { reason: size.reason, side: sideName })
    const side: Side = order.dir === 1 ? 'buy' : 'sell'
    const r = await this.place('entry', side, size.size, c => this.ex.market(side, size.size, false, side === 'buy' ? q.ask : q.bid, this.o.cfg.maxSlippagePct, c))
    if (r.status !== 'filled' || r.filledSz <= 0 || r.oid == null) return this.journal.event('entry_failed', { status: r.status, error: r.error, side: sideName })
    const after = await this.ex.account()
    if (Math.sign(after.position.size) !== order.dir) return this.halt(`entrée exécutée mais position ${after.position.size}`)
    const ctx = this.runner.context(i)
    const s = ctx.sets[order.set]
    const avg = after.position.entryPx
    const filled = Math.abs(after.position.size)
    this.state.position = {
      dir: order.dir, size: filled, avg, set: order.set, tag: order.tag, entryBar: bar.t, refEntry: bar.c,
      atrAtEntry: this.runner.strategy.prs[order.set].atr[i], context: { regime: ctx.regime, z: s.z, volZ: s.volZ, lamPct: s.lamPct },
      exitsActive: false, stop: NaN, tp: NaN, trailDist: NaN, useTP1: false, tp1QtyPct: 0, tp1Filled: false, trailActive: false, best: NaN,
      stopTrigger: null, stopSz: 0, stopOid: null, stopCloid: null, tp1Oid: null, tp1Cloid: null, emergencyOid: null, oids: [r.oid], cloids: [r.cloid],
      hi: avg, lo: avg, fees: 0, funding: 0, closedPnl: 0, slippage: order.dir * (avg - bar.c) * filled, exitValue: 0, exitQty: 0, exits: [],
      spreadEntryBps: spread,
    }
    this.journal.event('entry', { side, size: filled, avg, ref: bar.c, bid: q.bid, ask: q.ask, spreadBps: spread, set: SET_NAMES[order.set], tag: order.tag, notional: filled * avg })
    const em = this.o.cfg.emergencyStopPct
    if (em != null) {
      const p = this.state.position
      const trig = avg * (1 - order.dir * em / 100)
      const out = this.sideOut(p)
      const er = await this.place('emergency', out, filled, c => this.ex.stop(out, filled, trig, this.o.cfg.stopSlippagePct, c))
      if (er.oid != null) { p.emergencyOid = er.oid; p.oids.push(er.oid); p.cloids.push(er.cloid) } else this.journal.event('emergency_stop_rejected', { error: er.error })
    }
    await this.applyFills()
  }
}
