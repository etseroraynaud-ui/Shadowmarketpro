'use client'

import { useEffect, useRef } from 'react'
import {
  createChart, createSeriesMarkers, CandlestickSeries, LineSeries, AreaSeries, BaselineSeries, ColorType, CrosshairMode, LineStyle, PriceScaleMode,
} from 'lightweight-charts'
import type { IChartApi, UTCTimestamp, SeriesMarker, Time, DeepPartial, ChartOptions } from 'lightweight-charts'
import type { Bars, Plot, Trade } from '../../../lib/backtest/types.ts'
import type { Lang } from '../i18n'

const UP = '#34d399'
const DOWN = '#f87171'

function baseOptions(lang: Lang, intraday: boolean): DeepPartial<ChartOptions> {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#a1a1aa',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      fontSize: 11,
      panes: { separatorColor: 'rgba(255,255,255,0.08)', separatorHoverColor: 'rgba(255,255,255,0.15)', enableResize: true },
    },
    grid: { vertLines: { color: 'rgba(255,255,255,0.035)' }, horzLines: { color: 'rgba(255,255,255,0.035)' } },
    crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#27272a' }, horzLine: { color: 'rgba(255,255,255,0.25)', labelBackgroundColor: '#27272a' } },
    rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
    timeScale: { borderColor: 'rgba(255,255,255,0.08)', timeVisible: intraday, secondsVisible: false, minBarSpacing: 0.001 },
    localization: { locale: lang === 'fr' ? 'fr-FR' : 'en-US' },
  }
}

function priceFormatter(lang: Lang) {
  const loc = lang === 'fr' ? 'fr-FR' : 'en-US'
  const f0 = new Intl.NumberFormat(loc, { maximumFractionDigits: 0 })
  const f2 = new Intl.NumberFormat(loc, { maximumFractionDigits: 2 })
  const f5 = new Intl.NumberFormat(loc, { maximumSignificantDigits: 5 })
  return (v: number) => (Math.abs(v) >= 1000 ? f0.format(v) : Math.abs(v) >= 1 ? f2.format(v) : f5.format(v))
}

const sec = (ms: number) => Math.floor(ms / 1000) as UTCTimestamp

export function PriceChart({
  bars, trades, plots, start, end, split, lang, labels, showTrades, showPlots, intraday, log,
}: {
  bars: Bars
  trades: Trade[]
  plots: Plot[]
  start: number
  end: number
  split: number
  lang: Lang
  labels: { buy: string; sell: string; oos: string }
  showTrades: boolean
  showPlots: boolean
  intraday: boolean
  log: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const chart: IChartApi = createChart(box.current, baseOptions(lang, intraday))
    chart.priceScale('right', 0).applyOptions({ mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal })
    const lastPrice = bars.c[end]
    const priceFormat = { type: 'custom' as const, formatter: priceFormatter(lang), minMove: lastPrice >= 1 ? 0.01 : 0.000001 }
    const candles = chart.addSeries(CandlestickSeries, {
      upColor: UP, downColor: DOWN, borderUpColor: UP, borderDownColor: DOWN, wickUpColor: UP, wickDownColor: DOWN,
      priceLineVisible: false, priceFormat,
    })
    const data = []
    for (let i = start; i <= end; i++) data.push({ time: sec(bars.t[i]), open: bars.o[i], high: bars.h[i], low: bars.l[i], close: bars.c[i] })
    candles.setData(data)
    let hasPane = false
    if (showPlots) {
      for (const p of plots) {
        const pane = p.overlay ? 0 : 1
        if (pane === 1) hasPane = true
        const s = chart.addSeries(LineSeries, {
          color: p.color || '#f5b942', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: p.title, crosshairMarkerVisible: false,
          ...(p.overlay ? { priceFormat } : {}),
        }, pane)
        const pts = []
        for (let i = start; i <= end; i++) {
          const v = p.values[i]
          pts.push(Number.isFinite(v) ? { time: sec(bars.t[i]), value: v } : { time: sec(bars.t[i]) })
        }
        s.setData(pts)
      }
    }
    if (hasPane) {
      const panes = chart.panes()
      panes[0]?.setStretchFactor(3)
      panes[1]?.setStretchFactor(1)
    }
    const markers: SeriesMarker<Time>[] = []
    if (showTrades) {
      const withText = trades.length <= 15
      for (const t of trades) {
        if (t.entryIdx < start || t.entryIdx > end) continue
        markers.push(t.dir === 1
          ? { time: sec(t.entryTime), position: 'belowBar', color: UP, shape: 'arrowUp', text: withText ? labels.buy : '' }
          : { time: sec(t.entryTime), position: 'aboveBar', color: DOWN, shape: 'arrowDown', text: withText ? labels.sell : '' })
        markers.push({ time: sec(t.exitTime), position: t.dir === 1 ? 'aboveBar' : 'belowBar', color: t.pnl > 0 ? UP : DOWN, shape: 'circle', size: 0.6 })
      }
    }
    if (split > 0) markers.push({ time: sec(bars.t[split]), position: 'aboveBar', color: '#a1a1aa', shape: 'square', size: 0.5, text: labels.oos })
    markers.sort((a, b) => (a.time as number) - (b.time as number))
    createSeriesMarkers(candles, markers)
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [bars, trades, plots, start, end, split, lang, labels.buy, labels.sell, labels.oos, showTrades, showPlots, intraday, log])
  return <div className="bt-chart bt-chart-price" ref={box} />
}

export function EquityChart({
  bars, equity, benchmark, drawdown, start, end, split, lang, labels, log, intraday,
}: {
  bars: Bars
  equity: Float64Array
  benchmark: Float64Array
  drawdown: Float64Array
  start: number
  end: number
  split: number
  lang: Lang
  labels: { strategy: string; bh: string; dd: string; oos: string }
  log: boolean
  intraday: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!box.current) return
    const chart = createChart(box.current, baseOptions(lang, intraday))
    chart.priceScale('right', 0).applyOptions({ mode: log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal })
    const fmt = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { maximumFractionDigits: 0 })
    const priceFormat = { type: 'custom' as const, formatter: (v: number) => fmt.format(v), minMove: 1 }
    const bh = chart.addSeries(LineSeries, { color: '#71717a', lineWidth: 2, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: true, title: labels.bh, priceFormat })
    const st = chart.addSeries(AreaSeries, {
      lineColor: '#f4f4f5', lineWidth: 2, topColor: 'rgba(244,244,245,0.16)', bottomColor: 'rgba(244,244,245,0.0)',
      priceLineVisible: false, title: labels.strategy, priceFormat,
    })
    const dd = chart.addSeries(BaselineSeries, {
      baseValue: { type: 'price', price: 0 },
      topLineColor: 'rgba(0,0,0,0)', topFillColor1: 'rgba(0,0,0,0)', topFillColor2: 'rgba(0,0,0,0)',
      bottomLineColor: DOWN, bottomFillColor1: 'rgba(248,113,113,0.12)', bottomFillColor2: 'rgba(248,113,113,0.4)',
      lineWidth: 1, priceLineVisible: false, title: labels.dd,
      priceFormat: { type: 'custom', formatter: (v: number) => `${v.toFixed(1)}%`, minMove: 0.1 },
    }, 1)
    const e = []
    const b = []
    const d = []
    for (let i = start; i <= end; i++) {
      const time = sec(bars.t[i])
      e.push({ time, value: equity[i] })
      b.push({ time, value: benchmark[i] })
      d.push({ time, value: drawdown[i] * 100 })
    }
    chart.priceScale('right', 1).applyOptions({ mode: PriceScaleMode.Normal, scaleMargins: { top: 0.08, bottom: 0.04 } })
    st.setData(e)
    bh.setData(b)
    dd.setData(d)
    if (split > 0) createSeriesMarkers(st, [{ time: sec(bars.t[split]), position: 'aboveBar', color: '#a1a1aa', shape: 'square', size: 0.5, text: labels.oos }])
    const panes = chart.panes()
    panes[0]?.setStretchFactor(3)
    panes[1]?.setStretchFactor(1)
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [bars, equity, benchmark, drawdown, start, end, split, lang, labels.strategy, labels.bh, labels.dd, labels.oos, log, intraday])
  return <div className="bt-chart bt-chart-equity" ref={box} />
}
