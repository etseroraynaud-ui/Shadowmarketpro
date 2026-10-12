// Couche probabiliste · caractéristiques d'un signal, connues à la clôture de la bougie de signal.
//
// Tout vient des séries du moteur (prepare, lib/strategies/shock/market.ts) du jeu de réglages qui
// décide de l'entrée, et des indicateurs de lib/backtest/indicators.ts avec les mêmes formules que
// market.ts (plus haut / plus bas cassé, écart type des rendements, compression ATR). Les variables
// quotidiennes reprennent exactement le calcul de classify (lib/strategies/shock/regimes.ts) : seule
// la dernière journée UTC close avant la clôture de la bougie est lue. Aucun prix postérieur à la
// bougie i n'intervient ; le test « données tronquées » de research/tests/proba.test.ts le vérifie.

import type { Bars } from '../../lib/backtest/types.ts'
import { highest, lowest, sma, stdev } from '../../lib/backtest/indicators.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Market, Prepared } from '../../lib/strategies/shock/market.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import { DAY } from './config.ts'

const EPS = 1e-10

/** Réglages de classify (valeurs par défaut de regimes.ts). */
export const CLASSIFY_OPT = { smaLen: 50, slopeDays: 10, volLen: 20, volLookback: 365 }

/** Contexte quotidien de chaque bougie : dernière journée close, comme classify. */
export interface DailyContext {
  /** Indice de la dernière journée close avant la clôture de la bougie (−1 : aucune). */
  dayOf: Int32Array
  /** Ouverture (ms UTC) de chaque journée. */
  dayT: Float64Array
  close: Float64Array
  sma: Float64Array
  /** Moyenne `slopeDays` jours plus tôt. */
  smaPrev: Float64Array
  /** Écart type des rendements log journaliers sur `volLen` jours. */
  vol: Float64Array
  /** Part des `volLookback` jours précédents dont la volatilité est ≤ (NaN si moins de 60 jours). */
  volPct: Float64Array
  /** Régime de classify : tendance × 2 + volatilité haute, −1 si inconnu. */
  id: Int8Array
}

/** Recalcul de classify avec ses valeurs intermédiaires (identité vérifiée par les tests). */
export function dailyContext(bars: Bars, tfMin: number, regimeBars: Bars, opt = CLASSIFY_OPT): DailyContext {
  const d = resample(regimeBars, DAY)
  const n = d.n
  const s = sma(d.c, opt.smaLen)
  const r = new Float64Array(n)
  for (let i = 1; i < n; i++) r[i] = Math.log(d.c[i] / d.c[i - 1])
  const vol = stdev(r, opt.volLen)
  const id = new Int8Array(n).fill(-1)
  const volPct = new Float64Array(n).fill(NaN)
  const smaPrev = new Float64Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    if (i >= opt.slopeDays) smaPrev[i] = s[i - opt.slopeDays]
    const a = Math.max(0, i - opt.volLookback)
    let below = 0, cnt = 0
    for (let k = a; k < i; k++) {
      if (!Number.isFinite(vol[k])) continue
      cnt++
      if (vol[k] <= vol[i]) below++
    }
    if (Number.isFinite(vol[i]) && cnt >= 60) volPct[i] = below / cnt
    if (i < opt.slopeDays || !Number.isFinite(s[i]) || !Number.isFinite(s[i - opt.slopeDays]) || !Number.isFinite(vol[i])) continue
    if (cnt < 60) continue
    const up = d.c[i] > s[i] && s[i] > s[i - opt.slopeDays]
    const down = d.c[i] < s[i] && s[i] < s[i - opt.slopeDays]
    const trend = up ? 0 : down ? 2 : 1
    id[i] = trend * 2 + (below / cnt > 0.5 ? 1 : 0)
  }
  const dayOf = new Int32Array(bars.n).fill(-1)
  const tfMs = tfMin * 60000
  let k = -1
  for (let i = 0; i < bars.n; i++) {
    const closeT = bars.t[i] + tfMs
    while (k + 1 < n && d.t[k + 1] + DAY <= closeT) k++
    dayOf[i] = k
  }
  return { dayOf, dayT: d.t, close: d.c, sma: s, smaPrev, vol, volPct, id }
}

/** Séries d'un jeu de réglages que prepare() calcule sans les exposer, mêmes formules que market.ts. */
export interface SetExtras {
  /** Écart type des rendements log sur volWin (dénominateur du z-score). */
  sd: Float64Array
  /** Plus haut et plus bas cassés : rangeWin bougies jusqu'à i − 1 (repli sur i comme market.ts). */
  hhPrev: Float64Array
  llPrev: Float64Array
  /** Compression : z-score de l'ATR sur atrZWin. */
  atrZ: Float64Array
}

export function setExtras(bars: Bars, p: ShockParams, pr: Prepared): SetExtras {
  const { h, l, c } = bars
  const n = bars.n
  const r = new Float64Array(n)
  for (let i = 1; i < n; i++) r[i] = Math.log(Math.max(c[i], EPS) / Math.max(c[i - 1], EPS))
  const sd = stdev(r, p.volWin)
  const hh = highest(h, p.rangeWin)
  const ll = lowest(l, p.rangeWin)
  const hhPrev = new Float64Array(n), llPrev = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    hhPrev[i] = i > 0 && !Number.isNaN(hh[i - 1]) ? hh[i - 1] : hh[i]
    llPrev[i] = i > 0 && !Number.isNaN(ll[i - 1]) ? ll[i - 1] : ll[i]
  }
  const mu = sma(pr.atr, p.atrZWin)
  const sdA = stdev(pr.atr, p.atrZWin)
  const atrZ = new Float64Array(n)
  for (let i = 0; i < n; i++) atrZ[i] = sdA[i] > EPS ? (pr.atr[i] - mu[i]) / sdA[i] : 0
  return { sd, hhPrev, llPrev, atrZ }
}

/** Tout ce qu'il faut pour décrire un signal à la clôture de la bougie i. */
export interface SignalContext {
  asset: 'BTC' | 'ETH'
  bars: Bars
  tfMin: number
  mintick: number
  sets: ShockParams[]
  prs: Prepared[]
  /** Jeu qui décide des entrées à chaque bougie (−1 : aucun). */
  select: Int8Array | null
  daily: DailyContext
  extras: SetExtras[]
}

export function signalContext(asset: 'BTC' | 'ETH', m: Market, sets: ShockParams[], prs: Prepared[], select: Int8Array | null, regimeBars: Bars): SignalContext {
  return {
    asset, bars: m.bars, tfMin: m.tfMin, mintick: m.mintick, sets, prs, select,
    daily: dailyContext(m.bars, m.tfMin, regimeBars), extras: sets.map((p, k) => setExtras(m.bars, p, prs[k])),
  }
}

/** Caractéristiques brutes d'un signal (unités d'origine ; transformations dans models.ts). */
export interface SignalFeatures {
  // ---- variables des modèles (§ 3 du plan)
  /** |z| du choc. */
  absZ: number
  /** Volume standardisé. */
  volZ: number
  /** Cassure dans le sens du trade, en ATR d'entrée (≥ 0 pour une entrée impulse). */
  breakAtr: number
  /** Position de la clôture dans la bougie, dans le sens du trade (1 = clôture à l'extrême favorable). */
  closeQ: number
  /** Percentile du clustering des chocs (λ), 0–1. */
  lamPct: number
  /** Écart type des rendements log 15 min sur volWin bougies. */
  rv: number
  /** Percentile de la volatilité journalière 20 j parmi les 365 jours précédents, 0–1. */
  volPct: number
  /** Distance à la moyenne 60 min du filtre HTF, dans le sens du trade, en ATR. */
  htfDist: number
  isShort: number
  isEth: number
  /** Régime de volatilité agité (jeu 1). */
  agitated: number
  // ---- descriptives (non utilisées par les modèles)
  /** z signé. */
  z: number
  /** Mèche opposée au sens du trade, en part de la bougie. */
  wickAgainst: number
  /** Mèche dans le sens du trade (côté de l'ouverture), en part de la bougie. */
  wickWith: number
  bodyShare: number
  /** Compression : z-score de l'ATR. */
  atrZ: number
  /** ATR en part du prix. */
  atrPct: number
  /** Choc micro (|z| ≤ kMain), entrée μIMP. */
  micro: number
  /** Tendance journalière de classify : 0 haussière, 1 neutre, 2 baissière, −1 inconnue. */
  trend: number
  /** Distance log de la clôture à la moyenne journalière 50 j, dans le sens du trade, en écarts types journaliers. */
  trendDist: number
  /** Pente de la moyenne 50 j sur 10 jours, dans le sens du trade. */
  trendSlope: number
  /** Écart type des rendements log journaliers sur 20 jours. */
  dailyVol: number
  /** Jeu de réglages qui décide de l'entrée. */
  set: number
  atr: number
  close: number
}

/** Caractéristiques du signal de sens `dir` à la clôture de la bougie i. */
export function signalFeatures(ctx: SignalContext, i: number, dir: 1 | -1): SignalFeatures {
  const e = ctx.select ? ctx.select[i] : 0
  if (e < 0) throw new Error(`bougie ${i} : aucun jeu de réglages ne décide des entrées`)
  const P = ctx.sets[e], R = ctx.prs[e], X = ctx.extras[e]
  const { o, h, l, c } = ctx.bars
  const rng = Math.max(h[i] - l[i], ctx.mintick)
  const upW = (h[i] - Math.max(o[i], c[i])) / rng
  const dnW = (Math.min(o[i], c[i]) - l[i]) / rng
  const atr = R.atr[i]
  const level = dir === 1 ? X.hhPrev[i] : X.llPrev[i]
  const D = ctx.daily
  const k = D.dayOf[i]
  const dayId = k >= 0 ? D.id[k] : -1
  const dVol = k >= 0 ? D.vol[k] : NaN
  return {
    absZ: Math.abs(R.z[i]),
    volZ: R.volZ[i],
    breakAtr: (dir * (c[i] - level)) / atr,
    closeQ: dir === 1 ? (c[i] - l[i]) / rng : (h[i] - c[i]) / rng,
    lamPct: R.lamPct[i] / 100,
    rv: X.sd[i],
    volPct: k >= 0 ? D.volPct[k] : NaN,
    htfDist: (dir * (c[i] - R.htfVal[i])) / atr,
    isShort: dir === -1 ? 1 : 0,
    isEth: ctx.asset === 'ETH' ? 1 : 0,
    agitated: e === 1 ? 1 : 0,
    z: R.z[i],
    wickAgainst: dir === 1 ? upW : dnW,
    wickWith: dir === 1 ? dnW : upW,
    bodyShare: Math.abs(c[i] - o[i]) / rng,
    atrZ: X.atrZ[i],
    atrPct: atr / c[i],
    micro: R.mainShock[i] === 1 ? 0 : 1,
    trend: dayId >= 0 ? dayId >> 1 : -1,
    trendDist: k >= 0 ? (dir * Math.log(c[i] / D.sma[k])) / dVol : NaN,
    trendSlope: k >= 0 ? dir * (D.sma[k] / D.smaPrev[k] - 1) : NaN,
    dailyVol: dVol,
    set: e,
    atr,
    close: c[i],
  }
}

/** Unités et sens des caractéristiques, pour le schéma du jeu de données. */
export const FEATURE_DOC: Record<keyof SignalFeatures, string> = {
  absZ: '|z| du rendement log de la bougie de signal, standardisé sur volWin bougies (jeu qui décide)',
  volZ: 'volume standardisé sur volZWin bougies',
  breakAtr: 'd·(clôture − niveau cassé)/ATR ; niveau = plus haut (long) ou plus bas (short) des rangeWin bougies jusqu\'à i−1',
  closeQ: 'position de la clôture dans la bougie dans le sens du trade, 0–1',
  lamPct: 'percentile (0–1) de l\'EMA de l\'indicatrice de choc : intensité de clustering (λ du moteur)',
  rv: 'écart type des rendements log 15 min sur volWin bougies (sans annualisation)',
  volPct: 'percentile (0–1) de la volatilité journalière 20 j parmi les 365 jours précédents, dernier jour clos',
  htfDist: 'd·(clôture − moyenne 60 min du filtre HTF)/ATR',
  isShort: '1 si short',
  isEth: '1 si ETH',
  agitated: '1 si régime de volatilité agité (jeu de réglages 1)',
  z: 'z signé du choc',
  wickAgainst: 'mèche opposée au sens du trade / amplitude de la bougie',
  wickWith: 'mèche du côté favorable / amplitude de la bougie',
  bodyShare: '|clôture − ouverture| / amplitude de la bougie',
  atrZ: 'z-score de l\'ATR sur atrZWin bougies (compression)',
  atrPct: 'ATR / clôture',
  micro: '1 si choc micro (|z| ≤ kMain, entrée μIMP)',
  trend: 'tendance journalière de classify au dernier jour clos : 0 haussière, 1 neutre, 2 baissière',
  trendDist: 'd·ln(clôture / moyenne journalière 50 j) / écart type journalier 20 j',
  trendSlope: 'd·(moyenne 50 j / moyenne 50 j dix jours plus tôt − 1)',
  dailyVol: 'écart type des rendements log journaliers sur 20 jours, dernier jour clos',
  set: 'jeu de réglages qui décide de l\'entrée (0 calme, 1 agité)',
  atr: 'ATR du jeu qui décide (atrLen), en prix',
  close: 'clôture de la bougie de signal = prix d\'entrée',
}
