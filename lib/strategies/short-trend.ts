// Condition de la version publique du Shock Engine sur les shorts : une entrée short n'est autorisée
// que si le régime de tendance journalier est baissier, soit clôture journalière sous sa moyenne
// 50 jours et moyenne en baisse sur 10 jours, au dernier jour clos avant la clôture de la bougie
// (classify, lib/strategies/shock/regimes.ts). Même définition que la recherche (research/lib/e2.ts).
//
// Utilisée par le bot (bot/src/engine/short-trend.ts) et par la page /live (backtest de
// comparaison). Le moteur figé (lib/strategies/shock/*) n'est pas modifié : la condition passe par
// la liste d'entrées de ShockStrategy (EntryOverride). Seules les entrées short changent.

import type { Bars } from '../backtest/types.ts'
import type { Market, Prepared } from './shock/market.ts'
import { prepare } from './shock/market.ts'
import type { ShockParams } from './shock/params.ts'
import type { EntryOverride } from './shock/strategy.ts'
import { classify } from './shock/regimes.ts'

/** 1 quand le régime de tendance journalier (dernier jour clos) est baissier. */
export function shortTrendMask(bars: Bars, tfMin: number, regimeBars: Bars): Uint8Array {
  const reg = classify(bars, tfMin, regimeBars)
  const out = new Uint8Array(bars.n)
  for (let i = 0; i < bars.n; i++) out[i] = reg.id[i] >= 0 && reg.id[i] >> 1 === 2 ? 1 : 0
  return out
}

/** Entrées que le moteur prend de lui-même (impulse ou fade du jeu actif), shorts limités au masque. */
export function entriesWithShortTrend(prs: Prepared[], select: Int8Array | null, n: number, trend: Uint8Array): EntryOverride {
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const e = select ? select[i] : 0
    if (e < 0) continue
    const R = prs[e]
    if (R.impulseEntryLong[i] || R.fadeEntryLong[i]) long[i] = 1
    if ((R.impulseEntryShort[i] || R.fadeEntryShort[i]) && trend[i]) short[i] = 1
  }
  return { long, short }
}

/** Liste d'entrées du backtest en bloc (simulate) avec la condition sur les shorts. */
export function shortTrendEntries(m: Market, sets: ShockParams[], select: Int8Array | null, tfMin: number, regimeBars: Bars | undefined): EntryOverride {
  return entriesWithShortTrend(sets.map(p => prepare(m, p)), select, m.bars.n, shortTrendMask(m.bars, tfMin, regimeBars ?? m.htf))
}
