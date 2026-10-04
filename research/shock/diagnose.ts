// Diagnostic du Shock Engine : où est l'edge, quand, et que valent les entrées et les sorties.
//
//   node research/shock/diagnose.ts --tf 5 [--from 2017-01-01] [--split 2022-01-01] [--out research/reports]
//
// Écrit un rapport Markdown et un JSON de données. Toutes les mesures portent sur les positions
// (une entrée et toutes ses sorties), frais compris.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Bars } from '../../lib/backtest/types.ts'
import { sma } from '../../lib/backtest/indicators.ts'
import { loadBtc, dayMs, indexAtOrAfter } from '../lib/data.ts'
import { group, metricsOf, pct, num, randomEntries } from '../lib/stats.ts'
import type { Group } from '../lib/stats.ts'
import { makeMarket, runShock } from '../../lib/strategies/shock/engine.ts'
import type { Market, PositionRecord, ShockResult } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, REALISTIC_COSTS, withParams } from '../../lib/strategies/shock/params.ts'
import type { Costs, ShockParams } from '../../lib/strategies/shock/params.ts'
import { parseArgs } from './run.ts'

const HOUR = 3600000

function table(head: string[], rows: (string | number)[][]): string {
  const line = (r: (string | number)[]) => `| ${r.join(' | ')} |`
  return [line(head), line(head.map((_, k) => (k === 0 ? '---' : '---:'))), ...rows.map(line)].join('\n')
}

function gRow(label: string, g: Group): (string | number)[] {
  return [label, g.n, pct(g.winRate, 0), pct(g.avgPct, 3), num(g.pf), num(g.avgR, 3), pct(g.sumPct, 0)]
}
const G_HEAD = ['', 'positions', 'gagnantes', 'moyenne', 'PF', 'R moyen (ATR)', 'somme']

function by<T extends string | number>(ps: PositionRecord[], key: (p: PositionRecord) => T, order?: T[]): [T, Group][] {
  const m = new Map<T, PositionRecord[]>()
  for (const p of ps) {
    const k = key(p)
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(p)
  }
  const keys = order ?? [...m.keys()].sort((x, y) => (x < y ? -1 : 1))
  return keys.filter(k => m.has(k)).map(k => [k, group(m.get(k)!)])
}

/** Percentile glissant de la volatilité (ATR / prix) sur une fenêtre de 30 jours. */
function volBucket(bars: Bars, atr: Float64Array, tfMin: number): (i: number) => string {
  const n = bars.n
  const w = Math.round((30 * 24 * 60) / tfMin)
  const x = new Float64Array(n)
  for (let i = 0; i < n; i++) x[i] = atr[i] / bars.c[i]
  const mean = sma(x, w)
  return (i: number) => {
    const ratio = x[i] / mean[i]
    if (!Number.isFinite(ratio)) return '?'
    return ratio < 0.8 ? '1 · basse' : ratio < 1.25 ? '2 · normale' : '3 · haute'
  }
}

/** Tendance de fond : prix au-dessus ou au-dessous de la moyenne 200 périodes en 60 min. */
function trendOf(m: Market): (i: number) => string {
  const s200 = sma(m.htf.c, 200)
  const tfMs = m.tfMin * 60000
  return (i: number) => {
    const t = m.bars.t[i] + tfMs
    let lo = 0, hi = m.htf.n - 1, k = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (m.htf.t[mid] + HOUR <= t) { k = mid; lo = mid + 1 } else hi = mid - 1
    }
    if (k < 0 || !Number.isFinite(s200[k])) return '?'
    return m.bars.c[i] > s200[k] ? 'haussière' : 'baissière'
  }
}

function eventStudy(bars: Bars, r: ShockResult, dir: 1 | -1, before = 24, after = 48, all = false) {
  const idx: number[] = []
  const flags = dir === 1 ? r.entryLong : r.entryShort
  // all = toutes les barres (une sur 7) : la dérive « normale » du marché, pour comparaison.
  for (let i = r.start; i <= r.end; i++) if (all ? i % 7 === 0 : flags[i]) idx.push(i)
  const ks: number[] = []
  for (let k = -before; k <= after; k += k < 0 ? 4 : k < 12 ? 1 : 6) ks.push(k)
  if (!ks.includes(after)) ks.push(after)
  const rows: { k: number; mean: number; median: number; up: number }[] = []
  for (const k of ks) {
    const xs: number[] = []
    for (const i of idx) {
      const j = i + k
      if (j < 0 || j >= bars.n) continue
      const a = r.prep.atr[i]
      if (!(a > 0)) continue
      xs.push((dir * (bars.c[j] - bars.c[i])) / a)
    }
    xs.sort((x, y) => x - y)
    const mean = xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
    rows.push({ k, mean, median: xs[Math.floor(xs.length / 2)] ?? NaN, up: xs.filter(x => x > 0).length / Math.max(1, xs.length) })
  }
  return { n: idx.length, rows }
}

interface Variant {
  name: string
  over: Partial<Record<keyof ShockParams, unknown>>
}

const RANDOM_RUNS = 100

const TIMING_VARIANTS: Variant[] = [
  { name: 'Script tel quel', over: {} },
  { name: 'Longs seulement', over: { allowShort: false } },
  { name: 'Longs seuls, sans stop suiveur', over: { allowShort: false, atrTrailMult: 50 } },
]

function rngOf(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const VARIANTS: Variant[] = [
  { name: 'Script tel quel', over: {} },
  { name: 'Pente 60 min corrigée (3 barres de 60 min)', over: { htfSlopeMode: 'htf' } },
  { name: 'Longs seulement', over: { allowShort: false } },
  { name: 'Shorts seulement', over: { allowLong: false } },
  { name: 'Sans micro-chocs', over: { useMicroShock: false } },
  { name: 'Sans flip exit', over: { useFlipExit: false } },
  { name: 'Sans TP1', over: { useTP1: false } },
  { name: 'Sans stop suiveur', over: { atrTrailMult: 50 } },
  { name: 'Stop 2,5 ATR', over: { atrStopMult: 2.5 } },
  { name: 'Mode normal (sans High Activity)', over: { highActivityMode: false } },
  { name: 'Sans filtre de volume', over: { useVolFilter: false } },
  { name: 'Sans filtre 60 min pour les shorts', over: { useHTF: false } },
  { name: 'Cooldown 12 barres', over: { cooldownBars: 24 } },
  { name: 'Seuil de choc relevé (micro 2,0 → z > 1,8)', over: { kMicro: 2.0 } },
  { name: 'Longs seuls, sans stop suiveur', over: { allowShort: false, atrTrailMult: 50 } },
  { name: 'Fade activé (impulse + fade)', over: { directionalOnly: false } },
  { name: 'Fade seulement', over: { directionalOnly: false, useImpulse: false } },
  { name: 'Fade seulement, longs', over: { directionalOnly: false, useImpulse: false, allowShort: false } },
]

function main() {
  const { a } = parseArgs(process.argv.slice(2))
  const tf = Number(a.tf ?? 5)
  const outDir = a.out ?? 'research/reports'
  const bars = loadBtc(tf)
  const m = makeMarket(bars, tf, loadBtc(60))
  const start = indexAtOrAfter(bars, dayMs(a.from ?? '2017-01-01'))
  const end = a.to ? indexAtOrAfter(bars, dayMs(a.to)) - 1 : bars.n - 1
  const split = indexAtOrAfter(bars, dayMs(a.split ?? '2022-01-01'))
  const label = (i: number) => new Date(bars.t[i]).toISOString().slice(0, 10)
  const md: string[] = []
  const json: Record<string, unknown> = { tf, start: bars.t[start], end: bars.t[end], split: bars.t[split] }
  const out = (s = '') => md.push(s)

  out(`# Shock Engine · BTC/USD ${tf} min · diagnostic`)
  out()
  out(`Période ${label(start)} → ${label(end)} (Bitstamp). Échantillon / hors échantillon séparés au ${label(split)}.`)
  out(`Coûts « script » : commission ${SCRIPT_COSTS.commissionPct} % par ordre, glissement 1 tick. Coûts « réalistes » : commission ${REALISTIC_COSTS.commissionPct} % + ${REALISTIC_COSTS.slippagePct} % de glissement par ordre.`)
  out()

  // 1. Résultat de base.
  const runs: [string, Costs][] = [['script', SCRIPT_COSTS], ['réalistes', REALISTIC_COSTS], ['nuls', { ...SCRIPT_COSTS, commissionPct: 0, slippageTicks: 0 }]]
  const base = runShock(m, DEFAULT_PARAMS, SCRIPT_COSTS, start, end)
  const days = (bars.t[end] - bars.t[start]) / 86400000
  out('## 1. Résultat du script tel quel')
  out()
  const baseRows: (string | number)[][] = []
  for (const [name, costs] of runs) {
    const r = name === 'script' ? base : runShock(m, DEFAULT_PARAMS, costs, start, end)
    const mt = metricsOf(bars, r)
    baseRows.push([name, pct(mt.totalReturn, 0), pct(mt.cagr), pct(mt.maxDrawdown, 0), num(mt.sharpe), num(mt.profitFactor), mt.trades, num(mt.trades / days, 2), pct(mt.avgTradePct, 3)])
  }
  out(table(['coûts', 'rendement', 'CAGR', 'max DD', 'Sharpe', 'PF', 'positions', 'par jour', 'moyenne / position'], baseRows))
  out()
  out('« nuls » = sans aucun frais : c\'est l\'edge brut du signal, avant coûts.')
  out()

  const ps = base.positions
  // 2. Par année.
  out('## 2. Par année')
  out()
  out(table(G_HEAD, by(ps, p => new Date(bars.t[p.entryIdx]).getUTCFullYear()).map(([k, g]) => gRow(String(k), g))))
  out()
  // 3. Sens et type de signal.
  out('## 3. Sens et type de signal')
  out()
  out(table(G_HEAD, by(ps, p => `${p.dir === 1 ? 'long' : 'short'} · ${p.tag}`).map(([k, g]) => gRow(k, g))))
  out()
  // 4. Heure.
  out('## 4. Session et heure (UTC)')
  out()
  const session = (p: PositionRecord) => {
    const hr = new Date(bars.t[p.entryIdx]).getUTCHours()
    return hr < 7 ? '1 · Asie (0-7 h)' : hr < 13 ? '2 · Europe (7-13 h)' : hr < 21 ? '3 · États-Unis (13-21 h)' : '4 · soirée (21-24 h)'
  }
  out(table(G_HEAD, by(ps, session).map(([k, g]) => gRow(k, g))))
  out()
  const hours = by(ps, p => new Date(bars.t[p.entryIdx]).getUTCHours())
  out(table(['heure', 'positions', 'moyenne', 'PF'], hours.map(([k, g]) => [`${k} h`, g.n, pct(g.avgPct, 3), num(g.pf)])))
  out()
  out('Minute d\'entrée des longs (pente du filtre 60 min) :')
  out()
  const mins = by(ps.filter(p => p.dir === 1), p => new Date(bars.t[p.entryIdx]).getUTCMinutes())
  out(table(['minute', 'longs', 'moyenne'], mins.map(([k, g]) => [`:${String(k).padStart(2, '0')}`, g.n, pct(g.avgPct, 3)])))
  out()
  // 5. Régimes.
  out('## 5. Régimes de marché à l\'entrée')
  out()
  const vb = volBucket(bars, base.prep.atr, tf)
  const tr = trendOf(m)
  out('Volatilité (ATR / prix, rapportée à sa moyenne sur 30 jours) :')
  out()
  out(table(G_HEAD, by(ps, p => `${vb(p.entryIdx)} · ${p.dir === 1 ? 'long' : 'short'}`).map(([k, g]) => gRow(k, g))))
  out()
  out('Tendance de fond (prix contre moyenne 200 en 60 min) :')
  out()
  out(table(G_HEAD, by(ps, p => `${tr(p.entryIdx)} · ${p.dir === 1 ? 'long' : 'short'}`).map(([k, g]) => gRow(k, g))))
  out()
  out('Percentile de lambda (intensité des chocs) :')
  out()
  const lamB = (p: PositionRecord) => {
    const x = base.prep.lamPct[p.entryIdx]
    return !Number.isFinite(x) ? '?' : x < 25 ? '1 · < 25' : x < 50 ? '2 · 25-50' : x < 75 ? '3 · 50-75' : '4 · ≥ 75'
  }
  out(table(G_HEAD, by(ps, p => `${lamB(p)} · ${p.dir === 1 ? 'long' : 'short'}`).map(([k, g]) => gRow(k, g))))
  out()
  // 6. Timing des entrées.
  out('## 6. Timing des entrées : trajectoire moyenne du prix autour du signal')
  out()
  out('Mouvement du prix depuis la clôture du signal, en ATR, dans le sens du trade (positif = favorable). Les valeurs négatives de k montrent ce qui s\'est passé avant le signal.')
  out()
  const evL = eventStudy(bars, base, 1)
  const evS = eventStudy(bars, base, -1)
  const evA = eventStudy(bars, base, 1, 24, 48, true)
  json.eventLong = evL
  json.eventShort = evS
  json.eventAll = evA
  const ks = evL.rows.map(r => r.k)
  out(table(['barres k', `longs moyenne (n=${evL.n})`, 'longs médiane', 'longs % > 0', `shorts moyenne (n=${evS.n})`, 'shorts médiane', 'shorts % > 0', 'toutes barres, hausse moyenne'],
    ks.map((k, j) => [k, num(evL.rows[j].mean, 2), num(evL.rows[j].median, 2), pct(evL.rows[j].up, 0), num(evS.rows[j]?.mean ?? NaN, 2), num(evS.rows[j]?.median ?? NaN, 2), pct(evS.rows[j]?.up ?? NaN, 0), num(evA.rows[j]?.mean ?? NaN, 2)])))
  out()
  out('Dernière colonne : mouvement moyen du prix après une barre quelconque (dérive du marché). Un long n\'a d\'edge que s\'il fait mieux que cette colonne ; un short, que s\'il fait mieux que son opposé.')
  out()
  // 7. Sorties.
  out('## 7. Sorties')
  out()
  out(table(G_HEAD, by(ps, p => `${p.dir === 1 ? 'long' : 'short'} · ${p.exits.join('+')}`).map(([k, g]) => gRow(k, g))))
  out()
  const losers = ps.filter(p => p.pnl <= 0)
  const winners = ps.filter(p => p.pnl > 0)
  const share = (xs: PositionRecord[], f: (p: PositionRecord) => boolean) => (xs.length ? xs.filter(f).length / xs.length : 0)
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length)
  out(`- Positions perdantes passées d'abord par +1 ATR de gain : ${pct(share(losers, p => p.mfeAtr >= 1), 0)} ; par +0,5 ATR : ${pct(share(losers, p => p.mfeAtr >= 0.5), 0)}.`)
  out(`- Positions gagnantes allées jusqu'à -1 ATR avant de gagner : ${pct(share(winners, p => p.maeAtr <= -1), 0)}.`)
  out(`- Meilleure excursion moyenne : ${num(avg(ps.map(p => p.mfeAtr)), 2)} ATR ; pire excursion moyenne : ${num(avg(ps.map(p => p.maeAtr)), 2)} ATR.`)
  out(`- Durée moyenne : ${num(avg(ps.map(p => p.exitIdx - p.entryIdx)), 1)} barres.`)
  out()
  // 8. Variantes.
  out('## 8. Variantes (une modification à la fois)')
  out()
  out(`Même période, coûts du script. « Éch. » = jusqu'au ${label(split - 1)}, « hors éch. » = ensuite : une variante qui n'améliore que l'une des deux moitiés est suspecte.`)
  out()
  const vRows: (string | number)[][] = []
  const vJson: unknown[] = []
  const rRows: (string | number)[][] = []
  for (const v of VARIANTS) {
    const p = withParams(DEFAULT_PARAMS, v.over)
    const r = runShock(m, p, SCRIPT_COSTS, start, end)
    const all = metricsOf(bars, r)
    const ins = metricsOf(bars, r, start, split - 1)
    const oos = metricsOf(bars, r, split, end)
    vRows.push([v.name, pct(all.totalReturn, 0), num(all.sharpe), pct(all.maxDrawdown, 0), all.trades, pct(all.avgTradePct, 3), num(ins.sharpe), num(oos.sharpe)])
    const rnd = randomEntries(bars, r.positions, start, end, SCRIPT_COSTS.commissionPct)
    if (rnd) rRows.push([v.name, pct(rnd.strategy, 0), pct(rnd.median, 0), pct(rnd.p95, 0), pct(rnd.percentile, 1)])
    vJson.push({ name: v.name, over: v.over, all, ins, oos, random: rnd })
  }
  out(table(['variante', 'rendement', 'Sharpe', 'max DD', 'positions', 'moyenne', 'Sharpe éch.', 'Sharpe hors éch.'], vRows))
  out()
  out('## 9. Face au hasard')
  out()
  out('Pour chaque variante : 1 000 tirages de positions placées au hasard, avec le même nombre de positions, les mêmes durées, le même sens et les mêmes frais (entrée et sortie à la clôture). Sur le BTC, des longs au hasard gagnent déjà grâce à la hausse de fond : une variante n\'a un vrai timing que si elle bat largement ces tirages.')
  out()
  out(table(['variante', 'stratégie (positions composées)', 'hasard médian', 'hasard 95e centile', 'tirages battus'], rRows))
  out()
  json.variants = vJson

  // 10. Entrées au hasard, sorties identiques.
  out('## 10. Timing des entrées, à sorties identiques')
  out()
  out(`Le test le plus juste : on garde exactement les mêmes règles de sortie (stop, TP1, stop suiveur, flip, cooldown) et on remplace seulement les signaux d'entrée par des barres tirées au hasard, en même nombre et du même sens. ${RANDOM_RUNS} tirages par variante.`)
  out()
  const tRows: (string | number)[][] = []
  const timing: unknown[] = []
  for (const v of TIMING_VARIANTS) {
    const p = withParams(DEFAULT_PARAMS, v.over)
    const r = runShock(m, p, SCRIPT_COSTS, start, end)
    const ref = metricsOf(bars, r)
    let nL = 0, nS = 0
    for (let i = start; i <= end; i++) {
      if (r.prep.impulseEntryLong[i] || r.prep.fadeEntryLong[i]) nL++
      if (r.prep.impulseEntryShort[i] || r.prep.fadeEntryShort[i]) nS++
    }
    const R = rngOf(11)
    const rets: number[] = []
    const sharpes: number[] = []
    for (let k = 0; k < RANDOM_RUNS; k++) {
      const long = new Uint8Array(bars.n)
      const short = new Uint8Array(bars.n)
      const span = end - start
      for (let j = 0; j < nL; j++) long[start + Math.floor(R() * span)] = 1
      for (let j = 0; j < nS; j++) short[start + Math.floor(R() * span)] = 1
      const rr = runShock(m, p, SCRIPT_COSTS, start, end, { long, short })
      const mt = metricsOf(bars, rr)
      rets.push(mt.totalReturn)
      sharpes.push(mt.sharpe)
    }
    rets.sort((x, y) => x - y)
    sharpes.sort((x, y) => x - y)
    const beaten = sharpes.filter(x => x < ref.sharpe).length / RANDOM_RUNS
    tRows.push([v.name, num(ref.sharpe), num(sharpes[Math.floor(RANDOM_RUNS / 2)]), num(sharpes[Math.floor(RANDOM_RUNS * 0.95)]), pct(beaten, 0), pct(ref.totalReturn, 0), pct(rets[Math.floor(RANDOM_RUNS / 2)], 0)])
    timing.push({ name: v.name, sharpe: ref.sharpe, randomSharpes: sharpes, beaten })
  }
  out(table(['variante', 'Sharpe stratégie', 'Sharpe hasard médian', 'Sharpe hasard 95e centile', 'tirages battus', 'rendement stratégie', 'rendement hasard médian'], tRows))
  out()
  out('Au-dessus de 95 % de tirages battus, le signal d\'entrée apporte quelque chose. Autour de 50 %, la performance vient des sorties et de la tendance du marché, pas du moment d\'entrée.')
  out()
  json.timing = timing
  mkdirSync(outDir, { recursive: true })
  const base_ = join(outDir, `shock-${tf}m-diagnostic`)
  writeFileSync(base_ + '.md', md.join('\n') + '\n')
  writeFileSync(base_ + '.json', JSON.stringify(json, null, 1))
  console.log(`rapport -> ${base_}.md`)
}

main()
