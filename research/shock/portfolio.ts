// Portefeuille Shock Engine BTC/ETH : les deux stratégies figées (préréglage du bot, choisi sur
// BTC, appliqué tel quel à ETH), combinées 50/50 sur la période commune. Mesure et documentation
// seulement : aucun réglage, aucun poids, aucune période n'est choisi d'après le résultat.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/portfolio.ts [--boot 5000]
//
// 1. Sleeves : exactement le chemin de zero-shot.ts (research/lib/frozen-shock.ts), vérifié contre
//    les rapports validés shock-15m-zeroshot-{btc,ethusdt}.json avant tout calcul.
// 2. Capital : au jour 0, chaque sleeve reçoit 50 et ne compose que son propre capital ; la valeur
//    du portefeuille est la somme des deux sleeves (pas de levier implicite).
// 3. Portefeuille officiel : A, 50/50 au départ, sans rebalancement. Diagnostics : B, rebalancement
//    mensuel 50/50 ; C (exploratoire), risque égal causal sur 90 jours, rebalancement mensuel.
// 4. Sorties : research/reports/btc-eth-portfolio/ (HTML, CSV, JSON, manifeste).

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLEEVES, costsFor, loadSleeve, runDetailed } from '../lib/frozen-shock.ts'
import type { Detailed, Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { metricsOf } from '../lib/stats.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import * as P from '../lib/portfolio.ts'
import { renderReport } from './portfolio-html.ts'
import { trendDown } from '../lib/e2.ts'
import { loadBtc } from '../lib/data.ts'
import { resample } from '../../lib/backtest/data.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
// --variant e2 : les shorts ne sont autorisés qu'en régime de tendance journalier baissier
// (research/lib/e2.ts), spécification publique du Shock Engine depuis octobre 2026. Sorties à part :
// les résultats de la v1 (research/reports/btc-eth-portfolio/) restent tels quels.
const VARIANT = opt('variant', 'v1')
if (VARIANT !== 'v1' && VARIANT !== 'e2') throw new Error(`variante inconnue : ${VARIANT}`)
const E2V = VARIANT === 'e2'
const OUT = join(ROOT, E2V ? 'research/reports/btc-eth-portfolio-e2' : 'research/reports/btc-eth-portfolio')
/** Rapport validé de référence de chaque sleeve : zero-shot.ts (avec --e2 pour la variante E2). */
const VALIDATED = (key: SleeveKey) => (E2V ? `research/reports/shock-15m-zeroshot-${key}-e2.json` : SLEEVES[key].validated)
const MANIFEST = E2V ? 'shock-engine-manifest.json' : 'shock-engine-v1-manifest.json'
const NBOOT = Number(opt('boot', '5000'))
const SEED = 20261008
const DAY = P.DAY, M15 = 15 * 60000, ANN = P.ANN
const COMM = 0.045 / 100
const VOL_WIN = 90
const KS = [0, 1, 2] as const
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ================================================================ 1. sleeves figées
const NAMES: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const S: Record<SleeveKey, Sleeve> = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') }
// Variante E2 : mêmes sleeves, entrées short masquées hors régime de tendance baissier, sur les mêmes
// barres journalières que le régime de volatilité.
if (E2V) for (const key of KEYS) {
  const s = S[key]
  const trend = trendDown(s.bars, key === 'btc' ? resample(loadBtc(60), DAY) : resample(s.bars, DAY))
  const signals = { long: s.signals.long, short: Uint8Array.from(s.signals.short, (x, i) => (x && trend[i] ? 1 : 0)) }
  S[key] = { ...s, signals, run: (k: number) => simulate(s.m, s.preset.sets, costsFor(key, k), s.lo, s.end, s.select, signals) }
}
const R: Record<SleeveKey, Record<number, Detailed>> = { btc: {}, ethusdt: {} }
const checks: { name: string; detail: string; ok: boolean }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const asResult = (d: Detailed) => d as unknown as ShockResult
const reconcile: { key: string; k: number; field: string; validated: number; recomputed: number }[] = []

for (const key of KEYS) {
  const s = S[key]
  const ref = JSON.parse(readFileSync(join(ROOT, VALIDATED(key)), 'utf8'))
  for (const k of KS) {
    R[key][k] = runDetailed(s, k)
    const sim = s.run(k)
    let dEq = 0
    for (let i = 0; i < sim.equity.length; i++) dEq = Math.max(dEq, Math.abs(sim.equity[i] - R[key][k].equity[i]))
    check(`${NAMES[key]} ×${k}: detailed loop = simulate()`, dEq === 0 && sim.positions.length === R[key][k].positions.length, `max |Δequity| ${dEq}, trades ${sim.positions.length} / ${R[key][k].positions.length}`)
    const mt = metricsOf(s.bars, sim, s.lo, s.end)
    const v = ref.strategy.preset.costs[k].s
    const pairs: [string, number, number][] = [['totalReturn', v.totalReturn, mt.totalReturn], ['cagr', v.cagr, mt.cagr], ['sharpe', v.sharpe, mt.sharpe], ['maxDD', v.dd, mt.maxDrawdown], ['profitFactor', v.pf, mt.profitFactor], ['trades', v.trades, sim.positions.length]]
    let worst = 0
    for (const [field, a, b] of pairs) { reconcile.push({ key: NAMES[key], k, field, validated: a, recomputed: b }); worst = Math.max(worst, Math.abs(a - b) / Math.max(1, Math.abs(a))) }
    check(`${NAMES[key]} ×${k}: full-period metrics = validated report`, worst < 1e-9, `${VALIDATED(key)}, worst relative gap ${worst.toExponential(1)}`)
  }
  // Comptes : capital final = capital + somme des PnL des positions (toutes fermées en fin de run de référence ou valorisées).
  const d = R[key][1]
  const closed = d.positions.reduce((a, p) => a + p.pnl, 0)
  const open = d.equity[s.end] - 10000 - closed
  check(`${NAMES[key]}: equity = capital + Σ trade PnL (+ open position)`, Math.abs(open) < 1e-6 || d.position[s.end] !== 0, `residual ${open.toFixed(9)} (open position at end: ${d.position[s.end] !== 0})`)
  const feeGap = Math.abs(d.cumFees[s.end] - COMM * (d.cumEntry[s.end] + d.cumExit[s.end])) / d.cumFees[s.end]
  check(`${NAMES[key]}: commissions charged once per fill`, feeGap < 1e-9, `Σ fees vs 0.045 % × (entries + exits), relative gap ${feeGap.toExponential(1)}`)
  const lev = Math.max(...d.positions.map(p => p.notional / p.equityAtEntry))
  check(`${NAMES[key]}: no leverage at entry`, lev <= 1 + 1e-12, `max entry notional / sleeve equity = ${lev.toFixed(12)}`)
}
log('sleeves reproduites')

// ================================================================ 2. période commune
const tStart = Math.max(...KEYS.map(k => S[k].bars.t[S[k].lo]))
const tEnd = Math.min(...KEYS.map(k => S[k].bars.t[S[k].end] + M15))
const D0 = Math.ceil(tStart / DAY), D1 = Math.floor(tEnd / DAY) - 1
const days: number[] = []
for (let d = D0; d <= D1; d++) days.push(d)
const ND = days.length, YEARS = ND / ANN
const idxAt = (s: Sleeve, ms: number) => { const t = s.bars.t; let lo = 0, hi = s.bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const win = Object.fromEntries(KEYS.map(k => { const a = idxAt(S[k], D0 * DAY), b = idxAt(S[k], (D1 + 1) * DAY) - 1; return [k, { a, b }] })) as Record<SleeveKey, { a: number; b: number }>
log(`période commune ${P.isoDay(D0)} → ${P.isoDay(D1)}, ${ND} jours`)

// Alignement : barres sur la grille de 15 min UTC, croissantes, dans la fenêtre.
for (const key of KEYS) {
  const { t } = S[key].bars, { a, b } = win[key]
  let off = 0, back = 0
  for (let i = a; i <= b; i++) { if (t[i] % M15 !== 0) off++; if (i > a && t[i] <= t[i - 1]) back++ }
  check(`${NAMES[key]}: timestamps on the UTC 15-min grid`, off === 0 && back === 0, `${b - a + 1} bars, ${off} off-grid, ${back} non-increasing (bar-open timestamps, ms UTC)`)
}

// ================================================================ 3. séries journalières et grille 15 min
interface Daily { eq: number[]; r: number[]; base: number; x: number[]; missing: number; flatNoPos: number }
function daily(key: SleeveKey, d: Detailed): Daily {
  const s = S[key], { a, b } = win[key], t = s.bars.t
  const base = d.equity[a - 1]
  const { eq, missing } = P.dayCloses(t, d.equity, a, b, days, base)
  const r = P.returnsOf(eq, base)
  // Exposition brute de la sleeve à la clôture du jour (nominal / equity), pour le coût du rebalancement.
  const x: number[] = []
  let i = a
  const inPosDay: boolean[] = []
  let prevPos = d.position[a - 1] !== 0
  for (let k = 0; k < ND; k++) {
    const endMs = (days[k] + 1) * DAY
    let last = -1, any = prevPos
    while (i <= b && t[i] < endMs) { last = i; if (d.position[i] !== 0) any = true; i++ }
    x.push(last >= 0 ? Math.abs(d.notional[last]) / d.equity[last] : x[k - 1] ?? 0)
    if (last >= 0) prevPos = d.position[last] !== 0
    inPosDay.push(any)
  }
  // Jour à rendement nul : aucune position à aucune clôture du jour ni à la veille au soir.
  let flatNoPos = 0
  for (let k = 0; k < ND; k++) if (r[k] === 0 && !inPosDay[k]) flatNoPos++
  return { eq, r, base, x, missing, flatNoPos }
}
const DL: Record<SleeveKey, Record<number, Daily>> = { btc: {}, ethusdt: {} }
for (const key of KEYS) for (const k of KS) DL[key][k] = daily(key, R[key][k])
const rb = DL.btc[1].r, re = DL.ethusdt[1].r
for (const key of KEYS) {
  const dl = DL[key][1]
  check(`${NAMES[key]}: one close per day, no interpolation`, dl.missing === 0, `${ND} days, ${dl.missing} days without a bar (carried, return 0)`)
  const zeros = dl.r.filter(x => x === 0).length
  check(`${NAMES[key]}: zero-return days are days without a position`, zeros === dl.flatNoPos, `${zeros} zero-return days, ${dl.flatNoPos} of them flat all day`)
}

// Grille de 15 min (dernière barre connue, jamais interpolée) pour l'intrajournalier.
const G = (D1 + 1 - D0) * 96
interface Grid { eq: Float64Array; not: Float64Array; pos: Int8Array; close: Float64Array; exact: number }
function grid(key: SleeveKey, d: Detailed): Grid {
  const s = S[key], { a, b } = win[key], t = s.bars.t
  const eq = new Float64Array(G), not = new Float64Array(G), pos = new Int8Array(G), close = new Float64Array(G)
  let i = a - 1, exact = 0
  for (let g = 0; g < G; g++) {
    const ms = D0 * DAY + g * M15
    while (i + 1 <= b && t[i + 1] <= ms) i++
    if (t[i] === ms) exact++
    eq[g] = d.equity[i]; not[g] = d.notional[i]; pos[g] = d.position[i]; close[g] = s.bars.c[i]
  }
  return { eq, not, pos, close, exact }
}
const GR: Record<SleeveKey, Grid> = { btc: grid('btc', R.btc[1]), ethusdt: grid('ethusdt', R.ethusdt[1]) }
log('séries journalières')

// ================================================================ 4. portefeuilles
const ME = P.monthEnds(days)
const books = (k: number) => {
  const a = DL.btc[k].r, b = DL.ethusdt[k].r, xA = DL.btc[k].x, xB = DL.ethusdt[k].x
  return {
    A: P.book(a, b),
    B: P.book(a, b, { rebalance: ME, target: () => 0.5, xA, xB, comm: COMM * k }),
    C: P.book(a, b, { rebalance: ME, target: P.equalRiskTarget(a, b, VOL_WIN), xA, xB, comm: COMM * k }),
  }
}
const BK = Object.fromEntries(KS.map(k => [k, books(k)])) as Record<number, ReturnType<typeof books>>
const A = BK[1].A, B = BK[1].B, C = BK[1].C
const rp = A.r

// Capital : V(0⁻) = 50 + 50 ; chaque jour, valeur = somme des sleeves ; sleeve = 50 × equity / equity(t0⁻).
let dSum = 0, dSleeve = 0, dComp = 0, dLin = 0
const compP = P.compound(rp, 100)
for (let k = 0; k < ND; k++) {
  dSum = Math.max(dSum, Math.abs(A.vA[k] + A.vB[k] - A.v[k]))
  dSleeve = Math.max(dSleeve, Math.abs(A.vA[k] - 50 * DL.btc[1].eq[k] / DL.btc[1].base) / A.vA[k], Math.abs(A.vB[k] - 50 * DL.ethusdt[1].eq[k] / DL.ethusdt[1].base) / A.vB[k])
  dComp = Math.max(dComp, Math.abs(compP[k] - A.v[k]) / A.v[k])
  const wPrev = k ? A.vA[k - 1] / A.v[k - 1] : 0.5
  dLin = Math.max(dLin, Math.abs(rp[k] - (wPrev * rb[k] + (1 - wPrev) * re[k])))
}
check('Capital: BTC sleeve 50 + ETH sleeve 50 = 100 at t0', A.vA.length === ND && Math.abs(50 * (1 + rb[0]) - A.vA[0]) < 1e-9 && Math.abs(50 * (1 + re[0]) - A.vB[0]) < 1e-9, 'each sleeve compounds only its own 50')
check('Capital: portfolio = BTC sleeve + ETH sleeve, every day', dSum < 1e-9, `max |V − (V_BTC + V_ETH)| = ${dSum.toExponential(1)}`)
check('Sleeve value = 50 × strategy equity / equity at t0 (engine is scale-invariant)', dSleeve < 1e-12, `max relative gap ${dSleeve.toExponential(1)}`)
check('No double compounding: Π(1 + r_portfolio) reproduces the portfolio value', dComp < 1e-12, `max relative gap ${dComp.toExponential(1)}`)
check('Portfolio return = drifting-weight average of sleeve returns', dLin < 1e-12, `max |r_p − (w_BTC r_BTC + w_ETH r_ETH)| = ${dLin.toExponential(1)}, weights from the previous close`)

// Portefeuille sur la grille de 15 min.
const sb = 50 / DL.btc[1].base, se = 50 / DL.ethusdt[1].base
const VG = new Float64Array(G), gross = new Float64Array(G), net = new Float64Array(G)
for (let g = 0; g < G; g++) {
  const vb = GR.btc.eq[g] * sb, ve = GR.ethusdt.eq[g] * se
  VG[g] = vb + ve
  gross[g] = (Math.abs(GR.btc.not[g]) * sb + Math.abs(GR.ethusdt.not[g]) * se) / VG[g]
  net[g] = (GR.btc.not[g] * sb + GR.ethusdt.not[g] * se) / VG[g]
}
const ddIntraday = { btc: P.maxDrawdown(GR.btc.eq, DL.btc[1].base), eth: P.maxDrawdown(GR.ethusdt.eq, DL.ethusdt[1].base), portfolio: P.maxDrawdown(VG, 100) }
const dayEndG = days.map((_, k) => (k + 1) * 96 - 1)
let dG = 0
for (let k = 0; k < ND; k++) dG = Math.max(dG, Math.abs(VG[dayEndG[k]] - A.v[k]) / A.v[k])
check('15-min portfolio marks agree with daily closes', dG < 1e-12, `max relative gap at 23:45 bars ${dG.toExponential(1)}`)

// Le plus fort lien entre les rendements 15 min des deux sous-jacents doit être au décalage 0.
const lagCorr = [-4, -3, -2, -1, 0, 1, 2, 3, 4].map(L => {
  const x: number[] = [], y: number[] = []
  for (let g = 1 + Math.abs(L); g < G - Math.abs(L); g++) { x.push(Math.log(GR.btc.close[g] / GR.btc.close[g - 1])); y.push(Math.log(GR.ethusdt.close[g + L] / GR.ethusdt.close[g + L - 1])) }
  return { lag: L, corr: P.pearson(x, y) }
})
const bestLag = lagCorr.reduce((a, b) => (b.corr > a.corr ? b : a))
check('BTC/ETH timestamps not shifted (15-min underlying returns peak at lag 0)', bestLag.lag === 0, lagCorr.map(x => `${x.lag > 0 ? '+' : ''}${x.lag}: ${x.corr.toFixed(3)}`).join(' · '))
log('portefeuilles')

// ================================================================ 5. mesures par série
interface Trade { sleeve: string; dir: 1 | -1; entryT: number; exitT: number; ret: number; pnlCcy: number; contrib: number }
function tradesOf(key: SleeveKey, k = 1): Trade[] {
  const s = S[key], { a, b } = win[key], d = R[key][k], scale = 50 / DL[key][k].base
  return d.positions.filter(p => p.entryIdx >= a && p.entryIdx <= b).map(p => {
    const g = Math.min(G - 1, Math.max(0, Math.round((s.bars.t[p.entryIdx] - D0 * DAY) / M15)))
    return { sleeve: NAMES[key], dir: p.dir, entryT: s.bars.t[p.entryIdx] + M15, exitT: s.bars.t[p.exitIdx] + M15, ret: p.pnl / p.equityAtEntry, pnlCcy: p.pnl * scale, contrib: (p.pnl * scale) / VG[g] }
  })
}
const TR = { btc: tradesOf('btc'), ethusdt: tradesOf('ethusdt') }
const TP = [...TR.btc, ...TR.ethusdt].sort((x, y) => x.entryT - y.entryT)
function tradeStats(ts: Trade[], field: 'ret' | 'contrib') {
  const r = ts.map(x => x[field]), w = r.filter(x => x > 0), l = r.filter(x => x <= 0)
  const gp = ts.filter(x => x.pnlCcy > 0).reduce((a, x) => a + x.pnlCcy, 0), gl = ts.filter(x => x.pnlCcy <= 0).reduce((a, x) => a + x.pnlCcy, 0)
  const hold = ts.map(x => (x.exitT - x.entryT) / 3600000)
  return {
    trades: ts.length, perYear: ts.length / YEARS, winners: w.length, winRate: w.length / ts.length, avgWin: P.mean(w), avgLoss: P.mean(l), payoff: P.mean(w) / -P.mean(l),
    profitFactor: gp / -gl, skew: P.moments(r).skew, holdMeanH: P.mean(hold), holdMedianH: P.quantile(hold, 0.5), long: ts.filter(x => x.dir === 1).length, short: ts.filter(x => x.dir === -1).length,
  }
}
function costStats(key: SleeveKey | 'portfolio', k = 1) {
  const ks: SleeveKey[] = key === 'portfolio' ? KEYS : [key]
  let fees = 0, entry = 0, exit = 0
  for (const kk of ks) {
    const d = R[kk][k], { a, b } = win[kk], sc = key === 'portfolio' ? 50 / DL[kk][k].base : 1
    fees += (d.cumFees[b] - d.cumFees[a - 1]) * sc; entry += (d.cumEntry[b] - d.cumEntry[a - 1]) * sc; exit += (d.cumExit[b] - d.cumExit[a - 1]) * sc
  }
  const avg = key === 'portfolio' ? P.mean(BK[k].A.v) : P.mean(DL[key][k].eq)
  return { commissionPctYr: fees / avg / YEARS, slippagePctYr: 0, totalCostPctYr: fees / avg / YEARS, turnoverOneWay: entry / avg / YEARS, turnoverTwoWay: (entry + exit) / avg / YEARS }
}
const timeIn = (pos: Int8Array) => { let k = 0; for (let g = 0; g < G; g++) if (pos[g] !== 0) k++; return k / G }
function sleeveExposure(key: SleeveKey) {
  const gr = GR[key]
  let mx = 0, s = 0
  for (let g = 0; g < G; g++) { const x = Math.abs(gr.not[g]) / gr.eq[g]; mx = Math.max(mx, x); s += x }
  return { timeInMarket: timeIn(gr.pos), avgGross: s / G, maxGross: mx }
}
const series = {
  btc: { name: 'BTC', m: P.dailyMetrics(rb, days), trades: tradeStats(TR.btc, 'ret'), cost: costStats('btc'), expo: sleeveExposure('btc'), ddIntraday: ddIntraday.btc },
  eth: { name: 'ETH', m: P.dailyMetrics(re, days), trades: tradeStats(TR.ethusdt, 'ret'), cost: costStats('ethusdt'), expo: sleeveExposure('ethusdt'), ddIntraday: ddIntraday.eth },
  portfolio: {
    name: 'Portfolio 50/50', m: P.dailyMetrics(rp, days), trades: tradeStats(TP, 'contrib'), cost: costStats('portfolio'),
    expo: (() => { let any = 0, sg = 0, sn = 0, mx = 0; for (let g = 0; g < G; g++) { if (GR.btc.pos[g] || GR.ethusdt.pos[g]) any++; sg += gross[g]; sn += net[g]; mx = Math.max(mx, gross[g]) } return { timeInMarket: any / G, avgGross: sg / G, avgNet: sn / G, maxGross: mx } })(),
    ddIntraday: ddIntraday.portfolio,
  },
}
const variants = {
  A: { name: 'A · 50/50, no rebalancing (official)', m: series.portfolio.m, cost: series.portfolio.cost.totalCostPctYr, rebalCostPctYr: 0, rebalances: 0, wEnd: A.wA[ND - 1] },
  B: { name: 'B · 50/50, monthly rebalancing (diagnostic)', m: P.dailyMetrics(B.r, days), cost: series.portfolio.cost.totalCostPctYr, rebalCostPctYr: B.cost / P.mean(B.v) / YEARS, rebalances: B.rebalances, wEnd: B.vA[ND - 1] / B.v[ND - 1] },
  C: { name: 'C · equal risk, 90-day vol, monthly (exploratory)', m: P.dailyMetrics(C.r, days), cost: series.portfolio.cost.totalCostPctYr, rebalCostPctYr: C.cost / P.mean(C.v) / YEARS, rebalances: C.rebalances, wEnd: C.vA[ND - 1] / C.v[ND - 1] },
}
// Poids de C à chaque rebalancement (causal) et dérive des poids de A.
const erTarget = P.equalRiskTarget(rb, re, VOL_WIN)
const cWeights = days.map((d, k) => (ME[k] ? { day: d, wBtc: erTarget(k) } : null)).filter(Boolean) as { day: number; wBtc: number }[]
const aWeights = { min: Math.min(...A.wA), max: Math.max(...A.wA), mean: P.mean(A.wA), end: A.wA[ND - 1], yearEnds: days.map((d, k) => (k === ND - 1 || P.yearOf(days[k + 1]) !== P.yearOf(d) ? { day: d, wBtc: A.wA[k] } : null)).filter(Boolean) }

// Coûts × 0, × 1, × 2 (rien d'autre ne change : mêmes signaux).
const costStress = KS.map(k => ({
  k, commissionPct: 0.045 * k,
  btc: P.dailyMetrics(DL.btc[k].r, days), eth: P.dailyMetrics(DL.ethusdt[k].r, days),
  A: P.dailyMetrics(BK[k].A.r, days), B: P.dailyMetrics(BK[k].B.r, days),
  costBtc: costStats('btc', k).totalCostPctYr, costEth: costStats('ethusdt', k).totalCostPctYr, costA: costStats('portfolio', k).totalCostPctYr,
}))
const pick = (m: ReturnType<typeof P.dailyMetrics>) => ({ sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, vol: m.vol })
const costDrag = { btc: costStress[0].btc.cagr - costStress[1].btc.cagr, eth: costStress[0].eth.cagr - costStress[1].eth.cagr, portfolio: costStress[0].A.cagr - costStress[1].A.cagr }
log('mesures')

// ================================================================ 6. corrélations
const weeksB = P.periodReturns(rb, days, P.weekKey, (_, n) => n === 7), weeksE = P.periodReturns(re, days, P.weekKey, (_, n) => n === 7)
const monthsB = P.periodReturns(rb, days, P.monthKey), monthsE = P.periodReturns(re, days, P.monthKey), monthsA = P.periodReturns(rp, days, P.monthKey), monthsBk = P.periodReturns(B.r, days, P.monthKey)
const wk = weeksB.map((w, i) => [w, weeksE[i]] as const).filter(([w]) => w.full)
const bothIn = rb.map((x, i) => x !== 0 && re[i] !== 0)
const rolling = Object.fromEntries([30, 90, 252].map(w => [w, P.rollingCorr(rb, re, w)])) as Record<number, number[]>
const corr = {
  dailyPearson: P.pearson(rb, re), dailySpearman: P.spearman(rb, re),
  weekly: P.pearson(wk.map(x => x[0].ret), wk.map(x => x[1].ret)), weeks: wk.length,
  monthly: P.pearson(monthsB.map(x => x.ret), monthsE.map(x => x.ret)), months: monthsB.length,
  bothInPosition: P.subsetCorr(rb, re, bothIn),
  rolling: Object.fromEntries([30, 90, 252].map(w => [w, P.distribution(rolling[w])])),
  underlyingDaily: 0,
}
// Indépendance de calcul : Pearson par z-scores.
const zp = (() => { const ma = P.mean(rb), mb = P.mean(re), sa = P.sd(rb), sbb = P.sd(re); let s = 0; for (let i = 0; i < ND; i++) s += ((rb[i] - ma) / sa) * ((re[i] - mb) / sbb); return s / ND })()
check('Correlation recomputed independently (z-score formula)', Math.abs(zp - corr.dailyPearson) < 1e-12, `${corr.dailyPearson.toFixed(6)} vs ${zp.toFixed(6)}`)

// Sous-jacents : rendements journaliers au comptant (clôtures du jour), pour définir le stress de marché.
const spot = (key: SleeveKey) => { const s = S[key], { a, b } = win[key]; return P.returnsOf(P.dayCloses(s.bars.t, s.bars.c, a, b, days, s.bars.c[a - 1]).eq, s.bars.c[a - 1]) }
const spotB = spot('btc'), spotE = spot('ethusdt')
corr.underlyingDaily = P.pearson(spotB, spotE)
const spotEW = spotB.map((x, i) => 0.5 * (x + spotE[i]))
const spotIdx = P.compound(spotEW, 1)
const spotBear = spotIdx.map((v, i) => { let hi = 1; for (let j = Math.max(0, i - 364); j <= i; j++) hi = Math.max(hi, spotIdx[j]); return v / hi - 1 <= -0.3 })
const q = (xs: number[], p: number) => P.quantile(xs, p)
const crashCut = q(spotEW, 0.05)
const uw = P.underwater(A.v, 100)
const epA = P.episodes(A.v, 100)
const top5Declines = [...epA].sort((x, y) => x.depth - y.depth).slice(0, 5)
const inDecline = days.map((_, i) => top5Declines.some(e => i > e.peak && i <= e.trough))
const EPISODES: { name: string; from: string; to: string }[] = [
  { name: '2018 Q4 capitulation', from: '2018-11-08', to: '2018-12-15' },
  { name: 'COVID-19 crash', from: '2020-03-01', to: '2020-03-31' },
  { name: 'May–July 2021 sell-off', from: '2021-05-10', to: '2021-07-20' },
  { name: 'Terra/LUNA and 3AC', from: '2022-05-05', to: '2022-06-30' },
  { name: 'FTX collapse', from: '2022-11-06', to: '2022-11-30' },
  { name: 'August 2024 carry unwind', from: '2024-08-01', to: '2024-08-10' },
  { name: 'Oct–Nov 2025 deleveraging', from: '2025-10-06', to: '2025-11-30' },
]
const dayIdx = (s: string) => days.indexOf(Math.floor(Date.parse(s) / DAY))
const epMask = (e: { from: string; to: string }) => { const a = dayIdx(e.from), b = dayIdx(e.to); return days.map((_, i) => i >= a && i <= b) }
const anyEpisode = days.map((_, i) => EPISODES.some(e => epMask(e)[i]))
const wBar = aWeights.mean
type Rule = (a: number[], b: number[]) => boolean[]
const pOf = (a: number[], b: number[]) => a.map((x, i) => wBar * x + (1 - wBar) * b[i])
const worst = (p: number[], f: number) => { const c = q(p, f); return p.map(x => x <= c) }
const RULES: { key: string; label: string; rule?: Rule; mask?: boolean[]; group: string }[] = [
  { key: 'all', label: 'All days', mask: days.map(() => true), group: 'reference' },
  { key: 'btcNeg', label: 'BTC strategy < 0', rule: (a) => a.map(x => x < 0), group: 'return-conditioned' },
  { key: 'ethNeg', label: 'ETH strategy < 0', rule: (_, b) => b.map(x => x < 0), group: 'return-conditioned' },
  { key: 'bothNeg', label: 'Both strategies < 0', rule: (a, b) => a.map((x, i) => x < 0 && b[i] < 0), group: 'return-conditioned' },
  { key: 'pNeg', label: 'Portfolio < 0', rule: (a, b) => pOf(a, b).map(x => x < 0), group: 'return-conditioned' },
  { key: 'pWorst10', label: 'Worst 10 % portfolio days', rule: (a, b) => worst(pOf(a, b), 0.1), group: 'return-conditioned' },
  { key: 'pWorst5', label: 'Worst 5 % portfolio days', rule: (a, b) => worst(pOf(a, b), 0.05), group: 'return-conditioned' },
  { key: 'pUnder10', label: 'Portfolio more than 10 % below its peak', mask: uw.map(x => x <= -0.1), group: 'portfolio drawdown' },
  { key: 'pDecline', label: 'Decline phases of the 5 deepest portfolio drawdowns', mask: inDecline, group: 'portfolio drawdown' },
  { key: 'mktCrash', label: 'Market crash days (worst 5 % of BTC+ETH spot)', mask: spotEW.map(x => x <= crashCut), group: 'market stress (spot)' },
  { key: 'mktBear', label: 'Crypto bear market (BTC+ETH spot > 30 % below 1-year high)', mask: spotBear, group: 'market stress (spot)' },
  { key: 'episodes', label: 'Named stress episodes (pooled)', mask: anyEpisode, group: 'market stress (spot)' },
  { key: 'calm', label: 'Non-stress days (no crash day, no bear market, no episode)', mask: days.map((_, i) => !(spotEW[i] <= crashCut) && !spotBear[i] && !anyEpisode[i]), group: 'market stress (spot)' },
  { key: 'bothIn', label: 'Both sleeves exposed during the day', mask: bothIn, group: 'reference' },
]
// Dépendance des pertes : P(ETH < 0 | BTC < 0) ; P(ETH dans ses f pires jours | BTC dans ses f pires jours).
const coNeg = (a: number[], b: number[]) => a.filter((x, i) => x < 0 && b[i] < 0).length / a.filter(x => x < 0).length
const tailDep = (f: number) => (a: number[], b: number[]) => { const ca = q(a, f), cb = q(b, f); return a.filter((x, i) => x <= ca && b[i] <= cb).length / a.filter(x => x <= ca).length }
const nullRules = RULES.filter(x => x.rule)
const TAILS = [{ key: 'coNeg', f: coNeg }, { key: 'tail10', f: tailDep(0.1) }, { key: 'tail5', f: tailDep(0.05) }]
const cop = P.copulaNull(rb, re, [...nullRules.map(x => (a: number[], b: number[]) => P.subsetCorr(a, b, x.rule!(a, b)).pearson), ...TAILS.map(x => x.f)], 400, SEED)
const crisis = RULES.map(x => {
  const mask = x.mask ?? x.rule!(rb, re)
  const sc = P.subsetCorr(rb, re, mask)
  const j = nullRules.indexOf(x)
  return { key: x.key, label: x.label, group: x.group, days: sc.n, pearson: sc.pearson, spearman: sc.spearman, nullMean: j >= 0 ? cop.stats[j].mean : null, nullP5: j >= 0 ? cop.stats[j].p5 : null, nullP95: j >= 0 ? cop.stats[j].p95 : null }
})
const tailRows = TAILS.map((x, j) => ({ key: x.key, observed: x.f(rb, re), ...cop.stats[nullRules.length + j] }))
// Indépendance de calcul : les jours « Portfolio < 0 » avec les poids réels (et non le poids moyen).
const pNegActual = P.subsetCorr(rb, re, rp.map(x => x < 0))
const episodeRows = EPISODES.map(e => {
  const mk = epMask(e), a = dayIdx(e.from), b = dayIdx(e.to)
  const ret = (r: number[]) => r.slice(a, b + 1).reduce((s, x) => s * (1 + x), 1) - 1
  const sc = P.subsetCorr(rb, re, mk)
  return { ...e, days: sc.n, pearson: sc.pearson, btc: ret(rb), eth: ret(re), portfolio: ret(rp), spotBtc: ret(spotB), spotEth: ret(spotE) }
})
const coLoss = { pEthNeg: re.filter(x => x < 0).length / ND, independence10: re.filter(x => x <= q(re, 0.1)).length / ND, independence5: re.filter(x => x <= q(re, 0.05)).length / ND, rows: tailRows }
log('corrélations')

// ================================================================ 7. recouvrement des trades et des positions
const ev = (ts: Trade[]) => ts.map(x => ({ t: x.entryT, dir: x.dir }))
const WINDOWS = [{ label: '±15 min', ms: 15 * 60000 }, { label: '±1 h', ms: 3600000 }, { label: '±2 h', ms: 7200000 }, { label: '±4 h', ms: 4 * 3600000 }, { label: '±8 h', ms: 8 * 3600000 }]
const span = (D1 + 1 - D0) * DAY
const shifted = (xs: { t: number; dir: number }[], off: number) => xs.map(x => ({ t: D0 * DAY + ((x.t - D0 * DAY + off) % span), dir: x.dir }))
const shiftRand = P.rng(SEED + 1)
const offsets = Array.from({ length: 200 }, () => 30 * DAY + shiftRand() * (span - 60 * DAY))
const flip = (xs: { t: number; dir: number }[]) => xs.map(x => ({ t: x.t, dir: -x.dir }))
const overlap = WINDOWS.map(w => ({
  window: w.label,
  ethWithBtc: P.matchShare(ev(TR.ethusdt), ev(TR.btc), w.ms), btcWithEth: P.matchShare(ev(TR.btc), ev(TR.ethusdt), w.ms),
  ethWithBtcOpposite: P.matchShare(ev(TR.ethusdt), flip(ev(TR.btc)), w.ms),
  baselineEthWithBtc: P.mean(offsets.map(o => P.matchShare(ev(TR.ethusdt), shifted(ev(TR.btc), o), w.ms))),
  baselineBtcWithEth: P.mean(offsets.map(o => P.matchShare(ev(TR.btc), shifted(ev(TR.ethusdt), o), w.ms))),
}))
const states = { none: 0, btcOnly: 0, ethOnly: 0, both: 0, longLong: 0, shortShort: 0, btcLongEthShort: 0, btcShortEthLong: 0 }
for (let g = 0; g < G; g++) {
  const x = GR.btc.pos[g], y = GR.ethusdt.pos[g]
  if (!x && !y) states.none++; else if (x && !y) states.btcOnly++; else if (!x && y) states.ethOnly++
  else { states.both++; if (x === 1 && y === 1) states.longLong++; else if (x === -1 && y === -1) states.shortShort++; else if (x === 1) states.btcLongEthShort++; else states.btcShortEthLong++ }
}
for (const k of Object.keys(states) as (keyof typeof states)[]) states[k] /= G
// Positions simultanées, par trade : un trade ETH croise-t-il une position BTC (même sens, sens opposé) ?
const overlapsPos = (x: Trade, ys: Trade[], same: boolean) => ys.some(y => (same ? y.dir === x.dir : y.dir !== x.dir) && y.entryT < x.exitT && y.exitT > x.entryT)
const tradeOverlap = {
  ethSame: TR.ethusdt.filter(x => overlapsPos(x, TR.btc, true)).length / TR.ethusdt.length,
  ethOpp: TR.ethusdt.filter(x => overlapsPos(x, TR.btc, false)).length / TR.ethusdt.length,
  btcSame: TR.btc.filter(x => overlapsPos(x, TR.ethusdt, true)).length / TR.btc.length,
  btcOpp: TR.btc.filter(x => overlapsPos(x, TR.ethusdt, false)).length / TR.btc.length,
  longLong: TR.ethusdt.filter(x => x.dir === 1 && overlapsPos(x, TR.btc, true)).length / TR.ethusdt.filter(x => x.dir === 1).length,
  shortShort: TR.ethusdt.filter(x => x.dir === -1 && overlapsPos(x, TR.btc, true)).length / TR.ethusdt.filter(x => x.dir === -1).length,
}
log('recouvrements')

// ================================================================ 8. risque et diversification
const rc = P.riskContrib(rb, re, [0.5, 0.5])
const rcAvg = P.riskContrib(rb, re, [aWeights.mean, 1 - aWeights.mean])
const yearsList = [...new Set(days.map(P.yearOf))]
const rcByYear = yearsList.map(y => { const ix = days.map((d, i) => (P.yearOf(d) === y ? i : -1)).filter(i => i >= 0); const r = P.riskContrib(ix.map(i => rb[i]), ix.map(i => re[i]), [0.5, 0.5]); return { year: y, btcPct: r.pct[0], ethPct: r.pct[1], corr: r.corr } })
const mB = series.btc.m, mE = series.eth.m, mP = series.portfolio.m
const div = {
  sharpeVsBest: mP.sharpe / Math.max(mB.sharpe, mE.sharpe), sharpeVsBtc: mP.sharpe / mB.sharpe, sharpeVsEth: mP.sharpe / mE.sharpe,
  theoreticalEqualSharpe: Math.sqrt(2 / (1 + corr.dailyPearson)),
  maxDDvsBtc: mP.maxDD / mB.maxDD, maxDDvsEth: mP.maxDD / mE.maxDD,
  volVsWeighted: mP.vol / (0.5 * mB.vol + 0.5 * mE.vol), volVsBtc: mP.vol / mB.vol, volVsEth: mP.vol / mE.vol,
  dr: rc.dr, enbDR2: rc.enbDR2, enbPca: rc.enbPca,
}

// ================================================================ 9. drawdowns
const eqB = DL.btc[1].eq.map(v => (100 * v) / DL.btc[1].base), eqE = DL.ethusdt[1].eq.map(v => (100 * v) / DL.ethusdt[1].base)
const at = (eq: number[], i: number) => (i < 0 ? 100 : eq[i])
const topDD = (eq: number[]) => P.episodes(eq, 100).sort((x, y) => x.depth - y.depth).slice(0, 10)
const ddRow = (e: P.Episode, other: { name: string; eq: number[] }[]) => ({
  start: P.isoDay(e.peak < 0 ? D0 - 1 : days[e.peak]), trough: P.isoDay(days[e.trough]), recovery: e.recovery === null ? null : P.isoDay(days[e.recovery]),
  depth: e.depth, days: e.days, recoveryDays: e.recoveryDays,
  others: Object.fromEntries(other.map(o => [o.name, at(o.eq, e.trough) / at(o.eq, e.peak) - 1])),
})
const dd = {
  btc: topDD(eqB).map(e => ddRow(e, [{ name: 'ETH', eq: eqE }, { name: 'Portfolio', eq: A.v }])),
  eth: topDD(eqE).map(e => ddRow(e, [{ name: 'BTC', eq: eqB }, { name: 'Portfolio', eq: A.v }])),
  portfolio: topDD(A.v).map(e => ddRow(e, [{ name: 'BTC', eq: eqB }, { name: 'ETH', eq: eqE }])),
}
const helps = (rows: typeof dd.btc, other: string, thr: number) => { const r = rows.filter(x => x.depth <= thr); return { n: r.length, otherPositive: r.filter(x => x.others[other] > 0).length / r.length, otherMean: P.mean(r.map(x => x.others[other])), portfolioMean: P.mean(r.map(x => x.others.Portfolio)), ownMean: P.mean(r.map(x => x.depth)) } }
const ddHelp = { ethDuringBtcTop10: helps(dd.btc, 'ETH', 0), btcDuringEthTop10: helps(dd.eth, 'BTC', 0), ethDuringBtc15: helps(dd.btc, 'ETH', -0.15), btcDuringEth15: helps(dd.eth, 'BTC', -0.15) }
// Indépendance de calcul : pire baisse par les épisodes et par le maximum courant.
check('Max drawdown recomputed independently (episodes vs running peak)', Math.abs(Math.min(...epA.map(e => e.depth)) - mP.maxDD) < 1e-12, `${(mP.maxDD * 100).toFixed(4)} %`)

// ================================================================ 10. années, mois
const annual = yearsList.map(y => {
  const ix = days.map((d, i) => (P.yearOf(d) === y ? i : -1)).filter(i => i >= 0)
  const sub = (r: number[]) => ix.map(i => r[i])
  const ms = (r: number[]) => { const s = P.sd(sub(r)); return s > 0 ? (P.mean(sub(r)) / s) * Math.sqrt(ANN) : NaN }
  const ret = (r: number[]) => sub(r).reduce((s, x) => s * (1 + x), 1) - 1
  return { year: y, days: ix.length, partial: ix.length < 365, from: P.isoDay(days[ix[0]]), to: P.isoDay(days[ix[ix.length - 1]]), btc: ret(rb), eth: ret(re), portfolio: ret(rp), rebalanced: ret(B.r), btcSharpe: ms(rb), ethSharpe: ms(re), portfolioSharpe: ms(rp), portfolioDD: P.maxDrawdown(P.compound(sub(rp)), 1) }
})
const monthly = monthsA.map((m, i) => ({ month: P.monthLabel(m.key), btc: monthsB[i].ret, eth: monthsE[i].ret, portfolio: m.ret, rebalanced: monthsBk[i].ret }))

// Stabilité dans le temps : Sharpe glissant sur 365 jours, deux moitiés, et sans les 4 premiers mois
// (2018, partiels et les plus forts pour ETH). Diagnostics seulement : le portefeuille officiel reste la période complète.
const rollSharpe = (r: number[], w = 365) => r.map((_, k) => { if (k + 1 < w) return NaN; const x = r.slice(k + 1 - w, k + 1); const s = P.sd(x); return s > 0 ? (P.mean(x) / s) * Math.sqrt(ANN) : NaN })
const roll12 = { btc: rollSharpe(rb), eth: rollSharpe(re), portfolio: rollSharpe(rp) }
const rollStats = Object.fromEntries(Object.entries(roll12).map(([k, v]) => { const f = v.filter(Number.isFinite); return [k, { n: f.length, positive: f.filter(x => x > 0).length / f.length, aboveOne: f.filter(x => x > 1).length / f.length, min: Math.min(...f), median: P.quantile(f, 0.5) }] }))
const half = Math.floor(ND / 2)
const subMetrics = (a: number, b: number) => { const d = days.slice(a, b), pf = P.book(rb.slice(a, b), re.slice(a, b)); return { from: P.isoDay(d[0]), to: P.isoDay(d[d.length - 1]), btc: pick(P.dailyMetrics(rb.slice(a, b), d)), eth: pick(P.dailyMetrics(re.slice(a, b), d)), portfolio: pick(P.dailyMetrics(pf.r, d)), corr: P.pearson(rb.slice(a, b), re.slice(a, b)) } }
const i2019 = days.indexOf(Math.floor(Date.parse('2019-01-01') / DAY))
const subPeriods = { firstHalf: subMetrics(0, half), secondHalf: subMetrics(half, ND), from2019: subMetrics(i2019, ND) }

// ================================================================ 11. bootstrap
const bs = P.blockBootstrap(rb, re, days, NBOOT, SEED)
const ci = (xs: number[]) => ({ p2_5: q(xs, 0.025), p5: q(xs, 0.05), median: q(xs, 0.5), p95: q(xs, 0.95), p97_5: q(xs, 0.975) })
const share = (f: (i: number) => boolean) => { let k = 0; for (let i = 0; i < NBOOT; i++) if (f(i)) k++; return k / NBOOT }
const boot = {
  replications: NBOOT, blocks: bs.blocks, seed: SEED,
  sharpe: ci(bs.sharpeP), cagr: ci(bs.cagrP), maxDD: ci(bs.ddP), sharpeBtc: ci(bs.sharpeA), sharpeEth: ci(bs.sharpeB),
  pSharpePos: share(i => bs.sharpeP[i] > 0), pSharpeGt1: share(i => bs.sharpeP[i] > 1),
  pBeatsBtc: share(i => bs.sharpeP[i] > bs.sharpeA[i]), pBeatsEth: share(i => bs.sharpeP[i] > bs.sharpeB[i]), pBeatsBoth: share(i => bs.sharpeP[i] > Math.max(bs.sharpeA[i], bs.sharpeB[i])),
  pDDBetterThanBtc: share(i => bs.ddP[i] > bs.ddA[i]), pDDBetterThanEth: share(i => bs.ddP[i] > bs.ddB[i]),
}
log('bootstrap')

// ================================================================ 12. concentration
const logGrowth = (v: number[], base: number) => Math.log(v[v.length - 1] / base)
function concentration(lr: number[], growth: number) {
  const s = (f: number) => P.topShare(lr, f)
  const t5 = s(0.05)
  return { n: lr.length, top1: s(0.01).share, top5: t5.share, top10: s(0.1).share, cagrWithoutTop5: Math.exp((growth - t5.top) / YEARS) - 1, cagr: Math.exp(growth / YEARS) - 1, skew: P.moments(lr).skew }
}
const conc = {
  tradesPortfolio: concentration(TP.map(x => Math.log(1 + x.contrib)), logGrowth(A.v, 100)),
  tradesBtc: concentration(TR.btc.map(x => Math.log(1 + x.ret)), logGrowth(DL.btc[1].eq, DL.btc[1].base)),
  tradesEth: concentration(TR.ethusdt.map(x => Math.log(1 + x.ret)), logGrowth(DL.ethusdt[1].eq, DL.ethusdt[1].base)),
  daysPortfolio: concentration(rp.map(x => Math.log(1 + x)), logGrowth(A.v, 100)),
  daysBtc: concentration(rb.map(x => Math.log(1 + x)), logGrowth(DL.btc[1].eq, DL.btc[1].base)),
  daysEth: concentration(re.map(x => Math.log(1 + x)), logGrowth(DL.ethusdt[1].eq, DL.ethusdt[1].base)),
  currencyTop5: P.topShare(TP.map(x => x.pnlCcy), 0.05).share,
  tradeSkewPortfolio: P.moments(TP.map(x => x.contrib)).skew,
}

// ================================================================ 13. réconciliation
const btcOpenAtT0 = R.btc[1].position[win.btc.a - 1] !== 0
const fresh = runDetailed(S.btc, 1, win.btc.a)
const freshDaily = P.returnsOf(P.dayCloses(S.btc.bars.t, fresh.equity, win.btc.a, win.btc.b, days, fresh.equity[win.btc.a - 1]).eq, fresh.equity[win.btc.a - 1])
const freshTrades = fresh.positions.filter(p => p.entryIdx >= win.btc.a && p.entryIdx <= win.btc.b).length
const freshA = P.book(freshDaily, re)
const sleeve15 = Object.fromEntries(KEYS.map(k => { const mt = metricsOf(S[k].bars, asResult(R[k][1]), win[k].a, win[k].b); return [NAMES[k], { sharpe15: mt.sharpe, maxDD15: mt.maxDrawdown, cagr: mt.cagr, trades: mt.trades }] }))
const ret15 = (v: Float64Array, base: number) => { const r: number[] = []; let prev = base; for (let g = 0; g < G; g++) { r.push(v[g] / prev - 1); prev = v[g] } return r }
const sharpe15 = (r: number[]) => (P.mean(r) / P.sd(r)) * Math.sqrt(96 * ANN)
const recon = {
  rows: reconcile,
  common: {
    BTC: { ...sleeve15.BTC, sharpe15Grid: sharpe15(ret15(GR.btc.eq, DL.btc[1].base)), sharpeDaily: mB.sharpe, maxDDDaily: mB.maxDD, gridExact: GR.btc.exact / G },
    ETH: { ...sleeve15.ETH, sharpe15Grid: sharpe15(ret15(GR.ethusdt.eq, DL.ethusdt[1].base)), sharpeDaily: mE.sharpe, maxDDDaily: mE.maxDD, gridExact: GR.ethusdt.exact / G },
    Portfolio: { sharpe15Grid: sharpe15(ret15(VG, 100)), maxDD15: ddIntraday.portfolio, sharpeDaily: mP.sharpe, maxDDDaily: mP.maxDD },
  },
  btcOpenAtT0,
  freshStart: { btc: P.dailyMetrics(freshDaily, days), btcTrades: freshTrades, portfolio: P.dailyMetrics(freshA.r, days) },
  lagCorr,
}
check('Sharpe recomputed independently (Welford vs two-pass)', (() => { let m = 0, s2 = 0; rp.forEach((x, i) => { const d = x - m; m += d / (i + 1); s2 += d * (x - m) }); return Math.abs((m / Math.sqrt(s2 / ND)) * Math.sqrt(ANN) - mP.sharpe) < 1e-9 })(), `${mP.sharpe.toFixed(6)}`)
check('CAGR recomputed independently (log-sum vs end value)', Math.abs(Math.exp(rp.reduce((s, x) => s + Math.log(1 + x), 0) / YEARS) - 1 - mP.cagr) < 1e-12, `${(mP.cagr * 100).toFixed(4)} %`)
check('Equal-risk weights causal (window ends at the rebalancing close)', cWeights.every((w, j) => { const k = days.indexOf(w.day); return k + 1 < VOL_WIN ? w.wBtc === 0.5 : Math.abs(w.wBtc - P.equalRiskTarget(rb.slice(0, k + 1), re.slice(0, k + 1), VOL_WIN)(k)) < 1e-15 }), `${cWeights.length} monthly targets; truncating the series after the rebalancing day leaves each weight unchanged`)
check('Gross exposure of the 50/50 portfolio', series.portfolio.expo.maxGross <= 1.25, `max ${(series.portfolio.expo.maxGross * 100).toFixed(1)} % of portfolio equity (100 % = both sleeves fully invested; above 100 % only through price moves against open shorts and the entry commission)`)
log('réconciliation et contrôles')

const canon = (x: unknown): unknown => (Array.isArray(x) ? x.map(canon) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, canon((x as Record<string, unknown>)[k])])) : x)
const params = S.btc.preset.sets
const paramsHash = createHash('sha256').update(JSON.stringify(canon(params))).digest('hex')
check('ETH runs the BTC preset unchanged', JSON.stringify(canon(S.ethusdt.preset.sets)) === JSON.stringify(canon(params)), `parameter hash ${paramsHash.slice(0, 16)}… identical for both sleeves`)

// ================================================================ 14. preuves déjà établies (rapports existants)
const rd = (f: string) => JSON.parse(readFileSync(join(ROOT, 'research/reports', f), 'utf8'))
const evFile = (f: string) => (E2V ? f.replace(/\.json$/, '-e2.json') : f)
const zs = (f0: string) => { const f = evFile(f0); const j = rd(f); const p = j.strategy.preset; const x1 = p.costs[1].s; const d1 = p.shifts.find((s: { k: number }) => s.k === 1).s; return { file: f, label: j.label, period: j.period, verdict: j.verdict, meanTrade: x1.meanTrade, sharpe: x1.sharpe, cagr: x1.cagr, dd: x1.dd, trades: x1.trades, randomBeaten: p.random.beaten, randomP95: p.random.p95, delay1Share: d1.meanTrade / x1.meanTrade, delay1Sharpe: d1.sharpe, eventsShockTrend: j.verdict.eventsShockTrend } }
const rob = (f0: string) => { const f = evFile(f0); const j = rd(f); return { file: f, period: j.period, levels: j.dists.filter((d: { family: string; win: number }) => d.family === 'preset' && d.win === 0).map((d: { level: number; q: { sharpe: number[] }; preset: { sharpe: number }; rank: { sharpe: number }; profitable: number; keepSharpe80: number }) => ({ level: d.level, medianSharpe: d.q.sharpe[2], p10: d.q.sharpe[0], p90: d.q.sharpe[4], preset: d.preset.sharpe, rank: d.rank.sharpe, profitable: d.profitable, keep80: d.keepSharpe80 })) } }
const WF = E2V ? 'shock-15m-wf-plateau-36-3-e2.md' : 'shock-15m-wf-plateau-36-3.md'
const wfMd = readFileSync(join(ROOT, 'research/reports', WF), 'utf8')
const wfRow = wfMd.split('\n').find(l => l.startsWith('| **Walk-forward, plateaux**'))!.split('|').map(x => x.trim())
const evidence = {
  btc: zs('shock-15m-zeroshot-btc.json'), eth: zs('shock-15m-zeroshot-ethusdt.json'), ethDukascopy: zs('shock-15m-zeroshot-eth-dukascopy.json'),
  gold: zs('shock-15m-zeroshot-xauusd.json'), sol: zs('shock-15m-zeroshot-solusdt.json'), tao: zs('shock-15m-zeroshot-taousdt.json'),
  robBtc: rob('shock-15m-robustness-local.json'), robEth: rob('shock-15m-robustness-local-ethusdt.json'),
  walkForward: { file: WF, period: '2020-01-01 → 2026-10-04', windows: 28, cagr: wfRow[3], sharpe: wfRow[4], dd: wfRow[6], trades: wfRow[8] },
}

// Variante E2 : recoupement avec les études précédentes (même stratégie calculée par d'autres scripts)
// et limites chiffrées (funding des perpétuels, glissement), tirées de research/reports/e2-diagnostics.
const e2Stress = (() => {
  if (!E2V) return null
  const dg = JSON.parse(readFileSync(join(ROOT, 'research/reports/e2-diagnostics/e2-diagnostics.json'), 'utf8'))
  check('E2: portfolio Sharpe = E2 diagnostics (research/shock/e2-diagnostics.ts)', Math.abs(mP.sharpe - dg.portfolio.challengerE2) < 1e-8, `${mP.sharpe.toFixed(10)} vs ${dg.portfolio.challengerE2}`)
  const se = JSON.parse(readFileSync(join(ROOT, 'research/reports/short-entry-study/short-entry-btc-eth.json'), 'utf8'))
  check('E2: portfolio Sharpe, CAGR and max drawdown = short-entry study (research/shock/short-entry-study.ts)', Math.abs(mP.sharpe - se.portfolio.E2.sharpe) < 1e-8 && Math.abs(mP.cagr - se.portfolio.E2.cagr) < 1e-8 && Math.abs(mP.maxDD - se.portfolio.E2.maxDD) < 1e-8, `Sharpe ${mP.sharpe.toFixed(8)}, CAGR ${mP.cagr.toFixed(8)}, DD ${mP.maxDD.toFixed(8)}`)
  const label: Record<string, string> = { binance: 'historical Binance perpetual funding (2020 onwards; constant +0.01 % per 8 h before 2020)', hyperliquid: 'same, with Hyperliquid funding from May 2023', shortsPay: 'stress: shorts pay 0.01 % per 8 h at all times' }
  return {
    source: 'research/reports/e2-diagnostics/e2-diagnostics.json',
    funding: dg.funding.map((f: { scenario: string; e2: { sharpe: number; cagr: number; maxDD: number } }) => ({ scenario: label[f.scenario] ?? f.scenario, sharpe: f.e2.sharpe, cagr: f.e2.cagr, maxDD: f.e2.maxDD })),
    slippage: dg.slippage.map((x: { slip: number; e2: number }) => ({ slippagePctPerOrder: x.slip, sharpe: x.e2 })),
  }
})()

// ================================================================ 15. sorties
mkdirSync(OUT, { recursive: true })
const f6 = (x: number) => (Number.isFinite(x) ? x.toFixed(8) : '')
const csv = (head: string[], rows: (string | number)[][]) => [head.join(','), ...rows.map(r => r.join(','))].join('\n') + '\n'
const uwB = P.underwater(eqB, 100), uwE = P.underwater(eqE, 100)
const files: Record<string, string> = {
  'portfolio_daily_returns.csv': csv(['date', 'btc_return', 'eth_return', 'portfolio_return', 'btc_equity', 'eth_equity', 'portfolio_equity', 'btc_sleeve_value', 'eth_sleeve_value', 'btc_weight', 'btc_drawdown', 'eth_drawdown', 'portfolio_drawdown'],
    days.map((d, k) => [P.isoDay(d), f6(rb[k]), f6(re[k]), f6(rp[k]), f6(eqB[k]), f6(eqE[k]), f6(A.v[k]), f6(A.vA[k]), f6(A.vB[k]), f6(A.vA[k] / A.v[k]), f6(uwB[k]), f6(uwE[k]), f6(uw[k])])),
  'portfolio_monthly_returns.csv': csv(['month', 'btc_return', 'eth_return', 'portfolio_return', 'portfolio_rebalanced_return'], monthly.map(m => [m.month, f6(m.btc), f6(m.eth), f6(m.portfolio), f6(m.rebalanced)])),
  'portfolio_annual_returns.csv': csv(['year', 'partial', 'from', 'to', 'btc_return', 'eth_return', 'portfolio_return', 'btc_sharpe', 'eth_sharpe', 'portfolio_sharpe', 'portfolio_max_drawdown', 'portfolio_rebalanced_return'],
    annual.map(a => [a.year, a.partial ? 1 : 0, a.from, a.to, f6(a.btc), f6(a.eth), f6(a.portfolio), f6(a.btcSharpe), f6(a.ethSharpe), f6(a.portfolioSharpe), f6(a.portfolioDD), f6(a.rebalanced)])),
  'portfolio_drawdowns.csv': csv(['series', 'rank', 'start', 'trough', 'recovery', 'depth', 'duration_days', 'recovery_days', 'other_1', 'other_1_return', 'other_2', 'other_2_return'],
    (['btc', 'eth', 'portfolio'] as const).flatMap(sr => dd[sr].map((x, i) => { const o = Object.entries(x.others); return [sr, i + 1, x.start, x.trough, x.recovery ?? '', f6(x.depth), x.days, x.recoveryDays ?? '', o[0][0], f6(o[0][1]), o[1][0], f6(o[1][1])] }))),
  'portfolio_correlation_rolling.csv': csv(['date', 'rolling_30d', 'rolling_90d', 'rolling_252d'], days.map((d, k) => [P.isoDay(d), f6(rolling[30][k]), f6(rolling[90][k]), f6(rolling[252][k])])),
}
const commonPeriod = { start: P.isoDay(D0), end: P.isoDay(D1), days: ND, years: YEARS, rule: 'first UTC day on which both strategies are simulated after warm-up (ETH simulation start) → last complete UTC day covered by both' }
const summary = {
  schema: 'shock-engine-portfolio-summary/1', version: E2V ? 'shock-engine-2026.10' : 'shock-engine-v1', variant: VARIANT, status: 'HISTORICAL SIMULATION', liveResults: null,
  title: 'Shock Engine BTC/ETH Portfolio', subtitle: E2V ? 'BTC-calibrated strategy · applied unchanged to Ethereum' : 'Frozen BTC-calibrated strategy · zero-shot Ethereum transfer',
  parametersSha256: paramsHash,
  disclaimers: E2V
    ? ['Ethereum parameters were inherited from Bitcoin and were not calibrated on ETH.', 'Historical simulation after modeled transaction costs. Not live performance.', 'Short entries are only allowed when the daily trend regime is bearish. This condition was specified in October 2026, after this historical period had been studied: the figures are in-sample, not an independent out-of-sample test.', 'Slippage and perpetual funding are not included in the headline figures.', 'Capacity and market impact are not yet modeled.']
    : ['Ethereum parameters were inherited from Bitcoin and were not calibrated on ETH.', 'Historical simulation after modeled transaction costs. Not live performance.', 'Capacity and market impact are not yet modeled.'],
  ...(E2V ? { stress: e2Stress } : {}),
  commonPeriod,
  conventions: { returns: 'daily, UTC close-to-close (equity of the last 15-min bar of each day)', annualization: 365.25, riskFree: 0, sharpe: 'mean / population sd of daily returns × √365.25', costs: 'commission 0.045 % per order (each entry and exit fill); slippage 0 as in the validated reference; no funding; no leverage' },
  allocation: { weights: { btc: 0.5, eth: 0.5 }, rebalancing: 'none (official variant A: independent sleeves from a 50/50 start)', diagnostics: ['B: monthly rebalancing to 50/50 (month-end UTC close)', 'C (exploratory): inverse 90-day volatility, monthly, weights sum to 1'] },
  headline: {
    btcSharpe: mB.sharpe, ethSharpe: mE.sharpe, portfolioSharpe: mP.sharpe, portfolioCagr: mP.cagr, portfolioMaxDD: mP.maxDD, portfolioCalmar: mP.calmar,
    correlationDaily: corr.dailyPearson, worstMonth: { month: P.monthLabel(mP.worstMonth.key), ret: mP.worstMonth.ret }, trades: { btc: TR.btc.length, eth: TR.ethusdt.length, total: TP.length },
  },
  series: { btc: series.btc, eth: series.eth, portfolio: series.portfolio },
  variants, weights: { A: aWeights, C: cWeights.map(w => ({ date: P.isoDay(w.day), wBtc: w.wBtc })) },
  costs: { perSeries: { btc: series.btc.cost, eth: series.eth.cost, portfolio: series.portfolio.cost }, cagrDrag: costDrag, stress: costStress.map(c => ({ k: c.k, commissionPct: c.commissionPct, btc: pick(c.btc), eth: pick(c.eth), portfolio: pick(c.A), rebalanced: pick(c.B), costBtc: c.costBtc, costEth: c.costEth, costPortfolio: c.costA })), rebalancingCostPctYr: { B: variants.B.rebalCostPctYr, C: variants.C.rebalCostPctYr } },
  correlation: { ...corr, coLoss }, crisis: { rows: crisis, copulaParameter: cop.rho, nullSimulations: 400, portfolioNegActualWeights: pNegActual, episodes: episodeRows, crashCut },
  overlap: { entries: overlap, states, trades: tradeOverlap },
  risk: { equalWeights: rc, averageWeights: rcAvg, byYear: rcByYear }, diversification: div,
  drawdowns: { top10: dd, help: ddHelp, intraday: ddIntraday },
  annual, monthly, stability: { rolling12: rollStats, subPeriods }, bootstrap: boot, concentration: conc,
  capacity: {
    tradesPerYear: { btc: series.btc.trades.perYear, eth: series.eth.trades.perYear, total: series.portfolio.trades.perYear },
    turnover: { btc: series.btc.cost, eth: series.eth.cost, portfolio: series.portfolio.cost },
    holdingHours: { btc: [series.btc.trades.holdMeanH, series.btc.trades.holdMedianH], eth: [series.eth.trades.holdMeanH, series.eth.trades.holdMedianH], pooled: [series.portfolio.trades.holdMeanH, series.portfolio.trades.holdMedianH] },
    simultaneous: states.both, exposure: series.portfolio.expo, sleeves: { btc: series.btc.expo, eth: series.eth.expo },
    note: 'Capacity and market impact are not yet modeled.',
  },
  reconciliation: recon, sanity: checks, evidence,
}
const json = (x: unknown) => JSON.stringify(x, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(10) : null) : v), 1)
files['portfolio_summary.json'] = json(summary)
const html = renderReport({ summary, days, rb, re, rp, eqB, eqE, eqP: A.v, uwB, uwE, uwP: uw, rolling, roll12 })
files['btc-eth-portfolio.html'] = html
for (const [name, content] of Object.entries(files)) writeFileSync(join(OUT, name), content)

// Manifeste : de quoi prouver quelle version a produit ces résultats.
const sha = (p: string) => createHash('sha256').update(readFileSync(join(ROOT, p))).digest('hex')
const git = (c: string) => { try { return execSync(`git ${c}`, { cwd: ROOT, encoding: 'utf8' }).trim() } catch { return null } }
const scripts = ['research/shock/portfolio.ts', 'research/shock/portfolio-html.ts', 'research/lib/portfolio.ts', 'research/lib/frozen-shock.ts', ...(E2V ? ['research/lib/e2.ts'] : []), 'research/lib/svg.ts', 'research/lib/data.ts', 'research/lib/stats.ts', 'research/shock/zero-shot.ts',
  'lib/strategies/shock/engine.ts', 'lib/strategies/shock/market.ts', 'lib/strategies/shock/strategy.ts', 'lib/strategies/shock/broker.ts', 'lib/strategies/shock/live.ts', 'lib/strategies/shock/params.ts', 'lib/strategies/shock/presets.ts', 'lib/strategies/shock/regimes.ts', 'lib/backtest/data.ts', 'lib/backtest/indicators.ts', 'lib/backtest/metrics.ts']
const dirty = git(`status --porcelain -- ${scripts.join(' ')} research/data`)
const dataset = (key: SleeveKey) => { const s = S[key]; return { file: SLEEVES[key].file, sha256: sha(SLEEVES[key].file), instrument: SLEEVES[key].label, venue: SLEEVES[key].venue, timeframe: '15m', timestamps: 'bar open, ms UTC', firstBar: new Date(s.bars.t[0]).toISOString(), lastBar: new Date(s.bars.t[s.bars.n - 1]).toISOString(), warmUpFrom: SLEEVES[key].warm, simulationFrom: SLEEVES[key].start, simulatedBars: s.end - s.lo + 1, commonWindowBars: win[key].b - win[key].a + 1, ...(key === 'btc' ? { regimeSource: 'research/data/btcusd_60m.csv.gz', regimeSha256: sha('research/data/btcusd_60m.csv.gz') } : { regimeSource: 'daily bars resampled from the same 15-min file' }) } }
const manifest = {
  version: E2V ? 'shock-engine-2026.10' : 'shock-engine-v1', variant: VARIANT, generatedAt: new Date().toISOString(), status: 'HISTORICAL SIMULATION',
  git: { commit: git('rev-parse HEAD'), branch: git('rev-parse --abbrev-ref HEAD'), sourcesClean: dirty === '', dirtyFiles: dirty ? dirty.split('\n') : [] },
  runtime: { node: process.version, command: 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/portfolio.ts' + (E2V ? ' --variant e2' : '') + (NBOOT !== 5000 ? ` --boot ${NBOOT}` : ''), seeds: { bootstrap: SEED, overlapBaseline: SEED + 1, copulaNull: SEED } },
  datasets: { btc: dataset('btc'), eth: dataset('ethusdt') },
  commonPeriod,
  strategy: { name: E2V ? 'Shock Engine, adaptive volatility preset, 15 min; short entries only in a bearish daily trend regime (research/lib/e2.ts)' : 'Shock Engine, adaptive volatility preset, 15 min (bot preset, full entries)', source: 'lib/strategies/shock/presets.ts ADAPTIVE15 over lib/strategies/shock/params.ts DEFAULT_PARAMS', regimes: ['calm', 'agitated'], parametersSha256: paramsHash, parameters: canon(params), ethCalibration: 'none: ETH inherits the BTC preset unchanged', entryMask: 'first bar after a data gap does not trigger an entry (as in zero-shot.ts)' },
  assumptions: { capitalPerSleeve: 'each sleeve compounds only its own capital; 100 % of sleeve equity per position; one position at a time per sleeve; no leverage', commissionPctPerOrder: 0.045, slippagePctPerOrder: 0, funding: 'not modeled (0)', riskFree: 0, annualization: 365.25 },
  portfolio: { weights: { btc: 0.5, eth: 0.5 }, rebalancing: 'none (official variant A)', diagnostics: { B: 'monthly 50/50 at month-end UTC close, commission on resized open positions', C: `exploratory equal risk, inverse ${VOL_WIN}-day volatility, monthly, no leverage` } },
  validatedReference: KEYS.map(k => ({ file: VALIDATED(k), sha256: sha(VALIDATED(k)), reproduced: checks.filter(c => c.name.startsWith(`${NAMES[k]} ×`)).every(c => c.ok) })),
  scripts: scripts.map(p => ({ path: p, sha256: sha(p) })),
  outputs: Object.keys(files).map(f => ({ path: relative(ROOT, join(OUT, f)), sha256: createHash('sha256').update(files[f]).digest('hex') })),
  sanityChecks: { passed: checks.filter(c => c.ok).length, failed: checks.filter(c => !c.ok).map(c => c.name) },
}
writeFileSync(join(OUT, MANIFEST), JSON.stringify(manifest, null, 1))
log(`écrit ${relative(ROOT, OUT)} · contrôles ${checks.filter(c => c.ok).length}/${checks.length}`)
if (checks.some(c => !c.ok)) process.exitCode = 1
