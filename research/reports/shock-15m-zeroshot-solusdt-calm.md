# Zéro-shot du Shock Engine · SOL/USDT (Binance) · régime calme seul, shorts en régime de tendance baissier

15 min, 2021-09-01 → 2026-09-30 (5.1 ans, préchauffage depuis 2020-08-11). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,01 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset solusdt --draws 200 --calm`.

## Données

- 178 163 bougies de 15 min ; 2 suivent une fermeture (masquées pour les entrées) ; 5 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.543 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2023-01-02 07:00 +33.8 · 2023-06-10 04:15 −30.2 · 2022-05-11 12:30 −23.7 · 2022-11-08 19:15 −22.8 · 2021-09-07 14:45 −22.7 · 2022-11-08 16:00 +22.3 · 2022-05-12 07:15 +21.9 · 2025-10-10 21:30 +21.9.
- Plus forts sauts **à l'ouverture** (masqués) : 2021-09-29 09:00 −2.1 · 2023-03-24 14:00 −0.8.

## Verdict (critères fixés avant le test)

**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : oui. Chocs bruts sans tendance : **non**.

| critère | entrées complètes | entrées « cœur » |
| --- | --- | --- |
| Étude d'événement des signaux : même critère | **non** | **non** |
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 429 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 429 | +0.002 | −0.000 | −0.116 à +0.107 | 49 % | −0.109 | +0.159 | 67 % de 6 |
| 4 bougies (1 h) | 429 | +0.110 | +0.111 | −0.113 à +0.328 | 80 % | −0.008 | +0.286 | 67 % de 6 |
| 16 bougies (4 h) | 429 | +0.311 | +0.295 | −0.071 à +0.683 | 91 % | +0.169 | +0.481 | 83 % de 6 |
| 64 bougies (16 h) | 429 | +0.909 | +0.795 | +0.086 à +1.565 | 97 % | +1.136 | +0.294 | 67 % de 6 |

### signaux d'entrée « cœur » · 481 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 481 | −0.014 | −0.016 | −0.128 à +0.092 | 39 % | −0.122 | +0.131 | 50 % de 6 |
| 4 bougies (1 h) | 481 | +0.109 | +0.110 | −0.113 à +0.334 | 79 % | −0.044 | +0.323 | 67 % de 6 |
| 16 bougies (4 h) | 481 | +0.309 | +0.293 | −0.052 à +0.626 | 92 % | +0.124 | +0.526 | 83 % de 6 |
| 64 bougies (16 h) | 481 | +0.860 | +0.753 | +0.058 à +1.442 | 96 % | +1.075 | +0.309 | 83 % de 6 |

### chocs bruts (|z| > seuil du régime) · 5 269 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 5269 | +0.007 | +0.007 | −0.012 à +0.025 | 74 % | −0.021 | +0.032 | 50 % de 6 |
| 4 bougies (1 h) | 5269 | +0.041 | +0.041 | −0.003 à +0.081 | 94 % | −0.003 | +0.078 | 67 % de 6 |
| 16 bougies (4 h) | 5269 | +0.061 | +0.061 | −0.017 à +0.134 | 90 % | +0.004 | +0.108 | 50 % de 6 |
| 64 bougies (16 h) | 5265 | +0.185 | +0.179 | +0.033 à +0.320 | 98 % | +0.152 | +0.201 | 83 % de 6 |

### chocs bruts dans le sens de la tendance 60 min · 3 230 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 3230 | +0.020 | +0.020 | −0.005 à +0.046 | 91 % | −0.020 | +0.053 | 67 % de 6 |
| 4 bougies (1 h) | 3230 | +0.093 | +0.091 | +0.031 à +0.153 | 99 % | +0.035 | +0.139 | 100 % de 6 |
| 16 bougies (4 h) | 3230 | +0.155 | +0.149 | +0.015 à +0.290 | 96 % | +0.115 | +0.179 | 83 % de 6 |
| 64 bougies (16 h) | 3227 | +0.451 | +0.418 | +0.132 à +0.705 | 99 % | +0.546 | +0.307 | 83 % de 6 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 968 | +0.131 | +0.018 à +0.246 | +0.242 | +0.031 à +0.446 |
| Londres (2 h – 8 h) | 491 | +0.210 | +0.055 à +0.346 | −0.039 | −0.313 à +0.226 |
| New York matin (8 h – 12 h) | 965 | +0.156 | +0.025 à +0.289 | +0.306 | +0.046 à +0.541 |
| dont bougie de 8 h 30 (annonces) | 72 | +0.055 | −0.321 à +0.436 | +0.065 | −0.718 à +0.921 |
| New York après-midi (12 h – 18 h) | 806 | −0.108 | −0.208 à −0.004 | −0.035 | −0.309 à +0.250 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 149 | +0.130 | −0.215 à +0.476 | +0.445 | −0.131 à +1.029 |
| Londres (2 h – 8 h) | 49 | −0.278 | −0.831 à +0.195 | −0.825 | −1.430 à −0.288 |
| New York matin (8 h – 12 h) | 135 | +0.125 | −0.366 à +0.629 | +0.796 | −0.113 à +1.681 |
| dont bougie de 8 h 30 (annonces) | 12 | −0.402 | −1.267 à +0.664 | +1.140 | −1.592 à +4.963 |
| New York après-midi (12 h – 18 h) | 96 | +0.261 | +0.007 à +0.548 | −0.069 | −0.885 à +0.684 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 180 % | 22.5 % | 0.71 | 1.05 | 1.26 | -50.3 % | 0.45 | 251 | 25 % | 8.25 % | -1.91 % | 4.32 | 5.32 | 253 % | 17 % | 47× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 113 % | 16.0 % | 0.57 | 0.84 | 1.18 | -54.0 % | 0.30 | 251 | 24 % | 8.28 % | -2.01 % | 4.12 | 5.32 | 344 % | 17 % | 47× | 4.2 % | 0.9 % |
| preset · coûts × 2 | 61 % | 9.9 % | 0.44 | 0.64 | 1.11 | -57.4 % | 0.17 | 251 | 24 % | 8.17 % | -2.12 % | 3.86 | 5.32 | 540 % | 17 % | 47× | 8.5 % | 1.9 % |
| preset · coûts × 1, sans masque des ouvertures | 113 % | 16.0 % | 0.57 | 0.84 | 1.18 | -54.0 % | 0.30 | 251 | 24 % | 8.28 % | -2.01 % | 4.12 | 5.32 | 344 % | 17 % | 47× | 4.2 % | 0.9 % |
| core · coûts × 0 | 825 % | 54.9 % | 1.22 | 1.85 | 1.51 | -49.2 % | 1.12 | 273 | 27 % | 9.28 % | -1.86 % | 5.00 | 7.97 | 159 % | 20 % | 50× | 0.0 % | 0.0 % |
| core · coûts × 1 | 585 % | 46.1 % | 1.08 | 1.64 | 1.41 | -51.7 % | 0.89 | 273 | 27 % | 9.29 % | -1.96 % | 4.75 | 7.97 | 183 % | 20 % | 50× | 4.5 % | 1.0 % |
| core · coûts × 2 | 408 % | 37.7 % | 0.95 | 1.43 | 1.32 | -54.1 % | 0.70 | 273 | 26 % | 9.31 % | -2.06 % | 4.52 | 7.97 | 216 % | 20 % | 50× | 9.0 % | 2.0 % |
| core · coûts × 1, sans masque des ouvertures | 585 % | 46.1 % | 1.08 | 1.64 | 1.41 | -51.7 % | 0.89 | 273 | 27 % | 9.29 % | -1.96 % | 4.75 | 7.97 | 183 % | 20 % | 50× | 4.5 % | 1.0 % |
| achat conservé | 9 % | 1.7 % | 0.49 | — | — | -96.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 0.58, intervalle à 90 % (bootstrap des mois) -0.23 à 1.32, P(Sharpe > 0) 89 %.

Coûts et Sharpe : × 0 → 0.71 · × 0,25 → 0.68 · × 0,5 → 0.64 · × 0,75 → 0.61 · × 1 → 0.57. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 55 % | 2.40 | -19.0 % | 18 |
| 2022 | -28 % | -0.48 | -50.8 % | 67 |
| 2023 | 86 % | 1.60 | -23.7 % | 43 |
| 2024 | -12 % | -0.33 | -29.6 % | 39 |
| 2025 | 0 % | 0.16 | -27.4 % | 44 |
| 2026 | 17 % | 0.84 | -36.9 % | 40 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 156 | 25 % | 0.66 % | 0.68 |
| calme | short | 95 | 23 % | 0.21 % | 0.07 |

Entrées au hasard (200 tirages, mêmes sorties, 247.5 trades en médiane) : Sharpe médian -0.10, 95e centile 0.66 ; la stratégie en bat 93 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.58 | 3.06 | 217 | 3.023 % | 615 % |
| -1 bougie (utilise le futur) | 2.34 | 2.72 | 218 | 2.733 % | 556 % |
| à l'heure | 0.57 | 1.18 | 251 | 0.491 % | 100 % |
| +1 bougie | 0.46 | 1.12 | 254 | 0.393 % | 80 % |
| +2 bougies | 0.80 | 1.25 | 248 | 0.815 % | 166 % |
| +4 bougies | 0.61 | 1.16 | 249 | 0.637 % | 130 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.11, intervalle à 90 % (bootstrap des mois) 0.22 à 1.89, P(Sharpe > 0) 99 %.

Coûts et Sharpe : × 0 → 1.22 · × 0,25 → 1.18 · × 0,5 → 1.15 · × 0,75 → 1.12 · × 1 → 1.08. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 70 % | 2.83 | -19.0 % | 18 |
| 2022 | -33 % | -0.58 | -51.7 % | 72 |
| 2023 | 338 % | 2.88 | -24.0 % | 45 |
| 2024 | -1 % | 0.11 | -23.2 % | 42 |
| 2025 | 12 % | 0.51 | -23.5 % | 48 |
| 2026 | 24 % | 1.04 | -32.8 % | 48 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 174 | 28 % | 1.49 % | 1.78 |
| calme | short | 99 | 25 % | 0.27 % | 0.14 |

Entrées au hasard (200 tirages, mêmes sorties, 270 trades en médiane) : Sharpe médian -0.02, 95e centile 0.70 ; la stratégie en bat 99 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.84 | 4.15 | 233 | 3.210 % | 305 % |
| -1 bougie (utilise le futur) | 2.60 | 3.46 | 234 | 2.922 % | 278 % |
| à l'heure | 1.08 | 1.41 | 273 | 1.051 % | 100 % |
| +1 bougie | 0.97 | 1.37 | 277 | 0.935 % | 89 % |
| +2 bougies | 0.98 | 1.36 | 269 | 0.966 % | 92 % |
| +4 bougies | 0.84 | 1.29 | 271 | 0.841 % | 80 % |
