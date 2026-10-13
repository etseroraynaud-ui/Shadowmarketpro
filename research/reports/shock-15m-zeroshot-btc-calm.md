# Zéro-shot du Shock Engine · BTC/USD (Bitstamp) · régime calme seul, shorts en régime de tendance baissier

15 min, 2017-01-01 → 2026-10-04 (9.8 ans, préchauffage depuis 2016-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset btc --draws 200 --calm`.

## Données

- 341 941 bougies de 15 min ; 33 suivent une fermeture (masquées pour les entrées) ; 0 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.392 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2020-03-13 02:30 +45.8 · 2017-03-10 21:00 −39.8 · 2019-06-26 20:30 −33.9 · 2020-03-13 02:15 +33.2 · 2020-03-12 10:30 −31.1 · 2020-03-13 01:45 −28.6 · 2019-05-17 03:15 +27.7 · 2021-05-19 13:30 +27.5.
- Plus forts sauts **à l'ouverture** (masqués) : 2022-05-11 09:00 +5.3 · 2022-07-13 12:15 +3.2 · 2017-11-29 20:45 +2.4 · 2025-10-17 13:00 −2.2 · 2024-12-07 04:30 −2.0 · 2022-01-05 10:15 +1.9.

## Verdict (critères fixés avant le test)

**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : oui. Chocs bruts sans tendance : oui.

| critère | entrées complètes | entrées « cœur » |
| --- | --- | --- |
| Étude d'événement des signaux : même critère | oui | oui |
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 685 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 685 | +0.178 | +0.175 | +0.044 à +0.300 | 98 % | +0.251 | +0.124 | 70 % de 10 |
| 4 bougies (1 h) | 685 | +0.363 | +0.354 | +0.149 à +0.556 | 100 % | +0.571 | +0.207 | 70 % de 10 |
| 16 bougies (4 h) | 685 | +0.510 | +0.465 | +0.144 à +0.790 | 99 % | +0.676 | +0.322 | 70 % de 10 |
| 64 bougies (16 h) | 685 | +1.674 | +1.488 | +0.721 à +2.333 | 100 % | +1.914 | +1.198 | 90 % de 10 |

### signaux d'entrée « cœur » · 845 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 845 | +0.148 | +0.146 | +0.035 à +0.251 | 98 % | +0.181 | +0.122 | 80 % de 10 |
| 4 bougies (1 h) | 845 | +0.341 | +0.334 | +0.154 à +0.519 | 100 % | +0.495 | +0.224 | 70 % de 10 |
| 16 bougies (4 h) | 845 | +0.561 | +0.521 | +0.190 à +0.881 | 99 % | +0.691 | +0.405 | 90 % de 10 |
| 64 bougies (16 h) | 845 | +1.640 | +1.468 | +0.806 à +2.263 | 100 % | +1.648 | +1.346 | 90 % de 10 |

### chocs bruts (|z| > seuil du régime) · 11 945 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 11945 | +0.051 | +0.051 | +0.029 à +0.074 | 100 % | +0.032 | +0.070 | 90 % de 10 |
| 4 bougies (1 h) | 11945 | +0.075 | +0.076 | +0.038 à +0.115 | 100 % | +0.075 | +0.078 | 70 % de 10 |
| 16 bougies (4 h) | 11945 | +0.087 | +0.097 | +0.035 à +0.164 | 100 % | +0.064 | +0.130 | 70 % de 10 |
| 64 bougies (16 h) | 11945 | +0.246 | +0.263 | +0.150 à +0.383 | 100 % | +0.272 | +0.254 | 90 % de 10 |

### chocs bruts dans le sens de la tendance 60 min · 7 384 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 7384 | +0.076 | +0.075 | +0.048 à +0.103 | 100 % | +0.061 | +0.090 | 90 % de 10 |
| 4 bougies (1 h) | 7384 | +0.133 | +0.132 | +0.081 à +0.184 | 100 % | +0.150 | +0.114 | 90 % de 10 |
| 16 bougies (4 h) | 7384 | +0.220 | +0.221 | +0.135 à +0.313 | 100 % | +0.223 | +0.219 | 80 % de 10 |
| 64 bougies (16 h) | 7384 | +0.678 | +0.651 | +0.473 à +0.831 | 100 % | +0.789 | +0.515 | 90 % de 10 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 2053 | +0.242 | +0.125 à +0.363 | +0.338 | +0.189 à +0.502 |
| Londres (2 h – 8 h) | 1411 | +0.108 | +0.009 à +0.209 | +0.233 | +0.053 à +0.406 |
| New York matin (8 h – 12 h) | 2066 | +0.186 | +0.070 à +0.302 | +0.354 | +0.128 à +0.583 |
| dont bougie de 8 h 30 (annonces) | 140 | −0.153 | −0.396 à +0.090 | −0.484 | −1.411 à +0.504 |
| New York après-midi (12 h – 18 h) | 1854 | −0.032 | −0.144 à +0.082 | −0.066 | −0.232 à +0.098 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 213 | +0.605 | +0.252 à +0.997 | +0.531 | +0.043 à +1.017 |
| Londres (2 h – 8 h) | 116 | +0.129 | −0.367 à +0.641 | +0.176 | −0.427 à +0.745 |
| New York matin (8 h – 12 h) | 197 | +0.410 | −0.197 à +0.970 | +0.468 | −0.408 à +1.313 |
| dont bougie de 8 h 30 (annonces) | 19 | −0.470 | −1.404 à +0.426 | −2.923 | −5.650 à −0.597 |
| New York après-midi (12 h – 18 h) | 159 | +0.114 | −0.316 à +0.496 | +0.586 | +0.020 à +1.171 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 3967 % | 46.2 % | 1.75 | 2.52 | 2.16 | -24.8 % | 1.86 | 396 | 33 % | 5.28 % | -1.01 % | 5.22 | 3.17 | 87 % | 14 % | 44× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 2754 % | 41.0 % | 1.59 | 2.28 | 1.94 | -26.5 % | 1.55 | 396 | 31 % | 5.40 % | -1.08 % | 4.99 | 3.17 | 96 % | 14 % | 44× | 3.9 % | 0.0 % |
| preset · coûts × 2 | 1903 % | 36.0 % | 1.43 | 2.05 | 1.76 | -28.1 % | 1.28 | 396 | 31 % | 5.35 % | -1.17 % | 4.58 | 3.17 | 107 % | 14 % | 44× | 7.9 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 2754 % | 41.0 % | 1.59 | 2.28 | 1.94 | -26.5 % | 1.55 | 396 | 31 % | 5.40 % | -1.08 % | 4.99 | 3.17 | 96 % | 14 % | 44× | 3.9 % | 0.0 % |
| core · coûts × 0 | 4471 % | 48.0 % | 1.74 | 2.51 | 2.03 | -25.4 % | 1.89 | 465 | 32 % | 5.00 % | -1.01 % | 4.94 | 3.41 | 94 % | 16 % | 51× | 0.0 % | 0.0 % |
| core · coûts × 1 | 2915 % | 41.8 % | 1.56 | 2.24 | 1.82 | -26.9 % | 1.55 | 465 | 31 % | 5.09 % | -1.09 % | 4.68 | 3.41 | 105 % | 16 % | 51× | 4.6 % | 0.0 % |
| core · coûts × 2 | 1888 % | 35.9 % | 1.38 | 1.97 | 1.65 | -28.6 % | 1.25 | 465 | 31 % | 5.07 % | -1.17 % | 4.33 | 3.41 | 119 % | 16 % | 51× | 9.2 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 2915 % | 41.8 % | 1.56 | 2.24 | 1.82 | -26.9 % | 1.55 | 465 | 31 % | 5.09 % | -1.09 % | 4.68 | 3.41 | 105 % | 16 % | 51× | 4.6 % | 0.0 % |
| achat conservé | 8682 % | 58.2 % | 1.01 | — | — | -83.4 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.52, intervalle à 90 % (bootstrap des mois) 1.11 à 1.90, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.75 · × 0,25 → 1.71 · × 0,5 → 1.67 · × 0,75 → 1.63 · × 1 → 1.59. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 8 % | 0.68 | -11.5 % | 6 |
| 2018 | 107 % | 2.49 | -14.3 % | 49 |
| 2019 | 56 % | 1.52 | -15.9 % | 41 |
| 2020 | 21 % | 0.96 | -11.1 % | 35 |
| 2021 | 28 % | 1.42 | -8.4 % | 23 |
| 2022 | 40 % | 1.31 | -21.1 % | 67 |
| 2023 | 59 % | 2.30 | -12.8 % | 61 |
| 2024 | 105 % | 3.42 | -10.3 % | 30 |
| 2025 | 1 % | 0.15 | -12.3 % | 53 |
| 2026 | 14 % | 1.12 | -26.5 % | 31 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 242 | 33 % | 1.02 % | 2.24 |
| calme | short | 154 | 29 % | 0.83 % | 1.12 |

Entrées au hasard (200 tirages, mêmes sorties, 400 trades en médiane) : Sharpe médian 0.46, 95e centile 0.90 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.07 | 5.37 | 360 | 2.155 % | 228 % |
| -1 bougie (utilise le futur) | 2.86 | 4.31 | 361 | 2.001 % | 211 % |
| à l'heure | 1.59 | 1.94 | 396 | 0.947 % | 100 % |
| +1 bougie | 1.54 | 2.00 | 390 | 0.921 % | 97 % |
| +2 bougies | 1.47 | 1.96 | 388 | 0.888 % | 94 % |
| +4 bougies | 1.46 | 1.88 | 384 | 0.869 % | 92 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.47, intervalle à 90 % (bootstrap des mois) 1.09 à 1.88, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.74 · × 0,25 → 1.70 · × 0,5 → 1.65 · × 0,75 → 1.61 · × 1 → 1.56. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 14 % | 0.99 | -8.4 % | 7 |
| 2018 | 82 % | 2.05 | -16.8 % | 62 |
| 2019 | 78 % | 1.91 | -15.9 % | 42 |
| 2020 | 36 % | 1.38 | -11.1 % | 37 |
| 2021 | 14 % | 0.72 | -15.7 % | 37 |
| 2022 | 33 % | 1.10 | -26.8 % | 74 |
| 2023 | 63 % | 2.36 | -14.1 % | 70 |
| 2024 | 103 % | 3.27 | -10.9 % | 40 |
| 2025 | 7 % | 0.48 | -15.3 % | 63 |
| 2026 | 12 % | 0.96 | -26.9 % | 33 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 294 | 32 % | 0.90 % | 2.38 |
| calme | short | 171 | 29 % | 0.69 % | 1.03 |

Entrées au hasard (200 tirages, mêmes sorties, 455 trades en médiane) : Sharpe médian 0.51, 95e centile 0.99 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.16 | 5.02 | 415 | 2.002 % | 243 % |
| -1 bougie (utilise le futur) | 2.96 | 4.24 | 415 | 1.876 % | 227 % |
| à l'heure | 1.56 | 1.82 | 465 | 0.825 % | 100 % |
| +1 bougie | 1.52 | 1.89 | 463 | 0.802 % | 97 % |
| +2 bougies | 1.45 | 1.83 | 458 | 0.772 % | 94 % |
| +4 bougies | 1.44 | 1.81 | 453 | 0.764 % | 93 % |
