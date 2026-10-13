# Walk-forward 4 ans / 6 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 48 mois précédant chaque test, test de 6 mois, pas de 6 mois, de 2020-01-01 au 2026-10-04 (14 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 1079 % | 44.1 % | 1.29 | 1.82 | -33.5 % | 1.65 | 397 | 20 % | 42 % |
| Walk-forward, meilleur Sharpe isolé | 1265 % | 47.2 % | 1.41 | 2.01 | -21.9 % | 1.80 | 446 | 21 % | 36 % |
| Contrôle : plateaux, régime figé au début de chaque test | 204 % | 17.9 % | 0.68 | 0.96 | -42.6 % | 1.18 | 606 | 22 % | 24 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 14 fenêtres sur 14 ; régime agité 47 % du temps ; trades ouverts en régime calme 271, en régime agité 126.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 167.0 % | 15.5 % | 304.9 % | 32 |
| 2021 | 36.8 % | 33.6 % | 59.4 % | 30 |
| 2022 | 22.2 % | 46.1 % | -64.2 % | 97 |
| 2023 | 11.5 % | 52.5 % | 155.7 % | 89 |
| 2024 | 111.3 % | 114.0 % | 121.0 % | 38 |
| 2025 | 14.2 % | -4.0 % | -6.3 % | 58 |
| 2026 | -1.8 % | 16.7 % | -3.1 % | 53 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-06-30 | 2016-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.47) | choc 2.4 · stop 3.6 ATR · suiveur non (1.00) | 59 % · 14 | 69.2 % | 27.4 % | 4 (1 / 3) |
| 2020-07-01 → 2020-12-31 | 2016-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.46) | choc 3.2 · stop 3.6 ATR · suiveur non (1.11) | 46 % · 7 | 57.8 % | 217.5 % | 28 (21 / 7) |
| 2021-01-01 → 2021-06-30 | 2017-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.51) | choc 2.4 · stop 3.6 ATR · suiveur non (1.35) | 86 % · 4 | -0.7 % | 20.8 % | 15 (0 / 15) |
| 2021-07-01 → 2021-12-31 | 2017-07-01 → 2021-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.50) | choc 3.2 · stop 3.6 ATR · suiveur non (1.05) | 31 % · 9 | 37.8 % | 31.9 % | 15 (12 / 3) |
| 2022-01-01 → 2022-06-30 | 2018-01-01 → 2021-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.54) | choc 2.4 · stop 1.8 ATR · suiveur non (1.00) | 45 % · 13 | 31.6 % | -56.9 % | 37 (28 / 9) |
| 2022-07-01 → 2022-12-31 | 2018-07-01 → 2022-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.60) | choc 2.4 · stop 1.8 ATR · suiveur non (1.08) | 30 % · 9 | -7.1 % | -17.0 % | 60 (51 / 9) |
| 2023-01-01 → 2023-06-30 | 2019-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.28) | choc 2.4 · stop 1.8 ATR · suiveur non (1.01) | 24 % · 14 | 12.8 % | 84.3 % | 42 (37 / 5) |
| 2023-07-01 → 2023-12-31 | 2019-07-01 → 2023-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.14) | choc 2.4 · stop 1.8 ATR · suiveur non (0.91) | 43 % · 8 | -1.1 % | 38.7 % | 47 (33 / 14) |
| 2024-01-01 → 2024-06-30 | 2020-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.17) | choc 2.8 · stop 1.8 ATR · suiveur non (0.70) | 69 % · 6 | 23.5 % | 48.3 % | 25 (7 / 18) |
| 2024-07-01 → 2024-12-31 | 2020-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.32) | choc 2.8 · stop 2.6 ATR · suiveur non (0.54) | 46 % · 12 | 71.1 % | 49.0 % | 13 (5 / 8) |
| 2025-01-01 → 2025-06-30 | 2021-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.46) | choc 2.8 · stop 2.6 ATR · suiveur non (0.46) | 31 % · 8 | 13.6 % | 14.8 % | 28 (23 / 5) |
| 2025-07-01 → 2025-12-31 | 2021-07-01 → 2025-06-30 | choc 2.4 · stop 2.6 ATR · suiveur non (1.38) | choc 2.8 · stop 3.6 ATR · suiveur non (0.54) | 36 % · 6 | 0.6 % | -18.4 % | 30 (20 / 10) |
| 2026-01-01 → 2026-06-30 | 2022-01-01 → 2025-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.30) | choc 2.8 · stop 2.6 ATR · suiveur non (0.19) | 67 % · 10 | -9.1 % | -33.1 % | 29 (15 / 14) |
| 2026-07-01 → 2026-10-04 | 2022-07-01 → 2026-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (0.91) | choc 2.8 · stop 2.6 ATR · suiveur non (0.15) | 38 % · 3 | 8.0 % | 44.9 % | 24 (18 / 6) |

Changements de réglages d'une fenêtre à la suivante : 6 sur 13 en régime calme, 8 sur 13 en régime agité.

