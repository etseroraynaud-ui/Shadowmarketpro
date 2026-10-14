// Audit méthodologique du Sharpe dégonflé : nombre effectif d'essais (N) et dispersion des essais (σ) qui ont
// conduit à V1 et à B2, et cohérence entre la correction de Holm et le DSR. Aucun nouvel essai : on rejoue les
// configurations déjà évaluées (univers A de calm-only, candidats de regime-wf, variantes de sortie testées sur V1).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/audit-selection.ts
//
// Sortie : research/reports/shock-fade/audit-selection/{report.md, results.json}.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15, measures, rangeAtSignals, referenceAsset, variantInputs } from '../../lib/regime-er.ts'
import type { Asset, Variant } from '../../lib/regime-er.ts'
import { loadSleeve } from '../../lib/frozen-shock.ts'
import type { SleeveKey } from '../../lib/frozen-shock.ts'
import { dailyOf, simulateSized } from '../../lib/variant-eval.ts'
import { simulateEarlyExit } from '../../lib/early-exit.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../../lib/calm-only.ts'
import { EULER, dsr, moments, normCdf, normInv, psr, sharpe } from '../../lib/overfit.ts'
import { candidates } from '../../shock/regime-wf.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import type { Market } from '../../../lib/strategies/shock/market.ts'
import { DEFAULT_PARAMS, withParams } from '../../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import { simulateTrail } from './trail-sim.ts'
import type { TrailSpec } from './trail-broker.ts'

const ROOT = join(import.meta.dirname, '../../..')
const OUT = join(ROOT, 'research/reports/shock-fade/audit-selection')
const DAY = 864e5, ANNF = Math.sqrt(P.ANN)
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const fail = (m: string) => { throw new Error(`contrôle en échec : ${m}`) }
const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))

const BTC = referenceAsset('btc'), ETH = referenceAsset('ethusdt'), A = [BTC, ETH]
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const sleeves = (eq: Float64Array[]) => A.map((a, j) => dailyOf(a.bars, eq[j], a.lo, a.end, PD0, PD1).r)
const book = (eq: Float64Array[]) => { const s = sleeves(eq); return P.book(s[0], s[1]).r }
const T = PD1 - PD0 + 1
const SR = (x: number[]) => sharpe(x) * ANNF

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
  [1, 'v1 live', a => sim(a, RAW.get(a.key)!)], [2, 'shorts symétrie bougie', a => seShort(a, MASKS.get(a.key)!.V1)], [3, 'shorts tendance 60 min', a => seShort(a, MASKS.get(a.key)!.V2)],
  [4, 'shorts V1 + V2', a => seShort(a, MASKS.get(a.key)!.V3)], [5, 'sans shorts', a => seShort(a, MASKS.get(a.key)!.V4)], [6, 'shorts lambda + volume', a => seShort(a, MASKS.get(a.key)!.E1)],
  [7, 'E2', a => sim(a, a.signals)], [8, 'E2 range retiré', rf('V1')], [9, 'E2 confirmation en range', rf('V2')], [10, 'E2 sorties agitées en range', rf('V3')],
  [11, 'V1', a => sim(a, calmOnly(a.signals, a.select))], [12, 'E2 stop agité, taille', ag(false)], [13, 'E2 stop agité, risque', ag(true)],
  [14, 'E2 invalidation 4', ei(4)], [15, 'E2 invalidation 2', ei(2)], [16, 'E2 invalidation 8', ei(8)],
]
const CO = json('research/reports/calm-only/calm-only.json')
const SA = UA.map(([id, , run]) => {
  const x = book(A.map(run))
  const pub = CO.configurations.find((c: any) => c.id === id).sharpe
  if (Math.abs(SR(x) - pub) > 1e-6) fail(`univers A n° ${id} : ${SR(x)} ≠ ${pub}`)
  return x
})
const I_E2 = 6, I_V1 = 10
if (Math.abs(SR(SA[I_V1]) - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) > 1e-6) fail('Sharpe V1')
log('univers A : 16 Sharpe publiés retrouvés')

// ================================================================ 2. candidats de regime-wf rejoués « comme V1 »
// Jeu calme = candidat ; entrées = signaux d'impulsion du jeu calme sur les bougies en régime calme, shorts limités
// au régime baissier (E2), bougie qui suit un trou exclue (loadSleeve) ; sorties et coûts de V1. Le jeu agité n'a
// aucun effet sur V1 (vérifié) : V1 ne dépend que du choix du jeu calme. Contrôle : le candidat n° 178 de la graine
// 5 (jeu calme de V1) redonne V1 au bit près.
function asV1(a: Asset, p: ShockParams) {
  const R = prepare(a.m, p), t = a.bars.t, n = a.bars.n
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = a.lo; i <= a.end; i++) {
    if (a.select[i] !== 0 || (i > 0 && t[i] - t[i - 1] > M15)) continue
    if (p.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (p.allowShort && R.impulseEntryShort[i] && a.trend[i]) short[i] = 1
  }
  const r = simulate(a.m, [p, p], a.costs(1), a.lo, a.end, a.select, { long, short })
  a.m.memo.clear()
  return r.equity
}
const keyOf = (p: ShockParams) => JSON.stringify(p)
const POP: { seed: number; idx: number; port: number[]; btc: number; eth: number }[] = []
const seen = new Set<string>()
for (const seed of [5, 9, 13]) {
  for (const [idx, c] of candidates(200, seed).entries()) {
    const p = withParams(DEFAULT_PARAMS, c.over)
    if (seen.has(keyOf(p))) continue
    seen.add(keyOf(p))
    const eq = A.map(a => asV1(a, p)), sl = sleeves(eq)
    POP.push({ seed, idx, port: P.book(sl[0], sl[1]).r, btc: SR(sl[0]), eth: SR(sl[1]) })
  }
  log(`graine ${seed} : ${POP.length} candidats distincts`)
}
const iSel = POP.findIndex(c => c.seed === 5 && c.idx === 178)
if (POP[iSel].port.some((x, t) => x !== SA[I_V1][t])) fail('candidat 178 rejoué comme V1 ≠ V1')
const STORED = CO.universeB.sharpe as number[] // 206 candidats de la graine 5, rejoués « tels quels » par calm-only (σ = 0,602)

// ================================================================ 3. variantes de sortie testées sur V1 (19)
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
const iB2 = EXITS.findIndex(e => e[0] === 'B2')
const BV = json('research/reports/shock-fade/v1-be-volume/results.json')
if (Math.abs(SR(SX[iB2]) - BV.configs.find((c: any) => c.id === 'B2').full.sharpe) > 1e-6) fail('Sharpe B2')
const TR = json('research/reports/shock-fade/v1-trailing/results.json')
for (const [k, [id]] of EXITS.entries()) {
  const ref = k < 11 ? TR.variants.find((v: any) => v.id === id)?.full.sharpe : BV.configs.find((c: any) => c.id === id)?.full.sharpe
  if (ref === undefined || Math.abs(SR(SX[k]) - ref) > 1e-6) fail(`Sharpe ${id}`)
}
log('19 variantes de sortie : Sharpe publiés retrouvés')

// ================================================================ 4. outils
/** Valeurs propres d'une matrice symétrique (Jacobi cyclique). */
function eigSym(M: Float64Array, n: number): number[] {
  const a = Float64Array.from(M)
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] ** 2
    if (off < 1e-20) break
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      const apq = a[p * n + q]
      if (Math.abs(apq) < 1e-14) continue
      const th = (a[q * n + q] - a[p * n + p]) / (2 * apq)
      const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c
      for (let k = 0; k < n; k++) { const x = a[k * n + p], y = a[k * n + q]; a[k * n + p] = c * x - s * y; a[k * n + q] = s * x + c * y }
      for (let k = 0; k < n; k++) { const x = a[p * n + k], y = a[q * n + k]; a[p * n + k] = c * x - s * y; a[q * n + k] = s * x + c * y }
    }
  }
  return Array.from({ length: n }, (_, i) => a[i * n + i]).sort((x, y) => y - x)
}
/** Corrélations, corrélation moyenne et trois estimations du nombre effectif d'essais indépendants. */
function neff(series: number[][]) {
  const xs = series.filter(x => moments(x).sd > 0), n = xs.length
  const z = xs.map(x => { const m = moments(x); return x.map(v => (v - m.mean) / m.sd) })
  const C = new Float64Array(n * n)
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { let s = 0; for (let t = 0; t < T; t++) s += z[i][t] * z[j][t]; C[i * n + j] = C[j * n + i] = s / T }
  let off = 0, fro = 0
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { fro += C[i * n + j] ** 2; if (i !== j) off += C[i * n + j] }
  const rho = off / (n * (n - 1))
  const ev = eigSym(C, n)
  if (Math.abs(P.sum(ev) - n) > 1e-6 * n || Math.abs(P.sum(ev.map(v => v * v)) - fro) > 1e-6 * fro) fail('valeurs propres')
  const lamPlus = (1 + Math.sqrt(n / T)) ** 2
  return { n, rho, nRho: rho + (1 - rho) * n, nPR: (n * n) / fro, nMP: ev.filter(v => v > lamPlus).length, lamPlus, top: ev.slice(0, 3).map(v => v / n) }
}
/** Erreur type d'un Sharpe journalier estimé (Mertens), annualisée. */
const seOf = (x: number[]) => { const m = moments(x), s = m.mean / m.sd; return Math.sqrt((1 - m.skew * s + ((m.kurt - 1) / 4) * s * s) / (x.length - 1)) * ANNF }
const SE0 = ANNF / Math.sqrt(T - 1) // sous l'hypothèse nulle (Sharpe nul) : 1 / √(T − 1), annualisée
const emax = (N: number) => (N <= 1 ? 0 : (1 - EULER) * normInv(1 - 1 / N) + EULER * normInv(1 - 1 / (N * Math.E)))
const D = (x: number[], N: number, sigAnn: number) => dsr(x, N, sigAnn / ANNF).p
const disp = (srs: number[]) => Math.sqrt(P.mean(srs.map(v => (v - P.mean(srs)) ** 2)))

// ================================================================ 5. mesures
const popSR = POP.map(c => SR(c.port)), pop5 = POP.filter(c => c.seed === 5)
const rankOf = (v: number, xs: number[]) => 1 + xs.filter(x => x > v).length
const NA = neff(SA), NP5 = neff(pop5.map(c => c.port)), NP = neff(POP.map(c => c.port))
const dA = SA.filter((_, k) => k !== I_E2).map(x => x.map((v, t) => v - SA[I_E2][t]))
const NdA = neff(dA)
const dX = SX.map(x => x.map((v, t) => v - SA[I_V1][t]))
const N8 = neff(dX.slice(11)), N19 = neff(dX), N11 = neff(dX.slice(0, 11))
const irX = dX.map(SR)
const V1s = SA[I_V1], B2s = SX[iB2], dB2 = dX[iB2]
const fam = {
  A: { label: 'univers A (16 configurations proches de E2)', sr: SA.map(SR), ne: NA },
  proxy: { label: 'candidats graine 5, rejoués « tels quels » (calm-only)', sr: STORED },
  pop5: { label: 'candidats graine 5, rejoués comme V1', sr: pop5.map(c => SR(c.port)), ne: NP5 },
  pop: { label: 'candidats graines 5, 9, 13 (distincts), rejoués comme V1', sr: popSR, ne: NP },
}
const famRow = (f: { label: string; sr: number[]; ne?: ReturnType<typeof neff> }, se: number) => ({ label: f.label, n: f.sr.length, mean: P.mean(f.sr), sd: disp(f.sr), max: Math.max(...f.sr), se, ne: f.ne,
  noiseShare: f.ne ? Math.min(1, ((1 - f.ne.rho) * se * se) / disp(f.sr) ** 2) : NaN })
const SEpop = Math.sqrt(P.mean(POP.map(c => seOf(c.port) ** 2)))
const FAM = [famRow(fam.A, Math.sqrt(P.mean(SA.map(x => seOf(x) ** 2)))), famRow(fam.proxy, NaN), famRow(fam.pop5, SEpop), famRow(fam.pop, SEpop)]
const sel = { port: rankOf(SR(V1s), popSR), btc: rankOf(POP[iSel].btc, POP.map(c => c.btc)), eth: rankOf(POP[iSel].eth, POP.map(c => c.eth)), n: POP.length,
  port5: rankOf(SR(V1s), fam.pop5.sr), btc5: rankOf(POP[iSel].btc, pop5.map(c => c.btc)), eth5: rankOf(POP[iSel].eth, pop5.map(c => c.eth)), n5: pop5.length, btcSR: POP[iSel].btc, ethSR: POP[iSel].eth }

// DSR absolus : grille N × σ
const sdPop = disp(popSR)
const Ngrid = [
  { lab: '16 (univers A)', N: 16 }, { lab: '222 (pré-enregistré)', N: 222 }, { lab: `${POP.length} (calmes possibles, 3 graines)`, N: POP.length },
  { lab: `${POP.length + 16 + 19} (+ univers A + sorties)`, N: POP.length + 16 + 19 }, { lab: '6 266 (tout ce qui a été évalué)', N: 6266 },
  { lab: `N effectif ρ̄ (${NP.nRho.toFixed(0)})`, N: NP.nRho }, { lab: `N effectif spectral (${NP.nPR.toFixed(0)})`, N: NP.nPR }, { lab: `facteurs hors bruit (${NP.nMP})`, N: NP.nMP },
]
const Sgrid = [{ lab: 'σ = 0,602 (pré-enregistré)', s: CO.dsr.sdB }, { lab: `σ des calmes possibles (${sdPop.toFixed(3)})`, s: sdPop }, { lab: `σ du bruit seul (${SE0.toFixed(3)})`, s: SE0 }]
const gridAbs = (x: number[]) => Ngrid.map(g => ({ ...g, p: Sgrid.map(s => D(x, g.N, s.s)) }))
const GV1 = gridAbs(V1s), GB2 = gridAbs(B2s)

// Gain B2 − V1 : grille N × σ, et comparaison avec Holm
const sd8 = disp(irX.slice(11)), sd19 = disp(irX)
const NgG = [{ lab: '8 (étude point mort / volume)', N: 8 }, { lab: '19 (+ 11 trailings)', N: 19 }, { lab: `N effectif spectral des 8 (${N8.nPR.toFixed(1)})`, N: N8.nPR }, { lab: `N effectif spectral des 19 (${N19.nPR.toFixed(1)})`, N: N19.nPR }]
const SgG = [{ lab: `σ des 8 (${sd8.toFixed(3)}, utilisé)`, s: sd8 }, { lab: `σ des 19 (${sd19.toFixed(3)})`, s: sd19 }, { lab: `σ du bruit seul (${SE0.toFixed(3)})`, s: SE0 }]
const GG = NgG.map(g => ({ ...g, p: SgG.map(s => D(dB2, g.N, s.s)) }))
const pz = psr(dB2, 0), bootB2 = BV.configs.find((c: any) => c.id === 'B2').boot.port
const zBoot = bootB2.est / ((bootB2.hi - bootB2.lo) / (2 * 1.959964))
const zReq = [1, 8, 19, 222, 606].map(N => ({ N, bonf: normInv(1 - 0.05 / N), sidak: normInv(Math.pow(0.95, 1 / N)), dsr: emax(N) + normInv(0.95), fwerOfDsr: 1 - Math.pow(normCdf(emax(N) + normInv(0.95)), N) }))
// Gain V1 − E2 (univers A)
const irA = dA.map(SR), sd15 = disp(irA), dV1 = dA[I_V1 - 1]
const GA = [{ lab: '15 (pré-enregistré)', N: 15 }, { lab: `N effectif spectral (${NdA.nPR.toFixed(1)})`, N: NdA.nPR }].map(g => ({ ...g, p: [sd15, SE0].map(s => D(dV1, g.N, s)) }))

// ================================================================ 6. rapport
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : '—')
const pc = (x: number, d = 1) => (Number.isFinite(x) ? fr((100 * x).toFixed(d)) + ' %' : '—')
const tb = (h: string[], rows: (string | number)[][]) => [`| ${h.join(' | ')} |`, `|${h.map((_, k) => (k ? '---:' : '---')).join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`)]
const L: string[] = []
L.push('# Audit du Sharpe dégonflé : nombre effectif d\'essais, dispersion σ, cohérence avec Holm', '',
  `Généré par \`research/fade/v1/audit-selection.ts\`, en lecture seule, sans nouvel essai : rejeu des configurations déjà évaluées. Portefeuille BTC/ETH 50/50, ${T} jours (${P.isoDay(PD0)} → ${P.isoDay(PD1)}), Sharpe annualisés.`, '',
  'Contrôles : les 16 Sharpe de l\'univers A, ceux des 19 variantes de sortie (dont B2) et le Sharpe de V1 sont retrouvés à 10⁻⁶ ; le candidat n° 178 de la graine 5, rejoué comme V1, redonne V1 au bit près ; '
  + 'le jeu agité n\'a aucun effet sur les trades de V1 (vérifié séparément : mêmes positions avec le jeu calme à sa place).', '',
  '## 1. Ce qui a réellement été sélectionné pour arriver à V1', '',
  '- V1 = E2 sans entrée en régime agité. **Ses trades ne dépendent que du jeu calme** (n° 178 de la graine 5 de `regime-wf.ts`, choisi sur BTC seul, par le t-stat des trades en régime calme sur les deux moitiés de l\'entraînement), du filtre E2 des shorts et de la règle « calme seul ». '
  + 'Le jeu agité (n° 38) ne joue aucun rôle : la borne N = 128 547 (paires calme × agité) ne s\'applique pas à V1.',
  '- Les opportunités de sélection sont donc : le choix du jeu calme parmi les candidats (206 par graine, 3 graines, une retenue), puis les choix de structure (univers A : filtre E2, calme seul, etc.), puis, pour B2, les variantes de sortie testées sur V1 (11 trailings + 8 point mort / volume).',
  '- Les 6 266 configurations « évaluées » comprennent des voisinages de robustesse, des diagnostics et des surfaces qui n\'ont pas remplacé le préréglage : ce ne sont pas toutes des opportunités de sélection de V1.', '',
  '## 2. Dispersion σ et nombre effectif d\'essais', '',
  'σ = écart type des Sharpe des essais. Erreur type = bruit d\'estimation d\'un Sharpe sur la période (formule de Mertens, asymétrie et kurtosis comprises). '
  + 'Part due au bruit = (1 − ρ̄) × erreur type² / σ² : sous l\'hypothèse nulle du DSR (essais sans différence réelle), elle vaudrait 100 %. '
  + 'N effectif : ρ̄ + (1 − ρ̄) N (Bailey et López de Prado) ; spectral = N² / Σ corrélations² ; facteurs hors bruit = valeurs propres au-dessus de la borne de Marchenko-Pastur.', '',
  ...tb(['famille d\'essais', 'N', 'Sharpe moyen', 'σ', 'max', 'erreur type', 'part due au bruit', 'corrélation moyenne ρ̄', 'N effectif (ρ̄)', 'N effectif (spectral)', 'facteurs hors bruit'],
    FAM.map(f => [f.label, f.n, n(f.mean), n(f.sd, 3), n(f.max), n(f.se, 3), pc(f.noiseShare, 0), f.ne ? n(f.ne.rho, 2) : '—', f.ne ? n(f.ne.nRho, 0) : '—', f.ne ? n(f.ne.nPR, 1) : '—', f.ne ? f.ne.nMP : '—'])), '',
  `- Rang du jeu de V1 parmi les ${sel.n} calmes possibles (rejoués comme V1) : **${sel.port}ᵉ** sur le Sharpe du portefeuille (${n(SR(V1s))}), ${sel.btc}ᵉ sur la sleeve BTC (${n(sel.btcSR)}, données de la sélection), ${sel.eth}ᵉ sur la sleeve ETH (${n(sel.ethSR)}, non utilisée pour le choisir). `
  + `Graine 5 seule (${sel.n5}) : ${sel.port5}ᵉ, ${sel.btc5}ᵉ, ${sel.eth5}ᵉ.`,
  `- Variantes de sortie testées sur V1 (séries d'écart à V1) : 8 de l'étude point mort / volume, ρ̄ ${n(N8.rho)}, N effectif spectral ${n(N8.nPR, 1)} ; 11 trailings, ${n(N11.nPR, 1)} ; les 19, ${n(N19.nPR, 1)}. `
  + `σ des ratios d'information : 8 → ${n(sd8, 3)}, 19 → ${n(sd19, 3)} ; erreur type d'un ratio d'information nul : ${n(SE0, 3)}.`,
  `- Univers A, séries d'écart à E2 (gain V1 − E2) : ρ̄ ${n(NdA.rho)}, N effectif spectral ${n(NdA.nPR, 1)} pour 15 ; σ des ratios d'information ${n(sd15, 3)}.`, '',
  '## 3. Sharpe dégonflé selon les hypothèses', '',
  '**V1** (Sharpe ' + n(SR(V1s)) + ')', '',
  ...tb(['N', ...Sgrid.map(s => s.lab)], GV1.map(g => [g.lab, ...g.p.map(p => pc(p))])), '',
  '**B2** (Sharpe ' + n(SR(B2s)) + ')', '',
  ...tb(['N', ...Sgrid.map(s => s.lab)], GB2.map(g => [g.lab, ...g.p.map(p => pc(p))])), '',
  `**Gain B2 − V1** (ratio d'information ${n(SR(dB2), 3)}, PSR(0) ${pc(pz.p)}, asymétrie ${n(pz.skew)}, kurtosis ${n(pz.kurt, 0)})`, '',
  ...tb(['N', ...SgG.map(s => s.lab)], GG.map(g => [g.lab, ...g.p.map(p => pc(p))])), '',
  `**Gain V1 − E2** (ratio d'information ${n(SR(dV1), 3)})`, '',
  ...tb(['N', `σ des 15 (${n(sd15, 3)}, utilisé)`, `σ du bruit seul (${n(SE0, 3)})`], GA.map(g => [g.lab, ...g.p.map(p => pc(p))])), '',
  '## 4. Holm et DSR mesurent-ils la même chose ?', '',
  `- **Preuve d'un seul test, cohérente.** Bootstrap par mois du ΔSharpe de B2 : p brut ${n(bootB2.p, 4)} (plancher de résolution : 2 / 2 001, aucun tirage ≤ 0 sur 2 000 sauf un), z ≈ ${n(zBoot)} ; PSR(0) de la série d'écart : ${pc(pz.p)}, z = ${n(pz.z)}. Les deux disent la même chose.`,
  `- **Correction multiple, de nature différente.** Holm (ou Bonferroni) contrôle la probabilité d'au moins un faux positif parmi N ; le DSR exige que le Sharpe dépasse le maximum **attendu** de N essais nuls, puis encore 1,645 erreur type pour atteindre 95 %. À hypothèses égales (essais indépendants, σ = bruit), le DSR à 95 % est donc nettement plus exigeant :`, '',
  ...tb(['N', 'z requis, Bonferroni 5 %', 'z requis, Šidák 5 %', 'z requis, DSR 95 % (σ = bruit)', 'risque global équivalent au DSR 95 %'],
    zReq.map(r => [r.N, n(r.bonf), n(r.sidak), n(r.dsr), pc(r.fwerOfDsr, 2)])), '',
  `- **D'où vient l'écart pour B2.** Avec les hypothèses de l'étude (N = 8, σ = ${n(sd8, 3)}), DSR ${pc(GG[0].p[0])}. Remplacer σ par le bruit seul (N = 8) : ${pc(GG[0].p[2])}. Avec le N effectif des 8 : ${pc(GG[2].p[2])}. En comptant aussi les 11 trailings (N = 19, σ = bruit) : ${pc(GG[1].p[2])}, N effectif ${pc(GG[3].p[2])}. `
  + `Holm sur 8 : p ${n(bootB2.pHolm, 3)} ; Bonferroni sur 19 avec le même p brut : ${n(Math.min(1, 19 * bootB2.p), 3)}.`, '')
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n'))
log('rapport')
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ T, fam: FAM.map(f => ({ ...f })), sel, neff: { A: NA, pop5: NP5, pop: NP, dA: NdA, d8: N8, d11: N11, d19: N19 }, sd: { proxy: CO.dsr.sdB, pop: sdPop, se0: SE0, sd8, sd19, sd15 },
  irX: Object.fromEntries(EXITS.map(([id], k) => [id, irX[k]])), gridV1: GV1, gridB2: GB2, gridGain: GG, gridGainV1: GA, zReq, bootB2, psrGain: pz },
(_, x) => (typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(8) : String(x)) : x), 1) + '\n')
