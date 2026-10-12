// Backtest du bot pour la page /live (trades simulés seulement, sans les réglages), mis en cache 30 s
// par le CDN pour chaque marché.

import { NextRequest, NextResponse } from 'next/server'
import { botBacktest } from '../../../live/backtest'

export const dynamic = 'force-dynamic'

/** Nom d'un marché Hyperliquid (« BTC », « xyz:NVDA »). */
const COIN = /^[A-Za-z0-9]{1,16}(:[A-Za-z0-9]{1,16})?$/

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const coin = q.get('coin') ?? '', tick = Number(q.get('tick'))
  if (!COIN.test(coin) || !(tick > 0 && tick <= 1000)) return NextResponse.json({ error: 'coin, tick > 0 attendus' }, { status: 400 })
  try {
    const bt = await botBacktest(coin, q.get('net') === 'testnet', q.get('version') === 'v1' ? 'v1' : 'public', tick)
    return NextResponse.json(bt, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
