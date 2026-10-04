'use client'

import { useRef, useState } from 'react'
import { loadBarsFromCsv, barsFromRecords, DataError } from '../../../lib/backtest/data.ts'
import type { Bars, Msg } from '../../../lib/backtest/types.ts'
import type { Dict, Lang } from '../i18n'
import { fmtDate, fmtPrice } from '../format'

export interface Dataset {
  bars: Bars
  name: string
  timeframe: string
  barMs: number
  warnings: Msg[]
  /** Identifiant de l'exemple chargé, pour le recharger à la prochaine visite. */
  sample?: string
}

export const SAMPLES = [
  { id: 'btc1d', file: '/backtest/data/btcusd_1d.csv', name: 'BTC/USD · Bitstamp', label: 'sampleBtc1d' as const },
  { id: 'btc4h', file: '/backtest/data/btcusd_4h.csv', name: 'BTC/USD · Bitstamp', label: 'sampleBtc4h' as const },
  { id: 'btc30m', file: '/backtest/data/btcusd_30m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc30m' as const },
  { id: 'btc15m', file: '/backtest/data/btcusd_15m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc15m' as const },
  { id: 'btc5m', file: '/backtest/data/btcusd_5m.csv.gz', name: 'BTC/USD · Bitstamp', label: 'sampleBtc5m' as const },
]

/** Texte d'un fichier, décompressé dans le navigateur s'il est en gzip. */
async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  // Le serveur peut déjà avoir décompressé : on regarde la signature gzip (1f 8b).
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
    return await new Response(stream).text()
  }
  return new TextDecoder().decode(buf)
}

export async function loadSample(id: string): Promise<Dataset> {
  const s = SAMPLES.find(x => x.id === id) ?? SAMPLES[0]
  const d = loadBarsFromCsv(await fetchText(s.file))
  return { bars: d.bars, name: s.name, timeframe: d.timeframe, barMs: d.barMs, warnings: d.warnings, sample: s.id }
}

const INTERVALS = ['15m', '1h', '4h', '1d', '1w']

async function loadBinance(symbol: string, interval: string, since: number): Promise<Dataset> {
  const recs: [number, number, number, number, number, number][] = []
  let start = since
  for (let page = 0; page < 20; page++) {
    const url = `https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&startTime=${start}&limit=1000`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const rows = (await res.json()) as (string | number)[][]
    if (!Array.isArray(rows) || !rows.length) break
    for (const r of rows) recs.push([Number(r[0]), Number(r[1]), Number(r[2]), Number(r[3]), Number(r[4]), Number(r[5])])
    const last = Number(rows[rows.length - 1][0])
    if (rows.length < 1000 || last <= start) break
    start = last + 1
  }
  if (recs.length < 2) throw new Error('no data')
  // La dernière barre est encore ouverte : elle est retirée.
  recs.pop()
  const d = barsFromRecords(recs)
  return { bars: d.bars, name: `${symbol} · Binance`, timeframe: d.timeframe, barMs: d.barMs, warnings: d.warnings }
}

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
  const [mode, setMode] = useState<'samples' | 'csv' | 'binance'>('samples')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [tf, setTf] = useState('1d')
  const [since, setSince] = useState('2020-01-01')
  const fileRef = useRef<HTMLInputElement>(null)

  const wrap = async (key: string, f: () => Promise<Dataset>) => {
    setBusy(key)
    setError(null)
    try {
      onLoaded(await f())
    } catch (e) {
      if (e instanceof DataError) setError(e.msg[lang])
      else if (key === 'binance') setError(t.binanceError)
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
        {(['samples', 'csv', 'binance'] as const).map(m => (
          <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {m === 'samples' ? t.samples : m === 'csv' ? t.csvFile : t.binance}
          </button>
        ))}
      </div>

      {mode === 'samples' && (
        <div className="bt-list">
          {SAMPLES.map(s => (
            <button key={s.id} className={`bt-list-item${data?.sample === s.id ? ' on' : ''}`} onClick={() => wrap(s.id, () => loadSample(s.id))} disabled={!!busy}>
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

      {mode === 'binance' && (
        <div className="bt-form-grid">
          <label className="bt-field"><span>{t.symbol}</span><input value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /></label>
          <label className="bt-field"><span>{t.interval}</span>
            <select value={tf} onChange={e => setTf(e.target.value)}>{INTERVALS.map(i => <option key={i} value={i}>{i}</option>)}</select>
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
