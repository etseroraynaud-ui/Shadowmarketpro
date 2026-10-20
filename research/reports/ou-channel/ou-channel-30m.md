# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD 30 min

Bitstamp 30 min, réglages en bougies du timeframe. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins 50 trades. Essais : 209 (192 entrées + 17 sorties) ; Sharpe dégonflé avec 836 essais (quatre timeframes). Produit par `node research/ou-channel/ou-study.ts --tf 30`.

| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |
|---|---|---|---|---|---|---|---|
| Baseline (réglages d'origine, stop 3,3 ATR) | -72,1 % | −1,57 | -100,0 % | 0,83 | 2681 | 47,1 % | −1,14 |
| Top 1 entraînement · z 2.2 · réintégration 3 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 7,5 % | 0,40 | -63,2 % | 1,11 | 688 | 34,7 % | −1,17 |
| Top 2 entraînement · z 1.8 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 6,6 % | 0,36 | -70,5 % | 1,18 | 271 | 25,8 % | −1,63 |
| Top 3 entraînement · z 1.8 · réintégration 2 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | -1,3 % | 0,23 | -86,0 % | 1,07 | 616 | 33,4 % | −0,47 |
| Top 4 entraînement · z 1.8 · réintégration 2 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | -5,8 % | 0,19 | -92,7 % | 1,04 | 1221 | 41,8 % | −0,80 |
| Top 5 entraînement · z 1.8 · réintégration 5 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | -10,1 % | 0,11 | -90,5 % | 1,02 | 1061 | 38,7 % | −0,56 |

Grille d'entrée : 7/192 configurations à Sharpe d'entraînement > 0.

## Candidates (validation)

| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |
|---|---|---|---|---|---|---|---|---|---|
| z 2.2 · réintégration 3 · mèche 0.7 · sans filtre volume · stop 2 ATR | 0,53 | −1,51 | -30,6 % | -74,8 % | 0,65 | 471 | −2,00 | −0,13 · −1,16 · 0,0 % | 0,001 |
| z 2.2 · réintégration 3 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 0,40 | −1,17 | -30,5 % | -76,3 % | 0,73 | 428 | −1,53 | −0,14 · −0,87 · 0,0 % | 0,000 |
| z 1.8 · réintégration 1 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 0,36 | −1,63 | -28,6 % | -75,3 % | 0,41 | 154 | −1,80 | −0,03 · −0,82 · 0,0 % | 0,000 |

## Sorties testées sur la meilleure entrée (entraînement)

| Sortie | Sharpe | CAGR | MDD | PF | Trades |
|---|---|---|---|---|---|
| stop 2 · sans TP · sans suiveur | 0,53 | 15,0 % | -60,8 % | 1,16 | 773 |
| stop 2 · sans TP · suiveur | −1,53 | -28,7 % | -87,6 % | 0,67 | 878 |
| stop 2 · TP 2R · sans suiveur | −0,59 | -20,7 % | -80,1 % | 0,88 | 842 |
| stop 2 · TP 2R · suiveur | −1,72 | -29,6 % | -88,5 % | 0,66 | 878 |
| stop 2 · TP 3R · sans suiveur | −0,39 | -18,1 % | -72,1 % | 0,92 | 822 |
| stop 2 · TP 3R · suiveur | −1,51 | -27,9 % | -86,9 % | 0,69 | 878 |
| stop 3.3 · sans TP · sans suiveur | 0,40 | 7,5 % | -63,2 % | 1,11 | 688 |
| stop 3.3 · sans TP · suiveur | −0,17 | -10,8 % | -66,0 % | 0,96 | 839 |
| stop 3.3 · TP 2R · sans suiveur | −0,19 | -16,2 % | -73,9 % | 0,96 | 737 |
| stop 3.3 · TP 2R · suiveur | −0,09 | -8,1 % | -63,6 % | 0,98 | 839 |
| stop 3.3 · TP 3R · sans suiveur | −0,08 | -13,7 % | -69,1 % | 0,99 | 720 |
| stop 3.3 · TP 3R · suiveur | −0,20 | -11,5 % | -66,5 % | 0,96 | 839 |
| stop 4.5 · sans TP · sans suiveur | 0,16 | -7,3 % | -81,9 % | 1,05 | 637 |
| stop 4.5 · sans TP · suiveur | −0,17 | -15,4 % | -77,8 % | 0,96 | 786 |
| stop 4.5 · TP 2R · sans suiveur | −0,39 | -28,1 % | -90,7 % | 0,92 | 676 |
| stop 4.5 · TP 2R · suiveur | −0,25 | -17,7 % | -74,0 % | 0,95 | 786 |
| stop 4.5 · TP 3R · sans suiveur | −0,17 | -21,1 % | -85,1 % | 0,97 | 655 |
| stop 4.5 · TP 3R · suiveur | −0,18 | -15,8 % | -74,4 % | 0,96 | 786 |

## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)

Entraînement (2018-09-01 → 2022-12-31) : CAGR 37,2 %, Sharpe 1,30, MDD -19,9 % · validation 2023-01-01 → 2026-09-30 : CAGR 42,4 %, Sharpe 1,69, MDD -24,8 %.
