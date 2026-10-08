# Surface adaptative continue · Shock Engine 15 min · walk-forward imbriqué

BTC/USD Bitstamp 15 min. Calibration 36 mois → test 3 mois → pas de 3 mois ; tests concaténés du 2020-01-01 au 2026-10-04 (28 fenêtres). Commission 0,045 % par ordre, sans levier, même moteur et même exécution pour tous les modèles. Produit par `node research/shock/adaptive-surface.ts --robust 100 --seed 11` en 29 min.

**Le critère est le walk-forward hors échantillon, pas le backtest.** Aucun résultat de test n'est utilisé pour calibrer ; les constantes de la procédure ont été fixées avant de lancer le calcul.

## Parité et vérifications

- Percentile 12 mois > 50 % et régime actuel (classify) : 0 bougie(s) différente(s) sur 341941 depuis 2017.
- Seuil de choc unifié (micro-choc actif partout, kMicro = s + 0,2) : 0 bougie(s) différente(s) avec le préréglage.
- Préréglage rejoué par tranches de 3 mois (machinerie du walk-forward) face à une simulation d'un bloc, 2020-01-01 → 2026-10-04 : Sharpe 1.51 contre 1.51, rendement 1311 % contre 1311 %, 762 trades contre 762.
- Rendements de la grille non rattachés à un trade : 0.

## Ablation · M0 → M4

IS : la même procédure appliquée une fois à tout l'historique 2017-2026 (surface unique, donc vue de la période de test), évaluée sur la même période que le walk-forward. WF OOS : surfaces recalibrées à chaque fenêtre sur le seul passé.

| modèle | Sharpe IS | Sharpe WF OOS | Sortino OOS | CAGR OOS | PF OOS | Max DD OOS | trades | exposition |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0 · préréglage figé | 1.51 | 1.51 | 2.21 | 47.9 % | 1.45 | -29.6 % | 762 | 26 % |
| M0wf · 2 régimes durs, recalibrés | 1.42 | 1.33 | 1.97 | 38.9 % | 1.44 | -21.3 % | 783 | 24 % |
| M1 · percentile, 3 experts durs | 1.53 | 1.01 | 1.49 | 27.5 % | 1.32 | -22.5 % | 799 | 27 % |
| M2 · + poids continus | 1.91 | 1.10 | 1.62 | 30.5 % | 1.35 | -27.5 % | 810 | 27 % |
| M3 · + vol-of-vol | 1.32 | 1.20 | 1.75 | 34.5 % | 1.46 | -28.3 % | 768 | 28 % |
| M4 · + tendance/range | 1.67 | 1.23 | 1.82 | 35.9 % | 1.37 | -29.9 % | 807 | 26 % |
| M2a · poids continus sur θ seulement | 1.97 | 1.18 | 1.74 | 33.2 % | 1.37 | -24.9 % | 787 | 26 % |
| Mglob · aucun réglage adaptatif | 1.62 | 1.42 | 2.07 | 50.2 % | 1.47 | -21.6 % | 714 | 36 % |

Écarts de chaque ajout (hors échantillon) et stabilité par fenêtre :

| étape | Δ Sharpe OOS | Δ Sortino OOS | Δ Max DD OOS | Δ PF OOS | fenêtres mieux / moins bien / égales | Δ Sharpe, intervalle 90 % | P(Δ Sharpe > 0) | Δ Sharpe IS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M0wf contre M0 | −0.18 | −0.24 | +8.3 % | −0.00 | 11 / 17 / 0 | -0.42 à 0.32 | 40 % | −0.08 |
| M1 contre M0wf | −0.32 | −0.48 | −1.2 % | −0.12 | 11 / 17 / 0 | -0.62 à 0.04 | 7 % | +0.10 |
| M2 contre M1 | +0.09 | +0.13 | −5.0 % | +0.03 | 13 / 15 / 0 | -0.12 à 0.29 | 74 % | +0.39 |
| M2a contre M1 | +0.17 | +0.26 | −2.4 % | +0.05 | 15 / 13 / 0 | -0.02 à 0.36 | 93 % | +0.44 |
| M2 contre M2a | −0.08 | −0.13 | −2.6 % | −0.01 | 11 / 17 / 0 | -0.17 à 0.01 | 7 % | −0.05 |
| M3 contre M2 | +0.10 | +0.14 | −0.8 % | +0.11 | 18 / 10 / 0 | -0.13 à 0.29 | 74 % | −0.59 |
| M4 contre M3 | +0.04 | +0.06 | −1.5 % | −0.10 | 14 / 14 / 0 | -0.28 à 0.32 | 56 % | +0.35 |
| Mglob contre M0wf | +0.09 | +0.09 | −0.2 % | +0.03 | 13 / 15 / 0 | -0.33 à 0.38 | 56 % | +0.20 |

Règle (fixée avant le calcul) : une étape est gardée si Δ Sharpe OOS > 0,05, P(Δ > 0) ≥ 75 % au bootstrap par fenêtre et Max DD pas plus de 5 points plus profond.

- M1 contre M0wf : **rejetée** (ΔSharpe -0.32, P(Δ > 0) 7 %, ΔMax DD -1.2 %).
- M2 contre M0wf : **rejetée** (ΔSharpe -0.24, P(Δ > 0) 18 %, ΔMax DD -6.2 %).
- M3 contre M0wf : **rejetée** (ΔSharpe -0.14, P(Δ > 0) 28 %, ΔMax DD -7.0 %).
- M4 contre M0wf : **rejetée** (ΔSharpe -0.10, P(Δ > 0) 34 %, ΔMax DD -8.5 %).

Architecture retenue par la règle : **M0wf**. Meilleur Sharpe OOS parmi M1-M4 (hors règle) : M4.

## Résultats hors échantillon par année

| modèle | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M0 | 56 % · 1.42 | 69 % · 1.79 | 65 % · 1.68 | 27 % · 1.09 | 89 % · 2.51 | 10 % · 0.51 | 23 % · 1.49 |
| M0wf | 55 % · 1.77 | 46 % · 1.20 | 40 % · 1.19 | 21 % · 1.02 | 66 % · 2.08 | 6 % · 0.36 | 37 % · 2.08 |
| M1 | 23 % · 0.86 | 33 % · 0.96 | 21 % · 0.74 | 11 % · 0.54 | 114 % · 3.17 | 1 % · 0.16 | 9 % · 0.63 |
| M2 | 17 % · 0.70 | 39 % · 1.11 | 35 % · 1.05 | 4 % · 0.29 | 135 % · 3.56 | 3 % · 0.24 | 9 % · 0.64 |
| M3 | 20 % · 0.81 | 13 % · 0.53 | 53 % · 1.42 | 22 % · 0.94 | 131 % · 3.21 | 4 % · 0.28 | 22 % · 1.25 |
| M4 | 47 % · 1.45 | 52 % · 1.33 | 71 % · 1.78 | -3 % · -0.04 | 91 % · 2.66 | -4 % · -0.06 | 16 % · 1.01 |

Chaque case : rendement · Sharpe de l'année.

| modèle | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M0 | -26.1 % | -11.8 % | -16.2 % | -18.3 % | -16.4 % | -17.9 % | -22.0 % |
| M0wf | -16.0 % | -14.5 % | -17.6 % | -21.0 % | -13.0 % | -17.6 % | -15.5 % |
| M1 | -18.3 % | -21.4 % | -22.5 % | -20.3 % | -9.6 % | -20.9 % | -18.1 % |
| M2 | -24.3 % | -18.5 % | -25.4 % | -20.9 % | -8.1 % | -21.1 % | -17.2 % |
| M3 | -24.0 % | -18.5 % | -22.3 % | -18.8 % | -12.3 % | -16.7 % | -20.9 % |
| M4 | -21.6 % | -15.7 % | -19.7 % | -27.5 % | -10.6 % | -22.0 % | -16.1 % |

Max DD par année.

## Horizon du percentile

Horizon choisi en validation interne à chaque fenêtre, et résultat des horizons fixés sans sélection :

| modèle | 6 mois fixe | 12 mois fixe | 18 mois fixe | choisi en validation | choix (6 / 12 / 18 mois) |
| --- | --- | --- | --- | --- | --- |
| M1 | 1.08 | 1.35 | 1.38 | 1.01 | 10 / 9 / 9 |
| M2 | 0.99 | 1.12 | 1.30 | 1.10 | 10 / 8 / 10 |

| modèle | choix (6 / 12 / 18 mois) |
| --- | --- |
| M3 | 9 / 5 / 14 |
| M4 | 9 / 7 / 12 |

## Réglages choisis à chaque fenêtre

### M0wf

| test | horizon | expert calme | expert agité | global | α calme | α agité |
| --- | --- | --- | --- | --- | --- | --- |
| 2020-01-01 | 12 mois | s 3.11 · stop 2.04 · suiveur 7.94 · range 36 | s 2.73 · stop 1.82 · suiveur 6.60 · range 33 | s 3.03 · stop 2.50 · suiveur 50.00 · range 34 | 0.64 | 0.56 |
| 2020-04-01 | 12 mois | s 2.64 · stop 2.94 · suiveur 8.32 · range 26 | s 2.24 · stop 1.87 · suiveur 13.38 · range 32 | s 2.27 · stop 2.58 · suiveur 24.16 · range 37 | 0.65 | 0.50 |
| 2020-07-01 | 12 mois | s 2.92 · stop 2.50 · suiveur 8.25 · range 37 | s 2.45 · stop 1.28 · suiveur 5.11 · range 34 | s 2.69 · stop 2.04 · suiveur 21.48 · range 36 | 0.65 | 0.56 |
| 2020-10-01 | 12 mois | s 2.75 · stop 2.82 · suiveur 21.67 · range 22 | s 2.61 · stop 2.09 · suiveur 7.70 · range 33 | s 2.59 · stop 2.29 · suiveur 32.60 · range 30 | 0.67 | 0.43 |
| 2021-01-01 | 12 mois | s 2.83 · stop 2.42 · suiveur 20.92 · range 31 | s 2.46 · stop 1.61 · suiveur 6.71 · range 34 | s 2.54 · stop 2.00 · suiveur 9.44 · range 32 | 0.66 | 0.50 |
| 2021-04-01 | 12 mois | s 2.55 · stop 2.65 · suiveur 23.56 · range 26 | s 2.31 · stop 1.96 · suiveur 35.45 · range 41 | s 2.38 · stop 2.28 · suiveur 27.52 · range 34 | 0.68 | 0.42 |
| 2021-07-01 | 12 mois | s 2.62 · stop 2.15 · suiveur 28.53 · range 32 | s 2.42 · stop 1.77 · suiveur 10.61 · range 42 | s 2.34 · stop 1.68 · suiveur 42.82 · range 38 | 0.63 | 0.47 |
| 2021-10-01 | 12 mois | s 2.79 · stop 3.19 · suiveur 29.84 · range 26 | s 2.80 · stop 2.30 · suiveur 5.31 · range 35 | s 2.82 · stop 2.68 · suiveur 40.94 · range 32 | 0.60 | 0.51 |
| 2022-01-01 | 12 mois | s 2.76 · stop 2.63 · suiveur 32.22 · range 28 | s 2.18 · stop 1.89 · suiveur 46.02 · range 35 | s 2.26 · stop 1.94 · suiveur 45.02 · range 32 | 0.59 | 0.40 |
| 2022-04-01 | 12 mois | s 2.75 · stop 2.49 · suiveur 10.27 · range 29 | s 2.23 · stop 1.94 · suiveur 44.93 · range 38 | s 2.44 · stop 2.35 · suiveur 42.44 · range 34 | 0.64 | 0.43 |
| 2022-07-01 | 12 mois | s 2.82 · stop 2.95 · suiveur 46.24 · range 31 | s 2.32 · stop 1.85 · suiveur 7.07 · range 36 | s 2.43 · stop 2.47 · suiveur 48.82 · range 33 | 0.61 | 0.52 |
| 2022-10-01 | 12 mois | s 2.56 · stop 3.06 · suiveur 27.96 · range 26 | s 2.33 · stop 2.34 · suiveur 6.82 · range 33 | s 2.24 · stop 2.83 · suiveur 49.97 · range 33 | 0.66 | 0.50 |
| 2023-01-01 | 12 mois | s 2.16 · stop 2.71 · suiveur 4.65 · range 26 | s 2.37 · stop 2.38 · suiveur 4.78 · range 29 | s 2.42 · stop 3.34 · suiveur 50.00 · range 28 | 0.77 | 0.54 |
| 2023-04-01 | 12 mois | s 2.61 · stop 3.28 · suiveur 10.89 · range 27 | s 2.89 · stop 3.00 · suiveur 5.38 · range 35 | s 2.74 · stop 3.51 · suiveur 50.00 · range 34 | 0.74 | 0.47 |
| 2023-07-01 | 12 mois | s 2.05 · stop 1.19 · suiveur 6.71 · range 27 | s 2.28 · stop 2.85 · suiveur 5.24 · range 26 | s 2.32 · stop 2.94 · suiveur 50.00 · range 25 | 0.80 | 0.51 |
| 2023-10-01 | 12 mois | s 2.39 · stop 1.28 · suiveur 45.79 · range 28 | s 2.43 · stop 3.00 · suiveur 5.12 · range 25 | s 2.77 · stop 3.46 · suiveur 50.00 · range 34 | 0.79 | 0.51 |
| 2024-01-01 | 12 mois | s 3.01 · stop 4.28 · suiveur 40.93 · range 45 | s 2.41 · stop 3.13 · suiveur 4.62 · range 26 | s 2.32 · stop 3.56 · suiveur 19.68 · range 28 | 0.79 | 0.47 |
| 2024-04-01 | 12 mois | s 2.81 · stop 2.63 · suiveur 37.57 · range 30 | s 2.81 · stop 1.94 · suiveur 4.65 · range 36 | s 2.47 · stop 2.31 · suiveur 21.22 · range 25 | 0.74 | 0.47 |
| 2024-07-01 | 12 mois | s 2.55 · stop 2.36 · suiveur 37.72 · range 27 | s 2.30 · stop 3.14 · suiveur 6.15 · range 21 | s 2.43 · stop 3.31 · suiveur 33.69 · range 21 | 0.76 | 0.48 |
| 2024-10-01 | 12 mois | s 2.44 · stop 1.67 · suiveur 38.58 · range 24 | s 2.11 · stop 1.65 · suiveur 4.72 · range 21 | s 2.29 · stop 2.64 · suiveur 38.81 · range 19 | 0.76 | 0.54 |
| 2025-01-01 | 12 mois | s 2.51 · stop 2.99 · suiveur 50.00 · range 26 | s 2.35 · stop 3.18 · suiveur 6.31 · range 22 | s 2.55 · stop 3.40 · suiveur 50.00 · range 24 | 0.74 | 0.51 |
| 2025-04-01 | 12 mois | s 2.48 · stop 1.80 · suiveur 50.00 · range 25 | s 2.12 · stop 1.73 · suiveur 6.21 · range 19 | s 2.32 · stop 1.98 · suiveur 50.00 · range 21 | 0.75 | 0.53 |
| 2025-07-01 | 12 mois | s 2.66 · stop 4.06 · suiveur 50.00 · range 27 | s 2.47 · stop 3.90 · suiveur 10.12 · range 22 | s 2.75 · stop 3.92 · suiveur 50.00 · range 23 | 0.73 | 0.45 |
| 2025-10-01 | 12 mois | s 2.59 · stop 1.10 · suiveur 50.00 · range 27 | s 2.24 · stop 1.55 · suiveur 8.82 · range 17 | s 2.64 · stop 1.35 · suiveur 50.00 · range 17 | 0.78 | 0.49 |
| 2026-01-01 | 12 mois | s 3.14 · stop 1.53 · suiveur 50.00 · range 26 | s 2.83 · stop 2.04 · suiveur 5.42 · range 22 | s 3.13 · stop 1.82 · suiveur 50.00 · range 25 | 0.72 | 0.51 |
| 2026-04-01 | 12 mois | s 2.59 · stop 1.07 · suiveur 50.00 · range 27 | s 2.38 · stop 0.96 · suiveur 5.71 · range 24 | s 2.87 · stop 1.05 · suiveur 50.00 · range 22 | 0.76 | 0.56 |
| 2026-07-01 | 12 mois | s 3.12 · stop 2.73 · suiveur 50.00 · range 29 | s 3.06 · stop 2.46 · suiveur 21.41 · range 24 | s 3.14 · stop 2.21 · suiveur 50.00 · range 28 | 0.67 | 0.43 |
| 2026-10-01 | 12 mois | s 2.84 · stop 1.84 · suiveur 50.00 · range 26 | s 2.44 · stop 1.10 · suiveur 5.56 · range 24 | s 3.04 · stop 1.56 · suiveur 50.00 · range 22 | 0.71 | 0.59 |

### M2

| test | horizon | expert bas | expert moyen | expert haut | global | α bas | α moyen | α haut |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2020-01-01 | 6 mois | s 2.91 · stop 1.71 · suiveur 32.78 · range 34 | s 2.86 · stop 2.29 · suiveur 13.82 · range 38 | s 2.73 · stop 1.90 · suiveur 11.90 · range 40 | s 2.71 · stop 2.31 · suiveur 50.00 · range 41 | 0.62 | 0.40 | 0.40 |
| 2020-04-01 | 12 mois | s 2.42 · stop 2.72 · suiveur 18.87 · range 35 | s 2.51 · stop 2.95 · suiveur 6.42 · range 32 | s 2.29 · stop 2.48 · suiveur 9.74 · range 35 | s 2.27 · stop 2.58 · suiveur 24.16 · range 37 | 0.55 | 0.52 | 0.40 |
| 2020-07-01 | 12 mois | s 2.45 · stop 2.28 · suiveur 27.71 · range 38 | s 2.75 · stop 2.12 · suiveur 9.40 · range 32 | s 2.60 · stop 1.52 · suiveur 6.95 · range 29 | s 2.69 · stop 2.04 · suiveur 21.48 · range 36 | 0.57 | 0.46 | 0.44 |
| 2020-10-01 | 18 mois | s 2.56 · stop 3.26 · suiveur 15.41 · range 38 | s 2.67 · stop 2.48 · suiveur 5.11 · range 43 | s 2.42 · stop 1.75 · suiveur 5.19 · range 41 | s 2.45 · stop 2.38 · suiveur 9.39 · range 44 | 0.52 | 0.56 | 0.38 |
| 2021-01-01 | 12 mois | s 2.53 · stop 2.36 · suiveur 17.79 · range 32 | s 2.70 · stop 2.17 · suiveur 5.60 · range 30 | s 2.53 · stop 2.00 · suiveur 6.03 · range 32 | s 2.54 · stop 2.00 · suiveur 9.44 · range 32 | 0.61 | 0.50 | 0.35 |
| 2021-04-01 | 12 mois | s 2.57 · stop 2.99 · suiveur 29.25 · range 33 | s 2.68 · stop 2.51 · suiveur 6.96 · range 34 | s 2.55 · stop 2.07 · suiveur 6.43 · range 35 | s 2.38 · stop 2.28 · suiveur 27.52 · range 34 | 0.59 | 0.50 | 0.35 |
| 2021-07-01 | 18 mois | s 2.56 · stop 2.20 · suiveur 41.20 · range 34 | s 2.60 · stop 1.65 · suiveur 10.41 · range 40 | s 2.29 · stop 1.32 · suiveur 8.32 · range 42 | s 2.26 · stop 1.41 · suiveur 45.47 · range 44 | 0.55 | 0.50 | 0.40 |
| 2021-10-01 | 12 mois | s 2.85 · stop 3.16 · suiveur 37.22 · range 29 | s 2.92 · stop 2.65 · suiveur 8.11 · range 32 | s 2.84 · stop 2.28 · suiveur 6.17 · range 35 | s 2.82 · stop 2.68 · suiveur 40.94 · range 32 | 0.50 | 0.48 | 0.39 |
| 2022-01-01 | 6 mois | s 2.66 · stop 2.56 · suiveur 41.38 · range 30 | s 2.63 · stop 1.86 · suiveur 29.14 · range 29 | s 2.33 · stop 1.74 · suiveur 39.80 · range 33 | s 2.39 · stop 2.00 · suiveur 42.60 · range 33 | 0.51 | 0.44 | 0.30 |
| 2022-04-01 | 6 mois | s 2.70 · stop 2.65 · suiveur 39.24 · range 30 | s 2.71 · stop 2.33 · suiveur 11.26 · range 32 | s 2.53 · stop 2.43 · suiveur 9.52 · range 35 | s 2.49 · stop 2.54 · suiveur 43.65 · range 31 | 0.53 | 0.47 | 0.38 |
| 2022-07-01 | 18 mois | s 2.55 · stop 1.99 · suiveur 54.88 · range 37 | s 2.47 · stop 1.52 · suiveur 24.21 · range 38 | s 2.20 · stop 1.32 · suiveur 6.94 · range 37 | s 2.15 · stop 1.55 · suiveur 49.13 · range 40 | 0.52 | 0.43 | 0.45 |
| 2022-10-01 | 18 mois | s 2.32 · stop 3.31 · suiveur 50.51 · range 37 | s 2.32 · stop 3.09 · suiveur 14.83 · range 34 | s 2.23 · stop 2.32 · suiveur 6.49 · range 39 | s 2.16 · stop 2.69 · suiveur 48.04 · range 42 | 0.54 | 0.51 | 0.41 |
| 2023-01-01 | 12 mois | s 2.49 · stop 3.30 · suiveur 44.65 · range 28 | s 2.51 · stop 2.99 · suiveur 9.75 · range 24 | s 2.41 · stop 2.60 · suiveur 6.38 · range 26 | s 2.42 · stop 3.34 · suiveur 50.00 · range 28 | 0.63 | 0.58 | 0.41 |
| 2023-04-01 | 18 mois | s 2.54 · stop 3.46 · suiveur 44.65 · range 35 | s 2.76 · stop 3.42 · suiveur 10.92 · range 33 | s 2.95 · stop 3.10 · suiveur 7.59 · range 35 | s 2.85 · stop 3.42 · suiveur 50.00 · range 35 | 0.62 | 0.49 | 0.34 |
| 2023-07-01 | 18 mois | s 2.31 · stop 2.78 · suiveur 59.74 · range 31 | s 2.43 · stop 1.94 · suiveur 34.13 · range 32 | s 2.48 · stop 2.15 · suiveur 8.42 · range 33 | s 2.34 · stop 2.75 · suiveur 50.00 · range 29 | 0.67 | 0.46 | 0.34 |
| 2023-10-01 | 18 mois | s 2.71 · stop 2.56 · suiveur 46.22 · range 29 | s 2.80 · stop 2.89 · suiveur 13.40 · range 28 | s 3.04 · stop 2.44 · suiveur 8.16 · range 31 | s 3.03 · stop 2.27 · suiveur 50.00 · range 30 | 0.68 | 0.48 | 0.32 |
| 2024-01-01 | 6 mois | s 2.35 · stop 2.74 · suiveur 24.16 · range 32 | s 2.34 · stop 2.04 · suiveur 5.06 · range 31 | s 2.38 · stop 2.50 · suiveur 4.52 · range 28 | s 2.45 · stop 3.49 · suiveur 16.22 · range 30 | 0.66 | 0.59 | 0.41 |
| 2024-04-01 | 6 mois | s 2.72 · stop 2.10 · suiveur 42.12 · range 26 | s 2.46 · stop 1.24 · suiveur 21.89 · range 21 | s 2.29 · stop 1.27 · suiveur 7.98 · range 20 | s 2.34 · stop 1.19 · suiveur 33.83 · range 16 | 0.63 | 0.53 | 0.38 |
| 2024-07-01 | 6 mois | s 2.18 · stop 1.18 · suiveur 29.95 · range 26 | s 2.27 · stop 1.27 · suiveur 6.60 · range 27 | s 2.19 · stop 1.65 · suiveur 5.52 · range 23 | s 2.23 · stop 1.07 · suiveur 22.10 · range 26 | 0.71 | 0.59 | 0.41 |
| 2024-10-01 | 12 mois | s 2.31 · stop 1.83 · suiveur 29.60 · range 23 | s 2.17 · stop 1.63 · suiveur 5.34 · range 21 | s 2.17 · stop 2.06 · suiveur 5.68 · range 19 | s 2.29 · stop 2.64 · suiveur 38.81 · range 19 | 0.70 | 0.63 | 0.43 |
| 2025-01-01 | 6 mois | s 2.06 · stop 1.14 · suiveur 26.48 · range 23 | s 2.17 · stop 1.23 · suiveur 4.91 · range 25 | s 2.15 · stop 1.58 · suiveur 4.61 · range 20 | s 2.20 · stop 1.03 · suiveur 22.89 · range 21 | 0.70 | 0.62 | 0.45 |
| 2025-04-01 | 6 mois | s 2.43 · stop 2.25 · suiveur 53.86 · range 21 | s 2.31 · stop 1.41 · suiveur 21.63 · range 18 | s 2.13 · stop 1.41 · suiveur 7.62 · range 19 | s 2.26 · stop 1.40 · suiveur 49.00 · range 18 | 0.63 | 0.59 | 0.44 |
| 2025-07-01 | 6 mois | s 2.68 · stop 3.08 · suiveur 32.13 · range 21 | s 2.52 · stop 2.35 · suiveur 5.26 · range 25 | s 2.49 · stop 3.25 · suiveur 5.06 · range 23 | s 2.89 · stop 4.06 · suiveur 47.96 · range 23 | 0.67 | 0.63 | 0.45 |
| 2025-10-01 | 6 mois | s 2.90 · stop 1.73 · suiveur 56.21 · range 24 | s 2.48 · stop 1.19 · suiveur 29.98 · range 19 | s 2.22 · stop 1.23 · suiveur 8.66 · range 18 | s 2.53 · stop 1.05 · suiveur 49.05 · range 18 | 0.64 | 0.54 | 0.43 |
| 2026-01-01 | 12 mois | s 3.10 · stop 1.65 · suiveur 33.85 · range 25 | s 2.85 · stop 1.86 · suiveur 5.66 · range 28 | s 2.73 · stop 2.23 · suiveur 5.18 · range 26 | s 3.13 · stop 1.82 · suiveur 50.00 · range 25 | 0.64 | 0.59 | 0.43 |
| 2026-04-01 | 18 mois | s 2.62 · stop 2.91 · suiveur 61.78 · range 20 | s 2.86 · stop 2.25 · suiveur 32.75 · range 23 | s 2.61 · stop 1.72 · suiveur 7.34 · range 23 | s 3.02 · stop 2.30 · suiveur 50.00 · range 25 | 0.70 | 0.41 | 0.46 |
| 2026-07-01 | 18 mois | s 3.09 · stop 3.11 · suiveur 53.18 · range 28 | s 3.05 · stop 2.81 · suiveur 43.70 · range 28 | s 2.88 · stop 3.12 · suiveur 24.59 · range 27 | s 3.11 · stop 2.75 · suiveur 50.00 · range 28 | 0.62 | 0.43 | 0.32 |
| 2026-10-01 | 18 mois | s 3.04 · stop 3.33 · suiveur 61.79 · range 28 | s 2.97 · stop 2.60 · suiveur 29.78 · range 24 | s 2.65 · stop 2.34 · suiveur 6.76 · range 21 | s 3.10 · stop 3.02 · suiveur 50.00 · range 27 | 0.62 | 0.47 | 0.49 |

### Inclinaisons de M3

Écart de θ entre la moitié haute et la moitié basse de la variable (en crans de grille), après rétrécissement :

| réglage | moyenne | P10 | P90 | même signe que la médiane |
| --- | --- | --- | --- | --- |
| vol-of-vol · s | 0.34 | -0.84 | 1.97 | 64 % |
| vol-of-vol · atrStopMult | -0.44 | -1.84 | 0.84 | 75 % |
| vol-of-vol · atrTrailMult | -0.70 | -2.20 | 0.62 | 68 % |
| vol-of-vol · rangeWin | -0.07 | -0.77 | 0.42 | 54 % |

### Inclinaisons de M4

Écart de θ entre la moitié haute et la moitié basse de la variable (en crans de grille), après rétrécissement :

| réglage | moyenne | P10 | P90 | même signe que la médiane |
| --- | --- | --- | --- | --- |
| vol-of-vol · s | 0.13 | -1.23 | 1.38 | 61 % |
| vol-of-vol · atrStopMult | -0.26 | -1.80 | 1.03 | 68 % |
| vol-of-vol · atrTrailMult | -0.61 | -2.16 | 0.30 | 57 % |
| vol-of-vol · rangeWin | -0.04 | -0.56 | 0.45 | 57 % |

| réglage | moyenne | P10 | P90 | même signe que la médiane |
| --- | --- | --- | --- | --- |
| tendance/range · s | -0.31 | -1.51 | 0.43 | 54 % |
| tendance/range · atrStopMult | -0.79 | -1.85 | 0.94 | 82 % |
| tendance/range · atrTrailMult | 0.22 | -0.51 | 1.82 | 61 % |
| tendance/range · rangeWin | 0.32 | -0.12 | 0.74 | 86 % |

## Stabilité des réglages calibrés

Variation moyenne d'une fenêtre à la suivante, en crans de grille (moyenne sur les experts) ; une surface qui zigzague a des valeurs élevées.

| modèle | s | atrStopMult | atrTrailMult | rangeWin | moyenne |
| --- | --- | --- | --- | --- | --- |
| M0wf | 1.15 | 1.06 | 0.45 | 0.24 | 0.73 |
| Mglob | 1.07 | 0.85 | 0.15 | 0.25 | 0.58 |
| M1 | 0.96 | 0.92 | 0.49 | 0.25 | 0.66 |
| M2 | 0.92 | 0.88 | 0.48 | 0.27 | 0.64 |
| M2a | 0.92 | 0.88 | 0.48 | 0.27 | 0.64 |
| M3 | 0.96 | 0.94 | 0.46 | 0.26 | 0.65 |
| M4 | 0.98 | 1.02 | 0.47 | 0.29 | 0.69 |

## Surface calibrée sur tout l'historique (IS, pour lecture)

| percentile de vol | poids bas / moyen / haut | s | stop × ATR | suiveur × ATR | rangeWin |
| --- | --- | --- | --- | --- | --- |
| 5 % | 0.99 / 0.01 / 0.00 | 3.06 | 3.11 | 65.9 | 28 |
| 20 % | 0.88 / 0.12 / 0.00 | 3.05 | 2.96 | 57.6 | 28 |
| 35 % | 0.44 / 0.56 / 0.01 | 3.01 | 2.38 | 32.5 | 27 |
| 50 % | 0.07 / 0.86 / 0.07 | 2.95 | 1.97 | 16.7 | 27 |
| 65 % | 0.01 / 0.56 / 0.44 | 2.77 | 1.81 | 7.5 | 29 |
| 80 % | 0.00 / 0.12 / 0.88 | 2.56 | 1.70 | 4.5 | 31 |
| 95 % | 0.00 / 0.01 / 0.99 | 2.51 | 1.67 | 4.1 | 31 |

Horizon : 18 mois. Préréglage actuel : calme s 2.90 · stop 3.30 · suiveur 50.00 · range 15 ; agité s 2.00 · stop 1.10 · suiveur 3.20 · range 50.

## Robustesse des architectures (voisins ±5 / 10 / 20 %)

Pour chaque voisin, les réglages des experts de toutes les fenêtres et les réglages de base actifs (volWin, wickThr, htfEmaLen, volZWin, volZThr, atrLen, TP1) sont perturbés en même temps, du même facteur dans toutes les fenêtres ; le walk-forward hors échantillon est rejoué. 100 voisins par niveau.

| modèle | niveau | Sharpe OOS du modèle | Sharpe P10 · P25 · méd. · P75 · P90 | rentables | PF > 1 | Max DD méd. (P10) | modèle meilleur que |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M0wf | ±5 % | 1.33 | 1.11 · 1.16 · 1.22 · 1.26 · 1.30 | 100 % | 100 % | -23.7 % (-27.2 %) | 96 % |
| M0wf | ±10 % | 1.33 | 0.98 · 1.04 · 1.12 · 1.23 · 1.29 | 100 % | 100 % | -25.1 % (-31.8 %) | 95 % |
| M0wf | ±20 % | 1.33 | 0.84 · 0.97 · 1.09 · 1.18 · 1.25 | 100 % | 100 % | -27.2 % (-33.4 %) | 95 % |
| M2 | ±5 % | 1.10 | 1.08 · 1.12 · 1.16 · 1.20 · 1.26 | 100 % | 100 % | -25.7 % (-27.6 %) | 14 % |
| M2 | ±10 % | 1.10 | 1.01 · 1.07 · 1.13 · 1.21 · 1.27 | 100 % | 100 % | -25.9 % (-28.8 %) | 33 % |
| M2 | ±20 % | 1.10 | 0.86 · 0.96 · 1.08 · 1.20 · 1.32 | 100 % | 100 % | -27.7 % (-33.9 %) | 55 % |
| M4 | ±5 % | 1.23 | 1.08 · 1.13 · 1.19 · 1.23 · 1.31 | 100 % | 100 % | -27.1 % (-30.8 %) | 75 % |
| M4 | ±10 % | 1.23 | 0.92 · 1.01 · 1.09 · 1.16 · 1.23 | 100 % | 100 % | -27.1 % (-31.9 %) | 91 % |
| M4 | ±20 % | 1.23 | 0.86 · 0.95 · 1.05 · 1.15 · 1.24 | 100 % | 100 % | -28.3 % (-33.3 %) | 89 % |

## Méthode

- Réglages adaptatifs (4) : seuil effectif du choc `s` (calme : kMain ; agité : kMicro − 0,2), `atrStopMult`, `atrTrailMult`, `rangeWin`. Grille : s {1.8, 2, 2.2, 2.45, 2.7, 2.95, 3.2} ; atrStopMult {0.8, 1.1, 1.6, 2.3, 3.3, 4.5} ; atrTrailMult {2.2, 3.2, 5, 10, 50} ; rangeWin {15, 30, 50}.
- Réglages fixes : tous les autres, valeurs du préréglage. Ceux qui diffèrent entre calme et agité (volWin, wickThr, htfEmaLen, volZWin, volZThr, atrLen, TP1) basculent à la médiane dans M0, M0wf, M1, M2a, et sont interpolés avec les poids dans M2, M3, M4 (expert moyen = milieu des deux jeux). Shorts autorisés et TP1 restent des interrupteurs à la médiane, comme aujourd'hui.
- État : volatilité réalisée (écart type des rendements journaliers sur 20 jours), rang percentile parmi les H jours précédents ; vol-of-vol : coefficient de variation de cette volatilité sur 60 jours, puis son rang ; tendance/range : rapport d'efficacité sur 30 jours, puis son rang. Chaque bougie prend l'état du dernier jour clos.
- Poids : noyaux gaussiens centrés sur 1/6, 1/2, 5/6 du percentile, σ = 0,15, normalisés. θ(t) = Σ w θ_expert (+ 2 (q − 0,5) Δ pour chaque variable secondaire, q borné à [0,25 ; 0,75]), en crans de grille. État quantifié par pas de 5 % (percentile) et 25 % (variables secondaires) : un jeu de réglages complet par état, comme le mode adaptatif actuel.
- Les trades des points de grille sont rattachés à la cellule de leur bougie d'entrée ; une position garde les réglages de son entrée jusqu'à sa sortie, en calibration comme en test.
- Tests concaténés : chaque fenêtre est simulée sur une tranche (30 jours de préchauffage) ; une position ouverte à la fin d'une fenêtre est menée à sa sortie avec ses réglages, la fenêtre suivante commence ensuite.
- Bootstrap : 28 fenêtres tirées avec remise, 2000 tirages, Sharpe des rendements journaliers.
