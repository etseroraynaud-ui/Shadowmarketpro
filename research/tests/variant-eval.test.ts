// Boucle de simulation à taille par jeu (research/lib/variant-eval.ts) : identique à simulate() à
// taille inchangée, et la taille ne change aucune décision d'entrée ou de sortie.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { referenceAsset } from '../lib/regime-er.ts'
import { dailyOf, exposure, simulateSized } from '../lib/variant-eval.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'

const a = referenceAsset('ethusdt')

test('taille inchangée : même résultat que simulate(), bougie par bougie', () => {
  const r0 = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)
  const r1 = simulateSized(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, [1, 1])
  assert.deepEqual(Array.from(r1.equity), Array.from(r0.equity))
  assert.deepEqual(r1.positions, r0.positions)
})

test('taille réduite pour le jeu agité : mêmes décisions, quantités et frais à l\'échelle', () => {
  const full = simulateSized(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, [1, 1])
  const third = simulateSized(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, [1, 1 / 3])
  assert.equal(third.positions.length, full.positions.length)
  for (let k = 0; k < full.positions.length; k++) {
    const p = full.positions[k], q = third.positions[k]
    assert.deepEqual([q.entryIdx, q.exitIdx, q.dir, q.set, q.exits.join('+')], [p.entryIdx, p.exitIdx, p.dir, p.set, p.exits.join('+')])
    const ratio = q.notional / q.equityAtEntry / (p.notional / p.equityAtEntry)
    assert.ok(Math.abs(ratio - (p.set === 1 ? 1 / 3 : 1)) < 1e-9, `position ${k}`)
    assert.ok(Math.abs(q.pnlPct - p.pnlPct) < 1e-9)
  }
  const d = dailyOf(a.bars, third.equity, a.lo, a.end)
  const e3 = exposure(third, d.a, d.z), e1 = exposure(full, d.a, d.z)
  assert.equal(e3.timeInMarket, e1.timeInMarket)
  assert.ok(e3.avgGross < e1.avgGross)
})
