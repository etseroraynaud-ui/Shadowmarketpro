# Zéro-shot du Shock Engine · Or comptant XAU/USD (Dukascopy)

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

### signaux d'entrée complets · 1 309 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1309 | +0.001 | +0.002 | −0.065 à +0.069 | 52 % | +0.036 | −0.035 | 57 % de 14 |
| 4 bougies (1 h) | 1309 | +0.047 | +0.045 | −0.072 à +0.157 | 72 % | +0.092 | −0.006 | 57 % de 14 |
| 16 bougies (4 h) | 1309 | +0.110 | +0.101 | −0.109 à +0.315 | 78 % | +0.168 | +0.026 | 64 % de 14 |
| 64 bougies (16 h) | 1309 | +0.410 | +0.344 | −0.011 à +0.706 | 94 % | +0.366 | +0.320 | 71 % de 14 |

### signaux d'entrée « cœur » · 1 848 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1848 | −0.027 | −0.025 | −0.080 à +0.030 | 24 % | +0.003 | −0.055 | 50 % de 14 |
| 4 bougies (1 h) | 1848 | +0.031 | +0.031 | −0.064 à +0.124 | 70 % | +0.052 | +0.007 | 57 % de 14 |
| 16 bougies (4 h) | 1848 | +0.106 | +0.093 | −0.088 à +0.260 | 81 % | +0.094 | +0.091 | 57 % de 14 |
| 64 bougies (16 h) | 1848 | +0.304 | +0.209 | −0.081 à +0.506 | 88 % | +0.223 | +0.193 | 71 % de 14 |

### chocs bruts (|z| > seuil du régime) · 11 375 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 11375 | −0.015 | −0.013 | −0.028 à +0.004 | 10 % | +0.010 | −0.033 | 43 % de 14 |
| 4 bougies (1 h) | 11375 | −0.006 | −0.004 | −0.034 à +0.028 | 44 % | +0.043 | −0.045 | 36 % de 14 |
| 16 bougies (4 h) | 11375 | −0.004 | +0.006 | −0.047 à +0.057 | 57 % | +0.017 | −0.005 | 50 % de 14 |
| 64 bougies (16 h) | 11371 | +0.024 | +0.050 | −0.046 à +0.149 | 81 % | +0.035 | +0.063 | 50 % de 14 |

### chocs bruts dans le sens de la tendance 60 min · 6 919 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6919 | −0.014 | −0.012 | −0.034 à +0.011 | 20 % | +0.012 | −0.035 | 36 % de 14 |
| 4 bougies (1 h) | 6919 | +0.001 | +0.002 | −0.045 à +0.048 | 53 % | +0.031 | −0.027 | 50 % de 14 |
| 16 bougies (4 h) | 6919 | +0.013 | +0.013 | −0.073 à +0.099 | 59 % | −0.023 | +0.048 | 64 % de 14 |
| 64 bougies (16 h) | 6918 | +0.142 | +0.133 | −0.046 à +0.328 | 89 % | +0.056 | +0.209 | 50 % de 14 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 988 | −0.072 | −0.171 à +0.029 | −0.207 | −0.386 à −0.028 |
| Londres (2 h – 8 h) | 1519 | −0.091 | −0.182 à +0.000 | +0.020 | −0.174 à +0.234 |
| New York matin (8 h – 12 h) | 3627 | +0.070 | −0.008 à +0.148 | +0.070 | −0.061 à +0.198 |
| dont bougie de 8 h 30 (annonces) | 510 | +0.076 | −0.118 à +0.265 | +0.068 | −0.258 à +0.387 |
| New York après-midi (12 h – 18 h) | 785 | −0.040 | −0.160 à +0.083 | +0.013 | −0.209 à +0.234 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 122 | −0.129 | −0.373 à +0.105 | −0.011 | −0.466 à +0.421 |
| Londres (2 h – 8 h) | 220 | −0.031 | −0.263 à +0.196 | +0.247 | −0.277 à +0.734 |
| New York matin (8 h – 12 h) | 855 | +0.073 | −0.088 à +0.218 | +0.035 | −0.253 à +0.313 |
| dont bougie de 8 h 30 (annonces) | 138 | +0.253 | −0.228 à +0.743 | +0.145 | −0.562 à +0.902 |
| New York après-midi (12 h – 18 h) | 112 | +0.176 | −0.214 à +0.517 | +0.437 | −0.022 à +0.911 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 88 % | 4.7 % | 0.75 | 1.12 | 1.36 | -11.6 % | 0.41 | 871 | 29 % | 0.96 % | -0.28 % | 3.39 | 3.67 | 198 % | 21 % | 64× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -28 % | -2.3 % | -0.33 | -0.47 | 0.87 | -36.9 % | -0.06 | 870 | 25 % | 0.97 % | -0.38 % | 2.59 | 3.66 | -374 % | 21 % | 63× | 5.7 % | 1.3 % |
| preset · coûts × 2 | -72 % | -8.9 % | -1.35 | -1.90 | 0.59 | -74.9 % | -0.12 | 870 | 22 % | 1.02 % | -0.47 % | 2.19 | 3.66 | -90 % | 21 % | 63× | 11.4 % | 2.5 % |
| preset · coûts × 1, sans masque des ouvertures | -29 % | -2.4 % | -0.35 | -0.50 | 0.86 | -37.7 % | -0.06 | 875 | 25 % | 0.97 % | -0.38 % | 2.59 | 3.67 | -354 % | 21 % | 64× | 5.7 % | 1.3 % |
| core · coûts × 0 | 65 % | 3.7 % | 0.56 | 0.82 | 1.21 | -17.5 % | 0.21 | 1164 | 27 % | 0.89 % | -0.27 % | 3.27 | 3.88 | 310 % | 25 % | 85× | 0.0 % | 0.0 % |
| core · coûts × 1 | -53 % | -5.3 % | -0.74 | -1.06 | 0.76 | -57.4 % | -0.09 | 1160 | 24 % | 0.89 % | -0.37 % | 2.41 | 3.86 | -197 % | 25 % | 84× | 7.6 % | 1.7 % |
| core · coûts × 2 | -87 % | -13.7 % | -1.98 | -2.73 | 0.51 | -87.7 % | -0.16 | 1159 | 20 % | 0.95 % | -0.46 % | 2.07 | 3.86 | -70 % | 25 % | 84× | 15.1 % | 3.4 % |
| core · coûts × 1, sans masque des ouvertures | -55 % | -5.6 % | -0.77 | -1.10 | 0.76 | -58.9 % | -0.09 | 1180 | 24 % | 0.89 % | -0.37 % | 2.40 | 3.87 | -190 % | 25 % | 86× | 7.7 % | 1.7 % |
| achat conservé | 148 % | 6.8 % | 0.48 | — | — | -37.8 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.32, intervalle à 90 % (bootstrap des mois) -0.74 à 0.07, P(Sharpe > 0) 9 %.

Coûts et Sharpe : × 0 → 0.75 · × 0,25 → 0.48 · × 0,5 → 0.21 · × 0,75 → -0.06 · × 1 → -0.33. Seuil de rentabilité vers × 0,69, soit 0,038 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -7 % | -1.42 | -9.7 % | 54 |
| 2014 | 0 % | 0.07 | -7.5 % | 67 |
| 2015 | -4 % | -0.65 | -6.6 % | 62 |
| 2016 | 6 % | 0.87 | -6.9 % | 57 |
| 2017 | -10 % | -1.70 | -13.9 % | 76 |
| 2018 | -8 % | -1.73 | -9.5 % | 69 |
| 2019 | 7 % | 1.41 | -2.9 % | 52 |
| 2020 | 6 % | 0.97 | -8.1 % | 48 |
| 2021 | 1 % | 0.19 | -7.7 % | 76 |
| 2022 | -6 % | -1.07 | -10.6 % | 68 |
| 2023 | -1 % | -0.05 | -10.4 % | 71 |
| 2024 | -15 % | -3.11 | -15.0 % | 77 |
| 2025 | -5 % | -0.79 | -9.3 % | 61 |
| 2026 | 8 % | 1.41 | -4.3 % | 32 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 178 | 33 % | 0.12 % | 0.20 |
| calme | short | 348 | 24 % | -0.05 % | -0.20 |
| agité | long | 344 | 23 % | -0.09 % | -0.32 |

Entrées au hasard (200 tirages, mêmes sorties, 864 trades en médiane) : Sharpe médian -1.18, 95e centile -0.63 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.96 | 4.23 | 803 | 0.387 % | -1152 % |
| -1 bougie (utilise le futur) | 2.70 | 3.69 | 797 | 0.359 % | -1070 % |
| à l'heure | -0.33 | 0.87 | 870 | -0.034 % | 100 % |
| +1 bougie | -0.38 | 0.85 | 877 | -0.038 % | 113 % |
| +2 bougies | -0.41 | 0.84 | 863 | -0.042 % | 126 % |
| +4 bougies | -0.35 | 0.86 | 855 | -0.037 % | 110 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier -0.73, intervalle à 90 % (bootstrap des mois) -1.15 à -0.29, P(Sharpe > 0) 0 %.

Coûts et Sharpe : × 0 → 0.56 · × 0,25 → 0.23 · × 0,5 → -0.09 · × 0,75 → -0.42 · × 1 → -0.74. Seuil de rentabilité vers × 0,43, soit 0,024 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -13 % | -2.54 | -14.7 % | 78 |
| 2014 | -3 % | -0.35 | -9.7 % | 88 |
| 2015 | -6 % | -0.79 | -7.2 % | 82 |
| 2016 | 3 % | 0.39 | -8.4 % | 77 |
| 2017 | -11 % | -1.73 | -14.6 % | 93 |
| 2018 | -10 % | -1.93 | -10.9 % | 82 |
| 2019 | 3 % | 0.61 | -3.9 % | 83 |
| 2020 | 5 % | 0.66 | -10.3 % | 74 |
| 2021 | 0 % | 0.09 | -6.6 % | 90 |
| 2022 | -11 % | -1.62 | -16.2 % | 86 |
| 2023 | 1 % | 0.11 | -10.1 % | 91 |
| 2024 | -19 % | -3.89 | -19.3 % | 98 |
| 2025 | -12 % | -1.68 | -15.5 % | 90 |
| 2026 | 4 % | 0.78 | -4.7 % | 48 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 237 | 29 % | 0.06 % | 0.13 |
| calme | short | 404 | 24 % | -0.07 % | -0.30 |
| agité | long | 519 | 23 % | -0.11 % | -0.58 |

Entrées au hasard (200 tirages, mêmes sorties, 1167 trades en médiane) : Sharpe médian -1.45, 95e centile -0.90 ; la stratégie en bat 99 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 3.31 | 4.08 | 1046 | 0.362 % | -584 % |
| -1 bougie (utilise le futur) | 3.02 | 3.56 | 1049 | 0.332 % | -535 % |
| à l'heure | -0.74 | 0.76 | 1160 | -0.062 % | 100 % |
| +1 bougie | -0.73 | 0.77 | 1166 | -0.059 % | 95 % |
| +2 bougies | -0.73 | 0.77 | 1142 | -0.061 % | 99 % |
| +4 bougies | -0.58 | 0.80 | 1135 | -0.050 % | 81 % |
