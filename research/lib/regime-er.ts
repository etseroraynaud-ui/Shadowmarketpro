// Régime directionnel avant le signal (research/preregistration/regime-fakeout.md) : Efficiency Ratio,
// ADX, fréquence des faux départs, percentile causal, actifs (BTC/ETH de référence et 8 actifs
// vierges) et variantes V0–V3 exprimées en listes d'entrées et sélection de jeux, sans toucher au
// moteur. Toutes les mesures de la bougie i n'utilisent que les bougies 0 … i − 1.

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Bars } from '../../lib/backtest/types.ts'
import { highest, lowest, dmi } from '../../lib/backtest/indicators.ts'
import { resample } from '../../lib/backtest/data.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import type { ShockConfig } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import { costsFor, loadSleeve, SLEEVES } from './frozen-shock.ts'
import type { SleeveKey } from './frozen-shock.ts'
import { trendDown } from './e2.ts'
import { loadBtc } from './data.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DAY = 864e5
export const M15 = 15 * 60000

/** Réglages figés de l'étude (§ 3 à § 6 du plan). */
export const CFG = {
  erN: 20,
  erN2: 96,
  adxLen: 14,
  fakeN: 20,
  fakeK: 4,
  fakeWin: 672,
  fakeMin: 10,
  pctWin: 8640,
  pctMin: 2880,
  rangePct: 0.25,
  reentry: [1, 4, 16],
  boot: 10000,
  seed: 20261013,
} as const

// ---------------------------------------------------------------- mesures

/** ER_n connu à la clôture de la bougie i, calculé sur les clôtures i − 1 − n … i − 1 (bougie i exclue). */
export function efficiencyRatio(c: ArrayLike<number>, n: number): Float64Array {
  const len = c.length
  const S = new Float64Array(len)
  for (let k = 1; k < len; k++) S[k] = S[k - 1] + Math.abs(c[k] - c[k - 1])
  const out = new Float64Array(len).fill(NaN)
  for (let i = n + 1; i < len; i++) {
    const den = S[i - 1] - S[i - 1 - n]
    out[i] = den > 0 ? Math.abs(c[i - 1] - c[i - 1 - n]) / den : 0
  }
  return out
}

/** ADX de la bougie i − 1 (bougie i exclue). */
export function adxBefore(b: Bars, len: number): Float64Array {
  const adx = dmi(b.h, b.l, b.c, len, len)[2]
  const out = new Float64Array(b.n).fill(NaN)
  for (let i = 1; i < b.n; i++) out[i] = adx[i - 1]
  return out
}

/**
 * Fréquence des faux départs connue à la clôture de i : parmi les cassures j (clôture au-delà du plus
 * haut ou du plus bas des N bougies j − N … j − 1) des `win` bougies précédentes dont l'issue est
 * connue (j + K ≤ i − 1), part de celles où une des K clôtures suivantes revient de l'autre côté du
 * niveau cassé. NaN si moins de `min` cassures.
 */
export function fakeoutFrequency(b: Bars, N: number, K: number, win: number, min: number): Float64Array {
  const { h, l, c } = b
  const n = b.n
  const hh = highest(h, N), ll = lowest(l, N)
  const brk = new Float64Array(n), fail = new Float64Array(n)
  for (let j = N; j < n; j++) {
    const up = c[j] > hh[j - 1], dn = c[j] < ll[j - 1]
    if (!up && !dn) continue
    brk[j] = 1
    const lvl = up ? hh[j - 1] : ll[j - 1]
    for (let k = 1; k <= K && j + k < n; k++) if (up ? c[j + k] < lvl : c[j + k] > lvl) { fail[j] = 1; break }
  }
  const SB = new Float64Array(n + 1), SF = new Float64Array(n + 1)
  for (let j = 0; j < n; j++) { SB[j + 1] = SB[j] + brk[j]; SF[j + 1] = SF[j] + fail[j] }
  const out = new Float64Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const hi = i - 1 - K // dernière cassure dont l'issue est connue à la clôture de i − 1
    const lo = Math.max(0, i - win)
    if (hi < lo) continue
    const nb = SB[hi + 1] - SB[lo]
    if (nb >= min) out[i] = (SF[hi + 1] - SF[lo]) / nb
  }
  return out
}

/** Percentile causal : part des `win` valeurs précédentes (finies) ≤ x[i] ; NaN si moins de `min`. */
export function causalPct(x: ArrayLike<number>, i: number, win: number, min: number): number {
  const v = x[i]
  if (!Number.isFinite(v)) return NaN
  let cnt = 0, below = 0
  for (let k = Math.max(0, i - win); k < i; k++) {
    const y = x[k]
    if (!Number.isFinite(y)) continue
    cnt++
    if (y <= v) below++
  }
  return cnt >= min ? below / cnt : NaN
}

export const GROUPS = ['Range marqué', 'Range modéré', 'Tendance modérée', 'Tendance forte'] as const
export const groupOf = (pct: number) => (Number.isFinite(pct) ? Math.min(3, Math.floor(pct / 0.25)) : -1)

// ---------------------------------------------------------------- actifs

export interface Asset {
  key: string
  label: string
  /** Actif vierge (réplication, confirmatoire) ou BTC/ETH (développement, descriptif). */
  unseen: boolean
  sleeveKey: SleeveKey | null
  bars: Bars
  m: Market
  preset: ShockConfig
  select: Int8Array
  lo: number
  end: number
  /** Entrées E2 de référence (V0). */
  signals: EntryOverride
  trend: Uint8Array
  costs: (k: number) => Costs
  mintick: number
}

export function referenceAsset(key: SleeveKey): Asset {
  const s = loadSleeve(key)
  const regimeBars = key === 'btc' ? resample(loadBtc(60), DAY) : resample(s.bars, DAY)
  const trend = trendDown(s.bars, regimeBars)
  const signals = { long: s.signals.long, short: Uint8Array.from(s.signals.short, (x, i) => (x && trend[i] ? 1 : 0)) }
  return {
    key: key === 'btc' ? 'BTC' : 'ETH', label: `${SLEEVES[key].label} · ${SLEEVES[key].venue}`, unseen: false, sleeveKey: key,
    bars: s.bars, m: s.m, preset: s.preset, select: s.select, lo: s.lo, end: s.end, signals, trend, costs: k => costsFor(key, k), mintick: SLEEVES[key].mintick,
  }
}

export const UNSEEN = ['XRP', 'BNB', 'DOGE', 'TRX', 'ADA', 'LINK', 'XLM', 'LTC']
const END_MS = Date.parse('2026-10-01T00:00:00Z')

function loadCsv(path: string): Bars {
  const text = gunzipSync(readFileSync(path)).toString('latin1')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  for (const s of text.split('\n')) {
    if (!s || !/^\d/.test(s)) continue
    const p = s.split(',')
    const ts = +p[0]
    if (t.length && ts <= t[t.length - 1]) throw new Error(`${path} : horodatages non croissants`)
    t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0))
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

/** Actif vierge : exactement loadUnseen() de research/shock/short-entry-study.ts, avec E2 sur les shorts. */
export function unseenAsset(sym: string): Asset {
  const all = loadCsv(join(ROOT, `research/data/${sym.toLowerCase()}usdt_15m.csv.gz`))
  let n = 0
  while (n < all.n && all.t[n] < END_MS) n++
  const cut = (x: Float64Array) => x.slice(0, n)
  const bars: Bars = { n, t: cut(all.t), o: cut(all.o), h: cut(all.h), l: cut(all.l), c: cut(all.c), v: cut(all.v) }
  const t = bars.t
  const d = new Date(t[0] + 365 * DAY)
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  let lo = 0
  while (lo < n && t[lo] < start) lo++
  const end = n - 1
  let minC = Infinity
  for (let i = lo; i <= end; i++) minC = Math.min(minC, bars.c[i])
  const mintick = Math.pow(10, Math.floor(Math.log10(minC)) - 4)
  const m = marketFor(bars, 15, mintick)
  const preset = adaptivePreset(15, mintick)
  const regimeBars = resample(bars, DAY)
  const select = selectFor(preset, m, regimeBars).select!
  const prs = preset.sets.map(p => prepare(m, p))
  const trend = trendDown(bars, regimeBars)
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = lo; i <= end; i++) {
    const e = select[i]
    const gap = i > 0 && t[i] - t[i - 1] > M15
    if (e < 0 || gap) continue
    const p = preset.sets[e], R = prs[e]
    if (p.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (p.allowShort && R.impulseEntryShort[i] && trend[i]) short[i] = 1
  }
  const costs = (k: number): Costs => ({ capital: 10000, qtyPct: 100, commissionPct: 0.045 * k, slippageTicks: 0, slippagePct: 0.01 * k, mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 })
  return { key: sym, label: `${sym}/USDT · Binance spot`, unseen: true, sleeveKey: null, bars, m, preset, select, lo, end, signals: { long, short }, trend, costs, mintick }
}

// ---------------------------------------------------------------- mesures d'un actif

export interface Measures {
  er: Float64Array
  er2: Float64Array
  adx: Float64Array
  fake: Float64Array
  /** Niveau cassé par jeu de réglages : plus haut / plus bas des rangeWin bougies jusqu'à i − 1 (repli comme market.ts). */
  hhPrev: Float64Array[]
  llPrev: Float64Array[]
}

export function measures(a: Asset): Measures {
  const b = a.bars
  const hhPrev: Float64Array[] = [], llPrev: Float64Array[] = []
  for (const p of a.preset.sets) {
    const hh = highest(b.h, p.rangeWin), ll = lowest(b.l, p.rangeWin)
    const H = new Float64Array(b.n), L = new Float64Array(b.n)
    for (let i = 0; i < b.n; i++) { H[i] = i > 0 && !Number.isNaN(hh[i - 1]) ? hh[i - 1] : hh[i]; L[i] = i > 0 && !Number.isNaN(ll[i - 1]) ? ll[i - 1] : ll[i] }
    hhPrev.push(H); llPrev.push(L)
  }
  return {
    er: efficiencyRatio(b.c, CFG.erN), er2: efficiencyRatio(b.c, CFG.erN2), adx: adxBefore(b, CFG.adxLen),
    fake: fakeoutFrequency(b, CFG.fakeN, CFG.fakeK, CFG.fakeWin, CFG.fakeMin), hhPrev, llPrev,
  }
}

/** Bougies où au moins une entrée de V0 est demandée, en régime « range » (percentile ER_20 < 0,25). */
export function rangeAtSignals(a: Asset, M: Measures): { range: Uint8Array; pct: Map<number, number> } {
  const range = new Uint8Array(a.bars.n)
  const pct = new Map<number, number>()
  for (let i = a.lo; i <= a.end; i++) {
    if (!a.signals.long[i] && !a.signals.short[i]) continue
    const q = causalPct(M.er, i, CFG.pctWin, CFG.pctMin)
    pct.set(i, q)
    if (q < CFG.rangePct) range[i] = 1
  }
  return { range, pct }
}

// ---------------------------------------------------------------- variantes

export type Variant = 'V0' | 'V1' | 'V2' | 'V3'
export const VARIANTS: Variant[] = ['V0', 'V1', 'V2', 'V3']

export interface VariantInputs { sets: ShockParams[]; select: Int8Array; override: EntryOverride; moved: number; dropped: number }

export function variantInputs(a: Asset, M: Measures, range: Uint8Array, v: Variant): VariantInputs {
  const { long, short } = a.signals
  const sets = a.preset.sets
  if (v === 'V0') return { sets, select: a.select, override: a.signals, moved: 0, dropped: 0 }
  if (v === 'V1') {
    let dropped = 0
    const L = Uint8Array.from(long, (x, i) => (x && range[i] ? (dropped++, 0) : x))
    const S = Uint8Array.from(short, (x, i) => (x && range[i] ? (dropped++, 0) : x))
    return { sets, select: a.select, override: { long: L, short: S }, moved: 0, dropped }
  }
  if (v === 'V2') {
    const b = a.bars, t = b.t
    const L = Uint8Array.from(long), S = Uint8Array.from(short)
    let moved = 0, dropped = 0
    for (let i = a.lo; i <= a.end; i++) {
      if (!range[i]) continue
      for (const dir of [1, -1] as const) {
        const arr = dir === 1 ? L : S
        if (!(dir === 1 ? long[i] : short[i])) continue
        arr[i] = 0
        const j = i + 1
        const e = a.select[i]
        const lvl = dir === 1 ? M.hhPrev[e][i] : M.llPrev[e][i]
        const ej = j <= a.end ? a.select[j] : -1
        const ok = j <= a.end && t[j] - t[i] <= M15 && ej >= 0 && (dir === 1 ? sets[ej].allowLong : sets[ej].allowShort && a.trend[j] === 1) && dir * (b.c[j] - lvl) > 0
        if (ok) { arr[j] = 1; moved++ } else dropped++
      }
    }
    return { sets, select: a.select, override: { long: L, short: S }, moved, dropped }
  }
  // V3 : jeu 2 = entrées du jeu calme, sorties du jeu agité existant ; choisi aux seules bougies d'entrée en range.
  const calm = sets[0], ag = sets[1]
  const exitOf = (p: ShockParams) => ({ atrStopMult: p.atrStopMult, atrTrailMult: p.atrTrailMult, useTP1: p.useTP1, tp1AtrMult: p.tp1AtrMult, tp1QtyPct: p.tp1QtyPct })
  const sets3 = [calm, ag, { ...calm, ...exitOf(ag) }]
  const select = Int8Array.from(a.select)
  let moved = 0
  for (let i = a.lo; i <= a.end; i++) if (range[i] && select[i] === 0 && (long[i] || short[i])) { select[i] = 2; moved++ }
  return { sets: sets3, select, override: a.signals, moved, dropped: 0 }
}

// ---------------------------------------------------------------- trades

export interface TradeR { p: PositionRecord; R: number; mfeR: number; maeR: number; stopDist: number; entryTime: number }

/** R = PnL net / risque initial (quantité × atrStopMult du jeu de la position × ATR d'entrée). */
export function tradeR(p: PositionRecord, sets: ShockParams[], mintick: number, t: Float64Array): TradeR {
  const stopDist = sets[p.set].atrStopMult * Math.max(p.atrAtEntry, mintick)
  const risk = p.qty * stopDist
  return { p, R: p.pnl / risk, mfeR: (p.mfeAtr * p.atrAtEntry) / stopDist, maeR: (p.maeAtr * p.atrAtEntry) / stopDist, stopDist, entryTime: t[p.entryIdx] + M15 }
}

/** Réintégration du range : une des h clôtures suivant l'entrée revient de l'autre côté du niveau cassé. */
export function reentered(b: Bars, i: number, dir: 1 | -1, level: number, h: number): boolean {
  for (let k = 1; k <= h && i + k < b.n; k++) if (dir * (b.c[i + k] - level) < 0) return true
  return false
}
