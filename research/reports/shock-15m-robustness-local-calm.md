# Robustesse locale du préréglage · Shock Engine 15 min · régime calme seul, shorts en régime de tendance baissier

BTC/USD Bitstamp 15 min, 2017-01-01 → 2026-10-04, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --n 300 --n-ext 100 --seed 7 --calm` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Limite à garder en tête** : le préréglage a été choisi sur tout 2017–2026. Ce test dit si ce choix est un point stable ou un réglage chanceux au milieu de voisins médiocres ; il ne remplace pas le walk-forward (rien ici n'est hors échantillon).

## En bref

- **±5 %** : Sharpe médian des voisins 1.49 (préréglage 1.59, P10–P90 1.42–1.58) ; le préréglage fait mieux que 92 % des voisins ; 100 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 1.42 (préréglage 1.59, P10–P90 1.32–1.52) ; le préréglage fait mieux que 99 % des voisins ; 97 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.35 (préréglage 1.59, P10–P90 1.23–1.47) ; le préréglage fait mieux que 100 % des voisins ; 83 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.

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

## Voisins aléatoires · 2017–2026

Rang : part des voisins que le préréglage bat (Max DD : moins profond). Autour de 50 % : le préréglage est au milieu de ses voisins (plateau) ; proche de 100 % : il est au sommet d'un pic.

### ±5 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 2754 % | 1809 % | 1973 % | 2200 % | 2457 % | 2762 % | 89 % |
| CAGR | 41.0 % | 35.3 % | 36.4 % | 37.9 % | 39.4 % | 41.0 % | 89 % |
| Sharpe | 1.59 | 1.42 | 1.45 | 1.49 | 1.53 | 1.58 | 92 % |
| Sortino | 2.28 | 2.03 | 2.09 | 2.14 | 2.20 | 2.27 | 93 % |
| Profit factor | 1.94 | 1.89 | 1.92 | 1.96 | 2.00 | 2.04 | 38 % |
| Max DD | -26.5 % | -27.1 % | -26.5 % | -25.9 % | -25.4 % | -24.8 % | 27 % |
| Trades | 396 | 382 | 388 | 397 | 406 | 414 | 47 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 100 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 2754 % | 1369 % | 1519 % | 1803 % | 2035 % | 2327 % | 97 % |
| CAGR | 41.0 % | 31.7 % | 33.0 % | 35.3 % | 36.9 % | 38.7 % | 97 % |
| Sharpe | 1.59 | 1.32 | 1.36 | 1.42 | 1.47 | 1.52 | 99 % |
| Sortino | 2.28 | 1.88 | 1.94 | 2.03 | 2.11 | 2.17 | 99 % |
| Profit factor | 1.94 | 1.82 | 1.88 | 1.93 | 2.00 | 2.05 | 55 % |
| Max DD | -26.5 % | -27.0 % | -26.1 % | -25.2 % | -24.3 % | -23.7 % | 18 % |
| Trades | 396 | 373 | 383 | 397 | 414 | 428 | 49 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 97 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 2754 % | 1050 % | 1259 % | 1485 % | 1787 % | 2090 % | 100 % |
| CAGR | 41.0 % | 28.4 % | 30.7 % | 32.7 % | 35.1 % | 37.2 % | 100 % |
| Sharpe | 1.59 | 1.23 | 1.29 | 1.35 | 1.42 | 1.47 | 100 % |
| Sortino | 2.28 | 1.77 | 1.85 | 1.93 | 2.02 | 2.10 | 100 % |
| Profit factor | 1.94 | 1.71 | 1.79 | 1.88 | 1.98 | 2.07 | 69 % |
| Max DD | -26.5 % | -29.1 % | -27.5 % | -25.8 % | -24.2 % | -22.6 % | 39 % |
| Trades | 396 | 338 | 367 | 400 | 430 | 454 | 48 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 83 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 1.59 | 1.42 · 1.49 · 1.56 | 35.2 % · 37.8 % · 40.6 % | -27.0 % · -26.2 % · -25.0 % | 100 % | 95 % |
| ±10 % | 100 | 1.59 | 1.31 · 1.43 · 1.52 | 31.3 % · 35.6 % · 38.7 % | -26.9 % · -25.2 % · -23.6 % | 100 % | 99 % |
| ±20 % | 100 | 1.59 | 1.22 · 1.36 · 1.49 | 27.5 % · 33.0 % · 37.4 % | -28.1 % · -25.5 % · -22.7 % | 100 % | 100 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2017–2018 | ±5 % | 1.81 | 1.55 · 1.61 · 1.70 · 1.80 · 1.86 | 124.0 % | 111.1 % (95.9 % – 133.4 %) | 282.2 % | 100 % | 0 % | 79 % |
| 2017–2018 | ±10 % | 1.81 | 1.39 · 1.51 · 1.63 · 1.76 · 1.84 | 124.0 % | 107.9 % (85.2 % – 127.4 %) | 282.2 % | 100 % | 0 % | 83 % |
| 2017–2018 | ±20 % | 1.81 | 1.26 · 1.45 · 1.61 · 1.76 · 1.86 | 124.0 % | 104.5 % (71.8 % – 128.7 %) | 282.2 % | 100 % | 0 % | 84 % |
| 2019–2020 | ±5 % | 1.27 | 1.11 · 1.18 · 1.24 · 1.31 · 1.36 | 88.4 % | 85.7 % (71.6 % – 100.7 %) | 685.0 % | 100 % | 0 % | 60 % |
| 2019–2020 | ±10 % | 1.27 | 0.98 · 1.07 · 1.16 · 1.24 · 1.31 | 88.4 % | 76.2 % (57.8 % – 93.0 %) | 685.0 % | 100 % | 0 % | 83 % |
| 2019–2020 | ±20 % | 1.27 | 0.93 · 1.01 · 1.12 · 1.23 · 1.30 | 88.4 % | 71.9 % (53.5 % – 91.1 %) | 685.0 % | 100 % | 0 % | 83 % |
| 2021–2022 | ±5 % | 1.32 | 0.78 · 0.87 · 0.96 · 1.07 · 1.12 | 79.8 % | 51.2 % (37.5 % – 64.3 %) | -43.0 % | 100 % | 100 % | 99 % |
| 2021–2022 | ±10 % | 1.32 | 0.44 · 0.58 · 0.76 · 0.88 · 0.99 | 79.8 % | 36.4 % (16.6 % – 52.8 %) | -43.0 % | 100 % | 100 % | 100 % |
| 2021–2022 | ±20 % | 1.32 | 0.21 · 0.48 · 0.72 · 0.92 · 1.04 | 79.8 % | 33.2 % (4.7 % – 56.3 %) | -43.0 % | 94 % | 100 % | 100 % |
| 2023–2024 | ±5 % | 2.87 | 2.60 · 2.68 · 2.82 · 2.94 · 3.06 | 226.8 % | 219.4 % (185.7 % – 260.4 %) | 465.0 % | 100 % | 0 % | 58 % |
| 2023–2024 | ±10 % | 2.87 | 2.43 · 2.57 · 2.73 · 2.91 · 3.08 | 226.8 % | 205.5 % (159.6 % – 268.5 %) | 465.0 % | 100 % | 0 % | 68 % |
| 2023–2024 | ±20 % | 2.87 | 2.25 · 2.39 · 2.58 · 2.75 · 2.87 | 226.8 % | 180.2 % (138.0 % – 235.7 %) | 465.0 % | 100 % | 0 % | 88 % |
| 2025–2026 | ±5 % | 0.56 | 0.56 · 0.64 · 0.73 · 0.87 · 0.99 | 15.1 % | 20.9 % (14.9 % – 31.3 %) | -9.2 % | 100 % | 100 % | 10 % |
| 2025–2026 | ±10 % | 0.56 | 0.61 · 0.72 · 0.84 · 0.99 · 1.19 | 15.1 % | 24.5 % (16.5 % – 38.3 %) | -9.2 % | 100 % | 100 % | 4 % |
| 2025–2026 | ±20 % | 0.56 | 0.44 · 0.70 · 0.86 · 1.06 · 1.24 | 15.1 % | 25.4 % (10.4 % – 40.4 %) | -9.2 % | 94 % | 99 % | 14 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2017–2026 | -26.5 % | -25.2 % (-27.0 %) | 1.94 | 1.93 (1.82) | 396 | 397 |
| 2017–2018 | -15.0 % | -16.1 % (-20.9 %) | 2.74 | 2.44 (2.08) | 55 | 59 |
| 2019–2020 | -15.9 % | -17.1 % (-20.2 %) | 1.91 | 1.80 (1.64) | 76 | 75 |
| 2021–2022 | -21.1 % | -23.2 % (-25.4 %) | 1.80 | 1.35 (1.17) | 90 | 93 |
| 2023–2024 | -12.8 % | -11.7 % (-14.9 %) | 3.40 | 3.45 (2.98) | 91 | 89 |
| 2025–2026 | -26.5 % | -25.0 % (-26.9 %) | 1.25 | 1.43 (1.29) | 84 | 81 |

## Un réglage à la fois · Sharpe 2017–2026

Les autres réglages restent ceux du préréglage (Sharpe 1.59).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 1.39 (104) | 1.49 (117) | 1.48 (124) | 1.48 (137) | 1.43 (143) | 1.43 (156) | -0.20 |
| calme · kMain | 1.27 (2.32) | 1.33 (2.61) | 1.52 (2.755) | 1.38 (3.045) | 1.40 (3.19) | 1.37 (3.48) | -0.31 |
| calme · rangeWin | 1.62 (12) | 1.59 (14) | 1.59 (14) | 1.66 (16) | 1.64 (17) | 1.60 (18) | 0.01 |
| calme · wickThr | 1.61 (0.32) | 1.57 (0.36) | 1.57 (0.38) | 1.58 (0.42) | 1.56 (0.44) | 1.55 (0.48) | -0.04 |
| calme · htfEmaLen | 1.50 (56) | 1.47 (63) | 1.50 (67) | 1.51 (74) | 1.51 (77) | 1.42 (84) | -0.17 |
| calme · volZWin | 1.56 (60) | 1.56 (68) | 1.56 (71) | 1.57 (79) | 1.51 (83) | 1.53 (90) | -0.07 |
| calme · volZThr | 1.55 (1.04) | 1.56 (1.17) | 1.58 (1.235) | 1.58 (1.365) | 1.59 (1.43) | 1.56 (1.56) | -0.03 |
| calme · atrLen | 1.64 (24) | 1.63 (27) | 1.61 (29) | 1.58 (32) | 1.58 (33) | 1.58 (36) | -0.01 |
| calme · atrStopMult | 1.58 (2.64) | 1.54 (2.97) | 1.61 (3.135) | 1.63 (3.465) | 1.62 (3.63) | 1.57 (3.96) | -0.04 |
| calme · atrTrailMult | 1.57 (40) | 1.55 (45) | 1.58 (47.5) | 1.58 (52.5) | 1.57 (55) | 1.56 (60) | -0.04 |
| agité · volWin | 1.59 (120) | 1.59 (135) | 1.59 (143) | 1.59 (158) | 1.59 (165) | 1.59 (180) | aucun effet |
| agité · kMain | 1.59 (1.92) | 1.59 (2.16) | 1.59 (2.28) | 1.59 (2.52) | 1.59 (2.64) | 1.59 (2.88) | aucun effet |
| agité · kMicro | 1.59 (1.76) | 1.59 (1.98) | 1.59 (2.09) | 1.59 (2.31) | 1.59 (2.42) | 1.59 (2.64) | aucun effet |
| agité · rangeWin | 1.59 (40) | 1.59 (45) | 1.59 (48) | 1.59 (53) | 1.59 (55) | 1.59 (60) | aucun effet |
| agité · wickThr | 1.59 (0.36) | 1.59 (0.405) | 1.59 (0.4275) | 1.59 (0.4725) | 1.59 (0.495) | 1.59 (0.54) | aucun effet |
| agité · htfEmaLen | 1.59 (52) | 1.59 (59) | 1.59 (62) | 1.59 (68) | 1.59 (72) | 1.59 (78) | aucun effet |
| agité · volZWin | 1.59 (20) | 1.59 (23) | 1.59 (24) | 1.59 (26) | 1.59 (28) | 1.59 (30) | aucun effet |
| agité · volZThr | 1.59 (-0.7) | 1.59 (-0.6) | 1.59 (-0.55) | 1.59 (-0.45) | 1.59 (-0.4) | 1.59 (-0.3) | aucun effet |
| agité · atrLen | 1.59 (18) | 1.59 (20) | 1.59 (21) | 1.59 (23) | 1.59 (24) | 1.59 (26) | aucun effet |
| agité · atrStopMult | 1.59 (0.88) | 1.59 (0.99) | 1.59 (1.045) | 1.59 (1.155) | 1.59 (1.21) | 1.59 (1.32) | aucun effet |
| agité · atrTrailMult | 1.59 (2.56) | 1.59 (2.88) | 1.59 (3.04) | 1.59 (3.36) | 1.59 (3.52) | 1.59 (3.84) | aucun effet |
| agité · tp1AtrMult | 1.59 (0.72) | 1.59 (0.81) | 1.59 (0.855) | 1.59 (0.945) | 1.59 (0.99) | 1.59 (1.08) | aucun effet |
| agité · tp1QtyPct | 1.59 (16) | 1.59 (18) | 1.59 (19) | 1.59 (21) | 1.59 (22) | 1.59 (24) | aucun effet |
| calme · lamEmaWin | 1.56 (120) | 1.59 (135) | 1.58 (143) | 1.52 (158) | 1.53 (165) | 1.54 (180) | -0.06 |
| calme · lamNormWin | 1.58 (240) | 1.59 (270) | 1.59 (285) | 1.59 (315) | 1.59 (330) | 1.58 (360) | -0.01 |
| calme · longLamPct | 1.56 (44) | 1.58 (49.5) | 1.59 (52.25) | 1.53 (57.75) | 1.54 (60.5) | 1.57 (66) | -0.06 |
| calme · htfSlopeBars | 1.54 (2) | 1.59 (3) | 1.59 (3) | 1.59 (3) | 1.59 (3) | 1.53 (4) | -0.05 |
| agité · lamEmaWin | 1.59 (120) | 1.59 (135) | 1.59 (143) | 1.59 (158) | 1.59 (165) | 1.59 (180) | aucun effet |
| agité · lamNormWin | 1.59 (240) | 1.59 (270) | 1.59 (285) | 1.59 (315) | 1.59 (330) | 1.59 (360) | aucun effet |
| agité · longLamPct | 1.59 (44) | 1.59 (49.5) | 1.59 (52.25) | 1.59 (57.75) | 1.59 (60.5) | 1.59 (66) | aucun effet |
| agité · htfSlopeBars | 1.59 (2) | 1.59 (3) | 1.59 (3) | 1.59 (3) | 1.59 (3) | 1.59 (4) | aucun effet |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| calme · htfEmaLen | -0.20 | -0.26 | 0.01 |
| calme · atrStopMult | 0.16 | 0.30 | -0.33 |
| agité · atrLen | -0.13 | -0.13 | -0.02 |
| agité · wickThr | 0.10 | 0.08 | 0.07 |
| calme · volZWin | -0.09 | -0.09 | -0.08 |
| calme · kMain | 0.08 | 0.13 | -0.06 |
| calme · atrTrailMult | 0.08 | 0.15 | -0.27 |
| agité · rangeWin | 0.08 | 0.07 | 0.03 |
| agité · atrTrailMult | -0.07 | -0.07 | -0.08 |
| calme · volWin | -0.06 | -0.10 | 0.13 |
| agité · atrStopMult | -0.05 | -0.05 | 0.04 |
| agité · htfEmaLen | -0.05 | -0.06 | 0.06 |
| agité · tp1AtrMult | 0.04 | 0.02 | -0.00 |
| agité · tp1QtyPct | 0.04 | 0.04 | -0.06 |
| calme · wickThr | -0.04 | -0.02 | -0.17 |
| agité · volWin | -0.03 | 0.00 | -0.04 |
| agité · kMicro | 0.03 | 0.05 | 0.05 |
| agité · kMain | -0.01 | 0.00 | 0.06 |
| calme · volZThr | -0.01 | -0.06 | 0.08 |
| agité · volZWin | -0.01 | 0.00 | 0.03 |
| agité · volZThr | -0.01 | -0.01 | -0.05 |
| calme · atrLen | 0.01 | -0.06 | 0.15 |
| calme · rangeWin | 0.00 | 0.08 | -0.13 |

## Cartes · Sharpe 2017–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 33 % · le préréglage bat 95 % des autres cases · anneau ±10 % : médiane 1.44, minimum 1.32.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.31 | 1.33 | 1.34 | 1.51 | 1.58 | 1.43 | 1.43 | 1.30 | 1.36 |
| 2.805 | 1.27 | 1.29 | 1.30 | 1.47 | 1.55 | 1.38 | 1.39 | 1.27 | 1.33 |
| 2.97 | 1.29 | 1.31 | 1.32 | 1.51 | 1.54 | 1.37 | 1.40 | 1.25 | 1.37 |
| 3.135 | 1.29 | 1.31 | 1.35 | 1.55 | 1.61 | 1.42 | 1.45 | 1.30 | 1.41 |
| 3.3 | 1.27 | 1.30 | 1.33 | 1.52 | [1.59] | 1.38 | 1.40 | 1.26 | 1.37 |
| 3.465 | 1.33 | 1.34 | 1.37 | 1.56 | 1.63 | 1.43 | 1.46 | 1.34 | 1.41 |
| 3.63 | 1.32 | 1.34 | 1.38 | 1.56 | 1.62 | 1.43 | 1.47 | 1.33 | 1.38 |
| 3.795 | 1.32 | 1.34 | 1.39 | 1.57 | 1.60 | 1.41 | 1.44 | 1.30 | 1.37 |
| 3.96 | 1.29 | 1.31 | 1.35 | 1.54 | 1.57 | 1.40 | 1.44 | 1.30 | 1.35 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 28 % · le préréglage bat 100 % des autres cases · anneau ±10 % : médiane 1.39, minimum 1.33.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.29 | 1.34 | 1.38 | 1.32 | 1.27 | 1.31 | 1.27 | 1.30 | 1.36 |
| 2.465 | 1.22 | 1.38 | 1.32 | 1.32 | 1.30 | 1.26 | 1.25 | 1.27 | 1.35 |
| 2.61 | 1.48 | 1.37 | 1.38 | 1.36 | 1.33 | 1.35 | 1.38 | 1.44 | 1.39 |
| 2.755 | 1.32 | 1.41 | 1.56 | 1.46 | 1.52 | 1.49 | 1.43 | 1.40 | 1.40 |
| 2.9 | 1.39 | 1.39 | 1.49 | 1.48 | [1.59] | 1.48 | 1.43 | 1.42 | 1.43 |
| 3.045 | 1.41 | 1.40 | 1.38 | 1.37 | 1.38 | 1.39 | 1.43 | 1.49 | 1.56 |
| 3.19 | 1.50 | 1.38 | 1.33 | 1.36 | 1.40 | 1.35 | 1.35 | 1.45 | 1.41 |
| 3.335 | 1.39 | 1.42 | 1.46 | 1.48 | 1.26 | 1.26 | 1.33 | 1.50 | 1.50 |
| 3.48 | 1.23 | 1.15 | 1.23 | 1.36 | 1.37 | 1.39 | 1.40 | 1.48 | 1.47 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 1.59, minimum 1.59.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 0.935 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 0.99 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.045 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.1 | 1.59 | 1.59 | 1.59 | 1.59 | [1.59] | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.155 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.21 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.265 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 1.32 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 1.59, minimum 1.59.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.72 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.88 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.04 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.2 | 1.59 | 1.59 | 1.59 | 1.59 | [1.59] | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.36 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.52 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.68 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 3.84 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 50 % des autres cases · anneau ±10 % : médiane 1.59, minimum 1.59.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.04 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.16 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.28 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.4 | 1.59 | 1.59 | 1.59 | 1.59 | [1.59] | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.52 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.64 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.76 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 2.88 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 22 % · le préréglage bat 95 % des autres cases · anneau ±10 % : médiane 1.40, minimum 1.33.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.04 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.16 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.28 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.4 | 1.27 | 1.30 | 1.33 | 1.52 | [1.59] | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.52 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.64 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.76 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |
| 2.88 | 1.27 | 1.30 | 1.33 | 1.52 | 1.59 | 1.38 | 1.40 | 1.26 | 1.37 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local-calm.json`.
