// Étude de transfert GC / NQ : statistiques, sélection, coûts et couverture (fonctions pures).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { holm, neweyWestT, clusterT, loSharpe, tstat, quantile } from '../futures-transfer/lib/stats.ts'
import { scoreS, pickPlateau, plateauOK, quantileK } from '../futures-transfer/lib/selection.ts'
import { withCostFn, execCost, CONTRACTS, scenario } from '../futures-transfer/lib/harness.ts'
import { expectedOpen, coverageStart, newYorkClock } from '../futures-transfer/lib/proxy-data.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'

test('Holm : p ajustés pas à pas, ordre conservé, monotones', () => {
  const adj = holm([0.01, 0.04, 0.03, 0.5])
  assert.deepEqual(adj.map(x => +x.toFixed(4)), [0.04, 0.09, 0.09, 0.5])
})

test('t de Newey–West : retard 0 = t ordinaire (écart type population), autocorrélation positive le réduit', () => {
  const x = [0.3, -0.1, 0.2, 0.4, -0.2, 0.1, 0.5, 0.0, 0.2, -0.3]
  const m = x.reduce((a, b) => a + b, 0) / x.length
  const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length)
  assert.ok(Math.abs(neweyWestT(x, 0) - m / (sd / Math.sqrt(x.length))) < 1e-12)
  const trend = Array.from({ length: 200 }, (_, i) => 0.01 + 0.05 * Math.sin(i / 10))
  assert.ok(neweyWestT(trend, 10) < neweyWestT(trend, 0))
})

test('t par grappes : une seule observation par grappe ≈ t ordinaire', () => {
  const x = [1, 2, 0.5, 1.5, -0.5, 2.5]
  const t1 = clusterT(x, [1, 2, 3, 4, 5, 6])
  assert.ok(Math.abs(t1 - tstat(x)) < 1e-9)
})

test('Sharpe de Lo : sans autocorrélation, η(q) = √q', () => {
  const x = [0.01, -0.02, 0.015, 0.0, -0.005, 0.02, -0.01, 0.005]
  const r = loSharpe(x, 365.25, 0)
  assert.ok(Math.abs(r.eta - Math.sqrt(365.25)) < 1e-9)
})

test('note S de regime-wf : min des deux moitiés, 15 positions par moitié, purge des sorties après la fin', () => {
  const ps = [] as { entryIdx: number; exitIdx: number; net: number }[]
  for (let i = 0; i < 40; i++) ps.push({ entryIdx: i * 10, exitIdx: i * 10 + 5, net: i < 20 ? 0.01 + (i % 3) * 0.005 : 0.002 + (i % 4) * 0.004 - 0.004 })
  const s = scoreS(ps, 0, 400)
  assert.equal(s.n1 + s.n2, 40)
  assert.ok(Math.abs(s.s - Math.min(s.t1, s.t2)) < 1e-12)
  // une position qui sort après la fin de la fenêtre n'est pas comptée
  const s2 = scoreS([...ps, { entryIdx: 395, exitIdx: 420, net: 1 }], 0, 400)
  assert.equal(s2.n1 + s2.n2, 40)
  assert.equal(scoreS(ps.slice(0, 25), 0, 400).s, -Infinity)
})

test('plateau : moyenne sur ± 1 cran, extrémités exclues, ex aequo vers le plus grand k, seuil 1', () => {
  const ks = [1.5, 1.6, 1.7, 1.8, 1.9]
  const p = pickPlateau(ks, [5, 0, 3, 3, 3])
  assert.equal(p.k, 1.8)
  assert.ok(Math.abs(p.p - 3) < 1e-12)
  assert.equal(p.trade, true)
  assert.equal(pickPlateau(ks, [0.5, 0.9, 0.9, 0.9, 0.5]).trade, false)
  // les extrémités ne sont jamais choisies, mais comptent comme voisines
  assert.equal(pickPlateau(ks, [9, 0.5, 0.5, 0.5, 0]).k, 1.6)
  assert.equal(pickPlateau(ks, [-Infinity, -Infinity, 2, 2, 2]).k, 1.8)
  assert.equal(plateauOK(ks, [1, 1, 1, 1, 1], 1.7).ok, true)
  assert.equal(plateauOK(ks, [1, 1, 1, 1, 1], 1.6).ok, false)
})

test('seuil quantile : sur les seules bougies d\'entraînement admissibles', () => {
  const z = Float64Array.from({ length: 1000 }, (_, i) => (i < 500 ? i / 100 : 100))
  const k = quantileK(z, 0, 500, () => true, 0.99)
  assert.ok(Math.abs(k - quantile(Array.from(z.subarray(0, 500)), 0.99)) < 1e-12)
  assert.ok(k < 5)
})

test('coûts futures : fraction du nominal et facteur sur le capital', () => {
  const c = CONTRACTS.gold, s = scenario('base')
  assert.ok(Math.abs(execCost(2000, c, s) - (3.5 / 200000 + 0.1 / 2000)) < 1e-15)
  const equity = Float64Array.from([100, 100, 110, 110, 110])
  const res = { equity, positions: [{ entryIdx: 1, exitIdx: 3, entryPrice: 10, exitPrice: 11, pnl: 10, equityAtEntry: 100 }] } as unknown as ShockResult
  const r = withCostFn(res, () => 0.01)
  assert.deepEqual(Array.from(r.equity).map(x => +x.toFixed(6)), [100, 99, 108.9, 107.811, 107.811])
  assert.ok(Math.abs(r.net[0] - (1.1 * 0.99 * 0.99 - 1)) < 1e-12)
})

test('heures prévues et début de couverture continue', () => {
  assert.equal(expectedOpen(17 * 60 + 15, 2), false)
  assert.equal(expectedOpen(18 * 60, 0), true)
  assert.equal(expectedOpen(12 * 60, 6), false)
  assert.equal(expectedOpen(16 * 60 + 45, 5), true)
  // 3 semaines « séance au comptant seule » puis couverture complète : le début tombe sur la couverture complète.
  const t: number[] = []
  const start = Date.UTC(2014, 0, 5, 23, 0)
  for (let x = start; x < start + 70 * 864e5; x += 900000) {
    const k = newYorkClock(Float64Array.of(x))
    if (!expectedOpen(k.min[0], k.wday[0])) continue
    const full = x >= start + 21 * 864e5
    if (full || (k.min[0] >= 9 * 60 + 30 && k.min[0] < 16 * 60)) t.push(x)
  }
  const n = t.length
  const bars = { n, t: Float64Array.from(t), o: new Float64Array(n).fill(1), h: new Float64Array(n).fill(1), l: new Float64Array(n).fill(1), c: new Float64Array(n).fill(1), v: new Float64Array(n).fill(1) }
  const cov = coverageStart(bars)
  assert.ok(cov.t >= start + 20 * 864e5 && cov.t <= start + 23 * 864e5, new Date(cov.t).toISOString())
})
