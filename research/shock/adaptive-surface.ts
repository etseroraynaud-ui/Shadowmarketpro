// Surface adaptative continue du Shock Engine 15 min : walk-forward imbriqué et ablation M0 → M4.
//
//   node research/shock/adaptive-surface.ts [--workers 4] [--robust 100] [--seed 11]
//
// But : tester si des réglages qui varient continûment avec l'état de volatilité généralisent
// mieux hors échantillon que la bascule calme / agité actuelle, sans toucher à la logique
// d'entrée et sans chercher le meilleur backtest. Le critère est le walk-forward hors
// échantillon ; tout ce qui est calibré ne voit que le passé.
//
// Modèles (même moteur, mêmes données, mêmes frais, même exécution) :
//   M0      préréglage actuel, figé (référence ; choisi sur tout 2017-2026)
//   M0wf    même architecture (2 régimes durs à la médiane du percentile 12 mois), les 4 réglages
//           adaptatifs recalibrés à chaque fenêtre par la procédure ci-dessous
//   Mglob   les 4 réglages adaptatifs constants (un seul jeu global), base comme M0
//   M1      percentile de volatilité (horizon 6 / 12 / 18 mois choisi en validation interne),
//           3 experts bas / moyen / haut, affectation dure (tiers)
//   M2      M1 avec poids continus (noyaux gaussiens) pour θ et pour les réglages de base
//   M2a     M1 avec poids continus pour θ seulement (base calme / agitée à la médiane)
//   M3      M2 + instabilité de la volatilité (inclinaison de θ selon son rang)
//   M4      M3 + tendance ↔ range (inclinaison de θ selon son rang)
//
// Procédure de calibration d'une fenêtre (constantes fixées a priori, jamais optimisées) :
// 1. Grille de 630 points sur les 4 réglages adaptatifs (s, stop, suiveur, rangeWin). Chaque
//    point est simulé une fois sur tout l'historique, base calme / agitée selon le percentile ;
//    chaque trade est rattaché à la cellule d'état de sa bougie d'entrée (tiers du percentile,
//    côté de la médiane, moitiés des variables secondaires), avec ses rendements journaliers.
// 2. Score robuste d'un point dans une cellule, sur la fenêtre de calibration : médiane des
//    Sharpe semestriels − 0,5 × écart interquartile − 2 × |Max DD| ; moins de 20 trades : exclu.
// 3. Plateau : moyenne des scores du point et de ses voisins (±1 cran) − 0,5 × leur écart type.
//    Réglage retenu : centre pondéré des 5 % meilleurs plateaux (jamais l'argmax).
// 4. Rétrécissement vers le réglage global (même procédure, toutes cellules) :
//    θ = α θ_cellule + (1 − α) θ_global, α = n / (n + 100), n = trades de la cellule.
// 5. Trois experts : la courbure bas / moyen / haut est divisée par deux.
// 6. Variables secondaires : inclinaison = θ(moitié haute) − θ(moitié basse), chacune rétrécie.
// Walk-forward imbriqué : calibration 36 mois, test 3 mois, pas 3 mois, de 2020-01-01 à la fin.
// L'horizon du percentile est choisi sur les 12 derniers mois de la calibration (surface
// construite sur les 24 mois précédents, critère Sharpe − 2 × |Max DD|) ; puis la surface est
// reconstruite sur les 36 mois et figée pour le test. Pendant le test, l'état, les poids et
// θ(t) évoluent chaque jour avec les seules données disponibles.

import { Worker, isMainThread, parentPort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { cpus } from 'node:os'
import { loadBtc } from '../lib/data.ts'
import { metricsOf, pct, num } from '../lib/stats.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { sliceMarket } from '../../lib/strategies/shock/market.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import {
  DIMS, GRID, BASE_NUM, barDay, baseFrom, dayState, indexOf, paramsAt, presetTheta, quantize, valueAt,
} from '../lib/surface.ts'
import type { Base, DayState, SurfaceSpec } from '../lib/surface.ts'

const COSTS: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: 1, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
const HS = [183, 365, 548]
const H_LABEL: Record<number, string> = { 183: '6 mois', 365: '12 mois', 548: '18 mois' }
const WARM = 30 * 96
const TAIL = 30 * 96
const DAY = 864e5
const OOS_FROM = '2020-01-01'
// Constantes de la procédure (a priori).
const K_IQR = 0.5
const K_DD = 2
const MIN_TRADES = 20
const TOP = 0.05
const N0 = 100

// ---------------------------------------------------------------- données communes
function setup() {
  const all = loadBtc(15)
  const bars = sliceBars(all, Date.parse('2016-01-01'), all.t[all.n - 1])
  const daily = resample(loadBtc(60), DAY)
  const m = marketFor(bars, 15, 1)
  const preset = adaptivePreset(15, 1)
  const base = baseFrom(preset.sets[0], preset.sets[1])
  const bday = barDay(bars, 15, daily)
  const states = new Map<number, DayState>(HS.map(H => [H, dayState(daily, H)]))
  const idxAt = (t: number) => { let lo = 0, hi = bars.n; while (lo < hi) { const md = (lo + hi) >> 1; if (bars.t[md] < t) lo = md + 1; else hi = md } return lo }
  const lo = idxAt(Date.parse('2017-01-01'))
  const end = bars.n - 1
  const day0 = Math.floor(bars.t[lo] / DAY)
  const calDay = (i: number) => Math.floor(bars.t[i] / DAY) - day0
  return { bars, daily, m, preset, base, bday, states, idxAt, lo, end, day0, calDay }
}
type Setup = ReturnType<typeof setup>

/** Côté de la médiane (0 calme, 1 agité) de chaque bougie ; -1 sans état. */
function sideSelect(S: Setup, H: number): Int8Array {
  const st = S.states.get(H)!
  const out = new Int8Array(S.bars.n).fill(-1)
  for (let i = 0; i < S.bars.n; i++) {
    const d = S.bday[i]
    if (d >= 0 && Number.isFinite(st.p[d])) out[i] = st.p[d] > 0.5 ? 1 : 0
  }
  return out
}

// ---------------------------------------------------------------- travaux des workers
interface CandJob { kind: 'cand'; id: number; theta: number[] }
interface CandRes { kind: 'cand'; id: number; byH: { entry: Int32Array; off: Int32Array; day: Int32Array; lr: Float32Array; lost: number }[] }
interface Segment { a: number; b: number; spec: SurfaceSpec | null; H: number }
interface RunJob { kind: 'run'; key: string; segs: Segment[]; base: Base | null; curve: boolean; from: number; to: number; windows: number[] }
interface RunRes {
  kind: 'run'; key: string
  total: number[]; years: { y: number; m: number[] }[]; winRet: number[]
  dayT: Float64Array | null; dayEq: Float32Array | null; sets: number; tailOpen: number
}
// Métriques gardées : rendement, CAGR, Sharpe, Sortino, PF, Max DD, trades, exposition.
const PACK = (x: ReturnType<typeof metricsOf>) => [x.totalReturn, x.cagr, x.sharpe, x.sortino, x.profitFactor, x.maxDrawdown, x.trades, x.exposure]

/** Simulation d'un point de grille : trades et rendements journaliers rattachés à chaque trade. */
function runCand(S: Setup, job: CandJob, selects: Map<number, Int8Array>): CandRes {
  const spec: SurfaceSpec = { experts: [job.theta], soft: false, softBase: false, tilts: [] }
  const sets = [0, 1].map(side => paramsAt(spec, S.base, { p: side ? 0.75 : 0.25, side: side as 0 | 1, hard: side ? 2 : 0, qVov: 0.5, qTc: 0.5 }))
  const byH = HS.map(H => {
    const r = simulate(S.m, sets, COSTS, S.lo, S.end, selects.get(H)!)
    const P = r.positions
    const entry = Int32Array.from(P, q => q.entryIdx)
    const off: number[] = [0]
    const day: number[] = []
    const lr: number[] = []
    let k = 0, lost = 0
    let cur = -1, curDay = -1, acc = 0
    const flush = () => { if (cur >= 0 && curDay >= 0) { day.push(curDay); lr.push(acc) } }
    for (let i = S.lo + 1; i <= S.end; i++) {
      const x = Math.log(r.equity[i] / r.equity[i - 1])
      if (x === 0) continue
      while (k < P.length && P[k].exitIdx < i) k++
      if (!(k < P.length && P[k].entryIdx <= i)) { lost++; continue }
      const d = S.calDay(i)
      if (k !== cur) {
        flush()
        while (off.length <= k) off.push(day.length)
        cur = k; curDay = d; acc = 0
      } else if (d !== curDay) { flush(); curDay = d; acc = 0 }
      acc += x
    }
    flush()
    while (off.length <= P.length) off.push(day.length)
    return { entry, off: Int32Array.from(off), day: Int32Array.from(day), lr: Float32Array.from(lr), lost }
  })
  return { kind: 'cand', id: job.id, byH }
}

/** Jeux et select d'un segment : un jeu par état quantifié rencontré (au plus un par jour). */
function segmentSets(S: Setup, seg: Segment, a: number, wa: number, n: number, base: Base) {
  const select = new Int8Array(n).fill(-1)
  if (!seg.spec) {
    const st = S.states.get(seg.H)!
    for (let i = a; i <= seg.b; i++) {
      const d = S.bday[i]
      if (d >= 0 && Number.isFinite(st.p[d])) select[i - wa] = st.p[d] > 0.5 ? 1 : 0
    }
    return { sets: [base.calm, base.agit], select }
  }
  const st = S.states.get(seg.H)!
  const sets: ShockParams[] = []
  const keyOf = new Map<string, number>()
  const dayOf = new Map<number, number>()
  for (let i = a; i <= seg.b; i++) {
    const d = S.bday[i]
    if (d < 0 || !Number.isFinite(st.p[d])) continue
    let k = dayOf.get(d)
    if (k === undefined) {
      const params = paramsAt(seg.spec, base, quantize(st.p[d], st.qVov[d], st.qTc[d]))
      const key = JSON.stringify(params)
      k = keyOf.get(key)
      if (k === undefined) { k = sets.length; sets.push(params); keyOf.set(key, k) }
      dayOf.set(d, k)
    }
    select[i - wa] = k
  }
  if (sets.length > 127) throw new Error(`trop de jeux dans un segment : ${sets.length}`)
  return { sets, select }
}

/** Segments consécutifs, chacun avec sa surface figée ; une position ouverte finit avec ses réglages. */
function runStitched(S: Setup, job: RunJob): RunRes {
  const base = job.base ?? S.base
  const n = S.bars.n
  const eq = new Float64Array(n).fill(COSTS.capital)
  const position = new Int8Array(n)
  const positions: PositionRecord[] = []
  let carry = -1, nsets = 0, tailOpen = 0
  let covEnd = job.from - 1
  for (const seg of job.segs) {
    const a = Math.max(seg.a, carry + 1)
    if (a > seg.b) continue
    const wa = Math.max(0, a - WARM)
    const wb = Math.min(n - 1, seg.b + TAIL)
    const sm = sliceMarket(S.m, wa, wb)
    const { sets, select } = segmentSets(S, seg, a, wa, sm.bars.n, base)
    nsets = Math.max(nsets, sets.length)
    const r = simulate(sm, sets, COSTS, a - wa, wb - wa, select)
    const last = r.positions[r.positions.length - 1]
    let endCov = seg.b
    if (last && last.exitIdx + wa > seg.b) {
      endCov = last.exitIdx + wa
      if (last.exits.includes('END')) tailOpen++
    }
    const scale = eq[a - 1] / COSTS.capital
    for (let i = a; i <= endCov; i++) {
      const prev = i === a ? COSTS.capital : r.equity[i - wa - 1]
      eq[i] = eq[i - 1] * (r.equity[i - wa] / prev)
      position[i] = r.position[i - wa]
    }
    for (const q of r.positions) {
      positions.push({ ...q, entryIdx: q.entryIdx + wa, exitIdx: q.exitIdx + wa, pnl: q.pnl * scale, fees: q.fees * scale, notional: q.notional * scale, equityAtEntry: q.equityAtEntry * scale, qty: q.qty * scale })
    }
    carry = endCov
    covEnd = endCov
  }
  for (let i = covEnd + 1; i < n; i++) eq[i] = eq[covEnd]
  const fake = { equity: eq, position, positions, fills: [], start: job.from, end: job.to, liquidation: null, entryLong: new Uint8Array(0), entryShort: new Uint8Array(0), prep: null } as unknown as ShockResult
  const total = PACK(metricsOf(S.bars, fake, job.from, job.to))
  const years: { y: number; m: number[] }[] = []
  for (let y = new Date(S.bars.t[job.from]).getUTCFullYear(); y <= new Date(S.bars.t[job.to]).getUTCFullYear(); y++) {
    const a = Math.max(job.from, S.idxAt(Date.UTC(y, 0, 1)))
    const b = Math.min(job.to, S.idxAt(Date.UTC(y + 1, 0, 1)) - 1)
    if (b - a > 96 * 20) years.push({ y, m: PACK(metricsOf(S.bars, fake, a, b)) })
  }
  const winRet: number[] = []
  for (let k = 0; k < job.windows.length; k++) {
    const a = job.windows[k]
    const b = k + 1 < job.windows.length ? job.windows[k + 1] - 1 : job.to
    winRet.push(eq[b] / (a > 0 ? eq[a - 1] : COSTS.capital) - 1)
  }
  let dayT: Float64Array | null = null, dayEq: Float32Array | null = null
  if (job.curve) {
    const ends: number[] = []
    for (let i = job.from; i <= job.to; i++) if (i === job.to || Math.floor(S.bars.t[i + 1] / DAY) !== Math.floor(S.bars.t[i] / DAY)) ends.push(i)
    dayT = Float64Array.from(ends, i => S.bars.t[i])
    dayEq = Float32Array.from(ends, i => eq[i] / eq[job.from - 1])
  }
  return { kind: 'run', key: job.key, total, years, winRet, dayT, dayEq, sets: nsets, tailOpen }
}

if (!isMainThread) {
  const S = setup()
  const selects = new Map(HS.map(H => [H, sideSelect(S, H)]))
  parentPort!.on('message', (job: CandJob | RunJob) => {
    if (job.kind === 'cand') {
      const res = runCand(S, job, selects)
      parentPort!.postMessage(res, res.byH.flatMap(x => [x.entry.buffer, x.off.buffer, x.day.buffer, x.lr.buffer]) as ArrayBuffer[])
    } else {
      const res = runStitched(S, job)
      parentPort!.postMessage(res, (res.dayEq ? [res.dayEq.buffer, res.dayT!.buffer] : []) as ArrayBuffer[])
    }
  })
  parentPort!.postMessage({ ready: true })
}

// ---------------------------------------------------------------- pool de workers
class Pool {
  private workers: Worker[] = []
  private idle: Worker[] = []
  private queue: { job: unknown; resolve: (x: unknown) => void }[] = []
  private ready: Promise<void>
  private busy = new Map<Worker, (x: unknown) => void>()
  constructor(n: number) {
    let pending = n
    let done!: () => void
    this.ready = new Promise(r => { done = r })
    for (let k = 0; k < n; k++) {
      const w = new Worker(fileURLToPath(import.meta.url), { execArgv: ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'] })
      w.on('error', e => { throw e })
      w.on('message', msg => {
        if (msg && msg.ready) { this.idle.push(w); if (--pending === 0) done(); this.pump(); return }
        const res = this.busy.get(w)!
        this.busy.delete(w)
        this.idle.push(w)
        res(msg)
        this.pump()
      })
      this.workers.push(w)
    }
  }
  private pump() {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!
      const { job, resolve } = this.queue.shift()!
      this.busy.set(w, resolve)
      w.postMessage(job)
    }
  }
  run<T>(job: unknown): Promise<T> {
    return new Promise(resolve => { this.queue.push({ job, resolve: resolve as (x: unknown) => void }); void this.ready.then(() => this.pump()) })
  }
  async all<T>(jobs: unknown[], label: string): Promise<T[]> {
    const t0 = Date.now()
    let done = 0
    return Promise.all(jobs.map(j => this.run<T>(j).then(r => {
      done++
      if (done % Math.max(1, Math.round(jobs.length / 10)) === 0 || done === jobs.length) process.stderr.write(`  ${label} : ${done}/${jobs.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`)
      return r
    })))
  }
  close() { for (const w of this.workers) void w.terminate() }
}

// ---------------------------------------------------------------- statistiques
function quantile(xs: number[], q: number): number {
  const s = xs.filter(x => Number.isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return NaN
  const p = (s.length - 1) * q, i = Math.floor(p), f = p - i
  return i + 1 < s.length ? s[i] + f * (s[i + 1] - s[i]) : s[i]
}
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length
const sd = (xs: number[]) => { const m = mean(xs); return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length) }

/** Sharpe et Max DD d'une suite de capitaux journaliers. */
function dailyStats(eq: ArrayLike<number>, a: number, b: number) {
  const r: number[] = []
  let pk = eq[a], dd = 0
  for (let i = a + 1; i <= b; i++) { r.push(eq[i] / eq[i - 1] - 1); pk = Math.max(pk, eq[i]); dd = Math.min(dd, eq[i] / pk - 1) }
  const s = sd(r)
  return { sharpe: s > 0 ? (mean(r) / s) * Math.sqrt(365) : 0, dd }
}

// ---------------------------------------------------------------- programme principal
const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }

async function main() {
  const WORKERS = Number(opt('workers', String(Math.min(4, cpus().length))))
  const NROB = Number(opt('robust', '100'))
  const SEED = Number(opt('seed', '11'))
  const t0 = Date.now()
  const S = setup()
  const { bars } = S
  const iso = (i: number) => new Date(bars.t[i]).toISOString().slice(0, 10)
  const addMonths = (t: number, k: number) => { const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()) }
  const dayOfT = (t: number) => Math.floor(t / DAY) - S.day0
  const nDays = dayOfT(bars.t[S.end]) + 1

  // ------------------------------------------------ vérifications de parité
  const checks: string[] = []
  {
    const { select } = selectFor(S.preset, S.m, S.daily)
    const side = sideSelect(S, 365)
    let diff = 0
    for (let i = S.lo; i <= S.end; i++) if (select![i] !== side[i]) diff++
    checks.push(`Percentile 12 mois > 50 % et régime actuel (classify) : ${diff} bougie(s) différente(s) sur ${S.end - S.lo + 1} depuis 2017.`)
    const [calm, agit] = S.preset.sets
    const uni = simulate(S.m, [{ ...calm, useMicroShock: true, kMicro: calm.kMain + 0.2 }, agit], COSTS, S.lo, S.end, select)
    const ref = simulate(S.m, S.preset.sets, COSTS, S.lo, S.end, select)
    let d2 = 0
    for (let i = 0; i < bars.n; i++) if (uni.equity[i] !== ref.equity[i]) d2++
    checks.push(`Seuil de choc unifié (micro-choc actif partout, kMicro = s + 0,2) : ${d2} bougie(s) différente(s) avec le préréglage.`)
  }

  // ------------------------------------------------ fenêtres
  const oos0 = S.idxAt(Date.parse(OOS_FROM))
  const winStarts: number[] = []
  for (let t = Date.parse(OOS_FROM); t <= bars.t[S.end]; t = addMonths(t, 3)) winStarts.push(t)
  const W = winStarts.length
  const winIdx = winStarts.map(t => S.idxAt(t))
  const winEnd = (k: number) => (k + 1 < W ? winIdx[k + 1] - 1 : S.end)
  interface WV { d0: number; d1: number; blocks: [number, number][] }
  const mkWV = (t0w: number, t1w: number): WV => {
    const blocks: [number, number][] = []
    for (let t = t0w; t < t1w; t = addMonths(t, 6)) blocks.push([dayOfT(t), Math.min(dayOfT(addMonths(t, 6)), dayOfT(t1w))])
    return { d0: dayOfT(t0w), d1: dayOfT(t1w), blocks }
  }
  const wvs: WV[] = []
  for (const t of winStarts) { wvs.push(mkWV(addMonths(t, -36), t)); wvs.push(mkWV(addMonths(t, -36), addMonths(t, -12))) }
  const tEnd = bars.t[S.end] + DAY
  const tIS0 = Date.parse('2017-01-01')
  wvs.push(mkWV(tIS0, tEnd)); wvs.push(mkWV(tIS0, addMonths(tEnd, -12)))
  const NWV = wvs.length
  const wvTrain = (k: number) => 2 * k, wvInner = (k: number) => 2 * k + 1
  const IS_TRAIN = 2 * W, IS_INNER = 2 * W + 1

  // ------------------------------------------------ cellules d'état
  // 0 tout · 1-2 côté de la médiane · 3-5 tiers · 6-7 moitiés vol-of-vol · 8-9 moitiés tendance/range
  const NCELL = 10
  const CELL_NAMES = ['tout', 'calme', 'agité', 'bas', 'moyen', 'haut', 'vov bas', 'vov haut', 'range', 'tendance']
  const dayFirstBar = new Int32Array(nDays).fill(-1)
  for (let i = S.lo; i <= S.end; i++) { const d = S.calDay(i); if (dayFirstBar[d] < 0) dayFirstBar[d] = i }
  const cellsOfDay = (H: number, sd: number): number[] => {
    const st = S.states.get(H)!
    if (sd < 0 || !Number.isFinite(st.p[sd])) return []
    const p = st.p[sd]
    const out = [0, p > 0.5 ? 2 : 1, p < 1 / 3 ? 3 : p < 2 / 3 ? 4 : 5]
    if (Number.isFinite(st.qVov[sd])) out.push(st.qVov[sd] < 0.5 ? 6 : 7)
    if (Number.isFinite(st.qTc[sd])) out.push(st.qTc[sd] < 0.5 ? 8 : 9)
    return out
  }
  // Présence : jours où l'état est dans la cellule (préfixes), par horizon.
  const presence = new Map<number, Int32Array[]>()
  for (const H of HS) {
    const pre = Array.from({ length: NCELL }, () => new Int32Array(nDays + 1))
    for (let d = 0; d < nDays; d++) {
      const cs = dayFirstBar[d] >= 0 ? cellsOfDay(H, S.bday[dayFirstBar[d]]) : []
      for (let c = 0; c < NCELL; c++) pre[c][d + 1] = pre[c][d] + (cs.includes(c) ? 1 : 0)
    }
    presence.set(H, pre)
  }

  // ------------------------------------------------ grille
  const shape = DIMS.map(d => GRID[d].length)
  const NC = shape.reduce((a, b) => a * b, 1)
  const coord = (id: number) => { const c: number[] = []; for (let d = DIMS.length - 1; d >= 0; d--) { c[d] = id % shape[d]; id = Math.floor(id / shape[d]) } return c }
  const idOf = (c: number[]) => c.reduce((s, x, d) => s * shape[d] + x, 0)
  const neigh: number[][] = []
  for (let id = 0; id < NC; id++) {
    const c = coord(id)
    const out: number[] = []
    const rec = (d: number, cur: number[]) => {
      if (d === DIMS.length) { out.push(idOf(cur)); return }
      for (const dx of [-1, 0, 1]) { const x = c[d] + dx; if (x >= 0 && x < shape[d]) rec(d + 1, [...cur, x]) }
    }
    rec(0, [])
    neigh.push(out)
  }

  // ------------------------------------------------ phase 1 : points de grille
  const pool = new Pool(WORKERS)
  process.stderr.write(`${NC} points de grille × ${HS.length} horizons, ${W} fenêtres de test, ${WORKERS} workers\n`)
  // Scores robustes et trades : [H][cellule][fenêtre][point].
  const R = new Map(HS.map(H => [H, new Float32Array(NCELL * NWV * NC)]))
  const NT = new Map(HS.map(H => [H, new Float32Array(NCELL * NWV * NC)]))
  const at = (c: number, w: number, id: number) => (c * NWV + w) * NC + id
  let lostTotal = 0
  const scoreCand = (H: number, id: number, x: CandRes['byH'][number]) => {
    lostTotal += x.lost
    const D = Array.from({ length: NCELL }, () => new Float64Array(nDays))
    const E = Array.from({ length: NCELL }, () => new Float64Array(nDays + 1))
    for (let k = 0; k < x.entry.length; k++) {
      const cs = cellsOfDay(H, S.bday[x.entry[k]])
      const de = S.calDay(x.entry[k])
      for (const c of cs) {
        E[c][de + 1] += 1
        for (let j = x.off[k]; j < x.off[k + 1]; j++) D[c][x.day[j]] += x.lr[j]
      }
    }
    const pre = presence.get(H)!
    for (let c = 0; c < NCELL; c++) {
      const d = D[c]
      const s1 = new Float64Array(nDays + 1), s2 = new Float64Array(nDays + 1), e = E[c]
      for (let i = 0; i < nDays; i++) { s1[i + 1] = s1[i] + d[i]; s2[i + 1] = s2[i] + d[i] * d[i]; e[i + 1] += e[i] }
      for (let w = 0; w < NWV; w++) {
        const v = wvs[w]
        const ntr = e[v.d1] - e[v.d0]
        NT.get(H)![at(c, w, id)] = ntr
        if (ntr < MIN_TRADES) { R.get(H)![at(c, w, id)] = NaN; continue }
        const sh: number[] = []
        for (const [b0, b1] of v.blocks) {
          if (pre[c][b1] - pre[c][b0] < 30) continue
          const len = b1 - b0
          const mu = (s1[b1] - s1[b0]) / len
          const va = Math.max((s2[b1] - s2[b0]) / len - mu * mu, 0)
          sh.push(va > 0 ? (mu / Math.sqrt(va)) * Math.sqrt(365) : 0)
        }
        if (sh.length < 2) { R.get(H)![at(c, w, id)] = NaN; continue }
        let cum = 0, pk = 0, mdd = 0
        for (let i = v.d0; i < v.d1; i++) { cum += d[i]; pk = Math.max(pk, cum); mdd = Math.max(mdd, pk - cum) }
        const ddFrac = 1 - Math.exp(-mdd)
        R.get(H)![at(c, w, id)] = quantile(sh, 0.5) - K_IQR * (quantile(sh, 0.75) - quantile(sh, 0.25)) - K_DD * ddFrac
      }
    }
  }
  // Cache des scores (option --cache dossier) : clé = grille, constantes, fenêtres, données.
  const CACHE = opt('cache', '')
  const cacheKey = createHash('sha1').update(JSON.stringify({ GRID, HS, K_IQR, K_DD, MIN_TRADES, wvs, end: bars.t[S.end], n: bars.n, cells: CELL_NAMES })).digest('hex').slice(0, 12)
  const cacheFile = CACHE ? `${CACHE}/adaptive-grid-${cacheKey}.bin` : ''
  if (cacheFile && existsSync(cacheFile)) {
    const buf = readFileSync(cacheFile)
    const f = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4)
    const L = NCELL * NWV * NC
    HS.forEach((H, h) => { R.get(H)!.set(f.subarray(2 * h * L, (2 * h + 1) * L)); NT.get(H)!.set(f.subarray((2 * h + 1) * L, (2 * h + 2) * L)) })
    lostTotal = f[6 * L]
    process.stderr.write(`scores de la grille lus dans ${cacheFile}\n`)
  } else {
    const candJobs: CandJob[] = []
    for (let id = 0; id < NC; id++) candJobs.push({ kind: 'cand', id, theta: coord(id) })
    await Promise.all(candJobs.map(j => pool.run<CandRes>(j).then(res => { res.byH.forEach((x, h) => scoreCand(HS[h], res.id, x)); if (res.id % 63 === 0) process.stderr.write(`  grille : point ${res.id}/${NC} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`) })))
    process.stderr.write(`grille simulée en ${((Date.now() - t0) / 1000).toFixed(0)} s (rendements non rattachés : ${lostTotal})\n`)
    if (cacheFile) {
      const L = NCELL * NWV * NC
      const f = new Float32Array(6 * L + 1)
      HS.forEach((H, h) => { f.set(R.get(H)!, 2 * h * L); f.set(NT.get(H)!, (2 * h + 1) * L) })
      f[6 * L] = lostTotal
      writeFileSync(cacheFile, Buffer.from(f.buffer))
    }
  }

  // ------------------------------------------------ calibration
  interface Fit { theta: number[]; n: number; plateau: number; ok: boolean }
  const fitCell = (H: number, c: number, w: number): Fit => {
    const r = R.get(H)!, nt = NT.get(H)!
    const x = new Float64Array(NC)
    for (let id = 0; id < NC; id++) { const v = r[at(c, w, id)]; x[id] = Number.isFinite(v) ? v : 0 }
    const P = new Float64Array(NC)
    for (let id = 0; id < NC; id++) {
      const vs = neigh[id].map(j => x[j])
      P[id] = mean(vs) - 0.5 * sd(vs)
    }
    const order = Array.from({ length: NC }, (_, i) => i).sort((a, b) => P[b] - P[a])
    const T = order.slice(0, Math.max(8, Math.round(TOP * NC)))
    const pmin = P[T[T.length - 1]]
    const wsum = T.reduce((s, id) => s + (P[id] - pmin + 1e-3), 0)
    let theta = DIMS.map((_, d) => T.reduce((s, id) => s + (P[id] - pmin + 1e-3) * coord(id)[d], 0) / wsum)
    const near = Math.min(...T.map(id => Math.hypot(...coord(id).map((v, d) => v - theta[d]))))
    if (near > 1.5) theta = coord(T[0])
    const n = mean(T.map(id => nt[at(c, w, id)]))
    return { theta, n, plateau: P[T[0]], ok: P[T[0]] > 0 }
  }
  const shrink = (f: Fit, g: Fit) => { const a = f.n / (f.n + N0); return f.theta.map((v, d) => a * v + (1 - a) * g.theta[d]) }
  type ModelName = 'M0wf' | 'Mglob' | 'M1' | 'M2' | 'M2a' | 'M3' | 'M4'
  interface Calib { spec: SurfaceSpec; H: number; fits: Record<string, Fit>; alpha: Record<string, number> }
  const calibrate = (model: ModelName, H: number, w: number): Calib => {
    const g = fitCell(H, 0, w)
    const fits: Record<string, Fit> = { global: g }
    const alpha: Record<string, number> = {}
    if (model === 'Mglob') return { spec: { experts: [g.theta], soft: false, softBase: false, tilts: [] }, H, fits, alpha }
    if (model === 'M0wf') {
      const ex = [1, 2].map(c => { const f = fitCell(H, c, w); fits[CELL_NAMES[c]] = f; alpha[CELL_NAMES[c]] = f.n / (f.n + N0); return shrink(f, g) })
      return { spec: { experts: ex, soft: false, softBase: false, tilts: [] }, H, fits, alpha }
    }
    const ex = [3, 4, 5].map(c => { const f = fitCell(H, c, w); fits[CELL_NAMES[c]] = f; alpha[CELL_NAMES[c]] = f.n / (f.n + N0); return shrink(f, g) })
    for (let d = 0; d < DIMS.length; d++) {
      const curv = ex[0][d] - 2 * ex[1][d] + ex[2][d]
      ex[0][d] -= curv / 12; ex[1][d] += curv / 6; ex[2][d] -= curv / 12
    }
    const spec: SurfaceSpec = { experts: ex, soft: model !== 'M1', softBase: model === 'M2' || model === 'M3' || model === 'M4', tilts: [] }
    const tilt = (feature: 'qVov' | 'qTc', lo: number, hi: number) => {
      const fl = fitCell(H, lo, w), fh = fitCell(H, hi, w)
      fits[CELL_NAMES[lo]] = fl; fits[CELL_NAMES[hi]] = fh
      const tl = shrink(fl, g), th = shrink(fh, g)
      spec.tilts.push({ feature, delta: th.map((v, d) => v - tl[d]) })
    }
    if (model === 'M3' || model === 'M4') tilt('qVov', 6, 7)
    if (model === 'M4') tilt('qTc', 8, 9)
    return { spec, H, fits, alpha }
  }

  // ------------------------------------------------ phase 2 : validation interne (choix de l'horizon)
  const H_MODELS: ModelName[] = ['M1', 'M2', 'M3', 'M4']
  const segsOf = (spec: SurfaceSpec | null, H: number, t0s: number, t1s: number): Segment[] => {
    const out: Segment[] = []
    for (let t = t0s; t < t1s; t = addMonths(t, 3)) out.push({ a: S.idxAt(t), b: Math.min(S.idxAt(Math.min(addMonths(t, 3), t1s)) - 1, S.end), spec, H })
    return out
  }
  const valJobs: RunJob[] = []
  const valKey = (model: string, H: number, k: number) => `val:${model}:${H}:${k}`
  for (const model of H_MODELS) for (const H of HS) {
    for (let k = 0; k <= W; k++) {
      const isIS = k === W
      const tv1 = isIS ? tEnd : winStarts[k]
      const tv0 = addMonths(tv1, -12)
      const cal = calibrate(model, H, isIS ? IS_INNER : wvInner(k))
      const segs = segsOf(cal.spec, H, tv0, tv1)
      valJobs.push({ kind: 'run', key: valKey(model, H, k), segs, base: null, curve: true, from: segs[0].a, to: segs[segs.length - 1].b, windows: [segs[0].a] })
    }
  }
  const valRes = new Map((await pool.all<RunRes>(valJobs, 'validation interne')).map(r => [r.key, r]))
  const chooseH = (model: ModelName, k: number) => {
    if (model === 'M0wf' || model === 'Mglob') return { H: 365, crit: {} as Record<number, number> }
    const m = model === 'M2a' ? 'M2' : model
    const crit: Record<number, number> = {}
    for (const H of HS) {
      const r = valRes.get(valKey(m, H, k))!
      const st = dailyStats(r.dayEq!, 0, r.dayEq!.length - 1)
      crit[H] = st.sharpe - K_DD * Math.abs(st.dd)
    }
    let best = 365
    for (const H of HS) if (crit[H] > crit[best] + 1e-9) best = H
    return { H: best, crit }
  }

  // ------------------------------------------------ phase 3 : tests hors échantillon et IS
  const MODELS: ModelName[] = ['M0wf', 'Mglob', 'M1', 'M2', 'M2a', 'M3', 'M4']
  const chosen: Record<string, { H: number; crit: Record<number, number>; cal: Calib }[]> = {}
  const oosJobs: RunJob[] = []
  const span = { from: oos0, to: S.end }
  oosJobs.push({ kind: 'run', key: 'oos:M0', segs: winStarts.map((_, k) => ({ a: winIdx[k], b: winEnd(k), spec: null, H: 365 })), base: null, curve: true, ...span, windows: winIdx })
  for (const model of MODELS) {
    chosen[model] = []
    const segs: Segment[] = []
    for (let k = 0; k < W; k++) {
      const { H, crit } = chooseH(model, k)
      const cal = calibrate(model, H, wvTrain(k))
      chosen[model].push({ H, crit, cal })
      segs.push({ a: winIdx[k], b: winEnd(k), spec: cal.spec, H })
    }
    oosJobs.push({ kind: 'run', key: `oos:${model}`, segs, base: null, curve: true, ...span, windows: winIdx })
    // IS : même procédure sur tout l'historique, surface unique appliquée à la même période.
    const { H } = chooseH(model, W)
    const cal = calibrate(model, H, IS_TRAIN)
    chosen[model].push({ H, crit: {}, cal })
    oosJobs.push({ kind: 'run', key: `is:${model}`, segs: winStarts.map((_, k) => ({ a: winIdx[k], b: winEnd(k), spec: cal.spec, H })), base: null, curve: true, ...span, windows: winIdx })
  }
  // Horizons fixes, sans sélection (sensibilité).
  for (const model of ['M1', 'M2'] as ModelName[]) for (const H of HS) {
    oosJobs.push({ kind: 'run', key: `oosH:${model}:${H}`, segs: winStarts.map((_, k) => ({ a: winIdx[k], b: winEnd(k), spec: calibrate(model, H, wvTrain(k)).spec, H })), base: null, curve: true, ...span, windows: winIdx })
  }
  // Référence de parité : le préréglage d'un seul bloc sur la même période.
  const res = new Map((await pool.all<RunRes>(oosJobs, 'tests hors échantillon et IS')).map(r => [r.key, r]))
  {
    const { select } = selectFor(S.preset, S.m, S.daily)
    const full = simulate(S.m, S.preset.sets, COSTS, S.lo, S.end, select)
    const a = metricsOf(bars, full, oos0, S.end), b = res.get('oos:M0')!.total
    checks.push(`Préréglage rejoué par tranches de 3 mois (machinerie du walk-forward) face à une simulation d'un bloc, ${iso(oos0)} → ${iso(S.end)} : Sharpe ${num(b[2])} contre ${num(a.sharpe)}, rendement ${pct(b[0], 0)} contre ${pct(a.totalReturn, 0)}, ${b[6]} trades contre ${a.trades}.`)
  }

  // ------------------------------------------------ comparaisons appariées (bootstrap par fenêtre)
  const rand = (() => { let s = SEED >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } })()
  const dayWin = (r: RunRes) => { const out: number[][] = Array.from({ length: W }, () => []); const dt = r.dayT!; let k = 0; for (let i = 1; i < dt.length; i++) { while (k + 1 < W && dt[i] >= winStarts[k + 1]) k++; out[k].push(r.dayEq![i] / r.dayEq![i - 1] - 1) } return out }
  const shOf = (rs: number[]) => { const s = sd(rs); return s > 0 ? (mean(rs) / s) * Math.sqrt(365) : 0 }
  const paired = (A: RunRes, B: RunRes) => {
    const a = dayWin(A), b = dayWin(B)
    const deltas: number[] = []
    for (let it = 0; it < 2000; it++) {
      const ra: number[] = [], rb: number[] = []
      for (let k = 0; k < W; k++) { const j = Math.floor(rand() * W); ra.push(...a[j]); rb.push(...b[j]) }
      deltas.push(shOf(ra) - shOf(rb))
    }
    const better = A.winRet.filter((x, k) => x > B.winRet[k] + 1e-12).length
    const worse = A.winRet.filter((x, k) => x < B.winRet[k] - 1e-12).length
    return { pPos: deltas.filter(x => x > 0).length / deltas.length, lo: quantile(deltas, 0.05), hi: quantile(deltas, 0.95), better, worse, same: W - better - worse }
  }

  // ------------------------------------------------ décision d'ablation (règle fixée a priori)
  const LADDER: { name: string; key: ModelName | 'M0'; prev: ModelName | 'M0' | null }[] = [
    { name: 'M0 · préréglage figé', key: 'M0', prev: null },
    { name: 'M0wf · 2 régimes durs, recalibrés', key: 'M0wf', prev: null },
    { name: 'M1 · percentile, 3 experts durs', key: 'M1', prev: 'M0wf' },
    { name: 'M2 · + poids continus', key: 'M2', prev: 'M1' },
    { name: 'M3 · + vol-of-vol', key: 'M3', prev: 'M2' },
    { name: 'M4 · + tendance/range', key: 'M4', prev: 'M3' },
  ]
  const keep = (k: string, prev: string) => {
    const A = res.get(`oos:${k}`)!, B = res.get(`oos:${prev}`)!
    const p = paired(A, B)
    const dSh = A.total[2] - B.total[2], dDD = A.total[5] - B.total[5]
    return { ok: dSh > 0.05 && p.pPos >= 0.75 && dDD > -0.05, dSh, dDD, p }
  }
  let retained: ModelName = 'M0wf'
  const decisions: { step: string; ok: boolean; why: string }[] = []
  for (const st of LADDER) {
    if (!st.prev) continue
    const prevRetained = st.prev === 'M0wf' ? 'M0wf' : retained
    const kp = keep(st.key, prevRetained)
    decisions.push({ step: `${st.key} contre ${prevRetained}`, ok: kp.ok, why: `ΔSharpe ${num(kp.dSh)}, P(Δ > 0) ${pct(kp.p.pPos, 0)}, ΔMax DD ${pct(kp.dDD)}` })
    if (kp.ok) retained = st.key as ModelName
  }
  // Meilleur candidat continu (hors règle), pour la robustesse comparée.
  const contenders: ModelName[] = ['M1', 'M2', 'M3', 'M4']
  const bestCont = contenders.reduce((b, k) => (res.get(`oos:${k}`)!.total[2] > res.get(`oos:${b}`)!.total[2] ? k : b), 'M2' as ModelName)

  // ------------------------------------------------ phase 4 : robustesse (voisins ±5 / 10 / 20 %)
  const LEVELS = [0.05, 0.1, 0.2]
  const ROB_BASE: { key: keyof ShockParams; z?: boolean; sides: (0 | 1)[] }[] = [
    { key: 'volWin', sides: [0, 1] }, { key: 'wickThr', sides: [0] }, { key: 'htfEmaLen', sides: [0, 1] }, { key: 'volZWin', sides: [0, 1] },
    { key: 'volZThr', z: true, sides: [0] }, { key: 'atrLen', sides: [0, 1] }, { key: 'tp1AtrMult', sides: [1] }, { key: 'tp1QtyPct', sides: [1] },
  ]
  const INTK = new Set(['volWin', 'htfEmaLen', 'volZWin', 'atrLen', 'tp1QtyPct'])
  const robModels = [...new Set<ModelName>(['M0wf', retained, 'M2', bestCont])]
  const robJobs: RunJob[] = []
  const robSamples: { model: string; level: number; key: string }[] = []
  for (const model of robModels) {
    for (const L of LEVELS) for (let s = 0; s < NROB; s++) {
      const u = () => L * (2 * rand() - 1)
      const nEx = chosen[model][0].cal.spec.experts.length
      const dTheta = Array.from({ length: nEx }, () => DIMS.map(() => u()))
      const base: Base = { ...S.base, calm: { ...S.base.calm }, agit: { ...S.base.agit } }
      for (const kb of ROB_BASE) for (const side of kb.sides) {
        const d = u()
        const obj = (side ? base.agit : base.calm) as unknown as Record<string, number>
        const v = obj[kb.key as string]
        obj[kb.key as string] = kb.z ? v + d * Math.max(Math.abs(v), 1) : INTK.has(kb.key as string) ? Math.max(1, Math.round(v * (1 + d))) : v * (1 + d)
      }
      const segs: Segment[] = chosen[model].slice(0, W).map((c, k) => ({
        a: winIdx[k], b: winEnd(k), H: c.H,
        spec: { ...c.cal.spec, experts: c.cal.spec.experts.map((e, j) => e.map((x, d) => indexOf(DIMS[d], valueAt(DIMS[d], x) * (1 + dTheta[j][d])))) },
      }))
      const key = `rob:${model}:${L}:${s}`
      robJobs.push({ kind: 'run', key, segs, base, curve: false, ...span, windows: winIdx })
      robSamples.push({ model, level: L, key })
    }
  }
  const robRes = new Map((await pool.all<RunRes>(robJobs, 'robustesse')).map(r => [r.key, r]))
  pool.close()

  // ------------------------------------------------ rapport
  const lines: string[] = []
  const table = (head: string[], rows: string[][]) => {
    lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => ' --- ').join('|')}|`)
    for (const r of rows) lines.push(`| ${r.join(' | ')} |`)
    lines.push('')
  }
  const sgn = (x: number, f: (v: number) => string) => (x > 0 ? '+' : x < 0 ? '−' : '') + f(Math.abs(x))
  const val = (d: number, x: number) => { const v = valueAt(DIMS[d], x); return d === 3 ? String(Math.round(v)) : v.toFixed(2) }
  const thetaStr = (th: number[]) => `s ${val(0, th[0])} · stop ${val(1, th[1])} · suiveur ${val(2, th[2])} · range ${val(3, th[3])}`
  const M = (k: string) => res.get(k)!.total
  const yearsOf = (k: string) => res.get(k)!.years

  lines.push(
    '# Surface adaptative continue · Shock Engine 15 min · walk-forward imbriqué',
    '',
    `BTC/USD Bitstamp 15 min. Calibration 36 mois → test 3 mois → pas de 3 mois ; tests concaténés du ${iso(oos0)} au ${iso(S.end)} (${W} fenêtres). Commission 0,045 % par ordre, sans levier, même moteur et même exécution pour tous les modèles. Produit par \`node research/shock/adaptive-surface.ts --robust ${NROB} --seed ${SEED}\` en ${((Date.now() - t0) / 60000).toFixed(0)} min.`,
    '',
    '**Le critère est le walk-forward hors échantillon, pas le backtest.** Aucun résultat de test n\'est utilisé pour calibrer ; les constantes de la procédure ont été fixées avant de lancer le calcul.',
    '',
    '## Parité et vérifications',
    '',
    ...checks.map(c => `- ${c}`),
    `- Rendements de la grille non rattachés à un trade : ${lostTotal}.`,
    '',
  )

  // Ablation
  lines.push('## Ablation · M0 → M4', '', 'IS : la même procédure appliquée une fois à tout l\'historique 2017-2026 (surface unique, donc vue de la période de test), évaluée sur la même période que le walk-forward. WF OOS : surfaces recalibrées à chaque fenêtre sur le seul passé.', '')
  const rowOf = (name: string, k: string) => {
    const o = M(`oos:${k}`), is = k === 'M0' ? o : M(`is:${k}`)
    return [name, num(is[2]), num(o[2]), num(o[3]), pct(o[1]), num(o[4]), pct(o[5]), String(o[6]), pct(o[7], 0)]
  }
  table(['modèle', 'Sharpe IS', 'Sharpe WF OOS', 'Sortino OOS', 'CAGR OOS', 'PF OOS', 'Max DD OOS', 'trades', 'exposition'], [
    ...LADDER.map(s => rowOf(s.name, s.key)),
    rowOf('M2a · poids continus sur θ seulement', 'M2a'),
    rowOf('Mglob · aucun réglage adaptatif', 'Mglob'),
  ])
  lines.push('Écarts de chaque ajout (hors échantillon) et stabilité par fenêtre :', '')
  const deltaRow = (k: string, prev: string) => {
    const A = res.get(`oos:${k}`)!, B = res.get(`oos:${prev}`)!
    const p = paired(A, B)
    return [`${k} contre ${prev}`, sgn(A.total[2] - B.total[2], num), sgn(A.total[3] - B.total[3], num), sgn(A.total[5] - B.total[5], x => pct(x)), sgn(A.total[4] - B.total[4], num), `${p.better} / ${p.worse} / ${p.same}`, `${num(p.lo)} à ${num(p.hi)}`, pct(p.pPos, 0), sgn((M(`is:${k}`)[2] - (prev === 'M0' ? M('oos:M0')[2] : M(`is:${prev}`)[2])), num)]
  }
  table(['étape', 'Δ Sharpe OOS', 'Δ Sortino OOS', 'Δ Max DD OOS', 'Δ PF OOS', 'fenêtres mieux / moins bien / égales', 'Δ Sharpe, intervalle 90 %', 'P(Δ Sharpe > 0)', 'Δ Sharpe IS'], [
    deltaRow('M0wf', 'M0'), deltaRow('M1', 'M0wf'), deltaRow('M2', 'M1'), deltaRow('M2a', 'M1'), deltaRow('M2', 'M2a'), deltaRow('M3', 'M2'), deltaRow('M4', 'M3'), deltaRow('Mglob', 'M0wf'),
  ])
  lines.push('Règle (fixée avant le calcul) : une étape est gardée si Δ Sharpe OOS > 0,05, P(Δ > 0) ≥ 75 % au bootstrap par fenêtre et Max DD pas plus de 5 points plus profond.', '')
  for (const d of decisions) lines.push(`- ${d.step} : **${d.ok ? 'gardée' : 'rejetée'}** (${d.why}).`)
  lines.push('', `Architecture retenue par la règle : **${retained}**. Meilleur Sharpe OOS parmi M1-M4 (hors règle) : ${bestCont}.`, '')

  // Par sous-période
  lines.push('## Résultats hors échantillon par année', '')
  const ys = yearsOf('oos:M0').map(x => x.y)
  table(['modèle', ...ys.map(String)], ['M0', 'M0wf', 'M1', 'M2', 'M3', 'M4'].map(k => [k, ...ys.map(y => { const m = yearsOf(`oos:${k}`).find(x => x.y === y)!.m; return `${pct(m[0], 0)} · ${num(m[2])}` })]))
  lines.push('Chaque case : rendement · Sharpe de l\'année.', '')
  table(['modèle', ...ys.map(String)], ['M0', 'M0wf', 'M1', 'M2', 'M3', 'M4'].map(k => [k, ...ys.map(y => pct(yearsOf(`oos:${k}`).find(x => x.y === y)!.m[5]))]))
  lines.push('Max DD par année.', '')

  // Horizons fixes
  lines.push('## Horizon du percentile', '', 'Horizon choisi en validation interne à chaque fenêtre, et résultat des horizons fixés sans sélection :', '')
  table(['modèle', ...HS.map(H => `${H_LABEL[H]} fixe`), 'choisi en validation', 'choix (6 / 12 / 18 mois)'], ['M1', 'M2'].map(k => [k, ...HS.map(H => num(M(`oosH:${k}:${H}`)[2])), num(M(`oos:${k}`)[2]), HS.map(H => chosen[k].slice(0, W).filter(c => c.H === H).length).join(' / ')]))
  table(['modèle', 'choix (6 / 12 / 18 mois)'], ['M3', 'M4'].map(k => [k, HS.map(H => chosen[k].slice(0, W).filter(c => c.H === H).length).join(' / ')]))

  // Paramètres par fenêtre
  lines.push('## Réglages choisis à chaque fenêtre', '')
  const showModel = retained === 'M0wf' ? 'M2' : retained
  for (const k of ['M0wf', showModel]) {
    lines.push(`### ${k}`, '')
    const names = k === 'M0wf' ? ['calme', 'agité'] : ['bas', 'moyen', 'haut']
    table(['test', 'horizon', ...names.map(n => `expert ${n}`), 'global', ...names.map(n => `α ${n}`)], chosen[k].slice(0, W).map((c, w) => [
      iso(winIdx[w]), H_LABEL[c.H], ...c.cal.spec.experts.map(thetaStr), thetaStr(c.cal.fits.global.theta), ...names.map(n => num(c.cal.alpha[n] ?? NaN)),
    ]))
  }
  for (const k of ['M3', 'M4'] as ModelName[]) {
    lines.push(`### Inclinaisons de ${k}`, '', 'Écart de θ entre la moitié haute et la moitié basse de la variable (en crans de grille), après rétrécissement :', '')
    const tilts = chosen[k].slice(0, W).map(c => c.cal.spec.tilts)
    const feats = tilts[0].map(t => t.feature)
    for (const f of feats) {
      const ds = tilts.map(ts => ts.find(t => t.feature === f)!.delta)
      table(['réglage', 'moyenne', 'P10', 'P90', 'même signe que la médiane'], DIMS.map((d, j) => {
        const xs = ds.map(x => x[j]), med = quantile(xs, 0.5)
        return [`${f === 'qVov' ? 'vol-of-vol' : 'tendance/range'} · ${d}`, num(mean(xs)), num(quantile(xs, 0.1)), num(quantile(xs, 0.9)), pct(xs.filter(x => Math.sign(x) === Math.sign(med)).length / xs.length, 0)]
      }))
    }
  }

  // Stabilité des réglages d'une fenêtre à l'autre
  lines.push('## Stabilité des réglages calibrés', '', 'Variation moyenne d\'une fenêtre à la suivante, en crans de grille (moyenne sur les experts) ; une surface qui zigzague a des valeurs élevées.', '')
  table(['modèle', ...DIMS.map(d => `${d}`), 'moyenne'], MODELS.map(k => {
    const cs = chosen[k].slice(0, W)
    const per = DIMS.map((_, d) => {
      const xs: number[] = []
      for (let w = 1; w < cs.length; w++) cs[w].cal.spec.experts.forEach((e, j) => xs.push(Math.abs(e[d] - cs[w - 1].cal.spec.experts[j][d])))
      return mean(xs)
    })
    return [k, ...per.map(x => num(x)), num(mean(per))]
  }))

  // Surface IS (lisible)
  lines.push('## Surface calibrée sur tout l\'historique (IS, pour lecture)', '')
  const isM = chosen[showModel][W]
  table(['percentile de vol', 'poids bas / moyen / haut', 's', 'stop × ATR', 'suiveur × ATR', 'rangeWin'], [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95].map(p => {
    const q = quantize(p, 0.5, 0.5)
    const prm = paramsAt(isM.cal.spec, S.base, q)
    const w = isM.cal.spec.soft ? [1 / 6, 1 / 2, 5 / 6].map(c => Math.exp(-((q.p - c) ** 2) / (2 * 0.15 * 0.15))) : [0, 1, 2].map(k => (k === q.hard ? 1 : 0))
    const sw = w.reduce((a, b) => a + b, 0)
    return [pct(p, 0), w.map(x => (x / sw).toFixed(2)).join(' / '), (prm.kMicro - 0.2).toFixed(2), prm.atrStopMult.toFixed(2), prm.atrTrailMult.toFixed(1), String(prm.rangeWin)]
  }))
  lines.push(`Horizon : ${H_LABEL[isM.H]}. Préréglage actuel : calme ${thetaStr(presetTheta(S.base.calm))} ; agité ${thetaStr(presetTheta(S.base.agit))}.`, '')

  // Robustesse
  lines.push('## Robustesse des architectures (voisins ±5 / 10 / 20 %)', '', `Pour chaque voisin, les réglages des experts de toutes les fenêtres et les réglages de base actifs (volWin, wickThr, htfEmaLen, volZWin, volZThr, atrLen, TP1) sont perturbés en même temps, du même facteur dans toutes les fenêtres ; le walk-forward hors échantillon est rejoué. ${NROB} voisins par niveau.`, '')
  const robRows: string[][] = []
  for (const model of robModels) for (const L of LEVELS) {
    const xs = robSamples.filter(s => s.model === model && s.level === L).map(s => robRes.get(s.key)!.total)
    const sh = xs.map(x => x[2])
    robRows.push([model, `±${L * 100} %`, num(M(`oos:${model}`)[2]), [0.1, 0.25, 0.5, 0.75, 0.9].map(q => num(quantile(sh, q))).join(' · '), pct(xs.filter(x => x[0] > 0).length / xs.length, 0), pct(xs.filter(x => x[4] > 1).length / xs.length, 0), `${pct(quantile(xs.map(x => x[5]), 0.5))} (${pct(quantile(xs.map(x => x[5]), 0.1))})`, pct(sh.filter(x => x < M(`oos:${model}`)[2]).length / sh.length, 0)])
  }
  table(['modèle', 'niveau', 'Sharpe OOS du modèle', 'Sharpe P10 · P25 · méd. · P75 · P90', 'rentables', 'PF > 1', 'Max DD méd. (P10)', 'modèle meilleur que'], robRows)

  lines.push(
    '## Méthode',
    '',
    '- Réglages adaptatifs (4) : seuil effectif du choc `s` (calme : kMain ; agité : kMicro − 0,2), `atrStopMult`, `atrTrailMult`, `rangeWin`. Grille : ' + DIMS.map(d => `${d} {${GRID[d].join(', ')}}`).join(' ; ') + '.',
    '- Réglages fixes : tous les autres, valeurs du préréglage. Ceux qui diffèrent entre calme et agité (volWin, wickThr, htfEmaLen, volZWin, volZThr, atrLen, TP1) basculent à la médiane dans M0, M0wf, M1, M2a, et sont interpolés avec les poids dans M2, M3, M4 (expert moyen = milieu des deux jeux). Shorts autorisés et TP1 restent des interrupteurs à la médiane, comme aujourd\'hui.',
    '- État : volatilité réalisée (écart type des rendements journaliers sur 20 jours), rang percentile parmi les H jours précédents ; vol-of-vol : coefficient de variation de cette volatilité sur 60 jours, puis son rang ; tendance/range : rapport d\'efficacité sur 30 jours, puis son rang. Chaque bougie prend l\'état du dernier jour clos.',
    '- Poids : noyaux gaussiens centrés sur 1/6, 1/2, 5/6 du percentile, σ = 0,15, normalisés. θ(t) = Σ w θ_expert (+ 2 (q − 0,5) Δ pour chaque variable secondaire, q borné à [0,25 ; 0,75]), en crans de grille. État quantifié par pas de 5 % (percentile) et 25 % (variables secondaires) : un jeu de réglages complet par état, comme le mode adaptatif actuel.',
    '- Les trades des points de grille sont rattachés à la cellule de leur bougie d\'entrée ; une position garde les réglages de son entrée jusqu\'à sa sortie, en calibration comme en test.',
    '- Tests concaténés : chaque fenêtre est simulée sur une tranche (30 jours de préchauffage) ; une position ouverte à la fin d\'une fenêtre est menée à sa sortie avec ses réglages, la fenêtre suivante commence ensuite.',
    `- Bootstrap : ${W} fenêtres tirées avec remise, 2000 tirages, Sharpe des rendements journaliers.`,
    '',
  )
  const out = 'research/reports/shock-15m-adaptive-surface'
  writeFileSync(`${out}.md`, lines.join('\n'))
  const curves = Object.fromEntries([...res.entries()].filter(([k]) => k.startsWith('oos:') || k.startsWith('is:')).map(([k, r]) => [k, { t: Array.from(r.dayT!), eq: Array.from(r.dayEq!, x => +x.toFixed(5)) }]))
  writeFileSync(`${out}.json`, JSON.stringify({
    period: [iso(oos0), iso(S.end)], windows: winIdx.map(iso), grid: GRID, checks, retained, bestCont, decisions,
    results: Object.fromEntries([...res.entries()].map(([k, r]) => [k, { total: r.total, years: r.years, winRet: r.winRet, maxSets: r.sets, tailOpen: r.tailOpen }])),
    chosen: Object.fromEntries(Object.entries(chosen).map(([k, cs]) => [k, cs.map(c => ({ H: c.H, crit: c.crit, spec: c.cal.spec, alpha: c.cal.alpha, fits: c.cal.fits }))])),
    robust: robSamples.map(s => ({ ...s, total: robRes.get(s.key)!.total })),
    curves,
  }, (_, v) => (typeof v === 'number' && !Number.isFinite(v) ? null : v)))
  process.stderr.write(`écrit ${out}.md et ${out}.json en ${((Date.now() - t0) / 60000).toFixed(1)} min\n`)
}

if (isMainThread && import.meta.url === `file://${process.argv[1]}`) main()
