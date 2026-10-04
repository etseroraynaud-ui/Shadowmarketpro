# Shock Engine · BTC/USD 15 min · walk-forward

32 plis : 24 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 204 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 200 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : script. Espace de recherche : réduit (longs seuls, sans stop suiveur, 7 réglages).

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | 398 % | 23.0 % | 0.95 | -22 % |
| Script tel quel | -69 % | -13.9 % | -0.56 | -79 % |
| longs seuls (fixe, Sharpe de test moyen) | | | 0.62 | |
| sans trailing (fixe, Sharpe de test moyen) | | | 0.16 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | 0.71 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **50 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 51 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 84 % que son Sharpe réel soit positif, compte tenu de 204 essais (Sharpe quotidien 0.050 contre un seuil de 0.032 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2019-01 → 2019-03 | 2.61 | -1.43 | -8.8 % | 7 | 1 % | -0.24 | #105 |
| 2 | 2019-04 → 2019-06 | 2.27 | 3.31 | 47.3 % | 22 | 14 % | 0.47 | #105 |
| 3 | 2019-07 → 2019-09 | 2.15 | 0.22 | 0.4 % | 9 | 92 % | 2.68 | #23 |
| 4 | 2019-10 → 2019-12 | 1.84 | -0.90 | -4.9 % | 9 | 35 % | 0.45 | #134 |
| 5 | 2020-01 → 2020-03 | 1.54 | 0.57 | 3.6 % | 61 | 16 % | -1.41 | sans trailing |
| 6 | 2020-04 → 2020-06 | 1.50 | 2.28 | 22.3 % | 0 | 57 % | -0.92 | #137 |
| 7 | 2020-07 → 2020-09 | 1.79 | 1.56 | 14.2 % | 0 | 85 % | -3.11 | #57 |
| 8 | 2020-10 → 2020-12 | 1.77 | 5.58 | 67.8 % | 8 | 82 % | -2.63 | #137 |
| 9 | 2021-01 → 2021-03 | 2.38 | -0.86 | -9.4 % | 37 | 7 % | -3.45 | #78 |
| 10 | 2021-04 → 2021-06 | 2.42 | -1.94 | -5.6 % | 18 | 32 % | -1.21 | #124 |
| 11 | 2021-07 → 2021-09 | 1.81 | 0.75 | 5.1 % | 6 | 16 % | 0.35 | #24 |
| 12 | 2021-10 → 2021-12 | 1.81 | 2.04 | 14.8 % | 12 | 96 % | 0.35 | #24 |
| 13 | 2022-01 → 2022-03 | 2.04 | -0.35 | -2.3 % | 13 | 80 % | 0.23 | #24 |
| 14 | 2022-04 → 2022-06 | 1.74 | -1.37 | -2.3 % | 11 | 85 % | 0.12 | #88 |
| 15 | 2022-07 → 2022-09 | 1.73 | -1.03 | -6.1 % | 19 | 80 % | -0.27 | #16 |
| 16 | 2022-10 → 2022-12 | 1.54 | -0.28 | -1.3 % | 8 | 85 % | 0.73 | #16 |
| 17 | 2023-01 → 2023-03 | 0.79 | 4.87 | 14.8 % | 10 | 99 % | 1.19 | #141 |
| 18 | 2023-04 → 2023-06 | 1.15 | 0.73 | 1.7 % | 0 | 24 % | -0.68 | #141 |
| 19 | 2023-07 → 2023-09 | 1.22 | -1.67 | -2.8 % | 0 | 20 % | -4.04 | #153 |
| 20 | 2023-10 → 2023-12 | 1.04 | 4.03 | 12.6 % | 0 | 11 % | -0.93 | #153 |
| 21 | 2024-01 → 2024-03 | 0.98 | 4.14 | 13.6 % | 5 | 93 % | -1.82 | #55 |
| 22 | 2024-04 → 2024-06 | 1.51 | -1.70 | -8.7 % | 9 | 90 % | 1.39 | #201 |
| 23 | 2024-07 → 2024-09 | 1.41 | 0.43 | 1.7 % | 11 | 59 % | 0.85 | #201 |
| 24 | 2024-10 → 2024-12 | 1.73 | 3.48 | 31.4 % | 0 | 79 % | 0.47 | #138 |
| 25 | 2025-01 → 2025-03 | 2.18 | -0.95 | -5.2 % | 10 | 47 % | -0.08 | #201 |
| 26 | 2025-04 → 2025-06 | 1.87 | 2.16 | 12.7 % | 7 | 16 % | -0.50 | #193 |
| 27 | 2025-07 → 2025-09 | 2.07 | 0.90 | 3.8 % | 0 | 67 % | -1.76 | #16 |
| 28 | 2025-10 → 2025-12 | 2.01 | -2.87 | -7.2 % | 14 | 19 % | 0.01 | #119 |
| 29 | 2026-01 → 2026-03 | 1.45 | -3.33 | -8.5 % | 22 | 20 % | -1.90 | longs seuls, sans trailing |
| 30 | 2026-04 → 2026-06 | 0.89 | -1.17 | -2.7 % | 6 | 7 % | -1.86 | #160 |
| 31 | 2026-07 → 2026-09 | 0.94 | 3.73 | 7.7 % | 12 | 100 % | -1.41 | #141 |
| 32 | 2026-10 → 2026-10 | 1.21 | 5.28 | 0.3 % | 0 | 12 % | -1.26 | #33 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 1.5 · 1.5 · 2 · 1 · 1.3 · 1.1 · 1 · 1.1 · 1 · 1.6 · 2.4 · 2.4 · 2.4 · 1.6 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.3 · 1.8 · 1.8 · 2.1 · 1.8 · 1.9 · 2.2 · 1.6 · 1.3 · 2.1 · 2.2 · 1.9 |
| kMain | 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 |
| volWin | 40 · 40 · 70 · 160 · 80 · 70 · 130 · 70 · 70 · 70 · 60 · 60 · 60 · 110 · 180 · 180 · 140 · 140 · 170 · 170 · 110 · 50 · 50 · 70 · 50 · 140 · 180 · 150 · 80 · 140 · 140 · 120 |
| rangeWin | 60 · 60 · 25 · 5 · 20 · 5 · 25 · 5 · 5 · 15 · 20 · 20 · 20 · 55 · 20 · 20 · 50 · 50 · 55 · 55 · 15 · 25 · 25 · 50 · 25 · 20 · 20 · 10 · 20 · 55 · 50 · 25 |
| wickThr | 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 |
| cooldownBars | 3 · 3 · 9 · 5 · 6 · 13 · 14 · 13 · 18 · 21 · 3 · 3 · 3 · 18 · 5 · 5 · 18 · 18 · 18 · 18 · 14 · 15 · 15 · 9 · 15 · 8 · 5 · 12 · 6 · 21 · 18 · 18 |
| volZThr | 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 |
| htfEmaLen | 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 |
| atrStopMult | 1 · 1 · 1.3 · 2.2 · 1.5 · 1.1 · 1.4 · 1.1 · 1 · 1.1 · 0.9 · 0.9 · 0.9 · 1.3 · 1.6 · 1.6 · 2.1 · 2.1 · 0.8 · 0.8 · 2.3 · 2.5 · 2.5 · 2.2 · 2.5 · 2 · 1.6 · 2.1 · 1.5 · 2.5 · 2.1 · 1.1 |
| atrTrailMult | off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off · off |
| tp1AtrMult | 2.7 · 2.7 · 1.1 · 1 · 1.2 · 1.9 · 0.8 · 1.9 · 2.8 · 1 · 2.5 · 2.5 · 2.5 · 2.9 · 2.8 · 2.8 · 1.9 · 1.9 · 2.9 · 2.9 · 1.4 · 1.9 · 1.9 · 1.5 · 1.9 · 2.7 · 2.8 · 1 · 1.2 · 2.1 · 1.9 · 1.2 |
| tp1QtyPct | 30 · 30 · 80 · 50 · 50 · 50 · 30 · 50 · 30 · 60 · 40 · 40 · 40 · 70 · 40 · 40 · 80 · 80 · 80 · 80 · 80 · 40 · 40 · 40 · 40 · 20 · 40 · 60 · 50 · 80 · 80 · 80 |
| useTP1 | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| useMicroShock | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| highActivityMode | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| htfSlopeMode | chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart |
| allowShort | false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.27 | 22/32 | longs seuls, sans trailing, kMicro=2.3, volWin=190, rangeWin=40, cooldownBars=2, atrStopMult=2.7, tp1AtrMult=1.7, tp1QtyPct=80 |
| 2 | 1.24 | 23/32 | longs seuls, sans trailing, kMicro=2.2, volWin=140, rangeWin=50, cooldownBars=18, atrStopMult=2.1, tp1AtrMult=1.9, tp1QtyPct=80 |
| 3 | 1.23 | 20/32 | longs seuls, sans trailing, kMicro=2.2, volWin=180, rangeWin=20, cooldownBars=5, atrStopMult=1.6, tp1AtrMult=2.8, tp1QtyPct=40 |
| 4 | 1.16 | 21/32 | longs seuls, sans trailing, kMicro=2.2, volWin=160, rangeWin=25, cooldownBars=9, atrStopMult=3.1, tp1AtrMult=3, tp1QtyPct=70 |
| 5 | 1.14 | 23/32 | longs seuls, sans trailing, kMicro=2.1, volWin=140, rangeWin=55, cooldownBars=21, atrStopMult=2.5, tp1AtrMult=2.1, tp1QtyPct=80 |
| 6 | 1.12 | 19/32 | longs seuls, sans trailing, kMicro=2.2, volWin=120, rangeWin=50, cooldownBars=3, atrStopMult=1.9, tp1AtrMult=2.4, tp1QtyPct=30 |
| 7 | 1.10 | 21/32 | longs seuls, sans trailing, kMicro=2.4, volWin=130, rangeWin=45, cooldownBars=2, atrStopMult=2.9, tp1AtrMult=2.6, tp1QtyPct=70 |
| 8 | 1.09 | 21/32 | longs seuls, sans trailing, kMicro=2.1, volWin=180, rangeWin=25, cooldownBars=19, atrStopMult=3.2, tp1AtrMult=3, tp1QtyPct=70 |
| 9 | 1.04 | 20/32 | longs seuls, sans trailing, kMicro=2.2, volWin=110, rangeWin=25, cooldownBars=7, atrStopMult=3.3, tp1AtrMult=2.4, tp1QtyPct=20 |
| 10 | 1.02 | 22/32 | longs seuls, sans trailing, kMicro=1.9, volWin=100, rangeWin=60, cooldownBars=12, atrStopMult=3, tp1AtrMult=2.7, tp1QtyPct=60 |
| 11 | 1.01 | 20/32 | longs seuls, sans trailing, kMicro=2.2, volWin=130, rangeWin=60, cooldownBars=20, atrStopMult=1.7, tp1AtrMult=2.2, tp1QtyPct=30 |
| 12 | 0.99 | 19/32 | longs seuls, sans trailing, kMicro=2.3, volWin=100, rangeWin=30, cooldownBars=13, atrStopMult=3.1, tp1AtrMult=2.6, tp1QtyPct=70 |

