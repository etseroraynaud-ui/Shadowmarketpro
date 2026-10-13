# Hawkes / Merton × Shock Engine V1 (régime calme) — valeur incrémentale

Généré par `research/fade/shockfade/v1_hawkes.py`. V1 non modifiée ; trades exportés en lecture seule par `research/fade/v1/export-v1-trades.ts` (même chemin que `research/shock/reference.ts`). Aucun modèle réestimé : paramètres Hawkes trimestriels et détecteur de sauts existants (`research/fade/`). Aucun seuil choisi après lecture.

## Verdict

| | Statistique | Économique | Verdict |
|---|---|---|---|
| **Hawkes** | prévoit mieux que les indicateurs de V1 un **saut défavorable dans l'heure** (R²_OOS +2.1 %, p Holm 0.01) ; rien sur R, MFE, MAE, pertes pleines ni coût d'exécution ; pas mieux qu'une simple fréquence glissante après correction (p Holm 1.00) | filtre et réduction de taille : ΔSharpe dans le bruit, R total en baisse, comme avec les seuls indicateurs de V1 | **non démontré** |
| **Merton** (sauts) | aucun gain hors échantillon face au z-score de V1 sur les six résultats (meilleure p Holm 0.16) | idem | **inutile** pour V1 en l'état |

Règle d'arrêt atteinte : aucune valeur prédictive supplémentaire face aux références simples sur un résultat qui pèse économiquement (R, pertes, MAE, MFE, coût). Les trades jugés « risqués » contiennent aussi de gros gagnants : tout filtre ou réduction de taille « par risque » coupe la queue droite qui fait la performance de V1. Tests significatifs après Holm : y_adv60|BH vs B.

## 1. Couverture et correspondance

- Trades V1 : **716** (BTC 358, ETH 358). Analysés : **691** (2018-09 → 2019-12 : 141, 2020-07 → 2026-09 : 550). Non couverts : 24 (2020-01 → 2020-06 : aucun paramètre Hawkes estimé chronologiquement pour ce semestre ; pas de réestimation). Trou de données Binance sur la bougie de signal : ETH-20241028T2215-L.
- Sources : V1 décide sur Bitstamp BTC/USD et Binance ETH/USDT comptant (15 min) ; Hawkes et sauts sur Binance 1 min (comptant avant 2020, perpétuel ensuite). Horodatage : variables calculées sur les minutes closes au plus tard à la clôture T de la bougie de signal (heure d'entrée de V1).
- Contrôle : le rendement Binance de la bougie de signal a le signe du trade dans 100.0 % des cas, corrélation |rendement Binance| / |z|·σ de V1 = 0.99 ; par actif et période : BTC perp 100.0 %, BTC pre 100.0 %, ETH perp 100.0 %, ETH pre 100.0 %.

- Le sous-ensemble « calme » des 1 311 trades E2 (`research/reports/proba/dataset.csv`) ne compte que 714 trades (ETH 356) : retirer les entrées agitées libère des positions, et V1 compte deux trades ETH de plus. D'où l'export exact de V1.

## 2. Variables (connues à la clôture T de la bougie de signal)

| groupe | variable | définition |
|---|---|---|
| Hawkes | `h_log_same`, `h_log_opp` | log(λ / μ) dans le sens du trade et en sens opposé (paramètres du trimestre, estimés sur les 180 j précédents) |
| Hawkes | `h_asym` | log(λ même sens / λ opposé) |
| Hawkes | `h_exc_same60`, `h_adv60` | sauts attendus sur 60 min : excitation résiduelle dans le sens du trade (décroissance des noyaux) ; total en sens opposé (μ + excitation) |
| fréquence simple | `c_same60`, `c_opp60`, `c_all24h` | sauts identifiés comptés sur les 60 dernières minutes (même sens, opposés) et les 24 dernières heures |
| Merton | `j_same`, `j_n`, `j_maxL`, `j_share` | saut Lee–Mykland dans le sens du trade dans la bougie de signal, nombre de sauts, L maximal, part du mouvement due aux sauts |
| V1 (référence) | `f_absZ`, `f_lamPct`, `f_volZ`, `f_breakAtr`, sens, actif | z-score, λ de V1, volume, distance de cassure |

Résultats mesurés : R net, MFE et MAE (en R, moteur V1), perte pleine (R ≤ −1, 61 % des trades), au moins un saut identifié contre le trade dans l'heure qui suit l'entrée, coût de latence d'une minute (proxy : déplacement Binance dans le sens du trade entre T et T + 1 min).

## 3. Valeur prédictive incrémentale (hors échantillon, années 2020 → 2026, entraînement sur les années passées)

B = indicateurs de V1 (|z|, λ de V1, volume, distance de cassure, sens, actif). BH = B + Hawkes (log λ même sens / μ, log λ opposé / μ, nombre attendu de sauts défavorables sur 60 min). BF = B + fréquence glissante (sauts même sens et opposés sur 60 min, tous sur 24 h). BM = B + Merton (saut identifié dans la bougie de signal, L max, nombre de sauts). R²_OOS relatif à B ; Clark–West unilatéral (BH, BF, BM contre B) ; Diebold–Mariano bilatéral (BH contre BF) ; erreurs groupées par jour ; Holm sur les 24 tests.

| résultat | BH vs B : R²_OOS (p Holm) | BF vs B | BM vs B | BH vs BF : gain (p Holm) |
|---|---|---|---|---|
| R (net) | -0.61 % (1.00) | +0.09 % (1.00) | -1.15 % (1.00) | -0.1894 (1.00) |
| MFE (log(1 + MFE_R)) | -0.97 % (1.00) | -1.79 % (1.00) | -1.33 % (1.00) | +0.0062 (1.00) |
| MAE (R) | -1.49 % (1.00) | -1.02 % (1.00) | +0.31 % (1.00) | -0.0006 (1.00) |
| perte pleine (R ≤ −1) | +0.24 % (1.00) | -1.37 % (1.00) | +0.54 % (0.16) | +0.0039 (1.00) |
| saut défavorable < 60 min | +2.14 % (0.01) | -0.41 % (1.00) | -0.21 % (1.00) | +0.0053 (1.00) |
| coût de latence 1 min (pb, proxy) | -1.79 % (1.00) | -1.52 % (1.00) | -5.27 % (1.00) | -2.1232 (1.00) |

Lecture : Hawkes ne bat les indicateurs de V1 que sur la survenue d'un saut défavorable dans l'heure ; la fréquence glissante n'y parvient pas, mais l'écart direct Hawkes − fréquence n'est pas significatif après correction. Sur les résultats qui comptent pour le P&L, aucun ajout ne prévoit mieux que V1 seule (R²_OOS ≤ +0,6 %, aucun test significatif).

Corrélations de rang (descriptif, tous les trades analysés) :

| variable | R | MFE | MAE | perte pleine | saut défavorable < 60 min | coût 1 min |
|---|---:|---:|---:|---:|---:|---:|
| `h_log_same` | -0.023 | +0.042 | -0.017 | +0.027 | +0.209 | +0.038 |
| `h_log_opp` | -0.050 | +0.046 | -0.020 | +0.028 | +0.192 | +0.034 |
| `h_adv60` | -0.076 | +0.058 | -0.035 | +0.024 | +0.192 | +0.043 |
| `h_asym` | +0.004 | -0.007 | -0.027 | +0.042 | +0.137 | +0.021 |
| `h_exc_same60` | -0.039 | +0.050 | -0.019 | +0.027 | +0.218 | +0.040 |
| `c_same60` | -0.081 | +0.012 | -0.045 | +0.048 | +0.161 | +0.025 |
| `c_opp60` | -0.003 | -0.007 | -0.013 | -0.003 | -0.021 | -0.089 |
| `c_all24h` | -0.015 | +0.030 | +0.014 | -0.021 | +0.109 | +0.019 |
| `j_same` | -0.087 | -0.013 | -0.062 | +0.092 | +0.142 | +0.043 |
| `j_maxL` | -0.034 | +0.031 | -0.018 | +0.015 | +0.204 | +0.036 |
| `j_n` | -0.073 | +0.022 | -0.051 | +0.056 | +0.170 | +0.017 |
| `j_share` | -0.068 | +0.007 | -0.053 | +0.051 | +0.136 | +0.034 |
| `f_absZ` | +0.007 | +0.117 | +0.048 | -0.054 | +0.165 | +0.019 |
| `f_lamPct` | +0.035 | +0.025 | +0.018 | -0.030 | -0.009 | -0.000 |

## 4. Impact économique (règles fixées avant calcul, hors échantillon 2020-07 → 2026-09)

Règle : un trade est « à risque » si sa probabilité prévue de perte pleine dépasse le 80e centile des valeurs ajustées de l'entraînement. Filtre = trade retiré ; taille ½ = exposition divisée par deux. Sharpe et drawdown approchés (rendements des trades sur leur sleeve × 0,5, à la date de sortie, sans recomposition). Base : 550 trades, Sharpe 1.72, drawdown -16.3 %. ΔR total : IC bootstrap par blocs de 3 mois ; ΔSharpe : IC par blocs mensuels.

| modèle | règle | trades signalés | dont gagnants | R des signalés | taux de perte pleine des signalés | ΔR total [IC 95 %] | Sharpe | ΔSharpe [IC 95 %] | drawdown |
|---|---|---:|---:|---:|---:|---|---:|---|---:|
| B | filtre | 116 | 30 | +140.0 | 66 % | -140.0 [-248.7 ; -40.5] | 1.65 | -0.07 [-0.28 ; +0.12] | -14.7 % |
| B | taille ½ | 116 | 30 | +140.0 | 66 % | -70.0 [-124.3 ; -20.3] | 1.72 | +0.00 [-0.09 ; +0.08] | -15.1 % |
| BH | filtre | 108 | 26 | +107.4 | 67 % | -107.4 [-226.9 ; -17.6] | 1.61 | -0.11 [-0.29 ; +0.07] | -13.5 % |
| BH | taille ½ | 108 | 26 | +107.4 | 67 % | -53.7 [-113.4 ; -8.8] | 1.69 | -0.03 [-0.10 ; +0.05] | -14.9 % |
| BF | filtre | 104 | 25 | +87.1 | 66 % | -87.1 [-192.9 ; -0.8] | 1.80 | +0.09 [-0.09 ; +0.23] | -14.3 % |
| BF | taille ½ | 104 | 25 | +87.1 | 66 % | -43.5 [-96.4 ; -0.4] | 1.78 | +0.07 [-0.02 ; +0.13] | -14.9 % |
| BM | filtre | 99 | 22 | +107.3 | 71 % | -107.3 [-216.5 ; -13.6] | 1.77 | +0.05 [-0.16 ; +0.21] | -14.2 % |
| BM | taille ½ | 99 | 22 | +107.3 | 71 % | -53.6 [-108.2 ; -6.8] | 1.76 | +0.05 [-0.05 ; +0.12] | -15.2 % |

Lecture : les trades signalés ont un peu plus de pertes pleines (66–71 % contre 61 %) mais un R total positif : les retirer coûte 87 à 140 R sur six ans, quel que soit le modèle, y compris V1 seule (B). Aucun ΔSharpe n'est distinct de zéro ; les écarts entre B, BH, BF et BM sont dans le bruit.

## 5. Exécution

Proxy (données Binance 1 min) : coût de latence d'une minute = déplacement du prix dans le sens du trade entre T et T + 1 min (moyenne 4.7 pb). Différence tiers supérieur − reste (ou saut / pas de saut) :

| variable | n signalés | coût signalés (pb) | coût autres (pb) | différence (pb) | t |
|---|---:|---:|---:|---:|---:|
| `h_log_same` | 230 | 7.3 | 3.3 | +4.0 | 1.30 |
| `h_adv60` | 230 | 5.6 | 4.2 | +1.3 | 0.51 |
| `c_same60` | 115 | 7.3 | 4.1 | +3.2 | 0.75 |
| `j_same` | 482 | 5.6 | 2.4 | +3.2 | 1.47 |
| `f_absZ` | 230 | 5.3 | 4.4 | +0.9 | 0.33 |

Lecture : un λ même sens élevé va avec un coût de latence plus élevé (+4 pb, t = 1,3, terciles de tout l'échantillon, descriptif) ; hors échantillon, aucun modèle ne prévoit ce coût mieux que V1 seule (§ 3). Les exécutions réelles du bot (latence 0,5–5 s, `research/reports/execution/`) ne sont disponibles qu'en agrégats : pas de test direct possible.

## 6. Limites

- 24 trades de 2020-01 → 2020-06 non couverts (aucune estimation Hawkes chronologique) et 1 trade dans une panne Binance.
- Hawkes et sauts mesurés sur Binance (comptant puis perpétuel) alors que V1 décide sur Bitstamp (BTC) : correspondance de signe de la bougie de signal 100 %, corrélation des amplitudes 0,99.
- Régressions linéaires simples, entraînement minimal de 141 trades (2018–2019) pour l'année 2020 ; Sharpe et drawdown approchés sans recomposition. Aucune optimisation, aucun nouveau backtest.
