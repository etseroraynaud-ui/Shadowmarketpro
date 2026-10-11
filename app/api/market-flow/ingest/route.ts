// Market Flow : réception des données du collecteur (serveur du bot, flow/collector.py). Jeton
// FLOW_INGEST_TOKEN (variable d'environnement Vercel) ; écriture avec la clé service, seule autorisée
// sur les tables flow_* (RLS sans politique). Les envois sont des upserts : un renvoi ne duplique rien.

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../../lib/supabase/admin'
import { MAX_BYTES, isInvalid, parseIngest, tokenMatches } from '../../../../lib/flow/ingest'

export const dynamic = 'force-dynamic'

const KEEP_DAYS = 35
const CHUNK = 500

export async function POST(req: NextRequest) {
  const expected = process.env.FLOW_INGEST_TOKEN
  if (!expected) return NextResponse.json({ error: 'ingestion non configurée' }, { status: 503 })
  const auth = req.headers.get('authorization') ?? ''
  if (!tokenMatches(auth.startsWith('Bearer ') ? auth.slice(7) : '', expected)) return NextResponse.json({ error: 'jeton invalide' }, { status: 401 })
  const raw = await req.text()
  if (raw.length > MAX_BYTES) return NextResponse.json({ error: 'envoi trop volumineux' }, { status: 413 })
  let data
  try {
    data = parseIngest(JSON.parse(raw))
  } catch (e) {
    return NextResponse.json({ error: isInvalid(e) ? e.message : 'JSON invalide' }, { status: 400 })
  }
  const { coin, bars, whales, status } = data
  try {
    for (let i = 0; i < bars.length; i += CHUNK) {
      const { error } = await supabaseAdmin.from('flow_bars').upsert(bars.slice(i, i + CHUNK).map(b => ({ coin, ...b })), { onConflict: 'coin,minute' })
      if (error) throw new Error(`flow_bars : ${error.message}`)
    }
    for (let i = 0; i < whales.length; i += CHUNK) {
      const { error } = await supabaseAdmin.from('flow_whales').upsert(whales.slice(i, i + CHUNK).map(w => ({ coin, ...w })), { onConflict: 'coin,ts' })
      if (error) throw new Error(`flow_whales : ${error.message}`)
    }
    if (status) {
      const { error } = await supabaseAdmin.from('flow_status').upsert({ coin, status, updated_at: new Date().toISOString() }, { onConflict: 'coin' })
      if (error) throw new Error(`flow_status : ${error.message}`)
    }
    // Rétention : une fois par heure (première minute), lignes de plus de KEEP_DAYS jours.
    if (new Date().getUTCMinutes() === 0) {
      const cut = Math.floor(Date.now() / 1000) - KEEP_DAYS * 86400
      await supabaseAdmin.from('flow_bars').delete().eq('coin', coin).lt('minute', cut)
      await supabaseAdmin.from('flow_whales').delete().eq('coin', coin).lt('ts', cut)
    }
  } catch (e) {
    console.error('[market-flow/ingest]', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'écriture en base impossible' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, bars: bars.length, whales: whales.length })
}
