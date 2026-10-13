// Anatomie des pertes (research/lib/loss-anatomy.ts) : classes, trajet intrabarre, point mort après +1 R.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { breakevenAfter1R, breakevenR, lossClass, tvPath } from '../lib/loss-anatomy.ts'
import type { Bars } from '../../lib/backtest/types.ts'

const B = (rows: [number, number, number, number][]): Bars => {
  const n = rows.length
  const col = (k: number) => Float64Array.from(rows, r => r[k])
  return { n, t: Float64Array.from({ length: n }, (_, i) => i * 900000), o: col(0), h: col(1), l: col(2), c: col(3), v: new Float64Array(n) }
}

test('classes : seuils de 0,5 R et 1 R sur la MFE des perdants', () => {
  assert.deepEqual([[-1, 0.49], [-1, 0.5], [-0.2, 0.99], [-0.9, 1], [0, 3], [0.1, 0.2]].map(([R, m]) => lossClass(R, m)), ['A', 'B', 'B', 'C', 'C', 'W'])
})

test('trajet intrabarre : extrême le plus proche de l\'ouverture d\'abord', () => {
  assert.deepEqual(tvPath(100, 101, 95, 99), [100, 101, 95, 99])
  assert.deepEqual(tvPath(100, 106, 99, 104), [100, 99, 106, 104])
})

test('point mort après +1 R : ordre des passages, bougie de sortie réduite à son ouverture', () => {
  // Long à 100, risque 2 : +1 R = 102. Bougie 1 : ouverture 102 (+1 R), haut 103 puis bas 99 → point mort touché.
  const b1 = B([[100, 100, 100, 100], [102, 103, 99, 101], [101, 105, 100.5, 104]])
  assert.deepEqual(breakevenAfter1R(b1, 0, 2, 1, 100, 2), { reached: true, beHit: true })
  // Bas d'abord (99) puis haut 103 : le retour sous 100 précède +1 R, rien de touché ensuite.
  const b2 = B([[100, 100, 100, 100], [99.5, 103, 99, 102], [102, 104, 101, 103]])
  assert.deepEqual(breakevenAfter1R(b2, 0, 2, 1, 100, 2), { reached: true, beHit: false })
  // Short : même logique, en miroir ; la bougie de sortie ne compte que par son ouverture.
  const b3 = B([[100, 100, 100, 100], [99.8, 100.1, 97.5, 98], [98, 101, 97, 100.5]])
  assert.deepEqual(breakevenAfter1R(b3, 0, 2, -1, 100, 2), { reached: true, beHit: false })
  const b4 = B([[100, 100, 100, 100], [99.8, 100.1, 97.5, 98], [100.2, 101, 97, 100.5]])
  assert.deepEqual(breakevenAfter1R(b4, 0, 2, -1, 100, 2), { reached: true, beHit: true })
})

test('R au point mort : TP1 conservé seulement s\'il est sous +1 R', () => {
  assert.ok(Math.abs(breakevenR(true, 0.9 / 1.1, 0.2, 0.1) - (0.2 * 0.9 / 1.1 - 0.1)) < 1e-12)
  assert.equal(breakevenR(false, 0.8 / 3.3, 0.2, 0.05), -0.05)
  assert.equal(breakevenR(true, 1.5, 0.5, 0.05), -0.05)
})
