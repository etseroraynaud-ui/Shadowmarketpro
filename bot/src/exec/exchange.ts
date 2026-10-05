// Interface d'exécution du bot : ce dont l'ExecutionEngine a besoin d'un exchange. Implémentée
// par Hyperliquid (hl/client.ts) et par un faux exchange en mémoire pour les tests.

export type Side = 'buy' | 'sell'

export interface AssetInfo {
  /** Indice de l'actif dans l'univers perp. */
  index: number
  szDecimals: number
  maxLeverage: number
  /** Pas de cotation effectif (1 $ pour BTC : prix entiers). */
  tick: number
  /** Dex HIP-3 de l'actif ('' : marché principal). */
  dex: string
  /** Marge croisée permise (sinon isolée seulement). */
  isCross: boolean
}

export interface AccountState {
  /** Valeur du compte (marge croisée), USDC. */
  equity: number
  /** Taille signée de la position (0 = à plat), prix moyen, prix de liquidation. */
  position: { size: number; entryPx: number; liquidationPx: number | null }
  time: number
}

export interface OpenOrder {
  oid: number
  cloid: string | null
  side: Side
  sz: number
  limitPx: number
  triggerPx: number | null
  isTrigger: boolean
  reduceOnly: boolean
}

export interface Fill {
  time: number
  oid: number
  cloid: string | null
  px: number
  sz: number
  side: Side
  /** Frais payés (négatif : remise). */
  fee: number
  closedPnl: number
  /** Taille signée de la position avant ce fill. */
  startPosition: number
  tid: number
  liquidation: boolean
}

export interface FundingEvent {
  time: number
  /** USDC reçus (positif) ou payés (négatif). */
  usdc: number
  szi: number
  rate: number
}

export interface OrderResult {
  status: 'filled' | 'resting' | 'error'
  oid: number | null
  filledSz: number
  avgPx: number | null
  error?: string
}

export interface Exchange {
  readonly asset: AssetInfo
  account(): Promise<AccountState>
  /** Ordres ouverts sur l'actif du bot. */
  openOrders(): Promise<OpenOrder[]>
  fills(since: number): Promise<Fill[]>
  funding(since: number): Promise<FundingEvent[]>
  mid(): Promise<number>
  setLeverage(leverage: number): Promise<void>
  /** Ordre au marché : limite IOC à refPx ± maxSlippagePct. */
  market(side: Side, sz: number, reduceOnly: boolean, refPx: number, maxSlippagePct: number, cloid: string): Promise<OrderResult>
  /** Stop au marché, réduction seule, déclenché à triggerPx. */
  stop(side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string): Promise<OrderResult>
  /** Ordre limite GTC. */
  limit(side: Side, sz: number, px: number, reduceOnly: boolean, cloid: string): Promise<OrderResult>
  modifyStop(oid: number, side: Side, sz: number, triggerPx: number, slippagePct: number, cloid: string): Promise<OrderResult>
  cancel(oids: number[]): Promise<void>
}

/** Identifiants client des ordres du bot : préfixe fixe, nature de l'ordre, partie aléatoire. */
export const CLOID_PREFIX = '0x5b0c'
export type OrderKind = 'entry' | 'close' | 'stop' | 'tp1' | 'emergency'
const KIND_CODE: Record<OrderKind, string> = { entry: '01', close: '02', stop: '03', tp1: '04', emergency: '05' }

export function newCloid(kind: OrderKind): string {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(13)), b => b.toString(16).padStart(2, '0')).join('')
  return `${CLOID_PREFIX}${KIND_CODE[kind]}${rand}`
}

export function cloidKind(cloid: string | null): OrderKind | null {
  if (!cloid || !cloid.startsWith(CLOID_PREFIX)) return null
  const code = cloid.slice(CLOID_PREFIX.length, CLOID_PREFIX.length + 2)
  return (Object.keys(KIND_CODE) as OrderKind[]).find(k => KIND_CODE[k] === code) ?? null
}
