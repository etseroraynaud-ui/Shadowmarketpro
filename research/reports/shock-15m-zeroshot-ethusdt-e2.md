# Zéro-shot du Shock Engine · ETH/USDT (Binance) · shorts en régime de tendance baissier (E2)

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

### signaux d'entrée complets · 1 092 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1092 | +0.130 | +0.129 | +0.047 à +0.210 | 99 % | +0.120 | +0.139 | 100 % de 9 |
| 4 bougies (1 h) | 1092 | +0.232 | +0.229 | +0.098 à +0.358 | 100 % | +0.315 | +0.133 | 78 % de 9 |
| 16 bougies (4 h) | 1092 | +0.379 | +0.339 | +0.112 à +0.547 | 99 % | +0.387 | +0.284 | 89 % de 9 |
| 64 bougies (16 h) | 1092 | +1.334 | +1.131 | +0.662 à +1.627 | 100 % | +1.364 | +0.870 | 89 % de 9 |

### signaux d'entrée « cœur » · 1 385 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1385 | +0.101 | +0.099 | +0.030 à +0.166 | 100 % | +0.107 | +0.091 | 100 % de 9 |
| 4 bougies (1 h) | 1385 | +0.181 | +0.177 | +0.065 à +0.282 | 100 % | +0.261 | +0.084 | 89 % de 9 |
| 16 bougies (4 h) | 1385 | +0.281 | +0.244 | +0.043 à +0.437 | 98 % | +0.339 | +0.139 | 78 % de 9 |
| 64 bougies (16 h) | 1385 | +1.180 | +0.985 | +0.543 à +1.431 | 100 % | +1.233 | +0.713 | 100 % de 9 |

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
| Asie (18 h – 2 h) | 339 | +0.223 | −0.010 à +0.461 | +0.223 | −0.171 à +0.618 |
| Londres (2 h – 8 h) | 211 | +0.140 | −0.095 à +0.385 | +0.230 | −0.228 à +0.676 |
| New York matin (8 h – 12 h) | 285 | +0.327 | −0.034 à +0.693 | +0.698 | +0.133 à +1.273 |
| dont bougie de 8 h 30 (annonces) | 21 | +0.236 | −0.408 à +0.980 | +0.868 | −0.459 à +2.458 |
| New York après-midi (12 h – 18 h) | 257 | +0.200 | −0.086 à +0.506 | +0.181 | −0.255 à +0.647 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 14591 % | 85.4 % | 2.08 | 3.06 | 2.31 | -28.1 % | 3.04 | 667 | 31 % | 4.97 % | -0.97 % | 5.14 | 5.05 | 109 % | 18 % | 77× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 7986 % | 72.2 % | 1.84 | 2.71 | 2.02 | -29.5 % | 2.45 | 667 | 30 % | 4.92 % | -1.05 % | 4.68 | 5.05 | 123 % | 18 % | 78× | 7.0 % | 0.0 % |
| preset · coûts × 2 | 4348 % | 59.9 % | 1.61 | 2.36 | 1.78 | -34.0 % | 1.76 | 667 | 29 % | 5.01 % | -1.13 % | 4.45 | 5.05 | 141 % | 18 % | 78× | 14.1 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 7986 % | 72.2 % | 1.84 | 2.71 | 2.02 | -29.5 % | 2.45 | 667 | 30 % | 4.92 % | -1.05 % | 4.68 | 5.05 | 123 % | 18 % | 78× | 7.0 % | 0.0 % |
| core · coûts × 0 | 19272 % | 91.9 % | 2.11 | 3.11 | 2.14 | -29.2 % | 3.15 | 838 | 31 % | 4.39 % | -0.92 % | 4.77 | 5.48 | 119 % | 20 % | 95× | 0.0 % | 0.0 % |
| core · coûts × 1 | 9042 % | 74.8 % | 1.83 | 2.69 | 1.86 | -31.7 % | 2.36 | 838 | 31 % | 4.35 % | -1.01 % | 4.33 | 5.48 | 138 % | 20 % | 96× | 8.7 % | 0.0 % |
| core · coûts × 2 | 4212 % | 59.3 % | 1.55 | 2.26 | 1.64 | -34.2 % | 1.73 | 838 | 30 % | 4.40 % | -1.08 % | 4.07 | 5.48 | 164 % | 20 % | 97× | 17.5 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 9042 % | 74.8 % | 1.83 | 2.69 | 1.86 | -31.7 % | 2.36 | 838 | 31 % | 4.35 % | -1.01 % | 4.33 | 5.48 | 138 % | 20 % | 96× | 8.7 % | 0.0 % |
| achat conservé | 850 % | 32.1 % | 0.75 | — | — | -79.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.75, intervalle à 90 % (bootstrap des mois) 1.19 à 2.25, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.08 · × 0,25 → 2.02 · × 0,5 → 1.96 · × 0,75 → 1.90 · × 1 → 1.84. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 210 % | 5.96 | -13.4 % | 28 |
| 2019 | -14 % | -0.29 | -26.5 % | 83 |
| 2020 | 76 % | 1.79 | -20.1 % | 96 |
| 2021 | 66 % | 1.70 | -17.9 % | 83 |
| 2022 | 76 % | 1.76 | -22.8 % | 87 |
| 2023 | 13 % | 0.63 | -13.9 % | 80 |
| 2024 | 68 % | 2.63 | -14.3 % | 81 |
| 2025 | 99 % | 2.48 | -14.0 % | 75 |
| 2026 | 57 % | 2.17 | -18.3 % | 54 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 242 | 33 % | 1.38 % | 2.90 |
| calme | short | 114 | 32 % | 1.83 % | 1.83 |
| agité | long | 311 | 28 % | -0.10 % | -0.34 |

Entrées au hasard (200 tirages, mêmes sorties, 669 trades en médiane) : Sharpe médian 0.54, 95e centile 1.03 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.82 | 8.96 | 606 | 2.407 % | 314 % |
| -1 bougie (utilise le futur) | 4.51 | 8.98 | 608 | 2.260 % | 295 % |
| à l'heure | 1.84 | 2.02 | 667 | 0.767 % | 100 % |
| +1 bougie | 1.73 | 1.93 | 662 | 0.723 % | 94 % |
| +2 bougies | 1.55 | 1.82 | 655 | 0.655 % | 85 % |
| +4 bougies | 1.56 | 1.86 | 661 | 0.661 % | 86 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.74, intervalle à 90 % (bootstrap des mois) 1.20 à 2.24, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.11 · × 0,25 → 2.04 · × 0,5 → 1.97 · × 0,75 → 1.90 · × 1 → 1.83. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2018 | 173 % | 5.29 | -13.8 % | 39 |
| 2019 | 5 % | 0.31 | -29.1 % | 98 |
| 2020 | 95 % | 2.00 | -20.0 % | 114 |
| 2021 | 40 % | 1.18 | -17.9 % | 115 |
| 2022 | 88 % | 1.94 | -24.0 % | 102 |
| 2023 | 18 % | 0.80 | -13.4 % | 95 |
| 2024 | 59 % | 2.24 | -16.6 % | 118 |
| 2025 | 118 % | 2.66 | -16.7 % | 93 |
| 2026 | 53 % | 2.02 | -17.0 % | 64 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 270 | 31 % | 1.31 % | 3.04 |
| calme | short | 117 | 32 % | 1.79 % | 1.84 |
| agité | long | 451 | 29 % | -0.07 % | -0.37 |

Entrées au hasard (200 tirages, mêmes sorties, 834 trades en médiane) : Sharpe médian 0.44, 95e centile 0.98 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.30 | 7.10 | 770 | 2.175 % | 344 % |
| -1 bougie (utilise le futur) | 5.01 | 7.37 | 772 | 2.063 % | 327 % |
| à l'heure | 1.83 | 1.86 | 838 | 0.632 % | 100 % |
| +1 bougie | 1.68 | 1.78 | 830 | 0.580 % | 92 % |
| +2 bougies | 1.49 | 1.64 | 827 | 0.519 % | 82 % |
| +4 bougies | 1.44 | 1.71 | 836 | 0.506 % | 80 % |
