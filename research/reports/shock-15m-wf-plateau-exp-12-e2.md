# Walk-forward fenêtre croissante depuis le 2015-01-01 / 12 mois, réglages choisis sur plateaux · adaptatif 15 min · preset · shorts en régime de tendance baissier (E2)

Base : réglages non optimisés : ceux du préréglage du bot (choisis sur 2017-2026, fuite d'information vers les tests).

BTC/USD Bitstamp 15 min. Calibration sur toutes les données depuis le 2015-01-01 jusqu'à la veille de chaque test, test de 12 mois, pas de 12 mois, de 2020-01-01 au 2026-10-04 (7 fenêtres). Frais : 0,045 % par ordre (taker Hyperliquid), sans levier ni financement. Les régimes de volatilité (calme / agité) sont ceux du bot, calculés sur des journées closes.

Grille par régime : seuil du choc 2 / 2.4 / 2.8 / 3.2 × stop 0.8 / 1.2 / 1.8 / 2.6 / 3.6 ATR × stop suiveur 2 / 3.2 / 5 / sans ATR, soit 80 réglages ; les autres réglages restent ceux du préréglage. Note d'un réglage : Sharpe quotidien sur la calibration (0 s'il a moins de 20 trades). Note de plateau : moyenne sur le réglage et ses voisins immédiats (jusqu'à 27). Si le meilleur plateau n'est pas positif, le régime n'est pas tradé pendant le test.

## Courbe hors échantillon (segments de test seulement)

|  | rendement | CAGR | Sharpe | Sortino | pire baisse | profit factor | trades | gagnants | temps investi |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Walk-forward, plateaux** | 1021 % | 43.0 % | 1.24 | 1.75 | -37.6 % | 1.70 | 338 | 23 % | 45 % |
| Walk-forward, meilleur Sharpe isolé | 1776 % | 54.3 % | 1.50 | 2.12 | -28.0 % | 1.98 | 394 | 21 % | 38 % |
| Contrôle : plateaux, régime figé au début de chaque test | 313 % | 23.4 % | 0.79 | 1.11 | -55.9 % | 1.28 | 511 | 26 % | 32 % |
| Préréglage fixe (choisi sur 2017-2026 : flatteur) | 724 % | 36.6 % | 1.49 | 2.17 | -24.1 % | 1.65 | 541 | 31 % | 15 % |
| Achat conservé | 1084 % | 44.2 % | — | — | -77.3 % | — | — | — | 100 % |

Sharpe et Sortino annualisés sur les rendements par bougie de 15 min.

## Ce qui est figé, ce qui évolue pendant chaque test

- **Figé au début de chaque fenêtre de test** (choisi sur la calibration seulement) : les deux jeux de réglages, l'un pour le régime calme, l'autre pour le régime agité (seuil du choc, stop, stop suiveur), ou l'absence de trade dans un régime.
- **Recalculé à chaque bougie, comme en live** : tous les indicateurs (chocs, ATR, volume, lambda, compression, filtre 60 min, VWAP), le régime de volatilité (relu chaque jour sur la dernière journée close, contre sa médiane des 365 jours précédents), donc le jeu appliqué à chaque bougie, et les stops (stop, TP1, stop suiveur). Une position garde les réglages qui l'ont ouverte jusqu'à sa sortie.
- **Mesuré** : 123 changements de régime pendant les tests, dans 7 fenêtres sur 7 ; régime agité 47 % du temps ; trades ouverts en régime calme 228, en régime agité 110.
- **Contrôle** : la ligne « régime figé » du tableau ci-dessus fige volontairement le régime à sa valeur du début de chaque test. Son écart avec le walk-forward montre que celui-ci suit bien le régime en continu.

## Par année (walk-forward, plateaux)

| année | walk-forward | préréglage fixe | achat conservé | trades |
| --- | ---: | ---: | ---: | ---: |
| 2020 | 146.2 % | 15.5 % | 304.9 % | 33 |
| 2021 | 32.4 % | 33.6 % | 59.4 % | 30 |
| 2022 | -10.3 % | 46.1 % | -64.2 % | 79 |
| 2023 | 21.6 % | 52.5 % | 155.7 % | 76 |
| 2024 | 129.0 % | 114.0 % | 121.0 % | 32 |
| 2025 | 14.9 % | -4.0 % | -6.3 % | 49 |
| 2026 | 19.9 % | 16.7 % | -3.1 % | 39 |

## Réglages retenus à chaque fenêtre

| test | calibration | régime calme (note de plateau) | régime agité (note de plateau) | test : temps agité · changements de régime | test : stratégie | test : BTC | trades (calme / agité) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2020-01-01 → 2020-12-31 | 2015-01-01 → 2019-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.37) | choc 2.8 · stop 3.6 ATR · suiveur non (0.96) | 52 % · 21 | 146.2 % | 304.5 % | 33 (20 / 13) |
| 2021-01-01 → 2021-12-31 | 2015-01-01 → 2020-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.33) | choc 2.4 · stop 3.6 ATR · suiveur non (1.17) | 58 % · 13 | 32.4 % | 59.4 % | 30 (12 / 18) |
| 2022-01-01 → 2022-12-31 | 2015-01-01 → 2021-12-31 | choc 3.2 · stop 3.6 ATR · suiveur non (1.29) | choc 2.8 · stop 3.6 ATR · suiveur non (1.06) | 38 % · 22 | -10.3 % | -64.2 % | 79 (63 / 16) |
| 2023-01-01 → 2023-12-31 | 2015-01-01 → 2022-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.13) | choc 2.8 · stop 3.6 ATR · suiveur non (0.94) | 34 % · 22 | 21.6 % | 155.7 % | 76 (61 / 15) |
| 2024-01-01 → 2024-12-31 | 2015-01-01 → 2023-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.15) | choc 2.8 · stop 3.6 ATR · suiveur non (0.83) | 57 % · 18 | 129.0 % | 121.0 % | 32 (14 / 18) |
| 2025-01-01 → 2025-12-31 | 2015-01-01 → 2024-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.26) | choc 2.8 · stop 3.6 ATR · suiveur non (0.90) | 34 % · 14 | 14.9 % | -6.3 % | 49 (34 / 15) |
| 2026-01-01 → 2026-10-04 | 2015-01-01 → 2025-12-31 | choc 2.8 · stop 3.6 ATR · suiveur non (1.20) | choc 2.8 · stop 3.6 ATR · suiveur non (0.82) | 57 % · 13 | 19.9 % | -3.1 % | 39 (24 / 15) |

Changements de réglages d'une fenêtre à la suivante : 1 sur 6 en régime calme, 2 sur 6 en régime agité.

