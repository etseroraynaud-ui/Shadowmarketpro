// Publie les résultats du portefeuille BTC/ETH du Shock Engine pour le site, sans rien recalculer.
// Spécification publique depuis octobre 2026 : variante E2 (shorts seulement en régime de tendance
// journalier baissier), produite par `research/shock/portfolio.ts --variant e2`. Les résultats de la
// v1 restent dans research/reports/btc-eth-portfolio/ et ne sont plus publiés.
// - lib/research/btc-eth-portfolio.json : résumé et séries des graphiques, lus par les pages
//   /, /shock-engine, /shock-engine/portfolio, /research et /institutional ;
// - public/research/btc-eth-portfolio/ : rapport complet, CSV, résumé JSON et manifeste à télécharger.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/publish-portfolio.ts
//
// À lancer après research/shock/portfolio.ts. Le site ne lit jamais research/ (exclu du
// déploiement par .vercelignore) : tout ce qu'il affiche vient des fichiers écrits ici.

import { copyFileSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SRC = join(ROOT, 'research/reports/btc-eth-portfolio-e2')
const PUB = join(ROOT, 'public/research/btc-eth-portfolio')
const LIB = join(ROOT, 'lib/research')

const summary = JSON.parse(readFileSync(join(SRC, 'portfolio_summary.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(join(SRC, 'shock-engine-manifest.json'), 'utf8'))
// Refus de publier : contrôle de reproduction ou de cohérence en échec, ou résultats d'une autre variante.
if (manifest.sanityChecks.failed.length) throw new Error(`contrôles en échec : ${manifest.sanityChecks.failed.join(', ')}`)
if (summary.variant !== 'e2' || manifest.variant !== 'e2') throw new Error('les résultats à publier ne sont pas ceux de la spécification publique (variante e2)')
if (!manifest.validatedReference.every((r: { reproduced: boolean }) => r.reproduced)) throw new Error('sleeves non reproduites à l\'identique')

const csv = (f: string) => {
  const [head, ...rows] = readFileSync(join(SRC, f), 'utf8').trim().split('\n')
  const cols = head.split(',')
  return rows.map(r => Object.fromEntries(r.split(',').map((v, i) => [cols[i], i === 0 ? v : v === '' ? null : +v]))) as Record<string, number | string | null>[]
}
const daily = csv('portfolio_daily_returns.csv')
const rolling = csv('portfolio_correlation_rolling.csv')
const r4 = (x: number | string | null) => (typeof x === 'number' && Number.isFinite(x) ? +x.toPrecision(5) : null)
const col = (rows: Record<string, number | string | null>[], k: string) => rows.map(r => r4(r[k]))

// Rapprochement : les colonnes lues sont bien celles du résumé.
const last = daily[daily.length - 1]
const endEq = summary.series.portfolio.m.totalReturn * 100 + 100
if (Math.abs((last.portfolio_equity as number) - endEq) / endEq > 1e-6) throw new Error('equity finale du CSV différente du résumé')

// Sharpe glissant sur 365 jours (même définition que portfolio.ts : moyenne / écart type population des
// rendements journaliers × √365.25), dérivé des rendements journaliers publiés ; contrôlé contre les
// médianes du résumé avant publication.
const ret = (k: string) => daily.map(r => r[k] as number)
const rollSharpe = (r: number[], w = 365) => r.map((_, k) => {
  if (k + 1 < w) return null
  let s = 0, s2 = 0
  for (let j = k + 1 - w; j <= k; j++) { s += r[j]; s2 += r[j] * r[j] }
  const m = s / w, sd = Math.sqrt(Math.max(s2 / w - m * m, 0))
  return sd > 0 ? (m / sd) * Math.sqrt(365.25) : null
})
const RS = { btc: rollSharpe(ret('btc_return')), eth: rollSharpe(ret('eth_return')), portfolio: rollSharpe(ret('portfolio_return')) }
for (const [k, key] of [['btc', 'btc'], ['eth', 'eth'], ['portfolio', 'portfolio']] as const) {
  const f = (RS[k].filter(x => x !== null) as number[]).sort((x, y) => x - y)
  const pos = (f.length - 1) * 0.5, lo = Math.floor(pos), med = lo + 1 < f.length ? f[lo] + (pos - lo) * (f[lo + 1] - f[lo]) : f[lo]
  if (Math.abs(med - summary.stability.rolling12[key].median) > 1e-6) throw new Error(`Sharpe glissant ${k} : médiane ${med} ≠ résumé ${summary.stability.rolling12[key].median}`)
}

// Tests de falsification de la condition de tendance (données historiques déjà vues) et état de la
// validation forward : repris tels quels des rapports de recherche.
const RR = (f: string) => JSON.parse(readFileSync(join(ROOT, 'research/reports', f), 'utf8'))
const ab = RR('e2-falsification/tests-ab.json')
if (ab.checks.some((c: { ok: boolean }) => !c.ok)) throw new Error('tests de falsification : contrôle en échec')
const fwd = RR('e2-forward/latest.json')
if (fwd.checks.some((c: { ok: boolean }) => !c.ok)) throw new Error('validation forward : contrôle en échec')
const falsification = {
  source: 'research/reports/e2-falsification/tests-ab.json', prespec: 'research/preregistration/e2-falsification.md',
  randomSelection: { draws: ab.testA.assetYear.EV.n, ev: ab.e2.EV, evPercentile: ab.testA.assetYear.EV.percentile, evP: ab.testA.assetYear.EV.p, sharpePercentile: ab.testA.assetYear.sharpe5050.percentile, sharpeP: ab.testA.assetYear.sharpe5050.p },
  regimeShift: { shifts: ab.testB[0].eq.n, minShiftDays: ab.testB[0].kmin, d: ab.e2D.eq, percentile: ab.testB[0].eq.percentile, p: ab.testB[0].eq.p },
}
const forward = { prespec: 'research/preregistration/e2-forward.md', start: fwd.start, cutoff: fwd.cutoff, status: fwd.status, closedShorts: fwd.forward.n1 + fwd.forward.n0 }

const { reconciliation, sanity, ...rest } = summary
const out = {
  ...rest,
  manifest: {
    version: manifest.version, generatedAt: manifest.generatedAt, commit: manifest.git.commit, sourcesClean: manifest.git.sourcesClean,
    parametersSha256: manifest.strategy.parametersSha256, checksPassed: manifest.sanityChecks.passed, checksTotal: sanity.length,
    datasets: { btc: manifest.datasets.btc.instrument + ' · ' + manifest.datasets.btc.venue, eth: manifest.datasets.eth.instrument + ' · ' + manifest.datasets.eth.venue },
  },
  reconciliation: { btcOpenAtT0: reconciliation.btcOpenAtT0, common: reconciliation.common },
  chart: {
    start: daily[0].date,
    days: daily.length,
    eqBtc: col(daily, 'btc_equity'), eqEth: col(daily, 'eth_equity'), eqPortfolio: col(daily, 'portfolio_equity'),
    ddBtc: col(daily, 'btc_drawdown'), ddEth: col(daily, 'eth_drawdown'), ddPortfolio: col(daily, 'portfolio_drawdown'),
    corr90: col(rolling, 'rolling_90d'),
    sharpe365: { btc: RS.btc.map(r4), eth: RS.eth.map(r4), portfolio: RS.portfolio.map(r4) },
  },
  falsification, forward,
  downloads: [
    { file: 'btc-eth-portfolio.html', label: 'Full research report (HTML)' },
    { file: 'portfolio_daily_returns.csv', label: 'Daily returns and equity (CSV)' },
    { file: 'portfolio_monthly_returns.csv', label: 'Monthly returns (CSV)' },
    { file: 'portfolio_annual_returns.csv', label: 'Annual returns (CSV)' },
    { file: 'portfolio_drawdowns.csv', label: 'Drawdown episodes (CSV)' },
    { file: 'portfolio_correlation_rolling.csv', label: 'Rolling correlations (CSV)' },
    { file: 'portfolio_summary.json', label: 'Machine-readable summary (JSON)' },
    { file: 'shock-engine-manifest.json', label: 'Research manifest: versions and hashes (JSON)' },
  ],
}

mkdirSync(PUB, { recursive: true })
mkdirSync(LIB, { recursive: true })
// Le dossier public ne garde que les fichiers publiés ici (les copies retirées restent dans research/reports).
const keep = new Set(out.downloads.map(d => d.file))
for (const f of readdirSync(PUB)) if (!keep.has(f)) { unlinkSync(join(PUB, f)); process.stderr.write(`retiré du dossier public : ${f}\n`) }
for (const d of out.downloads) copyFileSync(join(SRC, d.file), join(PUB, d.file))
writeFileSync(join(LIB, 'btc-eth-portfolio.json'), JSON.stringify(out))
process.stderr.write(`écrit lib/research/btc-eth-portfolio.json et ${out.downloads.length} fichiers dans public/research/btc-eth-portfolio\n`)
