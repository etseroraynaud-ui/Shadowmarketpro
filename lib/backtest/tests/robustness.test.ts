import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runStrategy } from '../index.ts'
import { randomEntryTest, tradeBootstrap } from '../robustness.ts'
import { optimize, axisValues } from '../optimize.ts'
import { DEFAULT_SETTINGS } from '../types.ts'
import { randomBars } from './helpers.ts'

const b = randomBars(1500, 21)
const code = 'f = input(10, "f", 2, 50)\ns = input(40, "s", 10, 200)\nlong = crossover(ema(close, f), ema(close, s))\nexitLong = crossunder(ema(close, f), ema(close, s))'

test('entrées au hasard : reproductible, centile entre 0 et 1', () => {
  const out = runStrategy(b, { kind: 'script', code, overrides: {} }, DEFAULT_SETTINGS)
  const a = randomEntryTest(b, out.result, DEFAULT_SETTINGS, 300, 3)!
  const c = randomEntryTest(b, out.result, DEFAULT_SETTINGS, 300, 3)!
  assert.deepEqual([...a.sims], [...c.sims])
  assert.ok(a.percentile >= 0 && a.percentile <= 1)
  assert.ok(a.p5 <= a.median && a.median <= a.p95)
})

test('sur une marche aléatoire, la stratégie n\'est pas systématiquement au-dessus du hasard', () => {
  let above = 0
  const runs = 12
  for (let seed = 1; seed <= runs; seed++) {
    const bars = randomBars(1200, 100 + seed)
    const out = runStrategy(bars, { kind: 'script', code, overrides: {} }, DEFAULT_SETTINGS)
    const r = randomEntryTest(bars, out.result, DEFAULT_SETTINGS, 300, seed)
    if (r && r.percentile > 0.95) above++
  }
  assert.ok(above <= 3, `${above} / ${runs} au-dessus du 95e centile`)
})

test('tirage des trades : quantiles ordonnés', () => {
  const out = runStrategy(b, { kind: 'script', code, overrides: {} }, DEFAULT_SETTINGS)
  const bs = tradeBootstrap(out.result.trades, 500, 1)!
  assert.ok(bs.final5 <= bs.final50 && bs.final50 <= bs.final95)
  assert.ok(bs.dd95 <= bs.dd50 && bs.dd50 <= 0)
})

test('optimisation : grille complète, meilleure cellule valide, hors échantillon calculé', () => {
  assert.deepEqual(axisValues({ name: 'x', from: 5, to: 20, step: 5 }), [5, 10, 15, 20])
  const s = { ...DEFAULT_SETTINGS, splitTime: b.t[1000] }
  const r = optimize(b, code, {}, [{ name: 'f', from: 5, to: 20, step: 5 }, { name: 's', from: 30, to: 90, step: 30 }], s, 'sharpe')
  assert.equal(r.cells.length, 12)
  assert.ok(r.best && r.best.valid)
  for (const c of r.cells) if (c.valid) assert.ok(c.score <= r.best!.score)
  assert.ok(r.bestOut)
})
