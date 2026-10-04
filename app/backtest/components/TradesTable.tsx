'use client'

import { useMemo, useState } from 'react'
import type { Trade } from '../../../lib/backtest/types.ts'
import type { Dict, Lang } from '../i18n'
import { download, fmtDate, fmtMoney, fmtPct, fmtPrice, tone } from '../format'

type Key = 'id' | 'entryTime' | 'pnl' | 'pnlPct' | 'bars' | 'mae' | 'mfe'

export default function TradesTable({ trades, lang, t, intraday }: { trades: Trade[]; lang: Lang; t: Dict; intraday: boolean }) {
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: 'id', desc: false })
  const [page, setPage] = useState(0)
  const PER = 50
  const rows = useMemo(() => {
    const r = trades.slice()
    r.sort((a, b) => (a[sort.key] - b[sort.key]) * (sort.desc ? -1 : 1))
    return r
  }, [trades, sort])
  if (!trades.length) return <p className="bt-muted">{t.noTrades}</p>
  const pages = Math.ceil(rows.length / PER)
  const view = rows.slice(page * PER, page * PER + PER)
  const head = (key: Key, label: string, cls = '') => (
    <th className={cls}>
      <button className="bt-th" onClick={() => setSort(s => ({ key, desc: s.key === key ? !s.desc : key !== 'id' && key !== 'entryTime' }))}>
        {label}{sort.key === key ? (sort.desc ? ' ↓' : ' ↑') : ''}
      </button>
    </th>
  )
  const exportCsv = () => {
    const lines = ['id,side,entry_time,entry_price,exit_time,exit_price,qty,bars,pnl,pnl_pct,fees,mae_pct,mfe_pct,reason']
    for (const x of trades) {
      lines.push([
        x.id, x.dir === 1 ? 'long' : 'short', new Date(x.entryTime).toISOString(), x.entryPrice, new Date(x.exitTime).toISOString(), x.exitPrice,
        x.qty, x.bars, x.pnl.toFixed(2), (x.pnlPct * 100).toFixed(3), x.fees.toFixed(2), (x.mae * 100).toFixed(3), (x.mfe * 100).toFixed(3), x.reason,
      ].join(','))
    }
    download('trades.csv', lines.join('\n') + '\n', 'text/csv')
  }
  return (
    <div>
      <div className="bt-table-tools">
        <span className="bt-muted">{t.maeHelp}</span>
        <button className="bt-btn bt-btn-ghost" onClick={exportCsv}>{t.exportCsv}</button>
      </div>
      <div className="bt-table-wrap">
        <table className="bt-table">
          <thead>
            <tr>
              {head('id', t.col_id)}
              <th>{t.col_dir}</th>
              {head('entryTime', t.col_entry)}
              <th className="num">{t.col_entryPrice}</th>
              <th>{t.col_exit}</th>
              <th className="num">{t.col_exitPrice}</th>
              {head('bars', t.col_bars, 'num')}
              {head('pnl', t.col_pnl, 'num')}
              {head('pnlPct', t.col_pnlPct, 'num')}
              {head('mae', t.col_mae, 'num')}
              {head('mfe', t.col_mfe, 'num')}
              <th>{t.col_reason}</th>
            </tr>
          </thead>
          <tbody>
            {view.map(x => (
              <tr key={x.id}>
                <td className="bt-muted">{x.id}</td>
                <td><span className={x.dir === 1 ? 'bt-side bt-side-long' : 'bt-side bt-side-short'}>{x.dir === 1 ? t.long : t.short}</span></td>
                <td>{fmtDate(x.entryTime, lang, intraday)}</td>
                <td className="num">{fmtPrice(x.entryPrice, lang)}</td>
                <td>{fmtDate(x.exitTime, lang, intraday)}</td>
                <td className="num">{fmtPrice(x.exitPrice, lang)}</td>
                <td className="num">{x.bars}</td>
                <td className={`num bt-${tone(x.pnl)}`}>{fmtMoney(x.pnl, lang)}</td>
                <td className={`num bt-${tone(x.pnlPct)}`}>{fmtPct(x.pnlPct, lang, 2)}</td>
                <td className="num bt-muted">{fmtPct(x.mae, lang, 1)}</td>
                <td className="num bt-muted">{fmtPct(x.mfe, lang, 1)}</td>
                <td className="bt-muted">{t[`reason_${x.reason}` as const]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="bt-pager">
          <button className="bt-btn bt-btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</button>
          <span className="bt-muted">{page + 1} / {pages}</span>
          <button className="bt-btn bt-btn-ghost" disabled={page >= pages - 1} onClick={() => setPage(p => p + 1)}>→</button>
        </div>
      )}
    </div>
  )
}
