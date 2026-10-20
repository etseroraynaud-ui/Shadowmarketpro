# OU Trend Channel Pro v2.3 · stratégie « trap » sur BTC/USD 4 h

Bitstamp 240 min (regroupé depuis 60 min), réglages en bougies du timeframe. Entraînement 2017-01-01 → 2022-12-31 ; validation 2023-01-01 → 2026-09-30 (jamais utilisée pour choisir). Croix violette = long, croix orange = short ; signal à la clôture, exécution à l'ouverture suivante ; une position, 100 % du capital, sans levier ; commission 0,045 % par ordre. Sélection : Sharpe journalier d'entraînement, au moins 50 trades. Essais : 209 (192 entrées + 17 sorties) ; Sharpe dégonflé avec 836 essais (quatre timeframes). Produit par `node research/ou-channel/ou-study.ts --tf 240`.

| Version | CAGR | Sharpe | MDD | PF | Trades | Win rate | OOS Sharpe |
|---|---|---|---|---|---|---|---|
| Baseline (réglages d'origine, stop 3,3 ATR) | -48,9 % | −0,69 | -98,6 % | 0,80 | 318 | 42,8 % | −0,04 |
| Top 1 entraînement · z 1.8 · réintégration 1 · mèche 0.5 · sans filtre volume · stop 3.3 ATR | 21,7 % | 0,63 | -71,4 % | 1,51 | 137 | 42,3 % | 0,21 |
| Top 2 entraînement · z 1.8 · réintégration 5 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 10,9 % | 0,46 | -75,4 % | 1,29 | 131 | 44,3 % | −0,61 |
| Top 3 entraînement · z 2.2 · réintégration 1 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | 11,0 % | 0,46 | -63,2 % | 1,68 | 61 | 27,9 % | −0,41 |
| Top 4 entraînement · z 2.6 · réintégration 2 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | 6,7 % | 0,39 | -67,4 % | 1,28 | 116 | 37,9 % | 0,10 |
| Top 5 entraînement · z 2.2 · réintégration 2 · mèche 0.6 · sans filtre volume · stop 3.3 ATR | 5,8 % | 0,38 | -63,3 % | 1,26 | 130 | 39,2 % | −0,79 |

Grille d'entrée : 20/192 configurations à Sharpe d'entraînement > 0.

## Candidates (validation)

| Candidate | Sharpe entr. | Sharpe valid. | CAGR valid. | MDD valid. | PF valid. | Trades valid. | Sharpe valid. frais ×2 | voisins : Sharpe entr. méd. · valid. méd. · valid. > 0 | DSR entr. |
|---|---|---|---|---|---|---|---|---|---|
| z 1.8 · réintégration 1 · mèche 0.5 · sans filtre volume · stop 3.3 ATR | 0,63 | 0,21 | 1,6 % | -46,0 % | 1,12 | 89 | 0,14 | −0,24 · −0,71 · 0,0 % | 0,195 |
| z 1.8 · réintégration 1 · mèche 0.5 · sans filtre volume · stop 4.5 ATR | 0,57 | −0,01 | -6,1 % | -52,4 % | 1,01 | 81 | −0,07 | −0,45 · −0,19 · 33,3 % | 0,159 |
| z 1.8 · réintégration 5 · mèche 0.7 · sans filtre volume · stop 3.3 ATR | 0,46 | −0,61 | -18,1 % | -69,5 % | 0,68 | 55 | −0,66 | −0,11 · −0,11 · 0,0 % | 0,099 |

## Sorties testées sur la meilleure entrée (entraînement)

| Sortie | Sharpe | CAGR | MDD | PF | Trades |
|---|---|---|---|---|---|
| stop 2 · sans TP · sans suiveur | 0,31 | 3,5 % | -73,6 % | 1,32 | 158 |
| stop 2 · sans TP · suiveur | −0,35 | -11,9 % | -59,0 % | 0,84 | 183 |
| stop 2 · TP 2R · sans suiveur | −0,39 | -17,4 % | -73,6 % | 0,85 | 169 |
| stop 2 · TP 2R · suiveur | −0,48 | -13,9 % | -66,5 % | 0,78 | 183 |
| stop 2 · TP 3R · sans suiveur | −0,50 | -22,1 % | -80,8 % | 0,80 | 162 |
| stop 2 · TP 3R · suiveur | −0,49 | -14,5 % | -67,4 % | 0,77 | 183 |
| stop 3.3 · sans TP · sans suiveur | 0,63 | 21,7 % | -71,4 % | 1,51 | 137 |
| stop 3.3 · sans TP · suiveur | −0,32 | -17,5 % | -73,6 % | 0,87 | 163 |
| stop 3.3 · TP 2R · sans suiveur | 0,08 | -6,7 % | -66,3 % | 1,04 | 139 |
| stop 3.3 · TP 2R · suiveur | −0,54 | -23,0 % | -80,7 % | 0,77 | 163 |
| stop 3.3 · TP 3R · sans suiveur | 0,29 | 2,3 % | -71,4 % | 1,16 | 139 |
| stop 3.3 · TP 3R · suiveur | −0,36 | -18,9 % | -75,3 % | 0,85 | 163 |
| stop 4.5 · sans TP · sans suiveur | 0,57 | 17,9 % | -79,1 % | 1,46 | 129 |
| stop 4.5 · sans TP · suiveur | −0,19 | -17,0 % | -79,0 % | 0,91 | 148 |
| stop 4.5 · TP 2R · sans suiveur | 0,16 | -5,2 % | -71,6 % | 1,08 | 131 |
| stop 4.5 · TP 2R · suiveur | −0,22 | -17,9 % | -78,7 % | 0,89 | 148 |
| stop 4.5 · TP 3R · sans suiveur | 0,25 | -1,4 % | -79,4 % | 1,14 | 131 |
| stop 4.5 · TP 3R · suiveur | −0,20 | -17,5 % | -79,8 % | 0,90 | 148 |

## Shock Engine V1 (sleeve BTC publiée, même source, mêmes frais)

Entraînement (2018-09-01 → 2022-12-31) : CAGR 37,2 %, Sharpe 1,30, MDD -19,9 % · validation 2023-01-01 → 2026-09-30 : CAGR 42,4 %, Sharpe 1,69, MDD -24,8 %.
