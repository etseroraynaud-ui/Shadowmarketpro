// P1 de l'étude de capacité : chaque exécution du backtest, placée sur le perpétuel Binance
// (research/preregistration/capacity-p0p1.md, § 6).
//
// - Entrées et sorties à la clôture : instant de décision = clôture de la bougie de signal ; prix de
//   référence = dernier prix du perpétuel avant cet instant.
// - Stops, stops suiveurs et TP1 : première minute de la bougie où le perpétuel franchit le niveau
//   converti (niveau × prix du perpétuel / prix d'entrée du backtest, mesurés à l'entrée). Sans
//   franchissement : « non localisée ».
// - Conditionnement strictement avant l'instant (volatilité 24 h et 60 min, volume 24 h,
//   profondeur bookDepth) ; dérive et volume après l'instant comme résultats.
// Les lignes par exécution (horodatées) restent hors git : research/data/binance/derived/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BINANCE_START, KEYS, NAMES, familyOf, fillDay, loadPublished, runFills, windowOf } from './lib.ts'
import type { Family, FillKind, Run, SleeveKey } from './lib.ts'
import { DATA, MIN, SYM, T0, depthAt, loadDepth, loadMinutes } from './binance.ts'
import type { Depth, Minutes } from './binance.ts'
import { DEPTH_FROM, DEPTH_TO, KLINES_TO } from './data.ts'

export const HORIZONS_MIN = [1, 3, 5, 15] as const
export const MAX_MIN = 60

export interface Event {
  key: SleeveKey
  /** Indice de l'exécution dans run.fills. */
  fi: number
  pos: number
  kind: FillKind
  family: Family
  /** +1 achat, −1 vente ; sens de la position. */
  side: 1 | -1
  dir: 1 | -1
  frac: number
  /** Instant de l'événement sur le perpétuel (ms) et minute qui le contient. */
  t: number
  located: boolean
  /** Prix de référence sur le perpétuel (dernier prix avant décision, ou niveau converti). */
  ref: number
  /** Écart de base à l'entrée de la position : prix du perpétuel / prix du marché de signal − 1. */
  basis: number
  /** Conditionnement, avant l'instant : volatilités journalières (fraction), volume 24 h (USDT). */
  sigma24: number
  sigma60: number
  v24: number
  /** Dérive dans le sens du coût (positif = défavorable à l'ordre) aux horizons, en fraction ; VWAP idem. */
  drift: number[]
  driftVwap: number[]
  /** Volume cumulé après l'instant, minute par minute, 0 à 60 : en dollars (USDT) et en actif (pour le VWAP). */
  cum: number[]
  cumV: number[]
  /** Profondeur du côté consommé à ±1 % et ±5 %, et médiane des 7 jours précédents (±1 %) ; NaN avant 2023. */
  depth1: number
  depth5: number
  depth1Median7d: number
  /** Résultat de la position (net de commission), pour les strates du pilote. */
  pnlPct: number
  entryT: number
}

function sigmaOf(m: Minutes, from: number, to: number): number {
  let s = 0, s2 = 0, n = 0
  for (let j = Math.max(from, 1); j < to; j++) { const a = m.c[j - 1], b = m.c[j]; if (!(a > 0 && b > 0)) continue; const x = Math.log(b / a); s += x; s2 += x * x; n++ }
  if (n < 10) return NaN
  const mu = s / n
  return Math.sqrt(Math.max(s2 / n - mu * mu, 0) * 1440)
}

function median7d(d: Depth, side: 'bid1' | 'ask1', t: number): number {
  let lo = 0, hi = d.t.length
  while (lo < hi) { const md = (lo + hi) >> 1; if (d.t[md] < t - 7 * 864e5) lo = md + 1; else hi = md }
  const a = lo
  lo = a; hi = d.t.length
  while (lo < hi) { const md = (lo + hi) >> 1; if (d.t[md] < t) lo = md + 1; else hi = md }
  const arr = d[side].slice(a, lo).filter(Number.isFinite).sort()
  return arr.length ? arr[Math.floor(arr.length / 2)] : NaN
}

export async function buildEvents(): Promise<{ events: Event[]; runs: Record<SleeveKey, Run>; zeroVolumeMinutes: Record<string, number> }> {
  const S = loadPublished()
  const W = windowOf(S, 'binance', BINANCE_START)
  const runs = {} as Record<SleeveKey, Run>
  const events: Event[] = []
  const zeroVolumeMinutes: Record<string, number> = {}
  for (const k of KEYS) {
    const run = runFills(S[k])
    runs[k] = run
    const { m } = await loadMinutes(SYM[k], KLINES_TO)
    const { d } = await loadDepth(SYM[k], DEPTH_FROM, DEPTH_TO)
    const t = S[k].bars.t
    let zv = 0
    for (let j = 0; j < m.n; j++) if (m.v[j] === 0) zv++
    zeroVolumeMinutes[NAMES[k]] = zv
    const entryOf = new Map<number, { px: number; tDec: number }>()
    for (const f of run.fills) if (f.kind === 'entry') entryOf.set(f.pos, { px: f.px, tDec: t[f.i] + 15 * MIN })
    const pnlOf = new Map(run.positions.map(p => [p.pos, p.pnlPct]))
    const dirOf = new Map(run.positions.map(p => [p.pos, p.dir]))
    for (let fi = 0; fi < run.fills.length; fi++) {
      const f = run.fills[fi]
      if (fillDay(run, f, W) < 0) continue
      const fam = familyOf(f.kind)
      const e = entryOf.get(f.pos)!
      const mEntry = Math.round((e.tDec - T0) / MIN)
      const basisRatio = m.c[mEntry - 1] / e.px
      let mEv: number, ref: number, located = true, tEv: number
      if (fam === 'entry' || fam === 'close') {
        tEv = t[f.i] + 15 * MIN
        mEv = Math.round((tEv - T0) / MIN)
        ref = m.c[mEv - 1]
      } else {
        const L = f.px * basisRatio
        const m0 = Math.round((t[f.i] - T0) / MIN)
        let found = -1
        for (let j = m0; j < m0 + 15; j++) {
          const crossDown = m.l[j] <= L, crossUp = m.h[j] >= L
          const hit = fam === 'stop' ? (f.side === -1 ? crossDown : crossUp) : (f.side === -1 ? crossUp : crossDown)
          if (hit) { found = j; break }
        }
        if (found < 0) { located = false; found = m0 }
        mEv = found
        tEv = T0 + mEv * MIN
        ref = located ? L : m.c[mEv - 1]
      }
      const P = (j: number) => m.c[j]
      const drift = HORIZONS_MIN.map(h => f.side * (P(mEv + h - 1) / ref - 1))
      const driftVwap = HORIZONS_MIN.map(h => {
        let qv = 0, v = 0
        for (let j = mEv; j < mEv + h; j++) { qv += m.qv[j]; v += m.v[j] }
        return v > 0 ? f.side * (qv / v / ref - 1) : NaN
      })
      const cum = [0], cumV = [0]
      for (let j = 0; j < MAX_MIN; j++) { cum.push(cum[j] + m.qv[mEv + j]); cumV.push(cumV[j] + m.v[mEv + j]) }
      let v24 = 0
      for (let j = mEv - 1440; j < mEv; j++) v24 += m.qv[j]
      let depth1 = NaN, depth5 = NaN, depth1Median7d = NaN
      if (tEv >= DEPTH_FROM + 7 * 864e5) {
        const kk = depthAt(d, tEv - 1)
        const side = f.side === 1 ? 'ask1' : 'bid1'
        if (kk >= 0) { depth1 = d[side][kk]; depth5 = f.side === 1 ? d.ask5[kk] : d.bid5[kk] }
        depth1Median7d = median7d(d, side, tEv)
      }
      events.push({
        key: k, fi, pos: f.pos, kind: f.kind, family: fam, side: f.side, dir: dirOf.get(f.pos) ?? (f.kind === 'entry' ? f.side : (-f.side as 1 | -1)), frac: f.frac,
        t: tEv, located, ref, basis: basisRatio - 1,
        sigma24: sigmaOf(m, mEv - 1440, mEv), sigma60: sigmaOf(m, mEv - 60, mEv), v24,
        drift, driftVwap, cum, cumV, depth1, depth5, depth1Median7d,
        pnlPct: pnlOf.get(f.pos) ?? NaN, entryT: e.tDec,
      })
    }
    process.stderr.write(`${NAMES[k]} : ${events.filter(x => x.key === k).length} exécutions placées sur ${SYM[k]}\n`)
  }
  mkdirSync(join(DATA, 'derived'), { recursive: true })
  writeFileSync(join(DATA, 'derived', 'events.json'), JSON.stringify(events))
  return { events, runs, zeroVolumeMinutes }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { events, zeroVolumeMinutes } = await buildEvents()
  const by = (f: Family) => events.filter(e => e.family === f)
  process.stderr.write(`minutes à volume nul : ${JSON.stringify(zeroVolumeMinutes)}\n`)
  for (const f of ['entry', 'stop', 'tp1', 'close'] as Family[]) {
    const xs = by(f)
    process.stderr.write(`${f} : ${xs.length}, localisées ${xs.filter(e => e.located).length}, base médiane ${(xs.map(e => e.basis).sort((a, b) => a - b)[Math.floor(xs.length / 2)] * 1e4).toFixed(1)} pb\n`)
  }
}
