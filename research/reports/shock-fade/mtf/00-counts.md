# Shock Fade multi-timeframe — comptages préalables (aucun prix postérieur aux chocs)

Généré par `research/fade/shockfade/run_mtf.py counts`. N1 = volatilité bipuissance des 20 barres précédentes (bornée à 6 h – 7 j) × saisonnalité ; N2 = écart type des 100 rendements de barre précédents (comptage seulement). Indépendants = premiers chocs de chaque groupe (chocs séparés de moins de l'horizon primaire maximal) ; groupes croisés = groupes BTC et ETH qui se chevauchent, fusionnés.

## Échantillon P : principal (perpétuels 2020-07 → 2026-09)

| TF | k | chocs BTC | chocs ETH | indépendants BTC | indépendants ETH | groupes croisés | calme / agité (indép.) | propre / rejetée / sans (indép.) | N2 ≥ k (BTC+ETH) |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|
| M5 (réf.) | 3 | 10691 | 10359 | 7283 | 7302 | 9899 | 8152 / 6433 | 11072 / 583 / 2930 | 24007 |
| M5 (réf.) | 4 | 4463 | 4357 | 3458 | 3439 | 4860 | 4013 / 2884 | 5966 / 195 / 736 | 10088 |
| M15 (réf.) | 3 | 3803 | 3799 | 3116 | 3201 | 4356 | 3585 / 2732 | 4916 / 326 / 1075 | 8361 |
| M15 (réf.) | 4 | 1582 | 1587 | 1399 | 1441 | 2070 | 1696 / 1144 | 2501 / 95 / 244 | 3741 |
| M30 | 3 | 1978 | 2033 | 1550 | 1614 | 2114 | 1820 / 1344 | 2509 / 149 / 506 | 4806 |
| M30 | 4 | 907 | 877 | 784 | 770 | 1097 | 929 / 625 | 1364 / 57 / 133 | 2146 |
| H1 | 3 | 1085 | 1041 | 749 | 747 | 938 | 880 / 616 | 1177 / 96 / 223 | 2399 |
| H1 | 4 | 488 | 475 | 410 | 401 | 549 | 499 / 312 | 710 / 39 / 62 | 1040 |
| H4 | 3 | 301 | 269 | 215 | 195 | 265 | 262 / 148 | 322 / 21 / 67 | 610 |
| H4 | 4 | 122 | 118 | 105 | 100 | 149 | 140 / 65 | 177 / 9 / 19 | 235 |

## Échantillon R : réplication (comptant 2018-01 → 2019-12)

| TF | k | chocs BTC | chocs ETH | indépendants BTC | indépendants ETH | groupes croisés | calme / agité (indép.) | propre / rejetée / sans (indép.) | N2 ≥ k (BTC+ETH) |
|---|---:|---:|---:|---:|---:|---:|---|---|---:|
| M5 (réf.) | 3 | 3063 | 3632 | 2069 | 2316 | 3018 | 2803 / 1582 | 3349 / 167 / 869 | 7240 |
| M5 (réf.) | 4 | 1422 | 1632 | 1087 | 1211 | 1635 | 1500 / 798 | 1967 / 65 / 266 | 3286 |
| M15 (réf.) | 3 | 1134 | 1309 | 935 | 1051 | 1394 | 1279 / 707 | 1616 / 94 / 276 | 2477 |
| M15 (réf.) | 4 | 571 | 662 | 502 | 576 | 771 | 693 / 385 | 959 / 34 / 85 | 1223 |
| M30 | 3 | 644 | 723 | 520 | 574 | 725 | 701 / 393 | 879 / 54 / 161 | 1370 |
| M30 | 4 | 338 | 340 | 301 | 299 | 427 | 382 / 218 | 534 / 17 / 49 | 712 |
| H1 | 3 | 337 | 363 | 246 | 250 | 317 | 313 / 183 | 408 / 20 / 68 | 694 |
| H1 | 4 | 169 | 180 | 147 | 152 | 205 | 196 / 103 | 267 / 6 / 26 | 372 |
| H4 | 3 | 78 | 90 | 64 | 60 | 85 | 90 / 34 | 104 / 4 / 16 | 204 |
| H4 | 4 | 36 | 36 | 31 | 32 | 45 | 48 / 15 | 55 / 3 / 5 | 76 |

