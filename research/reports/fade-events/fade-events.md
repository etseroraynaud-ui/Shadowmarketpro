# Étude d'événements contrarienne (« fade ») sur tous les chocs détectés

Protocole : `research/preregistration/fade-events.md` (commité avant calcul). R_fade(h) = −s · ln(P_{t+h}/P_t) en points de base (pb), après chaque choc du détecteur du moteur (régime en vigueur), sans filtre a posteriori. Moyenne [IC 95 % par bootstrap des mois] · nombre de chocs. Seuil de coût aller-retour : 10 pb. Module de recherche : aucune règle de Shock Engine n'est modifiée.

## Chocs

| Actif | tous | rejet par mèche | sans cassure | cassure propre | en régime agité |
|---|---:|---:|---:|---:|---:|
| BTC | 11945 | 513 | 6081 | 5351 | 8476 |
| ETH | 9552 | 478 | 4690 | 4384 | 6737 |
| XRP | 8117 | 455 | 4194 | 3468 | 5508 |
| BNB | 8654 | 284 | 4633 | 3737 | 5869 |
| DOGE | 7172 | 352 | 3809 | 3011 | 4973 |
| TRX | 7647 | 292 | 3956 | 3399 | 4931 |
| ADA | 8381 | 296 | 4618 | 3467 | 6051 |
| LINK | 7413 | 205 | 4172 | 3036 | 5356 |
| XLM | 8112 | 255 | 4663 | 3194 | 5718 |
| LTC | 8311 | 372 | 4356 | 3583 | 5631 |

Développement : BTC + ETH. Réplication : les 8 cryptos, mises en commun.

## H_A — tous les chocs : le mouvement opposé a-t-il une espérance positive ?

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| BTC + ETH | −2,1 [−3,4 ; −0,9] · n 21497 | −1,6 [−3,1 ; −0,1] · n 21496 | −0,7 [−2,8 ; 1,5] · n 21493 | 0,9 [−1,8 ; 3,6] · n 21483 | 3,5 [−0,4 ; 7,7] · n 21472 |
| 8 cryptos | −0,5 [−2,0 ; 1,2] · n 63805 | 2,0 [−0,2 ; 4,4] · n 63800 | 4,4 [1,3 ; 7,6] · n 63793 | 5,8 [1,9 ; 9,9] · n 63763 | 8,0 [3,8 ; 12,5] · n 63715 |

p unilatéral (moyenne > 0), BTC + ETH : 1 : 0,999 · 2 : 0,980 · 4 : 0,732 · 8 : 0,260 · 16 : 0,042.

## H_B — chocs rejetés par une mèche : l'espérance dépasse-t-elle 10 pb ?

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| BTC + ETH | −2,9 [−8,6 ; 2,9] · n 991 | −0,5 [−7,6 ; 7,1] · n 991 | −5,9 [−14,8 ; 3,5] · n 991 | 0,7 [−11,1 ; 13,1] · n 991 | −6,6 [−22,7 ; 8,9] · n 989 |
| 8 cryptos (réplication) | 11,6 [1,5 ; 24,2] · n 2511 | 19,1 [7,3 ; 33,2] · n 2509 | 25,4 [9,5 ; 43,2] · n 2509 | 34,8 [13,9 ; 58,0] · n 2509 | 33,6 [8,4 ; 60,2] · n 2506 |

p unilatéral (moyenne > 10 pb) : BTC + ETH 1 : 1,000 · 2 : 0,995 · 4 : 0,999 · 8 : 0,930 · 16 : 0,980 ; 8 cryptos 1 : 0,408 · 2 : 0,071 · 4 : 0,029 · 8 : 0,008 · 16 : 0,035. Horizons qui passent et se répliquent : aucun.

## Par type de choc (rejet, sans cassure, cassure propre)

BTC + ETH :

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| rejet par mèche | −2,9 [−8,5 ; 2,8] · n 991 | −0,5 [−7,5 ; 6,9] · n 991 | −5,9 [−14,8 ; 3,3] · n 991 | 0,7 [−11,1 ; 13,4] · n 991 | −6,6 [−22,7 ; 9,3] · n 989 |
| sans cassure du range | −1,8 [−3,6 ; 0,0] · n 10771 | −1,9 [−3,8 ; 0,1] · n 10770 | −1,4 [−3,7 ; 1,0] · n 10768 | −0,1 [−3,1 ; 2,8] · n 10763 | 4,2 [0,3 ; 8,2] · n 10758 |
| cassure propre | −2,4 [−4,3 ; −0,6] · n 9735 | −1,4 [−4,0 ; 1,2] · n 9735 | 0,6 [−3,1 ; 4,3] · n 9734 | 2,0 [−2,6 ; 6,8] · n 9729 | 3,9 [−2,1 ; 10,2] · n 9725 |

8 cryptos :

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| rejet par mèche | 11,6 [1,8 ; 23,5] · n 2511 | 19,1 [7,3 ; 33,3] · n 2509 | 25,4 [9,9 ; 43,4] · n 2509 | 34,8 [13,9 ; 58,7] · n 2509 | 33,6 [8,6 ; 60,4] · n 2506 |
| sans cassure du range | −0,7 [−2,6 ; 1,2] · n 34399 | 0,8 [−1,4 ; 2,9] · n 34397 | 1,4 [−1,2 ; 3,9] · n 34393 | 2,0 [−1,5 ; 5,7] · n 34371 | 6,7 [2,6 ; 11,1] · n 34344 |
| cassure propre | −1,3 [−4,0 ; 1,1] · n 26895 | 1,9 [−2,1 ; 5,6] · n 26894 | 6,2 [1,5 ; 11,1] · n 26891 | 8,0 [1,4 ; 14,6] · n 26883 | 7,2 [0,4 ; 14,0] · n 26865 |

## Par régime de volatilité (BTC + ETH)

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| calme · rejet par mèche | −5,1 [−11,5 ; 1,3] · n 493 | −0,5 [−8,4 ; 8,3] · n 493 | −8,1 [−18,5 ; 2,6] · n 493 | −2,9 [−16,2 ; 11,3] · n 493 | −16,4 [−34,0 ; 0,6] · n 491 |
| calme · sans cassure du range | −2,7 [−6,2 ; 0,6] · n 1590 | −2,8 [−7,1 ; 1,5] · n 1590 | −2,8 [−8,7 ; 2,8] · n 1590 | −4,9 [−13,4 ; 3,3] · n 1588 | −0,9 [−10,7 ; 8,9] · n 1586 |
| calme · cassure propre | −4,7 [−7,4 ; −2,1] · n 4201 | −7,0 [−10,6 ; −3,7] · n 4201 | −7,5 [−12,0 ; −3,3] · n 4201 | −7,8 [−13,3 ; −2,4] · n 4199 | −13,2 [−21,0 ; −5,9] · n 4196 |
| agité · rejet par mèche | −0,8 [−9,8 ; 8,8] · n 498 | −0,6 [−11,4 ; 11,7] · n 498 | −3,7 [−17,0 ; 10,6] · n 498 | 4,4 [−12,9 ; 24,0] · n 498 | 3,2 [−21,7 ; 26,7] · n 498 |
| agité · sans cassure du range | −1,7 [−3,7 ; 0,4] · n 9181 | −1,7 [−3,8 ; 0,4] · n 9180 | −1,2 [−3,7 ; 1,5] · n 9178 | 0,7 [−2,5 ; 3,7] · n 9175 | 5,1 [0,6 ; 9,6] · n 9172 |
| agité · cassure propre | −0,7 [−3,2 ; 1,7] · n 5534 | 2,8 [−0,6 ; 6,3] · n 5534 | 6,7 [1,5 ; 12,0] · n 5533 | 9,5 [2,8 ; 16,5] · n 5530 | 16,8 [9,0 ; 25,5] · n 5529 |

## H_C — liquidité : chocs rejetés, par tercile d'illiquidité d'Amihud

BTC + ETH :

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| liquide (bas) | 0,1 [−7,1 ; 7,1] · n 454 | −4,4 [−14,4 ; 5,3] · n 454 | −9,9 [−21,9 ; 2,5] · n 454 | −4,9 [−21,2 ; 11,7] · n 454 | −13,8 [−32,5 ; 4,2] · n 453 |
| moyen | −7,5 [−14,3 ; −0,5] · n 476 | 1,8 [−6,6 ; 11,1] · n 476 | −3,2 [−15,1 ; 8,8] · n 476 | 4,6 [−9,0 ; 18,3] · n 476 | −8,1 [−30,9 ; 13,5] · n 475 |
| illiquide (haut) | 9,6 [−19,7 ; 52,7] · n 61 | 9,9 [−41,2 ; 91,0] · n 61 | 3,2 [−36,2 ; 60,3] · n 61 | 12,2 [−48,6 ; 108,3] · n 61 | 59,2 [−28,4 ; 194,2] · n 61 |

8 cryptos :

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| liquide (bas) | 15,5 [5,4 ; 26,7] · n 1155 | 17,1 [5,4 ; 30,0] · n 1155 | 28,5 [11,5 ; 47,9] · n 1155 | 38,6 [20,1 ; 58,9] · n 1155 | 36,6 [16,3 ; 58,7] · n 1153 |
| moyen | 0,7 [−9,0 ; 10,3] · n 1155 | 6,9 [−4,7 ; 18,7] · n 1154 | 12,1 [−2,9 ; 30,3] · n 1154 | 18,6 [−1,6 ; 40,8] · n 1154 | 14,5 [−16,6 ; 45,5] · n 1153 |
| illiquide (haut) | 51,4 [−20,5 ; 177,6] · n 201 | 100,8 [6,8 ; 237,3] · n 200 | 83,8 [5,2 ; 196,9] · n 200 | 106,7 [−21,9 ; 291,1] · n 200 | 126,2 [−6,2 ; 285,2] · n 200 |

Écart haut − bas à h = 4 : BTC + ETH 13,1 pb [−26,4 ; 66,0], p 0,302 ; 8 cryptos 55,2 pb. H_C non confirmée.

Volume du choc (z-score du moteur), chocs rejetés, BTC + ETH :

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| volume faible (z < 0) | −26,9 [−110,1 ; 18,3] · n 4 | −17,1 [−107,7 ; 37,6] · n 4 | −59,3 [−219,4 ; 29,6] · n 4 | −44,5 [−182,1 ; 34,6] · n 4 | −99,8 [−220,3 ; 18,2] · n 4 |
| volume élevé (z ≥ 0) | −2,8 [−8,4 ; 2,8] · n 987 | −0,5 [−7,3 ; 6,9] · n 987 | −5,7 [−14,8 ; 3,3] · n 987 | 0,9 [−10,9 ; 13,6] · n 987 | −6,2 [−22,4 ; 9,7] · n 985 |

## Entrée réellement exécutable (perpétuels Binance, BTC + ETH, 2020+, chocs rejetés)

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| depuis la clôture du choc | −1,1 [−7,6 ; 5,1] · n 665 | 0,8 [−7,2 ; 9,3] · n 665 | −3,2 [−13,9 ; 7,9] · n 665 | 0,9 [−14,9 ; 18,2] · n 665 | −6,4 [−26,7 ; 13,5] · n 665 |
| entrée à T + 1 min | 2,4 [−4,0 ; 8,7] · n 665 | 4,3 [−3,4 ; 11,8] · n 665 | 0,3 [−9,8 ; 11,0] · n 665 | 4,5 [−10,8 ; 21,7] · n 665 | −2,8 [−22,7 ; 16,0] · n 665 |

665 chocs rejetés avec prix Binance. Nets du seuil de 10 pb à T + 1 min : 1 : −7,6 · 2 : −5,7 · 4 : −9,7 · 8 : −5,5 · 16 : −12,8 pb.

## Robustesse (chocs rejetés)

| | h = 1 (15 min) | h = 2 (30 min) | h = 4 (1 h) | h = 8 (2 h) | h = 16 (4 h) |
|---|---:|---:|---:|---:|---:|
| premier choc de chaque grappe, BTC + ETH | −2,2 [−8,5 ; 3,8] · n 396 | −4,4 [−14,4 ; 4,5] · n 396 | −8,1 [−19,9 ; 2,6] · n 396 | −5,0 [−18,4 ; 7,9] · n 396 | −16,5 [−34,4 ; −0,3] · n 395 |
| premier choc de chaque grappe, 8 cryptos | 0,2 [−5,1 ; 5,6] · n 989 | 0,7 [−7,5 ; 8,0] · n 989 | 1,0 [−8,0 ; 10,5] · n 989 | 4,6 [−5,4 ; 14,8] · n 989 | 2,7 [−11,9 ; 17,3] · n 988 |
| seuil unique |z| > 2,5, BTC + ETH | −6,0 [−11,1 ; −0,5] · n 1172 | −3,1 [−9,6 ; 4,1] · n 1172 | −4,8 [−12,7 ; 4,0] · n 1172 | 0,1 [−11,6 ; 12,1] · n 1172 | −4,6 [−19,4 ; 11,4] · n 1170 |
| seuil unique |z| > 2,5, 8 cryptos | 9,4 [1,0 ; 19,8] · n 3021 | 15,1 [4,1 ; 28,9] · n 3017 | 16,2 [3,6 ; 30,6] · n 3016 | 25,8 [8,8 ; 45,0] · n 3016 | 29,0 [9,5 ; 48,1] · n 3013 |

## Verdict (règle fixée avant calcul)

**Pas d'avantage contrarien exploitable démontré.** Aucun horizon ne passe H_B avec sa réplication : sur les chocs rejetés, le rendement contrarien ne dépasse pas de façon fiable le coût aller-retour.

## Contrôles

- OK — BTC : détecteur recalculé = mainShock du moteur : 0 écarts
- OK — ETH : détecteur recalculé = mainShock du moteur : 0 écarts
- OK — chocs en nombre suffisant : 21497 · 63807
- OK — prix Binance trouvés pour les chocs de 2020+ : 16560
