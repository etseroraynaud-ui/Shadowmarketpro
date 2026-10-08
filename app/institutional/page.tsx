import type { Metadata } from 'next'
import Link from 'next/link'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import { Disclaimer, Section, SimBar, SimTag, SiteFooter, Tiles } from '../_site/ui'
import { CONTACT_EMAIL, DOWNLOADS, P } from '../_site/data'
import { num, pct } from '../_site/format'

export const metadata: Metadata = {
  title: 'Institutional — ShadowMarketPro™',
  description: 'Research materials on the Shock Engine for allocators and research partners: historical simulation, evidence, reproducibility, and what remains to be done.',
}

export default function InstitutionalPage() {
  const F = P.series.portfolio
  const subject = encodeURIComponent('Shock Engine research pack')
  return (
    <div className="s-page">
      <SiteHeader />
      <SimBar />
      <main className="s-main">
        <div className="s-hero">
          <p className="s-eyebrow">Institutional</p>
          <h1 className="s-h1">Research materials for allocators and partners</h1>
          <p className="s-sub">The Shock Engine research is documented to be checked, not taken on trust: frozen rules, criteria fixed in advance, placebo and out-of-sample tests, and a manifest that ties every figure to code and data.</p>
          <div className="s-actions">
            {CONTACT_EMAIL
              ? <a className="bp" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}><span>Request the research pack</span></a>
              : <a className="bp" href={`${DOWNLOADS}/btc-eth-portfolio.html`}><span>Open the full report</span></a>}
            <Link href="/shock-engine/portfolio" className="bo">BTC/ETH portfolio results</Link>
          </div>
        </div>

        <Section title="Key figures" intro={<p>BTC/ETH portfolio, 50/50 without rebalancing, {P.commonPeriod.start} → {P.commonPeriod.end}. <SimTag /></p>}>
          <Tiles items={[
            { label: 'Sharpe ratio', value: num(F.m.sharpe), sub: `bootstrap 90 %: ${num(P.bootstrap.sharpe.p5)} to ${num(P.bootstrap.sharpe.p95)}` },
            { label: 'CAGR', value: pct(F.m.cagr), sub: 'after modeled commissions' },
            { label: 'Max drawdown', value: pct(F.m.maxDD), sub: `Calmar ${num(F.m.calmar)}` },
            { label: 'Annualized volatility', value: pct(F.m.vol), sub: `worst month ${pct(F.m.worstMonth.ret)}` },
            { label: 'BTC/ETH correlation', value: num(P.correlation.dailyPearson), sub: 'strategy returns, daily' },
            { label: 'Time in market', value: pct(F.expo.timeInMarket, 0), sub: `average gross exposure ${pct(F.expo.avgGross, 0)}` },
          ]} />
          <p className="s-small">{P.disclaimers[0]} {P.disclaimers[1]}</p>
        </Section>

        <Section title="What is available">
          <div className="s-grid2">
            <div className="s-card"><h3>Full research report</h3><p>Performance, reconciliation with the validated backtests, correlations in stress, risk contributions, drawdown episodes, bootstrap, costs, concentration and every sanity check.</p><a className="s-card-link" href={`${DOWNLOADS}/btc-eth-portfolio.html`}>Open the report</a></div>
            <div className="s-card"><h3>Return series</h3><p>Daily returns and equity of both sleeves and the portfolio, monthly and annual returns, drawdown episodes and rolling correlations, as CSV.</p><a className="s-card-link" href={`${DOWNLOADS}/portfolio_daily_returns.csv`} download>Daily returns (CSV)</a></div>
            <div className="s-card"><h3>Reproducibility manifest</h3><p>Code commit, dataset hashes, parameter hash, cost assumptions and random seeds. The research code regenerates the same files from the same data.</p><a className="s-card-link" href={`${DOWNLOADS}/shock-engine-v1-manifest.json`}>Manifest (JSON)</a></div>
            <div className="s-card"><h3>Evidence base</h3><p>Event studies, random-entry placebos, delayed entries, walk-forward, local robustness, zero-shot transfers to ETH, SOL, gold and TAO, with the failed tests.</p><Link className="s-card-link" href="/research">Studies and verdicts</Link></div>
          </div>
          <p className="s-p">On request: trade-level files, a walkthrough of the backtest engine and of its decision-by-decision parity with the live engine, and the earlier research history.</p>
        </Section>

        <Section title="What is not done yet" intro={<p>Stated plainly, so that it can be weighed.</p>}>
          <ul className="s-list">
            <li><strong>Live track record.</strong> The live bot runs the same engine; its public track record has not started. Live results will be reported separately from the simulation, from their own start date.</li>
            <li><strong>Capacity and market impact.</strong> Not modeled. Turnover is about {Math.round(F.cost.turnoverOneWay)} times the capital a year; no capacity figure is claimed.</li>
            <li><strong>Execution costs beyond commissions.</strong> Slippage and perpetual funding are not in the simulation. With commissions doubled, the portfolio Sharpe falls to {num(P.costs.stress[2].portfolio.sharpe)}.</li>
            <li><strong>Independent verification.</strong> No third-party audit of the research or of results has been performed.</li>
            <li><strong>Time out of sample for Bitcoin.</strong> The preset was selected on BTC data that overlaps the reported period; the walk-forward study covers 2020–2026 only.</li>
          </ul>
        </Section>

        {CONTACT_EMAIL && (
          <Section title="Contact" intro={<p>For the research pack or a discussion of the methodology: <a className="s-link" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>{CONTACT_EMAIL}</a>.</p>}>
            <p className="s-small">Please indicate your organization and what you would like to review.</p>
          </Section>
        )}

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
