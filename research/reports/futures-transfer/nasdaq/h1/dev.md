# Transfert de Shock Engine V1 · Nasdaq (substitut CFD USATECH) · H1 (60 min) · étape de développement

**Suite exploratoire (additif n° 3)** : bougies de H1 (60 min) tirées des fichiers 15 min, réglages de V1 inchangés en nombre de bougies, horizons en bougies du timeframe ; décidée après les résultats à 15 min, test final déjà regardé à 15 min.

**Substitut, pas des futures** : CFD Nasdaq-100 USATECH.IDX/USD (Dukascopy, prix acheteur) — substitut de NQ. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `8fb37f86fcdbbec339e9978db4626185b111770466c1d644d887a3bf150528e7`.

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

### F1 · entrées qualifiées de V1 (seuil figé) · 45 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 45 | −0,014 | +0,067 | −0,030 | +0,031 | −0,341 à +0,248 | −0,414 à +0,297 | −0,17 | −0,17 | −0,107 / −0,005 | 50 % de 12 | 0 % |
| 4 | 45 | +0,529 | +0,663 | +0,441 | +0,547 | +0,012 à +0,810 | −0,067 à +0,880 | 1,83 | 1,67 | −0,072 / +0,606 | 75 % de 12 | 11 % |
| 16 | 45 | +0,960 | +1,064 | +0,749 | +1,040 | +0,100 à +1,340 | −0,016 à +1,460 | 2,00 | 1,94 | −0,096 / +1,023 | 67 % de 12 | 96 % |
| 64 | 45 | +1,011 | +1,913 | +0,190 | +0,453 | −1,316 à +1,602 | −1,615 à +1,854 | 0,21 | 0,21 | −1,912 / +0,870 | 58 % de 12 | 100 % |

### F2 · chocs bruts, régime calme · 643 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 643 | +0,120 | −0,021 | +0,128 | −0,012 | +0,044 à +0,215 | +0,026 à +0,231 | 2,43 | 2,13 | +0,108 / +0,141 | 83 % de 12 | 1 % |
| 4 | 643 | +0,267 | +0,246 | +0,287 | +0,254 | +0,134 à +0,449 | +0,107 à +0,482 | 3,02 | 3,04 | +0,319 / +0,267 | 83 % de 12 | 20 % |
| 16 | 643 | +0,130 | +0,162 | +0,194 | +0,121 | −0,004 à +0,402 | −0,041 à +0,444 | 1,54 | 1,60 | +0,188 / +0,199 | 75 % de 12 | 97 % |
| 64 | 642 | +0,101 | +0,242 | +0,341 | +0,311 | −0,121 à +0,805 | −0,200 à +0,913 | 1,21 | 1,21 | +0,594 / +0,175 | 50 % de 12 | 100 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 502 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 502 | +0,160 | +0,001 | +0,169 | +0,018 | +0,068 à +0,274 | +0,047 à +0,295 | 2,65 | 2,52 | +0,170 / +0,169 | 92 % de 12 | 1 % |
| 4 | 502 | +0,291 | +0,255 | +0,315 | +0,280 | +0,132 à +0,496 | +0,099 à +0,535 | 2,78 | 2,86 | +0,373 / +0,276 | 83 % de 12 | 20 % |
| 16 | 502 | +0,075 | +0,148 | +0,151 | +0,121 | −0,091 à +0,392 | −0,134 à +0,432 | 1,03 | 1,07 | +0,241 / +0,090 | 50 % de 12 | 96 % |
| 64 | 501 | +0,208 | +0,318 | +0,491 | +0,472 | −0,065 à +1,059 | −0,184 à +1,170 | 1,43 | 1,44 | +0,803 / +0,278 | 67 % de 12 | 100 % |

### F4 · chocs bruts, régime agité (descriptif) · 618 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 618 | −0,022 | −0,058 | −0,020 | −0,045 | −0,100 à +0,060 | −0,114 à +0,075 | −0,42 | −0,41 | +0,044 / −0,096 | 45 % de 11 | 3 % |
| 4 | 618 | −0,051 | −0,062 | −0,046 | −0,077 | −0,173 à +0,093 | −0,201 à +0,123 | −0,57 | −0,53 | −0,013 / −0,084 | 36 % de 11 | 23 % |
| 16 | 618 | −0,011 | −0,116 | +0,014 | −0,119 | −0,165 à +0,206 | −0,204 à +0,240 | 0,12 | 0,12 | +0,043 / −0,021 | 64 % de 11 | 93 % |
| 64 | 618 | +0,018 | +0,044 | +0,096 | +0,099 | −0,324 à +0,563 | −0,401 à +0,646 | 0,36 | 0,38 | +0,240 / −0,076 | 45 % de 11 | 98 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : **non** · G2 événements au hasard p < 0,05 à 16 bougies : **non** · G3 au moins 150 événements : **non** → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | −0,030 · −0,000 · +0,199 · 0,598 | +0,441 · +0,003 · +0,416 · 0,044 | +0,749 · −0,002 · +0,799 · 0,058 | +0,190 · −0,046 · +1,576 · 0,406 |
| F2 | +0,128 · +0,001 · +0,053 · 0,000 | +0,287 · +0,006 · +0,114 · 0,000 | +0,194 · +0,005 · +0,236 · 0,093 | +0,341 · +0,066 · +0,484 · 0,144 |
| F3 | +0,169 · +0,002 · +0,063 · 0,000 | +0,315 · +0,007 · +0,137 · 0,000 | +0,151 · +0,015 · +0,269 · 0,197 | +0,491 · +0,062 · +0,586 · 0,085 |
| F4 | −0,020 · +0,001 · +0,050 · 0,752 | −0,046 · +0,003 · +0,105 · 0,785 | +0,014 · +0,016 · +0,225 · 0,507 | +0,096 · +0,036 · +0,444 · 0,411 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 45 | +0,075 (−0,158 à +0,299) | +0,585 (+0,308 à +0,864) | +0,697 (+0,201 à +1,173) | +0,121 (−1,309 à +1,569) |
| +2 | 45 | +0,239 (+0,081 à +0,400) | +0,607 (+0,304 à +0,901) | +0,574 (+0,024 à +1,132) | −0,143 (−1,587 à +1,317) |
| +4 | 45 | +0,114 (−0,059 à +0,284) | +0,313 (−0,137 à +0,850) | +0,147 (−0,417 à +0,719) | −0,628 (−2,064 à +0,813) |
| -1 | 45 | +3,080 (+2,883 à +3,276) | +3,392 (+2,896 à +3,816) | +3,918 (+3,125 à +4,662) | +3,382 (+1,770 à +4,928) |
| -2 | 45 | +0,464 (+0,191 à +0,742) | +3,692 (+3,079 à +4,264) | +4,549 (+3,602 à +5,422) | +3,848 (+2,159 à +5,477) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 41 | +0,508 (+0,057 à +0,891) | +0,766 (+0,119 à +1,348) |
| F1 shorts | 4 | −0,248 (−1,702 à +0,625) | +0,573 (−2,026 à +2,823) |
| F3 longs | 171 | +0,304 (+0,041 à +0,563) | +0,387 (−0,038 à +0,807) |
| F3 shorts | 331 | +0,321 (+0,078 à +0,554) | +0,029 (−0,274 à +0,348) |
| chocs bruts, régime calme (= F2) | 643 | +0,287 (+0,132 à +0,445) | +0,194 (−0,016 à +0,397) |
| chocs bruts, régime agité (= F4) | 618 | −0,046 (−0,176 à +0,083) | +0,014 (−0,175 à +0,202) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 1 | +0,334 (+0,334 à +0,334) | −0,043 (−0,043 à −0,043) |
| F3 · Asie (18 h – 2 h) | 11 | +0,187 (−0,335 à +0,747) | −0,928 (−1,972 à +0,274) |
| F1 · Londres (2 h – 8 h) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · Londres (2 h – 8 h) | 26 | +0,358 (−0,510 à +1,184) | −0,201 (−1,506 à +1,060) |
| F1 · New York matin (8 h – 12 h) | 38 | +0,475 (+0,046 à +0,851) | +0,981 (+0,346 à +1,549) |
| F3 · New York matin (8 h – 12 h) | 348 | +0,339 (+0,088 à +0,593) | +0,314 (−0,001 à +0,643) |
| F1 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F3 · dont bougie de 8 h 30 (annonces) | 0 | — (0,000 à 0,000) | — (0,000 à 0,000) |
| F1 · New York après-midi (12 h – 18 h) | 6 | +0,240 (−1,169 à +1,617) | −0,589 (−2,651 à +1,452) |
| F3 · New York après-midi (12 h – 18 h) | 117 | +0,247 (−0,027 à +0,536) | −0,154 (−0,538 à +0,207) |
| F1 · séance régulière 9 h 30 – 16 h ET | 25 | +0,435 (−0,097 à +0,934) | +0,452 (−0,410 à +1,157) |
| F3 · séance régulière 9 h 30 – 16 h ET | 285 | +0,139 (−0,083 à +0,369) | −0,029 (−0,298 à +0,247) |
| F1 · hors séance régulière 9 h 30 – 16 h ET | 20 | +0,448 (−0,201 à +1,040) | +1,120 (+0,304 à +1,827) |
| F3 · hors séance régulière 9 h 30 – 16 h ET | 217 | +0,547 (+0,262 à +0,816) | +0,388 (−0,032 à +0,806) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 30 | −0,500 (−1,329 à +0,300) | +0,075 (−1,130 à +1,258) |
| F3 · 10 h ET | 128 | +0,108 (−0,221 à +0,456) | +0,077 (−0,337 à +0,501) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 34 | +0,439 (−0,248 à +1,124) | +0,193 (−0,618 à +0,991) |
| F1 · hors créneaux d'annonces | 27 | +0,666 (+0,103 à +1,160) | +1,051 (+0,503 à +1,613) |
| F3 · hors créneaux d'annonces | 310 | +0,466 (+0,246 à +0,677) | +0,185 (−0,105 à +0,501) |
| F1, référence au quart d'heure UTC | 45 | +0,456 (+0,030 à +0,825) | +0,749 (+0,082 à +1,339) |
| F3, référence au quart d'heure UTC | 502 | +0,312 (+0,132 à +0,495) | +0,148 (−0,102 à +0,396) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,5668 · 1,0000 | 0,0335 · 0,3690 | 0,0230 · 0,2761 | 0,4175 · 1,0000 |
| F2 | 0,0076 · 0,0994 | 0,0013 · 0,0205 | 0,0615 · 0,6146 | 0,1126 · 0,9008 |
| F3 | 0,0040 · 0,0557 | 0,0027 · 0,0409 | 0,1526 · 1,0000 | 0,0759 · 0,6830 |
| F4 | 0,6630 · 1,0000 | 0,7158 · 1,0000 | 0,4509 · 1,0000 | 0,3588 · 1,0000 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 0 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = 0,65 ; **non tradé (P < 1)** ; plateau ± 2 crans (C6) : **non** (S à −2, −1, 0, +1, +2 crans : hors grille · 0,80 · 0,75 · 0,39 · 0,36).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **29,2 %** (P(perte) 10 %, pente −0,92) ; dispersion des Sharpe journaliers des essais 0,0105.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2017 | — | non | — | 0 | −0,16 |
| 2018 | — | non | — | 0 | −0,29 |
| 2019 | — | non | — | 0 | −0,24 |
| 2020 | — | non | — | 0 | −0,12 |
| 2021 | — | non | — | 0 | −0,14 |
| 2022 | — | non | — | 0 | −0,00 |

## Validation 2017-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 | 0,0 % | — | — | — | — | — | — | — |
| B — seuil Q99 % | 0,6 % | 0,40 | 0,33 | 0,74 | 0,21 | −3,0 % | 2,51 | 7 | 2,1 % | 43 % | 2,20 % | −0,66 % | 3,34 | 1,39 | 139 % | 0,92 |

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

Sharpe par moitié de la validation : −1,38 puis 0,98.

| année | rendement | trades |
| --- | ---: | ---: |
| 2017 | −1,2 % | 2 |
| 2018 | 0,0 % | 0 |
| 2019 | −1,4 % | 2 |
| 2020 | 0,0 % | 0 |
| 2021 | 6,7 % | 3 |
| 2022 | 0,0 % | 0 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,6 % | 0,41 | 2,56 | −2,9 % | 7 |
| bas (2,00 $ ; 0,5 pas) | 0,6 % | 0,40 | 2,53 | −3,0 % | 7 |
| référence (3,50 $ ; 1 pas) | 0,6 % | 0,40 | 2,51 | −3,0 % | 7 |
| haut (5,00 $ ; 2 pas) | 0,6 % | 0,39 | 2,47 | −3,0 % | 7 |
| stress (5,00 $ ; 4 pas) | 0,6 % | 0,38 | 2,40 | −3,1 % | 7 |

Sharpe selon le coût (× référence) : × 0 → 0,41 · × 0,5 → 0,40 · × 1 → 0,40 · × 2 → 0,39 · × 4 → 0,38 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2015-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 0,8 % | 0,40 | 0,35 | 2,10 | −4,4 % | 14 | 3,4 % |
| bas (2,00 $ ; 0,5 pas) | 0,8 % | 0,40 | 0,34 | 2,08 | −4,5 % | 14 | 3,4 % |
| référence (3,50 $ ; 1 pas) | 0,8 % | 0,39 | 0,34 | 2,06 | −4,5 % | 14 | 3,4 % |
| haut (5,00 $ ; 2 pas) | 0,8 % | 0,38 | 0,33 | 2,02 | −4,5 % | 14 | 3,4 % |
| stress (5,00 $ ; 4 pas) | 0,8 % | 0,37 | 0,32 | 1,97 | −4,6 % | 14 | 3,4 % |

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

