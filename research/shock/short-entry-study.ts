// Étude pré-enregistrée de l'entrée des shorts : research/preregistration/short-entry-v1.1.md
// (commit 6b91ec7, avant tout calcul). Ce script applique ce document tel quel.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/short-entry-study.ts
//
// 1. Contrôles : empreintes des fichiers figés, reproduction de la v1 (BTC, ETH, portefeuille),
//    reconstruction exacte des entrées du moteur, causalité du filtre journalier. Un échec arrête
//    le script avant toute lecture de résultat.
// 2. Variantes : masques sur la liste des entrées short passée au moteur (argument `override` de
//    simulate) ; rien d'autre ne change (longs, sorties, sizing, régime, coûts, paramètres).
// 3. Décision : mesure principale R = (PnL net / equity à l'entrée) / σ journalière, sur les 8
//    actifs vierges ; bootstrap par mois civils tirés en commun ; règle et garde-fous du § 6.
// 4. Sorties : research/reports/short-entry-study/short-entry-study.{md,json}.

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SLEEVES, costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import type { SleeveKey } from '../lib/frozen-shock.ts'
import { loadBtc } from '../lib/data.ts'
import { metricsOf } from '../lib/stats.ts'
import * as P from '../lib/portfolio.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import type { ShockConfig } from '../../lib/strategies/shock/live.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import type { Market, Prepared } from '../../lib/strategies/shock/market.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'
import type { Costs } from '../../lib/strategies/shock/params.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/short-entry-study')
const PREREG = 'research/preregistration/short-entry-v1.1.md'
const PREREG_COMMIT = '6b91ec7'
const DAY = P.DAY, M15 = 15 * 60000, ANN = P.ANN
const NBOOT = 10000
const SEED = 20261008
const VOL_DAYS = 30
const HALF_END = Math.floor(Date.parse('2022-09-15') / DAY) // dernier jour de la première moitié
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const stopIfFailed = (stage: string) => {
  const bad = checks.filter(c => !c.ok)
  if (bad.length) throw new Error(`${stage} : ${bad.length} contrôle(s) en échec, aucun résultat calculé : ${bad.map(c => c.name).join(' ; ')}`)
}

// ================================================================ 1. empreintes (§ 0)
const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
  'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
  'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
  'lib/strategies/shock/live.ts': '05caf82ece9ad7f8c355f0390bbda4fe6e3bffe1802933d0952b5c3dc10edeb2',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
}
const sha256 = (f: string) => createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha256(f) === h, sha256(f).slice(0, 16))
stopIfFailed('empreintes')

// ================================================================ 2. actifs
interface Asset {
  key: string
  label: string
  /** Actif vierge (confirmatoire) ou déjà vu (descriptif). */
  unseen: boolean
  bars: Bars
  m: Market
  preset: ShockConfig
  select: Int8Array
  lo: number
  end: number
  signals: { long: Uint8Array; short: Uint8Array }
  costs: (k: number) => Costs
  regimeBars: Bars
  mintick: number
  gaps: number
}

const gapsIn = (t: Float64Array, a: number, b: number) => { let g = 0; for (let i = Math.max(a, 1); i <= b; i++) if (t[i] - t[i - 1] > M15) g++; return g }

function fromSleeve(key: SleeveKey): Asset {
  const s = loadSleeve(key)
  const regimeBars = key === 'btc' ? resample(loadBtc(60), DAY) : resample(s.bars, DAY)
  return {
    key: key === 'btc' ? 'BTC' : 'ETH', label: SLEEVES[key].label + ' · ' + SLEEVES[key].venue, unseen: false,
    bars: s.bars, m: s.m, preset: s.preset, select: s.select, lo: s.lo, end: s.end, signals: s.signals,
    costs: k => costsFor(key, k), regimeBars, mintick: SLEEVES[key].mintick, gaps: gapsIn(s.bars.t, s.lo, s.end),
  }
}

/** Lecteur CSV de zero-shot.ts / frozen-shock.ts (horodatage ms UTC à l'ouverture, o, h, l, c, v). */
function loadCsv(path: string): Bars {
  const text = gunzipSync(readFileSync(path)).toString('latin1')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  let dup = 0
  for (const s of text.split('\n')) {
    if (!s || !/^\d/.test(s)) continue
    const p = s.split(',')
    const ts = +p[0]
    if (t.length && ts <= t[t.length - 1]) { dup++; continue }
    t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0))
  }
  if (dup) throw new Error(`${path} : ${dup} horodatages non croissants`)
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

const UNSEEN = ['XRP', 'BNB', 'DOGE', 'TRX', 'ADA', 'LINK', 'XLM', 'LTC']
const END_MS = Date.parse('2026-10-01T00:00:00Z')

/** `dropOffGrid` : contrôle de sensibilité seulement (§ Écarts), retire les bougies hors grille 15 min. */
function loadUnseen(sym: string, dropOffGrid = false): Asset {
  const all = loadCsv(join(ROOT, `research/data/${sym.toLowerCase()}usdt_15m.csv.gz`))
  const keep: number[] = []
  for (let i = 0; i < all.n && all.t[i] < END_MS; i++) if (!dropOffGrid || all.t[i] % M15 === 0) keep.push(i)
  const n = keep.length
  const cut = (x: Float64Array) => Float64Array.from(keep, i => x[i])
  const bars: Bars = { n, t: cut(all.t), o: cut(all.o), h: cut(all.h), l: cut(all.l), c: cut(all.c), v: cut(all.v) }
  const t = bars.t
  // Début : premier jour du mois qui suit (première barre + 365 jours), règle d'ETH et de SOL.
  const d = new Date(t[0] + 365 * DAY)
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  let lo = 0
  while (lo < n && t[lo] < start) lo++
  const end = n - 1
  let minC = Infinity
  for (let i = lo; i <= end; i++) minC = Math.min(minC, bars.c[i])
  const mintick = Math.pow(10, Math.floor(Math.log10(minC)) - 4)
  const m = marketFor(bars, 15, mintick)
  const preset = adaptivePreset(15, mintick)
  const regimeBars = resample(bars, DAY)
  const select = selectFor(preset, m, regimeBars).select!
  // Entrées du préréglage, bougie qui suit un trou exclue : la boucle de loadSleeve().
  const prs = preset.sets.map(p => prepare(m, p))
  const long = new Uint8Array(n), short = new Uint8Array(n)
  for (let i = lo; i <= end; i++) {
    const e = select[i]
    const gap = i > 0 && t[i] - t[i - 1] > M15
    if (e < 0 || gap) continue
    const p = preset.sets[e], R = prs[e]
    if (p.allowLong && R.impulseEntryLong[i]) long[i] = 1
    if (p.allowShort && R.impulseEntryShort[i]) short[i] = 1
  }
  const costs = (k: number): Costs => ({ capital: 10000, qtyPct: 100, commissionPct: 0.045 * k, slippageTicks: 0, slippagePct: 0.01 * k, mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 })
  return { key: sym, label: `${sym}/USDT · Binance spot`, unseen: true, bars, m, preset, select, lo, end, signals: { long, short }, costs, regimeBars, mintick, gaps: gapsIn(t, lo, end) }
}

const ASSETS: Asset[] = [fromSleeve('btc'), fromSleeve('ethusdt'), ...UNSEEN.map(s => loadUnseen(s))]
const UN = ASSETS.filter(a => a.unseen)
log('actifs chargés')

// Écart au plan (voir le rapport) : le contrôle de grille porte sur la fenêtre simulée. Les bougies
// hors grille du préchauffage (panne Binance des 9-10 février 2018 pour BNB et LTC) sont gardées
// telles quelles et comptées ; le contrôle de sensibilité plus bas montre qu'elles ne changent rien
// dans la fenêtre simulée.
const OFF_WARM: Record<string, { n: number; first: string; last: string }> = {}
for (const a of UN) {
  const t = a.bars.t
  let off = 0, offWarm = 0, first = -1, last = -1
  for (let i = 0; i < a.bars.n; i++) {
    if (t[i] % M15 === 0) continue
    if (i >= a.lo) off++
    else { offWarm++; if (first < 0) first = t[i]; last = t[i] }
  }
  if (offWarm) OFF_WARM[a.key] = { n: offWarm, first: new Date(first).toISOString(), last: new Date(last).toISOString() }
  check(`${a.key} : horodatages de la fenêtre simulée sur la grille 15 min UTC, croissants, sans doublon`, off === 0, `${a.end - a.lo + 1} barres simulées, ${off} hors grille, ${a.gaps} trous ; préchauffage : ${offWarm} bougie(s) hors grille`)
  const lastBar = new Date(t[a.end]).toISOString()
  check(`${a.key} : fenêtre jusqu'au 2026-09-30`, lastBar.startsWith('2026-09-30'), `dernière barre ${lastBar}`)
}

// ================================================================ 3. composantes et variantes (§ 3)
const VARIANTS = ['V0', 'V1', 'V2', 'V3', 'V4', 'E1', 'E2'] as const
type V = typeof VARIANTS[number]
const LABEL: Record<V, string> = {
  V0: 'V0 · v1 inchangée', V1: 'V1 · symétrie bougie', V2: 'V2 · symétrie tendance 60 min', V3: 'V3 · V1 + V2 (principale)',
  V4: 'V4 · sans shorts', E1: 'E1 · lambda + volume miroir (exploratoire)', E2: 'E2 · tendance journalière baissière (exploratoire)',
}

const memoGet = (m: Market, key: string) => {
  const v = m.memo.get(key)
  if (!v) throw new Error(`série ${key} absente du cache du moteur`)
  return v
}

interface Masks { short: Record<V, Uint8Array>; trendDown: Uint8Array }

function masks(a: Asset): Masks {
  const { m, preset, select, lo, end } = a
  const { o, h, l, c } = m.bars
  const n = m.bars.n
  const prs: Prepared[] = []
  const htfPrev: Float64Array[] = []
  for (const p of preset.sets) {
    prs.push(prepare(m, p))
    htfPrev.push(memoGet(m, `htfPrev:${p.htfMinutes}:${p.htfEmaLen}:${p.htfSlopeMode}:${p.htfSlopeBars}`) as Float64Array)
  }
  // Reconstruction exacte des entrées du moteur à partir des composantes (contrôle du § 9) : les
  // miroirs ci-dessous sont construits sur ces mêmes séries.
  preset.sets.forEach((p, e) => {
    const R = prs[e]
    const effKMicro = p.highActivityMode ? Math.max(p.kMicro - 0.2, 0.8) : p.kMicro
    const effUseCompression = p.highActivityMode ? false : p.useCompression
    const shockKey = `${p.volWin}:${p.kMain}:${p.useMicroShock}:${effKMicro}`
    const r = memoGet(m, 'r'), shock = memoGet(m, `shock:${shockKey}`)
    const hh = memoGet(m, `hh:${p.rangeWin}`), ll = memoGet(m, `ll:${p.rangeWin}`), atrZ = memoGet(m, `atrZ:${p.atrLen}:${p.atrZWin}`)
    let bad = 0, nL = 0, nS = 0
    for (let i = lo; i <= end; i++) {
      const sh = shock[i] === 1
      const posShock = sh && r[i] > 0, negShock = sh && r[i] < 0
      const rng = Math.max(h[i] - l[i], m.mintick)
      const upW = (h[i] - Math.max(o[i], c[i])) / rng, dnW = (Math.min(o[i], c[i]) - l[i]) / rng
      const hhPrev = i > 0 && !Number.isNaN(hh[i - 1]) ? hh[i - 1] : hh[i]
      const llPrev = i > 0 && !Number.isNaN(ll[i - 1]) ? ll[i - 1] : ll[i]
      const bodyShare = Math.abs(c[i] - o[i]) / rng, closePos = (c[i] - l[i]) / rng
      const iL = posShock && c[i] > hhPrev && upW < p.wickThr && bodyShare > 0.55 && closePos > 0.75
      const iS = negShock && c[i] < llPrev && dnW < p.wickThr
      const hv = R.htfVal[i]
      const bullStrong = c[i] > hv && hv > htfPrev[e][i]
      const htfShortOK = !p.useHTF || c[i] < hv
      const volImpulseOK = !p.useVolFilter || R.volZ[i] > p.volZThr
      const compressionOK = !effUseCompression || atrZ[i] < p.compThr
      const longRegimeOK = R.lamPct[i] > p.longLamPct && R.volZ[i] > 0
      const eL = p.useImpulse && iL && bullStrong && longRegimeOK && volImpulseOK && compressionOK
      const eS = p.useImpulse && iS && htfShortOK && volImpulseOK && compressionOK
      if (+iL !== R.impulseLong[i] || +iS !== R.impulseShort[i] || +eL !== R.impulseEntryLong[i] || +eS !== R.impulseEntryShort[i]) bad++
      nL += +eL; nS += +eS
    }
    check(`${a.key} jeu ${e === 0 ? 'calme' : 'agité'} : entrées reconstruites = moteur, barre par barre`, bad === 0, `${end - lo + 1} barres, ${bad} écart(s) ; ${nL} entrées long et ${nS} entrées short brutes`)
  })

  // Régime : la même classification que le moteur (même source journalière).
  const reg = classify(m.bars, 15, a.regimeBars)
  let selBad = 0
  for (let i = 0; i < n; i++) { const id = reg.id[i]; if ((id < 0 ? -1 : id % 2) !== select[i]) selBad++ }
  check(`${a.key} : régime recalculé = régime du moteur`, selBad === 0, `${selBad} écart(s) sur ${n} barres`)
  const trendDown = new Uint8Array(n)
  for (let i = 0; i < n; i++) trendDown[i] = reg.id[i] >= 0 && reg.id[i] >> 1 === 2 ? 1 : 0

  const s0 = a.signals.short
  const out = Object.fromEntries(VARIANTS.map(v => [v, new Uint8Array(n)])) as Record<V, Uint8Array>
  let calmOnly = true
  for (let i = lo; i <= end; i++) {
    if (!s0[i]) continue
    const e = select[i]
    if (e !== 0) calmOnly = false
    const p = preset.sets[e], R = prs[e]
    const rng = Math.max(h[i] - l[i], m.mintick)
    const bodyShare = Math.abs(c[i] - o[i]) / rng, closePos = (c[i] - l[i]) / rng
    const v1 = bodyShare > 0.55 && closePos < 0.25
    const v2 = R.htfVal[i] < htfPrev[e][i]
    const e1 = R.lamPct[i] > p.longLamPct && R.volZ[i] > 0
    out.V0[i] = 1
    out.V1[i] = v1 ? 1 : 0
    out.V2[i] = v2 ? 1 : 0
    out.V3[i] = v1 && v2 ? 1 : 0
    out.E1[i] = e1 ? 1 : 0
    out.E2[i] = trendDown[i]
  }
  check(`${a.key} : tous les shorts v1 viennent du jeu calme`, calmOnly, 'le jeu agité n\'autorise pas les shorts')
  let notSubset = 0
  for (const v of VARIANTS) for (let i = 0; i < n; i++) if (out[v][i] && !s0[i]) notSubset++
  check(`${a.key} : chaque variante est un sous-ensemble des shorts v1`, notSubset === 0, VARIANTS.map(v => `${v} ${P.sum(out[v])}`).join(', '))
  return { short: out, trendDown }
}

const MASKS = new Map<string, Masks>(ASSETS.map(a => [a.key, masks(a)]))
log('variantes construites')

// Causalité du filtre journalier (E2) : tronquer l'historique après la barre i ne change pas la décision en i.
{
  const a = UN[0], mk = MASKS.get(a.key)!
  let bad = 0, tested = 0
  for (let j = 1; j <= 12; j++) {
    const i = a.lo + Math.floor(((a.end - a.lo) * j) / 13)
    const cut = (x: Float64Array) => x.slice(0, i + 1)
    const tb: Bars = { n: i + 1, t: cut(a.bars.t), o: cut(a.bars.o), h: cut(a.bars.h), l: cut(a.bars.l), c: cut(a.bars.c), v: cut(a.bars.v) }
    const id = classify(tb, 15, resample(tb, DAY)).id[i]
    const td = id >= 0 && id >> 1 === 2 ? 1 : 0
    tested++
    if (td !== mk.trendDown[i]) bad++
  }
  check(`${a.key} : filtre journalier E2 causal (historique tronqué après la barre)`, bad === 0, `${tested} barres testées, ${bad} écart(s)`)
}
// Sensibilité aux bougies hors grille du préchauffage : sans elles, le régime et toutes les listes
// d'entrées de la fenêtre simulée sont identiques, barre par barre (même horodatage).
for (const key of Object.keys(OFF_WARM)) {
  const a = UN.find(x => x.key === key)!, mk = MASKS.get(key)!
  const b = loadUnseen(key, true)
  b.key = `${key} sans bougies hors grille`
  const mb = masks(b)
  let bad = 0
  const shift = a.lo - b.lo
  const same = b.lo >= 0 && a.end - a.lo === b.end - b.lo && b.bars.t[b.lo] === a.bars.t[a.lo] && b.bars.t[b.end] === a.bars.t[a.end]
  if (same) for (let i = a.lo; i <= a.end; i++) {
    const j = i - shift
    if (a.bars.t[i] !== b.bars.t[j] || a.select[i] !== b.select[j] || a.signals.long[i] !== b.signals.long[j]) { bad++; continue }
    if (VARIANTS.some(v => mk.short[v][i] !== mb.short[v][j])) bad++
  }
  check(`${key} : les ${OFF_WARM[key].n} bougies hors grille du préchauffage ne changent ni le régime ni les entrées de la fenêtre simulée`, same && bad === 0, `${OFF_WARM[key].first} → ${OFF_WARM[key].last} ; ${a.end - a.lo + 1} barres comparées, ${bad} écart(s)`)
}
stopIfFailed('contrôles des variantes')

// ================================================================ 4. simulations
const KS = [1, 2] as const
const RUNS = new Map<string, ShockResult>()
const runKey = (a: string, v: V, k: number) => `${a}|${v}|${k}`
for (const a of ASSETS) {
  const mk = MASKS.get(a.key)!
  const overrides = VARIANTS.map(v => ({ long: a.signals.long, short: mk.short[v] }))
  // Les longs : la même liste d'entrées long est passée au moteur pour toutes les variantes.
  check(`${a.key} : liste des entrées long identique dans toutes les variantes`, overrides.every(o => o.long === a.signals.long), `${P.sum(a.signals.long)} entrées long, même tableau pour les ${VARIANTS.length} variantes`)
  VARIANTS.forEach((v, j) => {
    for (const k of KS) RUNS.set(runKey(a.key, v, k), simulate(a.m, a.preset.sets, a.costs(k), a.lo, a.end, a.select, overrides[j]))
  })
  log(`${a.key} simulé`)
}

// V0 sur BTC et ETH = rapports validés de la v1.
for (const key of ['btc', 'ethusdt'] as SleeveKey[]) {
  const a = ASSETS.find(x => x.key === (key === 'btc' ? 'BTC' : 'ETH'))!
  const ref = JSON.parse(readFileSync(join(ROOT, SLEEVES[key].validated), 'utf8'))
  for (const k of KS) {
    const sim = RUNS.get(runKey(a.key, 'V0', k))!
    const mt = metricsOf(a.bars, sim, a.lo, a.end)
    const v = ref.strategy.preset.costs[k].s
    const pairs: [number, number][] = [[v.totalReturn, mt.totalReturn], [v.cagr, mt.cagr], [v.sharpe, mt.sharpe], [v.dd, mt.maxDrawdown], [v.pf, mt.profitFactor], [v.trades, sim.positions.length]]
    const worst = Math.max(...pairs.map(([x, y]) => Math.abs(x - y) / Math.max(1, Math.abs(x))))
    check(`${a.key} V0 × ${k} = rapport validé de la v1`, worst < 1e-9, `${SLEEVES[key].validated}, écart relatif max ${worst.toExponential(1)}`)
  }
}
for (const a of ASSETS) {
  const v4 = RUNS.get(runKey(a.key, 'V4', 1))!
  check(`${a.key} V4 : aucun short`, v4.positions.every(p => p.dir === 1), `${v4.positions.length} positions`)
}

// ================================================================ 5. trades et mesures
const dayOf = (ms: number) => Math.floor(ms / DAY)

/** Clôture de chaque jour UTC (dernière barre du jour). */
function dayCloseMap(b: Bars) {
  const close = new Map<number, number>()
  for (let i = 0; i < b.n; i++) close.set(dayOf(b.t[i]), b.c[i])
  return close
}

/** σ journalière connue à l'entrée : comme research/shock/sharpe-attribution.ts. */
function dailyVol(b: Bars) {
  const close = dayCloseMap(b)
  const ds = [...close.keys()].sort((x, y) => x - y)
  const out = new Map<number, number>()
  const lr: number[] = []
  for (let j = 1; j < ds.length; j++) {
    if (lr.length >= VOL_DAYS) out.set(ds[j], P.sd(lr.slice(-VOL_DAYS)))
    lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0)
  }
  return out
}

/** Marché baissier connu à l'entrée : dernière clôture journalière à plus de 30 % sous le plus haut des 365 jours précédents. */
function bearDays(b: Bars) {
  const close = dayCloseMap(b)
  const ds = [...close.keys()].sort((x, y) => x - y)
  const out = new Map<number, boolean>()
  for (let j = 1; j < ds.length; j++) {
    const prev = ds[j - 1]
    let hi = 0
    for (let q = j - 1; q >= 0 && ds[q] > prev - 365; q--) hi = Math.max(hi, close.get(ds[q])!)
    out.set(ds[j], close.get(prev)! / hi - 1 <= -0.3)
  }
  return out
}

// Les 7 épisodes nommés du rapport portefeuille (research/shock/portfolio.ts).
const EPISODES = [
  { name: '2018 Q4 capitulation', from: '2018-11-08', to: '2018-12-15' },
  { name: 'COVID-19 crash', from: '2020-03-01', to: '2020-03-31' },
  { name: 'May–July 2021 sell-off', from: '2021-05-10', to: '2021-07-20' },
  { name: 'Terra/LUNA and 3AC', from: '2022-05-05', to: '2022-06-30' },
  { name: 'FTX collapse', from: '2022-11-06', to: '2022-11-30' },
  { name: 'August 2024 carry unwind', from: '2024-08-01', to: '2024-08-10' },
  { name: 'Oct–Nov 2025 deleveraging', from: '2025-10-06', to: '2025-11-30' },
].map(e => ({ ...e, a: dayOf(Date.parse(e.from)), b: dayOf(Date.parse(e.to)) }))
const inEpisode = (d: number) => EPISODES.some(e => d >= e.a && d <= e.b)

interface Tr { day: number; month: number; year: number; half: 0 | 1; net: number; R: number; bear: boolean; episode: boolean }

const TR = new Map<string, Tr[]>()
for (const a of ASSETS) {
  const vol = dailyVol(a.bars), bear = bearDays(a.bars)
  let missing = 0
  for (const v of VARIANTS) for (const k of KS) {
    const run = RUNS.get(runKey(a.key, v, k))!
    const ts: Tr[] = []
    for (const p of run.positions) {
      if (p.dir !== -1 || p.entryIdx < a.lo || p.entryIdx > a.end) continue
      const day = dayOf(a.bars.t[p.entryIdx])
      const sig = vol.get(day)
      if (!(sig !== undefined && sig > 0)) { missing++; continue }
      const net = p.pnl / p.equityAtEntry
      ts.push({ day, month: P.monthKey(day), year: P.yearOf(day), half: day <= HALF_END ? 0 : 1, net, R: net / sig, bear: bear.get(day) ?? false, episode: inEpisode(day) })
    }
    TR.set(runKey(a.key, v, k), ts)
  }
  check(`${a.key} : σ journalière définie pour chaque short`, missing === 0, `${missing} short(s) sans σ`)
}
stopIfFailed('contrôles des simulations')
log('trades extraits')

const meanR = (ts: Tr[]) => (ts.length ? P.mean(ts.map(x => x.R)) : NaN)

function shortStats(ts: Tr[], years: number) {
  const net = ts.map(x => x.net), R = ts.map(x => x.R)
  let gp = 0, gl = 0, semi = 0, cum = 0, peak = 0, dd = 0
  for (const x of net) { if (x > 0) gp += x; else gl -= x }
  for (const x of R) if (x < 0) semi += x * x
  const sorted = [...ts].sort((x, y) => x.day - y.day)
  for (const x of sorted) { cum += x.net; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak) }
  const ep = ts.filter(x => x.episode), br = ts.filter(x => x.bear)
  return {
    n: ts.length, perYear: ts.length / years, winRate: ts.length ? ts.filter(x => x.net > 0).length / ts.length : NaN,
    meanR: meanR(ts), meanNet: ts.length ? P.mean(net) : NaN, sumNet: P.sum(net),
    pf: gl > 0 ? gp / gl : NaN, semiDevR: ts.length ? Math.sqrt(semi / ts.length) : NaN, worstR: ts.length ? Math.min(...R) : NaN,
    maxDDsum: dd,
    episodes: { n: ep.length, sumNet: P.sum(ep.map(x => x.net)), sumR: P.sum(ep.map(x => x.R)) },
    bear: { n: br.length, sumNet: P.sum(br.map(x => x.net)), sumR: P.sum(br.map(x => x.R)), meanR: meanR(br) },
    byHalf: [0, 1].map(hh => { const s = ts.filter(x => x.half === hh); return { n: s.length, meanR: meanR(s) } }),
  }
}

/** Stratégie complète (longs + shorts) : rendements journaliers sur la fenêtre de l'actif. */
function fullDaily(a: Asset, run: ShockResult) {
  const D0 = Math.ceil(a.bars.t[a.lo] / DAY), D1 = Math.floor((a.bars.t[a.end] + M15) / DAY) - 1
  const days: number[] = []
  for (let d = D0; d <= D1; d++) days.push(d)
  const base = a.lo > 0 ? run.equity[a.lo - 1] : 10000
  const r = P.returnsOf(P.dayCloses(a.bars.t, run.equity, a.lo, a.end, days, base).eq, base)
  return { days, r }
}

const yearsOf = (a: Asset) => (a.bars.t[a.end] + M15 - a.bars.t[a.lo]) / DAY / ANN
const STATS: Record<string, Record<V, Record<number, ReturnType<typeof shortStats> & { full: { sharpe: number; cagr: number; maxDD: number } }>>> = {}
for (const a of ASSETS) {
  STATS[a.key] = {} as Record<V, Record<number, ReturnType<typeof shortStats> & { full: { sharpe: number; cagr: number; maxDD: number } }>>
  for (const v of VARIANTS) {
    STATS[a.key][v] = {}
    for (const k of KS) {
      const run = RUNS.get(runKey(a.key, v, k))!
      const { days, r } = fullDaily(a, run)
      const dm = P.dailyMetrics(r, days)
      STATS[a.key][v][k] = { ...shortStats(TR.get(runKey(a.key, v, k))!, yearsOf(a)), full: { sharpe: dm.sharpe, cagr: dm.cagr, maxDD: dm.maxDD } }
    }
  }
}

// Ē par année, actifs vierges mis en commun (descriptif).
const YEARS = [...new Set(UN.flatMap(a => TR.get(runKey(a.key, 'V0', 1))!.map(x => x.year)))].sort()
const byYear = Object.fromEntries(VARIANTS.filter(v => v !== 'V4').map(v => [v, Object.fromEntries(YEARS.map(y => {
  const ts = UN.flatMap(a => TR.get(runKey(a.key, v, 1))!.filter(x => x.year === y))
  return [y, { n: ts.length, meanR: meanR(ts) }]
}))]))

// ================================================================ 6. statistique principale et bootstrap (§ 5, § 7)
const TESTED: V[] = ['V1', 'V2', 'V3', 'E1', 'E2']
const ebar = (a: string, v: V, k = 1) => meanR(TR.get(runKey(a, v, k))!)
const deltaOf = (v: V, k = 1) => {
  const xs = UN.map(a => ebar(a.key, v, k) - ebar(a.key, 'V0', k)).filter(Number.isFinite)
  return P.mean(xs)
}
const DELTA = Object.fromEntries(TESTED.map(v => [v, deltaOf(v)])) as Record<V, number>
const DELTA2 = Object.fromEntries(TESTED.map(v => [v, deltaOf(v, 2)])) as Record<V, number>
const improved = (v: V) => UN.filter(a => { const e = ebar(a.key, v); return Number.isFinite(e) && e > ebar(a.key, 'V0') }).length

const M0 = Math.min(...UN.map(a => P.monthKey(dayOf(a.bars.t[a.lo]))))
const M1 = Math.max(...UN.map(a => P.monthKey(dayOf(a.bars.t[a.end]))))
const NM = M1 - M0 + 1
const BV: V[] = ['V0', ...TESTED]
// Blocs : somme de R et nombre de shorts par actif, variante et mois.
const SUMS = UN.map(a => BV.map(v => { const s = new Float64Array(NM), c = new Float64Array(NM); for (const x of TR.get(runKey(a.key, v, 1))!) { s[x.month - M0] += x.R; c[x.month - M0]++ } return { s, c } }))
const rand = P.rng(SEED)
const BOOT: Record<string, Float64Array> = Object.fromEntries([...TESTED, 'pooledV0', 'eqwV0'].map(k => [k, new Float64Array(NBOOT)]))
const draws = new Int32Array(NM)
for (let b = 0; b < NBOOT; b++) {
  for (let j = 0; j < NM; j++) draws[j] = Math.floor(rand() * NM)
  const e = UN.map((_, ai) => BV.map((_, vi) => { const { s, c } = SUMS[ai][vi]; let S = 0, C = 0; for (let j = 0; j < NM; j++) { S += s[draws[j]]; C += c[draws[j]] } return { S, C } }))
  TESTED.forEach(v => {
    const vi = BV.indexOf(v)
    let acc = 0, na = 0
    for (let ai = 0; ai < UN.length; ai++) { const x = e[ai][vi], y = e[ai][0]; if (x.C > 0 && y.C > 0) { acc += x.S / x.C - y.S / y.C; na++ } }
    BOOT[v][b] = na ? acc / na : NaN
  })
  let S = 0, C = 0, eq = 0, ne = 0
  for (let ai = 0; ai < UN.length; ai++) { S += e[ai][0].S; C += e[ai][0].C; if (e[ai][0].C > 0) { eq += e[ai][0].S / e[ai][0].C; ne++ } }
  BOOT.pooledV0[b] = S / C
  BOOT.eqwV0[b] = eq / ne
}
log('bootstrap')
const finite = (x: Float64Array) => Array.from(x).filter(Number.isFinite)
const pval = (v: V) => { const xs = finite(BOOT[v]); return xs.filter(x => x <= 0).length / xs.length }
const ci = (k: string, lo: number, hi: number) => { const xs = finite(BOOT[k]); return [P.quantile(xs, lo), P.quantile(xs, hi)] }
const TEST = Object.fromEntries(TESTED.map(v => [v, { delta: DELTA[v], delta2: DELTA2[v], p: pval(v), ci90: ci(v, 0.05, 0.95), improved: improved(v), nBoot: finite(BOOT[v]).length }])) as Record<V, { delta: number; delta2: number; p: number; ci90: number[]; improved: number; nBoot: number }>

// ================================================================ 7. règle de décision (§ 6)
const median = (xs: number[]) => P.quantile(xs, 0.5)
const dSharpe = (v: V, ref: V) => UN.map(a => STATS[a.key][v][1].full.sharpe - STATS[a.key][ref][1].full.sharpe)
const nV3 = P.sum(UN.map(a => STATS[a.key].V3[1].n))
const H3 = { p: TEST.V3.p, bootOK: TEST.V3.p < 0.05, improved: TEST.V3.improved, constOK: TEST.V3.improved >= 6 }
const G1 = { n: nV3, ok: nV3 >= 100 }
const G2 = { delta2: TEST.V3.delta2, ok: TEST.V3.delta2 > 0 }
const G3 = { median: median(dSharpe('V3', 'V0')), ok: median(dSharpe('V3', 'V0')) >= 0 }
const h3Rejected = H3.bootOK && H3.constOK
const verdict = !G1.ok ? 'non concluant' : h3Rejected && G2.ok && G3.ok ? 'V3 candidate v1.1' : 'amélioration non démontrée'

// V1, V2 : Holm, seulement si H3 est rejetée.
let holm: { v: V; p: number; alpha: number; constOK: boolean; rejected: boolean }[] | null = null
if (h3Rejected) {
  const ord = (['V1', 'V2'] as V[]).sort((x, y) => TEST[x].p - TEST[y].p)
  let stop = false
  holm = ord.map((v, j) => {
    const alpha = 0.05 / (2 - j)
    const rej = !stop && TEST[v].p < alpha && TEST[v].improved >= 6
    if (!rej) stop = true
    return { v, p: TEST[v].p, alpha, constOK: TEST[v].improved >= 6, rejected: rej }
  })
}

// V4 : valeur de la sleeve short.
const pooledV0 = (() => { const ts = UN.flatMap(a => TR.get(runKey(a.key, 'V0', 1))!); return meanR(ts) })()
const eqwV0 = P.mean(UN.map(a => ebar(a.key, 'V0')))
const shortValue = { pooled: pooledV0, ci90: ci('pooledV0', 0.05, 0.95), eqw: eqwV0, eqwCi90: ci('eqwV0', 0.05, 0.95), medianDSharpe: median(dSharpe('V0', 'V4')), dSharpe: dSharpe('V0', 'V4') }
const shortsDemonstrated = shortValue.ci90[0] > 0 && shortValue.medianDSharpe > 0

// ================================================================ 8. BTC/ETH et portefeuille 50/50 (descriptif)
const BTC = ASSETS[0], ETH = ASSETS[1]
const tStart = Math.max(BTC.bars.t[BTC.lo], ETH.bars.t[ETH.lo])
const tEnd = Math.min(BTC.bars.t[BTC.end] + M15, ETH.bars.t[ETH.end] + M15)
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const pdays: number[] = []
for (let d = PD0; d <= PD1; d++) pdays.push(d)
const idxAt = (a: Asset, ms: number) => { const t = a.bars.t; let lo = 0, hi = a.bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const sleeveDaily = (a: Asset, run: ShockResult) => {
  const i0 = idxAt(a, PD0 * DAY), i1 = idxAt(a, (PD1 + 1) * DAY) - 1
  const base = run.equity[i0 - 1]
  return P.returnsOf(P.dayCloses(a.bars.t, run.equity, i0, i1, pdays, base).eq, base)
}
const halfIdx = Math.floor(pdays.length / 2)
const sharpeOf = (r: number[]) => { const s = P.sd(r); return s > 0 ? (P.mean(r) / s) * Math.sqrt(ANN) : NaN }
const PORT = Object.fromEntries(VARIANTS.map(v => {
  const rb = sleeveDaily(BTC, RUNS.get(runKey('BTC', v, 1))!), re = sleeveDaily(ETH, RUNS.get(runKey('ETH', v, 1))!)
  const dm = P.dailyMetrics(P.book(rb, re).r, pdays)
  const halves = [[0, halfIdx], [halfIdx, pdays.length]].map(([x, y]) => sharpeOf(P.book(rb.slice(x, y), re.slice(x, y)).r))
  return [v, { sharpe: dm.sharpe, cagr: dm.cagr, maxDD: dm.maxDD, sharpeH1: halves[0], sharpeH2: halves[1] }]
})) as Record<V, { sharpe: number; cagr: number; maxDD: number; sharpeH1: number; sharpeH2: number }>
const summary = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio/portfolio_summary.json'), 'utf8'))
const pub = [summary.series.portfolio.m.sharpe, summary.stability.subPeriods.firstHalf.portfolio.sharpe, summary.stability.subPeriods.secondHalf.portfolio.sharpe]
const got = [PORT.V0.sharpe, PORT.V0.sharpeH1, PORT.V0.sharpeH2]
check('Portefeuille 50/50 V0 : Sharpe total et par moitié = rapport publié', got.every((x, i) => Math.abs(x - pub[i]) < 1e-8), got.map((x, i) => `${x.toFixed(9)} vs ${pub[i]}`).join(' ; '))
stopIfFailed('reproduction du portefeuille')

// ================================================================ 9. sorties
const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${(x * 100).toFixed(d).replace('.', ',').replace('-', '−')} %` : '—')
const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—')
const sgn = (x: number, d = 3) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + num(x, d) : '—')
const pv = (p: number) => (p < 1e-4 ? '< 0,0001' : num(p, 4))
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
let commit = 'inconnu', clean = false
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); clean = execSync('git status --porcelain -- lib research/shock research/lib research/preregistration', { cwd: ROOT }).toString().trim() === '' } catch { /* hors git */ }

const L: string[] = []
L.push('# Étude pré-enregistrée — entrée des shorts du Shock Engine', '')
L.push(`Plan : \`${PREREG}\` (commit \`${PREREG_COMMIT}\`, antérieur à tout calcul). Résultats produits par \`node research/shock/short-entry-study.ts\` au commit \`${commit.slice(0, 7)}\`${clean ? '' : ' (arbre de travail modifié)'}. La v1 reste figée ; rien ici ne modifie le live, le site ni les rapports publiés.`, '')
L.push('Simulation historique après coûts modélisés. Pas une performance live.', '')

L.push('## Verdict selon la règle pré-enregistrée', '')
L.push(`**${verdict.toUpperCase()}**`, '')
L.push('| Condition | Valeur | Seuil | Résultat |', '|---|---|---|---|')
L.push(`| H3 · bootstrap, p unilatéral de Δ(V3) | ${pv(H3.p)} | < 0,05 | ${H3.bootOK ? 'oui' : 'non'} |`)
L.push(`| H3 · constance, actifs où Ē(V3) > Ē(V0) | ${H3.improved} / 8 | ≥ 6 | ${H3.constOK ? 'oui' : 'non'} |`)
L.push(`| G1 · shorts V3 sur les 8 actifs | ${G1.n} | ≥ 100 | ${G1.ok ? 'oui' : 'non'} |`)
L.push(`| G2 · Δ(V3) à coûts × 2 | ${sgn(G2.delta2)} | > 0 | ${G2.ok ? 'oui' : 'non'} |`)
L.push(`| G3 · médiane de l'écart de Sharpe stratégie complète, V3 − V0 | ${sgn(G3.median)} | ≥ 0 | ${G3.ok ? 'oui' : 'non'} |`, '')
L.push(`Δ(V3) = ${sgn(TEST.V3.delta)} σ par short (intervalle bootstrap à 90 % : ${sgn(TEST.V3.ci90[0])} à ${sgn(TEST.V3.ci90[1])}).`, '')
if (holm) {
  L.push('**V1 et V2 (attribution, Holm, testées parce que H3 est rejetée)** :', '')
  for (const x of holm) L.push(`- ${LABEL[x.v]} : p = ${pv(x.p)} (seuil ${num(x.alpha, 3)}), constance ${TEST[x.v].improved}/8 → ${x.rejected ? 'effet démontré' : 'non démontré'}.`)
  L.push('')
} else L.push('V1 et V2 ne sont pas testées : la règle ne les teste que si H3 est rejetée. Leurs chiffres ci-dessous sont descriptifs.', '')
L.push(`**V4 · valeur de la sleeve short hors échantillon** : Ē(V0) mis en commun = ${sgn(shortValue.pooled)} σ par short (90 % : ${sgn(shortValue.ci90[0])} à ${sgn(shortValue.ci90[1])}) ; moyenne à poids égal par actif ${sgn(shortValue.eqw)} (90 % : ${sgn(shortValue.eqwCi90[0])} à ${sgn(shortValue.eqwCi90[1])}). Médiane de l'écart de Sharpe V0 − V4 : ${sgn(shortValue.medianDSharpe)}. Conclusion : ${shortsDemonstrated ? 'valeur des shorts démontrée hors échantillon' : 'valeur des shorts non démontrée hors échantillon'} (constat seulement, la v1 n'est pas modifiée).`, '')

L.push('## Mesure principale par actif vierge', '')
L.push('R = (PnL net / equity à l\'entrée) / σ journalière des 30 jours précédents. Ē = moyenne de R sur les shorts, coûts × 1.', '')
L.push('| Actif | Shorts V0 | Ē(V0) | Shorts V3 | Ē(V3) | Ē(V3) − Ē(V0) | Ē(V1) | Ē(V2) | Ē(E1) | Ē(E2) |', '|---|---|---|---|---|---|---|---|---|---|')
for (const a of UN) {
  const s = STATS[a.key]
  L.push(`| ${a.key} | ${s.V0[1].n} | ${sgn(s.V0[1].meanR)} | ${s.V3[1].n} | ${sgn(s.V3[1].meanR)} | ${sgn(s.V3[1].meanR - s.V0[1].meanR)} | ${sgn(s.V1[1].meanR)} | ${sgn(s.V2[1].meanR)} | ${sgn(s.E1[1].meanR)} | ${sgn(s.E2[1].meanR)} |`)
}
L.push('')
L.push('## Tests bootstrap (mois civils tirés en commun, 10 000 réplications)', '')
L.push('| Variante | Δ (σ par short) | Δ à coûts × 2 | 90 % | p unilatéral | Actifs améliorés | Statut |', '|---|---|---|---|---|---|---|')
for (const v of TESTED) {
  const x = TEST[v]
  const status = v === 'V3' ? 'confirmatoire (principale)' : v === 'V1' || v === 'V2' ? (holm ? 'confirmatoire (Holm)' : 'descriptif (H3 non rejetée)') : 'EXPLORATOIRE'
  L.push(`| ${LABEL[v]} | ${sgn(x.delta)} | ${sgn(x.delta2)} | ${sgn(x.ci90[0])} à ${sgn(x.ci90[1])} | ${pv(x.p)} | ${x.improved}/8 | ${status} |`)
}
L.push('')

L.push('## Mesures secondaires, actifs vierges (coûts × 1)', '')
L.push('Somme ou médiane sur les 8 actifs. Risque de baisse : semi-écart de R, pire R. Crises : shorts entrés pendant les 7 épisodes nommés, ou un jour où l\'actif était à plus de 30 % sous son plus haut sur un an.', '')
L.push('| Variante | Shorts | Shorts/an (médiane) | Réussite | Rendement net moyen | PF | Semi-écart R | Pire R | Épisodes : shorts · Σ net | Baisse > 30 % : shorts · Ē | Sharpe stratégie complète (médiane) |', '|---|---|---|---|---|---|---|---|---|---|---|')
for (const v of VARIANTS) {
  const ss = UN.map(a => STATS[a.key][v][1])
  const ts = UN.flatMap(a => TR.get(runKey(a.key, v, 1))!)
  const pooled = shortStats(ts, 1)
  L.push(`| ${LABEL[v]} | ${pooled.n} | ${num(median(ss.map(x => x.perYear)), 1)} | ${pct(pooled.winRate, 0)} | ${pct(pooled.meanNet, 2)} | ${num(pooled.pf)} | ${num(pooled.semiDevR)} | ${num(pooled.worstR)} | ${pooled.episodes.n} · ${pct(pooled.episodes.sumNet, 0)} | ${pooled.bear.n} · ${sgn(pooled.bear.meanR)} | ${num(median(ss.map(x => x.full.sharpe)))} |`)
}
L.push('')
L.push('### Sharpe de la stratégie complète par actif (coûts × 1)', '')
L.push(`| Actif | Fenêtre | ${VARIANTS.join(' | ')} |`, `|---|---|${VARIANTS.map(() => '---').join('|')}|`)
for (const a of UN) L.push(`| ${a.key} | ${iso(a.bars.t[a.lo])} → ${iso(a.bars.t[a.end])} | ${VARIANTS.map(v => num(STATS[a.key][v][1].full.sharpe)).join(' | ')} |`)
L.push('')
L.push('### Ē par moitié et par année, actifs vierges mis en commun', '')
L.push(`| Variante | Jusqu'au 2022-09-15 | Après | ${YEARS.join(' | ')} |`, `|---|---|---|${YEARS.map(() => '---').join('|')}|`)
for (const v of VARIANTS.filter(x => x !== 'V4')) {
  const ts = UN.flatMap(a => TR.get(runKey(a.key, v, 1))!)
  const h = [0, 1].map(hh => ts.filter(x => x.half === hh))
  L.push(`| ${LABEL[v]} | ${sgn(meanR(h[0]))} (${h[0].length}) | ${sgn(meanR(h[1]))} (${h[1].length}) | ${YEARS.map(y => `${sgn(byYear[v][y].meanR, 2)} (${byYear[v][y].n})`).join(' | ')} |`)
}
L.push('')

L.push('## BTC, ETH et portefeuille 50/50 (déjà vus : descriptif)', '')
L.push('| Variante | BTC shorts · Ē | ETH shorts · Ē | BTC Sharpe | ETH Sharpe | Portefeuille Sharpe | CAGR | Drawdown max | Sharpe 1re moitié | Sharpe 2de moitié |', '|---|---|---|---|---|---|---|---|---|---|')
for (const v of VARIANTS) {
  const b = STATS.BTC[v][1], e = STATS.ETH[v][1], p = PORT[v]
  L.push(`| ${LABEL[v]} | ${b.n} · ${sgn(b.meanR)} | ${e.n} · ${sgn(e.meanR)} | ${num(b.full.sharpe)} | ${num(e.full.sharpe)} | ${num(p.sharpe)} | ${pct(p.cagr)} | ${pct(p.maxDD)} | ${num(p.sharpeH1)} | ${num(p.sharpeH2)} |`)
}
L.push('')
L.push('Sharpe BTC et ETH : stratégie complète sur la fenêtre de chaque sleeve. Portefeuille : 50/50 au départ, sans rebalancement, période commune ; par moitié, 50/50 au début de chaque moitié (comme l\'attribution).', '')

L.push('## Données', '')
L.push('| Actif | Données | Simulation | Barres simulées | Trous | mintick |', '|---|---|---|---|---|---|')
for (const a of ASSETS) L.push(`| ${a.key} | ${a.label} | ${iso(a.bars.t[a.lo])} → ${iso(a.bars.t[a.end])} | ${a.end - a.lo + 1} | ${a.gaps} | ${+a.mintick.toPrecision(1)} |`)
L.push('')
L.push(`Coûts des actifs vierges : commission 0,045 % et glissement 0,01 % par ordre (× 2 pour G2). BTC et ETH : coûts de la v1.`, '')
L.push('## Écarts au pré-enregistrement', '')
const offKeys = Object.keys(OFF_WARM)
if (offKeys.length) {
  L.push(`1. **Contrôle de grille limité à la fenêtre simulée.** Le plan demandait des horodatages sur la grille 15 min pour les actifs vierges, sans préciser la portée. Au premier lancement, le contrôle a arrêté le script avant toute simulation : ${offKeys.map(k => `${k} a ${OFF_WARM[k].n} bougies hors grille (${OFF_WARM[k].first.slice(0, 16)} → ${OFF_WARM[k].last.slice(0, 16)} UTC)`).join(', ')}, soit la panne Binance de février 2018, dans le préchauffage, environ 10 mois avant le début de la simulation. Les données sont gardées telles que téléchargées ; le contrôle porte sur la fenêtre simulée (comme dans portfolio.ts), et un contrôle ajouté montre qu'en retirant ces bougies, le régime et toutes les listes d'entrées (V0 à E2) de la fenêtre simulée restent identiques barre par barre. Aucun résultat n'avait été calculé avant cet écart.`, '')
} else L.push('Aucun.', '')
L.push(`## Contrôles (${checks.filter(c => c.ok).length}/${checks.length})`, '')
for (const c of checks) L.push(`- ${c.ok ? '✔' : '✘'} ${c.name} · ${c.detail}`)
L.push('')

const json = {
  preregistration: { file: PREREG, commit: PREREG_COMMIT }, commit, sourcesClean: clean, generatedAt: new Date().toISOString(),
  verdict, H3, G1, G2, G3, holm, shortValue: { ...shortValue, demonstrated: shortsDemonstrated }, tests: TEST,
  unseen: Object.fromEntries(UN.map(a => [a.key, { window: [iso(a.bars.t[a.lo]), iso(a.bars.t[a.end])], gaps: a.gaps, mintick: a.mintick, stats: STATS[a.key] }])),
  seen: { BTC: STATS.BTC, ETH: STATS.ETH, portfolio: PORT },
  byYear, bootstrap: { replications: NBOOT, seed: SEED, months: NM, firstMonth: P.monthLabel(M0), lastMonth: P.monthLabel(M1) },
  checks,
}
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'short-entry-study.md'), L.join('\n'))
writeFileSync(join(OUT, 'short-entry-study.json'), JSON.stringify(json, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(10) : x), 1))
log(`écrit ${OUT}/short-entry-study.{md,json} · ${verdict}`)
