// Backtest de recherche (Bitstamp BTC/USD spot) contre données du bot (Hyperliquid BTC perp) sur
// la même période : écart des prix, signaux et trades du même préréglage sur chaque source.
// Mesure ce que le changement de marché fait à la stratégie (la parité du moteur, elle, est
// vérifiée par npm run parity sur une seule source).
//
//   npm run source-compare -- [--data-dir bot/data/mainnet]

import { join, resolve } from 'node:path'
import { loadBtc } from '../../../research/lib/data.ts'
import { resample, sliceBars } from '../../../lib/backtest/data.ts'
import type { Bars } from '../../../lib/backtest/types.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import type { Decision } from '../../../lib/strategies/shock/strategy.ts'
import { adaptivePreset, marketFor, selectFor } from '../../../lib/strategies/shock/live.ts'
import { CandleStore, toBars } from '../data/candles.ts'
import type { Bar } from '../../../lib/strategies/shock/live.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const dir = resolve(opt('data-dir', join(import.meta.dirname, '../../data/mainnet')))
const M15 = 15 * 60000
const iso = (t: number) => new Date(t).toISOString().slice(0, 16) + 'Z'

const hl15 = toBars(new CandleStore(join(dir, 'BTC-15m.csv')).all as Bar[])
const hlDay = toBars(new CandleStore(join(dir, 'BTC-1d.csv')).all as Bar[])
const bs15all = loadBtc(15)
const from = Math.max(hl15.t[0], bs15all.t[0])
const to = Math.min(hl15.t[hl15.n - 1], bs15all.t[bs15all.n - 1])
const hl = sliceBars(hl15, from, to)
const bs = sliceBars(bs15all, from, to)
const bsDay = sliceBars(resample(loadBtc(60), 86400000), 0, to)

// Prix : bougies communes (même heure d'ouverture).
const idx = new Map<number, number>()
for (let i = 0; i < bs.n; i++) idx.set(bs.t[i], i)
let common = 0, absBps = 0, maxBps = 0, retDiff = 0, sameDir = 0
let pa = NaN, pb = NaN
for (let i = 0; i < hl.n; i++) {
  const j = idx.get(hl.t[i])
  if (j == null) continue
  common++
  const d = Math.abs(hl.c[i] / bs.c[j] - 1) * 1e4
  absBps += d
  maxBps = Math.max(maxBps, d)
  if (Number.isFinite(pa)) {
    const ra = hl.c[i] / pa - 1
    const rb = bs.c[j] / pb - 1
    retDiff += Math.abs(ra - rb) * 1e4
    if (Math.sign(ra) === Math.sign(rb)) sameDir++
  }
  pa = hl.c[i]
  pb = bs.c[j]
}

function run(bars: Bars, daily: Bars) {
  const shock = adaptivePreset(15, 1)
  const m = marketFor(bars, 15, 1)
  const sel = selectFor(shock, m, daily)
  const ds: Decision[] = []
  const costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: 1, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
  const r = simulate(m, shock.sets, costs, 0, bars.n - 1, sel.select, undefined, (i, d) => { ds[i] = structuredClone(d) })
  const entries = new Map<number, string>()
  ds.forEach((d, i) => { if (d?.long) entries.set(bars.t[i], 'long'); if (d?.short) entries.set(bars.t[i], 'short') })
  return { r, entries, agitated: sel.agitated! }
}

const A = run(hl, hlDay)
const B = run(bs, bsDay)
let regimeSame = 0, regimeBoth = 0
for (let i = 0; i < hl.n; i++) {
  const j = idx.get(hl.t[i])
  if (j == null) continue
  const x = A.agitated[i], y = B.agitated[j]
  if (Number.isFinite(x) && Number.isFinite(y)) { regimeBoth++; if (x === y) regimeSame++ }
}
const both = [...A.entries].filter(([t, s]) => B.entries.get(t) === s)
const near = [...A.entries].filter(([t, s]) => B.entries.get(t) !== s && [-M15, M15, -2 * M15, 2 * M15].some(d => B.entries.get(t + d) === s))
const trade = (p: { dir: number; entryIdx: number; exitIdx: number; pnlPct: number; exits: string[] }, b: Bars) => `${iso(b.t[p.entryIdx] + M15)} ${p.dir === 1 ? 'long ' : 'short'} → ${iso(b.t[p.exitIdx] + M15)} ${(p.pnlPct * 100).toFixed(2)} % ${p.exits.join('+')}`
const pnl = (ps: { pnl: number }[]) => ps.reduce((a, p) => a + p.pnl, 0)

console.log(`Période commune : ${iso(from)} → ${iso(to + M15)} ; ${hl.n} bougies Hyperliquid, ${bs.n} Bitstamp, ${common} communes`)
console.log(`Clôtures : écart moyen ${(absBps / common).toFixed(2)} pb, maximal ${maxBps.toFixed(1)} pb ; rendements 15 min : écart moyen ${(retDiff / (common - 1)).toFixed(2)} pb, même sens ${(100 * sameDir / (common - 1)).toFixed(1)} %`)
console.log(`Régime de volatilité identique sur ${(100 * regimeSame / regimeBoth).toFixed(1)} % des bougies`)
console.log(`Signaux d'entrée : Hyperliquid ${A.entries.size}, Bitstamp ${B.entries.size}, identiques (même bougie, même sens) ${both.length}, décalés de 1-2 bougies ${near.length}`)
console.log(`Trades : Hyperliquid ${A.r.positions.length} (PnL ${pnl(A.r.positions).toFixed(0)} $), Bitstamp ${B.r.positions.length} (PnL ${pnl(B.r.positions).toFixed(0)} $), capital de départ 10 000 $`)
console.log('\nHyperliquid :')
for (const p of A.r.positions) console.log('  ' + trade(p, hl) + (B.entries.get(hl.t[p.entryIdx]) === (p.dir === 1 ? 'long' : 'short') ? '   = Bitstamp' : ''))
console.log('Bitstamp :')
for (const p of B.r.positions) console.log('  ' + trade(p, bs) + (A.entries.get(bs.t[p.entryIdx]) === (p.dir === 1 ? 'long' : 'short') ? '   = Hyperliquid' : ''))
