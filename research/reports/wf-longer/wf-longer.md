# Walk-forward Bitcoin à fenêtres plus longues — 12 configurations

Protocole : `research/preregistration/wf-longer-windows.md` (commité avant calcul). Règles publiées (entrées en régime calme, shorts en tendance baissière), BTC/USD Bitstamp 15 min, même méthode de plateaux, même période de test pour toutes : 2020-01-01 → 2026-10-04. Préréglage fixe sur la même période : Sharpe 1,55 (flatteur : choisi sur 2017–2026). Sharpe et Sortino sur les rendements par bougie de 15 min.

| Calibration / test | fenêtres | Sharpe | Sortino | CAGR | pire baisse | trades | walk-forward / fixe |
|---|---:|---:|---:|---:|---:|---:|---:|
| **36 mois / 3 mois (référence publiée)** | 28 | 0,83 | 1,20 | 14,3 % | −27,6 % | 390 | 54 % |
| 36 mois / 6 mois | 14 | 0,83 | 1,20 | 14,3 % | −25,9 % | 382 | 54 % |
| 36 mois / 12 mois | 7 | 0,92 | 1,34 | 16,0 % | −24,4 % | 363 | 59 % |
| 48 mois / 3 mois | 28 | 0,91 | 1,31 | 16,5 % | −23,9 % | 360 | 59 % |
| 48 mois / 6 mois | 14 | 1,06 | 1,53 | 20,9 % | −25,1 % | 351 | 68 % |
| 48 mois / 12 mois | 7 | 0,95 | 1,37 | 17,8 % | −25,6 % | 342 | 61 % |
| 60 mois / 3 mois | 28 | 0,99 | 1,42 | 18,2 % | −21,2 % | 352 | 64 % |
| 60 mois / 6 mois | 14 | 1,00 | 1,43 | 18,4 % | −21,2 % | 351 | 65 % |
| 60 mois / 12 mois | 7 | 0,87 | 1,24 | 14,6 % | −27,6 % | 342 | 56 % |
| croissante / 3 mois | 28 | 0,99 | 1,40 | 19,7 % | −38,6 % | 291 | 64 % |
| croissante / 6 mois | 14 | 1,36 | 1,95 | 30,4 % | −27,6 % | 280 | 88 % |
| croissante / 12 mois | 7 | 1,35 | 1,94 | 30,3 % | −28,3 % | 281 | 87 % |

**Médiane des 12 Sharpe : 0,97** (étendue 0,83 pour 36 mois / 3 mois à 1,36 pour croissante / 6 mois) ; rapport médian au préréglage fixe 63 %. 12 configurations sur 12 restent sous le préréglage fixe. Pire baisse médiane −25,8 %, la plus forte −38,6 %.

## Lecture (règle fixée avant calcul)

La médiane (0,97) est ≤ 1,00 : **la longueur des fenêtres n'explique pas la faiblesse du walk-forward.** Allonger la calibration ou les tests améliore un peu le résultat en moyenne (10 configurations sur 11 au-dessus de la référence), sans le rapprocher du préréglage fixe. Seules croissante / 6 mois et croissante / 12 mois dépassent 1,30 ; croissante / 3 mois donne 0,99 avec la plus forte baisse de l'étude : le résultat dépend du découpage et n'est pas stable.

La configuration 36/3 reste la référence publiée : elle a été fixée avant de connaître son résultat, alors que cette étude a été demandée après. Un walk-forward reste un test sur l'historique déjà utilisé pour concevoir la stratégie ; il mesure le coût de la re-sélection des réglages, pas la performance future.

## Contrôles

- OK — 36/3 = résultat publié : Sharpe 0.83, 390 trades, préréglage 1.55
- OK — même période de test pour les 12 : 2020-01-01 → 2026-10-04
- OK — même préréglage fixe pour les 12 : 1.55
- OK — 12 configurations : 12
