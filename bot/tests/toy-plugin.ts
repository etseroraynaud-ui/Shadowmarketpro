// Module de variante factice pour les tests du point d'extension (engine/plugin.ts) : aucune règle réelle.
// Entrées : une bougie sur deux ignorée. Sorties : dès 1 ATR de gain latent, stop relevé à la moitié du
// meilleur gain.
import type { StrategyPlugin } from '../src/engine/plugin.ts'

const toy: StrategyPlugin = {
  name: 'factice',
  entries: (e) => ({ long: e.long.map((s, i) => (i % 2 ? 0 : s)), short: e.short.map((s, i) => (i % 2 ? 0 : s)) }),
  exits: (d, q) => {
    const best = q.dir === 1 ? q.hi - q.avg : q.avg - q.lo
    if (!d.exits || !(best >= q.atrAtEntry)) return false
    const level = q.avg + (q.dir * best) / 2
    d.exits.stop = q.dir === 1 ? Math.max(d.exits.stop, level) : Math.min(d.exits.stop, level)
    return true
  },
}

export default toy
