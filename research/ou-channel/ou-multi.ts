// OU Trend Channel : Top 1 H1 gelé (choisi sur BTC) appliqué à ETH et SOL, avec et sans le filtre HTF de
// l'indicateur, et portefeuille équipondéré (research/preregistration/ou-multi.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/ou-channel/ou-multi.ts

import { mkdirSync, writeFileSync } from 'node:fs'
import { ouMarket } from './lib.ts'
import type { Entry, Exit, Res } from './lib.ts'
import { loadBtc } from '../lib/data.ts'
import { loadCsv } from '../futures-transfer/lib/proxy-data.ts'
import { resample } from '../../lib/backtest/data.ts'
import { ema } from '../../lib/backtest/indicators.ts'
import type { Bars } from '../../lib/backtest/types.ts'

const H = 3600000, DAY = 864e5
const TOP1: Entry = { zMin: 2.2, reentry: 1, wickThr: 0.7, volMin: NaN, volDiv: false }
const EXIT: Exit = { stop: 4.5, tpR: 0, trail: false }
const ASSETS: { key: string; label: string; bars: () => Bars }[] = [
  { key: 'BTC', label: 'BTC/USD Bitstamp (référence, déjà vu)', bars: () => loadBtc(60) },
  { key: 'ETH', label: 'ETH/USDT Binance', bars: () => resample(loadCsv('research/data/ethusdt_15m.csv.gz'), H) },
  { key: 'SOL', label: 'SOL/USDT Binance', bars: () => resample(loadCsv('research/data/solusdt_15m.csv.gz'), H) },
]

/** Filtre HTF de l'indicateur : clôture 4 h contre EMA 21, dernière bougie de 4 h close à la clôture de la bougie 1 h. */
function htfGate(b: Bars) {
  const b4 = resample(b, 4 * H), e = ema(b4.c, 21)
  const long = new Uint8Array(b.n), short = new Uint8Array(b.n)
  let k = -1
  for (let i = 0; i < b.n; i++) {
    while (k + 1 < b4.n && b4.t[k + 1] + 4 * H <= b.t[i] + H) k++
    if (k < 0 || !Number.isFinite(e[k])) continue
    long[i] = b4.c[k] > e[k] ? 1 : 0
    short[i] = b4.c[k] < e[k] ? 1 : 0
  }
  return { long, short }
}

const metrics = (r: number[]) => {
  let eq = 1, pk = 1, mdd = 0
  for (const x of r) { eq *= 1 + x; pk = Math.max(pk, eq); mdd = Math.min(mdd, eq / pk - 1) }
  const m = r.reduce((s, x) => s + x, 0) / r.length, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / r.length)
  return { cagr: Math.pow(eq, 365.25 / r.length) - 1, sharpe: sd > 0 ? (m / sd) * Math.sqrt(365.25) : 0, mdd }
}

interface Run { asset: string; variant: number; seg: string; res: Res }
const runs: Run[] = []
for (const A of ASSETS) {
  const bars = A.bars()
  const start = A.key === 'BTC' ? undefined : bars.t[0] + 60 * DAY
  const M = ouMarket(60, { bars, start })
  const sig = M.signals(TOP1), gate = htfGate(bars)
  for (const variant of [0, 1]) {
    const g = variant ? gate : undefined
    runs.push({ asset: A.key, variant, seg: 'full', res: M.simulate(sig, EXIT, M.iTr, M.iEnd, M.FEE, g) })
    runs.push({ asset: A.key, variant, seg: 'train', res: M.simulate(sig, EXIT, M.iTr, M.iVa - 1, M.FEE, g) })
    runs.push({ asset: A.key, variant, seg: 'valid', res: M.simulate(sig, EXIT, M.iVa, M.iEnd, M.FEE, g) })
  }
}
const get = (a: string, v: number, s: string) => runs.find(x => x.asset === a && x.variant === v && x.seg === s)!.res
/** Portefeuille équipondéré : moyenne des rendements journaliers des trois actifs sur les jours communs. */
function portfolio(v: number, seg: string) {
  const maps = ASSETS.map(A => { const r = get(A.key, v, seg); return new Map(r.days.map((d, k) => [d, r.r[k]])) })
  const days = [...maps[0].keys()].filter(d => maps.every(m => m.has(d))).sort((a, b) => a - b)
  const r = days.map(d => maps.reduce((s, m) => s + m.get(d)!, 0) / maps.length)
  // Trades par an : somme des rythmes de chaque actif sur son propre segment.
  const tradesPerYear = ASSETS.reduce((s, A) => { const x = get(A.key, v, seg); return s + x.trades / (x.r.length / 365.25) }, 0)
  return { ...metrics(r), days: days.length, from: new Date(days[0] * DAY).toISOString().slice(0, 10), tradesPerYear }
}

// ---------------------------------------------------------------- lecture fixée
const transfers = (a: string, v: number) => { const f = get(a, v, 'full'), va = get(a, v, 'valid'); return f.sharpe > 0.3 && f.pf > 1.1 && va.sharpe > 0 }
const P = [0, 1].map(v => ({ v, full: portfolio(v, 'full'), valid: portfolio(v, 'valid') }))
const htfBetter = ASSETS.filter(A => get(A.key, 1, 'valid').sharpe > get(A.key, 0, 'valid').sharpe).length
const htfKept = htfBetter >= 2 && P[1].valid.sharpe > P[0].valid.sharpe
const V = htfKept ? 1 : 0
const nTransfer = ['ETH', 'SOL'].filter(a => transfers(a, V)).length
const verdict = nTransfer === 2 && P[V].valid.sharpe > 0.5 ? 'edge robuste' : nTransfer >= 1 || (P[V].valid.sharpe > 0 && P[V].valid.sharpe <= 0.5) ? 'prometteur mais fragile' : 'aucun edge démontré'

// ---------------------------------------------------------------- rapport
const pc = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)} %` : '—').replace('.', ',').replace('-', '−')
const nm = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—').replace('.', ',').replace('-', '−')
const L: string[] = ['# OU Trend Channel · Top 1 H1 gelé sur BTC, ETH et SOL', '']
L.push('Pré-spécification : `research/preregistration/ou-multi.md`. Top 1 H1 (z 2,2 · réintégration 1 · mèche 0,7 · sans filtre volume · stop 4,5 ATR) choisi sur BTC 2017 – 2022, aucun réglage réestimé ; commission 0,045 % par ordre ; validation 2023-01-01 → 2026-09-30. Variante HTF : longs si clôture 4 h > EMA 21 (4 h), shorts si en dessous. Produit par `node research/ou-channel/ou-multi.ts`.', '')
L.push('| Actif | Variante | Période | CAGR | Sharpe | MDD | PF | Trades (par an) | Win rate | Sharpe validation | Transfert |', '|---|---|---|---|---|---|---|---|---|---|---|')
for (const A of ASSETS) for (const v of [0, 1]) {
  const f = get(A.key, v, 'full'), va = get(A.key, v, 'valid'), first = new Date(f.days[0] * DAY).toISOString().slice(0, 10)
  L.push(`| ${A.label} | ${v ? 'filtre HTF' : 'tel quel'} | ${first} → 2026-09-30 | ${pc(f.cagr)} | ${nm(f.sharpe)} | ${pc(f.mdd)} | ${nm(f.pf)} | ${f.trades} (${(f.trades / (f.r.length / 365.25)).toFixed(0)}) | ${pc(f.win)} | ${nm(va.sharpe)} | ${A.key === 'BTC' ? '—' : transfers(A.key, v) ? 'oui' : 'non'} |`)
}
L.push('', '| Portefeuille équipondéré | Période | CAGR | Sharpe | MDD | Trades par an (3 actifs) | Sharpe validation | CAGR validation | MDD validation |', '|---|---|---|---|---|---|---|---|---|')
for (const p of P) L.push(`| ${p.v ? 'filtre HTF' : 'tel quel'} | ${p.full.from} → 2026-09-30 | ${pc(p.full.cagr)} | ${nm(p.full.sharpe)} | ${pc(p.full.mdd)} | ${p.full.tradesPerYear.toFixed(0)} | ${nm(p.valid.sharpe)} | ${pc(p.valid.cagr)} | ${pc(p.valid.mdd)} |`)
L.push('', `Filtre HTF : Sharpe de validation amélioré sur ${htfBetter}/3 actifs ; ${htfKept ? 'retenu' : 'rejeté'}. ETH et SOL qui transfèrent (variante ${V ? 'HTF' : 'telle quelle'}) : ${nTransfer}/2. **Verdict : ${verdict}.** Essais : 6 (842 avec la recherche OU précédente).`)
mkdirSync('research/reports/ou-channel', { recursive: true })
writeFileSync('research/reports/ou-channel/ou-multi.md', L.join('\n') + '\n')
console.log(L.slice(4).join('\n'))
