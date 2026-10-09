# Zéro-shot du Shock Engine · TAO/USDT (Binance) · shorts en régime de tendance baissier (E2)

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
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | **non** | **non** |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 249 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 249 | +0.031 | +0.031 | −0.082 à +0.147 | 66 % | +0.165 | −0.072 | 67 % de 3 |
| 4 bougies (1 h) | 249 | +0.016 | +0.014 | −0.246 à +0.303 | 52 % | −0.184 | +0.166 | 33 % de 3 |
| 16 bougies (4 h) | 249 | +0.221 | +0.205 | −0.157 à +0.609 | 81 % | +0.126 | +0.266 | 100 % de 3 |
| 64 bougies (16 h) | 249 | +0.082 | +0.014 | −0.825 à +0.941 | 51 % | −0.317 | +0.268 | 67 % de 3 |

### signaux d'entrée « cœur » · 331 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 331 | −0.002 | −0.002 | −0.097 à +0.096 | 49 % | +0.129 | −0.104 | 67 % de 3 |
| 4 bougies (1 h) | 331 | +0.037 | +0.033 | −0.168 à +0.245 | 61 % | −0.079 | +0.121 | 33 % de 3 |
| 16 bougies (4 h) | 331 | +0.279 | +0.261 | −0.069 à +0.604 | 90 % | +0.364 | +0.180 | 100 % de 3 |
| 64 bougies (16 h) | 331 | +0.282 | +0.206 | −0.684 à +1.079 | 65 % | +0.109 | +0.282 | 67 % de 3 |

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
| Asie (18 h – 2 h) | 82 | +0.186 | −0.169 à +0.559 | +0.340 | −0.325 à +1.058 |
| Londres (2 h – 8 h) | 46 | +0.421 | −0.289 à +1.337 | +0.790 | −0.692 à +2.585 |
| New York matin (8 h – 12 h) | 69 | −0.085 | −0.466 à +0.340 | −0.024 | −0.691 à +0.666 |
| dont bougie de 8 h 30 (annonces) | 2 | +0.578 | +0.325 à +0.830 | +4.897 | +3.280 à +6.513 |
| New York après-midi (12 h – 18 h) | 52 | −0.483 | −0.923 à +0.016 | −0.221 | −1.009 à +0.682 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 3 % | 1.3 % | 0.24 | 0.34 | 1.01 | -45.4 % | 0.03 | 172 | 27 % | 4.64 % | -1.59 % | 2.92 | 2.03 | 3398 % | 16 % | 80× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -18 % | -8.7 % | -0.01 | -0.01 | 0.92 | -50.4 % | -0.17 | 172 | 26 % | 4.61 % | -1.71 % | 2.70 | 2.03 | -472 % | 16 % | 79× | 7.1 % | 3.2 % |
| preset · coûts × 2 | -34 % | -17.8 % | -0.25 | -0.35 | 0.84 | -56.6 % | -0.31 | 172 | 26 % | 4.59 % | -1.82 % | 2.52 | 2.03 | -218 % | 16 % | 79× | 14.2 % | 6.3 % |
| preset · coûts × 1, sans masque des ouvertures | -18 % | -8.7 % | -0.01 | -0.01 | 0.92 | -50.4 % | -0.17 | 172 | 26 % | 4.61 % | -1.71 % | 2.70 | 2.03 | -472 % | 16 % | 79× | 7.1 % | 3.2 % |
| core · coûts × 0 | 12 % | 5.6 % | 0.35 | 0.49 | 1.05 | -50.0 % | 0.11 | 226 | 26 % | 4.51 % | -1.45 % | 3.12 | 2.44 | 1012 % | 18 % | 105× | 0.0 % | 0.0 % |
| core · coûts × 1 | -16 % | -7.9 % | 0.05 | 0.06 | 0.94 | -56.3 % | -0.14 | 226 | 26 % | 4.46 % | -1.57 % | 2.85 | 2.44 | -670 % | 18 % | 104× | 9.4 % | 4.2 % |
| core · coûts × 2 | -37 % | -19.7 % | -0.25 | -0.36 | 0.84 | -61.7 % | -0.32 | 226 | 25 % | 4.41 % | -1.69 % | 2.61 | 2.44 | -248 % | 18 % | 104× | 18.6 % | 8.3 % |
| core · coûts × 1, sans masque des ouvertures | -16 % | -7.9 % | 0.05 | 0.06 | 0.94 | -56.3 % | -0.14 | 226 | 26 % | 4.46 % | -1.57 % | 2.85 | 2.44 | -670 % | 18 % | 104× | 9.4 % | 4.2 % |
| achat conservé | 9 % | 4.1 % | 0.56 | — | — | -79.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.07, intervalle à 90 % (bootstrap des mois) -1.32 à 1.06, P(Sharpe > 0) 46 %.

Coûts et Sharpe : × 0 → 0.24 · × 0,25 → 0.18 · × 0,5 → 0.12 · × 0,75 → 0.06 · × 1 → -0.01. Seuil de rentabilité vers × 0,97, soit 0,063 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 18 % | 1.13 | -23.1 % | 31 |
| 2025 | -31 % | -0.83 | -37.0 % | 73 |
| 2026 | 2 % | 0.27 | -41.1 % | 68 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 52 | 21 % | -0.45 % | -0.28 |
| calme | short | 43 | 37 % | 0.36 % | 0.12 |
| agité | long | 77 | 23 % | -0.01 % | -0.03 |

Entrées au hasard (200 tirages, mêmes sorties, 167 trades en médiane) : Sharpe médian -0.33, 95e centile 0.66 ; la stratégie en bat 70 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.82 | 3.70 | 162 | 1.749 % | -3273 % |
| -1 bougie (utilise le futur) | 2.23 | 2.42 | 165 | 1.330 % | -2488 % |
| à l'heure | -0.01 | 0.92 | 172 | -0.053 % | 100 % |
| +1 bougie | -0.23 | 0.85 | 170 | -0.151 % | 283 % |
| +2 bougies | -0.47 | 0.76 | 171 | -0.271 % | 506 % |
| +4 bougies | -0.17 | 0.87 | 172 | -0.124 % | 232 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier -0.01, intervalle à 90 % (bootstrap des mois) -1.14 à 0.95, P(Sharpe > 0) 48 %.

Coûts et Sharpe : × 0 → 0.35 · × 0,25 → 0.27 · × 0,5 → 0.20 · × 0,75 → 0.12 · × 1 → 0.05. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2024 | 14 % | 0.93 | -25.0 % | 40 |
| 2025 | -38 % | -1.01 | -45.8 % | 99 |
| 2026 | 19 % | 0.72 | -37.4 % | 87 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 58 | 22 % | -0.02 % | -0.07 |
| calme | short | 45 | 38 % | 0.33 % | 0.11 |
| agité | long | 123 | 23 % | -0.15 % | -0.21 |

Entrées au hasard (200 tirages, mêmes sorties, 227 trades en médiane) : Sharpe médian -0.43, 95e centile 0.54 ; la stratégie en bat 80 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.54 | 4.80 | 206 | 1.856 % | -9112 % |
| -1 bougie (utilise le futur) | 3.11 | 3.74 | 207 | 1.617 % | -7939 % |
| à l'heure | 0.05 | 0.94 | 226 | -0.020 % | 100 % |
| +1 bougie | 0.19 | 0.99 | 222 | 0.049 % | -240 % |
| +2 bougies | -0.06 | 0.91 | 221 | -0.056 % | 275 % |
| +4 bougies | -0.28 | 0.85 | 225 | -0.148 % | 727 % |
