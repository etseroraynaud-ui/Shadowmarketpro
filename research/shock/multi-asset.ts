// Shock Engine sur plusieurs actifs Hyperliquid (BTC, ETH, actions HIP-3 comme xyz:NVDA) :
// parité bot / backtest, puis backtest du préréglage adaptatif 15 min, réglé sur BTC et appliqué
// tel quel aux autres actifs (aucun réglage refait : c'est un test hors échantillon).
//
//   node research/shock/multi-asset.ts [BTC ETH xyz:NVDA]   (données : research/data/fetch-hyperliquid.ts)

import { writeFileSync } from 'node:fs'
import { CandleStore, toBars } from '../../bot/src/data/candles.ts'
import { tickOf } from '../../bot/src/hl/client.ts'
import { checkParity } from '../../bot/src/tools/parity.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'
import type { Bar } from '../../lib/strategies/shock/live.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'

const SZ_DECIMALS: Record<string, number> = { BTC: 5, ETH: 4, 'xyz:NVDA': 3, 'xyz:TSLA': 3, 'xyz:AAPL': 3 }
const coins = process.argv.slice(2).length ? process.argv.slice(2) : ['BTC', 'ETH', 'xyz:NVDA']
const dir = new URL('../data/hyperliquid', import.meta.url).pathname
/** Préchauffage des indicateurs (lambda : EMA 150 puis percentile sur 300 barres) avant de compter. */
const WARMUP = 1000

const lines: string[] = [
  '# Shock Engine sur plusieurs actifs Hyperliquid', '',
  'Préréglage **Adaptatif volatilité · 15 min**, réglé sur BTC (Bitstamp 2017-2026) et appliqué **sans aucun réglage refait** aux autres actifs : pour ETH et NVIDIA, c\'est un test hors échantillon de la stratégie.', '',
  'Données Hyperliquid : les 5000 dernières bougies 15 min (environ 52 jours, limite de l\'API) et le journalier pour le régime de volatilité. Frais : 0,045 % par ordre (taker, palier de base), sans levier ni financement. Les ' + WARMUP + ' premières barres servent au préchauffage des indicateurs.', '',
  '**Attention** : quelques semaines et une poignée de trades ne permettent aucune conclusion statistique. Ces chiffres vérifient que tout fonctionne sur chaque actif ; la mesure d\'un edge demande des mois de données (le cache du bot s\'allonge à chaque lancement, et l\'historique Binance complet est prévu).', '',
  '| Actif | Période | Parité bot / backtest | Trades | Rendement | Achat conservé | Pire baisse | Trades gagnants | Profit factor | Régime agité |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
]
for (const coin of coins) {
  const file = coin.replace(/[^A-Za-z0-9._-]/g, '_')
  const chart = toBars(new CandleStore(`${dir}/${file}-15m.csv`).all as Bar[])
  const daily = toBars(new CandleStore(`${dir}/${file}-1d.csv`).all as Bar[])
  const tick = tickOf(chart.c[chart.n - 1], SZ_DECIMALS[coin] ?? 2)
  const cfg = adaptivePreset(15, tick)
  const costs: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: tick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
  const par = checkParity(cfg, costs, chart, daily, 2000)
  const m = marketFor(chart, 15, tick)
  const { select, agitated } = selectFor(cfg, m, daily)
  const r = simulate(m, cfg.sets, costs, WARMUP, chart.n - 1, select)
  const mt = metricsOf(chart, r)
  const bh = chart.c[chart.n - 1] / chart.c[WARMUP] - 1
  let agi = 0, known = 0
  for (let i = WARMUP; i < chart.n; i++) if (agitated && Number.isFinite(agitated[i])) { known++; agi += agitated[i] }
  const ref = simulate(m, [DEFAULT_PARAMS], costs, WARMUP, chart.n - 1)
  const day = (t: number) => new Date(t).toISOString().slice(0, 10)
  console.log(`${coin.padEnd(9)} parité ${par.ok ? 'OK' : 'ÉCART'} (${par.decisions} décisions, ${par.signals} signaux) · adaptatif : ${mt.trades} trades, ${pct(mt.totalReturn)} (achat conservé ${pct(bh)}), pire baisse ${pct(mt.maxDrawdown)}, PF ${num(mt.profitFactor)} · script par défaut : ${metricsOf(chart, ref).trades} trades, ${pct(metricsOf(chart, ref).totalReturn)}`)
  if (!par.ok) console.log(JSON.stringify(par, null, 1))
  lines.push(`| ${coin} | ${day(chart.t[WARMUP])} → ${day(chart.t[chart.n - 1])} | ${par.ok ? `identique (${par.decisions} décisions)` : '**écart**'} | ${mt.trades} | ${pct(mt.totalReturn)} | ${pct(bh)} | ${pct(mt.maxDrawdown)} | ${mt.trades ? pct(mt.winRate, 0) : '—'} | ${mt.trades ? num(mt.profitFactor) : '—'} | ${known ? pct(agi / known, 0) : '—'} |`)
}
const out = new URL('../reports/multi-asset-hyperliquid.md', import.meta.url).pathname
writeFileSync(out, lines.join('\n') + '\n')
console.log('rapport :', out)
