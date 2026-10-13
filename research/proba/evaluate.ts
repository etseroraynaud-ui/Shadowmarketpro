// Couche probabiliste · évaluation des prévisions hors entraînement du walk-forward (§ 8 du plan).
// Toutes les comparaisons sont appariées : les mêmes mois sont tirés pour tous les modèles.

import { ALPHA, BOOT, HORIZONS, MODEL_FEATURES } from './config.ts'
import type { TradeRow } from './dataset.ts'
import { BINARY_TARGETS, CALIBRATED, ER_MODELS, targetOf, walkForwardTarget } from './walkforward.ts'
import { rng } from '../lib/portfolio.ts'
import type { ERModel, ModelName, PredRow, WalkForward } from './walkforward.ts'
import * as M from './metrics.ts'
import type { Interval } from './metrics.ts'

export interface ProbEval {
  target: string
  model: string
  n: number
  base: number
  meanPred: number
  brier: number
  logLoss: number
  auc: number
  /** Brier skill score contre le naïf. */
  bss: number
  dLogLoss: Interval
  dBrier: Interval
  aucCI: Interval
  calib: { inTheLarge: number; intercept: number; slope: number }
  deciles: M.BinRow[]
  quintiles: M.BinRow[]
}

export interface EREval {
  model: ERModel
  n: number
  mse: number
  r2: number
  spearman: number
  q5q1: number
  dMse: Interval
  spearmanCI: Interval
  q5q1CI: Interval
  quintiles: { bin: number; n: number; meanPred: number; realized: number }[]
  /** Sensibilité aux plus grands gagnants (estimations ponctuelles). */
  sensitivity: { case: string; n: number; r2: number; spearman: number; q5q1: number }[]
}

export interface Segment { dim: string; value: string; n: number; base: number; pFull: number; llNaive: number; llFull: number; brierNaive: number; brierFull: number; auc: number; meanR: number; erRidge: number; spearmanRidge: number }

export interface Evaluation {
  n: number
  period: { from: number; to: number }
  prob: ProbEval[]
  calibration: { target: string; model: string; n: number; llRaw: number; llCal: number; brierRaw: number; brierCal: number; gain: Interval; useCalibrated: boolean }[]
  er: EREval[]
  primary: { test: string; dLogLoss: Interval; dBrier: number; demonstrated: boolean }
  secondary: { test: string; metric: string; est: number; lo: number; hi: number; p: number; pHolm: number; demonstrated: boolean }[]
  segments: Segment[]
  folds: { k: number; start: number; n: number; dLogLoss: number; dBrier: number; auc: number; lambdaFull: number; lambdaRidge: number }[]
  cumulative: { t: number[]; dLogLoss: number[]; dSse: number[] }
}

const sub = <T>(xs: T[], idx: number[]) => idx.map(i => xs[i])

/** Évaluation complète des prévisions hors entraînement. */
export function evaluate(wf: WalkForward): Evaluation {
  const P = wf.preds
  const n = P.length
  const groups = P.map(q => M.monthOf(q.row.entryTime))

  // ---------------------------------------------------------------- probabilités
  type Spec = { target: string; model: ModelName | 'cal'; idx: number[]; y: number[]; p: number[]; naive: number[] }
  const specs: Spec[] = []
  for (const t of BINARY_TARGETS) {
    const idx = P.map((q, i) => (t.y(q.row) !== null ? i : -1)).filter(i => i >= 0)
    const y = idx.map(i => t.y(P[i].row) as number)
    const naive = idx.map(i => P[i].p[t.key].naive!)
    for (const m of wf.allowed[t.key]) specs.push({ target: t.key, model: m, idx, y, p: idx.map(i => P[i].p[t.key][m]!), naive })
  }
  // Bootstrap apparié : pour chaque spécification, Δ log-loss, Δ Brier, AUC.
  const pos = new Map<number, number>()
  const draws = M.blockBootstrap(groups, BOOT.reps, BOOT.seed, idx => {
    pos.clear()
    for (const i of idx) pos.set(i, (pos.get(i) ?? 0) + 1)
    const out: number[] = []
    for (const s of specs) {
      // Échantillon tiré restreint aux observations définies pour la cible.
      const yy: number[] = [], pp: number[] = [], nn: number[] = []
      s.idx.forEach((i, j) => { const c = pos.get(i) ?? 0; for (let r = 0; r < c; r++) { yy.push(s.y[j]); pp.push(s.p[j]); nn.push(s.naive[j]) } })
      out.push(M.logLoss(yy, nn) - M.logLoss(yy, pp), M.brier(yy, nn) - M.brier(yy, pp), M.auc(yy, pp))
    }
    return out
  })
  const prob: ProbEval[] = specs.map((s, k) => {
    const col = (j: number) => draws.map(d => d[3 * k + j])
    const brier = M.brier(s.y, s.p), ll = M.logLoss(s.y, s.p), bN = M.brier(s.y, s.naive), lN = M.logLoss(s.y, s.naive)
    const a = M.auc(s.y, s.p)
    return {
      target: s.target, model: s.model, n: s.y.length, base: M.mean(s.y), meanPred: M.mean(s.p), brier, logLoss: ll, auc: a, bss: 1 - brier / bN,
      dLogLoss: M.interval(lN - ll, col(0), BOOT.level), dBrier: M.interval(bN - brier, col(1), BOOT.level), aucCI: M.interval(a, col(2).map(v => v - 0.5), BOOT.level),
      calib: M.calibrationFit(s.y, s.p), deciles: M.calibrationBins(s.y, s.p, 10), quintiles: M.calibrationBins(s.y, s.p, 5),
    }
  })
  // aucCI : intervalle et p de (AUC − 0,5) ; on remet l'AUC en estimation et en bornes.
  for (const e of prob) e.aucCI = { ...e.aucCI, est: e.auc, lo: e.aucCI.lo + 0.5, hi: e.aucCI.hi + 0.5 }

  // ---------------------------------------------------------------- calibration (Platt) contre brut
  const calibration: Evaluation['calibration'] = []
  for (const [key, which] of Object.entries(CALIBRATED)) {
    const t = targetOf(key)
    const model = which === 'full' ? 'full' : wf.display[key]
    if (model === 'naive') continue
    const idx = P.map((q, i) => (t.y(q.row) !== null && Number.isFinite(q.p[key].cal) ? i : -1)).filter(i => i >= 0)
    if (!idx.length) continue
    const y = idx.map(i => t.y(P[i].row) as number), raw = idx.map(i => P[i].p[key][model]!), cal = idx.map(i => P[i].p[key].cal!)
    const d = M.blockBootstrap(sub(groups, idx), BOOT.reps, BOOT.seed, ii => [M.logLoss(sub(y, ii), sub(raw, ii)) - M.logLoss(sub(y, ii), sub(cal, ii))])
    const gain = M.interval(M.logLoss(y, raw) - M.logLoss(y, cal), d.map(x => x[0]), BOOT.level)
    calibration.push({ target: key, model, n: idx.length, llRaw: M.logLoss(y, raw), llCal: M.logLoss(y, cal), brierRaw: M.brier(y, raw), brierCal: M.brier(y, cal), gain, useCalibrated: gain.lo > 0 })
  }

  // ---------------------------------------------------------------- espérance en R
  const R = P.map(q => q.row.R)
  const er: EREval[] = []
  const erDraws = M.blockBootstrap(groups, BOOT.reps, BOOT.seed, idx => {
    const y = sub(R, idx)
    const naive = idx.map(i => P[i].er.naive)
    return ER_MODELS.flatMap(m => { const f = idx.map(i => P[i].er[m]); return [M.mse(y, naive) - M.mse(y, f), M.spearman(f, y), M.topMinusBottom(y, f, 5)] })
  })
  const sorted = [...R].sort((a, b) => b - a)
  const top5 = sorted[4], top1pct = sorted[Math.max(0, Math.ceil(n * 0.01) - 1)]
  const asc = [...R].sort((a, b) => a - b)
  const p99 = M.percentile(asc, 0.99)
  ER_MODELS.forEach((m, k) => {
    const f = P.map(q => q.er[m]), naive = P.map(q => q.er.naive)
    const col = (j: number) => erDraws.map(d => d[3 * k + j])
    const mse = M.mse(R, f), mseN = M.mse(R, naive)
    const sens = (label: string, keep: (r: number) => boolean, clipAt = Infinity) => {
      const ii = R.map((r, i) => (keep(r) ? i : -1)).filter(i => i >= 0)
      const y = ii.map(i => Math.min(R[i], clipAt)), ff = sub(f, ii), nn = sub(naive, ii)
      return { case: label, n: ii.length, r2: 1 - M.mse(y, ff) / M.mse(y, nn), spearman: M.spearman(ff, y), q5q1: M.topMinusBottom(y, ff, 5) }
    }
    er.push({
      model: m, n, mse, r2: 1 - mse / mseN, spearman: M.spearman(f, R), q5q1: M.topMinusBottom(R, f, 5),
      dMse: M.interval(mseN - mse, col(0), BOOT.level),
      spearmanCI: M.interval(M.spearman(f, R), col(1), BOOT.level),
      q5q1CI: M.interval(M.topMinusBottom(R, f, 5), col(2), BOOT.level),
      quintiles: M.valueBins(R, f, 5),
      sensitivity: [
        sens('tous les trades', () => true),
        sens('sans les 5 plus grands gagnants', r => r < top5),
        sens('sans le 1 % supérieur de R', r => r < top1pct),
        sens('R écrêté au 99e centile (évaluation)', () => true, p99),
      ],
    })
  })

  // ---------------------------------------------------------------- décisions
  const pe = (target: string, model: string) => prob.find(e => e.target === target && e.model === model)!
  const winFull = pe('win', 'full')
  const primary = { test: 'P(R > 0) : complet contre naïf, Δ log-loss', dLogLoss: winFull.dLogLoss, dBrier: winFull.dBrier.est, demonstrated: winFull.dLogLoss.p < ALPHA && winFull.dBrier.est > 0 }
  const sec: Omit<Evaluation['secondary'][number], 'pHolm' | 'demonstrated'>[] = [
    ...(['ridge', 'decompConst', 'decompRidge'] as ERModel[]).map(m => { const e = er.find(x => x.model === m)!; return { test: `E[R] ${m} contre naïf`, metric: 'Δ erreur quadratique', est: e.dMse.est, lo: e.dMse.lo, hi: e.dMse.hi, p: e.dMse.p } }),
    (() => { const e = pe('r2', wf.display.r2); return { test: `P(R ≥ 2) ${wf.display.r2} contre naïf`, metric: 'Δ log-loss', est: e.dLogLoss.est, lo: e.dLogLoss.lo, hi: e.dLogLoss.hi, p: e.dLogLoss.p } })(),
    ...HORIZONS.map(h => { const e = pe(`h${h}`, 'full'); return { test: `continuation ${h} bougie${h > 1 ? 's' : ''} : complet contre naïf`, metric: 'Δ log-loss', est: e.dLogLoss.est, lo: e.dLogLoss.lo, hi: e.dLogLoss.hi, p: e.dLogLoss.p } }),
  ]
  const adj = M.holm(sec.map(s => s.p))
  const secondary = sec.map((s, i) => ({ ...s, pHolm: adj[i], demonstrated: adj[i] < ALPHA && s.est > 0 }))

  // ---------------------------------------------------------------- segments
  const segDefs: [string, (r: TradeRow) => string][] = [
    ['actif', r => r.asset], ['sens', r => (r.dir === 1 ? 'long' : 'short')], ['régime de volatilité', r => r.volRegime], ['tendance journalière', r => r.trendRegime],
  ]
  const segments: Segment[] = []
  for (const [dim, key] of segDefs) {
    for (const v of [...new Set(P.map(q => key(q.row)))].sort()) {
      const qs = P.filter(q => key(q.row) === v)
      const y = qs.map(q => q.row.win), pf = qs.map(q => q.p.win.full!), pn = qs.map(q => q.p.win.naive!)
      const rr = qs.map(q => q.row.R), fr = qs.map(q => q.er.ridge)
      segments.push({
        dim, value: v, n: qs.length, base: M.mean(y), pFull: M.mean(pf), llNaive: M.logLoss(y, pn), llFull: M.logLoss(y, pf),
        brierNaive: M.brier(y, pn), brierFull: M.brier(y, pf), auc: M.auc(y, pf), meanR: M.mean(rr), erRidge: M.mean(fr), spearmanRidge: M.spearman(fr, rr),
      })
    }
  }

  // ---------------------------------------------------------------- chronologie
  const folds = wf.folds.map(f => {
    const qs = P.filter(q => q.fold === f.k)
    const y = qs.map(q => q.row.win), pf = qs.map(q => q.p.win.full!), pn = qs.map(q => q.p.win.naive!)
    return { k: f.k, start: f.start, n: qs.length, dLogLoss: M.logLoss(y, pn) - M.logLoss(y, pf), dBrier: M.brier(y, pn) - M.brier(y, pf), auc: M.auc(y, pf), lambdaFull: f.fitted.binary.win.models.full?.lambda ?? NaN, lambdaRidge: f.fitted.er.ridge.lambda }
  })
  const cumulative = { t: [] as number[], dLogLoss: [] as number[], dSse: [] as number[] }
  let cl = 0, cs = 0
  for (const q of P) {
    const y = q.row.win, pf = Math.min(1 - 1e-15, Math.max(1e-15, q.p.win.full!)), pn = q.p.win.naive!
    cl += (y ? -Math.log(pn) : -Math.log(1 - pn)) - (y ? -Math.log(pf) : -Math.log(1 - pf))
    cs += (q.er.naive - q.row.R) ** 2 - (q.er.ridge - q.row.R) ** 2
    cumulative.t.push(q.row.entryTime); cumulative.dLogLoss.push(cl); cumulative.dSse.push(cs)
  }

  return { n, period: { from: P[0].row.entryTime, to: P[n - 1].row.entryTime }, prob, calibration, er, primary, secondary, segments, folds, cumulative }
}

/**
 * Contrôle positif (diagnostic ajouté après les résultats, descriptif) : labels synthétiques
 * y* ~ Bernoulli(σ(logit(taux) + β·x)), x = ln|z| centré-réduit sur l'échantillon, mêmes trades, mêmes
 * dates de connaissance que R. Pour chaque β, `reps` tirages de labels ; chaque tirage passe par le
 * walk-forward du modèle complet et le test du § 8 (bootstrap par mois, `boot` réplications). Le taux
 * de détection mesure la puissance du dispositif ; β = 0 est le contrôle négatif (taux ≈ α attendu).
 */
export function positiveControl(rows: TradeRow[], betas: number[], reps: number, boot: number, seed: number) {
  const lz = rows.map(r => Math.log(r.features.absZ))
  const mu = M.mean(lz), sd = Math.sqrt(M.mean(lz.map(v => (v - mu) ** 2)))
  const x = lz.map(v => (v - mu) / sd)
  const base = M.mean(rows.map(r => r.win))
  const a = Math.log(base / (1 - base))
  return betas.map((beta, k) => {
    const runs = Array.from({ length: reps }, (_, j) => {
      const rand = rng(seed + 1000 * k + j)
      const truth = new Map<TradeRow, number>()
      const ystar = new Map<TradeRow, number>()
      rows.forEach((r, i) => { const p = 1 / (1 + Math.exp(-(a + beta * x[i]))); truth.set(r, p); ystar.set(r, rand() < p ? 1 : 0) })
      const t = { key: `control-${beta}`, label: `contrôle β = ${beta}`, y: (r: TradeRow) => ystar.get(r) ?? null, known: (r: TradeRow) => r.exitTime }
      const out = walkForwardTarget(rows, t, 'full')
      const y = out.map(o => ystar.get(o.row)!), p = out.map(o => o.p), pn = out.map(o => o.naive)
      const groups = out.map(o => M.monthOf(o.row.entryTime))
      const d = M.blockBootstrap(groups, boot, BOOT.seed + j, ii => [M.logLoss(sub(y, ii), sub(pn, ii)) - M.logLoss(sub(y, ii), sub(p, ii))])
      const dl = M.interval(M.logLoss(y, pn) - M.logLoss(y, p), d.map(v => v[0]), BOOT.level)
      return { dLogLoss: dl.est, p: dl.p, auc: M.auc(y, p), oracleAuc: M.auc(y, out.map(o => truth.get(o.row)!)), detected: dl.p < ALPHA }
    })
    return {
      beta, reps, detectionRate: M.mean(runs.map(r => (r.detected ? 1 : 0))), meanDLogLoss: M.mean(runs.map(r => r.dLogLoss)),
      meanAuc: M.mean(runs.map(r => r.auc)), meanOracleAuc: M.mean(runs.map(r => r.oracleAuc)), runs,
    }
  })
}

/** Nombre de variables d'un modèle (pour l'affichage). */
export const nFeatures = (m: string) => (m in MODEL_FEATURES ? MODEL_FEATURES[m as keyof typeof MODEL_FEATURES].length : 0)
export type { PredRow }
