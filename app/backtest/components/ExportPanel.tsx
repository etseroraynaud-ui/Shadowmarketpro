'use client'

import { useMemo, useState } from 'react'
import type { Bars, Settings } from '../../../lib/backtest/types.ts'
import type { AppOutput, AppSource } from '../types'
import type { Dict, Lang } from '../i18n'
import { download, fmtNum } from '../format'
import { approxTokens, buildReport, defaultTradeLimit, equityCsv, reportFileName, robustOf, tradesCsv } from '../report'
import type { ReportMeta, TradeLimit } from '../report'

/** Au-delà, le rapport passe en pièce jointe mais se colle mal dans une conversation. */
const PASTE_TOKENS = 60000

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export default function ExportPanel({
  out, bars, settings, source, meta, lang, t, onClose,
}: {
  out: AppOutput
  bars: Bars
  settings: Settings
  source: AppSource
  meta: Omit<ReportMeta, 'now'>
  lang: Lang
  t: Dict
  onClose: () => void
}) {
  const n = out.result.trades.length
  const [limit, setLimit] = useState<TradeLimit>(() => defaultTradeLimit(n))
  const [copied, setCopied] = useState<'report' | 'prompt' | 'fail' | null>(null)
  // Mêmes tests que l'onglet Robustesse ; recalculés seulement quand le résultat change.
  const robust = useMemo(() => robustOf(bars, out, settings), [bars, out, settings])
  const now = useMemo(() => Date.now(), [out])
  const full = { ...meta, now }
  const report = useMemo(
    () => buildReport({ out, bars, settings, source, meta: { ...meta, now }, lang, t, trades: limit, robust }),
    [out, bars, settings, source, meta, now, lang, t, limit, robust],
  )
  const tokens = approxTokens(report)
  const kb = new Blob([report]).size / 1024

  const limits: TradeLimit[] = [0, ...([100, 500] as const).filter(x => x < n), 'all']
  const label = (x: TradeLimit) => (x === 0 ? t.exportTradesNone : x === 'all' ? t.exportTradesAll(n) : t.exportTradesLast(x))
  const flash = (c: 'report' | 'prompt' | 'fail') => {
    setCopied(c)
    setTimeout(() => setCopied(null), 2500)
  }

  return (
    <section className="bt-card bt-export" aria-label={t.exportTitle}>
      <div className="bt-export-head">
        <h3>{t.exportTitle}</h3>
        <button className="bt-export-close" onClick={onClose} aria-label={t.exportClose}>×</button>
      </div>
      <p className="bt-muted">{t.exportText}</p>

      {n > 0 && (
        <div className="bt-export-row">
          <span className="bt-small bt-muted">{t.exportTrades}</span>
          <div className="bt-seg bt-seg-sm">
            {limits.map(x => (
              <button key={String(x)} className={limit === x ? 'on' : ''} onClick={() => setLimit(x)}>{label(x)}</button>
            ))}
          </div>
        </div>
      )}
      <p className="bt-small bt-muted">
        {t.exportSize(fmtNum(Math.round(tokens / 100) * 100, lang, 0), fmtNum(kb, lang, kb < 10 ? 1 : 0))}
        {tokens > PASTE_TOKENS && <span className="bt-lev-warn"> {t.exportBig}</span>}
      </p>

      <div className="bt-export-actions">
        <button className="bt-btn bt-btn-primary" onClick={() => download(reportFileName(out, source, full, 'md'), report, 'text/markdown')}>{t.exportDownload}</button>
        <button className="bt-btn bt-btn-ghost" onClick={async () => flash((await copyText(report)) ? 'report' : 'fail')}>
          {copied === 'report' ? t.exportCopied : t.exportCopy}
        </button>
        <button className="bt-btn bt-btn-ghost" onClick={() => download(reportFileName(out, source, full, 'equity.csv'), equityCsv(bars, out), 'text/csv')}>{t.exportEquity}</button>
        {n > 0 && <button className="bt-btn bt-btn-ghost" onClick={() => download(reportFileName(out, source, full, 'trades.csv'), tradesCsv(out.result.trades), 'text/csv')}>{t.exportTradesCsv}</button>}
      </div>
      {copied === 'fail' && <p className="bt-small bt-neg">{t.exportCopyFail}</p>}

      <div className="bt-export-ask">
        <span className="bt-small bt-muted">{t.exportAsk}</span>
        <blockquote>{t.exportPrompt}</blockquote>
        <button className="bt-btn bt-btn-ghost bt-btn-sm" onClick={async () => flash((await copyText(t.exportPrompt)) ? 'prompt' : 'fail')}>
          {copied === 'prompt' ? t.exportCopied : t.exportCopyPrompt}
        </button>
      </div>
    </section>
  )
}
