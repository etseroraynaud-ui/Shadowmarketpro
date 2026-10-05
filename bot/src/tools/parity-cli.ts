// Parité sur l'historique Hyperliquid : bougies du cache (complété par l'API), puis checkParity.
//
//   npm run parity -- [--steps 2000] [--network mainnet|testnet] [--no-sync]

import { join } from 'node:path'
import { adaptivePreset } from '../../../lib/strategies/shock/live.ts'
import { loadConfig } from '../config.ts'
import { CandleFeed } from '../data/candles.ts'
import { HyperliquidData } from '../hl/client.ts'
import { handoffCosts } from '../engine/live.ts'
import { checkParity } from './parity.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const cfg = loadConfig({ ...process.env, BOT_MODE: 'shadow' })
const network = opt('network', 'mainnet')
const data = new HyperliquidData(network === 'testnet')
const feed = new CandleFeed(data, cfg.coin, join(cfg.dataDir, network))
let tick = Number(opt('tick', 'NaN'))
if (!args.includes('--no-sync')) {
  await feed.sync(Date.now())
  if (!Number.isFinite(tick)) tick = (await data.assetInfo(cfg.coin)).tick
}
if (!Number.isFinite(tick)) tick = 1
const chart = feed.chartBars()
const shock = adaptivePreset(15, tick)
const steps = Math.min(Number(opt('steps', '2000')), chart.n - 1)
console.log(`Hyperliquid ${network} ${cfg.coin} : ${chart.n} bougies 15 min, ${feed.daily.all.length} jours ; ${steps} bougies jouées une à une`)
const r = checkParity(shock, handoffCosts(cfg, shock), chart, feed.dailyBars(), steps)
console.log(JSON.stringify(r, (_k, v) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v), 2))
console.log(r.ok ? 'PARITÉ : identique' : 'PARITÉ : DIFFÉRENCES (voir ci-dessus)')
process.exit(r.ok ? 0 : 1)
