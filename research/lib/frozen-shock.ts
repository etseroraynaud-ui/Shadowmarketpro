// Shock Engine figé, sleeves BTC et ETH : exactement le chemin de research/shock/zero-shot.ts
// (préréglage du bot, entrées complètes, coûts × k), sans rien ajouter ni réestimer.
//
// Ce module ne fait que charger les mêmes données et appeler le même moteur avec les mêmes
// arguments que zero-shot.ts : mêmes fichiers, même préchauffage, même début de simulation, même
// régime de volatilité (journées closes), même masque des bougies qui suivent un trou, mêmes coûts
// (commission 0,045 % par ordre, glissement nul pour BTC et ETH, capital 10 000, 100 % de
// l'equity, sans levier ni financement). research/shock/portfolio.ts vérifie que le résultat est
// identique aux rapports validés (shock-15m-zeroshot-{btc,ethusdt}.json) avant tout calcul.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBtc } from './data.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import type { ShockConfig } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../lib/strategies/shock/broker.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DAY = 864e5
const M15 = 15 * 60000

export type SleeveKey = 'btc' | 'ethusdt'

/** Copie des lignes `btc` et `ethusdt` de la table ASSETS de zero-shot.ts. */
export const SLEEVES: Record<SleeveKey, { label: string; venue: string; mintick: number; slipPct: number; start: string; warm: string; file: string; validated: string }> = {
  btc: { label: 'BTC/USD', venue: 'Bitstamp spot', mintick: 1, slipPct: 0, start: '2017-01-01', warm: '2016-01-01', file: 'research/data/btcusd_15m.csv.gz', validated: 'research/reports/shock-15m-zeroshot-btc.json' },
  ethusdt: { label: 'ETH/USDT', venue: 'Binance spot', mintick: 0.01, slipPct: 0, start: '2018-09-01', warm: '2017-08-17', file: 'research/data/ethusdt_15m.csv.gz', validated: 'research/reports/shock-15m-zeroshot-ethusdt.json' },
}

/** Coûts de zero-shot.ts : COSTS(k). */
export const costsFor = (key: SleeveKey, k: number): Costs => ({
  capital: 10000, qtyPct: 100, commissionPct: 0.045 * k, slippageTicks: 0, slippagePct: SLEEVES[key].slipPct * k,
  mintick: SLEEVES[key].mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0,
})

/** Lecteur CSV de zero-shot.ts (horodatage ms UTC à l'ouverture, o, h, l, c, v). */
function loadCsv(path: string): Bars {
  const raw = readFileSync(path)
  const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('latin1')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  for (const s of text.split('\n')) {
    if (!s || !/^\d/.test(s)) continue
    const p = s.split(',')
    const ts = +p[0]
    if (t.length && ts <= t[t.length - 1]) continue
    t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0))
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

export interface Sleeve {
  key: SleeveKey
  bars: Bars
  m: Market
  preset: ShockConfig
  select: Int8Array
  /** Première et dernière barre simulées (zero-shot.ts : lo, end). */
  lo: number
  end: number
  /** Entrées du préréglage, bougie qui suit un trou exclue (zero-shot.ts : signals(preset)). */
  signals: { long: Uint8Array; short: Uint8Array }
  run: (k: number) => ShockResult
}

/** Données, préréglage, régime et signaux d'une sleeve, comme zero-shot.ts les construit. */
export function loadSleeve(key: SleeveKey): Sleeve {
  const A = SLEEVES[key]
  let bars: Bars, daily: Bars
  if (key === 'btc') {
    const all = loadBtc(15)
    bars = sliceBars(all, Date.parse(A.warm), all.t[all.n - 1])
    daily = resample(loadBtc(60), DAY)
  } else {
    const all = loadCsv(join(ROOT, A.file))
    bars = sliceBars(all, Date.parse(A.warm), all.t[all.n - 1])
    daily = resample(bars, DAY)
  }
  const n = bars.n
  const t = bars.t
  let lo = 0, hi = n
  const at = Date.parse(A.start)
  while (lo < hi) { const md = (lo + hi) >> 1; if (t[md] < at) lo = md + 1; else hi = md }
  const end = n - 1
  const m = marketFor(bars, 15, A.mintick)
  const preset = adaptivePreset(15, A.mintick)
  const select = selectFor(preset, m, daily).select!
  const prs = preset.sets.map(p => prepare(m, p))
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = lo; i <= end; i++) {
    const e = select[i]
    const gap = i > 0 && t[i] - t[i - 1] > M15
    if (e < 0 || gap) continue
    const P = preset.sets[e], R = prs[e]
    if (P.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (P.allowShort && R.impulseEntryShort[i]) short[i] = 1
  }
  const signals = { long, short }
  return { key, bars, m, preset, select, lo, end, signals, run: (k: number) => simulate(m, preset.sets, costsFor(key, k), lo, end, select, signals) }
}

/** Run du moteur avec, à chaque clôture, la position en monnaie et les coûts cumulés. */
export interface Detailed {
  equity: Float64Array
  position: Int8Array
  positions: PositionRecord[]
  /** Nominal signé de la position à la clôture (quantité × clôture × sens). */
  notional: Float64Array
  /** Commissions payées depuis le début du run (positions fermées + position ouverte). */
  cumFees: Float64Array
  /** Nominal des entrées et valeur des sorties exécutées depuis le début du run. */
  cumEntry: Float64Array
  cumExit: Float64Array
  start: number
  end: number
}

/**
 * La boucle de simulate() (engine.ts), barre par barre, qui lit en plus l'état du broker à chaque
 * clôture. `start` : première barre simulée (par défaut celle de zero-shot.ts). portfolio.ts
 * vérifie que l'equity est identique à celle de simulate().
 */
export function runDetailed(s: Sleeve, k: number, start = s.lo): Detailed {
  const { m, end } = s
  const n = m.bars.n
  const c = m.bars.c
  const costs = costsFor(s.key, k)
  const strategy = new ShockStrategy(m, s.preset.sets, costs.mintick, s.select, s.signals)
  const broker = new SimBroker(m, s.preset.sets, costs, (set, i) => strategy.prs[set].atr[i])
  const equity = new Float64Array(n), position = new Int8Array(n), notional = new Float64Array(n)
  const cumFees = new Float64Array(n), cumEntry = new Float64Array(n), cumExit = new Float64Array(n)
  for (let i = 0; i < start; i++) equity[i] = costs.capital
  let seen = 0, fees = 0, entry = 0, exit = 0
  for (let i = start; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    broker.afterClose(i, d, last)
    position[i] = broker.dir()
    equity[i] = broker.capitalNow(i)
    while (seen < broker.positions.length) { const p = broker.positions[seen++]; fees += p.fees; entry += p.notional; exit += p.exitPrice * p.qty }
    const q = broker.pos
    notional[i] = q ? q.dir * q.qty * c[i] : 0
    cumFees[i] = fees + (q ? q.fees : 0)
    cumEntry[i] = entry + (q ? q.notional : 0)
    cumExit[i] = exit + (q ? q.exitValue : 0)
  }
  for (let i = end + 1; i < n; i++) { equity[i] = equity[end]; cumFees[i] = cumFees[end]; cumEntry[i] = cumEntry[end]; cumExit[i] = cumExit[end] }
  return { equity, position, positions: broker.positions, notional, cumFees, cumEntry, cumExit, start, end }
}
