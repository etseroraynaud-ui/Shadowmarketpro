'use client'

import type { Settings } from '../../../lib/backtest/types.ts'
import type { Dict, Lang } from '../i18n'
import { fmtNum, fmtPct } from '../format'

export interface UiSettings extends Omit<Settings, 'from' | 'to' | 'splitTime'> {
  /** Part finale de la fenêtre mise de côté pour la validation (0 = aucune). */
  oosPct: number
}

function NumField({ label, value, onChange, step = 'any', min, max, suffix, placeholder }: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  step?: number | string
  min?: number
  max?: number
  suffix?: string
  placeholder?: string
}) {
  return (
    <label className="bt-field">
      <span>{label}</span>
      <div className="bt-input-suffix">
        <input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value ?? ''}
          placeholder={placeholder}
          onChange={e => {
            if (e.target.value === '') return onChange(null)
            const v = Number(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
        />
        {suffix && <em>{suffix}</em>}
      </div>
    </label>
  )
}

/** Mouvement de prix contre un long qui amène le capital à la marge de maintenance. */
function liquidationMove(exposure: number, maintenancePct: number): number {
  const mmr = maintenancePct / 100
  return (1 / exposure - mmr) / (1 - mmr)
}

function LeverageHint({ t, lang, s }: { t: Dict; lang: Lang; s: UiSettings }) {
  const x = (v: number) => `${fmtNum(v, lang, 2)} ×`
  if (s.sizing === 'risk') return <p className="bt-muted bt-small">{t.leverageRiskHint(x(s.leverage))}</p>
  // En « fixed », la position dépend du capital à chaque trade : l'exposition n'est connue qu'au départ.
  const exposure = s.sizing === 'percent' ? (s.sizeValue / 100) * s.leverage : (Math.min(s.sizeValue, s.capital) / s.capital) * s.leverage
  if (!(exposure > 1)) return <p className="bt-muted bt-small">{t.leverageNone}</p>
  const move = liquidationMove(exposure, s.maintenancePct)
  return <p className={`bt-small ${exposure >= 5 ? 'bt-lev-warn' : 'bt-muted'}`}>{t.leverageHint(x(exposure), fmtPct(Math.max(0, move), lang, 1, false))}</p>
}

export default function SettingsPanel({ t, lang, s, set, native = false }: { t: Dict; lang: Lang; s: UiSettings; set: (p: Partial<UiSettings>) => void; native?: boolean }) {
  const pos = (v: number | null) => (v != null && v > 0 ? v : null)
  return (
    <div className="bt-step-body">
      <div className="bt-form-grid">
        <NumField label={t.capital} value={s.capital} min={1} onChange={v => set({ capital: v && v > 0 ? v : 10000 })} />
        <label className="bt-field">
          <span>{t.direction}</span>
          <div className="bt-seg bt-seg-sm">
            {(['long', 'short', 'both'] as const).map(d => (
              <button key={d} className={s.direction === d ? 'on' : ''} onClick={() => set({ direction: d })}>{t[`dir_${d}` as const]}</button>
            ))}
          </div>
        </label>
      </div>

      {native && <p className="bt-note">{t.shockSettingsNote}</p>}
      <div className="bt-sub">{t.sizing}</div>
      {native ? (
        <div className="bt-form-grid">
          <NumField label={t.sizing_percent} value={s.sizing === 'percent' ? s.sizeValue : 100} min={1} suffix="%" onChange={v => set({ sizing: 'percent', sizeValue: v ?? 100 })} />
        </div>
      ) : (
      <div className="bt-form-grid">
        <label className="bt-field">
          <span>{t.sizing}</span>
          <select value={s.sizing} onChange={e => {
            const sizing = e.target.value as Settings['sizing']
            set({ sizing, sizeValue: sizing === 'percent' ? 100 : sizing === 'risk' ? 1 : 1000 })
          }}>
            <option value="percent">{t.sizing_percent}</option>
            <option value="fixed">{t.sizing_fixed}</option>
            <option value="risk">{t.sizing_risk}</option>
          </select>
        </label>
        <NumField label={s.sizing === 'fixed' ? t.sizing_fixed : '%'} value={s.sizeValue} min={0} suffix={s.sizing === 'fixed' ? undefined : '%'} onChange={v => set({ sizeValue: v ?? 0 })} />
        <p className="bt-muted bt-small bt-span2">{t[`sizingHint_${s.sizing}` as const]}</p>
      </div>
      )}

      <div className="bt-sub">{t.leverageSection}</div>
      <div className="bt-form-grid bt-grid-3">
        <NumField label={s.sizing === 'risk' && !native ? t.maxLeverage : t.leverage} value={s.leverage} min={1} max={125} step={0.5} suffix="×" onChange={v => set({ leverage: v != null && v >= 1 ? Math.min(v, 125) : 1 })} />
        <NumField label={t.maintenancePct} value={s.maintenancePct} min={0} step={0.1} suffix="%" onChange={v => set({ maintenancePct: v != null && v >= 0 ? v : 0.5 })} />
        <NumField label={t.fundingPct} value={s.fundingPct} step={0.005} suffix="%" onChange={v => set({ fundingPct: v ?? 0 })} />
      </div>
      <div className="bt-seg bt-seg-sm bt-lev-quick">
        {[1, 2, 3, 5, 10].map(v => (
          <button key={v} className={s.leverage === v ? 'on' : ''} onClick={() => set({ leverage: v })}>×{v}</button>
        ))}
      </div>
      <LeverageHint t={t} lang={lang} s={native ? { ...s, sizing: 'percent' } : s} />
      <p className="bt-muted bt-small">{t.fundingHint}</p>

      <div className="bt-sub">{t.costs}</div>
      <div className="bt-form-grid bt-grid-3">
        <NumField label={t.feePct} value={s.feePct} min={0} step={0.01} suffix="%" onChange={v => set({ feePct: v ?? 0 })} />
        <NumField label={t.slippage} value={s.slippagePct} min={0} step={0.01} suffix="%" onChange={v => set({ slippagePct: v ?? 0 })} />
        {!native && <NumField label={t.feeFixed} value={s.feeFixed} min={0} step={0.5} onChange={v => set({ feeFixed: v ?? 0 })} />}
      </div>
      {!native && (<>
      <label className="bt-field">
        <span>{t.fill}</span>
        <div className="bt-seg bt-seg-sm">
          {(['next_open', 'close'] as const).map(f => (
            <button key={f} className={s.fill === f ? 'on' : ''} onClick={() => set({ fill: f })}>{t[`fill_${f}` as const]}</button>
          ))}
        </div>
      </label>
      <p className="bt-muted bt-small">{t.fillHint}</p>

      <div className="bt-sub">{t.exits}</div>
      <div className="bt-form-grid">
        <NumField label={t.stopLoss} value={s.stopLossPct} min={0} step={0.5} suffix="%" placeholder={t.off} onChange={v => set({ stopLossPct: pos(v) })} />
        <NumField label={t.takeProfit} value={s.takeProfitPct} min={0} step={0.5} suffix="%" placeholder={t.off} onChange={v => set({ takeProfitPct: pos(v) })} />
        <NumField label={t.trailing} value={s.trailingPct} min={0} step={0.5} suffix="%" placeholder={t.off} onChange={v => set({ trailingPct: pos(v) })} />
        <NumField label={t.maxBars} value={s.maxBars} min={1} step={1} placeholder={t.off} onChange={v => set({ maxBars: v != null && v >= 1 ? Math.round(v) : null })} />
      </div>
      </>)}

      <div className="bt-sub">{t.validation}</div>
      <div className="bt-seg bt-seg-sm">
        {[0, 20, 30, 40].map(p => (
          <button key={p} className={s.oosPct === p ? 'on' : ''} onClick={() => set({ oosPct: p })}>{t[`oos_${p}` as 'oos_0']}</button>
        ))}
      </div>
      <p className="bt-muted bt-small">{t.validationHint}</p>
    </div>
  )
}
