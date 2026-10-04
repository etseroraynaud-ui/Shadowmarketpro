// Mesures de performance d'une courbe de capital et de sa liste de trades.
// Annualisation par le nombre réel de barres par an, déduit des horodatages : la même
// formule convient aux marchés ouverts 24 h/24 et à ceux qui ferment la nuit.

import type { Bars, Metrics, Trade } from './types.ts'
import { medianStep } from './data.ts'

const YEAR_MS = 365.25 * 86400000

export function computeMetrics(
  bars: Bars,
  equity: Float64Array,
  position: Int8Array | null,
  trades: Trade[],
  a: number,
  b: number,
  startEquity: number,
): Metrics {
  const count = b - a + 1
  const barMs = medianStep(bars.t)
  const years = Math.max((bars.t[b] - bars.t[a] + barMs) / YEAR_MS, 1e-9)
  const ppy = count / years
  const endEquity = equity[b]

  let sum = 0
  let sum2 = 0
  let down2 = 0
  let peak = startEquity
  let peakT = bars.t[a] - barMs
  let peakIdx = a - 1
  let maxDD = 0
  let ddBars = 0
  let ddMs = 0
  let inPos = 0
  for (let k = a; k <= b; k++) {
    const prev = k === a ? startEquity : equity[k - 1]
    const r = prev > 0 ? equity[k] / prev - 1 : 0
    sum += r
    sum2 += r * r
    if (r < 0) down2 += r * r
    if (equity[k] >= peak) {
      peak = equity[k]
      peakT = bars.t[k]
      peakIdx = k
    } else {
      const dd = equity[k] / peak - 1
      if (dd < maxDD) maxDD = dd
      if (k - peakIdx > ddBars) ddBars = k - peakIdx
      if (bars.t[k] - peakT > ddMs) ddMs = bars.t[k] - peakT
    }
    if (position && position[k] !== 0) inPos++
  }
  const mean = sum / count
  const variance = Math.max(sum2 / count - mean * mean, 0)
  const sd = Math.sqrt(variance)
  const downDev = Math.sqrt(down2 / count)
  const totalReturn = endEquity / startEquity - 1
  const cagr = endEquity > 0 ? Math.pow(endEquity / startEquity, 1 / years) - 1 : -1

  let wins = 0
  let losses = 0
  let gp = 0
  let gl = 0
  let sumPct = 0
  let sumWinPct = 0
  let sumLossPct = 0
  let best = -Infinity
  let worst = Infinity
  let sumBars = 0
  let streakW = 0
  let streakL = 0
  let maxW = 0
  let maxL = 0
  let fees = 0
  let longs = 0
  for (const tr of trades) {
    if (tr.dir === 1) longs++
    fees += tr.fees
    sumPct += tr.pnlPct
    sumBars += tr.bars
    best = Math.max(best, tr.pnlPct)
    worst = Math.min(worst, tr.pnlPct)
    if (tr.pnl > 0) {
      wins++
      gp += tr.pnl
      sumWinPct += tr.pnlPct
      streakW++
      streakL = 0
    } else {
      losses++
      gl += tr.pnl
      sumLossPct += tr.pnlPct
      streakL++
      streakW = 0
    }
    maxW = Math.max(maxW, streakW)
    maxL = Math.max(maxL, streakL)
  }
  const nT = trades.length
  const avgWin = wins ? sumWinPct / wins : 0
  const avgLoss = losses ? sumLossPct / losses : 0
  return {
    startEquity,
    endEquity,
    netProfit: endEquity - startEquity,
    totalReturn,
    cagr,
    volatility: sd * Math.sqrt(ppy),
    sharpe: sd > 0 ? (mean / sd) * Math.sqrt(ppy) : 0,
    sortino: downDev > 0 ? (mean / downDev) * Math.sqrt(ppy) : 0,
    calmar: maxDD < 0 ? cagr / -maxDD : 0,
    maxDrawdown: maxDD,
    maxDrawdownBars: ddBars,
    maxDrawdownDays: ddMs / 86400000,
    years,
    periodsPerYear: ppy,
    trades: nT,
    longTrades: longs,
    shortTrades: nT - longs,
    wins,
    losses,
    winRate: nT ? wins / nT : 0,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor: gl < 0 ? gp / -gl : gp > 0 ? Infinity : 0,
    avgTradePct: nT ? sumPct / nT : 0,
    avgWinPct: avgWin,
    avgLossPct: avgLoss,
    payoff: avgLoss < 0 ? avgWin / -avgLoss : avgWin > 0 ? Infinity : 0,
    bestTradePct: nT ? best : 0,
    worstTradePct: nT ? worst : 0,
    avgBars: nT ? sumBars / nT : 0,
    maxConsecWins: maxW,
    maxConsecLosses: maxL,
    exposure: position ? inPos / count : 1,
    fees,
  }
}

/** Rendement par mois et par an, à partir de la courbe de capital à la clôture. */
export function periodReturns(bars: Bars, equity: Float64Array, a: number, b: number, startEquity: number) {
  const months: { year: number; month: number; ret: number }[] = []
  const years: { year: number; ret: number }[] = []
  let mStart = startEquity
  let yStart = startEquity
  for (let k = a; k <= b; k++) {
    const d = new Date(bars.t[k])
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth()
    const last = k === b
    const nd = last ? null : new Date(bars.t[k + 1])
    if (last || nd!.getUTCMonth() !== m || nd!.getUTCFullYear() !== y) {
      months.push({ year: y, month: m, ret: equity[k] / mStart - 1 })
      mStart = equity[k]
    }
    if (last || nd!.getUTCFullYear() !== y) {
      years.push({ year: y, ret: equity[k] / yStart - 1 })
      yStart = equity[k]
    }
  }
  return { months, years }
}
