// Optimisation walk-forward du Shock Engine, avec mesure du surajustement.
//
//   node research/shock/walkforward.ts --tf 30 [--from 2017-01-01] [--train 12] [--test 3]
//                                      [--samples 300] [--min-trades 30] [--seed 1] [--costs script|realistic]
//
// Méthode :
// 1. On tire au hasard `samples` jeux de paramètres dans l'espace de recherche (plus le script tel
//    quel et deux variantes de référence). Le même tirage sert à tous les plis.
// 2. Pour chaque pli : tous les jeux sont backtestés sur la fenêtre d'entraînement (train mois) et
//    sur la fenêtre de test qui suit (test mois). Le jeu retenu est celui qui a le meilleur Sharpe
//    à l'entraînement, avec un minimum de positions par an.
// 3. Les fenêtres de test, mises bout à bout, donnent une courbe entièrement hors échantillon.
// 4. Surajustement : pour chaque pli, rang du jeu retenu parmi tous les jeux sur la fenêtre de
//    test. PBO = part des plis où il finit sous la médiane (Bailey et al., 2015). Sharpe dégonflé
//    (Bailey et López de Prado, 2014) pour le meilleur jeu sur toute la période.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { sharpeOf } from '../lib/stats.ts'
import { makeMarket, runShock, sliceMarket } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, REALISTIC_COSTS, withParams } from '../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import { rng } from '../../lib/backtest/robustness.ts'

type Over = Partial<Record<keyof ShockParams, unknown>>

interface Fold {
  k: number
  trainStart: number
  trainEnd: number
  testStart: number
  testEnd: number
}

interface Perf {
  sharpe: number
  ret: number
  dd: number
  n: number
}

interface FoldOut {
  k: number
  train: Perf[]
  test: Perf[]
  chosen: number
  /** Rendements quotidiens hors échantillon du jeu retenu et du script tel quel. */
  dailyChosen: number[]
  dailyBase: number[]
  days: number[]
}

const WARMUP = 4000

// ---------------------------------------------------------------- espace de recherche
function sample(R: () => number): Over {
  const pick = (min: number, max: number, step: number) => {
    const k = Math.floor(R() * (Math.round((max - min) / step) + 1))
    return Number((min + k * step).toFixed(6))
  }
  const trailOff = R() < 0.35
  return {
    kMicro: pick(1.0, 2.4, 0.1),
    kMain: pick(1.8, 3.4, 0.1),
    volWin: pick(40, 200, 10),
    rangeWin: pick(5, 60, 5),
    wickThr: pick(0.3, 0.7, 0.05),
    cooldownBars: pick(2, 24, 1),
    volZThr: pick(-0.5, 1.5, 0.1),
    htfEmaLen: pick(10, 100, 5),
    atrStopMult: pick(0.8, 3.5, 0.1),
    atrTrailMult: trailOff ? 50 : pick(0.8, 4.0, 0.1),
    tp1AtrMult: pick(0.5, 3.0, 0.1),
    tp1QtyPct: pick(20, 80, 10),
    useTP1: R() < 0.7,
    useMicroShock: R() < 0.7,
    highActivityMode: R() < 0.5,
    htfSlopeMode: R() < 0.5 ? 'chart' : 'htf',
    allowShort: R() < 0.5,
  }
}

/** Espace réduit : structure fixée (longs seuls, sans stop suiveur), quelques réglages seulement. */
function sampleReduced(R: () => number): Over {
  const pick = (min: number, max: number, step: number) => {
    const k = Math.floor(R() * (Math.round((max - min) / step) + 1))
    return Number((min + k * step).toFixed(6))
  }
  return {
    allowShort: false,
    atrTrailMult: 50,
    kMicro: pick(1.0, 2.4, 0.1),
    volWin: pick(40, 200, 10),
    rangeWin: pick(5, 60, 5),
    cooldownBars: pick(2, 24, 1),
    atrStopMult: pick(0.8, 3.5, 0.1),
    tp1AtrMult: pick(0.5, 3.0, 0.1),
    tp1QtyPct: pick(20, 80, 10),
  }
}

export function candidates(n: number, seed: number, space = 'full'): Over[] {
  const R = rng(seed)
  const out: Over[] = [{}, { allowShort: false }, { atrTrailMult: 50 }, { allowShort: false, atrTrailMult: 50 }]
  while (out.length < n + 4) out.push(space === 'reduced' ? sampleReduced(R) : sample(R))
  return out
}

// ---------------------------------------------------------------- calcul d'un pli
function dailyReturns(t: Float64Array, eq: Float64Array, a: number, b: number) {
  const days: number[] = []
  const rets: number[] = []
  let prevEq = eq[a - 1] > 0 ? eq[a - 1] : eq[a]
  let curDay = Math.floor(t[a] / 86400000)
  for (let i = a; i <= b; i++) {
    const d = Math.floor(t[i] / 86400000)
    const last = i === b || Math.floor(t[i + 1] / 86400000) !== d
    if (last) {
      days.push(d)
      rets.push(eq[i] / prevEq - 1)
      prevEq = eq[i]
      curDay = d
    }
  }
  void curDay
  return { days, rets }
}

function perfOf(eq: Float64Array, positions: { entryIdx: number }[], a: number, b: number, ppy: number): Perf {
  let peak = eq[a - 1] > 0 ? eq[a - 1] : eq[a]
  let dd = 0
  for (let i = a; i <= b; i++) {
    if (eq[i] > peak) peak = eq[i]
    else dd = Math.min(dd, eq[i] / peak - 1)
  }
  const start = eq[a - 1] > 0 ? eq[a - 1] : 10000
  return { sharpe: sharpeOf(eq, a - 1, b, ppy), ret: eq[b] / start - 1, dd, n: positions.filter(p => p.entryIdx >= a && p.entryIdx <= b).length }
}

function runFold(tf: number, f: Fold, cands: Over[], minTradesYear: number, costsName: string): FoldOut {
  const bars = loadBtc(tf)
  const base = makeMarket(bars, tf, loadBtc(60))
  const a0 = Math.max(0, f.trainStart - WARMUP)
  const m = sliceMarket(base, a0, f.testEnd)
  const ts = f.trainStart - a0
  const te = f.trainEnd - a0
  const ss = f.testStart - a0
  const se = f.testEnd - a0
  const costs = costsName === 'realistic' ? REALISTIC_COSTS : SCRIPT_COSTS
  const ppy = (365.25 * 24 * 60) / tf
  const trainYears = (bars.t[f.trainEnd] - bars.t[f.trainStart]) / (365.25 * 86400000)
  const train: Perf[] = []
  const test: Perf[] = []
  const eqs: Float64Array[] = []
  for (const c of cands) {
    const p = withParams(DEFAULT_PARAMS, c)
    // Un seul run de bout en bout : la fenêtre de test commence avec l'état laissé par l'entraînement,
    // comme en réalité. Les mesures de test repartent du capital atteint au début du test.
    const r = runShock(m, p, costs, ts, se)
    train.push(perfOf(r.equity, r.positions, ts, te, ppy))
    test.push(perfOf(r.equity, r.positions, ss, se, ppy))
    eqs.push(r.equity)
  }
  let chosen = 0
  let best = -Infinity
  train.forEach((x, k) => {
    const ok = x.n >= minTradesYear * trainYears
    if (ok && x.sharpe > best) { best = x.sharpe; chosen = k }
  })
  const dc = dailyReturns(m.bars.t, eqs[chosen], ss, se)
  const db = dailyReturns(m.bars.t, eqs[0], ss, se)
  return { k: f.k, train, test, chosen, dailyChosen: dc.rets, dailyBase: db.rets, days: dc.days }
}

if (!isMainThread) {
  const { tf, folds, cands, minTrades, costs } = workerData as { tf: number; folds: Fold[]; cands: Over[]; minTrades: number; costs: string }
  for (const f of folds) parentPort!.postMessage(runFold(tf, f, cands, minTrades, costs))
  parentPort!.postMessage('done')
}

// ---------------------------------------------------------------- statistiques
function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}

function normInv(p: number): number {
  // Acklam
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) }
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

function moments(x: number[]) {
  const n = x.length
  const m = x.reduce((s, v) => s + v, 0) / n
  let m2 = 0, m3 = 0, m4 = 0
  for (const v of x) { const d = v - m; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d }
  m2 /= n; m3 /= n; m4 /= n
  const sd = Math.sqrt(m2)
  return { n, mean: m, sd, skew: sd > 0 ? m3 / sd ** 3 : 0, kurt: sd > 0 ? m4 / sd ** 4 : 3 }
}

/** Sharpe dégonflé : probabilité que le vrai Sharpe soit > 0, compte tenu de N essais. */
function deflatedSharpe(daily: number[], trialSharpes: number[]): { sr: number; sr0: number; dsr: number } {
  const mo = moments(daily)
  const sr = mo.sd > 0 ? mo.mean / mo.sd : 0
  const ts = moments(trialSharpes)
  const N = trialSharpes.length
  const g = 0.5772156649
  const sr0 = ts.sd * ((1 - g) * normInv(1 - 1 / N) + g * normInv(1 - 1 / (N * Math.E)))
  const denom = Math.sqrt(Math.max(1e-12, 1 - mo.skew * sr + ((mo.kurt - 1) / 4) * sr * sr))
  const dsr = normCdf(((sr - sr0) * Math.sqrt(mo.n - 1)) / denom)
  return { sr, sr0, dsr }
}

function stitched(rets: number[]) {
  let eq = 1
  let peak = 1
  let dd = 0
  for (const r of rets) {
    eq *= 1 + r
    if (eq > peak) peak = eq
    else dd = Math.min(dd, eq / peak - 1)
  }
  const mo = moments(rets)
  const years = rets.length / 365.25
  return { ret: eq - 1, cagr: eq > 0 ? eq ** (1 / years) - 1 : -1, sharpe: mo.sd > 0 ? (mo.mean / mo.sd) * Math.sqrt(365.25) : 0, dd }
}

const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : '—')
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—')

function describe(c: Over): string {
  if (!Object.keys(c).length) return 'script tel quel'
  const parts: string[] = []
  for (const [k, v] of Object.entries(c)) {
    if (k === 'atrTrailMult' && v === 50) { parts.push('sans trailing'); continue }
    if (k === 'allowShort') { parts.push(v ? 'long+short' : 'longs seuls'); continue }
    parts.push(`${k}=${v}`)
  }
  return parts.join(', ')
}

// ---------------------------------------------------------------- programme principal
async function main() {
  const args = process.argv.slice(2)
  const a: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) a[args[i].slice(2)] = args[i + 1]
  const tf = Number(a.tf ?? 30)
  const trainM = Number(a.train ?? 12)
  const testM = Number(a.test ?? 3)
  const nSamples = Number(a.samples ?? 300)
  const minTrades = Number(a['min-trades'] ?? 30)
  const seed = Number(a.seed ?? 1)
  const costs = a.costs ?? 'script'
  const outDir = a.out ?? 'research/reports'
  const bars = loadBtc(tf)
  const from = dayMs(a.from ?? '2017-01-01')
  const lastT = bars.t[bars.n - 1]
  const addMonths = (t: number, k: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + k); return d.getTime() }
  const folds: Fold[] = []
  for (let t = from, k = 0; addMonths(t, trainM) < lastT; t = addMonths(t, testM), k++) {
    const ts = indexAtOrAfter(bars, t)
    const ss = indexAtOrAfter(bars, addMonths(t, trainM))
    const se = Math.min(bars.n - 1, indexAtOrAfter(bars, addMonths(t, trainM + testM)) - 1)
    if (se - ss < 100) break
    folds.push({ k, trainStart: ts, trainEnd: ss - 1, testStart: ss, testEnd: se })
  }
  const space = a.space ?? 'full'
  const cands = candidates(nSamples, seed, space)
  console.log(`BTC ${tf} min · ${folds.length} plis (${trainM} mois / ${testM} mois) · ${cands.length} jeux de paramètres · coûts ${costs}`)
  const nW = Math.min(4, folds.length)
  const results: FoldOut[] = []
  const t0 = Date.now()
  await Promise.all(Array.from({ length: nW }, (_, w) => new Promise<void>((resolve, reject) => {
    const mine = folds.filter((_, k) => k % nW === w)
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { tf, folds: mine, cands, minTrades, costs }, execArgv: ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'] })
    worker.on('message', msg => {
      if (msg === 'done') { worker.terminate(); resolve(); return }
      results.push(msg as FoldOut)
      process.stdout.write(`\r${results.length}/${folds.length} plis · ${Math.round((Date.now() - t0) / 1000)} s`)
    })
    worker.on('error', reject)
  })))
  process.stdout.write('\n')
  results.sort((x, y) => x.k - y.k)

  const label = (i: number) => new Date(bars.t[i]).toISOString().slice(0, 7)
  const md: string[] = []
  const out = (s = '') => md.push(s)
  out(`# Shock Engine · BTC/USD ${tf} min · walk-forward`)
  out()
  out(`${folds.length} plis : ${trainM} mois d'entraînement, puis ${testM} mois de test, en avançant de ${testM} mois. ${cands.length} jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis ${nSamples} tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins ${minTrades} positions par an. Coûts : ${costs}. Espace de recherche : ${space === 'reduced' ? 'réduit (longs seuls, sans stop suiveur, 7 réglages)' : 'complet (17 réglages, structure comprise)'}.`)
  out()

  // Courbes hors échantillon.
  const allChosen = results.flatMap(r => r.dailyChosen)
  const allBase = results.flatMap(r => r.dailyBase)
  const sc = stitched(allChosen)
  const sb = stitched(allBase)
  // Meilleur jeu fixe sur toute la période (choisi après coup, donc biaisé) : moyenne de ses Sharpe de test.
  const nC = cands.length
  const meanTest = Array.from({ length: nC }, (_, c) => results.reduce((s, r) => s + r.test[c].sharpe, 0) / results.length)
  const order = meanTest.map((v, c) => [v, c] as [number, number]).sort((x, y) => y[0] - x[0])
  const fixedLongNoTrail = Array.from({ length: 4 }, (_, c) => c)
  out('## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)')
  out()
  out('| stratégie | rendement | CAGR | Sharpe | max DD |')
  out('| --- | ---: | ---: | ---: | ---: |')
  out(`| Walk-forward (paramètres réoptimisés à chaque pli) | ${pct(sc.ret, 0)} | ${pct(sc.cagr)} | ${num(sc.sharpe)} | ${pct(sc.dd, 0)} |`)
  out(`| Script tel quel | ${pct(sb.ret, 0)} | ${pct(sb.cagr)} | ${num(sb.sharpe)} | ${pct(sb.dd, 0)} |`)
  for (const c of fixedLongNoTrail.slice(1)) {
    // Ces trois variantes fixes sont définies avant toute optimisation : leur résultat de test est honnête.
    const s = results.reduce((acc, r) => acc + r.test[c].sharpe, 0) / results.length
    out(`| ${describe(cands[c])} (fixe, Sharpe de test moyen) | | | ${num(s)} | |`)
  }
  out()

  // Surajustement.
  let below = 0
  const ranks: number[] = []
  for (const r of results) {
    const chosenTest = r.test[r.chosen].sharpe
    const rank = r.test.filter(x => x.sharpe < chosenTest).length / (nC - 1)
    ranks.push(rank)
    if (rank < 0.5) below++
  }
  const pbo = below / results.length
  const ds = deflatedSharpe(allChosen, meanTest.map(x => x / Math.sqrt(365.25)))
  out('## 2. Surajustement')
  out()
  out(`- **PBO** (probabilité de surajustement) : **${pct(pbo, 0)}** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.`)
  out(`- Rang moyen du jeu choisi en test : ${pct(ranks.reduce((s, x) => s + x, 0) / ranks.length, 0)} (50 % = hasard).`)
  out(`- Sharpe dégonflé de la courbe walk-forward : probabilité ${pct(ds.dsr, 0)} que son Sharpe réel soit positif, compte tenu de ${nC} essais (Sharpe quotidien ${num(ds.sr, 3)} contre un seuil de ${num(ds.sr0, 3)} attendu par chance).`)
  out()

  // Par pli.
  out('## 3. Pli par pli')
  out()
  out('| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |')
  out('| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |')
  for (const [j, r] of results.entries()) {
    const f = folds[r.k]
    const tr = r.train[r.chosen]
    const te = r.test[r.chosen]
    out(`| ${r.k + 1} | ${label(f.testStart)} → ${label(f.testEnd)} | ${num(tr.sharpe)} | ${num(te.sharpe)} | ${pct(te.ret)} | ${te.n} | ${pct(ranks[j], 0)} | ${num(r.test[0].sharpe)} | ${r.chosen < 4 ? describe(cands[r.chosen]) : `#${r.chosen}`} |`)
  }
  out()

  // Stabilité des paramètres choisis.
  out('## 4. Stabilité des paramètres choisis')
  out()
  out('Si l\'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d\'un bout à l\'autre de l\'intervalle signalent du bruit.')
  out()
  const keys = ['kMicro', 'kMain', 'volWin', 'rangeWin', 'wickThr', 'cooldownBars', 'volZThr', 'htfEmaLen', 'atrStopMult', 'atrTrailMult', 'tp1AtrMult', 'tp1QtyPct', 'useTP1', 'useMicroShock', 'highActivityMode', 'htfSlopeMode', 'allowShort'] as const
  out('| paramètre | valeurs choisies (par pli) |')
  out('| --- | --- |')
  for (const k of keys) {
    const vals = results.map(r => {
      const p = withParams(DEFAULT_PARAMS, cands[r.chosen])
      const v = p[k]
      return k === 'atrTrailMult' && v === 50 ? 'off' : String(v)
    })
    out(`| ${k} | ${vals.join(' · ')} |`)
  }
  out()

  // Exploration : jeux réguliers sur tous les plis.
  out('## 5. Exploration : jeux les plus réguliers sur l\'ensemble des tests')
  out()
  out('Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.')
  out()
  out('| rang | Sharpe test moyen | plis positifs | jeu |')
  out('| ---: | ---: | ---: | --- |')
  for (const [rank, [v, c]] of order.slice(0, 12).entries()) {
    const pos = results.filter(r => r.test[c].sharpe > 0).length
    out(`| ${rank + 1} | ${num(v)} | ${pos}/${results.length} | ${describe(cands[c])} |`)
  }
  out()
  mkdirSync(outDir, { recursive: true })
  const tag = `shock-${tf}m-walkforward${space === 'reduced' ? '-reduced' : ''}${trainM !== 12 ? `-train${trainM}` : ''}${costs !== 'script' ? `-${costs}` : ''}`
  const path = join(outDir, `${tag}.md`)
  writeFileSync(path, md.join('\n') + '\n')
  writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({ tf, trainM, testM, costs, cands, folds, results: results.map(r => ({ k: r.k, chosen: r.chosen, train: r.train, test: r.test })) }))
  console.log(`rapport -> ${path} · ${Math.round((Date.now() - t0) / 1000)} s`)
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) main()
