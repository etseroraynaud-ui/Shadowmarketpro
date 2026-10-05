// Vérifie la configuration du bot réel sans envoyer aucun ordre : clé de l'agent lisible, agent
// approuvé par le compte principal sur le bon réseau, sous-compte (ou vault) rattaché à ce compte,
// compte tradé lisible (capital, position, ordres ouverts). Code de sortie 0 seulement si tout va.
//
//   BOT_MODE=testnet HL_ACCOUNT_ADDRESS=… HL_AGENT_PRIVATE_KEY=… npm run access-check

import { privateKeyToAccount } from 'viem/accounts'
import { loadConfig } from '../config.ts'
import { HyperliquidData, checkAccess } from '../hl/client.ts'

const cfg = loadConfig()
if (cfg.mode === 'shadow' || !cfg.account || !cfg.agentKey) {
  console.error('BOT_MODE testnet ou mainnet, HL_ACCOUNT_ADDRESS et HL_AGENT_PRIVATE_KEY sont nécessaires.')
  process.exit(2)
}
const testnet = cfg.mode === 'testnet'
const data = new HyperliquidData(testnet)
const agent = privateKeyToAccount(cfg.agentKey).address
console.log(`Réseau           ${cfg.mode}`)
console.log(`Compte principal ${cfg.account}`)
console.log(`Agent            ${agent}`)
try {
  const access = await checkAccess(data.info, cfg.account, cfg.subAccount, agent)
  console.log(`Compte tradé     ${access.traded} (${access.kind}${access.name ? ` « ${access.name} »` : ''})`)
  const [state, orders] = await Promise.all([
    data.info.clearinghouseState({ user: access.traded }),
    data.info.frontendOpenOrders({ user: access.traded }),
  ])
  const positions = state.assetPositions.filter(p => Number(p.position.szi) !== 0).map(p => `${p.position.coin} ${p.position.szi}`)
  console.log(`Capital          ${Number(state.marginSummary.accountValue).toFixed(2)} USDC`)
  console.log(`Positions        ${positions.length ? positions.join(', ') : 'aucune'}`)
  console.log(`Ordres ouverts   ${orders.length}`)
  if (!access.agentListed) {
    console.error(`\nL'agent ${agent} n'est pas approuvé par ${cfg.account} sur le ${cfg.mode} : page API de Hyperliquid (${cfg.mode}), générer ou autoriser le wallet API, puis recommencer.`)
    process.exit(1)
  }
  if (positions.length || orders.length) console.log('\nAttention : le compte tradé doit être à plat et sans ordre ouvert au premier démarrage du bot.')
  console.log('\nConfiguration valide : agent approuvé, compte lisible.')
} catch (e) {
  console.error(`\n${e instanceof Error ? e.message : String(e)}`)
  process.exit(1)
}
