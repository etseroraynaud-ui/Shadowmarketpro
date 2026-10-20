#!/usr/bin/env bash
# Sondage des sources de données futures GC / NQ depuis l'environnement d'exécution.
#
#   bash research/futures-transfer/probe-sources.sh > research/futures-transfer/probe-AAAA-MM-JJ.json
#
# Pour chaque hôte : code HTTP de la page d'accueil (000 = connexion refusée avant toute réponse,
# en pratique un refus du proxy de l'environnement). Ne télécharge aucune donnée et n'envoie aucun
# identifiant : il mesure seulement si l'hôte est joignable.
set -u
hosts=(
  "hist.databento.com|Databento GLBX.MDP3 (CME Globex, futures, OHLCV 1 min depuis 2010-06)|futures"
  "databento.com|Databento (site)|futures"
  "firstratedata.com|FirstRate Data (GC, NQ continus et contrats, depuis 2008)|futures"
  "portaracqg.com|Portara / CQG (ENQ depuis 1999)|futures"
  "www.backtestmarket.com|BacktestMarket (NQ ajusté 1 min depuis 2009)|futures"
  "marketparquet.com|MarketParquet (NQ, GC continus ratio-ajustés)|futures"
  "datamine.cmegroup.com|CME DataMine|futures"
  "www.cmegroup.com|CME Group (spécifications, calendriers)|futures"
  "www.barchart.com|Barchart|futures"
  "api.polygon.io|Polygon / Massive (futures bêta)|futures"
  "www.kibot.com|Kibot|futures"
  "api.tiingo.com|Tiingo|autre"
  "query1.finance.yahoo.com|Yahoo Finance (GC=F, NQ=F ; 15 min limité à 60 jours)|futures"
  "stooq.com|Stooq|autre"
  "www.kaggle.com|Kaggle (jeux de données tiers)|tiers"
  "huggingface.co|Hugging Face (jeux de données tiers)|tiers"
  "raw.githubusercontent.com|GitHub (fichiers bruts de dépôts publics)|tiers"
  "datafeed.dukascopy.com|Dukascopy (XAU/USD comptant, CFD d'indices : pas des futures)|substitut interdit"
  "data.binance.vision|Binance (crypto ; perpétuels or/indices non CME)|substitut interdit"
  "www.federalreserve.gov|Réserve fédérale (dates FOMC)|calendrier"
  "www.bls.gov|BLS (dates CPI, emploi)|calendrier"
  "fred.stlouisfed.org|FRED (calendriers de publication)|calendrier"
)
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "{\"probedAt\":\"$now\",\"results\":["
first=1
for e in "${hosts[@]}"; do
  IFS='|' read -r host label kind <<<"$e"
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$host/" || true)
  [ $first -eq 1 ] && first=0 || echo ","
  printf '{"host":"%s","label":"%s","kind":"%s","http":"%s","reachable":%s}' "$host" "$label" "$kind" "$code" "$([ "$code" != "000" ] && echo true || echo false)"
done
echo "]}"
