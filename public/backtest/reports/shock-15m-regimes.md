# Shock Engine · BTC/USD 15 min · paramètres par régime de marché

Entraînement de 2017-01-01 au début de chaque test (fenêtre qui s'agrandit), tests de 3 mois de 2019-01-01 à 2026-10-04. 206 jeux candidats (le script, tes réglages, des variantes et des tirages au hasard). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins 15 positions par moitié) ; régime non tradé si la meilleure note est sous 1. Coûts : script.

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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 92 % | 8.8 % | 0.59 | -38 % | 11 % | 0.02 | 8.9 % | 1.50 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 182 % | 14.3 % | 0.71 | -33 % | 12 % | 0.06 | 12.4 % | 1.56 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **56 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **40 %** sur 99 choix.
  - haussier · calme : rang moyen 59 % sur 23 plis
  - haussier · agité : rang moyen 56 % sur 14 plis
  - neutre · calme : rang moyen 54 % sur 25 plis
  - neutre · agité : rang moyen 69 % sur 8 plis
  - baissier · calme : rang moyen 55 % sur 23 plis
  - baissier · agité : rang moyen 32 % sur 6 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier · calme | haussier · agité | neutre · calme | neutre · agité | baissier · calme | baissier · agité | jeu unique |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2019-01 | 43 | — | — | — | — | — | 178 |
| 2019-04 | 149 | — | — | — | — | — | 178 |
| 2019-07 | 179 | 139 | — | — | 200 | — | 139 |
| 2019-10 | 179 | 139 | — | — | 200 | — | 139 |
| 2020-01 | 179 | 139 | 162 | — | 200 | — | 139 |
| 2020-04 | 179 | 139 | 142 | 23 | 200 | — | 178 |
| 2020-07 | 179 | 181 | 142 | 23 | 200 | — | 178 |
| 2020-10 | 179 | 139 | 129 | 14 | 186 | — | 61 |
| 2021-01 | 39 | 181 | 147 | 14 | 186 | 2 | 61 |
| 2021-04 | 39 | 181 | 147 | 14 | 186 | 134 | 127 |
| 2021-07 | 115 | 181 | 43 | — | 186 | 2 | 186 |
| 2021-10 | 115 | 60 | 129 | — | 186 | 2 | 60 |
| 2022-01 | 168 | 60 | 25 | — | 186 | 2 | 60 |
| 2022-04 | 168 | 60 | 147 | — | 8 | 2 | 186 |
| 2022-07 | 168 | 60 | 147 | — | 23 | 2 | 186 |
| 2022-10 | 168 | 60 | 147 | 23 | 23 | — | 186 |
| 2023-01 | 168 | 60 | 147 | 23 | 23 | — | 106 |
| 2023-04 | 168 | 60 | 147 | 204 | 23 | — | 106 |
| 2023-07 | 168 | 60 | 147 | 204 | 23 | — | 106 |
| 2023-10 | 168 | 60 | 25 | 204 | 23 | — | 106 |
| 2024-01 | 168 | 60 | 147 | 204 | 23 | — | 106 |
| 2024-04 | 168 | — | 47 | 204 | 23 | — | 106 |
| 2024-07 | 168 | 50 | 47 | 204 | 23 | 181 | 106 |
| 2024-10 | 168 | 50 | 147 | 204 | 178 | — | 106 |
| 2025-01 | 168 | 177 | 147 | 204 | 178 | — | 106 |
| 2025-04 | 168 | — | 147 | 204 | 78 | — | 106 |
| 2025-07 | 168 | — | 147 | 204 | 78 | — | 61 |
| 2025-10 | 168 | — | 147 | — | 78 | — | 61 |
| 2026-01 | 168 | — | 147 | — | 178 | — | 178 |
| 2026-04 | 168 | — | 147 | — | 178 | — | 106 |
| 2026-07 | 168 | — | 147 | 204 | 178 | — | 106 |
| 2026-10 | 61 | — | 147 | 178 | 178 | — | 106 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| haussier · calme | 61 · #61 | 2.31 | 98 | allowShort=false, kMain=2.9, kMicro=1.2, volWin=170, rangeWin=45, wickThr=0.6, cooldownBars=15, volZWin=80, volZThr=1.1, HTF 4 h, htfEmaLen=90, htfSlopeMode=htf, useCompression=true, compThr=-0.4, atrLen=20, atrStopMult=2.8, sans trailing, useTP1=false, tp1AtrMult=1.1, tp1QtyPct=70, flipMainOnly=true |
| haussier · agité | pas de trade | 0.95 | 293 |  |
| neutre · calme | 147 · #147 | 1.90 | 235 | highActivityMode=false, kMain=3, kMicro=2.4, useMicroShock=false, volWin=60, rangeWin=50, wickThr=0.55, cooldownBars=10, volZWin=55, volZThr=-0.3, htfEmaLen=35, htfSlopeMode=htf, compThr=-0.4, atrLen=28, atrStopMult=2.7, atrTrailMult=3.1, tp1AtrMult=1.8, tp1QtyPct=60, flipMainOnly=true |
| neutre · agité | 178 · #178 | 1.12 | 89 | kMain=2.9, kMicro=1.7, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.4, cooldownBars=3, volZWin=75, volZThr=1.3, htfEmaLen=70, htfSlopeMode=htf, useCompression=true, compThr=-0.5, atrLen=30, atrStopMult=3.3, sans trailing, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=20, flipMainOnly=true |
| baissier · calme | 178 · #178 | 1.95 | 201 | kMain=2.9, kMicro=1.7, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.4, cooldownBars=3, volZWin=75, volZThr=1.3, htfEmaLen=70, htfSlopeMode=htf, useCompression=true, compThr=-0.5, atrLen=30, atrStopMult=3.3, sans trailing, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=20, flipMainOnly=true |
| baissier · agité | pas de trade | 0.82 | 110 |  |

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

