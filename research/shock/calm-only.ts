// V1-calme figée : surajustement de sélection (research/preregistration/calm-only.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/calm-only.ts
//
// Les 16 configurations réellement rejouées en portefeuille BTC/ETH (univers A) sont rejouées à
// nouveau et doivent redonner leur Sharpe publié ; puis CSCV-PBO, walk-forward chronologique et
// Sharpe dégonflé, absolu et du gain sur E2. Les 206 candidats de la recherche des réglages
// (univers B) ne servent qu'à l'écart type des essais du DSR. Moteur non modifié. Sorties :
// research/reports/calm-only/.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, measures, rangeAtSignals, referenceAsset, variantInputs } from '../lib/regime-er.ts'
import type { Asset, Variant } from '../lib/regime-er.ts'
import { loadSleeve } from '../lib/frozen-shock.ts'
import type { SleeveKey } from '../lib/frozen-shock.ts'
import { dailyOf, simulateSized } from '../lib/variant-eval.ts'
import { simulateEarlyExit } from '../lib/early-exit.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../lib/calm-only.ts'
import { cscv, dsr, expectedMaxSharpe, moments, psr, sharpe, walkForward } from '../lib/overfit.ts'
import { candidates } from './regime-wf.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Market } from '../../lib/strategies/shock/market.ts'
import { DEFAULT_PARAMS, withParams } from '../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/calm-only')
const PLAN = 'research/preregistration/calm-only.md'
const DAY = 864e5
const SEED = 20261013, BOOT = 5000
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }
const ANNF = Math.sqrt(P.ANN)

const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha(readFileSync(join(ROOT, f))) === h, f)

// ================================================================ actifs et masques des shorts (étude des shorts)
const BTC = referenceAsset('btc'), ETH = referenceAsset('ethusdt')
const RAW = new Map<string, EntryOverride>([[BTC.key, loadSleeve(BTC.sleeveKey as SleeveKey).signals], [ETH.key, loadSleeve(ETH.sleeveKey as SleeveKey).signals]])
const memoGet = (m: Market, key: string) => { const v = m.memo.get(key); if (!v) throw new Error(`série ${key} absente du cache du moteur`); return v }

/** Masques des shorts de research/shock/short-entry-study.ts (V1 bougie, V2 tendance 60 min, V3, E1), sur les shorts v1. */
function shortMasks(a: Asset) {
  const { m, preset, select, lo, end } = a
  const { o, h, l, c } = m.bars
  const n = m.bars.n
  const raw = RAW.get(a.key)!.short
  const prs = preset.sets.map(p => prepare(m, p))
  const htfPrev = preset.sets.map(p => memoGet(m, `htfPrev:${p.htfMinutes}:${p.htfEmaLen}:${p.htfSlopeMode}:${p.htfSlopeBars}`) as Float64Array)
  const out = { V1: new Uint8Array(n), V2: new Uint8Array(n), V3: new Uint8Array(n), V4: new Uint8Array(n), E1: new Uint8Array(n) }
  for (let i = lo; i <= end; i++) {
    if (!raw[i]) continue
    const e = select[i]
    const p = preset.sets[e], R = prs[e]
    const rng = Math.max(h[i] - l[i], m.mintick)
    const bodyShare = Math.abs(c[i] - o[i]) / rng, closePos = (c[i] - l[i]) / rng
    const v1 = bodyShare > 0.55 && closePos < 0.25
    const v2 = R.htfVal[i] < htfPrev[e][i]
    out.V1[i] = v1 ? 1 : 0
    out.V2[i] = v2 ? 1 : 0
    out.V3[i] = v1 && v2 ? 1 : 0
    out.E1[i] = R.lamPct[i] > p.longLamPct && R.volZ[i] > 0 ? 1 : 0
  }
  return out
}
const MASKS = new Map([[BTC.key, shortMasks(BTC)], [ETH.key, shortMasks(ETH)]])
const RF = new Map([BTC, ETH].map(a => { const M = measures(a); return [a.key, { M, range: rangeAtSignals(a, M).range }] }))

// ================================================================ univers A
interface Cfg { id: number; key: string; label: string; source: string; published: number; published2?: number; run: (a: Asset, k: number) => Float64Array }
const pubJ = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
const SE = pubJ('research/reports/short-entry-study/short-entry-btc-eth.json').portfolio
const RFJ = pubJ('research/reports/regime-fakeout/regime-fakeout.json').variants.table.portfolio
const AGJ = pubJ('research/reports/agitated-regime/agitated-regime.json').table.portfolio
const EIJ = pubJ('research/reports/early-invalidation/early-invalidation.json').table
const sim = (a: Asset, k: number, o: EntryOverride) => simulate(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, o).equity
const seShort = (a: Asset, k: number, short: Uint8Array) => sim(a, k, { long: RAW.get(a.key)!.long, short })
const rf = (v: Variant) => (a: Asset, k: number) => { const r = RF.get(a.key)!; const I = variantInputs(a, r.M, r.range, v); return simulate(a.m, I.sets, a.costs(k), a.lo, a.end, I.select, I.override).equity }
const ag = (scaled: boolean) => (a: Asset, k: number) => {
  const [calm, agit] = a.preset.sets
  return simulateSized(a.m, [calm, { ...agit, atrStopMult: calm.atrStopMult }], a.costs(k), a.lo, a.end, a.select, a.signals, scaled ? [1, agit.atrStopMult / calm.atrStopMult] : [1, 1]).equity
}
const ei = (kk: number) => (a: Asset, k: number) => simulateEarlyExit(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, a.signals, kk).equity
const CFGS: Cfg[] = [
  { id: 1, key: 'v1', label: 'v1 (live, sans filtre E2)', source: 'short-entry V0', published: SE.V0.sharpe, run: (a, k) => sim(a, k, RAW.get(a.key)!) },
  { id: 2, key: 'se-v1', label: 'shorts : symétrie de bougie', source: 'short-entry V1', published: SE.V1.sharpe, run: (a, k) => seShort(a, k, MASKS.get(a.key)!.V1) },
  { id: 3, key: 'se-v2', label: 'shorts : symétrie tendance 60 min', source: 'short-entry V2', published: SE.V2.sharpe, run: (a, k) => seShort(a, k, MASKS.get(a.key)!.V2) },
  { id: 4, key: 'se-v3', label: 'shorts : V1 + V2', source: 'short-entry V3', published: SE.V3.sharpe, run: (a, k) => seShort(a, k, MASKS.get(a.key)!.V3) },
  { id: 5, key: 'se-v4', label: 'sans shorts', source: 'short-entry V4', published: SE.V4.sharpe, run: (a, k) => seShort(a, k, MASKS.get(a.key)!.V4) },
  { id: 6, key: 'se-e1', label: 'shorts : lambda + volume miroir', source: 'short-entry E1', published: SE.E1.sharpe, run: (a, k) => seShort(a, k, MASKS.get(a.key)!.E1) },
  { id: 7, key: 'e2', label: 'E2 (référence)', source: 'short-entry E2', published: SE.E2.sharpe, published2: RFJ.V0[2].sharpe, run: (a, k) => sim(a, k, a.signals) },
  { id: 8, key: 'rf-v1', label: 'E2, entrées en range retirées', source: 'regime-fakeout V1', published: RFJ.V1[1].sharpe, published2: RFJ.V1[2].sharpe, run: rf('V1') },
  { id: 9, key: 'rf-v2', label: 'E2, confirmation retardée en range', source: 'regime-fakeout V2', published: RFJ.V2[1].sharpe, published2: RFJ.V2[2].sharpe, run: rf('V2') },
  { id: 10, key: 'rf-v3', label: 'E2, sorties agitées en range', source: 'regime-fakeout V3', published: RFJ.V3[1].sharpe, published2: RFJ.V3[2].sharpe, run: rf('V3') },
  { id: 11, key: 'calm', label: 'V1-calme', source: 'agitated-regime V1', published: AGJ.V1[1].sharpe, published2: AGJ.V1[2].sharpe, run: (a, k) => sim(a, k, calmOnly(a.signals, a.select)) },
  { id: 12, key: 'ag-v2a', label: 'E2, stop agité 3,3 ATR, taille inchangée', source: 'agitated-regime V2a', published: AGJ.V2a[1].sharpe, published2: AGJ.V2a[2].sharpe, run: ag(false) },
  { id: 13, key: 'ag-v2b', label: 'E2, stop agité 3,3 ATR, même risque', source: 'agitated-regime V2b', published: AGJ.V2b[1].sharpe, published2: AGJ.V2b[2].sharpe, run: ag(true) },
  { id: 14, key: 'ei-4', label: 'E2, invalidation à 4 bougies', source: 'early-invalidation V1', published: EIJ.portfolio.V1.sharpe, published2: EIJ.portfolio2.V1.sharpe, run: ei(4) },
  { id: 15, key: 'ei-2', label: 'E2, invalidation à 2 bougies', source: 'early-invalidation S2', published: EIJ.portfolio.S2.sharpe, run: ei(2) },
  { id: 16, key: 'ei-8', label: 'E2, invalidation à 8 bougies', source: 'early-invalidation S8', published: EIJ.portfolio.S8.sharpe, run: ei(8) },
]
const I_E2 = CFGS.findIndex(c => c.key === 'e2'), I_CALM = CFGS.findIndex(c => c.key === 'calm')

const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo]), tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const book = (eb: Float64Array, ee: Float64Array) => {
  const b = dailyOf(BTC.bars, eb, BTC.lo, BTC.end, PD0, PD1), e = dailyOf(ETH.bars, ee, ETH.lo, ETH.end, PD0, PD1)
  return { days: b.days, r: P.book(b.r, e.r).r }
}
const SER: Record<number, number[][]> = { 1: [], 2: [] }
let DAYS: number[] = []
for (const c of CFGS) {
  for (const k of [1, 2]) {
    const d = book(c.run(BTC, k), c.run(ETH, k))
    DAYS = d.days
    SER[k].push(d.r)
  }
  const s1 = sharpe(SER[1].at(-1)!) * ANNF, s2 = sharpe(SER[2].at(-1)!) * ANNF
  check(`n° ${c.id} ${c.label} : Sharpe publié retrouvé`, Math.abs(s1 - c.published) < 1e-6, `${s1.toFixed(7)} / ${c.published}`)
  if (c.published2 !== undefined) check(`n° ${c.id} ${c.label} : Sharpe publié (commissions × 2) retrouvé`, Math.abs(s2 - c.published2) < 1e-6, `${s2.toFixed(7)} / ${c.published2}`)
  log(`n° ${c.id} ${c.key} : ${s1.toFixed(3)} (× 2 : ${s2.toFixed(3)})`)
}
const pub = pubJ('research/reports/btc-eth-portfolio-e2/portfolio_summary.json').headline.portfolioSharpe
check('E2 : Sharpe du portefeuille publié', Math.abs(P.dailyMetrics(SER[1][I_E2], DAYS).sharpe - pub) < 1e-9, String(pub))
check('V1-calme : valeurs figées (CALM_ONLY_REFERENCE)', Math.abs(P.dailyMetrics(SER[1][I_CALM], DAYS).sharpe - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) < 1e-6 && Math.abs(P.dailyMetrics(SER[2][I_CALM], DAYS).sharpe - CALM_ONLY_REFERENCE.portfolio.costs2.sharpe) < 1e-6, `${CALM_ONLY_REFERENCE.portfolio.costs1.sharpe} / ${CALM_ONLY_REFERENCE.portfolio.costs2.sharpe}`)
check('fenêtre commune 2018-09-01 → 2026-09-30', P.isoDay(DAYS[0]) === '2018-09-01' && P.isoDay(DAYS.at(-1)!) === '2026-09-30', `${P.isoDay(DAYS[0])} → ${P.isoDay(DAYS.at(-1)!)}, ${DAYS.length} jours`)

// ================================================================ univers B : candidats de la recherche des réglages
const CANDS = candidates(200, 5)
check('univers B : 206 candidats (graine 5)', CANDS.length === 206, String(CANDS.length))
const B_SHARPE: number[] = []
for (const [j, cand] of CANDS.entries()) {
  const sets = [withParams(DEFAULT_PARAMS, cand.over)]
  const eq = [BTC, ETH].map(a => { const r = simulate(a.m, sets, a.costs(1), a.lo, a.end, null, undefined).equity; a.m.memo.clear(); return r })
  B_SHARPE.push(sharpe(book(eq[0], eq[1]).r))
  if (j % 25 === 0) log(`candidat ${j}/206`)
}
log('univers B')

// ================================================================ CSCV-PBO
const summ = (r: ReturnType<typeof cscv>, n: number[]) => ({
  S: r.S, splits: r.splits, pbo: r.pbo, probLoss: r.probLoss, slope: r.slope, intercept: r.intercept,
  lambda: { q10: P.quantile(r.lambda, 0.1), q50: P.quantile(r.lambda, 0.5), q90: P.quantile(r.lambda, 0.9) },
  chosen: n.map((id, j) => ({ id, count: r.chosenCount[j], share: r.chosenCount[j] / r.splits, meanOosRank: r.meanOosRank[j] })),
  oosSharpeChosen: { mean: P.mean(r.oosSharpe) * ANNF, q10: P.quantile(r.oosSharpe, 0.1) * ANNF },
})
const ALL = CFGS.map(c => c.id), E2SET = CFGS.filter(c => c.id >= 7).map(c => c.id)
const pick = (k: number, ids: number[]) => ids.map(id => SER[k][CFGS.findIndex(c => c.id === id)])
const CS = {
  main: summ(cscv(SER[1], 16), ALL),
  s10: summ(cscv(SER[1], 10), ALL),
  costs2: summ(cscv(SER[2], 16), ALL),
  e2only: summ(cscv(pick(1, E2SET), 16), E2SET),
}
log('CSCV')

// ================================================================ walk-forward
const dayIdx = (iso: string) => DAYS.indexOf(Date.parse(iso) / DAY)
const CUTS = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => dayIdx(`${y}-01-01`))
check('dates de recalage dans la fenêtre', CUTS.every(i => i > 0), CUTS.join(', '))
const WFa = walkForward(SER[1], CUTS), WFb = walkForward([SER[1][I_E2], SER[1][I_CALM]], CUTS)
const oosOf = (x: number[]) => x.slice(CUTS[0])
const oosDays = DAYS.slice(CUTS[0])
type Agg = { s: Float64Array; q: Float64Array; n: Float64Array }
const months = [...new Set(oosDays.map(P.monthKey))].sort((x, y) => x - y), midx = new Map(months.map((m, j) => [m, j]))
const aggOf = (r: number[]): Agg => { const g = { s: new Float64Array(months.length), q: new Float64Array(months.length), n: new Float64Array(months.length) }; oosDays.forEach((d, i) => { const j = midx.get(P.monthKey(d))!; g.s[j] += r[i]; g.q[j] += r[i] ** 2; g.n[j]++ }); return g }
const shOf = (g: Agg, draw: Int32Array) => { let s = 0, qq = 0, n = 0; for (const j of draw) { s += g.s[j]; qq += g.q[j]; n += g.n[j] } const m = s / n, sd = Math.sqrt(Math.max(qq / n - m * m, 0)); return sd > 0 ? (m / sd) * ANNF : 0 }
const G = { a: aggOf(WFa.oos), b: aggOf(WFb.oos), e2: aggOf(oosOf(SER[1][I_E2])), calm: aggOf(oosOf(SER[1][I_CALM])) }
const R = P.rng(SEED)
const BA: number[] = [], BB: number[] = [], BC: number[] = []
for (let rep = 0; rep < BOOT; rep++) {
  const draw = Int32Array.from({ length: months.length }, () => Math.floor(R() * months.length))
  const e2 = shOf(G.e2, draw)
  BA.push(shOf(G.a, draw) - e2); BB.push(shOf(G.b, draw) - e2); BC.push(shOf(G.calm, draw) - e2)
}
const ci = (xs: number[]) => [P.quantile(xs, 0.025), P.quantile(xs, 0.975)]
const shA = (x: number[]) => sharpe(x) * ANNF
const WF = {
  cuts: CUTS.map(i => P.isoDay(DAYS[i])),
  a: WFa.folds.map(f => ({ from: P.isoDay(DAYS[f.from]), id: CFGS[f.chosen].id, trainSharpe: f.trainSharpe * ANNF })),
  b: WFb.folds.map(f => ({ from: P.isoDay(DAYS[f.from]), id: CFGS[[I_E2, I_CALM][f.chosen]].id, trainSharpe: f.trainSharpe * ANNF })),
  oos: { a: shA(WFa.oos), b: shA(WFb.oos), e2: shA(oosOf(SER[1][I_E2])), calm: shA(oosOf(SER[1][I_CALM])) },
  ciA: ci(BA), ciB: ci(BB), ciCalm: ci(BC),
  metrics: Object.fromEntries(([['a', WFa.oos], ['b', WFb.oos], ['e2', oosOf(SER[1][I_E2])], ['calm', oosOf(SER[1][I_CALM])]] as const).map(([k, x]) => { const m = P.dailyMetrics(x as number[], oosDays); return [k, { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD }] })),
  years: [...new Set(DAYS.map(P.yearOf))].map(y => {
    const idx = DAYS.map((d, i) => [d, i] as const).filter(([d]) => P.yearOf(d) === y).map(([, i]) => i)
    const sub = (x: number[]) => idx.map(i => x[i])
    return { year: y, days: idx.length, e2: shA(sub(SER[1][I_E2])), calm: shA(sub(SER[1][I_CALM])), e2x2: shA(sub(SER[2][I_E2])), calmx2: shA(sub(SER[2][I_CALM])) }
  }),
}
const calmPicks = WF.b.filter(f => f.id === 11).length
log('walk-forward')

// ================================================================ DSR
const sdOf = (xs: number[]) => moments(xs).sd
const sdA = sdOf(SER[1].map(sharpe)), sdB = sdOf(B_SHARPE)
const NS = [16, 222, 6266, 128547]
/** Plus petit N (réel) pour lequel le DSR passe sous 0,95 ; Infinity au-delà de 1e15. */
function breakeven(x: number[], sd: number): number {
  const ok = (N: number) => dsr(x, N, sd).p >= 0.95
  if (!ok(1)) return 1
  let lo = 1, hi = 1e15
  if (ok(hi)) return Infinity
  for (let it = 0; it < 200; it++) { const mid = Math.sqrt(lo * hi); if (ok(mid)) lo = mid; else hi = mid }
  return hi
}
const absDsr = (x: number[]) => ({
  psr0: psr(x, 0), sr: sharpe(x) * ANNF,
  A: { N: 16, sd: sdA * ANNF, ...pickD(dsr(x, 16, sdA)) },
  B: NS.map(N => ({ N, sd: sdB * ANNF, ...pickD(dsr(x, N, sdB)) })),
  breakevenA: breakeven(x, sdA), breakevenB: breakeven(x, sdB),
})
function pickD(d: ReturnType<typeof dsr>) { return { sr0: d.sr0 * ANNF, p: d.p, z: d.z } }
const diffDsr = (k: number) => {
  const base = SER[k][I_E2]
  const diffs = SER[k].map(x => x.map((v, i) => v - base[i]))
  const alt = diffs.filter((_, j) => j !== I_E2)
  const sdD = sdOf(alt.map(sharpe))
  const d = diffs[I_CALM]
  const r = dsr(d, alt.length, sdD)
  return { N: alt.length, sdD: sdD * ANNF, ir: sharpe(d) * ANNF, psr0: psr(d, 0).p, sr0: r.sr0 * ANNF, p: r.p, skew: r.skew, kurt: r.kurt, meanDaily: P.mean(d), others: alt.map((x, j) => ({ id: CFGS.filter((_, i) => i !== I_E2)[j].id, ir: sharpe(x) * ANNF })) }
}
const DSR = {
  sdA: sdA * ANNF, sdB: sdB * ANNF, bSharpe: { mean: P.mean(B_SHARPE) * ANNF, min: Math.min(...B_SHARPE) * ANNF, max: Math.max(...B_SHARPE) * ANNF, q90: P.quantile(B_SHARPE, 0.9) * ANNF },
  calm: absDsr(SER[1][I_CALM]), e2: absDsr(SER[1][I_E2]),
  diff: diffDsr(1), diff2: diffDsr(2),
  e0: { 16: expectedMaxSharpe(16, sdA) * ANNF },
}
log('DSR')

// ================================================================ lecture
const pboLevel = CS.main.pbo < 0.2 ? 'faible' : CS.main.pbo < 0.5 ? 'ambigu' : 'surajusté'
const wfOk = calmPicks >= 4 && WF.oos.a - WF.oos.e2 > 0
const dsrOk = DSR.diff.p >= 0.95
const verdict = CS.main.pbo >= 0.5 ? 'pas de candidate' : CS.main.pbo < 0.2 && wfOk && dsrOk ? 'candidate solide pour un test forward' : 'candidate fragile'
const READ = { pbo: CS.main.pbo, pboLevel, calmPicks, wfDelta: WF.oos.a - WF.oos.e2, wfOk, dsrDiff: DSR.diff.p, dsrOk, verdict }

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/calm-only.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
const cfgTable = CFGS.map((c, j) => ({ id: c.id, key: c.key, label: c.label, source: c.source, sharpe: sharpe(SER[1][j]) * ANNF, sharpe2: sharpe(SER[2][j]) * ANNF }))
writeFileSync(join(OUT, 'calm-only.json'), JSON.stringify({ plan: PLAN, generatedAt: new Date().toISOString(), git, checks, configurations: cfgTable, universeB: { n: B_SHARPE.length, sharpe: B_SHARPE.map(x => x * ANNF) }, cscv: CS, walkForward: WF, dsr: DSR, reading: READ }, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(8) : String(v)) : v), 1) + '\n')

const MINUS = '−'
const fin = (x: number) => Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 0) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const big = (x: number) => (x === Infinity ? '> 10¹⁵' : x >= 1e6 ? fr(x.toExponential(1)).replace('e+', ' × 10^') : Math.round(x).toLocaleString('fr-FR').replace(/ | /g, ' '))
const lbl = (id: number) => `${id} · ${CFGS.find(c => c.id === id)!.label}`
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }

L.push('# V1-calme : surajustement de sélection (CSCV-PBO, walk-forward, Sharpe dégonflé)', '')
L.push(`Plan : \`${PLAN}\`, commité avant tout calcul. Script : \`research/shock/calm-only.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}). Moteur non modifié. V1-calme = E2 sans nouvelles entrées en régime agité, réglages inchangés, BTC/ETH 50/50. Son résultat contre E2 était déjà connu : l'étude mesure le risque que ce choix vienne de la sélection, pas un test indépendant.`, '')
L.push('## Réponse', '')
L.push(`**Verdict (règle du § 6) : ${READ.verdict}.**`, '')
L.push(`- **PBO** (16 configurations, 16 blocs, 12 870 découpages) : **${pc(CS.main.pbo, 1)}** (${pboLevel}). La configuration la meilleure dans l'échantillon est V1-calme dans ${pc(CS.main.chosen.find(x => x.id === 11)!.share)} des découpages ; rang relatif moyen hors échantillon : V1-calme ${pc(CS.main.chosen.find(x => x.id === 11)!.meanOosRank)}, E2 ${pc(CS.main.chosen.find(x => x.id === 7)!.meanOosRank)}.`)
L.push(`- **Walk-forward** (recalage annuel 2020 → 2026, passé seulement) : le sélecteur E2 / V1-calme retient V1-calme à ${calmPicks} recalages sur 7. Hors échantillon 2020-01 → 2026-09, Sharpe : sélecteur sur les 16 ${num(WF.oos.a)}, sélecteur E2 / V1-calme ${num(WF.oos.b)}, E2 ${num(WF.oos.e2)}, V1-calme fixe ${num(WF.oos.calm)} ; Δ sélecteur 16 − E2 ${sg(READ.wfDelta, 3)} (IC 95 % ${sg(WF.ciA[0], 3)} à ${sg(WF.ciA[1], 3)}) → ${wfOk ? 'favorable' : 'non favorable'}.`)
L.push(`- **DSR du gain sur E2** (série V1-calme − E2, N = ${DSR.diff.N} alternatives) : ratio d'information ${num(DSR.diff.ir)} par an, PSR(0) ${pc(DSR.diff.psr0, 1)}, seuil dû aux essais ${num(DSR.diff.sr0)}, **DSR ${pc(DSR.diff.p, 1)}** → ${dsrOk ? 'le gain résiste au nombre d\'essais' : 'gain non démontré'}. Avec des commissions doublées : DSR ${pc(DSR.diff2.p, 1)}.`)
L.push(`- **DSR du Sharpe absolu de V1-calme** : ${pc(DSR.calm.A.p, 1)} contre l'univers A ; contre la lignée des réglages (écart type des 206 candidats ${num(DSR.sdB)}), ${DSR.calm.B.map(b => `${pc(b.p, 1)} à N = ${big(b.N)}`).join(', ')}. Il passe sous 0,95 au-delà de N ≈ ${big(DSR.calm.breakevenB)} essais (E2 : ${big(DSR.e2.breakevenB)}).`, '')

L.push('## 1. Univers A rejoué', '')
L.push('Chaque configuration redonne le Sharpe publié de son étude (écart < 1e-6 ; contrôles en fin de rapport).', '')
tbl(['n°', 'Configuration', 'Étude', 'Sharpe', 'Sharpe, commissions × 2', 'Δ dû aux frais'], cfgTable.map(c => [c.id, c.label, c.source, num(c.sharpe, 3), num(c.sharpe2, 3), sg(c.sharpe2 - c.sharpe, 3)]))

L.push('## 2. CSCV-PBO', '')
const csRow = (name: string, r: typeof CS.main) => [name, r.splits, pc(r.pbo, 1), `${sg(r.lambda.q10)} / ${sg(r.lambda.q50)} / ${sg(r.lambda.q90)}`, pc(r.probLoss, 1), num(r.slope), num(r.oosSharpeChosen.mean), pc(r.chosen.find(x => x.id === 11)?.share ?? NaN), pc(r.chosen.find(x => x.id === 11)?.meanOosRank ?? NaN), pc(r.chosen.find(x => x.id === 7)!.meanOosRank)]
tbl(['Matrice', 'Découpages', 'PBO', 'λ (10 / 50 / 90 %)', 'P(perte hors éch.)', 'Pente de dégradation', 'Sharpe hors éch. du choix (moy.)', 'V1-calme choisie', 'Rang hors éch. V1-calme', 'Rang hors éch. E2'],
  [csRow('**16 configurations, S = 16 (principal)**', CS.main), csRow('S = 10', CS.s10), csRow('commissions × 2', CS.costs2), csRow('10 configurations bâties sur E2', CS.e2only)])
L.push('Configurations retenues dans l\'échantillon (principal) et rang relatif moyen hors échantillon (50 % = médiane) :', '')
tbl(['Configuration', 'Retenue', 'Rang hors échantillon moyen'], CS.main.chosen.slice().sort((x, y) => y.meanOosRank - x.meanOosRank).map(x => [lbl(x.id), `${x.count} (${pc(x.share)})`, pc(x.meanOosRank)]))

L.push('## 3. Walk-forward chronologique', '')
tbl(['Recalage', 'Sélecteur sur les 16 (Sharpe passé)', 'Sélecteur E2 / V1-calme (Sharpe passé)'], WF.a.map((f, j) => [f.from, `${lbl(f.id)} (${num(f.trainSharpe)})`, `${lbl(WF.b[j].id)} (${num(WF.b[j].trainSharpe)})`]))
tbl(['Hors échantillon 2020-01-01 → 2026-09-30', 'Sharpe', 'CAGR', 'Drawdown max.', 'Δ Sharpe contre E2 [IC 95 %]'], [
  ['Sélecteur sur les 16', num(WF.metrics.a.sharpe), pc(WF.metrics.a.cagr, 1), pc(WF.metrics.a.maxDD, 1), `${sg(WF.oos.a - WF.oos.e2, 3)} [${sg(WF.ciA[0], 3)} ; ${sg(WF.ciA[1], 3)}]`],
  ['Sélecteur E2 / V1-calme', num(WF.metrics.b.sharpe), pc(WF.metrics.b.cagr, 1), pc(WF.metrics.b.maxDD, 1), `${sg(WF.oos.b - WF.oos.e2, 3)} [${sg(WF.ciB[0], 3)} ; ${sg(WF.ciB[1], 3)}]`],
  ['E2 fixe', num(WF.metrics.e2.sharpe), pc(WF.metrics.e2.cagr, 1), pc(WF.metrics.e2.maxDD, 1), '—'],
  ['V1-calme fixe (choisie en 2026)', num(WF.metrics.calm.sharpe), pc(WF.metrics.calm.cagr, 1), pc(WF.metrics.calm.maxDD, 1), `${sg(WF.oos.calm - WF.oos.e2, 3)} [${sg(WF.ciCalm[0], 3)} ; ${sg(WF.ciCalm[1], 3)}]`],
])
L.push('Année par année (Sharpe ; 2018 et 2026 partielles) :', '')
tbl(['Année', 'Jours', 'E2', 'V1-calme', 'Δ', 'E2 (× 2)', 'V1-calme (× 2)', 'Δ (× 2)'], WF.years.map(y => [y.year, y.days, num(y.e2), num(y.calm), sg(y.calm - y.e2), num(y.e2x2), num(y.calmx2), sg(y.calmx2 - y.e2x2)]))

L.push('## 4. Sharpe dégonflé', '')
L.push(`Sharpe annualisés ; calcul sur les rendements journaliers (${DAYS.length} jours), asymétrie et kurtosis comprises. Écart type des Sharpe des essais : univers A ${num(DSR.sdA, 3)} ; 206 candidats de la recherche des réglages ${num(DSR.sdB, 3)} (Sharpe moyen ${num(DSR.bSharpe.mean)}, de ${num(DSR.bSharpe.min)} à ${num(DSR.bSharpe.max)}).`, '')
L.push('**(a) Sharpe absolu**', '')
const absRows = (name: string, d: typeof DSR.calm) => [
  [name, num(d.sr), `${num(d.psr0.skew)} / ${num(d.psr0.kurt, 1)}`, pc(d.psr0.p, 2), `${pc(d.A.p, 2)} (seuil ${num(d.A.sr0)})`, ...d.B.map(b => `${pc(b.p, 1)} (seuil ${num(b.sr0)})`), `${big(d.breakevenA)} · ${big(d.breakevenB)}`],
]
tbl(['Stratégie', 'Sharpe', 'Asymétrie / kurtosis', 'PSR(0)', 'DSR, N = 16 (écart type A)', ...NS.map(N => `DSR, N = ${big(N)} (écart type B)`), 'N* où DSR < 95 % (A · B)'], [...absRows('V1-calme', DSR.calm), ...absRows('E2', DSR.e2)])
L.push('**(b) Gain de V1-calme sur E2** (série quotidienne V1-calme − E2)', '')
tbl(['Commissions', 'Ratio d\'information', 'Asymétrie / kurtosis', 'PSR(0)', 'N', 'Écart type des essais', 'Seuil', 'DSR'], ([['× 1', DSR.diff], ['× 2', DSR.diff2]] as const).map(([k, d]) => [k, num(d.ir, 3), `${num(d.skew)} / ${num(d.kurt, 1)}`, pc(d.psr0, 1), d.N, num(d.sdD, 3), num(d.sr0, 3), `**${pc(d.p, 1)}**`]))
tbl(['Alternative à E2', 'Ratio d\'information contre E2 (× 1)'], DSR.diff.others.slice().sort((x, y) => y.ir - x.ir).map(o => [lbl(o.id), num(o.ir, 3)]))

L.push('## Lecture', '')
{
  const yrs = WF.years, better = yrs.filter(y => y.calm > y.e2).length, better2 = yrs.filter(y => y.calmx2 > y.e2x2).length
  const c11 = CS.main.chosen.find(x => x.id === 11)!, c13 = CS.main.chosen.find(x => x.id === 13)!
  const v2b = DSR.diff.others.find(o => o.id === 13)!
  const fee = (id: number) => { const c = cfgTable.find(x => x.id === id)!; return c.sharpe2 - c.sharpe }
  L.push(`- **Le choix est stable dans le temps.** PBO ${pc(CS.main.pbo, 1)} : choisir la meilleure configuration sur une moitié des blocs donne, sur l'autre moitié, une configuration au-dessus de la médiane dans ${pc(1 - CS.main.pbo, 0)} des cas. V1-calme est la meilleure dans l'échantillon dans ${pc(c11.share)} des découpages et se classe en moyenne à ${pc(c11.meanOosRank)} hors échantillon. Elle fait mieux que E2 ${better} années sur ${yrs.length} (${better2} sur ${yrs.length} avec des commissions doublées), et un choix fait en temps réel entre E2 et V1-calme l'aurait retenue à chaque recalage depuis 2020.`)
  L.push(`- **Mais l'écart est petit devant le bruit.** Le gain quotidien de V1-calme sur E2 a un ratio d'information de ${num(DSR.diff.ir)} par an et une distribution à queues épaisses (asymétrie ${num(DSR.diff.skew)}, kurtosis ${num(DSR.diff.kurt, 0)}). Seul, sans correction, il n'atteint pas 95 % (PSR(0) ${pc(DSR.diff.psr0, 1)}) ; rapporté aux ${DSR.diff.N} alternatives essayées contre E2, le DSR tombe à ${pc(DSR.diff.p, 1)}. Le walk-forward le confirme : Δ Sharpe hors échantillon ${sg(WF.oos.calm - WF.oos.e2, 3)} pour V1-calme, IC 95 % ${sg(WF.ciCalm[0], 3)} à ${sg(WF.ciCalm[1], 3)}.`)
  L.push(`- **Une alternative fait presque pareil.** Le stop agité élargi à risque égal (n° 13) a un ratio d'information contre E2 de ${num(v2b.ir)}, est retenu dans ${pc(c13.share)} des découpages et par le sélecteur sur les 16 à ${WF.a.filter(f => f.id === 13).length} recalages sur 7. Les deux réduisent l'exposition du régime agité (aucune nouvelle entrée, ou une taille divisée par 3) : c'est ce point commun que les données soutiennent, pas spécifiquement la suppression.`)
  L.push(`- **La tenue aux frais est mécanique.** Doubler les commissions coûte ${num(-fee(11), 3)} de Sharpe à V1-calme contre ${num(-fee(7), 3)} à E2 : ${CALM_ONLY_REFERENCE.portfolio.costs1.trades} trades contre ${CALM_ONLY_REFERENCE.e2.costs1.trades}. Avec des commissions doublées, l'avantage est plus net (ratio d'information ${num(DSR.diff2.ir)}, PSR(0) ${pc(DSR.diff2.psr0, 1)}) mais le DSR reste à ${pc(DSR.diff2.p, 1)}.`)
  L.push(`- **Le Sharpe absolu ne résiste pas à toute la recherche des réglages.** Avec la dispersion des 206 candidats dont viennent les réglages (écart type ${num(DSR.sdB)}), le DSR passe sous 95 % au-delà d'environ ${big(DSR.e2.breakevenB)} essais pour E2 et ${big(DSR.calm.breakevenB)} pour V1-calme ; la lignée en compte au moins 222. Deux réserves vont dans l'autre sens : les réglages ont été choisis sur BTC seul (ETH, la moitié du portefeuille, n'a pas servi à les choisir), et la dispersion des candidats, en moyenne perdants (Sharpe moyen ${num(DSR.bSharpe.mean)}), mêle bruit et vraies différences, ce qui rend le DSR sévère. Le Sharpe historique de 1,9 à 2,0 ne peut pas être pris pour argent comptant ; seul le forward le validera.`)
  L.push(`- **Verdict : ${READ.verdict}.** V1-calme est une simplification cohérente dans le temps et moins sensible aux frais, mais son avantage sur E2 n'est pas démontré au-delà du hasard de sélection. E2 reste la référence ; rien ne change dans le live. La suite logique est un test forward pré-enregistré de V1-calme en shadow à côté de E2, avec un critère de décision fixé avant de voir les données.`, '')
}
L.push('## Limites', '')
L.push('- Exploratoire : BTC/ETH sont les données de développement ; V1-calme a été construite après avoir vu ces données.')
L.push('- CSCV traite les blocs comme échangeables (un bloc d\'entraînement peut suivre un bloc de test) ; le walk-forward ne lit que le passé mais n\'a que 7 recalages.')
L.push('- La pente de dégradation négative tient surtout au découpage : les deux moitiés sont complémentaires, une moitié forte pour toutes les configurations laisse une moitié faible. Elle ne mesure pas à elle seule un surajustement.')
L.push('- Les 16 configurations partagent l\'essentiel de leurs trades : elles sont très corrélées, ce qui réduit le nombre effectif d\'essais (le DSR avec N = 16 est prudent sur ce point) mais rend le PBO sensible à de petites différences.')
L.push('- Univers B : les 206 candidats ont été choisis sur BTC avec les coûts du script ; ils sont rejoués ici tels quels en portefeuille BTC/ETH aux coûts du portefeuille, seulement pour estimer la dispersion des Sharpe d\'essais.', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/calm-only.ts', '```', '')
writeFileSync(join(OUT, 'calm-only.md'), L.join('\n'))
log('rapport')
