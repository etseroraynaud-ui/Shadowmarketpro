// Connecteur Hyperliquid (API officielle, via le SDK TypeScript @nktkas/hyperliquid) :
// - données : bougies (REST) et flux temps réel (WebSocket, reconnexion et réabonnement
//   automatiques du SDK) ;
// - exécution : ordres, stops, annulations, positions, ordres ouverts, fills, financement.
//
// Les ordres sont signés par un wallet agent dédié au bot (clé en variable d'environnement),
// approuvé sur le compte HL_ACCOUNT_ADDRESS. L'agent ne peut pas retirer de fonds. Avec un
// sous-compte (HL_SUBACCOUNT_ADDRESS), chaque ordre porte son adresse (« vaultAddress ») : le même
// agent trade alors le sous-compte, et positions, ordres et fills sont lus sur le sous-compte.

import { ExchangeClient, HttpTransport, InfoClient, SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid'
import { formatPrice, formatSize, SymbolConverter } from '@nktkas/hyperliquid/utils'
import { privateKeyToAccount } from 'viem/accounts'
import type { Bar } from '../../../lib/strategies/shock/live.ts'
import { dexOf, tickOf } from '../../../lib/hyperliquid/market.ts'
import type { CandleApi, Interval } from '../data/candles.ts'
import type { AccountState, AssetInfo, Exchange, Fill, FundingEvent, OpenOrder, OrderResult, Side } from '../exec/exchange.ts'

export { dexOf, tickOf }

export interface HlOptions {
  testnet: boolean
  coin: string
}

/** Données publiques : bougies, prix, métadonnées de l'actif. */
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
}

/** Flux temps réel : bougies (pour détecter les clôtures) et prix moyen (stop suiveur). */
export class HyperliquidStream {
  readonly transport: WebSocketTransport
  readonly subs: SubscriptionClient

  constructor(testnet: boolean) {
    this.transport = new WebSocketTransport({ isTestnet: testnet, resubscribe: true, timeout: 15000 })
    this.subs = new SubscriptionClient({ transport: this.transport })
  }

  /** Appelé à chaque mise à jour de la bougie en cours ; une nouvelle ouverture signale une clôture. */
  async onCandle(coin: string, listener: (t: number) => void) {
    return this.subs.candle({ coin, interval: '15m' }, e => listener(e.t))
  }

  async onMid(coin: string, listener: (mid: number) => void) {
    return this.subs.allMids({ dex: dexOf(coin) }, e => {
      const m = Number(e.mids[coin])
      if (m > 0) listener(m)
    })
  }

  async close(): Promise<void> {
    await this.transport.close()
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
export class HyperliquidExchange implements Exchange {
  readonly asset: AssetInfo
  readonly data: HyperliquidData
  readonly exchange: ExchangeClient
  readonly user: `0x${string}`
  readonly coin: string

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

  async account(): Promise<AccountState> {
    const s = await this.data.info.clearinghouseState({ user: this.user, dex: this.asset.dex })
    const p = s.assetPositions.find(a => a.position.coin === this.coin)?.position
    return {
      equity: Number(s.crossMarginSummary.accountValue),
      position: p ? { size: Number(p.szi), entryPx: Number(p.entryPx), liquidationPx: p.liquidationPx == null ? null : Number(p.liquidationPx) } : { size: 0, entryPx: 0, liquidationPx: null },
      time: s.time,
    }
  }

  async openOrders(): Promise<OpenOrder[]> {
    const rows = await this.data.info.frontendOpenOrders({ user: this.user, dex: this.asset.dex })
    return rows.filter(o => o.coin === this.coin).map(o => ({
      oid: o.oid, cloid: o.cloid, side: o.side === 'B' ? 'buy' : 'sell', sz: Number(o.sz), limitPx: Number(o.limitPx),
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

  mid(): Promise<number> {
    return this.data.mid(this.coin)
  }

  async setLeverage(leverage: number): Promise<void> {
    await this.exchange.updateLeverage({ asset: this.asset.index, isCross: this.asset.isCross, leverage: Math.min(Math.ceil(leverage), this.asset.maxLeverage) })
  }

  private async send(order: Parameters<ExchangeClient['order']>[0]['orders'][number]): Promise<OrderResult> {
    try {
      const r = await this.exchange.order({ orders: [order], grouping: 'na' })
      const st = r.response.data.statuses[0]
      if (typeof st === 'string') return { status: 'resting', oid: null, filledSz: 0, avgPx: null }
      if ('filled' in st) return { status: 'filled', oid: st.filled.oid, filledSz: Number(st.filled.totalSz), avgPx: Number(st.filled.avgPx) }
      if ('resting' in st) return { status: 'resting', oid: st.resting.oid, filledSz: 0, avgPx: null }
      // Le SDK lève une exception sur un statut d'erreur : ce cas ne devrait pas arriver.
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: JSON.stringify(st) }
    } catch (e) {
      return { status: 'error', oid: null, filledSz: 0, avgPx: null, error: e instanceof Error ? e.message : String(e) }
    }
  }

  market(side: Side, sz: number, reduceOnly: boolean, refPx: number, maxSlippagePct: number, cloid: string): Promise<OrderResult> {
    const limit = side === 'buy' ? refPx * (1 + maxSlippagePct / 100) : refPx * (1 - maxSlippagePct / 100)
    return this.send({ a: this.asset.index, b: side === 'buy', p: this.px(limit), s: this.sz(sz), r: reduceOnly, t: { limit: { tif: 'Ioc' } }, c: cloid as `0x${string}` })
  }

  private stopOrder(side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string) {
    const limit = side === 'buy' ? triggerPx * (1 + slippagePct / 100) : triggerPx * (1 - slippagePct / 100)
    return {
      a: this.asset.index, b: side === 'buy', p: this.px(limit), s: this.sz(sz), r: true,
      t: { trigger: { isMarket: true, triggerPx: this.px(triggerPx), tpsl: 'sl' as const } }, c: cloid as `0x${string}`,
    }
  }

  stop(side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string): Promise<OrderResult> {
    return this.send(this.stopOrder(side, sz, triggerPx, slippagePct, cloid))
  }

  limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult> {
    return this.send({ a: this.asset.index, b: side === 'buy', p: this.px(px), s: this.sz(sz), r: reduceOnly, t: { limit: { tif: 'Gtc' } }, c: cloid as `0x${string}` })
  }

  async modifyStop(oid: number, side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string): Promise<OrderResult> {
    try {
      await this.exchange.modify({ oid, order: this.stopOrder(side, sz, triggerPx, slippagePct, cloid) })
      return { status: 'resting', oid, filledSz: 0, avgPx: null }
    } catch (e) {
      return { status: 'error', oid, filledSz: 0, avgPx: null, error: e instanceof Error ? e.message : String(e) }
    }
  }

  async cancel(oids: number[]): Promise<void> {
    if (!oids.length) return
    await this.exchange.cancel({ cancels: oids.map(o => ({ a: this.asset.index, o })) })
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
