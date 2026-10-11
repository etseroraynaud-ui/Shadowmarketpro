// Market Flow : contrôle des envois du collecteur (route /api/market-flow/ingest). Tout ce qui n'a pas
// exactement la forme attendue est refusé : le site n'écrit en base que des données bien formées.

import { createHash, timingSafeEqual } from 'node:crypto'
import { COINS, type BarRow, type Coin, type WhaleRow } from './aggregate.ts'

export const MAX_BYTES = 2_000_000
const MAX_ROWS = 2000
const EARLIEST = Date.UTC(2024, 0, 1) / 1000

/** Comparaison du jeton en temps constant (empreintes de même longueur). */
export function tokenMatches(given: string, expected: string): boolean {
  if (!given || !expected) return false
  const a = createHash('sha256').update(given).digest(), b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

class Invalid extends Error {}
const fail = (msg: string): never => { throw new Invalid(msg) }
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown, what: string, o: { min?: number; nullable?: boolean } = {}): number | null => {
  if (x === null || x === undefined) return o.nullable ? null : fail(`${what} manquant`)
  if (typeof x !== 'number' || !Number.isFinite(x)) return fail(`${what} n'est pas un nombre`)
  if (o.min !== undefined && x < o.min) return fail(`${what} < ${o.min}`)
  return x
}
const int = (x: unknown, what: string): number | null => {
  const v = num(x, what, { min: 0, nullable: true })
  return v === null ? null : Number.isInteger(v) ? v : fail(`${what} n'est pas un entier`)
}

export interface Ingest { coin: Coin; bars: BarRow[]; whales: WhaleRow[]; status: Record<string, unknown> | null }

/** Vérifie un envoi du collecteur ; lève une erreur au message lisible s'il est mal formé. */
export function parseIngest(body: unknown, nowS = Date.now() / 1000): Ingest {
  if (!isObj(body)) fail('corps JSON attendu')
  const b = body as Record<string, unknown>
  const coin = b.coin as Coin
  if (!COINS.includes(coin)) fail('coin doit valoir BTC ou ETH')
  const latest = nowS + 300
  const barsIn = b.bars ?? [], whalesIn = b.whales ?? []
  if (!Array.isArray(barsIn) || barsIn.length > MAX_ROWS) fail(`bars : tableau de ${MAX_ROWS} lignes au plus`)
  if (!Array.isArray(whalesIn) || whalesIn.length > MAX_ROWS) fail(`whales : tableau de ${MAX_ROWS} lignes au plus`)
  const bars = (barsIn as unknown[]).map((r, i): BarRow => {
    if (!isObj(r)) fail(`bars[${i}] : objet attendu`)
    const x = r as Record<string, unknown>
    const minute = num(x.minute, `bars[${i}].minute`)!
    if (!Number.isInteger(minute) || minute % 60 !== 0 || minute < EARLIEST || minute > latest) fail(`bars[${i}].minute hors limites`)
    const arr = (k: 'delta' | 'vol') => {
      const a = x[k]
      if (!Array.isArray(a) || a.length !== 4) fail(`bars[${i}].${k} : 4 nombres attendus`)
      return (a as unknown[]).map((v, j) => num(v, `bars[${i}].${k}[${j}]`, k === 'vol' ? { min: 0 } : {})!)
    }
    return {
      minute, px: num(x.px, `bars[${i}].px`, { min: 0, nullable: true }),
      delta: arr('delta'), vol: arr('vol'),
      liq_long: num(x.liq_long ?? 0, `bars[${i}].liq_long`, { min: 0 })!, liq_short: num(x.liq_short ?? 0, `bars[${i}].liq_short`, { min: 0 })!,
    }
  })
  const whales = (whalesIn as unknown[]).map((r, i): WhaleRow => {
    if (!isObj(r)) fail(`whales[${i}] : objet attendu`)
    const x = r as Record<string, unknown>
    const ts = num(x.ts, `whales[${i}].ts`)!
    if (ts < EARLIEST || ts > latest) fail(`whales[${i}].ts hors limites`)
    const f = (k: string, min?: number) => num(x[k], `whales[${i}].${k}`, { nullable: true, min })
    return {
      ts, px: f('px', 0), whale_long: f('whale_long', 0), whale_short: f('whale_short', 0),
      chg_net: f('chg_net'), chg_long: f('chg_long'), chg_short: f('chg_short'),
      n_long: int(x.n_long, `whales[${i}].n_long`), n_short: int(x.n_short, `whales[${i}].n_short`),
      cov_long: f('cov_long', 0), cov_short: f('cov_short', 0), oi: f('oi', 0),
      giant_long: f('giant_long', 0), giant_short: f('giant_short', 0),
      giant_n_long: int(x.giant_n_long, `whales[${i}].giant_n_long`), giant_n_short: int(x.giant_n_short, `whales[${i}].giant_n_short`),
      giant_chg_net: f('giant_chg_net'), giant_chg_long: f('giant_chg_long'), giant_chg_short: f('giant_chg_short'),
    }
  })
  let status: Record<string, unknown> | null = null
  if (b.status !== null && b.status !== undefined) {
    if (!isObj(b.status)) fail('status : objet attendu')
    if (JSON.stringify(b.status).length > 200_000) fail('status trop volumineux')
    status = b.status as Record<string, unknown>
  }
  return { coin, bars, whales, status }
}

export const isInvalid = (e: unknown): e is Error => e instanceof Invalid
