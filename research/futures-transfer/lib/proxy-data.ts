// Données de l'étude de transfert : chargement des bougies 15 min, jours de séance du régime, heure de
// New York (heure d'été par la base IANA), séances, créneaux d'annonces et audit des données
// (research/preregistration/futures-k-transfer.md § 1 et additif sur substituts).

import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import type { Bars } from '../../../lib/backtest/types.ts'
import { atr } from '../../../lib/backtest/indicators.ts'

export const DAY = 864e5
export const M15 = 15 * 60000

/** Lecteur CSV de zero-shot.ts (horodatage ms UTC à l'ouverture, o, h, l, c, v) ; refuse un horodatage non croissant. */
export function loadCsv(path: string): Bars {
  const raw = readFileSync(path)
  const text = (path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('latin1')
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  for (const s of text.split('\n')) {
    if (!s || !/^\d/.test(s)) continue
    const p = s.split(',')
    const ts = +p[0]
    if (t.length && ts <= t[t.length - 1]) throw new Error(`${path} : horodatages non croissants à ${ts}`)
    t.push(ts); o.push(+p[1]); h.push(+p[2]); l.push(+p[3]); c.push(+p[4]); v.push(+(p[5] ?? 0))
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

/** Copie de sessionDays() de research/shock/zero-shot.ts : jours clos à 22 h UTC, datés du lendemain minuit UTC. */
export function sessionDays(b: Bars): Bars {
  const t: number[] = [], o: number[] = [], h: number[] = [], l: number[] = [], c: number[] = [], v: number[] = []
  let key = -1
  for (let i = 0; i < b.n; i++) {
    const k = Math.floor((b.t[i] + 2 * 3600000) / DAY)
    if (k !== key) { key = k; t.push(k * DAY); o.push(b.o[i]); h.push(b.h[i]); l.push(b.l[i]); c.push(b.c[i]); v.push(b.v[i]) }
    else { const j = t.length - 1; h[j] = Math.max(h[j], b.h[i]); l[j] = Math.min(l[j], b.l[i]); c[j] = b.c[i]; v[j] += b.v[i] }
  }
  return { n: t.length, t: Float64Array.from(t), o: Float64Array.from(o), h: Float64Array.from(h), l: Float64Array.from(l), c: Float64Array.from(c), v: Float64Array.from(v) }
}

const nyFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
/** Décalage de New York sur UTC (minutes), par heure UTC : le changement d'heure tombe toujours sur une heure pleine. */
const nyOffsetCache = new Map<number, number>()
function nyOffsetAt(hourKey: number): number {
  let off = nyOffsetCache.get(hourKey)
  if (off === undefined) {
    const parts = Object.fromEntries(nyFmt.formatToParts(new Date(hourKey * 3600000)).map(p => [p.type, p.value]))
    const local = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute)
    off = Math.round((local - hourKey * 3600000) / 60000)
    nyOffsetCache.set(hourKey, off)
  }
  return off
}

/** Heure de New York de chaque bougie : minute du jour (0–1439), jour de la semaine (0 = dimanche), décalage UTC en minutes. */
export function newYorkClock(t: Float64Array): { min: Int16Array; wday: Int8Array; offset: Int16Array } {
  const n = t.length
  const min = new Int16Array(n), wday = new Int8Array(n), offset = new Int16Array(n)
  for (let i = 0; i < n; i++) {
    const off = nyOffsetAt(Math.floor(t[i] / 3600000))
    const x = t[i] + off * 60000
    min[i] = Math.floor((((x % DAY) + DAY) % DAY) / 60000)
    wday[i] = new Date(x).getUTCDay()
    offset[i] = off
  }
  return { min, wday, offset }
}

/** Plages horaires de New York du projet (zero-shot.ts), lecture seulement. */
export const BLOCKS: [string, (mn: number) => boolean][] = [
  ['Asie (18 h – 2 h)', mn => mn >= 18 * 60 || mn < 2 * 60],
  ['Londres (2 h – 8 h)', mn => mn >= 2 * 60 && mn < 8 * 60],
  ['New York matin (8 h – 12 h)', mn => mn >= 8 * 60 && mn < 12 * 60],
  ['dont bougie de 8 h 30 (annonces)', mn => mn >= 8 * 60 + 30 && mn < 8 * 60 + 45],
  ['New York après-midi (12 h – 18 h)', mn => mn >= 12 * 60 && mn < 18 * 60],
]

/** Séance principale de l'instrument visé (lecture seulement) : NQ 9 h 30 – 16 h ET, GC 8 h 20 – 13 h 30 ET. */
export const MAIN_SESSION: Record<'gold' | 'nasdaq' | 'test', [string, (mn: number) => boolean]> = {
  nasdaq: ['séance régulière 9 h 30 – 16 h ET', mn => mn >= 9 * 60 + 30 && mn < 16 * 60],
  gold: ['séance de jour COMEX 8 h 20 – 13 h 30 ET', mn => mn >= 8 * 60 + 15 && mn < 13 * 60 + 30],
  test: ['séance régulière 9 h 30 – 16 h ET', mn => mn >= 9 * 60 + 30 && mn < 16 * 60],
}

/** Créneaux d'annonces (étiquette de la bougie du choc, heure de New York) ; sans calendrier officiel. */
export const SLOTS: [string, (mn: number) => boolean][] = [
  ['8 h 30 ET (publications macro)', mn => mn >= 8 * 60 + 30 && mn < 8 * 60 + 45],
  ['10 h ET', mn => mn >= 10 * 60 && mn < 10 * 60 + 15],
  ['14 h – 14 h 45 ET (FOMC)', mn => mn >= 14 * 60 && mn < 14 * 60 + 45],
]
export const inAnySlot = (mn: number) => SLOTS.some(([, f]) => f(mn))

/**
 * Heures prévues de cotation (Globex et CFD) : du dimanche 18 h au vendredi 17 h, heure de New York,
 * hors pause quotidienne 17 h – 18 h.
 */
export function expectedOpen(mn: number, wday: number): boolean {
  if (wday === 6) return false
  if (wday === 5 && mn >= 17 * 60) return false
  if (wday === 0 && mn < 18 * 60) return false
  return !(mn >= 17 * 60 && mn < 18 * 60)
}

export interface Session { key: number; y: number; exp: number; pres: number; firstT: number }

/** Séances (18 h → 17 h, heure de New York) de [a, z] : quarts d'heure prévus, présents, première bougie. */
export function sessionsOf(b: Bars, a: number, z: number): Session[] {
  const { t } = b
  const present = new Set<number>()
  for (let i = a; i <= z; i++) present.add(t[i])
  const out = new Map<number, Session>()
  const t0 = Math.ceil(t[a] / M15) * M15, t1 = t[z]
  for (let x = t0; x <= t1; x += M15) {
    const k = newYorkClock(Float64Array.of(x))
    if (!expectedOpen(k.min[0], k.wday[0])) continue
    const local = x + k.offset[0] * 60000
    const key = Math.floor((local + 6 * 3600000) / DAY)
    const e = out.get(key) ?? { key, y: new Date(local + 6 * 3600000).getUTCFullYear(), exp: 0, pres: 0, firstT: NaN }
    e.exp++
    if (present.has(x)) { e.pres++; if (Number.isNaN(e.firstT)) e.firstT = x }
    out.set(key, e)
  }
  return [...out.values()].sort((p, q) => p.key - q.key)
}

/**
 * Début de couverture continue (additif sur substituts) : première bougie de la première suite de
 * `run` séances consécutives ayant chacune au moins `share` de leurs quarts d'heure prévus.
 */
export function coverageStart(b: Bars, run = 20, share = 0.8): { t: number; sessions: number } {
  const ss = sessionsOf(b, 0, b.n - 1)
  let streak = 0
  for (let j = 0; j < ss.length; j++) {
    streak = ss[j].pres >= share * ss[j].exp ? streak + 1 : 0
    if (streak === run) return { t: ss[j - run + 1].firstT, sessions: ss.length }
  }
  return { t: NaN, sessions: ss.length }
}

export interface DataAudit {
  first: string
  last: string
  bars: number
  years: { y: number; expected: number; present: number; missingShare: number; holidays: number; unscheduledGaps60: number }[]
  gapsAfterClosure: number
  zeroVolume: number
  badTicks: { t: string; dev: number }[]
  nonMonotonic: number
  ohlcErrors: number
  nonPositive: number
  priceStep: number
  largestMoves: { t: string; z: number; afterGap: boolean }[]
  checks: { name: string; ok: boolean; detail: string }[]
}

/** Audit des données du § 1 du protocole sur [lo, end] (contrôles bloquants listés dans `checks`). */
export function auditData(b: Bars, lo: number, end: number): DataAudit {
  const { t, o, h, l, c, v } = b
  const iso = (i: number) => new Date(t[i]).toISOString().slice(0, 16).replace('T', ' ')
  let nonMonotonic = 0, ohlcErrors = 0, nonPositive = 0, zeroVolume = 0, gapsAfterClosure = 0
  for (let i = lo; i <= end; i++) {
    if (i > lo && !(t[i] > t[i - 1])) nonMonotonic++
    if (!(l[i] <= Math.min(o[i], c[i]) + 1e-9 && Math.max(o[i], c[i]) <= h[i] + 1e-9)) ohlcErrors++
    if (!(l[i] > 0)) nonPositive++
    if (!(v[i] > 0)) zeroVolume++
    if (i > lo && t[i] - t[i - 1] > M15) gapsAfterClosure++
  }
  // Bougies présentes par quart d'heure prévu ; un jour de séance (18 h → 17 h ET) avec moins de 10 %
  // de ses bougies prévues est compté comme férié et sorti du dénominateur.
  const years = new Map<number, { expected: number; present: number; holidays: number; unscheduledGaps60: number }>()
  for (const e of sessionsOf(b, lo, end)) {
    const y = years.get(e.y) ?? { expected: 0, present: 0, holidays: 0, unscheduledGaps60: 0 }
    if (e.pres < 0.1 * e.exp) y.holidays++
    else { y.expected += e.exp; y.present += e.pres }
    years.set(e.y, y)
  }
  const nyAt = (ms: number) => newYorkClock(Float64Array.of(ms))
  // Trous imprévus de plus de 60 min : écart entre deux bougies qui couvre au moins 4 quarts d'heure prévus.
  for (let i = lo + 1; i <= end; i++) {
    if (t[i] - t[i - 1] <= 60 * 60000) continue
    let exp = 0
    for (let x = t[i - 1] + M15; x < t[i]; x += M15) { const k = nyAt(x); if (expectedOpen(k.min[0], k.wday[0])) exp++ }
    // Au moins 4 quarts d'heure prévus manquants ; une séance entière absente (≥ 80 quarts d'heure) est un férié.
    if (exp >= 4 && exp < 80) {
      const y = years.get(new Date(t[i]).getUTCFullYear())
      if (y) y.unscheduledGaps60++
    }
  }
  const a14 = atr(h, l, c, 14)
  const badTicks: { t: string; dev: number }[] = []
  for (let i = Math.max(lo, 1); i <= end; i++) {
    const A = a14[i - 1]
    if (!(A > 0)) continue
    const devH = Math.min(Math.abs(h[i] - c[i - 1]), Math.abs(h[i] - c[i])) / A
    const devL = Math.min(Math.abs(l[i] - c[i - 1]), Math.abs(l[i] - c[i])) / A
    const dev = Math.max(devH, devL)
    if (dev > 8) badTicks.push({ t: iso(i), dev })
  }
  // Pas de prix : plus petit écart non nul entre prix, arrondi au millième.
  let step = Infinity
  for (let i = lo + 1; i <= Math.min(end, lo + 20000); i++) { const d = Math.abs(c[i] - c[i - 1]); if (d > 1e-9 && d < step) step = d }
  const priceStep = Math.round(step * 1000) / 1000
  // Plus forts rendements 15 min, en écarts types hors bougies après trou.
  let s2 = 0, cnt = 0
  for (let i = lo + 1; i <= end; i++) if (t[i] - t[i - 1] <= M15) { s2 += Math.log(c[i] / c[i - 1]) ** 2; cnt++ }
  const sd = Math.sqrt(s2 / cnt)
  const moves: { t: string; z: number; afterGap: boolean }[] = []
  for (let i = lo + 1; i <= end; i++) moves.push({ t: iso(i), z: Math.log(c[i] / c[i - 1]) / sd, afterGap: t[i] - t[i - 1] > M15 })
  moves.sort((x, y) => Math.abs(y.z) - Math.abs(x.z))
  const yrs = [...years.entries()].sort((x, y) => x[0] - y[0]).map(([y, e]) => ({ y, ...e, missingShare: e.expected ? 1 - e.present / e.expected : NaN }))
  const full = yrs.filter(y => y.expected > 0)
  const checks = [
    { name: 'horodatages strictement croissants', ok: nonMonotonic === 0, detail: String(nonMonotonic) },
    { name: 'bas ≤ ouverture, clôture ≤ haut', ok: ohlcErrors === 0, detail: String(ohlcErrors) },
    { name: 'prix > 0', ok: nonPositive === 0, detail: String(nonPositive) },
    { name: 'bougies manquantes < 1 % par an (heures prévues, fériés exclus)', ok: full.every(y => y.missingShare < 0.01), detail: full.map(y => `${y.y} ${(y.missingShare * 100).toFixed(2)} %`).join(' · ') },
    { name: 'au plus 10 trous imprévus de plus de 60 min par an', ok: full.every(y => y.unscheduledGaps60 <= 10), detail: full.map(y => `${y.y} ${y.unscheduledGaps60}`).join(' · ') },
    { name: 'au plus 20 mauvais ticks (> 8 ATR de la clôture précédente et de la clôture)', ok: badTicks.length <= 20, detail: String(badTicks.length) },
  ]
  return {
    first: iso(lo), last: iso(end), bars: end - lo + 1, years: yrs, gapsAfterClosure, zeroVolume, badTicks: badTicks.slice(0, 40),
    nonMonotonic, ohlcErrors, nonPositive, priceStep, largestMoves: moves.slice(0, 10), checks,
  }
}
