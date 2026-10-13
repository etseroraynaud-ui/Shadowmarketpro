// Étude de capacité du Shock Engine : socle commun (research/preregistration/capacity-p0p1.md).
//
// - Portefeuille publié : mêmes sleeves, même masque des shorts, mêmes entrées et même période commune
//   que research/shock/portfolio.ts, reproduits avant tout calcul. Depuis le 2026-10-13, la
//   spécification publiée est E2 sans nouvelles entrées en régime agité (research/lib/calm-only.ts) ;
//   SHOCK_SPEC=e2 rejoue l'ancienne spécification (résultats publiés jusqu'au commit 059234c).
// - Exécutions du backtest relevées une à une pendant la simulation (entrée, TP1, stop, stop
//   suiveur, sorties à la clôture), sans toucher au moteur : les méthodes `open` et `fill` du broker
//   simulé sont seulement observées.
// - Coûts ajoutés après coup : une exécution de nominal N, avec une equity E juste avant, coûte
//   c × N ; l'equity de la sleeve est multipliée par (1 − c × N / E) à partir de cet instant. Le
//   moteur ne décide rien d'après l'equity et la taille suit l'equity : cette correction est exacte
//   au premier ordre. Elle est validée contre une relance du moteur avec glissement (budget.ts).

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resample } from '../../lib/backtest/data.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../lib/strategies/shock/broker.ts'
import type { ExitTag, PositionRecord } from '../../lib/strategies/shock/broker.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'
import { loadBtc } from '../lib/data.ts'
import { costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import type { Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { trendDown } from '../lib/e2.ts'
import { calmOnly } from '../lib/calm-only.ts'
import * as P from '../lib/portfolio.ts'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT = join(ROOT, 'research/reports/capacity')
export const DAY = P.DAY
export const M15 = 15 * 60000
export const SEED = 20261012
export const KEYS: SleeveKey[] = ['btc', 'ethusdt']
export const NAMES: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
/** Spécification étudiée : 'calm' (publiée) ou 'e2' (benchmark historique, deux régimes). */
export const SPEC: 'calm' | 'e2' = process.env.SHOCK_SPEC === 'e2' ? 'e2' : 'calm'
/** Sharpe officiel du portefeuille de la spécification (research/reports/reference/reference.json), à reproduire. */
export const OFFICIAL_SHARPE = SPEC === 'calm' ? 2.024207889 : 1.877566513
/** Début de la fenêtre Binance (fichiers perpétuels USDⓈ-M depuis janvier 2020). */
export const BINANCE_START = Date.UTC(2020, 0, 1)

// ---------------------------------------------------------------- sleeves publiées
/**
 * Sleeves du portefeuille publié : celles de zero-shot.ts, shorts masqués hors tendance baissière et,
 * pour la spécification 'calm', aucune nouvelle entrée en régime agité.
 */
export function loadPublished(): Record<SleeveKey, Sleeve> {
  const S = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') } as Record<SleeveKey, Sleeve>
  for (const key of KEYS) {
    const s = S[key]
    const trend = trendDown(s.bars, key === 'btc' ? resample(loadBtc(60), DAY) : resample(s.bars, DAY))
    const e2 = { long: s.signals.long, short: Uint8Array.from(s.signals.short, (x, i) => (x && trend[i] ? 1 : 0)) }
    const signals = SPEC === 'calm' ? calmOnly(e2, s.select) : e2
    S[key] = { ...s, signals, run: (k: number) => simulate(s.m, s.preset.sets, costsFor(key, k), s.lo, s.end, s.select, signals) }
  }
  return S
}

// ---------------------------------------------------------------- exécutions
export type FillKind = 'entry' | ExitTag
/** Familles d'exécutions de l'étude. */
export type Family = 'entry' | 'stop' | 'tp1' | 'close'
export const familyOf = (k: FillKind): Family => (k === 'entry' ? 'entry' : k === 'SL' || k === 'TRAIL' || k === 'LIQ' ? 'stop' : k === 'TP1' ? 'tp1' : 'close')

export interface Fill {
  key: SleeveKey
  /** Rang de la position dans la sleeve. */
  pos: number
  /** Barre (horodatée à l'ouverture) où l'exécution a lieu. */
  i: number
  kind: FillKind
  /** +1 achat, −1 vente. */
  side: 1 | -1
  qty: number
  px: number
  notional: number
  /** Equity de la sleeve juste avant l'exécution (position valorisée au prix d'exécution). */
  eqBefore: number
  /** Part de la position d'origine exécutée (1 pour l'entrée). */
  frac: number
}

export interface Position {
  key: SleeveKey
  pos: number
  dir: 1 | -1
  entryIdx: number
  exitIdx: number
  entryPx: number
  pnlPct: number
  exits: ExitTag[]
  rec: PositionRecord
}

export interface Run {
  key: SleeveKey
  sleeve: Sleeve
  equity: Float64Array
  fills: Fill[]
  positions: Position[]
}

/** Simulation de la sleeve avec relevé des exécutions ; `costs` remplace les coûts de zero-shot.ts (k = 1). */
export function runFills(s: Sleeve, costs: Costs = costsFor(s.key, 1)): Run {
  const { m, end, lo } = s
  const n = m.bars.n
  const strategy = new ShockStrategy(m, s.preset.sets, costs.mintick, s.select, s.signals)
  const broker = new SimBroker(m, s.preset.sets, costs, (set, i) => strategy.prs[set].atr[i])
  const fills: Fill[] = []
  let posId = -1
  type Fn = (...a: never[]) => void
  const b = broker as unknown as { open: Fn; fill: Fn }
  const open = (broker as unknown as { open: (i: number, dir: 1 | -1, tag: string, set: number) => void }).open.bind(broker)
  const fill = (broker as unknown as { fill: (i: number, qty: number, px: number, tag: ExitTag) => void }).fill.bind(broker)
  b.open = ((i: number, dir: 1 | -1, tag: string, set: number) => {
    const before = broker.pos
    open(i, dir, tag, set)
    const q = broker.pos
    if (q && q !== before) {
      posId++
      fills.push({ key: s.key, pos: posId, i, kind: 'entry', side: dir, qty: q.qty, px: q.avg, notional: q.notional, eqBefore: q.equityAtEntry, frac: 1 })
    }
  }) as Fn
  b.fill = ((i: number, qty: number, px: number, tag: ExitTag) => {
    const q = broker.pos!
    const eqBefore = costs.capital + broker.realized + q.dir * (px - q.avg) * q.qty
    fills.push({ key: s.key, pos: posId, i, kind: tag, side: (-q.dir) as 1 | -1, qty, px, notional: px * qty, eqBefore, frac: qty / (q.qty + q.exitQty) })
    fill(i, qty, px, tag)
  }) as Fn
  const equity = new Float64Array(n)
  for (let i = 0; i < lo; i++) equity[i] = costs.capital
  for (let i = lo; i <= end; i++) {
    broker.beforeClose(i)
    const last = i === end
    const d = strategy.onClose(i, broker.view(), last)
    broker.afterClose(i, d, last)
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  const positions: Position[] = broker.positions.map((p, k) => ({
    key: s.key, pos: k, dir: p.dir, entryIdx: p.entryIdx, exitIdx: p.exitIdx, entryPx: p.entryPrice, pnlPct: p.pnlPct, exits: p.exits, rec: p,
  }))
  return { key: s.key, sleeve: s, equity, fills, positions }
}

// ---------------------------------------------------------------- période et séries journalières
export interface Window { name: string; days: number[]; a: Record<SleeveKey, number>; b: Record<SleeveKey, number> }

const idxAt = (s: Sleeve, ms: number) => { const t = s.bars.t; let lo = 0, hi = s.bars.n; while (lo < hi) { const md = (lo + hi) >> 1; if (t[md] < ms) lo = md + 1; else hi = md } return lo }

/** Période commune de portfolio.ts ; `fromMs` la raccourcit (fenêtre Binance). */
export function windowOf(S: Record<SleeveKey, Sleeve>, name: string, fromMs = 0): Window {
  const tStart = Math.max(...KEYS.map(k => S[k].bars.t[S[k].lo]))
  const tEnd = Math.min(...KEYS.map(k => S[k].bars.t[S[k].end] + M15))
  const D0 = Math.max(Math.ceil(tStart / DAY), Math.ceil(fromMs / DAY)), D1 = Math.floor(tEnd / DAY) - 1
  const days: number[] = []
  for (let d = D0; d <= D1; d++) days.push(d)
  const a = {} as Record<SleeveKey, number>, b = {} as Record<SleeveKey, number>
  for (const k of KEYS) { a[k] = idxAt(S[k], D0 * DAY); b[k] = idxAt(S[k], (D1 + 1) * DAY) - 1 }
  return { name, days, a, b }
}

/** Rendements journaliers de la sleeve sur la fenêtre (portfolio.ts : dayCloses, returnsOf). */
export function sleeveDaily(run: Run, w: Window): number[] {
  const { a, b } = { a: w.a[run.key], b: w.b[run.key] }
  const base = run.equity[a - 1]
  const { eq } = P.dayCloses(run.sleeve.bars.t, run.equity, a, b, w.days, base)
  return P.returnsOf(eq, base)
}

/** Jour (indice dans la fenêtre) de chaque exécution, ou −1 hors fenêtre. */
export function fillDay(run: Run, f: Fill, w: Window): number {
  const d = Math.floor(run.sleeve.bars.t[f.i] / DAY)
  return d >= w.days[0] && d <= w.days[w.days.length - 1] && f.i >= w.a[run.key] && f.i <= w.b[run.key] ? d - w.days[0] : -1
}

/**
 * Rendements journaliers nets d'un coût par exécution `cost(f)` (fraction du nominal, hors
 * commission) : (1 + r) × Π (1 − c × N / E) − 1 sur les exécutions du jour.
 */
export function netDaily(run: Run, w: Window, r: number[], cost: (f: Fill) => number): number[] {
  const mult = new Float64Array(r.length).fill(1)
  for (const f of run.fills) {
    const c = cost(f)
    if (!c) continue
    const d = fillDay(run, f, w)
    if (d >= 0) mult[d] *= 1 - (c * f.notional) / f.eqBefore
  }
  return r.map((x, d) => (1 + x) * mult[d] - 1)
}

/** Portefeuille 50/50 sans rebalancement (portfolio.ts, variante A). */
export const portfolio = (rb: number[], re: number[]) => P.book(rb, re).r

export interface Stats { sharpe: number; cagr: number; sortino: number; maxDD: number; calmar: number; vol: number }
export function statsOf(r: number[], days: number[]): Stats {
  const m = P.dailyMetrics(r, days)
  return { sharpe: m.sharpe, cagr: m.cagr, sortino: m.sortino, maxDD: m.maxDD, calmar: m.calmar, vol: m.vol }
}

// ---------------------------------------------------------------- bootstrap par mois
/** Blocs mensuels de la fenêtre et tirages fixés (mêmes mois pour toutes les variantes). */
export function monthDraws(days: number[], nRep: number, seed = SEED): { blocks: number[][]; draws: Int32Array[] } {
  const blocks: number[][] = []
  for (let i = 0; i < days.length; i++) {
    const k = P.monthKey(days[i])
    if (!blocks.length || P.monthKey(days[blocks[blocks.length - 1][0]]) !== k) blocks.push([])
    blocks[blocks.length - 1].push(i)
  }
  const rand = P.rng(seed)
  const draws: Int32Array[] = []
  for (let rep = 0; rep < nRep; rep++) draws.push(Int32Array.from({ length: blocks.length }, () => Math.floor(rand() * blocks.length)))
  return { blocks, draws }
}

/** Sharpe du portefeuille sur chaque tirage : sleeves rééchantillonnées ensemble, portefeuille reconstruit (portfolio.ts). */
export function bootSharpe(rb: number[], re: number[], md: { blocks: number[][]; draws: Int32Array[] }): Float64Array {
  const out = new Float64Array(md.draws.length)
  for (let rep = 0; rep < md.draws.length; rep++) {
    let a = 50, b = 50, prev = 100, s = 0, s2 = 0, n = 0
    for (const j of md.draws[rep]) for (const i of md.blocks[j]) {
      a *= 1 + rb[i]; b *= 1 + re[i]
      const v = a + b, x = v / prev - 1
      prev = v; s += x; s2 += x * x; n++
    }
    const mu = s / n, sd = Math.sqrt(Math.max(s2 / n - mu * mu, 0))
    out[rep] = sd > 0 ? (mu / sd) * Math.sqrt(P.ANN) : 0
  }
  return out
}

export const q = (xs: ArrayLike<number>, p: number) => P.quantile(Array.from(xs), p)

/** Premier x (interpolation linéaire, ou log-linéaire si `logX`) où y passe sous `level` ; NaN si jamais. */
export function crossing(x: number[], y: number[], level: number, logX = false): number {
  if (y[0] < level) return x[0]
  for (let k = 1; k < x.length; k++) {
    if (y[k] < level) {
      const f = (y[k - 1] - level) / (y[k - 1] - y[k])
      return logX ? Math.exp(Math.log(x[k - 1]) + f * (Math.log(x[k]) - Math.log(x[k - 1]))) : x[k - 1] + f * (x[k] - x[k - 1])
    }
  }
  return NaN
}

export type { Sleeve, SleeveKey, ShockResult }
