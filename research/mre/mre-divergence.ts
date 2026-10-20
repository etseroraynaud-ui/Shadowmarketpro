// Divergences prix / Regime Wave (MRE v1.5 VWAP) sur BTC/USD : étude d'événement et stratégie
// (research/preregistration/mre-divergence.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/mre/mre-divergence.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { loadBtc } from '../lib/data.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { ouMarket } from '../ou-channel/lib.ts'
import type { Exit, Res } from '../ou-channel/lib.ts'
import { regimeWave } from './wave.ts'
import { newYorkClock } from '../futures-transfer/lib/proxy-data.ts'
import { baseline, familyStats, randomEvents } from '../futures-transfer/lib/event-study.ts'
import type { Ev, Ctx } from '../futures-transfer/lib/event-study.ts'
import { dsr } from '../lib/overfit.ts'

const TFS = [15, 60, 240], LS = [3, 5, 8]
const EXITS: { key: string; ex: Exit }[] = [{ key: 'S1 stop 3,3 ATR + divergence opposée', ex: { stop: 3.3, tpR: 0, trail: false } }, { key: 'S2 idem + objectif 2 R', ex: { stop: 3.3, tpR: 2, trail: false } }]

/** Signaux de divergence : −1 baissière (short), +1 haussière (long), à la bougie de confirmation du pivot. */
function divergences(b: Bars, wave: Float64Array, L: number): Int8Array {
  const n = b.n, out = new Int8Array(n)
  const W = (p: number, f: (a: number, x: number) => number, init: number) => { let x = init; for (let k = p - L; k <= p + L; k++) x = f(x, wave[k]); return x }
  let lastH = -1, lastHW = NaN, lastL = -1, lastLW = NaN
  for (let i = 2 * L; i < n; i++) {
    const p = i - L
    let isH = true, isL = true
    for (let k = p - L; k <= p + L; k++) { if (k === p) continue; if (b.h[k] >= b.h[p]) isH = false; if (b.l[k] <= b.l[p]) isL = false }
    let s = 0
    if (isH) {
      const wp = W(p, Math.max, -Infinity)
      if (lastH >= 0 && p - lastH >= 5 && p - lastH <= 60 && b.h[p] > b.h[lastH] && wp < lastHW && lastHW > 0) s -= 1
      lastH = p; lastHW = wp
    }
    if (isL) {
      const wp = W(p, Math.min, Infinity)
      if (lastL >= 0 && p - lastL >= 5 && p - lastL <= 60 && b.l[p] < b.l[lastL] && wp > lastLW && lastLW < 0) s += 1
      lastL = p; lastLW = wp
    }
    out[i] = s > 0 ? 1 : s < 0 ? -1 : 0
  }
  return out
}

const ev = [] as { tf: number; L: number; seg: string; fam: ReturnType<typeof familyStats>; rnd: ReturnType<typeof randomEvents>; nLong: number; nShort: number }[]
const strat = [] as { tf: number; L: number; exit: string; tr: Res; va: Res; va2: Res }[]
for (const tf of TFS) {
  const bars = tf === 240 ? resample(loadBtc(60), 4 * 3600000) : loadBtc(tf)
  const M = ouMarket(tf, { bars })
  const { wave } = regimeWave(bars)
  const nyMin = newYorkClock(bars.t).min
  for (const L of LS) {
    const sig = divergences(bars, wave, L)
    for (const [seg, lo, end] of [['train', M.iTr, M.iVa - 1], ['valid', M.iVa, M.iEnd]] as const) {
      const ctx: Ctx = { t: bars.t, c: bars.c, atr: M.atr30, nyMin, lo, end, tfMs: tf * 60000 }
      const base = baseline(ctx)
      const e: Ev[] = []
      for (let i = lo; i <= end; i++) if (sig[i]) e.push({ i, dir: sig[i] as 1 | -1 })
      ev.push({ tf, L, seg, fam: familyStats(ctx, base, `${tf}-${L}-${seg}`, '', e, 20261020, 2000), rnd: randomEvents(ctx, base, e, () => 0, i => M.atr30[i] > 0, 1000, 20261021), nLong: e.filter(x => x.dir === 1).length, nShort: e.filter(x => x.dir === -1).length })
    }
    for (const X of EXITS) strat.push({ tf, L, exit: X.key, tr: M.train(sig, X.ex), va: M.valid(sig, X.ex), va2: M.valid(sig, X.ex, 2 * M.FEE) })
  }
}

// ---------------------------------------------------------------- lecture fixée
const hz = (f: ReturnType<typeof familyStats>, h: number) => f.byH.find(x => x.h === h)!
const rp = (r: ReturnType<typeof randomEvents>, h: number) => r.find(x => x.h === h)!.p
const predictive = (tf: number, L: number) => {
  const t = ev.find(x => x.tf === tf && x.L === L && x.seg === 'train')!, v = ev.find(x => x.tf === tf && x.L === L && x.seg === 'valid')!
  const okT = [4, 16].every(h => hz(t.fam, h).meanExcess > 0 && hz(t.fam, h).ci90[0] > 0) && rp(t.rnd, 16) < 0.05
  return okT && hz(v.fam, 16).meanExcess > 0 && rp(v.rnd, 16) < 0.1
}
const nPred = TFS.flatMap(tf => LS.map(L => predictive(tf, L))).filter(Boolean).length
const best = strat.filter(x => x.tr.trades >= 30).sort((a, b) => b.tr.sharpe - a.tr.sharpe)[0]
const bestOK = !!best && best.va.sharpe > 0.3 && best.va.pf > 1.1 && best.va2.sharpe > 0
const verdict = nPred >= 1 && bestOK ? 'edge robuste' : nPred >= 1 || bestOK ? 'prometteur mais fragile' : 'aucun edge démontré'
const sdTrials = (() => { const s = strat.map(x => { const r = x.tr.r, m = r.reduce((a, y) => a + y, 0) / r.length, sd = Math.sqrt(r.reduce((a, y) => a + (y - m) ** 2, 0) / r.length); return sd > 0 ? m / sd : 0 }); const m = s.reduce((a, y) => a + y, 0) / s.length; return Math.sqrt(s.reduce((a, y) => a + (y - m) ** 2, 0) / (s.length - 1)) })()

// ---------------------------------------------------------------- rapport
const pc = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '—').replace('.', ',').replace('-', '−')
const nm = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '—').replace('.', ',').replace('-', '−')
const tfn = (tf: number) => (tf >= 60 ? `${tf / 60} h` : `${tf} min`)
const Lr: string[] = ['# Divergences prix / Regime Wave (MRE v1.5 VWAP) · BTC/USD', '']
Lr.push('Pré-spécification : `research/preregistration/mre-divergence.md`. Bitstamp ; entraînement 2017-01-01 → 2022-12-31, validation 2023-01-01 → 2026-09-30 ; commission 0,045 % par ordre ; 18 essais. Produit par `node research/mre/mre-divergence.ts`.', '')
Lr.push('## Étude d\'événement (rendement dans le sens du signal, en ATR(30), excès sur la même heure)', '', '| TF | L | Période | Signaux (long / short) | Excès 4 b. (IC 90 %) | Excès 16 b. (IC 90 %) | Excès 64 b. | p hasard 16 b. | Prédictive |', '|---|---|---|---|---|---|---|---|---|')
for (const x of ev) Lr.push(`| ${tfn(x.tf)} | ${x.L} | ${x.seg === 'train' ? 'entraînement' : 'validation'} | ${x.fam.n} (${x.nLong} / ${x.nShort}) | ${nm(hz(x.fam, 4).meanExcess, 3)} (${nm(hz(x.fam, 4).ci90[0], 3)} à ${nm(hz(x.fam, 4).ci90[1], 3)}) | ${nm(hz(x.fam, 16).meanExcess, 3)} (${nm(hz(x.fam, 16).ci90[0], 3)} à ${nm(hz(x.fam, 16).ci90[1], 3)}) | ${nm(hz(x.fam, 64).meanExcess, 3)} | ${nm(rp(x.rnd, 16), 3)} | ${x.seg === 'valid' ? (predictive(x.tf, x.L) ? 'oui' : 'non') : ''} |`)
Lr.push('', '## Stratégie', '', '| TF | L | Sortie | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe | OOS PF | OOS Sharpe frais ×2 |', '|---|---|---|---|---|---|---|---|---|---|---|---|')
for (const x of strat) Lr.push(`| ${tfn(x.tf)} | ${x.L} | ${x.exit} | ${pc(x.tr.cagr)} | ${nm(x.tr.sharpe)} | ${pc(x.tr.mdd)} | ${nm(x.tr.pf)} | ${x.tr.trades} | ${pc(x.tr.win)} | ${nm(x.va.sharpe)} | ${nm(x.va.pf)} | ${nm(x.va2.sharpe)} |`)
Lr.push('', `Configurations prédictives : ${nPred}/9. Meilleure stratégie à l'entraînement : ${best ? `${tfn(best.tf)}, L ${best.L}, ${best.exit} (Sharpe ${nm(best.tr.sharpe)} → validation ${nm(best.va.sharpe)}, PF ${nm(best.va.pf)}, frais ×2 ${nm(best.va2.sharpe)} ; Sharpe dégonflé d'entraînement ${nm(dsr(best.tr.r, 18, sdTrials).p, 3)} avec 18 essais)` : 'aucune avec 30 trades'}. **Verdict : ${verdict}.**`)
mkdirSync('research/reports/mre', { recursive: true })
writeFileSync('research/reports/mre/mre-divergence.md', Lr.join('\n') + '\n')
console.log(Lr.slice(4).join('\n'))
