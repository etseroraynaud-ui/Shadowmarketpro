// Étude du trailing stop de Shock Engine V1 (research/preregistration/v1-trailing.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/trailing-study.ts controls   # contrôles d'identité seuls
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/trailing-study.ts            # étude complète
//
// Lecture seule du moteur figé ; variantes via la copie isolée trail-broker.ts / trail-sim.ts.
// Sortie : research/reports/shock-fade/v1-trailing/{report.md, results.json}.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15, referenceAsset } from '../../lib/regime-er.ts'
import type { Asset } from '../../lib/regime-er.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../../lib/calm-only.ts'
import { cscv, dsr, sharpe, walkForward } from '../../lib/overfit.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
// Type de la copie isolée : il couvre aussi les positions du moteur figé (étiquettes de sortie en sous-ensemble).
import type { PositionRecord } from './trail-broker.ts'
import type { EntryOverride } from '../../../lib/strategies/shock/strategy.ts'
import type { ShockParams } from '../../../lib/strategies/shock/params.ts'
import { simulateTrail } from './trail-sim.ts'
import type { TrailRun } from './trail-sim.ts'
import type { TrailSpec } from './trail-broker.ts'

const MODE = process.argv[2] ?? 'run'
const OUT = join(import.meta.dirname, '../../reports/shock-fade/v1-trailing')
const DAY = 864e5
const ANNF = Math.sqrt(P.ANN)
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const B = 2000

interface Variant { id: string; fam: 0 | 1 | 2 | 3; label: string; mult?: number; spec: TrailSpec }
const V1: Variant = { id: 'V1', fam: 0, label: 'V1 (50 ATR)', spec: { kind: 'v1' } }
const VARIANTS: Variant[] = [
  ...[8, 12, 16, 25].map(k => ({ id: `C${k}`, fam: 1 as const, label: `classique ${k} ATR`, mult: k, spec: { kind: 'classic' } as TrailSpec })),
  ...([[3, 2], [5, 3], [5, 4]] as const).map(([a, d]) => ({ id: `D${a}-${d}`, fam: 2 as const, label: `découplé +${a} R / ${d} R`, spec: { kind: 'decoupled', actR: a, distR: d } as TrailSpec })),
  ...([[2, 1.5], [2, 3], [4, 1.5], [4, 3]] as const).map(([x, d]) => ({ id: `X${x}-${d}`, fam: 3 as const, label: `agité, MFE ≥ ${x} R → ${d} R`, spec: { kind: 'regime', profitR: x, distR: d } as TrailSpec })),
]
if (VARIANTS.length > 15) throw new Error('plus de 15 variantes')

const A = [referenceAsset('btc'), referenceAsset('ethusdt')]
const v1Signals = (a: Asset) => calmOnly(a.signals, a.select)
const setsFor = (a: Asset, mult?: number): ShockParams[] => a.preset.sets.map((p, j) => (j === 0 && mult !== undefined ? { ...p, atrTrailMult: mult } : p))
const specFor = (a: Asset, v: Variant): TrailSpec => (v.spec.kind === 'regime' ? { ...v.spec, regime: a.select } : v.spec)
const runTrail = (a: Asset, v: Variant, ovr: EntryOverride, k = 1): TrailRun => simulateTrail(a.m, setsFor(a, v.mult), a.costs(k), a.lo, a.end, a.select, ovr, specFor(a, v))
const inRef = (a: Asset, ps: PositionRecord[]) => ps.filter(p => !p.exits.includes('END') && a.bars.t[p.entryIdx] >= REF[0] && a.bars.t[p.entryIdx] < REF[1])
const riskOf = (a: Asset, p: PositionRecord) => a.preset.sets[p.set].atrStopMult * Math.max(p.atrAtEntry, a.mintick)
const Rof = (a: Asset, p: PositionRecord) => p.pnl / (p.qty * riskOf(a, p))
const mfeRof = (a: Asset, p: PositionRecord) => (p.mfeAtr * p.atrAtEntry) / riskOf(a, p)

// ---------------------------------------------------------------- portefeuille (chemin de research/shock/reference.ts)
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
function portfolio(runs: { equity: Float64Array; position: Int8Array }[]) {
  const sl = A.map((a, j) => dailyOf(a.bars, runs[j].equity, a.lo, a.end, PD0, PD1))
  const days = sl[0].days
  const port = P.book(sl[0].r, sl[1].r).r
  const tim = A.map((_, j) => { let c = 0; for (let i = sl[j].a; i <= sl[j].z; i++) if (runs[j].position[i] !== 0) c++; return c / (sl[j].z - sl[j].a + 1) })
  return { days, sl, port, m: P.dailyMetrics(port, days), mS: sl.map(s => P.dailyMetrics(s.r, days)), tim: P.mean(tim) }
}

// ---------------------------------------------------------------- contrôles d'identité
const fail = (msg: string) => { throw new Error(`contrôle en échec : ${msg}`) }
function samePositions(x: PositionRecord[], y: PositionRecord[], what: string) {
  if (x.length !== y.length) fail(`${what} : ${x.length} ≠ ${y.length} positions`)
  for (let k = 0; k < x.length; k++) {
    const p = x[k], q = y[k]
    if (p.entryIdx !== q.entryIdx || p.exitIdx !== q.exitIdx || p.pnl !== q.pnl || p.exits.join() !== q.exits.join()) fail(`${what} : position ${k} différente`)
  }
}
function sameEquity(x: Float64Array, y: Float64Array, what: string) {
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) fail(`${what} : equity différente à la barre ${i}`)
}
const frozenV1 = A.map(a => simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, v1Signals(a)))
const copyV1 = A.map(a => runTrail(a, V1, v1Signals(a)))
A.forEach((a, j) => { samePositions(frozenV1[j].positions, copyV1[j].positions, `${a.key} V1`); sameEquity(frozenV1[j].equity, copyV1[j].equity, `${a.key} V1`) })
A.forEach(a => {
  const f = simulate(a.m, setsFor(a, 10), a.costs(1), a.lo, a.end, a.select, v1Signals(a))
  const c = runTrail(a, { ...V1, mult: 10, spec: { kind: 'classic' } }, v1Signals(a))
  samePositions(f.positions, c.positions, `${a.key} atrTrailMult 10`); sameEquity(f.equity, c.equity, `${a.key} atrTrailMult 10`)
})
const pairedOverride = (a: Asset, ps: PositionRecord[]): EntryOverride => {
  const long = new Uint8Array(a.bars.n), short = new Uint8Array(a.bars.n)
  for (const p of ps) (p.dir === 1 ? long : short)[p.entryIdx] = 1
  return { long, short }
}
const OVR_PAIRED = A.map((a, j) => pairedOverride(a, frozenV1[j].positions))
A.forEach((a, j) => samePositions(frozenV1[j].positions, runTrail(a, V1, OVR_PAIRED[j]).positions, `${a.key} rejeu apparié V1`))
const base = portfolio(frozenV1)
if (Math.abs(base.m.sharpe - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) > 1e-6) fail(`Sharpe V1 ${base.m.sharpe}`)
const v1Trades = A.map((a, j) => inRef(a, frozenV1[j].positions))
if (v1Trades[0].length !== 358 || v1Trades[1].length !== 358) fail('716 trades V1')
const CONTROLS = ['copie (spécification V1) = moteur figé, positions et equity au bit près, BTC et ETH',
  'copie (atrTrailMult = 10, hors liste) = moteur figé avec le même réglage', 'rejeu apparié (entrées imposées) = 716 trades V1',
  `Sharpe du portefeuille V1 = fiche (${base.m.sharpe.toFixed(4)})`]
if (MODE === 'controls') { console.log('contrôles OK :\n- ' + CONTROLS.join('\n- ')); process.exit(0) }

// ---------------------------------------------------------------- outils statistiques
function blockBoot(x0: number[], x1: number[], seed: number, L = 21) {
  const n = x0.length, rnd = P.rng(seed), dist: number[] = []
  const sh = (x: number[]) => { const m = P.mean(x), s = P.sd(x); return s > 0 ? (m / s) * ANNF : 0 }
  for (let b = 0; b < B; b++) {
    const a: number[] = [], c: number[] = []
    while (a.length < n) { const s0 = Math.floor(rnd() * n); for (let k = 0; k < L && a.length < n; k++) { const t = (s0 + k) % n; a.push(x0[t]); c.push(x1[t]) } }
    dist.push(sh(c) - sh(a))
  }
  const est = sh(x1) - sh(x0)
  return { est, lo: P.quantile(dist, 0.025), hi: P.quantile(dist, 0.975), p: (dist.filter(d => d <= 0).length + 1) / (B + 1) }
}
function holm(ps: number[]) {
  const o = ps.map((p, i) => [p, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array(ps.length).fill(1)
  let run = 0
  o.forEach(([p, i], r) => { run = Math.max(run, Math.min(1, (ps.length - r) * p)); out[i] = run })
  return out
}
const monthOf = (a: Asset, p: PositionRecord) => { const d = new Date(a.bars.t[p.entryIdx]); return d.getUTCFullYear() * 12 + d.getUTCMonth() }
function monthBoot(rows: { month: number; d: number }[], seed: number) {
  const months = [...new Set(rows.map(r => r.month))]
  const by = new Map<number, number>()
  for (const r of rows) by.set(r.month, (by.get(r.month) ?? 0) + r.d)
  const rnd = P.rng(seed), dist: number[] = []
  for (let b = 0; b < B; b++) { let s = 0; for (let k = 0; k < months.length; k++) s += by.get(months[Math.floor(rnd() * months.length)]) ?? 0; dist.push(s) }
  return { est: P.sum(rows.map(r => r.d)), lo: P.quantile(dist, 0.025), hi: P.quantile(dist, 0.975) }
}

// ---------------------------------------------------------------- trades V1 de référence
interface T1 { asset: number; key: string; entryIdx: number; month: number; R: number; mfe: number }
const T1s: T1[] = A.flatMap((a, j) => v1Trades[j].map(p => ({ asset: j, key: a.key, entryIdx: p.entryIdx, month: monthOf(a, p), R: Rof(a, p), mfe: mfeRof(a, p) })))
const NTOP = Math.ceil(0.05 * T1s.length)
const TOP = new Set([...T1s].sort((x, y) => y.R - x.R).slice(0, NTOP).map(t => `${t.asset}|${t.entryIdx}`))
const G = new Set(T1s.filter(t => t.mfe >= 2 && t.R < 1).map(t => `${t.asset}|${t.entryIdx}`))
const key = (j: number, i: number) => `${j}|${i}`
const pfOf = (ps: PositionRecord[]) => { const r = ps.map(p => p.pnl / p.equityAtEntry); return P.sum(r.filter(x => x > 0)) / -P.sum(r.filter(x => x <= 0)) }

// ---------------------------------------------------------------- variantes
const base2 = portfolio(A.map(a => simulate(a.m, a.preset.sets, a.costs(2), a.lo, a.end, a.select, v1Signals(a))))
const res: Record<string, any>[] = []
const series: number[][] = [base.port]
for (const [vi, v] of VARIANTS.entries()) {
  // apparié
  const paired = A.map((a, j) => runTrail(a, v, OVR_PAIRED[j]))
  const Rv = new Map<string, { R: number; exit: number }>()
  A.forEach((a, j) => inRef(a, paired[j].positions).forEach(p => Rv.set(key(j, p.entryIdx), { R: Rof(a, p), exit: p.exitIdx })))
  const v1Exit = new Map<string, number>()
  A.forEach((a, j) => v1Trades[j].forEach(p => v1Exit.set(key(j, p.entryIdx), p.exitIdx)))
  const rows = T1s.map(t => { const k = key(t.asset, t.entryIdx), x = Rv.get(k); if (!x) fail(`${v.id} : trade apparié manquant ${t.key} ${t.entryIdx}`); return { t, k, d: x!.R - t.R, Rv: x!.R, changed: x!.exit !== v1Exit.get(k) || Math.abs(x!.R - t.R) > 1e-9 } })
  const sel = (f: (r: typeof rows[0]) => boolean) => rows.filter(f).map(r => ({ month: r.t.month, d: r.d }))
  const pairedRes = {
    changed: rows.filter(r => r.changed).length,
    G: monthBoot(sel(r => G.has(r.k)), 11 + vi), TOP: monthBoot(sel(r => TOP.has(r.k)), 31 + vi), all: monthBoot(sel(() => true), 51 + vi),
    allBTC: P.sum(rows.filter(r => r.t.asset === 0).map(r => r.d)), allETH: P.sum(rows.filter(r => r.t.asset === 1).map(r => r.d)),
    topKept: rows.filter(r => TOP.has(r.k) && r.Rv >= 0.75 * r.t.R).length,
    gChangedPositive: rows.filter(r => G.has(r.k) && r.d > 0).length,
  }
  // rejeu complet
  const full = A.map(a => runTrail(a, v, v1Signals(a)))
  const full2 = A.map(a => runTrail(a, v, v1Signals(a), 2))
  const pf = portfolio(full), pf2 = portfolio(full2)
  const tr = A.map((a, j) => inRef(a, full[j].positions))
  const fullR = new Map<string, number>()
  A.forEach((a, j) => tr[j].forEach(p => fullR.set(key(j, p.entryIdx), Rof(a, p))))
  const topKeptFull = T1s.filter(t => TOP.has(key(t.asset, t.entryIdx))).filter(t => { const r = fullR.get(key(t.asset, t.entryIdx)); return r !== undefined && r >= 0.75 * t.R }).length
  const all = tr.flat()
  const exitsTrail = all.filter(p => p.exits.includes('TRAIL')).length
  res.push({
    id: v.id, fam: v.fam, label: v.label, paired: pairedRes,
    full: { trades: [tr[0].length, tr[1].length], sharpe: pf.m.sharpe, cagr: pf.m.cagr, maxDD: pf.m.maxDD, calmar: pf.m.calmar, sortino: pf.m.sortino, pf: pfOf(all), tim: pf.tim, exitsTrail,
            sharpeBTC: pf.mS[0].sharpe, sharpeETH: pf.mS[1].sharpe, cagrBTC: pf.mS[0].cagr, cagrETH: pf.mS[1].cagr, sharpe2: pf2.m.sharpe, cagr2: pf2.m.cagr, topKept: topKeptFull },
    boot: { port: blockBoot(base.port, pf.port, 101 + vi), btc: blockBoot(base.sl[0].r, pf.sl[0].r, 201 + vi), eth: blockBoot(base.sl[1].r, pf.sl[1].r, 301 + vi) },
  })
  series.push(pf.port)
}
const pH = holm(res.map(r => r.boot.port.p))
res.forEach((r, i) => { r.boot.port.pHolm = pH[i] })

// ---------------------------------------------------------------- PBO, walk-forward rétrospectif, Sharpe dégonflé
const CS = cscv(series, 16)
const dayIdx = (iso: string) => base.days.indexOf(Math.floor(Date.parse(iso) / DAY))
const CUTS = [2020, 2021, 2022, 2023, 2024, 2025, 2026].map(y => dayIdx(`${y}-01-01`))
const WF = walkForward(series, CUTS)
const ids = ['V1', ...VARIANTS.map(v => v.id)]
const wf = { oosSharpe: sharpe(WF.oos) * ANNF, v1Sharpe: sharpe(base.port.slice(CUTS[0])) * ANNF, chosen: WF.folds.map(f => `${P.isoDay(base.days[f.from]).slice(0, 4)} : ${ids[f.chosen]}`) }
const shDaily = series.map(x => sharpe(x))
const bestI = 1 + shDaily.slice(1).indexOf(Math.max(...shDaily.slice(1)))
const trialSd = P.sd(shDaily)
const dsrBest = dsr(series[bestI], 233, trialSd)
const diffs = series.slice(1).map(x => x.map((y, t) => y - base.port[t]))
const dsrDiff = dsr(diffs[bestI - 1], VARIANTS.length, P.sd(diffs.map(d => sharpe(d))))

// ---------------------------------------------------------------- règle de décision
const pboOK = CS.pbo < 0.25
for (const r of res) {
  const f = r.full
  r.crit = {
    c1: r.boot.port.lo > 0 && r.boot.port.pHolm < 0.05,
    c2: f.sharpeBTC > base.mS[0].sharpe && f.sharpeETH > base.mS[1].sharpe,
    c3: f.maxDD >= base.m.maxDD - 0.01 && f.calmar >= base.m.calmar,
    c4: f.topKept >= 30,
    c5: f.sharpe2 > base2.m.sharpe,
    c6: pboOK,
  }
  r.convincing = Object.values(r.crit).every(Boolean)
}
const winners = res.filter(r => r.convincing).sort((x, y) => x.paired.changed - y.paired.changed)
const decision = winners.length ? `variante candidate : ${winners[0].id} (${winners[0].label}) — à valider prospectivement` : 'aucune variante convaincante : trailing de 50 ATR conservé'

// ---------------------------------------------------------------- rapport
function synthesis(): string[] {
  const rg = (xs: number[], d = 0) => `${sg(Math.min(...xs), d)} à ${sg(Math.max(...xs), d)}`
  const ratio = res.map(r => -r.paired.TOP.est / r.paired.G.est)
  const best = res.reduce((x, y) => (y.boot.port.est > x.boot.port.est ? y : x))
  const tight = res.filter(r => r.full.maxDD > base.m.maxDD + 0.01)
  return [
    `- Apparié : R récupéré sur les trades qui rendent leurs gains ${rg(res.map(r => r.paired.G.est))} R ; R sacrifié sur les ${NTOP} très gros gagnants ${rg(res.map(r => r.paired.TOP.est))} R, soit ${n(Math.min(...ratio), 1)} à ${n(Math.max(...ratio), 1)} R perdus par R récupéré. ΔR total négatif pour les ${res.filter(r => r.paired.all.est < 0).length} variantes, sur BTC (${res.filter(r => r.paired.allBTC < 0).length} / ${res.length}) comme sur ETH (${res.filter(r => r.paired.allETH < 0).length} / ${res.length}).`,
    `- Portefeuille : ΔSharpe ${rg(res.map(r => r.boot.port.est), 2)} ; meilleure variante ${best.id} (${sg(best.boot.port.est)}, IC ${ci(best.boot.port, 2)}). Sharpe relevé sur les deux sleeves : ${res.filter(r => r.crit.c2).length} / ${res.length} ; Calmar ≥ V1 : ${res.filter(r => r.full.calmar >= base.m.calmar).length} / ${res.length}.`,
    `- Les trailings serrés (${tight.map(r => r.id).join(', ')}) réduisent le drawdown (${rg(tight.map(r => 100 * r.full.maxDD), 1)} % contre ${pc(base.m.maxDD)}) au prix de la CAGR (${n(100 * Math.min(...tight.map(r => r.full.cagr)), 1)} à ${n(100 * Math.max(...tight.map(r => r.full.cagr)), 1)} % contre ${pc(base.m.cagr)}).`,
  ]
}
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => fr((x > 0 ? '' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d))
const sg = (x: number, d = 2) => fr((x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d))
const pc = (x: number, d = 1) => fr((x < 0 ? '−' : '') + Math.abs(100 * x).toFixed(d) + ' %')
const ci = (b: { lo: number; hi: number }, d = 1) => `[${sg(b.lo, d)} ; ${sg(b.hi, d)}]`
const yes = (b: boolean) => (b ? 'oui' : 'non')
const L: string[] = []
L.push('# Trailing stop de Shock Engine V1 — variantes pré-enregistrées', '',
  'Protocole : `research/preregistration/v1-trailing.md` (commité avant les résultats). Généré par `research/fade/v1/trailing-study.ts`. '
  + 'Moteur figé non modifié ; variantes découplées et conditionnelles via la copie isolée `research/fade/v1/trail-broker.ts`. '
  + '**Simulation historique dans l\'échantillon de conception de V1** : aucun chiffre n\'est une validation indépendante.', '',
  `## Verdict`, '', `**${decision}.**`, '', ...synthesis(), '',
  '## Contrôles', '', ...CONTROLS.map(c => `- ${c} : OK`), '',
  `V1 : ${T1s.length} trades, Sharpe ${n(base.m.sharpe)}, CAGR ${pc(base.m.cagr)}, drawdown ${pc(base.m.maxDD)}, Calmar ${n(base.m.calmar)}. `
  + `Groupe « rend ses gains » (MFE ≥ 2 R et R < 1 R) : ${G.size} trades. « Très gros gagnants » (5 % meilleurs) : ${NTOP} trades, `
  + `${n(P.sum(T1s.filter(t => TOP.has(key(t.asset, t.entryIdx))).map(t => t.R)), 0)} R sur ${n(P.sum(T1s.map(t => t.R)), 0)} R.`, '',
  '## 1. Analyse appariée (mêmes 716 entrées, seules les sorties changent)', '',
  'ΔR = Σ (R variante − R V1) ; IC à 95 % par bootstrap des mois d\'entrée. « Conservés » : R ≥ 75 % du R V1.', '',
  '| variante | sorties modifiées | ΔR récupéré, trades qui rendent leurs gains | ΔR sur les 36 très gros gagnants | ΔR total | dont BTC | dont ETH | très gros gagnants conservés |',
  '|---|---:|---|---|---|---:|---:|---:|')
for (const r of res) {
  const p = r.paired
  L.push(`| ${r.id} · ${r.label} | ${p.changed} | ${sg(p.G.est, 1)} ${ci(p.G)} | ${sg(p.TOP.est, 1)} ${ci(p.TOP)} | ${sg(p.all.est, 1)} ${ci(p.all)} | ${sg(p.allBTC, 1)} | ${sg(p.allETH, 1)} | ${p.topKept} / ${NTOP} |`)
}
L.push('', '## 2. Rejeu complet du portefeuille BTC/ETH 50/50', '',
  'ΔSharpe : bootstrap par blocs de 21 jours (IC 95 %, p unilatéral, Holm sur 11). Très gros gagnants : les 36 meilleurs trades V1 retrouvés (même entrée) avec R ≥ 75 % du R V1.', '',
  '| variante | trades | Sharpe | ΔSharpe [IC 95 %] | p Holm | CAGR | drawdown | Calmar | Sortino | PF | sorties TRAIL | très gros gagnants conservés | Sharpe BTC (Δ [IC]) | Sharpe ETH (Δ [IC]) | Sharpe coûts × 2 |',
  '|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|',
  `| V1 | ${v1Trades[0].length + v1Trades[1].length} | ${n(base.m.sharpe)} | — | — | ${pc(base.m.cagr)} | ${pc(base.m.maxDD)} | ${n(base.m.calmar)} | ${n(base.m.sortino)} | ${n(pfOf(v1Trades.flat()))} | ${v1Trades.flat().filter(p => p.exits.includes('TRAIL')).length} | ${NTOP} / ${NTOP} | ${n(base.mS[0].sharpe)} | ${n(base.mS[1].sharpe)} | ${n(base2.m.sharpe)} |`)
for (const r of res) {
  const f = r.full, b = r.boot
  L.push(`| ${r.id} | ${f.trades[0] + f.trades[1]} | ${n(f.sharpe)} | ${sg(b.port.est)} ${ci(b.port, 2)} | ${n(b.port.pHolm, 3)} | ${pc(f.cagr)} | ${pc(f.maxDD)} | ${n(f.calmar)} | ${n(f.sortino)} | ${n(f.pf)} | ${f.exitsTrail} | ${f.topKept} / ${NTOP} | `
    + `${n(f.sharpeBTC)} (${sg(b.btc.est)} ${ci(b.btc, 2)}) | ${n(f.sharpeETH)} (${sg(b.eth.est)} ${ci(b.eth, 2)}) | ${n(f.sharpe2)} |`)
}
L.push('', '## 3. Contrôles statistiques', '',
  `- CSCV-PBO (12 configurations, 16 blocs) : **${pc(CS.pbo)}** ; configuration la plus souvent choisie : ${ids[CS.chosenCount.indexOf(Math.max(...CS.chosenCount))]}.`,
  `- Sharpe dégonflé de la meilleure variante (${ids[bestI]}, N = 233 essais) : ${n(dsrBest.p, 3)} — il reflète le niveau hérité de V1, pas un apport du trailing ; de son écart à V1 (N = 11), seul pertinent pour la décision : ${n(dsrDiff.p, 3)}.`,
  `- Walk-forward **rétrospectif** (recalage annuel 2020 → 2026, meilleur Sharpe passé parmi les 12) : Sharpe hors période d'entraînement ${n(wf.oosSharpe)} contre ${n(wf.v1Sharpe)} pour V1 sur les mêmes jours ; choix : ${wf.chosen.join(', ')}. `
  + 'Ce n\'est pas une validation prospective indépendante : tout l\'historique a servi à concevoir V1.', '',
  '## 4. Règle de décision', '',
  '| variante | 1 ΔSharpe > 0 (IC, Holm) | 2 BTC et ETH | 3 drawdown et Calmar | 4 ≥ 30 / 36 très gros gagnants | 5 coûts × 2 | 6 PBO < 25 % | convaincante |',
  '|---|---|---|---|---|---|---|---|')
for (const r of res) L.push(`| ${r.id} | ${yes(r.crit.c1)} | ${yes(r.crit.c2)} | ${yes(r.crit.c3)} | ${yes(r.crit.c4)} | ${yes(r.crit.c5)} | ${yes(r.crit.c6)} | **${yes(r.convincing)}** |`)
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'report.md'), L.join('\n') + '\n')
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ protocol: 'research/preregistration/v1-trailing.md', controls: CONTROLS, base: { ...base.m, sharpeBTC: base.mS[0].sharpe, sharpeETH: base.mS[1].sharpe, sharpe2: base2.m.sharpe },
  groups: { G: G.size, TOP: NTOP }, variants: res, pbo: CS.pbo, wf, dsrBest: { id: ids[bestI], p: dsrBest.p }, dsrDiff: { p: dsrDiff.p }, decision },
(_, x) => (typeof x === 'number' ? (Number.isFinite(x) ? +x.toPrecision(8) : String(x)) : x), 1) + '\n')
console.log(decision)
