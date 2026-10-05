// Boucle du bot sans réseau : signaux de clôture en double, reconnexions, rattrapage REST,
// comparaison WebSocket / REST, bougie pas encore confirmée ; configuration (garde mainnet).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CandleFeed } from '../src/data/candles.ts'
import { QuoteBook } from '../src/data/quotes.ts'
import { BotLoop, coalesce } from '../src/runtime.ts'
import { Journal } from '../src/journal.ts'
import { loadConfig } from '../src/config.ts'
import { FakeCandleApi, series, M15, DAY } from './fakes.ts'

const T0 = Date.UTC(2026, 0, 1)

function harness() {
  const daily = series(T0 - 900 * DAY, 905, DAY, 7)
  const chart = series(T0, 600, M15, 3)
  const api = new FakeCandleApi([], daily)
  const dir = mkdtempSync(join(tmpdir(), 'bot-loop-'))
  const feed = new CandleFeed(api, 'BTC', dir)
  const journal = new Journal(join(dir, 'logs'), 'shadow', true)
  const clock = { t: 0 }
  const seen: number[] = []
  let syncs = 0
  const engine = {
    onBar: async (b: { t: number }) => {
      await new Promise(r => setTimeout(r, 2)) // lecture lente : laisse les signaux se chevaucher
      seen.push(b.t)
    },
    syncFills: async () => { syncs++ },
  }
  const loop = new BotLoop({ feed, engine, journal, now: () => clock.t, sleep: async () => {}, settleMs: 0, retryMs: 5 })
  /** L'exchange connaît les bougies jusqu'à la k-ième (en cours), l'horloge est juste après son ouverture. */
  const at = (k: number, afterOpenMs = 3000) => {
    api.data['15m'] = chart.slice(0, k + 1)
    clock.t = chart[k].t + afterOpenMs
  }
  const ev = () => readdirSync(join(dir, 'logs')).filter(f => f.startsWith('events-')).flatMap(f => readFileSync(join(dir, 'logs', f), 'utf8').trim().split('\n')).map(l => JSON.parse(l))
  return { chart, api, feed, loop, seen, clock, at, ev, syncs: () => syncs }
}

test('clôture signalée deux fois (WebSocket et horloge) puis reconnexion : chaque bougie passe une seule fois, dans l\'ordre', async () => {
  const h = harness()
  h.at(100)
  await h.loop.tick('start')
  const base = h.seen.length
  assert.equal(h.seen[base - 1], h.chart[99].t)
  h.at(101)
  // Trois demandes en même temps : horloge de secours, WebSocket, reconnexion.
  const p = [h.loop.tick('clock'), h.loop.tick('ws_close')]
  h.loop.onStream({ type: 'open', count: 2, reconnect: true })
  await Promise.all(p)
  await new Promise(r => setTimeout(r, 30))
  assert.deepEqual(h.seen.slice(base), [h.chart[100].t])
  for (let i = 1; i < h.seen.length; i++) assert.ok(h.seen[i] > h.seen[i - 1])
  assert.equal(h.syncs(), 1, 'fills relus après la reconnexion')
})

test('coupure de 45 minutes : à la reconnexion, les bougies manquées sont rattrapées par REST, dans l\'ordre', async () => {
  const h = harness()
  h.at(200)
  await h.loop.tick('start')
  const before = h.seen.length
  h.at(203) // trois bougies closes pendant la coupure
  h.loop.onStream({ type: 'close', code: 1006, reason: '' })
  h.loop.onStream({ type: 'open', count: 2, reconnect: true })
  await new Promise(r => setTimeout(r, 50))
  assert.deepEqual(h.seen.slice(before), [h.chart[200].t, h.chart[201].t, h.chart[202].t])
  const types = h.ev().map(e => e.type)
  assert.ok(types.includes('ws_closed') && types.includes('ws_reconnected'))
  assert.equal(h.loop.stats.reconnects, 1)
})

test('bougie close du WebSocket comparée à celle de l\'API REST', async () => {
  const h = harness()
  h.at(300)
  await h.loop.tick('start')
  const b = h.chart[300]
  // Mises à jour de la bougie 300 par le WebSocket, la dernière identique à la bougie close REST.
  h.loop.onCandle({ ...b, c: b.o, n: 1 })
  h.loop.onCandle({ ...b, n: 10 })
  h.at(301)
  await h.loop.tick('clock')
  const b301 = h.chart[301]
  h.loop.onCandle({ ...b301, v: b301.v - 0.1, n: 5 }) // dernier état WS différent (volume)
  h.at(302)
  await h.loop.tick('clock')
  const mb = h.ev().filter(e => e.type === 'market_bar')
  const last2 = mb.slice(-2)
  assert.deepEqual(last2[0].ws, { same: true })
  assert.equal(last2[1].ws.same, false)
  assert.deepEqual(Object.keys(last2[1].ws.diff), ['v'])
  assert.equal(h.loop.stats.wsSame, 1)
  assert.equal(h.loop.stats.wsDiff, 1)
})

test('bougie close pas encore confirmée par l\'exchange : relue quelques secondes plus tard', async () => {
  const h = harness()
  h.at(400)
  await h.loop.tick('start')
  const before = h.seen.length
  // Horloge 3 s après la clôture de la 400, mais l'exchange n'a pas encore ouvert la 401.
  h.api.data['15m'] = h.chart.slice(0, 401)
  h.clock.t = h.chart[401].t + 3000
  await h.loop.tick('clock')
  assert.equal(h.seen.length, before, 'bougie 400 pas encore lue')
  // La 401 s'ouvre : la relecture programmée lit la 400.
  h.api.data['15m'] = h.chart.slice(0, 402)
  await new Promise(r => setTimeout(r, 40))
  assert.deepEqual(h.seen.slice(before), [h.chart[400].t])
  h.loop.stop()
})

test('BBO : carnet croisé ou message plus ancien ignoré, spread par bougie', () => {
  const q = new QuoteBook()
  const mk = (bid: number, ask: number, time: number) => ({ bid, ask, bidSz: 1, askSz: 1, time, recv: time, source: 'ws' as const })
  assert.equal(q.update(mk(100, 100.1, 1)), true)
  assert.equal(q.update(mk(100.2, 100.1, 2)), false) // croisé
  assert.equal(q.update(mk(100, 100.2, 0)), false) // plus ancien
  assert.equal(q.update(mk(100, 100.3, 3)), true)
  const s = q.roll()
  assert.equal(s.updates, 2)
  assert.ok(Math.abs(s.minBps! - 9.995) < 0.01 && Math.abs(s.maxBps! - 29.955) < 0.01)
  assert.equal(q.roll().updates, 0)
  assert.equal(q.fresh(3 + 1000, 2000)?.ask, 100.3)
  assert.equal(q.fresh(3 + 5000, 2000), null)
})

test('appels coalescés : seul le dernier prix reçu pendant un calcul est joué ensuite', async () => {
  const done: number[] = []
  const f = coalesce(async (x: number) => { await new Promise(r => setTimeout(r, 5)); done.push(x) }, () => undefined)
  for (let k = 1; k <= 5; k++) f(k)
  await new Promise(r => setTimeout(r, 40))
  assert.deepEqual(done, [1, 5])
})

test('configuration : mainnet refusé sans BOT_ALLOW_MAINNET=1, aucune clé lue en shadow', () => {
  const key = { HL_ACCOUNT_ADDRESS: '0x' + '1'.repeat(40), HL_AGENT_PRIVATE_KEY: '0x' + '2'.repeat(64) }
  assert.throws(() => loadConfig({ BOT_MODE: 'mainnet', ...key }), /BOT_ALLOW_MAINNET/)
  assert.throws(() => loadConfig({ BOT_MODE: 'mainnet', BOT_ALLOW_MAINNET: 'yes', ...key }), /BOT_ALLOW_MAINNET/)
  assert.equal(loadConfig({ BOT_MODE: 'shadow', ...key }).agentKey, null)
  assert.throws(() => loadConfig({ BOT_MODE: 'testnet' }), /obligatoires/)
  const t = loadConfig({ BOT_MODE: 'testnet', ...key })
  assert.equal(t.dataNetwork, 'testnet')
  assert.equal(t.wsStaleMs, 900000)
  assert.equal(loadConfig({}).dataNetwork, 'mainnet')
})
