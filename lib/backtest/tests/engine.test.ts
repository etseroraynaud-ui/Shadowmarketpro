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
  const r = runBacktest(b, signalsOf(6, { long: [0] }), settings({ sizing: 'risk', sizeValue: 1, stopLossPct: 5, leverage: 10 }))
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

test('levier : la position vaut capital × levier, le gain suit', () => {
  const rows = flat(6)
  rows[4] = [110, 110, 110, 110]
  rows[5] = [110, 110, 110, 110]
  const r = runBacktest(barsOf(rows), signalsOf(6, { long: [0], exitLong: [3] }), settings({ leverage: 3 }))
  const t = r.trades[0]
  assert.ok(close(t.notional, 30000))
  assert.ok(close(t.pnl, 3000))
  assert.ok(close(r.equity[5], 13000))
  assert.equal(r.warnings.length, 0)
})

test('levier : liquidation au prix où le capital tombe à la marge de maintenance', () => {
  const rows = flat(8)
  rows[2] = [100, 100, 85, 95]
  const sig = signalsOf(8, { long: [0, 4] })
  const r = runBacktest(barsOf(rows), sig, settings({ leverage: 10, maintenancePct: 0.5 }))
  // 1 000 BTC achetés à 100 avec 10 000 de capital : (100 × 1000 − 10 000) / (1000 × 0,995).
  const liq = 90000 / 995
  assert.equal(r.trades.length, 1)
  const t = r.trades[0]
  assert.equal(t.reason, 'liquidation')
  assert.equal(t.exitIdx, 2)
  assert.ok(close(t.exitPrice, liq))
  assert.ok(close(t.pnl, -10000))
  assert.equal(r.equity[2], 0)
  assert.equal(r.equity[7], 0)
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0].fr, /liquidé/)
})

test('levier : un stop plus proche que la liquidation passe avant elle, un stop plus loin jamais', () => {
  const rows = flat(6)
  rows[2] = [100, 100, 85, 95]
  const sig = signalsOf(6, { long: [0] })
  const near = runBacktest(barsOf(rows), sig, settings({ leverage: 10, stopLossPct: 5 }))
  assert.equal(near.trades[0].reason, 'stop')
  assert.ok(close(near.trades[0].pnl, -5000))
  const far = runBacktest(barsOf(rows), sig, settings({ leverage: 10, stopLossPct: 12 }))
  assert.equal(far.trades[0].reason, 'liquidation')
})

test('levier : gap sous le prix de liquidation, le capital s\'arrête à zéro', () => {
  const rows = flat(6)
  rows[2] = [70, 72, 65, 68]
  const r = runBacktest(barsOf(rows), signalsOf(6, { long: [0] }), settings({ leverage: 5 }))
  assert.equal(r.trades[0].reason, 'liquidation')
  assert.equal(r.trades[0].exitPrice, 70)
  assert.equal(r.equity[5], 0)
})

test('levier : liquidation d\'un short à la hausse ; sans levier, pas de liquidation d\'un long', () => {
  const rows = flat(6)
  rows[2] = [100, 125, 100, 120]
  const short = runBacktest(barsOf(rows), signalsOf(6, { short: [0] }), settings({ direction: 'short', leverage: 5 }))
  assert.equal(short.trades[0].reason, 'liquidation')
  assert.ok(close(short.trades[0].exitPrice, 60000 / 502.5))
  const crash = flat(6)
  crash[2] = [100, 100, 50, 55]
  const spot = runBacktest(barsOf(crash), signalsOf(6, { long: [0] }), settings())
  assert.equal(spot.trades[0].reason, 'end')
  assert.ok(close(spot.equity[2], 10000 * 0.55))
})

test('financement des perpétuels : payé par les longs à chaque échéance de 8 h', () => {
  // Barres journalières : trois échéances par jour. Long tenu des ouvertures 1 à 4 : barres 2 et 3.
  const r = runBacktest(barsOf(flat(6)), signalsOf(6, { long: [0], exitLong: [3] }), settings({ leverage: 2, fundingPct: 0.01 }))
  const t = r.trades[0]
  const expected = 6 * 0.0001 * 200 * 100
  assert.ok(close(t.fees, expected))
  assert.ok(close(t.pnl, -expected))
  assert.ok(close(r.equity[5], 10000 - expected))
  const short = runBacktest(barsOf(flat(6)), signalsOf(6, { short: [0], exitShort: [3] }), settings({ direction: 'short', leverage: 2, fundingPct: 0.01 }))
  assert.ok(close(short.trades[0].pnl, expected))
})
