// Exchange papier du shadow mode : exécution au BBO réel, stops, limites, réduction seule,
// annulations et statut par cloid.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PaperExchange } from '../src/exec/paper.ts'
import { newCloid } from '../src/exec/exchange.ts'
import type { Quote } from '../src/data/quotes.ts'

const asset = { index: 0, szDecimals: 5, maxLeverage: 40, tick: 1 }
let t = 1000
const q = (bid: number, ask: number): Quote => ({ bid, ask, bidSz: 5, askSz: 5, time: ++t, recv: t, source: 'ws' })

function paper() {
  const fills: number[] = []
  const ex = new PaperExchange({ asset, capital: 10000, takerFeePct: 0.045, makerFeePct: 0.015, fallbackQuote: async () => q(100, 101), now: () => t, onFill: f => fills.push(f.oid) })
  return { ex, fills }
}

test('ordre au marché : achat au vendeur, vente à l\'acheteur ; refusé au-delà de l\'écart maximal', async () => {
  const { ex } = paper()
  ex.onQuote(q(60000, 60001))
  const buy = await ex.market('buy', 0.01, false, 60001, 0.5, newCloid('entry'))
  assert.deepEqual([buy.status, buy.avgPx, buy.filledSz], ['filled', 60001, 0.01])
  assert.equal(ex.pos.size, 0.01)
  const fee = 60001 * 0.01 * 0.00045
  assert.ok(Math.abs(ex.cash - (10000 - fee)) < 1e-9)
  // Le marché s'est éloigné de la référence de plus de 0,5 % : l'IOC ne s'exécute pas.
  ex.onQuote(q(59000, 59001))
  const sell = await ex.market('sell', 0.01, true, 60000, 0.5, newCloid('close'))
  assert.equal(sell.status, 'error')
  assert.equal(ex.pos.size, 0.01)
})

test('stop : déclenché quand le prix moyen franchit le niveau, exécuté à l\'acheteur ; réduction seule', async () => {
  const { ex, fills } = paper()
  ex.onQuote(q(60000, 60001))
  await ex.market('buy', 0.02, false, 60001, 0.5, newCloid('entry'))
  const c = newCloid('stop')
  const s = await ex.stop('sell', 0.02, 59500, 5, c)
  assert.equal(s.status, 'resting')
  assert.equal((await ex.orderStatus(c)).status, 'open')
  ex.onQuote(q(59600, 59601))
  assert.equal(ex.pos.size, 0.02)
  ex.onQuote(q(59490, 59492)) // milieu 59491 ≤ 59500
  assert.equal(ex.pos.size, 0)
  assert.equal(ex.log[ex.log.length - 1].px, 59490)
  assert.equal((await ex.orderStatus(c)).status, 'filled')
  assert.deepEqual(fills, [s.oid])
  // Un second stop (doublon) sur une position déjà fermée ne peut rien ouvrir.
  const c2 = newCloid('stop')
  await ex.stop('sell', 0.02, 59400, 5, c2)
  ex.onQuote(q(59000, 59001))
  assert.equal(ex.pos.size, 0)
  assert.equal((await ex.orderStatus(c2)).status, 'canceled')
})

test('limite posée (TP1) : exécutée à son prix quand l\'acheteur l\'atteint, frais maker ; limite qui croise : tout de suite', async () => {
  const { ex } = paper()
  ex.onQuote(q(60000, 60001))
  await ex.market('buy', 0.02, false, 60001, 0.5, newCloid('entry'))
  const cash = ex.cash
  const r = await ex.limit('sell', 0.01, 60500, true, newCloid('tp1'))
  assert.equal(r.status, 'resting')
  ex.onQuote(q(60499, 60500))
  assert.equal(ex.pos.size, 0.02)
  ex.onQuote(q(60500, 60501))
  assert.equal(ex.pos.size, 0.01)
  const f = ex.log[ex.log.length - 1]
  assert.equal(f.px, 60500)
  assert.ok(Math.abs(f.fee - 60500 * 0.01 * 0.00015) < 1e-9)
  assert.ok(Math.abs(ex.cash - (cash + (60500 - 60001) * 0.01 - f.fee)) < 1e-9)
  const x = await ex.limit('sell', 0.005, 60000, true, newCloid('tp1'))
  assert.deepEqual([x.status, x.avgPx], ['filled', 60500])
})

test('annulation : résultat par ordre, jamais d\'exception ; statut inconnu pour un cloid jamais envoyé', async () => {
  const { ex } = paper()
  ex.onQuote(q(60000, 60001))
  await ex.market('buy', 0.01, false, 60001, 0.5, newCloid('entry'))
  const s = await ex.stop('sell', 0.01, 59000, 5, newCloid('stop'))
  const res = await ex.cancel([s.oid!, 424242])
  assert.deepEqual(res.map(r => r.ok), [true, false])
  assert.equal((await ex.openOrders()).length, 0)
  assert.equal((await ex.orderStatus(newCloid('entry'))).status, 'unknown')
})

test('BBO trop ancien : relu par REST avant un ordre', async () => {
  const { ex } = paper()
  ex.onQuote(q(60000, 60001))
  t += 10000
  const r = await ex.market('buy', 0.01, false, 101, 1, newCloid('entry'))
  assert.equal(r.avgPx, 101) // carnet de secours : 100 / 101
})
