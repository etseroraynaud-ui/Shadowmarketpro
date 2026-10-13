# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 146 % | 14.3 % | 0.83 | 1.20 | -27.6 % | 1.41 | 390 | 28 % | 10 % |
| Walk-forward, meilleur Sharpe isolé | 316 % | 23.5 % | 1.30 | 1.91 | -28.3 % | 1.73 | 384 | 26 % | 8 % |
| Contrôle : plateaux, régime figé au début de chaque test | 129 % | 13.0 % | 0.86 | 1.25 | -20.0 % | 1.54 | 293 | 28 % | 8 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 390, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 15.9 % | 21.2 % | 304.9 % | 35 |
| 2021 | 1.2 % | 28.3 % | 59.4 % | 37 |
| 2022 | -1.1 % | 40.1 % | -64.2 % | 112 |
| 2023 | 20.4 % | 59.3 % | 155.7 % | 76 |
| 2024 | 63.3 % | 105.2 % | 121.0 % | 31 |
| 2025 | -3.6 % | 1.2 % | -6.3 % | 67 |
| 2026 | 11.9 % | 13.8 % | -3.1 % | 32 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.61) | pas de trade (—) | 41 % · 7 | -4.2 % | -10.4 % | 9 (9 / 0) |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.58) | pas de trade (—) | 78 % · 7 | 5.1 % | 42.2 % | 4 (4 / 0) |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.67) | pas de trade (—) | 34 % · 4 | 4.9 % | 18.0 % | 16 (16 / 0) |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.67) | pas de trade (—) | 58 % · 3 | 9.8 % | 169.0 % | 6 (6 / 0) |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.69) | pas de trade (—) | 99 % · 2 | 0.0 % | 102.7 % | 0 (0 / 0) |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.56) | pas de trade (—) | 74 % · 2 | -2.3 % | -40.4 % | 2 (2 / 0) |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | pas de trade (—) | 37 % · 4 | 6.6 % | 25.1 % | 11 (11 / 0) |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.41) | pas de trade (—) | 25 % · 5 | -2.9 % | 5.4 % | 24 (24 / 0) |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.35) | pas de trade (—) | 41 % · 6 | -4.9 % | -1.5 % | 29 (29 / 0) |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.07) | pas de trade (—) | 48 % · 7 | 9.8 % | -56.2 % | 28 (28 / 0) |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.27) | pas de trade (—) | 39 % · 7 | 2.1 % | -2.5 % | 19 (19 / 0) |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | pas de trade (—) | 22 % · 2 | -7.2 % | -14.9 % | 36 (36 / 0) |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.09) | pas de trade (—) | 32 % · 7 | 3.2 % | 72.3 % | 17 (17 / 0) |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.26) | pas de trade (—) | 16 % · 7 | 11.1 % | 7.0 % | 27 (27 / 0) |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.21) | pas de trade (—) | 15 % · 4 | -4.3 % | -11.5 % | 24 (24 / 0) |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 2 · stop 1.8 ATR · suiveur non (1.16) | pas de trade (—) | 71 % · 4 | 9.7 % | 56.7 % | 8 (8 / 0) |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | pas de trade (—) | 66 % · 5 | 31.8 % | 68.7 % | 7 (7 / 0) |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.53) | pas de trade (—) | 71 % · 1 | -0.9 % | -12.1 % | 1 (1 / 0) |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.51) | pas de trade (—) | 61 % · 8 | 10.2 % | 1.0 % | 8 (8 / 0) |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.54) | pas de trade (—) | 30 % · 4 | 13.4 % | 47.5 % | 15 (15 / 0) |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.65) | pas de trade (—) | 38 % · 4 | -6.2 % | -11.6 % | 18 (18 / 0) |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 3.6 ATR · suiveur non (1.65) | pas de trade (—) | 24 % · 4 | -3.8 % | 29.9 % | 21 (21 / 0) |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (1.15) | pas de trade (—) | 1 % · 2 | 1.8 % | 6.4 % | 18 (18 / 0) |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.27) | pas de trade (—) | 72 % · 4 | 5.0 % | -23.3 % | 10 (10 / 0) |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.42) | pas de trade (—) | 74 % · 5 | 16.5 % | -22.0 % | 6 (6 / 0) |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.29) | pas de trade (—) | 59 % · 5 | -10.0 % | -14.2 % | 9 (9 / 0) |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | pas de trade (—) | 36 % · 3 | 6.7 % | 42.8 % | 17 (17 / 0) |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.19) | pas de trade (—) | 100 % · 0 | 0.0 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 16 sur 27 en régime calme, 0 sur 27 en régime agité.

