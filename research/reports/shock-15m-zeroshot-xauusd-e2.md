# Zéro-shot du Shock Engine · Or comptant XAU/USD (Dukascopy) · shorts en régime de tendance baissier (E2)

15 min, 2013-01-01 → 2026-09-30 (13.7 ans, préchauffage depuis 2012-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,01 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset xauusd --draws 200`.

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
| Profit factor > 1,1 (coûts × 1) | **non** | **non** |
| Sharpe > 0,3 (coûts × 1) | **non** | **non** |
| Bat ≥ 90 % des entrées au hasard | oui | oui |
| Entrée retardée d'une bougie : ≥ 50 % du gain moyen par trade | **non** | **non** |

## 1. Étude d'événement

Rendement après l'événement, en ATR de la bougie, dans le sens de l'événement. Excès : moins le rendement moyen d'une bougie quelconque de la même année à la même heure. Intervalle à 90 % par bootstrap des mois.

### signaux d'entrée complets · 977 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 977 | +0.027 | +0.028 | −0.043 à +0.098 | 75 % | +0.082 | −0.031 | 71 % de 14 |
| 4 bougies (1 h) | 977 | +0.065 | +0.063 | −0.066 à +0.181 | 78 % | +0.124 | −0.004 | 71 % de 14 |
| 16 bougies (4 h) | 977 | +0.264 | +0.246 | −0.021 à +0.502 | 94 % | +0.447 | +0.021 | 71 % de 14 |
| 64 bougies (16 h) | 977 | +0.705 | +0.513 | +0.081 à +0.954 | 98 % | +0.635 | +0.376 | 71 % de 14 |

### signaux d'entrée « cœur » · 1 416 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1416 | +0.008 | +0.010 | −0.052 à +0.068 | 62 % | +0.067 | −0.051 | 64 % de 14 |
| 4 bougies (1 h) | 1416 | +0.058 | +0.055 | −0.047 à +0.158 | 80 % | +0.091 | +0.017 | 71 % de 14 |
| 16 bougies (4 h) | 1416 | +0.198 | +0.173 | −0.040 à +0.373 | 91 % | +0.239 | +0.102 | 64 % de 14 |
| 64 bougies (16 h) | 1416 | +0.459 | +0.240 | −0.130 à +0.602 | 86 % | +0.273 | +0.206 | 79 % de 14 |

### chocs bruts (|z| > seuil du régime) · 11 375 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 11375 | −0.015 | −0.013 | −0.028 à +0.004 | 9 % | +0.010 | −0.033 | 43 % de 14 |
| 4 bougies (1 h) | 11375 | −0.006 | −0.004 | −0.032 à +0.028 | 44 % | +0.043 | −0.045 | 36 % de 14 |
| 16 bougies (4 h) | 11375 | −0.004 | +0.006 | −0.047 à +0.059 | 55 % | +0.017 | −0.005 | 50 % de 14 |
| 64 bougies (16 h) | 11371 | +0.024 | +0.050 | −0.045 à +0.144 | 81 % | +0.035 | +0.063 | 50 % de 14 |

### chocs bruts dans le sens de la tendance 60 min · 6 919 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6919 | −0.014 | −0.012 | −0.033 à +0.011 | 20 % | +0.012 | −0.035 | 36 % de 14 |
| 4 bougies (1 h) | 6919 | +0.001 | +0.002 | −0.042 à +0.050 | 53 % | +0.031 | −0.027 | 50 % de 14 |
| 16 bougies (4 h) | 6919 | +0.013 | +0.013 | −0.078 à +0.096 | 60 % | −0.023 | +0.048 | 64 % de 14 |
| 64 bougies (16 h) | 6918 | +0.142 | +0.133 | −0.051 à +0.329 | 89 % | +0.056 | +0.209 | 50 % de 14 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 988 | −0.072 | −0.176 à +0.033 | −0.207 | −0.385 à −0.030 |
| Londres (2 h – 8 h) | 1519 | −0.091 | −0.185 à +0.002 | +0.020 | −0.176 à +0.230 |
| New York matin (8 h – 12 h) | 3627 | +0.070 | −0.004 à +0.146 | +0.070 | −0.062 à +0.199 |
| dont bougie de 8 h 30 (annonces) | 510 | +0.076 | −0.119 à +0.267 | +0.068 | −0.265 à +0.388 |
| New York après-midi (12 h – 18 h) | 785 | −0.040 | −0.166 à +0.089 | +0.013 | −0.200 à +0.230 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 110 | −0.147 | −0.391 à +0.103 | −0.022 | −0.517 à +0.437 |
| Londres (2 h – 8 h) | 176 | −0.072 | −0.322 à +0.159 | +0.210 | −0.286 à +0.707 |
| New York matin (8 h – 12 h) | 608 | +0.129 | −0.049 à +0.295 | +0.263 | −0.092 à +0.616 |
| dont bougie de 8 h 30 (annonces) | 87 | +0.108 | −0.503 à +0.739 | +0.328 | −0.623 à +1.269 |
| New York après-midi (12 h – 18 h) | 83 | +0.148 | −0.332 à +0.596 | +0.550 | −0.030 à +1.145 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 92 % | 4.9 % | 0.94 | 1.43 | 1.61 | -7.8 % | 0.63 | 664 | 30 % | 0.92 % | -0.25 % | 3.71 | 4.12 | 147 % | 13 % | 48× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -7 % | -0.5 % | -0.07 | -0.11 | 0.95 | -18.6 % | -0.03 | 663 | 26 % | 0.94 % | -0.34 % | 2.75 | 4.11 | -1269 % | 13 % | 48× | 4.3 % | 1.0 % |
| preset · coûts × 2 | -55 % | -5.7 % | -1.03 | -1.47 | 0.62 | -58.9 % | -0.10 | 663 | 22 % | 0.99 % | -0.43 % | 2.30 | 4.11 | -111 % | 13 % | 48× | 8.7 % | 1.9 % |
| preset · coûts × 1, sans masque des ouvertures | -8 % | -0.6 % | -0.09 | -0.13 | 0.95 | -19.1 % | -0.03 | 667 | 26 % | 0.94 % | -0.34 % | 2.75 | 4.13 | -1086 % | 13 % | 49× | 4.4 % | 1.0 % |
| core · coûts × 0 | 76 % | 4.2 % | 0.76 | 1.13 | 1.38 | -12.0 % | 0.35 | 918 | 28 % | 0.85 % | -0.24 % | 3.51 | 4.36 | 218 % | 16 % | 67× | 0.0 % | 0.0 % |
| core · coûts × 1 | -34 % | -3.0 % | -0.49 | -0.71 | 0.81 | -39.9 % | -0.07 | 914 | 25 % | 0.85 % | -0.34 % | 2.52 | 4.33 | -284 % | 16 % | 67× | 6.0 % | 1.3 % |
| core · coûts × 2 | -76 % | -9.8 % | -1.68 | -2.34 | 0.51 | -76.9 % | -0.13 | 913 | 21 % | 0.90 % | -0.43 % | 2.11 | 4.32 | -80 % | 16 % | 67× | 12.0 % | 2.7 % |
| core · coûts × 1, sans masque des ouvertures | -36 % | -3.2 % | -0.53 | -0.77 | 0.80 | -41.5 % | -0.08 | 931 | 25 % | 0.85 % | -0.34 % | 2.51 | 4.34 | -267 % | 16 % | 68× | 6.1 % | 1.4 % |
| achat conservé | 148 % | 6.8 % | 0.48 | — | — | -37.8 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.07, intervalle à 90 % (bootstrap des mois) -0.49 à 0.33, P(Sharpe > 0) 41 %.

Coûts et Sharpe : × 0 → 0.94 · × 0,25 → 0.68 · × 0,5 → 0.43 · × 0,75 → 0.18 · × 1 → -0.07. Seuil de rentabilité vers × 0,93, soit 0,051 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -7 % | -1.42 | -9.7 % | 54 |
| 2014 | 0 % | 0.03 | -6.7 % | 44 |
| 2015 | -6 % | -1.18 | -7.5 % | 53 |
| 2016 | 8 % | 1.20 | -6.9 % | 50 |
| 2017 | -4 % | -0.96 | -8.0 % | 40 |
| 2018 | -4 % | -0.98 | -6.8 % | 56 |
| 2019 | 3 % | 0.77 | -3.2 % | 42 |
| 2020 | 7 % | 1.20 | -7.2 % | 44 |
| 2021 | -2 % | -0.22 | -7.7 % | 47 |
| 2022 | -3 % | -0.55 | -7.9 % | 53 |
| 2023 | -1 % | -0.17 | -8.1 % | 57 |
| 2024 | -5 % | -1.31 | -8.7 % | 55 |
| 2025 | 1 % | 0.14 | -3.8 % | 38 |
| 2026 | 9 % | 2.00 | -3.1 % | 30 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 179 | 33 % | 0.11 % | 0.19 |
| calme | short | 140 | 24 % | 0.05 % | 0.06 |
| agité | long | 344 | 23 % | -0.09 % | -0.32 |

Entrées au hasard (200 tirages, mêmes sorties, 663 trades en médiane) : Sharpe médian -0.78, 95e centile -0.31 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.82 | 5.34 | 622 | 0.388 % | -5117 % |
| -1 bougie (utilise le futur) | 2.63 | 4.82 | 617 | 0.370 % | -4878 % |
| à l'heure | -0.07 | 0.95 | 663 | -0.008 % | 100 % |
| +1 bougie | -0.16 | 0.92 | 670 | -0.016 % | 214 % |
| +2 bougies | -0.20 | 0.90 | 656 | -0.022 % | 295 % |
| +4 bougies | -0.20 | 0.90 | 658 | -0.022 % | 293 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier -0.48, intervalle à 90 % (bootstrap des mois) -0.99 à -0.02, P(Sharpe > 0) 4 %.

Coûts et Sharpe : × 0 → 0.76 · × 0,25 → 0.44 · × 0,5 → 0.13 · × 0,75 → -0.18 · × 1 → -0.49. Seuil de rentabilité vers × 0,61, soit 0,033 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -13 % | -2.54 | -14.7 % | 78 |
| 2014 | -4 % | -0.66 | -7.9 % | 61 |
| 2015 | -8 % | -1.43 | -8.2 % | 72 |
| 2016 | 7 % | 0.93 | -5.4 % | 65 |
| 2017 | -4 % | -0.74 | -7.0 % | 50 |
| 2018 | -5 % | -1.10 | -8.2 % | 66 |
| 2019 | -2 % | -0.35 | -6.3 % | 70 |
| 2020 | 5 % | 0.81 | -9.4 % | 70 |
| 2021 | -3 % | -0.33 | -7.2 % | 59 |
| 2022 | -7 % | -1.16 | -12.2 % | 70 |
| 2023 | -1 % | -0.07 | -9.5 % | 73 |
| 2024 | -9 % | -2.07 | -10.6 % | 73 |
| 2025 | -3 % | -0.45 | -4.5 % | 61 |
| 2026 | 6 % | 1.22 | -4.7 % | 46 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 238 | 29 % | 0.06 % | 0.13 |
| calme | short | 157 | 25 % | 0.03 % | 0.04 |
| agité | long | 519 | 23 % | -0.11 % | -0.58 |

Entrées au hasard (200 tirages, mêmes sorties, 915.5 trades en médiane) : Sharpe médian -1.02, 95e centile -0.60 ; la stratégie en bat 98 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.11 | 4.83 | 838 | 0.353 % | -828 % |
| -1 bougie (utilise le futur) | 2.91 | 4.35 | 841 | 0.334 % | -783 % |
| à l'heure | -0.49 | 0.81 | 914 | -0.043 % | 100 % |
| +1 bougie | -0.50 | 0.80 | 919 | -0.042 % | 99 % |
| +2 bougies | -0.54 | 0.79 | 898 | -0.047 % | 111 % |
| +4 bougies | -0.44 | 0.82 | 899 | -0.040 % | 93 % |
