'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { runStrategy } from '../../lib/backtest/index.ts'
import type { StrategySource } from '../../lib/backtest/index.ts'
import { runShockBacktest, SHOCK_PRESETS } from '../../lib/strategies/shock/adapter.ts'
import type { Adaptive } from '../../lib/strategies/shock/adapter.ts'
import { DEFAULT_PARAMS } from '../../lib/strategies/shock/params.ts'
import type { ShockParams } from '../../lib/strategies/shock/params.ts'
import type { AppOutput, AppSource } from './types'
import ShockPanel from './components/ShockPanel'
import { ScriptError } from '../../lib/backtest/script/parser.ts'
import { windowIndices } from '../../lib/backtest/engine.ts'
import { TEMPLATES } from '../../lib/backtest/templates.ts'
import { DEFAULT_SETTINGS } from '../../lib/backtest/types.ts'
import type { InputDef, Settings } from '../../lib/backtest/types.ts'
import type { SignalFile, SignalOptions } from '../../lib/backtest/signals.ts'
import { LogoSVGSmall } from '../components/Logo'
import { DICTS } from './i18n'
import type { Lang } from './i18n'
import { fmtNum, parseDay } from './format'
import DataPanel, { loadSample } from './components/DataPanel'
import type { Dataset } from './components/DataPanel'
import StrategyPanel from './components/StrategyPanel'
import type { ScriptErr, StrategyMode } from './components/StrategyPanel'
import SettingsPanel from './components/SettingsPanel'
import type { UiSettings } from './components/SettingsPanel'
import Results from './components/Results'

const STORE = 'smp.backtest.v1'

interface Saved {
  lang?: Lang
  code?: string
  overrides?: Record<string, number>
  ui?: UiSettings
  sample?: string
  mode?: StrategyMode
  shockPreset?: string
  shockParams?: ShockParams
  shockEdited?: boolean
}

function readStore(): Saved {
  try {
    return JSON.parse(localStorage.getItem(STORE) || '{}') as Saved
  } catch {
    return {}
  }
}

function writeStore(s: Saved) {
  try {
    localStorage.setItem(STORE, JSON.stringify(s))
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}

const DEFAULT_UI: UiSettings = (() => {
  const { from: _f, to: _t, splitTime: _s, ...rest } = DEFAULT_SETTINGS
  return { ...rest, oosPct: 0 }
})()

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="bt-card bt-step">
      <header className="bt-step-head">
        <span className="bt-step-n">{n}</span>
        <div>
          <h2>{title}</h2>
          <p>{sub}</p>
        </div>
      </header>
      {children}
    </section>
  )
}

export default function BacktestApp() {
  const [lang, setLang] = useState<Lang>('fr')
  const t = DICTS[lang]
  const [data, setData] = useState<Dataset | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [mode, setMode] = useState<StrategyMode>('script')
  const [code, setCode] = useState(TEMPLATES[0].script)
  const [overrides, setOverrides] = useState<Record<string, number>>({})
  const [signalFile, setSignalFile] = useState<SignalFile | null>(null)
  const [signalOpts, setSignalOpts] = useState<SignalOptions>({ col: 0, mode: 'position', upper: 0, lower: 0 })
  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI)
  const [shockPreset, setShockPreset] = useState('script')
  const [shockParams, setShockParams] = useState<ShockParams>(DEFAULT_PARAMS)
  const [shockAdaptive, setShockAdaptive] = useState<Adaptive | null>(null)
  const [shockEdited, setShockEdited] = useState(false)
  const [out, setOut] = useState<AppOutput | null>(null)
  const [scriptErr, setScriptErr] = useState<ScriptErr | null>(null)
  const [inputs, setInputs] = useState<InputDef[]>([])
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)

  // Restauration de la dernière session, puis chargement des données d'exemple.
  useEffect(() => {
    const s = readStore()
    const l: Lang = s.lang ?? (typeof navigator !== 'undefined' && !navigator.language.startsWith('fr') ? 'en' : 'fr')
    setLang(l)
    if (s.code) setCode(s.code)
    if (s.overrides) setOverrides(s.overrides)
    if (s.ui) setUi({ ...DEFAULT_UI, ...s.ui })
    if (s.mode && s.mode !== 'signals') setMode(s.mode)
    if (s.shockPreset) {
      const pr = SHOCK_PRESETS.find(x => x.id === s.shockPreset)
      setShockPreset(s.shockPreset)
      if (pr) setShockAdaptive(pr.build().adaptive)
    }
    if (s.shockParams) setShockParams({ ...DEFAULT_PARAMS, ...s.shockParams })
    if (s.shockEdited) { setShockEdited(true); setShockAdaptive(null) }
    setReady(true)
    loadSample(s.sample ?? 'btc1d').then(setData).catch(e => setDataError(String(e)))
  }, [])

  useEffect(() => {
    if (ready) writeStore({ lang, code, overrides, ui, sample: data?.sample, mode, shockPreset, shockParams, shockEdited })
  }, [ready, lang, code, overrides, ui, data?.sample, mode, shockPreset, shockParams, shockEdited])

  const settings: Settings | null = useMemo(() => {
    if (!data) return null
    const fromT = parseDay(from)
    const toDay = parseDay(to)
    const base: Settings = { ...ui, from: fromT, to: toDay != null ? toDay + 86399999 : null, splitTime: null }
    if (ui.oosPct > 0) {
      const { start, end } = windowIndices(data.bars, base)
      const k = start + Math.floor((end - start + 1) * (1 - ui.oosPct / 100))
      if (k > start && k <= end) base.splitTime = data.bars.t[k]
    }
    return base
  }, [data, ui, from, to])

  const source: AppSource = useMemo((): AppSource => {
    if (mode === 'shock') return { kind: 'shock', params: shockParams, adaptive: shockAdaptive }
    if (mode === 'signals' && signalFile) return { kind: 'signals', file: signalFile, options: signalOpts }
    return { kind: 'script', code, overrides }
  }, [mode, signalFile, signalOpts, code, overrides, shockParams, shockAdaptive])

  const run = useCallback(() => {
    if (!data || !settings) return
    setBusy(true)
    try {
      const o = source.kind === 'shock' ? runShockBacktest(data.bars, source, settings) : runStrategy(data.bars, source as StrategySource, settings)
      // Préréglage choisi par la recherche, testé sur la période où il a été choisi : résultat flatteur.
      const pr = source.kind === 'shock' && !shockEdited ? SHOCK_PRESETS.find(x => x.id === shockPreset) : undefined
      if (pr?.selectedOn) {
        const r0 = o.result
        const a = data.bars.t[r0.start]
        const b = data.bars.t[r0.end]
        if (a < pr.selectedOn.to && b > pr.selectedOn.from) {
          o.warnings = [{
            fr: `Ce préréglage a été choisi par la recherche sur 2017-2026 : sur cette période, le résultat affiché est en échantillon et donc flatteur. ${pr.selectedOn.oos.fr}`,
            en: `This preset was chosen by the research on 2017-2026: on this period, the result shown is in sample and therefore flattering. ${pr.selectedOn.oos.en}`,
          }, ...o.warnings]
        }
      }
      setOut(o)
      if (source.kind === 'script') setInputs(o.inputs)
      setScriptErr(null)
    } catch (e) {
      if (e instanceof ScriptError) setScriptErr({ text: e.msg[lang], line: e.pos?.line ?? null })
      else setScriptErr({ text: e instanceof Error ? e.message : String(e), line: null })
    } finally {
      setBusy(false)
    }
  }, [data, settings, source, lang, shockEdited, shockPreset])

  // Relance automatique, avec un court délai pendant la saisie.
  useEffect(() => {
    const id = setTimeout(run, 180)
    return () => clearTimeout(id)
  }, [run])

  const setUiPart = (p: Partial<UiSettings>) => setUi(u => ({ ...u, ...p }))
  const applySettings = (p: Partial<Settings>) => {
    const { from: _f, to: _t, splitTime: _s, ...rest } = p
    setUi(u => ({ ...u, ...rest }))
  }
  const onLoaded = (d: Dataset) => {
    setData(d)
    setFrom('')
    setTo('')
    setDataError(null)
  }
  const intraday = !!data && data.barMs < 86400000
  const choosePreset = (id: string) => {
    const pr = SHOCK_PRESETS.find(x => x.id === id)
    if (!pr) return
    const b = pr.build()
    setShockPreset(id)
    setShockParams(b.params)
    setShockAdaptive(b.adaptive)
    setShockEdited(false)
    // Exécution déclarée dans strategy() du script : 10 000, 100 % du capital, commission 0,02 %,
    // glissement d'un tick (négligeable sur le BTC), dans les deux sens.
    setUiPart({ direction: 'both', capital: 10000, sizing: 'percent', sizeValue: 100, feePct: 0.02, slippagePct: 0 })
  }
  const loadTf = (tf: number) => {
    loadSample(`btc${tf}m`).then(onLoaded).catch(e => setDataError(String(e)))
  }
  const dataTf = data ? Math.round(data.barMs / 60000) : null

  return (
    <div className="bt-app">
      <header className="bt-header">
        <div className="bt-header-in">
          <Link href="/" className="bt-brand">
            <LogoSVGSmall className="bt-logo" />
            <span>ShadowMarket<em>Pro</em></span>
          </Link>
          <span className="bt-header-sep">/</span>
          <span className="bt-header-title">{t.appName}</span>
          <div className="bt-header-right">
            <div className="bt-seg bt-seg-sm bt-lang" role="group" aria-label="Language">
              {(['fr', 'en'] as const).map(l => (
                <button key={l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
              ))}
            </div>
            <Link href="/backtest/recherche" className="bt-link">{t.research}</Link>
            <Link href="/" className="bt-link bt-hide-sm">{t.backToSite}</Link>
          </div>
        </div>
      </header>

      <div className="bt-intro">
        <h1>{t.appName}</h1>
        <p>{t.tagline}</p>
      </div>

      <main className="bt-main">
        <aside className="bt-side">
          <Step n={1} title={t.step1} sub={t.step1Sub}>
            <DataPanel t={t} lang={lang} data={data} onLoaded={onLoaded} from={from} to={to} onWindow={(f, x) => { setFrom(f); setTo(x) }} />
            {dataError && <div className="bt-error">{dataError}</div>}
          </Step>
          <Step n={2} title={t.step2} sub={t.step2Sub}>
            <StrategyPanel
              t={t} lang={lang} mode={mode} setMode={m => { if (m === 'shock' && mode !== 'shock') setUiPart({ direction: 'both' }); setMode(m) }} code={code} setCode={setCode} inputs={inputs}
              overrides={overrides} setOverrides={setOverrides} error={source.kind === 'script' ? scriptErr : null}
              signalFile={signalFile} setSignalFile={setSignalFile} signalOpts={signalOpts} setSignalOpts={setSignalOpts}
              onApplySettings={applySettings} onDirection={d => setUiPart({ direction: d })}
              shockSlot={
                <ShockPanel
                  t={t} lang={lang} preset={shockPreset} onPreset={choosePreset} params={shockParams}
                  onParams={p => { setShockParams(p); setShockAdaptive(null); setShockEdited(true) }} adaptive={shockAdaptive}
                  dataTf={dataTf} onLoadTf={loadTf}
                />
              }
            />
          </Step>
          <Step n={3} title={t.step3} sub={t.step3Sub}>
            <SettingsPanel t={t} lang={lang} s={ui} set={setUiPart} native={mode === 'shock'} />
          </Step>
          <div className="bt-run">
            <button className="bt-btn bt-btn-primary bt-btn-run" onClick={run} disabled={!data || busy}>
              {busy ? t.running : t.run}
            </button>
            <span className="bt-muted bt-small">
              {scriptErr ? <span className="bt-neg">{t.scriptError}</span> : out ? `✓ ${t.computedIn(fmtNum(out.ms, lang, 0))} · ${t.autoRun}` : ''}
            </span>
          </div>
        </aside>

        <section className="bt-content">
          {out && data && settings ? (
            <Results
              out={out} bars={data.bars} lang={lang} t={t} settings={settings} source={source} intraday={intraday}
              onApplyParams={v => {
                if (mode === 'shock') { setShockParams(p => ({ ...p, ...v })); setShockAdaptive(null); setShockEdited(true) } else { setOverrides(o => ({ ...o, ...v })); setMode('script') }
              }}
              onEnableSplit={() => setUiPart({ oosPct: 30 })}
            />
          ) : (
            <div className="bt-card bt-empty">
              <div className="bt-empty-art" aria-hidden>
                <svg viewBox="0 0 120 60" width="160" height="80"><path d="M4 50 L22 38 L36 44 L52 24 L68 30 L84 12 L100 20 L116 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <h3>{data ? t.emptyTitle : t.loading}</h3>
              <p className="bt-muted">{t.emptyText}</p>
              {scriptErr && <div className="bt-error">{scriptErr.text}</div>}
            </div>
          )}
        </section>
      </main>

      <footer className="bt-footer">
        <p>{t.privacy}</p>
        <p>{t.disclaimer}</p>
      </footer>
    </div>
  )
}
