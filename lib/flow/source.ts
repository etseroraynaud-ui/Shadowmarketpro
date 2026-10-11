// Market Flow : lecture des données (serveur seulement). En production : Supabase, par les fonctions
// SQL flow_bars_agg / flow_whales_agg (flow/supabase.sql) et la table flow_status. En test :
// FLOW_FIXTURE=<dossier> lit <dossier>/btc.json et eth.json (format de flow/tools/export_db.py).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RANGES, aggBars, aggWhales, buildView, type BarAgg, type BarRow, type Coin, type CollectorStatus, type FlowView, type RangeKey, type WhaleAgg, type WhaleRow } from './aggregate.ts'

const DAY5 = { span: 86400, bucket: 300 }

async function fromFixture(coin: Coin, range: RangeKey): Promise<FlowView> {
  let d: { bars: BarRow[]; whales: WhaleRow[]; status: CollectorStatus | null } = { bars: [], whales: [], status: null }
  try { d = JSON.parse(readFileSync(join(process.env.FLOW_FIXTURE!, `${coin.toLowerCase()}.json`), 'utf8')) } catch { /* actif sans données */ }
  const end = Math.max(d.bars.length ? d.bars[d.bars.length - 1].minute + 60 : 0, d.whales.length ? d.whales[d.whales.length - 1].ts : 0)
  const { span, bucket } = RANGES[range]
  return buildView({
    coin, range, status: d.status, updatedAt: end ? new Date(end * 1000).toISOString() : null, now: end || Date.now() / 1000,
    barsR: aggBars(d.bars, end - span - bucket, bucket), whalesR: aggWhales(d.whales, end - span - bucket, bucket),
    bars5: aggBars(d.bars, end - DAY5.span - DAY5.bucket, DAY5.bucket), whales5: aggWhales(d.whales, end - DAY5.span - DAY5.bucket, DAY5.bucket),
  })
}

async function fromSupabase(coin: Coin, range: RangeKey): Promise<FlowView> {
  const { supabaseAdmin: db } = await import('../supabase/admin')
  const now = Date.now() / 1000
  const { span, bucket } = RANGES[range]
  const bars = (since: number, b: number) => db.rpc('flow_bars_agg', { p_coin: coin, p_since: Math.floor(since), p_bucket: b })
  const whales = (since: number, b: number) => db.rpc('flow_whales_agg', { p_coin: coin, p_since: since, p_bucket: b })
  const same = range === '24h'
  const [bR, wR, b5, w5, st] = await Promise.all([
    bars(now - span - bucket, bucket), whales(now - span - bucket, bucket),
    same ? null : bars(now - DAY5.span - DAY5.bucket, DAY5.bucket), same ? null : whales(now - DAY5.span - DAY5.bucket, DAY5.bucket),
    db.from('flow_status').select('status, updated_at').eq('coin', coin).maybeSingle(),
  ])
  for (const r of [bR, wR, b5, w5, st]) if (r?.error) throw new Error(r.error.message)
  const barsR = (bR.data ?? []) as BarAgg[], whalesR = (wR.data ?? []) as WhaleAgg[]
  return buildView({
    coin, range, now, barsR, whalesR,
    bars5: same ? barsR : ((b5!.data ?? []) as BarAgg[]), whales5: same ? whalesR : ((w5!.data ?? []) as WhaleAgg[]),
    status: (st.data?.status ?? null) as CollectorStatus | null, updatedAt: st.data?.updated_at ?? null,
  })
}

/** Vue de la page ; une base indisponible donne une vue vide (la page l'indique) plutôt qu'une erreur. */
export async function getFlow(coin: Coin, range: RangeKey): Promise<FlowView> {
  try {
    return await (process.env.FLOW_FIXTURE ? fromFixture(coin, range) : fromSupabase(coin, range))
  } catch (e) {
    console.error('[market-flow] lecture impossible :', e instanceof Error ? e.message : e)
    return buildView({ coin, range, barsR: [], whalesR: [], bars5: [], whales5: [], status: null, updatedAt: null, now: Date.now() / 1000 })
  }
}
