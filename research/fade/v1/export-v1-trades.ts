// Export en lecture seule des trades de Shock Engine V1 (régime calme seul) pour l'étude Hawkes/Merton × V1.
// Même chemin que research/shock/reference.ts (calmOnly sur les signaux E2) et mêmes lignes que research/proba
// (tradeRow) : aucun fichier de V1 n'est modifié, aucun paramètre n'est réestimé. Arrêt si le nombre de trades
// diffère de la fiche publiée (358 + 358).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/export-v1-trades.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { calmOnly } from '../../lib/calm-only.ts'
import { costsFor } from '../../lib/frozen-shock.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { KEYS, referenceSleeve, tradeRow } from '../../proba/dataset.ts'
import { REFERENCE } from '../../proba/config.ts'

const EXPECTED = { btc: 358, ethusdt: 358 } as const
const OUT = join(import.meta.dirname, '../../reports/shock-fade/v1-hawkes')
const a = Date.parse(REFERENCE.start), z = Date.parse(REFERENCE.end)
const rows: string[] = []
const cols = ['id', 'asset', 'dir', 'entry_time', 'exit_time', 'exits', 'R', 'mfe_R', 'mae_R', 'ret', 'win', 'hold_bars', 'tag',
  'f_absZ', 'f_lamPct', 'f_volZ', 'f_breakAtr', 'f_closeQ', 'f_rv', 'f_atrPct', 'f_micro', 'f_isShort']
rows.push(cols.join(','))
for (const key of KEYS) {
  const ref = referenceSleeve(key)
  const s = ref.sleeve
  const v1 = calmOnly(ref.signals, s.select)
  const run = simulate(s.m, s.preset.sets, costsFor(key, 1), s.lo, s.end, s.select, v1)
  const t = s.bars.t
  const ps = run.positions.filter(p => t[p.entryIdx] >= a && t[p.entryIdx] < z)
  if (ps.length !== EXPECTED[key]) throw new Error(`${key} : ${ps.length} trades, ${EXPECTED[key]} attendus (fiche V1)`)
  for (const p of ps) {
    const r = tradeRow({ ...ref, signals: v1, run }, p)
    const f = r.features as unknown as Record<string, number>
    rows.push([r.id, r.asset, r.dir, new Date(r.entryTime).toISOString(), new Date(r.exitTime).toISOString(), r.exits, r.R, r.mfeR, r.maeR,
      r.ret, r.win, r.holdBars, r.tag, f.absZ, f.lamPct, f.volZ, f.breakAtr, f.closeQ, f.rv, f.atrPct, f.micro, f.isShort].join(','))
  }
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'v1-trades.csv'), rows.join('\n') + '\n')
console.log(`v1-trades.csv : ${rows.length - 1} trades`)
