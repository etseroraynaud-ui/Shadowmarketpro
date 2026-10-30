# Walk-forward 5 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 60 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 868 % | 39.9 % | 1.22 | 1.72 | -31.5 % | 1.69 | 399 | 26 % | 40 % |
| Walk-forward, meilleur Sharpe isolé | 763 % | 37.6 % | 1.20 | 1.69 | -42.0 % | 1.70 | 428 | 20 % | 35 % |
| Contrôle : plateaux, régime figé au début de chaque test | 293 % | 22.5 % | 0.80 | 1.11 | -53.2 % | 1.30 | 554 | 28 % | 30 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 275, en régime agité 124.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 166.1 % | 15.5 % | 304.9 % | 32 |
| 2021 | 33.8 % | 33.6 % | 59.4 % | 31 |
| 2022 | -15.9 % | 46.1 % | -64.2 % | 100 |
| 2023 | 30.1 % | 52.5 % | 155.7 % | 86 |
| 2024 | 104.4 % | 114.0 % | 121.0 % | 42 |
| 2025 | 16.5 % | -4.0 % | -6.3 % | 59 |
| 2026 | 4.3 % | 16.7 % | -3.1 % | 49 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 41 % · 7 | 25.3 % | -10.4 % | 4 (1 / 3) |
| 2020-04-01 → 2020-06-30 | 2015-04-01 → 2020-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.32) | choc 2.4 · stop 3.6 ATR · suiveur non (1.05) | 78 % · 7 | 34.6 % | 42.2 % | 0 (0 / 0) |
| 2020-07-01 → 2020-09-30 | 2015-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.43) | choc 3.2 · stop 3.6 ATR · suiveur non (1.12) | 34 % · 4 | 2.0 % | 18.0 % | 18 (15 / 3) |
| 2020-10-01 → 2020-12-31 | 2015-10-01 → 2020-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.39) | choc 3.2 · stop 3.6 ATR · suiveur non (1.12) | 58 % · 3 | 54.7 % | 169.0 % | 10 (6 / 4) |
| 2021-01-01 → 2021-03-31 | 2016-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.41) | choc 2.4 · stop 3.6 ATR · suiveur non (1.24) | 99 % · 2 | 32.9 % | 102.7 % | 7 (0 / 7) |
| 2021-04-01 → 2021-06-30 | 2016-04-01 → 2021-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.39) | choc 2.8 · stop 3.6 ATR · suiveur non (1.24) | 74 % · 2 | -23.9 % | -40.4 % | 6 (0 / 6) |
| 2021-07-01 → 2021-09-30 | 2016-07-01 → 2021-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.36) | choc 2.4 · stop 2.6 ATR · suiveur non (1.07) | 37 % · 4 | 11.3 % | 25.1 % | 10 (7 / 3) |
| 2021-10-01 → 2021-12-31 | 2016-10-01 → 2021-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.41) | choc 2.4 · stop 2.6 ATR · suiveur non (1.08) | 25 % · 5 | 18.9 % | 5.4 % | 8 (7 / 1) |
| 2022-01-01 → 2022-03-31 | 2017-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.42) | choc 2.4 · stop 2.6 ATR · suiveur non (1.17) | 41 % · 6 | 1.2 % | -1.5 % | 27 (24 / 3) |
| 2022-04-01 → 2022-06-30 | 2017-04-01 → 2022-03-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.36) | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | 48 % · 7 | -9.9 % | -56.2 % | 20 (16 / 4) |
| 2022-07-01 → 2022-09-30 | 2017-07-01 → 2022-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.51) | choc 3.2 · stop 3.6 ATR · suiveur non (1.00) | 39 % · 7 | 0.0 % | -2.5 % | 19 (15 / 4) |
| 2022-10-01 → 2022-12-31 | 2017-10-01 → 2022-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.49) | choc 2.4 · stop 1.8 ATR · suiveur non (0.89) | 22 % · 2 | -7.8 % | -14.9 % | 34 (33 / 1) |
| 2023-01-01 → 2023-03-31 | 2018-01-01 → 2022-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.37) | choc 2.4 · stop 1.8 ATR · suiveur non (0.81) | 32 % · 7 | 28.3 % | 72.3 % | 20 (16 / 4) |
| 2023-04-01 → 2023-06-30 | 2018-04-01 → 2023-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.44) | choc 2.4 · stop 1.8 ATR · suiveur non (0.84) | 16 % · 7 | 2.0 % | 7.0 % | 21 (20 / 1) |
| 2023-07-01 → 2023-09-30 | 2018-07-01 → 2023-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.4 · stop 1.8 ATR · suiveur non (0.85) | 15 % · 4 | -4.9 % | -11.5 % | 26 (24 / 2) |
| 2023-10-01 → 2023-12-31 | 2018-10-01 → 2023-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.35) | choc 2.4 · stop 1.8 ATR · suiveur non (0.84) | 71 % · 4 | 4.5 % | 56.7 % | 19 (7 / 12) |
| 2024-01-01 → 2024-03-31 | 2019-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.31) | choc 2.4 · stop 1.8 ATR · suiveur non (0.78) | 66 % · 5 | 40.8 % | 68.7 % | 15 (7 / 8) |
| 2024-04-01 → 2024-06-30 | 2019-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.37) | choc 2.4 · stop 1.8 ATR · suiveur non (0.95) | 71 % · 1 | -12.1 % | -12.1 % | 11 (0 / 11) |
| 2024-07-01 → 2024-09-30 | 2019-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.23) | choc 2.4 · stop 1.8 ATR · suiveur non (0.83) | 61 % · 8 | 15.7 % | 1.0 % | 16 (5 / 11) |
| 2024-10-01 → 2024-12-31 | 2019-10-01 → 2024-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.28) | choc 2.4 · stop 1.8 ATR · suiveur non (0.80) | 30 % · 4 | 42.7 % | 47.5 % | 0 (0 / 0) |
| 2025-01-01 → 2025-03-31 | 2020-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.34) | choc 2.8 · stop 2.6 ATR · suiveur non (0.84) | 38 % · 4 | -9.8 % | -11.6 % | 22 (18 / 4) |
| 2025-04-01 → 2025-06-30 | 2020-04-01 → 2025-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.36) | choc 2.8 · stop 2.6 ATR · suiveur non (0.69) | 24 % · 4 | 25.9 % | 29.9 % | 6 (5 / 1) |
| 2025-07-01 → 2025-09-30 | 2020-07-01 → 2025-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.26) | choc 2.8 · stop 2.6 ATR · suiveur non (0.66) | 1 % · 2 | 3.5 % | 6.4 % | 10 (10 / 0) |
| 2025-10-01 → 2025-12-31 | 2020-10-01 → 2025-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.25) | choc 2.8 · stop 2.6 ATR · suiveur non (0.66) | 72 % · 4 | -0.9 % | -23.3 % | 21 (10 / 11) |
| 2026-01-01 → 2026-03-31 | 2021-01-01 → 2025-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.22) | choc 2.8 · stop 2.6 ATR · suiveur non (0.32) | 74 % · 5 | -3.3 % | -22.0 % | 14 (5 / 9) |
| 2026-04-01 → 2026-06-30 | 2021-04-01 → 2026-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.26) | choc 2.8 · stop 1.8 ATR · suiveur non (0.17) | 59 % · 5 | -0.5 % | -14.2 % | 11 (6 / 5) |
| 2026-07-01 → 2026-09-30 | 2021-07-01 → 2026-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.13) | choc 2.8 · stop 2.6 ATR · suiveur non (0.30) | 36 % · 3 | 7.2 % | 42.8 % | 24 (18 / 6) |
| 2026-10-01 → 2026-10-04 | 2021-10-01 → 2026-09-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.08) | choc 2.8 · stop 2.6 ATR · suiveur non (0.30) | 100 % · 0 | 1.1 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 5 sur 27 en régime calme, 10 sur 27 en régime agité.

