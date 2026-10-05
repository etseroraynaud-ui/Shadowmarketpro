// RiskEngine : taille des positions et garde-fous. Il ne crée ni ne modifie aucun signal ; il peut
// seulement refuser une entrée (arrêt manuel, état incohérent, taille impossible).

import { existsSync } from 'node:fs'
import type { BotConfig } from '../config.ts'
import type { AssetInfo } from '../exec/exchange.ts'

/** Valeur minimale d'un ordre sur Hyperliquid. */
export const MIN_NOTIONAL_USD = 10

export type SizeDecision = { ok: true; size: number; notional: number } | { ok: false; reason: string }

export class RiskEngine {
  readonly cfg: BotConfig
  readonly asset: AssetInfo

  constructor(cfg: BotConfig, asset: AssetInfo) {
    this.cfg = cfg
    this.asset = asset
  }

  /** Raison de refuser toute nouvelle entrée, ou null. */
  entryBlocked(halted: string | null): string | null {
    if (halted) return `ordres arrêtés : ${halted}`
    if (existsSync(this.cfg.killFile)) return `arrêt manuel (${this.cfg.killFile} présent)`
    return null
  }

  /**
   * Taille d'une entrée : capital × part engagée × levier, comme le backtest (qtyPct, leverage),
   * plafonnée, arrondie vers le bas au pas de taille de l'actif.
   */
  entrySize(equity: number, price: number): SizeDecision {
    if (!(equity > 0)) return { ok: false, reason: `capital nul ou négatif (${equity})` }
    if (!(price > 0)) return { ok: false, reason: `prix invalide (${price})` }
    const target = Math.min((equity * this.cfg.equityPct) / 100 * this.cfg.leverage, this.cfg.maxNotionalUsd)
    const step = 10 ** -this.asset.szDecimals
    const size = Math.floor(target / price / step + 1e-9) * step
    const notional = size * price
    if (notional < MIN_NOTIONAL_USD) return { ok: false, reason: `position trop petite (${notional.toFixed(2)} $ < ${MIN_NOTIONAL_USD} $)` }
    return { ok: true, size: +size.toFixed(this.asset.szDecimals), notional }
  }

  /** Quantité du TP1 : tp1QtyPct % de la position, arrondie vers le bas ; 0 si trop petite. */
  tp1Size(position: number, pct: number, price: number): number {
    const step = 10 ** -this.asset.szDecimals
    const sz = Math.floor((position * Math.min(100, Math.max(0, pct))) / 100 / step + 1e-9) * step
    return sz * price >= MIN_NOTIONAL_USD ? +sz.toFixed(this.asset.szDecimals) : 0
  }

  /** Levier du compte chez l'exchange : assez de marge pour la position et ses frais. */
  accountLeverage(): number {
    return Math.min(this.asset.maxLeverage, Math.ceil(this.cfg.leverage) + 1)
  }
}
