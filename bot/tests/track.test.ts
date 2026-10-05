import { test } from 'node:test'
import assert from 'node:assert/strict'
import { performance, roundTrips, valueAt } from '../../lib/hyperliquid/track.ts'
import type { PublicFill } from '../../lib/hyperliquid/track.ts'
import { newCloid } from '../../lib/hyperliquid/cloid.ts'

let tid = 1
function fill(time: number, side: 'buy' | 'sell', sz: number, px: number, startPosition: number, extra: Partial<PublicFill> = {}): PublicFill {
  return { time, coin: 'BTC', px, sz, side, fee: px * sz * 0.0005, closedPnl: 0, startPosition, tid: tid++, oid: tid, cloid: null, liquidation: false, ...extra }
}

test('trades reconstitués : entrée en deux fois, TP1, retournement, position ouverte', () => {
  const fills = [
    // Position ouverte avant la fenêtre : ignorée.
    fill(50, 'sell', 1, 90, 1),
    fill(100, 'buy', 1, 100, 0, { cloid: newCloid('entry') }),
    fill(101, 'buy', 1, 102, 1, { cloid: newCloid('entry') }),
    fill(200, 'sell', 1, 110, 2, { cloid: newCloid('tp1'), closedPnl: 9 }),
    // Retournement : ferme 1 et ouvre un short de 2 dans le même fill.
    fill(300, 'sell', 3, 105, 1, { cloid: newCloid('close'), closedPnl: 4 }),
  ]
  const { trips, skipped } = roundTrips(fills, [{ time: 150, coin: 'BTC', usdc: -0.5 }, { time: 400, coin: 'BTC', usdc: 0.2 }])
  assert.equal(skipped, 1)
  assert.equal(trips.length, 2)
  const [a, b] = trips
  assert.deepEqual([a.dir, a.entryTime, a.entryPx, a.qty, a.exitTime, a.exitPx, a.exits, a.bot], [1, 100, 101, 2, 300, 107.5, ['tp1', 'close'], true])
  assert.equal(a.funding, -0.5)
  // Frais : les deux entrées, le TP1, et un tiers du fill de retournement.
  const fees = (100 + 102 + 110) * 0.0005 + 105 * 3 * 0.0005 / 3
  assert.ok(Math.abs(a.fees - fees) < 1e-12)
  assert.ok(Math.abs(a.pnl - (13 - fees - 0.5)) < 1e-12)
  assert.deepEqual([b.dir, b.entryTime, b.entryPx, b.qty, b.exitTime, b.exitPx, b.funding], [-1, 300, 105, 2, null, null, 0.2])
})

test('performance : chaque trade rapporté à la valeur du compte à son entrée', () => {
  const t = (entryTime: number, exitTime: number, pnl: number) => ({
    dir: 1 as const, entryTime, entryPx: 100, qty: 1, exitTime, exitPx: 100, exitQty: 1, fees: 0, funding: 0, closedPnl: pnl, pnl, pnlPct: pnl / 100, exits: [], bot: true, fills: 2,
  })
  // Compte de 1000 $, puis dépôt de 1000 $ avant le deuxième trade.
  const av: [number, number][] = [[0, 1000], [150, 1100], [160, 2100]]
  assert.equal(valueAt(av, 155), 1100)
  assert.equal(valueAt(av, -5), 1000)
  const p = performance([t(100, 140, 100), t(200, 240, -210)], av, 0)
  // +10 %, puis −10 % : le dépôt ne compte pas comme un gain.
  assert.ok(Math.abs(p.twr - (1.1 * 0.9 - 1)) < 1e-12)
  assert.ok(Math.abs(p.maxDrawdown + 0.1) < 1e-12)
  assert.equal(p.trades, 2)
  assert.equal(p.wins, 1)
  assert.ok(Math.abs(p.profitFactor - 100 / 210) < 1e-12)
})
