# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD 15 min

Bitstamp 15 min. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins 50 trades. Essais : 209 (192 entrées + 17 sorties). Produit par `node research/ou-channel/ou-study.ts`.

| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |
|---|---|---|---|---|---|---|---|
| Baseline (réglages d'origine, stop 3,3 ATR) | -68,8 % | −1,39 | -99,9 % | 0,89 | 5291 | 48,6 % | −2,13 |
| Top 1 entraînement · z 1.8 · réintégration 1 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | 4,2 % | 0,33 | -80,6 % | 1,07 | 1377 | 36,2 % | −0,31 |
| Top 2 entraînement · z 1.8 · réintégration 2 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | -7,8 % | 0,16 | -77,3 % | 1,02 | 2502 | 43,2 % | −0,71 |
| Top 3 entraînement · z 1.8 · réintégration 2 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | -6,9 % | 0,12 | -74,4 % | 1,02 | 1352 | 35,6 % | −0,52 |
| Top 4 entraînement · z 2.6 · réintégration 3 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | -9,7 % | 0,08 | -83,6 % | 1,02 | 1291 | 30,6 % | −0,92 |
| Top 5 entraînement · z 1.8 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | -6,4 % | 0,07 | -79,8 % | 1,03 | 676 | 28,6 % | −0,19 |

Grille d'entrée : 7/192 configurations à Sharpe d'entraînement > 0.

## Candidates (validation)

| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |
|---|---|---|---|---|---|---|---|---|---|
| z 1.8 · réintégration 1 · mèche 0.6 · sans filtre volume · stop 4.5 ATR | 0,49 | 0,10 | -1,8 % | -44,2 % | 1,02 | 651 | −0,40 | −0,01 · −0,12 · 50,0 % | 0,002 |
| z 1.8 · réintégration 1 · mèche 0.6 · sans filtre volume · stop 4.5 ATR · TP 2R · suiveur | 0,37 | −0,66 | -13,4 % | -46,7 % | 0,89 | 810 | −1,66 | −0,03 · −1,01 · 0,0 % | 0,001 |
| z 1.8 · réintégration 1 · mèche 0.6 · sans filtre volume · stop 4.5 ATR · TP 3R · suiveur | 0,35 | −0,55 | -11,8 % | -41,8 % | 0,91 | 808 | −1,52 | −0,03 · −0,91 · 0,0 % | 0,001 |

## Sorties testées sur la meilleure entrée (entraînement)

| Sortie | Sharpe | CAGR | MDD | PF | Trades |
|---|---|---|---|---|---|
| stop 2 · sans TP · sans suiveur | 0,34 | 5,7 % | -74,2 % | 1,07 | 1507 |
| stop 2 · sans TP · suiveur | −0,89 | -18,2 % | -75,5 % | 0,85 | 1719 |
| stop 2 · TP 2R · sans suiveur | −0,60 | -18,9 % | -78,2 % | 0,91 | 1617 |
| stop 2 · TP 2R · suiveur | −1,07 | -20,4 % | -78,3 % | 0,83 | 1719 |
| stop 2 · TP 3R · sans suiveur | −0,42 | -17,2 % | -78,7 % | 0,93 | 1586 |
| stop 2 · TP 3R · suiveur | −1,03 | -19,8 % | -79,3 % | 0,84 | 1719 |
| stop 3.3 · sans TP · sans suiveur | 0,33 | 4,2 % | -80,6 % | 1,07 | 1377 |
| stop 3.3 · sans TP · suiveur | −0,27 | -12,7 % | -74,3 % | 0,95 | 1622 |
| stop 3.3 · TP 2R · sans suiveur | −0,20 | -15,3 % | -83,3 % | 0,97 | 1477 |
| stop 3.3 · TP 2R · suiveur | −0,53 | -18,4 % | -81,2 % | 0,91 | 1622 |
| stop 3.3 · TP 3R · sans suiveur | −0,08 | -12,7 % | -82,3 % | 0,99 | 1440 |
| stop 3.3 · TP 3R · suiveur | −0,35 | -14,6 % | -75,2 % | 0,94 | 1622 |
| stop 4.5 · sans TP · sans suiveur | 0,49 | 13,0 % | -78,6 % | 1,10 | 1292 |
| stop 4.5 · sans TP · suiveur | 0,33 | 5,5 % | -65,3 % | 1,06 | 1537 |
| stop 4.5 · TP 2R · sans suiveur | 0,07 | -7,8 % | -79,9 % | 1,01 | 1371 |
| stop 4.5 · TP 2R · suiveur | 0,37 | 7,0 % | -59,7 % | 1,07 | 1537 |
| stop 4.5 · TP 3R · sans suiveur | 0,23 | -1,4 % | -75,2 % | 1,04 | 1339 |
| stop 4.5 · TP 3R · suiveur | 0,35 | 6,4 % | -61,1 % | 1,07 | 1537 |

## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)

Entraînement (2018-09-01 → 2022-12-31) : CAGR 37,2 %, Sharpe 1,30, MDD -19,9 % · validation 2023-01-01 → 2026-09-30 : CAGR 42,4 %, Sharpe 1,69, MDD -24,8 %.
