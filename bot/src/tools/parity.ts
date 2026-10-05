// Parité backtest / bot : la même série de bougies passe
//   1. dans le backtester (simulate, calcul d'un bloc) ;
//   2. dans le moteur du bot (historique de départ, puis une bougie à la fois).
// Pour chaque barre jouée bougie par bougie : même décision (entrées, sorties, niveaux de stop,
// TP1 et stop suiveur), même régime ; puis mêmes positions et même capital barre par barre.
//
//   npm run parity -- [--steps 1000] [--data-dir bot/data] [--coin BTC]

import type { Bars } from '../../../lib/backtest/types.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import type { Decision } from '../../../lib/strategies/shock/strategy.ts'
import { marketFor, selectFor, ShockSession } from '../../../lib/strategies/shock/live.ts'
import type { ShockConfig } from '../../../lib/strategies/shock/live.ts'
import type { Costs } from '../../../lib/strategies/shock/params.ts'

export interface ParityReport {
  ok: boolean
  bars: number
  steps: number
  decisions: number
  signals: number
  decisionDiffs: { t: number; backtest: Decision; bot: Decision }[]
  regimeDiffs: { t: number; backtest: number; bot: number }[]
  positionsBacktest: number
  positionsBot: number
  positionDiff: string | null
  equityDiff: { t: number; backtest: number; bot: number } | null
}

const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function checkParity(cfg: ShockConfig, costs: Costs, chart: Bars, daily: Bars | undefined, steps: number): ParityReport {
  const n = chart.n
  if (steps < 1 || steps >= n) throw new Error(`steps doit être entre 1 et ${n - 1}`)
  // 1. Backtester.
  const m = marketFor(chart, cfg.tfMin, cfg.mintick)
  const { select, agitated } = selectFor(cfg, m, daily)
  const ref: Decision[] = []
  const bt = simulate(m, cfg.sets, costs, 0, n - 1, select, undefined, (i, d) => { ref[i] = structuredClone(d) })
  // 2. Moteur du bot.
  const k0 = n - steps
  const s = new ShockSession(cfg, costs, head(chart, k0), 0, { regimeBars: daily })
  const decisionDiffs: ParityReport['decisionDiffs'] = []
  const regimeDiffs: ParityReport['regimeDiffs'] = []
  let signals = 0
  for (let i = k0; i < n; i++) {
    const st = s.push({ t: chart.t[i], o: chart.o[i], h: chart.h[i], l: chart.l[i], c: chart.c[i], v: chart.v[i] })
    const live = s.runner.agitated ? s.runner.agitated[i] : NaN
    const back = agitated ? agitated[i] : NaN
    if (!(Object.is(live, back))) regimeDiffs.push({ t: chart.t[i], backtest: back, bot: live })
    // La dernière barre du backtest est la fin de la fenêtre (pas d'entrée, tout est fermé).
    if (i < n - 1) {
      if (st.decision.long || st.decision.short || st.decision.close) signals++
      if (!same(st.decision, ref[i])) decisionDiffs.push({ t: chart.t[i], backtest: ref[i], bot: st.decision })
    }
  }
  const last = n - 1
  const a = bt.positions.filter(p => p.exitIdx < last)
  const b = s.broker.positions.filter(p => p.exitIdx < last)
  let positionDiff: string | null = null
  if (a.length !== b.length) positionDiff = `${a.length} positions dans le backtest, ${b.length} dans le bot`
  else {
    const k = a.findIndex((p, j) => !same(p, b[j]))
    if (k >= 0) positionDiff = `position ${k} : backtest ${JSON.stringify(a[k])} / bot ${JSON.stringify(b[k])}`
  }
  let equityDiff: ParityReport['equityDiff'] = null
  for (let i = 0; i < last; i++) {
    if (!Object.is(s.equity[i], bt.equity[i])) { equityDiff = { t: chart.t[i], backtest: bt.equity[i], bot: s.equity[i] }; break }
  }
  return {
    ok: !decisionDiffs.length && !regimeDiffs.length && !positionDiff && !equityDiff,
    bars: n, steps, decisions: steps - 1, signals, decisionDiffs: decisionDiffs.slice(0, 10), regimeDiffs: regimeDiffs.slice(0, 10),
    positionsBacktest: a.length, positionsBot: b.length, positionDiff, equityDiff,
  }
}
