import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runStrategy } from '../index.ts'
import { TEMPLATES } from '../templates.ts'
import { randomBars, settings } from './helpers.ts'
import { buildReport, equityCsv, robustOf, worstDrawdowns, TRADES_CSV_HEAD } from '../../../app/backtest/report.ts'
import type { ReportMeta } from '../../../app/backtest/report.ts'
import { DICTS } from '../../../app/backtest/i18n.ts'
import type { StrategySource } from '../index.ts'
import { runShockBacktest } from '../../strategies/shock/adapter.ts'
import { DEFAULT_PARAMS } from '../../strategies/shock/params.ts'

const bars = randomBars(1500, 3)
const source: StrategySource = { kind: 'script', code: TEMPLATES[0].script, overrides: {} }
const s = settings({ feePct: 0.1, splitTime: bars.t[1100] })
const out = runStrategy(bars, source, s)
const meta: ReportMeta = { market: 'TEST/USD', timeframe: '1D', preset: null, presetEdited: false, now: Date.UTC(2026, 9, 4) }
const report = (trades: 0 | 100 | 500 | 'all', lang: 'fr' | 'en' = 'fr') =>
  buildReport({ out, bars, settings: s, source, meta, lang, t: DICTS[lang], trades, robust: robustOf(bars, out, s) })

test('rapport : toutes les sections, sans valeur manquante', () => {
  assert.ok(out.result.trades.length > 5, `${out.result.trades.length} trades`)
  for (const lang of ['fr', 'en'] as const) {
    const md = report('all', lang)
    assert.doesNotMatch(md, /undefined|NaN|\[object/)
    const heads = md.split('\n').filter(l => l.startsWith('## ')).length
    assert.ok(heads >= 6, `${heads} sections`)
  }
  const md = report('all')
  for (const s of ['## Données', '## Stratégie', '## Exécution', '## Résultats', '### Rendements mensuels', '### Pires baisses', '### Robustesse', '### Échantillon / hors échantillon', '## Définitions']) assert.ok(md.includes(s), s)
  assert.ok(md.includes(TEMPLATES[0].script.split('\n')[0]))
})

test('rapport : nombre de trades inclus', () => {
  const n = out.result.trades.length
  const rows = (md: string) => md.split('\n').filter(l => /^\d+,(long|short),/.test(l)).length
  assert.equal(rows(report('all')), n)
  assert.equal(rows(report(0)), 0)
  assert.ok(report('all').includes(TRADES_CSV_HEAD))
  const few = Math.min(n, 5)
  const md = buildReport({ out: { ...out, result: { ...out.result, trades: out.result.trades.slice(0, few) } }, bars, settings: s, source, meta, lang: 'fr', t: DICTS.fr, trades: 100, robust: null })
  assert.equal(rows(md), few)
})

test('pires baisses : du sommet au retour au sommet, les plus profondes d\'abord', () => {
  const eq = Float64Array.from([100, 110, 99, 105, 111, 90, 95, 100])
  const dd = worstDrawdowns(eq, 0, eq.length - 1)
  assert.equal(dd.length, 2)
  assert.deepEqual([dd[0].peak, dd[0].trough, dd[0].recover], [4, 5, -1])
  assert.ok(Math.abs(dd[0].depth - (90 / 111 - 1)) < 1e-12)
  assert.deepEqual([dd[1].peak, dd[1].trough, dd[1].recover], [1, 2, 4])
})

test('capital jour par jour : une ligne par jour, même en données intraday', () => {
  const daily = equityCsv(bars, out).trim().split('\n')
  assert.equal(daily.length - 1, out.result.end - out.result.start + 1)
  const hourly = randomBars(24 * 10, 5)
  for (let i = 0; i < hourly.n; i++) hourly.t[i] = Date.UTC(2024, 0, 1) + i * 3600000
  const o = runStrategy(hourly, source, settings())
  const lines = equityCsv(hourly, o).trim().split('\n')
  assert.equal(lines.length - 1, 10)
  assert.match(lines[1], /^2024-01-01,/)
})

test('rapport Shock Engine : paramètres modifiés en gras, défaut du script à côté', () => {
  const hourly = randomBars(24 * 60, 9, 30000)
  const t0 = Date.UTC(2024, 0, 1)
  for (let i = 0; i < hourly.n; i++) hourly.t[i] = t0 + i * 3600000
  const spec = { kind: 'shock' as const, params: { ...DEFAULT_PARAMS, kMain: 2.6 }, adaptive: null }
  const st = settings({ feePct: 0.02, direction: 'both' })
  const o = runShockBacktest(hourly, spec, st)
  const md = buildReport({ out: o, bars: hourly, settings: st, source: spec, meta: { ...meta, preset: 'Script tel quel', presetEdited: true }, lang: 'fr', t: DICTS.fr, trades: 'all', robust: null })
  assert.match(md, /\| Main Shock Z \| \*\*2\.6\*\* \| 2\.2 \|/)
  assert.match(md, /Script tel quel \(modifié depuis\)/)
  assert.doesNotMatch(md, /undefined|NaN/)
})
