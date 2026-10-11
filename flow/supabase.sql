-- Market Flow : tables et fonctions de lecture (à exécuter une fois : Supabase → SQL Editor → Run).
-- Rejouable sans risque (create if not exists / create or replace).
--
-- Le collecteur du serveur n'écrit jamais ici directement : il envoie ses données à
-- /api/market-flow/ingest (jeton FLOW_INGEST_TOKEN), qui écrit avec la clé service du site. La page
-- /market-flow lit par /api/market-flow, côté serveur. Aucune table n'est exposée au public (RLS
-- activé sans politique) : la clé anon publique du site ne peut ni lire ni écrire ces données.

-- Une ligne par actif et par minute UTC close : ordres agresseurs (taker) des perpétuels Binance,
-- Bybit et OKX, en dollars, par taille d'ordre [retail < 10 k$, 10–100 k$, 100 k–1 M$, ≥ 1 M$] ;
-- delta = achats − ventes, vol = achats + ventes ; liquidations par côté de la position liquidée.
create table if not exists public.flow_bars (
  coin text not null check (coin in ('BTC', 'ETH')),
  minute bigint not null,
  px double precision,
  delta double precision[] not null check (array_length(delta, 1) = 4),
  vol double precision[] not null check (array_length(vol, 1) = 4),
  liq_long double precision not null default 0,
  liq_short double precision not null default 0,
  primary key (coin, minute)
);

-- Un échantillon par actif et par minute : stock des positions whales Hyperliquid observées
-- (≥ 500 k$ ; giants ≥ 5 M$), flux depuis l'échantillon précédent (chg_*), couverture de l'OI.
create table if not exists public.flow_whales (
  coin text not null check (coin in ('BTC', 'ETH')),
  ts double precision not null,
  px double precision,
  whale_long double precision,
  whale_short double precision,
  chg_net double precision,
  chg_long double precision,
  chg_short double precision,
  n_long integer,
  n_short integer,
  cov_long double precision,
  cov_short double precision,
  oi double precision,
  giant_long double precision,
  giant_short double precision,
  giant_n_long integer,
  giant_n_short integer,
  giant_chg_net double precision,
  giant_chg_long double precision,
  giant_chg_short double precision,
  primary key (coin, ts)
);

-- État courant du collecteur par actif (santé des flux, couverture, plus grosses positions).
create table if not exists public.flow_status (
  coin text primary key check (coin in ('BTC', 'ETH')),
  updated_at timestamptz not null default now(),
  status jsonb not null
);

alter table public.flow_bars enable row level security;
alter table public.flow_whales enable row level security;
alter table public.flow_status enable row level security;

-- Barres regroupées par tranches de p_bucket secondes (prix : dernier de la tranche).
create or replace function public.flow_bars_agg(p_coin text, p_since bigint, p_bucket integer)
returns table (
  t bigint, px double precision,
  d0 double precision, d1 double precision, d2 double precision, d3 double precision,
  v0 double precision, v1 double precision, v2 double precision, v3 double precision,
  liq_long double precision, liq_short double precision, n integer
)
language sql stable
set search_path = public
as $$
  select (b.minute / p_bucket) * p_bucket,
         (array_agg(b.px order by b.minute desc) filter (where b.px is not null))[1],
         sum(b.delta[1]), sum(b.delta[2]), sum(b.delta[3]), sum(b.delta[4]),
         sum(b.vol[1]), sum(b.vol[2]), sum(b.vol[3]), sum(b.vol[4]),
         sum(b.liq_long), sum(b.liq_short), count(*)::integer
  from public.flow_bars b
  where b.coin = p_coin and b.minute >= p_since
  group by 1
  order by 1
$$;

-- Échantillons whales regroupés : stock = dernier relevé de la tranche, flux = somme de la tranche.
create or replace function public.flow_whales_agg(p_coin text, p_since double precision, p_bucket integer)
returns table (
  t bigint, px double precision, whale_long double precision, whale_short double precision,
  chg_net double precision, chg_long double precision, chg_short double precision,
  n_long integer, n_short integer, cov_long double precision, cov_short double precision, oi double precision,
  giant_long double precision, giant_short double precision, giant_n_long integer, giant_n_short integer,
  giant_chg_net double precision, giant_chg_long double precision, giant_chg_short double precision,
  n integer, first_ts double precision
)
language sql stable
set search_path = public
as $$
  select (floor(w.ts / p_bucket) * p_bucket)::bigint,
         (array_agg(w.px order by w.ts desc))[1],
         (array_agg(w.whale_long order by w.ts desc))[1],
         (array_agg(w.whale_short order by w.ts desc))[1],
         sum(w.chg_net), sum(w.chg_long), sum(w.chg_short),
         (array_agg(w.n_long order by w.ts desc))[1],
         (array_agg(w.n_short order by w.ts desc))[1],
         (array_agg(w.cov_long order by w.ts desc))[1],
         (array_agg(w.cov_short order by w.ts desc))[1],
         (array_agg(w.oi order by w.ts desc))[1],
         (array_agg(w.giant_long order by w.ts desc))[1],
         (array_agg(w.giant_short order by w.ts desc))[1],
         (array_agg(w.giant_n_long order by w.ts desc))[1],
         (array_agg(w.giant_n_short order by w.ts desc))[1],
         sum(w.giant_chg_net), sum(w.giant_chg_long), sum(w.giant_chg_short),
         count(*)::integer, min(w.ts)
  from public.flow_whales w
  where w.coin = p_coin and w.ts >= p_since
  group by 1
  order by 1
$$;

-- Fonctions réservées aux routes serveur du site.
revoke all on function public.flow_bars_agg(text, bigint, integer) from public, anon, authenticated;
revoke all on function public.flow_whales_agg(text, double precision, integer) from public, anon, authenticated;
grant execute on function public.flow_bars_agg(text, bigint, integer) to service_role;
grant execute on function public.flow_whales_agg(text, double precision, integer) to service_role;
