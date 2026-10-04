# Shock Engine · BTC/USD 30 min · paramètres par régime de marché

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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 4 % | 0.5 % | 0.10 | -26 % | 11 % | 0.03 | -0.2 % | -0.05 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 148 % | 12.4 % | 0.66 | -29 % | 21 % | 0.06 | 10.2 % | 1.37 |
| Script tel quel | -21 % | -3.0 % | -0.02 | -59 % | 15 % | -0.06 | 3.1 % | 0.38 |
| Tes réglages (oct. 2026) | -50 % | -8.4 % | -1.07 | -55 % | 2 % | -0.00 | -8.2 % | -2.89 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **45 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **58 %** sur 45 choix.
  - calme : rang moyen 46 % sur 30 plis
  - agité : rang moyen 43 % sur 15 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 40 | — | — |
| 2019-04 | 40 | — | 41 |
| 2019-07 | 2 | 61 | 41 |
| 2019-10 | 55 | — | 41 |
| 2020-01 | 146 | — | 41 |
| 2020-04 | 200 | — | 162 |
| 2020-07 | 200 | — | 180 |
| 2020-10 | 200 | — | 150 |
| 2021-01 | 201 | 71 | 150 |
| 2021-04 | 200 | 71 | 150 |
| 2021-07 | 201 | 71 | 150 |
| 2021-10 | 40 | 130 | 66 |
| 2022-01 | 84 | 130 | 66 |
| 2022-04 | 70 | 29 | 66 |
| 2022-07 | 84 | 29 | 201 |
| 2022-10 | 84 | 29 | 201 |
| 2023-01 | 70 | 130 | 201 |
| 2023-04 | 84 | 130 | 201 |
| 2023-07 | 154 | 130 | 201 |
| 2023-10 | 70 | 130 | 201 |
| 2024-01 | 70 | 122 | 180 |
| 2024-04 | 70 | 122 | 180 |
| 2024-07 | 70 | 130 | 180 |
| 2024-10 | 70 | 29 | 180 |
| 2025-01 | 70 | 130 | 180 |
| 2025-04 | 70 | — | 180 |
| 2025-07 | 70 | 130 | 180 |
| 2025-10 | 154 | 29 | 180 |
| 2026-01 | 154 | — | 124 |
| 2026-04 | 154 | — | 180 |
| 2026-07 | 201 | — | 124 |
| 2026-10 | 120 | 146 | 180 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 120 · #120 | 2.22 | 176 | kMain=3.1, kMicro=1.2, useMicroShock=false, volWin=170, rangeWin=50, wickThr=0.7, cooldownBars=15, volZWin=65, volZThr=0, useHTF=false, HTF 4 h, htfEmaLen=35, compThr=0.3, atrStopMult=3.1, sans trailing, tp1AtrMult=1.6, tp1QtyPct=60, flipMainOnly=true |
| agité | pas de trade | 1.00 | 284 |  |

Meilleur jeu unique sur tout l'historique : 180 · #180 (note 2.02, 307 positions) — allowShort=false, highActivityMode=false, kMain=3.4, kMicro=1.9, volWin=200, rangeWin=50, cooldownBars=4, volZWin=40, volZThr=0.5, HTF 4 h, htfEmaLen=10, htfSlopeMode=htf, atrLen=30, atrStopMult=1.7, sans trailing, useTP1=false, tp1AtrMult=0.9, tp1QtyPct=20.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

