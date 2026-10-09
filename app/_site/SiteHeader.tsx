'use client'

// En-tête commun : logo, quatre entrées (le Shock Engine d'abord), menu sur mobile.

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogoSVG } from '../components/Logo'

// Performance et Research ne sont pas dans le menu : on y accède depuis la page Shock Engine, dont
// l'onglet reste actif sur ces pages.
const LINKS: { href: string; label: string; match?: (p: string) => boolean }[] = [
  { href: '/shock-engine', label: 'Shock Engine', match: p => p.startsWith('/shock-engine') || p.startsWith('/research') },
  { href: '/backtest', label: 'Backtest' },
  { href: '/trading-tools', label: 'Trading Tools' },
  { href: '/institutional', label: 'Institutional' },
]

export default function SiteHeader() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  useEffect(() => setOpen(false), [path])
  const active = (l: (typeof LINKS)[number]) => (l.match ? l.match(path) : path === l.href || path.startsWith(l.href + '/'))
  return (
    <header className={`s-header${scrolled || open ? ' s-header-solid' : ''}`}>
      <div className="s-header-in">
        <Link href="/" className="s-brand" aria-label="ShadowMarketPro home">
          <LogoSVG />
          <span className="s-brand-name">ShadowMarket<em>Pro</em><sup>™</sup></span>
        </Link>
        <nav className="s-nav" aria-label="Main">
          {LINKS.map(l => <Link key={l.href} href={l.href} className={active(l) ? 's-active' : undefined} aria-current={active(l) ? 'page' : undefined}>{l.label}</Link>)}
        </nav>
        <button type="button" className="s-menu-btn" aria-expanded={open} aria-controls="s-mobile-nav" onClick={() => setOpen(v => !v)}>
          <span className="s-sr">Menu</span>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>
      {open && (
        <nav id="s-mobile-nav" className="s-mobile-nav" aria-label="Main">
          {LINKS.map(l => <Link key={l.href} href={l.href} className={active(l) ? 's-active' : undefined} onClick={() => setOpen(false)}>{l.label}</Link>)}
        </nav>
      )}
    </header>
  )
}
