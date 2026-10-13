// Fiche de référence de Shock Engine V1 (régime calme seul), retenue le 2026-10-13, et de son
// benchmark historique E2 (deux régimes).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/reference.ts
//
// Recalcule les indicateurs de référence depuis le moteur figé (aucun chiffre recopié), les contrôle
// contre les rapports publiés, et écrit research/reports/reference/ : fiche (md, json) et rendements
// journaliers du portefeuille BTC/ETH 50/50. Le moteur, le bot et le site ne sont pas modifiés.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, referenceAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { dailyOf } from '../lib/variant-eval.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../lib/calm-only.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/reference')
const DAY = 864e5
const DECIDED = '2026-10-13'
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
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha(readFileSync(join(ROOT, f))) === h, f)

// ================================================================ rejeu
const A = [referenceAsset('btc'), referenceAsset('ethusdt')]
type S = 'v1' | 'e2'
const OVR: Record<S, (a: Asset) => ReturnType<typeof calmOnly>> = { v1: a => calmOnly(a.signals, a.select), e2: a => a.signals }
const RUN = new Map<string, ShockResult>()
for (const s of ['v1', 'e2'] as S[]) for (const a of A) for (const k of [1, 2]) RUN.set(`${s}|${a.key}|${k}`, simulate(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, OVR[s](a)))
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const sleeve = (s: S, a: Asset, k: number) => dailyOf(a.bars, RUN.get(`${s}|${a.key}|${k}`)!.equity, a.lo, a.end, PD0, PD1)
const trades = (s: S, a: Asset) => RUN.get(`${s}|${a.key}|1`)!.positions.filter(p => !p.exits.includes('END') && a.bars.t[p.entryIdx] >= REF[0] && a.bars.t[p.entryIdx] < REF[1])

function card(s: S) {
  const sl = A.map(a => sleeve(s, a, 1)), sl2 = A.map(a => sleeve(s, a, 2))
  const days = sl[0].days
  const port = P.book(sl[0].r, sl[1].r).r, port2 = P.book(sl2[0].r, sl2[1].r).r
  const m = P.dailyMetrics(port, days), m2 = P.dailyMetrics(port2, days)
  const tr = A.map(a => trades(s, a))
  const ret = (p: PositionRecord) => p.pnl / p.equityAtEntry
  const all = tr.flat()
  const gp = P.sum(all.filter(p => p.pnl > 0).map(ret)), gl = P.sum(all.filter(p => p.pnl <= 0).map(ret))
  const tim = A.map((a, j) => { const r = RUN.get(`${s}|${a.key}|1`)!; let c = 0; for (let i = sl[j].a; i <= sl[j].z; i++) if (r.position[i] !== 0) c++; return c / (sl[j].z - sl[j].a + 1) })
  return {
    days, port,
    sleeves: A.map((a, j) => ({ key: a.key, sharpe: P.dailyMetrics(sl[j].r, days).sharpe, r: sl[j].r, trades: tr[j].length, winRate: tr[j].filter(p => p.pnl > 0).length / tr[j].length })),
    sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD, totalReturn: m.totalReturn, vol: m.vol, sortino: m.sortino, calmar: m.calmar,
    profitFactor: gp / -gl, trades: all.length, winRate: all.filter(p => p.pnl > 0).length / all.length, timeInMarket: P.mean(tim),
    worstMonth: m.worstMonth, sharpeCosts2: m2.sharpe, cagrCosts2: m2.cagr,
  }
}
const V1 = card('v1'), E2 = card('e2')
check('fenêtre commune 2018-09-01 → 2026-09-30', P.isoDay(V1.days[0]) === '2018-09-01' && P.isoDay(V1.days.at(-1)!) === '2026-09-30', `${V1.days.length} jours`)
const pubE2 = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'), 'utf8')).headline
check('E2 : Sharpe, CAGR et drawdown du portefeuille publié', Math.abs(E2.sharpe - pubE2.portfolioSharpe) < 1e-9 && Math.abs(E2.cagr - pubE2.portfolioCagr) < 1e-9 && Math.abs(E2.maxDD - pubE2.portfolioMaxDD) < 1e-9, `${pubE2.portfolioSharpe} · ${pubE2.portfolioCagr} · ${pubE2.portfolioMaxDD}`)
check('E2 : trades publiés (644 + 667)', E2.sleeves[0].trades === 644 && E2.sleeves[1].trades === 667, `${E2.sleeves[0].trades} + ${E2.sleeves[1].trades}`)
check('V1 : valeurs figées (CALM_ONLY_REFERENCE)', Math.abs(V1.sharpe - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) < 1e-6 && Math.abs(V1.sharpeCosts2 - CALM_ONLY_REFERENCE.portfolio.costs2.sharpe) < 1e-6 && V1.trades === CALM_ONLY_REFERENCE.portfolio.costs1.trades, `${V1.sharpe} · ${V1.sharpeCosts2} · ${V1.trades}`)
const AG = JSON.parse(readFileSync(join(ROOT, 'research/reports/agitated-regime/agitated-regime.json'), 'utf8')).table.portfolio
check('V1 : CAGR, drawdown et profit factor publiés (étude du régime agité)', Math.abs(V1.cagr - AG.V1[1].cagr) < 1e-6 && Math.abs(V1.maxDD - AG.V1[1].maxDD) < 1e-6 && Math.abs(V1.profitFactor - AG.V1[1].pf) < 1e-6, `${AG.V1[1].cagr} · ${AG.V1[1].maxDD} · ${AG.V1[1].pf}`)
const CO = JSON.parse(readFileSync(join(ROOT, 'research/reports/calm-only/calm-only.json'), 'utf8'))
const VAL = { pbo: CO.cscv.main.pbo as number, verdict: CO.reading.verdict as string, dsrGain: CO.dsr.diff.p as number, dsrGain2: CO.dsr.diff2.p as number, wfDelta: (CO.walkForward.oos.calm - CO.walkForward.oos.e2) as number, ciWf: CO.walkForward.ciCalm as number[], breakevenV1: CO.dsr.calm.breakevenB as number, breakevenE2: CO.dsr.e2.breakevenB as number, yearsBetter: (CO.walkForward.years as { calm: number; e2: number }[]).filter(y => y.calm > y.e2).length, years: (CO.walkForward.years as unknown[]).length }

// ================================================================ sorties
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/reference.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
const strip = (c: ReturnType<typeof card>) => { const { days: _d, port: _p, sleeves, ...rest } = c; return { ...rest, sleeves: sleeves.map(({ r: _r, ...x }) => x) } }
writeFileSync(join(OUT, 'reference.json'), JSON.stringify({
  schema: 'shock-engine-reference/1', decidedOn: DECIDED, status: 'HISTORICAL SIMULATION · in-sample', generatedAt: new Date().toISOString(), git, checks,
  reference: { name: 'Shock Engine V1 (régime calme seul)', definition: 'E2 sans nouvelles entrées en régime agité (research/lib/calm-only.ts)', ...strip(V1) },
  benchmark: { name: 'E2 (deux régimes)', ...strip(E2) },
  validation: VAL,
}, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(10) : String(v)) : v), 1) + '\n')
const csv = ['date,v1_btc,v1_eth,v1_portfolio,e2_btc,e2_eth,e2_portfolio', ...V1.days.map((d, i) => [P.isoDay(d), V1.sleeves[0].r[i], V1.sleeves[1].r[i], V1.port[i], E2.sleeves[0].r[i], E2.sleeves[1].r[i], E2.port[i]].map(x => (typeof x === 'number' ? x.toPrecision(12) : x)).join(','))]
writeFileSync(join(OUT, 'reference_daily_returns.csv'), csv.join('\n') + '\n')

const MINUS = '−'
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`)
const sg = (x: number, d = 3) => fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`)
const pc = (x: number, d = 1) => fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`)
const int = (x: number) => String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }
L.push('# Shock Engine V1 — fiche de référence', '')
L.push(`**Retenue le ${DECIDED}** comme version de référence de Shock Engine ; E2 (deux régimes) devient son benchmark historique. Générée par \`research/shock/reference.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}) : chaque chiffre est recalculé depuis le moteur figé et contrôlé contre les rapports publiés. **Simulation historique après coûts modélisés, pas une performance live.**`, '')
L.push('## Définition', '')
L.push('- **E2 inchangée** : mêmes deux jeux de réglages (préréglage adaptatif 15 min choisi sur BTC, appliqué tel quel à ETH), même filtre de tendance journalière baissière sur les shorts, mêmes sorties, même taille.')
L.push('- **Une seule différence** : aucune nouvelle entrée quand la bougie de signal est en régime agité. Le jeu agité n\'autorisant que des longs, seules des entrées longues disparaissent ; une position ouverte en régime calme garde ses sorties si le régime change.')
L.push('- Portefeuille BTC/ETH 50/50 sans rebalancement, commission 0,045 % par ordre, fenêtre 2018-09-01 → 2026-09-30.')
L.push('- Code : `calmOnly()` dans `research/lib/calm-only.ts`. Nom à ne pas confondre avec la **v1 historique** du dépôt (miroir short sans condition, `research/reports/btc-eth-portfolio/`).', '')
L.push('## Indicateurs', '')
tbl(['Indicateur', 'Shock Engine V1', 'E2 (benchmark)'], [
  ['Sharpe', `**${num(V1.sharpe)}**`, num(E2.sharpe)],
  ['CAGR', `**${pc(V1.cagr)}**`, pc(E2.cagr)],
  ['Drawdown maximal', `**${pc(V1.maxDD)}**`, pc(E2.maxDD)],
  ['Profit factor (rendements des trades)', `**${num(V1.profitFactor)}**`, num(E2.profitFactor)],
  ['Trades (BTC + ETH)', `**${int(V1.trades)}** (${V1.sleeves[0].trades} + ${V1.sleeves[1].trades})`, `${int(E2.trades)} (${E2.sleeves[0].trades} + ${E2.sleeves[1].trades})`],
  ['Taux de réussite', pc(V1.winRate, 0), pc(E2.winRate, 0)],
  ['Sharpe avec commissions doublées', `**${num(V1.sharpeCosts2)}**`, num(E2.sharpeCosts2)],
  ['CAGR avec commissions doublées', pc(V1.cagrCosts2), pc(E2.cagrCosts2)],
  ['Rendement total', pc(V1.totalReturn, 0), pc(E2.totalReturn, 0)],
  ['Volatilité annuelle', pc(V1.vol), pc(E2.vol)],
  ['Sortino · Calmar', `${num(V1.sortino)} · ${num(V1.calmar)}`, `${num(E2.sortino)} · ${num(E2.calmar)}`],
  ['Pire mois', `${pc(V1.worstMonth.ret)} (${P.monthLabel(V1.worstMonth.key)})`, `${pc(E2.worstMonth.ret)} (${P.monthLabel(E2.worstMonth.key)})`],
  ['Temps en position (moyenne des deux sleeves)', pc(V1.timeInMarket, 0), pc(E2.timeInMarket, 0)],
  ['Sharpe BTC · ETH', `${num(V1.sleeves[0].sharpe)} · ${num(V1.sleeves[1].sharpe)}`, `${num(E2.sleeves[0].sharpe)} · ${num(E2.sleeves[1].sharpe)}`],
  ['CSCV-PBO (16 configurations)', `**${pc(VAL.pbo)}**`, '—'],
])
L.push('## Statut de validation', '')
L.push(`- **Historique, dans l'échantillon.** Les réglages ont été choisis sur BTC 2017–2026 et V1 a été construite après avoir vu BTC/ETH ; aucun de ces chiffres n'est un résultat hors échantillon.`)
L.push(`- **Surajustement de sélection** (\`research/reports/calm-only/\`) : PBO ${pc(VAL.pbo)} ; V1 fait mieux que E2 ${VAL.yearsBetter} années sur ${VAL.years} ; walk-forward 2020–2026, Δ Sharpe ${sg(VAL.wfDelta)} (IC 95 % ${sg(VAL.ciWf[0])} à ${sg(VAL.ciWf[1])}) ; DSR du gain sur E2 ${pc(VAL.dsrGain, 0)} (${pc(VAL.dsrGain2, 0)} avec commissions doublées). Verdict de la règle pré-enregistrée : **${VAL.verdict}** — l'avantage sur E2 est régulier mais pas démontré au-delà du hasard de sélection.`)
L.push(`- **Sharpe absolu** : compte tenu de toute la recherche des réglages, le Sharpe dégonflé passe sous 95 % au-delà d'environ ${Math.round(VAL.breakevenV1)} essais pour V1 (${Math.round(VAL.breakevenE2)} pour E2) ; la lignée en compte au moins 222. Le niveau historique ne doit pas être pris comme une prévision.`)
L.push('- **Études de capacité, d\'exécution et de risque** (`research/capacity/`, `research/execution/`, dossier) : réalisées sur E2. V1 passe environ deux fois moins d\'ordres, tous issus du régime calme ; ces études n\'ont pas été recalculées pour V1.')
L.push('- **Live** : ni le bot ni le site ne sont modifiés par cette fiche ; le passage de V1 en shadow ou en live est une décision et un changement séparés.', '')
L.push('## Fichiers', '')
L.push('- `reference.json` : fiche lisible par machine (indicateurs, contrôles, statut).')
L.push('- `reference_daily_returns.csv` : rendements journaliers BTC, ETH et portefeuille de V1 et de E2 (commissions × 1).', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/reference.ts', '```', '')
writeFileSync(join(OUT, 'shock-engine-v1.md'), L.join('\n'))
process.stderr.write(`V1 : Sharpe ${V1.sharpe.toFixed(4)}, CAGR ${V1.cagr.toFixed(4)}, DD ${V1.maxDD.toFixed(4)}, PF ${V1.profitFactor.toFixed(4)}, trades ${V1.trades}, ×2 ${V1.sharpeCosts2.toFixed(4)}\n`)
