# Architecture du régime agité du Shock Engine

Plan : `research/preregistration/agitated-regime.md`, commité avant toute simulation de variante. Script : `research/shock/agitated-regime.ts` (commit `4742db1`). Moteur non modifié. **Exploratoire** : BTC/ETH sont les données de développement et le découpage par régime des 8 cryptos avait déjà été consulté ; aucun résultat n'est confirmatoire.

## Réponse

- **V1 · sans entrées en régime agité** : Δ Sharpe BTC/ETH +0,147 (IC 95 % −0,003 à +0,285) ; Δ moyen 8 cryptos +0,015 (IC 90 % −0,099 à +0,117), 5/8 améliorées ; coûts × 2 : +0,268 et +0,099 → **pas de candidate**.
- **V2a · stop agité 3,3 ATR, taille inchangée** : Δ Sharpe BTC/ETH −0,018 (IC 95 % −0,169 à +0,143) ; Δ moyen 8 cryptos −0,025 (IC 90 % −0,102 à +0,060), 4/8 améliorées ; coûts × 2 : +0,015 et +0,003 → **pas de candidate**.
- **V2b · stop agité 3,3 ATR, même risque monétaire** : Δ Sharpe BTC/ETH +0,120 (IC 95 % +0,022 à +0,217) ; Δ moyen 8 cryptos +0,025 (IC 90 % −0,051 à +0,101), 5/8 améliorées ; coûts × 2 : +0,208 et +0,083 → **pas de candidate**.

Hypothèses (lecture du § 6) : A (pas d'alpha de continuation en régime agité) **non soutenue** ; B (stop trop serré) **indices, non démontrée** ; C (combinaison des réglages) n'est pas testée directement.

## Lecture

- **Sur BTC/ETH, le régime agité coûte.** Sans ses entrées (V1), le portefeuille passe d'un Sharpe 1,88 à 2,02, d'un CAGR 61,6 % à 67,7 % et d'un drawdown −19,1 % à −17,8 %, avec 98 % des meilleurs trades conservés. L'écart vient surtout d'ETH (Δ Sharpe +0,18) plus que de BTC (−0,00). Élargir le stop à risque égal (V2b) donne presque autant : Sharpe 2,00, drawdown −17,7 %.
- **Ce n'est pas transportable.** Sur les 8 cryptos, les écarts de Sharpe vont de −0,40 à +0,26 pour V1 (moyenne +0,015) et de −0,19 à +0,18 pour V2b (moyenne +0,025) ; V1 n'y conserve que 83 % des meilleurs trades : sur ces actifs, une partie des plus grands gains naît en régime agité.
- **A : il y a de la continuation en régime agité**, plus faible que dans le calme sur BTC/ETH (moyenne à 64 bougies +0,65 ATR contre +1,86), comparable sur les 8 cryptos (+1,05 contre +0,94). Les médianes sont proches de zéro ou négatives : elle tient à une minorité de grands mouvements.
- **B : le stop serré coupe des trades qui repartent.** 64 bougies après un stop, le prix est au-delà de +1,1 ATR pour 28 % des trades agités stoppés contre 20 % des calmes (BTC/ETH ; 33 % contre 20 % sur les 8 cryptos). Mais élargir le stop à risque égal n'améliore pas les 8 cryptos de façon démontrable.
- **Conclusion.** Le coût du régime agité se concentre sur ETH (Δ Sharpe de V1 +0,18) ; sur BTC, l'actif sur lequel le jeu agité a été choisi (`research/reports/shock-15m-regimes-vol.md`), il est neutre (−0,00), et sur les 8 cryptos il change de signe d'un actif à l'autre. Rien n'indique un défaut général de l'architecture du régime agité ; aucune variante n'est candidate et V0 reste la référence.

## Diagnostics (V0, longs)

### BTC/ETH

**D1 · Continuation après le signal**, d·(P_{t+h} − P_t) / ATR d'entrée, indépendante des sorties (moyenne, IC 95 % bootstrap par mois ; médiane ; part > 0) :

| Régime | Trades | 1 bougie | 4 bougies | 16 bougies | 64 bougies |
| --- | ---: | ---: | ---: | ---: | ---: |
| calme (stop 3,3 ATR) | 464 | +0,21 [+0,02 ; +0,44] · méd. +0,00 · 50 % | +0,52 [+0,17 ; +0,89] · méd. +0,06 · 51 % | +0,57 [+0,13 ; +0,99] · méd. +0,07 · 51 % | +1,86 [+0,77 ; +2,94] · méd. +0,83 · 53 % |
| agité (stop 1,1 ATR) | 597 | +0,05 [−0,05 ; +0,17] · méd. −0,02 · 48 % | +0,12 [−0,06 ; +0,30] · méd. −0,06 · 48 % | +0,14 [−0,15 ; +0,44] · méd. −0,35 · 46 % | +0,65 [+0,04 ; +1,23] · méd. −0,20 · 49 % |

**D2 · Après le stop initial** (trades sortis au stop seul) : position du prix 16 et 64 bougies après la sortie, en ATR d'entrée depuis le prix d'entrée :

| Régime | Trades stoppés | Horizon | Médiane | Au-delà de +1,1 ATR | Au-delà de +3,3 ATR |
| --- | ---: | ---: | ---: | ---: | ---: |
| calme (stop 3,3 ATR) | 284 | +16 bougies | −2,80 | 8 % | 4 % |
| calme (stop 3,3 ATR) | 284 | +64 bougies | −3,25 | 20 % | 11 % |
| agité (stop 1,1 ATR) | 275 | +16 bougies | −1,50 | 14 % | 4 % |
| agité (stop 1,1 ATR) | 275 | +64 bougies | −1,84 | 28 % | 19 % |

**D3 · Excursions en ATR d'entrée** (quartiles 25 / 50 / 75 %) :

| Régime | MFE (ATR) | MAE (ATR) |
| --- | ---: | ---: |
| calme (stop 3,3 ATR) | 1,60 / 4,54 / 13,77 | −3,30 / −3,30 / −1,78 |
| agité (stop 1,1 ATR) | 0,54 / 1,44 / 3,73 | −1,10 / −1,10 / −0,91 |

### 8 cryptos

**D1 · Continuation après le signal**, d·(P_{t+h} − P_t) / ATR d'entrée, indépendante des sorties (moyenne, IC 95 % bootstrap par mois ; médiane ; part > 0) :

| Régime | Trades | 1 bougie | 4 bougies | 16 bougies | 64 bougies |
| --- | ---: | ---: | ---: | ---: | ---: |
| calme (stop 3,3 ATR) | 1586 | +0,16 [+0,04 ; +0,30] · méd. −0,05 · 48 % | +0,25 [+0,06 ; +0,48] · méd. −0,19 · 46 % | +0,38 [+0,04 ; +0,76] · méd. −0,28 · 46 % | +0,94 [+0,43 ; +1,51] · méd. −0,02 · 50 % |
| agité (stop 1,1 ATR) | 1935 | +0,04 [−0,02 ; +0,10] · méd. −0,12 · 44 % | +0,11 [+0,00 ; +0,21] · méd. −0,15 · 47 % | +0,19 [−0,01 ; +0,37] · méd. −0,15 · 48 % | +1,05 [+0,47 ; +1,56] · méd. +0,14 · 51 % |

**D2 · Après le stop initial** (trades sortis au stop seul) : position du prix 16 et 64 bougies après la sortie, en ATR d'entrée depuis le prix d'entrée :

| Régime | Trades stoppés | Horizon | Médiane | Au-delà de +1,1 ATR | Au-delà de +3,3 ATR |
| --- | ---: | ---: | ---: | ---: | ---: |
| calme (stop 3,3 ATR) | 1074 | +16 bougies | −3,10 | 9 % | 3 % |
| calme (stop 3,3 ATR) | 1074 | +64 bougies | −3,27 | 20 % | 12 % |
| agité (stop 1,1 ATR) | 935 | +16 bougies | −1,27 | 19 % | 8 % |
| agité (stop 1,1 ATR) | 935 | +64 bougies | −1,30 | 33 % | 21 % |

**D3 · Excursions en ATR d'entrée** (quartiles 25 / 50 / 75 %) :

| Régime | MFE (ATR) | MAE (ATR) |
| --- | ---: | ---: |
| calme (stop 3,3 ATR) | 1,22 / 3,65 / 9,88 | −3,35 / −3,33 / −2,41 |
| agité (stop 1,1 ATR) | 0,38 / 1,39 / 3,81 | −1,19 / −1,13 / −1,01 |

## Variantes rejouées en portefeuille complet

Coûts × 1 sauf mention. Temps en position et exposition brute (notionnel / equity) : moyenne des sleeves. Meilleurs trades : les 5 % meilleurs rendements de V0, retrouvés à la même bougie d'entrée et dans le même sens ; part de leur rendement cumulé (ln) conservée.

### BTC/ETH, portefeuille 50/50 sans rebalancement

| Variante | Sharpe | CAGR | Drawdown max. | Rendement total | PF | Trades | dont agités | Temps en position | Exposition brute moy. | Meilleurs trades conservés · rendement conservé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,88 | 61,6 % | −19,1 % | 4748 % | 1,96 | 1311 | 597 | 17 % | 0,16 | 100 % · 100 % |
| V1 · sans entrées en régime agité | 2,02 | 67,7 % | −17,8 % | 6436 % | 2,46 | 716 | 0 | 15 % | 0,15 | 98 % · 99 % |
| V2a · stop agité 3,3 ATR, taille inchangée | 1,86 | 65,0 % | −20,9 % | 5625 % | 1,87 | 1227 | 515 | 19 % | 0,17 | 100 % · 100 % |
| V2b · stop agité 3,3 ATR, même risque monétaire | 2,00 | 66,9 % | −17,7 % | 6180 % | 2,20 | 1227 | 515 | 19 % | 0,16 | 100 % · 100 % |

| Variante | Sharpe coûts × 2 | CAGR coûts × 2 | Drawdown coûts × 2 |
| --- | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,61 | 50,2 % | −20,7 % |
| V1 · sans entrées en régime agité | 1,88 | 61,2 % | −19,7 % |
| V2a · stop agité 3,3 ATR, taille inchangée | 1,62 | 54,1 % | −22,7 % |
| V2b · stop agité 3,3 ATR, même risque monétaire | 1,82 | 58,9 % | −19,4 % |

### BTC seul (2017 → 2026)

| Variante | Sharpe | CAGR | Drawdown max. | Rendement total | PF | Trades | dont agités | Temps en position | Exposition brute moy. | Meilleurs trades conservés · rendement conservé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,52 | 42,9 % | −22,3 % | 3160 % | 1,87 | 774 | 378 | 15 % | 0,14 | 100 % · 100 % |
| V1 · sans entrées en régime agité | 1,52 | 41,0 % | −24,8 % | 2754 % | 2,27 | 396 | 0 | 14 % | 0,13 | 100 % · 100 % |
| V2a · stop agité 3,3 ATR, taille inchangée | 1,53 | 44,7 % | −24,7 % | 3569 % | 1,80 | 724 | 330 | 17 % | 0,16 | 100 % · 100 % |
| V2b · stop agité 3,3 ATR, même risque monétaire | 1,56 | 42,7 % | −24,7 % | 3112 % | 2,07 | 724 | 330 | 17 % | 0,14 | 100 % · 100 % |

### ETH seul (2018-09 → 2026)

| Variante | Sharpe | CAGR | Drawdown max. | Rendement total | PF | Trades | dont agités | Temps en position | Exposition brute moy. | Meilleurs trades conservés · rendement conservé |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 1,75 | 72,2 % | −26,8 % | 7986 % | 2,05 | 667 | 311 | 18 % | 0,17 | 100 % · 100 % |
| V1 · sans entrées en régime agité | 1,93 | 80,0 % | −24,1 % | 11490 % | 2,68 | 358 | 0 | 17 % | 0,16 | 100 % · 100 % |
| V2a · stop agité 3,3 ATR, taille inchangée | 1,77 | 76,5 % | −27,3 % | 9774 % | 1,97 | 619 | 263 | 20 % | 0,19 | 100 % · 100 % |
| V2b · stop agité 3,3 ATR, même risque monétaire | 1,90 | 78,9 % | −25,2 % | 10901 % | 2,35 | 619 | 263 | 20 % | 0,17 | 100 % · 100 % |

### 8 cryptos (transportabilité)

| Actif | Sharpe V0 | Sharpe V1 | Sharpe V2a | Sharpe V2b | Δ V1 | Δ V2a | Δ V2b |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| XRP | 0,78 | 0,72 | 0,78 | 0,77 | −0,05 | +0,00 | −0,01 |
| BNB | 0,58 | 0,84 | 0,54 | 0,77 | +0,26 | −0,04 | +0,18 |
| DOGE | 0,53 | 0,14 | 0,58 | 0,35 | −0,40 | +0,05 | −0,19 |
| TRX | 0,30 | 0,32 | 0,34 | 0,34 | +0,02 | +0,04 | +0,04 |
| ADA | 0,57 | 0,40 | 0,53 | 0,46 | −0,17 | −0,03 | −0,11 |
| LINK | 0,68 | 0,82 | 0,56 | 0,75 | +0,14 | −0,12 | +0,07 |
| XLM | 0,51 | 0,58 | 0,56 | 0,59 | +0,08 | +0,05 | +0,09 |
| LTC | 0,13 | 0,37 | −0,01 | 0,26 | +0,24 | −0,14 | +0,13 |

| Moyenne sur 8 cryptos | Sharpe | CAGR | Drawdown max. | PF | Trades | dont agités | Temps en position | Exposition brute moy. | Meilleurs trades conservés |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| V0 · E2 inchangé | 0,51 | 14,7 % | −53,4 % | 1,26 | 590 | 242 | 16 % | 0,15 | 100 % |
| V1 · sans entrées en régime agité | 0,52 | 13,7 % | −49,7 % | 1,35 | 348 | 0 | 15 % | 0,14 | 83 % |
| V2a · stop agité 3,3 ATR, taille inchangée | 0,48 | 14,2 % | −58,0 % | 1,23 | 555 | 207 | 17 % | 0,16 | 98 % |
| V2b · stop agité 3,3 ATR, même risque monétaire | 0,53 | 14,4 % | −50,1 % | 1,30 | 555 | 207 | 17 % | 0,15 | 98 % |

## Limites

- Exploratoire : aucune donnée vierge. Une candidate devrait être validée en forward (shadow) avec un plan séparé.
- V2a et V2b ne changent que `atrStopMult` du jeu agité ; le TP1 (0,9 ATR sur 20 %) et le stop suiveur (3,2 ATR) restent ceux du jeu agité, ce qui fait partie de l'hypothèse C.
- D1 et D2 mesurent des prix bruts (longs seulement) : ils incluent la dérive haussière des marchés, la même pour les deux régimes.

## Contrôles

| Contrôle | Résultat | Détail |
| --- | ---: | ---: |
| empreinte lib/strategies/shock/market.ts | OK | lib/strategies/shock/market.ts |
| empreinte lib/strategies/shock/strategy.ts | OK | lib/strategies/shock/strategy.ts |
| empreinte lib/strategies/shock/broker.ts | OK | lib/strategies/shock/broker.ts |
| empreinte lib/strategies/shock/engine.ts | OK | lib/strategies/shock/engine.ts |
| empreinte lib/strategies/shock/params.ts | OK | lib/strategies/shock/params.ts |
| empreinte lib/strategies/shock/presets.ts | OK | lib/strategies/shock/presets.ts |
| empreinte research/lib/frozen-shock.ts | OK | research/lib/frozen-shock.ts |
| empreinte research/lib/e2.ts | OK | research/lib/e2.ts |
| BTC : boucle à taille par jeu = simulate() | OK | max |Δequity| 0 |
| XRP : boucle à taille par jeu = simulate() | OK | max |Δequity| 0 |
| BTC : V2b = V2a hors taille | OK | 724 positions |
| ETH : V2b = V2a hors taille | OK | 619 positions |
| XRP : V2b = V2a hors taille | OK | 563 positions |
| BNB : V2b = V2a hors taille | OK | 583 positions |
| DOGE : V2b = V2a hors taille | OK | 524 positions |
| TRX : V2b = V2a hors taille | OK | 537 positions |
| ADA : V2b = V2a hors taille | OK | 590 positions |
| LINK : V2b = V2a hors taille | OK | 482 positions |
| XLM : V2b = V2a hors taille | OK | 540 positions |
| LTC : V2b = V2a hors taille | OK | 623 positions |
| BTC : V0 = trades du portefeuille E2 publié | OK | 644 / 644 |
| ETH : V0 = trades du portefeuille E2 publié | OK | 667 / 667 |
| BTC/ETH : Sharpe de V0 = Sharpe publié | OK | 1.877566513286129 / 1.877566513 |

## Reproduire

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON research/shock/agitated-regime.ts
```
