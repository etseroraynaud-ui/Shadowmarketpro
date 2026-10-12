// Compose le dossier institutionnel du Shock Engine (PDF, LaTeX, en anglais) et le publie sur le site.
//
// Les données des figures et les chiffres des tableaux générés sont lus, sans rien recalculer, dans :
// - lib/research/btc-eth-portfolio.json (portefeuille E2, publié par research/shock/publish-portfolio.ts) ;
// - research/reports/execution/fills-500k-1m.json et fills-2m-5m.json (2 474 exécutions, coûts mesurés) ;
// - research/reports/execution/latency-drift.json (dérive aux instants de signal, pré-enregistrée).
// Le texte, et les chiffres repris des rapports Markdown (carnets L2, modèle de capacité, comptages de
// remplissage), sont dans research/dossier/dossier.tex ; l'annexe B du dossier cite chaque rapport.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/dossier/build-dossier.ts
//
// Écrit research/reports/dossier/shock-engine-institutional-dossier.{tex,pdf}, numbers.tex et data/,
// puis copie le PDF dans public/research/dossier/. Demande pdflatex et latexmk (TeX Live :
// latex-recommended, latex-extra, fonts-recommended, pictures, science, tex-gyre).

import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'research/dossier/dossier.tex')
const OUT = join(ROOT, 'research/reports/dossier')
const DATA = join(OUT, 'data')
const PUB = join(ROOT, 'public/research/dossier')
const NAME = 'shock-engine-institutional-dossier'

/** Budget de coûts au Sharpe 1,5 (étude P0, research/reports/capacity/capacity-report.md), pb par exécution. */
const BUDGET_BPS = 5.3
/** Seuil de Sharpe de la capacité, critère C1 du pré-enregistrement capacity-p0p1.md. */
const THRESHOLD = 1.5

const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
const P = json('lib/research/btc-eth-portfolio.json')
const F1 = json('research/reports/execution/fills-500k-1m.json')
const F2 = json('research/reports/execution/fills-2m-5m.json')
const DR = json('research/reports/execution/latency-drift.json')

// ---------------------------------------------------------------- refus de composer
if (P.variant !== 'e2') throw new Error('le résumé publié n\'est pas celui de la spécification E2')
if (P.manifest.checksPassed !== P.manifest.checksTotal) throw new Error('contrôles du portefeuille en échec')
if (F1.backtest.sharpe !== F2.backtest.sharpe) throw new Error('les deux études de remplissage n\'ont pas la même référence')
if (DR.measured !== DR.sampled || DR.integrity.idGaps !== 0) throw new Error('mesure de dérive incomplète')

// ---------------------------------------------------------------- mise en forme
const minus = (s: string) => s.replace(/^-/, '\\textminus{}')
const fx = (x: number, d = 2) => minus(x.toFixed(d))
const pct = (x: number, d = 1) => `${minus((x * 100).toFixed(d))}\\%`
const int = (x: number) => Math.round(x).toLocaleString('en-US').replace(/,/g, '{,}')
const usd = (c: number) => (c >= 1e6 ? `\\$${+(c / 1e6).toFixed(1)}M` : `\\$${c / 1e3}k`)

type Run = { sharpe: number; cagr: number; maxDD: number; sharpeP5: number; sharpeP95: number; cagrP5: number; cagrP95: number; executions?: { all: { costBps: { mean: number; p50: number; p95: number; p99: number } } } }
const RES: Record<number, Record<string, Run> & { probabilitySharpeAbove15: Record<string, number> }> = { ...F1.results, ...F2.results }
const CAPS = [500e3, 1e6, 2e6, 5e6]
/** Suffixe des macros par capital (les noms de macros LaTeX n'ont que des lettres). */
const CAP_TAG: Record<number, string> = { 500e3: 'Half', 1e6: 'One', 2e6: 'Two', 5e6: 'Five' }
for (const c of CAPS) if (!RES[c]) throw new Error(`capital ${c} absent des études de remplissage`)
const VERSIONS = { current: 'current', delivered: 'optimized_entries_only', full: 'optimized' } as const

/** Capital où le Sharpe passe sous le seuil (interpolation en log du capital). */
function crossing(v: string) {
  for (let k = 1; k < CAPS.length; k++) {
    const a = RES[CAPS[k - 1]][v].sharpe, b = RES[CAPS[k]][v].sharpe
    if (a >= THRESHOLD && b < THRESHOLD) {
      const t = (a - THRESHOLD) / (a - b)
      return Math.exp(Math.log(CAPS[k - 1]) + t * (Math.log(CAPS[k]) - Math.log(CAPS[k - 1])))
    }
  }
  throw new Error(`pas de passage sous ${THRESHOLD} pour ${v}`)
}

// ---------------------------------------------------------------- macros
const M: Record<string, string> = {}
const F = P.series.portfolio, B = P.series.btc, E = P.series.eth, BH = P.buyHold
const SP = P.stability.subPeriods
Object.assign(M, {
  PfSharpe: fx(F.m.sharpe), PfCagr: pct(F.m.cagr), PfVol: pct(F.m.vol), PfMaxDD: pct(F.m.maxDD), PfSortino: fx(F.m.sortino), PfCalmar: fx(F.m.calmar),
  BtcSharpe: fx(B.m.sharpe), EthSharpe: fx(E.m.sharpe),
  BhSharpe: fx(BH.sharpe), BhCagr: pct(BH.cagr), BhMaxDD: pct(BH.maxDD),
  Trades: int(F.trades.trades), TradesLong: int(F.trades.long), TradesShort: int(F.trades.short), TradesPerYear: fx(F.trades.perYear, 0),
  WinRate: pct(F.trades.winRate, 0), Payoff: fx(F.trades.payoff), TimeInMarket: pct(F.expo.timeInMarket, 0),
  BootLo: fx(P.bootstrap.sharpe.p5), BootHi: fx(P.bootstrap.sharpe.p95),
  HalfOne: fx(SP.firstHalf.portfolio.sharpe), HalfTwo: fx(SP.secondHalf.portfolio.sharpe),
  RollPositive: pct(P.stability.rolling12.portfolio.positive, 0), RollAboveOne: pct(P.stability.rolling12.portfolio.aboveOne, 0),
  CorrDaily: fx(P.correlation.dailyPearson), WorstMonth: pct(P.headline.worstMonth.ret),
  TopFive: pct(P.concentration.tradesPortfolio.top5, 0), CagrNoTopFive: pct(P.concentration.tradesPortfolio.cagrWithoutTop5),
  FundingSharpe: fx(P.stress.funding[0].sharpe), FundingHlSharpe: fx(P.stress.funding[1].sharpe),
  RaAlpha: pct(P.residualAlpha.alphaAnn), RaT: fx(P.residualAlpha.t), RaUnexplained: pct(P.residualAlpha.unexplained, 0),
  TurnoverOneWay: fx(F.cost.turnoverOneWay, 0),
  BtSharpe: fx(F1.backtest.sharpe), BtSharpeLo: fx(F1.backtest.sharpeP5), BtSharpeHi: fx(F1.backtest.sharpeP95), BtCagr: pct(F1.backtest.cagr), BtMaxDD: pct(F1.backtest.maxDD),
  BudgetBps: fx(BUDGET_BPS, 1), Threshold: fx(THRESHOLD, 1),
})
for (const [key, v] of Object.entries(VERSIONS)) {
  const K = key[0].toUpperCase() + key.slice(1)
  M[`Cap${K}`] = usd(crossing(v))
  M[`Cap${K}Num`] = (crossing(v) / 1e6).toFixed(3)
  for (const c of CAPS) {
    const r = RES[c][v], tag = `${K}${CAP_TAG[c]}`
    M[`Sh${tag}`] = fx(r.sharpe); M[`ShLo${tag}`] = fx(r.sharpeP5); M[`ShHi${tag}`] = fx(r.sharpeP95)
    M[`Cagr${tag}`] = pct(r.cagr); M[`CagrLo${tag}`] = pct(r.cagrP5, 0); M[`CagrHi${tag}`] = pct(r.cagrP95, 0)
    M[`DD${tag}`] = pct(r.maxDD); M[`Prob${tag}`] = pct(RES[c].probabilitySharpeAbove15[v], 0)
    const x = r.executions?.all.costBps
    if (x) Object.assign(M, { [`CostMed${tag}`]: fx(x.p50), [`CostNinetyFive${tag}`]: fx(x.p95, 1), [`CostNinetyNine${tag}`]: fx(x.p99, 1), [`CostMean${tag}`]: fx(x.mean), [`Budget${tag}`]: pct(x.mean / BUDGET_BPS, 0) })
  }
}
const paired = (c: number) => RES[c].pairedSharpe as unknown as Record<string, { point: number; p5: number; p95: number; shareAbove0: number }>
M.GainDelivered = fx(paired(1e6).current_to_optimized_entries_only.point)
M.GainDeliveredLo = fx(paired(1e6).current_to_optimized_entries_only.p5)
M.GainDeliveredHi = fx(paired(1e6).current_to_optimized_entries_only.p95)
M.GainDeliveredShare = pct(paired(1e6).current_to_optimized_entries_only.shareAbove0, 0)
const drift = DR.results.all.driftBps as Record<string, { meanBps: number; loBps: number; hiBps: number }>
for (const [h, k] of [['0.5s', 'Half'], ['1s', 'One'], ['2s', 'Two'], ['5s', 'Five'], ['10s', 'Ten']] as const) M[`Drift${k}`] = fx(drift[h].meanBps, 1)
M.DriftN = int(DR.measured)

// ---------------------------------------------------------------- données des figures
mkdirSync(DATA, { recursive: true })
const C = P.chart
const d0 = Date.parse(`${C.start}T00:00:00Z`)
const yearOf = (i: number) => { const t = new Date(d0 + i * 864e5); const y = t.getUTCFullYear(); const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return y + (t.getTime() - a) / (b - a) }
function series(file: string, cols: Record<string, (number | null)[]>, step = 2) {
  const keys = Object.keys(cols)
  const lines = [`x ${keys.join(' ')}`]
  for (let i = 0; i < C.days; i++) {
    if (i % step && i !== C.days - 1) continue
    const row = keys.map(k => cols[k][i])
    if (row.some(v => v === null || !Number.isFinite(v))) continue
    lines.push(`${yearOf(i).toFixed(4)} ${row.map(v => (v as number).toPrecision(5)).join(' ')}`)
  }
  writeFileSync(join(DATA, file), lines.join('\n') + '\n')
}
series('equity.dat', { pf: C.eqPortfolio, bh: C.eqBuyHold })
series('drawdown.dat', { pf: C.ddPortfolio, bh: C.ddBuyHold })

const table = (file: string, head: string[], rows: (string | number)[][]) => writeFileSync(join(DATA, file), [head.join(' '), ...rows.map(r => r.join(' '))].join('\n') + '\n')
table('capacity.dat', ['cap', 'cur', 'curlo', 'curhi', 'del', 'dello', 'delhi', 'full'], CAPS.map(c => [c / 1e6, RES[c].current.sharpe, RES[c].current.sharpeP5, RES[c].current.sharpeP95, RES[c][VERSIONS.delivered].sharpe, RES[c][VERSIONS.delivered].sharpeP5, RES[c][VERSIONS.delivered].sharpeP95, RES[c][VERSIONS.full].sharpe].map(v => +v.toFixed(4))))
table('drift.dat', ['s', 'mean', 'lo', 'hi'], (DR.horizonsS as number[]).filter(h => h <= 10).map(h => { const x = drift[`${h}s`]; return [h, +x.meanBps.toFixed(3), +x.loBps.toFixed(3), +x.hiBps.toFixed(3)] }))
const census = F1.observedOrdersAround as Record<'BTC' | 'ETH', Record<string, { shareWithAtLeastOne: number; medianDelayToFirstMs: number }>>
const SIZES = Object.keys(census.BTC).map(Number).filter(s => s >= 250e3)
table('census.dat', ['size', 'btc', 'eth', 'btcdelay', 'ethdelay'], SIZES.map(s => [s / 1e6, +(100 * census.BTC[s].shareWithAtLeastOne).toFixed(1), +(100 * census.ETH[s].shareWithAtLeastOne).toFixed(1), +(census.BTC[s].medianDelayToFirstMs / 1e3).toFixed(1), +(census.ETH[s].medianDelayToFirstMs / 1e3).toFixed(1)]))
// Pont du Sharpe à 1 M$ : backtest → coûts mesurés du bot initial → bot livré → stops gérés (non codés).
const r1 = RES[1e6]
const bridge = [['Backtest', F1.backtest.sharpe], ['Initial', r1.current.sharpe], ['Delivered', r1[VERSIONS.delivered].sharpe], ['Full', r1[VERSIONS.full].sharpe]] as const
table('bridge.dat', ['step', 'sharpe'], bridge.map(([s, v]) => [s, +v.toFixed(4)]))
Object.assign(M, { BridgeCost: fx(r1.current.sharpe - F1.backtest.sharpe), BridgeLatency: fx(r1[VERSIONS.delivered].sharpe - r1.current.sharpe), BridgeStops: fx(r1[VERSIONS.full].sharpe - r1[VERSIONS.delivered].sharpe) })

// ---------------------------------------------------------------- composition
const macros = Object.entries(M).map(([k, v]) => {
  if (!/^[A-Za-z]+$/.test(k)) throw new Error(`nom de macro invalide : ${k}`)
  return `\\newcommand{\\${k}}{${v}}`
}).join('\n')
writeFileSync(join(OUT, 'numbers.tex'), `% Écrit par research/dossier/build-dossier.ts ; ne pas modifier à la main.\n${macros}\n`)
copyFileSync(SRC, join(OUT, `${NAME}.tex`))
execFileSync('latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', `${NAME}.tex`], { cwd: OUT, stdio: ['ignore', 'ignore', 'inherit'] })
execFileSync('latexmk', ['-c', `${NAME}.tex`], { cwd: OUT, stdio: 'ignore' })
rmSync(join(OUT, `${NAME}.fls`), { force: true })
mkdirSync(PUB, { recursive: true })
copyFileSync(join(OUT, `${NAME}.pdf`), join(PUB, `${NAME}.pdf`))
process.stderr.write(`écrit research/reports/dossier/${NAME}.pdf et public/research/dossier/${NAME}.pdf (${Object.keys(M).length} macros)\n`)
