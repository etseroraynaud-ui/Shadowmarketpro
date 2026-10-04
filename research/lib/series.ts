// Outils sur les séries de rendements : rendements quotidiens d'une courbe de capital,
// courbe recollée, moments.

export function dailyReturns(t: Float64Array, eq: Float64Array, a: number, b: number, startEq: number) {
  const days: number[] = []
  const rets: number[] = []
  let prev = startEq
  for (let i = a; i <= b; i++) {
    const d = Math.floor(t[i] / 86400000)
    const last = i === b || Math.floor(t[i + 1] / 86400000) !== d
    if (last) {
      days.push(d)
      rets.push(prev > 0 ? eq[i] / prev - 1 : 0)
      prev = eq[i]
    }
  }
  return { days, rets }
}

export function moments(x: number[]) {
  const n = x.length
  const m = x.reduce((s, v) => s + v, 0) / Math.max(1, n)
  let m2 = 0, m3 = 0, m4 = 0
  for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d }
  m2 /= Math.max(1, n); m3 /= Math.max(1, n); m4 /= Math.max(1, n)
  const sd = Math.sqrt(m2)
  return { n, mean: m, sd, skew: sd > 0 ? m3 / sd ** 3 : 0, kurt: sd > 0 ? m4 / sd ** 4 : 3 }
}

/** Courbe recollée à partir de rendements quotidiens (365,25 jours par an : marché ouvert en continu). */
export function stitched(rets: number[]) {
  let eq = 1
  let peak = 1
  let dd = 0
  for (const r of rets) {
    eq *= 1 + r
    if (eq > peak) peak = eq
    else dd = Math.min(dd, eq / peak - 1)
  }
  const mo = moments(rets)
  const years = rets.length / 365.25
  return { ret: eq - 1, cagr: eq > 0 && years > 0 ? eq ** (1 / years) - 1 : -1, sharpe: mo.sd > 0 ? (mo.mean / mo.sd) * Math.sqrt(365.25) : 0, dd }
}

/** Régression des rendements quotidiens d'une stratégie sur ceux du marché : bêta, alpha annualisé et son t-stat. */
export function alphaBeta(strat: number[], market: number[]) {
  const n = Math.min(strat.length, market.length)
  let sx = 0, sy = 0
  for (let i = 0; i < n; i++) { sx += market[i]; sy += strat[i] }
  const mx = sx / n
  const my = sy / n
  let sxx = 0, sxy = 0
  for (let i = 0; i < n; i++) { sxx += (market[i] - mx) ** 2; sxy += (market[i] - mx) * (strat[i] - my) }
  const beta = sxx > 0 ? sxy / sxx : 0
  const alpha = my - beta * mx
  let sse = 0
  for (let i = 0; i < n; i++) sse += (strat[i] - alpha - beta * market[i]) ** 2
  const se = Math.sqrt(sse / Math.max(1, n - 2)) * Math.sqrt(1 / n + (mx * mx) / Math.max(1e-18, sxx))
  return { beta, alphaYear: alpha * 365.25, tAlpha: se > 0 ? alpha / se : 0 }
}
