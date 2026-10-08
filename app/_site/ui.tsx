// Éléments communs des pages de recherche : bandeau « simulation historique », tuiles de chiffres,
// tableaux, encadrés de statut et pied de page.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { LogoSVGSmall } from '../components/Logo'

/** Bandeau sous l'en-tête : rappelle que les chiffres de la page sont simulés. */
export function SimBar({ children }: { children?: ReactNode }) {
  return <div className="s-simbar" role="note">{children ?? 'Historical simulation after modeled transaction costs · not live performance'}</div>
}

/** Étiquette courte à côté d'un chiffre ou d'un titre. */
export function SimTag({ label = 'Historical simulation' }: { label?: string }) {
  return <span className="s-tag">{label}</span>
}

export function Tiles({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="s-tiles">
      {items.map(t => (
        <div className="s-tile" key={t.label}>
          <div className="s-tile-l">{t.label}</div>
          <div className="s-tile-v">{t.value}</div>
          {t.sub && <div className="s-tile-s">{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}

/** Tableau : première colonne en texte, les autres alignées à droite (sauf `text`). */
export function Table({ head, rows, text, caption, compact }: { head: ReactNode[]; rows: ReactNode[][]; text?: boolean; caption?: string; compact?: boolean }) {
  return (
    <div className="s-tw">
      <table className={`s-table${text ? ' s-table-text' : ''}${compact ? ' s-table-compact' : ''}`}>
        {caption && <caption>{caption}</caption>}
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  )
}

/** Pastille de série suivie de son nom. */
export function Key({ color, children }: { color: string; children: ReactNode }) {
  return <span className="s-nw"><i className="s-key" style={{ background: color }} />{children}</span>
}

export function Section({ id, eyebrow, title, intro, children }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="s-section" id={id}>
      {eyebrow && <p className="s-eyebrow">{eyebrow}</p>}
      <h2 className="s-h2">{title}</h2>
      {intro && <div className="s-intro">{intro}</div>}
      {children}
    </section>
  )
}

/** Deux encadrés côte à côte : ce qui est simulé, ce qui est réel. */
export function StatusBoxes({ period }: { period: string }) {
  return (
    <div className="s-status">
      <div className="s-status-box s-status-hist">
        <div className="s-status-h">Historical simulation</div>
        <p>Frozen rules replayed on historical 15-minute bars, {period}, with a commission of 0.045 % per order. Slippage, funding and market impact are not modeled.</p>
      </div>
      <div className="s-status-box s-status-live">
        <div className="s-status-h">Live / forward results</div>
        <p>None yet. No figure on this page comes from live trading, paper trading or a forward test. The live track record will be published on the <Link href="/live">Live</Link> page, from its own start date, and never blended with the simulation.</p>
      </div>
    </div>
  )
}

export function Disclaimer() {
  return (
    <div className="s-disclaimer">
      <p><strong>Important information.</strong> All performance figures on this site are hypothetical: they come from a historical simulation of fixed rules, after modeled commissions, and do not represent actual trading. Simulated results have inherent limitations. They benefit from hindsight in the design of the rules, they do not reflect slippage, market impact, funding, liquidity or execution delays in live markets, and they can differ materially from results actually achieved. Past performance, simulated or real, does not predict future results. Crypto-assets are highly volatile and you can lose all of the capital you commit.</p>
      <p>Nothing on this site is investment advice, a recommendation, or an offer or solicitation to buy or sell any financial instrument or to provide investment management services.</p>
    </div>
  )
}

export function SiteFooter() {
  return (
    <footer className="s-footer">
      <div className="s-footer-in">
        <div className="s-footer-brand">
          <Link href="/" className="s-brand">
            <LogoSVGSmall />
            <span className="s-brand-name">ShadowMarket<em>Pro</em><sup>™</sup></span>
          </Link>
          <p>Systematic trading research and quantitative indicators.</p>
        </div>
        <div>
          <h4>Research</h4>
          <ul>
            <li><Link href="/shock-engine">Shock Engine</Link></li>
            <li><Link href="/shock-engine/portfolio">BTC/ETH Portfolio</Link></li>
            <li><Link href="/research">Research</Link></li>
            <li><Link href="/live">Live track record</Link></li>
            <li><Link href="/institutional">Institutional</Link></li>
          </ul>
        </div>
        <div>
          <h4>Indicators</h4>
          <ul>
            <li><Link href="/#indicators">TradingView indicators</Link></li>
            <li><Link href="/#pricing">Pricing</Link></li>
            <li><Link href="/backtest">Backtest Lab</Link></li>
            <li><Link href="/payment">Pay with crypto (USDT BEP20 / TRC20)</Link></li>
          </ul>
        </div>
      </div>
      <div className="s-footer-legal">
        <p>Performance figures on this site come from historical simulations, not live trading. ShadowMarketPro™ indicators are decision-support tools. Nothing here is financial advice or a guarantee of results. Trade at your own risk.</p>
        <p>© 2026 ShadowMarketPro™</p>
      </div>
    </footer>
  )
}
