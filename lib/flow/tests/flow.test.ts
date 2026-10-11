// Tests de Market Flow : contrôle des envois du collecteur, regroupement et lecture de la page.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggBars, aggWhales, buildView, type BarRow, type WhaleRow } from '../aggregate.ts'
import { parseIngest, tokenMatches } from '../ingest.ts'

const T0 = 1_791_550_800 // minute ronde (2026-10-09 12:20 UTC)

const bar = (minute: number, d: number[], v: number[], px = 83_000, liq: [number, number] = [0, 0]): BarRow =>
  ({ minute, px, delta: d, vol: v, liq_long: liq[0], liq_short: liq[1] })
const whale = (ts: number, long: number, short: number, chg = 0): WhaleRow => ({
  ts, px: 83_000, whale_long: long, whale_short: short, chg_net: chg, chg_long: chg, chg_short: 0, n_long: 10, n_short: 8,
  cov_long: 0.3, cov_short: 0.3, oi: 3e9, giant_long: long / 2, giant_short: short / 2, giant_n_long: 2, giant_n_short: 3,
  giant_chg_net: 0, giant_chg_long: 0, giant_chg_short: 0,
})

test('jeton : comparaison exacte', () => {
  assert.equal(tokenMatches('abc', 'abc'), true)
  assert.equal(tokenMatches('abd', 'abc'), false)
  assert.equal(tokenMatches('', 'abc'), false)
})

test('ingestion : envoi du collecteur accepté, champs absents et null tolérés', () => {
  const p = parseIngest({
    coin: 'ETH', sent_at: T0,
    bars: [{ minute: T0, px: null, delta: [-1.5, 0, 2, 0], vol: [1.5, 0, 2, 0], liq_long: 0, liq_short: 120_000 }],
    whales: [{ ts: T0 + 12.5, px: 2500, whale_long: 1e7, whale_short: 2e7, chg_net: -5, chg_long: null, chg_short: 5, n_long: 3, n_short: 4,
      cov_long: null, cov_short: null, oi: null, giant_long: null, giant_short: null, giant_n_long: null, giant_n_short: null,
      giant_chg_net: null, giant_chg_long: null, giant_chg_short: null }],
    status: { price: 2500, hl: { top: [] } },
  }, T0 + 60)
  assert.equal(p.coin, 'ETH')
  assert.deepEqual(p.bars[0].delta, [-1.5, 0, 2, 0])
  assert.equal(p.whales[0].cov_long, null)
  assert.equal(p.status?.price, 2500)
})

test('ingestion : refus des envois mal formés', () => {
  const now = T0 + 60
  const ok = { minute: T0, px: 1, delta: [0, 0, 0, 0], vol: [0, 0, 0, 0], liq_long: 0, liq_short: 0 }
  for (const [body, msg] of [
    [{ coin: 'DOGE', bars: [] }, /coin/],
    [{ coin: 'BTC', bars: [{ ...ok, minute: T0 + 30 }] }, /minute/],
    [{ coin: 'BTC', bars: [{ ...ok, minute: T0 + 86400 }] }, /minute/],
    [{ coin: 'BTC', bars: [{ ...ok, delta: [0, 0, 0] }] }, /delta/],
    [{ coin: 'BTC', bars: [{ ...ok, vol: [0, -1, 0, 0] }] }, /vol/],
    [{ coin: 'BTC', bars: [{ ...ok, px: 'x' }] }, /px/],
    [{ coin: 'BTC', whales: [{ ts: T0, n_long: 1.5 }] }, /entier/],
    [{ coin: 'BTC', bars: new Array(2001).fill(ok) }, /2000/],
    [{ coin: 'BTC', status: [] }, /status/],
  ] as const) assert.throws(() => parseIngest(body, now), msg)
})

test('regroupement : sommes par tranche, dernier prix, dernier stock', () => {
  const bars = [bar(T0, [1, 0, 0, 0], [1, 0, 0, 0], 100), bar(T0 + 60, [2, 0, 0, 0], [2, 0, 0, 0], 101), bar(T0 + 300, [4, 0, 0, 0], [4, 0, 0, 0], 102)]
  const a = aggBars(bars, 0, 300)
  assert.deepEqual(a.map(x => [x.t, x.d0, x.px, x.n]), [[T0, 3, 101, 2], [T0 + 300, 4, 102, 1]])
  const w = aggWhales([whale(T0 + 1, 10, 5, 1), whale(T0 + 61, 12, 5, 2)], 0, 300)
  assert.equal(w.length, 1)
  assert.equal(w[0].whale_long, 12)
  assert.equal(w[0].chg_net, 3)
  assert.equal(w[0].first_ts, T0 + 1)
})

test('lecture : gros acheteurs et retail vendeur sur la dernière heure', () => {
  const bars: BarRow[] = [], whales: WhaleRow[] = []
  for (let k = 0; k < 120; k++) {
    // ≥ 100 k$ : 60 % d'achats ; retail : 40 % d'achats → divergence (0,2 + 0,2) / 2 = 20 points
    bars.push(bar(T0 + k * 60, [-4_000, 0, 50_000, 0], [20_000, 0, 250_000, 0], 83_000 + k))
    whales.push(whale(T0 + k * 60 + 5, 1e8 + k * 1e6, 2e8, 1e6))
  }
  const v = buildView({
    coin: 'BTC', range: '4h', barsR: aggBars(bars, 0, 60), whalesR: aggWhales(whales, 0, 60), bars5: aggBars(bars, 0, 300), whales5: aggWhales(whales, 0, 300),
    status: null, updatedAt: new Date((T0 + 7200) * 1000).toISOString(), now: T0 + 7200,
  })
  const h = v.windows[0]
  assert.equal(h.key, '1h')
  assert.ok(Math.abs(h.imb.big! - 0.2) < 1e-12 && Math.abs(h.imb.retail! + 0.2) < 1e-12)
  assert.ok(Math.abs(h.divergence! - 20) < 1e-9)
  assert.equal(h.verdict.label, 'Large orders buying, retail selling')
  assert.equal(h.whales.stance.label, 'Adding net long')        // +60 M$ sur l'heure, seuil max(1 M$, 0,25 % du stock)
  assert.equal(v.windows[1].whales.ok, false)                   // 2 h d'historique pour une fenêtre de 4 h
  assert.equal(v.stale, false)
  assert.equal(v.series.t.length, 240)
  const last = v.series.cvdBig.filter(x => x !== null).pop()
  assert.equal(last, 50_000 * 120)
  assert.match(v.reading[0], /large orders buying, retail selling/)
})

test('lecture : aucune donnée → vue vide, sans erreur', () => {
  const v = buildView({ coin: 'ETH', range: '24h', barsR: [], whalesR: [], bars5: [], whales5: [], status: null, updatedAt: null, now: T0 })
  assert.equal(v.end, null)
  assert.equal(v.windows.length, 0)
  assert.equal(v.series.t.length, 0)
})
