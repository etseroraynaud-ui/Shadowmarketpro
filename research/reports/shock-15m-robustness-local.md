# Robustesse locale du préréglage · Shock Engine 15 min

BTC/USD Bitstamp 15 min, 2017-01-01 → 2026-10-04, préréglage du bot (adaptatif volatilité, régime recalculé en ligne comme en réel), commission 0,045 % par ordre, sans levier. Produit par `node research/shock/robustness-local.ts --n 300 --n-ext 100 --seed 7` (1810 simulations).

**But : mesurer la robustesse du préréglage actuel, pas en choisir un autre.** Aucune configuration voisine n'est retenue ni proposée, même quand elle fait mieux.

**Limite à garder en tête** : le préréglage a été choisi sur tout 2017–2026. Ce test dit si ce choix est un point stable ou un réglage chanceux au milieu de voisins médiocres ; il ne remplace pas le walk-forward (rien ici n'est hors échantillon).

## En bref

- **±5 %** : Sharpe médian des voisins 1.51 (préréglage 1.61, P10–P90 1.43–1.59) ; le préréglage fait mieux que 94 % des voisins ; 99 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 3 % battent l'achat conservé.
- **±10 %** : Sharpe médian des voisins 1.44 (préréglage 1.61, P10–P90 1.31–1.57) ; le préréglage fait mieux que 96 % des voisins ; 95 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 2 % battent l'achat conservé.
- **±20 %** : Sharpe médian des voisins 1.38 (préréglage 1.61, P10–P90 1.26–1.53) ; le préréglage fait mieux que 98 % des voisins ; 84 % des voisins gardent au moins 80 % de son Sharpe ; 100 % sont rentables, 0 % battent l'achat conservé.

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
| agité · kMain | seulement à 1.92 (Sharpe 1.52) | le choc agité se déclenche dès que z dépasse kMicro − 0,2 = 2,0 en valeur absolue (micro-choc, mode High Activity) : kMain = 2,4 ne compte que s'il passe sous 2,0 |
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
| Rendement | 7581 % | 4335 % | 4930 % | 5605 % | 6606 % | 7340 % | 92 % |
| CAGR | 56.1 % | 47.5 % | 49.4 % | 51.4 % | 53.9 % | 55.5 % | 92 % |
| Sharpe | 1.61 | 1.43 | 1.47 | 1.51 | 1.56 | 1.59 | 94 % |
| Sortino | 2.36 | 2.09 | 2.15 | 2.22 | 2.29 | 2.34 | 94 % |
| Profit factor | 1.46 | 1.45 | 1.46 | 1.48 | 1.50 | 1.52 | 23 % |
| Max DD | -29.6 % | -35.1 % | -33.8 % | -32.2 % | -30.8 % | -29.2 % | 87 % |
| Trades | 1050 | 1023 | 1039 | 1055 | 1071 | 1083 | 44 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 3 % · Sharpe ≥ 80 % de celui du préréglage : 99 %.

### ±10 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7581 % | 2922 % | 3594 % | 4537 % | 5501 % | 6798 % | 95 % |
| CAGR | 56.1 % | 41.8 % | 44.8 % | 48.2 % | 51.1 % | 54.3 % | 95 % |
| Sharpe | 1.61 | 1.31 | 1.37 | 1.44 | 1.50 | 1.57 | 96 % |
| Sortino | 2.36 | 1.91 | 2.00 | 2.10 | 2.20 | 2.29 | 97 % |
| Profit factor | 1.46 | 1.43 | 1.45 | 1.48 | 1.51 | 1.54 | 29 % |
| Max DD | -29.6 % | -35.5 % | -34.1 % | -31.8 % | -28.9 % | -26.4 % | 70 % |
| Trades | 1050 | 1008 | 1028 | 1056 | 1091 | 1122 | 46 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 2 % · Sharpe ≥ 80 % de celui du préréglage : 95 %.

### ±20 % · 300 voisins

|  | préréglage | P10 | P25 | médiane | P75 | P90 | rang du préréglage |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rendement | 7581 % | 2426 % | 2886 % | 3624 % | 4569 % | 5757 % | 98 % |
| CAGR | 56.1 % | 39.2 % | 41.6 % | 44.9 % | 48.3 % | 51.8 % | 98 % |
| Sharpe | 1.61 | 1.26 | 1.31 | 1.38 | 1.45 | 1.53 | 98 % |
| Sortino | 2.36 | 1.83 | 1.91 | 2.03 | 2.11 | 2.22 | 98 % |
| Profit factor | 1.46 | 1.37 | 1.42 | 1.47 | 1.53 | 1.61 | 46 % |
| Max DD | -29.6 % | -36.4 % | -33.5 % | -30.0 % | -27.4 % | -25.3 % | 56 % |
| Trades | 1050 | 936 | 1000 | 1068 | 1140 | 1198 | 45 % |

Voisins rentables : 100 % · profit factor > 1 : 100 % · meilleurs que l'achat conservé (8675 %, Max DD -84.0 %) : 0 % · Sharpe ≥ 80 % de celui du préréglage : 84 %.

### Famille étendue (réglages du script en plus)

| niveau | voisins | Sharpe préréglage | Sharpe P10 · méd. · P90 | CAGR P10 · méd. · P90 | Max DD P10 · méd. · P90 | rentables | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ±5 % | 100 | 1.61 | 1.41 · 1.51 · 1.57 | 47.5 % · 51.2 % · 54.8 % | -35.6 % · -31.9 % · -29.6 % | 100 % | 97 % |
| ±10 % | 100 | 1.61 | 1.33 · 1.45 · 1.56 | 42.8 % · 48.5 % · 53.3 % | -34.8 % · -31.6 % · -26.0 % | 100 % | 95 % |
| ±20 % | 100 | 1.61 | 1.17 · 1.37 · 1.54 | 34.8 % · 44.8 % · 52.9 % | -36.3 % · -30.1 % · -26.1 % | 100 % | 94 % |

## Par sous-période

Même simulation, découpée. Une sous-période commence avec le capital atteint à son début.

| période | niveau | Sharpe préréglage | Sharpe P10 · P25 · méd. · P75 · P90 | rendement préréglage | rendement méd. (P10–P90) | achat conservé | voisins rentables | battent l'achat conservé | rang Sharpe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2017–2018 | ±5 % | 1.63 | 1.28 · 1.37 · 1.46 · 1.54 · 1.61 | 161.4 % | 133.3 % (106.3 % – 159.4 %) | 282.2 % | 100 % | 0 % | 92 % |
| 2017–2018 | ±10 % | 1.63 | 1.10 · 1.23 · 1.37 · 1.50 · 1.60 | 161.4 % | 119.1 % (85.6 % – 156.4 %) | 282.2 % | 100 % | 0 % | 93 % |
| 2017–2018 | ±20 % | 1.63 | 0.97 · 1.14 · 1.29 · 1.45 · 1.61 | 161.4 % | 106.7 % (69.0 % – 154.4 %) | 282.2 % | 100 % | 0 % | 92 % |
| 2019–2020 | ±5 % | 1.79 | 1.58 · 1.67 · 1.75 · 1.83 · 1.90 | 224.2 % | 215.9 % (178.6 % – 252.7 %) | 685.0 % | 100 % | 0 % | 61 % |
| 2019–2020 | ±10 % | 1.79 | 1.38 · 1.52 · 1.66 · 1.83 · 1.95 | 224.2 % | 191.8 % (135.8 % – 264.3 %) | 685.0 % | 100 % | 0 % | 68 % |
| 2019–2020 | ±20 % | 1.79 | 1.27 · 1.43 · 1.59 · 1.76 · 1.88 | 224.2 % | 171.2 % (109.1 % – 247.5 %) | 685.0 % | 100 % | 0 % | 79 % |
| 2021–2022 | ±5 % | 1.73 | 1.18 · 1.28 · 1.37 · 1.44 · 1.52 | 178.3 % | 120.9 % (92.8 % – 142.3 %) | -43.0 % | 100 % | 100 % | 100 % |
| 2021–2022 | ±10 % | 1.73 | 0.86 · 0.98 · 1.18 · 1.35 · 1.49 | 178.3 % | 92.1 % (55.7 % – 141.7 %) | -43.0 % | 100 % | 100 % | 100 % |
| 2021–2022 | ±20 % | 1.73 | 0.73 · 0.93 · 1.16 · 1.39 · 1.54 | 178.3 % | 89.5 % (42.3 % – 147.2 %) | -43.0 % | 100 % | 100 % | 99 % |
| 2023–2024 | ±5 % | 1.83 | 1.68 · 1.78 · 1.92 · 2.07 · 2.19 | 141.1 % | 153.1 % (121.4 % – 193.3 %) | 465.0 % | 100 % | 0 % | 31 % |
| 2023–2024 | ±10 % | 1.83 | 1.56 · 1.72 · 1.91 · 2.07 · 2.22 | 141.1 % | 150.8 % (107.1 % – 200.9 %) | 465.0 % | 100 % | 0 % | 40 % |
| 2023–2024 | ±20 % | 1.83 | 1.52 · 1.69 · 1.82 · 1.98 · 2.11 | 141.1 % | 139.2 % (101.9 % – 184.7 %) | 465.0 % | 100 % | 0 % | 51 % |
| 2025–2026 | ±5 % | 0.89 | 0.87 · 0.95 · 1.03 · 1.12 · 1.20 | 35.1 % | 42.3 % (34.0 % – 51.9 %) | -9.2 % | 100 % | 100 % | 12 % |
| 2025–2026 | ±10 % | 0.89 | 0.93 · 1.01 · 1.13 · 1.26 · 1.37 | 35.1 % | 47.6 % (36.7 % – 62.6 %) | -9.2 % | 100 % | 100 % | 7 % |
| 2025–2026 | ±20 % | 0.89 | 0.61 · 0.93 · 1.09 · 1.31 · 1.56 | 35.1 % | 45.9 % (20.8 % – 75.3 %) | -9.2 % | 98 % | 100 % | 20 % |

| période | Max DD préréglage | Max DD méd. ±10 % (P10) | PF préréglage | PF méd. ±10 % (P10) | trades préréglage | trades méd. ±10 % |
| --- | --- | --- | --- | --- | --- | --- |
| 2017–2026 | -29.6 % | -31.8 % (-35.5 %) | 1.46 | 1.48 (1.43) | 1050 | 1056 |
| 2017–2018 | -19.5 % | -23.7 % (-27.3 %) | 1.73 | 1.58 (1.44) | 195 | 204 |
| 2019–2020 | -26.1 % | -25.1 % (-28.3 %) | 1.61 | 1.58 (1.45) | 207 | 203 |
| 2021–2022 | -16.2 % | -18.5 % (-21.4 %) | 1.69 | 1.42 (1.27) | 198 | 205 |
| 2023–2024 | -18.3 % | -18.6 % (-24.1 %) | 1.59 | 1.66 (1.50) | 246 | 245 |
| 2025–2026 | -22.0 % | -21.2 % (-24.2 %) | 1.27 | 1.36 (1.28) | 204 | 201 |

## Un réglage à la fois · Sharpe 2017–2026

Les autres réglages restent ceux du préréglage (Sharpe 1.61).

| régime · réglage | −20 % | −10 % | −5 % | +5 % | +10 % | +20 % | pire écart |
| --- | --- | --- | --- | --- | --- | --- | --- |
| calme · volWin | 1.39 (104) | 1.53 (117) | 1.52 (124) | 1.54 (137) | 1.48 (143) | 1.51 (156) | -0.21 |
| calme · kMain | 1.33 (2.32) | 1.44 (2.61) | 1.59 (2.755) | 1.43 (3.045) | 1.48 (3.19) | 1.50 (3.48) | -0.28 |
| calme · rangeWin | 1.61 (12) | 1.61 (14) | 1.61 (14) | 1.66 (16) | 1.66 (17) | 1.66 (18) | 0.00 |
| calme · wickThr | 1.68 (0.32) | 1.61 (0.36) | 1.62 (0.38) | 1.58 (0.42) | 1.57 (0.44) | 1.57 (0.48) | -0.04 |
| calme · htfEmaLen | 1.50 (56) | 1.51 (63) | 1.54 (67) | 1.57 (74) | 1.58 (77) | 1.47 (84) | -0.14 |
| calme · volZWin | 1.55 (60) | 1.58 (68) | 1.58 (71) | 1.59 (79) | 1.53 (83) | 1.56 (90) | -0.08 |
| calme · volZThr | 1.59 (1.04) | 1.59 (1.17) | 1.60 (1.235) | 1.59 (1.365) | 1.55 (1.43) | 1.54 (1.56) | -0.07 |
| calme · atrLen | 1.66 (24) | 1.65 (27) | 1.63 (29) | 1.60 (32) | 1.59 (33) | 1.60 (36) | -0.01 |
| calme · atrStopMult | 1.58 (2.64) | 1.54 (2.97) | 1.58 (3.135) | 1.62 (3.465) | 1.63 (3.63) | 1.57 (3.96) | -0.06 |
| calme · atrTrailMult | 1.60 (40) | 1.58 (45) | 1.60 (47.5) | 1.60 (52.5) | 1.59 (55) | 1.57 (60) | -0.03 |
| agité · volWin | 1.57 (120) | 1.56 (135) | 1.61 (143) | 1.58 (158) | 1.57 (165) | 1.56 (180) | -0.05 |
| agité · kMain | 1.52 (1.92) | 1.61 (2.16) | 1.61 (2.28) | 1.61 (2.52) | 1.61 (2.64) | 1.61 (2.88) | -0.09 |
| agité · kMicro | 1.46 (1.76) | 1.47 (1.98) | 1.48 (2.09) | 1.62 (2.31) | 1.60 (2.42) | 1.60 (2.64) | -0.15 |
| agité · rangeWin | 1.63 (40) | 1.62 (45) | 1.61 (48) | 1.61 (53) | 1.62 (55) | 1.62 (60) | 0.00 |
| agité · wickThr | 1.61 (0.36) | 1.61 (0.405) | 1.61 (0.4275) | 1.61 (0.4725) | 1.61 (0.495) | 1.61 (0.54) | aucun effet |
| agité · htfEmaLen | 1.54 (52) | 1.63 (59) | 1.60 (62) | 1.61 (68) | 1.60 (72) | 1.56 (78) | -0.07 |
| agité · volZWin | 1.61 (20) | 1.61 (23) | 1.61 (24) | 1.61 (26) | 1.61 (28) | 1.61 (30) | 0.00 |
| agité · volZThr | 1.61 (-0.7) | 1.61 (-0.6) | 1.61 (-0.55) | 1.61 (-0.45) | 1.61 (-0.4) | 1.61 (-0.3) | aucun effet |
| agité · atrLen | 1.59 (18) | 1.60 (20) | 1.61 (21) | 1.60 (23) | 1.61 (24) | 1.61 (26) | -0.02 |
| agité · atrStopMult | 1.63 (0.88) | 1.61 (0.99) | 1.60 (1.045) | 1.64 (1.155) | 1.63 (1.21) | 1.64 (1.32) | -0.00 |
| agité · atrTrailMult | 1.63 (2.56) | 1.62 (2.88) | 1.60 (3.04) | 1.62 (3.36) | 1.67 (3.52) | 1.62 (3.84) | -0.01 |
| agité · tp1AtrMult | 1.60 (0.72) | 1.61 (0.81) | 1.61 (0.855) | 1.60 (0.945) | 1.60 (0.99) | 1.61 (1.08) | -0.00 |
| agité · tp1QtyPct | 1.60 (16) | 1.61 (18) | 1.61 (19) | 1.61 (21) | 1.61 (22) | 1.61 (24) | -0.00 |
| calme · lamEmaWin | 1.59 (120) | 1.61 (135) | 1.60 (143) | 1.56 (158) | 1.56 (165) | 1.57 (180) | -0.05 |
| calme · lamNormWin | 1.60 (240) | 1.61 (270) | 1.61 (285) | 1.61 (315) | 1.61 (330) | 1.60 (360) | -0.01 |
| calme · longLamPct | 1.59 (44) | 1.60 (49.5) | 1.61 (52.25) | 1.56 (57.75) | 1.57 (60.5) | 1.59 (66) | -0.05 |
| calme · htfSlopeBars | 1.58 (2) | 1.61 (3) | 1.61 (3) | 1.61 (3) | 1.61 (3) | 1.56 (4) | -0.04 |
| agité · lamEmaWin | 1.58 (120) | 1.59 (135) | 1.61 (143) | 1.59 (158) | 1.59 (165) | 1.59 (180) | -0.02 |
| agité · lamNormWin | 1.57 (240) | 1.56 (270) | 1.60 (285) | 1.58 (315) | 1.58 (330) | 1.58 (360) | -0.05 |
| agité · longLamPct | 1.57 (44) | 1.58 (49.5) | 1.60 (52.25) | 1.58 (57.75) | 1.54 (60.5) | 1.56 (66) | -0.06 |
| agité · htfSlopeBars | 1.59 (2) | 1.61 (3) | 1.61 (3) | 1.61 (3) | 1.61 (3) | 1.63 (4) | -0.01 |

## Quels réglages comptent · voisins à ±20 %

Corrélation de rang (Spearman) entre l'écart de chaque réglage et le résultat 2017–2026, sur les voisins aléatoires à ±20 %. Positive : augmenter le réglage améliore le résultat. Proche de 0 : le réglage ne pèse presque pas dans cette zone.

| régime · réglage | Sharpe | CAGR | Max DD |
| --- | --- | --- | --- |
| agité · kMicro | 0.35 | 0.31 | 0.05 |
| calme · kMain | 0.27 | 0.31 | 0.13 |
| agité · atrLen | -0.18 | -0.18 | -0.21 |
| agité · rangeWin | 0.15 | 0.13 | 0.10 |
| calme · rangeWin | 0.12 | 0.16 | -0.05 |
| calme · volZWin | -0.10 | -0.10 | -0.03 |
| calme · atrTrailMult | 0.07 | 0.11 | -0.10 |
| agité · atrStopMult | 0.06 | 0.07 | 0.37 |
| calme · wickThr | -0.06 | 0.01 | -0.03 |
| agité · volZWin | -0.06 | -0.05 | -0.04 |
| calme · atrStopMult | 0.06 | 0.21 | -0.27 |
| agité · volZThr | 0.05 | 0.04 | 0.02 |
| agité · volWin | -0.04 | -0.02 | -0.03 |
| agité · htfEmaLen | -0.04 | -0.04 | -0.05 |
| agité · wickThr | 0.03 | 0.03 | -0.05 |
| agité · tp1QtyPct | -0.03 | -0.02 | -0.06 |
| calme · atrLen | 0.03 | -0.02 | 0.03 |
| agité · tp1AtrMult | -0.02 | -0.03 | -0.03 |
| calme · htfEmaLen | 0.02 | -0.04 | 0.04 |
| calme · volZThr | -0.02 | -0.06 | -0.05 |
| agité · kMain | -0.02 | -0.01 | 0.01 |
| agité · atrTrailMult | 0.01 | 0.04 | -0.00 |
| calme · volWin | 0.00 | 0.01 | 0.01 |

## Cartes · Sharpe 2017–2026

Grilles 9 × 9 de −20 % à +20 % (pas de 5 %), les autres réglages au préréglage. Le préréglage est au centre, entre crochets.

### calme · atrStopMult (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 46 % · le préréglage bat 95 % des autres cases · anneau ±10 % : médiane 1.48, minimum 1.36.

| atrStopMult \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.64 | 1.37 | 1.35 | 1.44 | 1.56 | 1.58 | 1.43 | 1.46 | 1.42 | 1.51 |
| 2.805 | 1.34 | 1.33 | 1.41 | 1.55 | 1.58 | 1.41 | 1.45 | 1.41 | 1.51 |
| 2.97 | 1.34 | 1.32 | 1.40 | 1.55 | 1.54 | 1.36 | 1.42 | 1.37 | 1.52 |
| 3.135 | 1.33 | 1.31 | 1.42 | 1.57 | 1.58 | 1.38 | 1.45 | 1.41 | 1.53 |
| 3.3 | 1.33 | 1.31 | 1.44 | 1.59 | [1.61] | 1.43 | 1.48 | 1.39 | 1.50 |
| 3.465 | 1.35 | 1.33 | 1.44 | 1.59 | 1.62 | 1.44 | 1.50 | 1.41 | 1.52 |
| 3.63 | 1.35 | 1.35 | 1.49 | 1.61 | 1.63 | 1.44 | 1.51 | 1.44 | 1.50 |
| 3.795 | 1.40 | 1.36 | 1.51 | 1.64 | 1.61 | 1.43 | 1.49 | 1.40 | 1.47 |
| 3.96 | 1.36 | 1.32 | 1.47 | 1.59 | 1.57 | 1.40 | 1.46 | 1.38 | 1.44 |

### calme · kMain (lignes) × calme · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 46 % · le préréglage bat 99 % des autres cases · anneau ±10 % : médiane 1.45, minimum 1.37.

| kMain \ volWin | 104 | 111 | 117 | 124 | 130 | 137 | 143 | 150 | 156 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.32 | 1.35 | 1.44 | 1.41 | 1.40 | 1.33 | 1.31 | 1.24 | 1.29 | 1.37 |
| 2.465 | 1.27 | 1.46 | 1.34 | 1.32 | 1.31 | 1.30 | 1.28 | 1.32 | 1.33 |
| 2.61 | 1.47 | 1.42 | 1.37 | 1.44 | 1.44 | 1.42 | 1.42 | 1.46 | 1.40 |
| 2.755 | 1.30 | 1.39 | 1.52 | 1.53 | 1.59 | 1.62 | 1.54 | 1.46 | 1.45 |
| 2.9 | 1.39 | 1.40 | 1.53 | 1.52 | [1.61] | 1.54 | 1.48 | 1.47 | 1.51 |
| 3.045 | 1.41 | 1.38 | 1.49 | 1.45 | 1.43 | 1.41 | 1.44 | 1.49 | 1.54 |
| 3.19 | 1.51 | 1.46 | 1.42 | 1.38 | 1.48 | 1.41 | 1.43 | 1.49 | 1.40 |
| 3.335 | 1.52 | 1.56 | 1.59 | 1.54 | 1.39 | 1.33 | 1.40 | 1.51 | 1.48 |
| 3.48 | 1.33 | 1.31 | 1.41 | 1.49 | 1.50 | 1.52 | 1.53 | 1.56 | 1.51 |

### agité · atrStopMult (lignes) × agité · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 34 % des autres cases · anneau ±10 % : médiane 1.61, minimum 1.60.

| atrStopMult \ kMain | 1.92 | 2.04 | 2.16 | 2.28 | 2.4 | 2.52 | 2.64 | 2.76 | 2.88 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0.88 | 1.56 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 |
| 0.935 | 1.53 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 |
| 0.99 | 1.54 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 | 1.61 |
| 1.045 | 1.53 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 | 1.60 |
| 1.1 | 1.52 | 1.61 | 1.61 | 1.61 | [1.61] | 1.61 | 1.61 | 1.61 | 1.61 |
| 1.155 | 1.55 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 |
| 1.21 | 1.57 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 | 1.63 |
| 1.265 | 1.59 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 |
| 1.32 | 1.61 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 | 1.64 |

### agité · atrTrailMult (lignes) × agité · atrStopMult (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 9 % des autres cases · anneau ±10 % : médiane 1.63, minimum 1.60.

| atrTrailMult \ atrStopMult | 0.88 | 0.935 | 0.99 | 1.045 | 1.1 | 1.155 | 1.21 | 1.265 | 1.32 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2.56 | 1.63 | 1.64 | 1.64 | 1.63 | 1.63 | 1.64 | 1.63 | 1.64 | 1.65 |
| 2.72 | 1.62 | 1.63 | 1.63 | 1.62 | 1.62 | 1.66 | 1.66 | 1.66 | 1.67 |
| 2.88 | 1.61 | 1.61 | 1.62 | 1.62 | 1.62 | 1.65 | 1.65 | 1.66 | 1.67 |
| 3.04 | 1.62 | 1.59 | 1.60 | 1.60 | 1.60 | 1.63 | 1.62 | 1.64 | 1.64 |
| 3.2 | 1.63 | 1.60 | 1.61 | 1.60 | [1.61] | 1.64 | 1.63 | 1.64 | 1.64 |
| 3.36 | 1.63 | 1.60 | 1.62 | 1.62 | 1.62 | 1.65 | 1.64 | 1.65 | 1.65 |
| 3.52 | 1.65 | 1.65 | 1.67 | 1.67 | 1.67 | 1.70 | 1.69 | 1.70 | 1.71 |
| 3.68 | 1.62 | 1.62 | 1.63 | 1.63 | 1.63 | 1.66 | 1.66 | 1.67 | 1.67 |
| 3.84 | 1.61 | 1.61 | 1.62 | 1.62 | 1.62 | 1.65 | 1.65 | 1.65 | 1.65 |

### agité · kMain (lignes) × agité · volWin (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 100 % · le préréglage bat 86 % des autres cases · anneau ±10 % : médiane 1.58, minimum 1.56.

| kMain \ volWin | 120 | 128 | 135 | 143 | 150 | 158 | 165 | 173 | 180 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.55 | 1.55 | 1.51 | 1.51 | 1.52 | 1.50 | 1.52 | 1.56 | 1.56 |
| 2.04 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.16 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.28 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.4 | 1.57 | 1.59 | 1.56 | 1.61 | [1.61] | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.52 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.64 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.76 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |
| 2.88 | 1.57 | 1.59 | 1.56 | 1.61 | 1.61 | 1.58 | 1.57 | 1.57 | 1.56 |

### agité · kMain (lignes) × calme · kMain (colonnes)

Cases à au moins 90 % du Sharpe du préréglage : 42 % · le préréglage bat 96 % des autres cases · anneau ±10 % : médiane 1.48, minimum 1.43.

| kMain \ kMain | 2.32 | 2.465 | 2.61 | 2.755 | 2.9 | 3.045 | 3.19 | 3.335 | 3.48 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.92 | 1.24 | 1.22 | 1.35 | 1.50 | 1.52 | 1.34 | 1.39 | 1.30 | 1.41 |
| 2.04 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.16 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.28 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.4 | 1.33 | 1.31 | 1.44 | 1.59 | [1.61] | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.52 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.64 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.76 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |
| 2.88 | 1.33 | 1.31 | 1.44 | 1.59 | 1.61 | 1.43 | 1.48 | 1.39 | 1.50 |

## Méthode

- Une configuration = une simulation complète du moteur (mêmes fonctions que le backtest et le bot), régime calme ou agité choisi chaque jour à partir des seuls jours clos, comme en réel. Seuls les réglages changent.
- Les sous-périodes découpent cette même simulation : elles héritent de la position et du capital en cours au 1er janvier.
- Sharpe et Sortino : rendements par bougie de 15 min, annualisés. CAGR et Max DD : sur la courbe de capital. Profit factor plafonné à 99 quand il n'y a aucune perte.
- Tirages reproductibles (graine 7). Données complètes (chaque configuration, chaque sous-période) dans `shock-15m-robustness-local.json`.
