// Couche probabiliste · rapport HTML (français). Ne ré-estime rien : met en page le jeu de données, le
// walk-forward, l'évaluation, le modèle figé, le contrôle positif et les fiches produits par run.ts.

import { HORIZONS, MODEL_FEATURES, PREREG, PROBA_VERSION, REFERENCE, WALK, LAMBDAS, BOOT, FROZEN_BOOT, EPV_MIN, CALIBRATION, PROSPECTIVE_MIN } from './config.ts'
import type { Dataset, TradeRow } from './dataset.ts'
import type { WalkForward } from './walkforward.ts'
import { BINARY_TARGETS } from './walkforward.ts'
import type { Evaluation } from './evaluate.ts'
import type { FrozenModel } from './frozen.ts'
import type { CardInput } from './card.ts'
import { cardBody, CARD_CSS } from './card.ts'
import * as M from './metrics.ts'
import { histPanel, columns, calibPlot, forest, coefPanels, dayLine, fmtPct, fmtNum, fr } from './charts.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

export interface ReportInput {
  ds: Dataset
  wf: WalkForward
  ev: Evaluation
  model: FrozenModel
  sha: string
  cards: CardInput[]
  control: Any[]
  inSample: Any
  timings?: Record<string, number>
}

const MINUS = '−'
const fin = (x: number) => typeof x === 'number' && Number.isFinite(x)
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const pct = (x: number, d = 1) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)} %`) : '—')
const num = (x: number, d = 2) => (fin(x) ? fr(`${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const sgn = (x: number, d = 2) => (fin(x) ? fr(`${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}`) : '—')
const rr = (x: number, d = 2) => (fin(x) ? `${sgn(x, d)} R` : '—')
const int = (x: number) => (fin(x) ? Math.round(x).toLocaleString('fr-FR').replace(/ | /g, ' ') : '—')
const ci = (lo: number, hi: number, d = 4, f = sgn) => `[${f(lo, d)} ; ${f(hi, d)}]`
const pv = (p: number) => (fin(p) ? (p < 0.001 ? '< 0,001' : p.toFixed(3).replace('.', ',')) : '—')
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
const quarter = (ms: number) => { const d = new Date(ms); return `${d.getUTCFullYear()} T${Math.floor(d.getUTCMonth() / 3) + 1}` }

function table(head: string[], rows: (string | number)[][], o: { cls?: string; caption?: string } = {}) {
  return `<div class="tw"><table class="${o.cls ?? ''}">${o.caption ? `<caption>${o.caption}</caption>` : ''}<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}
const section = (id: string, n: string, title: string, body: string) => `<section id="${id}"><h2><span class="sn">${n}</span>${title}</h2>${body}</section>`
const note = (s: string) => `<p class="note">${s}</p>`
const yes = (b: boolean, t = 'oui', f = 'non') => (b ? `<span class="ok">${t}</span>` : `<span class="ko0">${f}</span>`)

const MODEL_LABEL: Record<string, string> = { naive: 'naïf', context: 'contexte (3)', reduced: 'réduit (3)', full: 'complet (11)', cal: 'complet calibré' }
const ER_LABEL: Record<string, string> = { naive: 'naïf (moyenne)', ridge: 'ridge', decompConst: 'décomposition, moyennes constantes', decompRidge: 'décomposition, ridge' }
const TARGET_LABEL: Record<string, string> = Object.fromEntries(BINARY_TARGETS.map(t => [t.key, t.label]))
const H_LABEL: Record<number, string> = { 1: '15 min', 4: '1 h', 16: '4 h', 64: '16 h' }
/** Libellés des tests en français (les clés des modèles viennent d'evaluate.ts). */
const testFr = (t: string) => t.replace('decompConst', 'décomposition (moyennes constantes)').replace('decompRidge', 'décomposition (ridge)').replace(' reduced ', ' réduit ').replace(' full ', ' complet ').replace(/continuation (\d+) bougies? : complet contre naïf/, (_, h) => `continuation ${H_LABEL[+h]} : complet contre naïf`)

const monotone = (xs: number[]) => xs.every((v, i) => i === 0 || v >= xs[i - 1])
function quant(xs: number[], qs: number[]) { const s = xs.filter(Number.isFinite).sort((a, b) => a - b); return qs.map(q => M.percentile(s, q)) }

export function renderReport(I: ReportInput): string {
  const { ds, wf, ev, model } = I
  const rows = ds.rows
  const P = wf.preds
  const prob = (t: string, m: string) => ev.prob.find(e => e.target === t && e.model === m)!
  const erE = (m: string) => ev.er.find(e => e.model === m)!
  const winFull = prob('win', 'full')
  const ridge = erE('ridge')
  const anySec = ev.secondary.some(s => s.demonstrated)
  const verdictYes = ev.primary.demonstrated || anySec
  const pc = I.control
  const pcAt = (b: number) => pc.find((c: Any) => c.beta === b)
  const nOOS = ev.n

  // ---------------------------------------------------------------- résumé
  const tiles: [string, string, string][] = [
    ['P(gain) : Δ log-loss vs naïf', sgn(winFull.dLogLoss.est, 4), `IC 95 % ${ci(winFull.dLogLoss.lo, winFull.dLogLoss.hi)} · p = ${pv(winFull.dLogLoss.p)}`],
    ['P(gain) : AUC hors entraînement', num(winFull.auc, 3), `IC 95 % [${num(winFull.aucCI.lo, 3)} ; ${num(winFull.aucCI.hi, 3)}] · 0,5 = hasard`],
    ['E[R] ridge : R² hors entraînement', pct(ridge.r2, 1), `Δ MSE ${ci(ridge.dMse.lo, ridge.dMse.hi, 3)} · Spearman ${num(ridge.spearman, 3)}`],
    ['E[R] ridge : Q5 − Q1', rr(ridge.q5q1), `${rr(ridge.sensitivity[1].q5q1)} sans les 5 plus grands gagnants`],
    ['Continuation (4 horizons)', `${ev.secondary.filter(s => s.test.startsWith('continuation') && s.demonstrated).length} / 4`, 'horizons où le modèle bat le taux naïf (Holm)'],
    ['Puissance (contrôle positif)', pcAt(0.5) ? pct(pcAt(0.5).detectionRate, 0) : '—', pcAt(0.5) ? `effet planté d'AUC ≈ ${num(pcAt(0.5).meanOracleAuc, 2)} détecté ; ${pct(pcAt(0.2)?.detectionRate ?? NaN, 0)} à AUC ≈ ${num(pcAt(0.2)?.meanOracleAuc ?? NaN, 2)}` : ''],
  ]
  const answer = verdictYes
    ? `<p class="lead">Oui, en partie : ${ev.primary.demonstrated ? 'le modèle complet améliore P(gain) hors entraînement' : ''}${anySec ? ` ; cibles secondaires démontrées (Holm) : ${ev.secondary.filter(s => s.demonstrated).map(s => esc(s.test)).join(', ')}` : ''}. Valeur ajoutée quantifiée aux sections 3, 4 et 6. Le Shock Engine n'est pas modifié.</p>`
    : `<p class="lead">Non. Sur ${int(nOOS)} trades chronologiquement hors entraînement (${day(ev.period.from)} → ${day(ev.period.to)}), aucune des estimations ne fait significativement mieux qu'une prévision naïve tirée de l'échantillon d'entraînement : ni la probabilité de gain, ni l'espérance en R, ni P(R ≥ 2), ni la continuation du prix à 15 min, 1 h, 4 h ou 16 h.</p>
<p>Le test principal (log-loss de P(gain), modèle complet contre taux naïf) donne ${sgn(winFull.dLogLoss.est, 4)} ${ci(winFull.dLogLoss.lo, winFull.dLogLoss.hi)}${winFull.dLogLoss.est < 0 ? ' : le modèle est même très légèrement moins bon que le taux naïf' : ''}. L'AUC de ${num(winFull.auc, 3)} est indiscernable de 0,5. L'espérance en R a la meilleure apparence (R² ${pct(ridge.r2, 1)}, quintile supérieur − inférieur ${rr(ridge.q5q1)}) mais rien n'est significatif après correction, et l'écart tombe à ${rr(ridge.sensitivity[1].q5q1)} sans les cinq plus grands gagnants : il tient à quelques trades extrêmes.</p>
<p><b>Conséquence :</b> le Shock Engine reste inchangé. La couche reste désactivée pour toute décision. Le modèle figé et le journal prospectif sont livrés pour mesurer, sur des signaux futurs, si ce verdict se confirme.</p>`

  const summary = `${answer}
<div class="tiles">${tiles.map(([l, v, s]) => `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="ts">${s}</div></div>`).join('')}</div>
<div class="status-grid"><div class="status-box hist"><div class="sb-h">Ce que mesure ce rapport</div><p>Un walk-forward sur l'historique de développement : chaque prévision est faite par un modèle qui n'a jamais vu le trade, mais les règles du Shock Engine (dont E2) ont été choisies sur cette même histoire. Ce n'est pas un test prospectif.</p></div><div class="status-box live"><div class="sb-h">Test prospectif</div><p>Pas encore commencé : 0 signal prospectif noté. Le modèle figé (empreinte <code>${esc(I.sha.slice(0, 12))}</code>) note les signaux postérieurs au ${esc(model.data.prospectiveAfter.slice(0, 10))} ; test au premier bilan à ${PROSPECTIVE_MIN} signaux fermés.</p></div></div>`

  // ---------------------------------------------------------------- méthode
  const method = `<p>Plan d'analyse et configuration commités avant tout calcul d'une relation entre caractéristique et résultat : <code>${esc(PREREG)}</code>, <code>research/proba/config.ts</code>.</p>
<ul>
<li><b>Observations</b> : les ${int(rows.length)} trades du portefeuille de référence (BTC ${REFERENCE.trades.btc}, ETH ${REFERENCE.trades.ethusdt}), reconstruits par le chemin de <code>research/shock/portfolio.ts --variant e2</code> : même moteur, mêmes données, shorts limités au régime E2, commission ${String(REFERENCE.commissionPct).replace('.', ',')} % par exécution. Taux de gain ${pct(M.mean(rows.map(r => r.win)), 2)}, identique au rapport publié.</li>
<li><b>Caractéristiques</b> : 11 variables connues à la clôture de la bougie de signal, calculées par les fonctions du moteur (jeu de réglages qui décide de l'entrée) ; variables quotidiennes sur des journées closes seulement (même calcul que <code>classify</code>, identité vérifiée bougie par bougie).</li>
<li><b>Cibles</b> : R = PnL net / risque initial ; R &gt; 0, ≥ 1, ≥ 2, ≥ 3 ; continuation d·ln(P<sub>t+h</sub>/P<sub>t</sub>) &gt; 0 à h = 1, 4, 16, 64 bougies.</li>
<li><b>Modèles</b> : naïf (taux ou moyenne de l'entraînement), logistique L2 « contexte » (sens, actif, régime), « réduit » (|z|, volume, cassure), « complet » (11 variables) ; pour E[R] : ridge, décomposition P·E[R|gain] + (1 − P)·E[R|perte] avec moyennes constantes ou ridge. Règle de complexité : un modèle à p variables seulement si la classe minoritaire compte au moins ${EPV_MIN}·p cas dans le premier entraînement.</li>
<li><b>Walk-forward</b> : ${wf.folds.length} trimestres de test (${day(wf.folds[0].start)} → fin), entraînement croissant depuis ${REFERENCE.start}. Un trade n'entre dans l'entraînement que si son label est connu un jour avant le début du trimestre (clôture de la sortie pour R ; clôture de la bougie i + h pour la continuation). Écrêtage 1 %–99 %, standardisation, λ (grille ${LAMBDAS.map(String).join(', ')} ; validation interne chronologique purgée, ${WALK.innerBlocks} blocs) et calibration : sur l'entraînement du pli seulement.</li>
<li><b>Tests</b> : bootstrap apparié par mois civils (${int(BOOT.reps)} réplications, graine ${BOOT.seed}). Test principal : Δ log-loss de P(gain), complet contre naïf. Famille secondaire avec correction de Holm (E[R], P(R ≥ 2), 4 horizons). Le reste est descriptif.</li>
</ul>
<div class="callout"><b>Écarts au plan.</b> Deux diagnostics descriptifs ont été ajoutés après avoir vu les résultats, sans changer aucune analyse pré-spécifiée : le contrôle positif (section 9) et la comparaison dans l'échantillon / hors entraînement (section 9). Aucun autre écart.</div>`

  // ---------------------------------------------------------------- 1. caractéristiques
  const featCont: [keyof TradeRow['features'], string, number, number, (v: number) => string][] = [
    ['absZ', '|z| du choc', 1.5, 9, fmtNum(1)], ['volZ', 'volume standardisé', 0, 8, fmtNum(1)], ['breakAtr', 'cassure (ATR)', 0, 6, fmtNum(1)], ['closeQ', 'qualité de clôture', 0.5, 1, fmtNum(2)],
    ['lamPct', 'clustering λ (percentile)', 0, 1, fmtNum(1)], ['rv', 'vol. réalisée 15 min (%)', 0, 0.01, v => fr((v * 100).toFixed(1))], ['volPct', 'percentile vol. journalière', 0, 1, fmtNum(1)], ['htfDist', 'distance HTF (ATR)', 0, 20, fmtNum(0)],
  ]
  const featHist = `<div class="panels four">${featCont.map(([k, label, lo, hi, f]) => histPanel({ values: rows.map(r => r.features[k] as number), lo, hi, nb: 24, title: label, color: 'var(--s1)', fmt: f })).join('')}</div>`
  const allFeat: [keyof TradeRow['features'], string, string][] = [
    ['absZ', '|z|', 'ln'], ['volZ', 'volume z', '—'], ['breakAtr', 'cassure / ATR', 'ln(1 + x)'], ['closeQ', 'qualité de clôture', '—'], ['lamPct', 'λ percentile', '—'], ['rv', 'σ 15 min', 'ln'], ['volPct', 'percentile vol. jour', '—'], ['htfDist', 'distance HTF / ATR', '—'],
    ['wickAgainst', 'mèche opposée*', ''], ['bodyShare', 'part du corps*', ''], ['atrZ', 'compression ATR (z)*', ''], ['atrPct', 'ATR / prix*', ''], ['trendDist', 'distance MM50 j (σ j)*', ''], ['trendSlope', 'pente MM50 j*', ''], ['dailyVol', 'σ journalière 20 j*', ''],
  ]
  const featTable = table(['Variable', 'Transformation', 'p5', 'p25', 'médiane', 'p75', 'p95'], allFeat.map(([k, l, tr]) => { const q = quant(rows.map(r => r.features[k] as number), [0.05, 0.25, 0.5, 0.75, 0.95]); return [l, tr, ...q.map(v => num(v, Math.abs(v) < 0.1 ? 4 : 2))] }), { caption: `${int(rows.length)} trades · * descriptive, non utilisée par les modèles` })
  const cnt = (f: (r: TradeRow) => boolean) => rows.filter(f).length
  const featMix = table(['Groupe', 'Trades', 'Part'], [
    ['BTC', cnt(r => r.asset === 'BTC'), pct(cnt(r => r.asset === 'BTC') / rows.length)], ['ETH', cnt(r => r.asset === 'ETH'), pct(cnt(r => r.asset === 'ETH') / rows.length)],
    ['long', cnt(r => r.dir === 1), pct(cnt(r => r.dir === 1) / rows.length)], ['short (tous en tendance baissière, E2)', cnt(r => r.dir === -1), pct(cnt(r => r.dir === -1) / rows.length)],
    ['régime calme', cnt(r => r.set === 0), pct(cnt(r => r.set === 0) / rows.length)], ['régime agité (longs seulement)', cnt(r => r.set === 1), pct(cnt(r => r.set === 1) / rows.length)],
    ['choc micro (μIMP)', cnt(r => r.features.micro === 1), pct(cnt(r => r.features.micro === 1) / rows.length)],
  ])
  const s1 = `${featHist}${note('Valeurs brutes, dans les unités du moteur. Les entrées passent déjà les seuils du Shock Engine (|z| au-dessus du seuil, cassure positive, clôture haute pour les longs, distance HTF positive) : les caractéristiques varient dans une plage restreinte, ce qui limite d\'emblée leur pouvoir de discrimination.')}${featTable}<h3>Composition</h3>${featMix}`

  // ---------------------------------------------------------------- 2. résultats en R
  const R = rows.map(r => r.R)
  const qR = quant(R, [0, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 1])
  const sumR = R.reduce((a, b) => a + b, 0)
  const desc = [...R].sort((a, b) => b - a)
  const topShare = (k: number) => desc.slice(0, k).reduce((a, b) => a + b, 0) / sumR
  const exitsT = [...new Set(rows.map(r => r.exits))].sort((a, b) => cnt(r => r.exits === b) - cnt(r => r.exits === a))
  const firstBar = rows.filter(r => r.exits === 'SL' && r.holdBars === 1)
  const sl = rows.filter(r => r.exits === 'SL' && r.holdBars > 1)
  const losers = rows.filter(r => !r.win), winners = rows.filter(r => r.win)
  const s2 = `<div class="panels two">${histPanel({ values: R, lo: -3, hi: 15, nb: 36, title: 'R par trade (écrêté à −3 et 15 pour l\'affichage)', color: 'var(--s1)', fmt: fmtNum(0), width: 460 })}${histPanel({ values: rows.map(r => r.feesR), lo: 0, hi: 0.5, nb: 25, title: 'commissions en R', color: 'var(--s2)', fmt: fmtNum(2), width: 460 })}</div>
${table(['min', 'p1', 'p5', 'p10', 'p25', 'médiane', 'p75', 'p90', 'p95', 'p99', 'max'], [qR.map(v => num(v, 2))], { caption: `R = PnL net / risque initial · moyenne ${rr(M.mean(R))} · ${int(rows.length)} trades` })}
${table(['Sorties', 'Trades', 'Part', 'R moyen', 'R médian', 'Taux de gain'], exitsT.map(e => { const g = rows.filter(r => r.exits === e).map(r => r.R); return [esc(e), g.length, pct(g.length / rows.length), rr(M.mean(g)), rr(M.percentile([...g].sort((a, b) => a - b), 0.5)), pct(g.filter(x => x > 0).length / g.length)] }))}
<h3>Concentration des gains</h3>
${table(['Trades', 'Part de ΣR'], [['10 plus grands', pct(topShare(10))], ['1 % supérieur (' + Math.ceil(rows.length * 0.01) + ')', pct(topShare(Math.ceil(rows.length * 0.01)))], ['5 % supérieurs (' + Math.ceil(rows.length * 0.05) + ')', pct(topShare(Math.ceil(rows.length * 0.05)))], ['10 % supérieurs (' + Math.ceil(rows.length * 0.1) + ')', pct(topShare(Math.ceil(rows.length * 0.1)))]], { caption: `ΣR = ${num(sumR, 0)} R sur ${int(rows.length)} trades` })}
${note(`Les ${Math.ceil(rows.length * 0.05)} meilleurs trades (5 %) font ${pct(topShare(Math.ceil(rows.length * 0.05)), 0)} de la somme des R${topShare(Math.ceil(rows.length * 0.05)) > 1 ? ' : sans eux, la somme des R des autres trades serait négative' : ''}. Toute mesure d'espérance est dominée par une poignée de trades.`)}
<h3>Définition du risque et cas particuliers</h3>
<ul>
<li>Risque initial = quantité × <code>atrStopMult</code> × ATR d'entrée (stop initial posé depuis la clôture de signal, égale au prix d'exécution). Commissions comptées une fois, dans le PnL net : R = R brut − commissions/risque (vérifié par test). Médiane des commissions : ${num(M.percentile(rows.filter(r => r.set === 0).map(r => r.feesR).sort((a, b) => a - b), 0.5), 3)} R en régime calme (stop 3,3 ATR), ${num(M.percentile(rows.filter(r => r.set === 1).map(r => r.feesR).sort((a, b) => a - b), 0.5), 3)} R en régime agité (stop 1,1 ATR).</li>
<li>Un stop exécuté après la première bougie donne R brut = ${num(M.percentile(sl.map(r => r.Rgross).sort((a, b) => a - b), 0.5), 3)} (médiane) : la normalisation est exacte.</li>
<li>Le script ne pose le stop qu'à la clôture de la bougie qui suit l'entrée. ${firstBar.length} trades sont sortis à cette clôture, au-delà du stop : R médian ${rr(M.percentile(firstBar.map(r => r.R).sort((a, b) => a - b), 0.5))}, minimum ${rr(Math.min(...firstBar.map(r => r.R)))}. Ce n'est pas une erreur de normalisation, c'est la convention d'exécution du moteur.</li>
<li>Normalisation impossible : ${ds.excluded.length} trade. Normalisation ambiguë (commissions &gt; 0,5 R) : ${cnt(r => r.ambiguous)} trades, conservés.</li>
</ul>
<h3>Excursions (résultats futurs, jamais utilisés comme variables)</h3>
${table(['', 'p10', 'p25', 'médiane', 'p75', 'p90'], [['MFE (R), gagnants', ...quant(winners.map(r => r.mfeR), [0.1, 0.25, 0.5, 0.75, 0.9]).map(v => num(v, 2))], ['MFE (R), perdants', ...quant(losers.map(r => r.mfeR), [0.1, 0.25, 0.5, 0.75, 0.9]).map(v => num(v, 2))], ['MAE (R), gagnants', ...quant(winners.map(r => r.maeR), [0.1, 0.25, 0.5, 0.75, 0.9]).map(v => num(v, 2))], ['MAE (R), perdants', ...quant(losers.map(r => r.maeR), [0.1, 0.25, 0.5, 0.75, 0.9]).map(v => num(v, 2))]])}
${note(`${pct(losers.filter(r => r.mfeR >= 1).length / losers.length, 0)} des perdants ont d'abord été à +1 R ou mieux ; ${pct(winners.filter(r => r.maeR <= -0.5).length / winners.length, 0)} des gagnants sont d'abord passés par −0,5 R ou pire.`)}`

  // ---------------------------------------------------------------- 3. P(gain)
  const winModels = wf.allowed.win
  const probRow = (e: Any) => [MODEL_LABEL[e.model] ?? e.model, int(e.n), pct(e.base), pct(e.meanPred), num(e.brier, 4), num(e.logLoss, 4), sgn(e.bss * 100, 2) + ' %', e.model === 'naive' ? '—' : `${sgn(e.dLogLoss.est, 4)} ${ci(e.dLogLoss.lo, e.dLogLoss.hi)}`, e.model === 'naive' ? '—' : pv(e.dLogLoss.p), `${num(e.auc, 3)} [${num(e.aucCI.lo, 3)} ; ${num(e.aucCI.hi, 3)}]`, num(e.calib.slope, 2)]
  const probHead = ['Modèle', 'n', 'Taux observé', 'Prévision moyenne', 'Brier', 'Log-loss', 'BSS', 'Δ log-loss vs naïf [IC 95 %]', 'p', 'AUC [IC 95 %]', 'Pente de calibration']
  const calibTable = table(['Cible', 'Modèle', 'n', 'Log-loss brute', 'Log-loss Platt', 'Gain [IC 95 %]', 'Calibré dans le modèle figé'], ev.calibration.map(c => [esc(TARGET_LABEL[c.target] ?? c.target), MODEL_LABEL[c.model], int(c.n), num(c.llRaw, 4), num(c.llCal, 4), `${sgn(c.gain.est, 4)} ${ci(c.gain.lo, c.gain.hi)}`, yes(c.useCalibrated)]))
  const q5 = winFull.quintiles
  const calImproved = ev.calibration.filter(c => c.gain.lo > 0), calWorse = ev.calibration.filter(c => c.gain.hi < 0)
  const s3 = `${table(probHead, winModels.map(m => probRow(prob('win', m))), { caption: `P(R > 0) · ${int(nOOS)} prévisions hors entraînement · BSS : Brier skill score contre le naïf` })}
<div class="split"><div>${calibPlot({ series: [{ name: 'complet', color: 'var(--s1)', bins: winFull.deciles }, { name: 'réduit', color: 'var(--s2)', bins: prob('win', 'reduced').deciles }], lim: [0.1, 0.5], title: 'Calibration de P(gain), déciles de la prévision' })}</div>
<div class="aside"><p>Chaque point : un dixième des prévisions, classées par probabilité prévue ; barre : intervalle de Wilson à 95 % de la fréquence observée ; diagonale : calibration parfaite.</p><p>Les prévisions du modèle complet vont de ${pct(Math.min(...P.map(q => q.p.win.full!)), 0)} à ${pct(Math.max(...P.map(q => q.p.win.full!)), 0)} : la régularisation choisie par validation interne les ramène presque au taux de base. Les points ne suivent pas la diagonale : la fréquence observée ne monte pas avec la prévision.</p><p>Pente de calibration ${num(winFull.calib.slope, 2)} (1 = parfait, 0 = aucune information). Écart moyen prévu − observé : ${pct(winFull.calib.inTheLarge)}${winFull.calib.inTheLarge > 0 ? ' (le taux de gain du test est plus bas que celui des entraînements)' : ''}.</p></div></div>
${table(['Quintile de P(gain)', 'n', 'Prévision moyenne', 'Taux observé [Wilson 95 %]'], q5.map(b => [`Q${b.bin}`, b.n, pct(b.meanPred), `${pct(b.observed)} [${pct(b.lo, 0)} ; ${pct(b.hi, 0)}]`]), { caption: 'Modèle complet' })}
<h3>Calibration de Platt sur prévisions antérieures</h3>
${calibTable}
${note(`Platt est estimée au pli k sur les prévisions hors entraînement des plis précédents (au moins ${CALIBRATION.minObs} prévisions, ${CALIBRATION.minPos} positifs et ${CALIBRATION.minNeg} négatifs), jamais sur le pli évalué ; disponible à partir du pli ${wf.folds.findIndex(f => f.platt.win) + 1}. ${calImproved.length ? `Amélioration significative : ${calImproved.map(c => esc(TARGET_LABEL[c.target])).join(', ')}.` : 'Elle n\'améliore aucune cible de façon significative.'}${calWorse.length ? ` Elle dégrade significativement ${calWorse.map(c => esc(TARGET_LABEL[c.target])).join(', ')}.` : ''} Le modèle figé n'utilise la version calibrée que pour les cibles où le gain est significatif (${calImproved.length ? calImproved.map(c => esc(TARGET_LABEL[c.target])).join(', ') : 'aucune'}). Avec si peu d'information, recalibrer revient surtout à suivre le bruit des plis passés.`)}`

  // ---------------------------------------------------------------- 4. E[R]
  const erRow = (e: Any) => [ER_LABEL[e.model], num(e.mse, 3), pct(e.r2, 2), e.model === 'naive' ? '—' : `${sgn(e.dMse.est, 3)} ${ci(e.dMse.lo, e.dMse.hi, 3)}`, e.model === 'naive' ? '—' : pv(e.dMse.p), `${num(e.spearman, 3)} ${ci(e.spearmanCI.lo, e.spearmanCI.hi, 3)}`, `${rr(e.q5q1)} ${ci(e.q5q1CI.lo, e.q5q1CI.hi, 2)}`]
  const erChart = (m: string, color: string) => columns({ cats: erE(m).quintiles.map((q: Any) => `Q${q.bin}`), series: [{ name: 'R moyen prévu', color: 'var(--s2)', y: erE(m).quintiles.map((q: Any) => q.meanPred) }, { name: 'R moyen réalisé', color, y: erE(m).quintiles.map((q: Any) => q.realized) }], fmt: v => `${sgn(v, 1)} R`, title: `E[R] ${ER_LABEL[m]} : prévu et réalisé par quintile`, height: 220 })
  const sensRows = ev.er.filter(e => e.model !== 'naive').flatMap(e => e.sensitivity.map(s => [ER_LABEL[e.model], esc(s.case), int(s.n), pct(s.r2, 2), num(s.spearman, 3), rr(s.q5q1)]))
  const naiveER = erE('naive')
  const s4 = `${table(['Modèle', 'MSE', 'R² hors entraînement', 'Δ MSE vs naïf [IC 95 %]', 'p', 'Spearman [IC 95 %]', 'Q5 − Q1 [IC 95 %]'], ev.er.map(erRow), { caption: `E[R | X] · ${int(nOOS)} prévisions hors entraînement · Q5 − Q1 : R moyen réalisé du quintile de prévision le plus haut moins le plus bas` })}
<h3>Ridge</h3>${erChart('ridge', 'var(--s1)')}
<h3>Décomposition P·E[R|gain] + (1 − P)·E[R|perte], ridge</h3>${erChart('decompRidge', 'var(--s1)')}
${note(`R moyen réalisé de Q1 à Q5 (ridge) : ${ridge.quintiles.map((q: Any) => rr(q.realized)).join(' · ')} — ${monotone(ridge.quintiles.map((q: Any) => q.realized)) ? 'croissant' : 'non monotone'}. Intervalle de Q5 − Q1 : ${ci(ridge.q5q1CI.lo, ridge.q5q1CI.hi, 2)}${ridge.q5q1CI.lo <= 0 ? ', qui inclut zéro' : ''}. Une courbe historique qui « monte » ne vaut pas preuve.`)}
<h3>Effet des plus grands gagnants</h3>
${table(['Modèle', 'Échantillon', 'n', 'R²', 'Spearman', 'Q5 − Q1'], sensRows)}
${note(`Sans les cinq plus grands gagnants (0,5 % des trades), l'écart Q5 − Q1 de la ridge passe de ${rr(ridge.q5q1)} à ${rr(ridge.sensitivity[1].q5q1)} et son R² devient ${pct(ridge.sensitivity[1].r2, 2)} : ce qui ressemble à un signal tient à quelques trades. La décomposition à moyennes constantes n'utilise que P(gain) : son classement est celui de P(gain) (Spearman avec R ${num(erE('decompConst').spearman, 3)} ${ci(erE('decompConst').spearmanCI.lo, erE('decompConst').spearmanCI.hi, 3)}).`)}
${note(`Même le naïf a un Q5 − Q1 de ${rr(naiveER.q5q1)} ${ci(naiveER.q5q1CI.lo, naiveER.q5q1CI.hi, 2)} : sa prévision change seulement d'un pli à l'autre (moyenne de l'entraînement), donc cet écart mesure la dérive du R moyen dans le temps — plus forte que tout ce que les caractéristiques expliquent.`)}`

  // ---------------------------------------------------------------- 5. quintiles de qualité
  const pf = P.map(q => q.p.win.full!)
  const bins = M.binsByRank(pf, 5)
  const qual = Array.from({ length: 5 }, (_, j) => {
    const qs = P.filter((_, i) => bins[i] === j)
    const rs = qs.map(q => q.row.R).sort((a, b) => a - b)
    const w = qs.filter(q => q.row.win).length
    const [lo, hi] = M.wilson(w, qs.length)
    return { j, n: qs.length, p: M.mean(qs.map(q => q.p.win.full!)), win: w / qs.length, lo, hi, meanR: M.mean(rs), medR: M.percentile(rs, 0.5), r2: M.mean(qs.map(q => q.row.r2)), pr2: M.mean(qs.map(q => q.p.r2[wf.display.r2]!)), er: M.mean(qs.map(q => q.er.ridge)), h16: M.mean(qs.map(q => q.row.horizons[16]?.y ?? NaN)) }
  })
  const s5 = `${columns({ cats: qual.map(q => `Q${q.j + 1}`), series: [{ name: 'P(gain) prévue', color: 'var(--s2)', y: qual.map(q => q.p) }, { name: 'taux de gain observé', color: 'var(--s1)', y: qual.map(q => q.win) }], fmt: fmtPct, title: 'Quintiles de P(gain) : prévu et observé', height: 220 })}
${table(['Quintile de P(gain)', 'n', 'P prévue', 'Gain observé [Wilson 95 %]', 'R moyen', 'R médian', 'P(R ≥ 2) prévue', 'R ≥ 2 observé', 'E[R] ridge', 'continuation 4 h'], qual.map(q => [`Q${q.j + 1}`, q.n, pct(q.p), `${pct(q.win)} [${pct(q.lo, 0)} ; ${pct(q.hi, 0)}]`, rr(q.meanR), rr(q.medR), pct(q.pr2), pct(q.r2), rr(q.er), pct(q.h16)]), { caption: `Signaux hors entraînement classés par P(gain) du modèle complet · écart Q5 − Q1 du taux de gain : ${pct(qual[4].win - qual[0].win)}` })}
${note(`Si la couche apportait une information exploitable, les quintiles hauts gagneraient plus souvent et rapporteraient plus en R. Taux de gain observés de Q1 à Q5 : ${qual.map(q => pct(q.win, 0)).join(' · ')} (${monotone(qual.map(q => q.win)) ? 'croissants' : 'non monotones'}) ; R moyen : ${qual.map(q => rr(q.meanR, 1)).join(' · ')}. ${qual[4].lo <= qual[0].hi ? 'Les intervalles de Wilson de Q1 et Q5 se recouvrent.' : 'Les intervalles de Wilson de Q1 et Q5 ne se recouvrent pas.'}`)}`

  // ---------------------------------------------------------------- 6. continuation
  const contRows = HORIZONS.map(h => { const e = prob(`h${h}`, 'full'); const s = ev.secondary.find(x => x.test.startsWith(`continuation ${h} bougie`))!; return [H_LABEL[h], int(e.n), pct(e.base), pct(e.meanPred), `${sgn(e.dLogLoss.est, 4)} ${ci(e.dLogLoss.lo, e.dLogLoss.hi)}`, pv(s.pHolm), `${num(e.auc, 3)} [${num(e.aucCI.lo, 3)} ; ${num(e.aucCI.hi, 3)}]`] })
  const rawRows = HORIZONS.map(h => {
    const ok = rows.filter(r => r.horizons[h])
    const y = (r: TradeRow) => r.horizons[h]!.y, ret = (r: TradeRow) => r.horizons[h]!.ret
    const w = ok.filter(r => r.win), l = ok.filter(r => !r.win)
    return [H_LABEL[h], int(ok.length), pct(M.mean(ok.map(y))), pct(M.mean(w.map(y))), pct(M.mean(l.map(y))), `${sgn(M.mean(ok.map(ret)) * 1e4, 1)} pb`, num(M.spearman(ok.map(ret), ok.map(r => r.R)), 3), int(ok.filter(r => r.horizons[h]!.gap).length)]
  })
  const s6 = `${table(['Horizon', 'n', 'Taux observé', 'Prévision moyenne', 'Δ log-loss vs naïf [IC 95 %]', 'p (Holm)', 'AUC [IC 95 %]'], contRows, { caption: 'P(d·r_h > 0 | X), modèle complet, hors entraînement · horizons fixés à l\'avance, tous rapportés' })}
${forest({ rows: HORIZONS.map(h => { const e = prob(`h${h}`, 'full'); return { label: `continuation ${H_LABEL[h]}`, est: e.dLogLoss.est, lo: e.dLogLoss.lo, hi: e.dLogLoss.hi } }), fmt: v => sgn(v, 3), title: 'Δ log-loss de la continuation, complet contre naïf' })}
<h3>Continuation brute du prix et résultat après les règles de sortie</h3>
${table(['Horizon', 'Trades', 'Prix dans le sens du signal', '… parmi les gagnants', '… parmi les perdants', 'Rendement moyen d·r', 'Spearman(d·r, R)', 'Trous remplis'], rawRows, { caption: `Tous les trades (${int(rows.length)}), résultats observés · prix de référence : clôture de la bougie de signal (= prix d'entrée) ; P_{t+h} : dernière clôture connue à la clôture prévue de la bougie i + h` })}
${note(`Part des trades où le prix est dans le sens du signal : ${HORIZONS.map(h => `${H_LABEL[h]} ${pct(M.mean(rows.filter(r => r.horizons[h]).map(r => r.horizons[h]!.y)), 0)}`).join(', ')}. Moins d'un trade sur deux continue dans le sens du signal, mais le rendement directionnel moyen est ${HORIZONS.every(h => M.mean(rows.filter(r => r.horizons[h]).map(r => r.horizons[h]!.ret)) > 0) ? 'positif à tous les horizons' : 'de signe variable'} (médianes : ${HORIZONS.map(h => `${H_LABEL[h]} ${sgn(M.percentile(rows.filter(r => r.horizons[h]).map(r => r.horizons[h]!.ret * 1e4).sort((x, y) => x - y), 0.5), 1)} pb`).join(', ')}) : la continuation existe en moyenne, portée par une minorité de grands mouvements — ceux que les sorties (stop serré, stop suiveur, flip) laissent courir. La couche ne sait pas dire à l'avance quel signal en fera partie. Ces moyennes sont descriptives, sans test.`)}`

  // ---------------------------------------------------------------- 7. segments
  const segRows = ev.segments.map(s => [esc(s.dim), esc(s.value), int(s.n), pct(s.base), pct(s.pFull), num(s.llNaive, 4), num(s.llFull, 4), sgn(s.llNaive - s.llFull, 4), num(s.auc, 3), rr(s.meanR), rr(s.erRidge), num(s.spearmanRidge, 3)])
  const segCats = ev.segments.map(s => s.value)
  const segD = ev.segments.map(s => s.llNaive - s.llFull)
  const s7 = `${columns({ cats: segCats, series: [{ name: 'P(gain) prévue', color: 'var(--s2)', y: ev.segments.map(s => s.pFull) }, { name: 'taux de gain observé', color: 'var(--s1)', y: ev.segments.map(s => s.base) }], fmt: fmtPct, title: 'Taux de gain prévu et observé par segment', height: 220 })}
${table(['Dimension', 'Segment', 'n', 'Gain observé', 'P(gain) prévue', 'Log-loss naïf', 'Log-loss complet', 'Δ', 'AUC', 'R moyen', 'E[R] ridge prévue', 'Spearman E[R]'], segRows, { caption: 'Prévisions hors entraînement · Δ > 0 : le modèle complet fait mieux que le naïf dans le segment' })}
${note(`Écarts de log-loss (naïf − complet) par segment : de ${sgn(Math.min(...segD), 4)} à ${sgn(Math.max(...segD), 4)}, positifs dans ${segD.filter(d => d > 0).length} segments sur ${segD.length} ; effectifs de ${int(Math.min(...ev.segments.map(s => s.n)))} à ${int(Math.max(...ev.segments.map(s => s.n)))} trades ; AUC de ${num(Math.min(...ev.segments.map(s => s.auc)), 3)} à ${num(Math.max(...ev.segments.map(s => s.auc)), 3)}. Ce sont des découpages descriptifs, sans test : ils servent à vérifier qu'aucun sous-groupe ne cache une performance que la moyenne effacerait. Spearman entre E[R] prévue et R réalisé à l'intérieur des segments : de ${num(Math.min(...ev.segments.map(s => s.spearmanRidge)), 3)} à ${num(Math.max(...ev.segments.map(s => s.spearmanRidge)), 3)}.`)}`

  // ---------------------------------------------------------------- 8. chronologie
  const dayX: number[] = [], dayY: number[] = []
  { const DAYMS = 864e5; let k = 0; const d0 = Math.floor(ev.cumulative.t[0] / DAYMS), d1 = Math.floor(ev.cumulative.t[ev.cumulative.t.length - 1] / DAYMS); let last = 0
    for (let d = d0; d <= d1; d++) { while (k < ev.cumulative.t.length && Math.floor(ev.cumulative.t[k] / DAYMS) <= d) { last = ev.cumulative.dLogLoss[k]; k++ } dayX.push(d); dayY.push(last) } }
  const foldRows = ev.folds.map(f => [f.k, quarter(f.start), f.n, sgn(f.dLogLoss, 4), sgn(f.dBrier, 4), num(f.auc, 3), int(f.lambdaFull), int(f.lambdaRidge), int(wf.folds[f.k - 1].fitted.binary.win.nTrain)])
  const lamMax = ev.folds.filter(f => f.lambdaFull === LAMBDAS[LAMBDAS.length - 1]).length
  const s8 = `${dayLine({ x: dayX, y: dayY, title: 'Somme cumulée des écarts de log-loss, naïf − complet, P(gain)', color: 'var(--s1)', fmt: fmtNum(2) })}
${note(`Au-dessus de zéro, le modèle complet a cumulé moins de pertes que le naïf. Valeur finale ${sgn(dayY[dayY.length - 1], 2)} (somme sur ${int(nOOS)} trades), minimum ${sgn(Math.min(...dayY), 2)}, maximum ${sgn(Math.max(...dayY), 2)}.`)}
${table(['Pli', 'Trimestre de test', 'n', 'Δ log-loss', 'Δ Brier', 'AUC', 'λ P(gain)', 'λ ridge E[R]', 'Entraînement (trades)'], foldRows, { caption: 'Δ > 0 : le modèle complet fait mieux que le naïf sur le trimestre' })}
${note(`${ev.folds.filter(f => f.dLogLoss > 0).length} plis sur ${ev.folds.length} ont Δ log-loss &gt; 0. Le λ choisi par la validation interne touche le haut de la grille (${int(LAMBDAS[LAMBDAS.length - 1])}) dans ${lamMax} plis sur ${ev.folds.length} : dans l'entraînement déjà, la meilleure prévision est la plus proche de la constante.`)}`

  // ---------------------------------------------------------------- 9. incertitude et stabilité
  const testRows = [
    { label: 'P(gain) complet (principal)', est: ev.primary.dLogLoss.est, lo: ev.primary.dLogLoss.lo, hi: ev.primary.dLogLoss.hi, strong: true },
    ...ev.secondary.filter(s => s.metric === 'Δ log-loss').map(s => ({ label: testFr(s.test).replace(' : complet contre naïf', '').replace(' contre naïf', ''), est: s.est, lo: s.lo, hi: s.hi })),
  ]
  const testTable = table(['Test', 'Mesure', 'Estimation [IC 95 %]', 'p', 'p Holm', 'Apport démontré'], [
    [esc(ev.primary.test) + ' <b>(principal)</b>', 'Δ log-loss', `${sgn(ev.primary.dLogLoss.est, 4)} ${ci(ev.primary.dLogLoss.lo, ev.primary.dLogLoss.hi)}`, pv(ev.primary.dLogLoss.p), '—', yes(ev.primary.demonstrated)],
    ...ev.secondary.map(s => [esc(testFr(s.test)), esc(s.metric), `${sgn(s.est, 4)} ${ci(s.lo, s.hi)}`, pv(s.p), pv(s.pHolm), yes(s.demonstrated)]),
  ], { caption: 'Δ > 0 : le modèle fait mieux que le naïf · bootstrap apparié par mois civils · p unilatéral' })
  const names = MODEL_FEATURES.full
  const coefFolds = names.map((_, k) => wf.folds.map(f => f.fitted.binary.win.models.full!.beta[k]))
  const fw = model.fitted.binary.win.models.full!
  const drawsW = model.draws.win
  const a = (1 - FROZEN_BOOT.level) / 2
  const coefRows = names.map((nm, k) => { const ds_ = drawsW.map(d => d.beta[k]).sort((x, y) => x - y); const same = drawsW.filter(d => Math.sign(d.beta[k]) === Math.sign(fw.beta[k])).length / drawsW.length; const lo = M.percentile(ds_, a), hi = M.percentile(ds_, 1 - a); return { nm, est: fw.beta[k], lo, hi, same } })
  const frR = model.fitted.er.ridge
  const drawsR = model.draws.er
  const coefRowsR = names.map((nm, k) => { const ds_ = drawsR.map(d => d.beta[k]).sort((x, y) => x - y); return { nm, est: frR.beta[k], lo: M.percentile(ds_, a), hi: M.percentile(ds_, 1 - a), same: drawsR.filter(d => Math.sign(d.beta[k]) === Math.sign(frR.beta[k])).length / drawsR.length } })
  const clear = (rs: { nm: string; lo: number; hi: number }[]) => rs.filter(r => r.lo > 0 || r.hi < 0).map(r => r.nm)
  const pcTable = table(['β planté', 'AUC de l\'oracle', 'AUC du modèle (moyenne)', 'Δ log-loss moyen', 'Détecté (p < 0,05)'], pc.map((c: Any) => [num(c.beta, 2), num(c.meanOracleAuc, 3), num(c.meanAuc, 3), sgn(c.meanDLogLoss, 4), `${Math.round(c.detectionRate * c.reps)} / ${c.reps}`]), { caption: 'Labels synthétiques plantés sur ln|z|, mêmes trades, mêmes plis, même purge, même test · β = 0 : contrôle négatif' })
  const IS = I.inSample
  const s9 = `<h3>Tous les tests pré-spécifiés</h3>${forest({ rows: testRows, fmt: v => sgn(v, 3), title: 'Δ log-loss contre naïf, IC 95 %', labelW: 260 })}
${forest({ rows: ev.secondary.filter(s => s.metric !== 'Δ log-loss').map(s => ({ label: testFr(s.test).replace(' contre naïf', ''), est: s.est, lo: s.lo, hi: s.hi })), fmt: v => sgn(v, 2), title: 'Δ erreur quadratique de E[R] contre naïf, IC 95 %', labelW: 260, color: 'var(--s2)' })}
${note('Premier graphique : Δ log-loss (probabilités) ; second : Δ erreur quadratique (espérance en R, unités R²). Au-dessus de zéro, le modèle fait mieux que le naïf.')}${testTable}
<h3>Coefficients du modèle complet de P(gain), pli par pli</h3>
${coefPanels({ names: names.map(String), x: wf.folds.map(f => quarter(f.start)), values: coefFolds, title: 'Coefficient standardisé', color: 'var(--s1)' })}
${note(`Coefficients sur variables centrées-réduites (log-odds par écart type). Plus grand |β| sur l'ensemble des plis : ${num(Math.max(...coefFolds.flat().map(Math.abs)), 3)} (la validation interne choisit une forte pénalité). Variables dont le coefficient change de signe d'un pli à l'autre : ${coefFolds.filter(v => v.some(x => x > 0) && v.some(x => x < 0)).length} sur ${names.length}.`)}
<h3>Modèle figé : intervalles des coefficients (bootstrap par mois, ${int(FROZEN_BOOT.reps)} tirages, ${Math.round(FROZEN_BOOT.level * 100)} %)</h3>
${['P(gain), logistique', 'E[R], ridge'].map((t, j) => `<h3 class="sub">${t} · λ = ${int(j ? frR.lambda : fw.lambda)}</h3>${forest({ rows: (j ? coefRowsR : coefRows).map(r => ({ label: r.nm, est: r.est, lo: r.lo, hi: r.hi })), fmt: v => sgn(v, 2), title: t, color: j ? 'var(--s2)' : 'var(--s1)', labelW: 110 })}`).join('')}
${note(`Variables dont l'intervalle à 90 % exclut zéro dans le modèle figé : P(gain) ${clear(coefRows).join(', ') || 'aucune'} ; E[R] ${clear(coefRowsR).join(', ') || 'aucune'}. Ces associations existent dans l'échantillon complet, mais le walk-forward montre qu'elles sont trop faibles ou trop instables pour améliorer une prévision hors entraînement (par exemple, le modèle réduit fondé sur |z|, le volume et la cassure : Δ log-loss ${sgn(prob('win', 'reduced').dLogLoss.est, 4)} ${ci(prob('win', 'reduced').dLogLoss.lo, prob('win', 'reduced').dLogLoss.hi)}).`)}
${table(['Variable', 'β P(gain) [IC 90 %]', 'Même signe', 'β E[R] ridge [IC 90 %]', 'Même signe'], names.map((nm, k) => [nm, `${sgn(coefRows[k].est, 3)} ${ci(coefRows[k].lo, coefRows[k].hi, 3)}`, pct(coefRows[k].same, 0), `${sgn(coefRowsR[k].est, 3)} ${ci(coefRowsR[k].lo, coefRowsR[k].hi, 3)}`, pct(coefRowsR[k].same, 0)]), { caption: 'Incertitude des paramètres seulement (transformation des variables et λ fixés) ; ce ne sont pas des tests' })}
<h3>Contrôle positif : quelle taille d'effet le dispositif détecte-t-il ? <span class="d">(ajouté après les résultats, descriptif)</span></h3>
${pcTable}
${note(`Le dispositif ne fabrique pas de faux positifs (β = 0 : ${Math.round((pcAt(0)?.detectionRate ?? 0) * (pcAt(0)?.reps ?? 0))} détection sur ${pcAt(0)?.reps}) et retrouve un effet planté d'AUC ≈ ${num(pcAt(0.5)?.meanOracleAuc ?? NaN, 2)} dans ${pct(pcAt(0.5)?.detectionRate ?? NaN, 0)} des tirages. Il ne détecte un effet d'AUC ≈ ${num(pcAt(0.2)?.meanOracleAuc ?? NaN, 2)} que dans ${pct(pcAt(0.2)?.detectionRate ?? NaN, 0)} des tirages, et d'AUC ≈ ${num(pcAt(0.35)?.meanOracleAuc ?? NaN, 2)} dans ${pct(pcAt(0.35)?.detectionRate ?? NaN, 0)}. Le résultat négatif veut donc dire : pas d'information d'une taille utile (AUC hors entraînement ${num(winFull.auc, 3)}, borne haute à 95 % ${num(winFull.aucCI.hi, 3)}), pas « aucune information du tout ».`)}
<h3>Dans l'échantillon contre hors entraînement <span class="d">(ajouté après les résultats, descriptif)</span></h3>
${table(['Mesure', 'Modèle figé, dans l\'échantillon (1 311 trades)', 'Walk-forward, hors entraînement (912 trades)'], [
    ['P(gain) : Δ log-loss vs taux de base', sgn(IS.winDLogLoss, 4), sgn(winFull.dLogLoss.est, 4)],
    ['P(gain) : AUC', num(IS.winAuc, 3), num(winFull.auc, 3)],
    ['E[R] ridge : R²', pct(IS.ridgeR2, 2), pct(ridge.r2, 2)],
    ['E[R] ridge : Spearman', num(IS.ridgeSpearman, 3), num(ridge.spearman, 3)],
  ])}
${note(`Dans l'échantillon, le modèle figé paraît porter un peu d'information (AUC ${num(IS.winAuc, 3)}, Δ log-loss ${sgn(IS.winDLogLoss, 4)}, R² de la ridge ${pct(IS.ridgeR2, 1)}) ; hors entraînement, ${winFull.auc - 0.5 < (IS.winAuc - 0.5) / 2 ? 'l\'essentiel disparaît' : 'une partie subsiste'} (AUC ${num(winFull.auc, 3)}, Δ ${sgn(winFull.dLogLoss.est, 4)}). C'est la différence entre expliquer le passé et prévoir : seule la colonne de droite répond à la question de l'étude. Un modèle moins pénalisé « expliquerait » encore davantage le passé.`)}`

  // ---------------------------------------------------------------- 10. conclusion
  const s10 = `<div class="callout"><p><b>Les caractéristiques connues avant un signal Shock Engine permettent-elles d'estimer sa distribution de rendement significativement mieux qu'une prévision naïve, hors entraînement ?</b></p>
<p>${verdictYes ? 'Oui, en partie (voir les tests démontrés ci-dessus).' : `<b>Non, pas avec des modèles simples et ces ${MODEL_FEATURES.full.length} caractéristiques.</b> Sur ${int(nOOS)} trades chronologiquement hors entraînement, aucun des ${1 + ev.secondary.length} tests pré-spécifiés ne montre d'apport, avant comme après correction pour tests multiples. La probabilité de gain prévue n'est pas mieux classée que le hasard (AUC ${num(winFull.auc, 3)}), l'espérance en R n'est pas mieux estimée que par la moyenne passée une fois retirés quelques trades extrêmes, et la probabilité de continuation n'est pas mieux prévue que par le taux de base, à aucun horizon.`}</p></div>
<h3>Ce que cela veut dire pour le Shock Engine</h3>
<ul>
<li>Le Shock Engine reste <b>inchangé</b> : aucune règle, aucun paramètre, aucun filtre n'est ajouté ou retiré à cause de cette étude.</li>
<li>Le meilleur estimateur actuel de la qualité d'un signal est le taux de base : environ ${pct(M.mean(rows.map(r => r.win)), 0)} de gagnants et ${rr(M.mean(R))} en moyenne par trade sur l'historique, avec la même incertitude pour tous les signaux. Les signaux qui passent les filtres du moteur se ressemblent : ce que mesurent les caractéristiques est déjà utilisé comme seuil d'entrée.</li>
<li>Le résultat est cohérent avec la nature de la stratégie : l'espérance vient de la forme des sorties (perte médiane ${rr(M.percentile(losers.map(r => r.R).sort((x, y) => x - y), 0.5))}, 1 % des trades au-delà de ${rr(qR[9], 1)}, maximum ${rr(qR[10], 1)}) et d'un petit nombre de très grands trades qu'aucune variable d'entrée ne permet d'anticiper.</li>
<li>Un filtre, un dimensionnement ou un classement des signaux fondé sur ces probabilités ne serait pas justifié par les données.</li>
</ul>
<h3>Limites</h3>
<ul>
<li><b>Pas un test prospectif.</b> Les règles du Shock Engine, dont E2, ont été choisies sur toute la période ; le walk-forward ne protège que la couche probabiliste.</li>
<li><b>Puissance.</b> Avec ${int(nOOS)} prévisions, un effet planté d'AUC ≈ ${num(pcAt(0.2)?.meanOracleAuc ?? NaN, 2)} n'est détecté que dans ${pct(pcAt(0.2)?.detectionRate ?? NaN, 0)} des tirages (section 9). De petits effets réels restent possibles ; ils seraient trop faibles pour fonder une décision.</li>
<li><b>Modèles.</b> Linéaires, sans interactions, par choix (environ 400 gagnants). Des modèles plus flexibles auraient besoin de beaucoup plus de trades pour être validés honnêtement.</li>
<li><b>R.</b> Le stop n'est posé qu'à la clôture de la bougie qui suit l'entrée (convention du script) : ${firstBar.length} trades sont sortis au-delà du stop, jusqu'à ${rr(Math.min(...firstBar.map(r => r.R)), 1)}. Le glissement est nul dans la référence, le financement n'est pas modélisé.</li>
<li><b>Données.</b> BTC/USD Bitstamp et ETH/USDT Binance au comptant, bougies 15 min ; le bot négocie sur Hyperliquid, dont les bougies diffèrent légèrement.</li>
<li><b>Dérive.</b> Le taux de gain et le R moyen changent dans le temps plus que les caractéristiques ne l'expliquent : une base naïve glissante est elle-même imparfaite.</li>
</ul>
<h3>Suivi</h3>
<p>Le modèle figé note chaque nouveau signal (<code>research/proba/score.ts</code>) et l'ajoute au journal prospectif. Le même test principal sera calculé sur les signaux postérieurs au ${esc(model.data.prospectiveAfter.slice(0, 10))}, au premier bilan à ${PROSPECTIVE_MIN} signaux fermés ; la conclusion ci-dessus ne pourra changer qu'à ce moment-là.</p>`

  // ---------------------------------------------------------------- fiches et fichiers
  const cards = `<p>Format de la fiche produite pour chaque signal. Les trois premières viennent du walk-forward (modèle du pli, prévision hors entraînement, sans intervalle) ; la dernière vient du modèle figé, sur un trade qui fait partie de son entraînement (valeur dans l'échantillon, montrée pour le format).</p>${I.cards.map(cardBody).join('')}`
  const files = `${table(['Fichier', 'Contenu'], [
    ['<code>research/reports/proba/dataset.csv</code>', 'une ligne par trade : identifiants, caractéristiques à l\'entrée, cibles, résultats ; schéma dans <code>dataset-schema.json</code>'],
    ['<code>research/reports/proba/predictions.csv</code>', 'prévisions hors entraînement : pli, date des labels, empreinte du modèle du pli, probabilités et E[R] de chaque modèle, résultats observés'],
    ['<code>research/reports/proba/walkforward.json</code>', 'modèles de chaque pli (λ, coefficients, transformations, calibrations)'],
    ['<code>research/reports/proba/metrics.json</code>', 'toutes les mesures de ce rapport'],
    ['<code>research/reports/proba/model.json</code>', `modèle figé, empreinte <code>${esc(I.sha.slice(0, 16))}</code>`],
    ['<code>research/reports/proba/cards/</code>', 'fiches d\'exemple (HTML, texte)'],
    ['<code>research/reports/proba/manifest.json</code>', 'empreintes des données et des sorties, commit, commande'],
  ], { cls: 'text wrap' })}
<pre><code>node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/run.ts
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --asset btc --at 2026-09-21T20:30:00Z
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --latest
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/score.ts --evaluate
npm run test:research</code></pre>`

  const toc: [string, string, string][] = [
    ['method', 'Méthode', method],
    ['features', 'Distribution des caractéristiques des signaux', s1],
    ['outcomes', 'Distribution des résultats en R', s2],
    ['pwin', 'Probabilité de gain prévue contre fréquence observée', s3],
    ['er', 'Espérance prédite contre espérance réalisée', s4],
    ['quintiles', 'Quintiles de qualité des signaux', s5],
    ['continuation', 'Probabilités de continuation aux quatre horizons', s6],
    ['segments', 'BTC / ETH, long / short, régimes', s7],
    ['chrono', 'Résultats chronologiques du walk-forward', s8],
    ['uncertainty', 'Incertitude statistique et stabilité des coefficients', s9],
    ['conclusion', 'Conclusion : le modèle apporte-t-il une information supplémentaire ?', s10],
    ['cards', 'Fiche d\'un signal', cards],
  ]
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Couche probabiliste Shock Engine</title>
<meta name="description" content="Walk-forward de modèles simples de probabilité de gain, d'espérance en R et de continuation sur les 1 311 trades BTC/ETH du Shock Engine.">
<style>${CSS}${CARD_CSS}</style>
</head>
<body>
<div class="banner">HISTORIQUE DE DÉVELOPPEMENT · WALK-FORWARD · PAS UN TEST PROSPECTIF</div>
<main>
<header>
<p class="eyebrow">Shock Engine · recherche · ${esc(PROBA_VERSION)}</p>
<h1>Couche probabiliste du Shock Engine</h1>
<p class="subtitle">Les caractéristiques connues au moment du signal prédisent-elles le rendement mieux qu'une prévision naïve ?</p>
<p class="meta">${int(rows.length)} trades BTC/ETH du portefeuille de référence (E2), ${REFERENCE.start} → 2026-09-30 · walk-forward trimestriel ${day(wf.folds[0].start)} → ${day(ev.period.to)}, ${int(nOOS)} prévisions hors entraînement · commission ${String(REFERENCE.commissionPct).replace('.', ',')} % par exécution · modèle figé <code>${esc(I.sha.slice(0, 12))}</code></p>
</header>
<section id="summary"><h2>Réponse courte</h2>${summary}</section>
<nav class="toc"><h2>Sommaire</h2><ol>${toc.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>
${toc.map(([id, t, b], i) => section(id, i === 0 ? '0' : String(i), t, b)).join('\n')}
<section id="files"><h2>Fichiers et commandes</h2>${files}</section>
<footer><p>Simulation historique après commissions modélisées ; aucun résultat réel ou prospectif. La couche probabiliste est désactivée pour toute décision de trading et ne modifie pas le Shock Engine.</p></footer>
</main>
</body>
</html>
`
}

const CSS = `
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#6f6d68;--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--mid:#f0efec;--ok:#006300;--ko:#d03b3b;--hist:#fff8e6;--histb:#e5b54a;--live:#f0efec}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#9a988f;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--s3:#199e70;--mid:#383835;--ok:#0ca30c;--ko:#e66767;--hist:#2a2416;--histb:#9c7a2c;--live:#232322}}
:root[data-theme="dark"]{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#9a988f;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--s3:#199e70;--mid:#383835;--ok:#0ca30c;--ko:#e66767;--hist:#2a2416;--histb:#9c7a2c;--live:#232322}
*{box-sizing:border-box}
body{margin:0;background:var(--page);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
.banner{position:sticky;top:0;z-index:5;background:var(--hist);border-bottom:1px solid var(--histb);color:var(--ink);text-align:center;font-size:12px;font-weight:600;letter-spacing:.08em;padding:6px 16px}
main{max-width:1000px;margin:0 auto;padding:24px 16px 64px}
header{padding:24px 0 8px}
.eyebrow{margin:0;color:var(--muted);font-size:13px;letter-spacing:.04em;text-transform:uppercase}
h1{font-size:34px;line-height:1.15;margin:6px 0 4px;font-weight:650;letter-spacing:-.01em}
.subtitle{font-size:18px;color:var(--ink2);margin:0 0 10px}
.meta{font-size:13px;color:var(--muted);margin:0}
h2{font-size:22px;margin:0 0 14px;font-weight:620;letter-spacing:-.005em}
h3{font-size:16px;margin:24px 0 8px;font-weight:600}
section{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px 22px 18px;margin:18px 0}
.sn{display:inline-block;min-width:40px;color:var(--muted);font-variant-numeric:tabular-nums}
p{margin:8px 0}
ul,ol{padding-left:22px}
li{margin:4px 0}
code{font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;background:var(--mid);padding:1px 5px;border-radius:4px}
pre{overflow-x:auto;background:var(--mid);border-radius:8px;padding:10px 12px}
pre code{background:none;padding:0}
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:12px 0 16px}
.tile{border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--page)}
.tl{font-size:12px;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em}
.tv{font-size:26px;font-weight:620;margin:4px 0 2px;line-height:1.2}
.ts{font-size:12px;color:var(--muted)}
.lead{font-size:16px;font-weight:550;margin:6px 0}
.status-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.status-box{border-radius:10px;padding:12px 14px;font-size:14px}
.status-box p{margin:4px 0 0}
.status-box.hist{background:var(--hist);border:1px solid var(--histb)}
.status-box.live{background:var(--live);border:1px solid var(--axis)}
.sb-h{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.toc ol{columns:2;column-gap:32px;margin:0}
.toc a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--grid)}
.toc a:hover{border-color:var(--ink2)}
nav.toc{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin:18px 0}
.tw{overflow-x:auto;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}
caption{text-align:left;color:var(--ink2);font-size:13px;padding-bottom:4px}
th{font-weight:600;color:var(--ink2);text-align:right;padding:7px 8px;border-bottom:1px solid var(--axis);vertical-align:bottom;font-size:12px}
td{padding:6px 8px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}
td:not(:first-child){white-space:nowrap}
.wrap td{white-space:normal}
.text td:not(:first-child){text-align:left}
th:first-child,td:first-child{text-align:left}
.d{color:var(--muted);font-size:12px;font-weight:400}
.note{font-size:13px;color:var(--ink2);margin:6px 0 10px}
.callout{border-left:3px solid var(--s1);background:var(--page);padding:10px 14px;border-radius:0 8px 8px 0;margin:10px 0}
.ok{color:var(--ok);font-weight:600}.ko0{color:var(--ink2)}
.key{display:inline-block;vertical-align:middle;margin-right:6px}
.key.rect{width:10px;height:10px;border-radius:2px}
.key.dotkey{border-radius:50%}
.key.line{width:14px;height:2px;border-radius:1px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin:6px 0 2px}
.chartbox{position:relative;margin:4px 0 8px}
svg.chart{width:100%;height:auto;display:block;overflow:visible}
.grid{stroke:var(--grid);stroke-width:1}
.axis{stroke:var(--axis);stroke-width:1}
.tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.ref{stroke:var(--ink2);stroke-width:1;stroke-dasharray:4 3}
.dot{stroke:var(--surface);stroke-width:2}
.dot.sm{stroke-width:1}
.hit{outline:none}.hit:hover,.hit:focus{stroke:var(--ink)}
.whisk{stroke-width:1.5;opacity:.6}
.ci{stroke-width:2;stroke-linecap:round;opacity:.55}
.flabel{fill:var(--ink2);font-size:12px}.flabel.strong{fill:var(--ink);font-weight:600}
.hover{fill:transparent;stroke:none}.hover:hover{fill:var(--ink2);fill-opacity:.25}
.bar{outline:none}.bar:hover,.bar:focus{opacity:.75}
.axlabel{fill:var(--ink2);font-size:12px}
.paneltitle{fill:var(--ink);font-size:12.5px;font-weight:600}
.panels{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.panels.four{grid-template-columns:repeat(4,1fr)}
.panels.two{grid-template-columns:repeat(2,1fr)}
.panel{margin:0;min-width:0}
h3.sub{font-size:14px;color:var(--ink2);margin:14px 0 2px}.panel figcaption{font-size:12px;color:var(--muted);margin-top:2px}
.split{display:grid;grid-template-columns:minmax(0,420px) 1fr;gap:18px;align-items:start}
.aside{font-size:14px;color:var(--ink2)}
footer{color:var(--muted);font-size:12.5px;padding:10px 4px}
@media (max-width:820px){.panels.four{grid-template-columns:repeat(2,1fr)}}
@media (max-width:720px){h1{font-size:27px}.status-grid,.split,.panels,.panels.two{grid-template-columns:1fr}.toc ol{columns:1}section{padding:16px 14px}.tv{font-size:22px}}
@media print{.banner{position:static}section{break-inside:avoid-page}}
`
