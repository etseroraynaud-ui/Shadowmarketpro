// Attribution exacte de la baisse du Sharpe du portefeuille BTC/ETH entre les deux moitiés de la
// période commune (2018-09-01 → 2022-09-15, puis 2022-09-16 → 2026-09-30). Diagnostic seulement :
// aucun paramètre, aucun poids, aucun coût n'est modifié ; les sleeves sont celles des backtests
// validés (research/lib/frozen-shock.ts), et les Sharpe des moitiés doivent redonner exactement
// ceux du rapport du portefeuille.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/sharpe-attribution.ts
//
// 1. Identité comptable : Sharpe du portefeuille 50/50 rééquilibré chaque jour, reconstruit sans
//    reste à partir de la fréquence des trades, du mix calme/agité, du taux de gain, de la taille
//    des gagnants et des perdants en ATR (brute de frais), de l'environnement de volatilité (ATR %
//    à l'entrée, volatilité des sleeves), des frais, de la corrélation BTC/ETH et d'un résidu de
//    conversion trades → jours. La différence avec le portefeuille officiel (sans rééquilibrage)
//    est la « dérive des poids », mesurée à part. Somme exacte = baisse du Sharpe publiée.
// 2. Valeurs de Shapley : l'effet de chaque groupe est sa contribution moyenne sur tous les ordres
//    de remplacement des paramètres de la 1re moitié par ceux de la 2e (interactions réparties).
// 3. Étude d'événement par moitié : E[mouvement | signal] et E[mouvement | choc dans la tendance
//    60 min], en ATR, en excès du mouvement moyen à la même heure de la même année, intervalles
//    par bootstrap des mois. Distingue « le signal ne prédit plus rien » de « les tendances qui
//    suivent sont plus courtes ».

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadSleeve, runDetailed } from '../lib/frozen-shock.ts'
import type { Detailed, Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import * as P from '../lib/portfolio.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/btc-eth-portfolio')
const DAY = P.DAY, M15 = 15 * 60000, ANN = P.ANN
const SEED = 20261009
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)

// ================================================================ sleeves et jours (comme portfolio.ts)
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const NAME: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
const S: Record<SleeveKey, Sleeve> = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') }
const R: Record<SleeveKey, Detailed> = { btc: runDetailed(S.btc, 1), ethusdt: runDetailed(S.ethusdt, 1) }
const tStart = Math.max(...KEYS.map(k => S[k].bars.t[S[k].lo]))
const tEnd = Math.min(...KEYS.map(k => S[k].bars.t[S[k].end] + M15))
const D0 = Math.ceil(tStart / DAY), D1 = Math.floor(tEnd / DAY) - 1
const days: number[] = []
for (let d = D0; d <= D1; d++) days.push(d)
const ND = days.length
const idxAt = (s: Sleeve, ms: number) => { const t = s.bars.t; let lo = 0, hi = s.bars.n; while (lo < hi) { const m = (lo + hi) >> 1; if (t[m] < ms) lo = m + 1; else hi = m } return lo }
const daily = (k: SleeveKey) => {
  const s = S[k], a = idxAt(s, D0 * DAY), b = idxAt(s, (D1 + 1) * DAY) - 1
  const base = R[k].equity[a - 1]
  return P.returnsOf(P.dayCloses(s.bars.t, R[k].equity, a, b, days, base).eq, base)
}
const RET: Record<SleeveKey, number[]> = { btc: daily('btc'), ethusdt: daily('ethusdt') }
const half = Math.floor(ND / 2)
const HALVES = [{ key: 'H1', from: 0, to: half }, { key: 'H2', from: half, to: ND }].map(h => ({ ...h, start: P.isoDay(days[h.from]), end: P.isoDay(days[h.to - 1]), days: h.to - h.from }))
const sharpe = (r: number[]) => { const s = P.sd(r); return s > 0 ? (P.mean(r) / s) * Math.sqrt(ANN) : NaN }

// Contrôle : les Sharpe des moitiés du portefeuille officiel (A, 50/50 au début de chaque moitié,
// sans rééquilibrage) sont exactement ceux publiés dans le résumé du portefeuille.
const summary = JSON.parse(readFileSync(join(OUT, 'portfolio_summary.json'), 'utf8'))
const published = [summary.stability.subPeriods.firstHalf.portfolio.sharpe, summary.stability.subPeriods.secondHalf.portfolio.sharpe]
const SA = HALVES.map(h => sharpe(P.book(RET.btc.slice(h.from, h.to), RET.ethusdt.slice(h.from, h.to)).r))
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
SA.forEach((s, i) => check(`Sharpe ${HALVES[i].key} = rapport publié`, Math.abs(s - published[i]) < 1e-8, `${s.toFixed(10)} vs ${published[i]}`))
log('sleeves et moitiés')

// ================================================================ trades par moitié
// Volatilité journalière du sous-jacent connue à l'entrée : écart type des 30 rendements journaliers
// (clôtures UTC) qui précèdent le jour de l'entrée. Échelle des mouvements de plusieurs heures.
const VOL_DAYS = 30
const dailyVol = (k: SleeveKey) => {
  const { t, c } = S[k].bars
  const close = new Map<number, number>()
  for (let i = 0; i < S[k].bars.n; i++) close.set(Math.floor(t[i] / DAY), c[i])
  const ds = [...close.keys()].sort((a, b) => a - b)
  const out = new Map<number, number>()
  const lr: number[] = []
  for (let j = 1; j < ds.length; j++) {
    if (lr.length >= VOL_DAYS) out.set(ds[j], P.sd(lr.slice(-VOL_DAYS)))
    lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0)
  }
  return out
}
const DVOL: Record<SleeveKey, Map<number, number>> = { btc: dailyVol('btc'), ethusdt: dailyVol('ethusdt') }
interface Tr { s: SleeveKey; dir: 1 | -1; set: number; year: number; r: number; g: number; phi: number; atrPct: number; R: number; Rg: number; sigD: number; Rd: number; Rgd: number; mfe: number; mae: number; holdH: number }
const tradesOf = (k: SleeveKey, h: typeof HALVES[number]) => {
  const t = S[k].bars.t, lo = days[h.from] * DAY, hi = (days[h.to - 1] + 1) * DAY
  return R[k].positions.filter(p => t[p.entryIdx] >= lo && t[p.entryIdx] < hi).map((p): Tr => {
    const r = p.pnl / p.equityAtEntry, phi = p.fees / p.equityAtEntry, atrPct = p.atrAtEntry / p.entryPrice
    const sigD = DVOL[k].get(Math.floor(t[p.entryIdx] / DAY)) ?? NaN
    return { s: k, dir: p.dir, set: p.set, year: new Date(t[p.entryIdx]).getUTCFullYear(), r, g: r + phi, phi, atrPct, R: r / atrPct, Rg: (r + phi) / atrPct, sigD, Rd: r / sigD, Rgd: (r + phi) / sigD, mfe: p.mfeAtr, mae: p.maeAtr, holdH: (t[p.exitIdx] - t[p.entryIdx]) / 3600000 }
  })
}
const TR = HALVES.map(h => ({ btc: tradesOf('btc', h), ethusdt: tradesOf('ethusdt', h) }))
for (const k of KEYS) TR.forEach((tr, i) => check(`${NAME[k]} ${HALVES[i].key} : ATR et volatilité journalière à l'entrée définis pour chaque trade`, tr[k].every(x => x.atrPct > 0 && Number.isFinite(x.R) && x.sigD > 0 && Number.isFinite(x.Rd)), `${tr[k].length} trades`))

// ================================================================ 1. identité comptable
interface Cell { n: number; p: number; aW: number; Wg: number; phiW: number; aL: number; Lg: number; phiL: number }
interface Sl { f: number; pi: [number, number]; cells: [Cell, Cell]; sigma: number; c: number; mu: number }
interface Model { btc: Sl; ethusdt: Sl; rho: number }
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
/**
 * Une cellule (sleeve × régime) : moyenne nette = p (aW·Wg − φW) + (1 − p)(aL·Lg − φL), exactement.
 * Wg, Lg : gain et perte bruts moyens en unités de volatilité (`norm` : ATR 15 min à l'entrée ou
 * volatilité journalière du sous-jacent) ; a : conversion de ces unités en % (pondérée).
 */
type Norm = 'daily' | 'atr'
let NORM: Norm = 'daily'
const unit = (x: Tr) => (NORM === 'daily' ? x.Rgd : x.Rg)
function cell(ts: Tr[]): Cell {
  const w = ts.filter(x => x.r > 0), l = ts.filter(x => x.r <= 0)
  const part = (xs: Tr[]) => (xs.length ? { a: sum(xs.map(x => x.g)) / sum(xs.map(unit)), R: P.mean(xs.map(unit)), phi: P.mean(xs.map(x => x.phi)) } : { a: 0, R: 0, phi: 0 })
  const W = part(w), L = part(l)
  return { n: ts.length, p: ts.length ? w.length / ts.length : 0, aW: W.a, Wg: W.R, phiW: W.phi, aL: L.a, Lg: L.R, phiL: L.phi }
}
const cellMean = (c: Cell) => c.p * (c.aW * c.Wg - c.phiW) + (1 - c.p) * (c.aL * c.Lg - c.phiL)
function sleeveModel(k: SleeveKey, hi: number): Sl {
  const h = HALVES[hi], ts = TR[hi][k], r = RET[k].slice(h.from, h.to)
  const cells: [Cell, Cell] = [cell(ts.filter(x => x.set === 0)), cell(ts.filter(x => x.set === 1))]
  const f = ts.length / h.days
  const pi: [number, number] = [cells[0].n / ts.length, cells[1].n / ts.length]
  const mu = P.mean(r)
  const fromTrades = f * (pi[0] * cellMean(cells[0]) + pi[1] * cellMean(cells[1]))
  return { f, pi, cells, sigma: P.sd(r), c: mu - fromTrades, mu }
}
const buildModels = (norm: Norm): Model[] => { NORM = norm; return HALVES.map((h, i) => ({ btc: sleeveModel('btc', i), ethusdt: sleeveModel('ethusdt', i), rho: P.pearson(RET.btc.slice(h.from, h.to), RET.ethusdt.slice(h.from, h.to)) })) }
const MODELS_ATR = buildModels('atr')
const MODELS: Model[] = buildModels('daily')
// Vérification de l'identité de cellule (moyenne nette des trades).
for (const k of KEYS) MODELS.forEach((m, i) => m[k].cells.forEach((c, j) => {
  const ts = TR[i][k].filter(x => x.set === j)
  check(`Identité de cellule ${NAME[k]} ${HALVES[i].key} ${j ? 'agité' : 'calme'}`, Math.abs(cellMean(c) - P.mean(ts.map(x => x.r))) < 1e-12, `${ts.length} trades`)
}))

const muOf = (s: Sl) => s.f * (s.pi[0] * cellMean(s.cells[0]) + s.pi[1] * cellMean(s.cells[1])) + s.c
const sharpePortfolio = (m: Model) => {
  const mb = muOf(m.btc), me = muOf(m.ethusdt), sb = m.btc.sigma, se = m.ethusdt.sigma
  return ((0.5 * mb + 0.5 * me) / Math.sqrt(0.25 * sb * sb + 0.25 * se * se + 0.5 * m.rho * sb * se)) * Math.sqrt(ANN)
}
const sharpeSleeve = (s: Sl) => (muOf(s) / s.sigma) * Math.sqrt(ANN)
// Le modèle redonne exactement le Sharpe du portefeuille 50/50 rééquilibré chaque jour et celui de chaque sleeve.
const SR = HALVES.map(h => sharpe(RET.btc.slice(h.from, h.to).map((x, i) => 0.5 * x + 0.5 * RET.ethusdt[h.from + i])))
MODELS.forEach((m, i) => {
  check(`Identité exacte, portefeuille 50/50 rééquilibré ${HALVES[i].key}`, Math.abs(sharpePortfolio(m) - SR[i]) < 1e-10, `${sharpePortfolio(m).toFixed(10)} vs ${SR[i].toFixed(10)}`)
  for (const k of KEYS) check(`Identité exacte, ${NAME[k]} ${HALVES[i].key}`, Math.abs(sharpeSleeve(m[k]) - sharpe(RET[k].slice(HALVES[i].from, HALVES[i].to))) < 1e-10, '')
})

// Groupes de facteurs : chaque groupe remplace ses paramètres de la 1re moitié par ceux de la 2e.
type G = 'freq' | 'regime' | 'winRate' | 'winSize' | 'lossSize' | 'volEnv' | 'fees' | 'corr' | 'conv'
const GROUPS: { key: G; label: string; detail: string }[] = [
  { key: 'freq', label: 'Fréquence', detail: 'trades par jour de chaque sleeve' },
  { key: 'regime', label: 'Mix de régimes', detail: 'part des trades ouverts en régime agité' },
  { key: 'winRate', label: 'Taux de gain', detail: 'part des trades gagnants, par sleeve et régime' },
  { key: 'winSize', label: 'Taille des gagnants', detail: 'gain brut moyen des gagnants, en volatilité journalière du sous-jacent à l\'entrée' },
  { key: 'lossSize', label: 'Taille des perdants', detail: 'perte brute moyenne des perdants, en volatilité journalière à l\'entrée' },
  { key: 'volEnv', label: 'Environnement de volatilité', detail: 'niveau de volatilité à l\'entrée (conversion en %) et volatilité journalière des sleeves' },
  { key: 'fees', label: 'Frais par trade', detail: 'commission en % du capital de la sleeve, gagnants et perdants' },
  { key: 'corr', label: 'Corrélation BTC/ETH', detail: 'corrélation des rendements journaliers des sleeves' },
  { key: 'conv', label: 'Conversion trades → jours', detail: 'écart entre la moyenne journalière et la somme des trades par jour (positions à cheval, composition)' },
]
const mix = (on: Set<G>, A: Model, B: Model, sleeves = KEYS): Model => {
  const pick = (g: G) => (on.has(g) ? B : A)
  const sl = (k: SleeveKey): Sl => ({
    f: pick('freq')[k].f,
    pi: pick('regime')[k].pi,
    cells: [0, 1].map(j => ({
      n: 0,
      p: pick('winRate')[k].cells[j].p,
      Wg: pick('winSize')[k].cells[j].Wg,
      Lg: pick('lossSize')[k].cells[j].Lg,
      aW: pick('volEnv')[k].cells[j].aW, aL: pick('volEnv')[k].cells[j].aL,
      phiW: pick('fees')[k].cells[j].phiW, phiL: pick('fees')[k].cells[j].phiL,
    })) as [Cell, Cell],
    sigma: pick('volEnv')[k].sigma,
    c: pick('conv')[k].c,
    mu: NaN,
  })
  return { btc: sleeves.includes('btc') ? sl('btc') : A.btc, ethusdt: sleeves.includes('ethusdt') ? sl('ethusdt') : A.ethusdt, rho: pick('corr').rho }
}
function shapley(groups: G[], value: (on: Set<G>) => number) {
  const n = groups.length, fact = (k: number) => { let x = 1; for (let i = 2; i <= k; i++) x *= i; return x }
  const out = new Map<G, number>(groups.map(g => [g, 0]))
  for (let mask = 0; mask < 1 << n; mask++) {
    const on = new Set(groups.filter((_, i) => mask & (1 << i)))
    const v = value(on), size = on.size
    groups.forEach((g, i) => {
      if (mask & (1 << i)) return
      const w = (fact(size) * fact(n - size - 1)) / fact(n)
      const withG = new Set(on); withG.add(g)
      out.set(g, out.get(g)! + w * (value(withG) - v))
    })
  }
  return out
}
const [M1, M2] = MODELS
const allG = GROUPS.map(g => g.key)
const shPortfolio = shapley(allG, on => sharpePortfolio(mix(on, M1, M2)))
const shPortfolioAtr = shapley(allG, on => sharpePortfolio(mix(on, MODELS_ATR[0], MODELS_ATR[1])))
check('Variante ATR : même total', Math.abs([...shPortfolioAtr.values()].reduce((a, b) => a + b, 0) - [...shPortfolio.values()].reduce((a, b) => a + b, 0)) < 1e-10, '')

// Attribution par sens : μ_s = f_long · m_long + f_short · m_short + c_s, exactement.
type GS = 'longFreq' | 'longEdge' | 'shortFreq' | 'shortEdge' | 'risk' | 'corr' | 'conv'
interface SideSl { fL: number; mL: number; fS: number; mS: number; sigma: number; c: number }
const sideModels = HALVES.map((h, i) => {
  const one = (k: SleeveKey): SideSl => {
    const ts = TR[i][k], L = ts.filter(x => x.dir === 1), Sh = ts.filter(x => x.dir === -1), r = RET[k].slice(h.from, h.to)
    const fL = L.length / h.days, fS = Sh.length / h.days, mL = L.length ? P.mean(L.map(x => x.r)) : 0, mS = Sh.length ? P.mean(Sh.map(x => x.r)) : 0
    return { fL, mL, fS, mS, sigma: P.sd(r), c: P.mean(r) - fL * mL - fS * mS }
  }
  return { btc: one('btc'), ethusdt: one('ethusdt'), rho: MODELS[i].rho }
})
const sharpeSide = (m: typeof sideModels[number]) => {
  const mu = (s: SideSl) => s.fL * s.mL + s.fS * s.mS + s.c
  const sb = m.btc.sigma, se = m.ethusdt.sigma
  return ((0.5 * mu(m.btc) + 0.5 * mu(m.ethusdt)) / Math.sqrt(0.25 * sb * sb + 0.25 * se * se + 0.5 * m.rho * sb * se)) * Math.sqrt(ANN)
}
sideModels.forEach((m, i) => check(`Identité par sens ${HALVES[i].key}`, Math.abs(sharpeSide(m) - SR[i]) < 1e-10, ''))
const SIDE_GROUPS: { key: GS; label: string }[] = [
  { key: 'longFreq', label: 'Longs : fréquence' }, { key: 'longEdge', label: 'Longs : gain moyen par trade' },
  { key: 'shortFreq', label: 'Shorts : fréquence' }, { key: 'shortEdge', label: 'Shorts : gain moyen par trade' },
  { key: 'risk', label: 'Volatilité des sleeves' }, { key: 'corr', label: 'Corrélation BTC/ETH' }, { key: 'conv', label: 'Conversion trades → jours' },
]
const shSide = shapley(SIDE_GROUPS.map(g => g.key) as unknown as G[], on => {
  const pick = (g: string) => (on.has(g as G) ? sideModels[1] : sideModels[0])
  const sl = (k: SleeveKey): SideSl => ({ fL: pick('longFreq')[k].fL, mL: pick('longEdge')[k].mL, fS: pick('shortFreq')[k].fS, mS: pick('shortEdge')[k].mS, sigma: pick('risk')[k].sigma, c: pick('conv')[k].c })
  return sharpeSide({ btc: sl('btc'), ethusdt: sl('ethusdt'), rho: pick('corr').rho })
}) as unknown as Map<GS, number>
const sleeveG = allG.filter(g => g !== 'corr')
const shSleeve = Object.fromEntries(KEYS.map(k => [k, shapley(sleeveG, on => sharpeSleeve(mix(on, M1, M2, [k])[k]))])) as Record<SleeveKey, Map<G, number>>
const drift = (SA[1] - SR[1]) - (SA[0] - SR[0])
const totalModel = [...shPortfolio.values()].reduce((a, b) => a + b, 0)
check('Somme des effets + dérive = baisse publiée du Sharpe', Math.abs(totalModel + drift - (SA[1] - SA[0])) < 1e-10, `${(totalModel + drift).toFixed(10)} vs ${(SA[1] - SA[0]).toFixed(10)}`)
log('attribution')

// ================================================================ 2. tableau comparatif
const yrs = (hi: number) => HALVES[hi].days / ANN
function describe(ts: Tr[], hi: number, r: number[]) {
  const w = ts.filter(x => x.r > 0), l = ts.filter(x => x.r <= 0)
  const lr = ts.map(x => Math.log(1 + x.r))
  const t5 = P.topShare(lr, 0.05)
  const top = [...ts].sort((a, b) => b.r - a.r).slice(0, t5.k)
  const y = yrs(hi)
  const by = (f: (x: Tr) => boolean) => sum(ts.filter(f).map(x => x.r)) / y
  return {
    trades: ts.length, perYear: ts.length / y, winRate: w.length / ts.length,
    avgWin: P.mean(w.map(x => x.r)), avgLoss: P.mean(l.map(x => x.r)), payoff: P.mean(w.map(x => x.r)) / -P.mean(l.map(x => x.r)),
    avgWinR: P.mean(w.map(x => x.R)), avgLossR: P.mean(l.map(x => x.R)), payoffR: P.mean(w.map(x => x.R)) / -P.mean(l.map(x => x.R)),
    top5Share: t5.share, top5AvgWin: P.mean(top.map(x => x.r)), top5AvgR: P.mean(top.map(x => x.R)), top5AvgD: P.mean(top.map(x => x.Rd)),
    avgWinD: P.mean(w.map(x => x.Rd)), avgLossD: P.mean(l.map(x => x.Rd)), sigD: P.mean(ts.map(x => x.sigD)), atrOverSigD: P.mean(ts.map(x => x.atrPct / x.sigD)),
    mfeWin: P.mean(w.map(x => x.mfe)), mfeAll: P.mean(ts.map(x => x.mfe)), mae: P.mean(ts.map(x => x.mae)), maeLoss: P.mean(l.map(x => x.mae)),
    holdWinH: P.quantile(w.map(x => x.holdH), 0.5), holdLossH: P.quantile(l.map(x => x.holdH), 0.5),
    atrPct: P.mean(ts.map(x => x.atrPct)),
    longContrib: by(x => x.dir === 1), shortContrib: by(x => x.dir === -1), calmContrib: by(x => x.set === 0), agitContrib: by(x => x.set === 1),
    nLong: ts.filter(x => x.dir === 1).length, nShort: ts.filter(x => x.dir === -1).length, nCalm: ts.filter(x => x.set === 0).length, nAgit: ts.filter(x => x.set === 1).length,
    feesPerYear: sum(ts.map(x => x.phi)) / y, grossPerYear: sum(ts.map(x => x.g)) / y, feesOverGross: sum(ts.map(x => x.phi)) / sum(ts.map(x => x.g)),
    sharpe: sharpe(r), vol: P.sd(r) * Math.sqrt(ANN), meanDaily: P.mean(r),
  }
}
const DESC = HALVES.map((h, i) => ({
  btc: describe(TR[i].btc, i, RET.btc.slice(h.from, h.to)),
  eth: describe(TR[i].ethusdt, i, RET.ethusdt.slice(h.from, h.to)),
}))
// Portefeuille : trades des deux sleeves à demi-poids (modèle 50/50).
const portfolioDesc = HALVES.map((h, i) => {
  const ts = [...TR[i].btc, ...TR[i].ethusdt]
  const half = ts.map(x => ({ ...x, r: 0.5 * x.r, g: 0.5 * x.g, phi: 0.5 * x.phi }))
  const lr = half.map(x => Math.log(1 + x.r))
  const y = yrs(i)
  const by = (f: (x: Tr) => boolean) => sum(half.filter(f).map(x => x.r)) / y
  return {
    trades: ts.length, perYear: ts.length / y, winRate: ts.filter(x => x.r > 0).length / ts.length,
    top5Share: P.topShare(lr, 0.05).share,
    longContrib: by(x => x.dir === 1), shortContrib: by(x => x.dir === -1), calmContrib: by(x => x.set === 0), agitContrib: by(x => x.set === 1),
    feesOverGross: sum(half.map(x => x.phi)) / sum(half.map(x => x.g)), feesPerYear: sum(half.map(x => x.phi)) / y, grossPerYear: sum(half.map(x => x.g)) / y,
    sharpeA: SA[i], sharpe5050: SR[i], corr: MODELS[i].rho,
  }
})
log('description')

// Par sens, par moitié.
const sideDesc = HALVES.map((h, i) => Object.fromEntries(KEYS.map(k => [k, Object.fromEntries(([1, -1] as const).map(d => {
  const ts = TR[i][k].filter(x => x.dir === d), w = ts.filter(x => x.r > 0), l = ts.filter(x => x.r <= 0), y = yrs(i)
  return [d === 1 ? 'long' : 'short', { n: ts.length, perYear: ts.length / y, winRate: w.length / ts.length, avgWin: P.mean(w.map(x => x.r)), avgLoss: P.mean(l.map(x => x.r)), avgWinD: P.mean(w.map(x => x.Rd)), avgLossD: P.mean(l.map(x => x.Rd)), meanTrade: P.mean(ts.map(x => x.r)), contrib: sum(ts.map(x => x.r)) / y }]
}))])) as Record<SleeveKey, Record<'long' | 'short', { n: number; perYear: number; winRate: number; avgWin: number; avgLoss: number; avgWinD: number; avgLossD: number; meanTrade: number; contrib: number }>>)
// Par année civile : contributions des longs et des shorts, rendement du sous-jacent.
const spotYear = (k: SleeveKey, y: number) => {
  const { t, c } = S[k].bars
  const a = Math.max(idxAt(S[k], Math.max(Date.UTC(y, 0, 1), D0 * DAY)) - 1, 0), b = idxAt(S[k], Math.min(Date.UTC(y + 1, 0, 1), (D1 + 1) * DAY)) - 1
  return c[b] / c[a] - 1
}
const allTrades = (k: SleeveKey) => [...TR[0][k], ...TR[1][k]]
const YEARS = [...new Set(days.map(P.yearOf))]
const yearly = YEARS.map(y => ({
  year: y, partial: y === YEARS[0] || y === YEARS[YEARS.length - 1],
  ...Object.fromEntries(KEYS.map(k => {
    const ts = allTrades(k).filter(x => x.year === y)
    return [k, { spot: spotYear(k, y), long: sum(ts.filter(x => x.dir === 1).map(x => x.r)), short: sum(ts.filter(x => x.dir === -1).map(x => x.r)), nShort: ts.filter(x => x.dir === -1).length, winShort: ts.filter(x => x.dir === -1 && x.r > 0).length / Math.max(1, ts.filter(x => x.dir === -1).length) }]
  })),
})) as unknown as ({ year: number; partial: boolean } & Record<SleeveKey, { spot: number; long: number; short: number; nShort: number; winShort: number }>)[]
// Contexte de marché par moitié : rendement et volatilité journalière du sous-jacent, ATR 15 min moyen.
const context = HALVES.map(h => Object.fromEntries(KEYS.map(k => {
  const s = S[k], a = idxAt(s, days[h.from] * DAY), b = idxAt(s, (days[h.to - 1] + 1) * DAY) - 1
  const closes = P.dayCloses(s.bars.t, s.bars.c, a, b, days.slice(h.from, h.to), s.bars.c[a - 1]).eq
  const r = P.returnsOf(closes, s.bars.c[a - 1])
  const prs = s.preset.sets.map(p => prepare(s.m, p))
  let atrSum = 0, atrN = 0
  for (let i = a; i <= b; i++) { const e = s.select[i]; if (e < 0) continue; const v = prs[e].atr[i] / s.bars.c[i]; if (v > 0) { atrSum += v; atrN++ } }
  const dailySd = P.sd(r.map(x => Math.log(1 + x)))
  return [k, { spotReturn: closes[closes.length - 1] / s.bars.c[a - 1] - 1, dailyVolAnn: dailySd * Math.sqrt(ANN), atr15: atrSum / atrN, atrOverDaily: atrSum / atrN / dailySd }]
}))) as Record<SleeveKey, { spotReturn: number; dailyVolAnn: number; atr15: number; atrOverDaily: number }>[]
log('par sens, par année')

// ================================================================ 3. étude d'événement par moitié
const HS = [1, 4, 16, 64]
function eventStudy(k: SleeveKey) {
  const s = S[k], { t, c } = s.bars
  const a = idxAt(s, D0 * DAY), b = idxAt(s, (D1 + 1) * DAY) - 1
  const prs = s.preset.sets.map(p => prepare(s.m, p))
  const sel = s.select
  const atr = (i: number) => (sel[i] >= 0 ? prs[sel[i]].atr[i] : NaN)
  const yearOf = (i: number) => new Date(t[i]).getUTCFullYear()
  const slot = (i: number) => Math.floor((t[i] % DAY) / M15)
  const monthOf = (i: number) => { const d = new Date(t[i]); return d.getUTCFullYear() * 12 + d.getUTCMonth() }
  // Mouvement moyen d'une bougie quelconque, par (année, quart d'heure), en ATR (comme zero-shot.ts).
  const base = HS.map(hh => {
    const m = new Map<number, { s: number; k: number }>()
    for (let i = a; i <= b - hh; i++) { const v = atr(i); if (!(v > 0)) continue; const key = yearOf(i) * 100 + slot(i); const e = m.get(key) ?? { s: 0, k: 0 }; e.s += (c[i + hh] - c[i]) / v; e.k++; m.set(key, e) }
    return (i: number) => { const e = m.get(yearOf(i) * 100 + slot(i)); return e && e.k ? e.s / e.k : 0 }
  })
  const sPreset = s.preset.sets.map(p => (p.useMicroShock ? Math.min(p.kMain, p.highActivityMode ? Math.max(p.kMicro - 0.2, 0.8) : p.kMicro) : p.kMain))
  const families: { key: string; label: string; ev: { i: number; dir: number }[] }[] = [
    { key: 'signals', label: 'signaux d\'entrée du préréglage', ev: [] },
    { key: 'shockTrend', label: 'chocs bruts dans le sens de la tendance 60 min', ev: [] },
  ]
  families.push({ key: 'signalsLong', label: 'signaux longs', ev: [] }, { key: 'signalsShort', label: 'signaux shorts', ev: [] })
  for (let i = Math.max(a, 1); i <= b; i++) {
    if (s.signals.long[i]) { families[0].ev.push({ i, dir: 1 }); families[2].ev.push({ i, dir: 1 }) }
    if (s.signals.short[i]) { families[0].ev.push({ i, dir: -1 }); families[3].ev.push({ i, dir: -1 }) }
    const e = sel[i]
    if (e < 0 || t[i] - t[i - 1] > M15) continue
    if (!(Math.abs(prs[e].z[i]) > sPreset[e])) continue
    const dir = c[i] > c[i - 1] ? 1 : -1
    const hv = prs[e].htfVal[i]
    if (dir === 1 ? c[i] > hv : c[i] < hv) families[1].ev.push({ i, dir })
  }
  const split = days[half] * DAY
  return families.map(f => ({
    key: f.key, label: f.label,
    byH: HS.map((hh, j) => {
      const groups = [new Map<number, number[]>(), new Map<number, number[]>()]
      for (const { i, dir } of f.ev) {
        if (i + hh > b || !(atr(i) > 0)) continue
        const x = (dir * (c[i + hh] - c[i])) / atr(i) - dir * base[j](i)
        const g = groups[t[i] < split ? 0 : 1], mo = monthOf(i)
        if (!g.has(mo)) g.set(mo, []); g.get(mo)!.push(x)
      }
      return { h: hh, halves: groups.map(g => [...g.values()]) }
    }),
  }))
}
/** Moyenne par bootstrap des mois (mois tirés avec remise) : intervalle à 90 %, P(> 0). */
function boot(months: number[][], rand: () => number, draws = 2000) {
  const sums = months.map(m => sum(m)), cnts = months.map(m => m.length)
  const out: number[] = []
  for (let d = 0; d < draws; d++) { let s = 0, n = 0; for (let j = 0; j < months.length; j++) { const k = Math.floor(rand() * months.length); s += sums[k]; n += cnts[k] } out.push(n ? s / n : 0) }
  return out
}
const rand = P.rng(SEED)
const EVENTS = Object.fromEntries(KEYS.map(k => [k, eventStudy(k).map(f => ({
  key: f.key, label: f.label,
  byH: f.byH.map(x => {
    const [b1, b2] = x.halves.map(m => boot(m, rand))
    const diff = b1.map((v, i) => b2[i] - v)
    const stat = (m: number[][], bs: number[]) => ({ n: sum(m.map(v => v.length)), mean: P.mean(m.flat()), lo: P.quantile(bs, 0.05), hi: P.quantile(bs, 0.95), pPos: bs.filter(v => v > 0).length / bs.length })
    return { h: x.h, H1: stat(x.halves[0], b1), H2: stat(x.halves[1], b2), diff: { mean: P.mean(x.halves[1].flat()) - P.mean(x.halves[0].flat()), lo: P.quantile(diff, 0.05), hi: P.quantile(diff, 0.95), pNeg: diff.filter(v => v < 0).length / diff.length } }
  }),
}))])) as Record<SleeveKey, { key: string; label: string; byH: { h: number; H1: { n: number; mean: number; lo: number; hi: number; pPos: number }; H2: { n: number; mean: number; lo: number; hi: number; pPos: number }; diff: { mean: number; lo: number; hi: number; pNeg: number } }[] }[]>
log('étude d\'événement')

// ================================================================ 4. incertitude sur la baisse
const bsH = HALVES.map((h, i) => P.blockBootstrap(RET.btc.slice(h.from, h.to), RET.ethusdt.slice(h.from, h.to), days.slice(h.from, h.to), 5000, SEED + 10 + i).sharpeP)
const dS = bsH[0].map((v, i) => bsH[1][i] - v)
const uncertainty = { observed: SA[1] - SA[0], lo90: P.quantile(dS, 0.05), hi90: P.quantile(dS, 0.95), pDrop: dS.filter(v => v < 0).length / dS.length, H1: { lo: P.quantile(bsH[0], 0.05), hi: P.quantile(bsH[0], 0.95) }, H2: { lo: P.quantile(bsH[1], 0.05), hi: P.quantile(bsH[1], 0.95) } }
log('bootstrap')

// ================================================================ rapport
const pct = (x: number, d = 1) => (Number.isFinite(x) ? `${x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(d)} %` : '—')
const spct = (x: number, d = 1) => (Number.isFinite(x) ? `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x * 100).toFixed(d)} %` : '—')
const num = (x: number, d = 2) => (Number.isFinite(x) ? `${x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}` : '—')
const snum = (x: number, d = 2) => (Number.isFinite(x) ? `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(d)}` : '—')
const L: string[] = []
const table = (head: string[], rows: string[][]) => { L.push(`| ${head.join(' | ')} |`, `|${head.map((_, i) => (i ? ' ---: ' : ' --- ')).join('|')}|`); for (const r of rows) L.push(`| ${r.join(' | ')} |`); L.push('') }
const [H1, H2] = HALVES
const [d1, d2] = DESC, [p1, p2] = portfolioDesc
const effects = GROUPS.map(g => ({ ...g, value: shPortfolio.get(g.key)! })).sort((a, b) => a.value - b.value)
const ev = (k: SleeveKey, fam: string, h: number) => EVENTS[k].find(f => f.key === fam)!.byH.find(x => x.h === h)!

const sd1 = sideDesc[0], sd2 = sideDesc[1]
const sideEff = (k: GS) => shSide.get(k)!
const famRow = (k: SleeveKey, fam: string, h: number) => ev(k, fam, h)
const evS = (k: SleeveKey, fam: string, h: number) => { const x = famRow(k, fam, h); return `${snum(x.H1.mean, 2)} → ${snum(x.H2.mean, 2)}` }
const yB = yearly.filter(y => !y.partial), up = (y: typeof yearly[number]) => y.btc.spot > 0
L.push(
  '# Shock Engine BTC/ETH · attribution de la baisse du Sharpe entre les deux moitiés',
  '',
  `Portefeuille officiel (50/50 au départ de chaque moitié, sans rééquilibrage), stratégies figées, coûts du rapport (0,045 % par ordre). Moitiés : **${H1.start} → ${H1.end}** (${H1.days} jours) et **${H2.start} → ${H2.end}** (${H2.days} jours). Sharpe journalier ${num(SA[0])} puis ${num(SA[1])}, identiques au rapport du portefeuille (vérifié). Aucun paramètre modifié. Produit par \`node research/shock/sharpe-attribution.ts\`.`,
  '',
  '## En bref',
  '',
  `1. **La baisse (${snum(SA[1] - SA[0])}) vient presque entièrement des shorts.** Attribution exacte par sens : gain moyen par trade des shorts ${snum(sideEff('shortEdge'))}, des longs ${snum(sideEff('longEdge'))} ; la baisse de volatilité des sleeves la compense en partie (${snum(sideEff('risk'))}). Contribution annuelle des shorts au portefeuille : ${spct(p1.shortContrib)} puis ${spct(p2.shortContrib)} ; des longs : ${spct(p1.longContrib)} puis ${spct(p2.longContrib)}.`,
  `2. **Les tendances n'ont pas raccourci.** En unités de volatilité journalière du sous-jacent, le gagnant moyen grandit (BTC ${num(d1.btc.avgWinD)} → ${num(d2.btc.avgWinD)} σ, ETH ${num(d1.eth.avgWinD)} → ${num(d2.eth.avgWinD)} σ) et les 5 % meilleurs trades restent de même taille (BTC ${num(d1.btc.top5AvgD, 1)} → ${num(d2.btc.top5AvgD, 1)} σ, ETH ${num(d1.eth.top5AvgD, 1)} → ${num(d2.eth.top5AvgD, 1)} σ). En %, ils baissent (BTC ${pct(d1.btc.avgWin, 2)} → ${pct(d2.btc.avgWin, 2)}) parce que la volatilité du marché a baissé d'environ un tiers.`,
  `3. **Ce qui a changé, c'est le taux de gain** (BTC ${pct(d1.btc.winRate, 0)} → ${pct(d2.btc.winRate, 0)}, ETH ${pct(d1.eth.winRate, 0)} → ${pct(d2.eth.winRate, 0)}), surtout sur les shorts (BTC ${pct(sd1.btc.short.winRate, 0)} → ${pct(sd2.btc.short.winRate, 0)}, ETH ${pct(sd1.ethusdt.short.winRate, 0)} → ${pct(sd2.ethusdt.short.winRate, 0)}). Effet de Shapley du taux de gain : ${snum(shPortfolio.get('winRate')!)}, compensé en partie par des gagnants plus grands (${snum(shPortfolio.get('winSize')!)}), plus de trades en régime calme (${snum(shPortfolio.get('regime')!)}) et plus de trades (${snum(shPortfolio.get('freq')!)}).`,
  `4. **E[R | choc] ne tend pas vers 0.** Chocs bruts dans la tendance 60 min, excès à 1 h en ATR : BTC ${evS('btc', 'shockTrend', 4)}, ETH ${evS('ethusdt', 'shockTrend', 4)} ; les intervalles à 90 % de la 2e moitié sont au-dessus de 0 ou le touchent. Signaux longs : excès à 16 h BTC ${evS('btc', 'signalsLong', 64)}, ETH ${evS('ethusdt', 'signalsLong', 64)}. **Exception : les signaux shorts d'ETH**, dont l'excès à 1–4 h tombe à environ 0 (${evS('ethusdt', 'signalsShort', 4)} à 1 h ; différence significative au seuil de 90 %).`,
  `5. **Les shorts gagnent surtout dans les années baissières.** Par année, la contribution des shorts est forte en 2018 et 2022 (marchés en forte baisse, tous deux dans la 1re moitié), positive en 2025–2026, négative en 2023 (forte hausse). En 1re moitié les shorts BTC gagnaient aussi en années haussières (2019–2021) ; ce n'est plus le cas en 2023–2024.`,
  `6. **La corrélation BTC/ETH (${num(p1.corr)} → ${num(p2.corr)}) ne pèse presque rien** : ${snum(shPortfolio.get('corr')!)} de Sharpe. Les frais par trade n'ont pas changé (effet ${snum(shPortfolio.get('fees')!)}), mais ils prennent ${pct(p2.feesOverGross, 0)} de l'alpha brut contre ${pct(p1.feesOverGross, 0)}, parce que l'alpha brut des shorts a disparu.`,
  `7. **Prudence statistique** : bootstrap des mois, intervalle à 90 % de la baisse ${snum(uncertainty.lo90)} à ${snum(uncertainty.hi90)}, P(baisse) ${pct(uncertainty.pDrop, 0)}. Chaque moitié ne contient que quelques phases baissières.`,
  '',
)

L.push('## 1. Tableau comparatif', '', 'Rendements de trade en % du capital de la sleeve à l\'entrée (nets de frais). « σ jour » : mêmes rendements divisés par la volatilité journalière du sous-jacent connue à l\'entrée (écart type des 30 jours précédents) ; « ATR » : divisés par l\'ATR 15 min à l\'entrée. Ces deux unités rendent les tailles comparables d\'une période de volatilité à l\'autre. Contributions : somme des rendements de trade par an (portefeuille : demi-poids). Une position est rattachée à la moitié où elle est ouverte.', '')
const row = (label: string, f: (d: ReturnType<typeof describe>) => string, pf?: (p: typeof p1) => string) => [label, f(d1.btc), f(d2.btc), f(d1.eth), f(d2.eth), pf ? pf(p1) : '', pf ? pf(p2) : '']
table(['variable', 'BTC 2018–22', 'BTC 2022–26', 'ETH 2018–22', 'ETH 2022–26', 'portefeuille 2018–22', 'portefeuille 2022–26'], [
  row('Trades / an', d => num(d.perYear, 0), p => num(p.perYear, 0)),
  row('Taux de gain', d => pct(d.winRate, 0), p => pct(p.winRate, 0)),
  row('Gagnant moyen', d => pct(d.avgWin, 2)),
  row('Gagnant moyen (σ jour)', d => num(d.avgWinD)),
  row('Gagnant moyen (ATR)', d => num(d.avgWinR)),
  row('Perdant moyen', d => pct(d.avgLoss, 2)),
  row('Perdant moyen (σ jour)', d => num(d.avgLossD)),
  row('Payoff', d => num(d.payoff)),
  row('Part des 5 % meilleurs trades (croissance log)', d => pct(d.top5Share, 0), p => pct(p.top5Share, 0)),
  row('Gain moyen des 5 % meilleurs trades', d => pct(d.top5AvgWin, 1)),
  row('Gain moyen des 5 % meilleurs (σ jour)', d => num(d.top5AvgD, 1)),
  row('MFE moyen des gagnants (ATR)', d => num(d.mfeWin)),
  row('MAE moyen, tous trades (ATR)', d => num(d.mae)),
  row('Durée médiane des gagnants', d => `${num(d.holdWinH, 1)} h`),
  row('Volatilité journalière à l\'entrée', d => pct(d.sigD, 2)),
  row('Contribution des longs / an', d => spct(d.longContrib), p => spct(p.longContrib)),
  row('Contribution des shorts / an', d => spct(d.shortContrib), p => spct(p.shortContrib)),
  row('Contribution régime calme / an', d => spct(d.calmContrib), p => spct(p.calmContrib)),
  row('Contribution régime agité / an', d => spct(d.agitContrib), p => spct(p.agitContrib)),
  row('Trades longs / shorts', d => `${d.nLong} / ${d.nShort}`),
  row('Trades calmes / agités', d => `${d.nCalm} / ${d.nAgit}`),
  row('Sharpe (journalier)', d => num(d.sharpe), p => num(p.sharpeA)),
  row('Volatilité annualisée', d => pct(d.vol, 0)),
  row('Frais / alpha brut', d => pct(d.feesOverGross, 0), p => pct(p.feesOverGross, 0)),
  row('Frais / an · alpha brut / an', d => `${pct(d.feesPerYear, 0)} · ${pct(d.grossPerYear, 0)}`, p => `${pct(p.feesPerYear, 0)} · ${pct(p.grossPerYear, 0)}`),
  ['Corrélation BTC/ETH', '', '', '', '', num(p1.corr), num(p2.corr)],
])

L.push('## 2. Attribution exacte par sens : longs et shorts', '', 'μ_s = f_long · m_long + f_short · m_short + c_s (f : trades par jour, m : gain moyen net par trade, c : conversion trades → jours) ; Sharpe du 50/50 rééquilibré reconstruit exactement. Valeurs de Shapley ; la somme plus la dérive des poids redonne la baisse publiée.', '')
table(['effet', 'Sharpe'], [
  ...SIDE_GROUPS.map(g => [g.label, snum(sideEff(g.key))]),
  ['Dérive des poids (portefeuille officiel)', snum(drift)],
  ['**Total**', `**${snum(SA[1] - SA[0])}**`],
])
table(['sleeve · sens', 'trades / an 2018–22', 'trades / an 2022–26', 'taux de gain', 'gagnant moyen', 'gagnant (σ jour)', 'perdant moyen', 'gain moyen par trade', 'contribution / an'], KEYS.flatMap(k => (['long', 'short'] as const).map(d => {
  const a = sd1[k][d], b = sd2[k][d]
  return [`${NAME[k]} · ${d}`, num(a.perYear, 0), num(b.perYear, 0), `${pct(a.winRate, 0)} → ${pct(b.winRate, 0)}`, `${pct(a.avgWin, 2)} → ${pct(b.avgWin, 2)}`, `${num(a.avgWinD)} → ${num(b.avgWinD)}`, `${pct(a.avgLoss, 2)} → ${pct(b.avgLoss, 2)}`, `${pct(a.meanTrade, 2)} → ${pct(b.meanTrade, 2)}`, `${spct(a.contrib)} → ${spct(b.contrib)}`]
})))
L.push('Par année civile (somme des rendements de trade de la sleeve ; * : année partielle) :', '')
table(['année', 'BTC spot', 'BTC longs', 'BTC shorts', 'taux de gain shorts BTC', 'ETH spot', 'ETH longs', 'ETH shorts', 'taux de gain shorts ETH'], yearly.map(y => [`${y.year}${y.partial ? '*' : ''}${y.year === 2022 ? ' (à cheval sur les deux moitiés)' : ''}`, spct(y.btc.spot, 0), spct(y.btc.long, 0), spct(y.btc.short, 0), pct(y.btc.winShort, 0), spct(y.ethusdt.spot, 0), spct(y.ethusdt.long, 0), spct(y.ethusdt.short, 0), pct(y.ethusdt.winShort, 0)]))

L.push('## 3. Attribution exacte par facteurs', '')
L.push(`Le Sharpe du portefeuille 50/50 rééquilibré chaque jour s'écrit exactement (moments de population) :`, '', '```', 'Sharpe = √365,25 · ½(μ_BTC + μ_ETH) / √(¼σ_BTC² + ¼σ_ETH² + ½ρ σ_BTC σ_ETH)', 'μ_s = f_s · Σ_régime π_s,k · [ p (a_W · W − φ_W) + (1 − p)(a_L · L − φ_L) ]_s,k + c_s', '```', '',
  'f : trades par jour ; π : part des trades par régime ; p : taux de gain ; W, L : gain et perte bruts moyens en unités de volatilité journalière du sous-jacent à l\'entrée ; a : conversion de ces unités en % ; φ : frais en % ; σ : volatilité journalière des sleeves ; ρ : corrélation ; c : écart entre la moyenne journalière et les trades rapportés au jour. L\'identité redonne le Sharpe observé de chaque moitié à 1e-10 près (vérifié). Chaque effet est la valeur de Shapley de son groupe : l\'écart moyen de Sharpe quand on remplace ses paramètres 2018–22 par ceux de 2022–26, sur tous les ordres possibles. La colonne « variante ATR » mesure les tailles en ATR 15 min au lieu de la volatilité journalière.', '')
table(['effet', 'portefeuille', 'variante ATR', 'BTC seul', 'ETH seul', 'paramètres remplacés'], [
  ...GROUPS.map(g => [g.label, snum(shPortfolio.get(g.key)!), snum(shPortfolioAtr.get(g.key)!), g.key === 'corr' ? '—' : snum(shSleeve.btc.get(g.key)!), g.key === 'corr' ? '—' : snum(shSleeve.ethusdt.get(g.key)!), g.detail]),
  ['**Total, 50/50 rééquilibré**', `**${snum(totalModel)}**`, `**${snum(totalModel)}**`, `**${snum(sharpe(RET.btc.slice(H2.from, H2.to)) - sharpe(RET.btc.slice(H1.from, H1.to)))}**`, `**${snum(sharpe(RET.ethusdt.slice(H2.from, H2.to)) - sharpe(RET.ethusdt.slice(H1.from, H1.to)))}**`, `${num(SR[0])} → ${num(SR[1])}`],
  ['Dérive des poids (portefeuille officiel)', snum(drift), snum(drift), '', '', 'A (sans rééquilibrage) moins 50/50 rééquilibré, 2e moitié moins 1re'],
  ['**Total, portefeuille officiel**', `**${snum(SA[1] - SA[0])}**`, `**${snum(SA[1] - SA[0])}**`, '', '', `${num(SA[0])} → ${num(SA[1])}`],
])
L.push('Paramètres par moitié :', '')
const cellRows = (k: SleeveKey) => [0, 1].flatMap(j => [
  [`${NAME[k]} ${j ? 'agité' : 'calme'} · trades / an`, num(MODELS[0][k].f * MODELS[0][k].pi[j] * ANN, 1), num(MODELS[1][k].f * MODELS[1][k].pi[j] * ANN, 1)],
  [`${NAME[k]} ${j ? 'agité' : 'calme'} · taux de gain`, pct(MODELS[0][k].cells[j].p, 1), pct(MODELS[1][k].cells[j].p, 1)],
  [`${NAME[k]} ${j ? 'agité' : 'calme'} · gagnant brut (σ jour)`, num(MODELS[0][k].cells[j].Wg), num(MODELS[1][k].cells[j].Wg)],
  [`${NAME[k]} ${j ? 'agité' : 'calme'} · perdant brut (σ jour)`, num(MODELS[0][k].cells[j].Lg), num(MODELS[1][k].cells[j].Lg)],
  [`${NAME[k]} ${j ? 'agité' : 'calme'} · moyenne nette par trade`, pct(cellMean(MODELS[0][k].cells[j]), 3), pct(cellMean(MODELS[1][k].cells[j]), 3)],
])
table(['paramètre', '2018–22', '2022–26'], [
  ...KEYS.flatMap(k => [
    ...cellRows(k),
    [`${NAME[k]} · volatilité journalière annualisée de la sleeve`, pct(MODELS[0][k].sigma * Math.sqrt(ANN), 1), pct(MODELS[1][k].sigma * Math.sqrt(ANN), 1)],
    [`${NAME[k]} · rendement moyen par jour (conversion c)`, `${pct(MODELS[0][k].mu, 3)} (${pct(MODELS[0][k].c, 4)})`, `${pct(MODELS[1][k].mu, 3)} (${pct(MODELS[1][k].c, 4)})`],
  ]),
  ['Corrélation BTC/ETH', num(MODELS[0].rho), num(MODELS[1].rho)],
])
L.push('Contexte de marché :', '')
table(['', 'BTC 2018–22', 'BTC 2022–26', 'ETH 2018–22', 'ETH 2022–26'], [
  ['Rendement du sous-jacent sur la moitié', ...KEYS.flatMap(k => [spct(context[0][k].spotReturn, 0), spct(context[1][k].spotReturn, 0)])],
  ['Volatilité journalière annualisée du sous-jacent', ...KEYS.flatMap(k => [pct(context[0][k].dailyVolAnn, 0), pct(context[1][k].dailyVolAnn, 0)])],
  ['ATR 15 min moyen (% du prix)', ...KEYS.flatMap(k => [pct(context[0][k].atr15, 2), pct(context[1][k].atr15, 2)])],
  ['ATR 15 min / écart type journalier', ...KEYS.flatMap(k => [num(context[0][k].atrOverDaily, 3), num(context[1][k].atrOverDaily, 3)])],
])

L.push('## 4. Le signal prédit-il encore la suite du choc ?', '', 'Mouvement après l\'événement, dans son sens, en ATR, moins le mouvement moyen d\'une bougie quelconque à la même heure de la même année. Intervalles à 90 % par bootstrap des mois ; différence : mois rééchantillonnés indépendamment dans chaque moitié.', '')
for (const k of KEYS) for (const f of EVENTS[k]) {
  L.push(`### ${NAME[k]} · ${f.label}`, '')
  table(['horizon', 'événements 2018–22', 'excès 2018–22', 'intervalle 90 %', 'événements 2022–26', 'excès 2022–26', 'intervalle 90 %', 'P(excès > 0) 2022–26', 'différence', 'intervalle 90 %'], f.byH.map(x => [
    `${x.h} bougie${x.h > 1 ? 's' : ''} (${x.h * 15 >= 60 ? `${x.h / 4} h` : '15 min'})`, String(x.H1.n), snum(x.H1.mean, 3), `${snum(x.H1.lo, 3)} à ${snum(x.H1.hi, 3)}`, String(x.H2.n), snum(x.H2.mean, 3), `${snum(x.H2.lo, 3)} à ${snum(x.H2.hi, 3)}`, pct(x.H2.pPos, 0), snum(x.diff.mean, 3), `${snum(x.diff.lo, 3)} à ${snum(x.diff.hi, 3)}`,
  ]))
}

L.push('## 5. Incertitude', '', `Bootstrap des mois (5 000 tirages par moitié, BTC et ETH tirés ensemble) : Sharpe 2018–22 entre ${num(uncertainty.H1.lo)} et ${num(uncertainty.H1.hi)}, 2022–26 entre ${num(uncertainty.H2.lo)} et ${num(uncertainty.H2.hi)} (90 %). Baisse observée ${snum(uncertainty.observed)}, intervalle à 90 % ${snum(uncertainty.lo90)} à ${snum(uncertainty.hi90)}, P(baisse) ${pct(uncertainty.pDrop, 0)}.`, '')

L.push('## 6. Contrôles', '')
table(['contrôle', 'résultat', 'détail'], checks.map(c => [c.name, c.ok ? 'ok' : '**échec**', c.detail]))
L.push('## Limites', '',
  '- L\'attribution est exacte pour chaque identité utilisée ; un autre découpage des facteurs donnerait d\'autres parts. Les valeurs de Shapley répartissent les interactions à parts égales entre les groupes concernés. Les deux découpages (par sens, par facteurs) sont deux lectures du même total, à ne pas additionner.',
  '- Taille des trades et environnement de volatilité sont liés : en unités de volatilité, la taille mesure la longueur des mouvements indépendamment du niveau de volatilité ; l\'effet « environnement de volatilité » regroupe la conversion en % et la volatilité des sleeves, qui se compensent en partie.',
  '- Chaque moitié dure quatre ans et ne contient que quelques phases baissières, celles qui portent les shorts. Le résultat dépend de la séquence des marchés autant que du signal.',
  '- Diagnostic seulement : rien ici ne justifie de modifier la stratégie figée. Toute idée (par exemple traiter les shorts autrement) serait une nouvelle hypothèse, à figer avant de la tester sur des données non vues.',
  '')

const out = { halves: HALVES, sharpe: { official: SA, rebalanced5050: SR, published }, models: { daily: MODELS, atr: MODELS_ATR, side: sideModels }, shapley: { portfolio: Object.fromEntries(shPortfolio), portfolioAtr: Object.fromEntries(shPortfolioAtr), side: Object.fromEntries(shSide), btc: Object.fromEntries(shSleeve.btc), eth: Object.fromEntries(shSleeve.ethusdt), drift, total: SA[1] - SA[0] }, describe: DESC, portfolio: portfolioDesc, sides: sideDesc, yearly, context, events: EVENTS, uncertainty, checks }
writeFileSync(join(OUT, 'sharpe-attribution.md'), L.join('\n'))
writeFileSync(join(OUT, 'sharpe-attribution.json'), JSON.stringify(out, (_, v) => (typeof v === 'number' ? (Number.isFinite(v) ? +v.toPrecision(10) : null) : v), 1))
log(`écrit research/reports/btc-eth-portfolio/sharpe-attribution.{md,json} · contrôles ${checks.filter(c => c.ok).length}/${checks.length}`)
if (checks.some(c => !c.ok)) process.exitCode = 1
