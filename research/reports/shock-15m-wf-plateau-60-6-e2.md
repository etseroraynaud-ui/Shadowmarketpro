# Walk-forward 5 ans / 6 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 60 mois précédant chaque test, test de 6 mois, pas de 6 mois, de 2020-01-01 au 2026-10-04 (14 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 878 % | 40.1 % | 1.23 | 1.73 | -32.7 % | 1.69 | 399 | 26 % | 40 % |
| Walk-forward, meilleur Sharpe isolé | 1203 % | 46.2 % | 1.37 | 1.93 | -29.3 % | 1.83 | 426 | 19 % | 34 % |
| Contrôle : plateaux, régime figé au début de chaque test | 175 % | 16.1 % | 0.65 | 0.91 | -49.6 % | 1.20 | 600 | 28 % | 23 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 14 fenêtres sur 14 ; régime agité 47 % du temps ; trades ouverts en régime calme 273, en régime agité 126.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 166.1 % | 15.5 % | 304.9 % | 32 |
| 2021 | 31.4 % | 33.6 % | 59.4 % | 33 |
| 2022 | -14.4 % | 46.1 % | -64.2 % | 100 |
| 2023 | 32.6 % | 52.5 % | 155.7 % | 84 |
| 2024 | 104.4 % | 114.0 % | 121.0 % | 42 |
| 2025 | 16.5 % | -4.0 % | -6.3 % | 59 |
| 2026 | 3.4 % | 16.7 % | -3.1 % | 49 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-06-30 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 59 % · 14 | 68.6 % | 27.4 % | 4 (1 / 3) |
| 2020-07-01 → 2020-12-31 | 2015-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.43) | choc 3.2 · stop 3.6 ATR · suiveur non (1.12) | 46 % · 7 | 57.8 % | 217.5 % | 28 (21 / 7) |
| 2021-01-01 → 2021-06-30 | 2016-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.41) | choc 2.4 · stop 3.6 ATR · suiveur non (1.24) | 86 % · 4 | -0.7 % | 20.8 % | 15 (0 / 15) |
| 2021-07-01 → 2021-12-31 | 2016-07-01 → 2021-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.36) | choc 2.4 · stop 2.6 ATR · suiveur non (1.07) | 31 % · 9 | 32.4 % | 31.9 % | 18 (14 / 4) |
| 2022-01-01 → 2022-06-30 | 2017-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.42) | choc 2.4 · stop 2.6 ATR · suiveur non (1.17) | 45 % · 13 | -7.1 % | -56.9 % | 47 (40 / 7) |
| 2022-07-01 → 2022-12-31 | 2017-07-01 → 2022-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.51) | choc 3.2 · stop 3.6 ATR · suiveur non (1.00) | 30 % · 9 | -7.8 % | -17.0 % | 53 (48 / 5) |
| 2023-01-01 → 2023-06-30 | 2018-01-01 → 2022-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.37) | choc 2.4 · stop 1.8 ATR · suiveur non (0.81) | 24 % · 14 | 33.4 % | 84.3 % | 39 (34 / 5) |
| 2023-07-01 → 2023-12-31 | 2018-07-01 → 2023-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.4 · stop 1.8 ATR · suiveur non (0.85) | 43 % · 8 | -0.6 % | 38.7 % | 45 (31 / 14) |
| 2024-01-01 → 2024-06-30 | 2019-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.31) | choc 2.4 · stop 1.8 ATR · suiveur non (0.78) | 69 % · 6 | 23.8 % | 48.3 % | 26 (7 / 19) |
| 2024-07-01 → 2024-12-31 | 2019-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.23) | choc 2.4 · stop 1.8 ATR · suiveur non (0.83) | 46 % · 12 | 65.1 % | 49.0 % | 16 (5 / 11) |
| 2025-01-01 → 2025-06-30 | 2020-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.34) | choc 2.8 · stop 2.6 ATR · suiveur non (0.84) | 31 % · 8 | 13.6 % | 14.8 % | 28 (23 / 5) |
| 2025-07-01 → 2025-12-31 | 2020-07-01 → 2025-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.26) | choc 2.8 · stop 2.6 ATR · suiveur non (0.66) | 36 % · 6 | 2.6 % | -18.4 % | 31 (20 / 11) |
| 2026-01-01 → 2026-06-30 | 2021-01-01 → 2025-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.22) | choc 2.8 · stop 2.6 ATR · suiveur non (0.32) | 67 % · 10 | -4.6 % | -33.1 % | 25 (11 / 14) |
| 2026-07-01 → 2026-10-04 | 2021-07-01 → 2026-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.13) | choc 2.8 · stop 2.6 ATR · suiveur non (0.30) | 38 % · 3 | 8.4 % | 44.9 % | 24 (18 / 6) |

Changements de réglages d'une fenêtre à la suivante : 5 sur 13 en régime calme, 6 sur 13 en régime agité.

