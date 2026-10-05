import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBtc, dayMs } from '../../research/lib/data.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import { adaptivePreset } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'
import { checkParity } from '../src/tools/parity.ts'
import { ShadowEngine } from '../src/engine/shadow.ts'
import { Journal } from '../src/journal.ts'

// Données au format du bot : ~5000 bougies 15 min (limite de l'API) et le journalier pour le régime.
const chart = sliceBars(loadBtc(15), dayMs('2023-05-01'), dayMs('2023-06-22'))
const daily = sliceBars(resample(loadBtc(60), 86400000), dayMs('2020-01-01'), dayMs('2023-06-22'))
const cfg = adaptivePreset(15, 1)
const costs: Costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: 1, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }

test('parité backtest / bot, décision par décision', () => {
  const r = checkParity(cfg, costs, chart, daily, 2500)
  assert.equal(r.ok, true, JSON.stringify(r, null, 1))
  assert.ok(r.decisions > 2000)
  assert.ok(r.signals >= 2, `${r.signals} signaux`)
  assert.ok(r.positionsBot >= 2)
})

test('shadow mode : mêmes trades que le backtest, journal écrit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'bot-'))
  const journal = new Journal(dir, 'shadow', true)
  const k0 = chart.n - 2500
  const head = { n: k0, t: chart.t.subarray(0, k0), o: chart.o.subarray(0, k0), h: chart.h.subarray(0, k0), l: chart.l.subarray(0, k0), c: chart.c.subarray(0, k0), v: chart.v.subarray(0, k0) }
  const eng = new ShadowEngine(cfg, costs, head, daily, journal)
  for (let i = k0; i < chart.n; i++) eng.onBar({ t: chart.t[i], o: chart.o[i], h: chart.h[i], l: chart.l[i], c: chart.c[i], v: chart.v[i] })
  const m = marketFor(chart, 15, 1)
  const ref = simulate(m, cfg.sets, costs, 0, chart.n - 1, selectFor(cfg, m, daily).select)
  const closedLive = ref.positions.filter(p => p.exitIdx >= k0 && p.exitIdx < chart.n - 1)
  const csv = readFileSync(join(dir, 'trades-shadow.csv'), 'utf8').trim().split('\n')
  assert.equal(csv.length - 1, closedLive.length)
  assert.match(csv[0], /^mode,side,entryTime,exitTime,entry,exit,qty,atr,regime,set,tag,shockZ,volumeZ,lambdaPct,mae,mfe,fees,funding,slippage,pnl,pnlPct,exits$/)
  const events = readFileSync(join(dir, readdirSync(dir).find(f => f.startsWith('events-'))!), 'utf8').trim().split('\n').map(l => JSON.parse(l))
  assert.equal(events.filter(e => e.type === 'bar').length, 2500)
  assert.ok(events.some(e => e.type === 'signal'))
})
