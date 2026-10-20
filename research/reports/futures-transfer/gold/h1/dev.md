# Transfert de Shock Engine V1 · or (substitut XAU/USD) · H1 (60 min) · étape de développement

**Suite exploratoire (additif n° 3)** : bougies de H1 (60 min) tirées des fichiers 15 min, réglages de V1 inchangés en nombre de bougies, horizons en bougies du timeframe ; décidée après les résultats à 15 min, test final déjà regardé à 15 min.

**Substitut, pas des futures** : Or comptant XAU/USD (Dukascopy, prix acheteur) — substitut de GC. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `979b4d7701b0932a6577974385bd5295132bb16143ab771540afbebcbcce4f9f`.

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

### F1 · entrées qualifiées de V1 (seuil figé) · 193 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 193 | +0,200 | +0,084 | +0,194 | +0,071 | +0,050 à +0,343 | +0,025 à +0,373 | 2,15 | 2,07 | +0,235 / +0,141 | 62 % de 13 | 0 % |
| 4 | 193 | +0,277 | +0,221 | +0,259 | +0,191 | −0,006 à +0,506 | −0,046 à +0,555 | 1,66 | 1,57 | +0,437 / +0,024 | 69 % de 13 | 8 % |
| 16 | 193 | +0,702 | +0,486 | +0,627 | +0,380 | +0,174 à +1,089 | +0,091 à +1,181 | 2,26 | 2,25 | +0,895 / +0,272 | 85 % de 13 | 86 % |
| 64 | 193 | +1,666 | +1,800 | +1,421 | +1,608 | +0,398 à +2,442 | +0,227 à +2,648 | 2,31 | 2,08 | +1,990 / +0,667 | 77 % de 13 | 97 % |

### F2 · chocs bruts, régime calme · 793 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 793 | +0,054 | −0,046 | +0,058 | −0,052 | −0,009 à +0,129 | −0,021 à +0,140 | 1,39 | 1,32 | +0,066 / +0,048 | 69 % de 13 | 0 % |
| 4 | 793 | +0,095 | +0,014 | +0,100 | +0,039 | −0,011 à +0,217 | −0,032 à +0,239 | 1,44 | 1,42 | +0,132 / +0,063 | 69 % de 13 | 10 % |
| 16 | 793 | +0,259 | +0,096 | +0,274 | +0,126 | +0,100 à +0,455 | +0,069 à +0,488 | 2,55 | 2,60 | +0,389 / +0,136 | 92 % de 13 | 84 % |
| 64 | 792 | +0,498 | +0,441 | +0,550 | +0,408 | +0,151 à +0,972 | +0,084 à +1,049 | 2,30 | 2,24 | +0,649 / +0,431 | 85 % de 13 | 96 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 621 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 621 | +0,048 | −0,047 | +0,051 | −0,063 | −0,021 à +0,124 | −0,035 à +0,138 | 1,14 | 1,05 | +0,065 / +0,033 | 62 % de 13 | 0 % |
| 4 | 621 | +0,047 | −0,024 | +0,049 | −0,019 | −0,078 à +0,171 | −0,102 à +0,199 | 0,64 | 0,62 | +0,151 / −0,077 | 62 % de 13 | 10 % |
| 16 | 621 | +0,277 | +0,149 | +0,279 | +0,157 | +0,067 à +0,497 | +0,032 à +0,545 | 2,18 | 2,22 | +0,504 / −0,000 | 85 % de 13 | 83 % |
| 64 | 620 | +0,522 | +0,593 | +0,513 | +0,609 | +0,054 à +0,994 | −0,041 à +1,069 | 1,80 | 1,73 | +0,842 / +0,104 | 62 % de 13 | 96 % |

### F4 · chocs bruts, régime agité (descriptif) · 624 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 624 | +0,004 | −0,048 | +0,006 | −0,059 | −0,072 à +0,084 | −0,086 à +0,099 | 0,13 | 0,13 | +0,092 / −0,064 | 54 % de 13 | 0 % |
| 4 | 624 | +0,049 | −0,060 | +0,057 | −0,054 | −0,078 à +0,197 | −0,105 à +0,226 | 0,68 | 0,67 | +0,185 / −0,048 | 46 % de 13 | 9 % |
| 16 | 624 | −0,069 | −0,186 | −0,028 | −0,122 | −0,187 à +0,129 | −0,215 à +0,159 | −0,29 | −0,27 | +0,093 / −0,128 | 46 % de 13 | 86 % |
| 64 | 624 | −0,157 | −0,352 | −0,024 | +0,038 | −0,365 à +0,315 | −0,425 à +0,384 | −0,12 | −0,11 | +0,246 / −0,245 | 46 % de 13 | 97 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : **non** · G2 événements au hasard p < 0,05 à 16 bougies : oui · G3 au moins 150 événements : oui → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | +0,194 · +0,003 · +0,091 · 0,001 | +0,259 · +0,017 · +0,203 · 0,013 | +0,627 · +0,052 · +0,431 · 0,008 | +1,421 · +0,145 · +0,996 · 0,005 |
| F2 | +0,058 · +0,000 · +0,044 · 0,016 | +0,100 · −0,002 · +0,089 · 0,033 | +0,274 · −0,004 · +0,168 · 0,007 | +0,550 · −0,036 · +0,351 · 0,006 |
| F3 | +0,051 · +0,001 · +0,051 · 0,052 | +0,049 · +0,003 · +0,103 · 0,216 | +0,279 · +0,014 · +0,217 · 0,017 | +0,513 · +0,024 · +0,446 · 0,031 |
| F4 | +0,006 · +0,003 · +0,050 · 0,444 | +0,057 · +0,006 · +0,105 · 0,191 | −0,028 · +0,019 · +0,209 · 0,662 | −0,024 · +0,081 · +0,432 · 0,698 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 193 | +0,053 (−0,051 à +0,160) | −0,016 (−0,211 à +0,190) | +0,360 (−0,011 à +0,745) | +1,235 (+0,262 à +2,219) |
| +2 | 193 | +0,026 (−0,063 à +0,116) | +0,043 (−0,147 à +0,227) | +0,290 (−0,064 à +0,650) | +1,259 (+0,364 à +2,188) |
| +4 | 193 | −0,073 (−0,149 à +0,003) | +0,127 (−0,071 à +0,346) | +0,378 (−0,002 à +0,765) | +1,285 (+0,372 à +2,238) |
| -1 | 193 | +3,458 (+3,286 à +3,632) | +3,765 (+3,492 à +4,047) | +4,149 (+3,626 à +4,725) | +5,064 (+3,923 à +6,201) |
| -2 | 193 | +0,702 (+0,534 à +0,876) | +4,557 (+4,231 à +4,905) | +4,926 (+4,347 à +5,592) | +5,887 (+4,713 à +7,064) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 119 | +0,072 (−0,275 à +0,411) | +0,117 (−0,354 à +0,563) |
| F1 shorts | 74 | +0,561 (+0,119 à +1,030) | +1,448 (+0,597 à +2,284) |
| F3 longs | 306 | +0,073 (−0,118 à +0,263) | +0,321 (+0,012 à +0,624) |
| F3 shorts | 315 | +0,026 (−0,182 à +0,212) | +0,238 (−0,091 à +0,577) |
| chocs bruts, régime calme (= F2) | 793 | +0,100 (−0,014 à +0,216) | +0,274 (+0,105 à +0,443) |
| chocs bruts, régime agité (= F4) | 624 | +0,057 (−0,087 à +0,193) | −0,028 (−0,184 à +0,126) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 7 | +0,179 (−0,985 à +1,580) | −0,742 (−3,693 à +2,094) |
| F3 · Asie (18 h – 2 h) | 40 | −0,001 (−0,330 à +0,346) | +0,084 (−1,041 à +1,186) |
| F1 · Londres (2 h – 8 h) | 10 | −0,441 (−1,772 à +0,976) | +1,110 (−1,438 à +3,311) |
| F3 · Londres (2 h – 8 h) | 65 | −0,400 (−0,877 à +0,051) | −0,199 (−1,021 à +0,645) |
| F1 · New York matin (8 h – 12 h) | 156 | +0,319 (+0,026 à +0,612) | +0,603 (+0,138 à +1,066) |
| F3 · New York matin (8 h – 12 h) | 431 | +0,139 (−0,025 à +0,309) | +0,233 (+0,003 à +0,461) |
| F1 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F1 · New York après-midi (12 h – 18 h) | 20 | +0,171 (−0,316 à +0,633) | +1,054 (+0,044 à +2,184) |
| F3 · New York après-midi (12 h – 18 h) | 85 | −0,036 (−0,273 à +0,197) | +0,970 (+0,424 à +1,520) |
| F1 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 111 | +0,184 (−0,073 à +0,431) | +0,221 (−0,183 à +0,653) |
| F3 · séance de jour COMEX 8 h 20 – 13 h 30 ET | 303 | −0,029 (−0,178 à +0,128) | +0,035 (−0,179 à +0,251) |
| F1 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 82 | +0,362 (−0,049 à +0,786) | +1,177 (+0,442 à +1,869) |
| F3 · hors séance de jour COMEX 8 h 20 – 13 h 30 ET | 318 | +0,124 (−0,059 à +0,306) | +0,511 (+0,179 à +0,848) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 156 | +0,411 (+0,120 à +0,714) | +0,619 (+0,265 à +1,009) |
| F3 · 10 h ET | 105 | +0,180 (−0,014 à +0,369) | +0,364 (+0,059 à +0,653) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 45 | +0,274 (−0,102 à +0,682) | +1,465 (+0,703 à +2,207) |
| F1 · hors créneaux d'annonces | 91 | +0,049 (−0,296 à +0,389) | +0,042 (−0,619 à +0,674) |
| F3 · hors créneaux d'annonces | 315 | −0,206 (−0,375 à −0,038) | −0,087 (−0,379 à +0,212) |
| F1, référence au quart d'heure UTC | 193 | +0,259 (+0,006 à +0,520) | +0,628 (+0,179 à +1,104) |
| F3, référence au quart d'heure UTC | 621 | +0,047 (−0,083 à +0,174) | +0,278 (+0,073 à +0,475) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,0157 · 0,1757 | 0,0483 · 0,4348 | 0,0119 · 0,1555 | 0,0104 · 0,1555 |
| F2 | 0,0824 · 0,5945 | 0,0743 · 0,5945 | 0,0053 · 0,0854 | 0,0108 · 0,1555 |
| F3 | 0,1267 · 0,7602 | 0,2605 · 1,0000 | 0,0146 · 0,1757 | 0,0361 · 0,3611 |
| F4 | 0,4497 · 1,0000 | 0,2471 · 1,0000 | 0,6160 · 1,0000 | 0,5460 · 1,0000 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 1 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = 0,96 ; **non tradé (P < 1)** ; plateau ± 2 crans (C6) : **non** (S à −2, −1, 0, +1, +2 crans : 0,32 · 1,07 · 0,96 · 0,86 · 0,76).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **81,1 %** (P(perte) 9 %, pente −1,04) ; dispersion des Sharpe journaliers des essais 0,0045.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2016 | 0,82 | non | −20 | 0 | +0,03 |
| 2017 | 1,17 | oui | −20 | 5 | +0,09 |
| 2018 | 1,05 | oui | −8 | 2 | −0,03 |
| 2019 | 0,68 | non | −19 | 0 | −0,03 |
| 2020 | 0,83 | non | −17 | 0 | −0,03 |
| 2021 | 1,38 | oui | −8 | 8 | −0,03 |
| 2022 | 1,36 | oui | −9 | 4 | −0,00 |

## Validation 2016-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | −0,3 % | −0,07 | −0,11 | −0,10 | −0,03 | −9,1 % | 0,92 | 55 | 10,8 % | 33 % | 1,12 % | −0,60 % | 1,88 | 2,38 | −381 % | −0,23 |
| B — seuil Q99 % | 3,3 % | 0,65 | 0,65 | 1,02 | 0,41 | −8,1 % | 2,07 | 51 | 17,4 % | 35 % | 2,58 % | −0,68 % | 3,79 | 2,20 | 81 % | 1,72 |

C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A **non** (29 % des années positives) · B oui (100 %).

### Méthode A : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : 0,02 puis −0,15.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 0,0 % | 0 |
| 2017 | −0,5 % | 21 |
| 2018 | 0,6 % | 11 |
| 2019 | 0,0 % | 0 |
| 2020 | 0,0 % | 0 |
| 2021 | 1,5 % | 12 |
| 2022 | −3,6 % | 11 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | −0,2 % | −0,03 | 0,96 | −8,9 % | 55 |
| bas (2,00 $ ; 0,5 pas) | −0,2 % | −0,05 | 0,94 | −9,0 % | 55 |
| référence (3,50 $ ; 1 pas) | −0,3 % | −0,07 | 0,92 | −9,1 % | 55 |
| haut (5,00 $ ; 2 pas) | −0,4 % | −0,10 | 0,88 | −9,3 % | 55 |
| stress (5,00 $ ; 4 pas) | −0,6 % | −0,16 | 0,82 | −9,5 % | 55 |

Sharpe selon le coût (× référence) : × 0 → −0,03 · × 0,5 → −0,05 · × 1 → −0,07 · × 2 → −0,11 · × 4 → −0,19 ; pas rentable même sans coûts.

### Méthode B : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : 0,65 puis 0,65.

| année | rendement | trades |
| --- | ---: | ---: |
| 2016 | 4,3 % | 7 |
| 2017 | 1,7 % | 10 |
| 2018 | 0,0 % | 9 |
| 2019 | 7,8 % | 9 |
| 2020 | 7,2 % | 1 |
| 2021 | 1,2 % | 9 |
| 2022 | 1,2 % | 6 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 3,5 % | 0,67 | 2,15 | −8,0 % | 51 |
| bas (2,00 $ ; 0,5 pas) | 3,4 % | 0,66 | 2,11 | −8,0 % | 51 |
| référence (3,50 $ ; 1 pas) | 3,3 % | 0,65 | 2,07 | −8,1 % | 51 |
| haut (5,00 $ ; 2 pas) | 3,2 % | 0,62 | 2,01 | −8,1 % | 51 |
| stress (5,00 $ ; 4 pas) | 3,0 % | 0,58 | 1,90 | −8,3 % | 51 |

Sharpe selon le coût (× référence) : × 0 → 0,67 · × 0,5 → 0,66 · × 1 → 0,65 · × 2 → 0,62 · × 4 → 0,56 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2014-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 3,0 % | 0,56 | 0,63 | 1,73 | −8,1 % | 101 | 20,3 % |
| bas (2,00 $ ; 0,5 pas) | 2,9 % | 0,54 | 0,60 | 1,69 | −8,2 % | 101 | 20,3 % |
| référence (3,50 $ ; 1 pas) | 2,8 % | 0,52 | 0,58 | 1,65 | −8,3 % | 101 | 20,3 % |
| haut (5,00 $ ; 2 pas) | 2,6 % | 0,48 | 0,54 | 1,59 | −8,4 % | 101 | 20,3 % |
| stress (5,00 $ ; 4 pas) | 2,2 % | 0,42 | 0,47 | 1,49 | −8,6 % | 101 | 20,3 % |

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

