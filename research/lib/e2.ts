// Filtre E2 du Shock Engine : les shorts ne sont autorisés que lorsque le régime de tendance journalier
// est baissier, selon `classify` (lib/strategies/shock/regimes.ts) : clôture journalière sous sa
// moyenne 50 jours et moyenne en baisse sur 10 jours, au dernier jour clos avant la clôture de la
// bougie. Définition figée (research/preregistration/e2-forward.md). Le moteur n'est pas modifié :
// E2 est une liste d'entrées passée à simulate() (argument `override`).

import type { Bars } from '../../lib/backtest/types.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'

/** 1 quand le régime de tendance journalier (dernier jour clos) est baissier. */
export function trendDown(bars: Bars, daily: Bars, tfMin = 15): Uint8Array {
  const reg = classify(bars, tfMin, daily)
  const out = new Uint8Array(bars.n)
  for (let i = 0; i < bars.n; i++) out[i] = reg.id[i] >= 0 && reg.id[i] >> 1 === 2 ? 1 : 0
  return out
}

/**
 * Entrées que le moteur prend de lui-même (impulse ou fade du jeu qui décide à chaque barre), avec
 * les shorts limités au régime E2 quand `trend` est donné. Sans `trend`, la liste redonne exactement
 * le comportement du moteur sans override.
 */
export function engineEntries(m: Market, sets: ShockParams[], select: Int8Array | null, trend: Uint8Array | null): EntryOverride {
  const prs = sets.map(p => prepare(m, p))
  const n = m.bars.n
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = select ? select[i] : 0
    if (e < 0) continue
    const R = prs[e]
    if (R.impulseEntryLong[i] || R.fadeEntryLong[i]) long[i] = 1
    if ((R.impulseEntryShort[i] || R.fadeEntryShort[i]) && (!trend || trend[i])) short[i] = 1
  }
  return { long, short }
}

/** Liste d'entrées avec les shorts masqués hors régime E2. */
export const maskShorts = (o: EntryOverride, trend: Uint8Array): EntryOverride => ({ long: o.long, short: Uint8Array.from(o.short, (x, i) => (x && trend[i] ? 1 : 0)) })
