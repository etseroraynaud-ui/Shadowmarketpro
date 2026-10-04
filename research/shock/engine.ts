// Shock Engine Intraday 15/day : port fidèle du script Pine v6, avec l'exécution du
// simulateur de TradingView (« broker emulator ») tel que le script le configure.
//
// Exécution reproduite :
// - process_orders_on_close = true : les ordres au marché passés pendant le calcul d'une barre
//   (strategy.entry, strategy.close) sont exécutés à la clôture de cette barre ;
// - les ordres de sortie (strategy.exit) ne sont passés que si une position existait au début du
//   calcul de la barre (bloc « if isLong ») : la barre qui suit l'entrée n'a donc pas de stop. Ils
//   sont testés une première fois à la clôture où ils sont passés, puis dans les barres suivantes ;
// - dans une barre, TradingView suppose le trajet ouverture → plus haut → plus bas → clôture si
//   l'ouverture est plus proche du plus haut, sinon ouverture → plus bas → plus haut → clôture ;
//   stop, objectif et stop suiveur sont testés le long de ce trajet ; une ouverture au-delà d'un
//   niveau est exécutée à l'ouverture ;
// - stop suiveur : activé quand le prix atteint entrée ± trail_points, puis suit l'extrême à
//   trail_offset ; le stop fixe reste actif, le plus serré des deux s'applique ;
// - TP1 : ordre limite sur tp1QtyPct % de la position, une fois par position ; le stop et le stop
//   suiveur couvrent tout le reste (comportement voulu par le script ; TradingView répartit les
//   quantités entre plusieurs strategy.exit de façon plus complexe, à confirmer avec un export) ;
// - commission en % par ordre, glissement en ticks sur les ordres au marché et les stops.
//
// Le filtre 60 min (request.security, lookahead_off) prend, pour chaque barre, la dernière
// barre de 60 min close au plus tard à la clôture de la barre : pas de lecture du futur.

import type { Bars } from '../../lib/backtest/types.ts'
import { sma, ema, stdev, highest, lowest, atr } from '../../lib/backtest/indicators.ts'
import type { Costs, ShockParams } from './params.ts'

const EPS = 1e-10

export interface Market {
  bars: Bars
  tfMin: number
  /** Barres du timeframe supérieur (60 min) pour le filtre de tendance. */
  htf: Bars
  htfMin: number
  /** syminfo.mintick. */
  mintick: number
  memo: Map<string, Float64Array | Uint8Array>
}

export function makeMarket(bars: Bars, tfMin: number, htf: Bars, htfMin = 60, mintick = 0.01): Market {
  return { bars, tfMin, htf, htfMin, mintick, memo: new Map() }
}

const MEMO_MAX = 64

function memo<T extends Float64Array | Uint8Array>(m: Market, key: string, f: () => T): T {
  const hit = m.memo.get(key)
  if (hit) return hit as T
  if (m.memo.size >= MEMO_MAX) {
    // Mémoire bornée pendant les optimisations : on garde les séries qui ne dépendent d'aucun paramètre.
    for (const k of [...m.memo.keys()]) if (k !== 'r' && k !== 'htfIdx') m.memo.delete(k)
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
function htfIndex(m: Market): Float64Array {
  const { bars, htf } = m
  const idx = new Float64Array(bars.n).fill(-1)
  const tfMs = m.tfMin * 60000
  const hMs = m.htfMin * 60000
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
  const htfIdx = memo(m, 'htfIdx', () => htfIndex(m))
  const htfSma = memo(m, `htfSma:${p.htfEmaLen}`, () => sma(m.htf.c, p.htfEmaLen))
  const htfVal = memo(m, `htfVal:${p.htfEmaLen}`, () => {
    const out = new Float64Array(n).fill(NaN)
    for (let i = 0; i < n; i++) {
      const k = htfIdx[i]
      if (k >= 0) out[i] = htfSma[k]
    }
    return out
  })
  const htfPrev = memo(m, `htfPrev:${p.htfEmaLen}:${p.htfSlopeMode}:${p.htfSlopeBars}`, () => {
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

export type ExitTag = 'TP1' | 'SL' | 'TRAIL' | 'FLIP' | 'VWAP' | 'REV' | 'END'

export interface PositionRecord {
  dir: 1 | -1
  tag: 'IMP' | 'μIMP' | 'FADE'
  entryIdx: number
  entryPrice: number
  qty: number
  notional: number
  equityAtEntry: number
  atrAtEntry: number
  exitIdx: number
  /** Prix de sortie moyen pondéré. */
  exitPrice: number
  pnl: number
  fees: number
  pnlPct: number
  exits: ExitTag[]
  /** Pire et meilleure excursion pendant la position, en ATR d'entrée. */
  maeAtr: number
  mfeAtr: number
  tp1Filled: boolean
}

export interface ShockResult {
  equity: Float64Array
  position: Int8Array
  positions: PositionRecord[]
  fills: number
  start: number
  end: number
  /** Ordres d'entrée passés (signal effectif), pour les diagnostics. */
  entryLong: Uint8Array
  entryShort: Uint8Array
  prep: Prepared
}

interface Pos {
  dir: 1 | -1
  qty: number
  avg: number
  entryIdx: number
  tag: PositionRecord['tag']
  notional: number
  equityAtEntry: number
  atrAtEntry: number
  fees: number
  realized: number
  exitValue: number
  exitQty: number
  exits: ExitTag[]
  // Ordres de sortie
  exitsActive: boolean
  stop: number
  tp: number
  tp1Filled: boolean
  trailDist: number
  trailActive: boolean
  best: number
  hi: number
  lo: number
}

export function runShock(m: Market, p: ShockParams, costs: Costs, start = 0, end = m.bars.n - 1): ShockResult {
  const { bars } = m
  const { o, h, l, c } = bars
  const n = bars.n
  const pr = prepare(m, p)
  const effCooldown = p.highActivityMode ? Math.max(Math.trunc(p.cooldownBars / 2), 2) : p.cooldownBars
  const comm = costs.commissionPct / 100
  const slipFix = costs.slippageTicks * costs.mintick
  const slipPct = costs.slippagePct / 100
  const buy = (x: number) => x + slipFix + x * slipPct
  const sell = (x: number) => x - slipFix - x * slipPct

  const equity = new Float64Array(n)
  const position = new Int8Array(n)
  const entryLong = new Uint8Array(n)
  const entryShort = new Uint8Array(n)
  const positions: PositionRecord[] = []
  let realized = 0
  let fills = 0
  let pos: Pos | null = null

  // Variables « var » du script.
  let lastTradeBar = NaN
  let lastWasFade = false
  let entryPrice = NaN
  let entryATR = NaN
  let tp1Hit = false
  let entryRef = NaN
  let mfeFlip = NaN
  let prevExecPos = 0

  const fill = (i: number, qty: number, px: number, tag: ExitTag) => {
    const q = pos!
    const fee = px * qty * comm
    const pnl = q.dir * (px - q.avg) * qty
    realized += pnl - fee
    q.realized += pnl
    q.fees += fee
    q.exitValue += px * qty
    q.exitQty += qty
    q.qty -= qty
    q.exits.push(tag)
    q.hi = Math.max(q.hi, px)
    q.lo = Math.min(q.lo, px)
    fills++
    if (q.qty <= 1e-12) {
      const atrE = q.atrAtEntry > 0 ? q.atrAtEntry : 1
      positions.push({
        dir: q.dir, tag: q.tag, entryIdx: q.entryIdx, entryPrice: q.avg, qty: q.exitQty, notional: q.notional,
        equityAtEntry: q.equityAtEntry, atrAtEntry: q.atrAtEntry, exitIdx: i, exitPrice: q.exitValue / q.exitQty,
        pnl: q.realized - q.fees, fees: q.fees, pnlPct: (q.realized - q.fees) / q.notional, exits: q.exits,
        maeAtr: q.dir === 1 ? (q.lo - q.avg) / atrE : (q.avg - q.hi) / atrE,
        mfeAtr: q.dir === 1 ? (q.hi - q.avg) / atrE : (q.avg - q.lo) / atrE,
        tp1Filled: q.tp1Filled,
      })
      pos = null
    }
  }
  const closeAll = (i: number, raw: number, tag: ExitTag, market = true) => {
    const q = pos!
    fill(i, q.qty, market ? (q.dir === 1 ? sell(raw) : buy(raw)) : raw, tag)
  }
  const stopTag = (q: Pos, lvl: number): ExitTag => (q.trailActive && lvl === q.best - q.dir * q.trailDist && lvl !== q.stop ? 'TRAIL' : 'SL')
  const effStop = (q: Pos) => {
    if (!q.trailActive) return q.stop
    const t = q.best - q.dir * q.trailDist
    return q.dir === 1 ? Math.max(q.stop, t) : Math.min(q.stop, t)
  }
  const tp1Qty = (q: Pos) => q.qty * Math.min(1, Math.max(0, p.tp1QtyPct / 100))
  const trailAct = (q: Pos) => q.avg + q.dir * q.trailDist

  /** Test d'un niveau à un prix ponctuel (ouverture ou clôture). */
  const checkAt = (i: number, px: number) => {
    const q = pos!
    const s = effStop(q)
    if (q.dir === 1 ? px <= s : px >= s) { closeAll(i, px, stopTag(q, s)); return }
    if (p.useTP1 && !q.tp1Filled && (q.dir === 1 ? px >= q.tp : px <= q.tp)) {
      q.tp1Filled = true
      fill(i, tp1Qty(q), px, 'TP1')
      if (!pos) return
    }
    if (!q.trailActive && (q.dir === 1 ? px >= trailAct(q) : px <= trailAct(q))) { q.trailActive = true; q.best = px }
    if (q.trailActive) q.best = q.dir === 1 ? Math.max(q.best, px) : Math.min(q.best, px)
  }

  /** Trajet intrabarre de TradingView. */
  const intrabar = (i: number) => {
    const q = pos!
    checkAt(i, o[i])
    if (!pos) return
    const highFirst = h[i] - o[i] < o[i] - l[i]
    const path = highFirst ? [o[i], h[i], l[i], c[i]] : [o[i], l[i], h[i], c[i]]
    for (let k = 1; k < 4 && pos; k++) {
      const a = path[k - 1]
      const b = path[k]
      if (b === a) continue
      const favorable = q.dir === 1 ? b > a : b < a
      if (favorable) {
        if (p.useTP1 && !q.tp1Filled && (q.dir === 1 ? b >= q.tp : b <= q.tp)) {
          q.tp1Filled = true
          fill(i, tp1Qty(q), q.tp, 'TP1')
          if (!pos) return
        }
        if (!q.trailActive && (q.dir === 1 ? b >= trailAct(q) : b <= trailAct(q))) { q.trailActive = true; q.best = b }
        if (q.trailActive) q.best = q.dir === 1 ? Math.max(q.best, b) : Math.min(q.best, b)
      } else {
        const s = effStop(q)
        if (q.dir === 1 ? b <= s : b >= s) {
          const tag = stopTag(q, s)
          fill(i, q.qty, q.dir === 1 ? sell(s) : buy(s), tag)
          return
        }
      }
    }
  }

  const open = (i: number, dir: 1 | -1, tag: PositionRecord['tag']) => {
    const eq = capitalNow(i)
    if (eq <= 0) return
    const qty = (eq * costs.qtyPct) / 100 / c[i]
    const px = dir === 1 ? buy(c[i]) : sell(c[i])
    const fee = px * qty * comm
    realized -= fee
    fills++
    pos = {
      dir, qty, avg: px, entryIdx: i, tag, notional: px * qty, equityAtEntry: eq, atrAtEntry: pr.atr[i], fees: fee, realized: 0,
      exitValue: 0, exitQty: 0, exits: [], exitsActive: false, stop: NaN, tp: NaN, tp1Filled: false, trailDist: NaN,
      trailActive: false, best: NaN, hi: px, lo: px,
    }
  }
  const capitalNow = (i: number) => costs.capital + realized + (pos ? pos.dir * (c[i] - pos.avg) * pos.qty : 0)

  for (let i = 0; i < start; i++) equity[i] = costs.capital
  for (let i = start; i <= end; i++) {
    const inWin = true
    // 1. Ordres de sortie actifs, dans la barre.
    if (pos && pos.exitsActive) intrabar(i)
    if (pos && pos.entryIdx < i) { pos.hi = Math.max(pos.hi, h[i]); pos.lo = Math.min(pos.lo, l[i]) }

    // 2. Calcul du script à la clôture.
    if (inWin) {
      const posNow = pos ? pos.dir : 0
      const isLong = posNow === 1
      const isShort = posNow === -1
      const isFlat = posNow === 0
      const cooldownOK = Number.isNaN(lastTradeBar) || i - lastTradeBar > effCooldown
      const allowLambda = pr.allowLambda[i] === 1
      const enterLong = allowLambda && cooldownOK && (pr.impulseEntryLong[i] === 1 || pr.fadeEntryLong[i] === 1) && p.allowLong
      const enterShort = allowLambda && cooldownOK && (pr.impulseEntryShort[i] === 1 || pr.fadeEntryShort[i] === 1) && p.allowShort
      const last = i === end
      let orderLong = false
      let orderShort = false
      let tagL: PositionRecord['tag'] = 'FADE'
      let tagS: PositionRecord['tag'] = 'FADE'
      if (enterLong && posNow <= 0 && !last) {
        orderLong = true
        tagL = pr.impulseLong[i] ? (pr.mainShock[i] ? 'IMP' : 'μIMP') : 'FADE'
        lastWasFade = pr.fadeLong[i] === 1
        entryPrice = c[i]
        entryATR = pr.atr[i]
        lastTradeBar = i
      }
      if (enterShort && posNow >= 0 && !last) {
        orderShort = true
        tagS = pr.impulseShort[i] ? (pr.mainShock[i] ? 'IMP' : 'μIMP') : 'FADE'
        lastWasFade = pr.fadeShort[i] === 1
        entryPrice = c[i]
        entryATR = pr.atr[i]
        lastTradeBar = i
      }
      const atrSafe = Math.max(Number.isNaN(entryATR) ? pr.atr[i] : entryATR, costs.mintick)
      const ep = Number.isNaN(entryPrice) ? c[i] : entryPrice
      const tp1Long = ep + p.tp1AtrMult * atrSafe
      const tp1Short = ep - p.tp1AtrMult * atrSafe
      let placedNow = false
      let closeTag: ExitTag | null = null
      if (pos && (isLong || isShort)) {
        const q = pos as Pos
        q.stop = isLong ? ep - p.atrStopMult * atrSafe : ep + p.atrStopMult * atrSafe
        q.tp = isLong ? tp1Long : tp1Short
        q.trailDist = p.atrTrailMult * atrSafe
        if (!q.exitsActive) { q.exitsActive = true; placedNow = true }
        if (p.useVWAPExit && lastWasFade && (isLong ? c[i] >= pr.vwap[i] : c[i] <= pr.vwap[i])) closeTag = 'VWAP'
      }
      // Bloc flip exit.
      const justEntered = posNow !== 0 && prevExecPos === 0
      if (justEntered) entryRef = (pos as Pos | null)?.avg ?? NaN
      if (isFlat) entryRef = NaN
      if (justEntered || isFlat) tp1Hit = false
      if (p.useTP1 && !tp1Hit) {
        if (isLong) tp1Hit = h[i] >= tp1Long
        if (isShort) tp1Hit = l[i] <= tp1Short
      }
      if (justEntered) mfeFlip = c[i]
      if (isLong) mfeFlip = Math.max(Number.isNaN(mfeFlip) ? c[i] : mfeFlip, h[i])
      if (isShort) mfeFlip = Math.min(Number.isNaN(mfeFlip) ? c[i] : mfeFlip, l[i])
      if (isFlat) mfeFlip = NaN
      const mfeMove = isLong ? (Number.isNaN(mfeFlip) ? c[i] : mfeFlip) - entryRef : isShort ? entryRef - (Number.isNaN(mfeFlip) ? c[i] : mfeFlip) : 0
      const flipLifeOK = p.flipMinLifeATR <= 0 || mfeMove >= p.flipMinLifeATR * atrSafe
      const main = pr.mainShock[i] === 1
      const rawLong = p.useFlipExit && allowLambda && cooldownOK && ((pr.impulseLong[i] === 1 && (!p.flipMainOnly || main)) || (p.flipIncludeFade && pr.fadeEntryLong[i] === 1))
      const rawShort = p.useFlipExit && allowLambda && cooldownOK && ((pr.impulseShort[i] === 1 && (!p.flipMainOnly || main)) || (p.flipIncludeFade && pr.fadeEntryShort[i] === 1))
      if (isShort && rawLong && !tp1Hit && flipLifeOK) closeTag = 'FLIP'
      if (isLong && rawShort && !tp1Hit && flipLifeOK) closeTag = 'FLIP'
      prevExecPos = posNow

      // 3. Exécutions à la clôture : fermetures au marché, sorties tout juste passées, entrées.
      if (pos && closeTag) closeAll(i, c[i], closeTag)
      if (pos && placedNow && !orderLong && !orderShort) checkAt(i, c[i])
      if (orderLong) {
        if (pos && (pos as Pos).dir === -1) closeAll(i, c[i], 'REV')
        if (!pos) { open(i, 1, tagL); entryLong[i] = 1 }
      }
      if (orderShort) {
        if (pos && (pos as Pos).dir === 1) closeAll(i, c[i], 'REV')
        if (!pos) { open(i, -1, tagS); entryShort[i] = 1 }
      }
      if (last && pos) closeAll(i, c[i], 'END')
    }
    position[i] = pos ? (pos as Pos).dir : 0
    equity[i] = capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { equity, position, positions, fills, start, end, entryLong, entryShort, prep: pr }
}
