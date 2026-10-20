// Anatomie des trades de la stratégie OU Trend Channel (H1 par défaut) : distribution des gains et des
// pertes, en multiples du risque initial (R), sorties, durée, longs / shorts, frais, alpha et bêta contre
// BTC, test d'entrées au hasard (même sens, même durée, même stop) sur entraînement et validation.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/ou-channel/ou-trades.ts [--tf 60]

import { mkdirSync, writeFileSync } from 'node:fs'
import { ouMarket } from './lib.ts'
import type { Entry, Exit, Res, Trade } from './lib.ts'
import { BASE_ENTRY, BASE_EXIT } from './lib.ts'
import { alphaBeta } from '../lib/series.ts'

const TF = Number(process.argv.includes('--tf') ? process.argv[process.argv.indexOf('--tf') + 1] : 60)
const M = ouMarket(TF)
const { o, h, l, c, t, atr30, FEE, DAY } = M
const TOP1: Entry = { zMin: 2.2, reentry: 1, wickThr: 0.7, volMin: NaN, volDiv: false }
const CONFIGS: { name: string; e: Entry; ex: Exit }[] = [
  { name: 'Baseline (réglages d\'origine, stop 3,3 ATR)', e: BASE_ENTRY, ex: BASE_EXIT },
  { name: 'Top 1 (stop 3,3 ATR)', e: TOP1, ex: BASE_EXIT },
  { name: 'Top 1, stop 4,5 ATR (meilleure)', e: TOP1, ex: { stop: 4.5, tpR: 0, trail: false } },
]
const q = (xs: number[], p: number) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return NaN; const k = (s.length - 1) * p, f = Math.floor(k); return s[f] + (k - f) * ((s[f + 1] ?? s[f]) - s[f]) }
const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length)
const sum = (xs: number[]) => xs.reduce((a, x) => a + x, 0)
const hours = (tr: Trade) => ((tr.j1 - tr.j0) * TF) / 60

/** BTC : rendements journaliers aux mêmes clôtures de jour que la stratégie. */
function btcDaily(days: number[]) {
  const close = new Map<number, number>()
  for (let i = 0; i < M.n; i++) close.set(Math.floor(t[i] / DAY), c[i])
  return days.map((d, k) => (k ? close.get(d)! / close.get(days[k - 1])! - 1 : 0))
}

/** Entrées au hasard : chaque trade réel est rejoué à une bougie tirée au hasard, même sens, même stop en ATR, sortie au stop ou après la même durée. */
function randomTiming(trs: Trade[], ex: Exit, a: number, z1: number, draws = 500) {
  let s = 20261020 >>> 0
  const rand = () => { s = (s + 0x6d2b79f5) >>> 0; let x = s; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296 }
  const play = (j0: number, dir: number, dur: number) => {
    const A = atr30[j0 - 1], entry = o[j0], stop = entry - dir * ex.stop * A
    for (let j = j0; j <= Math.min(z1, j0 + dur); j++) {
      if (dir === 1 && l[j] <= stop) return (Math.min(o[j], stop) / entry - 1) - FEE * (1 + Math.min(o[j], stop) / entry)
      if (dir === -1 && h[j] >= stop) return (1 - Math.max(o[j], stop) / entry) - FEE * (1 + Math.max(o[j], stop) / entry)
    }
    const px = c[Math.min(z1, j0 + dur)]
    return dir * (px / entry - 1) - FEE * (1 + px / entry)
  }
  const actual = sum(trs.map(x => Math.log(1 + x.net)))
  const dist: number[] = []
  for (let d = 0; d < draws; d++) {
    let tot = 0
    for (const x of trs) { const dur = x.j1 - x.j0; const j0 = a + 1 + Math.floor(rand() * Math.max(1, z1 - a - dur - 1)); tot += Math.log(1 + play(j0, x.dir, dur)) }
    dist.push(tot)
  }
  return { actual, median: q(dist, 0.5), q95: q(dist, 0.95), beaten: dist.filter(x => x < actual).length / draws }
}

function anatomy(res: Res, ex: Exit, a: number, z1: number) {
  const trs = res.list
  const R = trs.map(x => x.net / x.stopPct)
  const win = trs.filter(x => x.net > 0), loss = trs.filter(x => x.net <= 0)
  const lr = trs.map(x => Math.log(1 + x.net)), tot = sum(lr)
  const sorted = [...lr].sort((x, y) => y - x)
  const bins: [string, (r: number) => boolean][] = [
    ['< −1,2 R (stop glissé)', r => r < -1.2], ['−1,2 à −0,8 R (stop)', r => r >= -1.2 && r < -0.8], ['−0,8 à 0 R', r => r >= -0.8 && r <= 0],
    ['0 à 1 R', r => r > 0 && r <= 1], ['1 à 3 R', r => r > 1 && r <= 3], ['3 à 10 R', r => r > 3 && r <= 10], ['> 10 R', r => r > 10],
  ]
  const side = (d: number) => { const s = trs.filter(x => x.dir === d); return { n: s.length, win: s.filter(x => x.net > 0).length / Math.max(1, s.length), sumLog: sum(s.map(x => Math.log(1 + x.net))) } }
  const reasons = ['stop', 'signal', 'end'].map(r => ({ r, n: trs.filter(x => x.reason === r).length, win: trs.filter(x => x.reason === r && x.net > 0).length }))
  const ab = alphaBeta(res.r, btcDaily(res.days))
  const gross = trs.map(x => x.gross)
  const gp = sum(gross.filter(x => x > 0)), gl = sum(gross.filter(x => x <= 0))
  return {
    n: trs.length, winRate: win.length / Math.max(1, trs.length),
    avgWin: mean(win.map(x => x.net)), medWin: q(win.map(x => x.net), 0.5), avgLoss: mean(loss.map(x => x.net)), medLoss: q(loss.map(x => x.net), 0.5),
    payoff: mean(win.map(x => x.net)) / -mean(loss.map(x => x.net)), expectancy: mean(trs.map(x => x.net)),
    pct: [0.05, 0.25, 0.5, 0.75, 0.95].map(p => q(trs.map(x => x.net), p)), maxWin: Math.max(...trs.map(x => x.net)), maxLoss: Math.min(...trs.map(x => x.net)),
    rBins: bins.map(([name, f]) => ({ name, n: R.filter(f).length, sumLog: sum(trs.filter((_, k) => f(R[k])).map(x => Math.log(1 + x.net))) })),
    medR: q(R, 0.5), meanR: mean(R), stopPct: q(trs.map(x => x.stopPct), 0.5),
    top5Share: sum(sorted.slice(0, 5)) / tot, top10pctShare: sum(sorted.slice(0, Math.max(1, Math.round(trs.length / 10)))) / tot, totalLog: tot,
    holdWin: q(win.map(hours), 0.5), holdLoss: q(loss.map(hours), 0.5), inPos: res.inPos, tradesPerYear: trs.length / (res.r.length / 365.25),
    long: side(1), short: side(-1), reasons,
    feeDrag: 2 * FEE, meanGross: mean(gross), grossPF: gl < 0 ? gp / -gl : NaN,
    beta: ab.beta, alphaYear: ab.alphaYear, tAlpha: ab.tAlpha, random: randomTiming(trs, ex, a, z1),
  }
}

const out = CONFIGS.map(k => {
  const sig = M.signals(k.e)
  const tr = M.train(sig, k.ex), va = M.valid(sig, k.ex)
  return { name: k.name, train: anatomy(tr, k.ex, M.iTr, M.iVa - 1), valid: anatomy(va, k.ex, M.iVa, M.iEnd), sharpe: [tr.sharpe, va.sharpe] }
})

const pc = (x: number, d = 2) => (Number.isFinite(x) ? `${(x * 100).toFixed(d)} %` : '—').replace('.', ',').replace('-', '−')
const nm = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—').replace('.', ',').replace('-', '−')
const L: string[] = [`# Anatomie des trades · OU Trend Channel · BTC/USD ${TF >= 60 ? `${TF / 60} h` : `${TF} min`}`, '', 'Entraînement 2017-01-01 → 2022-12-31 · validation 2023-01-01 → 2026-09-30 · commission 0,045 % par ordre · R = distance du stop initial. Produit par `node research/ou-channel/ou-trades.ts`.', '']
for (const seg of ['train', 'valid'] as const) {
  L.push(`## ${seg === 'train' ? 'Entraînement' : 'Validation'}`, '')
  const head = ['', ...out.map(x => x.name)]
  const r = (label: string, f: (a: ReturnType<typeof anatomy>) => string) => `| ${label} | ${out.map(x => f(x[seg])).join(' | ')} |`
  L.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`)
  L.push(r('Sharpe', a => nm(out.find(x => x[seg] === a)!.sharpe[seg === 'train' ? 0 : 1])))
  L.push(r('trades (par an)', a => `${a.n} (${nm(a.tradesPerYear, 0)})`), r('temps en position', a => pc(a.inPos, 0)), r('taux de gain', a => pc(a.winRate, 1)))
  L.push(r('gain moyen · médian', a => `${pc(a.avgWin)} · ${pc(a.medWin)}`), r('perte moyenne · médiane', a => `${pc(a.avgLoss)} · ${pc(a.medLoss)}`), r('payoff (gain moy. / perte moy.)', a => nm(a.payoff)))
  L.push(r('espérance par trade', a => pc(a.expectancy, 3)), r('rendement brut moyen · frais aller-retour', a => `${pc(a.meanGross, 3)} · ${pc(a.feeDrag, 3)}`), r('PF brut (sans frais)', a => nm(a.grossPF)))
  L.push(r('P5 · P25 · P50 · P75 · P95', a => a.pct.map(x => pc(x, 1)).join(' · ')), r('meilleur · pire trade', a => `${pc(a.maxWin, 1)} · ${pc(a.maxLoss, 1)}`))
  L.push(r('stop initial médian (% du prix)', a => pc(a.stopPct)), r('R médian · R moyen', a => `${nm(a.medR)} · ${nm(a.meanR)}`))
  for (let k = 0; k < out[0][seg].rBins.length; k++) L.push(r(`R ${out[0][seg].rBins[k].name}`, a => `${a.rBins[k].n} (${pc(a.rBins[k].n / a.n, 0)}) · ${nm(a.rBins[k].sumLog)}`))
  L.push(r('part des 5 meilleurs trades · des 10 % meilleurs (log)', a => `${pc(a.top5Share, 0)} · ${pc(a.top10pctShare, 0)}`))
  L.push(r('durée médiane gagnants · perdants', a => `${nm(a.holdWin, 0)} h · ${nm(a.holdLoss, 0)} h`))
  L.push(r('sorties : stop · signal opposé · fin', a => a.reasons.map(x => `${x.n} (${pc(x.win / Math.max(1, x.n), 0)} gagnants)`).join(' · ')))
  L.push(r('longs : n · gain · somme log', a => `${a.long.n} · ${pc(a.long.win, 0)} · ${nm(a.long.sumLog)}`), r('shorts : n · gain · somme log', a => `${a.short.n} · ${pc(a.short.win, 0)} · ${nm(a.short.sumLog)}`))
  L.push(r('bêta BTC · alpha / an · t', a => `${nm(a.beta)} · ${pc(a.alphaYear, 1)} · ${nm(a.tAlpha)}`))
  L.push(r('hasard (même sens, durée, stop) : réel · médiane · 95e c. · battus', a => `${nm(a.random.actual)} · ${nm(a.random.median)} · ${nm(a.random.q95)} · ${pc(a.random.beaten, 0)}`), '')
}
mkdirSync('research/reports/ou-channel', { recursive: true })
writeFileSync(`research/reports/ou-channel/ou-trades-${TF}m.md`, L.join('\n') + '\n')
console.log(L.join('\n'))
