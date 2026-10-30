// Étude d'événements contrarienne sur tous les chocs détectés (research/preregistration/fade-events.md).
//
//   node --max-old-space-size=12288 --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/fade-events.ts
//
// R_fade(h) = −s · ln(P_{t+h} / P_t) après chaque choc du détecteur du moteur, sans filtre a posteriori,
// par rejet (mèche, sans cassure, cassure propre), régime et liquidité (Amihud), h = 1 … 16 bougies.
// Entrée exécutable sur les perpétuels Binance à la minute (BTC, ETH, 2020+). Module de recherche :
// rien n'est modifié dans Shock Engine ni branché sur une décision. Sorties : research/reports/fade-events/.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as P from '../lib/portfolio.ts'
import { M15, UNSEEN, referenceAsset, unseenAsset } from '../lib/regime-er.ts'
import type { Asset } from '../lib/regime-er.ts'
import { MIN, T0, loadMinutes } from '../capacity/binance.ts'
import { KLINES_TO } from '../capacity/data.ts'
import { prepare } from '../../lib/strategies/shock/market.ts'
import { highest, lowest } from '../../lib/backtest/indicators.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/fade-events')
const H = [1, 2, 4, 8, 16] as const
const HURDLE = 10, HURDLES = [5, 10, 20]
const BOOT = 5000, SEED = 20261015
const AMIHUD_WIN = 2880
const EXEC_FROM = Date.UTC(2020, 0, 1)
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) throw new Error(`${name} : ${detail}`) }

type Rej = 'wick' | 'inside' | 'break'
interface Ev {
  asset: string; i: number; t: number; month: number; s: 1 | -1; regime: 0 | 1; rej: Rej; liq: 0 | 1 | 2 | -1; volZ: number
  first: boolean
  /** R_fade(h) en pb, NaN si les bougies ne sont pas contiguës. */
  R: number[]
  /** Perpétuel Binance, mêmes chocs : depuis la clôture (Rb) et depuis T + 1 min (Rx), en pb ; NaN hors 2020+. */
  Rb: number[]
  Rx: number[]
}

// ================================================================ événements d'un actif
interface Minutes { c: Float64Array; n: number }
function events(a: Asset, universe: 'engine' | 'fixed', mins: Minutes | null): Ev[] {
  const b = a.bars, n = b.n, { o, h, l, c, v, t } = b
  const sets: ShockParams[] = universe === 'engine' ? a.preset.sets : [{ ...a.preset.sets[0], kMain: 2.5, volWin: 130, useMicroShock: false }]
  const prs = sets.map(p => prepare(a.m, p))
  const hh = sets.map(p => highest(h, p.rangeWin)), ll = sets.map(p => lowest(l, p.rangeWin))
  const amihud = new Float64Array(n).fill(NaN)
  for (let i = 1; i < n; i++) { const dv = v[i] * c[i]; if (dv > 0) amihud[i] = Math.abs(Math.log(c[i] / c[i - 1])) / dv }
  const out: Ev[] = []
  let lastShock = -Infinity
  for (let i = Math.max(a.lo, 1); i <= a.end; i++) {
    if (a.select[i] < 0 || t[i] - t[i - 1] > M15) continue
    const e = universe === 'engine' ? (a.select[i] as 0 | 1) : 0
    // Détecteur du moteur (lib/strategies/shock/market.ts, `shock`) : |z| > kMain, ou > kMicro effectif si micro-chocs.
    const p0 = sets[e], za = Math.abs(prs[e].z[i]), kMicro = p0.highActivityMode ? Math.max(p0.kMicro - 0.2, 0.8) : p0.kMicro
    if (!(za > p0.kMain || (p0.useMicroShock && za > kMicro))) continue
    const r = Math.log(c[i] / c[i - 1])
    if (r === 0) continue
    const s = r > 0 ? 1 : -1
    const p = sets[e]
    const rng = Math.max(h[i] - l[i], a.m.mintick)
    const wick = s === 1 ? (h[i] - Math.max(o[i], c[i])) / rng : (Math.min(o[i], c[i]) - l[i]) / rng
    const brk = s === 1 ? c[i] > hh[e][i - 1] : c[i] < ll[e][i - 1]
    const rej: Rej = wick >= p.wickThr ? 'wick' : brk ? 'break' : 'inside'
    // Rang centile de l'illiquidité parmi les 30 jours précédents (causal).
    let liq: 0 | 1 | 2 | -1 = -1
    if (Number.isFinite(amihud[i])) {
      let below = 0, cnt = 0
      for (let k = Math.max(1, i - AMIHUD_WIN); k < i; k++) { const x = amihud[k]; if (!Number.isFinite(x)) continue; cnt++; if (x < amihud[i]) below++ }
      if (cnt >= AMIHUD_WIN / 2) { const q = below / cnt; liq = q < 1 / 3 ? 0 : q < 2 / 3 ? 1 : 2 }
    }
    const R = H.map(k => (i + k <= a.end && t[i + k] - t[i] === k * M15 ? -s * Math.log(c[i + k] / c[i]) * 1e4 : NaN))
    const Rb = H.map(() => NaN), Rx = H.map(() => NaN)
    const tc = t[i] + M15
    if (mins && tc >= EXEC_FROM) {
      const k0 = Math.round((tc - T0) / MIN)
      const px = (k: number) => (k >= 0 && k < mins.n && Number.isFinite(mins.c[k]) && mins.c[k] > 0 ? mins.c[k] : NaN)
      const pClose = px(k0 - 1), pEntry = px(k0)
      H.forEach((k, j) => { const pe = px(k0 + 15 * k - 1); Rb[j] = -s * Math.log(pe / pClose) * 1e4; Rx[j] = -s * Math.log(pe / pEntry) * 1e4 })
    }
    out.push({ asset: a.key, i, t: t[i], month: P.monthKey(Math.floor(t[i] / 864e5)), s, regime: (a.select[i] as 0 | 1), rej, liq, volZ: prs[e].volZ[i], first: i - lastShock > 16, R, Rb, Rx })
    lastShock = i
  }
  return out
}

// ================================================================ statistiques (bootstrap par mois)
const months = (evs: Ev[]) => [...new Set(evs.map(e => e.month))].sort((x, y) => x - y)
interface Stat { n: number; mean: number; median: number; pos: number; lo: number; hi: number; pGt: number }
/** Moyenne de f(e) (valeurs finies), IC 95 % et p unilatéral de « moyenne > seuil » par bootstrap des mois. */
function stat(evs: Ev[], f: (e: Ev) => number, seed: number, thr = 0): Stat {
  const xs = evs.map(e => ({ m: e.month, x: f(e) })).filter(z => Number.isFinite(z.x))
  if (xs.length < 2) return { n: xs.length, mean: NaN, median: NaN, pos: NaN, lo: NaN, hi: NaN, pGt: NaN }
  const ms = [...new Set(xs.map(z => z.m))].sort((x, y) => x - y)
  const idx = new Map(ms.map((m, j) => [m, j]))
  const S = new Float64Array(ms.length), C = new Float64Array(ms.length)
  for (const z of xs) { const j = idx.get(z.m)!; S[j] += z.x; C[j]++ }
  const R = P.rng(seed), draws: number[] = []
  for (let b = 0; b < BOOT; b++) { let s = 0, c = 0; for (let k = 0; k < ms.length; k++) { const j = Math.floor(R() * ms.length); s += S[j]; c += C[j] } draws.push(s / c) }
  const vals = xs.map(z => z.x)
  return { n: xs.length, mean: P.mean(vals), median: P.quantile(vals, 0.5), pos: vals.filter(x => x > 0).length / vals.length, lo: P.quantile(draws, 0.025), hi: P.quantile(draws, 0.975), pGt: draws.filter(d => d <= thr).length / BOOT }
}
/** Écart de moyennes entre deux groupes, mêmes mois tirés ; p unilatéral de « A > B ». */
function diffStat(A: Ev[], B: Ev[], f: (e: Ev) => number, seed: number) {
  const ms = months([...A, ...B]), idx = new Map(ms.map((m, j) => [m, j]))
  const agg = (evs: Ev[]) => { const S = new Float64Array(ms.length), C = new Float64Array(ms.length); for (const e of evs) { const x = f(e); if (!Number.isFinite(x)) continue; const j = idx.get(e.month)!; S[j] += x; C[j]++ } return { S, C } }
  const a = agg(A), b = agg(B), R = P.rng(seed), draws: number[] = []
  for (let k = 0; k < BOOT; k++) { let sa = 0, ca = 0, sb = 0, cb = 0; for (let q = 0; q < ms.length; q++) { const j = Math.floor(R() * ms.length); sa += a.S[j]; ca += a.C[j]; sb += b.S[j]; cb += b.C[j] } draws.push(sa / ca - sb / cb) }
  const m = (evs: Ev[]) => P.mean(evs.map(f).filter(Number.isFinite))
  return { diff: m(A) - m(B), lo: P.quantile(draws, 0.025), hi: P.quantile(draws, 0.975), pGt: draws.filter(d => d <= 0).length / BOOT }
}
/** Holm : rejet de H0 aux horizons dont le p ajusté < alpha. */
function holm(ps: number[], alpha = 0.05) {
  const order = ps.map((p, j) => ({ p, j })).sort((x, y) => x.p - y.p)
  const rej = ps.map(() => false)
  for (let k = 0; k < order.length; k++) { if (order[k].p <= alpha / (order.length - k)) rej[order[k].j] = true; else break }
  return rej
}

// ================================================================ données
const BTC = referenceAsset('btc'), ETH = referenceAsset('ethusdt')
const UN = UNSEEN.map(unseenAsset)
log('actifs chargés')
const MINS: Record<string, Minutes> = {}
for (const [k, sym] of [['BTC', 'BTCUSDT'], ['ETH', 'ETHUSDT']] as const) { const { m } = await loadMinutes(sym, KLINES_TO); MINS[k] = m }
log('minutes Binance chargées')
const EV = {
  engine: { dev: [...events(BTC, 'engine', MINS.BTC), ...events(ETH, 'engine', MINS.ETH)], rep: UN.flatMap(a => events(a, 'engine', null)) },
  fixed: { dev: [...events(BTC, 'fixed', null), ...events(ETH, 'fixed', null)], rep: UN.flatMap(a => events(a, 'fixed', null)) },
}
log(`chocs : développement ${EV.engine.dev.length}, réplication ${EV.engine.rep.length}`)
// Contrôle : le détecteur recalculé redonne les chocs principaux du moteur (|z| > kMain) aux mêmes bougies.
for (const a of [BTC, ETH]) {
  const pr = prepare(a.m, a.preset.sets[0])
  let diff = 0
  for (let i = a.lo; i <= a.end; i++) if ((Math.abs(pr.z[i]) > a.preset.sets[0].kMain ? 1 : 0) !== pr.mainShock[i]) diff++
  check(`${a.key} : détecteur recalculé = mainShock du moteur`, diff === 0, `${diff} écarts`)
}
check('chocs en nombre suffisant', EV.engine.dev.length > 500 && EV.engine.rep.length > 500, `${EV.engine.dev.length} · ${EV.engine.rep.length}`)
const execN = EV.engine.dev.filter(e => Number.isFinite(e.Rx[0])).length
check('prix Binance trouvés pour les chocs de 2020+', execN > 0.95 * EV.engine.dev.filter(e => e.t + M15 >= EXEC_FROM && e.t + M15 + 16 * M15 < KLINES_TO).length, `${execN}`)

// ================================================================ hypothèses
const byH = (evs: Ev[], f: (e: Ev, j: number) => number, seed: number, thr = 0) => H.map((_, j) => stat(evs, e => f(e, j), seed + j, thr))
const fade = (e: Ev, j: number) => e.R[j]
const wick = (evs: Ev[]) => evs.filter(e => e.rej === 'wick')
const HA = byH(EV.engine.dev, fade, SEED)
const HArej = holm(HA.map(s => s.pGt))
const HB = byH(wick(EV.engine.dev), fade, SEED + 10, HURDLE)
const HBrej = holm(HB.map(s => s.pGt))
const HBrep = byH(wick(EV.engine.rep), fade, SEED + 20, HURDLE)
const HBpass = H.map((_, j) => HBrej[j] && HBrep[j].mean - HURDLE > 0 && HBrep[j].pGt < 0.05)
const jC = HBpass.some(Boolean) ? HB.map((s, j) => (HBpass[j] ? s.mean : -Infinity)).reduce((bj, x, j, arr) => (x > arr[bj] ? j : bj), 0) : H.indexOf(4)
const liqOf = (evs: Ev[], q: number) => wick(evs).filter(e => e.liq === q)
const HC = { dev: diffStat(liqOf(EV.engine.dev, 2), liqOf(EV.engine.dev, 0), e => e.R[jC], SEED + 30), rep: diffStat(liqOf(EV.engine.rep, 2), liqOf(EV.engine.rep, 0), e => e.R[jC], SEED + 31) }
const HCpass = HC.dev.pGt < 0.05 && HC.rep.diff > 0
const devWickExec = wick(EV.engine.dev).filter(e => Number.isFinite(e.Rx[0]))
const EXEC = H.map((_, j) => ({ close: stat(devWickExec, e => e.Rb[j], SEED + 40 + j), exec: stat(devWickExec, e => e.Rx[j], SEED + 50 + j, HURDLE) }))
const execPass = H.map((_, j) => HBpass[j] && EXEC[j].exec.mean - HURDLE > 0 && EXEC[j].exec.pGt < 0.05)
const verdict = execPass.some(Boolean) ? 'exploitable' : 'not-demonstrated'
log('hypothèses')

// ================================================================ tableaux descriptifs
const REJ: Rej[] = ['wick', 'inside', 'break']
const REJ_LABEL: Record<Rej, string> = { wick: 'rejet par mèche', inside: 'sans cassure du range', break: 'cassure propre' }
const cells = (evs: Ev[], seed: number) => ({
  all: byH(evs, fade, seed),
  rej: Object.fromEntries(REJ.map((r, k) => [r, byH(evs.filter(e => e.rej === r), fade, seed + 100 * (k + 1))])),
  regime: Object.fromEntries([0, 1].map(g => [g, Object.fromEntries(REJ.map((r, k) => [r, byH(evs.filter(e => e.regime === g && e.rej === r), fade, seed + 1000 * (g + 1) + 100 * k)]))])),
  liq: Object.fromEntries([0, 1, 2].map(q => [q, byH(wick(evs).filter(e => e.liq === q), fade, seed + 5000 + 100 * q)])),
  volume: Object.fromEntries([['low', (e: Ev) => e.volZ < 0], ['high', (e: Ev) => e.volZ >= 0]].map(([k, f], q) => [k, byH(wick(evs).filter(f as (e: Ev) => boolean), fade, seed + 7000 + 100 * q)])),
  firstOnly: byH(wick(evs).filter(e => e.first), fade, seed + 9000),
})
const DESC = { dev: cells(EV.engine.dev, SEED + 100000), rep: cells(EV.engine.rep, SEED + 200000), fixedDev: { wick: byH(wick(EV.fixed.dev), fade, SEED + 300000), all: byH(EV.fixed.dev, fade, SEED + 300500) }, fixedRep: { wick: byH(wick(EV.fixed.rep), fade, SEED + 400000), all: byH(EV.fixed.rep, fade, SEED + 400500) } }
const counts = Object.fromEntries([BTC, ETH, ...UN].map(a => { const evs = [...EV.engine.dev, ...EV.engine.rep].filter(e => e.asset === a.key); return [a.key, { all: evs.length, wick: evs.filter(e => e.rej === 'wick').length, inside: evs.filter(e => e.rej === 'inside').length, break: evs.filter(e => e.rej === 'break').length, agitated: evs.filter(e => e.regime === 1).length }] }))
log('descriptif')

// ================================================================ rapport
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'fade-events.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/fade-events.md', horizonsBars: H, hurdleBps: HURDLE, counts, HA: { stats: HA, holm: HArej }, HB: { dev: HB, holm: HBrej, rep: HBrep, pass: HBpass }, HC: { horizonBars: H[jC], ...HC, pass: HCpass }, exec: { n: devWickExec.length, byH: EXEC, pass: execPass }, verdict, descriptive: DESC, checks }, null, 1) + '\n')

const b1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1).replace('.', ',').replace('-', '−') : '—')
const pv = (p: number) => (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ','))
const hHead = H.map(k => `h = ${k} (${k * 15 >= 60 ? `${k / 4} h` : `${k * 15} min`})`)
const L: string[] = []
const tbl = (rows: [string, Stat[]][]) => { L.push(`| | ${hHead.join(' | ')} |`, `|---|${H.map(() => '---:').join('|')}|`); for (const [name, ss] of rows) L.push(`| ${name} | ${ss.map(s => (s.n ? `${b1(s.mean)} [${b1(s.lo)} ; ${b1(s.hi)}] · n ${s.n}` : '—')).join(' | ')} |`); L.push('') }
L.push('# Étude d\'événements contrarienne (« fade ») sur tous les chocs détectés', '')
L.push('Protocole : `research/preregistration/fade-events.md` (commité avant calcul). R_fade(h) = −s · ln(P_{t+h}/P_t) en points de base (pb), après chaque choc du détecteur du moteur (régime en vigueur), sans filtre a posteriori. Moyenne [IC 95 % par bootstrap des mois] · nombre de chocs. Seuil de coût aller-retour : 10 pb. Module de recherche : aucune règle de Shock Engine n\'est modifiée.', '')
L.push('## Chocs', '', '| Actif | tous | rejet par mèche | sans cassure | cassure propre | en régime agité |', '|---|---:|---:|---:|---:|---:|')
for (const [k, c] of Object.entries(counts)) L.push(`| ${k} | ${c.all} | ${c.wick} | ${c.inside} | ${c.break} | ${c.agitated} |`)
L.push('', 'Développement : BTC + ETH. Réplication : les 8 cryptos, mises en commun.', '')
L.push('## H_A — tous les chocs : le mouvement opposé a-t-il une espérance positive ?', '')
tbl([['BTC + ETH', HA], ['8 cryptos', DESC.rep.all]])
L.push(`p unilatéral (moyenne > 0), BTC + ETH : ${HA.map((s, j) => `${H[j]} : ${pv(s.pGt)}${HArej[j] ? ' (Holm : oui)' : ''}`).join(' · ')}.`, '')
L.push('## H_B — chocs rejetés par une mèche : l\'espérance dépasse-t-elle 10 pb ?', '')
tbl([['BTC + ETH', HB], ['8 cryptos (réplication)', HBrep]])
L.push(`p unilatéral (moyenne > 10 pb) : BTC + ETH ${HB.map((s, j) => `${H[j]} : ${pv(s.pGt)}${HBrej[j] ? ' (Holm : oui)' : ''}`).join(' · ')} ; 8 cryptos ${HBrep.map((s, j) => `${H[j]} : ${pv(s.pGt)}`).join(' · ')}. Horizons qui passent et se répliquent : ${HBpass.some(Boolean) ? H.filter((_, j) => HBpass[j]).join(', ') : 'aucun'}.`, '')
L.push('## Par type de choc (rejet, sans cassure, cassure propre)', '')
L.push('BTC + ETH :', ''); tbl(REJ.map(r => [REJ_LABEL[r], DESC.dev.rej[r]]))
L.push('8 cryptos :', ''); tbl(REJ.map(r => [REJ_LABEL[r], DESC.rep.rej[r]]))
L.push('## Par régime de volatilité (BTC + ETH)', '')
tbl([0, 1].flatMap(g => REJ.map(r => [`${g ? 'agité' : 'calme'} · ${REJ_LABEL[r]}`, DESC.dev.regime[g][r]] as [string, Stat[]])))
L.push(`## H_C — liquidité : chocs rejetés, par tercile d'illiquidité d'Amihud`, '')
L.push('BTC + ETH :', ''); tbl([0, 1, 2].map(q => [['liquide (bas)', 'moyen', 'illiquide (haut)'][q], DESC.dev.liq[q]]))
L.push('8 cryptos :', ''); tbl([0, 1, 2].map(q => [['liquide (bas)', 'moyen', 'illiquide (haut)'][q], DESC.rep.liq[q]]))
L.push(`Écart haut − bas à h = ${H[jC]} : BTC + ETH ${b1(HC.dev.diff)} pb [${b1(HC.dev.lo)} ; ${b1(HC.dev.hi)}], p ${pv(HC.dev.pGt)} ; 8 cryptos ${b1(HC.rep.diff)} pb. H_C ${HCpass ? 'confirmée' : 'non confirmée'}.`, '')
L.push('Volume du choc (z-score du moteur), chocs rejetés, BTC + ETH :', ''); tbl([['volume faible (z < 0)', DESC.dev.volume.low], ['volume élevé (z ≥ 0)', DESC.dev.volume.high]])
L.push('## Entrée réellement exécutable (perpétuels Binance, BTC + ETH, 2020+, chocs rejetés)', '')
tbl([['depuis la clôture du choc', EXEC.map(x => x.close)], ['entrée à T + 1 min', EXEC.map(x => x.exec)]])
L.push(`${devWickExec.length} chocs rejetés avec prix Binance. Nets du seuil de 10 pb à T + 1 min : ${EXEC.map((x, j) => `${H[j]} : ${b1(x.exec.mean - HURDLE)}`).join(' · ')} pb.`, '')
L.push('## Robustesse (chocs rejetés)', '')
tbl([['premier choc de chaque grappe, BTC + ETH', DESC.dev.firstOnly], ['premier choc de chaque grappe, 8 cryptos', DESC.rep.firstOnly], ['seuil unique |z| > 2,5, BTC + ETH', DESC.fixedDev.wick], ['seuil unique |z| > 2,5, 8 cryptos', DESC.fixedRep.wick]])
L.push('## Verdict (règle fixée avant calcul)', '')
L.push(verdict === 'exploitable'
  ? `**Avantage contrarien exploitable** aux horizons ${H.filter((_, j) => execPass[j]).join(', ')} : H_B passe, se réplique et survit à l'entrée exécutable. Résultat historique, à suivre dans un module distinct, désactivé.`
  : `**Pas d'avantage contrarien exploitable démontré.** ${HBpass.some(Boolean) ? 'H_B passe et se réplique, mais ne survit pas à l\'entrée exécutable nette de 10 pb.' : 'Aucun horizon ne passe H_B avec sa réplication : sur les chocs rejetés, le rendement contrarien ne dépasse pas de façon fiable le coût aller-retour.'}`, '')
L.push('## Contrôles', '')
for (const c of checks) L.push(`- ${c.ok ? 'OK' : 'ÉCHEC'} — ${c.name} : ${c.detail}`)
writeFileSync(join(OUT, 'fade-events.md'), L.join('\n') + '\n')
log(`écrit research/reports/fade-events/ · verdict ${verdict}`)
