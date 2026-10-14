# Shock Fade Engine — identifiabilité des composantes latentes

Généré par `research/fade/shockfade/identifiability.py`. Estimations trimestrielles sur les 180 jours précédant chaque trimestre (2020-07 → 2024-10), données 1 min des perpétuels. Aucune donnée de C.

## 1. Hawkes bivarié (sauts identifiés ±)

| actif | trimestre | sauts | μ₊ ; μ₋ (/jour) | n₊₊ | n₊₋ | n₋₊ | n₋₋ | t½ ₊₊ ; ₋₋ (min) | ρ(G) | LR vs Poisson | LR vs univarié (p) | GOF hors éch. p (₊ ; ₋) |
|---|---|---:|---|---:|---:|---:|---:|---|---:|---:|---|---|
| BTCUSDT | 2020-07-01 | 1206 | 2.23 ; 2.63 | 0.25 | 0.14 | 0.14 | 0.24 | 5.9 ; 3.1 | 0.39 | 1521 | 455 (3.3e-97) | 0.370 ; 0.020 |
| BTCUSDT | 2020-10-01 | 1420 | 2.25 ; 2.66 | 0.25 | 0.14 | 0.13 | 0.23 | 4.6 ; 3.7 | 0.38 | 1744 | 544 (2.5e-116) | 0.024 ; 0.001 |
| BTCUSDT | 2021-01-01 | 1155 | 1.98 ; 1.93 | 0.23 | 0.16 | 0.13 | 0.26 | 5.4 ; 5.7 | 0.39 | 1524 | 531 (1.3e-113) | 0.003 ; 0.003 |
| BTCUSDT | 2021-04-01 | 809 | 1.42 ; 1.45 | 0.22 | 0.13 | 0.10 | 0.27 | 5.8 ; 5.9 | 0.36 | 1068 | 299 (1.5e-63) | 0.072 ; 0.559 |
| BTCUSDT | 2021-07-01 | 709 | 1.45 ; 1.22 | 0.18 | 0.15 | 0.06 | 0.27 | 3.7 ; 5.1 | 0.33 | 886 | 195 (5.0e-41) | 0.000 ; 0.041 |
| BTCUSDT | 2021-10-01 | 867 | 1.98 ; 1.43 | 0.15 | 0.14 | 0.06 | 0.26 | 3.7 ; 4.8 | 0.31 | 859 | 186 (4.8e-39) | 0.067 ; 0.454 |
| BTCUSDT | 2022-01-01 | 991 | 2.23 ; 1.52 | 0.18 | 0.14 | 0.09 | 0.25 | 2.9 ; 4.9 | 0.33 | 1075 | 282 (9.0e-60) | 0.648 ; 0.019 |
| BTCUSDT | 2022-04-01 | 1087 | 2.44 ; 1.72 | 0.18 | 0.10 | 0.10 | 0.25 | 2.9 ; 4.2 | 0.32 | 1139 | 292 (5.1e-62) | 0.546 ; 0.603 |
| BTCUSDT | 2022-07-01 | 1127 | 2.34 ; 1.93 | 0.17 | 0.13 | 0.09 | 0.25 | 3.6 ; 4.0 | 0.33 | 1127 | 294 (1.9e-62) | 0.239 ; 0.510 |
| BTCUSDT | 2022-10-01 | 1060 | 2.03 ; 1.96 | 0.20 | 0.14 | 0.10 | 0.21 | 5.8 ; 3.7 | 0.32 | 1089 | 340 (2.3e-72) | 0.000 ; 0.000 |
| BTCUSDT | 2023-01-01 | 1224 | 2.06 ; 2.25 | 0.26 | 0.12 | 0.14 | 0.21 | 5.5 ; 4.7 | 0.37 | 1425 | 436 (4.5e-93) | 0.064 ; 0.207 |
| BTCUSDT | 2023-04-01 | 1394 | 2.34 ; 2.28 | 0.29 | 0.13 | 0.14 | 0.25 | 4.8 ; 4.5 | 0.41 | 1894 | 542 (6.5e-116) | 0.516 ; 0.659 |
| BTCUSDT | 2023-07-01 | 1320 | 2.17 ; 2.08 | 0.30 | 0.13 | 0.16 | 0.25 | 6.1 ; 3.4 | 0.42 | 1800 | 463 (5.8e-99) | 0.004 ; 0.359 |
| BTCUSDT | 2023-10-01 | 1475 | 2.36 ; 2.24 | 0.28 | 0.17 | 0.18 | 0.24 | 7.1 ; 4.1 | 0.44 | 1968 | 641 (1.9e-137) | 0.003 ; 0.002 |
| BTCUSDT | 2024-01-01 | 1319 | 2.09 ; 1.97 | 0.29 | 0.20 | 0.19 | 0.21 | 7.1 ; 4.3 | 0.45 | 1995 | 764 (4.1e-164) | 0.000 ; 0.006 |
| BTCUSDT | 2024-04-01 | 922 | 1.54 ; 1.43 | 0.25 | 0.17 | 0.21 | 0.21 | 7.5 ; 4.9 | 0.42 | 1470 | 582 (1.1e-124) | 0.850 ; 0.156 |
| BTCUSDT | 2024-07-01 | 909 | 1.63 ; 1.54 | 0.19 | 0.16 | 0.14 | 0.26 | 6.0 ; 5.2 | 0.38 | 1201 | 402 (1.3e-85) | 0.710 ; 0.061 |
| BTCUSDT | 2024-10-01 | 1017 | 1.84 ; 1.75 | 0.18 | 0.15 | 0.12 | 0.28 | 4.7 ; 6.0 | 0.37 | 1228 | 381 (3.3e-81) | 0.009 ; 0.000 |
| ETHUSDT | 2020-07-01 | 1026 | 1.73 ; 2.28 | 0.28 | 0.15 | 0.14 | 0.25 | 9.0 ; 2.8 | 0.41 | 1393 | 402 (8.7e-86) | 0.507 ; 0.000 |
| ETHUSDT | 2020-10-01 | 1235 | 1.96 ; 2.29 | 0.24 | 0.16 | 0.13 | 0.23 | 7.2 ; 2.6 | 0.38 | 1559 | 479 (2.6e-102) | 0.000 ; 0.372 |
| ETHUSDT | 2021-01-01 | 976 | 1.51 ; 1.91 | 0.19 | 0.18 | 0.10 | 0.26 | 7.0 ; 4.3 | 0.36 | 1300 | 465 (2.0e-99) | 0.000 ; 0.004 |
| ETHUSDT | 2021-04-01 | 709 | 1.04 ; 1.48 | 0.13 | 0.16 | 0.13 | 0.27 | 5.6 ; 4.8 | 0.36 | 965 | 341 (1.3e-72) | 0.230 ; 0.001 |
| ETHUSDT | 2021-07-01 | 545 | 0.97 ; 1.06 | 0.15 | 0.17 | 0.03 | 0.30 | 9.0 ; 4.5 | 0.33 | 799 | 224 (2.2e-47) | 0.002 ; 0.022 |
| ETHUSDT | 2021-10-01 | 699 | 1.40 ; 1.28 | 0.20 | 0.10 | 0.05 | 0.27 | 4.7 ; 3.4 | 0.32 | 912 | 169 (2.0e-35) | 0.335 ; 0.728 |
| ETHUSDT | 2022-01-01 | 759 | 1.48 ; 1.40 | 0.19 | 0.10 | 0.07 | 0.27 | 4.0 ; 3.9 | 0.32 | 976 | 243 (1.8e-51) | 0.013 ; 0.341 |
| ETHUSDT | 2022-04-01 | 831 | 1.68 ; 1.46 | 0.19 | 0.10 | 0.07 | 0.29 | 4.5 ; 5.6 | 0.33 | 942 | 221 (1.3e-46) | 0.042 ; 0.869 |
| ETHUSDT | 2022-07-01 | 936 | 1.97 ; 1.56 | 0.18 | 0.14 | 0.06 | 0.27 | 4.7 ; 4.8 | 0.33 | 945 | 197 (1.7e-41) | 0.010 ; 0.255 |
| ETHUSDT | 2022-10-01 | 949 | 2.01 ; 1.67 | 0.20 | 0.11 | 0.08 | 0.22 | 3.4 ; 3.3 | 0.30 | 1013 | 228 (3.9e-48) | 0.034 ; 0.000 |
| ETHUSDT | 2023-01-01 | 1113 | 1.98 ; 2.05 | 0.25 | 0.10 | 0.12 | 0.23 | 3.3 ; 4.1 | 0.35 | 1400 | 373 (2.0e-79) | 0.075 ; 0.101 |
| ETHUSDT | 2023-04-01 | 1265 | 2.18 ; 2.06 | 0.26 | 0.13 | 0.13 | 0.27 | 3.6 ; 4.5 | 0.40 | 1843 | 575 (4.8e-123) | 0.213 ; 0.593 |
| ETHUSDT | 2023-07-01 | 1342 | 2.40 ; 2.21 | 0.22 | 0.14 | 0.13 | 0.27 | 3.9 ; 3.5 | 0.38 | 1738 | 529 (3.1e-113) | 0.681 ; 0.351 |
| ETHUSDT | 2023-10-01 | 1417 | 2.33 ; 2.42 | 0.23 | 0.16 | 0.14 | 0.26 | 5.2 ; 3.8 | 0.40 | 1726 | 559 (1.5e-119) | 0.000 ; 0.000 |
| ETHUSDT | 2024-01-01 | 1108 | 1.76 ; 1.92 | 0.28 | 0.17 | 0.14 | 0.22 | 6.3 ; 4.2 | 0.40 | 1542 | 528 (6.9e-113) | 0.048 ; 0.002 |
| ETHUSDT | 2024-04-01 | 786 | 1.39 ; 1.44 | 0.26 | 0.13 | 0.09 | 0.22 | 6.3 ; 4.9 | 0.35 | 1085 | 311 (5.2e-66) | 0.327 ; 0.002 |
| ETHUSDT | 2024-07-01 | 873 | 1.58 ; 1.56 | 0.22 | 0.14 | 0.07 | 0.28 | 4.4 ; 6.4 | 0.35 | 1199 | 339 (4.7e-72) | 0.342 ; 0.058 |
| ETHUSDT | 2024-10-01 | 1006 | 1.73 ; 1.80 | 0.21 | 0.16 | 0.09 | 0.27 | 4.8 ; 5.8 | 0.37 | 1327 | 431 (6.6e-92) | 0.171 ; 0.019 |

n_km = α_km/β_km : nombre moyen de sauts de type k déclenchés par un saut de type m (k, m ∈ {₊, ₋}). Tests de changement de temps hors échantillon rejetés à 5 % : 49 % des 72 cas (Poisson : rejet dans tous les cas). L'excitation est nette et l'excitation croisée significative, mais le modèle à intensité de base constante n'est pas stable d'un trimestre à l'autre : ses prévisions de niveau sont biaisées (voir H3a).

## 2. État-espace prix = permanent + transitoire (OU) piloté par le flux

| actif | trimestre | φ | t½ (min) ± e.t. | λ_F | λ_Q | ψ_flux | ψ_saut ± e.t. | σ_F | σ_Q | σ_e | valeur propre min. de la hessienne | LR « sans transitoire » |
|---|---|---:|---|---:|---:|---:|---|---:|---:|---:|---:|---:|
| BTCUSDT | 2020-07-01 | 0.225 | 0.46 ± 0.026 | 0.615 | 0.101 | 0.14 | 0.16 ± 0.010 | 0.616 | 0.096 | 0.160 | -2.6 | 6947 |
| BTCUSDT | 2020-10-01 | 0.321 | 0.61 ± 0.024 | 0.551 | 0.141 | 0.20 | 0.18 ± 0.010 | 0.631 | 0.096 | 0.189 | 19 | 10033 |
| BTCUSDT | 2021-01-01 | 0.321 | 0.61 ± 0.021 | 0.547 | 0.162 | 0.23 | 0.18 ± 0.011 | 0.632 | 0.004 | 0.203 | -0.72 | 10659 |
| BTCUSDT | 2021-04-01 | 0.268 | 0.53 ± 0.016 | 0.579 | 0.169 | 0.23 | 0.15 ± 0.011 | 0.580 | 0.004 | 0.217 | 0.054 | 12503 |
| BTCUSDT | 2021-07-01 | 0.182 | 0.41 ± 0.015 | 0.628 | 0.132 | 0.17 | 0.12 ± 0.009 | 0.565 | 0.004 | 0.218 | -1.3 | 9331 |
| BTCUSDT | 2021-10-01 | 0.063 | 0.25 ± 0.017 | 0.654 | 0.110 | 0.14 | 0.10 ± 0.008 | 0.547 | 0.004 | 0.233 | 0.62 | 8528 |
| BTCUSDT | 2022-01-01 | 0.108 | 0.31 ± 0.014 | 0.617 | 0.125 | 0.17 | 0.12 ± 0.008 | 0.563 | 0.004 | 0.246 | 0.76 | 10075 |
| BTCUSDT | 2022-04-01 | 0.155 | 0.37 ± 0.013 | 0.599 | 0.137 | 0.19 | 0.14 ± 0.009 | 0.574 | 0.004 | 0.244 | -1.6 | 11241 |
| BTCUSDT | 2022-07-01 | 0.130 | 0.34 ± 0.012 | 0.600 | 0.147 | 0.20 | 0.13 ± 0.008 | 0.559 | 0.004 | 0.255 | -2.6 | 13170 |
| BTCUSDT | 2022-10-01 | 0.130 | 0.34 ± 0.012 | 0.599 | 0.156 | 0.21 | 0.13 ± 0.008 | 0.552 | 0.004 | 0.252 | -0.27 | 14082 |
| BTCUSDT | 2023-01-01 | 0.178 | 0.40 ± 0.012 | 0.599 | 0.160 | 0.21 | 0.14 ± 0.008 | 0.560 | 0.004 | 0.228 | -0.15 | 14392 |
| BTCUSDT | 2023-04-01 | 0.202 | 0.43 ± 0.013 | 0.593 | 0.161 | 0.21 | 0.15 ± 0.008 | 0.557 | 0.004 | 0.234 | -0.73 | 15197 |
| BTCUSDT | 2023-07-01 | 0.240 | 0.49 ± 0.012 | 0.584 | 0.185 | 0.24 | 0.17 ± 0.009 | 0.532 | 0.004 | 0.243 | 0.29 | 18591 |
| BTCUSDT | 2023-10-01 | 0.369 | 0.70 ± 0.015 | 0.572 | 0.208 | 0.27 | 0.21 ± 0.010 | 0.558 | 0.004 | 0.223 | -1.4 | 18262 |
| BTCUSDT | 2024-01-01 | 0.407 | 0.77 ± 0.017 | 0.554 | 0.215 | 0.28 | 0.21 ± 0.011 | 0.582 | 0.004 | 0.223 | 3.5 | 16783 |
| BTCUSDT | 2024-04-01 | 0.341 | 0.64 ± 0.015 | 0.559 | 0.199 | 0.26 | 0.19 ± 0.012 | 0.571 | 0.004 | 0.240 | 0.35 | 15349 |
| BTCUSDT | 2024-07-01 | 0.264 | 0.52 ± 0.014 | 0.576 | 0.174 | 0.23 | 0.16 ± 0.011 | 0.579 | 0.004 | 0.240 | -0.084 | 13195 |
| BTCUSDT | 2024-10-01 | 0.232 | 0.47 ± 0.013 | 0.568 | 0.171 | 0.23 | 0.15 ± 0.009 | 0.591 | 0.004 | 0.237 | 1.2 | 13032 |
| ETHUSDT | 2020-07-01 | 0.218 | 0.46 ± 0.026 | 0.563 | 0.088 | 0.14 | 0.17 ± 0.011 | 0.670 | 0.072 | 0.223 | -6.2 | 4833 |
| ETHUSDT | 2020-10-01 | 0.277 | 0.54 ± 0.020 | 0.537 | 0.136 | 0.20 | 0.18 ± 0.010 | 0.637 | 0.074 | 0.242 | -5.3 | 9159 |
| ETHUSDT | 2021-01-01 | 0.281 | 0.55 ± 0.015 | 0.516 | 0.178 | 0.26 | 0.20 ± 0.012 | 0.622 | 0.074 | 0.245 | 3.2 | 12992 |
| ETHUSDT | 2021-04-01 | 0.337 | 0.64 ± 0.017 | 0.509 | 0.195 | 0.28 | 0.21 ± 0.015 | 0.627 | 0.073 | 0.232 | 13 | 12843 |
| ETHUSDT | 2021-07-01 | 0.344 | 0.65 ± 0.022 | 0.556 | 0.161 | 0.23 | 0.17 ± 0.015 | 0.627 | 0.071 | 0.210 | 28 | 8534 |
| ETHUSDT | 2021-10-01 | 0.180 | 0.40 ± 0.017 | 0.613 | 0.120 | 0.16 | 0.11 ± 0.010 | 0.593 | 0.072 | 0.224 | -1 | 7088 |
| ETHUSDT | 2022-01-01 | 0.178 | 0.40 ± 0.017 | 0.600 | 0.120 | 0.17 | 0.12 ± 0.010 | 0.602 | 0.073 | 0.237 | -5.1 | 7065 |
| ETHUSDT | 2022-04-01 | 0.240 | 0.49 ± 0.016 | 0.587 | 0.134 | 0.19 | 0.16 ± 0.011 | 0.609 | 0.077 | 0.239 | -16 | 8433 |
| ETHUSDT | 2022-07-01 | 0.227 | 0.47 ± 0.014 | 0.588 | 0.147 | 0.20 | 0.18 ± 0.011 | 0.581 | 0.214 | 0.182 | 1.1e+02 | 11262 |
| ETHUSDT | 2022-10-01 | 0.148 | 0.36 ± 0.014 | 0.614 | 0.135 | 0.18 | 0.16 ± 0.010 | 0.570 | 0.158 | 0.189 | 45 | 11396 |
| ETHUSDT | 2023-01-01 | 0.189 | 0.42 ± 0.013 | 0.605 | 0.143 | 0.19 | 0.16 ± 0.010 | 0.556 | 0.138 | 0.192 | 47 | 12814 |
| ETHUSDT | 2023-04-01 | 0.255 | 0.51 ± 0.014 | 0.573 | 0.154 | 0.21 | 0.19 ± 0.010 | 0.561 | 0.193 | 0.176 | 1.3e+02 | 13552 |
| ETHUSDT | 2023-07-01 | 0.281 | 0.55 ± 0.015 | 0.579 | 0.155 | 0.21 | 0.19 ± 0.010 | 0.546 | 0.253 | 0.124 | 77 | 13751 |
| ETHUSDT | 2023-10-01 | 0.397 | 0.75 ± 0.020 | 0.588 | 0.157 | 0.21 | 0.21 ± 0.010 | 0.561 | 0.295 | 0.055 | 6.3 | 11575 |
| ETHUSDT | 2024-01-01 | 0.474 | 0.93 ± 0.024 | 0.554 | 0.167 | 0.23 | 0.23 ± 0.013 | 0.589 | 0.322 | 0.054 | 18 | 9773 |
| ETHUSDT | 2024-04-01 | 0.408 | 0.77 ± 0.010 | 0.540 | 0.162 | 0.23 | 0.22 ± 0.015 | 0.587 | 0.333 | 0.055 | -2.8 | 9329 |
| ETHUSDT | 2024-07-01 | 0.270 | 0.53 ± 0.012 | 0.546 | 0.155 | 0.22 | 0.17 ± 0.012 | 0.595 | 0.302 | 0.059 | -9.6 | 9985 |
| ETHUSDT | 2024-10-01 | 0.219 | 0.46 ± 0.012 | 0.536 | 0.155 | 0.22 | 0.16 ± 0.010 | 0.609 | 0.289 | 0.062 | -15 | 10507 |

Lecture : la composante transitoire **identifiée** a une demi-vie de 0,25 à 0,8 minute ; elle reprend 14–28 % de l'impact instantané du flux (ψ_flux) et 10–21 % de l'amplitude des sauts (ψ_saut). Le test « sans transitoire » est massivement rejeté, mais ce transitoire disparaît **avant** qu'une entrée à une minute de latence soit possible. Une valeur propre négative de la hessienne signale que σ_Q et σ_e (deux bruits presque blancs quand φ est petit) ne sont pas séparément identifiés ; φ, λ_F, λ_Q et ψ_saut le sont (erreurs types faibles).

## 3. Profil de vraisemblance en φ (demi-vie imposée)

Pour chaque demi-vie imposée, les sept autres paramètres sont réestimés. ΔLL = log-vraisemblance − celle du modèle sans transitoire : une composante lente (10 min à 8 h) n'est soutenue par les données que si ΔLL reste grand quand on impose une demi-vie longue.

**BTCUSDT**

| trimestre | t½ = 0.5 min | t½ = 1 min | t½ = 3 min | t½ = 7 min | t½ = 15 min | t½ = 30 min | t½ = 60 min | t½ = 120 min | t½ = 480 min | sans transitoire |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2021-01-01 | +5314 (ψ_J 0.16) | +5213 (ψ_J 0.21) | +4256 (ψ_J 0.30) | +3386 (ψ_J 0.33) | +2760 (ψ_J 0.32) | +2326 (ψ_J 0.30) | +1976 (ψ_J 0.29) | +1685 (ψ_J 0.20) | +1292 (ψ_J 0.20) | 0 |
| 2022-07-01 | +6502 (ψ_J 0.15) | +5707 (ψ_J 0.20) | +3151 (ψ_J 0.29) | +1382 (ψ_J 0.31) | +487 (ψ_J 0.28) | +155 (ψ_J 0.22) | +53 (ψ_J 0.15) | +30 (ψ_J 0.15) | +30 (ψ_J 0.15) | 0 |
| 2024-07-01 | +6596 (ψ_J 0.16) | +6222 (ψ_J 0.21) | +4084 (ψ_J 0.30) | +2222 (ψ_J 0.34) | +1044 (ψ_J 0.34) | +458 (ψ_J 0.31) | +187 (ψ_J 0.18) | +86 (ψ_J 0.18) | +48 (ψ_J 0.18) | 0 |

**ETHUSDT**

| trimestre | t½ = 0.5 min | t½ = 1 min | t½ = 3 min | t½ = 7 min | t½ = 15 min | t½ = 30 min | t½ = 60 min | t½ = 120 min | t½ = 480 min | sans transitoire |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2021-01-01 | +6488 (ψ_J 0.20) | +6237 (ψ_J 0.25) | +4542 (ψ_J 0.33) | +3061 (ψ_J 0.36) | +2068 (ψ_J 0.34) | +1481 (ψ_J 0.30) | +1136 (ψ_J 0.22) | +954 (ψ_J 0.22) | +801 (ψ_J 0.23) | 0 |
| 2022-07-01 | +5628 (ψ_J 0.18) | +5175 (ψ_J 0.23) | +3175 (ψ_J 0.31) | +1591 (ψ_J 0.34) | +651 (ψ_J 0.32) | +229 (ψ_J 0.27) | +72 (ψ_J 0.25) | +31 (ψ_J 0.16) | +28 (ψ_J 0.08) | 0 |
| 2024-07-01 | +4990 (ψ_J 0.17) | +4779 (ψ_J 0.21) | +3227 (ψ_J 0.27) | +1868 (ψ_J 0.29) | +991 (ψ_J 0.26) | +523 (ψ_J 0.21) | +273 (ψ_J 0.22) | +148 (ψ_J 0.21) | +68 (ψ_J 0.23) | 0 |

Lecture : dans les six fenêtres, la vraisemblance est maximale pour une demi-vie inférieure ou égale à une minute (ΔLL +4990 à +6596). Avec une demi-vie imposée de 1 à 8 heures, le modèle reste meilleur que « sans transitoire » (ΔLL +28 à +1976) : une réversion lente n'est **pas exclue**. Mais le gain est de 5 à 200 fois plus faible, varie fortement d'une fenêtre à l'autre, et un modèle à une seule composante ne peut pas dire si cette réversion lente suit les chocs ou vient d'une hétéroscédasticité mal modélisée. La séparation d'une composante lente et d'une composante rapide demanderait un modèle à deux transitoires (non pré-enregistré).

Ratios de variance des rendements standardisés par la volatilité prévue (bornés à ±6, sauts compris) ; VR(q) < 1 = réversion moyenne à l'échelle de q minutes, VR = 1 marche aléatoire :

| actif | période | autocorr. 1 min | VR(2) | VR(5) | VR(15) | VR(60) | VR(240) |
|---|---|---:|---:|---:|---:|---:|---:|
| BTCUSDT | 2020-07-01→2022-07-01 | -0.019 | 0.981 | 0.940 | 0.890 | 0.867 | 0.903 |
| BTCUSDT | 2022-07-01→2025-01-01 | -0.013 | 0.988 | 0.965 | 0.908 | 0.882 | 0.827 |
| ETHUSDT | 2020-07-01→2022-07-01 | -0.016 | 0.982 | 0.963 | 0.927 | 0.927 | 0.992 |
| ETHUSDT | 2022-07-01→2025-01-01 | -0.018 | 0.981 | 0.960 | 0.920 | 0.906 | 0.843 |

## 4. Ce que l'OU donne au moment de la décision (chocs 5 min, |Z| ≥ 4, période E)

- Déviation transitoire filtrée en T, dans le sens du choc : médiane 2.05 pb ; part transitoire estimée du mouvement de la barre ψ_T médiane 0.027.
- Réversion OU prévue entre l'entrée (T+1) et la sortie, médiane (pb) : h=1 : 0.42, h=2 : 0.42, h=4 : 0.42, h=8 : 0.42, h=16 : 0.42, h=32 : 0.42 ; part des chocs où elle dépasse le coût aller-retour (14 pb) : h=1 : 0.5 %, h=2 : 0.5 %, h=4 : 0.5 %, h=8 : 0.5 %, h=16 : 0.5 %, h=32 : 0.5 %.
- OU naïf sur le prix brut (AR(1) sur 1 440 minutes) : b moyen 0.99566, b < 1 dans 85 % des cas, « demi-vie » médiane 197 min. Sur une marche aléatoire simulée, le même estimateur donne b < 1 dans plus de 90 % des fenêtres (biais de Dickey–Fuller, test `test_naive_ou_on_random_walk_shows_spurious_reversion`) : cette « réversion » n'est pas une propriété du marché. En walk-forward, ce contrôle n'a aucun pouvoir prédictif (06-walkforward.md).

## 5. Conclusion d'identifiabilité

- **Identifiable** : sauts au sens statistique (rejet de la diffusion locale, 1 min) ; excitation propre et croisée des sauts (Hawkes, LR massifs) ; composante transitoire **ultra-rapide** (demi-vie < 1 min) et sa part dans l'impact du flux et des sauts.
- **Faiblement identifiable avec ces données** : une composante transitoire lente (10 min à quelques heures). Le profil de vraisemblance la soutient face à « aucun transitoire » et les ratios de variance des rendements standardisés (VR(15) ≈ 0,89–0,93, VR(60) ≈ 0,87–0,93) indiquent une réversion **inconditionnelle** modeste à 15–60 min, mais le modèle à une composante ne la sépare pas de la composante rapide, et sa part dans un choc donné n'est pas estimable. **Non identifiés** : la séparation σ_Q / σ_e ; la stabilité des paramètres Hawkes d'un trimestre à l'autre.
- **Non démontrable** : qu'un choc donné soit « principalement transitoire ». Les caractéristiques OU des modèles M4–M7 sont donc des proxies (déviation filtrée d'un modèle à une composante), pas une mesure démontrée de l'impact temporaire.

