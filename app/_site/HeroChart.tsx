// Visualisation du héros : la vraie courbe du portefeuille 50/50 (échelle log), les deux sleeves en
// filigrane et le drawdown du portefeuille dessous. Rendu serveur, aucune donnée inventée.

import { P } from './data'

const W = 640, TOP = 12, H1 = 206, GAP = 22, H2 = 58, H = TOP + H1 + GAP + H2 + 22, L = 8, R = 8
const STEP = 3

const pick = (xs: (number | null)[]) => xs.map(v => (v === null ? NaN : v)).filter((_, i, a) => (a.length - 1 - i) % STEP === 0)

export default function HeroChart() {
  const pf = pick(P.chart.eqPortfolio), btc = pick(P.chart.eqBtc), eth = pick(P.chart.eqEth), dd = pick(P.chart.ddPortfolio)
  const n = pf.length
  const all = [...pf, ...btc, ...eth].filter(Number.isFinite)
  const lo = Math.min(...all), hi = Math.max(...all)
  const x = (i: number) => L + (i / (n - 1)) * (W - L - R)
  const y = (v: number) => TOP + H1 - ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * H1
  const ddMin = Math.min(...dd.filter(Number.isFinite))
  const yd = (v: number) => TOP + H1 + GAP + (v / ddMin) * H2
  const line = (vals: number[], f: (v: number) => number) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${f(v).toFixed(1)}`).join('')
  const pfPath = line(pf, y)
  const area = `${pfPath}L${x(n - 1).toFixed(1)} ${TOP + H1}L${x(0).toFixed(1)} ${TOP + H1}Z`
  const ddPath = `M${x(0)} ${yd(0)}${dd.map((v, i) => `L${x(i).toFixed(1)} ${yd(v).toFixed(1)}`).join('')}L${x(n - 1)} ${yd(0)}Z`
  const start = P.chart.start, end = P.commonPeriod.end
  const d0 = Date.parse(start + 'T00:00:00Z'), days = P.chart.days
  const years: { i: number; y: number }[] = []
  for (let yr = new Date(d0).getUTCFullYear() + 1; yr <= new Date(end).getUTCFullYear(); yr++) years.push({ i: ((Date.UTC(yr, 0, 1) - d0) / 864e5 / (days - 1)) * (n - 1), y: yr })
  const final = P.series.portfolio.m.totalReturn * 100 + 100
  const guides = [100, 1000].filter(v => v > lo && v < hi)
  return (
    <figure className="s-herochart" aria-label={`BTC/ETH portfolio equity, ${start} to ${end}, historical simulation`}>
      <div className="s-herochart-head">
        <span className="s-herochart-t">BTC/ETH portfolio · indexed to 100 · log scale</span>
        <span className="s-herochart-v">{Math.round(final).toLocaleString('en-US')}<small>from 100</small></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true">
        <defs>
          <linearGradient id="hc-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--s-pf)" stopOpacity=".28" />
            <stop offset="100%" stopColor="var(--s-pf)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hc-dd" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--s-neg)" stopOpacity=".15" />
            <stop offset="100%" stopColor="var(--s-neg)" stopOpacity=".55" />
          </linearGradient>
        </defs>
        {guides.map(v => <line key={v} className="s-hc-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />)}
        {years.filter((_, k) => k % 2 === 0).map(t => <text key={t.y} className="s-hc-tick" x={x(t.i)} y={H - 4} textAnchor="middle">{t.y}</text>)}
        <path d={line(btc, y)} className="s-hc-faint" style={{ stroke: 'var(--s-btc)' }} />
        <path d={line(eth, y)} className="s-hc-faint" style={{ stroke: 'var(--s-eth)' }} />
        <path d={area} fill="url(#hc-fill)" />
        <path d={pfPath} className="s-hc-line s-hc-draw" style={{ stroke: 'var(--s-pf)' }} pathLength={2400} />
        <circle cx={x(n - 1)} cy={y(pf[n - 1])} r={4} fill="var(--s-pf)" stroke="var(--s-bg)" strokeWidth={2} />
        <line className="s-hc-grid" x1={L} x2={W - R} y1={yd(0)} y2={yd(0)} />
        <path d={ddPath} fill="url(#hc-dd)" className="s-hc-dd" />
        <text className="s-hc-tick" x={L} y={TOP + H1 + GAP - 6}>Drawdown · max {(P.series.portfolio.m.maxDD * 100).toFixed(1).replace('-', '−')}%</text>
      </svg>
      <div className="s-herochart-legend">
        <span><i className="s-key s-key-line" style={{ background: 'var(--s-pf)' }} />Portfolio 50/50</span>
        <span><i className="s-key s-key-line" style={{ background: 'var(--s-btc)' }} />BTC sleeve</span>
        <span><i className="s-key s-key-line" style={{ background: 'var(--s-eth)' }} />ETH sleeve</span>
        <span>{start} → {end} · historical simulation</span>
      </div>
    </figure>
  )
}
