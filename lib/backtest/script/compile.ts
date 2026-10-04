// Évaluation d'un script de stratégie sur des barres : chaque expression devient une série
// complète, calculée une fois. Les fonctions disponibles sont causales et l'historique x[n]
// n'accepte que n ≥ 0 : un script ne peut pas lire le futur.

import type { Bars, InputDef, Msg, Plot, Signals } from '../types.ts'
import * as ta from '../indicators.ts'
import { parse, ScriptError } from './parser.ts'
import type { Expr, Pos, Stmt } from './parser.ts'

type Series = Float64Array
type V =
  | { k: 'n'; v: number }
  | { k: 's'; s: Series }
  | { k: 'str'; v: string }
  | { k: 't'; items: V[] }

export interface Compiled {
  name: string | null
  inputs: InputDef[]
  signals: Signals
  /** Sorties définies par le script. */
  outputs: string[]
  warnings: Msg[]
}

const OUTPUTS: Record<string, string> = {
  long: 'long', exitLong: 'exitLong', exit_long: 'exitLong',
  short: 'short', exitShort: 'exitShort', exit_short: 'exitShort',
  stopLoss: 'stopLoss', stop_loss: 'stopLoss', takeProfit: 'takeProfit', take_profit: 'takeProfit',
}

const BUILTIN_VARS = [
  'open', 'high', 'low', 'close', 'volume', 'hl2', 'hlc3', 'ohlc4', 'hlcc4', 'bar_index', 'time',
  'year', 'month', 'dayofmonth', 'dayofweek', 'hour', 'minute', 'tr', 'obv', 'vwap', 'na',
]

const PALETTE = ['#f5b942', '#60a5fa', '#c084fc', '#2dd4bf', '#f472b6', '#a3e635', '#fb923c', '#94a3b8']

/** Lit seulement les paramètres d'un script (sans données), pour l'interface. */
export function scriptInputs(src: string): { name: string | null; inputs: InputDef[] } {
  const t = new Float64Array([0, 86400000, 172800000])
  const p = new Float64Array([1, 1, 1])
  const c = compileScript(src, { n: 3, t, o: p, h: p, l: p, c: p, v: p })
  return { name: c.name, inputs: c.inputs }
}

export function compileScript(src: string, bars: Bars, overrides: Record<string, number> = {}): Compiled {
  const stmts = parse(src)
  const n = bars.n
  const env = new Map<string, V>()
  const inputs: InputDef[] = []
  const plots: Plot[] = []
  const warnings: Msg[] = []
  let name: string | null = null
  let builtins: Map<string, V> | null = null

  const builtin = (id: string): V | undefined => {
    if (!builtins) builtins = new Map()
    if (builtins.has(id)) return builtins.get(id)
    let v: V | undefined
    const { o, h, l, c, v: vol, t } = bars
    const mk = (f: (i: number) => number): V => {
      const s = new Float64Array(n)
      for (let i = 0; i < n; i++) s[i] = f(i)
      return { k: 's', s }
    }
    const date = (f: (d: Date) => number) => mk(i => f(new Date(t[i])))
    switch (id) {
      case 'open': v = { k: 's', s: o }; break
      case 'high': v = { k: 's', s: h }; break
      case 'low': v = { k: 's', s: l }; break
      case 'close': v = { k: 's', s: c }; break
      case 'volume': v = { k: 's', s: vol }; break
      case 'hl2': v = mk(i => (h[i] + l[i]) / 2); break
      case 'hlc3': v = mk(i => (h[i] + l[i] + c[i]) / 3); break
      case 'ohlc4': v = mk(i => (o[i] + h[i] + l[i] + c[i]) / 4); break
      case 'hlcc4': v = mk(i => (h[i] + l[i] + 2 * c[i]) / 4); break
      case 'bar_index': v = mk(i => i); break
      case 'time': v = { k: 's', s: t }; break
      case 'year': v = date(d => d.getUTCFullYear()); break
      case 'month': v = date(d => d.getUTCMonth() + 1); break
      case 'dayofmonth': v = date(d => d.getUTCDate()); break
      case 'dayofweek': v = date(d => d.getUTCDay() + 1); break
      case 'hour': v = date(d => d.getUTCHours()); break
      case 'minute': v = date(d => d.getUTCMinutes()); break
      case 'tr': v = { k: 's', s: ta.tr(h, l, c) }; break
      case 'obv': v = { k: 's', s: ta.obv(c, vol) }; break
      case 'vwap': v = { k: 's', s: ta.vwap(builtinSeries('hlc3'), vol, t) }; break
      case 'strategy.long': v = { k: 'n', v: 1 }; break
      case 'strategy.short': v = { k: 'n', v: -1 }; break
    }
    if (v) builtins.set(id, v)
    return v
  }
  const builtinSeries = (id: string) => (builtin(id) as { k: 's'; s: Series }).s

  const err = (pos: Pos | null, fr: string, en: string) => new ScriptError({ fr, en }, pos)

  const series = (x: V, pos: Pos): Series => {
    if (x.k === 's') return x.s
    if (x.k === 'n') return ta.full(n, x.v)
    if (x.k === 't') throw err(pos, 'Cette fonction renvoie plusieurs séries : écrivez [a, b, c] = …', 'This function returns several series: write [a, b, c] = …')
    throw err(pos, 'Texte utilisé à la place d\'un nombre.', 'Text used where a number is expected.')
  }
  const scalar = (x: V, pos: Pos, what: Msg): number => {
    if (x.k === 'n') return x.v
    if (x.k === 's') {
      // Une série constante (par ex. issue d'un calcul sur des paramètres) est acceptée.
      const s = x.s
      let first = NaN
      for (let i = 0; i < s.length; i++) {
        if (Number.isNaN(s[i])) continue
        if (Number.isNaN(first)) first = s[i]
        else if (s[i] !== first) throw err(pos, `${what.fr} doit être un nombre fixe, pas une série qui varie.`, `${what.en} must be a fixed number, not a varying series.`)
      }
      return first
    }
    throw err(pos, `${what.fr} doit être un nombre.`, `${what.en} must be a number.`)
  }
  const length = (x: V, pos: Pos, fn: string): number => {
    const v = scalar(x, pos, { fr: `La longueur de ${fn}`, en: `The length of ${fn}` })
    if (!Number.isFinite(v) || v < 1) throw err(pos, `La longueur de ${fn} doit être un entier ≥ 1 (reçu ${v}).`, `The length of ${fn} must be an integer ≥ 1 (got ${v}).`)
    return Math.round(v)
  }

  const map1 = (x: V, f: (a: number) => number): V => {
    if (x.k === 'n') return { k: 'n', v: f(x.v) }
    if (x.k === 's') {
      const s = new Float64Array(n)
      for (let i = 0; i < n; i++) s[i] = f(x.s[i])
      return { k: 's', s }
    }
    return x
  }
  const map2 = (a: V, b: V, pos: Pos, f: (x: number, y: number) => number): V => {
    if (a.k === 'n' && b.k === 'n') return { k: 'n', v: f(a.v, b.v) }
    const sa = a.k === 'n' ? null : series(a, pos)
    const sb = b.k === 'n' ? null : series(b, pos)
    const s = new Float64Array(n)
    const av = a.k === 'n' ? a.v : 0
    const bv = b.k === 'n' ? b.v : 0
    for (let i = 0; i < n; i++) s[i] = f(sa ? sa[i] : av, sb ? sb[i] : bv)
    return { k: 's', s }
  }

  const truthy = ta.truthy
  const BIN: Record<string, (x: number, y: number) => number> = {
    '+': (x, y) => x + y,
    '-': (x, y) => x - y,
    '*': (x, y) => x * y,
    '/': (x, y) => (y === 0 ? NaN : x / y),
    '%': (x, y) => (y === 0 ? NaN : x % y),
    '<': (x, y) => (x < y ? 1 : 0),
    '>': (x, y) => (x > y ? 1 : 0),
    '<=': (x, y) => (x <= y ? 1 : 0),
    '>=': (x, y) => (x >= y ? 1 : 0),
    '==': (x, y) => (x === y ? 1 : 0),
    '!=': (x, y) => (x !== x || y !== y ? 0 : x !== y ? 1 : 0),
    and: (x, y) => (truthy(x) && truthy(y) ? 1 : 0),
    or: (x, y) => (truthy(x) || truthy(y) ? 1 : 0),
  }

  let autoInput = 0
  const declareInput = (e: Expr & { k: 'call' }, varName: string | null): V => {
    const kind0 = e.name.replace(/^input\.?/, '') || 'auto'
    const argAt = (i: number, key: string): Expr | undefined => e.named[key] ?? e.args[i]
    const defE = argAt(0, 'defval')
    if (!defE) throw err(e.pos, 'input() demande une valeur par défaut.', 'input() needs a default value.')
    if (kind0 === 'source') return evalExpr(defE)
    if (kind0 === 'string' || kind0 === 'timeframe' || kind0 === 'symbol' || kind0 === 'session') return evalExpr(defE)
    const def = evalExpr(defE)
    if (def.k !== 'n') {
      // input(close, "Source") : source de prix, pas un paramètre numérique.
      return def
    }
    const titleE = argAt(1, 'title')
    const title = titleE && titleE.k === 'str' ? titleE.v : varName || `input ${autoInput + 1}`
    const num = (i: number, key: string): number | null => {
      const x = argAt(i, key)
      if (!x) return null
      const v = evalExpr(x)
      return v.k === 'n' && Number.isFinite(v.v) ? v.v : null
    }
    const isBool = kind0 === 'bool' || (kind0 === 'auto' && defE.k === 'num' && defE.bool === true)
    const kind: InputDef['kind'] = isBool ? 'bool' : kind0 === 'int' || (kind0 === 'auto' && Number.isInteger(def.v)) ? 'int' : 'float'
    const key = varName || slug(title) || `input${autoInput + 1}`
    autoInput++
    let defval = def.v
    const min = isBool ? 0 : num(2, 'minval')
    const max = isBool ? 1 : num(3, 'maxval')
    const step = isBool ? 1 : num(4, 'step')
    if (!inputs.some(x => x.name === key)) inputs.push({ name: key, title, kind, defval, min, max, step })
    if (Object.prototype.hasOwnProperty.call(overrides, key) && Number.isFinite(overrides[key])) defval = overrides[key]
    if (kind === 'int') defval = Math.round(defval)
    return { k: 'n', v: defval }
  }

  function evalExpr(e: Expr): V {
    switch (e.k) {
      case 'num': return { k: 'n', v: e.v }
      case 'str': return { k: 'str', v: e.v }
      case 'na': return { k: 'n', v: NaN }
      case 'id': {
        const v = env.get(e.name)
        if (v) return v
        const b = builtin(e.name.replace(/^ta\./, ''))
        if (b) return b
        if (/^color\./.test(e.name)) return { k: 'str', v: e.name.slice(6) }
        if (/^strategy\.(position_size|position_avg_price|equity|opentrades|netprofit|closedtrades)/.test(e.name)) {
          throw err(e.pos, `${e.name} n'est pas disponible : le script décrit des signaux, le moteur gère la position. Utilisez les réglages (stop, objectif, sortie après N barres).`, `${e.name} is not available: the script describes signals, the engine manages the position. Use the settings (stop, target, exit after N bars).`)
        }
        const sug = suggest(e.name, [...env.keys(), ...BUILTIN_VARS])
        throw err(e.pos, `Variable inconnue « ${e.name} »${sug ? ` (vouliez-vous dire « ${sug} » ?)` : ''}. Une variable doit être définie sur une ligne précédente.`, `Unknown variable '${e.name}'${sug ? ` (did you mean '${sug}'?)` : ''}. A variable must be defined on an earlier line.`)
      }
      case 'un': {
        const x = evalExpr(e.e)
        if (e.op === '-') return map1(x, a => -a)
        return map1(x, a => (truthy(a) ? 0 : 1))
      }
      case 'bin': {
        const a = evalExpr(e.a)
        const b = evalExpr(e.b)
        if (a.k === 'str' || b.k === 'str') {
          if (e.op === '==' || e.op === '!=') {
            const eq = a.k === 'str' && b.k === 'str' && a.v === b.v
            return { k: 'n', v: (e.op === '==') === eq ? 1 : 0 }
          }
          throw err(e.pos, 'Opération impossible sur du texte.', 'Operation not possible on text.')
        }
        return map2(a, b, e.pos, BIN[e.op])
      }
      case 'tern': {
        const c = evalExpr(e.c)
        const a = evalExpr(e.a)
        const b = evalExpr(e.b)
        if (c.k === 'n') return truthy(c.v) ? a : b
        const sc = series(c, e.pos)
        const sa = series(a, e.pos)
        const sb = series(b, e.pos)
        const s = new Float64Array(n)
        for (let i = 0; i < n; i++) s[i] = truthy(sc[i]) ? sa[i] : sb[i]
        return { k: 's', s }
      }
      case 'idx': {
        const x = evalExpr(e.e)
        const ix = evalExpr(e.i)
        if (ix.k === 'n') {
          const k = ix.v
          if (!Number.isInteger(k) || k < 0) throw err(e.pos, `L'historique [${k}] doit être un entier ≥ 0 : [1] = barre précédente. Lire le futur est impossible.`, `History [${k}] must be an integer ≥ 0: [1] = previous bar. Reading the future is not possible.`)
          if (x.k === 'n') return x
          return { k: 's', s: ta.shift(series(x, e.pos), k) }
        }
        const sx = series(x, e.pos)
        const si = series(ix, e.pos)
        const s = ta.full(n, NaN)
        for (let i = 0; i < n; i++) {
          const k = Math.round(si[i])
          if (k >= 0 && i - k >= 0) s[i] = sx[i - k]
        }
        return { k: 's', s }
      }
      case 'call': return call(e)
    }
  }

  function call(e: Expr & { k: 'call' }): V {
    const fname = e.name.replace(/^(ta|math)\./, '')
    if (e.name === 'input' || e.name.startsWith('input.')) return declareInput(e, null)
    const arg = (i: number, key: string, def?: V): V => {
      const x = e.named[key] ?? e.args[i]
      if (x) return evalExpr(x)
      if (def) return def
      throw err(e.pos, `${e.name} : argument « ${key} » manquant.`, `${e.name}: missing argument '${key}'.`)
    }
    const S = (i: number, key: string, def?: V) => series(arg(i, key, def), e.pos)
    const L = (i: number, key: string, def?: V) => length(arg(i, key, def), e.pos, e.name)
    const N = (i: number, key: string, def?: V) => scalar(arg(i, key, def), e.pos, { fr: `L'argument « ${key} » de ${e.name}`, en: `Argument '${key}' of ${e.name}` })
    const s = (x: Series): V => ({ k: 's', s: x })
    const t = (...xs: Series[]): V => ({ k: 't', items: xs.map(s) })
    const num = (v: number): V => ({ k: 'n', v })
    const { h, l, c, v: vol } = bars
    const nArgs = e.args.length
    const hasSourceFirst = (key = 'source') => nArgs >= 2 || key in e.named
    switch (fname) {
      case 'sma': return s(ta.sma(S(0, 'source'), L(1, 'length')))
      case 'ema': return s(ta.ema(S(0, 'source'), L(1, 'length')))
      case 'rma': return s(ta.rma(S(0, 'source'), L(1, 'length')))
      case 'wma': return s(ta.wma(S(0, 'source'), L(1, 'length')))
      case 'hma': return s(ta.hma(S(0, 'source'), L(1, 'length')))
      case 'dema': return s(ta.dema(S(0, 'source'), L(1, 'length')))
      case 'tema': return s(ta.tema(S(0, 'source'), L(1, 'length')))
      case 'vwma': return s(ta.vwma(S(0, 'source'), vol, L(1, 'length')))
      case 'stdev': return s(ta.stdev(S(0, 'source'), L(1, 'length')))
      case 'variance': return s(ta.variance(S(0, 'source'), L(1, 'length')))
      case 'highest': return hasSourceFirst() ? s(ta.highest(S(0, 'source'), L(1, 'length'))) : s(ta.highest(h, L(0, 'length')))
      case 'lowest': return hasSourceFirst() ? s(ta.lowest(S(0, 'source'), L(1, 'length'))) : s(ta.lowest(l, L(0, 'length')))
      case 'rsi': return s(ta.rsi(S(0, 'source'), L(1, 'length')))
      case 'atr': return s(ta.atr(h, l, c, L(0, 'length')))
      case 'tr': return builtin('tr')!
      case 'cci': return s(ta.cci(S(0, 'source'), L(1, 'length')))
      case 'mfi': return s(ta.mfi(S(0, 'series'), vol, L(1, 'length')))
      case 'wpr': return s(ta.wpr(h, l, c, L(0, 'length')))
      case 'stoch': return s(ta.stoch(S(0, 'source'), S(1, 'high'), S(2, 'low'), L(3, 'length')))
      case 'roc': return s(ta.roc(S(0, 'source'), L(1, 'length')))
      case 'mom':
      case 'change': return s(ta.change(S(0, 'source'), L(1, 'length', num(1))))
      case 'cum': return s(ta.cum(S(0, 'source')))
      case 'sum': return s(ta.sum(S(0, 'source'), L(1, 'length')))
      case 'obv': return builtin('obv')!
      case 'vwap': return nArgs || 'source' in e.named ? s(ta.vwap(S(0, 'source'), vol, bars.t)) : builtin('vwap')!
      case 'linreg': return s(ta.linreg(S(0, 'source'), L(1, 'length'), N(2, 'offset', num(0))))
      case 'macd': return t(...ta.macd(S(0, 'source'), L(1, 'fastlen'), L(2, 'slowlen'), L(3, 'siglen')))
      case 'bb': return t(...ta.bb(S(0, 'series'), L(1, 'length'), N(2, 'mult')))
      case 'kc': return t(...ta.kc(S(0, 'series'), h, l, c, L(1, 'length'), N(2, 'mult')))
      case 'dmi': return t(...ta.dmi(h, l, c, L(0, 'diLength'), L(1, 'adxSmoothing')))
      case 'adx': return s(ta.dmi(h, l, c, L(0, 'diLength'), L(1, 'adxSmoothing', arg(0, 'diLength')))[2])
      case 'supertrend': return t(...ta.supertrend(h, l, c, N(0, 'factor'), L(1, 'atrPeriod')))
      case 'pivothigh': return nArgs >= 3 ? s(ta.pivothigh(S(0, 'source'), L(1, 'leftbars'), L(2, 'rightbars'))) : s(ta.pivothigh(h, L(0, 'leftbars'), L(1, 'rightbars')))
      case 'pivotlow': return nArgs >= 3 ? s(ta.pivotlow(S(0, 'source'), L(1, 'leftbars'), L(2, 'rightbars'))) : s(ta.pivotlow(l, L(0, 'leftbars'), L(1, 'rightbars')))
      case 'crossover': return s(ta.crossover(S(0, 'source1'), S(1, 'source2')))
      case 'crossunder': return s(ta.crossunder(S(0, 'source1'), S(1, 'source2')))
      case 'cross': {
        const a = S(0, 'source1')
        const b = S(1, 'source2')
        const up = ta.crossover(a, b)
        const dn = ta.crossunder(a, b)
        for (let i = 0; i < n; i++) up[i] = up[i] || dn[i] ? 1 : 0
        return s(up)
      }
      case 'rising': return s(ta.rising(S(0, 'source'), L(1, 'length')))
      case 'falling': return s(ta.falling(S(0, 'source'), L(1, 'length')))
      case 'barssince': return s(ta.barssince(S(0, 'condition')))
      case 'valuewhen': return s(ta.valuewhen(S(0, 'condition'), S(1, 'source'), Math.max(0, Math.round(N(2, 'occurrence', num(0))))))
      case 'nz': {
        const x = arg(0, 'source')
        const r = arg(1, 'replacement', num(0))
        return map2(x, r, e.pos, (a, b) => (a === a ? a : b))
      }
      case 'na': return map1(arg(0, 'x'), a => (a === a ? 0 : 1))
      case 'fixnan': {
        const x = S(0, 'source')
        const out = new Float64Array(n)
        let last = NaN
        for (let i = 0; i < n; i++) { if (x[i] === x[i]) last = x[i]; out[i] = last }
        return s(out)
      }
      case 'abs': return map1(arg(0, 'number'), Math.abs)
      case 'sqrt': return map1(arg(0, 'number'), Math.sqrt)
      case 'log': return map1(arg(0, 'number'), Math.log)
      case 'log10': return map1(arg(0, 'number'), Math.log10)
      case 'exp': return map1(arg(0, 'number'), Math.exp)
      case 'floor': return map1(arg(0, 'number'), Math.floor)
      case 'ceil': return map1(arg(0, 'number'), Math.ceil)
      case 'sign': return map1(arg(0, 'number'), Math.sign)
      case 'round': {
        const p = e.args[1] ? N(1, 'precision') : 0
        const f = 10 ** p
        return map1(arg(0, 'number'), a => Math.round(a * f) / f)
      }
      case 'pow': return map2(arg(0, 'base'), arg(1, 'exponent'), e.pos, Math.pow)
      case 'max':
      case 'min':
      case 'avg': {
        if (!e.args.length) throw err(e.pos, `${e.name} demande au moins un argument.`, `${e.name} needs at least one argument.`)
        const vals = e.args.map(evalExpr)
        const f = fname === 'max' ? (a: number, b: number) => (a !== a || b !== b ? NaN : Math.max(a, b)) : fname === 'min' ? (a: number, b: number) => (a !== a || b !== b ? NaN : Math.min(a, b)) : (a: number, b: number) => a + b
        let acc = vals[0]
        for (let k = 1; k < vals.length; k++) acc = map2(acc, vals[k], e.pos, f)
        return fname === 'avg' ? map1(acc, a => a / vals.length) : acc
      }
      case 'plot': {
        const x = arg(0, 'series')
        const titleV = e.named.title ?? e.args[1]
        const colorE = e.named.color ?? e.args[2]
        const overlayE = e.named.overlay
        const title = titleV && titleV.k === 'str' ? titleV.v : `plot ${plots.length + 1}`
        let color: string | null = null
        if (colorE) {
          const cv = evalExpr(colorE)
          if (cv.k === 'str') color = cv.v.startsWith('#') ? cv.v.slice(0, 7) : namedColor(cv.v)
        }
        const values = x.k === 't' ? series(x.items[0], e.pos) : series(x, e.pos)
        let overlay: boolean
        if (overlayE) overlay = truthy(scalar(evalExpr(overlayE), e.pos, { fr: 'overlay', en: 'overlay' }))
        else overlay = nearPrice(values, c)
        plots.push({ title, values, overlay, color: color || PALETTE[plots.length % PALETTE.length] })
        return { k: 'n', v: NaN }
      }
      case 'strategy':
      case 'indicator':
      case 'study': {
        const titleE = e.named.title ?? e.args[0]
        if (titleE && titleE.k === 'str') name = titleE.v
        return { k: 'n', v: NaN }
      }
      case 'hline':
      case 'bgcolor':
      case 'barcolor':
      case 'plotshape':
      case 'plotchar':
      case 'fill':
      case 'alertcondition':
      case 'alert':
        return { k: 'n', v: NaN }
    }
    if (fname.startsWith('strategy.')) {
      throw err(e.pos, `${e.name} n'existe pas ici : définissez long = … et exitLong = … (ou utilisez l'onglet Pine pour convertir).`, `${e.name} is not available here: define long = … and exitLong = … (or use the Pine tab to convert).`)
    }
    const sug = suggest(fname, FUNCTIONS)
    throw err(e.pos, `Fonction inconnue « ${e.name} »${sug ? ` (vouliez-vous dire « ${sug} » ?)` : ''}.`, `Unknown function '${e.name}'${sug ? ` (did you mean '${sug}'?)` : ''}.`)
  }

  for (const st of stmts as Stmt[]) {
    if (st.k === 'expr') {
      const e = st.e
      if (e.k === 'call') evalExpr(e)
      else throw err(st.pos, 'Cette ligne calcule une valeur sans la ranger : écrivez nom = expression.', 'This line computes a value without storing it: write name = expression.')
      continue
    }
    if (BUILTIN_VARS.includes(st.names[0]) && !st.tuple) {
      throw err(st.pos, `« ${st.names[0]} » est une variable prédéfinie : choisissez un autre nom.`, `'${st.names[0]}' is a built-in variable: choose another name.`)
    }
    const e = st.e
    const value = e.k === 'call' && (e.name === 'input' || e.name.startsWith('input.')) && !st.tuple ? declareInput(e, st.names[0]) : evalExpr(e)
    if (st.tuple) {
      if (value.k !== 't') throw err(st.pos, 'Cette expression ne renvoie qu\'une valeur : retirez les crochets.', 'This expression returns a single value: remove the brackets.')
      if (st.names.length > value.items.length) throw err(st.pos, `Cette fonction renvoie ${value.items.length} séries, pas ${st.names.length}.`, `This function returns ${value.items.length} series, not ${st.names.length}.`)
      st.names.forEach((nm, k) => { if (nm !== '_') env.set(nm, value.items[k]) })
    } else {
      if (value.k === 't') throw err(st.pos, 'Cette fonction renvoie plusieurs séries : écrivez [a, b, c] = …', 'This function returns several series: write [a, b, c] = …')
      env.set(st.names[0], value)
    }
  }

  const outputs: string[] = []
  const out: Record<string, V | undefined> = {}
  for (const [k, canon] of Object.entries(OUTPUTS)) {
    if (env.has(k)) {
      out[canon] = env.get(k)
      if (!outputs.includes(canon)) outputs.push(canon)
    }
  }
  if (!out.long && !out.short) {
    throw err(null, 'Le script doit définir au moins « long = condition » (achat) ou « short = condition » (vente à découvert).', 'The script must define at least \'long = condition\' (buy) or \'short = condition\' (sell short).')
  }
  const flag = (v: V | undefined): Uint8Array => {
    const u = new Uint8Array(n)
    if (!v) return u
    if (v.k === 'n') { u.fill(truthy(v.v) ? 1 : 0); return u }
    if (v.k !== 's') return u
    for (let i = 0; i < n; i++) u[i] = truthy(v.s[i]) ? 1 : 0
    return u
  }
  const dist = (v: V | undefined): Float64Array | null => {
    if (!v) return null
    if (v.k === 'n') return ta.full(n, v.v)
    return v.k === 's' ? v.s : null
  }
  const signals: Signals = {
    long: flag(out.long),
    exitLong: flag(out.exitLong),
    short: flag(out.short),
    exitShort: flag(out.exitShort),
    stopLoss: dist(out.stopLoss),
    takeProfit: dist(out.takeProfit),
    plots,
  }
  const count = (u: Uint8Array) => u.reduce((a, b) => a + b, 0)
  if (n > 50 && out.long && count(signals.long) === 0 && (!out.short || count(signals.short) === 0)) {
    warnings.push({ fr: 'La condition d\'entrée n\'est jamais vraie sur ces données : aucun trade possible.', en: 'The entry condition is never true on this data: no trade possible.' })
  }
  return { name, inputs, signals, outputs, warnings }
}

const FUNCTIONS = [
  'sma', 'ema', 'rma', 'wma', 'hma', 'dema', 'tema', 'vwma', 'stdev', 'variance', 'highest', 'lowest', 'rsi', 'atr', 'tr',
  'cci', 'mfi', 'wpr', 'stoch', 'roc', 'mom', 'change', 'cum', 'sum', 'obv', 'vwap', 'linreg', 'macd', 'bb', 'kc', 'dmi', 'adx',
  'supertrend', 'pivothigh', 'pivotlow', 'crossover', 'crossunder', 'cross', 'rising', 'falling', 'barssince', 'valuewhen',
  'nz', 'na', 'fixnan', 'abs', 'sqrt', 'log', 'log10', 'exp', 'floor', 'ceil', 'sign', 'round', 'pow', 'max', 'min', 'avg',
  'plot', 'input', 'input.int', 'input.float', 'input.bool', 'input.source',
]

function nearPrice(values: Float64Array, close: Float64Array): boolean {
  const r: number[] = []
  const step = Math.max(1, Math.floor(values.length / 200))
  for (let i = 0; i < values.length; i += step) {
    if (values[i] === values[i] && close[i] > 0) r.push(values[i] / close[i])
  }
  if (!r.length) return true
  r.sort((a, b) => a - b)
  const m = r[Math.floor(r.length / 2)]
  return m > 0.5 && m < 2
}

function namedColor(name: string): string | null {
  const m: Record<string, string> = {
    red: '#ef4444', green: '#22c55e', blue: '#60a5fa', orange: '#fb923c', yellow: '#facc15', purple: '#c084fc',
    fuchsia: '#e879f9', aqua: '#22d3ee', teal: '#2dd4bf', lime: '#a3e635', white: '#f4f4f5', gray: '#a1a1aa',
    silver: '#d4d4d8', maroon: '#b91c1c', navy: '#3b82f6', olive: '#a3a33a', black: '#52525b',
  }
  return m[name.replace(/^color\./, '')] || null
}

function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').toLowerCase()
}

function suggest(word: string, pool: string[]): string | null {
  let best: string | null = null
  let bestD = Infinity
  for (const p of pool) {
    const d = lev(word.toLowerCase(), p.toLowerCase())
    if (d < bestD) { bestD = d; best = p }
  }
  return best && bestD <= Math.max(1, Math.floor(word.length / 3)) ? best : null
}

function lev(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1))
      prev = tmp
    }
  }
  return dp[b.length]
}

export { ScriptError }
