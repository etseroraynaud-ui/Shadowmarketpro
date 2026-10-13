# Robustesse locale du préréglage · Shock Engine 15 min · régime calme seul, shorts en régime de tendance baissier

ETH/USDT Binance 15 min, 2018-09-01 → 2026-09-30, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --asset ethusdt --n 300 --n-ext 100 --seed 7 --calm` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Le préréglage a été choisi sur BTC, jamais sur cet actif** : ce test dit si, transposé tel quel, il tombe sur un plateau de ETH/USDT ou sur un pic isolé.

## En bref

- **±5 %** : Sharpe médian des voisins 2.05 (préréglage 2.05, P10–P90 1.91–2.19) ; le préréglage fait mieux que 55 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 2.03 (préréglage 2.05, P10–P90 1.81–2.21) ; le préréglage fait mieux que 55 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.94 (préréglage 2.05, P10–P90 1.76–2.14) ; le préréglage fait mieux que 76 % des voisins ; 99 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.

## Ce qui est perturbé

Réglages fixés par le préréglage et utilisés par le moteur : 23, tous perturbés en même temps. Famille étendue : 8 réglages du script en plus, que le préréglage laisse à leur valeur par défaut mais qui agissent.

| régime | réglage | valeur | perturbation | à ±20 % | famille |
| --- | --- | --- | --- | --- | --- |
| calme | `volWin` | 130 | relative, arrondie | 104 → 156 | préréglage |
| calme | `kMain` | 2.9 | relative | 2.32 → 3.48 | préréglage |
| calme | `rangeWin` | 15 | relative, arrondie | 12 → 18 | préréglage |
| calme | `wickThr` | 0.4 | relative | 0.32 → 0.48 | préréglage |
| calme | `htfEmaLen` | 70 | relative, arrondie | 56 → 84 | préréglage |
| calme | `volZWin` | 75 | relative, arrondie | 60 → 90 | préréglage |
| calme | `volZThr` | 1.3 | additive : ± L × 1.3 | 1.04 → 1.56 | préréglage |
| calme | `atrLen` | 30 | relative, arrondie | 24 → 36 | préréglage |
| calme | `atrStopMult` | 3.3 | relative | 2.64 → 3.96 | préréglage |
| calme | `atrTrailMult` | 50 | relative | 40 → 60 | préréglage |
| agité | `volWin` | 150 | relative, arrondie | 120 → 180 | préréglage |
| agité | `kMain` | 2.4 | relative | 1.92 → 2.88 | préréglage |
| agité | `kMicro` | 2.2 | relative | 1.76 → 2.64 | préréglage |
| agité | `rangeWin` | 50 | relative, arrondie | 40 → 60 | préréglage |
| agité | `wickThr` | 0.45 | relative | 0.36 → 0.54 | préréglage |
| agité | `htfEmaLen` | 65 | relative, arrondie | 52 → 78 | préréglage |
| agité | `volZWin` | 25 | relative, arrondie | 20 → 30 | préréglage |
| agité | `volZThr` | -0.5 | additive : ± L × 1 | -0.7 → -0.3 | préréglage |
| agité | `atrLen` | 22 | relative, arrondie | 18 → 26 | préréglage |
| agité | `atrStopMult` | 1.1 | relative | 0.88 → 1.32 | préréglage |
| agité | `atrTrailMult` | 3.2 | relative | 2.56 → 3.84 | préréglage |
| agité | `tp1AtrMult` | 0.9 | relative | 0.72 → 1.08 | préréglage |
| agité | `tp1QtyPct` | 20 | relative, arrondie | 16 → 24 | préréglage |
| calme | `lamEmaWin` | 150 | relative, arrondie | 120 → 180 | étendue |
| calme | `lamNormWin` | 300 | relative, arrondie | 240 → 360 | étendue |
| calme | `longLamPct` | 55 | relative | 44 → 66 | étendue |
| calme | `htfSlopeBars` | 3 | relative, arrondie | 2 → 4 | étendue |
| agité | `lamEmaWin` | 150 | relative, arrondie | 120 → 180 | étendue |
| agité | `lamNormWin` | 300 | relative, arrondie | 240 → 360 | étendue |
| agité | `longLamPct` | 55 | relative | 44 → 66 | étendue |
| agité | `htfSlopeBars` | 3 | relative, arrondie | 2 → 4 | étendue |

Trois réglages du régime agité, bien que fixés par le préréglage, n'agissent pas ou presque dans la zone testée. Ils restent perturbés (comme tous les autres), mais leurs écarts ne changent rien :

| réglage | effet mesuré à ±20 % | pourquoi |
| --- | --- | --- |
| agité · kMain | aucune bougie ne change | le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s'il passe sous 2,0 |
| agité · wickThr | aucune bougie ne change | un long exige une clôture dans le quart haut de la bougie, donc une mèche haute < 0,25 : un seuil de 0,36 à 0,54 ne filtre rien |
| agité · volZThr | aucune bougie ne change | un long exige déjà un volume au-dessus de sa moyenne (z > 0) : un seuil de −0,7 à −0,3 ne filtre rien |

Réglages du préréglage **sans effet**, donc non perturbés (vérifié : à ±5, ±10 et ±20 %, aucune bougie ne change) :

| régime | réglage | valeur | pourquoi | vérifié sans effet |
| --- | --- | --- | --- | --- |
| calme | `cooldownBars` | 3 | mode High Activity : cooldown = max(⌊valeur / 2⌋, 2), soit 2 bougies pour toute valeur de 2 à 5 | oui |
| calme | `compThr` | -0.5 | mode High Activity : le filtre de compression est coupé | oui |
| agité | `cooldownBars` | 4 | mode High Activity : cooldown = max(⌊valeur / 2⌋, 2), soit 2 bougies pour toute valeur de 2 à 5 | oui |
| agité | `compThr` | 0.2 | mode High Activity : le filtre de compression est coupé | oui |
| calme | `kMicro` | 1.7 | micro-chocs coupés en régime calme (useMicroShock = false) | oui |
| calme | `tp1AtrMult` | 0.8 | TP1 coupé en régime calme (useTP1 = false) | oui |
| calme | `tp1QtyPct` | 20 | TP1 coupé en régime calme (useTP1 = false) | oui |

Restent fixes aussi les choix de structure : sens autorisés, TP1 et micro-chocs activés ou non, mode High Activity, filtre 60 min, sortie sur signal inverse.

## Voisins aléatoires · 2018–2026

Rang : part des voisins que le préréglage bat (Max DD : moins profond). Autour de 50 % : le préréglage est au milieu de ses voisins (plateau) ; proche de 100 % : il est au sommet d'un pic.

### ±5 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 11490 % | 7287 % | 8682 % | 10836 % | 13122 % | 16761 % | 57 % |
| CAGR | 80.0 % | 70.3 % | 74.0 % | 78.8 % | 83.0 % | 88.6 % | 57 % |
| Sharpe | 2.05 | 1.91 | 1.96 | 2.05 | 2.11 | 2.19 | 55 % |
| Sortino | 3.03 | 2.82 | 2.90 | 3.02 | 3.12 | 3.23 | 55 % |
| Profit factor | 2.73 | 2.24 | 2.45 | 2.70 | 2.87 | 3.01 | 55 % |
| Max DD | -26.7 % | -31.8 % | -29.1 % | -27.3 % | -26.3 % | -25.1 % | 64 % |
| Trades | 358 | 338 | 345 | 354 | 363 | 368 | 63 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 11490 % | 5216 % | 7003 % | 10469 % | 14657 % | 17769 % | 57 % |
| CAGR | 80.0 % | 63.5 % | 69.5 % | 78.0 % | 85.5 % | 90.0 % | 57 % |
| Sharpe | 2.05 | 1.81 | 1.91 | 2.03 | 2.15 | 2.21 | 55 % |
| Sortino | 3.03 | 2.67 | 2.83 | 2.99 | 3.18 | 3.26 | 55 % |
| Profit factor | 2.73 | 2.11 | 2.28 | 2.66 | 2.91 | 3.05 | 58 % |
| Max DD | -26.7 % | -31.1 % | -28.6 % | -26.8 % | -25.5 % | -24.1 % | 52 % |
| Trades | 358 | 318 | 330 | 351 | 363 | 375 | 67 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 11490 % | 4134 % | 5266 % | 7454 % | 11020 % | 14017 % | 78 % |
| CAGR | 80.0 % | 59.0 % | 63.7 % | 70.8 % | 79.1 % | 84.5 % | 78 % |
| Sharpe | 2.05 | 1.76 | 1.84 | 1.94 | 2.05 | 2.14 | 76 % |
| Sortino | 3.03 | 2.59 | 2.72 | 2.87 | 3.02 | 3.16 | 76 % |
| Profit factor | 2.73 | 2.04 | 2.18 | 2.46 | 2.85 | 3.00 | 65 % |
| Max DD | -26.7 % | -31.4 % | -29.3 % | -26.6 % | -24.6 % | -23.2 % | 49 % |
| Trades | 358 | 295 | 315 | 352 | 381 | 409 | 57 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 99 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 2.05 | 1.92 · 2.03 · 2.20 | 70.9 % · 77.6 % · 89.9 % | -31.5 % · -27.4 % · -25.0 % | 100 % | 56 % |
| ±10 % | 100 | 2.05 | 1.80 · 2.01 · 2.15 | 63.1 % · 76.0 % · 85.5 % | -30.3 % · -26.7 % · -24.1 % | 100 % | 60 % |
| ±20 % | 100 | 2.05 | 1.76 · 1.96 · 2.12 | 58.2 % · 71.7 % · 84.8 % | -31.2 % · -27.2 % · -23.6 % | 100 % | 69 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2018–2020 | ±5 % | 2.06 | 2.01 · 2.09 · 2.19 · 2.27 · 2.34 | 423.8 % | 488.4 % (399.9 % – 590.2 %) | 161.7 % | 100 % | 100 % | 16 % |
| 2018–2020 | ±10 % | 2.06 | 1.92 · 2.06 · 2.18 · 2.30 · 2.37 | 423.8 % | 484.5 % (338.3 % – 597.1 %) | 161.7 % | 100 % | 100 % | 25 % |
| 2018–2020 | ±20 % | 2.06 | 1.87 · 1.98 · 2.11 · 2.22 · 2.32 | 423.8 % | 433.3 % (330.3 % – 561.4 %) | 161.7 % | 100 % | 100 % | 40 % |
| 2021–2022 | ±5 % | 1.94 | 1.57 · 1.70 · 1.86 · 1.97 · 2.08 | 212.0 % | 191.0 % (134.7 % – 228.6 %) | 62.4 % | 100 % | 100 % | 71 % |
| 2021–2022 | ±10 % | 1.94 | 1.54 · 1.73 · 1.88 · 2.04 · 2.16 | 212.0 % | 191.3 % (124.9 % – 250.5 %) | 62.4 % | 100 % | 100 % | 60 % |
| 2021–2022 | ±20 % | 1.94 | 1.30 · 1.51 · 1.71 · 1.94 · 2.12 | 212.0 % | 142.2 % (92.1 % – 231.5 %) | 62.4 % | 100 % | 97 % | 75 % |
| 2023–2024 | ±5 % | 1.79 | 1.13 · 1.31 · 1.52 · 1.87 · 1.98 | 103.4 % | 77.8 % (50.3 % – 124.2 %) | 179.0 % | 100 % | 0 % | 67 % |
| 2023–2024 | ±10 % | 1.79 | 0.84 · 1.09 · 1.44 · 1.79 · 1.97 | 103.4 % | 71.5 % (33.8 % – 122.5 %) | 179.0 % | 100 % | 0 % | 75 % |
| 2023–2024 | ±20 % | 1.79 | 0.85 · 1.08 · 1.34 · 1.56 · 1.81 | 103.4 % | 65.3 % (33.8 % – 109.2 %) | 179.0 % | 100 % | 0 % | 89 % |
| 2025–2026 | ±5 % | 2.61 | 2.20 · 2.41 · 2.67 · 2.91 · 3.01 | 248.7 % | 257.6 % (175.5 % – 340.1 %) | -19.5 % | 100 % | 100 % | 44 % |
| 2025–2026 | ±10 % | 2.61 | 2.15 · 2.40 · 2.70 · 2.92 · 3.03 | 248.7 % | 272.9 % (164.4 % – 351.2 %) | -19.5 % | 100 % | 100 % | 41 % |
| 2025–2026 | ±20 % | 2.61 | 2.22 · 2.42 · 2.69 · 2.91 · 3.07 | 248.7 % | 251.5 % (169.9 % – 351.3 %) | -19.5 % | 100 % | 100 % | 41 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2018–2026 | -26.7 % | -26.8 % (-31.1 %) | 2.73 | 2.66 (2.11) | 358 | 351 |
| 2018–2020 | -26.7 % | -26.8 % (-31.1 %) | 2.01 | 2.27 (2.05) | 122 | 115 |
| 2021–2022 | -19.7 % | -20.2 % (-23.4 %) | 2.23 | 2.19 (1.86) | 79 | 78 |
| 2023–2024 | -12.6 % | -14.1 % (-21.0 %) | 2.48 | 2.05 (1.49) | 80 | 80 |
| 2025–2026 | -16.0 % | -16.3 % (-17.9 %) | 2.98 | 2.93 (2.30) | 77 | 76 |

## Un réglage à la fois · Sharpe 2018–2026

Les autres réglages restent ceux du préréglage (Sharpe 2.05).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 2.10 (104) | 1.99 (117) | 2.07 (124) | 2.09 (137) | 1.93 (143) | 1.89 (156) | -0.17 |
| calme · kMain | 1.79 (2.32) | 1.98 (2.61) | 1.90 (2.755) | 2.20 (3.045) | 2.06 (3.19) | 1.80 (3.48) | -0.27 |
| calme · rangeWin | 2.10 (12) | 2.06 (14) | 2.06 (14) | 2.12 (16) | 2.10 (17) | 2.12 (18) | 0.01 |
| calme · wickThr | 2.06 (0.32) | 2.09 (0.36) | 2.07 (0.38) | 2.05 (0.42) | 2.07 (0.44) | 2.10 (0.48) | -0.01 |
| calme · htfEmaLen | 1.98 (56) | 2.02 (63) | 2.00 (67) | 1.90 (74) | 1.87 (77) | 2.03 (84) | -0.19 |
| calme · volZWin | 2.09 (60) | 2.09 (68) | 2.09 (71) | 2.08 (79) | 2.09 (83) | 2.09 (90) | 0.03 |
| calme · volZThr | 2.12 (1.04) | 2.09 (1.17) | 2.11 (1.235) | 2.06 (1.365) | 2.06 (1.43) | 1.99 (1.56) | -0.06 |
| calme · atrLen | 2.08 (24) | 2.04 (27) | 2.06 (29) | 2.06 (32) | 2.07 (33) | 2.08 (36) | -0.01 |
| calme · atrStopMult | 2.12 (2.64) | 2.12 (2.97) | 2.11 (3.135) | 2.05 (3.465) | 2.05 (3.63) | 2.07 (3.96) | -0.01 |
| calme · atrTrailMult | 2.06 (40) | 2.05 (45) | 2.04 (47.5) | 2.05 (52.5) | 2.05 (55) | 2.05 (60) | -0.01 |
| agité · volWin | 2.05 (120) | 2.05 (135) | 2.05 (143) | 2.05 (158) | 2.05 (165) | 2.05 (180) | aucun effet |
| agité · kMain | 2.05 (1.92) | 2.05 (2.16) | 2.05 (2.28) | 2.05 (2.52) | 2.05 (2.64) | 2.05 (2.88) | aucun effet |
| agité · kMicro | 2.05 (1.76) | 2.05 (1.98) | 2.05 (2.09) | 2.05 (2.31) | 2.05 (2.42) | 2.05 (2.64) | aucun effet |
| agité · rangeWin | 2.05 (40) | 2.05 (45) | 2.05 (48) | 2.05 (53) | 2.05 (55) | 2.05 (60) | aucun effet |
| agité · wickThr | 2.05 (0.36) | 2.05 (0.405) | 2.05 (0.4275) | 2.05 (0.4725) | 2.05 (0.495) | 2.05 (0.54) | aucun effet |
| agité · htfEmaLen | 2.05 (52) | 2.05 (59) | 2.05 (62) | 2.05 (68) | 2.05 (72) | 2.05 (78) | aucun effet |
| agité · volZWin | 2.05 (20) | 2.05 (23) | 2.05 (24) | 2.05 (26) | 2.05 (28) | 2.05 (30) | aucun effet |
| agité · volZThr | 2.05 (-0.7) | 2.05 (-0.6) | 2.05 (-0.55) | 2.05 (-0.45) | 2.05 (-0.4) | 2.05 (-0.3) | aucun effet |
| agité · atrLen | 2.05 (18) | 2.05 (20) | 2.05 (21) | 2.05 (23) | 2.05 (24) | 2.05 (26) | aucun effet |
| agité · atrStopMult | 2.05 (0.88) | 2.05 (0.99) | 2.05 (1.045) | 2.05 (1.155) | 2.05 (1.21) | 2.05 (1.32) | aucun effet |
| agité · atrTrailMult | 2.05 (2.56) | 2.05 (2.88) | 2.05 (3.04) | 2.05 (3.36) | 2.05 (3.52) | 2.05 (3.84) | aucun effet |
| agité · tp1AtrMult | 2.05 (0.72) | 2.05 (0.81) | 2.05 (0.855) | 2.05 (0.945) | 2.05 (0.99) | 2.05 (1.08) | aucun effet |
| agité · tp1QtyPct | 2.05 (16) | 2.05 (18) | 2.05 (19) | 2.05 (21) | 2.05 (22) | 2.05 (24) | aucun effet |
| calme · lamEmaWin | 2.03 (120) | 2.05 (135) | 2.05 (143) | 2.01 (158) | 2.01 (165) | 2.03 (180) | -0.04 |
| calme · lamNormWin | 2.02 (240) | 2.07 (270) | 2.08 (285) | 2.01 (315) | 1.99 (330) | 2.00 (360) | -0.06 |
| calme · longLamPct | 2.00 (44) | 2.03 (49.5) | 2.05 (52.25) | 2.05 (57.75) | 2.06 (60.5) | 1.99 (66) | -0.06 |
| calme · htfSlopeBars | 2.07 (2) | 2.05 (3) | 2.05 (3) | 2.05 (3) | 2.05 (3) | 1.91 (4) | -0.14 |
| agité · lamEmaWin | 2.05 (120) | 2.05 (135) | 2.05 (143) | 2.05 (158) | 2.05 (165) | 2.05 (180) | aucun effet |
| agité · lamNormWin | 2.05 (240) | 2.05 (270) | 2.05 (285) | 2.05 (315) | 2.05 (330) | 2.05 (360) | aucun effet |
| agité · longLamPct | 2.05 (44) | 2.05 (49.5) | 2.05 (52.25) | 2.05 (57.75) | 2.05 (60.5) | 2.05 (66) | aucun effet |
| agité · htfSlopeBars | 2.05 (2) | 2.05 (3) | 2.05 (3) | 2.05 (3) | 2.05 (3) | 2.05 (4) | aucun effet |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| calme · kMain | 0.44 | 0.58 | -0.31 |
| calme · htfEmaLen | -0.18 | -0.16 | 0.04 |
| calme · volZThr | -0.11 | -0.15 | -0.03 |
| agité · kMicro | 0.09 | 0.09 | 0.01 |
| agité · volZThr | -0.08 | -0.10 | -0.04 |
| agité · atrLen | -0.08 | -0.09 | 0.03 |
| calme · atrLen | -0.08 | -0.11 | 0.05 |
| agité · atrTrailMult | -0.07 | -0.06 | -0.03 |
| agité · htfEmaLen | -0.06 | -0.05 | -0.02 |
| calme · volZWin | 0.05 | 0.05 | 0.17 |
| agité · volWin | 0.04 | 0.06 | -0.02 |
| agité · tp1AtrMult | -0.04 | -0.07 | 0.07 |
| agité · wickThr | 0.03 | 0.01 | -0.03 |
| agité · tp1QtyPct | 0.03 | 0.01 | -0.02 |
| agité · kMain | -0.02 | -0.03 | -0.07 |
| calme · volWin | -0.02 | -0.05 | -0.07 |
| agité · volZWin | -0.02 | -0.03 | 0.09 |
| agité · rangeWin | 0.01 | 0.03 | -0.07 |
| calme · wickThr | 0.01 | 0.02 | 0.25 |
| calme · atrTrailMult | 0.01 | 0.04 | -0.09 |
| agité · atrStopMult | -0.01 | -0.01 | 0.03 |
| calme · atrStopMult | 0.00 | 0.12 | -0.32 |
| calme · rangeWin | 0.00 | 0.09 | -0.08 |

## Cartes · Sharpe 2018–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 81 % · le préréglage bat 71 % des autres cases · anneau ±10 % : médiane 2.06, minimum 1.89.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.82 | 2.00 | 1.98 | 1.94 | 2.12 | 2.24 | 2.11 | 1.94 | 1.84 |
| 2.805 | 1.85 | 2.01 | 2.00 | 1.92 | 2.10 | 2.21 | 2.08 | 1.90 | 1.80 |
| 2.97 | 1.85 | 2.03 | 2.02 | 1.96 | 2.12 | 2.23 | 2.08 | 1.95 | 1.85 |
| 3.135 | 1.82 | 2.01 | 2.02 | 1.95 | 2.11 | 2.22 | 2.07 | 1.94 | 1.83 |
| 3.3 | 1.79 | 1.97 | 1.98 | 1.90 | [2.05] | 2.20 | 2.06 | 1.90 | 1.80 |
| 3.465 | 1.76 | 1.96 | 1.97 | 1.89 | 2.05 | 2.19 | 2.09 | 1.95 | 1.85 |
| 3.63 | 1.74 | 1.94 | 1.96 | 1.89 | 2.05 | 2.17 | 2.07 | 1.92 | 1.81 |
| 3.795 | 1.76 | 1.96 | 1.99 | 1.91 | 2.07 | 2.18 | 2.06 | 1.91 | 1.79 |
| 3.96 | 1.80 | 1.96 | 1.99 | 1.91 | 2.07 | 2.18 | 2.05 | 1.90 | 1.75 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 84 % · le préréglage bat 85 % des autres cases · anneau ±10 % : médiane 1.99, minimum 1.77.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.85 | 1.88 | 1.93 | 1.88 | 1.79 | 1.86 | 1.92 | 1.96 | 1.95 |
| 2.465 | 2.00 | 2.00 | 2.04 | 1.94 | 1.97 | 1.96 | 1.90 | 1.95 | 1.84 |
| 2.61 | 1.96 | 1.97 | 1.88 | 1.96 | 1.98 | 1.94 | 1.92 | 1.94 | 1.86 |
| 2.755 | 1.88 | 1.90 | 1.77 | 1.95 | 1.90 | 1.87 | 1.99 | 1.78 | 1.86 |
| 2.9 | 2.10 | 2.05 | 1.99 | 2.07 | [2.05] | 2.09 | 1.93 | 1.76 | 1.89 |
| 3.045 | 1.93 | 1.99 | 2.17 | 2.16 | 2.20 | 2.18 | 2.10 | 2.07 | 2.10 |
| 3.19 | 1.83 | 1.97 | 1.98 | 2.00 | 2.06 | 2.01 | 2.06 | 1.91 | 2.02 |
| 3.335 | 1.85 | 1.83 | 1.84 | 1.91 | 1.90 | 1.94 | 1.96 | 1.98 | 1.95 |
| 3.48 | 1.87 | 1.78 | 1.83 | 1.79 | 1.80 | 1.86 | 1.89 | 1.95 | 1.98 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 2.05, minimum 2.05.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 0.935 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 0.99 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.045 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.1 | 2.05 | 2.05 | 2.05 | 2.05 | [2.05] | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.155 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.21 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.265 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 1.32 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 2.05, minimum 2.05.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.72 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.88 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.04 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.2 | 2.05 | 2.05 | 2.05 | 2.05 | [2.05] | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.36 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.52 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.68 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 3.84 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 2.05, minimum 2.05.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.04 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.16 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.28 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.4 | 2.05 | 2.05 | 2.05 | 2.05 | [2.05] | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.52 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.64 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.76 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |
| 2.88 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 | 2.05 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 78 % · le préréglage bat 73 % des autres cases · anneau ±10 % : médiane 2.05, minimum 1.90.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.04 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.16 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.28 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.4 | 1.79 | 1.97 | 1.98 | 1.90 | [2.05] | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.52 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.64 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.76 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |
| 2.88 | 1.79 | 1.97 | 1.98 | 1.90 | 2.05 | 2.20 | 2.06 | 1.90 | 1.80 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local-ethusdt-calm.json`.
