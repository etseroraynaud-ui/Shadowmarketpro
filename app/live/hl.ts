// Données publiques d'un compte Hyperliquid, lues par le navigateur (l'API accepte les requêtes
// de toute origine) : aucune clé, aucune donnée qui ne soit déjà publique on-chain.

import { dexOf, tickOf } from '../../lib/hyperliquid/market.ts'
import type { PublicFill, PublicFunding } from '../../lib/hyperliquid/track.ts'

export type Network = 'mainnet' | 'testnet'

const URLS: Record<Network, string> = {
  mainnet: 'https://api.hyperliquid.xyz/info',
  testnet: 'https://api.hyperliquid-testnet.xyz/info',
}

export const EXPLORER: Record<Network, string> = {
  mainnet: 'https://app.hyperliquid.xyz/explorer/address/',
  testnet: 'https://app.hyperliquid-testnet.xyz/explorer/address/',
}

async function info<T>(net: Network, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(URLS[net], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Hyperliquid ${body.type} : HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export interface OpenOrderView {
  oid: number
  cloid: string | null
  side: 'buy' | 'sell'
  sz: number
  limitPx: number
  triggerPx: number | null
  isTrigger: boolean
  reduceOnly: boolean
  orderType: string
}

export interface PositionView {
  size: number
  entryPx: number
  unrealizedPnl: number
  liquidationPx: number | null
  leverage: number
  marginUsed: number
}

export interface AccountData {
  net: Network
  user: string
  coin: string
  mid: number
  tick: number
  szDecimals: number
  /** Valeur du compte (tous marchés) : historique [heure, USDC], du plus fin au plus ancien fusionné. */
  accountValue: [number, number][]
  /** Valeur actuelle du compte (dernier point de l'historique). */
  value: number
  position: PositionView | null
  orders: OpenOrderView[]
  fills: PublicFill[]
  funding: PublicFunding[]
  /** Heure de la lecture. */
  time: number
}

interface RawFill {
  coin: string; px: string; sz: string; side: 'B' | 'A'; time: number; startPosition: string; closedPnl: string
  oid: number; fee: string; tid: number; cloid?: string | null; liquidation?: unknown
}

/** Tous les fills depuis `since`, page par page (2000 au plus par réponse ; l'API garde les 10 000 derniers). */
async function allFills(net: Network, user: string, since: number): Promise<PublicFill[]> {
  const seen = new Map<number, PublicFill>()
  let start = since
  for (let guard = 0; guard < 10; guard++) {
    const rows = await info<RawFill[]>(net, { type: 'userFillsByTime', user, startTime: start, aggregateByTime: false })
    for (const f of rows) {
      seen.set(f.tid, {
        time: f.time, coin: f.coin, px: Number(f.px), sz: Number(f.sz), side: f.side === 'B' ? 'buy' : 'sell', fee: Number(f.fee),
        closedPnl: Number(f.closedPnl), startPosition: Number(f.startPosition), tid: f.tid, oid: f.oid, cloid: f.cloid ?? null, liquidation: !!f.liquidation,
      })
    }
    if (rows.length < 2000) break
    const last = Math.max(...rows.map(f => f.time))
    start = last > start ? last : start + 1
  }
  return [...seen.values()]
}

interface RawFunding { time: number; hash: string; delta: { type: string; coin: string; usdc: string } }

async function allFunding(net: Network, user: string, since: number): Promise<PublicFunding[]> {
  const seen = new Map<string, PublicFunding>()
  let start = since
  for (let guard = 0; guard < 40; guard++) {
    const rows = await info<RawFunding[]>(net, { type: 'userFunding', user, startTime: start })
    for (const r of rows) seen.set(`${r.time}:${r.delta.coin}`, { time: r.time, coin: r.delta.coin, usdc: Number(r.delta.usdc) })
    if (rows.length < 500) break
    const last = Math.max(...rows.map(r => r.time))
    start = last > start ? last : start + 1
  }
  return [...seen.values()]
}

type Portfolio = [string, { accountValueHistory: [number, string][] }][]

/** Historique de la valeur du compte : chaque fenêtre (jour, semaine, mois, tout) ajoute ses points plus anciens. */
function mergeHistory(p: Portfolio): [number, number][] {
  const order = ['day', 'week', 'month', 'allTime']
  const out: [number, number][] = []
  let first = Infinity
  for (const name of order) {
    const h = p.find(x => x[0] === name)?.[1].accountValueHistory ?? []
    const older = h.filter(([t]) => t < first).map(([t, v]) => [t, Number(v)] as [number, number])
    out.push(...older)
    if (h.length) first = Math.min(first, h[0][0])
  }
  return out.sort((a, b) => a[0] - b[0])
}

interface RawState {
  assetPositions: { position: { coin: string; szi: string; entryPx: string; unrealizedPnl: string; liquidationPx: string | null; leverage: { value: number }; marginUsed: string } }[]
}

interface RawOrder {
  coin: string; oid: number; cloid?: string | null; side: 'B' | 'A'; sz: string; limitPx: string; triggerPx: string
  isTrigger: boolean; reduceOnly: boolean; orderType: string
}

export async function loadAccount(net: Network, user: string, coin: string, since = 0): Promise<AccountData> {
  const dex = dexOf(coin)
  const [state, orders, portfolio, fills, funding, meta, mids] = await Promise.all([
    info<RawState>(net, { type: 'clearinghouseState', user, dex }),
    info<RawOrder[]>(net, { type: 'frontendOpenOrders', user, dex }),
    info<Portfolio>(net, { type: 'portfolio', user }),
    allFills(net, user, since),
    allFunding(net, user, since),
    info<{ universe: { name: string; szDecimals: number }[] }>(net, { type: 'meta', dex }),
    info<Record<string, string>>(net, { type: 'allMids', dex }),
  ])
  const u = meta.universe.find(x => x.name === coin)
  if (!u) throw new Error(`${coin} : marché inconnu sur Hyperliquid ${net}`)
  const mid = Number(mids[coin])
  const p = state.assetPositions.find(a => a.position.coin === coin)?.position
  const accountValue = mergeHistory(portfolio)
  return {
    net, user, coin, mid, szDecimals: u.szDecimals, tick: tickOf(mid, u.szDecimals),
    accountValue, value: accountValue.length ? accountValue[accountValue.length - 1][1] : NaN,
    position: p && Number(p.szi) !== 0 ? {
      size: Number(p.szi), entryPx: Number(p.entryPx), unrealizedPnl: Number(p.unrealizedPnl),
      liquidationPx: p.liquidationPx == null ? null : Number(p.liquidationPx), leverage: p.leverage.value, marginUsed: Number(p.marginUsed),
    } : null,
    orders: orders.filter(o => o.coin === coin).map(o => ({
      oid: o.oid, cloid: o.cloid ?? null, side: o.side === 'B' ? 'buy' : 'sell', sz: Number(o.sz), limitPx: Number(o.limitPx),
      triggerPx: o.isTrigger ? Number(o.triggerPx) : null, isTrigger: o.isTrigger, reduceOnly: o.reduceOnly, orderType: o.orderType,
    })),
    fills: fills.filter(f => f.coin === coin),
    funding: funding.filter(f => f.coin === coin),
    time: Date.now(),
  }
}
