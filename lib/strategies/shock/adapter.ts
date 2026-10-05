// Le Shock Engine dans Backtest Lab : exécution sur les barres chargées, avec les réglages de
// la page (capital, taille, frais, sens, période, validation), et conversion du résultat au
// format commun (courbe, trades, mesures) pour réutiliser tous les onglets de résultats.

import type { BacktestResult, Bars, ExitReason, InputDef, Msg, Plot, Settings, Signals, Trade } from '../../backtest/types.ts'
import { computeMetrics } from '../../backtest/metrics.ts'
import { liquidationMsg, windowIndices } from '../../backtest/engine.ts'
import { medianStep, resample } from '../../backtest/data.ts'
import { makeMarket, simulate } from './engine.ts'
import type { Market, PositionRecord, ShockResult } from './engine.ts'
import { classify } from './regimes.ts'
import { DEFAULT_PARAMS, USER_2026 } from './params.ts'
import type { Costs, ShockParams } from './params.ts'
import { WF15, WF30, ADAPTIVE15, ADAPTIVE30 } from './presets.ts'

export interface Adaptive {
  calm: ShockParams | null
  agitated: ShockParams | null
}

/** Stratégie Shock Engine : un jeu de réglages, ou deux selon la volatilité (mode adaptatif). */
export interface ShockSpec {
  kind: 'shock'
  params: ShockParams
  adaptive: Adaptive | null
}

// ---------------------------------------------------------------- réglages affichés
export interface ShockInput {
  key: keyof ShockParams
  title: string
  group: string
  kind: 'int' | 'float' | 'bool' | 'select'
  min?: number
  max?: number
  step?: number
  options?: { value: number | string; label: string }[]
}

/** Inputs du script Pine, dans le même ordre et avec les mêmes intitulés. */
export const SHOCK_INPUTS: ShockInput[] = [
  { key: 'highActivityMode', title: 'High Activity Mode', group: 'ACTIVITY MODE', kind: 'bool' },
  { key: 'volWin', title: 'Volatility Window', group: 'SHOCK DETECTION', kind: 'int', min: 20, max: 300, step: 1 },
  { key: 'kMain', title: 'Main Shock Z', group: 'SHOCK DETECTION', kind: 'float', min: 1.5, max: 4, step: 0.1 },
  { key: 'useMicroShock', title: 'Enable MicroShock', group: 'SHOCK DETECTION', kind: 'bool' },
  { key: 'kMicro', title: 'Micro Shock Z', group: 'SHOCK DETECTION', kind: 'float', min: 0.8, max: 2.5, step: 0.1 },
  { key: 'rangeWin', title: 'Range Lookback', group: 'SHOCK DETECTION', kind: 'int', min: 5, max: 100, step: 1 },
  { key: 'wickThr', title: 'Wick Threshold', group: 'SHOCK DETECTION', kind: 'float', min: 0.3, max: 0.7, step: 0.05 },
  { key: 'cooldownBars', title: 'Cooldown Bars', group: 'COOLDOWN', kind: 'int', min: 1, max: 30, step: 1 },
  { key: 'lamEmaWin', title: 'Lambda EMA Window', group: 'LAMBDA REGIME', kind: 'int', min: 50, max: 500, step: 1 },
  { key: 'lamNormWin', title: 'Lambda Percentile Window', group: 'LAMBDA REGIME', kind: 'int', min: 100, max: 1000, step: 1 },
  { key: 'lamPctThr', title: 'Lambda Percentile Threshold', group: 'LAMBDA REGIME', kind: 'float', min: 20, max: 80, step: 1 },
  { key: 'onlyHighLam', title: 'Require High Lambda', group: 'LAMBDA REGIME', kind: 'bool' },
  { key: 'useHTF', title: 'Enable HTF Filter', group: 'HTF TREND FILTER', kind: 'bool' },
  {
    key: 'htfMinutes', title: 'HTF Timeframe', group: 'HTF TREND FILTER', kind: 'select',
    options: [{ value: 60, label: '1 h' }, { value: 240, label: '4 h' }, { value: 1440, label: '1 j' }, { value: 4320, label: '3 j' }],
  },
  { key: 'htfEmaLen', title: 'HTF EMA Length', group: 'HTF TREND FILTER', kind: 'int', min: 10, max: 200, step: 1 },
  { key: 'useVolFilter', title: 'Enable Volume Filter', group: 'VOLUME FILTER', kind: 'bool' },
  { key: 'volZWin', title: 'Volume Z-Score Window', group: 'VOLUME FILTER', kind: 'int', min: 10, max: 100, step: 1 },
  { key: 'volZThr', title: 'Volume Z Threshold', group: 'VOLUME FILTER', kind: 'float', min: -0.5, max: 1.5, step: 0.1 },
  { key: 'volFadeMax', title: 'Volume Z Max (Fade)', group: 'VOLUME FILTER', kind: 'float', min: 0, max: 2, step: 0.1 },
  { key: 'useCompression', title: 'Enable Compression Filter', group: 'COMPRESSION FILTER', kind: 'bool' },
  { key: 'atrZWin', title: 'ATR Z-Score Window', group: 'COMPRESSION FILTER', kind: 'int', min: 10, max: 100, step: 1 },
  { key: 'compThr', title: 'Compression Threshold', group: 'COMPRESSION FILTER', kind: 'float', min: -2, max: 1, step: 0.1 },
  { key: 'directionalOnly', title: 'Directional Only (No Fade)', group: 'TRADE MODE', kind: 'bool' },
  { key: 'fadeOnlyLowLam', title: 'Fade Only in Low Lambda', group: 'TRADE MODE', kind: 'bool' },
  { key: 'atrLen', title: 'ATR Length', group: 'RISK MANAGEMENT', kind: 'int', min: 5, max: 50, step: 1 },
  { key: 'atrStopMult', title: 'Stop ×ATR', group: 'RISK MANAGEMENT', kind: 'float', min: 0.5, max: 4, step: 0.1 },
  { key: 'atrTrailMult', title: 'Trail ×ATR (50 = off)', group: 'RISK MANAGEMENT', kind: 'float', min: 0.5, max: 50, step: 0.1 },
  { key: 'useTP1', title: 'Enable Partial TP', group: 'TAKE PROFIT', kind: 'bool' },
  { key: 'tp1AtrMult', title: 'TP1 ×ATR', group: 'TAKE PROFIT', kind: 'float', min: 0.3, max: 3, step: 0.1 },
  { key: 'tp1QtyPct', title: 'TP1 Qty %', group: 'TAKE PROFIT', kind: 'int', min: 10, max: 100, step: 1 },
  { key: 'useVWAPExit', title: 'Enable VWAP Exit (Fade)', group: 'VWAP EXIT', kind: 'bool' },
  { key: 'vwapLen', title: 'VWAP Proxy Length', group: 'VWAP EXIT', kind: 'int', min: 10, max: 100, step: 1 },
  { key: 'useFlipExit', title: 'Enable Flip Exit', group: 'FLIP EXIT', kind: 'bool' },
  { key: 'flipMainOnly', title: 'Flip only on MAIN shock impulse', group: 'FLIP EXIT', kind: 'bool' },
  { key: 'flipIncludeFade', title: 'Include Fade in raw flip signal', group: 'FLIP EXIT', kind: 'bool' },
  { key: 'flipMinLifeATR', title: 'Min Life ×ATR to allow flip (0=off)', group: 'FLIP EXIT', kind: 'float', min: 0, max: 2, step: 0.1 },
  { key: 'allowLong', title: 'Longs', group: 'RESEARCH', kind: 'bool' },
  { key: 'allowShort', title: 'Shorts', group: 'RESEARCH', kind: 'bool' },
  { key: 'useImpulse', title: 'Impulse entries', group: 'RESEARCH', kind: 'bool' },
  { key: 'longLamPct', title: 'Long regime lambda % (script: 55)', group: 'RESEARCH', kind: 'float', min: 0, max: 100, step: 1 },
  {
    key: 'htfSlopeMode', title: 'HTF slope measured on', group: 'RESEARCH', kind: 'select',
    options: [{ value: 'chart', label: 'chart bars (script)' }, { value: 'htf', label: 'HTF bars (fixed)' }],
  },
  { key: 'htfSlopeBars', title: 'HTF slope bars', group: 'RESEARCH', kind: 'int', min: 1, max: 20, step: 1 },
]

/** Réglages numériques, au format des paramètres optimisables de la page. */
export function shockInputDefs(p: ShockParams): InputDef[] {
  return SHOCK_INPUTS.filter(x => x.kind === 'int' || x.kind === 'float').map(x => ({
    name: x.key, title: x.title, kind: x.kind as 'int' | 'float', defval: p[x.key] as number,
    min: x.min ?? null, max: x.max ?? null, step: x.step ?? null,
  }))
}

// ---------------------------------------------------------------- préréglages
export interface ShockPreset {
  id: string
  name: Msg
  desc: Msg
  /** Préréglage choisi par la recherche sur 2017-2026 : à l'intérieur de cette période, son résultat est en échantillon. */
  selectedOn?: { from: number; to: number; oos: Msg }
  /** Timeframe conseillé, en minutes. */
  tf: number | null
  /** Code Pine v6 du préréglage, à télécharger (généré par research/shock/export-pine.ts). */
  pine?: string
  build: () => { params: ShockParams; adaptive: Adaptive | null }
}

const P = (over: Partial<ShockParams>): ShockParams => ({ ...DEFAULT_PARAMS, ...over })

export const SHOCK_PRESETS: ShockPreset[] = [
  {
    id: 'script', tf: 5,
    name: { fr: 'Script tel quel', en: 'Script as is' },
    desc: { fr: 'Les valeurs par défaut du script Pine.', en: 'The Pine script defaults.' },
    build: () => ({ params: P({}), adaptive: null }),
  },
  {
    id: 'user2026', tf: 30,
    name: { fr: 'Tes réglages (oct. 2026)', en: 'Your settings (Oct 2026)' },
    desc: { fr: 'Les réglages de tes captures TradingView : 30 min, filtre HTF 3 jours, compression, stop 2 ATR, TP1 2 ATR à 70 %.', en: 'The settings from your TradingView screenshots: 30 min, 3-day HTF filter, compression, 2 ATR stop, 2 ATR TP1 at 70%.' },
    build: () => ({ params: P(USER_2026 as Partial<ShockParams>), adaptive: null }),
  },
  {
    id: 'longs', tf: 30,
    name: { fr: 'Script, longs seuls', en: 'Script, longs only' },
    desc: { fr: 'Le script sans les shorts : la partie où le signal a un vrai pouvoir de timing en 15 et 30 min.', en: 'The script without shorts: the part where the signal has real timing power on 15 and 30 min.' },
    build: () => ({ params: P({ allowShort: false }), adaptive: null }),
  },
  {
    id: 'wf30', tf: 30,
    selectedOn: { from: Date.UTC(2017, 0, 1), to: Date.UTC(2026, 9, 4), oos: { fr: 'Hors échantillon, la méthode qui l\'a choisi a donné un Sharpe de 0,82 en 30 min (2019-2026, frais du script), 0,60 avec des frais réalistes.', en: 'Out of sample, the method that chose it gave a Sharpe of 0.82 on 30 min (2019-2026, script fees), 0.60 with realistic fees.' } },
    name: { fr: 'Meilleur jeu walk-forward · 30 min', en: 'Best walk-forward set · 30 min' },
    desc: { fr: 'Jeu retenu par la sélection sur tout l\'historique 2017-2026 (longs seuls, stop 0,8 ATR, sans TP1 ni trailing).', en: 'Set chosen by selection over the full 2017-2026 history (longs only, 0.8 ATR stop, no TP1 or trailing).' },
    build: () => ({ params: P(WF30), adaptive: null }),
  },
  {
    id: 'wf15', tf: 15,
    selectedOn: { from: Date.UTC(2017, 0, 1), to: Date.UTC(2026, 9, 4), oos: { fr: 'Hors échantillon, la méthode qui l\'a choisi a donné un Sharpe de 0,71 en 15 min (2019-2026).', en: 'Out of sample, the method that chose it gave a Sharpe of 0.71 on 15 min (2019-2026).' } },
    name: { fr: 'Meilleur jeu walk-forward · 15 min', en: 'Best walk-forward set · 15 min' },
    desc: { fr: 'Jeu retenu par la sélection sur tout l\'historique 2017-2026 en 15 min (longs seuls).', en: 'Set chosen by selection over the full 2017-2026 history on 15 min (longs only).' },
    build: () => ({ params: P(WF15), adaptive: null }),
  },
  {
    id: 'adaptive15', tf: 15, pine: '/backtest/strategies/shock-engine-adaptive-15m.pine',
    selectedOn: { from: Date.UTC(2017, 0, 1), to: Date.UTC(2026, 9, 4), oos: { fr: 'Hors échantillon : Sharpe de 1,48, 0,22 ou 0,85 selon le tirage des candidats (2019-2026). Pas encore fiable.', en: 'Out of sample: Sharpe of 1.48, 0.22 or 0.85 depending on the candidate draw (2019-2026). Not reliable yet.' } },
    name: { fr: 'Adaptatif volatilité · 15 min (expérimental)', en: 'Volatility-adaptive · 15 min (experimental)' },
    desc: { fr: 'Change de réglages selon la volatilité journalière (calme ou agitée). Résultat hors échantillon instable selon le tirage des candidats : à valider.', en: 'Switches settings with daily volatility (calm or agitated). Out-of-sample result unstable across candidate draws: to be validated.' },
    build: () => ({ params: P(ADAPTIVE15.calm ?? {}), adaptive: { calm: ADAPTIVE15.calm ? P(ADAPTIVE15.calm) : null, agitated: ADAPTIVE15.agitated ? P(ADAPTIVE15.agitated) : null } }),
  },
  {
    id: 'adaptive30', tf: 30, pine: '/backtest/strategies/shock-engine-adaptive-30m.pine',
    selectedOn: { from: Date.UTC(2017, 0, 1), to: Date.UTC(2026, 9, 4), oos: { fr: 'Hors échantillon : Sharpe de 0,98, 0,10 ou 0,13 selon le tirage des candidats (2019-2026). Pas encore fiable.', en: 'Out of sample: Sharpe of 0.98, 0.10 or 0.13 depending on the candidate draw (2019-2026). Not reliable yet.' } },
    name: { fr: 'Adaptatif volatilité · 30 min (expérimental)', en: 'Volatility-adaptive · 30 min (experimental)' },
    desc: { fr: 'Même principe en 30 min. À valider.', en: 'Same principle on 30 min. To be validated.' },
    build: () => ({ params: P(ADAPTIVE30.calm ?? {}), adaptive: { calm: ADAPTIVE30.calm ? P(ADAPTIVE30.calm) : null, agitated: ADAPTIVE30.agitated ? P(ADAPTIVE30.agitated) : null } }),
  },
]

// ---------------------------------------------------------------- exécution
const markets = new WeakMap<Bars, Market>()

function marketOf(bars: Bars): { m: Market; tfMin: number; warnings: Msg[] } {
  const tfMin = Math.max(1, Math.round(medianStep(bars.t) / 60000))
  const warnings: Msg[] = []
  let m = markets.get(bars)
  if (!m) {
    const htf = tfMin < 60 ? resample(bars, 3600000) : bars
    m = makeMarket(bars, tfMin, htf, tfMin < 60 ? 60 : tfMin, 0.01)
    markets.set(bars, m)
  }
  if (tfMin >= 60) warnings.push({ fr: 'Le Shock Engine est conçu pour le 5 à 30 minutes : sur ce timeframe, le filtre 60 min n\'a pas de sens.', en: 'The Shock Engine is designed for 5 to 30 minutes: on this timeframe the 60-min filter makes no sense.' })
  return { m, tfMin, warnings }
}

export function shockCosts(s: Settings): Costs {
  return {
    capital: s.capital, qtyPct: s.sizing === 'percent' ? s.sizeValue : 100, commissionPct: s.feePct, slippageTicks: 0, slippagePct: s.slippagePct, mintick: 0.01,
    leverage: s.leverage > 0 ? s.leverage : 1, maintenancePct: s.maintenancePct, fundingPct: s.fundingPct,
  }
}

function withDirection(p: ShockParams, s: Settings): ShockParams {
  return { ...p, allowLong: p.allowLong && s.direction !== 'short', allowShort: p.allowShort && s.direction !== 'long' }
}

/** Exécution brute : renvoie le résultat du moteur et la fenêtre. */
export function runShockRaw(bars: Bars, spec: ShockSpec, s: Settings) {
  const { m, tfMin, warnings } = marketOf(bars)
  const { start, end, split } = windowIndices(bars, s)
  const costs = shockCosts(s)
  let r: ShockResult
  let regimeVol: Float64Array | null = null
  if (spec.adaptive) {
    const sets: ShockParams[] = []
    const calmIdx = spec.adaptive.calm ? sets.push(withDirection(spec.adaptive.calm, s)) - 1 : -1
    const agiIdx = spec.adaptive.agitated ? sets.push(withDirection(spec.adaptive.agitated, s)) - 1 : -1
    const reg = classify(bars, tfMin, m.htf)
    const sel = new Int8Array(bars.n).fill(-1)
    regimeVol = new Float64Array(bars.n).fill(NaN)
    for (let i = 0; i < bars.n; i++) {
      const id = reg.id[i]
      if (id < 0) continue
      const agitated = id % 2 === 1
      regimeVol[i] = agitated ? 1 : 0
      sel[i] = agitated ? agiIdx : calmIdx
    }
    r = sets.length ? simulate(m, sets, costs, start, end, sel) : simulate(m, [withDirection(spec.params, s)], costs, start, end, new Int8Array(bars.n).fill(-1))
  } else {
    r = simulate(m, [withDirection(spec.params, s)], costs, start, end)
  }
  return { r, start, end, split, tfMin, warnings, regimeVol }
}

function reasonOf(p: PositionRecord): ExitReason {
  const last = p.exits[p.exits.length - 1]
  if (last === 'LIQ') return 'liquidation'
  if (p.exits.includes('TRAIL')) return 'trailing'
  if (last === 'SL') return 'stop'
  if (last === 'TP1') return 'target'
  if (last === 'REV') return 'reverse'
  if (last === 'END') return 'end'
  return 'signal'
}

export function toTrades(bars: Bars, ps: PositionRecord[]): Trade[] {
  return ps.map((p, k) => ({
    id: k + 1, dir: p.dir, entryIdx: p.entryIdx, entryTime: bars.t[p.entryIdx], entryPrice: p.entryPrice,
    exitIdx: p.exitIdx, exitTime: bars.t[p.exitIdx], exitPrice: p.exitPrice, qty: p.qty, notional: p.notional,
    equityAtEntry: p.equityAtEntry, fees: p.fees, pnl: p.pnl, pnlPct: p.pnlPct, bars: p.exitIdx - p.entryIdx,
    reason: reasonOf(p),
    mae: (p.maeAtr * p.atrAtEntry) / p.entryPrice,
    mfe: (p.mfeAtr * p.atrAtEntry) / p.entryPrice,
  }))
}

export interface ShockRunOutput {
  result: BacktestResult
  signals: Signals
  plots: Plot[]
  inputs: InputDef[]
  name: string | null
  warnings: Msg[]
  ms: number
}

export function runShockBacktest(bars: Bars, spec: ShockSpec, s: Settings): ShockRunOutput {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  const { r, start, end, split, warnings, regimeVol } = runShockRaw(bars, spec, s)
  const n = bars.n
  const capital = s.capital > 0 ? s.capital : 10000
  const trades = toTrades(bars, r.positions)
  // Achat conservé, mêmes frais.
  const fee = s.feePct / 100
  const benchmark = new Float64Array(n)
  const bpx = bars.o[start] * (1 + s.slippagePct / 100)
  const bqty = (capital * (1 - fee)) / bpx
  for (let i = 0; i < n; i++) {
    if (i < start) benchmark[i] = capital
    else if (i <= end) benchmark[i] = bqty * bars.c[i] * (i === end ? 1 - fee : 1)
    else benchmark[i] = benchmark[end]
  }
  const drawdown = new Float64Array(n)
  let peak = capital
  for (let i = start; i <= end; i++) {
    peak = Math.max(peak, r.equity[i])
    drawdown[i] = r.equity[i] / peak - 1
  }
  const metrics = computeMetrics(bars, r.equity, r.position, trades, start, end, capital)
  const benchMetrics = computeMetrics(bars, benchmark, null, [], start, end, capital)
  let inSample = null
  let outSample = null
  if (split > start) {
    inSample = computeMetrics(bars, r.equity, r.position, trades.filter(x => x.entryIdx < split), start, split - 1, capital)
    outSample = computeMetrics(bars, r.equity, r.position, trades.filter(x => x.entryIdx >= split), split, end, r.equity[split - 1])
  }
  if (s.sizing !== 'percent') warnings.push({ fr: 'Shock Engine : taille en % du capital seulement (100 % utilisé).', en: 'Shock Engine: size as % of equity only (100% used).' })
  if (r.liquidation) warnings.push(liquidationMsg(bars.t[r.liquidation.i], r.liquidation.price, s.leverage))
  if (s.feeFixed > 0) warnings.push({ fr: 'Shock Engine : les frais fixes par ordre ne sont pas pris en compte.', en: 'Shock Engine: fixed fees per order are not applied.' })
  if (spec.adaptive) warnings.push({ fr: 'Mode adaptatif expérimental : les réglages changent selon la volatilité journalière. Résultat hors échantillon instable dans la recherche, à valider avant tout usage réel.', en: 'Experimental adaptive mode: settings switch with daily volatility. Out-of-sample result unstable in research, to be validated before any real use.' })
  const result: BacktestResult = {
    equity: r.equity, benchmark, drawdown, position: r.position, trades, start, end, split: split > start ? split : -1,
    metrics, benchMetrics, inSample, outSample, warnings: [],
  }
  const plots: Plot[] = [
    { title: 'HTF filter', values: r.prep.htfVal, overlay: true, color: '#f5b942' },
    { title: 'VWAP proxy', values: r.prep.vwap, overlay: true, color: '#94a3b8' },
    { title: 'Lambda %', values: r.prep.lamPct, overlay: false, color: '#c084fc' },
  ]
  if (regimeVol) plots.push({ title: 'Volatilité (0 calme, 1 agitée)', values: regimeVol, overlay: false, color: '#60a5fa' })
  const empty = new Uint8Array(0)
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
  return {
    result,
    signals: { long: empty, exitLong: empty, short: empty, exitShort: empty, stopLoss: null, takeProfit: null, plots },
    plots,
    inputs: shockInputDefs(spec.params),
    name: 'Shock Engine',
    warnings,
    ms: t1 - t0,
  }
}
