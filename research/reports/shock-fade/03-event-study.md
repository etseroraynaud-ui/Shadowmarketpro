# Shock Fade Engine — étude d'événements BTC/ETH (période E : 2020-07-01 → 2024-12-31)

Généré par `research/fade/shockfade/eventstudy.py`. Perpétuels Binance USDⓈ-M, bougies 1 min ; chocs sur barres de 5 min (principal) et 15 min (secondaire). Entrée à la clôture de la minute qui suit la clôture du choc (une minute de latence). Le holdout C (2025-01 → 2026-09) n'est pas lu.

## 1. Sauts à 1 minute (Merton, test de Lee–Mykland)

Seuil de Gumbel θ = 5.777 (α = 1 %, n = 1 440) sur L = r̃/σ̂ (variation bipuissance des 360 minutes précédentes, rendements désaisonnalisés). Sous l'hypothèse nulle d'une diffusion, on attend au plus ≈ 0,01 saut détecté par jour.

| actif | année | sauts / jour | hausse | baisse | \|saut\| médian (pb) | \|saut\| médian (σ diffusifs) | jours BNS rejetés (0,1 %) | part de la VQ due aux sauts (BNS) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 2020 (S2) | 6.44 | 595 | 590 | 32.1 | 5.8 | 15.2 % | 9.4 % |
| BTCUSDT | 2021 | 4.75 | 961 | 773 | 55.1 | 5.8 | 7.1 % | 5.8 % |
| BTCUSDT | 2022 | 6.58 | 1233 | 1170 | 36.4 | 5.8 | 15.9 % | 10.6 % |
| BTCUSDT | 2023 | 7.33 | 1397 | 1278 | 23.2 | 5.8 | 8.8 % | 12.2 % |
| BTCUSDT | 2024 | 4.82 | 877 | 886 | 32.2 | 5.6 | 3.6 % | 4.7 % |
| ETHUSDT | 2020 (S2) | 5.47 | 466 | 541 | 48.3 | 5.8 | 12.0 % | 7.7 % |
| ETHUSDT | 2021 | 3.65 | 657 | 675 | 67.0 | 5.6 | 5.8 % | 3.2 % |
| ETHUSDT | 2022 | 5.75 | 1085 | 1013 | 50.7 | 5.8 | 12.6 % | 9.6 % |
| ETHUSDT | 2023 | 6.81 | 1256 | 1228 | 27.8 | 5.9 | 13.4 % | 14.0 % |
| ETHUSDT | 2024 | 4.85 | 882 | 893 | 40.1 | 5.6 | 6.3 % | 6.8 % |

Lecture : plusieurs sauts « identifiés » par jour, des centaines de fois le taux de fausses détections attendu sous une diffusion : à 1 min, les queues des rendements crypto sont bien plus épaisses qu'une diffusion à volatilité localement constante. Une partie de ces « sauts » est probablement de la volatilité très courte (sous l'heure) plutôt qu'une vraie discontinuité ; le test ne peut pas les distinguer. Le caractère « saut » est donc statistique (rejet de la diffusion locale), pas une preuve de discontinuité.

## 2. Chocs détectés (|Z| ≥ k, volatilité prévue avant la barre)

| fréquence | actif | k = 3 | k = 4 | k = 5 | hausse (k=4) | baisse (k=4) | avec saut identifié (k=4) | failed breakout (k=4) | par jour (k=4) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 min | BTCUSDT | 7664 | 3305 | 1710 | 1653 | 1652 | 78.1 % | 4.7 % | 2.01 |
| 5 min | ETHUSDT | 7260 | 3052 | 1542 | 1503 | 1549 | 76.3 % | 3.9 % | 1.86 |
| 15 min | BTCUSDT | 2740 | 1170 | 625 | 583 | 587 | 90.6 % | 3.5 % | 0.71 |
| 15 min | ETHUSDT | 2681 | 1112 | 582 | 535 | 577 | 87.9 % | 2.8 % | 0.68 |

Chocs |Z| ≥ 4 à 5 min par année : 2020 : BTC 349, ETH 312; 2021 : BTC 615, ETH 504; 2022 : BTC 845, ETH 822; 2023 : BTC 916, ETH 846; 2024 : BTC 580, ETH 568

## 3. Rendement du Fade après un choc, 5 min (|Z| ≥ 4)

Rendement du Fade (position −d) de la clôture de la minute T+1 à la clôture de T+1+h·Δ, en pb. Coût aller-retour C1 = 14 pb. t : erreur type groupée par jour UTC.

| h | n | moyenne brute | t | médiane | P(> 0) | P(> coût) | moyenne nette C1 | sans latence (brute) | 1 % | 5 % | 95 % | 99 % |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 6357 | 1.0 | 1.09 | 1.7 | 53.3 % | 29.7 % | -13.0 | 2.5 | -165 | -68 | 67 | 172 |
| 2 | 6357 | -1.1 | -0.84 | 1.0 | 51.5 % | 32.3 % | -15.1 | 0.4 | -211 | -94 | 84 | 219 |
| 4 | 6357 | -3.0 | -2.20 | 2.6 | 52.9 % | 37.5 % | -17.0 | -1.5 | -299 | -123 | 106 | 246 |
| 8 | 6355 | -3.0 | -1.75 | 3.7 | 53.4 % | 40.5 % | -17.0 | -1.5 | -356 | -162 | 133 | 305 |
| 16 | 6353 | -1.6 | -0.79 | 5.6 | 54.3 % | 44.5 % | -15.6 | -0.1 | -442 | -202 | 167 | 357 |
| 32 | 6350 | -0.4 | -0.14 | 5.8 | 53.2 % | 45.6 % | -14.4 | 1.1 | -478 | -257 | 217 | 473 |

Sensibilité au seuil k (moyenne brute, pb ; t entre parenthèses) :

| k | n | h=1 | h=2 | h=4 | h=8 | h=16 | h=32 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 14924 | 0.3 (0.6) | -1.0 (-1.5) | -1.1 (-1.5) | -0.4 (-0.4) | -0.2 (-0.1) | 0.6 (0.4) |
| 4 | 6357 | 1.0 (1.1) | -1.1 (-0.8) | -3.0 (-2.2) | -3.0 (-1.7) | -1.6 (-0.8) | -0.4 (-0.1) |
| 5 | 3252 | 3.2 (1.8) | 1.1 (0.4) | -2.7 (-1.2) | -3.2 (-1.2) | -1.0 (-0.3) | 0.7 (0.2) |

## 4. Excursions favorable et adverse (MFE / MAE, 5 min)

Sur le chemin 1 min (hauts et bas) après l'entrée, dans le sens du Fade. |R| = amplitude du choc.

| h | MFE médiane (pb) | MAE médiane (pb) | P(MFE > coût) | MFE médiane / \|R\| | MAE médiane / \|R\| | MAE 95e centile (pb) | MAE 99e centile (pb) |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 17.9 | 18.6 | 58.7 % | 0.26 | 0.26 | 122 | 310 |
| 2 | 23.1 | 25.9 | 66.9 % | 0.33 | 0.35 | 160 | 420 |
| 4 | 29.2 | 35.2 | 73.6 % | 0.41 | 0.48 | 216 | 543 |
| 8 | 37.2 | 45.0 | 79.2 % | 0.53 | 0.62 | 266 | 663 |
| 16 | 48.5 | 58.1 | 83.4 % | 0.68 | 0.77 | 343 | 833 |
| 32 | 63.6 | 72.8 | 87.2 % | 0.90 | 0.99 | 402 | 912 |

Récupération du mouvement (clôtures 1 min, depuis la clôture du choc, censure à 32 barres = 160 min) et, en regard, **extension symétrique** du même pourcentage dans le sens du choc. Une marche aléatoire atteint aussi souvent l'un que l'autre : seule la comparaison des deux colonnes dit s'il y a réversion.

| groupe | n | 25 % repris | ext. 25 % | médiane (min) | 50 % repris | ext. 50 % | médiane (min) | 75 % repris | ext. 75 % | médiane (min) | 100 % repris | ext. 100 % | médiane (min) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| tous | 6357 | 81.4 % | 76.5 % | 4 | 67.4 % | 63.8 % | 16 | 54.3 % | 52.3 % | 31 | 43.0 % | 42.1 % | 46 |
| avec saut identifié | 4910 | 80.3 % | 75.9 % | 4 | 65.8 % | 63.0 % | 16 | 52.5 % | 51.3 % | 30 | 41.3 % | 41.4 % | 46 |
| sans saut identifié | 1447 | 85.1 % | 78.7 % | 4 | 72.8 % | 66.6 % | 17 | 60.6 % | 55.6 % | 32 | 48.9 % | 44.8 % | 47 |
| failed breakout | 275 | 85.1 % | 79.6 % | 4 | 70.5 % | 61.8 % | 16 | 54.9 % | 51.3 % | 35 | 43.6 % | 41.1 % | 46 |
| cassure confirmée | 4642 | 80.9 % | 76.0 % | 4 | 66.7 % | 63.1 % | 16 | 53.8 % | 52.0 % | 30 | 42.6 % | 41.7 % | 44 |

Amplitude de réversion observée (fraction du choc reprise à la sortie, médiane) : h=1 : 0.06, h=2 : 0.05, h=4 : 0.07, h=8 : 0.09, h=16 : 0.13, h=32 : 0.13.

## 5. Intensité Hawkes et nouveaux sauts après le choc (5 min)

Probabilité réalisée d'au moins un saut identifié dans le sens du choc (« continuation ») ou opposé, dans (T, T + 1 + h·Δ] ; prévision Hawkes moyenne (paramètres du trimestre, estimés avant lui) ; référence de Poisson (taux constant des 180 jours précédents). Ce sont des probabilités d'**événements**, pas de signe du rendement.

| h | P(saut même sens) réalisée | Hawkes prévue | Poisson | P(saut sens opposé) réalisée | Hawkes prévue | P(≥ 2 même sens) réalisée | Hawkes prévue |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 18.4 % | 12.3 % | 1.2 % | 14.0 % | 8.5 % | 3.7 % | 2.2 % |
| 2 | 23.2 % | 16.6 % | 2.2 % | 17.8 % | 11.6 % | 6.3 % | 4.2 % |
| 4 | 28.3 % | 20.4 % | 4.2 % | 22.7 % | 14.7 % | 9.2 % | 6.5 % |
| 8 | 33.2 % | 23.6 % | 8.1 % | 27.7 % | 18.0 % | 12.1 % | 8.4 % |
| 16 | 38.3 % | 28.1 % | 15.4 % | 32.5 % | 22.8 % | 15.6 % | 10.6 % |
| 32 | 44.2 % | 36.2 % | 28.1 % | 38.3 % | 31.5 % | 20.1 % | 14.9 % |

Intensité dans le sens du choc rapportée au taux de base μ (médianes) : avant la barre du choc 1.00, à la décision T 23.90, deux barres plus tard (D2) 7.27.

## 6. Répartition par actif, régime de volatilité, sens, saut, session et année (5 min, |Z| ≥ 4)

Moyenne brute du Fade en pb (t groupé par jour) et moyenne nette C1, à h = 4 et 16.

| découpage | groupe | n | h=4 brut (t) | h=4 net C1 | h=16 brut (t) | h=16 net C1 |
|---|---|---:|---:|---:|---:|---:|
| actif | BTCUSDT | 3305 | -3.4 (-2.1) | -17.4 | -0.9 (-0.4) | -14.9 |
| actif | ETHUSDT | 3052 | -2.6 (-1.5) | -16.6 | -2.4 (-0.8) | -16.4 |
| régime de volatilité | calme | 3011 | -3.9 (-2.2) | -17.9 | -1.6 (-0.6) | -15.6 |
| régime de volatilité | normal | 1690 | -0.4 (-0.2) | -14.4 | 0.8 (0.2) | -13.2 |
| régime de volatilité | agité | 1656 | -4.0 (-1.2) | -18.0 | -4.1 (-0.9) | -18.1 |
| sens | choc baissier (Fade long) | 3201 | -0.1 (-0.0) | -14.1 | 5.3 (1.4) | -8.7 |
| sens | choc haussier (Fade short) | 3156 | -6.0 (-3.2) | -20.0 | -8.6 (-2.8) | -22.6 |
| saut | pas de saut identifié | 1447 | -5.6 (-1.9) | -19.6 | -0.9 (-0.3) | -14.9 |
| saut | saut identifié dans la barre | 4910 | -2.3 (-1.3) | -16.3 | -1.8 (-0.7) | -15.8 |
| H1 | failed breakout | 275 | -3.8 (-0.7) | -17.8 | 0.1 (0.0) | -13.9 |
| H1 | pas de failed breakout | 6082 | -3.0 (-2.1) | -17.0 | -1.7 (-0.8) | -15.7 |
| session | Asie 0–8 h | 1889 | -4.1 (-1.9) | -18.1 | -5.7 (-1.6) | -19.7 |
| session | Europe 8–13 h | 1319 | -9.9 (-2.5) | -23.9 | -6.6 (-1.6) | -20.6 |
| session | US 13–21 h | 2162 | -0.1 (-0.0) | -14.1 | 2.8 (0.7) | -11.2 |
| session | soir 21–24 h | 987 | 2.1 (0.8) | -11.9 | 3.2 (0.8) | -10.8 |
| année | 2020 | 661 | 0.2 (0.1) | -13.8 | 0.8 (0.2) | -13.2 |
| année | 2021 | 1119 | -10.0 (-2.2) | -24.0 | -5.2 (-0.8) | -19.2 |
| année | 2022 | 1667 | -0.8 (-0.4) | -14.8 | -2.2 (-0.5) | -16.2 |
| année | 2023 | 1762 | -2.1 (-1.0) | -16.1 | 1.3 (0.5) | -12.7 |
| année | 2024 | 1148 | -2.6 (-0.9) | -16.6 | -3.1 (-0.7) | -17.1 |

## 7. Fréquence secondaire : rendement du Fade après un choc, 15 min (|Z| ≥ 4)

Rendement du Fade (position −d) de la clôture de la minute T+1 à la clôture de T+1+h·Δ, en pb. Coût aller-retour C1 = 14 pb. t : erreur type groupée par jour UTC.

| h | n | moyenne brute | t | médiane | P(> 0) | P(> coût) | moyenne nette C1 | sans latence (brute) | 1 % | 5 % | 95 % | 99 % |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2282 | -5.1 | -2.58 | 2.0 | 52.4 % | 37.2 % | -19.1 | -5.8 | -288 | -124 | 97 | 215 |
| 2 | 2282 | -5.7 | -2.30 | 1.2 | 51.1 % | 40.1 % | -19.7 | -6.4 | -308 | -152 | 124 | 301 |
| 4 | 2282 | -3.9 | -1.32 | 4.7 | 53.2 % | 42.5 % | -17.9 | -4.5 | -395 | -185 | 155 | 341 |
| 8 | 2280 | -2.3 | -0.60 | 7.7 | 53.4 % | 46.7 % | -16.3 | -3.0 | -442 | -244 | 228 | 432 |
| 16 | 2279 | 0.5 | 0.11 | 3.9 | 51.9 % | 46.1 % | -13.5 | -0.1 | -517 | -298 | 285 | 581 |
| 32 | 2273 | -3.7 | -0.58 | 9.9 | 52.8 % | 48.7 % | -17.7 | -4.3 | -680 | -386 | 356 | 676 |

Sensibilité au seuil k (moyenne brute, pb ; t entre parenthèses) :

| k | n | h=1 | h=2 | h=4 | h=8 | h=16 | h=32 |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 3 | 5421 | -2.7 (-2.4) | -2.0 (-1.3) | 0.2 (0.1) | 1.6 (0.7) | 4.0 (1.3) | 2.6 (0.7) |
| 4 | 2282 | -5.1 (-2.6) | -5.7 (-2.3) | -3.9 (-1.3) | -2.3 (-0.6) | 0.5 (0.1) | -3.7 (-0.6) |
| 5 | 1207 | -5.2 (-1.8) | -5.0 (-1.4) | -5.2 (-1.2) | -5.4 (-1.1) | -4.9 (-0.8) | -9.0 (-1.1) |

