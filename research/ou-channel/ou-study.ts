// OU Trend Channel Pro v2.3 (indicateur Pine du propriétaire) transformé en stratégie sur BTC/USD 15 min.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/ou-channel/ou-study.ts [--tf 15|30|60|240]
//
// --tf : timeframe (15 par défaut ; 30 et 60 depuis les fichiers Bitstamp, 240 regroupé depuis 60).
// Réglages en nombre de bougies du timeframe. Le Sharpe dégonflé compte les essais des quatre
// timeframes (4 × la grille) dès que l'on sort de 15 min.
//
// Signaux (logique « trap » du script, base EMA 34 par défaut) : croix violette bearTrapNew = LONG,
// croix orange bullTrapNew = SHORT. Une position à la fois, sans levier, 100 % du capital ; signal lu à
// la clôture, exécution à l'ouverture de la bougie suivante ; stop initial k × ATR(30) de la bougie du
// signal, sortie sur signal opposé (retournement), TP et stop suiveur en option ; commission 0,045 % par
// ordre. Entraînement 2017-01-01 → 2022-12-31, validation 2023-01-01 → 2026-09-30 (jamais utilisée
// pour choisir). Shock Engine V1 n'est pas modifié ; son benchmark est lu dans
// research/reports/reference/reference_daily_returns.csv.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { ouMarket, BASE_ENTRY, BASE_EXIT } from './lib.ts'
import type { Entry, Exit, Res } from './lib.ts'
import { dsr } from '../lib/overfit.ts'

const TF = Number(process.argv.includes('--tf') ? process.argv[process.argv.indexOf('--tf') + 1] : 15)
const TAG = TF === 15 ? '' : `-${TF}m`
const { signals, train, valid, FEE } = ouMarket(TF)
const T1 = Date.parse('2023-01-01'), T2 = Date.parse('2026-10-01')

// ---------------------------------------------------------------- 1. baseline et grille d'entrée
const Z = [1.8, 2.2, 2.6, 3.0], R = [1, 2, 3, 5], W = [0.5, 0.6, 0.7], V = [0.5, 1.0, 1.5]
const grid: Entry[] = []
for (const zMin of Z) for (const reentry of R) for (const wickThr of W) {
  for (const volMin of V) grid.push({ zMin, reentry, wickThr, volMin, volDiv: true })
  grid.push({ zMin, reentry, wickThr, volMin: NaN, volDiv: false })
}
const MIN_TRADES = 50
const sigCache = new Map<string, Int8Array>()
const sigOf = (e: Entry) => { const k = JSON.stringify(e); let s = sigCache.get(k); if (!s) { s = signals(e); sigCache.set(k, s) } return s }
const rows = grid.map(e => ({ e, ex: BASE_EXIT, tr: train(sigOf(e), BASE_EXIT) }))
const eligible = rows.filter(x => x.tr.trades >= MIN_TRADES).sort((a, b) => b.tr.sharpe - a.tr.sharpe)
const top5 = eligible.slice(0, 5)
const positive = rows.filter(x => x.tr.sharpe > 0).length

// ---------------------------------------------------------------- 2. sorties (18 variantes sur la meilleure entrée)
const best = top5[0]
const exits: Exit[] = []
for (const stop of [2, 3.3, 4.5]) for (const tpR of [0, 2, 3]) for (const trail of [false, true]) exits.push({ stop, tpR, trail })
const exitRows = exits.map(ex => ({ e: best.e, ex, tr: train(sigOf(best.e), ex) }))
const trials = rows.length + exitRows.length - 1 // la variante 3,3 ATR / sans TP / sans suiveur est déjà dans la grille

// ---------------------------------------------------------------- 3. trois candidates, validation, robustesse
const pool = [...eligible.slice(0, 5), ...exitRows.filter(x => x.tr.trades >= MIN_TRADES)]
const seen = new Set<string>()
const cands = pool.sort((a, b) => b.tr.sharpe - a.tr.sharpe).filter(x => { const k = JSON.stringify([x.e, x.ex]); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 3)
const neighbours = (e: Entry) => {
  const out: Entry[] = []
  const step = <T>(arr: T[], x: T, d: number) => arr[arr.indexOf(x) + d]
  for (const d of [-1, 1]) {
    for (const [key, arr] of [['zMin', Z], ['reentry', R], ['wickThr', W]] as const) { const x = step(arr as number[], e[key], d); if (x !== undefined) out.push({ ...e, [key]: x }) }
    if (e.volDiv) { const x = step(V, e.volMin, d); if (x !== undefined) out.push({ ...e, volMin: x }) }
  }
  return out
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN }
const candOut = cands.map(x => {
  const va = valid(sigOf(x.e), x.ex), va2 = valid(sigOf(x.e), x.ex, 2 * FEE)
  const nb = neighbours(x.e).map(e => ({ tr: train(sigOf(e), x.ex).sharpe, va: valid(sigOf(e), x.ex).sharpe }))
  return { ...x, va, va2, nbTrain: med(nb.map(y => y.tr)), nbValid: med(nb.map(y => y.va)), nbValidPos: nb.filter(y => y.va > 0).length / nb.length, dsrTrain: dsr(x.tr.r, trials, 0.0291).p }
})
const baseVa = valid(sigOf(BASE_ENTRY), BASE_EXIT)
const baseTr = train(sigOf(BASE_ENTRY), BASE_EXIT)
// Dispersion réelle des Sharpe journaliers des essais (pour le Sharpe dégonflé).
const trialSd = (() => { const s = rows.map(x => { const r = x.tr.r, m = r.reduce((a, y) => a + y, 0) / r.length; const sd = Math.sqrt(r.reduce((a, y) => a + (y - m) ** 2, 0) / r.length); return sd > 0 ? m / sd : 0 }); const m = s.reduce((a, y) => a + y, 0) / s.length; return Math.sqrt(s.reduce((a, y) => a + (y - m) ** 2, 0) / (s.length - 1)) })()
const nTrials = TF === 15 ? trials : 4 * trials
for (const x of candOut) x.dsrTrain = dsr(x.tr.r, nTrials, trialSd).p

// ---------------------------------------------------------------- 4. Shock Engine V1 (sleeve BTC publiée), mêmes périodes
const v1 = readFileSync('research/reports/reference/reference_daily_returns.csv', 'utf8').trim().split('\n').slice(1).map(s => s.split(',')).map(p => ({ d: Date.parse(p[0]), r: +p[1] }))
const v1m = (a: number, z1: number) => {
  const r = v1.filter(x => x.d >= a && x.d < z1).map(x => x.r)
  let e = 1, pk = 1, mdd = 0
  for (const x of r) { e *= 1 + x; pk = Math.max(pk, e); mdd = Math.min(mdd, e / pk - 1) }
  const m = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length)
  return { cagr: Math.pow(e, 365.25 / r.length) - 1, sharpe: (m / sd) * Math.sqrt(365.25), mdd, from: new Date(a).toISOString().slice(0, 10) }
}
const v1Train = v1m(Date.parse('2018-09-01'), T1), v1Valid = v1m(T1, T2)

// ---------------------------------------------------------------- rapport
const pc = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '—').replace('.', ',')
const nm = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—').replace('.', ',').replace('-', '−')
const desc = (e: Entry, ex: Exit) => `z ${e.zMin} · réintégration ${e.reentry} · mèche ${e.wickThr} · ${e.volDiv ? `vol z < ${e.volMin}` : 'sans filtre volume'} · stop ${ex.stop} ATR${ex.tpR ? ` · TP ${ex.tpR}R` : ''}${ex.trail ? ' · suiveur' : ''}`
const row = (name: string, tr: Res, va: Res | null) => `| ${name} | ${pc(tr.cagr)} | ${nm(tr.sharpe)} | ${pc(tr.mdd)} | ${nm(tr.pf)} | ${tr.trades} | ${pc(tr.win)} | ${va ? nm(va.sharpe) : '—'} |`
const L: string[] = []
L.push(`# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD ${TF >= 60 ? `${TF / 60} h` : `${TF} min`}`, '')
L.push(`Bitstamp ${TF} min${TF === 240 ? ' (regroupé depuis 60 min)' : ''}, réglages en bougies du timeframe. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins ${MIN_TRADES} trades. Essais : ${trials} (${rows.length} entrées + ${exitRows.length - 1} sorties)${TF === 15 ? '' : ` ; Sharpe dégonflé avec ${nTrials} essais (quatre timeframes)`}. Produit par \`node research/ou-channel/ou-study.ts${TF === 15 ? '' : ` --tf ${TF}`}\`.`, '')
L.push('| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |', '|---|---|---|---|---|---|---|---|')
L.push(row('Baseline (réglages d\'origine, stop 3,3 ATR)', baseTr, baseVa))
top5.forEach((x, k) => L.push(row(`Top ${k + 1} entraînement · ${desc(x.e, x.ex)}`, x.tr, valid(sigOf(x.e), x.ex))))
L.push('', `Grille d'entrée : ${positive}/${rows.length} configurations à Sharpe d'entraînement > 0.`, '')
L.push('## Candidates (validation)', '', '| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |', '|---|---|---|---|---|---|---|---|---|---|')
for (const x of candOut) L.push(`| ${desc(x.e, x.ex)} | ${nm(x.tr.sharpe)} | ${nm(x.va.sharpe)} | ${pc(x.va.cagr)} | ${pc(x.va.mdd)} | ${nm(x.va.pf)} | ${x.va.trades} | ${nm(x.va2.sharpe)} | ${nm(x.nbTrain)} · ${nm(x.nbValid)} · ${pc(x.nbValidPos)} | ${nm(x.dsrTrain, 3)} |`)
L.push('', '## Sorties testées sur la meilleure entrée (entraînement)', '', '| Sortie | Sharpe | CAGR | MDD | PF | Trades |', '|---|---|---|---|---|---|')
for (const x of exitRows) L.push(`| stop ${x.ex.stop} · ${x.ex.tpR ? `TP ${x.ex.tpR}R` : 'sans TP'} · ${x.ex.trail ? 'suiveur' : 'sans suiveur'} | ${nm(x.tr.sharpe)} | ${pc(x.tr.cagr)} | ${pc(x.tr.mdd)} | ${nm(x.tr.pf)} | ${x.tr.trades} |`)
L.push('', `## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)`, '', `Entraînement (${v1Train.from} → 2022-12-31) : CAGR ${pc(v1Train.cagr)}, Sharpe ${nm(v1Train.sharpe)}, MDD ${pc(v1Train.mdd)} · validation 2023-01-01 → 2026-09-30 : CAGR ${pc(v1Valid.cagr)}, Sharpe ${nm(v1Valid.sharpe)}, MDD ${pc(v1Valid.mdd)}.`)
mkdirSync('research/reports/ou-channel', { recursive: true })
writeFileSync(`research/reports/ou-channel/ou-channel${TAG}.md`, L.join('\n') + '\n')
const strip = (r: Res) => { const { r: _r, list: _l, days: _d, ...x } = r; return x }
writeFileSync(`research/reports/ou-channel/ou-channel${TAG}.json`, JSON.stringify({ tf: TF, trials, nTrials, baseline: { train: strip(baseTr), valid: strip(baseVa) }, top5: top5.map(x => ({ entry: x.e, exit: x.ex, train: strip(x.tr), valid: strip(valid(sigOf(x.e), x.ex)) })), candidates: candOut.map(x => ({ entry: x.e, exit: x.ex, train: strip(x.tr), valid: strip(x.va), validFees2: strip(x.va2), nbTrain: x.nbTrain, nbValid: x.nbValid, nbValidPos: x.nbValidPos, dsrTrain: x.dsrTrain })), exits: exitRows.map(x => ({ exit: x.ex, train: strip(x.tr) })), v1: { train: v1Train, valid: v1Valid }, trialSd }, null, 1))
console.log([`TF ${TF}`, ...L.slice(4, 11), `pos ${positive}/${rows.length}`, ...candOut.map(x => `cand ${desc(x.e, x.ex)} | tr ${nm(x.tr.sharpe)} va ${nm(x.va.sharpe)} cagrVa ${pc(x.va.cagr)} mddVa ${pc(x.va.mdd)} pfVa ${nm(x.va.pf)} nVa ${x.va.trades} fx2 ${nm(x.va2.sharpe)} nb ${nm(x.nbValid)} ${pc(x.nbValidPos)} dsr ${nm(x.dsrTrain, 3)}`)].join('\n'))
