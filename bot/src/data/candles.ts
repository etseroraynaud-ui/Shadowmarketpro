// Bougies du bot : cache local (CSV, en ajout seul), récupération par l'API, contrôle d'intégrité.
//
// Règles :
// - seules les bougies closes entrent dans le moteur (ouverture + durée ≤ maintenant) ;
// - une bougie n'est jamais réécrite ni insérée avant la dernière connue ;
// - une bougie absente chez l'exchange reste absente (le backtest fait de même) : elle est
//   signalée, jamais inventée.

import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Bars } from '../../../lib/backtest/types.ts'
import type { Bar } from '../../../lib/strategies/shock/live.ts'

export type Interval = '15m' | '1d'

export const INTERVAL_MS: Record<Interval, number> = { '15m': 15 * 60000, '1d': 86400000 }

/** Source des bougies (Hyperliquid, ou un faux pour les tests). */
export interface CandleApi {
  /** Bougies dont l'ouverture est dans [startTime, endTime], triées ; au plus 5000 par appel. */
  candles(coin: string, interval: Interval, startTime: number, endTime: number): Promise<Bar[]>
}

/** Nombre maximal de bougies renvoyées par appel (limite de l'API Hyperliquid). */
export const MAX_PER_CALL = 5000

export function validBar(b: Bar): boolean {
  const ok = (x: number) => Number.isFinite(x) && x > 0
  return Number.isSafeInteger(b.t) && ok(b.o) && ok(b.h) && ok(b.l) && ok(b.c) && Number.isFinite(b.v) && b.v >= 0 &&
    b.h >= Math.max(b.o, b.c) && b.l <= Math.min(b.o, b.c)
}

export function toBars(cs: Bar[]): Bars {
  return {
    n: cs.length,
    t: Float64Array.from(cs, b => b.t), o: Float64Array.from(cs, b => b.o), h: Float64Array.from(cs, b => b.h),
    l: Float64Array.from(cs, b => b.l), c: Float64Array.from(cs, b => b.c), v: Float64Array.from(cs, b => b.v),
  }
}

/** Trous dans une série : [ouverture de la bougie après le trou, nombre de bougies absentes]. */
export function gapsOf(cs: Bar[], step: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = 1; i < cs.length; i++) {
    const missing = Math.round((cs[i].t - cs[i - 1].t) / step) - 1
    if (missing > 0) out.push([cs[i].t, missing])
  }
  return out
}

/**
 * Bougies closes dont l'ouverture est ≥ `from`, en plusieurs appels si besoin. Les bougies sont
 * alignées sur la grille du timeframe, validées, dédoublonnées et triées.
 */
export async function fetchClosed(api: CandleApi, coin: string, interval: Interval, from: number, now: number): Promise<Bar[]> {
  const step = INTERVAL_MS[interval]
  const out: Bar[] = []
  let start = from
  for (let guard = 0; guard < 100; guard++) {
    const batch = await api.candles(coin, interval, start, now)
    let last = -Infinity
    for (const b of batch) {
      if (b.t < start || b.t + step > now) continue
      if (b.t % step !== 0) throw new Error(`bougie ${interval} mal alignée : ${new Date(b.t).toISOString()}`)
      if (!validBar(b)) throw new Error(`bougie ${interval} invalide : ${JSON.stringify(b)}`)
      if (out.length && b.t <= out[out.length - 1].t) continue
      out.push(b)
      last = b.t
    }
    if (batch.length < MAX_PER_CALL || last === -Infinity) break
    start = last + step
  }
  return out
}

const HEADER = 't,o,h,l,c,v'

/** Cache CSV d'une série de bougies closes, en ajout seul. */
export class CandleStore {
  readonly file: string
  private bars: Bar[] = []

  constructor(file: string) {
    this.file = file
    if (existsSync(file)) {
      const lines = readFileSync(file, 'utf8').trim().split('\n')
      if (lines[0] !== HEADER) throw new Error(`${file} : en-tête inattendu`)
      for (const line of lines.slice(1)) {
        const [t, o, h, l, c, v] = line.split(',').map(Number)
        const b = { t, o, h, l, c, v }
        if (!validBar(b)) throw new Error(`${file} : ligne invalide « ${line} »`)
        if (this.bars.length && t <= this.bars[this.bars.length - 1].t) throw new Error(`${file} : ordre des bougies rompu à ${new Date(t).toISOString()}`)
        this.bars.push(b)
      }
    }
  }

  get all(): readonly Bar[] {
    return this.bars
  }

  get lastTime(): number {
    return this.bars.length ? this.bars[this.bars.length - 1].t : -Infinity
  }

  /** Ajoute les bougies postérieures à la dernière connue ; renvoie celles réellement ajoutées. */
  append(cs: Bar[]): Bar[] {
    const fresh = cs.filter(b => b.t > this.lastTime)
    for (let i = 1; i < fresh.length; i++) if (fresh[i].t <= fresh[i - 1].t) throw new Error('bougies à ajouter non triées')
    if (!fresh.length) return []
    mkdirSync(dirname(this.file), { recursive: true })
    if (!existsSync(this.file)) writeFileSync(this.file, HEADER + '\n')
    appendFileSync(this.file, fresh.map(b => `${b.t},${b.o},${b.h},${b.l},${b.c},${b.v}`).join('\n') + '\n')
    this.bars.push(...fresh)
    return fresh
  }

  /** Remplace tout le contenu (série journalière, re-téléchargée en entier). */
  replace(cs: Bar[]): void {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = this.file + '.tmp'
    writeFileSync(tmp, [HEADER, ...cs.map(b => `${b.t},${b.o},${b.h},${b.l},${b.c},${b.v}`)].join('\n') + '\n')
    renameSync(tmp, this.file)
    this.bars = cs.slice()
  }
}

/**
 * Les deux séries du bot : bougies 15 min (le graphique) et journalières (le régime de
 * volatilité, qui demande plus d'un an d'historique, au-delà des 5000 bougies 15 min de l'API).
 */
export class CandleFeed {
  readonly api: CandleApi
  readonly coin: string
  readonly chart: CandleStore
  readonly daily: CandleStore

  constructor(api: CandleApi, coin: string, dataDir: string) {
    this.api = api
    this.coin = coin
    this.chart = new CandleStore(`${dataDir}/${coin}-15m.csv`)
    this.daily = new CandleStore(`${dataDir}/${coin}-1d.csv`)
  }

  /** Complète le cache jusqu'à maintenant. Renvoie les bougies 15 min ajoutées. */
  async sync(now: number): Promise<{ added: Bar[]; dailyChanged: boolean }> {
    const step = INTERVAL_MS['15m']
    const from = Number.isFinite(this.chart.lastTime) ? this.chart.lastTime + step : now - MAX_PER_CALL * step
    const added = this.chart.append(await fetchClosed(this.api, this.coin, '15m', from, now))
    // Journalier : re-téléchargé en entier quand un nouveau jour est clos (au plus 5000 jours).
    const day = INTERVAL_MS['1d']
    const lastClosedDay = Math.floor(now / day) * day - day
    let dailyChanged = false
    if (this.daily.lastTime < lastClosedDay) {
      const d = await fetchClosed(this.api, this.coin, '1d', now - MAX_PER_CALL * day, now)
      if (!d.length || d[d.length - 1].t !== lastClosedDay) throw new Error(`bougie journalière du ${new Date(lastClosedDay).toISOString().slice(0, 10)} absente`)
      this.daily.replace(d)
      dailyChanged = true
    }
    return { added, dailyChanged }
  }

  chartBars(): Bars {
    return toBars(this.chart.all as Bar[])
  }

  dailyBars(): Bars {
    return toBars(this.daily.all as Bar[])
  }
}
