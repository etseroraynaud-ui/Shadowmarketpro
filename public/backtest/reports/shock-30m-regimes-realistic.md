# Shock Engine · BTC/USD 30 min · paramètres par régime de marché

Entraînement de 2017-01-01 au début de chaque test (fenêtre qui s'agrandit), tests de 3 mois de 2019-01-01 à 2026-10-04. 206 jeux candidats (le script, tes réglages, des variantes et des tirages au hasard). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins 15 positions par moitié) ; régime non tradé si la meilleure note est sous 1. Coûts : realistic.

## 1. Les régimes

Tendance journalière (clôture contre moyenne 50 jours, pente sur 10 jours) × volatilité (écart type 20 jours contre sa médiane sur un an). Le régime du jour s'applique au lendemain.

| régime | part du temps | rendement BTC moyen par jour | jours |
| --- | ---: | ---: | ---: |
| haussier · calme | 21 % | 0.21 % | 764 |
| haussier · agité | 24 % | 0.49 % | 858 |
| neutre · calme | 13 % | 0.05 % | 454 |
| neutre · agité | 9 % | 0.32 % | 306 |
| baissier · calme | 16 % | -0.08 % | 582 |
| baissier · agité | 17 % | 0.05 % | 599 |

## 2. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | pire baisse | temps en position | bêta BTC | alpha / an | t de l'alpha |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Algo par régime** (un jeu par régime, ou pas de trade) | 62 % | 6.4 % | 0.41 | -25 % | 12 % | 0.01 | 7.8 % | 1.10 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 178 % | 14.1 % | 0.60 | -38 % | 24 % | 0.02 | 15.9 % | 1.55 |
| Script tel quel | -87 % | -23.0 % | -1.03 | -89 % | 15 % | -0.06 | -20.2 % | -2.48 |
| Tes réglages (oct. 2026) | -59 % | -11.0 % | -1.40 | -62 % | 2 % | -0.00 | -11.1 % | -3.81 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **52 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **43 %** sur 74 choix.
  - haussier · calme : rang moyen 56 % sur 26 plis
  - haussier · agité : rang moyen 53 % sur 10 plis
  - neutre · calme : rang moyen 59 % sur 22 plis
  - baissier · calme : rang moyen 34 % sur 12 plis
  - baissier · agité : rang moyen 38 % sur 4 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier · calme | haussier · agité | neutre · calme | neutre · agité | baissier · calme | baissier · agité | jeu unique |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2019-01 | 152 | — | — | — | — | — | 92 |
| 2019-04 | — | — | — | — | — | — | 92 |
| 2019-07 | 129 | — | — | — | — | — | 178 |
| 2019-10 | 152 | — | — | — | — | — | 178 |
| 2020-01 | 100 | — | — | — | — | — | 178 |
| 2020-04 | 149 | — | 25 | — | 178 | — | 178 |
| 2020-07 | 149 | — | — | — | 178 | — | 178 |
| 2020-10 | 149 | — | 25 | — | 186 | — | 97 |
| 2021-01 | 149 | 181 | 175 | — | 186 | — | 127 |
| 2021-04 | 149 | 61 | 175 | — | — | — | 127 |
| 2021-07 | 149 | 61 | 175 | — | — | 201 | 127 |
| 2021-10 | 172 | 61 | 184 | — | 178 | 201 | 127 |
| 2022-01 | 172 | 40 | 47 | — | 178 | — | 49 |
| 2022-04 | 178 | 61 | 47 | — | — | — | 61 |
| 2022-07 | 178 | 61 | 47 | — | 16 | — | 61 |
| 2022-10 | 82 | 61 | 25 | — | 16 | — | 61 |
| 2023-01 | 82 | 61 | 47 | — | 190 | — | 61 |
| 2023-04 | 178 | 127 | 25 | — | 190 | — | 61 |
| 2023-07 | 82 | 127 | 47 | — | 190 | — | 61 |
| 2023-10 | 93 | 127 | 147 | — | 190 | — | 61 |
| 2024-01 | 178 | 127 | 47 | — | 190 | — | 61 |
| 2024-04 | 82 | 127 | 147 | — | 190 | — | 61 |
| 2024-07 | 82 | 127 | 147 | — | 10 | — | 61 |
| 2024-10 | 82 | 127 | 47 | — | 138 | — | 61 |
| 2025-01 | 82 | 40 | 47 | — | 138 | — | 61 |
| 2025-04 | 82 | — | 47 | — | 138 | — | 61 |
| 2025-07 | 82 | 40 | 47 | — | — | — | 61 |
| 2025-10 | 82 | 40 | 47 | — | 178 | — | 97 |
| 2026-01 | 82 | 40 | 47 | — | — | 204 | 97 |
| 2026-04 | 82 | 40 | 47 | — | 190 | 204 | 97 |
| 2026-07 | 178 | 40 | 47 | — | 190 | — | 97 |
| 2026-10 | 178 | 40 | 47 | — | 190 | — | 97 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| haussier · calme | 178 · #178 | 2.04 | 184 | kMain=2.9, kMicro=1.7, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.4, cooldownBars=3, volZWin=75, volZThr=1.3, htfEmaLen=70, htfSlopeMode=htf, useCompression=true, compThr=-0.5, atrLen=30, atrStopMult=3.3, sans trailing, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=20, flipMainOnly=true |
| haussier · agité | 40 · #40 | 1.28 | 164 | allowShort=false, highActivityMode=false, kMain=3, kMicro=1.2, volWin=170, rangeWin=5, wickThr=0.7, cooldownBars=18, volZWin=25, volZThr=-0.3, HTF 1 j, htfSlopeMode=htf, useCompression=true, compThr=0.3, atrStopMult=1.2, sans trailing, useTP1=false, tp1AtrMult=1.1, tp1QtyPct=30, flipMainOnly=true |
| neutre · calme | 47 · #47 | 1.68 | 108 | highActivityMode=false, kMain=2.9, kMicro=1.8, useMicroShock=false, volWin=140, rangeWin=50, wickThr=0.45, cooldownBars=20, volZWin=50, volZThr=1.5, HTF 4 h, htfEmaLen=80, htfSlopeMode=htf, compThr=-0.5, atrLen=28, atrStopMult=2.8, atrTrailMult=1.3, useTP1=false, tp1AtrMult=0.9 |
| neutre · agité | pas de trade | 0.83 | 58 |  |
| baissier · calme | 190 · #190 | 1.28 | 81 | kMicro=2.3, useMicroShock=false, volWin=200, rangeWin=55, wickThr=0.7, cooldownBars=8, volZWin=45, volZThr=-0.2, useHTF=false, HTF 1 j, htfEmaLen=15, useCompression=true, compThr=0.1, atrLen=28, atrStopMult=2.8, sans trailing, useTP1=false, tp1AtrMult=2.2, tp1QtyPct=60 |
| baissier · agité | pas de trade | 0.52 | 67 |  |

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

