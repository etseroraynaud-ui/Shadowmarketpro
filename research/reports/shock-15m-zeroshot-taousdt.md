# Zéro-shot du Shock Engine · TAO/USDT (Binance)

15 min, 2024-08-15 → 2026-09-30 (2.1 ans, préchauffage depuis 2024-04-11). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,02 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset taousdt --draws 200`.

## Données

- 74 592 bougies de 15 min ; 0 suivent une fermeture (masquées pour les entrées) ; 0 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.610 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2025-10-10 21:15 −33.0 · 2025-10-10 21:30 +29.2 · 2025-10-10 22:00 −21.6 · 2025-02-03 01:45 −18.2 · 2025-10-10 21:00 −13.5 · 2026-02-06 00:00 −13.4 · 2025-10-14 19:30 −12.2 · 2025-10-10 22:30 +11.9.
- Plus forts sauts **à l'ouverture** (masqués) : .

## Verdict (critères fixés avant le test)

**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : **non**. Chocs bruts sans tendance : **non**.

| critère | entrées complètes | entrées « cœur » |
| --- | --- | --- |
| Étude d'événement des signaux : même critère | **non** | **non** |
| Profit factor > 1,1 (coûts × 1) | **non** | **non** |
| Sharpe > 0,3 (coûts × 1) | **non** | **non** |
| Bat ≥ 90 % des entrées au hasard | **non** | **non** |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | **non** | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 305 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 305 | +0.086 | +0.088 | −0.011 à +0.187 | 93 % | +0.158 | +0.026 | 67 % de 3 |
| 4 bougies (1 h) | 305 | +0.003 | +0.004 | −0.203 à +0.223 | 52 % | −0.221 | +0.206 | 33 % de 3 |
| 16 bougies (4 h) | 305 | +0.133 | +0.122 | −0.208 à +0.473 | 71 % | −0.073 | +0.297 | 100 % de 3 |
| 64 bougies (16 h) | 305 | +0.364 | +0.337 | −0.443 à +1.145 | 75 % | −0.032 | +0.666 | 67 % de 3 |

### signaux d'entrée « cœur » · 393 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 393 | +0.036 | +0.038 | −0.052 à +0.127 | 78 % | +0.107 | −0.025 | 67 % de 3 |
| 4 bougies (1 h) | 393 | +0.024 | +0.023 | −0.137 à +0.183 | 58 % | −0.123 | +0.156 | 33 % de 3 |
| 16 bougies (4 h) | 393 | +0.210 | +0.196 | −0.106 à +0.508 | 85 % | +0.177 | +0.213 | 100 % de 3 |
| 64 bougies (16 h) | 393 | +0.493 | +0.450 | −0.336 à +1.236 | 82 % | +0.293 | +0.592 | 100 % de 3 |

### chocs bruts (|z| > seuil du régime) · 2 371 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 2371 | −0.031 | −0.032 | −0.057 à −0.008 | 2 % | −0.021 | −0.044 | 0 % de 3 |
| 4 bougies (1 h) | 2371 | −0.053 | −0.051 | −0.110 à +0.005 | 7 % | −0.121 | +0.028 | 33 % de 3 |
| 16 bougies (4 h) | 2370 | −0.010 | −0.009 | −0.099 à +0.074 | 41 % | +0.007 | −0.027 | 33 % de 3 |
| 64 bougies (16 h) | 2367 | +0.091 | +0.084 | −0.049 à +0.224 | 84 % | +0.023 | +0.154 | 67 % de 3 |

### chocs bruts dans le sens de la tendance 60 min · 1 380 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1380 | −0.007 | −0.006 | −0.041 à +0.026 | 37 % | +0.015 | −0.030 | 33 % de 3 |
| 4 bougies (1 h) | 1380 | −0.010 | −0.009 | −0.077 à +0.059 | 42 % | −0.077 | +0.066 | 33 % de 3 |
| 16 bougies (4 h) | 1380 | +0.102 | +0.104 | −0.073 à +0.251 | 83 % | +0.154 | +0.050 | 67 % de 3 |
| 64 bougies (16 h) | 1378 | +0.306 | +0.304 | −0.020 à +0.653 | 94 % | +0.414 | +0.181 | 100 % de 3 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 370 | +0.102 | −0.145 à +0.390 | +0.099 | −0.270 à +0.472 |
| Londres (2 h – 8 h) | 264 | +0.030 | −0.172 à +0.222 | −0.022 | −0.452 à +0.377 |
| New York matin (8 h – 12 h) | 417 | −0.039 | −0.192 à +0.104 | +0.182 | −0.168 à +0.539 |
| dont bougie de 8 h 30 (annonces) | 23 | −0.013 | −0.554 à +0.459 | +0.332 | −0.812 à +1.457 |
| New York après-midi (12 h – 18 h) | 329 | −0.128 | −0.272 à +0.015 | +0.114 | −0.187 à +0.393 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 99 | +0.289 | −0.131 à +0.801 | +0.291 | −0.412 à +1.047 |
| Londres (2 h – 8 h) | 55 | +0.226 | −0.397 à +1.048 | +0.462 | −0.801 à +1.871 |
| New York matin (8 h – 12 h) | 86 | −0.115 | −0.477 à +0.248 | −0.081 | −0.675 à +0.521 |
| dont bougie de 8 h 30 (annonces) | 3 | +0.193 | −0.276 à +0.662 | +3.608 | +1.780 à +5.436 |
| New York après-midi (12 h – 18 h) | 65 | −0.458 | −0.857 à −0.021 | −0.154 | −0.750 à +0.559 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | -6 % | -3.0 % | 0.20 | 0.29 | 0.98 | -61.3 % | -0.05 | 208 | 26 % | 5.13 % | -1.79 % | 2.87 | 1.83 | -1745 % | 23 % | 96× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -28 % | -14.5 % | -0.04 | -0.06 | 0.89 | -65.8 % | -0.22 | 208 | 26 % | 5.10 % | -1.91 % | 2.67 | 1.83 | -334 % | 23 % | 95× | 8.6 % | 3.8 % |
| preset · coûts × 2 | -45 % | -24.7 % | -0.28 | -0.40 | 0.82 | -69.8 % | -0.35 | 208 | 25 % | 5.07 % | -2.03 % | 2.50 | 1.82 | -183 % | 23 % | 95× | 17.1 % | 7.6 % |
| preset · coûts × 1, sans masque des ouvertures | -28 % | -14.5 % | -0.04 | -0.06 | 0.89 | -65.8 % | -0.22 | 208 | 26 % | 5.10 % | -1.91 % | 2.67 | 1.83 | -334 % | 23 % | 95× | 8.6 % | 3.8 % |
| core · coûts × 0 | 20 % | 9.0 % | 0.43 | 0.62 | 1.06 | -58.6 % | 0.15 | 263 | 26 % | 5.09 % | -1.62 % | 3.14 | 2.17 | 837 % | 26 % | 122× | 0.0 % | 0.0 % |
| core · coûts × 1 | -15 % | -7.1 % | 0.14 | 0.21 | 0.95 | -64.8 % | -0.11 | 263 | 26 % | 5.03 % | -1.74 % | 2.89 | 2.17 | -964 % | 26 % | 121× | 10.9 % | 4.8 % |
| core · coûts × 2 | -39 % | -20.8 % | -0.14 | -0.21 | 0.86 | -70.1 % | -0.30 | 263 | 25 % | 4.98 % | -1.86 % | 2.68 | 2.16 | -301 % | 26 % | 121× | 21.7 % | 9.7 % |
| core · coûts × 1, sans masque des ouvertures | -15 % | -7.1 % | 0.14 | 0.21 | 0.95 | -64.8 % | -0.11 | 263 | 26 % | 5.03 % | -1.74 % | 2.89 | 2.17 | -964 % | 26 % | 121× | 10.9 % | 4.8 % |
| achat conservé | 9 % | 4.1 % | 0.56 | — | — | -79.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.13, intervalle à 90 % (bootstrap des mois) -1.46 à 1.08, P(Sharpe > 0) 42 %.

Coûts et Sharpe : × 0 → 0.20 · × 0,25 → 0.14 · × 0,5 → 0.08 · × 0,75 → 0.02 · × 1 → -0.04. Seuil de rentabilité vers × 0,84, soit 0,055 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 12 % | 0.82 | -29.4 % | 38 |
| 2025 | -49 % | -0.99 | -52.8 % | 92 |
| 2026 | 24 % | 0.84 | -35.8 % | 78 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 52 | 21 % | -0.45 % | -0.28 |
| calme | short | 79 | 32 % | 0.07 % | -0.02 |
| agité | long | 77 | 23 % | -0.01 % | -0.03 |

Entrées au hasard (200 tirages, mêmes sorties, 210 trades en médiane) : Sharpe médian -0.18, 95e centile 0.86 ; la stratégie en bat 57 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.25 | 4.06 | 190 | 2.027 % | -2268 % |
| -1 bougie (utilise le futur) | 2.63 | 2.72 | 192 | 1.616 % | -1807 % |
| à l'heure | -0.04 | 0.89 | 208 | -0.089 % | 100 % |
| +1 bougie | -0.41 | 0.79 | 204 | -0.237 % | 265 % |
| +2 bougies | -0.27 | 0.82 | 203 | -0.175 % | 195 % |
| +4 bougies | -0.16 | 0.87 | 204 | -0.113 % | 127 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 0.08, intervalle à 90 % (bootstrap des mois) -1.05 à 1.07, P(Sharpe > 0) 55 %.

Coûts et Sharpe : × 0 → 0.43 · × 0,25 → 0.36 · × 0,5 → 0.29 · × 0,75 → 0.21 · × 1 → 0.14. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 9 % | 0.69 | -30.6 % | 47 |
| 2025 | -46 % | -0.83 | -53.0 % | 119 |
| 2026 | 45 % | 1.21 | -27.5 % | 97 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 58 | 22 % | -0.02 % | -0.07 |
| calme | short | 82 | 33 % | 0.27 % | 0.13 |
| agité | long | 123 | 23 % | -0.15 % | -0.21 |

Entrées au hasard (200 tirages, mêmes sorties, 258 trades en médiane) : Sharpe médian -0.18, 95e centile 0.85 ; la stratégie en bat 69 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.12 | 5.37 | 235 | 2.207 % | 21235 % |
| -1 bougie (utilise le futur) | 3.54 | 4.18 | 235 | 1.914 % | 18418 % |
| à l'heure | 0.14 | 0.95 | 263 | 0.010 % | 100 % |
| +1 bougie | 0.20 | 0.98 | 257 | 0.056 % | 536 % |
| +2 bougies | 0.32 | 1.03 | 254 | 0.100 % | 959 % |
| +4 bougies | -0.02 | 0.92 | 258 | -0.039 % | -373 % |
