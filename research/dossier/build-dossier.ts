// Compose le dossier institutionnel du Shock Engine (PDF, LaTeX, en anglais) et le publie sur le site.
//
// Les données des figures et les chiffres des tableaux générés sont lus, sans rien recalculer, dans :
// - lib/research/btc-eth-portfolio.json (portefeuille des règles publiées, research/shock/publish-portfolio.ts) ;
// - research/reports/execution/fills-500k-1m.json et fills-2m-5m.json (1 150 exécutions, coûts mesurés) ;
// - research/reports/execution/latency-drift.json (dérive aux instants de signal, pré-enregistrée) ;
// - research/reports/capacity/p0-budget.json et p1-capacity.json (budget de coûts, modèle de capacité) ;
// - research/reports/calm-only/calm-only.json (risque de sélection des règles) ;
// - research/reports/shock-15m-wf-plateau-36-3-calm.md (walk-forward, ligne du préréglage fixe).
// Le texte, et les chiffres repris des rapports Markdown (carnets L2, comptages par année), sont dans
// research/dossier/dossier.tex ; l'annexe B du dossier cite chaque rapport.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/dossier/build-dossier.ts
//   (DOSSIER_NUMBERS_ONLY=1 : écrit seulement numbers.tex et data/, sans LaTeX)
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

/** Seuil de Sharpe de la capacité, critère C1 du pré-enregistrement capacity-p0p1.md. */
const THRESHOLD = 1.5

const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
const P = json('lib/research/btc-eth-portfolio.json')
const F1 = json('research/reports/execution/fills-500k-1m.json')
const F2 = json('research/reports/execution/fills-2m-5m.json')
const DR = json('research/reports/execution/latency-drift.json')
const B0 = json('research/reports/capacity/p0-budget.json')
const C1 = json('research/reports/capacity/p1-capacity.json')
const CO = json('research/reports/calm-only/calm-only.json')
const WF = readFileSync(join(ROOT, 'research/reports', P.evidence.walkForward.file), 'utf8')

// ---------------------------------------------------------------- refus de composer
if (P.variant !== 'calm') throw new Error('le résumé publié n\'est pas celui des règles publiées (régime calme)')
if (P.manifest.checksPassed !== P.manifest.checksTotal) throw new Error('contrôles du portefeuille en échec')
if (F1.backtest.sharpe !== F2.backtest.sharpe) throw new Error('les deux études de remplissage n\'ont pas la même référence')
if (DR.measured !== DR.sampled || DR.integrity.idGaps !== 0) throw new Error('mesure de dérive incomplète')
if (Math.abs(F1.backtest.sharpe - C1.baseline.sharpe) > 1e-9) throw new Error('étude de capacité et études de remplissage sur des références différentes')
if (!CO.checks.every((c: { ok: boolean }) => c.ok)) throw new Error('contrôles de l\'étude de sélection en échec')
if (Math.abs(CO.configurations.find((c: { key: string }) => c.key === 'calm').sharpe - P.series.portfolio.m.sharpe) > 1e-6) throw new Error('étude de sélection ≠ portefeuille publié')

/** Budget de coûts sur la fenêtre Binance (étude P0) : Sharpe ≥ 1,5 tant que le coût ajouté moyen reste sous ce seuil. */
const BUD = (B0.results as { window: { name: string }; byCat: { all: { slopePerBp: { point: number }; threshold: Record<string, { point: number; p5: number; p95: number }> } } }[]).find(r => r.window.name === 'binance')!.byCat.all
const BUDGET_BPS = BUD.threshold.sharpe15.point

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

/** Capital où le Sharpe passe sous le seuil (interpolation en log du capital) ; null s'il reste au-dessus jusqu'au plus grand capital testé. */
function crossing(v: string): number | null {
  for (let k = 1; k < CAPS.length; k++) {
    const a = RES[CAPS[k - 1]][v].sharpe, b = RES[CAPS[k]][v].sharpe
    if (a >= THRESHOLD && b < THRESHOLD) {
      const t = (a - THRESHOLD) / (a - b)
      return Math.exp(Math.log(CAPS[k - 1]) + t * (Math.log(CAPS[k]) - Math.log(CAPS[k - 1])))
    }
  }
  if (RES[CAPS[0]][v].sharpe < THRESHOLD) throw new Error(`${v} : Sharpe sous ${THRESHOLD} dès le plus petit capital`)
  return null
}
const MAX_CAP = CAPS[CAPS.length - 1]
/** Capacité en texte : capital de passage, ou « au-delà du plus grand capital testé ». */
const capText = (c: number | null, scale = 1) => (c === null ? `$>$\\,${usd(MAX_CAP * scale)}` : usd(c * scale))

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
  M[`Cap${K}`] = capText(crossing(v))
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

// ---------------------------------------------------------------- exécutions, budget, capacité, sélection
type Ex = { n: number; costBps: { n: number; mean: number; p50: number; p95: number; p99: number }; components: Record<'halfSpread' | 'drift' | 'immediate', { p50: number }>; proof: { within50bps: number; within1pct: number; unproven: number } }
const exOf = (c: number, v: string) => (RES[c][v] as unknown as { executions: Record<string, Ex> }).executions
const X1 = exOf(1e6, 'current')
const cnt = (a: 'BTC' | 'ETH', f: string) => X1[`${a} ${f}`]?.n ?? 0
if (cnt('BTC', 'tp1') + cnt('ETH', 'tp1') !== 0) throw new Error('prises de profit partielles présentes : le tableau des exécutions n\'en a plus')
const counts = { entry: 'Entries', close: 'Closes', stop: 'Stops' } as const
let total = 0
for (const [f, K] of Object.entries(counts)) {
  M[`N${K}Btc`] = int(cnt('BTC', f)); M[`N${K}Eth`] = int(cnt('ETH', f)); M[`N${K}`] = int(cnt('BTC', f) + cnt('ETH', f))
  total += cnt('BTC', f) + cnt('ETH', f)
}
const totalOf = (a: 'BTC' | 'ETH') => Object.keys(counts).reduce((s, f) => s + cnt(a, f), 0)
if (total !== X1.all.n) throw new Error('comptage des exécutions incohérent')
Object.assign(M, { NExec: int(total), NExecBtc: int(totalOf('BTC')), NExecEth: int(totalOf('ETH')), CostN: int(X1.all.costBps.n) })
if (F1.stopsLocated.BTC.crossFound !== F1.stopsLocated.BTC.n || F1.stopsLocated.ETH.crossFound !== F1.stopsLocated.ETH.n) throw new Error('stops non localisés')
// Rapprochement des preuves de remplissage (bot initial, comme le rapport pré-enregistré).
for (const [c, tag] of [[500e3, 'Half'], [1e6, 'One'], [2e6, 'Two'], [5e6, 'Five']] as const) {
  const x = exOf(c, 'current'), p = x.all.proof
  if (p.within50bps + p.within1pct + p.unproven !== total) throw new Error(`preuves incomplètes à ${c}`)
  const ethU = ['entry', 'close', 'stop'].reduce((s, f) => s + (x[`ETH ${f}`]?.proof.unproven ?? 0), 0)
  Object.assign(M, { [`Proved${tag}`]: int(p.within50bps), [`ProvedShare${tag}`]: pct(p.within50bps / total), [`Depth${tag}`]: int(p.within1pct), [`DepthShare${tag}`]: pct(p.within1pct / total), [`Unproved${tag}`]: int(p.unproven), [`UnprovedShare${tag}`]: pct(p.unproven / total), [`UnprovedEth${tag}`]: int(ethU) })
}
const md = (k: string) => X1.all.components[k as 'drift'].p50
Object.assign(M, { DecSpread: fx(md('halfSpread')), DecDrift: fx(md('drift')), DecDepth: fx(md('immediate')), DecDriftBtcEntry: fx(X1['BTC entry'].components.drift.p50), DecDriftEthEntry: fx(X1['ETH entry'].components.drift.p50) })
// Coût de profondeur médian d'un ordre de 500 k$ aux entrées (capital 1 M$), mesuré.
Object.assign(M, { ImmBtc: fx(X1['BTC entry'].components.immediate.p50), ImmEth: fx(X1['ETH entry'].components.immediate.p50) })
const XD = exOf(1e6, VERSIONS.delivered)
const stopP99 = [XD['BTC stop'].costBps.p99, XD['ETH stop'].costBps.p99].sort((a, b) => a - b)
Object.assign(M, { StopPLo: fx(stopP99[0], 0), StopPHi: fx(stopP99[1], 0) })
const census500 = (a: 'BTC' | 'ETH') => F1.observedOrdersAround[a]['500000'].medianDelayToFirstMs / 1e3
Object.assign(M, { CensusBtc: fx(census500('BTC'), 1), CensusEth: fx(census500('ETH'), 1) })
const model = (k: string) => F1.models[`${k}|0.5s`] as { r2: number; coef: number[] }
Object.assign(M, { RTwoBtc: fx(model('btc').r2), RTwoEth: fx(model('ethusdt').r2), ElastBtc: fx(model('btc').coef[1]), ElastEth: fx(model('ethusdt').coef[1]) })
Object.assign(M, {
  BudgetSlope: fx(-BUD.slopePerBp.point, 3), BudgetLo: fx(BUD.threshold.sharpe15.p5, 1), BudgetHi: fx(BUD.threshold.sharpe15.p95, 1), BudgetOneBps: fx(BUD.threshold.sharpe10.point, 1),
  FeeGain: fx(F1.fees['1000000'].current_with_fee_correction.sharpe - RES[1e6].current.sharpe),
  FundingDrag: fx(P.stress.funding[0].sharpe - F.m.sharpe),
})
// Modèle de capacité pré-enregistré (P1) : impact en racine carrée non calibré, ordre étalé sur la première minute.
const named = C1.named as Record<string, { A: number; sharpe: number }[]>
const at = (sc: string, A: number) => named[sc].find(r => r.A === A)!.sharpe
const dec1 = (C1.decomposition as { A: number; entry: { impact: number } }[]).find(d => d.A === 1e6)!
Object.assign(M, {
  ModelCapCentral: usd(C1.thresholds.central.C1_sharpe15.point), ModelCapPrudent: usd(C1.thresholds.prudent.C1_sharpe15.point),
  ModelShCentralFive: fx(at('central', 5e6)), ModelShPrudentFive: fx(at('prudent', 5e6)), ModelImpact: fx(dec1.entry.impact, 1),
  MinuteDriftBtc: fx(C1.driftVwapVsLast1m.BTC.vwapBps, 1), MinuteDriftEth: fx(C1.driftVwapVsLast1m.ETH.vwapBps, 1),
})
const liq = (A: number) => (C1.liquidity as { A: number; stops: { triggerMinuteOver10: number; triggerMinuteOver100: number } }[]).find(l => l.A === A)!.stops
Object.assign(M, { StopVolOne: pct(liq(1e6).triggerMinuteOver10), StopVolFive: pct(liq(5e6).triggerMinuteOver10, 0), StopVolFullFive: pct(liq(5e6).triggerMinuteOver100) })
// Hyperliquid : un carnet ρ fois moins profond équivaut, pour la profondeur, à un capital 1/ρ fois plus grand.
Object.assign(M, { RhoHalfCap: capText(crossing(VERSIONS.delivered), 0.5), RhoFifthCap: capText(crossing(VERSIONS.delivered), 0.2) })
// Walk-forward (Bitcoin, plateaux) contre le préréglage fixe sur les mêmes fenêtres.
const wfRow = (re: RegExp) => { const l = WF.split('\n').find(x => re.test(x)); if (!l) throw new Error(`walk-forward : ligne ${re} absente`); return l.split('|').map(x => x.trim()) }
const wfMain = wfRow(/\*\*Walk-forward, plateaux\*\*/), wfPreset = wfRow(/Préréglage fixe/)
if (wfMain[4] !== P.evidence.walkForward.sharpe) throw new Error('walk-forward : rapport ≠ résumé publié')
const wfKeep = Number(wfMain[4]) / Number(wfPreset[4])
Object.assign(M, {
  WfSharpe: wfMain[4], WfPreset: wfPreset[4], WfWindows: String(P.evidence.walkForward.windows), WfDD: pct(Number(String(P.evidence.walkForward.dd).replace('−', '-').replace(/[^\d.-]/g, '')) / 100),
  WfKeep: pct(wfKeep, 0), Haircut: fx(wfKeep * RES[1e6][VERSIONS.delivered].sharpe, 1),
})
// Sensibilité à la longueur des fenêtres (research/preregistration/wf-longer-windows.md).
const WFW = P.evidence.walkForwardWindows
if (!WFW || WFW.verdict !== 'not-windows') throw new Error('walk-forward à fenêtres longues absent, ou verdict différent du texte du dossier')
Object.assign(M, {
  WflN: String(WFW.configs), WflMedian: fx(WFW.median), WflMin: fx(WFW.min), WflMax: fx(WFW.max),
  WflBelow: WFW.belowFixed === WFW.configs ? `all ${WFW.configs}` : `${WFW.belowFixed} of ${WFW.configs}`,
  WflKeep: pct(WFW.medianRatio, 0), HaircutMed: fx(WFW.medianRatio * RES[1e6][VERSIONS.delivered].sharpe, 1),
})
// Risque de sélection du choix des règles (CSCV-PBO, Sharpe dégonflé du gain).
Object.assign(M, { Pbo: pct(CO.cscv.main.pbo, 0), PboN: String(CO.configurations.length), PboSplits: int(CO.cscv.main.splits), GainDsr: pct(CO.dsr.diff.p, 0), GainPsr: pct(CO.dsr.diff.psr0, 0) })
// Robustesse (résumé publié).
const EV = P.evidence
const zsVerdict = (z: { verdict: { eventsPreset: boolean; eventsShockTrend: boolean; preset: { pf: boolean; sharpe: boolean; random: boolean; delay: boolean } } }) => {
  const v = z.verdict, strat = v.preset.pf && v.preset.sharpe && v.preset.random && v.preset.delay
  return strat && v.eventsPreset && v.eventsShockTrend ? 'pass' : strat || (v.preset.sharpe && v.preset.random) ? 'partial' : 'fail'
}
const others = ([['sol', 'Solana'], ['gold', 'gold'], ['tao', 'TAO']] as const).map(([k, name]) => ({ name, k, v: zsVerdict(EV[k]) }))
const list = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const byV = (v: string) => list(others.filter(o => o.v === v).map(o => o.name))
if (zsVerdict(EV.eth) !== 'pass' || zsVerdict(EV.ethDukascopy) !== 'pass') throw new Error('Ether ne passe plus le transfert : le texte du dossier est à revoir')
M.ZsOthers = [byV('pass') && `${byV('pass')} passed`, byV('partial') && `${byV('partial')} partial`, byV('fail') && `${byV('fail')} failed`].filter(Boolean).join('; ')
M.ZsOthersSharpe = others.map(o => `${o.name} (${fx(EV[o.k].sharpe)})`).join(', ')
const rob = (k: 'robBtc' | 'robEth') => (EV[k].levels as { level: number; medianSharpe: number; profitable: number; rank: number }[]).find(l => l.level === 0.2)!
if (![...EV.robBtc.levels, ...EV.robEth.levels].every((l: { profitable: number }) => l.profitable === 1)) throw new Error('voisin non rentable : le texte du dossier est à revoir')
if (EV.btc.randomBeaten !== 1 || EV.eth.randomBeaten !== 1) throw new Error('placebo aléatoire non battu à 100 % : le texte du dossier est à revoir')
Object.assign(M, {
  DelayBtc: pct(EV.btc.delay1Share, 0), DelayEth: pct(EV.eth.delay1Share, 0), EthSharpeBinance: fx(EV.eth.sharpe), EthSharpeDuka: fx(EV.ethDukascopy.sharpe),
  NeighBtc: fx(rob('robBtc').medianSharpe), NeighEth: fx(rob('robEth').medianSharpe), NeighRankEth: `${Math.round(rob('robEth').rank * 100)}th`,
  TaEvPct: `${P.falsification.randomSelection.evPercentile.toFixed(1)}th`, TaEvP: fx(P.falsification.randomSelection.evP, 3), TaSrP: fx(P.falsification.randomSelection.sharpeP, 3), TbP: fx(P.falsification.regimeShift.p, 3),
})
// Colonnes Bitcoin et Ether du tableau de performance, et corrélation des sous-jacents.
for (const [S, K] of [[B, 'Btc'], [E, 'Eth']] as const) Object.assign(M, {
  [`${K}Cagr`]: pct(S.m.cagr), [`${K}Vol`]: pct(S.m.vol), [`${K}MaxDD`]: pct(S.m.maxDD), [`${K}Sortino`]: fx(S.m.sortino), [`${K}Calmar`]: fx(S.m.calmar),
  [`${K}Trades`]: int(S.trades.trades), [`${K}WinRate`]: pct(S.trades.winRate, 0), [`${K}Payoff`]: fx(S.trades.payoff), [`${K}TimeInMarket`]: pct(S.expo.timeInMarket, 0),
})
Object.assign(M, { BhVol: pct(BH.vol), BhCalmar: fx(BH.calmar), CorrSpot: fx(P.correlation.underlyingDaily) })
// Erreur type d'un Sharpe estimé sur T années, d'après le bootstrap des mois de l'historique.
M.BootSe = fx((P.bootstrap.sharpe.p95 - P.bootstrap.sharpe.p5) / (2 * 1.6448536) * Math.sqrt(F.m.years))

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
if (process.env.DOSSIER_NUMBERS_ONLY) { process.stderr.write(`écrit research/reports/dossier/numbers.tex (${Object.keys(M).length} macros), sans composer le PDF\n`); process.exit(0) }
copyFileSync(SRC, join(OUT, `${NAME}.tex`))
execFileSync('latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', `${NAME}.tex`], { cwd: OUT, stdio: ['ignore', 'ignore', 'inherit'] })
execFileSync('latexmk', ['-c', `${NAME}.tex`], { cwd: OUT, stdio: 'ignore' })
rmSync(join(OUT, `${NAME}.fls`), { force: true })
mkdirSync(PUB, { recursive: true })
copyFileSync(join(OUT, `${NAME}.pdf`), join(PUB, `${NAME}.pdf`))
process.stderr.write(`écrit research/reports/dossier/${NAME}.pdf et public/research/dossier/${NAME}.pdf (${Object.keys(M).length} macros)\n`)
