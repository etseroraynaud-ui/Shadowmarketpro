# Régime directionnel avant le signal et coût des faux départs

Plan : `research/preregistration/regime-fakeout.md`, commité avant tout calcul variable–résultat. Script : `research/shock/regime-fakeout.ts` (commit `56a7ac0`). Moteur non modifié ; variantes = listes d'entrées et sélection de jeux passées à `simulate`.

**Statut.** BTC/ETH : données de développement de la stratégie, descriptif. 8 actifs vierges (XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC) : jamais utilisés pour concevoir la stratégie ni ces variantes (leurs résultats v1 avaient été vus dans l'étude des shorts) ; test confirmatoire. Aucun test prospectif.

## Verdict (règle fixée d'avance, § 6)

- **V1 · anti-range** : Δ Sharpe moyen sur 8 actifs vierges +0,041 (IC 90 % −0,023 à +0,102), p = 0,143, p Holm = 0,429, amélioration sur 5/8 actifs, coûts × 2 : +0,058 → **avantage non démontré**.
- **V2 · confirmation retardée en range** : Δ Sharpe moyen sur 8 actifs vierges +0,008 (IC 90 % −0,035 à +0,051), p = 0,383, p Holm = 0,767, amélioration sur 3/8 actifs, coûts × 2 : +0,012 → **avantage non démontré**.
- **V3 · sorties du jeu agité en range** : Δ Sharpe moyen sur 8 actifs vierges −0,004 (IC 90 % −0,072 à +0,058), p = 0,552, p Holm = 0,767, amélioration sur 5/8 actifs, coûts × 2 : −0,020 → **avantage non démontré**.

**Aucune variante ne passe la règle. Le Shock Engine de référence (V0) reste inchangé.**

## Lecture

- **Coût des faux départs en range.** Les signaux déclenchés après un marché peu directionnel (quartile bas de l'ER 5 h) ne rapportent pas moins que les autres : D1 = +0,10 R [−0,47 ; +0,72] sur BTC/ETH et +0,07 R [−0,20 ; +0,38] sur les actifs vierges. L'hypothèse « le coût principal vient des faux départs en range » n'est pas soutenue ; l'hypothèse inverse (la consolidation prépare les grands mouvements) n'est pas démontrée non plus.
- **Les faux départs sont aussi fréquents partout.** Le prix revient de l'autre côté du niveau cassé dans les 4 bougies pour 27 % des trades en range marqué contre 29 % ailleurs (BTC/ETH), 29 % contre 29 % (actifs vierges). Le régime avant le signal ne dit pas quand une cassure échouera.
- **Grands gagnants.** Part des grands gagnants dans chaque groupe : 11 %, 10 %, 9 %, 10 % (BTC/ETH), 10 %, 9 %, 10 %, 11 % (actifs vierges), pour 10 % en moyenne. Écart maximal entre la part d'un groupe dans les grands gagnants et sa part dans les trades : 2,5 % (BTC/ETH), 2,8 % (actifs vierges).
- **Mesures secondaires** (D1, quartile bas − autres, BTC/ETH puis actifs vierges) : ER 96 bougies (24 h) +0,35 / +0,13 ; ADX(14) +0,32 / −0,09 ; Fréquence des faux départs (7 j) −0,32 / −0,06. Intervalle excluant zéro : aucun ; sens opposés entre les deux échantillons : ADX(14).
- **Variantes.** Retirer, confirmer ou gérer autrement les entrées en range ne change pas le Sharpe de façon démontrable (actifs vierges : Δ de +0,041, +0,008, −0,004 ; BTC/ETH : −0,012, +0,015, +0,035). Le filtre anti-range fait passer le drawdown de −19,1 % à −18,2 % sur BTC/ETH (moyenne des vierges : −53,4 % à −50,1 %), mais la somme des R passe de 736 à 655 sur BTC/ETH : les trades en range retirés étaient, en somme, gagnants.

## Phase 1 — matrice de rendement conditionnel · BTC/ETH (développement)

1311 trades · régime : quartile du percentile causal (90 jours) de l'ER 20 bougies avant la bougie de signal · grands gagnants : R ≥ 3,84 (90e centile) · 0 trade(s) sans percentile.

| Régime avant signal | Trades | Taux de gain [Wilson 95 %] | R moyen [IC 95 %] | R médian | Gain/perte moyen | PF (R) | MFE méd. (R) | MAE méd. (R) | Réintégration 1 / 4 / 16 bougies | Grands gagnants : part du groupe | Part de tous les grands gagnants | Part de ΣR | Part des pertes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Range marqué | 236 (18 %) | 30,9 % [25 % ; 37 %] | +0,64 [+0,11 ; +1,25] | −1,06 | 4,17 | 1,87 | 1,11 | −1,00 | 12 % / 27 % / 50 % | 11,4 % | 20,5 % | 20,6 % | 17,7 % |
| Range modéré | 254 (19 %) | 33,1 % [28 % ; 39 %] | +0,52 [−0,02 ; +1,19] | −1,05 | 3,42 | 1,69 | 1,46 | −1,00 | 13 % / 28 % / 47 % | 9,8 % | 18,9 % | 18,0 % | 19,4 % |
| Tendance modérée | 317 (24 %) | 28,4 % [24 % ; 34 %] | +0,44 [+0,07 ; +0,87] | −1,06 | 3,93 | 1,56 | 1,13 | −1,00 | 12 % / 32 % / 51 % | 9,1 % | 22,0 % | 19,1 % | 25,5 % |
| Tendance forte | 504 (38 %) | 31,5 % [28 % ; 36 %] | +0,62 [+0,26 ; +1,02] | −1,04 | 4,00 | 1,84 | 1,42 | −1,00 | 10 % / 26 % / 46 % | 10,1 % | 38,6 % | 42,3 % | 37,3 % |

**D1 = R moyen (range marqué) − R moyen (autres)** : +0,100 R (IC 95 % −0,468 à +0,723, p bilatéral 0,762, 236 contre 1075 trades).

Mesures secondaires (mêmes quartiles de percentile causal) :

| ER 96 bougies (24 h) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 275 | 32,7 % | +0,84 [+0,24 ; +1,52] | 29 % | 22,0 % | 31,3 % |
| Q2 | 281 | 26,3 % | +0,34 [−0,10 ; +0,84] | 26 % | 18,9 % | 12,9 % |
| Q3 | 346 | 33,2 % | +0,85 [+0,39 ; +1,40] | 21 % | 34,8 % | 39,8 % |
| Q4 (haut) | 409 | 31,1 % | +0,29 [−0,02 ; +0,67] | 35 % | 24,2 % | 16,0 % |

D1 (Q1 − autres) : +0,348 R (IC 95 % −0,247 à +0,992) · 0 trade(s) sans percentile.

| ADX(14) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 280 | 35,7 % | +0,81 [+0,34 ; +1,33] | 26 % | 27,3 % | 30,8 % |
| Q2 | 338 | 26,9 % | +0,32 [−0,08 ; +0,83] | 27 % | 23,5 % | 14,6 % |
| Q3 | 324 | 34,0 % | +0,78 [+0,28 ; +1,36] | 24 % | 22,7 % | 34,2 % |
| Q4 (haut) | 369 | 28,5 % | +0,41 [+0,06 ; +0,81] | 34 % | 26,5 % | 20,4 % |

D1 (Q1 − autres) : +0,316 R (IC 95 % −0,208 à +0,856) · 0 trade(s) sans percentile.

| Fréquence des faux départs (7 j) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 332 | 29,2 % | +0,32 [−0,02 ; +0,72] | 32 % | 22,0 % | 14,4 % |
| Q2 | 314 | 31,8 % | +0,46 [+0,07 ; +0,88] | 29 % | 25,8 % | 19,6 % |
| Q3 | 303 | 32,3 % | +0,75 [+0,22 ; +1,40] | 25 % | 22,7 % | 31,0 % |
| Q4 (haut) | 362 | 30,7 % | +0,71 [+0,22 ; +1,29] | 26 % | 29,5 % | 34,9 % |

D1 (Q1 − autres) : −0,323 R (IC 95 % −0,686 à +0,055) · 0 trade(s) sans percentile.

## Phase 1 — matrice de rendement conditionnel · 8 actifs vierges (réplication)

4722 trades · régime : quartile du percentile causal (90 jours) de l'ER 20 bougies avant la bougie de signal · grands gagnants : R ≥ 2,91 (90e centile) · 0 trade(s) sans percentile.

| Régime avant signal | Trades | Taux de gain [Wilson 95 %] | R moyen [IC 95 %] | R médian | Gain/perte moyen | PF (R) | MFE méd. (R) | MAE méd. (R) | Réintégration 1 / 4 / 16 bougies | Grands gagnants : part du groupe | Part de tous les grands gagnants | Part de ΣR | Part des pertes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Range marqué | 701 (15 %) | 25,1 % [22 % ; 28 %] | +0,22 [−0,07 ; +0,55] | −1,06 | 3,81 | 1,28 | 1,01 | −1,01 | 12 % / 29 % / 49 % | 9,7 % | 14,4 % | 20,0 % | 15,4 % |
| Range modéré | 948 (20 %) | 24,9 % [22 % ; 28 %] | −0,04 [−0,21 ; +0,14] | −1,06 | 2,87 | 0,95 | 1,12 | −1,01 | 14 % / 32 % / 53 % | 8,9 % | 17,8 % | −4,9 % | 21,0 % |
| Tendance modérée | 1198 (25 %) | 28,8 % [26 % ; 31 %] | +0,17 [−0,02 ; +0,38] | −1,05 | 3,05 | 1,23 | 1,30 | −1,01 | 11 % / 27 % / 49 % | 10,0 % | 25,4 % | 26,7 % | 24,3 % |
| Tendance forte | 1875 (40 %) | 28,5 % [26 % ; 31 %] | +0,24 [+0,07 ; +0,42] | −1,05 | 3,30 | 1,31 | 1,23 | −1,01 | 11 % / 29 % / 50 % | 10,7 % | 42,5 % | 58,2 % | 39,4 % |

**D1 = R moyen (range marqué) − R moyen (autres)** : +0,067 R (IC 95 % −0,201 à +0,379, p bilatéral 0,678, 701 contre 4021 trades).

Mesures secondaires (mêmes quartiles de percentile causal) :

| ER 96 bougies (24 h) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 963 | 27,6 % | +0,27 [+0,05 ; +0,53] | 26 % | 23,7 % | 33,7 % |
| Q2 | 996 | 27,4 % | +0,22 [−0,01 ; +0,47] | 28 % | 23,3 % | 28,1 % |
| Q3 | 1125 | 26,6 % | +0,12 [−0,10 ; +0,41] | 28 % | 21,4 % | 18,1 % |
| Q4 (haut) | 1638 | 27,7 % | +0,09 [−0,07 ; +0,27] | 32 % | 31,7 % | 20,1 % |

D1 (Q1 − autres) : +0,135 R (IC 95 % −0,120 à +0,410) · 0 trade(s) sans percentile.

| ADX(14) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 957 | 26,1 % | +0,09 [−0,13 ; +0,34] | 26 % | 17,3 % | 11,1 % |
| Q2 | 1123 | 26,8 % | +0,11 [−0,08 ; +0,31] | 27 % | 23,3 % | 15,7 % |
| Q3 | 1229 | 28,3 % | +0,20 [+0,01 ; +0,43] | 30 % | 29,0 % | 32,4 % |
| Q4 (haut) | 1413 | 27,7 % | +0,22 [+0,05 ; +0,41] | 32 % | 30,4 % | 40,8 % |

D1 (Q1 − autres) : −0,093 R (IC 95 % −0,311 à +0,140) · 0 trade(s) sans percentile.

| Fréquence des faux départs (7 j) | Trades | Taux de gain | R moyen [IC 95 %] | Réintégration 4 bougies | Part de tous les grands gagnants | Part de ΣR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Q1 (bas) | 1231 | 26,2 % | +0,12 [−0,09 ; +0,33] | 28 % | 26,2 % | 18,8 % |
| Q2 | 1071 | 26,7 % | +0,06 [−0,14 ; +0,30] | 32 % | 20,5 % | 8,5 % |
| Q3 | 1145 | 28,0 % | +0,25 [+0,04 ; +0,47] | 28 % | 25,6 % | 36,9 % |
| Q4 (haut) | 1275 | 28,3 % | +0,22 [+0,01 ; +0,45] | 28 % | 27,7 % | 35,7 % |

D1 (Q1 − autres) : −0,062 R (IC 95 % −0,285 à +0,160) · 0 trade(s) sans percentile.

## Phase 1 — découpages de l'ER principal (descriptif)

| BTC/ETH (développement) | Trades | R moyen · Range marqué | R moyen · Range modéré | R moyen · Tendance modérée | R moyen · Tendance forte | D1 [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BTC | 644 | +0,43 (110) | +0,68 (124) | +0,43 (154) | +0,74 (256) | −0,21 [−0,92 ; +0,65] |
| ETH | 667 | +0,83 (126) | +0,37 (130) | +0,46 (163) | +0,49 (248) | +0,38 [−0,49 ; +1,40] |
| long | 1061 | +0,74 (180) | +0,42 (206) | +0,19 (256) | +0,59 (419) | +0,30 [−0,40 ; +1,07] |
| short | 250 | +0,34 (56) | +0,94 (48) | +1,51 (61) | +0,73 (85) | −0,68 [−1,70 ; +0,36] |

| 8 actifs vierges (réplication) | Trades | R moyen · Range marqué | R moyen · Range modéré | R moyen · Tendance modérée | R moyen · Tendance forte | D1 [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| XRP | 589 | +1,38 (84) | −0,02 (113) | +0,24 (168) | +0,14 (224) | +1,25 [−0,03 ; +2,80] |
| BNB | 627 | +0,75 (80) | −0,15 (128) | +0,15 (144) | +0,04 (275) | +0,73 [−0,45 ; +2,41] |
| DOGE | 555 | −0,11 (84) | +0,23 (92) | −0,24 (140) | +0,40 (239) | −0,29 [−0,92 ; +0,42] |
| TRX | 567 | −0,02 (78) | −0,11 (131) | +0,25 (143) | −0,08 (215) | −0,03 [−0,58 ; +0,62] |
| ADA | 626 | +0,28 (89) | +0,34 (112) | +0,11 (158) | +0,35 (267) | +0,00 [−0,60 ; +0,67] |
| LINK | 523 | −0,12 (99) | −0,15 (114) | −0,00 (125) | +0,76 (185) | −0,41 [−0,93 ; +0,11] |
| XLM | 575 | +0,03 (85) | −0,17 (112) | +0,59 (151) | +0,27 (227) | −0,24 [−0,77 ; +0,35] |
| LTC | 660 | −0,26 (102) | −0,18 (146) | +0,22 (169) | +0,15 (243) | −0,34 [−0,78 ; +0,16] |

## Phases 2–3 — variantes rejouées en portefeuille complet

Variantes fixées dans le plan (§ 5). « Range » : percentile ER 20 < 0,25 à la bougie de signal. Coûts × 1 sauf mention.

### Actifs vierges (confirmatoire) : Sharpe journalier par actif

| Actif | Fenêtre | Sharpe V0 | Sharpe V1 | Sharpe V2 | Sharpe V3 | Δ V1 | Δ V2 | Δ V3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| XRP | 2019-06-01 → 2026-09-30 | 0,78 | 0,74 | 0,73 | 0,66 | −0,04 | −0,05 | −0,12 |
| BNB | 2018-12-01 → 2026-09-30 | 0,58 | 0,53 | 0,67 | 0,49 | −0,05 | +0,09 | −0,10 |
| DOGE | 2020-08-01 → 2026-09-30 | 0,53 | 0,57 | 0,52 | 0,55 | +0,04 | −0,01 | +0,02 |
| TRX | 2019-07-01 → 2026-09-30 | 0,30 | 0,36 | 0,29 | 0,36 | +0,06 | −0,01 | +0,06 |
| ADA | 2019-05-01 → 2026-09-30 | 0,57 | 0,59 | 0,54 | 0,43 | +0,02 | −0,03 | −0,14 |
| LINK | 2020-02-01 → 2026-09-30 | 0,68 | 0,76 | 0,68 | 0,75 | +0,08 | +0,00 | +0,07 |
| XLM | 2019-06-01 → 2026-09-30 | 0,51 | 0,48 | 0,47 | 0,60 | −0,03 | −0,04 | +0,09 |
| LTC | 2019-01-01 → 2026-09-30 | 0,13 | 0,37 | 0,23 | 0,21 | +0,24 | +0,10 | +0,08 |

| Variante | Δ moyen | IC 90 % (bootstrap) | IC 95 % | p | p Holm | Actifs améliorés | Δ coûts × 2 | Verdict |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 · anti-range | +0,041 | −0,023 à +0,102 | −0,035 à +0,114 | 0,143 | 0,429 | 5/8 | +0,058 | non démontré |
| V2 · confirmation retardée en range | +0,008 | −0,035 à +0,051 | −0,045 à +0,059 | 0,383 | 0,767 | 3/8 | +0,012 | non démontré |
| V3 · sorties du jeu agité en range | −0,004 | −0,072 à +0,058 | −0,086 à +0,068 | 0,552 | 0,767 | 5/8 | −0,020 | non démontré |

### Actifs vierges : autres mesures (moyennes sur 8 actifs)

| Variante | Sharpe | CAGR | Drawdown max. | PF | Trades / actif | ΣR / actif | Part des 5 % meilleurs trades dans ΣR (8 actifs mis en commun) | Entrées déplacées / retirées (total) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · référence E2 | 0,51 | 14,7 % | −53,4 % | 1,15 | 590 | 97 | 321 % | 0 / 0 |
| V1 · anti-range | 0,55 | 15,9 % | −50,1 % | 1,18 | 530 | 95 | 292 % | 0 / 926 |
| V2 · confirmation retardée en range | 0,52 | 14,6 % | −51,9 % | 1,15 | 578 | 96 | 315 % | 804 / 122 |
| V3 · sorties du jeu agité en range | 0,51 | 14,1 % | −53,7 % | 1,15 | 609 | 80 | 380 % | 680 / 0 |

### BTC/ETH, portefeuille 50/50 sans rebalancement (descriptif : données de développement)

| Variante | Sharpe | Δ Sharpe [IC 95 %] | CAGR | Drawdown max. | PF | Trades | ΣR | Part des 5 % meilleurs trades | Sharpe coûts × 2 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · référence E2 | 1,88 | — | 61,6 % | −19,1 % | 1,89 | 1311 | 736 | 131 % | 1,61 |
| V1 · anti-range | 1,87 | −0,012 [−0,204 ; +0,155] | 59,3 % | −18,2 % | 2,05 | 1162 | 655 | 131 % | 1,62 |
| V2 · confirmation retardée en range | 1,89 | +0,015 [−0,086 ; +0,106] | 62,5 % | −19,1 % | 1,96 | 1284 | 705 | 134 % | 1,63 |
| V3 · sorties du jeu agité en range | 1,91 | +0,035 [−0,103 ; +0,153] | 60,1 % | −16,8 % | 1,94 | 1353 | 720 | 131 % | 1,62 |

### Fenêtres chronologiques : écart de Sharpe par année civile

| Variante | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Années améliorées |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 · anti-range · BTC/ETH | +0,18 | −0,38 | −0,04 | −0,10 | +0,07 | +0,12 | −0,02 | −0,12 | +0,27 | 4/9 |
| V2 · confirmation retardée en range · BTC/ETH | −0,02 | +0,25 | −0,06 | −0,03 | −0,17 | +0,07 | −0,07 | +0,15 | +0,14 | 4/9 |
| V3 · sorties du jeu agité en range · BTC/ETH | −0,28 | +0,20 | +0,13 | +0,08 | +0,02 | +0,01 | +0,23 | −0,25 | +0,13 | 7/9 |

| Variante | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 | Années améliorées |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V1 · anti-range · 8 vierges | — | −0,02 (6) | +0,01 (8) | +0,13 (8) | +0,15 (8) | −0,09 (8) | +0,03 (8) | −0,00 (8) | +0,11 (8) | 5/8 |
| V2 · confirmation retardée en range · 8 vierges | — | −0,04 (6) | −0,05 (8) | +0,03 (8) | +0,06 (8) | −0,06 (8) | +0,04 (8) | +0,03 (8) | +0,06 (8) | 5/8 |
| V3 · sorties du jeu agité en range · 8 vierges | — | +0,08 (6) | −0,04 (8) | +0,13 (8) | +0,04 (8) | −0,21 (8) | −0,16 (8) | −0,01 (8) | −0,01 (8) | 3/8 |

Actifs vierges : moyenne des écarts de Sharpe des actifs ayant au moins 60 jours dans l'année (nombre entre parenthèses). Années incomplètes en début et fin de fenêtre.

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | b69ad8f8f89a4ded |
| empreinte lib/strategies/shock/strategy.ts | OK | fafb22d6373b19bf |
| empreinte lib/strategies/shock/broker.ts | OK | bad42836b9d61569 |
| empreinte lib/strategies/shock/engine.ts | OK | 15211a3e185b1214 |
| empreinte lib/strategies/shock/params.ts | OK | 5f7cd0c941d70273 |
| empreinte lib/strategies/shock/presets.ts | OK | f97449733ec945bb |
| empreinte lib/strategies/shock/regimes.ts | OK | d72f79d1d97c214d |
| empreinte lib/strategies/shock/live.ts | OK | 05caf82ece9ad7f8 |
| empreinte research/lib/frozen-shock.ts | OK | be445aa726433c3e |
| empreinte research/lib/e2.ts | OK | d871214da8d4efb7 |
| BTC : V0 = trades du portefeuille E2 publié | OK | 644 / 644 |
| ETH : V0 = trades du portefeuille E2 publié | OK | 667 / 667 |
| BTC/ETH : Sharpe de V0 = Sharpe publié du portefeuille E2 | OK | 1.877566513286129 / 1.877566513 |
| BTC : V3 sans range = V0 | OK | 774 positions |
| XRP : V3 sans range = V0 | OK | 589 positions |
| mesures identiques sur un historique coupé à la bougie de signal | OK | 48 comparaisons, 0 écart(s) |
| BTC/ETH : 1 311 trades dans la matrice | OK | 1311 |

## Écarts au plan

1. **Part des 5 % meilleurs trades, actifs vierges.** Au premier lancement, ce ratio descriptif était moyenné d'un actif à l'autre ; il explose quand la somme des R d'un actif est proche de zéro (valeurs de −741 % à 2 200 %). Il est maintenant calculé sur les trades des 8 actifs mis en commun. Aucune autre mesure, aucun test et aucune décision ne changent.

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/regime-fakeout.ts
```
