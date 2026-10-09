# Robustesse locale du préréglage · Shock Engine 15 min · shorts en régime de tendance baissier (E2)

ETH/USDT Binance 15 min, 2018-09-01 → 2026-09-30, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --asset ethusdt --n 300 --n-ext 100 --seed 7` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Le préréglage a été choisi sur BTC, jamais sur cet actif** : ce test dit si, transposé tel quel, il tombe sur un plateau de ETH/USDT ou sur un pic isolé.

## En bref

- **±5 %** : Sharpe médian des voisins 1.85 (préréglage 1.84, P10–P90 1.70–2.01) ; le préréglage fait mieux que 47 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 1.86 (préréglage 1.84, P10–P90 1.62–2.02) ; le préréglage fait mieux que 45 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.77 (préréglage 1.84, P10–P90 1.55–1.97) ; le préréglage fait mieux que 68 % des voisins ; 96 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.

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
| agité · kMain | seulement à 1.92 (Sharpe 1.87) | le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s'il passe sous 2,0 |
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
| Rendement | 7986 % | 5270 % | 6533 % | 7935 % | 9808 % | 12478 % | 51 % |
| CAGR | 72.2 % | 63.7 % | 68.0 % | 72.1 % | 76.6 % | 81.9 % | 51 % |
| Sharpe | 1.84 | 1.70 | 1.78 | 1.85 | 1.92 | 2.01 | 47 % |
| Sortino | 2.71 | 2.51 | 2.62 | 2.72 | 2.83 | 2.96 | 47 % |
| Profit factor | 2.02 | 1.76 | 1.87 | 2.03 | 2.14 | 2.22 | 49 % |
| Max DD | -29.5 % | -39.7 % | -37.0 % | -33.0 % | -31.1 % | -29.7 % | 92 % |
| Trades | 667 | 644 | 654 | 664 | 674 | 683 | 57 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7986 % | 3802 % | 5330 % | 8183 % | 10993 % | 13414 % | 48 % |
| CAGR | 72.2 % | 57.4 % | 63.9 % | 72.7 % | 79.1 % | 83.5 % | 48 % |
| Sharpe | 1.84 | 1.62 | 1.73 | 1.86 | 1.96 | 2.02 | 45 % |
| Sortino | 2.71 | 2.39 | 2.55 | 2.75 | 2.89 | 2.98 | 45 % |
| Profit factor | 2.02 | 1.68 | 1.78 | 2.03 | 2.16 | 2.26 | 48 % |
| Max DD | -29.5 % | -38.3 % | -34.9 % | -32.2 % | -30.3 % | -28.5 % | 85 % |
| Trades | 667 | 626 | 637 | 657 | 674 | 689 | 68 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7986 % | 3121 % | 3866 % | 5719 % | 8303 % | 10692 % | 72 % |
| CAGR | 72.2 % | 53.7 % | 57.7 % | 65.3 % | 73.0 % | 78.5 % | 72 % |
| Sharpe | 1.84 | 1.55 | 1.64 | 1.77 | 1.88 | 1.97 | 68 % |
| Sortino | 2.71 | 2.27 | 2.42 | 2.60 | 2.76 | 2.90 | 68 % |
| Profit factor | 2.02 | 1.65 | 1.73 | 1.94 | 2.11 | 2.22 | 62 % |
| Max DD | -29.5 % | -36.8 % | -34.2 % | -31.2 % | -28.1 % | -25.8 % | 62 % |
| Trades | 667 | 592 | 622 | 658 | 693 | 718 | 58 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 96 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 1.84 | 1.70 · 1.85 · 2.01 | 62.9 % · 71.5 % · 83.7 % | -39.2 % · -33.2 % · -30.1 % | 100 % | 49 % |
| ±10 % | 100 | 1.84 | 1.61 · 1.83 · 1.98 | 57.3 % · 69.5 % · 80.2 % | -37.4 % · -32.0 % · -28.3 % | 100 % | 51 % |
| ±20 % | 100 | 1.84 | 1.53 · 1.78 · 1.95 | 51.6 % · 66.5 % · 78.7 % | -36.6 % · -31.4 % · -27.6 % | 100 % | 62 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2018–2020 | ±5 % | 1.89 | 1.81 · 1.90 · 2.00 · 2.09 · 2.18 | 368.1 % | 422.3 % (335.4 % – 524.5 %) | 161.7 % | 100 % | 100 % | 22 % |
| 2018–2020 | ±10 % | 1.89 | 1.74 · 1.87 · 1.99 · 2.10 · 2.19 | 368.1 % | 416.1 % (293.2 % – 527.7 %) | 161.7 % | 100 % | 100 % | 28 % |
| 2018–2020 | ±20 % | 1.89 | 1.62 · 1.77 · 1.92 · 2.05 · 2.17 | 368.1 % | 375.4 % (260.3 % – 506.0 %) | 161.7 % | 100 % | 100 % | 44 % |
| 2021–2022 | ±5 % | 1.73 | 1.42 · 1.55 · 1.70 · 1.81 · 1.95 | 191.7 % | 180.7 % (129.5 % – 226.3 %) | 62.4 % | 100 % | 100 % | 59 % |
| 2021–2022 | ±10 % | 1.73 | 1.42 · 1.59 · 1.75 · 1.93 · 2.09 | 191.7 % | 191.1 % (125.7 % – 262.6 %) | 62.4 % | 100 % | 100 % | 43 % |
| 2021–2022 | ±20 % | 1.73 | 1.17 · 1.38 · 1.60 · 1.81 · 1.99 | 191.7 % | 143.2 % (84.3 % – 234.7 %) | 62.4 % | 100 % | 96 % | 68 % |
| 2023–2024 | ±5 % | 1.56 | 0.85 · 1.03 · 1.25 · 1.61 · 1.77 | 89.6 % | 63.5 % (35.8 % – 110.2 %) | 179.0 % | 100 % | 0 % | 68 % |
| 2023–2024 | ±10 % | 1.56 | 0.60 · 0.83 · 1.20 · 1.58 · 1.73 | 89.6 % | 58.4 % (22.9 % – 108.1 %) | 179.0 % | 100 % | 0 % | 72 % |
| 2023–2024 | ±20 % | 1.56 | 0.60 · 0.86 · 1.15 · 1.38 · 1.65 | 89.6 % | 55.6 % (22.2 % – 96.6 %) | 179.0 % | 100 % | 0 % | 87 % |
| 2025–2026 | ±5 % | 2.34 | 1.98 · 2.24 · 2.48 · 2.70 · 2.80 | 212.4 % | 238.4 % (154.9 % – 311.7 %) | -19.5 % | 100 % | 100 % | 37 % |
| 2025–2026 | ±10 % | 2.34 | 1.89 · 2.22 · 2.50 · 2.72 · 2.83 | 212.4 % | 242.2 % (140.2 % – 322.3 %) | -19.5 % | 100 % | 100 % | 36 % |
| 2025–2026 | ±20 % | 2.34 | 1.99 · 2.19 · 2.47 · 2.70 · 2.87 | 212.4 % | 223.6 % (148.3 % – 315.3 %) | -19.5 % | 100 % | 100 % | 37 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2018–2026 | -29.5 % | -32.2 % (-38.3 %) | 2.02 | 2.03 (1.68) | 667 | 657 |
| 2018–2020 | -29.5 % | -32.2 % (-38.3 %) | 1.68 | 1.81 (1.69) | 207 | 201 |
| 2021–2022 | -22.8 % | -21.5 % (-25.3 %) | 1.68 | 1.75 (1.53) | 170 | 167 |
| 2023–2024 | -14.3 % | -17.5 % (-22.4 %) | 1.76 | 1.51 (1.20) | 161 | 161 |
| 2025–2026 | -18.3 % | -18.8 % (-20.7 %) | 2.26 | 2.30 (1.85) | 129 | 128 |

## Un réglage à la fois · Sharpe 2018–2026

Les autres réglages restent ceux du préréglage (Sharpe 1.84).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 1.90 (104) | 1.79 (117) | 1.87 (124) | 1.89 (137) | 1.73 (143) | 1.67 (156) | -0.17 |
| calme · kMain | 1.54 (2.32) | 1.74 (2.61) | 1.68 (2.755) | 1.99 (3.045) | 1.86 (3.19) | 1.61 (3.48) | -0.30 |
| calme · rangeWin | 1.88 (12) | 1.85 (14) | 1.85 (14) | 1.91 (16) | 1.89 (17) | 1.91 (18) | 0.01 |
| calme · wickThr | 1.84 (0.32) | 1.87 (0.36) | 1.85 (0.38) | 1.83 (0.42) | 1.85 (0.44) | 1.88 (0.48) | -0.01 |
| calme · htfEmaLen | 1.77 (56) | 1.81 (63) | 1.79 (67) | 1.67 (74) | 1.66 (77) | 1.79 (84) | -0.18 |
| calme · volZWin | 1.87 (60) | 1.88 (68) | 1.87 (71) | 1.87 (79) | 1.87 (83) | 1.87 (90) | 0.03 |
| calme · volZThr | 1.90 (1.04) | 1.88 (1.17) | 1.89 (1.235) | 1.85 (1.365) | 1.84 (1.43) | 1.78 (1.56) | -0.06 |
| calme · atrLen | 1.87 (24) | 1.83 (27) | 1.84 (29) | 1.85 (32) | 1.85 (33) | 1.87 (36) | -0.01 |
| calme · atrStopMult | 1.90 (2.64) | 1.90 (2.97) | 1.89 (3.135) | 1.85 (3.465) | 1.84 (3.63) | 1.87 (3.96) | -0.00 |
| calme · atrTrailMult | 1.85 (40) | 1.83 (45) | 1.82 (47.5) | 1.84 (52.5) | 1.84 (55) | 1.84 (60) | -0.02 |
| agité · volWin | 1.86 (120) | 1.87 (135) | 1.87 (143) | 1.86 (158) | 1.87 (165) | 1.87 (180) | 0.02 |
| agité · kMain | 1.87 (1.92) | 1.84 (2.16) | 1.84 (2.28) | 1.84 (2.52) | 1.84 (2.64) | 1.84 (2.88) | 0.00 |
| agité · kMicro | 1.86 (1.76) | 1.81 (1.98) | 1.85 (2.09) | 1.88 (2.31) | 1.90 (2.42) | 1.93 (2.64) | -0.03 |
| agité · rangeWin | 1.85 (40) | 1.85 (45) | 1.84 (48) | 1.85 (53) | 1.85 (55) | 1.85 (60) | -0.00 |
| agité · wickThr | 1.84 (0.36) | 1.84 (0.405) | 1.84 (0.4275) | 1.84 (0.4725) | 1.84 (0.495) | 1.84 (0.54) | aucun effet |
| agité · htfEmaLen | 1.82 (52) | 1.84 (59) | 1.81 (62) | 1.90 (68) | 1.85 (72) | 1.87 (78) | -0.03 |
| agité · volZWin | 1.85 (20) | 1.84 (23) | 1.84 (24) | 1.84 (26) | 1.84 (28) | 1.85 (30) | 0.00 |
| agité · volZThr | 1.84 (-0.7) | 1.84 (-0.6) | 1.84 (-0.55) | 1.84 (-0.45) | 1.84 (-0.4) | 1.84 (-0.3) | aucun effet |
| agité · atrLen | 1.83 (18) | 1.84 (20) | 1.84 (21) | 1.84 (23) | 1.85 (24) | 1.83 (26) | -0.01 |
| agité · atrStopMult | 1.84 (0.88) | 1.83 (0.99) | 1.86 (1.045) | 1.84 (1.155) | 1.84 (1.21) | 1.84 (1.32) | -0.01 |
| agité · atrTrailMult | 1.91 (2.56) | 1.88 (2.88) | 1.85 (3.04) | 1.84 (3.36) | 1.83 (3.52) | 1.79 (3.84) | -0.05 |
| agité · tp1AtrMult | 1.84 (0.72) | 1.84 (0.81) | 1.84 (0.855) | 1.84 (0.945) | 1.84 (0.99) | 1.85 (1.08) | -0.00 |
| agité · tp1QtyPct | 1.83 (16) | 1.84 (18) | 1.84 (19) | 1.84 (21) | 1.85 (22) | 1.85 (24) | -0.01 |
| calme · lamEmaWin | 1.82 (120) | 1.84 (135) | 1.84 (143) | 1.80 (158) | 1.80 (165) | 1.81 (180) | -0.04 |
| calme · lamNormWin | 1.81 (240) | 1.85 (270) | 1.87 (285) | 1.80 (315) | 1.78 (330) | 1.79 (360) | -0.06 |
| calme · longLamPct | 1.80 (44) | 1.82 (49.5) | 1.84 (52.25) | 1.83 (57.75) | 1.84 (60.5) | 1.79 (66) | -0.05 |
| calme · htfSlopeBars | 1.86 (2) | 1.84 (3) | 1.84 (3) | 1.84 (3) | 1.84 (3) | 1.68 (4) | -0.16 |
| agité · lamEmaWin | 1.85 (120) | 1.88 (135) | 1.86 (143) | 1.84 (158) | 1.85 (165) | 1.83 (180) | -0.01 |
| agité · lamNormWin | 1.81 (240) | 1.82 (270) | 1.85 (285) | 1.86 (315) | 1.86 (330) | 1.81 (360) | -0.03 |
| agité · longLamPct | 1.81 (44) | 1.83 (49.5) | 1.87 (52.25) | 1.85 (57.75) | 1.85 (60.5) | 1.86 (66) | -0.03 |
| agité · htfSlopeBars | 1.84 (2) | 1.84 (3) | 1.84 (3) | 1.84 (3) | 1.84 (3) | 1.84 (4) | -0.01 |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| calme · kMain | 0.39 | 0.53 | -0.38 |
| agité · kMicro | 0.34 | 0.28 | -0.11 |
| agité · atrTrailMult | -0.26 | -0.20 | -0.19 |
| calme · htfEmaLen | -0.13 | -0.13 | 0.15 |
| calme · volZThr | -0.10 | -0.14 | -0.09 |
| agité · atrLen | -0.09 | -0.10 | 0.04 |
| calme · rangeWin | 0.08 | 0.13 | -0.06 |
| agité · htfEmaLen | 0.06 | 0.05 | 0.02 |
| agité · rangeWin | 0.05 | 0.06 | -0.05 |
| agité · volZThr | -0.05 | -0.07 | -0.05 |
| agité · tp1QtyPct | 0.04 | 0.02 | 0.03 |
| calme · atrLen | -0.04 | -0.07 | 0.07 |
| agité · tp1AtrMult | -0.03 | -0.05 | 0.10 |
| calme · volZWin | 0.03 | 0.03 | 0.19 |
| calme · volWin | -0.02 | -0.05 | -0.08 |
| agité · kMain | 0.02 | -0.00 | -0.06 |
| agité · volZWin | 0.02 | -0.00 | 0.05 |
| agité · volWin | 0.02 | 0.04 | -0.06 |
| calme · atrTrailMult | 0.01 | 0.03 | -0.08 |
| agité · wickThr | 0.01 | -0.01 | 0.01 |
| calme · wickThr | 0.01 | 0.02 | 0.19 |
| calme · atrStopMult | 0.00 | 0.09 | -0.25 |
| agité · atrStopMult | -0.00 | 0.01 | 0.01 |

## Cartes · Sharpe 2018–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 79 % · le préréglage bat 69 % des autres cases · anneau ±10 % : médiane 1.85, minimum 1.68.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.56 | 1.74 | 1.73 | 1.72 | 1.90 | 2.03 | 1.89 | 1.73 | 1.64 |
| 2.805 | 1.59 | 1.75 | 1.75 | 1.70 | 1.88 | 2.00 | 1.87 | 1.70 | 1.60 |
| 2.97 | 1.60 | 1.77 | 1.77 | 1.74 | 1.90 | 2.02 | 1.87 | 1.75 | 1.66 |
| 3.135 | 1.57 | 1.76 | 1.78 | 1.73 | 1.89 | 2.01 | 1.87 | 1.74 | 1.64 |
| 3.3 | 1.54 | 1.72 | 1.74 | 1.68 | [1.84] | 1.99 | 1.86 | 1.70 | 1.61 |
| 3.465 | 1.52 | 1.71 | 1.73 | 1.68 | 1.85 | 1.99 | 1.89 | 1.76 | 1.67 |
| 3.63 | 1.50 | 1.70 | 1.73 | 1.68 | 1.84 | 1.97 | 1.87 | 1.74 | 1.63 |
| 3.795 | 1.52 | 1.72 | 1.75 | 1.70 | 1.86 | 1.98 | 1.87 | 1.72 | 1.61 |
| 3.96 | 1.56 | 1.72 | 1.76 | 1.70 | 1.87 | 1.98 | 1.86 | 1.72 | 1.57 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 74 % · le préréglage bat 84 % des autres cases · anneau ±10 % : médiane 1.78, minimum 1.56.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.61 | 1.64 | 1.69 | 1.64 | 1.54 | 1.62 | 1.67 | 1.71 | 1.70 |
| 2.465 | 1.73 | 1.76 | 1.78 | 1.69 | 1.72 | 1.72 | 1.65 | 1.71 | 1.60 |
| 2.61 | 1.74 | 1.75 | 1.64 | 1.73 | 1.74 | 1.71 | 1.68 | 1.70 | 1.61 |
| 2.755 | 1.67 | 1.70 | 1.56 | 1.74 | 1.68 | 1.65 | 1.77 | 1.54 | 1.62 |
| 2.9 | 1.90 | 1.85 | 1.79 | 1.87 | [1.84] | 1.89 | 1.73 | 1.53 | 1.67 |
| 3.045 | 1.75 | 1.79 | 1.97 | 1.95 | 1.99 | 1.98 | 1.89 | 1.86 | 1.89 |
| 3.19 | 1.64 | 1.77 | 1.78 | 1.80 | 1.86 | 1.81 | 1.85 | 1.72 | 1.81 |
| 3.335 | 1.66 | 1.64 | 1.65 | 1.71 | 1.70 | 1.74 | 1.76 | 1.78 | 1.75 |
| 3.48 | 1.69 | 1.60 | 1.64 | 1.60 | 1.61 | 1.67 | 1.70 | 1.76 | 1.79 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 54 % des autres cases · anneau ±10 % : médiane 1.84, minimum 1.83.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 1.87 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 |
| 0.935 | 1.88 | 1.85 | 1.85 | 1.85 | 1.85 | 1.85 | 1.85 | 1.85 | 1.85 |
| 0.99 | 1.87 | 1.83 | 1.83 | 1.83 | 1.83 | 1.83 | 1.83 | 1.83 | 1.83 |
| 1.045 | 1.89 | 1.86 | 1.86 | 1.86 | 1.86 | 1.86 | 1.86 | 1.86 | 1.86 |
| 1.1 | 1.87 | 1.84 | 1.84 | 1.84 | [1.84] | 1.84 | 1.84 | 1.84 | 1.84 |
| 1.155 | 1.87 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 |
| 1.21 | 1.86 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 |
| 1.265 | 1.86 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 |
| 1.32 | 1.86 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 | 1.84 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 48 % des autres cases · anneau ±10 % : médiane 1.84, minimum 1.83.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 1.89 | 1.90 | 1.90 | 1.92 | 1.91 | 1.90 | 1.90 | 1.89 | 1.89 |
| 2.72 | 1.89 | 1.90 | 1.90 | 1.92 | 1.91 | 1.90 | 1.90 | 1.89 | 1.89 |
| 2.88 | 1.86 | 1.87 | 1.86 | 1.89 | 1.88 | 1.87 | 1.87 | 1.87 | 1.87 |
| 3.04 | 1.84 | 1.85 | 1.84 | 1.87 | 1.85 | 1.84 | 1.85 | 1.84 | 1.85 |
| 3.2 | 1.84 | 1.85 | 1.83 | 1.86 | [1.84] | 1.84 | 1.84 | 1.84 | 1.84 |
| 3.36 | 1.84 | 1.85 | 1.84 | 1.86 | 1.84 | 1.84 | 1.84 | 1.83 | 1.84 |
| 3.52 | 1.84 | 1.84 | 1.83 | 1.85 | 1.83 | 1.83 | 1.83 | 1.82 | 1.82 |
| 3.68 | 1.81 | 1.82 | 1.82 | 1.83 | 1.82 | 1.81 | 1.81 | 1.80 | 1.80 |
| 3.84 | 1.79 | 1.79 | 1.79 | 1.81 | 1.79 | 1.79 | 1.78 | 1.77 | 1.78 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 9 % des autres cases · anneau ±10 % : médiane 1.87, minimum 1.84.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.86 | 1.86 | 1.83 | 1.81 | 1.87 | 1.81 | 1.81 | 1.85 | 1.85 |
| 2.04 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.16 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.28 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.4 | 1.86 | 1.86 | 1.87 | 1.87 | [1.84] | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.52 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.64 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.76 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |
| 2.88 | 1.86 | 1.86 | 1.87 | 1.87 | 1.84 | 1.86 | 1.87 | 1.87 | 1.87 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 78 % · le préréglage bat 72 % des autres cases · anneau ±10 % : médiane 1.84, minimum 1.68.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.57 | 1.76 | 1.77 | 1.71 | 1.87 | 2.02 | 1.88 | 1.72 | 1.63 |
| 2.04 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.16 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.28 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.4 | 1.54 | 1.72 | 1.74 | 1.68 | [1.84] | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.52 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.64 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.76 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |
| 2.88 | 1.54 | 1.72 | 1.74 | 1.68 | 1.84 | 1.99 | 1.86 | 1.70 | 1.61 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local-ethusdt-e2.json`.
