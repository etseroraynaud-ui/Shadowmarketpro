// Contrôle de parité du protocole (§ 2), bloquant : le harnais de l'étude, appliqué à BTC avec le seuil
// figé, redonne exactement la sleeve BTC publiée de V1 (signaux, capital, trades, Sharpe de
// research/reports/reference/reference.json). Mesure aussi l'écart entre les coûts du moteur et les
// coûts appliqués après coup (facteur multiplicatif) sur ce même run.

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadBtc } from '../../lib/data.ts'
import { costsFor } from '../../lib/frozen-shock.ts'
import { referenceAsset } from '../../lib/regime-er.ts'
import { calmOnly } from '../../lib/calm-only.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import * as P from '../../lib/portfolio.ts'
import { resample } from '../../../lib/backtest/data.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { prepare } from '../../../lib/strategies/shock/market.ts'
import { universe, setsFor, v1Signals, withCostFn } from './harness.ts'
import { DAY } from './proxy-data.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** Empreintes des fichiers figés (copie de research/shock/reference.ts) + calm-only.ts. */
export const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}

export const sha256 = (b: string | Buffer) => createHash('sha256').update(b).digest('hex')

export function frozenChecks() {
  return Object.entries(FROZEN).map(([f, h]) => ({ name: `empreinte ${f}`, ok: sha256(readFileSync(join(ROOT, f))) === h, detail: f }))
}

export function btcParity() {
  const checks: { name: string; ok: boolean; detail: string }[] = []
  const ra = referenceAsset('btc')
  const refSig = calmOnly(ra.signals, ra.select)
  const ref = simulate(ra.m, ra.preset.sets, ra.costs(1), ra.lo, ra.end, ra.select, refSig)
  const u = universe(ra.bars, resample(loadBtc(60), DAY), 1)
  const kBtc = u.calm.kMain
  const { sets, select } = setsFor(u, ra.lo, ra.end, () => kBtc)
  let selDiff = 0, sigDiff = 0
  for (let i = ra.lo; i <= ra.end; i++) {
    const want = ra.select[i]
    if (select[i] !== want) selDiff++
  }
  const sig = v1Signals(u, sets, select, ra.lo, ra.end)
  for (let i = 0; i < u.bars.n; i++) if (sig.long[i] !== refSig.long[i] || sig.short[i] !== refSig.short[i]) sigDiff++
  checks.push({ name: 'sélection calme / agité identique à V1', ok: selDiff === 0, detail: `${selDiff} écarts` })
  checks.push({ name: 'entrées identiques à calmOnly(E2(frozen-shock))', ok: sigDiff === 0, detail: `${sigDiff} écarts` })
  const mine = simulate(u.m, sets, costsFor('btc', 1), ra.lo, ra.end, select, sig)
  let eqDiff = 0
  for (let i = 0; i < u.bars.n; i++) eqDiff = Math.max(eqDiff, Math.abs(mine.equity[i] - ref.equity[i]))
  checks.push({ name: 'capital identique à celui de V1 (coûts du moteur)', ok: eqDiff < 1e-6, detail: `écart max ${eqDiff.toExponential(2)}` })
  const pub = JSON.parse(readFileSync(join(ROOT, 'research/reports/reference/reference.json'), 'utf8')).reference.sleeves[0]
  const REF0 = Date.parse('2018-09-01'), REF1 = Date.parse('2026-10-01')
  const trades = mine.positions.filter(p => !p.exits.includes('END') && u.bars.t[p.entryIdx] >= REF0 && u.bars.t[p.entryIdx] < REF1).length
  checks.push({ name: 'trades de la sleeve BTC publiée', ok: trades === pub.trades, detail: `${trades} contre ${pub.trades}` })
  const d = dailyOf(u.bars, mine.equity, ra.lo, ra.end, Math.ceil(REF0 / DAY), Math.floor(REF1 / DAY) - 1)
  const sh = P.dailyMetrics(d.r, d.days).sharpe
  checks.push({ name: 'Sharpe de la sleeve BTC publiée', ok: Math.abs(sh - pub.sharpe) < 1e-6, detail: `${sh.toFixed(9)} contre ${pub.sharpe}` })
  // Coûts appliqués après coup contre coûts du moteur : même commission (0,045 % par exécution).
  const zero = simulate(u.m, sets, { ...costsFor('btc', 1), commissionPct: 0 }, ra.lo, ra.end, select, sig)
  const post = withCostFn(zero, () => 0.00045)
  const relFinal = post.equity[ra.end] / mine.equity[ra.end] - 1
  const dp = dailyOf(u.bars, post.equity, ra.lo, ra.end, Math.ceil(REF0 / DAY), Math.floor(REF1 / DAY) - 1)
  const shPost = P.dailyMetrics(dp.r, dp.days).sharpe
  checks.push({ name: 'coûts après coup ≈ coûts du moteur (capital final, Sharpe)', ok: Math.abs(relFinal) < 0.01 && Math.abs(shPost - sh) < 0.01, detail: `capital final ${(relFinal * 100).toFixed(4)} % · Sharpe ${shPost.toFixed(4)} contre ${sh.toFixed(4)}` })
  // Niveau de quantile que représente le seuil figé sur BTC (lecture seulement, privé).
  const z = prepare(u.m, u.calm).z
  const a = ra.lo, b = Math.min(ra.end, u.bars.n - 1)
  let below = 0, cnt = 0
  for (let i = a; i <= b; i++) { if (u.gap[i] || u.regime[i] !== 0 || u.bars.t[i] >= Date.parse('2026-10-04')) continue; cnt++; if (Math.abs(z[i]) <= kBtc) below++ }
  return { checks, private: { kBtc, qBtc: below / cnt, qBtcBars: cnt } }
}
