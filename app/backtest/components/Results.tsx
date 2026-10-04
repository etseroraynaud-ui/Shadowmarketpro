'use client'

import { useMemo, useState } from 'react'
import type { Bars, Metrics, Settings } from '../../../lib/backtest/types.ts'
import type { RunOutput, StrategySource } from '../../../lib/backtest/index.ts'
import type { Dict, Lang } from '../i18n'
import { fmtMoney, fmtNum, fmtPct, tone } from '../format'
import { PriceChart, EquityChart } from './Charts'
import TradesTable from './TradesTable'
import StatsTable from './StatsTable'
import Monthly from './Monthly'
import Robustness from './Robustness'
import Optimizer from './Optimizer'

type Tab = 'chart' | 'equity' | 'trades' | 'stats' | 'monthly' | 'robust' | 'optimize'
type Quality = { label: string; cls: 'good' | 'ok' | 'bad' } | null

export default function Results({
  out, bars, lang, t, settings, source, intraday, onApplyParams, onEnableSplit,
}: {
  out: RunOutput
  bars: Bars
  lang: Lang
  t: Dict
  settings: Settings
  source: StrategySource
  intraday: boolean
  onApplyParams: (v: Record<string, number>) => void
  onEnableSplit: () => void
}) {
  const [tab, setTab] = useState<Tab>('chart')
  const [log, setLog] = useState<boolean | null>(null)
  const [showTrades, setShowTrades] = useState(true)
  const [showPlots, setShowPlots] = useState(true)
  const r = out.result
  const m = r.metrics
  const bh = r.benchMetrics
  const [priceLog, setPriceLog] = useState<boolean | null>(null)
  const autoPriceLog = useMemo(() => {
    let lo = Infinity
    let hi = 0
    for (let i = r.start; i <= r.end; i++) {
      lo = Math.min(lo, bars.l[i])
      hi = Math.max(hi, bars.h[i])
    }
    return lo > 0 && hi / lo > 8
  }, [bars, r.start, r.end])
  const autoLog = useMemo(() => {
    let lo = Infinity
    let hi = 0
    for (let i = r.start; i <= r.end; i++) {
      lo = Math.min(lo, r.equity[i], r.benchmark[i])
      hi = Math.max(hi, r.equity[i], r.benchmark[i])
    }
    return lo > 0 && hi / lo > 8
  }, [r])
  const useLog = log ?? autoLog

  const q = qualities(m, t)
  const badges = verdictBadges(m, bh, t)
  const chartLabels = useMemo(() => ({ buy: t.entryLong, sell: t.entryShort, oos: t.outSample }), [t])
  const eqLabels = useMemo(() => ({ strategy: t.strategy, bh: t.buyHold, dd: t.drawdown, oos: t.outSample }), [t])

  const kpis: { key: keyof Metrics; label: string; help: string; value: string; sub?: string; tone: string; q: Quality }[] = [
    { key: 'totalReturn', label: t.kpi_totalReturn, help: t.help_totalReturn, value: fmtPct(m.totalReturn, lang), sub: `${t.buyHold} ${fmtPct(bh.totalReturn, lang)}`, tone: tone(m.totalReturn), q: null },
    { key: 'cagr', label: t.kpi_cagr, help: t.help_cagr, value: fmtPct(m.cagr, lang), sub: `${t.buyHold} ${fmtPct(bh.cagr, lang)}`, tone: tone(m.cagr), q: null },
    { key: 'maxDrawdown', label: t.kpi_maxDrawdown, help: t.help_maxDrawdown, value: fmtPct(m.maxDrawdown, lang, 1, false), sub: `${t.buyHold} ${fmtPct(bh.maxDrawdown, lang, 1, false)}`, tone: m.maxDrawdown < 0 ? 'neg' : 'neu', q: q.dd },
    { key: 'sharpe', label: t.kpi_sharpe, help: t.help_sharpe, value: fmtNum(m.sharpe, lang, 2), sub: `${t.buyHold} ${fmtNum(bh.sharpe, lang, 2)}`, tone: 'neu', q: q.sharpe },
    { key: 'profitFactor', label: t.kpi_profitFactor, help: t.help_profitFactor, value: m.trades ? fmtNum(m.profitFactor, lang, 2) : '—', tone: 'neu', q: q.pf },
    { key: 'winRate', label: t.kpi_winRate, help: t.help_winRate, value: m.trades ? fmtPct(m.winRate, lang, 0, false) : '—', sub: m.trades ? `${t.payoffShort} ${fmtNum(m.payoff, lang, 2)}` : undefined, tone: 'neu', q: null },
    { key: 'trades', label: t.kpi_trades, help: t.help_trades, value: String(m.trades), sub: m.trades ? `${m.longTrades} ${t.long.toLowerCase()} · ${m.shortTrades} ${t.short.toLowerCase()}` : undefined, tone: 'neu', q: q.trades },
    { key: 'exposure', label: t.kpi_exposure, help: t.help_exposure, value: fmtPct(m.exposure, lang, 0, false), tone: 'neu', q: null },
  ]

  const tabs: [Tab, string][] = [
    ['chart', t.tab_chart], ['equity', t.tab_equity], ['trades', `${t.tab_trades} (${r.trades.length})`], ['stats', t.tab_stats],
    ['monthly', t.tab_monthly], ['robust', t.tab_robust], ['optimize', t.tab_optimize],
  ]

  return (
    <div className="bt-results">
      <section className="bt-card bt-verdict">
        <div className="bt-verdict-badges">
          {badges.map(b => <span key={b.label} className={`bt-badge bt-badge-${b.cls}`}>{b.label}</span>)}
          <span className="bt-verdict-time">{out.name ? `${out.name} · ` : ''}{t.computedIn(fmtNum(out.ms, lang, 0))}</span>
        </div>
        <p className="bt-verdict-text">
          {m.trades === 0 ? t.verdictNoTrade : (
            <>
              <strong>{t.verdictMain(fmtMoney(m.startEquity, lang), fmtMoney(m.endEquity, lang), fmtPct(m.totalReturn, lang), fmtPct(bh.totalReturn, lang))}</strong>{' '}
              {t.verdictRisk(fmtPct(m.maxDrawdown, lang, 1, false), fmtPct(bh.maxDrawdown, lang, 1, false))}{' '}
              {t.verdictTrades(m.trades, fmtPct(m.winRate, lang, 0, false))}
            </>
          )}
        </p>
      </section>

      {out.warnings.length > 0 && (
        <div className="bt-warn" role="status">
          {out.warnings.map((w, k) => <p key={k}>{w[lang]}</p>)}
        </div>
      )}

      <section className="bt-kpis">
        {kpis.map(k => (
          <div key={k.key} className="bt-kpi">
            <div className="bt-kpi-head">
              <span>{k.label}</span>
              <span className="bt-help" tabIndex={0} aria-label={k.help}>?<span className="bt-tip">{k.help}</span></span>
            </div>
            <div className={`bt-kpi-val bt-${k.tone}`}>{k.value}</div>
            <div className="bt-kpi-foot">
              {k.sub && <span className="bt-kpi-sub">{k.sub}</span>}
              {k.q && <span className={`bt-q bt-q-${k.q.cls}`}>{k.q.label}</span>}
            </div>
          </div>
        ))}
      </section>

      <section className="bt-card bt-tabs-card">
        <div className="bt-tabs" role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'bt-tab on' : 'bt-tab'} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="bt-tab-body">
          {tab === 'chart' && (
            <>
              <div className="bt-chart-tools">
                <label className="bt-check"><input type="checkbox" checked={showTrades} onChange={e => setShowTrades(e.target.checked)} /> {t.showTrades}</label>
                {out.plots.length > 0 && <label className="bt-check"><input type="checkbox" checked={showPlots} onChange={e => setShowPlots(e.target.checked)} /> {t.showIndicators}</label>}
                <label className="bt-check"><input type="checkbox" checked={priceLog ?? autoPriceLog} onChange={e => setPriceLog(e.target.checked)} /> {t.logScale}</label>
                <span className="bt-legend"><i className="lg-up" /> {t.entryLong} <i className="lg-dn" /> {t.entryShort} <i className="lg-exit" /> {t.exit}</span>
              </div>
              <PriceChart bars={bars} trades={r.trades} plots={out.plots} start={r.start} end={r.end} split={r.split} lang={lang} labels={chartLabels} showTrades={showTrades} showPlots={showPlots} intraday={intraday} log={priceLog ?? autoPriceLog} />
            </>
          )}
          {tab === 'equity' && (
            <>
              <div className="bt-chart-tools">
                <label className="bt-check"><input type="checkbox" checked={useLog} onChange={e => setLog(e.target.checked)} /> {t.logScale}</label>
                <span className="bt-legend"><i className="lg-eq" /> {t.strategy} <i className="lg-bh" /> {t.buyHold} <i className="lg-dd" /> {t.drawdown}</span>
              </div>
              <EquityChart bars={bars} equity={r.equity} benchmark={r.benchmark} drawdown={r.drawdown} start={r.start} end={r.end} split={r.split} lang={lang} labels={eqLabels} log={useLog} intraday={intraday} />
            </>
          )}
          {tab === 'trades' && <TradesTable trades={r.trades} lang={lang} t={t} intraday={intraday} />}
          {tab === 'stats' && <StatsTable result={r} lang={lang} t={t} />}
          {tab === 'monthly' && <Monthly bars={bars} result={r} lang={lang} t={t} />}
          {tab === 'robust' && <Robustness bars={bars} result={r} settings={settings} lang={lang} t={t} onEnableSplit={onEnableSplit} />}
          {tab === 'optimize' && <Optimizer bars={bars} source={source} inputs={out.inputs} settings={settings} lang={lang} t={t} onApply={onApplyParams} onEnableSplit={onEnableSplit} />}
        </div>
      </section>
    </div>
  )
}

function qualities(m: Metrics, t: Dict) {
  const sharpe: Quality = m.trades === 0 ? null
    : m.sharpe > 2.5 ? { label: t.q_suspicious, cls: 'ok' }
    : m.sharpe >= 1.5 ? { label: t.q_great, cls: 'good' }
    : m.sharpe >= 1 ? { label: t.q_good, cls: 'good' }
    : m.sharpe >= 0.5 ? { label: t.q_ok, cls: 'ok' }
    : { label: t.q_weak, cls: 'bad' }
  const dd: Quality = m.maxDrawdown > -0.2 ? { label: t.q_mild, cls: 'good' } : m.maxDrawdown > -0.4 ? { label: t.q_moderate, cls: 'ok' } : { label: t.q_severe, cls: 'bad' }
  const pf: Quality = m.trades === 0 ? null
    : m.profitFactor < 1 ? { label: t.q_losing, cls: 'bad' }
    : m.profitFactor < 1.3 ? { label: t.q_weak, cls: 'ok' }
    : m.profitFactor < 2 ? { label: t.q_good, cls: 'good' }
    : { label: t.q_great, cls: 'good' }
  const trades: Quality = m.trades > 0 && m.trades < 30 ? { label: t.q_fragile, cls: 'ok' } : null
  return { sharpe, dd, pf, trades }
}

function verdictBadges(m: Metrics, bh: Metrics, t: Dict): { label: string; cls: 'good' | 'ok' | 'bad' }[] {
  if (m.trades === 0) return [{ label: t.badge_noTrade, cls: 'bad' }]
  const out: { label: string; cls: 'good' | 'ok' | 'bad' }[] = []
  if (m.totalReturn < 0) out.push({ label: t.badge_negative, cls: 'bad' })
  else if (m.totalReturn > bh.totalReturn) out.push({ label: t.badge_beats, cls: 'good' })
  else out.push({ label: t.badge_loses, cls: 'ok' })
  if (m.totalReturn >= 0 && m.maxDrawdown > bh.maxDrawdown + 0.05 && m.sharpe >= bh.sharpe) out.push({ label: t.badge_safer, cls: 'good' })
  if (m.trades < 30) out.push({ label: t.badge_fewTrades, cls: 'ok' })
  return out
}
