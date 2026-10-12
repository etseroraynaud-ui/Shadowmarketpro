// Couche probabiliste · jeu de données des signaux : une ligne par trade du portefeuille de référence.
//
// Les trades sont reconstruits par exactement le chemin de research/shock/portfolio.ts --variant e2 :
// sleeves de research/lib/frozen-shock.ts, shorts masqués hors régime E2 (research/lib/e2.ts),
// commission 0,045 % par exécution, entrée dans la fenêtre commune. Le moteur n'est pas modifié ;
// rien n'est ré-estimé. Le nombre de trades doit être celui du rapport publié, sinon arrêt.

import { loadSleeve, costsFor } from '../lib/frozen-shock.ts'
import type { Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { trendDown } from '../lib/e2.ts'
import { loadBtc } from '../lib/data.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult, PositionRecord } from '../../lib/strategies/shock/engine.ts'
import { marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import { AMBIGUOUS_FEES_R, DAY, HORIZONS, M15, REFERENCE } from './config.ts'
import type { Horizon } from './config.ts'
import { signalContext, signalFeatures, FEATURE_DOC } from './features.ts'
import type { SignalContext, SignalFeatures } from './features.ts'

export const ASSET: Record<SleeveKey, 'BTC' | 'ETH'> = { btc: 'BTC', ethusdt: 'ETH' }
export const KEYS: SleeveKey[] = ['btc', 'ethusdt']

/** Sleeve de référence (E2), son run et le contexte des signaux. */
export interface ReferenceSleeve {
  key: SleeveKey
  sleeve: Sleeve
  /** Barres journalières source du régime (BTC : 60 min Bitstamp ; ETH : 15 min Binance). */
  regimeBars: Bars
  signals: { long: Uint8Array; short: Uint8Array }
  run: ShockResult
  ctx: SignalContext
}

/** Barres de la source du régime, comme portfolio.ts --variant e2. */
export function regimeBarsFor(key: SleeveKey, s: Sleeve): Bars {
  return key === 'btc' ? resample(loadBtc(60), DAY) : resample(s.bars, DAY)
}

export function referenceSleeve(key: SleeveKey): ReferenceSleeve {
  const s = loadSleeve(key)
  const regimeBars = regimeBarsFor(key, s)
  const trend = trendDown(s.bars, regimeBars)
  const signals = { long: s.signals.long, short: Uint8Array.from(s.signals.short, (x, i) => (x && trend[i] ? 1 : 0)) }
  const run = simulate(s.m, s.preset.sets, costsFor(key, 1), s.lo, s.end, s.select, signals)
  const prs = s.preset.sets.map(p => prepare(s.m, p))
  const ctx = signalContext(ASSET[key], s.m, s.preset.sets, prs, s.select, regimeBars)
  return { key, sleeve: s, regimeBars, signals, run, ctx }
}

/**
 * Contexte des signaux recalculé sur un historique coupé à la bougie i (le futur n'existe pas) :
 * mêmes barres de départ, même source du régime coupée à la clôture de la bougie. Sert aux tests
 * anti-look-ahead et au scoring rétrospectif.
 */
export function truncatedContext(ref: ReferenceSleeve, i: number): SignalContext {
  const s = ref.sleeve
  const b = s.bars
  const close = b.t[i] + M15
  const bars = sliceBars(b, b.t[0], b.t[i])
  let regime: Bars
  if (ref.key === 'btc') {
    const h = loadBtc(60)
    let n = 0
    while (n < h.n && h.t[n] + 3600000 <= close) n++
    regime = resample({ n, t: h.t.subarray(0, n), o: h.o.subarray(0, n), h: h.h.subarray(0, n), l: h.l.subarray(0, n), c: h.c.subarray(0, n), v: h.v.subarray(0, n) }, DAY)
  } else regime = resample(bars, DAY)
  const m = marketFor(bars, 15, s.preset.mintick)
  const select = selectFor(s.preset, m, regime).select
  const prs = s.preset.sets.map(p => prepare(m, p))
  return signalContext(ASSET[ref.key], m, s.preset.sets, prs, select, regime)
}

export interface HorizonTarget {
  /** d · ln(P_{t+h} / P_t). */
  ret: number
  /** 1 si ret > 0. */
  y: number
  /** Clôture prévue de la bougie i + h (ms UTC) : date de connaissance du label. */
  labelTime: number
  /** La dernière clôture connue n'est pas à l'heure prévue (trou de données). */
  gap: boolean
}

export interface TradeRow {
  id: string
  asset: 'BTC' | 'ETH'
  key: SleeveKey
  dir: 1 | -1
  tag: string
  set: number
  volRegime: 'calme' | 'agité'
  /** Tendance journalière (classify) au dernier jour clos. */
  trendRegime: 'haussière' | 'neutre' | 'baissière' | 'inconnue'
  entryIdx: number
  exitIdx: number
  /** Clôture de la bougie de signal = exécution de l'entrée (ms UTC). */
  entryTime: number
  /** Clôture de la bougie de sortie (ms UTC) : date de connaissance de R. */
  exitTime: number
  exits: string
  entryPrice: number
  exitPrice: number
  qty: number
  notional: number
  equityAtEntry: number
  atrEntry: number
  stopMult: number
  /** Distance du stop initial, en prix. */
  stopDist: number
  /** Risque initial en monnaie : quantité × distance du stop. */
  risk: number
  pnl: number
  fees: number
  /** PnL net / equity à l'entrée (rendement du trade du rapport publié). */
  ret: number
  R: number
  Rgross: number
  feesR: number
  /** Normalisation possible (risque fini et > 0). */
  valid: boolean
  /** Commissions > AMBIGUOUS_FEES_R × risque. */
  ambiguous: boolean
  win: number
  r1: number
  r2: number
  r3: number
  mfeR: number
  maeR: number
  holdBars: number
  features: SignalFeatures
  horizons: Record<Horizon, HorizonTarget | null>
}

function horizonTarget(bars: Bars, i: number, dir: 1 | -1, h: number): HorizonTarget | null {
  const T = bars.t[i] + (h + 1) * M15
  if (T > bars.t[bars.n - 1] + M15) return null
  let j = i
  while (j + 1 < bars.n && bars.t[j + 1] + M15 <= T) j++
  const ret = dir * Math.log(bars.c[j] / bars.c[i])
  return { ret, y: ret > 0 ? 1 : 0, labelTime: T, gap: bars.t[j] + M15 !== T }
}

const iso = (ms: number) => new Date(ms).toISOString()
const idOf = (asset: string, t: number, dir: number) => `${asset}-${iso(t).slice(0, 16).replace(/[-:]/g, '')}-${dir === 1 ? 'L' : 'S'}`

export function tradeRow(ref: ReferenceSleeve, p: PositionRecord, ctx: SignalContext = ref.ctx): TradeRow {
  const s = ref.sleeve
  const b = s.bars
  const P = s.preset.sets[p.set]
  const f = signalFeatures(ctx, p.entryIdx, p.dir)
  if (f.set !== p.set) throw new Error(`jeu du signal ${f.set} ≠ jeu de la position ${p.set}`)
  const atrSafe = Math.max(p.atrAtEntry, s.preset.mintick)
  const stopDist = P.atrStopMult * atrSafe
  const risk = p.qty * stopDist
  const valid = Number.isFinite(risk) && risk > 0
  const R = valid ? p.pnl / risk : NaN
  const feesR = valid ? p.fees / risk : NaN
  const entryTime = b.t[p.entryIdx] + M15
  const hz = {} as Record<Horizon, HorizonTarget | null>
  for (const h of HORIZONS) hz[h] = horizonTarget(b, p.entryIdx, p.dir, h)
  const D = ctx.daily
  const k = D.dayOf[p.entryIdx]
  const trend = k >= 0 && D.id[k] >= 0 ? D.id[k] >> 1 : -1
  return {
    id: idOf(ASSET[ref.key], entryTime, p.dir), asset: ASSET[ref.key], key: ref.key, dir: p.dir, tag: p.tag, set: p.set,
    volRegime: p.set === 1 ? 'agité' : 'calme', trendRegime: (['haussière', 'neutre', 'baissière'] as const)[trend] ?? 'inconnue',
    entryIdx: p.entryIdx, exitIdx: p.exitIdx, entryTime, exitTime: b.t[p.exitIdx] + M15, exits: p.exits.join('+'),
    entryPrice: p.entryPrice, exitPrice: p.exitPrice, qty: p.qty, notional: p.notional, equityAtEntry: p.equityAtEntry,
    atrEntry: p.atrAtEntry, stopMult: P.atrStopMult, stopDist, risk, pnl: p.pnl, fees: p.fees, ret: p.pnl / p.equityAtEntry,
    R, Rgross: valid ? (p.pnl + p.fees) / risk : NaN, feesR, valid, ambiguous: valid && feesR > AMBIGUOUS_FEES_R,
    win: R > 0 ? 1 : 0, r1: R >= 1 ? 1 : 0, r2: R >= 2 ? 1 : 0, r3: R >= 3 ? 1 : 0,
    // Excursions en ATR d'entrée (broker.ts) ramenées au risque initial.
    mfeR: (p.mfeAtr * p.atrAtEntry) / stopDist, maeR: (p.maeAtr * p.atrAtEntry) / stopDist,
    holdBars: p.exitIdx - p.entryIdx, features: f, horizons: hz,
  }
}

export interface Dataset {
  rows: TradeRow[]
  refs: Record<SleeveKey, ReferenceSleeve>
  /** Trades exclus (normalisation impossible, sortie forcée en fin de données). */
  excluded: { id: string; reason: string }[]
}

/** Les trades du portefeuille de référence, triés par heure d'entrée. */
export function buildDataset(refs?: Record<SleeveKey, ReferenceSleeve>): Dataset {
  const R = refs ?? { btc: referenceSleeve('btc'), ethusdt: referenceSleeve('ethusdt') }
  const a = Date.parse(REFERENCE.start), z = Date.parse(REFERENCE.end)
  const rows: TradeRow[] = []
  const excluded: { id: string; reason: string }[] = []
  for (const key of KEYS) {
    const ref = R[key]
    const t = ref.sleeve.bars.t
    const ps = ref.run.positions.filter(p => t[p.entryIdx] >= a && t[p.entryIdx] < z)
    if (ps.length !== REFERENCE.trades[key]) throw new Error(`${ASSET[key]} : ${ps.length} trades, ${REFERENCE.trades[key]} attendus (rapport publié)`)
    for (const p of ps) {
      const row = tradeRow(ref, p)
      if (p.exits.includes('END')) { excluded.push({ id: row.id, reason: 'position encore ouverte en fin de données (sortie forcée)' }); continue }
      if (!row.valid) { excluded.push({ id: row.id, reason: 'risque initial non fini ou nul' }); continue }
      rows.push(row)
    }
  }
  rows.sort((x, y) => x.entryTime - y.entryTime || x.asset.localeCompare(y.asset))
  return { rows, refs: R, excluded }
}

/**
 * Trades du même chemin dont la clôture de la bougie d'entrée est postérieure à `after` (suivi
 * prospectif). `closed` : seulement les positions fermées par une vraie sortie.
 */
export function tradesAfter(refs: Record<SleeveKey, ReferenceSleeve>, after: number, closed = true): { row: TradeRow; ref: ReferenceSleeve; p: PositionRecord }[] {
  const out: { row: TradeRow; ref: ReferenceSleeve; p: PositionRecord }[] = []
  for (const key of KEYS) {
    const ref = refs[key]
    const t = ref.sleeve.bars.t
    for (const p of ref.run.positions) {
      if (t[p.entryIdx] + M15 <= after) continue
      if (closed && p.exits.includes('END')) continue
      out.push({ row: tradeRow(ref, p), ref, p })
    }
  }
  return out.sort((x, y) => x.row.entryTime - y.row.entryTime)
}

// ---------------------------------------------------------------- CSV et schéma

type Col = { name: string; role: 'id' | 'feature' | 'descriptive' | 'target' | 'outcome' | 'trade'; atEntry: boolean; doc: string; get: (r: TradeRow) => string | number | boolean | null }

const MODEL_FEATURE_NAMES = new Set(['absZ', 'volZ', 'breakAtr', 'closeQ', 'lamPct', 'rv', 'volPct', 'htfDist', 'isShort', 'isEth', 'agitated'])

export const COLUMNS: Col[] = [
  { name: 'trade_id', role: 'id', atEntry: true, doc: 'ACTIF-AAAAMMJJTHHMM-L|S, heure = clôture de la bougie de signal (UTC)', get: r => r.id },
  { name: 'asset', role: 'id', atEntry: true, doc: 'BTC (Bitstamp BTC/USD) ou ETH (Binance ETH/USDT)', get: r => r.asset },
  { name: 'direction', role: 'id', atEntry: true, doc: 'long ou short', get: r => (r.dir === 1 ? 'long' : 'short') },
  { name: 'entry_time', role: 'id', atEntry: true, doc: 'clôture de la bougie de signal, ISO UTC (exécution de l\'entrée)', get: r => iso(r.entryTime) },
  { name: 'exit_time', role: 'trade', atEntry: false, doc: 'clôture de la bougie de sortie, ISO UTC', get: r => iso(r.exitTime) },
  { name: 'vol_regime', role: 'id', atEntry: true, doc: 'régime de volatilité du moteur (calme / agité), jours clos', get: r => r.volRegime },
  { name: 'trend_regime', role: 'id', atEntry: true, doc: 'tendance journalière de classify, dernier jour clos', get: r => r.trendRegime },
  { name: 'entry_tag', role: 'id', atEntry: true, doc: 'IMP (choc principal) ou μIMP (choc micro)', get: r => r.tag },
  { name: 'set', role: 'id', atEntry: true, doc: 'jeu de réglages qui décide (0 calme, 1 agité)', get: r => r.set },
  ...(Object.keys(FEATURE_DOC) as (keyof SignalFeatures)[]).filter(k => k !== 'set').map(k => ({
    name: `f_${k}`, role: (MODEL_FEATURE_NAMES.has(k) ? 'feature' : 'descriptive') as Col['role'], atEntry: true, doc: FEATURE_DOC[k], get: (r: TradeRow) => r.features[k],
  })),
  { name: 'entry_price', role: 'trade', atEntry: true, doc: 'prix d\'exécution de l\'entrée (= clôture de signal, glissement nul)', get: r => r.entryPrice },
  { name: 'stop_mult', role: 'trade', atEntry: true, doc: 'atrStopMult du jeu qui décide', get: r => r.stopMult },
  { name: 'stop_dist', role: 'trade', atEntry: true, doc: 'distance du stop initial, en prix = stop_mult × ATR d\'entrée', get: r => r.stopDist },
  { name: 'qty', role: 'trade', atEntry: true, doc: 'quantité (100 % de l\'equity, sans levier)', get: r => r.qty },
  { name: 'risk', role: 'trade', atEntry: true, doc: 'risque initial en monnaie = qty × stop_dist', get: r => r.risk },
  { name: 'equity_at_entry', role: 'trade', atEntry: true, doc: 'equity de la sleeve à l\'entrée', get: r => r.equityAtEntry },
  { name: 'exit_price', role: 'outcome', atEntry: false, doc: 'prix de sortie moyen pondéré', get: r => r.exitPrice },
  { name: 'exits', role: 'outcome', atEntry: false, doc: 'sorties exécutées (SL, TP1, TRAIL, FLIP…)', get: r => r.exits },
  { name: 'pnl_net', role: 'outcome', atEntry: false, doc: 'PnL après commissions d\'entrée et de sortie', get: r => r.pnl },
  { name: 'fees', role: 'outcome', atEntry: false, doc: 'commissions du trade (0,045 % par exécution)', get: r => r.fees },
  { name: 'ret', role: 'outcome', atEntry: false, doc: 'pnl_net / equity_at_entry', get: r => r.ret },
  { name: 'R', role: 'target', atEntry: false, doc: 'pnl_net / risk', get: r => r.R },
  { name: 'R_gross', role: 'outcome', atEntry: false, doc: '(pnl_net + fees) / risk', get: r => r.Rgross },
  { name: 'fees_R', role: 'outcome', atEntry: false, doc: 'fees / risk (R = R_gross − fees_R)', get: r => r.feesR },
  { name: 'ambiguous_R', role: 'outcome', atEntry: false, doc: `fees_R > ${AMBIGUOUS_FEES_R}`, get: r => r.ambiguous },
  { name: 'y_win', role: 'target', atEntry: false, doc: '1(R > 0)', get: r => r.win },
  { name: 'y_r1', role: 'target', atEntry: false, doc: '1(R ≥ 1)', get: r => r.r1 },
  { name: 'y_r2', role: 'target', atEntry: false, doc: '1(R ≥ 2)', get: r => r.r2 },
  { name: 'y_r3', role: 'target', atEntry: false, doc: '1(R ≥ 3)', get: r => r.r3 },
  ...HORIZONS.flatMap(h => [
    { name: `ret_h${h}`, role: 'target' as const, atEntry: false, doc: `d·ln(P_{t+${h}}/P_t), dernière clôture connue à la clôture prévue de la bougie i+${h}`, get: (r: TradeRow) => r.horizons[h]?.ret ?? null },
    { name: `y_h${h}`, role: 'target' as const, atEntry: false, doc: `1(ret_h${h} > 0)`, get: (r: TradeRow) => r.horizons[h]?.y ?? null },
    { name: `gap_h${h}`, role: 'outcome' as const, atEntry: false, doc: 'clôture de remplissage antérieure à l\'heure prévue (trou de données)', get: (r: TradeRow) => r.horizons[h]?.gap ?? null },
  ]),
  { name: 'mfe_R', role: 'outcome', atEntry: false, doc: 'excursion favorable maximale / risque initial (résultat futur)', get: r => r.mfeR },
  { name: 'mae_R', role: 'outcome', atEntry: false, doc: 'excursion défavorable maximale / risque initial (résultat futur, ≤ 0)', get: r => r.maeR },
  { name: 'hold_bars', role: 'outcome', atEntry: false, doc: 'bougies de 15 min entre entrée et sortie', get: r => r.holdBars },
]

const cell = (v: string | number | boolean | null) => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return Number.isFinite(v) ? (Number.isInteger(v) ? String(v) : String(+v.toPrecision(10))) : ''
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

export function datasetCsv(rows: TradeRow[]): string {
  return [COLUMNS.map(c => c.name).join(','), ...rows.map(r => COLUMNS.map(c => cell(c.get(r))).join(','))].join('\n') + '\n'
}

export function datasetSchema() {
  return COLUMNS.map(c => ({ name: c.name, role: c.role, availableAtEntry: c.atEntry, description: c.doc }))
}
