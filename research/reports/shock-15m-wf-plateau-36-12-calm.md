# Walk-forward 3 ans / 12 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 36 mois précédant chaque test, test de 12 mois, pas de 12 mois, de 2020-01-01 au 2026-10-04 (7 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 173 % | 16.0 % | 0.92 | 1.34 | -24.4 % | 1.52 | 363 | 30 % | 9 % |
| Walk-forward, meilleur Sharpe isolé | 373 % | 25.8 % | 1.41 | 2.07 | -21.1 % | 1.94 | 376 | 27 % | 8 % |
| Contrôle : plateaux, régime figé au début de chaque test | 147 % | 14.3 % | 0.91 | 1.32 | -24.4 % | 1.51 | 345 | 30 % | 8 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 7 fenêtres sur 7 ; régime agité 47 % du temps ; trades ouverts en régime calme 363, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 15.9 % | 21.2 % | 304.9 % | 35 |
| 2021 | 10.4 % | 28.3 % | 59.4 % | 18 |
| 2022 | -6.1 % | 40.1 % | -64.2 % | 98 |
| 2023 | 21.7 % | 59.3 % | 155.7 % | 76 |
| 2024 | 63.3 % | 105.2 % | 121.0 % | 31 |
| 2025 | -2.3 % | 1.2 % | -6.3 % | 72 |
| 2026 | 16.9 % | 13.8 % | -3.1 % | 33 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-12-31 | 2017-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.61) | pas de trade (—) | 52 % · 21 | 15.9 % | 304.5 % | 35 (35 / 0) |
| 2021-01-01 → 2021-12-31 | 2018-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.69) | pas de trade (—) | 58 % · 13 | 10.4 % | 59.4 % | 18 (18 / 0) |
| 2022-01-01 → 2022-12-31 | 2019-01-01 → 2021-12-31 | choc 2.8 · stop 2.6 ATR · suiveur 3.2 ATR (1.35) | pas de trade (—) | 38 % · 22 | -6.1 % | -64.2 % | 98 (98 / 0) |
| 2023-01-01 → 2023-12-31 | 2020-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.09) | pas de trade (—) | 34 % · 22 | 21.7 % | 155.7 % | 76 (76 / 0) |
| 2024-01-01 → 2024-12-31 | 2021-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.27) | pas de trade (—) | 57 % · 18 | 63.3 % | 121.0 % | 31 (31 / 0) |
| 2025-01-01 → 2025-12-31 | 2022-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.65) | pas de trade (—) | 34 % · 14 | -2.3 % | -6.3 % | 72 (72 / 0) |
| 2026-01-01 → 2026-10-04 | 2023-01-01 → 2025-12-31 | choc 2.8 · stop 2.6 ATR · suiveur non (1.42) | pas de trade (—) | 57 % · 13 | 16.9 % | -3.1 % | 33 (33 / 0) |

Changements de réglages d'une fenêtre à la suivante : 3 sur 6 en régime calme, 0 sur 6 en régime agité.

