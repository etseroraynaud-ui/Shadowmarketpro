// Walk-forward Bitcoin à fenêtres plus longues (research/preregistration/wf-longer-windows.md) :
// synthèse des 12 configurations calculées par wf-plateau.ts (--calm), sans rien recalculer.
//
//   for t in 36 48 60 exp; do for s in 3 6 12; do
//     node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/wf-plateau.ts --train $t --test $s --calm
//   done; done
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/wf-longer.ts
//
// Écrit research/reports/wf-longer/wf-longer.{md,json}.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/wf-longer')
const TRAINS = ['36', '48', '60', 'exp'] as const
const TESTS = [3, 6, 12] as const
/** Résultat publié de la configuration de référence, à retrouver à l'identique (contrôle bloquant). */
const PUBLISHED = { sharpe: 0.83, trades: 390, fixed: 1.55 }
/** Règle de lecture pré-enregistrée (§ 5). */
const RULE = { shortWindows: 1.2, notWindows: 1.0 }

const n = (s: string) => Number(s.replace('−', '-').replace(/[^\d.-]/g, ''))
const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

interface Config { train: string; test: number; file: string; windows: number; period: string; sharpe: number; sortino: number; cagr: number; maxDD: number; trades: number; fixedSharpe: number; fixedCagr: number; ratio: number }
const configs: Config[] = []
for (const train of TRAINS) for (const test of TESTS) {
  const file = `shock-15m-wf-plateau-${train}-${test}-calm.md`
  const md = readFileSync(join(ROOT, 'research/reports', file), 'utf8')
  const row = (re: RegExp) => { const l = md.split('\n').find(x => re.test(x)); if (!l) throw new Error(`${file} : ligne ${re} absente`); return l.split('|').map(x => x.trim()) }
  const wf = row(/^\| \*\*Walk-forward, plateaux\*\*/), fx = row(/^\| Préréglage fixe/)
  const head = md.split('\n').find(l => l.startsWith('BTC/USD Bitstamp'))!
  const win = head.match(/de (\d{4}-\d{2}-\d{2}) au (\d{4}-\d{2}-\d{2}) \((\d+) fenêtres\)/)
  if (!win) throw new Error(`${file} : période introuvable`)
  configs.push({ train, test, file, windows: Number(win[3]), period: `${win[1]} → ${win[2]}`, sharpe: n(wf[4]), sortino: n(wf[5]), cagr: n(wf[3]) / 100, maxDD: n(wf[6]) / 100, trades: n(wf[8]), fixedSharpe: n(fx[4]), fixedCagr: n(fx[3]) / 100, ratio: n(wf[4]) / n(fx[4]) })
}

// ---------------------------------------------------------------- contrôles
const checks: { name: string; ok: boolean; detail: string }[] = []
const ref = configs.find(c => c.train === '36' && c.test === 3)!
checks.push({ name: '36/3 = résultat publié', ok: ref.sharpe === PUBLISHED.sharpe && ref.trades === PUBLISHED.trades && ref.fixedSharpe === PUBLISHED.fixed, detail: `Sharpe ${ref.sharpe}, ${ref.trades} trades, préréglage ${ref.fixedSharpe}` })
checks.push({ name: 'même période de test pour les 12', ok: new Set(configs.map(c => c.period)).size === 1, detail: [...new Set(configs.map(c => c.period))].join(' ; ') })
checks.push({ name: 'même préréglage fixe pour les 12', ok: new Set(configs.map(c => c.fixedSharpe)).size === 1, detail: [...new Set(configs.map(c => c.fixedSharpe))].join(' ; ') })
checks.push({ name: '12 configurations', ok: configs.length === 12, detail: String(configs.length) })
const failed = checks.filter(c => !c.ok)
if (failed.length) throw new Error(`contrôles en échec : ${failed.map(c => `${c.name} (${c.detail})`).join(' ; ')}`)

// ---------------------------------------------------------------- synthèse
const sh = configs.map(c => c.sharpe)
const med = median(sh)
const lo = configs.reduce((a, c) => (c.sharpe < a.sharpe ? c : a)), hi = configs.reduce((a, c) => (c.sharpe > a.sharpe ? c : a))
const verdict = med >= RULE.shortWindows ? 'short-windows' : med <= RULE.notWindows ? 'not-windows' : 'mixed'
/** Sharpe au-delà duquel une configuration est citée à part dans la lecture. */
const HIGH = 1.3
const key = (c: Config) => `${c.train === 'exp' ? 'croissante' : `${c.train} mois`} / ${c.test} mois`
const summary = {
  configs: configs.length, median: med, min: lo.sharpe, max: hi.sharpe, minKey: `${lo.train}/${lo.test}`, maxKey: `${hi.train}/${hi.test}`,
  medianRatio: median(configs.map(c => c.ratio)), fixedSharpe: ref.fixedSharpe, belowFixed: configs.filter(c => c.sharpe < c.fixedSharpe).length,
  medianMaxDD: median(configs.map(c => c.maxDD)), worstMaxDD: Math.min(...configs.map(c => c.maxDD)),
  reference: { train: '36', test: 3, sharpe: ref.sharpe }, verdict,
}
const high = configs.filter(c => c.sharpe > HIGH)
const highOther = configs.filter(c => !high.includes(c) && high.some(h => h.train === c.train))
mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'wf-longer.json'), JSON.stringify({ generatedAt: new Date().toISOString(), prespec: 'research/preregistration/wf-longer-windows.md', period: ref.period, rule: RULE, summary, configs, checks }, null, 1) + '\n')

const f2 = (x: number) => x.toFixed(2).replace('.', ',').replace('-', '−')
const p1 = (x: number) => `${(x * 100).toFixed(1).replace('.', ',').replace('-', '−')} %`
const L: string[] = []
L.push('# Walk-forward Bitcoin à fenêtres plus longues — 12 configurations', '')
L.push(`Protocole : \`research/preregistration/wf-longer-windows.md\` (commité avant calcul). Règles publiées (entrées en régime calme, shorts en tendance baissière), BTC/USD Bitstamp 15 min, même méthode de plateaux, même période de test pour toutes : ${ref.period}. Préréglage fixe sur la même période : Sharpe ${f2(ref.fixedSharpe)} (flatteur : choisi sur 2017–2026). Sharpe et Sortino sur les rendements par bougie de 15 min.`, '')
L.push('| Calibration / test | fenêtres | Sharpe | Sortino | CAGR | pire baisse | trades | walk-forward / fixe |', '|---|---:|---:|---:|---:|---:|---:|---:|')
for (const c of configs) L.push(`| ${c === ref ? `**${key(c)} (référence publiée)**` : key(c)} | ${c.windows} | ${f2(c.sharpe)} | ${f2(c.sortino)} | ${p1(c.cagr)} | ${p1(c.maxDD)} | ${c.trades} | ${Math.round(c.ratio * 100)} % |`)
L.push('')
L.push(`**Médiane des 12 Sharpe : ${f2(med)}** (étendue ${f2(lo.sharpe)} pour ${key(lo)} à ${f2(hi.sharpe)} pour ${key(hi)}) ; rapport médian au préréglage fixe ${Math.round(summary.medianRatio * 100)} %. ${summary.belowFixed} configurations sur 12 restent sous le préréglage fixe. Pire baisse médiane ${p1(summary.medianMaxDD)}, la plus forte ${p1(summary.worstMaxDD)}.`, '')
L.push('## Lecture (règle fixée avant calcul)', '')
L.push(verdict === 'not-windows'
  ? `La médiane (${f2(med)}) est ≤ ${f2(RULE.notWindows)} : **la longueur des fenêtres n'explique pas la faiblesse du walk-forward.** Allonger la calibration ou les tests améliore un peu le résultat en moyenne (${configs.filter(c => c.sharpe > ref.sharpe).length} configurations sur 11 au-dessus de la référence), sans le rapprocher du préréglage fixe.${high.length ? ` Seules ${high.map(key).join(' et ')} dépassent ${f2(HIGH)} ; ${highOther.map(c => `${key(c)} donne ${f2(c.sharpe)}${c.maxDD === summary.worstMaxDD ? ' avec la plus forte baisse de l\'étude' : ''}`).join(', ')} : le résultat dépend du découpage et n'est pas stable.` : ''}`
  : verdict === 'short-windows'
    ? `La médiane (${f2(med)}) est ≥ ${f2(RULE.shortWindows)} : la faiblesse tient en partie à des fenêtres trop courtes.`
    : `La médiane (${f2(med)}) est entre ${f2(RULE.notWindows)} et ${f2(RULE.shortWindows)} : résultat mitigé.`, '')
L.push('La configuration 36/3 reste la référence publiée : elle a été fixée avant de connaître son résultat, alors que cette étude a été demandée après. Un walk-forward reste un test sur l\'historique déjà utilisé pour concevoir la stratégie ; il mesure le coût de la re-sélection des réglages, pas la performance future.', '')
L.push('## Contrôles', '')
for (const c of checks) L.push(`- ${c.ok ? 'OK' : 'ÉCHEC'} — ${c.name} : ${c.detail}`)
writeFileSync(join(OUT, 'wf-longer.md'), L.join('\n') + '\n')
process.stderr.write(`médiane ${med.toFixed(3)}, étendue ${lo.sharpe}–${hi.sharpe}, verdict ${verdict} → research/reports/wf-longer/\n`)
