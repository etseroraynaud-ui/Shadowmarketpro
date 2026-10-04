'use client'

import { useMemo } from 'react'
import type { BacktestResult, Bars, Metrics, Settings } from '../../../lib/backtest/types.ts'
import { randomEntryTest, tradeBootstrap } from '../../../lib/backtest/robustness.ts'
import type { Dict, Lang } from '../i18n'
import { fmtNum, fmtPct, tone } from '../format'

const N_SIMS = 1000

/** Histogramme sur l'échelle log(1 + r), avec la position de la stratégie. */
function Histogram({ sims, mark, lang }: { sims: Float64Array; mark: number; lang: Lang }) {
  const W = 640
  const H = 150
  const pad = { l: 8, r: 8, t: 22, b: 26 }
  const tx = (r: number) => Math.log(Math.max(1e-6, 1 + r))
  const xs = Array.from(sims, tx)
  const m = tx(mark)
  const lo = Math.min(xs[0], m)
  const hi = Math.max(xs[xs.length - 1], m)
  const span = hi - lo || 1
  const nb = 40
  const counts = new Array(nb).fill(0)
  for (const x of xs) counts[Math.min(nb - 1, Math.floor(((x - lo) / span) * nb))]++
  const max = Math.max(...counts)
  const X = (x: number) => pad.l + ((x - lo) / span) * (W - pad.l - pad.r)
  const bw = (W - pad.l - pad.r) / nb
  const ticks = [lo, lo + span / 2, hi]
  return (
    <svg className="bt-hist" viewBox={`0 0 ${W} ${H}`} role="img" preserveAspectRatio="none">
      {counts.map((c, k) => {
        const h = (c / max) * (H - pad.t - pad.b)
        const x0 = lo + (k / nb) * span
        return <rect key={k} x={pad.l + k * bw + 1} y={H - pad.b - h} width={Math.max(1, bw - 2)} height={h} rx={2} className={x0 + span / nb <= m ? 'hb-below' : 'hb-above'} />
      })}
      <line x1={X(m)} x2={X(m)} y1={pad.t - 6} y2={H - pad.b} className="hb-mark" />
      <text x={Math.min(W - 60, Math.max(60, X(m)))} y={12} className="hb-label" textAnchor="middle">{fmtPct(mark, lang)}</text>
      {ticks.map((v, k) => (
        <text key={k} x={X(v)} y={H - 8} className="hb-tick" textAnchor={k === 0 ? 'start' : k === 2 ? 'end' : 'middle'}>{fmtPct(Math.exp(v) - 1, lang, 0)}</text>
      ))}
    </svg>
  )
}

export default function Robustness({
  bars, result, settings, lang, t, onEnableSplit,
}: {
  bars: Bars
  result: BacktestResult
  settings: Settings
  lang: Lang
  t: Dict
  onEnableSplit: () => void
}) {
  const rnd = useMemo(() => randomEntryTest(bars, result, settings, N_SIMS), [bars, result, settings])
  const boot = useMemo(() => tradeBootstrap(result.trades, N_SIMS), [result])
  const ins = result.inSample
  const oos = result.outSample
  let splitVerdict: { text: string; cls: string } | null = null
  if (ins && oos) {
    if (oos.totalReturn < 0) splitVerdict = { text: t.split_fails, cls: 'bad' }
    else if (ins.sharpe > 0 && oos.sharpe < ins.sharpe * 0.5) splitVerdict = { text: t.split_degrades, cls: 'ok' }
    else splitVerdict = { text: t.split_holds, cls: 'good' }
  }
  const rows: [string, (m: Metrics) => string, (m: Metrics) => number][] = [
    [t.stat_cagr, m => fmtPct(m.cagr, lang), m => m.cagr],
    [t.stat_sharpe, m => fmtNum(m.sharpe, lang, 2), () => 0],
    [t.stat_maxDrawdown, m => fmtPct(m.maxDrawdown, lang, 1, false), () => 0],
    [t.stat_trades, m => String(m.trades), () => 0],
    [t.stat_winRate, m => (m.trades ? fmtPct(m.winRate, lang, 0, false) : '—'), () => 0],
    [t.stat_profitFactor, m => (m.trades ? fmtNum(m.profitFactor, lang, 2) : '—'), () => 0],
  ]
  return (
    <div className="bt-robust">
      <p className="bt-muted">{t.robustIntro}</p>

      <div className="bt-rb-card">
        <h4>1 · {t.randomTitle}</h4>
        {!rnd ? <p className="bt-muted">{t.randomNotEnough}</p> : (
          <>
            <p className="bt-muted">{t.randomText(fmtNum(N_SIMS, lang, 0))}</p>
            <p className="bt-rb-big">
              {t.randomBeats(fmtPct(rnd.percentile, lang, 1, false))}{' '}
              <span className={`bt-q bt-q-${rnd.percentile >= 0.95 ? 'good' : rnd.percentile >= 0.8 ? 'ok' : 'bad'}`}>
                {rnd.percentile >= 0.95 ? t.random_strong : rnd.percentile >= 0.8 ? t.random_mid : t.random_weak}
              </span>
            </p>
            <Histogram sims={rnd.sims} mark={rnd.strategy} lang={lang} />
            <p className="bt-muted bt-small">{t.randomMedian} : {fmtPct(rnd.median, lang)} · 5 % – 95 % : {fmtPct(rnd.p5, lang)} → {fmtPct(rnd.p95, lang)}</p>
          </>
        )}
      </div>

      <div className="bt-rb-card">
        <h4>2 · {t.splitTitle}</h4>
        {!ins || !oos ? (
          <div className="bt-rb-off">
            <p className="bt-muted">{t.splitOff}</p>
            <button className="bt-btn bt-btn-ghost" onClick={onEnableSplit}>{t.splitEnable}</button>
          </div>
        ) : (
          <>
            <p className="bt-muted">{t.splitText}</p>
            <table className="bt-table bt-table-compact">
              <thead><tr><th /><th className="num">{t.inSample}</th><th className="num">{t.outSample}</th></tr></thead>
              <tbody>
                {rows.map(([label, f, sgn]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className={`num bt-${tone(sgn(ins))}`}>{f(ins)}</td>
                    <td className={`num bt-${tone(sgn(oos))}`}>{f(oos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {splitVerdict && <p className="bt-rb-big"><span className={`bt-q bt-q-${splitVerdict.cls}`}>{splitVerdict.text}</span></p>}
          </>
        )}
      </div>

      <div className="bt-rb-card">
        <h4>3 · {t.bootTitle}</h4>
        {!boot ? <p className="bt-muted">{t.bootNotEnough}</p> : (
          <>
            <p className="bt-muted">{t.bootText}</p>
            <div className="bt-rb-grid">
              <div><span className="bt-muted bt-small">{t.bootProbLoss}</span><strong className={boot.probLoss > 0.2 ? 'bt-neg' : ''}>{fmtPct(boot.probLoss, lang, 1, false)}</strong></div>
              <div><span className="bt-muted bt-small">{t.bootRange}</span><strong>{fmtPct(boot.final5, lang, 0)} → {fmtPct(boot.final95, lang, 0)}</strong></div>
              <div><span className="bt-muted bt-small">{t.bootDd}</span><strong className="bt-neg">{fmtPct(boot.dd95, lang, 1, false)}</strong></div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
