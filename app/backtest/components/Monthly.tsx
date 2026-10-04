'use client'

import { useMemo } from 'react'
import type { BacktestResult, Bars } from '../../../lib/backtest/types.ts'
import { periodReturns } from '../../../lib/backtest/metrics.ts'
import type { Dict, Lang } from '../i18n'
import { fmtPct } from '../format'

/** Couleur d'une case : vert ou rouge, d'autant plus intense que le mois est fort. */
function heat(r: number): string {
  if (!Number.isFinite(r) || r === 0) return 'transparent'
  const a = Math.min(1, Math.abs(r) / 0.25) * 0.55 + 0.06
  return r > 0 ? `rgba(52,211,153,${a})` : `rgba(248,113,113,${a})`
}

export default function Monthly({ bars, result, lang, t }: { bars: Bars; result: BacktestResult; lang: Lang; t: Dict }) {
  const data = useMemo(() => {
    const s = periodReturns(bars, result.equity, result.start, result.end, result.metrics.startEquity)
    const b = periodReturns(bars, result.benchmark, result.start, result.end, result.metrics.startEquity)
    const years = s.years.map(y => y.year)
    const grid = new Map<string, number>()
    for (const m of s.months) grid.set(`${m.year}-${m.month}`, m.ret)
    const yr = new Map(s.years.map(y => [y.year, y.ret]))
    const yb = new Map(b.years.map(y => [y.year, y.ret]))
    return { years, grid, yr, yb }
  }, [bars, result])
  return (
    <div>
      <p className="bt-muted bt-mb">{t.monthlyHint}</p>
      <div className="bt-table-wrap">
        <table className="bt-table bt-heat">
          <thead>
            <tr>
              <th>{t.year}</th>
              {t.monthsShort.map(m => <th key={m} className="num">{m}</th>)}
              <th className="num">{t.total}</th>
              <th className="num">{t.bhShort}</th>
            </tr>
          </thead>
          <tbody>
            {data.years.slice().reverse().map(y => (
              <tr key={y}>
                <td className="bt-year">{y}</td>
                {t.monthsShort.map((_, k) => {
                  const r = data.grid.get(`${y}-${k}`)
                  const flat = r !== undefined && Math.abs(r) < 0.0005
                  return <td key={k} className={flat ? 'num bt-muted' : 'num'} style={{ background: r === undefined || flat ? undefined : heat(r) }}>{r === undefined ? '' : flat ? '·' : fmtPct(r, lang, 1)}</td>
                })}
                <td className="num bt-strong" style={{ background: heat(data.yr.get(y) ?? 0) }}>{fmtPct(data.yr.get(y) ?? 0, lang, 1)}</td>
                <td className="num bt-muted">{fmtPct(data.yb.get(y) ?? 0, lang, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
