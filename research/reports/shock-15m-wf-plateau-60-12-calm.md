# Walk-forward 5 ans / 12 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 60 mois précédant chaque test, test de 12 mois, pas de 12 mois, de 2020-01-01 au 2026-10-04 (7 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 152 % | 14.6 % | 0.87 | 1.24 | -27.6 % | 1.46 | 342 | 32 % | 10 % |
| Walk-forward, meilleur Sharpe isolé | 294 % | 22.5 % | 1.10 | 1.58 | -25.5 % | 1.78 | 333 | 25 % | 12 % |
| Contrôle : plateaux, régime figé au début de chaque test | 128 % | 13.0 % | 0.85 | 1.21 | -25.3 % | 1.44 | 324 | 31 % | 8 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 7 fenêtres sur 7 ; régime agité 47 % du temps ; trades ouverts en régime calme 342, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 19.0 % | 21.2 % | 304.9 % | 32 |
| 2021 | 10.4 % | 28.3 % | 59.4 % | 18 |
| 2022 | -17.9 % | 40.1 % | -64.2 % | 81 |
| 2023 | 43.4 % | 59.3 % | 155.7 % | 71 |
| 2024 | 63.3 % | 105.2 % | 121.0 % | 31 |
| 2025 | -2.3 % | 1.2 % | -6.3 % | 72 |
| 2026 | 2.1 % | 13.8 % | -3.1 % | 37 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-12-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | pas de trade (—) | 52 % · 21 | 19.0 % | 304.5 % | 32 (32 / 0) |
| 2021-01-01 → 2021-12-31 | 2016-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.41) | pas de trade (—) | 58 % · 13 | 10.4 % | 59.4 % | 18 (18 / 0) |
| 2022-01-01 → 2022-12-31 | 2017-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur 2 ATR (1.42) | pas de trade (—) | 38 % · 22 | -17.9 % | -64.2 % | 81 (81 / 0) |
| 2023-01-01 → 2023-12-31 | 2018-01-01 → 2022-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.37) | pas de trade (—) | 34 % · 22 | 43.4 % | 155.7 % | 71 (71 / 0) |
| 2024-01-01 → 2024-12-31 | 2019-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.31) | pas de trade (—) | 57 % · 18 | 63.3 % | 121.0 % | 31 (31 / 0) |
| 2025-01-01 → 2025-12-31 | 2020-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.34) | pas de trade (—) | 34 % · 14 | -2.3 % | -6.3 % | 72 (72 / 0) |
| 2026-01-01 → 2026-10-04 | 2021-01-01 → 2025-12-31 | choc 2.4 · stop 2.6 ATR · suiveur non (1.22) | pas de trade (—) | 57 % · 13 | 2.1 % | -3.1 % | 37 (37 / 0) |

Changements de réglages d'une fenêtre à la suivante : 5 sur 6 en régime calme, 0 sur 6 en régime agité.

