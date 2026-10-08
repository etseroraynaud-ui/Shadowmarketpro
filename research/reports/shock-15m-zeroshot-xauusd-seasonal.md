# Zéro-shot du Shock Engine · Or comptant XAU/USD (Dukascopy) · normalisation saisonnière

15 min, 2013-01-01 → 2026-09-30 (13.7 ans, préchauffage depuis 2012-01-01). Stratégie figée, aucune variable ajoutée, aucun réglage réestimé. Coûts × 1 : commission 0,045 % par ordre + glissement 0,01 % par ordre (données au prix acheteur), sans levier. Produit par `node research/shock/zero-shot.ts --asset xauusd --draws 200 --seasonal`.

**Normalisation saisonnière** (déclarée avant le test, sans paramètre ajusté) : pour détecter les chocs et le volume, le rendement de chaque bougie est divisé par la volatilité habituelle de son quart d'heure (heure de New York) et le volume par le volume habituel de ce quart d'heure, mesurés sur les 60 jours de séance précédents. Sorties, stops et ATR inchangés.

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

### signaux d'entrée complets · 898 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 898 | −0.039 | −0.037 | −0.097 à +0.024 | 16 % | −0.056 | −0.015 | 29 % de 14 |
| 4 bougies (1 h) | 898 | +0.046 | +0.045 | −0.076 à +0.164 | 72 % | +0.075 | +0.009 | 57 % de 14 |
| 16 bougies (4 h) | 898 | +0.175 | +0.158 | −0.057 à +0.372 | 89 % | +0.329 | −0.054 | 79 % de 14 |
| 64 bougies (16 h) | 898 | +0.518 | +0.406 | −0.071 à +0.862 | 92 % | +0.784 | −0.059 | 50 % de 14 |

### signaux d'entrée « cœur » · 1 499 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1499 | −0.036 | −0.034 | −0.084 à +0.019 | 14 % | −0.034 | −0.035 | 29 % de 14 |
| 4 bougies (1 h) | 1499 | +0.031 | +0.032 | −0.064 à +0.131 | 71 % | +0.076 | −0.020 | 50 % de 14 |
| 16 bougies (4 h) | 1499 | +0.162 | +0.152 | −0.018 à +0.317 | 93 % | +0.242 | +0.045 | 79 % de 14 |
| 64 bougies (16 h) | 1499 | +0.436 | +0.324 | −0.026 à +0.669 | 94 % | +0.513 | +0.102 | 64 % de 14 |

### chocs bruts (|z| > seuil du régime) · 10 540 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 10540 | −0.015 | −0.013 | −0.028 à +0.002 | 7 % | −0.000 | −0.025 | 36 % de 14 |
| 4 bougies (1 h) | 10540 | −0.012 | −0.009 | −0.035 à +0.021 | 31 % | +0.034 | −0.047 | 50 % de 14 |
| 16 bougies (4 h) | 10540 | +0.015 | +0.026 | −0.027 à +0.077 | 79 % | +0.061 | −0.007 | 64 % de 14 |
| 64 bougies (16 h) | 10539 | +0.026 | +0.051 | −0.054 à +0.161 | 81 % | +0.114 | −0.006 | 64 % de 14 |

### chocs bruts dans le sens de la tendance 60 min · 6 302 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 6302 | −0.020 | −0.019 | −0.039 à +0.001 | 6 % | −0.010 | −0.028 | 21 % de 14 |
| 4 bougies (1 h) | 6302 | −0.018 | −0.016 | −0.056 à +0.023 | 26 % | +0.010 | −0.043 | 50 % de 14 |
| 16 bougies (4 h) | 6302 | +0.024 | +0.025 | −0.052 à +0.101 | 71 % | +0.014 | +0.037 | 57 % de 14 |
| 64 bougies (16 h) | 6302 | +0.149 | +0.138 | −0.070 à +0.366 | 87 % | +0.147 | +0.129 | 57 % de 14 |

### Par plage horaire (descriptif, non utilisé pour décider)

Excès en ATR après les événements, selon l'heure de New York de la bougie du choc. Cinq plages comparées : un écart isolé peut être dû au hasard.

| chocs bruts dans le sens de la tendance 60 min | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 2017 | −0.038 | −0.103 à +0.025 | −0.065 | −0.179 à +0.054 |
| Londres (2 h – 8 h) | 1693 | −0.052 | −0.136 à +0.033 | +0.050 | −0.132 à +0.243 |
| New York matin (8 h – 12 h) | 1323 | +0.082 | −0.036 à +0.200 | +0.118 | −0.073 à +0.307 |
| dont bougie de 8 h 30 (annonces) | 136 | +0.172 | −0.237 à +0.580 | +0.115 | −0.471 à +0.707 |
| New York après-midi (12 h – 18 h) | 1269 | −0.037 | −0.118 à +0.047 | +0.039 | −0.099 à +0.188 |

| signaux d'entrée complets | événements | excès à 1 h | intervalle 90 % | excès à 4 h | intervalle 90 % |
| --- | --- | --- | --- | --- | --- |
| Asie (18 h – 2 h) | 270 | −0.087 | −0.275 à +0.106 | −0.062 | −0.395 à +0.258 |
| Londres (2 h – 8 h) | 233 | −0.062 | −0.296 à +0.156 | +0.320 | −0.128 à +0.730 |
| New York matin (8 h – 12 h) | 216 | +0.350 | +0.017 à +0.661 | +0.341 | −0.147 à +0.840 |
| dont bougie de 8 h 30 (annonces) | 34 | +0.459 | −0.443 à +1.385 | +1.091 | −0.193 à +2.486 |
| New York après-midi (12 h – 18 h) | 179 | +0.016 | −0.240 à +0.262 | +0.056 | −0.314 à +0.394 |

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 66 % | 3.7 % | 0.70 | 1.03 | 1.40 | -7.5 % | 0.50 | 664 | 29 % | 0.92 % | -0.27 % | 3.40 | 3.61 | 193 % | 15 % | 48× | 0.0 % | 0.0 % |
| preset · coûts × 1 | -20 % | -1.6 % | -0.26 | -0.38 | 0.88 | -23.4 % | -0.07 | 664 | 25 % | 0.96 % | -0.36 % | 2.65 | 3.61 | -424 % | 15 % | 48× | 4.4 % | 1.0 % |
| preset · coûts × 2 | -61 % | -6.7 % | -1.17 | -1.64 | 0.59 | -62.3 % | -0.11 | 664 | 22 % | 0.97 % | -0.46 % | 2.13 | 3.61 | -95 % | 15 % | 49× | 8.8 % | 2.0 % |
| preset · coûts × 1, sans masque des ouvertures | -21 % | -1.7 % | -0.28 | -0.41 | 0.87 | -24.8 % | -0.07 | 670 | 25 % | 0.96 % | -0.36 % | 2.63 | 3.62 | -397 % | 15 % | 49× | 4.4 % | 1.0 % |
| core · coûts × 0 | 83 % | 4.5 % | 0.71 | 1.05 | 1.32 | -11.8 % | 0.38 | 1010 | 29 % | 0.87 % | -0.27 % | 3.28 | 3.68 | 228 % | 22 % | 73× | 0.0 % | 0.0 % |
| core · coûts × 1 | -38 % | -3.5 % | -0.50 | -0.72 | 0.82 | -44.1 % | -0.08 | 1007 | 25 % | 0.90 % | -0.36 % | 2.51 | 3.66 | -269 % | 22 % | 73× | 6.6 % | 1.5 % |
| core · coûts × 2 | -80 % | -10.9 % | -1.66 | -2.31 | 0.53 | -80.9 % | -0.14 | 1007 | 21 % | 0.93 % | -0.45 % | 2.08 | 3.66 | -79 % | 22 % | 74× | 13.3 % | 3.0 % |
| core · coûts × 1, sans masque des ouvertures | -40 % | -3.7 % | -0.53 | -0.75 | 0.81 | -45.6 % | -0.08 | 1025 | 25 % | 0.89 % | -0.36 % | 2.48 | 3.66 | -257 % | 23 % | 75× | 6.7 % | 1.5 % |
| achat conservé | 148 % | 6.8 % | 0.48 | — | — | -37.8 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier -0.26, intervalle à 90 % (bootstrap des mois) -0.68 à 0.19, P(Sharpe > 0) 17 %.

Coûts et Sharpe : × 0 → 0.70 · × 0,25 → 0.45 · × 0,5 → 0.21 · × 0,75 → -0.02 · × 1 → -0.26. Seuil de rentabilité vers × 0,72, soit 0,040 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -7 % | -1.70 | -8.7 % | 51 |
| 2014 | 5 % | 0.71 | -5.1 % | 51 |
| 2015 | -7 % | -1.01 | -8.9 % | 54 |
| 2016 | -3 % | -0.53 | -7.3 % | 53 |
| 2017 | 1 % | 0.20 | -3.7 % | 51 |
| 2018 | -9 % | -2.12 | -9.0 % | 58 |
| 2019 | 3 % | 0.71 | -4.6 % | 50 |
| 2020 | 7 % | 1.12 | -5.1 % | 33 |
| 2021 | 8 % | 0.90 | -5.0 % | 52 |
| 2022 | -4 % | -0.83 | -9.2 % | 46 |
| 2023 | -4 % | -1.11 | -5.6 % | 39 |
| 2024 | -7 % | -1.79 | -9.3 % | 50 |
| 2025 | -0 % | -0.01 | -5.2 % | 44 |
| 2026 | -2 % | -0.45 | -5.6 % | 32 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 141 | 29 % | 0.05 % | 0.06 |
| calme | short | 230 | 27 % | 0.02 % | 0.04 |
| agité | long | 293 | 22 % | -0.11 % | -0.33 |

Entrées au hasard (200 tirages, mêmes sorties, 667 trades en médiane) : Sharpe médian -1.04, 95e centile -0.54 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.40 | 3.76 | 627 | 0.354 % | -1181 % |
| -1 bougie (utilise le futur) | 2.21 | 3.37 | 631 | 0.327 % | -1089 % |
| à l'heure | -0.26 | 0.88 | 664 | -0.030 % | 100 % |
| +1 bougie | -0.33 | 0.85 | 660 | -0.038 % | 125 % |
| +2 bougies | -0.38 | 0.82 | 658 | -0.044 % | 145 % |
| +4 bougies | -0.33 | 0.85 | 659 | -0.038 % | 127 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier -0.49, intervalle à 90 % (bootstrap des mois) -0.95 à -0.09, P(Sharpe > 0) 3 %.

Coûts et Sharpe : × 0 → 0.71 · × 0,25 → 0.40 · × 0,5 → 0.11 · × 0,75 → -0.20 · × 1 → -0.50. Seuil de rentabilité vers × 0,59, soit 0,032 % de coût par ordre.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2013 | -11 % | -2.24 | -13.2 % | 77 |
| 2014 | 2 % | 0.27 | -5.5 % | 74 |
| 2015 | -6 % | -0.89 | -8.9 % | 73 |
| 2016 | -5 % | -0.79 | -11.0 % | 75 |
| 2017 | -6 % | -0.89 | -8.7 % | 78 |
| 2018 | -10 % | -2.16 | -10.2 % | 81 |
| 2019 | 9 % | 1.62 | -3.3 % | 75 |
| 2020 | 5 % | 0.75 | -7.9 % | 55 |
| 2021 | 6 % | 0.65 | -6.8 % | 74 |
| 2022 | -8 % | -1.28 | -11.7 % | 72 |
| 2023 | -6 % | -1.14 | -8.6 % | 77 |
| 2024 | -11 % | -2.41 | -11.9 % | 73 |
| 2025 | -5 % | -0.69 | -9.5 % | 75 |
| 2026 | 2 % | 0.45 | -5.5 % | 48 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 226 | 30 % | 0.05 % | 0.10 |
| calme | short | 326 | 25 % | -0.02 % | -0.08 |
| agité | long | 455 | 23 % | -0.11 % | -0.51 |

Entrées au hasard (200 tirages, mêmes sorties, 1017 trades en médiane) : Sharpe médian -1.33, 95e centile -0.90 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 2.93 | 4.10 | 924 | 0.342 % | -757 % |
| -1 bougie (utilise le futur) | 2.71 | 3.57 | 935 | 0.316 % | -700 % |
| à l'heure | -0.50 | 0.82 | 1007 | -0.045 % | 100 % |
| +1 bougie | -0.54 | 0.80 | 1006 | -0.047 % | 105 % |
| +2 bougies | -0.68 | 0.76 | 1007 | -0.059 % | 131 % |
| +4 bougies | -0.65 | 0.77 | 1003 | -0.058 % | 128 % |
