# Transfert de Shock Engine V1 · or (substitut XAU/USD) · H4 (240 min) · étape de développement

**Suite exploratoire (additif n° 3)** : bougies de H4 (240 min) tirées des fichiers 15 min, réglages de V1 inchangés en nombre de bougies, horizons en bougies du timeframe ; décidée après les résultats à 15 min, test final déjà regardé à 15 min.

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `03261de2d660d3880c020399c62b6767191dd32942f5030314476be07b8af697`.

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

### F1 · entrées qualifiées de V1 (seuil figé) · 66 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 66 | +0,118 | +0,164 | +0,095 | +0,170 | −0,064 à +0,252 | −0,093 à +0,284 | 0,99 | 0,97 | +0,006 / +0,203 | 69 % de 13 | 0 % |
| 4 | 66 | +0,342 | +0,224 | +0,279 | +0,145 | +0,000 à +0,575 | −0,053 à +0,635 | 1,62 | 1,57 | +0,257 / +0,306 | 69 % de 13 | 26 % |
| 16 | 66 | +1,384 | +1,000 | +1,143 | +0,715 | +0,296 à +2,026 | +0,164 à +2,222 | 2,12 | 1,98 | +0,634 / +1,754 | 85 % de 13 | 71 % |
| 64 | 66 | +1,652 | +1,454 | +0,746 | +1,222 | −0,651 à +2,148 | −0,881 à +2,432 | 0,87 | 0,89 | −0,295 / +1,996 | 77 % de 13 | 100 % |

### F2 · chocs bruts, régime calme · 238 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 238 | +0,050 | +0,033 | +0,048 | +0,008 | −0,050 à +0,155 | −0,068 à +0,178 | 0,77 | 0,78 | −0,100 / +0,214 | 62 % de 13 | 0 % |
| 4 | 238 | +0,072 | +0,031 | +0,082 | +0,036 | −0,062 à +0,235 | −0,091 à +0,270 | 0,91 | 0,95 | +0,102 / +0,059 | 46 % de 13 | 22 % |
| 16 | 238 | +0,246 | +0,261 | +0,272 | +0,333 | −0,056 à +0,588 | −0,128 à +0,649 | 1,37 | 1,27 | +0,344 / +0,191 | 62 % de 13 | 71 % |
| 64 | 238 | +0,643 | +0,230 | +0,741 | +0,724 | +0,066 à +1,418 | −0,065 à +1,561 | 1,82 | 1,78 | +0,594 / +0,907 | 62 % de 13 | 100 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 190 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 190 | +0,059 | +0,057 | +0,050 | +0,056 | −0,056 à +0,158 | −0,078 à +0,182 | 0,77 | 0,77 | −0,050 / +0,167 | 54 % de 13 | 0 % |
| 4 | 190 | +0,154 | +0,082 | +0,141 | +0,052 | −0,021 à +0,301 | −0,053 à +0,333 | 1,43 | 1,45 | +0,191 / +0,083 | 54 % de 13 | 23 % |
| 16 | 190 | +0,423 | +0,432 | +0,356 | +0,498 | −0,075 à +0,778 | −0,172 à +0,861 | 1,36 | 1,29 | +0,446 / +0,249 | 54 % de 13 | 71 % |
| 64 | 190 | +0,762 | +0,223 | +0,496 | +0,591 | −0,202 à +1,196 | −0,361 à +1,362 | 1,14 | 1,07 | +0,296 / +0,734 | 62 % de 13 | 100 % |

### F4 · chocs bruts, régime agité (descriptif) · 166 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 166 | +0,053 | +0,007 | +0,062 | +0,041 | −0,041 à +0,170 | −0,061 à +0,190 | 0,96 | 0,96 | −0,124 / +0,205 | 62 % de 13 | 0 % |
| 4 | 166 | −0,046 | −0,114 | −0,021 | −0,099 | −0,176 à +0,149 | −0,207 à +0,182 | −0,21 | −0,21 | −0,203 / +0,118 | 38 % de 13 | 20 % |
| 16 | 166 | −0,073 | −0,125 | −0,011 | +0,122 | −0,327 à +0,303 | −0,382 à +0,363 | −0,05 | −0,06 | −0,281 / +0,196 | 62 % de 13 | 66 % |
| 64 | 165 | −0,442 | −0,371 | −0,208 | +0,070 | −0,805 à +0,375 | −0,922 à +0,489 | −0,57 | −0,60 | −0,690 / +0,166 | 46 % de 13 | 100 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : oui · G2 événements au hasard p < 0,05 à 16 bougies : oui · G3 au moins 150 événements : **non** → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | +0,095 · +0,006 · +0,153 · 0,153 | +0,279 · +0,031 · +0,339 · 0,090 | +1,143 · +0,103 · +0,757 · 0,003 | +0,746 · +0,238 · +1,662 · 0,287 |
| F2 | +0,048 · +0,003 · +0,081 · 0,174 | +0,082 · +0,004 · +0,167 · 0,205 | +0,272 · +0,003 · +0,328 · 0,092 | +0,741 · −0,042 · +0,723 · 0,048 |
| F3 | +0,050 · +0,003 · +0,090 · 0,197 | +0,141 · +0,020 · +0,201 · 0,124 | +0,356 · +0,032 · +0,414 · 0,078 | +0,496 · +0,050 · +0,861 · 0,193 |
| F4 | +0,062 · +0,003 · +0,094 · 0,135 | −0,021 · +0,006 · +0,183 · 0,620 | −0,011 · +0,039 · +0,376 · 0,601 | −0,208 · +0,076 · +0,707 · 0,785 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 66 | +0,067 (−0,044 à +0,207) | +0,291 (+0,031 à +0,549) | +1,028 (+0,188 à +1,880) | +0,596 (−0,838 à +1,984) |
| +2 | 66 | +0,021 (−0,136 à +0,218) | +0,358 (+0,048 à +0,686) | +1,211 (+0,332 à +2,101) | +0,565 (−0,846 à +2,002) |
| +4 | 66 | +0,123 (−0,015 à +0,272) | +0,488 (+0,162 à +0,827) | +1,122 (+0,205 à +2,063) | +0,144 (−1,169 à +1,472) |
| -1 | 66 | +3,040 (+2,833 à +3,268) | +3,231 (+2,922 à +3,618) | +4,225 (+3,384 à +5,106) | +3,805 (+2,269 à +5,334) |
| -2 | 66 | +0,180 (+0,032 à +0,340) | +3,392 (+3,042 à +3,793) | +4,358 (+3,582 à +5,189) | +3,948 (+2,454 à +5,447) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 38 | +0,004 (−0,415 à +0,390) | +0,793 (−0,291 à +1,927) |
| F1 shorts | 28 | +0,652 (+0,265 à +1,056) | +1,618 (+0,242 à +2,963) |
| F3 longs | 96 | +0,006 (−0,232 à +0,230) | +0,247 (−0,358 à +0,856) |
| F3 shorts | 94 | +0,280 (+0,056 à +0,511) | +0,467 (−0,146 à +1,086) |
| chocs bruts, régime calme (= F2) | 238 | +0,082 (−0,069 à +0,228) | +0,272 (−0,055 à +0,585) |
| chocs bruts, régime agité (= F4) | 166 | −0,021 (−0,176 à +0,146) | −0,011 (−0,331 à +0,295) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 1 | −6,274 (−6,274 à −6,274) | −13,105 (−13,105 à −13,105) |
| F3 · Asie (18 h – 2 h) | 9 | −0,949 (−2,530 à +0,429) | −1,282 (−4,467 à +1,589) |
| F1 · Londres (2 h – 8 h) | 12 | +0,408 (+0,036 à +0,810) | +1,610 (−0,313 à +3,679) |
| F3 · Londres (2 h – 8 h) | 58 | +0,238 (−0,047 à +0,538) | +0,292 (−0,328 à +0,925) |
| F1 · New York matin (8 h – 12 h) | 49 | +0,310 (+0,031 à +0,604) | +1,249 (+0,342 à +2,161) |
| F3 · New York matin (8 h – 12 h) | 106 | +0,088 (−0,091 à +0,277) | +0,337 (−0,280 à +0,931) |
| F1 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F1 · New York après-midi (12 h – 18 h) | 4 | +1,154 (−0,526 à +2,834) | +2,012 (−0,541 à +4,565) |
| F3 · New York après-midi (12 h – 18 h) | 17 | +0,723 (−0,040 à +1,475) | +1,560 (+0,103 à +2,915) |
| F1 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 6 | +1,265 (−0,134 à +2,696) | +1,420 (−0,447 à +3,750) |
| F3 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 25 | +0,928 (+0,455 à +1,452) | +1,403 (+0,372 à +2,357) |
| F1 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 60 | +0,180 (−0,080 à +0,452) | +1,115 (+0,168 à +2,046) |
| F3 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 165 | +0,022 (−0,144 à +0,187) | +0,197 (−0,267 à +0,681) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 144 | +0,109 (−0,028 à +0,253) | +0,436 (−0,001 à +0,899) |
| F3 · 10 h ET | 144 | +0,109 (−0,028 à +0,253) | +0,436 (−0,001 à +0,899) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 25 | +0,928 (+0,455 à +1,452) | +1,403 (+0,372 à +2,357) |
| F1 · hors créneaux d'annonces | 2 | −3,655 (−6,274 à −1,035) | −5,365 (−13,105 à +2,374) |
| F3 · hors créneaux d'annonces | 21 | −0,576 (−1,532 à +0,293) | −1,441 (−3,109 à +0,067) |
| F1, référence au quart d'heure UTC | 66 | +0,305 (+0,019 à +0,578) | +1,246 (+0,386 à +2,150) |
| F3, référence au quart d'heure UTC | 190 | +0,142 (−0,018 à +0,295) | +0,383 (−0,045 à +0,797) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,1617 · 1,0000 | 0,0528 · 0,7391 | 0,0172 · 0,2754 | 0,1927 · 1,0000 |
| F2 | 0,2213 · 1,0000 | 0,1827 · 1,0000 | 0,0850 · 1,0000 | 0,0342 · 0,5131 |
| F3 | 0,2207 · 1,0000 | 0,0759 · 0,9868 | 0,0875 · 1,0000 | 0,1281 · 1,0000 |
| F4 | 0,1681 · 1,0000 | 0,5837 · 1,0000 | 0,5213 · 1,0000 | 0,7150 · 1,0000 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 1 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = 0,78 ; **non tradé (P < 1)** ; plateau ± 2 crans (C6) : **non** (S à −2, −1, 0, +1, +2 crans : hors grille · 1,06 · 0,51 · 0,76 · 0,70).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **59,1 %** (P(perte) 27 %, pente −0,94) ; dispersion des Sharpe journaliers des essais 0,0100.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2016 | — | non | — | 0 | −0,04 |
| 2017 | — | non | — | 0 | +0,00 |
| 2018 | — | non | — | 0 | −0,20 |
| 2019 | — | non | — | 0 | −0,21 |
| 2020 | 0,24 | non | 0 | 0 | −0,21 |
| 2021 | 0,79 | non | +1 | 0 | −0,17 |
| 2022 | 0,76 | non | 0 | 1 | −0,07 |

## Validation 2016-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 | 0,0 % | — | — | — | — | — | — | — |
| B — seuil Q99 % | 0,2 % | 0,06 | 0,06 | 0,08 | 0,02 | −9,9 % | 1,11 | 19 | 21,3 % | 37 % | 2,43 % | −1,28 % | 1,90 | 1,40 | 482 % | 0,16 |

C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A **non** (0 % des années positives) · B **non** (57 %).

### Méthode A : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : — puis —.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 0,0 % | 0 |
| 2017 | 0,0 % | 0 |
| 2018 | 0,0 % | 0 |
| 2019 | 0,0 % | 0 |
| 2020 | 0,0 % | 0 |
| 2021 | 0,0 % | 0 |
| 2022 | 0,0 % | 0 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,0 % | — | — | 0,0 % | 0 |
| bas (2,00 $ ; 0,5 pas) | 0,0 % | — | — | 0,0 % | 0 |
| référence (3,50 $ ; 1 pas) | 0,0 % | — | — | 0,0 % | 0 |
| haut (5,00 $ ; 2 pas) | 0,0 % | — | — | 0,0 % | 0 |
| stress (5,00 $ ; 4 pas) | 0,0 % | — | — | 0,0 % | 0 |

Sharpe selon le coût (× référence) : × 0 → — · × 0,5 → — · × 1 → — · × 2 → — · × 4 → — ; pas rentable même sans coûts.

### Méthode B : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : −0,09 puis 0,26.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 3,2 % | 3 |
| 2017 | −7,5 % | 3 |
| 2018 | 3,4 % | 4 |
| 2019 | −2,2 % | 2 |
| 2020 | −1,8 % | 1 |
| 2021 | 3,9 % | 3 |
| 2022 | 2,8 % | 3 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,2 % | 0,07 | 1,13 | −9,8 % | 19 |
| bas (2,00 $ ; 0,5 pas) | 0,2 % | 0,06 | 1,12 | −9,9 % | 19 |
| référence (3,50 $ ; 1 pas) | 0,2 % | 0,06 | 1,11 | −9,9 % | 19 |
| haut (5,00 $ ; 2 pas) | 0,1 % | 0,05 | 1,09 | −10,0 % | 19 |
| stress (5,00 $ ; 4 pas) | 0,0 % | 0,04 | 1,05 | −10,3 % | 19 |

Sharpe selon le coût (× référence) : × 0 → 0,07 · × 0,5 → 0,06 · × 1 → 0,06 · × 2 → 0,05 · × 4 → 0,03 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2014-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,8 % | 0,17 | 0,16 | 1,29 | −16,0 % | 37 | 20,0 % |
| bas (2,00 $ ; 0,5 pas) | 0,8 % | 0,16 | 0,15 | 1,27 | −16,1 % | 37 | 20,0 % |
| référence (3,50 $ ; 1 pas) | 0,7 % | 0,15 | 0,14 | 1,26 | −16,2 % | 37 | 20,0 % |
| haut (5,00 $ ; 2 pas) | 0,7 % | 0,14 | 0,13 | 1,23 | −16,5 % | 37 | 20,0 % |
| stress (5,00 $ ; 4 pas) | 0,5 % | 0,12 | 0,11 | 1,19 | −16,9 % | 37 | 20,0 % |

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

