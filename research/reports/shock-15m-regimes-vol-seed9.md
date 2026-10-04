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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 17 % | 2.1 % | 0.22 | -23 % | 7 % | 0.01 | 2.3 % | 0.45 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 54 % | 5.7 % | 0.50 | -12 % | 4 % | 0.03 | 4.7 % | 1.05 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **52 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **44 %** sur 57 choix.
  - calme : rang moyen 48 % sur 31 plis
  - agité : rang moyen 56 % sur 26 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 74 | 34 | 84 |
| 2019-04 | 74 | 61 | 34 |
| 2019-07 | 74 | 158 | 158 |
| 2019-10 | 84 | 158 | 158 |
| 2020-01 | 74 | 134 | 134 |
| 2020-04 | 205 | 158 | 134 |
| 2020-07 | 205 | 158 | 158 |
| 2020-10 | 74 | 158 | 158 |
| 2021-01 | 74 | 32 | 134 |
| 2021-04 | 74 | 71 | 134 |
| 2021-07 | 138 | 134 | 186 |
| 2021-10 | 205 | 150 | 186 |
| 2022-01 | 205 | 150 | 146 |
| 2022-04 | 205 | 150 | 146 |
| 2022-07 | 84 | 150 | 180 |
| 2022-10 | 84 | 150 | 146 |
| 2023-01 | 49 | 150 | 180 |
| 2023-04 | 49 | 150 | 6 |
| 2023-07 | 49 | 150 | 6 |
| 2023-10 | 49 | 150 | 146 |
| 2024-01 | 49 | 150 | 146 |
| 2024-04 | 49 | 150 | 180 |
| 2024-07 | 49 | 150 | 180 |
| 2024-10 | 49 | 29 | 6 |
| 2025-01 | 49 | 186 | 6 |
| 2025-04 | 49 | 34 | 6 |
| 2025-07 | 39 | 34 | 146 |
| 2025-10 | 39 | 34 | 6 |
| 2026-01 | 39 | 111 | 6 |
| 2026-04 | 201 | 146 | 146 |
| 2026-07 | 201 | 111 | 146 |
| 2026-10 | 39 | 146 | 146 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 39 · #39 | 2.53 | 1777 | kMain=2.5, kMicro=2.2, useMicroShock=false, volWin=100, rangeWin=5, wickThr=0.7, cooldownBars=11, volZThr=0, useHTF=false, HTF 1 j, htfEmaLen=65, htfSlopeMode=htf, compThr=-0.8, atrLen=24, atrStopMult=2.2, atrTrailMult=2.7, useTP1=false, tp1AtrMult=2.4, flipMainOnly=true |
| agité | 146 · #146 | 1.38 | 500 | kMain=3.4, kMicro=2, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.45, cooldownBars=15, volZWin=25, volZThr=-0.3, HTF 1 j, htfEmaLen=100, htfSlopeMode=htf, useCompression=true, compThr=-0.4, atrStopMult=0.9, atrTrailMult=1.9, useTP1=false, tp1AtrMult=0.5, tp1QtyPct=30 |

Meilleur jeu unique sur tout l'historique : 146 · #146 (note 1.88, 1149 positions) — kMain=3.4, kMicro=2, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.45, cooldownBars=15, volZWin=25, volZThr=-0.3, HTF 1 j, htfEmaLen=100, htfSlopeMode=htf, useCompression=true, compThr=-0.4, atrStopMult=0.9, atrTrailMult=1.9, useTP1=false, tp1AtrMult=0.5, tp1QtyPct=30.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

