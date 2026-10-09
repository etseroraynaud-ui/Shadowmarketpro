// Diagnostics historiques de E2 sur BTC/ETH : research/preregistration/e2-diagnostics.md (commité avant
// tout calcul). Données déjà vues : ces diagnostics peuvent éliminer E2, pas la valider. Ils ne
// modifient ni la validation forward, ni la v1, ni le bot.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-diagnostics.ts
//
// 1. Placebo aléatoire : autant de shorts v1 gardés que E2, par actif (et par actif-année).
// 2. Placebo par décalage circulaire du régime E2 (même décalage pour BTC et ETH, ≥ 180 jours).
// 3. Funding des perpétuels (Binance, Hyperliquid, stress) avec le signe correct, et glissement.
// 4. Stabilité : par année, fenêtres glissantes de 12 et 24 mois.
// Sorties : research/reports/e2-diagnostics/ (e2-diagnostics.{md,json}, rolling.csv).

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLEEVES, costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import type { Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { loadBtc } from '../lib/data.ts'
import { metricsOf } from '../lib/stats.ts'
import * as P from '../lib/portfolio.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/e2-diagnostics')
const PRESPEC = 'research/preregistration/e2-diagnostics.md'
const DAY = P.DAY, M15 = 15 * 60000, H8 = 8 * 3600000, ANN = P.ANN
const CUT = Date.parse('2026-10-01T00:00:00Z')
const SEED = 20261013
const N_RAND_TRADE = 10000, N_RAND_PF = 1000, N_SHIFT_PF = 400, MIN_SHIFT = 180
const SLIPS = [0, 0.01, 0.02, 0.05]
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const stopIfFailed = (stage: string) => { const bad = checks.filter(c => !c.ok); if (bad.length) throw new Error(`${stage} : ${bad.map(c => c.name).join(' ; ')}`) }

// ================================================================ empreintes
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
}
for (const [f, h] of Object.entries(FROZEN)) { const got = createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex'); check(`empreinte ${f}`, got === h, got.slice(0, 16)) }
stopIfFailed('empreintes')

// ================================================================ sleeves, régime, v1
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const NAME: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
const S: Record<SleeveKey, Sleeve> = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') }
const regimeBars = (k: SleeveKey): Bars => (k === 'btc' ? resample(loadBtc(60), DAY) : resample(S[k].bars, DAY))
const TREND = {} as Record<SleeveKey, Uint8Array>
for (const k of KEYS) {
  const reg = classify(S[k].m.bars, 15, regimeBars(k))
  let bad = 0
  TREND[k] = new Uint8Array(S[k].bars.n)
  for (let i = 0; i < S[k].bars.n; i++) { const id = reg.id[i]; if ((id < 0 ? -1 : id % 2) !== S[k].select[i]) bad++; TREND[k][i] = id >= 0 && id >> 1 === 2 ? 1 : 0 }
  check(`${NAME[k]} : régime recalculé = régime du moteur`, bad === 0, `${bad} écart(s)`)
}
const run = (k: SleeveKey, short: Uint8Array, slip = 0): ShockResult => simulate(S[k].m, S[k].preset.sets, { ...costsFor(k, 1), slippagePct: slip }, S[k].lo, S[k].end, S[k].select, { long: S[k].signals.long, short })
const V0 = { btc: run('btc', S.btc.signals.short), ethusdt: run('ethusdt', S.ethusdt.signals.short) }
const maskE2 = (k: SleeveKey) => Uint8Array.from(S[k].signals.short, (x, i) => (x && TREND[k][i] ? 1 : 0))
const E2C = { btc: run('btc', maskE2('btc')), ethusdt: run('ethusdt', maskE2('ethusdt')) }

for (const k of KEYS) {
  const ref = JSON.parse(readFileSync(join(ROOT, SLEEVES[k].validated), 'utf8')).strategy.preset.costs[1].s
  const mt = metricsOf(S[k].bars, V0[k], S[k].lo, S[k].end)
  const worst = Math.max(...([[ref.totalReturn, mt.totalReturn], [ref.sharpe, mt.sharpe], [ref.trades, V0[k].positions.length]] as [number, number][]).map(([a, b]) => Math.abs(a - b) / Math.max(1, Math.abs(a))))
  check(`${NAME[k]} : v1 = rapport validé`, worst < 1e-9, `écart relatif ${worst.toExponential(1)}`)
  const sig = S[k].signals.short
  check(`${NAME[k]} : chaque short v1 entre sur une barre de signal short`, V0[k].positions.filter(p => p.dir === -1).every(p => sig[p.entryIdx] === 1), 'entryIdx = barre du signal')
}

// ================================================================ portefeuille commun
const tStart = Math.max(...KEYS.map(k => S[k].bars.t[S[k].lo]))
const tEnd = Math.min(...KEYS.map(k => S[k].bars.t[S[k].end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const pdays: number[] = []
for (let d = PD0; d <= PD1; d++) pdays.push(d)
const idxAt = (k: SleeveKey, ms: number) => { const t = S[k].bars.t; let lo = 0, hi = S[k].bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const WIN = Object.fromEntries(KEYS.map(k => [k, { a: idxAt(k, PD0 * DAY), b: idxAt(k, (PD1 + 1) * DAY) - 1 }])) as Record<SleeveKey, { a: number; b: number }>
/** Rendements journaliers d'une sleeve ; `cash[d]` (optionnel) : funding du jour, ajouté en part de l'equity de la veille. */
function sleeveDaily(k: SleeveKey, eq: Float64Array, cash?: Map<number, number>) {
  const { a, b } = WIN[k], base = eq[a - 1]
  const closes = P.dayCloses(S[k].bars.t, eq, a, b, pdays, base).eq
  const r = P.returnsOf(closes, base)
  if (cash) for (let j = 0; j < r.length; j++) { const c = cash.get(pdays[j]); if (c) r[j] += c / (j ? closes[j - 1] : base) }
  return r
}
const sharpe = (r: number[]) => { const s = P.sd(r); return s > 0 ? (P.mean(r) / s) * Math.sqrt(ANN) : NaN }
const pfStats = (rb: number[], re: number[]) => { const r = P.book(rb, re).r, m = P.dailyMetrics(r, pdays); return { r, sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD } }
const PF_V0 = pfStats(sleeveDaily('btc', V0.btc.equity), sleeveDaily('ethusdt', V0.ethusdt.equity))
const PF_E2C = pfStats(sleeveDaily('btc', E2C.btc.equity), sleeveDaily('ethusdt', E2C.ethusdt.equity))
const published = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio/portfolio_summary.json'), 'utf8')).series.portfolio.m.sharpe
check('portefeuille 50/50 v1 = Sharpe publié', Math.abs(PF_V0.sharpe - published) < 1e-8, `${PF_V0.sharpe.toFixed(9)} vs ${published}`)
log('v1 et challenger E2 rejoués')

// ================================================================ échantillon de shorts
const dailyVol = (k: SleeveKey) => {
  const { t, c } = S[k].bars
  const close = new Map<number, number>()
  for (let i = 0; i < S[k].bars.n; i++) close.set(Math.floor(t[i] / DAY), c[i])
  const ds = [...close.keys()].sort((x, y) => x - y), out = new Map<number, number>(), lr: number[] = []
  for (let j = 1; j < ds.length; j++) { if (lr.length >= 30) out.set(ds[j], P.sd(lr.slice(-30))); lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0) }
  return out
}
interface Sh { k: SleeveKey; p: PositionRecord; entryIdx: number; t: number; year: number; e2: number; sig: number; R: number }
const inSample = (k: SleeveKey, p: PositionRecord) => p.dir === -1 && !p.exits.includes('END') && S[k].bars.t[p.exitIdx] + M15 < CUT && p.entryIdx >= S[k].lo
const shortsOf = (k: SleeveKey, r: ShockResult, vol: Map<number, number>): Sh[] => r.positions.filter(p => inSample(k, p)).map(p => {
  const t = S[k].bars.t[p.entryIdx], sig = vol.get(Math.floor(t / DAY))!
  return { k, p, entryIdx: p.entryIdx, t, year: new Date(t).getUTCFullYear(), e2: TREND[k][p.entryIdx], sig, R: p.pnl / p.equityAtEntry / sig }
})
const VOL = { btc: dailyVol('btc'), ethusdt: dailyVol('ethusdt') }
const SH = [...shortsOf('btc', V0.btc, VOL.btc), ...shortsOf('ethusdt', V0.ethusdt, VOL.ethusdt)]
const Rv = Float64Array.from(SH, x => x.R)
const N = SH.length
/** D = moyenne de R des shorts gardés − moyenne des rejetés (BTC et ETH mis en commun). */
const dOf = (keep: ArrayLike<number>, R: ArrayLike<number> = Rv) => { let s1 = 0, c1 = 0, s0 = 0, c0 = 0; for (let j = 0; j < R.length; j++) { if (!Number.isFinite(R[j])) continue; if (keep[j]) { s1 += R[j]; c1++ } else { s0 += R[j]; c0++ } } return c1 && c0 ? s1 / c1 - s0 / c0 : NaN }
const E2KEEP = Uint8Array.from(SH, x => x.e2)
const D_E2 = dOf(E2KEEP)
const K = Object.fromEntries(KEYS.map(k => [k, SH.filter(x => x.k === k && x.e2).length])) as Record<SleeveKey, number>
const fwdRef = JSON.parse(readFileSync(join(ROOT, 'research/reports/e2-forward/latest.json'), 'utf8')).history
check('échantillon = référence historique du forward', Math.abs(D_E2 - fwdRef.d) < 1e-9 && fwdRef.n1 === K.btc + K.ethusdt && fwdRef.n0 === N - K.btc - K.ethusdt, `${N} shorts, ${K.btc + K.ethusdt} en régime E2 (BTC ${K.btc}, ETH ${K.ethusdt}), D = ${D_E2.toFixed(4)}`)

// Sélection → entrées short passées au moteur : barres d'entrée des shorts gardés, plus les shorts hors
// échantillon (ouverts à la coupure ou après), toujours gardés.
function selectionRun(keep: ArrayLike<number>) {
  const out = {} as Record<SleeveKey, ShockResult>
  for (const k of KEYS) {
    const sel = new Uint8Array(S[k].bars.n)
    for (const p of V0[k].positions) if (p.dir === -1 && !inSample(k, p)) sel[p.entryIdx] = 1
    SH.forEach((x, j) => { if (x.k === k && keep[j]) sel[x.entryIdx] = 1 })
    out[k] = run(k, sel)
  }
  return out
}
const executed = (r: Record<SleeveKey, ShockResult>) => KEYS.reduce((a, k) => a + r[k].positions.filter(p => inSample(k, p)).length, 0)
{
  const all = selectionRun(new Uint8Array(N).fill(1))
  const same = KEYS.every(k => all[k].equity.every((x, i) => x === V0[k].equity[i]))
  check('sélection de tous les shorts v1 = v1 exactement', same, 'equity identique barre par barre sur les deux sleeves')
}
const SEL_E2 = selectionRun(E2KEEP)
const PF_SEL = pfStats(sleeveDaily('btc', SEL_E2.btc.equity), sleeveDaily('ethusdt', SEL_E2.ethusdt.equity))
stopIfFailed('contrôles')
log('échantillon et sélection E2')

// ================================================================ 1. placebo aléatoire
const rand = P.rng(SEED)
const pick = (idx: number[], n: number, into: Uint8Array) => { const a = idx.slice(); for (let j = 0; j < n; j++) { const r = j + Math.floor(rand() * (a.length - j)); [a[j], a[r]] = [a[r], a[j]]; into[a[j]] = 1 } }
const byAsset = KEYS.map(k => ({ idx: SH.map((x, j) => (x.k === k ? j : -1)).filter(j => j >= 0), n: K[k] }))
const ayKeys = [...new Set(SH.map(x => `${x.k}|${x.year}`))]
const byAY = ayKeys.map(key => { const idx = SH.map((x, j) => (`${x.k}|${x.year}` === key ? j : -1)).filter(j => j >= 0); return { idx, n: idx.filter(j => SH[j].e2).length } })
const randD = (groups: { idx: number[]; n: number }[], draws: number) => { const out = new Float64Array(draws); for (let b = 0; b < draws; b++) { const keep = new Uint8Array(N); for (const g of groups) pick(g.idx, g.n, keep); out[b] = dOf(keep) } return out }
const R1 = randD(byAsset, N_RAND_TRADE)
const R1y = randD(byAY, N_RAND_TRADE)
const share = (xs: ArrayLike<number>, f: (x: number) => boolean) => { let c = 0, n = 0; for (let j = 0; j < xs.length; j++) { if (Number.isFinite(xs[j])) { n++; if (f(xs[j])) c++ } } return c / n }
const dist = (xs: ArrayLike<number>) => { const a = Array.from(xs).filter(Number.isFinite); return { mean: P.mean(a), p5: P.quantile(a, 0.05), p50: P.quantile(a, 0.5), p95: P.quantile(a, 0.95), max: Math.max(...a) } }
const p1 = share(R1, x => x >= D_E2), p1y = share(R1y, x => x >= D_E2)
log('placebo aléatoire (trades)')
const PF_R: number[] = [], EX_R: number[] = []
for (let b = 0; b < N_RAND_PF; b++) {
  const keep = new Uint8Array(N); for (const g of byAsset) pick(g.idx, g.n, keep)
  const r = selectionRun(keep)
  PF_R.push(pfStats(sleeveDaily('btc', r.btc.equity), sleeveDaily('ethusdt', r.ethusdt.equity)).sharpe)
  EX_R.push(executed(r))
  if ((b + 1) % 250 === 0) log(`placebo aléatoire (portefeuille) ${b + 1}/${N_RAND_PF}`)
}
const p1pf = share(PF_R, x => x >= PF_SEL.sharpe)

// ================================================================ 2. placebo par décalage
// Série E2 au pas de 15 min sur la fenêtre de l'échantillon de chaque actif ; une barre absente garde
// la valeur de la précédente.
const GRID = Object.fromEntries(KEYS.map(k => {
  const t = S[k].bars.t, lo = S[k].bars.t[S[k].lo], hi = CUT
  const L = Math.round((hi - lo) / M15), flag = new Uint8Array(L)
  let i = S[k].lo
  for (let s = 0; s < L; s++) { const ts = lo + s * M15; while (i + 1 < S[k].bars.n && t[i + 1] <= ts) i++; flag[s] = TREND[k][i] }
  return [k, { lo, L, flag }]
})) as Record<SleeveKey, { lo: number; L: number; flag: Uint8Array }>
const slotOf = SH.map(x => Math.round((x.t - GRID[x.k].lo) / M15))
const shiftKeep = (kDays: number) => Uint8Array.from(SH, (x, j) => { const g = GRID[x.k], s = (((slotOf[j] - kDays * 96) % g.L) + g.L) % g.L; return g.flag[s] })
check('décalage nul = E2', shiftKeep(0).every((x, j) => x === E2KEEP[j]), 'mêmes drapeaux pour les 794 shorts')
const LMIN = Math.floor(Math.min(...KEYS.map(k => GRID[k].L)) / 96)
const SHIFTS: number[] = []
for (let d = MIN_SHIFT; d <= LMIN - MIN_SHIFT; d++) SHIFTS.push(d)
const R2 = SHIFTS.map(d => dOf(shiftKeep(d)))
const N1shift = SHIFTS.map(d => P.sum(shiftKeep(d)))
const p2 = share(R2, x => x >= D_E2)
stopIfFailed('décalage')
log('placebo par décalage (trades)')
const PF_S: { k: number; sharpe: number; n1: number }[] = []
for (let j = 0; j < N_SHIFT_PF; j++) {
  const d = MIN_SHIFT + Math.round((j * (LMIN - 2 * MIN_SHIFT)) / (N_SHIFT_PF - 1))
  const keep = shiftKeep(d), r = selectionRun(keep)
  PF_S.push({ k: d, sharpe: pfStats(sleeveDaily('btc', r.btc.equity), sleeveDaily('ethusdt', r.ethusdt.equity)).sharpe, n1: P.sum(keep) })
  if ((j + 1) % 100 === 0) log(`placebo par décalage (portefeuille) ${j + 1}/${N_SHIFT_PF}`)
}
const p2pf = share(PF_S.map(x => x.sharpe), x => x >= PF_SEL.sharpe)

// ================================================================ 3. funding et glissement
interface Ev { t: number; rate: number }
const readFunding = (f: string): Ev[] => readFileSync(join(ROOT, 'research/data/funding', f), 'utf8').trim().split('\n').slice(1).map(l => { const [t, r] = l.split(','); return { t: +t, rate: +r } })
const BIN = { btc: readFunding('binance-BTCUSDT.csv'), ethusdt: readFunding('binance-ETHUSDT.csv') }
const HL = { btc: readFunding('hyperliquid-BTC.csv'), ethusdt: readFunding('hyperliquid-ETH.csv') }
const F2020 = Date.parse('2020-01-01T00:00:00Z'), FHL = HL.btc[0].t
const constant = (from: number, to: number, rate: number): Ev[] => { const out: Ev[] = []; for (let t = Math.ceil(from / H8) * H8; t < to; t += H8) out.push({ t, rate }); return out }
const simStart = (k: SleeveKey) => S[k].bars.t[S[k].lo]
const fileEnd = (k: SleeveKey) => S[k].bars.t[S[k].end] + M15
const SCEN = {
  binance: (k: SleeveKey) => [...constant(simStart(k), F2020, 0.0001), ...BIN[k]],
  hyperliquid: (k: SleeveKey) => [...constant(simStart(k), F2020, 0.0001), ...BIN[k].filter(e => e.t < FHL), ...HL[k]],
  shortsPay: (k: SleeveKey) => constant(simStart(k), fileEnd(k), -0.0001),
}
type Scen = keyof typeof SCEN
for (const k of KEYS) {
  const b = BIN[k], h = HL[k]
  check(`${NAME[k]} : funding croissant, sans trou de plus de 8 h (Binance) ni 1 h (Hyperliquid, après 2023-06)`, b.every((e, j) => !j || (e.t > b[j - 1].t && e.t - b[j - 1].t <= H8)) && h.every((e, j) => !j || e.t > h[j - 1].t) && h.filter(e => e.t > Date.parse('2023-06-01')).every((e, j, a) => !j || a[j].t - a[j - 1].t <= 3600000), `Binance ${b.length} versements du ${new Date(b[0].t).toISOString().slice(0, 10)} au ${new Date(b[b.length - 1].t).toISOString().slice(0, 10)}, Hyperliquid ${h.length} depuis le ${new Date(h[0].t).toISOString().slice(0, 10)}`)
}
/** Funding reçu par une position (≥ 0 reçu, < 0 payé) : versements après la clôture de la barre d'entrée, jusqu'à l'ouverture de la barre de sortie. */
function fundingOf(k: SleeveKey, p: PositionRecord, ev: Ev[], shortsOnly: boolean, byDay?: Map<number, number>) {
  if (shortsOnly && p.dir !== -1) return 0
  const t = S[k].bars.t, c = S[k].bars.c, from = t[p.entryIdx] + M15, to = t[p.exitIdx]
  let lo = 0, hi = ev.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t <= from) lo = m + 1; else hi = m }
  let cash = 0, bi = p.entryIdx
  for (let j = lo; j < ev.length && ev[j].t <= to; j++) {
    while (bi + 1 <= p.exitIdx && t[bi + 1] + M15 <= ev[j].t) bi++
    const f = -p.dir * ev[j].rate * p.qty * c[bi]
    cash += f
    if (byDay) { const d = Math.floor(ev[j].t / DAY); byDay.set(d, (byDay.get(d) ?? 0) + f) }
  }
  return cash
}
const FUND = (Object.keys(SCEN) as Scen[]).map(sc => {
  const shortsOnly = sc === 'shortsPay'
  const ev = { btc: SCEN[sc]('btc'), ethusdt: SCEN[sc]('ethusdt') }
  const Rf = Float64Array.from(SH, x => (x.p.pnl + fundingOf(x.k, x.p, ev[x.k], shortsOnly)) / x.p.equityAtEntry / x.sig)
  const fundShare = (g: number) => { const xs = SH.filter(x => x.e2 === g); return P.sum(xs.map(x => fundingOf(x.k, x.p, ev[x.k], shortsOnly) / x.p.equityAtEntry)) }
  const pf = (r: Record<SleeveKey, ShockResult>) => {
    const cash = KEYS.map(k => { const m = new Map<number, number>(); for (const p of r[k].positions) fundingOf(k, p, ev[k], shortsOnly, m); return m })
    return pfStats(sleeveDaily('btc', r.btc.equity, cash[0]), sleeveDaily('ethusdt', r.ethusdt.equity, cash[1]))
  }
  const byYear = [...new Set(SH.map(x => x.year))].sort().map(y => ({ year: y, d: dOf(E2KEEP, Float64Array.from(SH, (x, j) => (x.year === y ? Rf[j] : NaN))) }))
  return { scenario: sc, d: dOf(E2KEEP, Rf), fundE2: fundShare(1), fundOther: fundShare(0), v0: pf(V0), e2: pf(E2C), byYear }
})
log('funding')
const SLIP = SLIPS.map(sl => {
  const v = { btc: run('btc', S.btc.signals.short, sl), ethusdt: run('ethusdt', S.ethusdt.signals.short, sl) }
  const e = { btc: run('btc', maskE2('btc'), sl), ethusdt: run('ethusdt', maskE2('ethusdt'), sl) }
  const sh = [...shortsOf('btc', v.btc, VOL.btc), ...shortsOf('ethusdt', v.ethusdt, VOL.ethusdt)]
  return { slip: sl, d: dOf(Uint8Array.from(sh, x => x.e2), Float64Array.from(sh, x => x.R)), v0: pfStats(sleeveDaily('btc', v.btc.equity), sleeveDaily('ethusdt', v.ethusdt.equity)), e2: pfStats(sleeveDaily('btc', e.btc.equity), sleeveDaily('ethusdt', e.ethusdt.equity)) }
})
check('glissement nul = runs de référence', Math.abs(SLIP[0].v0.sharpe - PF_V0.sharpe) < 1e-12 && Math.abs(SLIP[0].d - D_E2) < 1e-12, 'mêmes Sharpe et D')
log('glissement')

// ================================================================ 4. stabilité
const yearRows = [...new Set(SH.map(x => x.year))].sort().map(y => {
  const sel = SH.map(x => x.year === y)
  const n1 = SH.filter((x, j) => sel[j] && x.e2).length, n0 = SH.filter((x, j) => sel[j] && !x.e2).length
  const d = dOf(E2KEEP, Float64Array.from(SH, (x, j) => (sel[j] ? x.R : NaN)))
  const days = pdays.map((dd, j) => (P.yearOf(dd) === y ? j : -1)).filter(j => j >= 0)
  return { year: y, n1, n0, d, sharpeV0: days.length > 20 ? sharpe(days.map(j => PF_V0.r[j])) : NaN, sharpeE2: days.length > 20 ? sharpe(days.map(j => PF_E2C.r[j])) : NaN, partial: days.length < 365 }
})
const monthEnd = pdays.map((d, j) => j === pdays.length - 1 || P.monthKey(pdays[j + 1]) !== P.monthKey(d))
// Premier mois complet de la période commune.
const firstFull = new Date(pdays[0] * DAY).getUTCDate() === 1 ? P.monthKey(pdays[0]) : P.monthKey(pdays[0]) + 1
const ROLL = [12, 24].map(months => {
  const rows: { end: string; v0: number; e2: number; diff: number; d: number; n1: number; n0: number }[] = []
  pdays.forEach((d, j) => {
    if (!monthEnd[j]) return
    const m1 = P.monthKey(d), m0 = m1 - months + 1
    if (m0 < firstFull) return
    const idx = pdays.map((x, i) => (P.monthKey(x) >= m0 && P.monthKey(x) <= m1 ? i : -1)).filter(i => i >= 0)
    const v0 = sharpe(idx.map(i => PF_V0.r[i])), e2 = sharpe(idx.map(i => PF_E2C.r[i]))
    const inW = SH.map(x => { const mk = P.monthKey(Math.floor(x.t / DAY)); return mk >= m0 && mk <= m1 })
    const d2 = dOf(E2KEEP, Float64Array.from(SH, (x, i) => (inW[i] ? x.R : NaN)))
    rows.push({ end: P.isoDay(d), v0, e2, diff: e2 - v0, d: d2, n1: SH.filter((x, i) => inW[i] && x.e2).length, n0: SH.filter((x, i) => inW[i] && !x.e2).length })
  })
  const diffs = rows.map(r => r.diff), ds = rows.map(r => r.d).filter(Number.isFinite)
  return { months, rows, n: rows.length, sharePos: share(diffs, x => x > 0), diff: dist(diffs), min: Math.min(...diffs), shareDPos: share(ds, x => x > 0), dDist: dist(ds), dMin: Math.min(...ds), nD: ds.length }
})
const fragile = ROLL[1].sharePos < 0.5
log('stabilité')

// ================================================================ conclusion et sorties
const F1 = FUND[0]
const elim = { random: p1 >= 0.05, shift: p2 >= 0.10, funding: !(F1.d > 0) }
const eliminated = elim.random || elim.shift || elim.funding
const num = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—')
const sgn = (x: number, d = 3) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + num(x, d) : '—')
const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d).replace('.', ',').replace('-', '−')} %` : '—')
let commit = 'inconnu', clean = false
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); clean = execSync('git status --porcelain -- lib research/shock research/lib research/preregistration research/data/funding', { cwd: ROOT }).toString().trim() === '' } catch { /* hors git */ }
const SCEN_LABEL: Record<Scen, string> = { binance: 'Funding historique Binance (avant 2020 : +0,01 % / 8 h)', hyperliquid: 'Idem, Hyperliquid depuis mai 2023', shortsPay: 'Stress : les shorts paient 0,01 % / 8 h en permanence' }

const L: string[] = []
L.push('# Diagnostics historiques de E2 · BTC/ETH', '')
L.push(`Pré-spécification : \`${PRESPEC}\` (commitée avant tout calcul). Produit par \`node research/shock/e2-diagnostics.ts\` au commit \`${commit.slice(0, 7)}\`${clean ? '' : ' (arbre de travail modifié)'}.`, '')
L.push('**Données déjà vues** : E2 a été choisie sur ces données. Ces diagnostics peuvent l\'éliminer, pas la valider. La validation forward (`research/preregistration/e2-forward.md`) n\'est pas modifiée. Simulation historique après coûts modélisés ; pas une performance live.', '')
L.push('## Conclusion', '')
L.push(`**${eliminated ? 'E2 ÉLIMINÉE' : 'E2 NON ÉLIMINÉE'}**${eliminated ? '' : ' : elle résiste aux trois tentatives de réfutation. Ce n\'est pas une validation ; seul le forward peut l\'apporter.'}`, '')
L.push('| Critère d\'élimination | Valeur | Seuil d\'élimination | Éliminée ? |', '|---|---|---|---|')
L.push(`| 1 · Placebo aléatoire, niveau trade : p1 | ${num(p1, 4)} | ≥ 0,05 | ${elim.random ? 'oui' : 'non'} |`)
L.push(`| 2 · Placebo par décalage, niveau trade : p2 | ${num(p2, 4)} | ≥ 0,10 | ${elim.shift ? 'oui' : 'non'} |`)
L.push(`| 3 · D avec funding historique | ${sgn(F1.d)} | ≤ 0 | ${elim.funding ? 'oui' : 'non'} |`)
L.push(`| 4 · Stabilité (sans élimination) : fenêtres de 24 mois où E2 bat la v1 | ${pct(ROLL[1].sharePos, 0)} | « fragile » si < 50 % | ${fragile ? 'fragile' : '—'} |`, '')
L.push(`Échantillon : ${N} shorts v1 fermés avant le 2026-10-01 (BTC depuis 2017, ETH depuis 2018-09), dont ${K.btc + K.ethusdt} en régime E2 baissier (BTC ${K.btc}, ETH ${K.ethusdt}). **D(E2) = ${sgn(D_E2)} σ** par short. Portefeuille 50/50 (2018-09-01 → 2026-09-30) : v1 ${num(PF_V0.sharpe, 2)} ; sélection E2 des shorts v1 ${num(PF_SEL.sharpe, 2)} ; challenger E2 (entrées masquées hors régime) ${num(PF_E2C.sharpe, 2)}.`, '')

L.push('## 1. Placebo par sous-échantillonnage aléatoire', '')
L.push(`On garde au hasard exactement autant de shorts v1 que E2, par actif (BTC ${K.btc}, ETH ${K.ethusdt}).`, '')
L.push('| Test | E2 | Placebo : moyenne | P95 | Max | p (placebo ≥ E2) | Tirages |', '|---|---|---|---|---|---|---|')
const d1 = dist(R1), d1y = dist(R1y), dpf = dist(PF_R)
L.push(`| D, même nombre par actif | ${sgn(D_E2)} | ${sgn(d1.mean)} | ${sgn(d1.p95)} | ${sgn(d1.max)} | ${num(p1, 4)} | ${N_RAND_TRADE} |`)
L.push(`| D, même nombre par actif et par année | ${sgn(D_E2)} | ${sgn(d1y.mean)} | ${sgn(d1y.p95)} | ${sgn(d1y.max)} | ${num(p1y, 4)} | ${N_RAND_TRADE} |`)
L.push(`| Sharpe du portefeuille 50/50 | ${num(PF_SEL.sharpe, 2)} | ${num(dpf.mean, 2)} | ${num(dpf.p95, 2)} | ${num(dpf.max, 2)} | ${num(p1pf, 3)} | ${N_RAND_PF} |`, '')
L.push(`Shorts réellement exécutés dans l'échantillon : sélection E2 ${executed(SEL_E2)}, placebos ${num(P.mean(EX_R), 1)} en moyenne (${Math.min(...EX_R)} à ${Math.max(...EX_R)}), pour ${K.btc + K.ethusdt} sélectionnés. Le placebo par année retire la part de E2 qui vient du choix des années : il mesure la sélection à l'intérieur d'une année.`, '')

L.push('## 2. Placebo par décalage temporel du régime', '')
L.push(`La série E2 de chaque actif est décalée circulairement de k jours (même k pour BTC et ETH), k de ${MIN_SHIFT} à ${LMIN - MIN_SHIFT} jours : ${SHIFTS.length} décalages. Persistance et part de temps en régime baissier conservées.`, '')
const d2 = dist(R2), dps = dist(PF_S.map(x => x.sharpe))
L.push('| Test | E2 | Placebo : moyenne | P95 | Max | p (placebo ≥ E2) | Décalages |', '|---|---|---|---|---|---|---|')
L.push(`| D | ${sgn(D_E2)} | ${sgn(d2.mean)} | ${sgn(d2.p95)} | ${sgn(d2.max)} | ${num(p2, 4)} | ${SHIFTS.length} |`)
L.push(`| Sharpe du portefeuille 50/50 | ${num(PF_SEL.sharpe, 2)} | ${num(dps.mean, 2)} | ${num(dps.p95, 2)} | ${num(dps.max, 2)} | ${num(p2pf, 3)} | ${N_SHIFT_PF} |`, '')
const best = SHIFTS.map((d, j) => ({ d, D: R2[j], n1: N1shift[j] })).sort((a, b) => b.D - a.D).slice(0, 5)
L.push(`Shorts gardés selon le décalage : ${Math.min(...N1shift)} à ${Math.max(...N1shift)} (médiane ${P.quantile(N1shift, 0.5)}), contre ${K.btc + K.ethusdt} pour E2. Décalages qui font le mieux : ${best.map(x => `${x.d} j (D ${sgn(x.D)}, ${x.n1} shorts)`).join(' ; ')}.`, '')

L.push('## 3. Funding des perpétuels et glissement', '')
L.push('Signe : un short reçoit le funding quand le taux est positif (les longs paient) et le paie quand il est négatif. Funding total en somme des versements rapportés à l\'equity à l\'entrée de chaque trade. Portefeuille : funding de toutes les positions (longs et shorts) ajouté aux rendements journaliers ; scénario de stress : shorts seulement.', '')
L.push('| Scénario | D | Funding des shorts E2 (Σ, % de l\'equity) | Funding des autres shorts | Sharpe v1 | Sharpe E2 | CAGR v1 · E2 | Drawdown v1 · E2 |', '|---|---|---|---|---|---|---|---|')
L.push(`| Sans funding | ${sgn(D_E2)} | — | — | ${num(PF_V0.sharpe, 2)} | ${num(PF_E2C.sharpe, 2)} | ${pct(PF_V0.cagr)} · ${pct(PF_E2C.cagr)} | ${pct(PF_V0.maxDD)} · ${pct(PF_E2C.maxDD)} |`)
for (const f of FUND) L.push(`| ${SCEN_LABEL[f.scenario as Scen]} | ${sgn(f.d)} | ${pct(f.fundE2)} | ${pct(f.fundOther)} | ${num(f.v0.sharpe, 2)} | ${num(f.e2.sharpe, 2)} | ${pct(f.v0.cagr)} · ${pct(f.e2.cagr)} | ${pct(f.v0.maxDD)} · ${pct(f.e2.maxDD)} |`)
L.push('')
L.push(`D par année avec le funding historique Binance : ${F1.byYear.map(x => `${x.year} ${sgn(x.d, 2)}`).join(' · ')}.`, '')
L.push('| Glissement par ordre | D | Sharpe v1 | Sharpe E2 | CAGR v1 · E2 |', '|---|---|---|---|---|')
for (const s of SLIP) L.push(`| ${num(s.slip, 2)} % | ${sgn(s.d)} | ${num(s.v0.sharpe, 2)} | ${num(s.e2.sharpe, 2)} | ${pct(s.v0.cagr)} · ${pct(s.e2.cagr)} |`)
L.push('', 'Hypothèses : quantité d\'entrée gardée jusqu\'à la sortie (les shorts n\'ont pas de TP1 ; pour les longs du régime agité, le funding après TP1 est légèrement surestimé, à l\'identique pour v1 et E2). Avant 2020, pas de données Binance : taux constant de +0,01 % par 8 h.', '')

L.push('## 4. Stabilité', '')
L.push('| Année | Shorts E2 · autres | D | Sharpe 50/50 v1 | Sharpe 50/50 E2 |', '|---|---|---|---|---|')
for (const y of yearRows) L.push(`| ${y.year}${y.partial ? ' (partielle)' : ''} | ${y.n1} · ${y.n0} | ${sgn(y.d, 2)} | ${num(y.sharpeV0, 2)} | ${num(y.sharpeE2, 2)} |`)
L.push('')
L.push('| Fenêtre glissante | Fenêtres | E2 bat la v1 (Sharpe) | Écart de Sharpe : médiane | P10 | P90 | Min | D > 0 | D : médiane | D : min |', '|---|---|---|---|---|---|---|---|---|---|')
for (const r of ROLL) L.push(`| ${r.months} mois | ${r.n} | ${pct(r.sharePos, 0)} | ${sgn(r.diff.p50, 2)} | ${sgn(P.quantile(r.rows.map(x => x.diff), 0.1), 2)} | ${sgn(P.quantile(r.rows.map(x => x.diff), 0.9), 2)} | ${sgn(r.min, 2)} | ${pct(r.shareDPos, 0)} (${r.nD}) | ${sgn(r.dDist.p50, 2)} | ${sgn(r.dMin, 2)} |`)
L.push('')
const worst24 = [...ROLL[1].rows].sort((a, b) => a.diff - b.diff).slice(0, 3)
L.push(`Fenêtres de 24 mois les plus défavorables à E2 (fin) : ${worst24.map(x => `${x.end} (${sgn(x.diff, 2)})`).join(' ; ')}. Séries complètes : \`rolling.csv\`.`, '')
L.push(`## Contrôles (${checks.filter(c => c.ok).length}/${checks.length})`, '')
for (const c of checks) L.push(`- ${c.ok ? '✔' : '✘'} ${c.name} · ${c.detail}`)
L.push('')

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'e2-diagnostics.md'), L.join('\n'))
const csv = ['window_months,month_end,sharpe_v1,sharpe_e2,diff,d,n_e2,n_other', ...ROLL.flatMap(r => r.rows.map(x => [r.months, x.end, x.v0, x.e2, x.diff, x.d, x.n1, x.n0].map(v => (typeof v === 'number' && !Number.isInteger(v) ? +v.toPrecision(8) : v)).join(',')))]
writeFileSync(join(OUT, 'rolling.csv'), csv.join('\n') + '\n')
writeFileSync(join(OUT, 'e2-diagnostics.json'), JSON.stringify({
  prespec: PRESPEC, commit, sourcesClean: clean, generatedAt: new Date().toISOString(), eliminated, elim,
  sample: { n: N, e2: K, dE2: D_E2 }, portfolio: { v1: PF_V0.sharpe, selectionE2: PF_SEL.sharpe, challengerE2: PF_E2C.sharpe },
  random: { p1, p1y, p1pf, trade: d1, tradeYear: d1y, pf: dpf, executed: { e2: executed(SEL_E2), mean: P.mean(EX_R) } },
  shift: { p2, p2pf, shifts: SHIFTS.length, trade: d2, pf: dps, n1Range: [Math.min(...N1shift), Math.max(...N1shift)] },
  funding: FUND.map(f => ({ scenario: f.scenario, d: f.d, fundE2: f.fundE2, fundOther: f.fundOther, v1: { sharpe: f.v0.sharpe, cagr: f.v0.cagr, maxDD: f.v0.maxDD }, e2: { sharpe: f.e2.sharpe, cagr: f.e2.cagr, maxDD: f.e2.maxDD }, byYear: f.byYear })),
  slippage: SLIP.map(s => ({ slip: s.slip, d: s.d, v1: s.v0.sharpe, e2: s.e2.sharpe })),
  years: yearRows, rolling: ROLL.map(r => ({ months: r.months, n: r.n, sharePos: r.sharePos, diff: r.diff, min: r.min, shareDPos: r.shareDPos, d: r.dDist })), fragile, checks,
}, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(10) : x), 1))
log(`écrit ${OUT} · ${eliminated ? 'E2 éliminée' : 'E2 non éliminée'}`)
