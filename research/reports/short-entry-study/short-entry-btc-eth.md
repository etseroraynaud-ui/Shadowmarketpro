# Avenant — les mêmes variantes sur BTC et ETH

Analyse demandée après lecture du verdict de l'étude pré-enregistrée (`short-entry-study.md`, plan `research/preregistration/short-entry-v1.1.md`). Mêmes variantes, même mesure, même bootstrap, sur BTC et ETH seulement. Produit par `node research/shock/short-entry-study.ts` au commit `b36831b`.

**Données déjà vues.** BTC et ETH sont les données où la baisse des shorts a été observée, et qui ont motivé l'étude. Ce qui suit dit ce que chaque variante aurait fait sur le produit, pas si elle marchera : aucun chiffre ici ne peut confirmer une règle. E1 et E2 restent exploratoires.

Simulation historique après coûts modélisés. Pas une performance live.

## Mesure principale : espérance nette d'un short par unité de risque

R = (PnL net / equity à l'entrée) / σ journalière des 30 jours précédents. Δ = moyenne sur BTC et ETH de [Ē(variante) − Ē(V0)]. Bootstrap : mois civils tirés en commun pour les deux sleeves et toutes les variantes, 10 000 réplications.

| Variante | Shorts BTC + ETH | Δ BTC | Δ ETH | Δ (moyenne) | 90 % | p unilatéral | Δ 1re moitié | Δ 2de moitié | Δ à coûts × 2 |
|---|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | 795 | Ē = +0,237 | Ē = +0,184 | — | — | — | — | — | — |
| V1 · symétrie bougie | 658 | −0,008 | +0,044 | +0,018 | −0,022 à +0,060 | 0,2287 | −0,013 (p 0,6554) | +0,042 (p 0,1311) | +0,019 |
| V2 · symétrie tendance 60 min | 555 | +0,021 | +0,096 | +0,058 | −0,011 à +0,137 | 0,0871 | +0,035 (p 0,3396) | +0,068 (p 0,0505) | +0,059 |
| V3 · V1 + V2 (principale) | 447 | +0,033 | +0,104 | +0,069 | −0,024 à +0,174 | 0,1147 | +0,089 (p 0,1781) | +0,047 (p 0,2395) | +0,070 |
| E1 · lambda + volume miroir (exploratoire) | 752 | +0,020 | −0,029 | −0,005 | −0,033 à +0,025 | 0,5988 | +0,008 (p 0,3420) | −0,017 (p 0,7488) | −0,004 |
| E2 · tendance journalière baissière (exploratoire) | 268 | +0,164 | +0,395 | +0,279 | +0,070 à +0,566 | 0,0097 | +0,275 (p 0,0918) | +0,232 (p 0,0253) | +0,281 |

Moitiés : shorts entrés jusqu'au 2022-09-15, puis après (découpage de l'attribution du Sharpe).

## Portefeuille 50/50 officiel

50/50 au départ, sans rebalancement, période commune 2018-09-01 → 2026-09-30 ; par moitié, 50/50 au début de chaque moitié. Écart de Sharpe avec V0 : bootstrap par mois civils, mêmes mois pour les deux variantes.

| Variante | Sharpe | Écart avec V0 | 90 % | Part des tirages sans gain | CAGR | Drawdown max | Sharpe 1re moitié | Sharpe 2de moitié |
|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | 1,73 | — | — | — | 64,5 % | −23,5 % | 2,13 | 1,29 |
| V1 · symétrie bougie | 1,69 | −0,035 | −0,158 à +0,086 | 67 % | 63,3 % | −23,5 % | 2,06 | 1,45 |
| V2 · symétrie tendance 60 min | 1,68 | −0,047 | −0,218 à +0,125 | 67 % | 61,5 % | −22,1 % | 1,92 | 1,50 |
| V3 · V1 + V2 (principale) | 1,62 | −0,102 | −0,326 à +0,118 | 77 % | 57,1 % | −18,9 % | 1,98 | 1,48 |
| V4 · sans shorts | 1,52 | −0,208 | −0,667 à +0,234 | 78 % | 33,5 % | −16,1 % | 1,41 | 1,66 |
| E1 · lambda + volume miroir (exploratoire) | 1,67 | −0,054 | −0,138 à +0,023 | 86 % | 60,3 % | −22,8 % | 2,08 | 1,23 |
| E2 · tendance journalière baissière (exploratoire) | 1,88 | +0,152 | −0,142 à +0,427 | 20 % | 61,6 % | −19,1 % | 2,03 | 1,78 |

## La règle de l'étude, transposée à BTC et ETH (indicatif)

| Condition | Valeur | Seuil | Résultat |
|---|---|---|---|
| Bootstrap, p unilatéral de Δ(V3) | 0,1147 | < 0,05 | non |
| Constance, sleeves où Ē(V3) > Ē(V0) | 2 / 2 | 2 / 2 | oui |
| Shorts V3 | 447 | ≥ 100 | oui |
| Δ(V3) à coûts × 2 | +0,070 | > 0 | oui |
| Sharpe du portefeuille 50/50, V3 − V0 | −0,102 | ≥ 0 | non |

## Shorts par sleeve (coûts × 1)

| Sleeve | Variante | Shorts | Par an | Réussite | Ē | Rendement net moyen | PF | Semi-écart R | Pire R | Épisodes : shorts · Σ net | Baisse > 30 % : shorts · Ē | Ē 1re moitié | Ē 2de moitié | Sharpe sleeve |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| BTC | V0 · v1 inchangée | 430 | 44,1 | 27 % | +0,237 | 0,54 % | 1,65 | 0,46 | −2,67 | 15 · 134 % | 205 · +0,326 | +0,417 (209) | +0,068 (221) | 1,55 |
| BTC | V1 · symétrie bougie | 361 | 37,0 | 27 % | +0,230 | 0,54 % | 1,65 | 0,46 | −2,67 | 15 · 108 % | 173 · +0,322 | +0,302 (184) | +0,154 (177) | 1,50 |
| BTC | V2 · symétrie tendance 60 min | 308 | 31,6 | 25 % | +0,258 | 0,51 % | 1,57 | 0,46 | −2,67 | 15 · 119 % | 158 · +0,329 | +0,389 (157) | +0,121 (151) | 1,39 |
| BTC | V3 · V1 + V2 (principale) | 250 | 25,6 | 26 % | +0,270 | 0,56 % | 1,63 | 0,47 | −2,67 | 15 · 99 % | 129 · +0,361 | +0,335 (132) | +0,198 (118) | 1,39 |
| BTC | V4 · sans shorts | 0 | 0,0 | — | — | — | — | — | — | 0 · 0 % | 0 · — | — (0) | — (0) | 1,27 |
| BTC | E1 · lambda + volume miroir (exploratoire) | 395 | 40,5 | 28 % | +0,257 | 0,59 % | 1,72 | 0,46 | −2,67 | 15 · 128 % | 189 · +0,358 | +0,449 (193) | +0,074 (202) | 1,56 |
| BTC | E2 · tendance journalière baissière (exploratoire) | 154 | 15,8 | 29 % | +0,402 | 0,83 % | 2,06 | 0,41 | −1,20 | 10 · 80 % | 97 · +0,453 | +0,549 (87) | +0,209 (67) | 1,52 |
| ETH | V0 · v1 inchangée | 365 | 45,2 | 27 % | +0,184 | 0,58 % | 1,61 | 0,42 | −1,03 | 21 · 109 % | 227 · +0,290 | +0,364 (153) | +0,055 (212) | 1,50 |
| ETH | V1 · symétrie bougie | 297 | 36,7 | 29 % | +0,229 | 0,72 % | 1,73 | 0,42 | −0,98 | 19 · 108 % | 191 · +0,338 | +0,453 (131) | +0,052 (166) | 1,54 |
| ETH | V2 · symétrie tendance 60 min | 247 | 30,6 | 28 % | +0,280 | 0,85 % | 1,86 | 0,42 | −0,98 | 17 · 111 % | 160 · +0,377 | +0,460 (109) | +0,138 (138) | 1,56 |
| ETH | V3 · V1 + V2 (principale) | 197 | 24,4 | 28 % | +0,289 | 0,92 % | 1,89 | 0,43 | −0,98 | 16 · 109 % | 130 · +0,370 | +0,623 (88) | +0,019 (109) | 1,52 |
| ETH | V4 · sans shorts | 0 | 0,0 | — | — | — | — | — | — | 0 · 0 % | 0 · — | — (0) | — (0) | 1,26 |
| ETH | E1 · lambda + volume miroir (exploratoire) | 357 | 44,2 | 26 % | +0,155 | 0,50 % | 1,51 | 0,42 | −1,03 | 20 · 111 % | 226 · +0,252 | +0,348 (151) | +0,014 (206) | 1,41 |
| ETH | E2 · tendance journalière baissière (exploratoire) | 114 | 14,1 | 32 % | +0,579 | 1,83 % | 3,10 | 0,38 | −1,06 | 11 · 99 % | 84 · +0,707 | +0,782 (57) | +0,377 (57) | 1,75 |

## Ē par année, BTC et ETH mis en commun

| Variante | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---|---|---|---|---|---|---|---|---|---|
| V0 · v1 inchangée | −0,50 (7) | +0,89 (75) | +0,32 (72) | +0,05 (66) | +0,21 (56) | +0,27 (131) | −0,09 (149) | +0,11 (68) | +0,16 (96) | +0,31 (75) |
| V1 · symétrie bougie | −0,50 (7) | +0,79 (70) | +0,34 (61) | −0,06 (49) | +0,15 (49) | +0,31 (111) | −0,08 (102) | +0,16 (57) | +0,16 (86) | +0,36 (66) |
| V2 · symétrie tendance 60 min | −0,31 (3) | +1,05 (59) | +0,27 (56) | +0,12 (38) | +0,14 (39) | +0,18 (105) | −0,05 (102) | +0,12 (45) | +0,22 (63) | +0,65 (45) |
| V3 · V1 + V2 (principale) | −0,48 (3) | +0,95 (55) | +0,41 (42) | +0,12 (24) | +0,13 (34) | +0,23 (86) | −0,04 (71) | +0,01 (38) | +0,22 (56) | +0,54 (38) |
| E1 · lambda + volume miroir (exploratoire) | −0,50 (7) | +0,99 (69) | +0,35 (69) | +0,04 (62) | +0,13 (55) | +0,23 (129) | −0,14 (141) | +0,12 (63) | +0,21 (87) | +0,33 (70) |
| E2 · tendance journalière baissière (exploratoire) | — (0) | +1,51 (40) | +0,11 (42) | −0,18 (11) | +0,33 (9) | +0,32 (73) | +0,14 (38) | +0,76 (7) | +0,12 (36) | +1,99 (12) |

Contrôles : ceux de `short-entry-study.md` (V0 = rapports validés de la v1 et Sharpe publié du portefeuille, entrées reconstruites = moteur, variantes sous-ensembles des shorts v1).
