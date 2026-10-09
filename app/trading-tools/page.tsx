import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckIcon } from '../components/Logo'
import HomeClientScripts from '../scripts/HomeClientScripts'
import '../_site/site.css'
import SiteHeader from '../_site/SiteHeader'
import { Arrow, SiteFooter } from '../_site/ui'

export const metadata: Metadata = {
  title: 'Trading Tools — TradingView indicators — ShadowMarketPro™',
  description: 'Adaptive quantitative indicators for TradingView: regime classification, compression and expansion, filtered momentum, trap detection and alerts. One subscription for all indicators.',
}

// Indicateurs TradingView : produit distinct du Shock Engine. Les sections reprennent l'ancienne page
// d'accueil (cartes et FAQ remplies par HomeClientScripts), sous un en-tête au nouveau design.
export default function TradingToolsPage() {
  return (
    <>
      <div className="rel s-tools">
        <SiteHeader />
        <main>
        <section className="s-hero s-hero-simple">
          <div className="s-main">
            <p className="s-eyebrow">Trading Tools · TradingView indicators</p>
            <h1 className="s-h1">Stop reacting to the market. Start reading it.</h1>
            <p className="s-sub">Quantitative indicators that adapt to market regimes, volatility and structure, for crypto, forex, indices and stocks. Decision-support tools, separate from the Shock Engine strategy and its research results.</p>
            <div className="s-actions">
              <a href="#pricing" className="s-btn s-btn-primary">See pricing <Arrow /></a>
              <a href="#indicators" className="s-btn s-btn-ghost">Browse the indicators</a>
              <Link href="/backtest" className="s-btn s-btn-ghost">Backtest Lab</Link>
            </div>
          </div>
        </section>

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
        </main>

        <SiteFooter />
      </div>

      <HomeClientScripts />
    </>
  )
}
