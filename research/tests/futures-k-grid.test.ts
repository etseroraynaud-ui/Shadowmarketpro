// Étude de transfert GC / NQ : ce que le seuil kMain change réellement dans le code d'origine
// (interaction avec kMicro, useMicroShock et le mode High Activity), sur des bougies synthétiques.
// Les seuils du préréglage ne sont ni affichés ni modifiés.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Bars } from '../../lib/backtest/types.ts'
import { marketFor } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import { ShockStrategy } from '../../lib/strategies/shock/strategy.ts'
import { kGrid, calmSet, agitatedSet, withK, effectiveMicro, shockThreshold, signature, effectiveConfigs } from '../futures-transfer/lib/k-grid.ts'

/** Marche aléatoire 15 min à queues épaisses, avec des tendances et un volume lié aux chocs. */
function synthetic(n = 8000, seed = 20261020): Bars {
  let s = seed >>> 0
  const u = () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return (((x ^ (x >>> 14)) >>> 0) + 0.5) / 4294967297 }
  const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u())
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), v = new Float64Array(n)
  let p = 2000, drift = 0
  for (let i = 0; i < n; i++) {
    if (i % 400 === 0) drift = 0.0004 * g()
    const jump = u() < 0.02 ? 6 * g() : 0
    const r = drift + 0.001 * (g() + jump)
    const open = p
    p = p * Math.exp(r)
    t[i] = Date.UTC(2020, 0, 1) + i * 15 * 60000
    o[i] = open
    c[i] = p
    h[i] = Math.max(open, p) * (1 + 0.0003 * Math.abs(g()))
    l[i] = Math.min(open, p) * (1 - 0.0003 * Math.abs(g()))
    v[i] = 100 * Math.exp(0.3 * g()) * (1 + 40 * Math.abs(r))
  }
  return { n, t, o, h, l, c, v }
}

const m = marketFor(synthetic(), 15, 0.1)
const sum = (x: Uint8Array) => x.reduce((a, b) => a + b, 0)
const same = (a: ArrayLike<number>, b: ArrayLike<number>) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (!(a[i] === b[i] || (Number.isNaN(a[i]) && Number.isNaN(b[i])))) return false; return true }

test('grille pré-enregistrée : 1,5 à 4,0 par pas de 0,1, 26 valeurs', () => {
  const ks = kGrid()
  assert.equal(ks.length, 26)
  assert.equal(ks[0], 1.5)
  assert.equal(ks[25], 4.0)
  for (let j = 1; j < ks.length; j++) assert.ok(Math.abs(ks[j] - ks[j - 1] - 0.1) < 1e-9)
})

test('jeu calme de V1 : micro-chocs coupés, kMain est le seul seuil de choc', () => {
  const P = calmSet()
  assert.equal(P.useMicroShock, false)
  assert.ok(Number.isNaN(effectiveMicro(P)))
  for (const k of kGrid()) assert.equal(shockThreshold(withK(P, k)), k)
  // withK ne touche qu'à kMain
  const Q = withK(P, 2.0)
  for (const key of Object.keys(P) as (keyof typeof P)[]) if (key !== 'kMain') assert.equal(Q[key], P[key])
})

test('jeu calme : changer kMain change les chocs, le filtre λ et les entrées impulse', () => {
  const P = calmSet()
  const a = prepare(m, withK(P, 2.0)), b = prepare(m, withK(P, 3.0))
  assert.ok(sum(a.mainShock) > sum(b.mainShock) && sum(b.mainShock) > 0)
  // choc principal = |z| > kMain exactement
  for (let i = 0; i < m.bars.n; i++) assert.equal(a.mainShock[i], Math.abs(a.z[i]) > 2.0 ? 1 : 0)
  // λ est construit sur le même indicateur de choc : il bouge avec k
  assert.equal(same(a.lamPct, b.lamPct), false)
  assert.ok(sum(a.impulseLong) + sum(a.impulseShort) > sum(b.impulseLong) + sum(b.impulseShort))
})

test('micro-chocs en mode High Activity : kMain au-dessus du seuil micro effectif ne change aucune entrée', () => {
  const A = agitatedSet()
  assert.equal(A.useMicroShock, true)
  assert.equal(A.highActivityMode, true)
  const eff = effectiveMicro(A)
  assert.equal(eff, Math.max(A.kMicro - 0.2, 0.8))
  // k égal au seuil micro effectif (aux arrondis près) donne déjà les mêmes chocs
  const above = kGrid().filter(k => k >= eff - 1e-6)
  assert.ok(above.length >= 2)
  const ref = prepare(m, withK(A, above[0]))
  assert.ok(sum(ref.impulseLong) + sum(ref.impulseShort) > 0)
  for (const k of above.slice(1)) {
    const x = prepare(m, withK(A, k))
    assert.ok(same(x.impulseLong, ref.impulseLong) && same(x.impulseShort, ref.impulseShort), `entrées différentes à k = ${k}`)
    assert.ok(same(x.lamPct, ref.lamPct), `λ différent à k = ${k}`)
    assert.equal(shockThreshold(withK(A, k)), eff)
  }
  // seul le choc principal (étiquette IMP / μIMP, sortie sur signal inverse si flipMainOnly) bouge
  const top = prepare(m, withK(A, above[above.length - 1]))
  assert.ok(sum(top.mainShock) < sum(ref.mainShock))
  // sous le seuil micro effectif, kMain redevient actif
  const below = kGrid().filter(k => k < eff - 1e-6)
  if (below.length) assert.equal(same(prepare(m, withK(A, below[0])).impulseLong, ref.impulseLong) && same(prepare(m, withK(A, below[0])).lamPct, ref.lamPct), false)
})

test('sans mode High Activity, le seuil micro effectif est kMicro lui-même', () => {
  const A = { ...agitatedSet(), highActivityMode: false }
  assert.equal(effectiveMicro(A), A.kMicro)
  assert.equal(shockThreshold({ ...A, kMain: A.kMicro + 1 }), A.kMicro)
})

test('mode High Activity : compression coupée et cooldown = max(⌊cooldown / 2⌋, 2)', () => {
  const P = calmSet()
  assert.equal(P.highActivityMode, true)
  const on = prepare(m, { ...P, useCompression: true, compThr: -5 }), off = prepare(m, { ...P, useCompression: false })
  assert.ok(same(on.impulseEntryLong, off.impulseEntryLong) && same(on.impulseEntryShort, off.impulseEntryShort))
  for (const cd of [2, 3, 4, 5, 6, 9]) {
    const s = new ShockStrategy(m, [{ ...P, cooldownBars: cd }], 0.1)
    assert.equal(s.cool[0], Math.max(Math.trunc(cd / 2), 2))
  }
})

test('configurations effectives : des valeurs de k aux entrées identiques comptent une fois', () => {
  const A = agitatedSet()
  const sig = (k: number) => { const R = prepare(m, withK(A, k)); return signature(R.impulseLong, R.impulseShort, R.lamPct.map(x => (x > A.longLamPct ? 1 : 0))) }
  const groups = effectiveConfigs(kGrid(), sig)
  const eff = effectiveMicro(A)
  const inert = kGrid().filter(k => k >= eff - 1e-6)
  const merged = groups.find(g => g.ks.includes(inert[0]))!
  assert.deepEqual(merged.ks, inert)
  assert.ok(groups.length < kGrid().length)
  assert.notEqual(signature(Uint8Array.from([1, 0, 1])), signature(Uint8Array.from([0, 1, 1])))
  assert.equal(signature(Uint8Array.from([1, 0, 1])), signature(Uint8Array.from([1, 0, 1])))
})
