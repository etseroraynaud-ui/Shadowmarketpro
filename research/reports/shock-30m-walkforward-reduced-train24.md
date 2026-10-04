# Shock Engine · BTC/USD 30 min · walk-forward

32 plis : 24 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 204 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 200 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : script. Espace de recherche : réduit (longs seuls, sans stop suiveur, 7 réglages).

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | 102 % | 9.5 % | 0.50 | -36 % |
| Script tel quel | -22 % | -3.2 % | -0.03 | -59 % |
| longs seuls (fixe, Sharpe de test moyen) | | | 0.61 | |
| sans trailing (fixe, Sharpe de test moyen) | | | 0.31 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | 0.98 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **41 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 53 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 55 % que son Sharpe réel soit positif, compte tenu de 204 essais (Sharpe quotidien 0.026 contre un seuil de 0.024 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2019-01 → 2019-03 | 1.92 | 2.32 | 12.4 % | 2 | 98 % | 0.48 | #105 |
| 2 | 2019-04 → 2019-06 | 1.76 | 5.20 | 92.0 % | 6 | 99 % | 1.20 | #78 |
| 3 | 2019-07 → 2019-09 | 1.97 | -0.20 | -2.0 % | 5 | 78 % | -0.50 | #78 |
| 4 | 2019-10 → 2019-12 | 1.76 | -0.88 | -5.7 % | 10 | 74 % | 1.99 | #78 |
| 5 | 2020-01 → 2020-03 | 1.42 | -0.24 | -4.0 % | 34 | 37 % | 1.12 | sans trailing |
| 6 | 2020-04 → 2020-06 | 1.17 | 1.95 | 7.3 % | 21 | 86 % | 0.48 | longs seuls |
| 7 | 2020-07 → 2020-09 | 1.34 | -1.53 | -3.2 % | 25 | 0 % | -0.75 | longs seuls |
| 8 | 2020-10 → 2020-12 | 0.84 | -1.18 | -4.3 % | 36 | 0 % | -1.90 | longs seuls |
| 9 | 2021-01 → 2021-03 | 1.85 | -0.58 | -8.5 % | 26 | 3 % | -5.02 | #78 |
| 10 | 2021-04 → 2021-06 | 1.58 | -1.04 | -4.1 % | 5 | 90 % | -0.20 | #104 |
| 11 | 2021-07 → 2021-09 | 1.20 | 1.50 | 12.2 % | 3 | 75 % | 0.41 | #118 |
| 12 | 2021-10 → 2021-12 | 0.88 | 1.59 | 13.4 % | 3 | 93 % | 2.34 | #24 |
| 13 | 2022-01 → 2022-03 | 1.10 | -0.42 | -1.9 % | 13 | 47 % | -1.51 | #35 |
| 14 | 2022-04 → 2022-06 | 1.12 | -1.43 | -2.7 % | 7 | 55 % | 0.99 | #137 |
| 15 | 2022-07 → 2022-09 | 1.47 | -0.03 | -1.3 % | 8 | 90 % | 0.53 | #118 |
| 16 | 2022-10 → 2022-12 | 1.26 | -1.53 | -2.8 % | 11 | 94 % | -2.14 | #118 |
| 17 | 2023-01 → 2023-03 | 0.76 | -0.28 | -0.9 % | 22 | 0 % | -0.89 | longs seuls |
| 18 | 2023-04 → 2023-06 | 0.98 | -0.83 | -4.2 % | 45 | 2 % | -1.19 | sans trailing |
| 19 | 2023-07 → 2023-09 | 1.31 | 1.99 | 2.9 % | 20 | 100 % | 1.34 | longs seuls |
| 20 | 2023-10 → 2023-12 | 1.17 | 0.29 | 0.8 % | 26 | 1 % | -1.11 | longs seuls |
| 21 | 2024-01 → 2024-03 | 0.64 | 2.43 | 7.1 % | 31 | 4 % | 0.61 | longs seuls |
| 22 | 2024-04 → 2024-06 | 1.19 | -0.51 | -1.3 % | 10 | 74 % | 4.70 | #118 |
| 23 | 2024-07 → 2024-09 | 1.20 | -0.26 | -1.5 % | 10 | 30 % | 2.45 | #118 |
| 24 | 2024-10 → 2024-12 | 1.30 | 1.43 | 9.9 % | 8 | 6 % | 0.23 | #118 |
| 25 | 2025-01 → 2025-03 | 1.46 | -1.35 | -12.0 % | 4 | 36 % | -1.51 | #118 |
| 26 | 2025-04 → 2025-06 | 1.39 | 2.60 | 15.8 % | 3 | 85 % | 0.56 | #82 |
| 27 | 2025-07 → 2025-09 | 1.90 | -0.15 | -1.0 % | 10 | 51 % | -2.33 | #24 |
| 28 | 2025-10 → 2025-12 | 1.67 | -1.04 | -3.5 % | 9 | 67 % | 1.24 | #198 |
| 29 | 2026-01 → 2026-03 | 1.38 | -0.82 | -2.2 % | 13 | 65 % | -0.31 | #159 |
| 30 | 2026-04 → 2026-06 | 1.03 | 1.35 | 6.0 % | 37 | 98 % | 2.33 | sans trailing |
| 31 | 2026-07 → 2026-09 | 1.11 | -2.54 | -9.4 % | 56 | 1 % | -4.84 | sans trailing |
| 32 | 2026-10 → 2026-10 | 1.23 | 5.64 | 1.0 % | 0 | 65 % | -6.14 | #24 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 1.5 · 1 · 1 · 1 · 1.3 · 1.3 · 1.3 · 1.3 · 1 · 1.1 · 1.3 · 2.4 · 1.9 · 1.1 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 2.1 · 2.4 · 1.4 · 1.9 · 1.3 · 1.3 · 2.4 |
| kMain | 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 |
| volWin | 40 · 70 · 70 · 70 · 80 · 80 · 80 · 80 · 70 · 80 · 170 · 60 · 140 · 70 · 170 · 170 · 80 · 80 · 80 · 80 · 80 · 170 · 170 · 170 · 170 · 50 · 60 · 110 · 60 · 80 · 80 · 60 |
| rangeWin | 60 · 5 · 5 · 5 · 20 · 20 · 20 · 20 · 5 · 35 · 15 · 20 · 5 · 5 · 15 · 15 · 20 · 20 · 20 · 20 · 20 · 15 · 15 · 15 · 15 · 35 · 20 · 10 · 55 · 20 · 20 · 20 |
| wickThr | 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 |
| cooldownBars | 3 · 18 · 18 · 18 · 6 · 6 · 6 · 6 · 18 · 2 · 17 · 3 · 3 · 13 · 17 · 17 · 6 · 6 · 6 · 6 · 6 · 17 · 17 · 17 · 17 · 10 · 3 · 14 · 12 · 6 · 6 · 3 |
| volZThr | 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 |
| htfEmaLen | 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 |
| atrStopMult | 1 · 1 · 1 · 1 · 1.5 · 1.5 · 1.5 · 1.5 · 1 · 1.2 · 0.8 · 0.9 · 0.8 · 1.1 · 0.8 · 0.8 · 1.5 · 1.5 · 1.5 · 1.5 · 1.5 · 0.8 · 0.8 · 0.8 · 0.8 · 1.2 · 0.9 · 1.1 · 0.9 · 1.5 · 1.5 · 0.9 |
| atrTrailMult | off · off · off · off · off · 1.8 · 1.8 · 1.8 · off · off · off · off · off · off · off · off · 1.8 · off · 1.8 · 1.8 · 1.8 · off · off · off · off · off · off · off · off · off · off · off |
| tp1AtrMult | 2.7 · 2.8 · 2.8 · 2.8 · 1.2 · 1.2 · 1.2 · 1.2 · 2.8 · 1.1 · 1.4 · 2.5 · 1.5 · 1.9 · 1.4 · 1.4 · 1.2 · 1.2 · 1.2 · 1.2 · 1.2 · 1.4 · 1.4 · 1.4 · 1.4 · 0.7 · 2.5 · 0.7 · 3 · 1.2 · 1.2 · 2.5 |
| tp1QtyPct | 30 · 30 · 30 · 30 · 50 · 50 · 50 · 50 · 30 · 60 · 40 · 40 · 60 · 50 · 40 · 40 · 50 · 50 · 50 · 50 · 50 · 40 · 40 · 40 · 40 · 30 · 40 · 20 · 50 · 50 · 50 · 40 |
| useTP1 | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| useMicroShock | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| highActivityMode | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| htfSlopeMode | chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart |
| allowShort | false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · true · true · false |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.19 | 20/32 | longs seuls, sans trailing, kMicro=2.2, volWin=170, rangeWin=55, cooldownBars=18, atrStopMult=0.8, tp1AtrMult=2.9, tp1QtyPct=80 |
| 2 | 1.17 | 23/32 | longs seuls, sans trailing, kMicro=2.1, volWin=140, rangeWin=55, cooldownBars=21, atrStopMult=2.5, tp1AtrMult=2.1, tp1QtyPct=80 |
| 3 | 1.15 | 24/32 | longs seuls, sans trailing, kMicro=2.2, volWin=190, rangeWin=30, cooldownBars=23, atrStopMult=0.9, tp1AtrMult=1.4, tp1QtyPct=80 |
| 4 | 1.14 | 21/32 | longs seuls, sans trailing, kMicro=1.8, volWin=130, rangeWin=40, cooldownBars=4, atrStopMult=1.8, tp1AtrMult=2.2, tp1QtyPct=60 |
| 5 | 1.12 | 23/32 | longs seuls, sans trailing, kMicro=1.5, volWin=100, rangeWin=45, cooldownBars=19, atrStopMult=2.3, tp1AtrMult=2.3, tp1QtyPct=80 |
| 6 | 1.10 | 18/32 | longs seuls, sans trailing, kMicro=1.6, volWin=160, rangeWin=30, cooldownBars=8, atrStopMult=1.6, tp1AtrMult=2.8, tp1QtyPct=20 |
| 7 | 1.09 | 24/32 | longs seuls, sans trailing, kMicro=1.9, volWin=120, rangeWin=25, cooldownBars=18, atrStopMult=1.1, tp1AtrMult=1.2, tp1QtyPct=80 |
| 8 | 1.08 | 21/32 | longs seuls, sans trailing, kMicro=1.6, volWin=110, rangeWin=55, cooldownBars=18, atrStopMult=1.3, tp1AtrMult=2.9, tp1QtyPct=70 |
| 9 | 1.05 | 20/32 | longs seuls, sans trailing, kMicro=1.5, volWin=180, rangeWin=35, cooldownBars=21, atrStopMult=1.4, tp1AtrMult=2.8, tp1QtyPct=40 |
| 10 | 1.04 | 17/32 | longs seuls, sans trailing, kMicro=1.4, volWin=120, rangeWin=40, cooldownBars=24, atrStopMult=1.6, tp1AtrMult=0.5, tp1QtyPct=60 |
| 11 | 1.03 | 21/32 | longs seuls, sans trailing, kMicro=2.2, volWin=140, rangeWin=50, cooldownBars=18, atrStopMult=2.1, tp1AtrMult=1.9, tp1QtyPct=80 |
| 12 | 1.02 | 22/32 | longs seuls, sans trailing, kMicro=1.3, volWin=140, rangeWin=40, cooldownBars=2, atrStopMult=1.7, tp1AtrMult=1.6, tp1QtyPct=80 |

