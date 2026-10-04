// Mesures d'un run du Shock Engine, par position (une position = une entrée, toutes ses sorties).

import type { Bars, Metrics, Trade } from '../../lib/backtest/types.ts'
import { computeMetrics } from '../../lib/backtest/metrics.ts'
import type { PositionRecord, ShockResult } from '../shock/engine.ts'

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
