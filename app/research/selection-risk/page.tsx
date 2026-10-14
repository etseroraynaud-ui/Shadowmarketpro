import type { Metadata } from 'next'
import Link from 'next/link'
import '../../_site/site.css'
import SiteHeader from '../../_site/SiteHeader'
import { Arrow, Disclaimer, Section, SiteFooter, Table } from '../../_site/ui'
import { DSR_V1, P } from '../../_site/data'
import { int, num, pct } from '../../_site/format'

export const metadata: Metadata = {
  title: 'Selection risk — Research — Shock Engine — ShadowMarketPro™',
  description: 'How the deflated Sharpe ratio of Shock Engine V1 is computed: the trials counted, their correlations, the selection of the parameters, and the three scenarios.',
}

const total = DSR_V1.stages.reduce((a, s) => a + s.inflation, 0)

export default function SelectionRiskPage() {
  return (
    <div className="s-page">
      <SiteHeader />
      <main className="s-main">
        <section className="s-hero s-hero-simple">
          <p className="s-eyebrow">Research · methodology</p>
          <h1 className="s-h1">Selection risk of the reference version</h1>
          <p className="s-sub">How the deflated Sharpe ratio of V1 is computed, and how it depends on the way the trials are counted. Historical result, not a prospective validation.</p>
        </section>

        <Section id="measure" eyebrow="Measure" title="What the deflated Sharpe measures" intro={<p>When many configurations are tried and the best one is kept, its Sharpe ratio is inflated by the selection: even configurations without any edge produce a positive best Sharpe. The deflated Sharpe ratio (Bailey and López de Prado, 2014) estimates that chance threshold, then the probability that the true Sharpe exceeds it, taking into account the length of the history ({int(P.commonPeriod.days)} days) and the skewness and fat tails of the daily returns. It is computed for V1, the reference version: BTC/ETH portfolio, new positions in the calm regime only, historical Sharpe {num(P.headline.portfolioSharpe)} over {DSR_V1.period}.</p>} />

        <Section id="scenarios" eyebrow="Scenarios" title="Three ways of counting the trials">
          <Table head={['Scenario', 'How the trials are counted', 'Chance threshold (Sharpe)', 'Deflated Sharpe']} rows={[
            ['Pre-registered', `One pool of ${int(DSR_V1.preregistered.trials)} trials treated as independent; dispersion of their Sharpe ratios ${num(DSR_V1.preregistered.sigma, 3)}, measured on parameter sets replayed alone, without the regime structure.`, num(DSR_V1.preregistered.threshold), pct(DSR_V1.preregistered.p)],
            ['Re-evaluated', 'Only the trials that actually competed with V1, step by step; their correlations and estimation noise measured by resampling whole months; parameters chosen on Bitcoin alone, as they were.', num(DSR_V1.audited.threshold), 'above 99.9%'],
            ['Prudent (shown on the Research page)', 'Re-evaluated, but assuming the parameters had been chosen on the whole portfolio and counting seven times more procedure choices than recorded.', num(DSR_V1.prudent.threshold), pct(DSR_V1.prudent.p)],
          ]} />
          <p className="s-small">A deflated Sharpe of 95% or more is the usual bar. The published figure is the prudent one: it keeps a margin for selection opportunities that could not be replayed.</p>
        </Section>

        <Section id="selection" eyebrow="Selection history" title="The choices that led to V1" intro={<p>V1 results from three successive choices, each made by comparing alternatives on this history. Each choice adds its own expected inflation, measured by resampling the alternatives together; the sum is the re-evaluated chance threshold.</p>}>
          <Table head={['Choice', 'Alternatives in competition', 'Expected inflation of the Sharpe']} rows={[
            ...DSR_V1.stages.map(s => [s.step, int(s.alternatives), num(s.inflation)]),
            ['Total (re-evaluated threshold)', '', num(total)],
          ]} />
          <p className="s-small">Not counted as selection: validation and falsification tests that could not change the rules (walk-forward, parameter neighborhoods, transfer to other markets, placebo tests), diagnostics, and every test run after V1 was frozen. The parameter sets of the agitated regime are not counted either: they have no effect on V1’s trades.</p>
        </Section>

        <Section id="why" eyebrow="Audit" title="Why the pre-registered count was too severe">
          <ul className="s-list">
            <li>The dispersion of {num(DSR_V1.preregistered.sigma, 3)} came from a population that was not competing with V1: parameter sets replayed alone, without the regime structure, with a negative average Sharpe. Among the parameter sets that could actually have replaced V1’s, the dispersion is {num(DSR_V1.sigma.candidates)}; estimation noise alone accounts for {num(DSR_V1.sigma.noise)}.</li>
            <li>The trials are not independent: the rule variants tried on the portfolio are correlated at 0.85 to 0.94 and count for about two independent trials per choice.</li>
            <li>The parameters were chosen on Bitcoin alone: the Ethereum half of the portfolio carries none of that selection gain.</li>
            <li>The re-evaluation also adds trials the pre-registered count left out: two further draws of candidate parameter sets ({int(DSR_V1.ethRank.candidates)} distinct sets in all) and the choice of timeframe and regime split, covered by the prudent scenario.</li>
          </ul>
        </Section>

        <Section id="independent" eyebrow="Independent check" title="Chosen on Bitcoin, first on Ethereum">
          <p className="s-intro">The calm-regime parameter set was chosen on Bitcoin. Replayed with V1’s rules, it also ranks first of the {int(DSR_V1.ethRank.candidates)} candidate sets on Ethereum, which was not used to choose it. Under estimation noise alone, the probability of that outcome is {num(DSR_V1.ethRank.pByChance, 3)}.</p>
        </Section>

        <Section id="limits" eyebrow="Limits" title="What this does not show">
          <ul className="s-list">
            <li>It is a historical result, measured on the data used to design the rules. It is not a prospective validation: only the forward test on the <Link className="s-link" href="/research#forward">Research page</Link> can provide one.</li>
            <li>Only recorded trials are counted; earlier manual trials cannot be. The prudent scenario keeps a margin for them.</li>
            <li>The criterion used to choose the parameters (trade t-statistics on Bitcoin) is approximated by the Bitcoin Sharpe ratio over the same period.</li>
            <li>The deflated Sharpe concerns the Sharpe ratio of V1. Whether the calm-regime restriction improved on the previous rules is a separate question, not proven.</li>
          </ul>
          <p><Link href="/research#selection-risk" className="s-btn s-btn-ghost">Back to Research <Arrow /></Link></p>
        </Section>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
