# Shock Engine · BTC/USD 15 min · paramètres par régime de marché

Entraînement de 2017-01-01 au début de chaque test (fenêtre qui s'agrandit), tests de 3 mois de 2019-01-01 à 2026-10-04. 12 jeux candidats (menu court de configurations lisibles). Dans chaque régime, note d'un jeu = plus petit t-stat de ses rendements par position sur les deux moitiés de l'entraînement (au moins 15 positions par moitié) ; régime non tradé si la meilleure note est sous 1. Coûts : script.

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
| **Algo par régime** (un jeu par régime, ou pas de trade) | -3 % | -0.4 % | -0.08 | -19 % | 1 % | -0.00 | -0.1 % | -0.08 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 3 % | 0.4 % | 0.19 | -5 % | 0 % | 0.00 | 0.3 % | 0.38 |
| Script tel quel | -68 % | -13.7 % | -0.56 | -79 % | 11 % | -0.08 | -7.4 % | -0.95 |
| Tes réglages (oct. 2026) | -29 % | -4.3 % | -0.58 | -35 % | 1 % | -0.01 | -3.5 % | -1.37 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **41 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **53 %** sur 17 choix.
  - haussier · calme : rang moyen 30 % sur 4 plis
  - baissier · calme : rang moyen 51 % sur 8 plis
  - baissier · agité : rang moyen 32 % sur 5 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier · calme | haussier · agité | neutre · calme | neutre · agité | baissier · calme | baissier · agité | jeu unique |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2019-01 | — | — | — | — | — | — | — |
| 2019-04 | — | — | — | — | — | — | — |
| 2019-07 | — | — | — | — | 9 | — | — |
| 2019-10 | — | — | — | — | 9 | — | — |
| 2020-01 | — | — | — | — | 9 | — | — |
| 2020-04 | — | — | — | — | 9 | — | — |
| 2020-07 | — | — | — | — | 9 | — | — |
| 2020-10 | — | — | — | — | 9 | — | — |
| 2021-01 | — | — | — | — | 9 | 1 | — |
| 2021-04 | — | — | — | — | 9 | 1 | — |
| 2021-07 | — | — | — | — | 9 | 1 | — |
| 2021-10 | — | — | — | — | 9 | 1 | — |
| 2022-01 | — | — | — | — | 11 | 1 | — |
| 2022-04 | — | — | — | — | — | 1 | — |
| 2022-07 | — | — | — | — | — | 1 | — |
| 2022-10 | — | — | — | — | — | — | — |
| 2023-01 | — | — | — | — | — | — | — |
| 2023-04 | — | — | — | — | — | — | — |
| 2023-07 | 1 | — | — | — | — | — | — |
| 2023-10 | — | — | — | — | — | — | — |
| 2024-01 | — | — | — | — | — | — | — |
| 2024-04 | 1 | — | — | — | — | — | — |
| 2024-07 | 1 | — | — | — | — | — | — |
| 2024-10 | — | — | — | — | — | — | 1 |
| 2025-01 | — | — | — | — | — | — | — |
| 2025-04 | — | — | — | — | — | — | 1 |
| 2025-07 | — | — | — | — | — | — | — |
| 2025-10 | — | — | — | — | — | — | 1 |
| 2026-01 | — | — | — | — | — | — | 1 |
| 2026-04 | 1 | — | — | — | — | — | — |
| 2026-07 | 1 | — | — | — | — | — | — |
| 2026-10 | 1 | — | — | — | — | — | — |

Numéros du menu :

- 0 : script, long + short
- 1 : script, longs
- 2 : script, shorts
- 3 : tes réglages, long + short
- 4 : tes réglages, longs
- 5 : tes réglages, shorts
- 6 : tes réglages + filtre 60 min, long + short
- 7 : tes réglages + filtre 60 min, longs
- 8 : tes réglages + filtre 60 min, shorts
- 9 : script sélectif (z > 1,8, cooldown 12), long + short
- 10 : script sélectif (z > 1,8, cooldown 12), longs
- 11 : script sélectif (z > 1,8, cooldown 12), shorts

## 5. Réglages que l'algo utiliserait aujourd'hui (entraînés sur tout l'historique)

| régime | jeu | note (t-stat min des deux moitiés) | positions | réglages (écarts au script) |
| --- | --- | ---: | ---: | --- |
| haussier · calme | 1 · script, longs | 1.23 | 256 | allowShort=false |
| haussier · agité | pas de trade | 0.17 | 240 |  |
| neutre · calme | pas de trade | -0.21 | 355 |  |
| neutre · agité | pas de trade | 0.53 | 88 |  |
| baissier · calme | pas de trade | 0.27 | 118 |  |
| baissier · agité | pas de trade | 0.36 | 122 |  |

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

