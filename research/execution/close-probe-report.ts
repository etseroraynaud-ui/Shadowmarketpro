// Analyse des enregistrements de la sonde de clôture (close-probe.ts). Pour chaque clôture T et
// chaque actif :
// - délai d'arrivée du premier message WebSocket de la nouvelle bougie, et la bougie close reçue
//   juste avant est-elle définitive (égale à la lecture REST à T + 60 s) ?
// - premier instant où l'API REST confirme la bougie close selon la règle du bot (une bougie plus
//   récente existe), durée des requêtes, et lectures plus précoces différentes de la valeur finale ;
// - première transaction après T (heure de l'exchange) ;
// - à T + x : milieu, spread, écart du prix mark au milieu, et coût d'un ordre au marché immédiat de
//   Q $ en parcourant le carnet visible (carnet rapide, puis 20 niveaux exacts, puis tranches
//   agrégées comptées au pire prix de la tranche). Ce coût suppose que la liquidité visible reste en place jusqu'à l'arrivée de
//   l'ordre : sur Hyperliquid, les annulations passent avant les ordres IOC du même bloc.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/close-probe-report.ts [fichiers.jsonl…]

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dist } from './latency-audit.ts'
import type { Dist } from './latency-audit.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const STEP = 15 * 60000
export const OFFSETS_S = [0, 0.5, 1, 2, 3, 5, 10, 20]
/** Taille d'un ordre : la moitié du capital (une sleeve sur deux), comme l'étude de capacité. */
export const SIZES = [50e3, 125e3, 250e3, 500e3, 2.5e6]
const BANDS_BPS = [2, 5, 10, 25]

type Lvl = [number, number, number]
interface Book { time: number; recv: number; levels: [Lvl[], Lvl[]] }

/** Pas de prix d'une agrégation à n chiffres significatifs, au prix p. */
export const bucketOf = (p: number, sig: number) => 10 ** (Math.floor(Math.log10(p)) - sig + 1)

/**
 * Coût (pb du milieu) d'un ordre au marché de Q $ : niveaux exacts, puis tranches de plus en plus
 * larges au-delà, chaque tranche comptée à son prix le plus défavorable. NaN si le carnet visible ne
 * suffit pas.
 */
export function immediateCost(books: { levels: [Lvl[], Lvl[]]; sig: number | null }[], side: 1 | -1, Q: number, mid: number): { bps: number; complete: boolean; worstBps: number } {
  let usd = 0, qty = 0, edge = side === 1 ? -Infinity : Infinity, worst = mid
  for (const b of books) {
    const lv = side === 1 ? b.levels[1] : b.levels[0]
    for (const [p0, sz] of lv) {
      const w = b.sig == null ? 0 : bucketOf(p0, b.sig)
      const p = p0 + side * w
      // Seulement les tranches entièrement au-delà de ce que le carnet plus fin a déjà couvert (le
      // sens d'arrondi des tranches n'étant pas documenté, une tranche à cheval est ignorée).
      if (side === 1 ? p0 - w <= edge : p0 + w >= edge) continue
      const take = Math.min(sz, (Q - usd) / p)
      usd += take * p
      qty += take
      worst = p
      if (usd >= Q - 1e-6) return { bps: side * (usd / qty / mid - 1) * 1e4, complete: true, worstBps: side * (worst / mid - 1) * 1e4 }
    }
    if (lv.length) edge = side === 1 ? Math.max(edge, lv[lv.length - 1][0] + (b.sig == null ? 0 : bucketOf(lv[lv.length - 1][0], b.sig))) : Math.min(edge, lv[lv.length - 1][0] - (b.sig == null ? 0 : bucketOf(lv[lv.length - 1][0], b.sig)))
  }
  return { bps: NaN, complete: false, worstBps: NaN }
}

/** Dernier élément dont la clé est ≤ t (tableau trié par clé). */
function lastAt<T>(xs: T[], key: (x: T) => number, t: number): T | null {
  let lo = 0, hi = xs.length - 1, ans = -1
  while (lo <= hi) { const m = (lo + hi) >> 1; if (key(xs[m]) <= t) { ans = m; lo = m + 1 } else hi = m - 1 }
  return ans >= 0 ? xs[ans] : null
}

const same = (a: Record<string, unknown> | null | undefined, b: Record<string, unknown> | null | undefined) =>
  !!a && !!b && ['o', 'h', 'l', 'c', 'v'].every(k => Number(a[k]) === Number(b[k]))

export interface CloseRow {
  coin: string
  T: string
  wsNewCandleMs: number | null
  wsClosedBarFinal: boolean | null
  restConfirmMs: number | null
  restConfirmOffsetMs: number | null
  restConfirmedBarFinal: boolean | null
  restEarlyDiffers: number
  restRttMs: number[]
  firstTradeExchMs: number | null
  firstTradeRecvMs: number | null
  close: number | null
  barDir: number
  at: Record<string, { midDriftBps: number; spreadBps: number; markMinusMidBps: number | null; cost: Record<string, { buy: number; sell: number }>; depthUsd: Record<string, number>; bookAgeMs: number | null; fastBookAgeMs: number | null }>
}

export function analyze(lines: Record<string, any>[]): CloseRow[] {
  const by = new Map<string, Record<string, any>[]>()
  for (const r of lines) {
    if (r.T == null || r.coin == null && r.data?.coin == null) continue
    const coin = r.coin ?? r.data.coin
    const key = `${coin}|${r.T}`
    by.set(key, [...(by.get(key) ?? []), r])
  }
  // Les carnets à l'ouverture de fenêtre portent leur clé (agrégation:actif).
  for (const r of lines.filter(x => x.k === 'book_at_open')) {
    const [agg, coin] = String(r.key).split(':')
    const key = `${coin}|${r.T}`
    by.set(key, [...(by.get(key) ?? []), { k: 'book', T: r.T, agg, coin, recv: r.data.time, time: r.data.time, levels: r.data.levels.map((s: { px: string; sz: string; n: number }[]) => s.map(l => [+l.px, +l.sz, l.n])) }])
  }
  const rows: CloseRow[] = []
  for (const [key, rs] of by) {
    const [coin, Ts] = key.split('|')
    const T = Number(Ts)
    const ws = rs.find(r => r.k === 'ws_close')
    const rest = rs.filter(r => r.k === 'rest_candles').sort((a, b) => a.offset - b.offset)
    const final = rest.find(r => r.offset >= 60000)?.bars.find((b: { t: number }) => b.t === T - STEP) ?? null
    const confirm = rest.find(r => r.bars.some((b: { t: number }) => b.t >= T))
    const early = rest.filter(r => r !== confirm && r.offset < (confirm?.offset ?? Infinity)).filter(r => { const b = r.bars.find((x: { t: number }) => x.t === T - STEP); return b && final && !same(b, final) })
    const trades = rs.filter(r => r.k === 'trade').sort((a, b) => a.time - b.time)
    const first = trades.find(x => x.time >= T)
    const bbo = rs.filter(r => r.k === 'bbo' && r.bid && r.ask).sort((a, b) => a.time - b.time)
    const ctx = rs.filter(r => r.k === 'ctx').sort((a, b) => a.recv - b.recv)
    const books: Record<string, Book[]> = {}
    for (const r of rs.filter(x => x.k === 'book')) (books[r.agg] ??= []).push(r as unknown as Book)
    for (const b of Object.values(books)) b.sort((a, c) => a.time - c.time)
    const close = final ? Number(final.c) : null
    const barDir = final ? Math.sign(Number(final.c) - Number(final.o)) : 0
    const at: CloseRow['at'] = {}
    if (close != null) {
      for (const x of OFFSETS_S) {
        const t = T + x * 1000
        const q = lastAt(bbo, r => r.time, t)
        if (!q) continue
        const mid = (q.bid[0] + q.ask[0]) / 2
        const c = lastAt(ctx, r => r.recv, t)
        const exact = lastAt(books.exact ?? [], b => b.time, t)
        const fast = lastAt(books.fast ?? [], b => b.time, t)
        const chain = [
          fast && { levels: fast.levels, sig: null },
          exact && { levels: exact.levels, sig: null },
          lastAt(books.sig4 ?? [], b => b.time, t) && { levels: lastAt(books.sig4!, b => b.time, t)!.levels, sig: 4 },
          lastAt(books.sig3 ?? [], b => b.time, t) && { levels: lastAt(books.sig3!, b => b.time, t)!.levels, sig: 3 },
        ].filter(Boolean) as { levels: [Lvl[], Lvl[]]; sig: number | null }[]
        const cost: Record<string, { buy: number; sell: number }> = {}
        for (const Q of SIZES) cost[Q] = { buy: immediateCost(chain, 1, Q, mid).bps, sell: immediateCost(chain, -1, Q, mid).bps }
        const depthUsd: Record<string, number> = {}
        if (exact) for (const bp of BANDS_BPS) {
          const lim = (bp / 1e4) * mid
          const side = (lv: Lvl[], ok: (p: number) => boolean) => lv.filter(([p]) => ok(p)).reduce((a, [p, s]) => a + p * s, 0)
          // Au-delà des niveaux exacts, les tranches agrégées complètent (prix de tranche).
          const s4 = lastAt(books.sig4 ?? [], b => b.time, t)?.levels
          const bid = Math.max(side(exact.levels[0], p => p >= mid - lim), s4 ? side(s4[0], p => p >= mid - lim) : 0)
          const ask = Math.max(side(exact.levels[1], p => p <= mid + lim), s4 ? side(s4[1], p => p <= mid + lim) : 0)
          depthUsd[`${bp}bp`] = Math.min(bid, ask)
        }
        at[`${x}s`] = {
          midDriftBps: ((mid - close) / close) * 1e4, spreadBps: ((q.ask[0] - q.bid[0]) / mid) * 1e4,
          markMinusMidBps: c ? ((c.mark - mid) / mid) * 1e4 : null, cost, depthUsd, bookAgeMs: exact ? t - exact.time : null, fastBookAgeMs: fast ? t - fast.time : null,
        }
      }
    }
    rows.push({
      coin, T: new Date(T).toISOString(),
      wsNewCandleMs: ws ? ws.recv - T : null, wsClosedBarFinal: ws && final ? same(ws.prev, final) : null,
      restConfirmMs: confirm ? confirm.t1 - T : null, restConfirmOffsetMs: confirm?.offset ?? null,
      restConfirmedBarFinal: confirm && final ? same(confirm.bars.find((b: { t: number }) => b.t === T - STEP), final) : null,
      restEarlyDiffers: early.length, restRttMs: rest.map(r => r.t1 - r.t0),
      firstTradeExchMs: first ? first.time - T : null, firstTradeRecvMs: first ? first.recv - T : null,
      close, barDir, at,
    })
  }
  return rows.filter(r => r.close != null).sort((a, b) => a.T.localeCompare(b.T) || a.coin.localeCompare(b.coin))
}

export function summarize(rows: CloseRow[]) {
  const coins = [...new Set(rows.map(r => r.coin))]
  const d = (f: (r: CloseRow) => number | null | undefined, rs: CloseRow[]): Dist => dist(rs.map(r => f(r) ?? NaN))
  return Object.fromEntries(coins.map(coin => {
    const rs = rows.filter(r => r.coin === coin)
    return [coin, {
      closes: rs.length,
      wsNewCandleMs: d(r => r.wsNewCandleMs, rs),
      wsClosedBarFinal: { yes: rs.filter(r => r.wsClosedBarFinal === true).length, no: rs.filter(r => r.wsClosedBarFinal === false).length },
      restConfirmMs: d(r => r.restConfirmMs, rs),
      restConfirmedBarFinal: { yes: rs.filter(r => r.restConfirmedBarFinal === true).length, no: rs.filter(r => r.restConfirmedBarFinal === false).length },
      restEarlyReadsDifferentFromFinal: rs.reduce((a, r) => a + r.restEarlyDiffers, 0),
      restRttMs: dist(rs.flatMap(r => r.restRttMs)),
      firstTradeExchMs: d(r => r.firstTradeExchMs, rs),
      absMidDriftBps: Object.fromEntries(OFFSETS_S.map(x => [`${x}s`, d(r => r.at[`${x}s`] ? Math.abs(r.at[`${x}s`].midDriftBps) : null, rs)])),
      driftWithBarDirectionBps: Object.fromEntries(OFFSETS_S.map(x => [`${x}s`, d(r => r.at[`${x}s`] && r.barDir ? r.barDir * r.at[`${x}s`].midDriftBps : null, rs)])),
      spreadBps: Object.fromEntries(OFFSETS_S.map(x => [`${x}s`, d(r => r.at[`${x}s`]?.spreadBps, rs)])),
      absMarkMinusMidBps: Object.fromEntries(OFFSETS_S.map(x => [`${x}s`, d(r => r.at[`${x}s`]?.markMinusMidBps != null ? Math.abs(r.at[`${x}s`].markMinusMidBps!) : null, rs)])),
      immediateCostBps: Object.fromEntries(['0.5s', '1s', '5s'].map(x => [x, Object.fromEntries(SIZES.map(Q => [Q, d(r => r.at[x] ? (r.at[x].cost[Q].buy + r.at[x].cost[Q].sell) / 2 : null, rs)]))])),
      depthUsd: Object.fromEntries(['0.5s', '5s'].map(x => [x, Object.fromEntries(BANDS_BPS.map(b => [`${b}bp`, d(r => r.at[x]?.depthUsd[`${b}bp`], rs)]))])),
    }]
  }))
}

async function main() {
  const args = process.argv.slice(2)
  const dir = join(ROOT, 'research/data/hl-probe')
  const files = args.length ? args.map(a => resolve(a)) : readdirSync(dir).filter(f => f.endsWith('.jsonl')).map(f => join(dir, f))
  const lines = files.flatMap(f => readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)))
  const rows = analyze(lines)
  const summary = summarize(rows)
  const out = join(ROOT, 'research/reports/execution/close-probe.json')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), files: files.map(f => f.slice(ROOT.length + 1)), note: 'Observateur indépendant (pas la machine du bot) : les délais réseau ne sont pas ceux du serveur du bot. Petits échantillons : indicatifs.', summary, rows }, null, 1))
  for (const [coin, s] of Object.entries(summary) as [string, any][]) {
    process.stderr.write(`${coin} : ${s.closes} clôtures · WS nouvelle bougie P50 ${s.wsNewCandleMs.p50?.toFixed(0)} ms · bougie WS définitive ${s.wsClosedBarFinal.yes}/${s.wsClosedBarFinal.yes + s.wsClosedBarFinal.no} · REST confirme P50 ${s.restConfirmMs.p50?.toFixed(0)} ms · 1re transaction P50 ${s.firstTradeExchMs.p50?.toFixed(0)} ms · |dérive| 1 s ${s.absMidDriftBps['1s'].p50?.toFixed(2)} pb, 5 s ${s.absMidDriftBps['5s'].p50?.toFixed(2)} pb · spread 1 s ${s.spreadBps['1s'].p50?.toFixed(2)} pb\n`)
  }
  process.stderr.write(`→ ${out}\n`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
