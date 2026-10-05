// Shock Engine · marché et indicateurs : toutes les séries du script qui ne dépendent pas de la
// position (chocs, lambda, filtres, ATR, VWAP, signaux d'entrée bruts), calculées d'un bloc et
// sans lecture du futur : la valeur de la barre i ne dépend que des barres 0..i.
//
// Le filtre HTF (request.security, lookahead_off) prend, pour chaque barre, la dernière barre HTF
// close au plus tard à la clôture de la barre.

import type { Bars } from '../../backtest/types.ts'
import { sma, ema, stdev, highest, lowest, atr } from '../../backtest/indicators.ts'
import { resample } from '../../backtest/data.ts'
import type { ShockParams } from './params.ts'

const EPS = 1e-10

export interface Market {
  bars: Bars
  tfMin: number
  /** Barres 60 min, source du filtre de tendance (regroupées si le script demande plus long). */
  htf: Bars
  htfMin: number
  htfCache: Map<number, Bars>
  /** syminfo.mintick. */
  mintick: number
  memo: Map<string, Float64Array | Uint8Array>
}

export function makeMarket(bars: Bars, tfMin: number, htf: Bars, htfMin = 60, mintick = 0.01): Market {
  return { bars, tfMin, htf, htfMin, mintick, memo: new Map(), htfCache: new Map() }
}

const MEMO_MAX = 64

function memo<T extends Float64Array | Uint8Array>(m: Market, key: string, f: () => T): T {
  const hit = m.memo.get(key)
  if (hit) return hit as T
  if (m.memo.size >= MEMO_MAX) {
    // Mémoire bornée pendant les optimisations : on garde les séries qui ne dépendent d'aucun paramètre.
    for (const k of [...m.memo.keys()]) if (k !== 'r' && !k.startsWith('htfIdx')) m.memo.delete(k)
  }
  const v = f()
  m.memo.set(key, v)
  return v
}

/** Sous-marché [a, b] : les indicateurs ne sont calculés que sur cette tranche (préchauffage compris). */
export function sliceMarket(m: Market, a: number, b: number): Market {
  const s = m.bars
  const bars: Bars = {
    n: b - a + 1, t: s.t.subarray(a, b + 1), o: s.o.subarray(a, b + 1), h: s.h.subarray(a, b + 1),
    l: s.l.subarray(a, b + 1), c: s.c.subarray(a, b + 1), v: s.v.subarray(a, b + 1),
  }
  return { ...m, bars, memo: new Map() }
}

/** ta.percentrank : part des `len` valeurs précédentes inférieures ou égales à la valeur courante. */
export function percentrank(src: Float64Array, len: number): Float64Array {
  const n = src.length
  const out = new Float64Array(n).fill(NaN)
  let firstValid = 0
  while (firstValid < n && Number.isNaN(src[firstValid])) firstValid++
  for (let i = firstValid + len; i < n; i++) {
    const x = src[i]
    let c = 0
    for (let k = i - len; k < i; k++) if (src[k] <= x) c++
    out[i] = (100 * c) / len
  }
  return out
}

/** Valeur 60 min connue à la clôture de chaque barre du graphique (lookahead_off). */
/** Barres du timeframe du filtre (input « HTF Timeframe »), alignées sur l'époque Unix. */
function htfOf(m: Market, minutes: number): Bars {
  if (minutes === m.htfMin) return m.htf
  let b = m.htfCache.get(minutes)
  if (!b) {
    b = resample(m.htf, minutes * 60000)
    m.htfCache.set(minutes, b)
  }
  return b
}

function htfIndex(m: Market, htf: Bars, minutes: number): Float64Array {
  const { bars } = m
  const idx = new Float64Array(bars.n).fill(-1)
  const tfMs = m.tfMin * 60000
  const hMs = minutes * 60000
  let k = -1
  for (let i = 0; i < bars.n; i++) {
    const closeT = bars.t[i] + tfMs
    while (k + 1 < htf.n && htf.t[k + 1] + hMs <= closeT) k++
    idx[i] = k
  }
  return idx
}

export interface Prepared {
  atr: Float64Array
  vwap: Float64Array
  lamPct: Float64Array
  volZ: Float64Array
  htfVal: Float64Array
  mainShock: Uint8Array
  impulseLong: Uint8Array
  impulseShort: Uint8Array
  fadeLong: Uint8Array
  fadeShort: Uint8Array
  impulseEntryLong: Uint8Array
  impulseEntryShort: Uint8Array
  fadeEntryLong: Uint8Array
  fadeEntryShort: Uint8Array
  allowLambda: Uint8Array
  htfBull: Uint8Array
}

/** Toutes les séries qui ne dépendent pas de l'état de la position. */
export function prepare(m: Market, p: ShockParams): Prepared {
  const { bars } = m
  const { o, h, l, c, v } = bars
  const n = bars.n
  const effKMicro = p.highActivityMode ? Math.max(p.kMicro - 0.2, 0.8) : p.kMicro
  const effOnlyHighLam = p.highActivityMode ? false : p.onlyHighLam
  const effUseCompression = p.highActivityMode ? false : p.useCompression

  const r = memo(m, 'r', () => {
    const out = new Float64Array(n)
    for (let i = 1; i < n; i++) out[i] = Math.log(Math.max(c[i], EPS) / Math.max(c[i - 1], EPS))
    return out
  })
  const z = memo(m, `z:${p.volWin}`, () => {
    const mu = sma(r, p.volWin)
    const sd = stdev(r, p.volWin)
    const out = new Float64Array(n)
    for (let i = 0; i < n; i++) out[i] = sd[i] > EPS ? (r[i] - mu[i]) / sd[i] : 0
    return out
  })
  const shockKey = `${p.volWin}:${p.kMain}:${p.useMicroShock}:${effKMicro}`
  const mainShock = memo(m, `main:${shockKey}`, () => {
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) out[i] = Math.abs(z[i]) > p.kMain ? 1 : 0
    return out
  })
  const shock = memo(m, `shock:${shockKey}`, () => {
    const out = new Uint8Array(n)
    for (let i = 0; i < n; i++) {
      const za = Math.abs(z[i])
      out[i] = za > p.kMain || (p.useMicroShock && za > effKMicro) ? 1 : 0
    }
    return out
  })
  const lamPct = memo(m, `lam:${shockKey}:${p.lamEmaWin}:${p.lamNormWin}`, () => {
    const dN = new Float64Array(n)
    for (let i = 0; i < n; i++) dN[i] = shock[i]
    return percentrank(ema(dN, p.lamEmaWin), p.lamNormWin)
  })
  const hh = memo(m, `hh:${p.rangeWin}`, () => highest(h, p.rangeWin))
  const ll = memo(m, `ll:${p.rangeWin}`, () => lowest(l, p.rangeWin))
  const volZ = memo(m, `volZ:${p.volZWin}`, () => {
    const mu = sma(v, p.volZWin)
    const sd = stdev(v, p.volZWin)
    const out = new Float64Array(n)
    for (let i = 0; i < n; i++) out[i] = sd[i] > EPS ? (v[i] - mu[i]) / sd[i] : 0
    return out
  })
  const atrV = memo(m, `atr:${p.atrLen}`, () => atr(h, l, c, p.atrLen))
  const atrZ = memo(m, `atrZ:${p.atrLen}:${p.atrZWin}`, () => {
    const mu = sma(atrV, p.atrZWin)
    const sd = stdev(atrV, p.atrZWin)
    const out = new Float64Array(n)
    for (let i = 0; i < n; i++) out[i] = sd[i] > EPS ? (atrV[i] - mu[i]) / sd[i] : 0
    return out
  })
  const vwap = memo(m, `vwap:${p.vwapLen}`, () => {
    const hlc3 = new Float64Array(n)
    for (let i = 0; i < n; i++) hlc3[i] = (h[i] + l[i] + c[i]) / 3
    return sma(hlc3, p.vwapLen)
  })
  const htfBars = htfOf(m, p.htfMinutes)
  const hk = `${p.htfMinutes}:${p.htfEmaLen}`
  const htfIdx = memo(m, `htfIdx:${p.htfMinutes}`, () => htfIndex(m, htfBars, p.htfMinutes))
  const htfSma = memo(m, `htfSma:${hk}`, () => sma(htfBars.c, p.htfEmaLen))
  const htfVal = memo(m, `htfVal:${hk}`, () => {
    const out = new Float64Array(n).fill(NaN)
    for (let i = 0; i < n; i++) {
      const k = htfIdx[i]
      if (k >= 0) out[i] = htfSma[k]
    }
    return out
  })
  const htfPrev = memo(m, `htfPrev:${hk}:${p.htfSlopeMode}:${p.htfSlopeBars}`, () => {
    const out = new Float64Array(n).fill(NaN)
    for (let i = 0; i < n; i++) {
      if (p.htfSlopeMode === 'chart') out[i] = i >= p.htfSlopeBars ? htfVal[i - p.htfSlopeBars] : NaN
      else {
        const k = htfIdx[i] - p.htfSlopeBars
        out[i] = k >= 0 ? htfSma[k] : NaN
      }
    }
    return out
  })

  const mint = m.mintick
  const impulseLong = new Uint8Array(n)
  const impulseShort = new Uint8Array(n)
  const fadeLong = new Uint8Array(n)
  const fadeShort = new Uint8Array(n)
  const impulseEntryLong = new Uint8Array(n)
  const impulseEntryShort = new Uint8Array(n)
  const fadeEntryLong = new Uint8Array(n)
  const fadeEntryShort = new Uint8Array(n)
  const allowLambda = new Uint8Array(n)
  const htfBull = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const sh = shock[i] === 1
    const posShock = sh && r[i] > 0
    const negShock = sh && r[i] < 0
    const highLam = lamPct[i] > p.lamPctThr
    const rng = Math.max(h[i] - l[i], mint)
    const upW = (h[i] - Math.max(o[i], c[i])) / rng
    const dnW = (Math.min(o[i], c[i]) - l[i]) / rng
    const hhPrev = i > 0 && !Number.isNaN(hh[i - 1]) ? hh[i - 1] : hh[i]
    const llPrev = i > 0 && !Number.isNaN(ll[i - 1]) ? ll[i - 1] : ll[i]
    const bodyShare = Math.abs(c[i] - o[i]) / rng
    const closePos = (c[i] - l[i]) / rng
    const iL = posShock && c[i] > hhPrev && upW < p.wickThr && bodyShare > 0.55 && closePos > 0.75
    const iS = negShock && c[i] < llPrev && dnW < p.wickThr
    const fL = negShock && (dnW > p.wickThr || c[i] > llPrev)
    const fS = posShock && (upW > p.wickThr || c[i] < hhPrev)
    const hv = htfVal[i]
    const bull = c[i] > hv
    const bear = c[i] < hv
    const bullStrong = bull && hv > htfPrev[i]
    const htfShortOK = !p.useHTF || bear
    const volImpulseOK = !p.useVolFilter || volZ[i] > p.volZThr
    const volFadeOK = !p.useVolFilter || volZ[i] < p.volFadeMax
    const compressionOK = !effUseCompression || atrZ[i] < p.compThr
    const longRegimeOK = lamPct[i] > p.longLamPct && volZ[i] > 0
    const fadeAllowed = !p.directionalOnly
    const fadeLambdaOK = !p.fadeOnlyLowLam || !highLam
    impulseLong[i] = iL ? 1 : 0
    impulseShort[i] = iS ? 1 : 0
    fadeLong[i] = fL ? 1 : 0
    fadeShort[i] = fS ? 1 : 0
    // Le script exige htfBullStrong pour les longs même si le filtre HTF est désactivé.
    impulseEntryLong[i] = p.useImpulse && iL && bullStrong && longRegimeOK && volImpulseOK && compressionOK ? 1 : 0
    impulseEntryShort[i] = p.useImpulse && iS && htfShortOK && volImpulseOK && compressionOK ? 1 : 0
    fadeEntryLong[i] = fL && fadeAllowed && fadeLambdaOK && volFadeOK ? 1 : 0
    fadeEntryShort[i] = fS && fadeAllowed && fadeLambdaOK && volFadeOK ? 1 : 0
    allowLambda[i] = effOnlyHighLam ? (highLam ? 1 : 0) : 1
    htfBull[i] = bull ? 1 : 0
  }
  return {
    atr: atrV, vwap, lamPct, volZ, htfVal, mainShock, impulseLong, impulseShort, fadeLong, fadeShort,
    impulseEntryLong, impulseEntryShort, fadeEntryLong, fadeEntryShort, allowLambda, htfBull,
  }
}
