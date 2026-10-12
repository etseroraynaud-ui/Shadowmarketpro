// Carnets L2 historiques Binance USDⓈ-M (BTCUSDT, ETHUSDT) aux instants des exécutions du Shock
// Engine, comparés aux carnets Hyperliquid des mêmes instants (hl-free-days.ts). Jours gratuits de
// Tardis (premier jour du mois), mêmes 13 exécutions.
//
// Reconstruction : flux `depth@0ms` (chaque modification de chaque niveau, U / u / pu pour la
// continuité). Deux modes :
// - complet : instantané `depthSnapshot` de Tardis (début de journée, 1 000 niveaux) puis toutes les
//   mises à jour jusqu'à l'instant voulu (règle Binance : première mise à jour avec U ≤ id ≤ u, puis
//   pu = u précédent) ;
// - fenêtre : livre vide, mises à jour des W dernières minutes seulement ; il contient exactement les
//   niveaux modifiés pendant la fenêtre, pas les ordres restés immobiles plus longtemps (profondeur
//   sous-estimée, jamais surestimée). Validé contre le mode complet là où celui-ci est léger.
// À chaque instant simulé, seules les mises à jour d'heure d'événement E ≤ instant sont appliquées.
//
// Lignes par exécution hors dépôt (research/data/tardis/binance-futures/) ; agrégats seulement dans
// research/reports/execution/.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/binance-l2-free-days.ts [validate|events]

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { ROOT } from '../capacity/lib.ts'
import { DATA, SYM } from '../capacity/binance.ts'
import type { FillRow } from './fills-measure.ts'

const DIR = join(ROOT, 'research/data/tardis/binance-futures')
const HL_DIR = join(ROOT, 'research/data/hl-tardis')
const DAY = 864e5
export const LAT_S = [0, 0.5, 1, 2, 5]
export const ORDERS = [250e3, 500e3, 1e6, 2.5e6]
export const BANDS = [1, 2, 3, 5, 10, 20, 50]
const LIMIT_BPS = 50
const WARM_MIN = 10
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ---------------------------------------------------------------- téléchargement (jours gratuits)
async function minute(exchange: string, channels: { channel: string; symbols: string[] }[], day: string, offset: number, tag: string): Promise<string> {
  const path = join(DIR, `${tag}-${day}-${offset}.txt`)
  if (existsSync(path)) return readFileSync(path, 'utf8')
  const url = `https://api.tardis.dev/v1/data-feeds/${exchange}?from=${day}&offset=${offset}&filters=${encodeURIComponent(JSON.stringify(channels))}`
  for (let k = 0; k < 8; k++) {
    const res = await fetch(url)
    if (res.status === 429) { await sleep(15000 * (k + 1)); continue }
    if (!res.ok) throw new Error(`Tardis ${res.status} ${tag} ${day} +${offset} : ${(await res.text()).slice(0, 200)}`)
    const buf = Buffer.from(await res.arrayBuffer())
    const text = (buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString()
    mkdirSync(DIR, { recursive: true })
    writeFileSync(path, text)
    await sleep(1500)
    return text
  }
  throw new Error(`Tardis : trop de refus (429) ${tag} ${day} +${offset}`)
}
export const binanceMinutes = async (sym: string, day: string, from: number, to: number, withSnapshot: boolean) => {
  let text = ''
  for (let off = from; off <= to; off++) {
    const ch = [{ channel: 'depth', symbols: [sym.toLowerCase()] }, ...(withSnapshot && off === 0 ? [{ channel: 'depthSnapshot', symbols: [sym.toLowerCase()] }] : [])]
    text += (await minute('binance-futures', ch, day, off, `${sym}${withSnapshot && off === 0 ? '-snap' : ''}`)) + '\n'
  }
  return text
}

// ---------------------------------------------------------------- livre et relecture
export type Lvl = [number, number]
export interface BookView { bids: Lvl[]; asks: Lvl[]; age: number; time: number }

class Book {
  bids = new Map<number, number>()
  asks = new Map<number, number>()
  set(side: 'b' | 'a', levels: [string, string][]) {
    const m = side === 'b' ? this.bids : this.asks
    for (const [p, q] of levels) { const px = +p, qty = +q; if (qty === 0) m.delete(px); else m.set(px, qty) }
  }
  view(time: number, last: number): BookView {
    const bids = [...this.bids].sort((a, b) => b[0] - a[0])
    const asks = [...this.asks].sort((a, b) => a[0] - b[0])
    // Niveaux croisés (bruit de fenêtre : un niveau ancien jamais remis à zéro) : écartés.
    const bb = bids.length ? bids[0][0] : -Infinity
    return { bids, asks: asks.filter(([p]) => p > bb), age: time - last, time }
  }
}

interface Replay { views: Map<number, BookView>; updates: number; gaps: number; firstE: number; lastE: number; snapshotUsed: boolean; snapshotLevels: number }

/**
 * Relecture jusqu'aux instants `targets` (heure d'événement E ≤ instant). Mode complet, procédure
 * Binance : les mises à jour reçues avant l'instantané sont gardées, puis rejouées à son arrivée ;
 * celles dont u < lastUpdateId sont écartées, la première appliquée vérifie U ≤ lastUpdateId ≤ u,
 * chacune des suivantes pu = u précédent (sinon : rupture comptée).
 */
export function replay(text: string, targets: number[], mode: 'full' | 'window', windowFrom = -Infinity): Replay {
  const book = new Book()
  const views = new Map<number, BookView>()
  const tg = [...targets].sort((a, b) => a - b)
  let k = 0, prevU: number | null = null, gaps = 0, updates = 0, firstE = NaN, lastE = NaN, snapId = -1, snapshotLevels = 0
  let started = mode === 'window'
  const buffered: any[] = []
  const capture = (upTo: number) => { while (k < tg.length && tg[k] < upTo) { views.set(tg[k], book.view(tg[k], lastE)); k++ } }
  const apply = (d: any) => {
    if (!started) {
      if (d.u < snapId) return
      if (!(d.U <= snapId && d.u >= snapId)) { gaps++; return }
      started = true
    } else if (prevU != null && d.pu !== prevU) gaps++
    capture(d.E)
    prevU = d.u
    book.set('b', d.b); book.set('a', d.a)
    updates++
    if (Number.isNaN(firstE)) firstE = d.E
    lastE = d.E
  }
  for (const line of text.split('\n')) {
    const sp = line.indexOf(' ')
    if (sp < 0) continue
    const m = JSON.parse(line.slice(sp + 1)) as { stream: string; data: any }
    const d = m.data
    if (m.stream.includes('depthSnapshot')) {
      if (mode !== 'full' || snapId >= 0) continue
      book.set('b', d.bids); book.set('a', d.asks)
      snapId = d.lastUpdateId
      snapshotLevels = d.bids.length + d.asks.length
      lastE = d.E
      for (const b of buffered) apply(b)
      buffered.length = 0
      continue
    }
    if (d.e !== 'depthUpdate') continue
    if (mode === 'window') { if (d.E < windowFrom) continue; apply(d); continue }
    if (snapId < 0) { buffered.push(d); continue }
    apply(d)
  }
  capture(Infinity)
  return { views, updates, gaps, firstE, lastE, snapshotUsed: snapId >= 0, snapshotLevels }
}

// ---------------------------------------------------------------- mesures communes aux deux plateformes
export function depthWithin(levels: Lvl[], ref: number, bps: number, side: 1 | -1): number {
  const lim = ref * (1 + side * bps / 1e4)
  let s = 0
  for (const [p, q] of levels) { if (side === 1 ? p > lim : p < lim) break; s += p * q }
  return s
}

/** IOC de Q $ sur les niveaux du côté consommé, limité à `limitBps` du meilleur prix ; `keep` = part des tailles affichées encore là à l'arrivée. */
export function ioc(levels: Lvl[], side: 1 | -1, Q: number, limitBps: number, keep = 1) {
  const best = levels[0][0]
  const limit = best * (1 + side * limitBps / 1e4)
  let usd = 0, qty = 0, last = best
  for (const [p, s0] of levels) {
    if (side === 1 ? p > limit : p < limit) break
    const take = Math.min(p * s0 * keep, Q - usd)
    usd += take; qty += take / p; last = p
    if (usd >= Q - 1e-6) break
  }
  const far = side * (levels[levels.length - 1][0] / best - 1) * 1e4
  const filled = usd >= Q - 1e-6
  return {
    filledPct: usd / Q, absorbableUsd: usd, remainingUsd: Q - usd,
    vwap: qty > 0 ? usd / qty : NaN, slipVsBestBps: qty > 0 ? side * (usd / qty / best - 1) * 1e4 : NaN,
    lastLevelPx: last, lastLevelBps: side * (last / best - 1) * 1e4,
    // Reliquat : limite de prix atteinte, ou niveaux reconstruits épuisés avant la limite (inconnu au-delà).
    status: filled ? 'filled' : far < limitBps ? 'levels_exhausted' : 'limit_reached',
  }
}

export function metrics(v: BookView, side: 1 | -1, frac: number, decisionMid: number) {
  const mid = (v.bids[0][0] + v.asks[0][0]) / 2
  const book = side === 1 ? v.asks : v.bids
  const other = side === 1 ? v.bids : v.asks
  const bands = (lv: Lvl[], sd: 1 | -1) => Object.fromEntries(BANDS.map(b => [`${b}bp`, depthWithin(lv, mid, b, sd)]))
  const halfSpreadBps = (v.asks[0][0] - v.bids[0][0]) / 2 / mid * 1e4
  const driftBps = side * (mid / decisionMid - 1) * 1e4
  return {
    bookAgeMs: v.age, bid: v.bids[0][0], ask: v.asks[0][0], mid, spreadBps: 2 * halfSpreadBps, levels: [v.bids.length, v.asks.length],
    reachBps: side * (book[book.length - 1][0] / book[0][0] - 1) * 1e4,
    depthConsumed: bands(book, side), depthOther: bands(other, (-side) as 1 | -1),
    imbalance10bp: (depthWithin(v.bids, mid, 10, -1) - depthWithin(v.asks, mid, 10, 1)) / (depthWithin(v.bids, mid, 10, -1) + depthWithin(v.asks, mid, 10, 1)),
    driftBps,
    orders: Object.fromEntries(ORDERS.map(Q0 => {
      const Q = Q0 * frac
      const r = ioc(book, side, Q, LIMIT_BPS)
      // Coût complet par rapport au prix de décision = dérive du milieu + demi-spread + profondeur.
      const total = Number.isFinite(r.vwap) ? side * (r.vwap / decisionMid - 1) * 1e4 : NaN
      return [Q0, {
        ...r, qUsd: Q, totalVsDecisionBps: total, costUsd: Number.isFinite(total) ? total / 1e4 * r.absorbableUsd : NaN,
        decomposition: { driftBps, halfSpreadBps, depthBps: r.slipVsBestBps },
        withdrawn25: ioc(book, side, Q, LIMIT_BPS, 0.75).slipVsBestBps, withdrawn50: ioc(book, side, Q, LIMIT_BPS, 0.5).slipVsBestBps,
        // Meilleur niveau retiré avant l'arrivée : coût par rapport au meilleur prix d'origine.
        withoutBestLevel: book.length > 1 ? side * (ioc(book.slice(1), side, Q, LIMIT_BPS).vwap / book[0][0] - 1) * 1e4 : NaN,
      }]
    })),
  }
}

// ---------------------------------------------------------------- Hyperliquid (mêmes mesures, carnets déjà téléchargés)
export function hlViews(coin: string, anchor: number, targets: number[]): Map<number, BookView> {
  const day = new Date(Math.floor(anchor / DAY) * DAY).toISOString().slice(0, 10)
  const m0 = Math.floor((anchor - Math.floor(anchor / DAY) * DAY) / 60000)
  const snaps: BookView[] = []
  for (const off of [m0 - 1, m0, m0 + 1]) {
    const p = join(HL_DIR, `${coin}-${day}-${off}.txt`)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const sp = line.indexOf(' ')
      if (sp < 0) continue
      const m = JSON.parse(line.slice(sp + 1)) as { channel: string; data: any }
      if (m.channel !== 'l2Book') continue
      const lv = (xs: { px: string; sz: string }[]) => xs.map(l => [+l.px, +l.sz] as Lvl)
      snaps.push({ bids: lv(m.data.levels[0]), asks: lv(m.data.levels[1]), age: 0, time: m.data.time })
    }
  }
  snaps.sort((a, b) => a.time - b.time)
  const out = new Map<number, BookView>()
  for (const t of targets) { let s: BookView | null = null; for (const x of snaps) { if (x.time <= t) s = x; else break } if (s) out.set(t, { ...s, age: t - s.time }) }
  return out
}

// ---------------------------------------------------------------- validation de la reconstruction par fenêtre
async function validate() {
  const cases = [
    { sym: 'ETHUSDT', t: Date.UTC(2025, 11, 1, 0, 15), side: 1 as const, label: 'ETH, exécution du 2025-12-01 à 00:15' },
    { sym: 'BTCUSDT', t: Date.UTC(2025, 4, 1, 0, 20), side: 1 as const, label: 'BTC, instant quelconque 2025-05-01 00:20' },
  ]
  const res: Record<string, unknown> = {}
  for (const c of cases) {
    const day = new Date(Math.floor(c.t / DAY) * DAY).toISOString().slice(0, 10)
    const mT = Math.floor((c.t - Math.floor(c.t / DAY) * DAY) / 60000)
    const text = await binanceMinutes(c.sym, day, 0, mT + 1, true)
    const targets = LAT_S.map(L => c.t + L * 1000)
    const full = replay(text, targets, 'full')
    const out: Record<string, unknown> = { full: { updates: full.updates, gaps: full.gaps, snapshotUsed: full.snapshotUsed, snapshotLevels: full.snapshotLevels } }
    const ref = full.views.get(c.t + 500)!
    const mid = (ref.bids[0][0] + ref.asks[0][0]) / 2
    const fm = metrics(ref, c.side, 1, mid)
    out.fullAt05s = { levels: fm.levels, spreadBps: fm.spreadBps, depthAsk: fm.depthConsumed, depthBid: fm.depthOther, ioc: Object.fromEntries(ORDERS.map(Q => [Q, fm.orders[Q].slipVsBestBps])) }
    for (const W of [2, 5, 10]) {
      const w = replay(text, targets, 'window', c.t - W * 60000)
      const v = w.views.get(c.t + 500)!
      const wm = metrics(v, c.side, 1, mid)
      out[`window${W}min`] = {
        gaps: w.gaps, sameBest: v.bids[0][0] === ref.bids[0][0] && v.asks[0][0] === ref.asks[0][0],
        depthRatio: Object.fromEntries(BANDS.map(b => [`${b}bp`, +(wm.depthConsumed[`${b}bp`] / fm.depthConsumed[`${b}bp`]).toFixed(4)])),
        iocDiffBps: Object.fromEntries(ORDERS.map(Q => [Q, +(wm.orders[Q].slipVsBestBps - fm.orders[Q].slipVsBestBps).toFixed(4)])),
      }
    }
    res[c.label] = out
    process.stderr.write(`${c.label} : ${JSON.stringify(out)}\n`)
  }
  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, 'validation.json'), JSON.stringify(res, null, 1))
}

// ---------------------------------------------------------------- les 13 exécutions
async function events() {
  const hl = JSON.parse(readFileSync(join(HL_DIR, 'free-days-rows.json'), 'utf8')) as { asset: string; family: string; kind: string; side: 1 | -1; frac: number; anchor: number }[]
  const rows = new Map<string, FillRow>()
  for (const k of ['btc', 'ethusdt'] as const) for (const l of readFileSync(join(DATA, 'derived', `fills-${SYM[k]}.jsonl`), 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l) as FillRow; rows.set(`${r.key}:${r.tRef}:${r.family}`, r) }
  const only = process.argv[3]
  const out: Record<string, unknown>[] = []
  for (const e of hl) {
    if (only && !new Date(e.anchor).toISOString().startsWith(only)) continue
    const sym = e.asset === 'BTC' ? 'BTCUSDT' : 'ETHUSDT'
    const day = new Date(Math.floor(e.anchor / DAY) * DAY).toISOString().slice(0, 10)
    const mT = Math.floor((e.anchor - Math.floor(e.anchor / DAY) * DAY) / 60000)
    const text = await binanceMinutes(sym, day, Math.max(0, mT - WARM_MIN), mT + 1, false)
    const targets = LAT_S.map(L => e.anchor + L * 1000)
    const rp = replay(text, targets, 'window', e.anchor - WARM_MIN * 60000)
    const hv = hlViews(e.asset, e.anchor, targets)
    const bv0 = rp.views.get(e.anchor)!, hv0 = hv.get(e.anchor)!
    const bMid0 = (bv0.bids[0][0] + bv0.asks[0][0]) / 2, hMid0 = (hv0.bids[0][0] + hv0.asks[0][0]) / 2
    const byL: Record<string, unknown> = {}
    for (const L of LAT_S) {
      const t = e.anchor + L * 1000
      const b = rp.views.get(t), h = hv.get(t)
      byL[`${L}s`] = { binance: b ? metrics(b, e.side, e.frac, bMid0) : null, hyperliquid: h ? metrics(h, e.side, e.frac, hMid0) : null }
    }
    const key = e.asset === 'BTC' ? 'btc' : 'ethusdt'
    const fr = [...rows.values()].find(r => r.key === key && r.family === e.family && Math.abs(r.tRef - e.anchor) < 1)
    out.push({ asset: e.asset, family: e.family, kind: e.kind, side: e.side, frac: e.frac, anchor: e.anchor, replay: { updates: rp.updates, gaps: rp.gaps, windowMin: WARM_MIN }, priceGapBinanceVsHlBps: (bMid0 / hMid0 - 1) * 1e4, byLatency: byL, sweeps: fr?.sweeps ?? null })
    process.stderr.write(`${e.asset} ${e.family} ${new Date(e.anchor).toISOString()} : ${rp.updates} mises à jour, ${rp.gaps} ruptures, écart Binance/HL ${((bMid0 / hMid0 - 1) * 1e4).toFixed(2)} pb\n`)
  }
  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, `rows${only ? '-' + only : ''}.json`), JSON.stringify(out, null, 1))
}

if (process.argv[1]?.endsWith('binance-l2-free-days.ts')) {
  if (process.argv[2] === 'validate') await validate()
  else await events()
}
