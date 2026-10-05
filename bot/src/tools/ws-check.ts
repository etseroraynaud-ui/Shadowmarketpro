// Contrôle des reconnexions WebSocket sur le vrai Hyperliquid (données publiques, aucune clé) :
// abonnements bougie 15 min et BBO, coupure forcée, puis vérification que la connexion revient,
// que les abonnements sont refaits et que les messages reprennent.
//
//   npm run ws-check -- [--network mainnet|testnet] [--cuts 2] [--coin BTC]

import { HyperliquidData, HyperliquidStream } from '../hl/client.ts'
import type { StreamEvent } from '../hl/client.ts'
import { spreadBps } from '../data/quotes.ts'

const args = process.argv.slice(2)
const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
const network = opt('network', 'mainnet')
const cuts = Number(opt('cuts', '2'))
const coin = opt('coin', 'BTC')
const testnet = network === 'testnet'

const events: (StreamEvent & { at: number })[] = []
const stream = new HyperliquidStream(testnet, e => { events.push({ ...e, at: Date.now() }); console.log(new Date().toISOString(), 'ws', JSON.stringify(e)) })
const count = { bbo: 0, candle: 0 }
let lastBbo: { bid: number; ask: number } | null = null
await stream.onCandle(coin, () => { count.candle++ })
await stream.onBbo(coin, q => { count.bbo++; lastBbo = q; void spreadBps })
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const waitFor = async (f: () => boolean, ms: number) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await sleep(100); return f() }

// BTC testnet : peu d'activité, le BBO et la bougie peuvent se taire longtemps ; une requête REST
// sur la même connexion prouve alors qu'elle répond.
const quiet = testnet ? 60000 : 15000
const ok: string[] = []
const bad: string[] = []
await waitFor(() => count.bbo + count.candle > 0, quiet)
console.log(`${network} : ${count.bbo} BBO, ${count.candle} bougies avant coupure ; BBO ${JSON.stringify(lastBbo)}`)
for (let k = 1; k <= cuts; k++) {
  const opensBefore = stream.opens
  const msgsBefore = count.bbo + count.candle
  const t0 = Date.now()
  stream.reconnect()
  const back = await waitFor(() => stream.opens > opensBefore, 20000)
  const ms = Date.now() - t0
  // Messages après la reconnexion : preuve que le SDK s'est réabonné.
  const resumed = await waitFor(() => count.bbo + count.candle > msgsBefore, quiet)
  const line = `coupure ${k} : reconnecté ${back ? `en ${ms} ms` : 'NON'} ; messages après : ${resumed ? count.bbo + count.candle - msgsBefore : 'AUCUN'}`
  console.log(line)
  if (back && resumed) ok.push(line)
  else if (back && testnet) {
    // Marché calme : on vérifie la connexion avec une requête sur le WebSocket.
    const r = await stream.transport.request('info', { type: 'l2Book', coin }).then(() => true, () => false)
    ;(r ? ok : bad).push(`${line} ; requête sur le WebSocket : ${r ? 'OK' : 'ÉCHEC'}`)
  } else bad.push(line)
}
const rest = await new HyperliquidData(testnet).book(coin)
console.log(`REST l2Book ${coin} : ${rest.bid} / ${rest.ask} (${spreadBps(rest).toFixed(3)} pb)`)
await stream.close()
console.log(bad.length ? `RECONNEXIONS : ÉCHEC\n${bad.join('\n')}` : `RECONNEXIONS : OK (${ok.length}/${cuts})`)
process.exit(bad.length ? 1 : 0)
