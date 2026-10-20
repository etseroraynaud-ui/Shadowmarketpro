# Transfert de Shock Engine V1 · or (substitut XAU/USD) · étape de développement

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `3ced50a82eb6bbe61805d59cc8a7a39a48d8ef52fed5c1dce0d29b1740ee49e5`.

## Données

- Fichier `research/data/xauusd_15m.csv.gz` (SHA-256 `74b3d71f9e48bf4e…`). Couverture continue à partir du 2012-01-02 23:00 UTC ; évaluation du 2014-01-01 au 2026-09-30 ; développement jusqu'au 2022-12-31 ; plis de validation 2016 – 2022.
- 301 354 bougies de 15 min ; 3 308 suivent une fermeture (pas d'entrée) ; 0 sans volume ; pas de prix 0,001.
- Plus forts rendements 15 min (écarts types) : 2026-03-23 11:00 +41,7 · 2021-08-08 22:45 −40,7 · 2026-01-29 15:15 −35,7 · 2026-02-01 23:00 −31,3 (après fermeture) · 2015-07-20 01:15 −26,0 · 2026-02-02 01:00 −25,6 · 2020-03-15 22:00 +25,3 (après fermeture) · 2023-12-03 23:15 +25,2.

| contrôle bloquant | résultat | détail |
| --- | ---: | ---: |
| horodatages strictement croissants | OK | 0 |
| bas ≤ ouverture, clôture ≤ haut | OK | 0 |
| prix > 0 | OK | 0 |
| bougies manquantes < 2 % par an (heures prévues, fériés exclus) | OK | 2014 1.13 % · 2015 0.59 % · 2016 0.44 % · 2017 0.49 % · 2018 0.50 % · 2019 0.46 % · 2020 0.51 % · 2021 0.46 % · 2022 0.37 % · 2023 0.41 % · 2024 0.40 % · 2025 0.41 % · 2026 0.41 % |
| au plus 25 trous imprévus de plus de 60 min par an | **ÉCHEC** | 2014 31 · 2015 10 · 2016 7 · 2017 8 · 2018 7 · 2019 7 · 2020 7 · 2021 7 · 2022 8 · 2023 8 · 2024 8 · 2025 8 · 2026 6 |
| au plus 20 mauvais ticks (> 8 ATR de la clôture précédente et de la clôture) | OK | 7 |

| année | quarts d'heure prévus | manquants | séances fériées | trous imprévus > 60 min |
| --- | ---: | ---: | ---: | ---: |
| 2014 | 23 736 | 1,13 % | 2 | 31 |
| 2015 | 23 736 | 0,59 % | 3 | 10 |
| 2016 | 23 736 | 0,44 % | 3 | 7 |
| 2017 | 23 644 | 0,49 % | 3 | 8 |
| 2018 | 23 736 | 0,50 % | 3 | 7 |
| 2019 | 23 736 | 0,46 % | 3 | 7 |
| 2020 | 23 828 | 0,51 % | 3 | 7 |
| 2021 | 23 736 | 0,46 % | 3 | 7 |
| 2022 | 23 736 | 0,37 % | 2 | 8 |
| 2023 | 23 644 | 0,41 % | 3 | 8 |
| 2024 | 23 828 | 0,40 % | 3 | 8 |
| 2025 | 23 736 | 0,41 % | 3 | 8 |
| 2026 | 17 764 | 0,41 % | 2 | 6 |

## Étape 1 — étude d'événement au seuil figé de V1 (avant toute calibration)

Rendement dans le sens de l'événement en ATR (jeu calme) ; excès = moins le mouvement moyen d'une bougie quelconque de la même année au même quart d'heure de New York. Intervalles par bootstrap des mois (5 000 tirages) ; t par grappes de mois et t de Newey–West sur les sommes journalières. Horizons en bougies de cotation.

### F1 · entrées qualifiées de V1 (seuil figé) · 471 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 471 | +0,058 | −0,085 | +0,060 | −0,099 | −0,047 à +0,165 | −0,066 à +0,187 | 0,93 | 0,90 | +0,104 / −0,010 | 69 % de 13 | 0 % |
| 4 | 471 | +0,163 | +0,048 | +0,155 | +0,057 | −0,054 à +0,365 | −0,098 à +0,406 | 1,19 | 1,10 | +0,159 / +0,148 | 69 % de 13 | 0 % |
| 16 | 471 | +0,560 | +0,035 | +0,521 | −0,010 | +0,094 à +0,966 | +0,006 à +1,052 | 1,94 | 1,79 | +0,586 / +0,418 | 69 % de 13 | 6 % |
| 64 | 471 | +1,146 | +0,635 | +1,028 | +0,529 | +0,374 à +1,675 | +0,236 à +1,797 | 2,54 | 2,32 | +1,182 / +0,786 | 77 % de 13 | 81 % |

### F2 · chocs bruts, régime calme · 2 735 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 735 | −0,003 | −0,096 | −0,001 | −0,091 | −0,043 à +0,040 | −0,050 à +0,048 | −0,03 | −0,03 | +0,013 / −0,018 | 46 % de 13 | 0 % |
| 4 | 2 735 | +0,081 | −0,029 | +0,081 | −0,034 | +0,006 à +0,157 | −0,007 à +0,173 | 1,78 | 1,63 | +0,105 / +0,051 | 77 % de 13 | 0 % |
| 16 | 2 735 | +0,119 | −0,028 | +0,122 | −0,031 | −0,006 à +0,252 | −0,031 à +0,285 | 1,50 | 1,49 | +0,079 / +0,176 | 69 % de 13 | 7 % |
| 64 | 2 735 | +0,078 | −0,020 | +0,100 | +0,054 | −0,079 à +0,284 | −0,113 à +0,318 | 0,91 | 0,85 | +0,082 / +0,123 | 46 % de 13 | 79 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 1 798 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 798 | −0,026 | −0,107 | −0,026 | −0,105 | −0,079 à +0,027 | −0,088 à +0,036 | −0,80 | −0,79 | −0,009 / −0,049 | 46 % de 13 | 0 % |
| 4 | 1 798 | +0,067 | −0,063 | +0,065 | −0,089 | −0,035 à +0,172 | −0,056 à +0,194 | 1,02 | 0,96 | +0,061 / +0,070 | 69 % de 13 | 0 % |
| 16 | 1 798 | +0,073 | −0,006 | +0,065 | −0,040 | −0,128 à +0,256 | −0,160 à +0,293 | 0,55 | 0,53 | +0,027 / +0,115 | 62 % de 13 | 7 % |
| 64 | 1 798 | +0,263 | −0,010 | +0,235 | +0,071 | −0,075 à +0,543 | −0,134 à +0,592 | 1,28 | 1,24 | +0,296 / +0,154 | 62 % de 13 | 77 % |

### F4 · chocs bruts, régime agité (descriptif) · 2 575 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 575 | −0,014 | −0,147 | −0,013 | −0,140 | −0,048 à +0,023 | −0,056 à +0,030 | −0,59 | −0,57 | +0,041 / −0,057 | 54 % de 13 | 0 % |
| 4 | 2 575 | −0,060 | −0,140 | −0,053 | −0,138 | −0,123 à +0,016 | −0,136 à +0,027 | −1,28 | −1,29 | +0,067 / −0,153 | 46 % de 13 | 0 % |
| 16 | 2 575 | −0,096 | −0,203 | −0,080 | −0,201 | −0,186 à +0,024 | −0,206 à +0,047 | −1,25 | −1,17 | −0,008 / −0,140 | 23 % de 13 | 8 % |
| 64 | 2 574 | −0,361 | −0,348 | −0,295 | −0,263 | −0,445 à −0,141 | −0,474 à −0,115 | −3,14 | −2,81 | −0,301 / −0,289 | 23 % de 13 | 82 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : **non** · G2 événements au hasard p < 0,05 à 16 bougies : oui · G3 au moins 150 événements : oui → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | +0,060 · +0,001 · +0,062 · 0,057 | +0,155 · +0,008 · +0,129 · 0,026 | +0,521 · +0,037 · +0,283 · 0,001 | +1,028 · +0,143 · +0,669 · 0,003 |
| F2 | −0,001 · −0,001 · +0,023 · 0,502 | +0,081 · −0,002 · +0,047 · 0,005 | +0,122 · −0,004 · +0,098 · 0,021 | +0,100 · −0,005 · +0,200 · 0,194 |
| F3 | −0,026 · +0,001 · +0,032 · 0,930 | +0,065 · +0,003 · +0,065 · 0,052 | +0,065 · +0,009 · +0,140 · 0,236 | +0,235 · +0,043 · +0,309 · 0,112 |
| F4 | −0,013 · +0,001 · +0,024 · 0,815 | −0,053 · +0,001 · +0,048 · 0,970 | −0,080 · +0,004 · +0,106 · 0,917 | −0,295 · +0,027 · +0,234 · 0,994 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 471 | +0,095 (−0,018 à +0,211) | +0,130 (−0,083 à +0,343) | +0,428 (+0,027 à +0,842) | +0,890 (+0,272 à +1,552) |
| +2 | 471 | −0,007 (−0,105 à +0,085) | +0,061 (−0,130 à +0,249) | +0,272 (−0,117 à +0,647) | +0,746 (+0,180 à +1,331) |
| +4 | 471 | +0,029 (−0,058 à +0,108) | +0,147 (−0,037 à +0,326) | +0,225 (−0,088 à +0,551) | +0,720 (+0,256 à +1,204) |
| -1 | 471 | +3,564 (+3,426 à +3,721) | +3,727 (+3,464 à +3,979) | +4,138 (+3,644 à +4,620) | +4,674 (+3,976 à +5,454) |
| -2 | 471 | +0,570 (+0,495 à +0,649) | +4,403 (+4,131 à +4,662) | +4,819 (+4,295 à +5,335) | +5,345 (+4,611 à +6,141) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 263 | +0,122 (−0,133 à +0,373) | +0,511 (−0,106 à +1,114) |
| F1 shorts | 208 | +0,197 (−0,157 à +0,547) | +0,533 (−0,149 à +1,176) |
| F3 longs | 892 | +0,115 (−0,032 à +0,253) | +0,258 (−0,073 à +0,598) |
| F3 shorts | 906 | +0,015 (−0,132 à +0,162) | −0,126 (−0,413 à +0,145) |
| chocs bruts, régime calme (= F2) | 2 735 | +0,081 (+0,009 à +0,157) | +0,122 (−0,008 à +0,263) |
| chocs bruts, régime agité (= F4) | 2 575 | −0,053 (−0,121 à +0,017) | −0,080 (−0,184 à +0,021) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 29 | −0,220 (−0,939 à +0,493) | −0,009 (−1,157 à +1,104) |
| F3 · Asie (18 h – 2 h) | 203 | −0,065 (−0,305 à +0,192) | −0,153 (−0,684 à +0,378) |
| F1 · Londres (2 h – 8 h) | 61 | +0,058 (−0,385 à +0,486) | +0,738 (−0,203 à +1,692) |
| F3 · Londres (2 h – 8 h) | 300 | −0,096 (−0,329 à +0,139) | −0,053 (−0,486 à +0,398) |
| F1 · New York matin (8 h – 12 h) | 346 | +0,274 (+0,013 à +0,531) | +0,549 (+0,014 à +1,117) |
| F3 · New York matin (8 h – 12 h) | 1 113 | +0,147 (−0,002 à +0,295) | +0,119 (−0,127 à +0,381) |
| F1 · dont bougie de 8 h 30 (annonces) | 63 | +0,423 (−0,368 à +1,281) | +0,122 (−0,979 à +1,323) |
| F3 · dont bougie de 8 h 30 (annonces) | 202 | +0,293 (−0,111 à +0,683) | +0,154 (−0,420 à +0,719) |
| F1 · New York après-midi (12 h – 18 h) | 35 | −0,541 (−1,392 à +0,301) | +0,308 (−0,669 à +1,200) |
| F3 · New York après-midi (12 h – 18 h) | 182 | −0,031 (−0,325 à +0,245) | +0,165 (−0,263 à +0,653) |
| F1 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 325 | +0,207 (−0,054 à +0,468) | +0,480 (−0,035 à +1,008) |
| F3 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 1 102 | +0,124 (−0,019 à +0,270) | +0,111 (−0,139 à +0,369) |
| F1 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 146 | +0,038 (−0,381 à +0,450) | +0,613 (−0,125 à +1,367) |
| F3 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 696 | −0,030 (−0,198 à +0,124) | −0,009 (−0,282 à +0,269) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 202 | +0,293 (−0,111 à +0,683) | +0,154 (−0,420 à +0,719) |
| F3 · 10 h ET | 111 | +0,381 (−0,003 à +0,746) | +0,354 (−0,265 à +0,914) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 76 | +0,117 (−0,466 à +0,674) | +0,569 (−0,192 à +1,411) |
| F1 · hors créneaux d'annonces | 361 | +0,197 (−0,022 à +0,423) | +0,655 (+0,132 à +1,234) |
| F3 · hors créneaux d'annonces | 1 409 | +0,004 (−0,116 à +0,120) | +0,002 (−0,211 à +0,229) |
| F1, référence au quart d'heure UTC | 471 | +0,158 (−0,056 à +0,372) | +0,525 (+0,116 à +0,955) |
| F3, référence au quart d'heure UTC | 1 798 | +0,068 (−0,040 à +0,169) | +0,065 (−0,115 à +0,255) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,1771 · 1,0000 | 0,1174 · 1,0000 | 0,0261 · 0,3913 | 0,0055 · 0,0880 |
| F2 | 0,5102 · 1,0000 | 0,0374 · 0,5231 | 0,0668 · 0,8686 | 0,1814 · 1,0000 |
| F3 | 0,7884 · 1,0000 | 0,1535 · 1,0000 | 0,2897 · 1,0000 | 0,0995 · 1,0000 |
| F4 | 0,7227 · 1,0000 | 0,8990 · 1,0000 | 0,8937 · 1,0000 | 0,9991 · 1,0000 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 12 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = 1,71 ; tradé ; plateau ± 2 crans (C6) : oui (S à −2, −1, 0, +1, +2 crans : 1,65 · 1,72 · 1,60 · 1,81 · 1,71).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **7,0 %** (P(perte) 0 %, pente −0,89) ; dispersion des Sharpe journaliers des essais 0,0153.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2016 | 0,07 | non | +7 | 0 | +0,12 |
| 2017 | 0,21 | non | +7 | 0 | +0,14 |
| 2018 | 0,52 | non | +7 | 0 | +0,06 |
| 2019 | 1,11 | oui | +5 | 8 | +0,02 |
| 2020 | 1,14 | oui | +2 | 4 | +0,02 |
| 2021 | 1,56 | oui | +2 | 14 | +0,01 |
| 2022 | 1,66 | oui | 0 | 14 | +0,01 |

## Validation 2016-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | 2,8 % | 0,80 | 0,69 | 1,49 | 0,86 | −3,3 % | 2,18 | 67 | 6,2 % | 30 % | 1,88 % | −0,37 % | 5,13 | 3,27 | 83 % | 1,89 |
| B — seuil Q99 % | 5,9 % | 1,16 | 1,11 | 2,18 | 1,76 | −3,4 % | 2,37 | 123 | 14,5 % | 30 % | 1,95 % | −0,35 % | 5,51 | 2,84 | 75 % | 3,05 |

C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A oui (57 % des années positives) · B oui (100 %).

### Méthode A : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : 0,65 puis 0,99.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 0,0 % | 0 |
| 2017 | 0,0 % | 0 |
| 2018 | 0,0 % | 0 |
| 2019 | 3,7 % | 15 |
| 2020 | 10,4 % | 4 |
| 2021 | 5,0 % | 29 |
| 2022 | 1,3 % | 19 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 3,0 % | 0,85 | 2,30 | −3,2 % | 67 |
| bas (2,00 $ ; 0,5 pas) | 2,9 % | 0,82 | 2,24 | −3,3 % | 67 |
| référence (3,50 $ ; 1 pas) | 2,8 % | 0,80 | 2,18 | −3,3 % | 67 |
| haut (5,00 $ ; 2 pas) | 2,7 % | 0,76 | 2,09 | −3,4 % | 67 |
| stress (5,00 $ ; 4 pas) | 2,5 % | 0,70 | 1,94 | −3,5 % | 67 |

Sharpe selon le coût (× référence) : × 0 → 0,85 · × 0,5 → 0,83 · × 1 → 0,80 · × 2 → 0,76 · × 4 → 0,67 ; rentable sur toute la plage.

### Méthode B : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : 1,24 puis 1,08.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 17,2 % | 15 |
| 2017 | 2,4 % | 23 |
| 2018 | 1,0 % | 26 |
| 2019 | 3,6 % | 15 |
| 2020 | 10,9 % | 3 |
| 2021 | 4,5 % | 27 |
| 2022 | 3,0 % | 14 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 6,3 % | 1,23 | 2,53 | −3,3 % | 123 |
| bas (2,00 $ ; 0,5 pas) | 6,1 % | 1,19 | 2,45 | −3,3 % | 123 |
| référence (3,50 $ ; 1 pas) | 5,9 % | 1,16 | 2,37 | −3,4 % | 123 |
| haut (5,00 $ ; 2 pas) | 5,6 % | 1,10 | 2,25 | −3,5 % | 123 |
| stress (5,00 $ ; 4 pas) | 5,1 % | 1,00 | 2,06 | −3,9 % | 123 |

Sharpe selon le coût (× référence) : × 0 → 1,23 · × 0,5 → 1,19 · × 1 → 1,16 · × 2 → 1,09 · × 4 → 0,96 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2014-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 4,4 % | 0,88 | 0,82 | 1,71 | −6,9 % | 233 | 13,1 % |
| bas (2,00 $ ; 0,5 pas) | 4,1 % | 0,83 | 0,77 | 1,65 | −7,1 % | 233 | 13,1 % |
| référence (3,50 $ ; 1 pas) | 3,8 % | 0,78 | 0,72 | 1,60 | −7,3 % | 233 | 13,1 % |
| haut (5,00 $ ; 2 pas) | 3,4 % | 0,69 | 0,64 | 1,50 | −7,6 % | 233 | 13,1 % |
| stress (5,00 $ ; 4 pas) | 2,6 % | 0,53 | 0,50 | 1,36 | −8,1 % | 233 | 13,1 % |

## Contrôles

| contrôle | résultat |
| --- | ---: |
| empreinte lib/strategies/shock/market.ts | OK |
| empreinte lib/strategies/shock/strategy.ts | OK |
| empreinte lib/strategies/shock/broker.ts | OK |
| empreinte lib/strategies/shock/engine.ts | OK |
| empreinte lib/strategies/shock/params.ts | OK |
| empreinte lib/strategies/shock/presets.ts | OK |
| empreinte lib/strategies/shock/regimes.ts | OK |
| empreinte research/lib/frozen-shock.ts | OK |
| empreinte research/lib/e2.ts | OK |
| sélection calme / agité identique à V1 | OK |
| entrées identiques à calmOnly(E2(frozen-shock)) | OK |
| capital identique à celui de V1 (coûts du moteur) | OK |
| trades de la sleeve BTC publiée | OK |
| Sharpe de la sleeve BTC publiée | OK |
| coûts après coup ≈ coûts du moteur (capital final, Sharpe) | OK |

