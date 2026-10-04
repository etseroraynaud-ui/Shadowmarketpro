import type { Lang } from './i18n'

const loc = (lang: Lang) => (lang === 'fr' ? 'fr-FR' : 'en-US')

/** Évite « -0 » quand l'arrondi efface la valeur. */
function unsignedZero(x: number, digits: number): number {
  return Math.abs(x) < 0.5 * 10 ** -digits ? 0 : x
}

export function fmtNum(x: number, lang: Lang, digits = 2): string {
  if (!Number.isFinite(x)) return x === Infinity ? '∞' : x === -Infinity ? '−∞' : '—'
  x = unsignedZero(x, digits)
  return new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(x)
}

/** Montant arrondi selon sa taille. */
export function fmtMoney(x: number, lang: Lang): string {
  if (!Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  const digits = a >= 1000 ? 0 : a >= 1 ? 2 : 4
  return new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: a >= 1000 ? 0 : Math.min(2, digits) }).format(x)
}

/** Prix : assez de décimales pour les petits prix (forex, altcoins). */
export function fmtPrice(x: number, lang: Lang): string {
  if (!Number.isFinite(x)) return '—'
  const a = Math.abs(x)
  const digits = a >= 1000 ? 2 : a >= 10 ? 2 : a >= 1 ? 4 : 6
  return new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits }).format(x)
}

/** Fraction en pourcentage. Au-delà de 10 000 %, écrit en multiplicateur (×123). */
export function fmtPct(x: number, lang: Lang, digits = 1, sign = true): string {
  if (!Number.isFinite(x)) return x === Infinity ? '∞' : '—'
  if (Math.abs(x) >= 100) {
    return `×${new Intl.NumberFormat(loc(lang), { maximumFractionDigits: x + 1 >= 100 ? 0 : 1 }).format(x + 1)}`
  }
  const v = unsignedZero(x * 100, Math.abs(x * 100) < 10 ? Math.max(1, digits) : digits)
  const s = new Intl.NumberFormat(loc(lang), { maximumFractionDigits: digits, minimumFractionDigits: Math.abs(v) < 10 ? Math.min(1, digits) : 0 }).format(v)
  const nb = lang === 'fr' ? ' ' : ''
  return `${sign && v > 0 ? '+' : ''}${s}${nb}%`
}

export function fmtDate(t: number, lang: Lang, withTime = false): string {
  const d = new Date(t)
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }
  if (withTime) Object.assign(opts, { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleString(loc(lang), opts)
}

/** AAAA-MM-JJ en UTC, pour les champs date. */
export function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

export function parseDay(s: string): number | null {
  if (!s) return null
  const t = Date.parse(s + 'T00:00:00Z')
  return Number.isFinite(t) ? t : null
}

export function tone(x: number): 'pos' | 'neg' | 'neu' {
  if (!Number.isFinite(x) || x === 0) return 'neu'
  return x > 0 ? 'pos' : 'neg'
}

export function download(name: string, text: string, type = 'text/plain') {
  const blob = new Blob([text], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
