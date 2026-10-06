# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · script

Base : réglages non optimisés : valeurs par défaut du script (mode High Activity coupé), longs et shorts.

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 89 % | 9.9 % | 0.56 | 0.79 | -45.7 % | 1.25 | 681 | 27 % | 48 % |
| Walk-forward, meilleur Sharpe isolé | 48 % | 5.9 % | 0.38 | 0.54 | -47.9 % | 1.09 | 1154 | 29 % | 38 % |
| Contrôle : plateaux, régime figé au début de chaque test | -28 % | -4.7 % | -0.13 | -0.19 | -57.3 % | 0.91 | 738 | 25 % | 38 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 1311 % | 47.9 % | 1.51 | 2.21 | -29.6 % | 1.45 | 762 | 29 % | 26 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 557, en régime agité 124.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 4.2 % | 55.6 % | 304.9 % | 163 |
| 2021 | 9.0 % | 68.6 % | 59.4 % | 90 |
| 2022 | 15.5 % | 65.0 % | -64.2 % | 83 |
| 2023 | -2.3 % | 27.2 % | 155.7 % | 130 |
| 2024 | 28.5 % | 89.5 % | 121.0 % | 74 |
| 2025 | -5.8 % | 9.7 % | -6.3 % | 102 |
| 2026 | 22.1 % | 23.2 % | -3.1 % | 39 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 2 · stop 3.6 ATR · suiveur non (1.02) | choc 3.2 · stop 0.8 ATR · suiveur non (0.58) | 41 % · 7 | 19.6 % | -10.4 % | 29 (18 / 11) |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 2 · stop 3.6 ATR · suiveur non (1.11) | choc 3.2 · stop 0.8 ATR · suiveur non (0.72) | 78 % · 7 | 9.6 % | 42.2 % | 40 (9 / 31) |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.27) | choc 3.2 · stop 0.8 ATR · suiveur non (0.91) | 34 % · 4 | -8.8 % | 18.0 % | 42 (31 / 11) |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 3.2 · stop 1.8 ATR · suiveur non (1.25) | choc 3.2 · stop 0.8 ATR · suiveur 3.2 ATR (0.71) | 58 % · 3 | -12.8 % | 169.0 % | 52 (19 / 33) |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 1.8 ATR · suiveur non (1.08) | choc 3.2 · stop 0.8 ATR · suiveur non (0.52) | 99 % · 2 | -26.5 % | 102.7 % | 39 (1 / 38) |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 3.2 · stop 1.8 ATR · suiveur non (0.86) | pas de trade (-0.38) | 74 % · 2 | 19.8 % | -40.4 % | 7 (7 / 0) |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 3.2 · stop 0.8 ATR · suiveur non (0.80) | pas de trade (-0.32) | 37 % · 4 | 16.9 % | 25.1 % | 16 (16 / 0) |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 3.2 · stop 0.8 ATR · suiveur non (0.92) | pas de trade (-0.33) | 25 % · 5 | 5.9 % | 5.4 % | 28 (28 / 0) |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 3.2 · stop 0.8 ATR · suiveur non (1.11) | pas de trade (-0.38) | 41 % · 6 | 8.3 % | -1.5 % | 12 (12 / 0) |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 3.2 · stop 0.8 ATR · suiveur non (1.24) | pas de trade (-0.41) | 48 % · 7 | 9.4 % | -56.2 % | 26 (26 / 0) |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 3.2 · stop 1.2 ATR · suiveur non (1.41) | pas de trade (-0.42) | 39 % · 7 | -6.0 % | -2.5 % | 24 (24 / 0) |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 3.2 · stop 1.2 ATR · suiveur non (1.13) | pas de trade (-0.60) | 22 % · 2 | 3.6 % | -14.9 % | 21 (21 / 0) |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 3.2 · stop 1.2 ATR · suiveur non (1.20) | pas de trade (-0.50) | 32 % · 7 | 13.7 % | 72.3 % | 33 (33 / 0) |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 3.2 · stop 1.2 ATR · suiveur non (1.15) | pas de trade (-0.75) | 16 % · 7 | -0.7 % | 7.0 % | 39 (39 / 0) |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 3.2 · stop 1.2 ATR · suiveur non (1.11) | pas de trade (-1.01) | 15 % · 4 | -7.1 % | -11.5 % | 39 (39 / 0) |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 3.2 · stop 1.2 ATR · suiveur non (0.95) | pas de trade (-0.92) | 71 % · 4 | -6.9 % | 56.7 % | 19 (19 / 0) |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 3.2 · stop 1.8 ATR · suiveur non (1.11) | pas de trade (-0.83) | 66 % · 5 | 20.3 % | 68.7 % | 11 (11 / 0) |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 3.2 · stop 1.8 ATR · suiveur non (1.31) | pas de trade (-0.30) | 71 % · 1 | -4.3 % | -12.1 % | 12 (12 / 0) |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2.8 · stop 1.8 ATR · suiveur non (1.18) | pas de trade (-0.24) | 61 % · 8 | -0.1 % | 1.0 % | 15 (15 / 0) |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2.4 · stop 1.8 ATR · suiveur non (1.04) | pas de trade (-0.18) | 30 % · 4 | 11.8 % | 47.5 % | 36 (36 / 0) |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2.4 · stop 3.6 ATR · suiveur non (0.95) | pas de trade (-0.23) | 38 % · 4 | -14.4 % | -11.6 % | 26 (26 / 0) |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (0.82) | pas de trade (-0.17) | 24 % · 4 | -7.2 % | 29.9 % | 42 (42 / 0) |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.50) | pas de trade (-0.23) | 1 % · 2 | 1.9 % | 6.4 % | 28 (28 / 0) |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.45) | pas de trade (-0.28) | 72 % · 4 | 16.5 % | -23.3 % | 6 (6 / 0) |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (0.57) | pas de trade (-0.30) | 74 % · 5 | 16.1 % | -22.0 % | 5 (5 / 0) |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (0.50) | pas de trade (-0.11) | 59 % · 5 | 3.4 % | -14.2 % | 15 (15 / 0) |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.59) | pas de trade (-0.05) | 36 % · 3 | 1.8 % | 42.8 % | 19 (19 / 0) |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (0.70) | pas de trade (-0.25) | 100 % · 0 | 0.0 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 10 sur 27 en régime calme, 3 sur 27 en régime agité.

