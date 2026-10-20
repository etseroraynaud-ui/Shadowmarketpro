// OU Trend Channel Pro v2.3 (indicateur Pine du propriétaire) transformé en stratégie sur BTC/USD 15 min.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/ou-channel/ou-study.ts
//
// Signaux (logique « trap » du script, base EMA 34 par défaut) : croix violette bearTrapNew = LONG,
// croix orange bullTrapNew = SHORT. Une position à la fois, sans levier, 100 % du capital ; signal lu à
// la clôture, exécution à l'ouverture de la bougie suivante ; stop initial k × ATR(30) de la bougie du
// signal, sortie sur signal opposé (retournement), TP et stop suiveur en option ; commission 0,045 % par
// ordre. Entraînement 2017-01-01 → 2022-12-31, validation 2023-01-01 → 2026-09-30 (jamais utilisée
// pour choisir). Shock Engine V1 n'est pas modifié ; son benchmark est lu dans
// research/reports/reference/reference_daily_returns.csv.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadBtc } from '../lib/data.ts'
import { ema, sma, stdev, atr } from '../../lib/backtest/indicators.ts'
import { dsr } from '../lib/overfit.ts'

const DAY = 864e5
const FEE = 0.00045
const T0 = Date.parse('2017-01-01'), T1 = Date.parse('2023-01-01'), T2 = Date.parse('2026-10-01')
const b = loadBtc(15)
const { t, o, h, l, c, v } = b
const n = b.n
const idx = (ms: number) => { let a = 0, z = n; while (a < z) { const k = (a + z) >> 1; if (t[k] < ms) a = k + 1; else z = k } return a }
const iTr = idx(T0), iVa = idx(T1), iEnd = idx(T2) - 1

// ---------------------------------------------------------------- indicateur (parties qui font les croix)
const bs = ema(c, 34)
const resid = Float64Array.from(c, (x, i) => x - bs[i])
const rsd = ema(stdev(resid, 20), 5)
const z = Float64Array.from(resid, (x, i) => (rsd[i] > 0 && Number.isFinite(rsd[i]) && Number.isFinite(x) ? x / rsd[i] : 0))
const vm = sma(v, 20), vs = stdev(v, 20)
const volZ = Float64Array.from(v, (x, i) => (vs[i] > 0 ? (x - vm[i]) / vs[i] : 0))
const wick = Float64Array.from(c, (_, i) => { const r = h[i] - l[i]; return r > 0 ? Math.max(h[i] - Math.max(c[i], o[i]), Math.min(c[i], o[i]) - l[i]) / r : 0 })
const atr30 = atr(h, l, c, 30)

interface Entry { zMin: number; reentry: number; wickThr: number; volMin: number; volDiv: boolean }
interface Exit { stop: number; tpR: number; trail: boolean }
const BASE_ENTRY: Entry = { zMin: 2.2, reentry: 3, wickThr: 0.6, volMin: 1.0, volDiv: true }
const BASE_EXIT: Exit = { stop: 3.3, tpR: 0, trail: false }

/** +1 = long (bearTrapNew), −1 = short (bullTrapNew), 0 sinon ; logique du script ligne à ligne. */
function signals(p: Entry): Int8Array {
  const out = new Int8Array(n)
  const up = new Int32Array(n), dn = new Int32Array(n)
  let bullTrap = false, bearTrap = false
  for (let i = 1; i < n; i++) {
    const bu = z[i] > p.zMin, bd = z[i] < -p.zMin
    up[i] = bu ? up[i - 1] + 1 : 0
    dn[i] = bd ? dn[i - 1] + 1 : 0
    const reUp = i >= p.reentry && up[i - p.reentry] > 0 && up[i] === 0
    const reDn = i >= p.reentry && dn[i - p.reentry] > 0 && dn[i] === 0
    const extra = wick[i] >= p.wickThr || (p.volDiv && !(volZ[i] >= p.volMin))
    const prevBull = bullTrap, prevBear = bearTrap
    if (reUp && extra) bullTrap = true; else if (!bu) bullTrap = false
    if (reDn && extra) bearTrap = true; else if (!bd) bearTrap = false
    const sh = bullTrap && !prevBull, lg = bearTrap && !prevBear
    out[i] = lg && !sh ? 1 : sh && !lg ? -1 : 0
  }
  return out
}

// ---------------------------------------------------------------- simulation
interface Res { cagr: number; sharpe: number; mdd: number; pf: number; trades: number; win: number; r: number[] }
function simulate(sig: Int8Array, ex: Exit, a: number, z1: number, fee = FEE): Res {
  let eq = 1, dir = 0, entry = 0, units = 0, base = 0, stop = 0, tp = 0, dist = 0, ext = 0, eqIn = 1
  const tr: number[] = [], dailyEq: number[] = []
  let pending = 0
  const close = (px: number) => { eq = base + dir * units * (px - entry) - fee * units * px; tr.push(eq / eqIn - 1); dir = 0 }
  for (let j = a; j <= z1; j++) {
    if (pending && pending !== dir) {
      if (dir) close(o[j])
      const A = atr30[j - 1]
      if (A > 0) {
        dir = pending; entry = o[j]; eqIn = eq; units = eq / entry; base = eq - fee * eq
        dist = ex.stop * A; stop = entry - dir * dist; tp = ex.tpR ? entry + dir * ex.tpR * dist : NaN; ext = entry
      }
    }
    pending = 0
    if (dir === 1) {
      if (l[j] <= stop) close(Math.min(o[j], stop))
      else if (ex.tpR && h[j] >= tp) close(Math.max(o[j], tp))
    } else if (dir === -1) {
      if (h[j] >= stop) close(Math.max(o[j], stop))
      else if (ex.tpR && l[j] <= tp) close(Math.min(o[j], tp))
    }
    if (dir && ex.trail) { ext = dir === 1 ? Math.max(ext, h[j]) : Math.min(ext, l[j]); stop = dir === 1 ? Math.max(stop, ext - dist) : Math.min(stop, ext + dist) }
    if (j < z1) pending = sig[j]
    if (j === z1 && dir) close(c[j])
    const mark = dir ? base + dir * units * (c[j] - entry) : eq
    if (j === z1 || Math.floor(t[j + 1] / DAY) !== Math.floor(t[j] / DAY)) dailyEq.push(mark)
  }
  const r = dailyEq.map((x, k) => x / (k ? dailyEq[k - 1] : 1) - 1)
  const m = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length)
  let pk = 1, mdd = 0
  for (const x of dailyEq) { pk = Math.max(pk, x); mdd = Math.min(mdd, x / pk - 1) }
  const gp = tr.filter(x => x > 0).reduce((s, x) => s + x, 0), gl = tr.filter(x => x <= 0).reduce((s, x) => s + x, 0)
  return { cagr: Math.pow(dailyEq.at(-1)!, 365.25 / r.length) - 1, sharpe: sd > 0 ? (m / sd) * Math.sqrt(365.25) : 0, mdd, pf: gl < 0 ? gp / -gl : NaN, trades: tr.length, win: tr.filter(x => x > 0).length / Math.max(1, tr.length), r }
}
const train = (sig: Int8Array, ex: Exit, fee?: number) => simulate(sig, ex, iTr, iVa - 1, fee)
const valid = (sig: Int8Array, ex: Exit, fee?: number) => simulate(sig, ex, iVa, iEnd, fee)

// ---------------------------------------------------------------- 1. baseline et grille d'entrée
const Z = [1.8, 2.2, 2.6, 3.0], R = [1, 2, 3, 5], W = [0.5, 0.6, 0.7], V = [0.5, 1.0, 1.5]
const grid: Entry[] = []
for (const zMin of Z) for (const reentry of R) for (const wickThr of W) {
  for (const volMin of V) grid.push({ zMin, reentry, wickThr, volMin, volDiv: true })
  grid.push({ zMin, reentry, wickThr, volMin: NaN, volDiv: false })
}
const MIN_TRADES = 50
const sigCache = new Map<string, Int8Array>()
const sigOf = (e: Entry) => { const k = JSON.stringify(e); let s = sigCache.get(k); if (!s) { s = signals(e); sigCache.set(k, s) } return s }
const rows = grid.map(e => ({ e, ex: BASE_EXIT, tr: train(sigOf(e), BASE_EXIT) }))
const eligible = rows.filter(x => x.tr.trades >= MIN_TRADES).sort((a, b) => b.tr.sharpe - a.tr.sharpe)
const top5 = eligible.slice(0, 5)
const positive = rows.filter(x => x.tr.sharpe > 0).length

// ---------------------------------------------------------------- 2. sorties (18 variantes sur la meilleure entrée)
const best = top5[0]
const exits: Exit[] = []
for (const stop of [2, 3.3, 4.5]) for (const tpR of [0, 2, 3]) for (const trail of [false, true]) exits.push({ stop, tpR, trail })
const exitRows = exits.map(ex => ({ e: best.e, ex, tr: train(sigOf(best.e), ex) }))
const trials = rows.length + exitRows.length - 1 // la variante 3,3 ATR / sans TP / sans suiveur est déjà dans la grille

// ---------------------------------------------------------------- 3. trois candidates, validation, robustesse
const pool = [...eligible.slice(0, 5), ...exitRows.filter(x => x.tr.trades >= MIN_TRADES)]
const seen = new Set<string>()
const cands = pool.sort((a, b) => b.tr.sharpe - a.tr.sharpe).filter(x => { const k = JSON.stringify([x.e, x.ex]); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 3)
const neighbours = (e: Entry) => {
  const out: Entry[] = []
  const step = <T>(arr: T[], x: T, d: number) => arr[arr.indexOf(x) + d]
  for (const d of [-1, 1]) {
    for (const [key, arr] of [['zMin', Z], ['reentry', R], ['wickThr', W]] as const) { const x = step(arr as number[], e[key], d); if (x !== undefined) out.push({ ...e, [key]: x }) }
    if (e.volDiv) { const x = step(V, e.volMin, d); if (x !== undefined) out.push({ ...e, volMin: x }) }
  }
  return out
}
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN }
const candOut = cands.map(x => {
  const va = valid(sigOf(x.e), x.ex), va2 = valid(sigOf(x.e), x.ex, 2 * FEE)
  const nb = neighbours(x.e).map(e => ({ tr: train(sigOf(e), x.ex).sharpe, va: valid(sigOf(e), x.ex).sharpe }))
  return { ...x, va, va2, nbTrain: med(nb.map(y => y.tr)), nbValid: med(nb.map(y => y.va)), nbValidPos: nb.filter(y => y.va > 0).length / nb.length, dsrTrain: dsr(x.tr.r, trials, 0.0291).p }
})
const baseVa = valid(sigOf(BASE_ENTRY), BASE_EXIT)
const baseTr = train(sigOf(BASE_ENTRY), BASE_EXIT)
// Dispersion réelle des Sharpe journaliers des essais (pour le Sharpe dégonflé).
const trialSd = (() => { const s = rows.map(x => { const r = x.tr.r, m = r.reduce((a, y) => a + y, 0) / r.length; const sd = Math.sqrt(r.reduce((a, y) => a + (y - m) ** 2, 0) / r.length); return sd > 0 ? m / sd : 0 }); const m = s.reduce((a, y) => a + y, 0) / s.length; return Math.sqrt(s.reduce((a, y) => a + (y - m) ** 2, 0) / (s.length - 1)) })()
for (const x of candOut) x.dsrTrain = dsr(x.tr.r, trials, trialSd).p

// ---------------------------------------------------------------- 4. Shock Engine V1 (sleeve BTC publiée), mêmes périodes
const v1 = readFileSync('research/reports/reference/reference_daily_returns.csv', 'utf8').trim().split('\n').slice(1).map(s => s.split(',')).map(p => ({ d: Date.parse(p[0]), r: +p[1] }))
const v1m = (a: number, z1: number) => {
  const r = v1.filter(x => x.d >= a && x.d < z1).map(x => x.r)
  let e = 1, pk = 1, mdd = 0
  for (const x of r) { e *= 1 + x; pk = Math.max(pk, e); mdd = Math.min(mdd, e / pk - 1) }
  const m = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length)
  return { cagr: Math.pow(e, 365.25 / r.length) - 1, sharpe: (m / sd) * Math.sqrt(365.25), mdd, from: new Date(a).toISOString().slice(0, 10) }
}
const v1Train = v1m(Date.parse('2018-09-01'), T1), v1Valid = v1m(T1, T2)

// ---------------------------------------------------------------- rapport
const pc = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '—').replace('.', ',')
const nm = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—').replace('.', ',').replace('-', '−')
const desc = (e: Entry, ex: Exit) => `z ${e.zMin} · réintégration ${e.reentry} · mèche ${e.wickThr} · ${e.volDiv ? `vol z < ${e.volMin}` : 'sans filtre volume'} · stop ${ex.stop} ATR${ex.tpR ? ` · TP ${ex.tpR}R` : ''}${ex.trail ? ' · suiveur' : ''}`
const row = (name: string, tr: Res, va: Res | null) => `| ${name} | ${pc(tr.cagr)} | ${nm(tr.sharpe)} | ${pc(tr.mdd)} | ${nm(tr.pf)} | ${tr.trades} | ${pc(tr.win)} | ${va ? nm(va.sharpe) : '—'} |`
const L: string[] = []
L.push('# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD 15 min', '')
L.push(`Bitstamp 15 min. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins ${MIN_TRADES} trades. Essais : ${trials} (${rows.length} entrées + ${exitRows.length - 1} sorties). Produit par \`node research/ou-channel/ou-study.ts\`.`, '')
L.push('| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |', '|---|---|---|---|---|---|---|---|')
L.push(row('Baseline (réglages d\'origine, stop 3,3 ATR)', baseTr, baseVa))
top5.forEach((x, k) => L.push(row(`Top ${k + 1} entraînement · ${desc(x.e, x.ex)}`, x.tr, valid(sigOf(x.e), x.ex))))
L.push('', `Grille d'entrée : ${positive}/${rows.length} configurations à Sharpe d'entraînement > 0.`, '')
L.push('## Candidates (validation)', '', '| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |', '|---|---|---|---|---|---|---|---|---|---|')
for (const x of candOut) L.push(`| ${desc(x.e, x.ex)} | ${nm(x.tr.sharpe)} | ${nm(x.va.sharpe)} | ${pc(x.va.cagr)} | ${pc(x.va.mdd)} | ${nm(x.va.pf)} | ${x.va.trades} | ${nm(x.va2.sharpe)} | ${nm(x.nbTrain)} · ${nm(x.nbValid)} · ${pc(x.nbValidPos)} | ${nm(x.dsrTrain, 3)} |`)
L.push('', '## Sorties testées sur la meilleure entrée (entraînement)', '', '| Sortie | Sharpe | CAGR | MDD | PF | Trades |', '|---|---|---|---|---|---|')
for (const x of exitRows) L.push(`| stop ${x.ex.stop} · ${x.ex.tpR ? `TP ${x.ex.tpR}R` : 'sans TP'} · ${x.ex.trail ? 'suiveur' : 'sans suiveur'} | ${nm(x.tr.sharpe)} | ${pc(x.tr.cagr)} | ${pc(x.tr.mdd)} | ${nm(x.tr.pf)} | ${x.tr.trades} |`)
L.push('', `## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)`, '', `Entraînement (${v1Train.from} → 2022-12-31) : CAGR ${pc(v1Train.cagr)}, Sharpe ${nm(v1Train.sharpe)}, MDD ${pc(v1Train.mdd)} · validation 2023-01-01 → 2026-09-30 : CAGR ${pc(v1Valid.cagr)}, Sharpe ${nm(v1Valid.sharpe)}, MDD ${pc(v1Valid.mdd)}.`)
mkdirSync('research/reports/ou-channel', { recursive: true })
writeFileSync('research/reports/ou-channel/ou-channel.md', L.join('\n') + '\n')
const strip = (r: Res) => { const { r: _r, ...x } = r; return x }
writeFileSync('research/reports/ou-channel/ou-channel.json', JSON.stringify({ trials, baseline: { train: strip(baseTr), valid: strip(baseVa) }, top5: top5.map(x => ({ entry: x.e, exit: x.ex, train: strip(x.tr), valid: strip(valid(sigOf(x.e), x.ex)) })), candidates: candOut.map(x => ({ entry: x.e, exit: x.ex, train: strip(x.tr), valid: strip(x.va), validFees2: strip(x.va2), nbTrain: x.nbTrain, nbValid: x.nbValid, nbValidPos: x.nbValidPos, dsrTrain: x.dsrTrain })), exits: exitRows.map(x => ({ exit: x.ex, train: strip(x.tr) })), v1: { train: v1Train, valid: v1Valid }, trialSd }, null, 1))
console.log(L.join('\n'))
