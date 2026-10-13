# Shock Fade Engine — contrôles du pipeline sur données simulées

Généré par `research/fade/shockfade/run_synthetic.py`. Trois ans de minutes simulées (volatilité stochastique, saisonnalité, sauts Hawkes **symétriques** de 6 + Exp(4) écarts types, flux corrélé), pipeline complet identique aux données réelles : estimations trimestrielles, chocs |Z| ≥ 4 à 5 min, walk-forward 2021-07 → 2022-12.

- **Contrôle négatif** : aucune composante transitoire ; la direction du saut suivant est imprévisible. Attendu : Fade brut ≈ 0, aucun modèle meilleur que M1, aucune sélection.
- **Contrôle positif** : 40 % de chaque saut est transitoire (demi-vie 10 min). Attendu : Fade brut > 0 aux horizons courts, l'état-espace retrouve une part transitoire des sauts, les modèles OU battent M1.

## Contrôle négatif

Sauts simulés 6301, détectés (Lee–Mykland) 5768 ; chocs |Z| ≥ 4 : 2248 ; durée 32 s.

Hawkes (1er trimestre) : μ = [0.00116, 0.00099], α/β = [[0.183, 0.181], [0.169, 0.205]] (vrai : 0,2 partout).

État-espace : demi-vie médiane 40.90 min, part transitoire des sauts ψ_J médiane 0.001, LR « pas de transitoire » médian 0.

| horizon (barres 5 min) | Fade brut moyen (pb) | t (groupé par jour) | n |
|---:|---:|---:|---:|
| 1 | 0.17 | 0.40 | 2248 |
| 2 | 0.62 | 1.11 | 2248 |
| 4 | 0.62 | 0.81 | 2248 |
| 8 | 1.05 | 1.11 | 2248 |
| 16 | 0.61 | 0.55 | 2248 |
| 32 | 0.56 | 0.41 | 2248 |

Clark–West contre M1 : plus petite p-valeur ajustée (Holm, M2…M7 × 6 horizons) = 0.808.

| modèle | h=1 | h=2 | h=4 | h=8 | h=16 | h=32 |
|---|---:|---:|---:|---:|---:|---:|
| M2 R²_OOS (p) | -0.16 % (0.879) | -0.07 % (0.685) | -0.12 % (0.618) | -0.13 % (0.676) | -0.04 % (0.553) | 0.05 % (0.203) |
| M3 R²_OOS (p) | -0.42 % (0.825) | 0.11 % (0.142) | 0.07 % (0.217) | -0.28 % (0.739) | -0.19 % (0.507) | -0.45 % (0.918) |
| M4 R²_OOS (p) | -0.18 % (0.584) | -0.14 % (0.723) | -0.43 % (0.723) | 0.35 % (0.022) | -0.25 % (0.675) | -0.10 % (0.501) |
| M5 R²_OOS (p) | -0.59 % (0.747) | -0.03 % (0.265) | -0.37 % (0.649) | 0.13 % (0.124) | -0.37 % (0.627) | -0.48 % (0.801) |
| M6 R²_OOS (p) | -0.43 % (0.652) | 0.04 % (0.128) | -0.21 % (0.340) | 0.27 % (0.090) | -0.31 % (0.488) | -0.36 % (0.651) |
| M7 R²_OOS (p) | -0.65 % (0.814) | -0.08 % (0.157) | -0.43 % (0.447) | 0.08 % (0.139) | -0.27 % (0.369) | -0.23 % (0.307) |
| CTRL R²_OOS (p) | 0.47 % (0.009) | 0.13 % (0.118) | 0.96 % (0.004) | 0.89 % (0.002) | 0.66 % (0.010) | 0.61 % (0.013) |

Sélection (règle du protocole) : None ; score de recherche : None.

## Contrôle positif

Sauts simulés 6301, détectés (Lee–Mykland) 5773 ; chocs |Z| ≥ 4 : 2038 ; durée 45 s.

Hawkes (1er trimestre) : μ = [0.00116, 0.00099], α/β = [[0.182, 0.184], [0.17, 0.203]] (vrai : 0,2 partout).

État-espace : demi-vie médiane 15.44 min, part transitoire des sauts ψ_J médiane 0.650, LR « pas de transitoire » médian 678.

| horizon (barres 5 min) | Fade brut moyen (pb) | t (groupé par jour) | n |
|---:|---:|---:|---:|
| 1 | 5.30 | 11.78 | 2038 |
| 2 | 9.10 | 15.81 | 2038 |
| 4 | 13.05 | 17.93 | 2038 |
| 8 | 16.50 | 19.67 | 2038 |
| 16 | 16.63 | 17.38 | 2038 |
| 32 | 17.00 | 13.19 | 2038 |

Clark–West contre M1 : plus petite p-valeur ajustée (Holm, M2…M7 × 6 horizons) = 2.78e-05.

| modèle | h=1 | h=2 | h=4 | h=8 | h=16 | h=32 |
|---|---:|---:|---:|---:|---:|---:|
| M2 R²_OOS (p) | 0.01 % (0.240) | 0.19 % (0.058) | -0.05 % (0.416) | -0.05 % (0.584) | -0.15 % (0.856) | -0.31 % (0.895) |
| M3 R²_OOS (p) | -0.44 % (0.505) | -0.13 % (0.709) | -0.29 % (0.904) | -0.03 % (0.344) | 0.23 % (0.082) | -0.04 % (0.250) |
| M4 R²_OOS (p) | 1.11 % (0.009) | 1.72 % (0.000) | 1.21 % (0.006) | 1.25 % (0.001) | -0.17 % (0.028) | 0.36 % (0.058) |
| M5 R²_OOS (p) | 0.66 % (0.042) | 1.71 % (0.000) | 0.94 % (0.008) | 1.03 % (0.001) | -0.16 % (0.019) | 0.06 % (0.066) |
| M6 R²_OOS (p) | 1.12 % (0.002) | 1.67 % (0.000) | 1.37 % (0.001) | 0.93 % (0.001) | -0.44 % (0.024) | -0.05 % (0.085) |
| M7 R²_OOS (p) | 1.18 % (0.001) | 1.97 % (0.000) | 1.36 % (0.001) | 0.92 % (0.001) | -0.51 % (0.027) | -0.18 % (0.100) |
| CTRL R²_OOS (p) | -0.13 % (0.638) | -0.67 % (0.419) | -0.67 % (0.683) | -0.62 % (0.587) | -0.25 % (0.520) | -0.03 % (0.596) |

Sélection (règle du protocole) : None ; score de recherche : {'model': 'M7', 'h': 2, 'p_holm_F3': 2.7837434516038792e-05}.

## Contrôle négatif, trois graines : OU naïf sur prix brut

Pente de la régression du Fade brut sur ρ^naïf (t groupé par jour, tout l'échantillon) et Clark–West hors échantillon contre M1. Sous le contrôle négatif, le prix est une martingale : tout pouvoir prédictif est fortuit.

| graine | n | h | Fade brut (pb) | pente | t | R²_OOS | p Clark–West |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 11 | 2248 | 1 | 0.17 | -0.863 | -2.52 | 0.47 % | 0.009 |
| 11 | 2248 | 4 | 0.62 | -0.606 | -2.59 | 0.96 % | 0.004 |
| 11 | 2248 | 16 | 0.61 | -0.272 | -2.86 | 0.66 % | 0.010 |
| 23 | 2185 | 1 | -0.48 | -0.307 | -1.07 | 0.00 % | 0.373 |
| 23 | 2185 | 4 | -1.03 | -0.167 | -1.00 | 0.05 % | 0.281 |
| 23 | 2185 | 16 | 0.23 | 0.018 | 0.18 | -0.15 % | 0.693 |
| 37 | 2253 | 1 | 0.29 | -0.437 | -0.82 | -0.45 % | 0.442 |
| 37 | 2253 | 4 | 0.64 | -0.239 | -1.04 | 0.03 % | 0.292 |
| 37 | 2253 | 16 | 1.15 | -0.121 | -1.02 | -0.03 % | 0.406 |

Lecture : une graine sur trois donne une p-valeur < 0,01 au contrôle naïf, les deux autres rien ; le signe est celui de la continuation, pas de la réversion. Un test isolé non corrigé peut donc « valider » un modèle sur une marche aléatoire : d'où les corrections de Holm et le holdout.

