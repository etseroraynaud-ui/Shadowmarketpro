# Shock Engine · BTC/USD 30 min · walk-forward

36 plis : 12 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 304 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 300 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : script.

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | -14 % | -1.7 % | -0.02 | -62 % |
| Script tel quel | 17 % | 1.8 % | 0.19 | -59 % |
| longs seuls (fixe, Sharpe de test moyen) | | | 0.59 | |
| sans trailing (fixe, Sharpe de test moyen) | | | 0.48 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | 0.85 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **50 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 47 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 0 % que son Sharpe réel soit positif, compte tenu de 304 essais (Sharpe quotidien -0.001 contre un seuil de 0.070 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2018-01 → 2018-03 | 3.43 | -0.04 | -1.0 % | 9 | 46 % | 0.94 | #237 |
| 2 | 2018-04 → 2018-06 | 3.22 | 0.43 | 0.8 % | 7 | 56 % | 2.42 | #182 |
| 3 | 2018-07 → 2018-09 | 2.65 | 5.12 | 8.7 % | 7 | 100 % | 1.74 | #182 |
| 4 | 2018-10 → 2018-12 | 3.18 | 0.70 | 1.9 % | 8 | 62 % | 1.02 | #182 |
| 5 | 2019-01 → 2019-03 | 2.91 | -0.43 | -1.6 % | 7 | 14 % | 0.48 | #265 |
| 6 | 2019-04 → 2019-06 | 2.12 | -4.16 | -41.2 % | 35 | 0 % | 1.20 | #49 |
| 7 | 2019-07 → 2019-09 | 2.94 | 2.21 | 7.0 % | 10 | 86 % | -0.50 | #301 |
| 8 | 2019-10 → 2019-12 | 2.69 | -2.79 | -9.0 % | 9 | 8 % | 1.99 | #301 |
| 9 | 2020-01 → 2020-03 | 2.80 | -2.26 | -11.6 % | 18 | 6 % | 1.12 | #64 |
| 10 | 2020-04 → 2020-06 | 2.26 | -3.03 | -15.0 % | 24 | 9 % | 0.48 | #222 |
| 11 | 2020-07 → 2020-09 | 2.32 | -3.24 | -7.6 % | 15 | 3 % | -0.75 | #50 |
| 12 | 2020-10 → 2020-12 | 2.12 | 4.00 | 39.2 % | 13 | 84 % | -1.90 | #142 |
| 13 | 2021-01 → 2021-03 | 2.70 | -0.63 | -3.2 % | 26 | 59 % | -5.02 | #35 |
| 14 | 2021-04 → 2021-06 | 2.07 | -1.71 | -7.4 % | 12 | 30 % | -0.20 | #17 |
| 15 | 2021-07 → 2021-09 | 2.03 | 0.78 | 4.2 % | 7 | 33 % | 0.41 | #213 |
| 16 | 2021-10 → 2021-12 | 2.36 | 2.18 | 5.0 % | 11 | 70 % | 2.34 | #143 |
| 17 | 2022-01 → 2022-03 | 2.20 | 2.96 | 6.3 % | 7 | 86 % | -1.51 | #143 |
| 18 | 2022-04 → 2022-06 | 3.12 | 3.04 | 4.1 % | 4 | 84 % | 0.99 | #143 |
| 19 | 2022-07 → 2022-09 | 3.13 | -0.25 | -1.2 % | 8 | 54 % | 0.53 | #293 |
| 20 | 2022-10 → 2022-12 | 2.84 | -0.50 | -2.4 % | 33 | 60 % | -2.14 | #236 |
| 21 | 2023-01 → 2023-03 | 2.90 | 1.04 | 2.8 % | 18 | 24 % | -0.89 | #299 |
| 22 | 2023-04 → 2023-06 | 2.62 | 2.93 | 15.2 % | 10 | 81 % | -1.19 | #121 |
| 23 | 2023-07 → 2023-09 | 3.22 | -1.22 | -1.4 % | 11 | 32 % | 1.34 | #98 |
| 24 | 2023-10 → 2023-12 | 3.15 | 2.64 | 9.1 % | 16 | 78 % | -1.11 | #57 |
| 25 | 2024-01 → 2024-03 | 3.54 | 1.65 | 7.7 % | 22 | 54 % | 0.61 | #237 |
| 26 | 2024-04 → 2024-06 | 3.33 | 0.92 | 2.4 % | 12 | 72 % | 4.70 | #237 |
| 27 | 2024-07 → 2024-09 | 2.52 | 0.48 | 1.6 % | 12 | 39 % | 2.45 | #272 |
| 28 | 2024-10 → 2024-12 | 2.72 | 2.11 | 12.5 % | 9 | 74 % | 0.23 | #214 |
| 29 | 2025-01 → 2025-03 | 2.53 | -1.26 | -3.2 % | 6 | 35 % | -1.51 | #89 |
| 30 | 2025-04 → 2025-06 | 2.09 | -1.04 | -4.6 % | 58 | 40 % | 0.56 | #82 |
| 31 | 2025-07 → 2025-09 | 1.68 | -0.35 | -0.7 % | 23 | 60 % | -2.33 | #33 |
| 32 | 2025-10 → 2025-12 | 1.61 | -2.22 | -6.4 % | 13 | 9 % | 1.24 | #142 |
| 33 | 2026-01 → 2026-03 | 1.89 | 1.48 | 1.9 % | 8 | 67 % | -0.31 | #165 |
| 34 | 2026-04 → 2026-06 | 2.15 | -0.58 | -1.2 % | 18 | 23 % | 2.33 | #60 |
| 35 | 2026-07 → 2026-09 | 2.42 | -0.55 | -1.0 % | 19 | 22 % | -4.84 | #37 |
| 36 | 2026-10 → 2026-10 | 2.75 | -15.01 | -0.5 % | 1 | 28 % | -6.14 | #136 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 1.7 · 1 · 1 · 1 · 1.6 · 2.2 · 2 · 2 · 2.1 · 2 · 1.2 · 2.4 · 1.5 · 2.3 · 2.2 · 2.2 · 2.2 · 2.2 · 1.2 · 1.2 · 2 · 2.4 · 2.2 · 2.1 · 1.7 · 1.7 · 1.9 · 1.7 · 1.7 · 1.9 · 1.9 · 2.4 · 1.8 · 1.1 · 2 · 2.2 |
| kMain | 1.9 · 2.9 · 2.9 · 2.9 · 3.3 · 2.2 · 3.4 · 3.4 · 2.2 · 2.1 · 3.3 · 2.6 · 2 · 3.3 · 2 · 3.4 · 3.4 · 3.4 · 2.8 · 2.7 · 2 · 3.2 · 1.8 · 2.1 · 1.9 · 1.9 · 3.3 · 2.3 · 3.2 · 2.8 · 3.1 · 2.6 · 2.5 · 2.9 · 3 · 3.4 |
| volWin | 60 · 60 · 60 · 60 · 190 · 170 · 40 · 40 · 70 · 150 · 140 · 130 · 50 · 40 · 50 · 150 · 150 · 150 · 180 · 50 · 60 · 40 · 200 · 170 · 60 · 60 · 190 · 200 · 90 · 130 · 40 · 130 · 70 · 80 · 40 · 90 |
| rangeWin | 30 · 60 · 60 · 60 · 20 · 15 · 10 · 10 · 5 · 60 · 50 · 45 · 15 · 50 · 5 · 45 · 45 · 45 · 55 · 30 · 45 · 15 · 25 · 25 · 30 · 30 · 40 · 50 · 50 · 20 · 40 · 45 · 50 · 35 · 30 · 25 |
| wickThr | 0.65 · 0.65 · 0.65 · 0.65 · 0.55 · 0.6 · 0.65 · 0.65 · 0.3 · 0.55 · 0.4 · 0.3 · 0.45 · 0.5 · 0.55 · 0.55 · 0.55 · 0.55 · 0.6 · 0.55 · 0.45 · 0.3 · 0.3 · 0.5 · 0.65 · 0.65 · 0.3 · 0.3 · 0.3 · 0.3 · 0.55 · 0.3 · 0.45 · 0.4 · 0.45 · 0.7 |
| cooldownBars | 18 · 14 · 14 · 14 · 13 · 2 · 6 · 6 · 24 · 13 · 9 · 10 · 14 · 14 · 10 · 23 · 23 · 23 · 6 · 11 · 16 · 8 · 9 · 11 · 18 · 18 · 23 · 17 · 14 · 3 · 3 · 10 · 24 · 7 · 11 · 6 |
| volZThr | 0.1 · 0.4 · 0.4 · 0.4 · 0.8 · 0.2 · 0.9 · 0.9 · 0.1 · 0 · -0.3 · 0.3 · -0.3 · 0.2 · 1.3 · 0.8 · 0.8 · 0.8 · 1.4 · 1.2 · 1.1 · 0.3 · -0.3 · 0.3 · 0.1 · 0.1 · 1.3 · 0.2 · -0.5 · -0.2 · -0.1 · 0.3 · 0.2 · 0.6 · 1.2 · 0.7 |
| htfEmaLen | 90 · 65 · 65 · 65 · 55 · 35 · 85 · 85 · 40 · 20 · 45 · 20 · 95 · 20 · 75 · 30 · 30 · 30 · 10 · 90 · 85 · 35 · 80 · 95 · 90 · 90 · 10 · 35 · 55 · 65 · 10 · 20 · 80 · 20 · 75 · 50 |
| atrStopMult | 2.8 · 2.8 · 2.8 · 2.8 · 3.2 · 1.9 · 1.2 · 1.2 · 1.4 · 2.5 · 3.1 · 1 · 1.7 · 1 · 1 · 3.1 · 3.1 · 3.1 · 2.6 · 1.2 · 1.4 · 1.4 · 0.8 · 1.8 · 2.8 · 2.8 · 1.1 · 1.6 · 1.7 · 2.9 · 2.8 · 1 · 1.3 · 1.4 · 1.3 · 1.1 |
| atrTrailMult | 2.5 · 3.8 · 3.8 · 3.8 · off · off · 3.3 · 3.3 · 1.7 · off · 2.9 · off · 0.9 · off · off · 0.9 · 0.9 · 0.9 · 1.9 · off · 2.5 · off · 3 · 2.2 · 2.5 · 2.5 · off · off · off · 1 · 1 · off · 1.1 · 1.3 · 3.9 · 4 |
| tp1AtrMult | 2.6 · 1.3 · 1.3 · 1.3 · 1.9 · 2.3 · 3 · 3 · 0.8 · 2.2 · 1 · 1.4 · 1.6 · 2.2 · 0.5 · 2.7 · 2.7 · 2.7 · 2.7 · 1.9 · 2.9 · 2.8 · 1.8 · 1.7 · 2.6 · 2.6 · 2.3 · 2.4 · 0.9 · 3 · 2.8 · 1.4 · 1.2 · 2.6 · 2.3 · 2.1 |
| tp1QtyPct | 40 · 70 · 70 · 70 · 80 · 20 · 70 · 70 · 70 · 80 · 60 · 20 · 30 · 40 · 60 · 70 · 70 · 70 · 70 · 60 · 70 · 70 · 30 · 70 · 40 · 40 · 20 · 40 · 30 · 20 · 30 · 20 · 20 · 20 · 80 · 70 |
| useTP1 | false · true · true · true · true · true · true · true · true · true · true · false · true · true · true · true · true · true · false · true · true · false · false · false · false · false · false · false · false · true · true · false · true · false · true · true |
| useMicroShock | true · true · true · true · false · true · true · true · false · true · true · true · true · true · true · false · false · false · false · true · false · true · true · false · true · true · true · true · true · true · true · true · false · false · false · false |
| highActivityMode | false · true · true · true · true · true · false · false · false · false · false · true · false · false · false · true · true · true · false · false · true · true · true · false · false · false · true · true · true · true · false · true · false · true · true · false |
| htfSlopeMode | htf · htf · htf · htf · htf · htf · htf · htf · chart · htf · chart · htf · htf · htf · htf · chart · chart · chart · htf · chart · chart · htf · htf · chart · htf · htf · chart · htf · chart · htf · htf · htf · htf · chart · chart · chart |
| allowShort | false · false · false · false · true · true · false · false · false · true · false · false · false · false · false · false · false · false · false · true · false · false · false · false · false · false · false · false · false · true · false · false · false · false · true · true |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.14 | 26/36 | kMicro=1.6, kMain=2.6, volWin=200, rangeWin=25, wickThr=0.7, cooldownBars=14, volZThr=0.3, htfEmaLen=10, atrStopMult=1.8, atrTrailMult=2.3, tp1AtrMult=1.3, tp1QtyPct=50, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 2 | 1.08 | 23/36 | kMicro=1.4, kMain=2.3, volWin=40, rangeWin=20, wickThr=0.5, cooldownBars=21, volZThr=1.5, htfEmaLen=80, atrStopMult=1.8, atrTrailMult=1.1, tp1AtrMult=1.9, tp1QtyPct=30, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 3 | 1.08 | 28/36 | kMicro=1.8, kMain=2.5, volWin=70, rangeWin=50, wickThr=0.45, cooldownBars=24, volZThr=0.2, htfEmaLen=80, atrStopMult=1.3, atrTrailMult=1.1, tp1AtrMult=1.2, tp1QtyPct=20, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 4 | 1.07 | 26/36 | kMicro=1.1, kMain=3.4, volWin=40, rangeWin=25, wickThr=0.65, cooldownBars=8, volZThr=0.6, htfEmaLen=95, atrStopMult=1, sans trailing, tp1AtrMult=1.4, tp1QtyPct=80, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 5 | 1.02 | 24/36 | kMicro=2.4, kMain=2.4, volWin=100, rangeWin=35, wickThr=0.4, cooldownBars=10, volZThr=0.7, htfEmaLen=50, atrStopMult=2.1, atrTrailMult=1.1, tp1AtrMult=1.2, tp1QtyPct=50, useTP1=true, useMicroShock=true, highActivityMode=true, htfSlopeMode=htf, long+short |
| 6 | 0.96 | 24/36 | kMicro=2.4, kMain=3.2, volWin=40, rangeWin=15, wickThr=0.3, cooldownBars=8, volZThr=0.3, htfEmaLen=35, atrStopMult=1.4, sans trailing, tp1AtrMult=2.8, tp1QtyPct=70, useTP1=false, useMicroShock=true, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 7 | 0.96 | 23/36 | kMicro=1.8, kMain=3.4, volWin=150, rangeWin=15, wickThr=0.6, cooldownBars=4, volZThr=0.5, htfEmaLen=50, atrStopMult=2.9, atrTrailMult=1.1, tp1AtrMult=1.5, tp1QtyPct=40, useTP1=false, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 8 | 0.95 | 23/36 | kMicro=1.8, kMain=3.3, volWin=130, rangeWin=35, wickThr=0.6, cooldownBars=2, volZThr=-0.5, htfEmaLen=55, atrStopMult=2.4, atrTrailMult=1.7, tp1AtrMult=1.4, tp1QtyPct=60, useTP1=true, useMicroShock=true, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 9 | 0.95 | 22/36 | kMicro=1.5, kMain=3.3, volWin=180, rangeWin=20, wickThr=0.5, cooldownBars=23, volZThr=1.5, htfEmaLen=45, atrStopMult=1.7, sans trailing, tp1AtrMult=1.4, tp1QtyPct=80, useTP1=true, useMicroShock=true, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 10 | 0.94 | 27/36 | kMicro=1.4, kMain=2.4, volWin=70, rangeWin=60, wickThr=0.5, cooldownBars=4, volZThr=1.3, htfEmaLen=35, atrStopMult=3.1, atrTrailMult=2.2, tp1AtrMult=2.6, tp1QtyPct=70, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 11 | 0.91 | 27/36 | kMicro=2.2, kMain=2.2, volWin=190, rangeWin=50, wickThr=0.55, cooldownBars=14, volZThr=-0.1, htfEmaLen=75, atrStopMult=1.5, sans trailing, tp1AtrMult=1.2, tp1QtyPct=80, useTP1=false, useMicroShock=true, highActivityMode=false, htfSlopeMode=chart, long+short |
| 12 | 0.90 | 20/36 | kMicro=1.4, kMain=1.9, volWin=40, rangeWin=30, wickThr=0.3, cooldownBars=16, volZThr=-0.3, htfEmaLen=70, atrStopMult=0.9, sans trailing, tp1AtrMult=1.6, tp1QtyPct=20, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |

