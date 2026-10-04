// Types partagés par le moteur de backtest, l'import des stratégies et l'interface.

/** Série de barres OHLCV, en colonnes. `t` est l'heure d'ouverture de la barre, en ms UTC. */
export interface Bars {
  n: number
  t: Float64Array
  o: Float64Array
  h: Float64Array
  l: Float64Array
  c: Float64Array
  v: Float64Array
}

/** Texte en deux langues : les messages du moteur suivent la langue de l'interface. */
export interface Msg {
  fr: string
  en: string
}

export type Direction = 'long' | 'short' | 'both'
export type SizingMode = 'percent' | 'fixed' | 'risk'
export type FillMode = 'next_open' | 'close'

export interface Settings {
  /** Capital de départ, dans la devise de cotation. */
  capital: number
  /** percent : % du capital courant ; fixed : montant fixe ; risk : % du capital risqué jusqu'au stop. */
  sizing: SizingMode
  sizeValue: number
  /** Levier maximal accepté par le mode « risk ». */
  maxLeverage: number
  direction: Direction
  /** Commission en % de la valeur échangée, à l'entrée et à la sortie. */
  feePct: number
  /** Frais fixes par ordre. */
  feeFixed: number
  /** Glissement en %, appliqué contre le trader sur les ordres au marché et les stops. */
  slippagePct: number
  /** next_open : signal lu à la clôture, exécuté à l'ouverture suivante. close : exécuté à la clôture du signal. */
  fill: FillMode
  /** Stop, objectif et stop suiveur en % du prix d'entrée ; null = désactivé. */
  stopLossPct: number | null
  takeProfitPct: number | null
  trailingPct: number | null
  /** Sortie forcée après N barres ; null = désactivé. */
  maxBars: number | null
  /** Fenêtre de trading (ms UTC) ; les indicateurs sont calculés sur tout l'historique. */
  from: number | null
  to: number | null
  /** Début de la période hors échantillon (ms UTC), pour séparer les mesures ; null = pas de séparation. */
  splitTime: number | null
}

export const DEFAULT_SETTINGS: Settings = {
  capital: 10000,
  sizing: 'percent',
  sizeValue: 100,
  maxLeverage: 1,
  direction: 'long',
  feePct: 0.1,
  feeFixed: 0,
  slippagePct: 0.05,
  fill: 'next_open',
  stopLossPct: null,
  takeProfitPct: null,
  trailingPct: null,
  maxBars: null,
  from: null,
  to: null,
  splitTime: null,
}

export interface Plot {
  title: string
  values: Float64Array
  /** true : tracé sur le prix ; false : dans un panneau séparé. */
  overlay: boolean
  color: string | null
}

/** Ce qu'une stratégie produit, barre par barre, lu à la clôture de chaque barre. */
export interface Signals {
  long: Uint8Array
  exitLong: Uint8Array
  short: Uint8Array
  exitShort: Uint8Array
  /** Distances de stop et d'objectif en unités de prix, lues à la barre du signal ; NaN = aucune. */
  stopLoss: Float64Array | null
  takeProfit: Float64Array | null
  plots: Plot[]
}

export type ExitReason = 'signal' | 'reverse' | 'stop' | 'target' | 'trailing' | 'time' | 'end'

export interface Trade {
  id: number
  dir: 1 | -1
  entryIdx: number
  entryTime: number
  entryPrice: number
  exitIdx: number
  exitTime: number
  exitPrice: number
  qty: number
  /** Valeur de la position à l'entrée. */
  notional: number
  /** Capital juste avant l'entrée. */
  equityAtEntry: number
  fees: number
  /** Résultat net, frais compris. */
  pnl: number
  /** Résultat net rapporté à la valeur de la position. */
  pnlPct: number
  bars: number
  reason: ExitReason
  /** Pire et meilleure excursion pendant le trade, en % du prix d'entrée (MAE ≤ 0 ≤ MFE). */
  mae: number
  mfe: number
}

export interface Metrics {
  startEquity: number
  endEquity: number
  netProfit: number
  totalReturn: number
  cagr: number
  volatility: number
  sharpe: number
  sortino: number
  calmar: number
  maxDrawdown: number
  maxDrawdownBars: number
  maxDrawdownDays: number
  years: number
  periodsPerYear: number
  trades: number
  longTrades: number
  shortTrades: number
  wins: number
  losses: number
  winRate: number
  grossProfit: number
  grossLoss: number
  profitFactor: number
  avgTradePct: number
  avgWinPct: number
  avgLossPct: number
  payoff: number
  bestTradePct: number
  worstTradePct: number
  avgBars: number
  maxConsecWins: number
  maxConsecLosses: number
  exposure: number
  fees: number
}

export interface BacktestResult {
  /** Capital à la clôture de chaque barre (constant hors de la fenêtre). */
  equity: Float64Array
  /** Achat conservé sur la même fenêtre, mêmes frais. */
  benchmark: Float64Array
  /** Baisse depuis le plus haut, en fraction (≤ 0). */
  drawdown: Float64Array
  /** Position tenue à la clôture : 1, -1 ou 0. */
  position: Int8Array
  trades: Trade[]
  /** Indices de la fenêtre de trading [start, end]. */
  start: number
  end: number
  /** Indice de la première barre hors échantillon, ou -1. */
  split: number
  metrics: Metrics
  benchMetrics: Metrics
  /** Mesures en échantillon / hors échantillon quand un split est défini. */
  inSample: Metrics | null
  outSample: Metrics | null
  warnings: Msg[]
}

export interface InputDef {
  /** Nom de la variable dans le script, qui sert de clé aux réglages. */
  name: string
  title: string
  kind: 'int' | 'float' | 'bool'
  defval: number
  min: number | null
  max: number | null
  step: number | null
}
