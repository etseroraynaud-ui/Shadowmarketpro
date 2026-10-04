'use client'

import type { BacktestResult, Metrics, Trade } from '../../../lib/backtest/types.ts'
import type { Dict, Lang } from '../i18n'
import { fmtMoney, fmtNum, fmtPct, tone } from '../format'

type Fmt = 'money' | 'pct' | 'pctNoSign' | 'num' | 'int'

const SECTIONS: { title: keyof Dict; rows: [keyof Metrics, Fmt, boolean][] }[] = [
  {
    title: 'stat_section_perf',
    rows: [
      ['startEquity', 'money', false], ['endEquity', 'money', true], ['netProfit', 'money', true], ['totalReturn', 'pct', true],
      ['cagr', 'pct', true], ['years', 'num', false],
    ],
  },
  {
    title: 'stat_section_risk',
    rows: [
      ['maxDrawdown', 'pctNoSign', true], ['maxDrawdownDays', 'int', true], ['volatility', 'pctNoSign', true], ['sharpe', 'num', true],
      ['sortino', 'num', true], ['calmar', 'num', true], ['exposure', 'pctNoSign', true],
    ],
  },
  {
    title: 'stat_section_trades',
    rows: [
      ['trades', 'int', false], ['winRate', 'pctNoSign', false], ['profitFactor', 'num', false], ['avgTradePct', 'pct', false],
      ['avgWinPct', 'pct', false], ['avgLossPct', 'pct', false], ['payoff', 'num', false], ['bestTradePct', 'pct', false],
      ['worstTradePct', 'pct', false], ['avgBars', 'num', false], ['maxConsecWins', 'int', false], ['maxConsecLosses', 'int', false],
      ['fees', 'money', false],
    ],
  },
]

function fmt(v: number, f: Fmt, lang: Lang): string {
  if (f === 'money') return fmtMoney(v, lang)
  if (f === 'pct') return fmtPct(v, lang, 2)
  if (f === 'pctNoSign') return fmtPct(v, lang, 1, false)
  if (f === 'int') return fmtNum(v, lang, 0)
  return fmtNum(v, lang, 2)
}

function side(trades: Trade[]) {
  const n = trades.length
  const wins = trades.filter(x => x.pnl > 0)
  const gp = wins.reduce((a, x) => a + x.pnl, 0)
  const gl = trades.filter(x => x.pnl <= 0).reduce((a, x) => a + x.pnl, 0)
  return {
    n,
    win: n ? wins.length / n : 0,
    pf: gl < 0 ? gp / -gl : gp > 0 ? Infinity : 0,
    avg: n ? trades.reduce((a, x) => a + x.pnlPct, 0) / n : 0,
    pnl: gp + gl,
  }
}

export default function StatsTable({ result, lang, t }: { result: BacktestResult; lang: Lang; t: Dict }) {
  const m = result.metrics
  const bh = result.benchMetrics
  const L = side(result.trades.filter(x => x.dir === 1))
  const S = side(result.trades.filter(x => x.dir === -1))
  return (
    <div className="bt-stats">
      {SECTIONS.map(sec => (
        <div key={sec.title} className="bt-stats-block">
          <h4>{t[sec.title] as string}</h4>
          <table className="bt-table bt-table-compact">
            <thead>
              <tr><th /><th className="num">{t.strategy}</th>{sec.rows.some(r => r[2]) && <th className="num">{t.buyHold}</th>}</tr>
            </thead>
            <tbody>
              {sec.rows.map(([key, f, withBh]) => (
                <tr key={key}>
                  <td>{t[`stat_${key}` as keyof Dict] as string}</td>
                  <td className={`num ${f === 'pct' || key === 'netProfit' ? `bt-${tone(m[key])}` : ''}`}>{fmt(m[key], f, lang)}</td>
                  {sec.rows.some(r => r[2]) && <td className="num bt-muted">{withBh ? fmt(bh[key], f, lang) : ''}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      <div className="bt-stats-block">
        <h4>{t.stat_section_split}</h4>
        <table className="bt-table bt-table-compact">
          <thead><tr><th /><th className="num">{t.long}</th><th className="num">{t.short}</th></tr></thead>
          <tbody>
            <tr><td>{t.stat_count}</td><td className="num">{L.n}</td><td className="num">{S.n}</td></tr>
            <tr><td>{t.stat_winRate}</td><td className="num">{L.n ? fmtPct(L.win, lang, 0, false) : '—'}</td><td className="num">{S.n ? fmtPct(S.win, lang, 0, false) : '—'}</td></tr>
            <tr><td>{t.stat_profitFactor}</td><td className="num">{L.n ? fmtNum(L.pf, lang, 2) : '—'}</td><td className="num">{S.n ? fmtNum(S.pf, lang, 2) : '—'}</td></tr>
            <tr><td>{t.stat_avgTradePct}</td><td className={`num bt-${tone(L.avg)}`}>{L.n ? fmtPct(L.avg, lang, 2) : '—'}</td><td className={`num bt-${tone(S.avg)}`}>{S.n ? fmtPct(S.avg, lang, 2) : '—'}</td></tr>
            <tr><td>{t.stat_pnl}</td><td className={`num bt-${tone(L.pnl)}`}>{L.n ? fmtMoney(L.pnl, lang) : '—'}</td><td className={`num bt-${tone(S.pnl)}`}>{S.n ? fmtMoney(S.pnl, lang) : '—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
