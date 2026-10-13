# Walk-forward 4 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 48 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 839 % | 39.3 % | 1.21 | 1.71 | -32.6 % | 1.59 | 422 | 23 % | 38 % |
| Walk-forward, meilleur Sharpe isolé | 1118 % | 44.8 % | 1.37 | 1.94 | -25.9 % | 1.78 | 439 | 22 % | 36 % |
| Contrôle : plateaux, régime figé au début de chaque test | 244 % | 20.1 % | 0.73 | 1.02 | -52.8 % | 1.23 | 576 | 25 % | 32 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 297, en régime agité 125.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 167.0 % | 15.5 % | 304.9 % | 32 |
| 2021 | 42.4 % | 33.6 % | 59.4 % | 28 |
| 2022 | -9.0 % | 46.1 % | -64.2 % | 110 |
| 2023 | 16.1 % | 52.5 % | 155.7 % | 86 |
| 2024 | 111.3 % | 114.0 % | 121.0 % | 38 |
| 2025 | 9.7 % | -4.0 % | -6.3 % | 77 |
| 2026 | 0.9 % | 16.7 % | -3.1 % | 51 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2016-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.47) | choc 2.4 · stop 3.6 ATR · suiveur non (1.00) | 41 % · 7 | 25.7 % | -10.4 % | 4 (1 / 3) |
| 2020-04-01 → 2020-06-30 | 2016-04-01 → 2020-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.42) | choc 2.4 · stop 3.6 ATR · suiveur non (1.12) | 78 % · 7 | 34.6 % | 42.2 % | 0 (0 / 0) |
| 2020-07-01 → 2020-09-30 | 2016-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.46) | choc 3.2 · stop 3.6 ATR · suiveur non (1.11) | 34 % · 4 | 2.0 % | 18.0 % | 18 (15 / 3) |
| 2020-10-01 → 2020-12-31 | 2016-10-01 → 2020-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.46) | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | 58 % · 3 | 54.7 % | 169.0 % | 10 (6 / 4) |
| 2021-01-01 → 2021-03-31 | 2017-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.51) | choc 2.4 · stop 3.6 ATR · suiveur non (1.35) | 99 % · 2 | 32.9 % | 102.7 % | 7 (0 / 7) |
| 2021-04-01 → 2021-06-30 | 2017-04-01 → 2021-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.51) | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | 74 % · 2 | -22.2 % | -40.4 % | 6 (0 / 6) |
| 2021-07-01 → 2021-09-30 | 2017-07-01 → 2021-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.50) | choc 3.2 · stop 3.6 ATR · suiveur non (1.05) | 37 % · 4 | 12.4 % | 25.1 % | 10 (7 / 3) |
| 2021-10-01 → 2021-12-31 | 2017-10-01 → 2021-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.56) | choc 2.4 · stop 2.6 ATR · suiveur non (0.97) | 25 % · 5 | 22.6 % | 5.4 % | 5 (5 / 0) |
| 2022-01-01 → 2022-03-31 | 2018-01-01 → 2021-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.54) | choc 2.4 · stop 1.8 ATR · suiveur non (1.00) | 41 % · 6 | -1.9 % | -1.5 % | 24 (19 / 5) |
| 2022-04-01 → 2022-06-30 | 2018-04-01 → 2022-03-31 | choc 2.8 · stop 3.6 ATR · suiveur 2 ATR (1.43) | choc 2.4 · stop 1.8 ATR · suiveur non (1.08) | 48 % · 7 | -0.1 % | -56.2 % | 26 (22 / 4) |
| 2022-07-01 → 2022-09-30 | 2018-07-01 → 2022-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.60) | choc 2.4 · stop 1.8 ATR · suiveur non (1.08) | 39 % · 7 | 0.5 % | -2.5 % | 23 (15 / 8) |
| 2022-10-01 → 2022-12-31 | 2018-10-01 → 2022-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.55) | choc 2.4 · stop 1.8 ATR · suiveur non (1.01) | 22 % · 2 | -7.6 % | -14.9 % | 37 (36 / 1) |
| 2023-01-01 → 2023-03-31 | 2019-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.28) | choc 2.4 · stop 1.8 ATR · suiveur non (1.01) | 32 % · 7 | 10.5 % | 72.3 % | 21 (17 / 4) |
| 2023-04-01 → 2023-06-30 | 2019-04-01 → 2023-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.23) | choc 2.4 · stop 1.8 ATR · suiveur non (0.99) | 16 % · 7 | 4.0 % | 7.0 % | 19 (18 / 1) |
| 2023-07-01 → 2023-09-30 | 2019-07-01 → 2023-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.14) | choc 2.4 · stop 1.8 ATR · suiveur non (0.91) | 15 % · 4 | -3.4 % | -11.5 % | 27 (25 / 2) |
| 2023-10-01 → 2023-12-31 | 2019-10-01 → 2023-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.07) | choc 2.4 · stop 1.8 ATR · suiveur non (0.87) | 71 % · 4 | 4.5 % | 56.7 % | 19 (7 / 12) |
| 2024-01-01 → 2024-03-31 | 2020-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.17) | choc 2.8 · stop 1.8 ATR · suiveur non (0.70) | 66 % · 5 | 36.0 % | 68.7 % | 17 (7 / 10) |
| 2024-04-01 → 2024-06-30 | 2020-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.8 · stop 1.8 ATR · suiveur non (0.74) | 71 % · 1 | -9.2 % | -12.1 % | 8 (0 / 8) |
| 2024-07-01 → 2024-09-30 | 2020-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.54) | 61 % · 8 | 19.9 % | 1.0 % | 13 (5 / 8) |
| 2024-10-01 → 2024-12-31 | 2020-10-01 → 2024-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.40) | choc 2.8 · stop 2.6 ATR · suiveur non (0.53) | 30 % · 4 | 42.7 % | 47.5 % | 0 (0 / 0) |
| 2025-01-01 → 2025-03-31 | 2021-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.46) | choc 2.8 · stop 2.6 ATR · suiveur non (0.46) | 38 % · 4 | -9.8 % | -11.6 % | 22 (18 / 4) |
| 2025-04-01 → 2025-06-30 | 2021-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.8 · stop 1.8 ATR · suiveur non (0.26) | 24 % · 4 | 16.9 % | 29.9 % | 17 (15 / 2) |
| 2025-07-01 → 2025-09-30 | 2021-07-01 → 2025-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.38) | choc 2.8 · stop 3.6 ATR · suiveur non (0.54) | 1 % · 2 | 7.1 % | 6.4 % | 18 (18 / 0) |
| 2025-10-01 → 2025-12-31 | 2021-10-01 → 2025-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.31) | choc 2.8 · stop 3.6 ATR · suiveur non (0.57) | 72 % · 4 | -2.8 % | -23.3 % | 20 (10 / 10) |
| 2026-01-01 → 2026-03-31 | 2022-01-01 → 2025-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.30) | choc 2.8 · stop 2.6 ATR · suiveur non (0.19) | 74 % · 5 | -6.2 % | -22.0 % | 16 (7 / 9) |
| 2026-04-01 → 2026-06-30 | 2022-04-01 → 2026-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.39) | choc 2.8 · stop 1.8 ATR · suiveur non (0.09) | 59 % · 5 | -0.5 % | -14.2 % | 11 (6 / 5) |
| 2026-07-01 → 2026-09-30 | 2022-07-01 → 2026-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (0.91) | choc 2.8 · stop 2.6 ATR · suiveur non (0.15) | 36 % · 3 | 6.8 % | 42.8 % | 24 (18 / 6) |
| 2026-10-01 → 2026-10-04 | 2022-10-01 → 2026-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.00) | choc 2.8 · stop 2.6 ATR · suiveur non (0.24) | 100 % · 0 | 1.1 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 10 sur 27 en régime calme, 12 sur 27 en régime agité.

