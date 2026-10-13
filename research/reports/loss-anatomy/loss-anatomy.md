# Anatomie des pertes du Shock Engine

Plan : `research/preregistration/loss-anatomy.md`, commité avant tout calcul. Script : `research/shock/loss-anatomy.ts` (commit `34541ff`). Descriptif : aucune règle du Shock Engine n'est modifiée ni testée. Trades V0 (E2 inchangé) : BTC/ETH de référence (développement) et 8 actifs vierges (réplication).

## Réponse

**Cible indiquée par la règle du plan : aucune cible dominante.**

- **BTC/ETH (développement)** : 43 % de la somme des pertes viennent de trades qui n'ont jamais atteint +0,5 R (classe A, IC 95 % 39 % à 47 %), 30 % de trades qui avaient atteint +1 R (classe C, IC 27 % à 34 %). Stop au point mort après +1 R (premier ordre) : +228 R récupérés sur les perdants, −431 R perdus sur les gagnants, net −203 R (IC 95 % −365 à −67) pour ΣR = 736 R.
- **8 actifs vierges (réplication)** : 48 % de la somme des pertes viennent de trades qui n'ont jamais atteint +0,5 R (classe A, IC 95 % 46 % à 50 %), 31 % de trades qui avaient atteint +1 R (classe C, IC 29 % à 32 %). Stop au point mort après +1 R (premier ordre) : +932 R récupérés sur les perdants, −1223 R perdus sur les gagnants, net −291 R (IC 95 % −532 à −67) pour ΣR = 775 R.

Borne « entrées » (un filtre parfait écartant toutes les pertes de classe A sans toucher un gagnant) : 429 R sur BTC/ETH, 1756 R sur les actifs vierges. Borne « sorties » (toutes les pertes de classe C ramenées au point mort) : 282 R et 1079 R. Ce sont des maximums théoriques ; le contrefactuel montre ce qu'en laisse une règle simple une fois payé son coût sur les gagnants.

## Lecture

- **Les pertes se forment surtout avant la continuation.** Trades jamais passés à +1 R (classes A et B) : 70 % de la somme des pertes sur BTC/ETH, 69 % sur les actifs vierges ; dont jamais à +0,5 R : 43 % et 48 %, la moitié sortie dans la première heure. Aucune classe ne dépasse la moitié des pertes : le seuil de la règle du plan n'est pas atteint, d'où « aucune cible dominante ».
- **Les gains rendus sont le prix des grands gagnants.** Les gagnants ne gardent en médiane que 43 % de leur MFE (BTC/ETH), mais protéger plus tôt coûte plus que cela ne rapporte : le stop au point mort après +1 R a un effet net −203 R sur BTC/ETH et −291 R sur les actifs vierges, intervalles excluant zéro des deux côtés. Il coupe 106 gagnants sur BTC/ETH, dont 26 à 5 R ou plus, qui étaient revenus au prix d'entrée avant de partir.
- **Le résultat vient du régime calme.** Somme des ln(1 + rendement) des trades : calme 743 % contre agité −26 % sur BTC/ETH (597 trades agités) ; 738 % contre 24 % sur les actifs vierges. En R : 766 contre −30 (BTC/ETH), 869 contre −94 (vierges). Observation descriptive, non testée : les entrées du jeu agité (stop 1,1 ATR, longs seulement) apportent peu ou rien.

## BTC/ETH (développement)

1311 trades, dont 905 perdants ; somme des pertes −987 R.

| Classe | Trades | Part des trades | ΣR | Part des pertes | R moyen | MFE médiane (R) | MAE médiane (R) | Durée médiane (bougies) | Sortis en ≤ 1 h | Sorties principales |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · sans continuation (MFE < 0,5 R) | 347 | 26 % | −429 | 43 % | −1,24 | 0,22 | −1,00 | 4 | 56 % | SL 100 %, FLIP 0 % |
| B · continuation partielle (0,5 ≤ MFE < 1 R) | 230 | 18 % | −258 | 26 % | −1,12 | 0,71 | −1,00 | 9 | 36 % | SL 92 %, TP1+SL 7 %, FLIP 1 % |
| C · gain rendu (MFE ≥ 1 R) | 328 | 25 % | −301 | 30 % | −0,92 | 1,76 | −1,00 | 21 | 17 % | SL 48 %, TP1+SL 37 %, FLIP 15 % |
| Gagnants (R > 0) | 406 | 31 % | 1723 | — | +4,24 | 5,56 | −0,39 | 68 | 4 % | FLIP 54 %, TP1+TRAIL 45 %, TRAIL 1 % |

MFE des perdants avant la sortie :

| MFE (R) | Perdants | Part des perdants | Part de la somme des pertes |
| --- | ---: | ---: | ---: |
| < 0,25 | 185 | 20 % | 24 % |
| 0,25 à 0,50 | 162 | 18 % | 20 % |
| 0,50 à 1,00 | 230 | 25 % | 26 % |
| 1,00 à 2,00 | 194 | 21 % | 19 % |
| 2,00 à 3,00 | 83 | 9 % | 7 % |
| ≥ 3,00 | 51 | 6 % | 4 % |

**Gagnants** (406) : ΣR 1723 R pour une somme de MFE de 3130 R ; taux de capture médian 43 % ; gain rendu total 1407 R (médiane 3,13 R par trade). « Gros gain rendu » (MFE ≥ 2 R et R < 1 R) : 102 trades, 303 R rendus.

**Stop au point mort après +1 R** (approximation de premier ordre, trade par trade) :

|  | Valeur | IC 95 % (bootstrap par mois) |
| --- | ---: | ---: |
| Trades ayant touché +1 R | 724 (55 %) |  |
| … puis revenus au prix d'entrée avant la sortie | 368 |  |
| Perdants ramenés au point mort | 262 |  |
| Gagnants coupés au point mort (dont R ≥ 5) | 106 (26) |  |
| R récupérés sur les perdants | +228 | +198 à +259 |
| R perdus sur les gagnants | −431 | −583 à −303 |
| Effet net | −203 R (−27,6 % de ΣR) | −365 à −67 |

Découpages (part de la somme des pertes par classe ; effet net du contrefactuel) :

| actif | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| BTC | 644 | 441 | 46 % | 26 % | 28 % | −129 | 387 | 278 % |
| ETH | 667 | 464 | 41 % | 26 % | 33 % | −75 | 349 | 439 % |

| sens | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| short | 250 | 178 | 48 % | 26 % | 25 % | −89 | 219 | 258 % |
| long | 1061 | 727 | 42 % | 26 % | 32 % | −114 | 517 | 460 % |

| régime | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| calme (stop 3,3 ATR) | 714 | 492 | 43 % | 27 % | 30 % | −195 | 766 | 743 % |
| agité (stop 1,1 ATR) | 597 | 413 | 44 % | 25 % | 31 % | −8 | −30 | −26 % |

## 8 actifs vierges (réplication)

4722 trades, dont 3431 perdants ; somme des pertes −3658 R.

| Classe | Trades | Part des trades | ΣR | Part des pertes | R moyen | MFE médiane (R) | MAE médiane (R) | Durée médiane (bougies) | Sortis en ≤ 1 h | Sorties principales |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A · sans continuation (MFE < 0,5 R) | 1474 | 31 % | −1756 | 48 % | −1,19 | 0,19 | −1,02 | 4 | 52 % | SL 99 %, FLIP 1 % |
| B · continuation partielle (0,5 ≤ MFE < 1 R) | 719 | 15 % | −786 | 21 % | −1,09 | 0,72 | −1,02 | 11 | 32 % | SL 89 %, FLIP 6 %, TP1+SL 5 % |
| C · gain rendu (MFE ≥ 1 R) | 1238 | 26 % | −1117 | 31 % | −0,90 | 1,77 | −1,02 | 33 | 15 % | SL 53 %, TP1+SL 31 %, FLIP 15 %, TP1+TRAIL 1 % |
| Gagnants (R > 0) | 1291 | 27 % | 4433 | — | +3,43 | 5,20 | −0,44 | 61 | 8 % | FLIP 54 %, TP1+TRAIL 44 %, TRAIL 2 %, REV 0 % |

MFE des perdants avant la sortie :

| MFE (R) | Perdants | Part des perdants | Part de la somme des pertes |
| --- | ---: | ---: | ---: |
| < 0,25 | 911 | 27 % | 30 % |
| 0,25 à 0,50 | 563 | 16 % | 18 % |
| 0,50 à 1,00 | 719 | 21 % | 21 % |
| 1,00 à 2,00 | 764 | 22 % | 19 % |
| 2,00 à 3,00 | 323 | 9 % | 8 % |
| ≥ 3,00 | 151 | 4 % | 4 % |

**Gagnants** (1291) : ΣR 4433 R pour une somme de MFE de 9067 R ; taux de capture médian 40 % ; gain rendu total 4634 R (médiane 3,10 R par trade). « Gros gain rendu » (MFE ≥ 2 R et R < 1 R) : 325 trades, 977 R rendus.

**Stop au point mort après +1 R** (approximation de premier ordre, trade par trade) :

|  | Valeur | IC 95 % (bootstrap par mois) |
| --- | ---: | ---: |
| Trades ayant touché +1 R | 2509 (53 %) |  |
| … puis revenus au prix d'entrée avant la sortie | 1440 |  |
| Perdants ramenés au point mort | 1044 |  |
| Gagnants coupés au point mort (dont R ≥ 5) | 396 (73) |  |
| R récupérés sur les perdants | +932 | +844 à +1027 |
| R perdus sur les gagnants | −1223 | −1447 à −1007 |
| Effet net | −291 R (−37,6 % de ΣR) | −532 à −67 |

Découpages (part de la somme des pertes par classe ; effet net du contrefactuel) :

| actif | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| XRP | 589 | 424 | 44 % | 22 % | 34 % | −42 | 184 | 193 % |
| BNB | 627 | 461 | 49 % | 21 % | 30 % | −68 | 72 | 101 % |
| DOGE | 555 | 419 | 52 % | 19 % | 30 % | +30 | 75 | 104 % |
| TRX | 567 | 412 | 46 % | 20 % | 34 % | −23 | 3 | 36 % |
| ADA | 626 | 454 | 53 % | 20 % | 28 % | −64 | 173 | 114 % |
| LINK | 523 | 371 | 47 % | 23 % | 31 % | −22 | 113 | 126 % |
| XLM | 575 | 416 | 47 % | 24 % | 29 % | −74 | 135 | 94 % |
| LTC | 660 | 474 | 48 % | 24 % | 28 % | −29 | 21 | −6 % |

| sens | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| long | 3521 | 2572 | 48 % | 22 % | 30 % | −166 | 373 | 355 % |
| short | 1201 | 859 | 47 % | 21 % | 31 % | −125 | 402 | 407 % |

| régime | Trades | Perdants | A | B | C | Contrefactuel net (R) | ΣR | Σ ln(1 + rendement du trade) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| agité (stop 1,1 ATR) | 1935 | 1363 | 52 % | 21 % | 27 % | −117 | −94 | 24 % |
| calme (stop 3,3 ATR) | 2787 | 2068 | 45 % | 22 % | 33 % | −174 | 869 | 738 % |

## Limites

- MFE et MAE du moteur : extrêmes des bougies entières tant que la position est ouverte ; la partie de la bougie de sortie postérieure à l'exécution n'est pas comptée.
- Contrefactuel : trajet intrabarre supposé du moteur, bougie de sortie réduite à son ouverture, aucune nouvelle entrée rejouée après une sortie plus précoce. Il ne remplace pas une simulation complète d'une règle de sortie, qui exigerait un plan séparé et une extension du simulateur (le moteur ne connaît pas de stop au point mort).
- BTC/ETH : données de développement. Aucun test prospectif.

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | lib/strategies/shock/market.ts |
| empreinte lib/strategies/shock/strategy.ts | OK | lib/strategies/shock/strategy.ts |
| empreinte lib/strategies/shock/broker.ts | OK | lib/strategies/shock/broker.ts |
| empreinte lib/strategies/shock/engine.ts | OK | lib/strategies/shock/engine.ts |
| empreinte research/lib/frozen-shock.ts | OK | research/lib/frozen-shock.ts |
| empreinte research/lib/e2.ts | OK | research/lib/e2.ts |
| BTC/ETH : 1 311 trades de référence | OK | 1311 |
| BTC/ETH (développement) : MFE ≥ 0 et MAE ≤ 0 | OK | 1311 trades |
| 8 actifs vierges (réplication) : MFE ≥ 0 et MAE ≤ 0 | OK | 4722 trades |

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/loss-anatomy.ts
```
