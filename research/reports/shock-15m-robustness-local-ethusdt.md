# Robustesse locale du préréglage · Shock Engine 15 min

ETH/USDT Binance 15 min, 2018-09-01 → 2026-09-30, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --asset ethusdt --n 300 --n-ext 100 --seed 7` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Le préréglage a été choisi sur BTC, jamais sur cet actif** : ce test dit si, transposé tel quel, il tombe sur un plateau de ETH/USDT ou sur un pic isolé.

## En bref

- **±5 %** : Sharpe médian des voisins 1.56 (préréglage 1.55, P10–P90 1.45–1.67) ; le préréglage fait mieux que 44 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 1.57 (préréglage 1.55, P10–P90 1.39–1.72) ; le préréglage fait mieux que 45 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.51 (préréglage 1.55, P10–P90 1.31–1.69) ; le préréglage fait mieux que 59 % des voisins ; 96 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 100 % battent l'achat conservé.

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
| agité · kMain | seulement à 1.92 (Sharpe 1.57) | le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s'il passe sous 2,0 |
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
| Rendement | 7352 % | 5228 % | 6109 % | 7529 % | 8966 % | 10922 % | 47 % |
| CAGR | 70.5 % | 63.5 % | 66.7 % | 71.0 % | 74.7 % | 78.9 % | 47 % |
| Sharpe | 1.55 | 1.45 | 1.50 | 1.56 | 1.61 | 1.67 | 44 % |
| Sortino | 2.27 | 2.13 | 2.21 | 2.30 | 2.37 | 2.46 | 43 % |
| Profit factor | 1.51 | 1.42 | 1.45 | 1.52 | 1.58 | 1.61 | 47 % |
| Max DD | -33.1 % | -42.1 % | -40.0 % | -37.6 % | -34.7 % | -32.3 % | 87 % |
| Trades | 918 | 883 | 898 | 915 | 934 | 945 | 54 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7352 % | 4039 % | 5347 % | 7524 % | 10538 % | 13006 % | 48 % |
| CAGR | 70.5 % | 58.5 % | 64.0 % | 71.0 % | 78.1 % | 82.8 % | 48 % |
| Sharpe | 1.55 | 1.39 | 1.47 | 1.57 | 1.66 | 1.72 | 45 % |
| Sortino | 2.27 | 2.05 | 2.18 | 2.32 | 2.44 | 2.54 | 44 % |
| Profit factor | 1.51 | 1.39 | 1.43 | 1.53 | 1.60 | 1.65 | 45 % |
| Max DD | -33.1 % | -41.8 % | -40.1 % | -36.1 % | -33.2 % | -30.5 % | 76 % |
| Trades | 918 | 848 | 872 | 909 | 939 | 974 | 58 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7352 % | 2830 % | 4022 % | 5822 % | 8599 % | 11429 % | 65 % |
| CAGR | 70.5 % | 51.9 % | 58.4 % | 65.7 % | 73.8 % | 79.9 % | 65 % |
| Sharpe | 1.55 | 1.31 | 1.40 | 1.51 | 1.61 | 1.69 | 59 % |
| Sortino | 2.27 | 1.93 | 2.07 | 2.22 | 2.37 | 2.50 | 59 % |
| Profit factor | 1.51 | 1.37 | 1.42 | 1.50 | 1.60 | 1.68 | 51 % |
| Max DD | -33.1 % | -42.5 % | -38.8 % | -35.4 % | -32.7 % | -30.3 % | 72 % |
| Trades | 918 | 786 | 837 | 914 | 982 | 1036 | 53 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (854 %, Max DD -81.5 %) : 100 % · Sharpe ≥ 80 % de celui du préréglage : 96 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 1.55 | 1.44 · 1.55 · 1.69 | 62.4 % · 70.3 % · 80.6 % | -42.8 % · -37.1 % · -32.8 % | 100 % | 46 % |
| ±10 % | 100 | 1.55 | 1.40 · 1.55 · 1.68 | 59.2 % · 70.6 % · 79.3 % | -40.5 % · -34.8 % · -29.5 % | 100 % | 47 % |
| ±20 % | 100 | 1.55 | 1.32 · 1.49 · 1.68 | 53.6 % · 64.9 % · 78.4 % | -44.9 % · -36.0 % · -31.9 % | 100 % | 60 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2018–2020 | ±5 % | 1.74 | 1.66 · 1.75 · 1.83 · 1.93 · 2.02 | 375.7 % | 432.2 % (339.9 % – 545.8 %) | 161.7 % | 100 % | 100 % | 24 % |
| 2018–2020 | ±10 % | 1.74 | 1.51 · 1.66 · 1.82 · 1.97 · 2.05 | 375.7 % | 420.3 % (267.9 % – 565.3 %) | 161.7 % | 100 % | 100 % | 35 % |
| 2018–2020 | ±20 % | 1.74 | 1.35 · 1.50 · 1.69 · 1.86 · 2.00 | 375.7 % | 354.2 % (211.5 % – 543.4 %) | 161.7 % | 100 % | 98 % | 58 % |
| 2021–2022 | ±5 % | 1.65 | 1.29 · 1.44 · 1.58 · 1.72 · 1.84 | 281.1 % | 250.1 % (165.5 % – 338.8 %) | 62.4 % | 100 % | 100 % | 66 % |
| 2021–2022 | ±10 % | 1.65 | 1.33 · 1.48 · 1.63 · 1.83 · 1.97 | 281.1 % | 263.9 % (172.8 % – 398.0 %) | 62.4 % | 100 % | 100 % | 53 % |
| 2021–2022 | ±20 % | 1.65 | 1.18 · 1.38 · 1.61 · 1.76 · 1.89 | 281.1 % | 236.6 % (127.8 % – 353.7 %) | 62.4 % | 100 % | 100 % | 60 % |
| 2023–2024 | ±5 % | 0.93 | 0.41 · 0.53 · 0.72 · 0.92 · 1.09 | 53.6 % | 36.3 % (15.9 % – 67.6 %) | 179.0 % | 100 % | 0 % | 76 % |
| 2023–2024 | ±10 % | 0.93 | 0.17 · 0.38 · 0.66 · 0.95 · 1.12 | 53.6 % | 32.5 % (2.0 % – 70.6 %) | 179.0 % | 93 % | 0 % | 73 % |
| 2023–2024 | ±20 % | 0.93 | 0.11 · 0.35 · 0.62 · 0.88 · 1.05 | 53.6 % | 29.0 % (-0.7 % – 65.0 %) | 179.0 % | 89 % | 0 % | 80 % |
| 2025–2026 | ±5 % | 1.76 | 1.55 · 1.73 · 1.93 · 2.16 · 2.25 | 167.6 % | 198.2 % (132.4 % – 270.2 %) | -19.5 % | 100 % | 100 % | 28 % |
| 2025–2026 | ±10 % | 1.76 | 1.50 · 1.77 · 2.01 · 2.20 · 2.31 | 167.6 % | 209.2 % (123.1 % – 284.2 %) | -19.5 % | 100 % | 100 % | 24 % |
| 2025–2026 | ±20 % | 1.76 | 1.65 · 1.83 · 2.05 · 2.24 · 2.37 | 167.6 % | 212.1 % (141.1 % – 285.3 %) | -19.5 % | 100 % | 100 % | 20 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2018–2026 | -33.1 % | -36.1 % (-41.8 %) | 1.51 | 1.53 (1.39) | 918 | 909 |
| 2018–2020 | -30.6 % | -33.1 % (-40.3 %) | 1.46 | 1.53 (1.42) | 254 | 250 |
| 2021–2022 | -24.3 % | -24.5 % (-29.2 %) | 1.61 | 1.62 (1.45) | 228 | 225 |
| 2023–2024 | -31.5 % | -30.8 % (-37.6 %) | 1.32 | 1.19 (1.01) | 244 | 242 |
| 2025–2026 | -27.5 % | -27.9 % (-30.7 %) | 1.56 | 1.62 (1.42) | 192 | 190 |

## Un réglage à la fois · Sharpe 2018–2026

Les autres réglages restent ceux du préréglage (Sharpe 1.55).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 1.54 (104) | 1.45 (117) | 1.54 (124) | 1.66 (137) | 1.47 (143) | 1.46 (156) | -0.09 |
| calme · kMain | 1.34 (2.32) | 1.48 (2.61) | 1.47 (2.755) | 1.62 (3.045) | 1.60 (3.19) | 1.38 (3.48) | -0.20 |
| calme · rangeWin | 1.57 (12) | 1.55 (14) | 1.55 (14) | 1.62 (16) | 1.64 (17) | 1.63 (18) | 0.01 |
| calme · wickThr | 1.57 (0.32) | 1.58 (0.36) | 1.55 (0.38) | 1.52 (0.42) | 1.52 (0.44) | 1.52 (0.48) | -0.03 |
| calme · htfEmaLen | 1.47 (56) | 1.49 (63) | 1.47 (67) | 1.41 (74) | 1.40 (77) | 1.52 (84) | -0.14 |
| calme · volZWin | 1.61 (60) | 1.60 (68) | 1.58 (71) | 1.58 (79) | 1.58 (83) | 1.58 (90) | 0.03 |
| calme · volZThr | 1.60 (1.04) | 1.59 (1.17) | 1.59 (1.235) | 1.55 (1.365) | 1.55 (1.43) | 1.52 (1.56) | -0.02 |
| calme · atrLen | 1.57 (24) | 1.54 (27) | 1.54 (29) | 1.56 (32) | 1.56 (33) | 1.57 (36) | -0.01 |
| calme · atrStopMult | 1.61 (2.64) | 1.60 (2.97) | 1.59 (3.135) | 1.54 (3.465) | 1.55 (3.63) | 1.57 (3.96) | -0.01 |
| calme · atrTrailMult | 1.57 (40) | 1.55 (45) | 1.53 (47.5) | 1.54 (52.5) | 1.55 (55) | 1.55 (60) | -0.02 |
| agité · volWin | 1.56 (120) | 1.57 (135) | 1.57 (143) | 1.56 (158) | 1.57 (165) | 1.57 (180) | 0.01 |
| agité · kMain | 1.57 (1.92) | 1.55 (2.16) | 1.55 (2.28) | 1.55 (2.52) | 1.55 (2.64) | 1.55 (2.88) | 0.00 |
| agité · kMicro | 1.55 (1.76) | 1.51 (1.98) | 1.55 (2.09) | 1.58 (2.31) | 1.59 (2.42) | 1.61 (2.64) | -0.03 |
| agité · rangeWin | 1.57 (40) | 1.57 (45) | 1.54 (48) | 1.55 (53) | 1.55 (55) | 1.55 (60) | -0.00 |
| agité · wickThr | 1.55 (0.36) | 1.55 (0.405) | 1.55 (0.4275) | 1.55 (0.4725) | 1.55 (0.495) | 1.55 (0.54) | aucun effet |
| agité · htfEmaLen | 1.52 (52) | 1.54 (59) | 1.52 (62) | 1.58 (68) | 1.54 (72) | 1.56 (78) | -0.03 |
| agité · volZWin | 1.55 (20) | 1.55 (23) | 1.55 (24) | 1.55 (26) | 1.55 (28) | 1.55 (30) | 0.00 |
| agité · volZThr | 1.55 (-0.7) | 1.55 (-0.6) | 1.55 (-0.55) | 1.55 (-0.45) | 1.55 (-0.4) | 1.55 (-0.3) | aucun effet |
| agité · atrLen | 1.54 (18) | 1.54 (20) | 1.54 (21) | 1.55 (23) | 1.55 (24) | 1.54 (26) | -0.01 |
| agité · atrStopMult | 1.54 (0.88) | 1.54 (0.99) | 1.56 (1.045) | 1.54 (1.155) | 1.55 (1.21) | 1.55 (1.32) | -0.01 |
| agité · atrTrailMult | 1.60 (2.56) | 1.57 (2.88) | 1.55 (3.04) | 1.55 (3.36) | 1.54 (3.52) | 1.51 (3.84) | -0.04 |
| agité · tp1AtrMult | 1.54 (0.72) | 1.54 (0.81) | 1.54 (0.855) | 1.55 (0.945) | 1.55 (0.99) | 1.55 (1.08) | -0.00 |
| agité · tp1QtyPct | 1.54 (16) | 1.54 (18) | 1.54 (19) | 1.55 (21) | 1.55 (22) | 1.55 (24) | -0.01 |
| calme · lamEmaWin | 1.53 (120) | 1.54 (135) | 1.54 (143) | 1.51 (158) | 1.51 (165) | 1.52 (180) | -0.04 |
| calme · lamNormWin | 1.52 (240) | 1.56 (270) | 1.57 (285) | 1.51 (315) | 1.49 (330) | 1.50 (360) | -0.05 |
| calme · longLamPct | 1.51 (44) | 1.53 (49.5) | 1.54 (52.25) | 1.54 (57.75) | 1.54 (60.5) | 1.49 (66) | -0.05 |
| calme · htfSlopeBars | 1.57 (2) | 1.55 (3) | 1.55 (3) | 1.55 (3) | 1.55 (3) | 1.42 (4) | -0.13 |
| agité · lamEmaWin | 1.55 (120) | 1.58 (135) | 1.56 (143) | 1.54 (158) | 1.54 (165) | 1.53 (180) | -0.02 |
| agité · lamNormWin | 1.52 (240) | 1.53 (270) | 1.56 (285) | 1.55 (315) | 1.55 (330) | 1.51 (360) | -0.03 |
| agité · longLamPct | 1.52 (44) | 1.53 (49.5) | 1.57 (52.25) | 1.55 (57.75) | 1.54 (60.5) | 1.55 (66) | -0.03 |
| agité · htfSlopeBars | 1.54 (2) | 1.55 (3) | 1.55 (3) | 1.55 (3) | 1.55 (3) | 1.54 (4) | -0.00 |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| calme · kMain | 0.51 | 0.55 | 0.18 |
| agité · kMicro | 0.30 | 0.27 | -0.03 |
| agité · atrTrailMult | -0.24 | -0.20 | -0.26 |
| calme · volZThr | -0.13 | -0.14 | -0.11 |
| calme · rangeWin | 0.12 | 0.15 | -0.02 |
| calme · volWin | 0.08 | 0.04 | 0.02 |
| agité · atrLen | -0.08 | -0.09 | -0.08 |
| agité · htfEmaLen | 0.08 | 0.06 | -0.05 |
| calme · wickThr | -0.06 | -0.02 | -0.02 |
| calme · volZWin | -0.06 | -0.04 | 0.04 |
| calme · atrStopMult | -0.05 | 0.07 | -0.18 |
| agité · volZThr | -0.05 | -0.06 | 0.01 |
| agité · tp1AtrMult | -0.04 | -0.05 | 0.03 |
| agité · kMain | -0.03 | -0.04 | -0.08 |
| calme · atrLen | -0.03 | -0.06 | 0.02 |
| agité · rangeWin | 0.02 | 0.03 | 0.05 |
| calme · htfEmaLen | -0.02 | -0.05 | 0.36 |
| agité · volWin | 0.02 | 0.04 | -0.04 |
| calme · atrTrailMult | -0.02 | -0.00 | -0.03 |
| agité · tp1QtyPct | 0.01 | 0.00 | 0.08 |
| agité · wickThr | -0.01 | -0.02 | 0.04 |
| agité · atrStopMult | -0.00 | 0.01 | 0.00 |
| agité · volZWin | 0.00 | -0.00 | 0.04 |

## Cartes · Sharpe 2018–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 84 % · le préréglage bat 69 % des autres cases · anneau ±10 % : médiane 1.57, minimum 1.45.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.38 | 1.50 | 1.48 | 1.53 | 1.61 | 1.66 | 1.56 | 1.41 | 1.30 |
| 2.805 | 1.40 | 1.51 | 1.50 | 1.50 | 1.58 | 1.64 | 1.61 | 1.46 | 1.35 |
| 2.97 | 1.41 | 1.52 | 1.51 | 1.53 | 1.60 | 1.66 | 1.62 | 1.52 | 1.42 |
| 3.135 | 1.39 | 1.51 | 1.52 | 1.52 | 1.59 | 1.65 | 1.61 | 1.51 | 1.41 |
| 3.3 | 1.34 | 1.48 | 1.48 | 1.47 | [1.55] | 1.62 | 1.60 | 1.47 | 1.38 |
| 3.465 | 1.30 | 1.47 | 1.47 | 1.46 | 1.54 | 1.62 | 1.61 | 1.50 | 1.42 |
| 3.63 | 1.27 | 1.44 | 1.45 | 1.47 | 1.55 | 1.61 | 1.61 | 1.47 | 1.37 |
| 3.795 | 1.25 | 1.43 | 1.45 | 1.48 | 1.56 | 1.61 | 1.59 | 1.46 | 1.36 |
| 3.96 | 1.27 | 1.42 | 1.46 | 1.47 | 1.57 | 1.62 | 1.60 | 1.47 | 1.33 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 81 % · le préréglage bat 80 % des autres cases · anneau ±10 % : médiane 1.51, minimum 1.28.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.34 | 1.41 | 1.45 | 1.43 | 1.34 | 1.37 | 1.44 | 1.50 | 1.49 |
| 2.465 | 1.43 | 1.48 | 1.55 | 1.45 | 1.48 | 1.51 | 1.36 | 1.38 | 1.35 |
| 2.61 | 1.50 | 1.52 | 1.40 | 1.47 | 1.48 | 1.50 | 1.42 | 1.39 | 1.31 |
| 2.755 | 1.34 | 1.38 | 1.28 | 1.50 | 1.47 | 1.48 | 1.51 | 1.31 | 1.39 |
| 2.9 | 1.54 | 1.48 | 1.45 | 1.54 | [1.55] | 1.66 | 1.47 | 1.38 | 1.46 |
| 3.045 | 1.48 | 1.50 | 1.66 | 1.66 | 1.62 | 1.65 | 1.56 | 1.58 | 1.61 |
| 3.19 | 1.40 | 1.48 | 1.51 | 1.62 | 1.60 | 1.58 | 1.56 | 1.45 | 1.51 |
| 3.335 | 1.44 | 1.38 | 1.46 | 1.48 | 1.47 | 1.53 | 1.56 | 1.57 | 1.53 |
| 3.48 | 1.50 | 1.39 | 1.44 | 1.43 | 1.38 | 1.48 | 1.50 | 1.53 | 1.61 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 44 % des autres cases · anneau ±10 % : médiane 1.55, minimum 1.54.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 1.56 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 |
| 0.935 | 1.58 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 |
| 0.99 | 1.57 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 |
| 1.045 | 1.58 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 |
| 1.1 | 1.57 | 1.55 | 1.55 | 1.55 | [1.55] | 1.55 | 1.55 | 1.55 | 1.55 |
| 1.155 | 1.57 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 |
| 1.21 | 1.56 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 |
| 1.265 | 1.56 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 | 1.54 |
| 1.32 | 1.56 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 48 % des autres cases · anneau ±10 % : médiane 1.55, minimum 1.54.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 1.58 | 1.59 | 1.59 | 1.61 | 1.60 | 1.59 | 1.59 | 1.58 | 1.58 |
| 2.72 | 1.58 | 1.59 | 1.59 | 1.61 | 1.60 | 1.59 | 1.59 | 1.58 | 1.58 |
| 2.88 | 1.56 | 1.57 | 1.56 | 1.58 | 1.57 | 1.56 | 1.57 | 1.57 | 1.57 |
| 3.04 | 1.54 | 1.55 | 1.54 | 1.56 | 1.55 | 1.54 | 1.55 | 1.55 | 1.55 |
| 3.2 | 1.54 | 1.55 | 1.54 | 1.56 | [1.55] | 1.54 | 1.55 | 1.54 | 1.55 |
| 3.36 | 1.54 | 1.55 | 1.54 | 1.56 | 1.55 | 1.54 | 1.55 | 1.54 | 1.54 |
| 3.52 | 1.54 | 1.55 | 1.54 | 1.55 | 1.54 | 1.54 | 1.54 | 1.53 | 1.54 |
| 3.68 | 1.52 | 1.53 | 1.52 | 1.54 | 1.53 | 1.52 | 1.52 | 1.51 | 1.52 |
| 3.84 | 1.50 | 1.51 | 1.50 | 1.52 | 1.51 | 1.50 | 1.50 | 1.49 | 1.50 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 11 % des autres cases · anneau ±10 % : médiane 1.57, minimum 1.55.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.56 | 1.56 | 1.54 | 1.52 | 1.57 | 1.52 | 1.52 | 1.54 | 1.55 |
| 2.04 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.16 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.28 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.4 | 1.56 | 1.57 | 1.57 | 1.57 | [1.55] | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.52 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.64 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.76 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |
| 2.88 | 1.56 | 1.57 | 1.57 | 1.57 | 1.55 | 1.56 | 1.57 | 1.57 | 1.57 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 79 % · le préréglage bat 72 % des autres cases · anneau ±10 % : médiane 1.55, minimum 1.47.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.36 | 1.51 | 1.50 | 1.50 | 1.57 | 1.65 | 1.62 | 1.49 | 1.40 |
| 2.04 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.16 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.28 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.4 | 1.34 | 1.48 | 1.48 | 1.47 | [1.55] | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.52 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.64 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.76 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |
| 2.88 | 1.34 | 1.48 | 1.48 | 1.47 | 1.55 | 1.62 | 1.60 | 1.47 | 1.38 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local-ethusdt.json`.
