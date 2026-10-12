// Données gratuites Binance USDⓈ-M (data.binance.vision) pour l'étude de capacité : téléchargements
// ciblés, somme SHA-256 vérifiée contre le fichier .CHECKSUM publié par Binance, lecture en tableaux.
// Les fichiers bruts et les caches restent hors git (research/data/binance/).
//
// - bougies 1 min (archives mensuelles, et journalières pour le mois en cours) ;
// - bookDepth : instantanés (≈ 30 s) de la liquidité cumulée à ±1 … ±5 % du prix, depuis 2023 ;
// - aggTrades : chaque trade agrégé, horodaté à la ms, avec le côté de l'agresseur.

import { createHash } from 'node:crypto'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { ROOT } from './lib.ts'
import type { SleeveKey } from './lib.ts'

export const DATA = join(ROOT, 'research/data/binance')
const BASE = 'https://data.binance.vision/data/futures/um'
export type Sym = 'BTCUSDT' | 'ETHUSDT'
export const SYM: Record<SleeveKey, Sym> = { btc: 'BTCUSDT', ethusdt: 'ETHUSDT' }
export const MIN = 60000
/** Origine des tableaux minute : 2020-01-01 00:00 UTC. */
export const T0 = Date.UTC(2020, 0, 1)

// ---------------------------------------------------------------- téléchargement vérifié
const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex')

function curlTo(url: string, dest: string): Promise<'ok' | 'missing'> {
  return new Promise((resolve, reject) => {
    const p = spawn('curl', ['-sS', '-f', '--retry', '4', '--retry-delay', '2', '-o', dest, url])
    let err = ''
    p.stderr.on('data', d => { err += d })
    p.on('close', code => (code === 0 ? resolve('ok') : code === 22 && /404/.test(err) ? resolve('missing') : reject(new Error(`curl ${code} ${url}: ${err.trim()}`))))
  })
}

export interface Fetched { rel: string; path: string | null; sha?: string; bytes?: number }

/** Télécharge `rel` (chemin sous data/futures/um/) et vérifie sa somme ; null si Binance ne l'a pas. */
export async function fetchVerified(rel: string): Promise<Fetched> {
  const path = join(DATA, rel), ok = `${path}.ok`
  if (existsSync(ok) && existsSync(path)) return { rel, path, sha: readFileSync(ok, 'utf8').trim(), bytes: statSync(path).size }
  mkdirSync(dirname(path), { recursive: true })
  for (let attempt = 0; attempt < 2; attempt++) {
    const st = await curlTo(`${BASE}/${rel}`, path)
    if (st === 'missing') return { rel, path: null }
    const ck = `${path}.CHECKSUM`
    await curlTo(`${BASE}/${rel}.CHECKSUM`, ck)
    const expected = readFileSync(ck, 'utf8').trim().split(/\s+/)[0]
    const got = sha256(path)
    unlinkSync(ck)
    if (got === expected) { writeFileSync(ok, got); return { rel, path, sha: got, bytes: statSync(path).size } }
    unlinkSync(path)
    if (attempt === 1) throw new Error(`somme SHA-256 différente pour ${rel} : ${got} ≠ ${expected}`)
  }
  throw new Error('inaccessible')
}

/** Plusieurs téléchargements en parallèle (ordre conservé). */
export async function fetchMany(rels: string[], concurrency = 8, onProgress?: (done: number) => void): Promise<Fetched[]> {
  const out: Fetched[] = new Array(rels.length)
  let next = 0, done = 0
  const worker = async () => { while (next < rels.length) { const k = next++; out[k] = await fetchVerified(rels[k]); done++; if (onProgress && done % 50 === 0) onProgress(done) } }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return out
}

/** Lignes du CSV contenu dans une archive zip, en flux. */
export function zipLines(path: string, onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('unzip', ['-p', path])
    const rl = createInterface({ input: p.stdout, crlfDelay: Infinity })
    rl.on('line', onLine)
    p.on('error', reject)
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`unzip ${code} ${path}`))))
  })
}

// ---------------------------------------------------------------- dates
const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export function monthsBetween(from: number, to: number): string[] {
  const out: string[] = []
  const d = new Date(from)
  for (let y = d.getUTCFullYear(), m = d.getUTCMonth(); Date.UTC(y, m, 1) <= to; m === 11 ? (y++, m = 0) : m++) out.push(`${y}-${pad(m + 1)}`)
  return out
}
export function daysBetween(from: number, to: number): string[] {
  const out: string[] = []
  for (let t = Date.UTC(new Date(from).getUTCFullYear(), new Date(from).getUTCMonth(), new Date(from).getUTCDate()); t <= to; t += 864e5) out.push(isoDay(t))
  return out
}

// ---------------------------------------------------------------- bougies 1 min
export interface Minutes {
  sym: Sym
  /** Nombre de minutes depuis T0. */
  n: number
  c: Float64Array
  h: Float64Array
  l: Float64Array
  /** Volume en actif et en dollars (USDT), volume en dollars des acheteurs agresseurs. */
  v: Float64Array
  qv: Float64Array
  tbq: Float64Array
  /** 1 si la minute manque dans l'archive. */
  missing: Uint8Array
}

export interface KlineIntegrity { sym: Sym; files: number; rows: number; duplicates: number; outOfOrder: number; missingMinutes: number; longestGapMin: number; gaps: { from: string; minutes: number }[]; months: { month: string; rows: number; expected: number }[] }

/** Bougies 1 min de `sym` de T0 à `to` (exclu) : archives mensuelles, puis journalières pour le dernier mois. */
export async function loadMinutes(sym: Sym, to: number): Promise<{ m: Minutes; integrity: KlineIntegrity }> {
  const n = Math.round((to - T0) / MIN)
  const cache = join(DATA, 'cache', `${sym}-1m-${isoDay(to)}.bin`)
  const fields = ['c', 'h', 'l', 'v', 'qv', 'tbq'] as const
  if (existsSync(cache) && existsSync(`${cache}.json`)) {
    const buf = readFileSync(cache)
    const arr = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8)
    const m = { sym, n, missing: new Uint8Array(n) } as Minutes
    fields.forEach((f, k) => { (m as unknown as Record<string, Float64Array>)[f] = arr.slice(k * n, (k + 1) * n) })
    for (let i = 0; i < n; i++) m.missing[i] = Number.isNaN(m.c[i]) ? 1 : 0
    return { m, integrity: JSON.parse(readFileSync(`${cache}.json`, 'utf8')) }
  }
  const m: Minutes = { sym, n, c: new Float64Array(n).fill(NaN), h: new Float64Array(n).fill(NaN), l: new Float64Array(n).fill(NaN), v: new Float64Array(n), qv: new Float64Array(n), tbq: new Float64Array(n), missing: new Uint8Array(n).fill(1) }
  const rels = monthsBetween(T0, to - 1).map(mo => `monthly/klines/${sym}/1m/${sym}-1m-${mo}.zip`)
  const fetched = await fetchMany(rels, 6)
  // Mois absent de l'archive mensuelle (mois en cours) : fichiers journaliers.
  const missingMonths = fetched.filter(f => !f.path).map(f => f.rel.match(/(\d{4}-\d{2})\.zip$/)![1])
  const dailyRels = missingMonths.flatMap(mo => daysBetween(Date.UTC(+mo.slice(0, 4), +mo.slice(5) - 1, 1), Math.min(to - 1, Date.UTC(+mo.slice(0, 4), +mo.slice(5), 0)))).map(d => `daily/klines/${sym}/1m/${sym}-1m-${d}.zip`)
  const daily = await fetchMany(dailyRels, 6)
  const files = [...fetched, ...daily].filter(f => f.path)
  const integ: KlineIntegrity = { sym, files: files.length, rows: 0, duplicates: 0, outOfOrder: 0, missingMinutes: 0, longestGapMin: 0, gaps: [], months: [] }
  const seen = new Uint8Array(n)
  for (const f of files) {
    let rows = 0, prev = -Infinity
    await zipLines(f.path!, line => {
      if (!/^\d/.test(line)) return
      const p = line.split(',')
      const t = +p[0]
      const k = Math.round((t - T0) / MIN)
      rows++
      if (t <= prev) integ.outOfOrder++
      prev = t
      if (k < 0 || k >= n) return
      if (seen[k]) { integ.duplicates++; return }
      seen[k] = 1
      m.h[k] = +p[2]; m.l[k] = +p[3]; m.c[k] = +p[4]; m.v[k] = +p[5]; m.qv[k] = +p[7]; m.tbq[k] = +p[10]; m.missing[k] = 0
    })
    integ.rows += rows
    const mo = f.rel.match(/(\d{4}-\d{2})(-\d{2})?\.zip$/)!
    if (!mo[2]) { const y = +mo[1].slice(0, 4), mm = +mo[1].slice(5); integ.months.push({ month: mo[1], rows, expected: Math.round((Date.UTC(y, mm, 1) - Date.UTC(y, mm - 1, 1)) / MIN) }) }
  }
  let run = 0
  for (let k = 0; k <= n; k++) {
    if (k < n && m.missing[k]) { run++; continue }
    if (run > 0) { integ.missingMinutes += run; integ.longestGapMin = Math.max(integ.longestGapMin, run); if (run >= 5) integ.gaps.push({ from: new Date(T0 + (k - run) * MIN).toISOString().slice(0, 16), minutes: run }) }
    run = 0
  }
  mkdirSync(dirname(cache), { recursive: true })
  const all = new Float64Array(n * fields.length)
  fields.forEach((fld, k) => all.set(m[fld], k * n))
  writeFileSync(cache, Buffer.from(all.buffer))
  writeFileSync(`${cache}.json`, JSON.stringify(integ))
  return { m, integrity: integ }
}

// ---------------------------------------------------------------- bookDepth
export interface Depth {
  sym: Sym
  /** Instant de l'instantané (ms UTC). */
  t: Float64Array
  /** Liquidité cumulée en dollars à −1 % (acheteurs) et +1 % (vendeurs), et à ±5 %. */
  bid1: Float64Array
  ask1: Float64Array
  bid5: Float64Array
  ask5: Float64Array
}
export interface DepthIntegrity { sym: Sym; days: number; missingDays: string[]; snapshots: number; medianStepS: number; gapsOver5min: number; incomplete: number; stuckSnapshots?: number; stuckFrom?: string[] }

/**
 * Valeurs figées : une même profondeur (côté acheteur ou vendeur, à ±1 % ou ±5 %) répétée pendant
 * plus de 30 min d'instantanés consécutifs (constaté notamment sur ETHUSDT en novembre 2025, d'un
 * seul côté). Ces valeurs sont mises à NaN, côté par côté.
 */
function maskStuck(d: Depth): { n: number; from: string[] } {
  let n = 0
  const from: string[] = []
  for (const f of ['bid1', 'ask1', 'bid5', 'ask5'] as const) {
    const x = d[f]
    let a = 0
    for (let k = 1; k <= d.t.length; k++) {
      if (k < d.t.length && x[k] === x[a]) continue
      if (d.t[k - 1] - d.t[a] > 30 * MIN) {
        for (let j = a; j < k; j++) x[j] = NaN
        n += k - a
        from.push(`${f} ${new Date(d.t[a]).toISOString().slice(0, 16)} (${Math.round((d.t[k - 1] - d.t[a]) / 3600000)} h)`)
      }
      a = k
    }
  }
  return { n, from }
}

/** bookDepth de `sym`, jour par jour de `from` à `to` (inclus). */
export async function loadDepth(sym: Sym, from: number, to: number): Promise<{ d: Depth; integrity: DepthIntegrity }> {
  const cache = join(DATA, 'cache', `${sym}-bookDepth-${isoDay(from)}-${isoDay(to)}.json`)
  if (existsSync(cache)) {
    const j = JSON.parse(readFileSync(cache, 'utf8'))
    const d: Depth = { sym, t: Float64Array.from(j.t), bid1: Float64Array.from(j.bid1), ask1: Float64Array.from(j.ask1), bid5: Float64Array.from(j.bid5), ask5: Float64Array.from(j.ask5) }
    const st = maskStuck(d)
    return { d, integrity: { ...j.integrity, stuckSnapshots: st.n, stuckFrom: st.from } }
  }
  const days = daysBetween(from, to)
  const fetched = await fetchMany(days.map(d => `daily/bookDepth/${sym}/${sym}-bookDepth-${d}.zip`), 12, k => process.stderr.write(`  bookDepth ${sym} ${k}/${days.length}\n`))
  const snaps = new Map<number, number[]>()
  let incomplete = 0
  for (const f of fetched) {
    if (!f.path) continue
    await zipLines(f.path, line => {
      if (!/^\d/.test(line)) return
      const [ts, pct, , notional] = line.split(',')
      const t = Date.parse(ts.replace(' ', 'T') + 'Z')
      const p = +pct
      if (p !== -1 && p !== 1 && p !== -5 && p !== 5) return
      let s = snaps.get(t)
      if (!s) { s = [NaN, NaN, NaN, NaN]; snaps.set(t, s) }
      s[p === -1 ? 0 : p === 1 ? 1 : p === -5 ? 2 : 3] = +notional
    })
  }
  const ts = [...snaps.keys()].sort((a, b) => a - b)
  const d: Depth = { sym, t: Float64Array.from(ts), bid1: new Float64Array(ts.length), ask1: new Float64Array(ts.length), bid5: new Float64Array(ts.length), ask5: new Float64Array(ts.length) }
  ts.forEach((t, k) => { const s = snaps.get(t)!; d.bid1[k] = s[0]; d.ask1[k] = s[1]; d.bid5[k] = s[2]; d.ask5[k] = s[3]; if (s.some(Number.isNaN)) incomplete++ })
  const steps: number[] = []
  let gaps = 0
  for (let k = 1; k < ts.length; k++) { const st = (ts[k] - ts[k - 1]) / 1000; steps.push(st); if (st > 300) gaps++ }
  steps.sort((a, b) => a - b)
  const integrity: DepthIntegrity = { sym, days: days.length, missingDays: fetched.filter(f => !f.path).map(f => f.rel.match(/(\d{4}-\d{2}-\d{2})/)![1]), snapshots: ts.length, medianStepS: steps[Math.floor(steps.length / 2)] ?? NaN, gapsOver5min: gaps, incomplete }
  mkdirSync(dirname(cache), { recursive: true })
  writeFileSync(cache, JSON.stringify({ t: Array.from(d.t), bid1: Array.from(d.bid1), ask1: Array.from(d.ask1), bid5: Array.from(d.bid5), ask5: Array.from(d.ask5), integrity }))
  const st = maskStuck(d)
  return { d, integrity: { ...integrity, stuckSnapshots: st.n, stuckFrom: st.from } }
}

/** Dernier instantané à ou avant `t` (−1 si aucun dans les `maxAgeMs` précédentes). */
export function depthAt(d: Depth, t: number, maxAgeMs = 5 * MIN): number {
  let lo = 0, hi = d.t.length
  while (lo < hi) { const md = (lo + hi) >> 1; if (d.t[md] <= t) lo = md + 1; else hi = md }
  const k = lo - 1
  return k >= 0 && t - d.t[k] <= maxAgeMs ? k : -1
}

// ---------------------------------------------------------------- aggTrades
export interface Trades { t: Float64Array; px: Float64Array; qty: Float64Array; buy: Uint8Array }
export interface TradesIntegrity { day: string; rows: number; idGaps: number; outOfOrder: number; kept: number }

/** Trades d'un jour situés dans l'une des fenêtres [from, to] (ms) ; le fichier zip est supprimé après lecture si `drop`. */
export async function loadTradesWindows(sym: Sym, day: string, windows: [number, number][], drop = true): Promise<{ tr: Trades; integrity: TradesIntegrity }> {
  const f = await fetchVerified(`daily/aggTrades/${sym}/${sym}-aggTrades-${day}.zip`)
  if (!f.path) throw new Error(`aggTrades ${sym} ${day} absent de l'archive`)
  const t: number[] = [], px: number[] = [], qty: number[] = [], buy: number[] = []
  let rows = 0, idGaps = 0, outOfOrder = 0, prevId = -1, prevT = -Infinity
  await zipLines(f.path, line => {
    if (!/^\d/.test(line)) return
    const p = line.split(',')
    const id = +p[0], ts = +p[5]
    rows++
    if (prevId >= 0 && id !== prevId + 1) idGaps++
    if (ts < prevT) outOfOrder++
    prevId = id; prevT = ts
    for (const [a, b] of windows) if (ts >= a && ts <= b) { t.push(ts); px.push(+p[1]); qty.push(+p[2]); buy.push(p[6] === 'true' ? 0 : 1); break }
  })
  if (drop) { unlinkSync(f.path); if (existsSync(`${f.path}.ok`)) unlinkSync(`${f.path}.ok`) }
  return { tr: { t: Float64Array.from(t), px: Float64Array.from(px), qty: Float64Array.from(qty), buy: Uint8Array.from(buy) }, integrity: { day, rows, idGaps, outOfOrder, kept: t.length } }
}

/** Version synchrone pour les petits fichiers : texte complet d'une archive. */
export const zipText = (path: string) => execFileSync('unzip', ['-p', path], { maxBuffer: 1 << 30 }).toString()
