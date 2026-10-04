import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { makeMarket, runShock, prepare, percentrank, sliceMarket } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, withParams } from '../../lib/strategies/shock/params.ts'
import { sma } from '../../lib/backtest/indicators.ts'

const tf = 15
const all = loadBtc(tf)
const hour = loadBtc(60)
const a = indexAtOrAfter(all, dayMs('2023-01-01'))
const b = indexAtOrAfter(all, dayMs('2023-07-01')) - 1
const m = sliceMarket(makeMarket(all, tf, hour), a - 3000, b)
const start = 3000
const end = m.bars.n - 1

test('percentrank = part des valeurs précédentes ≤ valeur courante', () => {
  const x = Float64Array.from({ length: 200 }, (_, i) => Math.sin(i * 0.7) + i * 0.01)
  const pr = percentrank(x, 20)
  for (let i = 20; i < 200; i++) {
    let c = 0
    for (let k = 1; k <= 20; k++) if (x[i - k] <= x[i]) c++
    assert.equal(pr[i], (100 * c) / 20)
  }
  assert.ok(Number.isNaN(pr[19]))
})

test('filtre 60 min : seulement des barres horaires closes à la clôture de la barre', () => {
  const p = DEFAULT_PARAMS
  const pr = prepare(m, p)
  const hs = sma(hour.c, p.htfEmaLen)
  const bars = m.bars
  for (let i = 100; i < bars.n; i += 37) {
    const closeT = bars.t[i] + tf * 60000
    let k = -1
    for (let j = 0; j < hour.n; j++) if (hour.t[j] + 3600000 <= closeT) k = j; else break
    assert.equal(pr.htfVal[i], hs[k], `barre ${i}`)
  }
})

test('causalité : mêmes entrées sur des données tronquées', () => {
  const full = runShock(m, DEFAULT_PARAMS, SCRIPT_COSTS, start, end)
  const cut = Math.floor((start + end) / 2)
  const short = runShock(sliceMarket(m, 0, cut), DEFAULT_PARAMS, SCRIPT_COSTS, start, cut)
  const e1 = full.positions.filter(p => p.exitIdx < cut).map(p => [p.entryIdx, p.dir, p.exitIdx, p.exits.join('+')].join(':'))
  const e2 = short.positions.filter(p => p.exitIdx < cut).map(p => [p.entryIdx, p.dir, p.exitIdx, p.exits.join('+')].join(':'))
  assert.ok(e1.length > 20)
  assert.deepEqual(e2, e1)
})

test('niveaux : stop à atrStopMult × ATR de l\'entrée, jamais dépassé hors gap', () => {
  const r = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, slippageTicks: 0, commissionPct: 0 }, start, end)
  let checked = 0
  for (const p of r.positions) {
    if (p.exits.length !== 1 || p.exits[0] !== 'SL') continue
    // Sortie au stop : perte d'environ 1,5 ATR par rapport au prix du signal (gap éventuel en plus).
    const lossAtr = (p.dir === 1 ? p.entryPrice - p.exitPrice : p.exitPrice - p.entryPrice) / p.atrAtEntry
    assert.ok(lossAtr >= DEFAULT_PARAMS.atrStopMult - 1e-6, `perte ${lossAtr}`)
    checked++
  }
  assert.ok(checked > 10)
})

test('coûts : commission et glissement réduisent le résultat', () => {
  const free = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, commissionPct: 0, slippageTicks: 0 }, start, end)
  const paid = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, commissionPct: 0.1 }, start, end)
  assert.ok(paid.equity[end] < free.equity[end])
})

test('artefact de pente 60 min : en 5 min, les longs n\'entrent qu\'autour du changement d\'heure', () => {
  const b5 = loadBtc(5)
  const a5 = indexAtOrAfter(b5, dayMs('2024-01-01'))
  const m5 = sliceMarket(makeMarket(b5, 5, hour), a5 - 3000, a5 + 40000)
  const minutesOf = (mode: 'chart' | 'htf') => {
    const r = runShock(m5, withParams(DEFAULT_PARAMS, { htfSlopeMode: mode }), SCRIPT_COSTS, 3000, m5.bars.n - 1)
    return new Set(r.positions.filter(p => p.dir === 1).map(p => new Date(m5.bars.t[p.entryIdx]).getUTCMinutes()))
  }
  const chart = minutesOf('chart')
  for (const mm of chart) assert.ok([55, 0, 5].includes(mm), `minute ${mm}`)
  assert.ok(minutesOf('htf').size > 6)
})

test('plusieurs jeux identiques en alternance = le script seul ; aucun jeu = aucune position', async () => {
  const { simulate } = await import('../../lib/strategies/shock/engine.ts')
  const ref = runShock(m, DEFAULT_PARAMS, SCRIPT_COSTS, start, end)
  const sel = new Int8Array(m.bars.n)
  for (let i = 0; i < sel.length; i++) sel[i] = i % 2
  const alt = simulate(m, [DEFAULT_PARAMS, { ...DEFAULT_PARAMS }], SCRIPT_COSTS, start, end, sel)
  assert.deepEqual(alt.positions.map(p => [p.entryIdx, p.exitIdx, p.dir]), ref.positions.map(p => [p.entryIdx, p.exitIdx, p.dir]))
  const none = simulate(m, [DEFAULT_PARAMS], SCRIPT_COSTS, start, end, new Int8Array(m.bars.n).fill(-1))
  assert.equal(none.positions.length, 0)
})

test('régimes : seulement des journées closes', async () => {
  const { classify } = await import('../../lib/strategies/shock/regimes.ts')
  const full = classify(m.bars, tf, hour)
  const cutT = m.bars.t[Math.floor(m.bars.n / 2)]
  const hourCut = sliceHour(cutT)
  const part = classify(m.bars, tf, hourCut)
  for (let i = 0; i < m.bars.n && m.bars.t[i] + tf * 60000 <= cutT; i++) assert.equal(part.id[i], full.id[i], `barre ${i}`)
})

function sliceHour(t: number) {
  let k = 0
  while (k < hour.n && hour.t[k] < t) k++
  return { n: k, t: hour.t.subarray(0, k), o: hour.o.subarray(0, k), h: hour.h.subarray(0, k), l: hour.l.subarray(0, k), c: hour.c.subarray(0, k), v: hour.v.subarray(0, k) }
}

test('adaptateur du site : mêmes positions que le moteur de recherche', async () => {
  const { runShockBacktest } = await import('../../lib/strategies/shock/adapter.ts')
  const { DEFAULT_SETTINGS } = await import('../../lib/backtest/types.ts')
  const b30 = loadBtc(30)
  const a30 = indexAtOrAfter(b30, dayMs('2023-01-01'))
  const e30 = indexAtOrAfter(b30, dayMs('2024-01-01')) - 1
  const s = { ...DEFAULT_SETTINGS, feePct: 0.02, slippagePct: 0, direction: 'both' as const, from: b30.t[a30], to: b30.t[e30] }
  const web = runShockBacktest(b30, { kind: 'shock', params: DEFAULT_PARAMS, adaptive: null }, s)
  const ref = runShock(makeMarket(b30, 30, hour), DEFAULT_PARAMS, { ...SCRIPT_COSTS, slippageTicks: 0 }, a30, e30)
  assert.ok(ref.positions.length > 50)
  const key = (x: { entryIdx: number; exitIdx: number }) => `${x.entryIdx}:${x.exitIdx}`
  const same = web.result.trades.filter(t => ref.positions.some(p => key(p) === key(t))).length
  assert.ok(same / ref.positions.length > 0.97, `${same} / ${ref.positions.length}`)
  assert.ok(Math.abs(web.result.metrics.totalReturn - (ref.equity[e30] / 10000 - 1)) < 0.05)
})

test('levier : sans levier, la marge de maintenance ne change rien ; à ×2, positions deux fois plus grosses', () => {
  const ref = runShock(m, DEFAULT_PARAMS, SCRIPT_COSTS, start, end)
  const mm = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, maintenancePct: 0.5 }, start, end)
  assert.deepEqual(Array.from(mm.equity), Array.from(ref.equity))
  assert.equal(mm.liquidation, null)
  const x2 = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, leverage: 2, maintenancePct: 0.5 }, start, end)
  assert.deepEqual(x2.positions.map(p => [p.entryIdx, p.exitIdx]), ref.positions.map(p => [p.entryIdx, p.exitIdx]))
  for (const p of x2.positions.slice(0, 20)) assert.ok(Math.abs(p.notional / p.equityAtEntry - 2) < 0.01)
})

test('levier extrême : liquidation, capital à zéro, plus aucune position ensuite', () => {
  const r = runShock(m, DEFAULT_PARAMS, { ...SCRIPT_COSTS, leverage: 100, maintenancePct: 0.5 }, start, end)
  assert.ok(r.liquidation)
  const last = r.positions[r.positions.length - 1]
  assert.equal(last.exits[last.exits.length - 1], 'LIQ')
  assert.equal(last.exitIdx, r.liquidation.i)
  for (let i = r.liquidation.i; i <= end; i++) assert.equal(r.equity[i], 0)
  // Long : liquidé sous l'entrée ; short : au-dessus.
  assert.ok(last.dir === 1 ? r.liquidation.price < last.entryPrice : r.liquidation.price > last.entryPrice)
})

test('financement positif : coûte aux longs, rapporte aux shorts', () => {
  const longs = withParams(DEFAULT_PARAMS, { allowShort: false })
  const a = runShock(m, longs, SCRIPT_COSTS, start, end)
  const f = runShock(m, longs, { ...SCRIPT_COSTS, fundingPct: 0.01 }, start, end)
  assert.ok(f.equity[end] < a.equity[end])
  const shorts = withParams(DEFAULT_PARAMS, { allowLong: false })
  const b = runShock(m, shorts, SCRIPT_COSTS, start, end)
  const g = runShock(m, shorts, { ...SCRIPT_COSTS, fundingPct: 0.01 }, start, end)
  assert.ok(g.equity[end] > b.equity[end])
})
