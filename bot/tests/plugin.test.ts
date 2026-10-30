import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ShockSession, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { loadConfig, publicConfig } from '../src/config.ts'
import { newSession } from '../src/engine/short-trend.ts'
import { VariantSession, loadPlugin, simulateVariant, variantEntries, variantName, variantOf } from '../src/engine/plugin.ts'
import type { Variant } from '../src/engine/plugin.ts'
import { checkParity } from '../src/tools/parity.ts'
import { ShadowEngine } from '../src/engine/shadow.ts'
import { Journal } from '../src/journal.ts'
import { LiveEngine, handoffCosts } from '../src/engine/live.ts'
import { M15, W1, events, head, playBar, setup, shock, trades } from './live-helpers.ts'
import toy from './toy-plugin.ts'

// Point d'extension BOT_PLUGIN, essayé avec un module factice (tests/toy-plugin.ts) : il change des
// entrées et des sorties sur la fenêtre 1, et le bot doit rester identique au backtest de la variante.
const TOY = join(import.meta.dirname, 'toy-plugin.ts')
const { chart, daily } = W1
const costs = handoffCosts(loadConfig({ BOT_MODE: 'shadow' }), shock)
const m = marketFor(chart, 15, 1)
const sel = selectFor(shock, m, daily).select
const k0 = chart.n - 2500
const iso = (t: number) => new Date(t).toISOString().replace('.000Z', 'Z')
const V: Variant = { shortTrend: false, plugin: toy }
const entries = variantEntries(m, shock.sets, sel, 15, daily, V)!
const ref = simulateVariant(m, shock.sets, costs, 0, chart.n - 1, sel, entries, toy)
const raw = simulate(m, shock.sets, costs, 0, chart.n - 1, sel)
const sig = (p: (typeof ref.positions)[number]) => `${p.entryIdx} ${p.dir} ${p.exits.join('+')} ${p.exitIdx}`

test('BOT_PLUGIN : aucun par défaut ; fichier absent, export invalide ou version exigée refusés', async () => {
  const d = loadConfig({ BOT_MODE: 'shadow' })
  assert.equal(d.pluginPath, null)
  assert.equal(await loadPlugin(d.pluginPath, false), null)
  assert.equal(variantName(variantOf(d)), 'moteur')
  assert.ok(newSession(shock, costs, head(chart, 600), 0, { regimeBars: daily }, variantOf(d)) instanceof ShockSession)
  await assert.rejects(loadPlugin('/nulle/part.ts', false), /introuvable/)
  const dir = mkdtempSync(join(tmpdir(), 'plugin-'))
  writeFileSync(join(dir, 'vide.ts'), 'export default { name: "vide" }\n')
  await assert.rejects(loadPlugin(join(dir, 'vide.ts'), false), /doit exporter/)
  writeFileSync(join(dir, 'pub.ts'), 'export default { name: "pub", requiresShortTrend: true, exits: () => false }\n')
  await assert.rejects(loadPlugin(join(dir, 'pub.ts'), false), /BOT_SHORT_TREND_FILTER=1/)
  assert.equal((await loadPlugin(join(dir, 'pub.ts'), true))?.name, 'pub')
  const c = loadConfig({ BOT_MODE: 'shadow', BOT_PLUGIN: TOY })
  c.plugin = await loadPlugin(c.pluginPath, c.shortTrendFilter)
  assert.equal(variantName(variantOf(c)), 'moteur + module factice')
  assert.ok(newSession(shock, costs, head(chart, 600), 0, { regimeBars: daily }, variantOf(c)) instanceof VariantSession)
  // Le journal ne garde que le nom du module.
  assert.equal(publicConfig(c).plugin, 'factice')
})

test('parité backtest / bot avec un module, décision par décision ; le module change entrées et sorties', () => {
  const r = checkParity(shock, costs, chart, daily, 2500, V)
  assert.equal(r.ok, true, JSON.stringify(r, null, 1))
  const noExits = simulate(m, shock.sets, costs, 0, chart.n - 1, sel, entries)
  const a = ref.positions.filter(p => p.entryIdx >= k0).map(sig), b = noExits.positions.filter(p => p.entryIdx >= k0).map(sig)
  assert.ok(a.some(x => !b.includes(x)), 'sorties changées')
  assert.notEqual(raw.positions.filter(p => p.entryIdx >= k0).map(sig).join(), b.join(), 'entrées changées')
})

test('shadow mode avec un module : mêmes trades que le backtest de la variante', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const eng = new ShadowEngine(shock, costs, head(chart, k0), daily, new Journal(dir, 'shadow', true), V)
  for (let i = k0; i < chart.n; i++) eng.onBar({ t: chart.t[i], o: chart.o[i], h: chart.h[i], l: chart.l[i], c: chart.c[i], v: chart.v[i] })
  const closed = ref.positions.filter(p => p.exitIdx >= k0 && p.exitIdx < chart.n - 1)
  const csv = readFileSync(join(dir, 'trades-shadow.csv'), 'utf8').trim().split('\n').slice(1).map(r => r.split(','))
  assert.deepEqual(csv.map(r => [r[1], r[2]]), closed.map(p => [p.dir === 1 ? 'long' : 'short', iso(chart.t[p.entryIdx] + M15)]))
})

test('live + exchange idéal avec un module = backtest de la variante ; redémarrage au milieu : mêmes trades', async () => {
  const run = async (restartAt: number | null) => {
    const s = setup({ BOT_PLUGIN: TOY })
    s.cfg.plugin = await loadPlugin(s.cfg.pluginPath, s.cfg.shortTrendFilter)
    s.clock.t = chart.t[k0 - 1] + M15
    s.ex.time = s.clock.t
    s.ex.moveTo(chart.c[k0 - 1])
    let eng = await LiveEngine.start(s.opts, head(chart, k0), daily)
    for (let i = k0; i < chart.n; i++) {
      if (i === restartAt) eng = await LiveEngine.start(s.opts, head(chart, i), daily)
      await playBar(eng, s.ex, s.clock, i, chart)
    }
    assert.equal(eng.halted, null)
    return { live: trades(s.dir), adj: events(s.dir, 'exits_adjusted') }
  }
  const { live, adj } = await run(null)
  const firstLive = live.length ? Date.parse(live[0].entryTime) : Infinity
  const bt = ref.positions.filter(p => chart.t[p.entryIdx] + M15 >= firstLive && p.exitIdx < chart.n - 1)
  assert.ok(bt.length >= 3, `${bt.length} trades`)
  assert.deepEqual(live.map(t => [t.entryTime, t.side, t.exits]), bt.map(p => [iso(chart.t[p.entryIdx] + M15), p.dir === 1 ? 'long' : 'short', p.exits.join('+')]))
  assert.ok(adj.length >= 1 && adj.every(e => e.module === 'factice'))
  const restarted = (await run(k0 + 1250)).live
  assert.deepEqual(restarted.map(t => [t.entryTime, t.side, t.exits, t.entry]), live.map(t => [t.entryTime, t.side, t.exits, t.entry]))
})
