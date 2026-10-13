# Alpha résiduel du Shock Engine face à des stratégies de tendance simples

Pré-spécification : `research/preregistration/residual-alpha.md` (commitée avant tout calcul). Produit par `node research/shock/residual-alpha.ts` (commit `f056418`). Shock Engine : version publique (shorts seulement en régime de tendance journalier baissier), rendements journaliers 2018-09-01 → 2026-09-30 (2952 jours), après commissions. Références : mêmes barres, positions ±1 décidées à la clôture et appliquées au jour suivant, commission 0,045 % par unité de variation de position, sans funding. Écarts types de Newey–West, retard 8.

**En échantillon.** Les règles du Shock Engine ont été choisies sur des données qui couvrent la période et la condition de tendance des shorts a été spécifiée après étude de cette période : l'étude dit si des facteurs simples reproduisent le résultat historique, pas si l'alpha persistera.

## Verdict (fixé d'avance, M2, portefeuille 50/50) : **alpha résiduel démontré (en échantillon)**

α = 44.8 % par an, t de Newey–West = 4.94, P(α ≤ 0) bootstrap = 0.0000 (5000 tirages de 97 mois). Intervalle à 90 % de α : 29.7 % à 60.0 % ; à 95 % : 26.7 % à 63.0 %. Rendement moyen du Shock Engine : 55.4 % par an (arithmétique) ; part non expliquée par les facteurs : 81 %. R² = 0.251.

## Modèles

| Série | Modèle | α annualisé | t (Newey–West) | Ratio d'information résiduel | R² | R² ajusté | Part non expliquée |
|---|---|---:|---:|---:|---:|---:|---:|
| portfolio | M0 | 53.8 % | 4.85 | 1.98 | 0.016 | 0.016 | 97 % |
| portfolio | M1 | 44.2 % | 4.60 | 1.75 | 0.151 | 0.149 | 80 % |
| portfolio | M2 | 44.8 % | 4.94 | 1.89 | 0.251 | 0.249 | 81 % |
| BTC | M0 | 34.3 % | 3.64 | 1.38 | 0.011 | 0.011 | 94 % |
| BTC | M1 | 28.0 % | 3.46 | 1.21 | 0.142 | 0.140 | 77 % |
| BTC | M2 | 33.4 % | 4.23 | 1.55 | 0.253 | 0.251 | 92 % |
| ETH | M0 | 61.5 % | 4.61 | 1.86 | 0.011 | 0.010 | 96 % |
| ETH | M1 | 51.5 % | 4.33 | 1.65 | 0.126 | 0.125 | 80 % |
| ETH | M2 | 48.3 % | 4.42 | 1.65 | 0.228 | 0.226 | 75 % |

M0 : buy & hold. M1 : M0 + TSMOM 30/90/180, Donchian 55/20, EMA 20/100. M2 : M1 + Donchian 15 min 96/48.

## Expositions de M2 (portefeuille 50/50)

| Facteur | β | t |
|---|---:|---:|
| BH BTC | −0.035 | −1.41 |
| BH ETH | 0.069 | 2.81 |
| TSMOM30 | 0.073 | 2.52 |
| TSMOM90 | 0.043 | 1.18 |
| TSMOM180 | −0.070 | −2.44 |
| DONCH55/20 | 0.048 | 1.22 |
| EMA20/100 | 0.040 | 1.36 |
| DONCH15 96/48 | 0.150 | 5.59 |

## Références seules

| Référence | Sharpe BTC | Sharpe ETH | Sharpe 50/50 | CAGR 50/50 | Drawdown 50/50 | Corrélation avec le portefeuille | avec la sleeve BTC | avec la sleeve ETH |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| BH | 0.81 | 0.76 | 0.82 | 37.7 % | −76.3 % | 0.09 | 0.10 | 0.10 |
| TSMOM30 | 0.75 | 0.92 | 0.96 | 50.9 % | −52.2 % | 0.34 | 0.31 | 0.31 |
| TSMOM90 | 0.48 | 0.35 | 0.45 | 7.9 % | −90.6 % | 0.20 | 0.27 | 0.14 |
| TSMOM180 | 0.44 | 0.22 | 0.36 | 2.7 % | −89.3 % | 0.08 | 0.12 | 0.05 |
| DONCH55/20 | 0.74 | 0.76 | 0.84 | 35.4 % | −59.1 % | 0.33 | 0.31 | 0.31 |
| EMA20/100 | 0.61 | 0.52 | 0.64 | 22.6 % | −69.9 % | 0.20 | 0.21 | 0.15 |
| DONCH15 96/48 | −0.44 | 0.37 | 0.02 | −14.8 % | −88.6 % | 0.36 | 0.38 | 0.36 |

Shock Engine sur la même période : Sharpe 2.02 (portefeuille), 1.46 (BTC), 1.93 (ETH).

## Sensibilités (descriptives)

| Sensibilité | α annualisé | t | R² | Ratio d'information |
|---|---:|---:|---:|---:|
| S1 · grille complète, 19 régresseurs (avantage aux références) | 44.3 % | 5.07 | 0.325 | 1.97 |
| S2 · 2018-09-01 → 2022-09-15 | 48.6 % | 3.39 | 0.202 | 1.85 |
| S2 · 2022-09-16 → 2026-09-30 | 44.1 % | 4.41 | 0.405 | 2.28 |
| S3 · hebdomadaire (423 semaines) | 45.7 % | 4.70 | 0.325 | 1.75 |
| S4 · références sans frais | 40.2 % | 4.62 | 0.251 | 1.70 |

## Contrôles

- ✔ Shock Engine returns reproduce the published Sharpe ratios · portfolio 2.024208 vs 2.024208, BTC 1.456497, ETH 1.927276; max error 2.4e-8
- ✔ Spot daily returns reproduce the published BTC/ETH correlation (same daily convention) · 0.8204072202 vs 0.8204072202
- ✔ No look-ahead: perturbing prices after a date leaves every earlier position unchanged · 6800 perturbations (200 dates × 17 references × 2 assets), positions changed: 0
- ✔ OLS recovers known coefficients on simulated data · β = 0.0007, 0.5104, -0.3052 (true 0.001, 0.5, −0.3)
- ✔ Newey–West with lag 0 equals White standard errors · max relative difference 0.0e+0
- ✔ Bootstrap OLS (constant only) equals the full OLS · 6.722597e-4 vs 6.722597e-4
- ✔ Bootstrap is deterministic (same seed, same draws) · 30 replications computed twice
