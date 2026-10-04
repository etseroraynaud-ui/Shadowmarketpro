# Shock Engine · BTC/USD 5 min · diagnostic

Période 2017-01-01 → 2026-10-04 (Bitstamp). Échantillon / hors échantillon séparés au 2022-01-01.
Coûts « script » : commission 0.02 % par ordre, glissement 1 tick. Coûts « réalistes » : commission 0.05 % + 0.01 % de glissement par ordre.

## 1. Résultat du script tel quel

| coûts | rendement | CAGR | max DD | Sharpe | PF | positions | par jour | moyenne / position |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| script | -100 % | -46.1 % | -100 % | -2.55 | 0.67 | 10684 | 3.00 | -0.054 % |
| réalistes | -100 % | -76.8 % | -100 % | -6.11 | 0.50 | 10661 | 2.99 | -0.131 % |
| nuls | -82 % | -16.3 % | -90 % | -0.66 | 0.86 | 10684 | 3.00 | -0.014 % |

« nuls » = sans aucun frais : c'est l'edge brut du signal, avant coûts.

## 2. Par année

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2017 | 1033 | 37 % | -0.181 % | 0.58 | -0.367 | -187 % |
| 2018 | 1116 | 44 % | -0.032 % | 0.90 | -0.144 | -36 % |
| 2019 | 855 | 42 % | -0.029 % | 0.87 | -0.194 | -25 % |
| 2020 | 989 | 41 % | -0.062 % | 0.79 | -0.267 | -61 % |
| 2021 | 1153 | 45 % | -0.080 % | 0.75 | -0.145 | -92 % |
| 2022 | 1205 | 43 % | -0.031 % | 0.86 | -0.212 | -38 % |
| 2023 | 1046 | 41 % | -0.026 % | 0.80 | -0.386 | -28 % |
| 2024 | 1151 | 43 % | -0.046 % | 0.75 | -0.281 | -53 % |
| 2025 | 1249 | 44 % | -0.037 % | 0.74 | -0.341 | -46 % |
| 2026 | 887 | 46 % | -0.015 % | 0.89 | -0.194 | -14 % |

## 3. Sens et type de signal

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · IMP | 632 | 45 % | -0.009 % | 0.82 | -0.048 | -6 % |
| long · μIMP | 563 | 38 % | -0.128 % | 0.57 | -0.418 | -72 % |
| short · IMP | 4665 | 43 % | -0.053 % | 0.61 | -0.218 | -247 % |
| short · μIMP | 4824 | 43 % | -0.053 % | 0.74 | -0.298 | -255 % |

## 4. Session et heure (UTC)

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · Asie (0-7 h) | 2749 | 43 % | -0.032 % | 0.69 | -0.177 | -88 % |
| 2 · Europe (7-13 h) | 2820 | 42 % | -0.058 % | 0.69 | -0.362 | -163 % |
| 3 · États-Unis (13-21 h) | 3995 | 43 % | -0.062 % | 0.65 | -0.226 | -250 % |
| 4 · soirée (21-24 h) | 1120 | 41 % | -0.071 % | 0.62 | -0.274 | -79 % |

| heure | positions | moyenne | PF |
| --- | ---: | ---: | ---: |
| 0 h | 549 | -0.026 % | 0.76 |
| 1 h | 445 | 0.011 % | 0.66 |
| 2 h | 355 | 0.024 % | 0.88 |
| 3 h | 325 | -0.045 % | 0.90 |
| 4 h | 312 | -0.038 % | 0.57 |
| 5 h | 347 | -0.073 % | 0.64 |
| 6 h | 416 | -0.085 % | 0.48 |
| 7 h | 435 | -0.070 % | 0.46 |
| 8 h | 450 | -0.057 % | 0.95 |
| 9 h | 495 | -0.041 % | 0.59 |
| 10 h | 445 | -0.071 % | 0.55 |
| 11 h | 441 | -0.050 % | 0.68 |
| 12 h | 554 | -0.059 % | 1.00 |
| 13 h | 725 | -0.038 % | 1.01 |
| 14 h | 682 | -0.015 % | 0.42 |
| 15 h | 512 | -0.076 % | 0.46 |
| 16 h | 478 | -0.095 % | 0.56 |
| 17 h | 387 | -0.050 % | 0.85 |
| 18 h | 392 | -0.132 % | 0.60 |
| 19 h | 399 | -0.069 % | 0.61 |
| 20 h | 420 | -0.069 % | 0.60 |
| 21 h | 358 | -0.041 % | 0.78 |
| 22 h | 388 | -0.159 % | 0.32 |
| 23 h | 374 | -0.007 % | 0.74 |

Minute d'entrée des longs (pente du filtre 60 min) :

| minute | longs | moyenne |
| --- | ---: | ---: |
| :00 | 467 | -0.093 % |
| :05 | 355 | -0.017 % |
| :55 | 373 | -0.075 % |

## 5. Régimes de marché à l'entrée

Volatilité (ATR / prix, rapportée à sa moyenne sur 30 jours) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · basse · long | 407 | 38 % | -0.053 % | 0.75 | -0.402 | -22 % |
| 1 · basse · short | 3295 | 40 % | -0.042 % | 0.63 | -0.442 | -139 % |
| 2 · normale · long | 408 | 44 % | -0.043 % | 0.66 | -0.118 | -18 % |
| 2 · normale · short | 3225 | 45 % | -0.031 % | 0.82 | -0.166 | -101 % |
| 3 · haute · long | 380 | 43 % | -0.101 % | 0.64 | -0.142 | -39 % |
| 3 · haute · short | 2969 | 44 % | -0.088 % | 0.62 | -0.155 | -261 % |

Tendance de fond (prix contre moyenne 200 en 60 min) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baissière · long | 183 | 41 % | -0.100 % | 0.67 | -0.458 | -18 % |
| baissière · short | 6652 | 44 % | -0.050 % | 0.70 | -0.221 | -334 % |
| haussière · long | 1012 | 42 % | -0.059 % | 0.68 | -0.180 | -59 % |
| haussière · short | 2837 | 40 % | -0.059 % | 0.59 | -0.347 | -168 % |

Percentile de lambda (intensité des chocs) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · < 25 · short | 1793 | 43 % | -0.048 % | 0.81 | -0.310 | -86 % |
| 2 · 25-50 · short | 2081 | 40 % | -0.077 % | 0.71 | -0.413 | -160 % |
| 3 · 50-75 · long | 426 | 42 % | -0.055 % | 0.60 | -0.253 | -23 % |
| 3 · 50-75 · short | 2327 | 43 % | -0.034 % | 0.62 | -0.224 | -80 % |
| 4 · ≥ 75 · long | 769 | 42 % | -0.070 % | 0.71 | -0.206 | -54 % |
| 4 · ≥ 75 · short | 3288 | 44 % | -0.054 % | 0.62 | -0.157 | -177 % |

## 6. Timing des entrées : trajectoire moyenne du prix autour du signal

Mouvement du prix depuis la clôture du signal, en ATR, dans le sens du trade (positif = favorable). Les valeurs négatives de k montrent ce qui s'est passé avant le signal.

| barres k | longs moyenne (n=1195) | longs médiane | longs % > 0 | shorts moyenne (n=9489) | shorts médiane | shorts % > 0 | toutes barres, hausse moyenne |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -24 | -4.64 | -4.45 | 2 % | -3.76 | -3.63 | 2 % | -0.13 |
| -20 | -4.51 | -4.20 | 0 % | -3.77 | -3.56 | 0 % | -0.11 |
| -16 | -4.34 | -4.09 | 0 % | -3.65 | -3.42 | 0 % | -0.08 |
| -12 | -4.03 | -3.77 | 0 % | -3.44 | -3.25 | 0 % | -0.06 |
| -8 | -3.58 | -3.30 | 0 % | -3.13 | -2.95 | 0 % | -0.03 |
| -4 | -2.74 | -2.56 | 0 % | -2.61 | -2.43 | 0 % | -0.02 |
| 0 | 0.00 | 0.00 | 0 % | 0.00 | 0.00 | 0 % | 0.00 |
| 1 | -0.02 | -0.15 | 42 % | -0.06 | -0.18 | 42 % | 0.00 |
| 2 | -0.01 | -0.18 | 45 % | -0.07 | -0.22 | 42 % | 0.00 |
| 3 | -0.00 | -0.28 | 42 % | -0.07 | -0.26 | 42 % | 0.01 |
| 4 | -0.00 | -0.31 | 43 % | -0.07 | -0.30 | 42 % | 0.01 |
| 5 | 0.03 | -0.32 | 43 % | -0.08 | -0.35 | 42 % | 0.01 |
| 6 | 0.00 | -0.32 | 42 % | -0.09 | -0.38 | 41 % | 0.02 |
| 7 | 0.01 | -0.34 | 42 % | -0.10 | -0.40 | 42 % | 0.02 |
| 8 | 0.03 | -0.34 | 43 % | -0.11 | -0.42 | 42 % | 0.02 |
| 9 | 0.02 | -0.38 | 43 % | -0.09 | -0.42 | 42 % | 0.02 |
| 10 | 0.01 | -0.43 | 43 % | -0.09 | -0.45 | 42 % | 0.03 |
| 11 | 0.03 | -0.39 | 43 % | -0.09 | -0.46 | 42 % | 0.03 |
| 12 | 0.11 | -0.42 | 42 % | -0.07 | -0.45 | 42 % | 0.04 |
| 18 | 0.18 | -0.27 | 46 % | -0.10 | -0.59 | 42 % | 0.05 |
| 24 | 0.24 | -0.27 | 46 % | -0.12 | -0.64 | 42 % | 0.07 |
| 30 | 0.33 | -0.11 | 49 % | -0.13 | -0.71 | 42 % | 0.08 |
| 36 | 0.42 | -0.08 | 49 % | -0.13 | -0.73 | 42 % | 0.10 |
| 42 | 0.50 | -0.21 | 48 % | -0.11 | -0.75 | 43 % | 0.12 |
| 48 | 0.49 | -0.24 | 48 % | -0.11 | -0.84 | 42 % | 0.14 |

Dernière colonne : mouvement moyen du prix après une barre quelconque (dérive du marché). Un long n'a d'edge que s'il fait mieux que cette colonne ; un short, que s'il fait mieux que son opposé.

## 7. Sorties

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · FLIP | 1 | 0 % | -0.488 % | 0.00 | -1.137 | -0 % |
| long · SL | 611 | 0 % | -0.483 % | 0.00 | -1.808 | -295 % |
| long · TP1+SL | 81 | 0 % | -0.078 % | 0.00 | -0.408 | -6 % |
| long · TP1+TRAIL | 502 | 99 % | 0.447 % | 52865.84 | 1.739 | 224 % |
| short · FLIP | 4 | 0 % | -0.349 % | 0.00 | -1.277 | -1 % |
| short · SL | 4670 | 0 % | -0.500 % | 0.00 | -1.858 | -2336 % |
| short · TP1+SL | 726 | 0 % | -0.085 % | 0.00 | -0.379 | -62 % |
| short · TP1+TRAIL | 4089 | 99 % | 0.464 % | 50201.31 | 1.591 | 1897 % |

- Positions perdantes passées d'abord par +1 ATR de gain : 27 % ; par +0,5 ATR : 50 %.
- Positions gagnantes allées jusqu'à -1 ATR avant de gagner : 27 %.
- Meilleure excursion moyenne : 1.99 ATR ; pire excursion moyenne : -1.22 ATR.
- Durée moyenne : 6.7 barres.

## 8. Variantes (une modification à la fois)

Même période, coûts du script. « Éch. » = jusqu'au 2021-12-31, « hors éch. » = ensuite : une variante qui n'améliore que l'une des deux moitiés est suspecte.

| variante | rendement | Sharpe | max DD | positions | moyenne | Sharpe éch. | Sharpe hors éch. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -100 % | -2.55 | -100 % | 10684 | -0.054 % | -2.73 | -2.59 |
| Pente 60 min corrigée (3 barres de 60 min) | -100 % | -2.68 | -100 % | 12716 | -0.051 % | -2.89 | -2.68 |
| Longs seulement | -55 % | -1.18 | -58 % | 1196 | -0.064 % | -1.77 | -0.27 |
| Shorts seulement | -99 % | -2.31 | -99 % | 9490 | -0.053 % | -2.34 | -2.67 |
| Sans micro-chocs | -96 % | -1.59 | -96 % | 6284 | -0.048 % | -1.92 | -1.16 |
| Sans flip exit | -100 % | -2.55 | -100 % | 10683 | -0.054 % | -2.74 | -2.59 |
| Sans TP1 | -100 % | -1.95 | -100 % | 10692 | -0.052 % | -2.37 | -1.38 |
| Sans stop suiveur | -91 % | -0.69 | -93 % | 4394 | -0.048 % | -1.00 | -0.20 |
| Stop 2,5 ATR | -100 % | -2.05 | -100 % | 9866 | -0.055 % | -2.13 | -2.22 |
| Mode normal (sans High Activity) | -99 % | -2.38 | -99 % | 9610 | -0.053 % | -2.60 | -2.29 |
| Sans filtre de volume | -100 % | -2.84 | -100 % | 12505 | -0.053 % | -2.90 | -3.16 |
| Sans filtre 60 min pour les shorts | -100 % | -3.87 | -100 % | 15638 | -0.064 % | -4.45 | -3.31 |
| Cooldown 12 barres | -99 % | -2.29 | -99 % | 9551 | -0.049 % | -2.35 | -2.49 |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -98 % | -1.76 | -98 % | 7888 | -0.046 % | -1.94 | -1.68 |
| Longs seuls, sans stop suiveur | 361 % | 0.86 | -34 % | 715 | 0.261 % | 1.11 | 0.51 |
| Fade activé (impulse + fade) | -100 % | -5.11 | -100 % | 41247 | -0.035 % | -4.08 | -8.11 |
| Fade seulement | -100 % | -5.20 | -100 % | 32531 | -0.028 % | -3.20 | -10.15 |
| Fade seulement, longs | -100 % | -4.21 | -100 % | 19400 | -0.030 % | -2.76 | -7.89 |

## 9. Face au hasard

Pour chaque variante : 1 000 tirages de positions placées au hasard, avec le même nombre de positions, les mêmes durées, le même sens et les mêmes frais (entrée et sortie à la clôture). Sur le BTC, des longs au hasard gagnent déjà grâce à la hausse de fond : une variante n'a un vrai timing que si elle bat largement ces tirages.

| variante | stratégie (positions composées) | hasard médian | hasard 95e centile | tirages battus |
| --- | ---: | ---: | ---: | ---: |
| Script tel quel | -100 % | -99 % | -98 % | 2.5 % |
| Pente 60 min corrigée (3 barres de 60 min) | -100 % | -100 % | -99 % | 3.3 % |
| Longs seulement | -55 % | -36 % | -9 % | 3.8 % |
| Shorts seulement | -99 % | -99 % | -97 % | 5.1 % |
| Sans micro-chocs | -96 % | -94 % | -88 % | 21.0 % |
| Sans flip exit | -100 % | -99 % | -98 % | 1.4 % |
| Sans TP1 | -100 % | -99 % | -98 % | 2.7 % |
| Sans stop suiveur | -91 % | -100 % | -96 % | 98.5 % |
| Stop 2,5 ATR | -100 % | -99 % | -97 % | 11.4 % |
| Mode normal (sans High Activity) | -99 % | -99 % | -97 % | 4.8 % |
| Sans filtre de volume | -100 % | -100 % | -99 % | 2.8 % |
| Sans filtre 60 min pour les shorts | -100 % | -100 % | -100 % | 0.0 % |
| Cooldown 12 barres | -99 % | -99 % | -96 % | 17.0 % |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -98 % | -97 % | -93 % | 28.2 % |
| Longs seuls, sans stop suiveur | 361 % | 214 % | 1787 % | 62.7 % |
| Fade activé (impulse + fade) | -100 % | -100 % | -100 % | 99.8 % |
| Fade seulement | -100 % | -100 % | -100 % | 100.0 % |
| Fade seulement, longs | -100 % | -100 % | -100 % | 99.9 % |

## 10. Timing des entrées, à sorties identiques

Le test le plus juste : on garde exactement les mêmes règles de sortie (stop, TP1, stop suiveur, flip, cooldown) et on remplace seulement les signaux d'entrée par des barres tirées au hasard, en même nombre et du même sens. 100 tirages par variante.

| variante | Sharpe stratégie | Sharpe hasard médian | Sharpe hasard 95e centile | tirages battus | rendement stratégie | rendement hasard médian |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -2.55 | -2.41 | -1.94 | 32 % | -100 % | -99 % |
| Longs seulement | -1.18 | -0.91 | -0.40 | 19 % | -55 % | -43 % |
| Longs seuls, sans stop suiveur | 0.86 | 0.45 | 0.93 | 91 % | 361 % | 94 % |

Au-dessus de 95 % de tirages battus, le signal d'entrée apporte quelque chose. Autour de 50 %, la performance vient des sorties et de la tendance du marché, pas du moment d'entrée.

