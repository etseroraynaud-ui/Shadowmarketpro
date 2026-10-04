// Moteur d'exécution : rejoue les signaux barre par barre comme un compte réel.
//
// Ordre des événements dans une barre i :
//   1. ordres en attente (signal de la clôture i-1) exécutés à l'ouverture de i ;
//   2. sortie forcée après N barres, exécutée à l'ouverture ;
//   3. stop, objectif et stop suiveur testés sur le haut et le bas de la barre. Si l'ouverture
//      a déjà franchi un niveau, l'ordre est rempli à l'ouverture (gap). Si le stop et
//      l'objectif sont tous deux touchés dans la barre, le stop passe en premier (hypothèse
//      prudente : l'ordre réel des prix dans la barre est inconnu) ;
//   4. capital évalué à la clôture ;
//   5. signaux de la clôture i lus : ordre pour l'ouverture i+1 (ou exécuté à la clôture
//      en mode « close »).
// Une seule position à la fois, pas de pyramidage. Un signal d'entrée opposé ferme la
// position en cours (et la retourne si les deux sens sont autorisés).

import type { BacktestResult, Bars, ExitReason, Msg, Settings, Signals, Trade } from './types.ts'
import { computeMetrics } from './metrics.ts'

interface Position {
  dir: 1 | -1
  qty: number
  entryPrice: number
  entryIdx: number
  entryTime: number
  entryFee: number
  notional: number
  equityAtEntry: number
  stop: number
  target: number
  trailDist: number
  trailStop: number
  best: number
  worst: number
}

type Pending = { kind: 'enter'; dir: 1 | -1; sigIdx: number } | { kind: 'exit' } | { kind: 'reverse'; dir: 1 | -1; sigIdx: number }

export function windowIndices(bars: Bars, s: Settings): { start: number; end: number; split: number } {
  let start = 0
  let end = bars.n - 1
  if (s.from != null) while (start < bars.n && bars.t[start] < s.from) start++
  if (s.to != null) while (end >= 0 && bars.t[end] > s.to) end--
  let split = -1
  if (s.splitTime != null) {
    split = start
    while (split <= end && bars.t[split] < s.splitTime) split++
    if (split <= start || split > end) split = -1
  }
  return { start, end, split }
}

export function runBacktest(bars: Bars, sig: Signals, s: Settings): BacktestResult {
  const n = bars.n
  const { o, h, l, c, t } = bars
  const warnings: Msg[] = []
  const { start, end, split } = windowIndices(bars, s)
  if (n < 2 || end - start < 1) {
    throw new Error('not enough bars in the selected window')
  }
  const allowLong = s.direction !== 'short'
  const allowShort = s.direction !== 'long'
  const fee = Math.max(0, s.feePct) / 100
  const slip = Math.max(0, s.slippagePct) / 100
  const capital = s.capital > 0 ? s.capital : 10000

  const equity = new Float64Array(n)
  const position = new Int8Array(n)
  const trades: Trade[] = []
  let realized = 0
  let pos: Position | null = null
  let pending: Pending | null = null
  let ruined = false
  let noStopForRisk = false

  const buyPx = (p: number) => p * (1 + slip)
  const sellPx = (p: number) => p * (1 - slip)
  const orderFee = (notional: number) => notional * fee + Math.max(0, s.feeFixed)

  const stopDistAt = (sigIdx: number, price: number): number => {
    const d = sig.stopLoss ? sig.stopLoss[sigIdx] : NaN
    if (d === d && d > 0) return d
    if (s.stopLossPct != null && s.stopLossPct > 0) return (price * s.stopLossPct) / 100
    return NaN
  }
  const targetDistAt = (sigIdx: number, price: number): number => {
    const d = sig.takeProfit ? sig.takeProfit[sigIdx] : NaN
    if (d === d && d > 0) return d
    if (s.takeProfitPct != null && s.takeProfitPct > 0) return (price * s.takeProfitPct) / 100
    return NaN
  }

  const open = (i: number, dir: 1 | -1, rawPrice: number, sigIdx: number) => {
    const eq = capital + realized
    if (eq <= 0) { ruined = true; return }
    const px = dir === 1 ? buyPx(rawPrice) : sellPx(rawPrice)
    const sd = stopDistAt(sigIdx, px)
    const td = targetDistAt(sigIdx, px)
    let notional: number
    if (s.sizing === 'fixed') notional = Math.min(s.sizeValue, eq * Math.max(1, s.maxLeverage))
    else if (s.sizing === 'risk') {
      if (sd === sd && sd > 0) {
        const qtyRisk = (eq * s.sizeValue) / 100 / sd
        notional = Math.min(qtyRisk * px, eq * Math.max(0.01, s.maxLeverage))
      } else {
        noStopForRisk = true
        notional = eq
      }
    } else notional = (eq * s.sizeValue) / 100
    if (!(notional > 0)) return
    const qty = notional / px
    const entryFee = orderFee(notional)
    realized -= entryFee
    const trailDist = s.trailingPct != null && s.trailingPct > 0 ? (px * s.trailingPct) / 100 : NaN
    pos = {
      dir, qty, entryPrice: px, entryIdx: i, entryTime: t[i], entryFee, notional, equityAtEntry: eq,
      stop: sd === sd ? px - dir * sd : NaN,
      target: td === td ? px + dir * td : NaN,
      trailDist,
      trailStop: trailDist === trailDist ? px - dir * trailDist : NaN,
      best: px, worst: px,
    }
  }

  const close = (i: number, rawPrice: number, reason: ExitReason, limit = false) => {
    const p = pos!
    const px = limit ? rawPrice : p.dir === 1 ? sellPx(rawPrice) : buyPx(rawPrice)
    const exitFee = orderFee(p.qty * px)
    const gross = p.dir * (px - p.entryPrice) * p.qty
    realized += gross - exitFee
    const pnl = gross - exitFee - p.entryFee
    const best = Math.max(p.best, px)
    const worst = Math.min(p.worst, px)
    trades.push({
      id: trades.length + 1,
      dir: p.dir,
      entryIdx: p.entryIdx,
      entryTime: p.entryTime,
      entryPrice: p.entryPrice,
      exitIdx: i,
      exitTime: t[i],
      exitPrice: px,
      qty: p.qty,
      notional: p.notional,
      equityAtEntry: p.equityAtEntry,
      fees: p.entryFee + exitFee,
      pnl,
      pnlPct: pnl / p.notional,
      bars: i - p.entryIdx,
      reason,
      mae: p.dir === 1 ? worst / p.entryPrice - 1 : -(best / p.entryPrice - 1),
      mfe: p.dir === 1 ? best / p.entryPrice - 1 : -(worst / p.entryPrice - 1),
    })
    pos = null
  }

  const execPending = (i: number, price: number) => {
    const pd = pending!
    pending = null
    if (pd.kind === 'exit') { if (pos) close(i, price, 'signal'); return }
    if (pd.kind === 'reverse') {
      if (pos) close(i, price, 'reverse')
      if (!ruined) open(i, pd.dir, price, pd.sigIdx)
      return
    }
    if (!pos && !ruined) open(i, pd.dir, price, pd.sigIdx)
  }

  /** Stops et objectifs dans la barre i ; renvoie true si la position a été fermée. */
  const intrabar = (i: number): boolean => {
    const p = pos!
    const stopLevel = p.dir === 1 ? maxNum(p.stop, p.trailStop) : minNum(p.stop, p.trailStop)
    const stopReason: ExitReason = stopLevel === p.trailStop && stopLevel !== p.stop ? 'trailing' : 'stop'
    if (p.dir === 1) {
      if (stopLevel === stopLevel && o[i] <= stopLevel && i > p.entryIdx) { close(i, o[i], stopReason); return true }
      if (p.target === p.target && o[i] >= p.target && i > p.entryIdx) { close(i, o[i], 'target', true); return true }
      if (stopLevel === stopLevel && l[i] <= stopLevel) { close(i, stopLevel, stopReason); return true }
      if (p.target === p.target && h[i] >= p.target) { close(i, p.target, 'target', true); return true }
    } else {
      if (stopLevel === stopLevel && o[i] >= stopLevel && i > p.entryIdx) { close(i, o[i], stopReason); return true }
      if (p.target === p.target && o[i] <= p.target && i > p.entryIdx) { close(i, o[i], 'target', true); return true }
      if (stopLevel === stopLevel && h[i] >= stopLevel) { close(i, stopLevel, stopReason); return true }
      if (p.target === p.target && l[i] <= p.target) { close(i, p.target, 'target', true); return true }
    }
    return false
  }

  for (let i = 0; i < n; i++) {
    const inWindow = i >= start && i <= end
    if (inWindow) {
      if (pending && s.fill === 'next_open') execPending(i, o[i])
      if (pos && s.maxBars != null && s.maxBars > 0 && i - pos.entryIdx >= s.maxBars) close(i, o[i], 'time')
      if (pos) {
        // Avant les tests intrabarre, l'extrême favorable de la barre n'est pas encore connu.
        if (!intrabar(i) && pos) {
          const p = pos
          p.best = Math.max(p.best, h[i])
          p.worst = Math.min(p.worst, l[i])
          if (p.trailDist === p.trailDist) {
            p.trailStop = p.dir === 1 ? Math.max(p.trailStop, h[i] - p.trailDist) : Math.min(p.trailStop, l[i] + p.trailDist)
          }
        }
      }
    }
    // Signaux lus à la clôture de la barre i.
    if (inWindow && i < end && !ruined) {
      const L = allowLong && sig.long[i] === 1
      const S = allowShort && sig.short[i] === 1
      let action: Pending | null = null
      if (pos) {
        const p = pos as Position
        if (p.dir === 1) {
          if (S && !L) action = { kind: 'reverse', dir: -1, sigIdx: i }
          else if (sig.exitLong[i] === 1 || (sig.short[i] === 1 && !L)) action = { kind: 'exit' }
        } else {
          if (L && !S) action = { kind: 'reverse', dir: 1, sigIdx: i }
          else if (sig.exitShort[i] === 1 || (sig.long[i] === 1 && !S)) action = { kind: 'exit' }
        }
      } else if (L && !S && sig.exitLong[i] !== 1) action = { kind: 'enter', dir: 1, sigIdx: i }
      else if (S && !L && sig.exitShort[i] !== 1) action = { kind: 'enter', dir: -1, sigIdx: i }
      // Une entrée qui serait exécutée sur la dernière barre de la fenêtre n'aurait aucune durée.
      if (action && action.kind !== 'exit' && s.fill === 'next_open' && i === end - 1) action = pos ? { kind: 'exit' } : null
      if (action) {
        if (s.fill === 'close') { pending = action; execPending(i, c[i]) } else pending = action
      }
    }
    if (inWindow && i === end && pos) close(i, c[i], 'end')
    if (pos) {
      const p = pos as Position
      position[i] = p.dir
      equity[i] = capital + realized + p.dir * (c[i] - p.entryPrice) * p.qty
    } else equity[i] = capital + realized
    if (equity[i] <= 0 && !ruined && inWindow) {
      ruined = true
      if (pos) close(i, c[i], 'end')
      equity[i] = capital + realized
    }
  }
  if (ruined) warnings.push({ fr: 'Le capital est tombé à zéro : la simulation s\'est arrêtée là (compte ruiné).', en: 'Equity fell to zero: the simulation stopped there (account ruined).' })
  if (noStopForRisk) warnings.push({ fr: 'Taille « % risqué » sans stop : 100 % du capital engagé faute de distance de stop. Définissez un stop.', en: '"% risked" sizing without a stop: 100% of equity used for lack of a stop distance. Set a stop.' })

  // Achat conservé : tout le capital acheté à l'ouverture de la première barre de la fenêtre.
  const benchmark = new Float64Array(n)
  const bpx = buyPx(o[start])
  const bfee = orderFee(capital)
  const bqty = (capital - bfee) / bpx
  for (let i = 0; i < n; i++) {
    if (i < start) benchmark[i] = capital
    else if (i <= end) benchmark[i] = bqty * c[i] - (i === end ? orderFee(bqty * c[i]) : 0)
    else benchmark[i] = benchmark[end]
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]

  const drawdown = new Float64Array(n)
  let peak = capital
  for (let i = start; i <= end; i++) {
    peak = Math.max(peak, equity[i])
    drawdown[i] = equity[i] / peak - 1
  }

  const metrics = computeMetrics(bars, equity, position, trades, start, end, capital)
  const benchMetrics = computeMetrics(bars, benchmark, null, [], start, end, capital)
  let inSample = null
  let outSample = null
  if (split > start) {
    inSample = computeMetrics(bars, equity, position, trades.filter(x => x.entryIdx < split), start, split - 1, capital)
    outSample = computeMetrics(bars, equity, position, trades.filter(x => x.entryIdx >= split), split, end, equity[split - 1])
  }
  return { equity, benchmark, drawdown, position, trades, start, end, split, metrics, benchMetrics, inSample, outSample, warnings }
}

function maxNum(a: number, b: number): number {
  if (a !== a) return b
  if (b !== b) return a
  return Math.max(a, b)
}

function minNum(a: number, b: number): number {
  if (a !== a) return b
  if (b !== b) return a
  return Math.min(a, b)
}
