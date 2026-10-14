// Rapport descriptif des sorties de Shock Engine V1 (régime calme seul) : comment chaque trade s'est clôturé,
// et répartitions. Lecture seule : même rejeu que export-v1-trades.ts (calmOnly sur les signaux E2, moteur
// figé, coûts de la fiche) ; aucun fichier de V1 n'est modifié, aucun paramètre n'est réestimé.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/exit-report.ts
//
// Sortie : research/reports/shock-fade/v1-exits/{report.md, trades.md, trades.csv}.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { calmOnly } from '../../lib/calm-only.ts'
import { costsFor } from '../../lib/frozen-shock.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { KEYS, referenceSleeve, tradeRow } from '../../proba/dataset.ts'
import type { TradeRow } from '../../proba/dataset.ts'
import { REFERENCE } from '../../proba/config.ts'

const EXPECTED = { btc: 358, ethusdt: 358 } as const
const OUT = join(import.meta.dirname, '../../reports/shock-fade/v1-exits')
const t0 = Date.parse(REFERENCE.start), t1 = Date.parse(REFERENCE.end)

const LABEL: Record<string, string> = {
  SL: 'Stop initial (SL)', FLIP: 'Signal inverse (FLIP)', REV: 'Retournement (REV)', TRAIL: 'Trailing (TRAIL)',
  VWAP: 'VWAP', TP1: 'TP1', END: 'Fin des données', LIQ: 'Liquidation',
}
const DESC: Record<string, string> = {
  SL: 'stop fixe à 3,3 ATR(30) de l\'entrée, touché dans la bougie (ou à l\'ouverture si le prix ouvre au-delà)',
  FLIP: 'choc principal dans le sens opposé : clôture au prix de clôture de la bougie (sortie « flip » du script)',
  REV: 'entrée dans le sens opposé alors que la position était ouverte : clôture puis retournement à la clôture',
  TRAIL: 'stop suiveur de 50 ATR, activé après +50 ATR de gain latent',
}

interface Row extends TradeRow {
  exitTag: string; regimeExit: string; hours: number; year: number; giveback: number
  stopPx: number; gapR: number; reversed: boolean
}

// ---------------------------------------------------------------- rejeu V1
const rows: Row[] = []
for (const key of KEYS) {
  const ref = referenceSleeve(key)
  const s = ref.sleeve
  const v1 = calmOnly(ref.signals, s.select)
  const run = simulate(s.m, s.preset.sets, costsFor(key, 1), s.lo, s.end, s.select, v1)
  const t = s.bars.t
  const all = run.positions
  const ps = all.filter(p => t[p.entryIdx] >= t0 && t[p.entryIdx] < t1)
  if (ps.length !== EXPECTED[key]) throw new Error(`${key} : ${ps.length} trades, ${EXPECTED[key]} attendus (fiche V1)`)
  for (const p of ps) {
    const r = tradeRow({ ...ref, signals: v1, run }, p)
    const next = all[all.indexOf(p) + 1]
    const stopPx = p.entryPrice - p.dir * r.stopDist
    const sel = s.select[p.exitIdx]
    rows.push({
      ...r, exitTag: p.exits.join('+'), regimeExit: sel === 1 ? 'agité' : sel === 0 ? 'calme' : 'inconnu',
      hours: (p.exitIdx - p.entryIdx) / 4, year: new Date(r.entryTime).getUTCFullYear(), giveback: r.mfeR - r.R,
      stopPx, gapR: p.exits.includes('SL') ? (p.dir * (p.exitPrice - stopPx)) / r.stopDist : NaN,
      reversed: !!next && next.entryIdx === p.exitIdx && next.dir !== p.dir,
    })
  }
}
rows.sort((a, b) => a.entryTime - b.entryTime || a.asset.localeCompare(b.asset))

// ---------------------------------------------------------------- outils
const sum = (x: number[]) => x.reduce((a, b) => a + b, 0)
const median = (x: number[]) => { if (!x.length) return NaN; const s = [...x].sort((a, b) => a - b), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2 }
const fr = (s: string) => s.replace('.', ',')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const sg = (x: number, d = 2) => { if (!Number.isFinite(x)) return '—'; const a = Math.abs(x).toFixed(d); return fr((+a === 0 ? '' : x > 0 ? '+' : '−') + a) }
const pc = (x: number, d = 0) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(100 * x).toFixed(d)) + ' %' : '—')
const dur = (h: number) => (h < 24 ? `${n(h, 1)} h` : `${n(h / 24, 1)} j`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ')
const TOTAL_R = sum(rows.map(r => r.R))
const TAGS = [...new Set(rows.map(r => r.exitTag))].sort((a, b) => rows.filter(r => r.exitTag === b).length - rows.filter(r => r.exitTag === a).length)
const lab = (t: string) => LABEL[t] ?? t

const table = (head: string[], body: (string | number)[][], align?: string) =>
  [`| ${head.join(' | ')} |`, `|${(align ?? head.map((_, k) => (k ? '---:' : '---')).join('|'))}|`, ...body.map(b => `| ${b.join(' | ')} |`)]

function summaryRow(label: string, xs: Row[], denom = rows.length) {
  const R = xs.map(r => r.R)
  return [label, xs.length, pc(xs.length / denom), pc(xs.filter(r => r.R > 0).length / Math.max(1, xs.length)), sg(sum(R) / Math.max(1, xs.length)), sg(median(R)),
    sg(sum(R), 1), pc(sum(R) / TOTAL_R), n(median(xs.map(r => r.mfeR)), 1), dur(median(xs.map(r => r.hours)))]
}
const SUMMARY_HEAD = ['sortie', 'trades', 'part', 'gagnants', 'R moyen', 'R médian', 'R total', 'part du R total', 'MFE médiane (R)', 'durée médiane']

// Tableau croisé : lignes = catégorie, colonnes = types de sortie (nombre, puis R total).
function cross(title: string, cat: (r: Row) => string, order?: string[]) {
  const cats = order ?? [...new Set(rows.map(cat))].sort()
  const body = cats.map(c => {
    const xs = rows.filter(r => cat(r) === c)
    return [c, xs.length, ...TAGS.map(t => { const ys = xs.filter(r => r.exitTag === t); return ys.length ? `${ys.length} · ${sg(sum(ys.map(r => r.R)), 0)} R` : '—' }),
      pc(xs.filter(r => r.R > 0).length / Math.max(1, xs.length)), sg(sum(xs.map(r => r.R)), 1)]
  })
  return [`### ${title}`, '', ...table([title.split(' × ')[0], 'trades', ...TAGS, 'gagnants', 'R total'], body), '']
}

function buckets<T>(xs: T[], edges: number[], val: (x: T) => number, fmt: (a: number, b: number) => string) {
  return edges.slice(0, -1).map((a, k) => ({ label: fmt(a, edges[k + 1]), xs: xs.filter(x => val(x) >= a && val(x) < edges[k + 1]) }))
}
const rFmt = (a: number, b: number) => (a === -Infinity ? `< ${n(b, 1)}` : b === Infinity ? `≥ ${n(a, 0)}` : `[${n(a, 1)} ; ${n(b, 1)}[`)

// ---------------------------------------------------------------- rapport
const L: string[] = []
const by = (t: string) => rows.filter(r => r.exitTag === t)
const sl = by('SL'), flip = by('FLIP')
const top = [...rows].sort((a, b) => b.R - a.R).slice(0, Math.ceil(0.05 * rows.length))
const worst = [...rows].sort((a, b) => a.R - b.R).slice(0, Math.ceil(0.05 * rows.length))

L.push('# Shock Engine V1 — comment se clôturent les trades', '',
  `Rejeu en lecture seule du moteur figé (V1 = E2 sans entrée en régime agité, preset adaptatif 15, commission 0,045 %, `
  + `fenêtre ${REFERENCE.start} → 2026-09-30) : **${rows.length} trades** (${rows.filter(r => r.asset === 'BTC').length} BTC, ${rows.filter(r => r.asset === 'ETH').length} ETH), `
  + `${sg(TOTAL_R, 0)} R au total. R = PnL net / risque initial (3,3 × ATR(30) d'entrée). MFE / MAE = meilleure / pire excursion latente avant la sortie, en R. `
  + `« Rendu » = MFE − R final. Généré par \`research/fade/v1/exit-report.ts\` ; liste complète : [trades.md](trades.md), [trades.csv](trades.csv).`, '',
  '## Les mécanismes de sortie de V1', '',
  ...TAGS.map(t => `- **${lab(t)}** : ${DESC[t] ?? '—'}.`),
  '- Inactifs dans V1 : TP1 (désactivé), VWAP (réservé aux fades, désactivés), liquidation (sans levier). Aucun trade n\'est encore ouvert à la fin de la fenêtre.', '',
  '## 1. Répartition par type de sortie', '',
  ...table(SUMMARY_HEAD, [...TAGS.map(t => summaryRow(lab(t), by(t))), summaryRow('**tous**', rows)]), '')
for (const a of ['BTC', 'ETH']) {
  const xs = rows.filter(r => r.asset === a)
  L.push(`**${a}**`, '', ...table(SUMMARY_HEAD, [...TAGS.filter(t => xs.some(r => r.exitTag === t)).map(t => summaryRow(lab(t), xs.filter(r => r.exitTag === t), xs.length)), summaryRow('**tous**', xs, xs.length)]), '')
}

L.push('## 2. Répartitions croisées', '', 'Chaque cellule : nombre de trades · R total.', '',
  ...cross('actif × sortie', r => r.asset),
  ...cross('sens × sortie', r => (r.dir === 1 ? 'long' : 'short')),
  ...cross('année d\'entrée × sortie', r => String(r.year)),
  ...cross('tendance journalière à l\'entrée × sortie', r => r.trendRegime, ['haussière', 'neutre', 'baissière', 'inconnue'].filter(c => rows.some(r => r.trendRegime === c))),
  ...cross('régime de volatilité à la sortie × sortie', r => r.regimeExit, ['calme', 'agité', 'inconnu'].filter(c => rows.some(r => r.regimeExit === c))))
L.push(`Toutes les entrées sont en régime calme (règle de V1) ; ${[...new Set(rows.map(r => r.tag))].length === 1 ? `toutes sont des impulsions (${rows[0].tag})` : 'types d\'entrée : ' + [...new Set(rows.map(r => r.tag))].join(', ')}. `
  + 'Tendance journalière : clôture par rapport à sa moyenne 50 jours et pente sur 10 jours, dernier jour clos (règle E2). Régime à la sortie : règle de volatilité de V1, dernier jour clos.', '')
const HOLD = [0, 4, 24, 72, 168, 336, Infinity]
const holdLab = (a: number, b: number) => (b === Infinity ? `> ${a / 24} j` : a < 24 ? `${a}–${b < 24 ? b + ' h' : '24 h'}` : `${a / 24}–${b / 24} j`)
const holdOf = (r: Row) => { for (let k = 0; k < HOLD.length - 1; k++) if (r.hours >= HOLD[k] && r.hours < HOLD[k + 1]) return holdLab(HOLD[k], HOLD[k + 1]); return '?' }
L.push(...cross('durée de détention × sortie', holdOf, HOLD.slice(0, -1).map((a, k) => holdLab(a, HOLD[k + 1]))))

L.push('## 3. Distribution du R final par type de sortie', '')
const REDGES = [-Infinity, -1.1, -0.9, 0, 1, 2, 5, 10, 20, Infinity]
L.push(...table(['R final', ...TAGS, 'tous'], buckets(rows, REDGES, r => r.R, rFmt).map(b => [b.label, ...TAGS.map(t => b.xs.filter(r => r.exitTag === t).length || '—'), b.xs.length])), '')

L.push('## 4. Ce qui s\'est passé avant la sortie', '',
  '### Gain latent atteint avant la sortie (MFE), par type de sortie', '')
const MEDGES = [-Infinity, 0.5, 1, 2, 3, 5, 10, Infinity]
L.push(...table(['MFE atteinte', ...TAGS.map(t => `${t} (n · R total)`), 'tous'],
  buckets(rows, MEDGES, r => r.mfeR, rFmt).map(b => [b.label, ...TAGS.map(t => { const ys = b.xs.filter(r => r.exitTag === t); return ys.length ? `${ys.length} · ${sg(sum(ys.map(r => r.R)), 0)}` : '—' }), b.xs.length])), '')
const rendu = (xs: Row[]) => xs.filter(r => r.R > 0)
L.push(`- **Stops initiaux après un gain latent** : ${sl.filter(r => r.mfeR >= 1).length} des ${sl.length} SL avaient d'abord atteint +1 R, ${sl.filter(r => r.mfeR >= 2).length} avaient atteint +2 R, ${sl.filter(r => r.mfeR >= 3).length} avaient atteint +3 R, avant de revenir jusqu'au stop.`,
  `- **Sorties FLIP** : R médian ${sg(median(flip.map(r => r.R)))} ; ${flip.filter(r => r.R > 0).length} / ${flip.length} gagnantes ; ${flip.filter(r => r.reversed).length} suivies d'une entrée inverse dans la même bougie. Rendu médian des FLIP gagnantes : ${n(median(rendu(flip).map(r => r.giveback)), 1)} R (MFE médiane ${n(median(rendu(flip).map(r => r.mfeR)), 1)} R).`,
  `- **Trades gagnants (toutes sorties)** : ${rendu(rows).length} ; rendu médian ${n(median(rendu(rows).map(r => r.giveback)), 1)} R, soit ${pc(median(rendu(rows).map(r => r.giveback / r.mfeR)))} de la MFE ; ${rows.filter(r => r.mfeR >= 2 && r.R <= 0).length} trades ayant atteint +2 R finissent ≤ 0.`, '')

L.push('### Exécution des stops initiaux', '',
  `Sur ${sl.length} SL : ${sl.filter(r => r.gapR > -1e-9).length} exécutés au niveau du stop, ${sl.filter(r => r.gapR <= -1e-9).length} au-delà (ouverture en gap) ; `
  + `glissement moyen des gaps ${sg(sum(sl.filter(r => r.gapR <= -1e-9).map(r => r.gapR)) / Math.max(1, sl.filter(r => r.gapR <= -1e-9).length))} R, pire ${sg(Math.min(...sl.map(r => r.gapR)))} R. `
  + `R médian d'un SL : ${sg(median(sl.map(r => r.R)))} (commission comprise, ${n(median(sl.map(r => r.feesR)), 3)} R de frais médians).`, '')

L.push(`## 5. Très gros gagnants et pires perdants (5 % chacun, ${top.length} trades)`, '',
  ...table(['groupe', 'trades', ...TAGS, 'R total', 'durée médiane', 'MFE médiane'], [
    ['36 meilleurs', top.length, ...TAGS.map(t => top.filter(r => r.exitTag === t).length || '—'), sg(sum(top.map(r => r.R)), 0), dur(median(top.map(r => r.hours))), n(median(top.map(r => r.mfeR)), 1)],
    ['36 pires', worst.length, ...TAGS.map(t => worst.filter(r => r.exitTag === t).length || '—'), sg(sum(worst.map(r => r.R)), 0), dur(median(worst.map(r => r.hours))), n(median(worst.map(r => r.mfeR)), 1)],
  ]), '',
  `Les ${top.length} meilleurs trades font ${pc(sum(top.map(r => r.R)) / TOTAL_R)} du R total.`, '')

// ---------------------------------------------------------------- liste complète
const detail = (r: Row) => {
  if (r.exitTag === 'SL') return r.gapR <= -1e-9 ? `stop sauté à l'ouverture (${sg(r.gapR)} R au-delà du stop)` : 'stop touché'
  if (r.exitTag === 'FLIP') return r.reversed ? 'choc inverse, retournement' : 'choc inverse'
  if (r.exitTag === 'REV') return 'entrée inverse'
  if (r.exitTag === 'TRAIL') return 'stop suiveur touché'
  return ''
}
const T: string[] = ['# Shock Engine V1 — clôture de chaque trade', '',
  `${rows.length} trades, triés par date d'entrée. Heures en UTC, à la clôture de la bougie de 15 min (entrée : bougie du signal ; sortie : bougie où la sortie s'exécute). `
  + 'R = PnL net / risque initial ; MFE / MAE en R ; rendu = MFE − R. Répartitions : [report.md](report.md).', '',
  ...table(['#', 'actif', 'sens', 'entrée', 'sortie', 'durée', 'prix entrée', 'prix sortie', 'clôture', 'R', 'MFE', 'MAE', 'rendu', 'régime à la sortie', 'détail'],
    rows.map((r, k) => [k + 1, r.asset, r.dir === 1 ? 'long' : 'short', iso(r.entryTime), iso(r.exitTime), dur(r.hours), n(r.entryPrice, 2), n(r.exitPrice, 2), r.exitTag,
      sg(r.R), n(r.mfeR), n(r.maeR), n(r.giveback), r.regimeExit, detail(r)]),
    '---:|---|---|---|---|---:|---:|---:|---|---:|---:|---:|---:|---|---'), '']
const csvCols = ['n', 'id', 'asset', 'dir', 'entry_time_utc', 'exit_time_utc', 'hold_hours', 'entry_price', 'exit_price', 'stop_price', 'exit', 'R', 'mfe_R', 'mae_R', 'giveback_R',
  'fees_R', 'stop_gap_R', 'flip_reversed', 'entry_tag', 'trend_at_entry', 'regime_at_exit', 'year']
const csv = [csvCols.join(','), ...rows.map((r, k) => [k + 1, r.id, r.asset, r.dir === 1 ? 'long' : 'short', new Date(r.entryTime).toISOString(), new Date(r.exitTime).toISOString(), r.hours,
  +r.entryPrice.toPrecision(10), +r.exitPrice.toPrecision(10), +r.stopPx.toPrecision(10), r.exitTag, +r.R.toFixed(4), +r.mfeR.toFixed(4), +r.maeR.toFixed(4), +r.giveback.toFixed(4), +r.feesR.toFixed(4),
  Number.isFinite(r.gapR) ? +r.gapR.toFixed(4) : '', r.exitTag === 'FLIP' ? (r.reversed ? 1 : 0) : '', r.tag, r.trendRegime, r.regimeExit, r.year].join(','))]

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n') + '\n')
writeFileSync(join(OUT, 'trades.md'), T.join('\n'))
writeFileSync(join(OUT, 'trades.csv'), csv.join('\n') + '\n')
console.log(`${rows.length} trades ; sorties : ${TAGS.map(t => `${t} ${by(t).length}`).join(', ')}`)
