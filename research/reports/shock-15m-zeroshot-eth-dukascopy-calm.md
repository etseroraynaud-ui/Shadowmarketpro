# Zéro-shot du Shock Engine · ETH/USD (Dukascopy) · régime calme seul, shorts en régime de tendance baissier

15 min, 2019-01-01 → 2026-09-30 (7.7 ans, préchauffage depuis 2018-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset eth-dukascopy --draws 200 --calm`.

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

### signaux d'entrée complets · 364 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 364 | +0.182 | +0.181 | +0.039 à +0.331 | 98 % | +0.161 | +0.200 | 88 % de 8 |
| 4 bougies (1 h) | 364 | +0.347 | +0.349 | +0.051 à +0.641 | 98 % | +0.379 | +0.322 | 88 % de 8 |
| 16 bougies (4 h) | 364 | +0.639 | +0.587 | +0.109 à +1.130 | 98 % | +0.592 | +0.582 | 75 % de 8 |
| 64 bougies (16 h) | 364 | +2.405 | +2.195 | +1.100 à +3.423 | 100 % | +1.536 | +2.779 | 88 % de 8 |

### signaux d'entrée « cœur » · 580 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 580 | +0.136 | +0.137 | +0.038 à +0.237 | 99 % | +0.113 | +0.161 | 88 % de 8 |
| 4 bougies (1 h) | 580 | +0.266 | +0.264 | +0.075 à +0.465 | 99 % | +0.330 | +0.197 | 75 % de 8 |
| 16 bougies (4 h) | 580 | +0.492 | +0.443 | +0.061 à +0.840 | 97 % | +0.325 | +0.560 | 88 % de 8 |
| 64 bougies (16 h) | 580 | +1.768 | +1.553 | +0.803 à +2.409 | 100 % | +1.090 | +2.016 | 100 % de 8 |

### chocs bruts (|z| > seuil du régime) · 6 833 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6833 | +0.082 | +0.082 | +0.059 à +0.106 | 100 % | +0.099 | +0.068 | 100 % de 8 |
| 4 bougies (1 h) | 6833 | +0.089 | +0.089 | +0.043 à +0.132 | 100 % | +0.104 | +0.076 | 100 % de 8 |
| 16 bougies (4 h) | 6833 | +0.086 | +0.092 | +0.022 à +0.159 | 99 % | +0.056 | +0.124 | 88 % de 8 |
| 64 bougies (16 h) | 6830 | +0.270 | +0.287 | +0.165 à +0.404 | 100 % | +0.275 | +0.297 | 88 % de 8 |

### chocs bruts dans le sens de la tendance 60 min · 4 289 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 4289 | +0.086 | +0.086 | +0.054 à +0.117 | 100 % | +0.104 | +0.071 | 88 % de 8 |
| 4 bougies (1 h) | 4289 | +0.104 | +0.104 | +0.046 à +0.162 | 100 % | +0.091 | +0.114 | 88 % de 8 |
| 16 bougies (4 h) | 4289 | +0.130 | +0.139 | +0.047 à +0.230 | 99 % | +0.073 | +0.194 | 75 % de 8 |
| 64 bougies (16 h) | 4287 | +0.510 | +0.522 | +0.324 à +0.740 | 100 % | +0.641 | +0.421 | 100 % de 8 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 1104 | +0.169 | +0.042 à +0.296 | +0.172 | −0.029 à +0.380 |
| Londres (2 h – 8 h) | 737 | +0.130 | +0.000 à +0.264 | +0.184 | −0.084 à +0.474 |
| New York matin (8 h – 12 h) | 1327 | +0.179 | +0.069 à +0.286 | +0.331 | +0.141 à +0.513 |
| dont bougie de 8 h 30 (annonces) | 109 | +0.166 | −0.145 à +0.501 | +0.507 | −0.297 à +1.451 |
| New York après-midi (12 h – 18 h) | 1121 | −0.068 | −0.190 à +0.045 | −0.152 | −0.362 à +0.052 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 75 | +0.117 | −0.225 à +0.437 | +0.418 | −0.360 à +1.138 |
| Londres (2 h – 8 h) | 58 | +0.443 | +0.022 à +0.912 | +0.383 | −0.414 à +1.171 |
| New York matin (8 h – 12 h) | 138 | +0.709 | +0.105 à +1.287 | +0.714 | −0.282 à +1.974 |
| dont bougie de 8 h 30 (annonces) | 16 | −0.154 | −0.990 à +0.798 | +1.740 | −2.053 à +7.257 |
| New York après-midi (12 h – 18 h) | 93 | −0.057 | −0.542 à +0.413 | +0.660 | −0.092 à +1.380 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 3953 % | 61.3 % | 1.91 | 2.91 | 2.58 | -22.2 % | 2.76 | 206 | 38 % | 7.51 % | -1.35 % | 5.56 | 3.07 | 57 % | 13 % | 29× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 3273 % | 57.5 % | 1.82 | 2.77 | 2.38 | -23.6 % | 2.44 | 206 | 37 % | 7.61 % | -1.42 % | 5.37 | 3.07 | 60 % | 13 % | 29× | 2.6 % | 0.0 % |
| preset · coûts × 2 | 2707 % | 53.8 % | 1.73 | 2.62 | 2.21 | -25.0 % | 2.16 | 206 | 36 % | 7.62 % | -1.50 % | 5.09 | 3.07 | 63 % | 13 % | 29× | 5.2 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 3232 % | 57.2 % | 1.81 | 2.76 | 2.37 | -23.6 % | 2.43 | 207 | 37 % | 7.61 % | -1.42 % | 5.38 | 3.08 | 60 % | 13 % | 29× | 2.6 % | 0.0 % |
| core · coûts × 0 | 6169 % | 70.6 % | 1.91 | 2.90 | 2.13 | -23.5 % | 3.00 | 289 | 34 % | 7.39 % | -1.42 % | 5.22 | 2.42 | 65 % | 17 % | 39× | 0.0 % | 0.0 % |
| core · coûts × 1 | 4742 % | 65.0 % | 1.80 | 2.72 | 1.97 | -25.0 % | 2.60 | 289 | 34 % | 7.45 % | -1.49 % | 5.00 | 2.42 | 69 % | 17 % | 39× | 3.5 % | 0.0 % |
| core · coûts × 2 | 3639 % | 59.6 % | 1.69 | 2.54 | 1.83 | -26.5 % | 2.25 | 289 | 33 % | 7.44 % | -1.57 % | 4.73 | 2.42 | 74 % | 17 % | 39× | 7.1 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 7661 % | 75.4 % | 1.92 | 2.88 | 2.11 | -27.0 % | 2.80 | 298 | 34 % | 7.72 % | -1.48 % | 5.22 | 2.33 | 66 % | 18 % | 41× | 3.7 % | 0.0 % |
| achat conservé | 1917 % | 47.4 % | 0.89 | — | — | -78.5 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.78, intervalle à 90 % (bootstrap des mois) 1.33 à 2.24, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.91 · × 0,25 → 1.89 · × 0,5 → 1.86 · × 0,75 → 1.84 · × 1 → 1.82. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 96 % | 1.83 | -14.1 % | 17 |
| 2020 | 152 % | 2.96 | -9.9 % | 22 |
| 2021 | 69 % | 2.32 | -8.7 % | 12 |
| 2022 | 11 % | 0.57 | -23.6 % | 45 |
| 2023 | 30 % | 1.34 | -12.9 % | 44 |
| 2024 | 26 % | 1.67 | -7.5 % | 13 |
| 2025 | 65 % | 2.00 | -17.4 % | 29 |
| 2026 | 34 % | 1.92 | -14.6 % | 24 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 130 | 41 % | 2.73 % | 3.19 |
| calme | short | 76 | 30 % | 0.52 % | 0.33 |

Entrées au hasard (200 tirages, mêmes sorties, 209 trades en médiane) : Sharpe médian 0.70, 95e centile 1.10 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.09 | 9.04 | 191 | 3.789 % | 198 % |
| -1 bougie (utilise le futur) | 2.92 | 6.77 | 191 | 3.597 % | 188 % |
| à l'heure | 1.82 | 2.38 | 206 | 1.914 % | 100 % |
| +1 bougie | 1.40 | 2.13 | 209 | 1.394 % | 73 % |
| +2 bougies | 1.45 | 2.16 | 210 | 1.444 % | 75 % |
| +4 bougies | 1.33 | 1.98 | 205 | 1.341 % | 70 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.75, intervalle à 90 % (bootstrap des mois) 1.26 à 2.18, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.91 · × 0,25 → 1.89 · × 0,5 → 1.86 · × 0,75 → 1.83 · × 1 → 1.80. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2019 | 126 % | 1.99 | -15.3 % | 27 |
| 2020 | 155 % | 2.92 | -10.4 % | 29 |
| 2021 | 101 % | 2.54 | -10.3 % | 25 |
| 2022 | 9 % | 0.44 | -25.0 % | 62 |
| 2023 | 25 % | 1.07 | -14.3 % | 59 |
| 2024 | 23 % | 1.41 | -11.5 % | 19 |
| 2025 | 88 % | 2.32 | -21.9 % | 35 |
| 2026 | 32 % | 1.65 | -17.3 % | 33 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 199 | 36 % | 2.00 % | 3.58 |
| calme | short | 90 | 29 % | 0.42 % | 0.30 |

Entrées au hasard (200 tirages, mêmes sorties, 289 trades en médiane) : Sharpe médian 0.80, 95e centile 1.28 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.46 | 7.37 | 260 | 3.571 % | 236 % |
| -1 bougie (utilise le futur) | 3.25 | 5.71 | 261 | 3.329 % | 220 % |
| à l'heure | 1.80 | 1.97 | 289 | 1.511 % | 100 % |
| +1 bougie | 1.62 | 2.06 | 289 | 1.356 % | 90 % |
| +2 bougies | 1.58 | 1.91 | 288 | 1.305 % | 86 % |
| +4 bougies | 1.64 | 2.00 | 280 | 1.399 % | 93 % |
