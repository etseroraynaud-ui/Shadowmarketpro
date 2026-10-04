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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 165 % | 13.4 % | 0.85 | -15 % | 7 % | 0.01 | 13.2 % | 2.25 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 127 % | 11.1 % | 0.77 | -18 % | 5 % | 0.05 | 8.9 % | 1.65 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **58 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **30 %** sur 61 choix.
  - calme : rang moyen 61 % sur 31 plis
  - agité : rang moyen 55 % sur 30 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 7 | 169 | 169 |
| 2019-04 | 7 | 169 | 129 |
| 2019-07 | 8 | 149 | 169 |
| 2019-10 | 84 | 149 | 169 |
| 2020-01 | 204 | 149 | 204 |
| 2020-04 | 204 | 149 | 204 |
| 2020-07 | 129 | 149 | 204 |
| 2020-10 | 204 | 149 | 204 |
| 2021-01 | 204 | 83 | 83 |
| 2021-04 | 40 | 83 | 83 |
| 2021-07 | 40 | 72 | 83 |
| 2021-10 | 17 | 83 | 83 |
| 2022-01 | 17 | 72 | 19 |
| 2022-04 | 17 | 72 | 19 |
| 2022-07 | 17 | 72 | 19 |
| 2022-10 | 17 | 72 | 17 |
| 2023-01 | 17 | 72 | 17 |
| 2023-04 | 17 | 83 | 17 |
| 2023-07 | 17 | 72 | 17 |
| 2023-10 | 17 | 72 | 17 |
| 2024-01 | 132 | 83 | 17 |
| 2024-04 | 132 | 146 | 17 |
| 2024-07 | 132 | 146 | 17 |
| 2024-10 | 17 | 146 | 17 |
| 2025-01 | 17 | 146 | 17 |
| 2025-04 | 17 | 149 | 149 |
| 2025-07 | 17 | 149 | 149 |
| 2025-10 | 17 | 149 | 149 |
| 2026-01 | 17 | 149 | 149 |
| 2026-04 | 169 | 149 | 149 |
| 2026-07 | 169 | 149 | 169 |
| 2026-10 | 108 | 149 | 149 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 108 · #108 | 2.70 | 364 | allowShort=false, kMain=3.3, kMicro=1.1, rangeWin=35, wickThr=0.45, cooldownBars=11, volZWin=80, volZThr=0.1, useHTF=false, HTF 3 j, htfEmaLen=10, htfSlopeMode=htf, compThr=-1, atrLen=28, atrStopMult=3.1, atrTrailMult=2.1, tp1AtrMult=3, tp1QtyPct=40, flipMainOnly=true |
| agité | 149 · #149 | 1.51 | 671 | highActivityMode=false, kMain=3.3, useMicroShock=false, volWin=170, rangeWin=35, wickThr=0.35, cooldownBars=24, volZWin=40, volZThr=1.2, htfEmaLen=15, atrLen=18, atrStopMult=2.2, atrTrailMult=0.8, useTP1=false, tp1AtrMult=0.5, tp1QtyPct=30 |

Meilleur jeu unique sur tout l'historique : 149 · #149 (note 2.59, 1400 positions) — highActivityMode=false, kMain=3.3, useMicroShock=false, volWin=170, rangeWin=35, wickThr=0.35, cooldownBars=24, volZWin=40, volZThr=1.2, htfEmaLen=15, atrLen=18, atrStopMult=2.2, atrTrailMult=0.8, useTP1=false, tp1AtrMult=0.5, tp1QtyPct=30.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

