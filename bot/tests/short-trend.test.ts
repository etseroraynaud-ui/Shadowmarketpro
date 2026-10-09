import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ShockSession, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { engineEntries, trendDown } from '../../research/lib/e2.ts'
import { loadConfig } from '../src/config.ts'
import { FilteredSession, newSession, shortTrendEntries } from '../src/engine/short-trend.ts'
import { checkParity } from '../src/tools/parity.ts'
import { ShadowEngine } from '../src/engine/shadow.ts'
import { Journal } from '../src/journal.ts'
import { LiveEngine, handoffCosts } from '../src/engine/live.ts'
import { M15, head, playBar, setup, shock, trades, windowOf } from './live-helpers.ts'

// Fenêtre où le régime de tendance journalier passe de non baissier à baissier : la condition
// retire 6 des 8 shorts du moteur sur les 2 500 dernières bougies et en garde 2.
const W3 = windowOf('2022-07-20', '2022-09-10')
const { chart, daily } = W3
const costs = handoffCosts(loadConfig({ BOT_MODE: 'shadow' }), shock)
const m = marketFor(chart, 15, 1)
const sel = selectFor(shock, m, daily).select
const k0 = chart.n - 2500
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z')
const ref = simulate(m, shock.sets, costs, 0, chart.n - 1, sel, shortTrendEntries(m, shock.sets, sel, 15, daily))
const raw = simulate(m, shock.sets, costs, 0, chart.n - 1, sel)

test('BOT_SHORT_TREND_FILTER : désactivée par défaut, 0 ou 1 seulement ; sans elle, la session du moteur', () => {
  assert.equal(loadConfig({ BOT_MODE: 'shadow' }).shortTrendFilter, false)
  assert.equal(loadConfig({ BOT_MODE: 'shadow', BOT_SHORT_TREND_FILTER: '0' }).shortTrendFilter, false)
  assert.equal(loadConfig({ BOT_MODE: 'shadow', BOT_SHORT_TREND_FILTER: '1' }).shortTrendFilter, true)
  assert.throws(() => loadConfig({ BOT_MODE: 'shadow', BOT_SHORT_TREND_FILTER: 'oui' }), /0 ou 1/)
  const h = head(chart, 600)
  assert.ok(newSession(shock, costs, h, 0, { regimeBars: daily }, false) instanceof ShockSession)
  assert.ok(newSession(shock, costs, h, 0, { regimeBars: daily }, true) instanceof FilteredSession)
})

test('mêmes entrées que la recherche (research/lib/e2.ts), shorts seulement en tendance baissière', () => {
  const bot = shortTrendEntries(m, shock.sets, sel, 15, daily)
  const research = engineEntries(m, shock.sets, sel, trendDown(chart, daily))
  assert.deepEqual(bot.long, research.long)
  assert.deepEqual(bot.short, research.short)
  const shortsRaw = raw.positions.filter(p => p.dir < 0 && p.entryIdx >= k0).length
  const shortsRef = ref.positions.filter(p => p.dir < 0 && p.entryIdx >= k0).length
  assert.ok(shortsRef >= 1 && shortsRef < shortsRaw, `shorts : ${shortsRaw} sans la condition, ${shortsRef} avec`)
})

test('parité backtest / bot avec la condition, décision par décision', () => {
  const r = checkParity(shock, costs, chart, daily, 2500, true)
  assert.equal(r.ok, true, JSON.stringify(r, null, 1))
  assert.ok(r.positionsBot >= 2)
  // Sans la condition, le même bot ne donne pas les mêmes positions (le test n'est pas vide).
  assert.notEqual(raw.positions.filter(p => p.exitIdx < chart.n - 1).length, r.positionsBacktest)
})

test('shadow mode avec la condition : mêmes trades que le backtest filtré', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const journal = new Journal(dir, 'shadow', true)
  const eng = new ShadowEngine(shock, costs, head(chart, k0), daily, journal, true)
  for (let i = k0; i < chart.n; i++) eng.onBar({ t: chart.t[i], o: chart.o[i], h: chart.h[i], l: chart.l[i], c: chart.c[i], v: chart.v[i] })
  const closed = ref.positions.filter(p => p.exitIdx >= k0 && p.exitIdx < chart.n - 1)
  const csv = readFileSync(join(dir, 'trades-shadow.csv'), 'utf8').trim().split('\n').slice(1).map(r => r.split(','))
  assert.deepEqual(csv.map(r => [r[1], r[2]]), closed.map(p => [p.dir === 1 ? 'long' : 'short', iso(chart.t[p.entryIdx] + M15)]))
})

test('live + exchange idéal avec la condition = backtest filtré ; redémarrage au milieu : mêmes trades', async () => {
  const run = async (restartAt: number | null) => {
    const s = setup({ BOT_SHORT_TREND_FILTER: '1' })
    s.clock.t = chart.t[k0 - 1] + M15
    s.ex.time = s.clock.t
    s.ex.moveTo(chart.c[k0 - 1])
    let eng = await LiveEngine.start(s.opts, head(chart, k0), daily)
    for (let i = k0; i < chart.n; i++) {
      if (i === restartAt) eng = await LiveEngine.start(s.opts, head(chart, i), daily)
      await playBar(eng, s.ex, s.clock, i, chart)
    }
    assert.equal(eng.halted, null)
    return trades(s.dir)
  }
  const live = await run(null)
  const firstLive = live.length ? Date.parse(live[0].entryTime) : Infinity
  const bt = ref.positions.filter(p => chart.t[p.entryIdx] + M15 >= firstLive && p.exitIdx < chart.n - 1)
  assert.ok(bt.length >= 2, `${bt.length} trades`)
  assert.deepEqual(live.map(t => [t.entryTime, t.side, t.exits]), bt.map(p => [iso(chart.t[p.entryIdx] + M15), p.dir === 1 ? 'long' : 'short', p.exits.join('+')]))
  assert.ok(live.some(t => t.side === 'short'), 'au moins un short gardé')
  const restarted = await run(k0 + 1250)
  assert.deepEqual(restarted.map(t => [t.entryTime, t.side, t.exits, t.entry]), live.map(t => [t.entryTime, t.side, t.exits, t.entry]))
})
