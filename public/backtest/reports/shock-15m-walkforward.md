# Shock Engine · BTC/USD 15 min · walk-forward

36 plis : 12 mois d'entraînement, puis 3 mois de test, en avançant de 3 mois. 304 jeux de paramètres (le script tel quel, longs seuls, sans trailing, longs seuls sans trailing, puis 300 tirages au hasard). Choix au meilleur Sharpe d'entraînement, avec au moins 30 positions par an. Coûts : script. Espace de recherche : complet (17 réglages, structure comprise).

## 1. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | max DD |
| --- | ---: | ---: | ---: | ---: |
| Walk-forward (paramètres réoptimisés à chaque pli) | 73 % | 6.4 % | 0.41 | -28 % |
| Script tel quel | -63 % | -10.8 % | -0.39 | -79 % |
| longs seuls (fixe, Sharpe de test moyen) | | | 0.52 | |
| sans trailing (fixe, Sharpe de test moyen) | | | 0.35 | |
| longs seuls, sans trailing (fixe, Sharpe de test moyen) | | | 0.62 | |

## 2. Surajustement

- **PBO** (probabilité de surajustement) : **42 %** des plis où le jeu choisi à l'entraînement finit sous la médiane de tous les jeux en test. Au-dessus de 50 %, l'optimisation choisit plutôt du bruit.
- Rang moyen du jeu choisi en test : 54 % (50 % = hasard).
- Sharpe dégonflé de la courbe walk-forward : probabilité 0 % que son Sharpe réel soit positif, compte tenu de 304 essais (Sharpe quotidien 0.022 contre un seuil de 0.077 attendu par chance).

## 3. Pli par pli

| pli | test | Sharpe entraînement | Sharpe test | rendement test | positions test | rang en test | script tel quel en test | jeu choisi |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | 2018-01 → 2018-03 | 4.01 | -0.83 | -11.7 % | 15 | 18 % | 1.33 | #278 |
| 2 | 2018-04 → 2018-06 | 3.21 | -0.04 | -2.3 % | 7 | 33 % | 1.17 | #278 |
| 3 | 2018-07 → 2018-09 | 3.47 | -0.19 | -0.8 % | 45 | 24 % | -0.43 | #136 |
| 4 | 2018-10 → 2018-12 | 2.58 | 1.23 | 5.7 % | 12 | 65 % | 0.01 | #141 |
| 5 | 2019-01 → 2019-03 | 3.09 | 0.60 | 1.6 % | 41 | 28 % | -0.24 | #43 |
| 6 | 2019-04 → 2019-06 | 2.91 | 2.94 | 25.4 % | 47 | 67 % | 0.47 | #160 |
| 7 | 2019-07 → 2019-09 | 3.34 | 1.61 | 9.4 % | 54 | 54 % | 2.68 | #216 |
| 8 | 2019-10 → 2019-12 | 4.45 | 0.94 | 3.1 % | 13 | 81 % | 0.45 | #238 |
| 9 | 2020-01 → 2020-03 | 3.88 | 0.15 | 0.3 % | 25 | 21 % | -1.41 | #238 |
| 10 | 2020-04 → 2020-06 | 3.01 | 4.85 | 11.6 % | 19 | 99 % | -0.92 | #238 |
| 11 | 2020-07 → 2020-09 | 2.63 | -0.04 | -0.4 % | 47 | 44 % | -3.11 | #162 |
| 12 | 2020-10 → 2020-12 | 2.23 | -4.61 | -11.5 % | 25 | 2 % | -2.63 | #54 |
| 13 | 2021-01 → 2021-03 | 2.73 | 0.04 | -3.4 % | 25 | 66 % | -3.45 | #278 |
| 14 | 2021-04 → 2021-06 | 2.75 | -0.37 | -1.1 % | 11 | 44 % | -1.21 | #258 |
| 15 | 2021-07 → 2021-09 | 2.54 | 1.06 | 8.1 % | 6 | 34 % | 0.35 | #135 |
| 16 | 2021-10 → 2021-12 | 2.48 | 1.74 | 12.2 % | 16 | 59 % | 0.35 | #17 |
| 17 | 2022-01 → 2022-03 | 2.84 | 3.11 | 5.3 % | 9 | 92 % | 0.23 | #208 |
| 18 | 2022-04 → 2022-06 | 3.26 | 1.67 | 1.6 % | 4 | 70 % | 0.12 | #79 |
| 19 | 2022-07 → 2022-09 | 3.17 | 0.50 | 1.3 % | 15 | 70 % | -0.27 | #52 |
| 20 | 2022-10 → 2022-12 | 3.32 | 2.92 | 5.8 % | 12 | 96 % | 0.73 | #57 |
| 21 | 2023-01 → 2023-03 | 3.18 | 2.89 | 7.2 % | 25 | 79 % | 1.19 | #54 |
| 22 | 2023-04 → 2023-06 | 2.90 | 0.95 | 1.7 % | 28 | 66 % | -0.68 | #54 |
| 23 | 2023-07 → 2023-09 | 2.98 | 1.62 | 2.6 % | 14 | 74 % | -4.04 | #243 |
| 24 | 2023-10 → 2023-12 | 2.95 | 0.67 | 2.1 % | 20 | 53 % | -0.93 | #51 |
| 25 | 2024-01 → 2024-03 | 2.86 | 0.19 | 0.4 % | 24 | 27 % | -1.82 | #172 |
| 26 | 2024-04 → 2024-06 | 3.42 | -0.76 | -2.3 % | 11 | 42 % | 1.39 | #252 |
| 27 | 2024-07 → 2024-09 | 2.94 | -1.95 | -6.9 % | 16 | 9 % | 0.85 | #252 |
| 28 | 2024-10 → 2024-12 | 2.67 | 1.24 | 4.6 % | 113 | 55 % | 0.47 | #253 |
| 29 | 2025-01 → 2025-03 | 2.68 | -1.24 | -1.6 % | 11 | 35 % | -0.08 | #65 |
| 30 | 2025-04 → 2025-06 | 2.35 | -2.87 | -11.7 % | 157 | 5 % | -0.50 | #77 |
| 31 | 2025-07 → 2025-09 | 2.24 | -0.17 | -0.4 % | 45 | 50 % | -1.76 | #255 |
| 32 | 2025-10 → 2025-12 | 2.57 | -1.78 | -2.6 % | 19 | 20 % | 0.01 | #54 |
| 33 | 2026-01 → 2026-03 | 2.11 | 0.41 | 0.6 % | 14 | 72 % | -1.90 | #63 |
| 34 | 2026-04 → 2026-06 | 2.39 | 0.38 | 0.5 % | 15 | 78 % | -1.86 | #63 |
| 35 | 2026-07 → 2026-09 | 1.97 | 2.57 | 6.9 % | 24 | 91 % | -1.41 | #60 |
| 36 | 2026-10 → 2026-10 | 2.05 | 11.02 | 1.8 % | 1 | 100 % | -1.26 | #60 |

## 4. Stabilité des paramètres choisis

Si l'edge est réel, les plis devraient choisir des réglages voisins. Des choix qui sautent d'un bout à l'autre de l'intervalle signalent du bruit.

| paramètre | valeurs choisies (par pli) |
| --- | --- |
| kMicro | 1.4 · 1.4 · 2.2 · 2.3 · 2.4 · 2.2 · 1.7 · 2.4 · 2.4 · 2.4 · 1.5 · 1.6 · 1.4 · 1 · 1.6 · 2.3 · 2.3 · 1 · 2.2 · 2.1 · 1.6 · 1.6 · 2.1 · 1.8 · 1 · 1.8 · 1.8 · 1.8 · 1.8 · 1.2 · 1.9 · 1.6 · 2.2 · 2.2 · 1.1 · 1.1 |
| kMain | 1.9 · 1.9 · 3.4 · 2.4 · 2.4 · 2.6 · 2.1 · 2.7 · 2.7 · 2.7 · 3.1 · 2.6 · 1.9 · 1.9 · 2.4 · 3.3 · 2.1 · 3.4 · 2.7 · 2.1 · 2.6 · 2.6 · 2.6 · 2.9 · 3.4 · 2.8 · 2.8 · 3.1 · 2.7 · 3.4 · 2.9 · 2.6 · 2.9 · 2.9 · 2.9 · 2.9 |
| volWin | 40 · 40 · 90 · 100 · 100 · 120 · 60 · 130 · 130 · 130 · 100 · 200 · 40 · 110 · 190 · 40 · 150 · 180 · 80 · 170 · 200 · 200 · 130 · 150 · 100 · 170 · 170 · 180 · 190 · 110 · 140 · 200 · 40 · 40 · 80 · 80 |
| rangeWin | 30 · 30 · 25 · 25 · 35 · 60 · 35 · 45 · 45 · 45 · 45 · 25 · 30 · 50 · 30 · 50 · 25 · 15 · 60 · 25 · 25 · 25 · 35 · 55 · 15 · 15 · 15 · 5 · 20 · 5 · 15 · 25 · 60 · 60 · 35 · 35 |
| wickThr | 0.3 · 0.3 · 0.7 · 0.45 · 0.4 · 0.45 · 0.35 · 0.6 · 0.6 · 0.6 · 0.55 · 0.7 · 0.3 · 0.4 · 0.4 · 0.5 · 0.5 · 0.45 · 0.35 · 0.5 · 0.7 · 0.7 · 0.5 · 0.7 · 0.6 · 0.6 · 0.6 · 0.45 · 0.55 · 0.45 · 0.5 · 0.7 · 0.65 · 0.65 · 0.4 · 0.4 |
| cooldownBars | 16 · 16 · 6 · 5 · 10 · 23 · 8 · 19 · 19 · 19 · 4 · 14 · 16 · 13 · 7 · 14 · 20 · 12 · 17 · 11 · 14 · 14 · 11 · 23 · 6 · 9 · 9 · 23 · 5 · 10 · 20 · 14 · 13 · 13 · 7 · 7 |
| volZThr | -0.3 · -0.3 · 0.7 · 0.2 · 0.7 · 1 · 1.4 · -0.3 · -0.3 · -0.3 · 0.9 · 0.3 · -0.3 · 0.7 · -0.4 · 0.2 · 1.1 · 0.8 · -0.3 · 0.3 · 0.3 · 0.3 · 1.1 · 1.3 · 0.2 · 1.3 · 1.3 · 0.1 · 1.3 · 0.3 · 0.3 · 0.3 · 0.3 · 0.3 · 0.6 · 0.6 |
| htfEmaLen | 70 · 70 · 50 · 65 · 50 · 75 · 90 · 25 · 25 · 25 · 20 · 10 · 70 · 20 · 55 · 20 · 45 · 90 · 75 · 95 · 10 · 10 · 65 · 70 · 95 · 95 · 95 · 100 · 50 · 20 · 40 · 10 · 10 · 10 · 20 · 20 |
| atrStopMult | 0.9 · 0.9 · 1.1 · 1.6 · 2.1 · 2.3 · 2 · 1.4 · 1.4 · 1.4 · 1.8 · 1.8 · 0.9 · 2 · 1.7 · 1 · 1 · 2.1 · 2.7 · 1.8 · 1.8 · 1.8 · 2.7 · 2 · 1.6 · 3.5 · 3.5 · 1.1 · 0.9 · 1.9 · 1.5 · 1.8 · 2.8 · 2.8 · 1.4 · 1.4 |
| atrTrailMult | off · off · 4 · off · 1.1 · 1.5 · 2.5 · 3.3 · 3.3 · 3.3 · off · 2.3 · off · off · off · off · 4 · 1.5 · 1.6 · 2.2 · 2.3 · 2.3 · 2.4 · 1.4 · 2.8 · off · off · 1.2 · off · 1.4 · 2.1 · 2.3 · 0.9 · 0.9 · 1.3 · 1.3 |
| tp1AtrMult | 1.6 · 1.6 · 2.1 · 1.4 · 1.2 · 1.2 · 0.6 · 2.6 · 2.6 · 2.6 · 2.6 · 1.3 · 1.6 · 0.5 · 0.9 · 2.2 · 1.2 · 1.7 · 2.3 · 1.7 · 1.3 · 1.3 · 1.8 · 1 · 0.6 · 1.1 · 1.1 · 1.9 · 3 · 2.2 · 1.8 · 1.3 · 2.3 · 2.3 · 2.6 · 2.6 |
| tp1QtyPct | 20 · 20 · 70 · 70 · 50 · 20 · 50 · 80 · 80 · 80 · 80 · 50 · 20 · 80 · 40 · 40 · 70 · 60 · 50 · 70 · 50 · 50 · 40 · 70 · 50 · 80 · 80 · 30 · 50 · 30 · 20 · 50 · 70 · 70 · 20 · 20 |
| useTP1 | true · true · true · false · true · true · true · true · true · true · true · true · true · true · true · true · true · true · false · false · true · true · false · true · false · false · false · false · false · true · true · true · false · false · false · false |
| useMicroShock | true · true · false · true · true · false · true · true · true · true · true · false · true · true · false · true · true · false · true · false · false · false · true · true · false · true · true · true · true · true · false · false · false · false · false · false |
| highActivityMode | false · false · false · true · true · true · true · false · false · false · false · true · false · false · true · false · true · false · true · false · true · true · true · false · false · false · false · true · false · false · false · true · true · true · true · true |
| htfSlopeMode | htf · htf · chart · chart · htf · htf · htf · htf · htf · htf · htf · chart · htf · htf · chart · htf · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · chart · htf · htf · htf · htf · chart · chart · chart · chart · chart |
| allowShort | false · false · true · false · true · true · true · false · false · false · true · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · false · true · false · true · true · false · false · false · false · false |

## 5. Exploration : jeux les plus réguliers sur l'ensemble des tests

Classement par Sharpe de test moyen sur tous les plis. **Ce classement est fait après coup sur toute la période** : il sert à formuler des hypothèses, pas à les valider.

| rang | Sharpe test moyen | plis positifs | jeu |
| ---: | ---: | ---: | --- |
| 1 | 1.35 | 27/36 | kMicro=1.6, kMain=2.6, volWin=200, rangeWin=25, wickThr=0.7, cooldownBars=14, volZThr=0.3, htfEmaLen=10, atrStopMult=1.8, atrTrailMult=2.3, tp1AtrMult=1.3, tp1QtyPct=50, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 2 | 1.11 | 28/36 | kMicro=2.4, kMain=1.8, volWin=150, rangeWin=35, wickThr=0.6, cooldownBars=15, volZThr=-0.5, htfEmaLen=40, atrStopMult=1.6, sans trailing, tp1AtrMult=1.5, tp1QtyPct=70, useTP1=false, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 3 | 1.07 | 27/36 | kMicro=2.3, kMain=2.4, volWin=100, rangeWin=25, wickThr=0.45, cooldownBars=5, volZThr=0.2, htfEmaLen=65, atrStopMult=1.6, sans trailing, tp1AtrMult=1.4, tp1QtyPct=70, useTP1=false, useMicroShock=true, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 4 | 1.05 | 24/36 | kMicro=1.2, kMain=2.4, volWin=190, rangeWin=25, wickThr=0.6, cooldownBars=5, volZThr=0.2, htfEmaLen=70, atrStopMult=1.6, sans trailing, tp1AtrMult=1.9, tp1QtyPct=60, useTP1=false, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 5 | 1.03 | 27/36 | kMicro=1.8, kMain=3.4, volWin=150, rangeWin=15, wickThr=0.6, cooldownBars=4, volZThr=0.5, htfEmaLen=50, atrStopMult=2.9, atrTrailMult=1.1, tp1AtrMult=1.5, tp1QtyPct=40, useTP1=false, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 6 | 1.03 | 22/36 | kMicro=2.3, kMain=3.1, volWin=160, rangeWin=60, wickThr=0.3, cooldownBars=22, volZThr=-0.5, htfEmaLen=70, atrStopMult=1.8, sans trailing, tp1AtrMult=1.4, tp1QtyPct=60, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 7 | 1.01 | 26/36 | kMicro=2.4, kMain=3.3, volWin=150, rangeWin=40, wickThr=0.35, cooldownBars=19, volZThr=0.3, htfEmaLen=50, atrStopMult=1.9, sans trailing, tp1AtrMult=2.6, tp1QtyPct=20, useTP1=false, useMicroShock=true, highActivityMode=false, htfSlopeMode=htf, longs seuls |
| 8 | 1.00 | 26/36 | kMicro=1.8, kMain=2.7, volWin=110, rangeWin=15, wickThr=0.6, cooldownBars=12, volZThr=0.8, htfEmaLen=50, atrStopMult=1.6, atrTrailMult=1.7, tp1AtrMult=0.8, tp1QtyPct=40, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=chart, long+short |
| 9 | 0.99 | 27/36 | kMicro=2.2, kMain=2.7, volWin=80, rangeWin=60, wickThr=0.35, cooldownBars=17, volZThr=-0.3, htfEmaLen=75, atrStopMult=2.7, atrTrailMult=1.6, tp1AtrMult=2.3, tp1QtyPct=50, useTP1=false, useMicroShock=true, highActivityMode=true, htfSlopeMode=chart, longs seuls |
| 10 | 0.93 | 24/36 | kMicro=1.9, kMain=2.8, volWin=150, rangeWin=50, wickThr=0.35, cooldownBars=10, volZThr=0.8, htfEmaLen=65, atrStopMult=2.4, atrTrailMult=2.1, tp1AtrMult=2.9, tp1QtyPct=60, useTP1=true, useMicroShock=true, highActivityMode=false, htfSlopeMode=chart, longs seuls |
| 11 | 0.92 | 21/36 | kMicro=2.1, kMain=2.3, volWin=170, rangeWin=30, wickThr=0.3, cooldownBars=4, volZThr=0.3, htfEmaLen=30, atrStopMult=2.8, sans trailing, tp1AtrMult=2.5, tp1QtyPct=20, useTP1=true, useMicroShock=false, highActivityMode=true, htfSlopeMode=htf, longs seuls |
| 12 | 0.90 | 21/36 | kMicro=2.1, kMain=2.3, volWin=160, rangeWin=20, wickThr=0.55, cooldownBars=11, volZThr=0.1, htfEmaLen=60, atrStopMult=2.2, sans trailing, tp1AtrMult=1.6, tp1QtyPct=30, useTP1=true, useMicroShock=false, highActivityMode=false, htfSlopeMode=htf, longs seuls |

