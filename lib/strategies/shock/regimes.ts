// Classification des régimes de marché, causale : chaque barre du graphique ne voit que des
// barres journalières déjà closes.
//
// Régime = tendance (3 états) × volatilité (2 états) = 6 régimes :
// - tendance, sur le journalier : haussière si la clôture est au-dessus de la moyenne 50 jours
//   et que cette moyenne monte sur 10 jours ; baissière dans le cas inverse ; neutre sinon ;
// - volatilité : écart type des rendements journaliers sur 20 jours, comparé à ses valeurs des
//   365 jours précédents ; calme sous la médiane, agitée au-dessus.

import type { Bars } from '../../backtest/types.ts'
import { resample } from '../../backtest/data.ts'
import { sma, stdev } from '../../backtest/indicators.ts'

export const REGIME_NAMES = [
  'haussier · calme', 'haussier · agité',
  'neutre · calme', 'neutre · agité',
  'baissier · calme', 'baissier · agité',
]

export interface RegimeSeries {
  /** Régime de chaque barre du graphique (-1 = pas encore assez d'historique). */
  id: Int8Array
  /** Régime de chaque jour (pour les statistiques). */
  daily: { t: Float64Array; id: Int8Array; ret: Float64Array }
}

export function classify(bars: Bars, tfMin: number, hourly: Bars, opt = { smaLen: 50, slopeDays: 10, volLen: 20, volLookback: 365 }): RegimeSeries {
  const d = resample(hourly, 86400000)
  const n = d.n
  const s = sma(d.c, opt.smaLen)
  const r = new Float64Array(n)
  for (let i = 1; i < n; i++) r[i] = Math.log(d.c[i] / d.c[i - 1])
  const vol = stdev(r, opt.volLen)
  const dayId = new Int8Array(n).fill(-1)
  for (let i = 0; i < n; i++) {
    if (i < opt.slopeDays || !Number.isFinite(s[i]) || !Number.isFinite(s[i - opt.slopeDays]) || !Number.isFinite(vol[i])) continue
    const up = d.c[i] > s[i] && s[i] > s[i - opt.slopeDays]
    const down = d.c[i] < s[i] && s[i] < s[i - opt.slopeDays]
    const trend = up ? 0 : down ? 2 : 1
    // Percentile de la volatilité parmi les volLookback jours précédents.
    const a = Math.max(0, i - opt.volLookback)
    let below = 0
    let cnt = 0
    for (let k = a; k < i; k++) {
      if (!Number.isFinite(vol[k])) continue
      cnt++
      if (vol[k] <= vol[i]) below++
    }
    if (cnt < 60) continue
    const high = below / cnt > 0.5
    dayId[i] = trend * 2 + (high ? 1 : 0)
  }
  // Barre du graphique : régime du dernier jour clos avant la clôture de la barre.
  const id = new Int8Array(bars.n).fill(-1)
  const tfMs = tfMin * 60000
  let k = -1
  for (let i = 0; i < bars.n; i++) {
    const closeT = bars.t[i] + tfMs
    while (k + 1 < n && d.t[k + 1] + 86400000 <= closeT) k++
    if (k >= 0) id[i] = dayId[k]
  }
  const ret = new Float64Array(n)
  for (let i = 1; i < n; i++) ret[i] = d.c[i] / d.c[i - 1] - 1
  return { id, daily: { t: d.t, id: dayId, ret } }
}

/**
 * Mode adaptatif : jeu de réglages qui décide des entrées à chaque barre, selon la volatilité du
 * régime (calme ou agitée) ; -1 = pas de nouvelle entrée (régime inconnu, ou pas de jeu pour ce
 * régime). `agitated` : 1 agité, 0 calme, NaN inconnu.
 */
export function volatilitySelect(reg: RegimeSeries, n: number, calmIdx: number, agiIdx: number): { select: Int8Array; agitated: Float64Array } {
  const select = new Int8Array(n).fill(-1)
  const agitated = new Float64Array(n).fill(NaN)
  for (let i = 0; i < n; i++) {
    const id = reg.id[i]
    if (id < 0) continue
    const agi = id % 2 === 1
    agitated[i] = agi ? 1 : 0
    select[i] = agi ? agiIdx : calmIdx
  }
  return { select, agitated }
}
