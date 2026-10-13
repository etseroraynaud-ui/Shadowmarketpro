# Zéro-shot du Shock Engine · TAO/USDT (Binance) · régime calme seul, shorts en régime de tendance baissier

15 min, 2024-08-15 → 2026-09-30 (2.1 ans, préchauffage depuis 2024-04-11). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,02 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset taousdt --draws 200 --calm`.

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
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | **non** | **non** |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 139 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 139 | +0.036 | +0.038 | −0.099 à +0.231 | 67 % | +0.343 | −0.098 | 67 % de 3 |
| 4 bougies (1 h) | 139 | +0.010 | +0.016 | −0.290 à +0.355 | 53 % | −0.149 | +0.090 | 33 % de 3 |
| 16 bougies (4 h) | 139 | +0.020 | +0.020 | −0.435 à +0.571 | 54 % | −0.135 | +0.090 | 33 % de 3 |
| 64 bougies (16 h) | 139 | −0.044 | −0.037 | −0.917 à +0.793 | 49 % | −0.800 | +0.304 | 33 % de 3 |

### signaux d'entrée « cœur » · 159 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 159 | +0.032 | +0.034 | −0.105 à +0.227 | 64 % | +0.357 | −0.109 | 67 % de 3 |
| 4 bougies (1 h) | 159 | +0.018 | +0.024 | −0.280 à +0.362 | 55 % | +0.055 | +0.010 | 33 % de 3 |
| 16 bougies (4 h) | 159 | −0.020 | −0.023 | −0.490 à +0.534 | 49 % | +0.232 | −0.137 | 33 % de 3 |
| 64 bougies (16 h) | 159 | +0.063 | +0.055 | −0.800 à +0.821 | 57 % | −0.296 | +0.211 | 33 % de 3 |

### chocs bruts (|z| > seuil du régime) · 2 371 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 2371 | −0.031 | −0.032 | −0.055 à −0.007 | 2 % | −0.021 | −0.044 | 0 % de 3 |
| 4 bougies (1 h) | 2371 | −0.053 | −0.051 | −0.107 à +0.004 | 6 % | −0.121 | +0.028 | 33 % de 3 |
| 16 bougies (4 h) | 2370 | −0.010 | −0.009 | −0.096 à +0.076 | 42 % | +0.007 | −0.027 | 33 % de 3 |
| 64 bougies (16 h) | 2367 | +0.091 | +0.084 | −0.050 à +0.226 | 84 % | +0.023 | +0.154 | 67 % de 3 |

### chocs bruts dans le sens de la tendance 60 min · 1 380 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1380 | −0.007 | −0.006 | −0.039 à +0.027 | 38 % | +0.015 | −0.030 | 33 % de 3 |
| 4 bougies (1 h) | 1380 | −0.010 | −0.009 | −0.078 à +0.059 | 42 % | −0.077 | +0.066 | 33 % de 3 |
| 16 bougies (4 h) | 1380 | +0.102 | +0.104 | −0.069 à +0.258 | 84 % | +0.154 | +0.050 | 67 % de 3 |
| 64 bougies (16 h) | 1378 | +0.306 | +0.304 | −0.025 à +0.642 | 93 % | +0.414 | +0.181 | 100 % de 3 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 370 | +0.102 | −0.147 à +0.368 | +0.099 | −0.261 à +0.463 |
| Londres (2 h – 8 h) | 264 | +0.030 | −0.152 à +0.230 | −0.022 | −0.435 à +0.388 |
| New York matin (8 h – 12 h) | 417 | −0.039 | −0.188 à +0.109 | +0.182 | −0.180 à +0.523 |
| dont bougie de 8 h 30 (annonces) | 23 | −0.013 | −0.584 à +0.462 | +0.332 | −0.790 à +1.420 |
| New York après-midi (12 h – 18 h) | 329 | −0.128 | −0.265 à +0.015 | +0.114 | −0.177 à +0.393 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 49 | +0.229 | −0.311 à +0.774 | +0.183 | −0.878 à +1.326 |
| Londres (2 h – 8 h) | 14 | +0.076 | −0.353 à +0.498 | −0.199 | −1.190 à +1.099 |
| New York matin (8 h – 12 h) | 45 | −0.184 | −0.604 à +0.366 | −0.137 | −1.018 à +0.831 |
| dont bougie de 8 h 30 (annonces) | 0 | — | +0.000 à +0.000 | — | +0.000 à +0.000 |
| New York après-midi (12 h – 18 h) | 31 | −0.058 | −0.772 à +0.696 | +0.091 | −1.051 à +1.463 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | -4 % | -1.8 % | 0.16 | 0.22 | 0.97 | -36.4 % | -0.05 | 95 | 29 % | 5.24 % | -2.13 % | 2.46 | 1.79 | -1531 % | 15 % | 44× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -15 % | -7.3 % | 0.01 | 0.02 | 0.90 | -39.2 % | -0.19 | 95 | 28 % | 5.30 % | -2.23 % | 2.38 | 1.79 | -355 % | 15 % | 44× | 3.9 % | 1.8 % |
| preset · coûts × 2 | -25 % | -12.5 % | -0.13 | -0.18 | 0.83 | -45.5 % | -0.28 | 95 | 28 % | 5.17 % | -2.36 % | 2.20 | 1.79 | -199 % | 15 % | 43× | 7.8 % | 3.5 % |
| preset · coûts × 1, sans masque des ouvertures | -15 % | -7.3 % | 0.01 | 0.02 | 0.90 | -39.2 % | -0.19 | 95 | 28 % | 5.30 % | -2.23 % | 2.38 | 1.79 | -355 % | 15 % | 44× | 3.9 % | 1.8 % |
| core · coûts × 0 | 19 % | 8.5 % | 0.40 | 0.57 | 1.12 | -35.3 % | 0.24 | 103 | 30 % | 5.50 % | -1.99 % | 2.76 | 2.03 | 381 % | 16 % | 47× | 0.0 % | 0.0 % |
| core · coûts × 1 | 4 % | 1.9 % | 0.25 | 0.36 | 1.03 | -39.5 % | 0.05 | 103 | 29 % | 5.55 % | -2.10 % | 2.65 | 2.03 | 1658 % | 16 % | 47× | 4.2 % | 1.9 % |
| core · coûts × 2 | -9 % | -4.3 % | 0.11 | 0.15 | 0.94 | -43.6 % | -0.10 | 103 | 29 % | 5.42 % | -2.23 % | 2.43 | 2.03 | -688 % | 16 % | 46× | 8.3 % | 3.7 % |
| core · coûts × 1, sans masque des ouvertures | 4 % | 1.9 % | 0.25 | 0.36 | 1.03 | -39.5 % | 0.05 | 103 | 29 % | 5.55 % | -2.10 % | 2.65 | 2.03 | 1658 % | 16 % | 47× | 4.2 % | 1.9 % |
| achat conservé | 9 % | 4.1 % | 0.56 | — | — | -79.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.06, intervalle à 90 % (bootstrap des mois) -1.31 à 1.00, P(Sharpe > 0) 46 %.

Coûts et Sharpe : × 0 → 0.16 · × 0,25 → 0.12 · × 0,5 → 0.08 · × 0,75 → 0.05 · × 1 → 0.01. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 2 % | 0.35 | -22.1 % | 6 |
| 2025 | -17 % | -0.34 | -26.8 % | 47 |
| 2026 | 1 % | 0.23 | -38.8 % | 42 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 52 | 21 % | -0.45 % | -0.28 |
| calme | short | 43 | 37 % | 0.36 % | 0.12 |

Entrées au hasard (200 tirages, mêmes sorties, 94 trades en médiane) : Sharpe médian -0.07, 95e centile 0.81 ; la stratégie en bat 55 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 1.80 | 3.06 | 87 | 1.884 % | -2203 % |
| -1 bougie (utilise le futur) | 1.22 | 1.83 | 92 | 1.142 % | -1334 % |
| à l'heure | 0.01 | 0.90 | 95 | -0.086 % | 100 % |
| +1 bougie | -0.31 | 0.76 | 95 | -0.331 % | 387 % |
| +2 bougies | -0.40 | 0.72 | 95 | -0.410 % | 479 % |
| +4 bougies | -0.11 | 0.85 | 95 | -0.172 % | 201 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 0.23, intervalle à 90 % (bootstrap des mois) -0.78 à 1.08, P(Sharpe > 0) 65 %.

Coûts et Sharpe : × 0 → 0.40 · × 0,25 → 0.37 · × 0,5 → 0.33 · × 0,75 → 0.29 · × 1 → 0.25. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 5 % | 0.49 | -21.1 % | 6 |
| 2025 | -19 % | -0.41 | -35.2 % | 52 |
| 2026 | 23 % | 0.84 | -32.7 % | 45 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 58 | 22 % | -0.02 % | -0.07 |
| calme | short | 45 | 38 % | 0.33 % | 0.11 |

Entrées au hasard (200 tirages, mêmes sorties, 103 trades en médiane) : Sharpe médian -0.26, 95e centile 0.64 ; la stratégie en bat 78 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 1.98 | 3.34 | 92 | 2.022 % | 1545 % |
| -1 bougie (utilise le futur) | 1.63 | 2.58 | 94 | 1.606 % | 1227 % |
| à l'heure | 0.25 | 1.03 | 103 | 0.131 % | 100 % |
| +1 bougie | -0.05 | 0.87 | 103 | -0.111 % | -85 % |
| +2 bougies | -0.08 | 0.86 | 103 | -0.142 % | -108 % |
| +4 bougies | -0.24 | 0.80 | 105 | -0.269 % | -205 % |
