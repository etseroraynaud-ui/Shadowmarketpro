import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { auditJournal, auditOrders, dist, quantile, readJournals, summarizeOrders } from '../execution/latency-audit.ts'
import type { PublicData } from '../execution/latency-audit.ts'

const T = Date.parse('2026-10-07T02:00:00Z')
const at = (ms: number) => new Date(T + ms).toISOString()

test('quantiles : interpolation linéaire, petits échantillons signalés', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
  assert.equal(quantile([5], 0.99), 5)
  assert.ok(Number.isNaN(quantile([], 0.5)))
  const d = dist([1, 2, 3])
  assert.equal(d.n, 3)
  assert.equal(d.indicative, true)
})

test('journal : segments depuis la clôture, coûts signés, retournement, sans lire les variables internes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lat-'))
  const ev = (ms: number, type: string, data: Record<string, unknown> = {}) => JSON.stringify({ time: at(ms), mode: 'testnet', type, ...data })
  writeFileSync(join(dir, 'events-2026-10.jsonl'), [
    ev(-60000, 'start', { coin: 'BTC' }),
    ev(3400, 'market_bar', { bar: at(0), reason: 'ws_close', close: 100000, ws: { same: true }, spread: { maxBps: 0.2 } }),
    ev(4300, 'signal', { bar: at(0), regime: 'calm', long: null, short: 'IMP calm', exit: null, sets: [{ z: 9 }] }),
    // Retournement : fermeture du long, puis entrée short.
    ev(4700, 'exit', { tag: 'REV', side: 'sell', size: 1, avg: 99990, ref: 100000, spreadBps: 0.1 }),
    ev(5600, 'entry', { side: 'sell', size: 1, avg: 99980, ref: 100000, bid: 99985, ask: 99986, spreadBps: 0.1 }),
    ev(15 * 60000 + 4800, 'market_bar', { bar: at(15 * 60000), reason: 'clock', close: 99900, ws: null, spread: null }),
    ev(15 * 60000 + 5000, 'stop_placed', { trigger: 100500, size: 1 }),
    ev(15 * 60000 + 300000, 'exit_fill', { tag: 'SL', px: 100520, sz: 1, ref: 100500 }),
  ].join('\n') + '\n')
  const a = auditJournal(readJournals([dir]))
  assert.equal(a.bars, 2)
  assert.equal(a.segments.close_to_bar_read['testnet|BTC|ws_close'].p50, 3400)
  assert.equal(a.segments.close_to_decision['testnet|BTC|calm'].p50, 4300)
  assert.equal(a.segments.bar_read_to_decision['testnet|BTC|calm'].p50, 900)
  assert.equal(a.segments.close_to_entry_logged['testnet|BTC|reversal_entry'].p50, 5600)
  assert.equal(a.segments.reversal_exit_to_entry['testnet|BTC|reversal'].p50, 900)
  assert.equal(a.segments.close_to_stop_placed['testnet|BTC|at_close'].p50, 5000)
  // Long fermé à 99 990 pour une clôture à 100 000 : 1 pb défavorable.
  assert.ok(Math.abs(a.costsBps.market_exit_vs_close['testnet|BTC|REV'].p50 - 1) < 1e-9)
  // Short entré à 99 980 : 2 pb défavorables, dont 1,45 pb de dérive du milieu et 0,05 pb de demi-spread.
  assert.ok(Math.abs(a.costsBps.entry_vs_close['testnet|BTC|calm'].p50 - 2) < 1e-9)
  assert.ok(Math.abs(a.costsBps.entry_mid_drift_at_quote['testnet|BTC|calm'].p50 - 1.45) < 1e-9)
  // Stop du short exécuté 20 $ au-dessus du déclenchement : 2 pb défavorables.
  assert.ok(Math.abs(a.costsBps.resting_exit_vs_level['testnet|BTC|SL'].p50 - 1.99) < 0.01)
  assert.equal(a.counts.ws_not_seen, 1)
  assert.ok(!JSON.stringify(a).includes('"z"'))
})

test('ordres publics : délai depuis la clôture, remplissage, écart à la clôture, position sans stop', () => {
  const d: PublicData = {
    candles: [{ t: T - 15 * 60000, c: '84500' }],
    orders: [
      { order: { coin: 'BTC', side: 'A', limitPx: '84047', sz: '0', oid: 1, timestamp: T + 5014, isTrigger: false, triggerPx: '0', orderType: 'Limit', origSz: '0.01182', tif: 'Ioc', cloid: '0x5b0c01abaf', reduceOnly: false }, status: 'open', statusTimestamp: T + 5014 },
      { order: { coin: 'BTC', side: 'A', limitPx: '84047', sz: '0', oid: 1, timestamp: T + 5014, isTrigger: false, triggerPx: '0', orderType: 'Limit', origSz: '0.01182', tif: 'Ioc', cloid: '0x5b0c01abaf', reduceOnly: false }, status: 'filled', statusTimestamp: T + 5014 },
      { order: { coin: 'BTC', side: 'B', limitPx: '89361', sz: '0.01182', oid: 2, timestamp: T + 15 * 60000 + 4791, isTrigger: true, triggerPx: '85105', orderType: 'Stop Market', origSz: '0.01182', tif: null, cloid: '0x5b0c0303d4', reduceOnly: true }, status: 'reduceOnlyCanceled', statusTimestamp: T + 2 * 86400000 },
      { order: { coin: 'BTC', side: 'B', limitPx: '89236', sz: '0', oid: 3, timestamp: T + 2 * 86400000, isTrigger: false, triggerPx: '0', orderType: 'Market', origSz: '0.01182', tif: 'FrontendMarket', cloid: null, reduceOnly: true }, status: 'filled', statusTimestamp: T + 2 * 86400000 },
    ],
    fills: [{ coin: 'BTC', px: '84470', sz: '0.01182', side: 'A', time: T + 5014, oid: 1, crossed: true, fee: '0.449295', tid: 1, cloid: '0x5b0c01abaf', dir: 'Open Short' }],
  }
  const rows = auditOrders(d)
  assert.equal(rows.length, 3)
  const e = rows.find(r => r.oid === 1)!
  assert.equal(e.kind, 'entry')
  assert.equal(e.fromCloseMs, 5014)
  assert.equal(e.fillRatio, 1)
  assert.equal(e.firstFillMs, 0)
  // Vente à 84 470 pour une clôture à 84 500 : 3,55 pb défavorables ; frais 4,5 pb.
  assert.ok(Math.abs(e.vsCloseBps! - 3.5503) < 1e-3)
  assert.ok(Math.abs(e.feeBps! - 4.5) < 1e-3)
  assert.equal(rows.find(r => r.oid === 3)!.kind, 'manual')
  const s = summarizeOrders(rows)
  assert.equal(s.orders.bot, 2)
  assert.equal(s.orders.manual, 1)
  assert.equal(s.closeToExchangeMs.entry.p50, 5014)
  assert.equal(s.closeToExchangeMs.stop.p50, 4791)
  assert.deepEqual(s.unprotectedAfterEntryMs, [{ entryAt: at(5014), ms: 15 * 60000 - 5014 + 4791 }])
})

test('coût immédiat : niveaux exacts, puis tranches agrégées au pire prix, sans double compte', async () => {
  const { bucketOf, immediateCost } = await import('../execution/close-probe-report.ts')
  assert.equal(bucketOf(83770, 4), 10)
  assert.equal(bucketOf(3950.5, 4), 1)
  const exact = { sig: null, levels: [[[99, 1, 1], [98, 1, 1]], [[101, 1, 1], [102, 1, 1]]] as [number, number, number][][] }
  // Tranche à 110 (pas de 10) : à cheval sur le carnet exact, ignorée ; 120 : comptée à 130.
  const agg = { sig: 2, levels: [[[90, 5, 3]], [[110, 5, 3], [120, 5, 3]]] as [number, number, number][][] }
  const mid = 100
  const small = immediateCost([exact as any], 1, 101, mid)
  assert.ok(small.complete && Math.abs(small.bps - 100) < 1e-9)
  const big = immediateCost([exact as any, agg as any], 1, 101 + 102 + 130, mid)
  assert.ok(big.complete)
  assert.ok(Math.abs(big.worstBps - 3000) < 1e-9)
  assert.equal(immediateCost([exact as any], 1, 1e6, mid).complete, false)
})
