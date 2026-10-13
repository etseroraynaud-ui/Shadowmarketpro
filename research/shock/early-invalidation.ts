// Invalidation précoce d'un choc qui ne confirme pas (research/preregistration/early-invalidation.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/early-invalidation.ts
//
// Phase 1 : trades V0 encore ouverts 1 à 4 bougies après l'entrée, groupés par ce qui est connu à cet
// instant (confirmation, retracement du choc, réintégration, volume), avec l'issue finale et la
// valeur d'une sortie à cet instant. Phase 2 : une seule règle fixée d'avance (fermeture à la clôture
// de la 4e bougie si le prix n'a pas dépassé l'entrée) rejouée en portefeuille complet ; 2 et 8
// bougies en sensibilité descriptive. Le moteur n'est pas modifié. Sorties :
// research/reports/early-invalidation/.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, UNSEEN, measures, referenceAsset, tradeR, unseenAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { dailyOf } from '../lib/variant-eval.ts'
import { exitValueR, landmark, simulateEarlyExit } from '../lib/early-exit.ts'
import type { EarlyRun, Landmark } from '../lib/early-exit.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/early-invalidation')
const PLAN = 'research/preregistration/early-invalidation.md'
const DAY = 864e5
const SEED = 20261013, BOOT1 = 2000, BOOT2 = 5000
const KS = [1, 2, 3, 4]
const BIG = 3
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
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha(readFileSync(join(ROOT, f))) === h, f)

// ================================================================ simulations
const ASSETS: Asset[] = [referenceAsset('btc'), referenceAsset('ethusdt'), ...UNSEEN.map(unseenAsset)]
const BTC = ASSETS[0], ETH = ASSETS[1], UN = ASSETS.slice(2)
type V = 'V0' | 'V1' | 'S2' | 'S8'
const RULE: Record<V, number | null> = { V0: null, V1: 4, S2: 2, S8: 8 }
const VLABEL: Record<V, string> = { V0: 'V0 · E2 inchangé', V1: 'V1 · invalidation à 1 h (4 bougies)', S2: 'sensibilité · 30 min (2 bougies)', S8: 'sensibilité · 2 h (8 bougies)' }
for (const a of [BTC, UN[0]]) {
  const r0 = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)
  const r1 = simulateEarlyExit(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, null)
  check(`${a.key} : boucle sans règle = simulate()`, JSON.stringify(Array.from(r0.equity)) === JSON.stringify(Array.from(r1.equity)) && JSON.stringify(r0.positions) === JSON.stringify(r1.positions), `${r0.positions.length} positions`)
}
interface Run { run: EarlyRun; daily: { days: number[]; r: number[]; a: number; z: number } }
const RUNS = new Map<string, Partial<Record<V, Record<number, Run>>>>()
for (const a of ASSETS) {
  const rs: Partial<Record<V, Record<number, Run>>> = {}
  for (const v of ['V0', 'V1', 'S2', 'S8'] as V[]) {
    rs[v] = {}
    for (const k of v === 'V0' || v === 'V1' ? [1, 2] : [1]) {
      const run = simulateEarlyExit(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, a.signals, RULE[v])
      rs[v]![k] = { run, daily: dailyOf(a.bars, run.equity, a.lo, a.end) }
    }
  }
  RUNS.set(a.key, rs)
  log(`${a.key} : V0 ${rs.V0![1].run.positions.length}, V1 ${rs.V1![1].run.positions.length} positions (${rs.V1![1].run.early.size} invalidées)`)
}
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const inRef = (a: Asset, p: PositionRecord) => a.unseen || (a.bars.t[p.entryIdx] >= REF[0] && a.bars.t[p.entryIdx] < REF[1])
for (const [a, n] of [[BTC, 644], [ETH, 667]] as const) check(`${a.key} : V0 = trades publiés`, RUNS.get(a.key)!.V0![1].run.positions.filter(p => inRef(a, p) && !p.exits.includes('END')).length === n, String(n))
const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo]), tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const portfolio = (v: V, k: number) => {
  const b = dailyOf(BTC.bars, RUNS.get('BTC')![v]![k].run.equity, BTC.lo, BTC.end, PD0, PD1)
  const e = dailyOf(ETH.bars, RUNS.get('ETH')![v]![k].run.equity, ETH.lo, ETH.end, PD0, PD1)
  return { days: b.days, r: P.book(b.r, e.r).r }
}
const pub = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'), 'utf8')).headline.portfolioSharpe
check('BTC/ETH : Sharpe de V0 = Sharpe publié', Math.abs(P.dailyMetrics(portfolio('V0', 1).r, portfolio('V0', 1).days).sharpe - pub) < 1e-9, String(pub))
log('contrôles')

// ================================================================ phase 1 : trades encore ouverts à k
interface Obs { asset: string; month: number; R: number; feesR: number; lm: Landmark[]; exitR: number[] }
function obsOf(a: Asset): Obs[] {
  const M = measures(a)
  return RUNS.get(a.key)!.V0![1].run.positions.filter(p => inRef(a, p) && !p.exits.includes('END')).map(p => {
    const S = a.preset.sets[p.set]
    const x = tradeR(p, a.preset.sets, a.mintick, a.bars.t)
    const feesR = p.fees / (p.qty * x.stopDist)
    const level = p.dir === 1 ? M.hhPrev[p.set][p.entryIdx] : M.llPrev[p.set][p.entryIdx]
    const lm = KS.map(k => landmark(a.bars, p, k, level, S))
    return { asset: a.key, month: P.monthKey(Math.floor(a.bars.t[p.entryIdx] / DAY)), R: x.R, feesR, lm, exitR: lm.map(l => exitValueR(l, S, feesR)) }
  })
}
const SAMPLES: Record<string, Obs[]> = { 'BTC/ETH': [...obsOf(BTC), ...obsOf(ETH)], '8 cryptos': UN.flatMap(obsOf) }
check('BTC/ETH : 1 311 trades', SAMPLES['BTC/ETH'].length === 1311, String(SAMPLES['BTC/ETH'].length))
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
function bootSum(os: Obs[], f: (o: Obs) => number): [number, number] {
  const months = [...new Set(os.map(o => o.month))].sort((x, y) => x - y)
  const idx = new Map(months.map((m, j) => [m, j]))
  const S = new Float64Array(months.length)
  for (const o of os) S[idx.get(o.month)!] += f(o)
  const R = P.rng(SEED)
  const out: number[] = []
  for (let r = 0; r < BOOT1; r++) { let s = 0; for (let k = 0; k < months.length; k++) s += S[Math.floor(R() * months.length)]; out.push(s) }
  return [P.quantile(out, 0.025), P.quantile(out, 0.975)]
}
function phase1(os: Obs[]) {
  return KS.map((k, j) => {
    const pop = os.filter(o => o.lm[j].open)
    const medVol = P.quantile(pop.map(o => o.lm[j].volRatio), 0.5)
    const nBig = pop.filter(o => o.R >= BIG).length
    const grp = (label: string, f: (l: Landmark) => boolean) => {
      const g = pop.filter(o => f(o.lm[j]))
      const val = (o: Obs) => o.exitR[j] - o.R
      return {
        label, n: g.length, share: g.length / pop.length, pLoser: g.filter(o => o.R <= 0).length / g.length, pBig: g.filter(o => o.R >= BIG).length / g.length,
        bigShare: g.filter(o => o.R >= BIG).length / nBig, meanR: P.mean(g.map(o => o.R)), meanRetR: P.mean(g.map(o => o.lm[j].retR)),
        meanValue: P.mean(g.map(val)), sumValue: sum(g.map(val)), ci: bootSum(g, val),
        // décomposition de la valeur totale selon l'issue finale
        sumLosers: sum(g.filter(o => o.R <= 0).map(val)), sumWinners: sum(g.filter(o => o.R > 0).map(val)), sumBig: sum(g.filter(o => o.R >= BIG).map(val)),
      }
    }
    return {
      k, open: pop.length, openShare: pop.length / os.length, pLoser: pop.filter(o => o.R <= 0).length / pop.length, pBig: nBig / pop.length,
      groups: [
        grp('rendement ≤ 0 (non confirmé)', l => l.retR <= 0), grp('rendement > 0', l => l.retR > 0),
        grp('réintégré sous le niveau cassé', l => l.reentered), grp('au-delà du niveau cassé', l => !l.reentered),
        grp('choc retracé ≥ 50 %', l => l.retrace >= 0.5), grp('choc retracé < 50 %', l => l.retrace < 0.5),
        grp('volume après choc < médiane', l => l.volRatio < medVol), grp('volume après choc ≥ médiane', l => l.volRatio >= medVol),
      ],
    }
  })
}
const PH1 = Object.fromEntries(Object.entries(SAMPLES).map(([s, os]) => [s, phase1(os)]))
log('phase 1')

// ================================================================ phase 2 : variante rejouée
function metrics(a: Asset | null, v: V, k: number) {
  const list = a ? [a] : [BTC, ETH]
  const d = a ? RUNS.get(a.key)![v]![k].daily : portfolio(v, k)
  const m = P.dailyMetrics(d.r, d.days)
  const pos = list.flatMap(x => RUNS.get(x.key)![v]![k].run.positions.filter(p => !p.exits.includes('END') && inRef(x, p)).map(p => ({ x, p })))
  const ret = (p: PositionRecord) => p.pnl / p.equityAtEntry
  const gp = sum(pos.filter(o => o.p.pnl > 0).map(o => ret(o.p))), gl = sum(pos.filter(o => o.p.pnl <= 0).map(o => ret(o.p)))
  const cut = (o: { x: Asset; p: PositionRecord }) => RUNS.get(o.x.key)![v]![k].run.early.has(o.p.entryIdx)
  const early = pos.filter(cut).length
  const tim = P.mean(list.map(x => { const r = RUNS.get(x.key)![v]![k]; let c = 0; for (let i = r.daily.a; i <= r.daily.z; i++) if (r.run.position[i] !== 0) c++; return c / (r.daily.z - r.daily.a + 1) }))
  const top = list.flatMap(x => RUNS.get(x.key)!.V0![k].run.positions.filter(p => !p.exits.includes('END') && inRef(x, p)).map(p => ({ x, p }))).sort((u, w) => ret(w.p) - ret(u.p))
  const best = top.slice(0, Math.max(1, Math.round(top.length * 0.05)))
  const mine = new Map(pos.map(o => [`${o.x.key}|${o.p.entryIdx}|${o.p.dir}`, o.p]))
  const kept = best.filter(o => mine.has(`${o.x.key}|${o.p.entryIdx}|${o.p.dir}`))
  const bestCut = kept.filter(cut).length / best.length
  const lb = sum(best.map(o => Math.log(1 + ret(o.p)))), lk = sum(kept.map(o => Math.log(1 + ret(mine.get(`${o.x.key}|${o.p.entryIdx}|${o.p.dir}`)!))))
  return { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, total: m.totalReturn, pf: gp / -gl, trades: pos.length, early, timeInMarket: tim, bestKept: kept.length / best.length, bestCut, bestRetKept: lb > 0 ? lk / lb : NaN }
}
const VS: V[] = ['V0', 'V1', 'S2', 'S8']
const TABLE = {
  portfolio: Object.fromEntries(VS.map(v => [v, metrics(null, v, 1)])) as Record<V, ReturnType<typeof metrics>>,
  portfolio2: { V0: metrics(null, 'V0', 2), V1: metrics(null, 'V1', 2) },
  assets: Object.fromEntries(ASSETS.map(a => [a.key, Object.fromEntries(VS.map(v => [v, metrics(a, v, 1)]))])) as Record<string, Record<V, ReturnType<typeof metrics>>>,
  assets2: Object.fromEntries(UN.map(a => [a.key, { V0: metrics(a, 'V0', 2), V1: metrics(a, 'V1', 2) }])),
}
type Agg = { s: Float64Array; q: Float64Array; n: Float64Array }
const aggOf = (d: { days: number[]; r: number[] }, months: Map<number, number>, len: number): Agg => { const g = { s: new Float64Array(len), q: new Float64Array(len), n: new Float64Array(len) }; d.days.forEach((day, i) => { const j = months.get(P.monthKey(day)); if (j === undefined) return; g.s[j] += d.r[i]; g.q[j] += d.r[i] ** 2; g.n[j]++ }); return g }
const shOf = (g: Agg, draw: number[]) => { let s = 0, qq = 0, n = 0; for (const j of draw) { s += g.s[j]; qq += g.q[j]; n += g.n[j] } if (n < 30) return NaN; const m = s / n, sd = Math.sqrt(Math.max(qq / n - m * m, 0)); return sd > 0 ? (m / sd) * Math.sqrt(P.ANN) : 0 }
const pm = [...new Set(portfolio('V0', 1).days.map(P.monthKey))].sort((x, y) => x - y), pidx = new Map(pm.map((m, j) => [m, j]))
const um = [...new Set(UN.flatMap(a => RUNS.get(a.key)!.V0![1].daily.days.map(P.monthKey)))].sort((x, y) => x - y), uidx = new Map(um.map((m, j) => [m, j]))
const PA = { V0: aggOf(portfolio('V0', 1), pidx, pm.length), V1: aggOf(portfolio('V1', 1), pidx, pm.length) }
const UA = Object.fromEntries(UN.map(a => [a.key, { V0: aggOf(RUNS.get(a.key)!.V0![1].daily, uidx, um.length), V1: aggOf(RUNS.get(a.key)!.V1![1].daily, uidx, um.length) }]))
const R = P.rng(SEED)
const bp: number[] = [], bu: number[] = []
for (let rep = 0; rep < BOOT2; rep++) {
  const dp = Array.from({ length: pm.length }, () => Math.floor(R() * pm.length)), du = Array.from({ length: um.length }, () => Math.floor(R() * um.length))
  bp.push(shOf(PA.V1, dp) - shOf(PA.V0, dp))
  bu.push(P.mean(UN.map(a => shOf(UA[a.key].V1, du) - shOf(UA[a.key].V0, du)).filter(Number.isFinite)))
}
const per = UN.map(a => TABLE.assets[a.key].V1.sharpe - TABLE.assets[a.key].V0.sharpe)
const READ = {
  dPort: TABLE.portfolio.V1.sharpe - TABLE.portfolio.V0.sharpe, ciP: [P.quantile(bp, 0.025), P.quantile(bp, 0.975)],
  dUn: P.mean(per), ciU: [P.quantile(bu, 0.05), P.quantile(bu, 0.95)], improved: per.filter(x => x > 0).length, per,
  dPort2: TABLE.portfolio2.V1.sharpe - TABLE.portfolio2.V0.sharpe, dUn2: P.mean(UN.map(a => TABLE.assets2[a.key].V1.sharpe - TABLE.assets2[a.key].V0.sharpe)),
  candidate: false,
}
READ.candidate = READ.dPort > 0 && READ.dUn > 0 && READ.ciU[0] > 0 && READ.improved >= 6 && READ.dPort2 > 0 && READ.dUn2 > 0
log('phase 2')

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/early-invalidation.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
writeFileSync(join(OUT, 'early-invalidation.json'), JSON.stringify({ plan: PLAN, generatedAt: new Date().toISOString(), git, checks, phase1: PH1, table: TABLE, reading: READ }, (_, v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(8) : v), 1) + '\n')
const MINUS = '−'
const fin = (x: number) => Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 0) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }
const g4 = (s: string) => PH1[s][3].groups[0]
L.push('# Invalidation précoce d\'un choc qui ne confirme pas', '')
L.push(`Plan : \`${PLAN}\`, commité avant tout calcul. Script : \`research/shock/early-invalidation.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}). Moteur non modifié. Exploratoire : BTC/ETH (développement) et 8 cryptos déjà consultées.`, '')
L.push('## Réponse', '')
L.push(`**${VLABEL.V1}** : Δ Sharpe BTC/ETH ${sg(READ.dPort, 3)} (IC 95 % ${sg(READ.ciP[0], 3)} à ${sg(READ.ciP[1], 3)}) ; Δ moyen 8 cryptos ${sg(READ.dUn, 3)} (IC 90 % ${sg(READ.ciU[0], 3)} à ${sg(READ.ciU[1], 3)}), ${READ.improved}/8 améliorées ; coûts × 2 : ${sg(READ.dPort2, 3)} et ${sg(READ.dUn2, 3)} → **${READ.candidate ? 'candidate pour un test forward' : 'pas de candidate'}**.`, '')
L.push(`Avant tout rejeu, sur les trades encore ouverts après 4 bougies : ${pc(g4('BTC/ETH').share)} n'ont pas confirmé (BTC/ETH ; ${pc(g4('8 cryptos').share)} sur les 8 cryptos). Parmi eux, ${pc(g4('BTC/ETH').pLoser)} finissent perdants, mais ${pc(g4('BTC/ETH').pBig)} deviennent de grands gagnants (R ≥ 3), soit ${pc(g4('BTC/ETH').bigShare)} de tous les grands gagnants encore ouverts à cet instant. Les fermer à cet instant aurait rapporté ${sg(g4('BTC/ETH').sumValue, 0)} R (IC 95 % ${sg(g4('BTC/ETH').ci[0], 0)} à ${sg(g4('BTC/ETH').ci[1], 0)}) sur BTC/ETH et ${sg(g4('8 cryptos').sumValue, 0)} R (${sg(g4('8 cryptos').ci[0], 0)} à ${sg(g4('8 cryptos').ci[1], 0)}) sur les 8 cryptos (premier ordre, sans rejeu).`, '')
for (const [s, rows] of Object.entries(PH1)) {
  L.push(`## Phase 1 · ${s} : trades encore ouverts k bougies après l'entrée`, '')
  tbl(['k', 'Encore ouverts', 'Part des trades', 'P(perdant)', 'P(grand gagnant, R ≥ 3)'], rows.map(r => [r.k, r.open, pc(r.openShare), pc(r.pLoser), pc(r.pBig)]))
  for (const r of rows) {
    L.push(`**k = ${r.k}** (${r.open} trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + ${r.k} − R final ; > 0 : couper aurait rapporté.`, '')
    tbl(['Groupe (connu à la clôture de i + k)', 'Trades', 'Part', 'P(perdant)', 'P(grand gagnant)', 'Part des grands gagnants ouverts', 'R final moyen', 'R à cet instant', 'Valeur moyenne de la sortie', 'Valeur totale [IC 95 %]'],
      r.groups.map(g => [g.label, g.n, pc(g.share), pc(g.pLoser), pc(g.pBig), pc(g.bigShare), sg(g.meanR), sg(g.meanRetR), sg(g.meanValue), `${sg(g.sumValue, 0)} [${sg(g.ci[0], 0)} ; ${sg(g.ci[1], 0)}]`]))
  }
}
L.push('## Phase 2 · règle rejouée en portefeuille complet', '')
const row = (m: ReturnType<typeof metrics>) => [num(m.sharpe), pc(m.cagr, 1), pc(m.maxDD, 1), pc(m.total), num(m.pf), m.trades, m.early, pc(m.timeInMarket), `${pc(m.bestKept)} · ${pc(m.bestCut)} · ${pc(m.bestRetKept)}`]
const head = ['Variante', 'Sharpe', 'CAGR', 'Drawdown max.', 'Rendement total', 'PF', 'Trades', 'Invalidés', 'Temps en position', '5 % meilleurs trades V0 : présents · coupés par la règle · rendement conservé']
L.push('### BTC/ETH, portefeuille 50/50 sans rebalancement', '')
tbl(head, VS.map(v => [VLABEL[v], ...row(TABLE.portfolio[v])]))
tbl(['Coûts × 2', 'Sharpe', 'CAGR', 'Drawdown max.'], (['V0', 'V1'] as V[]).map(v => [VLABEL[v], num(TABLE.portfolio2[v as 'V0' | 'V1'].sharpe), pc(TABLE.portfolio2[v as 'V0' | 'V1'].cagr, 1), pc(TABLE.portfolio2[v as 'V0' | 'V1'].maxDD, 1)]))
L.push('### 8 cryptos', '')
tbl(['Actif', ...VS.map(v => `Sharpe ${v}`), 'Δ V1', 'Invalidés (V1)', 'Meilleurs trades coupés (V1)', 'Rendement des meilleurs conservé (V1)'], UN.map(a => [a.key, ...VS.map(v => num(TABLE.assets[a.key][v].sharpe)), sg(TABLE.assets[a.key].V1.sharpe - TABLE.assets[a.key].V0.sharpe), TABLE.assets[a.key].V1.early, pc(TABLE.assets[a.key].V1.bestCut), pc(TABLE.assets[a.key].V1.bestRetKept)]))
const avg = (v: V, f: (m: ReturnType<typeof metrics>) => number) => P.mean(UN.map(a => f(TABLE.assets[a.key][v])))
tbl(['Moyenne 8 cryptos', 'Sharpe', 'CAGR', 'Drawdown max.', 'PF', 'Trades', 'Invalidés', 'Temps en position', 'Meilleurs trades coupés', 'Rendement des meilleurs conservé'], VS.map(v => [VLABEL[v], num(avg(v, m => m.sharpe)), pc(avg(v, m => m.cagr), 1), pc(avg(v, m => m.maxDD), 1), num(avg(v, m => m.pf)), num(avg(v, m => m.trades), 0), num(avg(v, m => m.early), 0), pc(avg(v, m => m.timeInMarket)), pc(avg(v, m => m.bestCut)), pc(avg(v, m => m.bestRetKept))]))
L.push('## Lecture', '')
{
  const [nb, nu] = [PH1['BTC/ETH'][3].groups, PH1['8 cryptos'][3].groups]
  const any = (gs: typeof nb, j: number) => gs[j].ci[0] > 0 ? 'positive' : gs[j].ci[1] < 0 ? 'négative' : 'non distinguable de zéro'
  const side = [any(nb, 2), any(nb, 4), any(nu, 2), any(nu, 4)]
  const sideTxt = side.every(x => x === side[0]) ? `${side[0]} sur les deux échantillons` : `${side[0]} et ${side[1]} (BTC/ETH), ${side[2]} et ${side[3]} (8 cryptos)`
  L.push(`- **L'information existe.** À la clôture de la 4e bougie, un trade qui n'a pas confirmé finit perdant dans ${pc(nb[0].pLoser)} des cas contre ${pc(nb[1].pLoser)} pour un trade en gain (8 cryptos : ${pc(nu[0].pLoser)} contre ${pc(nu[1].pLoser)}). La réintégration du niveau cassé et un retracement d'au moins la moitié du choc isolent des groupes encore plus perdants (${pc(nb[2].pLoser)} et ${pc(nb[4].pLoser)}), mais petits (${pc(nb[2].share)} et ${pc(nb[4].share)} des trades ouverts).`)
  L.push(`- **Agir dessus ne rapporte pas.** Les trades non confirmés sont en moyenne à ${sg(nb[0].meanRetR)} R à cet instant (BTC/ETH ; ${sg(nu[0].meanRetR)} R sur les 8 cryptos), mais leur R final moyen est ${sg(nb[0].meanR)} R (${sg(nu[0].meanR)} R). Les couper à cet instant épargnerait ${sg(nb[0].sumLosers, 0)} R sur les futurs perdants et coûterait ${sg(nb[0].sumWinners, 0)} R sur les futurs gagnants, dont ${sg(nb[0].sumBig, 0)} R sur les seuls grands gagnants (${pc(nb[0].pBig)} du groupe) ; 8 cryptos : ${sg(nu[0].sumLosers, 0)}, ${sg(nu[0].sumWinners, 0)} et ${sg(nu[0].sumBig, 0)} R. Valeur totale ${any(nb, 0)} sur BTC/ETH, ${any(nu, 0)} sur les 8 cryptos. Groupes « réintégré » et « retracé ≥ 50 % » : ${sideTxt}.`)
  const p = TABLE.portfolio
  L.push(`- **Le rejeu le confirme.** V1 ferme ${p.V1.early} positions sur BTC/ETH, réduit le temps en position (${pc(p.V0.timeInMarket)} → ${pc(p.V1.timeInMarket)}) et le drawdown (${pc(p.V0.maxDD, 1)} → ${pc(p.V1.maxDD, 1)}), mais le CAGR baisse (${pc(p.V0.cagr, 1)} → ${pc(p.V1.cagr, 1)}) et ${pc(p.V1.bestCut)} des 5 % meilleurs trades de V0 sont coupés par la règle ; le Sharpe varie de ${sg(READ.dPort, 3)} (IC 95 % ${sg(READ.ciP[0], 3)} à ${sg(READ.ciP[1], 3)}). Sur les 8 cryptos, ${READ.improved}/8 s'améliorent et l'écart moyen est ${sg(READ.dUn, 3)}. Les délais de 2 et 8 bougies ne font pas mieux (Sharpe BTC/ETH ${num(p.S2.sharpe)} et ${num(p.S8.sharpe)}).`)
  L.push(`- **Conclusion** : ${READ.candidate ? 'V1 remplit la règle fixée d\'avance ; candidate pour un test forward pré-enregistré, pas pour la production.' : 'la règle fixée d\'avance n\'est pas remplie. Un choc qui ne confirme pas dans la première heure est le plus souvent perdu, mais l\'invalider plus tôt ne crée pas de valeur : ce qui est épargné sur les perdants est rendu sur la minorité qui confirme tard. Shock Engine reste inchangé.'}`, '')
}
L.push('## Limites', '')
L.push('- Exploratoire, aucune donnée vierge. Phase 1 : valeur d\'une sortie de premier ordre (TP1 approché par les extrêmes des bougies, commissions du trade réel), sans rejeu ; la phase 2 rejoue tout.')
L.push('- Population P_k : trades encore ouverts une fois la bougie i + k jouée ; une fermeture du script à la clôture même de i + k (flip) les exclut.')
L.push('- La valeur de premier ordre ignore les entrées que libère une sortie anticipée ; le rejeu les inclut (plus de trades en V1 qu\'en V0).')
L.push('- « Meilleurs trades » : 5 % des trades de V0 au plus fort rendement ; présents = même bougie d\'entrée et même sens dans la variante ; rendement conservé = somme des log-rendements de ces trades dans la variante / dans V0.', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/early-invalidation.ts', '```', '')
writeFileSync(join(OUT, 'early-invalidation.md'), L.join('\n'))
log('rapport')
