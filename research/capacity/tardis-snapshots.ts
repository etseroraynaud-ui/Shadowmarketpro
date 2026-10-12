// Jours gratuits Tardis : description des instantanés de carnet Binance USDⓈ-M à 00:00 UTC le premier
// jour de chaque mois (research/preregistration/capacity-p0p1-tardis.md, § 4, cas « aucun ne passe »).
// Le test de représentativité a échoué : AUCUNE calibration. Ces instantanés décrivent le coût d'un
// ordre au marché immédiat à minuit, un jour ordinaire ; ils ne représentent pas les instants de signal.
//
// Source : api.tardis.dev/v1/data-feeds (premier jour du mois, sans clé), canal depthSnapshot
// (1 000 niveaux, relevé par Tardis à l'ouverture de sa session d'enregistrement).
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/tardis-snapshots.ts

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { NAMES, OUT, ROOT, q } from './lib.ts'
import type { SleeveKey } from './lib.ts'
import { MIN, SYM, T0, loadMinutes, monthsBetween } from './binance.ts'
import { KLINES_TO } from './data.ts'

const DIR = join(ROOT, 'research/data/tardis')
const SIZES = [50e3, 125e3, 250e3, 500e3, 2.5e6]
const BANDS_BPS = [5, 10, 20, 50]

function get(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('curl', ['-sS', '-f', '--retry', '4', '--retry-delay', '3', '--max-time', '120', '-o', dest, url])
    let err = ''
    p.stderr.on('data', d => { err += d })
    p.on('close', c => (c === 0 ? resolve() : reject(new Error(`curl ${c} ${url} ${err}`))))
  })
}

interface Snap { t: number; bids: [number, number][]; asks: [number, number][] }
async function snapshot(sym: string, day: string): Promise<Snap | null> {
  const path = join(DIR, `${sym}-${day}-depthSnapshot.txt`)
  if (!existsSync(path)) {
    mkdirSync(DIR, { recursive: true })
    const filters = encodeURIComponent(JSON.stringify([{ channel: 'depthSnapshot', symbols: [sym.toLowerCase()] }]))
    await get(`https://api.tardis.dev/v1/data-feeds/binance-futures?from=${day}&filters=${filters}&offset=0`, path)
  }
  const raw = readFileSync(path)
  const text = (raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw).toString()
  const line = text.split('\n').find(l => l.includes('depthSnapshot'))
  if (!line) return null
  const sp = line.indexOf(' ')
  const msg = JSON.parse(line.slice(sp + 1))
  const data = msg.data ?? msg
  const lvl = (xs: [string, string][]) => xs.map(([p, s]) => [+p, +s] as [number, number])
  return { t: Date.parse(line.slice(0, sp)), bids: lvl(data.bids).sort((a, b) => b[0] - a[0]), asks: lvl(data.asks).sort((a, b) => a[0] - b[0]) }
}

/** Coût d'un ordre au marché de Q $ (pb du milieu) et part du carnet relevé qu'il consomme. */
function walk(levels: [number, number][], mid: number, Q: number, side: 1 | -1) {
  let usd = 0, qty = 0
  for (const [p, s] of levels) {
    const take = Math.min(s, (Q - usd) / p)
    usd += take * p; qty += take
    if (usd >= Q - 1e-6) return { bps: side * (usd / qty / mid - 1) * 1e4, complete: true }
  }
  return { bps: NaN, complete: false }
}

const months = monthsBetween(Date.UTC(2020, 0, 1), Date.UTC(2026, 9, 1))
const out: Record<string, unknown> = {}
for (const key of ['btc', 'ethusdt'] as SleeveKey[]) {
  const { m } = await loadMinutes(SYM[key], KLINES_TO)
  const rows: { day: string; ageS: number; levels: number; halfSpreadBps: number; cost: Record<string, number>; depth: Record<string, number>; impliedY: Record<string, number>; incomplete: number }[] = []
  let missing = 0, crossed = 0
  for (const mo of months) {
    const day = `${mo}-01`
    const s = await snapshot(SYM[key], day)
    if (!s || !s.bids.length || !s.asks.length) { missing++; continue }
    const bb = s.bids[0][0], ba = s.asks[0][0]
    if (!(ba > bb)) { crossed++; continue }
    const mid = (bb + ba) / 2
    const cost: Record<string, number> = {}, impliedY: Record<string, number> = {}
    let incomplete = 0
    // Volatilité et volume des 24 h précédentes (bougies Binance), pour le Y implicite descriptif.
    const mEv = Math.round((s.t - T0) / MIN)
    let sg = NaN, v24 = NaN
    if (mEv > 1441) {
      let a = 0, a2 = 0, n = 0, v = 0
      for (let j = mEv - 1440; j < mEv; j++) { v += m.qv[j]; const x = Math.log(m.c[j] / m.c[j - 1]); if (Number.isFinite(x)) { a += x; a2 += x * x; n++ } }
      sg = Math.sqrt(Math.max(a2 / n - (a / n) ** 2, 0) * 1440); v24 = v
    }
    for (const Q of SIZES) {
      const b = walk(s.asks, mid, Q, 1), se = walk(s.bids, mid, Q, -1)
      if (!b.complete || !se.complete) incomplete++
      const c = (b.bps + se.bps) / 2
      cost[`${Q}`] = c
      impliedY[`${Q}`] = sg > 0 && v24 > 0 ? (c / 1e4) / (sg * Math.sqrt(Q / v24)) : NaN
    }
    const depth: Record<string, number> = {}
    for (const bp of BANDS_BPS) {
      const lim = bp / 1e4
      const ask = s.asks.filter(([p]) => p <= mid * (1 + lim)).reduce((a, [p, z]) => a + p * z, 0)
      const bid = s.bids.filter(([p]) => p >= mid * (1 - lim)).reduce((a, [p, z]) => a + p * z, 0)
      depth[`${bp}`] = Math.min(ask, bid)
    }
    rows.push({ day, ageS: (s.t - Date.parse(`${day}T00:00:00Z`)) / 1000, levels: Math.min(s.bids.length, s.asks.length), halfSpreadBps: ((ba - bb) / 2 / mid) * 1e4, cost, depth, impliedY, incomplete })
  }
  const col = (f: (r: (typeof rows)[number]) => number) => rows.map(f).filter(Number.isFinite)
  out[NAMES[key]] = {
    snapshots: rows.length, missing, crossed, medianLevels: q(rows.map(r => r.levels), 0.5), maxAgeS: Math.max(...rows.map(r => r.ageS)),
    halfSpreadBps: { median: q(col(r => r.halfSpreadBps), 0.5), p90: q(col(r => r.halfSpreadBps), 0.9) },
    immediateCostBps: Object.fromEntries(SIZES.map(Q => [`${Q}`, { median: q(col(r => r.cost[`${Q}`]), 0.5), p90: q(col(r => r.cost[`${Q}`]), 0.9), max: Math.max(...col(r => r.cost[`${Q}`])), n: col(r => r.cost[`${Q}`]).length }])),
    visibleDepthUsd: Object.fromEntries(BANDS_BPS.map(bp => [`${bp}bp`, { median: q(col(r => r.depth[`${bp}`]), 0.5), p10: q(col(r => r.depth[`${bp}`]), 0.1) }])),
    impliedYDescriptive: Object.fromEntries(SIZES.map(Q => [`${Q}`, { median: q(col(r => r.impliedY[`${Q}`]), 0.5), p10: q(col(r => r.impliedY[`${Q}`]), 0.1), p90: q(col(r => r.impliedY[`${Q}`]), 0.9) }])),
    byYear: Object.fromEntries([...new Set(rows.map(r => r.day.slice(0, 4)))].map(y => { const rs = rows.filter(r => r.day.startsWith(y)); return [y, { n: rs.length, cost500kBps: q(rs.map(r => r.cost['500000']).filter(Number.isFinite), 0.5), cost2_5MBps: q(rs.map(r => r.cost['2500000']).filter(Number.isFinite), 0.5), depth10bpUsd: q(rs.map(r => r.depth['10']), 0.5) }] })),
  }
  const o = out[NAMES[key]] as { snapshots: number; immediateCostBps: Record<string, { median: number; p90: number }>; visibleDepthUsd: Record<string, { median: number }>; impliedYDescriptive: Record<string, { median: number }> }
  process.stderr.write(`${NAMES[key]} : ${o.snapshots} instantanés (${missing} absents) · coût immédiat médian ${SIZES.map(Q => `${Q / 1e3} k$ ${o.immediateCostBps[`${Q}`].median.toFixed(2)} pb (p90 ${o.immediateCostBps[`${Q}`].p90.toFixed(2)})`).join(', ')} · profondeur ±10 pb ${(o.visibleDepthUsd['10bp'].median / 1e6).toFixed(1)} M$ · Y implicite médian ${SIZES.map(Q => o.impliedYDescriptive[`${Q}`].median.toFixed(2)).join('/')}\n`)
}
writeFileSync(join(OUT, 'tardis-snapshots.json'), JSON.stringify({
  generatedAt: new Date().toISOString(), prespec: 'research/preregistration/capacity-p0p1-tardis.md § 4',
  status: 'DESCRIPTIVE ONLY: the representativeness test failed (tardis-coverage.json); these midnight snapshots on the first day of the month are not representative of signal times and are not used to calibrate any cost.',
  source: 'api.tardis.dev/v1/data-feeds, binance-futures depthSnapshot at offset 0 of each free day',
  sizesUsd: SIZES, results: out,
}, null, 1))
