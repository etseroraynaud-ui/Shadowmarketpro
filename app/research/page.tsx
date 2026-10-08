import type { Metadata } from 'next'
import Link from 'next/link'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import { Disclaimer, Section, SiteFooter, Table } from '../_site/ui'
import { DOWNLOADS, P } from '../_site/data'
import { int, num, pct } from '../_site/format'

export const metadata: Metadata = {
  title: 'Research — ShadowMarketPro™',
  description: 'How the Shock Engine is tested: frozen rules, criteria fixed in advance, placebo tests, walk-forward, zero-shot transfer to other markets. Every study and its verdict, including the failures.',
}

const EV = P.evidence
const fixMinus = (x: string) => x.replace(/(^|\s)-(?=\d)/g, '$1−')
const badge = (s: 'pass' | 'partial' | 'fail' | 'pending', label: string) => <span className={s === 'pass' ? 's-pass' : s === 'partial' || s === 'pending' ? 's-partial' : 's-fail'}>{label}</span>
const rob = (k: 'robBtc' | 'robEth') => EV[k].levels.find(l => l.level === 0.2)!

export default function ResearchPage() {
  const studies: [React.ReactNode, string, React.ReactNode, React.ReactNode][] = [
    [<Link key="p" className="s-link" href="/shock-engine/portfolio">BTC/ETH portfolio, 50/50</Link>, `${P.commonPeriod.start.slice(0, 4)}–${P.commonPeriod.end.slice(0, 4)}`, `Sharpe ${num(P.headline.portfolioSharpe)} against ${num(P.headline.btcSharpe)} (BTC) and ${num(P.headline.ethSharpe)} (ETH); correlation ${num(P.correlation.dailyPearson)}; max drawdown ${pct(P.headline.portfolioMaxDD)}.`, badge('pass', 'complete')],
    ['BTC: event study, random-entry placebo, delayed entry', `${EV.btc.period[0].slice(0, 4)}–${EV.btc.period[1].slice(0, 4)}`, `Continuation after shocks confirmed; beats ${pct(EV.btc.randomBeaten, 0)} of placebos; one-bar delay keeps ${pct(EV.btc.delay1Share, 0)} of the edge. Sharpe ${num(EV.btc.sharpe)} (15-min), ${int(EV.btc.trades)} trades.`, badge('pass', 'pass')],
    ['BTC: walk-forward, 36-month calibration, 3-month tests', '2020–2026', `${EV.walkForward.windows} out-of-sample windows: Sharpe ${EV.walkForward.sharpe}, CAGR ${fixMinus(EV.walkForward.cagr)}, max drawdown ${fixMinus(EV.walkForward.dd)}.`, badge('pass', 'pass')],
    ['BTC: local parameter robustness (1,810 runs)', '2017–2026', `At ±20 %, neighbor median Sharpe ${num(rob('robBtc').medianSharpe)} against ${num(rob('robBtc').preset)}; ${pct(rob('robBtc').profitable, 0)} profitable. The preset tops its neighborhood, consistent with selection on this data.`, badge('pass', 'pass, with selection bias')],
    ['ETH: zero-shot transfer of the BTC preset', `${EV.eth.period[0].slice(0, 4)}–${EV.eth.period[1].slice(0, 4)}`, `No ETH calibration. All pre-set criteria met: continuation, placebo (${pct(EV.eth.randomBeaten, 0)}), delay (${pct(EV.eth.delay1Share, 0)}). Sharpe ${num(EV.eth.sharpe)}, ${int(EV.eth.trades)} trades.`, badge('pass', 'pass')],
    ['ETH: independent data source (Dukascopy)', `${EV.ethDukascopy.period[0].slice(0, 4)}–${EV.ethDukascopy.period[1].slice(0, 4)}`, `Same verdict on a different price feed: Sharpe ${num(EV.ethDukascopy.sharpe)}, ${int(EV.ethDukascopy.trades)} trades.`, badge('pass', 'pass')],
    ['ETH: local parameter robustness (1,810 runs)', `${EV.eth.period[0].slice(0, 4)}–${EV.eth.period[1].slice(0, 4)}`, `At ±20 %, neighbor median Sharpe ${num(rob('robEth').medianSharpe)} against ${num(rob('robEth').preset)}; the preset sits mid-neighborhood: a plateau, not a peak.`, badge('pass', 'pass')],
    ['SOL: zero-shot transfer', `${EV.sol.period[0].slice(0, 4)}–${EV.sol.period[1].slice(0, 4)}`, `Profitable (Sharpe ${num(EV.sol.sharpe)}) and beats random entries, but the signal event study fails and the drawdown is large (${pct(EV.sol.dd)}).`, badge('partial', 'partial')],
    ['Gold: zero-shot transfer', `${EV.gold.period[0].slice(0, 4)}–${EV.gold.period[1].slice(0, 4)}`, `No continuation after shocks; Sharpe ${num(EV.gold.sharpe)}. A variant with seasonal normalization also failed.`, badge('fail', 'rejected')],
    ['TAO: zero-shot transfer', `${EV.tao.period[0].slice(0, 4)}–${EV.tao.period[1].slice(0, 4)}`, `Sharpe ${num(EV.tao.sharpe)} on about two years of data; the bot preset meets none of the criteria.`, badge('fail', 'failed / insufficient')],
    [<Link key="l" className="s-link" href="/live">Live forward test (Hyperliquid)</Link>, '—', 'The bot engine reproduces the backtest decision by decision. The public live track record has not started yet.', badge('pending', 'not started')],
    ['Capacity and market impact', '—', 'Not yet modeled. No capacity figure is claimed.', badge('pending', 'to do')],
  ]
  return (
    <div className="s-page">
      <SiteHeader />
      <main className="s-main">
        <div className="s-hero">
          <p className="s-eyebrow">Research</p>
          <h1 className="s-h1">How the Shock Engine is tested</h1>
          <p className="s-sub">Rules are frozen before they are tested. Each test has a pass/fail criterion fixed in advance. Failures are published next to the successes.</p>
        </div>

        <Section title="Principles">
          <div className="s-grid3">
            <div className="s-card"><div className="s-card-k">1 · Frozen rules</div><h3>No tuning after the fact</h3><p>A preset is selected once, on Bitcoin. Every later test runs it unchanged: no new variable, no re-estimated parameter, no adjusted cost.</p></div>
            <div className="s-card"><div className="s-card-k">2 · Criteria first</div><h3>Pass/fail fixed in advance</h3><p>Each study states its criteria before the result is seen: profit factor, Sharpe, placebo rank, delay tolerance, event-study significance.</p></div>
            <div className="s-card"><div className="s-card-k">3 · Placebos</div><h3>Test the timing, not the drift</h3><p>Random entries with identical exits separate the value of the signal from the market&apos;s trend and from the shape of the exits.</p></div>
            <div className="s-card"><div className="s-card-k">4 · Out of sample</div><h3>Across time and across assets</h3><p>Walk-forward re-selection on past data only, and zero-shot transfer of the Bitcoin preset to markets it never saw.</p></div>
            <div className="s-card"><div className="s-card-k">5 · Stress</div><h3>Costs, delays, neighbors</h3><p>Commissions doubled, entries delayed, every parameter perturbed at once: a real edge should bend, not break.</p></div>
            <div className="s-card"><div className="s-card-k">6 · Reproducible</div><h3>Versioned and hashed</h3><p>Each published result is tied to a code commit, data hashes and a parameter hash, with fixed random seeds. The same command gives the same files.</p></div>
          </div>
        </Section>

        <Section title="Studies and verdicts" intro={<p>Sharpe ratios of single-market studies use 15-minute returns over each market&apos;s full test period; the portfolio uses daily returns. All figures are historical simulations after a commission of 0.045 % per order.</p>}>
          <div className="s-desk"><Table text head={['Study', 'Period', 'Finding', 'Verdict']} rows={studies} /></div>
          <div className="s-mob s-study-cards">
            {studies.map(([name, period, finding, verdict], i) => (
              <div className="s-card" key={i}><h3>{name}</h3><p className="s-small">{period} · {verdict}</p><p>{finding}</p></div>
            ))}
          </div>
        </Section>

        <Section title="Earlier work" intro={<p>The Shock Engine started as a TradingView script whose original settings lost money on Bitcoin after costs. The first research passes diagnosed why, showed that re-optimizing many parameters chases noise, and that among regime-based selections only a calm/agitated volatility split was worth pursuing: it became the basis of the current preset. Those working reports (in French) remain available.</p>}>
          <p className="s-p"><Link className="s-link" href="/backtest/recherche">Research archive (working reports)</Link> · <Link className="s-link" href="/backtest">Backtest Lab</Link></p>
        </Section>

        <Section title="Current version" intro={null}>
          <Table text head={['', '']} rows={[
            ['Research version', P.manifest.version],
            ['Code commit', <span key="c" className="s-mono">{P.manifest.commit}</span>],
            ['Parameter hash (SHA-256)', <span key="h" className="s-mono">{P.manifest.parametersSha256}</span>],
            ['Consistency checks', `${P.manifest.checksPassed} of ${P.manifest.checksTotal} pass`],
            ['Manifest', <a key="m" className="s-link" href={`${DOWNLOADS}/shock-engine-v1-manifest.json`}>shock-engine-v1-manifest.json</a>],
            ['Full report', <a key="r" className="s-link" href={`${DOWNLOADS}/btc-eth-portfolio.html`}>BTC/ETH portfolio report (HTML)</a>],
          ]} />
        </Section>

        <Disclaimer />
      </main>
      <SiteFooter />
    </div>
  )
}
