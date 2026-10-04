# Shock Engine · BTC/USD 15 min · paramètres par régime de marché

Entraînement de 2017-01-01 au début de chaque test (fenêtre qui s'agrandit), tests de 3 mois de 2019-01-01 à 2026-10-04. 206 jeux candidats (le script, tes réglages, des variantes et des tirages au hasard). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins 15 positions par moitié) ; régime non tradé si la meilleure note est sous 1. Coûts : script.

## 1. Les régimes

Tendance journalière (clôture contre moyenne 50 jours, pente sur 10 jours) × volatilité (écart type 20 jours contre sa médiane sur un an). Découpage utilisé ici : tendance seule. Le régime du jour s'applique au lendemain.

| régime | part du temps | rendement BTC moyen par jour | jours |
| --- | ---: | ---: | ---: |
| haussier | 46 % | 0.35 % | 1622 |
| neutre | 21 % | 0.16 % | 760 |
| baissier | 33 % | -0.02 % | 1181 |

## 2. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | pire baisse | temps en position | bêta BTC | alpha / an | t de l'alpha |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Algo par régime** (un jeu par régime, ou pas de trade) | -15 % | -2.0 % | 0.00 | -60 % | 13 % | -0.03 | 1.7 % | 0.22 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 182 % | 14.3 % | 0.71 | -33 % | 12 % | 0.06 | 12.4 % | 1.56 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **58 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **35 %** sur 84 choix.
  - haussier : rang moyen 52 % sur 30 plis
  - neutre : rang moyen 64 % sur 29 plis
  - baissier : rang moyen 58 % sur 25 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier | neutre | baissier | jeu unique |
| --- | --- | --- | --- | --- |
| 2019-01 | 82 | 147 | — | 178 |
| 2019-04 | 82 | 147 | 103 | 178 |
| 2019-07 | 179 | 27 | 147 | 139 |
| 2019-10 | 179 | 142 | 147 | 139 |
| 2020-01 | 179 | 142 | 147 | 139 |
| 2020-04 | 179 | 14 | 200 | 178 |
| 2020-07 | 179 | 14 | 200 | 178 |
| 2020-10 | 179 | 147 | 107 | 61 |
| 2021-01 | 127 | 147 | 107 | 61 |
| 2021-04 | 127 | 14 | 107 | 127 |
| 2021-07 | 60 | 178 | 16 | 186 |
| 2021-10 | 60 | 178 | 16 | 60 |
| 2022-01 | 60 | 47 | 16 | 60 |
| 2022-04 | 60 | 147 | 16 | 186 |
| 2022-07 | 60 | 47 | 16 | 186 |
| 2022-10 | 60 | 147 | 186 | 186 |
| 2023-01 | 60 | 147 | 186 | 106 |
| 2023-04 | 177 | 147 | 186 | 106 |
| 2023-07 | 177 | 147 | 186 | 106 |
| 2023-10 | 177 | 147 | 186 | 106 |
| 2024-01 | 168 | 147 | 186 | 106 |
| 2024-04 | 61 | 147 | 186 | 106 |
| 2024-07 | 61 | 178 | 186 | 106 |
| 2024-10 | 106 | 147 | 186 | 106 |
| 2025-01 | 175 | 147 | 186 | 106 |
| 2025-04 | 61 | 47 | 186 | 106 |
| 2025-07 | 61 | 47 | 186 | 61 |
| 2025-10 | 61 | 147 | 10 | 61 |
| 2026-01 | 61 | 147 | 10 | 178 |
| 2026-04 | 61 | 147 | 106 | 106 |
| 2026-07 | 61 | 147 | 10 | 106 |
| 2026-10 | 61 | 147 | 23 | 106 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| haussier | 61 · #61 | 2.03 | 225 | allowShort=false, kMain=2.9, kMicro=1.2, volWin=170, rangeWin=45, wickThr=0.6, cooldownBars=15, volZWin=80, volZThr=1.1, HTF 4 h, htfEmaLen=90, htfSlopeMode=htf, useCompression=true, compThr=-0.4, atrLen=20, atrStopMult=2.8, sans trailing, useTP1=false, tp1AtrMult=1.1, tp1QtyPct=70, flipMainOnly=true |
| neutre | 147 · #147 | 2.46 | 364 | highActivityMode=false, kMain=3, kMicro=2.4, useMicroShock=false, volWin=60, rangeWin=50, wickThr=0.55, cooldownBars=10, volZWin=55, volZThr=-0.3, htfEmaLen=35, htfSlopeMode=htf, compThr=-0.4, atrLen=28, atrStopMult=2.7, atrTrailMult=3.1, tp1AtrMult=1.8, tp1QtyPct=60, flipMainOnly=true |
| baissier | 23 · #23 | 1.29 | 444 | highActivityMode=false, kMain=2.6, kMicro=2, volWin=140, rangeWin=30, wickThr=0.45, cooldownBars=18, volZWin=50, volZThr=1.1, htfEmaLen=60, compThr=0.4, atrLen=30, atrStopMult=1.4, sans trailing, tp1AtrMult=2.5, flipMainOnly=true |

Meilleur jeu unique sur tout l'historique : 106 · #106 (note 2.06, 692 positions) — allowShort=false, highActivityMode=false, kMain=2.6, kMicro=2.2, volWin=100, rangeWin=40, wickThr=0.4, cooldownBars=9, useVolFilter=false, volZWin=35, volZThr=-0.2, htfEmaLen=55, compThr=-0.6, atrLen=24, atrStopMult=2.7, atrTrailMult=3.7, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=80.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

