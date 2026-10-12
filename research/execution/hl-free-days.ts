// Carnets Hyperliquid historiques aux instants des exécutions du Shock Engine : test de faisabilité
// sur les jours gratuits de Tardis (premier jour de chaque mois, depuis le 2024-10-29).
//
// Pour chaque exécution tombant un jour gratuit : seules les minutes utiles sont téléchargées
// (carnet l2Book de Hyperliquid, 20 niveaux par côté, et transactions), puis à T + 0,5 / 1 / 2 / 3 / 5 s
// le carnet retenu est le dernier instantané reçu à cet instant au plus tard (jamais un instantané
// postérieur). Mesures : meilleurs prix, spread, profondeur cumulée à 1–50 pb, déséquilibre, et
// consommation du carnet par un ordre IOC de 250 k$ à 2,5 M$ (part de la position pour les sorties),
// limité comme le bot à 50 pb du meilleur prix.
//
// Les lignes par exécution (instants et sens des trades) restent hors du dépôt
// (research/data/hl-tardis/) ; seuls des agrégats sont écrits dans research/reports/execution/.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/hl-free-days.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { ROOT } from '../capacity/lib.ts'
import { DATA, SYM } from '../capacity/binance.ts'
import type { Event } from '../capacity/events.ts'
import type { FillRow } from './fills-measure.ts'

const DIR = join(ROOT, 'research/data/hl-tardis')
const SINCE = Date.UTC(2024, 9, 29)
const DAY = 864e5
export const LAT_S = [0.5, 1, 2, 3, 5]
export const ORDERS = [250e3, 500e3, 1e6, 2.5e6]
export const BANDS = [1, 2, 5, 10, 20, 50]
const LIMIT_BPS = 50
const COIN = { btc: 'BTC', ethusdt: 'ETH' } as const

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/** Une minute de données Tardis (jour gratuit), en cache local ; attente et reprise sur 429. */
async function minute(coin: string, day: string, offset: number): Promise<string> {
  const path = join(DIR, `${coin}-${day}-${offset}.txt`)
  if (existsSync(path)) return readFileSync(path, 'utf8')
  const filters = encodeURIComponent(JSON.stringify([{ channel: 'l2Book', symbols: [coin] }, { channel: 'trades', symbols: [coin] }]))
  const url = `https://api.tardis.dev/v1/data-feeds/hyperliquid?from=${day}&offset=${offset}&filters=${filters}`
  for (let k = 0; k < 8; k++) {
    const res = await fetch(url)
    if (res.status === 429) { await sleep(15000 * (k + 1)); continue }
    if (!res.ok) throw new Error(`Tardis ${res.status} ${day} +${offset} min : ${(await res.text()).slice(0, 200)}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const text = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString()
    mkdirSync(DIR, { recursive: true })
    writeFileSync(path, text)
    await sleep(2000)
    return text
  }
  throw new Error(`Tardis : trop de refus (429) pour ${day} +${offset}`)
}

type Lvl = [number, number]
export interface Snap { local: number; time: number; bids: Lvl[]; asks: Lvl[] }
interface Trade { time: number; px: number; sz: number; side: string }

function parse(text: string): { snaps: Snap[]; trades: Trade[] } {
  const snaps: Snap[] = [], trades: Trade[] = []
  for (const line of text.split('\n')) {
    const sp = line.indexOf(' ')
    if (sp < 0) continue
    const m = JSON.parse(line.slice(sp + 1)) as { channel: string; data: any }
    if (m.channel === 'l2Book') snaps.push({ local: Date.parse(line.slice(0, sp)), time: m.data.time, bids: m.data.levels[0].map((l: { px: string; sz: string }) => [+l.px, +l.sz]), asks: m.data.levels[1].map((l: { px: string; sz: string }) => [+l.px, +l.sz]) })
    if (m.channel === 'trades') for (const t of m.data) trades.push({ time: t.time, px: +t.px, sz: +t.sz, side: t.side })
  }
  return { snaps: snaps.sort((a, b) => a.time - b.time), trades: trades.sort((a, b) => a.time - b.time) }
}

/** Ordre IOC de Q $ consommant les niveaux visibles, limité à `limitBps` du meilleur prix. */
export function consume(levels: Lvl[], side: 1 | -1, Q: number, limitBps: number) {
  const best = levels[0][0]
  const limit = best * (1 + side * limitBps / 1e4)
  let usd = 0, qty = 0
  for (const [p, s] of levels) {
    if (side === 1 ? p > limit : p < limit) break
    const take = Math.min(p * s, Q - usd)
    usd += take; qty += take / p
    if (usd >= Q - 1e-6) break
  }
  const visible = levels.reduce((a, [p, s]) => a + p * s, 0)
  const farBps = side * (levels[levels.length - 1][0] / best - 1) * 1e4
  return {
    filledPct: usd / Q,
    vwap: qty > 0 ? usd / qty : NaN,
    slipVsBestBps: qty > 0 ? side * (usd / qty / best - 1) * 1e4 : NaN,
    remainingUsd: Q - usd,
    // Reliquat : limite atteinte dans les niveaux visibles, ou niveaux visibles épuisés avant la limite (inconnu au-delà).
    stop: usd >= Q - 1e-6 ? 'filled' : farBps < limitBps && visible < Q ? 'visible_levels_exhausted' : 'limit_reached',
    visibleUsd: visible,
    farBps,
  }
}

function depthWithin(levels: Lvl[], mid: number, bps: number, side: 1 | -1): number {
  const lim = mid * (1 + side * bps / 1e4)
  return levels.filter(([p]) => (side === 1 ? p <= lim : p >= lim)).reduce((a, [p, s]) => a + p * s, 0)
}

const lastAt = <T extends { time: number }>(xs: T[], t: number): T | null => { let r: T | null = null; for (const x of xs) { if (x.time <= t) r = x; else break } return r }

async function main() {
  const events = (JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8')) as Event[])
    .filter(e => e.t >= SINCE && new Date(e.t).getUTCDate() === 1 && e.family !== 'tp1')
  const rows = new Map<string, FillRow>()
  for (const k of ['btc', 'ethusdt'] as const) for (const l of readFileSync(join(DATA, 'derived', `fills-${SYM[k]}.jsonl`), 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l) as FillRow; rows.set(`${k}:${r.fi}`, r) }
  const out: Record<string, unknown>[] = []
  for (const e of events) {
    const coin = COIN[e.key]
    const r = rows.get(`${e.key}:${e.fi}`)!
    // Instant de référence : clôture T (entrées, fermetures) ; franchissement du stop repéré sur Binance.
    const anchor = e.family === 'stop' ? r.tRef : e.t
    const day = new Date(Math.floor(anchor / DAY) * DAY).toISOString().slice(0, 10)
    const m0 = Math.floor((anchor - Math.floor(anchor / DAY) * DAY) / 60000)
    let text = ''
    for (const off of [m0 - 1, m0, m0 + 1]) if (off >= 0 && off < 1440) text += (await minute(coin, day, off)) + '\n'
    const { snaps, trades } = parse(text)
    const atDecision = lastAt(snaps, anchor)
    const lastTrade = lastAt(trades, anchor - 1)
    const side = e.side
    const decisionMid = atDecision ? (atDecision.bids[0][0] + atDecision.asks[0][0]) / 2 : NaN
    const byLatency: Record<string, unknown> = {}
    for (const L of LAT_S) {
      const t = anchor + L * 1000
      const s = lastAt(snaps, t)
      if (!s) { byLatency[`${L}s`] = null; continue }
      const mid = (s.bids[0][0] + s.asks[0][0]) / 2
      const book = side === 1 ? s.asks : s.bids
      const depth = (sd: 1 | -1, lv: Lvl[]) => Object.fromEntries(BANDS.map(b => [`${b}bp`, depthWithin(lv, mid, b, sd)]))
      const d10b = depthWithin(s.bids, mid, 10, -1), d10a = depthWithin(s.asks, mid, 10, 1)
      byLatency[`${L}s`] = {
        bookAgeMs: t - s.time, bid: s.bids[0][0], ask: s.asks[0][0], spreadBps: (s.asks[0][0] - s.bids[0][0]) / mid * 1e4,
        depthConsumedSide: depth(side, book), depthOtherSide: depth((-side) as 1 | -1, side === 1 ? s.bids : s.asks),
        imbalance10bp: (d10b - d10a) / (d10b + d10a),
        driftVsDecisionBps: side * (mid / decisionMid - 1) * 1e4,
        orders: Object.fromEntries(ORDERS.map(Q => {
          const q = Q * e.frac
          const c = consume(book, side, q, LIMIT_BPS)
          const decisionCost = Number.isFinite(c.vwap) ? side * (c.vwap / decisionMid - 1) * 1e4 : NaN
          return [Q, { ...c, qUsd: q, costVsDecisionBps: decisionCost, costUsd: Number.isFinite(decisionCost) ? decisionCost / 1e4 * q * c.filledPct : NaN }]
        })),
      }
    }
    out.push({
      asset: coin, family: e.family, kind: e.kind, side, frac: e.frac, anchor, snaps: snaps.length, trades: trades.length,
      snapStepMs: snaps.length > 1 ? (snaps[snaps.length - 1].time - snaps[0].time) / (snaps.length - 1) : null,
      decisionMid, lastTradePx: lastTrade?.px ?? null, sigma60: e.sigma60, byLatency,
      binance: { hs: r.hs, drift: r.drift, sweeps: r.sweeps },
    })
    process.stderr.write(`${coin} ${e.family} ${new Date(anchor).toISOString()} : ${snaps.length} carnets, ${trades.length} transactions\n`)
  }
  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, 'free-days-rows.json'), JSON.stringify(out, null, 1))
  process.stderr.write(`${out.length} exécutions → ${join(DIR, 'free-days-rows.json')}\n`)
}

if (process.argv[1]?.endsWith('hl-free-days.ts')) await main()
