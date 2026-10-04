import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runBacktest } from '../engine.ts'
import { barsOf, signalsOf, settings, close } from './helpers.ts'

// Barres plates à 100 sauf mention contraire : [open, high, low, close].
const flat = (n: number) => Array.from({ length: n }, () => [100, 100, 100, 100])

test('signal à la clôture, entrée à l\'ouverture suivante, frais déduits', () => {
  const rows = flat(6)
  rows[2] = [110, 112, 108, 111]
  rows[3] = [120, 121, 119, 120]
  rows[4] = [130, 131, 129, 130]
  const b = barsOf(rows)
  const sig = signalsOf(6, { long: [1], exitLong: [3] })
  const r = runBacktest(b, sig, settings({ feePct: 0.1 }))
  assert.equal(r.trades.length, 1)
  const t = r.trades[0]
  assert.equal(t.entryIdx, 2)
  assert.equal(t.entryPrice, 110)
  assert.equal(t.exitIdx, 4)
  assert.equal(t.exitPrice, 130)
  const qty = 10000 / 110
  const fees = 10000 * 0.001 + qty * 130 * 0.001
  assert.ok(close(t.pnl, qty * 20 - fees))
  assert.ok(close(r.equity[5], 10000 + t.pnl))
  assert.equal(r.position[2], 1)
  assert.equal(r.position[4], 0)
})

test('mode clôture : exécution au prix de clôture du signal', () => {
  const rows = flat(5)
  rows[1] = [100, 101, 99, 100]
  rows[2] = [105, 106, 104, 105]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(5, { long: [1], exitLong: [2] }), settings({ fill: 'close' }))
  assert.equal(r.trades[0].entryIdx, 1)
  assert.equal(r.trades[0].exitIdx, 2)
  assert.equal(r.trades[0].exitPrice, 105)
})

test('glissement défavorable à l\'achat comme à la vente', () => {
  const b = barsOf(flat(5))
  const r = runBacktest(b, signalsOf(5, { long: [0], exitLong: [2] }), settings({ slippagePct: 1 }))
  const t = r.trades[0]
  assert.ok(close(t.entryPrice, 101))
  assert.ok(close(t.exitPrice, 99))
  assert.ok(t.pnl < 0)
})

test('stop touché dans la barre : sortie au niveau du stop', () => {
  const rows = flat(6)
  rows[2] = [100, 101, 94, 96]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ stopLossPct: 5 }))
  const t = r.trades[0]
  assert.equal(t.reason, 'stop')
  assert.equal(t.exitIdx, 2)
  assert.ok(close(t.exitPrice, 95))
})

test('gap sous le stop : sortie à l\'ouverture', () => {
  const rows = flat(6)
  rows[2] = [90, 91, 88, 89]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ stopLossPct: 5 }))
  assert.equal(r.trades[0].exitPrice, 90)
})

test('stop et objectif dans la même barre : le stop passe en premier', () => {
  const rows = flat(6)
  rows[2] = [100, 111, 94, 100]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ stopLossPct: 5, takeProfitPct: 10 }))
  assert.equal(r.trades[0].reason, 'stop')
})

test('objectif rempli au prix limite, sans glissement', () => {
  const rows = flat(6)
  rows[2] = [100, 111, 99, 108]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ takeProfitPct: 10, slippagePct: 0.5 }))
  assert.equal(r.trades[0].reason, 'target')
  assert.ok(close(r.trades[0].exitPrice, 100.5 * 1.1))
})

test('stop suiveur : suit le plus haut, sort au retour', () => {
  const rows = flat(8)
  rows[2] = [100, 120, 100, 119]
  rows[3] = [119, 119, 105, 106]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(8, { long: [0] }), settings({ trailingPct: 10 }))
  const t = r.trades[0]
  assert.equal(t.reason, 'trailing')
  assert.equal(t.exitIdx, 3)
  assert.ok(close(t.exitPrice, 110))
})

test('vente à découvert : gain quand le prix baisse', () => {
  const rows = flat(5)
  rows[3] = [80, 80, 80, 80]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(5, { short: [0], exitShort: [2] }), settings({ direction: 'short' }))
  const t = r.trades[0]
  assert.equal(t.dir, -1)
  assert.ok(close(t.pnl, (10000 / 100) * 20))
})

test('signal opposé : retournement si les deux sens sont autorisés, sortie sinon', () => {
  const b = barsOf(flat(8))
  const sig = signalsOf(8, { long: [0], short: [3] })
  const both = runBacktest(b, sig, settings({ direction: 'both' }))
  assert.equal(both.trades.length, 2)
  assert.equal(both.trades[0].reason, 'reverse')
  assert.equal(both.trades[1].dir, -1)
  const longOnly = runBacktest(b, sig, settings({ direction: 'long' }))
  assert.equal(longOnly.trades.length, 1)
  assert.equal(longOnly.trades[0].exitIdx, 4)
})

test('taille par risque : perte au stop = % du capital choisi', () => {
  const rows = flat(6)
  rows[2] = [100, 100, 90, 92]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ sizing: 'risk', sizeValue: 1, stopLossPct: 5, maxLeverage: 10 }))
  assert.ok(close(r.trades[0].pnl, -100))
})

test('sortie après N barres', () => {
  const b = barsOf(flat(10))
  const r = runBacktest(b, signalsOf(10, { long: [0] }), settings({ maxBars: 3 }))
  assert.equal(r.trades[0].reason, 'time')
  assert.equal(r.trades[0].exitIdx, 4)
  assert.equal(r.trades[0].bars, 3)
})

test('fenêtre de dates : aucun trade hors de la fenêtre, position fermée à la fin', () => {
  const b = barsOf(flat(20))
  const sig = signalsOf(20, { long: [0, 2, 12] })
  const r = runBacktest(b, sig, settings({ from: b.t[5], to: b.t[15] }))
  assert.equal(r.trades.length, 1)
  assert.equal(r.trades[0].entryIdx, 13)
  assert.equal(r.trades[0].exitIdx, 15)
  assert.equal(r.trades[0].reason, 'end')
})

test('achat conservé et stratégie « toujours acheteur » coïncident', () => {
  const rows = Array.from({ length: 30 }, (_, i) => [100 + i, 101 + i, 99 + i, 100.5 + i])
  const b = barsOf(rows)
  const sig = signalsOf(30, { long: Array.from({ length: 30 }, (_, i) => i) })
  const r = runBacktest(b, sig, settings({ fill: 'close' }))
  assert.ok(Math.abs(r.metrics.totalReturn - r.benchMetrics.totalReturn) < 0.01)
})

test('mesures : drawdown maximal et taux de réussite', () => {
  const rows = flat(12)
  rows[2] = [100, 120, 100, 120]
  rows[3] = [120, 120, 90, 90]
  rows[4] = [90, 90, 90, 90]
  rows[7] = [100, 100, 100, 110]
  rows[8] = [110, 110, 110, 110]
  const b = barsOf(rows)
  const r = runBacktest(b, signalsOf(12, { long: [1, 6], exitLong: [3, 7] }), settings())
  assert.equal(r.trades.length, 2)
  assert.ok(close(r.metrics.maxDrawdown, 90 / 120 - 1))
  assert.equal(r.metrics.wins, 1)
  assert.equal(r.metrics.winRate, 0.5)
})

test('séparation échantillon / hors échantillon', () => {
  const b = barsOf(flat(40))
  const r = runBacktest(b, signalsOf(40, { long: [2, 25], exitLong: [5, 28] }), settings({ splitTime: b.t[20] }))
  assert.equal(r.split, 20)
  assert.equal(r.inSample!.trades, 1)
  assert.equal(r.outSample!.trades, 1)
})
