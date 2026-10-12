// Couche probabiliste (research/proba) : non-régression du moteur, absence de fuite temporelle,
// purge du walk-forward, reproductibilité des sorties commitées, stabilité des prévisions, caractère
// non intrusif du scoring, et calculs statistiques de base.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HORIZONS, M15, MODEL_FEATURES, REFERENCE, WALK } from '../proba/config.ts'
import { buildDataset, truncatedContext } from '../proba/dataset.ts'
import { signalFeatures } from '../proba/features.ts'
import { applyPlatt, applyTransform, cholSolve, fitLogit, fitPlatt, fitRidge, fitTransform, predict, sigmoid } from '../proba/models.ts'
import * as M from '../proba/metrics.ts'
import { BINARY_TARGETS, CALIBRATED, epvAllowed, fitAll, hashOf, makeFolds, targetOf, trainingRows, walkForward, walkForwardTarget } from '../proba/walkforward.ts'
import { appendLog, evaluateLog, loadModel, readLog, scoreAt, scoreFromRunner } from '../proba/frozen.ts'
import { cardPage, cardText } from '../proba/card.ts'
import { predictionsCsv } from '../proba/run.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'
import { ShockSession } from '../../lib/strategies/shock/live.ts'
import { costsFor } from '../lib/frozen-shock.ts'
import { resample } from '../../lib/backtest/data.ts'
import { loadBtc } from '../lib/data.ts'
import { rng } from '../lib/portfolio.ts'

const ROOT = new URL('../../', import.meta.url).pathname
const sha = (f: string) => createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex')

// Calculs partagés (jeu de données ~6 s, walk-forward ~25 s).
const DS = buildDataset()
const rows = DS.rows
let WF: ReturnType<typeof walkForward> | null = null
const wf = () => (WF ??= walkForward(rows))

// ---------------------------------------------------------------- non-régression du moteur

test('moteur intact : empreintes des fichiers figés (e2-forward.md § 0) et du filtre E2', () => {
  const FROZEN: Record<string, string> = {
    'lib/strategies/shock/market.ts': 'b69ad8f8f89a4dedc05a1298e87acced6dace0893bbf15b74c858d74aa02ffff',
    'lib/strategies/shock/strategy.ts': 'fafb22d6373b19bf9026ec23ff68b2fb07507dd7c8d9653d9450523b7c4161bc',
    'lib/strategies/shock/broker.ts': 'bad42836b9d61569cb167883a8e9fe0db5e4c5303e654ccbfe99d087b012a97b',
    'lib/strategies/shock/engine.ts': '15211a3e185b1214fb6afee229f9eb2b51ee09bbd80fcd48dd831ce99157e62f',
    'lib/strategies/shock/params.ts': '5f7cd0c941d702733165da4df7947168b87381eecac179264874807f862d4df6',
    'lib/strategies/shock/presets.ts': 'f97449733ec945bb984a9692d03e51d34b5a9213aea2cbc56bf4bdca8e7d4ae2',
    'lib/strategies/shock/regimes.ts': 'd72f79d1d97c214de781e96fd580a83c4910272d7b37ea6ca44304a077ec99c8',
    'lib/strategies/shock/live.ts': '05caf82ece9ad7f8c355f0390bbda4fe6e3bffe1802933d0952b5c3dc10edeb2',
    'research/lib/frozen-shock.ts': 'be445aa726433c3e92bcd0cd1bc4626e56d103a309c5e29a5d7cd3f990bed710',
    'research/lib/e2.ts': 'd871214da8d4efb72dc6cf3cddfe8d53112a642361656ce24d365f259f2820e8',
    'lib/strategies/short-trend.ts': '6a4f5e4ea7ce4f12c046030c14a775bd57a41f6006cbec564acb4f227151280f',
  }
  for (const [f, h] of Object.entries(FROZEN)) assert.equal(sha(f), h, f)
})

test('aucun code du moteur, du bot ou du site ne lit la couche probabiliste', () => {
  const walk = (d: string): string[] => readdirSync(join(ROOT, d)).flatMap(f => {
    const p = join(d, f)
    if (f === 'node_modules' || f.startsWith('.')) return []
    return statSync(join(ROOT, p)).isDirectory() ? walk(p) : /\.(ts|tsx|js)$/.test(f) ? [p] : []
  })
  for (const f of [...walk('lib'), ...walk('bot'), ...walk('app')]) assert.ok(!readFileSync(join(ROOT, f), 'utf8').includes('research/proba'), f)
})

// ---------------------------------------------------------------- jeu de données

test('jeu de données : exactement les trades du portefeuille de référence publié', () => {
  assert.equal(rows.length, REFERENCE.trades.btc + REFERENCE.trades.ethusdt)
  assert.equal(rows.filter(r => r.asset === 'BTC').length, REFERENCE.trades.btc)
  assert.equal(DS.excluded.length, 0)
  const S = JSON.parse(readFileSync(join(ROOT, 'research/reports/btc-eth-portfolio-e2/portfolio_summary.json'), 'utf8'))
  const T = S.series.portfolio.trades
  assert.equal(rows.filter(r => r.win).length, T.winners)
  // Gain moyen / perte moyenne des rendements par trade (pnl / equity), même convention que le rapport.
  const w = rows.filter(r => r.ret > 0).map(r => r.ret), l = rows.filter(r => r.ret <= 0).map(r => r.ret)
  const btc = S.series.btc.trades
  const wb = rows.filter(r => r.asset === 'BTC' && r.ret > 0).map(r => r.ret)
  assert.ok(Math.abs(M.mean(wb) - btc.avgWin) < 1e-9)
  assert.ok(Math.abs(M.mean(w) / -M.mean(l) - 4.366) < 0.001)
  assert.equal(rows.filter(r => r.dir === -1).length, T.short)
})

test('R : PnL net / (quantité × stop initial), commissions comptées une seule fois', () => {
  for (const r of rows) {
    assert.ok(Math.abs(r.risk - r.qty * r.stopMult * r.atrEntry) <= 1e-9 * r.risk)
    assert.ok(Math.abs(r.R - r.pnl / r.risk) <= 1e-12 * Math.max(1, Math.abs(r.R)))
    assert.ok(Math.abs(r.R - (r.Rgross - r.feesR)) < 1e-9)
    // Commission 0,045 % sur l'entrée et sur la sortie, une fois chacune.
    const fees = (REFERENCE.commissionPct / 100) * (r.entryPrice * r.qty + r.exitPrice * r.qty)
    assert.ok(Math.abs(r.fees - fees) <= 1e-9 * fees, r.id)
    assert.equal(r.win, r.R > 0 ? 1 : 0)
  }
  // Un stop exécuté après la première bougie perd exactement 1 R brut.
  const sl = rows.filter(r => r.exits === 'SL' && r.holdBars > 1 && r.Rgross > -1.0001)
  assert.ok(sl.length > 400)
  for (const r of sl) assert.ok(Math.abs(r.Rgross + 1) < 1e-6, r.id)
})

test('caractéristiques : cohérentes avec les conditions d\'entrée du moteur, sans valeur manquante', () => {
  for (const r of rows) {
    const f = r.features
    for (const k of MODEL_FEATURES.full) assert.ok(Number.isFinite(f[k]), `${r.id} ${k}`)
    assert.ok(f.breakAtr > 0, r.id) // cassure : clôture au-delà du plus haut / plus bas précédent
    assert.ok(f.htfDist > 0, r.id) // du bon côté de la moyenne 60 min
    if (r.dir === 1) assert.ok(f.closeQ > 0.75, r.id)
    if (r.dir === -1) assert.equal(f.trend, 2, r.id) // E2 : shorts en tendance journalière baissière
    assert.equal(f.isShort, r.dir === -1 ? 1 : 0)
    assert.equal(f.agitated, r.set)
  }
})

test('variables quotidiennes : identiques à classify à chaque bougie, journées closes seulement', () => {
  for (const key of ['btc', 'ethusdt'] as const) {
    const ref = DS.refs[key]
    const reg = classify(ref.sleeve.bars, 15, ref.regimeBars)
    const D = ref.ctx.daily
    let bad = 0
    for (let i = 0; i < ref.sleeve.bars.n; i++) {
      const k = D.dayOf[i]
      if ((k >= 0 ? D.id[k] : -1) !== reg.id[i]) bad++
      if (k >= 0) assert.ok(D.dayT[k] + 864e5 <= ref.sleeve.bars.t[i] + M15)
    }
    assert.equal(bad, 0, key)
  }
})

test('pas de lecture du futur : mêmes caractéristiques sur un historique coupé à la bougie de signal', () => {
  const R = rng(7)
  for (const key of ['btc', 'ethusdt'] as const) {
    const mine = rows.filter(r => r.key === key)
    const pick = [mine[0], mine[mine.length - 1], ...Array.from({ length: 3 }, () => mine[Math.floor(R() * mine.length)])]
    for (const r of pick) {
      const cut = signalFeatures(truncatedContext(DS.refs[key], r.entryIdx), r.entryIdx, r.dir)
      for (const k of Object.keys(r.features) as (keyof typeof r.features)[]) {
        const a = r.features[k], b = cut[k]
        assert.ok(a === b || Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)), `${r.id} ${k} : ${a} ≠ ${b}`)
      }
    }
  }
})

test('cibles de continuation : prix d\'entrée = clôture de signal, horizon à la bonne heure', () => {
  for (const r of rows) {
    assert.equal(r.entryPrice, DS.refs[r.key].sleeve.bars.c[r.entryIdx])
    for (const h of HORIZONS) {
      const t = r.horizons[h]!
      assert.equal(t.labelTime, r.entryTime + h * M15)
      assert.ok(t.labelTime > r.entryTime)
    }
  }
})

// ---------------------------------------------------------------- walk-forward

test('walk-forward : purge des labels, aucun trade de test dans l\'entraînement', () => {
  const W = wf()
  const folds = makeFolds(rows)
  assert.equal(W.folds.length, folds.length)
  for (const f of folds) {
    for (const t of BINARY_TARGETS) {
      const tr = trainingRows(rows, t, f.start)
      assert.equal(W.folds[f.k - 1].fitted.binary[t.key].nTrain, tr.length)
      for (const r of tr) {
        assert.ok(t.known(r) <= f.start - WALK.embargoMs, `${t.key} ${r.id}`)
        assert.ok(r.entryTime < f.start)
      }
      const test = new Set(f.test.map(r => r.id))
      assert.ok(tr.every(r => !test.has(r.id)))
    }
  }
  for (const q of W.preds) assert.ok(q.row.entryTime >= q.cutoff)
  assert.equal(W.preds.length, rows.filter(r => r.entryTime >= Date.parse(WALK.firstTest)).length)
})

test('pas de fuite : changer les labels et les variables des trades inconnus à T_k ne change pas le modèle du pli', () => {
  const W = wf()
  for (const k of [1, 9, 17]) {
    const f = W.folds[k - 1]
    const T = f.start
    // Futur réécrit : tout label inconnu à T − embargo est inversé ; les variables des trades dont
    // aucun label n'est connu sont modifiées. Le modèle du pli doit rester identique.
    const cut = T - WALK.embargoMs
    const fake = rows.map(r => {
      const out = { ...r }
      if (r.exitTime > cut) Object.assign(out, { R: -r.R + 5, win: 1 - r.win, r1: 1 - r.r1, r2: 1 - r.r2, r3: 1 - r.r3 })
      out.horizons = Object.fromEntries(HORIZONS.map(h => { const x = r.horizons[h]!; return [h, x.labelTime > cut ? { ...x, y: 1 - x.y, ret: -x.ret } : x] })) as typeof r.horizons
      if (r.entryTime + M15 > cut) out.features = { ...r.features, absZ: r.features.absZ * 3, volZ: r.features.volZ + 10, rv: r.features.rv * 2 }
      return out
    })
    assert.ok(fake.some(r => r.entryTime > T))
    const S = fitAll(fake, T, W.allowed)
    assert.equal(hashOf(S), f.hash, `pli ${k}`)
  }
})

test('calibration : Platt estimée seulement sur les prévisions des plis précédents', () => {
  const W = wf()
  for (const f of W.folds) {
    for (const [key, which] of Object.entries(CALIBRATED)) {
      const c = f.platt[key]
      if (!c) continue
      const t = targetOf(key)
      const model = which === 'full' ? 'full' : W.display[key]
      const prior = W.preds.filter(q => q.fold < f.k && t.y(q.row) !== null && t.known(q.row) <= f.start - WALK.embargoMs)
      assert.equal(c.n, prior.length)
      const ref = fitPlatt(prior.map(q => q.p[key][model]!), prior.map(q => t.y(q.row) as number))
      assert.ok(Math.abs(ref.a - c.a) < 1e-9 && Math.abs(ref.b - c.b) < 1e-9)
    }
  }
})

test('règle de complexité (EPV) et modèle affiché', () => {
  const A = epvAllowed(rows, Date.parse(WALK.firstTest))
  assert.deepEqual(A, wf().allowed)
  assert.ok(A.win.includes('full'))
  assert.deepEqual(wf().display.r2, A.r2.includes('full') ? 'full' : 'reduced')
})

test('walk-forward d\'une cible seule = même prévision que le walk-forward complet', () => {
  const W = wf()
  const one = walkForwardTarget(rows, targetOf('win'), 'full')
  assert.equal(one.length, W.preds.length)
  one.forEach((o, i) => { assert.equal(o.row.id, W.preds[i].row.id); assert.equal(o.p, W.preds[i].p.win.full) })
})

test('reproductibilité : prévisions commitées et modèle figé recalculés à l\'identique', () => {
  const W = wf()
  const csv = join(ROOT, 'research/reports/proba/predictions.csv')
  assert.ok(existsSync(csv), 'lancer research/proba/run.ts')
  assert.equal(predictionsCsv(W), readFileSync(csv, 'utf8'))
  assert.equal(hashOf(walkForward(rows).folds.map(f => f.hash)), hashOf(W.folds.map(f => f.hash)))
  const { model } = loadModel(join(ROOT, 'research/reports/proba/model.json'))
  assert.equal(hashOf(fitAll(rows, model.fitted.cutoff, model.allowed)), hashOf(model.fitted))
})

// ---------------------------------------------------------------- modèle figé, scoring

test('scoring : chemin temps réel = prédiction directe, stable, probabilités dans ]0, 1[', () => {
  const { model, sha: s } = loadModel(join(ROOT, 'research/reports/proba/model.json'))
  for (const r of rows.slice(-20)) {
    const sc = scoreAt(model, s, DS.refs[r.key].ctx, r.entryIdx, r.dir, 0)
    assert.equal(sc.id, r.id)
    assert.equal(sc.quantities.win.value, predict(model.fitted.binary.win.models.full!, r.features))
    assert.equal(sc.quantities.er.value, predict(model.fitted.er.ridge, r.features))
    for (const q of Object.values(sc.quantities)) {
      if (q.key !== 'er') assert.ok(q.value > 0 && q.value < 1 && q.lo <= q.hi)
      assert.ok(Number.isFinite(q.lo) && Number.isFinite(q.hi))
    }
    assert.equal(sc.mode, 'rétrospectif')
    // Stabilité : une perturbation infime des variables ne déplace pas la prévision.
    const f2 = Object.fromEntries(Object.entries(r.features).map(([k, v]) => [k, typeof v === 'number' && !['isShort', 'isEth', 'agitated', 'set', 'micro', 'trend'].includes(k) ? v * (1 + 1e-9) : v])) as typeof r.features
    assert.ok(Math.abs(predict(model.fitted.binary.win.models.full!, f2) - sc.quantities.win.value) < 1e-6)
  }
  const txt = cardText({ ...scoreAt(model, s, DS.refs.btc.ctx, rows.filter(r => r.key === 'btc').at(-1)!.entryIdx, 1, 0), source: 'test' })
  assert.match(txt, /SHOCK ENGINE — PROBABILISTIC SIGNAL REPORT/)
  assert.ok(!/NaN|undefined/.test(txt))
})

test('scoring non intrusif : le runner du bot prend les mêmes décisions avec ou sans scoring', () => {
  const { model, sha: s } = loadModel(join(ROOT, 'research/reports/proba/model.json'))
  const ref = DS.refs.btc
  const b = ref.sleeve.bars
  const end = b.n - 1, from = end - 60, a = from - 40000
  const slice = (x: Float64Array, lo: number, hi: number) => x.slice(lo, hi)
  const hist = { n: from - a, t: slice(b.t, a, from), o: slice(b.o, a, from), h: slice(b.h, a, from), l: slice(b.l, a, from), c: slice(b.c, a, from), v: slice(b.v, a, from) }
  const daily = resample(loadBtc(60), 864e5)
  const costs = costsFor('btc', 1)
  const A = new ShockSession(ref.sleeve.preset, costs, hist, 400, { regimeBars: daily })
  const B = new ShockSession(ref.sleeve.preset, costs, hist, 400, { regimeBars: daily })
  let scored = 0
  for (let i = from; i <= end; i++) {
    const bar = { t: b.t[i], o: b.o[i], h: b.h[i], l: b.l[i], c: b.c[i], v: b.v[i] }
    const sa = A.push(bar), sb = B.push(bar)
    const k = B.runner.n - 1
    if (B.runner.select && B.runner.select[k] >= 0) { scoreFromRunner(model, s, B.runner, 'BTC', k, 1, 0); scored++ }
    assert.deepEqual(sb.decision, sa.decision)
    assert.equal(sb.equity, sa.equity)
  }
  assert.ok(scored > 0)
  assert.deepEqual(B.runner.strategy.state, A.runner.strategy.state)
  assert.deepEqual(B.broker.positions, A.broker.positions)
})

test('journal prospectif : ajout sans doublon, bilan seulement sur les signaux prospectifs fermés', () => {
  const { model, sha: s } = loadModel(join(ROOT, 'research/reports/proba/model.json'))
  const dir = mkdtempSync(join(tmpdir(), 'proba-'))
  const log = join(dir, 'p.jsonl')
  const r = rows[rows.length - 1]
  const sc = scoreAt(model, s, DS.refs[r.key].ctx, r.entryIdx, r.dir, 0)
  assert.equal(appendLog(log, sc), true)
  assert.equal(appendLog(log, sc), false)
  assert.equal(readLog(log).length, 1)
  const ev0 = evaluateLog(readLog(log), rows, s)
  assert.equal(ev0.prospective, 0)
  assert.equal(ev0.retrospective, 1)
  // Le même signal marqué prospectif et retrouvé dans les trades fermés est compté.
  const ev1 = evaluateLog([{ ...sc, mode: 'prospectif' }], rows, s)
  assert.equal(ev1.prospectiveClosed, 1)
  assert.match(String(ev1.test), /non calculé/)
  assert.match(cardPage([{ ...sc, source: 'test' }]), /<!doctype html>/)
})

// ---------------------------------------------------------------- calculs

test('logistique L2 : conditions d\'optimalité et retrouve des coefficients connus', () => {
  const R = rng(3)
  const g = () => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()) }
  const X: number[][] = [], y: number[] = []
  for (let i = 0; i < 20000; i++) { const x = [g(), g()]; X.push(x); y.push(R() < sigmoid(-0.8 + 0.5 * x[0] - 0.3 * x[1]) ? 1 : 0) }
  const f = fitLogit(X, y, 0)
  assert.ok(f.converged)
  assert.ok(Math.abs(f.b0 + 0.8) < 0.05 && Math.abs(f.beta[0] - 0.5) < 0.05 && Math.abs(f.beta[1] + 0.3) < 0.05)
  const lam = 50
  const h = fitLogit(X.slice(0, 500), y.slice(0, 500), lam)
  const grad = [0, 0, 0]
  X.slice(0, 500).forEach((x, i) => { const r = sigmoid(h.b0 + x[0] * h.beta[0] + x[1] * h.beta[1]) - y[i]; grad[0] += r; grad[1] += r * x[0]; grad[2] += r * x[1] })
  assert.ok(Math.abs(grad[0]) < 1e-7)
  assert.ok(Math.abs(grad[1] + lam * h.beta[0]) < 1e-7 && Math.abs(grad[2] + lam * h.beta[1]) < 1e-7)
})

test('ridge = équations normales ; Cholesky ; Platt identité', () => {
  const X = [[1, 2], [2, 1], [3, 5], [4, 3], [5, 8]], y = [1, 2, 4, 3, 7]
  const lam = 2
  const f = fitRidge(X, y, lam)
  // Gradient nul : Σ r = 0 et Xᵀr = λβ.
  const r = X.map((x, i) => y[i] - f.b0 - x[0] * f.beta[0] - x[1] * f.beta[1])
  assert.ok(Math.abs(r.reduce((s, v) => s + v, 0)) < 1e-9)
  for (let j = 0; j < 2; j++) assert.ok(Math.abs(X.reduce((s, x, i) => s + x[j] * r[i], 0) - lam * f.beta[j]) < 1e-9)
  const sol = cholSolve([[4, 2], [2, 3]], [2, 1])
  assert.ok(Math.abs(4 * sol[0] + 2 * sol[1] - 2) < 1e-12 && Math.abs(2 * sol[0] + 3 * sol[1] - 1) < 1e-12)
  assert.ok(Math.abs(applyPlatt({ a: 0, b: 1, n: 1 }, 0.37) - 0.37) < 1e-12)
})

test('transformation : écrêtage et standardisation estimés sur l\'entraînement seulement', () => {
  const tr = rows.slice(0, 300).map(r => r.features)
  const T = fitTransform(['absZ', 'isShort'], tr)
  const T2 = fitTransform(['absZ', 'isShort'], [...tr])
  assert.deepEqual(T, T2)
  const z = tr.map(f => applyTransform(T, f)[0])
  assert.ok(Math.abs(M.mean(z)) < 1e-9)
  assert.equal(T.lo[1], -Infinity)
  // Une valeur extrême hors entraînement est ramenée à la borne de l'entraînement.
  const big = applyTransform(T, { ...tr[0], absZ: 1e6 })[0]
  assert.ok(Math.abs(big - (T.hi[0] - T.mean[0]) / T.sd[0]) < 1e-12)
})

test('mesures : Brier, log-loss, AUC, Wilson, Holm, groupes de rang, bootstrap apparié', () => {
  assert.equal(M.brier([1, 0], [1, 0]), 0)
  assert.ok(Math.abs(M.logLoss([1, 0], [0.5, 0.5]) - Math.log(2)) < 1e-12)
  assert.equal(M.auc([0, 0, 1, 1], [0.1, 0.4, 0.35, 0.8]), 0.75)
  assert.equal(M.auc([0, 1], [0.5, 0.5]), 0.5)
  const [lo, hi] = M.wilson(30, 100)
  assert.ok(lo < 0.3 && hi > 0.3 && Math.abs(lo - 0.2189) < 1e-3 && Math.abs(hi - 0.3958) < 1e-3)
  assert.deepEqual(M.holm([0.01, 0.04, 0.03]), [0.03, 0.06, 0.06])
  const b = M.binsByRank([5, 1, 4, 2, 3, 6, 7, 8, 9, 10], 5)
  assert.deepEqual([...b], [2, 0, 1, 0, 1, 2, 3, 3, 4, 4])
  // Mêmes mois pour toutes les statistiques : deux statistiques identiques donnent des tirages identiques.
  const d = M.blockBootstrap([1, 1, 2, 2, 3], 50, 9, ii => [ii.length, ii.length])
  for (const x of d) assert.equal(x[0], x[1])
  assert.equal(M.interval(1, [1, 2, -1, 3], 0.95).p, 2 / 5)
})
