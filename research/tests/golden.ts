// Empreintes de référence du Shock Engine : positions, prix, frais, capital barre par barre, pour
// une série de configurations. Elles ont été prises avant la séparation stratégie / exécution ;
// toute modification qui change un seul résultat les fait échouer.
//
//   node research/tests/golden.ts --write   (régénère research/tests/golden-shock.json)

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { makeMarket, runShock, simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, REALISTIC_COSTS, USER_2026, withParams } from '../../lib/strategies/shock/params.ts'
import { WF30 } from '../../lib/strategies/shock/presets.ts'
import { runShockBacktest, SHOCK_PRESETS } from '../../lib/strategies/shock/adapter.ts'
import { DEFAULT_SETTINGS } from '../../lib/backtest/types.ts'
import type { BacktestResult } from '../../lib/backtest/types.ts'

export const GOLDEN_FILE = new URL('./golden-shock.json', import.meta.url)

const sha = (x: ArrayBufferView | string) =>
  createHash('sha256').update(typeof x === 'string' ? x : Buffer.from(x.buffer, x.byteOffset, x.byteLength)).digest('hex').slice(0, 24)

function ofRaw(r: ShockResult) {
  return {
    positions: r.positions.length,
    fills: r.fills,
    finalEquity: r.equity[r.end],
    liquidation: r.liquidation,
    positionsHash: sha(JSON.stringify(r.positions)),
    equityHash: sha(r.equity),
    positionHash: sha(r.position),
    entriesHash: sha(JSON.stringify([sha(r.entryLong), sha(r.entryShort)])),
  }
}

function ofSite(r: BacktestResult) {
  return {
    trades: r.trades.length,
    finalEquity: r.equity[r.end],
    tradesHash: sha(JSON.stringify(r.trades)),
    equityHash: sha(r.equity),
    metricsHash: sha(JSON.stringify(r.metrics)),
  }
}

export function computeGolden(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const hour = loadBtc(60)
  const b15 = loadBtc(15)
  const b30 = loadBtc(30)
  const b5 = loadBtc(5)
  const m15 = makeMarket(b15, 15, hour)
  const m30 = makeMarket(b30, 30, hour)
  const m5 = makeMarket(b5, 5, hour)
  const s15 = indexAtOrAfter(b15, dayMs('2017-01-01'))
  const s30 = indexAtOrAfter(b30, dayMs('2017-01-01'))

  out['15m script'] = ofRaw(runShock(m15, DEFAULT_PARAMS, SCRIPT_COSTS, s15, b15.n - 1))
  out['30m user2026'] = ofRaw(runShock(m30, withParams(DEFAULT_PARAMS, USER_2026), SCRIPT_COSTS, s30, b30.n - 1))
  out['30m wf30 realistic'] = ofRaw(runShock(m30, { ...DEFAULT_PARAMS, ...WF30 }, REALISTIC_COSTS, s30, b30.n - 1))
  out['5m script x100 (liquidation)'] = ofRaw(runShock(m5, DEFAULT_PARAMS, { ...SCRIPT_COSTS, leverage: 100, maintenancePct: 0.5 }, 3000, b5.n - 1))
  out['15m script x3 funding'] = ofRaw(runShock(m15, DEFAULT_PARAMS, { ...SCRIPT_COSTS, leverage: 3, maintenancePct: 0.5, fundingPct: 0.01 }, s15, b15.n - 1))

  // Deux jeux en alternance, et des entrées imposées (tests de timing).
  const sel = new Int8Array(b30.n)
  for (let i = 0; i < sel.length; i++) sel[i] = Math.floor(i / 500) % 3 === 2 ? -1 : Math.floor(i / 500) % 2
  out['30m two sets alternating'] = ofRaw(simulate(m30, [DEFAULT_PARAMS, withParams(DEFAULT_PARAMS, USER_2026)], SCRIPT_COSTS, s30, b30.n - 1, sel))
  const long = new Uint8Array(b15.n)
  const short = new Uint8Array(b15.n)
  for (let i = 0; i < b15.n; i++) { if (i % 97 === 0) long[i] = 1; if (i % 131 === 0) short[i] = 1 }
  out['15m override entries'] = ofRaw(runShock(m15, DEFAULT_PARAMS, SCRIPT_COSTS, s15, b15.n - 1, { long, short }))

  // Chemin du site (adaptateur) : préréglages, levier, financement, sens, fenêtre, validation.
  const site = (bars: typeof b15, id: string, over: Partial<typeof DEFAULT_SETTINGS> = {}) => {
    const pr = SHOCK_PRESETS.find(x => x.id === id)!
    const b = pr.build()
    const s = { ...DEFAULT_SETTINGS, direction: 'both' as const, feePct: 0.02, slippagePct: 0, ...over }
    return ofSite(runShockBacktest(bars, { kind: 'shock', params: b.params, adaptive: b.adaptive }, s).result)
  }
  out['site adaptive15'] = site(b15, 'adaptive15')
  out['site adaptive15 x3 funding split'] = site(b15, 'adaptive15', { leverage: 3, fundingPct: 0.01, splitTime: dayMs('2023-01-01') })
  out['site adaptive30 2022+'] = site(b30, 'adaptive30', { from: dayMs('2022-01-01') })
  out['site user2026 longs only'] = site(b30, 'user2026', { direction: 'long' })
  out['site script 5m'] = site(b5, 'script', { feePct: 0.1, slippagePct: 0.05 })
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = computeGolden()
  if (process.argv.includes('--write')) {
    writeFileSync(GOLDEN_FILE, JSON.stringify(g, null, 2) + '\n')
    console.log('écrit', GOLDEN_FILE.pathname)
  } else {
    const ref = JSON.parse(readFileSync(GOLDEN_FILE, 'utf8'))
    let ok = true
    for (const k of Object.keys(ref)) {
      const same = JSON.stringify(ref[k]) === JSON.stringify(g[k])
      if (!same) ok = false
      console.log(`${same ? 'identique' : 'DIFFÉRENT'}  ${k}`)
    }
    process.exit(ok ? 0 : 1)
  }
}
