// Track record d'un compte Hyperliquid, à partir de ses données publiques (fills, financement,
// valeur du compte) : trades reconstitués, performance, et comparaison trade par trade avec le
// backtest du même préréglage sur les mêmes bougies.
//
// Rien ici ne dépend du réseau : les données entrent déjà téléchargées (page Performance live du
// site, tests).

import type { Bars } from '../backtest/types.ts'
import type { ExitTag, PositionRecord, SimPosition } from '../strategies/shock/broker.ts'
import { cloidKind } from './cloid.ts'
import type { OrderKind } from './cloid.ts'

export interface PublicFill {
  time: number
  coin: string
  px: number
  sz: number
  side: 'buy' | 'sell'
  /** Frais payés (négatif : remise). */
  fee: number
  closedPnl: number
  /** Taille signée de la position avant ce fill. */
  startPosition: number
  tid: number
  oid: number
  cloid: string | null
  liquidation: boolean
}

export interface PublicFunding {
  time: number
  coin: string
  /** USDC reçus (positif) ou payés (négatif). */
  usdc: number
}

/** Origine d'un ordre de sortie : ordre du bot (selon son cloid), ordre manuel, liquidation. */
export type ExitKind = OrderKind | 'manual' | 'liquidation'

/** Un trade réel : de la position à plat jusqu'au retour à plat. */
export interface RoundTrip {
  dir: 1 | -1
  entryTime: number
  /** Prix moyen des fills qui ouvrent ou augmentent la position. */
  entryPx: number
  /** Taille maximale atteinte. */
  qty: number
  /** null : position encore ouverte. */
  exitTime: number | null
  /** Prix moyen des fills de sortie (null : aucune sortie encore). */
  exitPx: number | null
  exitQty: number
  fees: number
  funding: number
  closedPnl: number
  /** closedPnl − frais + financement (hors latent d'une position ouverte). */
  pnl: number
  /** pnl / valeur de la position (prix moyen d'entrée × taille maximale). */
  pnlPct: number
  /** Origine de chaque ordre de sortie, dans l'ordre. */
  exits: ExitKind[]
  /** L'entrée vient d'un ordre du bot. */
  bot: boolean
  fills: number
}

const EPS = 1e-9

interface Building {
  trip: RoundTrip
  entryQty: number
  entryValue: number
  exitValue: number
  lastOid: number | null
}

/**
 * Trades reconstitués à partir des fills d'un actif (dans n'importe quel ordre). Les fills d'une
 * position ouverte avant le premier fill connu sont ignorés (`skipped`), puisque son entrée est
 * inconnue. Un fill qui retourne la position ferme le trade et en ouvre un autre.
 */
export function roundTrips(fills: PublicFill[], funding: PublicFunding[] = []): { trips: RoundTrip[]; skipped: number } {
  const sorted = [...fills].sort((a, b) => a.time - b.time || a.tid - b.tid)
  const done: Building[] = []
  let cur: Building | null = null
  let skipped = 0
  const open = (f: PublicFill, dir: 1 | -1, sz: number, fee: number): Building => ({
    trip: {
      dir, entryTime: f.time, entryPx: f.px, qty: sz, exitTime: null, exitPx: null, exitQty: 0, fees: fee, funding: 0,
      closedPnl: 0, pnl: 0, pnlPct: 0, exits: [], bot: cloidKind(f.cloid) === 'entry', fills: 1,
    },
    entryQty: sz, entryValue: f.px * sz, exitValue: 0, lastOid: null,
  })
  for (const f of sorted) {
    const signed = f.side === 'buy' ? f.sz : -f.sz
    const start = f.startPosition
    if (!cur) {
      if (Math.abs(start) > EPS) { skipped++; continue }
      cur = open(f, signed > 0 ? 1 : -1, f.sz, f.fee)
      continue
    }
    const t = cur.trip
    t.fills++
    if (Math.sign(signed) === t.dir) {
      cur.entryQty += f.sz
      cur.entryValue += f.px * f.sz
      t.qty = Math.max(t.qty, Math.abs(start) + f.sz)
      t.fees += f.fee
      continue
    }
    // Sortie : partielle, totale, ou retournement de la position.
    const q = Math.min(f.sz, Math.abs(start))
    const share = q / f.sz
    cur.exitValue += f.px * q
    t.exitQty += q
    t.exitTime = f.time
    t.fees += f.fee * share
    t.closedPnl += f.closedPnl
    if (cur.lastOid !== f.oid) t.exits.push(f.liquidation ? 'liquidation' : cloidKind(f.cloid) ?? 'manual')
    cur.lastOid = f.oid
    const end = start + signed
    if (Math.abs(end) <= EPS || Math.sign(end) !== t.dir) {
      done.push(cur)
      cur = null
      const rest = f.sz - q
      if (rest > EPS) cur = open(f, signed > 0 ? 1 : -1, rest, f.fee * (1 - share))
    }
  }
  const trips: RoundTrip[] = []
  for (const b of cur ? [...done, cur] : done) {
    const t = b.trip
    if (b === cur) t.exitTime = null
    t.entryPx = b.entryValue / b.entryQty
    t.exitPx = t.exitQty > 0 ? b.exitValue / t.exitQty : null
    for (const e of funding) if (e.time >= t.entryTime && (t.exitTime == null || e.time <= t.exitTime)) t.funding += e.usdc
    t.pnl = t.closedPnl - t.fees + t.funding
    t.pnlPct = t.pnl / (t.entryPx * t.qty)
    trips.push(t)
  }
  return { trips, skipped }
}

/** Valeur du compte à un instant : dernier point connu de l'historique à cet instant ou avant. */
export function valueAt(history: [number, number][], t: number): number {
  let v = NaN
  for (const [ht, hv] of history) {
    if (ht > t) break
    v = hv
  }
  return Number.isFinite(v) ? v : history.length ? history[0][1] : NaN
}

export interface Performance {
  trades: number
  wins: number
  pnl: number
  fees: number
  funding: number
  /** Rendement composé : chaque trade rapporté à la valeur du compte à son entrée. */
  twr: number
  maxDrawdown: number
  profitFactor: number
  avgPct: number
  best: number
  worst: number
  /** Courbe du rendement composé, un point par trade fermé (et le départ). */
  curve: { t: number; value: number; drawdown: number }[]
}

/**
 * Performance des trades fermés. Le rendement de chaque trade est rapporté à la valeur du compte
 * à son entrée : dépôts et retraits ne faussent pas le rendement.
 */
export function performance(trips: RoundTrip[], accountValue: [number, number][], start: number): Performance {
  const closed = trips.filter(t => t.exitTime != null).sort((a, b) => a.exitTime! - b.exitTime!)
  let idx = 1
  let peak = 1
  let maxDd = 0
  let gain = 0
  let loss = 0
  const curve = [{ t: start, value: 1, drawdown: 0 }]
  for (const t of closed) {
    const base = valueAt(accountValue, t.entryTime)
    const r = base > 0 ? t.pnl / base : 0
    idx *= 1 + r
    peak = Math.max(peak, idx)
    const dd = idx / peak - 1
    maxDd = Math.min(maxDd, dd)
    curve.push({ t: t.exitTime!, value: idx, drawdown: dd })
    if (t.pnl > 0) gain += t.pnl
    else loss -= t.pnl
  }
  const pcts = closed.map(t => t.pnlPct)
  return {
    trades: closed.length,
    wins: closed.filter(t => t.pnl > 0).length,
    pnl: closed.reduce((s, t) => s + t.pnl, 0),
    fees: closed.reduce((s, t) => s + t.fees, 0),
    funding: closed.reduce((s, t) => s + t.funding, 0),
    twr: idx - 1,
    maxDrawdown: maxDd,
    profitFactor: loss > 0 ? gain / loss : gain > 0 ? Infinity : NaN,
    avgPct: pcts.length ? pcts.reduce((s, x) => s + x, 0) / pcts.length : NaN,
    best: pcts.length ? Math.max(...pcts) : NaN,
    worst: pcts.length ? Math.min(...pcts) : NaN,
    curve,
  }
}

/** Trade du backtest, en heures (et non en indices de barre). */
export interface BacktestTrip {
  dir: 1 | -1
  /** Clôture de la bougie du signal : l'instant où le bot envoie son ordre. */
  entryTime: number
  entryPx: number
  /** null : position encore ouverte à la dernière bougie close. */
  exitTime: number | null
  exitPx: number | null
  pnlPct: number
  exits: ExitTag[]
}

/**
 * Trades du backtest. Une sortie à la clôture (retournement, VWAP…) est datée de la clôture ; une
 * sortie dans la bougie (stop, TP1, stop suiveur), de l'ouverture de cette bougie. Une position
 * fermée seulement par la fin des données (« END ») est encore ouverte.
 */
export function backtestTrips(bars: Bars, positions: PositionRecord[], open: SimPosition | null, step: number): BacktestTrip[] {
  const intrabar = (e: ExitTag) => e === 'SL' || e === 'TP1' || e === 'TRAIL' || e === 'LIQ'
  const out: BacktestTrip[] = positions.map(p => {
    const last = p.exits[p.exits.length - 1]
    const end = last === 'END'
    return {
      dir: p.dir, entryTime: bars.t[p.entryIdx] + step, entryPx: p.entryPrice,
      exitTime: end ? null : bars.t[p.exitIdx] + (intrabar(last) ? 0 : step), exitPx: end ? null : p.exitPrice, pnlPct: p.pnlPct,
      exits: end ? p.exits.slice(0, -1) : p.exits,
    }
  })
  if (open) {
    const c = bars.c[bars.n - 1]
    out.push({ dir: open.dir, entryTime: bars.t[open.entryIdx] + step, entryPx: open.avg, exitTime: null, exitPx: null, pnlPct: open.dir * (c - open.avg) / open.avg, exits: open.exits })
  }
  return out
}

export type MatchStatus = 'match' | 'exit-diff' | 'open' | 'missing-live' | 'extra-live'

export interface MatchRow {
  status: MatchStatus
  backtest: BacktestTrip | null
  live: RoundTrip | null
  /** Écart du prix d'entrée réel au prix du backtest, en fraction, dans le sens du trade (négatif : moins bien). */
  entrySlip: number
}

/**
 * Trades réels face aux trades du backtest, depuis `since`. Un trade réel correspond à un trade du
 * backtest de même sens dont il suit le signal de moins d'une bougie ; ses sorties correspondent si
 * elles ont lieu à moins d'une bougie de celles du backtest.
 */
export function compareTrips(live: RoundTrip[], backtest: BacktestTrip[], step: number, since: number): MatchRow[] {
  const bt = backtest.filter(b => b.entryTime >= since)
  const lv = live.filter(l => l.entryTime >= since - step)
  const used = new Set<RoundTrip>()
  const rows: MatchRow[] = []
  for (const b of bt) {
    const l = lv.find(x => !used.has(x) && x.dir === b.dir && x.entryTime >= b.entryTime - 60000 && x.entryTime < b.entryTime + step)
    if (!l) { rows.push({ status: 'missing-live', backtest: b, live: null, entrySlip: NaN }); continue }
    used.add(l)
    const slip = b.dir * (b.entryPx - l.entryPx) / b.entryPx
    let status: MatchStatus
    if (b.exitTime == null || l.exitTime == null) status = b.exitTime == null && l.exitTime == null ? 'open' : 'exit-diff'
    else status = Math.abs(l.exitTime - b.exitTime) <= step ? 'match' : 'exit-diff'
    rows.push({ status, backtest: b, live: l, entrySlip: slip })
  }
  for (const l of lv) if (!used.has(l)) rows.push({ status: 'extra-live', backtest: null, live: l, entrySlip: NaN })
  return rows.sort((a, b) => (a.backtest ?? a.live)!.entryTime - (b.backtest ?? b.live)!.entryTime)
}
