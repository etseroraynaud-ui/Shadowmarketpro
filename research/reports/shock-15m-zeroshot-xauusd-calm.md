# Zéro-shot du Shock Engine · Or comptant XAU/USD (Dukascopy) · régime calme seul, shorts en régime de tendance baissier

15 min, 2013-01-01 → 2026-09-30 (13.7 ans, préchauffage depuis 2012-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,01 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset xauusd --draws 200 --calm`.

## Données

- 325 072 bougies de 15 min ; 3 570 suivent une fermeture (masquées pour les entrées) ; 0 sans volume.
- Écart type d'un rendement 15 min hors fermetures : 0.105 %.
- Plus forts rendements 15 min **hors** fermetures (en écarts types) : 2026-03-23 11:00 +40.9 · 2021-08-08 22:45 −39.9 · 2026-01-29 15:15 −35.1 · 2013-10-17 07:45 +26.9 · 2015-07-20 01:15 −25.5 · 2026-02-02 01:00 −25.1 · 2023-12-03 23:15 +24.8 · 2013-09-18 18:00 +22.3.
- Plus forts sauts **à l'ouverture** (masqués) : 2026-02-01 23:00 −30.7 · 2020-03-15 22:00 +24.9 · 2026-06-14 22:00 +18.3 · 2020-02-23 23:00 +17.5 · 2026-04-12 22:00 −14.4 · 2020-01-05 23:00 +14.3.

## Verdict (critères fixés avant le test)

**Phénomène « choc → continuation »** (étude d'événement, chocs bruts dans le sens de la tendance 60 min : excès > 0 à 4 et 16 bougies, intervalle à 90 % au-dessus de 0, deux moitiés positives, ≥ 60 % des années) : **non**. Chocs bruts sans tendance : **non**.

| critère | entrées complètes | entrées « cœur » |
| --- | --- | --- |
| Étude d'événement des signaux : même critère | **non** | **non** |
| Profit factor > 1,1 (coûts × 1) | oui | oui |
| Sharpe > 0,3 (coûts × 1) | oui | **non** |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | oui | oui |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 510 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 510 | +0.039 | +0.041 | −0.057 à +0.142 | 75 % | +0.083 | −0.025 | 64 % de 14 |
| 4 bougies (1 h) | 510 | +0.144 | +0.141 | −0.063 à +0.345 | 87 % | +0.168 | +0.098 | 64 % de 14 |
| 16 bougies (4 h) | 510 | +0.552 | +0.518 | +0.071 à +0.947 | 98 % | +0.747 | +0.152 | 71 % de 14 |
| 64 bougies (16 h) | 510 | +1.238 | +1.121 | +0.460 à +1.737 | 100 % | +1.468 | +0.564 | 79 % de 14 |

### signaux d'entrée « cœur » · 701 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 701 | +0.017 | +0.019 | −0.059 à +0.098 | 66 % | +0.083 | −0.074 | 57 % de 14 |
| 4 bougies (1 h) | 701 | +0.127 | +0.122 | −0.021 à +0.281 | 92 % | +0.144 | +0.090 | 79 % de 14 |
| 16 bougies (4 h) | 701 | +0.394 | +0.351 | +0.021 à +0.685 | 96 % | +0.496 | +0.142 | 71 % de 14 |
| 64 bougies (16 h) | 701 | +0.758 | +0.601 | +0.060 à +1.161 | 97 % | +1.011 | +0.005 | 79 % de 14 |

### chocs bruts (|z| > seuil du régime) · 11 375 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 11375 | −0.015 | −0.013 | −0.028 à +0.003 | 9 % | +0.010 | −0.033 | 43 % de 14 |
| 4 bougies (1 h) | 11375 | −0.006 | −0.004 | −0.032 à +0.027 | 43 % | +0.043 | −0.045 | 36 % de 14 |
| 16 bougies (4 h) | 11375 | −0.004 | +0.006 | −0.047 à +0.059 | 54 % | +0.017 | −0.005 | 50 % de 14 |
| 64 bougies (16 h) | 11371 | +0.024 | +0.050 | −0.047 à +0.146 | 81 % | +0.035 | +0.063 | 50 % de 14 |

### chocs bruts dans le sens de la tendance 60 min · 6 919 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6919 | −0.014 | −0.012 | −0.034 à +0.011 | 19 % | +0.012 | −0.035 | 36 % de 14 |
| 4 bougies (1 h) | 6919 | +0.001 | +0.002 | −0.044 à +0.046 | 52 % | +0.031 | −0.027 | 50 % de 14 |
| 16 bougies (4 h) | 6919 | +0.013 | +0.013 | −0.073 à +0.100 | 61 % | −0.023 | +0.048 | 64 % de 14 |
| 64 bougies (16 h) | 6918 | +0.142 | +0.133 | −0.053 à +0.335 | 88 % | +0.056 | +0.209 | 50 % de 14 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 988 | −0.072 | −0.173 à +0.031 | −0.207 | −0.380 à −0.025 |
| Londres (2 h – 8 h) | 1519 | −0.091 | −0.183 à +0.001 | +0.020 | −0.184 à +0.215 |
| New York matin (8 h – 12 h) | 3627 | +0.070 | −0.001 à +0.145 | +0.070 | −0.065 à +0.198 |
| dont bougie de 8 h 30 (annonces) | 510 | +0.076 | −0.118 à +0.263 | +0.068 | −0.265 à +0.388 |
| New York après-midi (12 h – 18 h) | 785 | −0.040 | −0.161 à +0.087 | +0.013 | −0.205 à +0.233 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 30 | −0.310 | −1.050 à +0.390 | −0.087 | −1.289 à +1.018 |
| Londres (2 h – 8 h) | 66 | +0.064 | −0.367 à +0.457 | +0.781 | −0.161 à +1.671 |
| New York matin (8 h – 12 h) | 373 | +0.242 | −0.022 à +0.495 | +0.541 | +0.047 à +1.054 |
| dont bougie de 8 h 30 (annonces) | 65 | +0.393 | −0.350 à +1.235 | +0.176 | −0.992 à +1.367 |
| New York après-midi (12 h – 18 h) | 41 | −0.323 | −1.121 à +0.376 | +0.328 | −0.490 à +1.133 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 82 % | 4.5 % | 0.93 | 1.42 | 1.87 | -7.5 % | 0.60 | 319 | 31 % | 1.38 % | -0.34 % | 4.06 | 3.13 | 103 % | 12 % | 22× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 28 % | 1.8 % | 0.39 | 0.59 | 1.27 | -11.8 % | 0.15 | 319 | 29 % | 1.36 % | -0.44 % | 3.09 | 3.13 | 242 % | 12 % | 23× | 2.1 % | 0.5 % |
| preset · coûts × 2 | -10 % | -0.7 % | -0.12 | -0.18 | 0.91 | -22.7 % | -0.03 | 319 | 27 % | 1.36 % | -0.54 % | 2.53 | 3.13 | -576 % | 12 % | 23× | 4.2 % | 0.9 % |
| preset · coûts × 1, sans masque des ouvertures | 28 % | 1.8 % | 0.39 | 0.59 | 1.27 | -11.8 % | 0.15 | 319 | 29 % | 1.36 % | -0.44 % | 3.09 | 3.13 | 242 % | 12 % | 23× | 2.1 % | 0.5 % |
| core · coûts × 0 | 82 % | 4.5 % | 0.87 | 1.31 | 1.67 | -11.5 % | 0.39 | 395 | 29 % | 1.39 % | -0.34 % | 4.07 | 3.19 | 127 % | 14 % | 28× | 0.0 % | 0.0 % |
| core · coûts × 1 | 18 % | 1.2 % | 0.26 | 0.38 | 1.14 | -16.3 % | 0.07 | 395 | 27 % | 1.37 % | -0.44 % | 3.09 | 3.19 | 446 % | 14 % | 28× | 2.6 % | 0.6 % |
| core · coûts × 2 | -24 % | -1.9 % | -0.33 | -0.48 | 0.82 | -33.4 % | -0.06 | 395 | 25 % | 1.38 % | -0.54 % | 2.56 | 3.19 | -268 % | 14 % | 29× | 5.2 % | 1.2 % |
| core · coûts × 1, sans masque des ouvertures | 16 % | 1.1 % | 0.22 | 0.33 | 1.12 | -16.9 % | 0.06 | 402 | 27 % | 1.36 % | -0.44 % | 3.07 | 3.21 | 513 % | 14 % | 29× | 2.6 % | 0.6 % |
| achat conservé | 148 % | 6.8 % | 0.48 | — | — | -37.8 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 0.39, intervalle à 90 % (bootstrap des mois) -0.04 à 0.76, P(Sharpe > 0) 93 %.

Coûts et Sharpe : × 0 → 0.93 · × 0,25 → 0.80 · × 0,5 → 0.66 · × 0,75 → 0.53 · × 1 → 0.39. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -1 % | -0.25 | -5.9 % | 22 |
| 2014 | 1 % | 0.16 | -6.7 % | 39 |
| 2015 | -5 % | -1.03 | -7.2 % | 31 |
| 2016 | 11 % | 1.73 | -5.2 % | 20 |
| 2017 | -4 % | -0.82 | -7.8 % | 36 |
| 2018 | -1 % | -0.34 | -5.0 % | 30 |
| 2019 | 3 % | 0.88 | -2.8 % | 17 |
| 2020 | 10 % | 2.05 | -3.7 % | 4 |
| 2021 | 1 % | 0.25 | -7.0 % | 33 |
| 2022 | -2 % | -0.44 | -6.6 % | 23 |
| 2023 | 2 % | 0.45 | -5.1 % | 32 |
| 2024 | 1 % | 0.35 | -3.4 % | 14 |
| 2025 | 2 % | 0.58 | -3.0 % | 14 |
| 2026 | 8 % | 2.11 | -1.7 % | 4 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 179 | 33 % | 0.11 % | 0.19 |
| calme | short | 140 | 24 % | 0.05 % | 0.06 |

Entrées au hasard (200 tirages, mêmes sorties, 320 trades en médiane) : Sharpe médian -0.26, 95e centile 0.21 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 1.94 | 4.07 | 293 | 0.509 % | 604 % |
| -1 bougie (utilise le futur) | 1.80 | 3.84 | 292 | 0.476 % | 564 % |
| à l'heure | 0.39 | 1.27 | 319 | 0.084 % | 100 % |
| +1 bougie | 0.46 | 1.33 | 317 | 0.097 % | 115 % |
| +2 bougies | 0.28 | 1.18 | 315 | 0.060 % | 71 % |
| +4 bougies | 0.38 | 1.27 | 312 | 0.083 % | 98 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 0.25, intervalle à 90 % (bootstrap des mois) -0.20 à 0.67, P(Sharpe > 0) 84 %.

Coûts et Sharpe : × 0 → 0.87 · × 0,25 → 0.72 · × 0,5 → 0.56 · × 0,75 → 0.41 · × 1 → 0.26. Rentable sur toute la plage.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -1 % | -0.32 | -6.2 % | 24 |
| 2014 | -3 % | -0.51 | -7.5 % | 51 |
| 2015 | -4 % | -0.82 | -6.1 % | 33 |
| 2016 | 9 % | 1.27 | -5.3 % | 30 |
| 2017 | -3 % | -0.53 | -6.6 % | 44 |
| 2018 | -2 % | -0.47 | -5.6 % | 34 |
| 2019 | 3 % | 0.79 | -3.0 % | 19 |
| 2020 | 13 % | 2.41 | -3.8 % | 4 |
| 2021 | 2 % | 0.28 | -6.2 % | 40 |
| 2022 | -4 % | -0.80 | -9.9 % | 31 |
| 2023 | 2 % | 0.38 | -7.3 % | 38 |
| 2024 | -1 % | -0.13 | -3.4 % | 18 |
| 2025 | -1 % | -0.16 | -5.2 % | 25 |
| 2026 | 10 % | 2.52 | -1.8 % | 4 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 238 | 29 % | 0.06 % | 0.13 |
| calme | short | 157 | 25 % | 0.03 % | 0.04 |

Entrées au hasard (200 tirages, mêmes sorties, 397 trades en médiane) : Sharpe médian -0.22, 95e centile 0.15 ; la stratégie en bat 97 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.01 | 3.47 | 358 | 0.470 % | 980 % |
| -1 bougie (utilise le futur) | 1.79 | 3.16 | 359 | 0.411 % | 858 % |
| à l'heure | 0.26 | 1.14 | 395 | 0.048 % | 100 % |
| +1 bougie | 0.28 | 1.15 | 395 | 0.051 % | 106 % |
| +2 bougies | 0.14 | 1.07 | 396 | 0.027 % | 56 % |
| +4 bougies | 0.27 | 1.16 | 389 | 0.051 % | 106 % |
