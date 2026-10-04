// Stratégie importée sous forme de signaux CSV : une colonne de date et une ou plusieurs
// colonnes numériques, produites par n'importe quel outil (export « Export chart data » de
// TradingView, Python, Excel, EVMC…). Chaque ligne vaut à partir de sa date et jusqu'à la
// suivante ; la valeur d'une barre est lue à sa clôture, l'ordre part à la barre suivante.

import type { Bars, Msg, Signals } from './types.ts'
import { parseCsv, parseTime, toNumber, DataError } from './data.ts'

export interface SignalFile {
  times: Float64Array
  cols: string[]
  values: Float64Array[]
}

export type SignalMode = 'position' | 'events' | 'threshold'

export interface SignalOptions {
  col: number
  mode: SignalMode
  upper: number
  lower: number
}

const OHLC = new Set(['open', 'high', 'low', 'close', 'volume', 'vol', 'o', 'h', 'l', 'c', 'v'])

export function readSignalCsv(text: string): SignalFile {
  const tab = parseCsv(text)
  if (!tab.rows.length) throw new DataError({ fr: 'Le fichier de signaux est vide.', en: 'The signal file is empty.' })
  const lower = tab.head.map(h => h.toLowerCase().trim())
  let ti = lower.findIndex(h => ['time', 'date', 'datetime', 'timestamp', 'ts', 'open_time', 'open time'].includes(h))
  if (ti < 0) ti = 0
  const times: number[] = []
  const raw: string[][] = []
  for (const r of tab.rows) {
    const t = parseTime(r[ti] ?? '')
    if (!Number.isFinite(t)) continue
    times.push(t)
    raw.push(r)
  }
  if (!times.length) throw new DataError({ fr: 'Aucune date lisible dans la colonne « ' + tab.head[ti] + ' ».', en: `No readable date in column '${tab.head[ti]}'.` })
  const cols: string[] = []
  const values: Float64Array[] = []
  for (let j = 0; j < tab.head.length; j++) {
    if (j === ti) continue
    const v = new Float64Array(raw.length)
    let ok = 0
    for (let i = 0; i < raw.length; i++) {
      v[i] = toNumber(raw[i][j] ?? '', tab.delimiter)
      if (v[i] === v[i]) ok++
    }
    if (ok > 0) { cols.push(tab.head[j]); values.push(v) }
  }
  if (!cols.length) throw new DataError({ fr: 'Aucune colonne numérique à lire comme signal.', en: 'No numeric column to read as a signal.' })
  const order = times.map((_, i) => i).sort((x, y) => times[x] - times[y])
  return {
    times: Float64Array.from(order.map(i => times[i])),
    cols,
    values: values.map(v => Float64Array.from(order.map(i => v[i]))),
  }
}

/** Colonne proposée par défaut : un nom de signal, sinon la première qui n'est pas un prix. */
export function defaultSignalColumn(f: SignalFile): number {
  const low = f.cols.map(c => c.toLowerCase().trim())
  const named = low.findIndex(c => /^(signal|position|pos|sig|side|direction|dir)$/.test(c))
  if (named >= 0) return named
  const other = low.findIndex(c => !OHLC.has(c))
  return other >= 0 ? other : 0
}

/** Mode proposé par défaut selon les valeurs de la colonne. */
export function guessMode(f: SignalFile, col: number): SignalMode {
  const v = f.values[col]
  const set = new Set<number>()
  for (let i = 0; i < v.length && set.size < 5; i++) if (v[i] === v[i]) set.add(v[i])
  if ([...set].every(x => x === -1 || x === 0 || x === 1)) {
    let zeros = 0
    for (let i = 0; i < v.length; i++) if (v[i] === 0) zeros++
    return zeros > v.length * 0.6 ? 'events' : 'position'
  }
  return 'threshold'
}

export function signalsFromFile(bars: Bars, f: SignalFile, opt: SignalOptions): { signals: Signals; matched: number; warnings: Msg[] } {
  const n = bars.n
  const src = f.values[opt.col]
  const aligned = new Float64Array(n).fill(NaN)
  let j = -1
  let matched = 0
  for (let i = 0; i < n; i++) {
    while (j + 1 < f.times.length && f.times[j + 1] <= bars.t[i]) j++
    if (j >= 0) {
      aligned[i] = src[j]
      if (f.times[j] === bars.t[i]) matched++
    }
  }
  // En mode « événements », une ligne ne vaut que pour la barre où elle tombe.
  if (opt.mode === 'events') {
    let k = 0
    aligned.fill(0)
    for (let i = 0; i < n; i++) {
      const next = i + 1 < n ? bars.t[i + 1] : Infinity
      while (k < f.times.length && f.times[k] < bars.t[i]) k++
      let m = k
      while (m < f.times.length && f.times[m] < next) {
        if (src[m] === src[m] && src[m] !== 0) aligned[i] = src[m]
        m++
      }
    }
  }
  const long = new Uint8Array(n)
  const short = new Uint8Array(n)
  const exitLong = new Uint8Array(n)
  const exitShort = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const x = aligned[i]
    if (x !== x) continue
    if (opt.mode === 'position') {
      long[i] = x > 0 ? 1 : 0
      short[i] = x < 0 ? 1 : 0
      exitLong[i] = x <= 0 ? 1 : 0
      exitShort[i] = x >= 0 ? 1 : 0
    } else if (opt.mode === 'events') {
      long[i] = x > 0 ? 1 : 0
      short[i] = x < 0 ? 1 : 0
    } else {
      long[i] = x > opt.upper ? 1 : 0
      short[i] = x < opt.lower ? 1 : 0
    }
  }
  const warnings: Msg[] = []
  const first = f.times[0]
  const last = f.times[f.times.length - 1]
  if (last < bars.t[0] || first > bars.t[n - 1]) {
    warnings.push({ fr: 'Les dates des signaux ne recouvrent pas celles des données de prix.', en: 'The signal dates do not overlap the price data.' })
  }
  return {
    signals: {
      long, exitLong, short, exitShort, stopLoss: null, takeProfit: null,
      plots: [{ title: f.cols[opt.col], values: aligned, overlay: false, color: '#c084fc' }],
    },
    matched,
    warnings,
  }
}
