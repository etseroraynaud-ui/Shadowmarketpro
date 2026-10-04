'use client'

import { useMemo, useRef } from 'react'

const OUTPUTS = /^(long|exitLong|exit_long|short|exitShort|exit_short|stopLoss|stop_loss|takeProfit|take_profit)$/
const KEYWORDS = /^(and|or|not|true|false|na)$/
const BUILTINS = /^(open|high|low|close|volume|hl2|hlc3|ohlc4|hlcc4|bar_index|time|year|month|dayofmonth|dayofweek|hour|minute|tr|obv|vwap)$/

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Coloration d'une ligne : commentaires, chaînes, nombres, mots-clés, fonctions, signaux. */
function highlight(line: string): string {
  let out = ''
  let i = 0
  while (i < line.length) {
    const rest = line.slice(i)
    if (rest.startsWith('//')) { out += `<span class="tk-c">${esc(rest)}</span>`; break }
    let m = rest.match(/^"[^"]*"?|^'[^']*'?/)
    if (m) { out += `<span class="tk-s">${esc(m[0])}</span>`; i += m[0].length; continue }
    m = rest.match(/^#[0-9a-fA-F]{3,8}\b/)
    if (m) { out += `<span class="tk-s">${esc(m[0])}</span>`; i += m[0].length; continue }
    m = rest.match(/^\d+(\.\d+)?/)
    if (m) { out += `<span class="tk-n">${m[0]}</span>`; i += m[0].length; continue }
    m = rest.match(/^[A-Za-z_][\w.]*/)
    if (m) {
      const w = m[0]
      const after = line.slice(i + w.length)
      let cls = ''
      if (OUTPUTS.test(w)) cls = 'tk-o'
      else if (KEYWORDS.test(w)) cls = 'tk-k'
      else if (/^\s*\(/.test(after)) cls = 'tk-f'
      else if (BUILTINS.test(w)) cls = 'tk-b'
      out += cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w)
      i += w.length
      continue
    }
    out += esc(line[i])
    i++
  }
  return out
}

export default function CodeEditor({
  value,
  onChange,
  errorLine,
  placeholder,
  minRows = 14,
  readOnly = false,
}: {
  value: string
  onChange?: (v: string) => void
  errorLine?: number | null
  placeholder?: string
  minRows?: number
  readOnly?: boolean
}) {
  const pre = useRef<HTMLPreElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const lines = value.split('\n')
  const html = useMemo(
    () => lines.map((l, k) => `<span class="ce-line${errorLine === k + 1 ? ' ce-err' : ''}">${highlight(l) || ' '}</span>`).join('\n'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value, errorLine],
  )
  const rows = Math.max(minRows, lines.length + 1)
  const sync = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget
    if (pre.current) {
      pre.current.scrollTop = t.scrollTop
      pre.current.scrollLeft = t.scrollLeft
    }
    if (gutter.current) gutter.current.scrollTop = t.scrollTop
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab' || readOnly || !onChange) return
    e.preventDefault()
    const t = e.currentTarget
    const s = t.selectionStart
    const v = t.value
    onChange(v.slice(0, s) + '  ' + v.slice(t.selectionEnd))
    requestAnimationFrame(() => { t.selectionStart = t.selectionEnd = s + 2 })
  }
  return (
    <div className="ce" style={{ ['--rows' as string]: Math.min(rows, 28) }}>
      <div className="ce-gutter" ref={gutter} aria-hidden>
        {lines.map((_, k) => (
          <div key={k} className={errorLine === k + 1 ? 'ce-gn ce-gn-err' : 'ce-gn'}>{k + 1}</div>
        ))}
      </div>
      <div className="ce-body">
        <pre ref={pre} className="ce-pre" aria-hidden dangerouslySetInnerHTML={{ __html: html + '\n' }} />
        <textarea
          className="ce-ta"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={e => onChange?.(e.target.value)}
          onScroll={sync}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  )
}
