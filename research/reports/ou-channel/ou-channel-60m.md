# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD 1 h

Bitstamp 60 min, réglages en bougies du timeframe. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins 50 trades. Essais : 209 (192 entrées + 17 sorties) ; Sharpe dégonflé avec 836 essais (quatre timeframes). Produit par `node research/ou-channel/ou-study.ts --tf 60`.

| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |
|---|---|---|---|---|---|---|---|
| Baseline (réglages d'origine, stop 3,3 ATR) | -51,7 % | −0,79 | -99,4 % | 0,88 | 1334 | 48,1 % | −0,47 |
| Top 1 entraînement · z 2.2 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 44,6 % | 1,03 | -37,5 % | 2,11 | 133 | 27,1 % | 0,62 |
| Top 2 entraînement · z 3 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 20,5 % | 0,65 | -42,5 % | 1,60 | 104 | 23,1 % | 0,25 |
| Top 3 entraînement · z 2.6 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 14,3 % | 0,52 | -51,4 % | 1,73 | 120 | 18,3 % | −0,33 |
| Top 4 entraînement · z 2.6 · réintégration 3 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 14,0 % | 0,51 | -60,0 % | 1,21 | 318 | 33,0 % | −0,81 |
| Top 5 entraînement · z 2.2 · réintégration 5 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 13,1 % | 0,49 | -71,3 % | 1,17 | 407 | 38,8 % | −0,75 |

Grille d'entrée : 16/192 configurations à Sharpe d'entraînement > 0.

## Candidates (validation)

| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |
|---|---|---|---|---|---|---|---|---|---|
| z 2.2 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 1,03 | 0,62 | 13,3 % | -39,9 % | 1,50 | 79 | 0,54 | 0,23 · 0,05 · 50,0 % | 0,173 |
| z 2.2 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 4.5 ATR | 1,02 | 0,87 | 23,6 % | -41,0 % | 1,72 | 75 | 0,81 | 0,24 · 0,31 · 75,0 % | 0,170 |
| z 2.2 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 4.5 ATR · suiveur | 0,87 | −0,13 | -2,7 % | -21,5 % | 0,93 | 93 | −0,28 | 0,01 · −0,19 · 25,0 % | 0,094 |

## Sorties testées sur la meilleure entrée (entraînement)

| Sortie | Sharpe | CAGR | MDD | PF | Trades |
|---|---|---|---|---|---|
| stop 2 · sans TP · sans suiveur | 0,71 | 21,8 % | -45,7 % | 1,91 | 145 |
| stop 2 · sans TP · suiveur | −0,38 | -5,5 % | -31,4 % | 0,82 | 167 |
| stop 2 · TP 2R · sans suiveur | −0,28 | -6,8 % | -38,5 % | 0,88 | 166 |
| stop 2 · TP 2R · suiveur | −0,37 | -5,4 % | -33,6 % | 0,82 | 167 |
| stop 2 · TP 3R · sans suiveur | 0,36 | 5,6 % | -26,1 % | 1,19 | 165 |
| stop 2 · TP 3R · suiveur | −0,37 | -5,5 % | -31,4 % | 0,82 | 167 |
| stop 3.3 · sans TP · sans suiveur | 1,03 | 44,6 % | -37,5 % | 2,11 | 133 |
| stop 3.3 · sans TP · suiveur | 0,60 | 12,3 % | -28,8 % | 1,39 | 166 |
| stop 3.3 · TP 2R · sans suiveur | 0,78 | 20,9 % | -29,1 % | 1,43 | 158 |
| stop 3.3 · TP 2R · suiveur | 0,62 | 12,0 % | -23,8 % | 1,38 | 166 |
| stop 3.3 · TP 3R · sans suiveur | 0,33 | 5,5 % | -43,1 % | 1,18 | 151 |
| stop 3.3 · TP 3R · suiveur | 0,51 | 9,6 % | -28,8 % | 1,32 | 166 |
| stop 4.5 · sans TP · sans suiveur | 1,02 | 48,1 % | -41,4 % | 2,01 | 126 |
| stop 4.5 · sans TP · suiveur | 0,87 | 24,7 % | -34,0 % | 1,59 | 158 |
| stop 4.5 · TP 2R · sans suiveur | 0,32 | 5,3 % | -44,9 % | 1,17 | 147 |
| stop 4.5 · TP 2R · suiveur | 0,66 | 15,9 % | -34,0 % | 1,41 | 158 |
| stop 4.5 · TP 3R · sans suiveur | 0,47 | 11,4 % | -40,9 % | 1,28 | 141 |
| stop 4.5 · TP 3R · suiveur | 0,83 | 23,0 % | -34,0 % | 1,55 | 158 |

## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)

Entraînement (2018-09-01 → 2022-12-31) : CAGR 37,2 %, Sharpe 1,30, MDD -19,9 % · validation 2023-01-01 → 2026-09-30 : CAGR 42,4 %, Sharpe 1,69, MDD -24,8 %.
