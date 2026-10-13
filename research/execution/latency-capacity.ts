// Étude d'exécution, phase 1 : la variante « latence » de l'étude de capacité recalculée avec la
// dérive mesurée aux instants de signal (research/preregistration/execution-phase1-latency.md, § 5).
//
// Même modèle de coût que research/capacity/capacity.ts (demi-spread médian, impact racine carrée
// du scénario, poursuite des stops dans le scénario prudent, ordre = moitié du capital) ; seule la
// dérive des entrées et des fermetures à la clôture change :
// - random2s : dérive à 2 s mesurée à des instants aléatoires (la variante publiée ; contrôle : ses
//   Sharpe doivent être reproduits) ;
// - signal{x}s : dérive moyenne mesurée aux instants de signal (entrées et FLIP réunis, par actif),
//   avec les bornes de son intervalle à 95 % ; 5 s ≈ le bot actuel, 0,5 à 2 s ≈ cibles d'ingénierie.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/execution/latency-capacity.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BINANCE_START, KEYS, OUT as CAP_OUT, ROOT, bootSharpe, crossing, loadPublished, monthDraws, netDaily, portfolio, q, sleeveDaily, statsOf, windowOf } from '../capacity/lib.ts'
import type { Fill, SleeveKey } from '../capacity/lib.ts'
import { buildEvents } from '../capacity/events.ts'
import type { Event } from '../capacity/events.ts'

const NAMED = [100e3, 250e3, 500e3, 1e6, 5e6]
const FINE = Array.from({ length: 30 }, (_, k) => 50e3 * Math.pow(100e6 / 50e3, k / 29))
const GRID = [...new Set([...NAMED, ...FINE])].sort((a, b) => a - b)
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

const { events, runs } = await buildEvents()
const S = loadPublished()
const W = windowOf(S, 'binance', BINANCE_START)
const base = { btc: sleeveDaily(runs.btc, W), ethusdt: sleeveDaily(runs.ethusdt, W) }
const pilot = JSON.parse(readFileSync(join(CAP_OUT, 'p1-pilot.json'), 'utf8'))
const pilotRandom = JSON.parse(readFileSync(join(CAP_OUT, 'p1-pilot-random.json'), 'utf8'))
const published = JSON.parse(readFileSync(join(CAP_OUT, 'p1-capacity.json'), 'utf8'))
const measured = JSON.parse(readFileSync(join(ROOT, 'research/reports/execution/latency-drift.json'), 'utf8'))
const HALF_SPREAD: Record<SleeveKey, number> = { btc: pilot.halfSpread.BTC.medianBps / 1e4, ethusdt: pilot.halfSpread.ETH.medianBps / 1e4 }
const STOP_CHASE_10S = pilot.stopChase['10s'].mean / 1e4

interface Scenario { name: string; Y: number; sigma: 'h24' | 'max'; tp1Paid: boolean; stopChase: boolean }
const SCENARIOS: Scenario[] = [
  { name: 'optimistic', Y: 0.5, sigma: 'h24', tp1Paid: false, stopChase: false },
  { name: 'central', Y: 1.0, sigma: 'h24', tp1Paid: false, stopChase: false },
  { name: 'prudent', Y: 2.0, sigma: 'max', tp1Paid: true, stopChase: true },
]

// Dérives (fraction) par variante et par actif.
const variants: Record<string, Record<SleeveKey, number>> = {
  random2s: { btc: pilotRandom.results.BTC['2s'].last.meanBps / 1e4, ethusdt: pilotRandom.results.ETH['2s'].last.meanBps / 1e4 },
}
for (const x of ['0.5s', '1s', '2s', '5s']) for (const [suffix, f] of [['', 'meanBps'], ['_lo', 'loBps'], ['_hi', 'hiBps']] as const) {
  variants[`signal${x}${suffix}`] = { btc: measured.results['BTC all'].driftBps[x][f] / 1e4, ethusdt: measured.results['ETH all'].driftBps[x][f] / 1e4 }
}

function cost(e: Event, A: number, sc: Scenario, drift: Record<SleeveKey, number>): number | null {
  const Q = e.frac * A / 2
  const hs = HALF_SPREAD[e.key]
  const sigma = sc.sigma === 'max' ? Math.max(e.sigma24, e.sigma60) : e.sigma24
  if (!(sigma > 0) || !(e.v24 > 0) || !Number.isFinite(e.ref)) return null
  const impact = sc.Y * sigma * Math.sqrt(Q / e.v24)
  if (e.family === 'entry' || e.family === 'close') return hs + impact + drift[e.key]
  if (!e.located) return null
  if (e.family === 'stop') return hs + impact + (sc.stopChase ? STOP_CHASE_10S : 0)
  return sc.tp1Paid ? hs + impact : 0
}

const fiOf = new Map<Fill, number>()
for (const k of KEYS) runs[k].fills.forEach((f, i) => fiOf.set(f, i))
const md = monthDraws(W.days, 2000)

function point(A: number, sc: Scenario, drift: Record<SleeveKey, number>, boot: boolean) {
  const c = new Map<string, number>()
  const missing: Event[] = []
  for (const e of events) { const v = cost(e, A, sc, drift); if (v != null) c.set(`${e.key}:${e.fi}`, v); else missing.push(e) }
  // Valeurs manquantes : médiane de l'actif et de la famille (comme capacity.ts).
  for (const e of missing) c.set(`${e.key}:${e.fi}`, q(events.filter(x => x.key === e.key && x.family === e.family && c.has(`${x.key}:${x.fi}`)).map(x => c.get(`${x.key}:${x.fi}`)!), 0.5))
  const nd = (k: SleeveKey) => netDaily(runs[k], W, base[k], (f: Fill) => c.get(`${k}:${fiOf.get(f)}`) ?? 0)
  const rb = nd('btc'), re = nd('ethusdt')
  const st = statsOf(portfolio(rb, re), W.days)
  const bs = boot ? bootSharpe(rb, re, md) : null
  return { A, sharpe: st.sharpe, cagr: st.cagr, sortino: st.sortino, maxDD: st.maxDD, ...(bs ? { sharpeP5: q(bs, 0.05), sharpeP95: q(bs, 0.95) } : {}) }
}

const out: Record<string, Record<string, unknown>> = {}
for (const [name, drift] of Object.entries(variants)) {
  out[name] = { driftBps: { BTC: drift.btc * 1e4, ETH: drift.ethusdt * 1e4 } }
  for (const sc of SCENARIOS) {
    const curve = GRID.map(A => point(A, sc, drift, false))
    out[name][sc.name] = {
      named: NAMED.map(A => point(A, sc, drift, !name.endsWith('_lo') && !name.endsWith('_hi'))),
      capacitySharpe15: crossing(GRID, curve.map(p => p.sharpe), 1.5, true),
    }
  }
  log(`${name} : BTC ${(drift.btc * 1e4).toFixed(2)} pb, ETH ${(drift.ethusdt * 1e4).toFixed(2)} pb · central 1 M$ Sharpe ${((out[name].central as { named: { sharpe: number }[] }).named[3].sharpe).toFixed(3)} · capacité 1,5 ${((out[name].central as { capacitySharpe15: number }).capacitySharpe15 / 1e6).toFixed(2)} M$`)
}

// Contrôle : la variante publiée est reproduite (Sharpe aux mêmes capitaux).
const pub = published.sensitivity?.latency2s ?? published.exploratory.latency2s
const check = SCENARIOS.map(sc => {
  const mine = out.random2s[sc.name] as { named: { A: number; sharpe: number }[] }
  const theirs = (pub[sc.name] as { A: number; sharpe: number }[]).filter(p => NAMED.includes(p.A))
  const diff = Math.max(...theirs.map(p => Math.abs(p.sharpe - mine.named.find(m => m.A === p.A)!.sharpe)))
  return { scenario: sc.name, maxAbsSharpeDiff: diff, ok: diff < 1e-6 }
})
log(`contrôle de reproduction : ${check.map(c => `${c.scenario} ${c.ok ? 'OK' : 'ÉCART ' + c.maxAbsSharpeDiff}`).join(', ')}`)
writeFileSync(join(ROOT, 'research/reports/execution/latency-capacity.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), prespec: 'research/preregistration/execution-phase1-latency.md § 5',
  note: 'Dérive aux instants de signal : moyenne entrées + FLIP par actif (choix fixé avant lecture des mesures). _lo / _hi : bornes de l\'intervalle à 95 % de cette moyenne.',
  reproductionCheck: check, variants: out,
}, null, 1))
