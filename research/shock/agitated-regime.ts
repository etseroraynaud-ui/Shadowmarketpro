// Architecture du régime agité (research/preregistration/agitated-regime.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/agitated-regime.ts
//
// Diagnostics (V0) : continuation après le signal, reprise après le stop, excursions en ATR, par
// régime. Variantes rejouées en portefeuille complet : V1 sans entrées en régime agité, V2a stop du
// jeu agité à 3,3 ATR à taille inchangée, V2b même stop à risque monétaire égal. BTC/ETH et 8 cryptos
// consultées : exploratoire. Le moteur n'est pas modifié. Sorties : research/reports/agitated-regime/.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, UNSEEN, referenceAsset, unseenAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { dailyOf, exposure, simulateSized } from '../lib/variant-eval.ts'
import type { SizedRun } from '../lib/variant-eval.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/agitated-regime')
const PLAN = 'research/preregistration/agitated-regime.md'
const DAY = 864e5
const BOOT = 5000, SEED = 20261013
const HZ = [1, 4, 16, 64]
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }

const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha(readFileSync(join(ROOT, f))) === h, f)

// ================================================================ actifs et variantes
const ASSETS: Asset[] = [referenceAsset('btc'), referenceAsset('ethusdt'), ...UNSEEN.map(unseenAsset)]
const BTC = ASSETS[0], ETH = ASSETS[1], UN = ASSETS.slice(2)
type V = 'V0' | 'V1' | 'V2a' | 'V2b'
const VS: V[] = ['V0', 'V1', 'V2a', 'V2b']
const TESTED: V[] = ['V1', 'V2a', 'V2b']
const VLABEL: Record<V, string> = {
  V0: 'V0 · E2 inchangé',
  V1: 'V1 · sans entrées en régime agité',
  V2a: 'V2a · stop agité 3,3 ATR, taille inchangée',
  V2b: 'V2b · stop agité 3,3 ATR, même risque monétaire',
}
function inputs(a: Asset, v: V): { sets: ShockParams[]; override: EntryOverride; scale: number[] } {
  const [calm, ag] = a.preset.sets
  if (v === 'V0') return { sets: a.preset.sets, override: a.signals, scale: [1, 1] }
  if (v === 'V1') {
    const drop = (x: Uint8Array) => Uint8Array.from(x, (s, i) => (s && a.select[i] === 1 ? 0 : s))
    return { sets: a.preset.sets, override: { long: drop(a.signals.long), short: drop(a.signals.short) }, scale: [1, 1] }
  }
  const sets = [calm, { ...ag, atrStopMult: calm.atrStopMult }]
  return { sets, override: a.signals, scale: v === 'V2a' ? [1, 1] : [1, ag.atrStopMult / calm.atrStopMult] }
}

// Contrôle : la boucle à taille par jeu redonne simulate() à l'identique quand la taille est inchangée.
for (const a of [BTC, UN[0]]) {
  const r0 = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)
  const r1 = simulateSized(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, [1, 1])
  let d = 0
  for (let i = 0; i < r0.equity.length; i++) d = Math.max(d, Math.abs(r0.equity[i] - r1.equity[i]))
  check(`${a.key} : boucle à taille par jeu = simulate()`, d === 0 && JSON.stringify(r0.positions) === JSON.stringify(r1.positions), `max |Δequity| ${d}`)
}

interface Run { run: SizedRun; daily: { days: number[]; r: number[]; a: number; z: number } }
const RUNS = new Map<string, Record<V, Record<number, Run>>>()
for (const a of ASSETS) {
  const rs = {} as Record<V, Record<number, Run>>
  for (const v of VS) {
    rs[v] = {}
    const I = inputs(a, v)
    for (const k of [1, 2]) {
      const run = simulateSized(a.m, I.sets, a.costs(k), a.lo, a.end, a.select, I.override, I.scale)
      rs[v][k] = { run, daily: dailyOf(a.bars, run.equity, a.lo, a.end) }
    }
  }
  RUNS.set(a.key, rs)
  log(`${a.key} : ${VS.map(v => `${v} ${rs[v][1].run.positions.length}`).join(', ')} positions`)
}

// La taille ne change aucune décision : V2a et V2b ont les mêmes entrées, sorties et motifs de sortie.
for (const a of ASSETS) {
  const sig = (v: V) => RUNS.get(a.key)![v][1].run.positions.map(p => `${p.entryIdx}:${p.dir}:${p.exitIdx}:${p.exits.join('+')}`).join(',')
  check(`${a.key} : V2b = V2a hors taille`, sig('V2a') === sig('V2b'), `${RUNS.get(a.key)!.V2a[1].run.positions.length} positions`)
}

// ================================================================ contrôles de référence
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const inRef = (a: Asset, p: PositionRecord) => a.unseen || (a.bars.t[p.entryIdx] >= REF[0] && a.bars.t[p.entryIdx] < REF[1])
for (const [a, n] of [[BTC, 644], [ETH, 667]] as const) {
  const got = RUNS.get(a.key)!.V0[1].run.positions.filter(p => inRef(a, p) && !p.exits.includes('END')).length
  check(`${a.key} : V0 = trades du portefeuille E2 publié`, got === n, `${got} / ${n}`)
}
const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo]), tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const portfolio = (v: V, k: number) => {
  const b = dailyOf(BTC.bars, RUNS.get('BTC')![v][k].run.equity, BTC.lo, BTC.end, PD0, PD1)
  const e = dailyOf(ETH.bars, RUNS.get('ETH')![v][k].run.equity, ETH.lo, ETH.end, PD0, PD1)
  return { days: b.days, r: P.book(b.r, e.r).r, wb: b, we: e }
}
const PORT = Object.fromEntries(VS.map(v => [v, { 1: portfolio(v, 1), 2: portfolio(v, 2) }])) as unknown as Record<V, Record<number, ReturnType<typeof portfolio>>>
const pub = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'), 'utf8')).headline.portfolioSharpe
const s0 = P.dailyMetrics(PORT.V0[1].r, PORT.V0[1].days).sharpe
check('BTC/ETH : Sharpe de V0 = Sharpe publié', Math.abs(s0 - pub) < 1e-9, `${s0} / ${pub}`)
log('contrôles')

// ================================================================ diagnostics (V0)
interface D { asset: string; set: number; month: number; cont: number[]; post16: number; post64: number; sl: boolean; mfeAtr: number; maeAtr: number }
function diag(a: Asset): D[] {
  const b = a.bars
  return RUNS.get(a.key)!.V0[1].run.positions.filter(p => inRef(a, p) && !p.exits.includes('END') && p.dir === 1).map(p => {
    const i = p.entryIdx, e = p.exitIdx, atr = p.atrAtEntry
    const at = (k: number) => (k < b.n ? (p.dir * (b.c[k] - p.entryPrice)) / atr : NaN)
    return { asset: a.key, set: p.set, month: P.monthKey(Math.floor(b.t[i] / DAY)), cont: HZ.map(h => at(i + h)), post16: at(e + 16), post64: at(e + 64), sl: p.exits.join('+') === 'SL', mfeAtr: p.mfeAtr, maeAtr: p.maeAtr }
  })
}
const DS: Record<string, D[]> = { 'BTC/ETH': [...diag(BTC), ...diag(ETH)], '8 cryptos': UN.flatMap(diag) }
const q = (xs: number[], p: number) => P.quantile(xs.filter(Number.isFinite), p)
function bootMean(ds: D[], f: (d: D) => number, seed: number): [number, number] {
  const months = [...new Set(ds.map(d => d.month))].sort((x, y) => x - y)
  const idx = new Map(months.map((m, j) => [m, j]))
  const S = new Float64Array(months.length), C = new Float64Array(months.length)
  for (const d of ds) { const v = f(d); if (!Number.isFinite(v)) continue; const j = idx.get(d.month)!; S[j] += v; C[j]++ }
  const R = P.rng(seed)
  const out: number[] = []
  for (let r = 0; r < BOOT; r++) { let s = 0, c = 0; for (let k = 0; k < months.length; k++) { const j = Math.floor(R() * months.length); s += S[j]; c += C[j] } out.push(s / c) }
  return [q(out, 0.025), q(out, 0.975)]
}
const DIAG = Object.fromEntries(Object.entries(DS).map(([name, ds]) => [name, [0, 1].map(set => {
  const g = ds.filter(d => d.set === set)
  const sl = g.filter(d => d.sl)
  return {
    set, n: g.length,
    cont: HZ.map((h, k) => { const xs = g.map(d => d.cont[k]).filter(Number.isFinite); return { h, mean: P.mean(xs), ci: bootMean(g, d => d.cont[k], SEED + h), median: q(xs, 0.5), pos: xs.filter(x => x > 0).length / xs.length } }),
    stopped: sl.length,
    post: [16, 64].map(h => { const xs = sl.map(d => (h === 16 ? d.post16 : d.post64)).filter(Number.isFinite); return { h, n: xs.length, above11: xs.filter(x => x > 1.1).length / xs.length, above33: xs.filter(x => x > 3.3).length / xs.length, median: q(xs, 0.5) } }),
    mfe: [0.25, 0.5, 0.75].map(p => q(g.map(d => d.mfeAtr), p)), mae: [0.25, 0.5, 0.75].map(p => q(g.map(d => d.maeAtr), p)),
  }
})]))
log('diagnostics')

// ================================================================ mesures des variantes
function metrics(a: Asset | null, v: V, k: number) {
  const runs = a ? [{ a, r: RUNS.get(a.key)![v][k] }] : [BTC, ETH].map(x => ({ a: x, r: RUNS.get(x.key)![v][k] }))
  const d = a ? runs[0].r.daily : PORT[v][k]
  const m = P.dailyMetrics(d.r, d.days)
  const pos = runs.flatMap(({ a: x, r }) => r.run.positions.filter(p => !p.exits.includes('END') && (a ? true : inRef(x, p))).map(p => ({ x, p })))
  const gp = pos.filter(o => o.p.pnl > 0).reduce((s, o) => s + o.p.pnl / o.p.equityAtEntry, 0), gl = pos.filter(o => o.p.pnl <= 0).reduce((s, o) => s + o.p.pnl / o.p.equityAtEntry, 0)
  const ex = runs.map(({ r }) => exposure(r.run, r.daily.a, r.daily.z))
  // Meilleurs trades de V0 (5 % des rendements), retrouvés à la même bougie d'entrée et dans le même sens.
  const top = runs.flatMap(({ a: x }) => RUNS.get(x.key)!.V0[k].run.positions.filter(p => !p.exits.includes('END') && (a ? true : inRef(x, p))).map(p => ({ x, p })))
    .sort((u, w) => w.p.pnl / w.p.equityAtEntry - u.p.pnl / u.p.equityAtEntry)
  const best = top.slice(0, Math.max(1, Math.round(top.length * 0.05)))
  const key = (x: Asset, p: PositionRecord) => `${x.key}|${p.entryIdx}|${p.dir}`
  const mine = new Map(pos.map(o => [key(o.x, o.p), o.p]))
  const kept = best.filter(o => mine.has(key(o.x, o.p)))
  const retBest = best.reduce((s, o) => s + Math.log(1 + o.p.pnl / o.p.equityAtEntry), 0)
  const retKept = kept.reduce((s, o) => { const p = mine.get(key(o.x, o.p))!; return s + Math.log(1 + p.pnl / p.equityAtEntry) }, 0)
  return {
    sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, total: m.totalReturn, pf: gp / -gl, trades: pos.length,
    agitated: pos.filter(o => o.p.set === 1).length,
    timeInMarket: P.mean(ex.map(e => e.timeInMarket)), avgGross: P.mean(ex.map(e => e.avgGross)),
    bestN: best.length, bestKept: kept.length / best.length, bestRetKept: retKept / retBest,
  }
}
const TABLE = {
  portfolio: Object.fromEntries(VS.map(v => [v, { 1: metrics(null, v, 1), 2: metrics(null, v, 2) }])) as unknown as Record<V, Record<number, ReturnType<typeof metrics>>>,
  assets: Object.fromEntries(ASSETS.map(a => [a.key, Object.fromEntries(VS.map(v => [v, { 1: metrics(a, v, 1), 2: metrics(a, v, 2) }]))])) as unknown as Record<string, Record<V, Record<number, ReturnType<typeof metrics>>>>,
}

// Bootstrap par mois des écarts de Sharpe (sommes mensuelles : Σr, Σr², n).
type Agg = { s: Float64Array; q: Float64Array; n: Float64Array }
const aggOf = (d: { days: number[]; r: number[] }, months: Map<number, number>, len: number): Agg => {
  const g = { s: new Float64Array(len), q: new Float64Array(len), n: new Float64Array(len) }
  d.days.forEach((day, i) => { const j = months.get(P.monthKey(day)); if (j === undefined) return; g.s[j] += d.r[i]; g.q[j] += d.r[i] ** 2; g.n[j]++ })
  return g
}
const shOf = (g: Agg, draw: number[]) => { let s = 0, qq = 0, n = 0; for (const j of draw) { s += g.s[j]; qq += g.q[j]; n += g.n[j] } if (n < 30) return NaN; const m = s / n, sd = Math.sqrt(Math.max(qq / n - m * m, 0)); return sd > 0 ? (m / sd) * Math.sqrt(P.ANN) : 0 }
const pm = [...new Set(PORT.V0[1].days.map(P.monthKey))].sort((x, y) => x - y)
const pidx = new Map(pm.map((m, j) => [m, j]))
const um = [...new Set(UN.flatMap(a => RUNS.get(a.key)!.V0[1].daily.days.map(P.monthKey)))].sort((x, y) => x - y)
const uidx = new Map(um.map((m, j) => [m, j]))
const PA = Object.fromEntries(VS.map(v => [v, aggOf(PORT[v][1], pidx, pm.length)])) as Record<V, Agg>
const UA = Object.fromEntries(UN.map(a => [a.key, Object.fromEntries(VS.map(v => [v, aggOf(RUNS.get(a.key)![v][1].daily, uidx, um.length)]))])) as Record<string, Record<V, Agg>>
const R = P.rng(SEED)
const bootP: Record<string, number[]> = Object.fromEntries(TESTED.map(v => [v, []]))
const bootU: Record<string, number[]> = Object.fromEntries(TESTED.map(v => [v, []]))
for (let rep = 0; rep < BOOT; rep++) {
  const dp = Array.from({ length: pm.length }, () => Math.floor(R() * pm.length))
  const du = Array.from({ length: um.length }, () => Math.floor(R() * um.length))
  const p0 = shOf(PA.V0, dp)
  for (const v of TESTED) {
    bootP[v].push(shOf(PA[v], dp) - p0)
    const ds = UN.map(a => shOf(UA[a.key][v], du) - shOf(UA[a.key].V0, du)).filter(Number.isFinite)
    bootU[v].push(P.mean(ds))
  }
}
const READ = TESTED.map(v => {
  const dPort = TABLE.portfolio[v][1].sharpe - TABLE.portfolio.V0[1].sharpe
  const per = UN.map(a => TABLE.assets[a.key][v][1].sharpe - TABLE.assets[a.key].V0[1].sharpe)
  const dUn = P.mean(per)
  const dPort2 = TABLE.portfolio[v][2].sharpe - TABLE.portfolio.V0[2].sharpe
  const dUn2 = P.mean(UN.map(a => TABLE.assets[a.key][v][2].sharpe - TABLE.assets[a.key].V0[2].sharpe))
  const ciP = [q(bootP[v], 0.025), q(bootP[v], 0.975)], ciU = [q(bootU[v], 0.05), q(bootU[v], 0.95)]
  const candidate = dPort > 0 && dUn > 0 && ciU[0] > 0 && per.filter(x => x > 0).length >= 6 && dPort2 > 0 && dUn2 > 0
  return { variant: v, dPort, ciP, dUn, ciU, improved: per.filter(x => x > 0).length, per, dPort2, dUn2, candidate }
})
log('variantes')

// ================================================================ lecture des hypothèses
const dag = (s: string) => DIAG[s][1], dcalm = (s: string) => DIAG[s][0]
const read = (v: V) => READ.find(x => x.variant === v)!
// Trois niveaux : « soutenue » demande le niveau d'une candidate (§ 6) ; « indices » : écarts positifs
// sur les deux échantillons sans ce niveau ; « non soutenue » sinon. Le plan ne chiffrait pas les
// « reprises fréquentes » de D2 : elles sont rapportées, la lecture repose sur les variantes.
const level = (r: (typeof READ)[number], extra: boolean) => (extra && r.candidate ? 'soutenue' : extra && r.dPort > 0 && r.dUn > 0 ? 'indices, non démontrée' : 'non soutenue')
const H = {
  A: level(read('V1'), ['BTC/ETH', '8 cryptos'].every(s => dag(s).cont[2].mean <= 0 && dag(s).cont[3].mean <= 0)),
  B: level(read('V2b'), true),
}

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/agitated-regime.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
writeFileSync(join(OUT, 'agitated-regime.json'), JSON.stringify({ plan: PLAN, generatedAt: new Date().toISOString(), git, checks, diagnostics: DIAG, table: TABLE, reading: READ, hypotheses: H }, (_, v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(8) : v), 1) + '\n')

const avg = (v: V, f: (m: ReturnType<typeof metrics>) => number) => P.mean(UN.map(a => f(TABLE.assets[a.key][v][1])))
const MINUS = '−'
const fin = (x: number) => Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 0) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }
const REG = ['calme (stop 3,3 ATR)', 'agité (stop 1,1 ATR)']

L.push('# Architecture du régime agité du Shock Engine', '')
L.push(`Plan : \`${PLAN}\`, commité avant toute simulation de variante. Script : \`research/shock/agitated-regime.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}). Moteur non modifié. **Exploratoire** : BTC/ETH sont les données de développement et le découpage par régime des 8 cryptos avait déjà été consulté ; aucun résultat n'est confirmatoire.`, '')
L.push('## Réponse', '')
for (const r of READ) L.push(`- **${VLABEL[r.variant]}** : Δ Sharpe BTC/ETH ${sg(r.dPort, 3)} (IC 95 % ${sg(r.ciP[0], 3)} à ${sg(r.ciP[1], 3)}) ; Δ moyen 8 cryptos ${sg(r.dUn, 3)} (IC 90 % ${sg(r.ciU[0], 3)} à ${sg(r.ciU[1], 3)}), ${r.improved}/8 améliorées ; coûts × 2 : ${sg(r.dPort2, 3)} et ${sg(r.dUn2, 3)} → **${r.candidate ? 'candidate pour un test forward' : 'pas de candidate'}**.`)
L.push('', `Hypothèses (lecture du § 6) : A (pas d'alpha de continuation en régime agité) **${H.A}** ; B (stop trop serré) **${H.B}** ; C (combinaison des réglages) n'est pas testée directement.`, '')
{
  const P0 = TABLE.portfolio.V0[1], P1 = TABLE.portfolio.V1[1], P2 = TABLE.portfolio.V2b[1]
  const dA = (key: string, v: V) => TABLE.assets[key][v][1].sharpe - TABLE.assets[key].V0[1].sharpe
  const r1 = read('V1'), r2 = read('V2b')
  const c64 = (s: string, set: number) => DIAG[s][set].cont[3]
  const post = (s: string, set: number) => DIAG[s][set].post[1]
  L.push('## Lecture', '')
  L.push(`- **Sur BTC/ETH, le régime agité coûte.** Sans ses entrées (V1), le portefeuille passe d'un Sharpe ${num(P0.sharpe)} à ${num(P1.sharpe)}, d'un CAGR ${pc(P0.cagr, 1)} à ${pc(P1.cagr, 1)} et d'un drawdown ${pc(P0.maxDD, 1)} à ${pc(P1.maxDD, 1)}, avec ${pc(P1.bestKept)} des meilleurs trades conservés. L'écart vient surtout d'ETH (Δ Sharpe ${sg(dA('ETH', 'V1'))}) plus que de BTC (${sg(dA('BTC', 'V1'))}). Élargir le stop à risque égal (V2b) donne presque autant : Sharpe ${num(P2.sharpe)}, drawdown ${pc(P2.maxDD, 1)}.`)
  L.push(`- **Ce n'est pas transportable.** Sur les 8 cryptos, les écarts de Sharpe vont de ${sg(Math.min(...r1.per))} à ${sg(Math.max(...r1.per))} pour V1 (moyenne ${sg(r1.dUn, 3)}) et de ${sg(Math.min(...r2.per))} à ${sg(Math.max(...r2.per))} pour V2b (moyenne ${sg(r2.dUn, 3)}) ; V1 n'y conserve que ${pc(avg('V1', m => m.bestKept))} des meilleurs trades : sur ces actifs, une partie des plus grands gains naît en régime agité.`)
  L.push(`- **A : il y a de la continuation en régime agité**, plus faible que dans le calme sur BTC/ETH (moyenne à 64 bougies ${sg(c64('BTC/ETH', 1).mean)} ATR contre ${sg(c64('BTC/ETH', 0).mean)}), comparable sur les 8 cryptos (${sg(c64('8 cryptos', 1).mean)} contre ${sg(c64('8 cryptos', 0).mean)}). Les médianes sont proches de zéro ou négatives : elle tient à une minorité de grands mouvements.`)
  L.push(`- **B : le stop serré coupe des trades qui repartent.** 64 bougies après un stop, le prix est au-delà de +1,1 ATR pour ${pc(post('BTC/ETH', 1).above11)} des trades agités stoppés contre ${pc(post('BTC/ETH', 0).above11)} des calmes (BTC/ETH ; ${pc(post('8 cryptos', 1).above11)} contre ${pc(post('8 cryptos', 0).above11)} sur les 8 cryptos). Mais élargir le stop à risque égal n'améliore pas les 8 cryptos de façon démontrable.`)
  L.push(`- **Conclusion.** Le coût du régime agité se concentre sur ETH (Δ Sharpe de V1 ${sg(dA('ETH', 'V1'))}) ; sur BTC, l'actif sur lequel le jeu agité a été choisi (\`research/reports/shock-15m-regimes-vol.md\`), il est neutre (${sg(dA('BTC', 'V1'))}), et sur les 8 cryptos il change de signe d'un actif à l'autre. Rien n'indique un défaut général de l'architecture du régime agité ; aucune variante n'est candidate et V0 reste la référence.`, '')
}

L.push('## Diagnostics (V0, longs)', '')
for (const [s, rows] of Object.entries(DIAG)) {
  L.push(`### ${s}`, '')
  L.push('**D1 · Continuation après le signal**, d·(P_{t+h} − P_t) / ATR d\'entrée, indépendante des sorties (moyenne, IC 95 % bootstrap par mois ; médiane ; part > 0) :', '')
  tbl(['Régime', 'Trades', ...HZ.map(h => `${h} bougie${h > 1 ? 's' : ''}`)], rows.map(r => [REG[r.set], r.n, ...r.cont.map(c => `${sg(c.mean)} [${sg(c.ci[0])} ; ${sg(c.ci[1])}] · méd. ${sg(c.median)} · ${pc(c.pos)}`)]))
  L.push('**D2 · Après le stop initial** (trades sortis au stop seul) : position du prix 16 et 64 bougies après la sortie, en ATR d\'entrée depuis le prix d\'entrée :', '')
  tbl(['Régime', 'Trades stoppés', 'Horizon', 'Médiane', 'Au-delà de +1,1 ATR', 'Au-delà de +3,3 ATR'], rows.flatMap(r => r.post.map(p => [REG[r.set], r.stopped, `+${p.h} bougies`, sg(p.median), pc(p.above11), pc(p.above33)])))
  L.push('**D3 · Excursions en ATR d\'entrée** (quartiles 25 / 50 / 75 %) :', '')
  tbl(['Régime', 'MFE (ATR)', 'MAE (ATR)'], rows.map(r => [REG[r.set], r.mfe.map(x => num(x)).join(' / '), r.mae.map(x => sg(x)).join(' / ')]))
}

L.push('## Variantes rejouées en portefeuille complet', '')
L.push('Coûts × 1 sauf mention. Temps en position et exposition brute (notionnel / equity) : moyenne des sleeves. Meilleurs trades : les 5 % meilleurs rendements de V0, retrouvés à la même bougie d\'entrée et dans le même sens ; part de leur rendement cumulé (ln) conservée.', '')
L.push('### BTC/ETH, portefeuille 50/50 sans rebalancement', '')
const row = (m: ReturnType<typeof metrics>) => [num(m.sharpe), pc(m.cagr, 1), pc(m.maxDD, 1), pc(m.total), num(m.pf), m.trades, m.agitated, pc(m.timeInMarket), num(m.avgGross), `${pc(m.bestKept)} · ${pc(m.bestRetKept)}`]
const head = ['Variante', 'Sharpe', 'CAGR', 'Drawdown max.', 'Rendement total', 'PF', 'Trades', 'dont agités', 'Temps en position', 'Exposition brute moy.', `Meilleurs trades conservés · rendement conservé`]
tbl(head, VS.map(v => [VLABEL[v], ...row(TABLE.portfolio[v][1])]))
tbl(['Variante', 'Sharpe coûts × 2', 'CAGR coûts × 2', 'Drawdown coûts × 2'], VS.map(v => [VLABEL[v], num(TABLE.portfolio[v][2].sharpe), pc(TABLE.portfolio[v][2].cagr, 1), pc(TABLE.portfolio[v][2].maxDD, 1)]))
for (const a of [BTC, ETH]) { L.push(`### ${a.key} seul (${a.key === 'BTC' ? '2017' : '2018-09'} → 2026)`, ''); tbl(head, VS.map(v => [VLABEL[v], ...row(TABLE.assets[a.key][v][1])])) }
L.push('### 8 cryptos (transportabilité)', '')
tbl(['Actif', ...VS.map(v => `Sharpe ${v}`), ...TESTED.map(v => `Δ ${v}`)], UN.map(a => [a.key, ...VS.map(v => num(TABLE.assets[a.key][v][1].sharpe)), ...TESTED.map(v => sg(TABLE.assets[a.key][v][1].sharpe - TABLE.assets[a.key].V0[1].sharpe))]))
tbl(['Moyenne sur 8 cryptos', 'Sharpe', 'CAGR', 'Drawdown max.', 'PF', 'Trades', 'dont agités', 'Temps en position', 'Exposition brute moy.', 'Meilleurs trades conservés'], VS.map(v => [VLABEL[v], num(avg(v, m => m.sharpe)), pc(avg(v, m => m.cagr), 1), pc(avg(v, m => m.maxDD), 1), num(avg(v, m => m.pf)), num(avg(v, m => m.trades), 0), num(avg(v, m => m.agitated), 0), pc(avg(v, m => m.timeInMarket)), num(avg(v, m => m.avgGross)), pc(avg(v, m => m.bestKept))]))
L.push('## Limites', '')
L.push('- Exploratoire : aucune donnée vierge. Une candidate devrait être validée en forward (shadow) avec un plan séparé.')
L.push('- V2a et V2b ne changent que `atrStopMult` du jeu agité ; le TP1 (0,9 ATR sur 20 %) et le stop suiveur (3,2 ATR) restent ceux du jeu agité, ce qui fait partie de l\'hypothèse C.')
L.push('- D1 et D2 mesurent des prix bruts (longs seulement) : ils incluent la dérive haussière des marchés, la même pour les deux régimes.', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/agitated-regime.ts', '```', '')
writeFileSync(join(OUT, 'agitated-regime.md'), L.join('\n'))
log('rapport')
