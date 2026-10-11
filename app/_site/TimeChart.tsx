'use client'

// Courbes et barres sur un axe de temps (secondes UTC, pas régulier), un seul axe vertical, avec
// curseur et infobulle. Pendant intrajournalier de LineChart (qui compte en jours).

import { useEffect, useRef, useState } from 'react'

export interface TimeSeries {
  name: string
  color: string
  values: (number | null)[]
  /** Trait pointillé (sous-ensemble d'une autre série, par exemple). */
  dash?: boolean
  /** Barres depuis zéro au lieu d'une courbe. */
  bar?: boolean
  /** Valeur affichée dans l'infobulle et l'étiquette (par défaut : la valeur tracée). */
  label?: (v: number) => string
}

export type TimeFmt = 'usd' | 'price' | 'pct'
const MINUS = '−'

export function fmtValue(v: number | null | undefined, fmt: TimeFmt, signed = false): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  const s = v < 0 ? MINUS : signed && v > 0 ? '+' : ''
  const a = Math.abs(v)
  if (fmt === 'pct') return `${s}${a.toFixed(a >= 10 ? 0 : 1)}%`
  if (fmt === 'price') return `${s}$${a.toLocaleString('en-US', { maximumFractionDigits: a >= 1000 ? 0 : 2 })}`
  return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(0)}k` : `${s}$${a.toFixed(0)}`
}

function niceStep(span: number, target: number) {
  const raw = span / Math.max(1, target)
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const m = raw / p
  return (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p
}
function yTicks(lo: number, hi: number, target = 4) {
  const st = niceStep(hi - lo || Math.abs(hi) || 1, target)
  const out: number[] = []
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v)
  return out
}
const HOUR = 3600, DAY = 86400
/** Graduations de temps : heures rondes sur 1 jour, jours sur une semaine, etc. (UTC). */
function xTicks(t0: number, t1: number, narrow: boolean) {
  const span = t1 - t0
  const steps = [HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, DAY, 2 * DAY, 5 * DAY, 7 * DAY]
  const want = narrow ? 4 : 7
  const st = steps.find(s => span / s <= want) ?? 7 * DAY
  const out: number[] = []
  for (let x = Math.ceil(t0 / st) * st; x <= t1; x += st) out.push(x)
  return { ticks: out, daily: st >= DAY }
}
const pad2 = (n: number) => String(n).padStart(2, '0')
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const hhmm = (t: number) => { const d = new Date(t * 1000); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}` }
const dayLabel = (t: number) => { const d = new Date(t * 1000); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }

export default function TimeChart(o: {
  title: string; t: number[]; step: number; series: TimeSeries[]; fmt: TimeFmt; height?: number
  /** Ligne de référence à zéro (séries signées). */
  zero?: boolean; signed?: boolean; endLabels?: boolean
}) {
  const [hover, setHover] = useState<{ k: number; left: number; top: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(760)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(e => setW(Math.max(300, Math.round(e[0].contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const n = o.t.length
  const all = o.series.flatMap(s => s.values.filter((v): v is number => v !== null && Number.isFinite(v)))
  if (!n || !all.length) return <div className="s-chart s-chart-empty">No data in this range yet.</div>

  const narrow = W < 560
  const H = Math.round((o.height ?? 260) * (narrow ? 0.82 : 1))
  const labels = o.endLabels !== false && !narrow && o.series.filter(s => !s.bar).length <= 4
  const m = { l: narrow ? 50 : 62, r: labels ? 112 : 14, t: 12, b: 26 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  let lo = Math.min(...all), hi = Math.max(...all)
  if (o.zero || o.series.some(s => s.bar)) { lo = Math.min(lo, 0); hi = Math.max(hi, 0) }
  const padY = (hi - lo || Math.abs(hi) || 1) * 0.06
  lo -= o.zero || lo < 0 ? padY : lo === 0 ? 0 : padY
  hi += padY
  const y = (v: number) => m.t + ph - ((v - lo) / (hi - lo)) * ph
  const t0 = o.t[0], t1 = o.t[n - 1] + o.step
  const x = (tt: number) => m.l + ((tt - t0) / (t1 - t0)) * pw
  const xc = (k: number) => x(o.t[k] + o.step / 2)
  const ticks = yTicks(lo, hi, narrow ? 3 : 4)
  const { ticks: xt, daily } = xTicks(t0, t1, narrow)
  const path = (vals: (number | null)[]) => {
    let d = '', pen = false
    vals.forEach((v, k) => { if (v === null || !Number.isFinite(v)) { pen = false; return } d += `${pen ? 'L' : 'M'}${xc(k).toFixed(1)} ${y(v).toFixed(1)}`; pen = true })
    return d
  }
  const bw = Math.max(1, (pw / n) * 0.72)
  const lines = o.series.filter(s => !s.bar)
  const ends = lines.map(s => { let k = n - 1; while (k > 0 && (s.values[k] === null || !Number.isFinite(s.values[k]!))) k--; const v = s.values[k]; return { s, v, py: v === null ? 0 : y(v) } })
    .filter(e => e.v !== null).sort((a, b) => a.py - b.py)
  for (let i = 1; i < ends.length; i++) if (ends[i].py - ends[i - 1].py < 15) ends[i].py = ends[i - 1].py + 15

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    const k = Math.floor(((px - m.l) / pw) * n)
    if (k < 0 || k >= n) { setHover(null); return }
    const b = box.current?.getBoundingClientRect()
    setHover({ k, left: e.clientX - (b?.left ?? 0), top: e.clientY - (b?.top ?? 0) })
  }
  const show = (s: TimeSeries, v: number | null) => (v === null ? '—' : s.label ? s.label(v) : fmtValue(v, o.fmt, o.signed))

  return (
    <div className="s-chart" ref={box}>
      {o.series.length > 1 && (
        <div className="s-legend">{o.series.map(s => <span key={s.name}><i className={`s-key ${s.bar ? 's-key-bar' : 's-key-line'}`} style={{ background: s.dash ? `repeating-linear-gradient(90deg, ${s.color} 0 4px, transparent 4px 7px)` : s.color }} />{s.name}</span>)}</div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={o.title} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map(v => (
          <g key={`t${v}`}>
            <line className="s-grid" x1={m.l} x2={m.l + pw} y1={y(v)} y2={y(v)} />
            <text className="s-tick" x={m.l - 8} y={y(v) + 4} textAnchor="end">{fmtValue(v, o.fmt)}</text>
          </g>
        ))}
        {xt.map(tt => (
          <g key={`x${tt}`}>
            <line className="s-grid" x1={x(tt)} x2={x(tt)} y1={m.t} y2={m.t + ph} />
            <text className="s-tick" x={x(tt)} y={H - 8} textAnchor="middle">{daily ? dayLabel(tt) : hhmm(tt) === '00:00' ? dayLabel(tt) : hhmm(tt)}</text>
          </g>
        ))}
        {(o.zero || lo < 0) && <line className="s-ref" x1={m.l} x2={m.l + pw} y1={y(0)} y2={y(0)} />}
        {o.series.filter(s => s.bar).map(s => (
          <g key={s.name} style={{ fill: s.color }}>
            {s.values.map((v, k) => (v === null || !v ? null : <rect key={k} x={xc(k) - bw / 2} width={bw} y={Math.min(y(0), y(v))} height={Math.max(1, Math.abs(y(v) - y(0)))} rx={bw > 4 ? 1.5 : 0} />))}
          </g>
        ))}
        {lines.map(s => <path key={s.name} className="s-line" style={{ stroke: s.color, strokeDasharray: s.dash ? '5 4' : undefined }} d={path(s.values)} />)}
        {labels && ends.map(e => (
          <g key={`e${e.s.name}`}>
            <circle className="s-dot" cx={m.l + pw} cy={y(e.v!)} r={3.5} style={{ fill: e.s.color }} />
            <text className="s-endlabel" x={m.l + pw + 9} y={e.py + 4}>{show(e.s, e.v)}</text>
          </g>
        ))}
        <line className="s-axis" x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} />
        {hover && <line className="s-cross" x1={xc(hover.k)} x2={xc(hover.k)} y1={m.t} y2={m.t + ph} />}
      </svg>
      {hover && (
        <div className="s-tip" style={{ left: Math.min(hover.left + 14, (box.current?.clientWidth ?? 600) - 200), top: Math.max(0, hover.top - 40) }}>
          <div className="s-tip-date">{dayLabel(o.t[hover.k])} · {hhmm(o.t[hover.k])} UTC</div>
          {o.series.map(s => (
            <div className="s-tip-row" key={s.name}>
              <span className="s-tip-name"><i className={`s-key ${s.bar ? 's-key-bar' : 's-key-line'}`} style={{ background: s.color }} />{s.name}</span>
              <span className="s-tip-val">{show(s, s.values[hover.k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
