'use client'

// Petits composants interactifs : sous-navigation qui suit la section visible, panneau de courbes
// avec choix des séries, compteur discret des chiffres clés.

import { useEffect, useRef, useState } from 'react'
import LineChart from './LineChart'
import type { LineSeries } from './LineChart'

/** Sous-navigation collante ; la section visible est mise en avant. */
export function SubNav({ items }: { items: { id: string; label: string }[] }) {
  const [on, setOn] = useState(items[0]?.id)
  useEffect(() => {
    const els = items.map(i => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e)
    const io = new IntersectionObserver(es => {
      const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setOn(vis[0].target.id)
    }, { rootMargin: '-130px 0px -55% 0px' })
    els.forEach(e => io.observe(e))
    return () => io.disconnect()
  }, [items])
  return (
    <nav className="s-subnav" aria-label="On this page">
      <div className="s-subnav-in">
        {items.map(i => <a key={i.id} href={`#${i.id}`} className={on === i.id ? 's-on' : undefined} aria-current={on === i.id ? 'true' : undefined}>{i.label}</a>)}
      </div>
    </nav>
  )
}

/** Courbes avec choix des séries affichées (toutes, ou une seule). */
export function SeriesPanel({ title, sub, series, start, step, fmt, log, area, height, yMax, yMin, defaultKey = 'all', endLabels, refs }: {
  title: string; sub?: string; series: LineSeries[]; start: string; step?: number; fmt: 'pct' | 'num' | 'idx'; log?: boolean; area?: boolean; height?: number
  yMax?: number; yMin?: number; defaultKey?: string; endLabels?: boolean; refs?: { y: number; label?: string }[]
}) {
  const [k, setK] = useState(defaultKey)
  const shown = k === 'all' ? series : series.filter(s => s.name === k)
  return (
    <div className="s-panel">
      <div className="s-panel-head">
        <div><h3 className="s-panel-t">{title}</h3>{sub && <p className="s-panel-s">{sub}</p>}</div>
        {series.length > 1 && (
          <div className="s-seg" role="group" aria-label="Series">
            {['all', ...series.map(s => s.name)].map(x => <button key={x} type="button" aria-pressed={k === x} onClick={() => setK(x)}>{x === 'all' ? 'All' : x}</button>)}
          </div>
        )}
      </div>
      <LineChart title={title} start={start} step={step} fmt={fmt} log={log} area={area && shown.length === 1} height={height} yMax={yMax} yMin={yMin} series={shown} endLabels={endLabels} refs={refs} />
    </div>
  )
}

/** Chiffre qui monte jusqu'à sa valeur quand il apparaît (rendu serveur : la valeur finale). */
export function CountUp({ value, decimals = 2, prefix = '', suffix = '', percent = false }: { value: number; decimals?: number; prefix?: string; suffix?: string; percent?: boolean }) {
  const fmt = (x: number) => { const v = percent ? x * 100 : x; return `${v < 0 ? '−' : ''}${prefix}${Math.abs(v).toFixed(decimals)}${suffix}` }
  const [txt, setTxt] = useState(fmt(value))
  const el = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!el.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const t0 = performance.now(), dur = 900
      const tick = (t: number) => { const p = Math.min(1, (t - t0) / dur), q = 1 - Math.pow(1 - p, 3); setTxt(fmt(value * q)); if (p < 1) raf = requestAnimationFrame(tick) }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.6 })
    io.observe(el.current)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return <span ref={el} className="s-num">{txt}</span>
}
