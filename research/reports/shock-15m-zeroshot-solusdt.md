# Zéro-shot du Shock Engine · SOL/USDT (Binance)

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
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 901 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 901 | +0.030 | +0.027 | −0.050 à +0.102 | 73 % | −0.103 | +0.168 | 67 % de 6 |
| 4 bougies (1 h) | 901 | +0.106 | +0.104 | −0.057 à +0.271 | 85 % | +0.001 | +0.215 | 67 % de 6 |
| 16 bougies (4 h) | 901 | +0.131 | +0.123 | −0.103 à +0.374 | 81 % | +0.057 | +0.193 | 67 % de 6 |
| 64 bougies (16 h) | 901 | +0.635 | +0.592 | +0.160 à +1.024 | 98 % | +0.636 | +0.544 | 83 % de 6 |

### signaux d'entrée « cœur » · 1 066 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1066 | +0.027 | +0.025 | −0.048 à +0.096 | 71 % | −0.111 | +0.166 | 67 % de 6 |
| 4 bougies (1 h) | 1066 | +0.101 | +0.098 | −0.049 à +0.251 | 85 % | −0.026 | +0.228 | 67 % de 6 |
| 16 bougies (4 h) | 1066 | +0.120 | +0.111 | −0.109 à +0.331 | 80 % | +0.010 | +0.216 | 67 % de 6 |
| 64 bougies (16 h) | 1066 | +0.666 | +0.615 | +0.216 à +1.053 | 99 % | +0.529 | +0.704 | 100 % de 6 |

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
| Asie (18 h – 2 h) | 296 | +0.292 | +0.026 à +0.604 | +0.345 | −0.045 à +0.751 |
| Londres (2 h – 8 h) | 139 | −0.158 | −0.422 à +0.084 | −0.342 | −0.776 à +0.091 |
| New York matin (8 h – 12 h) | 250 | +0.141 | −0.174 à +0.451 | +0.543 | +0.072 à +1.043 |
| dont bougie de 8 h 30 (annonces) | 19 | +0.019 | −0.833 à +0.995 | +1.231 | −0.664 à +3.526 |
| New York après-midi (12 h – 18 h) | 216 | −0.028 | −0.221 à +0.172 | −0.369 | −0.816 à +0.053 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 453 % | 40.0 % | 0.92 | 1.33 | 1.28 | -46.1 % | 0.87 | 534 | 27 % | 5.91 % | -1.58 % | 3.73 | 5.63 | 263 % | 30 % | 105× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 208 % | 24.8 % | 0.69 | 1.00 | 1.16 | -49.7 % | 0.50 | 534 | 27 % | 5.88 % | -1.68 % | 3.49 | 5.63 | 397 % | 30 % | 105× | 9.4 % | 2.1 % |
| preset · coûts × 2 | 72 % | 11.2 % | 0.46 | 0.67 | 1.07 | -53.2 % | 0.21 | 534 | 26 % | 5.89 % | -1.78 % | 3.31 | 5.62 | 822 % | 30 % | 104× | 18.7 % | 4.2 % |
| preset · coûts × 1, sans masque des ouvertures | 208 % | 24.8 % | 0.69 | 1.00 | 1.16 | -49.7 % | 0.50 | 534 | 27 % | 5.88 % | -1.68 % | 3.49 | 5.63 | 397 % | 30 % | 105× | 9.4 % | 2.1 % |
| core · coûts × 0 | 1380 % | 69.9 % | 1.24 | 1.85 | 1.37 | -43.7 % | 1.60 | 622 | 28 % | 6.11 % | -1.53 % | 4.01 | 9.78 | 212 % | 34 % | 126× | 0.0 % | 0.0 % |
| core · coûts × 1 | 649 % | 48.6 % | 0.99 | 1.48 | 1.24 | -46.8 % | 1.04 | 622 | 28 % | 6.07 % | -1.63 % | 3.73 | 9.77 | 282 % | 34 % | 125× | 11.3 % | 2.5 % |
| core · coûts × 2 | 279 % | 30.0 % | 0.75 | 1.11 | 1.14 | -50.0 % | 0.60 | 622 | 27 % | 6.10 % | -1.72 % | 3.54 | 9.77 | 424 % | 34 % | 125× | 22.4 % | 5.0 % |
| core · coûts × 1, sans masque des ouvertures | 649 % | 48.6 % | 0.99 | 1.48 | 1.24 | -46.8 % | 1.04 | 622 | 28 % | 6.07 % | -1.63 % | 3.73 | 9.77 | 282 % | 34 % | 125× | 11.3 % | 2.5 % |
| achat conservé | 9 % | 1.7 % | 0.49 | — | — | -96.3 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 0.70, intervalle à 90 % (bootstrap des mois) 0.00 à 1.37, P(Sharpe > 0) 95 %.

Coûts et Sharpe : × 0 → 0.92 · × 0,25 → 0.86 · × 0,5 → 0.80 · × 0,75 → 0.75 · × 1 → 0.69. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 40 % | 1.67 | -26.1 % | 30 |
| 2022 | 15 % | 0.54 | -33.8 % | 99 |
| 2023 | 42 % | 0.93 | -32.5 % | 108 |
| 2024 | -10 % | 0.00 | -46.7 % | 109 |
| 2025 | 4 % | 0.31 | -27.1 % | 111 |
| 2026 | 43 % | 1.50 | -27.4 % | 77 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 156 | 25 % | 0.66 % | 0.68 |
| calme | short | 231 | 29 % | 0.53 % | 0.90 |
| agité | long | 147 | 24 % | -0.30 % | -0.46 |

Entrées au hasard (200 tirages, mêmes sorties, 533 trades en médiane) : Sharpe médian -0.06, 95e centile 0.69 ; la stratégie en bat 95 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.95 | 4.64 | 468 | 2.583 % | 757 % |
| -1 bougie (utilise le futur) | 3.52 | 3.92 | 471 | 2.292 % | 672 % |
| à l'heure | 0.69 | 1.16 | 534 | 0.341 % | 100 % |
| +1 bougie | 0.65 | 1.14 | 533 | 0.316 % | 93 % |
| +2 bougies | 0.77 | 1.16 | 522 | 0.452 % | 132 % |
| +4 bougies | 0.70 | 1.13 | 521 | 0.404 % | 119 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.02, intervalle à 90 % (bootstrap des mois) 0.25 à 1.78, P(Sharpe > 0) 99 %.

Coûts et Sharpe : × 0 → 1.24 · × 0,25 → 1.18 · × 0,5 → 1.12 · × 0,75 → 1.06 · × 1 → 0.99. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2021 | 52 % | 1.94 | -21.3 % | 33 |
| 2022 | -2 % | 0.28 | -34.0 % | 113 |
| 2023 | 243 % | 2.26 | -35.1 % | 123 |
| 2024 | -20 % | -0.21 | -46.8 % | 131 |
| 2025 | 21 % | 0.67 | -25.0 % | 128 |
| 2026 | 53 % | 1.69 | -26.3 % | 94 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 174 | 28 % | 1.49 % | 1.78 |
| calme | short | 243 | 29 % | 0.46 % | 0.78 |
| agité | long | 205 | 26 % | -0.26 % | -0.55 |

Entrées au hasard (200 tirages, mêmes sorties, 618.5 trades en médiane) : Sharpe médian -0.16, 95e centile 0.69 ; la stratégie en bat 99 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.38 | 6.01 | 550 | 2.536 % | 494 % |
| -1 bougie (utilise le futur) | 4.00 | 5.29 | 551 | 2.321 % | 453 % |
| à l'heure | 0.99 | 1.24 | 622 | 0.513 % | 100 % |
| +1 bougie | 0.92 | 1.22 | 622 | 0.476 % | 93 % |
| +2 bougies | 0.80 | 1.16 | 616 | 0.423 % | 82 % |
| +4 bougies | 0.81 | 1.16 | 608 | 0.434 % | 85 % |
