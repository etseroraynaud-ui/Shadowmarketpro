'use client'

// Performance live du bot Shock Engine : compte Hyperliquid lu dans le navigateur (données
// publiques), trades reconstitués à partir des fills, et comparaison trade par trade avec le
// backtest du préréglage du bot sur les mêmes bougies.

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createChart, AreaSeries, BaselineSeries, ColorType, CrosshairMode } from 'lightweight-charts'
import type { UTCTimestamp } from 'lightweight-charts'
import { LogoSVGSmall } from '../components/Logo'
import type { Lang } from '../backtest/i18n'
import { fmtDate, fmtMoney, fmtNum, fmtPct, fmtPrice, tone } from '../backtest/format'
import { HL_MARKETS, loadHyperliquid } from '../backtest/datasets'
import { adaptivePreset, marketFor, selectFor } from '../../lib/strategies/shock/live.ts'
import { simulate } from '../../lib/strategies/shock/engine.ts'
import { cloidKind } from '../../lib/hyperliquid/cloid.ts'
import { backtestTrips, compareTrips, performance, roundTrips } from '../../lib/hyperliquid/track.ts'
import type { BacktestTrip, ExitKind, MatchRow, Performance, RoundTrip } from '../../lib/hyperliquid/track.ts'
import { EXPLORER, loadAccount } from './hl'
import type { AccountData, Network } from './hl'
import { LIVE_ACCOUNTS } from './accounts'
import type { LiveAccount } from './accounts'
import { LIVE_DICTS } from './i18n'
import type { LiveDict } from './i18n'

const M15 = 15 * 60000
const DAY = 86400000
/** Début de la fenêtre des bougies réservé au calcul des indicateurs. */
const WARMUP = 14 * DAY
const REFRESH_MS = 60000
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

interface Backtest {
  trips: BacktestTrip[]
  bars: number
  from: number
  to: number
}

interface Loaded {
  account: AccountData
  backtest: Backtest
}

function targetFromUrl(): LiveAccount | null {
  const q = new URLSearchParams(window.location.search)
  const address = q.get('address')?.trim()
  if (address && ADDRESS.test(address)) {
    return { address, coin: q.get('coin') || 'BTC', network: q.get('net') === 'testnet' ? 'testnet' : 'mainnet', label: '', since: q.get('since') ?? undefined }
  }
  return LIVE_ACCOUNTS[0] ?? null
}

async function load(target: LiveAccount): Promise<Loaded> {
  const since = target.since ? Date.parse(target.since + 'T00:00:00Z') : 0
  const [account, data] = await Promise.all([
    loadAccount(target.network, target.address, target.coin, Number.isFinite(since) ? since : 0),
    loadHyperliquid(target.coin, '15m', target.network === 'testnet'),
  ])
  // Le backtest du bot : même préréglage, même pas de cotation, mêmes bougies (15 min et journalier).
  const shock = adaptivePreset(15, account.tick)
  const bars = data.bars
  const m = marketFor(bars, 15, shock.mintick)
  const costs = { capital: 10000, qtyPct: 100, commissionPct: 0.045, slippageTicks: 0, slippagePct: 0, mintick: shock.mintick, leverage: 1, maintenancePct: 0.5, fundingPct: 0 }
  const res = simulate(m, shock.sets, costs, 0, bars.n - 1, selectFor(shock, m, data.daily).select)
  return { account, backtest: { trips: backtestTrips(bars, res.positions, null, M15), bars: bars.n, from: bars.t[0], to: bars.t[bars.n - 1] + M15 } }
}

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`

export default function LiveApp() {
  const [lang, setLang] = useState<Lang>('fr')
  const t = LIVE_DICTS[lang]
  const [target, setTarget] = useState<LiveAccount | null>(null)
  const [ready, setReady] = useState(false)
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLang(navigator.language.startsWith('fr') ? 'fr' : 'en')
    setTarget(targetFromUrl())
    setReady(true)
  }, [])

  const refresh = useCallback(async (tg: LiveAccount, quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const d = await load(tg)
      setData(d)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!target) return
    setData(null)
    void refresh(target)
    const id = setInterval(() => void refresh(target, true), REFRESH_MS)
    return () => clearInterval(id)
  }, [target, refresh])

  const choose = (tg: LiveAccount) => {
    const q = new URLSearchParams({ address: tg.address, coin: tg.coin, ...(tg.network === 'testnet' ? { net: 'testnet' } : {}) })
    history.replaceState(null, '', `?${q}`)
    setTarget(tg)
  }

  return (
    <div className="bt-app">
      <header className="bt-header">
        <div className="bt-header-in">
          <Link href="/" className="bt-brand">
            <LogoSVGSmall className="bt-logo" />
            <span>ShadowMarket<em>Pro</em></span>
          </Link>
          <span className="bt-header-sep">/</span>
          <span className="bt-header-title">{t.crumb}</span>
          <div className="bt-header-right">
            <div className="bt-seg bt-seg-sm bt-lang" role="group" aria-label="Language">
              {(['fr', 'en'] as const).map(l => (
                <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <Link href="/backtest" className="bt-link">Backtest Lab</Link>
          </div>
        </div>
      </header>

      <div className="bt-intro">
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
      </div>

      <main className="lv-main">
        {ready && !target && <AccountForm t={t} onSubmit={choose} />}
        {target && (
          <>
            <AccountBar t={t} lang={lang} target={target} data={data} loading={loading} onRefresh={() => void refresh(target)} onChange={() => { history.replaceState(null, '', location.pathname); setTarget(null); setData(null) }} />
            {target.network === 'testnet' && <div className="lv-note lv-note-warn">{t.testnetNote}</div>}
            {error && <div className="bt-error">{t.error} : {error}</div>}
            {!data && !error && <div className="bt-card bt-muted">{t.loading}</div>}
            {data && <Dashboard t={t} lang={lang} target={target} data={data} />}
          </>
        )}
        <p className="lv-disclaimer">{t.disclaimer}</p>
      </main>
    </div>
  )
}

function AccountForm({ t, onSubmit }: { t: LiveDict; onSubmit: (tg: LiveAccount) => void }) {
  const [address, setAddress] = useState('')
  const [coin, setCoin] = useState('BTC')
  const [net, setNet] = useState<Network>('mainnet')
  const bad = address.trim() !== '' && !ADDRESS.test(address.trim())
  const markets = [...HL_MARKETS.crypto, ...HL_MARKETS.stocks, ...HL_MARKETS.commodities, ...HL_MARKETS.indices]
  return (
    <section className="bt-card lv-form">
      <h2 className="lv-h2">{t.formTitle}</h2>
      <p className="bt-muted">{t.noAccount}</p>
      <form onSubmit={e => { e.preventDefault(); if (ADDRESS.test(address.trim())) onSubmit({ address: address.trim(), coin, network: net, label: '' }) }} className="lv-form-row">
        <label className="bt-field lv-grow">
          <span>{t.address}</span>
          <input value={address} onChange={e => setAddress(e.target.value)} placeholder="0x…" spellCheck={false} autoComplete="off" />
        </label>
        <label className="bt-field">
          <span>{t.coin}</span>
          <select value={coin} onChange={e => setCoin(e.target.value)}>
            {markets.map(m => <option key={m.coin} value={m.coin}>{m.coin}</option>)}
          </select>
        </label>
        <div className="bt-field">
          <span>{t.network}</span>
          <div className="bt-seg bt-seg-sm">
            {(['mainnet', 'testnet'] as const).map(n => <button type="button" key={n} className={net === n ? 'on' : ''} onClick={() => setNet(n)}>{n}</button>)}
          </div>
        </div>
        <button type="submit" className="bt-btn bt-btn-primary" disabled={!ADDRESS.test(address.trim())}>{t.show}</button>
      </form>
      {bad && <div className="bt-error">{t.badAddress}</div>}
    </section>
  )
}

function AccountBar({ t, lang, target, data, loading, onRefresh, onChange }: {
  t: LiveDict; lang: Lang; target: LiveAccount; data: Loaded | null; loading: boolean; onRefresh: () => void; onChange: () => void
}) {
  return (
    <section className="bt-card lv-bar">
      <div className="lv-bar-id">
        <strong>{target.label || `${target.coin.split(':').pop()} · Shock Engine`}</strong>
        <span className="bt-chip">{target.network}</span>
        <span className="bt-chip">{target.coin}</span>
        <a className="lv-addr" href={EXPLORER[target.network] + target.address} target="_blank" rel="noreferrer" title={target.address}>
          {short(target.address)} · {t.explorer} ↗
        </a>
      </div>
      <div className="lv-bar-tools">
        {data && <span className="bt-muted">{t.updated} {new Date(data.account.time).toLocaleTimeString(lang === 'fr' ? 'fr-FR' : 'en-US')}</span>}
        <button className="bt-btn bt-btn-ghost bt-btn-sm" onClick={onRefresh} disabled={loading}>{t.refresh}</button>
        {!LIVE_ACCOUNTS.some(a => a.address.toLowerCase() === target.address.toLowerCase()) && <button className="bt-btn bt-btn-ghost bt-btn-sm" onClick={onChange}>{t.change}</button>}
      </div>
    </section>
  )
}

function Dashboard({ t, lang, target, data }: { t: LiveDict; lang: Lang; target: LiveAccount; data: Loaded }) {
  const { account, backtest } = data
  const view = useMemo(() => {
    const { trips, skipped } = roundTrips(account.fills, account.funding)
    const configured = target.since ? Date.parse(target.since + 'T00:00:00Z') : NaN
    const firstBot = trips.find(x => x.bot)?.entryTime
    const start = Number.isFinite(configured) ? configured : firstBot ?? trips[0]?.entryTime ?? NaN
    const mine = Number.isFinite(start) ? trips.filter(x => x.entryTime >= start) : []
    const perf = performance(mine, account.accountValue, Number.isFinite(start) ? start : account.time)
    const compareFrom = Math.max(Number.isFinite(start) ? start : account.time, backtest.from + WARMUP)
    const rows = Number.isFinite(start) ? compareTrips(mine, backtest.trips.filter(b => b.entryTime < backtest.to), M15, compareFrom) : []
    return { trips: mine, skipped, start, perf, rows, compareFrom }
  }, [account, backtest, target.since])
  const unrealized = account.position?.unrealizedPnl ?? 0
  return (
    <>
      <Kpis t={t} lang={lang} account={account} perf={view.perf} start={view.start} unrealized={unrealized} />
      <div className="lv-grid">
        <PositionCard t={t} lang={lang} account={account} />
        <section className="bt-card">
          <h2 className="lv-h2">{t.curve}</h2>
          <p className="bt-muted lv-sub">{t.curveSub}</p>
          {view.perf.curve.length > 1 ? <Curve lang={lang} perf={view.perf} labels={{ ret: t.curve, dd: t.dd }} /> : <p className="bt-muted lv-empty">{t.curveEmpty}</p>}
        </section>
      </div>
      <CompareCard t={t} lang={lang} rows={view.rows} backtest={backtest} from={view.compareFrom} />
      <TradesCard t={t} lang={lang} trips={view.trips} skipped={view.skipped} />
    </>
  )
}

function Kpis({ t, lang, account, perf, start, unrealized }: { t: LiveDict; lang: Lang; account: AccountData; perf: Performance; start: number; unrealized: number }) {
  const pnl = perf.pnl + unrealized
  const items = [
    { label: t.kValue, value: `${fmtMoney(account.value, lang)} $`, sub: Number.isFinite(start) ? `${t.since} ${fmtDate(start, lang)}` : t.noStart, tone: 'neu' as const },
    { label: t.kPnl, value: `${pnl > 0 ? '+' : ''}${fmtMoney(pnl, lang)} $`, sub: t.kPnlSub(fmtMoney(perf.pnl, lang), fmtMoney(unrealized, lang)), tone: tone(pnl) },
    { label: t.kTwr, value: fmtPct(perf.twr, lang, 2), sub: t.kTwrSub, tone: tone(perf.twr) },
    { label: t.kDd, value: fmtPct(perf.maxDrawdown, lang, 2), sub: t.kDdSub, tone: perf.maxDrawdown < 0 ? 'neg' as const : 'neu' as const },
    { label: t.kTrades, value: String(perf.trades), sub: t.kTradesSub(perf.trades ? fmtPct(perf.wins / perf.trades, lang, 0, false) : '—'), tone: 'neu' as const },
    { label: t.kPf, value: fmtNum(perf.profitFactor, lang, 2), sub: t.kPfSub(fmtPct(perf.avgPct, lang, 2)), tone: Number.isFinite(perf.profitFactor) ? tone(perf.profitFactor - 1) : 'neu' as const },
    { label: t.kFees, value: `${fmtMoney(perf.fees, lang)} $`, sub: '', tone: 'neu' as const },
    { label: t.kFunding, value: `${perf.funding > 0 ? '+' : ''}${fmtMoney(perf.funding, lang)} $`, sub: t.kFundingSub, tone: tone(perf.funding) },
  ]
  return (
    <div className="bt-kpis">
      {items.map(k => (
        <div key={k.label} className="bt-kpi">
          <div className="bt-kpi-head">{k.label}</div>
          <div className={`bt-kpi-val bt-${k.tone}`}>{k.value}</div>
          <div className="bt-kpi-foot"><span className="bt-kpi-sub">{k.sub}</span></div>
        </div>
      ))}
    </div>
  )
}

function kindLabel(t: LiveDict, k: ExitKind): string {
  return t.kind[k]
}

function PositionCard({ t, lang, account }: { t: LiveDict; lang: Lang; account: AccountData }) {
  const p = account.position
  return (
    <section className="bt-card">
      <h2 className="lv-h2">{t.position}</h2>
      {!p ? <p className="lv-flat">{t.flat}</p> : (
        <dl className="lv-dl">
          <div><dt>{t.position}</dt><dd><span className={p.size > 0 ? 'bt-side-long' : 'bt-side-short'}>{p.size > 0 ? t.long : t.short}</span></dd></div>
          <div><dt>{t.size}</dt><dd>{fmtNum(Math.abs(p.size), lang, account.szDecimals)} {account.coin.split(':').pop()}</dd></div>
          <div><dt>{t.entry}</dt><dd>{fmtPrice(p.entryPx, lang)}</dd></div>
          <div><dt>{t.mark}</dt><dd>{fmtPrice(account.mid, lang)}</dd></div>
          <div><dt>{t.upnl}</dt><dd className={`bt-${tone(p.unrealizedPnl)}`}>{fmtMoney(p.unrealizedPnl, lang)} $</dd></div>
          <div><dt>{t.liq}</dt><dd>{p.liquidationPx ? fmtPrice(p.liquidationPx, lang) : '—'}</dd></div>
          <div><dt>{t.leverage}</dt><dd>×{p.leverage}</dd></div>
        </dl>
      )}
      <h3 className="lv-h3">{t.orders}</h3>
      {account.orders.length === 0 ? <p className="bt-muted">{t.noOrders}</p> : (
        <ul className="lv-orders">
          {account.orders.map(o => (
            <li key={o.oid}>
              <span className="bt-chip">{kindLabel(t, cloidKind(o.cloid) ?? 'manual')}</span>
              <span>{o.side === 'buy' ? '↑' : '↓'} {fmtNum(o.sz, lang, account.szDecimals)}</span>
              <span className="bt-muted">{o.isTrigger ? `${t.trigger} ${fmtPrice(o.triggerPx ?? NaN, lang)}` : fmtPrice(o.limitPx, lang)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Curve({ lang, perf, labels }: { lang: Lang; perf: Performance; labels: { ret: string; dd: string } }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const chart = createChart(box.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#a1a1aa', fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: 'rgba(255,255,255,0.035)' }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
      timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
      localization: { locale: lang === 'fr' ? 'fr-FR' : 'en-US' },
    })
    const pct = { type: 'custom' as const, formatter: (v: number) => `${v.toFixed(2)}%`, minMove: 0.01 }
    const ret = chart.addSeries(AreaSeries, { lineColor: '#f4f4f5', lineWidth: 2, topColor: 'rgba(244,244,245,0.16)', bottomColor: 'rgba(244,244,245,0)', priceLineVisible: false, title: labels.ret, priceFormat: pct })
    const dd = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 }, topLineColor: 'rgba(0,0,0,0)', topFillColor1: 'rgba(0,0,0,0)', topFillColor2: 'rgba(0,0,0,0)',
      bottomLineColor: '#f87171', bottomFillColor1: 'rgba(248,113,113,0.12)', bottomFillColor2: 'rgba(248,113,113,0.4)', lineWidth: 1, priceLineVisible: false, title: labels.dd, priceFormat: pct,
    }, 1)
    // Heures strictement croissantes, à la seconde.
    let last = -Infinity
    const pts = perf.curve.map(p => {
      const s = Math.max(Math.floor(p.t / 1000), last + 1)
      last = s
      return { time: s as UTCTimestamp, ret: (p.value - 1) * 100, dd: p.drawdown * 100 }
    })
    ret.setData(pts.map(p => ({ time: p.time, value: p.ret })))
    dd.setData(pts.map(p => ({ time: p.time, value: p.dd })))
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3)
    panes[1]?.setStretchFactor(1)
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [lang, perf, labels.ret, labels.dd])
  return <div className="lv-chart" ref={box} />
}

function statusClass(s: MatchRow['status']): string {
  return s === 'match' ? 'bt-badge-good' : s === 'open' ? 'bt-badge-ok' : 'bt-badge-bad'
}

function CompareCard({ t, lang, rows, backtest, from }: { t: LiveDict; lang: Lang; rows: MatchRow[]; backtest: Backtest; from: number }) {
  const settled = rows.filter(r => r.status !== 'open')
  const ok = settled.filter(r => r.status === 'match').length
  const time = (x: number | null | undefined) => (x == null ? '—' : fmtDate(x, lang, true))
  return (
    <section className="bt-card">
      <div className="lv-head">
        <h2 className="lv-h2">{t.compare}</h2>
        {settled.length > 0 && <span className={`bt-badge ${ok === settled.length ? 'bt-badge-good' : 'bt-badge-bad'}`}>{t.summary(ok, settled.length)}</span>}
      </div>
      <p className="bt-muted lv-sub">{t.compareSub(fmtNum(backtest.bars, lang, 0), fmtDate(backtest.from, lang))} {t.compareFrom(fmtDate(from, lang, true))}</p>
      {rows.length === 0 ? <p className="bt-muted lv-empty">{t.noCompare}</p> : (
        <div className="bt-table-wrap">
          <table className="bt-table bt-table-compact">
            <thead>
              <tr>
                <th>{t.cDate}</th><th>{t.cSide}</th><th className="num">{t.cEntryBt}</th><th className="num">{t.cEntryLive}</th><th className="num">{t.cSlip}</th>
                <th>{t.cExitBt}</th><th>{t.cExitLive}</th><th className="num">{t.cPnlBt}</th><th className="num">{t.cPnlLive}</th><th>{t.cStatus}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, k) => {
                const dir = (r.backtest ?? r.live)!.dir
                return (
                  <tr key={k}>
                    <td>{time(r.backtest?.entryTime ?? r.live?.entryTime)}</td>
                    <td><span className={dir === 1 ? 'bt-side-long' : 'bt-side-short'}>{dir === 1 ? t.long : t.short}</span></td>
                    <td className="num">{r.backtest ? fmtPrice(r.backtest.entryPx, lang) : '—'}</td>
                    <td className="num">{r.live ? fmtPrice(r.live.entryPx, lang) : '—'}</td>
                    <td className={`num bt-${tone(r.entrySlip)}`}>{Number.isFinite(r.entrySlip) ? fmtPct(r.entrySlip, lang, 3) : '—'}</td>
                    <td>{r.backtest ? (r.backtest.exitTime == null ? t.open : `${time(r.backtest.exitTime)} · ${r.backtest.exits.join('+')}`) : '—'}</td>
                    <td>{r.live ? (r.live.exitTime == null ? t.open : `${time(r.live.exitTime)} · ${r.live.exits.map(e => kindLabel(t, e)).join('+')}`) : '—'}</td>
                    <td className={`num bt-${tone(r.backtest?.pnlPct ?? NaN)}`}>{r.backtest ? fmtPct(r.backtest.pnlPct, lang, 2) : '—'}</td>
                    <td className={`num bt-${tone(r.live?.pnlPct ?? NaN)}`}>{r.live && r.live.exitTime != null ? fmtPct(r.live.pnlPct, lang, 2) : '—'}</td>
                    <td><span className={`bt-badge ${statusClass(r.status)}`}>{t.status[r.status]}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="bt-muted lv-note-small">{t.compareNote}</p>
    </section>
  )
}

function TradesCard({ t, lang, trips, skipped }: { t: LiveDict; lang: Lang; trips: RoundTrip[]; skipped: number }) {
  const rows = [...trips].reverse()
  return (
    <section className="bt-card">
      <h2 className="lv-h2">{t.trades}</h2>
      {rows.length === 0 ? <p className="bt-muted lv-empty">{t.noTrades}</p> : (
        <div className="bt-table-wrap">
          <table className="bt-table bt-table-compact">
            <thead>
              <tr>
                <th>{t.tEntry}</th><th>{t.cSide}</th><th className="num">{t.tQty}</th><th className="num">{t.entry}</th><th>{t.tExit}</th>
                <th>{t.tExits}</th><th className="num">{t.tFees}</th><th className="num">{t.tFunding}</th><th className="num">{t.tPnl}</th><th className="num">{t.tPnlPct}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.entryTime}:${r.dir}`}>
                  <td>{fmtDate(r.entryTime, lang, true)}</td>
                  <td><span className={r.dir === 1 ? 'bt-side-long' : 'bt-side-short'}>{r.dir === 1 ? t.long : t.short}</span>{!r.bot && <span className="bt-chip lv-chip">{t.kind.manual}</span>}</td>
                  <td className="num">{fmtNum(r.qty, lang, 5)}</td>
                  <td className="num">{fmtPrice(r.entryPx, lang)}</td>
                  <td>{r.exitTime == null ? <em className="bt-muted">{t.open}</em> : `${fmtDate(r.exitTime, lang, true)} · ${fmtPrice(r.exitPx ?? NaN, lang)}`}</td>
                  <td>{r.exits.map(e => kindLabel(t, e)).join(' + ') || '—'}</td>
                  <td className="num">{fmtMoney(r.fees, lang)}</td>
                  <td className={`num bt-${tone(r.funding)}`}>{fmtMoney(r.funding, lang)}</td>
                  <td className={`num bt-${tone(r.pnl)}`}>{r.exitTime == null ? '—' : fmtMoney(r.pnl, lang)}</td>
                  <td className={`num bt-${tone(r.pnlPct)}`}>{r.exitTime == null ? '—' : fmtPct(r.pnlPct, lang, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {skipped > 0 && <p className="bt-muted lv-note-small">{t.skipped(skipped)}</p>}
    </section>
  )
}
