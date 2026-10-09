// Compose le papier de recherche du Shock Engine (PDF, LaTeX) à partir des résultats publiés, sans
// rien recalculer : chaque chiffre du texte, des tableaux et des figures est lu dans
// - lib/research/btc-eth-portfolio.json (résumé publié par research/shock/publish-portfolio.ts) ;
// - research/reports/residual-alpha/residual-alpha.json ;
// - research/reports/e2-falsification/test-c.json (test C, marchés synthétiques) ;
// - research/reports/shock-15m-wf-plateau-36-3-e2.md (walk-forward, ligne du préréglage fixe) ;
// - research/preregistration/e2-forward.md (date de coupure du test prospectif) ;
// - app/live/accounts.ts (date de départ du bot testnet).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/paper/build-paper.ts
//
// Écrit research/reports/paper/shock-engine-research-paper.{tex,pdf} et les données des figures
// (research/reports/paper/data/). Demande pdflatex et latexmk (TeX Live : latex-recommended,
// latex-extra, fonts-recommended, pictures, science). Le PDF est ensuite publié sur le site par
// research/shock/publish-portfolio.ts.

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'research/reports/paper')
const DATA = join(OUT, 'data')
const NAME = 'shock-engine-research-paper'

const json = (f: string) => JSON.parse(readFileSync(join(ROOT, f), 'utf8'))
const text = (f: string) => readFileSync(join(ROOT, f), 'utf8')
const P = json('lib/research/btc-eth-portfolio.json')
const RA = json('research/reports/residual-alpha/residual-alpha.json')
const TC = json('research/reports/e2-falsification/test-c.json')
const WF = text('research/reports/shock-15m-wf-plateau-36-3-e2.md')
const FWD = text('research/preregistration/e2-forward.md')
const ACC = text('app/live/accounts.ts')

// Refus de composer : résultats d'une autre variante, contrôles en échec, ou sources désaccordées.
if (P.variant !== 'e2') throw new Error('le résumé publié n\'est pas celui de la spécification E2')
if (P.manifest.checksPassed !== P.manifest.checksTotal) throw new Error('contrôles du portefeuille en échec')
if (!RA.checks.every((c: { ok: boolean }) => c.ok)) throw new Error('contrôles de l\'alpha résiduel en échec')
if (RA.period[0] !== P.commonPeriod.start || RA.period[1] !== P.commonPeriod.end) throw new Error('période de l\'alpha résiduel ≠ période du portefeuille')
if (Math.abs(RA.main.alphaAnn - P.residualAlpha.alphaAnn) > 1e-9) throw new Error('alpha résiduel publié ≠ rapport')
const tcId = TC.identity.pf.e2
if (Math.abs(tcId.sharpe - P.series.portfolio.m.sharpe) > 0.01) throw new Error('chemin identité du test C ≠ portefeuille publié')

// ---------------------------------------------------------------- mise en forme
const minus = (s: string) => s.replace(/^-/, '\\ensuremath{-}')
const fx = (x: number, d = 2) => minus(x.toFixed(d))
const pct = (x: number, d = 1) => `${minus((x * 100).toFixed(d))}\\%`
const int = (x: number) => Math.round(x).toLocaleString('en-US').replace(/,/g, '{,}')
const pval = (p: number) => (p < 0.001 ? p.toFixed(4) : p.toFixed(3))
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const longDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return `${d}~${MONTHS[m - 1]} ${y}` }
const monthYear = (iso: string) => { const [y, m] = iso.split('-').map(Number); return `${MONTHS[m - 1].slice(0, 3)}.~${y}` }
const need = <T,>(x: T | undefined | null, what: string): T => { if (x === undefined || x === null) throw new Error(`introuvable : ${what}`); return x }

// ---------------------------------------------------------------- séries des figures
const C = P.chart
const d0 = Date.parse(`${C.start}T00:00:00Z`)
const yearOf = (i: number) => { const t = new Date(d0 + i * 864e5); const y = t.getUTCFullYear(); const a = Date.UTC(y, 0, 1), b = Date.UTC(y + 1, 0, 1); return y + (t.getTime() - a) / (b - a) }
const STEP = 2
function dat(file: string, cols: Record<string, (number | null)[]>) {
  const keys = Object.keys(cols)
  const lines = [`x ${keys.join(' ')}`]
  for (let i = 0; i < C.days; i += STEP) {
    const row = keys.map(k => cols[k][i])
    if (row.some(v => v === null || !Number.isFinite(v))) continue
    lines.push(`${yearOf(i).toFixed(4)} ${row.map(v => (v as number).toPrecision(5)).join(' ')}`)
  }
  const last = C.days - 1
  if ((C.days - 1) % STEP) lines.push(`${yearOf(last).toFixed(4)} ${keys.map(k => (cols[k][last] as number).toPrecision(5)).join(' ')}`)
  writeFileSync(join(DATA, file), lines.join('\n') + '\n')
}

// ---------------------------------------------------------------- tableaux
const F = P.series.portfolio, B = P.series.btc, E = P.series.eth, BH = P.buyHold
const CP = P.commonPeriod
const period = `${longDate(CP.start)} to ${longDate(CP.end)}`

const table = (o: { label: string; caption: string; cols: string; head: string; body: string; notes?: string; size?: string; sep?: string }) => String.raw`\begin{table}[tbp]
\centering${o.size ?? '\\small'}${o.sep ? `\\setlength{\\tabcolsep}{${o.sep}}` : ''}
\begin{threeparttable}
\caption{${o.caption}}\label{${o.label}}
\begin{tabular}{${o.cols}}
\toprule
${o.head}
\midrule
${o.body}
\bottomrule
\end{tabular}
${o.notes ? `\\begin{tablenotes}[flushleft]\\footnotesize\n\\item ${o.notes}\n\\end{tablenotes}` : ''}
\end{threeparttable}
\end{table}`
const row = (...c: string[]) => `${c.join(' & ')} \\\\`
const NA = '--'

const TABLE_HEADLINE = table({
  label: 'tab:headline',
  caption: `Headline performance, ${period}`,
  sep: '5pt',
  cols: 'lrrrr',
  head: row('', 'Portfolio 50/50', 'Bitcoin', 'Ether', 'Buy-and-hold'),
  body: [
    row('Final value of 100', int(100 * (1 + F.m.totalReturn)), int(100 * (1 + B.m.totalReturn)), int(100 * (1 + E.m.totalReturn)), int(100 * (1 + BH.totalReturn))),
    row('CAGR', pct(F.m.cagr), pct(B.m.cagr), pct(E.m.cagr), pct(BH.cagr)),
    row('Annualised volatility', pct(F.m.vol), pct(B.m.vol), pct(E.m.vol), pct(BH.vol)),
    row('Sharpe ratio', fx(F.m.sharpe), fx(B.m.sharpe), fx(E.m.sharpe), fx(BH.sharpe)),
    row('Sortino ratio', fx(F.m.sortino), fx(B.m.sortino), fx(E.m.sortino), NA),
    row('Maximum drawdown', pct(F.m.maxDD), pct(B.m.maxDD), pct(E.m.maxDD), pct(BH.maxDD)),
    row('Calmar ratio', fx(F.m.calmar), fx(B.m.calmar), fx(E.m.calmar), fx(BH.calmar)),
    row('Skewness of daily returns', fx(F.m.skew), fx(B.m.skew), fx(E.m.skew), NA),
    '\\midrule',
    row('Trades (long / short)', `${int(F.trades.trades)} (${int(F.trades.long)} / ${int(F.trades.short)})`, `${int(B.trades.trades)} (${int(B.trades.long)} / ${int(B.trades.short)})`, `${int(E.trades.trades)} (${int(E.trades.long)} / ${int(E.trades.short)})`, NA),
    row('Trades per year', fx(F.trades.perYear, 0), fx(B.trades.perYear, 0), fx(E.trades.perYear, 0), NA),
    row('Win rate', pct(F.trades.winRate, 0), pct(B.trades.winRate, 0), pct(E.trades.winRate, 0), NA),
    row('Average win / average loss', fx(F.trades.payoff), fx(B.trades.payoff), fx(E.trades.payoff), NA),
    row('Profit factor', fx(F.trades.profitFactor), fx(B.trades.profitFactor), fx(E.trades.profitFactor), NA),
    row('Median holding time (hours)', fx(F.trades.holdMedianH, 1), fx(B.trades.holdMedianH, 1), fx(E.trades.holdMedianH, 1), NA),
    row('Time in market', pct(F.expo.timeInMarket, 0), pct(B.expo.timeInMarket, 0), pct(E.expo.timeInMarket, 0), '100\\%'),
  ].join('\n'),
  notes: `Historical simulation of specification E2 after modelled transaction costs; not live performance. Daily UTC close-to-close returns, annualised with $\\sqrt{365.25}$, zero risk-free rate. Commission 0.045\\% per order; no slippage, funding or leverage. Bitcoin and Ether columns are the two halves of the portfolio, each measured on its own capital. Buy-and-hold: half of the capital in each coin on ${longDate(BH.from)}, no rebalancing, no costs. Win rate, payoff and profit factor are computed on closed trades; the portfolio column pools the trades of both markets.`,
})

const BHI = (iso: string) => C.eqBuyHold[Math.round((Date.parse(`${iso}T00:00:00Z`) - d0) / 864e5)] as number
const TABLE_ANNUAL = table({
  label: 'tab:annual',
  caption: 'Calendar-year returns',
  cols: 'lrrrrrr',
  head: row('Year', 'Bitcoin', 'Ether', 'Portfolio', 'Sharpe', 'Max.~drawdown', 'Buy-and-hold'),
  body: P.annual.map((a: { year: number; partial: boolean; from: string; to: string; btc: number; eth: number; portfolio: number; portfolioSharpe: number; portfolioDD: number }, k: number) => {
    const prev = k === 0 ? 100 : BHI(P.annual[k - 1].to)
    return row(`${a.year}${a.partial ? '\\tnote{a}' : ''}`, pct(a.btc), pct(a.eth), pct(a.portfolio), fx(a.portfolioSharpe), pct(a.portfolioDD), pct(BHI(a.to) / prev - 1))
  }).join('\n'),
  notes: `\\textsuperscript{a}\\,Partial year (${P.annual.filter((a: { partial: boolean }) => a.partial).map((a: { from: string; to: string }) => `${longDate(a.from)} to ${longDate(a.to)}`).join('; ')}). Sharpe ratio and maximum drawdown are those of the portfolio within the year. Buy-and-hold is the 50/50 benchmark of Table~\\ref{tab:headline}.`,
})

const st = P.costs.stress as { commissionPct: number; portfolio: { sharpe: number; cagr: number; maxDD: number } }[]
const sl = P.stress.slippage as { slippagePctPerOrder: number; sharpe: number }[]
const fu = P.stress.funding as { scenario: string; sharpe: number; cagr: number; maxDD: number }[]
const FUNDING_LABELS = ['Historical perpetual funding (Binance)', '\\quad with Hyperliquid funding from May 2023', 'Stress: shorts pay 0.01\\% per 8 hours throughout']
if (fu.length !== FUNDING_LABELS.length || !/historical Binance/.test(fu[0].scenario) || !/Hyperliquid/.test(fu[1].scenario) || !/stress/.test(fu[2].scenario)) throw new Error('scénarios de financement inattendus')
const TABLE_FRICTIONS = table({
  label: 'tab:frictions',
  caption: 'Transaction costs, slippage and funding (portfolio 50/50)',
  cols: 'lrrr',
  head: row('Scenario', 'Sharpe', 'CAGR', 'Max.~drawdown'),
  body: [
    '\\multicolumn{4}{l}{\\textit{Commission per order}}\\\\',
    ...st.map(s => row(`\\quad ${s.commissionPct.toFixed(3)}\\%${s.commissionPct === 0.045 ? ' (base case)' : ''}`, fx(s.portfolio.sharpe), pct(s.portfolio.cagr), pct(s.portfolio.maxDD))),
    '\\multicolumn{4}{l}{\\textit{Slippage per order, on top of the base commission}}\\\\',
    ...sl.filter(s => s.slippagePctPerOrder > 0).map(s => row(`\\quad ${s.slippagePctPerOrder.toFixed(2)}\\%`, fx(s.sharpe), NA, NA)),
    '\\multicolumn{4}{l}{\\textit{Perpetual funding, on top of the base commission}}\\\\',
    ...fu.map((s, k) => row(`\\quad ${FUNDING_LABELS[k]}`, fx(s.sharpe), pct(s.cagr), pct(s.maxDD))),
  ].join('\n'),
  notes: 'Funding is applied with its sign to long and short positions held across funding times; before 2020 a constant 0.01\\% per 8 hours is assumed. Market impact and capacity are not modelled.',
})

type Ev = { label: string; period: string[]; verdict: { eventsPreset: boolean; eventsShockTrend: boolean; preset: { pf: boolean; sharpe: boolean; random: boolean; delay: boolean } }; meanTrade: number; sharpe: number; cagr: number; dd: number; trades: number; randomBeaten: number; delay1Share: number }
const verdictOf = (z: Ev) => {
  const v = z.verdict, strat = v.preset.pf && v.preset.sharpe && v.preset.random && v.preset.delay
  if (strat && v.eventsPreset && v.eventsShockTrend) return 'pass'
  if (strat || (v.preset.sharpe && v.preset.random)) return 'partial'
  return 'fail'
}
const MARKETS: [string, string, string][] = [
  ['btc', 'Bitcoin', 'Bitstamp'], ['eth', 'Ether', 'Binance'], ['ethDukascopy', 'Ether', 'Dukascopy'],
  ['sol', 'Solana', 'Binance'], ['gold', 'Gold', 'Dukascopy'], ['tao', 'TAO', 'Binance'],
]
const TABLE_TRANSFER = table({
  label: 'tab:transfer',
  caption: 'Pre-set criteria by market, rules calibrated on Bitcoin only',
  size: '\\footnotesize',
  sep: '3.6pt',
  cols: 'llcrrrrrrl',
  head: row('Market', 'Feed', 'Period', 'Trades', 'Sharpe', 'CAGR', 'Max.~DD', 'Random', 'Delay', 'Verdict'),
  body: MARKETS.map(([k, name, feed]) => {
    const z = need(P.evidence[k], `evidence.${k}`) as Ev
    const verdict = k === 'btc' ? `${verdictOf(z)} (in-sample)` : verdictOf(z)
    const delay = z.meanTrade > 0 ? pct(z.delay1Share, 0) : 'n.m.'
    return row(name, feed, `${z.period[0].slice(0, 4)}--${z.period[1].slice(0, 4)}`, int(z.trades), fx(z.sharpe), pct(z.cagr), pct(z.dd), pct(z.randomBeaten, 0), delay, verdict)
  }).join('\n'),
  notes: 'Each market is simulated over its full history with the Bitcoin rules unchanged. Sharpe ratios here are annualised from 15-minute returns and differ slightly from the daily figures of Table~\\ref{tab:headline}. \\emph{Random}: share of 200 random-entry runs with identical exits that the strategy beats (criterion: above 95\\%). \\emph{Delay}: share of the average trade kept when every entry is delayed by one bar (n.m.: not meaningful, average trade not positive). \\emph{Verdict}: pass when the event study, profit factor, Sharpe, random-entry and delay criteria are all met; partial when the strategy criteria are met without the event study, or when only the Sharpe and random-entry criteria are met.',
})

type Lv = { level: number; medianSharpe: number; p10: number; p90: number; preset: number; rank: number; profitable: number }
const TABLE_NEIGH = table({
  label: 'tab:neigh',
  caption: 'Parameter neighbourhoods: all parameters perturbed jointly, 300 neighbours per level',
  cols: 'lrrrrrr',
  head: row('Market', 'Perturbation', 'Median Sharpe', 'P10--P90', 'Chosen', 'Rank of chosen', 'Profitable'),
  body: ([['robBtc', 'Bitcoin'], ['robEth', 'Ether']] as const).map(([k, name]) => (P.evidence[k].levels as Lv[]).map((l, j) =>
    row(j === 0 ? name : '', `$\\pm${(l.level * 100).toFixed(0)}\\%$`, fx(l.medianSharpe), `${fx(l.p10)}--${fx(l.p90)}`, fx(l.preset), pct(l.rank, 0), pct(l.profitable, 0)))).flat().join('\n'),
  notes: 'Sharpe ratios annualised from 15-minute returns over each market\'s full history. \\emph{Rank of chosen}: percentile of the chosen parameters within their neighbourhood. \\emph{Profitable}: share of neighbours with a positive total return.',
})

// Alpha résiduel : M0, M1, M2 sur le portefeuille, puis références et sensibilités.
type Mdl = { model: string; series: string; alphaAnn: number; t: number; ir: number; r2: number; unexplained: number; betas: { name: string; beta: number; t: number }[] }
const FACTOR: Record<string, string> = {
  'BH BTC': 'Buy-and-hold Bitcoin', 'BH ETH': 'Buy-and-hold Ether', TSMOM30: 'TSMOM 30 days', TSMOM90: 'TSMOM 90 days', TSMOM180: 'TSMOM 180 days',
  'DONCH55/20': 'Breakout 55/20 days', 'EMA20/100': 'Moving averages 20/100 days', 'DONCH15 96/48': 'Intraday breakout 24h/12h',
}
const BENCH: Record<string, string> = { BH: 'Buy-and-hold 50/50', ...FACTOR }
const models = ['M0', 'M1', 'M2'].map(m => need((RA.models as Mdl[]).find(x => x.model === m && x.series === 'portfolio'), `modèle ${m}`))
const coef = (b: number, t: number, d = 3) => `\\makecell[r]{${fx(b, d)}\\\\[-1pt]{\\scriptsize(${fx(t)})}}`
const factorRows = Object.keys(FACTOR).map(f => row(FACTOR[f], ...models.map(m => { const b = m.betas.find(x => x.name === f); return b ? coef(b.beta, b.t) : '' })))
const S = RA.sensitivities
const TABLE_ALPHA = [table({
  label: 'tab:alpha',
  caption: 'Residual alpha of the portfolio: regressions of daily returns on benchmark strategies',
  cols: 'lrrr',
  head: row('', 'M0', 'M1', 'M2 (pre-set)'),
  body: [
    row('$\\alpha$ (annualised)', ...models.map(m => `\\makecell[r]{${pct(m.alphaAnn)}\\\\[-1pt]{\\scriptsize(${fx(m.t)})}}`)),
    '\\addlinespace',
    ...factorRows,
    '\\midrule',
    row('$R^2$', ...models.map(m => fx(m.r2, 3))),
    row('Residual information ratio', ...models.map(m => fx(m.ir))),
    row('Share of mean return unexplained', ...models.map(m => pct(m.unexplained, 0))),
    row('Bootstrap $P(\\alpha\\le0)$', NA, NA, `${RA.bootstrap.pNonPositive.toFixed(4)}`),
    row('Bootstrap 90\\% interval of $\\alpha$', NA, NA, `${pct(RA.bootstrap.p5)} to ${pct(RA.bootstrap.p95)}`),
  ].join('\n'),
  notes: `${int(RA.days)} daily observations, ${period}. Newey--West $t$-statistics in parentheses (lag ${RA.nwLag}). M0: buy-and-hold only; M1: adds five daily trend strategies; M2: adds the intraday breakout. Bootstrap: ${int(RA.bootstrap.reps)} resamples of ${RA.bootstrap.months} calendar months, the same months for all series. Pre-set verdict for M2: $\\alpha>0$, $t\\ge3$ and $P(\\alpha\\le0)<0.01$.`,
}), table({
  label: 'tab:bench',
  caption: 'Benchmark strategies on their own, and sensitivity of the residual alpha',
  cols: 'lrrrr',
  head: row('Benchmark (50/50, after costs)', 'Sharpe', 'CAGR', 'Max.~drawdown', 'Corr.~with SE'),
  body: [
    ...(RA.benchmarks as { id: string; '50/50': { sharpe: number; cagr: number; maxDD: number }; corrPortfolio: number }[]).map(b =>
      row(need(BENCH[b.id], b.id), fx(b['50/50'].sharpe), pct(b['50/50'].cagr), pct(b['50/50'].maxDD), fx(b.corrPortfolio))),
    row('Shock Engine portfolio', fx(F.m.sharpe), pct(F.m.cagr), pct(F.m.maxDD), '1.00'),
    '\\midrule',
    row('\\textit{Sensitivity of M2}', '$\\alpha$', '$t$', '$R^2$', 'IR'),
    '\\midrule',
    ...([['S1', '19 trend strategies (full grid)'], ['S2 first', `First half (${monthYear(CP.start)}--${monthYear(P.stability.subPeriods.firstHalf.to)})`], ['S2 second', `Second half (${monthYear(P.stability.subPeriods.secondHalf.from)}--${monthYear(CP.end)})`], ['S3', 'Weekly returns'], ['S4', 'Benchmarks without costs']] as const).map(([k, label]) => {
      const s = need(S[k], `sensibilité ${k}`)
      return row(label, pct(s.alphaAnn), fx(s.t), fx(s.r2, 3), fx(s.ir))
    }),
  ].join('\n'),
  notes: 'Benchmarks average the two markets with daily rebalancing and pay the same commission as Shock Engine (0.045\\% per order); buy-and-hold carries no costs. Corr.~with SE: correlation of daily returns with the Shock Engine portfolio. Definitions in Appendix~\\ref{app:bench}.',
})].join('\n\n')

// ---------------------------------------------------------------- figures
mkdirSync(DATA, { recursive: true })
dat('equity.dat', { pf: C.eqPortfolio, btc: C.eqBtc, eth: C.eqEth, bh: C.eqBuyHold })
dat('drawdown.dat', { pf: C.ddPortfolio, bh: C.ddBuyHold })
dat('rolling.dat', { pf: C.sharpe365.portfolio })
const firstYear = Math.ceil(yearOf(0)), lastYear = Math.floor(yearOf(C.days - 1))
const xticks = Array.from({ length: lastYear - firstYear + 1 }, (_, k) => firstYear + k).join(',')
const xaxis = `xmin=${yearOf(0).toFixed(3)}, xmax=${yearOf(C.days - 1).toFixed(3)}, xtick={${xticks}}, x tick label style={/pgf/number format/1000 sep={}}, xticklabel={\\pgfmathprintnumber[fixed,precision=0,1000 sep={}]{\\tick}}`
const axisStyle = 'width=\\textwidth, axis lines*=left, grid=major, grid style={gray!20}, tick label style={font=\\footnotesize}, label style={font=\\footnotesize}, legend style={font=\\footnotesize, draw=none, fill=white, fill opacity=0.85, text opacity=1}, legend cell align=left'

const FIGURE_EQUITY = String.raw`\begin{figure}[tbp]
\centering
\begin{tikzpicture}
\begin{semilogyaxis}[${axisStyle}, height=7.2cm, ${xaxis}, ylabel={Value of 100 (log scale)}, legend pos=north west, log ticks with fixed point, ytick={25,50,100,250,500,1000,2500,5000}, yticklabel style={/pgf/number format/1000 sep={,}}]
\addplot[pfcol, very thick] table[x=x, y=pf] {data/equity.dat};
\addplot[btccol, thin] table[x=x, y=btc] {data/equity.dat};
\addplot[ethcol, thin] table[x=x, y=eth] {data/equity.dat};
\addplot[bhcol, thick, dashed] table[x=x, y=bh] {data/equity.dat};
\legend{Portfolio 50/50, Bitcoin, Ether, Buy-and-hold 50/50}
\end{semilogyaxis}
\end{tikzpicture}
\caption{Equity curves, ${period}, daily closes. Historical simulation after modelled transaction costs; buy-and-hold without costs.}\label{fig:equity}
\end{figure}`

const FIGURE_DRAWDOWN = String.raw`\begin{figure}[tbp]
\centering
\begin{tikzpicture}
\begin{axis}[${axisStyle}, height=5.2cm, ${xaxis}, ylabel={Drawdown}, ymax=0, yticklabel={\pgfmathparse{\tick*100}\pgfmathprintnumber[fixed,precision=0]{\pgfmathresult}\%}, legend pos=south west]
\addplot[bhcol, fill=bhcol!18, thin] table[x=x, y=bh] {data/drawdown.dat} \closedcycle;
\addplot[pfcol, fill=pfcol!35, thin] table[x=x, y=pf] {data/drawdown.dat} \closedcycle;
\legend{Buy-and-hold 50/50, Portfolio 50/50}
\end{axis}
\end{tikzpicture}
\caption{Drawdowns from the running peak, daily closes. Maximum: ${pct(F.m.maxDD)} for the portfolio, ${pct(BH.maxDD)} for buy-and-hold.}\label{fig:dd}
\end{figure}`

const R12 = P.stability.rolling12.portfolio
const FIGURE_ROLLING = String.raw`\begin{figure}[tbp]
\centering
\begin{tikzpicture}
\begin{axis}[${axisStyle}, height=5cm, ${xaxis}, ylabel={Sharpe ratio}, ymin=0]
\addplot[black!45, dashed, domain=2010:2040, forget plot] {1};
\addplot[pfcol, thick] table[x=x, y=pf] {data/rolling.dat};
\end{axis}
\end{tikzpicture}
\caption{Rolling 365-day Sharpe ratio of the portfolio (${int(R12.n)} windows). Positive in ${pct(R12.positive, 0)} of windows, above one (dashed) in ${pct(R12.aboveOne, 0)}; median ${fx(R12.median)}, minimum ${fx(R12.min)}.}\label{fig:rolling}
\end{figure}`

const LS = ['L1', 'L3', 'L7', 'L14', 'L30']
const tcRows = LS.map(L => {
  const s = need(TC.summary[L], `test C ${L}`)
  const ev = s['Portefeuille 50/50|dEV'], sr = s['Portefeuille 50/50|dSharpe']
  return { L: L.slice(1), n: ev.n, p5: ev.p5, p50: ev.p50, p95: ev.p95, hist: ev.hist, pct: ev.histPercentile, pPos: ev.pPos, srPct: sr.histPercentile, pDD: s.pDD }
})
const FIGURE_TESTC = String.raw`\begin{figure}[tbp]
\centering
\begin{tikzpicture}
\begin{axis}[${axisStyle}, width=0.82\textwidth, height=6cm, symbolic x coords={${tcRows.map(r => r.L).join(',')}}, xtick=data, enlarge x limits=0.15, xlabel={Block length (days)}, ylabel={Change in mean $R$ of shorts}, ymax=${(Math.max(...tcRows.map(r => Math.max(r.hist, r.p95))) + 0.05).toFixed(2)}, yticklabel style={/pgf/number format/fixed}, legend style={at={(0.5,-0.22)}, anchor=north, /tikz/every even column/.append style={column sep=10pt}}, legend columns=2]
\addplot[black!40, forget plot] coordinates {(${tcRows[0].L},0) (${tcRows[tcRows.length - 1].L},0)};
\addplot[btccol, mark=*, mark size=1.6pt, only marks, error bars/.cd, y dir=both, y explicit, error bar style={btccol, line width=0.9pt}] coordinates {
${tcRows.map(r => `  (${r.L},${r.p50.toFixed(4)}) += (0,${(r.p95 - r.p50).toFixed(4)}) -= (0,${(r.p50 - r.p5).toFixed(4)})`).join('\n')}
};
\addplot[negcol, mark=diamond*, mark size=3pt, only marks] coordinates {${tcRows.map(r => `(${r.L},${r.hist.toFixed(4)})`).join(' ')}};
\legend{Synthetic markets: median and 5--95\%, Historical}
\end{axis}
\end{tikzpicture}
\caption{Test C. Change in the average risk-normalised return of short trades when the trend condition is applied, on ${int(tcRows[0].n)} synthetic markets per block length and on the historical path. Historical percentile: ${tcRows.map(r => `${pct(r.pct, 1)} ($L=${r.L}$)`).join(', ')}.}\label{fig:testc}
\end{figure}

\begin{table}[tbp]
\centering\small
\begin{threeparttable}
\caption{Test C by block length: synthetic markets against the historical path}\label{tab:testc}
\begin{tabular}{rrrrrr}
\toprule
Block (days) & $P(\Delta\mathrm{EV}>0)$ & Synthetic P95 & Historical & Hist.~percentile & Sharpe gain, hist.~pct. \\
\midrule
${tcRows.map(r => row(r.L, fx(r.pPos), fx(r.p95, 3), fx(r.hist, 3), pct(r.pct, 1), pct(r.srPct, 1))).join('\n')}
\bottomrule
\end{tabular}
\begin{tablenotes}[flushleft]\footnotesize
\item $\Delta\mathrm{EV}$: change in the mean risk-normalised return of shorts when the condition is applied (portfolio). \emph{Sharpe gain, hist.~pct.}: percentile of the historical change in portfolio Sharpe ratio among synthetic paths. The condition improved the maximum drawdown in ${tcRows.map(r => pct(r.pDD, 0)).join(', ')} of synthetic paths for $L=${tcRows.map(r => r.L).join(',')}$ days.
\end{tablenotes}
\end{threeparttable}
\end{table}`

const betas = RA.main.betas as { name: string; beta: number; t: number }[]
const FIGURE_BETAS = String.raw`\begin{figure}[tbp]
\centering
\begin{tikzpicture}
\begin{axis}[${axisStyle}, width=0.8\textwidth, height=6.4cm, xbar, bar width=7pt, y dir=reverse, symbolic y coords={${betas.map(b => FACTOR[b.name]).join(',')}}, ytick=data, xlabel={Loading $\beta$ in M2, with 95\% Newey--West interval}, enlarge y limits=0.08, xmajorgrids, ymajorgrids=false, scaled x ticks=false, xticklabel style={/pgf/number format/fixed, /pgf/number format/precision=2}]
\addplot[fill=btccol!55, draw=btccol, error bars/.cd, x dir=both, x explicit, error bar style={black}] coordinates {
${betas.map(b => `  (${b.beta.toFixed(4)},${FACTOR[b.name]}) +- (${(1.96 * Math.abs(b.beta / b.t)).toFixed(4)},0)`).join('\n')}
};
\end{axis}
\end{tikzpicture}
\caption{Factor loadings of the portfolio in the pre-set model M2. The largest loading is on the intraday breakout ($t=${fx(betas.find(b => b.name === 'DONCH15 96/48')!.t)}$), which loses money on its own after costs.}\label{fig:betas}
\end{figure}`

// ---------------------------------------------------------------- valeurs du texte
const wfPreset = need(WF.split('\n').find(l => /Préréglage fixe/.test(l)), 'ligne du préréglage fixe').split('|').map(s => s.trim())
const wfMain = need(WF.split('\n').find(l => /\*\*Walk-forward, plateaux\*\*/.test(l)), 'ligne du walk-forward').split('|').map(s => s.trim())
if (wfMain[4] !== P.evidence.walkForward.sharpe) throw new Error('walk-forward : rapport ≠ résumé publié')
const cutoff = need(FWD.match(/coupure du (\d{4}-\d{2}-\d{2})/), 'date de coupure')[1]
const testnet = need(ACC.match(/^\s*\{\s*address:\s*'0x[0-9a-fA-F]{40}'.*network:\s*'testnet'.*since:\s*'([^']+)'/m), 'date du bot testnet')[1]
const ta = P.falsification.randomSelection, tb = P.falsification.regimeShift
const tests = json('research/reports/e2-falsification/tests-ab.json')
const tbMain = need((tests.testB as { kmin: number; btc: { p: number }; eth: { p: number }; eq: { p: number } }[]).find(x => x.kmin === tb.minShiftDays), 'test B, décalage minimal')
if (Math.abs(tbMain.eq.p - tb.p) > 1e-12) throw new Error('test B : rapport ≠ résumé publié')
const sub = P.stability.subPeriods
const vA = P.variants

const V: Record<string, string> = {
  PAPER_DATE: 'October 2026',
  VERSION: P.version,
  PERIOD_START: longDate(CP.start), PERIOD_END: longDate(CP.end),
  DAYS: int(CP.days), YEARS: CP.years.toFixed(1),
  SR_PF: fx(F.m.sharpe), CAGR_PF: pct(F.m.cagr), MDD_PF: pct(F.m.maxDD),
  SR_BH: fx(BH.sharpe), CAGR_BH: pct(BH.cagr), MDD_BH: pct(BH.maxDD),
  RA_ALPHA: pct(RA.main.alphaAnn), RA_T: fx(RA.main.t), RA_UNEXPL: pct(RA.main.unexplained, 0), RA_R2: fx(RA.main.r2),
  RA_BOOT_N: int(RA.bootstrap.reps), RA_CI_LO: pct(RA.bootstrap.p5), RA_CI_HI: pct(RA.bootstrap.p95), RA_T_GRID: fx(S.S1.t),
  WF_SR: wfMain[4], WF_PRESET: wfPreset[4], WF_WINDOWS: String(P.evidence.walkForward.windows),
  SHORTS: int(F.trades.short), TRADES: int(F.trades.trades),
  REBAL_DIFF: fx(Math.max(Math.abs(vA.B.m.sharpe - vA.A.m.sharpe), Math.abs(vA.C.m.sharpe - vA.A.m.sharpe))),
  TIME_IN_MARKET: pct(F.expo.timeInMarket, 0), WIN_RATE: pct(F.trades.winRate, 0), PAYOFF: fx(F.trades.payoff, 1),
  TOP5: pct(P.concentration.tradesPortfolio.top5, 0), CAGR_NO_TOP5: pct(P.concentration.tradesPortfolio.cagrWithoutTop5),
  SR_H1: fx(sub.firstHalf.portfolio.sharpe), SR_H2: fx(sub.secondHalf.portfolio.sharpe),
  H1_RANGE: `${monthYear(sub.firstHalf.from)}--${monthYear(sub.firstHalf.to)}`, H2_RANGE: `${monthYear(sub.secondHalf.from)}--${monthYear(sub.secondHalf.to)}`,
  CORR_H1: fx(sub.firstHalf.corr), CORR_H2: fx(sub.secondHalf.corr),
  ROLL_POS: pct(R12.positive, 0), ROLL_ABOVE1: pct(R12.aboveOne, 0), ROLL_MIN: fx(R12.min),
  BOOT_N: int(P.bootstrap.replications), BOOT_SR_LO: fx(P.bootstrap.sharpe.p5), BOOT_SR_HI: fx(P.bootstrap.sharpe.p95),
  CORR_SPOT: fx(P.correlation.underlyingDaily), CORR_STRAT: fx(P.correlation.dailyPearson),
  CRISIS_POS: `${P.crisis.episodes.filter((e: { portfolio: number }) => e.portfolio > 0).length} of ${P.crisis.episodes.length}`,
  TURNOVER: fx(F.cost.turnoverTwoWay, 0), SR_COST2: fx(st.find(s => s.commissionPct === 0.09)!.portfolio.sharpe), SR_FUNDING: fx(fu[0].sharpe),
  TA_DRAWS: int(ta.draws), TA_EV_PCT: `${ta.evPercentile.toFixed(1)}th`, TA_EV_P: pval(ta.evP), TA_SR_PCT: `${ta.sharpePercentile.toFixed(1)}th`, TA_SR_P: pval(ta.sharpeP),
  TB_KMIN: String(tb.minShiftDays), TB_SHIFTS: int(tb.shifts), TB_D: fx(tb.d, 3), TB_PCT: pct(tb.percentile / 100, 1), TB_P: pval(tb.p), TB_P_BTC: pval(tbMain.btc.p), TB_P_ETH: pval(tbMain.eth.p),
  FWD_START: longDate(P.forward.start), FWD_CUTOFF: longDate(cutoff), TESTNET_SINCE: longDate(testnet),
  TRADES_PER_YEAR: fx(P.capacity.tradesPerYear.total, 0),
  COMMIT: P.manifest.commit.slice(0, 7), PARAM_HASH: P.parametersSha256.slice(0, 12), CHECKS_TOTAL: String(P.manifest.checksTotal),
  TABLE_HEADLINE, TABLE_ANNUAL, TABLE_FRICTIONS, TABLE_TRANSFER, TABLE_NEIGH, TABLE_ALPHA,
  FIGURE_EQUITY, FIGURE_DRAWDOWN, FIGURE_ROLLING, FIGURE_TESTC, FIGURE_BETAS,
}

// ---------------------------------------------------------------- composition
let tex = text('research/paper/shock-engine-paper.tex.tmpl')
const used = new Set<string>()
tex = tex.replace(/@@([A-Z0-9_]+)@@/g, (_, k: string) => { used.add(k); return need(V[k], `valeur ${k}`) })
const unused = Object.keys(V).filter(k => !used.has(k))
if (unused.length) throw new Error(`valeurs non utilisées dans le gabarit : ${unused.join(', ')}`)
writeFileSync(join(OUT, `${NAME}.tex`), tex)

execFileSync('latexmk', ['-pdf', '-interaction=nonstopmode', '-halt-on-error', '-file-line-error', `${NAME}.tex`], { cwd: OUT, stdio: ['ignore', 'ignore', 'inherit'] })
execFileSync('latexmk', ['-c', `${NAME}.tex`], { cwd: OUT, stdio: 'ignore' })
rmSync(join(OUT, `${NAME}.fls`), { force: true })
process.stderr.write(`écrit research/reports/paper/${NAME}.pdf\n`)
