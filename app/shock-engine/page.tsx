import type { Metadata } from 'next'
import Link from 'next/link'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import HeroChart from '../_site/HeroChart'
import { CountUp, SeriesPanel, SubNav } from '../_site/interactive'
import { Arrow, CtaBand, Disclaimer, EvidenceCard, Kpis, Metrics, Section, SimNote, SiteFooter, StatusList, Table } from '../_site/ui'
import { COLORS, DOWNLOADS, P, SIM, longestDrawdown, sample, sampleStart, series, verdictOf } from '../_site/data'
import { int, month, num, pct } from '../_site/format'

export const metadata: Metadata = {
  title: 'Shock Engine — ShadowMarketPro™',
  description: 'A systematic 15-minute strategy that trades the continuation after abnormal moves on Bitcoin and Ethereum, with short positions only in bearish daily trends. Historical simulation after modeled transaction costs, not live performance.',
}

const EV = P.evidence
const F = P.series.portfolio
const CP = P.commonPeriod
const STEP = 2
const N = P.chart.days
const START = sampleStart(P.chart.start, N, STEP)
const S = (xs: (number | null)[]) => sample(series(xs), STEP)
const rob20 = (k: 'robBtc' | 'robEth') => EV[k].levels.find(l => l.level === 0.2)!
const fails = (['sol', 'gold', 'tao'] as const).filter(k => verdictOf(EV[k]).kind === 'fail')
const names = { sol: 'Solana', gold: 'Gold', tao: 'TAO' }
const LD = longestDrawdown()
const fund = P.stress.funding[0]

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'performance', label: 'Performance' },
  { id: 'method', label: 'Method' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'risk', label: 'Risk' },
  { id: 'research-status', label: 'Research' },
]

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>

export default function ShockEnginePage() {
  return (
    <div className="s-page">
      <SiteHeader />
      <SubNav items={SECTIONS} />
      <main className="s-main">
        {/* ---------------------------------------------------------------- héros */}
        <section className="s-hero s-anchor" id="overview">
          <div className="s-hero-grid">
            <div className="s-hero-copy">
              <p className="s-eyebrow">Systematic strategy · crypto</p>
              <h1 className="s-h1">Shock Engine</h1>
              <p className="s-sub">Systematic post-shock continuation for Bitcoin and Ethereum: it enters after an abnormal move that keeps its direction, and manages risk with volatility.</p>
              <div className="s-chips">
                <span className="s-chip"><span className="s-chip-dot" /><b>BTC / ETH</b></span>
                <span className="s-chip">15-minute systematic strategy</span>
                <span className="s-chip"><span className="s-chip-dot" style={{ background: 'var(--s-amber)' }} />Historical simulation</span>
              </div>
              <div className="s-actions">
                <Link href="/shock-engine/portfolio" className="s-btn s-btn-primary">Explore Performance <Arrow /></Link>
                <Link href="/research" className="s-btn s-btn-ghost">View Research</Link>
              </div>
            </div>
            <HeroChart />
          </div>
          <Kpis items={[
            { label: 'Sharpe ratio', value: <CountUp value={F.m.sharpe} decimals={2} />, sub: `BTC ${num(P.headline.btcSharpe)} · ETH ${num(P.headline.ethSharpe)}`, accent: true },
            { label: 'CAGR', value: <CountUp value={F.m.cagr} percent decimals={1} suffix="%" />, sub: `${CP.years.toFixed(1)} years · 50/50 portfolio` },
            { label: 'Max drawdown', value: <CountUp value={F.m.maxDD} percent decimals={1} suffix="%" />, sub: 'daily closes' },
            { label: 'Markets', value: 'BTC + ETH', sub: `${CP.start.slice(0, 4)} → ${CP.end.slice(0, 4)}` },
          ]} />
          <SimNote />
        </section>

        {/* ---------------------------------------------------------------- performance */}
        <Section id="performance" eyebrow="Performance" title="Two markets, one engine" intro={<p>Half of the capital in each market, each half compounding on its own, from {CP.start} to {CP.end}. Commission of 0.045 % on every order.</p>}
          head={<Link className="s-arrow" href="/shock-engine/portfolio">Full performance dashboard</Link>}>
          <div className="s-reveal">
            <SeriesPanel title="Equity, indexed to 100" sub="Log scale · daily closes" start={START} step={STEP} fmt="idx" log height={360} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.eqPortfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.eqBtc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.eqEth) },
            ]} />
          </div>
          <Metrics items={[
            { label: 'Sharpe', value: num(F.m.sharpe), sub: `Sortino ${num(F.m.sortino)}` },
            { label: 'CAGR', value: pct(F.m.cagr), sub: 'after commissions' },
            { label: 'Max drawdown', value: pct(F.m.maxDD), sub: `Calmar ${num(F.m.calmar)}` },
            { label: 'Volatility', value: pct(F.m.vol), sub: 'annualized' },
            { label: 'Trades', value: int(F.trades.trades), sub: `${int(P.headline.trades.btc)} BTC · ${int(P.headline.trades.eth)} ETH` },
            { label: 'Profit factor', value: num(F.trades.profitFactor), sub: `win rate ${pct(F.trades.winRate, 0)}` },
          ]} />
        </Section>

        {/* ---------------------------------------------------------------- méthode */}
        <Section id="method" eyebrow="How it works" title="Four steps, computed at every 15-minute close" intro={<p>Closed bars only, no look-ahead. The rules were set on Bitcoin and run unchanged on Ethereum.</p>}>
          <div className="s-pipe">
            {[
              { n: '01', t: 'Shock', p: 'Detects an abnormal directional move: a 15-minute return far outside its recent distribution, breaking the recent range.', d: 'M3 17l5-5 4 4 8-9' },
              { n: '02', t: 'Trend', p: 'Confirms that the move is aligned with the higher-timeframe structure, with a decisive candle and active volume.', d: 'M4 19h16M7 15l3-4 3 2 4-6' },
              { n: '03', t: 'Regime', p: 'Short positions are only enabled when the daily trend regime is bearish. Long and short parameter sets also adapt to calm or agitated volatility.', d: 'M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5' },
              { n: '04', t: 'Risk', p: 'One position per market, no leverage. Stops and exits scale with volatility; an opposite shock closes the trade.', d: 'M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z' },
            ].map(s => (
              <div className="s-pipe-step s-reveal" key={s.n}>
                <div className="s-card s-card-hover">
                  <div className="s-pipe-n">{s.n}</div>
                  <div className="s-pipe-ico"><Icon d={s.d} /></div>
                  <h3>{s.t}</h3>
                  <p>{s.p}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="s-small">Proprietary thresholds are not published. The engine trades about {num(P.capacity.tradesPerYear.btc, 0)} times a year on BTC and {num(P.capacity.tradesPerYear.eth, 0)} on ETH, with a median holding time of {num(P.capacity.holdingHours.pooled[1], 0)} hours, and is in the market {pct(F.expo.timeInMarket, 0)} of the time.</p>
        </Section>

        {/* ---------------------------------------------------------------- preuves */}
        <Section id="evidence" eyebrow="Research evidence" title="We tried to break it" intro={<p>Each test has a pass/fail criterion fixed before the result is seen. Single-market figures use 15-minute returns over each market&apos;s full test period.</p>}
          head={<Link className="s-arrow" href="/research">All studies and verdicts</Link>}>
          <div className="s-grid3">
            <EvidenceCard k="ETH transfer" stat={num(EV.eth.sharpe)} sub="Sharpe" verdict={verdictOf(EV.eth)} href="/research#studies">
              The Bitcoin parameters, applied to Ethereum without any ETH calibration, met every pre-set criterion; an independent ETH price feed gives the same verdict (Sharpe {num(EV.ethDukascopy.sharpe)}).
            </EvidenceCard>
            <EvidenceCard k="Random entry test" stat={`${pct(EV.btc.randomBeaten, 0)} · ${pct(EV.eth.randomBeaten, 0)}`} sub="BTC · ETH" href="/research#studies">
              Share of 200 runs with identical exits and random entry times that the strategy beats. The timing of entries carries the edge, not the exits or the market&apos;s drift.
            </EvidenceCard>
            <EvidenceCard k="Delayed entry" stat={`${pct(EV.btc.delay1Share, 0)} · ${pct(EV.eth.delay1Share, 0)}`} sub="BTC · ETH" href="/research#studies">
              Share of the average trade gain kept when every entry is taken one 15-minute bar late. The result does not depend on a perfect fill.
            </EvidenceCard>
            <EvidenceCard k="Cost stress" stat={num(P.costs.stress[2].portfolio.sharpe)} sub="Sharpe at 2× commissions" href="/shock-engine/portfolio#costs">
              Doubling commissions (equivalent to 0.045 % slippage per fill) keeps the portfolio Sharpe at {num(P.costs.stress[2].portfolio.sharpe)}; with historical perpetual funding it is {num(fund.sharpe)}.
            </EvidenceCard>
            <EvidenceCard k="Parameter robustness" stat={pct(Math.min(rob20('robBtc').profitable, rob20('robEth').profitable), 0)} sub="neighbors profitable" href="/research#studies">
              All parameters perturbed together by up to ±20 %, 300 neighbors per level: median Sharpe {num(rob20('robBtc').medianSharpe)} on BTC and {num(rob20('robEth').medianSharpe)} on ETH. On ETH the parameters sit mid-neighborhood, a plateau rather than a peak.
            </EvidenceCard>
            <EvidenceCard k="Negative controls" stat={`${fails.length} of 3`} sub="did not pass" verdict={{ kind: 'fail', label: 'published' }} href="/research#studies">
              The same rules on {fails.map(k => names[k]).join(', ')} did not meet the pre-set criteria. Failures are published next to the successes.
            </EvidenceCard>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- risque */}
        <Section id="risk" eyebrow="Risk" title="Drawdowns, stress and stability" intro={<p>The same weight as the returns: how deep, how long, and how stable the results have been.</p>}>
          <div className="s-split">
            <div className="s-reveal">
              <SeriesPanel title="Drawdown from the previous peak" sub="Daily closes" start={START} step={STEP} fmt="pct" yMax={0} area height={280} defaultKey="Portfolio" endLabels={false} series={[
                { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.ddPortfolio) },
                { name: 'BTC', color: COLORS.btc, values: S(P.chart.ddBtc) },
                { name: 'ETH', color: COLORS.eth, values: S(P.chart.ddEth) },
              ]} />
            </div>
            <div className="s-metrics s-reveal" style={{ alignContent: 'start', margin: 0 }}>
              <div className="s-metric"><div className="s-metric-l">Max drawdown</div><div className="s-metric-v">{pct(F.m.maxDD)}</div><div className="s-metric-s">{P.drawdowns.top10.portfolio[0].start} → {P.drawdowns.top10.portfolio[0].recovery ?? 'not recovered'}</div></div>
              <div className="s-metric"><div className="s-metric-l">Longest drawdown</div><div className="s-metric-v">{int(LD.days)} days</div><div className="s-metric-s">from {LD.start}{LD.recovery ? '' : ', not recovered'}</div></div>
              <div className="s-metric"><div className="s-metric-l">Worst month</div><div className="s-metric-v">{pct(F.m.worstMonth.ret)}</div><div className="s-metric-s">{month(P.headline.worstMonth.month)}</div></div>
              <div className="s-metric"><div className="s-metric-l">Positive 12-month windows</div><div className="s-metric-v">{pct(P.stability.rolling12.portfolio.positive, 0)}</div><div className="s-metric-s">{pct(P.stability.rolling12.portfolio.aboveOne, 0)} with Sharpe above 1</div></div>
            </div>
          </div>
          <div className="s-gap" />
          <div className="s-reveal">
            <SeriesPanel title="Rolling 12-month Sharpe ratio" sub="365-day windows of daily returns" start={START} step={STEP} fmt="num" height={240} defaultKey="Portfolio" endLabels={false} refs={[{ y: 0 }, { y: 1, label: 'Sharpe 1' }]} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.sharpe365.portfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.sharpe365.btc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.sharpe365.eth) },
            ]} />
          </div>
          <h3 className="s-h3 s-mt">Named market stress episodes</h3>
          <Table stack head={['Episode', 'Dates', 'Portfolio', 'BTC spot', 'ETH spot']} rows={P.crisis.episodes.map(e => [e.name, `${e.from} → ${e.to}`, <span key="p" className={e.portfolio >= 0 ? 's-pass' : 's-fail'}>{pct(e.portfolio)}</span>, pct(e.spotBtc), pct(e.spotEth)])} />
          <p className="s-small">Episode windows were fixed from known market events, never from strategy results.</p>
        </Section>

        {/* ---------------------------------------------------------------- diversification */}
        <Section id="diversification" eyebrow="Portfolio" title="Why BTC and ETH together" intro={<p>The two coins move together. The two strategies much less: each is out of the market most of the time, and their trades rarely overlap.</p>}>
          <div className="s-split">
            <div className="s-card s-reveal">
              <div className="s-bars">
                {[
                  { l: 'BTC vs ETH prices, daily', v: P.correlation.underlyingDaily, c: 'var(--s-muted)' },
                  { l: 'BTC vs ETH strategy returns', v: P.correlation.dailyPearson, c: 'var(--s-accent)' },
                ].map(b => (
                  <div className="s-bar-row" key={b.l}>
                    <span className="s-bar-l">{b.l}</span>
                    <span className="s-bar-track"><span className="s-bar-fill" style={{ width: `${Math.max(0, b.v) * 100}%`, display: 'block', background: b.c }} /></span>
                    <span className="s-bar-v">{num(b.v)}</span>
                  </div>
                ))}
              </div>
              <p className="s-small">Daily correlation, {CP.start} → {CP.end}.</p>
            </div>
            <div className="s-metrics s-reveal" style={{ alignContent: 'start', margin: 0 }}>
              <div className="s-metric"><div className="s-metric-l">Portfolio Sharpe</div><div className="s-metric-v">{num(F.m.sharpe)}</div><div className="s-metric-s">BTC {num(P.headline.btcSharpe)} · ETH {num(P.headline.ethSharpe)}</div></div>
              <div className="s-metric"><div className="s-metric-l">Max drawdown</div><div className="s-metric-v">{pct(F.m.maxDD)}</div><div className="s-metric-s">BTC {pct(P.series.btc.m.maxDD)} · ETH {pct(P.series.eth.m.maxDD)}</div></div>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- statut */}
        <Section id="research-status" eyebrow="Research status" title="What is established, and what is not yet" intro={<p>Stated plainly, so it can be weighed.</p>}>
          <StatusList items={[
            { label: 'Historical simulation', state: 'ok', note: `${CP.start} → ${CP.end}, reproduced from versioned code (${P.manifest.checksPassed}/${P.manifest.checksTotal} checks)` },
            { label: 'Modeled transaction costs', state: 'ok', note: 'commission 0.045 % per order; cost stress published' },
            { label: 'BTC / ETH evidence', state: 'ok', note: 'event study, placebo entries, delayed entries, two ETH data sources' },
            { label: 'Robustness testing', state: 'ok', note: 'parameter neighborhoods, cost stress, resampled histories' },
            { label: 'Forward validation', state: 'wait', note: `pre-registered; observation starts ${P.forward.start}` },
            { label: 'Live track record', state: 'no', note: 'not available' },
            { label: 'Capacity / market impact', state: 'no', note: 'not yet modeled' },
          ]} />
          <p className="s-small">The daily-trend condition on short entries was specified in October 2026, after this historical period had been studied: the figures above are in-sample for it, which is why a forward validation has been pre-registered. Slippage and perpetual funding are not in the headline figures.</p>
        </Section>

        <CtaBand title="Explore the research" actions={<>
          <Link href="/research" className="s-btn s-btn-primary">View Research <Arrow /></Link>
          <a href={`${DOWNLOADS}/btc-eth-portfolio.html`} className="s-btn s-btn-ghost">Download Research Report</a>
          <Link href="/institutional" className="s-btn s-btn-ghost">Institutional Access</Link>
        </>}>{SIM}</CtaBand>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
