// Rapport complet d'un backtest, en Markdown : tout le contexte pour analyser le résultat sans la
// page (stratégie, réglages, mesures, rendements, baisses, robustesse, trades). Fait pour être lu
// tel quel ou envoyé à une IA (ChatGPT, Claude…), en pièce jointe ou collé dans la conversation.

import type { Bars, Metrics, Settings, Trade } from '../../lib/backtest/types.ts'
import { periodReturns } from '../../lib/backtest/metrics.ts'
import { randomEntryTest, tradeBootstrap } from '../../lib/backtest/robustness.ts'
import type { Bootstrap, RandomTest } from '../../lib/backtest/robustness.ts'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import { SHOCK_INPUTS } from '../../lib/strategies/shock/adapter.ts'
import type { ShockInput } from '../../lib/strategies/shock/adapter.ts'
import type { AppOutput, AppSource } from './types.ts'
import type { Dict, Lang } from './i18n.ts'
import { fmtMoney, fmtNum, fmtPct } from './format.ts'

export interface ReportMeta {
  /** Marché et source des données, tels qu'affichés dans la page. */
  market: string
  timeframe: string
  /** Préréglage du Shock Engine choisi, et s'il a été modifié depuis. */
  preset: string | null
  presetEdited: boolean
  /** Heure de l'export, ms UTC. */
  now: number
}

/** Trades écrits dans le rapport : aucun, les N derniers, ou tous. */
export type TradeLimit = 0 | 100 | 500 | 'all'

/** Mêmes tests que l'onglet Robustesse (mêmes tirages, mêmes graines). */
export interface Robust {
  random: RandomTest | null
  boot: Bootstrap | null
}

export const ROBUST_SIMS = 1000

export function robustOf(bars: Bars, out: AppOutput, settings: Settings): Robust {
  return { random: randomEntryTest(bars, out.result, settings, ROBUST_SIMS), boot: tradeBootstrap(out.result.trades, ROBUST_SIMS) }
}

export function defaultTradeLimit(n: number): TradeLimit {
  return n <= 500 ? 'all' : 500
}

// ---------------------------------------------------------------- textes propres au rapport
const TXT = {
  fr: {
    title: 'Rapport de backtest',
    exported: (d: string) => `Exporté depuis ShadowMarketPro Backtest Lab le ${d} UTC. Résultat calculé sur données historiques : ce n'est ni une prévision ni un conseil en investissement.`,
    summary: 'En bref',
    data: 'Données',
    market: 'Marché',
    timeframe: 'Timeframe',
    period: 'Période testée',
    periodValue: (a: string, b: string, y: string, n: string) => `${a} → ${b} UTC (${y} ans, ${n} barres)`,
    oos: 'Validation hors échantillon',
    oosValue: (d: string) => `période mise de côté à partir du ${d} UTC`,
    none: 'aucune',
    strategy: 'Stratégie',
    kind: 'Type',
    shockKind: 'Shock Engine, recodage de la stratégie Pine « Shock Engine Intraday 15/day », exécutée comme dans TradingView',
    engineRules: 'Règles d\'exécution du moteur :',
    scriptKind: 'Script (langage de Backtest Lab, proche de Pine Script)',
    signalsKind: 'Signaux importés depuis un fichier CSV',
    preset: 'Préréglage',
    edited: 'modifié depuis',
    adaptive: 'Mode adaptatif',
    adaptiveValue: 'les réglages changent selon la volatilité journalière (calme ou agitée) ; chaque position garde jusqu\'à sa sortie les réglages qui l\'ont ouverte',
    shockRules: [
      'Entrées, flip et sortie VWAP exécutés à la clôture de la barre du signal (process_orders_on_close).',
      'Stop, TP1 partiel et stop suiveur posés à la clôture de la barre qui suit l\'entrée, puis testés dans chaque barre en suivant le trajet de TradingView (ouverture, extrême le plus proche, autre extrême, clôture).',
      'Filtre de tendance HTF calculé sans lecture du futur : chaque barre ne voit que les barres HTF closes.',
    ],
    params: 'Paramètres',
    param: 'Paramètre',
    group: 'Groupe',
    value: 'Valeur',
    def: 'Défaut du script',
    changedNote: 'En gras : valeur différente du défaut du script.',
    calm: 'Volatilité calme',
    agitated: 'Volatilité agitée',
    noSet: 'pas de nouvelle entrée',
    yes: 'oui',
    no: 'non',
    scriptName: 'Nom du script',
    code: 'Code',
    inputName: 'Variable',
    signalsCol: 'Colonne',
    signalsMode: 'Lecture',
    signalsModes: { position: 'position (> 0 achat, < 0 vente, 0 aucune)', events: 'événements (changements de valeur)', threshold: 'seuils' } as Record<string, string>,
    thresholds: 'Seuils',
    exec: 'Exécution',
    capital: 'Capital de départ',
    size: 'Taille des positions',
    sizePercent: (v: string) => `${v} du capital`,
    sizeFixed: (v: string) => `${v} par trade`,
    sizeRisk: (v: string) => `${v} du capital risqués jusqu'au stop`,
    leverage: 'Levier',
    leverageValue: (x: string, mm: string, f: string) => `×${x} en marge croisée (marge de maintenance ${mm}, financement ${f} toutes les 8 h)`,
    leverageCap: (x: string) => `plafond : position ≤ ${x} × le capital`,
    noLeverage: 'aucun (×1)',
    direction: 'Sens',
    commission: 'Commission',
    perOrder: 'par ordre',
    slippage: 'Glissement',
    feeFixed: 'Frais fixes',
    fill: 'Exécution des ordres',
    shockFill: 'à la clôture du signal ; sorties gérées par les réglages du script',
    exits: 'Sorties automatiques',
    noExits: 'aucune',
    stop: 'stop', target: 'objectif', trailing: 'stop suiveur', maxBars: (n: number) => `sortie après ${n} barres`,
    results: 'Résultats',
    metric: 'Mesure',
    sides: 'Achats et ventes',
    side: 'Sens',
    byReason: 'Par motif de sortie',
    reason: 'Motif',
    trades: 'Trades',
    winners: 'Gagnants',
    avgTrade: 'Trade moyen',
    result: 'Résultat',
    yearly: 'Rendements annuels',
    monthly: 'Rendements mensuels',
    drawdowns: 'Pires baisses',
    ddPeak: 'Sommet', ddTrough: 'Creux', ddRecover: 'Retour au sommet', ddDepth: 'Baisse', ddDays: 'Durée (jours)',
    notRecovered: 'pas encore',
    robust: 'Robustesse',
    random: (p: string, n: string, med: string, a: string, b: string) => `Face au hasard : la stratégie fait mieux que ${p} de ${n} stratégies qui entrent au hasard avec le même nombre de trades, les mêmes durées et la même taille (médiane du hasard ${med}, 5 % – 95 % : ${a} → ${b}).`,
    randomNone: 'Face au hasard : pas assez de trades pour ce test.',
    boot: (p: string, a: string, b: string, dd: string) => `Trades retirés au hasard avec remise, 1 000 fois : probabilité de finir en perte ${p} ; résultat final entre ${a} et ${b} (5 % – 95 %) ; pire baisse probable ${dd} (1 fois sur 20).`,
    bootNone: 'Rééchantillonnage des trades : pas assez de trades pour ce test.',
    warnings: 'Avertissements',
    tradesTitle: (k: number, n: number) => (k === n ? `Trades (${n})` : `Trades (${k} derniers sur ${n})`),
    tradesNone: (n: number) => `Liste des ${n} trades non incluse dans ce rapport.`,
    tradesCols: 'Colonnes : side long/short ; heures en UTC (ouverture de la barre) ; qty en unités de l\'actif ; bars = durée en barres ; pnl = résultat net frais compris, dans la devise du capital ; pnl_pct = pnl rapporté à la valeur de la position à l\'entrée (pas au capital) ; fees = commission et financement ; mae_pct / mfe_pct = pire et meilleure excursion latente pendant le trade, en % du prix d\'entrée ; reason = motif de sortie.',
    defs: 'Définitions',
    defsList: [
      'Achat conservé : tout le capital acheté au début de la période, mêmes frais, sans levier.',
      'Pire baisse : plus forte chute du capital depuis son plus haut précédent, capital évalué à chaque clôture.',
      'Sharpe, Sortino et volatilité : annualisés à partir des rendements par barre, sans taux sans risque.',
      'Temps investi : part des barres où une position est ouverte.',
      'Trade moyen, gain moyen, perte moyenne : en % de la valeur de la position.',
    ],
  },
  en: {
    title: 'Backtest report',
    exported: (d: string) => `Exported from ShadowMarketPro Backtest Lab on ${d} UTC. Result computed on historical data: neither a forecast nor investment advice.`,
    summary: 'Summary',
    data: 'Data',
    market: 'Market',
    timeframe: 'Timeframe',
    period: 'Tested period',
    periodValue: (a: string, b: string, y: string, n: string) => `${a} → ${b} UTC (${y} years, ${n} bars)`,
    oos: 'Out-of-sample validation',
    oosValue: (d: string) => `period held out from ${d} UTC`,
    none: 'none',
    strategy: 'Strategy',
    kind: 'Type',
    shockKind: 'Shock Engine, a port of the Pine strategy "Shock Engine Intraday 15/day", executed as in TradingView',
    engineRules: 'Engine execution rules:',
    scriptKind: 'Script (Backtest Lab language, close to Pine Script)',
    signalsKind: 'Signals imported from a CSV file',
    preset: 'Preset',
    edited: 'edited since',
    adaptive: 'Adaptive mode',
    adaptiveValue: 'settings switch with daily volatility (calm or agitated); each position keeps the settings that opened it until it exits',
    shockRules: [
      'Entries, flip and VWAP exit executed at the close of the signal bar (process_orders_on_close).',
      'Stop, partial TP1 and trailing stop placed at the close of the bar after entry, then tested in each bar along the TradingView path (open, nearest extreme, other extreme, close).',
      'HTF trend filter computed without lookahead: each bar only sees closed HTF bars.',
    ],
    params: 'Parameters',
    param: 'Parameter',
    group: 'Group',
    value: 'Value',
    def: 'Script default',
    changedNote: 'In bold: value different from the script default.',
    calm: 'Calm volatility',
    agitated: 'Agitated volatility',
    noSet: 'no new entry',
    yes: 'yes',
    no: 'no',
    scriptName: 'Script name',
    code: 'Code',
    inputName: 'Variable',
    signalsCol: 'Column',
    signalsMode: 'Reading',
    signalsModes: { position: 'position (> 0 long, < 0 short, 0 flat)', events: 'events (value changes)', threshold: 'thresholds' } as Record<string, string>,
    thresholds: 'Thresholds',
    exec: 'Execution',
    capital: 'Starting capital',
    size: 'Position size',
    sizePercent: (v: string) => `${v} of equity`,
    sizeFixed: (v: string) => `${v} per trade`,
    sizeRisk: (v: string) => `${v} of equity risked to the stop`,
    leverage: 'Leverage',
    leverageValue: (x: string, mm: string, f: string) => `×${x} cross margin (maintenance margin ${mm}, funding ${f} every 8 h)`,
    leverageCap: (x: string) => `cap: position ≤ ${x} × equity`,
    noLeverage: 'none (×1)',
    direction: 'Direction',
    commission: 'Commission',
    perOrder: 'per order',
    slippage: 'Slippage',
    feeFixed: 'Fixed fees',
    fill: 'Order execution',
    shockFill: 'at the signal close; exits handled by the script settings',
    exits: 'Automatic exits',
    noExits: 'none',
    stop: 'stop', target: 'target', trailing: 'trailing stop', maxBars: (n: number) => `exit after ${n} bars`,
    results: 'Results',
    metric: 'Metric',
    sides: 'Longs and shorts',
    side: 'Side',
    byReason: 'By exit reason',
    reason: 'Reason',
    trades: 'Trades',
    winners: 'Winners',
    avgTrade: 'Average trade',
    result: 'Result',
    yearly: 'Yearly returns',
    monthly: 'Monthly returns',
    drawdowns: 'Worst drawdowns',
    ddPeak: 'Peak', ddTrough: 'Trough', ddRecover: 'Back to peak', ddDepth: 'Drawdown', ddDays: 'Duration (days)',
    notRecovered: 'not yet',
    robust: 'Robustness',
    random: (p: string, n: string, med: string, a: string, b: string) => `Versus chance: the strategy beats ${p} of ${n} strategies entering at random with the same number of trades, durations and size (random median ${med}, 5%–95%: ${a} → ${b}).`,
    randomNone: 'Versus chance: not enough trades for this test.',
    boot: (p: string, a: string, b: string, dd: string) => `Trades resampled with replacement, 1,000 times: probability of ending at a loss ${p}; final result between ${a} and ${b} (5%–95%); likely worst drawdown ${dd} (1 in 20).`,
    bootNone: 'Trade resampling: not enough trades for this test.',
    warnings: 'Warnings',
    tradesTitle: (k: number, n: number) => (k === n ? `Trades (${n})` : `Trades (last ${k} of ${n})`),
    tradesNone: (n: number) => `List of the ${n} trades not included in this report.`,
    tradesCols: 'Columns: side long/short; times in UTC (bar open); qty in units of the asset; bars = duration in bars; pnl = net result after fees, in the capital currency; pnl_pct = pnl relative to the position value at entry (not to equity); fees = commission and funding; mae_pct / mfe_pct = worst and best open excursion during the trade, in % of the entry price; reason = exit reason.',
    defs: 'Definitions',
    defsList: [
      'Buy & hold: all capital bought at the start of the period, same fees, no leverage.',
      'Max drawdown: largest fall of equity from its previous high, equity measured at each close.',
      'Sharpe, Sortino and volatility: annualized from per-bar returns, no risk-free rate.',
      'Exposure: share of bars with an open position.',
      'Average trade, average win, average loss: in % of the position value.',
    ],
  },
}

// ---------------------------------------------------------------- outils Markdown
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')

function table(head: string[], rows: string[][], right: boolean[] = []): string {
  const sep = head.map((_, k) => (right[k] ? '---:' : '---'))
  return [head, sep, ...rows].map(r => `| ${r.map(cell).join(' | ')} |`).join('\n')
}

/** Liste « libellé : valeur ». */
function kv(rows: string[][], lang: Lang): string {
  return rows.map(([k, v]) => `- **${k}**${lang === 'fr' ? ' : ' : ': '}${v}`).join('\n')
}

/** Bloc de code dont la clôture ne peut pas être fermée par le contenu. */
function fence(code: string, lang = ''): string {
  let f = '```'
  while (code.includes(f)) f += '`'
  return `${f}${lang}\n${code.replace(/\s+$/, '')}\n${f}`
}

export const isoTime = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ')
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10)

// ---------------------------------------------------------------- calculs
interface Drawdown { peak: number; trough: number; recover: number; depth: number }

/** Épisodes de baisse du capital (du sommet au retour au sommet), les plus profonds d'abord. */
export function worstDrawdowns(equity: Float64Array, a: number, b: number, count = 5): Drawdown[] {
  const out: Drawdown[] = []
  let peak = a
  let trough = a
  for (let i = a + 1; i <= b; i++) {
    if (equity[i] >= equity[peak]) {
      if (trough !== peak) out.push({ peak, trough, recover: i, depth: equity[trough] / equity[peak] - 1 })
      peak = i
      trough = i
    } else if (equity[i] < equity[trough]) trough = i
  }
  if (trough !== peak) out.push({ peak, trough, recover: -1, depth: equity[trough] / equity[peak] - 1 })
  return out.filter(d => d.depth < 0).sort((x, y) => x.depth - y.depth).slice(0, count)
}

function groupStats(trades: Trade[]) {
  const n = trades.length
  const wins = trades.filter(x => x.pnl > 0).length
  const pnl = trades.reduce((s, x) => s + x.pnl, 0)
  const gp = trades.filter(x => x.pnl > 0).reduce((s, x) => s + x.pnl, 0)
  const gl = trades.filter(x => x.pnl <= 0).reduce((s, x) => s + x.pnl, 0)
  return { n, win: n ? wins / n : 0, avg: n ? trades.reduce((s, x) => s + x.pnlPct, 0) / n : 0, pnl, pf: gl < 0 ? gp / -gl : gp > 0 ? Infinity : 0 }
}

export const TRADES_CSV_HEAD = 'id,side,entry_time,entry_price,exit_time,exit_price,qty,bars,pnl,pnl_pct,fees,mae_pct,mfe_pct,reason'

/** Prix avec assez de décimales pour sa taille (BTC : 2, altcoins : jusqu'à 8). */
const csvPrice = (x: number) => +x.toFixed(Math.abs(x) >= 1000 ? 2 : Math.abs(x) >= 1 ? 4 : 8)

export function tradeCsvLine(x: Trade): string {
  return [
    x.id, x.dir === 1 ? 'long' : 'short', new Date(x.entryTime).toISOString(), csvPrice(x.entryPrice), new Date(x.exitTime).toISOString(), csvPrice(x.exitPrice),
    +x.qty.toPrecision(8), x.bars, x.pnl.toFixed(2), (x.pnlPct * 100).toFixed(3), x.fees.toFixed(2), (x.mae * 100).toFixed(3), (x.mfe * 100).toFixed(3), x.reason,
  ].join(',')
}

export function tradesCsv(trades: Trade[]): string {
  return [TRADES_CSV_HEAD, ...trades.map(tradeCsvLine)].join('\n') + '\n'
}

/** Capital, achat conservé et baisse à la dernière clôture de chaque jour UTC. */
export function equityCsv(bars: Bars, out: AppOutput): string {
  const r = out.result
  const lines = ['date,equity,buy_hold,drawdown_pct,position']
  for (let i = r.start; i <= r.end; i++) {
    if (i < r.end && isoDay(bars.t[i + 1]) === isoDay(bars.t[i])) continue
    lines.push([isoDay(bars.t[i]), r.equity[i].toFixed(2), r.benchmark[i].toFixed(2), (r.drawdown[i] * 100).toFixed(3), r.position[i]].join(','))
  }
  return lines.join('\n') + '\n'
}

/** Taille approximative en tokens (texte riche en nombres : environ 3,5 caractères par token). */
export const approxTokens = (text: string) => Math.round(text.length / 3.5)

export function strategyName(out: AppOutput, source: AppSource): string {
  if (source.kind === 'shock') return 'Shock Engine'
  if (source.kind === 'signals') return 'CSV signals'
  return out.name ?? 'Script'
}

export function reportFileName(out: AppOutput, source: AppSource, meta: ReportMeta, ext: string): string {
  const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
  const parts = ['backtest', slug(strategyName(out, source)), slug(meta.market), slug(meta.timeframe), isoDay(meta.now)].filter(Boolean)
  return `${parts.join('-')}.${ext}`
}

// ---------------------------------------------------------------- rapport
export function buildReport(o: {
  out: AppOutput
  bars: Bars
  settings: Settings
  source: AppSource
  meta: ReportMeta
  lang: Lang
  t: Dict
  trades: TradeLimit
  robust: Robust | null
}): string {
  const { out, bars, settings: s, source, meta, lang, t } = o
  const X = TXT[lang]
  const r = out.result
  const m = r.metrics
  const bh = r.benchMetrics
  const intraday = r.end > r.start && bars.t[r.start + 1] - bars.t[r.start] < 86400000
  const when = (time: number) => (intraday ? isoTime(time) : isoDay(time))
  const pct = (x: number, d = 2) => fmtPct(x, lang, d)
  const pctU = (x: number, d = 1) => fmtPct(x, lang, d, false)
  const num = (x: number, d = 2) => fmtNum(x, lang, d)
  const money = (x: number) => fmtMoney(x, lang)
  const rawPct = (v: number) => `${fmtNum(v, lang, 4)} %`
  const L: string[] = []
  const h = (level: number, text: string) => L.push('', `${'#'.repeat(level)} ${text}`, '')

  L.push(`# ${X.title} · ${strategyName(out, source)} · ${meta.market} · ${meta.timeframe}`, '', `> ${X.exported(isoTime(meta.now))}`)

  // En bref
  h(2, X.summary)
  if (m.trades === 0) L.push(`- ${t.verdictNoTrade}`)
  else {
    L.push(`- ${t.verdictMain(money(m.startEquity), money(m.endEquity), pct(m.totalReturn, 1), pct(bh.totalReturn, 1))}`)
    L.push(`- ${t.verdictRisk(pctU(m.maxDrawdown), pctU(bh.maxDrawdown))}`)
    L.push(`- ${t.verdictTrades(m.trades, pctU(m.winRate, 0))}`)
    L.push(`- ${t.stat_cagr} ${pct(m.cagr, 1)} · ${t.stat_sharpe} ${num(m.sharpe)} · ${t.stat_profitFactor} ${num(m.profitFactor)} · ${t.stat_exposure} ${pctU(m.exposure, 0)}`)
  }
  if (out.warnings.length) for (const w of out.warnings) L.push(`- ⚠ ${w[lang]}`)

  // Données
  h(2, X.data)
  const years = (bars.t[r.end] - bars.t[r.start]) / (365.25 * 86400000)
  const dataRows: string[][] = [
    [X.market, meta.market],
    [X.timeframe, meta.timeframe],
    [X.period, X.periodValue(when(bars.t[r.start]), when(bars.t[r.end]), num(years, 1), num(r.end - r.start + 1, 0))],
    [X.oos, r.split > 0 ? X.oosValue(when(bars.t[r.split])) : X.none],
  ]
  L.push(kv(dataRows, lang))

  // Stratégie
  h(2, X.strategy)
  if (source.kind === 'shock') {
    const rows: string[][] = [[X.kind, X.shockKind]]
    if (meta.preset) rows.push([X.preset, meta.presetEdited ? `${meta.preset} (${X.edited})` : meta.preset])
    if (source.adaptive) rows.push([X.adaptive, X.adaptiveValue])
    L.push(kv(rows, lang), '', X.engineRules, '')
    for (const rule of X.shockRules) L.push(`- ${rule}`)
    h(3, X.params)
    const fmtParam = (inp: ShockInput, p: ShockParams | null) => {
      if (!p) return X.noSet
      const v = p[inp.key]
      if (typeof v === 'boolean') return v ? X.yes : X.no
      if (inp.kind === 'select') return inp.options?.find(op => op.value === v)?.label ?? String(v)
      return typeof v === 'number' ? String(+v.toFixed(6)) : String(v)
    }
    const bold = (txt: string, changed: boolean) => (changed ? `**${txt}**` : txt)
    const sets: [string, ShockParams | null][] = source.adaptive
      ? [[X.calm, source.adaptive.calm], [X.agitated, source.adaptive.agitated]]
      : [[X.value, source.params]]
    const rows2 = SHOCK_INPUTS.map(inp => [
      inp.group, inp.title,
      ...sets.map(([, p]) => bold(fmtParam(inp, p), !!p && p[inp.key] !== DEFAULT_PARAMS[inp.key])),
      fmtParam(inp, DEFAULT_PARAMS),
    ])
    L.push(table([X.group, X.param, ...sets.map(x => x[0]), X.def], rows2), '', X.changedNote)
  } else if (source.kind === 'script') {
    L.push(kv([[X.kind, X.scriptKind], [X.scriptName, out.name ?? '—']], lang))
    if (out.inputs.length) {
      h(3, X.params)
      L.push(table([X.inputName, X.param, X.value, X.def], out.inputs.map(inp => {
        const v = source.overrides[inp.name] ?? inp.defval
        return [inp.name, inp.title, v !== inp.defval ? `**${v}**` : String(v), String(inp.defval)]
      })), '', X.changedNote)
    }
    h(3, X.code)
    L.push(fence(source.code))
  } else {
    const op = source.options
    const rows: string[][] = [[X.kind, X.signalsKind], [X.signalsCol, source.file.cols[op.col] ?? String(op.col)], [X.signalsMode, X.signalsModes[op.mode] ?? op.mode]]
    if (op.mode === 'threshold') rows.push([X.thresholds, `${op.lower} / ${op.upper}`])
    L.push(kv(rows, lang))
  }

  // Exécution
  h(2, X.exec)
  const execRows: string[][] = [[X.capital, money(s.capital)]]
  const native = source.kind === 'shock'
  const sizing = native ? 'percent' : s.sizing
  execRows.push([X.size, sizing === 'percent' ? X.sizePercent(rawPct(native && s.sizing !== 'percent' ? 100 : s.sizeValue)) : sizing === 'fixed' ? X.sizeFixed(money(s.sizeValue)) : X.sizeRisk(rawPct(s.sizeValue))])
  const lev = num(s.leverage > 0 ? s.leverage : 1)
  if (sizing === 'risk') execRows.push([X.leverage, X.leverageCap(lev)])
  else execRows.push([X.leverage, s.leverage > 1 || s.fundingPct !== 0 ? X.leverageValue(lev, rawPct(s.maintenancePct), rawPct(s.fundingPct)) : X.noLeverage])
  execRows.push([X.direction, t[`dir_${s.direction}` as const]])
  execRows.push([X.commission, `${rawPct(s.feePct)} ${X.perOrder}`])
  execRows.push([X.slippage, rawPct(s.slippagePct)])
  if (!native && s.feeFixed > 0) execRows.push([X.feeFixed, money(s.feeFixed)])
  execRows.push([X.fill, native ? X.shockFill : t[`fill_${s.fill}` as const]])
  if (!native) {
    const ex: string[] = []
    if (s.stopLossPct) ex.push(`${X.stop} ${rawPct(s.stopLossPct)}`)
    if (s.takeProfitPct) ex.push(`${X.target} ${rawPct(s.takeProfitPct)}`)
    if (s.trailingPct) ex.push(`${X.trailing} ${rawPct(s.trailingPct)}`)
    if (s.maxBars) ex.push(X.maxBars(s.maxBars))
    execRows.push([X.exits, ex.length ? ex.join(', ') : X.noExits])
  }
  L.push(kv(execRows, lang))

  // Résultats
  h(2, X.results)
  const fmtM = (key: keyof Metrics, v: number) => {
    if (key === 'startEquity' || key === 'endEquity' || key === 'netProfit' || key === 'fees') return money(v)
    if (key === 'maxDrawdown' || key === 'volatility' || key === 'exposure' || key === 'winRate') return pctU(v)
    if (key === 'totalReturn' || key === 'cagr' || key.endsWith('Pct')) return pct(v)
    if (key === 'trades' || key === 'maxDrawdownDays' || key === 'maxConsecWins' || key === 'maxConsecLosses') return num(v, 0)
    return num(v)
  }
  const sections: [string, (keyof Metrics)[], boolean][] = [
    [t.stat_section_perf, ['startEquity', 'endEquity', 'netProfit', 'totalReturn', 'cagr', 'years'], true],
    [t.stat_section_risk, ['maxDrawdown', 'maxDrawdownDays', 'volatility', 'sharpe', 'sortino', 'calmar', 'exposure'], true],
    [t.stat_section_trades, ['trades', 'winRate', 'profitFactor', 'avgTradePct', 'avgWinPct', 'avgLossPct', 'payoff', 'bestTradePct', 'worstTradePct', 'avgBars', 'maxConsecWins', 'maxConsecLosses', 'fees'], false],
  ]
  for (const [title, keys, withBh] of sections) {
    h(3, title)
    const label = (k: keyof Metrics) => t[`stat_${k}` as keyof Dict] as string
    L.push(withBh
      ? table([X.metric, t.strategy, t.buyHold], keys.map(k => [label(k), fmtM(k, m[k]), fmtM(k, bh[k])]), [false, true, true])
      : table([X.metric, t.strategy], keys.map(k => [label(k), fmtM(k, m[k])]), [false, true]))
  }

  if (r.inSample && r.outSample) {
    h(3, t.splitTitle)
    const ins = r.inSample
    const oos = r.outSample
    const keys: (keyof Metrics)[] = ['totalReturn', 'cagr', 'sharpe', 'maxDrawdown', 'trades', 'winRate', 'profitFactor']
    L.push(table([X.metric, t.inSample, t.outSample], keys.map(k => [t[`stat_${k}` as keyof Dict] as string, fmtM(k, ins[k]), fmtM(k, oos[k])]), [false, true, true]))
  }

  if (r.trades.length) {
    h(3, X.sides)
    const rowsOf = (label: string, g: ReturnType<typeof groupStats>) => [label, String(g.n), g.n ? pctU(g.win, 0) : '—', g.n ? num(g.pf) : '—', g.n ? pct(g.avg) : '—', g.n ? money(g.pnl) : '—']
    L.push(table([X.side, X.trades, X.winners, t.stat_profitFactor, X.avgTrade, X.result], [
      rowsOf(t.long, groupStats(r.trades.filter(x => x.dir === 1))),
      rowsOf(t.short, groupStats(r.trades.filter(x => x.dir === -1))),
    ], [false, true, true, true, true, true]))

    h(3, X.byReason)
    const reasons = [...new Set(r.trades.map(x => x.reason))]
    L.push(table([X.reason, X.trades, X.winners, t.stat_profitFactor, X.avgTrade, X.result], reasons.map(re => rowsOf(t[`reason_${re}` as const], groupStats(r.trades.filter(x => x.reason === re)))), [false, true, true, true, true, true]))
  }

  const sp = periodReturns(bars, r.equity, r.start, r.end, m.startEquity)
  const bp = periodReturns(bars, r.benchmark, r.start, r.end, m.startEquity)
  h(3, X.yearly)
  const byb = new Map(bp.years.map(y => [y.year, y.ret]))
  L.push(table([t.year, t.strategy, t.buyHold], sp.years.map(y => [String(y.year), pct(y.ret, 1), pct(byb.get(y.year) ?? 0, 1)]), [false, true, true]))

  h(3, X.monthly)
  const grid = new Map(sp.months.map(x => [`${x.year}-${x.month}`, x.ret]))
  L.push(table([t.year, ...t.monthsShort, t.total], sp.years.map(y => [
    String(y.year),
    ...t.monthsShort.map((_, k) => {
      const v = grid.get(`${y.year}-${k}`)
      return v === undefined ? '' : pct(v, 1)
    }),
    pct(y.ret, 1),
  ]), [false, ...t.monthsShort.map(() => true), true]))

  const dds = worstDrawdowns(r.equity, r.start, r.end)
  if (dds.length) {
    h(3, X.drawdowns)
    L.push(table(['#', X.ddPeak, X.ddTrough, X.ddRecover, X.ddDepth, X.ddDays], dds.map((d, k) => [
      String(k + 1), when(bars.t[d.peak]), when(bars.t[d.trough]), d.recover >= 0 ? when(bars.t[d.recover]) : X.notRecovered, pctU(d.depth),
      num(((d.recover >= 0 ? bars.t[d.recover] : bars.t[r.end]) - bars.t[d.peak]) / 86400000, 0),
    ]), [false, false, false, false, true, true]))
  }

  if (o.robust) {
    h(3, X.robust)
    const rn = o.robust.random
    const bt = o.robust.boot
    L.push(rn ? `- ${X.random(pctU(rn.percentile), num(ROBUST_SIMS, 0), pct(rn.median, 1), pct(rn.p5, 1), pct(rn.p95, 1))}` : `- ${X.randomNone}`)
    L.push(bt ? `- ${X.boot(pctU(bt.probLoss), pct(bt.final5, 1), pct(bt.final95, 1), pctU(bt.dd95))}` : `- ${X.bootNone}`)
  }

  if (out.warnings.length) {
    h(2, X.warnings)
    for (const w of out.warnings) L.push(`- ${w[lang]}`)
  }

  const n = r.trades.length
  const k = o.trades === 'all' ? n : Math.min(n, o.trades)
  h(2, X.tradesTitle(k, n))
  if (k === 0) L.push(n ? X.tradesNone(n) : t.noTrades)
  else L.push(X.tradesCols, '', fence(tradesCsv(r.trades.slice(n - k)), 'csv'))

  h(2, X.defs)
  for (const d of X.defsList) L.push(`- ${d}`)
  return L.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
