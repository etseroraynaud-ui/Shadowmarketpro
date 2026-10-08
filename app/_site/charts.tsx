// Graphiques statiques (rendu serveur) : colonnes groupées et carte de chaleur mensuelle. Les
// valeurs survolées s'affichent par l'infobulle native ; les tableaux voisins donnent les chiffres.

const W = 760
const MINUS = '−'
const minus = (s: string) => s.replace(/^-/, MINUS)

function ticks(lo: number, hi: number, target = 5) {
  const raw = (hi - lo) / target
  const p = Math.pow(10, Math.floor(Math.log10(raw)))
  const mm = raw / p
  const st = (mm < 1.5 ? 1 : mm < 3 ? 2 : mm < 7 ? 5 : 10) * p
  const out: number[] = []
  for (let v = Math.ceil(lo / st - 1e-9) * st; v <= hi + 1e-9; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v)
  return out
}

export function GroupedBars(o: { title: string; cats: string[]; series: { name: string; color: string; values: number[] }[]; height?: number }) {
  const H = o.height ?? 280
  const m = { l: 54, r: 12, t: 12, b: 28 }
  const pw = W - m.l - m.r, ph = H - m.t - m.b
  const all = o.series.flatMap(s => s.values)
  const tk = ticks(Math.min(0, ...all), Math.max(0, ...all), 5)
  const lo = Math.min(0, ...all, tk[0]), hi = Math.max(0, ...all, tk[tk.length - 1])
  const y = (v: number) => m.t + ph - ((v - lo) / (hi - lo)) * ph
  const band = pw / o.cats.length
  const bw = Math.min(22, (band * 0.72 - 2 * (o.series.length - 1)) / o.series.length)
  const gw = bw * o.series.length + 2 * (o.series.length - 1)
  return (
    <div className="s-chart">
      <div className="s-legend">{o.series.map(s => <span key={s.name}><i className="s-key" style={{ background: s.color }} />{s.name}</span>)}</div>
      <div className="s-chart-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={o.title}>
        {tk.map(v => (
          <g key={v}>
            <line className="s-grid" x1={m.l} x2={m.l + pw} y1={y(v)} y2={y(v)} />
            <text className="s-tick" x={m.l - 8} y={y(v) + 4} textAnchor="end">{minus(`${Math.round(v * 100)}%`)}</text>
          </g>
        ))}
        {o.cats.map((c, i) => {
          const gx = m.l + band * i + (band - gw) / 2
          return (
            <g key={c}>
              {o.series.map((s, k) => {
                const v = s.values[i]
                const bx = gx + k * (bw + 2), top = y(Math.max(v, 0)), bot = y(Math.min(v, 0))
                const h = Math.max(bot - top, 0.5), r = Math.min(4, h, bw / 2)
                const d = v >= 0
                  ? `M${bx} ${bot}V${top + r}Q${bx} ${top} ${bx + r} ${top}H${bx + bw - r}Q${bx + bw} ${top} ${bx + bw} ${top + r}V${bot}Z`
                  : `M${bx} ${top}V${bot - r}Q${bx} ${bot} ${bx + r} ${bot}H${bx + bw - r}Q${bx + bw} ${bot} ${bx + bw} ${bot - r}V${top}Z`
                return <path key={s.name} className="s-bar" style={{ fill: s.color }} d={d}><title>{`${c} · ${s.name}: ${minus((v * 100).toFixed(1))}%`}</title></path>
              })}
              <text className="s-tick" x={m.l + band * i + band / 2} y={H - 8} textAnchor="middle">{c}</text>
            </g>
          )
        })}
        <line className="s-axis" x1={m.l} x2={m.l + pw} y1={y(0)} y2={y(0)} />
      </svg>
      </div>
    </div>
  )
}

/** Carte de chaleur divergente : bleu = gain, rouge = perte, gris = zéro ; paliers de cap / 5. */
export function Heatmap(o: { title: string; rows: string[]; cols: string[]; values: (number | null)[][]; cap: number }) {
  const cw = 50, ch = 28, lw = 48, th = 22
  const Wd = lw + cw * o.cols.length, Hd = th + ch * o.rows.length
  return (
    <div className="s-chart s-heat">
      <svg viewBox={`0 0 ${Wd} ${Hd}`} role="img" aria-label={o.title}>
        {o.cols.map((c, j) => <text key={c} className="s-tick" x={lw + cw * j + cw / 2} y={th - 8} textAnchor="middle">{c}</text>)}
        {o.rows.map((r, i) => (
          <g key={r}>
            <text className="s-tick" x={lw - 8} y={th + ch * i + ch / 2 + 4} textAnchor="end">{r}</text>
            {o.cols.map((c, j) => {
              const v = o.values[i][j]
              if (v === null || !Number.isFinite(v)) return null
              const step = Math.min(5, Math.ceil((Math.abs(v) / o.cap) * 5))
              const cls = Math.abs(v) < 0.0005 ? 's-h0' : `${v > 0 ? 's-hp' : 's-hn'}${step}`
              const txt = Math.abs(v * 100) < 0.05 ? '0.0' : minus((v * 100).toFixed(1))
              return (
                <g key={c} className="s-cell">
                  <rect className={cls} x={lw + cw * j + 1} y={th + ch * i + 1} width={cw - 2} height={ch - 2} rx={3} />
                  <text className="s-hv" x={lw + cw * j + cw / 2} y={th + ch * i + ch / 2 + 4} textAnchor="middle">{txt}</text>
                  <title>{`${r} ${c}: ${minus((v * 100).toFixed(2))}%`}</title>
                </g>
              )
            })}
          </g>
        ))}
      </svg>
    </div>
  )
}
