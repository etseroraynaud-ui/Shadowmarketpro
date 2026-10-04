# Shock Engine · BTC/USD 5 min · walk-forward

36 plis : 12 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 204 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 200 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : script. Espace de recherche : complet (17 réglages, structure comprise).

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | 34 % | 3.4 % | 0.26 | -51 % |
| Script tel quel | -98 % | -37.5 % | -2.27 | -99 % |
| longs seuls (fixe, Sharpe de test moyen) | | | -1.16 | |
| sans trailing (fixe, Sharpe de test moyen) | | | -1.18 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | -0.38 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **39 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 59 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 0 % que son Sharpe réel soit positif, compte tenu de 204 essais (Sharpe quotidien 0.014 contre un seuil de 0.124 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2018-01 → 2018-03 | 3.76 | -1.59 | -16.3 % | 26 | 16 % | 0.33 | #39 |
| 2 | 2018-04 → 2018-06 | 2.87 | 0.24 | 0.7 % | 12 | 61 % | -4.03 | #13 |
| 3 | 2018-07 → 2018-09 | 2.99 | 2.05 | 2.8 % | 16 | 92 % | -3.54 | #63 |
| 4 | 2018-10 → 2018-12 | 3.17 | 3.75 | 23.4 % | 73 | 100 % | -0.50 | #10 |
| 5 | 2019-01 → 2019-03 | 3.93 | -2.19 | -7.0 % | 51 | 42 % | -4.64 | #10 |
| 6 | 2019-04 → 2019-06 | 2.77 | 3.22 | 21.9 % | 50 | 87 % | -1.30 | #10 |
| 7 | 2019-07 → 2019-09 | 2.73 | 3.17 | 16.6 % | 68 | 96 % | 1.47 | #10 |
| 8 | 2019-10 → 2019-12 | 2.44 | -0.34 | -1.8 % | 45 | 68 % | -1.78 | #10 |
| 9 | 2020-01 → 2020-03 | 2.12 | 0.01 | -0.9 % | 49 | 53 % | -1.24 | #121 |
| 10 | 2020-04 → 2020-06 | 2.33 | 2.55 | 18.0 % | 50 | 91 % | -0.74 | #121 |
| 11 | 2020-07 → 2020-09 | 2.00 | -0.17 | -1.7 % | 232 | 81 % | -4.95 | #46 |
| 12 | 2020-10 → 2020-12 | 1.49 | -0.87 | -5.7 % | 238 | 55 % | -5.63 | #46 |
| 13 | 2021-01 → 2021-03 | 2.24 | 1.58 | 20.8 % | 28 | 88 % | -3.75 | #153 |
| 14 | 2021-04 → 2021-06 | 2.45 | -2.73 | -24.3 % | 27 | 18 % | -5.72 | #137 |
| 15 | 2021-07 → 2021-09 | 2.38 | 0.62 | 0.8 % | 36 | 69 % | 0.32 | #165 |
| 16 | 2021-10 → 2021-12 | 2.41 | -0.33 | -1.0 % | 17 | 58 % | -2.07 | #175 |
| 17 | 2022-01 → 2022-03 | 2.49 | -4.27 | -6.2 % | 46 | 1 % | 0.40 | #165 |
| 18 | 2022-04 → 2022-06 | 1.83 | -2.18 | -5.4 % | 41 | 32 % | -4.07 | #119 |
| 19 | 2022-07 → 2022-09 | 2.42 | -1.65 | -3.9 % | 25 | 38 % | -4.01 | #170 |
| 20 | 2022-10 → 2022-12 | 1.53 | 0.30 | 0.4 % | 21 | 60 % | 0.19 | #170 |
| 21 | 2023-01 → 2023-03 | 1.32 | -2.40 | -8.8 % | 79 | 4 % | -2.37 | #101 |
| 22 | 2023-04 → 2023-06 | 1.99 | -2.93 | -3.6 % | 14 | 9 % | -1.64 | #141 |
| 23 | 2023-07 → 2023-09 | 3.03 | 1.34 | 2.4 % | 49 | 95 % | -3.95 | #18 |
| 24 | 2023-10 → 2023-12 | 3.38 | 2.14 | 7.0 % | 60 | 91 % | -2.21 | #18 |
| 25 | 2024-01 → 2024-03 | 2.84 | 0.31 | 0.7 % | 58 | 39 % | -4.02 | #18 |
| 26 | 2024-04 → 2024-06 | 2.59 | -0.52 | -4.6 % | 14 | 49 % | -4.81 | #112 |
| 27 | 2024-07 → 2024-09 | 2.35 | 1.89 | 8.5 % | 7 | 88 % | -2.01 | #180 |
| 28 | 2024-10 → 2024-12 | 2.74 | 3.18 | 16.2 % | 14 | 98 % | -3.79 | #180 |
| 29 | 2025-01 → 2025-03 | 3.18 | 1.38 | 2.8 % | 52 | 94 % | -2.10 | #21 |
| 30 | 2025-04 → 2025-06 | 2.69 | -0.25 | -0.5 % | 75 | 71 % | -6.66 | #21 |
| 31 | 2025-07 → 2025-09 | 2.28 | -1.78 | -2.1 % | 53 | 47 % | -7.97 | #21 |
| 32 | 2025-10 → 2025-12 | 1.50 | -0.64 | -2.3 % | 39 | 32 % | -1.06 | #6 |
| 33 | 2026-01 → 2026-03 | 2.89 | 2.11 | 2.2 % | 10 | 94 % | 0.61 | #143 |
| 34 | 2026-04 → 2026-06 | 2.51 | -0.91 | -0.3 % | 5 | 69 % | -2.18 | #143 |
| 35 | 2026-07 → 2026-09 | 2.00 | -2.45 | -1.4 % | 12 | 10 % | -3.61 | #143 |
| 36 | 2026-10 → 2026-10 | 1.43 | -17.28 | -0.2 % | 2 | 21 % | -18.70 | #142 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 2.4 · 1.3 · 2.2 · 2.4 · 2.4 · 2.4 · 2.4 · 2.4 · 2.4 · 2.4 · 1.5 · 1.5 · 1.5 · 2.1 · 1.8 · 1.7 · 1.8 · 1.6 · 1.7 · 1.7 · 1.1 · 2.3 · 2.1 · 2.1 · 2.1 · 2.2 · 2.1 · 2.1 · 2 · 2 · 2 · 2.1 · 2.2 · 2.2 · 2.2 · 2.4 |
| kMain | 2 · 2.8 · 2.9 · 3.2 · 3.2 · 3.2 · 3.2 · 3.2 · 3.2 · 3.2 · 3.4 · 3.4 · 2.8 · 2.3 · 2.5 · 3.4 · 2.5 · 2.3 · 3.4 · 3.4 · 2.3 · 2.4 · 1.9 · 1.9 · 1.9 · 3.1 · 3.1 · 3.1 · 2.2 · 2.2 · 2.2 · 2 · 3.4 · 3.4 · 3.4 · 2.6 |
| volWin | 70 · 140 · 40 · 40 · 40 · 40 · 40 · 40 · 40 · 40 · 120 · 120 · 40 · 170 · 70 · 40 · 70 · 90 · 190 · 190 · 90 · 100 · 100 · 100 · 100 · 160 · 90 · 90 · 60 · 60 · 60 · 90 · 150 · 150 · 150 · 130 |
| rangeWin | 35 · 5 · 60 · 15 · 15 · 15 · 15 · 15 · 15 · 15 · 25 · 25 · 5 · 30 · 50 · 40 · 50 · 40 · 30 · 30 · 25 · 25 · 45 · 45 · 45 · 20 · 45 · 45 · 55 · 55 · 55 · 25 · 45 · 45 · 45 · 45 |
| wickThr | 0.55 · 0.4 · 0.65 · 0.3 · 0.3 · 0.3 · 0.3 · 0.3 · 0.3 · 0.3 · 0.7 · 0.7 · 0.4 · 0.3 · 0.45 · 0.7 · 0.45 · 0.3 · 0.3 · 0.3 · 0.45 · 0.45 · 0.35 · 0.35 · 0.35 · 0.6 · 0.35 · 0.35 · 0.45 · 0.45 · 0.45 · 0.4 · 0.55 · 0.55 · 0.55 · 0.3 |
| cooldownBars | 15 · 11 · 13 · 24 · 24 · 24 · 24 · 24 · 8 · 8 · 3 · 3 · 7 · 4 · 24 · 19 · 24 · 3 · 13 · 13 · 13 · 5 · 22 · 22 · 22 · 16 · 20 · 20 · 23 · 23 · 23 · 5 · 23 · 23 · 23 · 10 |
| volZThr | -0.3 · 1.3 · 0.3 · 0.1 · 0.1 · 0.1 · 0.1 · 0.1 · 0.3 · 0.3 · 0.3 · 0.3 · 1.1 · 0.3 · 0.2 · 0.4 · 0.2 · 0.8 · 1.1 · 1.1 · 0 · 0.2 · 1.1 · 1.1 · 1.1 · 0.5 · 0.6 · 0.6 · 0.5 · 0.5 · 0.5 · 1 · 0.8 · 0.8 · 0.8 · 0.3 |
| htfEmaLen | 40 · 70 · 10 · 75 · 75 · 75 · 75 · 75 · 35 · 35 · 85 · 85 · 20 · 30 · 80 · 15 · 80 · 15 · 65 · 65 · 35 · 65 · 15 · 15 · 15 · 30 · 60 · 60 · 70 · 70 · 70 · 60 · 30 · 30 · 30 · 20 |
| atrStopMult | 2.6 · 1.8 · 2.8 · 3.2 · 3.2 · 3.2 · 3.2 · 3.2 · 1.4 · 1.4 · 3.4 · 3.4 · 1.6 · 2.8 · 1.3 · 1.2 · 1.3 · 2.8 · 2.6 · 2.6 · 2.8 · 1.6 · 1.3 · 1.3 · 1.3 · 2.4 · 2.6 · 2.6 · 2 · 2 · 2 · 1.1 · 3.1 · 3.1 · 3.1 · 1 |
| atrTrailMult | off · off · 0.9 · 1.1 · 1.1 · 1.1 · 1.1 · 1.1 · off · off · 1.1 · 1.1 · off · off · 1.1 · off · 1.1 · 0.8 · 2.6 · 2.6 · off · off · 3.1 · 3.1 · 3.1 · off · off · off · 1.1 · 1.1 · 1.1 · off · 0.9 · 0.9 · 0.9 · off |
| tp1AtrMult | 2.2 · 1.4 · 2.3 · 1.1 · 1.1 · 1.1 · 1.1 · 1.1 · 2.8 · 2.8 · 2.1 · 2.1 · 2.4 · 2.5 · 1.2 · 1.2 · 1.2 · 2.7 · 1.7 · 1.7 · 2.3 · 1.4 · 0.5 · 0.5 · 0.5 · 2.4 · 2.6 · 2.6 · 2.4 · 2.4 · 2.4 · 1.1 · 2.7 · 2.7 · 2.7 · 1.4 |
| tp1QtyPct | 40 · 60 · 70 · 80 · 80 · 80 · 80 · 80 · 70 · 70 · 30 · 30 · 30 · 20 · 20 · 60 · 20 · 30 · 30 · 30 · 80 · 70 · 70 · 70 · 70 · 20 · 60 · 60 · 60 · 60 · 60 · 20 · 70 · 70 · 70 · 20 |
| useTP1 | true · true · false · false · false · false · false · false · false · false · false · false · true · true · true · true · true · true · true · true · true · false · false · false · false · true · true · true · false · false · false · true · true · true · true · false |
| useMicroShock | false · false · false · false · false · false · false · false · true · true · true · true · true · false · false · true · false · false · false · false · true · true · true · true · true · true · true · true · true · true · true · false · false · false · false · true |
| highActivityMode | false · false · true · true · true · true · true · true · true · true · true · true · true · true · false · true · false · false · false · false · false · true · false · false · false · false · true · true · true · true · true · true · true · true · true · true |
| htfSlopeMode | htf · htf · chart · chart · chart · chart · chart · chart · htf · htf · htf · htf · htf · htf · htf · chart · htf · htf · htf · htf · chart · chart · htf · htf · htf · htf · htf · htf · htf · htf · htf · htf · chart · chart · chart · htf |
| allowShort | false · false · false · true · true · true · true · true · false · false · true · true · false · false · false · false · false · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.34 | 25/36 | kMicro=2.4, kMain=3.2, volWin=40, rangeWin=15, wickThr=0.3, cooldownBars=24, volZThr=0.1, htfEmaLen=75, atrStopMult=3.2, atrTrailMult=1.1, tp1AtrMult=1.1, tp1QtyPct=80, useTP1=false, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, long+short |
| 2 | 1.19 | 26/36 | kMicro=1.6, kMain=2.3, volWin=90, rangeWin=40, wickThr=0.3, cooldownBars=3, volZThr=0.8, htfEmaLen=15, atrStopMult=2.8, atrTrailMult=0.8, tp1AtrMult=2.7, tp1QtyPct=30, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 3 | 0.93 | 27/36 | kMicro=2, kMain=2.2, volWin=60, rangeWin=55, wickThr=0.45, cooldownBars=23, volZThr=0.5, htfEmaLen=70, atrStopMult=2, atrTrailMult=1.1, tp1AtrMult=2.4, tp1QtyPct=60, useTP1=false, useMicroShock=true, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 4 | 0.88 | 24/36 | kMicro=1.9, kMain=3.1, volWin=40, rangeWin=40, wickThr=0.55, cooldownBars=3, volZThr=-0.1, htfEmaLen=10, atrStopMult=2.8, atrTrailMult=1, tp1AtrMult=2.8, tp1QtyPct=30, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 5 | 0.76 | 24/36 | kMicro=2.1, kMain=2.3, volWin=170, rangeWin=30, wickThr=0.3, cooldownBars=4, volZThr=0.3, htfEmaLen=30, atrStopMult=2.8, sans trailing, tp1AtrMult=2.5, tp1QtyPct=20, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 6 | 0.69 | 21/36 | kMicro=2.2, kMain=3.1, volWin=160, rangeWin=20, wickThr=0.6, cooldownBars=16, volZThr=0.5, htfEmaLen=30, atrStopMult=2.4, sans trailing, tp1AtrMult=2.4, tp1QtyPct=20, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 7 | 0.65 | 24/36 | kMicro=2.2, kMain=2.9, volWin=40, rangeWin=60, wickThr=0.65, cooldownBars=13, volZThr=0.3, htfEmaLen=10, atrStopMult=2.8, atrTrailMult=0.9, tp1AtrMult=2.3, tp1QtyPct=70, useTP1=false, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 8 | 0.60 | 25/36 | kMicro=1.7, kMain=3.4, volWin=190, rangeWin=30, wickThr=0.3, cooldownBars=13, volZThr=1.1, htfEmaLen=65, atrStopMult=2.6, atrTrailMult=2.6, tp1AtrMult=1.7, tp1QtyPct=30, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 9 | 0.59 | 23/36 | kMicro=2.1, kMain=2.3, volWin=160, rangeWin=20, wickThr=0.55, cooldownBars=11, volZThr=0.1, htfEmaLen=60, atrStopMult=2.2, sans trailing, tp1AtrMult=1.6, tp1QtyPct=30, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 10 | 0.57 | 20/36 | kMicro=2.3, kMain=2.3, volWin=140, rangeWin=45, wickThr=0.3, cooldownBars=8, volZThr=-0.3, htfEmaLen=40, atrStopMult=1.9, sans trailing, tp1AtrMult=0.8, tp1QtyPct=50, useTP1=true, useMicroShock=true, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 11 | 0.54 | 20/36 | kMicro=2.3, kMain=3.3, volWin=40, rangeWin=50, wickThr=0.5, cooldownBars=14, volZThr=0.2, htfEmaLen=20, atrStopMult=1, sans trailing, tp1AtrMult=2.2, tp1QtyPct=40, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 12 | 0.53 | 20/36 | kMicro=1.3, kMain=2.8, volWin=140, rangeWin=5, wickThr=0.4, cooldownBars=11, volZThr=1.3, htfEmaLen=70, atrStopMult=1.8, sans trailing, tp1AtrMult=1.4, tp1QtyPct=60, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |

