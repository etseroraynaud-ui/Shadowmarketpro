// Lecture des données de marché : CSV OHLCV des sources courantes (TradingView, Binance,
// Yahoo, MetaTrader, exports maison), contrôle de cohérence, détection du timeframe.

import type { Bars, Msg } from './types.ts'

export interface CsvTable {
  head: string[]
  rows: string[][]
  delimiter: string
}

/** Découpe un CSV : séparateur deviné (, ; tabulation), guillemets gérés, lignes vides ignorées. */
export function parseCsv(text: string): CsvTable {
  const clean = text.replace(/^﻿/, '')
  const firstLines = clean.split(/\r?\n/).filter(l => l.trim()).slice(0, 5)
  const count = (d: string) => firstLines.reduce((s, l) => s + l.split(d).length - 1, 0)
  const cands = [',', ';', '\t', '|']
  let delimiter = ','
  let best = -1
  for (const d of cands) {
    const k = count(d)
    if (k > best) { best = k; delimiter = d }
  }
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delimiter) { row.push(field.trim()); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field.trim()); field = ''
      if (row.some(x => x !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field.trim())
  if (row.some(x => x !== '')) rows.push(row)
  if (!rows.length) return { head: [], rows: [], delimiter }
  const looksHeader = rows[0].some(x => x !== '' && !isNumberLike(x, delimiter) && !isDateLike(x))
  const head = looksHeader ? rows.shift()!.map(h => h.replace(/^"|"$/g, '')) : rows[0].map((_, i) => `col${i + 1}`)
  return { head, rows, delimiter }
}

function isNumberLike(s: string, delimiter: string): boolean {
  return Number.isFinite(toNumber(s, delimiter))
}

function isDateLike(s: string): boolean {
  return /^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(s) || /^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}/.test(s)
}

/** Nombre au format anglais ou européen (virgule décimale quand le séparateur est « ; »). */
export function toNumber(s: string, delimiter = ','): number {
  if (s == null) return NaN
  let x = s.trim().replace(/\s| |_/g, '').replace(/^"|"$/g, '')
  if (x === '') return NaN
  if (delimiter !== ',' && /^-?[\d.]*,\d+$/.test(x)) x = x.replace(/\./g, '').replace(',', '.')
  else x = x.replace(/,(?=\d{3}(\D|$))/g, '')
  const v = Number(x)
  return Number.isFinite(v) ? v : NaN
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  janv: 1, fevr: 2, févr: 2, mars: 3, avr: 4, mai: 5, juin: 6, juil: 7, aout: 8, août: 8, sept: 9, déc: 12,
}

/**
 * Horodatage en ms UTC. Accepte : secondes ou millisecondes Unix, ISO 8601, « AAAA-MM-JJ hh:mm »,
 * « AAAA.MM.JJ » (MetaTrader), « JJ/MM/AAAA » ou « MM/JJ/AAAA » (`dayFirst` tranche), « 02 Jan 2024 ».
 * Sans fuseau, l'heure est lue en UTC.
 */
export function parseTime(raw: string, dayFirst: boolean | null = null): number {
  const s = raw.trim().replace(/^"|"$/g, '')
  if (!s) return NaN
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const v = Number(s)
    if (v > 1e14) return Math.round(v / 1000) // microsecondes
    if (v > 1e11) return v // millisecondes
    if (v > 1e8) return v * 1000 // secondes
    if (/^\d{8}$/.test(s)) return Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8))
    return NaN
  }
  let m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?)?\s*(Z|UTC|GMT|[+-]\d{2}:?\d{2})?$/i)
  if (m) {
    const ms = m[7] ? Math.round(Number('0.' + m[7]) * 1000) : 0
    let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0), ms)
    if (m[8] && /^[+-]/.test(m[8])) {
      const z = m[8].replace(':', '')
      const off = (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5))) * 60000
      t -= z[0] === '+' ? off : -off
    }
    return t
  }
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})(?:[T\s,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (m) {
    let a = +m[1], b = +m[2]
    let y = +m[3]
    if (y < 100) y += y < 70 ? 2000 : 1900
    let d: number, mo: number
    if (dayFirst === true || a > 12) { d = a; mo = b } else if (dayFirst === false || b > 12) { d = b; mo = a } else { d = a; mo = b }
    return Date.UTC(y, mo - 1, d, +(m[4] || 0), +(m[5] || 0), +(m[6] || 0))
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-zéû]+)\.?\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/)
  if (m && MONTHS[m[2].toLowerCase()]) return Date.UTC(+m[3], MONTHS[m[2].toLowerCase()] - 1, +m[1], +(m[4] || 0), +(m[5] || 0))
  const v = Date.parse(s)
  return Number.isFinite(v) ? v : NaN
}

/** Devine si les dates « a/b/AAAA » d'une colonne mettent le jour en premier. */
function guessDayFirst(values: string[]): boolean | null {
  let dayFirst = false
  let monthFirst = false
  for (const v of values) {
    const m = v.trim().match(/^(\d{1,2})[-./](\d{1,2})[-./]\d{2,4}/)
    if (!m) continue
    if (+m[1] > 12) dayFirst = true
    if (+m[2] > 12) monthFirst = true
  }
  if (dayFirst && !monthFirst) return true
  if (monthFirst && !dayFirst) return false
  return null
}

const ALIASES: Record<string, string[]> = {
  time: ['time', 'timestamp', 'date', 'datetime', 'date time', 'open time', 'open_time', 'opentime', 'ts', 'unix', 'gmt time', 'local time', 'day'],
  clock: ['heure', 'hour', 'clock', 'time of day'],
  open: ['open', 'o', 'ouverture', 'opening price', 'open price'],
  high: ['high', 'h', 'haut', 'plus haut', 'high price', 'max'],
  low: ['low', 'l', 'bas', 'plus bas', 'low price', 'min'],
  close: ['close', 'c', 'clôture', 'cloture', 'last', 'price', 'prix', 'close price', 'adj close', 'adj_close', 'adjclose', 'dernier'],
  volume: ['volume', 'vol', 'v', 'volume usd', 'volume btc', 'base volume', 'tick volume', 'tickvol', 'qty'],
}

function findCol(head: string[], key: string, taken: Set<number>): number {
  const norm = head.map(h => h.toLowerCase().replace(/[<>"']/g, '').trim())
  for (const alias of ALIASES[key]) {
    const i = norm.findIndex((h, k) => !taken.has(k) && h === alias)
    if (i >= 0) return i
  }
  if (key === 'volume') {
    const i = norm.findIndex((h, k) => !taken.has(k) && h.startsWith('volume'))
    if (i >= 0) return i
  }
  if (key === 'close') {
    const i = norm.findIndex((h, k) => !taken.has(k) && h.includes('close'))
    if (i >= 0) return i
  }
  return -1
}

export interface LoadedData {
  bars: Bars
  /** Durée typique d'une barre, en ms. */
  barMs: number
  timeframe: string
  warnings: Msg[]
  /** Nombre de lignes lues et rejetées. */
  read: number
  rejected: number
}

export class DataError extends Error {
  msg: Msg
  constructor(msg: Msg) {
    super(msg.en)
    this.msg = msg
  }
}

/** Lit un CSV OHLCV. Les lignes illisibles sont comptées et écartées ; les barres sont triées. */
export function loadBarsFromCsv(text: string): LoadedData {
  const tab = parseCsv(text)
  if (!tab.rows.length) throw new DataError({ fr: 'Le fichier est vide.', en: 'The file is empty.' })
  const taken = new Set<number>()
  const pick = (k: string) => {
    const i = findCol(tab.head, k, taken)
    if (i >= 0) taken.add(i)
    return i
  }
  let ti = pick('time')
  let ci = pick('clock')
  let oi = pick('open')
  let hi = pick('high')
  let li = pick('low')
  let cl = pick('close')
  let vi = pick('volume')
  const generic = tab.head.every(h => /^col\d+$/.test(h))
  if (generic) {
    // Sans en-tête : temps, ouverture, haut, bas, clôture, volume (ordre le plus répandu).
    ti = 0; oi = 1; hi = 2; li = 3; cl = 4; vi = tab.head.length > 5 ? 5 : -1; ci = -1
    if (tab.head.length < 5) {
      if (tab.head.length >= 2) { oi = hi = li = -1; cl = 1 } else throw new DataError({ fr: 'Il faut au moins une colonne de date et une colonne de prix.', en: 'At least a date column and a price column are needed.' })
    }
  }
  if (ti < 0) throw new DataError({ fr: 'Colonne de date introuvable (time, date, timestamp…).', en: 'No date column found (time, date, timestamp…).' })
  if (cl < 0) throw new DataError({ fr: 'Colonne de clôture introuvable (close, price…).', en: 'No close column found (close, price…).' })
  // MetaTrader et d'autres séparent la date et l'heure : une colonne « time » qui ne contient
  // que des heures devient l'heure de la colonne « date ».
  const clockLike = (k: number) => k >= 0 && tab.rows.slice(0, 5).every(r => /^\d{1,2}:\d{2}(:\d{2})?$/.test((r[k] || '').trim()))
  if (clockLike(ti)) {
    const di = tab.head.findIndex((h, k) => k !== ti && /^<?\s*(date|day|jour)\s*>?$/i.test(h.trim()))
    if (di >= 0) { ci = ti; ti = di }
  }
  if (ci >= 0 && !clockLike(ci)) ci = -1
  const dayFirst = guessDayFirst(tab.rows.slice(0, 500).map(r => r[ti] || ''))
  const recs: [number, number, number, number, number, number][] = []
  let rejected = 0
  const d = tab.delimiter
  for (const r of tab.rows) {
    const t = parseTime(ci >= 0 ? `${r[ti]} ${r[ci]}` : (r[ti] ?? ''), dayFirst)
    const c = toNumber(r[cl] ?? '', d)
    if (!Number.isFinite(t) || !Number.isFinite(c) || c <= 0) { rejected++; continue }
    let o = oi >= 0 ? toNumber(r[oi] ?? '', d) : c
    let h = hi >= 0 ? toNumber(r[hi] ?? '', d) : c
    let l = li >= 0 ? toNumber(r[li] ?? '', d) : c
    if (!Number.isFinite(o) || o <= 0) o = c
    if (!Number.isFinite(h)) h = Math.max(o, c)
    if (!Number.isFinite(l) || l <= 0) l = Math.min(o, c)
    const v = vi >= 0 ? toNumber(r[vi] ?? '', d) : 0
    recs.push([t, o, h, l, c, Number.isFinite(v) && v >= 0 ? v : 0])
  }
  if (recs.length < 2) throw new DataError({ fr: 'Moins de deux barres lisibles dans le fichier.', en: 'Fewer than two readable bars in the file.' })
  return finish(recs, tab.rows.length, rejected)
}

/** Construit des barres depuis des enregistrements [t, o, h, l, c, v] (ordre quelconque). */
export function barsFromRecords(recs: [number, number, number, number, number, number][]): LoadedData {
  return finish(recs.slice(), recs.length, 0)
}

function finish(recs: [number, number, number, number, number, number][], read: number, rejected: number): LoadedData {
  const warnings: Msg[] = []
  recs.sort((a, b) => a[0] - b[0])
  const out: typeof recs = []
  let dups = 0
  for (const r of recs) {
    if (out.length && out[out.length - 1][0] === r[0]) { out[out.length - 1] = r; dups++ } else out.push(r)
  }
  if (dups) warnings.push({ fr: `${dups} horodatage(s) en double : la dernière ligne est gardée.`, en: `${dups} duplicate timestamp(s): the last row is kept.` })
  let fixed = 0
  for (const r of out) {
    const hi = Math.max(r[1], r[4], r[2])
    const lo = Math.min(r[1], r[4], r[3])
    if (hi !== r[2] || lo !== r[3]) { r[2] = hi; r[3] = lo; fixed++ }
  }
  if (fixed) warnings.push({ fr: `${fixed} barre(s) incohérente(s) (haut/bas hors de l'ouverture ou de la clôture) corrigée(s).`, en: `${fixed} inconsistent bar(s) (high/low outside open or close) corrected.` })
  if (rejected) warnings.push({ fr: `${rejected} ligne(s) illisible(s) ignorée(s).`, en: `${rejected} unreadable row(s) skipped.` })
  const n = out.length
  const bars: Bars = {
    n,
    t: new Float64Array(n), o: new Float64Array(n), h: new Float64Array(n),
    l: new Float64Array(n), c: new Float64Array(n), v: new Float64Array(n),
  }
  for (let i = 0; i < n; i++) {
    const r = out[i]
    bars.t[i] = r[0]; bars.o[i] = r[1]; bars.h[i] = r[2]; bars.l[i] = r[3]; bars.c[i] = r[4]; bars.v[i] = r[5]
  }
  const barMs = medianStep(bars.t)
  // En intraday, nuits et week-ends des marchés fermés font des trous normaux : seuls les trous
  // de plus de 5 barres en journalier ou plus long sont signalés (jours fériés compris).
  let gaps = 0
  if (barMs >= 86400000) for (let i = 1; i < n; i++) if (bars.t[i] - bars.t[i - 1] > barMs * 5.5) gaps++
  if (gaps > 0) warnings.push({ fr: `${gaps} trou(s) de plus de 5 barres dans les données.`, en: `${gaps} gap(s) of more than 5 bars in the data.` })
  return { bars, barMs, timeframe: timeframeLabel(barMs), warnings, read, rejected }
}

export function medianStep(t: Float64Array): number {
  const n = t.length
  if (n < 2) return 86400000
  const k = Math.min(n - 1, 2000)
  const d: number[] = []
  for (let i = n - k; i < n; i++) d.push(t[i] - t[i - 1])
  d.sort((a, b) => a - b)
  return d[Math.floor(d.length / 2)]
}

export function timeframeLabel(ms: number): string {
  const min = 60000
  const table: [number, string][] = [
    [min, '1m'], [3 * min, '3m'], [5 * min, '5m'], [15 * min, '15m'], [30 * min, '30m'],
    [60 * min, '1h'], [120 * min, '2h'], [240 * min, '4h'], [360 * min, '6h'], [720 * min, '12h'],
    [1440 * min, '1D'], [10080 * min, '1W'],
  ]
  for (const [v, s] of table) if (Math.abs(ms - v) <= v * 0.02) return s
  if (ms >= 27 * 1440 * min && ms <= 32 * 1440 * min) return '1M'
  if (ms < 60 * min) return `${Math.round(ms / min)}m`
  if (ms < 1440 * min) return `${Math.round(ms / (60 * min))}h`
  return `${Math.round(ms / (1440 * min))}D`
}

/** Garde les barres entre deux dates (incluses). */
export function sliceBars(b: Bars, from: number | null, to: number | null): Bars {
  let s = 0
  let e = b.n
  if (from != null) while (s < b.n && b.t[s] < from) s++
  if (to != null) while (e > s && b.t[e - 1] > to) e--
  return {
    n: e - s,
    t: b.t.slice(s, e), o: b.o.slice(s, e), h: b.h.slice(s, e), l: b.l.slice(s, e), c: b.c.slice(s, e), v: b.v.slice(s, e),
  }
}

/** Regroupe les barres sur un timeframe plus long (alignement sur l'époque Unix, semaine du lundi). */
export function resample(b: Bars, ms: number): Bars {
  const WEEK = 7 * 86400000
  const MONDAY = 4 * 86400000 // 1970-01-01 était un jeudi
  const key = (t: number) => (ms === WEEK ? Math.floor((t - MONDAY) / WEEK) * WEEK + MONDAY : Math.floor(t / ms) * ms)
  const recs: [number, number, number, number, number, number][] = []
  for (let i = 0; i < b.n; i++) {
    const k = key(b.t[i])
    const last = recs[recs.length - 1]
    if (last && last[0] === k) {
      last[2] = Math.max(last[2], b.h[i]); last[3] = Math.min(last[3], b.l[i]); last[4] = b.c[i]; last[5] += b.v[i]
    } else recs.push([k, b.o[i], b.h[i], b.l[i], b.c[i], b.v[i]])
  }
  return finish(recs, recs.length, 0).bars
}
