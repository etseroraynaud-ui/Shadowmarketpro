// Réévaluation méthodologique du Sharpe dégonflé (DSR) de E2, V1 et B2 : quels essais ont réellement participé à la
// sélection de chaque version, nombre effectif d'essais compte tenu de leur corrélation, pertinence de σ = 0,602.
// Lecture seule, aucun nouvel essai : rejeu des configurations déjà évaluées.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/audit-e2-population.ts <5|9|13>   # populations (une fois)
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/dsr-reeval.ts
//
// Sortie : research/reports/shock-fade/dsr-reeval/{report.md, results.json}.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15, measures, rangeAtSignals, referenceAsset, variantInputs } from '../../lib/regime-er.ts'
import type { Asset, Variant } from '../../lib/regime-er.ts'
import { loadSleeve } from '../../lib/frozen-shock.ts'
import type { SleeveKey } from '../../lib/frozen-shock.ts'
import { dailyOf, simulateSized } from '../../lib/variant-eval.ts'
import { simulateEarlyExit } from '../../lib/early-exit.ts'
import { calmOnly } from '../../lib/calm-only.ts'
import { EULER, moments, normCdf, normInv, psr, sharpe } from '../../lib/overfit.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import type { Market } from '../../../lib/strategies/shock/market.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import { simulateTrail } from './trail-sim.ts'
import type { TrailSpec } from './trail-broker.ts'

const ROOT = join(import.meta.dirname, '../../..')
const OUT = join(ROOT, 'research/reports/shock-fade/dsr-reeval')
const DAY = 864e5, ANNF = Math.sqrt(P.ANN), B = 2000
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const fail = (m: string) => { throw new Error(`contrôle en échec : ${m}`) }
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))

const BTC = referenceAsset('btc'), ETH = referenceAsset('ethusdt'), A = [BTC, ETH]
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1, T = PD1 - PD0 + 1
const DAYS = Array.from({ length: T }, (_, k) => PD0 + k)
const sleeves = (eq: Float64Array[]) => A.map((a, j) => dailyOf(a.bars, eq[j], a.lo, a.end, PD0, PD1).r)
const book = (eq: Float64Array[]) => { const s = sleeves(eq); return P.book(s[0], s[1]).r }
const SR = (x: ArrayLike<number>) => sharpe(x) * ANNF

// ================================================================ 1. univers A (16 configurations de calm-only, copie de research/shock/calm-only.ts)
const RAW = new Map<string, EntryOverride>([[BTC.key, loadSleeve(BTC.sleeveKey as SleeveKey).signals], [ETH.key, loadSleeve(ETH.sleeveKey as SleeveKey).signals]])
const memoGet = (m: Market, key: string) => { const v = m.memo.get(key); if (!v) throw new Error(`série ${key} absente du cache`); return v }
function shortMasks(a: Asset) {
  const { m, preset, select, lo, end } = a
  const { o, h, l, c } = m.bars
  const n = m.bars.n, raw = RAW.get(a.key)!.short
  const prs = preset.sets.map(p => prepare(m, p))
  const htfPrev = preset.sets.map(p => memoGet(m, `htfPrev:${p.htfMinutes}:${p.htfEmaLen}:${p.htfSlopeMode}:${p.htfSlopeBars}`) as Float64Array)
  const out = { V1: new Uint8Array(n), V2: new Uint8Array(n), V3: new Uint8Array(n), V4: new Uint8Array(n), E1: new Uint8Array(n) }
  for (let i = lo; i <= end; i++) {
    if (!raw[i]) continue
    const e = select[i], p = preset.sets[e], R = prs[e]
    const rng = Math.max(h[i] - l[i], m.mintick)
    const v1 = Math.abs(c[i] - o[i]) / rng > 0.55 && (c[i] - l[i]) / rng < 0.25, v2 = R.htfVal[i] < htfPrev[e][i]
    out.V1[i] = v1 ? 1 : 0; out.V2[i] = v2 ? 1 : 0; out.V3[i] = v1 && v2 ? 1 : 0
    out.E1[i] = R.lamPct[i] > p.longLamPct && R.volZ[i] > 0 ? 1 : 0
  }
  return out
}
const MASKS = new Map(A.map(a => [a.key, shortMasks(a)]))
const RF = new Map(A.map(a => { const M = measures(a); return [a.key, { M, range: rangeAtSignals(a, M).range }] }))
const sim = (a: Asset, o: EntryOverride) => simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, o).equity
const seShort = (a: Asset, short: Uint8Array) => sim(a, { long: RAW.get(a.key)!.long, short })
const rf = (v: Variant) => (a: Asset) => { const r = RF.get(a.key)!; const I = variantInputs(a, r.M, r.range, v); return simulate(a.m, I.sets, a.costs(1), a.lo, a.end, I.select, I.override).equity }
const ag = (scaled: boolean) => (a: Asset) => { const [calm, agit] = a.preset.sets; return simulateSized(a.m, [calm, { ...agit, atrStopMult: calm.atrStopMult }], a.costs(1), a.lo, a.end, a.select, a.signals, scaled ? [1, agit.atrStopMult / calm.atrStopMult] : [1, 1]).equity }
const ei = (kk: number) => (a: Asset) => simulateEarlyExit(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, kk).equity
const UA: [number, string, (a: Asset) => Float64Array][] = [
  [1, 'v1 live, sans filtre des shorts', a => sim(a, RAW.get(a.key)!)], [2, 'shorts : symétrie de bougie', a => seShort(a, MASKS.get(a.key)!.V1)], [3, 'shorts : tendance 60 min', a => seShort(a, MASKS.get(a.key)!.V2)],
  [4, 'shorts : bougie + tendance 60 min', a => seShort(a, MASKS.get(a.key)!.V3)], [5, 'sans shorts', a => seShort(a, MASKS.get(a.key)!.V4)], [6, 'shorts : lambda + volume', a => seShort(a, MASKS.get(a.key)!.E1)],
  [7, 'E2', a => sim(a, a.signals)], [8, 'E2, entrées en range retirées', rf('V1')], [9, 'E2, confirmation retardée en range', rf('V2')], [10, 'E2, sorties agitées en range', rf('V3')],
  [11, 'V1 (calme seul)', a => sim(a, calmOnly(a.signals, a.select))], [12, 'E2, stop agité 3,3 ATR, taille', ag(false)], [13, 'E2, stop agité 3,3 ATR, risque', ag(true)],
  [14, 'E2, invalidation 4 bougies', ei(4)], [15, 'E2, invalidation 2 bougies', ei(2)], [16, 'E2, invalidation 8 bougies', ei(8)],
]
const CO = json('research/reports/calm-only/calm-only.json')
const SA = UA.map(([id, , run]) => {
  const x = book(A.map(run))
  if (Math.abs(SR(x) - CO.configurations.find((c: any) => c.id === id).sharpe) > 1e-6) fail(`univers A n° ${id}`)
  return x
})
const E2s = SA[6], V1s = SA[10]
log('univers A')

// ================================================================ 2. variantes de sortie testées sur V1 (19)
const sigV1 = A.map(a => calmOnly(a.signals, a.select))
function flow(sym: string) {
  const buf = readFileSync(join(ROOT, `research/data/binance/fade/derived/taker15-${sym}.f64`))
  const x = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const rows = x.length / 6, T0 = x[0], K = (x[(rows - 1) * 6] - T0) / M15 + 1
  const PV = new Float64Array(K + 1), PB = new Float64Array(K + 1), PN = new Float64Array(K + 1)
  const V = new Float64Array(K), Bv = new Float64Array(K), N = new Float64Array(K)
  for (let r = 0; r < rows; r++) { const k = (x[r * 6] - T0) / M15; V[k] = x[r * 6 + 1]; Bv[k] = x[r * 6 + 2]; N[k] = x[r * 6 + 3] }
  for (let k = 0; k < K; k++) { PV[k + 1] = PV[k] + V[k]; PB[k + 1] = PB[k] + Bv[k]; PN[k + 1] = PN[k] + N[k] }
  return (from: number, to: number) => {
    const k0 = (from - T0) / M15, k1 = (to - T0) / M15
    if (k0 < 0 || k1 > K || (PN[k1] - PN[k0]) / ((to - from) / 60000) < 0.9) return NaN
    const v = PV[k1] - PV[k0], b = PB[k1] - PB[k0]
    return v > 0 ? (2 * b - v) / v : NaN
  }
}
const FLOW = ['BTCUSDT', 'ETHUSDT'].map(flow)
const H2 = 2 * 3600e3, H4 = 4 * 3600e3
type XV = [string, (j: number) => TrailSpec, number?]
const EXITS: XV[] = [
  ...[8, 12, 16, 25].map(k => [`C${k}`, () => ({ kind: 'classic' }), k] as XV),
  ...([[3, 2], [5, 3], [5, 4]] as const).map(([x, d]) => [`D${x}-${d}`, () => ({ kind: 'decoupled', actR: x, distR: d })] as XV),
  ...([[2, 1.5], [2, 3], [4, 1.5], [4, 3]] as const).map(([x, d]) => [`X${x}-${d}`, (j: number) => ({ kind: 'regime', profitR: x, distR: d, regime: A[j].select })] as XV),
  ['B1', () => ({ kind: 'v1', beR: 2 })], ['B2', () => ({ kind: 'v1', beR: 3 })],
  ['V1', j => ({ kind: 'v1', early: { horizonMs: H2, imb: FLOW[j] } })], ['V2', j => ({ kind: 'v1', early: { horizonMs: H4, imb: FLOW[j] } })],
  ['V3', j => ({ kind: 'v1', early: { horizonMs: H2, imb: FLOW[j], gainBelowR: 0.5 } })], ['V4', j => ({ kind: 'v1', early: { horizonMs: H4, imb: FLOW[j], gainBelowR: 0.5 } })],
  ['C1', j => ({ kind: 'v1', beR: 3, early: { horizonMs: H2, imb: FLOW[j], gainBelowR: 0.5 } })], ['C2', j => ({ kind: 'v1', beR: 3, early: { horizonMs: H4, imb: FLOW[j], gainBelowR: 0.5 } })],
]
const SX = EXITS.map(([, sp, mult]) => book(A.map((a, j) => simulateTrail(a.m, a.preset.sets.map((p, k) => (k === 0 && mult !== undefined ? { ...p, atrTrailMult: mult } : p)), a.costs(1), a.lo, a.end, a.select, sigV1[j], sp(j)).equity)))
const BV = json('research/reports/shock-fade/v1-be-volume/results.json'), TR = json('research/reports/shock-fade/v1-trailing/results.json')
EXITS.forEach(([id], k) => {
  const ref = k < 11 ? TR.variants.find((v: any) => v.id === id).full.sharpe : BV.configs.find((c: any) => c.id === id).full.sharpe
  if (Math.abs(SR(SX[k]) - ref) > 1e-6) fail(`Sharpe ${id}`)
})
const B2s = SX[12]
log('variantes de sortie')

// ================================================================ 3. populations des jeux de paramètres (audit-e2-population.ts)
// rôle 0 : jeu calme de E2 ; 1 : jeu agité de E2 ; 2 : jeu calme de V1. Doublons (6 candidats fixes communs aux graines) retirés.
interface Cand { seed: number; idx: number; btc: Float64Array; eth: Float64Array; port: number[] }
const POPS: Cand[][] = [[], [], []]
for (const seed of [5, 9, 13]) {
  const meta = json(`research/data/binance/fade/derived/audit/e2pop-${seed}.json`)
  if (meta.T !== T || meta.PD0 !== PD0) fail(`population ${seed} : fenêtre`)
  const buf = readFileSync(join(ROOT, `research/data/binance/fade/derived/audit/e2pop-${seed}.f64`))
  const x = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  for (let r = 0; r < meta.rows; r++) {
    const o = r * meta.cols, role = x[o], idx = x[o + 1]
    if (seed !== 5 && idx < 6) continue
    const btc = x.slice(o + 2, o + 2 + T), eth = x.slice(o + 2 + T, o + 2 + 2 * T)
    POPS[role].push({ seed, idx, btc, eth, port: P.book(Array.from(btc), Array.from(eth)).r })
  }
}
const pick = (role: number, idx: number) => POPS[role].findIndex(c => c.seed === 5 && c.idx === idx)
const SEL = [pick(0, 178), pick(1, 38), pick(2, 178)]
if (POPS[0][SEL[0]].port.some((v, t) => v !== E2s[t]) || POPS[1][SEL[1]].port.some((v, t) => v !== E2s[t])) fail('population E2 : préréglage ≠ E2')
if (POPS[2][SEL[2]].port.some((v, t) => v !== V1s[t])) fail('population V1 : n° 178 ≠ V1')
log(`populations : ${POPS.map(p => p.length).join(' / ')}`)

// ================================================================ 4. bootstrap joint par mois : maximum attendu du bruit
// Sous l'hypothèse nulle du DSR (aucune différence réelle entre les essais d'une étape), le Sharpe retenu dépasse sa
// vraie valeur de E[max_i (SR*_i − SR_i)]. On rééchantillonne les mêmes mois pour tous les essais (corrélations et queues
// épaisses conservées) ; quand la sélection a été faite sur BTC seul, on prend l'essai au plus grand bruit sur BTC et on
// mesure son bruit sur le portefeuille.
const months: number[][] = []
{ let cur = NaN; DAYS.forEach((d, k) => { const m = P.monthKey(d); if (m !== cur) { months.push([]); cur = m } months[months.length - 1].push(k) }) }
const M = months.length
type Agg = Float64Array // [n, Σx, Σx²] par mois
const agg = (x: ArrayLike<number>): Agg => { const a = new Float64Array(3 * M); months.forEach((g, m) => { for (const k of g) { a[3 * m] += 1; a[3 * m + 1] += x[k]; a[3 * m + 2] += x[k] ** 2 } }); return a }
const shAgg = (a: Agg, draw: Int32Array) => { let n = 0, s = 0, q = 0; for (const m of draw) { n += a[3 * m]; s += a[3 * m + 1]; q += a[3 * m + 2] } const mu = s / n, v = q / n - mu * mu; return v > 0 ? (mu / Math.sqrt(v)) * ANNF : 0 }
const rng = P.rng(20261014)
const DRAWS = Array.from({ length: B }, () => Int32Array.from({ length: M }, () => Math.floor(rng() * M)))
interface Stage { id: string; label: string; meas: number[][]; sel?: ArrayLike<number>[]; extraN?: number }
function stageNoise(st: Stage) {
  const am = st.meas.map(agg), as = (st.sel ?? st.meas).map(agg)
  // Bruit = Sharpe du tirage − moyenne bootstrap de cet essai (centrage sur la moyenne bootstrap : le biais propre du
  // bootstrap, mesuré à part, ne compte pas comme inflation de sélection).
  const mu = new Float64Array(am.length), muS = new Float64Array(as.length), sdAcc = new Float64Array(am.length)
  for (const d of DRAWS) { for (let i = 0; i < am.length; i++) { const v = shAgg(am[i], d); mu[i] += v / B; sdAcc[i] += v * v / B } for (let i = 0; i < as.length; i++) muS[i] += shAgg(as[i], d) / B }
  const draws = new Float64Array(B)
  DRAWS.forEach((d, b) => {
    let best = -Infinity, arg = 0
    for (let i = 0; i < as.length; i++) { const z = shAgg(as[i], d) - muS[i]; if (z > best) { best = z; arg = i } }
    draws[b] = shAgg(am[arg], d) - mu[arg]
  })
  const se = Math.sqrt(P.mean(Array.from(sdAcc).map((q, i) => q - mu[i] ** 2)))
  const bias = P.mean(st.meas.map((x, i) => mu[i] - SR(x)))
  // Alternatives sans série (règles Hawkes) : N équivalent augmenté au prorata, inflation remise à l'échelle.
  const m0 = P.mean(draws), n0 = st.meas.length, k = st.extraN ? emax(impliedN(m0, se) * (n0 + st.extraN) / n0) / emax(impliedN(m0, se)) : 1
  if (k !== 1) for (let b = 0; b < B; b++) draws[b] *= k
  return { draws, mean: m0 * k, se, bias }
}
const emax = (N: number) => (N <= 1 ? 0 : (1 - EULER) * normInv(1 - 1 / N) + EULER * normInv(1 - 1 / (N * Math.E)))
/** N d'essais indépendants qui donnerait le même maximum attendu (au même niveau de bruit). */
const impliedN = (mean: number, se: number) => { if (mean <= 0) return 1; let lo = 1, hi = 1e12; for (let k = 0; k < 200; k++) { const mid = Math.sqrt(lo * hi); if (se * emax(mid) < mean) lo = mid; else hi = mid } return hi }
const disp = (srs: number[]) => Math.sqrt(P.mean(srs.map(v => (v - P.mean(srs)) ** 2)))
function corrStats(series: ArrayLike<number>[]) {
  const z = series.filter(x => moments(x).sd > 0).map(x => { const m = moments(x); return Array.from(x, v => (v - m.mean) / m.sd) })
  const n = z.length
  let off = 0, fro = n
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { let s = 0; for (let t = 0; t < T; t++) s += z[i][t] * z[j][t]; const c = s / T; off += 2 * c; fro += 2 * c * c }
  return { rho: off / (n * (n - 1)), nPR: (n * n) / fro }
}

// ================================================================ 5. étapes de sélection de chaque version
const pop = (r: number) => POPS[r]
const STAGES: Record<string, Stage> = {
  Pc: { id: 'Pc', label: 'jeu calme de E2 (606 candidats, choisi sur BTC)', meas: pop(0).map(c => c.port), sel: pop(0).map(c => c.btc) },
  Pa: { id: 'Pa', label: 'jeu agité de E2 (606 candidats, choisi sur BTC)', meas: pop(1).map(c => c.port), sel: pop(1).map(c => c.btc) },
  Pv: { id: 'Pv', label: 'jeu calme de V1 (606 candidats, choisi sur BTC)', meas: pop(2).map(c => c.port), sel: pop(2).map(c => c.btc) },
  S2: { id: 'S2', label: 'règle E2 parmi 7 traitements des shorts (n° 1 à 7)', meas: SA.slice(0, 7) },
  S1: { id: 'S1', label: 'V1 parmi E2 et 9 modifications de E2 (n° 7 à 16)', meas: SA.slice(6) },
  SB: { id: 'SB', label: 'B2 parmi V1, 11 trailings, 8 point mort / volume (+ 2 règles Hawkes)', meas: [V1s, ...SX], extraN: 2 },
}
const ST: Record<string, ReturnType<typeof stageNoise> & { n: number; sd: number; rho: number; nPR: number; nImp: number }> = {}
for (const st of Object.values(STAGES)) {
  const r = stageNoise(st), c = corrStats(st.meas)
  ST[st.id] = { ...r, n: st.meas.length + (st.extraN ?? 0), sd: disp(st.meas.map(x => SR(x))), rho: c.rho, nPR: c.nPR, nImp: impliedN(r.mean, r.se) }
  log(`étape ${st.id}`)
}
// Sensibilité : jeux choisis comme si la sélection portait sur le portefeuille (et non sur BTC seul)
const STp: Record<string, number> = {}
for (const id of ['Pc', 'Pa', 'Pv']) STp[id] = stageNoise({ ...STAGES[id], sel: undefined }).mean
const VERS: Record<string, { label: string; x: number[]; stages: string[] }> = {
  E2: { label: 'E2', x: E2s, stages: ['Pc', 'Pa', 'S2'] },
  V1: { label: 'V1', x: V1s, stages: ['Pv', 'S2', 'S1'] },
  B2: { label: 'B2', x: B2s, stages: ['Pv', 'S2', 'S1', 'SB'] },
}
const dsrAt = (x: number[], sr0Ann: number) => psr(x, sr0Ann / ANNF).p
const SD_INIT = CO.dsr.sdB as number
const res = Object.entries(VERS).map(([id, v]) => {
  const st = v.stages.map(s => ST[s])
  const sr0R1 = P.sum(v.stages.map(s => ST[s].sd * emax(ST[s].n)))
  const sr0R2 = P.sum(st.map(s => s.mean))
  const sr0Port = P.sum(v.stages.map(s => (s in STp ? STp[s] : ST[s].mean)))
  const sr0Proc = P.sum(v.stages.map(s => (s in STp ? (ST[s].mean * emax(7 * ST[s].nImp)) / emax(ST[s].nImp) : ST[s].mean)))
  const both = (s: string) => { const m = STp[s], ni = impliedN(m, ST[s].se); return (m * emax(7 * ni)) / emax(ni) }
  const sr0Both = P.sum(v.stages.map(s => (s in STp ? both(s) : ST[s].mean)))
  return {
    id, sr: SR(v.x), psr0: psr(v.x, 0).p, rawN: P.sum(st.map(s => s.n)),
    C: { N: 222, sr0: SD_INIT * emax(222), p: dsrAt(v.x, SD_INIT * emax(222)) },
    C6266: dsrAt(v.x, SD_INIT * emax(6266)), C128k: dsrAt(v.x, SD_INIT * emax(128547)),
    R1: { sr0: sr0R1, p: dsrAt(v.x, sr0R1) },
    R2: { sr0: sr0R2, p: dsrAt(v.x, sr0R2) },
    sensPort: { sr0: sr0Port, p: dsrAt(v.x, sr0Port) }, sensProc: { sr0: sr0Proc, p: dsrAt(v.x, sr0Proc) }, sensBoth: { sr0: sr0Both, p: dsrAt(v.x, sr0Both) },
    terms: v.stages.map(s => ({ stage: s, r1: ST[s].sd * emax(ST[s].n), r2: ST[s].mean })),
  }
})

// Gains : V1 − E2 (alternatives à E2 au moment du choix de V1 : n° 8 à 16) ; B2 − V1 (19 variantes de sortie + 2 règles Hawkes)
const diffs = (xs: number[][], base: number[]) => xs.map(x => x.map((v, t) => v - base[t]))
const gainStage = (alts: number[][], base: number[], extraN = 0) => { const d = diffs(alts, base); const r = stageNoise({ id: '', label: '', meas: d, extraN }); return { ...r, n: d.length + extraN, sd: disp(d.map(x => SR(x))), nImp: impliedN(r.mean, r.se), ...corrStats(d) } }
const G1 = gainStage(SA.slice(7), E2s), G2 = gainStage(SX, V1s, 2)
const gain = (x: number[], g: typeof G1, nInit: number, sdInit: number) => ({
  ir: SR(x), psr0: psr(x, 0).p,
  C: { N: nInit, sd: sdInit, sr0: sdInit * emax(nInit), p: dsrAt(x, sdInit * emax(nInit)) },
  R1: { N: g.n, sd: g.sd, sr0: g.sd * emax(g.n), p: dsrAt(x, g.sd * emax(g.n)) },
  R2: { sr0: g.mean, p: dsrAt(x, g.mean), nImp: g.nImp, rho: g.rho, se: g.se },
})
const dV1 = V1s.map((v, t) => v - E2s[t]), dB2 = B2s.map((v, t) => v - V1s[t])
const GAINS = [{ id: 'V1 − E2', ...gain(dV1, G1, CO.dsr.diff.N, CO.dsr.diff.sdD) }, { id: 'B2 − V1', ...gain(dB2, G2, 8, disp(SX.slice(11).map(x => SR(diffs([x], V1s)[0])))) }]

// Test hors sélection : le jeu calme a été choisi sur BTC ; quel est son rang sur ETH, et quelle probabilité sous le bruit seul ?
const p2 = pop(2), ethFull = p2.map(c => SR(c.eth)), btcFull = p2.map(c => SR(c.btc))
const rankEth = 1 + ethFull.filter(v => v > ethFull[SEL[2]]).length, rankBtc = 1 + btcFull.filter(v => v > btcFull[SEL[2]]).length
const top = p2.map((c, i) => ({ i, sr: SR(c.port), btc: btcFull[i], eth: ethFull[i] })).sort((a, b) => b.sr - a.sr).slice(0, 5)
const spearmanBE = P.spearman(btcFull, ethFull)
let hits = 0
{ const ab = p2.map(c => agg(c.btc)), ae = p2.map(c => agg(c.eth)), D = DRAWS.slice(0, 1000)
  const mb = ab.map(a => P.mean(D.map(d => shAgg(a, d)))), me = ae.map(a => P.mean(D.map(d => shAgg(a, d))))
  for (const d of D) {
    let best = -Infinity, arg = 0
    for (let i = 0; i < ab.length; i++) { const z = shAgg(ab[i], d) - mb[i]; if (z > best) { best = z; arg = i } }
    const ze = ae.map((a, i) => shAgg(a, d) - me[i]), mine = ze[arg]
    if (ze.every(v => v <= mine)) hits++
  } }
const pEthTop = (hits + 1) / 1001
log('calculs')

// ================================================================ 6. rapport
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const pc = (x: number, d = 1) => (Number.isFinite(x) ? fr((100 * x).toFixed(d)) + ' %' : '—')
const tb = (h: string[], rows: (string | number)[][]) => [`| ${h.join(' | ')} |`, `|${h.map((_, k) => (k ? '---' : '---')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)]
const R = Object.fromEntries(res.map(r => [r.id, r]))
const ord = (k: number) => (k === 1 ? '1ᵉʳ' : `${k}ᵉ`)
const L: string[] = []
L.push('# Réévaluation du Sharpe dégonflé de E2, V1 et B2', '',
  `Généré par \`research/fade/v1/dsr-reeval.ts\` (populations : \`audit-e2-population.ts\`), en lecture seule et sans nouvel essai : seules des configurations déjà évaluées sont rejouées. Portefeuille BTC/ETH 50/50, ${T} jours (${P.isoDay(PD0)} → ${P.isoDay(PD1)}), Sharpe annualisés.`, '',
  'Contrôles : les Sharpe publiés des 16 configurations de l\'univers A et des 19 variantes de sortie sont retrouvés à 10⁻⁶ près. Chaque population de candidats, rejouée avec le préréglage, redonne E2 (rôles calme et agité) et V1 au bit près. Le jeu agité n\'a aucun effet sur les trades de V1.', '',
  '## Verdict', '',
  `- **N = 222 et σ = 0,602 ne représentaient pas fidèlement la sélection.** σ venait d'une population qui n'était pas en concurrence avec V1 ; N mélangeait des étapes différentes, comptait des essais sans effet et en oubliait d'autres.`,
  `- **Sharpe absolu, hypothèses justifiées (R2) : E2 ${pc(R.E2.R2.p)}, V1 ${pc(R.V1.R2.p)}, B2 ${pc(R.B2.R2.p)}** (initial : ${pc(R.E2.C.p)}, ${pc(R.V1.C.p)}, ${pc(R.B2.C.p)}). Borne prudente : ${pc(R.E2.sensBoth.p)}, ${pc(R.V1.sensBoth.p)}, ${pc(R.B2.sensBoth.p)}.`,
  `- **Gains : V1 sur E2 ${pc(GAINS[0].R2.p)}, B2 sur V1 ${pc(GAINS[1].R2.p)}** (initial : ${pc(GAINS[0].C.p)}, ${pc(GAINS[1].C.p)}).`,
  `- **Indice indépendant de la sélection :** le jeu calme de V1, choisi sur BTC seul, est aussi le 1ᵉʳ des ${p2.length} jeux possibles sur ETH (probabilité sous le bruit seul : ${n(pEthTop, 3)}).`, '',
  '## 1. Chronologie : qui a réellement participé à la sélection', '',
  ...tb(['date (UTC)', 'commit', 'essais', 'fonction', 'E2', 'V1', 'B2'], [
    ['10-04 16:18', '0c612af', 'premier passage, 54 configurations et test d\'entrées aléatoires', 'diagnostic', 'non', 'non', 'non'],
    ['10-04 20:42', '11e847f', '`regime-wf` : 206 candidats × 3 graines (606 distincts), 15 et 30 min, plusieurs découpages en régimes ; retenu : 15 min, volatilité seule, graine 5, jeu calme n° 178, jeu agité n° 38', '**sélection des réglages**, sur BTC seul', 'oui (jeux calme et agité)', 'oui (jeu calme seul)', 'oui'],
    ['10-06 13:54 → 10-07 03:48', '2112993, fda7113, 8141dee', 'walk-forward sur plateaux, robustesse locale (1 810), surface adaptative M0 → M4 (2 790)', 'validation et challengers : le préréglage n\'est pas modifié', 'non', 'non', 'non'],
    ['10-08 → 10-09', '767f71a … f8e6e93', 'zéro-shot (or, ETH, SOL, TAO), robustesse ETH, falsification A/B/C, alpha résiduel', 'falsification et diagnostic', 'non', 'non', 'non'],
    ['≤ 10-09 00:14', 'c6bb207', 'univers A n° 1 à 7 : six traitements des shorts et E2', '**sélection de E2**', 'oui', 'oui', 'oui'],
    ['10-09', 'c6bb207', 'E2 figée (`e2-forward.md`)', '—', 'figée', '', ''],
    ['10-12 → 10-13 01:43', '8f22c03 … 5229830', 'capacité, exécution, couche probabiliste, anatomie des pertes', 'diagnostic (aucune règle candidate)', 'non (après)', 'non', 'non'],
    ['10-13 01:28 → 02:24', '56a7ac0, 4742db1, 60112a3', 'univers A n° 8 à 16 : modifications de E2 (range, régime agité, invalidation précoce)', '**sélection de V1** (n° 11 retenu)', 'non (après)', 'oui', 'oui'],
    ['10-13 02:42', '40fae7f', 'V1 figée (`calm-only.ts`), avant tout calcul de surajustement', '—', '', 'figée', ''],
    ['10-13 03:03 → 04:27', 'c3fe6a8, 9ddcf35', 'CSCV-PBO, walk-forward, DSR ; robustesse locale de V1', 'diagnostic de la sélection', 'non', 'non (après)', 'non'],
    ['10-13 15:00 → 18:00', '3de57f1 … 2f32b51', 'Shock Fade, multi-horizons (autres stratégies) ; Hawkes / Merton × V1 (2 règles)', 'autres stratégies ; 2 règles candidates pour modifier V1', 'non', 'non (après)', 'oui (2)'],
    ['10-13 19:23', 'eb10895', '11 trailings sur V1', 'candidates pour modifier V1', 'non', 'non (après)', 'oui'],
    ['10-13 20:39', '713d08f', '8 variantes point mort / volume ; 6 contrôles de prix ; 2 rejeux de diagnostic', '**sélection de B2** ; contrôles = falsification ; rejeux = diagnostic', 'non', 'non (après)', 'oui (8) ; non (8)'],
  ]), '',
  `**Ce que le décompte N = 222 (16 + 206) mélangeait.** Il comptait pour V1 les 6 alternatives à E2 antérieures à E2 (pertinentes pour V1 par héritage) et les 9 modifications de E2 (pertinentes), mais aussi le jeu agité, sans effet sur V1. Il omettait les graines 9 et 13 (400 candidats de plus), le choix de la procédure (horizon, découpage) et, pour B2, les 21 tentatives d'amélioration de V1. `
  + 'Il ne distinguait pas des choix successifs (paramètres, puis structure, puis sorties), qui ne se multiplient pas : chacun ajoute sa propre inflation.', '',
  '## 2. Nombre effectif d\'essais et dispersion σ', '',
  'Pour chaque étape de sélection : N = alternatives réellement en concurrence ; σ = écart type de leurs Sharpe (portefeuille) ; ρ̄ = corrélation moyenne de leurs rendements quotidiens ; N spectral = N² / Σ corrélations². '
  + '**Inflation attendue** = maximum attendu du bruit d\'estimation parmi ces alternatives, mesuré par bootstrap joint par mois (2 000 tirages ; mêmes mois pour toutes les alternatives, donc corrélations et queues épaisses conservées). '
  + 'Si la sélection s\'est faite sur BTC seul, on retient l\'alternative au plus grand bruit sur BTC et on mesure son bruit sur le portefeuille. N équivalent = nombre d\'essais indépendants qui donnerait la même inflation.', '',
  ...tb(['étape', 'N', 'σ des Sharpe', 'ρ̄', 'N spectral', 'erreur type d\'un Sharpe', 'inflation attendue (bootstrap)', 'N équivalent', 'inflation, formule DSR (σ, N bruts)', 'biais propre du bootstrap'],
    Object.values(STAGES).map(s => { const x = ST[s.id]; return [s.label, x.n, n(x.sd, 3), n(x.rho), n(x.nPR, 1), n(x.se, 3), n(x.mean, 3), n(x.nImp, 0), n(x.sd * emax(x.n), 3), n(x.bias, 3)] })), '',
  `- **σ = 0,602 ne représente pas les opportunités de V1.** Il venait des 206 candidats de la graine 5 rejoués « tels quels » (un seul jeu, tous régimes, sans E2) : Sharpe moyen −0,25, maximum 1,18. Rejoués comme V1 (même structure), les 606 jeux possibles ont σ = ${n(ST.Pv.sd, 3)}. `
  + `Et une partie de cette dispersion est réelle, pas du bruit : l'erreur type d'un Sharpe vaut ${n(ST.Pv.se, 3)} et les jeux sont corrélés (ρ̄ ${n(ST.Pv.rho)}).`,
  `- **Le jeu de V1 est hors norme, y compris là où il n'a pas été choisi.** Parmi les ${p2.length} jeux calmes possibles, le n° 178 est 1ᵉʳ sur le portefeuille (${n(SR(V1s))}), ${ord(rankBtc)} sur BTC (données de la sélection) et ${ord(rankEth)} sur ETH, actif jamais utilisé pour le choisir. `
  + `Sous le bruit seul, la probabilité que le jeu choisi sur BTC soit aussi le premier sur ETH vaut ${n(pEthTop, 4)} (bootstrap, corrélations BTC / ETH comprises). Corrélation de rang BTC / ETH entre jeux : ${n(spearmanBE)}. `
  + `Cinq meilleurs (portefeuille, BTC, ETH) : ${top.map(t => `${n(t.sr)} / ${n(t.btc)} / ${n(t.eth)}`).join(' ; ')}.`, '',
  '## 3. Sharpe dégonflé', '',
  '- **C (conservateur initial)** : un seul maximum sur N = 222 essais, σ = 0,602.',
  '- **R1 (comptes fidèles, estimateur standard)** : somme, sur les étapes de la version, de σ × maximum attendu de N essais indépendants (σ et N bruts de chaque étape, sélection supposée faite sur le portefeuille).',
  '- **R2 (hypothèses justifiées)** : somme des inflations attendues mesurées par bootstrap (hypothèse nulle du DSR : aucune différence réelle entre alternatives d\'une même étape ; corrélations réelles ; paramètres choisis sur BTC). '
  + 'Sensibilités de R2 : jeux de paramètres choisis comme si la sélection portait sur le portefeuille (et non sur BTC seul) ; choix de la procédure (2 horizons × découpages, non rejouables ici) compté comme 7 fois plus d\'essais indépendants pour les jeux de paramètres ; les deux à la fois.', '',
  ...tb(['version', 'Sharpe', 'PSR(0)', 'C : N = 222, σ = 0,602', 'R1', '**R2**', 'R2, sélection sur le portefeuille', 'R2, × 7 procédures', 'R2, les deux', 'C à N = 6 266 / 128 547'],
    res.map(r => [r.id, n(r.sr), pc(r.psr0, 2), `${pc(r.C.p)} (seuil ${n(r.C.sr0)})`, `${pc(r.R1.p)} (seuil ${n(r.R1.sr0)})`, `**${pc(r.R2.p)}** (seuil ${n(r.R2.sr0)})`,
      `${pc(r.sensPort.p)} (seuil ${n(r.sensPort.sr0)})`, `${pc(r.sensProc.p)} (seuil ${n(r.sensProc.sr0)})`, `${pc(r.sensBoth.p)} (seuil ${n(r.sensBoth.sr0)})`, `${pc(r.C6266)} / ${pc(r.C128k)}`])), '',
  `Décomposition du seuil R2 (inflation par étape) : ${res.map(r => `${r.id} = ${r.terms.map(t => `${t.stage} ${n(t.r2)}`).join(' + ')}`).join(' ; ')}. Étapes : Pc / Pa / Pv = jeux de paramètres, S2 = règle E2, S1 = V1, SB = B2.`, '',
  '**Gains d\'une étape sur la précédente**', '',
  ...tb(['gain', 'ratio d\'information', 'PSR(0)', 'C (initial)', 'R1 (comptes fidèles)', 'R2 (bootstrap)', 'N équivalent (R2)'],
    GAINS.map(g => [g.id, n(g.ir, 3), pc(g.psr0), `${pc(g.C.p)} (N ${g.C.N}, σ ${n(g.C.sd, 3)})`, `${pc(g.R1.p)} (N ${g.R1.N}, σ ${n(g.R1.sd, 3)})`, `**${pc(g.R2.p)}** (seuil ${n(g.R2.sr0, 3)})`, n(g.R2.nImp, 1)])), '',
  'Gain V1 − E2 : alternatives à E2 au moment du choix de V1 (n° 8 à 16) ; les n° 1 à 6, antérieures à E2, avaient perdu contre E2 et ne sont pas des alternatives au gain. Gain B2 − V1 : les 19 variantes de sortie et les 2 règles Hawkes.', '')
// Holm et DSR : z requis selon la correction, à hypothèses égales (essais indépendants, σ = bruit)
const zReq = [1, 8, 21, 222, 606].map(N => ({ N, bonf: normInv(1 - 0.05 / N), dsr: emax(N) + normInv(0.95), fwer: 1 - Math.pow(1 - (1 - normCdf(emax(N) + normInv(0.95))), N) }))
const bootB2 = BV.configs.find((c: any) => c.id === 'B2').boot.port
const gB2 = GAINS[1], gV1 = GAINS[0]
L.push('## 4. Holm et DSR', '',
  `- **Un seul test : même verdict.** Bootstrap par mois du ΔSharpe de B2 : p brut ${n(bootB2.p, 4)} (plancher de résolution du bootstrap) ; PSR(0) de la série d'écart B2 − V1 : ${pc(gB2.psr0)}.`,
  '- **Deux corrections différentes.** Holm ou Bonferroni contrôlent la probabilité d\'au moins un faux positif parmi N essais. Le DSR à 95 % exige de dépasser le maximum **attendu** de N essais nuls, puis encore 1,645 erreur type : il équivaut à un risque global bien inférieur à 5 %.', '',
  ...tb(['N', 'z requis, Bonferroni 5 %', 'z requis, DSR 95 %', 'risque global équivalent au DSR 95 %'], zReq.map(r => [r.N, n(r.bonf), n(r.dsr), pc(r.fwer, 2)])), '',
  `- **Pour B2, une fois les hypothèses corrigées, les deux convergent.** Holm sur les 8 variantes : p ${n(bootB2.pHolm, 3)} ; Bonferroni sur les 21 tentatives réelles : ${n(Math.min(1, 21 * bootB2.p), 3)} ; DSR du gain (R2, N équivalent ${n(gB2.R2.nImp, 1)}) : ${pc(gB2.R2.p)}. `
  + 'L\'écart entre 99 % et 64,9 % venait surtout de σ (dispersion de règles réellement différentes, prise pour du bruit) et du critère plus strict du DSR, pas d\'une sélection massive.', '',
  '## 5. Réponse : N = 222 et σ = 0,602 représentent-ils les opportunités de sélection ?', '',
  `- **Non, pour σ.** 0,602 mesure la dispersion d'une population qui n'était pas en concurrence avec V1 : des jeux rejoués seuls, sans structure de régime ni filtre E2 (Sharpe moyen −0,25). Parmi les jeux réellement substituables au jeu de V1, σ = ${n(ST.Pv.sd, 3)}. Sous l'hypothèse nulle du DSR, la dispersion pertinente est celle du bruit, ≈ ${n(ST.Pv.se, 2)}.`,
  `- **Non, pour N, et dans les deux sens.** Le décompte gonflait certaines étapes : le jeu agité est sans effet sur V1, les variantes de structure sont corrélées à 0,85 – 0,94 (≈ 2 essais indépendants chacune) et les paramètres ont été choisis sur BTC seul. Il en oubliait d'autres : les graines 9 et 13 (400 candidats), le choix de l'horizon et du découpage, les 21 tentatives d'amélioration de V1 pour B2. `
  + `Compter fidèlement en supposant les essais indépendants (R1) ne rend pas le DSR plus favorable (E2 ${pc(R.E2.R1.p)}, V1 ${pc(R.V1.R1.p)}, B2 ${pc(R.B2.R1.p)}) : c'est la mesure des corrélations, du niveau de bruit et du critère de sélection (BTC) qui change la conclusion.`,
  `- **Avec les hypothèses justifiées (R2)**, le seuil dû à la sélection vaut ${n(R.E2.R2.sr0)} pour E2, ${n(R.V1.R2.sr0)} pour V1 et ${n(R.B2.R2.sr0)} pour B2, contre 1,69 dans le scénario initial ; les trois DSR sont proches de 100 %. `
  + `Borne prudente (sélection supposée faite sur le portefeuille et 7 fois plus de procédures) : E2 ${pc(R.E2.sensBoth.p)}, V1 ${pc(R.V1.sensBoth.p)}, B2 ${pc(R.B2.sensBoth.p)}.`,
  `- **Les gains restent la question ouverte.** V1 sur E2 : ${pc(gV1.R2.p)} (initial ${pc(gV1.C.p)}). B2 sur V1 : ${pc(gB2.R2.p)} (initial ${pc(gB2.C.p)}), sous 95 % : B2 reste une candidate exploratoire.`, '',
  '## 6. Limites', '',
  '- Seuls les essais enregistrés dans le dépôt sont comptés ; des essais antérieurs non tracés (réglages essayés à la main sur TradingView) ne peuvent pas l\'être. La sensibilité « × 7 procédures » en couvre une partie.',
  '- Le critère réel de choix des jeux (t-stat des trades en régime calme ou agité sur BTC 2017 → 2026, minimum des deux moitiés) est approché par le Sharpe de la sleeve BTC sur la fenêtre 2018-09 → 2026-09. Une partie de la sélection portait sur 2017-2018, hors de la fenêtre mesurée : l\'inflation transmise est plutôt surestimée.',
  '- Les challengers de la surface adaptative (M1 à M4) et le walk-forward sur plateaux n\'ont pas modifié le préréglage : ils sont classés validation. Les compter comme sélection ajouterait une petite étape, du même ordre que S2 (≈ 0,15).',
  '- L\'hypothèse nulle du DSR (aucune différence réelle entre essais d\'une même étape) est elle-même prudente quand les essais diffèrent réellement, ce que montre σ > erreur type.',
  '- Le N spectral (participation des valeurs propres) sous-estime le nombre d\'essais indépendants pour un problème de maximum ; il est donné à titre indicatif. Le N équivalent vient du bootstrap.',
  '- Tout repose sur le même historique, déjà utilisé pour développer E2, V1 et B2 : seule une validation prospective tranchera.', '')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n'))
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ T, stages: Object.fromEntries(Object.entries(ST).map(([k, v]) => [k, { n: v.n, sd: v.sd, rho: v.rho, nPR: v.nPR, se: v.se, mean: v.mean, nImp: v.nImp }])), stPort: STp,
  versions: res, gains: GAINS, outOfSelection: { rankBtc, rankEth, n: p2.length, pEthTop, spearmanBE, top } },
(_, x) => (x instanceof Float64Array ? undefined : typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(8) : String(x)) : x), 1) + '\n')
log('rapport')
