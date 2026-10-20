// Transfert de Shock Engine V1 aux futures GC et NQ, sur substituts Dukascopy
// (research/preregistration/futures-k-transfer.md et futures-k-transfer-proxy.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/futures-transfer/study.ts --stage dev [--markets gold,nasdaq]
//   (commit des rapports de développement)
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/futures-transfer/study.ts --stage holdout
//
// Étape « dev » : contrôles (empreintes, parité BTC), audit des données, étude d'événement au seuil figé,
// grille de k sur la période de développement, walk-forward des méthodes A et B, sélection finale, PBO.
// Étape « holdout » : refuse de tourner si les rapports de développement ne sont pas commités ; test
// final 2023-01 → 2026-09, hors échantillon complet, entrées au hasard, retard, Sharpe dégonflé, Holm,
// conclusions. Rapports publics sans valeur absolue de seuil (research/reports/futures-transfer/) ;
// valeurs absolues dans research/private/futures-transfer/ (exclu de git).

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { cscv, dsr, sharpe as sharpeOf } from '../lib/overfit.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { kGrid, signature, effectiveConfigs } from './lib/k-grid.ts'
import { loadCsv, sessionDays, coverageStart, auditData, newYorkClock, BLOCKS, MAIN_SESSION, SLOTS, inAnySlot, DAY, PROXY_LIMITS } from './lib/proxy-data.ts'
import type { DataAudit } from './lib/proxy-data.ts'
import { CONTRACTS, SCENARIOS, scenario, scaled, universe, setsFor, v1Signals, runV1, withCosts, daily, idxAt } from './lib/harness.ts'
import type { Universe, Contract, Run } from './lib/harness.ts'
import { HORIZONS, baseline, familyStats, zeroShotCriterion, randomEvents, shifted, excessOf } from './lib/event-study.ts'
import type { Ev, Family, Ctx } from './lib/event-study.ts'
import { scoreS, pickPlateau, plateauOK, quantileK } from './lib/selection.ts'
import type { Pos } from './lib/selection.ts'
import { mean, median, quantile, sdSample, loSharpe, neweyWestT, pOneSided, holm, rng } from './lib/stats.ts'
import { btcParity, frozenChecks, sha256 } from './lib/parity.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const STAGE = opt('stage', 'dev')
const MARKETS = opt('markets', 'gold,nasdaq').split(',') as MarketKey[]
const SEED = 20261020
const BOOT = 5000
const DRAWS_EV = 2000
const DRAWS_RND = Number(opt('rnd', '500'))
const END_MS = Date.parse('2026-10-01T00:00:00Z')
const HOLD0 = Date.parse('2023-01-01T00:00:00Z')
// --scratch : sorties dans un dossier de travail (marché « test » sur BTC, pour vérifier le script sans toucher aux substituts).
const SCRATCH = opt('scratch', '')
const PUB = SCRATCH ? join(SCRATCH, 'pub') : join(ROOT, 'research/reports/futures-transfer')
const PRIV = SCRATCH ? join(SCRATCH, 'priv') : join(ROOT, 'research/private/futures-transfer')

type MarketKey = 'gold' | 'nasdaq' | 'test'
interface MarketDef { key: MarketKey; label: string; short: string; futures: string; file: string; mintick: number | null; contract: Contract }
const DEFS: Record<MarketKey, MarketDef> = {
  gold: { key: 'gold', label: 'Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC', short: 'or (substitut XAU/USD)', futures: 'GC', file: 'research/data/xauusd_15m.csv.gz', mintick: 0.01, contract: CONTRACTS.gold },
  nasdaq: { key: 'nasdaq', label: 'CFD Nasdaq-100 USATECH.IDX/USD (Dukascopy, prix acheteur) — substitut de NQ', short: 'Nasdaq (substitut CFD USATECH)', futures: 'NQ', file: 'research/data/usatechidxusd_15m.csv.gz', mintick: null, contract: CONTRACTS.nasdaq },
  // Vérification du script seulement (BTC déjà connu, sorties avec --scratch) : jamais un résultat de l'étude.
  test: { key: 'test', label: 'TEST du script sur BTC/USD Bitstamp (pas un résultat)', short: 'test BTC', futures: 'test', file: 'research/data/btcusd_15m.csv.gz', mintick: 1, contract: { name: 'test', multiplier: 1, tick: 1 } },
}

// ---------------------------------------------------------------- mise en forme
const MINUS = '−'
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (Number.isFinite(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 3) => (Number.isFinite(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 1) => (Number.isFinite(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const int = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const yes = (b: boolean) => (b ? 'oui' : '**non**')
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const json = (o: unknown) => JSON.stringify(o, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(10) : String(v)) : v), 1) + '\n'
function table(L: string[], head: string[], rows: (string | number)[][]) {
  L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '')
}

// ---------------------------------------------------------------- marché
interface Mkt {
  def: MarketDef
  bars: Bars
  u: Universe
  dExt: number
  E0: number
  lo: number
  end: number
  devEnd: number
  folds: number[]
  audit: DataAudit
  mintick: number
  nyMin: Int16Array
  kBtc: number
}

function addMonths(ms: number, k: number) { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, d.getUTCDate()) }

function loadMarket(def: MarketDef): Mkt {
  const raw = loadCsv(join(ROOT, def.file))
  let n = 0
  while (n < raw.n && raw.t[n] < END_MS) n++
  const cut = (x: Float64Array) => x.slice(0, n)
  const all: Bars = { n, t: cut(raw.t), o: cut(raw.o), h: cut(raw.h), l: cut(raw.l), c: cut(raw.c), v: cut(raw.v) }
  const cov = coverageStart(all)
  if (!Number.isFinite(cov.t)) throw new Error(`${def.key} : aucune couverture continue`)
  const a0 = idxAt(all.t, cov.t)
  const sl = (x: Float64Array) => x.slice(a0)
  const bars: Bars = { n: all.n - a0, t: sl(all.t), o: sl(all.o), h: sl(all.h), l: sl(all.l), c: sl(all.c), v: sl(all.v) }
  // E0 : premier 1er janvier au moins 12 mois après la date (UTC) de D_ext.
  const dDay = Date.parse(isoDay(cov.t))
  const after = addMonths(dDay, 12)
  const y0 = new Date(after).getUTCFullYear()
  const E0 = Math.max(Date.UTC(after === Date.UTC(y0, 0, 1) ? y0 : y0 + 1, 0, 1), Date.UTC(2012, 0, 1))
  const lo = idxAt(bars.t, E0), end = bars.n - 1, devEnd = idxAt(bars.t, HOLD0) - 1
  const audit = auditData(bars, lo, end, PROXY_LIMITS)
  const mintick = def.mintick ?? audit.priceStep
  const u = universe(bars, sessionDays(bars), mintick)
  const firstFold = Math.max(2015, new Date(E0).getUTCFullYear() + 2)
  const folds: number[] = []
  for (let y = firstFold; y <= 2022; y++) folds.push(y)
  return { def, bars, u, dExt: cov.t, E0, lo, end, devEnd, folds, audit, mintick, nyMin: newYorkClock(bars.t).min, kBtc: u.calm.kMain }
}

// ---------------------------------------------------------------- mesures économiques
interface Econ {
  from: string; to: string; days: number; cagr: number; totalReturn: number; sharpe: number; loSharpe: number; sortino: number; calmar: number; maxDD: number; vol: number
  pf: number; trades: number; exposure: number; winRate: number; avgWin: number; avgLoss: number; payoff: number; skew: number; top5Share: number; meanTrade: number; medianTrade: number
  tNW: number; years: { y: number; ret: number; trades: number }[]; halves: number[]
}
/** Sharpe annualisé des rendements journaliers (formule de dailyMetrics). */
const annSharpe = (r: number[]) => { const m = P.moments(r); return m.sd > 0 ? (m.mean / m.sd) * Math.sqrt(P.ANN) : NaN }
const trades = (run: Run) => run.res.positions.map((p, j) => ({ p, net: run.net[j] })).filter(x => !x.p.exits.includes('END'))

function econ(u: Universe, run: Run, a: number, b: number, from: number, to: number): Econ & { r: number[]; days: number[] } {
  const d = daily(u, run.equity, a, b, from, to)
  const m = P.dailyMetrics(d.r, d.days)
  const tr = trades(run).map(x => x.net)
  const w = tr.filter(x => x > 0), l = tr.filter(x => x <= 0)
  const gp = w.reduce((s, x) => s + x, 0), gl = l.reduce((s, x) => s + x, 0)
  const mu = mean(tr), s = sdSample(tr)
  const lr = tr.map(x => Math.log(1 + x)), tot = lr.reduce((x, y) => x + y, 0)
  const top5 = [...lr].sort((x, y) => y - x).slice(0, Math.max(1, Math.round(0.05 * lr.length))).reduce((x, y) => x + y, 0)
  let inPos = 0
  for (let i = d.a; i <= d.z; i++) if (run.res.position[i] !== 0) inPos++
  const years: { y: number; ret: number; trades: number }[] = []
  const byY = new Map<number, number>()
  d.days.forEach((day, k) => { const y = new Date(day * DAY).getUTCFullYear(); byY.set(y, (byY.get(y) ?? 1) * (1 + d.r[k])) })
  for (const [y, g] of byY) years.push({ y, ret: g - 1, trades: trades(run).filter(x => new Date(u.bars.t[x.p.entryIdx]).getUTCFullYear() === y).length })
  return {
    from: isoDay(from), to: isoDay(to), days: d.days.length, cagr: m.cagr, totalReturn: m.totalReturn, sharpe: m.sharpe, loSharpe: loSharpe(d.r, P.ANN, 10).sharpe, sortino: m.sortino,
    calmar: m.calmar, maxDD: m.maxDD, vol: m.vol, pf: gl < 0 ? gp / -gl : gp > 0 ? Infinity : NaN, trades: tr.length, exposure: inPos / Math.max(1, d.z - d.a + 1),
    winRate: tr.length ? w.length / tr.length : NaN, avgWin: mean(w), avgLoss: mean(l), payoff: mean(w) / -mean(l),
    skew: s > 0 ? mean(tr.map(x => ((x - mu) / s) ** 3)) : NaN, top5Share: tot !== 0 ? top5 / tot : NaN, meanTrade: mu, medianTrade: median(tr),
    tNW: neweyWestT(d.r, 10), years: years.sort((x, y) => x.y - y.y), halves: [annSharpe(d.r.slice(0, d.r.length >> 1)), annSharpe(d.r.slice(d.r.length >> 1))], r: d.r, days: d.days,
  }
}
const stripR = <T extends { r: number[]; days: number[] }>(e: T) => { const { r: _r, days: _d, ...rest } = e; return rest }

/** Courbe de coûts : Sharpe à × 0 ; 0,5 ; 1 ; 2 ; 4 du scénario de référence, et coût de rentabilité nulle. */
function costCurve(u: Universe, res: ShockResult, c: Contract, a: number, b: number, from: number, to: number) {
  const pts = [0, 0.5, 1, 2, 4].map(f => ({ f, sharpe: econ(u, withCosts(res, c, scaled(f)), a, b, from, to).sharpe }))
  let be = NaN
  for (let j = 1; j < pts.length; j++) if (pts[j - 1].sharpe > 0 && pts[j].sharpe <= 0) be = pts[j - 1].f + ((pts[j].f - pts[j - 1].f) * pts[j - 1].sharpe) / (pts[j - 1].sharpe - pts[j].sharpe)
  return { pts, breakEven: be }
}
function scenarios(u: Universe, res: ShockResult, c: Contract, a: number, b: number, from: number, to: number) {
  return SCENARIOS.map(s => ({ key: s.key, label: s.label, ...stripR(econ(u, withCosts(res, c, s), a, b, from, to)) }))
}

// ---------------------------------------------------------------- runs de k
interface KRun { k: number; res: ShockResult; base: Run; pos: Pos[]; sig: { long: Uint8Array; short: Uint8Array }; key: string; prs0: ReturnType<typeof prepare> }

function runFor(M: Mkt, a: number, b: number, kAt: (i: number) => number) {
  const { sets, select, ks } = setsFor(M.u, a, b, kAt)
  const prs = sets.map(p => prepare(M.u.m, p))
  const sig = v1Signals(M.u, sets, select, a, b, prs)
  const res = runV1(M.u, sets, select, sig, a, b)
  return { sets, select, ks, prs, sig, res }
}

function gridRun(M: Mkt, k: number): KRun {
  const { prs, sig, res } = runFor(M, M.lo, M.devEnd, () => k)
  const base = withCosts(res, M.def.contract, scenario('base'))
  const pos = res.positions.map((p, j) => ({ entryIdx: p.entryIdx, exitIdx: p.exitIdx, net: base.net[j] }))
  const R = prs[0]
  const fl = new Uint8Array(M.devEnd - M.lo + 1), fs = new Uint8Array(M.devEnd - M.lo + 1)
  for (let i = M.lo; i <= M.devEnd; i++) { fl[i - M.lo] = R.impulseLong[i] & R.mainShock[i]; fs[i - M.lo] = R.impulseShort[i] & R.mainShock[i] }
  const key = signature(sig.long.subarray(M.lo, M.devEnd + 1), sig.short.subarray(M.lo, M.devEnd + 1), fl, fs)
  return { k, res, base, pos, sig, key, prs0: R }
}

// ---------------------------------------------------------------- étude d'événement
function eventStudy(M: Mkt) {
  const { u, lo, end } = M
  const R = prepare(u.m, u.calm)
  const ctx: Ctx = { t: u.bars.t, c: u.bars.c, atr: R.atr, nyMin: M.nyMin, lo, end }
  const base = baseline(ctx), baseUtc = baseline({ ...ctx, utcSlot: true })
  const { sig } = runFor(M, lo, end, () => M.kBtc)
  const F1: Ev[] = [], F2: Ev[] = [], F3: Ev[] = [], F4: Ev[] = []
  const c = u.bars.c
  for (let i = lo; i <= end; i++) {
    if (sig.long[i]) F1.push({ i, dir: 1 })
    if (sig.short[i]) F1.push({ i, dir: -1 })
    if (u.gap[i] || i === 0 || !(Math.abs(R.z[i]) > M.kBtc)) continue
    const dir: 1 | -1 = c[i] > c[i - 1] ? 1 : -1
    if (u.regime[i] === 0) {
      F2.push({ i, dir })
      if (dir === 1 ? c[i] > R.htfVal[i] : c[i] < R.htfVal[i]) F3.push({ i, dir })
    } else if (u.regime[i] === 1) F4.push({ i, dir })
  }
  const fams: [string, string, Ev[], number][] = [
    ['F1', 'entrées qualifiées de V1 (seuil figé)', F1, 0],
    ['F2', 'chocs bruts, régime calme', F2, 0],
    ['F3', 'chocs bruts dans le sens de la tendance 60 min, régime calme', F3, 0],
    ['F4', 'chocs bruts, régime agité (descriptif)', F4, 1],
  ]
  const families = fams.map(([k, l, ev], j) => familyStats(ctx, base, k, l, ev, SEED + j, BOOT))
  const elig = (reg: number) => (i: number) => u.regime[i] === reg && !u.gap[i] && R.atr[i] > 0
  const random = fams.map(([k, , ev, reg], j) => ({ key: k, byH: randomEvents(ctx, base, ev, i => u.regime[i], elig(reg), DRAWS_EV, SEED + 10 + j) }))
  const shifts = [1, 2, 4, -1, -2].map(s => ({ s, fam: familyStats(ctx, base, `F1${s > 0 ? '+' : ''}${s}`, `F1 décalé de ${s}`, shifted(F1, s, lo, end), SEED + 20, 2000) }))
  const sub = (key: string, label: string, ev: Ev[], b = base) => familyStats(ctx, b, key, label, ev, SEED + 30, 2000)
  const splits: Family[] = [
    sub('F1-long', 'F1 longs', F1.filter(e => e.dir === 1)), sub('F1-short', 'F1 shorts', F1.filter(e => e.dir === -1)),
    sub('F3-long', 'F3 longs', F3.filter(e => e.dir === 1)), sub('F3-short', 'F3 shorts', F3.filter(e => e.dir === -1)),
    sub('F2-calm', 'chocs bruts, régime calme (= F2)', F2), sub('F4-agit', 'chocs bruts, régime agité (= F4)', F4),
  ]
  const sessions: Family[] = []
  for (const [name, test] of [...BLOCKS, MAIN_SESSION[M.def.key]]) {
    sessions.push(sub(`F1 ${name}`, `F1 · ${name}`, F1.filter(e => test(M.nyMin[e.i]))))
    sessions.push(sub(`F3 ${name}`, `F3 · ${name}`, F3.filter(e => test(M.nyMin[e.i]))))
  }
  const [mainName, mainTest] = MAIN_SESSION[M.def.key]
  sessions.push(sub(`F1 hors ${mainName}`, `F1 · hors ${mainName}`, F1.filter(e => !mainTest(M.nyMin[e.i]))))
  sessions.push(sub(`F3 hors ${mainName}`, `F3 · hors ${mainName}`, F3.filter(e => !mainTest(M.nyMin[e.i]))))
  const slots: Family[] = []
  for (const [name, test] of SLOTS) slots.push(sub(`F3 ${name}`, `F3 · ${name}`, F3.filter(e => test(M.nyMin[e.i]))))
  slots.push(sub('F1 hors créneaux', 'F1 · hors créneaux d\'annonces', F1.filter(e => !inAnySlot(M.nyMin[e.i]))))
  slots.push(sub('F3 hors créneaux', 'F3 · hors créneaux d\'annonces', F3.filter(e => !inAnySlot(M.nyMin[e.i]))))
  const utc = [sub('F1 (UTC)', 'F1, référence au quart d\'heure UTC', F1, baseUtc), sub('F3 (UTC)', 'F3, référence au quart d\'heure UTC', F3, baseUtc)]
  // Holm en lecture sur 4 familles × 4 horizons (p unilatéral du t par grappes de mois).
  const ps = families.flatMap(f => f.byH.map(b => pOneSided(b.tCluster)))
  const adj = holm(ps)
  const holmTable = families.flatMap((f, a) => f.byH.map((b, j) => ({ key: f.key, h: b.h, p: ps[a * 4 + j], pHolm: adj[a * 4 + j] })))
  const F1s = families[0]
  const r16 = random[0].byH.find(x => x.h === 16)!
  const gate = { G1: zeroShotCriterion(F1s), G2: r16.p < 0.05, G3: F1s.n >= 150 }
  return { families, random, shifts, splits, sessions, slots, utc, holmTable, gate, present: gate.G1 && gate.G2 && gate.G3, nF: fams.map(f => f[2].length), F1 }
}

// ---------------------------------------------------------------- étape de développement
function dev(M: Mkt) {
  const { u, lo, devEnd } = M
  const t0 = Date.now()
  const log = (s: string) => process.stderr.write(`  ${M.def.key} · ${s} · ${((Date.now() - t0) / 1000).toFixed(0)} s\n`)
  const dataOK = M.audit.checks.every(c => c.ok)
  log(`données ${M.audit.first} → ${M.audit.last}, contrôles ${dataOK ? 'OK' : 'EN ÉCHEC'}`)
  const ev = eventStudy(M)
  log('étude d\'événement')
  const ks = kGrid()
  const runs = ks.map(k => gridRun(M, k))
  log('grille')
  const groups = effectiveConfigs(ks, k => runs[ks.indexOf(k)].key)
  const devFrom = M.E0, devTo = HOLD0 - DAY
  // Mesures par k sur la période de développement (privé : valeurs absolues de k).
  const R0 = prepare(u.m, u.calm)
  const ctxDev: Ctx = { t: u.bars.t, c: u.bars.c, atr: R0.atr, nyMin: M.nyMin, lo, end: devEnd }
  const baseDev = baseline(ctxDev)
  const perK = runs.map(r => {
    const e = econ(u, r.base, lo, devEnd, devFrom, devTo)
    const evs: Ev[] = []
    for (let i = lo; i <= devEnd; i++) { if (r.sig.long[i]) evs.push({ i, dir: 1 }); if (r.sig.short[i]) evs.push({ i, dir: -1 }) }
    const x16 = Array.from(excessOf(ctxDev, baseDev, evs, HORIZONS.indexOf(16)).exc).filter(Number.isFinite)
    return { k: r.k, group: groups.findIndex(g => g.ks.includes(r.k)), events: evs.length, excess16: mean(x16), ...stripR(e), r: e.r }
  })
  // Méthode A : walk-forward.
  const foldA = M.folds.map(Y => {
    const trainEnd = idxAt(u.bars.t, Date.UTC(Y, 0, 1) - DAY)
    const S = runs.map(r => scoreS(r.pos, lo, trainEnd))
    const pick = pickPlateau(ks, S.map(x => x.s))
    return { year: Y, S: S.map(x => x.s), n: S.map(x => [x.n1, x.n2]), ...pick }
  })
  const trainEndF = idxAt(u.bars.t, HOLD0 - DAY)
  const Sfinal = runs.map(r => scoreS(r.pos, lo, trainEndF))
  const finalA = pickPlateau(ks, Sfinal.map(x => x.s))
  const plateau = Number.isFinite(finalA.k) ? plateauOK(ks, Sfinal.map(x => x.s), finalA.k) : { ok: false, values: [null, null, null, null, null] }
  // Méthode B : seuil quantile.
  const admissible = (i: number) => !u.gap[i] && u.regime[i] === 0
  const foldB = M.folds.map(Y => ({ year: Y, k: quantileK(R0.z, lo, idxAt(u.bars.t, Date.UTC(Y, 0, 1) - DAY), admissible) }))
  const finalB = quantileK(R0.z, lo, trainEndF, admissible)
  log('sélection')
  // Validation : une simulation continue par méthode.
  const v0 = Date.UTC(M.folds[0], 0, 1)
  const vA = idxAt(u.bars.t, v0)
  const yearIdx = (i: number) => new Date(u.bars.t[i]).getUTCFullYear()
  const kA = (i: number) => { const f = foldA.find(x => x.year === yearIdx(i)); return f && f.trade ? f.k : NaN }
  const kB = (i: number) => foldB.find(x => x.year === yearIdx(i))?.k ?? NaN
  const valA = runFor(M, vA, devEnd, kA), valB = runFor(M, vA, devEnd, kB)
  const validation = (r: ReturnType<typeof runFor>) => {
    const base = withCosts(r.res, M.def.contract, scenario('base'))
    const e = econ(u, base, vA, devEnd, v0, devTo)
    const pos = e.years.filter(y => y.ret > 0).length
    return { econ: stripR(e), r: e.r, scenarios: scenarios(u, r.res, M.def.contract, vA, devEnd, v0, devTo), costCurve: costCurve(u, r.res, M.def.contract, vA, devEnd, v0, devTo), yearsPositive: pos / Math.max(1, e.years.length), C2: e.sharpe > 0.3 && e.pf > 1.1 && pos / Math.max(1, e.years.length) >= 0.5 }
  }
  const VA = validation(valA), VB = validation(valB)
  log('validation')
  // V1 figée (seuil BTC) sur la période de développement, descriptif.
  const jB = ks.findIndex(k => Math.abs(k - M.kBtc) < 1e-9)
  const frozen = jB >= 0 ? { scenarios: scenarios(u, runs[jB].res, M.def.contract, lo, devEnd, devFrom, devTo), costCurve: costCurve(u, runs[jB].res, M.def.contract, lo, devEnd, devFrom, devTo) } : null
  // PBO : une configuration par groupe effectif, rendements journaliers de développement.
  const reps = groups.map(g => perK[ks.indexOf(g.ks[0])].r)
  const pbo = reps.length >= 2 ? cscv(reps, 16) : null
  const trialSharpe = reps.map(r => sharpeOf(r))
  const trialSd = reps.length >= 2 ? sdSample(trialSharpe) : NaN
  log('PBO')
  const offsetSteps = (k: number) => (Number.isFinite(k) && Number.isFinite(finalA.k) ? Math.round((k - finalA.k) * 10) : null)
  const publicOut = {
    schema: 'futures-k-transfer-dev/1', market: M.def.key, label: M.def.label, generatedAt: new Date().toISOString(),
    data: { file: M.def.file, sha256: sha256(readFileSync(join(ROOT, M.def.file))), coverageStart: new Date(M.dExt).toISOString(), E0: isoDay(M.E0), devEnd: isoDay(HOLD0 - DAY), folds: M.folds, audit: M.audit, ok: dataOK, integrityOk: M.audit.checks.filter(c => !c.coverage).every(c => c.ok) },
    eventStudy: { families: ev.families, random: ev.random, shifts: ev.shifts.map(x => ({ s: x.s, ...x.fam })), splits: ev.splits, sessions: ev.sessions, slots: ev.slots, utc: ev.utc, holm: ev.holmTable, gate: ev.gate, present: ev.present },
    grid: {
      size: ks.length, effective: groups.length, groupSizes: groups.map(g => g.ks.length),
      admissibleFinal: Sfinal.filter(x => x.s >= 1).length,
      plateauFinal: { ok: plateau.ok, S: plateau.values }, finalTrades: finalA.trade, finalP: finalA.p,
      foldsA: foldA.map(f => ({ year: f.year, p: f.p, trade: f.trade, offsetSteps: offsetSteps(f.k), admissible: f.S.filter(s => s >= 1).length })),
      foldsB: foldB.map(f => ({ year: f.year, offsetFromFinalB: f.k - finalB })),
      pbo: pbo ? { pbo: pbo.pbo, probLoss: pbo.probLoss, slope: pbo.slope, splits: pbo.splits } : null, trialSharpeSd: trialSd,
    },
    validation: { from: isoDay(v0), to: isoDay(devTo), A: { ...VA, r: undefined }, B: { ...VB, r: undefined } },
    frozenV1Dev: frozen,
    checks: [...frozenChecks()],
  }
  const privateOut = {
    market: M.def.key, kBtc: M.kBtc, grid: ks, perK: perK.map(p => { const { r: _r, ...x } = p; return x }), groups,
    Sfinal: Sfinal.map((x, j) => ({ k: ks[j], ...x })), foldsA: foldA.map(f => ({ year: f.year, k: f.k, p: f.p, trade: f.trade, S: f.S })), finalA,
    foldsB: foldB, finalB, plateau,
  }
  return { publicOut, privateOut, VA, VB, ev }
}

// ---------------------------------------------------------------- rapports de développement
function devReport(M: Mkt, out: ReturnType<typeof dev>, privSha: string): string {
  const { publicOut: O, ev } = out
  const L: string[] = []
  L.push(`# Transfert de Shock Engine V1 · ${M.def.short} · étape de développement`, '')
  L.push(`**Substitut, pas des futures** : ${M.def.label}. Protocole \`research/preregistration/futures-k-transfer.md\` et additif \`futures-k-transfer-proxy.md\`. Produit par \`node research/futures-transfer/study.ts --stage dev\`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : \`${privSha}\`.`, '')
  L.push('## Données', '')
  const A = O.data.audit
  L.push(`- Fichier \`${O.data.file}\` (SHA-256 \`${O.data.sha256.slice(0, 16)}…\`). Couverture continue à partir du ${O.data.coverageStart.slice(0, 16).replace('T', ' ')} UTC ; évaluation du ${O.data.E0} au ${A.last.slice(0, 10)} ; développement jusqu'au ${O.data.devEnd} ; plis de validation ${O.data.folds[0]} – ${O.data.folds.at(-1)}.`)
  L.push(`- ${int(A.bars)} bougies de 15 min ; ${int(A.gapsAfterClosure)} suivent une fermeture (pas d'entrée) ; ${int(A.zeroVolume)} sans volume ; pas de prix ${fr(String(A.priceStep))}.`)
  L.push(`- Plus forts rendements 15 min (écarts types) : ${A.largestMoves.slice(0, 8).map(x => `${x.t} ${sg(x.z, 1)}${x.afterGap ? ' (après fermeture)' : ''}`).join(' · ')}.`, '')
  table(L, ['contrôle bloquant', 'résultat', 'détail'], A.checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
  table(L, ['année', 'quarts d\'heure prévus', 'manquants', 'séances fériées', 'trous imprévus > 60 min'], A.years.map(y => [y.y, int(y.expected), pc(y.missingShare, 2), y.holidays, y.unscheduledGaps60]))
  L.push('## Étape 1 — étude d\'événement au seuil figé de V1 (avant toute calibration)', '')
  L.push('Rendement dans le sens de l\'événement en ATR (jeu calme) ; excès = moins le mouvement moyen d\'une bougie quelconque de la même année au même quart d\'heure de New York. Intervalles par bootstrap des mois (5 000 tirages) ; t par grappes de mois et t de Newey–West sur les sommes journalières. Horizons en bougies de cotation.', '')
  const fr1 = (f: Family) => f.byH.map(b => [`${b.h}`, int(b.n), sg(b.meanRaw), sg(b.medianRaw), sg(b.meanExcess), sg(b.medianExcess), `${sg(b.ci90[0])} à ${sg(b.ci90[1])}`, `${sg(b.ci95[0])} à ${sg(b.ci95[1])}`, num(b.tCluster), num(b.tNW), `${sg(b.halves[0])} / ${sg(b.halves[1])}`, `${pc(b.yearsPos, 0)} de ${b.nYears}`, pc(b.spansClosure, 0)])
  const headF = ['bougies', 'n', 'brut moyen', 'brut médian', 'excès moyen', 'excès médian', 'IC 90 %', 'IC 95 %', 't grappes', 't NW', 'moitiés', 'années > 0', 'traverse une fermeture']
  for (const f of ev.families) { L.push(`### ${f.key} · ${f.label} · ${int(f.n)} événements`, ''); table(L, headF, fr1(f)) }
  L.push(`**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : ${yes(ev.gate.G1)} · G2 événements au hasard p < 0,05 à 16 bougies : ${yes(ev.gate.G2)} · G3 au moins 150 événements : ${yes(ev.gate.G3)} → **${ev.present ? 'phénomène présent' : 'phénomène non démontré'}**.`, '')
  L.push('### Événements au hasard (2 000 tirages, même année, même sens, même régime)', '')
  table(L, ['famille', ...HORIZONS.map(h => `${h} b. : observé · médiane · 95e c. · p`)], ev.random.map(r => [r.key, ...r.byH.map(b => `${sg(b.observed)} · ${sg(b.q50)} · ${sg(b.q95)} · ${num(b.p, 3)}`)]))
  L.push('### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)', '')
  table(L, ['décalage', 'n', ...HORIZONS.map(h => `excès ${h} b. (IC 90 %)`)], ev.shifts.map(x => [x.s > 0 ? `+${x.s}` : String(x.s), int(x.fam.n), ...x.fam.byH.map(b => `${sg(b.meanExcess)} (${sg(b.ci90[0])} à ${sg(b.ci90[1])})`)]))
  const short = (fs: Family[]) => fs.map(f => [f.label, int(f.n), ...[4, 16].map(h => { const b = f.byH.find(x => x.h === h)!; return `${sg(b.meanExcess)} (${sg(b.ci90[0])} à ${sg(b.ci90[1])})` })])
  L.push('### Par sens et par régime', '')
  table(L, ['découpage', 'n', 'excès 4 b. (IC 90 %)', 'excès 16 b. (IC 90 %)'], short(ev.splits))
  L.push('### Par séance (lecture seulement)', '')
  table(L, ['découpage', 'n', 'excès 4 b. (IC 90 %)', 'excès 16 b. (IC 90 %)'], short(ev.sessions))
  L.push('### Créneaux d\'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d\'heure UTC', '')
  table(L, ['découpage', 'n', 'excès 4 b. (IC 90 %)', 'excès 16 b. (IC 90 %)'], short([...ev.slots, ...ev.utc]))
  L.push('### p ajustés de Holm (lecture, 16 tests unilatéraux)', '')
  table(L, ['famille', ...HORIZONS.map(h => `${h} b. p · Holm`)], ev.families.map(f => [f.key, ...HORIZONS.map(h => { const x = ev.holmTable.find(y => y.key === f.key && y.h === h)!; return `${num(x.p, 4)} · ${num(x.pHolm, 4)}` })]))
  const G = O.grid
  L.push('## Étapes 2 et 3 — grille de k et sélection (période de développement)', '')
  L.push(`- Grille de ${G.size} valeurs ; **${G.effective} configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : ${G.groupSizes.join(', ')}).`)
  L.push(`- Calibration finale (jusqu'au ${O.data.devEnd}) : ${G.admissibleFinal} valeurs de k sur ${G.size} ont S ≥ 1 ; plateau P(k*) = ${num(G.finalP)} ; ${G.finalTrades ? 'tradé' : '**non tradé (P < 1)**'} ; plateau ± 2 crans (C6) : ${yes(G.plateauFinal.ok)} (S à −2, −1, 0, +1, +2 crans : ${G.plateauFinal.S.map(v => (v === null ? 'hors grille' : num(v))).join(' · ')}).`)
  L.push(`- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : ${G.pbo ? `**${pc(G.pbo.pbo, 1)}** (P(perte) ${pc(G.pbo.probLoss, 0)}, pente ${num(G.pbo.slope)})` : 'non calculable (moins de deux configurations)'} ; dispersion des Sharpe journaliers des essais ${num(G.trialSharpeSd, 4)}.`, '')
  table(L, ['pli (test)', 'méthode A : P(k*)', 'tradé', 'k* (crans / k final)', 'k admissibles (S ≥ 1)', 'méthode B : k_B − k_B final'], G.foldsA.map((f, j) => [f.year, num(f.p), f.trade ? 'oui' : 'non', f.offsetSteps === null ? '—' : sg(f.offsetSteps, 0), f.admissible, sg(G.foldsB[j].offsetFromFinalB, 2)]))
  L.push(`## Validation ${O.validation.from} → ${O.validation.to} (walk-forward, coûts de référence)`, '')
  const er = (name: string, e: Econ) => [name, pc(e.cagr), num(e.sharpe), num(e.loSharpe), num(e.sortino), num(e.calmar), pc(e.maxDD), num(e.pf), int(e.trades), pc(e.exposure, 1), pc(e.winRate, 0), pc(e.avgWin, 2), pc(e.avgLoss, 2), num(e.payoff), num(e.skew), pc(e.top5Share, 0), num(e.tNW)]
  const headE = ['', 'CAGR', 'Sharpe', 'Sharpe Lo', 'Sortino', 'Calmar', 'DD max', 'PF', 'trades', 'exposition', 'gagnants', 'gain moy.', 'perte moy.', 'payoff', 'asym.', 'part 5 % meilleurs', 't NW']
  table(L, headE, [er('A — seuil fixe choisi à l\'entraînement', O.validation.A.econ as Econ), er('B — seuil Q99 %', O.validation.B.econ as Econ)])
  L.push(`C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A ${yes(O.validation.A.C2)} (${pc(O.validation.A.yearsPositive, 0)} des années positives) · B ${yes(O.validation.B.C2)} (${pc(O.validation.B.yearsPositive, 0)}).`, '')
  for (const [name, V] of [['A', O.validation.A], ['B', O.validation.B]] as const) {
    L.push(`### Méthode ${name} : années, moitiés, scénarios de coûts`, '')
    L.push(`Sharpe par moitié de la validation : ${num((V.econ as Econ).halves[0])} puis ${num((V.econ as Econ).halves[1])}.`, '')
    table(L, ['année', 'rendement', 'trades'], (V.econ as Econ).years.map(y => [y.y, pc(y.ret), y.trades]))
    table(L, ['scénario', 'CAGR', 'Sharpe', 'PF', 'DD max', 'trades'], V.scenarios.map(s => [s.label, pc(s.cagr), num(s.sharpe), num(s.pf), pc(s.maxDD), int(s.trades)]))
    L.push(`Sharpe selon le coût (× référence) : ${V.costCurve.pts.map(p => `× ${fr(String(p.f))} → ${num(p.sharpe)}`).join(' · ')} ; ${Number.isFinite(V.costCurve.breakEven) ? `rentabilité nulle vers × ${num(V.costCurve.breakEven)}` : V.costCurve.pts.at(-1)!.sharpe > 0 ? 'rentable sur toute la plage' : 'pas rentable même sans coûts'}.`, '')
  }
  if (O.frozenV1Dev) {
    L.push(`## V1 figée (seuil BTC) sur la période de développement ${O.data.E0} → ${O.data.devEnd} (descriptif)`, '')
    table(L, ['scénario', 'CAGR', 'Sharpe', 'Sharpe Lo', 'PF', 'DD max', 'trades', 'exposition'], O.frozenV1Dev.scenarios.map(s => [s.label, pc(s.cagr), num(s.sharpe), num(s.loSharpe), num(s.pf), pc(s.maxDD), int(s.trades), pc(s.exposure, 1)]))
  }
  L.push('## Contrôles', '')
  table(L, ['contrôle', 'résultat'], O.checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**']))
  return L.join('\n')
}

function privateDevReport(M: Mkt, P0: ReturnType<typeof dev>['privateOut']): string {
  const L: string[] = []
  L.push(`# PRIVÉ — ${M.def.short} · seuils absolus (ne pas publier sans autorisation)`, '')
  L.push(`Seuil figé de V1 (BTC) : ${num(P0.kBtc, 2)}. Méthode A, k final : ${num(P0.finalA.k, 1)} (P = ${num(P0.finalA.p)}, ${P0.finalA.trade ? 'tradé' : 'non tradé'}). Méthode B, k_B final (Q99 %) : ${num(P0.finalB, 3)}.`, '')
  table(L, ['k', 'groupe', 'S final', 'événements F1', 'excès 16 b.', 'CAGR', 'Sharpe', 'Sharpe Lo', 'Sortino', 'Calmar', 'DD max', 'PF', 'trades', 'exposition'], P0.perK.map((p, j) => [num(p.k, 1), p.group, num(P0.Sfinal[j].s), p.events, sg(p.excess16), pc(p.cagr), num(p.sharpe), num(p.loSharpe), num(p.sortino), num(p.calmar), pc(p.maxDD), num(p.pf), p.trades, pc(p.exposure, 1)]))
  table(L, ['pli', 'k* (A)', 'P', 'tradé', 'k_B'], P0.foldsA.map((f, j) => [f.year, num(f.k, 1), num(f.p), f.trade ? 'oui' : 'non', num(P0.foldsB[j].k, 3)]))
  table(L, ['pli \\ k', ...P0.grid.map(k => num(k, 1))], P0.foldsA.map(f => [f.year, ...f.S.map(s => num(s))]))
  return L.join('\n')
}

// ---------------------------------------------------------------- étape finale (hold-out)
function gitClean(path: string): boolean {
  try {
    execSync(`git ls-files --error-unmatch "${path}"`, { cwd: ROOT, stdio: 'ignore' })
    return execSync(`git status --porcelain -- "${path}"`, { cwd: ROOT }).toString().trim() === ''
  } catch { return false }
}

function randomEntriesTest(M: Mkt, segs: { a: number; b: number; from: number; to: number; kAt: (i: number) => number }[], strat: number, draws: number, seed: number) {
  const rand = rng(seed)
  const prepped = segs.map(s => {
    const r = runFor(M, s.a, s.b, s.kAt)
    const agi = r.sets.length - 1
    const pools: number[][] = r.sets.map(() => []), poolsS: number[][] = r.sets.map(() => [])
    const nL = r.sets.map(() => 0), nS = r.sets.map(() => 0)
    for (let i = s.a; i <= s.b; i++) {
      const e = r.select[i]
      if (e < 0 || e === agi || M.u.gap[i]) continue
      pools[e].push(i); if (M.u.trend[i]) poolsS[e].push(i)
      nL[e] += r.sig.long[i]; nS[e] += r.sig.short[i]
    }
    const want = trades(withCosts(r.res, M.def.contract, scenario('base'))).length
    return { s, r, pools, poolsS, nL, nS, want }
  })
  const one = (q: (typeof prepped)[number], f: number) => {
    const n = M.u.bars.n
    const long = new Uint8Array(n), short = new Uint8Array(n)
    q.r.sets.forEach((_, e) => {
      if (q.pools[e].length) for (let j = 0; j < Math.round(q.nL[e] * f); j++) long[q.pools[e][Math.floor(rand() * q.pools[e].length)]] = 1
      if (q.poolsS[e].length) for (let j = 0; j < Math.round(q.nS[e] * f); j++) short[q.poolsS[e][Math.floor(rand() * q.poolsS[e].length)]] = 1
    })
    return withCosts(runV1(M.u, q.r.sets, q.r.select, { long, short }, q.s.a, q.s.b), M.def.contract, scenario('base'))
  }
  // Facteur de tirage ajusté pour retrouver le nombre de trades (méthode de zero-shot.ts).
  const factors = prepped.map(q => {
    let f = 1
    if (!q.want) return 0
    for (let it = 0; it < 3; it++) { const got = quantile(Array.from({ length: 3 }, () => trades(one(q, f)).length), 0.5); if (got > 0) f *= q.want / got }
    return f
  })
  const sh: number[] = []
  for (let d = 0; d < draws; d++) {
    const r: number[] = []
    prepped.forEach((q, j) => { const run = factors[j] ? one(q, factors[j]) : withCosts(q.r.res, M.def.contract, scenario('zero')); const x = daily(M.u, run.equity, q.s.a, q.s.b, q.s.from, q.s.to); r.push(...x.r) })
    sh.push(annSharpe(r))
  }
  return { draws, beaten: sh.filter(x => x < strat).length / draws, median: median(sh), q95: quantile(sh, 0.95) }
}

function holdout() {
  const res: Record<string, unknown> = {}
  const hyps: { market: MarketKey; method: 'A' | 'B'; p: number }[] = []
  const ctxs: Record<string, { M: Mkt; devPub: any; devPriv: any; out: Record<string, any> }> = {}
  for (const key of MARKETS) {
    const pubPath = `research/reports/futures-transfer/${key}/dev.json`
    // Le marché « test » (avec --scratch) ne passe pas par git ; les substituts, toujours.
    if (!SCRATCH && !gitClean(pubPath)) throw new Error(`${pubPath} n'est pas commité (ou modifié) : commit des résultats de développement avant le test final`)
    const devPub = JSON.parse(readFileSync(join(PUB, key, 'dev.json'), 'utf8'))
    const privPath = join(PRIV, `${key}-dev.json`)
    const privText = readFileSync(privPath, 'utf8')
    if (sha256(privText) !== devPub.privateSha256) throw new Error(`${key} : le fichier privé de développement ne correspond pas à l'empreinte commitée`)
    const devPriv = JSON.parse(privText)
    const M = loadMarket(DEFS[key])
    ctxs[key] = { M, devPub, devPriv, out: {} }
  }
  for (const key of MARKETS) {
    const { M, devPub, devPriv, out } = ctxs[key]
    const u = M.u
    const v0 = Date.UTC(M.folds[0], 0, 1), vA = idxAt(u.bars.t, v0), devTo = HOLD0 - DAY
    const h0 = idxAt(u.bars.t, HOLD0), hEnd = M.end, hTo = END_MS - DAY
    const yearOf = (i: number) => new Date(u.bars.t[i]).getUTCFullYear()
    const kAval = (i: number) => { const f = devPriv.foldsA.find((x: any) => x.year === yearOf(i)); return f && f.trade ? f.k : NaN }
    const kBval = (i: number) => devPriv.foldsB.find((x: any) => x.year === yearOf(i))?.k ?? NaN
    const kAho = () => (devPriv.finalA.trade ? devPriv.finalA.k : NaN), kBho = () => devPriv.finalB
    for (const [method, kv, kh] of [['A', kAval, kAho], ['B', kBval, kBho]] as const) {
      const val = runFor(M, vA, M.devEnd, kv), ho = runFor(M, h0, hEnd, kh)
      const valBase = withCosts(val.res, M.def.contract, scenario('base')), hoBase = withCosts(ho.res, M.def.contract, scenario('base'))
      const eVal = econ(u, valBase, vA, M.devEnd, v0, devTo), eHo = econ(u, hoBase, h0, hEnd, HOLD0, hTo)
      const comb = [...eVal.r, ...eHo.r]
      const combDays = [...eVal.days, ...eHo.days]
      const mComb = { ...P.dailyMetrics(comb, combDays), sharpe: annSharpe(comb) }
      const tNW = neweyWestT(comb, 10)
      const trVal = trades(valBase), trHo = trades(hoBase)
      const all = [...trVal, ...trHo].map(x => x.net)
      const pf = (xs: number[]) => { const gp = xs.filter(x => x > 0).reduce((s, x) => s + x, 0), gl = xs.filter(x => x <= 0).reduce((s, x) => s + x, 0); return gl < 0 ? gp / -gl : gp > 0 ? Infinity : NaN }
      const high = [...trades(withCosts(val.res, M.def.contract, scenario('high'))), ...trades(withCosts(ho.res, M.def.contract, scenario('high')))].map(x => x.net)
      // Retard d'une bougie, dans chacun des deux segments.
      const delayed = (r: ReturnType<typeof runFor>, a: number, b: number) => {
        const n = u.bars.n, long = new Uint8Array(n), short = new Uint8Array(n)
        for (let i = a; i < b; i++) { if (r.sig.long[i]) long[i + 1] = 1; if (r.sig.short[i]) short[i + 1] = 1 }
        return trades(withCosts(runV1(u, r.sets, r.select, { long, short }, a, b), M.def.contract, scenario('base'))).map(x => x.net)
      }
      const delayNet = [...delayed(val, vA, M.devEnd), ...delayed(ho, h0, hEnd)]
      const rnd = randomEntriesTest(M, [{ a: vA, b: M.devEnd, from: v0, to: devTo, kAt: kv }, { a: h0, b: hEnd, from: HOLD0, to: hTo, kAt: kh }], mComb.sharpe, DRAWS_RND, SEED + (method === 'A' ? 100 : 200) + (key === 'gold' ? 0 : 1000))
      const nEff = devPub.grid.effective + 1
      const D = dsr(comb, nEff, devPub.grid.trialSharpeSd)
      const lineage = [222, 6266].map(N => ({ N, p: dsr(comb, N, devPub.grid.trialSharpeSd).p }))
      out[method] = {
        holdout: { ...stripR(eHo), scenarios: scenarios(u, ho.res, M.def.contract, h0, hEnd, HOLD0, hTo), costCurve: costCurve(u, ho.res, M.def.contract, h0, hEnd, HOLD0, hTo) },
        combined: { from: isoDay(v0), to: isoDay(hTo), sharpe: mComb.sharpe, loSharpe: loSharpe(comb, P.ANN, 10).sharpe, cagr: mComb.cagr, maxDD: mComb.maxDD, sortino: mComb.sortino, calmar: mComb.calmar, tNW, p: pOneSided(tNW), pf: pf(all), pfHigh: pf(high), trades: all.length, meanTrade: mean(all), meanDelayed: mean(delayNet), random: rnd, dsr: { N: nEff, sr0: D.sr0, p: D.p }, lineage },
      }
      hyps.push({ market: key, method, p: pOneSided(tNW) })
      process.stderr.write(`  ${key} · méthode ${method} · test final et hors échantillon complet\n`)
    }
  }
  const adj = holm(hyps.map(h => h.p))
  hyps.forEach((h, j) => { ctxs[h.market].out[h.method].combined.pHolm = adj[j] })
  for (const key of MARKETS) {
    const { M, devPub, devPriv, out } = ctxs[key]
    const C1 = devPub.eventStudy.present && devPub.data.ok
    // Analyse secondaire (additif n° 2) : contrôles de couverture ignorés, intégrité exigée.
    const C1sec = devPub.eventStudy.present && devPub.data.integrityOk
    const crit = (m: 'A' | 'B', C1: boolean) => {
      const o = out[m], V = devPub.validation[m]
      const c = {
        C1, C2: V.C2,
        C3: o.holdout.sharpe > 0 && o.holdout.pf > 1 && o.combined.pfHigh > 1,
        C4: o.combined.pHolm < 0.05,
        C5: o.combined.random.beaten >= 0.9 && o.combined.meanTrade > 0 && o.combined.meanDelayed >= 0.5 * o.combined.meanTrade,
        C6: m === 'A' ? devPub.grid.plateauFinal.ok && devPub.grid.pbo !== null && devPub.grid.pbo.pbo < 0.5 : true,
        C7: o.combined.dsr.p >= 0.95,
      }
      return { ...c, all: Object.values(c).every(Boolean) }
    }
    const cA = crit('A', C1), cB = crit('B', C1)
    const verdict = !devPub.data.ok ? 'D' : !C1 ? 'C' : cA.all || cB.all ? 'A' : 'B'
    const sA = crit('A', C1sec), sB = crit('B', C1sec)
    const secondary = devPub.data.ok ? null : { verdict: !devPub.data.integrityOk ? 'D' : !C1sec ? 'C' : sA.all || sB.all ? 'A' : 'B', criteria: { A: sA, B: sB }, failed: devPub.data.audit.checks.filter((c: any) => !c.ok).map((c: any) => c.name) }
    res[key] = { verdict, criteria: { A: cA, B: cB }, secondary, out, privateFinal: { kFinalA: devPriv.finalA.k, tradeA: devPriv.finalA.trade, kFinalB: devPriv.finalB } }
    void M
  }
  return { res, ctxs, hyps: hyps.map((h, j) => ({ ...h, pHolm: adj[j] })) }
}

function finalReport(key: MarketKey, R: any, devPub: any, hyps: any[]): string {
  const L: string[] = []
  const D = DEFS[key]
  const V = R.verdict as string
  const words: Record<string, string> = {
    A: 'le phénomène est présent et l\'adaptation limitée de k est validée hors échantillon selon le protocole',
    B: 'le phénomène existe, mais la calibration de k ne suffit pas pour obtenir une stratégie robuste',
    C: 'le phénomène n\'est pas suffisamment démontré sur ce marché',
    D: 'les données disponibles ne permettent pas de conclure',
  }
  L.push(`# Shock Engine V1 sur ${D.futures} — dossier (étude sur substitut)`, '')
  L.push(`**Substitut, pas des futures** : ${D.label}. Protocole \`research/preregistration/futures-k-transfer.md\`, additif \`futures-k-transfer-proxy.md\`. Étape de développement : [\`dev.md\`](dev.md) ; données : \`research/futures-transfer/DATA.md\` ; audit de la méthode : \`research/futures-transfer/AUDIT.md\`. Aucune valeur absolue de seuil (dépôt public).`, '')
  L.push(`## Conclusion sur le substitut : **${V} — ${words[V]}**`, '')
  if (R.secondary) {
    L.push(`Contrôle(s) de données en échec : ${R.secondary.failed.join(' ; ')}. Conclusion principale D selon l'additif. **Analyse secondaire** (additif n° 2, contrôles de couverture ignorés, mêmes calculs et mêmes critères, non confirmatoire) : **${R.secondary.verdict} — ${words[R.secondary.verdict]}** (méthode A : ${R.secondary.criteria.A.all ? 'tous les critères' : 'critères non tous remplis'} ; méthode B : ${R.secondary.criteria.B.all ? 'tous les critères' : 'critères non tous remplis'}).`, '')
  }
  L.push(`Conclusion sur les futures ${D.futures} : **D** (aucune donnée de futures ; un résultat sur substitut ne vaut ni validation sur futures ni recommandation d'usage réel). Les règles de V1 BTC/ETH, le bot et le site ne sont pas modifiés.`, '')
  L.push('## Critères (fixés avant calcul)', '')
  const CR = R.secondary ? R.secondary.criteria : R.criteria
  if (R.secondary) L.push('Tableau de l\'analyse secondaire (C1 sans les contrôles de couverture) ; en analyse principale, C1 est **non** pour les deux méthodes.', '')
  const row = (name: string, k: keyof typeof R.criteria.A) => [name, yes(CR.A[k]), yes(CR.B[k])]
  table(L, ['critère', 'méthode A (seuil fixe)', 'méthode B (Q99 %)'], [
    row('C1 — phénomène présent (porte de l\'étude d\'événement) et données conformes', 'C1'),
    row('C2 — validation : Sharpe > 0,3, PF > 1,1, ≥ ½ des années positives', 'C2'),
    row('C3 — test final : Sharpe > 0, PF > 1 ; PF > 1 au scénario haut (hors échantillon complet)', 'C3'),
    row('C4 — Sharpe significatif hors échantillon complet (Newey–West, Holm sur 4)', 'C4'),
    row('C5 — bat ≥ 90 % des entrées au hasard ; retard d\'une bougie ≥ 50 % du gain moyen', 'C5'),
    row('C6 — plateau ± 2 crans et PBO < 0,5 (méthode A)', 'C6'),
    row('C7 — Sharpe dégonflé ≥ 0,95 (N = configurations effectives + 1)', 'C7'),
    ['**toutes**', CR.A.all ? '**oui**' : '**non**', CR.B.all ? '**oui**' : '**non**'],
  ])
  const es = devPub.eventStudy
  L.push('## Étude d\'événement au seuil figé (avant calibration)', '')
  table(L, ['famille', 'n', ...HORIZONS.map(h => `excès ${h} b. (IC 90 %)`)], es.families.map((f: Family) => [`${f.key} · ${f.label}`, int(f.n), ...f.byH.map(b => `${sg(b.meanExcess)} (${sg(b.ci90[0])} à ${sg(b.ci90[1])})`)]))
  L.push(`Porte : G1 ${yes(es.gate.G1)} · G2 ${yes(es.gate.G2)} · G3 ${yes(es.gate.G3)}. Détails (t ajustés, hasard, décalages, sens, régimes, séances, créneaux) dans [\`dev.md\`](dev.md).`, '')
  L.push('## Calibration de k', '')
  const G = devPub.grid
  L.push(`${G.effective} configurations effectives sur ${G.size} ; ${G.admissibleFinal} valeurs de k admissibles (S ≥ 1) à la calibration finale ; plateau ± 2 crans : ${yes(G.plateauFinal.ok)} ; PBO ${G.pbo ? pc(G.pbo.pbo, 1) : '—'} ; méthode A ${G.finalTrades ? 'tradée' : '**non tradée** (meilleur plateau sous 1)'} au test final.`, '')
  L.push('## Résultats hors échantillon (coûts de référence : 3,50 $ par côté et 1 pas)', '')
  const e = (x: any) => [pc(x.cagr), num(x.sharpe), num(x.loSharpe), num(x.sortino), num(x.calmar), pc(x.maxDD), num(x.pf), int(x.trades)]
  const rows: (string | number)[][] = []
  for (const m of ['A', 'B'] as const) {
    rows.push([`${m} · validation ${devPub.validation.from.slice(0, 4)} – 2022`, ...e(devPub.validation[m].econ)])
    rows.push([`${m} · test final 2023-01 → 2026-09`, ...e(R.out[m].holdout)])
    const c = R.out[m].combined
    rows.push([`${m} · hors échantillon complet`, pc(c.cagr), num(c.sharpe), num(c.loSharpe), num(c.sortino), num(c.calmar), pc(c.maxDD), num(c.pf), int(c.trades)])
  }
  table(L, ['segment', 'CAGR', 'Sharpe', 'Sharpe Lo', 'Sortino', 'Calmar', 'DD max', 'PF', 'trades'], rows)
  table(L, ['méthode', 't NW', 'p', 'p Holm (4)', 'PF scénario haut', 'hasard battu', 'gain moyen', 'retardé d\'1 bougie', 'DSR (N)', 'DSR N = 222 · 6 266'], (['A', 'B'] as const).map(m => { const c = R.out[m].combined; return [m, num(c.tNW), num(c.p, 4), num(c.pHolm, 4), num(c.pfHigh), pc(c.random.beaten, 0), pc(c.meanTrade, 3), pc(c.meanDelayed, 3), `${num(c.dsr.p, 3)} (${c.dsr.N})`, c.lineage.map((x: any) => num(x.p, 3)).join(' · ')] }))
  for (const m of ['A', 'B'] as const) {
    const h = R.out[m].holdout
    L.push(`### Méthode ${m} · test final : années et coûts`, '')
    table(L, ['année', 'rendement', 'trades'], h.years.map((y: any) => [y.y, pc(y.ret), y.trades]))
    table(L, ['scénario', 'CAGR', 'Sharpe', 'PF', 'DD max'], h.scenarios.map((s: any) => [s.label, pc(s.cagr), num(s.sharpe), num(s.pf), pc(s.maxDD)]))
    L.push(`Sharpe par moitié du test final : ${num(h.halves[0])} puis ${num(h.halves[1])}. Exposition ${pc(h.exposure, 1)} · gagnants ${pc(h.winRate, 0)} · gain moyen ${pc(h.avgWin, 2)} · perte moyenne ${pc(h.avgLoss, 2)} · payoff ${num(h.payoff)} · asymétrie ${num(h.skew)} · part des 5 % meilleurs trades ${pc(h.top5Share, 0)}.`, '')
  }
  L.push('## Tests multiples', '')
  table(L, ['hypothèse', 'p', 'p Holm'], hyps.map(h => [`${h.market} · ${h.method}`, num(h.p, 4), num(h.pHolm, 4)]))
  L.push(`## Configuration retenue`, '')
  L.push(V === 'A' ? 'Conclusion A sur le substitut : la configuration est consignée dans le fichier privé (non publié) ; elle n\'est pas validée sur futures.' : 'Aucune (seule une conclusion A en donne une).', '')
  return L.join('\n')
}

// ---------------------------------------------------------------- programme principal
function main() {
  if (MARKETS.includes('test') && !SCRATCH) throw new Error('le marché « test » exige --scratch (ce n\'est jamais un résultat de l\'étude)')
  mkdirSync(PRIV, { recursive: true })
  if (STAGE === 'dev') {
    const fz = frozenChecks()
    if (!fz.every(c => c.ok)) throw new Error('empreintes des fichiers figés modifiées')
    const par = btcParity()
    if (!par.checks.every(c => c.ok)) throw new Error(`parité BTC en échec : ${JSON.stringify(par.checks.filter(c => !c.ok))}`)
    writeFileSync(join(PRIV, 'btc-quantile.json'), json(par.private))
    for (const key of MARKETS) {
      const M = loadMarket(DEFS[key])
      const out = dev(M)
      out.publicOut.checks.push(...par.checks)
      const privText = json(out.privateOut)
      writeFileSync(join(PRIV, `${key}-dev.json`), privText)
      writeFileSync(join(PRIV, `${key}-dev.md`), privateDevReport(M, out.privateOut) + '\n')
      const sha = sha256(privText)
      mkdirSync(join(PUB, key), { recursive: true })
      writeFileSync(join(PUB, key, 'dev.json'), json({ ...out.publicOut, privateSha256: sha }))
      writeFileSync(join(PUB, key, 'dev.md'), devReport(M, out, sha) + '\n')
      process.stderr.write(`écrit ${join(PUB, key)}/dev.{md,json}\n`)
    }
  } else if (STAGE === 'holdout') {
    if (!frozenChecks().every(c => c.ok)) throw new Error('empreintes des fichiers figés modifiées')
    const { res, ctxs, hyps } = holdout()
    for (const key of MARKETS) {
      const R = res[key] as any
      writeFileSync(join(PUB, key, 'final.json'), json({ schema: 'futures-k-transfer-final/1', market: key, verdict: R.verdict, criteria: R.criteria, secondary: R.secondary, out: R.out, hyps, devCommit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim() }))
      writeFileSync(join(PUB, key, 'README.md'), finalReport(key, R, ctxs[key].devPub, hyps) + '\n')
      writeFileSync(join(PRIV, `${key}-final.json`), json(R.privateFinal))
      process.stderr.write(`écrit ${join(PUB, key)}/README.md · conclusion ${R.verdict} (substitut)\n`)
    }
  } else throw new Error(`étape inconnue : ${STAGE}`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
