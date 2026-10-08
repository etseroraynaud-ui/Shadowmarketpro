# Zéro-shot du Shock Engine · ETH/USDT (Binance)

15 min, 2018-09-01 → 2026-09-30 (8.1 ans, préchauffage depuis 2017-08-17). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset ethusdt --draws 200`.

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

### signaux d'entrée complets · 1 539 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1539 | +0.142 | +0.142 | +0.072 à +0.212 | 100 % | +0.180 | +0.105 | 100 % de 9 |
| 4 bougies (1 h) | 1539 | +0.161 | +0.163 | +0.054 à +0.268 | 99 % | +0.300 | +0.030 | 78 % de 9 |
| 16 bougies (4 h) | 1539 | +0.362 | +0.358 | +0.175 à +0.535 | 100 % | +0.552 | +0.171 | 89 % de 9 |
| 64 bougies (16 h) | 1538 | +1.182 | +1.117 | +0.753 à +1.502 | 100 % | +1.401 | +0.841 | 89 % de 9 |

### signaux d'entrée « cœur » · 1 856 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1856 | +0.112 | +0.112 | +0.052 à +0.173 | 100 % | +0.152 | +0.073 | 100 % de 9 |
| 4 bougies (1 h) | 1856 | +0.127 | +0.127 | +0.030 à +0.217 | 98 % | +0.247 | +0.012 | 78 % de 9 |
| 16 bougies (4 h) | 1856 | +0.284 | +0.277 | +0.107 à +0.442 | 100 % | +0.483 | +0.078 | 89 % de 9 |
| 64 bougies (16 h) | 1855 | +1.096 | +1.016 | +0.672 à +1.364 | 100 % | +1.279 | +0.760 | 100 % de 9 |

### chocs bruts (|z| > seuil du régime) · 9 552 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 9552 | +0.067 | +0.067 | +0.049 à +0.086 | 100 % | +0.088 | +0.046 | 100 % de 9 |
| 4 bougies (1 h) | 9552 | +0.078 | +0.078 | +0.044 à +0.115 | 100 % | +0.122 | +0.036 | 89 % de 9 |
| 16 bougies (4 h) | 9552 | +0.061 | +0.068 | +0.011 à +0.127 | 98 % | +0.084 | +0.052 | 78 % de 9 |
| 64 bougies (16 h) | 9549 | +0.246 | +0.261 | +0.149 à +0.376 | 100 % | +0.364 | +0.160 | 89 % de 9 |

### chocs bruts dans le sens de la tendance 60 min · 5 974 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 5974 | +0.080 | +0.079 | +0.053 à +0.106 | 100 % | +0.106 | +0.056 | 100 % de 9 |
| 4 bougies (1 h) | 5974 | +0.092 | +0.092 | +0.046 à +0.141 | 100 % | +0.121 | +0.065 | 89 % de 9 |
| 16 bougies (4 h) | 5974 | +0.121 | +0.131 | +0.046 à +0.224 | 99 % | +0.149 | +0.114 | 78 % de 9 |
| 64 bougies (16 h) | 5972 | +0.478 | +0.483 | +0.294 à +0.670 | 100 % | +0.661 | +0.321 | 78 % de 9 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 1664 | +0.157 | +0.049 à +0.261 | +0.269 | +0.095 à +0.456 |
| Londres (2 h – 8 h) | 1069 | +0.101 | −0.003 à +0.207 | +0.058 | −0.159 à +0.286 |
| New York matin (8 h – 12 h) | 1666 | +0.142 | +0.046 à +0.237 | +0.384 | +0.212 à +0.567 |
| dont bougie de 8 h 30 (annonces) | 125 | +0.161 | −0.116 à +0.451 | +0.819 | +0.064 à +1.644 |
| New York après-midi (12 h – 18 h) | 1575 | −0.036 | −0.122 à +0.054 | −0.234 | −0.414 à −0.056 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 452 | +0.228 | +0.044 à +0.429 | +0.341 | −0.010 à +0.689 |
| Londres (2 h – 8 h) | 292 | +0.110 | −0.127 à +0.341 | +0.339 | −0.054 à +0.720 |
| New York matin (8 h – 12 h) | 413 | +0.165 | −0.094 à +0.433 | +0.666 | +0.226 à +1.132 |
| dont bougie de 8 h 30 (annonces) | 31 | +0.164 | −0.428 à +0.821 | +0.658 | −0.633 à +2.062 |
| New York après-midi (12 h – 18 h) | 382 | +0.125 | −0.118 à +0.379 | +0.061 | −0.289 à +0.437 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 16872 % | 88.7 % | 1.81 | 2.66 | 1.69 | -28.5 % | 3.11 | 918 | 30 % | 4.73 % | -1.05 % | 4.48 | 5.04 | 133 % | 29 % | 115× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 7352 % | 70.5 % | 1.55 | 2.27 | 1.51 | -33.1 % | 2.13 | 918 | 29 % | 4.71 % | -1.14 % | 4.14 | 5.04 | 158 % | 29 % | 115× | 10.3 % | 0.0 % |
| preset · coûts × 2 | 3170 % | 54.0 % | 1.28 | 1.88 | 1.36 | -41.1 % | 1.31 | 918 | 28 % | 4.82 % | -1.21 % | 3.99 | 5.04 | 194 % | 29 % | 115× | 20.7 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 7352 % | 70.5 % | 1.55 | 2.27 | 1.51 | -33.1 % | 2.13 | 918 | 29 % | 4.71 % | -1.14 % | 4.14 | 5.04 | 158 % | 29 % | 115× | 10.3 % | 0.0 % |
| core · coûts × 0 | 22853 % | 95.9 % | 1.86 | 2.74 | 1.64 | -24.5 % | 3.91 | 1095 | 30 % | 4.30 % | -1.01 % | 4.26 | 5.36 | 142 % | 31 % | 133× | 0.0 % | 0.0 % |
| core · coûts × 1 | 8495 % | 73.5 % | 1.56 | 2.29 | 1.47 | -31.1 % | 2.36 | 1095 | 29 % | 4.27 % | -1.09 % | 3.91 | 5.36 | 172 % | 31 % | 134× | 12.0 % | 0.0 % |
| core · coûts × 2 | 3116 % | 53.6 % | 1.26 | 1.83 | 1.32 | -38.5 % | 1.39 | 1095 | 28 % | 4.34 % | -1.16 % | 3.73 | 5.36 | 219 % | 31 % | 134× | 24.2 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 8495 % | 73.5 % | 1.56 | 2.29 | 1.47 | -31.1 % | 2.36 | 1095 | 29 % | 4.27 % | -1.09 % | 3.91 | 5.36 | 172 % | 31 % | 134× | 12.0 % | 0.0 % |
| achat conservé | 850 % | 32.1 % | 0.75 | — | — | -79.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.50, intervalle à 90 % (bootstrap des mois) 1.02 à 1.95, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.81 · × 0,25 → 1.74 · × 0,5 → 1.68 · × 0,75 → 1.61 · × 1 → 1.55. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 210 % | 5.96 | -13.4 % | 28 |
| 2019 | 8 % | 0.39 | -24.4 % | 100 |
| 2020 | 42 % | 1.08 | -25.6 % | 126 |
| 2021 | 62 % | 1.28 | -18.0 % | 108 |
| 2022 | 136 % | 2.01 | -24.3 % | 120 |
| 2023 | -14 % | -0.39 | -31.5 % | 142 |
| 2024 | 79 % | 2.49 | -11.9 % | 102 |
| 2025 | 105 % | 2.13 | -17.8 % | 97 |
| 2026 | 31 % | 1.23 | -27.5 % | 95 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 242 | 33 % | 1.38 % | 2.90 |
| calme | short | 365 | 27 % | 0.58 % | 1.75 |
| agité | long | 311 | 28 % | -0.10 % | -0.34 |

Entrées au hasard (200 tirages, mêmes sorties, 922 trades en médiane) : Sharpe médian 0.02, 95e centile 0.68 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.16 | 5.58 | 816 | 2.278 % | 405 % |
| -1 bougie (utilise le futur) | 4.76 | 5.04 | 820 | 2.095 % | 373 % |
| à l'heure | 1.55 | 1.51 | 918 | 0.562 % | 100 % |
| +1 bougie | 1.40 | 1.43 | 916 | 0.502 % | 89 % |
| +2 bougies | 1.30 | 1.42 | 898 | 0.479 % | 85 % |
| +4 bougies | 1.36 | 1.47 | 896 | 0.507 % | 90 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.52, intervalle à 90 % (bootstrap des mois) 1.02 à 1.99, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.86 · × 0,25 → 1.78 · × 0,5 → 1.71 · × 0,75 → 1.63 · × 1 → 1.56. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 170 % | 5.23 | -13.8 % | 40 |
| 2019 | 36 % | 0.91 | -24.3 % | 116 |
| 2020 | 57 % | 1.30 | -25.8 % | 144 |
| 2021 | 36 % | 0.91 | -19.4 % | 140 |
| 2022 | 144 % | 2.07 | -23.0 % | 137 |
| 2023 | -12 % | -0.27 | -31.1 % | 159 |
| 2024 | 75 % | 2.31 | -12.7 % | 138 |
| 2025 | 125 % | 2.31 | -20.1 % | 115 |
| 2026 | 29 % | 1.16 | -27.8 % | 106 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 270 | 31 % | 1.31 % | 3.04 |
| calme | short | 374 | 28 % | 0.58 % | 1.78 |
| agité | long | 451 | 29 % | -0.07 % | -0.37 |

Entrées au hasard (200 tirages, mêmes sorties, 1089.5 trades en médiane) : Sharpe médian -0.01, 95e centile 0.50 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.63 | 4.95 | 984 | 2.125 % | 434 % |
| -1 bougie (utilise le futur) | 5.23 | 4.62 | 988 | 1.973 % | 403 % |
| à l'heure | 1.56 | 1.47 | 1095 | 0.490 % | 100 % |
| +1 bougie | 1.39 | 1.39 | 1089 | 0.433 % | 88 % |
| +2 bougies | 1.28 | 1.37 | 1075 | 0.408 % | 83 % |
| +4 bougies | 1.29 | 1.42 | 1076 | 0.412 % | 84 % |
