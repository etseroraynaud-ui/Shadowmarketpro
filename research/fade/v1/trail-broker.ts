// COPIE ISOLÉE de lib/strategies/shock/broker.ts (moteur figé de Shock Engine V1), pour l'étude du
// trailing stop (research/preregistration/v1-trailing.md). Le fichier d'origine n'est pas modifié.
// Différences, toutes marquées « [trailing] » :
// - trailing découplé : activation à entrée ± actDist (sinon trail_points = trail_offset, comme le moteur) ;
// - trailing conditionnel : second stop suiveur (x*) activé à la clôture d'une barre en régime agité si la
//   position a déjà atteint un profit latent suffisant (MFE observée), testé ensuite comme les autres stops ;
// - le plus serré des stops actifs s'applique ; conventions d'exécution, de coûts et de trajet intrabarre inchangées.
// Contrôle : avec la spécification « v1 », résultats identiques au moteur figé (test du script d'étude).

// Shock Engine · exécution simulée : le simulateur de TradingView (« broker emulator ») tel que
// le script le configure. Il exécute les décisions de la stratégie (strategy.ts) dans le backtest
// et dans le shadow mode du bot ; en live réel, c'est l'exchange qui exécute.
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
// - commission en % par ordre, glissement en ticks sur les ordres au marché et les stops ;
// - levier en marge croisée, liquidation et financement des perpétuels (voir Costs).

import type { Market } from '../../../lib/strategies/shock/market.ts'
import type { Costs, ShockParams } from '../../../lib/strategies/shock/params.ts'
import type { Decision, EntryTag, PositionView } from '../../../lib/strategies/shock/strategy.ts'

/** [trailing] Spécification d'une variante. R = atrStopMult × ATR d'entrée (risque initial). */
export interface TrailSpec {
  kind: 'v1' | 'classic' | 'decoupled' | 'regime'
  /** decoupled : activation à +actR R, distance distR R. regime : distance distR R. */
  actR?: number
  distR?: number
  /** regime : MFE minimale (en R) déjà atteinte pour activer le stop suiveur conditionnel. */
  profitR?: number
  /** regime : régime de chaque barre (1 = agité), connu à la clôture de la barre. */
  regime?: Int8Array
}

/** Échéances de financement des contrats perpétuels : 00 h, 08 h et 16 h UTC. */
export const FUNDING_MS = 8 * 3600000

export type ExitTag = 'TP1' | 'SL' | 'TRAIL' | 'FLIP' | 'VWAP' | 'REV' | 'END' | 'LIQ'

export interface PositionRecord {
  dir: 1 | -1
  tag: EntryTag
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
  /** Commission et financement. */
  fees: number
  pnlPct: number
  exits: ExitTag[]
  /** Pire et meilleure excursion pendant la position, en ATR d'entrée. */
  maeAtr: number
  mfeAtr: number
  tp1Filled: boolean
  /** Jeu de paramètres qui a ouvert la position. */
  set: number
}

/** Position ouverte dans le broker simulé, avec ses ordres de sortie. */
export interface SimPosition {
  set: number
  dir: 1 | -1
  qty: number
  avg: number
  entryIdx: number
  tag: EntryTag
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
  // [trailing]
  actDist: number
  xActive: boolean
  xBest: number
  xDist: number
}

export class TrailBroker {
  readonly sets: ShockParams[]
  readonly costs: Costs
  /** ATR du jeu `set` à la barre i, mémorisé à l'entrée. */
  readonly atrOf: (set: number, i: number) => number
  m: Market
  pos: SimPosition | null = null
  readonly positions: PositionRecord[] = []
  realized = 0
  fills = 0
  liquidation: { i: number; price: number } | null = null
  private readonly comm: number
  private readonly slipFix: number
  private readonly slipPct: number
  private readonly lev: number
  private readonly mmr: number
  private readonly funding: number
  readonly spec: TrailSpec

  constructor(m: Market, sets: ShockParams[], costs: Costs, atrOf: (set: number, i: number) => number, spec: TrailSpec) {
    this.spec = spec
    this.m = m
    this.sets = sets
    this.costs = costs
    this.atrOf = atrOf
    this.comm = costs.commissionPct / 100
    this.slipFix = costs.slippageTicks * costs.mintick
    this.slipPct = costs.slippagePct / 100
    // Levier en marge croisée (voir Costs) ; sans marge de maintenance, pas de liquidation.
    this.lev = costs.leverage != null && costs.leverage > 0 ? costs.leverage : 1
    this.mmr = costs.maintenancePct != null && costs.maintenancePct >= 0 ? costs.maintenancePct / 100 : NaN
    this.funding = (costs.fundingPct ?? 0) / 100
  }

  /** Barres ajoutées à la fin de la série (même première barre). */
  setMarket(m: Market): void {
    this.m = m
  }

  view(): PositionView | null {
    const q = this.pos
    return q ? { dir: q.dir, set: q.set, avg: q.avg } : null
  }

  dir(): 0 | 1 | -1 {
    return this.pos ? this.pos.dir : 0
  }

  capitalNow(i: number): number {
    const { c } = this.m.bars
    const pos = this.pos
    return this.costs.capital + this.realized + (pos ? pos.dir * (c[i] - pos.avg) * pos.qty : 0)
  }

  private buy(x: number): number {
    return x + this.slipFix + x * this.slipPct
  }

  private sell(x: number): number {
    return x - this.slipFix - x * this.slipPct
  }

  private fill(i: number, qty: number, px: number, tag: ExitTag): void {
    const q = this.pos!
    const fee = px * qty * this.comm
    const pnl = q.dir * (px - q.avg) * qty
    this.realized += pnl - fee
    q.realized += pnl
    q.fees += fee
    q.exitValue += px * qty
    q.exitQty += qty
    q.qty -= qty
    q.exits.push(tag)
    q.hi = Math.max(q.hi, px)
    q.lo = Math.min(q.lo, px)
    this.fills++
    if (q.qty <= 1e-12) {
      const atrE = q.atrAtEntry > 0 ? q.atrAtEntry : 1
      this.positions.push({
        dir: q.dir, tag: q.tag, entryIdx: q.entryIdx, entryPrice: q.avg, qty: q.exitQty, notional: q.notional,
        equityAtEntry: q.equityAtEntry, atrAtEntry: q.atrAtEntry, exitIdx: i, exitPrice: q.exitValue / q.exitQty,
        pnl: q.realized - q.fees, fees: q.fees, pnlPct: (q.realized - q.fees) / q.notional, exits: q.exits,
        maeAtr: q.dir === 1 ? (q.lo - q.avg) / atrE : (q.avg - q.hi) / atrE,
        mfeAtr: q.dir === 1 ? (q.hi - q.avg) / atrE : (q.avg - q.lo) / atrE,
        tp1Filled: q.tp1Filled, set: q.set,
      })
      this.pos = null
    }
  }

  private closeAll(i: number, raw: number, tag: ExitTag, market = true): void {
    const q = this.pos!
    this.fill(i, q.qty, market ? (q.dir === 1 ? this.sell(raw) : this.buy(raw)) : raw, tag)
  }

  private stopTag(q: SimPosition, lvl: number): ExitTag {
    // [trailing] « TRAIL » si l'un des stops suiveurs est le niveau touché
    const t1 = q.trailActive && lvl === q.best - q.dir * q.trailDist
    const t2 = q.xActive && lvl === q.xBest - q.dir * q.xDist
    return (t1 || t2) && lvl !== q.stop ? 'TRAIL' : 'SL'
  }

  private effStop(q: SimPosition): number {
    let s = q.stop
    if (q.trailActive) { const t = q.best - q.dir * q.trailDist; s = q.dir === 1 ? Math.max(s, t) : Math.min(s, t) }
    // [trailing] stop suiveur conditionnel
    if (q.xActive) { const t = q.xBest - q.dir * q.xDist; s = q.dir === 1 ? Math.max(s, t) : Math.min(s, t) }
    return s
  }

  /** [trailing] Risque initial en prix : atrStopMult × max(ATR d'entrée, tick), comme strategy.ts. */
  private riskOf(q: SimPosition): number {
    return this.sets[q.set].atrStopMult * Math.max(q.atrAtEntry, this.costs.mintick)
  }

  /**
   * [trailing] Variante conditionnelle, à la clôture de la barre i (après les exécutions du script) :
   * régime agité à i et MFE déjà atteinte ≥ profitR → stop suiveur à distR R du meilleur prix observé,
   * testé immédiatement à la clôture (comme un ordre de sortie posé à la clôture), puis dans les barres suivantes.
   */
  regimeClose(i: number): void {
    const q = this.pos
    const sp = this.spec
    if (!q || sp.kind !== 'regime' || q.xActive || !q.exitsActive || i <= q.entryIdx || sp.regime![i] !== 1) return
    const R = this.riskOf(q)
    const mfe = q.dir === 1 ? (q.hi - q.avg) / R : (q.avg - q.lo) / R
    if (!(mfe >= sp.profitR!)) return
    q.xActive = true
    q.xBest = q.dir === 1 ? q.hi : q.lo
    q.xDist = sp.distR! * R
    const s = this.effStop(q)
    const c = this.m.bars.c[i]
    if (q.dir === 1 ? c <= s : c >= s) this.closeAll(i, c, 'TRAIL')
  }

  /** Prix auquel le capital, latent compris, tombe à la marge de maintenance ; NaN = jamais. */
  private liqPx(q: SimPosition): number {
    const mmr = this.mmr
    if (mmr !== mmr) return NaN
    const base = this.costs.capital + this.realized
    const px = q.dir === 1 ? (q.avg * q.qty - base) / (q.qty * (1 - mmr)) : (base + q.avg * q.qty) / (q.qty * (1 + mmr))
    return px > 0 ? px : NaN
  }

  /** Liquidation : position fermée au prix donné, le reste du capital est perdu. */
  private liquidate(i: number, px: number): void {
    this.fill(i, this.pos!.qty, px, 'LIQ')
    const left = this.costs.capital + this.realized
    const r = this.positions[this.positions.length - 1]
    r.pnl -= left
    r.pnlPct = r.pnl / r.notional
    this.realized = -this.costs.capital
    this.liquidation = { i, price: px }
  }

  /** Liquidation seule, avant que les ordres de sortie ne soient posés. */
  private liqOnly(i: number): void {
    const { o, h, l } = this.m.bars
    const q = this.pos!
    const L = this.liqPx(q)
    if (!(L > 0)) return
    if (q.dir === 1 ? o[i] <= L : o[i] >= L) this.liquidate(i, o[i])
    else if (q.dir === 1 ? l[i] <= L : h[i] >= L) this.liquidate(i, L)
  }

  private tp1Qty(q: SimPosition): number {
    return q.qty * Math.min(1, Math.max(0, this.sets[q.set].tp1QtyPct / 100))
  }

  private trailAct(q: SimPosition): number {
    // [trailing] activation découplée si actDist est défini
    return q.avg + q.dir * (q.actDist === q.actDist ? q.actDist : q.trailDist)
  }

  /** Test d'un niveau à un prix ponctuel (ouverture ou clôture). */
  private checkAt(i: number, px: number): void {
    const q = this.pos!
    const L = this.liqPx(q)
    if (q.dir === 1 ? px <= L : px >= L) { this.liquidate(i, px); return }
    const s = this.effStop(q)
    if (q.dir === 1 ? px <= s : px >= s) { this.closeAll(i, px, this.stopTag(q, s)); return }
    if (this.sets[q.set].useTP1 && !q.tp1Filled && (q.dir === 1 ? px >= q.tp : px <= q.tp)) {
      q.tp1Filled = true
      this.fill(i, this.tp1Qty(q), px, 'TP1')
      if (!this.pos) return
    }
    if (!q.trailActive && (q.dir === 1 ? px >= this.trailAct(q) : px <= this.trailAct(q))) { q.trailActive = true; q.best = px }
    if (q.trailActive) q.best = q.dir === 1 ? Math.max(q.best, px) : Math.min(q.best, px)
    if (q.xActive) q.xBest = q.dir === 1 ? Math.max(q.xBest, px) : Math.min(q.xBest, px)
  }

  /** Trajet intrabarre de TradingView. */
  private intrabar(i: number): void {
    const { o, h, l, c } = this.m.bars
    const q = this.pos!
    this.checkAt(i, o[i])
    if (!this.pos) return
    const highFirst = h[i] - o[i] < o[i] - l[i]
    const path = highFirst ? [o[i], h[i], l[i], c[i]] : [o[i], l[i], h[i], c[i]]
    for (let k = 1; k < 4 && this.pos; k++) {
      const a = path[k - 1]
      const b = path[k]
      if (b === a) continue
      const favorable = q.dir === 1 ? b > a : b < a
      if (favorable) {
        if (this.sets[q.set].useTP1 && !q.tp1Filled && (q.dir === 1 ? b >= q.tp : b <= q.tp)) {
          q.tp1Filled = true
          this.fill(i, this.tp1Qty(q), q.tp, 'TP1')
          if (!this.pos) return
        }
        if (!q.trailActive && (q.dir === 1 ? b >= this.trailAct(q) : b <= this.trailAct(q))) { q.trailActive = true; q.best = b }
        if (q.trailActive) q.best = q.dir === 1 ? Math.max(q.best, b) : Math.min(q.best, b)
        if (q.xActive) q.xBest = q.dir === 1 ? Math.max(q.xBest, b) : Math.min(q.xBest, b)
      } else {
        const s = this.effStop(q)
        // Un stop placé au-delà du prix de liquidation ne sera jamais atteint.
        const L = this.liqPx(q)
        if ((q.dir === 1 ? b <= L : b >= L) && !(q.dir === 1 ? s >= L : s <= L)) { this.liquidate(i, L); return }
        if (q.dir === 1 ? b <= s : b >= s) {
          const tag = this.stopTag(q, s)
          this.fill(i, q.qty, q.dir === 1 ? this.sell(s) : this.buy(s), tag)
          return
        }
      }
    }
  }

  private open(i: number, dir: 1 | -1, tag: EntryTag, set: number): void {
    const { c } = this.m.bars
    const eq = this.capitalNow(i)
    if (eq <= 0 || this.liquidation) return
    const qty = ((eq * this.costs.qtyPct) / 100) * this.lev / c[i]
    const px = dir === 1 ? this.buy(c[i]) : this.sell(c[i])
    const fee = px * qty * this.comm
    this.realized -= fee
    this.fills++
    this.pos = {
      dir, qty, avg: px, entryIdx: i, tag, set, notional: px * qty, equityAtEntry: eq, atrAtEntry: this.atrOf(set, i), fees: fee, realized: 0,
      exitValue: 0, exitQty: 0, exits: [], exitsActive: false, stop: NaN, tp: NaN, tp1Filled: false, trailDist: NaN,
      trailActive: false, best: NaN, hi: px, lo: px,
      actDist: NaN, xActive: false, xBest: NaN, xDist: NaN,
    }
  }

  /** Étapes 0 et 1 de la barre i : financement, puis ordres de sortie actifs dans la barre. */
  beforeClose(i: number): void {
    const { o, h, l, t } = this.m.bars
    let pos = this.pos
    // 0. Financement des contrats perpétuels, à chaque échéance de 8 h passée en position.
    if (pos && this.funding !== 0 && pos.entryIdx < i) {
      const k = Math.floor(t[i] / FUNDING_MS) - Math.floor(t[i - 1] / FUNDING_MS)
      if (k > 0) {
        const f = k * this.funding * pos.dir * pos.qty * o[i]
        this.realized -= f
        pos.fees += f
      }
    }
    // 1. Ordres de sortie actifs, dans la barre ; avant eux, seule la liquidation peut fermer.
    if (pos) {
      if (pos.exitsActive) this.intrabar(i)
      else this.liqOnly(i)
    }
    pos = this.pos
    if (pos && pos.entryIdx < i) { pos.hi = Math.max(pos.hi, h[i]); pos.lo = Math.min(pos.lo, l[i]) }
  }

  /**
   * Étape 3 de la barre i : exécution à la clôture de ce que le script a demandé. Renvoie les
   * entrées passées (ordre envoyé alors que la position était à plat ou venait d'être retournée).
   */
  afterClose(i: number, d: Decision, last: boolean): { long: boolean; short: boolean } {
    const { c } = this.m.bars
    let placedNow = false
    const q0 = this.pos
    if (q0 && d.exits) {
      q0.stop = d.exits.stop
      q0.tp = d.exits.tp
      q0.trailDist = d.exits.trailDist
      // [trailing] variante découplée : distance et activation exprimées en R
      if (this.spec.kind === 'decoupled') { const R = this.riskOf(q0); q0.trailDist = this.spec.distR! * R; q0.actDist = this.spec.actR! * R }
      if (!q0.exitsActive) { q0.exitsActive = true; placedNow = true }
    }
    if (this.pos && d.close) this.closeAll(i, c[i], d.close)
    if (this.pos && placedNow && !d.long && !d.short) this.checkAt(i, c[i])
    let long = false
    let short = false
    if (d.long) {
      if (this.pos && this.pos.dir === -1) this.closeAll(i, c[i], 'REV')
      if (!this.pos) { this.open(i, 1, d.long.tag, d.long.set); long = true }
    }
    if (d.short) {
      if (this.pos && this.pos.dir === 1) this.closeAll(i, c[i], 'REV')
      if (!this.pos) { this.open(i, -1, d.short.tag, d.short.set); short = true }
    }
    if (last && this.pos) this.closeAll(i, c[i], 'END')
    return { long, short }
  }
}
