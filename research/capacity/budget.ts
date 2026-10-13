// P0 de l'étude de capacité : budget de coûts du Shock Engine (research/preregistration/capacity-p0p1.md, § 5).
//
// Coût ajouté par exécution, hors commission (déjà payée par le backtest : 0,045 % par exécution) :
// Sharpe, CAGR, Sortino et drawdown du portefeuille E2 pour chaque coût, appliqué à toutes les
// exécutions, à une seule famille (entrées, stops, TP1, sorties à la clôture), ou aux seuls 5 %
// meilleurs trades. Seuils de Sharpe 1,5 et 1,0 ; intervalles par bootstrap mensuel.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/budget.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { costsFor } from '../lib/frozen-shock.ts'
import * as P from '../lib/portfolio.ts'
import { BINANCE_START, KEYS, NAMES, OFFICIAL_SHARPE, OUT, SPEC, bootSharpe, crossing, familyOf, fillDay, loadPublished, monthDraws, netDaily, portfolio, q, runFills, sleeveDaily, statsOf, windowOf } from './lib.ts'
import type { Fill, Run, SleeveKey, Stats, Window } from './lib.ts'

const NREP = 2000
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }

// ---------------------------------------------------------------- 1. reproduction
const S = loadPublished()
const R = {} as Record<SleeveKey, Run>
for (const k of KEYS) {
  R[k] = runFills(S[k])
  const ref = S[k].run(1)
  let d = 0
  for (let i = 0; i < ref.equity.length; i++) d = Math.max(d, Math.abs(ref.equity[i] - R[k].equity[i]))
  check(`${NAMES[k]}: equity with fill capture = simulate()`, d === 0 && ref.positions.length === R[k].positions.length, `max |Δ| ${d}, positions ${R[k].positions.length}`)
  const entries = R[k].fills.filter(f => f.kind === 'entry').length
  check(`${NAMES[k]}: one entry fill per position`, entries === R[k].positions.length || entries === R[k].positions.length + 1, `${entries} entries, ${R[k].positions.length} closed positions`)
  const fees = R[k].positions.reduce((a, p) => a + p.rec.fees, 0)
  const notional = R[k].fills.filter(f => f.pos < R[k].positions.length).reduce((a, f) => a + f.notional, 0)
  check(`${NAMES[k]}: captured fills = commissions charged (0.045 % × Σ notional)`, Math.abs(fees - 0.00045 * notional) / fees < 1e-9, `relative gap ${(Math.abs(fees - 0.00045 * notional) / fees).toExponential(1)}`)
}
log('sleeves reproduites, exécutions relevées')

const W: Window[] = [windowOf(S, 'official'), windowOf(S, 'binance', BINANCE_START)]
const base = W.map(w => ({ rb: sleeveDaily(R.btc, w), re: sleeveDaily(R.ethusdt, w) }))
const s0 = statsOf(portfolio(base[0].rb, base[0].re), W[0].days)
check(`Official portfolio Sharpe reproduced (${SPEC})`, Math.abs(s0.sharpe - OFFICIAL_SHARPE) < 1e-8, `${s0.sharpe.toFixed(10)} vs ${OFFICIAL_SHARPE}`)

// ---------------------------------------------------------------- 2. validation de la correction après coup
// Relance du moteur avec glissement uniforme (ordres au marché et stops ; pas le TP1, ordre limite),
// comparée à la correction appliquée aux mêmes exécutions ; référence publiée : e2-diagnostics.
const PUBLISHED: Record<number, number> = { 0.01: 1.819588965, 0.02: 1.761575202, 0.05: 1.581793727 }
const validation = Object.entries(PUBLISHED).map(([slip, pub]) => {
  const s = +slip
  const rr = KEYS.map(k => {
    const sim = simulate(S[k].m, S[k].preset.sets, { ...costsFor(k, 1), slippagePct: s }, S[k].lo, S[k].end, S[k].select, S[k].signals)
    return sleeveDaily({ ...R[k], equity: sim.equity }, W[0])
  })
  const engine = statsOf(portfolio(rr[0], rr[1]), W[0].days).sharpe
  const post = statsOf(portfolio(...(KEYS.map((k, j) => netDaily(R[k], W[0], base[0][j === 0 ? 'rb' : 're'], f => (f.kind === 'TP1' ? 0 : s / 100))) as [number[], number[]])), W[0].days).sharpe
  // Une relance avec glissement n'est pas un pur surcoût : certains niveaux de sortie partent du prix
  // moyen d'entrée, qui inclut le glissement, et quelques trades changent. Ils sont comptés.
  let changed = 0
  for (const k of KEYS) {
    const a = S[k].run(1).positions, b = simulate(S[k].m, S[k].preset.sets, { ...costsFor(k, 1), slippagePct: s }, S[k].lo, S[k].end, S[k].select, S[k].signals).positions
    for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i].exitIdx !== b[i].exitIdx || a[i].exits.join() !== b[i].exits.join()) changed++
    changed += Math.abs(a.length - b.length)
  }
  check(`Post-hoc cost = engine rerun at ${s} % slippage`, Math.abs(post - engine) < 0.002 && Math.abs(engine - pub) < 1e-6, `engine ${engine.toFixed(6)}, post-hoc ${post.toFixed(6)}, published ${pub}; trades whose exit changes in the rerun: ${changed}`)
  return { slipPct: s, engine, postHoc: post, published: pub, tradesChangedByRerun: changed, withinTolerance: Math.abs(post - engine) < 0.002 }
})
log('correction validée')

// ---------------------------------------------------------------- 3. familles et 5 % meilleurs
const inWin = (k: SleeveKey, w: Window) => (f: Fill) => fillDay(R[k], f, w) >= 0
const top5 = W.map(w => {
  const ps = KEYS.flatMap(k => R[k].positions.filter(p => { const d = Math.floor(S[k].bars.t[p.entryIdx] / P.DAY); return d >= w.days[0] && d <= w.days[w.days.length - 1] }))
  const sorted = [...ps].sort((a, b) => b.pnlPct - a.pnlPct)
  const n = Math.ceil(sorted.length * 0.05)
  const set = new Set(sorted.slice(0, n).map(p => `${p.key}:${p.pos}`))
  // Coût par exécution qui ramènerait chacun des 5 % meilleurs à zéro : rendement net / Σ (nominal des exécutions / nominal d'entrée).
  const breakEven = sorted.slice(0, n).map(p => {
    const fs = R[p.key].fills.filter(f => f.pos === p.pos)
    const entry = fs.find(f => f.kind === 'entry')!.notional
    return p.pnlPct / fs.reduce((a, f) => a + f.notional / entry, 0)
  })
  const logAll = ps.reduce((a, p) => a + Math.log1p(p.pnlPct), 0), logTop = sorted.slice(0, n).reduce((a, p) => a + Math.log1p(p.pnlPct), 0)
  return { set, n, total: ps.length, pnl: sorted.slice(0, n).map(p => p.pnlPct), breakEven, shareOfLogGrowth: logTop / logAll }
})

type Cat = 'all' | 'market' | 'entry' | 'stop' | 'tp1' | 'close' | 'top5' | 'rest95'
const CATS: Cat[] = ['all', 'market', 'entry', 'stop', 'tp1', 'close', 'top5', 'rest95']
const applies = (cat: Cat, wi: number) => (f: Fill): boolean => {
  if (cat === 'all') return true
  if (cat === 'market') return f.kind !== 'TP1'
  if (cat === 'top5') return top5[wi].set.has(`${f.key}:${f.pos}`)
  if (cat === 'rest95') return !top5[wi].set.has(`${f.key}:${f.pos}`)
  return familyOf(f.kind) === cat
}

// ---------------------------------------------------------------- 4. grille de coûts
const GRID = [0, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 26, 28, 30, 35, 40, 50, 60]
const COARSE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 25, 30, 40, 50, 60]
const netPortfolio = (wi: number, cat: Cat, bps: number) => {
  const w = W[wi], ok = applies(cat, wi), c = bps / 1e4
  const rb = netDaily(R.btc, w, base[wi].rb, f => (ok(f) ? c : 0))
  const re = netDaily(R.ethusdt, w, base[wi].re, f => (ok(f) ? c : 0))
  return { rb, re, r: portfolio(rb, re) }
}
const results = W.map((w, wi) => {
  const md = monthDraws(w.days, NREP)
  const byCat = Object.fromEntries(CATS.map(cat => {
    const curve: (Stats & { bps: number })[] = GRID.map(bps => ({ bps, ...statsOf(netPortfolio(wi, cat, bps).r, w.days) }))
    const sh = curve.map(x => x.sharpe)
    const boot = COARSE.map(bps => { const n = netPortfolio(wi, cat, bps); return bootSharpe(n.rb, n.re, md) })
    const band = COARSE.map((bps, j) => ({ bps, p5: q(boot[j], 0.05), p50: q(boot[j], 0.5), p95: q(boot[j], 0.95) }))
    const cStar = (level: number) => {
      const reps = Array.from({ length: NREP }, (_, rep) => crossing(COARSE, COARSE.map((_, j) => boot[j][rep]), level))
      const fin = reps.map(x => (Number.isFinite(x) ? x : Infinity))
      return { point: crossing(GRID, sh, level), p5: q(fin, 0.05), p50: q(fin, 0.5), p95: q(fin, 0.95), beyondGrid: fin.filter(x => !Number.isFinite(x)).length / NREP }
    }
    // Perte de Sharpe par point de base : pente des moindres carrés sur 0 à 10 pb, point et bootstrap.
    const slopeOf = (xs: number[], ys: number[]) => { const mx = P.mean(xs), my = P.mean(ys); let a = 0, b = 0; for (let j = 0; j < xs.length; j++) { a += (xs[j] - mx) * (ys[j] - my); b += (xs[j] - mx) ** 2 } return a / b }
    const lowG = GRID.filter(x => x <= 10), lowC = COARSE.filter(x => x <= 10)
    const slopes = Array.from({ length: NREP }, (_, rep) => slopeOf(lowC, lowC.map(x => boot[COARSE.indexOf(x)][rep])))
    const slope = { point: slopeOf(lowG, lowG.map(x => sh[GRID.indexOf(x)])), p5: q(slopes, 0.05), p95: q(slopes, 0.95) }
    const below = (level: number) => boot[0].filter(x => x < level).length / NREP
    return [cat, { curve, band, slopePerBp: slope, threshold: { sharpe15: cStar(1.5), sharpe10: cStar(1.0), sharpe0: cStar(0) }, zeroCostShareBelow: { sharpe15: below(1.5), sharpe10: below(1.0) } }]
  }))
  const fills = Object.fromEntries((['entry', 'stop', 'tp1', 'close'] as const).map(fam => {
    const fs = KEYS.flatMap(k => R[k].fills.filter(inWin(k, w)).filter(f => familyOf(f.kind) === fam))
    return [fam, { n: fs.length, perYear: fs.length / (w.days.length / P.ANN), meanWeight: P.mean(fs.map(f => f.notional / f.eqBefore)), meanFrac: P.mean(fs.map(f => f.frac)), byKind: Object.fromEntries([...new Set(fs.map(f => f.kind))].map(k => [k, fs.filter(f => f.kind === k).length])) }]
  }))
  const t5 = top5[wi]
  log(`fenêtre ${w.name} : ${w.days.length} jours`)
  return {
    window: { name: w.name, from: P.isoDay(w.days[0]), to: P.isoDay(w.days[w.days.length - 1]), days: w.days.length, months: md.blocks.length },
    baseline: statsOf(portfolio(base[wi].rb, base[wi].re), w.days),
    fills, byCat,
    top5: {
      n: t5.n, of: t5.total, shareOfLogGrowth: t5.shareOfLogGrowth,
      pnl: { min: Math.min(...t5.pnl), p25: q(t5.pnl, 0.25), median: q(t5.pnl, 0.5), mean: P.mean(t5.pnl), max: Math.max(...t5.pnl) },
      breakEvenPerFill: { min: Math.min(...t5.breakEven), p10: q(t5.breakEven, 0.1), median: q(t5.breakEven, 0.5) },
    },
  }
})

mkdirSync(OUT, { recursive: true })
const deviations = validation.filter(v => !v.withinTolerance).map(v => `Validation at ${v.slipPct} % slippage outside the pre-registered tolerance (0.002): post-hoc ${v.postHoc.toFixed(4)} vs engine rerun ${v.engine.toFixed(4)}. In the rerun, ${v.tradesChangedByRerun} trade(s) change exit because some exit levels reference the slipped entry price; the post-hoc correction keeps trades fixed (pure cost), which is the quantity this study measures.`)
writeFileSync(join(OUT, 'p0-budget.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/capacity-p0p1.md', nRep: NREP, grid: GRID, coarse: COARSE, validation, deviations, checks, results }, null, 1))

// ---------------------------------------------------------------- résumé
const bp = (x: number) => (Number.isFinite(x) ? `${x.toFixed(1)} pb` : '> grille')
for (const r of results) {
  process.stderr.write(`\n== ${r.window.name} ${r.window.from} → ${r.window.to} · Sharpe ${r.baseline.sharpe.toFixed(3)}, CAGR ${(r.baseline.cagr * 100).toFixed(1)} %\n`)
  for (const cat of CATS) {
    const t = r.byCat[cat].threshold
    const sl = r.byCat[cat].slopePerBp
    process.stderr.write(`${cat.padEnd(7)} pente ${sl.point.toFixed(4)}/pb [${sl.p5.toFixed(4)} ; ${sl.p95.toFixed(4)}] · Sharpe 1,5 : ${bp(t.sharpe15.point)} [${bp(t.sharpe15.p5)} ; ${bp(t.sharpe15.p95)}] · Sharpe 1,0 : ${bp(t.sharpe10.point)} [${bp(t.sharpe10.p5)} ; ${bp(t.sharpe10.p95)}] · Sharpe 0 : ${bp(t.sharpe0.point)}\n`)
  }
  process.stderr.write(`sans coût, part des tirages sous 1,5 : ${(r.byCat.all.zeroCostShareBelow.sharpe15 * 100).toFixed(1)} %, sous 1,0 : ${(r.byCat.all.zeroCostShareBelow.sharpe10 * 100).toFixed(1)} %\n`)
  process.stderr.write(`exécutions : ${Object.entries(r.fills).map(([k, v]) => `${k} ${v.n} (${v.perYear.toFixed(0)}/an)`).join(', ')}\n`)
  process.stderr.write(`top 5 % : ${r.top5.n}/${r.top5.of} trades, ${(r.top5.shareOfLogGrowth * 100).toFixed(0)} % de la croissance log ; rendement médian ${(r.top5.pnl.median * 100).toFixed(1)} % ; seuil de rentabilité par exécution, minimum ${(r.top5.breakEvenPerFill.min * 1e4).toFixed(0)} pb, médiane ${(r.top5.breakEvenPerFill.median * 1e4).toFixed(0)} pb\n`)
}
process.stderr.write(`\ncontrôles : ${checks.filter(c => c.ok).length}/${checks.length}\n`)
for (const d of deviations) process.stderr.write(`ÉCART AU PROTOCOLE : ${d}\n`)
// Seul l'écart de validation documenté est toléré ; tout autre contrôle en échec arrête l'étude.
if (checks.some(c => !c.ok && !c.name.startsWith('Post-hoc cost = engine rerun'))) process.exit(1)
