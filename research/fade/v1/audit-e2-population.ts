// Populations des jeux de paramètres (audit du DSR) : chaque candidat de regime-wf rejoué (0) comme jeu calme de E2 (jeu agité
// de E2 fixé), (1) comme jeu agité de E2 (jeu calme fixé), (2) comme jeu calme de V1 (entrées en régime calme seulement ; le jeu
// agité n'a aucun effet sur V1). Entrées E2 : signaux d'impulsion du jeu du régime, shorts limités au régime baissier, bougie
// qui suit un trou exclue ; coûts et sorties du moteur figé. Lecture seule ; aucun nouvel essai : ce sont les candidats déjà
// évalués par regime-wf. Contrôles : le préréglage rejoué ainsi redonne E2 et V1 au bit près.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/audit-e2-population.ts <graine>
//
// Sortie hors git : research/data/binance/fade/derived/audit/e2pop-<graine>.f64 (lignes : rôle, n° du candidat, T rendements
// journaliers de la sleeve BTC, T de la sleeve ETH) et e2pop-<graine>.json.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { M15, referenceAsset } from '../../lib/regime-er.ts'
import type { Asset } from '../../lib/regime-er.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import { calmOnly } from '../../lib/calm-only.ts'
import { candidates } from '../../shock/regime-wf.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import { DEFAULT_PARAMS, withParams } from '../../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../../lib/strategies/shock/params.ts'

const SEED = Number(process.argv[2])
const ROOT = join(import.meta.dirname, '../../..')
const OUT = join(ROOT, 'research/data/binance/fade/derived/audit')
const DAY = 864e5
const A = [referenceAsset('btc'), referenceAsset('ethusdt')]
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1, T = PD1 - PD0 + 1

function asE2(a: Asset, sets: ShockParams[], calmOnly = false) {
  const prs = sets.map(p => prepare(a.m, p)), t = a.bars.t, n = a.bars.n
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = a.lo; i <= a.end; i++) {
    const e = a.select[i]
    if (e < 0 || (calmOnly && e !== 0) || (i > 0 && t[i] - t[i - 1] > M15)) continue
    if (sets[e].allowLong && prs[e].impulseEntryLong[i]) long[i] = 1
    if (sets[e].allowShort && prs[e].impulseEntryShort[i] && a.trend[i]) short[i] = 1
  }
  const r = simulate(a.m, sets, a.costs(1), a.lo, a.end, a.select, { long, short })
  a.m.memo.clear()
  return dailyOf(a.bars, r.equity, a.lo, a.end, PD0, PD1).r
}
const ref = (a: Asset, o: { long: Uint8Array; short: Uint8Array }) => dailyOf(a.bars, simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, o).equity, a.lo, a.end, PD0, PD1).r
A.forEach(a => {
  const e2 = ref(a, a.signals), v1 = ref(a, calmOnly(a.signals, a.select))
  if (asE2(a, a.preset.sets).some((v, k) => v !== e2[k])) throw new Error(`contrôle : ${a.key} rejoué comme E2 ≠ E2`)
  if (asE2(a, a.preset.sets, true).some((v, k) => v !== v1[k])) throw new Error(`contrôle : ${a.key} rejoué comme V1 ≠ V1`)
})

const cands = candidates(200, SEED)
const rows: number[][] = []
for (const [idx, c] of cands.entries()) {
  const p = withParams(DEFAULT_PARAMS, c.over)
  for (const role of [0, 1, 2]) {
    const sl = A.map(a => asE2(a, role === 1 ? [a.preset.sets[0], p] : [p, a.preset.sets[1]], role === 2))
    rows.push([role, idx, ...sl[0], ...sl[1]])
  }
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, `e2pop-${SEED}.f64`), Buffer.from(Float64Array.from(rows.flat()).buffer))
writeFileSync(join(OUT, `e2pop-${SEED}.json`), JSON.stringify({ seed: SEED, rows: rows.length, T, cols: 2 + 2 * T, PD0, PD1 }))
console.log(`graine ${SEED} : ${rows.length} séries`)
