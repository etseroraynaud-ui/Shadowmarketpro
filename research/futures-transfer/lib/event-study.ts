// Étude d'événement du protocole (§ 3) : rendement directionnel en ATR après chaque événement, excès sur
// la bougie quelconque de la même année au même quart d'heure de New York, bootstrap par mois, t robustes,
// moitiés, années, découpages, événements au hasard et signaux décalés.

import { bootMonths, clusterT, mean, median, neweyWestT, nwLag, rng } from './stats.ts'
import { DAY } from './proxy-data.ts'

export const HORIZONS = [1, 4, 16, 64]

export interface Ev { i: number; dir: 1 | -1 }

export interface Ctx {
  t: Float64Array
  c: Float64Array
  atr: Float64Array
  /** Minute du jour à New York de chaque bougie. */
  nyMin: Int16Array
  lo: number
  end: number
  /** true : créneau de la référence en quart d'heure UTC (sensibilité) au lieu de New York. */
  utcSlot?: boolean
}

const yearOf = (t: number) => new Date(t).getUTCFullYear()
const monthOf = (t: number) => { const d = new Date(t); return d.getUTCFullYear() * 12 + d.getUTCMonth() }

/** Mouvement moyen d'une bougie quelconque, en ATR, par (année, quart d'heure) et horizon. */
export function baseline(x: Ctx) {
  const maps = HORIZONS.map(() => new Map<number, { s: number; k: number }>())
  const key = (i: number) => yearOf(x.t[i]) * 100 + (x.utcSlot ? Math.floor((x.t[i] % DAY) / 900000) : Math.floor(x.nyMin[i] / 15))
  for (let i = x.lo; i <= x.end; i++) {
    if (!(x.atr[i] > 0)) continue
    const kk = key(i)
    HORIZONS.forEach((h, j) => {
      if (i + h > x.end) return
      const cell = maps[j].get(kk) ?? { s: 0, k: 0 }
      cell.s += (x.c[i + h] - x.c[i]) / x.atr[i]
      cell.k++
      maps[j].set(kk, cell)
    })
  }
  return (j: number, i: number) => { const cell = maps[j].get(key(i)); return cell && cell.k ? cell.s / cell.k : 0 }
}

/** Excès de chaque événement à l'horizon d'indice j (NaN si hors période ou ATR nul). */
export function excessOf(x: Ctx, base: (j: number, i: number) => number, ev: Ev[], j: number): { raw: Float64Array; exc: Float64Array } {
  const h = HORIZONS[j]
  const raw = new Float64Array(ev.length).fill(NaN), exc = new Float64Array(ev.length).fill(NaN)
  ev.forEach(({ i, dir }, k) => {
    if (i + h > x.end || !(x.atr[i] > 0)) return
    const r = (dir * (x.c[i + h] - x.c[i])) / x.atr[i]
    raw[k] = r
    exc[k] = r - dir * base(j, i)
  })
  return { raw, exc }
}

export interface HorizonStat {
  h: number
  n: number
  meanRaw: number
  medianRaw: number
  meanExcess: number
  medianExcess: number
  ci90: number[]
  ci95: number[]
  pPos: number
  tCluster: number
  tNW: number
  halves: number[]
  yearsPos: number
  nYears: number
  /** Part des événements dont la fenêtre traverse une fermeture de plus d'une heure. */
  spansClosure: number
}

export interface Family { key: string; label: string; n: number; byH: HorizonStat[] }

/** Statistiques d'une famille d'événements à tous les horizons. */
export function familyStats(x: Ctx, base: (j: number, i: number) => number, key: string, label: string, ev: Ev[], seed: number, draws = 5000): Family {
  const mid = Math.floor((x.lo + x.end) / 2)
  const rand = rng(seed)
  // Série journalière des excès sommés (Newey–West) : tous les jours civils de la période.
  const d0 = Math.floor(x.t[x.lo] / DAY), d1 = Math.floor(x.t[x.end] / DAY)
  const byH = HORIZONS.map((h, j) => {
    const { raw, exc } = excessOf(x, base, ev, j)
    const ok: number[] = [], okRaw: number[] = [], cl: number[] = []
    const byMonth = new Map<number, number[]>(), byYear = new Map<number, number[]>()
    const half: number[][] = [[], []]
    const dailySum = new Float64Array(d1 - d0 + 1)
    let spans = 0
    ev.forEach(({ i }, k) => {
      const e = exc[k]
      if (!Number.isFinite(e)) return
      ok.push(e); okRaw.push(raw[k])
      const mo = monthOf(x.t[i]); cl.push(mo)
      if (!byMonth.has(mo)) byMonth.set(mo, []); byMonth.get(mo)!.push(e)
      const y = yearOf(x.t[i]); if (!byYear.has(y)) byYear.set(y, []); byYear.get(y)!.push(e)
      half[i < mid ? 0 : 1].push(e)
      dailySum[Math.floor(x.t[i] / DAY) - d0] += e
      for (let q = i + 1; q <= i + h; q++) if (x.t[q] - x.t[q - 1] > 3600000) { spans++; break }
    })
    const b = bootMonths(byMonth, draws, rand)
    const yr = [...byYear.values()].map(v => mean(v))
    // t de Newey–West de la moyenne des sommes journalières : même signe et même échelle de test que la moyenne des excès.
    const tNW = neweyWestT(dailySum, nwLag(dailySum.length))
    return {
      h, n: ok.length, meanRaw: mean(okRaw), medianRaw: median(okRaw), meanExcess: mean(ok), medianExcess: median(ok),
      ci90: b.ci90, ci95: b.ci95, pPos: b.pPos, tCluster: clusterT(ok, cl), tNW, halves: half.map(v => mean(v)),
      yearsPos: yr.filter(v => v > 0).length / Math.max(1, yr.length), nYears: yr.length, spansClosure: ok.length ? spans / ok.length : NaN,
    }
  })
  return { key, label, n: ev.length, byH }
}

/** Critère de zero-shot.ts à 4 et 16 bougies (G1). */
export function zeroShotCriterion(f: Family): boolean {
  return [4, 16].every(h => { const b = f.byH.find(x => x.h === h)!; return b.meanExcess > 0 && b.ci90[0] > 0 && b.halves.every(v => v > 0) && b.yearsPos >= 0.6 })
}

/**
 * Événements au hasard (G2) : autant d'événements par (année × sens × régime) que l'observé, tirés
 * uniformément avec remise parmi les bougies admissibles de la même année et du même régime, sens de
 * l'observé. Renvoie, par horizon, le p unilatéral (part des tirages ≥ l'observé) et des quantiles.
 */
export function randomEvents(x: Ctx, base: (j: number, i: number) => number, ev: Ev[], regimeOf: (i: number) => number, eligible: (i: number) => boolean, draws: number, seed: number) {
  const rand = rng(seed)
  const pools = new Map<string, number[]>()
  for (let i = x.lo; i <= x.end; i++) {
    if (!eligible(i)) continue
    const key = `${yearOf(x.t[i])}|${regimeOf(i)}`
    if (!pools.has(key)) pools.set(key, [])
    pools.get(key)!.push(i)
  }
  const cells = new Map<string, { pool: number[]; dirs: (1 | -1)[] }>()
  for (const e of ev) {
    const key = `${yearOf(x.t[e.i])}|${regimeOf(e.i)}`
    const pool = pools.get(key)
    if (!pool || !pool.length) continue
    if (!cells.has(key)) cells.set(key, { pool, dirs: [] })
    cells.get(key)!.dirs.push(e.dir)
  }
  const observed = HORIZONS.map((_, j) => mean(Array.from(excessOf(x, base, ev, j).exc).filter(Number.isFinite)))
  const dist = HORIZONS.map(() => new Float64Array(draws))
  for (let d = 0; d < draws; d++) {
    const s = HORIZONS.map(() => 0), k = HORIZONS.map(() => 0)
    for (const { pool, dirs } of cells.values()) {
      for (const dir of dirs) {
        const i = pool[Math.floor(rand() * pool.length)]
        if (!(x.atr[i] > 0)) continue
        HORIZONS.forEach((h, j) => {
          if (i + h > x.end) return
          s[j] += (dir * (x.c[i + h] - x.c[i])) / x.atr[i] - dir * base(j, i)
          k[j]++
        })
      }
    }
    HORIZONS.forEach((_, j) => { dist[j][d] = k[j] ? s[j] / k[j] : 0 })
  }
  return HORIZONS.map((h, j) => {
    const ds = Array.from(dist[j]).sort((a, b) => a - b)
    const ge = ds.filter(v => v >= observed[j]).length
    return { h, observed: observed[j], p: (ge + 1) / (draws + 1), q50: ds[Math.floor(0.5 * (draws - 1))], q95: ds[Math.floor(0.95 * (draws - 1))] }
  })
}

/** Événements décalés de s bougies (s < 0 : lisent le futur, contrôle seulement). */
export const shifted = (ev: Ev[], s: number, lo: number, end: number): Ev[] => ev.map(e => ({ i: e.i + s, dir: e.dir })).filter(e => e.i >= lo && e.i <= end)
