import { test } from 'node:test'
import assert from 'node:assert/strict'
import { equityOf } from '../src/hl/client.ts'

test('capital : compte unifié à plat = USDC spot ; position ouverte = perps ; jamais la somme ; compte standard = perps seul', () => {
  // Compte unifié à plat : collatéral en spot, perps à 0 (cas du compte testnet du bot, octobre 2026).
  assert.equal(equityOf(0, 'unifiedAccount', 1031.11), 1031.11)
  // Position ouverte : Hyperliquid montre le collatéral côté perps (plus-value latente comprise).
  assert.equal(equityOf(1031.05, 'unifiedAccount', 0), 1031.05)
  assert.equal(equityOf(1031.05, 'unifiedAccount', 1009.82), 1031.05)
  assert.equal(equityOf(0, 'portfolioMargin', 500), 500)
  // Compte standard : l'USDC en spot ne sert pas de marge.
  assert.equal(equityOf(100, 'default', 1000), 100)
  assert.equal(equityOf(100, 'disabled', 1000), 100)
})
