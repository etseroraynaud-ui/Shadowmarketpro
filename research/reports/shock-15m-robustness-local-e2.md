# Robustesse locale du préréglage · Shock Engine 15 min · shorts en régime de tendance baissier (E2)

BTC/USD Bitstamp 15 min, 2017-01-01 → 2026-10-04, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --n 300 --n-ext 100 --seed 7` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Limite à garder en tête** : le préréglage a été choisi sur tout 2017–2026. Ce test dit si ce choix est un point stable ou un réglage chanceux au milieu de voisins médiocres ; il ne remplace pas le walk-forward (rien ici n'est hors échantillon).

## En bref

- **±5 %** : Sharpe médian des voisins 1.45 (préréglage 1.56, P10–P90 1.35–1.53) ; le préréglage fait mieux que 95 % des voisins ; 99 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 1.38 (préréglage 1.56, P10–P90 1.24–1.51) ; le préréglage fait mieux que 97 % des voisins ; 89 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.32 (préréglage 1.56, P10–P90 1.17–1.47) ; le préréglage fait mieux que 99 % des voisins ; 70 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.

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
| agité · kMain | seulement à 1.92 (Sharpe 1.46) | le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s'il passe sous 2,0 |
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
| Rendement | 3160 % | 1829 % | 2033 % | 2278 % | 2600 % | 2953 % | 94 % |
| CAGR | 42.9 % | 35.4 % | 36.8 % | 38.4 % | 40.2 % | 42.0 % | 94 % |
| Sharpe | 1.56 | 1.35 | 1.40 | 1.45 | 1.48 | 1.53 | 95 % |
| Sortino | 2.27 | 1.95 | 2.01 | 2.09 | 2.15 | 2.22 | 95 % |
| Profit factor | 1.67 | 1.62 | 1.65 | 1.67 | 1.70 | 1.73 | 48 % |
| Max DD | -24.1 % | -27.8 % | -26.6 % | -25.1 % | -23.9 % | -23.2 % | 73 % |
| Trades | 774 | 762 | 771 | 781 | 790 | 799 | 34 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 99 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 3160 % | 1371 % | 1601 % | 1921 % | 2346 % | 2718 % | 96 % |
| CAGR | 42.9 % | 31.7 % | 33.7 % | 36.1 % | 38.8 % | 40.8 % | 96 % |
| Sharpe | 1.56 | 1.24 | 1.31 | 1.38 | 1.45 | 1.51 | 97 % |
| Sortino | 2.27 | 1.78 | 1.88 | 1.99 | 2.09 | 2.18 | 98 % |
| Profit factor | 1.67 | 1.58 | 1.61 | 1.66 | 1.71 | 1.74 | 59 % |
| Max DD | -24.1 % | -29.4 % | -27.4 % | -25.5 % | -24.2 % | -22.8 % | 77 % |
| Trades | 774 | 755 | 770 | 784 | 804 | 822 | 32 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 89 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 3160 % | 1048 % | 1285 % | 1600 % | 1980 % | 2480 % | 99 % |
| CAGR | 42.9 % | 28.4 % | 30.9 % | 33.7 % | 36.5 % | 39.5 % | 99 % |
| Sharpe | 1.56 | 1.17 | 1.24 | 1.32 | 1.39 | 1.47 | 99 % |
| Sortino | 2.27 | 1.67 | 1.78 | 1.90 | 2.01 | 2.12 | 99 % |
| Profit factor | 1.67 | 1.48 | 1.54 | 1.60 | 1.65 | 1.73 | 80 % |
| Max DD | -24.1 % | -33.2 % | -29.4 % | -26.8 % | -24.7 % | -22.8 % | 80 % |
| Trades | 774 | 725 | 756 | 793 | 833 | 863 | 33 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 70 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 1.56 | 1.35 · 1.44 · 1.52 | 35.3 % · 38.3 % · 41.5 % | -28.2 % · -24.9 % · -23.3 % | 100 % | 99 % |
| ±10 % | 100 | 1.56 | 1.24 · 1.39 · 1.48 | 30.6 % · 36.6 % · 39.9 % | -29.4 % · -25.4 % · -22.9 % | 100 % | 99 % |
| ±20 % | 100 | 1.56 | 1.09 · 1.30 · 1.49 | 25.6 % · 33.8 % · 39.5 % | -31.4 % · -26.0 % · -23.0 % | 100 % | 97 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2017–2018 | ±5 % | 1.81 | 1.41 · 1.51 · 1.60 · 1.71 · 1.80 | 140.7 % | 116.9 % (92.6 % – 142.5 %) | 282.2 % | 100 % | 0 % | 91 % |
| 2017–2018 | ±10 % | 1.81 | 1.25 · 1.38 · 1.54 · 1.67 · 1.77 | 140.7 % | 108.5 % (80.6 % – 138.6 %) | 282.2 % | 100 % | 0 % | 92 % |
| 2017–2018 | ±20 % | 1.81 | 1.12 · 1.27 · 1.46 · 1.67 · 1.82 | 140.7 % | 102.9 % (66.7 % – 140.6 %) | 282.2 % | 100 % | 0 % | 89 % |
| 2019–2020 | ±5 % | 1.22 | 1.09 · 1.17 · 1.24 · 1.32 · 1.40 | 90.0 % | 91.9 % (75.1 % – 112.5 %) | 685.0 % | 100 % | 0 % | 43 % |
| 2019–2020 | ±10 % | 1.22 | 1.00 · 1.10 · 1.25 · 1.36 · 1.50 | 90.0 % | 91.5 % (64.9 % – 123.9 %) | 685.0 % | 100 % | 0 % | 46 % |
| 2019–2020 | ±20 % | 1.22 | 1.03 · 1.16 · 1.30 · 1.43 · 1.53 | 90.0 % | 94.8 % (66.7 % – 127.6 %) | 685.0 % | 100 % | 0 % | 35 % |
| 2021–2022 | ±5 % | 1.43 | 0.72 · 0.83 · 0.93 · 1.01 · 1.09 | 95.1 % | 51.7 % (35.4 % – 65.3 %) | -43.0 % | 100 % | 100 % | 100 % |
| 2021–2022 | ±10 % | 1.43 | 0.39 · 0.55 · 0.69 · 0.82 · 0.94 | 95.1 % | 32.9 % (14.2 % – 52.4 %) | -43.0 % | 99 % | 100 % | 100 % |
| 2021–2022 | ±20 % | 1.43 | 0.20 · 0.44 · 0.64 · 0.85 · 1.00 | 95.1 % | 29.6 % (4.0 % – 56.7 %) | -43.0 % | 93 % | 100 % | 100 % |
| 2023–2024 | ±5 % | 2.81 | 2.54 · 2.63 · 2.77 · 2.90 · 3.01 | 226.4 % | 219.8 % (184.9 % – 259.6 %) | 465.0 % | 100 % | 0 % | 56 % |
| 2023–2024 | ±10 % | 2.81 | 2.38 · 2.53 · 2.68 · 2.86 · 3.04 | 226.4 % | 205.8 % (163.3 % – 269.1 %) | 465.0 % | 100 % | 0 % | 70 % |
| 2023–2024 | ±20 % | 2.81 | 2.11 · 2.26 · 2.46 · 2.66 · 2.81 | 226.4 % | 174.5 % (134.0 % – 232.0 %) | 465.0 % | 100 % | 0 % | 89 % |
| 2025–2026 | ±5 % | 0.46 | 0.49 · 0.58 · 0.68 · 0.82 · 0.92 | 12.0 % | 20.1 % (12.9 % – 29.5 %) | -9.2 % | 100 % | 100 % | 7 % |
| 2025–2026 | ±10 % | 0.46 | 0.58 · 0.67 · 0.80 · 0.95 · 1.13 | 12.0 % | 24.2 % (15.9 % – 37.8 %) | -9.2 % | 100 % | 100 % | 3 % |
| 2025–2026 | ±20 % | 0.46 | 0.35 · 0.60 · 0.78 · 0.98 · 1.19 | 12.0 % | 23.1 % (8.0 % – 39.6 %) | -9.2 % | 94 % | 97 % | 13 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2017–2026 | -24.1 % | -25.5 % (-29.4 %) | 1.67 | 1.66 (1.58) | 774 | 784 |
| 2017–2018 | -14.3 % | -17.5 % (-23.6 %) | 2.08 | 1.85 (1.65) | 153 | 161 |
| 2019–2020 | -17.3 % | -16.4 % (-19.1 %) | 1.50 | 1.52 (1.37) | 169 | 165 |
| 2021–2022 | -19.2 % | -23.5 % (-26.5 %) | 1.70 | 1.25 (1.12) | 151 | 160 |
| 2023–2024 | -12.8 % | -11.5 % (-15.1 %) | 2.69 | 2.67 (2.37) | 157 | 158 |
| 2025–2026 | -24.1 % | -22.5 % (-25.2 %) | 1.15 | 1.31 (1.21) | 144 | 141 |

## Un réglage à la fois · Sharpe 2017–2026

Les autres réglages restent ceux du préréglage (Sharpe 1.56).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 1.37 (104) | 1.47 (117) | 1.46 (124) | 1.47 (137) | 1.41 (143) | 1.42 (156) | -0.19 |
| calme · kMain | 1.29 (2.32) | 1.33 (2.61) | 1.51 (2.755) | 1.36 (3.045) | 1.38 (3.19) | 1.37 (3.48) | -0.28 |
| calme · rangeWin | 1.59 (12) | 1.57 (14) | 1.57 (14) | 1.64 (16) | 1.62 (17) | 1.58 (18) | 0.00 |
| calme · wickThr | 1.58 (0.32) | 1.55 (0.36) | 1.55 (0.38) | 1.55 (0.42) | 1.54 (0.44) | 1.52 (0.48) | -0.04 |
| calme · htfEmaLen | 1.49 (56) | 1.47 (63) | 1.50 (67) | 1.50 (74) | 1.50 (77) | 1.41 (84) | -0.15 |
| calme · volZWin | 1.53 (60) | 1.53 (68) | 1.54 (71) | 1.55 (79) | 1.49 (83) | 1.51 (90) | -0.07 |
| calme · volZThr | 1.53 (1.04) | 1.54 (1.17) | 1.56 (1.235) | 1.56 (1.365) | 1.56 (1.43) | 1.53 (1.56) | -0.03 |
| calme · atrLen | 1.62 (24) | 1.60 (27) | 1.59 (29) | 1.56 (32) | 1.56 (33) | 1.56 (36) | -0.01 |
| calme · atrStopMult | 1.55 (2.64) | 1.52 (2.97) | 1.59 (3.135) | 1.61 (3.465) | 1.60 (3.63) | 1.55 (3.96) | -0.04 |
| calme · atrTrailMult | 1.55 (40) | 1.53 (45) | 1.56 (47.5) | 1.56 (52.5) | 1.55 (55) | 1.54 (60) | -0.03 |
| agité · volWin | 1.52 (120) | 1.51 (135) | 1.57 (143) | 1.53 (158) | 1.52 (165) | 1.51 (180) | -0.06 |
| agité · kMain | 1.46 (1.92) | 1.56 (2.16) | 1.56 (2.28) | 1.56 (2.52) | 1.56 (2.64) | 1.56 (2.88) | -0.11 |
| agité · kMicro | 1.38 (1.76) | 1.39 (1.98) | 1.40 (2.09) | 1.58 (2.31) | 1.56 (2.42) | 1.56 (2.64) | -0.18 |
| agité · rangeWin | 1.59 (40) | 1.58 (45) | 1.56 (48) | 1.57 (53) | 1.58 (55) | 1.58 (60) | 0.00 |
| agité · wickThr | 1.56 (0.36) | 1.56 (0.405) | 1.56 (0.4275) | 1.56 (0.4725) | 1.56 (0.495) | 1.56 (0.54) | aucun effet |
| agité · htfEmaLen | 1.48 (52) | 1.60 (59) | 1.55 (62) | 1.54 (68) | 1.53 (72) | 1.49 (78) | -0.08 |
| agité · volZWin | 1.57 (20) | 1.57 (23) | 1.57 (24) | 1.57 (26) | 1.57 (28) | 1.57 (30) | 0.00 |
| agité · volZThr | 1.56 (-0.7) | 1.56 (-0.6) | 1.56 (-0.55) | 1.56 (-0.45) | 1.56 (-0.4) | 1.56 (-0.3) | aucun effet |
| agité · atrLen | 1.54 (18) | 1.56 (20) | 1.56 (21) | 1.56 (23) | 1.56 (24) | 1.57 (26) | -0.02 |
| agité · atrStopMult | 1.59 (0.88) | 1.57 (0.99) | 1.56 (1.045) | 1.60 (1.155) | 1.60 (1.21) | 1.61 (1.32) | -0.00 |
| agité · atrTrailMult | 1.59 (2.56) | 1.58 (2.88) | 1.55 (3.04) | 1.58 (3.36) | 1.64 (3.52) | 1.58 (3.84) | -0.01 |
| agité · tp1AtrMult | 1.56 (0.72) | 1.56 (0.81) | 1.56 (0.855) | 1.56 (0.945) | 1.56 (0.99) | 1.57 (1.08) | -0.00 |
| agité · tp1QtyPct | 1.56 (16) | 1.56 (18) | 1.56 (19) | 1.57 (21) | 1.57 (22) | 1.57 (24) | -0.00 |
| calme · lamEmaWin | 1.54 (120) | 1.57 (135) | 1.56 (143) | 1.51 (158) | 1.51 (165) | 1.52 (180) | -0.06 |
| calme · lamNormWin | 1.56 (240) | 1.57 (270) | 1.57 (285) | 1.57 (315) | 1.57 (330) | 1.56 (360) | -0.01 |
| calme · longLamPct | 1.54 (44) | 1.56 (49.5) | 1.56 (52.25) | 1.51 (57.75) | 1.52 (60.5) | 1.55 (66) | -0.06 |
| calme · htfSlopeBars | 1.52 (2) | 1.56 (3) | 1.56 (3) | 1.56 (3) | 1.56 (3) | 1.51 (4) | -0.05 |
| agité · lamEmaWin | 1.54 (120) | 1.55 (135) | 1.57 (143) | 1.55 (158) | 1.54 (165) | 1.55 (180) | -0.03 |
| agité · lamNormWin | 1.52 (240) | 1.51 (270) | 1.55 (285) | 1.54 (315) | 1.53 (330) | 1.53 (360) | -0.06 |
| agité · longLamPct | 1.52 (44) | 1.54 (49.5) | 1.56 (52.25) | 1.53 (57.75) | 1.49 (60.5) | 1.50 (66) | -0.08 |
| agité · htfSlopeBars | 1.55 (2) | 1.56 (3) | 1.56 (3) | 1.56 (3) | 1.56 (3) | 1.57 (4) | -0.02 |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat sur toute la période, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| agité · kMicro | 0.47 | 0.41 | 0.24 |
| calme · htfEmaLen | -0.22 | -0.27 | 0.01 |
| agité · atrLen | -0.15 | -0.15 | -0.09 |
| agité · rangeWin | 0.14 | 0.12 | 0.06 |
| calme · atrStopMult | 0.12 | 0.23 | -0.31 |
| agité · htfEmaLen | -0.10 | -0.09 | -0.01 |
| calme · atrTrailMult | 0.09 | 0.14 | -0.19 |
| agité · volZThr | 0.07 | 0.06 | 0.01 |
| agité · wickThr | 0.06 | 0.05 | -0.02 |
| agité · tp1QtyPct | 0.06 | 0.04 | -0.02 |
| calme · volZWin | -0.05 | -0.06 | -0.02 |
| agité · atrStopMult | 0.05 | 0.06 | 0.24 |
| calme · kMain | 0.03 | 0.08 | -0.06 |
| calme · volWin | -0.03 | -0.07 | 0.05 |
| calme · rangeWin | 0.03 | 0.07 | -0.10 |
| agité · atrTrailMult | 0.02 | 0.07 | -0.01 |
| agité · volWin | -0.02 | -0.00 | -0.13 |
| agité · kMain | 0.02 | 0.03 | -0.01 |
| agité · tp1AtrMult | 0.02 | 0.01 | -0.00 |
| calme · atrLen | 0.01 | -0.04 | 0.12 |
| calme · wickThr | -0.01 | -0.00 | -0.17 |
| calme · volZThr | 0.01 | -0.01 | 0.01 |
| agité · volZWin | 0.01 | 0.01 | 0.01 |

## Cartes · Sharpe 2017–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 30 % · le préréglage bat 95 % des autres cases · anneau ±10 % : médiane 1.42, minimum 1.31.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.32 | 1.33 | 1.33 | 1.49 | 1.55 | 1.41 | 1.40 | 1.30 | 1.36 |
| 2.805 | 1.28 | 1.29 | 1.30 | 1.45 | 1.53 | 1.36 | 1.37 | 1.27 | 1.33 |
| 2.97 | 1.31 | 1.31 | 1.31 | 1.49 | 1.52 | 1.35 | 1.38 | 1.25 | 1.37 |
| 3.135 | 1.30 | 1.31 | 1.35 | 1.53 | 1.59 | 1.39 | 1.43 | 1.30 | 1.40 |
| 3.3 | 1.29 | 1.31 | 1.33 | 1.51 | [1.56] | 1.36 | 1.38 | 1.26 | 1.37 |
| 3.465 | 1.35 | 1.35 | 1.37 | 1.54 | 1.61 | 1.41 | 1.44 | 1.34 | 1.41 |
| 3.63 | 1.33 | 1.34 | 1.38 | 1.54 | 1.60 | 1.41 | 1.44 | 1.33 | 1.38 |
| 3.795 | 1.33 | 1.35 | 1.38 | 1.55 | 1.58 | 1.39 | 1.42 | 1.30 | 1.36 |
| 3.96 | 1.30 | 1.31 | 1.35 | 1.52 | 1.55 | 1.38 | 1.42 | 1.30 | 1.35 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 31 % · le préréglage bat 100 % des autres cases · anneau ±10 % : médiane 1.38, minimum 1.32.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.30 | 1.36 | 1.39 | 1.33 | 1.29 | 1.33 | 1.29 | 1.30 | 1.36 |
| 2.465 | 1.22 | 1.38 | 1.32 | 1.32 | 1.31 | 1.28 | 1.26 | 1.28 | 1.35 |
| 2.61 | 1.47 | 1.36 | 1.38 | 1.35 | 1.33 | 1.34 | 1.38 | 1.43 | 1.39 |
| 2.755 | 1.31 | 1.39 | 1.54 | 1.45 | 1.51 | 1.48 | 1.42 | 1.38 | 1.38 |
| 2.9 | 1.37 | 1.38 | 1.47 | 1.46 | [1.56] | 1.47 | 1.41 | 1.40 | 1.42 |
| 3.045 | 1.39 | 1.38 | 1.36 | 1.35 | 1.36 | 1.37 | 1.41 | 1.47 | 1.53 |
| 3.19 | 1.48 | 1.36 | 1.32 | 1.35 | 1.38 | 1.33 | 1.34 | 1.43 | 1.39 |
| 3.335 | 1.39 | 1.41 | 1.44 | 1.45 | 1.26 | 1.27 | 1.31 | 1.47 | 1.47 |
| 3.48 | 1.23 | 1.15 | 1.24 | 1.36 | 1.37 | 1.38 | 1.39 | 1.47 | 1.45 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 36 % des autres cases · anneau ±10 % : médiane 1.57, minimum 1.56.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 1.51 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 |
| 0.935 | 1.48 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 | 1.55 |
| 0.99 | 1.48 | 1.57 | 1.57 | 1.57 | 1.57 | 1.57 | 1.57 | 1.57 | 1.57 |
| 1.045 | 1.47 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 | 1.56 |
| 1.1 | 1.46 | 1.56 | 1.56 | 1.56 | [1.56] | 1.56 | 1.56 | 1.56 | 1.56 |
| 1.155 | 1.50 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 |
| 1.21 | 1.52 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 |
| 1.265 | 1.54 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 |
| 1.32 | 1.56 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 9 % des autres cases · anneau ±10 % : médiane 1.59, minimum 1.55.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 1.60 | 1.60 | 1.61 | 1.60 | 1.59 | 1.60 | 1.59 | 1.60 | 1.62 |
| 2.72 | 1.59 | 1.59 | 1.59 | 1.59 | 1.59 | 1.63 | 1.63 | 1.63 | 1.65 |
| 2.88 | 1.58 | 1.58 | 1.59 | 1.58 | 1.58 | 1.62 | 1.61 | 1.63 | 1.64 |
| 3.04 | 1.59 | 1.55 | 1.56 | 1.55 | 1.55 | 1.59 | 1.59 | 1.60 | 1.61 |
| 3.2 | 1.59 | 1.55 | 1.57 | 1.56 | [1.56] | 1.60 | 1.60 | 1.60 | 1.61 |
| 3.36 | 1.60 | 1.56 | 1.58 | 1.58 | 1.58 | 1.61 | 1.61 | 1.61 | 1.62 |
| 3.52 | 1.62 | 1.62 | 1.64 | 1.64 | 1.64 | 1.68 | 1.67 | 1.68 | 1.69 |
| 3.68 | 1.58 | 1.58 | 1.60 | 1.59 | 1.60 | 1.63 | 1.63 | 1.63 | 1.64 |
| 3.84 | 1.57 | 1.57 | 1.59 | 1.58 | 1.58 | 1.62 | 1.61 | 1.62 | 1.62 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 86 % des autres cases · anneau ±10 % : médiane 1.53, minimum 1.51.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.49 | 1.50 | 1.45 | 1.44 | 1.46 | 1.43 | 1.46 | 1.50 | 1.50 |
| 2.04 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.16 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.28 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.4 | 1.52 | 1.54 | 1.51 | 1.57 | [1.56] | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.52 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.64 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.76 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |
| 2.88 | 1.52 | 1.54 | 1.51 | 1.57 | 1.56 | 1.53 | 1.52 | 1.51 | 1.51 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 21 % · le préréglage bat 96 % des autres cases · anneau ±10 % : médiane 1.38, minimum 1.33.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.18 | 1.20 | 1.22 | 1.40 | 1.46 | 1.26 | 1.27 | 1.16 | 1.26 |
| 2.04 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.16 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.28 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.4 | 1.29 | 1.31 | 1.33 | 1.51 | [1.56] | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.52 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.64 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.76 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |
| 2.88 | 1.29 | 1.31 | 1.33 | 1.51 | 1.56 | 1.36 | 1.38 | 1.26 | 1.37 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local-e2.json`.
