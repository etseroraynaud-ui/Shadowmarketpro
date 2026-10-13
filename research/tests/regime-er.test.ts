// Mesures de régime avant le signal (research/lib/regime-er.ts) : formules, causalité (la bougie de
// signal et les bougies suivantes ne changent rien), percentile causal, et variantes V1–V3 exprimées
// sans toucher au moteur.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CFG, causalPct, efficiencyRatio, fakeoutFrequency, groupOf, measures, rangeAtSignals, referenceAsset, variantInputs } from '../lib/regime-er.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'

const bars = (c: number[], wick = 0): Bars => {
  const n = c.length
  const f = (g: (i: number) => number) => Float64Array.from({ length: n }, (_, i) => g(i))
  return { n, t: f(i => i * 900000), o: f(i => c[Math.max(0, i - 1)]), h: f(i => Math.max(c[i], c[Math.max(0, i - 1)]) + wick), l: f(i => Math.min(c[i], c[Math.max(0, i - 1)]) - wick), c: Float64Array.from(c), v: f(() => 1) }
}

test('ER : 1 pour un trajet monotone, 0 pour un aller-retour, bougie de signal exclue', () => {
  const up = Array.from({ length: 30 }, (_, i) => 100 + i)
  const er = efficiencyRatio(up, 20)
  assert.ok(Number.isNaN(er[20]))
  assert.equal(er[21], 1)
  const zig = Array.from({ length: 30 }, (_, i) => (i % 2 ? 101 : 100))
  assert.equal(efficiencyRatio(zig, 20)[25], 0)
  // Valeur à la main : clôtures 100, 102, 101, 104 → |104 − 100| / (2 + 1 + 3).
  assert.ok(Math.abs(efficiencyRatio([100, 102, 101, 104, 999], 3)[4] - 4 / 6) < 1e-12)
  // Changer la clôture de la bougie i ne change pas ER[i].
  const a = efficiencyRatio([...up.slice(0, 25), 5000, ...up.slice(26)], 20)
  assert.equal(a[25], er[25])
})

test('fréquence des faux départs : issue connue seulement après K bougies, sans lecture du futur', () => {
  const R = (s: number) => () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  const r = R(7)
  const c: number[] = [100]
  for (let i = 1; i < 3000; i++) c.push(c[i - 1] * (1 + (r() - 0.5) * 0.01))
  const b = bars(c, 0.05)
  const full = fakeoutFrequency(b, 20, 4, 672, 10)
  for (const i of [800, 1500, 2999]) {
    const cut = bars(c.slice(0, i + 1), 0.05)
    const part = fakeoutFrequency(cut, 20, 4, 672, 10)
    assert.equal(part[i], full[i], `bougie ${i}`)
  }
  const x = full.filter(Number.isFinite)
  assert.ok(x.length > 1000 && x.every(v => v >= 0 && v <= 1))
})

test('percentile causal et quartiles de régime', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2.5]
  assert.equal(causalPct(x, 10, 10, 5), 2 / 10)
  assert.ok(Number.isNaN(causalPct(x, 3, 10, 5)))
  assert.deepEqual([0, 0.2499, 0.25, 0.5, 0.75, 1].map(groupOf), [0, 0, 1, 2, 3, 3])
  assert.equal(groupOf(NaN), -1)
})

test('variantes : V1 retire, V2 déplace d\'une bougie sous conditions, V3 garde les entrées et change seulement le jeu', () => {
  const a = referenceAsset('ethusdt')
  const M = measures(a)
  const { range } = rangeAtSignals(a, M)
  const nRange = range.reduce((s, x) => s + x, 0)
  assert.ok(nRange > 50)
  const { long, short } = a.signals
  const v1 = variantInputs(a, M, range, 'V1')
  for (let i = 0; i < a.bars.n; i++) {
    assert.equal(v1.override.long[i], range[i] ? 0 : long[i])
    assert.equal(v1.override.short[i], range[i] ? 0 : short[i])
  }
  const v2 = variantInputs(a, M, range, 'V2')
  assert.equal(v2.moved + v2.dropped, [...range.keys()].filter(i => range[i]).reduce((s, i) => s + long[i] + short[i], 0))
  for (let i = a.lo; i < a.end; i++) {
    if (!range[i]) continue
    if (long[i]) assert.equal(v2.override.long[i], 0)
    if (long[i] && v2.override.long[i + 1] && !long[i + 1]) {
      // Entrée déplacée : la clôture de i + 1 est encore au-delà du niveau cassé à i.
      assert.ok(a.bars.c[i + 1] > M.hhPrev[a.select[i]][i])
    }
  }
  const v3 = variantInputs(a, M, range, 'V3')
  assert.equal(v3.override, a.signals)
  assert.equal(v3.sets.length, 3)
  for (const k of Object.keys(v3.sets[0]) as (keyof typeof v3.sets[0])[]) {
    const exit = ['atrStopMult', 'atrTrailMult', 'useTP1', 'tp1AtrMult', 'tp1QtyPct'].includes(k)
    assert.equal(v3.sets[2][k], exit ? v3.sets[1][k] : v3.sets[0][k], k)
  }
  for (let i = 0; i < a.bars.n; i++) assert.equal(v3.select[i], v3.select[i] === 2 ? 2 : a.select[i])
  assert.ok(v3.moved > 0)
  // Sans aucune bougie en range, V3 redonne V0 position par position.
  const none = variantInputs(a, M, new Uint8Array(a.bars.n), 'V3')
  const r0 = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)
  const r3 = simulate(a.m, none.sets, a.costs(1), a.lo, a.end, none.select, none.override)
  assert.deepEqual(r3.positions, r0.positions)
  assert.equal(CFG.rangePct, 0.25)
})
