# Shock Engine · BTC/USD 30 min · paramètres par régime de marché

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
| **Algo par régime** (un jeu par régime, ou pas de trade) | -21 % | -3.0 % | -0.41 | -29 % | 3 % | -0.00 | -2.8 % | -1.12 |
| Meilleur jeu unique (choisi de la même façon, tous régimes confondus) | 8 % | 1.1 % | 0.23 | -8 % | 1 % | 0.01 | 0.5 % | 0.26 |
| Script tel quel | -21 % | -3.0 % | -0.02 | -59 % | 15 % | -0.06 | 3.1 % | 0.38 |
| Tes réglages (oct. 2026) | -50 % | -8.4 % | -1.07 | -55 % | 2 % | -0.00 | -8.2 % | -2.89 |
| Achat conservé BTC | 2196 % | 49.8 % | 0.97 | -77 % | 100 % | 1.00 | 0.0 % | 0.00 |

Bêta et alpha : régression des rendements quotidiens sur ceux du BTC. L'alpha est ce que la stratégie gagne en plus de son exposition au BTC ; un t au-dessus de 2 commence à être significatif.

## 3. Surajustement

- Pour chaque pli et chaque régime tradé, rang en test du jeu choisi parmi tous les jeux (rendement moyen par position dans ce régime). Rang moyen : **44 %** (50 % = hasard, 100 % = toujours le meilleur).
- Part des choix qui finissent sous la médiane en test (PBO) : **43 %** sur 30 choix.
  - haussier · calme : rang moyen 36 % sur 9 plis
  - neutre · calme : rang moyen 26 % sur 4 plis
  - baissier · calme : rang moyen 53 % sur 17 plis

## 4. Choix par régime, pli par pli

Un numéro = le jeu retenu pour ce régime sur ce pli ; « — » = régime non tradé. Des numéros qui changent à chaque pli signalent du bruit ; un même jeu retenu longtemps signale un edge stable.

| test | haussier · calme | haussier · agité | neutre · calme | neutre · agité | baissier · calme | baissier · agité | jeu unique |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2019-01 | — | — | — | — | — | — | — |
| 2019-04 | — | — | — | — | — | — | — |
| 2019-07 | — | — | — | — | — | — | — |
| 2019-10 | 0 | — | — | — | — | — | — |
| 2020-01 | — | — | — | — | — | — | — |
| 2020-04 | — | — | 11 | — | — | — | — |
| 2020-07 | — | — | — | — | — | — | — |
| 2020-10 | — | — | 1 | — | — | — | — |
| 2021-01 | — | — | — | — | — | — | — |
| 2021-04 | — | — | — | — | 0 | — | — |
| 2021-07 | — | — | — | — | 0 | — | — |
| 2021-10 | — | — | — | — | 0 | — | — |
| 2022-01 | — | — | — | — | 0 | — | 1 |
| 2022-04 | — | — | — | — | — | — | — |
| 2022-07 | — | — | 9 | — | 0 | — | — |
| 2022-10 | — | — | — | — | 0 | — | — |
| 2023-01 | — | — | — | — | 0 | — | — |
| 2023-04 | 0 | — | 9 | — | 0 | — | — |
| 2023-07 | 1 | — | — | — | 0 | — | 1 |
| 2023-10 | 1 | — | — | — | 0 | — | 1 |
| 2024-01 | — | — | — | — | 0 | — | — |
| 2024-04 | 1 | — | — | — | 0 | — | 1 |
| 2024-07 | 1 | — | — | — | 0 | — | 1 |
| 2024-10 | — | — | — | — | 0 | — | 1 |
| 2025-01 | 0 | — | — | — | 0 | — | 1 |
| 2025-04 | — | — | — | — | 0 | — | 1 |
| 2025-07 | 0 | — | — | — | 0 | — | 1 |
| 2025-10 | 0 | — | — | — | 0 | — | 1 |
| 2026-01 | — | — | — | — | 0 | — | 1 |
| 2026-04 | 1 | — | — | — | 0 | — | 1 |
| 2026-07 | 1 | — | — | — | 0 | — | 1 |
| 2026-10 | 1 | — | — | — | 0 | — | 1 |

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
| haussier · calme | 1 · script, longs | 1.33 | 199 | allowShort=false |
| haussier · agité | pas de trade | -0.55 | 198 |  |
| neutre · calme | pas de trade | 0.60 | 212 |  |
| neutre · agité | pas de trade | 0.40 | 63 |  |
| baissier · calme | 0 · script, long + short | 1.14 | 451 | valeurs par défaut |
| baissier · agité | pas de trade | 0.53 | 385 |  |

Rappel : le t-stat est calculé après avoir essayé tous les jeux. Avec autant d'essais, une note de 2 à 3 peut venir du hasard : seule la section 2 (hors échantillon) compte pour juger.

