# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 1904 % | 55.8 % | 1.59 | 2.33 | -21.6 % | 1.42 | 831 | 30 % | 31 % |
| Walk-forward, meilleur Sharpe isolé | 1338 % | 48.4 % | 1.44 | 2.08 | -30.6 % | 1.45 | 821 | 23 % | 28 % |
| Contrôle : plateaux, régime figé au début de chaque test | 220 % | 18.8 % | 0.70 | 1.00 | -30.8 % | 1.21 | 908 | 26 % | 32 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 1311 % | 47.9 % | 1.51 | 2.21 | -29.6 % | 1.45 | 762 | 29 % | 26 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 663, en régime agité 168.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

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

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.79) | choc 2.4 · stop 3.6 ATR · suiveur non (1.09) | 41 % · 7 | 39.4 % | -10.4 % | 13 (10 / 3) |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.83) | choc 2.4 · stop 3.6 ATR · suiveur non (1.14) | 78 % · 7 | 35.4 % | 42.2 % | 11 (10 / 1) |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.88) | choc 2.8 · stop 0.8 ATR · suiveur non (1.11) | 34 % · 4 | -1.8 % | 18.0 % | 35 (30 / 5) |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.85) | choc 2.4 · stop 0.8 ATR · suiveur non (1.04) | 58 % · 3 | 29.8 % | 169.0 % | 27 (18 / 9) |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.86) | choc 2.4 · stop 1.8 ATR · suiveur non (1.19) | 99 % · 2 | 36.3 % | 102.7 % | 10 (1 / 9) |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (1.75) | choc 2.4 · stop 1.8 ATR · suiveur non (1.26) | 74 % · 2 | -11.6 % | -40.4 % | 19 (9 / 10) |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.47) | choc 2.4 · stop 1.8 ATR · suiveur non (1.15) | 37 % · 4 | 17.0 % | 25.1 % | 34 (31 / 3) |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 2.8 · stop 2.6 ATR · suiveur 5 ATR (1.50) | choc 2.4 · stop 1.8 ATR · suiveur non (1.13) | 25 % · 5 | 54.3 % | 5.4 % | 26 (25 / 1) |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.53) | choc 2.4 · stop 1.8 ATR · suiveur non (1.28) | 41 % · 6 | -2.8 % | -1.5 % | 37 (32 / 5) |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.41) | choc 2.4 · stop 1.8 ATR · suiveur non (1.30) | 48 % · 7 | 48.6 % | -56.2 % | 23 (19 / 4) |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.57) | choc 2.4 · stop 1.8 ATR · suiveur non (1.20) | 39 % · 7 | 1.8 % | -2.5 % | 38 (30 / 8) |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.39) | choc 2.4 · stop 1.8 ATR · suiveur non (1.09) | 22 % · 2 | 2.3 % | -14.9 % | 38 (37 / 1) |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.32) | choc 2.4 · stop 1.8 ATR · suiveur non (0.98) | 32 % · 7 | 21.1 % | 72.3 % | 38 (34 / 4) |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.33) | choc 2.8 · stop 2.6 ATR · suiveur non (0.74) | 16 % · 7 | 13.7 % | 7.0 % | 42 (41 / 1) |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 2 · stop 1.2 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.59) | 15 % · 4 | -6.8 % | -11.5 % | 53 (52 / 1) |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 2 · stop 1.2 ATR · suiveur non (1.19) | choc 2.8 · stop 2.6 ATR · suiveur 5 ATR (0.55) | 71 % · 4 | -9.3 % | 56.7 % | 33 (22 / 11) |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.29) | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (0.34) | 66 % · 5 | 26.4 % | 68.7 % | 33 (16 / 17) |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.41) | choc 2.8 · stop 0.8 ATR · suiveur non (0.32) | 71 % · 1 | -4.0 % | -12.1 % | 26 (11 / 15) |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.45) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.35) | 61 % · 8 | 27.0 % | 1.0 % | 31 (18 / 13) |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2 · stop 1.8 ATR · suiveur non (1.52) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.47) | 30 % · 4 | 7.4 % | 47.5 % | 54 (44 / 10) |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.37) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 38 % · 4 | -2.9 % | -11.6 % | 36 (32 / 4) |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.21) | 24 % · 4 | 0.8 % | 29.9 % | 48 (47 / 1) |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (0.75) | choc 2.8 · stop 2.6 ATR · suiveur non (0.42) | 1 % · 2 | -0.2 % | 6.4 % | 33 (33 / 0) |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 2.8 · stop 2.6 ATR · suiveur non (0.75) | choc 2.8 · stop 2.6 ATR · suiveur non (0.58) | 72 % · 4 | 5.5 % | -23.3 % | 23 (12 / 11) |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 1.2 ATR · suiveur non (0.95) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 74 % · 5 | 11.2 % | -22.0 % | 20 (11 / 9) |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (0.80) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 59 % · 5 | 11.6 % | -14.2 % | 17 (12 / 5) |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.84) | choc 2.8 · stop 1.8 ATR · suiveur non (0.34) | 36 % · 3 | 1.9 % | 42.8 % | 33 (26 / 7) |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.97) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 100 % · 0 | 1.1 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 16 sur 27 en régime calme, 10 sur 27 en régime agité.

