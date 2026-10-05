// Bougies Hyperliquid pour la recherche : 15 min (les 5000 dernières, limite de l'API) et
// journalier (tout l'historique disponible), complétées à chaque lancement (le cache ne fait que
// s'allonger). Mêmes fichiers et même code que le cache du bot.
//
//   node research/data/fetch-hyperliquid.ts [BTC ETH xyz:NVDA ...]
//   (derrière un proxy : NODE_USE_ENV_PROXY=1)

import { CandleFeed } from '../../bot/src/data/candles.ts'
import { HyperliquidData } from '../../bot/src/hl/client.ts'

const coins = process.argv.slice(2).length ? process.argv.slice(2) : ['BTC', 'ETH', 'xyz:NVDA']
const data = new HyperliquidData(false)
const dir = new URL('./hyperliquid', import.meta.url).pathname
for (const coin of coins) {
  const feed = new CandleFeed(data, coin, dir)
  const { added } = await feed.sync(Date.now())
  const c = feed.chart.all
  const d = feed.daily.all
  const day = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ')
  console.log(`${coin.padEnd(9)} 15 min : ${c.length} bougies (${added.length} nouvelles), ${day(c[0].t)} → ${day(c[c.length - 1].t)} · journalier : ${d.length} jours depuis ${day(d[0].t).slice(0, 10)}`)
}
