// OU Trend Channel Pro v2.3 : indicateur (parties qui font les croix) et simulation de la stratégie
// « trap » sur BTC/USD, pour research/ou-channel/ou-study.ts et ou-trades.ts.

import { loadBtc } from '../lib/data.ts'
import { ema, sma, stdev, atr } from '../../lib/backtest/indicators.ts'
import { resample } from '../../lib/backtest/data.ts'

export interface Entry { zMin: number; reentry: number; wickThr: number; volMin: number; volDiv: boolean }
export interface Exit { stop: number; tpR: number; trail: boolean }
export interface Trade { j0: number; j1: number; dir: number; entry: number; exit: number; net: number; gross: number; stopPct: number; reason: 'stop' | 'tp' | 'signal' | 'end' }
export interface Res { cagr: number; sharpe: number; mdd: number; pf: number; trades: number; win: number; r: number[]; list: Trade[]; days: number[]; inPos: number }
export const BASE_ENTRY: Entry = { zMin: 2.2, reentry: 3, wickThr: 0.6, volMin: 1.0, volDiv: true }
export const BASE_EXIT: Exit = { stop: 3.3, tpR: 0, trail: false }

/** Marché d'un timeframe (15, 30, 60 ; 240 regroupé depuis 60) : séries de l'indicateur, signaux, simulation. */
export function ouMarket(TF: number) {
  const DAY = 864e5
  const FEE = 0.00045
  const T0 = Date.parse('2017-01-01'), T1 = Date.parse('2023-01-01'), T2 = Date.parse('2026-10-01')
  const b = TF === 240 ? resample(loadBtc(60), 4 * 3600000) : loadBtc(TF)
  const { t, o, h, l, c, v } = b
  const n = b.n
  const idx = (ms: number) => { let a = 0, z = n; while (a < z) { const k = (a + z) >> 1; if (t[k] < ms) a = k + 1; else z = k } return a }
  const iTr = idx(T0), iVa = idx(T1), iEnd = idx(T2) - 1

  // ---------------------------------------------------------------- indicateur (parties qui font les croix)
  const bs = ema(c, 34)
  const resid = Float64Array.from(c, (x, i) => x - bs[i])
  const rsd = ema(stdev(resid, 20), 5)
  const z = Float64Array.from(resid, (x, i) => (rsd[i] > 0 && Number.isFinite(rsd[i]) && Number.isFinite(x) ? x / rsd[i] : 0))
  const vm = sma(v, 20), vs = stdev(v, 20)
  const volZ = Float64Array.from(v, (x, i) => (vs[i] > 0 ? (x - vm[i]) / vs[i] : 0))
  const wick = Float64Array.from(c, (_, i) => { const r = h[i] - l[i]; return r > 0 ? Math.max(h[i] - Math.max(c[i], o[i]), Math.min(c[i], o[i]) - l[i]) / r : 0 })
  const atr30 = atr(h, l, c, 30)


  /** +1 = long (bearTrapNew), −1 = short (bullTrapNew), 0 sinon ; logique du script ligne à ligne. */
  function signals(p: Entry): Int8Array {
    const out = new Int8Array(n)
    const up = new Int32Array(n), dn = new Int32Array(n)
    let bullTrap = false, bearTrap = false
    for (let i = 1; i < n; i++) {
      const bu = z[i] > p.zMin, bd = z[i] < -p.zMin
      up[i] = bu ? up[i - 1] + 1 : 0
      dn[i] = bd ? dn[i - 1] + 1 : 0
      const reUp = i >= p.reentry && up[i - p.reentry] > 0 && up[i] === 0
      const reDn = i >= p.reentry && dn[i - p.reentry] > 0 && dn[i] === 0
      const extra = wick[i] >= p.wickThr || (p.volDiv && !(volZ[i] >= p.volMin))
      const prevBull = bullTrap, prevBear = bearTrap
      if (reUp && extra) bullTrap = true; else if (!bu) bullTrap = false
      if (reDn && extra) bearTrap = true; else if (!bd) bearTrap = false
      const sh = bullTrap && !prevBull, lg = bearTrap && !prevBear
      out[i] = lg && !sh ? 1 : sh && !lg ? -1 : 0
    }
    return out
  }

  // ---------------------------------------------------------------- simulation
  function simulate(sig: Int8Array, ex: Exit, a: number, z1: number, fee = FEE): Res {
    let eq = 1, dir = 0, entry = 0, units = 0, base = 0, stop = 0, tp = 0, dist = 0, ext = 0, eqIn = 1, j0 = 0, inPos = 0
    const tr: number[] = [], dailyEq: number[] = [], list: Trade[] = [], days: number[] = []
    let pending = 0
    const close = (px: number, j: number, reason: Trade['reason']) => { eq = base + dir * units * (px - entry) - fee * units * px; tr.push(eq / eqIn - 1); list.push({ j0, j1: j, dir, entry, exit: px, net: eq / eqIn - 1, gross: dir * (px / entry - 1), stopPct: dist / entry, reason }); dir = 0 }
    for (let j = a; j <= z1; j++) {
      if (pending && pending !== dir) {
        if (dir) close(o[j], j, 'signal')
        const A = atr30[j - 1]
        if (A > 0) {
          dir = pending; entry = o[j]; eqIn = eq; units = eq / entry; base = eq - fee * eq
          dist = ex.stop * A; stop = entry - dir * dist; tp = ex.tpR ? entry + dir * ex.tpR * dist : NaN; ext = entry; j0 = j
        }
      }
      pending = 0
      if (dir === 1) {
        if (l[j] <= stop) close(Math.min(o[j], stop), j, 'stop')
        else if (ex.tpR && h[j] >= tp) close(Math.max(o[j], tp), j, 'tp')
      } else if (dir === -1) {
        if (h[j] >= stop) close(Math.max(o[j], stop), j, 'stop')
        else if (ex.tpR && l[j] <= tp) close(Math.min(o[j], tp), j, 'tp')
      }
      if (dir && ex.trail) { ext = dir === 1 ? Math.max(ext, h[j]) : Math.min(ext, l[j]); stop = dir === 1 ? Math.max(stop, ext - dist) : Math.min(stop, ext + dist) }
      if (j < z1) pending = sig[j]
      if (j === z1 && dir) close(c[j], j, 'end')
      if (dir) inPos++
      const mark = dir ? base + dir * units * (c[j] - entry) : eq
      if (j === z1 || Math.floor(t[j + 1] / DAY) !== Math.floor(t[j] / DAY)) { dailyEq.push(mark); days.push(Math.floor(t[j] / DAY)) }
    }
    const r = dailyEq.map((x, k) => x / (k ? dailyEq[k - 1] : 1) - 1)
    const m = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length)
    let pk = 1, mdd = 0
    for (const x of dailyEq) { pk = Math.max(pk, x); mdd = Math.min(mdd, x / pk - 1) }
    const gp = tr.filter(x => x > 0).reduce((s, x) => s + x, 0), gl = tr.filter(x => x <= 0).reduce((s, x) => s + x, 0)
    return { cagr: Math.pow(dailyEq.at(-1)!, 365.25 / r.length) - 1, sharpe: sd > 0 ? (m / sd) * Math.sqrt(365.25) : 0, mdd, pf: gl < 0 ? gp / -gl : NaN, trades: tr.length, win: tr.filter(x => x > 0).length / Math.max(1, tr.length), r, list, days, inPos: inPos / (z1 - a + 1) }
  }
  const train = (sig: Int8Array, ex: Exit, fee?: number) => simulate(sig, ex, iTr, iVa - 1, fee)
  const valid = (sig: Int8Array, ex: Exit, fee?: number) => simulate(sig, ex, iVa, iEnd, fee)
  return { b, t, o, h, l, c, v, n, z, wick, volZ, atr30, iTr, iVa, iEnd, idx, signals, simulate, train, valid, FEE, DAY }
}
