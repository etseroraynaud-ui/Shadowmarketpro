# Shock Engine · BTC/USD 15 min · diagnostic

Période 2017-01-01 → 2026-10-04 (Bitstamp). Échantillon / hors échantillon séparés au 2022-01-01.
Coûts « script » : commission 0.02 % par ordre, glissement 1 tick. Coûts « réalistes » : commission 0.05 % + 0.01 % de glissement par ordre.

## 1. Résultat du script tel quel

| coûts | rendement | CAGR | max DD | Sharpe | PF | positions | par jour | moyenne / position |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| script | -83 % | -16.6 % | -85 % | -0.59 | 0.90 | 4883 | 1.37 | -0.030 % |
| réalistes | -100 % | -43.6 % | -100 % | -2.12 | 0.74 | 4881 | 1.37 | -0.108 % |
| nuls | 21 % | 1.9 % | -67 % | 0.20 | 1.01 | 4883 | 1.37 | 0.010 % |

« nuls » = sans aucun frais : c'est l'edge brut du signal, avant coûts.

## 2. Par année

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2017 | 503 | 43 % | -0.144 % | 0.75 | -0.138 | -72 % |
| 2018 | 502 | 45 % | 0.040 % | 1.06 | -0.001 | 20 % |
| 2019 | 400 | 48 % | 0.065 % | 1.14 | 0.173 | 26 % |
| 2020 | 484 | 43 % | -0.106 % | 0.78 | -0.127 | -51 % |
| 2021 | 526 | 44 % | -0.080 % | 0.83 | -0.062 | -42 % |
| 2022 | 550 | 46 % | 0.006 % | 1.01 | -0.002 | 3 % |
| 2023 | 461 | 41 % | -0.020 % | 0.91 | -0.191 | -9 % |
| 2024 | 527 | 48 % | 0.003 % | 1.00 | 0.040 | 2 % |
| 2025 | 516 | 47 % | -0.011 % | 0.95 | -0.077 | -5 % |
| 2026 | 414 | 42 % | -0.047 % | 0.82 | -0.134 | -19 % |

## 3. Sens et type de signal

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · IMP | 621 | 49 % | 0.055 % | 1.12 | 0.107 | 34 % |
| long · μIMP | 490 | 46 % | 0.014 % | 1.06 | 0.070 | 7 % |
| short · IMP | 2012 | 46 % | -0.015 % | 0.92 | -0.011 | -31 % |
| short · μIMP | 1760 | 42 % | -0.090 % | 0.76 | -0.191 | -159 % |

## 4. Session et heure (UTC)

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · Asie (0-7 h) | 1181 | 45 % | -0.014 % | 0.92 | 0.037 | -16 % |
| 2 · Europe (7-13 h) | 1225 | 45 % | -0.000 % | 1.02 | -0.059 | -0 % |
| 3 · États-Unis (13-21 h) | 1947 | 45 % | -0.041 % | 0.85 | -0.089 | -80 % |
| 4 · soirée (21-24 h) | 530 | 43 % | -0.099 % | 0.74 | -0.103 | -52 % |

| heure | positions | moyenne | PF |
| --- | ---: | ---: | ---: |
| 0 h | 238 | -0.027 % | 0.93 |
| 1 h | 217 | -0.004 % | 0.94 |
| 2 h | 169 | 0.163 % | 1.48 |
| 3 h | 142 | -0.054 % | 0.82 |
| 4 h | 136 | -0.033 % | 0.80 |
| 5 h | 122 | -0.112 % | 0.72 |
| 6 h | 157 | -0.069 % | 0.78 |
| 7 h | 199 | -0.007 % | 0.80 |
| 8 h | 215 | 0.019 % | 0.98 |
| 9 h | 209 | 0.067 % | 1.13 |
| 10 h | 174 | -0.057 % | 0.95 |
| 11 h | 187 | -0.069 % | 0.96 |
| 12 h | 241 | 0.025 % | 1.32 |
| 13 h | 329 | -0.079 % | 0.81 |
| 14 h | 352 | -0.026 % | 0.78 |
| 15 h | 287 | -0.061 % | 0.75 |
| 16 h | 239 | 0.018 % | 0.98 |
| 17 h | 201 | 0.021 % | 1.09 |
| 18 h | 171 | 0.024 % | 1.23 |
| 19 h | 194 | -0.064 % | 0.78 |
| 20 h | 174 | -0.159 % | 0.61 |
| 21 h | 167 | -0.153 % | 0.63 |
| 22 h | 171 | -0.119 % | 0.60 |
| 23 h | 192 | -0.034 % | 0.98 |

Minute d'entrée des longs (pente du filtre 60 min) :

| minute | longs | moyenne |
| --- | ---: | ---: |
| :00 | 371 | -0.029 % |
| :15 | 334 | 0.067 % |
| :45 | 406 | 0.072 % |

## 5. Régimes de marché à l'entrée

Volatilité (ATR / prix, rapportée à sa moyenne sur 30 jours) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · basse · long | 338 | 46 % | 0.064 % | 1.38 | 0.063 | 22 % |
| 1 · basse · short | 1166 | 42 % | -0.042 % | 0.80 | -0.190 | -49 % |
| 2 · normale · long | 447 | 48 % | 0.042 % | 1.11 | 0.120 | 19 % |
| 2 · normale · short | 1462 | 45 % | -0.027 % | 0.97 | -0.048 | -39 % |
| 3 · haute · long | 326 | 47 % | 0.001 % | 0.92 | 0.078 | 0 % |
| 3 · haute · short | 1144 | 44 % | -0.089 % | 0.79 | -0.058 | -102 % |

Tendance de fond (prix contre moyenne 200 en 60 min) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baissière · long | 152 | 45 % | -0.065 % | 0.75 | -0.061 | -10 % |
| baissière · short | 2662 | 44 % | -0.047 % | 0.86 | -0.087 | -125 % |
| haussière · long | 959 | 48 % | 0.053 % | 1.16 | 0.114 | 51 % |
| haussière · short | 1110 | 43 % | -0.058 % | 0.83 | -0.115 | -65 % |

Percentile de lambda (intensité des chocs) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · < 25 · short | 767 | 44 % | -0.055 % | 0.82 | -0.209 | -42 % |
| 2 · 25-50 · short | 766 | 42 % | -0.107 % | 0.67 | -0.205 | -82 % |
| 3 · 50-75 · long | 444 | 47 % | -0.032 % | 0.86 | 0.030 | -14 % |
| 3 · 50-75 · short | 864 | 43 % | -0.077 % | 0.83 | -0.114 | -67 % |
| 4 · ≥ 75 · long | 667 | 48 % | 0.082 % | 1.26 | 0.131 | 55 % |
| 4 · ≥ 75 · short | 1375 | 46 % | 0.001 % | 0.97 | 0.042 | 2 % |

## 6. Timing des entrées : trajectoire moyenne du prix autour du signal

Mouvement du prix depuis la clôture du signal, en ATR, dans le sens du trade (positif = favorable). Les valeurs négatives de k montrent ce qui s'est passé avant le signal.

| barres k | longs moyenne (n=1111) | longs médiane | longs % > 0 | shorts moyenne (n=3772) | shorts médiane | shorts % > 0 | toutes barres, hausse moyenne |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -24 | -4.34 | -4.13 | 2 % | -3.40 | -3.25 | 2 % | -0.17 |
| -20 | -4.22 | -4.04 | 0 % | -3.43 | -3.22 | 0 % | -0.14 |
| -16 | -4.04 | -3.83 | 0 % | -3.33 | -3.12 | 0 % | -0.12 |
| -12 | -3.74 | -3.48 | 0 % | -3.15 | -2.97 | 0 % | -0.08 |
| -8 | -3.38 | -3.15 | 0 % | -2.92 | -2.81 | 0 % | -0.06 |
| -4 | -2.84 | -2.64 | 0 % | -2.51 | -2.36 | 0 % | -0.02 |
| 0 | 0.00 | 0.00 | 0 % | 0.00 | 0.00 | 0 % | 0.00 |
| 1 | 0.07 | -0.12 | 45 % | -0.00 | -0.16 | 43 % | 0.00 |
| 2 | 0.11 | -0.10 | 47 % | -0.01 | -0.19 | 44 % | 0.01 |
| 3 | 0.11 | -0.10 | 47 % | -0.01 | -0.21 | 44 % | 0.01 |
| 4 | 0.17 | -0.11 | 47 % | -0.03 | -0.26 | 42 % | 0.01 |
| 5 | 0.18 | -0.05 | 48 % | -0.02 | -0.28 | 44 % | 0.02 |
| 6 | 0.22 | -0.00 | 50 % | -0.02 | -0.28 | 43 % | 0.02 |
| 7 | 0.25 | -0.06 | 49 % | -0.03 | -0.30 | 42 % | 0.03 |
| 8 | 0.20 | -0.09 | 48 % | -0.03 | -0.34 | 42 % | 0.03 |
| 9 | 0.21 | -0.10 | 48 % | -0.05 | -0.38 | 42 % | 0.04 |
| 10 | 0.27 | -0.04 | 49 % | -0.04 | -0.38 | 43 % | 0.05 |
| 11 | 0.28 | -0.01 | 50 % | -0.04 | -0.41 | 43 % | 0.05 |
| 12 | 0.31 | -0.08 | 49 % | -0.03 | -0.41 | 43 % | 0.05 |
| 18 | 0.38 | -0.04 | 49 % | 0.01 | -0.43 | 44 % | 0.08 |
| 24 | 0.43 | -0.00 | 50 % | -0.03 | -0.56 | 43 % | 0.12 |
| 30 | 0.63 | 0.07 | 51 % | -0.05 | -0.53 | 44 % | 0.15 |
| 36 | 0.66 | 0.10 | 51 % | -0.09 | -0.54 | 43 % | 0.18 |
| 42 | 0.65 | 0.06 | 51 % | -0.04 | -0.56 | 45 % | 0.22 |
| 48 | 0.75 | 0.13 | 51 % | -0.00 | -0.59 | 45 % | 0.25 |

Dernière colonne : mouvement moyen du prix après une barre quelconque (dérive du marché). Un long n'a d'edge que s'il fait mieux que cette colonne ; un short, que s'il fait mieux que son opposé.

## 7. Sorties

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · FLIP | 4 | 0 % | -0.587 % | 0.00 | -1.115 | -2 % |
| long · SL | 484 | 0 % | -0.768 % | 0.00 | -1.717 | -372 % |
| long · TP1+SL | 98 | 0 % | -0.107 % | 0.00 | -0.258 | -11 % |
| long · TP1+TRAIL | 525 | 100 % | 0.811 % | ∞ | 1.831 | 426 % |
| short · FLIP | 6 | 0 % | -0.858 % | 0.00 | -1.336 | -5 % |
| short · SL | 1777 | 0 % | -0.854 % | 0.00 | -1.705 | -1518 % |
| short · TP1+SL | 327 | 0 % | -0.123 % | 0.00 | -0.259 | -40 % |
| short · TP1+TRAIL | 1662 | 100 % | 0.827 % | 100079.58 | 1.663 | 1374 % |

- Positions perdantes passées d'abord par +1 ATR de gain : 32 % ; par +0,5 ATR : 57 %.
- Positions gagnantes allées jusqu'à -1 ATR avant de gagner : 25 %.
- Meilleure excursion moyenne : 2.09 ATR ; pire excursion moyenne : -1.19 ATR.
- Durée moyenne : 8.1 barres.

## 8. Variantes (une modification à la fois)

Même période, coûts du script. « Éch. » = jusqu'au 2021-12-31, « hors éch. » = ensuite : une variante qui n'améliore que l'une des deux moitiés est suspecte.

| variante | rendement | Sharpe | max DD | positions | moyenne | Sharpe éch. | Sharpe hors éch. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -83 % | -0.59 | -85 % | 4883 | -0.030 % | -0.74 | -0.37 |
| Pente 60 min corrigée (3 barres de 60 min) | -83 % | -0.59 | -85 % | 4995 | -0.030 % | -0.77 | -0.33 |
| Longs seulement | 57 % | 0.49 | -18 % | 1112 | 0.045 % | 0.53 | 0.46 |
| Shorts seulement | -88 % | -0.85 | -90 % | 3776 | -0.051 % | -0.99 | -0.69 |
| Sans micro-chocs | -1 % | 0.10 | -56 % | 3176 | 0.006 % | -0.02 | 0.35 |
| Sans flip exit | -83 % | -0.59 | -85 % | 4882 | -0.031 % | -0.75 | -0.36 |
| Sans TP1 | -90 % | -0.57 | -92 % | 4887 | -0.037 % | -0.89 | -0.03 |
| Sans stop suiveur | 151 % | 0.46 | -54 % | 2408 | 0.053 % | 0.48 | 0.48 |
| Stop 2,5 ATR | -74 % | -0.33 | -82 % | 4510 | -0.021 % | -0.35 | -0.32 |
| Mode normal (sans High Activity) | -74 % | -0.44 | -77 % | 4452 | -0.024 % | -0.63 | -0.12 |
| Sans filtre de volume | -84 % | -0.62 | -86 % | 5296 | -0.029 % | -0.79 | -0.38 |
| Sans filtre 60 min pour les shorts | -93 % | -0.88 | -94 % | 5938 | -0.040 % | -1.16 | -0.46 |
| Cooldown 12 barres | -62 % | -0.32 | -74 % | 4420 | -0.017 % | -0.33 | -0.33 |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -67 % | -0.37 | -73 % | 3808 | -0.023 % | -0.50 | -0.17 |
| Longs seuls, sans stop suiveur | 1547 % | 1.23 | -38 % | 383 | 0.941 % | 1.58 | 0.73 |
| Fade activé (impulse + fade) | -98 % | -1.13 | -98 % | 13516 | -0.024 % | -0.77 | -1.98 |
| Fade seulement | -94 % | -1.60 | -95 % | 9401 | -0.028 % | -0.82 | -3.18 |
| Fade seulement, longs | -70 % | -0.86 | -72 % | 5577 | -0.020 % | -0.37 | -1.90 |

## 9. Face au hasard

Pour chaque variante : 1 000 tirages de positions placées au hasard, avec le même nombre de positions, les mêmes durées, le même sens et les mêmes frais (entrée et sortie à la clôture). Sur le BTC, des longs au hasard gagnent déjà grâce à la hausse de fond : une variante n'a un vrai timing que si elle bat largement ces tirages.

| variante | stratégie (positions composées) | hasard médian | hasard 95e centile | tirages battus |
| --- | ---: | ---: | ---: | ---: |
| Script tel quel | -83 % | -93 % | -76 % | 86.5 % |
| Pente 60 min corrigée (3 barres de 60 min) | -83 % | -93 % | -74 % | 85.9 % |
| Longs seulement | 57 % | -27 % | 33 % | 97.9 % |
| Shorts seulement | -88 % | -90 % | -72 % | 57.5 % |
| Sans micro-chocs | -1 % | -81 % | -53 % | 99.7 % |
| Sans flip exit | -83 % | -93 % | -78 % | 88.8 % |
| Sans TP1 | -90 % | -92 % | -75 % | 67.6 % |
| Sans stop suiveur | 151 % | -99 % | -86 % | 100.0 % |
| Stop 2,5 ATR | -74 % | -94 % | -77 % | 96.5 % |
| Mode normal (sans High Activity) | -74 % | -91 % | -71 % | 93.6 % |
| Sans filtre de volume | -84 % | -94 % | -80 % | 90.4 % |
| Sans filtre 60 min pour les shorts | -93 % | -96 % | -86 % | 74.9 % |
| Cooldown 12 barres | -62 % | -90 % | -70 % | 98.1 % |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -67 % | -87 % | -64 % | 93.3 % |
| Longs seuls, sans stop suiveur | 1547 % | 973 % | 6014 % | 63.9 % |
| Fade activé (impulse + fade) | -98 % | -100 % | -99 % | 99.6 % |
| Fade seulement | -94 % | -98 % | -95 % | 97.0 % |
| Fade seulement, longs | -70 % | -87 % | -70 % | 95.2 % |

## 10. Timing des entrées, à sorties identiques

Le test le plus juste : on garde exactement les mêmes règles de sortie (stop, TP1, stop suiveur, flip, cooldown) et on remplace seulement les signaux d'entrée par des barres tirées au hasard, en même nombre et du même sens. 100 tirages par variante.

| variante | Sharpe stratégie | Sharpe hasard médian | Sharpe hasard 95e centile | tirages battus | rendement stratégie | rendement hasard médian |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -0.59 | -0.97 | -0.50 | 92 % | -83 % | -90 % |
| Longs seulement | 0.49 | -0.57 | -0.02 | 100 % | 57 % | -47 % |
| Longs seuls, sans stop suiveur | 1.23 | 0.71 | 1.12 | 99 % | 1547 % | 382 % |

Au-dessus de 95 % de tirages battus, le signal d'entrée apporte quelque chose. Autour de 50 %, la performance vient des sorties et de la tendance du marché, pas du moment d'entrée.

