// Robustesse locale du préréglage du bot (adaptatif volatilité · 15 min), sans rien optimiser :
// le préréglage est-il sur un plateau (ses voisins font à peu près aussi bien) ou sur un pic isolé
// (le moindre écart le dégrade nettement) ? Aucun nouveau réglage n'est choisi ni proposé.
//
//   node research/shock/robustness-local.ts [--asset btc|ethusdt] [--n 300] [--n-ext 100] [--seed 7] [--workers 4]
//
// --asset : BTC (Bitstamp, par défaut) ou un autre actif lu dans research/data/<actif>_15m.csv.gz
// (bougies 15 min, timestamp ms, open, high, low, close, volume), avec le même préréglage.
//
// Méthode :
// 1. Réglages perturbés : ceux que le préréglage fixe (choisis par optimisation) et que le moteur
//    utilise vraiment, dans les deux régimes. Les réglages sans effet (voir INACTIVE) ne sont pas
//    perturbés ; le test « un réglage à la fois » vérifie qu'ils ne changent aucune bougie.
// 2. Voisins aléatoires : pour chaque niveau L (5, 10, 20 %), `n` configurations où tous les
//    réglages des deux régimes bougent en même temps, chacun tiré indépendamment et uniformément
//    dans ±L (valeur × (1 + d)). Entiers arrondis. Seuils en écarts-types (volZThr, dont la valeur
//    agitée est négative et proche de 0) : valeur + d × max(|valeur|, 1). Famille « étendue » :
//    en plus, les réglages du script que le préréglage ne touche pas mais qui agissent.
// 3. Un réglage à la fois : ±5, ±10, ±20 % sur chaque réglage, les autres inchangés.
// 4. Cartes : grilles 9 × 9 (−20 % à +20 %, pas de 5 %) sur des paires choisies a priori : seuil
//    du choc, fenêtre de volatilité, stop, stop suiveur.
// Chaque configuration est une seule simulation du début de la période à la fin des données, régime de
// volatilité recalculé en ligne comme dans le bot ; les métriques sont ensuite découpées par
// sous-période (le capital de départ d'une sous-période est celui atteint à son début).

import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { cpus } from 'node:os'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { loadBtc } from '../lib/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'

// Actif (lu aussi par les workers, qui reçoivent les mêmes arguments).
const ARGV = process.argv.slice(2)
const ASSET = (() => { const i = ARGV.indexOf('--asset'); return i >= 0 ? ARGV[i + 1] : 'btc' })()
interface AssetCfg { label: string; mintick: number; warm: string; splits: [string, string, string | null][] }
const ASSETS: Record<string, AssetCfg> = {
  btc: {
    label: 'BTC/USD Bitstamp', mintick: 1, warm: '2016-01-01',
    splits: [['2017–2026', '2017-01-01', null], ['2017–2018', '2017-01-01', '2019-01-01'], ['2019–2020', '2019-01-01', '2021-01-01'], ['2021–2022', '2021-01-01', '2023-01-01'], ['2023–2024', '2023-01-01', '2025-01-01'], ['2025–2026', '2025-01-01', null]],
  },
  ethusdt: {
    label: 'ETH/USDT Binance', mintick: 0.01, warm: '2017-08-17',
    splits: [['2018–2026', '2018-09-01', null], ['2018–2020', '2018-09-01', '2021-01-01'], ['2021–2022', '2021-01-01', '2023-01-01'], ['2023–2024', '2023-01-01', '2025-01-01'], ['2025–2026', '2025-01-01', null]],
  },
}
const AC = ASSETS[ASSET]
if (!AC) throw new Error(`actif inconnu : ${ASSET}`)
const COSTS: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: AC.mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
const SPLITS = AC.splits
const FULL = SPLITS[0][0]
const SUFFIX = ASSET === 'btc' ? '' : `-${ASSET}`

function loadCsv(path: string): Bars {
  const lines = gunzipSync(readFileSync(path)).toString('latin1').split('\n')
  const rows = lines.filter(x => /^\d/.test(x)).map(x => x.split(',').map(Number))
  const col = (k: number) => Float64Array.from(rows, r => r[k])
  return { n: rows.length, t: col(0), o: col(1), h: col(2), l: col(3), c: col(4), v: col(5) }
}
// Métriques gardées par sous-période, dans cet ordre.
const MET = ['ret', 'cagr', 'sharpe', 'sortino', 'pf', 'dd', 'trades'] as const
type Pack = number[]

function setup() {
  const all = ASSET === 'btc' ? loadBtc(15) : loadCsv(`research/data/${ASSET}_15m.csv.gz`)
  const bars = sliceBars(all, Date.parse(AC.warm), all.t[all.n - 1])
  const daily = ASSET === 'btc' ? resample(loadBtc(60), 86400000) : resample(bars, 86400000)
  const m = marketFor(bars, 15, AC.mintick)
  const preset = adaptivePreset(15, AC.mintick)
  const { select } = selectFor(preset, m, daily)
  const idxAt = (t: number) => { let lo = 0, hi = bars.n; while (lo < hi) { const md = (lo + hi) >> 1; if (bars.t[md] < t) lo = md + 1; else hi = md } return lo }
  const wins = SPLITS.map(([, a, b]) => [idxAt(Date.parse(a)), b ? idxAt(Date.parse(b)) - 1 : bars.n - 1] as [number, number])
  const lo = wins[0][0]
  const dayEnd: number[] = []
  for (let i = lo; i < bars.n; i++) if (i === bars.n - 1 || Math.floor(bars.t[i + 1] / 864e5) !== Math.floor(bars.t[i] / 864e5)) dayEnd.push(i)
  return { bars, m, preset, select, wins, lo, dayEnd }
}

interface Job { key: string; sets: ShockParams[]; curve: boolean }
interface Res { key: string; w: Pack[]; eq: Float32Array | null }

if (!isMainThread) {
  const S = setup()
  parentPort!.on('message', (job: Job) => {
    const r = simulate(S.m, job.sets, COSTS, S.lo, S.bars.n - 1, S.select)
    const w = S.wins.map(([a, b]) => {
      const x = metricsOf(S.bars, r, a, b)
      return [x.totalReturn, x.cagr, x.sharpe, x.sortino, x.profitFactor, x.maxDrawdown, x.trades]
    })
    const eq = job.curve ? Float32Array.from(S.dayEnd, i => r.equity[i] / COSTS.capital) : null
    parentPort!.postMessage({ key: job.key, w, eq } satisfies Res, eq ? [eq.buffer] : [])
  })
  parentPort!.postMessage({ ready: true })
}

// ---------------------------------------------------------------- réglages
type Kind = 'int' | 'real' | 'z'
type Family = 'preset' | 'script' | 'inactive'
interface Knob { reg: 0 | 1; key: keyof ShockParams; kind: Kind; family: Family; min: number; max: number; why?: string; note?: string }
const REG = ['calme', 'agité']
const knob = (reg: 0 | 1, key: keyof ShockParams, kind: Kind, family: Family, min = 0, max = Infinity, why?: string): Knob => ({ reg, key, kind, family, min, max, why })
// Réglages du préréglage qui agissent en principe mais pas, ou presque pas, dans le régime agité
// (longs seulement, mode High Activity) : gardés dans les perturbations, signalés dans le rapport.
const NOTES: Record<string, string> = {
  'agité · kMain': 'le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s\'il passe sous 2,0',
  'agité · wickThr': 'un long exige une clôture dans le quart haut de la bougie, donc une mèche haute < 0,25 : un seuil de 0,36 à 0,54 ne filtre rien',
  'agité · volZThr': 'un long exige déjà un volume au-dessus de sa moyenne (z > 0) : un seuil de −0,7 à −0,3 ne filtre rien',
}

const KNOBS: Knob[] = [
  // Réglages du préréglage, actifs.
  ...([0, 1] as const).flatMap(reg => [
    knob(reg, 'volWin', 'int', 'preset', 5),
    knob(reg, 'kMain', 'real', 'preset', 0.5),
    ...(reg === 1 ? [knob(reg, 'kMicro', 'real', 'preset', 0.5)] : []),
    knob(reg, 'rangeWin', 'int', 'preset', 2),
    knob(reg, 'wickThr', 'real', 'preset', 0.01, 1),
    knob(reg, 'htfEmaLen', 'int', 'preset', 2),
    knob(reg, 'volZWin', 'int', 'preset', 2),
    knob(reg, 'volZThr', 'z', 'preset', -Infinity),
    knob(reg, 'atrLen', 'int', 'preset', 2),
    knob(reg, 'atrStopMult', 'real', 'preset', 0.05),
    knob(reg, 'atrTrailMult', 'real', 'preset', 0.05),
    ...(reg === 1 ? [knob(reg, 'tp1AtrMult', 'real', 'preset', 0.05), knob(reg, 'tp1QtyPct', 'int', 'preset', 1, 100)] : []),
  ]),
  // Réglages du script que le préréglage ne fixe pas mais qui agissent (famille étendue).
  ...([0, 1] as const).flatMap(reg => [
    knob(reg, 'lamEmaWin', 'int', 'script', 2),
    knob(reg, 'lamNormWin', 'int', 'script', 2),
    knob(reg, 'longLamPct', 'real', 'script', 0, 100),
    knob(reg, 'htfSlopeBars', 'int', 'script', 1),
  ]),
  // Sans effet dans ce préréglage : jamais perturbés, seulement vérifiés un par un.
  ...([0, 1] as const).flatMap(reg => [
    knob(reg, 'cooldownBars', 'int', 'inactive', 0, Infinity, 'mode High Activity : cooldown = max(⌊valeur / 2⌋, 2), soit 2 bougies pour toute valeur de 2 à 5'),
    knob(reg, 'compThr', 'z', 'inactive', -Infinity, Infinity, 'mode High Activity : le filtre de compression est coupé'),
  ]),
  knob(0, 'kMicro', 'real', 'inactive', 0.5, Infinity, 'micro-chocs coupés en régime calme (useMicroShock = false)'),
  knob(0, 'tp1AtrMult', 'real', 'inactive', 0.05, Infinity, 'TP1 coupé en régime calme (useTP1 = false)'),
  knob(0, 'tp1QtyPct', 'int', 'inactive', 1, 100, 'TP1 coupé en régime calme (useTP1 = false)'),
]
const PRESET = adaptivePreset(15, AC.mintick)
const valueOf = (k: Knob) => PRESET.sets[k.reg][k.key] as number
const knobName = (k: Knob) => `${REG[k.reg]} · ${k.key}`
/** Valeur lisible : 4 chiffres significatifs au plus (0.32000000000000006 → 0.32). */
const show = (v: number) => String(+v.toPrecision(4))

function moved(k: Knob, d: number): number {
  const x = valueOf(k)
  let y = k.kind === 'z' ? x + d * Math.max(Math.abs(x), 1) : x * (1 + d)
  if (k.kind === 'int') y = Math.round(y)
  return Math.min(k.max, Math.max(k.min, y))
}

function setsWith(deltas: Map<Knob, number>): ShockParams[] {
  const sets = PRESET.sets.map(s => ({ ...s }))
  for (const [k, d] of deltas) (sets[k.reg] as unknown as Record<string, number>)[k.key] = moved(k, d)
  return sets
}

// Générateur reproductible (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

// ---------------------------------------------------------------- statistiques
function quantile(xs: number[], q: number): number {
  const s = xs.filter(x => !Number.isNaN(x)).sort((a, b) => a - b)
  if (!s.length) return NaN
  const p = (s.length - 1) * q, i = Math.floor(p), f = p - i
  return i + 1 < s.length ? s[i] + f * (s[i + 1] - s[i]) : s[i]
}
function ranks(xs: number[]): number[] {
  const idx = xs.map((x, i) => [x, i] as [number, number]).sort((a, b) => a[0] - b[0])
  const r = new Array<number>(xs.length)
  for (let i = 0; i < idx.length;) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2
    i = j + 1
  }
  return r
}
function spearman(a: number[], b: number[]): number {
  const ra = ranks(a), rb = ranks(b), n = a.length
  const ma = ra.reduce((s, x) => s + x, 0) / n, mb = rb.reduce((s, x) => s + x, 0) / n
  let num = 0, da = 0, db = 0
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - mb); da += (ra[i] - ma) ** 2; db += (rb[i] - mb) ** 2 }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0
}
/** Part des voisins que le préréglage bat (Max DD : moins profond ; égalités comptées pour moitié). */
function rankOf(preset: number, xs: number[]): number {
  let below = 0
  for (const x of xs) below += x < preset ? 1 : x === preset ? 0.5 : 0
  return below / xs.length
}

// ---------------------------------------------------------------- calcul
const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }

async function runAll(jobs: Job[], workers: number): Promise<Map<string, Res>> {
  const out = new Map<string, Res>()
  const t0 = Date.now()
  let next = 0
  return new Promise((resolve, reject) => {
    for (let k = 0; k < Math.min(workers, jobs.length); k++) {
      const wk = new Worker(fileURLToPath(import.meta.url), { execArgv: ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'], argv: ARGV })
      wk.on('error', reject)
      wk.on('message', (msg: Res | { ready: true }) => {
        if ('key' in msg) {
          out.set(msg.key, msg)
          if (out.size % 50 === 0 || out.size === jobs.length) {
            const s = (Date.now() - t0) / 1000
            process.stderr.write(`  ${out.size}/${jobs.length} simulations · ${s.toFixed(0)} s · reste ≈ ${((s / out.size) * (jobs.length - out.size)).toFixed(0)} s\n`)
          }
          if (out.size === jobs.length) resolve(out)
        }
        if (next < jobs.length) wk.postMessage(jobs[next++])
        else void wk.terminate()
      })
    }
  })
}

async function main() {
  const N = Number(opt('n', '300'))
  const NEXT = Number(opt('n-ext', '100'))
  const SEED = Number(opt('seed', '7'))
  const WORKERS = Number(opt('workers', String(Math.min(4, cpus().length))))
  const LEVELS = [0.05, 0.1, 0.2]
  const STEPS = [-0.2, -0.15, -0.1, -0.05, 0, 0.05, 0.1, 0.15, 0.2]
  const OAT = [-0.2, -0.1, -0.05, 0.05, 0.1, 0.2]
  const presetKnobs = KNOBS.filter(k => k.family === 'preset')
  const extKnobs = KNOBS.filter(k => k.family !== 'inactive')
  const find = (reg: 0 | 1, key: keyof ShockParams) => KNOBS.find(k => k.reg === reg && k.key === key && k.family !== 'inactive')!
  const PAIRS: [Knob, Knob][] = [
    [find(0, 'kMain'), find(0, 'atrStopMult')],
    [find(0, 'volWin'), find(0, 'kMain')],
    [find(1, 'kMain'), find(1, 'atrStopMult')],
    [find(1, 'atrStopMult'), find(1, 'atrTrailMult')],
    [find(1, 'volWin'), find(1, 'kMain')],
    [find(0, 'kMain'), find(1, 'kMain')],
  ]

  // Toutes les configurations ; une simulation par jeu de réglages distinct.
  const jobs = new Map<string, Job>()
  const add = (deltas: Map<Knob, number>, curve = false): string => {
    const sets = setsWith(deltas)
    const key = JSON.stringify(sets)
    const j = jobs.get(key)
    if (j) j.curve ||= curve
    else jobs.set(key, { key, sets, curve })
    return key
  }
  const presetKey = add(new Map(), true)
  const rand = rng(SEED)
  interface Sample { level: number; family: 'preset' | 'étendue'; d: number[]; key: string }
  const samples: Sample[] = []
  for (const [family, knobs, n] of [['preset', presetKnobs, N], ['étendue', extKnobs, NEXT]] as const) {
    for (const L of LEVELS) for (let s = 0; s < n; s++) {
      const d = knobs.map(() => L * (2 * rand() - 1))
      samples.push({ level: L, family, d, key: add(new Map(knobs.map((k, i) => [k, d[i]])), family === 'preset') })
    }
  }
  const oat = KNOBS.map(k => OAT.map(d => add(new Map([[k, d]]))))
  const maps = PAIRS.map(([a, b]) => STEPS.map(dy => STEPS.map(dx => add(new Map([[a, dx], [b, dy]])))))

  const S = setup()
  const { bars, wins, dayEnd } = S
  process.stderr.write(`${jobs.size} simulations distinctes, ${WORKERS} workers\n`)
  const res = await runAll([...jobs.values()], WORKERS)
  const P = res.get(presetKey)!
  const get = (key: string) => res.get(key)!.w

  // Achat conservé par sous-période.
  const bh = wins.map(([a, b]) => {
    let pk = -Infinity, dd = 0
    for (let i = a; i <= b; i++) { pk = Math.max(pk, bars.c[i]); dd = Math.min(dd, bars.c[i] / pk - 1) }
    const ret = bars.c[b] / bars.c[a - 1] - 1
    const yrs = (bars.t[b] - bars.t[a]) / (365.25 * 864e5)
    return { ret, cagr: Math.pow(1 + ret, 1 / yrs) - 1, dd }
  })

  // ---------------------------------------------------------------- distributions
  const QS = [0.1, 0.25, 0.5, 0.75, 0.9]
  const finite = (x: number) => (Number.isFinite(x) ? x : x > 0 ? 99 : -99)
  interface Dist { level: number; family: string; win: number; n: number; q: Record<string, number[]>; preset: Record<string, number>; rank: Record<string, number>; profitable: number; beatBh: number; pfAbove1: number; keepSharpe80: number }
  const dists: Dist[] = []
  for (const family of ['preset', 'étendue'] as const) for (const L of LEVELS) {
    const ws = samples.filter(s => s.family === family && s.level === L).map(s => get(s.key))
    for (let w = 0; w < wins.length; w++) {
      const q: Record<string, number[]> = {}, preset: Record<string, number> = {}, rank: Record<string, number> = {}
      MET.forEach((name, j) => {
        const xs = ws.map(x => finite(x[w][j]))
        q[name] = QS.map(p => quantile(xs, p))
        preset[name] = finite(P.w[w][j])
        rank[name] = rankOf(preset[name], xs)
      })
      const n = ws.length
      dists.push({
        level: L, family, win: w, n, q, preset, rank,
        profitable: ws.filter(x => x[w][0] > 0).length / n,
        beatBh: ws.filter(x => x[w][0] > bh[w].ret).length / n,
        pfAbove1: ws.filter(x => x[w][4] > 1).length / n,
        keepSharpe80: ws.filter(x => x[w][2] >= 0.8 * P.w[w][2]).length / n,
      })
    }
  }
  const D = (family: string, L: number, w: number) => dists.find(d => d.family === family && d.level === L && d.win === w)!

  // Sensibilité : corrélation de rang entre l'écart de chaque réglage et le Sharpe sur toute la période (±20 %).
  const s20 = samples.filter(s => s.family === 'preset' && s.level === 0.2)
  const sens = presetKnobs.map((k, i) => ({
    knob: knobName(k),
    sharpe: spearman(s20.map(s => s.d[i]), s20.map(s => get(s.key)[0][2])),
    cagr: spearman(s20.map(s => s.d[i]), s20.map(s => get(s.key)[0][1])),
    dd: spearman(s20.map(s => s.d[i]), s20.map(s => get(s.key)[0][5])),
  })).sort((a, b) => Math.abs(b.sharpe) - Math.abs(a.sharpe))

  // Un réglage à la fois.
  const same = (a: Pack[], b: Pack[]) => a.every((x, w) => x.every((v, j) => v === b[w][j] || (Number.isNaN(v) && Number.isNaN(b[w][j]))))
  const oatRows = KNOBS.map((k, i) => {
    const runs = oat[i].map(get)
    return { knob: knobName(k), family: k.family, why: k.why ?? null, values: OAT.map(d => +show(moved(k, d))), sharpe: runs.map(r => r[0][2]), w: runs, noEffect: runs.every(r => same(r, P.w)) }
  })

  // Cartes : métriques sur toute la période et Sharpe par sous-période.
  const mapOut = PAIRS.map(([a, b], p) => {
    const cells = maps[p].map(row => row.map(get))
    const sh = cells.map(row => row.map(c => c[0][2]))
    const flat = sh.flat()
    const center = sh[4][4]
    return {
      x: knobName(a), y: knobName(b), xs: STEPS.map(d => +show(moved(a, d))), ys: STEPS.map(d => +show(moved(b, d))), steps: STEPS,
      metrics: Object.fromEntries(MET.map((name, j) => [name, cells.map(row => row.map(c => finite(c[0][j])))])),
      /** Toutes les métriques de chaque case : [ligne][colonne][sous-période][métrique]. */
      cells,
      within90: flat.filter(x => x >= 0.9 * center).length / flat.length,
      centerRank: rankOf(center, flat.filter((_, i) => i !== 40)),
      inner: (() => { const xs: number[] = []; for (let i = 2; i <= 6; i++) for (let j = 2; j <= 6; j++) if (i !== 4 || j !== 4) xs.push(sh[i][j]); return { median: quantile(xs, 0.5), min: Math.min(...xs) } })(),
    }
  })

  // Faisceau des courbes des voisins (famille du préréglage), une valeur par semaine.
  const weekly = dayEnd.map((_, k) => k).filter(k => k % 7 === 0 || k === dayEnd.length - 1)
  const fan = LEVELS.map(L => {
    const curves = samples.filter(s => s.family === 'preset' && s.level === L).map(s => res.get(s.key)!.eq!)
    return { level: L, bands: QS.map(q => weekly.map(k => quantile(curves.map(c => c[k]), q))) }
  })
  const presetCurve = weekly.map(k => P.eq![k])
  const bhCurve = weekly.map(k => bars.c[dayEnd[k]] / bars.c[wins[0][0] - 1])

  // ---------------------------------------------------------------- rapport
  const L = (x: number) => `±${Math.round(x * 100)} %`
  const fmt: Record<string, (x: number) => string> = {
    ret: x => pct(x, 0), cagr: x => pct(x), sharpe: x => num(x), sortino: x => num(x), pf: x => num(x), dd: x => pct(x), trades: x => x.toFixed(0),
  }
  const label: Record<string, string> = { ret: 'Rendement', cagr: 'CAGR', sharpe: 'Sharpe', sortino: 'Sortino', pf: 'Profit factor', dd: 'Max DD', trades: 'Trades' }
  const lines: string[] = []
  const table = (head: string[], rows: string[][]) => {
    lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`)
    for (const r of rows) lines.push(`| ${r.join(' | ')} |`)
    lines.push('')
  }
  const firstDay = new Date(bars.t[wins[0][0]]).toISOString().slice(0, 10)
  const lastDay = new Date(bars.t[bars.n - 1]).toISOString().slice(0, 10)

  lines.push(
    '# Robustesse locale du préréglage · Shock Engine 15 min',
    '',
    `${AC.label} 15 min, ${firstDay} → ${lastDay}, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par \`node research/shock/robustness-local.ts${ASSET === 'btc' ? '' : ` --asset ${ASSET}`} --n ${N} --n-ext ${NEXT} --seed ${SEED}\` (${jobs.size} simulations).`,
    '',
    '**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n\'est retenue ni proposée, même quand elle fait mieux.',
    '',
    ASSET === 'btc' ? '**Limite à garder en tête** : le préréglage a été choisi sur tout 2017–2026. Ce test dit si ce choix est un point stable ou un réglage chanceux au milieu de voisins médiocres ; il ne remplace pas le walk-forward (rien ici n\'est hors échantillon).' : `**Le préréglage a été choisi sur BTC, jamais sur cet actif** : ce test dit si, transposé tel quel, il tombe sur un plateau de ${AC.label.split(' ')[0]} ou sur un pic isolé.`,
    '',
    '## En bref',
    '',
  )
  for (const lv of LEVELS) {
    const d = D('preset', lv, 0)
    lines.push(`- **${L(lv)}** : Sharpe médian des voisins ${num(d.q.sharpe[2])} (préréglage ${num(d.preset.sharpe)}, P10–P90 ${num(d.q.sharpe[0])}–${num(d.q.sharpe[4])}) ; le préréglage fait mieux que ${pct(d.rank.sharpe, 0)} des voisins ; ${pct(d.keepSharpe80, 0)} des voisins gardent au moins 80 % de son Sharpe ; ${pct(d.profitable, 0)} sont rentables, ${pct(d.beatBh, 0)} battent l'achat conservé.`)
  }
  lines.push('')

  lines.push('## Ce qui est perturbé', '', `Réglages fixés par le préréglage et utilisés par le moteur : ${presetKnobs.length}, tous perturbés en même temps. Famille étendue : ${extKnobs.length - presetKnobs.length} réglages du script en plus, que le préréglage laisse à leur valeur par défaut mais qui agissent.`, '')
  table(['régime', 'réglage', 'valeur', 'perturbation', 'à ±20 %', 'famille'], KNOBS.filter(k => k.family !== 'inactive').map(k => [
    REG[k.reg], `\`${k.key}\``, show(valueOf(k)), k.kind === 'z' ? `additive : ± L × ${show(Math.max(Math.abs(valueOf(k)), 1))}` : k.kind === 'int' ? 'relative, arrondie' : 'relative',
    `${show(moved(k, -0.2))} → ${show(moved(k, 0.2))}`, k.family === 'preset' ? 'préréglage' : 'étendue',
  ]))
  const quiet = oatRows.filter(r => r.family === 'preset' && NOTES[r.knob])
  lines.push('Trois réglages du régime agité, bien que fixés par le préréglage, n\'agissent pas ou presque dans la zone testée. Ils restent perturbés (comme tous les autres), mais leurs écarts ne changent rien :', '')
  table(['réglage', 'effet mesuré à ±20 %', 'pourquoi'], quiet.map(r => [r.knob, r.noEffect ? 'aucune bougie ne change' : `seulement à ${show(r.values[0])} (Sharpe ${num(r.sharpe[0])})`, NOTES[r.knob]]))
  lines.push('Réglages du préréglage **sans effet**, donc non perturbés (vérifié : à ±5, ±10 et ±20 %, aucune bougie ne change) :', '')
  table(['régime', 'réglage', 'valeur', 'pourquoi', 'vérifié sans effet'], KNOBS.filter(k => k.family === 'inactive').map(k => [REG[k.reg], `\`${k.key}\``, show(valueOf(k)), k.why!, oatRows[KNOBS.indexOf(k)].noEffect ? 'oui' : '**non**']))
  lines.push('Restent fixes aussi les choix de structure : sens autorisés, TP1 et micro-chocs activés ou non, mode High Activity, filtre 60 min, sortie sur signal inverse.', '')

  lines.push(`## Voisins aléatoires · ${FULL}`, '', 'Rang : part des voisins que le préréglage bat (Max DD : moins profond). Autour de 50 % : le préréglage est au milieu de ses voisins (plateau) ; proche de 100 % : il est au sommet d\'un pic.', '')
  for (const lv of LEVELS) {
    const d = D('preset', lv, 0)
    lines.push(`### ${L(lv)} · ${d.n} voisins`, '')
    table(['', 'préréglage', 'P10', 'P25', 'médiane', 'P75', 'P90', 'rang du préréglage'], MET.map(name => [label[name], fmt[name](d.preset[name]), ...d.q[name].map(fmt[name]), pct(d.rank[name], 0)]))
    lines.push(`Voisins rentables : ${pct(d.profitable, 0)} · profit factor > 1 : ${pct(d.pfAbove1, 0)} · meilleurs que l'achat conservé (${pct(bh[0].ret, 0)}, Max DD ${pct(bh[0].dd)}) : ${pct(d.beatBh, 0)} · Sharpe ≥ 80 % de celui du préréglage : ${pct(d.keepSharpe80, 0)}.`, '')
  }

  lines.push('### Famille étendue (réglages du script en plus)', '')
  table(['niveau', 'voisins', 'Sharpe préréglage', 'Sharpe P10 · méd. · P90', 'CAGR P10 · méd. · P90', 'Max DD P10 · méd. · P90', 'rentables', 'rang Sharpe'], LEVELS.map(lv => {
    const d = D('étendue', lv, 0)
    return [L(lv), String(d.n), num(d.preset.sharpe), d.q.sharpe.filter((_, i) => i % 2 === 0).map(x => num(x)).join(' · '), d.q.cagr.filter((_, i) => i % 2 === 0).map(x => pct(x)).join(' · '), d.q.dd.filter((_, i) => i % 2 === 0).map(x => pct(x)).join(' · '), pct(d.profitable, 0), pct(d.rank.sharpe, 0)]
  }))

  lines.push('## Par sous-période', '', 'Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.', '')
  table(['période', 'niveau', 'Sharpe préréglage', 'Sharpe P10 · P25 · méd. · P75 · P90', 'rendement préréglage', 'rendement méd. (P10–P90)', 'achat conservé', 'voisins rentables', 'battent l\'achat conservé', 'rang Sharpe'],
    wins.slice(1).flatMap((_, k) => LEVELS.map(lv => {
      const w = k + 1, d = D('preset', lv, w)
      return [SPLITS[w][0], L(lv), num(d.preset.sharpe), d.q.sharpe.map(x => num(x)).join(' · '), pct(d.preset.ret), `${pct(d.q.ret[2])} (${pct(d.q.ret[0])} – ${pct(d.q.ret[4])})`, pct(bh[w].ret), pct(d.profitable, 0), pct(d.beatBh, 0), pct(d.rank.sharpe, 0)]
    })))
  table(['période', 'Max DD préréglage', 'Max DD méd. ±10 % (P10)', 'PF préréglage', 'PF méd. ±10 % (P10)', 'trades préréglage', 'trades méd. ±10 %'], wins.map((_, w) => {
    const d = D('preset', 0.1, w)
    return [SPLITS[w][0], pct(d.preset.dd), `${pct(d.q.dd[2])} (${pct(d.q.dd[0])})`, num(d.preset.pf), `${num(d.q.pf[2])} (${num(d.q.pf[0])})`, d.preset.trades.toFixed(0), d.q.trades[2].toFixed(0)]
  }))

  lines.push(`## Un réglage à la fois · Sharpe ${FULL}`, '', `Les autres réglages restent ceux du préréglage (Sharpe ${num(P.w[0][2])}).`, '')
  table(['régime · réglage', ...OAT.map(d => `${d > 0 ? '+' : '−'}${Math.abs(d * 100)} %`), 'pire écart'], oatRows.filter(r => r.family !== 'inactive').map(r => {
    const worst = Math.min(...r.sharpe) - P.w[0][2]
    return [r.knob, ...r.sharpe.map((s, i) => `${num(s)} (${show(r.values[i])})`), r.noEffect ? 'aucun effet' : num(worst)]
  }))

  lines.push('## Quels réglages comptent · voisins à ±20 %', '', 'Corrélation de rang (Spearman) entre l\'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.', '')
  table(['régime · réglage', 'Sharpe', 'CAGR', 'Max DD'], sens.map(s => [s.knob, num(s.sharpe), num(s.cagr), num(s.dd)]))

  lines.push(`## Cartes · Sharpe ${FULL}`, '', 'Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.', '')
  for (const mp of mapOut) {
    lines.push(`### ${mp.y} (lignes) × ${mp.x} (colonnes)`, '')
    lines.push(`Cases à au moins 90 % du Sharpe du préréglage : ${pct(mp.within90, 0)} · le préréglage bat ${pct(mp.centerRank, 0)} des autres cases · anneau ±10 % : médiane ${num(mp.inner.median)}, minimum ${num(mp.inner.min)}.`, '')
    table([`${mp.y.split(' · ')[1]} \\ ${mp.x.split(' · ')[1]}`, ...mp.xs.map(show)], mp.metrics.sharpe.map((row, i) => [show(mp.ys[i]), ...row.map((v, j) => (i === 4 && j === 4 ? `[${num(v)}]` : num(v)))]))
  }

  lines.push(
    '## Méthode',
    '',
    '- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.',
    '- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.',
    '- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n\'y a aucune perte.',
    `- Tirages reproductibles (graine ${SEED}). Données complètes (chaque configuration, chaque sous-période) dans \`shock-15m-robustness-local${SUFFIX}.json\`.`,
    '',
  )

  const base = `research/reports/shock-15m-robustness-local${SUFFIX}`
  writeFileSync(`${base}.md`, lines.join('\n'))
  const clean = (x: unknown): unknown => JSON.parse(JSON.stringify(x, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)))
  writeFileSync(`${base}.json`, JSON.stringify(clean({
    period: [firstDay, lastDay], costs: COSTS, seed: SEED, levels: LEVELS, splits: SPLITS.map(s => s[0]), metrics: MET,
    knobs: KNOBS.map(k => ({ name: knobName(k), reg: REG[k.reg], key: k.key, value: valueOf(k), kind: k.kind, family: k.family, why: k.why ?? NOTES[knobName(k)] ?? null })),
    preset: P.w, buyHold: bh, dists, sensitivity: sens, oneAtATime: { steps: OAT, rows: oatRows }, maps: mapOut,
    fan: { t: weekly.map(k => bars.t[dayEnd[k]]), preset: presetCurve, buyHold: bhCurve, levels: fan },
    samples: samples.map(s => ({ family: s.family, level: s.level, d: s.d.map(x => Math.round(x * 1e4) / 1e4), w: get(s.key) })),
  })))
  process.stderr.write(`écrit ${base}.md et ${base}.json\n`)
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) main()
