import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compileScript, scriptInputs } from '../script/compile.ts'
import { ScriptError } from '../script/parser.ts'
import * as ta from '../indicators.ts'
import { TEMPLATES } from '../templates.ts'
import { sliceBars } from '../data.ts'
import { randomBars } from './helpers.ts'

const b = randomBars(600, 5)

function errorOf(src: string): ScriptError {
  try {
    compileScript(src, b)
  } catch (e) {
    if (e instanceof ScriptError) return e
    throw e
  }
  throw new Error('no error')
}

test('croisement de moyennes : signaux identiques au calcul direct', () => {
  const c = compileScript('f = ema(close, 10)\ns = ta.sma(close, 30)\nlong = crossover(f, s)\nexitLong = crossunder(f, s)', b)
  const ref = ta.crossover(ta.ema(b.c, 10), ta.sma(b.c, 30))
  for (let i = 0; i < b.n; i++) assert.equal(c.signals.long[i], ref[i])
  assert.deepEqual(c.outputs, ['long', 'exitLong'])
})

test('paramètres : input, input.int avec arguments nommés, surcharge', () => {
  const src = 'len = input.int(20, title="Longueur", minval=2, maxval=100)\nk = input(1.5, "Mult")\nflag = input.bool(true, "Filtre")\nlong = close > sma(close, len) * k'
  const { inputs } = scriptInputs(src)
  assert.deepEqual(inputs.map(i => [i.name, i.kind, i.defval, i.min, i.max]), [
    ['len', 'int', 20, 2, 100],
    ['k', 'float', 1.5, null, null],
    ['flag', 'bool', 1, 0, 1],
  ])
  const a = compileScript(src, b, { len: 50, k: 1 })
  const ref = ta.sma(b.c, 50)
  for (let i = 0; i < b.n; i++) assert.equal(a.signals.long[i], b.c[i] > ref[i] ? 1 : 0)
})

test('tuples, ternaire, historique, na et nz', () => {
  const c = compileScript('[m, u, d] = bb(close, 20, 2)\nx = close > u ? 1 : close < d ? -1 : 0\ny = nz(m[1], 0)\nlong = x == 1 and y > 0\nshort = x == -1', b)
  const [m, u] = ta.bb(b.c, 20, 2)
  for (let i = 21; i < b.n; i++) assert.equal(c.signals.long[i], b.c[i] > u[i] && m[i - 1] > 0 ? 1 : 0)
})

test('continuation de ligne entre parenthèses et après un opérateur', () => {
  const c = compileScript('long = close > open and\n  close > close[1]\nexitLong = (close <\n open)', b)
  for (let i = 1; i < b.n; i++) assert.equal(c.signals.long[i], b.c[i] > b.o[i] && b.c[i] > b.c[i - 1] ? 1 : 0)
})

test('les modèles se compilent et définissent un signal d\'entrée', () => {
  for (const t of TEMPLATES) {
    const c = compileScript(t.script, b)
    assert.ok(c.outputs.includes('long') || c.outputs.includes('short'), t.id)
  }
})

test('causalité : signaux identiques sur des données tronquées', () => {
  for (const t of TEMPLATES) {
    const full = compileScript(t.script, b).signals
    const cut = 400
    const part = compileScript(t.script, sliceBars(b, null, b.t[cut - 1])).signals
    for (let i = 0; i < cut; i++) {
      assert.equal(part.long[i], full.long[i], `${t.id} long @${i}`)
      assert.equal(part.exitLong[i], full.exitLong[i], `${t.id} exitLong @${i}`)
      assert.equal(part.short[i], full.short[i], `${t.id} short @${i}`)
    }
  }
})

test('erreurs : position, variable inconnue avec suggestion, futur interdit', () => {
  const e1 = errorOf('rapide = ema(close, 10)\nlong = crossover(rapid, close)')
  assert.equal(e1.pos!.line, 2)
  assert.match(e1.msg.fr, /rapide/)
  const e2 = errorOf('long = close[-1] > close')
  assert.match(e2.msg.fr, /futur/)
  const e3 = errorOf('x = 1\nx := 2\nlong = true')
  assert.match(e3.msg.fr, /réaffectation/)
  const e4 = errorOf('x = ema(close, 10)')
  assert.match(e4.msg.fr, /long/)
  const e5 = errorOf('long = emaa(close, 3) > 0')
  assert.match(e5.msg.fr, /ema/)
  const e6 = errorOf('long = close > (open')
  assert.equal(e6.pos!.line, 1)
})

test('plot : sur le prix ou en panneau selon l\'échelle', () => {
  const c = compileScript('plot(sma(close, 10), "Moyenne")\nplot(rsi(close, 14), "RSI")\nlong = true', b)
  assert.equal(c.signals.plots.length, 2)
  assert.equal(c.signals.plots[0].overlay, true)
  assert.equal(c.signals.plots[1].overlay, false)
})

test('stopLoss et takeProfit deviennent des distances', () => {
  const c = compileScript('long = true\nstopLoss = 2 * atr(14)\ntakeProfit = 5', b)
  const a = ta.atr(b.h, b.l, b.c, 14)
  assert.equal(c.signals.stopLoss![100], 2 * a[100])
  assert.equal(c.signals.takeProfit![100], 5)
})
