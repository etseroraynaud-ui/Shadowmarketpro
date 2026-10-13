# Zéro-shot du Shock Engine · ETH/USDT (Binance) · régime calme seul, shorts en régime de tendance baissier

15 min, 2018-09-01 → 2026-09-30 (8.1 ans, préchauffage depuis 2017-08-17). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset ethusdt --draws 200 --calm`.

## Données

- 283 081 bougies de 15 min ; 23 suivent une fermeture (masquées pour les entrées) ; 17 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.439 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2020-03-13 02:30 +48.6 · 2019-02-24 14:00 −28.9 · 2020-03-13 03:15 +28.6 · 2020-03-12 10:30 −28.2 · 2019-06-26 20:30 −26.3 · 2019-09-24 19:30 −25.4 · 2019-09-24 18:45 −24.9 · 2021-05-19 13:00 −24.1.
- Plus forts sauts **à l'ouverture** (masqués) : 2019-05-15 13:00 +6.8 · 2021-08-13 06:30 +6.7 · 2019-08-15 10:00 −5.3 · 2019-11-25 04:00 −4.6 · 2021-04-25 08:45 +3.8 · 2021-04-20 04:30 +3.2.

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

### signaux d'entrée complets · 663 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 663 | +0.220 | +0.219 | +0.099 à +0.341 | 100 % | +0.141 | +0.301 | 100 % de 9 |
| 4 bougies (1 h) | 663 | +0.338 | +0.335 | +0.147 à +0.533 | 100 % | +0.390 | +0.277 | 89 % de 9 |
| 16 bougies (4 h) | 663 | +0.635 | +0.597 | +0.310 à +0.881 | 100 % | +0.582 | +0.613 | 100 % de 9 |
| 64 bougies (16 h) | 663 | +1.610 | +1.429 | +0.797 à +2.095 | 100 % | +1.391 | +1.470 | 100 % de 9 |

### signaux d'entrée « cœur » · 752 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 752 | +0.181 | +0.181 | +0.078 à +0.287 | 100 % | +0.128 | +0.235 | 100 % de 9 |
| 4 bougies (1 h) | 752 | +0.286 | +0.284 | +0.125 à +0.450 | 100 % | +0.322 | +0.244 | 100 % de 9 |
| 16 bougies (4 h) | 752 | +0.603 | +0.567 | +0.287 à +0.879 | 100 % | +0.575 | +0.560 | 100 % de 9 |
| 64 bougies (16 h) | 752 | +1.642 | +1.468 | +0.831 à +2.177 | 100 % | +1.401 | +1.537 | 100 % de 9 |

### chocs bruts (|z| > seuil du régime) · 9 552 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 9552 | +0.067 | +0.067 | +0.049 à +0.086 | 100 % | +0.088 | +0.046 | 100 % de 9 |
| 4 bougies (1 h) | 9552 | +0.078 | +0.078 | +0.042 à +0.115 | 100 % | +0.122 | +0.036 | 89 % de 9 |
| 16 bougies (4 h) | 9552 | +0.061 | +0.068 | +0.012 à +0.126 | 98 % | +0.084 | +0.052 | 78 % de 9 |
| 64 bougies (16 h) | 9549 | +0.246 | +0.261 | +0.153 à +0.373 | 100 % | +0.364 | +0.160 | 89 % de 9 |

### chocs bruts dans le sens de la tendance 60 min · 5 974 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 5974 | +0.080 | +0.079 | +0.054 à +0.105 | 100 % | +0.106 | +0.056 | 100 % de 9 |
| 4 bougies (1 h) | 5974 | +0.092 | +0.092 | +0.048 à +0.139 | 100 % | +0.121 | +0.065 | 89 % de 9 |
| 16 bougies (4 h) | 5974 | +0.121 | +0.131 | +0.042 à +0.216 | 99 % | +0.149 | +0.114 | 78 % de 9 |
| 64 bougies (16 h) | 5972 | +0.478 | +0.483 | +0.300 à +0.677 | 100 % | +0.661 | +0.321 | 78 % de 9 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 1664 | +0.157 | +0.050 à +0.265 | +0.269 | +0.080 à +0.458 |
| Londres (2 h – 8 h) | 1069 | +0.101 | −0.001 à +0.204 | +0.058 | −0.163 à +0.277 |
| New York matin (8 h – 12 h) | 1666 | +0.142 | +0.047 à +0.234 | +0.384 | +0.215 à +0.580 |
| dont bougie de 8 h 30 (annonces) | 125 | +0.161 | −0.118 à +0.446 | +0.819 | +0.077 à +1.693 |
| New York après-midi (12 h – 18 h) | 1575 | −0.036 | −0.127 à +0.053 | −0.234 | −0.408 à −0.064 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 200 | +0.383 | +0.034 à +0.745 | +0.560 | +0.016 à +1.050 |
| Londres (2 h – 8 h) | 112 | +0.206 | −0.106 à +0.551 | +0.331 | −0.218 à +0.835 |
| New York matin (8 h – 12 h) | 187 | +0.471 | −0.031 à +1.013 | +1.122 | +0.426 à +1.860 |
| dont bougie de 8 h 30 (annonces) | 16 | +0.226 | −0.457 à +1.034 | +0.475 | −1.029 à +2.357 |
| New York après-midi (12 h – 18 h) | 164 | +0.208 | −0.220 à +0.647 | +0.226 | −0.266 à +0.719 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 15842 % | 87.3 % | 2.19 | 3.24 | 3.03 | -25.6 % | 3.41 | 358 | 33 % | 7.39 % | -1.27 % | 5.84 | 3.72 | 78 % | 17 % | 43× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 11490 % | 80.0 % | 2.05 | 3.03 | 2.73 | -26.7 % | 3.00 | 358 | 33 % | 7.43 % | -1.35 % | 5.52 | 3.72 | 83 % | 17 % | 43× | 3.9 % | 0.0 % |
| preset · coûts × 2 | 8324 % | 73.1 % | 1.92 | 2.83 | 2.48 | -28.7 % | 2.55 | 358 | 32 % | 7.46 % | -1.42 % | 5.24 | 3.72 | 88 % | 17 % | 43× | 7.8 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 11490 % | 80.0 % | 2.05 | 3.03 | 2.73 | -26.7 % | 3.00 | 358 | 33 % | 7.43 % | -1.35 % | 5.52 | 3.72 | 83 % | 17 % | 43× | 3.9 % | 0.0 % |
| core · coûts × 0 | 19918 % | 92.6 % | 2.22 | 3.27 | 2.71 | -26.3 % | 3.52 | 389 | 33 % | 7.39 % | -1.27 % | 5.81 | 3.75 | 79 % | 18 % | 48× | 0.0 % | 0.0 % |
| core · coûts × 1 | 14055 % | 84.6 % | 2.08 | 3.06 | 2.46 | -28.3 % | 2.99 | 389 | 32 % | 7.47 % | -1.35 % | 5.55 | 3.75 | 85 % | 18 % | 48× | 4.3 % | 0.0 % |
| core · coûts × 2 | 9906 % | 76.8 % | 1.94 | 2.84 | 2.24 | -30.3 % | 2.53 | 389 | 31 % | 7.50 % | -1.43 % | 5.26 | 3.75 | 91 % | 18 % | 48× | 8.6 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 14055 % | 84.6 % | 2.08 | 3.06 | 2.46 | -28.3 % | 2.99 | 389 | 32 % | 7.47 % | -1.35 % | 5.55 | 3.75 | 85 % | 18 % | 48× | 4.3 % | 0.0 % |
| achat conservé | 850 % | 32.1 % | 0.75 | — | — | -79.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.93, intervalle à 90 % (bootstrap des mois) 1.41 à 2.45, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.19 · × 0,25 → 2.15 · × 0,5 → 2.12 · × 0,75 → 2.09 · × 1 → 2.05. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 224 % | 6.29 | -11.5 % | 20 |
| 2019 | -9 % | -0.12 | -23.9 % | 63 |
| 2020 | 78 % | 1.91 | -20.0 % | 39 |
| 2021 | 60 % | 1.75 | -19.4 % | 29 |
| 2022 | 95 % | 2.12 | -19.7 % | 50 |
| 2023 | 22 % | 0.98 | -12.6 % | 63 |
| 2024 | 66 % | 2.84 | -8.0 % | 17 |
| 2025 | 113 % | 2.77 | -11.9 % | 40 |
| 2026 | 64 % | 2.40 | -16.0 % | 37 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 244 | 33 % | 1.38 % | 2.92 |
| calme | short | 114 | 32 % | 1.83 % | 1.83 |

Entrées au hasard (200 tirages, mêmes sorties, 362.5 trades en médiane) : Sharpe médian 0.78, 95e centile 1.29 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.77 | 8.72 | 308 | 3.512 % | 231 % |
| -1 bougie (utilise le futur) | 3.51 | 8.19 | 313 | 3.211 % | 211 % |
| à l'heure | 2.05 | 2.73 | 358 | 1.521 % | 100 % |
| +1 bougie | 1.91 | 2.45 | 355 | 1.434 % | 94 % |
| +2 bougies | 1.89 | 2.50 | 349 | 1.428 % | 94 % |
| +4 bougies | 1.90 | 2.58 | 340 | 1.488 % | 98 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.95, intervalle à 90 % (bootstrap des mois) 1.43 à 2.44, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.22 · × 0,25 → 2.18 · × 0,5 → 2.15 · × 0,75 → 2.11 · × 1 → 2.08. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 197 % | 5.81 | -13.8 % | 27 |
| 2019 | 17 % | 0.61 | -25.5 % | 64 |
| 2020 | 92 % | 2.11 | -20.0 % | 39 |
| 2021 | 57 % | 1.69 | -19.4 % | 30 |
| 2022 | 95 % | 2.10 | -19.7 % | 54 |
| 2023 | 24 % | 1.01 | -12.4 % | 69 |
| 2024 | 62 % | 2.64 | -8.7 % | 20 |
| 2025 | 126 % | 2.86 | -12.9 % | 43 |
| 2026 | 53 % | 2.08 | -18.2 % | 43 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 272 | 32 % | 1.30 % | 3.06 |
| calme | short | 117 | 32 % | 1.84 % | 1.89 |

Entrées au hasard (200 tirages, mêmes sorties, 387 trades en médiane) : Sharpe médian 0.80, 95e centile 1.36 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.83 | 7.08 | 333 | 3.387 % | 231 % |
| -1 bougie (utilise le futur) | 3.57 | 6.80 | 338 | 3.100 % | 212 % |
| à l'heure | 2.08 | 2.46 | 389 | 1.465 % | 100 % |
| +1 bougie | 1.96 | 2.28 | 384 | 1.389 % | 95 % |
| +2 bougies | 1.88 | 2.22 | 381 | 1.343 % | 92 % |
| +4 bougies | 1.95 | 2.44 | 369 | 1.456 % | 99 % |
