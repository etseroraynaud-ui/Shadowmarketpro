// Couche probabiliste · modèle figé, scoring d'un signal et journal prospectif.
//
// Le modèle figé est estimé par la même fonction que chaque pli du walk-forward (fitAll), sur tous les
// trades dont le label est connu à la fin des données. Son incertitude de paramètres vient d'un
// bootstrap par mois (transformation des variables fixée, coefficients ré-estimés à λ fixé).
//
// Le scoring est en lecture seule : il lit les séries du moteur (ShockRunner, contexte d'un sleeve)
// sans rien appeler qui change un état. Rien dans lib/strategies/shock ni dans bot/ ne lit ce module :
// la couche est désactivée pour toute décision de trading.

import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ShockRunner } from '../../lib/strategies/shock/live.ts'
import { rng } from '../lib/portfolio.ts'
import { BOOT, FROZEN_BOOT, HORIZONS, MODEL_FEATURES, PREREG, PROBA_VERSION, PROSPECTIVE_MIN, REFERENCE, WALK, LAMBDAS, WINSOR, EPV_MIN, CALIBRATION } from './config.ts'
import type { Horizon } from './config.ts'
import type { TradeRow } from './dataset.ts'
import { signalContext, signalFeatures } from './features.ts'
import type { SignalContext, SignalFeatures } from './features.ts'
import { applyPlatt, applyTransform, fitLogit, fitPlatt, fitRidge, linearPredictor, predict, sigmoid } from './models.ts'
import type { LinearModel, Platt } from './models.ts'
import * as M from './metrics.ts'
import type { Evaluation } from './evaluate.ts'
import { BINARY_TARGETS, fitAll, targetOf } from './walkforward.ts'
import type { Allowed, FittedSet, ModelName, WalkForward } from './walkforward.ts'

/** Grandeurs de la fiche du signal (§ 9 du plan). */
export const CARD_KEYS = ['win', 'r2', 'er', ...HORIZONS.map(h => `h${h}`)] as const
export type CardKey = (typeof CARD_KEYS)[number]

export interface Draw { b0: number; beta: number[] }

export interface Verdict { test: string; metric: string; est: number; lo: number; hi: number; p: number; pHolm: number | null; demonstrated: boolean }

export interface FrozenModel {
  schema: 'shock-proba-model/1'
  version: string
  status: string
  prereg: string
  config: Record<string, unknown>
  configSha256: string
  data: { files: { file: string; sha256: string }[]; firstEntry: string; lastEntry: string; lastLabel: string; dataEnd: string; prospectiveAfter: string }
  training: { trades: number; byTarget: Record<string, { n: number; positives: number }> }
  allowed: Allowed
  display: Record<string, ModelName>
  fitted: FittedSet
  /** Modèle de chaque grandeur de la fiche et calibration retenue (règle du § 7). */
  card: Record<CardKey, { target: string; model: string; calibrated: boolean }>
  platt: Record<string, Platt | null>
  draws: Record<CardKey, Draw[]>
  validation: Record<CardKey, Verdict>
  walkForward: { from: string; to: string; folds: number; predictions: number }
}

const iso = (ms: number) => new Date(ms).toISOString()
export const sha256 = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')

/** Modèle (estimé) qui porte une grandeur de la fiche. */
export function cardModel(fitted: FittedSet, display: Record<string, ModelName>, key: CardKey): LinearModel {
  if (key === 'er') return fitted.er.ridge
  const model = key === 'r2' ? display.r2 : 'full'
  return fitted.binary[key].models[model as ModelName]!
}

/** Configuration de l'étude recopiée dans le modèle (et son empreinte). */
export function configSnapshot() {
  return { REFERENCE, HORIZONS, MODEL_FEATURES, WALK, LAMBDAS, WINSOR, EPV_MIN, CALIBRATION, BOOT, FROZEN_BOOT }
}

/** Ré-estimation des coefficients d'un modèle sur un tirage de lignes (transformation et λ fixés). */
function refit(m: LinearModel, rows: TradeRow[], y: (r: TradeRow) => number): Draw {
  if (m.kind === 'const' || !m.transform) return { b0: rows.reduce((s, r) => s + y(r), 0) / rows.length, beta: [] }
  const X = rows.map(r => applyTransform(m.transform!, r.features))
  const f = m.kind === 'logit' ? fitLogit(X, rows.map(y), m.lambda) : fitRidge(X, rows.map(y), m.lambda)
  const round = (v: number) => +v.toPrecision(8)
  return { b0: round(f.b0), beta: f.beta.map(round) }
}

/**
 * Modèle figé : fitAll sur tous les trades dont le label est connu à la fin des données, calibration
 * selon la règle du § 7 (Platt estimée sur toutes les prévisions hors entraînement du walk-forward),
 * bootstrap par mois pour l'incertitude, verdicts du walk-forward.
 */
export function buildFrozen(rows: TradeRow[], wf: WalkForward, ev: Evaluation, files: { file: string; sha256: string }[], dataEnd: number): FrozenModel {
  const lastLabel = Math.max(...rows.flatMap(r => [r.exitTime, ...HORIZONS.map(h => r.horizons[h]?.labelTime ?? -Infinity)]))
  const cutoff = lastLabel + WALK.embargoMs
  const fitted = fitAll(rows, cutoff, wf.allowed)
  const card = {} as FrozenModel['card']
  const platt: Record<string, Platt | null> = {}
  for (const key of CARD_KEYS) {
    if (key === 'er') { card.er = { target: 'R', model: 'ridge', calibrated: false }; continue }
    const model = key === 'r2' ? wf.display.r2 : 'full'
    const c = ev.calibration.find(x => x.target === key && x.model === model)
    const use = !!c?.useCalibrated
    card[key] = { target: key, model, calibrated: use }
    if (use) {
      const t = targetOf(key)
      const qs = wf.preds.filter(q => t.y(q.row) !== null)
      platt[key] = fitPlatt(qs.map(q => q.p[key][model as ModelName]!), qs.map(q => t.y(q.row) as number))
    } else platt[key] = null
  }
  // Bootstrap par mois civils d'entrée.
  const months = [...new Set(rows.map(r => M.monthOf(r.entryTime)))].sort((a, b) => a - b)
  const byMonth = new Map<number, TradeRow[]>(months.map(m => [m, []]))
  for (const r of rows) byMonth.get(M.monthOf(r.entryTime))!.push(r)
  const R = rng(FROZEN_BOOT.seed)
  const draws = Object.fromEntries(CARD_KEYS.map(k => [k, [] as Draw[]])) as Record<CardKey, Draw[]>
  for (let b = 0; b < FROZEN_BOOT.reps; b++) {
    const sample: TradeRow[] = []
    for (let k = 0; k < months.length; k++) sample.push(...byMonth.get(months[Math.floor(R() * months.length)])!)
    sample.sort((x, y) => x.entryTime - y.entryTime)
    for (const key of CARD_KEYS) {
      const m = cardModel(fitted, wf.display, key)
      if (key === 'er') { draws.er.push(refit(m, sample, r => r.R)); continue }
      const t = targetOf(key)
      const s = sample.filter(r => t.y(r) !== null)
      draws[key].push(refit(m, s, r => t.y(r) as number))
    }
  }
  const sec = (test: string) => ev.secondary.find(s => s.test.startsWith(test))!
  const asVerdict = (s: Evaluation['secondary'][number]): Verdict => ({ test: s.test, metric: s.metric, est: s.est, lo: s.lo, hi: s.hi, p: s.p, pHolm: s.pHolm, demonstrated: s.demonstrated })
  const validation = {
    win: { test: ev.primary.test, metric: 'Δ log-loss', est: ev.primary.dLogLoss.est, lo: ev.primary.dLogLoss.lo, hi: ev.primary.dLogLoss.hi, p: ev.primary.dLogLoss.p, pHolm: null, demonstrated: ev.primary.demonstrated },
    r2: asVerdict(sec('P(R ≥ 2)')),
    er: asVerdict(sec('E[R] ridge')),
    ...Object.fromEntries(HORIZONS.map(h => [`h${h}`, asVerdict(sec(`continuation ${h} bougie`))])),
  } as Record<CardKey, Verdict>
  const byTarget = Object.fromEntries(BINARY_TARGETS.map(t => [t.key, { n: fitted.binary[t.key].nTrain, positives: fitted.binary[t.key].nPos }]))
  byTarget.R = { n: fitted.er.nTrain, positives: NaN }
  const config = configSnapshot()
  return {
    schema: 'shock-proba-model/1',
    version: PROBA_VERSION,
    status: 'Validé par walk-forward sur l\'historique de développement (hors entraînement de la couche, pas hors échantillon de la stratégie). Aucun test prospectif. Désactivé pour toute décision de trading.',
    prereg: PREREG,
    config,
    configSha256: sha256(JSON.stringify(config)),
    data: { files, firstEntry: iso(rows[0].entryTime), lastEntry: iso(rows[rows.length - 1].entryTime), lastLabel: iso(lastLabel), dataEnd: iso(dataEnd), prospectiveAfter: iso(dataEnd) },
    training: { trades: rows.length, byTarget },
    allowed: wf.allowed,
    display: wf.display,
    fitted,
    card,
    platt,
    draws,
    validation,
    walkForward: { from: iso(wf.folds[0].start), to: iso(ev.period.to), folds: wf.folds.length, predictions: wf.preds.length },
  }
}

// ---------------------------------------------------------------- chargement

/** JSON du modèle : les bornes infinies (variables binaires) deviennent null ; elles sont restaurées. */
export function serializeModel(m: FrozenModel): string {
  return JSON.stringify(m, null, 1) + '\n'
}

export function parseModel(text: string): FrozenModel {
  const m = JSON.parse(text) as FrozenModel
  const fix = (lm: LinearModel | undefined) => {
    if (!lm?.transform) return
    lm.transform.lo = lm.transform.lo.map(v => (v === null ? -Infinity : v))
    lm.transform.hi = lm.transform.hi.map(v => (v === null ? Infinity : v))
  }
  for (const t of Object.values(m.fitted.binary)) for (const lm of Object.values(t.models)) fix(lm)
  fix(m.fitted.er.naive); fix(m.fitted.er.ridge); fix(m.fitted.er.ridgeWin); fix(m.fitted.er.ridgeLoss)
  return m
}

export function loadModel(path: string): { model: FrozenModel; sha: string } {
  const text = readFileSync(path, 'utf8')
  return { model: parseModel(text), sha: sha256(text) }
}

// ---------------------------------------------------------------- scoring

export interface Quantity {
  key: CardKey
  label: string
  value: number
  naive: number
  /** Intervalle d'incertitude des paramètres (bootstrap par mois, niveau FROZEN_BOOT.level). */
  lo: number
  hi: number
  model: string
  calibrated: boolean
  verdict: Verdict
}

export interface SignalScore {
  id: string
  asset: 'BTC' | 'ETH'
  direction: 'long' | 'short'
  entryTime: string
  volRegime: 'calme' | 'agité'
  trendRegime: string
  /** prospectif : signal postérieur aux données du modèle ; rétrospectif sinon. */
  mode: 'prospectif' | 'rétrospectif'
  quantities: Record<CardKey, Quantity>
  features: Partial<SignalFeatures>
  model: { version: string; sha256: string; status: string; prospectiveAfter: string; intervalLevel: number }
  scoredAt: string
}

const LABELS: Record<CardKey, string> = { win: 'P(gain)', r2: 'P(R ≥ +2)', er: 'E[R]', h1: 'Continuation 15 min', h4: 'Continuation 1 h', h16: 'Continuation 4 h', h64: 'Continuation 16 h' }

/** Note un signal à partir de ses caractéristiques. Fonction pure. */
export function scoreFeatures(model: FrozenModel, sha: string, f: SignalFeatures, meta: { id: string; asset: 'BTC' | 'ETH'; dir: 1 | -1; entryTime: number; trend: number }, now = Date.now()): SignalScore {
  const quantities = {} as Record<CardKey, Quantity>
  for (const key of CARD_KEYS) {
    const lm = cardModel(model.fitted, model.display, key)
    const c = model.card[key]
    const platt = model.platt[key] ?? null
    const out = (eta: number) => {
      if (key === 'er') return eta
      const p = lm.kind === 'logit' ? sigmoid(eta) : eta
      return c.calibrated && platt ? applyPlatt(platt, p) : p
    }
    const value = out(linearPredictor(lm, f))
    const ds = model.draws[key].map(d => out(linearPredictor(lm, f, d.beta, d.b0)))
    const a = (1 - FROZEN_BOOT.level) / 2
    const naive = key === 'er' ? model.fitted.er.naive.b0 : model.fitted.binary[key].models.naive!.b0
    quantities[key] = { key, label: LABELS[key], value, naive, lo: M.percentile(ds, a), hi: M.percentile(ds, 1 - a), model: c.model, calibrated: c.calibrated, verdict: model.validation[key] }
  }
  const pick = ['absZ', 'volZ', 'breakAtr', 'closeQ', 'lamPct', 'rv', 'volPct', 'htfDist', 'isShort', 'isEth', 'agitated'] as const
  return {
    id: meta.id, asset: meta.asset, direction: meta.dir === 1 ? 'long' : 'short', entryTime: iso(meta.entryTime),
    volRegime: f.agitated ? 'agité' : 'calme', trendRegime: (['haussière', 'neutre', 'baissière'] as const)[meta.trend] ?? 'inconnue',
    mode: meta.entryTime > Date.parse(model.data.prospectiveAfter) ? 'prospectif' : 'rétrospectif',
    quantities, features: Object.fromEntries(pick.map(k => [k, f[k]])),
    model: { version: model.version, sha256: sha, status: model.status, prospectiveAfter: model.data.prospectiveAfter, intervalLevel: FROZEN_BOOT.level },
    scoredAt: iso(now),
  }
}

const idOf = (asset: string, t: number, dir: number) => `${asset}-${iso(t).slice(0, 16).replace(/[-:]/g, '')}-${dir === 1 ? 'L' : 'S'}`

/** Note le signal de sens `dir` à la clôture de la bougie i d'un contexte (lecture seule). */
export function scoreAt(model: FrozenModel, sha: string, ctx: SignalContext, i: number, dir: 1 | -1, now = Date.now()): SignalScore {
  const f = signalFeatures(ctx, i, dir)
  const entryTime = ctx.bars.t[i] + ctx.tfMin * 60000
  return scoreFeatures(model, sha, f, { id: idOf(ctx.asset, entryTime, dir), asset: ctx.asset, dir, entryTime, trend: f.trend }, now)
}

/**
 * Scoring depuis le runner du bot, en lecture seule : lit le marché, les séries préparées, la
 * sélection du régime et les barres journalières du runner, n'appelle ni push, ni decide, ni rien
 * qui modifie la stratégie. Le bot n'appelle pas cette fonction ; l'intégrer serait une décision
 * séparée (voir research/proba/README.md).
 */
export function scoreFromRunner(model: FrozenModel, sha: string, runner: ShockRunner, asset: 'BTC' | 'ETH', i: number, dir: 1 | -1, now = Date.now()): SignalScore {
  const ctx = signalContext(asset, runner.m, runner.cfg.sets, runner.strategy.prs, runner.select, runner.regimeBars ?? runner.m.htf)
  return scoreAt(model, sha, ctx, i, dir, now)
}

// ---------------------------------------------------------------- journal prospectif

/** Ajoute un score au journal JSONL, sauf si le même signal y est déjà avec le même modèle. */
export function appendLog(path: string, s: SignalScore): boolean {
  const seen = readLog(path).some(e => e.id === s.id && e.model.sha256 === s.model.sha256)
  if (seen) return false
  mkdirSync(dirname(path), { recursive: true })
  appendFileSync(path, JSON.stringify(s) + '\n')
  return true
}

export function readLog(path: string): SignalScore[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l) as SignalScore)
}

/** Bilan du journal : signaux prospectifs fermés, comparés au naïf (test au-delà de PROSPECTIVE_MIN). */
export function evaluateLog(entries: SignalScore[], rows: TradeRow[], sha: string) {
  const byId = new Map(rows.map(r => [r.id, r]))
  const mine = entries.filter(e => e.model.sha256 === sha)
  const pro = mine.filter(e => e.mode === 'prospectif')
  const closed = pro.map(e => ({ e, r: byId.get(e.id) })).filter(x => x.r) as { e: SignalScore; r: TradeRow }[]
  const y = closed.map(x => x.r.win), p = closed.map(x => x.e.quantities.win.value), pn = closed.map(x => x.e.quantities.win.naive)
  const res: Record<string, unknown> = { logged: mine.length, prospective: pro.length, prospectiveClosed: closed.length, retrospective: mine.length - pro.length, minimumForTest: PROSPECTIVE_MIN }
  if (closed.length) Object.assign(res, { winRate: M.mean(y), meanPWin: M.mean(p), logLossModel: M.logLoss(y, p), logLossNaive: M.logLoss(y, pn), brierModel: M.brier(y, p), brierNaive: M.brier(y, pn), meanR: M.mean(closed.map(x => x.r.R)), meanER: M.mean(closed.map(x => x.e.quantities.er.value)) })
  if (closed.length >= PROSPECTIVE_MIN) {
    const groups = closed.map(x => M.monthOf(x.r.entryTime))
    const d = M.blockBootstrap(groups, BOOT.reps, BOOT.seed, ii => [M.logLoss(ii.map(i => y[i]), ii.map(i => pn[i])) - M.logLoss(ii.map(i => y[i]), ii.map(i => p[i]))])
    res.test = M.interval(M.logLoss(y, pn) - M.logLoss(y, p), d.map(x => x[0]), BOOT.level)
  } else res.test = `non calculé : ${closed.length} signaux prospectifs fermés sur ${PROSPECTIVE_MIN} requis`
  return res
}

export { predict }
