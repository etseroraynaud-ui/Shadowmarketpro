# Zéro-shot du Shock Engine · ETH/USD (Dukascopy)

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
| Étude d'événement des signaux : même critère | oui | oui |
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | oui |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 932 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 932 | +0.125 | +0.126 | +0.043 à +0.205 | 99 % | +0.150 | +0.105 | 100 % de 8 |
| 4 bougies (1 h) | 932 | +0.202 | +0.206 | +0.065 à +0.350 | 99 % | +0.369 | +0.074 | 75 % de 8 |
| 16 bougies (4 h) | 932 | +0.265 | +0.262 | +0.028 à +0.508 | 97 % | +0.365 | +0.178 | 88 % de 8 |
| 64 bougies (16 h) | 931 | +1.308 | +1.209 | +0.657 à +1.744 | 100 % | +1.393 | +1.060 | 100 % de 8 |

### signaux d'entrée « cœur » · 1 430 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1430 | +0.102 | +0.102 | +0.037 à +0.164 | 99 % | +0.129 | +0.079 | 100 % de 8 |
| 4 bougies (1 h) | 1430 | +0.141 | +0.142 | +0.034 à +0.252 | 98 % | +0.279 | +0.020 | 75 % de 8 |
| 16 bougies (4 h) | 1430 | +0.214 | +0.208 | +0.009 à +0.395 | 96 % | +0.185 | +0.228 | 88 % de 8 |
| 64 bougies (16 h) | 1429 | +1.030 | +0.929 | +0.528 à +1.333 | 100 % | +1.042 | +0.828 | 100 % de 8 |

### chocs bruts (|z| > seuil du régime) · 6 833 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6833 | +0.082 | +0.082 | +0.060 à +0.106 | 100 % | +0.099 | +0.068 | 100 % de 8 |
| 4 bougies (1 h) | 6833 | +0.089 | +0.089 | +0.045 à +0.132 | 100 % | +0.104 | +0.076 | 100 % de 8 |
| 16 bougies (4 h) | 6833 | +0.086 | +0.092 | +0.023 à +0.165 | 99 % | +0.056 | +0.124 | 88 % de 8 |
| 64 bougies (16 h) | 6830 | +0.270 | +0.287 | +0.166 à +0.409 | 100 % | +0.275 | +0.297 | 88 % de 8 |

### chocs bruts dans le sens de la tendance 60 min · 4 289 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 4289 | +0.086 | +0.086 | +0.055 à +0.117 | 100 % | +0.104 | +0.071 | 88 % de 8 |
| 4 bougies (1 h) | 4289 | +0.104 | +0.104 | +0.045 à +0.162 | 100 % | +0.091 | +0.114 | 88 % de 8 |
| 16 bougies (4 h) | 4289 | +0.130 | +0.139 | +0.046 à +0.226 | 99 % | +0.073 | +0.194 | 75 % de 8 |
| 64 bougies (16 h) | 4287 | +0.510 | +0.522 | +0.316 à +0.728 | 100 % | +0.641 | +0.421 | 100 % de 8 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 1104 | +0.169 | +0.041 à +0.299 | +0.172 | −0.030 à +0.394 |
| Londres (2 h – 8 h) | 737 | +0.130 | −0.008 à +0.271 | +0.184 | −0.089 à +0.458 |
| New York matin (8 h – 12 h) | 1327 | +0.179 | +0.071 à +0.288 | +0.331 | +0.144 à +0.522 |
| dont bougie de 8 h 30 (annonces) | 109 | +0.166 | −0.164 à +0.513 | +0.507 | −0.352 à +1.443 |
| New York après-midi (12 h – 18 h) | 1121 | −0.068 | −0.187 à +0.049 | −0.152 | −0.359 à +0.052 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 216 | +0.132 | −0.102 à +0.389 | −0.148 | −0.584 à +0.264 |
| Londres (2 h – 8 h) | 176 | +0.302 | +0.036 à +0.575 | +0.588 | +0.039 à +1.112 |
| New York matin (8 h – 12 h) | 312 | +0.394 | +0.089 à +0.694 | +0.503 | −0.063 à +1.103 |
| dont bougie de 8 h 30 (annonces) | 31 | +0.115 | −0.603 à +0.849 | +1.118 | −1.342 à +4.144 |
| New York après-midi (12 h – 18 h) | 228 | −0.054 | −0.357 à +0.235 | +0.068 | −0.525 à +0.657 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 5479 % | 68.1 % | 1.64 | 2.51 | 1.76 | -32.5 % | 2.09 | 590 | 32 % | 4.85 % | -1.14 % | 4.25 | 4.26 | 113 % | 23 % | 77× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 3185 % | 57.0 % | 1.44 | 2.20 | 1.58 | -35.7 % | 1.59 | 590 | 32 % | 4.84 % | -1.22 % | 3.96 | 4.26 | 130 % | 23 % | 77× | 7.0 % | 0.0 % |
| preset · coûts × 2 | 1834 % | 46.6 % | 1.25 | 1.90 | 1.43 | -38.8 % | 1.20 | 590 | 31 % | 4.83 % | -1.30 % | 3.70 | 4.26 | 152 % | 23 % | 77× | 13.9 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 3027 % | 56.0 % | 1.43 | 2.17 | 1.56 | -37.1 % | 1.51 | 596 | 32 % | 4.79 % | -1.22 % | 3.91 | 4.28 | 131 % | 23 % | 78× | 7.0 % | 0.0 % |
| core · coûts × 0 | 10865 % | 83.4 % | 1.73 | 2.63 | 1.70 | -26.0 % | 3.20 | 835 | 31 % | 4.53 % | -1.11 % | 4.07 | 3.61 | 128 % | 30 % | 104× | 0.0 % | 0.0 % |
| core · coûts × 1 | 5081 % | 66.5 % | 1.48 | 2.24 | 1.51 | -35.2 % | 1.89 | 835 | 31 % | 4.50 % | -1.19 % | 3.77 | 3.61 | 151 % | 30 % | 106× | 9.5 % | 0.0 % |
| core · coûts × 2 | 2346 % | 51.1 % | 1.23 | 1.86 | 1.35 | -43.6 % | 1.17 | 835 | 30 % | 4.48 % | -1.28 % | 3.51 | 3.61 | 185 % | 30 % | 107× | 19.3 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 7177 % | 73.9 % | 1.57 | 2.37 | 1.52 | -33.6 % | 2.20 | 850 | 30 % | 4.68 % | -1.20 % | 3.89 | 3.53 | 147 % | 31 % | 107× | 9.6 % | 0.0 % |
| achat conservé | 1917 % | 47.4 % | 0.89 | — | — | -78.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.43, intervalle à 90 % (bootstrap des mois) 0.97 à 1.87, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.64 · × 0,25 → 1.59 · × 0,5 → 1.54 · × 0,75 → 1.49 · × 1 → 1.44. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 128 % | 1.81 | -20.3 % | 41 |
| 2020 | 149 % | 2.58 | -20.8 % | 81 |
| 2021 | 59 % | 1.49 | -18.7 % | 60 |
| 2022 | -8 % | -0.10 | -35.7 % | 88 |
| 2023 | 17 % | 0.68 | -19.9 % | 109 |
| 2024 | 36 % | 1.51 | -10.4 % | 79 |
| 2025 | 67 % | 1.73 | -21.7 % | 75 |
| 2026 | 50 % | 1.87 | -15.3 % | 57 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 130 | 41 % | 2.73 % | 3.19 |
| calme | short | 254 | 25 % | 0.08 % | 0.03 |
| agité | long | 206 | 33 % | 0.15 % | 0.27 |

Entrées au hasard (200 tirages, mêmes sorties, 594 trades en médiane) : Sharpe médian 0.16, 95e centile 0.72 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.23 | 6.72 | 552 | 2.367 % | 344 % |
| -1 bougie (utilise le futur) | 3.94 | 5.60 | 551 | 2.230 % | 324 % |
| à l'heure | 1.44 | 1.58 | 590 | 0.688 % | 100 % |
| +1 bougie | 1.02 | 1.44 | 595 | 0.454 % | 66 % |
| +2 bougies | 0.99 | 1.40 | 595 | 0.455 % | 66 % |
| +4 bougies | 0.86 | 1.37 | 591 | 0.399 % | 58 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.47, intervalle à 90 % (bootstrap des mois) 1.00 à 1.93, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.73 · × 0,25 → 1.66 · × 0,5 → 1.60 · × 0,75 → 1.54 · × 1 → 1.48. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 178 % | 2.06 | -19.4 % | 59 |
| 2020 | 138 % | 2.38 | -21.9 % | 106 |
| 2021 | 54 % | 1.23 | -17.9 % | 109 |
| 2022 | 11 % | 0.46 | -28.4 % | 125 |
| 2023 | -1 % | 0.13 | -29.1 % | 147 |
| 2024 | 37 % | 1.44 | -14.1 % | 115 |
| 2025 | 117 % | 2.34 | -20.9 % | 101 |
| 2026 | 55 % | 1.92 | -17.7 % | 73 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 199 | 36 % | 2.00 % | 3.58 |
| calme | short | 310 | 26 % | 0.11 % | 0.12 |
| agité | long | 326 | 32 % | 0.09 % | 0.25 |

Entrées au hasard (200 tirages, mêmes sorties, 833 trades en médiane) : Sharpe médian 0.15, 95e centile 0.74 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.96 | 6.51 | 768 | 2.238 % | 405 % |
| -1 bougie (utilise le futur) | 4.62 | 5.47 | 766 | 2.102 % | 380 % |
| à l'heure | 1.48 | 1.51 | 835 | 0.553 % | 100 % |
| +1 bougie | 1.22 | 1.48 | 838 | 0.447 % | 81 % |
| +2 bougies | 1.18 | 1.44 | 826 | 0.441 % | 80 % |
| +4 bougies | 1.12 | 1.44 | 818 | 0.422 % | 76 % |
