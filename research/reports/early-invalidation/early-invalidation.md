# Invalidation précoce d'un choc qui ne confirme pas

Plan : `research/preregistration/early-invalidation.md`, commité avant tout calcul. Script : `research/shock/early-invalidation.ts` (commit `8ebe720`, sources modifiées). Moteur non modifié. Exploratoire : BTC/ETH (développement) et 8 cryptos déjà consultées.

## Réponse

**V1 · invalidation à 1 h (4 bougies)** : Δ Sharpe BTC/ETH +0,030 (IC 95 % −0,189 à +0,224) ; Δ moyen 8 cryptos −0,045 (IC 90 % −0,152 à +0,043), 3/8 améliorées ; coûts × 2 : −0,022 et −0,088 → **pas de candidate**.

Avant tout rejeu, sur les trades encore ouverts après 4 bougies : 39 % n'ont pas confirmé (BTC/ETH ; 43 % sur les 8 cryptos). Parmi eux, 83 % finissent perdants, mais 6 % deviennent de grands gagnants (R ≥ 3), soit 14 % de tous les grands gagnants encore ouverts à cet instant. Les fermer à cet instant aurait rapporté −212 R (IC 95 % −423 à −30) sur BTC/ETH et −95 R (−327 à +103) sur les 8 cryptos (premier ordre, sans rejeu).

## Phase 1 · BTC/ETH : trades encore ouverts k bougies après l'entrée

| k | Encore ouverts | Part des trades | P(perdant) | P(grand gagnant, R ≥ 3) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 1238 | 94 % | 67 % | 14 % |
| 2 | 1087 | 83 % | 63 % | 16 % |
| 3 | 1010 | 77 % | 61 % | 17 % |
| 4 | 960 | 73 % | 60 % | 18 % |

**k = 1** (1238 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 1 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 605 | 49 % | 80 % | 9 % | 32 % | +0,27 | −0,32 | −0,73 | −442 [−718 ; −208] |
| rendement > 0 | 633 | 51 % | 55 % | 19 % | 68 % | +1,11 | +0,62 | −0,65 | −410 [−591 ; −246] |
| réintégré sous le niveau cassé | 100 | 8 % | 90 % | 3 % | 2 % | −0,83 | −0,56 | +0,13 | +13 [−10 ; +31] |
| au-delà du niveau cassé | 1138 | 92 % | 65 % | 15 % | 98 % | +0,84 | +0,23 | −0,76 | −865 [−1206 ; −568] |
| choc retracé ≥ 50 % | 69 | 6 % | 91 % | 1 % | 1 % | −0,93 | −0,68 | +0,10 | +7 [−4 ; +17] |
| choc retracé < 50 % | 1169 | 94 % | 66 % | 15 % | 99 % | +0,80 | +0,21 | −0,73 | −859 [−1206 ; −567] |
| volume après choc < médiane | 619 | 50 % | 76 % | 11 % | 39 % | +0,38 | −0,10 | −0,61 | −378 [−620 ; −172] |
| volume après choc ≥ médiane | 619 | 50 % | 59 % | 17 % | 61 % | +1,03 | +0,42 | −0,76 | −473 [−695 ; −280] |

**k = 2** (1087 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 2 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 468 | 43 % | 78 % | 9 % | 26 % | +0,26 | −0,30 | −0,67 | −316 [−507 ; −145] |
| rendement > 0 | 619 | 57 % | 51 % | 21 % | 74 % | +1,48 | +0,87 | −0,78 | −482 [−739 ; −258] |
| réintégré sous le niveau cassé | 78 | 7 % | 81 % | 6 % | 3 % | −0,29 | −0,49 | −0,33 | −25 [−69 ; +9] |
| au-delà du niveau cassé | 1009 | 93 % | 62 % | 17 % | 97 % | +1,05 | +0,43 | −0,77 | −772 [−1098 ; −490] |
| choc retracé ≥ 50 % | 64 | 6 % | 92 % | 5 % | 2 % | −0,59 | −0,58 | −0,10 | −7 [−50 ; +20] |
| choc retracé < 50 % | 1023 | 94 % | 61 % | 17 % | 98 % | +1,05 | +0,42 | −0,77 | −791 [−1117 ; −511] |
| volume après choc < médiane | 543 | 50 % | 73 % | 11 % | 36 % | +0,35 | −0,00 | −0,47 | −258 [−420 ; −108] |
| volume après choc ≥ médiane | 544 | 50 % | 53 % | 20 % | 64 % | +1,56 | +0,73 | −0,99 | −540 [−830 ; −283] |

**k = 3** (1010 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 3 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 401 | 40 % | 80 % | 10 % | 24 % | +0,35 | −0,31 | −0,76 | −305 [−488 ; −136] |
| rendement > 0 | 609 | 60 % | 49 % | 21 % | 76 % | +1,57 | +0,99 | −0,75 | −460 [−709 ; −251] |
| réintégré sous le niveau cassé | 74 | 7 % | 85 % | 7 % | 3 % | −0,25 | −0,49 | −0,35 | −26 [−72 ; +9] |
| au-delà du niveau cassé | 936 | 93 % | 59 % | 18 % | 97 % | +1,19 | +0,55 | −0,79 | −739 [−1089 ; −443] |
| choc retracé ≥ 50 % | 83 | 8 % | 89 % | 6 % | 3 % | −0,07 | −0,57 | −0,61 | −50 [−134 ; +12] |
| choc retracé < 50 % | 927 | 92 % | 58 % | 18 % | 97 % | +1,19 | +0,57 | −0,77 | −714 [−1054 ; −423] |
| volume après choc < médiane | 505 | 50 % | 72 % | 11 % | 32 % | +0,37 | +0,04 | −0,45 | −225 [−397 ; −77] |
| volume après choc ≥ médiane | 505 | 50 % | 50 % | 23 % | 68 % | +1,81 | +0,92 | −1,07 | −539 [−831 ; −289] |

**k = 4** (960 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 4 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 371 | 39 % | 83 % | 6 % | 14 % | +0,17 | −0,31 | −0,57 | −212 [−423 ; −30] |
| rendement > 0 | 589 | 61 % | 45 % | 25 % | 86 % | +1,80 | +1,09 | −0,90 | −530 [−752 ; −324] |
| réintégré sous le niveau cassé | 73 | 8 % | 82 % | 7 % | 3 % | −0,06 | −0,50 | −0,54 | −39 [−95 ; +7] |
| au-delà du niveau cassé | 887 | 92 % | 58 % | 18 % | 97 % | +1,27 | +0,64 | −0,79 | −702 [−1052 ; −404] |
| choc retracé ≥ 50 % | 84 | 9 % | 87 % | 5 % | 2 % | −0,13 | −0,56 | −0,53 | −44 [−128 ; +15] |
| choc retracé < 50 % | 876 | 91 % | 57 % | 19 % | 98 % | +1,30 | +0,66 | −0,80 | −697 [−1050 ; −396] |
| volume après choc < médiane | 480 | 50 % | 71 % | 12 % | 33 % | +0,58 | +0,08 | −0,61 | −295 [−529 ; −101] |
| volume après choc ≥ médiane | 480 | 50 % | 48 % | 24 % | 67 % | +1,77 | +1,02 | −0,93 | −447 [−728 ; −222] |

## Phase 1 · 8 cryptos : trades encore ouverts k bougies après l'entrée

| k | Encore ouverts | Part des trades | P(perdant) | P(grand gagnant, R ≥ 3) |
| --- | ---: | ---: | ---: | ---: |
| 1 | 4443 | 94 % | 71 % | 10 % |
| 2 | 3906 | 83 % | 68 % | 11 % |
| 3 | 3650 | 77 % | 66 % | 12 % |
| 4 | 3431 | 73 % | 65 % | 12 % |

**k = 1** (4443 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 1 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 2253 | 51 % | 82 % | 6 % | 31 % | −0,29 | −0,34 | −0,14 | −307 [−613 ; −15] |
| rendement > 0 | 2190 | 49 % | 59 % | 14 % | 69 % | +0,87 | +0,65 | −0,34 | −745 [−1229 ; −308] |
| réintégré sous le niveau cassé | 377 | 8 % | 90 % | 3 % | 3 % | −0,63 | −0,54 | −0,02 | −6 [−76 ; +57] |
| au-delà du niveau cassé | 4066 | 92 % | 69 % | 11 % | 97 % | +0,36 | +0,22 | −0,26 | −1047 [−1630 ; −478] |
| choc retracé ≥ 50 % | 390 | 9 % | 91 % | 3 % | 3 % | −0,71 | −0,60 | +0,02 | +7 [−52 ; +59] |
| choc retracé < 50 % | 4053 | 91 % | 69 % | 11 % | 97 % | +0,37 | +0,23 | −0,26 | −1059 [−1645 ; −499] |
| volume après choc < médiane | 2221 | 50 % | 79 % | 7 % | 36 % | −0,11 | −0,12 | −0,11 | −247 [−606 ; +114] |
| volume après choc ≥ médiane | 2222 | 50 % | 63 % | 13 % | 64 % | +0,66 | +0,43 | −0,36 | −806 [−1271 ; −414] |

**k = 2** (3906 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 2 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 1761 | 45 % | 83 % | 6 % | 24 % | −0,28 | −0,31 | −0,10 | −178 [−443 ; +72] |
| rendement > 0 | 2145 | 55 % | 55 % | 16 % | 76 % | +1,04 | +0,82 | −0,36 | −777 [−1189 ; −376] |
| réintégré sous le niveau cassé | 342 | 9 % | 89 % | 5 % | 4 % | −0,56 | −0,50 | −0,01 | −5 [−71 ; +55] |
| au-delà du niveau cassé | 3564 | 91 % | 65 % | 12 % | 96 % | +0,54 | +0,39 | −0,27 | −950 [−1520 ; −415] |
| choc retracé ≥ 50 % | 402 | 10 % | 90 % | 4 % | 4 % | −0,60 | −0,55 | −0,02 | −9 [−88 ; +64] |
| choc retracé < 50 % | 3504 | 90 % | 65 % | 12 % | 96 % | +0,56 | +0,41 | −0,27 | −946 [−1517 ; −413] |
| volume après choc < médiane | 1953 | 50 % | 77 % | 7 % | 32 % | −0,08 | −0,08 | −0,09 | −175 [−487 ; +138] |
| volume après choc ≥ médiane | 1953 | 50 % | 58 % | 15 % | 68 % | +0,97 | +0,70 | −0,40 | −779 [−1220 ; −390] |

**k = 3** (3650 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 3 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 1611 | 44 % | 82 % | 6 % | 23 % | −0,26 | −0,32 | −0,13 | −215 [−471 ; +13] |
| rendement > 0 | 2039 | 56 % | 54 % | 16 % | 77 % | +1,12 | +0,93 | −0,33 | −676 [−1179 ; −217] |
| réintégré sous le niveau cassé | 341 | 9 % | 87 % | 4 % | 3 % | −0,57 | −0,51 | −0,02 | −6 [−66 ; +48] |
| au-delà du niveau cassé | 3309 | 91 % | 64 % | 13 % | 97 % | +0,62 | +0,47 | −0,27 | −885 [−1480 ; −337] |
| choc retracé ≥ 50 % | 439 | 12 % | 90 % | 3 % | 3 % | −0,66 | −0,56 | +0,03 | +14 [−70 ; +83] |
| choc retracé < 50 % | 3211 | 88 % | 63 % | 13 % | 97 % | +0,67 | +0,50 | −0,28 | −905 [−1501 ; −360] |
| volume après choc < médiane | 1825 | 50 % | 77 % | 8 % | 32 % | −0,04 | −0,06 | −0,11 | −197 [−551 ; +140] |
| volume après choc ≥ médiane | 1825 | 50 % | 56 % | 16 % | 68 % | +1,06 | +0,81 | −0,38 | −694 [−1104 ; −321] |

**k = 4** (3431 trades ouverts). Valeur d'une sortie à cet instant = R en fermant à la clôture de i + 4 − R final ; > 0 : couper aurait rapporté.

| Groupe (connu à la clôture de i + k) | Trades | Part | P(perdant) | P(grand gagnant) | Part des grands gagnants ouverts | R final moyen | R à cet instant | Valeur moyenne de la sortie | Valeur totale [IC 95 %] |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| rendement ≤ 0 (non confirmé) | 1485 | 43 % | 83 % | 5 % | 19 % | −0,33 | −0,33 | −0,06 | −95 [−327 ; +103] |
| rendement > 0 | 1946 | 57 % | 52 % | 18 % | 81 % | +1,25 | +0,99 | −0,40 | −786 [−1248 ; −338] |
| réintégré sous le niveau cassé | 358 | 10 % | 88 % | 5 % | 4 % | −0,51 | −0,52 | −0,08 | −30 [−115 ; +40] |
| au-delà du niveau cassé | 3073 | 90 % | 63 % | 13 % | 96 % | +0,69 | +0,53 | −0,28 | −851 [−1449 ; −315] |
| choc retracé ≥ 50 % | 457 | 13 % | 89 % | 4 % | 4 % | −0,58 | −0,55 | −0,04 | −18 [−115 ; +63] |
| choc retracé < 50 % | 2974 | 87 % | 62 % | 14 % | 96 % | +0,74 | +0,57 | −0,29 | −863 [−1448 ; −328] |
| volume après choc < médiane | 1715 | 50 % | 76 % | 7 % | 30 % | −0,02 | −0,05 | −0,12 | −199 [−534 ; +106] |
| volume après choc ≥ médiane | 1716 | 50 % | 55 % | 17 % | 70 % | +1,15 | +0,89 | −0,40 | −682 [−1085 ; −316] |

## Phase 2 · règle rejouée en portefeuille complet

### BTC/ETH, portefeuille 50/50 sans rebalancement

| Variante | Sharpe | CAGR | Drawdown max. | Rendement total | PF | Trades | Invalidés | Temps en position | 5 % meilleurs trades V0 : présents · coupés par la règle · rendement conservé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,88 | 61,6 % | −19,1 % | 4748 % | 1,96 | 1311 | 0 | 17 % | 100 % · 0 % · 100 % |
| V1 · invalidation à 1 h (4 bougies) | 1,91 | 55,6 % | −17,7 % | 3457 % | 2,03 | 1408 | 413 | 13 % | 100 % · 26 % · 73 % |
| sensibilité · 30 min (2 bougies) | 1,72 | 48,9 % | −23,2 % | 2397 % | 1,89 | 1463 | 532 | 13 % | 100 % · 33 % · 67 % |
| sensibilité · 2 h (8 bougies) | 1,79 | 51,9 % | −18,4 % | 2840 % | 1,96 | 1384 | 305 | 14 % | 100 % · 27 % · 71 % |

| Coûts × 2 | Sharpe | CAGR | Drawdown max. |
| --- | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,61 | 50,2 % | −20,7 % |
| V1 · invalidation à 1 h (4 bougies) | 1,59 | 43,8 % | −21,0 % |

### 8 cryptos

| Actif | Sharpe V0 | Sharpe V1 | Sharpe S2 | Sharpe S8 | Δ V1 | Invalidés (V1) | Meilleurs trades coupés (V1) | Rendement des meilleurs conservé (V1) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| XRP | 0,78 | 0,50 | 0,72 | 0,57 | −0,27 | 220 | 28 % | 78 % |
| BNB | 0,58 | 0,42 | 0,26 | 0,44 | −0,17 | 225 | 19 % | 78 % |
| DOGE | 0,53 | 0,51 | 0,62 | 0,62 | −0,02 | 203 | 7 % | 95 % |
| TRX | 0,30 | 0,23 | 0,13 | 0,29 | −0,07 | 195 | 11 % | 91 % |
| ADA | 0,57 | 0,59 | 0,63 | 0,56 | +0,02 | 228 | 23 % | 77 % |
| LINK | 0,68 | 0,91 | 0,67 | 0,74 | +0,23 | 168 | 8 % | 89 % |
| XLM | 0,51 | 0,51 | 0,25 | 0,38 | +0,01 | 209 | 24 % | 79 % |
| LTC | 0,13 | 0,04 | −0,03 | 0,09 | −0,09 | 231 | 27 % | 66 % |

| Moyenne 8 cryptos | Sharpe | CAGR | Drawdown max. | PF | Trades | Invalidés | Temps en position | Meilleurs trades coupés | Rendement des meilleurs conservé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 0,51 | 14,7 % | −53,4 % | 1,26 | 590 | 0 | 16 % | 0 % | 100 % |
| V1 · invalidation à 1 h (4 bougies) | 0,46 | 12,5 % | −52,4 % | 1,25 | 645 | 210 | 12 % | 18 % | 82 % |
| sensibilité · 30 min (2 bougies) | 0,41 | 11,1 % | −53,0 % | 1,23 | 656 | 251 | 11 % | 26 % | 73 % |
| sensibilité · 2 h (8 bougies) | 0,46 | 12,5 % | −53,8 % | 1,25 | 630 | 160 | 12 % | 18 % | 81 % |

## Lecture

- **L'information existe.** À la clôture de la 4e bougie, un trade qui n'a pas confirmé finit perdant dans 83 % des cas contre 45 % pour un trade en gain (8 cryptos : 83 % contre 52 %). La réintégration du niveau cassé et un retracement d'au moins la moitié du choc isolent des groupes encore plus perdants (82 % et 87 %), mais petits (8 % et 9 % des trades ouverts).
- **Agir dessus ne rapporte pas.** Les trades non confirmés sont en moyenne à −0,31 R à cet instant (BTC/ETH ; −0,33 R sur les 8 cryptos), mais leur R final moyen est +0,17 R (−0,33 R). Les couper à cet instant épargnerait +185 R sur les futurs perdants et coûterait −397 R sur les futurs gagnants, dont −341 R sur les seuls grands gagnants (6 % du groupe) ; 8 cryptos : +764, −859 et −598 R. Valeur totale négative sur BTC/ETH, non distinguable de zéro sur les 8 cryptos. Groupes « réintégré » et « retracé ≥ 50 % » : non distinguable de zéro sur les deux échantillons.
- **Le rejeu le confirme.** V1 ferme 413 positions sur BTC/ETH, réduit le temps en position (17 % → 13 %) et le drawdown (−19,1 % → −17,7 %), mais le CAGR baisse (61,6 % → 55,6 %) et 26 % des 5 % meilleurs trades de V0 sont coupés par la règle ; le Sharpe varie de +0,030 (IC 95 % −0,189 à +0,224). Sur les 8 cryptos, 3/8 s'améliorent et l'écart moyen est −0,045. Les délais de 2 et 8 bougies ne font pas mieux (Sharpe BTC/ETH 1,72 et 1,79).
- **Conclusion** : la règle fixée d'avance n'est pas remplie. Un choc qui ne confirme pas dans la première heure est le plus souvent perdu, mais l'invalider plus tôt ne crée pas de valeur : ce qui est épargné sur les perdants est rendu sur la minorité qui confirme tard. Shock Engine reste inchangé.

## Limites

- Exploratoire, aucune donnée vierge. Phase 1 : valeur d'une sortie de premier ordre (TP1 approché par les extrêmes des bougies, commissions du trade réel), sans rejeu ; la phase 2 rejoue tout.
- Population P_k : trades encore ouverts une fois la bougie i + k jouée ; une fermeture du script à la clôture même de i + k (flip) les exclut.
- La valeur de premier ordre ignore les entrées que libère une sortie anticipée ; le rejeu les inclut (plus de trades en V1 qu'en V0).
- « Meilleurs trades » : 5 % des trades de V0 au plus fort rendement ; présents = même bougie d'entrée et même sens dans la variante ; rendement conservé = somme des log-rendements de ces trades dans la variante / dans V0.

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | lib/strategies/shock/market.ts |
| empreinte lib/strategies/shock/strategy.ts | OK | lib/strategies/shock/strategy.ts |
| empreinte lib/strategies/shock/broker.ts | OK | lib/strategies/shock/broker.ts |
| empreinte lib/strategies/shock/engine.ts | OK | lib/strategies/shock/engine.ts |
| empreinte research/lib/frozen-shock.ts | OK | research/lib/frozen-shock.ts |
| empreinte research/lib/e2.ts | OK | research/lib/e2.ts |
| BTC : boucle sans règle = simulate() | OK | 774 positions |
| XRP : boucle sans règle = simulate() | OK | 589 positions |
| BTC : V0 = trades publiés | OK | 644 |
| ETH : V0 = trades publiés | OK | 667 |
| BTC/ETH : Sharpe de V0 = Sharpe publié | OK | 1.877566513 |
| BTC/ETH : 1 311 trades | OK | 1311 |

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/early-invalidation.ts
```
