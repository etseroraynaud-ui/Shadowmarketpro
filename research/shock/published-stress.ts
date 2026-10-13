// Funding des perpétuels et glissement : stress du portefeuille publié (E2 sans nouvelles entrées en
// régime agité, research/lib/calm-only.ts), avec la méthode de research/shock/e2-diagnostics.ts § 3,
// validée d'abord en redonnant à l'identique les valeurs publiées pour E2.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/published-stress.ts
//
// Sortie : research/reports/published-stress/published-stress.{json,md}. Rien d'autre n'est calculé.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { costsFor } from '../lib/frozen-shock.ts'
import type { SleeveKey } from '../lib/frozen-shock.ts'
import { referenceAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { calmOnly } from '../lib/calm-only.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { PositionRecord } from '../../lib/strategies/shock/broker.ts'
import type { EntryOverride } from '../../lib/strategies/shock/strategy.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/published-stress')
const DAY = P.DAY, M15 = 15 * 60000, H8 = 8 * 3600000
const SLIPS = [0, 0.01, 0.02, 0.05]
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }

const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const A: Record<SleeveKey, Asset> = { btc: referenceAsset('btc'), ethusdt: referenceAsset('ethusdt') }
type Spec = 'published' | 'e2'
const OV: Record<Spec, (k: SleeveKey) => EntryOverride> = { published: k => calmOnly(A[k].signals, A[k].select), e2: k => A[k].signals }
const run = (spec: Spec, k: SleeveKey, slip = 0): ShockResult => simulate(A[k].m, A[k].preset.sets, { ...costsFor(k, 1), slippagePct: slip }, A[k].lo, A[k].end, A[k].select, OV[spec](k))

// ================================================================ portefeuille commun (convention de e2-diagnostics.ts)
const tStart = Math.max(...KEYS.map(k => A[k].bars.t[A[k].lo])), tEnd = Math.min(...KEYS.map(k => A[k].bars.t[A[k].end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const pdays: number[] = []
for (let d = PD0; d <= PD1; d++) pdays.push(d)
const idxAt = (k: SleeveKey, ms: number) => { const t = A[k].bars.t; let lo = 0, hi = A[k].bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const WIN = Object.fromEntries(KEYS.map(k => [k, { a: idxAt(k, PD0 * DAY), b: idxAt(k, (PD1 + 1) * DAY) - 1 }])) as Record<SleeveKey, { a: number; b: number }>
function sleeveDaily(k: SleeveKey, eq: Float64Array, cash?: Map<number, number>) {
  const { a, b } = WIN[k], base = eq[a - 1]
  const closes = P.dayCloses(A[k].bars.t, eq, a, b, pdays, base).eq
  const r = P.returnsOf(closes, base)
  if (cash) for (let j = 0; j < r.length; j++) { const c = cash.get(pdays[j]); if (c) r[j] += c / (j ? closes[j - 1] : base) }
  return r
}
const pfStats = (rb: number[], re: number[]) => { const r = P.book(rb, re).r, m = P.dailyMetrics(r, pdays); return { sharpe: m.sharpe, cagr: m.cagr, maxDD: m.maxDD } }

// ================================================================ funding
interface Ev { t: number; rate: number }
const readFunding = (f: string): Ev[] => readFileSync(join(ROOT, 'research/data/funding', f), 'utf8').trim().split('\n').slice(1).map(l => { const [t, r] = l.split(','); return { t: +t, rate: +r } })
const BIN = { btc: readFunding('binance-BTCUSDT.csv'), ethusdt: readFunding('binance-ETHUSDT.csv') }
const HL = { btc: readFunding('hyperliquid-BTC.csv'), ethusdt: readFunding('hyperliquid-ETH.csv') }
const F2020 = Date.parse('2020-01-01T00:00:00Z'), FHL = HL.btc[0].t
const constant = (from: number, to: number, rate: number): Ev[] => { const out: Ev[] = []; for (let t = Math.ceil(from / H8) * H8; t < to; t += H8) out.push({ t, rate }); return out }
const simStart = (k: SleeveKey) => A[k].bars.t[A[k].lo]
const fileEnd = (k: SleeveKey) => A[k].bars.t[A[k].end] + M15
const SCEN = {
  binance: (k: SleeveKey) => [...constant(simStart(k), F2020, 0.0001), ...BIN[k]],
  hyperliquid: (k: SleeveKey) => [...constant(simStart(k), F2020, 0.0001), ...BIN[k].filter(e => e.t < FHL), ...HL[k]],
  shortsPay: (k: SleeveKey) => constant(simStart(k), fileEnd(k), -0.0001),
}
type Scen = keyof typeof SCEN
function fundingOf(k: SleeveKey, p: PositionRecord, ev: Ev[], shortsOnly: boolean, byDay: Map<number, number>) {
  if (shortsOnly && p.dir !== -1) return
  const t = A[k].bars.t, c = A[k].bars.c, from = t[p.entryIdx] + M15, to = t[p.exitIdx]
  let lo = 0, hi = ev.length
  while (lo < hi) { const m = (lo + hi) >> 1; if (ev[m].t <= from) lo = m + 1; else hi = m }
  let bi = p.entryIdx
  for (let j = lo; j < ev.length && ev[j].t <= to; j++) {
    while (bi + 1 <= p.exitIdx && t[bi + 1] + M15 <= ev[j].t) bi++
    const f = -p.dir * ev[j].rate * p.qty * c[bi]
    const d = Math.floor(ev[j].t / DAY)
    byDay.set(d, (byDay.get(d) ?? 0) + f)
  }
}
const base = { published: { btc: run('published', 'btc'), ethusdt: run('published', 'ethusdt') }, e2: { btc: run('e2', 'btc'), ethusdt: run('e2', 'ethusdt') } }
const funding = (spec: Spec, sc: Scen) => {
  const shortsOnly = sc === 'shortsPay'
  const cash = KEYS.map(k => { const ev = SCEN[sc](k), m = new Map<number, number>(); for (const p of base[spec][k].positions) fundingOf(k, p, ev, shortsOnly, m); return m })
  return pfStats(sleeveDaily('btc', base[spec].btc.equity, cash[0]), sleeveDaily('ethusdt', base[spec].ethusdt.equity, cash[1]))
}
const slippage = (spec: Spec, sl: number) => { const r = { btc: run(spec, 'btc', sl), ethusdt: run(spec, 'ethusdt', sl) }; return pfStats(sleeveDaily('btc', r.btc.equity), sleeveDaily('ethusdt', r.ethusdt.equity)) }

// Validation de la méthode : E2 redonne les valeurs publiées par e2-diagnostics.ts.
const DG = JSON.parse(readFileSync(join(ROOT, 'research/reports/e2-diagnostics/e2-diagnostics.json'), 'utf8'))
const SC = Object.keys(SCEN) as Scen[]
for (const sc of SC) {
  const ref = DG.funding.find((f: { scenario: string }) => f.scenario === sc).e2, x = funding('e2', sc)
  check(`E2, funding ${sc} = e2-diagnostics`, Math.abs(x.sharpe - ref.sharpe) < 1e-8 && Math.abs(x.cagr - ref.cagr) < 1e-8 && Math.abs(x.maxDD - ref.maxDD) < 1e-8, `Sharpe ${x.sharpe.toFixed(9)} / ${ref.sharpe}`)
}
for (const sl of SLIPS) {
  const ref = DG.slippage.find((s: { slip: number }) => s.slip === sl).e2, x = slippage('e2', sl)
  check(`E2, glissement ${sl} % = e2-diagnostics`, Math.abs(x.sharpe - ref) < 1e-8, `${x.sharpe.toFixed(9)} / ${ref}`)
}
const pub = JSON.parse(readFileSync(join(ROOT, 'research/reports/reference/reference.json'), 'utf8')).reference
const s0 = slippage('published', 0)
check('portefeuille publié sans stress = fiche de référence', Math.abs(s0.sharpe - pub.sharpe) < 1e-8 && Math.abs(s0.cagr - pub.cagr) < 1e-8, `${s0.sharpe.toFixed(9)} / ${pub.sharpe}`)

const RES = {
  funding: SC.map(sc => ({ scenario: sc, published: funding('published', sc), e2: funding('e2', sc) })),
  slippage: SLIPS.map(sl => ({ slip: sl, published: slippage('published', sl).sharpe, e2: slippage('e2', sl).sharpe })),
}

// ================================================================ sorties
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/published-stress.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
writeFileSync(join(OUT, 'published-stress.json'), JSON.stringify({ generatedAt: new Date().toISOString(), git, method: 'research/shock/e2-diagnostics.ts § 3 (funding added to daily returns as a share of the previous close; slippage per order in the engine)', checks, ...RES }, null, 1) + '\n')
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number) => fr(x.toFixed(2)), pc = (x: number) => fr(`${x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(1)} %`)
const LABEL: Record<Scen, string> = { binance: 'funding historique Binance (+0,01 % / 8 h avant 2020)', hyperliquid: 'idem, Hyperliquid depuis mai 2023', shortsPay: 'stress : les shorts paient 0,01 % / 8 h' }
const L = ['# Funding et glissement : stress du portefeuille publié', '', `Méthode de \`research/shock/e2-diagnostics.ts\` § 3, validée en redonnant à l'identique les valeurs publiées pour E2 (contrôles ci-dessous). Commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}.`, '',
  '| Scénario | Sharpe | CAGR | Drawdown max. | Sharpe E2 (benchmark) |', '| --- | ---: | ---: | ---: | ---: |',
  `| sans funding | ${num(s0.sharpe)} | ${pc(s0.cagr)} | ${pc(s0.maxDD)} | ${num(slippage('e2', 0).sharpe)} |`,
  ...RES.funding.map(f => `| ${LABEL[f.scenario]} | ${num(f.published.sharpe)} | ${pc(f.published.cagr)} | ${pc(f.published.maxDD)} | ${num(f.e2.sharpe)} |`), '',
  '| Glissement par ordre | Sharpe | Sharpe E2 (benchmark) |', '| --- | ---: | ---: |', ...RES.slippage.map(s => `| ${fr(s.slip.toFixed(2))} % | ${num(s.published)} | ${num(s.e2)} |`), '',
  '## Contrôles', '', '| Contrôle | Résultat | Détail |', '| --- | ---: | ---: |', ...checks.map(c => `| ${c.name} | ${c.ok ? 'OK' : 'ÉCHEC'} | ${c.detail} |`), '',
  '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/published-stress.ts', '```', '']
writeFileSync(join(OUT, 'published-stress.md'), L.join('\n'))
process.stderr.write(`écrit ${OUT}\n`)
