# Shock Engine — exécutabilité des ordres à 500 k$ et 1 M$

> **Mise à jour du 2026-10-13 — règles publiées (entrées en régime calme seulement).** Les résultats
> `fills-500k-1m.json` et `fills-2m-5m.json` ont été recalculés sur les règles publiées, protocole
> inchangé. Les sections suivantes, rédigées le 2026-10-12, décrivent le calcul sur les règles
> précédentes (deux régimes, 2 474 exécutions) ; elles restent comme trace. Chiffres des règles publiées :
>
> - **1 150 exécutions** (BTC 600, ETH 550) : 575 entrées (300 / 275), 222 fermetures sur choc
>   opposé (103 / 119), 353 stops et stops suiveurs (197 / 156), aucune prise de profit partielle.
>   Par année : 148 (2020), 104 (2021), 233 (2022), 249 (2023), 94 (2024), 185 (2025), 137 (2026,
>   janvier–septembre). 805 journées de transactions (BTC 406, ETH 399), sommes SHA-256 vérifiées ;
>   franchissement retrouvé pour les 353 stops ; prix de référence pour 1 149 exécutions.
> - Modèle de coût (0,5 s) : R² 0,41 BTC, 0,32 ETH ; élasticité à la taille 0,82 et 0,70.
> - Rapprochement (bot actuel) : à 500 k$, 1 113 démontrées à < 50 pb (96,8 %), 2 à < 1 %, 35 non
>   démontrées (dont 30 ETH) ; à 1 M$, 1 054 (91,7 %), 8, 88 (dont 63 ETH) ; à 2 M$, 77,8 % à < 50 pb ;
>   à 5 M$, aucune (ordres de 2,5 M$), 54,4 % à < 1 %.
> - Sharpe (Binance, 2020-01 → 2026-09, backtest 2,00) : bot actuel 1,85 / 1,83 / 1,81 / 1,75 à
>   0,5 / 1 / 2 / 5 M$ ; bot livré (entrées à 0,5 s) 1,93 / 1,92 / 1,90 / 1,83 ; entrées et stops à
>   0,5 s 1,95 / 1,94 / 1,91 / 1,85. **Aucun passage sous 1,5 jusqu'à 5 M$**, plus grand capital testé
>   (point à 5 M$ estimé). Gain apparié actuel → livré à 1 M$ : +0,08 [+0,06 ; +0,10].
> - Coût moyen par exécution à 1 M$ : 4,65 pb (bot actuel), 2,27 pb (bot livré), pour un budget de
>   14,7 pb au Sharpe 1,5 (`capacity-report.md`). Décomposition (1 M$, bot actuel, médianes) :
>   demi-spread 0,02 pb, dérive 2,30 pb (entrées : 2,76 BTC, 4,14 ETH), profondeur 0,40 pb.
> - Premier ordre réel de 500 k$ après notre arrivée : 5,7 s (BTC) et 10,7 s (ETH) en médiane.

Rédigé le 2026-10-12. Pré-enregistrement : `research/preregistration/execution-fills-500k-1m.md`
(commité avant tout calcul). Résultats : `fills-500k-1m.json`. Signaux, logique prédictive et
paramètres inchangés.

## Ce qui est démontré, et où

- **Marché observable : Binance USDⓈ-M** (BTCUSDT, ETHUSDT), 2020-01 → 2026-09, **toutes** les
  exécutions du portefeuille E2 : 2 474 (1 097 entrées, 221 fermetures à la clôture, 876 stops et
  stops suiveurs, 280 TP1). 1 226 journées de transactions, à la milliseconde (archives publiques,
  somme SHA-256 vérifiée), aucune journée illisible, prix de référence et franchissement des stops
  retrouvés pour 100 % des exécutions.
- **Méthode** : pour chaque exécution, les ordres agresseurs réels sont reconstitués autour de
  l'arrivée de notre ordre (transactions de même milliseconde et de même côté). Le coût des Q
  premiers dollars d'un ordre réel d'au moins Q $ est **ce qu'un ordre de notre taille a réellement
  payé** à ce moment. S'il n'y en a pas, le coût vient d'un modèle calibré sur les observations
  (log coût ~ taille, volatilité, volume ; R² 0,43 BTC, 0,32 ETH ; élasticité à la taille 0,84 BTC,
  0,72 ETH).
- **Hyperliquid** (marché du bot) : seulement des bornes conditionnelles (dernière section).

## Taux de remplissage

Ordre = moitié du capital (une sleeve sur deux), comme l'étude de capacité. « Démontré » : un ordre
réel d'au moins Q $ est passé dans les ± 2 minutes et ses Q premiers dollars sont restés à moins de
50 pb, soit la limite des ordres du bot (± 0,5 %).

| Exécutions au marché (entrées, fermetures, stops) | 500 k$ (ordre 250 k$) | 1 M$ (ordre 500 k$) |
|---|---|---|
| intégralement exécutables, démontré à < 50 pb | 2 087 / 2 194 (95 %) | 1 957 / 2 194 (89 %) |
| démontré à < 1 % seulement (profondeur `bookDepth`, depuis 2023) | 2 | 19 |
| non démontré (aucun ordre réel de cette taille observé ; coût estimé) | 105 (BTC 10, ETH 95) | 218 (BTC 44, ETH 174) |
| TP1 (ordre limite) : prix passé au-delà du niveau, donc niveau épuisé | 280 / 280 | 280 / 280 |

Aucune exécution n'est démontrée **non** exécutable. Les « non démontrées » sont surtout l'ETH de
2020–2022, où les ordres réels de 250–500 k$ étaient rares. TP1 : dépassement médian du niveau de
32 pb (BTC) et 35 pb (ETH). 15 TP1 sur 280 le dépassent de moins de 5 pb ; les compter non remplis
ne change le Sharpe que de 1,838 à 1,835.

Délai : l'ordre immédiat est exécuté à son arrivée, à T + 5 s pour le bot actuel et T + 0,5 s pour
le bot optimisé (stops : franchissement + 3 s, + 0,5 s). Pour situer la liquidité : après l'arrivée,
le premier ordre réel de 500 k$ passe en médiane 7,4 s plus tard sur BTC et 14 s sur ETH. Le
carnet absorbe donc notre taille immédiatement ; ce ne sont pas des transactions qu'il faudrait
attendre.

## Coûts (pb, par rapport au prix du backtest sur le même marché)

| 1 M$ | P50 | P95 | P99 | moyenne |
|---|---|---|---|---|
| **Bot actuel**, toutes exécutions | 1,73 | 20,8 | 46,6 | 4,24 |
| entrées BTC / ETH | 3,32 / 4,79 | 17,2 / 25,5 | 28,2 / 46,8 | 4,42 / 6,33 |
| stops BTC / ETH | 0,96 / 1,30 | 24,5 / 24,8 | 58,8 / 49,7 | 4,40 / 3,79 |
| **Bot optimisé**, toutes exécutions | 0,71 | 9,1 | 25,6 | 2,11 |
| entrées BTC / ETH | 0,78 / 1,25 | 4,1 / 10,7 | 10,8 / 22,7 | 1,19 / 2,59 |
| stops BTC / ETH | 0,87 / 1,32 | 9,4 / 14,4 | 34,8 / 30,9 | 3,08 / 2,92 |

| 500 k$ | P50 | P95 | P99 | moyenne |
|---|---|---|---|---|
| Bot actuel | 1,45 | 19,3 | 43,5 | 3,76 |
| Bot optimisé | 0,48 | 7,8 | 19,1 | 1,61 |

Décomposition (1 M$, médianes, bot actuel) : demi-spread 0,02 pb, dérive pendant la latence
1,04 pb (entrées : 2,7 BTC, 3,2 ETH), coût immédiat au-delà du meilleur prix 0,41 pb (P95 5,1).
**La latence est le coût dominant, pas l'impact.** Le coût immédiat observé d'un ordre de 500 k$
(BTC 0,30 pb, ETH 0,72 pb en médiane) est très inférieur au modèle racine carrée non calibré de
l'étude de capacité (≈ 3 pb au scénario central).

## Portefeuille recalculé (Binance, fenêtre 2020-01 → 2026-09)

Coûts mesurés appliqués exécution par exécution, et moteur rejoué avec la règle TP1 (signaux
identiques). Les frais du backtest (0,045 % partout) sont conservés ; leur correction est donnée à
part. Intervalles à 90 % par bootstrap des mois (2 000 tirages).

| | Sharpe | CAGR | Sortino | Drawdown max. | P(Sharpe > 1,5) |
|---|---|---|---|---|---|
| Backtest (exécution à la clôture, sans coût) | 1,838 [1,31 ; 2,35] | 55,1 % | 4,06 | −19,0 % | — |
| **500 k$, bot actuel** | 1,575 [1,02 ; 2,10] | 44,7 % | 3,38 | −19,5 % | 62 % |
| 500 k$, bot optimisé (entrées seulement) | 1,703 [1,16 ; 2,22] | 49,7 % | — | — | 76 % |
| 500 k$, bot optimisé (entrées + stops) | 1,733 [1,19 ; 2,25] | 50,6 % | 3,78 | −19,1 % | 78 % |
| **1 M$, bot actuel** | 1,540 [0,98 ; 2,07] | 43,2 % | 3,28 | −19,5 % | 58 % |
| 1 M$, bot optimisé (entrées seulement) | 1,667 [1,12 ; 2,19] | 48,0 % | — | — | 72 % |
| 1 M$, bot optimisé (entrées à 1 s + stops) | 1,662 [1,12 ; 2,18] | 47,6 % | — | — | 71 % |
| 1 M$, bot optimisé (entrées + stops) | 1,697 [1,15 ; 2,21] | 48,9 % | 3,67 | −19,1 % | 75 % |

Écart apparié bot actuel → bot optimisé (mêmes tirages) : **+0,158 de Sharpe** [+0,12 ; +0,19],
positif dans 100 % des tirages, à 500 k$ comme à 1 M$. Entrées seulement : +0,128 [+0,10 ; +0,15].

Correction des frais, séparée : TP1 payé au tarif maker (0,015 % au lieu de 0,045 %) et, à 1 M$,
palier taker 0,040 % (volume sur 14 jours au-delà de 5 M$). Bot actuel : 1,575 → 1,580 à 500 k$,
1,540 → 1,576 à 1 M$.

**Ce qui est livré dans le bot aujourd'hui** correspond à la ligne « entrées seulement » : la
lecture et l'ordre à la clôture ne prennent plus que deux allers-retours réseau. Les stops restent
des stops natifs de Hyperliquid, déclenchés sur le prix mark. Un stop géré par le bot sur le
dernier prix échangé apporterait les +0,03 restants ; il n'est pas codé.

Décomposition à 1 M$ :

| Étape | Sharpe | Nature |
|---|---|---|
| Backtest | 1,838 | référence |
| + TP1 seulement si le prix passe au-delà | 1,838 | correction d'hypothèse (sans effet) |
| + coûts réels du bot actuel (5 s, stops + 3 s) | 1,540 | **correction d'hypothèse** (−0,30) |
| + frais réels (maker, palier) | 1,576 | correction de frais (+0,04) |
| bot actuel → entrées à 0,5 s | 1,667 | **gain d'ingénierie livré** (+0,13) |
| → stops gérés à 0,5 s | 1,697 | gain possible, non codé (+0,03) |

## Capacité (Sharpe ≥ 1,5)

Même calcul à 2 M$ et 5 M$ (`fills-2m-5m.json`). À 5 M$, les ordres de 2,5 M$ dépassent la plus
grande taille observée directement (2 M$) : seuls 6 % des exécutions sont démontrées à < 50 pb et
47 % à < 1 %. Le résultat est une **estimation**, pas une démonstration.

| Sharpe (Binance) | 500 k$ | 1 M$ | 2 M$ | 5 M$ (estimé) | Capacité au Sharpe 1,5 |
|---|---|---|---|---|---|
| bot actuel | 1,575 | 1,540 | 1,485 | 1,324 | ≈ 1,7 M$ |
| bot optimisé, entrées (livré) | 1,703 | 1,667 | 1,614 | 1,452 | ≈ 3,8 M$ |
| bot optimisé, entrées + stops | 1,733 | 1,697 | 1,644 | 1,483 | ≈ 4,5 M$ |

Exécutions démontrées intégralement à < 50 pb : 95 % à 500 k$, 89 % à 1 M$, 74 % à 2 M$, 6 % à 5 M$.

Sur Hyperliquid, un carnet ρ fois moins profond équivaut, pour le coût immédiat, à un capital
1 / ρ fois plus grand (la dérive ne dépend pas de la taille). Capacité du bot livré : ≈ 1,9 M$ si
ρ = 0,5, ≈ 1 M$ si ρ = 0,25.

## Hyperliquid : bornes conditionnelles

La dérive est supposée identique à celle de Binance pour le même délai. Le coût immédiat est celui
d'un ordre Binance Q / ρ fois plus gros, ρ = profondeur Hyperliquid / profondeur Binance.

| Sharpe à 1 M$ | ρ = 1 | ρ = 0,5 | ρ = 0,25 |
|---|---|---|---|
| bot actuel | 1,540 | 1,485 [0,92 ; 2,02] | 1,391 [0,81 ; 1,94] |
| bot optimisé (entrées + stops) | 1,697 | 1,644 [1,09 ; 2,16] | 1,549 [0,98 ; 2,07] |
| P(Sharpe > 1,5), bot optimisé | 75 % | 69 % | 57 % |

À 500 k$, ρ = 0,5 : actuel 1,540, optimisé 1,697 ; ρ = 0,25 : 1,485 et 1,644.

**Ce qui manque pour une démonstration sur Hyperliquid :**

1. Le carnet historique de Hyperliquid aux instants des signaux. Il n'existe pas d'archive gratuite.
   Sources possibles, à vérifier avant achat : l'archive S3 de Hyperliquid (payée par le
   demandeur) ou Tardis (payant).
2. Les transactions historiques de Hyperliquid à la milliseconde, pour mesurer la dérive sur
   Hyperliquid même et non sur Binance (avance ou retard d'un marché sur l'autre).
3. L'historique du prix mark : les stops de Hyperliquid se déclenchent dessus. Le « + 3 s » du bot
   actuel est une hypothèse.
4. ρ aux instants de choc : il se mesure à partir de maintenant, avec la sonde de clôture installée
   sur le serveur du bot, qui voit aussi Binance.
5. Les fills réels du bot à taille significative : seule mesure de l'effet de nos propres ordres.

## Limites

- Les ordres réels de grande taille sont un échantillon choisi par le marché : ils passent quand la
  liquidité le permet. Le coût de leurs premiers dollars peut sous-estimer celui d'un ordre envoyé
  à heure fixe dans un carnet mince. Pour les exécutions sans ordre réel observé, le coût est estimé.
- Impact permanent sur les sorties suivantes et adaptation des teneurs de marché à un flux
  détectable : non mesurés.
- La stratégie reste évaluée sur sa période de conception ; ces résultats portent sur l'exécution,
  pas sur l'alpha.
