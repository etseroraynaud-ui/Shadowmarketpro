// Un seul jeu de règles dans tous les régimes de volatilité (research/preregistration/single-set.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/single-set.ts
//
// E2 (deux jeux, régime agité tradé avec son propre jeu), V1 (règles publiées : pas d'entrée en régime
// agité) et S (le jeu du régime calme appliqué à toutes les bougies, calmes ou agitées ; shorts en
// tendance baissière). Même boucle que research/shock/agitated-regime.ts ; le moteur n'est pas
// modifié. Sorties : research/reports/single-set/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, UNSEEN, referenceAsset, unseenAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { dailyOf, exposure, simulateSized } from '../lib/variant-eval.ts'
import type { SizedRun } from '../lib/variant-eval.ts'
import { CALM_ONLY_REFERENCE } from '../lib/calm-only.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/single-set')
const DAY = 864e5
const BOOT = 5000, SEED = 20261014
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }

// ================================================================ actifs et variantes
const ASSETS: Asset[] = [referenceAsset('btc'), referenceAsset('ethusdt'), ...UNSEEN.map(unseenAsset)]
const BTC = ASSETS[0], ETH = ASSETS[1], UN = ASSETS.slice(2)
type V = 'E2' | 'V1' | 'S'
const VS: V[] = ['E2', 'V1', 'S']
const VLABEL: Record<V, string> = {
  E2: 'E2 · deux jeux, régime agité tradé avec son jeu',
  V1: 'V1 · règles publiées, pas d\'entrée en régime agité',
  S: 'S · jeu du régime calme dans tous les régimes',
}
function inputs(a: Asset, v: V): { sets: ShockParams[]; override: EntryOverride } {
  if (v === 'E2') return { sets: a.preset.sets, override: a.signals }
  if (v === 'V1') {
    const drop = (x: Uint8Array) => Uint8Array.from(x, (s, i) => (s && a.select[i] === 1 ? 0 : s))
    return { sets: a.preset.sets, override: { long: drop(a.signals.long), short: drop(a.signals.short) } }
  }
  // S : les deux « jeux » sont le jeu calme ; entrées recalculées avec lui sur toute bougie de régime
  // connu, comme loadSleeve (bougie qui suit un trou exclue), shorts filtrés par la tendance.
  const calm = a.preset.sets[0]
  const R = prepare(a.m, calm)
  const t = a.bars.t, n = a.bars.n
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = a.lo; i <= a.end; i++) {
    if (a.select[i] < 0 || (i > 0 && t[i] - t[i - 1] > M15)) continue
    if (calm.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (calm.allowShort && R.impulseEntryShort[i] && a.trend[i]) short[i] = 1
  }
  return { sets: [calm, calm], override: { long, short } }
}

interface Run { run: SizedRun; daily: { days: number[]; r: number[]; a: number; z: number } }
const RUNS = new Map<string, Record<V, Record<number, Run>>>()
for (const a of ASSETS) {
  const rs = {} as Record<V, Record<number, Run>>
  for (const v of VS) {
    rs[v] = {}
    const I = inputs(a, v)
    for (const k of [1, 2]) {
      const run = simulateSized(a.m, I.sets, a.costs(k), a.lo, a.end, a.select, I.override, [1, 1])
      rs[v][k] = { run, daily: dailyOf(a.bars, run.equity, a.lo, a.end) }
    }
  }
  RUNS.set(a.key, rs)
  log(`${a.key} : ${VS.map(v => `${v} ${rs[v][1].run.positions.length}`).join(', ')} positions`)
}

// ================================================================ portefeuille et contrôles
const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo]), tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const sleeve = (a: Asset, v: V, k: number) => dailyOf(a.bars, RUNS.get(a.key)![v][k].run.equity, a.lo, a.end, PD0, PD1)
const PORT = Object.fromEntries(VS.map(v => [v, Object.fromEntries([1, 2].map(k => { const b = sleeve(BTC, v, k), e = sleeve(ETH, v, k); return [k, { days: b.days, r: P.book(b.r, e.r).r, btc: b, eth: e }] }))])) as unknown as Record<V, Record<number, { days: number[]; r: number[]; btc: { days: number[]; r: number[] }; eth: { days: number[]; r: number[] } }>>
const sh = (v: V, k = 1) => P.dailyMetrics(PORT[v][k].r, PORT[v][k].days).sharpe
check('E2 : Sharpe du portefeuille = publié', Math.abs(sh('E2') - CALM_ONLY_REFERENCE.e2.costs1.sharpe) < 1e-6, `${sh('E2')} / ${CALM_ONLY_REFERENCE.e2.costs1.sharpe}`)
check('V1 : Sharpe du portefeuille = publié', Math.abs(sh('V1') - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) < 1e-6, `${sh('V1')} / ${CALM_ONLY_REFERENCE.portfolio.costs1.sharpe}`)
check('E2 et V1 : commissions × 2 = publiées', Math.abs(sh('E2', 2) - CALM_ONLY_REFERENCE.e2.costs2.sharpe) < 1e-6 && Math.abs(sh('V1', 2) - CALM_ONLY_REFERENCE.portfolio.costs2.sharpe) < 1e-6, `${sh('E2', 2)} · ${sh('V1', 2)}`)
// Le jeu calme est le même dans V1 et S : les entrées calmes de V1 se retrouvent dans S, sauf quand une
// position agitée de S occupe déjà le marché.
const overlap = [BTC, ETH].map(a => {
  const ent = (v: V) => new Set(RUNS.get(a.key)![v][1].run.positions.filter(p => a.select[p.entryIdx] === 0).map(p => `${p.entryIdx}:${p.dir}`))
  const v1 = ent('V1'), s = ent('S')
  return { asset: a.key, v1: v1.size, inS: [...v1].filter(x => s.has(x)).length }
})
for (const o of overlap) check(`${o.asset} : entrées calmes de V1 retrouvées dans S`, o.inS / o.v1 > 0.8, `${o.inS} / ${o.v1}`)
log('contrôles')

// ================================================================ mesures
function metrics(d: { days: number[]; r: number[] }, runs: { a: Asset; run: SizedRun; da: number; dz: number }[]) {
  const m = P.dailyMetrics(d.r, d.days)
  const inWin = (x: { a: Asset; da: number; dz: number }, i: number) => i >= x.da && i <= x.dz
  const pos = runs.flatMap(x => x.run.positions.filter(p => !p.exits.includes('END') && inWin(x, p.entryIdx)).map(p => ({ x, p })))
  const gp = pos.filter(o => o.p.pnl > 0).reduce((s, o) => s + o.p.pnl / o.p.equityAtEntry, 0), gl = pos.filter(o => o.p.pnl <= 0).reduce((s, o) => s + o.p.pnl / o.p.equityAtEntry, 0)
  const ex = runs.map(x => exposure(x.run, x.da, x.dz))
  return {
    sharpe: m.sharpe, sortino: m.sortino, cagr: m.cagr, vol: m.vol, maxDD: m.maxDD, calmar: m.calmar, total: m.totalReturn, pf: gp / -gl,
    trades: pos.length, longs: pos.filter(o => o.p.dir === 1).length, shorts: pos.filter(o => o.p.dir === -1).length,
    agitated: pos.filter(o => o.x.a.select[o.p.entryIdx] === 1).length,
    winRate: pos.filter(o => o.p.pnl > 0).length / pos.length, timeInMarket: P.mean(ex.map(e => e.timeInMarket)),
  }
}
const one = (a: Asset, v: V, k: number) => { const r = RUNS.get(a.key)![v][k]; return metrics(r.daily, [{ a, run: r.run, da: r.daily.a, dz: r.daily.z }]) }
const commonOf = (a: Asset, v: V, k: number, d: { days: number[]; r: number[] }) => { const r = RUNS.get(a.key)![v][k]; const w = dailyOf(a.bars, r.run.equity, a.lo, a.end, PD0, PD1); return metrics(d, [{ a, run: r.run, da: w.a, dz: w.z }]) }
const TABLE = {
  portfolio: Object.fromEntries(VS.map(v => [v, Object.fromEntries([1, 2].map(k => {
    const runs = [BTC, ETH].map(a => { const r = RUNS.get(a.key)![v][k]; const w = dailyOf(a.bars, r.run.equity, a.lo, a.end, PD0, PD1); return { a, run: r.run, da: w.a, dz: w.z } })
    return [k, metrics(PORT[v][k], runs)]
  }))])),
  btcCommon: Object.fromEntries(VS.map(v => [v, Object.fromEntries([1, 2].map(k => [k, commonOf(BTC, v, k, PORT[v][k].btc)]))])),
  ethCommon: Object.fromEntries(VS.map(v => [v, Object.fromEntries([1, 2].map(k => [k, commonOf(ETH, v, k, PORT[v][k].eth)]))])),
  btcFull: Object.fromEntries(VS.map(v => [v, Object.fromEntries([1, 2].map(k => [k, one(BTC, v, k)]))])),
  unseen: Object.fromEntries(UN.map(a => [a.key, Object.fromEntries(VS.map(v => [v, one(a, v, 1)]))])),
} as Record<string, Record<string, Record<string, ReturnType<typeof metrics>> | ReturnType<typeof metrics>>>
const annual = Object.fromEntries(VS.map(v => [v, P.periodReturns(PORT[v][1].btc.r, PORT[v][1].btc.days, P.yearOf).map(y => ({ year: y.key, ret: y.ret, days: y.n }))]))

// Écart de Sharpe du portefeuille, bootstrap par mois (mêmes mois tirés pour les deux variantes).
const months = [...new Set(PORT.E2[1].days.map(P.monthKey))].sort((x, y) => x - y)
const midx = new Map(months.map((m, j) => [m, j]))
const agg = (v: V) => { const s = new Float64Array(months.length), q = new Float64Array(months.length), n = new Float64Array(months.length); PORT[v][1].days.forEach((d, i) => { const j = midx.get(P.monthKey(d))!; s[j] += PORT[v][1].r[i]; q[j] += PORT[v][1].r[i] ** 2; n[j]++ }); return { s, q, n } }
const A = Object.fromEntries(VS.map(v => [v, agg(v)])) as Record<V, ReturnType<typeof agg>>
const shDraw = (g: ReturnType<typeof agg>, draw: number[]) => { let s = 0, q = 0, n = 0; for (const j of draw) { s += g.s[j]; q += g.q[j]; n += g.n[j] } const m = s / n, sd = Math.sqrt(Math.max(q / n - m * m, 0)); return (m / sd) * Math.sqrt(P.ANN) }
const R = P.rng(SEED)
const diffs = { 'S − V1': [] as number[], 'S − E2': [] as number[], 'V1 − E2': [] as number[] }
for (let b = 0; b < BOOT; b++) {
  const draw = months.map(() => Math.floor(R() * months.length))
  const x = Object.fromEntries(VS.map(v => [v, shDraw(A[v], draw)])) as Record<V, number>
  diffs['S − V1'].push(x.S - x.V1); diffs['S − E2'].push(x.S - x.E2); diffs['V1 − E2'].push(x.V1 - x.E2)
}
const point = { 'S − V1': sh('S') - sh('V1'), 'S − E2': sh('S') - sh('E2'), 'V1 − E2': sh('V1') - sh('E2') }
const CI = Object.fromEntries(Object.entries(diffs).map(([k, xs]) => [k, { point: point[k as keyof typeof point], lo: P.quantile(xs, 0.025), hi: P.quantile(xs, 0.975), above0: xs.filter(x => x > 0).length / xs.length }]))
const unseenDelta = (u: V, w: V) => UN.map(a => (TABLE.unseen[a.key][u] as ReturnType<typeof metrics>).sharpe - (TABLE.unseen[a.key][w] as ReturnType<typeof metrics>).sharpe)
const UD = { 'S − V1': unseenDelta('S', 'V1'), 'S − E2': unseenDelta('S', 'E2') }
const adopt = CI['S − V1'].lo > 0 && P.mean(UD['S − V1']) > 0
log('mesures')

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'single-set.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/single-set.md', variants: VLABEL, table: TABLE, annualBtc: annual, ci: CI, unseenDelta: UD, overlap, ruleMet: adopt, checks }, null, 1) + '\n')
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2).replace('.', ',').replace('-', '−') : '—')
const p1 = (x: number) => `${(x * 100).toFixed(1).replace('.', ',').replace('-', '−')} %`
const L: string[] = []
L.push('# Un seul jeu de règles dans tous les régimes de volatilité', '')
L.push('Protocole : `research/preregistration/single-set.md` (commité avant calcul). Exploratoire : la variante S est proposée après avoir vu les résultats d\'E2 et de V1 ; elle est la 17e configuration essayée sur le portefeuille. Commission 0,045 % par ordre, 100 % du capital de chaque marché par position, sans levier ni financement.', '')
const head = '| Variante | Sharpe | Sortino | CAGR | volatilité | drawdown max. | Calmar | rendement total | PF | trades (longs / shorts) | dont ouverts en régime agité | Sharpe, commissions × 2 |'
const sep = '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|'
const row = (v: V, x: ReturnType<typeof metrics>, x2: ReturnType<typeof metrics>) => `| ${VLABEL[v]} | ${f2(x.sharpe)} | ${f2(x.sortino)} | ${p1(x.cagr)} | ${p1(x.vol)} | ${p1(x.maxDD)} | ${f2(x.calmar)} | ${Math.round(x.total * 100)} % | ${f2(x.pf)} | ${x.trades} (${x.longs} / ${x.shorts}) | ${x.agitated} | ${f2(x2.sharpe)} |`
for (const [title, key] of [['Portefeuille BTC/ETH 50/50 (2018-09-01 → 2026-09-30)', 'portfolio'], ['BTC seul, même période', 'btcCommon'], ['ETH seul, même période', 'ethCommon'], ['BTC seul, tout l\'historique (2017 → 2026)', 'btcFull']] as const) {
  L.push(`## ${title}`, '', head, sep)
  for (const v of VS) { const t = TABLE[key][v] as unknown as Record<number, ReturnType<typeof metrics>>; L.push(row(v, t[1], t[2])) }
  L.push('')
}
L.push('## BTC seul, rendement par année (2018-09 → 2026-09)', '', `| Variante | ${annual.E2.map(y => y.year + (y.days < 360 ? '*' : '')).join(' | ')} |`, `|---|${annual.E2.map(() => '---:').join('|')}|`)
for (const v of VS) L.push(`| ${v} | ${annual[v].map(y => p1(y.ret)).join(' | ')} |`)
L.push('', '\\* année partielle.', '')
L.push('## Écarts de Sharpe du portefeuille (bootstrap par mois, 5 000 tirages, IC 95 %)', '', '| Écart | point | IC 95 % | part des tirages > 0 |', '|---|---:|---:|---:|')
for (const [k, c] of Object.entries(CI)) L.push(`| ${k} | ${f2(c.point)} | ${f2(c.lo)} à ${f2(c.hi)} | ${Math.round(c.above0 * 100)} % |`)
L.push('', '## 8 cryptos (consultées dans l\'étude du régime agité : pas vierges)', '', `| | ${UN.map(a => a.key).join(' | ')} | moyenne |`, `|---|${UN.map(() => '---:').join('|')}|---:|`)
for (const v of VS) L.push(`| Sharpe ${v} | ${UN.map(a => f2((TABLE.unseen[a.key][v] as ReturnType<typeof metrics>).sharpe)).join(' | ')} | ${f2(P.mean(UN.map(a => (TABLE.unseen[a.key][v] as ReturnType<typeof metrics>).sharpe)))} |`)
L.push(`| Δ S − V1 | ${UD['S − V1'].map(f2).join(' | ')} | ${f2(P.mean(UD['S − V1']))} |`)
L.push('', '## Lecture (règle fixée avant calcul)', '')
L.push(adopt
  ? `L'écart S − V1 du portefeuille a un intervalle entièrement positif et S améliore les 8 cryptos en moyenne : S devient une hypothèse à suivre en conditions réelles, pas une règle adoptée, puisqu'elle a été proposée après avoir vu les résultats.`
  : `La condition n'est pas remplie (écart S − V1 : ${f2(CI['S − V1'].point)}, IC ${f2(CI['S − V1'].lo)} à ${f2(CI['S − V1'].hi)} ; Δ moyen sur les 8 cryptos ${f2(P.mean(UD['S − V1']))}) : les règles publiées ne changent pas.`, '')
L.push('## Contrôles', '')
for (const c of checks) L.push(`- ${c.ok ? 'OK' : 'ÉCHEC'} — ${c.name} : ${c.detail}`)
writeFileSync(join(OUT, 'single-set.md'), L.join('\n') + '\n')
log(`écrit research/reports/single-set/ (S − V1 ${CI['S − V1'].point.toFixed(3)} [${CI['S − V1'].lo.toFixed(3)} ; ${CI['S − V1'].hi.toFixed(3)}])`)
