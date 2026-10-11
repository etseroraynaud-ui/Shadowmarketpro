// Market Flow : agrégation des données publiées par le collecteur (flow/collector.py) pour la page
// /market-flow. Fonctions pures, sans accès réseau : la source (Supabase ou fichier de test) est dans
// source.ts. Les règles de lecture (seuils, verdicts) reprennent celles du dashboard local
// whale_dashboard.py v2 ; elles décrivent le flux, ce ne sont pas des signaux.

export const COINS = ['BTC', 'ETH'] as const
export type Coin = (typeof COINS)[number]

export const RANGES = {
  '4h': { span: 4 * 3600, bucket: 60, label: '4H' },
  '24h': { span: 24 * 3600, bucket: 300, label: '24H' },
  '7d': { span: 7 * 86400, bucket: 1800, label: '7D' },
  '30d': { span: 30 * 86400, bucket: 7200, label: '30D' },
} as const
export type RangeKey = keyof typeof RANGES

/** Tailles d'ordre agresseur (USD) : [retail, 10–100 k$, 100 k–1 M$, ≥ 1 M$]. */
export const BUCKETS = ['Retail < $10k', '$10k–100k', '$100k–1M', '≥ $1M'] as const

/** Minute close telle que publiée (table flow_bars). spot_* : même chose sur le spot, null sans flux spot. */
export interface BarRow {
  minute: number; px: number | null; delta: number[]; vol: number[]; liq_long: number; liq_short: number
  spot_delta?: number[] | null; spot_vol?: number[] | null
}
/** Échantillon whales tel que publié (table flow_whales). */
export interface WhaleRow {
  ts: number; px: number | null; whale_long: number | null; whale_short: number | null
  chg_net: number | null; chg_long: number | null; chg_short: number | null; n_long: number | null; n_short: number | null
  cov_long: number | null; cov_short: number | null; oi: number | null
  giant_long: number | null; giant_short: number | null; giant_n_long: number | null; giant_n_short: number | null
  giant_chg_net: number | null; giant_chg_long: number | null; giant_chg_short: number | null
}
/** Tranche de barres (fonction SQL flow_bars_agg). s*, sv* : spot ; sn : minutes avec du spot (absents
 * avec la fonction d'avant le spot : traités comme « pas de spot »). */
export interface BarAgg {
  t: number; px: number | null; d0: number; d1: number; d2: number; d3: number; v0: number; v1: number; v2: number; v3: number
  liq_long: number; liq_short: number; n: number
  s0?: number; s1?: number; s2?: number; s3?: number; sv0?: number; sv1?: number; sv2?: number; sv3?: number; sn?: number
}
/** Tranche d'échantillons whales (fonction SQL flow_whales_agg). */
export interface WhaleAgg {
  t: number; px: number | null; whale_long: number | null; whale_short: number | null
  chg_net: number | null; chg_long: number | null; chg_short: number | null; n_long: number | null; n_short: number | null
  cov_long: number | null; cov_short: number | null; oi: number | null
  giant_long: number | null; giant_short: number | null; giant_n_long: number | null; giant_n_short: number | null
  giant_chg_net: number | null; giant_chg_long: number | null; giant_chg_short: number | null
  n: number; first_ts: number
}

export interface TopPosition { address: string; szi: number; value: number; entry: number | null; liq: number | null; lev: number | null; upnl: number | null; age_s: number | null }
/** État courant publié par le collecteur (table flow_status, champ status). */
export interface CollectorStatus {
  price?: number | null
  feeds?: Record<string, { n: number; age_s: number | null; status?: string | null }>
  hl?: {
    px?: number | null; oi?: number | null
    coverage?: { long_all?: number | null; short_all?: number | null; gross_all?: number | null }
    whales?: { long: number; short: number; n_long: number; n_short: number }
    giants?: { long: number; short: number; n_long: number; n_short: number; top1?: number | null; top3?: number | null }
    known?: number; inspected?: number; median_age_s?: number | null; ws_connected?: boolean
    top?: TopPosition[]
  }
}

// ---------------------------------------------------------------- regroupement (miroir du SQL)
const sum = (xs: (number | null)[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0)

/** Même calcul que flow_bars_agg (utilisé pour les fichiers de test et vérifié contre le SQL). */
export function aggBars(rows: BarRow[], since: number, bucket: number): BarAgg[] {
  const by = new Map<number, BarRow[]>()
  for (const r of rows) if (r.minute >= since) { const t = Math.floor(r.minute / bucket) * bucket; (by.get(t) ?? by.set(t, []).get(t)!).push(r) }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, rs]) => {
    rs.sort((a, b) => a.minute - b.minute)
    const withPx = rs.filter(r => r.px !== null)
    return {
      t, px: withPx.length ? withPx[withPx.length - 1].px : null,
      d0: sum(rs.map(r => r.delta[0])), d1: sum(rs.map(r => r.delta[1])), d2: sum(rs.map(r => r.delta[2])), d3: sum(rs.map(r => r.delta[3])),
      v0: sum(rs.map(r => r.vol[0])), v1: sum(rs.map(r => r.vol[1])), v2: sum(rs.map(r => r.vol[2])), v3: sum(rs.map(r => r.vol[3])),
      liq_long: sum(rs.map(r => r.liq_long)), liq_short: sum(rs.map(r => r.liq_short)), n: rs.length,
      s0: sum(rs.map(r => r.spot_delta?.[0] ?? null)), s1: sum(rs.map(r => r.spot_delta?.[1] ?? null)),
      s2: sum(rs.map(r => r.spot_delta?.[2] ?? null)), s3: sum(rs.map(r => r.spot_delta?.[3] ?? null)),
      sv0: sum(rs.map(r => r.spot_vol?.[0] ?? null)), sv1: sum(rs.map(r => r.spot_vol?.[1] ?? null)),
      sv2: sum(rs.map(r => r.spot_vol?.[2] ?? null)), sv3: sum(rs.map(r => r.spot_vol?.[3] ?? null)),
      sn: rs.filter(r => r.spot_delta).length,
    }
  })
}

/** Même calcul que flow_whales_agg : stock = dernier échantillon de la tranche, flux = somme. */
export function aggWhales(rows: WhaleRow[], since: number, bucket: number): WhaleAgg[] {
  const by = new Map<number, WhaleRow[]>()
  for (const r of rows) if (r.ts >= since) { const t = Math.floor(r.ts / bucket) * bucket; (by.get(t) ?? by.set(t, []).get(t)!).push(r) }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, rs]) => {
    rs.sort((a, b) => a.ts - b.ts)
    const l = rs[rs.length - 1]
    return {
      t, px: l.px, whale_long: l.whale_long, whale_short: l.whale_short,
      chg_net: sum(rs.map(r => r.chg_net)), chg_long: sum(rs.map(r => r.chg_long)), chg_short: sum(rs.map(r => r.chg_short)),
      n_long: l.n_long, n_short: l.n_short, cov_long: l.cov_long, cov_short: l.cov_short, oi: l.oi,
      giant_long: l.giant_long, giant_short: l.giant_short, giant_n_long: l.giant_n_long, giant_n_short: l.giant_n_short,
      giant_chg_net: sum(rs.map(r => r.giant_chg_net)), giant_chg_long: sum(rs.map(r => r.giant_chg_long)), giant_chg_short: sum(rs.map(r => r.giant_chg_short)),
      n: rs.length, first_ts: rs[0].ts,
    }
  })
}

// ---------------------------------------------------------------- lecture (whale_dashboard.py)
const R = {
  divThr: 6,             // divergence significative (points)
  imbThr: 0.05,          // déséquilibre acheteur/vendeur significatif
  minBigVol: 2_000_000,  // volume ≥ 100 k$ minimal pour conclure (par fenêtre)
  minSmallVol: 200_000,  // volume retail minimal
  minCoverage: 0.25,     // couverture minimale de l'OI pour un verdict whales
  flowMin: 1_000_000,    // |Δ| minimal pour qualifier le positionnement whales
  giantNeutral: 10,      // |biais giant| < 10 % : neutre
}

export type Tone = 'pos' | 'neg' | 'neutral' | 'muted'
export interface Stance { label: string; tone: Tone }

/** Flux agresseur d'un marché (perpétuels ou spot) sur une fenêtre, par taille d'ordre. */
export interface FlowSide {
  cvd: { retail: number; mid: number; large: number; mega: number; big: number }
  vol: { retail: number; mid: number; large: number; mega: number; big: number }
  imb: { retail: number | null; big: number | null; mega: number | null }
  /** (déséquilibre ≥ 100 k$ − déséquilibre retail) / 2, en points. */
  divergence: number | null
  verdict: Stance
  big: Stance
  retail: Stance
}

export interface WindowSummary extends FlowSide {
  key: '1h' | '4h' | '24h'
  minutes: number
  /** Minutes de barres présentes dans la fenêtre (couverture des données). */
  barMinutes: number
  priceChg: number | null
  /** Spot (Binance, Coinbase, OKX), compté à part ; minutes = minutes avec du spot dans la fenêtre. */
  spot: FlowSide & { minutes: number }
  liq: { long: number; short: number; stance: Stance }
  whales: { net: number; long: number; short: number; ok: boolean; spanMin: number; stance: Stance }
  giants: { net: number; long: number; short: number; ok: boolean }
}

export interface FlowView {
  coin: Coin
  range: RangeKey
  /** Fin des données (secondes) ; null si aucune donnée. */
  end: number | null
  updatedAt: string | null
  stale: boolean
  series: {
    t: number[]; px: (number | null)[]
    cvdRetail: (number | null)[]; cvdBig: (number | null)[]; cvdMega: (number | null)[]; cvdMid: (number | null)[]; cvdLarge: (number | null)[]
    spotRetail: (number | null)[]; spotBig: (number | null)[]; spotMega: (number | null)[]
    /** CVD toutes tailles : perpétuels et spot. */
    perpTotal: (number | null)[]; spotTotal: (number | null)[]
    whaleLong: (number | null)[]; whaleShort: (number | null)[]; whaleNet: (number | null)[]
    giantNet: (number | null)[]; giantBias: (number | null)[]
    liqLong: (number | null)[]; liqShort: (number | null)[]
  }
  windows: WindowSummary[]
  reading: string[]
  now: {
    price: number | null
    whaleLong: number | null; whaleShort: number | null; nLong: number | null; nShort: number | null
    giantLong: number | null; giantShort: number | null; giantBias: number | null; nGiantLong: number | null; nGiantShort: number | null
    coverage: number | null; oi: number | null; known: number | null; inspected: number | null
    feeds: { venue: string; ok: boolean; ageS: number | null }[]
    top: TopPosition[]
  }
}

export const usd = (x: number | null | undefined, signed = false) => {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—'
  const s = x < 0 ? '−' : signed && x > 0 ? '+' : ''
  const a = Math.abs(x)
  return a >= 1e9 ? `${s}$${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${s}$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${s}$${(a / 1e3).toFixed(0)}k` : `${s}$${a.toFixed(0)}`
}

const imbOf = (d: number, v: number) => (v > 0 ? d / v : null)
const side = (imb: number | null, vol: number, min: number): Stance =>
  vol < min || imb === null ? { label: 'Low volume', tone: 'muted' }
    : imb >= R.imbThr ? { label: 'Buying', tone: 'pos' } : imb <= -R.imbThr ? { label: 'Selling', tone: 'neg' } : { label: 'Balanced', tone: 'neutral' }

/** Déséquilibres, divergence et verdict d'un marché, à partir des sommes par taille [retail, 10–100 k$, 100 k–1 M$, ≥ 1 M$]. */
function flowOf(d: number[], v: number[]): FlowSide {
  const bigD = d[2] + d[3], bigV = v[2] + v[3]
  const imb = { retail: imbOf(d[0], v[0]), big: imbOf(bigD, bigV), mega: imbOf(d[3], v[3]) }
  const enough = bigV >= R.minBigVol && v[0] >= R.minSmallVol
  const divergence = imb.big !== null && imb.retail !== null ? ((imb.big - imb.retail) / 2) * 100 : null
  let verdict: Stance
  if (!enough || divergence === null) verdict = { label: 'Not enough volume to compare', tone: 'muted' }
  else if (divergence >= R.divThr) verdict = imb.big! > 0 && imb.retail! < 0 ? { label: 'Large orders buying, retail selling', tone: 'pos' } : { label: 'Large orders buying more than retail', tone: 'pos' }
  else if (divergence <= -R.divThr) verdict = imb.big! < 0 && imb.retail! > 0 ? { label: 'Large orders selling, retail buying', tone: 'neg' } : { label: 'Large orders selling more than retail', tone: 'neg' }
  else verdict = { label: 'No clear divergence', tone: 'neutral' }
  return {
    cvd: { retail: d[0], mid: d[1], large: d[2], mega: d[3], big: bigD },
    vol: { retail: v[0], mid: v[1], large: v[2], mega: v[3], big: bigV },
    imb, divergence, verdict,
    big: side(imb.big, bigV, R.minBigVol), retail: side(imb.retail, v[0], R.minSmallVol),
  }
}

function windowSummary(key: WindowSummary['key'], minutes: number, end: number, bars5: BarAgg[], whales5: WhaleAgg[], whaleStock: number, coverage: number | null): WindowSummary {
  const from = end - minutes * 60
  const bs = bars5.filter(b => b.t >= from && b.t < end)
  const s = (k: keyof BarAgg) => bs.reduce((a, b) => a + ((b[k] as number | undefined) ?? 0), 0)
  const perps = flowOf([s('d0'), s('d1'), s('d2'), s('d3')], [s('v0'), s('v1'), s('v2'), s('v3')])
  const spotMinutes = s('sn')
  const spot = { ...flowOf([s('s0'), s('s1'), s('s2'), s('s3')], [s('sv0'), s('sv1'), s('sv2'), s('sv3')]), minutes: spotMinutes }
  if (!spotMinutes) { spot.verdict = spot.big = spot.retail = { label: 'No spot data yet', tone: 'muted' } }
  const withPx = bs.filter(b => b.px !== null)
  const before = bars5.filter(b => b.t < from && b.px !== null).pop()
  const p0 = (before ?? withPx[0])?.px ?? null, p1 = withPx.length ? withPx[withPx.length - 1].px : null
  const liqL = s('liq_long'), liqS = s('liq_short'), liqT = liqL + liqS
  const liqStance: Stance = liqT < 100_000 ? { label: 'Low', tone: 'muted' } : liqL >= 2 * liqS ? { label: 'Longs flushed', tone: 'neg' } : liqS >= 2 * liqL ? { label: 'Shorts squeezed', tone: 'pos' } : { label: 'Balanced', tone: 'neutral' }
  const ws = whales5.filter(w => w.t >= from && w.t < end)
  const first = ws.length ? Math.min(...ws.map(w => w.first_ts)) : null
  const spanMin = first !== null ? (end - first) / 60 : 0
  const ok = spanMin >= minutes * 0.9
  const net = ws.reduce((a, w) => a + (w.chg_net ?? 0), 0)
  const thr = Math.max(R.flowMin, 0.0025 * whaleStock)
  const wStance: Stance = coverage === null ? { label: 'No open-interest data', tone: 'muted' }
    : coverage < R.minCoverage ? { label: 'Coverage too low', tone: 'muted' }
      : !ok ? { label: `History ${Math.round(spanMin)}/${minutes} min`, tone: 'muted' }
        : net >= thr ? { label: 'Adding net long', tone: 'pos' } : net <= -thr ? { label: 'Adding net short', tone: 'neg' } : { label: 'Steady', tone: 'neutral' }
  return {
    key, minutes, barMinutes: bs.reduce((a, b) => a + b.n, 0),
    priceChg: p0 && p1 ? p1 / p0 - 1 : null,
    ...perps, spot,
    liq: { long: liqL, short: liqS, stance: liqStance },
    whales: { net, long: ws.reduce((a, w) => a + (w.chg_long ?? 0), 0), short: ws.reduce((a, w) => a + (w.chg_short ?? 0), 0), ok, spanMin, stance: wStance },
    giants: { net: ws.reduce((a, w) => a + (w.giant_chg_net ?? 0), 0), long: ws.reduce((a, w) => a + (w.giant_chg_long ?? 0), 0), short: ws.reduce((a, w) => a + (w.giant_chg_short ?? 0), 0), ok },
  }
}

function reading(w: WindowSummary, now: FlowView['now'], coin: Coin): string[] {
  const out: string[] = []
  const pc = w.priceChg !== null ? ` while the price moved ${w.priceChg >= 0 ? '+' : '−'}${Math.abs(w.priceChg * 100).toFixed(2)}%` : ''
  if (w.verdict.tone !== 'muted') {
    out.push(`Over the last hour on ${coin} perpetuals, orders of $100k and more were ${w.big.label.toLowerCase()} (net ${usd(w.cvd.big, true)}) and retail orders under $10k were ${w.retail.label.toLowerCase()} (net ${usd(w.cvd.retail, true)})${pc}: ${w.verdict.label.toLowerCase()}.`)
  } else {
    out.push(`Over the last hour on ${coin} perpetuals, there was not enough volume in both size groups to compare large orders with retail.`)
  }
  if (w.spot.minutes > 0) {
    out.push(w.spot.verdict.tone !== 'muted'
      ? `On spot (Binance, Coinbase, OKX), large orders were ${w.spot.big.label.toLowerCase()} (net ${usd(w.spot.cvd.big, true)}) and retail was ${w.spot.retail.label.toLowerCase()} (net ${usd(w.spot.cvd.retail, true)}): ${w.spot.verdict.label.toLowerCase()}. All sizes together, spot net flow was ${usd(w.spot.cvd.big + w.spot.cvd.mid + w.spot.cvd.retail, true)} against ${usd(w.cvd.big + w.cvd.mid + w.cvd.retail, true)} on perpetuals.`
      : `On spot (Binance, Coinbase, OKX), there was not enough volume in both size groups to compare large orders with retail.`)
  }
  if (now.whaleLong !== null && now.whaleShort !== null) {
    const net = now.whaleLong - now.whaleShort
    const parts: string[] = []
    if (w.whales.stance.tone !== 'muted') {
      if (w.whales.long > 0.2 * R.flowMin) parts.push('added to their longs')
      else if (w.whales.long < -0.2 * R.flowMin) parts.push('cut their longs')
      if (w.whales.short > 0.2 * R.flowMin) parts.push('added to their shorts')
      else if (w.whales.short < -0.2 * R.flowMin) parts.push('covered shorts')
    }
    const flow = w.whales.stance.tone === 'muted' ? ` (hourly change not yet measurable: ${w.whales.stance.label.toLowerCase()})` : parts.length ? `; over the hour they ${parts.join(' and ')} (${usd(w.whales.net, true)} net)` : `; their exposure was steady over the hour (${usd(w.whales.net, true)})`
    out.push(`Tracked Hyperliquid whales (positions of $500k or more) are net ${net >= 0 ? 'long' : 'short'} ${usd(Math.abs(net))}: ${usd(now.whaleLong)} long across ${now.nLong ?? 0} accounts against ${usd(now.whaleShort)} short across ${now.nShort ?? 0}${flow}.`)
  }
  if (now.giantBias !== null) {
    const b = now.giantBias
    out.push(Math.abs(b) < R.giantNeutral
      ? `Giant positions ($5M and more) are roughly balanced (net bias ${b >= 0 ? '+' : '−'}${Math.abs(b).toFixed(0)}%).`
      : `Giant positions ($5M and more) lean ${b > 0 ? 'long' : 'short'} (net bias ${b > 0 ? '+' : '−'}${Math.abs(b).toFixed(0)}%).`)
  }
  if (w.liq.stance.tone !== 'muted') out.push(`Liquidations over the hour: ${usd(w.liq.long)} of longs and ${usd(w.liq.short)} of shorts (${w.liq.stance.label.toLowerCase()}).`)
  return out
}

/**
 * Vue de la page. barsR/whalesR : tranches de la plage affichée ; bars5/whales5 : dernières 24 h en
 * tranches de 5 min (fenêtres 1 h, 4 h, 24 h). now : heure courante (secondes), pour l'âge des données.
 */
export function buildView(o: {
  coin: Coin; range: RangeKey; barsR: BarAgg[]; whalesR: WhaleAgg[]; bars5: BarAgg[]; whales5: WhaleAgg[]
  status: CollectorStatus | null; updatedAt: string | null; now: number
}): FlowView {
  const { span, bucket } = RANGES[o.range]
  const lastBar = o.bars5.length ? o.bars5[o.bars5.length - 1].t + 300 : o.barsR.length ? o.barsR[o.barsR.length - 1].t + bucket : null
  const lastWhale = o.whales5.length ? o.whales5[o.whales5.length - 1].t + 300 : null
  const end = lastBar !== null || lastWhale !== null ? Math.max(lastBar ?? 0, lastWhale ?? 0) : null
  const st = o.status?.hl
  const lastW = o.whales5.length ? o.whales5[o.whales5.length - 1] : o.whalesR.length ? o.whalesR[o.whalesR.length - 1] : null
  const wl = st?.whales?.long ?? lastW?.whale_long ?? null, wsh = st?.whales?.short ?? lastW?.whale_short ?? null
  const gl = st?.giants?.long ?? lastW?.giant_long ?? null, gs = st?.giants?.short ?? lastW?.giant_short ?? null
  const coverage = st?.coverage?.gross_all ?? (lastW && lastW.cov_long !== null && lastW.cov_short !== null ? (lastW.cov_long + lastW.cov_short) / 2 : null)
  const now: FlowView['now'] = {
    price: o.status?.price ?? st?.px ?? lastW?.px ?? null,
    whaleLong: wl, whaleShort: wsh, nLong: st?.whales?.n_long ?? lastW?.n_long ?? null, nShort: st?.whales?.n_short ?? lastW?.n_short ?? null,
    giantLong: gl, giantShort: gs, giantBias: gl !== null && gs !== null && gl + gs > 0 ? ((gl - gs) / (gl + gs)) * 100 : null,
    nGiantLong: st?.giants?.n_long ?? lastW?.giant_n_long ?? null, nGiantShort: st?.giants?.n_short ?? lastW?.giant_n_short ?? null,
    coverage, oi: st?.oi ?? lastW?.oi ?? null, known: st?.known ?? null, inspected: st?.inspected ?? null,
    feeds: ['Binance', 'Bybit', 'OKX', 'Binance spot', 'Coinbase', 'OKX spot', 'Hyperliquid'].map(v => { const f = o.status?.feeds?.[v]; return { venue: v, ok: !!f && f.age_s !== null && f.age_s < 120, ageS: f?.age_s ?? null } }),
    top: (st?.top ?? []).slice(0, 15),
  }

  // Séries sur une grille régulière : une tranche manquante reste vide (trou dans la courbe).
  const t: number[] = []
  const series: FlowView['series'] = {
    t, px: [], cvdRetail: [], cvdBig: [], cvdMega: [], cvdMid: [], cvdLarge: [], spotRetail: [], spotBig: [], spotMega: [], perpTotal: [], spotTotal: [],
    whaleLong: [], whaleShort: [], whaleNet: [], giantNet: [], giantBias: [], liqLong: [], liqShort: [],
  }
  if (end !== null) {
    const stop = Math.ceil(end / bucket) * bucket
    const start = stop - span
    const bm = new Map(o.barsR.map(b => [b.t, b]))
    const wm = new Map(o.whalesR.map(w => [w.t, w]))
    let cR = 0, cB = 0, cM = 0, cMid = 0, cL = 0, sR = 0, sB = 0, sM = 0, sT = 0
    for (let x = start; x < stop; x += bucket) {
      const b = bm.get(x), w = wm.get(x)
      t.push(x)
      if (b) { cR += b.d0; cMid += b.d1; cL += b.d2; cM += b.d3; cB += b.d2 + b.d3 }
      const has = !!b
      series.px.push(b?.px ?? w?.px ?? null)
      series.cvdRetail.push(has ? cR : null); series.cvdBig.push(has ? cB : null); series.cvdMega.push(has ? cM : null)
      series.cvdMid.push(has ? cMid : null); series.cvdLarge.push(has ? cL : null)
      series.perpTotal.push(has ? cR + cMid + cB : null)
      const sp = !!b && (b.sn ?? 0) > 0
      if (sp) { sR += b!.s0 ?? 0; sB += (b!.s2 ?? 0) + (b!.s3 ?? 0); sM += b!.s3 ?? 0; sT += (b!.s0 ?? 0) + (b!.s1 ?? 0) + (b!.s2 ?? 0) + (b!.s3 ?? 0) }
      series.spotRetail.push(sp ? sR : null); series.spotBig.push(sp ? sB : null); series.spotMega.push(sp ? sM : null); series.spotTotal.push(sp ? sT : null)
      series.whaleLong.push(w?.whale_long ?? null); series.whaleShort.push(w?.whale_short ?? null)
      series.whaleNet.push(w && w.whale_long !== null && w.whale_short !== null ? w.whale_long - w.whale_short : null)
      series.giantNet.push(w && w.giant_long !== null && w.giant_short !== null ? w.giant_long - w.giant_short : null)
      series.giantBias.push(w && w.giant_long !== null && w.giant_short !== null && w.giant_long + w.giant_short > 0 ? ((w.giant_long - w.giant_short) / (w.giant_long + w.giant_short)) * 100 : null)
      series.liqLong.push(b ? b.liq_long : null); series.liqShort.push(b ? b.liq_short : null)
    }
  }
  const windows = end === null ? [] : ([['1h', 60], ['4h', 240], ['24h', 1440]] as const).map(([k, m]) =>
    windowSummary(k, m, Math.floor(end / 300) * 300, o.bars5, o.whales5, (wl ?? 0) + (wsh ?? 0), coverage))
  const updated = o.updatedAt ? Date.parse(o.updatedAt) / 1000 : end
  return {
    coin: o.coin, range: o.range, end, updatedAt: o.updatedAt,
    stale: updated === null || o.now - updated > 600,
    series, windows,
    reading: windows.length ? reading(windows[0], now, o.coin) : [],
    now,
  }
}
