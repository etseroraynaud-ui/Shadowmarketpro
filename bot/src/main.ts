// Programme principal du bot Shock Engine sur Hyperliquid.
//
//   BOT_MODE=shadow  npm start      décisions et trades simulés, aucun ordre (défaut)
//   BOT_MODE=testnet npm start      ordres réels sur le testnet
//   BOT_MODE=mainnet npm start      ordres réels (après shadow et testnet)
//   BOT_RESET_STATE=1               ignore l'état sauvegardé (le compte doit être à plat)
//
// Bougies : à chaque clôture 15 min (signal du WebSocket, avec une horloge de secours si le flux
// est coupé), les bougies closes manquantes sont récupérées par l'API REST, dans l'ordre, puis
// passées au moteur. Aucune bougie en cours n'entre dans le calcul.

import { join } from 'node:path'
import { adaptivePreset } from '../../lib/strategies/shock/live.ts'
import { loadConfig, publicConfig } from './config.ts'
import { CandleFeed, INTERVAL_MS, gapsOf } from './data/candles.ts'
import { HyperliquidData, HyperliquidExchange, HyperliquidStream } from './hl/client.ts'
import { Journal } from './journal.ts'
import { ShadowEngine } from './engine/shadow.ts'
import { LiveEngine } from './engine/live.ts'
import { StateStore } from './engine/state.ts'
import type { Bar } from '../../lib/strategies/shock/live.ts'
import type { Bars } from '../../lib/backtest/types.ts'

interface Engine {
  onBar(bar: Bar, daily?: Bars): void | Promise<void>
  onMid?(mid: number): Promise<void>
  syncFills?(): Promise<void>
}

const STEP = INTERVAL_MS['15m']
/** Délai après la clôture avant de lire la bougie : le temps que l'exchange la finalise. */
const SETTLE_MS = 3000

async function retry<T>(what: string, f: () => Promise<T>, journal: Journal, tries = 6): Promise<T> {
  let wait = 2000
  for (let k = 1; ; k++) {
    try {
      return await f()
    } catch (e) {
      if (k >= tries) throw e
      journal.event('retry', { what, attempt: k, error: e instanceof Error ? e.message : String(e) })
      await new Promise(r => setTimeout(r, wait))
      wait = Math.min(wait * 2, 60000)
    }
  }
}

async function main() {
  const cfg = loadConfig()
  const journal = new Journal(cfg.logDir, cfg.mode)
  // Données : celles du réseau où le bot trade (testnet : son propre marché).
  const dataTestnet = (process.env.BOT_DATA_NETWORK ?? (cfg.mode === 'testnet' ? 'testnet' : 'mainnet')) === 'testnet'
  const network = dataTestnet ? 'testnet' : 'mainnet'
  journal.event('start', { ...publicConfig(cfg), dataNetwork: network })

  const data = new HyperliquidData(dataTestnet)
  const asset = await retry('meta', () => data.assetInfo(cfg.coin), journal)
  const shock = adaptivePreset(15, asset.tick)
  journal.event('strategy', { preset: 'adaptive volatility 15 min', mintick: asset.tick, sets: shock.sets.length })

  const feed = new CandleFeed(data, cfg.coin, join(cfg.dataDir, network))
  await retry('candles', () => feed.sync(Date.now()), journal)
  const gaps = gapsOf(feed.chart.all as Bar[], STEP)
  journal.event('history', { bars: feed.chart.all.length, days: feed.daily.all.length, gaps: gaps.length, from: new Date(feed.chart.all[0]?.t ?? 0).toISOString() })

  let engine: Engine
  if (cfg.mode === 'shadow') {
    const costs = { capital: cfg.shadowCapital, qtyPct: cfg.equityPct, commissionPct: cfg.shadowFeePct, slippageTicks: 0, slippagePct: 0, mintick: asset.tick, leverage: cfg.leverage, maintenancePct: 0.5, fundingPct: 0 }
    engine = new ShadowEngine(shock, costs, feed.chartBars(), feed.dailyBars(), journal)
  } else {
    const exchange = await retry('exchange', () => HyperliquidExchange.connect({ testnet: cfg.mode === 'testnet', coin: cfg.coin, account: cfg.account!, agentKey: cfg.agentKey! }), journal)
    const live = await LiveEngine.start({
      cfg, shock, exchange, journal, network: cfg.mode === 'testnet' ? 'testnet' : 'mainnet',
      store: new StateStore(join(cfg.stateDir, `live-${cfg.mode}-${cfg.coin}.json`)), resetState: process.env.BOT_RESET_STATE === '1',
    }, feed.chartBars(), feed.dailyBars())
    journal.event('live_phase', { phase: live.phase, halted: live.halted })
    engine = live
  }

  // Une seule lecture de bougies à la fois ; une demande pendant une lecture est rejouée après.
  let busy = false
  let again = false
  const tick = async () => {
    if (busy) { again = true; return }
    busy = true
    try {
      const { added, dailyChanged } = await retry('candles', () => feed.sync(Date.now()), journal)
      const daily = dailyChanged ? feed.dailyBars() : undefined
      for (const b of added) await engine.onBar(b, daily)
    } catch (e) {
      journal.event('error', { where: 'tick', error: e instanceof Error ? e.stack ?? e.message : String(e) })
    } finally {
      busy = false
      if (again) { again = false; void tick() }
    }
  }

  // Horloge de secours : juste après chaque clôture 15 min.
  let timer: NodeJS.Timeout
  const schedule = () => {
    const wait = Math.ceil((Date.now() + 1) / STEP) * STEP + SETTLE_MS - Date.now()
    timer = setTimeout(() => { void tick(); schedule() }, wait)
  }
  schedule()

  // WebSocket : une nouvelle bougie qui s'ouvre signale la clôture de la précédente.
  const stream = new HyperliquidStream(dataTestnet)
  let openT = -Infinity
  await stream.onCandle(cfg.coin, t => {
    if (t > openT) {
      const first = openT === -Infinity
      openT = t
      if (!first) setTimeout(() => void tick(), SETTLE_MS)
    }
  })
  if (engine.onMid) {
    const onMid = engine.onMid.bind(engine)
    await stream.onMid(cfg.coin, mid => { onMid(mid).catch(e => journal.event('error', { where: 'mid', error: String(e) })) })
  }
  const fillsTimer = engine.syncFills ? setInterval(() => { engine.syncFills!().catch(e => journal.event('error', { where: 'fills', error: String(e) })) }, 15000) : null

  const stop = async (sig: string) => {
    journal.event('stop', { signal: sig })
    clearTimeout(timer)
    if (fillsTimer) clearInterval(fillsTimer)
    await stream.close().catch(() => undefined)
    process.exit(0)
  }
  process.on('SIGINT', () => void stop('SIGINT'))
  process.on('SIGTERM', () => void stop('SIGTERM'))
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
