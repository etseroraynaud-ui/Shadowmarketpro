'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bars, InputDef, Settings } from '../../../lib/backtest/types.ts'
import type { StrategySource } from '../../../lib/backtest/index.ts'
import { optimize, axisValues, MAX_RUNS } from '../../../lib/backtest/optimize.ts'
import type { Objective, OptParam, OptResult, OptCell } from '../../../lib/backtest/optimize.ts'
import { windowIndices } from '../../../lib/backtest/engine.ts'
import type { Dict, Lang } from '../i18n'
import { fmtNum, fmtPct } from '../format'

const OBJECTIVES: Objective[] = ['sharpe', 'totalReturn', 'cagr', 'profitFactor', 'calmar', 'sortino']

function defaultRange(d: InputDef, current: number): OptParam {
  if (d.kind === 'bool') return { name: d.name, from: 0, to: 1, step: 1 }
  let from = d.min ?? (d.kind === 'int' ? Math.max(1, Math.round(current / 2)) : current / 2)
  let to = d.max ?? (d.kind === 'int' ? Math.round(current * 2) : current * 2)
  if (to <= from) to = from + (d.kind === 'int' ? 10 : 1)
  // Environ 15 valeurs par axe.
  let step = d.step ?? (to - from) / 14
  if (d.kind === 'int') step = Math.max(1, Math.round((to - from) / 14))
  else step = Number(step.toPrecision(2))
  from = Number(from.toPrecision(6))
  return { name: d.name, from, to, step }
}

function cellColor(score: number, lo: number, hi: number, valid: boolean): string {
  if (!valid || !Number.isFinite(score)) return 'rgba(255,255,255,0.03)'
  const x = hi > lo ? (score - lo) / (hi - lo) : 0.5
  // Du rouge au vert en passant par un gris neutre.
  if (x < 0.5) return `rgba(248,113,113,${0.08 + (0.5 - x) * 0.9})`
  return `rgba(52,211,153,${0.08 + (x - 0.5) * 1.1})`
}

export default function Optimizer({
  bars, source, inputs, settings, lang, t, onApply, onEnableSplit,
}: {
  bars: Bars
  source: StrategySource
  inputs: InputDef[]
  settings: Settings
  lang: Lang
  t: Dict
  onApply: (v: Record<string, number>) => void
  onEnableSplit: () => void
}) {
  const overrides = source.kind === 'script' ? source.overrides : {}
  const numeric = inputs
  const current = (d: InputDef) => (overrides[d.name] ?? d.defval)
  const [p1, setP1] = useState<OptParam | null>(() => (numeric[0] ? defaultRange(numeric[0], current(numeric[0])) : null))
  const [p2, setP2] = useState<OptParam | null>(() => (numeric[1] ? defaultRange(numeric[1], current(numeric[1])) : null))
  const [objective, setObjective] = useState<Objective>('sharpe')
  const [minTrades, setMinTrades] = useState(10)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [res, setRes] = useState<OptResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const worker = useRef<Worker | null>(null)
  useEffect(() => () => worker.current?.terminate(), [])

  const names = inputs.map(i => i.name).join(',')
  useEffect(() => {
    // Le script a changé de paramètres : on repart des valeurs par défaut.
    if (p1 && !inputs.some(i => i.name === p1.name)) setP1(numeric[0] ? defaultRange(numeric[0], current(numeric[0])) : null)
    if (p2 && !inputs.some(i => i.name === p2.name)) setP2(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names])

  const params = useMemo(() => [p1, p2].filter((p): p is OptParam => !!p), [p1, p2])
  const total = params.reduce((a, p) => a * axisValues(p).length, 1)
  const hasSplit = windowIndices(bars, settings).split > 0

  if (source.kind !== 'script') return <p className="bt-muted">{t.optNoScript}</p>
  if (!inputs.length) return <p className="bt-muted">{t.optNoInputs}</p>

  const run = () => {
    setError(null)
    setRes(null)
    setProgress({ done: 0, total })
    const job = { bars, script: source.code, overrides, params, settings, objective, minTrades }
    try {
      worker.current?.terminate()
      const w = new Worker(new URL('../../../lib/backtest/optimizer.worker.ts', import.meta.url), { type: 'module' })
      worker.current = w
      w.onmessage = (e: MessageEvent) => {
        const m = e.data
        if (m.type === 'progress') setProgress({ done: m.done, total: m.total })
        else if (m.type === 'done') { setRes(m.result); setProgress(null); w.terminate() }
        else if (m.type === 'error') { setError(m.message); setProgress(null); w.terminate() }
      }
      w.onerror = () => {
        // Sans worker (navigateur restrictif), calcul sur la page.
        w.terminate()
        runInline(job)
      }
      w.postMessage(job)
    } catch {
      runInline(job)
    }
  }
  const runInline = (job: { params: OptParam[] }) => {
    setTimeout(() => {
      try {
        setRes(optimize(bars, source.code, overrides, job.params, settings, objective, minTrades))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
      setProgress(null)
    }, 30)
  }

  const paramEditor = (p: OptParam | null, set: (p: OptParam | null) => void, allowNone: boolean, other: OptParam | null) => (
    <div className="bt-opt-param">
      <label className="bt-field">
        <span>{t.optParam}</span>
        <select value={p?.name ?? ''} onChange={e => {
          const d = inputs.find(i => i.name === e.target.value)
          set(d ? defaultRange(d, current(d)) : null)
        }}>
          {allowNone && <option value="">{t.optNone}</option>}
          {inputs.filter(i => i.name !== other?.name).map(i => <option key={i.name} value={i.name}>{i.title}</option>)}
        </select>
      </label>
      {p && (
        <div className="bt-opt-range">
          <label className="bt-field"><span>{t.optFrom}</span><input type="number" value={p.from} step="any" onChange={e => set({ ...p, from: Number(e.target.value) })} /></label>
          <label className="bt-field"><span>{t.optTo}</span><input type="number" value={p.to} step="any" onChange={e => set({ ...p, to: Number(e.target.value) })} /></label>
          <label className="bt-field"><span>{t.optStep}</span><input type="number" value={p.step} step="any" min={0} onChange={e => set({ ...p, step: Number(e.target.value) })} /></label>
        </div>
      )}
    </div>
  )

  const titleOf = (name: string) => inputs.find(i => i.name === name)?.title ?? name
  const scoreFmt = (v: number) => (objective === 'totalReturn' || objective === 'cagr' ? fmtPct(v, lang, 1) : fmtNum(v, lang, 2))

  return (
    <div className="bt-opt">
      <p className="bt-muted">{t.optIntro}</p>
      {!hasSplit && (
        <div className="bt-warn bt-warn-inline">
          <p>{t.optWarnNoSplit}</p>
          <button className="bt-btn bt-btn-ghost" onClick={onEnableSplit}>{t.splitEnable}</button>
        </div>
      )}
      <div className="bt-opt-form">
        {paramEditor(p1, setP1, false, p2)}
        {paramEditor(p2, setP2, true, p1)}
        <div className="bt-opt-row">
          <label className="bt-field">
            <span>{t.optObjective}</span>
            <select value={objective} onChange={e => setObjective(e.target.value as Objective)}>
              {OBJECTIVES.map(o => <option key={o} value={o}>{t[`obj_${o}` as const]}</option>)}
            </select>
          </label>
          <label className="bt-field">
            <span>{t.optMinTrades}</span>
            <input type="number" min={0} value={minTrades} onChange={e => setMinTrades(Math.max(0, Number(e.target.value)))} />
          </label>
          <div className="bt-opt-go">
            <span className={total > MAX_RUNS ? 'bt-neg bt-small' : 'bt-muted bt-small'}>{total > MAX_RUNS ? t.optTooMany(total, MAX_RUNS) : t.optCombos(total)}</span>
            <button className="bt-btn bt-btn-primary" disabled={!!progress || total > MAX_RUNS || !params.length} onClick={run}>
              {progress ? t.optRunning(progress.done, progress.total) : t.optRun}
            </button>
          </div>
        </div>
        {progress && <div className="bt-progress"><div style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} /></div>}
      </div>
      {error && <div className="bt-error">{error}</div>}
      {res && <OptResultView res={res} lang={lang} t={t} titleOf={titleOf} scoreFmt={scoreFmt} onApply={onApply} />}
    </div>
  )
}

function OptResultView({
  res, lang, t, titleOf, scoreFmt, onApply,
}: {
  res: OptResult
  lang: Lang
  t: Dict
  titleOf: (n: string) => string
  scoreFmt: (v: number) => string
  onApply: (v: Record<string, number>) => void
}) {
  const valid = res.cells.filter(c => c.valid && Number.isFinite(c.score))
  const lo = Math.min(...valid.map(c => c.score))
  const hi = Math.max(...valid.map(c => c.score))
  const best = res.best
  const tip = (c: OptCell) => `${res.params.map((p, k) => `${titleOf(p.name)} = ${c.values[k]}`).join(', ')}\n${t[`obj_${res.objective}` as const]} : ${c.valid ? scoreFmt(c.score) : t.optInvalid}\n${t.stat_totalReturn} : ${fmtPct(c.totalReturn, lang)}\n${t.stat_maxDrawdown} : ${fmtPct(c.maxDrawdown, lang, 1, false)}\n${t.stat_trades} : ${c.trades}`
  const isBest = (c: OptCell) => !!best && c.values.every((v, k) => v === best.values[k])
  return (
    <div className="bt-opt-res">
      {best ? (
        <div className="bt-opt-best">
          <div>
            <span className="bt-muted bt-small">{t.optBest}</span>
            <strong>{res.params.map((p, k) => `${titleOf(p.name)} = ${fmtNum(best.values[k], lang, 4)}`).join(' · ')}</strong>
            <span className="bt-muted bt-small">
              {t.inSample} : {t[`obj_${res.objective}` as const]} {scoreFmt(best.score)} · {fmtPct(best.totalReturn, lang)} · {best.trades} trades
              {res.bestOut && <> — {t.outSample} : Sharpe {fmtNum(res.bestOut.sharpe, lang, 2)} · {fmtPct(res.bestOut.totalReturn, lang)} · {res.bestOut.trades} trades</>}
            </span>
          </div>
          <button className="bt-btn bt-btn-primary" onClick={() => {
            const v: Record<string, number> = {}
            res.params.forEach((p, k) => { v[p.name] = best.values[k] })
            onApply(v)
          }}>{t.optApply}</button>
        </div>
      ) : <p className="bt-muted">{t.optInvalid}</p>}

      {res.params.length === 2 ? (
        <div className="bt-heatmap-wrap">
          <div className="bt-heatmap-ylabel">{titleOf(res.params[0].name)} ↓ · {titleOf(res.params[1].name)} →</div>
          <div className="bt-table-wrap">
            <table className="bt-heatmap">
              <thead>
                <tr><th />{res.axes[1].map(v => <th key={v}>{fmtNum(v, lang, 3)}</th>)}</tr>
              </thead>
              <tbody>
                {res.axes[0].map((a, i) => (
                  <tr key={a}>
                    <th>{fmtNum(a, lang, 3)}</th>
                    {res.axes[1].map((b, j) => {
                      const c = res.cells[i * res.axes[1].length + j]
                      return (
                        <td key={b} title={tip(c)} className={isBest(c) ? 'best' : ''} style={{ background: cellColor(c.score, lo, hi, c.valid) }}>
                          {c.valid ? scoreFmt(c.score) : '·'}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bt-bars1d">
          {res.cells.map(c => {
            const h = c.valid && hi > lo ? 8 + ((c.score - lo) / (hi - lo)) * 92 : c.valid ? 50 : 4
            return (
              <div key={c.values[0]} className="bt-bar1d" title={tip(c)}>
                <div className={`bt-bar1d-fill${isBest(c) ? ' best' : ''}${c.valid ? '' : ' invalid'}`} style={{ height: `${h}%`, background: cellColor(c.score, lo, hi, c.valid) }} />
                <span>{fmtNum(c.values[0], lang, 3)}</span>
              </div>
            )
          })}
        </div>
      )}
      <p className="bt-muted bt-small">{t.optWarnOverfit}</p>
    </div>
  )
}
