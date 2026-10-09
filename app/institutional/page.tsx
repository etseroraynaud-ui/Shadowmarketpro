import type { Metadata } from 'next'
import Link from 'next/link'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import { Arrow, Disclaimer, Metrics, Section, SimNote, SiteFooter, StatusList } from '../_site/ui'
import { CONTACT_EMAIL, DOWNLOADS, MANIFEST, P } from '../_site/data'
import { num, pct } from '../_site/format'

export const metadata: Metadata = {
  title: 'Institutional — Shock Engine — ShadowMarketPro™',
  description: 'Research materials on Shock Engine for allocators and research partners: historical simulation, evidence, reproducibility, and what remains to be done.',
}

const F = P.series.portfolio
const CP = P.commonPeriod
const EV_PERIOD = `${P.evidence.walkForward.period.slice(0, 4)}–${P.evidence.walkForward.period.slice(-10, -6)}`
const Doc = ({ k, title, children, href, label, download }: { k: string; title: string; children: string; href: string; label: string; download?: boolean }) => (
  <div className="s-card s-card-hover s-reveal">
    <div className="s-card-k">{k}</div>
    <h3>{title}</h3>
    <p>{children}</p>
    <div className="s-card-foot">{href.startsWith('/') && !href.startsWith(DOWNLOADS) ? <Link className="s-arrow" href={href}>{label}</Link> : <a className="s-arrow" href={href} download={download || undefined}>{label}</a>}</div>
  </div>
)

export default function InstitutionalPage() {
  const subject = encodeURIComponent('Shock Engine research pack')
  return (
    <div className="s-page">
      <SiteHeader />
      <main className="s-main">
        <section className="s-hero s-hero-simple">
          <p className="s-eyebrow">Institutional</p>
          <h1 className="s-h1">Research materials for allocators and partners</h1>
          <p className="s-sub">Shock Engine is documented to be checked, not taken on trust: fixed rules, criteria set in advance, placebo and out-of-sample tests, and a manifest that ties every figure to code and data.</p>
          <div className="s-actions">
            {CONTACT_EMAIL
              ? <a className="s-btn s-btn-primary" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>Request the research pack <Arrow /></a>
              : <a className="s-btn s-btn-primary" href={`${DOWNLOADS}/btc-eth-portfolio.html`}>Open the full report <Arrow /></a>}
            <Link href="/shock-engine/portfolio" className="s-btn s-btn-ghost">Performance dashboard</Link>
          </div>
        </section>

        <Section id="figures" eyebrow="Key figures" title="BTC/ETH portfolio" intro={<p>50/50 without rebalancing, {CP.start} → {CP.end}.</p>}>
          <Metrics items={[
            { label: 'Sharpe ratio', value: num(F.m.sharpe), sub: `resampled 90 %: ${num(P.bootstrap.sharpe.p5)} to ${num(P.bootstrap.sharpe.p95)}` },
            { label: 'CAGR', value: pct(F.m.cagr), sub: 'after modeled commissions' },
            { label: 'Max drawdown', value: pct(F.m.maxDD), sub: `Calmar ${num(F.m.calmar)}` },
            { label: 'Volatility', value: pct(F.m.vol), sub: `worst month ${pct(F.m.worstMonth.ret)}` },
            { label: 'BTC/ETH correlation', value: num(P.correlation.dailyPearson), sub: 'strategy returns, daily' },
            { label: 'Time in market', value: pct(F.expo.timeInMarket, 0), sub: `average exposure ${pct(F.expo.avgGross, 0)}` },
          ]} />
          <SimNote />
        </Section>

        <Section id="materials" eyebrow="Materials" title="What is available">
          <div className="s-grid2">
            <Doc k="Report" title="Full research report" href={`${DOWNLOADS}/btc-eth-portfolio.html`} label="Open the report">Performance, reconciliation with the validated backtests, correlations in stress, risk contributions, drawdown episodes, resampling, costs, concentration and every consistency check.</Doc>
            <Doc k="Data" title="Return series" href={`${DOWNLOADS}/portfolio_daily_returns.csv`} label="Daily returns (CSV)" download>Daily returns and equity of both markets and the portfolio, monthly and annual returns, drawdown episodes and rolling correlations, as CSV.</Doc>
            <Doc k="Manifest" title="Reproducibility manifest" href={`${DOWNLOADS}/${MANIFEST}`} label="Manifest (JSON)">Code commit, dataset hashes, parameter hash, cost assumptions and random seeds. The research code regenerates the same files from the same data.</Doc>
            <Doc k="Evidence" title="Studies and verdicts" href="/research" label="Research">Event studies, random-entry placebos, delayed entries, walk-forward, parameter neighborhoods, transfers to ETH, SOL, gold and TAO, including the failed tests.</Doc>
          </div>
          <p className="s-p">On request: trade-level files, a walkthrough of the backtest engine, and the earlier research history.</p>
        </Section>

        <Section id="not-done" eyebrow="Limits" title="What is not done yet" intro={<p>Stated plainly, so that it can be weighed.</p>}>
          <StatusList items={[
            { label: 'Live track record', state: 'no', note: 'not available; live results will be reported separately from the simulation, from their own start date' },
            { label: 'Forward validation', state: 'wait', note: `of the short-entry condition; pre-registered, observation starts ${P.forward.start}` },
            { label: 'Capacity and market impact', state: 'no', note: `not modeled; turnover about ${Math.round(F.cost.turnoverOneWay)}× the capital a year` },
            { label: 'Slippage and funding', state: 'no', note: `not in the headline figures; with commissions doubled the Sharpe is ${num(P.costs.stress[2].portfolio.sharpe)}, with historical funding ${num(P.stress.funding[0].sharpe)}` },
            { label: 'Independent verification', state: 'no', note: 'no third-party audit of the research or of results' },
          ]} />
          <ul className="s-list s-mt">
            <li><strong>Short-entry condition.</strong> {P.disclaimers[2]}</li>
            <li><strong>Time out of sample for Bitcoin.</strong> The rules were selected on BTC data that overlaps the reported period; the walk-forward study covers {EV_PERIOD} only.</li>
          </ul>
        </Section>

        {CONTACT_EMAIL && (
          <Section id="contact" eyebrow="Contact" title="Talk to us" intro={<p>For the research pack or a discussion of the methodology: <a className="s-link" href={`mailto:${CONTACT_EMAIL}?subject=${subject}`}>{CONTACT_EMAIL}</a>. Please indicate your organization and what you would like to review.</p>}>
            <span />
          </Section>
        )}

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
