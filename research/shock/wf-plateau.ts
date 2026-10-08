// Walk-forward du préréglage du bot (adaptatif volatilité · 15 min), réglages choisis sur des
// plateaux plutôt que sur le meilleur Sharpe isolé.
//
//   node research/shock/wf-plateau.ts [--train 36] [--test 3] [--from 2020-01-01] [--min 20]
//                                     [--base preset|script|script-long]
//
// --base : réglages qui ne sont pas optimisés. « preset » : ceux du préréglage du bot (choisis
// sur tout 2017-2026, donc une fuite d'information vers les tests). « script » : les valeurs par
// défaut du script, jamais optimisées (mode High Activity coupé, sinon le seuil du choc ne sert
// à rien). « script-long » : idem, longs seulement.
//
// Méthode, sans lecture du futur :
// 1. Grille par régime de volatilité (calme / agité) sur les trois réglages qui comptent : seuil
//    du choc (kMain), stop (× ATR), stop suiveur (× ATR, 50 = sans). Les autres réglages restent
//    ceux du préréglage du régime.
// 2. Chaque point de la grille est backtesté une fois sur tout l'historique en ne tradant que dans
//    son régime ; on garde ses rendements quotidiens et ses entrées.
// 3. Pour chaque fenêtre (calibration = les `train` mois précédant le test, test = `test` mois, pas
//    = `test` mois) : chaque point est noté par son Sharpe quotidien sur la calibration (0 s'il a
//    moins de `min` trades) ; la note de plateau d'un point est la moyenne des notes du point et de
//    ses voisins (±1 cran sur chaque réglage). Le point au meilleur plateau est retenu ; si ce
//    plateau n'est pas positif, le régime n'est pas tradé pendant le test.
// 4. Courbe hors échantillon : une seule simulation, où chaque bougie du test utilise les réglages
//    retenus pour sa fenêtre et son régime. Une position garde les réglages qui l'ont ouverte
//    jusqu'à sa sortie, comme le bot. Comparée au même walk-forward avec le meilleur Sharpe
//    isolé, au préréglage fixe (choisi sur tout l'historique, donc flatteur) et à l'achat conservé.

import { writeFileSync } from 'node:fs'
import { loadBtc } from '../lib/data.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import { ADAPTIVE15 } from '../../lib/strategies/shock/presets.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const TRAIN = Number(opt('train', '36'))
const TEST = Number(opt('test', '3'))
const FROM = opt('from', '2020-01-01')
const MIN_TRADES = Number(opt('min', '20'))
const BASE = opt('base', 'preset') as 'preset' | 'script' | 'script-long'
const COSTS: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: 1, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }

const K = [2.0, 2.4, 2.8, 3.2]
const STOP = [0.8, 1.2, 1.8, 2.6, 3.6]
const TRAIL = [2.0, 3.2, 5.0, 50]
const REGIMES = ['calme', 'agité'] as const

interface Point { k: number; s: number; tr: number }
const grid: Point[] = []
for (let k = 0; k < K.length; k++) for (let s = 0; s < STOP.length; s++) for (let tr = 0; tr < TRAIL.length; tr++) grid.push({ k, s, tr })
const gid = (p: Point) => (p.k * STOP.length + p.s) * TRAIL.length + p.tr
const label = (p: Point | null) => (p ? `choc ${K[p.k]} · stop ${STOP[p.s]} ATR · suiveur ${TRAIL[p.tr] >= 50 ? 'non' : `${TRAIL[p.tr]} ATR`}` : 'pas de trade')

function paramsOf(regime: 0 | 1, p: Point): ShockParams {
  const k = K[p.k]
  const grid = { kMain: k, atrStopMult: STOP[p.s], atrTrailMult: TRAIL[p.tr] }
  if (BASE !== 'preset') return { ...DEFAULT_PARAMS, highActivityMode: false, ...grid, kMicro: Math.max(1, k - 0.2), allowShort: BASE === 'script' }
  const base = { ...DEFAULT_PARAMS, ...(regime === 0 ? ADAPTIVE15.calm : ADAPTIVE15.agitated) }
  return { ...base, ...grid, kMicro: regime === 1 ? Math.max(1, k - 0.2) : base.kMicro }
}

// ---------------------------------------------------------------- données
const all = loadBtc(15)
const bars = sliceBars(all, Date.parse('2016-01-01'), all.t[all.n - 1])
const daily = resample(loadBtc(60), 86400000)
const m = marketFor(bars, 15, 1)
const preset = adaptivePreset(15, 1)
const { select: presetSelect, agitated } = selectFor(preset, m, daily)
const regimeOf = (i: number): 0 | 1 | -1 => (Number.isFinite(agitated![i]) ? (agitated![i] ? 1 : 0) : -1)
const day = (t: number) => new Date(t).toISOString().slice(0, 10)
const idxAt = (t: number) => { let lo = 0, hi = bars.n; while (lo < hi) { const md = (lo + hi) >> 1; if (bars.t[md] < t) lo = md + 1; else hi = md } return lo }

// Jours : dernière bougie de chaque jour UTC.
const dayEnd: number[] = []
for (let i = 0; i < bars.n; i++) if (i === bars.n - 1 || Math.floor(bars.t[i + 1] / 864e5) !== Math.floor(bars.t[i] / 864e5)) dayEnd.push(i)
const dayIdx = (t: number) => { let lo = 0, hi = dayEnd.length; while (lo < hi) { const md = (lo + hi) >> 1; if (bars.t[dayEnd[md]] < t) lo = md + 1; else hi = md } return lo }

// ---------------------------------------------------------------- 1-2. grille sur tout l'historique
const t0 = Date.now()
const start = idxAt(Date.parse('2017-01-01'))
interface Cand { s1: Float64Array; s2: Float64Array; entries: number[] }
const cands: Cand[][] = [[], []]
for (const regime of [0, 1] as const) {
  const sel = new Int8Array(bars.n).fill(-1)
  for (let i = 0; i < bars.n; i++) if (regimeOf(i) === regime) sel[i] = 0
  for (const p of grid) {
    const r = simulate(m, [paramsOf(regime, p)], COSTS, start, bars.n - 1, sel)
    // Sommes cumulées des rendements quotidiens (et de leurs carrés) pour un Sharpe en O(1) par fenêtre.
    const s1 = new Float64Array(dayEnd.length + 1), s2 = new Float64Array(dayEnd.length + 1)
    let prev = COSTS.capital
    for (let d = 0; d < dayEnd.length; d++) {
      const i = dayEnd[d]
      const ret = i >= start && prev > 0 ? r.equity[i] / prev - 1 : 0
      if (i >= start) prev = r.equity[i]
      s1[d + 1] = s1[d] + ret
      s2[d + 1] = s2[d] + ret * ret
    }
    cands[regime].push({ s1, s2, entries: r.positions.map(x => bars.t[x.entryIdx]) })
  }
}
console.log(`grille : ${grid.length} points × 2 régimes en ${((Date.now() - t0) / 1000).toFixed(0)} s`)

function sharpe(c: Cand, d0: number, d1: number): number {
  const n = d1 - d0
  if (n < 30) return 0
  const mean = (c.s1[d1] - c.s1[d0]) / n
  const v = (c.s2[d1] - c.s2[d0]) / n - mean * mean
  return v > 0 ? (mean / Math.sqrt(v)) * Math.sqrt(365.25) : 0
}
const tradesIn = (c: Cand, a: number, b: number) => c.entries.filter(t => t >= a && t < b).length

// ---------------------------------------------------------------- 3. fenêtres
const addMonths = (t: number, k: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + k); return d.getTime() }
const end = bars.t[bars.n - 1] + 15 * 60000
interface Win { a: number; b: number; trainFrom: number; plateau: (Point | null)[]; best: (Point | null)[]; score: number[] }
const wins: Win[] = []
for (let a = Date.parse(FROM); a < end; a = addMonths(a, TEST)) {
  const b = Math.min(addMonths(a, TEST), end)
  const trainFrom = addMonths(a, -TRAIN)
  const d0 = dayIdx(trainFrom), d1 = dayIdx(a)
  const w: Win = { a, b, trainFrom, plateau: [null, null], best: [null, null], score: [0, 0] }
  for (const regime of [0, 1] as const) {
    const raw = grid.map(p => { const c = cands[regime][gid(p)]; return tradesIn(c, trainFrom, a) >= MIN_TRADES ? sharpe(c, d0, d1) : NaN })
    // Meilleur Sharpe isolé.
    let bi = -1
    for (let g = 0; g < grid.length; g++) if (Number.isFinite(raw[g]) && (bi < 0 || raw[g] > raw[bi])) bi = g
    w.best[regime] = bi >= 0 && raw[bi] > 0 ? grid[bi] : null
    // Plateau : moyenne sur le point et ses voisins (un point sans assez de trades compte 0).
    let pi = -1, ps = -Infinity
    for (let g = 0; g < grid.length; g++) {
      if (!Number.isFinite(raw[g])) continue
      const p = grid[g]
      let s = 0, n = 0
      for (const q of grid) if (Math.abs(q.k - p.k) <= 1 && Math.abs(q.s - p.s) <= 1 && Math.abs(q.tr - p.tr) <= 1) { const v = raw[gid(q)]; s += Number.isFinite(v) ? v : 0; n++ }
      if (s / n > ps) { ps = s / n; pi = g }
    }
    w.plateau[regime] = pi >= 0 && ps > 0 ? grid[pi] : null
    w.score[regime] = ps
  }
  wins.push(w)
}

// ---------------------------------------------------------------- 4. courbes hors échantillon
const oosStart = idxAt(Date.parse(FROM))
// Pendant le test, seuls les deux jeux de réglages (calme, agité) sont figés. Le reste évolue à
// chaque bougie comme en live : indicateurs (choc, ATR, volume, lambda, compression, filtre 60
// min, VWAP), régime de volatilité (relu chaque jour sur la dernière journée close, contre sa
// médiane des 365 jours précédents) et donc jeu appliqué, stops et stop suiveur.
// `freezeRegime` : contrôle seulement, régime figé à sa valeur du début de la fenêtre.
function stitched(pick: (w: Win, regime: 0 | 1) => Point | null, freezeRegime = false) {
  const sets: ShockParams[] = []
  const setRegime: (0 | 1)[] = []
  const sel = new Int8Array(bars.n).fill(-1)
  for (const w of wins) {
    const ids = [0, 1].map(regime => { const p = pick(w, regime as 0 | 1); if (!p) return -1; sets.push(paramsOf(regime as 0 | 1, p)); setRegime.push(regime as 0 | 1); return sets.length - 1 })
    const a = idxAt(w.a)
    for (let i = a; i < bars.n && bars.t[i] < w.b; i++) { const rg = regimeOf(freezeRegime ? a : i); if (rg >= 0) sel[i] = ids[rg] }
  }
  const r = simulate(m, sets.length ? sets : [DEFAULT_PARAMS], COSTS, oosStart, bars.n - 1, sel)
  return Object.assign(r, { setRegime })
}
const wfPlateau = stitched((w, r) => w.plateau[r])
const wfBest = stitched((w, r) => w.best[r])
const wfFrozen = stitched((w, r) => w.plateau[r], true)
const fixed = simulate(m, preset.sets, COSTS, oosStart, bars.n - 1, presetSelect)
const last = bars.n - 1

// ---------------------------------------------------------------- rapport
const L: string[] = []
const out = (s = '') => L.push(s)
const bh = bars.c[last] / bars.c[oosStart] - 1
const yearsOOS = (bars.t[last] - bars.t[oosStart]) / (365.25 * 864e5)
let bhPk = -Infinity, bhDd = 0
for (let i = oosStart; i <= last; i++) { bhPk = Math.max(bhPk, bars.c[i]); bhDd = Math.min(bhDd, bars.c[i] / bhPk - 1) }
const row = (name: string, r: ReturnType<typeof simulate>) => {
  const x = metricsOf(bars, r, oosStart, last)
  return [name, pct(x.totalReturn, 0), pct(x.cagr), num(x.sharpe), num(x.sortino), pct(x.maxDrawdown), num(x.profitFactor), String(x.trades), pct(x.winRate, 0), pct(x.exposure, 0)]
}
const table = (h: string[], rows: string[][]) => { out(`| ${h.join(' | ')} |`); out(`| ${h.map((_, k) => (k ? '---:' : '---')).join(' | ')} |`); for (const r of rows) out(`| ${r.join(' | ')} |`) }

const BASE_TXT = { preset: 'réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d\'information vers les tests)', script: 'réglages non optimisés : valeurs par défaut du script (mode High Activity coupé), longs et shorts', 'script-long': 'réglages non optimisés : valeurs par défaut du script (mode High Activity coupé), longs seulement' }[BASE]
out(`# Walk-forward ${TRAIN / 12} ans / ${TEST} mois, réglages choisis sur plateaux · adaptatif 15 min · ${BASE}`); out()
out(`Base : ${BASE_TXT}.`); out()
out(`BTC/USD Bitstamp 15 min. Calibration sur les ${TRAIN} mois précédant chaque test, test de ${TEST} mois, pas de ${TEST} mois, de ${FROM} au ${day(bars.t[last])} (${wins.length} fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.`); out()
out(`Grille par régime : seuil du choc ${K.join(' / ')} × stop ${STOP.join(' / ')} ATR × stop suiveur ${TRAIL.map(x => (x >= 50 ? 'sans' : x)).join(' / ')} ATR, soit ${grid.length} réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de ${MIN_TRADES} trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.`); out()
out('## Courbe hors échantillon (segments de test seulement)'); out()
table(['', 'rendement', 'CAGR', 'Sharpe', 'Sortino', 'pire baisse', 'profit factor', 'trades', 'gagnants', 'temps investi'], [
  row('**Walk-forward, plateaux**', wfPlateau),
  row('Walk-forward, meilleur Sharpe isolé', wfBest),
  row('Contrôle : plateaux, régime figé au début de chaque test', wfFrozen),
  row('Préréglage fixe (choisi sur 2017-2026 : flatteur)', fixed),
  ['Achat conservé', pct(bh, 0), pct(Math.pow(1 + bh, 1 / yearsOOS) - 1), '—', '—', pct(bhDd), '—', '—', '—', '100 %'],
])
out()
out('Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.'); out()

// Ce qui est figé, ce qui évolue.
let switches = 0, agiBars = 0, known = 0
const winSwitch: number[] = []
for (const w of wins) {
  let n = 0, prev = -2
  for (let i = idxAt(w.a); i < bars.n && bars.t[i] < w.b; i++) {
    const rg = regimeOf(i)
    if (rg >= 0) { known++; agiBars += rg; if (prev >= 0 && rg !== prev) n++; prev = rg }
  }
  winSwitch.push(n); switches += n
}
const byRegime = [0, 1].map(rg => wfPlateau.positions.filter(p => wfPlateau.setRegime[p.set] === rg).length)
out('## Ce qui est figé, ce qui évolue pendant chaque test'); out()
out('- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l\'un pour le régime calme, l\'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l\'absence de trade dans un régime.')
out('- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l\'ont ouverte jusqu\'à sa sortie.')
out(`- **Mesuré** : ${switches} changements de régime pendant les tests, dans ${winSwitch.filter(x => x > 0).length} fenêtres sur ${wins.length} ; régime agité ${pct(agiBars / Math.max(1, known), 0)} du temps ; trades ouverts en régime calme ${byRegime[0]}, en régime agité ${byRegime[1]}.`)
out('- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.')
out()

// Par année.
out('## Par année (walk-forward, plateaux)'); out()
const yr: string[][] = []
for (let y = new Date(bars.t[oosStart]).getUTCFullYear(); y <= new Date(bars.t[last]).getUTCFullYear(); y++) {
  const a = Math.max(oosStart, idxAt(Date.UTC(y, 0, 1))), b = Math.min(last, idxAt(Date.UTC(y + 1, 0, 1)) - 1)
  if (b <= a) continue
  const e0 = a > oosStart ? wfPlateau.equity[a - 1] : COSTS.capital
  const f0 = a > oosStart ? fixed.equity[a - 1] : COSTS.capital
  yr.push([String(y), pct(wfPlateau.equity[b] / e0 - 1), pct(fixed.equity[b] / f0 - 1), pct(bars.c[b] / bars.c[a > oosStart ? a - 1 : a] - 1), String(wfPlateau.positions.filter(p => p.entryIdx >= a && p.entryIdx <= b).length)])
}
table(['année', 'walk-forward', 'préréglage fixe', 'achat conservé', 'trades'], yr)
out()

// Réglages par fenêtre.
out('## Réglages retenus à chaque fenêtre'); out()
const wr: string[][] = []
for (const w of wins) {
  const a = idxAt(w.a), b = Math.min(last, idxAt(w.b) - 1)
  const e0 = a > oosStart ? wfPlateau.equity[a - 1] : COSTS.capital
  const inWin = wfPlateau.positions.filter(p => p.entryIdx >= a && p.entryIdx <= b)
  const nC = inWin.filter(p => wfPlateau.setRegime[p.set] === 0).length
  let agi = 0, kn = 0, sw = 0, prev = -2
  for (let i = a; i <= b; i++) { const rg = regimeOf(i); if (rg >= 0) { kn++; agi += rg; if (prev >= 0 && rg !== prev) sw++; prev = rg } }
  wr.push([`${day(w.a)} → ${day(Math.min(w.b, end) - 1)}`, `${day(w.trainFrom)} → ${day(w.a - 1)}`, `${label(w.plateau[0])} (${num(w.score[0])})`, `${label(w.plateau[1])} (${num(w.score[1])})`, `${pct(agi / Math.max(1, kn), 0)} · ${sw}`, pct(wfPlateau.equity[b] / e0 - 1), pct(bars.c[b] / bars.c[Math.max(0, a - 1)] - 1), `${inWin.length} (${nC} / ${inWin.length - nC})`])
}
table(['test', 'calibration', 'régime calme (note de plateau)', 'régime agité (note de plateau)', 'test : temps agité · changements de régime', 'test : stratégie', 'test : BTC', 'trades (calme / agité)'], wr)
out()
// Stabilité des choix.
const changes = (r: 0 | 1) => wins.slice(1).filter((w, k) => label(w.plateau[r]) !== label(wins[k].plateau[r])).length
out(`Changements de réglages d'une fenêtre à la suivante : ${changes(0)} sur ${wins.length - 1} en régime calme, ${changes(1)} sur ${wins.length - 1} en régime agité.`); out()

const file = new URL(`../reports/shock-15m-wf-plateau-${TRAIN}-${TEST}${BASE === 'preset' ? '' : `-${BASE}`}.md`, import.meta.url).pathname
writeFileSync(file, L.join('\n') + '\n')
// Courbes quotidiennes pour le graphique.
const curve = dayEnd.filter(i => i >= oosStart).map(i => ({ t: bars.t[i], wf: wfPlateau.equity[i] / COSTS.capital, best: wfBest.equity[i] / COSTS.capital, fixed: fixed.equity[i] / COSTS.capital, bh: bars.c[i] / bars.c[oosStart] }))
writeFileSync(file.replace(/\.md$/, '.json'), JSON.stringify({ windows: wins.map(w => ({ test: [day(w.a), day(w.b - 1)], calm: label(w.plateau[0]), agitated: label(w.plateau[1]), score: w.score })), curve }))
console.log(L.join('\n'))
console.log(`\nrapport : ${file} (${((Date.now() - t0) / 1000).toFixed(0)} s)`)
