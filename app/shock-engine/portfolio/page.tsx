import type { Metadata } from 'next'
import Link from 'next/link'
import '../../_site/site.css'
import SiteHeader from '../../_site/SiteHeader'
import LineChart from '../../_site/LineChart'
import { GroupedBars, Heatmap } from '../../_site/charts'
import { Disclaimer, Key, Section, SimBar, SiteFooter, StatusBoxes, Table, Tiles } from '../../_site/ui'
import { COLORS, DOWNLOADS, P, series } from '../../_site/data'
import { int, month, monthKey, num, pct, spct, times } from '../../_site/format'

export const metadata: Metadata = {
  title: 'Shock Engine BTC/ETH Portfolio — ShadowMarketPro™',
  description: `Historical simulation of a 50/50 portfolio of the frozen Shock Engine on Bitcoin and Ethereum, ${P.commonPeriod.start} to ${P.commonPeriod.end}. Not live performance.`,
}

const B = P.series.btc, E = P.series.eth, F = P.series.portfolio
const CP = P.commonPeriod
const K = P.correlation
const crisis = (key: string) => P.crisis.rows.find(r => r.key === key)!
const tail = (key: string) => K.coLoss.rows.find(r => r.key === key)!
const SP = P.stability.subPeriods
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const partial = (y: number) => y === 2018 || y === 2026

export default function PortfolioPage() {
  const years = [...new Set(P.monthly.map(m => m.month.slice(0, 4)))]
  const heat = years.map(y => [
    ...MN.map((_, j) => P.monthly.find(m => m.month === `${y}-${String(j + 1).padStart(2, '0')}`)?.portfolio ?? null),
    P.annual.find(a => String(a.year) === y)?.portfolio ?? null,
  ])
  const perf: [string, (s: typeof B) => string][] = [
    ['Total return', s => pct(s.m.totalReturn, 0)],
    ['CAGR', s => pct(s.m.cagr)],
    ['Annualized volatility', s => pct(s.m.vol)],
    ['Sharpe ratio', s => num(s.m.sharpe)],
    ['Sortino ratio', s => num(s.m.sortino)],
    ['Max drawdown (daily closes)', s => pct(s.m.maxDD)],
    ['Max drawdown (15-min marks)', s => pct(s.ddIntraday)],
    ['Calmar ratio', s => num(s.m.calmar)],
    ['Skewness of daily returns', s => num(s.m.skew)],
    ['Profit factor (trades)', s => num(s.trades.profitFactor)],
    ['Time in market', s => pct(s.expo.timeInMarket, 0)],
    ['Transaction costs per year', s => pct(s.cost.totalCostPctYr)],
    ['Trades', s => int(s.trades.trades)],
    ['Winning trades', s => pct(s.trades.winRate, 0)],
    ['Payoff ratio (avg win / avg loss)', s => num(s.trades.payoff)],
    ['Best month', s => `${pct(s.m.bestMonth.ret)} (${month(monthKey(s.m.bestMonth.key))})`],
    ['Worst month', s => `${pct(s.m.worstMonth.ret)} (${month(monthKey(s.m.worstMonth.key))})`],
    ['Worst year', s => `${spct(s.m.worstYear.ret)} (${s.m.worstYear.key})`],
  ]
  const D = P.diversification, R = P.risk.equalWeights, BT = P.bootstrap
  return (
    <div className="s-page">
      <SiteHeader />
      <SimBar />
      <main className="s-main">
        <div className="s-hero">
          <p className="s-eyebrow">Shock Engine research · {P.manifest.version}</p>
          <h1 className="s-h1">{P.title}</h1>
          <p className="s-sub">{P.subtitle}</p>
          <Tiles items={[
            { label: 'Common period', value: `${CP.start.slice(0, 7)} → ${CP.end.slice(0, 7)}`, sub: `${CP.years.toFixed(1)} years · ${int(CP.days)} days` },
            { label: 'BTC Sharpe', value: num(P.headline.btcSharpe), sub: 'daily returns' },
            { label: 'ETH Sharpe', value: num(P.headline.ethSharpe), sub: 'daily returns' },
            { label: 'Portfolio Sharpe', value: num(P.headline.portfolioSharpe), sub: '50/50, no rebalancing' },
            { label: 'Portfolio CAGR', value: pct(P.headline.portfolioCagr), sub: 'after modeled commissions' },
            { label: 'Portfolio max drawdown', value: pct(P.headline.portfolioMaxDD), sub: `${pct(F.ddIntraday)} on 15-min marks` },
            { label: 'BTC/ETH daily correlation', value: num(K.dailyPearson), sub: `strategy returns · spot ${num(K.underlyingDaily)}` },
            { label: 'Worst month', value: pct(P.headline.worstMonth.ret), sub: month(P.headline.worstMonth.month) },
            { label: 'Number of trades', value: int(P.headline.trades.total), sub: `${int(P.headline.trades.btc)} BTC · ${int(P.headline.trades.eth)} ETH` },
          ]} />
          <p className="s-lead"><strong>{P.disclaimers[0]}</strong></p>
          <p className="s-lead"><strong>{P.disclaimers[1]}</strong></p>
          <StatusBoxes period={`${CP.start} → ${CP.end}`} />
          <nav className="s-toc" aria-label="On this page">
            <a href="#equity">Equity and drawdowns</a><a href="#performance">Performance</a><a href="#diversification">Diversification</a>
            <a href="#crisis">Crisis behavior</a><a href="#calendar">Years and months</a><a href="#robustness">Robustness</a>
            <a href="#method">Method and limits</a><a href="#downloads">Downloads</a>
          </nav>
        </div>

        <Section id="equity" title="Equity and drawdowns" intro={<p>Each sleeve starts with half of the capital and compounds only its own half. The portfolio is the sum of the two sleeves. Values are indexed to 100 on {CP.start}.</p>}>
          <LineChart title="Equity curves, log scale" start={P.chart.start} fmt="idx" log series={[
            { name: 'BTC', color: COLORS.btc, values: series(P.chart.eqBtc) },
            { name: 'ETH', color: COLORS.eth, values: series(P.chart.eqEth) },
            { name: 'Portfolio', color: COLORS.portfolio, values: series(P.chart.eqPortfolio) },
          ]} />
          <h3 className="s-h3">Drawdown from previous peak</h3>
          <LineChart title="Drawdowns" start={P.chart.start} fmt="pct" yMax={0} area height={250} series={[
            { name: 'BTC', color: COLORS.btc, values: series(P.chart.ddBtc) },
            { name: 'ETH', color: COLORS.eth, values: series(P.chart.ddEth) },
            { name: 'Portfolio', color: COLORS.portfolio, values: series(P.chart.ddPortfolio) },
          ]} />
          <p className="s-small">The deepest portfolio drawdown ({pct(P.drawdowns.top10.portfolio[0].depth)}, from {P.drawdowns.top10.portfolio[0].start}) had not recovered at the end of the sample.</p>
        </Section>

        <Section id="performance" title="Performance on the common period" intro={<p>Daily UTC close-to-close returns, annualized with √365.25, risk-free rate 0. BTC, ETH and the portfolio are measured over exactly the same {int(CP.days)} days.</p>}>
          <Table head={['', <Key key="b" color={COLORS.btc}>BTC</Key>, <Key key="e" color={COLORS.eth}>ETH</Key>, <Key key="p" color={COLORS.portfolio}>Portfolio 50/50</Key>]} rows={perf.map(([l, f]) => [l, f(B), f(E), f(F)])} />
          <p className="s-small">Portfolio trades are the {int(F.trades.trades)} sleeve trades pooled; the payoff ratio uses their contribution to portfolio equity. 2018 covers September–December and 2026 covers January–September.</p>
        </Section>

        <Section id="diversification" title="Diversification" intro={<p>The two sleeves run the same engine on two markets whose prices are correlated at {num(K.underlyingDaily)}. Their strategy returns correlate at {num(K.dailyPearson)}: each sleeve is out of the market most of the time, and on most active days only one of them moves.</p>}>
          <div className="s-grid2">
            <Table head={['Measure', 'Value']} rows={[
              ['Sharpe: portfolio / better sleeve', `${num(D.sharpeVsBest, 3)} (${spct(D.sharpeVsBest - 1)})`],
              ['Volatility: portfolio / weighted sleeves', `${num(D.volVsWeighted, 3)} (${spct(D.volVsWeighted - 1)})`],
              ['Max drawdown: portfolio vs BTC, ETH', `${pct(F.m.maxDD)} vs ${pct(B.m.maxDD)}, ${pct(E.m.maxDD)}`],
              ['Diversification ratio', num(D.dr)],
              ['Effective independent bets (DR²)', `${num(D.enbDR2)} of 2`],
              ['Share of risk at 50/50: BTC / ETH', `${pct(R.pct[0], 0)} / ${pct(R.pct[1], 0)}`],
            ]} />
            <Table head={['Correlation of strategy returns', 'Value']} rows={[
              ['Daily, Pearson', num(K.dailyPearson)],
              ['Daily, Spearman', num(K.dailySpearman)],
              ['Weekly', num(K.weekly)],
              ['Monthly', num(K.monthly)],
              ['Days when both sleeves were exposed', num(K.bothInPosition.pearson)],
              ['Rolling 90 days: median (P10 to P90)', `${num(K.rolling['90'].median)} (${num(K.rolling['90'].p10)} to ${num(K.rolling['90'].p90)})`],
            ]} />
          </div>
          <h3 className="s-h3">Rolling 90-day correlation</h3>
          <LineChart title="Rolling 90-day correlation" start={P.chart.start} fmt="num" yMin={-0.4} yMax={1} height={220} endLabels={false}
            refs={[{ y: K.dailyPearson, label: `full period ${num(K.dailyPearson)}` }, { y: 0 }]}
            series={[{ name: '90-day correlation', color: 'var(--s-ink2)', values: series(P.chart.corr90) }]} />
          <p className="s-p">50/50 in capital is not 50/50 in risk: ETH is the more volatile sleeve ({pct(R.sigma[1], 0)} against {pct(R.sigma[0], 0)} a year) and carries {pct(R.pct[1], 0)} of the variance. Without rebalancing the weights drift; the BTC sleeve averaged {pct(P.weights.A.mean, 0)} of the portfolio and ended at {pct(P.weights.A.end, 0)}.</p>
        </Section>

        <Section id="crisis" title="Behavior in stress" intro={<p>Market stress is defined from spot prices only, never from strategy results. A constant-dependence benchmark (same daily returns, Gaussian copula fitted to the full-period correlation) shows what a selection of days would produce without contagion.</p>}>
          <Table head={['Days used', 'Days', 'Correlation', 'Benchmark']} rows={[
            ['All days', int(crisis('all').days), num(crisis('all').pearson), '—'],
            ['Non-stress days', int(crisis('calm').days), num(crisis('calm').pearson), '—'],
            ['Market crash days (worst 5 % of BTC+ETH spot)', int(crisis('mktCrash').days), num(crisis('mktCrash').pearson), '—'],
            ['Crypto bear market (spot > 30 % below 1-year high)', int(crisis('mktBear').days), num(crisis('mktBear').pearson), '—'],
            ['Named stress episodes', int(crisis('episodes').days), num(crisis('episodes').pearson), '—'],
            ['Both sleeves lost on the day', int(crisis('bothNeg').days), num(crisis('bothNeg').pearson), `${num(crisis('bothNeg').nullMean)} [${num(crisis('bothNeg').nullP5)}, ${num(crisis('bothNeg').nullP95)}]`],
            ['P(ETH loses | BTC loses)', '', pct(tail('coNeg').observed, 0), `${pct(tail('coNeg').mean, 0)} [${pct(tail('coNeg').p5, 0)}, ${pct(tail('coNeg').p95, 0)}]`],
          ]} />
          <p className="s-p">Correlation does not jump in market stress, and joint losses are not more frequent than constant dependence implies. One measure exceeds its benchmark: on days when both sleeves lose, the size of their losses is more aligned, consistent with some trades being the same shock traded on both markets ({pct(P.overlap.entries[0].ethWithBtc, 0)} of ETH entries are within 15 minutes of a same-direction BTC entry).</p>
          <Table head={['Episode', 'Window', 'BTC spot', 'ETH spot', 'Portfolio']} rows={P.crisis.episodes.map(e => [e.name, `${e.from} → ${e.to}`, spct(e.spotBtc), spct(e.spotEth), spct(e.portfolio)])} />
          <p className="s-small">Episode windows were fixed from known market events. The portfolio was positive in {P.crisis.episodes.filter(e => e.portfolio > 0).length} of {P.crisis.episodes.length}. Its own deepest drawdown (2026) hit both sleeves together.</p>
        </Section>

        <Section id="calendar" title="Years and months">
          <Table head={['Year', <Key key="b" color={COLORS.btc}>BTC</Key>, <Key key="e" color={COLORS.eth}>ETH</Key>, <Key key="p" color={COLORS.portfolio}>Portfolio</Key>, 'Portfolio Sharpe', 'Portfolio max DD']}
            rows={P.annual.map(a => [`${a.year}${partial(a.year) ? '*' : ''}`, spct(a.btc), spct(a.eth), spct(a.portfolio), num(a.portfolioSharpe), pct(a.portfolioDD)])} />
          <GroupedBars title="Annual returns" cats={P.annual.map(a => `${a.year}${partial(a.year) ? '*' : ''}`)} series={[
            { name: 'BTC', color: COLORS.btc, values: P.annual.map(a => a.btc) },
            { name: 'ETH', color: COLORS.eth, values: P.annual.map(a => a.eth) },
            { name: 'Portfolio', color: COLORS.portfolio, values: P.annual.map(a => a.portfolio) },
          ]} />
          <p className="s-small">*Partial years: {P.annual[0].from} → {P.annual[0].to} and {P.annual[P.annual.length - 1].from} → {P.annual[P.annual.length - 1].to}.</p>
          <h3 className="s-h3">Portfolio monthly returns (%)</h3>
          <Heatmap title="Monthly returns of the 50/50 portfolio" rows={years} cols={[...MN, 'Year']} values={heat} cap={0.2} />
          <p className="s-small">Blue: gain, red: loss; color steps of 4 % (capped at 20 %).</p>
        </Section>

        <Section id="robustness" title="Robustness">
          <h3 className="s-h3">Monthly block bootstrap</h3>
          <p className="s-p">{int(BT.replications)} resampled histories of {BT.blocks} calendar months. The same months are drawn for BTC and ETH, so their dependence is preserved.</p>
          <Table head={['Statistic', 'Historical', '90 % interval', '95 % interval']} rows={[
            ['Portfolio Sharpe', num(F.m.sharpe), `${num(BT.sharpe.p5)} to ${num(BT.sharpe.p95)}`, `${num(BT.sharpe.p2_5)} to ${num(BT.sharpe.p97_5)}`],
            ['Portfolio CAGR', pct(F.m.cagr), `${pct(BT.cagr.p5)} to ${pct(BT.cagr.p95)}`, `${pct(BT.cagr.p2_5)} to ${pct(BT.cagr.p97_5)}`],
            ['Portfolio max drawdown', pct(F.m.maxDD), `${pct(BT.maxDD.p5)} to ${pct(BT.maxDD.p95)}`, `${pct(BT.maxDD.p2_5)} to ${pct(BT.maxDD.p97_5)}`],
          ]} />
          <p className="s-small">P(Sharpe &gt; 1) {pct(BT.pSharpeGt1, 1)} · P(portfolio Sharpe &gt; BTC) {pct(BT.pBeatsBtc, 0)} · P(portfolio Sharpe &gt; ETH) {pct(BT.pBeatsEth, 0)}. A bootstrap resamples history; it is not a forecast.</p>
          <h3 className="s-h3">Transaction costs (nothing else changes)</h3>
          <Table head={['Commission per order', 'BTC Sharpe', 'ETH Sharpe', 'Portfolio Sharpe', 'Portfolio CAGR', 'Portfolio max DD']}
            rows={P.costs.stress.map(c => [`${c.commissionPct.toFixed(3)} % (×${c.k})`, num(c.btc.sharpe), num(c.eth.sharpe), num(c.portfolio.sharpe), pct(c.portfolio.cagr), pct(c.portfolio.maxDD)])} />
          <p className="s-small">Turnover is about {times(F.cost.turnoverOneWay)} the capital a year (entries only), so costs take about {pct(P.costs.cagrDrag.portfolio, 0)} of CAGR. Doubling costs is equivalent to adding 0.045 % of slippage on every fill.</p>
          <h3 className="s-h3">Sub-periods</h3>
          <Table head={['Period', 'BTC Sharpe', 'ETH Sharpe', 'Portfolio Sharpe', 'Portfolio CAGR', 'Correlation']} rows={[
            [`First half · ${SP.firstHalf.from} → ${SP.firstHalf.to}`, num(SP.firstHalf.btc.sharpe), num(SP.firstHalf.eth.sharpe), num(SP.firstHalf.portfolio.sharpe), pct(SP.firstHalf.portfolio.cagr), num(SP.firstHalf.corr)],
            [`Second half · ${SP.secondHalf.from} → ${SP.secondHalf.to}`, num(SP.secondHalf.btc.sharpe), num(SP.secondHalf.eth.sharpe), num(SP.secondHalf.portfolio.sharpe), pct(SP.secondHalf.portfolio.cagr), num(SP.secondHalf.corr)],
          ]} />
          <p className="s-p">The second half is clearly weaker than the first for both sleeves, the correlation between them is higher, and the diversification gain is smaller. The result also depends on the right tail: the best 5 % of trades account for {pct(P.concentration.tradesPortfolio.top5, 0)} of the portfolio&apos;s log growth.</p>
          <h3 className="s-h3">Rebalancing</h3>
          <p className="s-p">The official portfolio has no rebalancing; this was decided before any result. As a diagnostic only, monthly rebalancing to 50/50 gave a Sharpe of {num(P.variants.B.m.sharpe)} (against {num(P.variants.A.m.sharpe)}), mainly because the unrebalanced portfolio drifted towards ETH. It is recorded as a hypothesis for forward testing, not adopted.</p>
        </Section>

        <Section id="method" title="Method and limitations">
          <ul className="s-list">
            <li><strong>Frozen strategy.</strong> Both sleeves run the bot&apos;s adaptive-volatility 15-minute preset, selected on Bitcoin. Ethereum runs it unchanged (zero-shot). The portfolio reproduces the validated backtests exactly before any calculation; {P.manifest.checksPassed} of {P.manifest.checksTotal} consistency checks pass.</li>
            <li><strong>Data.</strong> {P.manifest.datasets.btc}; {P.manifest.datasets.eth}; 15-minute bars, UTC.</li>
            <li><strong>Capital.</strong> 50/50 at the start; each sleeve trades 100 % of its own equity, one position at a time, without leverage. Average gross exposure {pct(F.expo.avgGross, 0)} of the portfolio, maximum {pct(F.expo.maxGross, 0)}.</li>
            <li><strong>Costs.</strong> Commission 0.045 % per order on every fill. Slippage, funding and market impact are not modeled. Capacity and market impact are not yet modeled.</li>
            <li><strong>In-sample for BTC.</strong> The preset was chosen on BTC data from 2017 to 2026, which contains the whole common period. ETH is a transfer across assets, not across time.</li>
            <li><strong>Venues.</strong> The data venues (Bitstamp, Binance spot) differ from the execution venue of the live bot (Hyperliquid perpetuals): prices, fees, funding and stop mechanics differ.</li>
          </ul>
          <p className="s-p">The <Link className="s-link" href="/research">research page</Link> lists the studies behind the strategy, including those that failed. The <Link className="s-link" href="/shock-engine">Shock Engine page</Link> explains how it works.</p>
        </Section>

        <Section id="downloads" title="Downloads and reproducibility" intro={<p>The full report contains every table behind this page: reconciliation with the validated backtests, risk contributions, crisis correlations, trade overlap, drawdown episodes and all {P.manifest.checksTotal} sanity checks.</p>}>
          <ul className="s-downloads">
            {P.downloads.map(d => <li key={d.file}><a href={`${DOWNLOADS}/${d.file}`} download={!d.file.endsWith('.html') || undefined}>{d.label}<code>{d.file.split('.').pop()}</code></a></li>)}
          </ul>
          <Table text head={['Reproducibility', '']} rows={[
            ['Research version', P.manifest.version],
            ['Code commit', <span key="c" className="s-mono">{P.manifest.commit}</span>],
            ['Parameter hash (SHA-256)', <span key="h" className="s-mono">{P.manifest.parametersSha256}</span>],
            ['Generated', P.manifest.generatedAt.slice(0, 10)],
          ]} />
        </Section>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
