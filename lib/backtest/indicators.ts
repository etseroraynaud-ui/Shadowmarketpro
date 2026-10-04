// Indicateurs vectorisés, causaux : la valeur à la barre i ne dépend que des barres 0..i.
// NaN tient lieu de « na » : valeur pas encore définie (préchauffage) ou manquante.
// Les formules suivent celles de Pine Script (ta.*) quand elles existent.

export type Series = Float64Array

export function full(n: number, v: number): Series {
  const s = new Float64Array(n)
  s.fill(v)
  return s
}

/** Décale la série de k barres vers le passé : out[i] = src[i - k]. */
export function shift(src: Series, k: number): Series {
  const n = src.length
  const out = full(n, NaN)
  for (let i = k; i < n; i++) out[i] = src[i - k]
  return out
}

export function sma(src: Series, len: number): Series {
  const n = src.length
  const out = full(n, NaN)
  if (len < 1) return out
  let sum = 0
  let nan = 0
  for (let i = 0; i < n; i++) {
    const x = src[i]
    if (Number.isNaN(x)) nan++
    else sum += x
    if (i >= len) {
      const y = src[i - len]
      if (Number.isNaN(y)) nan--
      else sum -= y
    }
    if (i >= len - 1 && nan === 0) out[i] = sum / len
  }
  return out
}

/** Moyenne exponentielle de coefficient alpha, amorcée par une moyenne simple sur `len` valeurs. */
function expAvg(src: Series, len: number, alpha: number): Series {
  const n = src.length
  const out = full(n, NaN)
  if (len < 1) return out
  let prev = NaN
  let seed = 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const x = src[i]
    if (Number.isNaN(prev)) {
      if (Number.isNaN(x)) { seed = 0; count = 0; continue }
      seed += x
      count++
      if (count === len) { prev = seed / len; out[i] = prev }
      continue
    }
    if (Number.isNaN(x)) { out[i] = NaN; continue }
    prev = alpha * x + (1 - alpha) * prev
    out[i] = prev
  }
  return out
}

export function ema(src: Series, len: number): Series {
  return expAvg(src, len, 2 / (len + 1))
}

export function rma(src: Series, len: number): Series {
  return expAvg(src, len, 1 / len)
}

export function wma(src: Series, len: number): Series {
  const n = src.length
  const out = full(n, NaN)
  if (len < 1) return out
  const den = (len * (len + 1)) / 2
  for (let i = len - 1; i < n; i++) {
    let s = 0
    let ok = true
    for (let k = 0; k < len; k++) {
      const x = src[i - k]
      if (Number.isNaN(x)) { ok = false; break }
      s += x * (len - k)
    }
    if (ok) out[i] = s / den
  }
  return out
}

export function hma(src: Series, len: number): Series {
  const half = wma(src, Math.max(1, Math.floor(len / 2)))
  const fullW = wma(src, len)
  const diff = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) diff[i] = 2 * half[i] - fullW[i]
  return wma(diff, Math.max(1, Math.floor(Math.sqrt(len))))
}

export function dema(src: Series, len: number): Series {
  const e1 = ema(src, len)
  const e2 = ema(e1, len)
  const out = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = 2 * e1[i] - e2[i]
  return out
}

export function tema(src: Series, len: number): Series {
  const e1 = ema(src, len)
  const e2 = ema(e1, len)
  const e3 = ema(e2, len)
  const out = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = 3 * (e1[i] - e2[i]) + e3[i]
  return out
}

export function vwma(src: Series, vol: Series, len: number): Series {
  const pv = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) pv[i] = src[i] * vol[i]
  const a = sma(pv, len)
  const b = sma(vol, len)
  const out = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) out[i] = b[i] > 0 ? a[i] / b[i] : NaN
  return out
}

/** Écart type de population sur `len` barres (comme ta.stdev par défaut). */
export function stdev(src: Series, len: number): Series {
  const n = src.length
  const out = full(n, NaN)
  const m = sma(src, len)
  for (let i = len - 1; i < n; i++) {
    if (Number.isNaN(m[i])) continue
    let s = 0
    for (let k = 0; k < len; k++) {
      const d = src[i - k] - m[i]
      s += d * d
    }
    out[i] = Math.sqrt(s / len)
  }
  return out
}

export function variance(src: Series, len: number): Series {
  const s = stdev(src, len)
  for (let i = 0; i < s.length; i++) s[i] = s[i] * s[i]
  return s
}

/** Plus haut sur `len` barres, barre courante comprise (file monotone, O(n)). */
export function highest(src: Series, len: number): Series {
  return rollExtreme(src, len, true)
}

export function lowest(src: Series, len: number): Series {
  return rollExtreme(src, len, false)
}

function rollExtreme(src: Series, len: number, max: boolean): Series {
  const n = src.length
  const out = full(n, NaN)
  if (len < 1) return out
  const dq = new Int32Array(n)
  let head = 0
  let tail = 0
  let lastNan = -1
  for (let i = 0; i < n; i++) {
    const x = src[i]
    if (Number.isNaN(x)) { lastNan = i; head = tail = 0; continue }
    while (tail > head && (max ? src[dq[tail - 1]] <= x : src[dq[tail - 1]] >= x)) tail--
    dq[tail++] = i
    while (dq[head] <= i - len) head++
    if (i >= len - 1 && i - lastNan >= len) out[i] = src[dq[head]]
  }
  return out
}

export function sum(src: Series, len: number): Series {
  const m = sma(src, len)
  for (let i = 0; i < m.length; i++) m[i] *= len
  return m
}

export function cum(src: Series): Series {
  const out = new Float64Array(src.length)
  let s = 0
  for (let i = 0; i < src.length; i++) {
    if (!Number.isNaN(src[i])) s += src[i]
    out[i] = s
  }
  return out
}

export function change(src: Series, len = 1): Series {
  const out = full(src.length, NaN)
  for (let i = len; i < src.length; i++) out[i] = src[i] - src[i - len]
  return out
}

export function roc(src: Series, len: number): Series {
  const out = full(src.length, NaN)
  for (let i = len; i < src.length; i++) out[i] = (100 * (src[i] - src[i - len])) / src[i - len]
  return out
}

export function rsi(src: Series, len: number): Series {
  const n = src.length
  const up = full(n, NaN)
  const dn = full(n, NaN)
  for (let i = 1; i < n; i++) {
    const d = src[i] - src[i - 1]
    up[i] = Math.max(d, 0)
    dn[i] = Math.max(-d, 0)
  }
  const au = rma(up, len)
  const ad = rma(dn, len)
  const out = full(n, NaN)
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(au[i]) || Number.isNaN(ad[i])) continue
    out[i] = ad[i] === 0 ? 100 : au[i] === 0 ? 0 : 100 - 100 / (1 + au[i] / ad[i])
  }
  return out
}

export function tr(h: Series, l: Series, c: Series): Series {
  const n = h.length
  const out = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    if (i === 0) out[i] = h[i] - l[i]
    else out[i] = Math.max(h[i] - l[i], Math.abs(h[i] - c[i - 1]), Math.abs(l[i] - c[i - 1]))
  }
  return out
}

export function atr(h: Series, l: Series, c: Series, len: number): Series {
  return rma(tr(h, l, c), len)
}

export function cci(src: Series, len: number): Series {
  const n = src.length
  const m = sma(src, len)
  const out = full(n, NaN)
  for (let i = len - 1; i < n; i++) {
    if (Number.isNaN(m[i])) continue
    let dev = 0
    for (let k = 0; k < len; k++) dev += Math.abs(src[i - k] - m[i])
    dev /= len
    out[i] = dev === 0 ? 0 : (src[i] - m[i]) / (0.015 * dev)
  }
  return out
}

export function stoch(src: Series, h: Series, l: Series, len: number): Series {
  const hh = highest(h, len)
  const ll = lowest(l, len)
  const out = full(src.length, NaN)
  for (let i = 0; i < src.length; i++) {
    const r = hh[i] - ll[i]
    if (!Number.isNaN(r)) out[i] = r === 0 ? 50 : (100 * (src[i] - ll[i])) / r
  }
  return out
}

export function wpr(h: Series, l: Series, c: Series, len: number): Series {
  const hh = highest(h, len)
  const ll = lowest(l, len)
  const out = full(c.length, NaN)
  for (let i = 0; i < c.length; i++) {
    const r = hh[i] - ll[i]
    if (!Number.isNaN(r)) out[i] = r === 0 ? -50 : (-100 * (hh[i] - c[i])) / r
  }
  return out
}

export function mfi(src: Series, vol: Series, len: number): Series {
  const n = src.length
  const pos = full(n, NaN)
  const neg = full(n, NaN)
  for (let i = 1; i < n; i++) {
    const mf = src[i] * vol[i]
    const d = src[i] - src[i - 1]
    pos[i] = d > 0 ? mf : 0
    neg[i] = d < 0 ? mf : 0
  }
  const sp = sum(pos, len)
  const sn = sum(neg, len)
  const out = full(n, NaN)
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(sp[i])) continue
    out[i] = sn[i] === 0 ? 100 : 100 - 100 / (1 + sp[i] / sn[i])
  }
  return out
}

export function obv(c: Series, vol: Series): Series {
  const out = new Float64Array(c.length)
  for (let i = 1; i < c.length; i++) out[i] = out[i - 1] + (c[i] > c[i - 1] ? vol[i] : c[i] < c[i - 1] ? -vol[i] : 0)
  return out
}

/** VWAP réinitialisé chaque jour UTC, sur la source donnée (hlc3 par défaut dans Pine). */
export function vwap(src: Series, vol: Series, t: Series): Series {
  const out = new Float64Array(src.length)
  let pv = 0
  let vv = 0
  let day = -1
  for (let i = 0; i < src.length; i++) {
    const d = Math.floor(t[i] / 86400000)
    if (d !== day) { pv = 0; vv = 0; day = d }
    pv += src[i] * vol[i]
    vv += vol[i]
    out[i] = vv > 0 ? pv / vv : src[i]
  }
  return out
}

export function macd(src: Series, fast: number, slow: number, signal: number): [Series, Series, Series] {
  const f = ema(src, fast)
  const s = ema(src, slow)
  const line = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) line[i] = f[i] - s[i]
  const sig = ema(line, signal)
  const hist = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) hist[i] = line[i] - sig[i]
  return [line, sig, hist]
}

export function bb(src: Series, len: number, mult: number): [Series, Series, Series] {
  const mid = sma(src, len)
  const sd = stdev(src, len)
  const up = new Float64Array(src.length)
  const lo = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) {
    up[i] = mid[i] + mult * sd[i]
    lo[i] = mid[i] - mult * sd[i]
  }
  return [mid, up, lo]
}

export function kc(src: Series, h: Series, l: Series, c: Series, len: number, mult: number): [Series, Series, Series] {
  const mid = ema(src, len)
  const rng = ema(tr(h, l, c), len)
  const up = new Float64Array(src.length)
  const lo = new Float64Array(src.length)
  for (let i = 0; i < src.length; i++) {
    up[i] = mid[i] + mult * rng[i]
    lo[i] = mid[i] - mult * rng[i]
  }
  return [mid, up, lo]
}

/** Retourne [+DI, -DI, ADX], comme ta.dmi(diLength, adxSmoothing). */
export function dmi(h: Series, l: Series, c: Series, diLen: number, adxLen: number): [Series, Series, Series] {
  const n = h.length
  const pdm = full(n, NaN)
  const mdm = full(n, NaN)
  for (let i = 1; i < n; i++) {
    const up = h[i] - h[i - 1]
    const dn = l[i - 1] - l[i]
    pdm[i] = up > dn && up > 0 ? up : 0
    mdm[i] = dn > up && dn > 0 ? dn : 0
  }
  const trr = rma(tr(h, l, c), diLen)
  const p = rma(pdm, diLen)
  const m = rma(mdm, diLen)
  const plus = full(n, NaN)
  const minus = full(n, NaN)
  const dx = full(n, NaN)
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(trr[i]) || Number.isNaN(p[i]) || Number.isNaN(m[i])) continue
    plus[i] = trr[i] === 0 ? 0 : (100 * p[i]) / trr[i]
    minus[i] = trr[i] === 0 ? 0 : (100 * m[i]) / trr[i]
    const s = plus[i] + minus[i]
    dx[i] = s === 0 ? 0 : (100 * Math.abs(plus[i] - minus[i])) / s
  }
  return [plus, minus, rma(dx, adxLen)]
}

/** Retourne [supertrend, direction] ; direction -1 = tendance haussière, 1 = baissière (convention Pine). */
export function supertrend(h: Series, l: Series, c: Series, factor: number, atrLen: number): [Series, Series] {
  const n = h.length
  const a = atr(h, l, c, atrLen)
  const st = full(n, NaN)
  const dir = full(n, NaN)
  let prevUp = NaN
  let prevLo = NaN
  let prevSt = NaN
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(a[i])) continue
    const mid = (h[i] + l[i]) / 2
    let up = mid + factor * a[i]
    let lo = mid - factor * a[i]
    const pc = i > 0 ? c[i - 1] : NaN
    if (!Number.isNaN(prevLo)) lo = lo > prevLo || pc < prevLo ? lo : prevLo
    if (!Number.isNaN(prevUp)) up = up < prevUp || pc > prevUp ? up : prevUp
    let d: number
    if (Number.isNaN(prevSt)) d = 1
    else if (prevSt === prevUp) d = c[i] > up ? -1 : 1
    else d = c[i] < lo ? 1 : -1
    const s = d === -1 ? lo : up
    st[i] = s
    dir[i] = d
    prevUp = up
    prevLo = lo
    prevSt = s
  }
  return [st, dir]
}

/** Valeur de la régression linéaire sur `len` barres, prolongée de `offset` barres vers le passé. */
export function linreg(src: Series, len: number, offset: number): Series {
  const n = src.length
  const out = full(n, NaN)
  for (let i = len - 1; i < n; i++) {
    let sx = 0, sy = 0, sxy = 0, sxx = 0
    let ok = true
    for (let k = 0; k < len; k++) {
      const y = src[i - len + 1 + k]
      if (Number.isNaN(y)) { ok = false; break }
      sx += k; sy += y; sxy += k * y; sxx += k * k
    }
    if (!ok) continue
    const slope = (len * sxy - sx * sy) / (len * sxx - sx * sx || 1)
    const icpt = (sy - slope * sx) / len
    out[i] = icpt + slope * (len - 1 - offset)
  }
  return out
}

/** Pivot haut confirmé : à la barre i, vaut le haut de la barre i - right s'il domine left barres avant et right après. */
export function pivothigh(src: Series, left: number, right: number): Series {
  return pivot(src, left, right, true)
}

export function pivotlow(src: Series, left: number, right: number): Series {
  return pivot(src, left, right, false)
}

function pivot(src: Series, left: number, right: number, high: boolean): Series {
  const n = src.length
  const out = full(n, NaN)
  for (let i = left + right; i < n; i++) {
    const p = i - right
    const v = src[p]
    if (Number.isNaN(v)) continue
    let ok = true
    for (let k = p - left; k <= p + right && ok; k++) {
      if (k === p) continue
      const x = src[k]
      if (Number.isNaN(x)) ok = false
      else if (high ? (k < p ? x > v : x >= v) : (k < p ? x < v : x <= v)) ok = false
    }
    if (ok) out[i] = v
  }
  return out
}

export function crossover(a: Series, b: Series): Series {
  const out = new Float64Array(a.length)
  for (let i = 1; i < a.length; i++) out[i] = a[i] > b[i] && a[i - 1] <= b[i - 1] ? 1 : 0
  return out
}

export function crossunder(a: Series, b: Series): Series {
  const out = new Float64Array(a.length)
  for (let i = 1; i < a.length; i++) out[i] = a[i] < b[i] && a[i - 1] >= b[i - 1] ? 1 : 0
  return out
}

/** Vrai si la valeur dépasse chacune des `len` valeurs précédentes. */
export function rising(src: Series, len: number): Series {
  const out = new Float64Array(src.length)
  const prevMax = shift(highest(src, len), 1)
  for (let i = 0; i < src.length; i++) out[i] = src[i] > prevMax[i] ? 1 : 0
  return out
}

export function falling(src: Series, len: number): Series {
  const out = new Float64Array(src.length)
  const prevMin = shift(lowest(src, len), 1)
  for (let i = 0; i < src.length; i++) out[i] = src[i] < prevMin[i] ? 1 : 0
  return out
}

export function barssince(cond: Series): Series {
  const out = full(cond.length, NaN)
  let last = -1
  for (let i = 0; i < cond.length; i++) {
    if (truthy(cond[i])) last = i
    if (last >= 0) out[i] = i - last
  }
  return out
}

export function valuewhen(cond: Series, src: Series, occurrence: number): Series {
  const out = full(cond.length, NaN)
  const hits: number[] = []
  for (let i = 0; i < cond.length; i++) {
    if (truthy(cond[i])) hits.push(src[i])
    if (hits.length > occurrence) out[i] = hits[hits.length - 1 - occurrence]
  }
  return out
}

export function truthy(x: number): boolean {
  return x === x && x !== 0
}
