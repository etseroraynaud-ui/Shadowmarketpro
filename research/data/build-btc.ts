// Construit les barres BTC/USD 5, 15, 30 et 60 minutes depuis l'historique Bitstamp à la minute
// (https://github.com/ff137/bitstamp-btcusd-minute-data, licence des données : voir ce dépôt).
//
//   node research/data/build-btc.ts <historique.csv.gz> [mises_a_jour.csv ...]
//
// Les minutes à volume nul sont des bougies plates ajoutées par la source pour combler les
// minutes sans échange : elles sont ignorées, comme TradingView n'affiche pas de barre sans
// échange. Une barre n'existe que si au moins une minute de sa période a échangé.
// Barres alignées sur l'époque Unix (UTC), horodatées à l'ouverture, en millisecondes.

import { createReadStream, createWriteStream } from 'node:fs'
import { createGunzip, createGzip } from 'node:zlib'
import { createInterface } from 'node:readline'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))
const FRAMES = [5, 15, 30, 60]

interface Agg {
  t: number
  o: number
  h: number
  l: number
  c: number
  v: number
}

const current: (Agg | null)[] = FRAMES.map(() => null)
const rows: string[][] = FRAMES.map(() => [])
let lastMinute = -Infinity
let kept = 0
let skippedZero = 0
let skippedOrder = 0

const fmt = (x: number) => (Number.isInteger(x) ? String(x) : String(Math.round(x * 1e8) / 1e8))

function push(k: number) {
  const a = current[k]
  if (a) rows[k].push(`${a.t},${fmt(a.o)},${fmt(a.h)},${fmt(a.l)},${fmt(a.c)},${fmt(a.v)}`)
}

function addMinute(tSec: number, o: number, h: number, l: number, c: number, v: number) {
  if (tSec <= lastMinute) { skippedOrder++; return }
  lastMinute = tSec
  if (!(v > 0)) { skippedZero++; return }
  kept++
  const tMs = tSec * 1000
  FRAMES.forEach((f, k) => {
    const start = Math.floor(tMs / (f * 60000)) * f * 60000
    const a = current[k]
    if (a && a.t === start) {
      if (h > a.h) a.h = h
      if (l < a.l) a.l = l
      a.c = c
      a.v += v
    } else {
      push(k)
      current[k] = { t: start, o, h, l, c, v }
    }
  })
}

async function readFile(path: string) {
  const input = path.endsWith('.gz') ? createReadStream(path).pipe(createGunzip()) : createReadStream(path)
  const rl = createInterface({ input, crlfDelay: Infinity })
  let first = true
  for await (const line of rl) {
    if (first) { first = false; if (/[a-z]/i.test(line)) continue }
    const p = line.split(',')
    if (p.length < 6) continue
    addMinute(Number(p[0]), Number(p[1]), Number(p[2]), Number(p[3]), Number(p[4]), Number(p[5]))
  }
}

async function main() {
  const files = process.argv.slice(2)
  if (!files.length) {
    console.error('usage: node research/data/build-btc.ts <historique.csv.gz> [mises_a_jour.csv ...]')
    process.exit(1)
  }
  for (const f of files) {
    console.log(`lecture ${f}`)
    await readFile(f)
  }
  FRAMES.forEach((_, k) => push(k))
  for (const [k, f] of FRAMES.entries()) {
    const path = join(OUT, `btcusd_${f}m.csv.gz`)
    const gz = createGzip({ level: 9 })
    const ws = createWriteStream(path)
    gz.pipe(ws)
    gz.write('time,open,high,low,close,volume\n')
    for (let i = 0; i < rows[k].length; i += 10000) gz.write(rows[k].slice(i, i + 10000).join('\n') + '\n')
    gz.end()
    await new Promise<void>(res => ws.on('finish', () => res()))
    console.log(`${f}m : ${rows[k].length} barres -> ${path}`)
  }
  console.log(`minutes gardées ${kept}, sans volume ignorées ${skippedZero}, hors ordre ignorées ${skippedOrder}`)
}

main()
