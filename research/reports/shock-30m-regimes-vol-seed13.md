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
| **Algo par régime** (un jeu par régime, ou pas de trade) | 6 % | 0.8 % | 0.13 | -35 % | 14 % | 0.04 | -0.3 % | -0.04 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 13 % | 1.5 % | 0.18 | -43 % | 12 % | 0.04 | 0.4 % | 0.07 |
| Script tel quel | -21 % | -3.0 % | -0.02 | -59 % | 15 % | -0.06 | 3.1 % | 0.38 |
| Tes réglages (oct. 2026) | -50 % | -8.4 % | -1.07 | -55 % | 2 % | -0.00 | -8.2 % | -2.89 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **49 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **52 %** sur 48 choix.
  - calme : rang moyen 50 % sur 31 plis
  - agité : rang moyen 47 % sur 17 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | calme | agité | jeu unique |
| --- | --- | --- | --- |
| 2019-01 | 89 | — | — |
| 2019-04 | 89 | — | 17 |
| 2019-07 | 123 | — | 17 |
| 2019-10 | 123 | — | 17 |
| 2020-01 | 123 | — | 123 |
| 2020-04 | 40 | — | 123 |
| 2020-07 | 0 | 83 | 176 |
| 2020-10 | 0 | 83 | — |
| 2021-01 | 84 | 83 | 146 |
| 2021-04 | 84 | 83 | 91 |
| 2021-07 | 123 | 83 | 91 |
| 2021-10 | 120 | 83 | 91 |
| 2022-01 | 17 | 91 | 91 |
| 2022-04 | 17 | 91 | 17 |
| 2022-07 | 123 | 91 | 91 |
| 2022-10 | 17 | 91 | 91 |
| 2023-01 | 17 | 91 | 91 |
| 2023-04 | 132 | 91 | 91 |
| 2023-07 | 149 | 91 | 91 |
| 2023-10 | 149 | 26 | 174 |
| 2024-01 | 149 | 26 | 17 |
| 2024-04 | 149 | 26 | 17 |
| 2024-07 | 120 | 26 | 17 |
| 2024-10 | 120 | 26 | 17 |
| 2025-01 | 120 | — | 17 |
| 2025-04 | 120 | — | 17 |
| 2025-07 | 120 | — | 17 |
| 2025-10 | 17 | — | 17 |
| 2026-01 | 17 | 91 | 17 |
| 2026-04 | 149 | 91 | 114 |
| 2026-07 | 149 | 26 | 114 |
| 2026-10 | 149 | — | 114 |

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| calme | 149 · #149 | 2.94 | 512 | highActivityMode=false, kMain=3.3, useMicroShock=false, volWin=170, rangeWin=35, wickThr=0.35, cooldownBars=24, volZWin=40, volZThr=1.2, htfEmaLen=15, atrLen=18, atrStopMult=2.2, atrTrailMult=0.8, useTP1=false, tp1AtrMult=0.5, tp1QtyPct=30 |
| agité | pas de trade | 0.91 | 190 |  |

Meilleur jeu unique sur tout l'historique : 114 · #114 (note 1.98, 382 positions) — allowShort=false, kMain=3, kMicro=1.9, useMicroShock=false, volWin=110, rangeWin=25, cooldownBars=12, volZWin=60, volZThr=0, useHTF=false, htfEmaLen=100, htfSlopeMode=htf, useCompression=true, compThr=-0.9, atrLen=30, atrStopMult=2.4, atrTrailMult=2.7, tp1AtrMult=1.5, tp1QtyPct=20.

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

