// Exchange papier du shadow mode : le moteur live complet (ExecutionEngine, RiskEngine, stops,
// TP1, stop suiveur, identifiants d'ordre) tourne sur les prix réels de Hyperliquid, sans qu'aucun
// ordre ne quitte la machine.
//
// Exécution simulée à partir du BBO réel (WebSocket, ou REST s'il est trop ancien) :
// - ordre au marché : achat au meilleur vendeur, vente au meilleur acheteur ; refusé s'il dépasse
//   l'écart maximal (comme l'IOC limité du bot) ; frais taker ;
// - stop : déclenché quand le prix moyen franchit le niveau, exécuté au marché ; frais taker ;
// - limite posée (TP1) : exécutée à son prix quand le meilleur prix d'en face l'atteint ; frais maker ;
// - réduction seule respectée ; pas de financement (inconnu à l'avance, compté seulement en réel).
// La profondeur du carnet n'est pas simulée : les tailles du bot sont petites devant le BBO.

import type { Quote } from '../data/quotes.ts'
import { QuoteBook, midOf } from '../data/quotes.ts'
import type { AccountState, AssetInfo, CancelResult, Exchange, Fill, FundingEvent, OpenOrder, OrderResult, OrderStatus, Side } from './exchange.ts'

interface Resting {
  oid: number
  cloid: string
  side: Side
  sz: number
  px: number
  trigger: number | null
  reduceOnly: boolean
}

export interface PaperOptions {
  asset: AssetInfo
  capital: number
  takerFeePct: number
  makerFeePct: number
  /** BBO de secours quand celui du flux est trop ancien (REST). */
  fallbackQuote: () => Promise<Quote>
  quoteMaxAgeMs?: number
  now?: () => number
  /** Appelé à chaque exécution d'un ordre posé (stop, limite), pour une lecture immédiate des fills. */
  onFill?: (f: Fill) => void
}

export class PaperExchange implements Exchange {
  readonly asset: AssetInfo
  readonly quotes = new QuoteBook()
  readonly o: PaperOptions
  cash: number
  pos = { size: 0, entryPx: 0 }
  orders: Resting[] = []
  readonly log: Fill[] = []
  private readonly status = new Map<string, OrderStatus>()
  private oid = 1
  private tid = 1

  constructor(o: PaperOptions) {
    this.o = o
    this.asset = o.asset
    this.cash = o.capital
  }

  private now(): number {
    return this.o.now ? this.o.now() : Date.now()
  }

  private round(x: number): number {
    return +x.toFixed(this.asset.szDecimals + 4)
  }

  private exec(side: Side, sz: number, px: number, oid: number, cloid: string, maker: boolean): Fill {
    const signed = side === 'buy' ? sz : -sz
    const start = this.pos.size
    let closedPnl = 0
    if (start === 0 || Math.sign(start) === Math.sign(signed)) {
      this.pos.entryPx = (Math.abs(start) * this.pos.entryPx + sz * px) / (Math.abs(start) + sz)
    } else {
      const q = Math.min(sz, Math.abs(start))
      closedPnl = Math.sign(start) * (px - this.pos.entryPx) * q
      if (sz > Math.abs(start)) this.pos.entryPx = px
    }
    this.pos.size = this.round(start + signed)
    if (this.pos.size === 0) this.pos.entryPx = 0
    const fee = px * sz * ((maker ? this.o.makerFeePct : this.o.takerFeePct) / 100)
    this.cash += closedPnl - fee
    const f: Fill = { time: this.now(), oid, cloid, px, sz, side, fee, closedPnl, startPosition: start, tid: this.tid++, liquidation: false }
    this.log.push(f)
    return f
  }

  /** Taille qui réduit la position (0 = rien à réduire). */
  private reducible(side: Side, sz: number): number {
    const s = this.pos.size
    if (s === 0 || (side === 'sell') !== (s > 0)) return 0
    return Math.min(sz, Math.abs(s))
  }

  private setStatus(cloid: string, status: OrderStatus['status'], oid: number, o: Partial<Resting> = {}): void {
    this.status.set(cloid, { status, oid, triggerPx: o.trigger ?? null, sz: o.sz ?? null, detail: status })
  }

  /** Nouveau BBO réel : déclenche les ordres posés qu'il franchit. Renvoie les fills produits. */
  onQuote(q: Quote): Fill[] {
    if (!this.quotes.update(q)) return []
    return this.trigger(q)
  }

  /** Ordres posés franchis par ce BBO : exécutés. */
  private trigger(q: Quote): Fill[] {
    const out: Fill[] = []
    const mid = midOf(q)
    for (const o of [...this.orders]) {
      const hit = o.trigger != null
        ? (o.side === 'sell' ? mid <= o.trigger : mid >= o.trigger)
        : (o.side === 'sell' ? q.bid >= o.px : q.ask <= o.px)
      if (!hit) continue
      this.orders = this.orders.filter(x => x !== o)
      const sz = o.reduceOnly ? this.reducible(o.side, o.sz) : o.sz
      if (sz <= 0) {
        this.setStatus(o.cloid, 'canceled', o.oid, o)
        continue
      }
      // Stop : exécution au marché (prix d'en face) ; limite : à son prix.
      const px = o.trigger != null ? (o.side === 'sell' ? q.bid : q.ask) : o.px
      const f = this.exec(o.side, sz, px, o.oid, o.cloid, o.trigger == null)
      this.setStatus(o.cloid, 'filled', o.oid, o)
      out.push(f)
    }
    for (const f of out) this.o.onFill?.(f)
    return out
  }

  async quote(): Promise<Quote> {
    const fresh = this.quotes.fresh(this.now(), this.o.quoteMaxAgeMs ?? 2000)
    if (fresh) return fresh
    const q = await this.o.fallbackQuote()
    this.onQuote(q)
    return this.quotes.last ?? q
  }

  async account(): Promise<AccountState> {
    const q = this.quotes.last
    const upnl = this.pos.size && q ? this.pos.size * (midOf(q) - this.pos.entryPx) : 0
    return { equity: this.cash + upnl, position: { size: this.pos.size, entryPx: this.pos.entryPx, liquidationPx: null }, time: this.now() }
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

  async setLeverage(_x: number): Promise<void> {}

  async orderStatus(cloid: string): Promise<OrderStatus> {
    return this.status.get(cloid) ?? { status: 'unknown', oid: null, triggerPx: null, sz: null, detail: 'unknownOid' }
  }

  async market(side: Side, sz: number, reduceOnly: boolean, refPx: number, maxSlippagePct: number, cloid: string): Promise<OrderResult> {
    const q = await this.quote()
    const oid = this.oid++
    const px = side === 'buy' ? q.ask : q.bid
    const limit = side === 'buy' ? refPx * (1 + maxSlippagePct / 100) : refPx * (1 - maxSlippagePct / 100)
    if (side === 'buy' ? px > limit : px < limit) {
      this.setStatus(cloid, 'rejected', oid)
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: `IOC : prix ${px} au-delà de la limite ${limit}` }
    }
    const qty = reduceOnly ? this.reducible(side, sz) : sz
    if (qty <= 0) {
      this.setStatus(cloid, 'rejected', oid)
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: 'réduction seule : aucune position à réduire' }
    }
    this.exec(side, qty, px, oid, cloid, false)
    this.setStatus(cloid, 'filled', oid, { sz: qty })
    return { status: 'filled', oid, filledSz: qty, avgPx: px }
  }

  async stop(side: Side, sz: number, trigger: number, _slip: number, cloid: string): Promise<OrderResult> {
    const q = await this.quote()
    const oid = this.oid++
    const r: Resting = { oid, cloid, side, sz, px: trigger, trigger, reduceOnly: true }
    this.orders.push(r)
    this.setStatus(cloid, 'open', oid, r)
    // Niveau déjà franchi : déclenché tout de suite.
    const f = this.trigger(q).find(x => x.oid === oid)
    return f ? { status: 'filled', oid, filledSz: f.sz, avgPx: f.px } : { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult> {
    const q = await this.quote()
    const oid = this.oid++
    // Limite qui croise le carnet : exécutée tout de suite au prix d'en face (taker).
    if (side === 'sell' ? q.bid >= px : q.ask <= px) {
      const qty = reduceOnly ? this.reducible(side, sz) : sz
      if (qty <= 0) {
        this.setStatus(cloid, 'rejected', oid)
        return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: 'réduction seule : aucune position à réduire' }
      }
      const fpx = side === 'sell' ? q.bid : q.ask
      this.exec(side, qty, fpx, oid, cloid, false)
      this.setStatus(cloid, 'filled', oid, { sz: qty })
      return { status: 'filled', oid, filledSz: qty, avgPx: fpx }
    }
    const r: Resting = { oid, cloid, side, sz, px, trigger: null, reduceOnly }
    this.orders.push(r)
    this.setStatus(cloid, 'open', oid, r)
    return { status: 'resting', oid, filledSz: 0, avgPx: null }
  }

  async cancel(oids: number[]): Promise<CancelResult[]> {
    return oids.map(oid => {
      const o = this.orders.find(x => x.oid === oid)
      if (!o) return { oid, ok: false, error: 'Order was never placed, already canceled, or filled.' }
      this.orders = this.orders.filter(x => x !== o)
      this.setStatus(o.cloid, 'canceled', oid, o)
      return { oid, ok: true }
    })
  }
}
