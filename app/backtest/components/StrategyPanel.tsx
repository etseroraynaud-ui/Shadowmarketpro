'use client'

import { useRef, useState } from 'react'
import type { InputDef, Settings } from '../../../lib/backtest/types.ts'
import { TEMPLATES } from '../../../lib/backtest/templates.ts'
import { convertPine } from '../../../lib/backtest/pine.ts'
import type { PineConversion } from '../../../lib/backtest/pine.ts'
import { readSignalCsv, defaultSignalColumn, guessMode } from '../../../lib/backtest/signals.ts'
import type { SignalFile, SignalOptions, SignalMode } from '../../../lib/backtest/signals.ts'
import { DataError } from '../../../lib/backtest/data.ts'
import type { Dict, Lang } from '../i18n'
import { DOCS } from '../docs'
import { download, fmtDate } from '../format'
import CodeEditor from './CodeEditor'

export type StrategyMode = 'shock' | 'templates' | 'script' | 'pine' | 'signals'

export interface ScriptErr {
  text: string
  line: number | null
}

const looksLikePine = (s: string) => /\/\/\s*@version|^\s*strategy\s*\(|strategy\.(entry|close|exit)\s*\(/m.test(s)

export default function StrategyPanel({
  t, lang, mode, setMode, code, setCode, inputs, overrides, setOverrides, error,
  signalFile, setSignalFile, signalOpts, setSignalOpts, onApplySettings, onDirection, shockSlot,
}: {
  t: Dict
  lang: Lang
  mode: StrategyMode
  setMode: (m: StrategyMode) => void
  code: string
  setCode: (c: string) => void
  inputs: InputDef[]
  overrides: Record<string, number>
  setOverrides: (o: Record<string, number>) => void
  error: ScriptErr | null
  signalFile: SignalFile | null
  setSignalFile: (f: SignalFile | null) => void
  signalOpts: SignalOptions
  setSignalOpts: (o: SignalOptions) => void
  onApplySettings: (s: Partial<Settings>) => void
  onDirection: (d: Settings['direction']) => void
  /** Panneau du Shock Engine, rendu quand l'onglet est actif. */
  shockSlot: React.ReactNode
}) {
  const [help, setHelp] = useState(false)
  const [pineSrc, setPineSrc] = useState('')
  const [pine, setPine] = useState<PineConversion | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const importFile = async (file: File) => {
    setFileError(null)
    const text = await file.text()
    try {
      if (/\.(csv|tsv)$/i.test(file.name)) {
        const f = readSignalCsv(text)
        const col = defaultSignalColumn(f)
        setSignalFile(f)
        setSignalOpts({ ...signalOpts, col, mode: guessMode(f, col) })
        setMode('signals')
      } else if (looksLikePine(text)) {
        setPineSrc(text)
        setPine(convertPine(text))
        setMode('pine')
      } else {
        setCode(text)
        setOverrides({})
        setMode('script')
      }
    } catch (e) {
      setFileError(e instanceof DataError ? e.msg[lang] : e instanceof Error ? e.message : String(e))
    }
  }

  const tabs: [StrategyMode, string][] = [['shock', t.shock], ['templates', t.templates], ['script', t.script], ['pine', t.pine], ['signals', t.signalsCsv]]
  const docs = DOCS[lang]

  return (
    <div className="bt-step-body">
      <div className="bt-import-row">
        <button className="bt-btn bt-btn-import" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {t.importStrategy}
        </button>
        <span className="bt-muted bt-small">{t.importHint}</span>
        <input ref={fileRef} type="file" accept=".txt,.pine,.smp,.csv,.js,text/plain,text/csv" hidden onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.target.value = '' }} />
      </div>
      {fileError && <div className="bt-error">{fileError}</div>}

      <div className="bt-seg" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={mode === id} className={mode === id ? 'on' : ''} onClick={() => setMode(id)}>{label}</button>
        ))}
      </div>

      {mode === 'shock' && shockSlot}

      {mode === 'templates' && (
        <div className="bt-templates">
          {TEMPLATES.map(tpl => (
            <button key={tpl.id} className="bt-template" onClick={() => {
              setCode(tpl.script)
              setOverrides({})
              onDirection(tpl.settings?.direction ?? 'long')
              setMode('script')
            }}>
              <span className={`bt-kind bt-kind-${tpl.kind}`}>{t[`kind_${tpl.kind}` as const]}</span>
              <strong>{tpl.name[lang]}</strong>
              <span className="bt-muted bt-small">{tpl.desc[lang]}</span>
            </button>
          ))}
        </div>
      )}

      {mode === 'script' && (
        <>
          <CodeEditor value={code} onChange={setCode} errorLine={error?.line ?? null} />
          {error && (
            <div className="bt-error">
              <strong>{t.scriptError}{error.line ? ` (${t.line} ${error.line})` : ''} :</strong> {error.text}
            </div>
          )}
          <div className="bt-editor-tools">
            <button className="bt-link" onClick={() => setHelp(h => !h)}>{help ? t.hideHelp : t.help}</button>
            <button className="bt-link" onClick={() => download('strategie.txt', code)}>{t.exportScript}</button>
          </div>
          {help && (
            <div className="bt-docs">
              {docs.map(sec => (
                <div key={sec.title} className="bt-doc">
                  <h5>{sec.title}</h5>
                  {sec.intro && <p>{sec.intro}</p>}
                  {sec.rows && (
                    <dl>
                      {sec.rows.map(([k, v]) => (
                        <div key={k}><dt><code>{k}</code></dt><dd>{v}</dd></div>
                      ))}
                    </dl>
                  )}
                  {sec.code && <pre><code>{sec.code}</code></pre>}
                </div>
              ))}
            </div>
          )}
          {inputs.length > 0 && (
            <div className="bt-params">
              <div className="bt-params-head">
                <span>{t.parameters}</span>
                {Object.keys(overrides).length > 0 && <button className="bt-link" onClick={() => setOverrides({})}>{t.reset}</button>}
              </div>
              <p className="bt-muted bt-small">{t.parametersHint}</p>
              <div className="bt-params-grid">
                {inputs.map(inp => {
                  const v = overrides[inp.name] ?? inp.defval
                  if (inp.kind === 'bool') {
                    return (
                      <label key={inp.name} className="bt-check bt-param">
                        <input type="checkbox" checked={v !== 0} onChange={e => setOverrides({ ...overrides, [inp.name]: e.target.checked ? 1 : 0 })} /> {inp.title}
                      </label>
                    )
                  }
                  const hasRange = inp.min != null && inp.max != null
                  return (
                    <label key={inp.name} className="bt-param">
                      <span className="bt-param-title">{inp.title}</span>
                      <div className="bt-param-ctl">
                        {hasRange && (
                          <input type="range" min={inp.min!} max={inp.max!} step={inp.step ?? (inp.kind === 'int' ? 1 : (inp.max! - inp.min!) / 100)} value={v}
                            onChange={e => setOverrides({ ...overrides, [inp.name]: Number(e.target.value) })} />
                        )}
                        <input type="number" value={v} step={inp.step ?? (inp.kind === 'int' ? 1 : 'any')} min={inp.min ?? undefined} max={inp.max ?? undefined}
                          onChange={e => { const x = Number(e.target.value); if (e.target.value !== '' && Number.isFinite(x)) setOverrides({ ...overrides, [inp.name]: x }) }} />
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'pine' && (
        <div className="bt-pine">
          <p className="bt-muted bt-small">{t.pineIntro}</p>
          <CodeEditor value={pineSrc} onChange={v => { setPineSrc(v); setPine(null) }} placeholder={t.pinePaste} minRows={10} />
          <div className="bt-editor-tools">
            <button className="bt-btn bt-btn-ghost" disabled={!pineSrc.trim()} onClick={() => setPine(convertPine(pineSrc))}>{t.pineConvert}</button>
          </div>
          {pine && (
            <div className="bt-pine-out">
              <p className="bt-small">{t.pineDone(pine.converted)}{Object.keys(pine.settings).length > 0 && <> {t.pineSettings}{settingsSummary(pine.settings, lang)}</>}</p>
              {pine.warnings.length > 0 && (
                <div className="bt-warn bt-warn-inline">{pine.warnings.map((w, k) => <p key={k}>{w[lang]}</p>)}</div>
              )}
              <CodeEditor value={pine.script} readOnly minRows={8} />
              <button className="bt-btn bt-btn-primary" onClick={() => {
                setCode(pine.script)
                setOverrides({})
                onApplySettings(pine.settings)
                setMode('script')
              }}>{t.pineUse}</button>
            </div>
          )}
        </div>
      )}

      {mode === 'signals' && (
        <div className="bt-signals">
          <p className="bt-muted bt-small">{t.signalsIntro}</p>
          {!signalFile ? (
            <button className="bt-btn bt-btn-ghost" onClick={() => fileRef.current?.click()}>{t.importStrategy} (.csv)</button>
          ) : (
            <>
              <div className="bt-muted bt-small">
                {t.signalsRows(signalFile.times.length, fmtDate(signalFile.times[0], lang), fmtDate(signalFile.times[signalFile.times.length - 1], lang))}
              </div>
              <div className="bt-form-grid">
                <label className="bt-field"><span>{t.signalsColumn}</span>
                  <select value={signalOpts.col} onChange={e => {
                    const col = Number(e.target.value)
                    setSignalOpts({ ...signalOpts, col, mode: guessMode(signalFile, col) })
                  }}>
                    {signalFile.cols.map((c, k) => <option key={c + k} value={k}>{c}</option>)}
                  </select>
                </label>
                <label className="bt-field bt-span2"><span>{t.signalsMode}</span>
                  <select value={signalOpts.mode} onChange={e => setSignalOpts({ ...signalOpts, mode: e.target.value as SignalMode })}>
                    <option value="position">{t.mode_position}</option>
                    <option value="events">{t.mode_events}</option>
                    <option value="threshold">{t.mode_threshold}</option>
                  </select>
                </label>
                {signalOpts.mode === 'threshold' && (
                  <>
                    <label className="bt-field"><span>{t.upper}</span><input type="number" step="any" value={signalOpts.upper} onChange={e => setSignalOpts({ ...signalOpts, upper: Number(e.target.value) })} /></label>
                    <label className="bt-field"><span>{t.lower}</span><input type="number" step="any" value={signalOpts.lower} onChange={e => setSignalOpts({ ...signalOpts, lower: Number(e.target.value) })} /></label>
                  </>
                )}
              </div>
              <button className="bt-link" onClick={() => fileRef.current?.click()}>{t.importStrategy}…</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function settingsSummary(s: Partial<Settings>, lang: Lang): string {
  const fr = lang === 'fr'
  const parts: string[] = []
  if (s.capital != null) parts.push(`capital ${s.capital}`)
  if (s.feePct != null) parts.push(`${fr ? 'commission' : 'commission'} ${s.feePct} %`)
  if (s.feeFixed != null) parts.push(`${s.feeFixed} ${fr ? 'par ordre' : 'per order'}`)
  if (s.sizing === 'percent' && s.sizeValue != null) parts.push(`${s.sizeValue} % ${fr ? 'du capital' : 'of equity'}`)
  if (s.sizing === 'fixed' && s.sizeValue != null) parts.push(`${s.sizeValue} ${fr ? 'par trade' : 'per trade'}`)
  if (s.direction) parts.push(s.direction)
  if (s.fill === 'close') parts.push('process_orders_on_close')
  return parts.join(', ')
}
