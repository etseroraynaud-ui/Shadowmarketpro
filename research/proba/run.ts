// Couche probabiliste du Shock Engine : pipeline complet, reproductible
// (research/preregistration/probabilistic-layer.md).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/run.ts
//
// 1. Jeu de données : les 1 311 trades du portefeuille de référence E2, caractéristiques à l'entrée,
//    cibles (dataset.csv, dataset-schema.json).
// 2. Walk-forward trimestriel purgé : prévisions hors entraînement (predictions.csv, walkforward.json).
// 3. Évaluation : scores, calibration, quintiles, segments, bootstrap par mois, tests (metrics.json).
// 4. Modèle figé (model.json), fiches d'exemple (cards/), rapport (report.html), manifeste.
//
// Ne modifie ni le moteur, ni le bot, ni le site. Sorties : research/reports/proba/.

import { execSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HORIZONS, M15, PREREG, PROBA_VERSION } from './config.ts'
import { buildDataset, datasetCsv, datasetSchema, KEYS } from './dataset.ts'
import { BINARY_TARGETS, CALIBRATED, ER_MODELS, LOGIT_MODELS, walkForward } from './walkforward.ts'
import type { FoldInfo, PredRow, WalkForward } from './walkforward.ts'
import { evaluate, positiveControl } from './evaluate.ts'
import * as M from './metrics.ts'
import { predict } from './models.ts'
import type { Evaluation } from './evaluate.ts'
import { buildFrozen, CARD_KEYS, loadModel, scoreAt, serializeModel, sha256 } from './frozen.ts'
import type { CardKey, FrozenModel, Quantity } from './frozen.ts'
import { cardPage, cardText } from './card.ts'
import type { CardInput } from './card.ts'
import { renderReport } from './report.ts'
import { SLEEVES } from '../lib/frozen-shock.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const OUT_DIR = 'research/reports/proba'
const OUT = join(ROOT, OUT_DIR)
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const iso = (ms: number) => new Date(ms).toISOString()
const num = (v: number) => (Number.isFinite(v) ? String(+v.toPrecision(10)) : '')

// ---------------------------------------------------------------- sorties tabulaires

export function predictionsCsv(wf: WalkForward): string {
  const head = ['trade_id', 'asset', 'direction', 'entry_time', 'exit_time', 'vol_regime', 'trend_regime', 'fold', 'train_cutoff', 'fold_model_sha256']
  const cols: [string, (q: PredRow) => string][] = []
  for (const t of BINARY_TARGETS) {
    cols.push([`y_${t.key}`, q => { const v = t.y(q.row); return v === null ? '' : String(v) }])
    for (const m of ['naive', ...LOGIT_MODELS]) if (wf.allowed[t.key].includes(m as never)) cols.push([`p_${t.key}_${m}`, q => num(q.p[t.key][m as 'naive']!)])
    if (t.key in CALIBRATED) cols.push([`p_${t.key}_cal`, q => num(q.p[t.key].cal!)])
  }
  cols.push(['R', q => num(q.row.R)])
  for (const m of ER_MODELS) cols.push([`er_${m}`, q => num(q.er[m])])
  const fold = new Map(wf.folds.map(f => [f.k, f]))
  cols.push(['lambda_win_full', q => num(fold.get(q.fold)!.fitted.binary.win.models.full?.lambda ?? NaN)], ['lambda_er_ridge', q => num(fold.get(q.fold)!.fitted.er.ridge.lambda)])
  const lines = [[...head, ...cols.map(c => c[0])].join(',')]
  for (const q of wf.preds) {
    const r = q.row
    lines.push([r.id, r.asset, r.dir === 1 ? 'long' : 'short', iso(r.entryTime), iso(r.exitTime), r.volRegime, r.trendRegime, q.fold, iso(q.cutoff), q.foldHash, ...cols.map(c => c[1](q))].join(','))
  }
  return lines.join('\n') + '\n'
}

const round = (x: unknown): unknown => {
  if (typeof x === 'number') return Number.isFinite(x) ? +x.toPrecision(8) : x
  if (Array.isArray(x)) return x.map(round)
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round(v)]))
  return x
}

function foldsJson(wf: WalkForward) {
  return {
    allowed: wf.allowed,
    display: wf.display,
    folds: wf.folds.map((f: FoldInfo) => ({
      k: f.k, testFrom: iso(f.start), testTo: Number.isFinite(f.end) ? iso(f.end) : 'fin des données', labelsKnownBy: iso(f.cutoff - 864e5), nTest: f.nTest, sha256: f.hash,
      platt: f.platt, models: round(f.fitted),
    })),
  }
}

// ---------------------------------------------------------------- fiches d'exemple

/** Fiche d'une prévision hors entraînement du walk-forward (pas d'intervalle). */
function wfCard(q: PredRow, wf: WalkForward, ev: Evaluation, model: FrozenModel): CardInput {
  const quantities = {} as Record<CardKey, Quantity>
  for (const key of CARD_KEYS) {
    const v = model.validation[key]
    if (key === 'er') { quantities.er = { key, label: 'E[R]', value: q.er.ridge, naive: q.er.naive, lo: NaN, hi: NaN, model: 'ridge', calibrated: false, verdict: v }; continue }
    const m = key === 'r2' ? wf.display.r2 : 'full'
    const useCal = !!ev.calibration.find(c => c.target === key && c.model === m)?.useCalibrated && Number.isFinite(q.p[key].cal)
    const labels: Record<string, string> = { win: 'P(gain)', r2: 'P(R ≥ +2)', h1: 'Continuation 15 min', h4: 'Continuation 1 h', h16: 'Continuation 4 h', h64: 'Continuation 16 h' }
    quantities[key] = { key, label: labels[key], value: useCal ? q.p[key].cal! : q.p[key][m as 'full']!, naive: q.p[key].naive!, lo: NaN, hi: NaN, model: m, calibrated: useCal, verdict: v }
  }
  const r = q.row
  return {
    id: r.id, asset: r.asset, direction: r.dir === 1 ? 'long' : 'short', entryTime: iso(r.entryTime), volRegime: r.volRegime, trendRegime: r.trendRegime,
    mode: 'rétrospectif', quantities, features: {},
    model: { version: `${PROBA_VERSION} · pli ${q.fold}`, sha256: q.foldHash, status: `Modèle du pli ${q.fold} du walk-forward, estimé avec les labels connus au ${iso(q.cutoff - 864e5).slice(0, 10)} ; prévision hors entraînement.`, prospectiveAfter: '', intervalLevel: 0.9 },
    scoredAt: iso(q.cutoff), source: `walk-forward, pli ${q.fold} (hors entraînement)`, outcome: { R: r.R, win: !!r.win, exits: r.exits },
  }
}

// ---------------------------------------------------------------- pipeline

function gitInfo() {
  try {
    const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()
    const dirty = execSync('git status --porcelain -- research/proba lib research/lib', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean)
    return { commit, sourcesClean: dirty.length === 0, dirtyFiles: dirty }
  } catch { return { commit: 'inconnu', sourcesClean: false, dirtyFiles: [] } }
}

export function main() {
  mkdirSync(join(OUT, 'cards'), { recursive: true })
  const ds = buildDataset()
  const rows = ds.rows
  log(`jeu de données : ${rows.length} trades, ${ds.excluded.length} exclus`)
  writeFileSync(join(OUT, 'dataset.csv'), datasetCsv(rows))
  writeFileSync(join(OUT, 'dataset-schema.json'), JSON.stringify({ version: PROBA_VERSION, prereg: PREREG, rows: rows.length, excluded: ds.excluded, columns: datasetSchema() }, null, 1) + '\n')

  const wf = walkForward(rows)
  log(`walk-forward : ${wf.folds.length} plis, ${wf.preds.length} prévisions hors entraînement`)
  writeFileSync(join(OUT, 'predictions.csv'), predictionsCsv(wf))
  writeFileSync(join(OUT, 'walkforward.json'), JSON.stringify(foldsJson(wf)) + '\n')

  const ev = evaluate(wf)
  log('évaluation')
  writeFileSync(join(OUT, 'metrics.json'), JSON.stringify(round(ev), null, 1) + '\n')

  const files = KEYS.map(k => ({ file: SLEEVES[k].file, sha256: sha256(readFileSync(join(ROOT, SLEEVES[k].file))) }))
  files.push({ file: 'research/data/btcusd_60m.csv.gz', sha256: sha256(readFileSync(join(ROOT, 'research/data/btcusd_60m.csv.gz'))) })
  const dataEnd = Math.max(...KEYS.map(k => { const b = ds.refs[k].sleeve.bars; return b.t[b.n - 1] + M15 }))
  const frozen = buildFrozen(rows, wf, ev, files, dataEnd)
  const modelPath = join(OUT, 'model.json')
  writeFileSync(modelPath, serializeModel(frozen))
  const { model, sha } = loadModel(modelPath)
  log(`modèle figé ${sha.slice(0, 12)}`)

  // Diagnostics ajoutés après les résultats (descriptifs) : contrôle positif, dans l'échantillon.
  const control = positiveControl(rows, [0, 0.2, 0.35, 0.5], 10, 500, 20261014)
  log('contrôle positif')
  const base = M.mean(rows.map(r => r.win))
  const yW = rows.map(r => r.win), pW = rows.map(r => predict(model.fitted.binary.win.models.full!, r.features))
  const eR = rows.map(r => predict(model.fitted.er.ridge, r.features)), yR = rows.map(r => r.R)
  const inSample = {
    winDLogLoss: M.logLoss(yW, yW.map(() => base)) - M.logLoss(yW, pW), winAuc: M.auc(yW, pW),
    ridgeR2: 1 - M.mse(yR, eR) / M.mse(yR, yR.map(() => M.mean(yR))), ridgeSpearman: M.spearman(eR, yR),
  }
  writeFileSync(join(OUT, 'diagnostics.json'), JSON.stringify(round({ note: 'Diagnostics ajoutés après les résultats, descriptifs (pas de test pré-spécifié).', positiveControl: control, inSample }), null, 1) + '\n')

  // Fiches : les trois dernières prévisions hors entraînement, et le dernier trade noté par le modèle figé.
  const last = wf.preds.slice(-3).map(q => wfCard(q, wf, ev, model))
  const lr = rows[rows.length - 1]
  const frozenScore: CardInput = { ...scoreAt(model, sha, ds.refs[lr.key].ctx, lr.entryIdx, lr.dir, Date.parse(model.data.dataEnd)), source: 'modèle figé (trade de l\'échantillon d\'entraînement : valeur dans l\'échantillon)', outcome: { R: lr.R, win: !!lr.win, exits: lr.exits } }
  const cards = [...last, frozenScore]
  writeFileSync(join(OUT, 'cards', 'examples.html'), cardPage(cards, 'Fiches de signaux — exemples'))
  writeFileSync(join(OUT, 'cards', 'examples.txt'), cards.map(cardText).join('\n\n') + '\n')

  writeFileSync(join(OUT, 'report.html'), renderReport({ ds, wf, ev, model, sha, cards, control, inSample }))
  log('rapport')

  const outputs = ['dataset.csv', 'dataset-schema.json', 'predictions.csv', 'walkforward.json', 'metrics.json', 'diagnostics.json', 'model.json', 'report.html', 'cards/examples.html', 'cards/examples.txt']
  const manifest = {
    version: PROBA_VERSION, generatedAt: iso(Date.now()), prereg: PREREG, git: gitInfo(),
    runtime: { node: process.version, command: 'node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/proba/run.ts' },
    data: files, model: { file: `${OUT_DIR}/model.json`, sha256: sha },
    outputs: outputs.map(f => ({ file: `${OUT_DIR}/${f}`, sha256: sha256(readFileSync(join(OUT, f))) })),
    verdict: { primary: ev.primary, secondary: ev.secondary.map(s => ({ test: s.test, demonstrated: s.demonstrated, pHolm: s.pHolm })) },
    horizons: HORIZONS,
  }
  writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n')
  log('terminé')
  return { ds, wf, ev, model, sha }
}

if (import.meta.url === `file://${process.argv[1]}`) main()
