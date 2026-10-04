# Shock Engine · BTC/USD 30 min · paramètres par régime de marché

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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 72 % | 7.2 % | 0.41 | -32 % | 14 % | 0.00 | 9.4 % | 1.10 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 341 % | 21.1 % | 0.82 | -36 % | 23 % | 0.03 | 21.2 % | 2.13 |
| Script tel quel | -21 % | -3.0 % | -0.02 | -59 % | 15 % | -0.06 | 3.1 % | 0.38 |
| Tes réglages (oct. 2026) | -50 % | -8.4 % | -1.07 | -55 % | 2 % | -0.00 | -8.2 % | -2.89 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **53 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **44 %** sur 72 choix.
  - haussier : rang moyen 55 % sur 25 plis
  - neutre : rang moyen 45 % sur 28 plis
  - baissier : rang moyen 60 % sur 19 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier | neutre | baissier | jeu unique |
| --- | --- | --- | --- | --- |
| 2019-01 | — | 10 | — | 92 |
| 2019-04 | — | 200 | — | 92 |
| 2019-07 | 95 | 200 | — | 178 |
| 2019-10 | 95 | 10 | — | 170 |
| 2020-01 | 95 | 25 | 178 | 178 |
| 2020-04 | 95 | 204 | 130 | 178 |
| 2020-07 | 95 | 204 | 27 | 178 |
| 2020-10 | 95 | 204 | — | 97 |
| 2021-01 | 61 | 23 | — | 127 |
| 2021-04 | 61 | 204 | — | 127 |
| 2021-07 | 61 | 204 | 162 | 127 |
| 2021-10 | 61 | 204 | 162 | 127 |
| 2022-01 | 40 | 204 | 162 | 49 |
| 2022-04 | 61 | 106 | 162 | 61 |
| 2022-07 | 61 | 106 | 2 | 61 |
| 2022-10 | 40 | 23 | 10 | 61 |
| 2023-01 | 93 | 106 | 10 | 61 |
| 2023-04 | 93 | 106 | 10 | 61 |
| 2023-07 | 93 | 106 | 20 | 61 |
| 2023-10 | 93 | 106 | 10 | 61 |
| 2024-01 | 127 | 106 | 10 | 61 |
| 2024-04 | 127 | 106 | 10 | 61 |
| 2024-07 | 127 | 106 | 10 | 61 |
| 2024-10 | 127 | 106 | 7 | 61 |
| 2025-01 | 127 | 106 | 7 | 170 |
| 2025-04 | 127 | 106 | 7 | 170 |
| 2025-07 | 127 | 106 | 7 | 97 |
| 2025-10 | 127 | 90 | 99 | 97 |
| 2026-01 | 127 | 90 | 99 | 97 |
| 2026-04 | 127 | 90 | 99 | 97 |
| 2026-07 | 127 | 90 | 99 | 97 |
| 2026-10 | 40 | 23 | 99 | 97 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| haussier | 40 · #40 | 1.91 | 304 | allowShort=false, highActivityMode=false, kMain=3, kMicro=1.2, volWin=170, rangeWin=5, wickThr=0.7, cooldownBars=18, volZWin=25, volZThr=-0.3, HTF 1 j, htfSlopeMode=htf, useCompression=true, compThr=0.3, atrStopMult=1.2, sans trailing, useTP1=false, tp1AtrMult=1.1, tp1QtyPct=30, flipMainOnly=true |
| neutre | 23 · #23 | 1.71 | 180 | highActivityMode=false, kMain=2.6, kMicro=2, volWin=140, rangeWin=30, wickThr=0.45, cooldownBars=18, volZWin=50, volZThr=1.1, htfEmaLen=60, compThr=0.4, atrLen=30, atrStopMult=1.4, sans trailing, tp1AtrMult=2.5, flipMainOnly=true |
| baissier | 99 · #99 | 1.45 | 37 | allowShort=false, highActivityMode=false, kMain=2.7, volWin=150, rangeWin=60, wickThr=0.55, volZWin=40, volZThr=1.5, HTF 3 j, htfEmaLen=75, htfSlopeMode=htf, compThr=-0.2, atrLen=28, atrStopMult=3, atrTrailMult=1.2, tp1AtrMult=1.9, tp1QtyPct=30 |

Meilleur jeu unique sur tout l'historique : 97 · #97 (note 2.20, 382 positions) — allowShort=false, highActivityMode=false, kMain=2.5, kMicro=2, volWin=200, rangeWin=45, wickThr=0.45, cooldownBars=3, volZWin=65, volZThr=0, htfEmaLen=80, htfSlopeMode=htf, compThr=-0.1, atrLen=28, atrStopMult=0.8, sans trailing, useTP1=false, tp1AtrMult=0.6, tp1QtyPct=30.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

