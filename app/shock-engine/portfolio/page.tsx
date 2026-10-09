import type { Metadata } from 'next'
import Link from 'next/link'
import '../../_site/site.css'
import SiteHeader from '../../_site/SiteHeader'
import { GroupedBars, Heatmap } from '../../_site/charts'
import { CountUp, SeriesPanel, SubNav } from '../../_site/interactive'
import { Arrow, CtaBand, Disclaimer, Kpis, Metrics, Section, SimNote, SiteFooter, Table } from '../../_site/ui'
import { COLORS, DOWNLOADS, P, longestDrawdown, sample, sampleStart, series } from '../../_site/data'
import { int, month, monthKey, num, pct, spct, times } from '../../_site/format'

export const metadata: Metadata = {
  title: 'Performance — Shock Engine — ShadowMarketPro™',
  description: `Historical simulation of Shock Engine on Bitcoin and Ethereum, 50/50 portfolio, ${P.commonPeriod.start} to ${P.commonPeriod.end}, after modeled transaction costs. Not live performance.`,
}

const B = P.series.btc, E = P.series.eth, F = P.series.portfolio
const CP = P.commonPeriod
const K = P.correlation
const SP = P.stability.subPeriods
const crisis = (key: string) => P.crisis.rows.find(r => r.key === key)!
const tail = (key: string) => K.coLoss.rows.find(r => r.key === key)!
const MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const partial = (y: number) => y === P.annual[0].year || y === P.annual[P.annual.length - 1].year
const STEP = 2
const START = sampleStart(P.chart.start, P.chart.days, STEP)
const S = (xs: (number | null)[]) => sample(series(xs), STEP)
const LD = longestDrawdown()
const DD = P.drawdowns.top10.portfolio

const SECTIONS = [
  { id: 'equity', label: 'Equity' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'drawdowns', label: 'Drawdowns' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'diversification', label: 'Diversification' },
  { id: 'stress', label: 'Stress' },
  { id: 'robustness', label: 'Robustness' },
  { id: 'method', label: 'Method' },
  { id: 'downloads', label: 'Downloads' },
]

export default function PerformancePage() {
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
  const fund = P.stress.funding, slip = P.stress.slippage
  return (
    <div className="s-page">
      <SiteHeader />
      <SubNav items={SECTIONS} />
      <main className="s-main">
        <section className="s-hero s-hero-simple">
          <p className="s-eyebrow">Shock Engine · Performance</p>
          <h1 className="s-h1">Performance dashboard</h1>
          <p className="s-sub">Bitcoin and Ethereum, half of the capital each, {CP.start} → {CP.end}. Every figure on this page comes from the published research files and can be downloaded below.</p>
          <Kpis items={[
            { label: 'Sharpe ratio', value: <CountUp value={F.m.sharpe} decimals={2} />, sub: `Sortino ${num(F.m.sortino)}`, accent: true },
            { label: 'CAGR', value: <CountUp value={F.m.cagr} percent decimals={1} suffix="%" />, sub: `${CP.years.toFixed(1)} years` },
            { label: 'Max drawdown', value: <CountUp value={F.m.maxDD} percent decimals={1} suffix="%" />, sub: `${pct(F.ddIntraday)} on 15-min marks` },
            { label: 'Sharpe by half', value: `${num(SP.firstHalf.portfolio.sharpe)} · ${num(SP.secondHalf.portfolio.sharpe)}`, sub: `${SP.firstHalf.from.slice(0, 4)}–${SP.firstHalf.to.slice(0, 4)} · ${SP.secondHalf.from.slice(0, 4)}–${SP.secondHalf.to.slice(0, 4)}` },
          ]} />
          <SimNote />
        </section>

        {/* ---------------------------------------------------------------- courbe */}
        <Section id="equity" eyebrow="Equity" title="Growth of 100" intro={<p>Each market starts with half of the capital and compounds only its own half; the portfolio is the sum of the two, without rebalancing. Commission of 0.045 % on every order.</p>}>
          <div className="s-reveal">
            <SeriesPanel title="Equity, indexed to 100" sub="Log scale · daily closes" start={START} step={STEP} fmt="idx" log height={420} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.eqPortfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.eqBtc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.eqEth) },
            ]} />
          </div>
        </Section>

        {/* ---------------------------------------------------------------- métriques */}
        <Section id="metrics" eyebrow="Metrics" title="Key figures" intro={<p>Daily UTC close-to-close returns, annualized with √365.25, risk-free rate 0. BTC, ETH and the portfolio cover exactly the same {int(CP.days)} days.</p>}>
          <Metrics items={[
            { label: 'Total return', value: pct(F.m.totalReturn, 0), sub: `100 → ${int(100 + F.m.totalReturn * 100)}` },
            { label: 'Volatility', value: pct(F.m.vol), sub: 'annualized' },
            { label: 'Calmar', value: num(F.m.calmar), sub: 'CAGR / max drawdown' },
            { label: 'Trades', value: int(F.trades.trades), sub: `${int(F.trades.long)} long · ${int(F.trades.short)} short` },
            { label: 'Profit factor', value: num(F.trades.profitFactor), sub: `payoff ${num(F.trades.payoff)}` },
            { label: 'Winning trades', value: pct(F.trades.winRate, 0), sub: 'few large winners, many small losses' },
            { label: 'Time in market', value: pct(F.expo.timeInMarket, 0), sub: `average exposure ${pct(F.expo.avgGross, 0)}` },
          ]} />
          <div className="s-gap" />
          <Table stack head={['', 'BTC', 'ETH', 'Portfolio 50/50']} rows={perf.map(([l, f]) => [l, f(B), f(E), <strong key="p">{f(F)}</strong>])} />
          <p className="s-small">Portfolio trades are the {int(F.trades.trades)} trades of both markets pooled; the payoff ratio uses their contribution to portfolio equity. The first and last years are partial ({P.annual[0].from} → {P.annual[0].to} and {P.annual[P.annual.length - 1].from} → {P.annual[P.annual.length - 1].to}).</p>
        </Section>

        {/* ---------------------------------------------------------------- drawdowns */}
        <Section id="drawdowns" eyebrow="Risk" title="Drawdowns" intro={<p>Depth, duration and recovery of every fall from a previous peak, on daily closes.</p>}>
          <div className="s-reveal">
            <SeriesPanel title="Drawdown from the previous peak" sub="Underwater curve · daily closes" start={START} step={STEP} fmt="pct" yMax={0} area height={300} defaultKey="Portfolio" endLabels={false} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.ddPortfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.ddBtc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.ddEth) },
            ]} />
          </div>
          <Metrics items={[
            { label: 'Max drawdown', value: pct(DD[0].depth), sub: `${DD[0].start} → ${DD[0].recovery ?? 'not recovered'}` },
            { label: 'Longest drawdown', value: `${int(LD.days)} days`, sub: `${LD.start} → ${LD.recovery ?? 'not recovered'}` },
            { label: 'Worst month', value: pct(F.m.worstMonth.ret), sub: month(monthKey(F.m.worstMonth.key)) },
            { label: 'Worst year', value: spct(F.m.worstYear.ret), sub: String(F.m.worstYear.key) },
          ]} />
          <h3 className="s-h3 s-mt">Five deepest drawdowns of the portfolio</h3>
          <Table stack head={['Start', 'Trough', 'Recovered', 'Depth', 'Duration', 'BTC / ETH at the time']} rows={DD.slice(0, 5).map(d => [d.start, d.trough, d.recovery ?? 'not recovered', pct(d.depth), `${int(d.days)} days`, `${pct(d.others.BTC)} / ${pct(d.others.ETH)}`])} />
          <div className="s-gap" />
          <div className="s-reveal">
            <SeriesPanel title="Rolling 12-month Sharpe ratio" sub="365-day windows of daily returns" start={START} step={STEP} fmt="num" height={260} defaultKey="Portfolio" endLabels={false} refs={[{ y: 0 }, { y: 1, label: 'Sharpe 1' }]} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.sharpe365.portfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.sharpe365.btc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.sharpe365.eth) },
            ]} />
          </div>
          <p className="s-small">Portfolio: {pct(P.stability.rolling12.portfolio.positive, 0)} of 12-month windows positive, {pct(P.stability.rolling12.portfolio.aboveOne, 0)} above 1, lowest {num(P.stability.rolling12.portfolio.min)}, median {num(P.stability.rolling12.portfolio.median)}.</p>
        </Section>

        {/* ---------------------------------------------------------------- calendrier */}
        <Section id="calendar" eyebrow="Calendar" title="Years and months">
          <div className="s-panel s-reveal">
            <div className="s-panel-head"><div><h3 className="s-panel-t">Annual returns</h3><p className="s-panel-s">*partial years</p></div></div>
            <GroupedBars title="Annual returns" cats={P.annual.map(a => `${a.year}${partial(a.year) ? '*' : ''}`)} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: P.annual.map(a => a.portfolio) },
              { name: 'BTC', color: COLORS.btc, values: P.annual.map(a => a.btc) },
              { name: 'ETH', color: COLORS.eth, values: P.annual.map(a => a.eth) },
            ]} />
          </div>
          <div className="s-gap" />
          <div className="s-panel s-reveal">
            <div className="s-panel-head"><div><h3 className="s-panel-t">Portfolio monthly returns (%)</h3><p className="s-panel-s">Green: gain · red: loss · color steps of 4 %, capped at 20 %</p></div></div>
            <Heatmap title="Monthly returns of the 50/50 portfolio" rows={years} cols={[...MN, 'Year']} values={heat} cap={0.2} />
          </div>
          <div className="s-gap" />
          <Table stack head={['Year', 'BTC', 'ETH', 'Portfolio', 'Portfolio Sharpe', 'Portfolio max DD']}
            rows={P.annual.map(a => [`${a.year}${partial(a.year) ? '*' : ''}`, spct(a.btc), spct(a.eth), <strong key="p">{spct(a.portfolio)}</strong>, num(a.portfolioSharpe), pct(a.portfolioDD)])} />
        </Section>

        {/* ---------------------------------------------------------------- diversification */}
        <Section id="diversification" eyebrow="Portfolio" title="Diversification" intro={<p>Bitcoin and Ethereum prices are correlated at {num(K.underlyingDaily)}. The two strategies only at {num(K.dailyPearson)}: each is out of the market most of the time, and on most active days only one of them moves.</p>}>
          <div className="s-grid2">
            <Table head={['Measure', 'Value']} rows={[
              ['Sharpe: portfolio / better market', `${num(D.sharpeVsBest, 3)} (${spct(D.sharpeVsBest - 1)})`],
              ['Volatility: portfolio / weighted markets', `${num(D.volVsWeighted, 3)} (${spct(D.volVsWeighted - 1)})`],
              ['Max drawdown: portfolio vs BTC, ETH', `${pct(F.m.maxDD)} vs ${pct(B.m.maxDD)}, ${pct(E.m.maxDD)}`],
              ['Diversification ratio', num(D.dr)],
              ['Effective independent bets', `${num(D.enbDR2)} of 2`],
              ['Share of risk at 50/50: BTC / ETH', `${pct(R.pct[0], 0)} / ${pct(R.pct[1], 0)}`],
            ]} />
            <Table head={['Correlation of strategy returns', 'Value']} rows={[
              ['Daily, Pearson', num(K.dailyPearson)],
              ['Daily, Spearman', num(K.dailySpearman)],
              ['Weekly', num(K.weekly)],
              ['Monthly', num(K.monthly)],
              ['Days when both were exposed', num(K.bothInPosition.pearson)],
              ['Rolling 90 days: median (P10 to P90)', `${num(K.rolling['90'].median)} (${num(K.rolling['90'].p10)} to ${num(K.rolling['90'].p90)})`],
            ]} />
          </div>
          <div className="s-gap" />
          <div className="s-reveal">
            <SeriesPanel title="Rolling 90-day correlation" sub="BTC vs ETH strategy returns" start={START} step={STEP} fmt="num" yMin={-0.4} yMax={1} height={240} endLabels={false}
              refs={[{ y: K.dailyPearson, label: `full period ${num(K.dailyPearson)}` }, { y: 0 }]}
              series={[{ name: '90-day correlation', color: 'var(--s-ink2)', values: S(P.chart.corr90) }]} />
          </div>
          <p className="s-p">50/50 in capital is not 50/50 in risk: ETH is the more volatile market ({pct(R.sigma[1], 0)} against {pct(R.sigma[0], 0)} a year) and carries {pct(R.pct[1], 0)} of the variance. Without rebalancing the weights drift; BTC averaged {pct(P.weights.A.mean, 0)} of the portfolio and ended at {pct(P.weights.A.end, 0)}.</p>
        </Section>

        {/* ---------------------------------------------------------------- stress */}
        <Section id="stress" eyebrow="Stress" title="Behavior in market stress" intro={<p>Stress is defined from spot prices only, never from strategy results. A constant-dependence benchmark (same daily returns, Gaussian copula fitted to the full-period correlation) shows what a selection of days would produce without contagion.</p>}>
          <Table stack head={['Episode', 'Window', 'BTC spot', 'ETH spot', 'Portfolio']} rows={P.crisis.episodes.map(e => [e.name, `${e.from} → ${e.to}`, spct(e.spotBtc), spct(e.spotEth), <strong key="p" className={e.portfolio >= 0 ? 's-pass' : 's-fail'}>{spct(e.portfolio)}</strong>])} />
          <p className="s-small">Episode windows were fixed from known market events. The portfolio was positive in {P.crisis.episodes.filter(e => e.portfolio > 0).length} of {P.crisis.episodes.length}.</p>
          <div className="s-gap" />
          <Table stack head={['Days used', 'Days', 'Correlation', 'Benchmark']} rows={[
            ['All days', int(crisis('all').days), num(crisis('all').pearson), '—'],
            ['Non-stress days', int(crisis('calm').days), num(crisis('calm').pearson), '—'],
            ['Market crash days (worst 5 % of BTC+ETH spot)', int(crisis('mktCrash').days), num(crisis('mktCrash').pearson), '—'],
            ['Crypto bear market (spot > 30 % below 1-year high)', int(crisis('mktBear').days), num(crisis('mktBear').pearson), '—'],
            ['Named stress episodes', int(crisis('episodes').days), num(crisis('episodes').pearson), '—'],
            ['Both markets lost on the day', int(crisis('bothNeg').days), num(crisis('bothNeg').pearson), `${num(crisis('bothNeg').nullMean)} [${num(crisis('bothNeg').nullP5)}, ${num(crisis('bothNeg').nullP95)}]`],
            ['P(ETH loses | BTC loses)', '—', pct(tail('coNeg').observed, 0), `${pct(tail('coNeg').mean, 0)} [${pct(tail('coNeg').p5, 0)}, ${pct(tail('coNeg').p95, 0)}]`],
          ]} />
          <p className="s-p">Correlation does not jump in market stress, and joint losses are not more frequent than constant dependence implies. On days when both markets lose, the size of their losses is more aligned, consistent with some trades being the same shock traded on both markets ({pct(P.overlap.entries[0].ethWithBtc, 0)} of ETH entries are within 15 minutes of a same-direction BTC entry).</p>
        </Section>

        {/* ---------------------------------------------------------------- robustesse */}
        <Section id="robustness" eyebrow="Robustness" title="How fragile are these numbers?">
          <div className="s-grid2">
            <div>
              <h3 className="s-h3">Resampled histories</h3>
              <p className="s-p">{int(BT.replications)} histories built from {BT.blocks} calendar months drawn at random, the same months for BTC and ETH.</p>
              <Table stack head={['Statistic', 'Historical', '90 % interval']} rows={[
                ['Portfolio Sharpe', num(F.m.sharpe), `${num(BT.sharpe.p5)} to ${num(BT.sharpe.p95)}`],
                ['Portfolio CAGR', pct(F.m.cagr), `${pct(BT.cagr.p5)} to ${pct(BT.cagr.p95)}`],
                ['Portfolio max drawdown', pct(F.m.maxDD), `${pct(BT.maxDD.p5)} to ${pct(BT.maxDD.p95)}`],
              ]} />
              <p className="s-small">P(Sharpe &gt; 1) {pct(BT.pSharpeGt1, 1)}. A bootstrap resamples history; it is not a forecast.</p>
            </div>
            <div>
              <h3 className="s-h3">Sub-periods</h3>
              <p className="s-p">The second half is weaker than the first, and the two markets are more correlated in it.</p>
              <Table stack head={['Period', 'Sharpe', 'CAGR', 'Correlation']} rows={[
                [`${SP.firstHalf.from} → ${SP.firstHalf.to}`, num(SP.firstHalf.portfolio.sharpe), pct(SP.firstHalf.portfolio.cagr), num(SP.firstHalf.corr)],
                [`${SP.secondHalf.from} → ${SP.secondHalf.to}`, num(SP.secondHalf.portfolio.sharpe), pct(SP.secondHalf.portfolio.cagr), num(SP.secondHalf.corr)],
              ]} />
            </div>
          </div>
          <h3 className="s-h3 s-mt" id="costs">Costs, slippage and funding</h3>
          <div className="s-grid2">
            <Table stack head={['Commission per order', 'Sharpe', 'CAGR', 'Max DD']}
              rows={P.costs.stress.map(c => [`${c.commissionPct.toFixed(3)} % (×${c.k})`, num(c.portfolio.sharpe), pct(c.portfolio.cagr), pct(c.portfolio.maxDD)])} />
            <Table stack head={['Added cost (not in headline figures)', 'Sharpe', 'CAGR']} rows={[
              ...slip.filter(s => s.slippagePctPerOrder > 0).map(s => [`Slippage ${s.slippagePctPerOrder.toFixed(2)} % per order`, num(s.sharpe), '—']),
              ...fund.map(f => [`Funding: ${f.scenario}`, num(f.sharpe), pct(f.cagr)]),
            ]} />
          </div>
          <p className="s-small">Turnover is about {times(F.cost.turnoverOneWay)} the capital a year (entries only), so commissions take about {pct(P.costs.cagrDrag.portfolio, 0)} of CAGR. Funding uses the historical rates of the perpetual market, with the correct sign for long and short positions.</p>
          <h3 className="s-h3 s-mt">Concentration</h3>
          <p className="s-p">The result depends on the right tail: the best 5 % of trades account for {pct(P.concentration.tradesPortfolio.top5, 0)} of the portfolio&apos;s log growth, and without them the CAGR would be {pct(P.concentration.tradesPortfolio.cagrWithoutTop5)}. This is the profile of a trend-following engine: many small losses, few large gains.</p>
          <h3 className="s-h3 s-mt">Rebalancing</h3>
          <p className="s-p">The portfolio has no rebalancing; this was decided before any result. As a diagnostic only, monthly rebalancing to 50/50 gave a Sharpe of {num(P.variants.B.m.sharpe)} (against {num(P.variants.A.m.sharpe)}). It is recorded as a hypothesis for forward testing, not adopted.</p>
        </Section>

        {/* ---------------------------------------------------------------- méthode */}
        <Section id="method" eyebrow="Method" title="Method and limitations">
          <ul className="s-list">
            <li><strong>Fixed rules.</strong> One 15-minute strategy with adaptive volatility, selected on Bitcoin. Ethereum runs it unchanged, without any ETH calibration. The portfolio reproduces the validated backtests exactly before any calculation; {P.manifest.checksPassed} of {P.manifest.checksTotal} consistency checks pass.</li>
            <li><strong>Short entries.</strong> {P.disclaimers[2]}</li>
            <li><strong>Data.</strong> {P.manifest.datasets.btc}; {P.manifest.datasets.eth}; 15-minute bars, UTC.</li>
            <li><strong>Capital.</strong> 50/50 at the start; each half trades 100 % of its own equity, one position at a time, without leverage. Average gross exposure {pct(F.expo.avgGross, 0)} of the portfolio, maximum {pct(F.expo.maxGross, 0)}.</li>
            <li><strong>Costs.</strong> Commission 0.045 % per order on every fill. {P.disclaimers[3]} {P.disclaimers[4]}</li>
            <li><strong>In-sample for BTC.</strong> The rules were chosen on BTC data from 2017 to 2026, which contains the whole period. ETH is a transfer across markets, not across time.</li>
            <li><strong>Venues.</strong> The data venues (Bitstamp, Binance spot) differ from a perpetual-futures execution venue: prices, fees, funding and stop mechanics differ.</li>
          </ul>
          <p className="s-p">The <Link className="s-link" href="/research">research page</Link> lists the studies behind the strategy, including those that failed.</p>
        </Section>

        {/* ---------------------------------------------------------------- téléchargements */}
        <Section id="downloads" eyebrow="Reproducibility" title="Downloads" intro={<p>The full report contains every table behind this page: reconciliation with the validated backtests, risk contributions, crisis correlations, trade overlap, drawdown episodes and all {P.manifest.checksTotal} consistency checks.</p>}>
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

        <CtaBand title="How the numbers were tested" actions={<>
          <Link href="/research" className="s-btn s-btn-primary">View Research <Arrow /></Link>
          <Link href="/shock-engine" className="s-btn s-btn-ghost">How Shock Engine works</Link>
        </>}>Placebo entries, delayed entries, parameter neighborhoods, cost stress, and the markets where the rules failed.</CtaBand>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
