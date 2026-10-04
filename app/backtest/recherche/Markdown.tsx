'use client'

// Rendu Markdown minimal pour les rapports de recherche : titres, paragraphes, listes,
// tableaux, code, gras, liens, séparateurs. Produit des éléments React (pas de HTML brut).

import type { ReactNode } from 'react'

function inline(text: string, onLink: (href: string) => void, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let k = key
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('`')) out.push(<code key={k++}>{tok.slice(1, -1)}</code>)
    else if (tok.startsWith('**')) out.push(<strong key={k++}>{inline(tok.slice(2, -2), onLink, k * 100)}</strong>)
    else {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/)!
      const href = mm[2]
      if (/^https?:/.test(href)) out.push(<a key={k++} href={href} target="_blank" rel="noreferrer">{mm[1]}</a>)
      else out.push(<a key={k++} href="#" onClick={e => { e.preventDefault(); onLink(href) }}>{mm[1]}</a>)
    }
    last = m.index + tok.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

const isNum = (c: string) => /^[-+×]?[\d\s.,]+\s?(%|ms|s)?$|^—$/.test(c.trim())

export default function Markdown({ text, onLink }: { text: string; onLink: (href: string) => void }) {
  const lines = text.replace(/\r/g, '').split('\n')
  const blocks: ReactNode[] = []
  let i = 0
  let k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    if (line.startsWith('```')) {
      const body: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++])
      i++
      blocks.push(<pre key={k++}><code>{body.join('\n')}</code></pre>)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const level = h[1].length
      const content = inline(h[2], onLink)
      blocks.push(level === 1 ? <h1 key={k++}>{content}</h1> : level === 2 ? <h2 key={k++}>{content}</h2> : level === 3 ? <h3 key={k++}>{content}</h3> : <h4 key={k++}>{content}</h4>)
      i++
      continue
    }
    if (/^---+\s*$/.test(line)) { blocks.push(<hr key={k++} />); i++; continue }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
        if (!cells.every(c => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      const [head, ...body] = rows
      blocks.push(
        <div key={k++} className="rp-table-wrap">
          <table className="bt-table rp-table">
            <thead><tr>{head.map((c, j) => <th key={j} className={j > 0 && body.some(r => isNum(r[j] ?? '')) ? 'num' : ''}>{inline(c, onLink)}</th>)}</tr></thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j} className={j > 0 && isNum(c) ? 'num' : ''}>{inline(c, onLink)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: { text: string; sub: string[] }[] = []
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const l = lines[i]
        const indent = l.match(/^\s*/)![0].length
        const content = l.replace(/^\s*([-*]|\d+\.)\s+/, '')
        if (indent >= 2 && items.length) {
          if (/^\s*([-*]|\d+\.)\s+/.test(l)) items[items.length - 1].sub.push(content)
          else items[items.length - 1].text += ' ' + l.trim()
        } else items.push({ text: content, sub: [] })
        i++
      }
      const lis = items.map((it, j) => (
        <li key={j}>
          {inline(it.text, onLink)}
          {it.sub.length > 0 && <ul>{it.sub.map((s2, q) => <li key={q}>{inline(s2, onLink)}</li>)}</ul>}
        </li>
      ))
      blocks.push(ordered ? <ol key={k++}>{lis}</ol> : <ul key={k++}>{lis}</ul>)
      continue
    }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||```|---|\s*([-*]|\d+\.)\s)/.test(lines[i])) para.push(lines[i++].trim())
    if (!para.length) { i++; continue }
    blocks.push(<p key={k++}>{inline(para.join(' '), onLink)}</p>)
  }
  return <div className="rp-md">{blocks}</div>
}
