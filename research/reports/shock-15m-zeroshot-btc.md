# Zéro-shot du Shock Engine · BTC/USD (Bitstamp)

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

### signaux d'entrée complets · 1 771 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 1771 | +0.140 | +0.138 | +0.070 à +0.205 | 100 % | +0.174 | +0.108 | 90 % de 10 |
| 4 bougies (1 h) | 1771 | +0.287 | +0.278 | +0.153 à +0.406 | 100 % | +0.433 | +0.149 | 80 % de 10 |
| 16 bougies (4 h) | 1771 | +0.403 | +0.369 | +0.186 à +0.556 | 100 % | +0.510 | +0.252 | 80 % de 10 |
| 64 bougies (16 h) | 1771 | +1.262 | +1.105 | +0.706 à +1.501 | 100 % | +1.430 | +0.835 | 100 % de 10 |

### signaux d'entrée « cœur » · 2 271 événements

| horizon | événements | rendement brut (ATR) | excès (ATR) | intervalle 90 % | P(excès > 0) | 1re moitié | 2e moitié | années positives |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 bougie (15 min) | 2271 | +0.126 | +0.124 | +0.065 à +0.182 | 100 % | +0.175 | +0.081 | 80 % de 10 |
| 4 bougies (1 h) | 2271 | +0.256 | +0.246 | +0.124 à +0.366 | 100 % | +0.443 | +0.077 | 60 % de 10 |
| 16 bougies (4 h) | 2271 | +0.428 | +0.391 | +0.229 à +0.565 | 100 % | +0.606 | +0.207 | 80 % de 10 |
| 64 bougies (16 h) | 2271 | +1.291 | +1.118 | +0.800 à +1.432 | 100 % | +1.460 | +0.824 | 100 % de 10 |

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

## 2. Stratégie complète

| variante | rendement | CAGR | Sharpe | Sortino | PF | Max DD | Calmar | trades | gagnants | gain moyen | perte moyenne | payoff | skew | part des 5 % meilleurs | exposition | rotation / an | frais / an | glissement / an |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preset · coûts × 0 | 19592 % | 71.9 % | 1.93 | 2.85 | 1.66 | -26.7 % | 2.69 | 1050 | 32 % | 3.64 % | -0.86 % | 4.22 | 4.38 | 121 % | 24 % | 115× | 0.0 % | 0.0 % |
| preset · coûts × 1 | 7581 % | 56.1 % | 1.61 | 2.36 | 1.46 | -29.6 % | 1.89 | 1050 | 31 % | 3.65 % | -0.94 % | 3.88 | 4.38 | 146 % | 24 % | 115× | 10.3 % | 0.0 % |
| preset · coûts × 2 | 2894 % | 41.7 % | 1.29 | 1.88 | 1.31 | -32.7 % | 1.28 | 1050 | 30 % | 3.67 % | -1.02 % | 3.60 | 4.38 | 185 % | 24 % | 114× | 20.6 % | 0.0 % |
| preset · coûts × 1, sans masque des ouvertures | 7581 % | 56.1 % | 1.61 | 2.36 | 1.46 | -29.6 % | 1.89 | 1050 | 31 % | 3.65 % | -0.94 % | 3.88 | 4.38 | 146 % | 24 % | 115× | 10.3 % | 0.0 % |
| core · coûts × 0 | 26535 % | 77.3 % | 1.95 | 2.89 | 1.57 | -18.9 % | 4.10 | 1321 | 32 % | 3.24 % | -0.81 % | 4.00 | 4.75 | 130 % | 28 % | 142× | 0.0 % | 0.0 % |
| core · coûts × 1 | 8040 % | 57.0 % | 1.57 | 2.31 | 1.38 | -23.5 % | 2.42 | 1321 | 31 % | 3.23 % | -0.89 % | 3.63 | 4.75 | 164 % | 28 % | 141× | 12.7 % | 0.0 % |
| core · coûts × 2 | 2385 % | 39.0 % | 1.18 | 1.73 | 1.23 | -28.3 % | 1.38 | 1321 | 30 % | 3.25 % | -0.97 % | 3.36 | 4.75 | 223 % | 28 % | 140× | 25.3 % | 0.0 % |
| core · coûts × 1, sans masque des ouvertures | 8040 % | 57.0 % | 1.57 | 2.31 | 1.38 | -23.5 % | 2.42 | 1321 | 31 % | 3.23 % | -0.89 % | 3.63 | 4.75 | 164 % | 28 % | 141× | 12.7 % | 0.0 % |
| achat conservé | 8682 % | 58.2 % | 1.01 | — | — | -83.4 % | — | — | — | — | — | — | — | — | 100 % | — | — | — |

### préréglage du bot, entrées complètes

Sharpe journalier 1.55, intervalle à 90 % (bootstrap des mois) 1.12 à 1.94, P(Sharpe > 0) 100 %.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 2 % | 0.21 | -19.0 % | 91 |
| 2018 | 156 % | 2.50 | -19.5 % | 104 |
| 2019 | 108 % | 2.12 | -14.8 % | 93 |
| 2020 | 56 % | 1.42 | -26.1 % | 114 |
| 2021 | 69 % | 1.79 | -11.8 % | 88 |
| 2022 | 65 % | 1.68 | -16.2 % | 110 |
| 2023 | 27 % | 1.09 | -18.3 % | 131 |
| 2024 | 89 % | 2.51 | -16.4 % | 115 |
| 2025 | 10 % | 0.51 | -17.9 % | 116 |
| 2026 | 23 % | 1.49 | -22.0 % | 88 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 242 | 33 % | 1.02 % | 2.24 |
| calme | short | 430 | 27 % | 0.54 % | 1.97 |
| agité | long | 378 | 34 % | 0.04 % | 0.13 |

Entrées au hasard (200 tirages, mêmes sorties, 1055 trades en médiane) : Sharpe médian 0.04, 95e centile 0.51 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.10 | 6.12 | 956 | 1.816 % | 385 % |
| -1 bougie (utilise le futur) | 4.65 | 4.74 | 961 | 1.659 % | 352 % |
| à l'heure | 1.61 | 1.46 | 1050 | 0.472 % | 100 % |
| +1 bougie | 1.38 | 1.45 | 1057 | 0.397 % | 84 % |
| +2 bougies | 1.30 | 1.43 | 1053 | 0.382 % | 81 % |
| +4 bougies | 1.22 | 1.39 | 1031 | 0.360 % | 76 % |

### préréglage, entrées « cœur » (choc + cassure + bougie + tendance 60 min)

Sharpe journalier 1.51, intervalle à 90 % (bootstrap des mois) 1.13 à 1.91, P(Sharpe > 0) 100 %.

| année | rendement | Sharpe | Max DD | trades |
| --- | --- | --- | --- | --- |
| 2017 | 14 % | 0.66 | -19.7 % | 133 |
| 2018 | 145 % | 2.33 | -21.8 % | 131 |
| 2019 | 144 % | 2.51 | -14.8 % | 106 |
| 2020 | 69 % | 1.61 | -18.0 % | 143 |
| 2021 | 42 % | 1.16 | -14.0 % | 131 |
| 2022 | 65 % | 1.64 | -16.2 % | 124 |
| 2023 | 20 % | 0.86 | -21.2 % | 153 |
| 2024 | 89 % | 2.38 | -12.6 % | 154 |
| 2025 | 14 % | 0.65 | -20.5 % | 141 |
| 2026 | 17 % | 1.13 | -23.5 % | 105 |

| jeu | sens | trades | gagnants | moyenne par trade | somme (log) |
| --- | --- | --- | --- | --- | --- |
| calme | long | 293 | 32 % | 0.90 % | 2.38 |
| calme | short | 464 | 27 % | 0.47 % | 1.83 |
| agité | long | 564 | 34 % | 0.04 % | 0.19 |

Entrées au hasard (200 tirages, mêmes sorties, 1332 trades en médiane) : Sharpe médian -0.03, 95e centile 0.46 ; la stratégie en bat 100 %.

| entrée | Sharpe | PF | trades | gain moyen par trade | part du gain moyen à l'heure |
| --- | --- | --- | --- | --- | --- |
| -2 bougies (utilise le futur) | 5.68 | 6.49 | 1193 | 1.677 % | 438 % |
| -1 bougie (utilise le futur) | 5.21 | 5.05 | 1196 | 1.550 % | 405 % |
| à l'heure | 1.57 | 1.38 | 1321 | 0.383 % | 100 % |
| +1 bougie | 1.27 | 1.36 | 1325 | 0.307 % | 80 % |
| +2 bougies | 1.22 | 1.33 | 1313 | 0.297 % | 77 % |
| +4 bougies | 1.14 | 1.30 | 1288 | 0.279 % | 73 % |
