// Validation forward de E2 sur BTC/ETH : research/preregistration/e2-forward.md.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/e2-forward.ts [--init]
//
// Hors ligne : rejoue la v1 figée (research/lib/frozen-shock.ts) sur les données à jour, jusqu'à la
// coupure mensuelle, et note pour chaque short si le régime E2 était baissier à l'entrée. Ne touche ni
// le bot, ni le site, ni la stratégie. Aucun signal live n'est ajouté, retiré ou redimensionné.
//
// --init : prend une seule fois l'instantané de la base historique (trades de la v1 fermés avant le
// 2026-10-01) et crée l'état de l'étude. Ensuite, une évaluation par mois civil complet (§ 5).
//
// Sorties : research/reports/e2-forward/ (latest.{md,json}, rapport du mois, state.json, baseline.json).

import { createHash } from 'node:crypto'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { costsFor, loadSleeve } from '../lib/frozen-shock.ts'
import type { Sleeve, SleeveKey } from '../lib/frozen-shock.ts'
import { loadBtc } from '../lib/data.ts'
import * as P from '../lib/portfolio.ts'
import { PLAN, applyLook, bootP, diff, dueLook, emptyState } from '../lib/e2-forward.ts'
import type { FwdTrade, Look, State } from '../lib/e2-forward.ts'
import { resample } from '../../lib/backtest/data.ts'
import type { Bars } from '../../lib/backtest/types.ts'
import { classify } from '../../lib/strategies/shock/regimes.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import type { ShockResult } from '../../lib/strategies/shock/engine.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/e2-forward')
const PREREG = 'research/preregistration/e2-forward.md'
const INIT = process.argv.includes('--init')
const DAY = P.DAY, M15 = 15 * 60000, HOUR = 3600000
const START = PLAN.start
const BASE_CUT = Date.parse('2026-10-01T00:00:00Z')
const AUDIT_BARS = 100
const t0 = Date.now()
const log = (s: string) => process.stderr.write(`${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`)
const iso = (ms: number) => new Date(ms).toISOString()
const day = (ms: number) => iso(ms).slice(0, 10)

const checks: { name: string; ok: boolean; detail: string }[] = []
const check = (name: string, ok: boolean, detail: string) => { checks.push({ name, ok, detail }); if (!ok) process.stderr.write(`ÉCHEC : ${name} · ${detail}\n`) }
const stopIfFailed = (stage: string) => {
  const bad = checks.filter(c => !c.ok)
  if (bad.length) throw new Error(`${stage} : ${bad.length} contrôle(s) en échec, aucun test calculé : ${bad.map(c => c.name).join(' ; ')}`)
}

// ================================================================ 1. empreintes (§ 0)
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
}
const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')
for (const [f, h] of Object.entries(FROZEN)) { const got = sha(readFileSync(join(ROOT, f))); check(`empreinte ${f}`, got === h, got.slice(0, 16)) }
stopIfFailed('empreintes')

// ================================================================ 2. sleeves, coupure, régime
const KEYS: SleeveKey[] = ['btc', 'ethusdt']
const NAME: Record<SleeveKey, string> = { btc: 'BTC', ethusdt: 'ETH' }
const S: Record<SleeveKey, Sleeve> = { btc: loadSleeve('btc'), ethusdt: loadSleeve('ethusdt') }
const hourlyBtc = loadBtc(60)
const regimeBars = (k: SleeveKey): Bars => (k === 'btc' ? resample(hourlyBtc, DAY) : resample(S[k].bars, DAY))
const monthStart = (ms: number) => { const d = new Date(ms); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) }

// Coupure : premier jour du mois qui suit le dernier mois complet couvert par les deux fichiers.
const CUT = Math.min(...KEYS.map(k => monthStart(S[k].bars.t[S[k].end] + M15)))
const END = Object.fromEntries(KEYS.map(k => { const t = S[k].bars.t; let i = S[k].end; while (i > 0 && t[i] + M15 > CUT) i--; return [k, i] })) as Record<SleeveKey, number>
const forwardOpen = CUT > START
log(`coupure ${day(CUT)}`)
if (INIT) check('initialisation : coupure au plus tôt le 2026-10-01', CUT >= BASE_CUT, `coupure ${day(CUT)}`)

const TREND: Record<SleeveKey, Uint8Array> = {} as Record<SleeveKey, Uint8Array>
for (const k of KEYS) {
  const s = S[k], t = s.bars.t
  let off = 0, back = 0, gaps = 0
  for (let i = s.lo; i <= END[k]; i++) { if (t[i] % M15 !== 0) off++; if (i > s.lo && t[i] <= t[i - 1]) back++; if (i > s.lo && t[i] - t[i - 1] > M15) gaps++ }
  check(`${NAME[k]} : horodatages sur la grille 15 min, croissants`, off === 0 && back === 0, `${END[k] - s.lo + 1} barres jusqu'au ${iso(t[END[k]])}, ${gaps} trous`)
  const reg = classify(s.m.bars, 15, regimeBars(k))
  let bad = 0
  const td = new Uint8Array(s.bars.n)
  for (let i = 0; i < s.bars.n; i++) { const id = reg.id[i]; if ((id < 0 ? -1 : id % 2) !== s.select[i]) bad++; td[i] = id >= 0 && id >> 1 === 2 ? 1 : 0 }
  check(`${NAME[k]} : régime recalculé = régime du moteur`, bad === 0, `${bad} écart(s) sur ${s.bars.n} barres`)
  TREND[k] = td
}
stopIfFailed('données')

// E2 recalculé sur un historique coupé à la barre i (le futur n'existe pas encore).
function e2Truncated(k: SleeveKey, i: number): number {
  const b = S[k].bars
  const cut = (x: Float64Array) => x.subarray(0, i + 1)
  const tb: Bars = { n: i + 1, t: cut(b.t), o: cut(b.o), h: cut(b.h), l: cut(b.l), c: cut(b.c), v: cut(b.v) }
  let daily: Bars
  if (k === 'btc') {
    const close = b.t[i] + M15
    let n = 0
    while (n < hourlyBtc.n && hourlyBtc.t[n] + HOUR <= close) n++
    const hc = (x: Float64Array) => x.subarray(0, n)
    daily = resample({ n, t: hc(hourlyBtc.t), o: hc(hourlyBtc.o), h: hc(hourlyBtc.h), l: hc(hourlyBtc.l), c: hc(hourlyBtc.c), v: hc(hourlyBtc.v) }, DAY)
  } else daily = resample(tb, DAY)
  const id = classify(tb, 15, daily).id[i]
  return id >= 0 && id >> 1 === 2 ? 1 : 0
}

// ================================================================ 3. simulations
const run = (k: SleeveKey, short: Uint8Array): ShockResult => simulate(S[k].m, S[k].preset.sets, costsFor(k, 1), S[k].lo, END[k], S[k].select, { long: S[k].signals.long, short })
const V1: Record<SleeveKey, ShockResult> = { btc: run('btc', S.btc.signals.short), ethusdt: run('ethusdt', S.ethusdt.signals.short) }
// Challenger en shadow (descriptif) : à partir du début de la fenêtre, shorts seulement en régime E2 baissier.
const challenger = (k: SleeveKey) => { const s0 = S[k].signals.short, t = S[k].bars.t, out = new Uint8Array(s0.length); for (let i = 0; i < s0.length; i++) out[i] = s0[i] && (t[i] < START || TREND[k][i]) ? 1 : 0; return out }
const CH: Record<SleeveKey, ShockResult> = { btc: run('btc', challenger('btc')), ethusdt: run('ethusdt', challenger('ethusdt')) }
log('v1 rejouée')

// ================================================================ 4. base historique (§ 6.2)
// Trades fermés par une vraie sortie avant la dernière barre précédant le 2026-10-01 (la dernière barre
// d'un run peut porter une sortie forcée « END » : elle est exclue partout).
const closedBefore = (k: SleeveKey, r: ShockResult, cut: number) => r.positions.filter(p => !p.exits.includes('END') && S[k].bars.t[p.exitIdx] + M15 < cut)
const baseLines = KEYS.flatMap(k => closedBefore(k, V1[k], BASE_CUT).map(p => [NAME[k], p.dir, S[k].bars.t[p.entryIdx], S[k].bars.t[p.exitIdx], p.entryPrice.toPrecision(12), p.exitPrice.toPrecision(12), p.pnl.toPrecision(12)].join(',')))
const baseHash = sha(baseLines.join('\n'))
const BASE_FILE = join(OUT, 'baseline.json')
const STATE_FILE = join(OUT, 'state.json')
const LATEST = join(OUT, 'latest.json')
mkdirSync(OUT, { recursive: true })
if (INIT) {
  check('initialisation : pas d\'instantané existant', !existsSync(BASE_FILE) && !existsSync(STATE_FILE), 'baseline.json et state.json absents')
  stopIfFailed('initialisation')
  writeFileSync(BASE_FILE, JSON.stringify({ cut: iso(BASE_CUT), takenAt: iso(Date.now()), trades: baseLines.length, perAsset: Object.fromEntries(KEYS.map(k => [NAME[k], closedBefore(k, V1[k], BASE_CUT).length])), sha256: baseHash, rule: 'trades de la v1 (BTC, ETH) fermés par une vraie sortie, barre de sortie close avant le 2026-10-01 ; lignes : actif, sens, entrée, sortie (ms UTC, ouverture de bougie), prix d\'entrée, prix de sortie, PnL' }, null, 1))
  writeFileSync(STATE_FILE, JSON.stringify(emptyState(), null, 1))
}
if (!existsSync(BASE_FILE)) throw new Error('baseline.json absent : lancer d\'abord avec --init')
const base = JSON.parse(readFileSync(BASE_FILE, 'utf8'))
check('base historique : trades de la v1 fermés avant le 2026-10-01 identiques à l\'instantané', base.sha256 === baseHash && base.trades === baseLines.length, `${baseLines.length} trades, ${baseHash.slice(0, 16)} (instantané ${String(base.sha256).slice(0, 16)}, ${base.trades} trades)`)

// ================================================================ 5. shorts forward et audit de E2
const dailyVol = (k: SleeveKey) => {
  const { t, c } = S[k].bars
  const close = new Map<number, number>()
  for (let i = 0; i < S[k].bars.n; i++) close.set(Math.floor(t[i] / DAY), c[i])
  const ds = [...close.keys()].sort((x, y) => x - y)
  const out = new Map<number, number>()
  const lr: number[] = []
  for (let j = 1; j < ds.length; j++) {
    if (lr.length >= 30) out.set(ds[j], P.sd(lr.slice(-30)))
    lr.push(ds[j] - ds[j - 1] === 1 ? Math.log(close.get(ds[j])! / close.get(ds[j - 1])!) : 0)
  }
  return out
}
const VOL = { btc: dailyVol('btc'), ethusdt: dailyVol('ethusdt') }

const shortsOf = (k: SleeveKey, from: number, to: number): FwdTrade[] => closedBefore(k, V1[k], CUT)
  .filter(p => p.dir === -1 && S[k].bars.t[p.entryIdx] >= from && S[k].bars.t[p.entryIdx] < to && p.entryIdx >= S[k].lo)
  .map(p => {
    const t = S[k].bars.t[p.entryIdx], d = Math.floor(t / DAY), net = p.pnl / p.equityAtEntry
    return { asset: NAME[k], entryT: t, exitT: S[k].bars.t[p.exitIdx], month: P.monthKey(d), e2: TREND[k][p.entryIdx] as 0 | 1, R: net / VOL[k].get(d)!, net }
  })
const FWD = KEYS.flatMap(k => shortsOf(k, START, Infinity))
const HIST = KEYS.flatMap(k => shortsOf(k, -Infinity, START))
const openFwd = KEYS.reduce((a, k) => a + V1[k].positions.filter(p => p.dir === -1 && S[k].bars.t[p.entryIdx] >= START && (p.exits.includes('END') || S[k].bars.t[p.exitIdx] + M15 >= CUT)).length, 0)
check('σ journalière définie pour chaque short', [...FWD, ...HIST].every(x => Number.isFinite(x.R)), `${FWD.length} shorts forward, ${HIST.length} shorts historiques`)

// Anti-look-ahead : chaque short forward, et 100 barres historiques tirées au hasard par actif.
{
  const rand = P.rng(PLAN.seed + 7)
  let tested = 0, bad = 0
  for (const k of KEYS) {
    const s = S[k]
    const idx = Array.from({ length: AUDIT_BARS }, () => s.lo + Math.floor(rand() * (END[k] - s.lo + 1)))
    for (const x of FWD.filter(f => f.asset === NAME[k])) idx.push(s.bars.t.indexOf(x.entryT))
    for (const i of idx) { tested++; if (e2Truncated(k, i) !== TREND[k][i]) bad++ }
  }
  check('E2 sans look-ahead : recalculé sur l\'historique coupé à la barre = valeur utilisée', bad === 0, `${tested} barres (${AUDIT_BARS} tirées au hasard par actif + ${FWD.length} entrées de shorts forward), ${bad} écart(s)`)
}

// Shorts forward déjà rapportés : reproduits à l'identique (§ 6.3).
const prev = existsSync(LATEST) ? JSON.parse(readFileSync(LATEST, 'utf8')) : null
if (prev) {
  const now = new Map(FWD.map(x => [`${x.asset}|${x.entryT}`, x]))
  let bad = 0
  for (const x of prev.forward.trades as FwdTrade[]) {
    const y = now.get(`${x.asset}|${x.entryT}`)
    if (!y || y.exitT !== x.exitT || y.e2 !== x.e2 || Math.abs(y.R - x.R) > 1e-9 * Math.max(1, Math.abs(x.R))) bad++
  }
  check('shorts forward de l\'évaluation précédente reproduits à l\'identique', bad === 0, `${prev.forward.trades.length} shorts de la coupure ${prev.cutoff}, ${bad} écart(s)`)
}
stopIfFailed('contrôles')
log('contrôles')

// ================================================================ 6. regards (§ 3)
let state: State = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : (() => { throw new Error('state.json absent') })()
const dNow = diff(FWD)
const fwdMonths: number[] = []
for (let m = P.monthKey(Math.floor(START / DAY)); forwardOpen && m <= P.monthKey(Math.floor((CUT - 1) / DAY)); m++) fwdMonths.push(m)
const due = forwardOpen ? dueLook(state, dNow.n1, dNow.n0, CUT) : null
let lookNow: Look | null = null
if (due) {
  const b = bootP(FWD, fwdMonths)
  lookNow = { kind: due.kind, threshold: due.threshold, cutoff: day(CUT), n1: dNow.n1, n0: dNow.n0, d: dNow.d, p: b.p, alpha: due.alpha, rejected: b.p < due.alpha }
  state = applyLook(state, lookNow)
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 1))
}

// ================================================================ 7. descriptif (§ 7)
const byAsset = (ts: FwdTrade[]) => Object.fromEntries(KEYS.map(k => [NAME[k], diff(ts.filter(x => x.asset === NAME[k]))]))
const histMonths: number[] = []
for (let m = Math.min(...HIST.map(x => x.month)); m <= Math.max(...HIST.map(x => x.month)); m++) histMonths.push(m)
const histBoot = bootP(HIST, histMonths)
const fwdReturn = (k: SleeveKey, r: ShockResult) => { const t = S[k].bars.t; let a = S[k].lo; while (a <= END[k] && t[a] < START) a++; return a > END[k] ? NaN : r.equity[END[k]] / r.equity[a - 1] - 1 }
const challengerRows = forwardOpen ? KEYS.map(k => ({ asset: NAME[k], v1: fwdReturn(k, V1[k]), e2: fwdReturn(k, CH[k]) })) : []
const pf = (f: 'v1' | 'e2') => 0.5 * (1 + challengerRows[0][f]) + 0.5 * (1 + challengerRows[1][f]) - 1

// ================================================================ 8. sorties
const num = (x: number, d = 3) => (Number.isFinite(x) ? x.toFixed(d).replace('.', ',').replace('-', '−') : '—')
const sgn = (x: number, d = 3) => (Number.isFinite(x) ? (x > 0 ? '+' : '') + num(x, d) : '—')
const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(2).replace('.', ',').replace('-', '−')} %` : '—')
let commit = 'inconnu', clean = false
try { commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); clean = execSync('git status --porcelain -- lib research/shock research/lib research/preregistration', { cwd: ROOT }).toString().trim() === '' } catch { /* hors git */ }
const lastMonth = P.monthLabel(P.monthKey(Math.floor((CUT - 1) / DAY)))

const L: string[] = []
L.push(`# Validation forward de E2 · BTC/ETH · évaluation de ${lastMonth}`, '')
L.push(`Plan : \`${PREREG}\`. Coupure : ${day(CUT)} (données jusqu'à la dernière bougie avant cette date). Fenêtre forward depuis le ${day(START)}. Produit par \`node research/shock/e2-forward.ts\` au commit \`${commit.slice(0, 7)}\`${clean ? '' : ' (arbre de travail modifié)'}.`, '')
L.push('La v1 reste figée. E2 est un challenger en shadow : aucun signal live n\'est ajouté, retiré ou redimensionné.', '')
L.push('Simulation sur données de marché après coûts modélisés. Pas une performance live.', '')
L.push('## Statut', '')
L.push(`**${state.status.toUpperCase()}**${state.status === 'H1 non confirmée' && state.reverse ? ' (sens inverse : D < 0)' : ''}`, '')
if (!forwardOpen) L.push(`La fenêtre forward n'a pas encore commencé à cette coupure : premier mois évalué, octobre 2026 (coupure du 2026-11-01).`, '')
L.push(`| | Shorts fermés | Moyenne de R |`, '|---|---|---|')
L.push(`| E2 baissier (N1) | ${dNow.n1} | ${sgn(dNow.m1)} |`, `| E2 non baissier (N0) | ${dNow.n0} | ${sgn(dNow.m0)} |`, `| D = écart | | ${sgn(dNow.d)} |`, '')
L.push(`Shorts forward encore ouverts à la coupure : ${openFwd}. Prochain regard : ${state.status !== 'en cours' ? 'aucun (étude conclue)' : (() => { const done = state.looks.filter(l => l.kind === 'interim').map(l => l.threshold ?? 0); const next = PLAN.interim.find(th => th > (done.length ? Math.max(...done) : 0)); return next ? `N1 = ${next} (intermédiaire), puis final à N1 ≥ ${PLAN.finalN} et N0 ≥ ${PLAN.finalN}` : `final à N1 ≥ ${PLAN.finalN} et N0 ≥ ${PLAN.finalN}` })()}.`, '')
L.push('La valeur de p n\'est calculée qu\'aux regards prévus.', '')
L.push('## Regards effectués', '')
if (state.looks.length) {
  L.push('| Coupure | Type | N1 | N0 | D | p | Seuil | Rejet de H0 |', '|---|---|---|---|---|---|---|---|')
  for (const l of state.looks) L.push(`| ${l.cutoff} | ${l.kind === 'final' ? 'final' : `intermédiaire (${l.threshold})`} | ${l.n1} | ${l.n0} | ${sgn(l.d)} | ${num(l.p, 4)} | ${num(l.alpha, 3)} | ${l.rejected ? 'oui' : 'non'} |`)
} else L.push('Aucun.')
L.push('')
L.push('## Par actif (descriptif)', '')
L.push('| Actif | N1 | Moyenne R (E2 baissier) | N0 | Moyenne R (non baissier) | D |', '|---|---|---|---|---|---|')
for (const [a, x] of Object.entries(byAsset(FWD))) L.push(`| ${a} | ${x.n1} | ${sgn(x.m1)} | ${x.n0} | ${sgn(x.m0)} | ${sgn(x.d)} |`)
L.push('')
L.push('## Challenger en shadow (descriptif)', '')
if (forwardOpen) {
  L.push('Rendement sur la fenêtre forward. Challenger : la v1 dont les shorts sont limités au régime E2 baissier depuis le début de la fenêtre.', '')
  L.push('| | v1 | Challenger E2 |', '|---|---|---|')
  for (const r of challengerRows) L.push(`| ${r.asset} | ${pct(r.v1)} | ${pct(r.e2)} |`)
  L.push(`| Portefeuille 50/50 | ${pct(pf('v1'))} | ${pct(pf('e2'))} |`, '')
} else L.push('Pas encore de fenêtre forward.', '')
L.push('## Référence historique (données déjà vues, hors décision)', '')
const dh = diff(HIST)
L.push(`Shorts de la v1 entrés avant le ${day(START)} : N1 = ${dh.n1} (moyenne R ${sgn(dh.m1)}), N0 = ${dh.n0} (moyenne R ${sgn(dh.m0)}), D = ${sgn(dh.d)}, intervalle bootstrap à 90 % ${sgn(histBoot.ci90[0])} à ${sgn(histBoot.ci90[1])}. Par actif : ${Object.entries(byAsset(HIST)).map(([a, x]) => `${a} D = ${sgn(x.d)} (${x.n1} / ${x.n0})`).join(' ; ')}. E2 a été choisie après avoir vu ces données : ce chiffre ne valide rien.`, '')
L.push('## Écarts au pré-enregistrement', '', 'Aucun.', '')
L.push(`## Contrôles (${checks.filter(c => c.ok).length}/${checks.length})`, '')
for (const c of checks) L.push(`- ${c.ok ? '✔' : '✘'} ${c.name} · ${c.detail}`)
L.push('')

const json = {
  preregistration: PREREG, commit, sourcesClean: clean, generatedAt: iso(Date.now()), cutoff: day(CUT), start: day(START),
  status: state.status, reverse: state.reverse, lookNow, looks: state.looks,
  forward: { n1: dNow.n1, n0: dNow.n0, m1: dNow.m1, m0: dNow.m0, d: dNow.d, open: openFwd, byAsset: byAsset(FWD), trades: FWD },
  challenger: challengerRows, history: { ...dh, ci90: histBoot.ci90, byAsset: byAsset(HIST) },
  data: Object.fromEntries(KEYS.map(k => [NAME[k], { lastBar: iso(S[k].bars.t[END[k]]), fileLastBar: iso(S[k].bars.t[S[k].end]) }])),
  checks,
}
const body = L.join('\n')
writeFileSync(join(OUT, 'latest.md'), body)
writeFileSync(join(OUT, `e2-forward-${lastMonth}.md`), body)
writeFileSync(LATEST, JSON.stringify(json, (_, x) => (typeof x === 'number' && !Number.isInteger(x) ? +x.toPrecision(12) : x), 1))
log(`écrit ${OUT} · ${state.status}${lookNow ? ` · regard ${lookNow.kind} p = ${lookNow.p}` : ''}`)
