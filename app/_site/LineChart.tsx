'use client'

// Courbes journalières sur un seul axe vertical, avec curseur et infobulle (toutes les séries à la
// date survolée). Rendu SVG côté serveur puis interactif dans le navigateur.

import { useEffect, useRef, useState } from 'react'

export interface LineSeries {
  name: string
  color: string
  values: number[]
}

const DAY = 864e5
const MINUS = '−'

function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target)
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
}
function linearTicks(lo: number, hi: number, target = 5) {
  const st = niceStep(hi - lo, target)
  const out: number[] = []
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v)
  return out
}
function logTicks(lo: number, hi: number) {
  const out: number[] = []
  for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) for (const m of [1, 2, 5]) { const v = m * 10 ** e; if (v >= lo && v <= hi) out.push(v) }
  return out
}
const minus = (s: string) => s.replace(/^-/, MINUS)

export function format(v: number, fmt: 'pct' | 'num' | 'idx', d?: number) {
  if (!Number.isFinite(v)) return '—'
  if (fmt === 'pct') return minus(`${(v * 100).toFixed(d ?? 1)}%`)
  if (fmt === 'idx') return Math.round(v).toLocaleString('en-US')
  return minus(v.toFixed(d ?? 2))
}

export default function LineChart(o: {
  title: string; start: string; series: LineSeries[]; fmt: 'pct' | 'num' | 'idx'; log?: boolean; height?: number
  yMin?: number; yMax?: number; refs?: { y: number; label?: string }[]; area?: boolean; endLabels?: boolean
  /** Jours entre deux points (séries échantillonnées). */
  step?: number
}) {
  const [hover, setHover] = useState<{ k: number; left: number; top: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  // Largeur réelle du conteneur : le SVG est dessiné à sa taille, les textes gardent leur corps.
  const [W, setW] = useState(760)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(e => setW(Math.max(300, Math.round(e[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const narrow = W < 560
  const H = Math.round((o.height ?? 300) * (narrow ? 0.8 : 1))
  const showEnd = o.endLabels !== false && !narrow
  const m = { l: narrow ? 44 : 54, r: showEnd ? 104 : 14, t: 12, b: 26 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const n = o.series[0].values.length
  const all = o.series.flatMap(s => s.values.filter(Number.isFinite))
  let lo = o.yMin ?? Math.min(...all), hi = o.yMax ?? Math.max(...all)
  for (const r of o.refs ?? []) { lo = Math.min(lo, r.y); hi = Math.max(hi, r.y) }
  if (!o.log) { const pad = (hi - lo) * 0.04; if (o.yMin === undefined) lo -= pad; if (o.yMax === undefined) hi += pad }
  const tf = (v: number) => (o.log ? Math.log(v) : v)
  const y = (v: number) => m.t + ph - ((tf(v) - tf(lo)) / (tf(hi) - tf(lo))) * ph
  const x = (i: number) => m.l + (i / (n - 1)) * pw
  const step = o.step ?? 1
  const d0 = Date.parse(o.start + 'T00:00:00Z')
  const dateOf = (i: number) => new Date(d0 + i * step * DAY).toISOString().slice(0, 10)
  const ticks = o.log ? logTicks(lo, hi) : linearTicks(lo, hi, 5)
  const tickFmt = (v: number) => (o.fmt === 'pct' ? minus(`${Math.round(v * 100)}%`) : o.fmt === 'idx' ? Math.round(v).toLocaleString('en-US') : minus(v.toFixed(1)))
  const years: { i: number; y: number }[] = []
  const y0 = new Date(d0).getUTCFullYear(), y1 = new Date(d0 + (n - 1) * step * DAY).getUTCFullYear()
  for (let yr = y0 + 1; yr <= y1; yr++) years.push({ i: (Date.UTC(yr, 0, 1) - d0) / (step * DAY), y: yr })
  const path = (vals: number[]) => {
    let d = '', pen = false
    vals.forEach((v, i) => { if (!Number.isFinite(v)) { pen = false; return } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(Math.max(v, lo)).toFixed(1)}`; pen = true })
    return d
  }
  const ends = o.series.map(s => { let i = n - 1; while (i > 0 && !Number.isFinite(s.values[i])) i--; return { s, v: s.values[i], py: y(s.values[i]) } }).sort((a, b) => a.py - b.py)
  const clear = ends.every((e, i) => i === 0 || e.py - ends[i - 1].py >= 15)
  const last = o.series[o.series.length - 1]

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const k = Math.round(((px - m.l) / pw) * (n - 1))
    if (k < 0 || k >= n) { setHover(null); return }
    const b = box.current?.getBoundingClientRect()
    setHover({ k, left: e.clientX - (b?.left ?? 0), top: e.clientY - (b?.top ?? 0) })
  }

  return (
    <div className="s-chart" ref={box}>
      {o.series.length > 1 && (
        <div className="s-legend">{o.series.map(s => <span key={s.name}><i className="s-key s-key-line" style={{ background: s.color }} />{s.name}</span>)}</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={o.title} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={`t${v}`}>
            <line className="s-grid" x1={m.l} x2={m.l + pw} y1={y(v)} y2={y(v)} />
            <text className="s-tick" x={m.l - 8} y={y(v) + 4} textAnchor="end">{tickFmt(v)}</text>
          </g>
        ))}
        {years.map(t => (
          <g key={`y${t.y}`}>
            <line className="s-grid" x1={x(t.i)} x2={x(t.i)} y1={m.t} y2={m.t + ph} />
            {(!narrow || t.y % 2 === 0) && <text className="s-tick" x={x(t.i)} y={H - 8} textAnchor="middle">{narrow ? `’${String(t.y).slice(2)}` : t.y}</text>}
          </g>
        ))}
        {(o.refs ?? []).map(r => (
          <g key={`r${r.y}`}>
            <line className="s-ref" x1={m.l} x2={m.l + pw} y1={y(r.y)} y2={y(r.y)} />
            {r.label && <text className="s-reflabel" x={m.l + 6} y={y(r.y) - 5}>{r.label}</text>}
          </g>
        ))}
        {o.area && <path className="s-area" style={{ fill: last.color }} d={`${path(last.values)}L${x(n - 1).toFixed(1)} ${y(0).toFixed(1)}L${x(0).toFixed(1)} ${y(0).toFixed(1)}Z`} />}
        {o.series.map(s => <path key={s.name} className="s-line" style={{ stroke: s.color }} d={path(s.values)} />)}
        {showEnd && ends.map(e => (
          <g key={`e${e.s.name}`}>
            <circle className="s-dot" cx={m.l + pw} cy={e.py} r={4} style={{ fill: e.s.color }} />
            {clear && <text className="s-endlabel" x={m.l + pw + 9} y={e.py + 4}>{e.s.name} {format(e.v, o.fmt, o.fmt === 'pct' ? 0 : undefined)}</text>}
          </g>
        ))}
        <line className="s-axis" x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} />
        {hover && <line className="s-cross" x1={x(hover.k)} x2={x(hover.k)} y1={m.t} y2={m.t + ph} />}
      </svg>
      {hover && (
        <div className="s-tip" style={{ left: Math.min(hover.left + 14, (box.current?.clientWidth ?? 600) - 180), top: Math.max(0, hover.top - 40) }}>
          <div className="s-tip-date">{dateOf(hover.k)}</div>
          {o.series.map(s => (
            <div className="s-tip-row" key={s.name}>
              <span className="s-tip-name"><i className="s-key s-key-line" style={{ background: s.color }} />{s.name}</span>
              <span className="s-tip-val">{format(s.values[hover.k], o.fmt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
