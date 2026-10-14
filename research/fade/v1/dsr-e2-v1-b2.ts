// Sharpe dégonflé (DSR) de E2, V1 et B2 (V1 + point mort dès +3 R), même méthode et mêmes comptes d'essais
// que research/preregistration/calm-only.md §5 (Bailey et López de Prado, 2014). Lecture seule.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/fade/v1/dsr-e2-v1-b2.ts
//
// Sortie : research/reports/shock-fade/dsr-e2-v1-b2.md

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as P from '../../lib/portfolio.ts'
import { M15, referenceAsset } from '../../lib/regime-er.ts'
import { dailyOf } from '../../lib/variant-eval.ts'
import { CALM_ONLY_REFERENCE, calmOnly } from '../../lib/calm-only.ts'
import { EULER, dsr, expectedMaxSharpe, moments, normInv, psr, sharpe } from '../../lib/overfit.ts'
import { simulate } from '../../../lib/strategies/shock/engine.ts'
import { simulateTrail } from './trail-sim.ts'
import type { TrailSpec } from './trail-broker.ts'

const ROOT = join(import.meta.dirname, '../../..')
const DAY = 864e5, ANNF = Math.sqrt(P.ANN)
const A = [referenceAsset('btc'), referenceAsset('ethusdt')]
const tStart = Math.max(...A.map(a => a.bars.t[a.lo])), tEnd = Math.min(...A.map(a => a.bars.t[a.end] + M15))
const PD0 = Math.ceil(tStart / DAY), PD1 = Math.floor(tEnd / DAY) - 1
const port = (runs: { equity: Float64Array }[]) => {
  const sl = A.map((a, j) => dailyOf(a.bars, runs[j].equity, a.lo, a.end, PD0, PD1))
  return P.book(sl[0].r, sl[1].r).r
}
const fail = (m: string) => { throw new Error(`contrôle en échec : ${m}`) }

// ---------------------------------------------------------------- séries journalières
const sigV1 = A.map(a => calmOnly(a.signals, a.select))
const E2 = port(A.map(a => simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, a.signals)))
const V1 = port(A.map((a, j) => simulate(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, sigV1[j])))
// 8 variantes de l'étude point mort / volume (research/preregistration/v1-be-volume.md), pour l'écart type des gains
const H2 = 2 * 3600e3, H4 = 4 * 3600e3
function flow(sym: string) {
  const buf = readFileSync(join(ROOT, `research/data/binance/fade/derived/taker15-${sym}.f64`))
  const x = new Float64Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const rows = x.length / 6, T0 = x[0], K = (x[(rows - 1) * 6] - T0) / M15 + 1
  const PV = new Float64Array(K + 1), PB = new Float64Array(K + 1), PN = new Float64Array(K + 1)
  const V = new Float64Array(K), Bv = new Float64Array(K), N = new Float64Array(K)
  for (let r = 0; r < rows; r++) { const k = (x[r * 6] - T0) / M15; V[k] = x[r * 6 + 1]; Bv[k] = x[r * 6 + 2]; N[k] = x[r * 6 + 3] }
  for (let k = 0; k < K; k++) { PV[k + 1] = PV[k] + V[k]; PB[k + 1] = PB[k] + Bv[k]; PN[k + 1] = PN[k] + N[k] }
  return (from: number, to: number) => {
    const k0 = (from - T0) / M15, k1 = (to - T0) / M15
    if (k0 < 0 || k1 > K || (PN[k1] - PN[k0]) / ((to - from) / 60000) < 0.9) return NaN
    const v = PV[k1] - PV[k0], b = PB[k1] - PB[k0]
    return v > 0 ? (2 * b - v) / v : NaN
  }
}
const FLOW = ['BTCUSDT', 'ETHUSDT'].map(flow)
const VARS: [string, (j: number) => TrailSpec][] = [
  ['B1', () => ({ kind: 'v1', beR: 2 })], ['B2', () => ({ kind: 'v1', beR: 3 })],
  ['V1', j => ({ kind: 'v1', early: { horizonMs: H2, imb: FLOW[j] } })], ['V2', j => ({ kind: 'v1', early: { horizonMs: H4, imb: FLOW[j] } })],
  ['V3', j => ({ kind: 'v1', early: { horizonMs: H2, imb: FLOW[j], gainBelowR: 0.5 } })], ['V4', j => ({ kind: 'v1', early: { horizonMs: H4, imb: FLOW[j], gainBelowR: 0.5 } })],
  ['C1', j => ({ kind: 'v1', beR: 3, early: { horizonMs: H2, imb: FLOW[j], gainBelowR: 0.5 } })], ['C2', j => ({ kind: 'v1', beR: 3, early: { horizonMs: H4, imb: FLOW[j], gainBelowR: 0.5 } })],
]
const VS = VARS.map(([, sp]) => port(A.map((a, j) => simulateTrail(a.m, a.preset.sets, a.costs(1), a.lo, a.end, a.select, sigV1[j], sp(j)))))
const B2 = VS[1]

// ---------------------------------------------------------------- contrôles
const ann = (x: number[]) => P.dailyMetrics(x, Array.from({ length: x.length }, (_, k) => PD0 + k)).sharpe
if (Math.abs(ann(E2) - CALM_ONLY_REFERENCE.e2.costs1.sharpe) > 1e-6) fail(`Sharpe E2 ${ann(E2)}`)
if (Math.abs(ann(V1) - CALM_ONLY_REFERENCE.portfolio.costs1.sharpe) > 1e-6) fail(`Sharpe V1 ${ann(V1)}`)
const BV = JSON.parse(readFileSync(join(ROOT, 'research/reports/shock-fade/v1-be-volume/results.json'), 'utf8'))
const b2ref = BV.configs.find((c: any) => c.id === 'B2').full.sharpe
if (Math.abs(ann(B2) - b2ref) > 1e-6) fail(`Sharpe B2 ${ann(B2)} ≠ ${b2ref}`)
const CO = JSON.parse(readFileSync(join(ROOT, 'research/reports/calm-only/calm-only.json'), 'utf8')).dsr
const sdA = CO.sdA / ANNF, sdB = CO.sdB / ANNF // écarts types des Sharpe des essais, ramenés au jour
if (Math.abs(dsr(V1, 222, sdB).p - CO.calm.B[1].p) > 1e-6 || Math.abs(dsr(E2, 222, sdB).p - CO.e2.B[1].p) > 1e-6) fail('DSR de calm-only non reproduit')
const dV1 = V1.map((x, t) => x - E2[t])
if (Math.abs(dsr(dV1, CO.diff.N, CO.diff.sdD / ANNF).p - CO.diff.p) > 1e-6) fail('DSR du gain V1 − E2 non reproduit')

// ---------------------------------------------------------------- calculs
const NS = [16, 222, 6266, 128547]
const NS_B2 = [16, 241, 6285, 128566] // + 11 trailings + 8 variantes point mort / volume
function breakeven(x: number[], sd: number) {
  const ok = (N: number) => dsr(x, N, sd).p >= 0.95
  if (!ok(1)) return 1
  let lo = 1, hi = 1e15
  if (ok(hi)) return Infinity
  for (let it = 0; it < 200; it++) { const mid = Math.sqrt(lo * hi); if (ok(mid)) lo = mid; else hi = mid }
  return hi
}
const abs = (id: string, x: number[]) => {
  const m = moments(x)
  return { id, T: x.length, sr: sharpe(x) * ANNF, skew: m.skew, kurt: m.kurt, psr0: psr(x, 0).p,
    A: dsr(x, 16, sdA), B: NS.map(N => ({ N, ...dsr(x, N, sdB) })), nStar: breakeven(x, sdB) }
}
const ABS = [abs('E2', E2), abs('V1', V1), abs('B2', B2)]
const B2upd = NS_B2.map(N => ({ N, ...dsr(B2, N, sdB) }))

const dB2 = B2.map((x, t) => x - V1[t])
const irs = VS.map(v => sharpe(v.map((x, t) => x - V1[t])))
const sdD8 = Math.sqrt(P.mean(irs.map(r => (r - P.mean(irs)) ** 2)))
const gain = (id: string, d: number[], N: number, sdD: number) => { const m = moments(d); return { id, N, sdD, ir: sharpe(d) * ANNF, skew: m.skew, kurt: m.kurt, psr0: psr(d, 0).p, ...dsr(d, N, sdD) } }
const GAIN = [gain('V1 − E2', dV1, CO.diff.N, CO.diff.sdD / ANNF), gain('B2 − V1', dB2, 8, sdD8)]

// Exemple détaillé : V1, N = 222, écart type B
const ex = (() => {
  const x = V1, N = 222, m = moments(x), sr = m.mean / m.sd
  const q1 = normInv(1 - 1 / N), q2 = normInv(1 - 1 / (N * Math.E))
  const sr0 = expectedMaxSharpe(N, sdB)
  const den = Math.sqrt(1 - m.skew * sr + ((m.kurt - 1) / 4) * sr * sr)
  const z = ((sr - sr0) * Math.sqrt(m.n - 1)) / den
  return { N, T: m.n, mean: m.mean, sd: m.sd, sr, skew: m.skew, kurt: m.kurt, q1, q2, sdB, sr0, den, z, p: dsr(x, N, sdB).p }
})()

// ---------------------------------------------------------------- rapport
const fr = (s: string) => s.replace(/(\d)\.(\d)/g, '$1,$2')
const n = (x: number, d = 2) => (Number.isFinite(x) ? fr((x < 0 ? '−' : '') + Math.abs(x).toFixed(d)) : x === Infinity ? '> 10¹⁵' : '—')
const pc = (x: number, d = 1) => fr((100 * x).toFixed(d)) + ' %'
const big = (x: number) => x.toLocaleString('fr-FR').replace(/ | /g, ' ')
const L: string[] = []
L.push('# Sharpe dégonflé (DSR) de E2, V1 et B2', '',
  'Méthode et comptes d\'essais pré-enregistrés dans `research/preregistration/calm-only.md` §5, appliqués à l\'identique aux trois stratégies. '
  + 'Généré par `research/fade/v1/dsr-e2-v1-b2.ts`, en lecture seule. Portefeuille BTC/ETH 50/50, rendements journaliers du '
  + `${P.isoDay(PD0)} au ${P.isoDay(PD1)} (${E2.length} jours), commissions de la fiche. B2 = V1 + point mort dès +3 R (`
  + '`research/reports/shock-fade/v1-be-volume/`).', '',
  '**Scénario conservateur initial.** La réévaluation méthodologique (essais réellement en concurrence, corrélations, critère de sélection) est dans `research/reports/shock-fade/dsr-reeval/`.', '',
  'Contrôles : Sharpe de E2, V1 et B2 identiques aux références publiées ; DSR de E2 et de V1 et DSR du gain V1 − E2 identiques à `research/reports/calm-only/` (écart < 10⁻⁶).', '',
  '## 1. Sharpe absolu', '',
  `Écart type des Sharpe des essais (annualisé) : univers A (16 variantes proches de E2) ${n(CO.sdA, 3)} ; univers B (206 candidats de la recherche des réglages) ${n(CO.sdB, 3)}. `
  + 'Le seuil SR₀ est le Sharpe maximal attendu de N essais sans talent ; DSR = P(vrai Sharpe > SR₀).', '',
  `| stratégie | Sharpe | asymétrie / kurtosis | PSR(0) | DSR, N = 16 (A) | ${NS.map(N => `DSR, N = ${big(N)} (B)`).join(' | ')} | N* où DSR < 95 % (B) |`,
  `|---|---:|---:|---:|---:|${NS.map(() => '---:').join('|')}|---:|`,
  ...ABS.map(r => `| ${r.id} | ${n(r.sr)} | ${n(r.skew)} / ${n(r.kurt, 1)} | ${pc(r.psr0, 2)} | ${pc(r.A.p)} (seuil ${n(r.A.sr0 * ANNF)}) | `
    + `${r.B.map(b => `${pc(b.p)} (seuil ${n(b.sr0 * ANNF)})`).join(' | ')} | ${n(r.nStar, 0)} |`),
  `| B2, N à jour (+ 19 essais) | | | | | ${B2upd.map(b => `${pc(b.p)} à N = ${big(b.N)}`).join(' | ')} | |`, '',
  'N = 16 : univers A ; 222 : A + les 206 candidats ; 6 266 : toutes les configurations distinctes évaluées dans la lignée ; '
  + '128 547 : borne extrême (3 graines × 207 × 207 paires de réglages). Pour B2, la ligne « à jour » ajoute les 11 trailings et les 8 variantes point mort / volume.', '',
  '## 2. Gain d\'une étape sur la précédente', '',
  'Série d_t = r_t(stratégie) − r_t(précédente). N = nombre d\'alternatives essayées contre la précédente ; écart type = dispersion des ratios d\'information de ces alternatives.', '',
  '| gain | ratio d\'information | asymétrie / kurtosis | PSR(0) | N | écart type des essais | seuil | DSR |',
  '|---|---:|---:|---:|---:|---:|---:|---:|',
  ...GAIN.map(g => `| ${g.id} | ${n(g.ir, 3)} | ${n(g.skew)} / ${n(g.kurt, 1)} | ${pc(g.psr0)} | ${g.N} | ${n(g.sdD * ANNF, 3)} | ${n(g.sr0 * ANNF, 3)} | **${pc(g.p)}** |`), '',
  `Ratios d'information des 8 variantes contre V1 : ${VARS.map(([id], k) => `${id} ${n(irs[k] * ANNF)}`).join(', ')}.`, '',
  '## 3. Calcul, exemple : V1, N = 222, univers B', '',
  `1. Rendements journaliers du portefeuille : T = ${ex.T} jours, moyenne ${n(ex.mean, 6)}, écart type ${n(ex.sd, 5)}. `
  + `Sharpe journalier SR = ${n(ex.sr, 5)} (× √365,25 = ${n(ex.sr * ANNF, 4)}). Asymétrie γ₃ = ${n(ex.skew, 3)}, kurtosis γ₄ = ${n(ex.kurt, 2)} (3 pour une loi normale).`,
  `2. Écart type des Sharpe journaliers des essais : σ = ${n(CO.sdB, 4)} / √365,25 = ${n(ex.sdB, 5)}.`,
  `3. Maximum attendu de N Sharpe nuls : SR₀ = σ · [(1 − γ) Φ⁻¹(1 − 1/N) + γ Φ⁻¹(1 − 1/(N e))], γ = ${n(EULER, 4)} (Euler-Mascheroni). `
  + `Φ⁻¹(1 − 1/${ex.N}) = ${n(ex.q1, 4)}, Φ⁻¹(1 − 1/(${ex.N} e)) = ${n(ex.q2, 4)} → SR₀ = ${n(ex.sr0, 5)} par jour (${n(ex.sr0 * ANNF, 3)} annualisé).`,
  `4. Statistique : z = (SR − SR₀) √(T − 1) / √(1 − γ₃ SR + (γ₄ − 1)/4 · SR²) = (${n(ex.sr, 5)} − ${n(ex.sr0, 5)}) × √${ex.T - 1} / ${n(ex.den, 4)} = ${n(ex.z, 3)}.`,
  `5. DSR = Φ(z) = **${pc(ex.p)}**. PSR(0) est le même calcul avec SR₀ = 0.`, '',
  '## 4. Lecture', '',
  `- **Sharpe absolu.** Les trois passent largement contre l'univers A et contre la dispersion B à N = 16. À N = 222 (la lignée connue), E2 ${pc(ABS[0].B[1].p)}, V1 ${pc(ABS[1].B[1].p)}, B2 ${pc(ABS[2].B[1].p)} : aucune n'atteint 95 %. `
  + `Le DSR passe sous 95 % au-delà de N* ≈ ${n(ABS[0].nStar, 0)} essais pour E2, ${n(ABS[1].nStar, 0)} pour V1, ${n(ABS[2].nStar, 0)} pour B2. Avec 6 266 configurations, aucun Sharpe historique ne résiste.`,
  `- **Gains.** V1 sur E2 : DSR ${pc(GAIN[0].p)} ; B2 sur V1 : DSR ${pc(GAIN[1].p)}. Ni l'un ni l'autre n'atteint 95 % une fois compté le nombre d'alternatives essayées. `
  + `Pris seul, le gain de B2 est net (PSR(0) ${pc(GAIN[1].psr0)}, comme le bootstrap de l'étude : p Holm 0,008) ; c'est le seuil des 8 essais (${n(GAIN[1].sr0 * ANNF, 2)} de ratio d'information) qui le ramène à ${pc(GAIN[1].p)}. `
  + 'Ce seuil est sévère : la dispersion des 8 variantes vient surtout de vraies différences (les règles de volume sont nettement perdantes), pas seulement du hasard. '
  + `La série d'écart est concentrée sur quelques jours (kurtosis ${n(GAIN[1].kurt, 0)}), ce qui élargit aussi l'incertitude.`,
  '- **Sévérité.** L\'écart type B mêle bruit et vraies différences entre réglages (candidats en moyenne perdants) : il rend le DSR sévère. Les 16 variantes de l\'univers A, très corrélées, donnent un N effectif plus faible que 16. Les réglages ont été choisis sur BTC seul. Seule une validation prospective tranchera.', '')
writeFileSync(join(ROOT, 'research/reports/shock-fade/dsr-e2-v1-b2.md'), L.join('\n'))
console.log(ABS.map(r => `${r.id} ${r.B.map(b => (100 * b.p).toFixed(1)).join('/')}`).join(' ; '), '·', GAIN.map(g => `${g.id} ${(100 * g.p).toFixed(1)} %`).join(' ; '))
