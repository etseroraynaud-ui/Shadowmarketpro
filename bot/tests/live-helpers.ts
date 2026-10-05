// Outils communs aux tests du moteur live : fenêtres BTC, configuration, faux exchange, lecture
// bougie par bougie comme le broker simulé, lecture des trades journalisés.

import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadBtc, dayMs } from '../../research/lib/data.ts'
import { resample, sliceBars } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset } from '../../lib/strategies/shock/live.ts'
import { loadConfig } from '../src/config.ts'
import { Journal } from '../src/journal.ts'
import { LiveEngine } from '../src/engine/live.ts'
import { StateStore } from '../src/engine/state.ts'
import { FakeExchange } from './fake-exchange.ts'

export const all15 = loadBtc(15)
export const allDaily = resample(loadBtc(60), 86400000)
export const windowOf = (from: string, to: string) => ({ chart: sliceBars(all15, dayMs(from), dayMs(to)), daily: sliceBars(allDaily, dayMs('2020-01-01'), dayMs(to)) })
// Fenêtre 1 : stops et flips, longs et shorts, deux régimes. Fenêtre 2 : TP1 puis stop suiveur.
export const W1 = windowOf('2023-05-01', '2023-06-22')
export const W2 = windowOf('2026-02-01', '2026-03-25')
export const shock = adaptivePreset(15, 1)
export const M15 = 15 * 60000
export const head = (b: Bars, k: number): Bars => ({ n: k, t: b.t.subarray(0, k), o: b.o.subarray(0, k), h: b.h.subarray(0, k), l: b.l.subarray(0, k), c: b.c.subarray(0, k), v: b.v.subarray(0, k) })

export function setup(over: Record<string, string> = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bot-live-'))
  const cfg = loadConfig({ BOT_MODE: 'testnet', HL_ACCOUNT_ADDRESS: '0x' + '1'.repeat(40), HL_AGENT_PRIVATE_KEY: '0x' + '2'.repeat(64), BOT_STATE_DIR: dir, BOT_LOG_DIR: join(dir, 'logs'), BOT_DATA_DIR: dir, BOT_MAX_NOTIONAL_USD: '1000000', BOT_TRAIL_STEP_PCT: '0', BOT_TRAIL_MIN_INTERVAL_MS: '0', ...over })
  const ex = new FakeExchange(10000, 0.045)
  const clock = { t: 0 }
  const journal = new Journal(cfg.logDir, 'testnet', true)
  const store = new StateStore(join(dir, 'state.json'))
  const opts = { cfg, shock, exchange: ex, journal, store, network: 'testnet' as const, now: () => clock.t, sleep: async () => {} }
  return { dir, cfg, ex, clock, journal, store, opts }
}

/** Une bougie jouée comme le broker simulé : ouverture (gap), extrême le plus proche, l'autre, clôture. */
export async function playBar(eng: LiveEngine, ex: FakeExchange, clock: { t: number }, i: number, chart = W1.chart) {
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

export function trades(dir: string) {
  const f = join(dir, 'logs', 'trades-testnet.csv')
  if (!existsSync(f)) return []
  const [hdr, ...rows] = readFileSync(f, 'utf8').trim().split('\n')
  const cols = hdr.split(',')
  return rows.map(r => Object.fromEntries(r.split(',').map((v, k) => [cols[k], v])))
}

/** Événements journalisés d'un type donné. */
export function events(dir: string, type?: string): Record<string, unknown>[] {
  const ld = join(dir, 'logs')
  if (!existsSync(ld)) return []
  const out: Record<string, unknown>[] = []
  for (const f of readdirSync(ld).filter(f => f.startsWith('events-'))) {
    for (const l of readFileSync(join(ld, f), 'utf8').trim().split('\n')) if (l) out.push(JSON.parse(l))
  }
  return type ? out.filter(e => e.type === type) : out
}
