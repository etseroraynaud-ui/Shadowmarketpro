// Exchange en mémoire qui exécute comme le broker simulé du backtest : ordres au marché au prix
// courant, stops et limites déclenchés quand le prix les franchit (au niveau de l'ordre, ou au
// prix d'ouverture en cas de gap), ordres de réduction seule, frais en % de la valeur.
//
// Pannes simulables (`faults`) : réponse perdue après exécution (l'ordre est passé, le bot reçoit
// une erreur incertaine), ou requête perdue avant l'exchange (l'ordre n'existe pas).

import type { Quote } from '../src/data/quotes.ts'
import type { AccountState, AssetInfo, CancelResult, Exchange, Fill, FundingEvent, OpenOrder, OrderResult, OrderStatus, Side } from '../src/exec/exchange.ts'
import { cloidKind } from '../src/exec/exchange.ts'

/**
 * lost-response : l'ordre est exécuté, la réponse se perd (erreur incertaine) ;
 * lost-request : la requête n'arrive pas (rien n'est fait, erreur incertaine) ;
 * crash : l'ordre est exécuté, puis le processus du bot s'arrête net (exception).
 * skip : nombre d'ordres de ce type laissés passer avant la panne.
 */
export type Fault = { kind: 'entry' | 'close' | 'stop' | 'tp1' | 'emergency'; mode: 'lost-response' | 'lost-request' | 'crash'; skip?: number }

export class Crash extends Error {}

interface Resting {
  oid: number
  cloid: string
  side: Side
  sz: number
  px: number
  trigger: number | null
  reduceOnly: boolean
}

export class FakeExchange implements Exchange {
  readonly asset: AssetInfo = { index: 0, szDecimals: 5, maxLeverage: 40, tick: 1, dex: '', isCross: true }
  price = NaN
  time = 0
  cash: number
  readonly feeRate: number
  pos = { size: 0, entryPx: 0 }
  orders: Resting[] = []
  readonly log: Fill[] = []
  readonly calls: string[] = []
  /** Spread autour du prix courant (0 : achat et vente au prix courant, comme le backtest). */
  spread = 0
  /** Pannes à produire, dans l'ordre, sur les prochains ordres du type indiqué. */
  faults: Fault[] = []
  /** Ordres reçus par l'exchange, par cloid (pour compter les doublons). */
  readonly received: { cloid: string; kind: string | null; side: Side; sz: number }[] = []
  private readonly status = new Map<string, OrderStatus>()
  private oid = 1
  private tid = 1

  constructor(cash: number, feePct: number) {
    this.cash = cash
    this.feeRate = feePct / 100
  }

  private exec(side: Side, sz: number, px: number, oid: number, cloid: string): Fill {
    const signed = side === 'buy' ? sz : -sz
    const start = this.pos.size
    let closedPnl = 0
    if (start === 0 || Math.sign(start) === Math.sign(signed)) {
      const n = Math.abs(start) + sz
      this.pos.entryPx = (Math.abs(start) * this.pos.entryPx + sz * px) / n
    } else {
      const q = Math.min(sz, Math.abs(start))
      closedPnl = Math.sign(start) * (px - this.pos.entryPx) * q
      this.cash += closedPnl
      if (sz > Math.abs(start)) this.pos.entryPx = px
    }
    this.pos.size = +(start + signed).toFixed(10)
    if (this.pos.size === 0) this.pos.entryPx = 0
    const fee = px * sz * this.feeRate
    this.cash -= fee
    const f: Fill = { time: this.time, oid, cloid, px, sz, side, fee, closedPnl, startPosition: start, tid: this.tid++, liquidation: false }
    this.log.push(f)
    return f
  }

  /** Taille réduisant la position, pour un ordre de réduction seule (0 = rien à réduire). */
  private reducible(side: Side, sz: number): number {
    const s = this.pos.size
    if (s === 0 || (side === 'sell') !== (s > 0)) return 0
    return Math.min(sz, Math.abs(s))
  }

  /** Déplacement du prix : déclenche les ordres posés qu'il franchit. */
  moveTo(p: number, gap = false): void {
    this.price = p
    for (const o of [...this.orders]) {
      const hit = o.trigger != null
        ? (o.side === 'sell' ? p <= o.trigger : p >= o.trigger)
        : (o.side === 'sell' ? p >= o.px : p <= o.px)
      if (!hit) continue
      this.orders = this.orders.filter(x => x !== o)
      const sz = o.reduceOnly ? this.reducible(o.side, o.sz) : o.sz
      if (sz <= 0) {
        this.setStatus(o.cloid, 'canceled', o.oid, o.trigger, o.sz)
        continue
      }
      const level = o.trigger ?? o.px
      this.exec(o.side, sz, gap ? p : level, o.oid, o.cloid)
      this.setStatus(o.cloid, 'filled', o.oid, o.trigger, sz)
    }
  }

  async account(): Promise<AccountState> {
    const upnl = this.pos.size * (this.price - this.pos.entryPx)
    return { equity: this.cash + (this.pos.size ? upnl : 0), position: { size: this.pos.size, entryPx: this.pos.entryPx, liquidationPx: null }, time: this.time }
  }

  async openOrders(): Promise<OpenOrder[]> {
    return this.orders.map(o => ({ oid: o.oid, cloid: o.cloid, side: o.side, sz: o.sz, limitPx: o.px, triggerPx: o.trigger, isTrigger: o.trigger != null, reduceOnly: o.reduceOnly }))
  }

  async fills(since: number): Promise<Fill[]> {
    return this.log.filter(f => f.time >= since).map(f => ({ ...f }))
  }

  async funding(_since: number): Promise<FundingEvent[]> {
    return []
  }

  async quote(): Promise<Quote> {
    return { bid: this.price - this.spread / 2, ask: this.price + this.spread / 2, bidSz: 1, askSz: 1, time: this.time, recv: this.time, source: 'paper' }
  }

  async orderStatus(cloid: string): Promise<OrderStatus> {
    return this.status.get(cloid) ?? { status: 'unknown', oid: null, triggerPx: null, sz: null, detail: 'unknownOid' }
  }

  private setStatus(cloid: string, status: OrderStatus['status'], oid: number, trigger: number | null, sz: number): void {
    this.status.set(cloid, { status, oid, triggerPx: trigger, sz, detail: status })
  }

  /** Panne prévue pour cet ordre : 'lost-request' = rien n'est fait ; 'lost-response' = exécuté puis réponse perdue. */
  private fault(cloid: string): Fault['mode'] | null {
    const k = cloidKind(cloid)
    const i = this.faults.findIndex(f => f.kind === k)
    if (i < 0) return null
    const f = this.faults[i]
    if (f.skip) {
      f.skip--
      return null
    }
    return this.faults.splice(i, 1)[0].mode
  }

  private lost(mode: Fault['mode'] | null = 'lost-response'): OrderResult {
    if (mode === 'crash') throw new Crash('arrêt brutal du bot juste après l\'envoi')
    return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: 'timeout', uncertain: true }
  }

  async setLeverage(x: number): Promise<void> {
    this.calls.push(`leverage ${x}`)
  }

  async market(side: Side, sz: number, reduceOnly: boolean, _ref: number, _slip: number, cloid: string): Promise<OrderResult> {
    const fault = this.fault(cloid)
    if (fault === 'lost-request') return this.lost()
    this.calls.push(`market ${side} ${sz}${reduceOnly ? ' reduce' : ''}`)
    this.received.push({ cloid, kind: cloidKind(cloid), side, sz })
    const q = reduceOnly ? this.reducible(side, sz) : sz
    const oid = this.oid++
    if (q <= 0) {
      this.setStatus(cloid, 'rejected', oid, null, sz)
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: 'reduce only' }
    }
    const px = side === 'buy' ? this.price + this.spread / 2 : this.price - this.spread / 2
    this.exec(side, q, px, oid, cloid)
    this.setStatus(cloid, 'filled', oid, null, q)
    if (fault === 'lost-response' || fault === 'crash') return this.lost(fault)
    return { status: 'filled', oid, filledSz: q, avgPx: px }
  }

  async stop(side: Side, sz: number, trigger: number, _slip: number, cloid: string): Promise<OrderResult> {
    const fault = this.fault(cloid)
    if (fault === 'lost-request') return this.lost()
    this.calls.push(`stop ${side} ${sz} @${trigger}`)
    this.received.push({ cloid, kind: cloidKind(cloid), side, sz })
    const oid = this.oid++
    if (side === 'sell' ? this.price <= trigger : this.price >= trigger) {
      const q = this.reducible(side, sz)
      if (q > 0) this.exec(side, q, this.price, oid, cloid)
      this.setStatus(cloid, q > 0 ? 'filled' : 'canceled', oid, trigger, sz)
      if (fault === 'lost-response' || fault === 'crash') return this.lost(fault)
      return { status: 'filled', oid, filledSz: q, avgPx: this.price }
    }
    this.orders.push({ oid, cloid, side, sz, px: trigger, trigger, reduceOnly: true })
    this.setStatus(cloid, 'open', oid, trigger, sz)
    if (fault === 'lost-response' || fault === 'crash') return this.lost(fault)
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult> {
    const fault = this.fault(cloid)
    if (fault === 'lost-request') return this.lost()
    this.calls.push(`limit ${side} ${sz} @${px}`)
    this.received.push({ cloid, kind: cloidKind(cloid), side, sz })
    const oid = this.oid++
    if (side === 'sell' ? this.price >= px : this.price <= px) {
      const q = reduceOnly ? this.reducible(side, sz) : sz
      if (q > 0) this.exec(side, q, this.price, oid, cloid)
      this.setStatus(cloid, q > 0 ? 'filled' : 'canceled', oid, null, sz)
      if (fault === 'lost-response' || fault === 'crash') return this.lost(fault)
      return { status: 'filled', oid, filledSz: q, avgPx: this.price }
    }
    this.orders.push({ oid, cloid, side, sz, px, trigger: null, reduceOnly })
    this.setStatus(cloid, 'open', oid, null, sz)
    if (fault === 'lost-response' || fault === 'crash') return this.lost(fault)
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async cancel(oids: number[]): Promise<CancelResult[]> {
    this.calls.push(`cancel ${oids.join(' ')}`)
    return oids.map(oid => {
      const o = this.orders.find(x => x.oid === oid)
      if (!o) return { oid, ok: false, error: 'Order was never placed, already canceled, or filled.' }
      this.orders = this.orders.filter(x => x !== o)
      this.setStatus(o.cloid, 'canceled', oid, o.trigger, o.sz)
      return { oid, ok: true }
    })
  }

  /** Ordres posés du bot, par type. */
  resting(kind: string): Resting[] {
    return this.orders.filter(o => cloidKind(o.cloid) === kind)
  }
}
