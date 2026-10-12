// Étude d'exécution : exécutabilité des ordres du Shock Engine à 500 k$ et 1 M$
// (research/preregistration/execution-fills-500k-1m.md), étape 2 : coûts, remplissages, portefeuille.
//
// Entrées : mesures exécution par exécution (fills-measure.ts, hors dépôt). Sorties (agrégats
// seulement) : research/reports/execution/fills-500k-1m.json.
//
//   node --max-old-space-size=12288 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/fills-report.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { BINANCE_START, KEYS, NAMES, ROOT, SEED, loadE2, monthDraws, netDaily, portfolio, q, sleeveDaily, statsOf, windowOf } from '../capacity/lib.ts'
import type { Fill, Run, Sleeve, SleeveKey } from '../capacity/lib.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import { SimBroker } from '../../lib/strategies/shock/broker.ts'
import type { ExitTag } from '../../lib/strategies/shock/broker.ts'
import { costsFor } from '../lib/frozen-shock.ts'
import { DATA, MIN, SYM, T0, loadMinutes } from '../capacity/binance.ts'
import { KLINES_TO } from '../capacity/data.ts'
import { LIMIT_BPS, SIZES } from './fills-measure.ts'
import type { FillRow, SizeStat } from './fills-measure.ts'

const CAPITALS = [500e3, 1e6]
const NREP = 2000
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ---------------------------------------------------------------- mesures
const rows = new Map<string, FillRow>()
for (const k of KEYS) for (const l of readFileSync(join(DATA, 'derived', `fills-${SYM[k]}.jsonl`), 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l) as FillRow
  rows.set(`${k}:${r.fi}`, r)
}
log(`${rows.size} exécutions mesurées`)

// ---------------------------------------------------------------- rejeu du moteur (règle TP1)
/** Simulation de la sleeve ; les TP1 de `skip` (rang de position) ne sont pas exécutés : la quantité reste dans la position. */
function replay(s: Sleeve, skip: Set<number>): Run {
  const costs = costsFor(s.key, 1)
  const { m, end, lo } = s
  const n = m.bars.n
  const strategy = new ShockStrategy(m, s.preset.sets, costs.mintick, s.select, s.signals)
  const broker = new SimBroker(m, s.preset.sets, costs, (set, i) => strategy.prs[set].atr[i])
  const fills: Fill[] = []
  let posId = -1
  type Fn = (...a: never[]) => void
  const b = broker as unknown as { open: Fn; fill: Fn }
  const open = (broker as unknown as { open: (i: number, dir: 1 | -1, tag: string, set: number) => void }).open.bind(broker)
  const fill = (broker as unknown as { fill: (i: number, qty: number, px: number, tag: ExitTag) => void }).fill.bind(broker)
  b.open = ((i: number, dir: 1 | -1, tag: string, set: number) => {
    const before = broker.pos
    open(i, dir, tag, set)
    const p = broker.pos
    if (p && p !== before) { posId++; fills.push({ key: s.key, pos: posId, i, kind: 'entry', side: dir, qty: p.qty, px: p.avg, notional: p.notional, eqBefore: p.equityAtEntry, frac: 1 }) }
  }) as Fn
  b.fill = ((i: number, qty: number, px: number, tag: ExitTag) => {
    // TP1 non exécuté (aucune transaction au-delà du niveau) : le broker l'a déjà marqué comme fait,
    // la quantité reste dans la position et sortira avec elle.
    if (tag === 'TP1' && skip.has(posId)) return
    const p = broker.pos!
    const eqBefore = costs.capital + broker.realized + p.dir * (px - p.avg) * p.qty
    fills.push({ key: s.key, pos: posId, i, kind: tag, side: (-p.dir) as 1 | -1, qty, px, notional: px * qty, eqBefore, frac: qty / (p.qty + p.exitQty) })
    fill(i, qty, px, tag)
  }) as Fn
  const equity = new Float64Array(n)
  for (let i = 0; i < lo; i++) equity[i] = costs.capital
  for (let i = lo; i <= end; i++) {
    broker.beforeClose(i)
    const d = strategy.onClose(i, broker.view(), i === end)
    broker.afterClose(i, d, i === end)
    equity[i] = broker.capitalNow(i)
  }
  for (let i = end + 1; i < n; i++) equity[i] = equity[end]
  return { key: s.key, sleeve: s, equity, fills, positions: [] }
}

const S = loadE2()
const W = windowOf(S, 'binance', BINANCE_START)
const base: Record<SleeveKey, Run> = { btc: replay(S.btc, new Set()), ethusdt: replay(S.ethusdt, new Set()) }
// Rangs des fills du rejeu de base = indices `fi` des mesures (mêmes fills que l'étude de capacité).
const keyOf = (f: Fill) => `${f.pos}|${f.kind}|${f.i}`
const rowOf: Record<SleeveKey, Map<string, FillRow>> = { btc: new Map(), ethusdt: new Map() }
for (const k of KEYS) base[k].fills.forEach((f, fi) => { const r = rows.get(`${k}:${fi}`); if (r) rowOf[k].set(keyOf(f), r) })
// Contrôle : chaque mesure correspond bien au fill de même rang (famille et sens).
let mismatch = 0
for (const k of KEYS) base[k].fills.forEach((f, fi) => { const r = rows.get(`${k}:${fi}`); if (r && (r.side !== f.side || (r.kind !== f.kind))) mismatch++ })
if (mismatch) throw new Error(`${mismatch} mesures ne correspondent pas aux fills du rejeu`)
const skipTp1: Record<SleeveKey, Set<number>> = { btc: new Set(), ethusdt: new Set() }
for (const k of KEYS) for (const r of rowOf[k].values()) if (r.family === 'tp1' && r.tp1Through === false) skipTp1[k].add(r.pos)
const tp1Run: Record<SleeveKey, Run> = { btc: replay(S.btc, skipTp1.btc), ethusdt: replay(S.ethusdt, skipTp1.ethusdt) }
log(`TP1 sans transaction au-delà du niveau : BTC ${skipTp1.btc.size}, ETH ${skipTp1.ethusdt.size}`)
// Sensibilité (ajoutée après lecture des mesures, non pré-enregistrée) : le niveau converti sur Binance
// dépend de l'écart de prix à l'entrée ; un TP1 dépassé de moins de 5 pb (bougies 1 min Binance) est
// compté non rempli.
const marginTp1: Record<SleeveKey, number[]> = { btc: [], ethusdt: [] }
const skipTp1Margin: Record<SleeveKey, Set<number>> = { btc: new Set(skipTp1.btc), ethusdt: new Set(skipTp1.ethusdt) }
for (const k of KEYS) {
  const { m } = await loadMinutes(SYM[k], KLINES_TO)
  for (const r of rowOf[k].values()) {
    if (r.family !== 'tp1') continue
    const j0 = Math.round((Math.floor(r.tRef / 900000) * 900000 - T0) / MIN)
    let best = r.side === -1 ? -Infinity : Infinity
    for (let j = j0; j < j0 + 15; j++) best = r.side === -1 ? Math.max(best, m.h[j]) : Math.min(best, m.l[j])
    const ex = (r.side === -1 ? best / r.P0! - 1 : 1 - best / r.P0!) * 1e4
    marginTp1[k].push(ex)
    if (ex < 5) skipTp1Margin[k].add(r.pos)
  }
}
const tp1RunMargin: Record<SleeveKey, Run> = { btc: replay(S.btc, skipTp1Margin.btc), ethusdt: replay(S.ethusdt, skipTp1Margin.ethusdt) }

// ---------------------------------------------------------------- modèle calibré du coût immédiat
/** Paires (exécution, taille) observées : log coût = a + b log Q + c log σ₆₀ + d log V₂₄, par actif. */
const FLOOR_BPS = 0.01
function fitModel(k: SleeveKey, L: string) {
  const X: number[][] = [], y: number[] = []
  for (const r of rowOf[k].values()) {
    if (!(r.sigma60 > 0) || !(r.v24 > 0)) continue
    r.sweeps[L]?.forEach((st, j) => { if (st.n > 0 && st.med != null) { X.push([1, Math.log(SIZES[j]), Math.log(r.sigma60), Math.log(r.v24)]); y.push(Math.log(Math.max(st.med, FLOOR_BPS))) } })
  }
  const b = ols(X, y)
  const res = y.map((v, i) => v - X[i].reduce((a, x, j) => a + x * b[j], 0))
  const smear = P.mean(res.map(Math.exp))
  const r2 = 1 - P.mean(res.map(x => x * x)) / P.mean(y.map(v => (v - P.mean(y)) ** 2))
  return { coef: b, smear, n: y.length, r2, predict: (Q: number, s60: number, v24: number) => Math.exp(b[0] + b[1] * Math.log(Q) + b[2] * Math.log(s60) + b[3] * Math.log(v24)) * smear }
}
function ols(X: number[][], y: number[]): number[] {
  const p = X[0].length
  const A = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)))
  const c = Array.from({ length: p }, (_, i) => X.reduce((s, r, k) => s + r[i] * y[k], 0))
  for (let i = 0; i < p; i++) {
    let m = i
    for (let r = i + 1; r < p; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r
    ;[A[i], A[m]] = [A[m], A[i]]; [c[i], c[m]] = [c[m], c[i]]
    for (let r = 0; r < p; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let j = i; j < p; j++) A[r][j] -= f * A[i][j]; c[r] -= f * c[i] }
  }
  return c.map((v, i) => v / A[i][i])
}
const models: Record<string, ReturnType<typeof fitModel>> = {}
for (const k of KEYS) for (const L of ['0.5s', '1s', '3s', '5s']) models[`${k}|${L}`] = fitModel(k, L)

/** Coût immédiat (pb au-delà du meilleur prix) d'un ordre de Q $ : observé (interpolé) ou estimé. */
function impact(r: FillRow, L: string, Q: number): { bps: number; observed: boolean } {
  const st: SizeStat[] = r.sweeps[L] ?? []
  const j = SIZES.findIndex(s => s >= Q)
  const at = (k: number) => (k >= 0 && k < st.length && st[k].n > 0 && st[k].med != null ? st[k].med! : null)
  if (j === 0 && at(0) != null) return { bps: at(0)!, observed: true }
  if (j > 0 && at(j) != null && at(j - 1) != null) {
    const w = (Math.log(Q) - Math.log(SIZES[j - 1])) / (Math.log(SIZES[j]) - Math.log(SIZES[j - 1]))
    return { bps: at(j - 1)! * (1 - w) + at(j)! * w, observed: true }
  }
  if (j > 0 && at(j) != null) return { bps: at(j)!, observed: true } // borne haute : coût observé d'une taille supérieure
  const m = models[`${r.key}|${L}`]
  return { bps: r.sigma60 > 0 && r.v24 > 0 ? m.predict(Q, r.sigma60, r.v24) : NaN, observed: false }
}

/** Exécutable intégralement : preuve par un ordre réel ≥ Q resté à moins de 50 pb, ou profondeur ±1 % ≥ Q. */
function provenWithin(r: FillRow, L: string, Q: number): 'within50bps' | 'within1pct' | 'unproven' {
  const st = r.sweeps[L] ?? []
  if (SIZES.some((s, k) => s >= Q && st[k]?.n > 0 && (st[k].within ?? 0) > 0)) return 'within50bps'
  if (Number.isFinite(r.depth1) && r.depth1 >= Q) return 'within1pct'
  return 'unproven'
}

// ---------------------------------------------------------------- versions
interface Version { name: string; entryL: string; stopL: string; rho: number }
const VERSIONS: Version[] = [
  { name: 'current', entryL: '5s', stopL: '3s', rho: 1 },
  { name: 'optimized', entryL: '0.5s', stopL: '0.5s', rho: 1 },
  { name: 'optimized_entries_only', entryL: '0.5s', stopL: '3s', rho: 1 },
  { name: 'optimized_1s', entryL: '1s', stopL: '0.5s', rho: 1 },
  { name: 'hl_current_rho0.5', entryL: '5s', stopL: '3s', rho: 0.5 },
  { name: 'hl_optimized_rho0.5', entryL: '0.5s', stopL: '0.5s', rho: 0.5 },
  { name: 'hl_current_rho0.25', entryL: '5s', stopL: '3s', rho: 0.25 },
  { name: 'hl_optimized_rho0.25', entryL: '0.5s', stopL: '0.5s', rho: 0.25 },
]

interface Exec { family: string; key: SleeveKey; costBps: number; observed: boolean; proof: string; delayS: number; drift: number; hs: number; imp: number; imputed: boolean }
/** Coût de chaque fill du rejeu TP1 pour un capital et une version ; NaN imputés par la médiane (actif, famille). */
function costsOf(A: number, v: Version): { perFill: Record<SleeveKey, Map<Fill, number>>; execs: Exec[] } {
  const perFill: Record<SleeveKey, Map<Fill, number>> = { btc: new Map(), ethusdt: new Map() }
  const execs: Exec[] = []
  for (const k of KEYS) {
    for (const f of tp1Run[k].fills) {
      const r = rowOf[k].get(keyOf(f))
      if (!r) continue
      const Q = f.frac * A / 2
      if (r.family === 'tp1') { perFill[k].set(f, 0); execs.push({ family: 'tp1', key: k, costBps: 0, observed: true, proof: 'resting', delayS: 0, drift: 0, hs: 0, imp: 0, imputed: false }); continue }
      const L = r.family === 'stop' ? v.stopL : v.entryL
      const located = r.family !== 'stop' || r.crossFound === true
      const d = r.drift[L], hs = r.hs
      const im = impact(r, L, Q / v.rho)
      const ok = located && d != null && hs != null && Number.isFinite(im.bps)
      const c = ok ? hs! + d! + im.bps : NaN
      execs.push({ family: r.family, key: k, costBps: c, observed: im.observed, proof: provenWithin(r, L, Q / v.rho), delayS: parseFloat(L), drift: d ?? NaN, hs: hs ?? NaN, imp: im.bps, imputed: !ok })
      perFill[k].set(f, c / 1e4)
    }
  }
  // Imputation (médiane de l'actif et de la famille) des exécutions sans mesure complète.
  for (const k of KEYS) for (const fam of ['entry', 'close', 'stop']) {
    const ok = [...perFill[k].entries()].filter(([f, c]) => Number.isFinite(c) && famOf(f) === fam).map(([, c]) => c)
    const med = q(ok, 0.5)
    for (const [f, c] of perFill[k]) if (!Number.isFinite(c) && famOf(f) === fam) perFill[k].set(f, med)
  }
  return { perFill, execs }
}
const famOf = (f: Fill) => (f.kind === 'entry' ? 'entry' : f.kind === 'SL' || f.kind === 'TRAIL' || f.kind === 'LIQ' ? 'stop' : f.kind === 'TP1' ? 'tp1' : 'close')

// ---------------------------------------------------------------- portefeuille
const md = monthDraws(W.days, NREP, SEED)
function seriesOf(run: Record<SleeveKey, Run>, cost?: Record<SleeveKey, Map<Fill, number>>) {
  const one = (k: SleeveKey) => { const r = sleeveDaily(run[k], W); return cost ? netDaily(run[k], W, r, f => cost[k].get(f) ?? 0) : r }
  return { rb: one('btc'), re: one('ethusdt') }
}
function boot(rb: number[], re: number[]) {
  const sh = new Float64Array(NREP), cg = new Float64Array(NREP)
  for (let rep = 0; rep < NREP; rep++) {
    let a = 50, b = 50, prev = 100, s = 0, s2 = 0, n = 0
    for (const j of md.draws[rep]) for (const i of md.blocks[j]) { a *= 1 + rb[i]; b *= 1 + re[i]; const v = a + b, x = v / prev - 1; prev = v; s += x; s2 += x * x; n++ }
    const mu = s / n, sd = Math.sqrt(Math.max(s2 / n - mu * mu, 0))
    sh[rep] = sd > 0 ? (mu / sd) * Math.sqrt(P.ANN) : 0
    cg[rep] = Math.pow(prev / 100, P.ANN / n) - 1
  }
  return { sh, cg }
}
function summary(x: { rb: number[]; re: number[] }) {
  const st = statsOf(portfolio(x.rb, x.re), W.days)
  const b = boot(x.rb, x.re)
  return { sharpe: st.sharpe, cagr: st.cagr, sortino: st.sortino, maxDD: st.maxDD, sharpeP5: q(b.sh, 0.05), sharpeP95: q(b.sh, 0.95), cagrP5: q(b.cg, 0.05), cagrP95: q(b.cg, 0.95), _b: b }
}

const out: Record<string, unknown> = {}
const backtest = summary(seriesOf(base))
const tp1Only = summary(seriesOf(tp1Run))
const strip = ({ _b, ...rest }: ReturnType<typeof summary>) => rest
out.backtest = strip(backtest)
out.tp1RuleOnly = strip(tp1Only)
out.tp1MarginSensitivity = { skipped: { BTC: skipTp1Margin.btc.size, ETH: skipTp1Margin.ethusdt.size }, excursionBps: Object.fromEntries(KEYS.map(k => [NAMES[k], { p5: q(marginTp1[k], 0.05), p25: q(marginTp1[k], 0.25), p50: q(marginTp1[k], 0.5) }])), ...strip(summary(seriesOf(tp1RunMargin))) }
log(`backtest Sharpe ${backtest.sharpe.toFixed(3)} ; règle TP1 seule ${tp1Only.sharpe.toFixed(3)}`)

const pct = (xs: number[], p: number) => q(xs.filter(Number.isFinite), p)
const dist = (xs: number[]) => { const a = xs.filter(Number.isFinite); return { n: a.length, mean: P.mean(a), p50: pct(a, 0.5), p95: pct(a, 0.95), p99: pct(a, 0.99), max: a.length ? Math.max(...a) : NaN } }
const results: Record<string, Record<string, unknown>> = {}
for (const A of CAPITALS) {
  results[A] = {}
  const sums: Record<string, ReturnType<typeof summary>> = {}
  for (const v of VERSIONS) {
    const { perFill, execs } = costsOf(A, v)
    const s = summary(seriesOf(tp1Run, perFill))
    sums[v.name] = s
    const by = (f: (e: Exec) => boolean) => execs.filter(f)
    const groups: Record<string, Exec[]> = {}
    for (const k of KEYS) for (const fam of ['entry', 'close', 'stop', 'tp1']) groups[`${NAMES[k]} ${fam}`] = by(e => e.key === k && e.family === fam)
    groups.all = execs
    results[A][v.name] = {
      ...strip(s),
      executions: Object.fromEntries(Object.entries(groups).map(([g, es]) => [g, {
        n: es.length,
        costBps: dist(es.map(e => e.costBps)),
        components: { halfSpread: dist(es.map(e => e.hs)), drift: dist(es.map(e => e.drift)), immediate: dist(es.map(e => e.imp)) },
        immediateObservedShare: es.filter(e => e.observed).length / Math.max(1, es.length),
        proof: { within50bps: es.filter(e => e.proof === 'within50bps').length, within1pct: es.filter(e => e.proof === 'within1pct').length, unproven: es.filter(e => e.proof === 'unproven').length, resting: es.filter(e => e.proof === 'resting').length },
        imputed: es.filter(e => e.imputed).length,
        delayS: es.length ? es[0].delayS : null,
      }])),
    }
    log(`A ${A / 1e3} k$ · ${v.name} : Sharpe ${s.sharpe.toFixed(3)} [${q(s._b.sh, 0.05).toFixed(2)} ; ${q(s._b.sh, 0.95).toFixed(2)}] · CAGR ${(s.cagr * 100).toFixed(1)} % · coût médian ${pct(execs.map(e => e.costBps), 0.5).toFixed(2)} pb, P95 ${pct(execs.map(e => e.costBps), 0.95).toFixed(2)}, P99 ${pct(execs.map(e => e.costBps), 0.99).toFixed(2)}`)
  }
  // Écart apparié actuel → optimisé (mêmes tirages de mois).
  const pair = (a: string, b: string) => { const d = Array.from(sums[b]._b.sh, (x, i) => x - sums[a]._b.sh[i]); return { point: sums[b].sharpe - sums[a].sharpe, p5: q(d, 0.05), p50: q(d, 0.5), p95: q(d, 0.95), shareAbove0: d.filter(x => x > 0).length / d.length } }
  results[A].pairedSharpe = { current_to_optimized: pair('current', 'optimized'), current_to_optimized_entries_only: pair('current', 'optimized_entries_only'), hl_rho05_current_to_optimized: pair('hl_current_rho0.5', 'hl_optimized_rho0.5') }
  results[A].probabilitySharpeAbove15 = Object.fromEntries(VERSIONS.map(v => [v.name, Array.from(sums[v.name]._b.sh).filter(x => x > 1.5).length / NREP]))
}
out.results = results
out.tp1 = Object.fromEntries(KEYS.map(k => { const t = [...rowOf[k].values()].filter(r => r.family === 'tp1'); return [NAMES[k], { n: t.length, through: t.filter(r => r.tp1Through).length, touchedOnly: t.filter(r => !r.tp1Through && r.tp1Touched).length, notTouched: t.filter(r => r.tp1Touched === false).length }] }))
out.stopsLocated = Object.fromEntries(KEYS.map(k => { const t = [...rowOf[k].values()].filter(r => r.family === 'stop'); return [NAMES[k], { n: t.length, crossFound: t.filter(r => r.crossFound).length }] }))
out.models = Object.fromEntries(Object.entries(models).map(([k, m]) => [k, { n: m.n, r2: m.r2, coef: m.coef, smear: m.smear }]))
// Fréquence des ordres réels de grande taille autour des exécutions (preuves disponibles).
out.observedOrdersAround = Object.fromEntries(KEYS.map(k => [NAMES[k], Object.fromEntries(SIZES.map((s, j) => [s, { shareWithAtLeastOne: [...rowOf[k].values()].filter(r => r.family !== 'tp1' && r.sweeps['5s']).filter(r => r.sweeps['5s'][j].n > 0).length / [...rowOf[k].values()].filter(r => r.family !== 'tp1' && r.sweeps['5s']).length, medianDelayToFirstMs: pct([...rowOf[k].values()].map(r => r.sweeps['5s']?.[j]?.afterMs ?? NaN), 0.5) }]))]))
// Frais : correction séparée (maker du TP1 rempli au lieu de 0,045 % ; palier 0,040 % au-delà de 5 M$ sur 14 jours).
out.feeNote = { tp1MakerCreditBps: 3, tier1TakerCreditBps: 0.5, note: 'Non incluses dans les Sharpe ci-dessus (frais du backtest conservés partout) ; voir fees.' }
const fees: Record<string, unknown> = {}
for (const A of CAPITALS) {
  const v = VERSIONS[0]
  const { perFill } = costsOf(A, v)
  const tier = A >= 1e6 ? 0.5 / 1e4 : 0
  for (const k of KEYS) for (const [f, c] of perFill[k]) perFill[k].set(f, famOf(f) === 'tp1' ? c - 3 / 1e4 : c - tier)
  fees[A] = { current_with_fee_correction: strip(summary(seriesOf(tp1Run, perFill))) }
}
out.fees = fees
out.limitBps = LIMIT_BPS
out.sizes = SIZES
writeFileSync(join(ROOT, 'research/reports/execution/fills-500k-1m.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/execution-fills-500k-1m.md', venue: 'Binance USDⓈ-M (observable) ; Hyperliquid : bornes conditionnelles (rho)', ...out }, null, 1))
log('écrit')
