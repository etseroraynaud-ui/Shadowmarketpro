'use client'

import Link from 'next/link'
import type { ShockParams } from '../../../lib/strategies/shock/params.ts'
import { SHOCK_INPUTS, SHOCK_PRESETS } from '../../../lib/strategies/shock/adapter.ts'
import type { Adaptive, ShockInput } from '../../../lib/strategies/shock/adapter.ts'
import type { Dict, Lang } from '../i18n'

export default function ShockPanel({
  t, lang, preset, onPreset, params, onParams, adaptive, dataTf, onLoadTf,
}: {
  t: Dict
  lang: Lang
  preset: string
  onPreset: (id: string) => void
  params: ShockParams
  onParams: (p: ShockParams) => void
  adaptive: Adaptive | null
  /** Timeframe des données chargées, en minutes (null si inconnu). */
  dataTf: number | null
  onLoadTf: (tf: number) => void
}) {
  const current = SHOCK_PRESETS.find(p => p.id === preset)
  const groups: [string, ShockInput[]][] = []
  for (const inp of SHOCK_INPUTS) {
    const g = groups.find(x => x[0] === inp.group)
    if (g) g[1].push(inp)
    else groups.push([inp.group, [inp]])
  }
  const set = (key: keyof ShockParams, v: unknown) => onParams({ ...params, [key]: v } as ShockParams)
  const tfMismatch = current?.tf != null && dataTf != null && current.tf !== dataTf

  return (
    <div className="bt-shock">
      <p className="bt-muted bt-small">{t.shockIntro}</p>

      <div className="bt-field">
        <span>{t.shockPreset}</span>
        <div className="bt-templates">
          {SHOCK_PRESETS.map(p => (
            <button key={p.id} className={`bt-template${p.id === preset ? ' on' : ''}`} onClick={() => onPreset(p.id)}>
              <span className="bt-template-head">
                <strong>{p.name[lang]}</strong>
                {p.tf && <span className="bt-chip">{p.tf} min</span>}
                {p.id.startsWith('adaptive') && <span className="bt-kind bt-kind-breakout">{t.shockExperimental}</span>}
              </span>
              <span className="bt-muted bt-small">{p.desc[lang]}</span>
            </button>
          ))}
        </div>
      </div>

      {tfMismatch && current?.tf && (
        <div className="bt-warn bt-warn-inline">
          <p>{t.shockTfHint(current.tf)}</p>
          {[5, 15, 30].includes(current.tf) && <button className="bt-btn bt-btn-ghost" onClick={() => onLoadTf(current.tf!)}>{t.shockLoadTf(current.tf)}</button>}
        </div>
      )}

      {adaptive && <p className="bt-note">{t.shockAdaptiveNote}</p>}
      {current?.pine && (
        <a className="bt-btn bt-btn-ghost" href={current.pine} download>
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden><path d="M8 2v8m0 0L5 7m3 3 3-3M3 12.5h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {t.shockPine}
        </a>
      )}

      <div className="bt-params">
        <div className="bt-params-head"><span>{t.shockParams}</span></div>
        <p className="bt-muted bt-small">{t.shockParamsHint}</p>
        {groups.map(([g, items]) => (
          <details key={g} className="bt-group" open={g === 'SHOCK DETECTION' || g === 'RISK MANAGEMENT'}>
            <summary>{g}</summary>
            <div className="bt-params-grid">
              {items.map(inp => {
                const v = params[inp.key]
                if (inp.kind === 'bool') {
                  return (
                    <label key={inp.key} className="bt-check bt-param">
                      <input type="checkbox" checked={!!v} onChange={e => set(inp.key, e.target.checked)} /> {inp.title}
                    </label>
                  )
                }
                if (inp.kind === 'select') {
                  return (
                    <label key={inp.key} className="bt-param">
                      <span className="bt-param-title">{inp.title}</span>
                      <div className="bt-field">
                        <select value={String(v)} onChange={e => set(inp.key, typeof inp.options![0].value === 'number' ? Number(e.target.value) : e.target.value)}>
                          {inp.options!.map(o => <option key={String(o.value)} value={String(o.value)}>{o.label}</option>)}
                        </select>
                      </div>
                    </label>
                  )
                }
                return (
                  <label key={inp.key} className="bt-param">
                    <span className="bt-param-title">{inp.title}</span>
                    <div className="bt-param-ctl">
                      <input type="range" min={inp.min} max={inp.max} step={inp.step} value={Number(v)} onChange={e => set(inp.key, Number(e.target.value))} />
                      <input type="number" value={Number(v)} step={inp.step} min={inp.min} max={inp.max}
                        onChange={e => { const x = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(x)) set(inp.key, x) }} />
                    </div>
                  </label>
                )
              })}
            </div>
          </details>
        ))}
      </div>

      <Link href="/backtest/recherche" className="bt-btn bt-btn-ghost">{t.shockResearch} →</Link>
    </div>
  )
}
