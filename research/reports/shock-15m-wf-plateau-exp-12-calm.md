# Walk-forward fenêtre croissante depuis le 2015-01-01 / 12 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · régime calme seul, shorts en régime de tendance baissier

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur toutes les données depuis le 2015-01-01 jusqu'à la veille de chaque test, test de 12 mois, pas de 12 mois, de 2020-01-01 au 2026-10-04 (7 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 497 % | 30.3 % | 1.35 | 1.94 | -28.3 % | 1.97 | 281 | 30 % | 15 % |
| Walk-forward, meilleur Sharpe isolé | 686 % | 35.7 % | 1.52 | 2.18 | -25.4 % | 2.24 | 312 | 28 % | 14 % |
| Contrôle : plateaux, régime figé au début de chaque test | 455 % | 28.9 % | 1.37 | 1.96 | -28.3 % | 1.99 | 263 | 30 % | 14 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 719 % | 36.5 % | 1.55 | 2.25 | -26.5 % | 1.91 | 300 | 29 % | 14 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 7 fenêtres sur 7 ; régime agité 47 % du temps ; trades ouverts en régime calme 281, en régime agité 0.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 19.0 % | 21.2 % | 304.9 % | 32 |
| 2021 | 7.4 % | 28.3 % | 59.4 % | 18 |
| 2022 | 9.9 % | 40.1 % | -64.2 % | 63 |
| 2023 | 41.4 % | 59.3 % | 155.7 % | 61 |
| 2024 | 111.7 % | 105.2 % | 121.0 % | 29 |
| 2025 | 19.4 % | 1.2 % | -6.3 % | 49 |
| 2026 | 18.8 % | 13.8 % | -3.1 % | 29 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-12-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | pas de trade (—) | 52 % · 21 | 19.0 % | 304.5 % | 32 (32 / 0) |
| 2021-01-01 → 2021-12-31 | 2015-01-01 → 2020-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.33) | pas de trade (—) | 58 % · 13 | 7.4 % | 59.4 % | 18 (18 / 0) |
| 2022-01-01 → 2022-12-31 | 2015-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | pas de trade (—) | 38 % · 22 | 9.9 % | -64.2 % | 63 (63 / 0) |
| 2023-01-01 → 2023-12-31 | 2015-01-01 → 2022-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | pas de trade (—) | 34 % · 22 | 41.4 % | 155.7 % | 61 (61 / 0) |
| 2024-01-01 → 2024-12-31 | 2015-01-01 → 2023-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | pas de trade (—) | 57 % · 18 | 111.7 % | 121.0 % | 29 (29 / 0) |
| 2025-01-01 → 2025-12-31 | 2015-01-01 → 2024-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.26) | pas de trade (—) | 34 % · 14 | 19.4 % | -6.3 % | 49 (49 / 0) |
| 2026-01-01 → 2026-10-04 | 2015-01-01 → 2025-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | pas de trade (—) | 57 % · 13 | 18.8 % | -3.1 % | 29 (29 / 0) |

Changements de réglages d'une fenêtre à la suivante : 1 sur 6 en régime calme, 0 sur 6 en régime agité.

