// Backtest du bot pour la page /live, calculé sur le serveur (route /api/live/backtest) : les
// réglages de la stratégie ne partent jamais dans le JavaScript du navigateur, qui ne reçoit que les
// trades simulés. Ne pas importer depuis un composant client.

import { loadHyperliquid } from '../backtest/datasets'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { shortTrendEntries } from '../../lib/strategies/short-trend.ts'
import { backtestTrips } from '../../lib/hyperliquid/track.ts'
import type { BacktestTrip } from '../../lib/hyperliquid/track.ts'

const M15 = 15 * 60000

export interface LiveBacktest {
  trips: BacktestTrip[]
  bars: number
  from: number
  to: number
}

/** Le backtest du bot : même préréglage, même pas de cotation, mêmes bougies (15 min et journalier). */
export async function botBacktest(coin: string, testnet: boolean, version: 'public' | 'v1', tick: number): Promise<LiveBacktest> {
  const data = await loadHyperliquid(coin, '15m', testnet)
  const shock = adaptivePreset(15, tick)
  const bars = data.bars
  const m = marketFor(bars, 15, shock.mintick)
  const costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: shock.mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
  const select = selectFor(shock, m, data.daily).select
  // Version publique : shorts seulement en régime de tendance journalier baissier, comme le bot.
  const override = version === 'v1' ? undefined : shortTrendEntries(m, shock.sets, select, 15, data.daily)
  const res = simulate(m, shock.sets, costs, 0, bars.n - 1, select, override)
  return { trips: backtestTrips(bars, res.positions, null, M15), bars: bars.n, from: bars.t[0], to: bars.t[bars.n - 1] + M15 }
}
