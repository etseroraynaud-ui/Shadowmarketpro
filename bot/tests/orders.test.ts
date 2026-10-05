// Pas d'ordre en double, état des positions juste : réponses perdues, requêtes perdues, arrêt
// brutal en plein envoi, ordre du bot en trop chez l'exchange, stop disparu, deux instances.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { LiveEngine, handoffCosts } from '../src/engine/live.ts'
import { StateStore, indexOfTime } from '../src/engine/state.ts'
import { newCloid } from '../src/exec/exchange.ts'
import { Crash } from './fake-exchange.ts'
import type { FakeExchange, Fault } from './fake-exchange.ts'
import { W1, W2, M15, shock, head, setup, playBar, trades, events } from './live-helpers.ts'

type W = typeof W1

/** Invariants vérifiés après chaque bougie : jamais plus d'un stop, d'un TP1 ; position = exchange. */
function invariants(eng: LiveEngine, ex: FakeExchange, where: string) {
  assert.ok(ex.resting('stop').length <= 1, `${where} : ${ex.resting('stop').length} stops posés`)
  assert.ok(ex.resting('tp1').length <= 1, `${where} : ${ex.resting('tp1').length} TP1 posés`)
  const p = eng.position
  if (!eng.halted) assert.equal(ex.pos.size, p ? p.dir * p.size : 0, `${where} : position exchange ${ex.pos.size}, bot ${p ? p.dir * p.size : 0}`)
}

/** Joue la fenêtre ; un arrêt brutal relance le moteur depuis l'état sur disque, comme un redémarrage. */
async function run(W: W, faults: Fault[], over: Record<string, string> = {}, bars = 2500) {
  const { chart, daily } = W
  const S = setup(over)
  S.ex.faults = faults
  const k0 = chart.n - bars
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  let eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  const crashes: { bar: number; stopsAtCrash: number; received: number }[] = []
  for (let i = k0; i < chart.n; i++) {
    try {
      await playBar(eng, S.ex, S.clock, i, chart)
    } catch (e) {
      if (!(e instanceof Crash)) throw e
      crashes.push({ bar: i, stopsAtCrash: S.ex.resting('stop').length, received: S.ex.received.length })
      // Redémarrage : état relu sur disque, historique jusqu'à la dernière bougie enregistrée.
      const saved = new StateStore(join(S.dir, 'state.json')).load()!
      const idx = indexOfTime(chart.t, saved.lastBarTime)
      eng = await LiveEngine.start(S.opts, head(chart, idx + 1), daily)
      i = idx
      continue
    }
    invariants(eng, S.ex, new Date(chart.t[i]).toISOString())
  }
  return { ...S, eng, crashes, k0 }
}

/** Trades du backtest à partir de la prise de main du bot. */
function backtest(W: W, live: Record<string, string>[], cfg: ReturnType<typeof setup>['cfg']) {
  const { chart, daily } = W
  const m = marketFor(chart, 15, 1)
  const ref = simulate(m, shock.sets, handoffCosts(cfg, shock), 0, chart.n - 1, selectFor(shock, m, daily).select)
  const firstLive = live.length ? Date.parse(live[0].entryTime) : Infinity
  return ref.positions.filter(p => chart.t[p.entryIdx] + M15 >= firstLive && p.exitIdx < chart.n - 1)
}

test('réponse perdue après exécution (entrée, stop, fermeture) : rien n\'est renvoyé, trades identiques au backtest', async () => {
  const r = await run(W1, [{ kind: 'entry', mode: 'lost-response' }, { kind: 'stop', mode: 'lost-response' }, { kind: 'close', mode: 'lost-response' }])
  assert.equal(r.eng.halted, null)
  assert.equal(r.ex.faults.length, 0, 'les trois pannes ont eu lieu')
  const resolved = events(r.dir, 'order_resolved')
  assert.equal(resolved.length, 3)
  assert.ok(resolved.every(e => e.status === 'filled' || e.status === 'open'), JSON.stringify(resolved))
  // Une entrée envoyée par trade, jamais deux.
  const live = trades(r.dir)
  const entries = r.ex.received.filter(o => o.kind === 'entry')
  assert.equal(entries.length, live.length + (r.eng.position ? 1 : 0))
  assert.equal(new Set(r.ex.received.map(o => o.cloid)).size, r.ex.received.length, 'chaque cloid envoyé une seule fois')
  const bt = backtest(W1, live, r.cfg)
  assert.ok(bt.length >= 2)
  assert.deepEqual(live.map(t => [t.entryTime, t.side, t.exits, Number(t.entry)]), bt.map(p => [new Date(W1.chart.t[p.entryIdx] + M15).toISOString().replace('.000Z', 'Z'), p.dir === 1 ? 'long' : 'short', p.exits.join('+'), p.entryPrice]))
  assert.equal(events(r.dir, 'fill_unmatched').length, 0)
})

test('requête perdue avant l\'exchange : l\'entrée n\'est pas renvoyée, elle est abandonnée', async () => {
  const r = await run(W1, [{ kind: 'entry', mode: 'lost-request' }])
  assert.equal(r.eng.halted, null)
  const resolved = events(r.dir, 'order_resolved')
  assert.equal(resolved.length, 1)
  assert.equal(resolved[0].status, 'unknown')
  assert.equal(events(r.dir, 'entry_failed').length, 1)
  const live = trades(r.dir)
  assert.equal(r.ex.received.filter(o => o.kind === 'entry').length, live.length + (r.eng.position ? 1 : 0))
})

test('arrêt brutal juste après l\'envoi d\'une entrée : retrouvée par son cloid au redémarrage, rien n\'est renvoyé, arrêt', async () => {
  const r = await run(W1, [{ kind: 'entry', mode: 'crash' }], {}, 2500)
  assert.equal(r.crashes.length, 1)
  assert.match(r.eng.halted ?? '', /entry .* filled/)
  const found = events(r.dir, 'pending_order_found')
  assert.equal(found.length, 1)
  assert.equal(found[0].kind, 'entry')
  // Après le redémarrage : plus aucun ordre.
  assert.equal(r.ex.received.length, r.crashes[0].received)
  assert.equal(r.ex.received.filter(o => o.kind === 'entry').length, 1)
})

test('arrêt brutal pendant le déplacement du stop : le nouveau stop est adopté, l\'ancien annulé, jamais deux stops', async () => {
  // Deuxième ordre stop de la fenêtre 2 : déplacement du stop suiveur (un stop est déjà posé).
  const r = await run(W2, [{ kind: 'stop', mode: 'crash', skip: 1 }])
  assert.equal(r.crashes.length, 1)
  assert.equal(r.crashes[0].stopsAtCrash, 2, 'au moment de l\'arrêt, l\'ancien et le nouveau stop sont posés')
  assert.equal(r.eng.halted, null)
  assert.equal(events(r.dir, 'pending_order_adopted').length, 1)
  const orphans = events(r.dir, 'orphan_orders_canceled')
  assert.equal(orphans.length, 1)
  assert.equal((orphans[0].orders as { kind: string }[])[0].kind, 'stop')
  assert.ok(trades(r.dir).length >= 2)
})

test('ordre du bot en double chez l\'exchange : annulé à la clôture suivante ; stop disparu : reposé', async () => {
  const { chart, daily } = W1
  const S = setup()
  const k0 = chart.n - 2500
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  let i = k0
  while (!(eng.position?.stopOid != null)) await playBar(eng, S.ex, S.clock, i++, chart)
  const pos = eng.position!
  // Doublon : un second stop du bot, que l'état ne connaît pas.
  await S.ex.stop(pos.dir === 1 ? 'sell' : 'buy', pos.size, pos.stopTrigger!, 5, newCloid('stop'))
  assert.equal(S.ex.resting('stop').length, 2)
  await playBar(eng, S.ex, S.clock, i++, chart)
  assert.ok(S.ex.resting('stop').length <= 1)
  assert.equal(events(S.dir, 'orphan_orders_canceled').length, 1)
  // Stop annulé hors du bot : reposé à la clôture suivante.
  while (!(eng.position?.stopOid != null)) await playBar(eng, S.ex, S.clock, i++, chart)
  await S.ex.cancel([eng.position!.stopOid!])
  assert.equal(S.ex.resting('stop').length, 0)
  await playBar(eng, S.ex, S.clock, i++, chart)
  if (eng.position) assert.equal(S.ex.resting('stop').length, 1)
  assert.equal(events(S.dir, 'stop_missing').length, 1)
  assert.equal(eng.halted, null)
})

test('spread trop large : aucune entrée ; spread normal : entrée au prix d\'en face', async () => {
  const wide = await (async () => {
    const S = setup({ BOT_MAX_SPREAD_BPS: '5' })
    S.ex.spread = 50 // ~18 pb sur BTC à 27 000
    const { chart, daily } = W1
    const k0 = chart.n - 2500
    S.clock.t = chart.t[k0 - 1] + M15
    S.ex.time = S.clock.t
    S.ex.moveTo(chart.c[k0 - 1])
    const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
    for (let i = k0; i < k0 + 400; i++) await playBar(eng, S.ex, S.clock, i, chart)
    return S
  })()
  assert.equal(wide.ex.received.filter(o => o.kind === 'entry').length, 0)
  const skipped = events(wide.dir, 'entry_skipped')
  assert.ok(skipped.length >= 1 && skipped.every(e => /spread/.test(String(e.reason))))

  const S = setup()
  S.ex.spread = 2
  const { chart, daily } = W1
  const k0 = chart.n - 2500
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  for (let i = k0; i < k0 + 400 && !eng.position; i++) await playBar(eng, S.ex, S.clock, i, chart)
  const e = events(S.dir, 'entry')[0]
  assert.ok(e, 'une entrée')
  assert.equal(e.avg, e.side === 'buy' ? (e.ref as number) + 1 : (e.ref as number) - 1)
})

test('verrou : une seconde instance sur le même état refuse de démarrer ; un verrou abandonné est repris', async () => {
  const { writeFileSync, existsSync } = await import('node:fs')
  const S = setup()
  const file = join(S.dir, 'x.json')
  const store = new StateStore(file)
  // Verrou tenu par un autre processus vivant (ici, le processus parent du test).
  writeFileSync(`${file}.lock`, String(process.ppid))
  assert.throws(() => store.lock(), /autre instance/)
  // Verrou d'un processus disparu, ou du même numéro de processus après un redémarrage : repris.
  writeFileSync(`${file}.lock`, '999999')
  const release = store.lock()
  assert.ok(existsSync(`${file}.lock`))
  release()
  assert.ok(!existsSync(`${file}.lock`))
  store.lock()()
})
