// Exchange en mémoire qui exécute comme le broker simulé du backtest : ordres au marché au prix
// courant, stops et limites déclenchés quand le prix les franchit (au niveau de l'ordre, ou au
// prix d'ouverture en cas de gap), ordres de réduction seule, frais en % de la valeur.

import type { AccountState, AssetInfo, Exchange, Fill, FundingEvent, OpenOrder, OrderResult, Side } from '../src/exec/exchange.ts'

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
      if (sz <= 0) continue
      const level = o.trigger ?? o.px
      this.exec(o.side, sz, gap ? p : level, o.oid, o.cloid)
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

  async mid(): Promise<number> {
    return this.price
  }

  async setLeverage(x: number): Promise<void> {
    this.calls.push(`leverage ${x}`)
  }

  async market(side: Side, sz: number, reduceOnly: boolean, _ref: number, _slip: number, cloid: string): Promise<OrderResult> {
    this.calls.push(`market ${side} ${sz}${reduceOnly ? ' reduce' : ''}`)
    const q = reduceOnly ? this.reducible(side, sz) : sz
    const oid = this.oid++
    if (q <= 0) return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: 'reduce only' }
    this.exec(side, q, this.price, oid, cloid)
    return { status: 'filled', oid, filledSz: q, avgPx: this.price }
  }

  async stop(side: Side, sz: number, trigger: number, _slip: number, cloid: string): Promise<OrderResult> {
    this.calls.push(`stop ${side} ${sz} @${trigger}`)
    const oid = this.oid++
    if (side === 'sell' ? this.price <= trigger : this.price >= trigger) {
      const q = this.reducible(side, sz)
      if (q > 0) this.exec(side, q, this.price, oid, cloid)
      return { status: 'filled', oid, filledSz: q, avgPx: this.price }
    }
    this.orders.push({ oid, cloid, side, sz, px: trigger, trigger, reduceOnly: true })
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult> {
    this.calls.push(`limit ${side} ${sz} @${px}`)
    const oid = this.oid++
    if (side === 'sell' ? this.price >= px : this.price <= px) {
      const q = reduceOnly ? this.reducible(side, sz) : sz
      if (q > 0) this.exec(side, q, this.price, oid, cloid)
      return { status: 'filled', oid, filledSz: q, avgPx: this.price }
    }
    this.orders.push({ oid, cloid, side, sz, px, trigger: null, reduceOnly })
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async modifyStop(oid: number, side: Side, sz: number, trigger: number, _slip: number, cloid: string): Promise<OrderResult> {
    this.calls.push(`modify ${oid} ${sz} @${trigger}`)
    const o = this.orders.find(x => x.oid === oid)
    if (!o) return { status: 'error', oid, filledSz: 0, avgPx: null, error: 'order not found' }
    Object.assign(o, { side, sz, trigger, px: trigger, cloid })
    if (side === 'sell' ? this.price <= trigger : this.price >= trigger) this.moveTo(this.price)
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async cancel(oids: number[]): Promise<void> {
    this.calls.push(`cancel ${oids.join(' ')}`)
    this.orders = this.orders.filter(o => !oids.includes(o.oid))
  }
}
