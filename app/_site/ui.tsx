// Éléments communs des pages Shock Engine, Performance, Research, Institutional et Trading Tools :
// sections, bandes de chiffres, cartes, tableaux (en fiches sur mobile), statut, avertissements.
import Link from 'next/link'
import type { ReactNode } from 'react'
import { LogoSVGSmall } from '../components/Logo'
import { SIM } from './data'

/** Bandeau sous l'en-tête des pages de détail : rappelle que les chiffres sont simulés. */
export function SimBar({ children }: { children?: ReactNode }) {
  return <div className="s-simbar" role="note">{children ?? SIM}</div>
}

/** Étiquette courte « Historical simulation ». */
export function SimTag({ label = 'Historical simulation' }: { label?: string }) {
  return <span className="s-tag">{label}</span>
}

/** Ligne discrète sous les chiffres clés : la mention exacte, sans transformer la page en avertissement. */
export function SimNote({ children }: { children?: ReactNode }) {
  return <p className="s-simnote">{children ?? SIM}</p>
}

export function Arrow() {
  return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
}

export function Section({ id, eyebrow, title, intro, children, head }: { id?: string; eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode; head?: ReactNode }) {
  return (
    <section className="s-section s-anchor" id={id}>
      <div className="s-section-head s-reveal">
        <div>
          {eyebrow && <p className="s-eyebrow">{eyebrow}</p>}
          <h2 className="s-h2">{title}</h2>
          {intro && <div className="s-intro">{intro}</div>}
        </div>
        {head}
      </div>
      {children}
    </section>
  )
}

/** Grands chiffres sous le héros. */
export function Kpis({ items }: { items: { label: string; value: ReactNode; sub?: string; accent?: boolean }[] }) {
  return (
    <div className="s-kpis s-reveal">
      {items.map(k => (
        <div className="s-kpi" key={k.label}>
          <div className="s-kpi-l">{k.label}</div>
          <div className={`s-kpi-v${k.accent ? ' s-pos' : ''}`}>{k.value}</div>
          {k.sub && <div className="s-kpi-s">{k.sub}</div>}
        </div>
      ))}
    </div>
  )
}

/** Cartes de métriques compactes. */
export function Metrics({ items }: { items: { label: string; value: string; sub?: string }[] }) {
  return (
    <div className="s-metrics">
      {items.map(t => (
        <div className="s-metric" key={t.label}>
          <div className="s-metric-l">{t.label}</div>
          <div className="s-metric-v">{t.value}</div>
          {t.sub && <div className="s-metric-s">{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}

export type VerdictKind = 'pass' | 'partial' | 'fail' | 'pending' | 'na'
export function Verdict({ kind, children }: { kind: VerdictKind; children: ReactNode }) {
  return <span className={`s-verdict s-verdict-${kind}`}>{children}</span>
}

/** Carte de preuve : statistique clé, interprétation, lien vers la recherche. */
export function EvidenceCard({ k, stat, sub, verdict, children, href = '/research', link = 'Research' }: { k: string; stat: ReactNode; sub?: string; verdict?: { kind: VerdictKind; label: string }; children: ReactNode; href?: string; link?: string }) {
  return (
    <div className="s-card s-card-hover s-ev s-reveal">
      <div className="s-card-k" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>{k}{verdict && <Verdict kind={verdict.kind}>{verdict.label}</Verdict>}</div>
      <div className="s-card-stat">{stat}{sub && <small>{sub}</small>}</div>
      <p>{children}</p>
      <div className="s-card-foot"><Link className="s-arrow" href={href}>{link}</Link></div>
    </div>
  )
}

/** Liste de statut : ce qui est fait, en attente, absent. */
export function StatusList({ items }: { items: { label: string; state: 'ok' | 'wait' | 'no'; note: string }[] }) {
  const ico = { ok: '✓', wait: '…', no: '–' }
  return (
    <ul className="s-status-list s-reveal">
      {items.map(i => (
        <li key={i.label}>
          <span className="s-status-name"><span className={`s-status-ico ${i.state}`} aria-hidden="true">{ico[i.state]}</span>{i.label}</span>
          <span className="s-status-note">{i.note}</span>
        </li>
      ))}
    </ul>
  )
}

/** Tableau : première colonne en libellé ; `stack` : en fiches libellé : valeur sur mobile. */
export function Table({ head, rows, text, caption, compact, stack }: { head: string[]; rows: ReactNode[][]; text?: boolean; caption?: string; compact?: boolean; stack?: boolean }) {
  return (
    <div className={`s-tw${stack ? ' s-tw-stack' : ''}`}>
      <table className={`s-table${text ? ' s-table-text' : ''}${compact ? ' s-table-compact' : ''}`}>
        {caption && <caption>{caption}</caption>}
        <thead><tr>{head.map((h, i) => <th key={i} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => (j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j} data-label={head[j]}>{c}</td>))}</tr>)}</tbody>
      </table>
    </div>
  )
}

/** Pastille de série suivie de son nom. */
export function Key({ color, children }: { color: string; children: ReactNode }) {
  return <span className="s-nw"><i className="s-key" style={{ background: color }} />{children}</span>
}

/** Appel final vers la recherche. */
export function CtaBand({ title, children, actions }: { title: string; children?: ReactNode; actions: ReactNode }) {
  return (
    <section className="s-section">
      <div className="s-cta s-reveal">
        <p className="s-eyebrow">Research</p>
        <h2 className="s-h2">{title}</h2>
        {children && <p className="s-p s-center">{children}</p>}
        <div className="s-actions">{actions}</div>
      </div>
    </section>
  )
}

export function Disclaimer() {
  return (
    <div className="s-disclaimer">
      <p><strong>Important information.</strong> All performance figures on this site are hypothetical: they come from a historical simulation of fixed rules, after modeled commissions, and do not represent actual trading. Simulated results have inherent limitations. They benefit from hindsight in the design of the rules, they do not reflect slippage, funding, market impact or the liquidity of a real account, and past simulated performance does not predict future results.</p>
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
          <p>Systematic trading research and quantitative trading tools.</p>
        </div>
        <div>
          <h3>Shock Engine</h3>
          <ul>
            <li><Link href="/shock-engine">Overview</Link></li>
            <li><Link href="/shock-engine/portfolio">Performance</Link></li>
            <li><Link href="/research">Research</Link></li>
            <li><Link href="/live">Live track record</Link></li>
          </ul>
        </div>
        <div>
          <h3>Trading Tools</h3>
          <ul>
            <li><Link href="/trading-tools">TradingView indicators</Link></li>
            <li><Link href="/trading-tools#pricing">Pricing</Link></li>
            <li><Link href="/backtest">Backtest Lab</Link></li>
            <li><Link href="/payment">Pay with crypto</Link></li>
          </ul>
        </div>
        <div>
          <h3>Company</h3>
          <ul>
            <li><Link href="/institutional">Institutional</Link></li>
            <li><Link href="/research#versions">Versions and manifest</Link></li>
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
