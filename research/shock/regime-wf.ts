// Sélection des paramètres par régime de marché, validée en walk-forward.
//
//   node research/shock/regime-wf.ts --tf 30 [--samples 200] [--test-from 2019-01-01] [--test 3]
//                                    [--min 15] [--tmin 1] [--costs script|realistic] [--seed 5]
//
// Idée : un algo qui, à chaque barre, lit le régime du marché (tendance × volatilité, voir
// regimes.ts) et applique le jeu de paramètres qui a le mieux marché dans ce régime par le passé,
// ou ne trade pas si aucun jeu n'y a d'edge.
//
// Méthode, sans lecture du futur :
// 1. Chaque jeu candidat (le script, tes réglages, des variantes, des tirages au hasard) est
//    backtesté une fois sur tout l'historique ; chaque position est rattachée au régime de sa
//    barre d'entrée.
// 2. Pour chaque fenêtre de test de 3 mois, on n'utilise que les positions entrées avant le début
//    du test (fenêtre d'entraînement qui s'agrandit). Dans chaque régime, on note chaque jeu par
//    son t-stat (moyenne / écart type × √n des rendements par position) sur chacune des deux
//    moitiés de l'entraînement, et on garde le plus petit des deux : un jeu doit avoir marché sur
//    les deux moitiés. Le meilleur jeu est retenu si cette note dépasse `tmin`, sinon le régime
//    n'est pas tradé.
// 3. L'algo complet (un jeu par régime) est rejoué sur la fenêtre de test, et comparé au meilleur
//    jeu unique choisi de la même façon tous régimes confondus, au script et à tes réglages.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { dailyReturns, stitched, alphaBeta } from '../lib/series.ts'
import { makeMarket, runShock, simulate } from './engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, REALISTIC_COSTS, USER_2026, withParams } from './params.ts'
import type { Costs, ShockParams } from './params.ts'
import { classify, REGIME_NAMES } from './regimes.ts'
import { rng } from '../../lib/backtest/robustness.ts'

type Over = Partial<Record<keyof ShockParams, unknown>>

// ---------------------------------------------------------------- candidats
function sample(R: () => number): Over {
  const pick = (min: number, max: number, step: number) => Number((min + Math.floor(R() * (Math.round((max - min) / step) + 1)) * step).toFixed(6))
  const side = R()
  const trailOff = R() < 0.3
  return {
    allowLong: side < 0.67,
    allowShort: side >= 0.33,
    highActivityMode: R() < 0.4,
    kMain: pick(1.8, 3.4, 0.1),
    kMicro: pick(1.0, 2.4, 0.1),
    useMicroShock: R() < 0.7,
    volWin: pick(40, 200, 10),
    rangeWin: pick(5, 60, 5),
    wickThr: pick(0.3, 0.7, 0.05),
    cooldownBars: pick(2, 24, 1),
    useVolFilter: R() < 0.8,
    volZWin: pick(20, 80, 5),
    volZThr: pick(-0.5, 1.5, 0.1),
    useHTF: R() < 0.85,
    htfMinutes: [60, 240, 1440, 4320][Math.floor(R() * 4)],
    htfEmaLen: pick(10, 100, 5),
    htfSlopeMode: R() < 0.5 ? 'chart' : 'htf',
    useCompression: R() < 0.4,
    compThr: pick(-1, 0.5, 0.1),
    atrLen: pick(10, 30, 2),
    atrStopMult: pick(0.8, 3.5, 0.1),
    atrTrailMult: trailOff ? 50 : pick(0.8, 4.0, 0.1),
    useTP1: R() < 0.75,
    tp1AtrMult: pick(0.5, 3.0, 0.1),
    tp1QtyPct: pick(20, 80, 10),
    flipMainOnly: R() < 0.5,
  }
}

const FIXED: { name: string; over: Over }[] = [
  { name: 'script tel quel', over: {} },
  { name: 'tes réglages (oct. 2026)', over: USER_2026 },
  { name: 'script, longs seuls', over: { allowShort: false } },
  { name: 'script, shorts seuls', over: { allowLong: false } },
  { name: 'tes réglages, longs seuls', over: { ...USER_2026, allowShort: false } },
  { name: 'tes réglages, filtre 60 min', over: { ...USER_2026, htfMinutes: 60 } },
]

/**
 * Menu court de configurations lisibles : deux bases (le script, tes réglages) et un réglage
 * plus sélectif, chacun en long, en short ou dans les deux sens. Choisir dans ce menu par régime
 * revient surtout à décider, régime par régime, s'il faut trader et dans quel sens.
 */
const MENU: { name: string; over: Over }[] = (() => {
  const bases: [string, Over][] = [
    ['script', {}],
    ['tes réglages', USER_2026],
    ['tes réglages + filtre 60 min', { ...USER_2026, htfMinutes: 60 }],
    ['script sélectif (z > 1,8, cooldown 12)', { kMicro: 2.0, cooldownBars: 24 }],
  ]
  const out: { name: string; over: Over }[] = []
  for (const [name, over] of bases) {
    out.push({ name: `${name}, long + short`, over })
    out.push({ name: `${name}, longs`, over: { ...over, allowShort: false } })
    out.push({ name: `${name}, shorts`, over: { ...over, allowLong: false } })
  }
  return out
})()

export function candidates(n: number, seed: number, pool = 'random'): { name: string; over: Over }[] {
  if (pool === 'menu') return MENU.slice()
  const R = rng(seed)
  const out = FIXED.slice()
  for (let k = 0; k < n; k++) out.push({ name: `#${out.length}`, over: sample(R) })
  return out
}

// ---------------------------------------------------------------- calcul des candidats (workers)
interface CandRun {
  k: number
  entry: Int32Array
  pnl: Float64Array
}

function costsOf(name: string): Costs {
  return name === 'realistic' ? REALISTIC_COSTS : SCRIPT_COSTS
}

if (!isMainThread) {
  const { tf, ks, cands, start, costs } = workerData as { tf: number; ks: number[]; cands: { over: Over }[]; start: number; costs: string }
  const bars = loadBtc(tf)
  const m = makeMarket(bars, tf, loadBtc(60))
  for (const k of ks) {
    const r = runShock(m, withParams(DEFAULT_PARAMS, cands[k].over), costsOf(costs), start, bars.n - 1)
    const entry = Int32Array.from(r.positions.map(p => p.entryIdx))
    const pnl = Float64Array.from(r.positions.map(p => p.pnlPct))
    parentPort!.postMessage({ k, entry, pnl } satisfies CandRun, [entry.buffer, pnl.buffer])
    m.memo.clear()
  }
  parentPort!.postMessage('done')
}

// ---------------------------------------------------------------- sélection
interface Pick {
  cand: number
  score: number
  n: number
}

function tstat(xs: number[]): number {
  const n = xs.length
  if (n < 2) return -Infinity
  const m = xs.reduce((s, x) => s + x, 0) / n
  const v = xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1)
  return v > 0 ? (m / Math.sqrt(v)) * Math.sqrt(n) : m > 0 ? Infinity : -Infinity
}

/** Meilleur candidat sur les positions entrées dans [a, b), régime `r` (ou tous si r < 0). */
function choose(runs: CandRun[], reg: Int8Array, a: number, b: number, r: number, minN: number, tMin: number): Pick {
  const mid = Math.floor((a + b) / 2)
  let best: Pick = { cand: -1, score: -Infinity, n: 0 }
  for (const run of runs) {
    const h1: number[] = []
    const h2: number[] = []
    for (let j = 0; j < run.entry.length; j++) {
      const e = run.entry[j]
      if (e < a || e >= b) continue
      if (r >= 0 && reg[e] !== r) continue
      ;(e < mid ? h1 : h2).push(run.pnl[j])
    }
    if (h1.length < minN || h2.length < minN) continue
    const score = Math.min(tstat(h1), tstat(h2))
    if (score > best.score) best = { cand: run.k, score, n: h1.length + h2.length }
  }
  if (best.score < tMin) return { cand: -1, score: best.score, n: best.n }
  return best
}

// ---------------------------------------------------------------- programme principal
const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : '—')
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—')

function diff(over: Over): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(over)) {
    const def = (DEFAULT_PARAMS as unknown as Record<string, unknown>)[k]
    if (v === def) continue
    if (k === 'atrTrailMult' && v === 50) { parts.push('sans trailing'); continue }
    if (k === 'htfMinutes') { parts.push(`HTF ${Number(v) >= 1440 ? `${Number(v) / 1440} j` : `${Number(v) / 60} h`}`); continue }
    parts.push(`${k}=${v}`)
  }
  return parts.join(', ') || 'valeurs par défaut'
}

async function main() {
  const args = process.argv.slice(2)
  const a: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) if (args[i].startsWith('--')) a[args[i].slice(2)] = args[i + 1]
  const tf = Number(a.tf ?? 30)
  const nSamples = Number(a.samples ?? 200)
  const testM = Number(a.test ?? 3)
  const minN = Number(a.min ?? 15)
  const tMin = Number(a.tmin ?? 1)
  const costsName = a.costs ?? 'script'
  const costs = costsOf(costsName)
  const seed = Number(a.seed ?? 5)
  const outDir = a.out ?? 'research/reports'
  const bars = loadBtc(tf)
  const hourly = loadBtc(60)
  const m = makeMarket(bars, tf, hourly)
  const start = indexAtOrAfter(bars, dayMs(a.from ?? '2017-01-01'))
  const end = bars.n - 1
  // Découpage des régimes : complet (6), tendance seule (3) ou volatilité seule (2).
  const mode = a.regimes ?? 'full'
  const reg0 = classify(bars, tf, hourly)
  const names = mode === 'trend' ? ['haussier', 'neutre', 'baissier'] : mode === 'vol' ? ['calme', 'agité'] : REGIME_NAMES
  const NR = names.length
  const mapId = (x: number) => (x < 0 ? -1 : mode === 'trend' ? Math.floor(x / 2) : mode === 'vol' ? x % 2 : x)
  const reg = { id: Int8Array.from(reg0.id, mapId), daily: { ...reg0.daily, id: Int8Array.from(reg0.daily.id, mapId) } }
  const pool = a.pool ?? 'random'
  const cands = candidates(nSamples, seed, pool)
  const t0 = Date.now()
  console.log(`BTC ${tf} min · ${cands.length} jeux · coûts ${costsName}`)

  // 1. Un run complet par candidat.
  const runs: CandRun[] = []
  const nW = 4
  await Promise.all(Array.from({ length: nW }, (_, w) => new Promise<void>((resolve, reject) => {
    const ks = cands.map((_, k) => k).filter(k => k % nW === w)
    const worker = new Worker(fileURLToPath(import.meta.url), { workerData: { tf, ks, cands, start, costs: costsName }, execArgv: ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'] })
    worker.on('message', msg => {
      if (msg === 'done') { worker.terminate(); resolve(); return }
      runs.push(msg as CandRun)
      process.stdout.write(`\r${runs.length}/${cands.length} jeux · ${Math.round((Date.now() - t0) / 1000)} s`)
    })
    worker.on('error', reject)
  })))
  process.stdout.write('\n')
  runs.sort((x, y) => x.k - y.k)

  // 2. Plis : entraînement de `start` au début du test, test de testM mois.
  const addMonths = (t: number, k: number) => { const d = new Date(t); d.setUTCMonth(d.getUTCMonth() + k); return d.getTime() }
  const folds: { a: number; b: number }[] = []
  for (let t = dayMs(a['test-from'] ?? '2019-01-01'); t < bars.t[end]; t = addMonths(t, testM)) {
    const s = indexAtOrAfter(bars, t)
    const e = Math.min(end, indexAtOrAfter(bars, addMonths(t, testM)) - 1)
    if (e - s > 50) folds.push({ a: s, b: e })
  }
  const series: Record<string, number[]> = { regime: [], global: [], script: [], user: [], hold: [] }
  const expo: Record<string, [number, number]> = { regime: [0, 0], global: [0, 0], script: [0, 0], user: [0, 0], hold: [1, 1] }
  const addExpo = (k: string, pos: Int8Array | null, a0: number, b0: number) => {
    if (!pos) { expo[k][1] += b0 - a0 + 1; return }
    for (let i = a0; i <= b0; i++) { if (pos[i] !== 0) expo[k][0]++; expo[k][1]++ }
  }
  const choices: Pick[][] = []
  const globalChoices: Pick[] = []
  const rankLog: { regime: number; rank: number }[] = []
  for (const f of folds) {
    const picks = Array.from({ length: NR }, (_, r) => choose(runs, reg.id, start, f.a, r, minN, tMin))
    const g = choose(runs, reg.id, start, f.a, -1, minN * 3, tMin)
    choices.push(picks)
    globalChoices.push(g)
    // Algo par régime.
    const used = [...new Set(picks.filter(p => p.cand >= 0).map(p => p.cand))]
    const setOf = new Map(used.map((c, k) => [c, k]))
    const startEq = 10000
    let eqR: Float64Array
    if (used.length) {
      const sel = new Int8Array(bars.n).fill(-1)
      for (let i = f.a; i <= f.b; i++) {
        const r = reg.id[i]
        const p = r >= 0 ? picks[r] : null
        sel[i] = p && p.cand >= 0 ? setOf.get(p.cand)! : -1
      }
      const rr = simulate(m, used.map(c => withParams(DEFAULT_PARAMS, cands[c].over)), costs, f.a, f.b, sel)
      eqR = rr.equity
      addExpo('regime', rr.position, f.a, f.b)
    } else { eqR = new Float64Array(bars.n).fill(startEq); addExpo('regime', null, f.a, f.b) }
    series.regime.push(...dailyReturns(bars.t, eqR, f.a, f.b, startEq).rets)
    const single = (key: string, over: Over | null) => {
      if (!over) { addExpo(key, null, f.a, f.b); return new Float64Array(bars.n).fill(startEq) }
      const r1 = runShock(m, withParams(DEFAULT_PARAMS, over), costs, f.a, f.b)
      addExpo(key, r1.position, f.a, f.b)
      return r1.equity
    }
    series.global.push(...dailyReturns(bars.t, single('global', g.cand >= 0 ? cands[g.cand].over : null), f.a, f.b, startEq).rets)
    series.script.push(...dailyReturns(bars.t, single('script', {}), f.a, f.b, startEq).rets)
    series.user.push(...dailyReturns(bars.t, single('user', USER_2026), f.a, f.b, startEq).rets)
    const hold = new Float64Array(bars.n)
    for (let i = f.a; i <= f.b; i++) hold[i] = (startEq * bars.c[i]) / bars.c[f.a - 1]
    series.hold.push(...dailyReturns(bars.t, hold, f.a, f.b, startEq).rets)
    // Rang en test du jeu choisi dans chaque régime, parmi tous les jeux (rendement moyen par position).
    for (let r = 0; r < NR; r++) {
      const pk = picks[r]
      if (pk.cand < 0) continue
      const means: number[] = []
      let chosenMean = NaN
      for (const run of runs) {
        let s = 0, k = 0
        for (let j = 0; j < run.entry.length; j++) {
          const e = run.entry[j]
          if (e >= f.a && e <= f.b && reg.id[e] === r) { s += run.pnl[j]; k++ }
        }
        if (!k) continue
        means.push(s / k)
        if (run.k === pk.cand) chosenMean = s / k
      }
      if (Number.isFinite(chosenMean) && means.length > 5) rankLog.push({ regime: r, rank: means.filter(x => x < chosenMean).length / (means.length - 1) })
    }
    process.stdout.write(`\rplis ${choices.length}/${folds.length} · ${Math.round((Date.now() - t0) / 1000)} s`)
  }
  process.stdout.write('\n')

  // 3. Choix finaux, entraînés sur tout l'historique : ce que l'algo utiliserait aujourd'hui.
  const finalPicks = Array.from({ length: NR }, (_, r) => choose(runs, reg.id, start, end + 1, r, minN, tMin))
  const finalGlobal = choose(runs, reg.id, start, end + 1, -1, minN * 3, tMin)

  // ---------------------------------------------------------------- rapport
  const md: string[] = []
  const out = (s = '') => md.push(s)
  const label = (i: number) => new Date(bars.t[i]).toISOString().slice(0, 10)
  out(`# Shock Engine · BTC/USD ${tf} min · paramètres par régime de marché`)
  out()
  out(`Entraînement de ${label(start)} au début de chaque test (fenêtre qui s'agrandit), tests de ${testM} mois de ${label(folds[0].a)} à ${label(end)}. ${cands.length} jeux candidats (${pool === 'menu' ? 'menu court de configurations lisibles' : 'le script, tes réglages, des variantes et des tirages au hasard'}). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins ${minN} positions par moitié) ; régime non tradé si la meilleure note est sous ${tMin}. Coûts : ${costsName}.`)
  out()
  out('## 1. Les régimes')
  out()
  out(`Tendance journalière (clôture contre moyenne 50 jours, pente sur 10 jours) × volatilité (écart type 20 jours contre sa médiane sur un an). Découpage utilisé ici : ${mode === 'trend' ? 'tendance seule' : mode === 'vol' ? 'volatilité seule' : 'tendance × volatilité'}. Le régime du jour s\'applique au lendemain.`)
  out()
  out('| régime | part du temps | rendement BTC moyen par jour | jours |')
  out('| --- | ---: | ---: | ---: |')
  const dId = reg.daily.id
  const t0d = bars.t[start]
  for (let r = 0; r < NR; r++) {
    let k = 0, s = 0, tot = 0
    for (let i = 0; i + 1 < dId.length; i++) {
      if (reg.daily.t[i] < t0d || dId[i] < 0) continue
      tot++
      if (dId[i] !== r) continue
      k++
      s += reg.daily.ret[i + 1]
    }
    out(`| ${names[r]} | ${pct(k / tot, 0)} | ${pct(s / Math.max(1, k), 2)} | ${k} |`)
  }
  out()
  out('## 2. Résultat hors échantillon (fenêtres de test mises bout à bout)')
  out()
  out('| stratégie | rendement | CAGR | Sharpe | pire baisse | temps en position | bêta BTC | alpha / an | t de l\'alpha |')
  out('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  const rows: [string, string][] = [
    ['regime', '**Algo par régime** (un jeu par régime, ou pas de trade)'],
    ['global', 'Meilleur jeu unique (choisi de la même façon, tous régimes confondus)'],
    ['script', 'Script tel quel'],
    ['user', 'Tes réglages (oct. 2026)'],
    ['hold', 'Achat conservé BTC'],
  ]
  const summary: Record<string, unknown> = {}
  for (const [k, name] of rows) {
    const s = stitched(series[k])
    summary[k] = s
    const ab = alphaBeta(series[k], series.hold)
    out(`| ${name} | ${pct(s.ret, 0)} | ${pct(s.cagr)} | ${num(s.sharpe)} | ${pct(s.dd, 0)} | ${pct(expo[k][0] / Math.max(1, expo[k][1]), 0)} | ${num(ab.beta)} | ${pct(ab.alphaYear)} | ${num(ab.tAlpha)} |`)
  }
  out()
  out('Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L\'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.')
  out()
  const ranks = rankLog.map(x => x.rank)
  const below = ranks.filter(x => x < 0.5).length
  out('## 3. Surajustement')
  out()
  out(`- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **${pct(ranks.reduce((s, x) => s + x, 0) / Math.max(1, ranks.length), 0)}** (50 % = hasard, 100 % = toujours le meilleur).`)
  out(`- Part des choix qui finissent sous la médiane en test (PBO) : **${pct(below / Math.max(1, ranks.length), 0)}** sur ${ranks.length} choix.`)
  for (let r = 0; r < NR; r++) {
    const rr = rankLog.filter(x => x.regime === r).map(x => x.rank)
    if (rr.length) out(`  - ${names[r]} : rang moyen ${pct(rr.reduce((s, x) => s + x, 0) / rr.length, 0)} sur ${rr.length} plis`)
  }
  out()
  out('## 4. Choix par régime, pli par pli')
  out()
  out('Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.')
  out()
  out(`| test | ${names.join(' | ')} | jeu unique |`)
  out(`| --- | ${names.map(() => '---').join(' | ')} | --- |`)
  for (const [j, f] of folds.entries()) {
    out(`| ${label(f.a).slice(0, 7)} | ${choices[j].map(p => (p.cand >= 0 ? `${p.cand}` : '—')).join(' | ')} | ${globalChoices[j].cand >= 0 ? globalChoices[j].cand : '—'} |`)
  }
  out()
  if (pool === 'menu') {
    out('Numéros du menu :')
    out()
    cands.forEach((c, k) => out(`- ${k} : ${c.name}`))
    out()
  }
  out('## 5. Réglages que l\'algo utiliserait aujourd\'hui (entraînés sur tout l\'historique)')
  out()
  out('| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |')
  out('| --- | --- | ---: | ---: | --- |')
  for (let r = 0; r < NR; r++) {
    const p = finalPicks[r]
    out(`| ${names[r]} | ${p.cand >= 0 ? `${p.cand} · ${cands[p.cand].name}` : 'pas de trade'} | ${num(p.score)} | ${p.n} | ${p.cand >= 0 ? diff(cands[p.cand].over) : ''} |`)
  }
  out()
  out(`Meilleur jeu unique sur tout l'historique : ${finalGlobal.cand >= 0 ? `${finalGlobal.cand} · ${cands[finalGlobal.cand].name} (note ${num(finalGlobal.score)}, ${finalGlobal.n} positions) — ${diff(cands[finalGlobal.cand].over)}` : 'aucun'}.`)
  out()
  out('Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d\'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.')
  out()
  mkdirSync(outDir, { recursive: true })
  const tag = `shock-${tf}m-regimes${mode !== 'full' ? `-${mode}` : ''}${pool === 'menu' ? '-menu' : ''}${costsName !== 'script' ? `-${costsName}` : ''}${seed !== 5 && pool !== 'menu' ? `-seed${seed}` : ''}`
  writeFileSync(join(outDir, `${tag}.md`), md.join('\n') + '\n')
  writeFileSync(join(outDir, `${tag}.json`), JSON.stringify({
    tf, costs: costsName, regimes: names, summary,
    finalGlobal: { ...finalGlobal, params: finalGlobal.cand >= 0 ? withParams(DEFAULT_PARAMS, cands[finalGlobal.cand].over) : null },
    final: finalPicks.map((p, r) => ({ regime: names[r], cand: p.cand, score: p.score, n: p.n, params: p.cand >= 0 ? withParams(DEFAULT_PARAMS, cands[p.cand].over) : null })),
    folds: folds.map((f, j) => ({ test: label(f.a), picks: choices[j], global: globalChoices[j] })),
    candidates: cands,
  }, null, 1))
  console.log(`rapport -> ${join(outDir, tag + '.md')} · ${Math.round((Date.now() - t0) / 1000)} s`)
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) main()
