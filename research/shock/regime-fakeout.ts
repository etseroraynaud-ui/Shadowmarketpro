// Régime directionnel avant le signal et coût des faux départs (research/preregistration/regime-fakeout.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/regime-fakeout.ts
//
// Phase 1 : matrice de rendement conditionnel par quartile du percentile causal de l'Efficiency Ratio
// (et de l'ER 24 h, de l'ADX, de la fréquence des faux départs), sur les 1 311 trades BTC/ETH de
// référence et sur les trades E2 des 8 actifs vierges. Phases 2–3 : variantes V0–V3 rejouées en
// portefeuille complet ; test confirmatoire sur les actifs vierges ; BTC/ETH et années en descriptif.
// Le moteur n'est pas modifié. Sorties : research/reports/regime-fakeout/.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { CFG, GROUPS, M15, UNSEEN, VARIANTS, causalPct, groupOf, measures, rangeAtSignals, referenceAsset, reentered, tradeR, unseenAsset, variantInputs, efficiencyRatio, adxBefore, fakeoutFrequency } from '../lib/regime-er.ts'
import type { Asset, Measures, TradeR, Variant } from '../lib/regime-er.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { Bars } from '../../lib/backtest/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/regime-fakeout')
const PLAN = 'research/preregistration/regime-fakeout.md'
const DAY = 864e5
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const stopIfFailed = (stage: string) => { const bad = checks.filter(c => !c.ok); if (bad.length) throw new Error(`${stage} : ${bad.map(c => c.name).join(' ; ')}`) }
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')

// ================================================================ 0. empreintes
const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'lib/strategies/shock/live.ts': '05caf82ece9ad7f8c355f0390bbda4fe6e3bffe1802933d0952b5c3dc10edeb2',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) { const got = sha(readFileSync(join(ROOT, f))); check(`empreinte ${f}`, got === h, got.slice(0, 16)) }
stopIfFailed('empreintes')

// ================================================================ 1. actifs, mesures, simulations
const ASSETS: Asset[] = [referenceAsset('btc'), referenceAsset('ethusdt'), ...UNSEEN.map(unseenAsset)]
const UN = ASSETS.filter(a => a.unseen)
interface Run { res: ShockResult; trades: TradeR[]; daily: { days: number[]; r: number[] }; moved: number; dropped: number }
const MEAS = new Map<string, Measures>()
const RANGE = new Map<string, Uint8Array>()
const RUNS = new Map<string, Record<Variant, Record<number, Run>>>()

/** Rendements journaliers UTC sur les jours complets de la fenêtre [lo, end] (convention de portfolio.ts). */
function dailyOf(b: Bars, equity: Float64Array, lo: number, end: number, D0?: number, D1?: number) {
  const t = b.t
  const d0 = D0 ?? Math.ceil(t[lo] / DAY), d1 = D1 ?? Math.floor((t[end] + M15) / DAY) - 1
  const idxAt = (ms: number) => { let a = 0, z = b.n; while (a < z) { const m = (a + z) >> 1; if (t[m] < ms) a = m + 1; else z = m } return a }
  const a = idxAt(d0 * DAY), z = idxAt((d1 + 1) * DAY) - 1
  const days: number[] = []
  for (let d = d0; d <= d1; d++) days.push(d)
  const base = equity[a - 1]
  const { eq } = P.dayCloses(t, equity, a, z, days, base)
  return { days, r: P.returnsOf(eq, base) }
}

for (const a of ASSETS) {
  const M = measures(a)
  const { range } = rangeAtSignals(a, M)
  MEAS.set(a.key, M); RANGE.set(a.key, range)
  const runs = {} as Record<Variant, Record<number, Run>>
  for (const v of VARIANTS) {
    runs[v] = {}
    const I = variantInputs(a, M, range, v)
    for (const k of [1, 2]) {
      const res = simulate(a.m, I.sets, a.costs(k), a.lo, a.end, I.select, I.override)
      const trades = res.positions.filter(p => p.entryIdx >= a.lo && p.entryIdx <= a.end && !p.exits.includes('END')).map(p => tradeR(p, I.sets, a.mintick, a.bars.t))
      runs[v][k] = { res, trades, daily: dailyOf(a.bars, res.equity, a.lo, a.end), moved: I.moved, dropped: I.dropped }
    }
  }
  RUNS.set(a.key, runs)
  log(`${a.key} : ${VARIANTS.map(v => `${v} ${runs[v][1].trades.length}`).join(', ')} trades`)
}

// ================================================================ 2. contrôles bloquants
const REF_START = Date.parse('2018-09-01'), REF_END = Date.parse('2026-10-01')
for (const [key, n] of [['BTC', 644], ['ETH', 667]] as const) {
  const a = ASSETS.find(x => x.key === key)!
  const got = RUNS.get(key)!.V0[1].res.positions.filter(p => a.bars.t[p.entryIdx] >= REF_START && a.bars.t[p.entryIdx] < REF_END).length
  check(`${key} : V0 = trades du portefeuille E2 publié`, got === n, `${got} / ${n}`)
}
// Portefeuille BTC/ETH 50/50 sans rebalancement, fenêtre commune de portfolio.ts.
const BTC = ASSETS[0], ETH = ASSETS[1]
const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo]), tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
function portfolio(v: Variant, k: number) {
  const db = dailyOf(BTC.bars, RUNS.get('BTC')![v][k].res.equity, BTC.lo, BTC.end, PD0, PD1)
  const de = dailyOf(ETH.bars, RUNS.get('ETH')![v][k].res.equity, ETH.lo, ETH.end, PD0, PD1)
  return { days: db.days, r: P.book(db.r, de.r).r }
}
const PORT = Object.fromEntries(VARIANTS.map(v => [v, { 1: portfolio(v, 1), 2: portfolio(v, 2) }])) as Record<Variant, Record<number, { days: number[]; r: number[] }>>
const pubSharpe = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'), 'utf8')).headline.portfolioSharpe
const v0Sharpe = P.dailyMetrics(PORT.V0[1].r, PORT.V0[1].days).sharpe
check('BTC/ETH : Sharpe de V0 = Sharpe publié du portefeuille E2', Math.abs(v0Sharpe - pubSharpe) < 1e-9, `${v0Sharpe} / ${pubSharpe}`)
// V3 sans aucune bougie en range = V0, position par position.
for (const a of [BTC, UN[0]]) {
  const I = variantInputs(a, MEAS.get(a.key)!, new Uint8Array(a.bars.n), 'V3')
  const r = simulate(a.m, I.sets, a.costs(1), a.lo, a.end, I.select, I.override)
  check(`${a.key} : V3 sans range = V0`, JSON.stringify(r.positions) === JSON.stringify(RUNS.get(a.key)!.V0[1].res.positions), `${r.positions.length} positions`)
}
// Mesures identiques sur un historique coupé à la bougie de signal.
{
  const R = P.rng(CFG.seed)
  let bad = 0, n = 0
  for (const a of [BTC, ETH, UN[3]]) {
    const M = MEAS.get(a.key)!
    const tr = RUNS.get(a.key)!.V0[1].trades
    for (let s = 0; s < 4; s++) {
      const i = tr[Math.floor(R() * tr.length)].p.entryIdx
      const cut = (x: Float64Array) => x.slice(0, i + 1)
      const b: Bars = { n: i + 1, t: cut(a.bars.t), o: cut(a.bars.o), h: cut(a.bars.h), l: cut(a.bars.l), c: cut(a.bars.c), v: cut(a.bars.v) }
      const er = efficiencyRatio(b.c, CFG.erN), er2 = efficiencyRatio(b.c, CFG.erN2), adx = adxBefore(b, CFG.adxLen), fk = fakeoutFrequency(b, CFG.fakeN, CFG.fakeK, CFG.fakeWin, CFG.fakeMin)
      const same = (x: number, y: number) => x === y || (Number.isNaN(x) && Number.isNaN(y)) || Math.abs(x - y) < 1e-9
      for (const [full, part] of [[M.er, er], [M.er2, er2], [M.adx, adx], [M.fake, fk]] as const) { n++; if (!same(full[i], part[i]) || !same(causalPct(full, i, CFG.pctWin, CFG.pctMin), causalPct(part, i, CFG.pctWin, CFG.pctMin))) bad++ }
    }
  }
  check('mesures identiques sur un historique coupé à la bougie de signal', bad === 0, `${n} comparaisons, ${bad} écart(s)`)
}
stopIfFailed('contrôles')
log('contrôles')

// ================================================================ 3. phase 1 : matrice
interface Obs { asset: string; dir: 1 | -1; R: number; mfeR: number; maeR: number; month: number; re: boolean[]; pct: Record<string, number> }
const MEASURE_KEYS = ['er', 'er2', 'adx', 'fake'] as const
const MEASURE_LABEL: Record<string, string> = { er: 'ER 20 bougies (5 h) — principal', er2: 'ER 96 bougies (24 h)', adx: 'ADX(14)', fake: 'Fréquence des faux départs (7 j)' }

function observations(a: Asset, window?: [number, number]): Obs[] {
  const M = MEAS.get(a.key)!
  return RUNS.get(a.key)!.V0[1].trades
    .filter(x => !window || (a.bars.t[x.p.entryIdx] >= window[0] && a.bars.t[x.p.entryIdx] < window[1]))
    .map(x => {
      const i = x.p.entryIdx, d = x.p.dir
      const lvl = d === 1 ? M.hhPrev[x.p.set][i] : M.llPrev[x.p.set][i]
      return {
        asset: a.key, dir: d, R: x.R, mfeR: x.mfeR, maeR: x.maeR, month: P.monthKey(Math.floor(x.entryTime / DAY)),
        re: CFG.reentry.map(h => reentered(a.bars, i, d, lvl, h)),
        pct: Object.fromEntries(MEASURE_KEYS.map(k => [k, causalPct(M[k], i, CFG.pctWin, CFG.pctMin)])),
      }
    })
}
const SAMPLES: Record<string, Obs[]> = {
  'BTC/ETH (développement)': [...observations(BTC, [REF_START, REF_END]), ...observations(ETH, [REF_START, REF_END])],
  '8 actifs vierges (réplication)': UN.flatMap(a => observations(a)),
}
check('BTC/ETH : 1 311 trades dans la matrice', SAMPLES['BTC/ETH (développement)'].length === 1311, String(SAMPLES['BTC/ETH (développement)'].length))
stopIfFailed('phase 1')

const med = (xs: number[]) => P.quantile(xs, 0.5)
function wilson(k: number, n: number): [number, number] {
  const z = 1.959964, ph = k / n, d = 1 + (z * z) / n, c = (ph + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d
  return [c - h, c + h]
}
/** Bootstrap par mois des moyennes de R de plusieurs groupes (mêmes mois tirés pour tous). */
function bootMeans(obs: Obs[], groupOfObs: (o: Obs) => number, nG: number, reps: number, seed: number) {
  const months = [...new Set(obs.map(o => o.month))].sort((x, y) => x - y)
  const idx = new Map(months.map((m, j) => [m, j]))
  const S = months.map(() => new Float64Array(nG + 1)), C = months.map(() => new Float64Array(nG + 1))
  for (const o of obs) { const g = groupOfObs(o); if (g < 0) continue; const j = idx.get(o.month)!; S[j][g] += o.R; C[j][g]++ }
  const R = P.rng(seed)
  const out: number[][] = []
  for (let r = 0; r < reps; r++) {
    const s = new Float64Array(nG), c = new Float64Array(nG)
    for (let k = 0; k < months.length; k++) { const j = Math.floor(R() * months.length); for (let g = 0; g < nG; g++) { s[g] += S[j][g]; c[g] += C[j][g] } }
    out.push(Array.from(s, (v, g) => (c[g] ? v / c[g] : NaN)))
  }
  return out
}
const pctile = (xs: number[], q: number) => P.quantile(xs.filter(Number.isFinite), q)

function matrix(obs: Obs[], key: string) {
  const big = P.quantile(obs.map(o => o.R), 0.9)
  const sumR = obs.reduce((s, o) => s + o.R, 0)
  const nBig = obs.filter(o => o.R >= big).length
  const lossTot = obs.filter(o => o.R <= 0).reduce((s, o) => s + o.R, 0)
  const g = (o: Obs) => groupOf(o.pct[key])
  const draws = bootMeans(obs, g, 4, CFG.boot, CFG.seed)
  const rows = GROUPS.map((name, j) => {
    const os = obs.filter(o => g(o) === j)
    const R = os.map(o => o.R), w = R.filter(x => x > 0), l = R.filter(x => x <= 0)
    const [wl, wh] = wilson(w.length, os.length)
    const col = draws.map(d => d[j])
    return {
      group: name, n: os.length, share: os.length / obs.length, winRate: w.length / os.length, winLo: wl, winHi: wh,
      meanR: P.mean(R), meanLo: pctile(col, 0.025), meanHi: pctile(col, 0.975), medianR: med(R),
      payoff: P.mean(w) / -P.mean(l), pf: w.reduce((s, x) => s + x, 0) / -l.reduce((s, x) => s + x, 0),
      mfe: med(os.map(o => o.mfeR)), mae: med(os.map(o => o.maeR)),
      reentry: CFG.reentry.map((_, k) => os.filter(o => o.re[k]).length / os.length),
      bigInGroup: os.filter(o => o.R >= big).length / os.length, bigShare: os.filter(o => o.R >= big).length / nBig,
      sumRShare: R.reduce((s, x) => s + x, 0) / sumR, lossShare: l.reduce((s, x) => s + x, 0) / lossTot,
    }
  })
  // D1 = R moyen (range marqué) − R moyen (trois autres groupes), bilatéral.
  const d1Draws = bootMeans(obs, o => (g(o) < 0 ? -1 : g(o) === 0 ? 0 : 1), 2, CFG.boot, CFG.seed).map(d => d[0] - d[1])
  const r0 = obs.filter(o => g(o) === 0).map(o => o.R), r1 = obs.filter(o => g(o) > 0).map(o => o.R)
  const D1 = { est: P.mean(r0) - P.mean(r1), lo: pctile(d1Draws, 0.025), hi: pctile(d1Draws, 0.975), pTwoSided: Math.min(1, 2 * Math.min(d1Draws.filter(x => x <= 0).length, d1Draws.filter(x => x >= 0).length) / d1Draws.length), n0: r0.length, n1: r1.length }
  return { measure: key, label: MEASURE_LABEL[key], n: obs.length, undefinedPct: obs.filter(o => g(o) < 0).length, bigThreshold: big, rows, D1 }
}
const PHASE1 = Object.fromEntries(Object.entries(SAMPLES).map(([s, obs]) => [s, Object.fromEntries(MEASURE_KEYS.map(k => [k, matrix(obs, k)]))]))
// Découpages descriptifs de l'ER principal.
const SPLITS = {
  'BTC/ETH (développement)': Object.fromEntries([['BTC', (o: Obs) => o.asset === 'BTC'], ['ETH', (o: Obs) => o.asset === 'ETH'], ['long', (o: Obs) => o.dir === 1], ['short', (o: Obs) => o.dir === -1]].map(([n, f]) => [n as string, matrix(SAMPLES['BTC/ETH (développement)'].filter(f as (o: Obs) => boolean), 'er')])),
  '8 actifs vierges (réplication)': Object.fromEntries(UN.map(a => [a.key, matrix(SAMPLES['8 actifs vierges (réplication)'].filter(o => o.asset === a.key), 'er')])),
}
log('phase 1')

// ================================================================ 4. phases 2–3 : variantes
const sharpeOf = (r: number[]) => { const s = P.sd(r); return s > 0 ? (P.mean(r) / s) * Math.sqrt(P.ANN) : 0 }
function summary(a: Asset | null, v: Variant, k: number) {
  const runs = a ? [RUNS.get(a.key)![v][k]] : [RUNS.get('BTC')![v][k], RUNS.get('ETH')![v][k]]
  const d = a ? runs[0].daily : PORT[v][k]
  const m = P.dailyMetrics(d.r, d.days)
  const trades = a ? runs[0].trades : runs.flatMap(x => x.trades.filter(t => t.entryTime - M15 >= PD0 * DAY && t.entryTime - M15 < (PD1 + 1) * DAY))
  const gp = trades.filter(t => t.p.pnl > 0).reduce((s, t) => s + t.p.pnl, 0), gl = trades.filter(t => t.p.pnl <= 0).reduce((s, t) => s + t.p.pnl, 0)
  const Rs = trades.map(t => t.R)
  return { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, pf: gp / -gl, trades: trades.length, sumR: Rs.reduce((s, x) => s + x, 0), top5: P.topShare(Rs, 0.05).share, moved: runs.reduce((s, x) => s + x.moved, 0), dropped: runs.reduce((s, x) => s + x.dropped, 0) }
}
const TABLE = {
  portfolio: Object.fromEntries(VARIANTS.map(v => [v, { 1: summary(null, v, 1), 2: summary(null, v, 2) }])),
  assets: Object.fromEntries(ASSETS.map(a => [a.key, Object.fromEntries(VARIANTS.map(v => [v, { 1: summary(a, v, 1), 2: summary(a, v, 2) }]))])),
}

// Bootstrap confirmatoire : mois civils de l'union des fenêtres des actifs vierges, tirés en commun.
const UMONTHS = [...new Set(UN.flatMap(a => RUNS.get(a.key)!.V0[1].daily.days.map(P.monthKey)))].sort((x, y) => x - y)
const midx = new Map(UMONTHS.map((m, j) => [m, j]))
// Sommes par (actif, variante, coûts, mois) : Σr, Σr², n.
type Agg = { s: Float64Array; q: Float64Array; n: Float64Array }
const AGG = new Map<string, Agg>()
for (const a of UN) for (const v of VARIANTS) for (const k of [1, 2]) {
  const d = RUNS.get(a.key)![v][k].daily
  const g: Agg = { s: new Float64Array(UMONTHS.length), q: new Float64Array(UMONTHS.length), n: new Float64Array(UMONTHS.length) }
  d.days.forEach((day, i) => { const j = midx.get(P.monthKey(day))!; g.s[j] += d.r[i]; g.q[j] += d.r[i] ** 2; g.n[j]++ })
  AGG.set(`${a.key}|${v}|${k}`, g)
}
const shAgg = (s: number, q: number, n: number) => { if (n < 2) return NaN; const m = s / n, sd = Math.sqrt(Math.max(q / n - m * m, 0)); return sd > 0 ? (m / sd) * Math.sqrt(P.ANN) : 0 }
const deltaOf = (v: Variant, k: number, pick: (j: number) => number) => {
  const ds: number[] = []
  for (const a of UN) {
    let s0 = 0, q0 = 0, n0 = 0, s1 = 0, q1 = 0, n1 = 0
    const A0 = AGG.get(`${a.key}|V0|${k}`)!, A1 = AGG.get(`${a.key}|${v}|${k}`)!
    for (let r = 0; r < UMONTHS.length; r++) { const j = pick(r); s0 += A0.s[j]; q0 += A0.q[j]; n0 += A0.n[j]; s1 += A1.s[j]; q1 += A1.q[j]; n1 += A1.n[j] }
    if (n0 >= 30 && n1 >= 30) ds.push(shAgg(s1, q1, n1) - shAgg(s0, q0, n0))
  }
  return ds.length ? P.mean(ds) : NaN
}
const TESTED: Variant[] = ['V1', 'V2', 'V3']
const R = P.rng(CFG.seed)
const bootD: Record<string, number[]> = Object.fromEntries(TESTED.map(v => [v, [] as number[]]))
for (let rep = 0; rep < CFG.boot; rep++) {
  const draw = Array.from({ length: UMONTHS.length }, () => Math.floor(R() * UMONTHS.length))
  for (const v of TESTED) bootD[v].push(deltaOf(v, 1, r => draw[r]))
}
const CONF = TESTED.map(v => {
  const per = UN.map(a => TABLE.assets[a.key][v][1].sharpe - TABLE.assets[a.key].V0[1].sharpe)
  const est = P.mean(per)
  const ds = bootD[v].filter(Number.isFinite)
  return {
    variant: v, delta: est, lo: pctile(ds, 0.05), hi: pctile(ds, 0.95), lo95: pctile(ds, 0.025), hi95: pctile(ds, 0.975),
    p: (1 + ds.filter(x => x <= 0).length) / (1 + ds.length), improved: per.filter(x => x > 0).length, perAsset: per,
    delta2: P.mean(UN.map(a => TABLE.assets[a.key][v][2].sharpe - TABLE.assets[a.key].V0[2].sharpe)),
  }
})
const holm = (() => { const o = CONF.map((c, i) => [c.p, i] as const).sort((x, y) => x[0] - y[0]); const adj = new Array<number>(o.length); let run = 0; o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (o.length - r) * p)); adj[i] = run }); return adj })()
const DECISION = CONF.map((c, i) => ({ ...c, pHolm: holm[i], demonstrated: holm[i] < 0.05 && c.improved >= 6 && c.delta2 > 0 }))

// BTC/ETH (descriptif) : écart de Sharpe du portefeuille, bootstrap par mois apparié.
const pMonths = [...new Set(PORT.V0[1].days.map(P.monthKey))].sort((x, y) => x - y)
const pidx = new Map(pMonths.map((m, j) => [m, j]))
const PAGG = Object.fromEntries(VARIANTS.map(v => { const d = PORT[v][1]; const g = { s: new Float64Array(pMonths.length), q: new Float64Array(pMonths.length), n: new Float64Array(pMonths.length) }; d.days.forEach((day, i) => { const j = pidx.get(P.monthKey(day))!; g.s[j] += d.r[i]; g.q[j] += d.r[i] ** 2; g.n[j]++ }); return [v, g] })) as Record<Variant, Agg>
const R2 = P.rng(CFG.seed + 1)
const pBoot: Record<string, number[]> = Object.fromEntries(TESTED.map(v => [v, [] as number[]]))
for (let rep = 0; rep < CFG.boot; rep++) {
  const draw = Array.from({ length: pMonths.length }, () => Math.floor(R2() * pMonths.length))
  const tot = (v: Variant) => { let s = 0, q = 0, n = 0; for (const j of draw) { s += PAGG[v].s[j]; q += PAGG[v].q[j]; n += PAGG[v].n[j] } return shAgg(s, q, n) }
  const s0 = tot('V0')
  for (const v of TESTED) pBoot[v].push(tot(v) - s0)
}
const PORT_DELTA = TESTED.map(v => ({ variant: v, delta: TABLE.portfolio[v][1].sharpe - TABLE.portfolio.V0[1].sharpe, lo: pctile(pBoot[v], 0.025), hi: pctile(pBoot[v], 0.975) }))

// Fenêtres chronologiques : années civiles.
const yearOfDay = (d: number) => new Date(d * DAY).getUTCFullYear()
function byYear(d: { days: number[]; r: number[] }) {
  const m = new Map<number, number[]>()
  d.days.forEach((day, i) => { const y = yearOfDay(day); if (!m.has(y)) m.set(y, []); m.get(y)!.push(d.r[i]) })
  return m
}
const comp = (r: number[]) => r.reduce((s, x) => s * (1 + x), 1) - 1
const YEARS = (() => {
  const p0 = byYear(PORT.V0[1])
  const port = TESTED.map(v => { const pv = byYear(PORT[v][1]); return { variant: v, years: [...p0.keys()].map(y => ({ year: y, days: p0.get(y)!.length, dSharpe: sharpeOf(pv.get(y)!) - sharpeOf(p0.get(y)!), dReturn: comp(pv.get(y)!) - comp(p0.get(y)!) })) } })
  const allYears = [...new Set(UN.flatMap(a => [...byYear(RUNS.get(a.key)!.V0[1].daily).keys()]))].sort()
  const un = TESTED.map(v => ({ variant: v, years: allYears.map(y => {
    const ds = UN.map(a => { const b0 = byYear(RUNS.get(a.key)!.V0[1].daily).get(y), b1 = byYear(RUNS.get(a.key)![v][1].daily).get(y); return b0 && b0.length >= 60 ? sharpeOf(b1!) - sharpeOf(b0) : NaN }).filter(Number.isFinite)
    return { year: y, assets: ds.length, dSharpe: ds.length ? P.mean(ds) : NaN }
  }) }))
  return { portfolio: port, unseen: un }
})()
log('phases 2–3')

// ================================================================ 5. rapport
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/regime-fakeout.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
const avgOf = (v: Variant, f: (s: ReturnType<typeof summary>) => number) => P.mean(UN.map(a => f(TABLE.assets[a.key][v][1])))
const RESULT = { plan: PLAN, generatedAt: new Date().toISOString(), git, config: CFG, checks, phase1: PHASE1, splits: SPLITS, variants: { table: TABLE, confirmatory: DECISION, portfolioDelta: PORT_DELTA, years: YEARS }, assets: ASSETS.map(a => ({ key: a.key, label: a.label, unseen: a.unseen, from: new Date(a.bars.t[a.lo]).toISOString(), to: new Date(a.bars.t[a.end]).toISOString() })) }
writeFileSync(join(OUT, 'regime-fakeout.json'), JSON.stringify(RESULT, (_, v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(8) : v), 1) + '\n')

const MINUS = '−'
const fin = (x: number) => Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 1) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const pv = (p: number) => (p < 0.001 ? '< 0,001' : num(p, 3))
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }
const VLABEL: Record<Variant, string> = { V0: 'V0 · référence E2', V1: 'V1 · anti-range', V2: 'V2 · confirmation retardée en range', V3: 'V3 · sorties du jeu agité en range' }
const anyDemo = DECISION.some(d => d.demonstrated)

L.push('# Régime directionnel avant le signal et coût des faux départs', '')
L.push(`Plan : \`${PLAN}\`, commité avant tout calcul variable–résultat. Script : \`research/shock/regime-fakeout.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}). Moteur non modifié ; variantes = listes d'entrées et sélection de jeux passées à \`simulate\`.`, '')
L.push('**Statut.** BTC/ETH : données de développement de la stratégie, descriptif. 8 actifs vierges (XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC) : jamais utilisés pour concevoir la stratégie ni ces variantes (leurs résultats v1 avaient été vus dans l\'étude des shorts) ; test confirmatoire. Aucun test prospectif.', '')
L.push('## Verdict (règle fixée d\'avance, § 6)', '')
for (const d of DECISION) L.push(`- **${VLABEL[d.variant]}** : Δ Sharpe moyen sur 8 actifs vierges ${sg(d.delta, 3)} (IC 90 % ${sg(d.lo, 3)} à ${sg(d.hi, 3)}), p = ${pv(d.p)}, p Holm = ${pv(d.pHolm)}, amélioration sur ${d.improved}/8 actifs, coûts × 2 : ${sg(d.delta2, 3)} → **${d.demonstrated ? 'avantage démontré (candidate, à valider en forward)' : 'avantage non démontré'}**.`)
L.push('', anyDemo ? 'Une variante passe la règle : elle devient seulement une candidate ; le Shock Engine de référence reste inchangé jusqu\'à une validation forward pré-enregistrée.' : '**Aucune variante ne passe la règle. Le Shock Engine de référence (V0) reste inchangé.**', '')

{
  const dev = PHASE1['BTC/ETH (développement)'].er, un = PHASE1['8 actifs vierges (réplication)'].er
  const re = (m: typeof dev, j: number) => m.rows[j].reentry[1]
  const othersRe = (m: typeof dev) => P.mean(m.rows.slice(1).map(r => r.reentry[1]))
  L.push('## Lecture', '')
  L.push(`- **Coût des faux départs en range.** Les signaux déclenchés après un marché peu directionnel (quartile bas de l'ER 5 h) ne rapportent pas moins que les autres : D1 = ${sg(dev.D1.est, 2)} R ${'['}${sg(dev.D1.lo, 2)} ; ${sg(dev.D1.hi, 2)}] sur BTC/ETH et ${sg(un.D1.est, 2)} R [${sg(un.D1.lo, 2)} ; ${sg(un.D1.hi, 2)}] sur les actifs vierges. L'hypothèse « le coût principal vient des faux départs en range » n'est pas soutenue ; l'hypothèse inverse (la consolidation prépare les grands mouvements) n'est pas démontrée non plus.`)
  L.push(`- **Les faux départs sont aussi fréquents partout.** Le prix revient de l'autre côté du niveau cassé dans les 4 bougies pour ${pc(re(dev, 0), 0)} des trades en range marqué contre ${pc(othersRe(dev), 0)} ailleurs (BTC/ETH), ${pc(re(un, 0), 0)} contre ${pc(othersRe(un), 0)} (actifs vierges). Le régime avant le signal ne dit pas quand une cassure échouera.`)
  const gap = (m: typeof dev) => Math.max(...m.rows.map(r => Math.abs(r.bigShare - r.share)))
  L.push(`- **Grands gagnants.** Part des grands gagnants dans chaque groupe : ${dev.rows.map(r => pc(r.bigInGroup, 0)).join(', ')} (BTC/ETH), ${un.rows.map(r => pc(r.bigInGroup, 0)).join(', ')} (actifs vierges), pour 10 % en moyenne. Écart maximal entre la part d'un groupe dans les grands gagnants et sa part dans les trades : ${pc(gap(dev), 1)} (BTC/ETH), ${pc(gap(un), 1)} (actifs vierges).`)
  const sec = (['er2', 'adx', 'fake'] as const).map(k => ({ k, a: PHASE1['BTC/ETH (développement)'][k].D1, b: PHASE1['8 actifs vierges (réplication)'][k].D1 }))
  const excl = (d: { lo: number; hi: number }) => d.lo > 0 || d.hi < 0
  L.push(`- **Mesures secondaires** (D1, quartile bas − autres, BTC/ETH puis actifs vierges) : ${sec.map(x => `${MEASURE_LABEL[x.k]} ${sg(x.a.est, 2)} / ${sg(x.b.est, 2)}`).join(' ; ')}. Intervalle excluant zéro : ${sec.filter(x => excl(x.a) || excl(x.b)).map(x => MEASURE_LABEL[x.k]).join(', ') || 'aucun'} ; sens opposés entre les deux échantillons : ${sec.filter(x => Math.sign(x.a.est) !== Math.sign(x.b.est)).map(x => MEASURE_LABEL[x.k]).join(', ') || 'aucun'}.`)
  const T = TABLE.portfolio
  L.push(`- **Variantes.** Retirer, confirmer ou gérer autrement les entrées en range ne change pas le Sharpe de façon démontrable (actifs vierges : Δ de ${DECISION.map(d => sg(d.delta, 3)).join(', ')} ; BTC/ETH : ${PORT_DELTA.map(d => sg(d.delta, 3)).join(', ')}). Le filtre anti-range fait passer le drawdown de ${pc(T.V0[1].maxDD)} à ${pc(T.V1[1].maxDD)} sur BTC/ETH (moyenne des vierges : ${pc(avgOf('V0', s => s.maxDD))} à ${pc(avgOf('V1', s => s.maxDD))}), mais la somme des R passe de ${num(T.V0[1].sumR, 0)} à ${num(T.V1[1].sumR, 0)} sur BTC/ETH : les trades en range retirés ${T.V1[1].sumR < T.V0[1].sumR ? 'étaient, en somme, gagnants' : 'étaient, en somme, perdants'}.`, '')
}

for (const [sname, ms] of Object.entries(PHASE1)) {
  L.push(`## Phase 1 — matrice de rendement conditionnel · ${sname}`, '')
  const m = ms.er
  L.push(`${m.n} trades · régime : quartile du percentile causal (90 jours) de l'ER 20 bougies avant la bougie de signal · grands gagnants : R ≥ ${num(m.bigThreshold, 2)} (90e centile) · ${m.undefinedPct} trade(s) sans percentile.`, '')
  tbl(['Régime avant signal', 'Trades', 'Taux de gain [Wilson 95 %]', 'R moyen [IC 95 %]', 'R médian', 'Gain/perte moyen', 'PF (R)', 'MFE méd. (R)', 'MAE méd. (R)', 'Réintégration 1 / 4 / 16 bougies', 'Grands gagnants : part du groupe', 'Part de tous les grands gagnants', 'Part de ΣR', 'Part des pertes'],
    m.rows.map(r => [r.group, `${r.n} (${pc(r.share, 0)})`, `${pc(r.winRate)} [${pc(r.winLo, 0)} ; ${pc(r.winHi, 0)}]`, `${sg(r.meanR)} [${sg(r.meanLo)} ; ${sg(r.meanHi)}]`, sg(r.medianR), num(r.payoff), num(r.pf), num(r.mfe), sg(r.mae), r.reentry.map(x => pc(x, 0)).join(' / '), pc(r.bigInGroup), pc(r.bigShare), pc(r.sumRShare), pc(r.lossShare)]))
  L.push(`**D1 = R moyen (range marqué) − R moyen (autres)** : ${sg(m.D1.est, 3)} R (IC 95 % ${sg(m.D1.lo, 3)} à ${sg(m.D1.hi, 3)}, p bilatéral ${pv(m.D1.pTwoSided)}, ${m.D1.n0} contre ${m.D1.n1} trades).`, '')
  L.push('Mesures secondaires (mêmes quartiles de percentile causal) :', '')
  for (const k of ['er2', 'adx', 'fake'] as const) {
    const s = ms[k]
    tbl([s.label, 'Trades', 'Taux de gain', 'R moyen [IC 95 %]', 'Réintégration 4 bougies', 'Part de tous les grands gagnants', 'Part de ΣR'], s.rows.map(r => [r.group.replace('Range marqué', 'Q1 (bas)').replace('Range modéré', 'Q2').replace('Tendance modérée', 'Q3').replace('Tendance forte', 'Q4 (haut)'), r.n, pc(r.winRate), `${sg(r.meanR)} [${sg(r.meanLo)} ; ${sg(r.meanHi)}]`, pc(r.reentry[1], 0), pc(r.bigShare), pc(r.sumRShare)]))
    L.push(`D1 (Q1 − autres) : ${sg(s.D1.est, 3)} R (IC 95 % ${sg(s.D1.lo, 3)} à ${sg(s.D1.hi, 3)}) · ${s.undefinedPct} trade(s) sans percentile.`, '')
  }
}
L.push('## Phase 1 — découpages de l\'ER principal (descriptif)', '')
for (const [sname, sp] of Object.entries(SPLITS)) {
  tbl([sname, 'Trades', ...GROUPS.map(g => `R moyen · ${g}`), 'D1 [IC 95 %]'], Object.entries(sp).map(([k, m]) => [k, m.n, ...m.rows.map(r => `${sg(r.meanR)} (${r.n})`), `${sg(m.D1.est)} [${sg(m.D1.lo)} ; ${sg(m.D1.hi)}]`]))
}

L.push('## Phases 2–3 — variantes rejouées en portefeuille complet', '')
L.push('Variantes fixées dans le plan (§ 5). « Range » : percentile ER 20 < 0,25 à la bougie de signal. Coûts × 1 sauf mention.', '')
L.push('### Actifs vierges (confirmatoire) : Sharpe journalier par actif', '')
tbl(['Actif', 'Fenêtre', ...VARIANTS.map(v => `Sharpe ${v}`), ...TESTED.map(v => `Δ ${v}`)], UN.map(a => { const T = TABLE.assets[a.key]; const r = RESULT.assets.find(x => x.key === a.key)!; return [a.key, `${r.from.slice(0, 10)} → ${r.to.slice(0, 10)}`, ...VARIANTS.map(v => num(T[v][1].sharpe)), ...TESTED.map(v => sg(T[v][1].sharpe - T.V0[1].sharpe))] }))
tbl(['Variante', 'Δ moyen', 'IC 90 % (bootstrap)', 'IC 95 %', 'p', 'p Holm', 'Actifs améliorés', 'Δ coûts × 2', 'Verdict'], DECISION.map(d => [VLABEL[d.variant], sg(d.delta, 3), `${sg(d.lo, 3)} à ${sg(d.hi, 3)}`, `${sg(d.lo95, 3)} à ${sg(d.hi95, 3)}`, pv(d.p), pv(d.pHolm), `${d.improved}/8`, sg(d.delta2, 3), d.demonstrated ? '**démontré**' : 'non démontré']))
L.push('### Actifs vierges : autres mesures (moyennes sur 8 actifs)', '')
const avg = (v: Variant, f: (s: ReturnType<typeof summary>) => number) => P.mean(UN.map(a => f(TABLE.assets[a.key][v][1])))
const pooledTop5 = (v: Variant) => P.topShare(UN.flatMap(a => RUNS.get(a.key)![v][1].trades.map(t => t.R)), 0.05).share
tbl(['Variante', 'Sharpe', 'CAGR', 'Drawdown max.', 'PF', 'Trades / actif', 'ΣR / actif', 'Part des 5 % meilleurs trades dans ΣR (8 actifs mis en commun)', 'Entrées déplacées / retirées (total)'], VARIANTS.map(v => [VLABEL[v], num(avg(v, s => s.sharpe)), pc(avg(v, s => s.cagr)), pc(avg(v, s => s.maxDD)), num(avg(v, s => s.pf)), num(avg(v, s => s.trades), 0), num(avg(v, s => s.sumR), 0), pc(pooledTop5(v), 0), `${UN.reduce((s, a) => s + TABLE.assets[a.key][v][1].moved, 0)} / ${UN.reduce((s, a) => s + TABLE.assets[a.key][v][1].dropped, 0)}`]))
L.push('### BTC/ETH, portefeuille 50/50 sans rebalancement (descriptif : données de développement)', '')
tbl(['Variante', 'Sharpe', 'Δ Sharpe [IC 95 %]', 'CAGR', 'Drawdown max.', 'PF', 'Trades', 'ΣR', 'Part des 5 % meilleurs trades', 'Sharpe coûts × 2'], VARIANTS.map(v => { const T = TABLE.portfolio[v]; const d = PORT_DELTA.find(x => x.variant === v); return [VLABEL[v], num(T[1].sharpe), d ? `${sg(d.delta, 3)} [${sg(d.lo, 3)} ; ${sg(d.hi, 3)}]` : '—', pc(T[1].cagr), pc(T[1].maxDD), num(T[1].pf), T[1].trades, num(T[1].sumR, 0), pc(T[1].top5, 0), num(T[2].sharpe)] }))
L.push('### Fenêtres chronologiques : écart de Sharpe par année civile', '')
const yrs = YEARS.portfolio[0].years.map(y => y.year)
tbl(['Variante', ...yrs.map(String), 'Années améliorées'], YEARS.portfolio.map(p => [`${VLABEL[p.variant]} · BTC/ETH`, ...p.years.map(y => sg(y.dSharpe)), `${p.years.filter(y => y.dSharpe > 0).length}/${p.years.length}`]))
const uyrs = YEARS.unseen[0].years.map(y => y.year)
tbl(['Variante', ...uyrs.map(String), 'Années améliorées'], YEARS.unseen.map(p => [`${VLABEL[p.variant]} · 8 vierges`, ...p.years.map(y => (fin(y.dSharpe) ? `${sg(y.dSharpe)} (${y.assets})` : '—')), `${p.years.filter(y => y.dSharpe > 0).length}/${p.years.filter(y => fin(y.dSharpe)).length}`]))
L.push('Actifs vierges : moyenne des écarts de Sharpe des actifs ayant au moins 60 jours dans l\'année (nombre entre parenthèses). Années incomplètes en début et fin de fenêtre.', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Écarts au plan', '', '1. **Part des 5 % meilleurs trades, actifs vierges.** Au premier lancement, ce ratio descriptif était moyenné d\'un actif à l\'autre ; il explose quand la somme des R d\'un actif est proche de zéro (valeurs de −741 % à 2 200 %). Il est maintenant calculé sur les trades des 8 actifs mis en commun. Aucune autre mesure, aucun test et aucune décision ne changent.', '')
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/regime-fakeout.ts', '```', '')
writeFileSync(join(OUT, 'regime-fakeout.md'), L.join('\n'))
log('rapport')
