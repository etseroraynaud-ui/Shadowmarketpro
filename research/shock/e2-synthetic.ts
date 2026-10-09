// Falsification de E2, test C : marchés BTC/ETH synthétiques par bootstrap de blocs calendaires
// communs. Pré-spécification : research/preregistration/e2-falsification.md (commitée avant tout calcul).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-synthetic.ts --check
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-synthetic.ts --L 7 --to 1000 [--workers 4]
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-synthetic.ts --report
//
// Chaque trajectoire : blocs de L jours tirés avec remise, les mêmes pour BTC et ETH ; bougies 15 min
// du jour source copiées à la même heure ; prix de chaque bloc = série source × constante qui la raccorde
// à la dernière clôture synthétique ; volume normalisé (volume / moyenne des 2 880 bougies précédentes).
// Puis Shock Engine complet, régime de volatilité et E2 recalculés, runs V0 et E2 (shorts masqués hors
// régime baissier). Résultats : research/reports/e2-falsification/synthetic/L{L}.jsonl, une ligne par
// trajectoire (reprise possible : les trajectoires déjà calculées sont sautées).

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { availableParallelism } from 'node:os'
import { execSync } from 'node:child_process'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import { loadBtc } from '../lib/data.ts'
import * as P from '../lib/portfolio.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset, marketFor } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import { classify, volatilitySelect } from '../../lib/strategies/shock/regimes.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/e2-falsification')
const RES = join(OUT, 'synthetic')
const PRESPEC = 'research/preregistration/e2-falsification.md'
const DAY = P.DAY, M15 = 15 * 60000, ANN = P.ANN
const POOL0 = Math.floor(Date.parse('2017-08-18') / DAY), POOL1 = Math.floor(Date.parse('2026-09-30') / DAY)
const T = POOL1 - POOL0 + 1
const LS = [1, 3, 7, 14, 30]
const VOL_NORM = 2880
const SIM_START = Date.parse('2018-09-01T00:00:00Z')
const seedOf = (L: number, j: number) => 20261014 + 1000003 * L + j

// ================================================================ source
interface Src { bars: Bars; vnorm: Float64Array; first: Int32Array; last: Int32Array }
function loadEth(): Bars {
  const text = gunzipSync(readFileSync(join(ROOT, 'research/data/ethusdt_15m.csv.gz'))).toString('latin1')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  for (const s of text.split('\n')) { if (!s || !/^\d/.test(s)) continue; const p = s.split(','), ts = +p[0]; if (t.length && ts <= t[t.length - 1]) continue; t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0)) }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}
function makeSrc(bars: Bars): Src {
  const n = bars.n, vnorm = new Float64Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const w = Math.min(i, VOL_NORM), mean = w ? sum / w : 0
    vnorm[i] = mean > 0 ? bars.v[i] / mean : 1
    sum += bars.v[i]
    if (i >= VOL_NORM) sum -= bars.v[i - VOL_NORM]
  }
  // Première et dernière bougie (+1) de chaque jour, indexées par jour Unix (−1 : pas de bougie).
  const d0 = Math.floor(bars.t[0] / DAY), d1 = Math.floor(bars.t[n - 1] / DAY)
  const first = new Int32Array(d1 - d0 + 2).fill(-1), last = new Int32Array(d1 - d0 + 2).fill(-1)
  for (let i = 0; i < n; i++) { const d = Math.floor(bars.t[i] / DAY) - d0; if (first[d] < 0) first[d] = i; last[d] = i + 1 }
  return { bars, vnorm, first: Object.assign(first, { d0 }) as Int32Array, last }
}
const dayRange = (s: Src, day: number) => { const d0 = (s.first as unknown as { d0: number }).d0, j = day - d0; return j < 0 || j >= s.first.length ? null : s.first[j] < 0 ? null : [s.first[j], s.last[j]] as [number, number] }

/**
 * Bougies d'une trajectoire : `days[q]` = jour source du jour synthétique `start + q` ; `blockStart[q]` vrai
 * au premier jour d'un bloc. Prix : constante par bloc qui raccorde la clôture source précédant le bloc à
 * la dernière clôture synthétique.
 */
function buildBars(s: Src, days: Int32Array, blockStart: Uint8Array, start: number, rawVolume: boolean): Bars {
  let n = 0
  for (let q = 0; q < days.length; q++) { const r = dayRange(s, days[q]); if (r) n += r[1] - r[0] }
  const t = new Float64Array(n), o = new Float64Array(n), h = new Float64Array(n), l = new Float64Array(n), c = new Float64Array(n), v = new Float64Array(n)
  const sb = s.bars
  let k = 0, scale = 1, lastClose = NaN, needScale = true
  for (let q = 0; q < days.length; q++) {
    if (blockStart[q]) needScale = true
    const r = dayRange(s, days[q])
    if (!r) continue
    if (needScale) {
      const prevSrc = sb.c[r[0] - 1]
      scale = Number.isNaN(lastClose) ? 1 : lastClose / prevSrc
      needScale = false
    }
    const shift = (start + q - days[q]) * DAY
    for (let i = r[0]; i < r[1]; i++) {
      t[k] = sb.t[i] + shift
      if (scale === 1) { o[k] = sb.o[i]; h[k] = sb.h[i]; l[k] = sb.l[i]; c[k] = sb.c[i] } else { o[k] = sb.o[i] * scale; h[k] = sb.h[i] * scale; l[k] = sb.l[i] * scale; c[k] = sb.c[i] * scale }
      v[k] = rawVolume ? sb.v[i] : s.vnorm[i]
      lastClose = c[k]
      k++
    }
  }
  return { n, t, o, h, l, c, v }
}

// ================================================================ moteur sur une série
interface Engine { bars: Bars; select: Int8Array; trend: Uint8Array; lo: number; end: number; runV0: ShockResult; runE2: ShockResult; long: Uint8Array; short: Uint8Array }
function engine(bars: Bars, mintick: number, simStart: number, costs: Costs, daily?: Bars): Engine {
  const m = marketFor(bars, 15, mintick), preset = adaptivePreset(15, mintick)
  const reg = classify(bars, 15, daily ?? resample(bars, DAY))
  const select = volatilitySelect(reg, bars.n, 0, 1).select
  const trend = new Uint8Array(bars.n)
  for (let i = 0; i < bars.n; i++) trend[i] = reg.id[i] >= 0 && reg.id[i] >> 1 === 2 ? 1 : 0
  let lo = 0
  while (lo < bars.n && bars.t[lo] < simStart) lo++
  const end = bars.n - 1
  const prs = preset.sets.map(p => prepare(m, p))
  const long = new Uint8Array(bars.n), short = new Uint8Array(bars.n), shortE2 = new Uint8Array(bars.n)
  for (let i = lo; i <= end; i++) {
    const e = select[i]
    if (e < 0 || (i > 0 && bars.t[i] - bars.t[i - 1] > M15)) continue
    const p = preset.sets[e], R = prs[e]
    if (p.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (p.allowShort && R.impulseEntryShort[i]) { short[i] = 1; if (trend[i]) shortE2[i] = 1 }
  }
  const runV0 = simulate(m, preset.sets, costs, lo, end, select, { long, short })
  const runE2 = simulate(m, preset.sets, costs, lo, end, select, { long, short: shortE2 })
  return { bars, select, trend, lo, end, runV0, runE2, long, short }
}

// ================================================================ mesures
function dailyVol(b: Bars) {
  const close = new Map<number, number>()
  for (let i = 0; i < b.n; i++) close.set(Math.floor(b.t[i] / DAY), b.c[i])
  const ds = [...close.keys()].sort((x, y) => x - y), out = new Map<number, number>(), lr: number[] = []
  for (let j = 1; j < ds.length; j++) { if (lr.length >= 30) out.set(ds[j], P.sd(lr.slice(-30))); lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0) }
  return out
}
interface RunStats { ev: number; nShort: number; sharpe: number; cagr: number; pf: number; dd: number }
function runStats(e: Engine, r: ShockResult, vol: Map<number, number>, days: number[]) {
  const t = e.bars.t
  const shorts = r.positions.filter(p => p.dir === -1 && !p.exits.includes('END') && p.entryIdx >= e.lo)
  const R = shorts.map(p => p.pnl / p.equityAtEntry / (vol.get(Math.floor(t[p.entryIdx] / DAY)) ?? NaN)).filter(Number.isFinite)
  let gp = 0, gl = 0
  for (const p of r.positions) if (p.entryIdx >= e.lo) { if (p.pnl > 0) gp += p.pnl; else gl -= p.pnl }
  const base = r.equity[e.lo - 1]
  const ret = P.returnsOf(P.dayCloses(t, r.equity, e.lo, e.end, days, base).eq, base)
  const m = P.dailyMetrics(ret, days)
  return { stats: { ev: R.length ? P.mean(R) : NaN, nShort: shorts.length, sharpe: m.sharpe, cagr: m.cagr, pf: gl > 0 ? gp / gl : NaN, dd: m.maxDD } as RunStats, ret, shorts }
}
function assetResult(e: Engine, days: number[]) {
  const vol = dailyVol(e.bars)
  const a = runStats(e, e.runV0, vol, days), b = runStats(e, e.runE2, vol, days)
  // D et part gardée : drapeau E2 à l'entrée des shorts V0.
  const t = e.bars.t
  const flagged = a.shorts.map(p => ({ R: p.pnl / p.equityAtEntry / (vol.get(Math.floor(t[p.entryIdx] / DAY)) ?? NaN), f: e.trend[p.entryIdx] })).filter(x => Number.isFinite(x.R))
  const g1 = flagged.filter(x => x.f).map(x => x.R), g0 = flagged.filter(x => !x.f).map(x => x.R)
  return { v0: a.stats, e2: b.stats, d: g1.length && g0.length ? P.mean(g1) - P.mean(g0) : NaN, keep: flagged.length ? g1.length / flagged.length : NaN, retV0: a.ret, retE2: b.ret }
}
const minticks = (b: Bars) => { let mn = Infinity; for (let i = 0; i < b.n; i++) mn = Math.min(mn, b.c[i]); return Math.pow(10, Math.floor(Math.log10(mn)) - 4) }
const costsOf = (key: 'btc' | 'ethusdt', mintick: number): Costs => ({ ...costsFor(key, 1), mintick })

/** Une trajectoire (ou l'identité de la source si `identity`) : résultats BTC, ETH et 50/50. */
function pathResult(SRC: { btc: Src; eth: Src }, L: number, j: number, identity = false) {
  const days = new Int32Array(T), bs = new Uint8Array(T)
  if (identity) { for (let q = 0; q < T; q++) days[q] = POOL0 + q; bs[0] = 1 } else {
    const rand = P.rng(seedOf(L, j))
    let q = 0
    while (q < T) { const s0 = POOL0 + Math.floor(rand() * (T - L + 1)); bs[q] = 1; for (let u = 0; u < L && q < T; u++) days[q++] = s0 + u }
  }
  const out: Record<string, ReturnType<typeof assetResult>> = {}
  const pdays: number[] = []
  for (let d = Math.floor(SIM_START / DAY); d <= POOL1; d++) pdays.push(d)
  for (const [key, src] of [['btc', SRC.btc], ['ethusdt', SRC.eth]] as const) {
    const bars = buildBars(src, days, bs, POOL0, false)
    const e = engine(bars, minticks(bars), SIM_START, costsOf(key, minticks(bars)))
    out[key] = assetResult(e, pdays)
  }
  const pf = (ra: number[], rb: number[]) => { const m = P.dailyMetrics(P.book(ra, rb).r, pdays); return { sharpe: m.sharpe, cagr: m.cagr, dd: m.maxDD } }
  const strip = (x: ReturnType<typeof assetResult>) => ({ v0: x.v0, e2: x.e2, d: x.d, keep: x.keep })
  return { j, L, btc: strip(out.btc), eth: strip(out.ethusdt), pf: { v0: pf(out.btc.retV0, out.ethusdt.retV0), e2: pf(out.btc.retE2, out.ethusdt.retE2), dEq: (out.btc.d + out.ethusdt.d) / 2 } }
}
const loadSources = () => ({ btc: makeSrc(loadBtc(15)), eth: makeSrc(loadEth()) })

// ================================================================ travailleur
if (!isMainThread) {
  const SRC = loadSources()
  const { L, js } = workerData as { L: number; js: number[] }
  for (const j of js) parentPort!.postMessage(pathResult(SRC, L, j))
  parentPort!.postMessage({ done: true })
} else main()

function main() {
  const args = process.argv.slice(2)
  const opt = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d }
  mkdirSync(RES, { recursive: true })
  if (args.includes('--check')) return check()
  if (args.includes('--report')) return report()
  const L = Number(opt('L', '7')), to = Number(opt('to', '1000')), from = Number(opt('from', '0'))
  const workers = Number(opt('workers', String(Math.max(1, availableParallelism()))))
  if (!LS.includes(L)) throw new Error(`longueur de bloc non prévue : ${L}`)
  const file = join(RES, `L${L}.jsonl`)
  const done = new Set(existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s).j) : [])
  const todo: number[] = []
  for (let j = from; j < to; j++) if (!done.has(j)) todo.push(j)
  process.stderr.write(`L = ${L} : ${todo.length} trajectoires à calculer (${done.size} déjà faites), ${workers} processus\n`)
  if (!todo.length) return
  const t0 = Date.now()
  let n = 0, active = workers
  for (let w = 0; w < workers; w++) {
    const js = todo.filter((_, i) => i % workers === w)
    const wk = new Worker(fileURLToPath(import.meta.url), { workerData: { L, js } })
    wk.on('message', (m: { done?: boolean }) => {
      if (m.done) { if (--active === 0) process.stderr.write(`L = ${L} : terminé en ${((Date.now() - t0) / 1000).toFixed(0)} s\n`); return }
      appendFileSync(file, JSON.stringify(m, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(8) : x)) + '\n')
      if (++n % 100 === 0) process.stderr.write(`L = ${L} : ${n}/${todo.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
    })
    wk.on('error', e => { process.stderr.write(`ÉCHEC travailleur : ${e.stack}\n`); process.exitCode = 1 })
  }
}

// ================================================================ contrôles
function check() {
  const SRC = loadSources()
  const lines: string[] = []
  const ok = (name: string, pass: boolean, detail: string) => { lines.push(`- ${pass ? '✔' : '✘'} ${name} · ${detail}`); process.stderr.write(`${pass ? 'OK' : 'ÉCHEC'} : ${name} · ${detail}\n`); return pass }
  // 1. Identité exacte : la source dans l'ordre, un seul bloc, volume brut, horodatages et mintick d'origine = v1.
  for (const key of ['btc', 'ethusdt'] as const) {
    const s = loadSleeve(key), src = key === 'btc' ? SRC.btc : SRC.eth
    const dA = Math.floor(s.bars.t[0] / DAY), dB = Math.floor(s.bars.t[s.bars.n - 1] / DAY)
    const days = Int32Array.from({ length: dB - dA + 1 }, (_, q) => dA + q), bs = new Uint8Array(days.length); bs[0] = 1
    const bars = buildBars(src, days, bs, dA, true)
    let same = bars.n === s.bars.n
    for (let i = 0; same && i < bars.n; i++) same = bars.t[i] === s.bars.t[i] && bars.o[i] === s.bars.o[i] && bars.h[i] === s.bars.h[i] && bars.l[i] === s.bars.l[i] && bars.c[i] === s.bars.c[i] && bars.v[i] === s.bars.v[i]
    ok(`${key === 'btc' ? 'BTC' : 'ETH'} : trajectoire identité = barres source`, same, `${bars.n} barres`)
    const mt = key === 'btc' ? 1 : 0.01
    const e = engine(bars, mt, s.bars.t[s.lo], costsOf(key, mt), key === 'btc' ? resample(loadBtc(60), DAY) : undefined)
    const ref = s.run(1)
    let selSame = true
    for (let i = 0; i < bars.n; i++) if (e.select[i] !== s.select[i]) { selSame = false; break }
    const eqSame = e.runV0.equity.every((x, i) => x === ref.equity[i]) && e.runV0.positions.length === ref.positions.length
    ok(`${key === 'btc' ? 'BTC' : 'ETH'} : moteur de la trajectoire identité = v1 exactement`, selSame && eqSame && e.lo === s.lo, `régime identique : ${selSame} ; equity barre par barre : ${eqSame} ; ${ref.positions.length} trades`)
    // Régime de BTC tiré des barres 15 min (comme sur les trajectoires) au lieu du fichier 60 min.
    // À historique égal (depuis 2012 pour les deux), le régime est identique barre par barre.
    if (key === 'btc') {
      const all = loadBtc(15)
      const a15 = volatilitySelect(classify(all, 15, resample(all, DAY)), all.n, 0, 1).select
      const a60 = volatilitySelect(classify(all, 15, resample(loadBtc(60), DAY)), all.n, 0, 1).select
      let diff = 0
      for (let i = 0; i < all.n; i++) if (a15[i] !== a60[i]) diff++
      ok('BTC : régime tiré des barres 15 min = régime tiré des barres 60 min, à historique égal', diff === 0, `${diff} barre(s) différente(s) sur ${all.n}`)
    }
  }
  // 2. Identité dans la construction des trajectoires (fenêtre commune, volume normalisé, mintick de la règle) : écart à la v1, rapporté.
  const id = pathResult(SRC, 0, 0, true)
  writeFileSync(join(RES, 'identity.json'), JSON.stringify(id, null, 1))
  lines.push(`- Trajectoire identité dans la construction du test (2017-08-18 → 2026-09-30, simulation dès le 2018-09-01, volume normalisé, mintick de la règle) : Sharpe 50/50 V0 ${id.pf.v0.sharpe.toFixed(3)} et E2 ${id.pf.e2.sharpe.toFixed(3)} ; EV short V0 BTC ${id.btc.v0.ev.toFixed(3)}, ETH ${id.eth.v0.ev.toFixed(3)} ; E2 BTC ${id.btc.e2.ev.toFixed(3)}, ETH ${id.eth.e2.ev.toFixed(3)}. Référence v1 publiée : Sharpe 50/50 1,726 (V0) et 1,880 (E2).`)
  // 3. Mêmes blocs pour BTC et ETH : la suite des jours est tirée une fois par trajectoire (vérifié par construction ; déterminisme).
  const a = pathResult(SRC, 7, 0), b = pathResult(SRC, 7, 0)
  ok('trajectoire déterministe (même graine → mêmes résultats)', JSON.stringify(a) === JSON.stringify(b), 'L = 7, j = 0, calculée deux fois')
  writeFileSync(join(RES, 'checks.md'), lines.join('\n') + '\n')
}

// ================================================================ rapport
function report() {
  const q = (xs: number[], f: number) => P.quantile(xs, f)
  const num = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—')
  const sgn = (x: number, d = 3) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + num(x, d) : '—')
  const pct = (x: number) => (Number.isFinite(x) ? `${Math.round(x * 100)} %` : '—')
  const id = JSON.parse(readFileSync(join(RES, 'identity.json'), 'utf8'))
  let commit = 'inconnu'
  try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim() } catch { /* hors git */ }
  type Row = ReturnType<typeof pathResult>
  const D = [
    { key: 'dEV', label: 'ΔEV short (σ)', f: (a: Row['btc']) => a.e2.ev - a.v0.ev, d: 3 },
    { key: 'dSharpe', label: 'ΔSharpe', f: (a: Row['btc']) => a.e2.sharpe - a.v0.sharpe, d: 2 },
    { key: 'dCAGR', label: 'ΔCAGR', f: (a: Row['btc']) => a.e2.cagr - a.v0.cagr, d: 3 },
    { key: 'dPF', label: 'ΔPF', f: (a: Row['btc']) => a.e2.pf - a.v0.pf, d: 2 },
    { key: 'dDD', label: 'ΔDD (> 0 : E2 baisse moins)', f: (a: Row['btc']) => a.e2.dd - a.v0.dd, d: 3 },
    { key: 'D', label: 'D (V0 : E2 − hors E2, σ)', f: (a: Row['btc']) => a.d, d: 3 },
    { key: 'keep', label: 'Part des shorts V0 gardée par E2', f: (a: Row['btc']) => a.keep, d: 2 },
  ]
  const L1: string[] = []
  L1.push('# Falsification Monte-Carlo de E2 · test C : marchés synthétiques', '')
  L1.push(`Pré-spécification : \`${PRESPEC}\`. Produit par \`node research/shock/e2-synthetic.ts\` (commit \`${commit.slice(0, 7)}\`). Blocs calendaires communs à BTC et ETH, tirés avec remise sur 2017-08-18 → 2026-09-30 ; moteur, régime et E2 recalculés sur chaque trajectoire ; simulation dès le 2018-09-01 synthétique. Chaque longueur de bloc est rapportée séparément.`, '')
  L1.push('« Historique » : la même construction appliquée à la source dans l\'ordre (trajectoire identité, volume normalisé, mintick de la règle), pour comparer à armes égales.', '')
  const summary: Record<string, unknown> = {}
  for (const L of LS) {
    const file = join(RES, `L${L}.jsonl`)
    if (!existsSync(file)) continue
    const rows: Row[] = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(s => JSON.parse(s))
    rows.sort((a, b) => a.j - b.j)
    L1.push(`## Blocs de ${L} jour${L > 1 ? 's' : ''} · ${rows.length} trajectoires`, '')
    const pfRow = (r: Row) => ({ v0: { ...r.pf.v0, ev: (r.btc.v0.ev + r.eth.v0.ev) / 2, pf: NaN }, e2: { ...r.pf.e2, ev: (r.btc.e2.ev + r.eth.e2.ev) / 2, pf: NaN }, d: r.pf.dEq, keep: (r.btc.keep + r.eth.keep) / 2 })
    const groups: [string, (r: Row) => Row['btc'], unknown][] = [['Portefeuille 50/50', r => pfRow(r) as unknown as Row['btc'], pfRow(id)], ['BTC', r => r.btc, id.btc], ['ETH', r => r.eth, id.eth]]
    L1.push('| Analyse | Mesure | P(> 0) | P5 | P10 | Médiane | P90 | P95 | Historique | Percentile de l\'historique |', '|---|---|---|---|---|---|---|---|---|---|')
    const sum: Record<string, unknown> = {}
    for (const [g, get, hist] of groups) {
      for (const m of D) {
        if (g === 'Portefeuille 50/50' && m.key === 'dPF') continue
        const xs = rows.map(r => m.f(get(r))).filter(Number.isFinite)
        if (!xs.length) continue
        const h = m.f(hist as Row['btc'])
        const pctl = xs.filter(x => x < h).length / xs.length
        L1.push(`| ${g} | ${m.label} | ${m.key === 'keep' ? '—' : pct(xs.filter(x => x > 0).length / xs.length)} | ${sgn(q(xs, 0.05), m.d)} | ${sgn(q(xs, 0.1), m.d)} | ${sgn(q(xs, 0.5), m.d)} | ${sgn(q(xs, 0.9), m.d)} | ${sgn(q(xs, 0.95), m.d)} | ${sgn(h, m.d)} | ${num(pctl * 100, 1)} |`)
        sum[`${g}|${m.key}`] = { n: xs.length, pPos: xs.filter(x => x > 0).length / xs.length, p5: q(xs, 0.05), p10: q(xs, 0.1), p50: q(xs, 0.5), p90: q(xs, 0.9), p95: q(xs, 0.95), hist: h, histPercentile: pctl }
      }
    }
    const pDD = rows.filter(r => r.pf.e2.dd > r.pf.v0.dd).length / rows.length
    L1.push('', `P(DD_E2 < DD_V0), portefeuille 50/50 : ${pct(pDD)} (drawdown de E2 moins profond). Shorts V0 par trajectoire (BTC + ETH) : médiane ${q(rows.map(r => r.btc.v0.nShort + r.eth.v0.nShort), 0.5)} ; E2 : ${q(rows.map(r => r.btc.e2.nShort + r.eth.e2.nShort), 0.5)}.`, '')
    summary[`L${L}`] = { n: rows.length, pDD, ...sum }
  }
  const checks = existsSync(join(RES, 'checks.md')) ? readFileSync(join(RES, 'checks.md'), 'utf8') : ''
  L1.push('## Contrôles', '', checks)
  writeFileSync(join(OUT, 'test-c.md'), L1.join('\n'))
  writeFileSync(join(OUT, 'test-c.json'), JSON.stringify({ prespec: PRESPEC, commit, identity: id, summary }, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(8) : x), 1))
  process.stderr.write(`écrit ${OUT}/test-c.{md,json}\n`)
}
