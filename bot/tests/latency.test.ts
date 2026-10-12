// Réduction de la latence à la clôture, sans rien changer aux décisions : lectures de l'état en
// parallèle (prepareClose), compte de la clôture réutilisé pour la taille, relecture avant de
// conclure à un écart de position, fermeture incomplète (second essai, puis reliquat protégé).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LiveEngine } from '../src/engine/live.ts'
import type { FakeExchange, Fault } from './fake-exchange.ts'
import { W1, W2, M15, head, setup, playBar, trades, events } from './live-helpers.ts'

type W = typeof W1

/** Journal des appels à l'exchange : lectures de l'état et ordres au marché (entrée, fermeture). */
function callLog(ex: FakeExchange): string[] {
  const log: string[] = []
  for (const k of ['account', 'fills', 'funding', 'openOrders'] as const) {
    const f = (ex[k] as (...a: unknown[]) => Promise<unknown>).bind(ex)
    ;(ex as unknown as Record<string, unknown>)[k] = (...a: unknown[]) => { log.push(k); return f(...a) }
  }
  const market = ex.market.bind(ex)
  ex.market = (side, sz, reduceOnly, ref, slip, cloid) => { log.push(reduceOnly ? 'close' : 'entry'); return market(side, sz, reduceOnly, ref, slip, cloid) }
  return log
}

/** Fenêtre jouée bougie par bougie ; avec `prepare`, les lectures sont lancées au signal de clôture. */
async function play(W: W, prepare: boolean, faults: Fault[] = [], bars = 2500) {
  const { chart, daily } = W
  const S = setup()
  S.ex.faults = faults
  const k0 = chart.n - bars
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  const reads = callLog(S.ex)
  if (prepare) {
    const onBar = eng.onBar.bind(eng)
    eng.onBar = (b, d) => { eng.prepareClose(b.t + M15); return onBar(b, d) }
  }
  for (let i = k0; i < chart.n; i++) await playBar(eng, S.ex, S.clock, i, chart)
  return { ...S, eng, reads }
}

for (const [name, W] of [['stops et flips', W1], ['TP1 et stop suiveur', W2]] as const) test(`lectures parallèles à la clôture : mêmes ordres, mêmes trades qu'avant (${name})`, async () => {
  const a = await play(W, false)
  const b = await play(W, true)
  assert.equal(a.eng.halted, null)
  assert.equal(b.eng.halted, null)
  assert.deepEqual(b.ex.received.map(o => [o.kind, o.side, o.sz]), a.ex.received.map(o => [o.kind, o.side, o.sz]))
  assert.deepEqual(trades(b.dir), trades(a.dir))
  assert.ok(trades(a.dir).length >= 2)
  // Avant une entrée, le compte n'est plus relu : celui des lectures de la clôture sert à la taille,
  // sauf après la fermeture d'un retournement (le capital a changé).
  const entries = b.reads.flatMap((c, j) => (c === 'entry' ? [j] : []))
  assert.ok(entries.length >= 2)
  for (const j of entries) {
    const sinceReads = b.reads.slice(b.reads.lastIndexOf('openOrders', j) + 1, j)
    assert.ok(!sinceReads.includes('account') || sinceReads.includes('close'), `compte relu avant l'entrée : ${sinceReads.join(' ')}`)
  }
  const timing = events(b.dir, 'bar').map(e => e.timing as { orders: [string, number, number, string][] } | null).filter(Boolean)
  assert.ok(timing.length > 100, 'chronologie de chaque clôture journalisée')
  assert.ok(timing.some(t => t!.orders.some(o => o[0] === 'entry')), 'ordres d\'entrée horodatés')
})

test('écart de position passager entre deux lectures parallèles : état relu, pas d\'arrêt', async () => {
  const { chart, daily } = W1
  const S = setup()
  const k0 = chart.n - 2500
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  let i = k0
  while (!eng.position) await playBar(eng, S.ex, S.clock, i++, chart)
  // Une lecture du compte en retard d'un bloc (position encore à plat), une seule fois.
  const real = S.ex.account.bind(S.ex)
  let stale = true
  S.ex.account = async () => { const a = await real(); if (stale) { stale = false; return { ...a, position: { ...a.position, size: 0 } } } return a }
  await playBar(eng, S.ex, S.clock, i++, chart)
  assert.equal(eng.halted, null)
  assert.equal(events(S.dir, 'state_reread').length, 1)
})

test('fermeture exécutée à moitié : second essai, trades identiques à ceux sans panne', async () => {
  const a = await play(W1, false)
  const b = await play(W1, false, [{ kind: 'close', mode: 'partial' }])
  assert.equal(b.ex.faults.length, 0, 'la panne a eu lieu')
  assert.equal(b.eng.halted, null)
  assert.equal(b.ex.received.filter(o => o.kind === 'close').length, a.ex.received.filter(o => o.kind === 'close').length + 1)
  assert.deepEqual(trades(b.dir).map(t => [t.entryTime, t.side, t.exits, t.entry, t.exit]), trades(a.dir).map(t => [t.entryTime, t.side, t.exits, t.entry, t.exit]))
})

test('fermeture deux fois incomplète : le reliquat reçoit un stop avant l\'arrêt, jamais de position nue', async () => {
  const { chart, daily } = W1
  const S = setup()
  S.ex.faults = [{ kind: 'close', mode: 'partial' }, { kind: 'close', mode: 'partial' }]
  const k0 = chart.n - 2500
  S.clock.t = chart.t[k0 - 1] + M15
  S.ex.time = S.clock.t
  S.ex.moveTo(chart.c[k0 - 1])
  const eng = await LiveEngine.start(S.opts, head(chart, k0), daily)
  let i = k0
  while (!eng.halted && i < chart.n) await playBar(eng, S.ex, S.clock, i++, chart)
  assert.match(eng.halted ?? '', /incomplète .* protégé par un stop/)
  assert.notEqual(S.ex.pos.size, 0, 'reliquat ouvert')
  const stops = S.ex.resting('stop')
  assert.equal(stops.length, 1)
  assert.ok(Math.abs(stops[0].sz - Math.abs(S.ex.pos.size)) < 1e-9, `stop ${stops[0].sz} pour un reliquat de ${S.ex.pos.size}`)
  assert.equal(events(S.dir, 'exit_incomplete').length, 1)
})
