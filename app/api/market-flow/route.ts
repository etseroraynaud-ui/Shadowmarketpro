// Market Flow : données de la page /market-flow (BTC ou ETH, plage 4h/24h/7d/30d), mises en cache
// 30 s par le CDN : la base n'est interrogée qu'une fois par plage et par demi-minute.

import { NextRequest, NextResponse } from 'next/server'
import { COINS, RANGES, type Coin, type RangeKey } from '../../../lib/flow/aggregate'
import { getFlow } from '../../../lib/flow/source'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const coin = (req.nextUrl.searchParams.get('coin') ?? 'BTC').toUpperCase() as Coin
  const range = (req.nextUrl.searchParams.get('range') ?? '24h').toLowerCase() as RangeKey
  if (!COINS.includes(coin) || !(range in RANGES)) return NextResponse.json({ error: 'coin: BTC|ETH, range: 4h|24h|7d|30d' }, { status: 400 })
  const view = await getFlow(coin, range)
  return NextResponse.json(view, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
