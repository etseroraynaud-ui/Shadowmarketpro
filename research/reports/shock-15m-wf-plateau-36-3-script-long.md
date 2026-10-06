# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · script-long

Base : réglages non optimisés : valeurs par défaut du script (mode High Activity coupé), longs seulement.

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 174 % | 16.1 % | 0.81 | 1.13 | -38.7 % | 1.37 | 315 | 33 % | 42 % |
| Walk-forward, meilleur Sharpe isolé | 59 % | 7.1 % | 0.45 | 0.63 | -37.7 % | 1.21 | 354 | 27 % | 38 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 1311 % | 47.9 % | 1.51 | 2.21 | -29.6 % | 1.45 | 762 | 29 % | 26 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 179.3 % | 55.6 % | 304.9 % | 7 |
| 2021 | 21.3 % | 68.6 % | 59.4 % | 31 |
| 2022 | -18.9 % | 65.0 % | -64.2 % | 56 |
| 2023 | 17.0 % | 27.2 % | 155.7 % | 54 |
| 2024 | -10.3 % | 89.5 % | 121.0 % | 105 |
| 2025 | -0.6 % | 9.7 % | -6.3 % | 35 |
| 2026 | -4.6 % | 23.2 % | -3.1 % | 27 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : stratégie | test : BTC | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 2 · stop 3.6 ATR · suiveur non (0.87) | choc 2.8 · stop 1.8 ATR · suiveur non (1.57) | 14.3 % | -10.4 % | 6 |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 2 · stop 3.6 ATR · suiveur non (0.77) | choc 2.8 · stop 1.8 ATR · suiveur non (1.53) | 22.4 % | 42.2 % | 0 |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 2 · stop 3.6 ATR · suiveur non (0.62) | choc 2.8 · stop 1.8 ATR · suiveur non (1.25) | 11.1 % | 18.0 % | 0 |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 2 · stop 3.6 ATR · suiveur non (0.72) | choc 3.2 · stop 3.6 ATR · suiveur non (1.01) | 79.6 % | 169.0 % | 1 |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 2 · stop 2.6 ATR · suiveur non (0.60) | choc 3.2 · stop 2.6 ATR · suiveur non (1.13) | 19.4 % | 102.7 % | 6 |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 2 · stop 2.6 ATR · suiveur non (0.56) | choc 3.2 · stop 3.6 ATR · suiveur non (1.19) | -8.0 % | -40.4 % | 10 |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur non (0.65) | choc 3.2 · stop 2.6 ATR · suiveur non (1.08) | 6.0 % | 25.1 % | 6 |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 2 · stop 3.6 ATR · suiveur non (0.87) | choc 3.2 · stop 2.6 ATR · suiveur non (1.02) | 4.2 % | 5.4 % | 9 |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 2 · stop 2.6 ATR · suiveur non (0.82) | choc 3.2 · stop 3.6 ATR · suiveur non (0.95) | -9.3 % | -1.5 % | 12 |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 2 · stop 3.6 ATR · suiveur non (0.79) | choc 3.2 · stop 3.6 ATR · suiveur non (1.01) | -4.6 % | -56.2 % | 8 |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (0.51) | choc 2.8 · stop 1.8 ATR · suiveur non (0.78) | -5.6 % | -2.5 % | 22 |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (0.45) | choc 2.8 · stop 1.8 ATR · suiveur non (0.64) | -0.6 % | -14.9 % | 14 |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (0.61) | choc 2.8 · stop 1.8 ATR · suiveur non (0.75) | 19.7 % | 72.3 % | 21 |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 2 · stop 3.6 ATR · suiveur 2 ATR (1.11) | choc 2.8 · stop 1.8 ATR · suiveur non (0.61) | -4.2 % | 7.0 % | 4 |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (0.78) | choc 2.8 · stop 2.6 ATR · suiveur non (0.59) | -3.0 % | -11.5 % | 11 |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 2 · stop 3.6 ATR · suiveur 2 ATR (0.63) | choc 2.8 · stop 2.6 ATR · suiveur non (0.53) | 5.2 % | 56.7 % | 18 |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (1.01) | choc 2 · stop 1.8 ATR · suiveur 2 ATR (0.24) | 0.2 % | 68.7 % | 26 |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (1.19) | choc 2 · stop 1.8 ATR · suiveur 2 ATR (0.24) | -2.7 % | -12.1 % | 21 |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2 · stop 3.6 ATR · suiveur 3.2 ATR (1.09) | choc 2 · stop 3.6 ATR · suiveur 2 ATR (0.40) | -8.3 % | 1.0 % | 28 |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2 · stop 1.8 ATR · suiveur 5 ATR (0.89) | choc 2 · stop 2.6 ATR · suiveur 2 ATR (0.19) | 0.4 % | 47.5 % | 30 |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 1.8 ATR · suiveur non (1.03) | choc 2 · stop 2.6 ATR · suiveur non (0.10) | -3.0 % | -11.6 % | 11 |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (0.88) | pas de trade (-0.04) | 4.2 % | 29.9 % | 3 |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 2 · stop 2.6 ATR · suiveur non (0.98) | choc 2 · stop 2.6 ATR · suiveur non (0.05) | 1.4 % | 6.4 % | 7 |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.07) | choc 2.8 · stop 2.6 ATR · suiveur non (0.14) | -2.9 % | -23.3 % | 14 |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | choc 2.8 · stop 2.6 ATR · suiveur non (0.10) | -5.1 % | -22.0 % | 11 |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (0.84) | pas de trade (-0.07) | -4.2 % | -14.2 % | 7 |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.69) | pas de trade (-0.09) | 4.9 % | 42.8 % | 9 |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.95) | pas de trade (-0.16) | 0.0 % | 1.5 % | 0 |

Changements de réglages d'une fenêtre à la suivante : 13 sur 27 en régime calme, 15 sur 27 en régime agité.

