// Formats des chiffres des pages de recherche (anglais, vrai signe moins U+2212).

const MINUS = '−'
const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

/** 0.645 → "64.5%" */
export const pct = (x: number | null | undefined, d = 1) => (ok(x) ? `${x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)}%` : '—')
/** 0.645 → "+64.5%" */
export const spct = (x: number | null | undefined, d = 1) => (ok(x) ? `${x > 0 ? '+' : x < 0 ? MINUS : ''}${Math.abs(x * 100).toFixed(d)}%` : '—')
/** 1.726 → "1.73" */
export const num = (x: number | null | undefined, d = 2) => (ok(x) ? `${x < 0 ? MINUS : ''}${Math.abs(x).toFixed(d)}` : '—')
/** 1804 → "1,804" */
export const int = (x: number | null | undefined) => (ok(x) ? Math.round(x).toLocaleString('en-US') : '—')
/** 114.9 → "115×" */
export const times = (x: number | null | undefined, d = 0) => (ok(x) ? `${x.toFixed(d)}×` : '—')
/** Mois "2022-02" → "Feb 2022" */
export const month = (m: string) => {
  const [y, k] = m.split('-').map(Number)
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][k - 1]} ${y}`
}
/** Numéro de mois (année × 12 + mois, base 0) → "2022-02" */
export const monthKey = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, '0')}`
