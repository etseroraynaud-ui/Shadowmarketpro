import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadBarsFromCsv, parseTime } from '../data.ts'
import { readSignalCsv, signalsFromFile, guessMode, defaultSignalColumn } from '../signals.ts'
import { convertPine } from '../pine.ts'
import { compileScript } from '../script/compile.ts'
import * as ta from '../indicators.ts'
import { randomBars } from './helpers.ts'

test('dates : Unix s et ms, ISO, MetaTrader, européen, américain', () => {
  const t = Date.UTC(2024, 0, 15, 8, 30)
  assert.equal(parseTime(String(t / 1000)), t)
  assert.equal(parseTime(String(t)), t)
  assert.equal(parseTime('2024-01-15T08:30:00Z'), t)
  assert.equal(parseTime('2024-01-15 08:30'), t)
  assert.equal(parseTime('2024.01.15 08:30'), t)
  assert.equal(parseTime('2024-01-15T10:30:00+02:00'), t)
  assert.equal(parseTime('15/01/2024 08:30'), t)
  assert.equal(parseTime('01/15/2024 08:30'), t)
})

test('CSV TradingView (secondes Unix) et volume absent', () => {
  const csv = 'time,open,high,low,close\n1704067200,100,110,90,105\n1704153600,105,115,95,110\n1704240000,110,120,100,115\n'
  const d = loadBarsFromCsv(csv)
  assert.equal(d.bars.n, 3)
  assert.equal(d.bars.t[0], 1704067200000)
  assert.equal(d.timeframe, '1D')
  assert.equal(d.bars.v[0], 0)
})

test('CSV européen : point-virgule, virgule décimale, ordre décroissant', () => {
  const csv = 'Date;Ouverture;Plus haut;Plus bas;Clôture;Volume\n03/01/2024;110,5;120;100;115,25;1000\n02/01/2024;105;115;95;110;900\n01/01/2024;100;110;90;105;800\n'
  const d = loadBarsFromCsv(csv)
  assert.equal(d.bars.n, 3)
  assert.equal(d.bars.c[2], 115.25)
  assert.equal(d.bars.o[2], 110.5)
  assert.ok(d.bars.t[0] < d.bars.t[1])
})

test('CSV MetaTrader : date et heure séparées, sans en-tête de volume', () => {
  const csv = '<DATE>,<TIME>,<OPEN>,<HIGH>,<LOW>,<CLOSE>,<TICKVOL>\n2024.01.02,00:00,1.1,1.2,1.0,1.15,100\n2024.01.02,04:00,1.15,1.25,1.1,1.2,120\n'
  const d = loadBarsFromCsv(csv)
  assert.equal(d.bars.n, 2)
  assert.equal(d.bars.t[1] - d.bars.t[0], 4 * 3600000)
  assert.equal(d.bars.v[1], 120)
})

test('CSV : barre incohérente corrigée et signalée', () => {
  const d = loadBarsFromCsv('date,open,high,low,close\n2024-01-01,100,99,90,105\n2024-01-02,100,110,90,105\n')
  assert.equal(d.bars.h[0], 105)
  assert.ok(d.warnings.length >= 1)
})

test('signaux CSV : position, alignement sur les barres, report jusqu\'à la ligne suivante', () => {
  const b = randomBars(10, 2)
  const day = 86400000
  const csv = `time,signal\n${b.t[2] / 1000},1\n${b.t[5] / 1000},0\n${b.t[7] / 1000},-1\n`
  const f = readSignalCsv(csv)
  const col = defaultSignalColumn(f)
  assert.equal(f.cols[col], 'signal')
  assert.equal(guessMode(f, col), 'position')
  const { signals, matched } = signalsFromFile(b, f, { col, mode: 'position', upper: 0, lower: 0 })
  assert.equal(matched, 3)
  assert.deepEqual([...signals.long], [0, 0, 1, 1, 1, 0, 0, 0, 0, 0])
  assert.deepEqual([...signals.short], [0, 0, 0, 0, 0, 0, 0, 1, 1, 1])
  assert.equal(signals.exitLong[5], 1)
  assert.ok(day > 0)
})

test('signaux CSV : événements et seuils', () => {
  const b = randomBars(6, 2)
  const f = readSignalCsv(`date,ev,osc\n${b.t[1]},1,10\n${b.t[3]},-1,90\n${b.t[4]},0,50\n`)
  const ev = signalsFromFile(b, f, { col: 0, mode: 'events', upper: 0, lower: 0 }).signals
  assert.deepEqual([...ev.long], [0, 1, 0, 0, 0, 0])
  assert.deepEqual([...ev.short], [0, 0, 0, 1, 0, 0])
  const th = signalsFromFile(b, f, { col: 1, mode: 'threshold', upper: 70, lower: 30 }).signals
  assert.deepEqual([...th.long], [0, 0, 0, 1, 0, 0])
  assert.deepEqual([...th.short], [0, 1, 1, 0, 0, 0])
})

const PINE_V5 = `//@version=5
strategy("EMA Cross", overlay=true, initial_capital=5000, commission_type=strategy.commission.percent, commission_value=0.075, default_qty_type=strategy.percent_of_equity, default_qty_value=50)
fastLen = input.int(9, "Fast", minval=1)
slowLen = input.int(21, "Slow", minval=1)
fast = ta.ema(close, fastLen)
slow = ta.ema(close, slowLen)
longCondition = ta.crossover(fast, slow)
if (longCondition)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fast, slow)
    strategy.close("Long")
plot(fast, color=color.orange)
plot(slow, color=color.blue)
`

test('Pine v5 : conversion, réglages repris, signaux identiques au calcul direct', () => {
  const conv = convertPine(PINE_V5)
  assert.equal(conv.name, 'EMA Cross')
  assert.equal(conv.settings.capital, 5000)
  assert.equal(conv.settings.feePct, 0.075)
  assert.equal(conv.settings.sizeValue, 50)
  const b = randomBars(500, 9)
  const c = compileScript(conv.script, b)
  const f = ta.ema(b.c, 9)
  const s = ta.ema(b.c, 21)
  const up = ta.crossover(f, s)
  const dn = ta.crossunder(f, s)
  for (let i = 0; i < b.n; i++) {
    assert.equal(c.signals.long[i], up[i])
    assert.equal(c.signals.exitLong[i], dn[i])
  }
  assert.deepEqual(c.inputs.map(x => x.name), ['fastLen', 'slowLen'])
})

test('Pine : forme v4 « when », if / else, long et short, lignes non prises en charge signalées', () => {
  const src = `//@version=4
strategy("Test")
len = input(14)
r = rsi(close, len)
strategy.entry("L", strategy.long, when = r < 30)
if r > 70
    strategy.entry("S", strategy.short)
else
    strategy.close("S")
var float count = 0
count := count + 1
strategy.exit("x", "L", stop = close * 0.9)
`
  const conv = convertPine(src)
  assert.match(conv.script, /long = r < 30/)
  assert.match(conv.script, /short = r > 70/)
  assert.match(conv.script, /exitShort = not \(r > 70\)/)
  assert.equal(conv.settings.direction, 'both')
  assert.ok(conv.warnings.some(w => /:=/.test(w.fr)))
  assert.ok(conv.warnings.some(w => /strategy\.exit/.test(w.fr)))
  const c = compileScript(conv.script, randomBars(200, 1))
  assert.ok(c.signals.long.some(x => x === 1))
})

test('Pine : variable nommée long renommée partout', () => {
  const conv = convertPine(`strategy("x")
long = ta.crossover(close, ta.sma(close, 10))
if long
    strategy.entry("long", strategy.long)
`)
  assert.match(conv.script, /long_pine = ta\.crossover/)
  assert.match(conv.script, /^long = long_pine$/m)
  compileScript(conv.script, randomBars(100, 1))
})
