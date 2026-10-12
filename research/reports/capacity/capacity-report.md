# Capacité institutionnelle du Shock Engine — P0 et P1 (données gratuites)

Protocole pré-enregistré : `research/preregistration/capacity-p0p1.md`. Simulation historique, aucune
exécution réelle. Rapport complet avec graphiques : `capacity-report.html`.

## En bref

- Fenêtre 2020-01-01 → 2026-09-30 (2465 jours), là où les perpétuels Binance existent. Sharpe du portefeuille sans coût ajouté : 1,84, CAGR 55,1 %. Commission de 0,045 % par exécution déjà dans le backtest et jamais comptée deux fois.
- Budget de coûts : le Sharpe reste ≥ 1,5 tant que le coût ajouté moyen ne dépasse pas 5,3 pb par exécution, et ≥ 1,0 jusqu'à 13,1 pb. L'histoire elle-même est incertaine : même sans coût, 14 % des historiques rééchantillonnés ont un Sharpe < 1,5.
- Coût du délai, indépendant de la taille (mesuré) : dans les 2 secondes qui suivent la clôture du signal, le perpétuel a déjà bougé de 1,4 pb (BTC) et 2,7 pb (ETH) dans le sens du trade, en moyenne. Le backtest, qui exécute au prix de clôture, ne le paie pas.
- Capacité (estimée par modèle, impact non calibré) : à 1 M$, Sharpe net 1,42 dans le scénario central, 1,53 en optimiste, 0,68 en prudent. À 5 M$ : 1,13, 1,37 et −0,13.
- L'avantage statistique (borne basse à 90 % du Sharpe au-dessus de 0) se perd vers 20 M$ dans le scénario central, 78 M$ en optimiste et 1,16 M$ en prudent. Le seuil de Sharpe 1,5 est franchi bien plus tôt : 366 k$ (central), avec un intervalle très large ; ce seuil dépend surtout de l'hypothèse de délai : 1,44 M$ si l'ordre part 2 s après la clôture au lieu d'être étalé sur la première minute (variante exploratoire).
- Limite de liquidité la plus contraignante (observée) : les stops. À 5 M$, l'ordre de stop dépasse 10 % du volume de la minute du déclenchement dans 44 % des cas, et tout le volume de cette minute dans 6 % des cas.

## Statut des résultats

| Statut | Contenu |
|---|---|
| Démontré (données, reproductible) | Budget de coûts et sensibilité de la performance à chaque famille d'exécutions ; poids des 5 % meilleurs trades. Volume réel du perpétuel autour de chaque exécution, participation, durée d'exécution en POV, part des stops plus gros que le volume d'une minute. Dérive du prix après la décision, de 1 s à 15 min. Demi-spread effectif (≈ 0,01 à 0,03 pb). Jours où la profondeur à ±1 % s'effondre. |
| Estimé par modèle | Impact de marché (loi en racine carrée, Y = 0,5 / 1 / 2 non calibré sur ce marché), donc coût total, CAGR et Sharpe nets par capital, et capitaux seuils. Coût d'une exécution étalée sur plusieurs minutes. Poursuite après stop au-delà du pilote. |
| À valider en réel | Impact réel des ordres de 250 k$ à 2,5 M$, réaction des teneurs de marché à un flux régulier, glissement des stops dans les vrais chocs, latence réelle du bot, écart entre marché de signal et marché d'exécution sur la performance nette, et performance hors échantillon. |

## Courbe de capacité (exécution POV 10 %)

### Optimiste (Y = 0,5)

| Capital | Coût moyen / exécution | dont entrées · stops | Frein annuel | Sharpe net [90 %] | CAGR net [90 %] | Sortino | Drawdown max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 k$ | 3,8 pb | 6,3 · 0,5 | 6,1 % | 1,59 [1,04 ; 2,12] | 44,6 % [24 % ; 74 %] | 3,43 | −19,6 % |
| 250 k$ | 4,0 pb | 6,5 · 0,8 | 6,5 % | 1,57 [1,03 ; 2,11] | 44,1 % [24 % ; 74 %] | 3,40 | −19,7 % |
| 500 k$ | 4,3 pb | 6,9 · 1,1 | 7,0 % | 1,55 [1,01 ; 2,09] | 43,3 % [23 % ; 73 %] | 3,35 | −19,8 % |
| 1,00 M$ | 4,8 pb | 7,4 · 1,6 | 7,7 % | 1,53 [0,97 ; 2,06] | 42,1 % [22 % ; 71 %] | 3,28 | −19,9 % |
| 5,00 M$ | 7,1 pb | 10,1 · 3,6 | 11,4 % | 1,37 [0,80 ; 1,92] | 35,7 % [16 % ; 63 %] | 2,89 | −20,4 % |

### Central (Y = 1)

| Capital | Coût moyen / exécution | dont entrées · stops | Frein annuel | Sharpe net [90 %] | CAGR net [90 %] | Sortino | Drawdown max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 k$ | 4,3 pb | 6,8 · 1,0 | 7,0 % | 1,55 [1,00 ; 2,09] | 43,2 % [23 % ; 73 %] | 3,34 | −19,8 % |
| 250 k$ | 4,8 pb | 7,3 · 1,6 | 7,8 % | 1,52 [0,97 ; 2,06] | 41,9 % [22 % ; 71 %] | 3,26 | −19,9 % |
| 500 k$ | 5,5 pb | 8,0 · 2,3 | 8,8 % | 1,48 [0,92 ; 2,02] | 40,3 % [21 % ; 69 %] | 3,15 | −20,0 % |
| 1,00 M$ | 6,4 pb | 9,1 · 3,2 | 10,3 % | 1,42 [0,85 ; 1,96] | 37,9 % [19 % ; 66 %] | 3,00 | −20,2 % |
| 5,00 M$ | 10,6 pb | 13,8 · 7,1 | 17,1 % | 1,13 [0,53 ; 1,70] | 27,3 % [10 % ; 53 %] | 2,29 | −25,4 % |

### Prudent (Y = 2)

| Capital | Coût moyen / exécution | dont entrées · stops | Frein annuel | Sharpe net [90 %] | CAGR net [90 %] | Sortino | Drawdown max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 k$ | 10,5 pb | 9,0 · 13,9 | 17,0 % | 1,14 [0,54 ; 1,72] | 28,8 % [10 % ; 56 %] | 2,32 | −23,6 % |
| 250 k$ | 12,2 pb | 10,7 · 15,6 | 19,8 % | 1,02 [0,42 ; 1,61] | 24,8 % [7 % ; 51 %] | 2,04 | −26,3 % |
| 500 k$ | 14,2 pb | 12,8 · 17,6 | 23,0 % | 0,88 [0,26 ; 1,47] | 20,3 % [4 % ; 45 %] | 1,72 | −29,2 % |
| 1,00 M$ | 17,1 pb | 15,9 · 20,3 | 27,6 % | 0,68 [0,05 ; 1,30] | 14,4 % [−1 % ; 38 %] | 1,29 | −36,0 % |
| 5,00 M$ | 29,5 pb | 29,0 · 31,8 | 47,7 % | −0,13 [−0,78 ; 0,61] | −5,7 % [−19 % ; 13 %] | −0,22 | −65,9 % |

### Capital à partir duquel chaque critère est atteint

| Scénario | Sharpe < 1,5 | Sharpe < 1,0 | Avantage perdu |
|---|---:|---:|---:|
| Optimiste (Y = 0,5) | 1,51 M$ [50 k$ ; 39 M$] | 30 M$ [599 k$ ; > 100 M$] | 78 M$ |
| Central (Y = 1) | 366 k$ [50 k$ ; 10 M$] | 7,77 M$ [107 k$ ; 36 M$] | 20 M$ |
| Prudent (Y = 2) | 50 k$ [50 k$ ; 444 k$] | 278 k$ [50 k$ ; 2,35 M$] | 1,16 M$ |

Variantes exploratoires (non pré-enregistrées) :

| Variante | Sharpe < 1,5 | Sharpe < 1,0 | Avantage perdu |
|---|---:|---:|---|
| Central, délai 2 s | 1,44 M$ | 12 M$ | 29 M$ |
| Optimiste, délai 2 s | 5,75 M$ | 49 M$ | > 100 M$ |
| Prudent, poursuite après stop mesurée trade par trade | 50 k$ | 695 k$ | 1,98 M$ |

## Budget de coûts (P0)

| Coût appliqué à… | Perte de Sharpe par pb | Sharpe 1,5 | Sharpe 1,0 | Sharpe 0 | Période officielle |
|---|---:|---|---|---|---|
| Toutes les exécutions | −0,064 [−0,075 ; −0,055] | 5,3 pb [0,0 pb ; 14,5 pb] | 13,1 pb [4,3 pb ; 23,5 pb] | 28,8 pb | 6,3 pb · 14,7 pb |
| Ordres au marché et stops (sans TP1) | −0,062 [−0,073 ; −0,053] | 5,4 pb [0,0 pb ; 14,9 pb] | 13,4 pb [4,4 pb ; 24,1 pb] | 29,6 pb | 6,5 pb · 15,1 pb |
| Entrées seules | −0,032 [−0,037 ; −0,027] | 10,7 pb [0,0 pb ; 29,4 pb] | 26,3 pb [8,7 pb ; 46,9 pb] | 57,3 pb | 12,9 pb · 29,6 pb |
| Stops et stops suiveurs seuls | −0,024 [−0,029 ; −0,020] | 14,0 pb [0,0 pb ; 38,7 pb] | 34,8 pb [10,9 pb ; 54,5 pb] | au-delà de la grille | 16,8 pb · 39,3 pb |
| Sorties à la clôture seules | −0,007 [−0,008 ; −0,006] | 50,8 pb [0,0 pb ; 56,3 pb] | au-delà de la grille [3,2 pb ; 58,6 pb] | au-delà de la grille | 59,5 pb · au-delà de la grille |
| TP1 seuls | −0,002 [−0,002 ; −0,001] | au-delà de la grille [0,0 pb ; 51,4 pb] | au-delà de la grille [0,0 pb ; 52,4 pb] | au-delà de la grille | au-delà de la grille · au-delà de la grille |
| 5 % meilleurs trades seuls | −0,003 [−0,004 ; −0,003] | au-delà de la grille [0,0 pb ; 55,2 pb] | au-delà de la grille [0,0 pb ; 57,8 pb] | au-delà de la grille | au-delà de la grille · au-delà de la grille |
| 95 % autres trades seuls | −0,061 [−0,072 ; −0,051] | 5,6 pb [0,0 pb ; 15,5 pb] | 13,8 pb [4,5 pb ; 25,1 pb] | 30,5 pb | 6,7 pb · 15,5 pb |

## Disparition de l'avantage

| Exécutions | 1 min | 3 min | 5 min | 15 min | VWAP 1 min |
|---|---:|---:|---:|---:|---:|
| Entrées · BTC (n = 541) | 1,9 [−0,1 ; 3,9] | 1,9 [−0,9 ; 4,7] | 2,9 [−0,4 ; 6,4] | 4,4 [−0,4 ; 9,2] | 4,6 |
| Entrées · ETH (n = 556) | 5,0 [1,5 ; 8,3] | 4,4 [1,0 ; 7,9] | 5,9 [1,0 ; 10,9] | 7,5 [1,2 ; 14,0] | 6,9 |
| Sorties à la clôture · BTC (n = 103) | −0,8 [−4,7 ; 3,5] | −6,0 [−11,3 ; −0,7] | −5,4 [−11,3 ; 0,5] | −3,9 [−14,4 ; 6,6] | 3,6 |
| Sorties à la clôture · ETH (n = 118) | 0,4 [−7,8 ; 7,9] | −4,1 [−15,8 ; 6,1] | −0,7 [−11,7 ; 10,4] | 0,2 [−17,6 ; 14,8] | 5,0 |
| Stops (après déclenchement) · BTC (n = 415) | 3,4 [0,7 ; 6,4] | 3,3 [0,0 ; 7,0] | 3,4 [−0,3 ; 7,2] | 3,9 [−1,6 ; 9,5] | −0,8 |
| Stops (après déclenchement) · ETH (n = 425) | 2,4 [−0,4 ; 5,7] | 0,0 [−5,5 ; 7,0] | −1,8 [−6,0 ; 2,4] | −2,5 [−8,0 ; 2,5] | −2,8 |

## Limites de liquidité observées

| Capital | Entrées > 10 % 1 min | Entrées > 10 % 5 min | POV 10 % > 15 · > 60 min | Stops > 10 · 25 · 100 % de la minute | Ordre > 10 % profondeur ±1 % |
|---|---:|---:|---:|---:|---:|
| 100 k$ | 1,6 % | 0,4 % | 0,1 % · 0,0 % | 1,4 % · 0,6 % · 0,1 % | 0,0 % (méd. 0,05 %) |
| 250 k$ | 3,0 % | 0,6 % | 0,2 % · 0,0 % | 2,9 % · 1,4 % · 0,2 % | 0,0 % (méd. 0,12 %) |
| 500 k$ | 6,2 % | 1,7 % | 0,7 % · 0,0 % | 6,1 % · 2,6 % · 0,8 % | 0,0 % (méd. 0,23 %) |
| 1,00 M$ | 10,0 % | 3,6 % | 1,6 % · 0,4 % | 9,9 % · 4,9 % · 1,4 % | 0,0 % (méd. 0,46 %) |
| 5,00 M$ | 45,5 % | 11,9 % | 6,7 % · 2,7 % | 43,8 % · 19,0 % · 6,1 % | 0,1 % (méd. 2,32 %) |

## Données L2 et calibrations nécessaires

| Donnée | Ce qu'elle permet | Étendue | Source |
|---|---|---|---|
| Carnet L2 incrémental complet (Binance USDⓈ-M, BTCUSDT et ETHUSDT) | Coût exact d'un ordre au marché de 50 k$ à 2,5 M$ au moment de chaque signal ; demi-spread et profondeur 0–20 pb | ±30 min autour de chaque exécution, 2020–2026 (≈ 2 500 fenêtres) | Tardis (payant ; premier jour du mois gratuit, accès bloqué ici) |
| Carnet L2 Hyperliquid (20 niveaux puis 5, instantanés) | Même mesure sur la plateforme du bot, profondeur visible très courte (≈ 2 à 8 pb) | Depuis 2024-10-29 | Tardis (payant) ; enregistrement propre gratuit dès maintenant |
| Trades Hyperliquid avec adresses | Calibrer Y sur de vrais metaordres (Donier & Bonart, 2015) au lieu de le supposer | Depuis 2024-12-01 | Tardis (payant) ou archive S3 Hyperliquid (frais de transfert) |
| Exécutions réelles du bot (mainnet, petit capital) | Latence, taux de remplissage, glissement des stops, coût par rapport au prix de décision : calibre le modèle à petite taille | 6 à 12 mois | Journal du bot (existant) |
| Cotations de gré à gré (RFQ) pour 0,5 à 2,5 M$ | Prix réel de l'immédiateté pour les grandes tailles | Ponctuel | Desks de gré à gré |

## Écarts au protocole

- Validation at 0.05 % slippage outside the pre-registered tolerance (0.002): post-hoc 1.5874 vs engine rerun 1.5818. In the rerun, 4 trade(s) change exit because some exit levels reference the slipped entry price; the post-hoc correction keeps trades fixed (pure cost), which is the quantity this study measures.
- Ajouts exploratoires, décidés après lecture du pilote pré-enregistré : échantillon aléatoire non stratifié d'entrées (dérive à 1, 2, 5 s) ; variante d'exécution « délai 2 s » ; scénario prudent avec poursuite mesurée trade par trade ; masque des valeurs figées de bookDepth (anomalie de l'archive constatée en cours d'étude) ; pente du Sharpe par point de base.

## Limites

- L'impact n'est pas mesuré : Y est un scénario. Les capitaux seuils changent d'un ordre de grandeur entre scénarios ; c'est l'incertitude principale au-delà de 500 k$.
- Signal et exécution sur deux marchés : le rendement net = rendement du backtest (Bitstamp BTC/USD, Binance ETH/USDT spot) − coûts mesurés sur le perpétuel. L'écart de base à l'entrée est faible (médiane ≈ −2 à −3 pb) mais son effet sur la performance n'est pas modélisé.
- Dérive des petits ordres : l'exécution principale (POV 10 %) utilise le VWAP de la première minute, qui surestime le coût d'un ordre exécuté en quelques secondes (dérive VWAP 1 min 4,6 pb BTC et 6,9 pb ETH, contre 1,4 et 2,7 pb à 2 s). La variante « délai 2 s » est exploratoire.
- La poursuite après stop du scénario prudent vient du pilote stratifié (10,9 pb à 10 s, intervalle [−2,9 ; 30,1], n = 32), qui surreprésente les périodes agitées ; mesurée trade par trade sur tout l'échantillon (fin de la minute du déclenchement), elle est plus faible. Variante exploratoire rapportée.
- Volume et profondeur visibles surestiment la liquidité disponible pour un preneur dans les chocs (annulations rapides). La profondeur agrégée à ±1 % n'est jamais convertie en coût.
- Données bookDepth de Binance : 407116 (BTC) et 584006 (ETH) instantanés figés plus de 30 min, exclus ; jours absents : 3 et 2.
- Stratégie en échantillon : la fenêtre 2020–2026 recouvre les données sur lesquelles les règles ont été conçues. Les coûts sont mesurés hors échantillon de calibration, pas l'avantage.
- 5 % meilleurs trades : classement ex post, descriptif.
