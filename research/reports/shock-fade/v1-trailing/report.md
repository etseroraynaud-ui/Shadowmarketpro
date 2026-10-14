# Trailing stop de Shock Engine V1 — variantes pré-enregistrées

Protocole : `research/preregistration/v1-trailing.md` (commité avant les résultats). Généré par `research/fade/v1/trailing-study.ts`. Moteur figé non modifié ; variantes découplées et conditionnelles via la copie isolée `research/fade/v1/trail-broker.ts`. **Simulation historique dans l'échantillon de conception de V1** : aucun chiffre n'est une validation indépendante.

## Verdict

**aucune variante convaincante : trailing de 50 ATR conservé.**

- Apparié : R récupéré sur les trades qui rendent leurs gains +11 à +172 R ; R sacrifié sur les 36 très gros gagnants −471 à −92 R, soit 2,6 à 11,9 R perdus par R récupéré. ΔR total négatif pour les 11 variantes, sur BTC (11 / 11) comme sur ETH (11 / 11).
- Portefeuille : ΔSharpe −0,32 à −0,04 ; meilleure variante C25 (−0,04, IC [−0,23 ; +0,13]). Sharpe relevé sur les deux sleeves : 0 / 11 ; Calmar ≥ V1 : 0 / 11.
- Les trailings serrés (C8, C12, D3-2, D5-3) réduisent le drawdown (−15,2 à −12,7 % contre −17,8 %) au prix de la CAGR (37,9 à 48,9 % contre 67,7 %).

## Contrôles

- copie (spécification V1) = moteur figé, positions et equity au bit près, BTC et ETH : OK
- copie (atrTrailMult = 10, hors liste) = moteur figé avec le même réglage : OK
- rejeu apparié (entrées imposées) = 716 trades V1 : OK
- Sharpe du portefeuille V1 = fiche (2.0242) : OK

V1 : 716 trades, Sharpe 2,02, CAGR 67,7 %, drawdown −17,8 %, Calmar 3,79. Groupe « rend ses gains » (MFE ≥ 2 R et R < 1 R) : 126 trades. « Très gros gagnants » (5 % meilleurs) : 36 trades, 707 R sur 767 R.

## 1. Analyse appariée (mêmes 716 entrées, seules les sorties changent)

ΔR = Σ (R variante − R V1) ; IC à 95 % par bootstrap des mois d'entrée. « Conservés » : R ≥ 75 % du R V1.

| variante | sorties modifiées | ΔR récupéré, trades qui rendent leurs gains | ΔR sur les 36 très gros gagnants | ΔR total | dont BTC | dont ETH | très gros gagnants conservés |
|---|---:|---|---|---|---:|---:|---:|
| C8 · classique 8 ATR | 224 | +172,2 [+118,0 ; +230,5] | −445,7 [−617,7 ; −288,5] | −343,5 [−605,8 ; −110,5] | −192,6 | −150,9 | 8 / 36 |
| C12 · classique 12 ATR | 134 | +91,5 [+57,2 ; +132,3] | −354,6 [−504,6 ; −221,1] | −269,4 [−491,1 ; −79,2] | −168,9 | −100,4 | 12 / 36 |
| C16 · classique 16 ATR | 86 | +48,6 [+24,3 ; +78,9] | −271,4 [−425,3 ; −130,3] | −208,8 [−404,3 ; −46,7] | −134,5 | −74,3 | 18 / 36 |
| C25 · classique 25 ATR | 24 | +10,9 [+0,7 ; +28,9] | −92,2 [−234,3 ; +2,4] | −77,6 [−223,5 ; +22,3] | −25,7 | −51,9 | 28 / 36 |
| D3-2 · découplé +3 R / 2 R | 221 | +163,2 [+124,5 ; +209,9] | −471,2 [−649,0 ; −310,1] | −371,9 [−633,0 ; −125,8] | −199,1 | −172,8 | 4 / 36 |
| D5-3 · découplé +5 R / 3 R | 129 | +88,1 [+46,5 ; +135,6] | −368,2 [−526,2 ; −218,2] | −291,0 [−521,8 ; −86,2] | −158,4 | −132,6 | 11 / 36 |
| D5-4 · découplé +5 R / 4 R | 98 | +69,0 [+36,2 ; +108,4] | −326,4 [−481,3 ; −193,6] | −252,5 [−457,8 ; −74,9] | −153,5 | −99,0 | 16 / 36 |
| X2-1.5 · agité, MFE ≥ 2 R → 1.5 R | 50 | +21,6 [+4,4 ; +44,3] | −174,9 [−276,0 ; −92,3] | −163,3 [−293,9 ; −59,8] | −51,5 | −111,8 | 22 / 36 |
| X2-3 · agité, MFE ≥ 2 R → 3 R | 40 | +22,8 [+1,1 ; +54,2] | −143,5 [−222,3 ; −70,6] | −130,7 [−235,7 ; −40,5] | −42,1 | −88,6 | 24 / 36 |
| X4-1.5 · agité, MFE ≥ 4 R → 1.5 R | 41 | +14,4 [+0,0 ; +34,3] | −171,3 [−272,1 ; −91,5] | −160,7 [−282,4 ; −64,2] | −51,2 | −109,4 | 22 / 36 |
| X4-3 · agité, MFE ≥ 4 R → 3 R | 35 | +20,3 [+0,0 ; +50,3] | −143,5 [−227,4 ; −72,3] | −125,6 [−230,9 ; −37,4] | −40,3 | −85,2 | 24 / 36 |

## 2. Rejeu complet du portefeuille BTC/ETH 50/50

ΔSharpe : bootstrap par blocs de 21 jours (IC 95 %, p unilatéral, Holm sur 11). Très gros gagnants : les 36 meilleurs trades V1 retrouvés (même entrée) avec R ≥ 75 % du R V1.

| variante | trades | Sharpe | ΔSharpe [IC 95 %] | p Holm | CAGR | drawdown | Calmar | Sortino | PF | sorties TRAIL | très gros gagnants conservés | Sharpe BTC (Δ [IC]) | Sharpe ETH (Δ [IC]) | Sharpe coûts × 2 |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|
| V1 | 716 | 2,02 | — | — | 67,7 % | −17,8 % | 3,79 | 4,73 | 2,46 | 4 | 36 / 36 | 1,46 | 1,93 | 1,88 |
| C8 | 797 | 1,76 | −0,26 [−0,69 ; +0,14] | 1,000 | 39,1 % | −12,9 % | 3,02 | 4,27 | 1,88 | 245 | 8 / 36 | 1,26 (−0,20 [−0,55 ; +0,15]) | 1,60 (−0,32 [−0,82 ; +0,11]) | 1,54 |
| C12 | 753 | 1,89 | −0,13 [−0,44 ; +0,16] | 1,000 | 48,9 % | −13,3 % | 3,66 | 4,61 | 2,07 | 140 | 12 / 36 | 1,30 (−0,16 [−0,48 ; +0,14]) | 1,75 (−0,17 [−0,49 ; +0,13]) | 1,70 |
| C16 | 733 | 1,91 | −0,11 [−0,36 ; +0,13] | 1,000 | 55,3 % | −17,8 % | 3,11 | 4,70 | 2,21 | 88 | 18 / 36 | 1,30 (−0,15 [−0,42 ; +0,09]) | 1,80 (−0,13 [−0,38 ; +0,12]) | 1,75 |
| C25 | 720 | 1,99 | −0,04 [−0,23 ; +0,13] | 1,000 | 61,4 % | −17,8 % | 3,44 | 4,71 | 2,37 | 25 | 28 / 36 | 1,50 (+0,05 [−0,04 ; +0,14]) | 1,84 (−0,09 [−0,30 ; +0,09]) | 1,83 |
| D3-2 | 808 | 1,79 | −0,23 [−0,64 ; +0,12] | 1,000 | 37,9 % | −12,7 % | 2,99 | 4,22 | 1,81 | 243 | 4 / 36 | 1,22 (−0,24 [−0,58 ; +0,14]) | 1,61 (−0,32 [−0,74 ; +0,09]) | 1,56 |
| D5-3 | 761 | 1,79 | −0,24 [−0,53 ; +0,06] | 1,000 | 42,5 % | −15,2 % | 2,79 | 4,15 | 1,96 | 135 | 11 / 36 | 1,30 (−0,16 [−0,45 ; +0,16]) | 1,62 (−0,31 [−0,65 ; +0,02]) | 1,58 |
| D5-4 | 741 | 1,93 | −0,09 [−0,38 ; +0,20] | 1,000 | 52,1 % | −17,8 % | 2,94 | 4,71 | 2,14 | 100 | 16 / 36 | 1,36 (−0,10 [−0,37 ; +0,15]) | 1,78 (−0,15 [−0,47 ; +0,16]) | 1,76 |
| X2-1.5 | 722 | 1,72 | −0,31 [−0,65 ; +0,00] | 1,000 | 42,7 % | −17,8 % | 2,40 | 3,91 | 2,03 | 53 | 22 / 36 | 1,30 (−0,16 [−0,39 ; +0,06]) | 1,55 (−0,37 [−0,75 ; −0,05]) | 1,54 |
| X2-3 | 721 | 1,79 | −0,24 [−0,56 ; +0,05] | 1,000 | 46,8 % | −17,8 % | 2,63 | 4,08 | 2,10 | 42 | 24 / 36 | 1,32 (−0,14 [−0,32 ; +0,05]) | 1,62 (−0,30 [−0,68 ; +0,03]) | 1,61 |
| X4-1.5 | 721 | 1,70 | −0,32 [−0,64 ; −0,04] | 1,000 | 42,2 % | −17,8 % | 2,37 | 3,83 | 2,02 | 43 | 22 / 36 | 1,30 (−0,15 [−0,35 ; +0,03]) | 1,53 (−0,40 [−0,77 ; −0,08]) | 1,52 |
| X4-3 | 720 | 1,81 | −0,21 [−0,53 ; +0,07] | 1,000 | 47,5 % | −17,8 % | 2,67 | 4,14 | 2,11 | 37 | 24 / 36 | 1,34 (−0,11 [−0,28 ; +0,05]) | 1,64 (−0,29 [−0,68 ; +0,03]) | 1,64 |

## 3. Contrôles statistiques

- CSCV-PBO (12 configurations, 16 blocs) : **26,4 %** ; configuration la plus souvent choisie : V1.
- Sharpe dégonflé de la meilleure variante (C25, N = 233 essais) : 1,000 — il reflète le niveau hérité de V1, pas un apport du trailing ; de son écart à V1 (N = 11), seul pertinent pour la décision : 0,001.
- Walk-forward **rétrospectif** (recalage annuel 2020 → 2026, meilleur Sharpe passé parmi les 12) : Sharpe hors période d'entraînement 1,94 contre 1,98 pour V1 sur les mêmes jours ; choix : 2020 : D5-3, 2021 : C16, 2022 : V1, 2023 : V1, 2024 : V1, 2025 : V1, 2026 : V1. Ce n'est pas une validation prospective indépendante : tout l'historique a servi à concevoir V1.

## 4. Règle de décision

| variante | 1 ΔSharpe > 0 (IC, Holm) | 2 BTC et ETH | 3 drawdown et Calmar | 4 ≥ 30 / 36 très gros gagnants | 5 coûts × 2 | 6 PBO < 25 % | convaincante |
|---|---|---|---|---|---|---|---|
| C8 | non | non | non | non | non | non | **non** |
| C12 | non | non | non | non | non | non | **non** |
| C16 | non | non | non | non | non | non | **non** |
| C25 | non | non | non | non | non | non | **non** |
| D3-2 | non | non | non | non | non | non | **non** |
| D5-3 | non | non | non | non | non | non | **non** |
| D5-4 | non | non | non | non | non | non | **non** |
| X2-1.5 | non | non | non | non | non | non | **non** |
| X2-3 | non | non | non | non | non | non | **non** |
| X4-1.5 | non | non | non | non | non | non | **non** |
| X4-3 | non | non | non | non | non | non | **non** |
