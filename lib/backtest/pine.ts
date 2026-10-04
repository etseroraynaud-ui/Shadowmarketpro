// Conversion d'une stratégie Pine Script simple vers le langage de la plateforme.
//
// Repris : inputs, variables calculées, ta.* et math.*, plot, blocs « if » qui appellent
// strategy.entry / strategy.close / strategy.close_all, forme v4 « when = ». Les paramètres
// de strategy() (capital, commission, taille) sont proposés comme réglages.
// Non repris, et signalé : := (état d'une barre à l'autre), fonctions définies, boucles,
// request.security, strategy.exit avec prix absolus, strategy.position_size.

import type { Msg, Settings } from './types.ts'

export interface PineConversion {
  script: string
  name: string | null
  settings: Partial<Settings>
  warnings: Msg[]
  /** Nombre de lignes Pine reprises telles quelles ou traduites. */
  converted: number
}

interface Line {
  indent: number
  text: string
  no: number
}

export function convertPine(src: string): PineConversion {
  const warnings: Msg[] = []
  const settings: Partial<Settings> = {}
  let name: string | null = null
  const out: string[] = []
  const entries: { long: string[]; short: string[] } = { long: [], short: [] }
  const exits: { long: string[]; short: string[] } = { long: [], short: [] }
  const entryDir = new Map<string, 1 | -1>()
  const closeById: { id: string; cond: string }[] = []
  let converted = 0
  const warn = (no: number, fr: string, en: string) => warnings.push({ fr: `Ligne ${no} : ${fr}`, en: `Line ${no}: ${en}` })

  const lines = joinContinuations(src)
  // Une variable Pine qui porte le nom d'un signal (long, short…) est renommée partout.
  const reserved = new Set<string>()
  for (const ln of lines) {
    const m = ln.text.match(/^(?:(?:var|varip)\s+)?(?:(?:float|int|bool)\s+)?(long|short|exitLong|exitShort|stopLoss|takeProfit)\s*=(?!=)/)
    if (m) reserved.add(m[1])
  }
  for (const r of reserved) {
    const re = new RegExp(`(?<![\\w.])${r}(?!\\w)`, 'g')
    for (const ln of lines) ln.text = ln.text.replace(re, `${r}_pine`)
    warnings.push({ fr: `Variable « ${r} » renommée « ${r}_pine » : ce nom est réservé aux signaux.`, en: `Variable '${r}' renamed '${r}_pine': this name is reserved for signals.` })
  }
  // Premier passage : identifiants des entrées, pour savoir quel sens ferme strategy.close("id").
  for (const ln of lines) {
    const m = ln.text.match(/strategy\.entry\s*\(\s*(["'])(.*?)\1\s*,\s*(strategy\.long|strategy\.short|true|false)/)
    if (m) entryDir.set(m[2], m[3] === 'strategy.long' || m[3] === 'true' ? 1 : -1)
  }

  const stack: { indent: number; cond: string }[] = []
  const lastIf = new Map<number, string>()
  let skipIndent = -1

  for (const ln of lines) {
    const { indent, no } = ln
    let text = ln.text.trim()
    if (skipIndent >= 0) {
      if (indent > skipIndent) continue
      skipIndent = -1
    }
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop()
    if (!text) continue
    if (text.startsWith('//')) {
      if (/^\/\/\s*@version/.test(text)) continue
      out.push(text)
      continue
    }
    text = text.replace(/\s+\/\/.*$/, '')
    const cond = () => (stack.length ? stack.map(s => paren(s.cond)).join(' and ') : '')

    // En-tête strategy(...) / indicator(...).
    const head = text.match(/^(strategy|indicator|study)\s*\((.*)\)\s*$/)
    if (head) {
      const args = splitArgs(head[2])
      const title = args.positional[0] ?? args.named.title
      if (title) name = unquote(title)
      const num = (k: string) => (args.named[k] != null ? Number(args.named[k]) : NaN)
      if (Number.isFinite(num('initial_capital'))) settings.capital = num('initial_capital')
      const ct = args.named.commission_type || ''
      if (Number.isFinite(num('commission_value'))) {
        if (/percent/.test(ct)) settings.feePct = num('commission_value')
        else if (/cash_per_order/.test(ct)) settings.feeFixed = num('commission_value')
        else warn(no, 'commission par contrat non reprise : réglez les frais à la main.', 'per-contract commission not converted: set the fees by hand.')
      }
      const qt = args.named.default_qty_type || ''
      if (/percent_of_equity/.test(qt) && Number.isFinite(num('default_qty_value'))) {
        settings.sizing = 'percent'
        settings.sizeValue = num('default_qty_value')
      } else if (/cash/.test(qt) && Number.isFinite(num('default_qty_value'))) {
        settings.sizing = 'fixed'
        settings.sizeValue = num('default_qty_value')
      } else if (qt || args.named.default_qty_value) {
        warn(no, 'taille en nombre de contrats non reprise : taille réglée en % du capital.', 'size in number of contracts not converted: size set as % of equity.')
      }
      if (Number.isFinite(num('slippage'))) warn(no, 'glissement en ticks non repris : réglez-le en % dans les réglages.', 'slippage in ticks not converted: set it as % in the settings.')
      if (num('pyramiding') > 1) warn(no, 'pyramidage non pris en charge : une seule position à la fois.', 'pyramiding not supported: one position at a time.')
      if (/process_orders_on_close\s*=\s*true/.test(head[2])) settings.fill = 'close'
      converted++
      continue
    }

    // Blocs if / else.
    let m = text.match(/^if\s+(.+)$/)
    if (m) {
      lastIf.set(indent, m[1].trim())
      stack.push({ indent, cond: m[1].trim() })
      converted++
      continue
    }
    m = text.match(/^else\s+if\s+(.+)$/)
    if (m && lastIf.has(indent)) {
      const prev = lastIf.get(indent)!
      stack.push({ indent, cond: `not ${paren(prev)} and ${paren(m[1].trim())}` })
      lastIf.set(indent, `${paren(prev)} or ${paren(m[1].trim())}`)
      converted++
      continue
    }
    if (/^else\s*$/.test(text) && lastIf.has(indent)) {
      stack.push({ indent, cond: `not ${paren(lastIf.get(indent)!)}` })
      converted++
      continue
    }
    if (/^(for|while|switch)\b/.test(text)) {
      warn(no, `boucle « ${text.split(/\s/)[0]} » non prise en charge, bloc ignoré.`, `'${text.split(/\s/)[0]}' loop not supported, block skipped.`)
      skipIndent = indent
      continue
    }

    // Ordres de stratégie.
    m = text.match(/^strategy\.entry\s*\((.*)\)$/)
    if (m) {
      const a = splitArgs(m[1])
      const id = unquote(a.positional[0] ?? a.named.id ?? '')
      const dirArg = a.positional[1] ?? a.named.direction ?? ''
      const dir: 1 | -1 = /short|false/.test(dirArg) ? -1 : 1
      const parts = [cond(), a.named.when ? paren(a.named.when) : ''].filter(Boolean)
      const c = parts.length ? parts.join(' and ') : 'true'
      ;(dir === 1 ? entries.long : entries.short).push(c)
      entryDir.set(id, dir)
      if (a.named.stop || a.named.limit) warn(no, 'ordre d\'entrée stop/limite exécuté au marché.', 'stop/limit entry order executed at market.')
      converted++
      continue
    }
    m = text.match(/^strategy\.close\s*\((.*)\)$/)
    if (m) {
      const a = splitArgs(m[1])
      const id = unquote(a.positional[0] ?? a.named.id ?? '')
      const parts = [cond(), a.named.when ? paren(a.named.when) : ''].filter(Boolean)
      closeById.push({ id, cond: parts.length ? parts.join(' and ') : 'true' })
      converted++
      continue
    }
    m = text.match(/^strategy\.close_all\s*\((.*)\)$/)
    if (m) {
      const a = splitArgs(m[1])
      const parts = [cond(), a.named.when ? paren(a.named.when) : ''].filter(Boolean)
      const c = parts.length ? parts.join(' and ') : 'true'
      exits.long.push(c)
      exits.short.push(c)
      converted++
      continue
    }
    m = text.match(/^strategy\.exit\s*\((.*)\)$/)
    if (m) {
      const a = splitArgs(m[1])
      const hints: string[] = []
      if (a.named.loss || a.named.stop) hints.push('stop')
      if (a.named.profit || a.named.limit) hints.push('objectif')
      if (a.named.trail_points || a.named.trail_offset || a.named.trail_price) hints.push('stop suiveur')
      warn(no, `strategy.exit non converti (${hints.join(', ') || 'sortie'}) : réglez stop, objectif et stop suiveur en % dans les réglages, ou définissez stopLoss = … et takeProfit = … (distances en prix).`,
        `strategy.exit not converted (${hints.join(', ').replace('objectif', 'target').replace('stop suiveur', 'trailing stop') || 'exit'}): set stop, target and trailing stop as % in the settings, or define stopLoss = … and takeProfit = … (price distances).`)
      continue
    }
    if (/^strategy\.(order|cancel|cancel_all|risk)/.test(text)) {
      warn(no, `${text.split('(')[0]} non pris en charge, ligne ignorée.`, `${text.split('(')[0]} not supported, line skipped.`)
      continue
    }

    // Lignes de dessin sans effet sur les trades.
    if (/^(plotshape|plotchar|plotarrow|plotcandle|plotbar|bgcolor|barcolor|fill|hline|alertcondition|alert|label\.|line\.|box\.|table\.|var\s+(label|line|box|table)\b)/.test(text)) continue

    // Définitions de fonctions et réaffectations.
    if (/^[A-Za-z_][\w.]*\s*\([^)]*\)\s*=>/.test(text)) {
      warn(no, 'fonction définie dans le script non prise en charge : elle est ignorée, et les lignes qui l\'appellent échoueront.', 'function defined in the script not supported: it is skipped, and the lines that call it will fail.')
      skipIndent = indent
      continue
    }
    if (/^[A-Za-z_][\w.]*\s*(:=|\+=|-=|\*=|\/=)/.test(text)) {
      warn(no, 'réaffectation (:=) non prise en charge : ligne mise en commentaire. Réécrivez-la avec ?: si possible.', 'reassignment (:=) not supported: line commented out. Rewrite it with ?: if possible.')
      out.push(`// ${text}   ← :=`)
      continue
    }
    if (/request\.security|security\s*\(/.test(text)) {
      warn(no, 'request.security (autre timeframe ou symbole) non pris en charge : ligne mise en commentaire.', 'request.security (other timeframe or symbol) not supported: line commented out.')
      out.push(`// ${text}`)
      continue
    }

    if (stack.length) {
      warn(no, 'instruction à l\'intérieur d\'un if ignorée (seuls les ordres de stratégie y sont repris).', 'statement inside an if skipped (only strategy orders are taken from it).')
      continue
    }

    // Ligne ordinaire : déclaration, input, plot.
    let line = text.replace(/^(var|varip)\s+/, '').replace(/^(float|int|bool|string|color|series|simple|const)\s+(?=[A-Za-z_])/, '')
    line = line.replace(/\bstrategy\.long\b/g, '1').replace(/\bstrategy\.short\b/g, '-1')
    if (/^\[.*\]\s*=/.test(line) || /^[A-Za-z_]\w*\s*=(?!=)/.test(line) || /^plot\s*\(/.test(line)) {
      out.push(line)
      converted++
      continue
    }
    warn(no, `ligne non reconnue, mise en commentaire : ${text.slice(0, 60)}`, `unrecognised line, commented out: ${text.slice(0, 60)}`)
    out.push(`// ${text}`)
  }

  for (const c of closeById) {
    const d = entryDir.get(c.id)
    if (d === 1 || d === undefined) exits.long.push(c.cond)
    if (d === -1 || d === undefined) exits.short.push(c.cond)
  }
  const join = (xs: string[]) => (xs.length === 1 ? stripOuter(xs[0]) : xs.map(paren).join(' or '))
  const sig: string[] = []
  if (entries.long.length) sig.push(`long = ${join(entries.long)}`)
  if (exits.long.length) sig.push(`exitLong = ${join(exits.long)}`)
  if (entries.short.length) sig.push(`short = ${join(entries.short)}`)
  if (exits.short.length) sig.push(`exitShort = ${join(exits.short)}`)
  if (!sig.length) {
    warnings.push({ fr: 'Aucun strategy.entry trouvé : ajoutez « long = condition » à la fin du script.', en: 'No strategy.entry found: add \'long = condition\' at the end of the script.' })
  }
  if (entries.short.length && !entries.long.length) settings.direction = 'short'
  else if (entries.short.length && entries.long.length) settings.direction = 'both'
  const header = [`// ${name ? name : 'Stratégie importée de Pine Script'}`, '// Convertie automatiquement : relisez les lignes signalées.', '']
  const script = [...header, ...trimBlank(out), '', '// Signaux', ...sig].join('\n') + '\n'
  return { script, name, settings, warnings, converted }
}

function joinContinuations(src: string): Line[] {
  const raw = src.replace(/\r/g, '').split('\n')
  const out: Line[] = []
  let depth = 0
  for (let i = 0; i < raw.length; i++) {
    const text = raw[i]
    const indentStr = text.match(/^[ \t]*/)![0]
    const indent = indentStr.replace(/\t/g, '    ').length
    const prev = out[out.length - 1]
    const trimmed = text.trim()
    // Une ligne qui continue la précédente : parenthèse ouverte, ou indentation qui n'est pas
    // un multiple de 4 (règle de Pine), ou opérateur en fin de ligne précédente.
    const contByIndent = prev && trimmed && indent > prev.indent && indent % 4 !== 0 && !trimmed.startsWith('//')
    const contByOp = prev && trimmed && /(\band|\bor|[-+*/?:,=(]|&&|\|\|)\s*$/.test(stripComment(prev.text))
    if (prev && (depth > 0 || contByIndent || contByOp)) {
      prev.text = stripComment(prev.text) + ' ' + trimmed
    } else out.push({ indent, text: trimmed, no: i + 1 })
    for (const ch of stripComment(trimmed)) {
      if (ch === '(' || ch === '[') depth++
      if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1)
    }
  }
  return out
}

function stripComment(s: string): string {
  let q: string | null = null
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (q) { if (ch === q) q = null; continue }
    if (ch === '"' || ch === "'") q = ch
    else if (ch === '/' && s[i + 1] === '/') return s.slice(0, i).trimEnd()
  }
  return s
}

function splitArgs(s: string): { positional: string[]; named: Record<string, string> } {
  const parts: string[] = []
  let depth = 0
  let q: string | null = null
  let cur = ''
  for (const ch of s) {
    if (q) { cur += ch; if (ch === q) q = null; continue }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue }
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  const positional: string[] = []
  const named: Record<string, string> = {}
  for (const p of parts) {
    const m = p.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.*)$/)
    if (m) named[m[1]] = m[2]
    else positional.push(p)
  }
  return { positional, named }
}

function unquote(s: string): string {
  return s.trim().replace(/^(["'])(.*)\1$/, '$2')
}

function paren(s: string): string {
  const t = s.trim()
  if (/^[\w.]+(\[\d+\])?$/.test(t) || /^[\w.]+\([^()]*\)$/.test(t)) return t
  return `(${t})`
}

/** Retire une paire de parenthèses qui entoure toute l'expression. */
function stripOuter(s: string): string {
  let t = s.trim()
  while (t.startsWith('(') && t.endsWith(')')) {
    let depth = 0
    let wraps = true
    for (let i = 0; i < t.length; i++) {
      if (t[i] === '(') depth++
      else if (t[i] === ')') depth--
      if (depth === 0 && i < t.length - 1) { wraps = false; break }
    }
    if (!wraps) break
    t = t.slice(1, -1).trim()
  }
  return t
}

function trimBlank(lines: string[]): string[] {
  const out: string[] = []
  for (const l of lines) if (l.trim() || (out.length && out[out.length - 1].trim())) out.push(l)
  return out
}
