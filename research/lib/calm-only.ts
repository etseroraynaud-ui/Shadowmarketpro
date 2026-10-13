// V1-calme, figée le 2026-10-13 (research/preregistration/calm-only.md) : E2 sans nouvelles entrées
// en régime agité. Mêmes jeux de réglages, mêmes signaux E2 ; une entrée (long ou short) est retirée
// si la bougie de signal est en régime agité (select = 1). Les positions ouvertes en régime calme
// gardent leurs sorties (jeu calme) même si le régime change ensuite. Allocation : portefeuille
// BTC/ETH 50/50 sans rebalancement, comme E2. Le moteur n'est pas modifié.

import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'

/** Signaux E2 privés des entrées en régime agité. Identique à inputs(a, 'V1') de research/shock/agitated-regime.ts. */
export function calmOnly(signals: EntryOverride, select: Int8Array): EntryOverride {
  const drop = (x: Uint8Array) => Uint8Array.from(x, (s, i) => (s && select[i] === 1 ? 0 : s))
  return { long: drop(signals.long), short: drop(signals.short) }
}

/** Valeurs de référence de V1-calme (research/reports/agitated-regime/agitated-regime.json), à retrouver à l'identique. */
export const CALM_ONLY_REFERENCE = {
  window: ['2018-09-01', '2026-10-01'],
  portfolio: { costs1: { sharpe: 2.0242079, trades: 716 }, costs2: { sharpe: 1.8782281, trades: 716 } },
  e2: { costs1: { sharpe: 1.8775665, trades: 1311 }, costs2: { sharpe: 1.6098551, trades: 1311 } },
}
