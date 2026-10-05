import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CandleFeed, CandleStore, fetchClosed, gapsOf, validBar } from '../src/data/candles.ts'
import { FakeCandleApi, series, M15, DAY } from './fakes.ts'

const T0 = Date.UTC(2026, 0, 1)

test('seules les bougies closes sont gardées, en plusieurs appels au-delà de 5000', async () => {
  const chart = series(T0, 12000, M15)
  const api = new FakeCandleApi(chart, [])
  const now = chart[11999].t + 5 * 60000 // la dernière bougie est encore ouverte
  const got = await fetchClosed(api, 'BTC', '15m', T0, now)
  assert.equal(got.length, 11999)
  assert.equal(got[got.length - 1].t, chart[11998].t)
  assert.ok(api.calls >= 3)
  for (let i = 1; i < got.length; i++) assert.equal(got[i].t - got[i - 1].t, M15)
})

test('bougie invalide ou mal alignée : refusée', async () => {
  const chart = series(T0, 10, M15)
  const bad = new FakeCandleApi(chart.map((b, i) => (i === 5 ? { ...b, h: b.l - 1 } : b)), [])
  await assert.rejects(fetchClosed(bad, 'BTC', '15m', T0, T0 + 20 * M15), /invalide/)
  const shifted = new FakeCandleApi(chart.map(b => ({ ...b, t: b.t + 1000 })), [])
  await assert.rejects(fetchClosed(shifted, 'BTC', '15m', T0, T0 + 20 * M15), /mal alignée/)
  assert.equal(validBar({ t: T0, o: 1, h: 2, l: 0.5, c: 1.5, v: 0 }), true)
})

test('cache : ajout seul, relu à l\'identique, refuse un fichier corrompu', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const file = join(dir, 'BTC-15m.csv')
  const s = new CandleStore(file)
  const cs = series(T0, 50, M15)
  assert.equal(s.append(cs.slice(0, 30)).length, 30)
  assert.equal(s.append(cs.slice(20, 50)).length, 20) // les 10 déjà connues sont ignorées
  const again = new CandleStore(file)
  assert.deepEqual(again.all, cs)
  writeFileSync(file, readFileSync(file, 'utf8').replace(/\n[^\n]+\n$/, `\n${T0},1,1,1,1,1\n`))
  assert.throws(() => new CandleStore(file), /ordre des bougies/)
})

test('trous signalés, jamais comblés', () => {
  const cs = series(T0, 10, M15)
  const holed = [...cs.slice(0, 4), ...cs.slice(7)]
  assert.deepEqual(gapsOf(holed, M15), [[cs[7].t, 3]])
})

test('flux : rattrapage du cache, puis journalier re-téléchargé à chaque nouveau jour clos', async () => {
  const daily = series(T0 - 900 * DAY, 905, DAY, 7)
  const chart = series(T0, 4 * 96 + 10, M15, 3)
  const api = new FakeCandleApi(chart, daily)
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const feed = new CandleFeed(api, 'BTC', dir)
  const now1 = T0 + 2 * DAY + 3 * M15 + 1000
  const a = await feed.sync(now1)
  assert.equal(a.added.length, 2 * 96 + 3)
  assert.equal(a.dailyChanged, true)
  assert.equal(feed.daily.lastTime, T0 + DAY)
  const b = await feed.sync(now1 + M15)
  assert.equal(b.added.length, 1)
  assert.equal(b.dailyChanged, false)
  const c = await feed.sync(T0 + 3 * DAY + 2 * M15 + 1000)
  assert.equal(c.dailyChanged, true)
  assert.equal(feed.daily.lastTime, T0 + 2 * DAY)
  // Redémarrage : le cache est relu, rien n'est ajouté deux fois.
  const feed2 = new CandleFeed(api, 'BTC', dir)
  assert.equal(feed2.chart.all.length, feed.chart.all.length)
  assert.equal((await feed2.sync(T0 + 3 * DAY + 2 * M15 + 1000)).added.length, 0)
})
