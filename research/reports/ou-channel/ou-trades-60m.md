# Anatomie des trades · OU Trend Channel · BTC/USD 1 h

Entraînement 2017-01-01 → 2022-12-31 · validation 2023-01-01 → 2026-09-30 · commission 0,045 % par ordre · R = distance du stop initial. Produit par `node research/ou-channel/ou-trades.ts`.

## Entraînement

|  | Baseline (réglages d'origine, stop 3,3 ATR) | Top 1 (stop 3,3 ATR) | Top 1, stop 4,5 ATR (meilleure) |
|---|---|---|---|
| Sharpe | −0,79 | 1,03 | 1,02 |
| trades (par an) | 1334 (222) | 133 (22) | 126 (21) |
| temps en position | 84 % | 40 % | 49 % |
| taux de gain | 48,1 % | 27,1 % | 32,5 % |
| gain moyen · médian | 3,43 % · 2,70 % | 20,04 % · 9,65 % | 19,92 % · 11,38 % |
| perte moyenne · médiane | −3,64 % · −3,20 % | −3,52 % · −3,12 % | −4,79 % · −4,29 % |
| payoff (gain moy. / perte moy.) | 0,94 | 5,69 | 4,16 |
| espérance par trade | −0,235 % | 2,855 % | 3,251 % |
| rendement brut moyen · frais aller-retour | −0,145 % · 0,090 % | 2,946 % · 0,090 % | 3,342 % · 0,090 % |
| PF brut (sans frais) | 0,92 | 2,18 | 2,05 |
| P5 · P25 · P50 · P75 · P95 | −6,3 % · −3,3 % · −0,7 % · 2,6 % · 7,3 % | −6,8 % · −3,8 % · −2,5 % · 1,4 % · 23,8 % | −9,1 % · −4,8 % · −3,3 % · 3,6 % · 32,0 % |
| meilleur · pire trade | 21,4 % · −15,2 % | 152,3 % · −10,3 % | 152,3 % · −14,0 % |
| stop initial médian (% du prix) | 3,23 % | 3,17 % | 4,37 % |
| R médian · R moyen | −0,20 · −0,06 | −1,02 · 0,81 | −1,02 · 0,69 |
| R < −1,2 R (stop glissé) | 0 (0 %) · 0,00 | 0 (0 %) · 0,00 | 0 (0 %) · 0,00 |
| R −1,2 à −0,8 R (stop) | 659 (49 %) · −25,62 | 97 (73 %) · −3,49 | 85 (67 %) · −4,20 |
| R −0,8 à 0 R | 33 (2 %) · −0,18 | 0 (0 %) · 0,00 | 0 (0 %) · 0,00 |
| R 0 à 1 R | 407 (31 %) · 9,23 | 10 (8 %) · 0,26 | 14 (11 %) · 0,42 |
| R 1 à 3 R | 222 (17 %) · 11,04 | 13 (10 %) · 1,13 | 12 (10 %) · 1,23 |
| R 3 à 10 R | 13 (1 %) · 1,15 | 9 (7 %) · 2,13 | 12 (10 %) · 3,07 |
| R > 10 R | 0 (0 %) · 0,00 | 4 (3 %) · 2,20 | 3 (2 %) · 1,84 |
| part des 5 meilleurs trades · des 10 % meilleurs (log) | −18 % · −228 % | 132 % · 199 % | 125 % · 200 % |
| durée médiane gagnants · perdants | 36 h · 17 h | 228 h · 34 h | 259 h · 60 h |
| sorties : stop · signal opposé · fin | 658 (0 % gagnants) · 675 (95 % gagnants) · 1 (0 % gagnants) | 97 (0 % gagnants) · 36 (100 % gagnants) · 0 (0 % gagnants) | 85 (0 % gagnants) · 41 (100 % gagnants) · 0 (0 % gagnants) |
| longs : n · gain · somme log | 653 · 49 % · −1,72 | 64 · 30 % · 2,26 | 60 · 37 % · 2,58 |
| shorts : n · gain · somme log | 681 · 47 % · −2,65 | 69 · 25 % · −0,04 | 66 · 29 % · −0,22 |
| bêta BTC · alpha / an · t | 0,07 · −56,7 % · −2,13 | 0,04 · 43,9 % · 2,33 | 0,08 · 46,0 % · 2,22 |
| hasard (même sens, durée, stop) : réel · médiane · 95e c. · battus | −4,37 · −1,44 · 1,26 · 2 % | 2,21 · −0,03 · 1,29 · 100 % | 2,36 · 0,10 · 1,74 · 99 % |

## Validation

|  | Baseline (réglages d'origine, stop 3,3 ATR) | Top 1 (stop 3,3 ATR) | Top 1, stop 4,5 ATR (meilleure) |
|---|---|---|---|
| Sharpe | −0,47 | 0,62 | 0,87 |
| trades (par an) | 897 (239) | 79 (21) | 75 (20) |
| temps en position | 83 % | 39 % | 51 % |
| taux de gain | 46,8 % | 25,3 % | 30,7 % |
| gain moyen · médian | 2,13 % · 1,71 % | 9,37 % · 5,86 % | 10,89 % · 6,04 % |
| perte moyenne · médiane | −2,03 % · −1,96 % | −2,11 % · −2,03 % | −2,81 % · −2,77 % |
| payoff (gain moy. / perte moy.) | 1,05 | 4,44 | 3,88 |
| espérance par trade | −0,080 % | 0,795 % | 1,395 % |
| rendement brut moyen · frais aller-retour | 0,010 % · 0,090 % | 0,885 % · 0,090 % | 1,485 % · 0,090 % |
| PF brut (sans frais) | 1,01 | 1,59 | 1,79 |
| P5 · P25 · P50 · P75 · P95 | −3,2 % · −2,0 % · −0,8 % · 1,6 % · 4,3 % | −3,1 % · −2,4 % · −1,8 % · −0,1 % · 15,0 % | −3,9 % · −3,2 % · −2,2 % · 2,8 % · 21,4 % |
| meilleur · pire trade | 12,5 % · −5,1 % | 32,7 % · −3,8 % | 40,1 % · −5,1 % |
| stop initial médian (% du prix) | 1,99 % | 1,89 % | 2,54 % |
| R médian · R moyen | −0,39 · −0,05 | −1,04 · 0,97 | −1,03 · 0,99 |
| R < −1,2 R (stop glissé) | 0 (0 %) · 0,00 | 0 (0 %) · 0,00 | 0 (0 %) · 0,00 |
| R −1,2 à −0,8 R (stop) | 445 (50 %) · −9,64 | 59 (75 %) · −1,26 | 51 (68 %) · −1,48 |
| R −0,8 à 0 R | 32 (4 %) · −0,15 | 0 (0 %) · 0,00 | 1 (1 %) · −0,00 |
| R 0 à 1 R | 247 (28 %) · 2,89 | 2 (3 %) · 0,03 | 3 (4 %) · 0,05 |
| R 1 à 3 R | 168 (19 %) · 5,60 | 9 (11 %) · 0,36 | 10 (13 %) · 0,43 |
| R 3 à 10 R | 5 (1 %) · 0,32 | 7 (9 %) · 0,80 | 7 (9 %) · 0,93 |
| R > 10 R | 0 (0 %) · 0,00 | 2 (3 %) · 0,53 | 3 (4 %) · 0,87 |
| part des 5 meilleurs trades · des 10 % meilleurs (log) | −46 % · −426 % | 225 % · 273 % | 158 % · 209 % |
| durée médiane gagnants · perdants | 34 h · 15 h | 188 h · 26 h | 260 h · 54 h |
| sorties : stop · signal opposé · fin | 445 (0 % gagnants) · 451 (93 % gagnants) · 1 (100 % gagnants) | 59 (0 % gagnants) · 19 (100 % gagnants) · 1 (100 % gagnants) | 51 (0 % gagnants) · 23 (96 % gagnants) · 1 (100 % gagnants) |
| longs : n · gain · somme log | 440 · 49 % · 0,13 | 41 · 24 % · 0,30 | 38 · 29 % · 0,53 |
| shorts : n · gain · somme log | 457 · 44 % · −1,12 | 38 · 26 % · 0,17 | 37 · 32 % · 0,27 |
| bêta BTC · alpha / an · t | 0,06 · −22,0 % · −1,07 | −0,02 · 16,6 % · 1,27 | 0,03 · 23,9 % · 1,59 |
| hasard (même sens, durée, stop) : réel · médiane · 95e c. · battus | −0,99 · −0,64 · 0,48 · 31 % | 0,47 · −0,03 · 0,50 · 94 % | 0,79 · −0,09 · 0,60 · 97 % |

