import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as P from '../lib/portfolio.ts'

const close = (a: number, b: number, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`)

test('sleeves indépendantes : chaque sleeve compose son propre capital, total = somme', () => {
  const rA = [0.1, -0.05, 0.2, 0], rB = [-0.1, 0.3, 0, 0.05]
  const b = P.book(rA, rB)
  let a = 50, c = 50
  for (let k = 0; k < rA.length; k++) {
    a *= 1 + rA[k]; c *= 1 + rB[k]
    close(b.vA[k], a); close(b.vB[k], c); close(b.v[k], a + c)
  }
  // Rendement du portefeuille = moyenne des rendements pondérée par les poids de la veille, pas leur somme.
  close(b.r[1], (b.vA[0] / b.v[0]) * rA[1] + (b.vB[0] / b.v[0]) * rB[1])
  close(P.compound(b.r, 100)[3], b.v[3])
})

test('rebalancement : retour aux poids cibles, commission sur la part investie seulement', () => {
  const rA = [0.2, 0], rB = [0, 0]
  const b = P.book(rA, rB, { rebalance: [true, false], target: () => 0.5, xA: [1, 1], xB: [0, 0], comm: 0.001 })
  // Jour 0 : A = 60, B = 50 ; transfert de 5 de A vers B ; A est investi (5 × 0,1 % de coût), B ne l'est pas.
  close(b.vA[0], 55 - 0.005)
  close(b.vB[0], 55)
  close(b.cost, 0.005)
  assert.equal(b.rebalances, 1)
})

test('risque égal : poids causal, 50/50 avant la fenêtre complète', () => {
  const rA = Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.02 : -0.02)), rB = Array.from({ length: 10 }, (_, i) => (i % 2 ? 0.01 : -0.01))
  const t = P.equalRiskTarget(rA, rB, 4)
  assert.equal(t(2), 0.5)
  close(t(5), 1 / 3)
  // Changer les rendements après le jour k ne change pas le poids décidé au jour k.
  const rA2 = [...rA.slice(0, 6), 0.5, -0.5, 0.5, -0.5]
  close(P.equalRiskTarget(rA2, rB, 4)(5), t(5))
})

test('clôtures journalières : dernière barre du jour, jour sans barre reporté et compté', () => {
  const D = P.DAY
  const t = Float64Array.from([0, 0.5 * D, D - 900000, 2 * D + 1000])
  const eq = Float64Array.from([101, 102, 103, 104])
  const { eq: out, missing } = P.dayCloses(t, eq, 0, 3, [0, 1, 2], 100)
  assert.deepEqual(out, [103, 103, 104])
  assert.equal(missing, 1)
})

test('épisodes de baisse : sommet, creux, retour, profondeur', () => {
  const eq = [100, 110, 99, 88, 105, 111, 100]
  const e = P.episodes(eq, 100)
  assert.equal(e.length, 2)
  assert.deepEqual([e[0].peak, e[0].trough, e[0].recovery], [1, 3, 5])
  close(e[0].depth, 88 / 110 - 1)
  assert.equal(e[1].recovery, null)
  close(P.maxDrawdown(eq, 100), 88 / 110 - 1)
})

test('corrélations : Pearson et Spearman (rangs moyens pour les ex aequo)', () => {
  close(P.pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1)
  close(P.pearson([1, 2, 3, 4], [8, 6, 4, 2]), -1)
  assert.deepEqual(Array.from(P.ranks([0, 0, 1, -1])), [2.5, 2.5, 4, 1])
  close(P.spearman([1, 2, 3, 4], [1, 8, 27, 64]), 1)
})

test('contributions au risque : la somme des composantes vaut la volatilité du portefeuille', () => {
  const g = P.gauss(P.rng(1))
  const a: number[] = [], b: number[] = []
  for (let i = 0; i < 2000; i++) { const z = g(); a.push(0.01 * z + 0.01 * g()); b.push(0.02 * z + 0.005 * g()) }
  const r = P.riskContrib(a, b, [0.5, 0.5])
  close(r.crc[0] + r.crc[1], r.sigmaP, 1e-12)
  close(r.pct[0] + r.pct[1], 1, 1e-12)
  assert.ok(r.dr >= 1 && r.dr <= Math.SQRT2 + 1e-9)
  const p = a.map((x, i) => 0.5 * x + 0.5 * b[i])
  close(r.sigmaP, P.sd(p) * Math.sqrt(P.ANN), 1e-12)
})

test('bootstrap : les mêmes mois sont tirés pour les deux sleeves', () => {
  // Deux séries identiques : si les mois étaient tirés séparément, les Sharpe différeraient.
  const days = Array.from({ length: 400 }, (_, i) => 17000 + i)
  const g = P.gauss(P.rng(3))
  const r = days.map(() => 0.01 * g() + 0.001)
  const bs = P.blockBootstrap(r, r, days, 50, 7)
  for (let i = 0; i < 50; i++) { close(bs.sharpeA[i], bs.sharpeB[i]); close(bs.sharpeP[i], bs.sharpeA[i], 1e-9) }
})

test('recouvrement des entrées : fenêtre et sens', () => {
  const xs = [{ t: 0, dir: 1 }, { t: 10, dir: -1 }, { t: 100, dir: 1 }]
  const ys = [{ t: 5, dir: 1 }, { t: 12, dir: 1 }, { t: 160, dir: 1 }]
  close(P.matchShare(xs, ys, 5), 1 / 3)
  close(P.matchShare(xs, ys, 60), 2 / 3)
})
