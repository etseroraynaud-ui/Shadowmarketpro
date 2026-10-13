// Anatomie des pertes du Shock Engine (research/preregistration/loss-anatomy.md) : les pertes se
// forment-elles avant toute continuation (entrées) ou après un mouvement favorable non conservé
// (sorties) ? Descriptif ; aucune règle n'est modifiée ni testée.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/loss-anatomy.ts
//
// Sorties : research/reports/loss-anatomy/ (loss-anatomy.md, loss-anatomy.json).

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, UNSEEN, referenceAsset, tradeR, unseenAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { breakevenAfter1R, breakevenR, lossClass } from '../lib/loss-anatomy.ts'
import type { LossClass } from '../lib/loss-anatomy.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/loss-anatomy')
const PLAN = 'research/preregistration/loss-anatomy.md'
const DAY = 864e5
const BOOT = 2000, SEED = 20261013
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }

const FROZEN: Record<string, string> = {
  'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
  'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
  'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
  'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
  'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
  'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
}
for (const [f, h] of Object.entries(FROZEN)) check(`empreinte ${f}`, sha(readFileSync(join(ROOT, f))) === h, f)

// ================================================================ trades
interface T {
  asset: string; dir: 1 | -1; set: number; R: number; ret: number; mfeR: number; maeR: number; feesR: number; hold: number
  exits: string; month: number; cls: LossClass; reached: boolean; beHit: boolean; Rbe: number; Rcf: number
}
function tradesOf(a: Asset, window?: [number, number]): T[] {
  const res = simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)
  const t = a.bars.t
  return res.positions
    .filter(p => !p.exits.includes('END') && p.entryIdx >= a.lo && (!window || (t[p.entryIdx] >= window[0] && t[p.entryIdx] < window[1])))
    .map(p => {
      const sets = a.preset.sets, S = sets[p.set]
      const x = tradeR(p, sets, a.mintick, t)
      const risk = p.qty * x.stopDist
      const feesR = p.fees / risk
      const be = breakevenAfter1R(a.bars, p.entryIdx, p.exitIdx, p.dir, p.entryPrice, x.stopDist)
      const Rbe = breakevenR(S.useTP1, S.tp1AtrMult / S.atrStopMult, S.tp1QtyPct / 100, feesR)
      return {
        asset: a.key, dir: p.dir, set: p.set, R: x.R, ret: p.pnl / p.equityAtEntry, mfeR: x.mfeR, maeR: x.maeR, feesR, hold: p.exitIdx - p.entryIdx, exits: p.exits.join('+'),
        month: P.monthKey(Math.floor((t[p.entryIdx] + M15) / DAY)), cls: lossClass(x.R, x.mfeR), reached: be.reached, beHit: be.beHit, Rbe, Rcf: be.beHit ? Rbe : x.R,
      }
    })
}
const REF: [number, number] = [Date.parse('2018-09-01'), Date.parse('2026-10-01')]
const SAMPLES: Record<string, T[]> = {
  'BTC/ETH (développement)': [...tradesOf(referenceAsset('btc'), REF), ...tradesOf(referenceAsset('ethusdt'), REF)],
  '8 actifs vierges (réplication)': UNSEEN.flatMap(s => tradesOf(unseenAsset(s))),
}
check('BTC/ETH : 1 311 trades de référence', SAMPLES['BTC/ETH (développement)'].length === 1311, String(SAMPLES['BTC/ETH (développement)'].length))
// Un trade gagnant de C ne peut pas exister ; un perdant de classe C a forcément touché +1 R.
for (const [n, ts] of Object.entries(SAMPLES)) check(`${n} : MFE ≥ 0 et MAE ≤ 0`, ts.every(x => x.mfeR >= -1e-9 && x.maeR <= 1e-9), `${ts.length} trades`)
log('trades')

// ================================================================ mesures
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0)
const med = (xs: number[]) => P.quantile(xs, 0.5)
const CLS: { k: LossClass; label: string }[] = [
  { k: 'A', label: 'A · sans continuation (MFE < 0,5 R)' },
  { k: 'B', label: 'B · continuation partielle (0,5 ≤ MFE < 1 R)' },
  { k: 'C', label: 'C · gain rendu (MFE ≥ 1 R)' },
  { k: 'W', label: 'Gagnants (R > 0)' },
]
function boot(ts: T[], stat: (agg: Map<string, number>) => number[]) {
  const months = [...new Set(ts.map(x => x.month))].sort((a, b) => a - b)
  const per = new Map<number, Map<string, number>>(months.map(m => [m, new Map()]))
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v)
  for (const x of ts) {
    const m = per.get(x.month)!
    if (x.R <= 0) { add(m, 'loss', x.R); add(m, `loss${x.cls}`, x.R) }
    add(m, 'net', x.Rcf - x.R)
    add(m, x.R > 0 ? 'cost' : 'gain', x.Rcf - x.R)
    add(m, 'sumR', x.R)
  }
  const R = P.rng(SEED)
  const out: number[][] = []
  for (let r = 0; r < BOOT; r++) {
    const agg = new Map<string, number>()
    for (let k = 0; k < months.length; k++) for (const [key, v] of per.get(months[Math.floor(R() * months.length)])!) add(agg, key, v)
    out.push(stat(agg))
  }
  return out
}
const ci = (xs: number[]) => [P.quantile(xs, 0.025), P.quantile(xs, 0.975)]

function analyse(ts: T[]) {
  const losers = ts.filter(x => x.R <= 0), winners = ts.filter(x => x.R > 0)
  const lossSum = sum(losers.map(x => x.R))
  const classes = CLS.map(({ k, label }) => {
    const g = ts.filter(x => x.cls === k)
    const exitMix = Object.entries(g.reduce((m, x) => { m[x.exits] = (m[x.exits] ?? 0) + 1; return m }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e, n]) => ({ exit: e, share: n / g.length }))
    return {
      cls: k, label, n: g.length, shareTrades: g.length / ts.length, sumR: sum(g.map(x => x.R)), shareLoss: k === 'W' ? NaN : sum(g.map(x => x.R)) / lossSum,
      meanR: P.mean(g.map(x => x.R)), mfe: med(g.map(x => x.mfeR)), mae: med(g.map(x => x.maeR)), hold: med(g.map(x => x.hold)),
      firstHour: g.filter(x => x.hold <= 4).length / g.length, exitMix,
    }
  })
  const buckets = [[-Infinity, 0.25], [0.25, 0.5], [0.5, 1], [1, 2], [2, 3], [3, Infinity]].map(([lo, hi]) => {
    const g = losers.filter(x => x.mfeR >= lo && x.mfeR < hi)
    return { lo, hi, n: g.length, share: g.length / losers.length, shareLoss: sum(g.map(x => x.R)) / lossSum }
  })
  const give = winners.map(x => x.mfeR - x.R)
  const bigGive = winners.filter(x => x.mfeR >= 2 && x.R < 1)
  const winnersStats = {
    n: winners.length, sumR: sum(winners.map(x => x.R)), sumMfe: sum(winners.map(x => x.mfeR)), captureMedian: med(winners.map(x => x.R / x.mfeR)),
    giveback: sum(give), givebackMedian: med(give), bigGive: bigGive.length, bigGiveback: sum(bigGive.map(x => x.mfeR - x.R)),
  }
  const A = classes[0], C = classes[2]
  const loseC = ts.filter(x => x.cls === 'C')
  const bounds = {
    entries: -A.sumR,
    exits: sum(loseC.map(x => x.Rbe - x.R)),
  }
  const gain = sum(ts.filter(x => x.R <= 0).map(x => x.Rcf - x.R)), cost = sum(ts.filter(x => x.R > 0).map(x => x.Rcf - x.R))
  const cf = {
    reached: ts.filter(x => x.reached).length, beHit: ts.filter(x => x.beHit).length,
    losersSaved: ts.filter(x => x.R <= 0 && x.beHit).length, winnersCut: ts.filter(x => x.R > 0 && x.beHit).length,
    bigWinnersCut: ts.filter(x => x.R >= 5 && x.beHit).length, gain, cost, net: gain + cost, sumR: sum(ts.map(x => x.R)),
  }
  const draws = boot(ts, a => [(a.get('lossA') ?? 0) / a.get('loss')!, (a.get('lossC') ?? 0) / a.get('loss')!, a.get('net') ?? 0, a.get('gain') ?? 0, a.get('cost') ?? 0])
  const col = (j: number) => draws.map(d => d[j])
  const intervals = { shareLossA: ci(col(0)), shareLossC: ci(col(1)), net: ci(col(2)), gain: ci(col(3)), cost: ci(col(4)) }
  const split = (f: (x: T) => string) => Object.entries(ts.reduce((m, x) => { (m[f(x)] ??= []).push(x); return m }, {} as Record<string, T[]>)).map(([k, g]) => {
    const l = g.filter(x => x.R <= 0), ls = sum(l.map(x => x.R))
    const share = (c: LossClass) => sum(l.filter(x => x.cls === c).map(x => x.R)) / ls
    return { key: k, n: g.length, losers: l.length, A: share('A'), B: share('B'), C: share('C'), cfNet: sum(g.map(x => x.Rcf - x.R)), sumR: sum(g.map(x => x.R)), logRet: sum(g.map(x => Math.log(1 + x.ret))) }
  })
  const splits = {
    actif: split(x => x.asset), sens: split(x => (x.dir === 1 ? 'long' : 'short')), régime: split(x => (x.set === 1 ? 'agité (stop 1,1 ATR)' : 'calme (stop 3,3 ATR)')),
  }
  return { n: ts.length, losers: losers.length, lossSum, classes, buckets, winners: winnersStats, bounds, cf, intervals, splits }
}
const RES = Object.fromEntries(Object.entries(SAMPLES).map(([k, ts]) => [k, analyse(ts)]))
log('analyse')

// ================================================================ lecture (règle du plan)
type Res = ReturnType<typeof analyse>
const verdictOf = (r: Res) => {
  const a = r.classes[0].shareLoss, c = r.classes[2].shareLoss
  return { a, c, mostlyA: a > 0.5, mostlyC: c > 0.5, netPos: r.cf.net > 0 }
}
const V = Object.fromEntries(Object.entries(RES).map(([k, r]) => [k, verdictOf(r)]))
const vs = Object.values(V)
const conclusion = vs.every(v => v.mostlyA && !v.netPos) ? 'entrées' : vs.every(v => v.mostlyC && v.netPos) ? 'sorties' : 'aucune cible dominante'

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
const git = (() => { try { return { commit: execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(), clean: execSync('git status --porcelain -- research/lib research/shock/loss-anatomy.ts lib', { cwd: ROOT }).toString().trim() === '' } } catch { return { commit: 'inconnu', clean: false } } })()
writeFileSync(join(OUT, 'loss-anatomy.json'), JSON.stringify({ plan: PLAN, generatedAt: new Date().toISOString(), git, checks, conclusion, verdicts: V, results: RES }, (_, v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(8) : v), 1) + '\n')

const MINUS = '−'
const fin = (x: number) => Number.isFinite(x)
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sg = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const pc = (x: number, d = 0) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const L: string[] = []
const tbl = (head: string[], rows: (string | number)[][]) => { L.push(`| ${head.join(' | ')} |`, `| ${head.map((_, i) => (i ? '---:' : '---')).join(' | ')} |`, ...rows.map(r => `| ${r.join(' | ')} |`), '') }
const dev = RES['BTC/ETH (développement)'], un = RES['8 actifs vierges (réplication)']

L.push('# Anatomie des pertes du Shock Engine', '')
L.push(`Plan : \`${PLAN}\`, commité avant tout calcul. Script : \`research/shock/loss-anatomy.ts\` (commit \`${git.commit.slice(0, 7)}\`${git.clean ? '' : ', sources modifiées'}). Descriptif : aucune règle du Shock Engine n'est modifiée ni testée. Trades V0 (E2 inchangé) : BTC/ETH de référence (développement) et 8 actifs vierges (réplication).`, '')
L.push('## Réponse', '')
L.push(`**Cible indiquée par la règle du plan : ${conclusion}.**`, '')
for (const [k, r] of Object.entries(RES)) {
  const v = V[k]
  L.push(`- **${k}** : ${pc(v.a)} de la somme des pertes viennent de trades qui n'ont jamais atteint +0,5 R (classe A, IC 95 % ${pc(r.intervals.shareLossA[0])} à ${pc(r.intervals.shareLossA[1])}), ${pc(v.c)} de trades qui avaient atteint +1 R (classe C, IC ${pc(r.intervals.shareLossC[0])} à ${pc(r.intervals.shareLossC[1])}). Stop au point mort après +1 R (premier ordre) : ${sg(r.cf.gain, 0)} R récupérés sur les perdants, ${sg(r.cf.cost, 0)} R perdus sur les gagnants, net ${sg(r.cf.net, 0)} R (IC 95 % ${sg(r.intervals.net[0], 0)} à ${sg(r.intervals.net[1], 0)}) pour ΣR = ${num(r.cf.sumR, 0)} R.`)
}
L.push('')
L.push(`Borne « entrées » (un filtre parfait écartant toutes les pertes de classe A sans toucher un gagnant) : ${num(dev.bounds.entries, 0)} R sur BTC/ETH, ${num(un.bounds.entries, 0)} R sur les actifs vierges. Borne « sorties » (toutes les pertes de classe C ramenées au point mort) : ${num(dev.bounds.exits, 0)} R et ${num(un.bounds.exits, 0)} R. Ce sont des maximums théoriques ; le contrefactuel montre ce qu'en laisse une règle simple une fois payé son coût sur les gagnants.`, '')

{
  L.push('## Lecture', '')
  const ab = (r: Res) => r.classes[0].shareLoss + r.classes[1].shareLoss
  const neg = (r: Res) => r.intervals.net[1] < 0
  L.push(`- **Les pertes se forment surtout avant la continuation.** Trades jamais passés à +1 R (classes A et B) : ${pc(ab(dev))} de la somme des pertes sur BTC/ETH, ${pc(ab(un))} sur les actifs vierges ; dont jamais à +0,5 R : ${pc(dev.classes[0].shareLoss)} et ${pc(un.classes[0].shareLoss)}, la moitié sortie dans la première heure. Aucune classe ne dépasse la moitié des pertes : le seuil de la règle du plan n'est pas atteint, d'où « ${conclusion} ».`)
  L.push(`- **Les gains rendus sont le prix des grands gagnants.** Les gagnants ne gardent en médiane que ${pc(dev.winners.captureMedian)} de leur MFE (BTC/ETH), mais protéger plus tôt coûte plus que cela ne rapporte : le stop au point mort après +1 R a un effet net ${sg(dev.cf.net, 0)} R sur BTC/ETH et ${sg(un.cf.net, 0)} R sur les actifs vierges${neg(dev) && neg(un) ? ', intervalles excluant zéro des deux côtés' : ''}. Il coupe ${dev.cf.winnersCut} gagnants sur BTC/ETH, dont ${dev.cf.bigWinnersCut} à 5 R ou plus, qui étaient revenus au prix d'entrée avant de partir.`)
  const reg = (r: Res) => r.splits.régime
  const agi = (r: Res) => reg(r).find(x => x.key.startsWith('agité'))!, calm = (r: Res) => reg(r).find(x => x.key.startsWith('calme'))!
  L.push(`- **Le résultat vient du régime calme.** Somme des ln(1 + rendement) des trades : calme ${pc(calm(dev).logRet, 0)} contre agité ${pc(agi(dev).logRet, 0)} sur BTC/ETH (${agi(dev).n} trades agités) ; ${pc(calm(un).logRet, 0)} contre ${pc(agi(un).logRet, 0)} sur les actifs vierges. En R : ${num(calm(dev).sumR, 0)} contre ${num(agi(dev).sumR, 0)} (BTC/ETH), ${num(calm(un).sumR, 0)} contre ${num(agi(un).sumR, 0)} (vierges). Observation descriptive, non testée : les entrées du jeu agité (stop 1,1 ATR, longs seulement) apportent peu ou rien.`, '')
}

for (const [k, r] of Object.entries(RES)) {
  L.push(`## ${k}`, '')
  L.push(`${r.n} trades, dont ${r.losers} perdants ; somme des pertes ${num(r.lossSum, 0)} R.`, '')
  tbl(['Classe', 'Trades', 'Part des trades', 'ΣR', 'Part des pertes', 'R moyen', 'MFE médiane (R)', 'MAE médiane (R)', 'Durée médiane (bougies)', 'Sortis en ≤ 1 h', 'Sorties principales'],
    r.classes.map(c => [c.label, c.n, pc(c.shareTrades), num(c.sumR, 0), c.cls === 'W' ? '—' : pc(c.shareLoss), sg(c.meanR), num(c.mfe), sg(c.mae), num(c.hold, 0), pc(c.firstHour), c.exitMix.map(e => `${e.exit} ${pc(e.share)}`).join(', ')]))
  L.push('MFE des perdants avant la sortie :', '')
  tbl(['MFE (R)', 'Perdants', 'Part des perdants', 'Part de la somme des pertes'], r.buckets.map(b => [!fin(b.lo) ? `< ${num(b.hi, 2)}` : !fin(b.hi) ? `≥ ${num(b.lo, 2)}` : `${num(b.lo, 2)} à ${num(b.hi, 2)}`, b.n, pc(b.share), pc(b.shareLoss)]))
  const w = r.winners
  L.push(`**Gagnants** (${w.n}) : ΣR ${num(w.sumR, 0)} R pour une somme de MFE de ${num(w.sumMfe, 0)} R ; taux de capture médian ${pc(w.captureMedian)} ; gain rendu total ${num(w.giveback, 0)} R (médiane ${num(w.givebackMedian)} R par trade). « Gros gain rendu » (MFE ≥ 2 R et R < 1 R) : ${w.bigGive} trades, ${num(w.bigGiveback, 0)} R rendus.`, '')
  L.push('**Stop au point mort après +1 R** (approximation de premier ordre, trade par trade) :', '')
  tbl(['', 'Valeur', 'IC 95 % (bootstrap par mois)'], [
    ['Trades ayant touché +1 R', `${r.cf.reached} (${pc(r.cf.reached / r.n)})`, ''],
    ['… puis revenus au prix d\'entrée avant la sortie', String(r.cf.beHit), ''],
    ['Perdants ramenés au point mort', String(r.cf.losersSaved), ''],
    ['Gagnants coupés au point mort (dont R ≥ 5)', `${r.cf.winnersCut} (${r.cf.bigWinnersCut})`, ''],
    ['R récupérés sur les perdants', sg(r.cf.gain, 0), `${sg(r.intervals.gain[0], 0)} à ${sg(r.intervals.gain[1], 0)}`],
    ['R perdus sur les gagnants', sg(r.cf.cost, 0), `${sg(r.intervals.cost[0], 0)} à ${sg(r.intervals.cost[1], 0)}`],
    ['Effet net', `${sg(r.cf.net, 0)} R (${pc(r.cf.net / r.cf.sumR, 1)} de ΣR)`, `${sg(r.intervals.net[0], 0)} à ${sg(r.intervals.net[1], 0)}`],
  ])
  L.push('Découpages (part de la somme des pertes par classe ; effet net du contrefactuel) :', '')
  for (const [dim, rows] of Object.entries(r.splits)) tbl([dim, 'Trades', 'Perdants', 'A', 'B', 'C', 'Contrefactuel net (R)', 'ΣR', 'Σ ln(1 + rendement du trade)'], rows.map(s => [s.key, s.n, s.losers, pc(s.A), pc(s.B), pc(s.C), sg(s.cfNet, 0), num(s.sumR, 0), pc(s.logRet, 0)]))
}
L.push('## Limites', '')
L.push('- MFE et MAE du moteur : extrêmes des bougies entières tant que la position est ouverte ; la partie de la bougie de sortie postérieure à l\'exécution n\'est pas comptée.')
L.push('- Contrefactuel : trajet intrabarre supposé du moteur, bougie de sortie réduite à son ouverture, aucune nouvelle entrée rejouée après une sortie plus précoce. Il ne remplace pas une simulation complète d\'une règle de sortie, qui exigerait un plan séparé et une extension du simulateur (le moteur ne connaît pas de stop au point mort).')
L.push('- BTC/ETH : données de développement. Aucun test prospectif.', '')
L.push('## Contrôles', '')
tbl(['Contrôle', 'Résultat', 'Détail'], checks.map(c => [c.name, c.ok ? 'OK' : '**ÉCHEC**', c.detail]))
L.push('## Reproduire', '', '```', 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/loss-anatomy.ts', '```', '')
writeFileSync(join(OUT, 'loss-anatomy.md'), L.join('\n'))
log('rapport')
