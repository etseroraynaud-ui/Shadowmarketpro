# Walk-forward fenêtre croissante depuis le 2015-01-01 / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur toutes les données depuis le 2015-01-01 jusqu'à la veille de chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 569 % | 32.5 % | 1.03 | 1.44 | -53.6 % | 1.56 | 339 | 24 % | 45 % |
| Walk-forward, meilleur Sharpe isolé | 1575 % | 51.8 % | 1.46 | 2.06 | -28.0 % | 1.93 | 407 | 19 % | 36 % |
| Contrôle : plateaux, régime figé au début de chaque test | 422 % | 27.7 % | 0.89 | 1.24 | -63.1 % | 1.37 | 440 | 29 % | 38 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 229, en régime agité 110.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 146.2 % | 15.5 % | 304.9 % | 33 |
| 2021 | 33.6 % | 33.6 % | 59.4 % | 29 |
| 2022 | -42.4 % | 46.1 % | -64.2 % | 90 |
| 2023 | 10.8 % | 52.5 % | 155.7 % | 68 |
| 2024 | 129.0 % | 114.0 % | 121.0 % | 32 |
| 2025 | 14.9 % | -4.0 % | -6.3 % | 49 |
| 2026 | 21.1 % | 16.7 % | -3.1 % | 38 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 41 % · 7 | 25.3 % | -10.4 % | 4 (1 / 3) |
| 2020-04-01 → 2020-06-30 | 2015-01-01 → 2020-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | choc 2.4 · stop 3.6 ATR · suiveur non (1.03) | 78 % · 7 | 34.6 % | 42.2 % | 0 (0 / 0) |
| 2020-07-01 → 2020-09-30 | 2015-01-01 → 2020-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.34) | choc 2.8 · stop 3.6 ATR · suiveur non (1.05) | 34 % · 4 | 1.4 % | 18.0 % | 18 (14 / 4) |
| 2020-10-01 → 2020-12-31 | 2015-01-01 → 2020-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.32) | choc 2.8 · stop 3.6 ATR · suiveur non (1.04) | 58 % · 3 | 44.0 % | 169.0 % | 11 (5 / 6) |
| 2021-01-01 → 2021-03-31 | 2015-01-01 → 2020-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.33) | choc 2.4 · stop 3.6 ATR · suiveur non (1.17) | 99 % · 2 | 32.9 % | 102.7 % | 7 (0 / 7) |
| 2021-04-01 → 2021-06-30 | 2015-01-01 → 2021-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | 74 % · 2 | -23.9 % | -40.4 % | 6 (0 / 6) |
| 2021-07-01 → 2021-09-30 | 2015-01-01 → 2021-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.28) | choc 2.8 · stop 3.6 ATR · suiveur non (1.04) | 37 % · 4 | 9.2 % | 25.1 % | 11 (7 / 4) |
| 2021-10-01 → 2021-12-31 | 2015-01-01 → 2021-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | choc 2.8 · stop 3.6 ATR · suiveur non (1.02) | 25 % · 5 | 21.0 % | 5.4 % | 5 (5 / 0) |
| 2022-01-01 → 2022-03-31 | 2015-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | choc 2.8 · stop 3.6 ATR · suiveur non (1.06) | 41 % · 6 | -6.4 % | -1.5 % | 22 (19 / 3) |
| 2022-04-01 → 2022-06-30 | 2015-01-01 → 2022-03-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.19) | choc 2.8 · stop 3.6 ATR · suiveur non (1.06) | 48 % · 7 | -11.2 % | -56.2 % | 21 (16 / 5) |
| 2022-07-01 → 2022-09-30 | 2015-01-01 → 2022-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.27) | choc 2.8 · stop 3.6 ATR · suiveur non (1.02) | 39 % · 7 | -22.8 % | -2.5 % | 18 (11 / 7) |
| 2022-10-01 → 2022-12-31 | 2015-01-01 → 2022-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 22 % · 2 | -10.1 % | -14.9 % | 29 (28 / 1) |
| 2023-01-01 → 2023-03-31 | 2015-01-01 → 2022-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | choc 2.8 · stop 3.6 ATR · suiveur non (0.94) | 32 % · 7 | 22.3 % | 72.3 % | 19 (15 / 4) |
| 2023-04-01 → 2023-06-30 | 2015-01-01 → 2023-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.20) | choc 2.8 · stop 3.6 ATR · suiveur non (0.91) | 16 % · 7 | -1.9 % | 7.0 % | 24 (22 / 2) |
| 2023-07-01 → 2023-09-30 | 2015-01-01 → 2023-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.17) | choc 2.8 · stop 3.6 ATR · suiveur non (0.90) | 15 % · 4 | -3.9 % | -11.5 % | 11 (10 / 1) |
| 2023-10-01 → 2023-12-31 | 2015-01-01 → 2023-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | choc 2.8 · stop 3.6 ATR · suiveur non (0.88) | 71 % · 4 | -3.9 % | 56.7 % | 14 (5 / 9) |
| 2024-01-01 → 2024-03-31 | 2015-01-01 → 2023-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | choc 2.8 · stop 3.6 ATR · suiveur non (0.83) | 66 % · 5 | 52.1 % | 68.7 % | 15 (9 / 6) |
| 2024-04-01 → 2024-06-30 | 2015-01-01 → 2024-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.24) | choc 2.8 · stop 3.6 ATR · suiveur non (0.89) | 71 % · 1 | -11.8 % | -12.1 % | 7 (2 / 5) |
| 2024-07-01 → 2024-09-30 | 2015-01-01 → 2024-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.22) | choc 2.8 · stop 3.6 ATR · suiveur non (0.86) | 61 % · 8 | 19.7 % | 1.0 % | 10 (3 / 7) |
| 2024-10-01 → 2024-12-31 | 2015-01-01 → 2024-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.23) | choc 2.8 · stop 3.6 ATR · suiveur non (0.85) | 30 % · 4 | 42.7 % | 47.5 % | 0 (0 / 0) |
| 2025-01-01 → 2025-03-31 | 2015-01-01 → 2024-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.26) | choc 2.8 · stop 3.6 ATR · suiveur non (0.90) | 38 % · 4 | -3.7 % | -11.6 % | 15 (11 / 4) |
| 2025-04-01 → 2025-06-30 | 2015-01-01 → 2025-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.24) | choc 2.8 · stop 3.6 ATR · suiveur non (0.86) | 24 % · 4 | 24.4 % | 29.9 % | 5 (4 / 1) |
| 2025-07-01 → 2025-09-30 | 2015-01-01 → 2025-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.23) | choc 2.8 · stop 3.6 ATR · suiveur non (0.88) | 1 % · 2 | 1.2 % | 6.4 % | 9 (9 / 0) |
| 2025-10-01 → 2025-12-31 | 2015-01-01 → 2025-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.22) | choc 2.8 · stop 3.6 ATR · suiveur non (0.88) | 72 % · 4 | -5.2 % | -23.3 % | 20 (10 / 10) |
| 2026-01-01 → 2026-03-31 | 2015-01-01 → 2025-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | choc 2.8 · stop 3.6 ATR · suiveur non (0.82) | 74 % · 5 | 15.6 % | -22.0 % | 9 (2 / 7) |
| 2026-04-01 → 2026-06-30 | 2015-01-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.21) | choc 2.8 · stop 3.6 ATR · suiveur non (0.79) | 59 % · 5 | -1.2 % | -14.2 % | 7 (4 / 3) |
| 2026-07-01 → 2026-09-30 | 2015-01-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.15) | choc 2.8 · stop 3.6 ATR · suiveur non (0.78) | 36 % · 3 | 4.8 % | 42.8 % | 22 (17 / 5) |
| 2026-10-01 → 2026-10-04 | 2015-01-01 → 2026-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.14) | choc 2.8 · stop 3.6 ATR · suiveur non (0.76) | 100 % · 0 | 1.1 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 7 sur 27 en régime calme, 4 sur 27 en régime agité.

