# Zéro-shot du Shock Engine · SOL/USDT (Binance) · shorts en régime de tendance baissier (E2)

15 min, 2021-09-01 → 2026-09-30 (5.1 ans, préchauffage depuis 2020-08-11). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,01 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset solusdt --draws 200`.

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
| Profit factor > 1,1 (coûts × 1) | **non** | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | **non** | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | **non** | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 627 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 627 | +0.008 | +0.005 | −0.087 à +0.090 | 53 % | −0.084 | +0.107 | 67 % de 6 |
| 4 bougies (1 h) | 627 | +0.088 | +0.085 | −0.083 à +0.256 | 81 % | +0.008 | +0.173 | 67 % de 6 |
| 16 bougies (4 h) | 627 | +0.205 | +0.184 | −0.077 à +0.448 | 88 % | +0.111 | +0.269 | 83 % de 6 |
| 64 bougies (16 h) | 627 | +0.728 | +0.602 | +0.043 à +1.159 | 96 % | +0.930 | +0.226 | 67 % de 6 |

### signaux d'entrée « cœur » · 772 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 772 | +0.009 | +0.007 | −0.076 à +0.086 | 56 % | −0.105 | +0.125 | 67 % de 6 |
| 4 bougies (1 h) | 772 | +0.088 | +0.084 | −0.070 à +0.246 | 80 % | −0.036 | +0.211 | 67 % de 6 |
| 16 bougies (4 h) | 772 | +0.187 | +0.169 | −0.049 à +0.397 | 89 % | +0.039 | +0.305 | 83 % de 6 |
| 64 bougies (16 h) | 772 | +0.807 | +0.683 | +0.194 à +1.233 | 99 % | +0.824 | +0.536 | 83 % de 6 |

### chocs bruts (|z| > seuil du régime) · 5 269 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 5269 | +0.007 | +0.007 | −0.012 à +0.026 | 74 % | −0.021 | +0.032 | 50 % de 6 |
| 4 bougies (1 h) | 5269 | +0.041 | +0.041 | −0.001 à +0.080 | 94 % | −0.003 | +0.078 | 67 % de 6 |
| 16 bougies (4 h) | 5269 | +0.061 | +0.061 | −0.013 à +0.135 | 91 % | +0.004 | +0.108 | 50 % de 6 |
| 64 bougies (16 h) | 5265 | +0.185 | +0.179 | +0.028 à +0.320 | 97 % | +0.152 | +0.201 | 83 % de 6 |

### chocs bruts dans le sens de la tendance 60 min · 3 230 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 3230 | +0.020 | +0.020 | −0.007 à +0.046 | 89 % | −0.020 | +0.053 | 67 % de 6 |
| 4 bougies (1 h) | 3230 | +0.093 | +0.091 | +0.029 à +0.156 | 100 % | +0.035 | +0.139 | 100 % de 6 |
| 16 bougies (4 h) | 3230 | +0.155 | +0.149 | +0.006 à +0.286 | 96 % | +0.115 | +0.179 | 83 % de 6 |
| 64 bougies (16 h) | 3227 | +0.451 | +0.418 | +0.131 à +0.689 | 99 % | +0.546 | +0.307 | 83 % de 6 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 968 | +0.131 | +0.022 à +0.244 | +0.242 | +0.025 à +0.451 |
| Londres (2 h – 8 h) | 491 | +0.210 | +0.070 à +0.347 | −0.039 | −0.326 à +0.244 |
| New York matin (8 h – 12 h) | 965 | +0.156 | +0.016 à +0.280 | +0.306 | +0.063 à +0.543 |
| dont bougie de 8 h 30 (annonces) | 72 | +0.055 | −0.293 à +0.428 | +0.065 | −0.718 à +0.904 |
| New York après-midi (12 h – 18 h) | 806 | −0.108 | −0.215 à −0.012 | −0.035 | −0.320 à +0.243 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 216 | +0.124 | −0.127 à +0.385 | +0.326 | −0.085 à +0.743 |
| Londres (2 h – 8 h) | 97 | −0.236 | −0.578 à +0.095 | −0.760 | −1.220 à −0.265 |
| New York matin (8 h – 12 h) | 174 | +0.138 | −0.237 à +0.534 | +0.627 | −0.037 à +1.361 |
| dont bougie de 8 h 30 (annonces) | 12 | −0.402 | −1.268 à +0.592 | +1.140 | −1.501 à +4.748 |
| New York après-midi (12 h – 18 h) | 140 | +0.180 | −0.050 à +0.404 | +0.070 | −0.500 à +0.651 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 109 % | 15.6 % | 0.56 | 0.82 | 1.15 | -57.9 % | 0.27 | 398 | 25 % | 5.82 % | -1.49 % | 3.90 | 6.57 | 442 % | 18 % | 79× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 35 % | 6.1 % | 0.35 | 0.51 | 1.06 | -62.0 % | 0.10 | 398 | 24 % | 5.77 % | -1.59 % | 3.62 | 6.56 | 1079 % | 18 % | 79× | 7.1 % | 1.6 % |
| preset · coûts × 2 | -13 % | -2.7 % | 0.14 | 0.20 | 0.98 | -65.7 % | -0.04 | 398 | 24 % | 5.71 % | -1.70 % | 3.36 | 6.56 | -2334 % | 18 % | 78× | 14.1 % | 3.1 % |
| preset · coûts × 1, sans masque des ouvertures | 35 % | 6.1 % | 0.35 | 0.51 | 1.06 | -62.0 % | 0.10 | 398 | 24 % | 5.77 % | -1.59 % | 3.62 | 6.56 | 1079 % | 18 % | 79× | 7.1 % | 1.6 % |
| core · coûts × 0 | 567 % | 45.3 % | 1.05 | 1.59 | 1.34 | -53.6 % | 0.84 | 478 | 27 % | 6.11 % | -1.41 % | 4.32 | 10.38 | 234 % | 21 % | 99× | 0.0 % | 0.0 % |
| core · coûts × 1 | 295 % | 31.0 % | 0.82 | 1.24 | 1.22 | -57.4 % | 0.54 | 478 | 27 % | 6.04 % | -1.52 % | 3.98 | 10.38 | 321 % | 21 % | 98× | 8.8 % | 2.0 % |
| core · coûts × 2 | 134 % | 18.2 % | 0.59 | 0.89 | 1.12 | -60.9 % | 0.30 | 478 | 26 % | 6.03 % | -1.62 % | 3.72 | 10.37 | 516 % | 21 % | 97× | 17.5 % | 3.9 % |
| core · coûts × 1, sans masque des ouvertures | 295 % | 31.0 % | 0.82 | 1.24 | 1.22 | -57.4 % | 0.54 | 478 | 27 % | 6.04 % | -1.52 % | 3.98 | 10.38 | 321 % | 21 % | 98× | 8.8 % | 2.0 % |
| achat conservé | 9 % | 1.7 % | 0.49 | — | — | -96.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 0.34, intervalle à 90 % (bootstrap des mois) -0.39 à 1.09, P(Sharpe > 0) 75 %.

Coûts et Sharpe : × 0 → 0.56 · × 0,25 → 0.51 · × 0,5 → 0.45 · × 0,75 → 0.40 · × 1 → 0.35. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 53 % | 2.35 | -19.0 % | 19 |
| 2022 | -32 % | -0.59 | -53.0 % | 79 |
| 2023 | 55 % | 1.17 | -32.0 % | 78 |
| 2024 | -19 % | -0.62 | -32.3 % | 72 |
| 2025 | -7 % | -0.05 | -30.8 % | 95 |
| 2026 | 11 % | 0.61 | -40.5 % | 55 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 156 | 25 % | 0.66 % | 0.68 |
| calme | short | 95 | 23 % | 0.21 % | 0.07 |
| agité | long | 147 | 24 % | -0.30 % | -0.46 |

Entrées au hasard (200 tirages, mêmes sorties, 402 trades en médiane) : Sharpe médian -0.21, 95e centile 0.61 ; la stratégie en bat 87 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.22 | 3.74 | 348 | 2.386 % | 1197 % |
| -1 bougie (utilise le futur) | 2.88 | 3.21 | 350 | 2.135 % | 1071 % |
| à l'heure | 0.35 | 1.06 | 398 | 0.199 % | 100 % |
| +1 bougie | 0.15 | 0.99 | 401 | 0.097 % | 48 % |
| +2 bougies | 0.53 | 1.10 | 386 | 0.381 % | 191 % |
| +4 bougies | 0.31 | 1.03 | 388 | 0.255 % | 128 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 0.84, intervalle à 90 % (bootstrap des mois) -0.09 à 1.65, P(Sharpe > 0) 93 %.

Coûts et Sharpe : × 0 → 1.05 · × 0,25 → 0.99 · × 0,5 → 0.94 · × 0,75 → 0.88 · × 1 → 0.82. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 66 % | 2.71 | -19.0 % | 20 |
| 2022 | -42 % | -0.86 | -57.4 % | 92 |
| 2023 | 288 % | 2.59 | -33.8 % | 90 |
| 2024 | -24 % | -0.64 | -29.8 % | 92 |
| 2025 | 8 % | 0.39 | -29.1 % | 112 |
| 2026 | 28 % | 1.15 | -32.5 % | 72 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 174 | 28 % | 1.49 % | 1.78 |
| calme | short | 99 | 25 % | 0.27 % | 0.14 |
| agité | long | 205 | 26 % | -0.26 % | -0.55 |

Entrées au hasard (200 tirages, mêmes sorties, 480.5 trades en médiane) : Sharpe médian -0.23, 95e centile 0.39 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.74 | 5.47 | 425 | 2.379 % | 486 % |
| -1 bougie (utilise le futur) | 3.45 | 4.61 | 426 | 2.205 % | 450 % |
| à l'heure | 0.82 | 1.22 | 478 | 0.490 % | 100 % |
| +1 bougie | 0.60 | 1.13 | 486 | 0.370 % | 76 % |
| +2 bougies | 0.61 | 1.13 | 473 | 0.385 % | 79 % |
| +4 bougies | 0.54 | 1.11 | 469 | 0.354 % | 72 % |
