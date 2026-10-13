// Mesures du surajustement de sélection (research/lib/overfit.ts) : lois normales, combinaisons,
// Sharpe probabiliste et dégonflé, CSCV-PBO sur des séries simulées, walk-forward sans lecture du futur.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blockIndex, combinations, cscv, dsr, expectedMaxSharpe, normCdf, normInv, psr, sharpe, walkForward } from '../lib/overfit.ts'
import { gauss, rng } from '../lib/portfolio.ts'

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) < tol, `${a} ≉ ${b}`)
const noise = (seed: number, T: number, mu = 0, sd = 0.01) => { const g = gauss(rng(seed)); return Array.from({ length: T }, () => mu + sd * g()) }

test('loi normale : répartition et quantile', () => {
  near(normCdf(0), 0.5, 1e-7)
  near(normCdf(1.959964), 0.975, 1e-6)
  near(normCdf(-2.326348), 0.01, 1e-6)
  for (const p of [0.001, 0.01, 0.3, 0.5, 0.9, 0.999]) near(normCdf(normInv(p)), p, 1e-6)
})

test('combinaisons et blocs', () => {
  assert.deepEqual([...combinations(4, 2)], [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]])
  let n = 0
  for (const _ of combinations(16, 8)) n++
  assert.equal(n, 12870)
  const b = blockIndex(10, 4)
  assert.deepEqual(Array.from(b), [0, 0, 0, 1, 1, 2, 2, 2, 3, 3])
})

test('Sharpe probabiliste et dégonflé', () => {
  const x = noise(1, 3000, 0.001, 0.01)
  const p = psr(x, 0)
  // série presque normale : z ≈ SR·√(T − 1)
  near(p.z, (p.sr * Math.sqrt(2999)) / Math.sqrt(1 - p.skew * p.sr + ((p.kurt - 1) / 4) * p.sr ** 2), 1e-9)
  assert.equal(expectedMaxSharpe(1, 0.05), 0)
  assert.ok(expectedMaxSharpe(10, 0.05) < expectedMaxSharpe(100, 0.05))
  // N = 1 : DSR = PSR(0) ; plus d'essais, DSR plus faible
  near(dsr(x, 1, 0.05).p, p.p, 1e-12)
  assert.ok(dsr(x, 1000, 0.05).p < dsr(x, 10, 0.05).p)
  // queue gauche épaisse : à Sharpe égal, PSR plus faible
  const skewed = x.map((v, i) => (i % 100 === 0 ? v - 0.08 : v + 0.0008))
  const ps = psr(skewed, 0)
  assert.ok(ps.skew < -1 && ps.kurt > 3)
  assert.ok(ps.z < sharpe(skewed) * Math.sqrt(2999))
})

test('CSCV : sélection dans du bruit ≈ 50 %, vraie supériorité ≈ 0 %', () => {
  const T = 1600
  const pure = Array.from({ length: 12 }, (_, k) => noise(100 + k, T))
  const r0 = cscv(pure, 10)
  assert.equal(r0.splits, 252)
  assert.ok(r0.pbo > 0.2 && r0.pbo < 0.8, `PBO bruit ${r0.pbo}`)
  const edge = [...pure.slice(1), noise(7, T, 0.004)]
  const r1 = cscv(edge, 10)
  assert.ok(r1.pbo < 0.05, `PBO avec une vraie supériorité ${r1.pbo}`)
  assert.equal(r1.chosenCount[11], r1.splits)
  near(r1.meanOosRank.reduce((s, x) => s + x, 0) / 12, 0.5, 1e-9)
})

test('walk-forward : choisit sur le passé seulement', () => {
  const a = [0.01, 0.012, 0.011, -0.05, -0.05, -0.05], b = [0.0, 0.001, -0.001, 0.05, 0.06, 0.05]
  const w = walkForward([a, b], [3])
  assert.deepEqual(w.folds.map(f => f.chosen), [0])
  assert.deepEqual(w.oos, [-0.05, -0.05, -0.05])
  // modifier l'avenir ne change pas le choix
  const w2 = walkForward([a.map((x, i) => (i >= 3 ? 9 : x)), b], [3])
  assert.equal(w2.folds[0].chosen, 0)
})
