// Audit des latences et des coûts d'exécution du bot à partir de ce qui existe déjà, sans toucher
// au bot ni à son processus :
// 1. ses journaux (events-*.jsonl, shadow et/ou réel), copiés depuis le serveur : heures locales des
//    événements (bougie lue, signal, entrée, sortie, stop) ;
// 2. les données publiques Hyperliquid du compte tradé (historique des ordres, fills, bougies 15 min) :
//    heure de l'exchange (bloc) de chaque ordre du bot, reconnu par son identifiant client (cloid).
// Aucune clé : une adresse Hyperliquid est publique.
//
// Sortie : distributions (n, P50, P90, P95, P99) par segment, actif, type d'ordre et régime, et la
// liste des points de mesure absents des journaux. Les variables internes de la stratégie présentes
// dans les journaux (champ `sets` des signaux) ne sont jamais lues ni recopiées.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/latency-audit.ts \
//     [--logs dir1,dir2] [--address 0x… --net testnet|mainnet --coin BTC] [--since 2026-10-01T00:00:00Z] \
//     [--out research/reports/execution/latency-audit.json]

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloidKind } from '../../lib/hyperliquid/cloid.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const STEP = 15 * 60000
/** Au-delà de ce délai après une clôture, un ordre n'est plus rattaché à cette clôture (stop suiveur, etc.). */
export const AT_CLOSE_MS = 60000

// ---------------------------------------------------------------- statistiques

export function quantile(xs: number[], p: number): number {
  const a = xs.filter(Number.isFinite).sort((u, v) => u - v)
  if (!a.length) return NaN
  const h = (a.length - 1) * p
  const lo = Math.floor(h)
  return a[lo] + (a[Math.min(lo + 1, a.length - 1)] - a[lo]) * (h - lo)
}

export interface Dist { n: number; p50: number; p90: number; p95: number; p99: number; max: number; indicative: boolean }
export function dist(xs: number[]): Dist {
  const a = xs.filter(Number.isFinite)
  return { n: a.length, p50: quantile(a, 0.5), p90: quantile(a, 0.9), p95: quantile(a, 0.95), p99: quantile(a, 0.99), max: a.length ? Math.max(...a) : NaN, indicative: a.length < 20 }
}

/** Distributions par groupe : clé → valeurs. */
function groups(rows: { key: string; v: number }[]): Record<string, Dist> {
  const m = new Map<string, number[]>()
  for (const r of rows) m.set(r.key, [...(m.get(r.key) ?? []), r.v])
  return Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, dist(v)]))
}

// ---------------------------------------------------------------- journaux du bot

type Ev = Record<string, any> & { time: string; type: string; mode: string; engine?: string }

export function readJournals(dirs: string[], since = ''): Ev[] {
  const out: Ev[] = []
  for (const d of dirs) {
    if (!existsSync(d)) throw new Error(`${d} introuvable`)
    for (const f of readdirSync(d).filter(x => /^events-.*\.jsonl$/.test(x)).sort()) {
      for (const line of readFileSync(join(d, f), 'utf8').split('\n')) {
        if (!line.trim()) continue
        const e = JSON.parse(line) as Ev
        if (!since || e.time >= since) out.push({ ...e, _src: d })
      }
    }
  }
  return out
}

const ms = (iso: string) => Date.parse(iso)
const bps = (x: number) => x * 1e4

export interface JournalAudit {
  bars: number
  segments: Record<string, Record<string, Dist>>
  costsBps: Record<string, Record<string, Dist>>
  counts: Record<string, number>
}

/**
 * Lecture d'un journal, dans l'ordre : chaque événement est rattaché à la dernière bougie lue
 * (market_bar) du même processus. Segments en millisecondes depuis la clôture théorique T.
 */
export function auditJournal(evs: Ev[]): JournalAudit {
  const seg: Record<string, { key: string; v: number }[]> = {}
  const cost: Record<string, { key: string; v: number }[]> = {}
  const counts: Record<string, number> = {}
  const add = (o: typeof seg, name: string, key: string, v: number) => { if (Number.isFinite(v)) (o[name] ??= []).push({ key, v }) }
  const count = (k: string) => { counts[k] = (counts[k] ?? 0) + 1 }
  // Bougie courante par processus (dossier + mode) ; signal et position par moteur (le shadow mode
  // fait tourner le backtest pas à pas et le moteur live papier dans le même processus).
  const bar = new Map<string, { coin: string; T: number; barAt: number }>()
  const eng = new Map<string, { regime: string; signalAt: number | null; dir: number; exitAt: number | null; T: number }>()
  let bars = 0
  for (const e of [...evs].sort((a, b) => a.time.localeCompare(b.time))) {
    const id = `${e._src}|${e.mode}`
    const s = bar.get(id) ?? { coin: '?', T: NaN, barAt: NaN }
    bar.set(id, s)
    const p = eng.get(`${id}|${e.engine ?? ''}`) ?? { regime: '?', signalAt: null, dir: 0, exitAt: null, T: NaN }
    eng.set(`${id}|${e.engine ?? ''}`, p)
    // Nouvelle bougie : signal et retournement de la précédente oubliés.
    if (p.T !== s.T) { p.T = s.T; p.signalAt = null; p.exitAt = null }
    const src = `${e.mode}${e.engine ? '/' + e.engine : ''}`
    const k = (what: string) => `${src}|${s.coin}|${what}`
    const t = ms(e.time)
    switch (e.type) {
      case 'start':
        s.coin = String(e.coin ?? '?')
        break
      case 'market_bar': {
        bars++
        s.T = ms(e.bar)
        s.barAt = t
        add(seg, 'close_to_bar_read', k(e.reason), t - s.T)
        count(`bar_read_${e.reason}`)
        // Chronologie détaillée (bot instrumenté) : message WebSocket, lecture lancée, bougie lue.
        if (e.timing) for (const [name, v] of Object.entries(e.timing as Record<string, number | null>)) if (v != null) add(seg, `loop_${name}`, k(e.reason), v)
        if (e.ws) count(e.ws.same ? 'ws_equals_rest' : 'ws_differs_from_rest')
        else count('ws_not_seen')
        if (e.spread?.maxBps != null) add(cost, 'bar_max_spread', k('all'), e.spread.maxBps)
        break
      }
      case 'signal':
        // Signal du backtest pas à pas (shadow, sans moteur) ou du moteur live / papier.
        if (ms(e.bar) !== s.T) break
        p.regime = String(e.regime ?? '?')
        if ((e.engine ?? null) === null && e.mode === 'shadow') break
        p.signalAt = t
        add(seg, 'close_to_decision', k(p.regime), t - s.T)
        add(seg, 'bar_read_to_decision', k(p.regime), t - s.barAt)
        break
      case 'entry': {
        const dir = e.side === 'buy' ? 1 : -1
        const kind = p.exitAt != null ? 'reversal_entry' : 'entry'
        add(seg, 'close_to_entry_logged', k(kind), t - s.T)
        if (p.signalAt != null) add(seg, 'decision_to_entry_logged', k(kind), t - p.signalAt)
        if (p.exitAt != null) add(seg, 'reversal_exit_to_entry', k('reversal'), t - p.exitAt)
        const mid = (e.bid + e.ask) / 2
        add(cost, 'entry_vs_close', k(p.regime), bps(dir * (e.avg - e.ref) / e.ref))
        add(cost, 'entry_mid_drift_at_quote', k(p.regime), bps(dir * (mid - e.ref) / e.ref))
        add(cost, 'entry_half_spread', k(p.regime), e.spreadBps / 2)
        p.dir = dir
        count(kind)
        break
      }
      case 'exit': {
        // Fermeture au marché à la clôture (VWAP, FLIP, REV, SL déjà franchi…).
        const dir = e.side === 'sell' ? 1 : -1
        add(seg, 'close_to_exit_logged', k(e.tag), t - s.T)
        add(cost, 'market_exit_vs_close', k(e.tag), bps(dir * (e.ref - e.avg) / e.ref))
        if (e.tag === 'REV') p.exitAt = t
        count(`exit_${e.tag}`)
        break
      }
      case 'exit_fill': {
        // Sortie exécutée par l'exchange (stop, stop suiveur, TP1) : écart au niveau de l'ordre.
        if (p.dir) add(cost, 'resting_exit_vs_level', k(e.tag), bps(p.dir * (e.ref - e.px) / e.ref))
        count(`exit_fill_${e.tag}`)
        break
      }
      case 'stop_placed':
        if (t - s.T < AT_CLOSE_MS) add(seg, 'close_to_stop_placed', k('at_close'), t - s.T)
        count('stop_placed')
        break
      case 'stop_moved':
        count(t - s.T < AT_CLOSE_MS ? 'stop_moved_at_close' : 'stop_moved_intrabar')
        break
      case 'trade':
        p.dir = 0
        break
      case 'bar': {
        // Chronologie de la clôture côté moteur : état lu, décision, fin ; envoi et réponse de chaque ordre.
        const tm = e.timing as (Record<string, number> & { orders?: [string, number, number, string][] }) | null
        if (!tm) break
        for (const [name, v] of Object.entries(tm)) if (typeof v === 'number') add(seg, `engine_${name}`, k(p.regime), v)
        for (const [kind, sent, acked] of tm.orders ?? []) {
          add(seg, 'order_sent', k(kind), sent)
          add(seg, 'order_round_trip', k(kind), acked - sent)
        }
        break
      }
      case 'entry_skipped': case 'entry_failed': case 'entry_blocked': case 'HALT': case 'retry': case 'order_resolved':
      case 'candle_revised': case 'stop_rejected': case 'stop_move_failed': case 'cancel_failed': case 'ws_reconnected': case 'ws_stale':
        count(e.type)
        break
    }
  }
  const out = (o: typeof seg) => Object.fromEntries(Object.entries(o).map(([n, rows]) => [n, groups(rows)]))
  return { bars, segments: out(seg), costsBps: out(cost), counts }
}

// ---------------------------------------------------------------- données publiques Hyperliquid

const INFO = { mainnet: 'https://api.hyperliquid.xyz/info', testnet: 'https://api.hyperliquid-testnet.xyz/info' } as const
type Net = keyof typeof INFO

async function info<T>(net: Net, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(INFO[net], { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`Hyperliquid ${body.type} : HTTP ${res.status}`)
  return res.json() as Promise<T>
}

export interface RawOrder {
  order: { coin: string; side: 'B' | 'A'; limitPx: string; sz: string; oid: number; timestamp: number; isTrigger: boolean; triggerPx: string; orderType: string; origSz: string; tif: string | null; cloid?: string | null; reduceOnly: boolean }
  status: string
  statusTimestamp: number
}
export interface RawFill { coin: string; px: string; sz: string; side: 'B' | 'A'; time: number; oid: number; crossed: boolean; fee: string; tid: number; cloid?: string | null; dir: string }
export interface RawCandle { t: number; c: string }

export interface PublicData { orders: RawOrder[]; fills: RawFill[]; candles: RawCandle[] }

export async function fetchPublic(net: Net, user: string, coin: string, since: number): Promise<PublicData> {
  const orders = await info<RawOrder[]>(net, { type: 'historicalOrders', user })
  const fills: RawFill[] = []
  let start = since
  for (let guard = 0; guard < 10; guard++) {
    const rows = await info<RawFill[]>(net, { type: 'userFillsByTime', user, startTime: start, aggregateByTime: false })
    fills.push(...rows)
    if (rows.length < 2000) break
    start = Math.max(...rows.map(r => r.time)) + 1
  }
  const candles = await info<RawCandle[]>(net, { type: 'candleSnapshot', req: { coin, interval: '15m', startTime: Math.max(since, Date.now() - 5000 * STEP), endTime: Date.now() } })
  return { orders: orders.filter(o => o.order.coin === coin && o.order.timestamp >= since), fills: fills.filter(f => f.coin === coin), candles }
}

export interface OrderRow {
  oid: number
  kind: string
  side: 'buy' | 'sell'
  type: string
  placedAt: number
  /** Clôture 15 min qui précède l'ordre, et délai depuis cette clôture. */
  T: number
  fromCloseMs: number
  atClose: boolean
  status: string
  statusAt: number
  origSz: number
  filledSz: number
  fillRatio: number
  avgPx: number | null
  firstFillMs: number | null
  lastFillMs: number | null
  taker: boolean | null
  feeBps: number | null
  /** Écart signé au prix de clôture de la bougie close à T (positif = défavorable), en pb. */
  vsCloseBps: number | null
  /** Stop déclenché : écart signé au niveau de déclenchement, en pb. */
  vsTriggerBps: number | null
}

/** Ordres du bot (cloid reconnu) : un par identifiant, statut final, fills rattachés. */
export function auditOrders(d: PublicData): OrderRow[] {
  const byOid = new Map<number, RawOrder>()
  for (const o of d.orders) {
    const prev = byOid.get(o.order.oid)
    if (!prev || (prev.status === 'open' && o.status !== 'open') || o.statusTimestamp > prev.statusTimestamp) byOid.set(o.order.oid, o)
  }
  const closeAt = new Map(d.candles.map(c => [c.t + STEP, +c.c]))
  const rows: OrderRow[] = []
  for (const o of byOid.values()) {
    const kind = cloidKind(o.order.cloid ?? null) ?? (o.order.cloid ? 'other' : 'manual')
    const fs = d.fills.filter(f => f.oid === o.order.oid).sort((a, b) => a.time - b.time)
    const filled = fs.reduce((a, f) => a + +f.sz, 0)
    const notional = fs.reduce((a, f) => a + +f.px * +f.sz, 0)
    const avg = filled > 0 ? notional / filled : null
    const sgn = o.order.side === 'B' ? 1 : -1
    const T = Math.floor(o.order.timestamp / STEP) * STEP
    const close = closeAt.get(T)
    const trig = o.order.isTrigger ? +o.order.triggerPx : NaN
    const origSz = +o.order.origSz
    rows.push({
      oid: o.order.oid, kind, side: sgn === 1 ? 'buy' : 'sell', type: `${o.order.orderType}${o.order.tif ? ' ' + o.order.tif : ''}`,
      placedAt: o.order.timestamp, T, fromCloseMs: o.order.timestamp - T, atClose: o.order.timestamp - T < AT_CLOSE_MS,
      status: o.status, statusAt: o.statusTimestamp, origSz, filledSz: filled, fillRatio: origSz > 0 ? filled / origSz : NaN, avgPx: avg,
      firstFillMs: fs.length ? fs[0].time - o.order.timestamp : null, lastFillMs: fs.length ? fs[fs.length - 1].time - o.order.timestamp : null,
      taker: fs.length ? fs.every(f => f.crossed) : null, feeBps: notional > 0 ? bps(fs.reduce((a, f) => a + +f.fee, 0) / notional) : null,
      vsCloseBps: avg != null && close != null ? bps(sgn * (avg - close) / close) : null,
      vsTriggerBps: avg != null && Number.isFinite(trig) ? bps(sgn * (avg - trig) / trig) : null,
    })
  }
  return rows.sort((a, b) => a.placedAt - b.placedAt)
}

export function summarizeOrders(rows: OrderRow[]) {
  const bot = rows.filter(r => r.kind !== 'manual' && r.kind !== 'other')
  const at = (f: (r: OrderRow) => boolean, v: (r: OrderRow) => number | null) => groups(bot.filter(f).map(r => ({ key: `${r.kind}${r.atClose ? '' : ' (intrabar)'}`, v: v(r) ?? NaN })))
  return {
    orders: { bot: bot.length, manual: rows.filter(r => r.kind === 'manual').length, byKind: Object.fromEntries([...new Set(bot.map(r => r.kind))].map(k => [k, bot.filter(r => r.kind === k).length])) },
    closeToExchangeMs: at(r => r.atClose, r => r.fromCloseMs),
    placedToFirstFillMs: at(r => r.firstFillMs != null, r => r.firstFillMs),
    fillRatio: at(r => r.status !== 'open', r => r.fillRatio),
    vsCloseBps: at(r => r.vsCloseBps != null && r.atClose, r => r.vsCloseBps),
    vsTriggerBps: at(r => r.vsTriggerBps != null, r => r.vsTriggerBps),
    feeBps: at(r => r.feeBps != null, r => r.feeBps),
    partial: bot.filter(r => r.status !== 'open' && r.filledSz > 0 && r.fillRatio < 0.999).map(r => ({ oid: r.oid, kind: r.kind, fillRatio: r.fillRatio, status: r.status })),
    unprotectedAfterEntryMs: unprotected(bot),
  }
}

/** Délai entre chaque entrée exécutée et le premier stop (ou stop de sécurité) posé chez l'exchange. */
function unprotected(rows: OrderRow[]): { entryAt: string; ms: number | null }[] {
  return rows.filter(r => r.kind === 'entry' && r.filledSz > 0).map(e => {
    const s = rows.find(r => (r.kind === 'stop' || r.kind === 'emergency') && r.placedAt >= e.placedAt)
    const next = rows.find(r => r.kind === 'entry' && r.placedAt > e.placedAt)
    return { entryAt: new Date(e.placedAt).toISOString(), ms: s && (!next || s.placedAt < next.placedAt) ? s.placedAt - e.placedAt : null }
  })
}

// ---------------------------------------------------------------- points de mesure

/** Les 10 points demandés : où chacun se trouve aujourd'hui. */
export const MEASUREMENT_POINTS = [
  { point: '1. clôture théorique T', source: 'calculée (grille 15 min)', status: 'available' },
  { point: '2. message WebSocket de la nouvelle bougie', source: 'non journalisé par le bot (BotLoop.onCandle) ; mesuré par la sonde indépendante', status: 'missing' },
  { point: '3. bougie confirmée', source: 'market_bar.time (écrit après la lecture REST, avant le moteur) ; motif ws_close / clock / retry', status: 'approximate' },
  { point: '4. début et fin du calcul du signal', source: 'aucun ; la fin est bornée par l\'événement signal, écrit après 4 appels REST (fills, financement, compte, ordres ouverts) et le calcul', status: 'missing' },
  { point: '5. début et fin de chaque appel API bloquant', source: 'aucun (seulement les reprises après erreur : retry)', status: 'missing' },
  { point: '6. décision d\'exécution', source: 'événement signal (seulement les bougies avec décision)', status: 'approximate' },
  { point: '7. envoi de l\'ordre', source: 'aucun dans le journal (pending.at est écrit dans le fichier d\'état puis effacé)', status: 'missing' },
  { point: '8. accusé de réception de l\'exchange', source: 'heure de l\'exchange : historique public des ordres (timestamp du bloc) ; réception locale : non journalisée (entry est écrit après un appel compte de plus)', status: 'exchange_side_only' },
  { point: '9. premier remplissage', source: 'fills publics (heure du bloc) ; non journalisé pour les entrées', status: 'exchange_side_only' },
  { point: '10. remplissage final ou annulation du reliquat', source: 'historique public des ordres (statusTimestamp) ; IOC : même bloc', status: 'exchange_side_only' },
]

// ---------------------------------------------------------------- programme

async function main() {
  const args = process.argv.slice(2)
  const opt = (k: string, d = '') => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
  const logs = opt('logs').split(',').filter(Boolean).map(p => resolve(p))
  const since = opt('since')
  const address = opt('address')
  const net = opt('net', 'mainnet') as Net
  const coin = opt('coin', 'BTC')
  const outPath = resolve(opt('out', join(ROOT, 'research/reports/execution/latency-audit.json')))
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), measurementPoints: MEASUREMENT_POINTS }
  if (logs.length) {
    const a = auditJournal(readJournals(logs, since))
    report.journal = { dirs: logs.length, since: since || null, ...a }
    process.stderr.write(`journaux : ${a.bars} bougies lues ; ${JSON.stringify(a.counts)}\n`)
  }
  if (address) {
    const sinceMs = since ? Date.parse(since) : Date.UTC(2025, 0, 1)
    const d = await fetchPublic(net, address, coin, sinceMs)
    const rows = auditOrders(d)
    report.exchange = { net, coin, address, since: new Date(sinceMs).toISOString(), ...summarizeOrders(rows), rows }
    process.stderr.write(`exchange : ${rows.length} ordres (${rows.filter(r => r.kind === 'manual').length} manuels), ${d.fills.length} fills\n`)
  }
  if (!logs.length && !address) throw new Error('rien à lire : --logs et/ou --address')
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(report, null, 1))
  process.stderr.write(`→ ${outPath}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
