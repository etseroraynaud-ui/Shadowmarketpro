// Un backtest du Shock Engine.
//
//   node research/shock/run.ts --tf 5 [--from 2017-01-01] [--to 2026-10-01] [--costs script|realistic]
//                              [--preset user2026] [--set kMain=2.4 --set useFlipExit=false ...] [--trades trades.csv]

import { writeFileSync } from 'node:fs'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'
import { makeMarket, runShock } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, REALISTIC_COSTS, USER_2026, withParams } from '../../lib/strategies/shock/params.ts'

export function parseArgs(argv: string[]) {
  const a: Record<string, string> = {}
  const sets: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) continue
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    if (k === '--set') {
      const [kk, vv] = v.split('=')
      sets[kk] = vv
    } else a[k.slice(2)] = v
  }
  return { a, sets }
}

function main() {
  const { a, sets } = parseArgs(process.argv.slice(2))
  const tf = Number(a.tf ?? 5)
  const bars = loadBtc(tf)
  const m = makeMarket(bars, tf, loadBtc(60))
  const start = indexAtOrAfter(bars, dayMs(a.from ?? '2017-01-01'))
  const end = a.to ? indexAtOrAfter(bars, dayMs(a.to)) - 1 : bars.n - 1
  const p = withParams(a.preset === 'user2026' ? withParams(DEFAULT_PARAMS, USER_2026) : DEFAULT_PARAMS, sets)
  const costs = a.costs === 'realistic' ? REALISTIC_COSTS : SCRIPT_COSTS
  const t0 = performance.now()
  const r = runShock(m, p, costs, start, end)
  const ms = performance.now() - t0
  const mt = metricsOf(bars, r)
  const days = (bars.t[end] - bars.t[start]) / 86400000
  console.log(`BTC ${tf}m ${new Date(bars.t[start]).toISOString().slice(0, 10)} → ${new Date(bars.t[end]).toISOString().slice(0, 10)} · coûts ${a.costs ?? 'script'} · ${ms.toFixed(0)} ms`)
  console.log(`rendement ${pct(mt.totalReturn)} · CAGR ${pct(mt.cagr)} · max DD ${pct(mt.maxDrawdown)} · Sharpe ${num(mt.sharpe)} · PF ${num(mt.profitFactor)}`)
  const tvTrades = r.positions.reduce((k, q) => k + q.exits.length, 0)
  console.log(`trades façon TradingView (une ligne par sortie, partielles comprises) : ${tvTrades}`)
  console.log(`positions ${mt.trades} (${(mt.trades / days).toFixed(2)}/jour) · longs ${mt.longTrades} · shorts ${mt.shortTrades} · gagnantes ${pct(mt.winRate)} · moyenne ${pct(mt.avgTradePct, 3)} · frais ${num(mt.fees, 0)}`)
  if (a.trades) {
    const lines = ['entry_time,dir,tag,entry,exit_time,exit,pnl,pnl_pct,exits,mae_atr,mfe_atr']
    for (const q of r.positions) {
      lines.push([
        new Date(bars.t[q.entryIdx]).toISOString(), q.dir, q.tag, q.entryPrice.toFixed(2), new Date(bars.t[q.exitIdx]).toISOString(),
        q.exitPrice.toFixed(2), q.pnl.toFixed(2), (q.pnlPct * 100).toFixed(4), q.exits.join('+'), q.maeAtr.toFixed(2), q.mfeAtr.toFixed(2),
      ].join(','))
    }
    writeFileSync(a.trades, lines.join('\n') + '\n')
    console.log(`trades -> ${a.trades}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
