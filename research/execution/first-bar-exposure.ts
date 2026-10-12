// Étude d'exécution, phase 1 : exposition sans stop pendant la première bougie après l'entrée.
//
// Dans le script comme dans le bot, le stop et le TP1 sont posés à la clôture qui suit l'entrée :
// pendant la bougie i + 1 (entrée à la clôture de i), la position n'a aucun ordre de sortie. Mesure,
// sur le backtest E2 complet, de l'excursion défavorable pendant cette bougie (plus bas pour un long,
// plus haut pour un short, rapportés au prix d'entrée), et du nombre de trades historiques qu'un stop
// de sécurité à distance D aurait touchés : D au-delà du maximum historique ne change aucun trade du
// backtest et borne la perte en cas de mouvement extrême. Seuls des agrégats sont écrits.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/first-bar-exposure.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { KEYS, NAMES, ROOT, loadE2, q, runFills } from '../capacity/lib.ts'

const DISTANCES_PCT = [1, 2, 3, 5, 8, 10, 15]
const out: Record<string, unknown> = {}
const S = loadE2()
for (const key of KEYS) {
  const run = runFills(S[key])
  const b = S[key].m.bars
  const mae: number[] = [], maeAtr: number[] = [], gapToStop: number[] = []
  for (const p of run.positions) {
    const i = p.entryIdx + 1
    if (i >= b.n) continue
    const adverse = p.dir === 1 ? (p.entryPx - b.l[i]) / p.entryPx : (b.h[i] - p.entryPx) / p.entryPx
    mae.push(adverse)
    if (p.rec.atrAtEntry > 0) maeAtr.push((adverse * p.entryPx) / p.rec.atrAtEntry)
    // Fermeture au marché dès la pose des sorties (clôture de i au-delà du stop) : le cas que le stop
    // de sécurité couvrirait aussi.
    if (p.exitIdx === i) gapToStop.push(adverse)
  }
  const pct = (x: number) => x * 100
  out[NAMES[key]] = {
    positions: mae.length,
    firstBarAdversePct: { p50: pct(q(mae, 0.5)), p90: pct(q(mae, 0.9)), p99: pct(q(mae, 0.99)), p999: pct(q(mae, 0.999)), max: pct(Math.max(...mae)) },
    firstBarAdverseAtr: { p50: q(maeAtr, 0.5), p99: q(maeAtr, 0.99), max: Math.max(...maeAtr) },
    exitedAtFirstClose: gapToStop.length,
    tradesTouchedByEmergencyStop: Object.fromEntries(DISTANCES_PCT.map(d => [`${d}%`, mae.filter(x => x >= d / 100).length])),
  }
  process.stderr.write(`${NAMES[key]} : ${mae.length} positions · excursion défavorable 1re bougie P50 ${pct(q(mae, 0.5)).toFixed(2)} %, P99 ${pct(q(mae, 0.99)).toFixed(2)} %, max ${pct(Math.max(...mae)).toFixed(2)} % · touchés par un stop à ${DISTANCES_PCT.map(d => `${d} % : ${mae.filter(x => x >= d / 100).length}`).join(', ')}\n`)
}
const dir = join(ROOT, 'research/reports/execution')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'first-bar-exposure.json'), JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Backtest E2 complet. Excursion défavorable pendant la bougie qui suit l\'entrée (aucun ordre de sortie posé), en % du prix d\'entrée.', distancesPct: DISTANCES_PCT, results: out }, null, 1))
