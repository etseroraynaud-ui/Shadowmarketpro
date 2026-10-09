// Rapport HTML du portefeuille Shock Engine BTC/ETH (en anglais : destiné à des lecteurs externes).
// Ne calcule rien : met en page le résumé produit par portfolio.ts et ses séries journalières.

import { lineChart, groupedBars, heatmap, scatter, histograms } from '../lib/svg.ts'
import { monthLabel, isoDay, mean } from '../lib/portfolio.ts'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any

export interface ReportInput {
  summary: Any
  days: number[]
  rb: number[]
  re: number[]
  rp: number[]
  eqB: number[]
  eqE: number[]
  eqP: number[]
  uwB: number[]
  uwE: number[]
  uwP: number[]
  rolling: Record<number, number[]>
  roll12: { btc: number[]; eth: number[]; portfolio: number[] }
}

const MINUS = '−'
const fin = (x: number) => typeof x === 'number' && Number.isFinite(x)
const pct = (x: number, d = 1) => (fin(x) ? `${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)}%` : '—')
const spct = (x: number, d = 1) => (fin(x) ? `${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)}%` : '—')
const num = (x: number, d = 2) => (fin(x) ? `${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}` : '—')
const int = (x: number) => (fin(x) ? Math.round(x).toLocaleString('en-US') : '—')
const times = (x: number, d = 0) => (fin(x) ? `${x.toFixed(d)}×` : '—')
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const COLORS = { btc: 'var(--s1)', eth: 'var(--s2)', portfolio: 'var(--s3)' }

function table(head: string[], rows: (string | number)[][], o: { cls?: string; caption?: string } = {}) {
  return `<div class="tw"><table class="${o.cls ?? ''}">${o.caption ? `<caption>${o.caption}</caption>` : ''}<thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
}
const key = (color: string) => `<i class="key rect" style="background:${color}"></i>`
/** Libellé de série avec sa pastille, sans retour à la ligne. */
const lab = (color: string, name: string) => `<span class="nw">${key(color)}${name}</span>`
const section = (id: string, n: string, title: string, body: string) => `<section id="${id}"><h2><span class="sn">${n}</span>${title}</h2>${body}</section>`
const note = (s: string) => `<p class="note">${s}</p>`

export function renderReport(I: ReportInput): string {
  const S = I.summary
  // Variante E2 (spécification publique depuis octobre 2026) : shorts seulement en régime de tendance journalier baissier.
  const E2V = S.variant === 'e2'
  const sfx = E2V ? '-e2' : ''
  const ST = S.stress as { funding: { scenario: string; sharpe: number; cagr: number; maxDD: number }[]; slippage: { slippagePctPerOrder: number; sharpe: number }[] } | undefined
  const B = S.series.btc, E = S.series.eth, Pf = S.series.portfolio
  const H = S.headline, CP = S.commonPeriod
  const ml = (m: Any) => `${monthLabel(m.key)}`
  const recon = S.reconciliation
  const ev = S.evidence

  // ---------------------------------------------------------------- en-tête et résumé
  const tiles: [string, string, string][] = [
    ['Common period', `${CP.start} → ${CP.end}`, `${CP.years.toFixed(1)} years · ${int(CP.days)} days`],
    ['BTC Sharpe', num(H.btcSharpe), 'daily, common period'],
    ['ETH Sharpe', num(H.ethSharpe), 'daily, common period'],
    ['Portfolio Sharpe', num(H.portfolioSharpe), '50/50, no rebalancing'],
    ['Portfolio CAGR', pct(H.portfolioCagr), `total ${pct(Pf.m.totalReturn, 0)}`],
    ['Portfolio max DD', pct(H.portfolioMaxDD), `${pct(Pf.ddIntraday)} on 15-min marks`],
    ['BTC/ETH daily correlation', num(H.correlationDaily), 'strategy returns (spot: ' + num(S.correlation.underlyingDaily) + ')'],
    ['Worst month', pct(H.worstMonth.ret), H.worstMonth.month],
    ['Number of trades', int(H.trades.total), `${int(H.trades.btc)} BTC · ${int(H.trades.eth)} ETH`],
  ]
  const summary = `
<div class="tiles">${tiles.map(([l, v, s]) => `<div class="tile"><div class="tl">${l}</div><div class="tv">${v}</div><div class="ts">${esc(s)}</div></div>`).join('')}</div>
<p class="lead">Ethereum parameters were inherited from Bitcoin and were not calibrated on ETH.</p>
${E2V ? '<p class="lead">Short entries are only allowed when the daily trend regime is bearish. This condition was specified in October 2026, after this historical period had been studied: the figures are in-sample, not an independent out-of-sample test.</p>\n' : ''}<p class="lead">Historical simulation after modeled transaction costs. Not live performance.</p>
<div class="status-grid">
  <div class="status-box hist"><div class="sb-h">Historical simulation</div><p>Every figure in this report. Frozen rules replayed on historical 15-minute bars, ${CP.start} → ${CP.end}, with a commission of 0.045 % per order. No slippage, no funding and no market impact are modeled.</p></div>
  <div class="status-box live"><div class="sb-h">Live / forward results</div><p>None in this report. No figure here comes from live trading, paper trading or a forward test. Forward results, when they exist, are to be reported separately, from the date the rules were frozen, and never blended with this simulation.</p></div>
</div>`

  // ---------------------------------------------------------------- 1. méthode
  const method = `
<p>Two sleeves run the same Shock Engine: the adaptive-volatility 15-minute preset (two parameter sets, calm and agitated, selected by a causal daily volatility regime), with full entry signals${E2V ? ', except that a short entry after a shock is only allowed when the daily trend regime, computed causally on closed days, is bearish' : ''}. The preset was selected on Bitcoin; Ethereum runs it unchanged (identical parameter hash <code>${esc(String(S.parametersSha256).slice(0, 16))}…</code> for both sleeves).</p>
${table(['Sleeve', 'Data', 'Simulated from (after warm-up)', 'Validated reference', 'Trades in common period'], [
    [lab(COLORS.btc, 'BTC'), 'BTC/USD, Bitstamp spot, 15 min', '2017-01-01 (warm-up from 2016-01-01)', `<code>shock-15m-zeroshot-btc${sfx}.json</code>`, int(B.trades.trades)],
    [lab(COLORS.eth, 'ETH'), 'ETH/USDT, Binance spot, 15 min', '2018-09-01 (warm-up from 2017-08-17)', `<code>shock-15m-zeroshot-ethusdt${sfx}.json</code>`, int(E.trades.trades)],
  ], { cls: 'wrap text' })}
<h3>Common period</h3>
<p>Rule: ${esc(CP.rule)}. Result: <strong>${CP.start} → ${CP.end}</strong>, ${int(CP.days)} days (${CP.years.toFixed(2)} years). BTC, ETH and the portfolio are all measured on exactly these days.</p>
<h3>Capital</h3>
<p>Initial capital 100. At t0 the BTC sleeve receives 50 and the ETH sleeve 50. Each sleeve compounds only its own capital: it opens every position with 100 % of <em>its own</em> equity, one position at a time, without leverage. The portfolio value is the sum of the two sleeves:</p>
<p class="formula">V<sub>P</sub>(t) = 50 · E<sub>BTC</sub>(t) / E<sub>BTC</sub>(t0) + 50 · E<sub>ETH</sub>(t) / E<sub>ETH</sub>(t0)</p>
<p>where E is each strategy's equity as computed by the validated backtest. The engine sizes positions as a fraction of equity without lot rounding, so a sleeve of 50 behaves exactly like the strategy's own account rescaled. Neither sleeve ever uses the other's capital: when both are invested, gross notional exposure is about 100 % of the portfolio, not 200 %. Measured exposure: average gross ${pct(Pf.expo.avgGross)}, maximum ${pct(Pf.expo.maxGross)} (above 100 % only through price moves against open shorts and the entry commission).</p>
<h3>Aggregation and conventions</h3>
<ul>
<li>Daily returns: UTC close to close, using the equity of the last 15-minute bar of each day (bars are stamped at their open, so the 23:45 bar closes at midnight). No interpolation; both sleeves have a bar on every day of the common period.</li>
<li>Portfolio return: (V<sub>BTC</sub>(t) + V<sub>ETH</sub>(t)) / (V<sub>BTC</sub>(t−1) + V<sub>ETH</sub>(t−1)) − 1, i.e. sleeve returns weighted by the previous close's drifting weights. Returns are never added across sleeves.</li>
<li>Sharpe, Sortino and volatility: daily returns, √365.25 annualization (24/7 market), risk-free rate 0, population standard deviation. Validated reports quote a Sharpe on 15-minute returns; both conventions are reconciled in section 2.</li>
<li>Costs: exactly the validated assumptions. Commission 0.045 % per order on every entry and exit fill. Slippage 0 (as in the validated BTC and ETH runs). No funding, no leverage.</li>
<li>Official portfolio: <strong>A, 50/50 at t0, independent sleeves, no rebalancing</strong>, decided before any result. B (monthly rebalancing) is a diagnostic; C (equal risk) is exploratory.</li>
</ul>`

  // ---------------------------------------------------------------- 2. réconciliation
  const rr = recon.rows as Any[]
  const rget = (k: string, c: number, f: string) => rr.find(x => x.key === k && x.k === c && x.field === f)
  const reconRows = ['BTC', 'ETH'].flatMap(k => [0, 1, 2].map(c => {
    const g = (f: string) => rget(k, c, f)
    const same = ['totalReturn', 'cagr', 'sharpe', 'maxDD', 'trades'].every(f => g(f).validated === g(f).recomputed)
    return [`${k} · costs ×${c}`, pct(g('totalReturn').recomputed, 0), pct(g('cagr').recomputed), num(g('sharpe').recomputed), pct(g('maxDD').recomputed), int(g('trades').recomputed), same ? 'identical' : '<strong>differs</strong>']
  }))
  const rc = recon.common
  const fresh = recon.freshStart
  const reconciliation = `
<p>Before any portfolio calculation, the script replays both validated backtests with the same code path and checks that the full-period results match the stored reports. Any difference stops the run.</p>
${table(['Validated run (full history)', 'Total return', 'CAGR', 'Sharpe (15-min)', 'Max DD (15-min)', 'Trades', 'vs stored report'], reconRows)}
<p>The headline figures of the validated reports (BTC: Sharpe ${num(rget('BTC', 1, 'sharpe').recomputed)}, CAGR ${pct(rget('BTC', 1, 'cagr').recomputed)}, max DD ${pct(rget('BTC', 1, 'maxDD').recomputed)}, ${int(rget('BTC', 1, 'trades').recomputed)} trades; ETH: ${num(rget('ETH', 1, 'sharpe').recomputed)}, ${pct(rget('ETH', 1, 'cagr').recomputed)}, ${pct(rget('ETH', 1, 'maxDD').recomputed)}, ${int(rget('ETH', 1, 'trades').recomputed)} trades) use the full history of each asset and Sharpe ratios on 15-minute returns. The BTC history (2017-01-01 → 2026-10-04) is longer than the common period, and the daily convention used in this report gives slightly lower Sharpe ratios:</p>
${table(['Common period', 'Sharpe 15-min', 'Sharpe daily', 'Max DD 15-min', 'Max DD daily', 'CAGR', 'Trades'], [
    [lab(COLORS.btc, 'BTC'), num(rc.BTC.sharpe15), num(rc.BTC.sharpeDaily), pct(rc.BTC.maxDD15), pct(rc.BTC.maxDDDaily), pct(rc.BTC.cagr), int(rc.BTC.trades)],
    [lab(COLORS.eth, 'ETH'), num(rc.ETH.sharpe15), num(rc.ETH.sharpeDaily), pct(rc.ETH.maxDD15), pct(rc.ETH.maxDDDaily), pct(rc.ETH.cagr), int(rc.ETH.trades)],
    [lab(COLORS.portfolio, 'Portfolio 50/50'), num(rc.Portfolio.sharpe15Grid), num(rc.Portfolio.sharpeDaily), pct(rc.Portfolio.maxDD15), pct(rc.Portfolio.maxDDDaily), pct(Pf.m.cagr), int(Pf.trades.trades)],
  ])}
<ul>
<li>ETH's validated run starts on the first common day and ends on the last one, so the ETH sleeve is the validated run itself.</li>
<li>BTC: the validated run started in 2017. It held ${recon.btcOpenAtT0 ? 'an open position' : 'no position'} at the start of the common period, so the sleeve starts flat. As a check, a BTC run started on ${CP.start} gives the same result (Sharpe ${num(fresh.btc.sharpe)}, ${int(fresh.btcTrades)} trades; portfolio Sharpe ${num(fresh.portfolio.sharpe)}).</li>
<li>The 15-minute portfolio Sharpe uses a common 15-minute grid on which a missing bar carries the last known value (${pct(1 - rc.BTC.gridExact, 2)} of BTC slots and ${pct(1 - rc.ETH.gridExact, 2)} of ETH slots); it is shown for reconciliation only.</li>
</ul>`

  // ---------------------------------------------------------------- 3. performance
  const m3 = [B, E, Pf]
  const tr = (x: Any) => x.trades
  const perfRows: [string, (s: Any) => string][] = [
    ['Total return', s => pct(s.m.totalReturn, 0)],
    ['CAGR', s => pct(s.m.cagr)],
    ['Annualized volatility', s => pct(s.m.vol)],
    ['Sharpe', s => num(s.m.sharpe)],
    ['Sortino', s => num(s.m.sortino)],
    ['Max drawdown (daily closes)', s => pct(s.m.maxDD)],
    ['Max drawdown (15-min marks)', s => pct(s.ddIntraday)],
    ['Calmar (CAGR / max DD)', s => num(s.m.calmar)],
    ['Skewness of daily returns', s => num(s.m.skew)],
    ['Downside deviation (annualized)', s => pct(s.m.downsideDev)],
    ['Profit factor (trades)', s => num(tr(s).profitFactor)],
    ['Profit factor (daily returns)', s => num(s.m.dailyPF)],
    ['Exposure: time in market', s => pct(s.expo.timeInMarket)],
    ['Exposure: average gross notional', s => pct(s.expo.avgGross)],
    ['Turnover (one-way, per year)', s => times(s.cost.turnoverOneWay)],
    ['Transaction costs (% of equity per year)', s => pct(s.cost.totalCostPctYr)],
    ['Number of trades', s => int(tr(s).trades)],
    ['Winning trades', s => `${int(tr(s).winners)} (${pct(tr(s).winRate, 0)})`],
    ['Average winner', s => pct(tr(s).avgWin, 2)],
    ['Average loser', s => pct(tr(s).avgLoss, 2)],
    ['Payoff ratio', s => num(tr(s).payoff)],
    ['Best day', s => `${pct(s.m.bestDay.ret)} <span class="d">${isoDay(s.m.bestDay.day)}</span>`],
    ['Worst day', s => `${pct(s.m.worstDay.ret)} <span class="d">${isoDay(s.m.worstDay.day)}</span>`],
    ['Best month', s => `${pct(s.m.bestMonth.ret)} <span class="d">${ml(s.m.bestMonth)}</span>`],
    ['Worst month', s => `${pct(s.m.worstMonth.ret)} <span class="d">${ml(s.m.worstMonth)}</span>`],
    ['Best year', s => `${pct(s.m.bestYear.ret)} <span class="d">${s.m.bestYear.key}${s.m.bestYear.key === 2018 || s.m.bestYear.key === 2026 ? '*' : ''}</span>`],
    ['Worst year', s => `${pct(s.m.worstYear.ret)} <span class="d">${s.m.worstYear.key}${s.m.worstYear.key === 2018 || s.m.worstYear.key === 2026 ? '*' : ''}</span>`],
  ]
  const SP0 = S.stability.subPeriods, K0 = S.correlation.dailyPearson
  const performance = `
${table(['Metric', lab(COLORS.btc, 'BTC'), lab(COLORS.eth, 'ETH'), lab(COLORS.portfolio, 'Portfolio 50/50')], perfRows.map(([l, f]) => [l, ...m3.map(f)]), { cls: 'metrics' })}
${note(`Sleeve trades: return = PnL / sleeve equity at entry (validated convention). Portfolio trades: the ${int(Pf.trades.trades)} sleeve trades pooled, each expressed as its contribution to portfolio equity at entry, so the average winner and loser are roughly half the sleeve figures. Both sleeves trade different instruments and never net against each other, so a sleeve trade is a well-defined portfolio trade. *2018 covers September–December and 2026 covers January–September.`)}
<h3>Equity (log scale, 100 at ${CP.start})</h3>
${lineChart({ id: 'eq', title: 'Equity curves, log scale', x: I.days, series: [{ name: 'BTC', color: COLORS.btc, y: I.eqB }, { name: 'ETH', color: COLORS.eth, y: I.eqE }, { name: 'Portfolio', color: COLORS.portfolio, y: I.eqP }], fmt: 'idx', log: true })}
<h3>Drawdown from previous peak (daily closes)</h3>
${lineChart({ id: 'dd', title: 'Underwater curves', x: I.days, series: [{ name: 'BTC', color: COLORS.btc, y: I.uwB }, { name: 'ETH', color: COLORS.eth, y: I.uwE }, { name: 'Portfolio', color: COLORS.portfolio, y: I.uwP }], fmt: 'pct', yMax: 0, area: 0, height: 260 })}
<h3>Rolling 12-month Sharpe (365-day window)</h3>
${lineChart({ id: 'rs', title: 'Rolling 12-month Sharpe', x: I.days, series: [{ name: 'BTC', color: COLORS.btc, y: I.roll12.btc }, { name: 'ETH', color: COLORS.eth, y: I.roll12.eth }, { name: 'Portfolio', color: COLORS.portfolio, y: I.roll12.portfolio }], fmt: 'num', refs: [{ y: 0, label: '' }], height: 260 })}
${table(['Rolling 12-month Sharpe', 'Windows', 'Median', 'Minimum', 'Share > 0', 'Share > 1'], (['btc', 'eth', 'portfolio'] as const).map(k => { const r = S.stability.rolling12[k]; return [k === 'portfolio' ? 'Portfolio 50/50' : k.toUpperCase(), int(r.n), num(r.median), num(r.min), pct(r.positive, 0), pct(r.aboveOne, 0)] }))}
<h3>Sub-periods (diagnostic; the official period is unchanged)</h3>
${table(['Period', 'BTC Sharpe', 'ETH Sharpe', 'Portfolio Sharpe', 'Portfolio CAGR', 'Portfolio max DD', 'BTC/ETH correlation'], [
    ['Full common period', `${CP.start} → ${CP.end}`, Pf.m, B.m, E.m, K0],
    ['First half', `${SP0.firstHalf.from} → ${SP0.firstHalf.to}`, SP0.firstHalf.portfolio, SP0.firstHalf.btc, SP0.firstHalf.eth, SP0.firstHalf.corr],
    ['Second half', `${SP0.secondHalf.from} → ${SP0.secondHalf.to}`, SP0.secondHalf.portfolio, SP0.secondHalf.btc, SP0.secondHalf.eth, SP0.secondHalf.corr],
    ['From 2019 (without Sep–Dec 2018)', `${SP0.from2019.from} → ${SP0.from2019.to}`, SP0.from2019.portfolio, SP0.from2019.btc, SP0.from2019.eth, SP0.from2019.corr],
  ].map(([l, d, p, b, e, c]: Any) => [`${l} <span class="d nw">${d}</span>`, num(b.sharpe), num(e.sharpe), num(p.sharpe), pct(p.cagr), pct(p.maxDD), num(c)]))}
<p>The second half of the period is clearly weaker than the first for both sleeves, and therefore for the portfolio (Sharpe ${num(SP0.secondHalf.portfolio.sharpe)} against ${num(SP0.firstHalf.portfolio.sharpe)}), while the correlation between the sleeves is higher (${num(SP0.secondHalf.corr)} against ${num(SP0.firstHalf.corr)}).</p>`

  // ---------------------------------------------------------------- 4. rebalancement
  const V = S.variants, W = S.weights
  const cw = W.C.map((x: Any) => x.wBtc)
  const rebalancing = `
${table(['Variant', 'Sharpe', 'CAGR', 'Volatility', 'Max DD', 'Calmar', 'Rebalancing cost / yr', 'Rebalances', 'BTC weight at end'], (['A', 'B', 'C'] as const).map(k => {
    const v = V[k]
    return [k === 'A' ? `<strong>${v.name}</strong>` : v.name, num(v.m.sharpe), pct(v.m.cagr), pct(v.m.vol), pct(v.m.maxDD), num(v.m.calmar), pct(v.rebalCostPctYr, 3), int(v.rebalances), pct(v.wEnd, 0)]
  }))}
<p><strong>A is the official portfolio</strong> and stays so whatever this table shows. B and C were defined before the results as mechanical diagnostics. They are not candidates to replace A after seeing them.</p>
<p><strong>What rebalancing does here.</strong> Without rebalancing, the sleeve that compounds faster takes a growing share of the capital. ETH gained ${pct(S.annual[0].eth, 0)} between September and December 2018, so the BTC weight fell to ${pct(W.A.yearEnds[0].wBtc, 0)} by the end of 2018. Over the period it ranged from ${pct(W.A.min, 0)} to ${pct(W.A.max, 0)}, with an average of ${pct(W.A.mean, 0)}, and ended at ${pct(W.A.end, 0)}. Variant A was therefore on average an ETH-overweight portfolio, with less diversification than 50/50. Monthly rebalancing (B) puts the weights back to 50/50 at each month end. This has two effects. It keeps the mix closer to the diversified point (A held on average ${pct(1 - W.A.mean, 0)} in ETH, the more volatile sleeve). And it systematically sells the sleeve that has just outperformed to buy the other, which adds return when relative performance does not trend. Both effects helped in this sample: volatility ${pct(V.B.m.vol)} against ${pct(V.A.m.vol)}, CAGR ${pct(V.B.m.cagr)} against ${pct(V.A.m.cagr)}, Sharpe ${num(V.B.m.sharpe)} against ${num(V.A.m.sharpe)}. That is a property of this history, not a rule. Its cost is negligible: ${pct(V.B.rebalCostPctYr, 3)} a year, because only the part of each transfer that sits in an open position has to be traded.</p>
<p><strong>C (exploratory / secondary)</strong>: the BTC weight is proportional to 1/σ<sub>BTC</sub>, with σ the volatility of daily sleeve returns over the 90 days ending at the rebalancing close (causal). Weights sum to 1, there is no leverage, and the allocation is 50/50 until 90 days of history exist. The BTC weight ranged from ${pct(Math.min(...cw), 0)} to ${pct(Math.max(...cw), 0)} (median ${pct(cw.slice().sort((a: number, b: number) => a - b)[Math.floor(cw.length / 2)], 0)}). Its result is close to B's.</p>
${table(['A: BTC weight at year end', ...W.A.yearEnds.map((y: Any) => isoDay(y.day).slice(0, 4))], [['BTC sleeve / portfolio', ...W.A.yearEnds.map((y: Any) => pct(y.wBtc, 0))]])}`

  // ---------------------------------------------------------------- 5. coûts
  const C = S.costs
  const costs = `
${table(['Series', 'Commissions / yr', 'Slippage / yr', 'Total cost / yr', 'Turnover one-way / yr', 'Turnover two-way / yr', 'CAGR lost to costs'], [
    [lab(COLORS.btc, 'BTC'), pct(C.perSeries.btc.commissionPctYr), '0.0%', pct(C.perSeries.btc.totalCostPctYr), times(C.perSeries.btc.turnoverOneWay), times(C.perSeries.btc.turnoverTwoWay), pct(C.cagrDrag.btc)],
    [lab(COLORS.eth, 'ETH'), pct(C.perSeries.eth.commissionPctYr), '0.0%', pct(C.perSeries.eth.totalCostPctYr), times(C.perSeries.eth.turnoverOneWay), times(C.perSeries.eth.turnoverTwoWay), pct(C.cagrDrag.eth)],
    [lab(COLORS.portfolio, 'Portfolio 50/50'), pct(C.perSeries.portfolio.commissionPctYr), '0.0%', pct(C.perSeries.portfolio.totalCostPctYr), times(C.perSeries.portfolio.turnoverOneWay), times(C.perSeries.portfolio.turnoverTwoWay), pct(C.cagrDrag.portfolio)],
  ])}
${note('Costs are in % of average equity per year. Turnover is traded notional per year divided by average equity: one-way counts entries only (the validated reports\' convention), two-way counts entries and exits. CAGR lost to costs is CAGR at zero cost minus CAGR at modeled cost. Slippage is 0 in the validated BTC and ETH reference runs; it is not added here. The cost stress below is the way to read sensitivity to it.')}
<h3>Cost stress (nothing else changes: same signals, same rules)</h3>
${table(['Costs', 'Commission / order', 'BTC Sharpe', 'ETH Sharpe', 'Portfolio Sharpe', 'Portfolio CAGR', 'Portfolio max DD', 'Portfolio costs / yr', 'B (monthly) Sharpe'], C.stress.map((x: Any) => [`×${x.k}`, `${x.commissionPct.toFixed(3)}%`, num(x.btc.sharpe), num(x.eth.sharpe), num(x.portfolio.sharpe), pct(x.portfolio.cagr), pct(x.portfolio.maxDD), pct(x.costPortfolio), num(x.rebalanced.sharpe)]))}
<p>Costs take about ${pct(C.cagrDrag.portfolio, 0)} of CAGR a year at ×1: the strategy turns its capital over about ${times(C.perSeries.portfolio.turnoverOneWay)} a year. Doubling costs (0.09 % per order, which is equivalent to adding 0.045 % of slippage on every fill) lowers the portfolio Sharpe to ${num(C.stress[2].portfolio.sharpe)}. Execution quality is the first-order implementation risk.</p>`

  // ---------------------------------------------------------------- 6. corrélation
  const K = S.correlation
  const rl = (w: number) => K.rolling[w]
  const fit = (() => { const mx = mean(I.rb), my = mean(I.re); let sxy = 0, sxx = 0; for (let i = 0; i < I.rb.length; i++) { sxy += (I.rb[i] - mx) * (I.re[i] - my); sxx += (I.rb[i] - mx) ** 2 } const b = sxy / sxx; return { a: my - b * mx, b } })()
  const bothFlat = I.rb.filter((x, i) => x === 0 && I.re[i] === 0).length
  const correlation = `
${table(['Measure (strategy returns)', 'Value', 'Observations'], [
    ['A. Pearson, daily', num(K.dailyPearson, 3), `${int(I.days.length)} days`],
    ['B. Spearman, daily', num(K.dailySpearman, 3), `${int(I.days.length)} days`],
    ['C. Pearson, weekly (complete ISO weeks)', num(K.weekly, 3), `${int(K.weeks)} weeks`],
    ['D. Pearson, monthly', num(K.monthly, 3), `${int(K.months)} months`],
    ['Pearson, daily, days when both sleeves were exposed', num(K.bothInPosition.pearson, 3), `${int(K.bothInPosition.n)} days`],
    ['For reference: BTC vs ETH spot (buy and hold), daily', num(K.underlyingDaily, 3), `${int(I.days.length)} days`],
  ])}
${table(['Rolling Pearson', 'Windows', 'Median', 'P10', 'P90', 'Min', 'Max'], [[30, 'E. 30 days'], [90, 'F. 90 days'], [252, 'G. 252 days']].map(([w, l]) => { const d = rl(w as number); return [l as string, int(d.n), num(d.median), num(d.p10), num(d.p90), num(d.min), num(d.max)] }))}
<p>The two underlying markets are highly correlated (${num(K.underlyingDaily)}). The two strategies are much less so (${num(K.dailyPearson)}): each is out of the market most of the time (BTC ${pct(B.expo.timeInMarket, 0)}, ETH ${pct(E.expo.timeInMarket, 0)} of the time in a position), and the correlation is diluted by days when only one of them is exposed. On days when both are exposed it rises to ${num(K.bothInPosition.pearson)}. Weekly correlation is higher (${num(K.weekly)}) and monthly lower (${num(K.monthly)}, on only ${K.months} points). The 30-day measure is noisy (P10 ${num(rl(30).p10)}, P90 ${num(rl(30).p90)}). The 252-day correlation stayed between ${num(rl(252).min)} and ${num(rl(252).max)}.</p>
<h3>Rolling 90-day correlation of daily strategy returns</h3>
${lineChart({ id: 'rc', title: 'Rolling 90-day correlation', x: I.days, series: [{ name: '90-day correlation', color: 'var(--ink2)', y: I.rolling[90] }], fmt: 'num', yMin: -0.4, yMax: 1, refs: [{ y: K.dailyPearson, label: `full period ${num(K.dailyPearson)}` }, { y: 0, label: '' }], endLabels: false, height: 240 })}
<h3>Daily strategy returns: BTC vs ETH</h3>
<div class="split"><div>${scatter({ x: I.rb, y: I.re, color: 'var(--ink2)', lim: 0.15, xLabel: 'BTC strategy, daily return', yLabel: 'ETH strategy, daily return', title: 'Scatter of daily strategy returns', fit })}</div>
<div class="aside"><p>Each dot is one day. ${int(bothFlat)} days (${pct(bothFlat / I.days.length, 0)}) sit at the origin: neither sleeve held a position. Points beyond ±15 % are drawn on the edge of the frame. The line is the least-squares fit of ETH on BTC (slope ${num(fit.b)}).</p><p>The cloud is dominated by the axes: on most active days only one of the two sleeves moves.</p></div></div>`

  // ---------------------------------------------------------------- 7. crise
  const CR = S.crisis
  const read = (r: Any) => {
    if (r.nullMean === null) return ''
    if (r.pearson > r.nullP95) return 'above benchmark'
    if (r.pearson < r.nullP5) return 'below benchmark'
    return 'within benchmark'
  }
  const crisisRows = (CR.rows as Any[]).map(r => [r.label, int(r.days), num(r.pearson), num(r.spearman), r.nullMean === null ? '—' : `${num(r.nullMean)} <span class="d">[${num(r.nullP5)}, ${num(r.nullP95)}]</span>`, read(r)])
  const tl = K.coLoss.rows as Any[]
  const tg = (k: string) => tl.find(x => x.key === k)
  const get = (k: string) => (CR.rows as Any[]).find(x => x.key === k)
  const crisis = `
${table(['Days used', 'Days', 'Pearson', 'Spearman', 'Constant-dependence benchmark, mean [5–95 %]', 'Reading'], crisisRows)}
${note(`<strong>Why a benchmark.</strong> Selecting days on returns changes a correlation mechanically, even when the dependence does not change (truncation bias). Keeping only days when BTC lost, for example, shrinks BTC's range and lowers the measured correlation. The benchmark applies the same selection to 400 simulated histories that keep each sleeve's actual daily returns (each simulated series is a permutation of the real one) and join them with a Gaussian copula calibrated to the full-sample correlation (copula parameter ${num(CR.copulaParameter)}). A value inside the band is what constant dependence would produce; above it means losses are more joint than that. Selections on dates (drawdowns, spot stress) are not return-conditioned in the same way and are compared with the full-period ${num(K.dailyPearson)} and the 90-day rolling range. "Portfolio < 0" uses the average portfolio weight for the benchmark; with actual weights the observed Pearson is ${num(CR.portfolioNegActualWeights.pearson)}. Market stress is defined only from spot prices: crash days are the worst 5 % of the equal-weight BTC+ETH spot return (≤ ${pct(CR.crashCut)}), and the bear-market filter is the same index more than 30 % below its trailing 365-day high.`)}
<h3>Joint losses</h3>
${table(['Probability', 'Observed', 'Under independence', 'Constant-dependence benchmark [5–95 %]'], [
    ['P(ETH < 0 | BTC < 0)', pct(tg('coNeg').observed), pct(K.coLoss.pEthNeg), `${pct(tg('coNeg').mean)} [${pct(tg('coNeg').p5)}, ${pct(tg('coNeg').p95)}]`],
    ['P(ETH in its worst 10 % days | BTC in its worst 10 % days)', pct(tg('tail10').observed), pct(K.coLoss.independence10), `${pct(tg('tail10').mean)} [${pct(tg('tail10').p5)}, ${pct(tg('tail10').p95)}]`],
    ['P(ETH in its worst 5 % days | BTC in its worst 5 % days)', pct(tg('tail5').observed), pct(K.coLoss.independence5), `${pct(tg('tail5').mean)} [${pct(tg('tail5').p5)}, ${pct(tg('tail5').p95)}]`],
  ])}
<h3>Named stress episodes (windows fixed from known market events; spot moves shown for reference)</h3>
${table(['Episode', 'Window', 'Days', 'BTC spot', 'ETH spot', 'BTC strategy', 'ETH strategy', 'Portfolio', 'Daily Pearson'], (CR.episodes as Any[]).map(e => [e.name, `${e.from} → ${e.to}`, int(e.days), spct(e.spotBtc), spct(e.spotEth), spct(e.btc), spct(e.eth), spct(e.portfolio), num(e.pearson)]))}
<p><strong>Reading.</strong> Correlation does not jump in market stress. Non-stress days: ${num(get('calm').pearson)}. Spot crash days: ${num(get('mktCrash').pearson)}. Bear-market days: ${num(get('mktBear').pearson)}. Named episodes pooled: ${num(get('episodes').pearson)}. The portfolio's own drawdowns show lower values (decline phases ${num(get('pDecline').pearson)}, more than 10 % under water ${num(get('pUnder10').pearson)}). Losses are not more frequent together than constant dependence implies: P(ETH < 0 | BTC < 0) is ${pct(tg('coNeg').observed, 0)} against ${pct(tg('coNeg').mean, 0)} for the benchmark. One measure does exceed its benchmark: on the ${int(get('bothNeg').days)} days when <em>both</em> sleeves lost, the size of their losses is more aligned (${num(get('bothNeg').pearson)} against ${num(get('bothNeg').nullMean)}). This is consistent with section 8: some losing trades are the same shock traded on both markets and stopped out together. Over the seven named episodes, the portfolio was positive in ${(CR.episodes as Any[]).filter(e => e.portfolio > 0).length} of 7. The counter-example is the portfolio's deepest drawdown (February–August 2026, section 11), during which both sleeves lost together.</p>`

  // ---------------------------------------------------------------- 8. recouvrement
  const O = S.overlap
  const overlap = `
${table(['Window', 'ETH trades with a same-direction BTC entry', 'chance level', 'BTC trades with a same-direction ETH entry', 'chance level', 'ETH trades with an opposite BTC entry'], (O.entries as Any[]).map(o => [o.window, pct(o.ethWithBtc), pct(o.baselineEthWithBtc), pct(o.btcWithEth), pct(o.baselineBtcWithEth), pct(o.ethWithBtcOpposite)]))}
${note('Entry times are bar closes (UTC). "±15 min" means the two entries are on the same bar or adjacent bars. Chance level: the same measure after shifting the other sleeve\'s entries by a random offset (200 circular shifts of 30 days or more), which keeps each sleeve\'s clustering and removes any timing link.')}
${table(['Share of time (15-min slots)', 'Value'], [
    ['No position', pct(O.states.none)], ['BTC only', pct(O.states.btcOnly)], ['ETH only', pct(O.states.ethOnly)], ['BTC and ETH', pct(O.states.both)],
    ['· both long (LONG/LONG)', pct(O.states.longLong)], ['· both short (SHORT/SHORT)', pct(O.states.shortShort)], ['· BTC long, ETH short', pct(O.states.btcLongEthShort)], ['· BTC short, ETH long', pct(O.states.btcShortEthLong)],
  ])}
${table(['Trade-level overlap in time', 'Share'], [
    ['ETH trades that overlap a BTC position in the same direction', pct(O.trades.ethSame)], ['ETH trades that overlap a BTC position in the opposite direction', pct(O.trades.ethOpp)],
    ['BTC trades that overlap an ETH position in the same direction', pct(O.trades.btcSame)], ['BTC trades that overlap an ETH position in the opposite direction', pct(O.trades.btcOpp)],
    ['ETH long trades overlapping a BTC long (LONG/LONG)', pct(O.trades.longLong)], ['ETH short trades overlapping a BTC short (SHORT/SHORT)', pct(O.trades.shortShort)],
  ])}
<p>A quarter of ETH entries (${pct(O.entries[0].ethWithBtc, 0)}) occur within 15 minutes of a same-direction BTC entry, against ${pct(O.entries[0].baselineEthWithBtc, 1)} by chance: the same market-wide shock often triggers both sleeves. The other three quarters are not matched even within ±8 hours in ${pct(1 - O.entries[4].ethWithBtc, 0)} of cases. The two sleeves almost never take opposite sides at the same time (${pct(O.states.btcLongEthShort + O.states.btcShortEthLong, 1)} of the time). Most of the time at most one of them is exposed: ${pct(O.states.btcOnly + O.states.ethOnly, 0)} one sleeve only, ${pct(O.states.both, 0)} both.</p>`

  // ---------------------------------------------------------------- 9. risque
  const RK = S.risk
  const rkRows = (r: Any, w: [number, number], label: string) => [
    [`${label}: ${lab(COLORS.btc, 'BTC')}`, pct(w[0], 1), pct(r.sigma[0]), num(r.mrc[0], 3), num(r.crc[0], 3), pct(r.pct[0])],
    [`${label}: ${lab(COLORS.eth, 'ETH')}`, pct(w[1], 1), pct(r.sigma[1]), num(r.mrc[1], 3), num(r.crc[1], 3), pct(r.pct[1])],
  ]
  const risk = `
${table(['Sleeve', 'Capital weight', 'Volatility (ann.)', 'Marginal risk contribution', 'Component risk contribution', 'Share of portfolio variance'], [...rkRows(RK.equalWeights, [0.5, 0.5], '50/50'), ...rkRows(RK.averageWeights, [S.weights.A.mean, 1 - S.weights.A.mean], 'A average weights')])}
${note(`σ<sub>P</sub> = √(w′Σw) from daily returns, annualized (${pct(RK.equalWeights.sigmaP)} at 50/50). Marginal contribution = (Σw)<sub>i</sub> / σ<sub>P</sub>; component = w<sub>i</sub> × marginal; the components sum to σ<sub>P</sub> and their shares sum to 100 %.`)}
<p>50/50 in capital is not 50/50 in risk. ETH is the more volatile sleeve (${pct(RK.equalWeights.sigma[1], 0)} against ${pct(RK.equalWeights.sigma[0], 0)}), so it carries <strong>${pct(RK.equalWeights.pct[1], 0)}</strong> of the variance at 50/50 and BTC ${pct(RK.equalWeights.pct[0], 0)}. With the realized average weights of variant A (BTC ${pct(S.weights.A.mean, 0)}), the split becomes ${pct(RK.averageWeights.pct[0], 0)} / ${pct(RK.averageWeights.pct[1], 0)}.</p>
${table(['Year', ...RK.byYear.map((y: Any) => String(y.year))], [['BTC share of variance at 50/50', ...RK.byYear.map((y: Any) => pct(y.btcPct, 0))], ['BTC/ETH correlation', ...RK.byYear.map((y: Any) => num(y.corr))]])}`

  // ---------------------------------------------------------------- 10. diversification
  const D = S.diversification
  const diversification = `
${table(['Measure', 'Value', 'Reading'], [
    ['Sharpe portfolio / max(Sharpe BTC, Sharpe ETH)', num(D.sharpeVsBest, 3), `${spct(D.sharpeVsBest - 1)} vs the better sleeve`],
    ['Sharpe portfolio / Sharpe BTC', num(D.sharpeVsBtc, 3), spct(D.sharpeVsBtc - 1)],
    ['Sharpe portfolio / Sharpe ETH', num(D.sharpeVsEth, 3), spct(D.sharpeVsEth - 1)],
    ['Theoretical ratio for two equal-Sharpe, equal-vol sleeves at ρ = ' + num(K.dailyPearson), num(D.theoreticalEqualSharpe, 3), '√(2 / (1 + ρ))'],
    ['Max DD portfolio / max DD BTC', num(D.maxDDvsBtc, 3), `${pct(Pf.m.maxDD)} vs ${pct(B.m.maxDD)}`],
    ['Max DD portfolio / max DD ETH', num(D.maxDDvsEth, 3), `${pct(Pf.m.maxDD)} vs ${pct(E.m.maxDD)}`],
    ['Volatility portfolio / weighted sleeve volatility', num(D.volVsWeighted, 3), `volatility reduction ${pct(1 - D.volVsWeighted)}`],
    ['Volatility portfolio / BTC, / ETH', `${num(D.volVsBtc, 3)} · ${num(D.volVsEth, 3)}`, `${pct(Pf.m.vol)} vs ${pct(B.m.vol)} and ${pct(E.m.vol)}`],
    ['Diversification ratio DR = w′σ / √(w′Σw)', num(D.dr, 3), '1 = no diversification; √2 ≈ 1.414 = two independent equal-vol sleeves'],
    ['Effective number of independent bets, DR²', num(D.enbDR2, 2), 'out of 2 (Choueifaty)'],
    ['Effective number of bets, principal components', num(D.enbPca, 2), 'out of 2 (entropy of principal-component risk shares, Meucci)'],
  ], { cls: 'wrap text' })}
<p>The portfolio is better than each sleeve on every risk-adjusted measure. Sharpe ${num(Pf.m.sharpe)} against ${num(B.m.sharpe)} and ${num(E.m.sharpe)}; Calmar ${num(Pf.m.calmar)} against ${num(B.m.calmar)} and ${num(E.m.calmar)}; smaller maximum drawdown. The gain over the better sleeve (${spct(D.sharpeVsBest - 1, 0)}) is below the textbook ${spct(D.theoreticalEqualSharpe - 1, 0)} for two identical sleeves at this correlation, because the sleeves do not have equal volatility and A drifts away from 50/50. The DR of ${num(D.dr)} amounts to ${num(D.enbDR2, 2)} independent bets out of a possible 2. The principal-component measure is lower (${num(D.enbPca, 2)}) because one common factor dominates the risk. ETH adds a meaningful but partial second stream, not an independent one.</p>`

  // ---------------------------------------------------------------- 11. drawdowns
  const DDt = S.drawdowns
  const ddTable = (rows: Any[], others: string[]) => table(['#', 'Start (peak)', 'Trough', 'Recovery', 'Depth', 'Duration (days)', 'Recovery (days)', ...others.map(o => `${o} over peak → trough`)],
    rows.map((r, i) => [String(i + 1), r.start, r.trough, r.recovery ?? '<em>not recovered</em>', pct(r.depth), int(r.days), r.recoveryDays === null ? '—' : int(r.recoveryDays), ...others.map(o => spct(r.others[o]))]))
  const hp = DDt.help
  const drawdowns = `
<p>Underwater curves are in section 3. Episodes run from a peak to the next new high, on daily closes. A drawdown that had not recovered by ${CP.end} is marked as such, and its duration runs to that date.</p>
<h3>${lab(COLORS.portfolio, 'Portfolio 50/50')}</h3>${ddTable(DDt.top10.portfolio, ['BTC', 'ETH'])}
<h3>${lab(COLORS.btc, 'BTC')}</h3>${ddTable(DDt.top10.btc, ['ETH', 'Portfolio'])}
<h3>${lab(COLORS.eth, 'ETH')}</h3>${ddTable(DDt.top10.eth, ['BTC', 'Portfolio'])}
<h3>Does one sleeve help when the other is in drawdown?</h3>
${table(['Drawdowns considered', 'Count', 'Other sleeve positive', 'Other sleeve, mean return', 'Own mean depth', 'Portfolio, mean return'], [
    ['10 largest BTC drawdowns: ETH', int(hp.ethDuringBtcTop10.n), pct(hp.ethDuringBtcTop10.otherPositive, 0), spct(hp.ethDuringBtcTop10.otherMean), pct(hp.ethDuringBtcTop10.ownMean), spct(hp.ethDuringBtcTop10.portfolioMean)],
    ['10 largest ETH drawdowns: BTC', int(hp.btcDuringEthTop10.n), pct(hp.btcDuringEthTop10.otherPositive, 0), spct(hp.btcDuringEthTop10.otherMean), pct(hp.btcDuringEthTop10.ownMean), spct(hp.btcDuringEthTop10.portfolioMean)],
    ['BTC drawdowns deeper than 15 %: ETH', int(hp.ethDuringBtc15.n), pct(hp.ethDuringBtc15.otherPositive, 0), spct(hp.ethDuringBtc15.otherMean), pct(hp.ethDuringBtc15.ownMean), spct(hp.ethDuringBtc15.portfolioMean)],
    ['ETH drawdowns deeper than 15 %: BTC', int(hp.btcDuringEth15.n), pct(hp.btcDuringEth15.otherPositive, 0), spct(hp.btcDuringEth15.otherMean), pct(hp.btcDuringEth15.ownMean), spct(hp.btcDuringEth15.portfolioMean)],
  ])}
<p>The other sleeve cushions more often than it rescues. During the 10 largest drawdowns of one sleeve, the other one was positive in ${pct(hp.ethDuringBtcTop10.otherPositive, 0)} (ETH during BTC drawdowns) and ${pct(hp.btcDuringEthTop10.otherPositive, 0)} (BTC during ETH drawdowns) of cases. On average it lost less than the sleeve in drawdown: over these windows the portfolio lost ${pct(hp.ethDuringBtcTop10.portfolioMean / hp.ethDuringBtcTop10.ownMean, 0)} of the BTC drawdown and ${pct(hp.btcDuringEthTop10.portfolioMean / hp.btcDuringEthTop10.ownMean, 0)} of the ETH drawdown. The largest ETH drawdown (${pct(DDt.top10.eth[0].depth)}, ${DDt.top10.eth[0].start} → ${DDt.top10.eth[0].trough}) coincided with a ${spct(DDt.top10.eth[0].others.BTC)} BTC move, and the portfolio lost ${pct(-DDt.top10.eth[0].others.Portfolio)}. Portfolio drawdowns are, almost by construction, periods when both sleeves lose: in ${(DDt.top10.portfolio as Any[]).filter(r => r.others.BTC < 0 && r.others.ETH < 0).length} of the portfolio's 10 largest drawdowns both sleeves fell over the decline. The deepest (${pct(DDt.top10.portfolio[0].depth)} from ${DDt.top10.portfolio[0].start}${DDt.top10.portfolio[0].recovery ? '' : ', not recovered at the end of the sample'}) combined BTC ${spct(DDt.top10.portfolio[0].others.BTC)} and ETH ${spct(DDt.top10.portfolio[0].others.ETH)}.</p>`

  // ---------------------------------------------------------------- 12. calendrier
  const AN = S.annual as Any[]
  const MO = S.monthly as Any[]
  const years = [...new Set(MO.map(m => m.month.slice(0, 4)))]
  const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hv = years.map(y => [...MN.map((_, j) => { const m = MO.find(x => x.month === `${y}-${String(j + 1).padStart(2, '0')}`); return m ? m.portfolio : null }), AN.find(a => String(a.year) === y)?.portfolio ?? null])
  const calendar = `
${table(['Year', 'Days', lab(COLORS.btc, 'BTC return'), lab(COLORS.eth, 'ETH return'), lab(COLORS.portfolio, 'Portfolio return'), 'BTC Sharpe', 'ETH Sharpe', 'Portfolio Sharpe', 'Portfolio max DD', 'B (monthly) return'], AN.map(a => [`${a.year}${a.partial ? '*' : ''}`, int(a.days), spct(a.btc), spct(a.eth), spct(a.portfolio), num(a.btcSharpe), num(a.ethSharpe), num(a.portfolioSharpe), pct(a.portfolioDD), spct(a.rebalanced)]))}
${note(`*Partial years: ${AN[0].from} → ${AN[0].to} and ${AN[AN.length - 1].from} → ${AN[AN.length - 1].to}. Yearly Sharpe ratios use the days of that year only. Max DD is measured within the year, from its first day.`)}
<h3>Annual returns</h3>
${groupedBars({ title: 'Annual returns', cats: AN.map(a => `${a.year}${a.partial ? '*' : ''}`), series: [{ name: 'BTC', color: COLORS.btc, y: AN.map(a => a.btc) }, { name: 'ETH', color: COLORS.eth, y: AN.map(a => a.eth) }, { name: 'Portfolio', color: COLORS.portfolio, y: AN.map(a => a.portfolio) }] })}
<h3>Portfolio monthly returns (%)</h3>
${heatmap({ title: 'Monthly returns of the 50/50 portfolio', rows: years, cols: [...MN, 'Year'], v: hv, cap: 0.2 })}
${note('Blue: gain; red: loss; color intensity in steps of 4 % (capped at 20 %). Values in %. The "Year" column is the calendar-year return (partial in 2018 and 2026).')}`

  // ---------------------------------------------------------------- 13. distribution et concentration
  const CC = S.concentration
  const nz = (r: number[]) => r.filter(x => x !== 0)
  const flatShare = (r: number[]) => r.filter(x => x === 0).length / r.length
  const ccRow = (l: string, c: Any) => [l, int(c.n), pct(c.top1, 0), pct(c.top5, 0), pct(c.top10, 0), pct(c.cagr), pct(c.cagrWithoutTop5), num(c.skew)]
  const concentration = `
<h3>Distribution of daily returns (days with a non-zero return)</h3>
${histograms({ title: 'Distribution of daily returns', lo: -0.1, hi: 0.15, step: 0.005, series: [{ name: 'BTC', color: COLORS.btc, y: nz(I.rb) }, { name: 'ETH', color: COLORS.eth, y: nz(I.re) }, { name: 'Portfolio', color: COLORS.portfolio, y: nz(I.rp) }], notes: [`${pct(flatShare(I.rb), 0)} of days flat, not shown · skew ${num(B.m.skew)}`, `${pct(flatShare(I.re), 0)} of days flat, not shown · skew ${num(E.m.skew)}`, `${pct(flatShare(I.rp), 0)} of days flat, not shown · skew ${num(Pf.m.skew)}`] })}
${note('Bins of 0.5 %; returns beyond −10 % or +15 % are counted in the end bins. Heights are shares of the non-zero days of each series.')}
<h3>Concentration of results</h3>
${table(['Unit', 'Count', 'Top 1 % share', 'Top 5 % share', 'Top 10 % share', 'CAGR', 'CAGR without top 5 %', 'Skew'], [
    ccRow(lab(COLORS.portfolio, 'Portfolio · trades'), CC.tradesPortfolio), ccRow(lab(COLORS.btc, 'BTC · trades'), CC.tradesBtc), ccRow(lab(COLORS.eth, 'ETH · trades'), CC.tradesEth),
    ccRow(lab(COLORS.portfolio, 'Portfolio · days'), CC.daysPortfolio), ccRow(lab(COLORS.btc, 'BTC · days'), CC.daysBtc), ccRow(lab(COLORS.eth, 'ETH · days'), CC.daysEth),
  ])}
${note(`<strong>Definition.</strong> A portfolio trade is one sleeve trade, since the sleeves trade different instruments and never net, measured as log(1 + PnL / portfolio equity at entry). Daily: log(1 + daily return). Share = sum of the top k values / sum of all values, which is the total log growth; above 100 % means the remaining trades or days lose in aggregate. "CAGR without top 5 %" removes those log contributions from the realized growth. Overlapping positions make trade contributions approximately, not exactly, additive, so the day-based figures are given as a check. In currency (not log) terms, the top 5 % of portfolio trades carry ${pct(CC.currencyTop5, 0)} of the PnL (later trades weigh more there because equity compounds).`)}
<p>The edge sits in the right tail. The best 5 % of trades (${int(Math.round(CC.tradesPortfolio.n * 0.05))} out of ${int(CC.tradesPortfolio.n)}) account for ${pct(CC.tradesPortfolio.top5, 0)} of the portfolio's log growth. Without them, the CAGR would be ${pct(CC.tradesPortfolio.cagrWithoutTop5, 0)}. This is the profile of a strategy with many small losses (${pct(1 - Pf.trades.winRate, 0)} of trades lose) and a few large winners (payoff ${num(Pf.trades.payoff)}). Combining the sleeves does not change this structure: shares are similar for BTC, ETH and the portfolio. A period without large winning trades will be a losing period for the portfolio.</p>`

  // ---------------------------------------------------------------- 14. bootstrap
  const BT = S.bootstrap
  const ci = (c: Any, f: (x: number) => string) => [f(c.median), `${f(c.p5)} to ${f(c.p95)}`, `${f(c.p2_5)} to ${f(c.p97_5)}`]
  const bootstrap = `
<p>Block bootstrap by calendar month: ${int(BT.replications)} replications, each a history of ${BT.blocks} months drawn with replacement from the ${BT.blocks} months of the common period (seed ${BT.seed}). The <strong>same months are drawn for BTC and ETH</strong>, so their dependence within each month is preserved. Each replication replays variant A (50/50, no rebalancing) on the drawn path.</p>
${table(['Statistic', 'Historical', 'Bootstrap median', '90 % interval', '95 % interval'], [
    ['Portfolio Sharpe', num(Pf.m.sharpe), ...ci(BT.sharpe, x => num(x))],
    ['Portfolio CAGR', pct(Pf.m.cagr), ...ci(BT.cagr, x => pct(x))],
    ['Portfolio max drawdown', pct(Pf.m.maxDD), ...ci(BT.maxDD, x => pct(x))],
    ['BTC Sharpe (same draws)', num(B.m.sharpe), ...ci(BT.sharpeBtc, x => num(x))],
    ['ETH Sharpe (same draws)', num(E.m.sharpe), ...ci(BT.sharpeEth, x => num(x))],
  ])}
${table(['Probability (share of replications)', 'Value'], [
    ['P(Sharpe portfolio > 0)', pct(BT.pSharpePos, 1)], ['P(Sharpe portfolio > 1)', pct(BT.pSharpeGt1, 1)],
    ['P(Sharpe portfolio > Sharpe BTC)', pct(BT.pBeatsBtc, 1)], ['P(Sharpe portfolio > Sharpe ETH)', pct(BT.pBeatsEth, 1)], ['P(Sharpe portfolio > both)', pct(BT.pBeatsBoth, 1)],
    ['P(max DD portfolio smaller than BTC)', pct(BT.pDDBetterThanBtc, 1)], ['P(max DD portfolio smaller than ETH)', pct(BT.pDDBetterThanEth, 1)],
  ])}
${note('Limits: the bootstrap resamples history; it is not a forecast. Monthly blocks keep dependence within a month but break longer episodes, so the drawdown interval understates multi-month losing streaks. It cannot represent a regime that never occurred in 2018–2026, and the strategy parameters are held fixed (no selection uncertainty is added).')}`

  // ---------------------------------------------------------------- 15. capacité
  const CA = S.capacity
  const capacity = `
${table(['Proxy', lab(COLORS.btc, 'BTC'), lab(COLORS.eth, 'ETH'), lab(COLORS.portfolio, 'Portfolio')], [
    ['Trades per year', num(CA.tradesPerYear.btc, 0), num(CA.tradesPerYear.eth, 0), num(CA.tradesPerYear.total, 0)],
    ['Turnover per year, one-way (entries)', times(CA.turnover.btc.turnoverOneWay), times(CA.turnover.eth.turnoverOneWay), times(CA.turnover.portfolio.turnoverOneWay)],
    ['Turnover per year, two-way (entries + exits)', times(CA.turnover.btc.turnoverTwoWay), times(CA.turnover.eth.turnoverTwoWay), times(CA.turnover.portfolio.turnoverTwoWay)],
    ['Holding time, mean', `${num(CA.holdingHours.btc[0], 1)} h`, `${num(CA.holdingHours.eth[0], 1)} h`, `${num(CA.holdingHours.pooled[0], 1)} h`],
    ['Holding time, median', `${num(CA.holdingHours.btc[1], 1)} h`, `${num(CA.holdingHours.eth[1], 1)} h`, `${num(CA.holdingHours.pooled[1], 1)} h`],
    ['Time in market', pct(CA.sleeves.btc.timeInMarket), pct(CA.sleeves.eth.timeInMarket), `${pct(CA.exposure.timeInMarket)} (any sleeve)`],
    ['Simultaneous positions (share of time)', '—', '—', pct(CA.simultaneous)],
    ['Average gross exposure', pct(CA.sleeves.btc.avgGross), pct(CA.sleeves.eth.avgGross), pct(CA.exposure.avgGross)],
    ['Average net exposure', '—', '—', pct(CA.exposure.avgNet)],
    ['Maximum gross exposure', pct(CA.sleeves.btc.maxGross), pct(CA.sleeves.eth.maxGross), pct(CA.exposure.maxGross)],
  ])}
<p class="callout"><strong>Capacity and market impact are not yet modeled.</strong> No capacity figure is given. Each entry and exit is a market order for the full sleeve, executed at the 15-minute close in the simulation, about ${num(CA.tradesPerYear.total, 0)} round trips a year across the two markets. These proxies show the order flow a capacity study would have to price.</p>`

  // ---------------------------------------------------------------- 16. preuves existantes
  const yn = (b: boolean) => (b ? 'yes' : '<strong>no</strong>')
  const fixMinus = (x: string) => String(x).replace(/(^|\s)-(?=\d)/g, '$1\u2212')
  const DATA: Record<string, string> = { btc: 'BTC/USD · Bitstamp', eth: 'ETH/USDT · Binance', ethDukascopy: 'ETH/USD · Dukascopy', gold: 'XAU/USD spot · Dukascopy', sol: 'SOL/USDT · Binance', tao: 'TAO/USDT · Binance' }
  const zsRow = (k: string, name: string, status: string) => {
    const z = ev[k]
    return [name, DATA[k], `<span class="nw">${z.period[0]} →</span> <span class="nw">${z.period[1]}</span>`, num(z.sharpe), pct(z.cagr), pct(z.dd), int(z.trades), yn(z.eventsShockTrend), pct(z.randomBeaten, 0), z.meanTrade > 0 ? pct(z.delay1Share, 0) : 'n/m', status]
  }
  const robRows = (['robBtc', 'robEth'] as const).flatMap(k => ev[k].levels.map((l: Any) => [`${k === 'robBtc' ? 'BTC' : 'ETH'} · ±${Math.round(l.level * 100)} %`, num(l.preset), num(l.medianSharpe), `${num(l.p10)} – ${num(l.p90)}`, pct(l.rank, 0), pct(l.keep80, 0), pct(l.profitable, 0)]))
  const evidence = `
<p>Results already established by earlier, separate studies. They are not re-run here; the figures are read from the stored reports. Sharpe ratios in these tables use the 15-minute convention of those reports, over each asset's full test period.</p>
${table(['Asset', 'Data', 'Period', 'Sharpe', 'CAGR', 'Max DD', 'Trades', 'Event study: shock → continuation', 'Random entries beaten', '+1 bar delay: share of edge kept', 'Status'], [
    zsRow('btc', 'BTC', 'calibration asset'), zsRow('eth', 'ETH', '<strong>zero-shot transfer</strong>'), zsRow('ethDukascopy', 'ETH (replication)', 'independent data source'),
    zsRow('gold', 'Gold', 'rejected zero-shot'), zsRow('sol', 'SOL', 'partial transfer'), zsRow('tao', 'TAO', 'failed / insufficient sample'),
  ], { cls: 'wrap' })}
${note('Random entries: 200 placebo runs with the same exits, the same regime and the same number of trades, entries drawn at random. +1 bar delay: average trade gain when every entry is taken one 15-minute bar late, as a share of the on-time gain (n/m: not meaningful when the on-time gain is negative).')}
<h3>Local parameter robustness (all preset parameters perturbed jointly, 300 neighbors per level)</h3>
${table(['Asset · perturbation', 'Preset Sharpe', 'Neighbor median', 'Neighbor P10 – P90', 'Preset beats', 'Neighbors keeping ≥ 80 % of the preset Sharpe', 'Neighbors profitable'], robRows)}
<ul>
<li><strong>BTC.</strong> The event study shows continuation after shocks in the direction of the 60-minute trend. The strategy beats ${pct(ev.btc.randomBeaten, 0)} of the random-entry placebos, and entering one bar late keeps ${pct(ev.btc.delay1Share, 0)} of the average trade gain. Walk-forward test (36 months of calibration, 3-month tests, plateau selection, ${ev.walkForward.windows} windows, ${ev.walkForward.period}): out-of-sample Sharpe ${fixMinus(ev.walkForward.sharpe)} (15-min), CAGR ${fixMinus(ev.walkForward.cagr)}, max DD ${fixMinus(ev.walkForward.dd)}. In the robustness test the preset sits at the top of its neighborhood, which is consistent with having been selected on this data. Every neighbor remains profitable.</li>
<li><strong>ETH.</strong> Runs the BTC preset with no ETH calibration (zero-shot). The event study shows continuation, the strategy beats ${pct(ev.eth.randomBeaten, 0)} of the random-entry placebos, and a one-bar delay keeps ${pct(ev.eth.delay1Share, 0)} of the edge. An independent replication on Dukascopy ETH/USD (${ev.ethDukascopy.period[0]} → ${ev.ethDukascopy.period[1]}) passes every criterion: Sharpe ${num(ev.ethDukascopy.sharpe)}, ${int(ev.ethDukascopy.trades)} trades. In the robustness test the preset sits in the middle of its ETH neighborhood: a plateau, not a peak.</li>
<li><strong>Gold</strong>: rejected (no continuation in the event study, negative Sharpe). <strong>SOL</strong>: partial (profitable and beats random entries, but the signal event-study criterion fails and the drawdown is large). <strong>TAO</strong>: failed on the current sample (about two years of data).</li>
</ul>`

  // ---------------------------------------------------------------- 17. interprétation
  const SP = S.stability.subPeriods
  const posYears = AN.filter(a => a.portfolio > 0).length
  const srAbove1 = AN.filter(a => a.portfolioSharpe > 1).length
  const interpretation = `
<ol class="qa">
<li><h3>Do the two sleeves produce two distinct return streams?</h3>
<p>Partly. They are the same engine on two markets whose prices are correlated at ${num(K.underlyingDaily)}, and they share a common component: ${pct(O.entries[0].ethWithBtc, 0)} of ETH entries occur within 15 minutes of a same-direction BTC entry (${pct(O.entries[0].baselineEthWithBtc, 1)} by chance). The overlap ends there. Strategy returns correlate at ${num(K.dailyPearson)}, one sleeve trades alone ${pct(O.states.btcOnly + O.states.ethOnly, 0)} of the time against ${pct(O.states.both, 0)} for both, and the effective number of independent bets is ${num(D.enbDR2, 2)} out of 2. This is one strategy with a meaningful second stream, not two independent alphas.</p></li>
<li><h3>How much diversification does ETH bring?</h3>
<p>A meaningful amount. Against BTC alone, the Sharpe ratio rises by ${spct(D.sharpeVsBtc - 1, 0)} (${num(B.m.sharpe)} → ${num(Pf.m.sharpe)}) and the maximum drawdown falls from ${pct(B.m.maxDD)} to ${pct(Pf.m.maxDD)}. Volatility is ${pct(1 - D.volVsWeighted, 0)} below the weighted average of the two sleeves. The diversification ratio is ${num(D.dr)}. This is close to, but below, what two independent sleeves of the same quality at this correlation would give. The benefit was smaller in the second half of the period: portfolio Sharpe ${num(SP.secondHalf.portfolio.sharpe)} against ${num(Math.max(SP.secondHalf.btc.sharpe, SP.secondHalf.eth.sharpe))} for the better sleeve, when the correlation between the sleeves was higher (${num(SP.secondHalf.corr)}).</p></li>
<li><h3>Does correlation rise sharply in crises?</h3>
<p>No, on the measures available. Correlation is ${num(get('calm').pearson)} on non-stress days and ${num(get('mktCrash').pearson)}–${num(get('mktBear').pearson)} on spot crash and bear-market days, close to the full-period ${num(K.dailyPearson)}. Joint losses are not more frequent than constant dependence implies. Two qualifications apply. When both sleeves lose on the same day, the sizes of their losses are more aligned than the benchmark (${num(get('bothNeg').pearson)} against ${num(get('bothNeg').nullMean)}). And the deepest portfolio drawdown (2026) was a joint one.</p></li>
<li><h3>Does the portfolio improve the return/risk ratio?</h3>
<p>Yes, historically. The portfolio is better on Sharpe (${num(Pf.m.sharpe)}), Sortino (${num(Pf.m.sortino)}), Calmar (${num(Pf.m.calmar)}) and maximum drawdown. Its CAGR (${pct(Pf.m.cagr, 0)}) lies between the sleeves' (${pct(B.m.cagr, 0)} and ${pct(E.m.cagr, 0)}). In the joint monthly bootstrap, the portfolio Sharpe exceeds BTC's in ${pct(BT.pBeatsBtc, 0)} of replications and ETH's in ${pct(BT.pBeatsEth, 0)}. The 90 % interval of the portfolio Sharpe is ${num(BT.sharpe.p5)}–${num(BT.sharpe.p95)}.</p></li>
<li><h3>Does the result depend on a single period?</h3>
<p>Not on a single year. The portfolio return is positive in ${posYears} of ${AN.length} calendar years and its Sharpe is above 1 in ${srAbove1} of ${AN.length}. The weakest year is 2023 (${spct(AN.find(a => a.year === 2023)?.portfolio)}). Performance is not uniform, though. The second half of the period is clearly weaker than the first: Sharpe ${num(SP.secondHalf.portfolio.sharpe)} (${SP.secondHalf.from} → ${SP.secondHalf.to}) against ${num(SP.firstHalf.portfolio.sharpe)} (${SP.firstHalf.from} → ${SP.firstHalf.to}), with a higher correlation between the sleeves (${num(SP.secondHalf.corr)} against ${num(SP.firstHalf.corr)}). The most recent stretch includes the deepest, unrecovered drawdown. Starting in 2019, which leaves out ETH's +210 % in late 2018, gives ${num(SP.from2019.portfolio.sharpe)} with a CAGR of ${pct(SP.from2019.portfolio.cagr, 0)} (diagnostic only; the official period is unchanged). The result does depend on a small number of trades: the best 5 % carry the whole net gain. The rolling 12-month Sharpe was positive ${pct(S.stability.rolling12.portfolio.positive, 0)} of the time.</p></li>
<li><h3>What are the main risks not modeled?</h3>
<p>See section 20: slippage and market impact (zero in the simulation, with 115× annual turnover), perpetual funding, the difference between the data venues (Bitstamp BTC/USD, Binance ETH/USDT) and the execution venue, exchange and stablecoin risk, latency and stop execution in live markets, and the fact that the BTC preset was selected on 2017–2026 data that contains the whole common period. ETH is a transfer across assets, not across time.</p></li>
</ol>
<p class="callout"><strong>Assessment.</strong> Good, not excellent, diversification. On this history the 50/50 combination clearly improves risk-adjusted returns and drawdowns, and correlation did not spike in stress. But the two sleeves share a common driver, carry unequal risk (${pct(RK.equalWeights.pct[0], 0)} / ${pct(RK.equalWeights.pct[1], 0)}), and lost together in the deepest portfolio drawdown.</p>`

  // ---------------------------------------------------------------- 18. hypothèses futures
  const hypotheses = `
<p>Observations made while measuring the frozen portfolio. None of them changes the official portfolio. Each would need to be specified in advance and tested on data not used here (forward period).</p>
<ul>
<li><strong>Rebalancing.</strong> Monthly rebalancing (B, Sharpe ${num(V.B.m.sharpe)}) and equal risk (C, ${num(V.C.m.sharpe)}) did better than A (${num(V.A.m.sharpe)}) in this sample, mainly because A drifted to an average BTC weight of ${pct(W.A.mean, 0)}. Hypothesis: a calendar rebalancing rule improves the frozen portfolio out of sample. If tested, the rule should be fixed now and judged on forward data only.</li>
<li><strong>Shared shocks.</strong> About a quarter of ETH entries coincide with a same-direction BTC entry, and losses on days when both lose are more aligned than the benchmark. Hypothesis: simultaneous same-direction entries carry most of the common risk. Studying this would mean changing the strategy, which is out of scope ${E2V ? 'here' : 'for the frozen v1'}.</li>
<li><strong>Risk balance.</strong> At 50/50 in capital, ETH carries ${pct(RK.equalWeights.pct[1], 0)} of the variance. Whether risk balance helps out of sample is the same open question as the rebalancing one; it is not answered by this history.</li>
</ul>`

  // ---------------------------------------------------------------- 19. contrôles
  const sanity = `
${table(['Check', 'Result', 'Detail'], (S.sanity as Any[]).map(c => [esc(c.name), c.ok ? '<span class="ok">pass</span>' : '<span class="ko">FAIL</span>', esc(c.detail)]), { cls: 'wrap text' })}
<p>Look-ahead: the engine computes every indicator, the daily volatility regime (closed days only) and every decision causally, and its parity with the bar-by-bar live engine is covered by the project's tests (<code>npm run test:research</code>). The portfolio layer only uses closes up to the current day: drifting weights come from the previous close, rebalancing happens at the month-end close with information up to that close, and the equal-risk weights use the 90 days ending at that close.</p>`

  // ---------------------------------------------------------------- 20. limites
  const limits = `
<ul>
${E2V ? '<li><strong>In-sample trend condition.</strong> The daily-trend condition on short entries was specified in October 2026, after BTC and ETH over this period had been studied. Both sleeves are therefore in-sample for that condition; it is being followed forward separately and is not an independent out-of-sample result.</li>\n' : ''}<li><strong>In-sample selection for BTC.</strong> The preset was chosen on BTC 2017–2026, which contains the whole common period. The walk-forward study (section 16) supports the BTC edge out of sample from 2020, but the BTC sleeve figures here are in-sample. ETH is zero-shot across assets, not across time.</li>
<li><strong>Execution costs.</strong> Slippage is zero and fills happen at the bar close or at the stop level. At about 230× two-way turnover a year, each 0.01 % of average slippage per fill costs about 2.3 % of equity a year. Cost ×2 lowers the portfolio Sharpe to ${num(C.stress[2].portfolio.sharpe)}.</li>
<li><strong>Market impact and capacity</strong> are not modeled (section 15).</li>
<li><strong>Funding.</strong> The simulation trades spot-like instruments without funding. Live execution on perpetual futures pays or receives funding while a position is open (about ${pct(Pf.expo.timeInMarket, 0)} of the time).${ST ? ` Stress tests (positions charged or credited at each funding time, correct sign for shorts): ${ST.funding.map(f => `${esc(f.scenario)}: Sharpe ${num(f.sharpe)}, CAGR ${pct(f.cagr)}, max drawdown ${pct(f.maxDD)}`).join('; ')}. Slippage per order: ${ST.slippage.map(x => `${num(x.slippagePctPerOrder, 2)} % → Sharpe ${num(x.sharpe)}`).join(', ')}.` : ''}</li>
<li><strong>Data and venues.</strong> BTC/USD from Bitstamp and ETH/USDT from Binance. The execution venue (Hyperliquid perpetuals for the bot) has different prices, liquidity, fees and stop mechanics. ETH/USDT also carries USDT risk.</li>
<li><strong>Live mechanics.</strong> Candle availability, latency and stop-trigger behavior observed on the live exchange can differ from the simulator's intrabar path (see the bot documentation).</li>
<li><strong>Right-tail dependence.</strong> The best 5 % of trades carry the entire net gain. A market in which large trending moves after shocks disappear would remove the edge, and the bootstrap cannot represent such a regime.</li>
<li><strong>Counterparty, custody and operational risks</strong> are not part of a backtest.</li>
</ul>`

  // ---------------------------------------------------------------- annexe
  const files = `
<p>Produced by <code>node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/portfolio.ts${E2V ? ' --variant e2' : ''}</code> (deterministic, fixed seeds). Next to this report: <code>portfolio_daily_returns.csv</code>, <code>portfolio_monthly_returns.csv</code>, <code>portfolio_annual_returns.csv</code>, <code>portfolio_drawdowns.csv</code>, <code>portfolio_correlation_rolling.csv</code>, <code>portfolio_summary.json</code> (machine-readable, for later integration) and <code>${E2V ? 'shock-engine-manifest.json' : 'shock-engine-v1-manifest.json'}</code> (git commit, dataset and script hashes, parameter hash, assumptions).</p>`

  const toc: [string, string][] = [['method', 'Scope and method'], ['reconciliation', 'Reconciliation with the validated backtests'], ['performance', 'Performance on the common period'], ['rebalancing', 'Rebalancing'], ['costs', 'Transaction costs'], ['correlation', 'BTC/ETH correlation'], ['crisis', 'Downside and crisis correlation'], ['overlap', 'Trade overlap'], ['risk', 'Risk contribution'], ['diversification', 'Diversification'], ['drawdowns', 'Drawdowns'], ['calendar', 'Years and months'], ['concentration', 'Distribution and concentration'], ['bootstrap', 'Bootstrap'], ['capacity', 'Capacity and implementation proxies'], ['evidence', 'Research evidence'], ['interpretation', 'Interpretation'], ['hypotheses', 'Future hypotheses'], ['sanity', 'Sanity checks'], ['limits', 'Limitations and unmodeled risks']]
  const bodies: Record<string, string> = { method, reconciliation, performance, rebalancing, costs, correlation, crisis, overlap, risk, diversification, drawdowns, calendar, concentration, bootstrap, capacity, evidence, interpretation, hypotheses, sanity, limits }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shock Engine BTC/ETH Portfolio</title>
<meta name="description" content="Historical simulation of a 50/50 portfolio of the ${E2V ? '' : 'frozen '}Shock Engine on BTC and ETH, ${CP.start} to ${CP.end}. Not live performance.">
<style>${CSS}</style>
</head>
<body>
<div class="banner">HISTORICAL SIMULATION · NOT LIVE OR FORWARD RESULTS</div>
<main>
<header>
<p class="eyebrow">Shock Engine research · ${esc(S.version)}</p>
<h1>Shock Engine BTC/ETH Portfolio</h1>
<p class="subtitle">${esc(S.subtitle)}</p>
<p class="meta">Common period ${CP.start} → ${CP.end} · official allocation 50/50, no rebalancing · commission 0.045 % per order · daily Sharpe, √365.25, risk-free 0</p>
</header>
<section id="summary"><h2>Executive summary</h2>${summary}</section>
<nav class="toc"><h2>Contents</h2><ol>${toc.map(([id, t]) => `<li><a href="#${id}">${t}</a></li>`).join('')}</ol></nav>
${toc.map(([id, t], i) => section(id, String(i + 1), t, bodies[id])).join('\n')}
<section id="files"><h2>Files and reproducibility</h2>${files}</section>
<footer><p>${E2V ? (S.disclaimers as string[]).map(esc).join(' ') + ' Past simulated results do not predict future results.' : 'Historical simulation after modeled transaction costs. Not live performance. Past simulated results do not predict future results. Ethereum parameters were inherited from Bitcoin and were not calibrated on ETH. Capacity and market impact are not yet modeled.'}</p></footer>
</main>
<script>${JS}</script>
</body>
</html>
`
}

const CSS = `
:root{color-scheme:light;--page:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink2:#52514e;--muted:#898781;--grid:#e1e0d9;--axis:#c3c2b7;--border:rgba(11,11,11,.10);--s1:#2a78d6;--s2:#eb6834;--s3:#1baf7a;--pos:#1c5cab;--neg:#c23b3a;--mid:#f0efec;--ok:#006300;--ko:#d03b3b;--hist:#fff8e6;--histb:#e5b54a;--live:#f0efec}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#898781;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--s3:#199e70;--pos:#3987e5;--neg:#e66767;--mid:#383835;--ok:#0ca30c;--ko:#e66767;--hist:#2a2416;--histb:#9c7a2c;--live:#232322}}
:root[data-theme="dark"]{color-scheme:dark;--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;--muted:#898781;--grid:#2c2c2a;--axis:#383835;--border:rgba(255,255,255,.10);--s1:#3987e5;--s2:#d95926;--s3:#199e70;--pos:#3987e5;--neg:#e66767;--mid:#383835;--ok:#0ca30c;--ko:#e66767;--hist:#2a2416;--histb:#9c7a2c;--live:#232322}
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
.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin:4px 0 16px}
.tile{border:1px solid var(--border);border-radius:10px;padding:12px 14px;background:var(--page)}
.tl{font-size:12px;color:var(--ink2);text-transform:uppercase;letter-spacing:.04em}
.tv{font-size:26px;font-weight:620;margin:4px 0 2px;line-height:1.2}
.ts{font-size:12px;color:var(--muted)}
.lead{font-size:15px;font-weight:550;margin:6px 0}
.status-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}
.status-box{border-radius:10px;padding:12px 14px;font-size:14px}
.status-box p{margin:4px 0 0}
.status-box.hist{background:var(--hist);border:1px solid var(--histb)}
.status-box.live{background:var(--live);border:1px dashed var(--axis)}
.sb-h{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
.toc ol{columns:2;column-gap:32px;margin:0}
.toc a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--grid)}
.toc a:hover{border-color:var(--ink2)}
nav.toc{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px 22px;margin:18px 0}
.tw{overflow-x:auto;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:13.5px;font-variant-numeric:tabular-nums}
caption{text-align:left;color:var(--ink2);font-size:13px;padding-bottom:4px}
th{font-weight:600;color:var(--ink2);text-align:right;padding:7px 8px;border-bottom:1px solid var(--axis);vertical-align:bottom;font-size:12.5px}
td{padding:6px 8px;border-bottom:1px solid var(--grid);text-align:right;vertical-align:top}
td:not(:first-child){white-space:nowrap}
.wrap td{white-space:normal}
.text td:not(:first-child){text-align:left}
.nw{white-space:nowrap}
th:first-child,td:first-child{text-align:left}
table.metrics td:first-child{color:var(--ink2)}
.d{color:var(--muted);font-size:12px}
.note{font-size:12.5px;color:var(--ink2);margin:6px 0 10px}
.formula{font-family:ui-serif,Georgia,serif;font-size:16px;text-align:center;margin:12px 0}
.callout{border-left:3px solid var(--s3);background:var(--page);padding:10px 14px;border-radius:0 8px 8px 0}
.ok{color:var(--ok);font-weight:600}.ko{color:var(--ko);font-weight:700}
.key{display:inline-block;vertical-align:middle;margin-right:6px}
.key.rect{width:10px;height:10px;border-radius:2px}
.key.line{width:14px;height:2px;border-radius:1px}
.legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink2);margin:6px 0 2px}
.chartbox{position:relative;margin:4px 0 8px}
svg.chart{width:100%;height:auto;display:block;overflow:visible}
.grid{stroke:var(--grid);stroke-width:1}
.axis{stroke:var(--axis);stroke-width:1}
.tick{fill:var(--muted);font-size:11px;font-variant-numeric:tabular-nums}
.ln{fill:none;stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.area{opacity:.10}
.ref{stroke:var(--axis);stroke-width:1;stroke-dasharray:4 3}
.reflabel{fill:var(--ink2);font-size:11px}
.endlabel{fill:var(--ink2);font-size:12px}
.dot{stroke:var(--surface);stroke-width:2}
.cross{stroke:var(--ink2);stroke-width:1}
.bar{outline:none}.bar:hover,.bar:focus{opacity:.75}
.pt{opacity:.4}.pt.clip{opacity:.9}
.fit{stroke:var(--ink2);stroke-width:1.5}
.axlabel{fill:var(--ink2);font-size:12px}
.paneltitle{fill:var(--ink);font-size:13px;font-weight:600}
.panels{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.panel{margin:0}.panel figcaption{font-size:12px;color:var(--muted);margin-top:2px}
.split{display:grid;grid-template-columns:minmax(0,460px) 1fr;gap:18px;align-items:start}
.aside{font-size:14px;color:var(--ink2)}
.heatbox{overflow-x:auto}
svg.heat{min-width:640px;max-width:720px}
.h0{fill:var(--mid)}
.hp1{fill:color-mix(in oklab,var(--pos) 18%,var(--mid))}.hp2{fill:color-mix(in oklab,var(--pos) 36%,var(--mid))}.hp3{fill:color-mix(in oklab,var(--pos) 56%,var(--mid))}.hp4{fill:color-mix(in oklab,var(--pos) 76%,var(--mid))}.hp5{fill:var(--pos)}
.hn1{fill:color-mix(in oklab,var(--neg) 18%,var(--mid))}.hn2{fill:color-mix(in oklab,var(--neg) 36%,var(--mid))}.hn3{fill:color-mix(in oklab,var(--neg) 56%,var(--mid))}.hn4{fill:color-mix(in oklab,var(--neg) 76%,var(--mid))}.hn5{fill:var(--neg)}
.hv{fill:var(--ink);font-size:11px;font-variant-numeric:tabular-nums;pointer-events:none}.hv.inv{fill:#fff}
.cell{outline:none}.cell:hover rect,.cell:focus rect{stroke:var(--ink);stroke-width:1.5}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);box-shadow:0 4px 14px rgba(0,0,0,.12);border-radius:8px;padding:8px 10px;font-size:12.5px;min-width:150px;z-index:3}
.tip .tdate{color:var(--muted);font-size:11.5px;margin-bottom:4px}
.tip .trow{display:flex;align-items:center;gap:8px;justify-content:space-between}
.tip .tname{color:var(--ink2)}.tip .tval{font-weight:650;font-variant-numeric:tabular-nums}
.qa>li{margin:0 0 12px}.qa h3{margin:10px 0 4px}
footer{color:var(--muted);font-size:12.5px;padding:10px 4px}
@media (max-width:720px){h1{font-size:27px}.status-grid,.split,.panels{grid-template-columns:1fr}.toc ol{columns:1}section{padding:16px 14px}.tv{font-size:22px}}
@media print{.banner{position:static}.tip{display:none}section{break-inside:avoid-page}}
`

const JS = `
(function(){
  var DAY=864e5;
  function fmt(v,f){if(v===null||v===undefined)return '—';if(f==='pct')return (v<0?'\\u2212':'')+Math.abs(v*100).toFixed(1)+'%';if(f==='idx')return Math.round(v).toLocaleString('en-US');return (v<0?'\\u2212':'')+Math.abs(v).toFixed(2)}
  document.querySelectorAll('svg.line').forEach(function(svg){
    var id=svg.getAttribute('data-chart');var el=document.getElementById('data-'+id);if(!el)return;
    var d=JSON.parse(el.textContent);var box=svg.parentNode;var tip=box.querySelector('.tip');var cross=svg.querySelector('.cross');
    var pl=+svg.getAttribute('data-pl'),pw=+svg.getAttribute('data-pw'),W=+svg.getAttribute('data-w');var n=d.x.length;
    function hide(){tip.hidden=true;cross.setAttribute('visibility','hidden')}
    svg.addEventListener('pointerleave',hide);
    svg.addEventListener('pointermove',function(e){
      var r=svg.getBoundingClientRect();var s=r.width/W;var px=(e.clientX-r.left)/s;
      var k=Math.round((px-pl)/pw*(n-1));if(k<0||k>=n){hide();return}
      var x=pl+k/(n-1)*pw;cross.setAttribute('x1',x);cross.setAttribute('x2',x);cross.setAttribute('visibility','visible');
      while(tip.firstChild)tip.removeChild(tip.firstChild);
      var dt=document.createElement('div');dt.className='tdate';dt.textContent=new Date(d.x[k]*DAY).toISOString().slice(0,10);tip.appendChild(dt);
      d.series.forEach(function(sr){var row=document.createElement('div');row.className='trow';var nm=document.createElement('span');nm.className='tname';var key=document.createElement('i');key.className='key line';key.style.background=sr.color;nm.appendChild(key);nm.appendChild(document.createTextNode(sr.name));var v=document.createElement('span');v.className='tval';v.textContent=fmt(sr.y[k],d.fmt);row.appendChild(nm);row.appendChild(v);tip.appendChild(row)});
      tip.hidden=false;var bx=box.getBoundingClientRect();var left=e.clientX-bx.left+14;if(left+tip.offsetWidth>bx.width)left=e.clientX-bx.left-tip.offsetWidth-14;tip.style.left=Math.max(0,left)+'px';tip.style.top=Math.max(0,e.clientY-bx.top-tip.offsetHeight/2)+'px';
    });
  });
})();
`
