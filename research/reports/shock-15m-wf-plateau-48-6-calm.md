# Walk-forward 4 ans / 6 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 48 mois précédant chaque test, test de 6 mois, pas de 6 mois, de 2020-01-01 au 2026-10-04 (14 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 260 % | 20.9 % | 1.06 | 1.53 | -25.1 % | 1.55 | 351 | 24 % | 11 % |
| Walk-forward, meilleur Sharpe isolé | 359 % | 25.3 % | 1.33 | 1.96 | -18.5 % | 1.76 | 386 | 26 % | 9 % |
| Contrôle : plateaux, régime figé au début de chaque test | 226 % | 19.1 % | 1.11 | 1.61 | -25.1 % | 1.61 | 282 | 23 % | 8 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 14 fenêtres sur 14 ; régime agité 47 % du temps ; trades ouverts en régime calme 351, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 15.9 % | 21.2 % | 304.9 % | 35 |
| 2021 | 10.4 % | 28.3 % | 59.4 % | 18 |
| 2022 | 39.6 % | 40.1 % | -64.2 % | 79 |
| 2023 | 21.1 % | 59.3 % | 155.7 % | 78 |
| 2024 | 63.3 % | 105.2 % | 121.0 % | 31 |
| 2025 | 4.9 % | 1.2 % | -6.3 % | 69 |
| 2026 | -2.9 % | 13.8 % | -3.1 % | 41 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-06-30 | 2016-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.47) | pas de trade (—) | 59 % · 14 | 0.6 % | 27.4 % | 13 (13 / 0) |
| 2020-07-01 → 2020-12-31 | 2016-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.46) | pas de trade (—) | 46 % · 7 | 15.2 % | 217.5 % | 22 (22 / 0) |
| 2021-01-01 → 2021-06-30 | 2017-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.51) | pas de trade (—) | 86 % · 4 | -2.3 % | 20.8 % | 2 (2 / 0) |
| 2021-07-01 → 2021-12-31 | 2017-07-01 → 2021-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.50) | pas de trade (—) | 31 % · 9 | 13.0 % | 31.9 % | 16 (16 / 0) |
| 2022-01-01 → 2022-06-30 | 2018-01-01 → 2021-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.54) | pas de trade (—) | 45 % · 13 | 39.8 % | -56.9 % | 28 (28 / 0) |
| 2022-07-01 → 2022-12-31 | 2018-07-01 → 2022-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.60) | pas de trade (—) | 30 % · 9 | -0.1 % | -17.0 % | 51 (51 / 0) |
| 2023-01-01 → 2023-06-30 | 2019-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.28) | pas de trade (—) | 24 % · 14 | 13.5 % | 84.3 % | 45 (45 / 0) |
| 2023-07-01 → 2023-12-31 | 2019-07-01 → 2023-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.14) | pas de trade (—) | 43 % · 8 | 6.6 % | 38.7 % | 33 (33 / 0) |
| 2024-01-01 → 2024-06-30 | 2020-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.17) | pas de trade (—) | 69 % · 6 | 30.6 % | 48.3 % | 8 (8 / 0) |
| 2024-07-01 → 2024-12-31 | 2020-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.32) | pas de trade (—) | 46 % · 12 | 25.0 % | 49.0 % | 23 (23 / 0) |
| 2025-01-01 → 2025-06-30 | 2021-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.46) | pas de trade (—) | 31 % · 8 | -9.0 % | 14.8 % | 41 (41 / 0) |
| 2025-07-01 → 2025-12-31 | 2021-07-01 → 2025-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.38) | pas de trade (—) | 36 % · 6 | 15.3 % | -18.4 % | 28 (28 / 0) |
| 2026-01-01 → 2026-06-30 | 2022-01-01 → 2025-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.30) | pas de trade (—) | 67 % · 10 | -10.9 % | -33.1 % | 23 (23 / 0) |
| 2026-07-01 → 2026-10-04 | 2022-07-01 → 2026-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (0.91) | pas de trade (—) | 38 % · 3 | 9.0 % | 44.9 % | 18 (18 / 0) |

Changements de réglages d'une fenêtre à la suivante : 6 sur 13 en régime calme, 0 sur 13 en régime agité.

