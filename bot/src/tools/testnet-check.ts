// Contrôle du testnet Hyperliquid, réseau testnet uniquement (aucune clé mainnet possible ici) :
//
// 1. métadonnées de BTC, carnet, horloge ;
// 2. lecture de compte (position, ordres ouverts, fills) sur un compte testnet actif pris dans les
//    dernières transactions publiques : vérifie la lecture des vraies réponses de l'API ;
// 3. chemin de signature : un ordre signé par une clé jetable (générée à la volée, jamais gardée)
//    doit être refusé explicitement par l'exchange (wallet inconnu) — classé comme refus certain,
//    pas comme issue incertaine ;
// 4. avec HL_ACCOUNT_ADDRESS et HL_AGENT_PRIVATE_KEY (wallet agent du testnet), et
//    HL_SUBACCOUNT_ADDRESS s'il y a un sous-compte : ordre limite loin
//    du marché avec un cloid du bot, retrouvé par son cloid, annulé ; avec --trade en plus, aller-
//    retour de la taille minimale : entrée au marché, stop posé puis déplacé (pose puis annulation),
//    fermeture, fills reconnus par cloid, compte à plat à la fin.
//
//   npm run testnet-check [-- --trade]

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { HyperliquidData, HyperliquidExchange } from '../hl/client.ts'
import { newCloid, cloidKind } from '../exec/exchange.ts'
import { midOf, spreadBps } from '../data/quotes.ts'
import { MIN_NOTIONAL_USD } from '../engine/risk.ts'

const COIN = 'BTC'
const trade = process.argv.includes('--trade')
const results: [string, boolean, string][] = []
const check = (name: string, ok: boolean, detail = '') => { results.push([name, ok, detail]); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`) }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

const data = new HyperliquidData(true)
const asset = await data.assetInfo(COIN)
check('métadonnées BTC testnet', asset.index >= 0 && asset.szDecimals >= 0 && asset.tick > 0, JSON.stringify(asset))
const book = await data.book(COIN)
check('carnet testnet', book.ask >= book.bid && book.bid > 0, `${book.bid} / ${book.ask}, ${spreadBps(book).toFixed(2)} pb, horloge locale - exchange ${book.recv - book.time} ms`)

// 2. Compte testnet actif (adresse publique d'une transaction récente), en lecture seule.
const recent = await data.info.recentTrades({ coin: COIN })
const users = [...new Set(recent.flatMap(t => t.users))]
let read = false
for (const u of users.slice(0, 6)) {
  const ex = Object.create(HyperliquidExchange.prototype) as HyperliquidExchange
  Object.assign(ex, { data, user: u, coin: COIN, asset })
  const [acct, orders, fills] = await Promise.all([ex.account(), ex.openOrders(), ex.fills(Date.now() - 86400000)])
  const finite = Number.isFinite(acct.equity) && Number.isFinite(acct.position.size) && fills.every(f => Number.isFinite(f.px) && Number.isFinite(f.sz) && Number.isSafeInteger(f.tid))
  if (!fills.length && !orders.length && !acct.position.size) continue
  check('lecture position / ordres / fills d\'un compte testnet', finite, `${u.slice(0, 8)}… position ${acct.position.size} @ ${acct.position.entryPx}, ${orders.length} ordre(s) ouvert(s), ${fills.length} fill(s) sur 24 h, cloid du dernier fill : ${fills[fills.length - 1]?.cloid ?? 'aucun'}`)
  read = true
  break
}
if (!read) check('lecture d\'un compte testnet', false, 'aucun compte actif trouvé dans les dernières transactions')

// 3. Signature : clé jetable, inconnue de l'exchange.
{
  const key = generatePrivateKey()
  const { exchange: ex } = await HyperliquidExchange.connect({ testnet: true, coin: COIN, account: privateKeyToAccount(key).address, subAccount: null, agentKey: key })
  const r = await ex.limit('buy', Math.max(10 ** -asset.szDecimals, +(20 / (book.bid * 0.5)).toFixed(asset.szDecimals)), Math.round(book.bid * 0.5), false, newCloid('entry'))
  check('ordre signé par un wallet inconnu : refus explicite du testnet (pas d\'issue incertaine)', r.status === 'error' && !r.uncertain, r.error?.slice(0, 160) ?? '')
}

// 4. Compte du bot.
const account = process.env.HL_ACCOUNT_ADDRESS as `0x${string}` | undefined
const subAccount = (process.env.HL_SUBACCOUNT_ADDRESS?.trim() || null) as `0x${string}` | null
const agentKey = process.env.HL_AGENT_PRIVATE_KEY as `0x${string}` | undefined
if (!account || !agentKey) {
  console.log('\nHL_ACCOUNT_ADDRESS et HL_AGENT_PRIVATE_KEY absents : ordres testnet du bot non testés.')
} else {
  const { exchange: ex, access } = await HyperliquidExchange.connect({ testnet: true, coin: COIN, account, subAccount, agentKey })
  check('agent approuvé sur le compte testnet', access.agentListed, `agent ${access.agent}, compte tradé ${access.traded} (${access.kind}${access.name ? ` « ${access.name} »` : ''})`)
  const acct = await ex.account()
  const before = await ex.openOrders()
  check('compte testnet du bot lu', Number.isFinite(acct.equity), `capital ${acct.equity} USDC, position ${acct.position.size}, ${before.length} ordre(s) ouvert(s)`)
  // Ordre limite à 50 % sous le marché : posé, retrouvé par son cloid, annulé.
  const q = await ex.quote()
  const px = Math.round(midOf(q) * 0.5)
  const sz = +Math.max((MIN_NOTIONAL_USD * 1.5) / px, 10 ** -asset.szDecimals).toFixed(asset.szDecimals)
  const cloid = newCloid('entry')
  const r = await ex.limit('buy', sz, px, false, cloid)
  check('ordre limite posé', r.status === 'resting' && r.oid != null, JSON.stringify(r))
  const st = await ex.orderStatus(cloid)
  check('ordre retrouvé par son cloid', st.status === 'open' && st.oid === r.oid, JSON.stringify(st))
  const open = await ex.openOrders()
  check('ordre listé avec son cloid', open.some(o => o.oid === r.oid && o.cloid === cloid && cloidKind(o.cloid) === 'entry'))
  const c = await ex.cancel([r.oid!])
  check('ordre annulé', c[0]?.ok === true, JSON.stringify(c))
  const again = await ex.cancel([r.oid!])
  check('seconde annulation : refus sans exception', again[0]?.ok === false, again[0]?.error ?? '')
  check('statut après annulation', (await ex.orderStatus(cloid)).status === 'canceled')
  check('cloid jamais envoyé : inconnu', (await ex.orderStatus(newCloid('entry'))).status === 'unknown')

  if (trade) {
    if (acct.position.size !== 0) throw new Error('compte testnet pas à plat : aller-retour refusé')
    const t0 = Date.now()
    const q1 = await ex.quote()
    const size = +Math.ceil(((MIN_NOTIONAL_USD * 1.2) / q1.ask) * 10 ** asset.szDecimals) / 10 ** asset.szDecimals
    const ec = newCloid('entry')
    const e = await ex.market('buy', size, false, q1.ask, 1, ec)
    check('entrée au marché', e.status === 'filled' && e.filledSz > 0, JSON.stringify(e))
    const s1c = newCloid('stop')
    const s1 = await ex.stop('sell', e.filledSz, Math.round(q1.bid * 0.95), 5, s1c)
    check('stop posé', s1.status === 'resting' && s1.oid != null, JSON.stringify(s1))
    // Déplacement : nouveau stop posé, puis ancien annulé.
    const s2c = newCloid('stop')
    const s2 = await ex.stop('sell', e.filledSz, Math.round(q1.bid * 0.96), 5, s2c)
    const c1 = await ex.cancel([s1.oid!])
    const stops = (await ex.openOrders()).filter(o => cloidKind(o.cloid) === 'stop')
    check('stop déplacé : un seul stop posé', s2.status === 'resting' && c1[0]?.ok === true && stops.length === 1 && stops[0].oid === s2.oid, `${stops.length} stop(s)`)
    const q2 = await ex.quote()
    const xc = newCloid('close')
    const x = await ex.market('sell', e.filledSz, true, q2.bid, 1, xc)
    check('fermeture au marché (réduction seule)', x.status === 'filled' && Math.abs(x.filledSz - e.filledSz) < 1e-9, JSON.stringify(x))
    await ex.cancel([s2.oid!])
    await sleep(1500)
    const fills = await ex.fills(t0 - 60000)
    check('fills reconnus par cloid', fills.some(f => f.cloid === ec) && fills.some(f => f.cloid === xc), fills.map(f => `${f.side} ${f.sz} @ ${f.px} ${cloidKind(f.cloid)}`).join(', '))
    const end = await ex.account()
    check('compte à plat, aucun ordre restant', end.position.size === 0 && (await ex.openOrders()).length === before.length, `position ${end.position.size}`)
  }
}

const failed = results.filter(r => !r[1])
console.log(`\n${results.length - failed.length}/${results.length} contrôles OK`)
process.exit(failed.length ? 1 : 0)
