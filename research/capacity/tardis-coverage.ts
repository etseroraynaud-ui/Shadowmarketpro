// Test de représentativité des jours gratuits Tardis (research/preregistration/capacity-p0p1-tardis.md, § 3).
//
// Les instants où un carnet Tardis est accessible gratuitement (00:00 UTC du premier jour du mois, ou
// les deux premières heures) ressemblent-ils aux instants des exécutions du Shock Engine ? Covariables
// calculées sur les données Binance déjà téléchargées, strictement avant chaque instant. Aucun carnet
// Tardis n'est lu ici.
//
//   node --max-old-space-size=8192 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/capacity/tardis-coverage.ts

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../lib/portfolio.ts'
import { NAMES, OUT, q } from './lib.ts'
import type { SleeveKey } from './lib.ts'
import { DATA, MIN, SYM, T0, depthAt, loadDepth, loadMinutes, monthsBetween } from './binance.ts'
import { DEPTH_FROM, DEPTH_TO, KLINES_TO } from './data.ts'
import type { Event } from './events.ts'

const events: Event[] = JSON.parse(readFileSync(join(DATA, 'derived', 'events.json'), 'utf8'))
const firstDays = monthsBetween(Date.UTC(2020, 1, 1), Date.UTC(2026, 9, 1)).map(m => Date.UTC(+m.slice(0, 4), +m.slice(5) - 1, 1))
const SETS: Record<string, number[]> = {
  A: firstDays,
  A2: firstDays.flatMap(d => Array.from({ length: 9 }, (_, k) => d + k * 15 * MIN)),
}

/** Inverse d'une matrice carrée (Gauss-Jordan). */
function inv(m: number[][]): number[][] {
  const n = m.length, a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r
    ;[a[c], a[p]] = [a[p], a[c]]
    const d = a[c][c]
    for (let j = 0; j < 2 * n; j++) a[c][j] /= d
    for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j] }
  }
  return a.map(r => r.slice(n))
}
const ks = (x: number[], y: number[]) => {
  const a = [...x].sort((u, v) => u - v), b = [...y].sort((u, v) => u - v)
  let i = 0, j = 0, d = 0
  while (i < a.length && j < b.length) { if (a[i] <= b[j]) i++; else j++; d = Math.max(d, Math.abs(i / a.length - j / b.length)) }
  return d
}

/** Couverture des exécutions par les instants (§ 3) ; colonnes = covariables log. */
function coverage(inst: number[][], ev: number[][]) {
  const k = inst[0].length
  const mu = Array.from({ length: k }, (_, j) => P.mean(inst.map(r => r[j]))), sd = Array.from({ length: k }, (_, j) => P.sd(inst.map(r => r[j])))
  const z = (r: number[]) => r.map((v, j) => (v - mu[j]) / sd[j])
  const zi = inst.map(z)
  const cov = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => P.mean(zi.map(r => r[a] * r[b]))))
  const ci = inv(cov)
  const md = (r: number[]) => { const v = z(r); let s = 0; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) s += v[a] * ci[a][b] * v[b]; return Math.sqrt(s) }
  const lim = Math.max(...[q(inst.map(md), 0.99)])
  const lo = Array.from({ length: k }, (_, j) => q(inst.map(r => r[j]), 0.01)), hi = Array.from({ length: k }, (_, j) => q(inst.map(r => r[j]), 0.99))
  const covered = ev.map(r => r.every((v, j) => v >= lo[j] && v <= hi[j]) && md(r) <= lim)
  return { covered, share: covered.filter(Boolean).length / covered.length, ks: Array.from({ length: k }, (_, j) => ks(inst.map(r => r[j]), ev.map(r => r[j]))) }
}

const out: Record<string, unknown> = {}
for (const key of ['btc', 'ethusdt'] as SleeveKey[]) {
  const { m } = await loadMinutes(SYM[key], KLINES_TO)
  const { d } = await loadDepth(SYM[key], DEPTH_FROM, DEPTH_TO)
  const covAt = (t: number) => {
    const mEv = Math.round((t - T0) / MIN)
    if (mEv < 1441) return null
    let s = 0, s2 = 0, n = 0, v = 0
    for (let j = mEv - 1440; j < mEv; j++) { v += m.qv[j]; const a = m.c[j - 1], b = m.c[j]; if (a > 0 && b > 0) { const x = Math.log(b / a); s += x; s2 += x * x; n++ } }
    const mu = s / n, sigma = Math.sqrt(Math.max(s2 / n - mu * mu, 0) * 1440)
    let depth = NaN
    if (t >= DEPTH_FROM + 7 * 864e5) { const k = depthAt(d, t - 1); if (k >= 0) depth = Math.min(d.bid1[k], d.ask1[k]) }
    return { sigma, v, depth }
  }
  const ev = events.filter(e => e.key === key && e.sigma24 > 0 && e.v24 > 0)
  const evX = ev.map(e => [Math.log(e.sigma24), Math.log(e.v24)])
  const evD = ev.filter(e => Number.isFinite(e.depth1) && e.depth1 > 0)
  const evX3 = evD.map(e => [Math.log(e.sigma24), Math.log(e.v24), Math.log(e.depth1)])
  const res: Record<string, unknown> = {}
  for (const [name, ts] of Object.entries(SETS)) {
    const cv = ts.map(t => ({ t, c: covAt(t) })).filter(x => x.c && x.c.sigma > 0 && x.c.v > 0) as { t: number; c: { sigma: number; v: number; depth: number } }[]
    const X = cv.map(x => [Math.log(x.c.sigma), Math.log(x.c.v)])
    const X3 = cv.filter(x => Number.isFinite(x.c.depth) && x.c.depth > 0).map(x => [Math.log(x.c.sigma), Math.log(x.c.v), Math.log(x.c.depth)])
    const c2 = coverage(X, evX)
    const c3 = X3.length >= 10 ? coverage(X3, evX3) : null
    const byYear = Object.fromEntries([...new Set(ev.map(e => new Date(e.t).getUTCFullYear()))].sort().map(y => { const idx = ev.map((e, i) => (new Date(e.t).getUTCFullYear() === y ? i : -1)).filter(i => i >= 0); return [y, idx.filter(i => c2.covered[i]).length / idx.length] }))
    res[name] = {
      instants: cv.length, instantsWithDepth: X3.length,
      sigmaVolume: { coverage: c2.share, pass: c2.share >= 0.9, ksLogSigma: c2.ks[0], ksLogVolume: c2.ks[1], coverageByYear: byYear },
      withDepth: c3 ? { events: evX3.length, coverage: c3.share, pass: c3.share >= 0.9, ksLogSigma: c3.ks[0], ksLogVolume: c3.ks[1], ksLogDepth: c3.ks[2] } : null,
      medians: { instantSigma: q(cv.map(x => x.c.sigma), 0.5), eventSigma: q(ev.map(e => e.sigma24), 0.5), instantVolume: q(cv.map(x => x.c.v), 0.5), eventVolume: q(ev.map(e => e.v24), 0.5) },
    }
    const r = res[name] as { sigmaVolume: { coverage: number }; withDepth: { coverage: number } | null }
    process.stderr.write(`${NAMES[key]} ${name} : ${cv.length} instants · couverture (σ, V) ${(r.sigmaVolume.coverage * 100).toFixed(1)} %${r.withDepth ? ` · avec profondeur ${(r.withDepth.coverage * 100).toFixed(1)} %` : ''}\n`)
  }
  out[NAMES[key]] = res
}
const pass = (set: string) => ['BTC', 'ETH'].every(a => { const r = (out[a] as Record<string, { sigmaVolume: { pass: boolean }; withDepth: { pass: boolean } | null }>)[set]; return r.sigmaVolume.pass && (r.withDepth?.pass ?? false) })
const decision = pass('A2') ? 'A2 passes: download A2 and calibrate (addendum § 4)' : pass('A') ? 'only A passes: calibrate on A only' : 'neither set passes: no calibration; describe the 00:00 snapshots only'
writeFileSync(join(OUT, 'tardis-coverage.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/capacity-p0p1-tardis.md', criterion: 'coverage >= 90 % per asset, on (sigma, volume) 2020-2026 and (sigma, volume, depth) 2023-2026', results: out, decision }, null, 1))
process.stderr.write(`décision : ${decision}\n`)
