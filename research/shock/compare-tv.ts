// Compare le port aux trades de TradingView, pour vérifier qu'il reproduit bien le script.
//
//   node research/shock/compare-tv.ts --tf 5 --tv liste_des_trades.csv [--set kMain=2.2 ...]
//
// Le CSV est l'export « Liste des trades » du Strategy Tester (bouton d'export), sur
// BITSTAMP:BTCUSD, avec les réglages du script inchangés (ou les mêmes --set ici).
// Le fuseau horaire de l'export (celui du graphique) est détecté seul.

import { readFileSync } from 'node:fs'
import { parseCsv, parseTime, toNumber } from '../../lib/backtest/data.ts'
import { loadBtc, indexAtOrAfter } from '../lib/data.ts'
import { makeMarket, runShock } from '../../lib/strategies/shock/engine.ts'
import { DEFAULT_PARAMS, SCRIPT_COSTS, withParams } from '../../lib/strategies/shock/params.ts'
import { parseArgs } from './run.ts'

interface TvPos {
  dir: 1 | -1
  entryT: number
  entryPx: number
  exitT: number
  pnl: number
}

function readTv(path: string): TvPos[] {
  const tab = parseCsv(readFileSync(path, 'utf8'))
  const low = tab.head.map(h => h.toLowerCase())
  const col = (re: RegExp) => low.findIndex(h => re.test(h))
  const iNum = col(/trade\s*#|^#|n°/)
  const iType = col(/^type/)
  const iTime = col(/date|time|heure/)
  const iPx = col(/^price|^prix/)
  const iPnl = col(/net p&l|profit|p&l|résultat|bénéfice/)
  if (iNum < 0 || iType < 0 || iTime < 0 || iPx < 0) throw new Error(`colonnes non reconnues : ${tab.head.join(', ')}`)
  const trades = new Map<string, { entry?: string[]; exit?: string[] }>()
  for (const r of tab.rows) {
    const k = r[iNum]
    if (!trades.has(k)) trades.set(k, {})
    const t = trades.get(k)!
    if (/entry|entrée/i.test(r[iType])) t.entry = r
    else t.exit = r
  }
  // Une position = même heure et même sens d'entrée (TradingView sépare les sorties partielles).
  const byEntry = new Map<string, TvPos>()
  for (const t of trades.values()) {
    if (!t.entry || !t.exit) continue
    const dir: 1 | -1 = /long|achat/i.test(t.entry[iType]) ? 1 : -1
    const entryT = parseTime(t.entry[iTime])
    const key = `${entryT}:${dir}`
    const pnl = iPnl >= 0 ? toNumber(t.exit[iPnl] ?? '', tab.delimiter) : NaN
    const exitT = parseTime(t.exit[iTime])
    const cur = byEntry.get(key)
    if (cur) { cur.exitT = Math.max(cur.exitT, exitT); cur.pnl += pnl }
    else byEntry.set(key, { dir, entryT, entryPx: toNumber(t.entry[iPx], tab.delimiter), exitT, pnl })
  }
  return [...byEntry.values()].sort((a, b) => a.entryT - b.entryT)
}

function main() {
  const { a, sets } = parseArgs(process.argv.slice(2))
  if (!a.tv) throw new Error('--tv <export.csv> manquant')
  const tf = Number(a.tf ?? 5)
  const tv = readTv(a.tv)
  if (!tv.length) throw new Error('aucun trade lu dans l\'export')
  const bars = loadBtc(tf)
  const m = makeMarket(bars, tf, loadBtc(60))
  const first = tv[0].entryT
  const last = tv[tv.length - 1].exitT
  const start = Math.max(0, indexAtOrAfter(bars, first - 2 * 86400000))
  const end = Math.min(bars.n - 1, indexAtOrAfter(bars, last + 2 * 86400000))
  const r = runShock(m, withParams(DEFAULT_PARAMS, sets), SCRIPT_COSTS, start, end)
  const ours = r.positions.map(p => ({ dir: p.dir, t: bars.t[p.entryIdx], px: p.entryPrice, exitT: bars.t[p.exitIdx], pnl: p.pnl }))
  // Fuseau : décalage (en heures) qui fait coïncider le plus d'entrées.
  const ourSet = new Set(ours.map(o => `${o.t}:${o.dir}`))
  let bestOff = 0
  let bestHits = -1
  for (let h = -12; h <= 14; h += 0.5) {
    const off = h * 3600000
    const hits = tv.filter(x => ourSet.has(`${x.entryT - off}:${x.dir}`)).length
    if (hits > bestHits) { bestHits = hits; bestOff = off }
  }
  const tol = tf * 60000
  let matched = 0
  let sameExit = 0
  const pxDiff: number[] = []
  const missing: TvPos[] = []
  const byTime = new Map(ours.map(o => [`${o.t}:${o.dir}`, o]))
  for (const x of tv) {
    const t = x.entryT - bestOff
    const o = byTime.get(`${t}:${x.dir}`) ?? byTime.get(`${t - tol}:${x.dir}`) ?? byTime.get(`${t + tol}:${x.dir}`)
    if (!o) { missing.push(x); continue }
    matched++
    if (Math.abs(o.exitT - (x.exitT - bestOff)) <= tol) sameExit++
    pxDiff.push(Math.abs(o.px - x.entryPx) / x.entryPx)
  }
  const tvSet = new Set(tv.map(x => `${x.entryT - bestOff}:${x.dir}`))
  const extra = ours.filter(o => o.t >= first - bestOff && o.t <= last - bestOff && !tvSet.has(`${o.t}:${o.dir}`))
  pxDiff.sort((x, y) => x - y)
  const iso = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ')
  console.log(`Fuseau détecté : UTC${bestOff >= 0 ? '+' : ''}${bestOff / 3600000} h`)
  console.log(`Positions TradingView : ${tv.length} · retrouvées dans le port : ${matched} (${((100 * matched) / tv.length).toFixed(1)} %) · même barre de sortie : ${sameExit}`)
  console.log(`Positions du port absentes de TradingView : ${extra.length}`)
  if (pxDiff.length) console.log(`Écart de prix d'entrée médian : ${(pxDiff[Math.floor(pxDiff.length / 2)] * 100).toFixed(3)} %`)
  if (missing.length) console.log('Premières entrées TradingView non retrouvées :\n' + missing.slice(0, 10).map(x => `  ${iso(x.entryT - bestOff)} UTC ${x.dir === 1 ? 'long' : 'short'} @ ${x.entryPx}`).join('\n'))
  if (extra.length) console.log('Premières entrées du port absentes de TradingView :\n' + extra.slice(0, 10).map(o => `  ${iso(o.t)} UTC ${o.dir === 1 ? 'long' : 'short'} @ ${o.px.toFixed(2)}`).join('\n'))
}

main()
