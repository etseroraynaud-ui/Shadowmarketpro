import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CLOSE_GRACE_MS, CandleFeed, CandleStore, fetchClosed, gapsOf, validBar } from '../src/data/candles.ts'
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

test('horloge locale en avance : la bougie n\'entre qu\'une fois la suivante ouverte chez l\'exchange', async () => {
  const chart = series(T0, 20, M15)
  // L'exchange ne connaît que les 10 premières bougies : la 10e (indice 9) est encore « en cours » chez lui.
  const api = new FakeCandleApi(chart.slice(0, 10), [])
  const closeOf9 = chart[9].t + M15
  // Horloge locale 2 s après la clôture de la bougie 9 : pas de bougie 10 chez l'exchange, la 9 est écartée.
  let got = await fetchClosed(api, 'BTC', '15m', T0, closeOf9 + 2000)
  assert.equal(got[got.length - 1].t, chart[8].t)
  // La bougie 10 s'ouvre chez l'exchange : la 9 est close.
  api.data['15m'] = chart.slice(0, 11)
  got = await fetchClosed(api, 'BTC', '15m', T0, closeOf9 + 2000)
  assert.equal(got[got.length - 1].t, chart[9].t)
  // Aucune transaction depuis la clôture : la 9 est tenue pour close après le délai de grâce.
  api.data['15m'] = chart.slice(0, 10)
  got = await fetchClosed(api, 'BTC', '15m', T0, closeOf9 + CLOSE_GRACE_MS)
  assert.equal(got[got.length - 1].t, chart[9].t)
})

test('bougie révisée par l\'exchange après lecture : signalée, le cache n\'est pas réécrit', async () => {
  const daily = series(T0 - 900 * DAY, 905, DAY, 7)
  const chart = series(T0, 300, M15, 3)
  const api = new FakeCandleApi(chart.slice(0, 101), daily)
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const feed = new CandleFeed(api, 'BTC', dir)
  const now = chart[100].t + 3000
  const a = await feed.sync(now)
  assert.deepEqual(a.revised, [])
  const lastRead = feed.chart.all[feed.chart.all.length - 1]
  assert.equal(lastRead.t, chart[99].t)
  // L'exchange modifie ensuite la bougie déjà lue (elle n'était pas définitive).
  api.data['15m'] = chart.slice(0, 102).map((b, i) => (i === 99 ? { ...b, c: b.c + 1, h: Math.max(b.h, b.c + 1), v: b.v + 0.5 } : b))
  const b = await feed.sync(chart[101].t + 3000)
  assert.equal(b.revised.length, 1)
  assert.equal(b.revised[0].t, chart[99].t)
  assert.deepEqual(Object.keys(b.revised[0].diff).sort(), b.revised[0].diff.h ? ['c', 'h', 'v'] : ['c', 'v'])
  assert.deepEqual(new CandleStore(join(dir, 'BTC-15m.csv')).all[99], lastRead)
  assert.equal(b.added.length, 1)
})
