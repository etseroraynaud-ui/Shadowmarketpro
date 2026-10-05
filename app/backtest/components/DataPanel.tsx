'use client'

import { useRef, useState } from 'react'
import { loadBarsFromCsv, DataError } from '../../../lib/backtest/data.ts'
import type { Dict, Lang } from '../i18n'
import { fmtDate, fmtPrice } from '../format'
import { BINANCE_INTERVALS, BINANCE_QUICK, HL_INTERVALS, HL_MARKETS, SAMPLES, loadBinance, loadDataset, loadHyperliquid } from '../datasets'
import type { Dataset, MarketGroup } from '../datasets'

export type { Dataset } from '../datasets'

const GROUPS: MarketGroup[] = ['crypto', 'stocks', 'commodities', 'indices']

export default function DataPanel({
  t, lang, data, onLoaded, from, to, onWindow,
}: {
  t: Dict
  lang: Lang
  data: Dataset | null
  onLoaded: (d: Dataset) => void
  from: string
  to: string
  onWindow: (from: string, to: string) => void
}) {
  const [mode, setMode] = useState<'samples' | 'hyperliquid' | 'binance' | 'csv'>('samples')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [tf, setTf] = useState('1d')
  const [since, setSince] = useState('2020-01-01')
  const [group, setGroup] = useState<MarketGroup>('crypto')
  const [coin, setCoin] = useState('BTC')
  const [hlTf, setHlTf] = useState('15m')
  const fileRef = useRef<HTMLInputElement>(null)

  const wrap = async (key: string, f: () => Promise<Dataset>) => {
    setBusy(key)
    setError(null)
    try {
      onLoaded(await f())
    } catch (e) {
      if (e instanceof DataError) setError(e.msg[lang])
      else if (key === 'binance') setError(t.binanceError)
      else if (key === 'hyperliquid') setError(t.hlError)
      else setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }
  const readFile = (file: File) => wrap('csv', async () => {
    const d = loadBarsFromCsv(await file.text())
    return { bars: d.bars, name: file.name.replace(/\.(csv|txt)$/i, ''), timeframe: d.timeframe, barMs: d.barMs, warnings: d.warnings }
  })

  return (
    <div className="bt-step-body">
      <div className="bt-seg" role="tablist">
        {(['samples', 'hyperliquid', 'binance', 'csv'] as const).map(m => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'samples' ? t.samples : m === 'csv' ? t.csvFile : m === 'binance' ? t.binance : t.hyperliquid}
          </button>
        ))}
      </div>

      {mode === 'samples' && (
        <div className="bt-list">
          {SAMPLES.map(s => (
            <button key={s.id} className={`bt-list-item${data?.sample === s.id ? ' on' : ''}`} onClick={() => wrap(s.id, () => loadDataset(s.id))} disabled={!!busy}>
              <span>{t[s.label]}</span>
              <span className="bt-muted bt-small">{busy === s.id ? t.loading : data?.sample === s.id ? '✓' : t.load}</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'csv' && (
        <div
          className={`bt-drop${drag ? ' drag' : ''}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) readFile(f) }}
          onClick={() => fileRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <strong>{busy === 'csv' ? t.loading : t.dropCsv}</strong>
          <span className="bt-muted bt-small">{t.dropCsvHint}</span>
          <input ref={fileRef} type="file" accept=".csv,.txt,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
        </div>
      )}

      {mode === 'hyperliquid' && (
        <div className="bt-form-grid">
          <div className="bt-seg bt-seg-sm bt-span2">
            {GROUPS.map(g => (
              <button key={g} className={group === g ? 'on' : ''} onClick={() => { setGroup(g); setCoin(HL_MARKETS[g][0].coin) }}>{t[`hlGroup_${g}` as const]}</button>
            ))}
          </div>
          <label className="bt-field"><span>{t.market}</span>
            <select value={coin} onChange={e => setCoin(e.target.value)}>
              {HL_MARKETS[group].map(m => <option key={m.coin} value={m.coin}>{m.label[lang]}</option>)}
            </select>
          </label>
          <label className="bt-field"><span>{t.interval}</span>
            <select value={hlTf} onChange={e => setHlTf(e.target.value)}>{HL_INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}</select>
          </label>
          <button className="bt-btn bt-btn-ghost bt-span2" disabled={!!busy} onClick={() => wrap('hyperliquid', () => loadHyperliquid(coin, hlTf))}>
            {busy === 'hyperliquid' ? t.loading : t.fetch}
          </button>
          <p className="bt-muted bt-small bt-span2">{group === 'crypto' ? t.hlHint : t.hlHintXyz}</p>
        </div>
      )}

      {mode === 'binance' && (
        <div className="bt-form-grid">
          <div className="bt-seg bt-seg-sm bt-span2">
            {BINANCE_QUICK.map(q => (
              <button key={q.symbol} className={symbol === q.symbol ? 'on' : ''} onClick={() => setSymbol(q.symbol)}>{q.label[lang]}</button>
            ))}
          </div>
          <label className="bt-field"><span>{t.symbol}</span><input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
          <label className="bt-field"><span>{t.interval}</span>
            <select value={tf} onChange={e => setTf(e.target.value)}>{BINANCE_INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}</select>
          </label>
          <label className="bt-field"><span>{t.since}</span><input type="date" value={since} onChange={e => setSince(e.target.value)} /></label>
          <button className="bt-btn bt-btn-ghost bt-self-end" disabled={!!busy || !symbol} onClick={() => wrap('binance', () => loadBinance(symbol, tf, Date.parse(since + 'T00:00:00Z') || 0))}>
            {busy === 'binance' ? t.loading : t.fetch}
          </button>
          <p className="bt-muted bt-small bt-span2">{t.binanceHint}</p>
        </div>
      )}

      {error && <div className="bt-error">{error}</div>}

      {data && (
        <div className="bt-data-summary">
          <div className="bt-data-title">
            <strong>{data.name}</strong>
            <span className="bt-chip">{data.timeframe}</span>
          </div>
          <div className="bt-muted bt-small">
            {data.bars.n.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')} {t.bars} · {fmtDate(data.bars.t[0], lang)} → {fmtDate(data.bars.t[data.bars.n - 1], lang)} · {t.lastPrice} {fmtPrice(data.bars.c[data.bars.n - 1], lang)}
          </div>
          {data.warnings.map((w, k) => <div key={k} className="bt-muted bt-small">⚠ {w[lang]}</div>)}
          <div className="bt-window">
            <span className="bt-small">{t.period}</span>
            <label className="bt-field-inline"><span>{t.from}</span><input type="date" value={from} onChange={e => onWindow(e.target.value, to)} /></label>
            <label className="bt-field-inline"><span>{t.to}</span><input type="date" value={to} onChange={e => onWindow(from, e.target.value)} /></label>
            {(from || to) && <button className="bt-link" onClick={() => onWindow('', '')}>{t.allHistory}</button>}
          </div>
        </div>
      )}
    </div>
  )
}
