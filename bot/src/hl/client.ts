// Connecteur Hyperliquid (API officielle, via le SDK TypeScript @nktkas/hyperliquid) :
// - données : bougies et carnet (REST), flux temps réel (WebSocket : bougie en cours, BBO,
//   événements du compte), reconnexion et réabonnement automatiques du SDK, surveillés ici ;
// - exécution : ordres, stops, annulations, positions, ordres ouverts, fills, financement, statut
//   d'un ordre par son identifiant client.
//
// Les ordres sont signés par un wallet agent dédié au bot (clé en variable d'environnement),
// approuvé sur le compte HL_ACCOUNT_ADDRESS. L'agent ne peut pas retirer de fonds. Avec un
// sous-compte (HL_SUBACCOUNT_ADDRESS), chaque ordre porte son adresse (« vaultAddress ») : le même
// agent trade alors le sous-compte, et positions, ordres et fills sont lus sur le sous-compte.
// Une signature testnet n'est pas valable sur le mainnet (le réseau fait partie de ce qui est signé).

import { ExchangeClient, HttpTransport, InfoClient, SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid'
import { ApiRequestError } from '@nktkas/hyperliquid/api/exchange'
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils'
import { privateKeyToAccount } from 'viem/accounts'
import type { Bar } from '../../../lib/strategies/shock/live.ts'
import { dexOf, tickOf } from '../../../lib/hyperliquid/market.ts'
import type { CandleApi, Interval } from '../data/candles.ts'
import type { Quote } from '../data/quotes.ts'
import { QuoteBook } from '../data/quotes.ts'
import type { AccountState, AssetInfo, CancelResult, Exchange, Fill, FundingEvent, OpenOrder, OrderResult, OrderStatus, Side } from '../exec/exchange.ts'

export { dexOf, tickOf }

export interface HlOptions {
  testnet: boolean
  coin: string
}

/** Données publiques : bougies, carnet, métadonnées de l'actif ; statut d'un ordre (lecture seule). */
export class HyperliquidData implements CandleApi {
  readonly info: InfoClient
  readonly transport: HttpTransport
  readonly testnet: boolean

  constructor(testnet: boolean) {
    this.testnet = testnet
    this.transport = new HttpTransport({ isTestnet: testnet, timeout: 15000 })
    this.info = new InfoClient({ transport: this.transport })
  }

  async candles(coin: string, interval: Interval, startTime: number, endTime: number): Promise<Bar[]> {
    const rows = await this.info.candleSnapshot({ coin, interval, startTime, endTime })
    return rows.map(r => ({ t: r.t, o: Number(r.o), h: Number(r.h), l: Number(r.l), c: Number(r.c), v: Number(r.v) }))
  }

  async assetInfo(coin: string): Promise<AssetInfo> {
    const dex = dexOf(coin)
    const meta = await this.info.meta({ dex })
    const u = meta.universe.find(x => x.name === coin)
    if (!u) throw new Error(`${coin} absent de l'univers perp${dex ? ` du dex ${dex}` : ''}`)
    if (u.isDelisted) throw new Error(`${coin} est délisté`)
    // Identifiant d'ordre : indice dans l'univers, ou 100000 + 10000 × rang du dex + indice (HIP-3).
    const conv = await SymbolConverter.create({ transport: this.transport, dexs: dex ? [dex] : false })
    const index = conv.getAssetId(coin)
    if (index == null) throw new Error(`identifiant d'actif de ${coin} introuvable`)
    const mid = await this.mid(coin)
    return { index, szDecimals: u.szDecimals, maxLeverage: u.maxLeverage, tick: tickOf(mid, u.szDecimals), dex, isCross: !u.onlyIsolated && !u.marginMode }
  }

  async mid(coin: string): Promise<number> {
    const m = Number((await this.info.allMids({ dex: dexOf(coin) }))[coin])
    if (!(m > 0)) throw new Error(`prix moyen de ${coin} indisponible`)
    return m
  }

  /** Meilleurs prix du carnet, par l'API REST. */
  async book(coin: string): Promise<Quote> {
    const recv0 = Date.now()
    const b = await this.info.l2Book({ coin })
    if (!b) throw new Error(`carnet ${coin} indisponible`)
    const bid = b.levels[0][0]
    const ask = b.levels[1][0]
    if (!bid || !ask) throw new Error(`carnet ${coin} vide d'un côté`)
    return { bid: Number(bid.px), ask: Number(ask.px), bidSz: Number(bid.sz), askSz: Number(ask.sz), time: b.time, recv: Math.round((recv0 + Date.now()) / 2), source: 'rest' }
  }

  async orderStatus(user: `0x${string}`, cloid: string): Promise<OrderStatus> {
    const r = await this.info.orderStatus({ user, oid: cloid as `0x${string}` })
    if (r.status !== 'order') return { status: 'unknown', oid: null, triggerPx: null, sz: null, detail: r.status }
    const o = r.order.order
    const s = r.order.status
    const status: OrderStatus['status'] = s === 'open' ? 'open' : s === 'filled' ? 'filled' : s === 'triggered' ? 'triggered' : s.endsWith('Rejected') ? 'rejected' : 'canceled'
    return { status, oid: o.oid, triggerPx: o.isTrigger ? Number(o.triggerPx) : null, sz: Number(o.origSz), detail: s }
  }
}

export interface StreamCandle extends Bar {
  /** Nombre de transactions de la bougie. */
  n: number
}

export type StreamEvent =
  | { type: 'open'; count: number; reconnect: boolean }
  | { type: 'close'; code: number; reason: string }
  | { type: 'sub_error'; channel: string; error: string }
  | { type: 'terminated'; reason: string }

/**
 * Flux temps réel. La connexion est surveillée : chaque ouverture après la première est une
 * reconnexion (le SDK se réabonne lui-même) ; le programme principal rattrape alors par REST ce
 * qui a pu être manqué. `lastData` : heure du dernier message de données reçu, pour le chien de
 * garde (un ping/pong du SDK vérifie déjà que la connexion répond).
 */
export class HyperliquidStream {
  readonly transport: WebSocketTransport
  readonly subs: SubscriptionClient
  opens = 0
  lastData = Date.now()
  private readonly onEvent: (e: StreamEvent) => void

  constructor(testnet: boolean, onEvent: (e: StreamEvent) => void = () => undefined) {
    this.onEvent = onEvent
    this.transport = new WebSocketTransport({ isTestnet: testnet, resubscribe: true, timeout: 15000 })
    this.subs = new SubscriptionClient({ transport: this.transport })
    const socket = this.transport.socket
    socket.addEventListener('open', () => {
      this.opens++
      this.lastData = Date.now()
      this.onEvent({ type: 'open', count: this.opens, reconnect: this.opens > 1 })
    })
    socket.addEventListener('close', (e: Event) => {
      const c = e as Event & { code?: number; reason?: string }
      this.onEvent({ type: 'close', code: c.code ?? 0, reason: c.reason ?? '' })
    })
    socket.terminationSignal.addEventListener('abort', () => this.onEvent({ type: 'terminated', reason: String((socket.terminationSignal.reason as Error)?.message ?? socket.terminationSignal.reason) }))
  }

  private opts(channel: string) {
    return { onError: (e: Error) => this.onEvent({ type: 'sub_error', channel, error: e.message }) }
  }

  private seen(): void {
    this.lastData = Date.now()
  }

  /** Bougie en cours, à chaque mise à jour ; une nouvelle ouverture signale la clôture de la précédente. */
  async onCandle(coin: string, listener: (c: StreamCandle) => void) {
    return this.subs.candle({ coin, interval: '15m' }, e => {
      this.seen()
      listener({ t: e.t, o: Number(e.o), h: Number(e.h), l: Number(e.l), c: Number(e.c), v: Number(e.v), n: e.n })
    }, this.opts('candle'))
  }

  /** Meilleurs prix acheteur et vendeur, à chaque changement. */
  async onBbo(coin: string, listener: (q: Quote) => void) {
    return this.subs.bbo({ coin }, e => {
      this.seen()
      const [bid, ask] = e.bbo
      if (!bid || !ask) return
      listener({ bid: Number(bid.px), ask: Number(ask.px), bidSz: Number(bid.sz), askSz: Number(ask.sz), time: e.time, recv: Date.now(), source: 'ws' })
    }, this.opts('bbo'))
  }

  /** Fills et changements d'état des ordres du compte : déclenchent une lecture REST, qui fait foi. */
  async onAccount(user: `0x${string}`, listener: (kind: 'fills' | 'orders') => void) {
    await this.subs.userFills({ user }, e => { this.seen(); if (!e.isSnapshot) listener('fills') }, this.opts('userFills'))
    await this.subs.orderUpdates({ user }, () => { this.seen(); listener('orders') }, this.opts('orderUpdates'))
  }

  /** Coupe la connexion et se reconnecte (chien de garde, ou test des reconnexions). */
  reconnect(): void {
    this.transport.socket.reconnect()
  }

  async close(): Promise<void> {
    this.transport.close()
  }
}

/** Ce que le compte principal autorise : l'agent, et le sous-compte ou vault tradé. */
export interface AccessCheck {
  agent: `0x${string}`
  /** L'agent figure parmi les wallets API du compte principal. */
  agentListed: boolean
  traded: `0x${string}`
  kind: 'compte principal' | 'sous-compte' | 'vault'
  name: string | null
}

/** Exécution réelle sur Hyperliquid (testnet ou mainnet). */
export type AccountMode = 'unifiedAccount' | 'portfolioMargin' | 'disabled' | 'default'
const UNIFIED = new Set<AccountMode>(['unifiedAccount', 'portfolioMargin'])

/**
 * Capital du compte pour la taille des positions. En compte unifié (ou marge de portefeuille), le
 * collatéral USDC est tenu en spot : à plat, le solde perps vaut 0 ; position ouverte, Hyperliquid
 * le montre côté perps. On prend donc le plus grand des deux, jamais leur somme (le même collatéral
 * serait compté deux fois). Compte standard : le spot ne sert pas de marge, seul le perps compte.
 */
export function equityOf(perpValue: number, mode: AccountMode, spotUsdc: number): number {
  return UNIFIED.has(mode) ? Math.max(perpValue, spotUsdc) : perpValue
}

export class HyperliquidExchange implements Exchange {
  readonly asset: AssetInfo
  readonly data: HyperliquidData
  readonly exchange: ExchangeClient
  readonly user: `0x${string}`
  readonly coin: string
  /** BBO du WebSocket, branché par le programme principal ; l'API REST le remplace s'il est ancien. */
  readonly quotes = new QuoteBook()
  quoteMaxAgeMs = 2000

  private constructor(data: HyperliquidData, exchange: ExchangeClient, user: `0x${string}`, coin: string, asset: AssetInfo) {
    this.data = data
    this.exchange = exchange
    this.user = user
    this.coin = coin
    this.asset = asset
  }

  static async connect(opts: HlOptions & { account: `0x${string}`; subAccount: `0x${string}` | null; agentKey: `0x${string}` }): Promise<{ exchange: HyperliquidExchange; access: AccessCheck }> {
    const data = new HyperliquidData(opts.testnet)
    const wallet = privateKeyToAccount(opts.agentKey)
    const access = await checkAccess(data.info, opts.account, opts.subAccount, wallet.address)
    const exchange = new ExchangeClient({
      transport: new HttpTransport({ isTestnet: opts.testnet, timeout: 15000 }), wallet,
      ...(opts.subAccount ? { defaultVaultAddress: opts.subAccount } : {}),
    })
    const asset = await data.assetInfo(opts.coin)
    return { exchange: new HyperliquidExchange(data, exchange, access.traded, opts.coin, asset), access }
  }

  private px(x: number): string {
    return formatPrice(x, this.asset.szDecimals)
  }

  private sz(x: number): string {
    return formatSize(x, this.asset.szDecimals)
  }

  private mode: { value: AccountMode; at: number } | null = null

  /** Mode du compte (unifié, marge de portefeuille…), relu au plus une fois par heure. */
  private async accountMode(): Promise<AccountMode> {
    if (this.mode && Date.now() - this.mode.at < 3600000) return this.mode.value
    const value = await this.data.info.userAbstraction({ user: this.user })
    this.mode = { value, at: Date.now() }
    return value
  }

  async account(): Promise<AccountState> {
    const [s, mode] = await Promise.all([this.data.info.clearinghouseState({ user: this.user, dex: this.asset.dex }), this.accountMode()])
    const p = s.assetPositions.find(a => a.position.coin === this.coin)?.position
    const spot = UNIFIED.has(mode) ? (await this.data.info.spotClearinghouseState({ user: this.user })).balances.find(b => b.coin === 'USDC') : undefined
    return {
      equity: equityOf(Number(s.crossMarginSummary.accountValue), mode, spot ? Number(spot.total) : 0),
      position: p ? { size: Number(p.szi), entryPx: Number(p.entryPx), liquidationPx: p.liquidationPx == null ? null : Number(p.liquidationPx) } : { size: 0, entryPx: 0, liquidationPx: null },
      time: s.time,
    }
  }

  async openOrders(): Promise<OpenOrder[]> {
    const rows = await this.data.info.frontendOpenOrders({ user: this.user, dex: this.asset.dex })
    return rows.filter(o => o.coin === this.coin).map(o => ({
      oid: o.oid, cloid: o.cloid ?? null, side: o.side === 'B' ? 'buy' : 'sell', sz: Number(o.sz), limitPx: Number(o.limitPx),
      triggerPx: o.isTrigger ? Number(o.triggerPx) : null, isTrigger: o.isTrigger, reduceOnly: o.reduceOnly,
    }))
  }

  async fills(since: number): Promise<Fill[]> {
    const rows = await this.data.info.userFillsByTime({ user: this.user, startTime: since })
    return rows.filter(f => f.coin === this.coin).map(f => ({
      time: f.time, oid: f.oid, cloid: f.cloid ?? null, px: Number(f.px), sz: Number(f.sz), side: f.side === 'B' ? 'buy' : 'sell',
      fee: Number(f.fee), closedPnl: Number(f.closedPnl), startPosition: Number(f.startPosition), tid: f.tid, liquidation: !!f.liquidation,
    }))
  }

  async funding(since: number): Promise<FundingEvent[]> {
    const rows = await this.data.info.userFunding({ user: this.user, startTime: since })
    return rows.filter(r => r.delta.coin === this.coin).map(r => ({ time: r.time, usdc: Number(r.delta.usdc), szi: Number(r.delta.szi), rate: Number(r.delta.fundingRate) }))
  }

  async quote(): Promise<Quote> {
    return this.quotes.fresh(Date.now(), this.quoteMaxAgeMs) ?? this.data.book(this.coin)
  }

  orderStatus(cloid: string): Promise<OrderStatus> {
    return this.data.orderStatus(this.user, cloid)
  }

  async setLeverage(leverage: number): Promise<void> {
    await this.exchange.updateLeverage({ asset: this.asset.index, isCross: this.asset.isCross, leverage: Math.min(Math.ceil(leverage), this.asset.maxLeverage) })
  }

  private async send(order: Parameters<ExchangeClient['order']>[0]['orders'][number]): Promise<OrderResult> {
    try {
      const r = await this.exchange.order({ orders: [order], grouping: 'na' })
      const st = r.response.data.statuses[0]
      if (typeof st === 'string') {
        // waitingForFill / waitingForTrigger : accepté, sans numéro d'ordre dans la réponse.
        const s = await this.orderStatus(order.c!).catch(() => null)
        return { status: 'resting', oid: s?.oid ?? null, filledSz: 0, avgPx: null, uncertain: s?.oid == null }
      }
      if ('filled' in st) return { status: 'filled', oid: st.filled.oid, filledSz: Number(st.filled.totalSz), avgPx: Number(st.filled.avgPx) }
      if ('resting' in st) return { status: 'resting', oid: st.resting.oid, filledSz: 0, avgPx: null }
      // Le SDK lève une exception sur un statut d'erreur : ce cas ne devrait pas arriver.
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: JSON.stringify(st) }
    } catch (e) {
      // ApiRequestError : refus explicite de l'exchange, l'ordre n'existe pas. Toute autre erreur
      // (délai dépassé, connexion coupée) laisse l'issue inconnue : le moteur la vérifie par le cloid.
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: e instanceof Error ? e.message : String(e), uncertain: !(e instanceof ApiRequestError) }
    }
  }

  market(side: Side, sz: number, reduceOnly: boolean, refPx: number, maxSlippagePct: number, cloid: string): Promise<OrderResult> {
    const limit = side === 'buy' ? refPx * (1 + maxSlippagePct / 100) : refPx * (1 - maxSlippagePct / 100)
    return this.send({ a: this.asset.index, b: side === 'buy', p: this.px(limit), s: this.sz(sz), r: reduceOnly, t: { limit: { tif: 'Ioc' } }, c: cloid as `0x${string}` })
  }

  stop(side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string): Promise<OrderResult> {
    const limit = side === 'buy' ? triggerPx * (1 + slippagePct / 100) : triggerPx * (1 - slippagePct / 100)
    return this.send({
      a: this.asset.index, b: side === 'buy', p: this.px(limit), s: this.sz(sz), r: true,
      t: { trigger: { isMarket: true, triggerPx: this.px(triggerPx), tpsl: 'sl' } }, c: cloid as `0x${string}`,
    })
  }

  limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult> {
    return this.send({ a: this.asset.index, b: side === 'buy', p: this.px(px), s: this.sz(sz), r: reduceOnly, t: { limit: { tif: 'Gtc' } }, c: cloid as `0x${string}` })
  }

  async cancel(oids: number[]): Promise<CancelResult[]> {
    const out: CancelResult[] = []
    for (const o of oids) {
      try {
        await this.exchange.cancel({ cancels: [{ a: this.asset.index, o }] })
        out.push({ oid: o, ok: true })
      } catch (e) {
        out.push({ oid: o, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    return out
  }
}

/**
 * Vérifie, avant tout ordre, que le sous-compte (ou vault) appartient bien au compte principal :
 * sinon l'agent signerait pour une adresse qu'il ne contrôle pas. L'absence de l'agent dans la
 * liste des wallets API est seulement signalée (les ordres échoueraient de toute façon).
 */
export async function checkAccess(info: InfoClient, account: `0x${string}`, sub: `0x${string}` | null, agent: `0x${string}`): Promise<AccessCheck> {
  const agents = await info.extraAgents({ user: account })
  const agentListed = agents.some(a => a.address.toLowerCase() === agent.toLowerCase())
  if (!sub) return { agent, agentListed, traded: account, kind: 'compte principal', name: null }
  const same = (x: string) => x.toLowerCase() === sub.toLowerCase()
  const subs = (await info.subAccounts({ user: account })) ?? []
  const s = subs.find(x => same(x.subAccountUser))
  if (s) return { agent, agentListed, traded: sub, kind: 'sous-compte', name: s.name }
  const vault = (await info.leadingVaults({ user: account })).find(v => same(v.address))
  if (vault) return { agent, agentListed, traded: sub, kind: 'vault', name: vault.name }
  throw new Error(`HL_SUBACCOUNT_ADDRESS ${sub} n'est ni un sous-compte ni un vault de ${account}`)
}
