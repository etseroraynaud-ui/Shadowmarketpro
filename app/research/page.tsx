import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import { SubNav } from '../_site/interactive'
import { Arrow, CtaBand, Disclaimer, EvidenceCard, Section, SiteFooter, StatusList, Table, Verdict, type VerdictKind } from '../_site/ui'
import { DOWNLOADS, FACTOR_NAMES, MANIFEST, P, RA, raVerdict, verdictOf } from '../_site/data'
import { int, num, pct } from '../_site/format'

export const metadata: Metadata = {
  title: 'Research — Shock Engine — ShadowMarketPro™',
  description: 'How Shock Engine is tested: fixed rules, criteria set in advance, placebo tests, walk-forward, transfer to other markets, and a pre-registered forward validation. Every study and its verdict, including the failures.',
}

const EV = P.evidence
const FA = P.falsification
const fixMinus = (x: string) => x.replace(/(^|\s)-(?=\d)/g, '$1−')
const rob = (k: 'robBtc' | 'robEth') => EV[k].levels.find(l => l.level === 0.2)!
const yrs = (p: readonly string[]) => `${p[0].slice(0, 4)}–${p[1].slice(0, 4)}`

const SECTIONS = [
  { id: 'principles', label: 'Principles' },
  { id: 'studies', label: 'Studies' },
  { id: 'residual-alpha', label: 'Residual alpha' },
  { id: 'short-condition', label: 'Short condition' },
  { id: 'forward', label: 'Forward' },
  { id: 'versions', label: 'Versions' },
]

type Study = { name: ReactNode; period: string; finding: ReactNode; verdict: { kind: VerdictKind; label: string } }

export default function ResearchPage() {
  const studies: Study[] = [
    { name: <Link className="s-link" href="/shock-engine/portfolio">BTC/ETH portfolio, 50/50</Link>, period: `${P.commonPeriod.start.slice(0, 4)}–${P.commonPeriod.end.slice(0, 4)}`, finding: `Sharpe ${num(P.headline.portfolioSharpe)}, against ${num(P.headline.btcSharpe)} for BTC and ${num(P.headline.ethSharpe)} for ETH alone; strategy correlation ${num(P.correlation.dailyPearson)}; max drawdown ${pct(P.headline.portfolioMaxDD)}.`, verdict: { kind: 'pass', label: 'complete' } },
    { name: <a className="s-link" href="#residual-alpha">Residual alpha vs simple trend strategies</a>, period: `${P.commonPeriod.start.slice(0, 4)}–${P.commonPeriod.end.slice(0, 4)}`, finding: `After buy & hold and six standard trend strategies are removed, alpha of ${pct(RA.alphaAnn)} a year (t = ${num(RA.t)}); ${pct(RA.unexplained, 0)} of the average return is not explained by them. In-sample.`, verdict: raVerdict() },
    { name: 'BTC: event study, random entries, delayed entry', period: yrs(EV.btc.period), finding: `Continuation after shocks confirmed; beats ${pct(EV.btc.randomBeaten, 0)} of random-entry runs; a one-bar delay keeps ${pct(EV.btc.delay1Share, 0)} of the average trade. Sharpe ${num(EV.btc.sharpe)} (15-min), ${int(EV.btc.trades)} trades.`, verdict: verdictOf(EV.btc) },
    { name: 'BTC: walk-forward, 36-month calibration, 3-month tests', period: EV.walkForward.period.slice(0, 4) + '–' + EV.walkForward.period.slice(-10, -6), finding: `${EV.walkForward.windows} windows, settings re-selected on past data only: Sharpe ${EV.walkForward.sharpe}, CAGR ${fixMinus(EV.walkForward.cagr)}, max drawdown ${fixMinus(EV.walkForward.dd)}. Positive out of sample, clearly below the fixed preset.`, verdict: { kind: 'partial', label: 'positive, weaker' } },
    { name: 'BTC: parameter neighborhood (1,810 runs)', period: yrs(EV.robBtc.period), finding: `All parameters perturbed together by up to ±20 %: median Sharpe ${num(rob('robBtc').medianSharpe)} against ${num(rob('robBtc').preset)}; ${pct(rob('robBtc').profitable, 0)} profitable. The preset tops its neighborhood, as expected of rules selected on this data.`, verdict: { kind: 'pass', label: 'pass, selection bias' } },
    { name: 'ETH: transfer of the BTC rules', period: yrs(EV.eth.period), finding: `No ETH calibration. Every pre-set criterion met: continuation, random entries (${pct(EV.eth.randomBeaten, 0)}), delay (${pct(EV.eth.delay1Share, 0)}). Sharpe ${num(EV.eth.sharpe)}, ${int(EV.eth.trades)} trades.`, verdict: verdictOf(EV.eth) },
    { name: 'ETH: independent price feed (Dukascopy)', period: yrs(EV.ethDukascopy.period), finding: `Same verdict on a different data source: Sharpe ${num(EV.ethDukascopy.sharpe)}, ${int(EV.ethDukascopy.trades)} trades.`, verdict: verdictOf(EV.ethDukascopy) },
    { name: 'ETH: parameter neighborhood (1,810 runs)', period: yrs(EV.robEth.period), finding: `At ±20 %, median Sharpe ${num(rob('robEth').medianSharpe)} against ${num(rob('robEth').preset)}; ${pct(rob('robEth').profitable, 0)} profitable. The rules sit mid-neighborhood: a plateau, not a peak.`, verdict: { kind: 'pass', label: 'pass' } },
    { name: 'Solana: transfer', period: yrs(EV.sol.period), finding: `Sharpe ${num(EV.sol.sharpe)}, drawdown ${pct(EV.sol.dd)}; beats ${pct(EV.sol.randomBeaten, 0)} of random-entry runs. The pre-set criteria are not met.`, verdict: verdictOf(EV.sol) },
    { name: 'Gold: transfer', period: yrs(EV.gold.period), finding: `No continuation after shocks; Sharpe ${num(EV.gold.sharpe)}. A variant with seasonal normalization also failed.`, verdict: { kind: 'fail', label: 'rejected' } },
    { name: 'TAO: transfer', period: yrs(EV.tao.period), finding: `Sharpe ${num(EV.tao.sharpe)} on about two years of data; none of the criteria met.`, verdict: { kind: 'fail', label: 'did not pass' } },
    { name: 'Capacity and market impact', period: '—', finding: 'Not yet modeled. No capacity figure is claimed.', verdict: { kind: 'na', label: 'to do' } },
  ]
  const passed = studies.filter(s => s.verdict.kind === 'pass').length
  const failed = studies.filter(s => s.verdict.kind === 'fail').length
  return (
    <div className="s-page">
      <SiteHeader />
      <SubNav items={SECTIONS} />
      <main className="s-main">
        <section className="s-hero s-hero-simple">
          <p className="s-eyebrow">Research</p>
          <h1 className="s-h1">How Shock Engine is tested</h1>
          <p className="s-sub">Rules are fixed before they are tested. Each test has a pass/fail criterion set in advance. Failures are published next to the successes.</p>
          <div className="s-chips">
            <span className="s-chip"><span className="s-chip-dot" /><b>{passed}</b> passed</span>
            <span className="s-chip"><span className="s-chip-dot" style={{ background: 'var(--s-amber)' }} /><b>{studies.length - passed - failed}</b> partial or open</span>
            <span className="s-chip"><span className="s-chip-dot" style={{ background: 'var(--s-neg)' }} /><b>{failed}</b> failed</span>
          </div>
        </section>

        <Section id="principles" eyebrow="Method" title="Principles">
          <div className="s-grid3">
            {[
              ['01', 'No tuning after the fact', 'The rules were selected once, on Bitcoin. Later tests run them unchanged: no new variable, no re-estimated parameter, no adjusted cost.'],
              ['02', 'Criteria first', 'Each study states its criteria before the result is seen: profit factor, Sharpe, placebo rank, delay tolerance, event-study significance.'],
              ['03', 'Placebos', 'Random entries with identical exits separate the value of the signal from the market’s drift and from the shape of the exits.'],
              ['04', 'Across time and markets', 'Walk-forward re-selection on past data only, and transfer of the Bitcoin rules to markets they never saw.'],
              ['05', 'Stress', 'Commissions doubled, entries delayed, every parameter perturbed at once: a real edge should bend, not break.'],
              ['06', 'Reproducible', 'Each published result is tied to a code commit, data hashes and a parameter hash, with fixed random seeds. The same command gives the same files.'],
            ].map(([n, t, p]) => (
              <div className="s-card s-reveal" key={n}><div className="s-pipe-n">{n}</div><h3>{t}</h3><p>{p}</p></div>
            ))}
          </div>
        </Section>

        <Section id="studies" eyebrow="Evidence" title="Studies and verdicts" intro={<p>Single-market Sharpe ratios use 15-minute returns over each market&apos;s full test period; the portfolio uses daily returns. All figures are historical simulations after a commission of 0.045 % per order.</p>}>
          <div className="s-studies">
            {studies.map((s, i) => (
              <div className="s-study s-reveal" key={i}>
                <div><h3>{s.name}</h3><span className="s-study-p">{s.period}</span></div>
                <p>{s.finding}</p>
                <Verdict kind={s.verdict.kind}>{s.verdict.label}</Verdict>
              </div>
            ))}
          </div>
        </Section>

        <Section id="residual-alpha" eyebrow="Residual alpha" title="Is it just trend following?" intro={<p>Could simple, well-known trend strategies reproduce the result? The daily returns of the portfolio are regressed on buy &amp; hold BTC and ETH and on six standard trend strategies whose parameters were fixed before the study: momentum over 30, 90 and 180 days, a 55/20-day breakout, a 20/100-day moving-average crossover and an intraday breakout on 15-minute bars. Same bars, same commission, positions decided at the close and applied to the next day.</p>}>
          <div className="s-metrics s-reveal">
            <div className="s-metric"><div className="s-metric-l">Residual alpha</div><div className="s-metric-v s-pos">{pct(RA.alphaAnn)}</div><div className="s-metric-s">per year, arithmetic</div></div>
            <div className="s-metric"><div className="s-metric-l">t-statistic</div><div className="s-metric-v">{num(RA.t)}</div><div className="s-metric-s">Newey–West; threshold set at 3</div></div>
            <div className="s-metric"><div className="s-metric-l">Not explained</div><div className="s-metric-v">{pct(RA.unexplained, 0)}</div><div className="s-metric-s">of the average return (R² {num(RA.r2)})</div></div>
            <div className="s-metric"><div className="s-metric-l">Resampled histories</div><div className="s-metric-v">{int(RA.bootstrap.pNonPositive * RA.bootstrap.reps)} of {int(RA.bootstrap.reps)}</div><div className="s-metric-s">with alpha ≤ 0 · 90 %: {pct(RA.bootstrap.p5, 0)} to {pct(RA.bootstrap.p95, 0)}</div></div>
          </div>
          <div className="s-grid2">
            <Table compact head={['Factor', 'Beta', 't']} rows={RA.factors.map(f => [FACTOR_NAMES[f.name], num(f.beta), num(f.t)])} caption="Exposure of the portfolio to each factor" />
            <Table compact head={['Benchmark alone', 'Sharpe', 'Correlation with Shock Engine']} rows={RA.benchmarks.map(b => [FACTOR_NAMES[b.id], num(b.sharpe), num(b.corr)])} caption="The benchmarks on their own, 50/50 BTC/ETH" />
          </div>
          <Table compact head={['Variant (fixed in advance)', 'Alpha per year', 't']} caption="Sensitivity checks" rows={[
            ['Main model', pct(RA.alphaAnn), num(RA.t)],
            ['19 trend strategies at once (favors the benchmarks)', pct(RA.sensitivities.grid.alphaAnn), num(RA.sensitivities.grid.t)],
            ['First half of the period', pct(RA.sensitivities.firstHalf.alphaAnn), num(RA.sensitivities.firstHalf.t)],
            ['Second half of the period', pct(RA.sensitivities.secondHalf.alphaAnn), num(RA.sensitivities.secondHalf.t)],
            ['Weekly returns', pct(RA.sensitivities.weekly.alphaAnn), num(RA.sensitivities.weekly.t)],
            ['Benchmarks without commissions', pct(RA.sensitivities.frictionless.alphaAnn), num(RA.sensitivities.frictionless.t)],
          ]} />
          <p className="s-small">Pre-registered before any computation: alpha counts as demonstrated only if t ≥ 3 and fewer than 1 % of month-block resampled histories give alpha ≤ 0. In-sample: the rules were chosen on data covering this period, and the short-entry condition was specified after it had been studied. The test shows that simple trend strategies do not reproduce the historical result; it does not show that the alpha will persist. Closest factor: the intraday breakout, which shares part of the timing but loses money on its own after costs.</p>
        </Section>

        <Section id="short-condition" eyebrow="Short entries" title="Could the trend condition be luck?" intro={<p>Short positions are only opened when the daily trend regime is bearish. {P.disclaimers[2].split('. ').slice(1).join('. ')} Two placebo tests, specified before they were run, ask whether a condition of the same size, chosen at random, would have done as well.</p>}>
          <div className="s-grid2">
            <EvidenceCard k="Random selection" stat={`${num(FA.randomSelection.evPercentile, 1)}th`} sub="percentile" href="#short-condition" link="On this page">
              The same number of short trades, kept at random, {int(FA.randomSelection.draws)} times by market and year. The average risk-adjusted gain of the shorts actually kept beats {num(FA.randomSelection.evPercentile, 1)} % of the draws (p = {num(FA.randomSelection.evP, 3)}); for the portfolio Sharpe, {num(FA.randomSelection.sharpePercentile, 1)} % (p = {num(FA.randomSelection.sharpeP, 3)}).
            </EvidenceCard>
            <EvidenceCard k="Shifted regime" stat={`p = ${num(FA.regimeShift.p, 3)}`} sub={`${int(FA.regimeShift.shifts)} shifts`} href="#short-condition" link="On this page">
              The bearish periods shifted in time, keeping their length and share of time. The gap between shorts in and out of the bearish regime is larger with the real dates than with {num(FA.regimeShift.percentile, 1)} % of the shifts.
            </EvidenceCard>
          </div>
          <p className="s-small">Both tests use the same historical period that was studied before the condition was specified; they measure how unusual the result is, not how it will behave in the future. That question is left to the forward validation below.</p>
        </Section>

        <Section id="forward" eyebrow="Forward validation" title="A test that cannot be tuned" intro={<p>The plan was committed before the first observation: hypothesis, statistic, sample sizes, decision thresholds and stopping date. Nothing in it can change once it has started.</p>}>
          <div className="s-split">
            <StatusList items={[
              { label: 'Hypothesis', state: 'ok', note: 'shorts taken in a bearish daily regime earn more, risk-adjusted, than shorts taken outside it' },
              { label: 'Observation starts', state: 'wait', note: P.forward.start },
              { label: 'Interim looks', state: 'wait', note: 'after 25, 50 and 75 closed shorts in the bearish regime, at p < 0.001' },
              { label: 'Final look', state: 'wait', note: 'when both groups reach 100 closed shorts, at p < 0.047; at the latest 2031-10-01' },
              
            ]} />
            <div className="s-card s-card-glow s-reveal">
              <div className="s-card-k">Why it takes time</div>
              <h3 className="s-h3">About {num(P.capacity.tradesPerYear.total, 0)} trades a year, few of them shorts</h3>
              <p>Reaching 100 closed shorts in each group should take years rather than months, less in a falling market. The plan sets a monthly evaluation and fixed looks; a result is read only at those looks.</p>
            </div>
          </div>
        </Section>

        <Section id="archive" eyebrow="History" title="Earlier work" intro={<p>Shock Engine started as a TradingView script whose original settings lost money on Bitcoin after costs. The first research passes diagnosed why, showed that re-optimizing many parameters chases noise, and that among regime-based selections only a calm/agitated volatility split was worth pursuing: it became the basis of the current rules. Those working reports (in French) remain available.</p>}>
          <p className="s-p"><Link className="s-arrow" href="/backtest/recherche">Research archive (working reports)</Link></p>
        </Section>

        <Section id="versions" eyebrow="Reproducibility" title="Current version">
          <Table text head={['', '']} rows={[
            ['Research version', P.manifest.version],
            ['Code commit', <span key="c" className="s-mono">{P.manifest.commit}</span>],
            ['Parameter hash (SHA-256)', <span key="h" className="s-mono">{P.manifest.parametersSha256}</span>],
            ['Consistency checks', `${P.manifest.checksPassed} of ${P.manifest.checksTotal} pass`],
            ['Manifest', <a key="m" className="s-link" href={`${DOWNLOADS}/${MANIFEST}`}>{MANIFEST}</a>],
            ['Full report', <a key="r" className="s-link" href={`${DOWNLOADS}/btc-eth-portfolio.html`}>BTC/ETH portfolio report (HTML)</a>],
          ]} />
        </Section>

        <CtaBand title="See the numbers these tests protect" actions={<>
          <Link href="/shock-engine/portfolio" className="s-btn s-btn-primary">Explore Performance <Arrow /></Link>
          <Link href="/institutional" className="s-btn s-btn-ghost">Institutional Access</Link>
        </>} />

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
