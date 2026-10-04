# Shock Engine · BTC/USD 15 min · paramètres par régime de marché

Entraînement de 2017-01-01 au début de chaque test (fenêtre qui s'agrandit), tests de 3 mois de 2019-01-01 à 2026-10-04. 206 jeux candidats (le script, tes réglages, des variantes et des tirages au hasard). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins 15 positions par moitié) ; régime non tradé si la meilleure note est sous 1. Coûts : script.

## 1. Les régimes

Tendance journalière (clôture contre moyenne 50 jours, pente sur 10 jours) × volatilité (écart type 20 jours contre sa médiane sur un an). Découpage utilisé ici : volatilité seule. Le régime du jour s'applique au lendemain.

| régime | part du temps | rendement BTC moyen par jour | jours |
| --- | ---: | ---: | ---: |
| calme | 51 % | 0.07 % | 1800 |
| agité | 49 % | 0.31 % | 1763 |

## 2. Résultat hors échantillon (fenêtres de test mises bout à bout)

| stratégie | rendement | CAGR | Sharpe | pire baisse | temps en position | bêta BTC | alpha / an | t de l'alpha |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **Algo par régime** (un jeu par régime, ou pas de trade) | 1036 % | 36.8 % | 1.48 | -21 % | 19 % | 0.02 | 32.9 % | 4.00 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 182 % | 14.3 % | 0.71 | -33 % | 12 % | 0.06 | 12.4 % | 1.56 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **62 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **37 %** sur 54 choix.
  - calme : rang moyen 68 % sur 30 plis
  - agité : rang moyen 53 % sur 24 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 149 | 177 | 178 |
| 2019-04 | 149 | — | 178 |
| 2019-07 | 179 | 60 | 139 |
| 2019-10 | 85 | 139 | 139 |
| 2020-01 | 47 | 139 | 139 |
| 2020-04 | 47 | 139 | 178 |
| 2020-07 | 47 | 60 | 178 |
| 2020-10 | 186 | 60 | 61 |
| 2021-01 | 8 | 60 | 61 |
| 2021-04 | 8 | 60 | 127 |
| 2021-07 | 8 | 60 | 186 |
| 2021-10 | 8 | 60 | 60 |
| 2022-01 | 8 | 97 | 60 |
| 2022-04 | 8 | 97 | 186 |
| 2022-07 | 178 | 97 | 186 |
| 2022-10 | 178 | 97 | 186 |
| 2023-01 | 178 | 97 | 106 |
| 2023-04 | 178 | 97 | 106 |
| 2023-07 | 178 | 97 | 106 |
| 2023-10 | 178 | 132 | 106 |
| 2024-01 | 178 | 132 | 106 |
| 2024-04 | 178 | 132 | 106 |
| 2024-07 | 178 | 132 | 106 |
| 2024-10 | 178 | 132 | 106 |
| 2025-01 | 178 | 132 | 106 |
| 2025-04 | 178 | 132 | 106 |
| 2025-07 | 178 | 132 | 61 |
| 2025-10 | 178 | 132 | 61 |
| 2026-01 | 178 | 132 | 178 |
| 2026-04 | 178 | 132 | 106 |
| 2026-07 | 178 | 132 | 106 |
| 2026-10 | 178 | 38 | 106 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 178 · #178 | 2.93 | 654 | kMain=2.9, kMicro=1.7, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.4, cooldownBars=3, volZWin=75, volZThr=1.3, htfEmaLen=70, htfSlopeMode=htf, useCompression=true, compThr=-0.5, atrLen=30, atrStopMult=3.3, sans trailing, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=20, flipMainOnly=true |
| agité | 38 · #38 | 1.13 | 401 | allowShort=false, kMain=2.4, kMicro=2.2, volWin=150, rangeWin=50, wickThr=0.45, cooldownBars=4, volZWin=25, volZThr=-0.5, htfEmaLen=65, htfSlopeMode=htf, useCompression=true, compThr=0.2, atrLen=22, atrStopMult=1.1, atrTrailMult=3.2, tp1AtrMult=0.9, tp1QtyPct=20, flipMainOnly=true |

Meilleur jeu unique sur tout l'historique : 106 · #106 (note 2.06, 692 positions) — allowShort=false, highActivityMode=false, kMain=2.6, kMicro=2.2, volWin=100, rangeWin=40, wickThr=0.4, cooldownBars=9, useVolFilter=false, volZWin=35, volZThr=-0.2, htfEmaLen=55, compThr=-0.6, atrLen=24, atrStopMult=2.7, atrTrailMult=3.7, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=80.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

