import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { sliceBars } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'
import { DEFAULT_PARAMS, USER_2026, withParams } from '../../lib/strategies/shock/params.ts'
import { adaptivePreset, marketFor, selectFor, ShockSession } from '../../lib/strategies/shock/live.ts'
import type { ShockConfig } from '../../lib/strategies/shock/live.ts'

const all = loadBtc(15)
const bars = sliceBars(all, dayMs('2022-06-01'), dayMs('2023-08-01'))
const start = indexAtOrAfter(bars, dayMs('2023-01-01'))
const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

/** Backtest d'un bloc, puis le même historique rejoué bougie par bougie par le moteur live. */
function parity(cfg: ShockConfig, costs: Costs, steps: number) {
  const m = marketFor(bars, cfg.tfMin, cfg.mintick)
  const { select } = selectFor(cfg, m)
  const ref = simulate(m, cfg.sets, costs, start, bars.n - 1, select)
  const k0 = bars.n - steps
  const s = new ShockSession(cfg, costs, head(bars, k0), start)
  for (let i = k0; i < bars.n; i++) s.push({ t: bars.t[i], o: bars.o[i], h: bars.h[i], l: bars.l[i], c: bars.c[i], v: bars.v[i] })
  // La dernière barre du backtest ferme tout (fin de fenêtre) : comparaison jusqu'à l'avant-dernière.
  const lastBar = bars.n - 1
  const a = ref.positions.filter(p => p.exitIdx < lastBar)
  const b = s.broker.positions.filter(p => p.exitIdx < lastBar)
  assert.deepEqual(b, a)
  for (let i = 0; i < lastBar; i++) assert.equal(s.equity[i], ref.equity[i], `capital barre ${i}`)
  const idx = (u: Uint8Array) => Array.from(u.subarray(0, lastBar)).flatMap((x, i) => (x ? [i] : []))
  assert.deepEqual(s.entries.long.filter(i => i < lastBar), idx(ref.entryLong))
  assert.deepEqual(s.entries.short.filter(i => i < lastBar), idx(ref.entryShort))
  return { live: a.filter(p => p.entryIdx >= k0).length, total: a.length }
}

const costs: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.02, slippageTicks: 0, slippagePct: 0, mintick: 0.01, leverage: 3, maintenancePct: 0.5, fundingPct: 0.01 }

test('parité : adaptatif 15 min rejoué bougie par bougie = backtest', () => {
  const r = parity(adaptivePreset(15, 0.01), costs, 1000)
  assert.ok(r.live >= 2, `${r.live} positions ouvertes pendant la partie barre par barre`)
})

test('parité : un seul jeu (tes réglages), frais et glissement', () => {
  const cfg: ShockConfig = { sets: [withParams(DEFAULT_PARAMS, { ...USER_2026, htfMinutes: 240 })], adaptive: false, tfMin: 15, mintick: 0.01 }
  const r = parity(cfg, { ...costs, slippageTicks: 1, leverage: 1, fundingPct: 0 }, 900)
  assert.ok(r.live >= 2, `${r.live} positions ouvertes pendant la partie barre par barre`)
})
