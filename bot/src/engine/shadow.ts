// Shadow mode : le bot complet sans aucun ordre, sur les bougies et le BBO réels de Hyperliquid.
// Deux moteurs tournent côte à côte :
// - ShadowEngine : les décisions du Shock Engine exécutées par le broker simulé du backtest
//   (ShockSession), une bougie à la fois. Ce qu'il journalise est ce que le backtest aurait fait ;
// - ShadowRunner ajoute le moteur live complet (LiveEngine : ordres, stops, TP1, stop suiveur,
//   anti-doublons) sur l'exchange papier (exec/paper.ts), qui exécute au BBO réel sans rien envoyer.
// À chaque clôture, les positions des deux moteurs sont comparées (événement « parity »).

import type { Bars } from '../../../lib/backtest/types.ts'
import { ShockSession } from '../../../lib/strategies/shock/live.ts'
import type { Bar, ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { PositionRecord } from '../../../lib/strategies/shock/broker.ts'
import type { Costs } from '../../../lib/strategies/shock/params.ts'
import type { Journal, TradeLog } from '../journal.ts'
import type { Quote } from '../data/quotes.ts'
import { midOf } from '../data/quotes.ts'
import type { PaperExchange } from '../exec/paper.ts'
import type { LiveEngine } from './live.ts'
import { coalesce } from '../runtime.ts'

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

/** Les deux moteurs du shadow mode, et leur comparaison à chaque clôture. */
export class ShadowRunner {
  readonly sim: ShadowEngine
  readonly paper: LiveEngine | null
  readonly paperEx: PaperExchange | null
  readonly journal: Journal
  readonly parity = { bars: 0, compared: 0, same: 0, diff: 0 }
  private readonly mid: (m: number) => void

  constructor(sim: ShadowEngine, paper: LiveEngine | null, paperEx: PaperExchange | null, journal: Journal) {
    this.sim = sim
    this.paper = paper
    this.paperEx = paperEx
    this.journal = journal
    this.mid = coalesce(m => this.paper ? this.paper.onMid(m) : Promise.resolve(), e => journal.event('error', { where: 'paper_mid', error: String(e) }))
  }

  async onBar(bar: Bar, daily?: Bars): Promise<void> {
    this.sim.onBar(bar, daily)
    this.parity.bars++
    if (!this.paper) return
    await this.paper.onBar(bar, daily)
    if (this.paper.phase !== 'trading') return
    // Position du backtest (broker simulé) et du moteur live (exchange papier) après la clôture.
    const b = this.sim.session.broker.pos
    const t = this.sim.session.runner.m.bars.t
    const p = this.paper.position
    const sim = b ? { dir: b.dir, set: b.set, entry: iso(t[b.entryIdx] + this.sim.tfMs) } : null
    const live = p ? { dir: p.dir, set: p.set, entry: iso(p.entryBar + this.sim.tfMs) } : null
    const same = JSON.stringify(sim) === JSON.stringify(live)
    this.parity.compared++
    if (same) this.parity.same++
    else this.parity.diff++
    this.journal.event('parity', { bar: iso(bar.t + this.sim.tfMs), same, sim, paper: live, compared: this.parity.compared, diffs: this.parity.diff })
  }

  /** BBO réel : exécute les ordres posés de l'exchange papier, puis fait suivre le stop. */
  onQuote(q: Quote): void {
    if (!this.paperEx) return
    this.paperEx.onQuote(q)
    this.mid(midOf(q))
  }

  async syncFills(): Promise<void> {
    await this.paper?.syncFills()
  }
}

export function iso(t: number): string {
  return new Date(t).toISOString().replace('.000Z', 'Z')
}

export function regimeName(x: number): string {
  return x === 1 ? 'agitated' : x === 0 ? 'calm' : 'unknown'
}
