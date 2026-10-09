import Link from 'next/link'
import './_site/site.css'
import SiteHeader from './_site/SiteHeader'
import HeroChart from './_site/HeroChart'
import { CountUp, SeriesPanel } from './_site/interactive'
import { Arrow, CtaBand, Disclaimer, EvidenceCard, Kpis, Section, SimNote, SiteFooter, StatusList } from './_site/ui'
import { COLORS, DOWNLOADS, P, SIM, sample, sampleStart, series, verdictOf } from './_site/data'
import { int, num, pct } from './_site/format'

const STEP = 3
const EV = P.evidence
const F = P.series.portfolio
const CP = P.commonPeriod
const START = sampleStart(P.chart.start, P.chart.days, STEP)
const S = (xs: (number | null)[]) => sample(series(xs), STEP)

export default function HomePage() {
  return (
    <div className="s-page">
      <SiteHeader />
      <main className="s-main">
        {/* ---------------------------------------------------------------- héros */}
        <section className="s-hero">
          <div className="s-hero-grid">
            <div className="s-hero-copy">
              <p className="s-eyebrow">Systematic crypto research</p>
              <h1 className="s-h1">Shock Engine</h1>
              <p className="s-sub">A systematic strategy that trades the continuation after abnormal moves on Bitcoin and Ethereum. Fixed rules, tested to be broken, published with their failures.</p>
              <div className="s-chips">
                <span className="s-chip"><span className="s-chip-dot" /><b>BTC / ETH</b></span>
                <span className="s-chip">15-minute bars</span>
                <span className="s-chip"><span className="s-chip-dot" style={{ background: 'var(--s-amber)' }} />Historical simulation</span>
              </div>
              <div className="s-actions">
                <Link href="/shock-engine" className="s-btn s-btn-primary">Discover Shock Engine <Arrow /></Link>
                <Link href="/shock-engine/portfolio" className="s-btn s-btn-ghost">Explore Performance</Link>
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

        {/* ---------------------------------------------------------------- deux univers */}
        <Section id="products" eyebrow="ShadowMarketPro" title="Research and tools, kept apart" intro={<p>The systematic strategy and the TradingView indicators are separate products. The research figures concern Shock Engine only.</p>}>
          <div className="s-worlds">
            <Link href="/shock-engine" className="s-world s-world-research s-reveal">
              <p className="s-eyebrow">Systematic strategy</p>
              <h3>Shock Engine</h3>
              <p>One rule set for Bitcoin and Ethereum, simulated over {CP.years.toFixed(0)} years after modeled costs.</p>
              <ul>
                <li>Performance dashboard with downloadable data</li>
                <li>Placebo, delayed-entry, cost and parameter tests</li>
                <li>Pre-registered forward validation</li>
              </ul>
              <span className="s-arrow">Discover Shock Engine</span>
            </Link>
            <Link href="/trading-tools" className="s-world s-world-tools s-reveal">
              <p className="s-eyebrow" style={{ color: 'var(--s-ink2)' }}>Decision support</p>
              <h3>Trading Tools</h3>
              <p>Quantitative indicators for TradingView, by subscription: regime, compression, momentum, traps.</p>
              <ul>
                <li>Eight indicators, one subscription</li>
                <li>Alerts and a tutorial for each tool</li>
                <li>Crypto, forex, indices, stocks</li>
              </ul>
              <span className="s-arrow" style={{ color: 'var(--s-ink)' }}>See the indicators</span>
            </Link>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- performance */}
        <Section id="performance" eyebrow="Performance" title="Two markets, one engine" intro={<p>Half of the capital in each market, {CP.start} → {CP.end}. Their strategy returns correlate at {num(P.correlation.dailyPearson)}, against {num(P.correlation.underlyingDaily)} for the two coins&apos; prices.</p>}
          head={<Link className="s-arrow" href="/shock-engine/portfolio">Performance dashboard</Link>}>
          <div className="s-reveal">
            <SeriesPanel title="Equity, indexed to 100" sub="Log scale · daily closes" start={START} step={STEP} fmt="idx" log height={320} series={[
              { name: 'Portfolio', color: COLORS.portfolio, values: S(P.chart.eqPortfolio) },
              { name: 'BTC', color: COLORS.btc, values: S(P.chart.eqBtc) },
              { name: 'ETH', color: COLORS.eth, values: S(P.chart.eqEth) },
            ]} />
          </div>
          <SimNote>{SIM} Commission 0.045 % per order; slippage and funding are not in these figures.</SimNote>
        </Section>

        {/* ---------------------------------------------------------------- preuves */}
        <Section id="evidence" eyebrow="Research evidence" title="Built to be falsified" intro={<p>Every test has a pass/fail criterion fixed before the result is seen. Failures are published next to the successes.</p>}
          head={<Link className="s-arrow" href="/research">All studies</Link>}>
          <div className="s-grid3">
            <EvidenceCard k="ETH transfer" stat={num(EV.eth.sharpe)} sub="Sharpe" verdict={verdictOf(EV.eth)} href="/research#studies">
              Bitcoin parameters applied to Ethereum without any ETH calibration met every pre-set criterion.
            </EvidenceCard>
            <EvidenceCard k="Random entry test" stat={`${pct(EV.btc.randomBeaten, 0)} · ${pct(EV.eth.randomBeaten, 0)}`} sub="BTC · ETH" href="/research#studies">
              Share of 200 random-entry runs with the same exits that the strategy beats: the edge is in the timing of entries.
            </EvidenceCard>
            <EvidenceCard k="Cost stress" stat={num(P.costs.stress[2].portfolio.sharpe)} sub="Sharpe at 2× costs" href="/shock-engine/portfolio#costs">
              Doubling commissions, equivalent to 0.045 % slippage on every fill, keeps the portfolio Sharpe above {num(Math.floor(P.costs.stress[2].portfolio.sharpe * 10) / 10, 1)}.
            </EvidenceCard>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- statut */}
        <Section id="status" eyebrow="Research status" title="Where the research stands">
          <div className="s-split">
            <StatusList items={[
              { label: 'Historical simulation', state: 'ok', note: `${CP.start.slice(0, 4)} → ${CP.end.slice(0, 4)}, ${int(F.trades.trades)} trades` },
              { label: 'Robustness testing', state: 'ok', note: 'placebo, delay, costs, parameters' },
              { label: 'Forward validation', state: 'wait', note: `pre-registered; observation starts ${P.forward.start}` },
              { label: 'Live track record', state: 'no', note: 'not available' },
            ]} />
            <div className="s-card s-card-glow s-reveal">
              <div className="s-card-k">Institutional</div>
              <h3 className="s-h3">Research materials</h3>
              <p>Full report, daily return series, reproducibility manifest, and a plain list of what is not done yet.</p>
              <div className="s-card-foot"><Link className="s-arrow" href="/institutional">Institutional access</Link></div>
            </div>
          </div>
        </Section>

        {/* ---------------------------------------------------------------- outils (anciennes ancres) */}
        <section className="s-section s-anchor" id="indicators">
          <div className="s-teaser s-reveal" id="pricing">
            <p><strong>Looking for the TradingView indicators?</strong> Indicators, pricing and FAQ have moved to Trading Tools.</p>
            <Link className="s-arrow" href="/trading-tools">Trading Tools</Link>
          </div>
        </section>

        <CtaBand title="Read the research" actions={<>
          <Link href="/research" className="s-btn s-btn-primary">View Research <Arrow /></Link>
          <a href={`${DOWNLOADS}/btc-eth-portfolio.html`} className="s-btn s-btn-ghost">Download Research Report</a>
        </>}>Methods, verdicts, failed markets, and every file needed to check the figures.</CtaBand>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
