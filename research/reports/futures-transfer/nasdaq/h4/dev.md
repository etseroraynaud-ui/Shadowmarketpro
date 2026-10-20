# Transfert de Shock Engine V1 · Nasdaq (substitut CFD USATECH) · H4 (240 min) · étape de développement

**Suite exploratoire (additif n° 3)** : bougies de H4 (240 min) tirées des fichiers 15 min, réglages de V1 inchangés en nombre de bougies, horizons en bougies du timeframe ; décidée après les résultats à 15 min, test final déjà regardé à 15 min.

**Substitut, pas des futures** : CFD Nasdaq-100 USATECH.IDX/USD (Dukascopy, prix acheteur) — substitut de NQ. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `25419590147f417374cbc0ecbedabea1bc136e1c7e0e91bb24c0729e31d33539`.

## Données

- Fichier `research/data/usatechidxusd_15m.csv.gz` (SHA-256 `b48525ae3e848803…`). Couverture continue à partir du 2013-07-04 22:00 UTC ; évaluation du 2015-01-01 au 2026-09-30 ; développement jusqu'au 2022-12-31 ; plis de validation 2017 – 2022.
- 243 505 bougies de 15 min ; 3 163 suivent une fermeture (pas d'entrée) ; 47 sans volume ; pas de prix 0,001.
- Plus forts rendements 15 min (écarts types) : 2025-04-02 22:00 −37,2 (après fermeture) · 2020-03-22 22:00 −34,7 (après fermeture) · 2025-04-06 22:00 −33,4 (après fermeture) · 2020-03-16 19:45 −32,0 · 2016-06-24 06:00 −31,0 (après fermeture) · 2020-03-15 22:00 −30,9 (après fermeture) · 2025-04-09 17:15 +30,6 · 2020-03-16 13:45 −29,4 (après fermeture).

| contrôle bloquant | résultat | détail |
| --- | ---: | ---: |
| horodatages strictement croissants | OK | 0 |
| bas ≤ ouverture, clôture ≤ haut | OK | 0 |
| prix > 0 | OK | 0 |
| bougies manquantes < 2 % par an (heures prévues, fériés exclus) | **ÉCHEC** | 2015 28.27 % · 2016 38.43 % · 2017 38.89 % · 2018 13.86 % · 2019 3.80 % · 2020 4.45 % · 2021 3.77 % · 2022 3.71 % · 2023 3.84 % · 2024 3.90 % · 2025 4.12 % · 2026 3.72 % |
| au plus 25 trous imprévus de plus de 60 min par an | **ÉCHEC** | 2015 187 · 2016 255 · 2017 254 · 2018 78 · 2019 11 · 2020 19 · 2021 9 · 2022 8 · 2023 8 · 2024 14 · 2025 13 · 2026 6 |
| au plus 20 mauvais ticks (> 8 ATR de la clôture précédente et de la clôture) | OK | 2 |

| année | quarts d'heure prévus | manquants | séances fériées | trous imprévus > 60 min |
| --- | ---: | ---: | ---: | ---: |
| 2015 | 23 732 | 28,27 % | 2 | 187 |
| 2016 | 23 736 | 38,43 % | 3 | 255 |
| 2017 | 23 644 | 38,89 % | 3 | 254 |
| 2018 | 23 736 | 13,86 % | 3 | 78 |
| 2019 | 23 736 | 3,80 % | 3 | 11 |
| 2020 | 23 828 | 4,45 % | 3 | 19 |
| 2021 | 23 828 | 3,77 % | 2 | 9 |
| 2022 | 23 736 | 3,71 % | 2 | 8 |
| 2023 | 23 644 | 3,84 % | 3 | 8 |
| 2024 | 23 828 | 3,90 % | 3 | 14 |
| 2025 | 23 736 | 4,12 % | 3 | 13 |
| 2026 | 17 764 | 3,72 % | 2 | 6 |

## Étape 1 — étude d'événement au seuil figé de V1 (avant toute calibration)

Rendement dans le sens de l'événement en ATR (jeu calme) ; excès = moins le mouvement moyen d'une bougie quelconque de la même année au même quart d'heure de New York. Intervalles par bootstrap des mois (5 000 tirages) ; t par grappes de mois et t de Newey–West sur les sommes journalières. Horizons en bougies de cotation.

### F1 · entrées qualifiées de V1 (seuil figé) · 13 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 13 | +0,391 | +0,323 | +0,352 | +0,378 | +0,169 à +0,521 | +0,134 à +0,559 | 3,16 | 2,15 | +0,819 / +0,267 | 80 % de 5 | 0 % |
| 4 | 13 | +0,793 | +0,906 | +0,716 | +0,817 | +0,409 à +1,048 | +0,367 à +1,116 | 3,53 | 2,53 | +1,076 / +0,650 | 100 % de 5 | 23 % |
| 16 | 13 | +0,883 | +0,933 | +0,377 | +0,406 | −0,464 à +1,262 | −0,630 à +1,443 | 0,70 | 0,72 | −1,810 / +0,775 | 60 % de 5 | 69 % |
| 64 | 13 | +2,725 | +3,628 | +0,546 | +1,387 | −0,785 à +1,974 | −1,023 à +2,181 | 0,62 | 0,64 | +1,117 / +0,442 | 80 % de 5 | 100 % |

### F2 · chocs bruts, régime calme · 202 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 202 | +0,179 | +0,140 | +0,184 | +0,100 | +0,045 à +0,324 | +0,021 à +0,353 | 2,20 | 2,25 | +0,209 / +0,162 | 67 % de 12 | 0 % |
| 4 | 202 | +0,071 | +0,064 | +0,101 | +0,146 | −0,073 à +0,275 | −0,107 à +0,309 | 0,95 | 0,97 | +0,118 / +0,086 | 50 % de 12 | 32 % |
| 16 | 202 | −0,017 | +0,126 | +0,080 | +0,016 | −0,276 à +0,432 | −0,342 à +0,494 | 0,37 | 0,39 | +0,114 / +0,049 | 42 % de 12 | 72 % |
| 64 | 201 | −0,303 | −0,577 | +0,113 | +0,226 | −0,614 à +0,858 | −0,742 à +0,993 | 0,25 | 0,26 | −0,807 / +0,937 | 50 % de 12 | 100 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 140 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 140 | +0,190 | +0,112 | +0,198 | +0,065 | +0,021 à +0,371 | −0,013 à +0,401 | 1,85 | 1,93 | +0,210 / +0,188 | 67 % de 12 | 0 % |
| 4 | 140 | +0,036 | −0,000 | +0,065 | +0,138 | −0,156 à +0,286 | −0,196 à +0,325 | 0,49 | 0,53 | +0,106 / +0,029 | 58 % de 12 | 31 % |
| 16 | 140 | −0,363 | +0,051 | −0,267 | −0,043 | −0,687 à +0,138 | −0,762 à +0,225 | −1,05 | −1,10 | −0,305 / −0,233 | 33 % de 12 | 74 % |
| 64 | 139 | −1,234 | −0,896 | −0,779 | −0,593 | −1,676 à +0,138 | −1,850 à +0,327 | −1,39 | −1,48 | −1,989 / +0,316 | 33 % de 12 | 100 % |

### F4 · chocs bruts, régime agité (descriptif) · 188 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 188 | −0,006 | −0,010 | −0,001 | −0,013 | −0,126 à +0,130 | −0,150 à +0,155 | −0,01 | −0,01 | −0,107 / +0,133 | 42 % de 12 | 4 % |
| 4 | 188 | −0,014 | +0,060 | +0,007 | +0,036 | −0,166 à +0,185 | −0,201 à +0,220 | 0,06 | 0,06 | −0,086 / +0,124 | 42 % de 12 | 36 % |
| 16 | 188 | +0,048 | +0,432 | +0,082 | +0,290 | −0,227 à +0,392 | −0,277 à +0,449 | 0,43 | 0,40 | +0,035 / +0,142 | 50 % de 12 | 73 % |
| 64 | 188 | −0,345 | −0,702 | −0,228 | −0,660 | −0,736 à +0,307 | −0,828 à +0,431 | −0,72 | −0,64 | −0,489 / +0,102 | 42 % de 12 | 100 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : **non** · G2 événements au hasard p < 0,05 à 16 bougies : **non** · G3 au moins 150 événements : **non** → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | +0,352 · +0,011 · +0,378 · 0,061 | +0,716 · +0,010 · +0,701 · 0,043 | +0,377 · +0,024 · +1,396 · 0,339 | +0,546 · +0,019 · +2,572 · 0,365 |
| F2 | +0,184 · +0,003 · +0,098 · 0,002 | +0,101 · +0,008 · +0,203 · 0,217 | +0,080 · +0,017 · +0,401 · 0,393 | +0,113 · −0,033 · +0,655 · 0,367 |
| F3 | +0,198 · +0,002 · +0,115 · 0,003 | +0,065 · +0,011 · +0,242 · 0,354 | −0,267 · +0,031 · +0,453 · 0,859 | −0,779 · +0,011 · +0,801 · 0,953 |
| F4 | −0,001 · +0,002 · +0,097 · 0,526 | +0,007 · +0,007 · +0,201 · 0,504 | +0,082 · +0,044 · +0,423 · 0,434 | −0,228 · +0,081 · +0,791 · 0,780 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 13 | +0,125 (−0,059 à +0,339) | +0,303 (−0,144 à +0,713) | +0,191 (−0,890 à +1,347) | +0,282 (−1,251 à +1,927) |
| +2 | 13 | +0,043 (−0,078 à +0,174) | +0,127 (−0,700 à +0,816) | −0,003 (−0,909 à +0,911) | +0,108 (−1,310 à +1,652) |
| +4 | 13 | −0,041 (−0,476 à +0,404) | −0,372 (−1,144 à +0,249) | −0,066 (−1,010 à +0,865) | +0,069 (−1,415 à +1,684) |
| -1 | 13 | +2,739 (+2,510 à +2,963) | +3,295 (+2,931 à +3,678) | +3,152 (+2,265 à +4,089) | +3,592 (+2,215 à +5,135) |
| -2 | 13 | −0,057 (−0,306 à +0,156) | +3,198 (+2,813 à +3,620) | +3,040 (+1,958 à +4,178) | +3,561 (+2,069 à +5,277) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 12 | +0,590 (+0,346 à +0,871) | +0,136 (−0,658 à +0,994) |
| F1 shorts | 1 | +2,223 (+2,223 à +2,223) | +3,276 (+3,276 à +3,276) |
| F3 longs | 47 | +0,236 (−0,107 à +0,535) | −0,083 (−0,955 à +0,780) |
| F3 shorts | 93 | −0,021 (−0,314 à +0,261) | −0,360 (−0,935 à +0,146) |
| chocs bruts, régime calme (= F2) | 202 | +0,101 (−0,071 à +0,273) | +0,080 (−0,259 à +0,433) |
| chocs bruts, régime agité (= F4) | 188 | +0,007 (−0,180 à +0,178) | +0,082 (−0,227 à +0,409) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · Asie (18 h – 2 h) | 2 | +0,671 (−0,889 à +2,230) | −0,519 (−5,645 à +4,608) |
| F1 · Londres (2 h – 8 h) | 2 | −0,835 (−2,068 à +0,397) | −1,691 (−3,365 à −0,017) |
| F3 · Londres (2 h – 8 h) | 25 | −0,067 (−0,466 à +0,357) | −0,693 (−1,742 à +0,471) |
| F1 · New York matin (8 h – 12 h) | 10 | +0,875 (+0,491 à +1,255) | +0,501 (−0,503 à +1,351) |
| F3 · New York matin (8 h – 12 h) | 84 | +0,306 (−0,009 à +0,584) | +0,071 (−0,426 à +0,505) |
| F1 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F1 · New York après-midi (12 h – 18 h) | 1 | +2,223 (+2,223 à +2,223) | +3,276 (+3,276 à +3,276) |
| F3 · New York après-midi (12 h – 18 h) | 29 | −0,560 (−1,129 à −0,047) | −0,861 (−2,013 à +0,409) |
| F1 · séance régulière 9 h 30 – 16 h ET | 3 | +1,927 (+1,505 à +2,348) | +2,200 (+1,662 à +2,739) |
| F3 · séance régulière 9 h 30 – 16 h ET | 39 | −0,121 (−0,636 à +0,360) | −0,245 (−1,164 à +0,640) |
| F1 · hors séance régulière 9 h 30 – 16 h ET | 10 | +0,352 (−0,192 à +0,832) | −0,170 (−1,217 à +0,861) |
| F3 · hors séance régulière 9 h 30 – 16 h ET | 101 | +0,137 (−0,134 à +0,417) | −0,276 (−0,783 à +0,214) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 93 | +0,167 (−0,108 à +0,439) | −0,283 (−0,759 à +0,186) |
| F3 · 10 h ET | 93 | +0,167 (−0,108 à +0,439) | −0,283 (−0,759 à +0,186) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 36 | −0,005 (−0,474 à +0,442) | −0,138 (−1,055 à +0,737) |
| F1 · hors créneaux d'annonces | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · hors créneaux d'annonces | 11 | −0,567 (−1,581 à +0,629) | −0,560 (−2,899 à +1,900) |
| F1, référence au quart d'heure UTC | 13 | +0,697 (+0,410 à +1,016) | +0,387 (−0,471 à +1,234) |
| F3, référence au quart d'heure UTC | 140 | +0,072 (−0,144 à +0,286) | −0,230 (−0,673 à +0,165) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,0008 · 0,0118 | 0,0002 · 0,0034 | 0,2414 · 1,0000 | 0,2689 · 1,0000 |
| F2 | 0,0141 · 0,1969 | 0,1716 · 1,0000 | 0,3554 · 1,0000 | 0,4009 · 1,0000 |
| F3 | 0,0321 · 0,4176 | 0,3114 · 1,0000 | 0,8533 · 1,0000 | 0,9183 · 1,0000 |
| F4 | 0,5053 · 1,0000 | 0,4758 · 1,0000 | 0,3324 · 1,0000 | 0,7641 · 1,0000 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 0 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = — ; **non tradé (P < 1)** ; plateau ± 2 crans (C6) : **non** (S à −2, −1, 0, +1, +2 crans : hors grille · hors grille · hors grille · hors grille · hors grille).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **50,7 %** (P(perte) 34 %, pente −0,85) ; dispersion des Sharpe journaliers des essais 0,0116.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2017 | — | non | — | 0 | +0,34 |
| 2018 | — | non | — | 0 | +0,19 |
| 2019 | — | non | — | 0 | +0,07 |
| 2020 | — | non | — | 0 | +0,08 |
| 2021 | — | non | — | 0 | +0,08 |
| 2022 | — | non | — | 0 | +0,02 |

## Validation 2017-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 | 0,0 % | — | — | — | — | — | — | — |
| B — seuil Q99 % | 0,1 % | 0,04 | 0,06 | 0,05 | 0,02 | −3,2 % | 1,22 | 2 | 1,2 % | 50 % | 1,92 % | −1,58 % | 1,22 | 0,00 | 604 % | 0,13 |

C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A **non** (0 % des années positives) · B **non** (17 %).

### Méthode A : années, moitiés, scénarios de coûts

Sharpe par moitié de la validation : — puis —.

| année | rendement | trades |
| --- | ---: | ---: |
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

Sharpe par moitié de la validation : 0,06 puis —.

| année | rendement | trades |
| --- | ---: | ---: |
| 2017 | 1,9 % | 1 |
| 2018 | 0,0 % | 0 |
| 2019 | −1,6 % | 1 |
| 2020 | 0,0 % | 0 |
| 2021 | 0,0 % | 0 |
| 2022 | 0,0 % | 0 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,1 % | 0,05 | 1,24 | −3,2 % | 2 |
| bas (2,00 $ ; 0,5 pas) | 0,1 % | 0,04 | 1,23 | −3,2 % | 2 |
| référence (3,50 $ ; 1 pas) | 0,1 % | 0,04 | 1,22 | −3,2 % | 2 |
| haut (5,00 $ ; 2 pas) | 0,0 % | 0,04 | 1,21 | −3,2 % | 2 |
| stress (5,00 $ ; 4 pas) | 0,0 % | 0,04 | 1,19 | −3,2 % | 2 |

Sharpe selon le coût (× référence) : × 0 → 0,05 · × 0,5 → 0,04 · × 1 → 0,04 · × 2 → 0,04 · × 4 → 0,03 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2015-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,8 % | 0,36 | 0,35 | 3,21 | −3,9 % | 4 | 4,0 % |
| bas (2,00 $ ; 0,5 pas) | 0,8 % | 0,36 | 0,35 | 3,20 | −3,9 % | 4 | 4,0 % |
| référence (3,50 $ ; 1 pas) | 0,8 % | 0,36 | 0,35 | 3,19 | −3,9 % | 4 | 4,0 % |
| haut (5,00 $ ; 2 pas) | 0,8 % | 0,36 | 0,35 | 3,17 | −3,9 % | 4 | 4,0 % |
| stress (5,00 $ ; 4 pas) | 0,8 % | 0,36 | 0,35 | 3,14 | −3,9 % | 4 | 4,0 % |

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

