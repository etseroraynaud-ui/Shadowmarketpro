# Zéro-shot du Shock Engine · BTC/USD (Bitstamp) · shorts en régime de tendance baissier (E2)

15 min, 2017-01-01 → 2026-10-04 (9.8 ans, préchauffage depuis 2016-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre, sans levier. Produit par `node research/shock/zero-shot.ts --asset btc --draws 200`.

## Données

- 341 941 bougies de 15 min ; 33 suivent une fermeture (masquées pour les entrées) ; 0 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.392 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2020-03-13 02:30 +45.8 · 2017-03-10 21:00 −39.8 · 2019-06-26 20:30 −33.9 · 2020-03-13 02:15 +33.2 · 2020-03-12 10:30 −31.1 · 2020-03-13 01:45 −28.6 · 2019-05-17 03:15 +27.7 · 2021-05-19 13:30 +27.5.
- Plus forts sauts **à l'ouverture** (masqués) : 2022-05-11 09:00 +5.3 · 2022-07-13 12:15 +3.2 · 2017-11-29 20:45 +2.4 · 2025-10-17 13:00 −2.2 · 2024-12-07 04:30 −2.0 · 2022-01-05 10:15 +1.9.

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

### signaux d'entrée complets · 1 249 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1249 | +0.144 | +0.139 | +0.063 à +0.216 | 100 % | +0.167 | +0.112 | 90 % de 10 |
| 4 bougies (1 h) | 1249 | +0.322 | +0.302 | +0.167 à +0.436 | 100 % | +0.436 | +0.175 | 80 % de 10 |
| 16 bougies (4 h) | 1249 | +0.473 | +0.397 | +0.200 à +0.586 | 100 % | +0.522 | +0.277 | 90 % de 10 |
| 64 bougies (16 h) | 1249 | +1.516 | +1.200 | +0.686 à +1.729 | 100 % | +1.480 | +0.933 | 90 % de 10 |

### signaux d'entrée « cœur » · 1 675 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1675 | +0.123 | +0.119 | +0.051 à +0.184 | 100 % | +0.167 | +0.072 | 80 % de 10 |
| 4 bougies (1 h) | 1675 | +0.264 | +0.245 | +0.114 à +0.368 | 100 % | +0.418 | +0.077 | 70 % de 10 |
| 16 bougies (4 h) | 1675 | +0.467 | +0.391 | +0.212 à +0.582 | 100 % | +0.603 | +0.185 | 80 % de 10 |
| 64 bougies (16 h) | 1675 | +1.461 | +1.144 | +0.718 à +1.568 | 100 % | +1.470 | +0.826 | 90 % de 10 |

### chocs bruts (|z| > seuil du régime) · 11 945 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 11945 | +0.051 | +0.051 | +0.028 à +0.074 | 100 % | +0.032 | +0.070 | 90 % de 10 |
| 4 bougies (1 h) | 11945 | +0.075 | +0.076 | +0.039 à +0.117 | 100 % | +0.075 | +0.078 | 70 % de 10 |
| 16 bougies (4 h) | 11945 | +0.087 | +0.097 | +0.033 à +0.158 | 100 % | +0.064 | +0.130 | 70 % de 10 |
| 64 bougies (16 h) | 11945 | +0.246 | +0.263 | +0.153 à +0.381 | 100 % | +0.272 | +0.254 | 90 % de 10 |

### chocs bruts dans le sens de la tendance 60 min · 7 384 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 7384 | +0.076 | +0.075 | +0.048 à +0.103 | 100 % | +0.061 | +0.090 | 90 % de 10 |
| 4 bougies (1 h) | 7384 | +0.133 | +0.132 | +0.081 à +0.184 | 100 % | +0.150 | +0.114 | 90 % de 10 |
| 16 bougies (4 h) | 7384 | +0.220 | +0.221 | +0.135 à +0.312 | 100 % | +0.223 | +0.219 | 80 % de 10 |
| 64 bougies (16 h) | 7384 | +0.678 | +0.651 | +0.457 à +0.830 | 100 % | +0.789 | +0.515 | 90 % de 10 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 2053 | +0.242 | +0.126 à +0.360 | +0.338 | +0.180 à +0.509 |
| Londres (2 h – 8 h) | 1411 | +0.108 | +0.014 à +0.206 | +0.233 | +0.045 à +0.412 |
| New York matin (8 h – 12 h) | 2066 | +0.186 | +0.072 à +0.301 | +0.354 | +0.141 à +0.574 |
| dont bougie de 8 h 30 (annonces) | 140 | −0.153 | −0.394 à +0.086 | −0.484 | −1.417 à +0.517 |
| New York après-midi (12 h – 18 h) | 1854 | −0.032 | −0.142 à +0.088 | −0.066 | −0.226 à +0.104 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 394 | +0.376 | +0.129 à +0.617 | +0.426 | +0.082 à +0.754 |
| Londres (2 h – 8 h) | 232 | +0.273 | −0.046 à +0.600 | +0.498 | +0.106 à +0.891 |
| New York matin (8 h – 12 h) | 336 | +0.420 | +0.062 à +0.771 | +0.280 | −0.287 à +0.823 |
| dont bougie de 8 h 30 (annonces) | 25 | −0.251 | −0.982 à +0.482 | −2.207 | −4.327 à −0.322 |
| New York après-midi (12 h – 18 h) | 287 | +0.087 | −0.207 à +0.360 | +0.410 | +0.021 à +0.803 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 6427 % | 53.5 % | 1.86 | 2.71 | 1.92 | -20.6 % | 2.60 | 774 | 33 % | 3.35 % | -0.78 % | 4.28 | 4.30 | 111 % | 15 % | 80× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 3160 % | 42.9 % | 1.56 | 2.27 | 1.67 | -24.1 % | 1.78 | 774 | 33 % | 3.33 % | -0.87 % | 3.85 | 4.30 | 132 % | 15 % | 80× | 7.2 % | 0.0 % |
| preset · coûts × 2 | 1527 % | 33.1 % | 1.27 | 1.84 | 1.48 | -27.4 % | 1.21 | 774 | 32 % | 3.33 % | -0.94 % | 3.53 | 4.30 | 164 % | 15 % | 79× | 14.3 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 3160 % | 42.9 % | 1.56 | 2.27 | 1.67 | -24.1 % | 1.78 | 774 | 33 % | 3.33 % | -0.87 % | 3.85 | 4.30 | 132 % | 15 % | 80× | 7.2 % | 0.0 % |
| core · coûts × 0 | 9075 % | 58.9 % | 1.90 | 2.78 | 1.76 | -22.7 % | 2.59 | 1029 | 33 % | 2.96 % | -0.74 % | 4.02 | 4.79 | 121 % | 18 % | 105× | 0.0 % | 0.0 % |
| core · coûts × 1 | 3543 % | 44.6 % | 1.53 | 2.23 | 1.52 | -24.8 % | 1.80 | 1029 | 32 % | 2.92 % | -0.82 % | 3.57 | 4.79 | 151 % | 18 % | 105× | 9.4 % | 0.0 % |
| core · coûts × 2 | 1345 % | 31.5 % | 1.17 | 1.69 | 1.34 | -28.6 % | 1.10 | 1029 | 31 % | 2.93 % | -0.90 % | 3.27 | 4.79 | 201 % | 18 % | 105× | 18.9 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 3543 % | 44.6 % | 1.53 | 2.23 | 1.52 | -24.8 % | 1.80 | 1029 | 32 % | 2.92 % | -0.82 % | 3.57 | 4.79 | 151 % | 18 % | 105× | 9.4 % | 0.0 % |
| achat conservé | 8682 % | 58.2 % | 1.01 | — | — | -83.4 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.52, intervalle à 90 % (bootstrap des mois) 1.10 à 1.92, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.86 · × 0,25 → 1.78 · × 0,5 → 1.71 · × 0,75 → 1.64 · × 1 → 1.56. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 15 % | 0.86 | -9.2 % | 84 |
| 2018 | 110 % | 2.46 | -14.3 % | 69 |
| 2019 | 64 % | 1.63 | -14.8 % | 80 |
| 2020 | 16 % | 0.70 | -17.3 % | 89 |
| 2021 | 34 % | 1.47 | -8.9 % | 66 |
| 2022 | 46 % | 1.43 | -19.2 % | 85 |
| 2023 | 53 % | 2.08 | -12.8 % | 82 |
| 2024 | 114 % | 3.50 | -7.5 % | 75 |
| 2025 | -4 % | -0.15 | -12.5 % | 78 |
| 2026 | 17 % | 1.25 | -24.1 % | 66 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 242 | 33 % | 1.02 % | 2.24 |
| calme | short | 154 | 29 % | 0.83 % | 1.12 |
| agité | long | 378 | 34 % | 0.04 % | 0.13 |

Entrées au hasard (200 tirages, mêmes sorties, 767 trades en médiane) : Sharpe médian 0.23, 95e centile 0.76 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 4.48 | 6.83 | 721 | 1.704 % | 337 % |
| -1 bougie (utilise le futur) | 4.13 | 5.24 | 723 | 1.583 % | 313 % |
| à l'heure | 1.56 | 1.67 | 774 | 0.505 % | 100 % |
| +1 bougie | 1.32 | 1.62 | 784 | 0.417 % | 83 % |
| +2 bougies | 1.19 | 1.54 | 786 | 0.376 % | 74 % |
| +4 bougies | 1.27 | 1.55 | 762 | 0.407 % | 81 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.49, intervalle à 90 % (bootstrap des mois) 1.07 à 1.88, P(Sharpe > 0) 100 %.

Coûts et Sharpe : × 0 → 1.90 · × 0,25 → 1.81 · × 0,5 → 1.72 · × 0,75 → 1.63 · × 1 → 1.53. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 31 % | 1.39 | -8.0 % | 125 |
| 2018 | 98 % | 2.19 | -16.8 % | 96 |
| 2019 | 91 % | 2.04 | -14.8 % | 92 |
| 2020 | 29 % | 1.08 | -12.0 % | 116 |
| 2021 | 14 % | 0.64 | -13.9 % | 105 |
| 2022 | 37 % | 1.20 | -24.8 % | 101 |
| 2023 | 55 % | 2.09 | -14.1 % | 99 |
| 2024 | 110 % | 3.27 | -11.5 % | 112 |
| 2025 | -1 % | 0.07 | -15.3 % | 101 |
| 2026 | 12 % | 0.93 | -24.8 % | 82 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 294 | 32 % | 0.90 % | 2.38 |
| calme | short | 171 | 29 % | 0.69 % | 1.03 |
| agité | long | 564 | 34 % | 0.04 % | 0.19 |

Entrées au hasard (200 tirages, mêmes sorties, 1025 trades en médiane) : Sharpe médian 0.17, 95e centile 0.64 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.02 | 6.73 | 950 | 1.540 % | 390 % |
| -1 bougie (utilise le futur) | 4.66 | 5.35 | 950 | 1.452 % | 367 % |
| à l'heure | 1.53 | 1.52 | 1029 | 0.395 % | 100 % |
| +1 bougie | 1.20 | 1.46 | 1041 | 0.304 % | 77 % |
| +2 bougies | 1.10 | 1.40 | 1035 | 0.280 % | 71 % |
| +4 bougies | 1.19 | 1.43 | 1004 | 0.308 % | 78 % |
