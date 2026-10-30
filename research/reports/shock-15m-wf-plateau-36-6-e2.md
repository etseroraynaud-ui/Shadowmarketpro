# Walk-forward 3 ans / 6 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 6 mois, pas de 6 mois, de 2020-01-01 au 2026-10-04 (14 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 542 % | 31.7 % | 1.09 | 1.54 | -40.4 % | 1.49 | 490 | 26 % | 32 % |
| Walk-forward, meilleur Sharpe isolé | 877 % | 40.1 % | 1.30 | 1.83 | -29.6 % | 1.68 | 486 | 23 % | 30 % |
| Contrôle : plateaux, régime figé au début de chaque test | 227 % | 19.1 % | 0.74 | 1.05 | -45.1 % | 1.24 | 611 | 26 % | 22 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 14 fenêtres sur 14 ; régime agité 47 % du temps ; trades ouverts en régime calme 326, en régime agité 164.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 152.8 % | 15.5 % | 304.9 % | 38 |
| 2021 | 41.6 % | 33.6 % | 59.4 % | 51 |
| 2022 | -22.9 % | 46.1 % | -64.2 % | 125 |
| 2023 | 12.0 % | 52.5 % | 155.7 % | 83 |
| 2024 | 64.4 % | 114.0 % | 121.0 % | 85 |
| 2025 | 12.1 % | -4.0 % | -6.3 % | 60 |
| 2026 | 12.7 % | 16.7 % | -3.1 % | 48 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-06-30 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.61) | choc 2.4 · stop 3.6 ATR · suiveur non (1.09) | 59 % · 14 | 69.2 % | 27.4 % | 4 (1 / 3) |
| 2020-07-01 → 2020-12-31 | 2017-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.67) | choc 2.8 · stop 0.8 ATR · suiveur non (1.11) | 46 % · 7 | 49.4 % | 217.5 % | 34 (21 / 13) |
| 2021-01-01 → 2021-06-30 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.69) | choc 2.4 · stop 1.8 ATR · suiveur non (1.19) | 86 % · 4 | 10.0 % | 20.8 % | 21 (2 / 19) |
| 2021-07-01 → 2021-12-31 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.4 · stop 1.8 ATR · suiveur non (1.15) | 31 % · 9 | 28.8 % | 31.9 % | 30 (26 / 4) |
| 2022-01-01 → 2022-06-30 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.35) | choc 2.4 · stop 1.8 ATR · suiveur non (1.28) | 45 % · 13 | -11.0 % | -56.9 % | 58 (49 / 9) |
| 2022-07-01 → 2022-12-31 | 2019-07-01 → 2022-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.27) | choc 2.4 · stop 1.8 ATR · suiveur non (1.20) | 30 % · 9 | -13.4 % | -17.0 % | 67 (58 / 9) |
| 2023-01-01 → 2023-06-30 | 2020-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.09) | choc 2.4 · stop 1.8 ATR · suiveur non (0.98) | 24 % · 14 | 12.8 % | 84.3 % | 42 (37 / 5) |
| 2023-07-01 → 2023-12-31 | 2020-07-01 → 2023-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.21) | choc 2.8 · stop 2.6 ATR · suiveur non (0.59) | 43 % · 8 | -0.7 % | 38.7 % | 41 (30 / 11) |
| 2024-01-01 → 2024-06-30 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (0.34) | 69 % · 6 | 32.3 % | 48.3 % | 39 (8 / 31) |
| 2024-07-01 → 2024-12-31 | 2021-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.51) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.35) | 46 % · 12 | 24.3 % | 49.0 % | 46 (23 / 23) |
| 2025-01-01 → 2025-06-30 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.65) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 31 % · 8 | 13.6 % | 14.8 % | 28 (23 / 5) |
| 2025-07-01 → 2025-12-31 | 2022-07-01 → 2025-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (1.15) | choc 2.8 · stop 2.6 ATR · suiveur non (0.42) | 36 % · 6 | -1.3 % | -18.4 % | 32 (21 / 11) |
| 2026-01-01 → 2026-06-30 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.42) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 67 % · 10 | 6.5 % | -33.1 % | 24 (10 / 14) |
| 2026-07-01 → 2026-10-04 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | choc 2.8 · stop 1.8 ATR · suiveur non (0.34) | 38 % · 3 | 5.8 % | 44.9 % | 24 (17 / 7) |

Changements de réglages d'une fenêtre à la suivante : 6 sur 13 en régime calme, 7 sur 13 en régime agité.

