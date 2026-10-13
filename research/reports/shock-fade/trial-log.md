# Shock Fade Engine — journal des essais

Une ligne par exécution d'un script qui lit des rendements postérieurs à un choc ou qui estime un
modèle sur données réelles (ajoutée automatiquement par `shockfade/trial_log.py`).

| date (UTC) | commit | script | configuration | périodes lues |
|---|---|---|---|---|
| 2026-10-13 | (ce commit) | `shockfade/quality.py` | qualité des données | 2020-01 → 2026-09, sans rendement futur |
| 2026-10-13 15:35 | 3de57f1 | `shockfade/run_structural.py` | BTCUSDT, Hawkes + état-espace, 18 trimestres | 2020-01 → 2024-12 (fenêtres de 180 j) |
| 2026-10-13 15:36 | 3de57f1 | `shockfade/run_structural.py` | ETHUSDT, Hawkes + état-espace, 18 trimestres | 2020-01 → 2024-12 (fenêtres de 180 j) |
| 2026-10-13 15:42 | 3de57f1 | `shockfade/run_events.py` | ETHUSDT, Δ ∈ (5, 15), |Z| ≥ 3.0, rendements à h ∈ (1, 2, 4, 8, 16, 32) | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:42 | 3de57f1 | `shockfade/run_events.py` | BTCUSDT, Δ ∈ (5, 15), |Z| ≥ 3.0, rendements à h ∈ (1, 2, 4, 8, 16, 32) | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:43 | 3de57f1 | `shockfade/eventstudy.py` | étude d'événements, k ∈ {3, 4, 5}, Δ ∈ {5, 15} | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:44 | 3de57f1 | `shockfade/run_events.py` | ETHUSDT, Δ ∈ (5, 15), |Z| ≥ 3.0, rendements à h ∈ (1, 2, 4, 8, 16, 32) | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:44 | 3de57f1 | `shockfade/run_events.py` | BTCUSDT, Δ ∈ (5, 15), |Z| ≥ 3.0, rendements à h ∈ (1, 2, 4, 8, 16, 32) | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:45 | 3de57f1 | `shockfade/hypotheses.py` | H1, H1b, H2a, H2b, H3a, H3b, H4a × 6 horizons, Δ ∈ {5, 15} | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:45 | 3de57f1 | `shockfade/eventstudy.py` | étude d'événements, k ∈ {3, 4, 5}, Δ ∈ {5, 15} | E = 2020-07-01 → 2025-01-01 |
| 2026-10-13 15:45 | 3de57f1 | `shockfade/run_validation.py` | M1–M7 + contrôle, h ∈ {1…32}, Δ ∈ {5, 15}, |Z| ≥ 4, règle Ê_net > 0 | V = 2021-07-01 → 2025-01-01 |
| 2026-10-13 15:47 | 3de57f1 | `shockfade/run_validation.py` | M1–M7 + contrôle, h ∈ {1…32}, Δ ∈ {5, 15}, |Z| ≥ 4, règle Ê_net > 0 | V = 2021-07-01 → 2025-01-01 |
| 2026-10-13 15:49 | 3de57f1 | `shockfade/identifiability.py` | paramètres trimestriels, profil en φ (9 demi-vies × 3 trimestres), VR | 2020-01 → 2024-12 |
| 2026-10-13 16:01 | 3de57f1 | `shockfade/identifiability.py` | paramètres trimestriels, profil en φ (9 demi-vies × 3 trimestres), VR | 2020-01 → 2024-12 |
| 2026-10-13 15:30 | 3de57f1+modif | essai manuel (scratchpad) | `fit_quarter` BTCUSDT 2020-07 : vérification du temps de calcul, structure seulement | 2020-01 → 2020-06 |
| 2026-10-13 15:50 | 3de57f1+modif | essai manuel (scratchpad) | contrôle négatif simulé, graines 11, 23, 37 (OU naïf) : données simulées | — |

Note : les lignes marquées `3de57f1` entre 15:36 et 16:01 ont été exécutées avec le code de `research/fade/` encore non
commité (fichiers nouveaux non détectés par l'ancien marqueur) ; ce code est celui du commit qui suit ce journal.
| 2026-10-13 16:12 | d323780 | `shockfade/run_holdout.py` | holdout C : événements, M1–M7 + contrôle, H2b/H4a exploratoires | C = 2025-01-01 → 2026-10-01 |
| 2026-10-13 16:38 | 40b566b+modif | `shockfade/run_mtf.py counts` | comptages M5…H4, k ∈ {3, 4}, sans résultat | P 2020-07 → 2026-09, R 2018-01 → 2019-12 |
| 2026-10-13 16:43 | 5302de0 | `shockfade/run_mtf.py events` | événements M5…H4, k ≥ 3, rendements aux horizons du protocole MTF | P 2020-07 → 2026-09, R 2018-01 → 2019-12 |
| 2026-10-13 16:44 | 5302de0 | `shockfade/mtf_report.py` | tests primaires et secondaires MTF, réplication | P 2020-07 → 2026-09, R 2018-01 → 2019-12 |
| 2026-10-13 16:45 | 5302de0+modif | `shockfade/run_mtf_race_checks.py` | course 50 % par sens, régime, cassure, actif (a posteriori) | P et R |
| 2026-10-13 16:46 | 5302de0+modif | `shockfade/mtf_report.py` | tests primaires et secondaires MTF, réplication | P 2020-07 → 2026-09, R 2018-01 → 2019-12 |
