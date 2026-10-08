import Link from 'next/link'
import { CheckIcon } from './components/Logo'
import HomeClientScripts from './scripts/HomeClientScripts'
import './_site/site.css'
import SiteHeader from './_site/SiteHeader'
import LineChart from './_site/LineChart'
import { SiteFooter } from './_site/ui'
import { COLORS, P, sample, sampleStart, series } from './_site/data'
import { int, num, pct } from './_site/format'

const STEP = 3
const EV = P.evidence

export default function HomePage() {
  const n = P.chart.days
  const start = sampleStart(P.chart.start, n, STEP)
  const F = P.series.portfolio
  return (
    <>
      <div className="rel">
        <SiteHeader />

        {/* SHOCK ENGINE — HERO */}
        <section className="s-home-hero">
          <div className="s-main">
            <p className="s-eyebrow">Shock Engine · systematic crypto research</p>
            <h1 className="s-h1 s-home-h1">Trading the continuation after volatility shocks.</h1>
            <p className="s-sub">One strategy, with rules frozen on Bitcoin and applied unchanged to Ethereum. Tested with placebo entries, delayed entries, walk-forward and zero-shot transfer, and published with its failures.</p>
            <div className="s-home-sim"><span className="s-tag">Historical simulation</span><span>BTC/ETH portfolio, 50/50 · {P.commonPeriod.start} → {P.commonPeriod.end} · after modeled commissions · not live performance</span></div>
            <div className="s-home-stats">
              <div><span>Sharpe ratio</span><strong>{num(F.m.sharpe)}</strong><em>BTC {num(P.headline.btcSharpe)} · ETH {num(P.headline.ethSharpe)}</em></div>
              <div><span>CAGR</span><strong>{pct(F.m.cagr)}</strong><em>{P.commonPeriod.years.toFixed(1)} years</em></div>
              <div><span>Max drawdown</span><strong>{pct(F.m.maxDD)}</strong><em>daily closes</em></div>
              <div><span>BTC/ETH correlation</span><strong>{num(P.correlation.dailyPearson)}</strong><em>strategy returns, daily</em></div>
              <div><span>Trades</span><strong>{int(P.headline.trades.total)}</strong><em>{int(P.headline.trades.btc)} BTC · {int(P.headline.trades.eth)} ETH</em></div>
            </div>
            <div className="s-actions">
              <Link href="/research" className="bp"><span>Read the research</span></Link>
              <Link href="/institutional" className="bo">Institutional</Link>
              <Link href="/shock-engine/portfolio" className="bo">BTC/ETH portfolio</Link>
            </div>
            <p className="s-note-line">{P.disclaimers[0]} {P.disclaimers[1]}</p>
          </div>
        </section>

        {/* SHOCK ENGINE — EVIDENCE */}
        <section className="s-home-band">
          <div className="s-main">
            <p className="s-eyebrow">Evidence</p>
            <h2 className="s-h2">Tests designed to break the result</h2>
            <div className="s-grid4">
              <div className="s-card"><div className="s-card-k">Random-entry placebo</div><h3>{pct(EV.btc.randomBeaten, 0)} · {pct(EV.eth.randomBeaten, 0)}</h3><p>Share of 200 random-entry runs (same exits) beaten on BTC and ETH. The edge is in the timing of entries.</p></div>
              <div className="s-card"><div className="s-card-k">Delayed entry</div><h3>{pct(EV.btc.delay1Share, 0)} · {pct(EV.eth.delay1Share, 0)}</h3><p>Share of the average trade gain kept on BTC and ETH when every entry is taken one 15-minute bar late.</p></div>
              <div className="s-card"><div className="s-card-k">Walk-forward, BTC</div><h3>Sharpe {EV.walkForward.sharpe}</h3><p>Out of sample over {EV.walkForward.windows} quarterly windows, 2020–2026, parameters re-selected on past data only.</p></div>
              <div className="s-card"><div className="s-card-k">Zero-shot transfer</div><h3>ETH: pass · Gold: no</h3><p>The Bitcoin preset, unchanged, passed every pre-set criterion on ETH (two data sources) and was rejected on gold.</p></div>
            </div>
            <p className="s-p"><Link className="s-link" href="/shock-engine">How the Shock Engine works</Link> · <Link className="s-link" href="/research">All studies and verdicts</Link></p>
          </div>
        </section>

        {/* SHOCK ENGINE — PORTFOLIO */}
        <section className="s-home-band">
          <div className="s-main">
            <p className="s-eyebrow">BTC/ETH portfolio <span className="s-tag">Historical simulation</span></p>
            <h2 className="s-h2">Two sleeves, one engine, half the capital each</h2>
            <p className="s-p">Each sleeve compounds only its own half. The portfolio improves on both sleeves&apos; Sharpe ratio and drawdown; its strategy returns correlate at {num(P.correlation.dailyPearson)}, against {num(P.correlation.underlyingDaily)} for the two coins&apos; prices.</p>
            <LineChart title="Equity curves, log scale" start={start} step={STEP} fmt="idx" log height={280} series={[
              { name: 'BTC', color: COLORS.btc, values: sample(series(P.chart.eqBtc), STEP) },
              { name: 'ETH', color: COLORS.eth, values: sample(series(P.chart.eqEth), STEP) },
              { name: 'Portfolio', color: COLORS.portfolio, values: sample(series(P.chart.eqPortfolio), STEP) },
            ]} />
            <p className="s-small">Indexed to 100 on {P.commonPeriod.start}, log scale. Commission 0.045 % per order; slippage, funding and market impact not modeled. <Link className="s-link" href="/shock-engine/portfolio">Full results, risks and downloads</Link></p>
          </div>
        </section>

        {/* SHOCK ENGINE — LIVE ET INSTITUTIONNEL */}
        <section className="s-home-band">
          <div className="s-main">
            <div className="s-grid2">
              <div className="s-card"><div className="s-card-k">Live / forward results</div><h3>Not started yet</h3><p>The live bot runs the same engine as the backtest, decision for decision. Its track record will be published on its own page, from its own start date, and never blended with the simulation.</p><Link className="s-card-link" href="/live">Live track record</Link></div>
              <div className="s-card"><div className="s-card-k">Institutional</div><h3>Research materials</h3><p>Full report, daily return series, reproducibility manifest, and a plain list of what is not done yet: live record, capacity study, independent verification.</p><Link className="s-card-link" href="/institutional">For allocators and partners</Link></div>
            </div>
          </div>
        </section>

        {/* INDICATEURS — TRANSITION */}
        <div className="s-divider">
          <p className="s-eyebrow">TradingView indicators</p>
          <p>ShadowMarketPro also publishes quantitative indicators for TradingView, by subscription. They are decision-support tools, separate from the Shock Engine strategy and its results.</p>
        </div>

        {/* BRAND STATEMENT */}
        <section className="brand-stmt">
          <div className="mx">
            <div className="brand-inner">
              <h2 className="brand-h1">Stop reacting to the market. <span className="tg">Start reading it.</span></h2>
              <p className="brand-markets">Crypto &bull; Forex &bull; Indices &bull; Stocks</p>
              <p className="brand-h2">Bull market or bear market — it doesn&apos;t matter.</p>
              <p className="brand-sub">ShadowMarket indicators adapt to market regimes, volatility and structure — so you trade with insight, not emotion.</p>
            </div>
          </div>
        </section>
        <div className="gline"></div>

        {/* FEATURES */}
        <section className="feat" id="features">
          <div className="mx">
            <div className="sh">
              <p className="sht">Features</p>
              <h2>Built for <span className="tg">market reading</span></h2>
              <p>Each tool provides distinct context — regime, structure, momentum, timing.</p>
            </div>
            <div className="fg2">
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <path d="M3 3v18h18" strokeLinecap="round"/>
                    <path d="M7 16l4-6 4 4 5-8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Regime Classification</h3>
                <p>Statistical reading of market context: trend, range, transition. Adapt your approach to real conditions.</p>
              </div>
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <path d="M12 3v18M3 12h18" strokeLinecap="round"/>
                    <path d="M8 8l4-4 4 4M16 16l-4 4-4-4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Compression &amp; Expansion</h3>
                <p>Identify compression phases before volatility expansions with precision.</p>
              </div>
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Filtered Momentum</h3>
                <p>Noise-free momentum signals aligned across multiple timeframes.</p>
              </div>
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3>Trap Detection</h3>
                <p>Automatic identification of false breakouts and liquidity traps.</p>
              </div>
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>Actionable Alerts</h3>
                <p>Multi-filter conditional signals. Each notification corresponds to a validated setup.</p>
              </div>
              <div className="gl glh fc">
                <div className="fic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="24" height="24">
                    <rect x="3" y="3" width="18" height="18" rx="3"/>
                    <path d="M3 9h18M9 3v18" strokeLinecap="round"/>
                  </svg>
                </div>
                <h3>Execution Interface</h3>
                <p>Clean overlay directly on TradingView for seamless workflow.</p>
              </div>
            </div>
          </div>
        </section>
        <div className="gline"></div>

        {/* INDICATORS */}
        <section className="ind" id="indicators">
          <div className="mx">
            <div className="sh">
              <p className="sht">Indicators</p>
              <h2>Eight tools, <span className="tg">one structural edge</span></h2>
              <p>Each indicator covers an essential dimension of market analysis.</p>
            </div>
            <div className="ig" id="ig"></div>
          </div>
        </section>
        <div className="gline"></div>

        {/* UPCOMING INDICATORS */}
        <section className="upcoming" id="upcoming">
          <div className="mx">
            <div className="upcoming-inner">
              <p className="sht">In Development</p>
              <h2>More Indicators. <span className="tg">Same Subscription.</span></h2>
              <p className="upcoming-sub">The ShadowMarketPro™ ecosystem is continuously expanding. All future indicators are automatically included — no upgrades, no hidden fees.</p>

              <div className="gl upcoming-card">
                <p>Several advanced tools are currently in development, each designed to adapt dynamically to different market conditions: crypto, indices, forex — across all timeframes, from scalping to swing and macro structures.</p>
                <p>These indicators are built to remain effective in bull markets, bear markets, and transitional regimes, focusing on price behavior, volatility structure, and market efficiency rather than fixed assumptions.</p>

                <div className="spoiler-block">
                  <div className="spoiler-label">Coming Soon</div>
                  <p>One of the upcoming releases draws inspiration from the execution logic and market reading techniques of a legendary Japanese day trader, adapted and modernized through quantitative modeling.</p>
                  <p>The objective is not to replicate a strategy, but to translate proven discretionary principles into a systematic, repeatable framework.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
        <div className="gline"></div>

        {/* TUTORIALS NOTICE */}
        <section className="tut-notice">
          <div className="mx">
            <div className="gl tut-card">
              <div className="tut-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="28" height="28">
                  <path d="M4 19.5A2.5 2.5 0 016.5 17H20"/>
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/>
                  <path d="M8 7h8M8 11h6" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h3>Dedicated Tutorial for Each Indicator</h3>
                <p>Every indicator in the ShadowMarketPro™ suite comes with a dedicated video tutorial and written guide — covering setup, interpretation, and real-world application across different market conditions.</p>
              </div>
            </div>
          </div>
        </section>
        <div className="gline"></div>

        {/* PRICING */}
        <section className="pri" id="pricing">
          <div className="mx">
            <div className="sh">
              <p className="sht">Pricing</p>
              <h2>One access, <span className="tg">all indicators</span></h2>
            </div>
            <div className="pg">

              {/* Monthly */}
              <div className="gl pc">
                <div style={{ height: '24px', marginBottom: '14px' }}></div>
                <h3>Monthly</h3>
                <div className="pam">$95<small>USD /mo</small></div>
                <p className="ppm">Billed monthly</p>
                <div className="ps2">&nbsp;</div>
                <div className="gline" style={{ marginBottom: '22px' }}></div>
                <ul className="pf">
                  <li><CheckIcon />4 indicators</li>
                  <li><CheckIcon />Updates included</li>
                  <li><CheckIcon />Email support</li>
                  <li><CheckIcon />Built-in alerts</li>
                </ul>
                <Link href="/payment?plan=monthly" className="bo">Pay with crypto</Link>
              </div>

              {/* Quarterly */}
              <div className="gl pc">
                <span className="pb2 pop">Popular</span>
                <h3>Quarterly</h3>
                <div className="pam">$289<small>USD /qtr</small></div>
                <p className="ppm">Equiv. <strong>~$86/mo</strong></p>
                <div className="ps2">Save 13%</div>
                <div className="gline" style={{ marginBottom: '22px' }}></div>
                <ul className="pf">
                  <li><CheckIcon />4 indicators</li>
                  <li><CheckIcon />Updates included</li>
                  <li><CheckIcon />Priority support</li>
                  <li><CheckIcon />Built-in alerts</li>
                </ul>
                <Link href="/payment?plan=quarterly" className="bo">Pay with crypto</Link>
              </div>

              {/* Annual */}
              <div className="gl pc hl">
                <span className="pb2 best">Best Value</span>
                <h3>Annual</h3>
                <div className="pam">$999<small>USD /yr</small></div>
                <p className="ppm">Equiv. <strong>~$75/mo</strong></p>
                <div className="ps2">Save 24%</div>
                <div className="gline" style={{ marginBottom: '22px' }}></div>
                <ul className="pf">
                  <li><CheckIcon />4 indicators</li>
                  <li><CheckIcon />All future indicators</li>
                  <li><CheckIcon />Dedicated support</li>
                  <li><CheckIcon />Onboarding session</li>
                </ul>
                <Link href="/payment?plan=yearly" className="bp" style={{ width: '100%', justifyContent: 'center' }}><span>Pay with crypto</span></Link>
              </div>

              {/* Lifetime */}
              <div className="gl pc" style={{ borderColor: 'rgba(250,204,21,.15)' }}>
                <span className="pb2 ltd">Limited — 50 spots</span>
                <h3>Lifetime</h3>
                <div className="pam">$1,799<small>USD once</small></div>
                <p className="ppm">One-time payment</p>
                <div className="ps2">Forever access</div>
                <div className="gline" style={{ marginBottom: '22px' }}></div>
                <ul className="pf">
                  <li><CheckIcon />4 indicators forever</li>
                  <li><CheckIcon />All future indicators</li>
                  <li><CheckIcon />Dedicated support</li>
                  <li><CheckIcon />VIP onboarding</li>
                </ul>
                <Link href="/payment?plan=lifetime" className="bp" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg,#b45309,#d97706,#f59e0b)' }}><span>Claim Lifetime Access</span></Link>
                <p className="lt-note">Only available to the first 50 members. After that, annual only.</p>
              </div>

            </div>

            <div className="ct">
              <div className="gl" style={{ overflow: 'hidden' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Comparison</th>
                      <th>Monthly</th>
                      <th>Quarterly</th>
                      <th className="hla">Annual</th>
                      <th>Lifetime</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Total price</td><td>$99</td><td>$259</td><td>$899</td><td>$1,599</td></tr>
                    <tr><td>Cost / month</td><td>$99</td><td>~$86</td><td>~$75</td><td>—</td></tr>
                    <tr><td>4 indicators</td><td className="ck">✓</td><td className="ck">✓</td><td className="ck">✓</td><td className="ck">✓</td></tr>
                    <tr><td>Future indicators</td><td className="ck">✓</td><td className="ck">✓</td><td className="ck">✓</td><td className="ck">✓</td></tr>
                    <tr><td>Priority support</td><td className="da">—</td><td className="ck">✓</td><td className="ck">✓</td><td className="ck">✓</td></tr>
                    <tr><td>Onboarding</td><td className="da">—</td><td className="da">—</td><td className="ck">✓</td><td className="ck">✓</td></tr>
                    <tr><td>Duration</td><td>30 days</td><td>90 days</td><td>365 days</td><td>Forever</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
        <div className="gline"></div>

        {/* FAQ */}
        <section className="faq" id="faq">
          <div className="mx-s">
            <div className="sh">
              <p className="sht">FAQ</p>
              <h2>Frequently Asked Questions</h2>
            </div>
            <div className="gl fbox" id="fb"></div>
          </div>
        </section>

        <SiteFooter />
      </div>

      <HomeClientScripts />
    </>
  )
}
