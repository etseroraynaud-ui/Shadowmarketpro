// Shadow mode : le bot complet sans aucun ordre. Les décisions du Shock Engine sont exécutées par
// le broker simulé du backtest (ShockSession), sur les bougies Hyperliquid, au fil de l'eau.
// C'est exactement le backtest, une bougie à la fois : ce que le shadow mode journalise est ce que
// le backtest aurait fait.

import type { Bars } from '../../../lib/backtest/types.ts'
import { ShockSession } from '../../../lib/strategies/shock/live.ts'
import type { Bar, ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { PositionRecord } from '../../../lib/strategies/shock/broker.ts'
import type { Costs } from '../../../lib/strategies/shock/params.ts'
import type { Journal, TradeLog } from '../journal.ts'

export const SET_NAMES = ['calm', 'agitated']

export class ShadowEngine {
  readonly session: ShockSession
  readonly journal: Journal
  readonly tfMs: number

  constructor(cfg: ShockConfig, costs: Costs, chart: Bars, daily: Bars, journal: Journal) {
    this.journal = journal
    this.tfMs = cfg.tfMin * 60000
    // Tout le cache est rejoué : l'état de la stratégie est celui du backtest sur le même historique.
    this.session = new ShockSession(cfg, costs, chart, 0, { regimeBars: daily })
    const b = this.session.broker
    journal.event('shadow_ready', {
      bars: chart.n, from: iso(chart.t[0]), to: iso(chart.t[chart.n - 1]), positions: b.positions.length,
      open: b.pos ? `${b.pos.dir === 1 ? 'long' : 'short'} ${SET_NAMES[b.pos.set] ?? b.pos.set}` : 'flat', equity: this.session.equity[chart.n - 1],
    })
  }

  /** Bougie close suivante. */
  onBar(bar: Bar, daily?: Bars): void {
    const st = this.session.push(bar, daily)
    const r = this.session.runner
    const ctx = r.context(st.i)
    if (st.missing > 0) this.journal.event('gap', { before: iso(bar.t), missing: st.missing })
    const d = st.decision
    if (d.long || d.short || d.close) {
      this.journal.event('signal', {
        bar: iso(bar.t + this.tfMs), close: bar.c, long: d.long ? `${d.long.tag} ${SET_NAMES[d.long.set]}` : null,
        short: d.short ? `${d.short.tag} ${SET_NAMES[d.short.set]}` : null, exit: d.close, regime: regimeName(ctx.regime),
        sets: ctx.sets,
      })
    }
    for (const p of st.closed) this.journal.trade(this.tradeLog(p))
    const pos = st.position
    this.journal.event('bar', {
      bar: iso(bar.t + this.tfMs), close: bar.c, regime: regimeName(ctx.regime), position: pos ? (pos.dir === 1 ? 'long' : 'short') : 'flat',
      stop: pos?.exitsActive ? pos.stop : null, tp1: pos?.exitsActive && !pos.tp1Filled ? pos.tp : null, equity: st.equity,
    })
  }

  tradeLog(p: PositionRecord): TradeLog {
    const r = this.session.runner
    const t = r.m.bars.t
    const sets = r.context(p.entryIdx).sets
    const s = sets[p.set]
    return {
      mode: this.journal.mode, side: p.dir === 1 ? 'long' : 'short',
      entryTime: iso(t[p.entryIdx] + this.tfMs), exitTime: iso(t[p.exitIdx] + this.tfMs),
      entry: p.entryPrice, exit: p.exitPrice, qty: p.qty, atr: p.atrAtEntry, regime: SET_NAMES[p.set] ?? String(p.set), set: p.set, tag: p.tag,
      shockZ: s.z, volumeZ: s.volZ, lambdaPct: s.lamPct,
      mae: p.maeAtr * p.atrAtEntry, mfe: p.mfeAtr * p.atrAtEntry,
      // Broker simulé : exécution au prix de clôture, financement inclus dans les frais s'il est activé.
      fees: p.fees, funding: 0, slippage: 0, pnl: p.pnl, pnlPct: p.pnlPct, exits: p.exits.join('+'),
    }
  }
}

export function iso(t: number): string {
  return new Date(t).toISOString().replace('.000Z', 'Z')
}

export function regimeName(x: number): string {
  return x === 1 ? 'agitated' : x === 0 ? 'calm' : 'unknown'
}
