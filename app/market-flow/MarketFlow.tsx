'use client'

// Market Flow : tableau de bord interactif (actif, plage, rafraîchissement chaque minute). Les données
// viennent de /api/market-flow ; le premier rendu reçoit celles du serveur.

import { useCallback, useEffect, useState } from 'react'
import TimeChart, { fmtValue } from '../_site/TimeChart'
import { COINS, RANGES, usd, type Coin, type FlowView, type RangeKey, type Stance, type WindowSummary } from '../../lib/flow/aggregate'

// Couleurs validées (contraste et daltonisme) sur la surface des graphiques du site.
const C = { big: '#3987e5', retail: '#d95926', long: '#199e70', short: '#e66767', net: '#eef2f6', giant: '#9085e9', price: '#c8d1dc', perp: '#9085e9', spot: '#c98500' }
const REFRESH_MS = 60_000

const pctTxt = (x: number | null, d = 1) => (x === null || !Number.isFinite(x) ? '—' : `${x < 0 ? '−' : x > 0 ? '+' : ''}${Math.abs(x * 100).toFixed(d)}%`)
const ICON: Record<Stance['tone'], string> = { pos: '▲', neg: '▼', neutral: '●', muted: '○' }
const pts = (x: number | null) => (x === null ? '—' : `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)} pts`)

function Tone({ s }: { s: Stance }) {
  return <span className={`mf-tone mf-${s.tone}`}><span aria-hidden="true">{ICON[s.tone]}</span>{s.label}</span>
}

function ago(iso: string | null, now: number) {
  if (!iso) return null
  const s = Math.max(0, Math.round(now / 1000 - Date.parse(iso) / 1000))
  return s < 90 ? `${s} s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${(s / 3600).toFixed(1)} h ago`
}

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="s-seg" role="group" aria-label={label}>
      {options.map(o => <button key={o.v} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}>{o.t}</button>)}
    </div>
  )
}

function Panel({ title, sub, children, head, wide }: { title: string; sub?: string; children: React.ReactNode; head?: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`s-panel${wide ? ' mf-wide' : ''}`}>
      <div className="s-panel-head"><div><h3 className="s-panel-t">{title}</h3>{sub && <p className="s-panel-s">{sub}</p>}</div>{head}</div>
      {children}
    </div>
  )
}

function WindowTable({ ws }: { ws: WindowSummary[] }) {
  const cell = (w: WindowSummary, f: (w: WindowSummary) => React.ReactNode) => <td key={w.key} data-label={w.key.toUpperCase()}>{f(w)}</td>
  const rows: [string, (w: WindowSummary) => React.ReactNode][] = [
    ['Price', w => pctTxt(w.priceChg, 2)],
    ['Perps · large orders ≥ $100k', w => <><b className="mf-num">{usd(w.cvd.big, true)}</b><span className="mf-sub">{pctTxt(w.imb.big)} of {usd(w.vol.big)}</span><Tone s={w.big} /></>],
    ['Perps · retail < $10k', w => <><b className="mf-num">{usd(w.cvd.retail, true)}</b><span className="mf-sub">{pctTxt(w.imb.retail)} of {usd(w.vol.retail)}</span><Tone s={w.retail} /></>],
    ['Perps · divergence', w => <><b className="mf-num">{pts(w.divergence)}</b><Tone s={w.verdict} /></>],
    ['Spot · large orders ≥ $100k', w => (w.spot.minutes ? <><b className="mf-num">{usd(w.spot.cvd.big, true)}</b><span className="mf-sub">{pctTxt(w.spot.imb.big)} of {usd(w.spot.vol.big)}</span><Tone s={w.spot.big} /></> : <Tone s={w.spot.big} />)],
    ['Spot · retail < $10k', w => (w.spot.minutes ? <><b className="mf-num">{usd(w.spot.cvd.retail, true)}</b><span className="mf-sub">{pctTxt(w.spot.imb.retail)} of {usd(w.spot.vol.retail)}</span><Tone s={w.spot.retail} /></> : <Tone s={w.spot.retail} />)],
    ['Spot · divergence', w => (w.spot.minutes ? <><b className="mf-num">{pts(w.spot.divergence)}</b><Tone s={w.spot.verdict} /></> : <Tone s={w.spot.verdict} />)],
    ['Hyperliquid whales', w => <><b className="mf-num">{w.whales.ok ? usd(w.whales.net, true) : '—'}</b><span className="mf-sub">{w.whales.ok ? `longs ${usd(w.whales.long, true)} · shorts ${usd(w.whales.short, true)}` : ''}</span><Tone s={w.whales.stance} /></>],
    ['Liquidations', w => <><span className="mf-sub">longs {usd(w.liq.long)} · shorts {usd(w.liq.short)}</span><Tone s={w.liq.stance} /></>],
  ]
  return (
    <div className="s-tw s-tw-stack">
      <table className="s-table mf-table">
        <thead><tr><th scope="col">Last</th>{ws.map(w => <th key={w.key} scope="col">{w.key.toUpperCase()}</th>)}</tr></thead>
        <tbody>{rows.map(([name, f]) => <tr key={name}><th scope="row">{name}</th>{ws.map(w => cell(w, f))}</tr>)}</tbody>
      </table>
    </div>
  )
}

export default function MarketFlow({ initial }: { initial: FlowView }) {
  const [coin, setCoin] = useState<Coin>(initial.coin)
  const [range, setRange] = useState<RangeKey>(initial.range)
  const [view, setView] = useState<FlowView>(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [market, setMarket] = useState<'perps' | 'spot'>('perps')
  const [clock, setClock] = useState(() => Date.now())

  const load = useCallback(async (c: Coin, r: RangeKey) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/market-flow?coin=${c}&range=${r}`)
      if (!res.ok) throw new Error(String(res.status))
      setView(await res.json())
      setError(false)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (coin !== view.coin || range !== view.range) load(coin, range)
    const id = setInterval(() => { if (document.visibilityState === 'visible') load(coin, range) }, REFRESH_MS)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin, range, load])
  useEffect(() => { const id = setInterval(() => setClock(Date.now()), 15_000); return () => clearInterval(id) }, [])

  const v = view
  const s = v.series
  const step = RANGES[v.range].bucket
  const h1 = v.windows[0]
  const net = v.now.whaleLong !== null && v.now.whaleShort !== null ? v.now.whaleLong - v.now.whaleShort : null
  const updated = ago(v.updatedAt, clock)
  const empty = v.end === null
  // Données de plus de 10 min : jugé aussi avec l'horloge du visiteur (la page peut rester ouverte).
  const stale = v.stale || (v.updatedAt !== null && clock - Date.parse(v.updatedAt) > 600_000)

  return (
    <div className="mf">
      <div className="mf-controls">
        <Seg<Coin> label="Asset" value={coin} options={COINS.map(c => ({ v: c, t: c }))} onChange={setCoin} />
        <Seg<RangeKey> label="Range" value={range} options={(Object.keys(RANGES) as RangeKey[]).map(r => ({ v: r, t: RANGES[r].label }))} onChange={setRange} />
        <span className={`mf-live${stale || empty ? ' mf-live-off' : ''}`} aria-live="polite">
          <i aria-hidden="true" />{loading ? 'Updating…' : empty ? 'Waiting for data' : stale ? `Last update ${updated}` : `Live · updated ${updated}`}
        </span>
      </div>
      {error && <p className="mf-banner">Could not refresh the data. The figures below are from the last successful update.</p>}
      {!empty && stale && <p className="mf-banner">The collector has not reported for more than 10 minutes: the data below may be out of date.</p>}

      {empty ? (
        <div className="s-callout">Data collection for {v.coin} is starting. The first figures appear a few minutes after the collector comes online, and the history builds up from there.</div>
      ) : (
        <>
          <div className="s-kpis mf-kpis">
            <div className="s-kpi"><div className="s-kpi-l">{v.coin} price</div><div className="s-kpi-v">{fmtValue(v.now.price, 'price')}</div><div className="s-kpi-s">{pctTxt(h1?.priceChg ?? null, 2)} over 1 hour</div></div>
            <div className="s-kpi"><div className="s-kpi-l">Large vs retail · perps 1H</div><div className="s-kpi-v">{h1?.divergence == null ? '—' : `${h1.divergence >= 0 ? '+' : '−'}${Math.abs(h1.divergence).toFixed(1)}`}<small> pts</small></div><div className="s-kpi-s">{h1 ? <Tone s={h1.verdict} /> : '—'}</div></div>
            <div className="s-kpi"><div className="s-kpi-l">Hyperliquid whales</div><div className="s-kpi-v">{net === null ? '—' : usd(net, true)}</div><div className="s-kpi-s">net {net === null ? '' : net >= 0 ? 'long' : 'short'} · {v.now.nLong ?? 0} long / {v.now.nShort ?? 0} short accounts</div></div>
            <div className="s-kpi"><div className="s-kpi-l">Giant positions ≥ $5M</div><div className="s-kpi-v">{v.now.giantBias === null ? '—' : `${v.now.giantBias >= 0 ? '+' : '−'}${Math.abs(v.now.giantBias).toFixed(0)}%`}</div><div className="s-kpi-s">net bias · {v.now.nGiantLong ?? 0} long / {v.now.nGiantShort ?? 0} short</div></div>
          </div>

          {v.reading.length > 0 && <div className="s-callout mf-reading">{v.reading.map((r, i) => <p key={i}>{r}</p>)}</div>}

          <h3 className="mf-h3">Whales vs retail</h3>
          <p className="s-small">Net aggressive volume (market buys minus market sells) on Binance, Bybit and OKX perpetuals, with its share of the group&apos;s volume, compared with the change in the positions of tracked Hyperliquid whales.</p>
          {v.windows.length > 0 && <WindowTable ws={v.windows} />}

          <div className="mf-charts">
            <Panel title="Cumulative volume delta by order size" wide
              sub={`Since the start of the ${RANGES[v.range].label} window · ${market === 'perps' ? 'Binance, Bybit, OKX perpetuals' : 'Binance, Coinbase, OKX spot'}`}
              head={<Seg<'perps' | 'spot'> label="Market" value={market} options={[{ v: 'perps', t: 'Perpetuals' }, { v: 'spot', t: 'Spot' }]} onChange={setMarket} />}>
              <TimeChart key={market} title={`Cumulative volume delta, ${market}`} t={s.t} step={step} fmt="usd" signed zero height={300} series={market === 'perps' ? [
                { name: 'Large orders ≥ $100k', color: C.big, values: s.cvdBig },
                { name: 'of which ≥ $1M', color: C.big, values: s.cvdMega, dash: true },
                { name: 'Retail < $10k', color: C.retail, values: s.cvdRetail },
              ] : [
                { name: 'Large orders ≥ $100k', color: C.big, values: s.spotBig },
                { name: 'of which ≥ $1M', color: C.big, values: s.spotMega, dash: true },
                { name: 'Retail < $10k', color: C.retail, values: s.spotRetail },
              ]} />
            </Panel>
            <Panel title="Spot vs perpetuals" sub="Cumulative volume delta, all order sizes · spot buying is cash demand, perpetual buying is mostly leveraged positioning">
              <TimeChart title="Spot vs perpetuals" t={s.t} step={step} fmt="usd" signed zero height={260} series={[
                { name: 'Perpetuals', color: C.perp, values: s.perpTotal },
                { name: 'Spot', color: C.spot, values: s.spotTotal },
              ]} />
            </Panel>
            <Panel title={`${v.coin} price`} sub="Last trade price per interval (Binance perpetual when available)">
              <TimeChart title="Price" t={s.t} step={step} fmt="price" height={220} endLabels={false} series={[{ name: 'Price', color: C.price, values: s.px }]} />
            </Panel>
            <Panel title="Hyperliquid whale positions" sub="Open positions of $500k or more held by tracked accounts">
              <TimeChart title="Whale positions" t={s.t} step={step} fmt="usd" height={280} series={[
                { name: 'Longs', color: C.long, values: s.whaleLong },
                { name: 'Shorts', color: C.short, values: s.whaleShort },
                { name: 'Net (longs − shorts)', color: C.net, values: s.whaleNet, label: x => fmtValue(x, 'usd', true) },
              ]} />
            </Panel>
            <Panel title="Giant positions: net bias" sub="(longs − shorts) / (longs + shorts) across positions of $5M or more">
              <TimeChart title="Giant net bias" t={s.t} step={step} fmt="pct" signed zero height={220} endLabels={false} series={[{ name: 'Net bias', color: C.giant, values: s.giantBias }]} />
            </Panel>
            <Panel wide title="Liquidations" sub="Binance, Bybit, OKX and tracked Hyperliquid accounts · shorts above zero, longs below">
              <TimeChart title="Liquidations" t={s.t} step={step} fmt="usd" zero height={240} endLabels={false} series={[
                { name: 'Shorts liquidated', color: C.long, values: s.liqShort, bar: true },
                { name: 'Longs liquidated', color: C.short, values: s.liqLong.map(x => (x === null ? null : -x)), bar: true, label: x => fmtValue(Math.abs(x), 'usd') },
              ]} />
            </Panel>
          </div>

          {v.now.top.length > 0 && (
            <>
              <h3 className="mf-h3">Largest tracked {v.coin} positions on Hyperliquid</h3>
              <div className="s-tw s-tw-stack">
                <table className="s-table s-table-compact">
                  <thead><tr><th scope="col">Account</th><th scope="col">Side</th><th scope="col">Size</th><th scope="col">Entry</th><th scope="col">Liquidation</th><th scope="col">Leverage</th><th scope="col">Unrealized PnL</th></tr></thead>
                  <tbody>{v.now.top.map(p => (
                    <tr key={p.address}>
                      <th scope="row"><a className="s-link mf-mono" href={`https://app.hyperliquid.xyz/explorer/address/${p.address}`} target="_blank" rel="noopener noreferrer">{p.address.slice(0, 6)}…{p.address.slice(-4)}</a></th>
                      <td data-label="Side"><span className={`mf-tone mf-${p.szi > 0 ? 'pos' : 'neg'}`}><span aria-hidden="true">{p.szi > 0 ? '▲' : '▼'}</span>{p.szi > 0 ? 'Long' : 'Short'}</span></td>
                      <td data-label="Size">{usd(p.value)}</td>
                      <td data-label="Entry">{fmtValue(p.entry, 'price')}</td>
                      <td data-label="Liquidation">{p.liq ? fmtValue(p.liq, 'price') : 'none'}</td>
                      <td data-label="Leverage">{p.lev ? `${p.lev.toFixed(0)}×` : '—'}</td>
                      <td data-label="Unrealized PnL">{usd(p.upnl, true)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}

          <h3 className="mf-h3">Data quality</h3>
          <ul className="mf-quality">
            <li><b>{v.now.coverage === null ? '—' : `${(v.now.coverage * 100).toFixed(0)}%`}</b> of Hyperliquid {v.coin} open interest ({usd(v.now.oi)}) is held by tracked accounts</li>
            {v.now.inspected !== null && <li><b>{v.now.inspected.toLocaleString('en-US')}</b> accounts inspected{v.now.known ? ` out of ${v.now.known.toLocaleString('en-US')} discovered` : ''}</li>}
            {v.now.feeds.some(f => f.ageS !== null) && <li>Trade feeds: {v.now.feeds.map(f => <span key={f.venue} className={`mf-feed${f.ok ? '' : ' mf-feed-off'}`}><span aria-hidden="true">{f.ok ? '●' : '○'}</span>{f.venue}{f.ok ? '' : ' (delayed)'}</span>)}</li>}
          </ul>
        </>
      )}
    </div>
  )
}
