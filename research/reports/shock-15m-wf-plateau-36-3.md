# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 1904 % | 55.8 % | 1.59 | 2.33 | -21.6 % | 1.42 | 831 | 30 % | 31 % |
| Walk-forward, meilleur Sharpe isolé | 1338 % | 48.4 % | 1.44 | 2.08 | -30.6 % | 1.45 | 821 | 23 % | 28 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 1311 % | 47.9 % | 1.51 | 2.21 | -29.6 % | 1.45 | 762 | 29 % | 26 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 140.6 % | 55.6 % | 304.9 % | 86 |
| 2021 | 117.6 % | 68.6 % | 59.4 % | 89 |
| 2022 | 50.4 % | 65.0 % | -64.2 % | 136 |
| 2023 | 16.5 % | 27.2 % | 155.7 % | 166 |
| 2024 | 65.5 % | 89.5 % | 121.0 % | 144 |
| 2025 | 3.1 % | 9.7 % | -6.3 % | 140 |
| 2026 | 27.9 % | 23.2 % | -3.1 % | 70 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : stratégie | test : BTC | trades |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.79) | choc 2.4 · stop 3.6 ATR · suiveur non (1.09) | 39.4 % | -10.4 % | 13 |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.83) | choc 2.4 · stop 3.6 ATR · suiveur non (1.14) | 35.4 % | 42.2 % | 11 |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.88) | choc 2.8 · stop 0.8 ATR · suiveur non (1.11) | -1.8 % | 18.0 % | 35 |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.85) | choc 2.4 · stop 0.8 ATR · suiveur non (1.04) | 29.8 % | 169.0 % | 27 |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.86) | choc 2.4 · stop 1.8 ATR · suiveur non (1.19) | 36.3 % | 102.7 % | 10 |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (1.75) | choc 2.4 · stop 1.8 ATR · suiveur non (1.26) | -11.6 % | -40.4 % | 19 |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.47) | choc 2.4 · stop 1.8 ATR · suiveur non (1.15) | 17.0 % | 25.1 % | 34 |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 2.8 · stop 2.6 ATR · suiveur 5 ATR (1.50) | choc 2.4 · stop 1.8 ATR · suiveur non (1.13) | 54.3 % | 5.4 % | 26 |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.53) | choc 2.4 · stop 1.8 ATR · suiveur non (1.28) | -2.8 % | -1.5 % | 37 |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.41) | choc 2.4 · stop 1.8 ATR · suiveur non (1.30) | 48.6 % | -56.2 % | 23 |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.57) | choc 2.4 · stop 1.8 ATR · suiveur non (1.20) | 1.8 % | -2.5 % | 38 |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.39) | choc 2.4 · stop 1.8 ATR · suiveur non (1.09) | 2.3 % | -14.9 % | 38 |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.32) | choc 2.4 · stop 1.8 ATR · suiveur non (0.98) | 21.1 % | 72.3 % | 38 |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.33) | choc 2.8 · stop 2.6 ATR · suiveur non (0.74) | 13.7 % | 7.0 % | 42 |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 2 · stop 1.2 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.59) | -6.8 % | -11.5 % | 53 |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 2 · stop 1.2 ATR · suiveur non (1.19) | choc 2.8 · stop 2.6 ATR · suiveur 5 ATR (0.55) | -9.3 % | 56.7 % | 33 |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.29) | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (0.34) | 26.4 % | 68.7 % | 33 |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.41) | choc 2.8 · stop 0.8 ATR · suiveur non (0.32) | -4.0 % | -12.1 % | 26 |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.45) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.35) | 27.0 % | 1.0 % | 31 |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2 · stop 1.8 ATR · suiveur non (1.52) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.47) | 7.4 % | 47.5 % | 54 |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.37) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | -2.9 % | -11.6 % | 36 |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.21) | 0.8 % | 29.9 % | 48 |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (0.75) | choc 2.8 · stop 2.6 ATR · suiveur non (0.42) | -0.2 % | 6.4 % | 33 |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 2.8 · stop 2.6 ATR · suiveur non (0.75) | choc 2.8 · stop 2.6 ATR · suiveur non (0.58) | 5.5 % | -23.3 % | 23 |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 1.2 ATR · suiveur non (0.95) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 11.2 % | -22.0 % | 20 |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (0.80) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 11.6 % | -14.2 % | 17 |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.84) | choc 2.8 · stop 1.8 ATR · suiveur non (0.34) | 1.9 % | 42.8 % | 33 |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.97) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 1.1 % | 1.5 % | 0 |

Changements de réglages d'une fenêtre à la suivante : 16 sur 27 en régime calme, 10 sur 27 en régime agité.

