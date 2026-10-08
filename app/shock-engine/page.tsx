import type { Metadata } from 'next'
import Link from 'next/link'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import LineChart from '../_site/LineChart'
import { Disclaimer, Section, SimBar, SimTag, SiteFooter, StatusBoxes, Table, Tiles } from '../_site/ui'
import { COLORS, P, series } from '../_site/data'
import { int, num, pct, times } from '../_site/format'

export const metadata: Metadata = {
  title: 'Shock Engine — ShadowMarketPro™',
  description: 'A systematic strategy that trades continuation after volatility shocks, with rules frozen on Bitcoin and tested unchanged on other markets. Historical simulation, not live performance.',
}

const EV = P.evidence
const CA = P.capacity
type Z = typeof EV.btc
const verdict = (ok: boolean) => (ok ? <span className="s-pass">yes</span> : <span className="s-fail">no</span>)
const status = (s: 'pass' | 'partial' | 'fail', label: string) => <span className={s === 'pass' ? 's-pass' : s === 'partial' ? 's-partial' : 's-fail'}>{label}</span>
const fixMinus = (x: string) => x.replace(/(^|\s)-(?=\d)/g, '$1−')

export default function ShockEnginePage() {
  const row = (name: string, data: string, z: Z, st: React.ReactNode) => [
    name, data, `${z.period[0].slice(0, 4)}–${z.period[1].slice(0, 4)}`, num(z.sharpe), pct(z.cagr), pct(z.dd), int(z.trades),
    verdict(z.eventsShockTrend), pct(z.randomBeaten, 0), z.meanTrade > 0 ? pct(z.delay1Share, 0) : 'n/m', st,
  ]
  const rob = (k: 'robBtc' | 'robEth') => EV[k].levels.map(l => [`${k === 'robBtc' ? 'BTC' : 'ETH'} · ±${Math.round(l.level * 100)} %`, num(l.preset), num(l.medianSharpe), `${num(l.p10)} – ${num(l.p90)}`, pct(l.rank, 0), pct(l.profitable, 0)])
  return (
    <div className="s-page">
      <SiteHeader />
      <SimBar />
      <main className="s-main">
        <div className="s-hero">
          <p className="s-eyebrow">Systematic strategy · crypto, 15-minute bars</p>
          <h1 className="s-h1">Shock Engine</h1>
          <p className="s-sub">Trades the continuation that follows a volatility shock. The rules were set on Bitcoin, then frozen and applied unchanged to other markets.</p>
          <p className="s-lead">The research question is narrow: after an abnormal 15-minute move in the direction of the hourly trend, does the market tend to keep going? On Bitcoin and Ethereum the answer has been yes, consistently enough to survive costs, placebo tests and delayed entries. On gold it was no, and the results are published as well.</p>
          <div className="s-actions">
            <Link href="/shock-engine/portfolio" className="bp"><span>BTC/ETH portfolio results</span></Link>
            <Link href="/research" className="bo">Research and evidence</Link>
          </div>
          <StatusBoxes period={`BTC ${EV.btc.period[0]} → ${EV.btc.period[1]}, ETH ${EV.eth.period[0]} → ${EV.eth.period[1]}`} />
        </div>

        <Section title="How it works" intro={<p>Four layers, computed at the close of each 15-minute bar from closed data only. The same code runs the backtest and the live bot.</p>}>
          <div className="s-grid2 s-steps">
            <div className="s-card"><h3>Detect a shock</h3><p>The bar&apos;s return is compared with the distribution of recent 15-minute returns. A move several standard deviations away from the norm is a shock; everything else is ignored.</p></div>
            <div className="s-card"><h3>Require continuation evidence</h3><p>The shock bar must break the recent range and close near its extreme with a strong body, in the direction of the 60-minute trend, on above-average volume, while short-term volatility is not already above its recent norm.</p></div>
            <div className="s-card"><h3>Adapt to the volatility regime</h3><p>Each day, the realized volatility of the last 20 closed days is compared with its own past year. A calm regime and an agitated regime each have their own parameter set. In the agitated regime the strategy only trades long.</p></div>
            <div className="s-card"><h3>Manage the position</h3><p>One position per market, sized at the sleeve&apos;s equity without leverage. Exits are volatility-scaled: a stop based on the average true range, a partial profit and a trailing stop in the agitated regime, and an exit on an opposite shock.</p></div>
          </div>
          <p className="s-small">About {num(CA.tradesPerYear.btc, 0)} (BTC) and {num(CA.tradesPerYear.eth, 0)} (ETH) trades a year, a median holding time of {num(CA.holdingHours.btc[1], 1)} and {num(CA.holdingHours.eth[1], 1)} hours, in the market {pct(CA.sleeves.btc.timeInMarket, 0)} and {pct(CA.sleeves.eth.timeInMarket, 0)} of the time. The preset, with its Pine Script code, is available in the Shock Engine tab of the <Link className="s-link" href="/backtest">Backtest Lab</Link>.</p>
        </Section>

        <Section title="One preset, several markets" intro={<p>The preset was selected on Bitcoin. Every other market runs it unchanged (&quot;zero-shot&quot;), with pass/fail criteria fixed before each test. Sharpe ratios here use 15-minute returns over each market&apos;s full test period, after a commission of 0.045 % per order.</p>}>
          <Table head={['Market', 'Data', 'Period', 'Sharpe', 'CAGR', 'Max DD', 'Trades', 'Shock → continuation', 'Random entries beaten', 'Edge kept with 1-bar delay', 'Verdict']} rows={[
            row('Bitcoin', 'BTC/USD · Bitstamp', EV.btc, status('pass', 'calibration')),
            row('Ethereum', 'ETH/USDT · Binance', EV.eth, status('pass', 'zero-shot pass')),
            row('Ethereum (replication)', 'ETH/USD · Dukascopy', EV.ethDukascopy, status('pass', 'pass')),
            row('Solana', 'SOL/USDT · Binance', EV.sol, status('partial', 'partial')),
            row('Gold', 'XAU/USD · Dukascopy', EV.gold, status('fail', 'rejected')),
            row('Bittensor (TAO)', 'TAO/USDT · Binance', EV.tao, status('fail', 'insufficient')),
          ]} />
          <p className="s-small">Random entries: 200 placebo runs with the same exits and number of trades but random entry times. Delay: share of the average trade gain kept when every entry is taken one bar late (n/m: not meaningful when the on-time gain is negative). <SimTag /></p>
        </Section>

        <Section title="Bitcoin and Ethereum together" intro={<p>The two sleeves are combined 50/50, each compounding its own capital, over their common period {P.commonPeriod.start} → {P.commonPeriod.end}.</p>}>
          <Tiles items={[
            { label: 'Portfolio Sharpe', value: num(P.headline.portfolioSharpe), sub: `BTC ${num(P.headline.btcSharpe)} · ETH ${num(P.headline.ethSharpe)}` },
            { label: 'Portfolio CAGR', value: pct(P.headline.portfolioCagr), sub: 'after modeled commissions' },
            { label: 'Portfolio max drawdown', value: pct(P.headline.portfolioMaxDD), sub: 'daily closes' },
            { label: 'Strategy correlation', value: num(P.correlation.dailyPearson), sub: `spot prices: ${num(P.correlation.underlyingDaily)}` },
          ]} />
          <LineChart title="Equity curves, log scale" start={P.chart.start} fmt="idx" log height={260} series={[
            { name: 'BTC', color: COLORS.btc, values: series(P.chart.eqBtc) },
            { name: 'ETH', color: COLORS.eth, values: series(P.chart.eqEth) },
            { name: 'Portfolio', color: COLORS.portfolio, values: series(P.chart.eqPortfolio) },
          ]} />
          <p className="s-p"><Link className="s-link" href="/shock-engine/portfolio">Full portfolio results</Link>: risk contributions, crisis behavior, bootstrap, costs and drawdowns. <SimTag /></p>
        </Section>

        <Section title="Why we think the edge is real" intro={<p>A backtest alone proves little. These tests try to break the result.</p>}>
          <ul className="s-list">
            <li><strong>Event study.</strong> Before any trading rule, the average move after shocks in the direction of the hourly trend is measured against the same hour on random days. On BTC and ETH the excess is positive at 1 and 4 hours, in both halves of the sample and in most years.</li>
            <li><strong>Random-entry placebo.</strong> Keeping the exact exits and replacing only the entry times with random ones: the strategy beats {pct(EV.btc.randomBeaten, 0)} of 200 placebos on BTC and {pct(EV.eth.randomBeaten, 0)} on ETH. The timing of entries carries the edge, not the exit rules or the market&apos;s drift.</li>
            <li><strong>Delayed entries.</strong> Entering one bar late keeps {pct(EV.btc.delay1Share, 0)} (BTC) and {pct(EV.eth.delay1Share, 0)} (ETH) of the average trade gain: the result does not hinge on a perfect fill on the signal bar.</li>
            <li><strong>Walk-forward.</strong> Re-selecting the parameters every quarter on the previous 36 months only, BTC 2020–2026 out of sample: Sharpe {EV.walkForward.sharpe}, CAGR {fixMinus(EV.walkForward.cagr)}, max drawdown {fixMinus(EV.walkForward.dd)} over {EV.walkForward.windows} windows.</li>
            <li><strong>Local robustness.</strong> All parameters perturbed together by ±5, 10 and 20 %: every neighbor stays profitable. On ETH the preset sits in the middle of its neighborhood, a plateau rather than a peak.</li>
            <li><strong>Costs.</strong> Doubling commissions (equivalent to 0.045 % slippage per fill) lowers the BTC/ETH portfolio Sharpe from {num(P.costs.stress[1].portfolio.sharpe)} to {num(P.costs.stress[2].portfolio.sharpe)}.</li>
          </ul>
          <Table caption="Local robustness: 300 jointly perturbed neighbors per level (15-minute Sharpe)" head={['Market · perturbation', 'Preset', 'Neighbor median', 'Neighbor P10 – P90', 'Preset beats', 'Neighbors profitable']} rows={[...rob('robBtc'), ...rob('robEth')]} compact />
        </Section>

        <Section title="What it is not" intro={null}>
          <ul className="s-list">
            <li><strong>Not a live track record.</strong> Every figure on this page is a historical simulation. The live bot&apos;s results will be published separately on the <Link className="s-link" href="/live">Live</Link> page.</li>
            <li><strong>Not a high hit-rate system.</strong> About {pct(1 - P.series.portfolio.trades.winRate, 0)} of trades lose a little; a few large winners carry the result. The best 5 % of trades account for more than the whole net gain.</li>
            <li><strong>Not frictionless.</strong> Turnover is high (about {times(P.series.portfolio.cost.turnoverOneWay)} the capital a year), so execution quality matters. Slippage, funding, market impact and capacity are not modeled yet.</li>
            <li><strong>Not out of sample in time for Bitcoin.</strong> The preset was chosen on BTC data that overlaps the reported period; Ethereum is a transfer across assets, not across time.</li>
          </ul>
        </Section>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
