import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadConfig, publicConfig, tradedAccount } from '../src/config.ts'
import { checkAccess } from '../src/hl/client.ts'
import type { InfoClient } from '@nktkas/hyperliquid'

const MAIN = '0x1111111111111111111111111111111111111111'
const SUB = '0x2222222222222222222222222222222222222222'
const VAULT = '0x3333333333333333333333333333333333333333'
const AGENT = '0x4444444444444444444444444444444444444444'
const KEY = '0x' + 'ab'.repeat(32)

test('sous-compte : tradé à la place du compte principal, clé jamais affichée', () => {
  const c = loadConfig({ BOT_MODE: 'testnet', HL_ACCOUNT_ADDRESS: MAIN, HL_SUBACCOUNT_ADDRESS: SUB, HL_AGENT_PRIVATE_KEY: KEY })
  assert.equal(c.account, MAIN)
  assert.equal(c.subAccount, SUB)
  assert.equal(tradedAccount(c), SUB)
  assert.equal(publicConfig(c).agentKey, '***')
  assert.ok(!JSON.stringify(publicConfig(c)).includes('abab'))
  const plain = loadConfig({ BOT_MODE: 'testnet', HL_ACCOUNT_ADDRESS: MAIN, HL_AGENT_PRIVATE_KEY: KEY })
  assert.equal(tradedAccount(plain), MAIN)
})

test('sous-compte : configurations refusées', () => {
  assert.throws(() => loadConfig({ BOT_MODE: 'testnet', HL_SUBACCOUNT_ADDRESS: SUB, HL_AGENT_PRIVATE_KEY: KEY }), /HL_ACCOUNT_ADDRESS/)
  assert.throws(() => loadConfig({ HL_ACCOUNT_ADDRESS: MAIN, HL_SUBACCOUNT_ADDRESS: MAIN.toUpperCase().replace('0X', '0x') }), /compte principal/)
  assert.throws(() => loadConfig({ HL_ACCOUNT_ADDRESS: MAIN, HL_SUBACCOUNT_ADDRESS: '0x123' }), /format invalide/)
})

function fakeInfo(subs: string[], vaults: string[], agents: string[]): InfoClient {
  return {
    extraAgents: async () => agents.map(address => ({ address, name: 'bot', validUntil: null })),
    subAccounts: async () => (subs.length ? subs.map(subAccountUser => ({ name: 'shock-engine', subAccountUser, master: MAIN })) : null),
    leadingVaults: async () => vaults.map(address => ({ address, name: 'Shock Engine' })),
  } as unknown as InfoClient
}

test('accès : le sous-compte ou vault doit appartenir au compte principal', async () => {
  const sub = await checkAccess(fakeInfo([SUB.toUpperCase().replace('0X', '0x')], [], [AGENT]), MAIN, SUB, AGENT)
  assert.deepEqual([sub.kind, sub.traded, sub.name, sub.agentListed], ['sous-compte', SUB, 'shock-engine', true])
  const vault = await checkAccess(fakeInfo([], [VAULT], []), MAIN, VAULT, AGENT)
  assert.deepEqual([vault.kind, vault.agentListed], ['vault', false])
  const main = await checkAccess(fakeInfo([], [], [AGENT]), MAIN, null, AGENT)
  assert.deepEqual([main.kind, main.traded], ['compte principal', MAIN])
  await assert.rejects(checkAccess(fakeInfo([VAULT], [], [AGENT]), MAIN, SUB, AGENT), /ni un sous-compte ni un vault/)
})
