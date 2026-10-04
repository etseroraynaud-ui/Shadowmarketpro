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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 260 % | 17.9 % | 0.98 | -21 % | 13 % | 0.04 | 15.8 % | 2.38 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 341 % | 21.1 % | 0.82 | -36 % | 23 % | 0.03 | 21.2 % | 2.13 |
| Script tel quel | -21 % | -3.0 % | -0.02 | -59 % | 15 % | -0.06 | 3.1 % | 0.38 |
| Tes réglages (oct. 2026) | -50 % | -8.4 % | -1.07 | -55 % | 2 % | -0.00 | -8.2 % | -2.89 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **55 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **46 %** sur 50 choix.
  - calme : rang moyen 57 % sur 31 plis
  - agité : rang moyen 53 % sur 19 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 2 | — | 92 |
| 2019-04 | 2 | — | 92 |
| 2019-07 | 2 | — | 178 |
| 2019-10 | 100 | — | 170 |
| 2020-01 | 115 | 204 | 178 |
| 2020-04 | 115 | — | 178 |
| 2020-07 | 186 | 204 | 178 |
| 2020-10 | 186 | 204 | 97 |
| 2021-01 | 183 | 204 | 127 |
| 2021-04 | 186 | 61 | 127 |
| 2021-07 | 186 | 61 | 127 |
| 2021-10 | 35 | 61 | 127 |
| 2022-01 | 136 | 61 | 49 |
| 2022-04 | 136 | 61 | 61 |
| 2022-07 | 136 | 61 | 61 |
| 2022-10 | 136 | 61 | 61 |
| 2023-01 | 136 | 61 | 61 |
| 2023-04 | 170 | 61 | 61 |
| 2023-07 | 35 | 61 | 61 |
| 2023-10 | 170 | 40 | 61 |
| 2024-01 | 178 | 127 | 61 |
| 2024-04 | 170 | 127 | 61 |
| 2024-07 | 178 | 40 | 61 |
| 2024-10 | 178 | 40 | 61 |
| 2025-01 | 178 | 40 | 170 |
| 2025-04 | 178 | 40 | 170 |
| 2025-07 | 178 | 40 | 97 |
| 2025-10 | 170 | 40 | 97 |
| 2026-01 | 170 | 40 | 97 |
| 2026-04 | 178 | 40 | 97 |
| 2026-07 | 178 | 40 | 97 |
| 2026-10 | 178 | 40 | 97 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 178 · #178 | 2.70 | 406 | kMain=2.9, kMicro=1.7, useMicroShock=false, volWin=130, rangeWin=15, wickThr=0.4, cooldownBars=3, volZWin=75, volZThr=1.3, htfEmaLen=70, htfSlopeMode=htf, useCompression=true, compThr=-0.5, atrLen=30, atrStopMult=3.3, sans trailing, useTP1=false, tp1AtrMult=0.8, tp1QtyPct=20, flipMainOnly=true |
| agité | 40 · #40 | 1.41 | 176 | allowShort=false, highActivityMode=false, kMain=3, kMicro=1.2, volWin=170, rangeWin=5, wickThr=0.7, cooldownBars=18, volZWin=25, volZThr=-0.3, HTF 1 j, htfSlopeMode=htf, useCompression=true, compThr=0.3, atrStopMult=1.2, sans trailing, useTP1=false, tp1AtrMult=1.1, tp1QtyPct=30, flipMainOnly=true |

Meilleur jeu unique sur tout l'historique : 97 · #97 (note 2.20, 382 positions) — allowShort=false, highActivityMode=false, kMain=2.5, kMicro=2, volWin=200, rangeWin=45, wickThr=0.45, cooldownBars=3, volZWin=65, volZThr=0, htfEmaLen=80, htfSlopeMode=htf, compThr=-0.1, atrLen=28, atrStopMult=0.8, sans trailing, useTP1=false, tp1AtrMult=0.6, tp1QtyPct=30.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

