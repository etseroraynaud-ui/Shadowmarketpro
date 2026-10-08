import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PLAN, applyLook, bootP, diff, dueLook, emptyState } from '../lib/e2-forward.ts'
import type { FwdTrade, Look } from '../lib/e2-forward.ts'

const CUT = Date.parse('2027-06-01T00:00:00Z')
const look = (kind: 'interim' | 'final', threshold: number | null, p: number, d = 0.1): Look => ({
  kind, threshold, cutoff: '2027-06-01', n1: 0, n0: 0, d, p, alpha: kind === 'final' ? PLAN.alphaFinal : PLAN.alphaInterim, rejected: p < (kind === 'final' ? PLAN.alphaFinal : PLAN.alphaInterim),
})

test('regards intermédiaires : à 25, 50, 75 shorts E2, un seul par évaluation', () => {
  const s = emptyState()
  assert.equal(dueLook(s, 24, 60, CUT), null)
  assert.deepEqual(dueLook(s, 25, 60, CUT), { kind: 'interim', threshold: 25, alpha: 0.001 })
  // Deux seuils franchis d'un coup : un seul regard, au seuil le plus haut.
  assert.deepEqual(dueLook(s, 57, 60, CUT), { kind: 'interim', threshold: 50, alpha: 0.001 })
  const s1 = applyLook(s, look('interim', 50, 0.2))
  assert.equal(s1.status, 'en cours')
  assert.equal(dueLook(s1, 60, 90, CUT), null)
  assert.equal(dueLook(s1, 75, 90, CUT)?.threshold, 75)
  const s2 = applyLook(s1, look('interim', 75, 0.2))
  assert.equal(dueLook(s2, 99, 150, CUT), null)
})

test('regard final : N1 et N0 ≥ 100, ou coupure de 2031-10', () => {
  const s = emptyState()
  assert.equal(dueLook(s, 100, 99, CUT)?.kind, 'interim')
  assert.deepEqual(dueLook(s, 100, 100, CUT), { kind: 'final', threshold: null, alpha: 0.047 })
  assert.equal(dueLook(s, 10, 30, Date.parse('2031-10-01T00:00:00Z'))?.kind, 'final')
  assert.equal(dueLook(s, 10, 30, Date.parse('2031-09-01T00:00:00Z')), null)
})

test('conclusions : confirmée au premier rejet, non confirmée au final, puis plus aucun test', () => {
  const ok = applyLook(emptyState(), look('interim', 25, 0.0004))
  assert.equal(ok.status, 'H1 confirmée')
  assert.equal(dueLook(ok, 200, 200, CUT), null)
  const no = applyLook(emptyState(), look('final', null, 0.3, -0.2))
  assert.equal(no.status, 'H1 non confirmée')
  assert.equal(no.reverse, true)
  assert.equal(applyLook(emptyState(), look('final', null, 0.03)).status, 'H1 confirmée')
})

const tr = (month: number, e2: 0 | 1, R: number): FwdTrade => ({ asset: 'BTC', entryT: 0, exitT: 0, month, e2, R, net: 0 })

test('D et bootstrap : mêmes mois pour les deux groupes', () => {
  // Chaque mois : E2 = 1 vaut 1 de plus que E2 = 0, quel que soit le niveau du mois → D* = 1 toujours.
  const ts: FwdTrade[] = []
  for (let m = 0; m < 24; m++) { const lvl = (m % 5) - 2; ts.push(tr(m, 1, lvl + 1), tr(m, 0, lvl)) }
  assert.equal(diff(ts).d, 1)
  const b = bootP(ts, Array.from({ length: 24 }, (_, m) => m), 2000, 1)
  assert.equal(b.p, 0)
  assert.equal(b.dropped, 0)
  assert.ok(Math.abs(b.ci90[0] - 1) < 1e-12 && Math.abs(b.ci90[1] - 1) < 1e-12)
})

test('bootstrap : sans écart, p proche de 0,5 ; réplications à groupe vide écartées', () => {
  const ts: FwdTrade[] = []
  for (let m = 0; m < 40; m++) ts.push(tr(m, (m % 2) as 0 | 1, ((m * 7919) % 13) - 6))
  const b = bootP(ts, Array.from({ length: 40 }, (_, m) => m), 4000, 3)
  assert.ok(b.p > 0.2 && b.p < 0.8, `p = ${b.p}`)
  const one = bootP([tr(0, 1, 1), tr(1, 0, 0)], [0, 1], 1000, 5)
  assert.ok(one.dropped > 0 && one.valid + one.dropped === 1000)
  assert.throws(() => bootP([tr(5, 1, 1)], [0, 1], 10, 1))
})
