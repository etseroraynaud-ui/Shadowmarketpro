// Shock Engine · décision à la clôture d'une barre : la partie « script » du moteur, sans aucune
// exécution. Elle reçoit la position telle qu'elle est au début du calcul de la barre (après les
// sorties exécutées dans la barre) et renvoie ce que le script demande à la clôture : niveaux des
// ordres de sortie, fermeture au marché, entrées. Le backtest (broker simulé) et le bot live
// (exécution réelle) appellent cette même fonction.
//
// Plusieurs jeux de paramètres : `select[i]` donne le jeu qui décide des entrées à la barre i
// (-1 = pas de nouvelle entrée) ; une position garde jusqu'à sa sortie les réglages du jeu qui l'a
// ouverte (stop, TP1, trailing, VWAP, flip).

import type { Market, Prepared } from './market.ts'
import { prepare } from './market.ts'
import type { ShockParams } from './params.ts'

export type EntryTag = 'IMP' | 'μIMP' | 'FADE'

/** Position ouverte au début du calcul de la barre, telle que le script la voit. */
export interface PositionView {
  dir: 1 | -1
  /** Jeu de paramètres qui a ouvert la position. */
  set: number
  /** Prix moyen d'entrée (strategy.position_avg_price). */
  avg: number
}

/** Ordres de sortie (strategy.exit) de la position ouverte, posés ou remplacés à la clôture. */
export interface ExitLevels {
  stop: number
  /** TP1 : ordre limite sur tp1QtyPct % de la position, une seule fois, si useTP1. */
  tp: number
  useTP1: boolean
  tp1QtyPct: number
  /** Stop suiveur : activé à prix moyen ± trailDist, puis suit l'extrême à trailDist. */
  trailDist: number
}

export interface EntryOrder {
  dir: 1 | -1
  tag: EntryTag
  /** Jeu qui ouvre la position (il la suivra jusqu'à sa sortie). */
  set: number
}

/** Ce que le script demande à la clôture ; les ordres au marché s'exécutent à cette clôture. */
export interface Decision {
  /** Ordres de sortie de la position ouverte au début de la barre (null si à plat). */
  exits: ExitLevels | null
  /** Fermeture au marché de cette position. */
  close: 'VWAP' | 'FLIP' | null
  /** Entrées au marché ; une entrée opposée à la position la retourne. */
  long: EntryOrder | null
  short: EntryOrder | null
}

/** Variables « var » du script, conservées d'une barre à l'autre. */
export interface StrategyState {
  lastTradeBar: number
  lastWasFade: boolean
  entryPrice: number
  entryATR: number
  tp1Hit: boolean
  entryRef: number
  mfeFlip: number
  prevExecPos: number
}

export function initialState(): StrategyState {
  return { lastTradeBar: NaN, lastWasFade: false, entryPrice: NaN, entryATR: NaN, tp1Hit: false, entryRef: NaN, mfeFlip: NaN, prevExecPos: 0 }
}

/** Entrées imposées (tests de timing) : remplacent les signaux du script, sorties inchangées. */
export interface EntryOverride {
  long: Uint8Array
  short: Uint8Array
}

export class ShockStrategy {
  readonly sets: ShockParams[]
  /** Cooldown effectif de chaque jeu (High Activity Mode le divise par deux). */
  readonly cool: number[]
  /** syminfo.mintick. */
  readonly mintick: number
  readonly override: EntryOverride | undefined
  m: Market
  prs: Prepared[]
  select: Int8Array | null
  state: StrategyState

  constructor(m: Market, sets: ShockParams[], mintick: number, select: Int8Array | null = null, override?: EntryOverride, state: StrategyState = initialState()) {
    this.sets = sets
    this.cool = sets.map(p => (p.highActivityMode ? Math.max(Math.trunc(p.cooldownBars / 2), 2) : p.cooldownBars))
    this.mintick = mintick
    this.override = override
    this.m = m
    this.prs = sets.map(p => prepare(m, p))
    this.select = select
    this.state = state
  }

  /**
   * Barres ajoutées à la fin de la série (même première barre) : les séries sont recalculées,
   * l'état est conservé. Les indices des barres déjà vues ne changent pas.
   */
  setMarket(m: Market, select: Int8Array | null): void {
    this.m = m
    this.prs = this.sets.map(p => prepare(m, p))
    this.select = select
  }

  /**
   * Calcul du script à la clôture de la barre i. `pos` : position au début du calcul (après les
   * sorties exécutées dans la barre). `last` : dernière barre de la fenêtre (pas de nouvelle entrée).
   */
  onClose(i: number, pos: PositionView | null, last: boolean): Decision {
    const s = this.state
    const { sets, prs, cool, select, override } = this
    const { h, l, c } = this.m.bars
    const posNow = pos ? pos.dir : 0
    const isLong = posNow === 1
    const isShort = posNow === -1
    const isFlat = posNow === 0
    // Jeu qui décide des entrées (E) et jeu de la position ouverte (Q).
    const e = select ? select[i] : 0
    const qi = pos ? pos.set : e
    const E = e >= 0 ? sets[e] : null
    const ER = e >= 0 ? prs[e] : null
    const Q = qi >= 0 ? sets[qi] : null
    const QR = qi >= 0 ? prs[qi] : null
    const cooldownE = e >= 0 && (Number.isNaN(s.lastTradeBar) || i - s.lastTradeBar > cool[e])
    const cooldownQ = qi >= 0 && (Number.isNaN(s.lastTradeBar) || i - s.lastTradeBar > cool[qi])
    let enterLong = false
    let enterShort = false
    if (E && ER) {
      const allow = ER.allowLambda[i] === 1
      const sigLong = override ? override.long[i] === 1 : ER.impulseEntryLong[i] === 1 || ER.fadeEntryLong[i] === 1
      const sigShort = override ? override.short[i] === 1 : ER.impulseEntryShort[i] === 1 || ER.fadeEntryShort[i] === 1
      enterLong = allow && cooldownE && sigLong && E.allowLong
      enterShort = allow && cooldownE && sigShort && E.allowShort
    }
    let long: EntryOrder | null = null
    let short: EntryOrder | null = null
    if (enterLong && posNow <= 0 && !last) {
      const R = ER!
      long = { dir: 1, tag: R.impulseLong[i] ? (R.mainShock[i] ? 'IMP' : 'μIMP') : 'FADE', set: e }
      s.lastWasFade = R.fadeLong[i] === 1
      s.entryPrice = c[i]
      s.entryATR = R.atr[i]
      s.lastTradeBar = i
    }
    if (enterShort && posNow >= 0 && !last) {
      const R = ER!
      short = { dir: -1, tag: R.impulseShort[i] ? (R.mainShock[i] ? 'IMP' : 'μIMP') : 'FADE', set: e }
      s.lastWasFade = R.fadeShort[i] === 1
      s.entryPrice = c[i]
      s.entryATR = R.atr[i]
      s.lastTradeBar = i
    }
    let exits: ExitLevels | null = null
    let close: Decision['close'] = null
    if (Q && QR) {
      const atrSafe = Math.max(Number.isNaN(s.entryATR) ? QR.atr[i] : s.entryATR, this.mintick)
      const ep = Number.isNaN(s.entryPrice) ? c[i] : s.entryPrice
      const tp1Long = ep + Q.tp1AtrMult * atrSafe
      const tp1Short = ep - Q.tp1AtrMult * atrSafe
      if (pos && (isLong || isShort)) {
        exits = {
          stop: isLong ? ep - Q.atrStopMult * atrSafe : ep + Q.atrStopMult * atrSafe,
          tp: isLong ? tp1Long : tp1Short,
          useTP1: Q.useTP1,
          tp1QtyPct: Q.tp1QtyPct,
          trailDist: Q.atrTrailMult * atrSafe,
        }
        if (Q.useVWAPExit && s.lastWasFade && (isLong ? c[i] >= QR.vwap[i] : c[i] <= QR.vwap[i])) close = 'VWAP'
      }
      // Bloc flip exit.
      const justEntered = posNow !== 0 && s.prevExecPos === 0
      if (justEntered) s.entryRef = pos?.avg ?? NaN
      if (isFlat) s.entryRef = NaN
      if (justEntered || isFlat) s.tp1Hit = false
      if (Q.useTP1 && !s.tp1Hit) {
        if (isLong) s.tp1Hit = h[i] >= tp1Long
        if (isShort) s.tp1Hit = l[i] <= tp1Short
      }
      if (justEntered) s.mfeFlip = c[i]
      if (isLong) s.mfeFlip = Math.max(Number.isNaN(s.mfeFlip) ? c[i] : s.mfeFlip, h[i])
      if (isShort) s.mfeFlip = Math.min(Number.isNaN(s.mfeFlip) ? c[i] : s.mfeFlip, l[i])
      if (isFlat) s.mfeFlip = NaN
      const mfeMove = isLong ? (Number.isNaN(s.mfeFlip) ? c[i] : s.mfeFlip) - s.entryRef : isShort ? s.entryRef - (Number.isNaN(s.mfeFlip) ? c[i] : s.mfeFlip) : 0
      const flipLifeOK = Q.flipMinLifeATR <= 0 || mfeMove >= Q.flipMinLifeATR * atrSafe
      const main = QR.mainShock[i] === 1
      const allowQ = QR.allowLambda[i] === 1
      const rawLong = Q.useFlipExit && allowQ && cooldownQ && ((QR.impulseLong[i] === 1 && (!Q.flipMainOnly || main)) || (Q.flipIncludeFade && QR.fadeEntryLong[i] === 1))
      const rawShort = Q.useFlipExit && allowQ && cooldownQ && ((QR.impulseShort[i] === 1 && (!Q.flipMainOnly || main)) || (Q.flipIncludeFade && QR.fadeEntryShort[i] === 1))
      if (isShort && rawLong && !s.tp1Hit && flipLifeOK) close = 'FLIP'
      if (isLong && rawShort && !s.tp1Hit && flipLifeOK) close = 'FLIP'
    } else if (isFlat) {
      s.entryRef = NaN
      s.tp1Hit = false
      s.mfeFlip = NaN
    }
    s.prevExecPos = posNow
    return { exits, close, long, short }
  }
}
