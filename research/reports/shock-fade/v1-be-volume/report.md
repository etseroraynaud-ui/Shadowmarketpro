# Shock Engine V1 — point mort et volume directionnel 2 h / 4 h

Protocole : `research/preregistration/v1-be-volume.md` (commité avant tout calcul de performance). Généré par `research/fade/v1/be-volume-study.ts` (copie isolée `trail-broker.ts` / `trail-sim.ts`, volume `taker15.py`). Moteur figé, bot et site non modifiés. **Tout est mesuré sur l'historique qui a servi à développer V1 : une amélioration resterait exploratoire jusqu'à validation prospective.**

## Verdict

**variante candidate : B2 (point mort dès +3 R), exploratoire jusqu'à validation prospective.**

- **B2 remplit les six critères.** ΔSharpe +0,07 [+0,02 ; +0,11], p Holm 0,008 ; BTC +0,07 [+0,03 ; +0,10], ETH +0,06 [+0,02 ; +0,12] ; drawdown −16,7 % contre −17,8 % ; Sharpe coûts × 2 1,95 contre 1,88 ; 36 / 36 très gros gagnants conservés. Effet petit : 51 sorties modifiées sur 716, ΔR apparié +30,9 R [+19,3 ; +44,2] (4 % du R total), 46 perdants ramenés vers le point mort pour +33,9 R, 2 gagnants coupés pour −3,0 R ; ΔR apparié ≥ 0 chaque année. C'est une candidate exploratoire : V1 reste inchangée tant qu'une validation prospective séparée (plan à pré-enregistrer) ne l'a pas confirmée.
- **Volume à 2 h : aucune information mesurable au-delà du prix.** À gain latent donné, corrélation partielle entre I et R_garder +0,023 [−0,060 ; +0,096] ; parmi les trades à gain < +0,5 R, l'écart de R_garder entre I < 0 et I ≥ 0 vaut −0,10 R [−1,05 ; +0,92]. Les deux groupes ont un R_garder positif : couper l'un ou l'autre coûte.
- **Volume à 4 h : aucune information mesurable au-delà du prix.** À gain latent donné, corrélation partielle entre I et R_garder +0,066 [−0,021 ; +0,148] ; parmi les trades à gain < +0,5 R, l'écart de R_garder entre I < 0 et I ≥ 0 vaut +0,67 R [−0,50 ; +1,98]. Les deux groupes ont un R_garder positif : couper l'un ou l'autre coûte.
- V3 et C1 passent formellement le critère 6 parce qu'ils coupent moins de trades que leur contrôle de prix (176 contre 401 déclenchements à 2 h), pas parce que le volume trie les trades : ils échouent d'ailleurs aux critères 1 et 2. Toutes les variantes de volume perdent du R en apparié (−225 à −164 R) et coupent des très gros gagnants.
- Rejeu complet : ΔSharpe de −0,18 à +0,11 ; meilleure variante C2 (+0,11, IC [−0,06 ; +0,26], p Holm 0,612).
- Apparié : ΔR total de −225 à +31 R ; R récupérés sur les perdants +34 à +124 R, R sacrifiés sur les gagnants −340 à −3 R.
- Volume contre prix seul : 5 / 6 variantes de volume font mieux que leur contrôle de prix ; 2 / 6 passent le critère 6.
- Critères remplis : B1 2/5, B2 5/5, V1 1/6, V2 1/6, V3 3/6, V4 2/6, C1 3/6, C2 3/6.

## 1. Vérification du moteur

- rejeu de V1 : 716 trades (358 BTC / 358 ETH), Sharpe 2.0242, CAGR 67.7 %, drawdown -17.8 %, sorties 439 SL / 273 FLIP / 4 TRAIL : OK
- copie isolée (spécification V1) = moteur figé, positions et equity au bit près, BTC et ETH : OK
- copie avec point mort à +10⁹ R et sortie anticipée impossible = moteur figé au bit près (les ajouts sont inertes) : OK
- rejeu apparié (entrées imposées) = 716 trades V1, identiques aux sorties exportées (v1-exits/trades.csv) : OK
- exécution des nouvelles sorties (rejeux appariés) : sortie anticipée à la première clôture ≥ entrée + H au prix de clôture ; point mort au prix d'entrée, à l'ouverture en gap ou à la clôture d'activation, jamais plus favorable que l'entrée : OK

## 2. Données de volume (Binance comptant, 1 min)

I_H = d · (V achat − V vente) / V total sur [entrée, entrée + H). Fenêtre exploitable : ≥ 90 % des minutes présentes et volume > 0 ; sinon pas de décision de volume (comportement de V1), jamais de volume remplacé par zéro.

| actif | corrélation des rendements 15 min V1 / Binance | clôtures 15 min identiques | fenêtres 2 h exploitables (complètes) | fenêtres 4 h exploitables (complètes) | signe du rendement 2 h / 4 h concordant | signe de I = signe du rendement Binance (2 h / 4 h) |
|---|---:|---:|---:|---:|---:|---:|
| BTC (V1 : Bitstamp) | 0,979 | 0,1 % | 358 / 358 (358) | 358 / 358 (358) | 98 % / 98 % | 70 % / 71 % |
| ETH (V1 : Binance) | 1,000 | 100,0 % | 358 / 358 (358) | 357 / 358 (357) | 100 % / 100 % | 65 % / 65 % |

Fenêtres non exploitables (couverture) : ETH 2019-05-15T00:15 (69 %), fenêtre 4 h.
Décisions décalées par un trou de la série V1 : V1 0, V2 1, V3 0, V4 1, C1 0, C2 1.

## 3. Tableau comparatif — portefeuille complet (entrées supplémentaires autorisées)

ΔSharpe : bootstrap par blocs de mois (IC 95 %, p unilatéral, Holm sur les 8 variantes). Contrôles de prix en italique (hors Holm). Très gros gagnants conservés : 36 meilleurs trades V1, même entrée, R ≥ 75 % du R V1.

| configuration | trades | Sharpe | ΔSharpe [IC 95 %] | p Holm | CAGR | drawdown | Calmar | PF | gagnants | payoff | R total | exposition | très gros gagnants | Sharpe BTC (Δ) | Sharpe ETH (Δ) | Sharpe coûts × 2 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B0 · V1 inchangée | 716 | 2,02 | — | — | 67,7 % | −17,8 % | 3,79 | 2,46 | 31,1 % | 5,54 | +767 | 16,0 % | 36 / 36 | 1,46 | 1,93 | 1,88 |
| B1 · point mort dès +2 R | 732 | 2,03 | 0,00 [−0,13 ; +0,11] | 1,000 | 64,2 % | −16,0 % | 4,02 | 2,57 | 28,7 % | 6,68 | +770 | 15,2 % | 33 / 36 | 1,55 (+0,09) | 1,91 (−0,02) | 1,87 |
| B2 · point mort dès +3 R | 721 | 2,09 | +0,07 [+0,02 ; +0,11] | 0,008 | 70,8 % | −16,7 % | 4,24 | 2,58 | 30,7 % | 6,00 | +793 | 15,7 % | 36 / 36 | 1,52 (+0,07) | 1,99 (+0,06) | 1,95 |
| V1 · 2 h : I < 0 | 794 | 1,84 | −0,18 [−0,46 ; +0,05] | 1,000 | 51,2 % | −15,0 % | 3,40 | 2,35 | 33,5 % | 4,62 | +612 | 13,0 % | 29 / 36 | 1,42 (−0,03) | 1,69 (−0,24) | 1,66 |
| V2 · 4 h : I < 0 | 772 | 2,01 | −0,01 [−0,23 ; +0,18] | 1,000 | 58,2 % | −16,2 % | 3,60 | 2,46 | 34,3 % | 4,61 | +649 | 13,5 % | 28 / 36 | 1,44 (−0,02) | 1,89 (−0,04) | 1,84 |
| V3 · 2 h : I < 0 et gain < +0,5 R | 778 | 1,91 | −0,11 [−0,35 ; +0,07] | 1,000 | 56,2 % | −17,2 % | 3,27 | 2,41 | 32,0 % | 5,09 | +646 | 13,5 % | 31 / 36 | 1,36 (−0,10) | 1,81 (−0,12) | 1,74 |
| V4 · 4 h : I < 0 et gain < +0,5 R | 750 | 2,05 | +0,02 [−0,14 ; +0,16] | 1,000 | 64,0 % | −16,3 % | 3,93 | 2,54 | 31,7 % | 5,28 | +676 | 14,2 % | 29 / 36 | 1,42 (−0,03) | 1,97 (+0,05) | 1,88 |
| C1 · point mort +3 R + V3 | 781 | 2,01 | −0,02 [−0,24 ; +0,17] | 1,000 | 59,8 % | −15,2 % | 3,93 | 2,56 | 31,8 % | 5,48 | +674 | 13,3 % | 31 / 36 | 1,43 (−0,03) | 1,90 (−0,03) | 1,83 |
| C2 · point mort +3 R + V4 | 754 | 2,13 | +0,11 [−0,06 ; +0,26] | 0,612 | 67,3 % | −14,5 % | 4,63 | 2,70 | 31,4 % | 5,71 | +705 | 14,0 % | 29 / 36 | 1,50 (+0,05) | 2,05 (+0,12) | 1,97 |
| *P1 · 2 h : gain < 0* | 786 | 1,95 | −0,08 [−0,28 ; +0,10] | — | 56,9 % | −17,4 % | 3,27 | 2,52 | 24,6 % | 7,82 | +694 | 13,3 % | 26 / 36 | 1,51 (+0,05) | 1,81 (−0,11) | — |
| *P2 · 4 h : gain < 0* | 765 | 2,00 | −0,02 [−0,20 ; +0,13] | — | 61,8 % | −18,5 % | 3,34 | 2,52 | 26,5 % | 7,02 | +714 | 13,8 % | 29 / 36 | 1,45 (−0,01) | 1,92 (−0,01) | — |
| *P3 · 2 h : gain < +0,5 R* | 878 | 1,70 | −0,33 [−0,65 ; −0,04] | — | 41,1 % | −15,1 % | 2,72 | 2,37 | 33,7 % | 4,66 | +524 | 9,9 % | 19 / 36 | 1,25 (−0,20) | 1,62 (−0,31) | — |
| *P4 · 4 h : gain < +0,5 R* | 807 | 1,98 | −0,04 [−0,28 ; +0,18] | — | 60,0 % | −14,1 % | 4,25 | 2,64 | 33,3 % | 5,16 | +648 | 12,0 % | 26 / 36 | 1,35 (−0,10) | 1,95 (+0,02) | — |
| *PC1 · point mort +3 R + P3* | 882 | 1,75 | −0,27 [−0,61 ; +0,03] | — | 42,8 % | −15,2 % | 2,81 | 2,48 | 33,2 % | 4,96 | +529 | 9,7 % | 19 / 36 | 1,26 (−0,20) | 1,69 (−0,24) | — |
| *PC2 · point mort +3 R + P4* | 812 | 2,04 | +0,02 [−0,24 ; +0,26] | — | 62,7 % | −15,3 % | 4,10 | 2,78 | 32,9 % | 5,55 | +659 | 11,7 % | 26 / 36 | 1,36 (−0,10) | 2,02 (+0,09) | — |

CAGR par sleeve (BTC / ETH) — B0 : 39,6 % / 80,0 % ; B1 : 41,4 % / 75,4 % ; B2 : 41,6 % / 83,4 % ; V1 : 36,5 % / 59,8 % ; V2 : 37,0 % / 68,8 % ; V3 : 34,6 % / 66,8 % ; V4 : 36,9 % / 76,0 % ; C1 : 36,7 % / 70,9 % ; C2 : 39,1 % / 79,6 %.

IC du ΔSharpe par sleeve (BTC ; ETH) : B1 [+0,01 ; +0,16] ; [−0,15 ; +0,10] · B2 [+0,03 ; +0,10] ; [+0,02 ; +0,12] · V1 [−0,25 ; +0,14] ; [−0,55 ; +0,03] · V2 [−0,21 ; +0,14] ; [−0,27 ; +0,18] · V3 [−0,33 ; +0,08] ; [−0,38 ; +0,09] · V4 [−0,22 ; +0,13] ; [−0,12 ; +0,19] · C1 [−0,25 ; +0,17] ; [−0,28 ; +0,19] · C2 [−0,14 ; +0,20] ; [−0,05 ; +0,27].

## 4. R récupérés et R sacrifiés — 716 trades V1, mêmes entrées

Rejeu apparié sur le chemin chronologique du simulateur. « Concernés » : sortie modifiée. R récupérés = Σ ΔR sur les perdants V1 (R ≤ 0) ; R sacrifiés = Σ ΔR sur les gagnants V1. IC 95 % : bootstrap des mois d'entrée.

| configuration | évalués à l'échéance | données manquantes | déclenchés | concernés | perdants sauvés (dégradés) | R récupérés | gagnants coupés | R sacrifiés | 36 meilleurs touchés (ΔR) | ΔR moyen [IC] | ΔR total [IC] | dont BTC | dont ETH |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 · point mort dès +2 R | — | — | — | 104 | 82 (4) | +64,1 | 18 | −80,5 | 3 (−52,4) | −0,023 [−0,137 ; +0,057] | −16,3 [−93,4 ; +43,7] | −2,5 | −13,9 |
| B2 · point mort dès +3 R | — | — | — | 51 | 46 (3) | +33,9 | 2 | −3,0 | 0 (0,0) | +0,043 [+0,027 ; +0,060] | +30,9 [+19,3 ; +44,2] | +17,9 | +12,9 |
| V1 · 2 h : I < 0 | 594 | 0 | 197 | 197 | 148 (3) | +114,3 | 44 | −339,5 | 7 (−201,9) | −0,315 [−0,609 ; −0,088] | −225,3 [−443,0 ; −53,5] | −107,0 | −118,2 |
| V2 · 4 h : I < 0 | 525 | 1 | 166 | 166 | 118 (3) | +106,9 | 40 | −290,5 | 8 (−192,9) | −0,256 [−0,518 ; −0,057] | −183,6 [−345,6 ; −38,3] | −85,3 | −98,3 |
| V3 · 2 h : I < 0 et gain < +0,5 R | 594 | 0 | 176 | 176 | 138 (3) | +95,4 | 35 | −259,2 | 5 (−147,2) | −0,229 [−0,456 ; −0,043] | −163,8 [−315,3 ; −32,6] | −84,9 | −78,8 |
| V4 · 4 h : I < 0 et gain < +0,5 R | 525 | 1 | 133 | 133 | 100 (3) | +73,0 | 29 | −238,5 | 7 (−181,2) | −0,231 [−0,476 ; −0,046] | −165,5 [−333,9 ; −24,7] | −77,7 | −87,8 |
| C1 · point mort +3 R + V3 | 594 | 0 | 176 | 215 | 175 (4) | +123,9 | 36 | −259,5 | 5 (−147,2) | −0,189 [−0,420 ; −0,009] | −135,6 [−294,3 ; −7,3] | −69,2 | −66,4 |
| C2 · point mort +3 R + V4 | 524 | 1 | 133 | 180 | 144 (5) | +105,7 | 30 | −238,9 | 7 (−181,2) | −0,186 [−0,434 ; +0,012] | −133,2 [−305,8 ; +8,0] | −60,0 | −73,2 |
| *P1 · 2 h : gain < 0* | 594 | — | 247 | 247 | 194 (5) | +115,4 | 48 | −330,7 | 10 (−205,8) | −0,301 [−0,562 ; −0,084] | −215,2 [−403,6 ; −65,7] | −106,3 | −108,9 |
| *P2 · 4 h : gain < 0* | 525 | — | 186 | 186 | 142 (6) | +85,2 | 37 | −263,3 | 7 (−152,1) | −0,249 [−0,492 ; −0,062] | −178,2 [−345,7 ; −54,5] | −95,8 | −82,4 |
| *P3 · 2 h : gain < +0,5 R* | 594 | — | 401 | 401 | 293 (5) | +223,4 | 99 | −618,4 | 17 (−353,7) | −0,552 [−0,855 ; −0,283] | −395,0 [−610,8 ; −213,5] | −171,4 | −223,6 |
| *P4 · 4 h : gain < +0,5 R* | 525 | — | 289 | 289 | 207 (6) | +159,5 | 70 | −414,1 | 10 (−221,1) | −0,356 [−0,622 ; −0,136] | −254,6 [−447,1 ; −96,2] | −143,8 | −110,9 |
| *PC1 · point mort +3 R + P3* | 594 | — | 401 | 428 | 318 (6) | +242,2 | 100 | −618,8 | 17 (−353,7) | −0,526 [−0,838 ; −0,250] | −376,6 [−595,3 ; −181,8] | −159,7 | −216,9 |
| *PC2 · point mort +3 R + P4* | 524 | — | 289 | 330 | 245 (8) | +187,1 | 71 | −414,4 | 10 (−221,1) | −0,318 [−0,580 ; −0,089] | −227,4 [−418,9 ; −64,4] | −127,0 | −100,3 |

**Trades concernés par actif, sens et année** (variantes) :

| variante | BTC | ETH | long | short | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | 51 | 53 | 73 | 31 | 5 | 17 | 18 | 4 | 15 | 18 | 4 | 14 | 9 |
| B2 | 24 | 27 | 33 | 18 | 2 | 10 | 10 | 1 | 9 | 7 | 3 | 6 | 3 |
| V1 | 91 | 106 | 118 | 79 | 13 | 24 | 22 | 10 | 31 | 31 | 15 | 33 | 18 |
| V2 | 69 | 97 | 104 | 62 | 13 | 26 | 21 | 8 | 21 | 24 | 9 | 25 | 19 |
| V3 | 82 | 94 | 105 | 71 | 13 | 22 | 17 | 10 | 29 | 27 | 13 | 30 | 15 |
| V4 | 60 | 73 | 80 | 53 | 12 | 20 | 16 | 7 | 19 | 15 | 6 | 22 | 16 |
| C1 | 102 | 113 | 133 | 82 | 15 | 30 | 26 | 11 | 33 | 32 | 15 | 35 | 18 |
| C2 | 82 | 98 | 112 | 68 | 14 | 29 | 26 | 8 | 27 | 20 | 9 | 28 | 19 |

**ΔR apparié par année d'entrée** :

| variante | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | −8,5 | −17,9 | +7,0 | −0,9 | −7,4 | +2,8 | +2,1 | +4,2 | +2,3 |
| B2 | +2,0 | +6,4 | +8,0 | +1,0 | +4,8 | +3,3 | +1,1 | +4,4 | 0,0 |
| V1 | −34,7 | +4,4 | −28,5 | −6,0 | +3,5 | −52,0 | −22,2 | +8,1 | −97,7 |
| V2 | −68,7 | +9,7 | −16,4 | −4,0 | −1,7 | −51,6 | −22,9 | +12,2 | −40,1 |
| V3 | −34,7 | +1,8 | −22,2 | −6,0 | +1,3 | −43,8 | −20,7 | +6,0 | −45,4 |
| V4 | −71,0 | +6,3 | −10,1 | −5,4 | −3,1 | −42,0 | −9,1 | +5,3 | −36,2 |
| C1 | −32,7 | +7,2 | −15,3 | −5,0 | +3,9 | −38,8 | −19,7 | +10,3 | −45,3 |
| C2 | −69,0 | +12,6 | −2,2 | −4,4 | +1,4 | −37,0 | −8,0 | +9,7 | −36,1 |

**Écart de rendement annuel du portefeuille (variante − B0, rejeu complet)** :

| variante | 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| B1 | −8,6 % | 7,7 % | 0,9 % | −2,6 % | −27,8 % | 3,1 % | 2,6 % | −6,7 % | −3,5 % |
| B2 | 1,0 % | 5,1 % | 6,6 % | 1,7 % | 2,6 % | 0,3 % | 0,3 % | 4,0 % | 0,2 % |
| V1 | 10,2 % | −1,6 % | −34,2 % | −16,8 % | −18,1 % | −16,1 % | −8,6 % | −23,8 % | −11,2 % |
| V2 | −32,8 % | 6,9 % | −8,4 % | −10,7 % | −20,4 % | −6,7 % | −10,0 % | −4,5 % | 1,7 % |
| V3 | 10,2 % | −1,7 % | −22,3 % | −14,7 % | −18,8 % | −12,2 % | −9,4 % | −11,4 % | −2,7 % |
| V4 | −1,9 % | 4,8 % | 2,3 % | −10,1 % | −18,6 % | −8,5 % | 2,4 % | −4,7 % | 4,4 % |
| C1 | 11,2 % | 4,6 % | −17,4 % | −13,3 % | −15,1 % | −10,5 % | −7,9 % | −7,1 % | −2,2 % |
| C2 | −0,9 % | 11,1 % | 8,7 % | −8,7 % | −16,6 % | −6,6 % | 2,7 % | −0,9 % | 4,6 % |

## 5. Diagnostic du volume directionnel à 2 h et 4 h

Trades V1 encore ouverts à l'échéance. R_garder = R final V1 − R obtenu en sortant à l'échéance (rejeu X2 / X4, commission comprise) : > 0, garder valait mieux. IC 95 % : bootstrap des mois.

### 2 h

594 trades ouverts, 0 sans volume exploitable. Part avec I < 0 : 33 % (BTC 32 %, ETH 34 %) ; I médian +0,029.

| groupe (connu à l'échéance) | trades | R_garder moyen [IC] | R_garder total |
|---|---:|---:|---:|
| gain < 0 et I < 0 | 120 | +0,80 [−0,08 ; +1,89] | +95,8 |
| gain < 0 et I ≥ 0 | 127 | +0,94 [+0,17 ; +1,87] | +119,4 |
| 0 ≤ gain < +0,5 R et I < 0 | 56 | +1,21 [+0,08 ; +2,83] | +68,0 |
| 0 ≤ gain < +0,5 R et I ≥ 0 | 98 | +1,14 [+0,23 ; +2,20] | +111,8 |
| gain ≥ +0,5 R et I < 0 | 21 | +2,93 [−0,19 ; +7,25] | +61,5 |
| gain ≥ +0,5 R et I ≥ 0 | 172 | +1,56 [+0,73 ; +2,51] | +268,6 |

- Parmi les trades à gain < +0,5 R, écart de R_garder moyen entre I < 0 et I ≥ 0 (< 0 : le volume distingue les trades à couper) : −0,10 [−1,05 ; +0,92] ; 2018-09 → 2022-06 : −0,42 [−1,76 ; +0,89] ; 2022-07 → 2026-09 : +0,20 [−1,07 ; +1,66] ; BTC +0,19 [−1,31 ; +1,77] ; ETH −0,34 [−1,58 ; +0,96].
- Corrélation partielle de Spearman entre I et R_garder, à gain latent donné : +0,023 [−0,060 ; +0,096] ; par moitié +0,083 [−0,027 ; +0,190] puis −0,021 [−0,127 ; +0,088] ; BTC +0,024 [−0,080 ; +0,132], ETH +0,025 [−0,069 ; +0,120].

### 4 h

525 trades ouverts, 1 sans volume exploitable. Part avec I < 0 : 32 % (BTC 28 %, ETH 35 %) ; I médian +0,027.

| groupe (connu à l'échéance) | trades | R_garder moyen [IC] | R_garder total |
|---|---:|---:|---:|
| gain < 0 et I < 0 | 91 | +1,12 [−0,18 ; +2,71] | +101,6 |
| gain < 0 et I ≥ 0 | 95 | +0,81 [+0,22 ; +1,57] | +76,6 |
| 0 ≤ gain < +0,5 R et I < 0 | 42 | +1,52 [−0,16 ; +3,49] | +63,9 |
| 0 ≤ gain < +0,5 R et I ≥ 0 | 61 | +0,21 [−0,41 ; +0,95] | +12,5 |
| gain ≥ +0,5 R et I < 0 | 33 | +0,55 [−0,71 ; +2,00] | +18,1 |
| gain ≥ +0,5 R et I ≥ 0 | 202 | +2,03 [+1,08 ; +3,11] | +409,4 |

- Parmi les trades à gain < +0,5 R, écart de R_garder moyen entre I < 0 et I ≥ 0 (< 0 : le volume distingue les trades à couper) : +0,67 [−0,50 ; +1,98] ; 2018-09 → 2022-06 : +0,56 [−1,19 ; +2,79] ; 2022-07 → 2026-09 : +0,79 [−0,71 ; +2,43] ; BTC +0,43 [−1,34 ; +2,81] ; ETH +0,91 [−0,37 ; +2,59].
- Corrélation partielle de Spearman entre I et R_garder, à gain latent donné : +0,066 [−0,021 ; +0,148] ; par moitié +0,076 [−0,059 ; +0,210] puis +0,070 [−0,049 ; +0,180] ; BTC +0,062 [−0,057 ; +0,177], ETH +0,074 [−0,053 ; +0,190].

## 6. Le volume apporte-t-il plus que le prix ? (critère 6)

Rejeu complet : Sharpe de la variante de volume contre son contrôle de prix seul (même échéance, même condition de gain). Bootstrap par mois, p unilatéral ; écart sur chaque moitié chronologique (2018-09 → 2022-06, 2022-07 → 2026-09), descriptif.

| variante | contrôle | Sharpe variante | Sharpe contrôle | écart [IC 95 %] | p | 1re moitié | 2e moitié | critère 6 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| V1 | P1 | 1,84 | 1,95 | −0,10 [−0,38 ; +0,14] | 0,772 | −0,09 | −0,11 | non |
| V2 | P2 | 2,01 | 2,00 | +0,01 [−0,19 ; +0,20] | 0,435 | −0,10 | +0,14 | non |
| V3 | P3 | 1,91 | 1,70 | +0,21 [−0,04 ; +0,49] | 0,049 | +0,12 | +0,32 | oui |
| V4 | P4 | 2,05 | 1,98 | +0,06 [−0,10 ; +0,23] | 0,222 | −0,02 | +0,16 | non |
| C1 | PC1 | 2,01 | 1,75 | +0,25 [0,00 ; +0,52] | 0,025 | +0,17 | +0,34 | oui |
| C2 | PC2 | 2,13 | 2,04 | +0,09 [−0,07 ; +0,25] | 0,157 | +0,01 | +0,17 | non |

## 7. Contrôles statistiques

- CSCV-PBO (B0 + 8 variantes, 16 blocs) : **25,9 %** ; configuration la plus souvent choisie : C2.
- Sharpe dégonflé de la meilleure variante (C2, N = 241 essais connus, minimum) : 1,000 — il reflète surtout le niveau hérité de V1 ; de son écart à B0 (N = 8), seul pertinent pour la décision : 0,004.
- Ajouté après les résultats, informatif et hors règle de décision : Sharpe dégonflé de l'écart B2 − B0 (N = 8) 0,649, ratio d'information annualisé 0,94.
- Walk-forward **rétrospectif** (recalage annuel 2020 → 2026, meilleur Sharpe passé parmi les 9) : Sharpe hors période d'entraînement 2,03 contre 1,98 pour B0 sur les mêmes jours ; choix : 2020 : C2, 2021 : C2, 2022 : C2, 2023 : C2, 2024 : C2, 2025 : C2, 2026 : C2. Ce n'est pas une validation prospective indépendante : tout l'historique a servi à développer V1.
- Par actif et par année : sections 3 et 4.

## 8. Règle de décision

| variante | 1 ΔSharpe > 0 (IC, Holm) | 2 BTC et ETH | 3 drawdown | 4 coûts × 2 | 5 ≥ 30 / 36 très gros gagnants | 6 volume > prix | convaincante |
|---|---:|---:|---:|---:|---:|---:|---:|
| B1 | non | non | oui | non | oui | s. o. | **non** |
| B2 | oui | oui | oui | oui | oui | s. o. | **oui** |
| V1 | non | non | oui | non | non | non | **non** |
| V2 | non | non | oui | non | non | non | **non** |
| V3 | non | non | oui | non | oui | oui | **non** |
| V4 | non | non | oui | oui | non | non | **non** |
| C1 | non | non | oui | non | oui | oui | **non** |
| C2 | non | oui | oui | oui | non | non | **non** |

## 9. Limites

- **BTC** : V1 trade Bitstamp, le volume agresseur vient de Binance comptant (proxy, voir section 2). Le flux des perpétuels, majoritaire, n'est pas utilisé.
- **Point mort** activé à la clôture de bougie (comportement d'un script qui déplace son stop en fin de bougie) ; un stop modifié en cours de bougie donnerait d'autres sorties.
- **Exécution** : point mort exécuté au prix d'entrée sans glissement, comme tous les stops de V1. Le risque initial médian vaut 1,10 % du prix : un glissement de 0,05 % coûterait ≈ 0,05 R par sortie au point mort.
- **Un seul historique**, déjà utilisé pour développer V1 (≥ 241 essais connus) ; les règles de sortie précoce et de point mort avaient déjà été explorées sur E2 avec des résultats négatifs.
- Le walk-forward est rétrospectif, et les moitiés chronologiques sont une lecture descriptive, pas un échantillon de validation.
