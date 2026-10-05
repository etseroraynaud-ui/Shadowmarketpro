// Rejeu de l'historique Hyperliquid à travers le moteur live complet et l'exchange papier, comparé
// trade par trade au backtest (broker simulé) sur les mêmes bougies.
//
// Dans chaque bougie, le BBO suit le trajet que suppose le backtest (ouverture, extrême le plus
// proche, autre extrême, clôture), découpé en petits pas, avec un spread fixe. Le moteur live voit
// ce BBO comme en réel : ordres au marché à l'acheteur / au vendeur, stops déclenchés au prix moyen
// et exécutés de l'autre côté, TP1 au prix limite, stop suiveur avec les réglages de production
// (pas minimal, intervalle). Les écarts restants viennent de l'exécution, pas de la stratégie.
//
//   npm run paper-replay -- [--data-dir bot/data/mainnet] [--spread 1] [--steps 20] [--bars 4900]

import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { Bars } from '../../../lib/backtest/types.ts'
import { adaptivePreset, marketFor, selectFor } from '../../../lib/strategies/shock/live.ts'
import type { Bar } from '../../../lib/strategies/shock/live.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { loadConfig } from '../config.ts'
import { CandleStore, toBars } from '../data/candles.ts'
import { midOf } from '../data/quotes.ts'
import { PaperExchange } from '../exec/paper.ts'
import { LiveEngine, handoffCosts } from '../engine/live.ts'
import { StateStore } from '../engine/state.ts'
import { Journal } from '../journal.ts'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const dataDir = resolve(opt('data-dir', join(import.meta.dirname, '../../data/mainnet')))
const spread = Number(opt('spread', '1'))
const steps = Number(opt('steps', '20'))
const M15 = 15 * 60000
const iso = (t: number) => new Date(t).toISOString().slice(0, 16) + 'Z'

const chart = toBars(new CandleStore(join(dataDir, 'BTC-15m.csv')).all as Bar[])
const daily = toBars(new CandleStore(join(dataDir, 'BTC-1d.csv')).all as Bar[])
const bars = Math.min(Number(opt('bars', String(chart.n - 100))), chart.n - 100)
const k0 = chart.n - bars
const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

const dir = mkdtempSync(join(tmpdir(), 'paper-replay-'))
// Réglages de production, sans plafond de taille (comparaison avec le backtest à 100 % du capital).
const cfg = loadConfig({ BOT_MODE: 'shadow', BOT_STATE_DIR: dir, BOT_LOG_DIR: dir, BOT_DATA_DIR: dir, BOT_MAX_NOTIONAL_USD: '10000000', ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('BOT_TRAIL') || k === 'BOT_MAX_SPREAD_BPS')) })
const shock = adaptivePreset(15, 1)
const clock = { t: chart.t[k0 - 1] + M15 }
const quote = (px: number, t: number) => ({ bid: px - spread / 2, ask: px + spread / 2, bidSz: 10, askSz: 10, time: t, recv: t, source: 'paper' as const })
const journal = new Journal(dir, 'shadow', true, 'paper')
let eng: LiveEngine
const ex = new PaperExchange({
  asset: { index: 0, szDecimals: 5, maxLeverage: 40, tick: 1, dex: '', isCross: true }, capital: 10000, takerFeePct: 0.045, makerFeePct: 0.015,
  fallbackQuote: async () => quote(chart.c[k0 - 1], clock.t), now: () => clock.t,
})
ex.onQuote(quote(chart.c[k0 - 1], clock.t))
eng = await LiveEngine.start({ cfg, shock, exchange: ex, journal, store: new StateStore(join(dir, 'state.json')), network: 'mainnet', resetState: true, now: () => clock.t, sleep: async () => {} }, head(chart, k0), daily)

for (let i = k0; i < chart.n; i++) {
  const o = chart.o[i], h = chart.h[i], l = chart.l[i], c = chart.c[i]
  const path = h - o < o - l ? [o, h, l, c] : [o, l, h, c]
  const pts: number[] = [o]
  for (let k = 1; k < path.length; k++) for (let s = 1; s <= steps; s++) pts.push(Math.round(path[k - 1] + ((path[k] - path[k - 1]) * s) / steps))
  for (const [k, px] of pts.entries()) {
    clock.t = chart.t[i] + 1000 + Math.floor((k * (M15 - 5000)) / pts.length)
    const before = ex.log.length
    ex.onQuote(quote(px, clock.t))
    if (ex.log.length > before) await eng.syncFills()
    await eng.onMid(midOf(quote(px, clock.t)))
  }
  clock.t = chart.t[i] + M15 + 3000
  ex.onQuote(quote(c, clock.t))
  await eng.onBar({ t: chart.t[i], o, h, l, c, v: chart.v[i] })
}

const m = marketFor(chart, 15, 1)
const ref = simulate(m, shock.sets, handoffCosts(cfg, shock), 0, chart.n - 1, selectFor(shock, m, daily).select)
const csv = readFileSync(join(dir, 'trades-shadow-paper.csv'), 'utf8').trim().split('\n')
const cols = csv[0].split(',')
const live = csv.slice(1).map(r => Object.fromEntries(r.split(',').map((v, k) => [cols[k], v])))
const firstLive = live.length ? Date.parse(live[0].entryTime) : Infinity
const bt = ref.positions.filter(p => chart.t[p.entryIdx] + M15 >= firstLive && p.exitIdx < chart.n - 1)
const key = (t: string, side: string) => `${t.slice(0, 16)} ${side}`
const btBy = new Map(bt.map(p => [key(new Date(chart.t[p.entryIdx] + M15).toISOString(), p.dir === 1 ? 'long' : 'short'), p]))
let same = 0, sameExit = 0, entryBps = 0, exitBps = 0, pnlLive = 0, pnlBt = 0
console.log(`Rejeu de ${bars} bougies Hyperliquid (${iso(chart.t[k0])} → ${iso(chart.t[chart.n - 1] + M15)}), spread ${spread} $, ${steps} pas par segment, stop suiveur : pas ${cfg.trailStepPct} %, ${cfg.trailMinIntervalMs} ms`)
console.log(`Moteur live : ${live.length} trades ; backtest : ${bt.length} trades sur la même période ; arrêt : ${eng.halted ?? 'aucun'}`)
for (const t of live) {
  const p = btBy.get(key(t.entryTime, t.side))
  const tag = p ? (p.exits.join('+') === t.exits ? 'mêmes sorties' : `sorties ${t.exits} / backtest ${p.exits.join('+')}`) : 'ABSENT DU BACKTEST'
  if (p) {
    same++
    if (p.exits.join('+') === t.exits) sameExit++
    entryBps += Math.abs(Number(t.entry) / p.entryPrice - 1) * 1e4
    exitBps += Math.abs(Number(t.exit) / p.exitPrice - 1) * 1e4
    pnlBt += p.pnlPct * 100
  }
  pnlLive += Number(t.pnlPct) * 100
  console.log(`  ${t.entryTime.slice(0, 16)} ${t.side.padEnd(5)} entrée ${t.entry}${p ? ` (bt ${p.entryPrice})` : ''} sortie ${(+t.exit).toFixed(1)}${p ? ` (bt ${p.exitPrice.toFixed(1)})` : ''} ${(Number(t.pnlPct) * 100).toFixed(2)} %${p ? ` (bt ${(p.pnlPct * 100).toFixed(2)} %)` : ''} — ${tag}`)
}
for (const [k, p] of btBy) if (!live.some(t => key(t.entryTime, t.side) === k)) console.log(`  ${k} : trade du backtest ABSENT du moteur live (${p.exits.join('+')})`)
console.log(`\nMêmes entrées (bougie et sens) : ${same}/${Math.max(live.length, bt.length)} ; mêmes motifs de sortie : ${sameExit}/${same}`)
if (same) console.log(`Écart moyen : entrée ${(entryBps / same).toFixed(2)} pb, sortie ${(exitBps / same).toFixed(2)} pb ; somme des PnL % : live ${pnlLive.toFixed(2)}, backtest ${pnlBt.toFixed(2)}`)
