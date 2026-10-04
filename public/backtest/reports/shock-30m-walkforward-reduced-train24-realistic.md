# Shock Engine · BTC/USD 30 min · walk-forward

32 plis : 24 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 204 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 200 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : realistic. Espace de recherche : réduit (longs seuls, sans stop suiveur, 7 réglages).

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | 131 % | 11.4 % | 0.55 | -36 % |
| Script tel quel | -87 % | -23.1 % | -1.03 | -89 % |
| longs seuls (fixe, Sharpe de test moyen) | | | -0.02 | |
| sans trailing (fixe, Sharpe de test moyen) | | | -0.26 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | 0.87 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **50 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 55 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 41 % que son Sharpe réel soit positif, compte tenu de 204 essais (Sharpe quotidien 0.029 contre un seuil de 0.033 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2019-01 → 2019-03 | 1.86 | 2.29 | 12.2 % | 2 | 98 % | -0.51 | #105 |
| 2 | 2019-04 → 2019-06 | 1.70 | 5.15 | 91.1 % | 6 | 99 % | 0.46 | #78 |
| 3 | 2019-07 → 2019-09 | 1.91 | -0.27 | -2.4 % | 5 | 80 % | -1.39 | #78 |
| 4 | 2019-10 → 2019-12 | 1.70 | -1.01 | -6.4 % | 10 | 72 % | 1.14 | #78 |
| 5 | 2020-01 → 2020-03 | 1.15 | -0.51 | -6.5 % | 34 | 32 % | 0.58 | sans trailing |
| 6 | 2020-04 → 2020-06 | 0.93 | 1.22 | 11.4 % | 7 | 39 % | -0.20 | #78 |
| 7 | 2020-07 → 2020-09 | 1.08 | 1.30 | 9.2 % | 2 | 77 % | -2.08 | #78 |
| 8 | 2020-10 → 2020-12 | 0.39 | -1.95 | -6.9 % | 36 | 0 % | -3.02 | longs seuls |
| 9 | 2021-01 → 2021-03 | 1.77 | -0.77 | -10.4 % | 26 | 3 % | -5.68 | #78 |
| 10 | 2021-04 → 2021-06 | 1.47 | -1.14 | -4.5 % | 5 | 90 % | -0.88 | #104 |
| 11 | 2021-07 → 2021-09 | 1.10 | 1.47 | 11.9 % | 3 | 76 % | -0.55 | #118 |
| 12 | 2021-10 → 2021-12 | 0.80 | 1.57 | 13.1 % | 3 | 94 % | 1.49 | #24 |
| 13 | 2022-01 → 2022-03 | 1.00 | -0.68 | -2.8 % | 13 | 39 % | -2.53 | #35 |
| 14 | 2022-04 → 2022-06 | 1.02 | -1.72 | -3.2 % | 7 | 48 % | 0.08 | #137 |
| 15 | 2022-07 → 2022-09 | 1.36 | -0.12 | -1.9 % | 8 | 92 % | -0.41 | #118 |
| 16 | 2022-10 → 2022-12 | 1.16 | -1.99 | -3.6 % | 11 | 90 % | -3.67 | #118 |
| 17 | 2023-01 → 2023-03 | 0.32 | -0.93 | -2.5 % | 22 | 0 % | -2.14 | longs seuls |
| 18 | 2023-04 → 2023-06 | 0.61 | 0.75 | 3.2 % | 0 | 41 % | -2.60 | #50 |
| 19 | 2023-07 → 2023-09 | 0.80 | 0.93 | 1.3 % | 20 | 100 % | -0.74 | longs seuls |
| 20 | 2023-10 → 2023-12 | 0.65 | -1.42 | -6.8 % | 42 | 0 % | -2.32 | sans trailing |
| 21 | 2024-01 → 2024-03 | 0.23 | 2.39 | 13.1 % | 19 | 5 % | -0.68 | #137 |
| 22 | 2024-04 → 2024-06 | 1.06 | -0.84 | -2.0 % | 10 | 66 % | 3.40 | #118 |
| 23 | 2024-07 → 2024-09 | 1.07 | -0.43 | -2.3 % | 10 | 30 % | 1.15 | #118 |
| 24 | 2024-10 → 2024-12 | 1.15 | 1.34 | 9.2 % | 8 | 6 % | -1.01 | #118 |
| 25 | 2025-01 → 2025-03 | 1.33 | -1.39 | -12.3 % | 4 | 40 % | -2.86 | #118 |
| 26 | 2025-04 → 2025-06 | 1.28 | 2.56 | 15.5 % | 3 | 86 % | -1.08 | #82 |
| 27 | 2025-07 → 2025-09 | 1.77 | -0.34 | -1.8 % | 10 | 46 % | -4.81 | #24 |
| 28 | 2025-10 → 2025-12 | 1.58 | -1.25 | -4.1 % | 9 | 67 % | -0.08 | #198 |
| 29 | 2026-01 → 2026-03 | 1.24 | -1.71 | -4.8 % | 14 | 29 % | -1.69 | #24 |
| 30 | 2026-04 → 2026-06 | 0.67 | -0.39 | -1.7 % | 7 | 48 % | 0.78 | #159 |
| 31 | 2026-07 → 2026-09 | 0.65 | 3.49 | 14.7 % | 6 | 92 % | -6.70 | #159 |
| 32 | 2026-10 → 2026-10 | 1.07 | 5.48 | 0.9 % | 0 | 65 % | -8.45 | #24 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 1.5 · 1 · 1 · 1 · 1.3 · 1 · 1 · 1.3 · 1 · 1.1 · 1.3 · 2.4 · 1.9 · 1.1 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.3 · 1.1 · 1.3 · 1.3 · 1.3 · 1.3 · 2.1 · 2.4 · 1.4 · 2.4 · 1.9 · 1.9 · 2.4 |
| kMain | 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 · 2.2 |
| volWin | 40 · 70 · 70 · 70 · 80 · 70 · 70 · 80 · 70 · 80 · 170 · 60 · 140 · 70 · 170 · 170 · 80 · 40 · 80 · 80 · 70 · 170 · 170 · 170 · 170 · 50 · 60 · 110 · 60 · 60 · 60 · 60 |
| rangeWin | 60 · 5 · 5 · 5 · 20 · 5 · 5 · 20 · 5 · 35 · 15 · 20 · 5 · 5 · 15 · 15 · 20 · 20 · 20 · 20 · 5 · 15 · 15 · 15 · 15 · 35 · 20 · 10 · 20 · 55 · 55 · 20 |
| wickThr | 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 · 0.5 |
| cooldownBars | 3 · 18 · 18 · 18 · 6 · 18 · 18 · 6 · 18 · 2 · 17 · 3 · 3 · 13 · 17 · 17 · 6 · 23 · 6 · 6 · 13 · 17 · 17 · 17 · 17 · 10 · 3 · 14 · 3 · 12 · 12 · 3 |
| volZThr | 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 · 0.2 |
| htfEmaLen | 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 · 50 |
| atrStopMult | 1 · 1 · 1 · 1 · 1.5 · 1 · 1 · 1.5 · 1 · 1.2 · 0.8 · 0.9 · 0.8 · 1.1 · 0.8 · 0.8 · 1.5 · 1.6 · 1.5 · 1.5 · 1.1 · 0.8 · 0.8 · 0.8 · 0.8 · 1.2 · 0.9 · 1.1 · 0.9 · 0.9 · 0.9 · 0.9 |
| atrTrailMult | off · off · off · off · off · off · off · 1.8 · off · off · off · off · off · off · off · off · 1.8 · off · 1.8 · off · off · off · off · off · off · off · off · off · off · off · off · off |
| tp1AtrMult | 2.7 · 2.8 · 2.8 · 2.8 · 1.2 · 2.8 · 2.8 · 1.2 · 2.8 · 1.1 · 1.4 · 2.5 · 1.5 · 1.9 · 1.4 · 1.4 · 1.2 · 1.5 · 1.2 · 1.2 · 1.9 · 1.4 · 1.4 · 1.4 · 1.4 · 0.7 · 2.5 · 0.7 · 2.5 · 3 · 3 · 2.5 |
| tp1QtyPct | 30 · 30 · 30 · 30 · 50 · 30 · 30 · 50 · 30 · 60 · 40 · 40 · 60 · 50 · 40 · 40 · 50 · 60 · 50 · 50 · 50 · 40 · 40 · 40 · 40 · 30 · 40 · 20 · 40 · 50 · 50 · 40 |
| useTP1 | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| useMicroShock | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| highActivityMode | true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true · true |
| htfSlopeMode | chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart |
| allowShort | false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.05 | 20/32 | longs seuls, sans trailing, kMicro=2.1, volWin=140, rangeWin=55, cooldownBars=21, atrStopMult=2.5, tp1AtrMult=2.1, tp1QtyPct=80 |
| 2 | 1.04 | 20/32 | longs seuls, sans trailing, kMicro=1.8, volWin=130, rangeWin=40, cooldownBars=4, atrStopMult=1.8, tp1AtrMult=2.2, tp1QtyPct=60 |
| 3 | 1.04 | 18/32 | longs seuls, sans trailing, kMicro=1.6, volWin=160, rangeWin=30, cooldownBars=8, atrStopMult=1.6, tp1AtrMult=2.8, tp1QtyPct=20 |
| 4 | 1.03 | 20/32 | longs seuls, sans trailing, kMicro=2.2, volWin=170, rangeWin=55, cooldownBars=18, atrStopMult=0.8, tp1AtrMult=2.9, tp1QtyPct=80 |
| 5 | 0.99 | 22/32 | longs seuls, sans trailing, kMicro=1.5, volWin=100, rangeWin=45, cooldownBars=19, atrStopMult=2.3, tp1AtrMult=2.3, tp1QtyPct=80 |
| 6 | 0.98 | 20/32 | longs seuls, sans trailing, kMicro=1.5, volWin=180, rangeWin=35, cooldownBars=21, atrStopMult=1.4, tp1AtrMult=2.8, tp1QtyPct=40 |
| 7 | 0.97 | 23/32 | longs seuls, sans trailing, kMicro=2.2, volWin=190, rangeWin=30, cooldownBars=23, atrStopMult=0.9, tp1AtrMult=1.4, tp1QtyPct=80 |
| 8 | 0.94 | 18/32 | longs seuls, sans trailing, kMicro=1.6, volWin=110, rangeWin=55, cooldownBars=18, atrStopMult=1.3, tp1AtrMult=2.9, tp1QtyPct=70 |
| 9 | 0.94 | 18/32 | longs seuls, sans trailing, kMicro=2.1, volWin=180, rangeWin=50, cooldownBars=24, atrStopMult=1.1, tp1AtrMult=1.6, tp1QtyPct=20 |
| 10 | 0.92 | 17/32 | longs seuls, sans trailing, kMicro=1.4, volWin=120, rangeWin=40, cooldownBars=24, atrStopMult=1.6, tp1AtrMult=0.5, tp1QtyPct=60 |
| 11 | 0.92 | 19/32 | longs seuls, sans trailing, kMicro=2.2, volWin=180, rangeWin=20, cooldownBars=5, atrStopMult=1.6, tp1AtrMult=2.8, tp1QtyPct=40 |
| 12 | 0.91 | 19/32 | longs seuls, sans trailing, kMicro=1.3, volWin=90, rangeWin=5, cooldownBars=16, atrStopMult=3.4, tp1AtrMult=3, tp1QtyPct=30 |

