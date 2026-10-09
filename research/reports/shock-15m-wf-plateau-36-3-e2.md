# Walk-forward 3 ans / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 570 % | 32.5 % | 1.11 | 1.57 | -34.9 % | 1.48 | 502 | 27 % | 32 % |
| Walk-forward, meilleur Sharpe isolé | 829 % | 39.1 % | 1.28 | 1.82 | -28.3 % | 1.62 | 495 | 23 % | 30 % |
| Contrôle : plateaux, régime figé au début de chaque test | 303 % | 22.9 % | 0.82 | 1.15 | -53.5 % | 1.28 | 592 | 26 % | 29 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 335, en régime agité 167.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 151.9 % | 15.5 % | 304.9 % | 39 |
| 2021 | 37.7 % | 33.6 % | 59.4 % | 56 |
| 2022 | -13.4 % | 46.1 % | -64.2 % | 130 |
| 2023 | 15.3 % | 52.5 % | 155.7 % | 83 |
| 2024 | 58.0 % | 114.0 % | 121.0 % | 86 |
| 2025 | 9.0 % | -4.0 % | -6.3 % | 60 |
| 2026 | 12.5 % | 16.7 % | -3.1 % | 48 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.61) | choc 2.4 · stop 3.6 ATR · suiveur non (1.09) | 41 % · 7 | 25.7 % | -10.4 % | 4 (1 / 3) |
| 2020-04-01 → 2020-06-30 | 2017-04-01 → 2020-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.58) | choc 2.4 · stop 3.6 ATR · suiveur non (1.14) | 78 % · 7 | 34.6 % | 42.2 % | 0 (0 / 0) |
| 2020-07-01 → 2020-09-30 | 2017-07-01 → 2020-06-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.67) | choc 2.8 · stop 0.8 ATR · suiveur non (1.11) | 34 % · 4 | 3.6 % | 18.0 % | 20 (15 / 5) |
| 2020-10-01 → 2020-12-31 | 2017-10-01 → 2020-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.67) | choc 2.4 · stop 0.8 ATR · suiveur non (1.04) | 58 % · 3 | 43.7 % | 169.0 % | 15 (6 / 9) |
| 2021-01-01 → 2021-03-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.69) | choc 2.4 · stop 1.8 ATR · suiveur non (1.19) | 99 % · 2 | 28.4 % | 102.7 % | 9 (0 / 9) |
| 2021-04-01 → 2021-06-30 | 2018-04-01 → 2021-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.56) | choc 2.4 · stop 1.8 ATR · suiveur non (1.26) | 74 % · 2 | -14.4 % | -40.4 % | 12 (2 / 10) |
| 2021-07-01 → 2021-09-30 | 2018-07-01 → 2021-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.43) | choc 2.4 · stop 1.8 ATR · suiveur non (1.15) | 37 % · 4 | 4.5 % | 25.1 % | 14 (11 / 3) |
| 2021-10-01 → 2021-12-31 | 2018-10-01 → 2021-09-30 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.41) | choc 2.4 · stop 1.8 ATR · suiveur non (1.13) | 25 % · 5 | 19.8 % | 5.4 % | 21 (20 / 1) |
| 2022-01-01 → 2022-03-31 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.35) | choc 2.4 · stop 1.8 ATR · suiveur non (1.28) | 41 % · 6 | -8.2 % | -1.5 % | 34 (29 / 5) |
| 2022-04-01 → 2022-06-30 | 2019-04-01 → 2022-03-31 | choc 2 · stop 2.6 ATR · suiveur 3.2 ATR (1.07) | choc 2.4 · stop 1.8 ATR · suiveur non (1.30) | 48 % · 7 | 7.1 % | -56.2 % | 32 (28 / 4) |
| 2022-07-01 → 2022-09-30 | 2019-07-01 → 2022-06-30 | choc 2 · stop 1.8 ATR · suiveur non (1.27) | choc 2.4 · stop 1.8 ATR · suiveur non (1.20) | 39 % · 7 | -4.7 % | -2.5 % | 27 (19 / 8) |
| 2022-10-01 → 2022-12-31 | 2019-10-01 → 2022-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | choc 2.4 · stop 1.8 ATR · suiveur non (1.09) | 22 % · 2 | -7.6 % | -14.9 % | 37 (36 / 1) |
| 2023-01-01 → 2023-03-31 | 2020-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.09) | choc 2.4 · stop 1.8 ATR · suiveur non (0.98) | 32 % · 7 | 10.5 % | 72.3 % | 21 (17 / 4) |
| 2023-04-01 → 2023-06-30 | 2020-04-01 → 2023-03-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.26) | choc 2.8 · stop 2.6 ATR · suiveur non (0.74) | 16 % · 7 | 3.8 % | 7.0 % | 19 (18 / 1) |
| 2023-07-01 → 2023-09-30 | 2020-07-01 → 2023-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.21) | choc 2.8 · stop 2.6 ATR · suiveur non (0.59) | 15 % · 4 | -4.1 % | -11.5 % | 24 (23 / 1) |
| 2023-10-01 → 2023-12-31 | 2020-10-01 → 2023-09-30 | choc 2 · stop 1.8 ATR · suiveur non (1.16) | choc 2.8 · stop 2.6 ATR · suiveur 5 ATR (0.55) | 71 % · 4 | 4.8 % | 56.7 % | 19 (8 / 11) |
| 2024-01-01 → 2024-03-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | choc 2.8 · stop 2.6 ATR · suiveur 2 ATR (0.34) | 66 % · 5 | 35.6 % | 68.7 % | 24 (7 / 17) |
| 2024-04-01 → 2024-06-30 | 2021-04-01 → 2024-03-31 | choc 2 · stop 2.6 ATR · suiveur non (1.53) | choc 2.8 · stop 0.8 ATR · suiveur non (0.32) | 71 % · 1 | -6.3 % | -12.1 % | 16 (1 / 15) |
| 2024-07-01 → 2024-09-30 | 2021-07-01 → 2024-06-30 | choc 2 · stop 2.6 ATR · suiveur non (1.51) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.35) | 61 % · 8 | 11.8 % | 1.0 % | 21 (8 / 13) |
| 2024-10-01 → 2024-12-31 | 2021-10-01 → 2024-09-30 | choc 2 · stop 2.6 ATR · suiveur non (1.54) | choc 2.8 · stop 1.8 ATR · suiveur 2 ATR (0.47) | 30 % · 4 | 11.2 % | 47.5 % | 25 (15 / 10) |
| 2025-01-01 → 2025-03-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.65) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 38 % · 4 | -9.8 % | -11.6 % | 22 (18 / 4) |
| 2025-04-01 → 2025-06-30 | 2022-04-01 → 2025-03-31 | choc 2 · stop 3.6 ATR · suiveur non (1.65) | choc 2.8 · stop 2.6 ATR · suiveur non (0.21) | 24 % · 4 | 25.1 % | 29.9 % | 6 (5 / 1) |
| 2025-07-01 → 2025-09-30 | 2022-07-01 → 2025-06-30 | choc 2.8 · stop 2.6 ATR · suiveur non (1.15) | choc 2.8 · stop 2.6 ATR · suiveur non (0.42) | 1 % · 2 | -0.1 % | 6.4 % | 11 (11 / 0) |
| 2025-10-01 → 2025-12-31 | 2022-10-01 → 2025-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.27) | choc 2.8 · stop 2.6 ATR · suiveur non (0.58) | 72 % · 4 | -3.3 % | -23.3 % | 21 (10 / 11) |
| 2026-01-01 → 2026-03-31 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.42) | choc 2.8 · stop 2.6 ATR · suiveur non (0.37) | 74 % · 5 | 6.2 % | -22.0 % | 15 (6 / 9) |
| 2026-04-01 → 2026-06-30 | 2023-04-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.29) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 59 % · 5 | 0.2 % | -14.2 % | 9 (4 / 5) |
| 2026-07-01 → 2026-09-30 | 2023-07-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.14) | choc 2.8 · stop 1.8 ATR · suiveur non (0.34) | 36 % · 3 | 4.6 % | 42.8 % | 24 (17 / 7) |
| 2026-10-01 → 2026-10-04 | 2023-10-01 → 2026-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.19) | choc 2.8 · stop 1.8 ATR · suiveur non (0.35) | 100 % · 0 | 1.1 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 16 sur 27 en régime calme, 10 sur 27 en régime agité.

