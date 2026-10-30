# Walk-forward fenêtre croissante depuis le 2015-01-01 / 6 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur toutes les données depuis le 2015-01-01 jusqu'à la veille de chaque test, test de 6 mois, pas de 6 mois, de 2020-01-01 au 2026-10-04 (14 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 1022 % | 43.0 % | 1.24 | 1.75 | -37.6 % | 1.71 | 338 | 23 % | 45 % |
| Walk-forward, meilleur Sharpe isolé | 1690 % | 53.3 % | 1.49 | 2.11 | -28.0 % | 1.98 | 407 | 19 % | 36 % |
| Contrôle : plateaux, régime figé au début de chaque test | 413 % | 27.4 % | 0.89 | 1.25 | -45.8 % | 1.33 | 475 | 26 % | 31 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 14 fenêtres sur 14 ; régime agité 47 % du temps ; trades ouverts en régime calme 227, en régime agité 111.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 146.2 % | 15.5 % | 304.9 % | 33 |
| 2021 | 31.2 % | 33.6 % | 59.4 % | 31 |
| 2022 | -10.3 % | 46.1 % | -64.2 % | 79 |
| 2023 | 21.6 % | 52.5 % | 155.7 % | 76 |
| 2024 | 129.0 % | 114.0 % | 121.0 % | 32 |
| 2025 | 14.9 % | -4.0 % | -6.3 % | 49 |
| 2026 | 21.1 % | 16.7 % | -3.1 % | 38 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-06-30 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 59 % · 14 | 68.6 % | 27.4 % | 4 (1 / 3) |
| 2020-07-01 → 2020-12-31 | 2015-01-01 → 2020-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.34) | choc 2.8 · stop 3.6 ATR · suiveur non (1.05) | 46 % · 7 | 46.0 % | 217.5 % | 29 (19 / 10) |
| 2021-01-01 → 2021-06-30 | 2015-01-01 → 2020-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.33) | choc 2.4 · stop 3.6 ATR · suiveur non (1.17) | 86 % · 4 | -0.7 % | 20.8 % | 15 (0 / 15) |
| 2021-07-01 → 2021-12-31 | 2015-01-01 → 2021-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.28) | choc 2.8 · stop 3.6 ATR · suiveur non (1.04) | 31 % · 9 | 32.2 % | 31.9 % | 16 (12 / 4) |
| 2022-01-01 → 2022-06-30 | 2015-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | choc 2.8 · stop 3.6 ATR · suiveur non (1.06) | 45 % · 13 | 22.9 % | -56.9 % | 35 (27 / 8) |
| 2022-07-01 → 2022-12-31 | 2015-01-01 → 2022-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.27) | choc 2.8 · stop 3.6 ATR · suiveur non (1.02) | 30 % · 9 | -27.0 % | -17.0 % | 44 (36 / 8) |
| 2023-01-01 → 2023-06-30 | 2015-01-01 → 2022-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | choc 2.8 · stop 3.6 ATR · suiveur non (0.94) | 24 % · 14 | 31.5 % | 84.3 % | 43 (38 / 5) |
| 2023-07-01 → 2023-12-31 | 2015-01-01 → 2023-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.17) | choc 2.8 · stop 3.6 ATR · suiveur non (0.90) | 43 % · 8 | -7.6 % | 38.7 % | 33 (23 / 10) |
| 2024-01-01 → 2024-06-30 | 2015-01-01 → 2023-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | choc 2.8 · stop 3.6 ATR · suiveur non (0.83) | 69 % · 6 | 34.1 % | 48.3 % | 22 (11 / 11) |
| 2024-07-01 → 2024-12-31 | 2015-01-01 → 2024-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.22) | choc 2.8 · stop 3.6 ATR · suiveur non (0.86) | 46 % · 12 | 70.7 % | 49.0 % | 10 (3 / 7) |
| 2025-01-01 → 2025-06-30 | 2015-01-01 → 2024-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.26) | choc 2.8 · stop 3.6 ATR · suiveur non (0.90) | 31 % · 8 | 19.8 % | 14.8 % | 20 (15 / 5) |
| 2025-07-01 → 2025-12-31 | 2015-01-01 → 2025-06-30 | choc 2.8 · stop 3.6 ATR · suiveur non (1.23) | choc 2.8 · stop 3.6 ATR · suiveur non (0.88) | 36 % · 6 | -4.1 % | -18.4 % | 29 (19 / 10) |
| 2026-01-01 → 2026-06-30 | 2015-01-01 → 2025-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | choc 2.8 · stop 3.6 ATR · suiveur non (0.82) | 67 % · 10 | 14.2 % | -33.1 % | 16 (6 / 10) |
| 2026-07-01 → 2026-10-04 | 2015-01-01 → 2026-06-30 | choc 3.2 · stop 3.6 ATR · suiveur non (1.15) | choc 2.8 · stop 3.6 ATR · suiveur non (0.78) | 38 % · 3 | 6.0 % | 44.9 % | 22 (17 / 5) |

Changements de réglages d'une fenêtre à la suivante : 2 sur 13 en régime calme, 2 sur 13 en régime agité.

