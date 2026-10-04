import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as ta from '../indicators.ts'
import { randomBars, close } from './helpers.ts'

const b = randomBars(400, 3)

function naiveSma(x: Float64Array, len: number, i: number): number {
  if (i < len - 1) return NaN
  let s = 0
  for (let k = 0; k < len; k++) s += x[i - k]
  return s / len
}

test('sma égale une moyenne recalculée', () => {
  const s = ta.sma(b.c, 14)
  for (let i = 0; i < b.n; i++) {
    const ref = naiveSma(b.c, 14, i)
    if (Number.isNaN(ref)) assert.ok(Number.isNaN(s[i]))
    else assert.ok(close(s[i], ref, 1e-9), `i=${i}`)
  }
})

test('ema amorcée par la moyenne simple puis récurrence', () => {
  const len = 10
  const e = ta.ema(b.c, len)
  assert.ok(Number.isNaN(e[len - 2]))
  assert.ok(close(e[len - 1], naiveSma(b.c, len, len - 1)))
  const a = 2 / (len + 1)
  for (let i = len; i < b.n; i++) assert.ok(close(e[i], a * b.c[i] + (1 - a) * e[i - 1]))
})

test('highest / lowest égalent un max / min glissant', () => {
  const hh = ta.highest(b.h, 20)
  const ll = ta.lowest(b.l, 20)
  for (let i = 19; i < b.n; i++) {
    assert.equal(hh[i], Math.max(...b.h.slice(i - 19, i + 1)))
    assert.equal(ll[i], Math.min(...b.l.slice(i - 19, i + 1)))
  }
})

test('rsi reste entre 0 et 100 et vaut 100 sur une hausse continue', () => {
  const r = ta.rsi(b.c, 14)
  for (let i = 15; i < b.n; i++) assert.ok(r[i] >= 0 && r[i] <= 100)
  const up = Float64Array.from({ length: 50 }, (_, i) => 100 + i)
  assert.equal(ta.rsi(up, 14)[49], 100)
})

test('rsi suit la formule de Wilder', () => {
  const len = 14
  const r = ta.rsi(b.c, len)
  let au = 0
  let ad = 0
  for (let i = 1; i <= len; i++) {
    const d = b.c[i] - b.c[i - 1]
    au += Math.max(d, 0)
    ad += Math.max(-d, 0)
  }
  au /= len
  ad /= len
  assert.ok(close(r[len], 100 - 100 / (1 + au / ad)))
  for (let i = len + 1; i < 60; i++) {
    const d = b.c[i] - b.c[i - 1]
    au = (au * (len - 1) + Math.max(d, 0)) / len
    ad = (ad * (len - 1) + Math.max(-d, 0)) / len
    assert.ok(close(r[i], 100 - 100 / (1 + au / ad)), `i=${i}`)
  }
})

test('atr = moyenne de Wilder du true range', () => {
  const a = ta.atr(b.h, b.l, b.c, 14)
  const t = ta.tr(b.h, b.l, b.c)
  let s = 0
  for (let i = 0; i < 14; i++) s += t[i]
  assert.ok(close(a[13], s / 14))
  assert.ok(close(a[14], (a[13] * 13 + t[14]) / 14))
})

test('crossover et crossunder détectent les croisements', () => {
  const x = Float64Array.from([1, 2, 3, 2, 1])
  const y = Float64Array.from([2, 2, 2, 2, 2])
  assert.deepEqual([...ta.crossover(x, y)], [0, 0, 1, 0, 0])
  assert.deepEqual([...ta.crossunder(x, y)], [0, 0, 0, 0, 1])
})

test('supertrend : direction -1 en hausse, 1 en baisse', () => {
  const n = 120
  const c = Float64Array.from({ length: n }, (_, i) => (i < 60 ? 100 + i : 160 - (i - 60) * 2))
  const h = c.map(x => x + 1)
  const l = c.map(x => x - 1)
  const [, dir] = ta.supertrend(h, l, c, 3, 10)
  assert.equal(dir[55], -1)
  assert.equal(dir[110], 1)
})

test('pivothigh confirmé seulement après les barres de droite', () => {
  const x = Float64Array.from([1, 2, 5, 2, 1, 1, 1])
  const p = ta.pivothigh(x, 2, 2)
  assert.ok(Number.isNaN(p[2]) && Number.isNaN(p[3]))
  assert.equal(p[4], 5)
})

test('barssince et valuewhen', () => {
  const cond = Float64Array.from([0, 1, 0, 0, 1, 0])
  const src = Float64Array.from([10, 11, 12, 13, 14, 15])
  assert.deepEqual([...ta.barssince(cond)].map(v => (Number.isNaN(v) ? -1 : v)), [-1, 0, 1, 2, 0, 1])
  const vw = ta.valuewhen(cond, src, 1)
  assert.equal(vw[5], 11)
})
