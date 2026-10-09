# Alpha résiduel du Shock Engine face à des stratégies de tendance simples

Pré-spécification : `research/preregistration/residual-alpha.md` (commitée avant tout calcul). Produit par `node research/shock/residual-alpha.ts` (commit `fa7e88b`). Shock Engine : version publique (shorts seulement en régime de tendance journalier baissier), rendements journaliers 2018-09-01 → 2026-09-30 (2952 jours), après commissions. Références : mêmes barres, positions ±1 décidées à la clôture et appliquées au jour suivant, commission 0,045 % par unité de variation de position, sans funding. Écarts types de Newey–West, retard 8.

**En échantillon.** Les règles du Shock Engine ont été choisies sur des données qui couvrent la période et la condition de tendance des shorts a été spécifiée après étude de cette période : l'étude dit si des facteurs simples reproduisent le résultat historique, pas si l'alpha persistera.

## Verdict (fixé d'avance, M2, portefeuille 50/50) : **alpha résiduel démontré (en échantillon)**

α = 41.0 % par an, t de Newey–West = 4.56, P(α ≤ 0) bootstrap = 0.0000 (5000 tirages de 97 mois). Intervalle à 90 % de α : 26.1 % à 55.8 % ; à 95 % : 23.3 % à 58.9 %. Rendement moyen du Shock Engine : 51.7 % par an (arithmétique) ; part non expliquée par les facteurs : 79 %. R² = 0.266.

## Modèles

| Série | Modèle | α annualisé | t (Newey–West) | Ratio d'information résiduel | R² | R² ajusté | Part non expliquée |
|---|---|---:|---:|---:|---:|---:|---:|
| portfolio | M0 | 49.6 % | 4.48 | 1.82 | 0.022 | 0.021 | 96 % |
| portfolio | M1 | 40.3 % | 4.18 | 1.59 | 0.152 | 0.150 | 78 % |
| portfolio | M2 | 41.0 % | 4.56 | 1.74 | 0.266 | 0.264 | 79 % |
| BTC | M0 | 35.0 % | 3.63 | 1.37 | 0.016 | 0.015 | 93 % |
| BTC | M1 | 28.8 % | 3.41 | 1.20 | 0.134 | 0.132 | 76 % |
| BTC | M2 | 34.6 % | 4.24 | 1.55 | 0.254 | 0.252 | 92 % |
| ETH | M0 | 56.7 % | 4.17 | 1.67 | 0.016 | 0.016 | 94 % |
| ETH | M1 | 46.6 % | 3.84 | 1.46 | 0.130 | 0.129 | 78 % |
| ETH | M2 | 43.2 % | 3.91 | 1.45 | 0.244 | 0.242 | 72 % |

M0 : buy & hold. M1 : M0 + TSMOM 30/90/180, Donchian 55/20, EMA 20/100. M2 : M1 + Donchian 15 min 96/48.

## Expositions de M2 (portefeuille 50/50)

| Facteur | β | t |
|---|---:|---:|
| BH BTC | −0.036 | −1.55 |
| BH ETH | 0.077 | 3.50 |
| TSMOM30 | 0.066 | 2.39 |
| TSMOM90 | 0.051 | 1.46 |
| TSMOM180 | −0.063 | −2.18 |
| DONCH55/20 | 0.051 | 1.35 |
| EMA20/100 | 0.031 | 1.09 |
| DONCH15 96/48 | 0.162 | 5.89 |

## Références seules

| Référence | Sharpe BTC | Sharpe ETH | Sharpe 50/50 | CAGR 50/50 | Drawdown 50/50 | Corrélation avec le portefeuille | avec la sleeve BTC | avec la sleeve ETH |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BH | 0.81 | 0.76 | 0.82 | 37.7 % | −76.3 % | 0.11 | 0.13 | 0.13 |
| TSMOM30 | 0.75 | 0.92 | 0.96 | 50.9 % | −52.2 % | 0.33 | 0.30 | 0.31 |
| TSMOM90 | 0.48 | 0.35 | 0.45 | 7.9 % | −90.6 % | 0.21 | 0.26 | 0.15 |
| TSMOM180 | 0.44 | 0.22 | 0.36 | 2.7 % | −89.3 % | 0.09 | 0.12 | 0.06 |
| DONCH55/20 | 0.74 | 0.76 | 0.84 | 35.4 % | −59.1 % | 0.33 | 0.29 | 0.31 |
| EMA20/100 | 0.61 | 0.52 | 0.64 | 22.6 % | −69.9 % | 0.21 | 0.20 | 0.15 |
| DONCH15 96/48 | −0.44 | 0.37 | 0.02 | −14.8 % | −88.6 % | 0.38 | 0.39 | 0.38 |

Shock Engine sur la même période : Sharpe 1.88 (portefeuille), 1.46 (BTC), 1.75 (ETH).

## Sensibilités (descriptives)

| Sensibilité | α annualisé | t | R² | Ratio d'information |
|---|---:|---:|---:|---:|
| S1 · grille complète, 19 régresseurs (avantage aux références) | 40.7 % | 4.73 | 0.343 | 1.82 |
| S2 · 2018-09-01 → 2022-09-15 | 46.2 % | 3.21 | 0.219 | 1.75 |
| S2 · 2022-09-16 → 2026-09-30 | 38.1 % | 3.90 | 0.423 | 2.01 |
| S3 · hebdomadaire (423 semaines) | 42.6 % | 4.37 | 0.346 | 1.66 |
| S4 · références sans frais | 36.0 % | 4.17 | 0.266 | 1.52 |

## Contrôles

- ✔ Shock Engine returns reproduce the published Sharpe ratios · portfolio 1.877566 vs 1.877567, BTC 1.457987, ETH 1.750707; max error 5.9e-8
- ✔ Spot daily returns reproduce the published BTC/ETH correlation (same daily convention) · 0.8204072202 vs 0.8204072202
- ✔ No look-ahead: perturbing prices after a date leaves every earlier position unchanged · 6800 perturbations (200 dates × 17 references × 2 assets), positions changed: 0
- ✔ OLS recovers known coefficients on simulated data · β = 0.0007, 0.5104, -0.3052 (true 0.001, 0.5, −0.3)
- ✔ Newey–West with lag 0 equals White standard errors · max relative difference 0.0e+0
- ✔ Bootstrap OLS (constant only) equals the full OLS · 6.722597e-4 vs 6.722597e-4
- ✔ Bootstrap is deterministic (same seed, same draws) · 30 replications computed twice
