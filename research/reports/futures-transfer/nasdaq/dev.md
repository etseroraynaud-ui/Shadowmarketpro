# Transfert de Shock Engine V1 · Nasdaq (substitut CFD USATECH) · étape de développement

**Substitut, pas des futures** : CFD Nasdaq-100 USATECH.IDX/USD (Dukascopy, prix acheteur) — substitut de NQ. Protocole `research/preregistration/futures-k-transfer.md` et additif `futures-k-transfer-proxy.md`. Produit par `node research/futures-transfer/study.ts --stage dev`. Aucune valeur absolue de seuil dans ce rapport (dépôt public) : les seuils sont donnés en crans de grille (0,1) par rapport au seuil retenu. Empreinte SHA-256 du fichier privé de développement : `fe863134599d87c4d7f5fc186f78579ebdd62154d2483ddeb04e2bd7053e62d7`.

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

### F1 · entrées qualifiées de V1 (seuil figé) · 246 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 246 | +0,017 | −0,006 | +0,013 | +0,016 | −0,133 à +0,159 | −0,163 à +0,185 | 0,14 | 0,15 | +0,036 / −0,000 | 67 % de 12 | 2 % |
| 4 | 246 | +0,089 | +0,250 | +0,065 | +0,212 | −0,222 à +0,368 | −0,282 à +0,421 | 0,37 | 0,34 | +0,129 / +0,030 | 58 % de 12 | 4 % |
| 16 | 246 | +0,124 | +0,689 | −0,038 | +0,587 | −0,588 à +0,490 | −0,707 à +0,591 | −0,12 | −0,10 | −0,201 / +0,053 | 50 % de 12 | 11 % |
| 64 | 246 | +0,394 | +0,928 | −0,041 | +0,559 | −0,742 à +0,623 | −0,869 à +0,759 | −0,10 | −0,09 | −0,144 / +0,016 | 42 % de 12 | 99 % |

### F2 · chocs bruts, régime calme · 2 358 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 358 | +0,091 | +0,006 | +0,092 | +0,008 | +0,048 à +0,137 | +0,040 à +0,146 | 3,34 | 3,06 | +0,073 / +0,105 | 92 % de 12 | 1 % |
| 4 | 2 358 | +0,196 | +0,011 | +0,204 | +0,041 | +0,111 à +0,300 | +0,094 à +0,319 | 3,60 | 3,57 | +0,071 / +0,292 | 92 % de 12 | 6 % |
| 16 | 2 357 | +0,173 | +0,003 | +0,201 | +0,039 | +0,053 à +0,364 | +0,021 à +0,394 | 2,17 | 2,18 | +0,058 / +0,297 | 75 % de 12 | 22 % |
| 64 | 2 356 | +0,040 | −0,135 | +0,135 | −0,055 | −0,084 à +0,352 | −0,131 à +0,398 | 1,01 | 0,99 | +0,180 / +0,105 | 83 % de 12 | 97 % |

### F3 · chocs bruts dans le sens de la tendance 60 min, régime calme · 1 460 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 1 460 | +0,131 | +0,057 | +0,129 | +0,059 | +0,068 à +0,195 | +0,056 à +0,207 | 3,35 | 3,34 | +0,152 / +0,112 | 83 % de 12 | 1 % |
| 4 | 1 460 | +0,285 | +0,116 | +0,292 | +0,154 | +0,164 à +0,417 | +0,139 à +0,445 | 3,72 | 3,72 | +0,206 / +0,351 | 92 % de 12 | 6 % |
| 16 | 1 460 | +0,221 | +0,117 | +0,232 | +0,124 | +0,008 à +0,465 | −0,035 à +0,515 | 1,65 | 1,68 | +0,188 / +0,262 | 58 % de 12 | 21 % |
| 64 | 1 459 | −0,041 | −0,093 | +0,001 | −0,008 | −0,307 à +0,325 | −0,363 à +0,398 | 0,01 | 0,01 | +0,068 / −0,045 | 33 % de 12 | 96 % |

### F4 · chocs bruts, régime agité (descriptif) · 2 392 événements

| bougies | n | brut moyen | brut médian | excès moyen | excès médian | IC 90 % | IC 95 % | t grappes | t NW | moitiés | années > 0 | traverse une fermeture |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 2 392 | +0,034 | −0,030 | +0,037 | −0,038 | −0,009 à +0,081 | −0,017 à +0,090 | 1,36 | 1,28 | +0,046 / +0,026 | 58 % de 12 | 2 % |
| 4 | 2 392 | +0,052 | −0,007 | +0,060 | −0,003 | −0,034 à +0,154 | −0,049 à +0,172 | 1,05 | 1,06 | +0,150 / −0,041 | 67 % de 12 | 8 % |
| 16 | 2 392 | +0,115 | +0,065 | +0,135 | +0,028 | −0,013 à +0,285 | −0,040 à +0,310 | 1,48 | 1,51 | +0,194 / +0,068 | 50 % de 12 | 23 % |
| 64 | 2 392 | +0,112 | +0,016 | +0,178 | +0,020 | −0,026 à +0,384 | −0,068 à +0,424 | 1,44 | 1,39 | +0,178 / +0,179 | 67 % de 12 | 94 % |

**Porte « phénomène présent » (F1)** : G1 critère de zero-shot.ts à 4 et 16 bougies : **non** · G2 événements au hasard p < 0,05 à 16 bougies : **non** · G3 au moins 150 événements : oui → **phénomène non démontré**.

### Événements au hasard (2 000 tirages, même année, même sens, même régime)

| famille | 1 b. : observé · médiane · 95e c. · p | 4 b. : observé · médiane · 95e c. · p | 16 b. : observé · médiane · 95e c. · p | 64 b. : observé · médiane · 95e c. · p |
| --- | ---: | ---: | ---: | ---: |
| F1 | +0,013 · −0,001 · +0,082 · 0,405 | +0,065 · −0,002 · +0,169 · 0,262 | −0,038 · −0,000 · +0,372 · 0,564 | −0,041 · −0,012 · +0,801 · 0,521 |
| F2 | +0,092 · −0,000 · +0,028 · 0,000 | +0,204 · +0,001 · +0,056 · 0,000 | +0,201 · +0,002 · +0,127 · 0,004 | +0,135 · +0,007 · +0,260 · 0,204 |
| F3 | +0,129 · +0,001 · +0,037 · 0,000 | +0,292 · +0,002 · +0,073 · 0,000 | +0,232 · +0,012 · +0,166 · 0,012 | +0,001 · +0,032 · +0,359 · 0,570 |
| F4 | +0,037 · +0,001 · +0,027 · 0,012 | +0,060 · +0,002 · +0,059 · 0,047 | +0,135 · +0,003 · +0,118 · 0,029 | +0,178 · +0,014 · +0,253 · 0,125 |

### Signaux F1 décalés (−1 et −2 lisent le futur : contrôle seulement)

| décalage | n | excès 1 b. (IC 90 %) | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) | excès 64 b. (IC 90 %) |
| --- | ---: | ---: | ---: | ---: | ---: |
| +1 | 246 | +0,068 (−0,074 à +0,211) | −0,128 (−0,417 à +0,136) | +0,034 (−0,399 à +0,492) | −0,029 (−0,611 à +0,573) |
| +2 | 246 | +0,038 (−0,085 à +0,161) | −0,220 (−0,518 à +0,075) | −0,054 (−0,458 à +0,378) | −0,119 (−0,671 à +0,438) |
| +4 | 246 | −0,166 (−0,325 à −0,024) | −0,258 (−0,512 à −0,033) | −0,016 (−0,400 à +0,365) | −0,134 (−0,616 à +0,344) |
| -1 | 246 | +3,582 (+3,396 à +3,789) | +3,726 (+3,374 à +4,092) | +3,465 (+2,830 à +4,099) | +3,599 (+2,790 à +4,406) |
| -2 | 246 | +0,444 (+0,259 à +0,623) | +4,277 (+3,857 à +4,694) | +3,953 (+3,256 à +4,598) | +4,230 (+3,398 à +5,076) |

### Par sens et par régime

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 longs | 222 | +0,137 (−0,180 à +0,446) | +0,096 (−0,553 à +0,696) |
| F1 shorts | 24 | −0,601 (−1,336 à +0,088) | −1,280 (−3,037 à −0,094) |
| F3 longs | 667 | +0,115 (−0,059 à +0,297) | +0,129 (−0,209 à +0,433) |
| F3 shorts | 793 | +0,440 (+0,262 à +0,631) | +0,319 (+0,016 à +0,639) |
| chocs bruts, régime calme (= F2) | 2 358 | +0,204 (+0,111 à +0,296) | +0,201 (+0,050 à +0,351) |
| chocs bruts, régime agité (= F4) | 2 392 | +0,060 (−0,035 à +0,153) | +0,135 (−0,016 à +0,297) |

### Par séance (lecture seulement)

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F1 · Asie (18 h – 2 h) | 1 | −0,024 (−0,024 à −0,024) | +0,545 (+0,545 à +0,545) |
| F3 · Asie (18 h – 2 h) | 44 | +0,433 (−0,171 à +1,010) | −0,198 (−0,932 à +0,564) |
| F1 · Londres (2 h – 8 h) | 4 | −1,568 (−2,301 à −0,850) | −3,844 (−6,939 à −0,789) |
| F3 · Londres (2 h – 8 h) | 102 | +0,185 (−0,277 à +0,650) | +0,092 (−0,642 à +0,809) |
| F1 · New York matin (8 h – 12 h) | 214 | +0,054 (−0,269 à +0,372) | −0,109 (−0,713 à +0,547) |
| F3 · New York matin (8 h – 12 h) | 998 | +0,281 (+0,125 à +0,442) | +0,134 (−0,158 à +0,420) |
| F1 · dont bougie de 8 h 30 (annonces) | 13 | +0,281 (−0,708 à +1,299) | −1,369 (−4,263 à +1,517) |
| F3 · dont bougie de 8 h 30 (annonces) | 67 | +0,014 (−0,582 à +0,584) | −1,206 (−2,665 à +0,149) |
| F1 · New York après-midi (12 h – 18 h) | 27 | +0,402 (−0,137 à +0,966) | +1,066 (−0,174 à +2,478) |
| F3 · New York après-midi (12 h – 18 h) | 316 | +0,341 (+0,049 à +0,631) | +0,647 (+0,156 à +1,076) |
| F1 · séance régulière 9 h 30 – 16 h ET | 219 | +0,120 (−0,185 à +0,419) | +0,204 (−0,348 à +0,722) |
| F3 · séance régulière 9 h 30 – 16 h ET | 1 194 | +0,328 (+0,198 à +0,474) | +0,384 (+0,131 à +0,640) |
| F1 · hors séance régulière 9 h 30 – 16 h ET | 27 | −0,380 (−1,263 à +0,427) | −2,002 (−3,919 à −0,119) |
| F3 · hors séance régulière 9 h 30 – 16 h ET | 266 | +0,129 (−0,167 à +0,433) | −0,449 (−0,991 à +0,096) |

### Créneaux d'annonces (étiquette horaire, sans calendrier officiel) et sensibilité au quart d'heure UTC

| découpage | n | excès 4 b. (IC 90 %) | excès 16 b. (IC 90 %) |
| --- | ---: | ---: | ---: |
| F3 · 8 h 30 ET (publications macro) | 67 | +0,014 (−0,582 à +0,584) | −1,206 (−2,665 à +0,149) |
| F3 · 10 h ET | 116 | +0,038 (−0,390 à +0,448) | +0,458 (−0,128 à +1,043) |
| F3 · 14 h – 14 h 45 ET (FOMC) | 79 | +0,190 (−0,466 à +0,859) | +0,733 (−0,283 à +1,774) |
| F1 · hors créneaux d'annonces | 201 | +0,157 (−0,180 à +0,479) | +0,133 (−0,470 à +0,701) |
| F3 · hors créneaux d'annonces | 1 198 | +0,338 (+0,204 à +0,486) | +0,257 (+0,010 à +0,513) |
| F1, référence au quart d'heure UTC | 246 | +0,054 (−0,242 à +0,349) | −0,038 (−0,576 à +0,495) |
| F3, référence au quart d'heure UTC | 1 460 | +0,288 (+0,169 à +0,418) | +0,231 (+0,004 à +0,457) |

### p ajustés de Holm (lecture, 16 tests unilatéraux)

| famille | 1 b. p · Holm | 4 b. p · Holm | 16 b. p · Holm | 64 b. p · Holm |
| --- | ---: | ---: | ---: | ---: |
| F1 | 0,4425 · 1,0000 | 0,3559 · 1,0000 | 0,5460 · 1,0000 | 0,5390 · 1,0000 |
| F2 | 0,0004 · 0,0056 | 0,0002 · 0,0024 | 0,0149 · 0,1793 | 0,1558 · 1,0000 |
| F3 | 0,0004 · 0,0056 | 0,0001 · 0,0016 | 0,0495 · 0,5440 | 0,4972 · 1,0000 |
| F4 | 0,0871 · 0,6970 | 0,1459 · 1,0000 | 0,0689 · 0,6887 | 0,0750 · 0,6887 |

## Étapes 2 et 3 — grille de k et sélection (période de développement)

- Grille de 26 valeurs ; **26 configurations effectives** (valeurs aux entrées et sorties inverses identiques fusionnées ; tailles des groupes : 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1).
- Calibration finale (jusqu'au 2022-12-31) : 0 valeurs de k sur 26 ont S ≥ 1 ; plateau P(k*) = −0,18 ; **non tradé (P < 1)** ; plateau ± 2 crans (C6) : **non** (S à −2, −1, 0, +1, +2 crans : −1,43 · −0,16 · −0,09 · −0,29 · −0,89).
- CSCV-PBO (16 blocs, configurations effectives, Sharpe journalier) : **30,4 %** (P(perte) 40 %, pente −0,81) ; dispersion des Sharpe journaliers des essais 0,0134.

| pli (test) | méthode A : P(k*) | tradé | k* (crans / k final) | k admissibles (S ≥ 1) | méthode B : k_B − k_B final |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2017 | — | non | — | 0 | −0,14 |
| 2018 | — | non | — | 0 | −0,18 |
| 2019 | −0,88 | non | −7 | 0 | −0,13 |
| 2020 | −0,66 | non | −12 | 0 | −0,10 |
| 2021 | −0,50 | non | 0 | 0 | −0,05 |
| 2022 | −0,57 | non | 0 | 0 | −0,00 |

## Validation 2017-01-01 → 2022-12-31 (walk-forward, coûts de référence)

|  | CAGR | Sharpe | Sharpe Lo | Sortino | Calmar | DD max | PF | trades | exposition | gagnants | gain moy. | perte moy. | payoff | asym. | part 5 % meilleurs | t NW |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A — seuil fixe choisi à l'entraînement | 0,0 % | — | 0,00 | — | — | 0,0 % | — | 0 | 0,0 % | — | — | — | — | — | — | — |
| B — seuil Q99 % | 1,5 % | 0,65 | 0,63 | 1,12 | 0,68 | −2,2 % | 1,80 | 54 | 4,8 % | 43 % | 0,85 % | −0,35 % | 2,43 | 2,25 | 90 % | 1,54 |

C2 (Sharpe > 0,3, PF > 1,1, au moins la moitié des années positives) : A **non** (0 % des années positives) · B **non** (33 %).

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

Sharpe par moitié de la validation : 0,57 puis 0,72.

| année | rendement | trades |
| --- | ---: | ---: |
| 2017 | −1,0 % | 4 |
| 2018 | −0,8 % | 8 |
| 2019 | 5,3 % | 15 |
| 2020 | −1,8 % | 7 |
| 2021 | 8,0 % | 19 |
| 2022 | −0,4 % | 1 |

| scénario | CAGR | Sharpe | PF | DD max | trades |
| --- | ---: | ---: | ---: | ---: | ---: |
| sans coûts | 1,6 % | 0,68 | 1,87 | −2,1 % | 54 |
| bas (2,00 $ ; 0,5 pas) | 1,5 % | 0,67 | 1,83 | −2,1 % | 54 |
| référence (3,50 $ ; 1 pas) | 1,5 % | 0,65 | 1,80 | −2,2 % | 54 |
| haut (5,00 $ ; 2 pas) | 1,4 % | 0,62 | 1,75 | −2,2 % | 54 |
| stress (5,00 $ ; 4 pas) | 1,3 % | 0,58 | 1,68 | −2,2 % | 54 |

Sharpe selon le coût (× référence) : × 0 → 0,68 · × 0,5 → 0,67 · × 1 → 0,65 · × 2 → 0,61 · × 4 → 0,54 ; rentable sur toute la plage.

## V1 figée (seuil BTC) sur la période de développement 2015-01-01 → 2022-12-31 (descriptif)

| scénario | CAGR | Sharpe | Sharpe Lo | PF | DD max | trades | exposition |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sans coûts | −0,0 % | −0,01 | −0,01 | 0,98 | −5,8 % | 87 | 3,9 % |
| bas (2,00 $ ; 0,5 pas) | −0,1 % | −0,04 | −0,04 | 0,96 | −6,0 % | 87 | 3,9 % |
| référence (3,50 $ ; 1 pas) | −0,2 % | −0,07 | −0,08 | 0,93 | −6,2 % | 87 | 3,9 % |
| haut (5,00 $ ; 2 pas) | −0,3 % | −0,12 | −0,13 | 0,90 | −6,6 % | 87 | 3,9 % |
| stress (5,00 $ ; 4 pas) | −0,4 % | −0,19 | −0,21 | 0,85 | −7,2 % | 87 | 3,9 % |

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

