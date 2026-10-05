# Shock Engine sur plusieurs actifs Hyperliquid

Préréglage **Adaptatif volatilité · 15 min**, réglé sur BTC (Bitstamp 2017-2026) et appliqué **sans aucun réglage refait** aux autres actifs : pour ETH et NVIDIA, c'est un test hors échantillon de la stratégie.

Données Hyperliquid : les 5000 dernières bougies 15 min (environ 52 jours, limite de l'API) et le journalier pour le régime de volatilité. Frais : 0,045 % par ordre (taker, palier de base), sans levier ni financement. Les 1000 premières barres servent au préchauffage des indicateurs.

**Attention** : quelques semaines et une poignée de trades ne permettent aucune conclusion statistique. Ces chiffres vérifient que tout fonctionne sur chaque actif ; la mesure d'un edge demande des mois de données (le cache du bot s'allonge à chaque lancement, et l'historique Binance complet est prévu).

| Actif | Période | Parité bot / backtest | Trades | Rendement | Achat conservé | Pire baisse | Trades gagnants | Profit factor | Régime agité |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BTC | 2026-08-24 → 2026-10-05 | identique (1999 décisions) | 14 | 1.2 % | 9.6 % | -2.1 % | 36 % | 1.30 | 81 % |
| ETH | 2026-08-24 → 2026-10-05 | identique (1999 décisions) | 20 | -13.3 % | 9.7 % | -15.0 % | 5 % | 0.12 | 36 % |
| xyz:NVDA | 2026-08-24 → 2026-10-05 | identique (1999 décisions) | 9 | 0.4 % | 13.6 % | -4.2 % | 33 % | 1.10 | 22 % |
