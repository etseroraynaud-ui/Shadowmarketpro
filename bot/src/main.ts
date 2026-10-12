// Programme principal du bot Shock Engine sur Hyperliquid.
//
//   BOT_MODE=shadow  npm start      aucun ordre : backtest pas à pas + moteur live sur exchange
//                                   papier, sur les données réelles (défaut)
//   BOT_MODE=testnet npm start      ordres réels sur le testnet
//   BOT_MODE=mainnet npm start      ordres réels (BOT_ALLOW_MAINNET=1 obligatoire)
//   BOT_RESET_STATE=1               ignore l'état sauvegardé (le compte doit être à plat)
//
// Bougies : à chaque clôture 15 min (dès le premier message WebSocket de la nouvelle bougie, avec une
// horloge de secours à T + 2 s si le flux est muet) et à chaque reconnexion, les bougies closes
// manquantes sont récupérées par l'API REST, dans l'ordre, puis passées au moteur. Aucune bougie en
// cours n'entre dans le calcul : une bougie n'est acceptée que si l'exchange a ouvert la suivante.
// Latence : lectures de l'état du compte lancées en même temps que celle des bougies, connexions
// HTTP ouvertes 1,5 s avant chaque clôture, lecture périodique des fills suspendue autour des clôtures.
// BBO (WebSocket) : stop suiveur, prix de référence des ordres, garde de spread, exchange papier.
// Signal SIGUSR2 : coupe et rétablit le WebSocket (test des reconnexions).
// Derrière un proxy HTTPS (variable HTTPS_PROXY), lancer Node avec NODE_USE_ENV_PROXY=1.

import { join } from 'node:path'
import { adaptivePreset } from '../../lib/strategies/shock/live.ts'
import { loadConfig, publicConfig } from './config.ts'
import { CandleFeed, INTERVAL_MS, gapsOf } from './data/candles.ts'
import { midOf, spreadBps } from './data/quotes.ts'
import { HyperliquidData, HyperliquidExchange, HyperliquidStream } from './hl/client.ts'
import { Journal } from './journal.ts'
import { ShadowEngine, ShadowRunner } from './engine/shadow.ts'
import { LiveEngine } from './engine/live.ts'
import { StateStore } from './engine/state.ts'
import { PaperExchange } from './exec/paper.ts'
import { BotLoop, coalesce } from './runtime.ts'
import type { Engine } from './runtime.ts'
import type { Bar } from '../../lib/strategies/shock/live.ts'

const STEP = INTERVAL_MS['15m']
/** Horloge de secours : lecture à T + 2 s si le WebSocket n'a encore rien signalé. */
const CLOCK_FALLBACK_MS = 2000
/** Connexions HTTP ouvertes 1,5 s avant chaque clôture (fermées par Node après 4 s d'inactivité). */
const WARM_BEFORE_MS = 1500
/** Pas de lecture périodique des fills de T − 3 s à T + 5 s : la clôture a la priorité. */
const nearClose = (now: number) => { const k = now % STEP; return k < 5000 || k > STEP - 3000 }
/** Écart maximal toléré entre l'horloge locale et celle de l'exchange en testnet et mainnet. */
const MAX_CLOCK_SKEW_MS = 5000

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
  const network = cfg.dataNetwork
  journal.event('start', { ...publicConfig(cfg), pid: process.pid })

  // Une seule instance par mode et par actif : deux bots sur le même compte doubleraient les ordres.
  const store = new StateStore(join(cfg.stateDir, `live-${cfg.mode}-${cfg.coin}.json`))
  const unlock = store.lock()

  const data = new HyperliquidData(network === 'testnet')
  const asset = await retry('meta', () => data.assetInfo(cfg.coin), journal)
  const shock = adaptivePreset(15, asset.tick)
  journal.event('strategy', { preset: 'adaptive volatility 15 min', mintick: asset.tick, szDecimals: asset.szDecimals, sets: shock.sets.length, shortTrendFilter: cfg.shortTrendFilter })

  // Horloge : l'heure du carnet de l'exchange, comparée à l'heure locale de réception.
  const book = await retry('book', () => data.book(cfg.coin), journal)
  const skew = book.recv - book.time
  journal.event('clock', { localMinusExchangeMs: skew, bid: book.bid, ask: book.ask, spreadBps: spreadBps(book) })
  if (cfg.mode !== 'shadow' && Math.abs(skew) > MAX_CLOCK_SKEW_MS) throw new Error(`horloge locale décalée de ${skew} ms par rapport à Hyperliquid`)

  const feed = new CandleFeed(data, cfg.coin, join(cfg.dataDir, network))
  await retry('candles', () => feed.sync(Date.now()), journal)
  const gaps = gapsOf(feed.chart.all as Bar[], STEP)
  journal.event('history', { bars: feed.chart.all.length, days: feed.daily.all.length, gaps: gaps.length, from: new Date(feed.chart.all[0]?.t ?? 0).toISOString(), to: new Date(feed.chart.lastTime).toISOString() })

  let engine: Engine
  let warm: (() => void) | null = null
  let account: `0x${string}` | null = null
  let shadow: ShadowRunner | null = null
  if (cfg.mode === 'shadow') {
    const costs = { capital: cfg.shadowCapital, qtyPct: cfg.equityPct, commissionPct: cfg.shadowFeePct, slippageTicks: 0, slippagePct: 0, mintick: asset.tick, leverage: cfg.leverage, maintenancePct: 0.5, fundingPct: 0 }
    const sim = new ShadowEngine(shock, costs, feed.chartBars(), feed.dailyBars(), journal, cfg.shortTrendFilter)
    let paper: LiveEngine | null = null
    let paperEx: PaperExchange | null = null
    if (cfg.shadowPaper) {
      const pj = journal.child('paper')
      let syncSoon: () => void = () => undefined
      paperEx = new PaperExchange({
        asset, capital: cfg.shadowCapital, takerFeePct: cfg.shadowFeePct, makerFeePct: cfg.paperMakerFeePct,
        fallbackQuote: () => data.book(cfg.coin), onFill: f => { pj.event('paper_fill', { oid: f.oid, cloid: f.cloid, side: f.side, px: f.px, sz: f.sz }); syncSoon() },
      })
      paperEx.onQuote(book)
      // L'exchange papier repart à plat à chaque lancement : son état n'est pas repris.
      paper = await LiveEngine.start({
        cfg, shock, exchange: paperEx, journal: pj, network, resetState: true,
        store: new StateStore(join(cfg.stateDir, `paper-${cfg.coin}.json`)),
      }, feed.chartBars(), feed.dailyBars())
      const p = paper
      syncSoon = () => void p.syncFills().catch(e => pj.event('error', { where: 'paper_fills', error: String(e) }))
      pj.event('live_phase', { phase: paper.phase, halted: paper.halted })
    }
    shadow = new ShadowRunner(sim, paper, paperEx, journal)
    engine = shadow
  } else {
    const { exchange, access } = await retry('exchange', () => HyperliquidExchange.connect({ testnet: cfg.mode === 'testnet', coin: cfg.coin, account: cfg.account!, subAccount: cfg.subAccount, agentKey: cfg.agentKey! }), journal)
    journal.event('access', { ...access })
    if (!access.agentListed) journal.event('warning', { what: `l'agent ${access.agent} n'est pas dans les wallets API de ${cfg.account} : les ordres seront refusés` })
    // Compte tradé (le sous-compte s'il y en a un) : ses fills et ordres arrivent par le WebSocket.
    account = exchange.user
    exchange.quotes.update(book)
    const live = await LiveEngine.start({
      cfg, shock, exchange, journal, network: cfg.mode === 'testnet' ? 'testnet' : 'mainnet', store, resetState: process.env.BOT_RESET_STATE === '1',
    }, feed.chartBars(), feed.dailyBars())
    journal.event('live_phase', { phase: live.phase, halted: live.halted })
    const mid = coalesce((m: number) => live.onMid(m), e => journal.event('error', { where: 'mid', error: String(e) }))
    engine = {
      onBar: (b, d) => live.onBar(b, d),
      onQuote: q => { if (exchange.quotes.update(q)) mid(midOf(q)) },
      syncFills: () => live.syncFills(),
      prepareClose: c => live.prepareClose(c),
    }
    warm = () => live.warm()
  }

  const loop = new BotLoop({ feed, engine, journal, settleMs: cfg.settleMs })

  // Horloge de secours : T + 2 s (ou après l'attente configurée), seulement si la bougie n'est pas lue.
  let timer: NodeJS.Timeout
  const schedule = () => {
    const wait = Math.ceil((Date.now() + 1) / STEP) * STEP + Math.max(CLOCK_FALLBACK_MS, cfg.settleMs) - Date.now()
    timer = setTimeout(() => { void loop.tickIfMissing('clock'); schedule() }, wait)
  }
  schedule()
  // Connexions prêtes avant chaque clôture (réel seulement).
  let warmTimer: NodeJS.Timeout
  const scheduleWarm = () => {
    let wait = Math.ceil((Date.now() + 1) / STEP) * STEP - WARM_BEFORE_MS - Date.now()
    if (wait < 0) wait += STEP
    warmTimer = setTimeout(() => { warm?.(); scheduleWarm() }, wait)
  }
  scheduleWarm()

  // WebSocket : bougie en cours (clôtures), BBO, et en réel les événements du compte.
  const stream = new HyperliquidStream(network === 'testnet', e => loop.onStream(e))
  await stream.onCandle(cfg.coin, c => loop.onCandle(c))
  await stream.onBbo(cfg.coin, q => loop.onQuote(q))
  if (account && engine.syncFills) {
    const sync = coalesce(async () => { await new Promise(r => setTimeout(r, 300)); await engine.syncFills!() }, e => journal.event('error', { where: 'fills', error: String(e) }))
    await stream.onAccount(account, kind => { journal.event('account_event', { kind }); sync(undefined) })
  }
  const fillsTimer = engine.syncFills ? setInterval(() => {
    if (nearClose(Date.now())) return
    engine.syncFills!().catch(e => journal.event('error', { where: 'fills', error: String(e) }))
  }, 15000) : null

  // Chien de garde : aucune donnée depuis trop longtemps, la connexion est refaite.
  let lastForced = 0
  const watchdog = setInterval(() => {
    const quiet = Date.now() - stream.lastData
    if (quiet > cfg.wsStaleMs && Date.now() - lastForced > cfg.wsStaleMs) {
      lastForced = Date.now()
      journal.event('ws_stale', { quietMs: quiet })
      stream.reconnect()
    }
  }, 5000)

  // Résumé toutes les heures.
  const summary = setInterval(() => {
    journal.event('heartbeat', { loop: loop.stats, parity: shadow?.parity ?? null, lastBar: new Date(feed.chart.lastTime + STEP).toISOString(), wsOpens: stream.opens, quietMs: Date.now() - stream.lastData })
  }, 3600000)

  process.on('SIGUSR2', () => {
    journal.event('ws_forced_reconnect', { by: 'SIGUSR2' })
    stream.reconnect()
  })

  const stop = async (sig: string) => {
    journal.event('stop', { signal: sig, loop: loop.stats, parity: shadow?.parity ?? null })
    clearTimeout(timer)
    clearTimeout(warmTimer)
    clearInterval(watchdog)
    clearInterval(summary)
    if (fillsTimer) clearInterval(fillsTimer)
    loop.stop()
    await stream.close().catch(() => undefined)
    unlock()
    process.exit(0)
  }
  process.on('SIGINT', () => void stop('SIGINT'))
  process.on('SIGTERM', () => void stop('SIGTERM'))
  process.on('exit', () => unlock())
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
