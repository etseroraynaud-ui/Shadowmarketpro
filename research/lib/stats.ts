// Mesures d'un run du Shock Engine, par position (une position = une entrée, toutes ses sorties).

import type { Bars, Metrics, Trade } from '../../lib/backtest/types.ts'
import { computeMetrics } from '../../lib/backtest/metrics.ts'
import type { PositionRecord, ShockResult } from '../../lib/strategies/shock/engine.ts'

export function asTrades(bars: Bars, ps: PositionRecord[]): Trade[] {
  return ps.map((p, k) => ({
    id: k + 1, dir: p.dir, entryIdx: p.entryIdx, entryTime: bars.t[p.entryIdx], entryPrice: p.entryPrice,
    exitIdx: p.exitIdx, exitTime: bars.t[p.exitIdx], exitPrice: p.exitPrice, qty: p.qty, notional: p.notional,
    equityAtEntry: p.equityAtEntry, fees: p.fees, pnl: p.pnl, pnlPct: p.pnlPct, bars: p.exitIdx - p.entryIdx,
    reason: 'signal', mae: 0, mfe: 0,
  }))
}

/** Mesures sur [a, b] ; capital de départ = capital à la clôture de la barre a - 1. */
export function metricsOf(bars: Bars, r: ShockResult, a = r.start, b = r.end, capital = 10000): Metrics {
  const startEq = a > r.start ? r.equity[a - 1] : capital
  const ps = r.positions.filter(p => p.entryIdx >= a && p.entryIdx <= b)
  return computeMetrics(bars, r.equity, r.position, asTrades(bars, ps), a, b, startEq)
}

/** Résumé d'un groupe de positions (pour les découpages par régime). */
export interface Group {
  n: number
  winRate: number
  avgPct: number
  sumPct: number
  pf: number
  avgR: number
}

export function group(ps: PositionRecord[]): Group {
  const n = ps.length
  let w = 0, sum = 0, gp = 0, gl = 0, r = 0
  for (const p of ps) {
    sum += p.pnlPct
    if (p.pnl > 0) { w++; gp += p.pnl } else gl += p.pnl
    r += p.atrAtEntry > 0 ? (p.pnlPct * p.entryPrice) / p.atrAtEntry : 0
  }
  return { n, winRate: n ? w / n : 0, avgPct: n ? sum / n : 0, sumPct: sum, pf: gl < 0 ? gp / -gl : gp > 0 ? Infinity : 0, avgR: n ? r / n : 0 }
}

/** Sharpe annualisé d'une série de rendements par barre. */
export function sharpeOf(equity: Float64Array, a: number, b: number, ppy: number): number {
  let s = 0, s2 = 0, k = 0
  for (let i = a + 1; i <= b; i++) {
    const r = equity[i - 1] > 0 ? equity[i] / equity[i - 1] - 1 : 0
    s += r; s2 += r * r; k++
  }
  if (k < 2) return 0
  const m = s / k
  const sd = Math.sqrt(Math.max(s2 / k - m * m, 0))
  return sd > 0 ? (m / sd) * Math.sqrt(ppy) : 0
}

export const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : '—')
export const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : x === Infinity ? '∞' : '—')

/**
 * Positions placées au hasard : même nombre, mêmes durées, même sens, mêmes frais, entrées et
 * sorties à la clôture, sans chevauchement. Renvoie la part des tirages battus par la stratégie
 * (rendement composé des positions, taille 100 %).
 */
export function randomEntries(bars: Bars, ps: PositionRecord[], a: number, b: number, costPct: number, nSims = 1000, seed = 3) {
  const k = ps.length
  if (k < 5) return null
  const dur = ps.map(p => Math.max(1, p.exitIdx - p.entryIdx))
  const dirs = ps.map(p => p.dir)
  const D = dur.reduce((s, x) => s + x, 0)
  const F = b - a - D
  if (F < 0) return null
  const cost = (2 * costPct) / 100
  let strat = 1
  for (const p of ps) strat *= 1 + p.pnlPct
  let st = seed >>> 0
  const R = () => {
    st = (st + 0x6d2b79f5) >>> 0
    let t = st
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const sims: number[] = []
  const cuts = new Float64Array(k)
  const order = dur.map((_, i) => i)
  for (let s = 0; s < nSims; s++) {
    for (let i = k - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = order[i]; order[i] = order[j]; order[j] = t }
    for (let i = 0; i < k; i++) cuts[i] = Math.floor(R() * (F + 1))
    cuts.sort()
    let pos = a
    let prev = 0
    let eq = 1
    for (let i = 0; i < k; i++) {
      const id = order[i]
      pos += cuts[i] - prev
      prev = cuts[i]
      const x = Math.min(pos + dur[id], b)
      eq *= Math.max(0, 1 + dirs[id] * (bars.c[x] / bars.c[pos] - 1) - cost)
      pos = x
    }
    sims.push(eq - 1)
  }
  sims.sort((x, y) => x - y)
  const below = sims.filter(x => x < strat - 1).length
  return { strategy: strat - 1, percentile: below / nSims, median: sims[Math.floor(nSims / 2)], p95: sims[Math.floor(nSims * 0.95)] }
}
