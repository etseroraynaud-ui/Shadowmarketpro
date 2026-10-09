# Zéro-shot du Shock Engine · ETH/USD (Dukascopy) · shorts en régime de tendance baissier (E2)

15 min, 2019-01-01 → 2026-09-30 (7.7 ans, préchauffage depuis 2018-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset eth-dukascopy --draws 200`.

## Données

- 223 584 bougies de 15 min ; 440 suivent une fermeture (masquées pour les entrées) ; 25 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.458 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2020-03-13 02:30 +40.0 · 2020-03-13 03:15 +33.4 · 2020-03-12 10:30 −29.8 · 2020-03-13 02:15 +26.7 · 2019-06-26 20:30 −24.9 · 2021-05-19 13:15 +24.8 · 2019-09-24 18:45 −24.6 · 2021-05-19 13:00 −21.8.
- Plus forts sauts **à l'ouverture** (masqués) : 2019-07-14 21:00 −35.8 · 2020-05-10 21:00 −29.5 · 2020-09-06 00:00 −28.8 · 2020-03-08 21:00 −26.8 · 2022-07-17 00:00 +25.4 · 2019-05-19 21:00 +24.6.

## Verdict (critères fixés avant le test)

**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : oui. Chocs bruts sans tendance : oui.

| critère | entrées complètes | entrées « cœur » |
| --- | --- | --- |
| Étude d'événement des signaux : même critère | oui | **non** |
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 648 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 648 | +0.130 | +0.130 | +0.041 à +0.217 | 99 % | +0.135 | +0.125 | 88 % de 8 |
| 4 bougies (1 h) | 648 | +0.275 | +0.273 | +0.091 à +0.454 | 99 % | +0.386 | +0.170 | 88 % de 8 |
| 16 bougies (4 h) | 648 | +0.382 | +0.328 | +0.001 à +0.648 | 95 % | +0.372 | +0.287 | 88 % de 8 |
| 64 bougies (16 h) | 648 | +1.676 | +1.396 | +0.615 à +2.188 | 100 % | +1.446 | +1.351 | 88 % de 8 |

### signaux d'entrée « cœur » · 1 036 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1036 | +0.106 | +0.106 | +0.041 à +0.173 | 100 % | +0.116 | +0.097 | 88 % de 8 |
| 4 bougies (1 h) | 1036 | +0.199 | +0.196 | +0.074 à +0.312 | 100 % | +0.304 | +0.090 | 75 % de 8 |
| 16 bougies (4 h) | 1036 | +0.260 | +0.211 | −0.030 à +0.435 | 92 % | +0.123 | +0.298 | 75 % de 8 |
| 64 bougies (16 h) | 1036 | +1.169 | +0.913 | +0.386 à +1.443 | 100 % | +0.916 | +0.909 | 100 % de 8 |

### chocs bruts (|z| > seuil du régime) · 6 833 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6833 | +0.082 | +0.082 | +0.060 à +0.106 | 100 % | +0.099 | +0.068 | 100 % de 8 |
| 4 bougies (1 h) | 6833 | +0.089 | +0.089 | +0.045 à +0.133 | 100 % | +0.104 | +0.076 | 100 % de 8 |
| 16 bougies (4 h) | 6833 | +0.086 | +0.092 | +0.024 à +0.165 | 99 % | +0.056 | +0.124 | 88 % de 8 |
| 64 bougies (16 h) | 6830 | +0.270 | +0.287 | +0.164 à +0.414 | 100 % | +0.275 | +0.297 | 88 % de 8 |

### chocs bruts dans le sens de la tendance 60 min · 4 289 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 4289 | +0.086 | +0.086 | +0.054 à +0.117 | 100 % | +0.104 | +0.071 | 88 % de 8 |
| 4 bougies (1 h) | 4289 | +0.104 | +0.104 | +0.044 à +0.160 | 100 % | +0.091 | +0.114 | 88 % de 8 |
| 16 bougies (4 h) | 4289 | +0.130 | +0.139 | +0.048 à +0.226 | 100 % | +0.073 | +0.194 | 75 % de 8 |
| 64 bougies (16 h) | 4287 | +0.510 | +0.522 | +0.321 à +0.735 | 100 % | +0.641 | +0.421 | 100 % de 8 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 1104 | +0.169 | +0.038 à +0.298 | +0.172 | −0.032 à +0.395 |
| Londres (2 h – 8 h) | 737 | +0.130 | −0.008 à +0.272 | +0.184 | −0.089 à +0.453 |
| New York matin (8 h – 12 h) | 1327 | +0.179 | +0.072 à +0.289 | +0.331 | +0.139 à +0.523 |
| dont bougie de 8 h 30 (annonces) | 109 | +0.166 | −0.166 à +0.511 | +0.507 | −0.368 à +1.443 |
| New York après-midi (12 h – 18 h) | 1121 | −0.068 | −0.189 à +0.053 | −0.152 | −0.356 à +0.047 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 149 | +0.145 | −0.114 à +0.389 | −0.118 | −0.645 à +0.406 |
| Londres (2 h – 8 h) | 129 | +0.350 | +0.051 à +0.665 | +0.553 | −0.106 à +1.204 |
| New York matin (8 h – 12 h) | 225 | +0.495 | +0.112 à +0.894 | +0.490 | −0.273 à +1.311 |
| dont bougie de 8 h 30 (annonces) | 24 | +0.247 | −0.524 à +1.085 | +1.805 | −1.279 à +5.538 |
| New York après-midi (12 h – 18 h) | 145 | −0.007 | −0.369 à +0.342 | +0.334 | −0.438 à +1.111 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 6313 % | 71.1 % | 2.04 | 3.12 | 2.23 | -24.3 % | 2.92 | 412 | 36 % | 4.91 % | -0.98 % | 5.00 | 4.29 | 82 % | 14 % | 54× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 4335 % | 63.2 % | 1.87 | 2.84 | 1.99 | -26.4 % | 2.40 | 412 | 35 % | 4.89 % | -1.06 % | 4.59 | 4.29 | 90 % | 14 % | 54× | 4.9 % | 0.0 % |
| preset · coûts × 2 | 2965 % | 55.6 % | 1.70 | 2.57 | 1.79 | -28.5 % | 1.95 | 412 | 35 % | 4.83 % | -1.15 % | 4.20 | 4.29 | 99 % | 14 % | 54× | 9.7 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 4268 % | 62.8 % | 1.86 | 2.83 | 1.98 | -26.4 % | 2.38 | 415 | 35 % | 4.85 % | -1.06 % | 4.57 | 4.30 | 90 % | 14 % | 54× | 4.9 % | 0.0 % |
| core · coûts × 0 | 10669 % | 83.0 % | 2.05 | 3.11 | 1.94 | -24.4 % | 3.40 | 615 | 33 % | 4.53 % | -0.98 % | 4.61 | 3.56 | 99 % | 19 % | 76× | 0.0 % | 0.0 % |
| core · coûts × 1 | 6103 % | 70.4 % | 1.82 | 2.76 | 1.72 | -28.0 % | 2.51 | 615 | 33 % | 4.48 % | -1.07 % | 4.20 | 3.56 | 112 % | 19 % | 77× | 7.0 % | 0.0 % |
| core · coûts × 2 | 3472 % | 58.7 % | 1.60 | 2.40 | 1.54 | -31.5 % | 1.86 | 615 | 33 % | 4.44 % | -1.15 % | 3.85 | 3.56 | 128 % | 19 % | 78× | 14.1 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 9513 % | 80.3 % | 1.93 | 2.89 | 1.83 | -26.9 % | 2.99 | 624 | 33 % | 4.68 % | -1.07 % | 4.39 | 3.45 | 105 % | 20 % | 78× | 7.0 % | 0.0 % |
| achat conservé | 1917 % | 47.4 % | 0.89 | — | — | -78.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.85, intervalle à 90 % (bootstrap des mois) 1.36 à 2.34, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.04 · × 0,25 → 2.00 · × 0,5 → 1.96 · × 0,75 → 1.91 · × 1 → 1.87. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 100 % | 1.85 | -14.8 % | 29 |
| 2020 | 213 % | 3.41 | -10.4 % | 60 |
| 2021 | 77 % | 2.32 | -8.7 % | 43 |
| 2022 | 3 % | 0.24 | -26.4 % | 66 |
| 2023 | 29 % | 1.26 | -12.9 % | 57 |
| 2024 | 34 % | 1.76 | -8.3 % | 65 |
| 2025 | 68 % | 2.00 | -17.8 % | 60 |
| 2026 | 35 % | 1.92 | -13.5 % | 32 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 130 | 41 % | 2.73 % | 3.19 |
| calme | short | 76 | 30 % | 0.52 % | 0.33 |
| agité | long | 206 | 33 % | 0.15 % | 0.27 |

Entrées au hasard (200 tirages, mêmes sorties, 404.5 trades en médiane) : Sharpe médian 0.54, 95e centile 1.07 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.10 | 10.12 | 396 | 2.565 % | 249 % |
| -1 bougie (utilise le futur) | 3.93 | 8.07 | 393 | 2.511 % | 244 % |
| à l'heure | 1.87 | 1.99 | 412 | 1.030 % | 100 % |
| +1 bougie | 1.43 | 1.85 | 417 | 0.744 % | 72 % |
| +2 bougies | 1.29 | 1.71 | 422 | 0.667 % | 65 % |
| +4 bougies | 1.10 | 1.55 | 424 | 0.564 % | 55 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.79, intervalle à 90 % (bootstrap des mois) 1.29 à 2.27, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 2.05 · × 0,25 → 2.00 · × 0,5 → 1.94 · × 0,75 → 1.88 · × 1 → 1.82. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 116 % | 1.87 | -15.3 % | 44 |
| 2020 | 220 % | 3.36 | -10.0 % | 80 |
| 2021 | 94 % | 2.19 | -13.7 % | 85 |
| 2022 | 8 % | 0.41 | -28.0 % | 99 |
| 2023 | 21 % | 0.93 | -14.3 % | 80 |
| 2024 | 33 % | 1.59 | -12.1 % | 100 |
| 2025 | 98 % | 2.42 | -20.9 % | 83 |
| 2026 | 33 % | 1.67 | -16.3 % | 44 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 199 | 36 % | 2.00 % | 3.58 |
| calme | short | 90 | 29 % | 0.42 % | 0.30 |
| agité | long | 326 | 32 % | 0.09 % | 0.25 |

Entrées au hasard (200 tirages, mêmes sorties, 613 trades en médiane) : Sharpe médian 0.69, 95e centile 1.18 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.66 | 8.60 | 583 | 2.301 % | 304 % |
| -1 bougie (utilise le futur) | 4.48 | 7.03 | 577 | 2.253 % | 298 % |
| à l'heure | 1.82 | 1.72 | 615 | 0.756 % | 100 % |
| +1 bougie | 1.58 | 1.77 | 616 | 0.651 % | 86 % |
| +2 bougies | 1.43 | 1.61 | 618 | 0.580 % | 77 % |
| +4 bougies | 1.31 | 1.55 | 619 | 0.532 % | 70 % |
