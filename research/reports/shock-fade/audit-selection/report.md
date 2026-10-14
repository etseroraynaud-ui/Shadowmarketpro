# Audit du Sharpe dégonflé : nombre effectif d'essais, dispersion σ, cohérence avec Holm

Généré par `research/fade/v1/audit-selection.ts`, en lecture seule, sans nouvel essai : rejeu des configurations déjà évaluées. Portefeuille BTC/ETH 50/50, 2952 jours (2018-09-01 → 2026-09-30), Sharpe annualisés.

Contrôles : les 16 Sharpe de l'univers A, ceux des 19 variantes de sortie (dont B2) et le Sharpe de V1 sont retrouvés à 10⁻⁶ ; le candidat n° 178 de la graine 5, rejoué comme V1, redonne V1 au bit près ; le jeu agité n'a aucun effet sur les trades de V1 (vérifié séparément : mêmes positions avec le jeu calme à sa place).

## 1. Ce qui a réellement été sélectionné pour arriver à V1

- V1 = E2 sans entrée en régime agité. **Ses trades ne dépendent que du jeu calme** (n° 178 de la graine 5 de `regime-wf.ts`, choisi sur BTC seul, par le t-stat des trades en régime calme sur les deux moitiés de l'entraînement), du filtre E2 des shorts et de la règle « calme seul ». Le jeu agité (n° 38) ne joue aucun rôle : la borne N = 128 547 (paires calme × agité) ne s'applique pas à V1.
- Les opportunités de sélection sont donc : le choix du jeu calme parmi les candidats (206 par graine, 3 graines, une retenue), puis les choix de structure (univers A : filtre E2, calme seul, etc.), puis, pour B2, les variantes de sortie testées sur V1 (11 trailings + 8 point mort / volume).
- Les 6 266 configurations « évaluées » comprennent des voisinages de robustesse, des diagnostics et des surfaces qui n'ont pas remplacé le préréglage : ce ne sont pas toutes des opportunités de sélection de V1.

## 2. Dispersion σ et nombre effectif d'essais

σ = écart type des Sharpe des essais. Erreur type = bruit d'estimation d'un Sharpe sur la période (formule de Mertens, asymétrie et kurtosis comprises). Part due au bruit = (1 − ρ̄) × erreur type² / σ² : sous l'hypothèse nulle du DSR (essais sans différence réelle), elle vaudrait 100 %. N effectif : ρ̄ + (1 − ρ̄) N (Bailey et López de Prado) ; spectral = N² / Σ corrélations² ; facteurs hors bruit = valeurs propres au-dessus de la borne de Marchenko-Pastur.

| famille d'essais | N | Sharpe moyen | σ | max | erreur type | part due au bruit | corrélation moyenne ρ̄ | N effectif (ρ̄) | N effectif (spectral) | facteurs hors bruit |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| univers A (16 configurations proches de E2) | 16 | 1,80 | 0,137 | 2,02 | 0,304 | 71 % | 0,85 | 3 | 1,3 | 1 |
| candidats graine 5, rejoués « tels quels » (calm-only) | 206 | −0,25 | 0,602 | 1,18 | — | — | — | — | — | — |
| candidats graine 5, rejoués comme V1 | 206 | 0,26 | 0,485 | 2,02 | — | — | 0,17 | 169 | 14,9 | 22 |
| candidats graines 5, 9, 13 (distincts), rejoués comme V1 | 606 | 0,25 | 0,451 | 2,02 | — | — | 0,17 | 499 | 15,8 | 43 |

- Rang du jeu de V1 parmi les 606 calmes possibles (rejoués comme V1) : **1ᵉ** sur le Sharpe du portefeuille (2,02), 1ᵉ sur la sleeve BTC (1,46, données de la sélection), 1ᵉ sur la sleeve ETH (1,93, non utilisée pour le choisir). Graine 5 seule (206) : 1ᵉ, 1ᵉ, 1ᵉ.
- Variantes de sortie testées sur V1 (séries d'écart à V1) : 8 de l'étude point mort / volume, ρ̄ 0,53, N effectif spectral 2,2 ; 11 trailings, 1,8 ; les 19, 3,2. σ des ratios d'information : 8 → 0,557, 19 → 0,526 ; erreur type d'un ratio d'information nul : 0,352.
- Univers A, séries d'écart à E2 (gain V1 − E2) : ρ̄ 0,14, N effectif spectral 6,5 pour 15 ; σ des ratios d'information 0,503.

## 3. Sharpe dégonflé selon les hypothèses

**V1** (Sharpe 2,02)

| N | σ = 0,602 (pré-enregistré) | σ des calmes possibles (0.451) | σ du bruit seul (0.352) |
|---|---:|---:|---:|
| 16 (univers A) | 99,9 % | 100,0 % | 100,0 % |
| 222 (pré-enregistré) | 87,6 % | 99,5 % | 100,0 % |
| 606 (calmes possibles, 3 graines) | 69,7 % | 98,3 % | 99,9 % |
| 641 (+ univers A + sorties) | 68,5 % | 98,2 % | 99,9 % |
| 6 266 (tout ce qui a été évalué) | 21,5 % | 87,4 % | 99,2 % |
| N effectif ρ̄ (499) | 73,8 % | 98,7 % | 99,9 % |
| N effectif spectral (16) | 99,9 % | 100,0 % | 100,0 % |
| facteurs hors bruit (43) | 99,1 % | 100,0 % | 100,0 % |

**B2** (Sharpe 2,09)

| N | σ = 0,602 (pré-enregistré) | σ des calmes possibles (0.451) | σ du bruit seul (0.352) |
|---|---:|---:|---:|
| 16 (univers A) | 100,0 % | 100,0 % | 100,0 % |
| 222 (pré-enregistré) | 92,1 % | 99,8 % | 100,0 % |
| 606 (calmes possibles, 3 graines) | 77,7 % | 99,2 % | 100,0 % |
| 641 (+ univers A + sorties) | 76,7 % | 99,1 % | 100,0 % |
| 6 266 (tout ce qui a été évalué) | 28,7 % | 91,9 % | 99,6 % |
| N effectif ρ̄ (499) | 81,2 % | 99,3 % | 100,0 % |
| N effectif spectral (16) | 100,0 % | 100,0 % | 100,0 % |
| facteurs hors bruit (43) | 99,6 % | 100,0 % | 100,0 % |

**Gain B2 − V1** (ratio d'information 0,936, PSR(0) 99,8 %, asymétrie 5,66, kurtosis 204)

| N | σ des 8 (0.557, utilisé) | σ des 19 (0.526) | σ du bruit seul (0.352) |
|---|---:|---:|---:|
| 8 (étude point mort / volume) | 64,9 % | 69,9 % | 90,4 % |
| 19 (+ 11 trailings) | 36,7 % | 43,6 % | 80,3 % |
| N effectif spectral des 8 (2.2) | 96,8 % | 97,2 % | 98,7 % |
| N effectif spectral des 19 (3.2) | 90,9 % | 92,3 % | 97,2 % |

**Gain V1 − E2** (ratio d'information 0,558)

| N | σ des 15 (0,503, utilisé) | σ du bruit seul (0,352) |
|---|---:|---:|
| 15 (pré-enregistré) | 18,0 % | 42,9 % |
| N effectif spectral (6.5) | 37,2 % | 59,2 % |

## 4. Holm et DSR mesurent-ils la même chose ?

- **Preuve d'un seul test, cohérente.** Bootstrap par mois du ΔSharpe de B2 : p brut 0,0010 (plancher de résolution : 2 / 2 001, aucun tirage ≤ 0 sur 2 000 sauf un), z ≈ 3,02 ; PSR(0) de la série d'écart : 99,8 %, z = 2,89. Les deux disent la même chose.
- **Correction multiple, de nature différente.** Holm (ou Bonferroni) contrôle la probabilité d'au moins un faux positif parmi N ; le DSR exige que le Sharpe dépasse le maximum **attendu** de N essais nuls, puis encore 1,645 erreur type pour atteindre 95 %. À hypothèses égales (essais indépendants, σ = bruit), le DSR à 95 % est donc nettement plus exigeant :

| N | z requis, Bonferroni 5 % | z requis, Šidák 5 % | z requis, DSR 95 % (σ = bruit) | risque global équivalent au DSR 95 % |
|---|---:|---:|---:|---:|
| 1 | 1,64 | 1,64 | 1,64 | 5,00 % |
| 8 | 2,50 | 2,49 | 3,10 | 0,76 % |
| 19 | 2,79 | 2,78 | 3,52 | 0,40 % |
| 222 | 3,51 | 3,50 | 4,44 | 0,10 % |
| 606 | 3,77 | 3,76 | 4,75 | 0,06 % |

- **D'où vient l'écart pour B2.** Avec les hypothèses de l'étude (N = 8, σ = 0,557), DSR 64,9 %. Remplacer σ par le bruit seul (N = 8) : 90,4 %. Avec le N effectif des 8 : 98,7 %. En comptant aussi les 11 trailings (N = 19, σ = bruit) : 80,3 %, N effectif 97,2 %. Holm sur 8 : p 0,008 ; Bonferroni sur 19 avec le même p brut : 0,019.
