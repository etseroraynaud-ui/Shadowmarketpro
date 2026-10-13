# Walk-forward fenêtre croissante depuis le 2015-01-01 / 3 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur toutes les données depuis le 2015-01-01 jusqu'à la veille de chaque test, test de 3 mois, pas de 3 mois, de 2020-01-01 au 2026-10-04 (28 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 237 % | 19.7 % | 0.99 | 1.40 | -38.6 % | 1.68 | 291 | 30 % | 14 % |
| Walk-forward, meilleur Sharpe isolé | 587 % | 33.0 % | 1.45 | 2.09 | -25.4 % | 2.10 | 325 | 25 % | 13 % |
| Contrôle : plateaux, régime figé au début de chaque test | 307 % | 23.1 % | 1.24 | 1.78 | -29.3 % | 2.15 | 226 | 33 % | 12 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 27 fenêtres sur 28 ; régime agité 47 % du temps ; trades ouverts en régime calme 291, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 19.0 % | 21.2 % | 304.9 % | 32 |
| 2021 | 7.4 % | 28.3 % | 59.4 % | 18 |
| 2022 | -28.7 % | 40.1 % | -64.2 % | 74 |
| 2023 | 22.0 % | 59.3 % | 155.7 % | 61 |
| 2024 | 111.7 % | 105.2 % | 121.0 % | 29 |
| 2025 | 19.4 % | 1.2 % | -6.3 % | 49 |
| 2026 | 20.0 % | 13.8 % | -3.1 % | 28 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-03-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | pas de trade (—) | 41 % · 7 | -3.2 % | -10.4 % | 9 (9 / 0) |
| 2020-04-01 → 2020-06-30 | 2015-01-01 → 2020-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | pas de trade (—) | 78 % · 7 | 5.7 % | 42.2 % | 3 (3 / 0) |
| 2020-07-01 → 2020-09-30 | 2015-01-01 → 2020-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.34) | pas de trade (—) | 34 % · 4 | 5.1 % | 18.0 % | 15 (15 / 0) |
| 2020-10-01 → 2020-12-31 | 2015-01-01 → 2020-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.32) | pas de trade (—) | 58 % · 3 | 10.7 % | 169.0 % | 5 (5 / 0) |
| 2021-01-01 → 2021-03-31 | 2015-01-01 → 2020-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.33) | pas de trade (—) | 99 % · 2 | 0.0 % | 102.7 % | 0 (0 / 0) |
| 2021-04-01 → 2021-06-30 | 2015-01-01 → 2021-03-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | pas de trade (—) | 74 % · 2 | -1.1 % | -40.4 % | 2 (2 / 0) |
| 2021-07-01 → 2021-09-30 | 2015-01-01 → 2021-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.28) | pas de trade (—) | 37 % · 4 | 13.0 % | 25.1 % | 7 (7 / 0) |
| 2021-10-01 → 2021-12-31 | 2015-01-01 → 2021-09-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.30) | pas de trade (—) | 25 % · 5 | -3.9 % | 5.4 % | 9 (9 / 0) |
| 2022-01-01 → 2022-03-31 | 2015-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | pas de trade (—) | 41 % · 6 | -4.6 % | -1.5 % | 19 (19 / 0) |
| 2022-04-01 → 2022-06-30 | 2015-01-01 → 2022-03-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.19) | pas de trade (—) | 48 % · 7 | -5.1 % | -56.2 % | 16 (16 / 0) |
| 2022-07-01 → 2022-09-30 | 2015-01-01 → 2022-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.27) | pas de trade (—) | 39 % · 7 | -13.1 % | -2.5 % | 11 (11 / 0) |
| 2022-10-01 → 2022-12-31 | 2015-01-01 → 2022-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | pas de trade (—) | 22 % · 2 | -9.4 % | -14.9 % | 28 (28 / 0) |
| 2023-01-01 → 2023-03-31 | 2015-01-01 → 2022-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | pas de trade (—) | 32 % · 7 | 27.0 % | 72.3 % | 15 (15 / 0) |
| 2023-04-01 → 2023-06-30 | 2015-01-01 → 2023-03-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.20) | pas de trade (—) | 16 % · 7 | -6.3 % | 7.0 % | 23 (23 / 0) |
| 2023-07-01 → 2023-09-30 | 2015-01-01 → 2023-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.17) | pas de trade (—) | 15 % · 4 | -3.3 % | -11.5 % | 18 (18 / 0) |
| 2023-10-01 → 2023-12-31 | 2015-01-01 → 2023-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | pas de trade (—) | 71 % · 4 | 6.0 % | 56.7 % | 5 (5 / 0) |
| 2024-01-01 → 2024-03-31 | 2015-01-01 → 2023-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | pas de trade (—) | 66 % · 5 | 46.4 % | 68.7 % | 9 (9 / 0) |
| 2024-04-01 → 2024-06-30 | 2015-01-01 → 2024-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.24) | pas de trade (—) | 71 % · 1 | -0.9 % | -12.1 % | 2 (2 / 0) |
| 2024-07-01 → 2024-09-30 | 2015-01-01 → 2024-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.22) | pas de trade (—) | 61 % · 8 | 12.7 % | 1.0 % | 7 (7 / 0) |
| 2024-10-01 → 2024-12-31 | 2015-01-01 → 2024-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.23) | pas de trade (—) | 30 % · 4 | 29.5 % | 47.5 % | 11 (11 / 0) |
| 2025-01-01 → 2025-03-31 | 2015-01-01 → 2024-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.26) | pas de trade (—) | 38 % · 4 | 1.6 % | -11.6 % | 11 (11 / 0) |
| 2025-04-01 → 2025-06-30 | 2015-01-01 → 2025-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.24) | pas de trade (—) | 24 % · 4 | 5.3 % | 29.9 % | 14 (14 / 0) |
| 2025-07-01 → 2025-09-30 | 2015-01-01 → 2025-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.23) | pas de trade (—) | 1 % · 2 | 6.3 % | 6.4 % | 14 (14 / 0) |
| 2025-10-01 → 2025-12-31 | 2015-01-01 → 2025-09-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.22) | pas de trade (—) | 72 % · 4 | 5.0 % | -23.3 % | 10 (10 / 0) |
| 2026-01-01 → 2026-03-31 | 2015-01-01 → 2025-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | pas de trade (—) | 74 % · 5 | 24.9 % | -22.0 % | 2 (2 / 0) |
| 2026-04-01 → 2026-06-30 | 2015-01-01 → 2026-03-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.21) | pas de trade (—) | 59 % · 5 | -10.0 % | -14.2 % | 9 (9 / 0) |
| 2026-07-01 → 2026-09-30 | 2015-01-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.15) | pas de trade (—) | 36 % · 3 | 6.7 % | 42.8 % | 17 (17 / 0) |
| 2026-10-01 → 2026-10-04 | 2015-01-01 → 2026-09-30 | choc 3.2 · stop 2.6 ATR · suiveur non (1.14) | pas de trade (—) | 100 % · 0 | 0.0 % | 1.5 % | 0 (0 / 0) |

Changements de réglages d'une fenêtre à la suivante : 7 sur 27 en régime calme, 0 sur 27 en régime agité.

