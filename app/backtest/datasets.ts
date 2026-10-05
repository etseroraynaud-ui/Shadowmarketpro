// Sources de données de Backtest Lab : exemples (BTC/USD Bitstamp, fichiers du site), Hyperliquid
// (crypto, actions, or, indices) et Binance, téléchargés par le navigateur.
//
// Chaque jeu de données a un identifiant qui permet de le recharger à la visite suivante :
// « btc15m » (exemple), « hl:xyz:NVDA:15m » (Hyperliquid), « bn:BTCUSDT:15m » (Binance).
// Pour Hyperliquid et Binance, les bougies journalières de la même source sont chargées aussi :
// elles donnent le régime de volatilité du Shock Engine même quand l'historique intraday est court.

import { loadBarsFromCsv, barsFromRecords } from '../../lib/backtest/data.ts'
import type { Bars, Msg } from '../../lib/backtest/types.ts'

export interface Dataset {
  bars: Bars
  name: string
  timeframe: string
  barMs: number
  warnings: Msg[]
  /** Identifiant du jeu de données, pour le recharger à la prochaine visite. */
  sample?: string
  /** Bougies journalières de la même source (régime de volatilité du Shock Engine). */
  daily?: Bars
}

// ---------------------------------------------------------------- exemples du site
export const SAMPLES = [
  { id: 'btc1d', file: '/backtest/data/btcusd_1d.csv', name: 'BTC/USD · Bitstamp', label: 'sampleBtc1d' as const },
  { id: 'btc4h', file: '/backtest/data/btcusd_4h.csv', name: 'BTC/USD · Bitstamp', label: 'sampleBtc4h' as const },
  { id: 'btc30m', file: '/backtest/data/btcusd_30m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc30m' as const },
  { id: 'btc15m', file: '/backtest/data/btcusd_15m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc15m' as const },
  { id: 'btc5m', file: '/backtest/data/btcusd_5m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc5m' as const },
]

/** Texte d'un fichier, décompressé dans le navigateur s'il est en gzip. */
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  // Le serveur peut déjà avoir décompressé : on regarde la signature gzip (1f 8b).
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).text()
  }
  return new TextDecoder().decode(buf)
}

async function loadSampleFile(id: string): Promise<Dataset> {
  const s = SAMPLES.find(x => x.id === id) ?? SAMPLES[0]
  const d = loadBarsFromCsv(await fetchText(s.file))
  return { bars: d.bars, name: s.name, timeframe: d.timeframe, barMs: d.barMs, warnings: d.warnings, sample: s.id }
}

type Rec = [number, number, number, number, number, number]

const MINUTE = 60000
export const INTERVAL_MS: Record<string, number> = {
  '5m': 5 * MINUTE, '15m': 15 * MINUTE, '30m': 30 * MINUTE, '1h': 60 * MINUTE, '4h': 240 * MINUTE, '1d': 1440 * MINUTE, '1w': 10080 * MINUTE,
}

// ---------------------------------------------------------------- Hyperliquid
export type MarketGroup = 'crypto' | 'stocks' | 'commodities' | 'indices'

export interface Market {
  coin: string
  label: Msg
}

/**
 * Marchés perpétuels Hyperliquid, cotés 24 h/24. Actions, matières premières et indices sont des
 * marchés HIP-3 du dex « xyz » (nom préfixé « xyz: »).
 */
export const HL_MARKETS: Record<MarketGroup, Market[]> = {
  crypto: [
    { coin: 'BTC', label: { fr: 'Bitcoin (BTC)', en: 'Bitcoin (BTC)' } },
    { coin: 'ETH', label: { fr: 'Ethereum (ETH)', en: 'Ethereum (ETH)' } },
    { coin: 'SOL', label: { fr: 'Solana (SOL)', en: 'Solana (SOL)' } },
    { coin: 'HYPE', label: { fr: 'Hyperliquid (HYPE)', en: 'Hyperliquid (HYPE)' } },
  ],
  stocks: [
    { coin: 'xyz:NVDA', label: { fr: 'NVIDIA (NVDA)', en: 'NVIDIA (NVDA)' } },
    { coin: 'xyz:TSLA', label: { fr: 'Tesla (TSLA)', en: 'Tesla (TSLA)' } },
    { coin: 'xyz:AAPL', label: { fr: 'Apple (AAPL)', en: 'Apple (AAPL)' } },
    { coin: 'xyz:MSFT', label: { fr: 'Microsoft (MSFT)', en: 'Microsoft (MSFT)' } },
    { coin: 'xyz:AMZN', label: { fr: 'Amazon (AMZN)', en: 'Amazon (AMZN)' } },
    { coin: 'xyz:GOOGL', label: { fr: 'Alphabet (GOOGL)', en: 'Alphabet (GOOGL)' } },
    { coin: 'xyz:META', label: { fr: 'Meta (META)', en: 'Meta (META)' } },
    { coin: 'xyz:AMD', label: { fr: 'AMD (AMD)', en: 'AMD (AMD)' } },
    { coin: 'xyz:TSM', label: { fr: 'TSMC (TSM)', en: 'TSMC (TSM)' } },
    { coin: 'xyz:PLTR', label: { fr: 'Palantir (PLTR)', en: 'Palantir (PLTR)' } },
    { coin: 'xyz:COIN', label: { fr: 'Coinbase (COIN)', en: 'Coinbase (COIN)' } },
    { coin: 'xyz:MSTR', label: { fr: 'Strategy (MSTR)', en: 'Strategy (MSTR)' } },
    { coin: 'xyz:NFLX', label: { fr: 'Netflix (NFLX)', en: 'Netflix (NFLX)' } },
  ],
  commodities: [
    { coin: 'xyz:GOLD', label: { fr: 'Or (GOLD)', en: 'Gold (GOLD)' } },
    { coin: 'xyz:SILVER', label: { fr: 'Argent (SILVER)', en: 'Silver (SILVER)' } },
    { coin: 'xyz:CL', label: { fr: 'Pétrole WTI (CL)', en: 'WTI crude oil (CL)' } },
    { coin: 'xyz:BRENTOIL', label: { fr: 'Pétrole Brent', en: 'Brent crude oil' } },
    { coin: 'xyz:NATGAS', label: { fr: 'Gaz naturel', en: 'Natural gas' } },
    { coin: 'xyz:COPPER', label: { fr: 'Cuivre', en: 'Copper' } },
  ],
  indices: [
    { coin: 'xyz:SP500', label: { fr: 'S&P 500', en: 'S&P 500' } },
    { coin: 'xyz:XYZ100', label: { fr: 'XYZ100 (Nasdaq-100)', en: 'XYZ100 (Nasdaq-100)' } },
    { coin: 'xyz:JP225', label: { fr: 'Nikkei 225', en: 'Nikkei 225' } },
  ],
}

export const HL_INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d'] as const
const HL_INFO = 'https://api.hyperliquid.xyz/info'
const HL_INFO_TESTNET = 'https://api.hyperliquid-testnet.xyz/info'
/** L'API ne renvoie que les 5000 bougies les plus récentes d'un intervalle. */
const HL_MAX = 5000

export function marketLabel(coin: string): Msg {
  for (const g of Object.values(HL_MARKETS)) {
    const m = g.find(x => x.coin === coin)
    if (m) return m.label
  }
  return { fr: coin, en: coin }
}

/** Bougies closes, dans l'ordre, sans doublon. */
function closedRecords(rows: { t: number; o: string; h: string; l: string; c: string; v: string }[], step: number, now: number): Rec[] {
  const recs: Rec[] = []
  for (const r of [...rows].sort((a, b) => a.t - b.t)) {
    if (r.t + step > now) continue
    if (recs.length && r.t <= recs[recs.length - 1][0]) continue
    recs.push([r.t, Number(r.o), Number(r.h), Number(r.l), Number(r.c), Number(r.v)])
  }
  return recs
}

async function hlCandles(coin: string, interval: string, now: number, testnet = false): Promise<Rec[]> {
  const step = INTERVAL_MS[interval]
  const res = await fetch(testnet ? HL_INFO_TESTNET : HL_INFO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval, startTime: now - HL_MAX * step, endTime: now } }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const rows = await res.json()
  if (!Array.isArray(rows)) throw new Error('réponse inattendue')
  return closedRecords(rows, step, now)
}

export async function loadHyperliquid(coin: string, interval: string, testnet = false): Promise<Dataset> {
  if (!INTERVAL_MS[interval]) throw new Error(`intervalle ${interval}`)
  const now = Date.now()
  const [recs, days] = await Promise.all([hlCandles(coin, interval, now, testnet), interval === '1d' ? null : hlCandles(coin, '1d', now, testnet)])
  if (recs.length < 2) throw new Error('no data')
  const d = barsFromRecords(recs)
  const daily = interval === '1d' ? d.bars : days && days.length ? barsFromRecords(days).bars : undefined
  return {
    bars: d.bars, name: `${coin.split(':').pop()} · Hyperliquid`, timeframe: d.timeframe, barMs: d.barMs, sample: `hl:${coin}:${interval}`, daily,
    warnings: [
      ...d.warnings,
      ...(recs.length >= HL_MAX - 2 ? [{
        fr: `Hyperliquid ne fournit que les ${HL_MAX} dernières bougies : en ${interval}, l'historique commence le ${new Date(recs[0][0]).toISOString().slice(0, 10)}. Un intervalle plus long donne plus d'historique.`,
        en: `Hyperliquid only provides the last ${HL_MAX} candles: on ${interval}, history starts on ${new Date(recs[0][0]).toISOString().slice(0, 10)}. A longer interval gives more history.`,
      }] : []),
    ],
  }
}

// ---------------------------------------------------------------- Binance
export const BINANCE_QUICK: { symbol: string; label: Msg }[] = [
  { symbol: 'BTCUSDT', label: { fr: 'BTC', en: 'BTC' } },
  { symbol: 'ETHUSDT', label: { fr: 'ETH', en: 'ETH' } },
  { symbol: 'SOLUSDT', label: { fr: 'SOL', en: 'SOL' } },
  { symbol: 'PAXGUSDT', label: { fr: 'Or (PAXG)', en: 'Gold (PAXG)' } },
]

export const BINANCE_INTERVALS = ['5m', '15m', '30m', '1h', '4h', '1d', '1w'] as const
const BN_KLINES = 'https://data-api.binance.vision/api/v3/klines'
/** Au-delà, seules les barres les plus récentes sont téléchargées. */
const BN_MAX_BARS = 60000

async function bnKlines(symbol: string, interval: string, start: number, now: number): Promise<Rec[]> {
  const step = INTERVAL_MS[interval]
  const recs: Rec[] = []
  let from = start
  for (let page = 0; page < Math.ceil(BN_MAX_BARS / 1000) + 1; page++) {
    const res = await fetch(`${BN_KLINES}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${from}&limit=1000`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = (await res.json()) as (string | number)[][]
    if (!Array.isArray(rows) || !rows.length) break
    for (const r of rows) {
      const t = Number(r[0])
      if (t + step > now || (recs.length && t <= recs[recs.length - 1][0])) continue
      recs.push([t, Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])])
    }
    const last = Number(rows[rows.length - 1][0])
    if (rows.length < 1000 || last <= from) break
    from = last + 1
  }
  return recs
}

export async function loadBinance(symbol: string, interval: string, since: number): Promise<Dataset> {
  const step = INTERVAL_MS[interval]
  if (!step) throw new Error(`intervalle ${interval}`)
  const now = Date.now()
  // Trop de barres depuis la date demandée : on garde les plus récentes.
  const start = Math.max(since, now - BN_MAX_BARS * step)
  const [recs, days] = await Promise.all([
    bnKlines(symbol, interval, start, now),
    step < INTERVAL_MS['1d'] ? bnKlines(symbol, '1d', Date.UTC(2017, 0, 1), now) : null,
  ])
  if (recs.length < 2) throw new Error('no data')
  const d = barsFromRecords(recs)
  const daily = step === INTERVAL_MS['1d'] ? d.bars : days && days.length ? barsFromRecords(days).bars : undefined
  const sinceDay = new Date(since).toISOString().slice(0, 10)
  return {
    bars: d.bars, name: `${symbol} · Binance`, timeframe: d.timeframe, barMs: d.barMs, sample: `bn:${symbol}:${interval}:${sinceDay}`, daily,
    warnings: [
      ...d.warnings,
      ...(start > since ? [{
        fr: `Historique limité aux ${BN_MAX_BARS.toLocaleString('fr-FR')} dernières barres : il commence le ${new Date(recs[0][0]).toISOString().slice(0, 10)}.`,
        en: `History limited to the last ${BN_MAX_BARS.toLocaleString('en-US')} bars: it starts on ${new Date(recs[0][0]).toISOString().slice(0, 10)}.`,
      }] : []),
    ],
  }
}

// ---------------------------------------------------------------- rechargement
/** Charge un jeu de données à partir de son identifiant. */
export async function loadDataset(id: string): Promise<Dataset> {
  if (id.startsWith('hl:')) {
    const k = id.lastIndexOf(':')
    return loadHyperliquid(id.slice(3, k), id.slice(k + 1))
  }
  if (id.startsWith('bn:')) {
    const [, symbol, interval, since] = id.split(':')
    return loadBinance(symbol, interval, Date.parse(`${since}T00:00:00Z`) || Date.UTC(2020, 0, 1))
  }
  return loadSampleFile(id)
}

/** Même marché, autre timeframe (en minutes) ; null si la source ne l'a pas. */
export function withTimeframe(id: string | undefined, tfMin: number): string | null {
  const iv = tfMin < 60 ? `${tfMin}m` : tfMin < 1440 ? `${tfMin / 60}h` : '1d'
  if (id?.startsWith('hl:')) return (HL_INTERVALS as readonly string[]).includes(iv) ? `${id.slice(0, id.lastIndexOf(':'))}:${iv}` : null
  if (id?.startsWith('bn:')) {
    const [, symbol, , since] = id.split(':')
    return (BINANCE_INTERVALS as readonly string[]).includes(iv) ? `bn:${symbol}:${iv}:${since}` : null
  }
  const s = SAMPLES.find(x => x.id === `btc${tfMin}m`)
  return s ? s.id : null
}
