# Capacité institutionnelle du Shock Engine — P0 et P1 (données gratuites)

Protocole pré-enregistré : `research/preregistration/capacity-p0p1.md`. Simulation historique, aucune
exécution réelle. Rapport complet avec graphiques : `capacity-report.html`.

## En bref

- Fenêtre 2020-01-01 → 2026-09-30 (2465 jours), là où les perpétuels Binance existent. Sharpe du portefeuille sans coût ajouté : 2,00, CAGR 59,9 %. Commission de 0,045 % par exécution déjà dans le backtest et jamais comptée deux fois.
- Budget de coûts : le Sharpe reste ≥ 1,5 tant que le coût ajouté moyen ne dépasse pas 14,7 pb par exécution, et ≥ 1,0 jusqu'à 29,7 pb. L'histoire elle-même est incertaine : même sans coût, 5 % des historiques rééchantillonnés ont un Sharpe < 1,5.
- Coût du délai, indépendant de la taille (mesuré) : dans les 2 secondes qui suivent la clôture du signal, le perpétuel a déjà bougé de 1,6 pb (BTC) et 2,8 pb (ETH) dans le sens du trade, en moyenne. Le backtest, qui exécute au prix de clôture, ne le paie pas.
- Capacité (estimée par modèle, impact non calibré) : à 1 M$, Sharpe net 1,76 dans le scénario central, 1,81 en optimiste, 1,56 en prudent. À 5 M$ : 1,63, 1,74 et 1,14.
- L'avantage statistique (borne basse à 90 % du Sharpe au-dessus de 0) se perd vers > 100 M$ dans le scénario central, > 100 M$ en optimiste et 15 M$ en prudent. Le seuil de Sharpe 1,5 est franchi bien plus tôt : 13 M$ (central), avec un intervalle très large ; ce seuil dépend surtout de l'hypothèse de délai : 21 M$ si l'ordre part 2 s après la clôture au lieu d'être étalé sur la première minute (variante exploratoire).
- Limite de liquidité la plus contraignante (observée) : les stops. À 5 M$, l'ordre de stop dépasse 10 % du volume de la minute du déclenchement dans 31 % des cas, et tout le volume de cette minute dans 3 % des cas.

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
| 100 k$ | 4,5 pb | 6,9 · 0,4 | 3,7 % | 1,83 [1,31 ; 2,35] | 52,7 % [31 % ; 84 %] | 4,11 | −18,4 % |
| 250 k$ | 4,7 pb | 7,1 · 0,6 | 3,9 % | 1,83 [1,30 ; 2,34] | 52,5 % [31 % ; 84 %] | 4,09 | −18,5 % |
| 500 k$ | 4,9 pb | 7,3 · 0,9 | 4,1 % | 1,82 [1,29 ; 2,33] | 52,2 % [30 % ; 83 %] | 4,07 | −18,5 % |
| 1,00 M$ | 5,2 pb | 7,7 · 1,2 | 4,3 % | 1,81 [1,28 ; 2,33] | 51,9 % [30 % ; 83 %] | 4,05 | −18,6 % |
| 5,00 M$ | 7,1 pb | 9,6 · 2,7 | 5,9 % | 1,74 [1,21 ; 2,26] | 48,7 % [28 % ; 79 %] | 3,85 | −19,1 % |

### Central (Y = 1)

| Capital | Coût moyen / exécution | dont entrées · stops | Frein annuel | Sharpe net [90 %] | CAGR net [90 %] | Sortino | Drawdown max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 k$ | 4,9 pb | 7,3 · 0,8 | 4,1 % | 1,82 [1,29 ; 2,34] | 52,1 % [30 % ; 83 %] | 4,07 | −18,5 % |
| 250 k$ | 5,3 pb | 7,7 · 1,2 | 4,4 % | 1,80 [1,27 ; 2,32] | 51,5 % [30 % ; 83 %] | 4,02 | −18,6 % |
| 500 k$ | 5,8 pb | 8,2 · 1,7 | 4,8 % | 1,78 [1,26 ; 2,30] | 50,8 % [29 % ; 82 %] | 3,97 | −18,7 % |
| 1,00 M$ | 6,5 pb | 9,0 · 2,4 | 5,4 % | 1,76 [1,23 ; 2,28] | 49,9 % [29 % ; 81 %] | 3,91 | −18,8 % |
| 5,00 M$ | 9,9 pb | 12,4 · 5,4 | 8,4 % | 1,63 [1,09 ; 2,16] | 44,4 % [24 % ; 74 %] | 3,54 | −19,6 % |

### Prudent (Y = 2)

| Capital | Coût moyen / exécution | dont entrées · stops | Frein annuel | Sharpe net [90 %] | CAGR net [90 %] | Sortino | Drawdown max |
|---|---:|---:|---:|---:|---:|---:|---:|
| 100 k$ | 6,2 pb | 9,2 · 0,3 | 5,2 % | 1,77 [1,24 ; 2,29] | 49,9 % [29 % ; 81 %] | 3,92 | −18,6 % |
| 250 k$ | 7,7 pb | 10,8 · 1,6 | 6,5 % | 1,71 [1,18 ; 2,23] | 47,6 % [27 % ; 78 %] | 3,75 | −18,8 % |
| 500 k$ | 9,5 pb | 12,6 · 3,2 | 7,9 % | 1,65 [1,12 ; 2,17] | 45,1 % [25 % ; 75 %] | 3,57 | −19,1 % |
| 1,00 M$ | 11,9 pb | 15,2 · 5,3 | 10,0 % | 1,56 [1,02 ; 2,08] | 41,7 % [22 % ; 70 %] | 3,32 | −19,4 % |
| 5,00 M$ | 22,9 pb | 26,3 · 14,4 | 19,3 % | 1,14 [0,57 ; 1,70] | 27,2 % [10 % ; 52 %] | 2,25 | −22,3 % |

### Capital à partir duquel chaque critère est atteint

| Scénario | Sharpe < 1,5 | Sharpe < 1,0 | Avantage perdu |
|---|---:|---|---|
| Optimiste (Y = 0,5) | 45 M$ [50 k$ ; > 100 M$] | > 100 M$ [35 M$ ; > 100 M$] | > 100 M$ |
| Central (Y = 1) | 13 M$ [50 k$ ; 83 M$] | 68 M$ [9,75 M$ ; > 100 M$] | > 100 M$ |
| Prudent (Y = 2) | 1,40 M$ [50 k$ ; 8,64 M$] | 6,99 M$ [1,12 M$ ; 23 M$] | 15 M$ |

Variantes exploratoires (non pré-enregistrées) :

| Variante | Sharpe < 1,5 | Sharpe < 1,0 | Avantage perdu |
|---|---:|---|---|
| Central, délai 2 s | 21 M$ | 93 M$ | > 100 M$ |
| Optimiste, délai 2 s | 84 M$ | > 100 M$ | > 100 M$ |
| Prudent, poursuite après stop mesurée trade par trade | 887 k$ | 5,85 M$ | 13 M$ |

## Budget de coûts (P0)

| Coût appliqué à… | Perte de Sharpe par pb | Sharpe 1,5 | Sharpe 1,0 | Sharpe 0 | Période officielle |
|---|---:|---|---|---|---|
| Toutes les exécutions | −0,034 [−0,041 ; −0,028] | 14,7 pb [0,0 pb ; 32,5 pb] | 29,7 pb [12,9 pb ; 49,0 pb] | au-delà de la grille | 16,1 pb · 31,5 pb |
| Ordres au marché et stops (sans TP1) | −0,034 [−0,041 ; −0,028] | 14,7 pb [0,0 pb ; 32,5 pb] | 29,7 pb [12,9 pb ; 49,0 pb] | au-delà de la grille | 16,1 pb · 31,5 pb |
| Entrées seules | −0,016 [−0,020 ; −0,013] | 30,1 pb [0,0 pb ; 53,9 pb] | au-delà de la grille [21,0 pb ; 58,3 pb] | au-delà de la grille | 33,0 pb · au-delà de la grille |
| Stops et stops suiveurs seuls | −0,011 [−0,013 ; −0,009] | 47,3 pb [0,0 pb ; 56,9 pb] | au-delà de la grille [18,4 pb ; 58,9 pb] | au-delà de la grille | 51,2 pb · au-delà de la grille |
| Sorties à la clôture seules | −0,007 [−0,008 ; −0,006] | au-delà de la grille [0,0 pb ; 57,7 pb] | au-delà de la grille [13,7 pb ; 58,6 pb] | au-delà de la grille | au-delà de la grille · au-delà de la grille |
| TP1 seuls | 0,000 [−0,000 ; 0,000] | au-delà de la grille [0,0 pb ; 0,0 pb] | au-delà de la grille [0,0 pb ; 0,0 pb] | au-delà de la grille | au-delà de la grille · au-delà de la grille |
| 5 % meilleurs trades seuls | −0,002 [−0,002 ; −0,001] | au-delà de la grille [0,0 pb ; 53,9 pb] | au-delà de la grille [0,0 pb ; 47,6 pb] | au-delà de la grille | au-delà de la grille · au-delà de la grille |
| 95 % autres trades seuls | −0,032 [−0,040 ; −0,026] | 15,5 pb [0,0 pb ; 34,8 pb] | 31,4 pb [13,5 pb ; 51,6 pb] | au-delà de la grille | 16,9 pb · 33,2 pb |

## Disparition de l'avantage

| Exécutions | 1 min | 3 min | 5 min | 15 min | VWAP 1 min |
|---|---:|---:|---:|---:|---:|
| Entrées · BTC (n = 300) | 1,6 [−0,7 ; 4,1] | 3,1 [−0,7 ; 6,9] | 3,3 [−1,0 ; 7,7] | 4,1 [−2,0 ; 10,3] | 3,9 |
| Entrées · ETH (n = 275) | 7,4 [4,0 ; 11,7] | 7,6 [2,9 ; 12,5] | 10,2 [4,6 ; 16,1] | 15,9 [7,1 ; 25,9] | 9,2 |
| Sorties à la clôture · BTC (n = 103) | −0,8 [−4,6 ; 3,2] | −6,0 [−11,4 ; −1,0] | −5,4 [−11,3 ; 1,3] | −3,9 [−14,5 ; 6,9] | 3,6 |
| Sorties à la clôture · ETH (n = 119) | 0,6 [−7,2 ; 8,1] | −3,2 [−14,7 ; 7,0] | −0,4 [−12,6 ; 10,1] | 0,4 [−17,3 ; 15,3] | 5,1 |
| Stops (après déclenchement) · BTC (n = 187) | 3,0 [−0,4 ; 6,8] | 3,1 [−0,9 ; 7,4] | 2,8 [−1,9 ; 7,5] | 3,8 [−4,9 ; 12,4] | −2,0 |
| Stops (après déclenchement) · ETH (n = 154) | 6,6 [−0,4 ; 14,0] | 12,4 [−0,1 ; 30,2] | 8,5 [0,3 ; 17,2] | 1,2 [−8,0 ; 11,3] | 0,1 |

## Limites de liquidité observées

| Capital | Entrées > 10 % 1 min | Entrées > 10 % 5 min | POV 10 % > 15 · > 60 min | Stops > 10 · 25 · 100 % de la minute | Ordre > 10 % profondeur ±1 % |
|---|---:|---:|---:|---:|---:|
| 100 k$ | 0,9 % | 0,2 % | 0,2 % · 0,0 % | 0,3 % · 0,3 % · 0,0 % | 0,0 % (méd. 0,04 %) |
| 250 k$ | 1,6 % | 0,3 % | 0,2 % · 0,0 % | 0,3 % · 0,3 % · 0,3 % | 0,0 % (méd. 0,11 %) |
| 500 k$ | 4,3 % | 0,7 % | 0,3 % · 0,0 % | 2,6 % · 0,3 % · 0,3 % | 0,0 % (méd. 0,22 %) |
| 1,00 M$ | 8,9 % | 2,3 % | 0,7 % · 0,2 % | 3,5 % · 1,5 % · 0,3 % | 0,0 % (méd. 0,43 %) |
| 5,00 M$ | 41,7 % | 10,4 % | 5,0 % · 1,4 % | 31,1 % · 11,1 % · 2,6 % | 0,2 % (méd. 2,15 %) |

## Données L2 et calibrations nécessaires

| Donnée | Ce qu'elle permet | Étendue | Source |
|---|---|---|---|
| Carnet L2 incrémental complet (Binance USDⓈ-M, BTCUSDT et ETHUSDT) | Coût exact d'un ordre au marché de 50 k$ à 2,5 M$ au moment de chaque signal ; demi-spread et profondeur 0–20 pb | ±30 min autour de chaque exécution, 2020–2026 (≈ 2 500 fenêtres) | Tardis (payant ; premier jour du mois gratuit, accès bloqué ici) |
| Carnet L2 Hyperliquid (20 niveaux puis 5, instantanés) | Même mesure sur la plateforme du bot, profondeur visible très courte (≈ 2 à 8 pb) | Depuis 2024-10-29 | Tardis (payant) ; enregistrement propre gratuit dès maintenant |
| Trades Hyperliquid avec adresses | Calibrer Y sur de vrais metaordres (Donier & Bonart, 2015) au lieu de le supposer | Depuis 2024-12-01 | Tardis (payant) ou archive S3 Hyperliquid (frais de transfert) |
| Exécutions réelles du bot (mainnet, petit capital) | Latence, taux de remplissage, glissement des stops, coût par rapport au prix de décision : calibre le modèle à petite taille | 6 à 12 mois | Journal du bot (existant) |
| Cotations de gré à gré (RFQ) pour 0,5 à 2,5 M$ | Prix réel de l'immédiateté pour les grandes tailles | Ponctuel | Desks de gré à gré |

## Écarts au protocole

- Ajouts exploratoires, décidés après lecture du pilote pré-enregistré : échantillon aléatoire non stratifié d'entrées (dérive à 1, 2, 5 s) ; variante d'exécution « délai 2 s » ; scénario prudent avec poursuite mesurée trade par trade ; masque des valeurs figées de bookDepth (anomalie de l'archive constatée en cours d'étude) ; pente du Sharpe par point de base.

## Limites

- L'impact n'est pas mesuré : Y est un scénario. Les capitaux seuils changent d'un ordre de grandeur entre scénarios ; c'est l'incertitude principale au-delà de 500 k$.
- Signal et exécution sur deux marchés : le rendement net = rendement du backtest (Bitstamp BTC/USD, Binance ETH/USDT spot) − coûts mesurés sur le perpétuel. L'écart de base à l'entrée est faible (médiane ≈ −2 à −3 pb) mais son effet sur la performance n'est pas modélisé.
- Dérive des petits ordres : l'exécution principale (POV 10 %) utilise le VWAP de la première minute, qui surestime le coût d'un ordre exécuté en quelques secondes (dérive VWAP 1 min 3,9 pb BTC et 9,2 pb ETH, contre 1,6 et 2,8 pb à 2 s). La variante « délai 2 s » est exploratoire.
- La poursuite après stop du scénario prudent vient du pilote stratifié (−2,1 pb à 10 s, intervalle [−8,5 ; 6,5], n = 18), qui surreprésente les périodes agitées ; mesurée trade par trade sur tout l'échantillon (fin de la minute du déclenchement), elle est plus faible. Variante exploratoire rapportée.
- Volume et profondeur visibles surestiment la liquidité disponible pour un preneur dans les chocs (annulations rapides). La profondeur agrégée à ±1 % n'est jamais convertie en coût.
- Données bookDepth de Binance : 407116 (BTC) et 584006 (ETH) instantanés figés plus de 30 min, exclus ; jours absents : 3 et 2.
- Stratégie en échantillon : la fenêtre 2020–2026 recouvre les données sur lesquelles les règles ont été conçues. Les coûts sont mesurés hors échantillon de calibration, pas l'avantage.
- 5 % meilleurs trades : classement ex post, descriptif.
