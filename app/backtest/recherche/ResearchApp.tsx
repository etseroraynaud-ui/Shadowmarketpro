'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LogoSVGSmall } from '../../components/Logo'
import Markdown from './Markdown'

interface Entry {
  file: string
  title: string
  group: string
  tf: number
}

const GROUPS: [string, string][] = [
  ['synthese', 'Synthèse'],
  ['diagnostic', 'Diagnostics'],
  ['walkforward', 'Walk-forward'],
  ['regimes', 'Paramètres par régime'],
  ['autre', 'Autres'],
]

/** Libellé court d'un rapport dans la liste. */
function shortTitle(e: Entry): string {
  if (e.group === 'synthese') return 'Synthèse de la recherche'
  const f = e.file
  const tf = `${e.tf} min`
  if (e.group === 'diagnostic') return `Diagnostic ${tf}`
  const tags: string[] = []
  if (f.includes('reduced')) tags.push('espace réduit')
  if (f.includes('train24')) tags.push('24 mois')
  if (f.includes('-trend')) tags.push('tendance seule')
  if (f.includes('-vol')) tags.push('volatilité seule')
  if (f.includes('-menu')) tags.push('menu court')
  if (f.includes('realistic')) tags.push('frais réalistes')
  const seed = f.match(/seed(\d+)/)
  if (seed) tags.push(`tirage ${seed[1]}`)
  if (e.group === 'regimes' && !tags.some(x => x.includes('seule') || x.includes('menu'))) tags.unshift('6 régimes')
  return `${tf}${tags.length ? ' · ' + tags.join(', ') : ''}`
}

export default function ResearchApp() {
  const [index, setIndex] = useState<Entry[]>([])
  const [file, setFile] = useState('SYNTHESE.md')
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/backtest/reports/index.json')
      .then(r => r.json())
      .then((x: Entry[]) => setIndex(x))
      .catch(e => setError(String(e)))
    const h = decodeURIComponent(window.location.hash.slice(1))
    if (h.endsWith('.md')) setFile(h)
  }, [])

  useEffect(() => {
    // Un rapport demandé plus tôt peut répondre après celui-ci : sa réponse est ignorée.
    let stale = false
    setText('')
    setError(null)
    fetch(`/backtest/reports/${file}`)
      .then(r => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(x => { if (!stale) setText(x) })
      .catch(e => { if (!stale) setError(String(e)) })
    return () => { stale = true }
  }, [file])

  const choose = (f: string) => {
    setFile(f)
    history.replaceState(null, '', `#${f}`)
    window.scrollTo({ top: 0 })
  }

  const open = (href: string) => {
    const f = href.replace(/^.*\//, '')
    if (f.endsWith('.md')) choose(f)
  }

  return (
    <div className="bt-app">
      <header className="bt-header">
        <div className="bt-header-in">
          <Link href="/" className="bt-brand">
            <LogoSVGSmall className="bt-logo" />
            <span>ShadowMarket<em>Pro</em></span>
          </Link>
          <span className="bt-header-sep">/</span>
          <Link href="/backtest" className="bt-header-title bt-link-plain">Backtest Lab</Link>
          <span className="bt-header-sep">/</span>
          <span className="bt-header-title">Recherche</span>
          <div className="bt-header-right">
            <Link href="/backtest" className="bt-link">← Backtest Lab</Link>
          </div>
        </div>
      </header>

      <div className="bt-intro">
        <h1>Shock Engine · recherche</h1>
        <p>Tous les résultats de la recherche sur ta stratégie, sur BTC/USD de 2017 à 2026 : diagnostic, optimisation walk-forward, paramètres par régime de marché. Les préréglages sont testables dans Backtest Lab, onglet « Shock Engine ».</p>
      </div>

      <main className="bt-main rp-main">
        <aside className="bt-side rp-side">
          {GROUPS.map(([g, label]) => {
            const items = index.filter(e => e.group === g)
            if (!items.length) return null
            return (
              <section key={g} className="bt-card rp-group">
                <h2>{label}</h2>
                <div className="bt-list">
                  {items.map(e => (
                    <button key={e.file} className={`bt-list-item${e.file === file ? ' on' : ''}`} onClick={() => choose(e.file)}>
                      <span>{shortTitle(e)}</span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
          <Link href="/backtest" className="bt-btn bt-btn-primary">Tester dans Backtest Lab</Link>
        </aside>
        <section className="bt-content">
          <article className="bt-card rp-article">
            {error && <div className="bt-error">{error}</div>}
            {text ? <Markdown text={text} onLink={open} /> : !error && <p className="bt-muted">Chargement…</p>}
          </article>
        </section>
      </main>

      <footer className="bt-footer">
        <p>Résultats de backtest sur données historiques Bitstamp. Les performances passées ne préjugent pas des performances futures. Outil d&apos;analyse, pas un conseil en investissement.</p>
      </footer>
    </div>
  )
}
