// Contrôles de robustesse : la performance vient-elle de la stratégie ou du hasard ?
//
// 1. Entrées au hasard : on garde le nombre de trades, leurs durées, leur sens et leur taille,
//    mais on place les entrées au hasard dans la même fenêtre, sans chevauchement. Si une large
//    part de ces stratégies aléatoires fait mieux, le résultat ne prouve rien.
// 2. Tirage des trades : on retire les trades réalisés avec remise pour estimer la dispersion
//    possible du résultat final et du drawdown si l'avenir ressemble au passé.

import type { BacktestResult, Bars, Settings, Trade } from './types.ts'

export function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function quantile(sorted: Float64Array | number[], p: number): number {
  if (!sorted.length) return NaN
  const x = (sorted.length - 1) * p
  const lo = Math.floor(x)
  const hi = Math.ceil(x)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo)
}

export interface RandomTest {
  /** Rendements totaux des stratégies aléatoires, triés. */
  sims: Float64Array
  strategy: number
  /** Part des stratégies aléatoires battues par la stratégie (0..1). */
  percentile: number
  median: number
  p5: number
  p95: number
}

export function randomEntryTest(bars: Bars, res: BacktestResult, s: Settings, nSims = 1000, seed = 7): RandomTest | null {
  const trades = res.trades
  const k = trades.length
  if (k < 3) return null
  const { o } = bars
  const a = res.start
  const b = res.end
  const dur = trades.map(t => Math.max(1, t.exitIdx - t.entryIdx))
  const frac = trades.map(t => (t.equityAtEntry > 0 ? t.notional / t.equityAtEntry : 1))
  const dirs = trades.map(t => t.dir)
  const D = dur.reduce((x, y) => x + y, 0)
  const F = b - a - D
  if (F < 0) return null
  const cost = 2 * (Math.max(0, s.feePct) + Math.max(0, s.slippagePct)) / 100
  const R = rng(seed)
  const order = dur.map((_, i) => i)
  const sims = new Float64Array(nSims)
  const cuts = new Float64Array(k)
  for (let sim = 0; sim < nSims; sim++) {
    for (let i = k - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1))
      const tmp = order[i]; order[i] = order[j]; order[j] = tmp
    }
    for (let i = 0; i < k; i++) cuts[i] = Math.floor(R() * (F + 1))
    cuts.sort()
    let pos = a
    let prevCut = 0
    let eq = 1
    for (let i = 0; i < k; i++) {
      const id = order[i]
      pos += cuts[i] - prevCut
      prevCut = cuts[i]
      const e = pos
      const x = Math.min(pos + dur[id], b)
      const r = dirs[id] * (o[x] / o[e] - 1) * frac[id] - frac[id] * cost
      eq *= Math.max(0, 1 + r)
      pos = x
    }
    sims[sim] = eq - 1
  }
  sims.sort()
  const strategy = res.metrics.totalReturn
  let below = 0
  for (let i = 0; i < nSims; i++) if (sims[i] < strategy) below++
  return { sims, strategy, percentile: below / nSims, median: quantile(sims, 0.5), p5: quantile(sims, 0.05), p95: quantile(sims, 0.95) }
}

export interface Bootstrap {
  finals: Float64Array
  drawdowns: Float64Array
  probLoss: number
  final5: number
  final50: number
  final95: number
  dd50: number
  dd95: number
}

/** Rééchantillonne les trades (rendement sur le capital engagé) avec remise. */
export function tradeBootstrap(trades: Trade[], nSims = 1000, seed = 11): Bootstrap | null {
  const k = trades.length
  if (k < 5) return null
  const r = trades.map(t => (t.equityAtEntry > 0 ? t.pnl / t.equityAtEntry : 0))
  const R = rng(seed)
  const finals = new Float64Array(nSims)
  const dds = new Float64Array(nSims)
  let losses = 0
  for (let sim = 0; sim < nSims; sim++) {
    let eq = 1
    let peak = 1
    let dd = 0
    for (let i = 0; i < k; i++) {
      eq *= Math.max(0, 1 + r[Math.floor(R() * k)])
      if (eq > peak) peak = eq
      else dd = Math.min(dd, eq / peak - 1)
    }
    finals[sim] = eq - 1
    dds[sim] = dd
    if (eq < 1) losses++
  }
  finals.sort()
  dds.sort()
  return {
    finals,
    drawdowns: dds,
    probLoss: losses / nSims,
    final5: quantile(finals, 0.05),
    final50: quantile(finals, 0.5),
    final95: quantile(finals, 0.95),
    dd50: quantile(dds, 0.5),
    dd95: quantile(dds, 0.05),
  }
}
