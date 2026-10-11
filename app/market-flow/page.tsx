import type { Metadata } from 'next'
import '../_site/site.css'
import './flow.css'
import SiteHeader from '../_site/SiteHeader'
import { Section, SiteFooter } from '../_site/ui'
import MarketFlow from './MarketFlow'
import { getFlow } from '../../lib/flow/source'

export const metadata: Metadata = {
  title: 'Market Flow: whales vs retail on Bitcoin and Ether — ShadowMarketPro™',
  description: 'Live cumulative volume delta by order size on perpetuals (Binance, Bybit, OKX) and spot (Binance, Coinbase, OKX), and the positions of the largest Hyperliquid accounts on BTC and ETH, compared with retail flow.',
}

// Premier rendu côté serveur, renouvelé chaque minute ; la page se met ensuite à jour seule.
export const revalidate = 60

export default async function MarketFlowPage() {
  const initial = await getFlow('BTC', '24h')
  return (
    <div className="s-page">
      <SiteHeader />
      <main className="s-main">
        <section className="s-hero s-hero-simple">
          <p className="s-eyebrow">Market Flow</p>
          <h1 className="s-h1">Whales vs retail</h1>
          <p className="s-sub">Who is pushing Bitcoin and Ether right now. Aggressive buying and selling by order size on the main perpetual and spot exchanges, next to the positions held by the largest accounts on Hyperliquid.</p>
        </section>

        <section className="s-section mf-section">
          <MarketFlow initial={initial} />
        </section>

        <Section id="method" eyebrow="Method" title="How to read this page">
          <div className="s-grid2">
            <div className="s-card">
              <div className="s-card-k">Order flow</div>
              <h3>Cumulative volume delta (CVD)</h3>
              <p>Every trade has an aggressor: the side that crossed the spread with a market order. Fills of the same market order are merged, then sorted by size. CVD adds aggressive buys and subtracts aggressive sells over the window.</p>
              <p><strong>Perpetuals</strong> (Binance, Bybit, OKX) and <strong>spot</strong> (Binance, Coinbase, OKX) are counted separately and never added together: spot buying is cash demand for the coin, perpetual buying is mostly leveraged positioning. Spot data starts in October 2026.</p>
              <p><strong>Retail</strong> means market orders under $10,000. <strong>Large orders</strong> are $100,000 and more, with $1M and more shown separately. A large order is not necessarily a whale with a view on direction: it can be market making, hedging or arbitrage.</p>
            </div>
            <div className="s-card">
              <div className="s-card-k">Positions</div>
              <h3>Hyperliquid whales</h3>
              <p>Hyperliquid publishes every account&apos;s positions. The collector discovers accounts from the public trade feed, reads their positions continuously and keeps them up to date between readings from their trades. A whale is an account holding $500,000 or more on the asset; a giant, $5M or more.</p>
              <p>Changes count only from the first reading onwards: an account discovered with an existing position adds to the stock, never to the flow. Coverage shows how much of Hyperliquid&apos;s open interest the tracked accounts hold.</p>
            </div>
            <div className="s-card">
              <div className="s-card-k">Comparison</div>
              <h3>Divergence</h3>
              <p>For each group, the imbalance is net aggressive volume divided by the group&apos;s total volume. Divergence is half the difference between the large-order and retail imbalances, in points. Beyond ±6 points the page reports a divergence, provided both groups traded enough volume ($2M of large orders, $200k of retail over the window).</p>
            </div>
            <div className="s-card">
              <div className="s-card-k">Limits</div>
              <h3>What this does not show</h3>
              <p>Spot markets, other derivatives venues and over-the-counter flow are not included, and Hyperliquid is one venue among many. The readings describe what happened; they are not a forecast and not a trading signal. Times are UTC.</p>
            </div>
          </div>
        </Section>

        <div className="s-disclaimer">
          <p><strong>Important information.</strong> Market Flow shows public market data collected and aggregated by ShadowMarketPro, delayed by up to a few minutes and provided as is, without guarantee of completeness or accuracy. Nothing on this page is investment advice, a recommendation, or an offer or solicitation to buy or sell any financial instrument.</p>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
