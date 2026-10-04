# Shock Engine · BTC/USD 30 min · diagnostic

Période 2017-01-01 → 2026-10-04 (Bitstamp). Échantillon / hors échantillon séparés au 2022-01-01.
Coûts « script » : commission 0.02 % par ordre, glissement 1 tick. Coûts « réalistes » : commission 0.05 % + 0.01 % de glissement par ordre.

## 1. Résultat du script tel quel

| coûts | rendement | CAGR | max DD | Sharpe | PF | positions | par jour | moyenne / position |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| script | -35 % | -4.3 % | -60 % | -0.04 | 0.97 | 2884 | 0.81 | -0.004 % |
| réalistes | -93 % | -23.8 % | -93 % | -0.92 | 0.84 | 2883 | 0.81 | -0.082 % |
| nuls | 108 % | 7.8 % | -54 % | 0.42 | 1.06 | 2884 | 0.81 | 0.036 % |

« nuls » = sans aucun frais : c'est l'edge brut du signal, avant coûts.

## 2. Par année

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2017 | 285 | 45 % | -0.185 % | 0.76 | 0.011 | -53 % |
| 2018 | 298 | 51 % | 0.153 % | 1.21 | 0.250 | 45 % |
| 2019 | 246 | 47 % | 0.070 % | 1.11 | 0.128 | 17 % |
| 2020 | 280 | 45 % | 0.009 % | 0.99 | -0.004 | 3 % |
| 2021 | 322 | 44 % | -0.104 % | 0.81 | -0.021 | -34 % |
| 2022 | 328 | 44 % | -0.020 % | 0.95 | -0.019 | -7 % |
| 2023 | 282 | 45 % | -0.035 % | 0.89 | -0.006 | -10 % |
| 2024 | 308 | 56 % | 0.116 % | 1.29 | 0.270 | 36 % |
| 2025 | 310 | 47 % | -0.016 % | 0.94 | 0.012 | -5 % |
| 2026 | 225 | 44 % | -0.025 % | 0.93 | 0.023 | -6 % |

## 3. Sens et type de signal

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · IMP | 427 | 50 % | 0.110 % | 1.28 | 0.239 | 47 % |
| long · μIMP | 309 | 49 % | 0.091 % | 1.09 | 0.198 | 28 % |
| short · IMP | 1232 | 47 % | 0.008 % | 0.99 | 0.085 | 10 % |
| short · μIMP | 916 | 44 % | -0.106 % | 0.80 | -0.090 | -97 % |

## 4. Session et heure (UTC)

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · Asie (0-7 h) | 628 | 46 % | -0.017 % | 0.95 | 0.077 | -10 % |
| 2 · Europe (7-13 h) | 686 | 48 % | 0.055 % | 1.11 | 0.072 | 37 % |
| 3 · États-Unis (13-21 h) | 1256 | 46 % | -0.045 % | 0.87 | 0.004 | -57 % |
| 4 · soirée (21-24 h) | 314 | 48 % | 0.055 % | 1.12 | 0.266 | 17 % |

| heure | positions | moyenne | PF |
| --- | ---: | ---: | ---: |
| 0 h | 119 | -0.175 % | 0.77 |
| 1 h | 118 | 0.061 % | 1.11 |
| 2 h | 86 | 0.258 % | 1.83 |
| 3 h | 70 | 0.150 % | 1.35 |
| 4 h | 75 | 0.009 % | 0.92 |
| 5 h | 68 | -0.366 % | 0.46 |
| 6 h | 92 | -0.056 % | 0.86 |
| 7 h | 95 | -0.042 % | 0.88 |
| 8 h | 117 | 0.068 % | 1.08 |
| 9 h | 115 | 0.048 % | 1.03 |
| 10 h | 113 | 0.239 % | 1.52 |
| 11 h | 113 | 0.142 % | 1.37 |
| 12 h | 133 | -0.113 % | 0.87 |
| 13 h | 204 | -0.106 % | 0.78 |
| 14 h | 243 | 0.088 % | 1.14 |
| 15 h | 178 | 0.076 % | 1.12 |
| 16 h | 152 | 0.063 % | 1.05 |
| 17 h | 140 | -0.040 % | 0.88 |
| 18 h | 104 | -0.078 % | 0.88 |
| 19 h | 126 | -0.175 % | 0.73 |
| 20 h | 109 | -0.400 % | 0.43 |
| 21 h | 103 | 0.065 % | 1.13 |
| 22 h | 85 | -0.250 % | 0.59 |
| 23 h | 126 | 0.253 % | 1.52 |

Minute d'entrée des longs (pente du filtre 60 min) :

| minute | longs | moyenne |
| --- | ---: | ---: |
| :00 | 362 | 0.056 % |
| :30 | 374 | 0.147 % |

## 5. Régimes de marché à l'entrée

Volatilité (ATR / prix, rapportée à sa moyenne sur 30 jours) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · basse · long | 188 | 52 % | 0.189 % | 1.62 | 0.445 | 36 % |
| 1 · basse · short | 620 | 46 % | 0.028 % | 1.03 | 0.064 | 17 % |
| 2 · normale · long | 340 | 49 % | 0.103 % | 1.19 | 0.216 | 35 % |
| 2 · normale · short | 909 | 45 % | -0.041 % | 0.93 | -0.021 | -37 % |
| 3 · haute · long | 208 | 49 % | 0.023 % | 1.01 | 0.029 | 5 % |
| 3 · haute · short | 619 | 46 % | -0.109 % | 0.84 | 0.003 | -68 % |

Tendance de fond (prix contre moyenne 200 en 60 min) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baissière · long | 60 | 48 % | 0.003 % | 0.99 | 0.085 | 0 % |
| baissière · short | 1506 | 46 % | -0.035 % | 0.92 | -0.002 | -53 % |
| haussière · long | 676 | 50 % | 0.111 % | 1.20 | 0.234 | 75 % |
| haussière · short | 642 | 44 % | -0.054 % | 0.88 | 0.040 | -35 % |

Percentile de lambda (intensité des chocs) :

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 · < 25 · short | 450 | 46 % | -0.027 % | 0.89 | -0.032 | -12 % |
| 2 · 25-50 · short | 455 | 43 % | -0.095 % | 0.82 | -0.106 | -43 % |
| 3 · 50-75 · long | 296 | 49 % | 0.135 % | 1.32 | 0.248 | 40 % |
| 3 · 50-75 · short | 486 | 49 % | 0.090 % | 1.18 | 0.205 | 44 % |
| 4 · ≥ 75 · long | 440 | 50 % | 0.080 % | 1.11 | 0.204 | 35 % |
| 4 · ≥ 75 · short | 757 | 45 % | -0.100 % | 0.83 | -0.020 | -76 % |

## 6. Timing des entrées : trajectoire moyenne du prix autour du signal

Mouvement du prix depuis la clôture du signal, en ATR, dans le sens du trade (positif = favorable). Les valeurs négatives de k montrent ce qui s'est passé avant le signal.

| barres k | longs moyenne (n=736) | longs médiane | longs % > 0 | shorts moyenne (n=2148) | shorts médiane | shorts % > 0 | toutes barres, hausse moyenne |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| -24 | -4.03 | -3.79 | 1 % | -3.29 | -3.14 | 2 % | -0.19 |
| -20 | -3.87 | -3.55 | 0 % | -3.26 | -3.05 | 0 % | -0.17 |
| -16 | -3.71 | -3.44 | 0 % | -3.18 | -3.01 | 0 % | -0.12 |
| -12 | -3.48 | -3.31 | 0 % | -3.02 | -2.88 | 0 % | -0.09 |
| -8 | -3.17 | -2.95 | 0 % | -2.83 | -2.70 | 0 % | -0.06 |
| -4 | -2.68 | -2.53 | 0 % | -2.47 | -2.34 | 0 % | -0.02 |
| 0 | 0.00 | 0.00 | 0 % | 0.00 | 0.00 | 0 % | 0.00 |
| 1 | 0.11 | -0.04 | 48 % | 0.01 | -0.09 | 44 % | 0.00 |
| 2 | 0.24 | 0.01 | 50 % | 0.04 | -0.15 | 43 % | 0.02 |
| 3 | 0.29 | 0.08 | 52 % | 0.04 | -0.16 | 45 % | 0.03 |
| 4 | 0.26 | 0.03 | 50 % | 0.05 | -0.19 | 44 % | 0.03 |
| 5 | 0.34 | 0.05 | 51 % | 0.04 | -0.21 | 44 % | 0.04 |
| 6 | 0.32 | -0.01 | 49 % | 0.06 | -0.19 | 45 % | 0.04 |
| 7 | 0.33 | 0.04 | 51 % | 0.06 | -0.20 | 45 % | 0.05 |
| 8 | 0.38 | 0.05 | 51 % | 0.06 | -0.25 | 45 % | 0.05 |
| 9 | 0.42 | 0.09 | 51 % | 0.04 | -0.24 | 45 % | 0.07 |
| 10 | 0.43 | -0.12 | 49 % | 0.04 | -0.25 | 44 % | 0.08 |
| 11 | 0.44 | -0.01 | 50 % | 0.02 | -0.30 | 44 % | 0.08 |
| 12 | 0.44 | 0.05 | 51 % | 0.03 | -0.30 | 45 % | 0.09 |
| 18 | 0.71 | 0.30 | 54 % | 0.01 | -0.27 | 46 % | 0.13 |
| 24 | 0.79 | 0.23 | 53 % | 0.10 | -0.27 | 46 % | 0.18 |
| 30 | 0.93 | 0.47 | 55 % | 0.19 | -0.25 | 47 % | 0.22 |
| 36 | 0.98 | 0.35 | 53 % | 0.23 | -0.19 | 48 % | 0.25 |
| 42 | 1.09 | 0.54 | 54 % | 0.20 | -0.23 | 48 % | 0.28 |
| 48 | 1.12 | 0.41 | 54 % | 0.18 | -0.41 | 47 % | 0.32 |

Dernière colonne : mouvement moyen du prix après une barre quelconque (dérive du marché). Un long n'a d'edge que s'il fait mieux que cette colonne ; un short, que s'il fait mieux que son opposé.

## 7. Sorties

|  | positions | gagnantes | moyenne | PF | R moyen (ATR) | somme |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| long · FLIP | 1 | 0 % | -0.585 % | 0.00 | -1.492 | -1 % |
| long · SL | 300 | 0 % | -1.098 % | 0.00 | -1.660 | -329 % |
| long · TP1+SL | 71 | 0 % | -0.127 % | 0.00 | -0.230 | -9 % |
| long · TP1+TRAIL | 364 | 100 % | 1.138 % | ∞ | 1.865 | 414 % |
| short · FLIP | 2 | 0 % | -0.663 % | 0.00 | -1.445 | -1 % |
| short · SL | 961 | 0 % | -1.232 % | 0.00 | -1.660 | -1184 % |
| short · TP1+END | 1 | 100 % | 0.148 % | ∞ | 0.295 | 0 % |
| short · TP1+SL | 203 | 1 % | -0.149 % | 0.01 | -0.214 | -30 % |
| short · TP1+TRAIL | 981 | 100 % | 1.149 % | ∞ | 1.696 | 1127 % |

- Positions perdantes passées d'abord par +1 ATR de gain : 33 % ; par +0,5 ATR : 60 %.
- Positions gagnantes allées jusqu'à -1 ATR avant de gagner : 24 %.
- Meilleure excursion moyenne : 2.17 ATR ; pire excursion moyenne : -1.17 ATR.
- Durée moyenne : 8.8 barres.

## 8. Variantes (une modification à la fois)

Même période, coûts du script. « Éch. » = jusqu'au 2021-12-31, « hors éch. » = ensuite : une variante qui n'améliore que l'une des deux moitiés est suspecte.

| variante | rendement | Sharpe | max DD | positions | moyenne | Sharpe éch. | Sharpe hors éch. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -35 % | -0.04 | -60 % | 2884 | -0.004 % | -0.12 | 0.11 |
| Pente 60 min corrigée (3 barres de 60 min) | -38 % | -0.06 | -61 % | 2848 | -0.006 % | -0.11 | 0.01 |
| Longs seulement | 96 % | 0.66 | -16 % | 740 | 0.099 % | 0.69 | 0.65 |
| Shorts seulement | -67 % | -0.38 | -74 % | 2148 | -0.041 % | -0.47 | -0.23 |
| Sans micro-chocs | 32 % | 0.24 | -50 % | 2036 | 0.024 % | 0.10 | 0.51 |
| Sans flip exit | -35 % | -0.04 | -60 % | 2884 | -0.004 % | -0.12 | 0.11 |
| Sans TP1 | -55 % | -0.09 | -75 % | 2887 | -0.012 % | -0.29 | 0.26 |
| Sans stop suiveur | 158 % | 0.47 | -52 % | 1465 | 0.088 % | 0.31 | 0.79 |
| Stop 2,5 ATR | -57 % | -0.13 | -77 % | 2674 | -0.016 % | -0.30 | 0.17 |
| Mode normal (sans High Activity) | -44 % | -0.12 | -57 % | 2711 | -0.011 % | -0.20 | 0.03 |
| Sans filtre de volume | -67 % | -0.29 | -77 % | 3090 | -0.025 % | -0.47 | 0.00 |
| Sans filtre 60 min pour les shorts | -72 % | -0.34 | -76 % | 3197 | -0.029 % | -0.44 | -0.21 |
| Cooldown 12 barres | -60 % | -0.27 | -68 % | 2627 | -0.025 % | -0.39 | -0.08 |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -45 % | -0.14 | -66 % | 2387 | -0.014 % | -0.46 | 0.41 |
| Longs seuls, sans stop suiveur | 1326 % | 1.16 | -29 % | 233 | 1.442 % | 1.32 | 0.96 |
| Fade activé (impulse + fade) | -92 % | -0.72 | -93 % | 6761 | -0.031 % | -0.51 | -1.18 |
| Fade seulement | -83 % | -1.06 | -85 % | 4263 | -0.039 % | -0.46 | -2.32 |
| Fade seulement, longs | -53 % | -0.54 | -68 % | 2547 | -0.026 % | 0.06 | -1.79 |

## 9. Face au hasard

Pour chaque variante : 1 000 tirages de positions placées au hasard, avec le même nombre de positions, les mêmes durées, le même sens et les mêmes frais (entrée et sortie à la clôture). Sur le BTC, des longs au hasard gagnent déjà grâce à la hausse de fond : une variante n'a un vrai timing que si elle bat largement ces tirages.

| variante | stratégie (positions composées) | hasard médian | hasard 95e centile | tirages battus |
| --- | ---: | ---: | ---: | ---: |
| Script tel quel | -35 % | -86 % | -43 % | 96.3 % |
| Pente 60 min corrigée (3 barres de 60 min) | -38 % | -86 % | -51 % | 97.7 % |
| Longs seulement | 96 % | -12 % | 69 % | 98.2 % |
| Shorts seulement | -67 % | -84 % | -51 % | 86.0 % |
| Sans micro-chocs | 32 % | -75 % | -16 % | 98.6 % |
| Sans flip exit | -35 % | -86 % | -47 % | 97.1 % |
| Sans TP1 | -55 % | -86 % | -51 % | 94.0 % |
| Sans stop suiveur | 158 % | -99 % | -84 % | 99.9 % |
| Stop 2,5 ATR | -57 % | -90 % | -52 % | 93.5 % |
| Mode normal (sans High Activity) | -44 % | -83 % | -44 % | 95.0 % |
| Sans filtre de volume | -67 % | -88 % | -50 % | 89.5 % |
| Sans filtre 60 min pour les shorts | -72 % | -90 % | -61 % | 88.7 % |
| Cooldown 12 barres | -60 % | -83 % | -42 % | 87.5 % |
| Seuil de choc relevé (micro 2,0 → z > 1,8) | -45 % | -80 % | -35 % | 92.0 % |
| Longs seuls, sans stop suiveur | 1326 % | 970 % | 7374 % | 59.5 % |
| Fade activé (impulse + fade) | -92 % | -97 % | -86 % | 86.8 % |
| Fade seulement | -83 % | -85 % | -57 % | 56.4 % |
| Fade seulement, longs | -53 % | -56 % | -8 % | 56.6 % |

## 10. Timing des entrées, à sorties identiques

Le test le plus juste : on garde exactement les mêmes règles de sortie (stop, TP1, stop suiveur, flip, cooldown) et on remplace seulement les signaux d'entrée par des barres tirées au hasard, en même nombre et du même sens. 100 tirages par variante.

| variante | Sharpe stratégie | Sharpe hasard médian | Sharpe hasard 95e centile | tirages battus | rendement stratégie | rendement hasard médian |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Script tel quel | -0.04 | -0.60 | -0.04 | 96 % | -35 % | -82 % |
| Longs seulement | 0.66 | -0.26 | 0.20 | 100 % | 96 % | -34 % |
| Longs seuls, sans stop suiveur | 1.16 | 0.77 | 1.08 | 98 % | 1326 % | 515 % |

Au-dessus de 95 % de tirages battus, le signal d'entrée apporte quelque chose. Autour de 50 %, la performance vient des sorties et de la tendance du marché, pas du moment d'entrée.

