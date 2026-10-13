// Invalidation précoce (research/lib/early-exit.ts) : mesures à i + k, valeur d'une sortie, et boucle
// de rejeu identique à simulate() sans la règle, qui ne ferme qu'à i + k les positions non confirmées.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { exitValueR, landmark, simulateEarlyExit } from '../lib/early-exit.ts'
import { referenceAsset } from '../lib/regime-er.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'

const B = (rows: [number, number, number, number, number][]): Bars => {
  const n = rows.length
  const col = (k: number) => Float64Array.from(rows, r => r[k])
  return { n, t: Float64Array.from({ length: n }, (_, i) => i * 900000), o: col(0), h: col(1), l: col(2), c: col(3), v: col(4) }
}
const S = { atrStopMult: 1.1, useTP1: true, tp1AtrMult: 0.9, tp1QtyPct: 20 } as ShockParams
const pos = (dir: 1 | -1, exitIdx: number) => ({ dir, entryIdx: 1, entryPrice: 104, atrAtEntry: 2, exitIdx }) as PositionRecord

test('mesures à i + k : rendement, retracement du choc, réintégration, volume, TP1', () => {
  // Choc haussier 100 → 104 (bougie 1, volume 10), niveau cassé 102.
  const b = B([[100, 100, 100, 100, 5], [100, 104, 100, 104, 10], [104, 105, 103, 104.5, 4], [104.5, 104.6, 101, 101.5, 6], [101.5, 102, 100.5, 101, 2]])
  const l1 = landmark(b, pos(1, 4), 1, 102, S)
  assert.deepEqual([l1.open, l1.retAtr, l1.reentered, l1.tp1], [true, 0.25, false, false])
  assert.ok(Math.abs(l1.retR - 0.25 / 1.1) < 1e-12)
  assert.ok(Math.abs(l1.retrace - -0.125) < 1e-12)
  assert.equal(l1.volRatio, 0.4)
  // k = 2 : TP1 (104 + 1,8) jamais atteint, clôture 101,5 sous le niveau, 62,5 % du choc rendu.
  const l2 = landmark(b, pos(1, 4), 2, 102, S)
  assert.deepEqual([l2.open, l2.retAtr, l2.reentered, l2.tp1, l2.retrace, l2.volRatio], [true, -1.25, true, false, 0.625, 0.5])
  // Sortie à la bougie 3 : plus ouvert après i + 2 … mais encore après i + 1.
  assert.equal(landmark(b, pos(1, 3), 2, 102, S).open, false)
  // TP1 : par la clôture de i + 1, ou par un extrême à partir de i + 2 seulement.
  const bt = B([[100, 100, 100, 100, 1], [100, 104, 100, 104, 1], [104, 106, 103, 105, 1], [105, 106, 104, 105, 1]])
  assert.equal(landmark(bt, pos(1, 3), 1, 102, S).tp1, false)
  assert.equal(landmark(bt, pos(1, 3), 2, 102, S).tp1, true)
  // Short, en miroir : choc 104 → 100, niveau cassé 102.
  const bs = B([[104, 104, 104, 104, 1], [104, 104, 100, 100, 4], [100, 101, 99, 103, 2]])
  const ls = landmark(bs, { ...pos(-1, 2), entryPrice: 100 }, 1, 102, S)
  assert.deepEqual([ls.retAtr, ls.reentered, ls.retrace, ls.volRatio], [-1.5, true, 0.75, 0.5])
})

test('valeur d\'une sortie : part du TP1 exécutée, reste à la clôture, commissions', () => {
  const l = { retR: -0.5, tp1: false } as ReturnType<typeof landmark>
  assert.equal(exitValueR(l, S, 0.05), -0.55)
  const t = { retR: 1, tp1: true } as ReturnType<typeof landmark>
  assert.ok(Math.abs(exitValueR(t, S, 0.05) - (0.2 * 0.9 / 1.1 + 0.8 - 0.05)) < 1e-12)
})

const a = referenceAsset('ethusdt')
const v0 = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)

test('sans règle : même résultat que simulate(), bougie par bougie', () => {
  const r = simulateEarlyExit(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, null)
  assert.deepEqual(Array.from(r.equity), Array.from(v0.equity))
  assert.deepEqual(r.positions, v0.positions)
  assert.equal(r.early.size, 0)
})

test('règle à 4 bougies : ferme à i + 4 les seules positions non confirmées, identique avant', () => {
  const r = simulateEarlyExit(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals, 4)
  const c = a.bars.c
  assert.ok(r.early.size > 0)
  for (const p of r.positions) {
    const j = p.entryIdx + 4
    if (r.early.has(p.entryIdx)) {
      assert.equal(p.exitIdx, j)
      assert.equal(p.exits.at(-1), 'FLIP')
      assert.ok(p.dir * (c[j] - p.entryPrice) <= 0)
    } else if (p.exitIdx > j) assert.ok(p.dir * (c[j] - p.entryPrice) > 0, `position entrée à ${p.entryIdx}`)
  }
  // Tout ce qui précède la première invalidation est identique à V0.
  const first = Math.min(...r.early)
  const before = (ps: PositionRecord[]) => ps.filter(p => p.entryIdx < first)
  assert.deepEqual(before(r.positions), before(v0.positions))
  for (let i = a.lo; i < first + 4; i++) assert.equal(r.equity[i], v0.equity[i])
})
