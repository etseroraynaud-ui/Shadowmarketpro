# Walk-forward 4 ans / 12 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur les 48 mois précédant chaque test, test de 12 mois, pas de 12 mois, de 2020-01-01 au 2026-10-04 (7 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 817 % | 38.8 % | 1.18 | 1.67 | -33.0 % | 1.62 | 393 | 20 % | 42 % |
| Walk-forward, meilleur Sharpe isolé | 1212 % | 46.4 % | 1.40 | 1.98 | -22.0 % | 1.77 | 444 | 20 % | 36 % |
| Contrôle : plateaux, régime figé au début de chaque test | 150 % | 14.5 % | 0.59 | 0.83 | -47.1 % | 1.16 | 647 | 23 % | 25 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 7 fenêtres sur 7 ; régime agité 47 % du temps ; trades ouverts en régime calme 261, en régime agité 132.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 144.8 % | 15.5 % | 304.9 % | 34 |
| 2021 | 36.2 % | 33.6 % | 59.4 % | 30 |
| 2022 | 6.2 % | 46.1 % | -64.2 % | 85 |
| 2023 | 12.1 % | 52.5 % | 155.7 % | 87 |
| 2024 | 105.1 % | 114.0 % | 121.0 % | 40 |
| 2025 | 12.0 % | -4.0 % | -6.3 % | 61 |
| 2026 | 0.6 % | 16.7 % | -3.1 % | 56 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-12-31 | 2016-01-01 → 2019-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.47) | choc 2.4 · stop 3.6 ATR · suiveur non (1.00) | 52 % · 21 | 144.8 % | 304.5 % | 34 (22 / 12) |
| 2021-01-01 → 2021-12-31 | 2017-01-01 → 2020-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.51) | choc 2.4 · stop 3.6 ATR · suiveur non (1.35) | 58 % · 13 | 36.2 % | 59.4 % | 30 (12 / 18) |
| 2022-01-01 → 2022-12-31 | 2018-01-01 → 2021-12-31 | choc 3.2 · stop 2.6 ATR · suiveur non (1.54) | choc 2.4 · stop 1.8 ATR · suiveur non (1.00) | 38 % · 22 | 6.2 % | -64.2 % | 85 (66 / 19) |
| 2023-01-01 → 2023-12-31 | 2019-01-01 → 2022-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.28) | choc 2.4 · stop 1.8 ATR · suiveur non (1.01) | 34 % · 22 | 12.1 % | 155.7 % | 87 (68 / 19) |
| 2024-01-01 → 2024-12-31 | 2020-01-01 → 2023-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.17) | choc 2.8 · stop 1.8 ATR · suiveur non (0.70) | 57 % · 18 | 105.1 % | 121.0 % | 40 (12 / 28) |
| 2025-01-01 → 2025-12-31 | 2021-01-01 → 2024-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.46) | choc 2.8 · stop 2.6 ATR · suiveur non (0.46) | 34 % · 14 | 12.0 % | -6.3 % | 61 (45 / 16) |
| 2026-01-01 → 2026-10-04 | 2022-01-01 → 2025-12-31 | choc 2 · stop 2.6 ATR · suiveur non (1.30) | choc 2.8 · stop 2.6 ATR · suiveur non (0.19) | 57 % · 13 | 0.6 % | -3.1 % | 56 (36 / 20) |

Changements de réglages d'une fenêtre à la suivante : 1 sur 6 en régime calme, 3 sur 6 en régime agité.

