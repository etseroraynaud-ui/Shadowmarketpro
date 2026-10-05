import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBtc, dayMs } from '../../research/lib/data.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { loadConfig } from '../src/config.ts'
import { Journal } from '../src/journal.ts'
import { LiveEngine, handoffCosts } from '../src/engine/live.ts'
import { StateStore } from '../src/engine/state.ts'
import { FakeExchange } from './fake-exchange.ts'
import { backtestTrips, compareTrips, roundTrips } from '../../lib/hyperliquid/track.ts'

const all15 = loadBtc(15)
const allDaily = resample(loadBtc(60), 86400000)
const windowOf = (from: string, to: string) => ({ chart: sliceBars(all15, dayMs(from), dayMs(to)), daily: sliceBars(allDaily, dayMs('2020-01-01'), dayMs(to)) })
// Fenêtre 1 : stops et flips, longs et shorts, deux régimes. Fenêtre 2 : TP1 puis stop suiveur.
const W1 = windowOf('2023-05-01', '2023-06-22')
const W2 = windowOf('2026-02-01', '2026-03-25')
const { chart, daily } = W1
const shock = adaptivePreset(15, 1)
const M15 = 15 * 60000
const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

function setup(over: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bot-live-'))
  const cfg = loadConfig({ BOT_MODE: 'testnet', HL_ACCOUNT_ADDRESS: '0x' + '1'.repeat(40), HL_AGENT_PRIVATE_KEY: '0x' + '2'.repeat(64), BOT_STATE_DIR: dir, BOT_LOG_DIR: join(dir, 'logs'), BOT_DATA_DIR: dir, BOT_MAX_NOTIONAL_USD: '1000000', ...over })
  const ex = new FakeExchange(10000, 0.045)
  const clock = { t: 0 }
  const journal = new Journal(cfg.logDir, 'testnet', true)
  const store = new StateStore(join(dir, 'state.json'))
  const opts = { cfg, shock, exchange: ex, journal, store, network: 'testnet' as const, now: () => clock.t }
  return { dir, cfg, ex, clock, journal, store, opts }
}

/** Une bougie jouée comme le broker simulé : ouverture (gap), extrême le plus proche, l'autre, clôture. */
async function playBar(eng: LiveEngine, ex: FakeExchange, clock: { t: number }, i: number, chart = W1.chart) {
  const o = chart.o[i], h = chart.h[i], l = chart.l[i], c = chart.c[i]
  const path = h - o < o - l ? [h, l, c] : [l, h, c]
  clock.t = chart.t[i] + 1000
  ex.time = clock.t
  ex.moveTo(o, true)
  await eng.onMid(o)
  await eng.syncFills()
  for (const [k, p] of path.entries()) {
    clock.t = chart.t[i] + (k + 1) * 120000
    ex.time = clock.t
    ex.moveTo(p)
    await eng.onMid(p)
    await eng.syncFills()
  }
  clock.t = chart.t[i] + M15
  ex.time = clock.t
  await eng.onBar({ t: chart.t[i], o, h, l, c, v: chart.v[i] })
}

function trades(dir: string) {
  const f = join(dir, 'logs', 'trades-testnet.csv')
  if (!existsSync(f)) return []
  const [hdr, ...rows] = readFileSync(f, 'utf8').trim().split('\n')
  const cols = hdr.split(',')
  return rows.map(r => Object.fromEntries(r.split(',').map((v, k) => [cols[k], v])))
}

for (const [name, W] of [['stops et flips', W1], ['TP1 et stop suiveur', W2]] as const) test(`live + exchange idéal = backtest (${name}) : mêmes trades, mêmes sorties, mêmes prix`, async () => {
  const { chart, daily } = W
  const { dir, ex, clock, opts } = setup()
  const k0 = chart.n - 2500
  clock.t = chart.t[k0 - 1] + M15
  ex.time = clock.t
  ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(opts, head(chart, k0), daily)
  for (let i = k0; i < chart.n; i++) await playBar(eng, ex, clock, i, chart)
  assert.equal(eng.halted, null)
  // Backtest de référence sur toute la série ; le live a pris la main au premier instant à plat.
  const m = marketFor(chart, 15, 1)
  const ref = simulate(m, shock.sets, handoffCosts(opts.cfg, shock), 0, chart.n - 1, selectFor(shock, m, daily).select)
  const live = trades(dir)
  const firstLive = live.length ? Date.parse(live[0].entryTime) : Infinity
  const bt = ref.positions.filter(p => chart.t[p.entryIdx] + M15 >= firstLive && p.exitIdx < chart.n - 1)
  assert.ok(bt.length >= 2, `${bt.length} trades`)
  assert.equal(live.length, bt.length)
  bt.forEach((p, k) => {
    const t = live[k]
    assert.equal(t.entryTime, new Date(chart.t[p.entryIdx] + M15).toISOString().replace('.000Z', 'Z'), `entrée ${k}`)
    assert.equal(t.side, p.dir === 1 ? 'long' : 'short')
    assert.equal(t.exits, p.exits.join('+'), `sorties ${k}`)
    assert.equal(Number(t.entry), p.entryPrice, `prix d'entrée ${k}`)
    assert.ok(Math.abs(Number(t.exit) / p.exitPrice - 1) < 1e-4, `prix de sortie ${k} : ${t.exit} / ${p.exitPrice}`)
    assert.equal(t.set, String(p.set))
  })
  if (W === W2) assert.ok(bt.some(p => p.exits.includes('TP1')) && bt.some(p => p.exits.includes('TRAIL')), 'TP1 et stop suiveur couverts')
  // Page Performance live : les trades reconstitués à partir des seuls fills publics
  // correspondent un à un au backtest, avec le même rendement par trade.
  const { trips, skipped } = roundTrips(ex.log.map(f => ({ ...f, coin: 'BTC' })))
  assert.equal(skipped, 0)
  const closed = trips.filter(t => t.exitTime != null)
  assert.equal(closed.length, bt.length)
  assert.ok(closed.every(t => t.bot), 'entrées reconnues comme ordres du bot')
  const rows = compareTrips(closed, backtestTrips(chart, bt, null, M15), M15, firstLive)
  assert.deepEqual(rows.map(r => r.status), bt.map(() => 'match'))
  rows.forEach((r, k) => {
    assert.equal(r.live!.exits.includes('tp1'), bt[k].exits.includes('TP1'), `TP1 ${k}`)
    assert.ok(Math.abs(r.live!.pnlPct - bt[k].pnlPct) < 2e-4, `rendement ${k} : ${r.live!.pnlPct} / ${bt[k].pnlPct}`)
  })
})

test('compte pas à plat au premier lancement : aucun ordre', async () => {
  const { ex, clock, opts } = setup()
  clock.t = chart.t[chart.n - 1] + M15
  ex.moveTo(chart.c[chart.n - 1])
  await ex.market('buy', 0.01, false, ex.price, 1, '0xabc')
  ex.calls.length = 0
  const eng = await LiveEngine.start(opts, chart, daily)
  assert.match(eng.halted ?? '', /aucune position connue/)
  assert.deepEqual(ex.calls.filter(c => !c.startsWith('cancel')), [])
})

test('ordre ouvert qui ne vient pas du bot : arrêt', async () => {
  const { ex, clock, opts } = setup()
  clock.t = chart.t[chart.n - 1] + M15
  ex.moveTo(chart.c[chart.n - 1])
  await ex.limit('buy', 0.01, 1000, false, '0x' + 'f'.repeat(32))
  const eng = await LiveEngine.start(opts, chart, daily)
  assert.match(eng.halted ?? '', /ne viennent pas du bot/)
})

test('fichier d\'arrêt manuel : aucune entrée', async () => {
  const { cfg, ex, clock, opts, journal } = setup()
  writeFileSync(cfg.killFile, '')
  const k0 = chart.n - 2500
  clock.t = chart.t[k0 - 1] + M15
  ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(opts, head(chart, k0), daily)
  for (let i = k0; i < chart.n; i++) await playBar(eng, ex, clock, i)
  assert.equal(ex.log.length, 0)
  const ev = readFileSync(join(journal.dir, (await import('node:fs')).readdirSync(journal.dir).find(f => f.startsWith('events-'))!), 'utf8')
  assert.match(ev, /entry_blocked/)
})

test('redémarrage : l\'état relu reprend exactement où il en était', async () => {
  // Référence sans interruption.
  const a = setup()
  const k0 = chart.n - 2500
  a.clock.t = chart.t[k0 - 1] + M15
  a.ex.moveTo(chart.c[k0 - 1])
  const ea = await LiveEngine.start(a.opts, head(chart, k0), daily)
  for (let i = k0; i < chart.n; i++) await playBar(ea, a.ex, a.clock, i)
  // Même parcours, avec un arrêt et une reprise au milieu (même exchange, même état sur disque).
  const b = setup()
  b.clock.t = chart.t[k0 - 1] + M15
  b.ex.moveTo(chart.c[k0 - 1])
  let eb = await LiveEngine.start(b.opts, head(chart, k0), daily)
  const mid = k0 + 1250
  for (let i = k0; i < mid; i++) await playBar(eb, b.ex, b.clock, i)
  eb = await LiveEngine.start(b.opts, head(chart, mid), daily)
  assert.equal(eb.halted, null)
  for (let i = mid; i < chart.n; i++) await playBar(eb, b.ex, b.clock, i)
  assert.deepEqual(trades(b.dir).map(t => [t.entryTime, t.side, t.exits, t.entry]), trades(a.dir).map(t => [t.entryTime, t.side, t.exits, t.entry]))
  assert.ok(trades(a.dir).length >= 2)
})
