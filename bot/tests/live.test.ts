import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { LiveEngine, handoffCosts } from '../src/engine/live.ts'
import { W1, W2, shock, M15, head, setup, playBar, trades } from './live-helpers.ts'
import { backtestTrips, compareTrips, roundTrips } from '../../lib/hyperliquid/track.ts'

const { chart, daily } = W1

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
