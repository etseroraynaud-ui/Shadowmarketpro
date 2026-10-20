// Regime Wave de « Markov Regime Engine (MRE) v1.5 VWAP » (indicateur Pine du propriétaire), portée ligne à
// ligne avec le profil CRYPTO et les réglages par défaut (mode Turbo actif). Les probabilités de Markov
// n'entrent pas dans la wave et ne sont pas portées.
//
// Particularité du script conservée : `wv_slopeRaw = wv_waveRaw - nz(wv_waveRaw[1])` est calculé avant la mise
// à jour de la variable `var`, donc vaut toujours 0 ; le « flip boost » ne s'applique jamais.

import type { Bars } from '../../lib/backtest/types.ts'
import { sma, stdev, ema, atr } from '../../lib/backtest/indicators.ts'

const clamp = (x: number, a: number, b: number) => (Number.isNaN(x) ? NaN : Math.max(a, Math.min(b, x)))

/** SuperSmoother d'Ehlers, état propre à chaque appel comme la `var` du script. */
function superSmoother(src: Float64Array, period: number): Float64Array {
  const a1 = Math.exp((-Math.SQRT2 * Math.PI) / period), b1 = 2 * a1 * Math.cos((Math.SQRT2 * Math.PI) / period)
  const c2 = b1, c3 = -a1 * a1, c1 = 1 - c2 - c3
  const out = new Float64Array(src.length).fill(NaN)
  const nz = (x: number) => (Number.isNaN(x) ? 0 : x)
  for (let i = 0; i < src.length; i++) {
    const prev = i ? out[i - 1] : NaN
    out[i] = Number.isNaN(prev) ? src[i] : (c1 * (src[i] + nz(i ? src[i - 1] : NaN))) / 2 + c2 * nz(prev) + c3 * nz(i > 1 ? out[i - 2] : NaN)
  }
  return out
}

function zScore(src: Float64Array, len: number): Float64Array {
  const m = sma(src, len), s = stdev(src, len)
  return Float64Array.from(src, (x, i) => (x - m[i]) / Math.max(s[i], 1e-10))
}

/** Filtre de persistance du script (états 0, 1, 2 ; départ à 1). */
function persistence(raw: Int8Array, bars: number): Int8Array {
  const out = new Int8Array(raw.length)
  let confirmed = 1, pending = 1, count = 0
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i]
    if (r !== confirmed) {
      if (r === pending) count++
      else { pending = r; count = 1 }
      if (count >= bars) { confirmed = r; count = 0 }
    } else { pending = confirmed; count = 0 }
    out[i] = confirmed
  }
  return out
}

export function regimeWave(b: Bars): { wave: Float64Array; trend: Int8Array; vol: Int8Array; mom: Int8Array } {
  const { h, l, c, v, n } = b
  const hlc3 = Float64Array.from(c, (x, i) => (h[i] + l[i] + x) / 3)
  // Tendance : VWAP glissant 20, z-score du spread sur 50, seuil 0,8, persistance 1.
  const spread = new Float64Array(n)
  let pv = 0, vv = 0
  for (let i = 0; i < n; i++) {
    pv += hlc3[i] * v[i]; vv += v[i]
    if (i >= 20) { pv -= hlc3[i - 20] * v[i - 20]; vv -= v[i - 20] }
    const vwap = i >= 19 && vv > 0 ? pv / vv : hlc3[i]
    spread[i] = hlc3[i] - vwap
  }
  const mu = sma(spread, 50), sd = stdev(spread, 50)
  const z = Float64Array.from(spread, (x, i) => clamp(sd[i] > 1e-10 ? (x - mu[i]) / sd[i] : 0, -4, 4))
  const trend = persistence(Int8Array.from(z, x => (x > 0.8 ? 2 : x < -0.8 ? 0 : 1)), 1)
  // Volatilité : écart type des variations du spread sur 20, z-score sur 100, SuperSmoother 5, seuils ±1, persistance 2.
  const delta = Float64Array.from(spread, (x, i) => x - (i ? spread[i - 1] : 0))
  const sig = stdev(delta, 20)
  const sz = superSmoother(Float64Array.from(zScore(sig, 100), x => clamp(x, -5, 5)), 5)
  const vol = persistence(Int8Array.from(sz, x => (x > 1 ? 2 : x < -1 ? 0 : 1)), 2)
  // Momentum : MACD 12/26 / ATR 14, pente 3, SuperSmoother 5, z-score 50, zone morte 0,2, persistance 2.
  const a14 = atr(h, l, c, 14), e12 = ema(c, 12), e26 = ema(c, 26)
  const norm = Float64Array.from(c, (_, i) => (e12[i] - e26[i]) / Math.max(a14[i], 1e-10))
  const slope = Float64Array.from(norm, (x, i) => (i >= 3 ? (x - norm[i - 3]) / 3 : NaN))
  const mz = Float64Array.from(zScore(superSmoother(slope, 5), 50), x => clamp(x, -2, 2))
  const mom = persistence(Int8Array.from(mz, x => (x > 0.2 ? 2 : x < -0.2 ? 0 : 1)), 2)
  // Amplitude par l'Efficiency Ratio 14 (plancher 0,15, puissance 1,8), score pondéré, vitesse limitée, EMA 2.
  const waveRaw = new Float64Array(n)
  let w = 0
  for (let i = 0; i < n; i++) {
    let er = 0
    if (i >= 14) { let s = 0; for (let j = 0; j < 14; j++) s += Math.abs(c[i - j] - c[i - j - 1]); er = s > 1e-10 ? Math.abs(c[i] - c[i - 14]) / s : 0 }
    const amp = 0.15 + 0.85 * Math.pow(er, 1.8)
    const raw = (0.5 * (trend[i] - 1) + 0.3 * clamp(z[i] / 2, -1, 1) + 0.2 * (mom[i] - 1)) * (vol[i] === 2 ? 0.6 : 1)
    const target = clamp(clamp(raw, -1, 1) * amp, -1, 1)
    const step = 0.08 * 2.7
    w = clamp(w + clamp(target - w, -step, step), -1, 1)
    waveRaw[i] = w
  }
  const wave = Float64Array.from(ema(waveRaw, 2), x => clamp(x, -1, 1))
  return { wave, trend, vol, mom }
}
