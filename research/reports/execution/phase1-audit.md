# Shock Engine — étude d'exécution, phase 1 (A et B)

Audit de l'exécution actuelle du bot, mesures disponibles, plan d'instrumentation et méthode de
reproduction. Rédigé le 2026-10-12. Signaux, logique prédictive et paramètres du Shock Engine
inchangés ; aucune modification du bot en production, aucun ordre envoyé.

Fichiers : `research/execution/` (scripts), `research/reports/execution/` (résultats),
`research/preregistration/execution-phase1-latency.md` (pré-enregistrement de la mesure de dérive).

## 0. L'essentiel

1. **Latence réelle** : sur le seul trade réel du bot (testnet, BTC, 2026-10-07), l'ordre d'entrée
   porte l'heure de bloc **T + 5,01 s** ; le stop posé à la clôture suivante, **T + 4,79 s**.
   Décomposition reconstituée d'après le code : **3,0 s d'attente fixe** + ≈ 2 s pour 7 à 9
   allers-retours REST **séquentiels** vers Hyperliquid, dont un établissement de connexion.
2. **Coût de cette latence aux instants de signal** (mesure pré-enregistrée, 110 exécutions tirées
   au hasard, transactions Binance) : dérive défavorable moyenne **4,5 pb à 5 s**, 2,6 pb à 2 s,
   1,7 pb à 1 s, 0,8 pb à 0,5 s. Passer de 5 s à 1 s : **−2,8 pb par exécution à la clôture**
   [IC 95 % : 1,0 ; 4,6].
3. **La variante « 2 s » de l'étude de capacité** utilisait la dérive à des instants aléatoires
   (BTC 1,38 pb ; aux instants de signal : 2,82 pb). Recalculée : capacité au Sharpe 1,5 de
   1,27 M$ (au lieu de 1,44 M$). Surtout, le bot actuel (≈ 5 s) se situe à **≈ 0,60 M$** dans ce même
   modèle, et non à 1,44 M$.
4. **`SETTLE_MS` n'est pas nécessaire à la justesse des bougies** : la protection vient de la règle
   « l'exchange a déjà ouvert la bougie suivante ». De plus, l'horloge de secours tire toujours à
   T + 3 s : le WebSocket n'accélère aujourd'hui jamais la lecture.
5. **Risques prioritaires** : une fermeture au marché incomplète arrête le bot (HALT) **après**
   avoir annulé stop et TP1, ce qui laisse un reliquat sans stop ; 15 minutes sans aucun ordre de sortie
   après chaque entrée (identique au backtest ; un stop de sécurité à 8 % n'aurait touché
   aucun trade historique).
6. **Gain d'ingénierie plausible à 1 M$** (scénario central, impact non calibré) : Sharpe
   1,45 → 1,56 (1 s) à 1,60 (0,5 s). C'est une estimation conditionnelle, pas une démonstration :
   l'intervalle bootstrap à 90 % du Sharpe à 1 M$ va d'environ 0,9–1,0 à 2,0–2,1 dans tous les cas.

## 1. Chemin critique actuel (code relu)

Entrée depuis une position à plat, à la clôture T d'une bougie 15 min :

| Étape | Code | Appels réseau | Durée estimée (VPS en Europe, aller-retour ≈ 0,2–0,25 s) |
|---|---|---|---|
| Horloge de secours : lecture à T + 3 s, quel que soit le WebSocket | `bot/src/main.ts:33`, `:128` | — | 3,0 s |
| Chemin WebSocket : premier message de la nouvelle bougie + 3 s (toujours ≥ T + 3 s) | `bot/src/runtime.ts:159` | — | (jamais plus tôt) |
| Lecture REST des bougies closes ; refaite 5 s plus tard si l'exchange n'a pas encore la suivante | `runtime.ts:93`, `:121` ; `candles.ts:94` | 1 (+ 1 à 00:00 UTC, bougies journalières) | 0,2 s + ≈ 0,45 s d'établissement de connexion (inactive depuis plus de 4 s) |
| Fills, financement, compte, ordres ouverts : un par un | `bot/src/engine/live.ts:413`–`421` | 4 (5 en compte unifié) | ≈ 0,9 s |
| Calcul du signal | `live.ts:426`–`429` | — | non mesuré (quelques ms attendues) |
| Prix (BBO du WebSocket s'il a moins de 2 s, sinon REST) et garde de spread (jusqu'à 5 × 2 s si > 10 pb) | `live.ts:649`–`655` | 0 à 6 | 0 s en général |
| Compte relu pour la taille | `live.ts:656` | 1 (2 en compte unifié) | ≈ 0,23 s |
| Ordre IOC à BBO ± 0,5 % (état écrit sur disque avant l'envoi) | `live.ts:660`, `:326` | 1 | aller simple + bloc ≈ 0,1–0,2 s jusqu'au bloc |
| Après l'ordre : compte, stop de sécurité éventuel, fills | `live.ts:662`, `:685` | 2–3 | hors du chemin de l'ordre |

Reconstitution : 3,0 + 0,45 + ≈ 6,5 allers-retours × 0,22 + bloc ≈ **5,0 s**, conforme aux 5,01 s
mesurés. Le modèle est ajusté sur deux points seulement ; il doit être confirmé par l'instrumentation (§ 7).

Autres chemins :
- **Retournement** (`live.ts:643`) : fermeture complète (annulation du stop puis du TP1, un appel chacun, `client.ts:327`),
  IOC de fermeture, fills, ordres ouverts, puis seulement l'entrée (prix, compte, IOC). La jambe
  d'entrée part ≈ 1 à 1,5 s après la jambe de fermeture, soit ≈ T + 6,5 s.
- **Fermeture au marché (FLIP)** : 4 lectures + annulations + IOC ≈ T + 5 à 5,5 s.
- **Pose du stop après l'entrée** : à la clôture suivante seulement, ≈ T' + 4,8 s (mesuré : 4,79 s).
- **Stop déclenché** : par l'exchange, sur le **prix mark** (mis à jour toutes les quelques
  secondes), puis ordre au marché limité à ± 5 % du déclenchement. Le bot l'apprend par le flux du
  compte (300 ms de regroupement + une lecture REST).
- **Stop suiveur** : recalculé sur le milieu du BBO, déplacé au plus toutes les 2 s et seulement
  par pas de 5 % de la distance de suivi (`live.ts:573`–`575`) ; chaque déplacement = pose du
  nouveau stop puis annulation de l'ancien (2 allers-retours).

## 2. Les 10 points de mesure : disponibles ou manquants

| Point | Aujourd'hui | Source |
|---|---|---|
| 1. Clôture théorique T | disponible | calculée |
| 2. Message WebSocket de la nouvelle bougie | **manquant** | non journalisé (`BotLoop.onCandle`) ; mesuré par la sonde indépendante |
| 3. Bougie confirmée | approximatif | `market_bar.time`, écrit après la lecture REST ; motif `ws_close` / `clock` / `retry` |
| 4. Début et fin du calcul du signal | **manquant** | la fin est bornée par l'événement `signal`, écrit après 4 appels REST et le calcul |
| 5. Début et fin de chaque appel bloquant | **manquant** | seulement les reprises après erreur (`retry`) |
| 6. Décision d'exécution | approximatif | `signal` (bougies avec décision seulement) |
| 7. Envoi de l'ordre | **manquant** | `pending.at` est écrit dans le fichier d'état, puis effacé |
| 8. Accusé de l'exchange | côté exchange seulement | historique public des ordres (heure du bloc) ; réception locale non journalisée |
| 9. Premier remplissage | côté exchange seulement | fills publics (heure du bloc) ; pas d'événement pour les entrées |
| 10. Remplissage final / annulation du reliquat | côté exchange seulement | `statusTimestamp` de l'historique public ; IOC : même bloc |

Ce qui existe déjà et sert tout de suite : `market_bar` (heure de lecture, comparaison WebSocket /
REST, statistiques de spread de la bougie), `signal`, `entry` (prix de référence = clôture, BBO,
spread), `exit`, `exit_fill` (écart au niveau du stop ou du TP1), `entry_skipped`, `retry`,
`candle_revised`, et les identifiants client des ordres (le préfixe indique entrée, fermeture,
stop, TP1 ou stop de sécurité). Côté exchange, l'adresse du compte étant publique, l'historique
des ordres et des fills donne pour **chaque ordre du bot** l'heure de bloc, le taux de remplissage,
le prix moyen et les frais, sans rien demander au bot (`research/execution/latency-audit.ts`).

Mesure actuelle (`latency-audit-testnet.json`, ordres du bot depuis le 2026-10-06) : 1 entrée
(T + 5,01 s, remplie à 100 %, 5,7 pb au-dessus de la clôture sur le carnet peu profond du testnet,
frais 4,5 pb), 1 stop posé (T + 4,79 s), 899,8 s sans stop après l'entrée, 1 fermeture manuelle depuis l'interface.
Les journaux du serveur (shadow et réel) ne sont pas dans le dépôt : ils permettront les
distributions P50 à P99 (§ 9, étape 1).

## 3. Audit de l'attente de 3 secondes (`SETTLE_MS`)

**Pourquoi.** Introduite le 2026-10-05 comme marge, « le temps que l'exchange finalise la
bougie », puis « le temps qu'il ouvre la suivante ». Aucune mesure ne l'a fixée.

**Est-elle indispensable ?** Non. Une bougie incomplète ne peut pas entrer dans le moteur : la
dernière bougie lue n'est acceptée que si l'exchange en a déjà ouvert une plus récente, ou 60 s
après sa clôture (`candles.ts:94`). Lire trop tôt ne coûte qu'une relecture, aujourd'hui
programmée **5 s** plus tard (`runtime.ts:121`) : c'est ce délai qu'il faut raccourcir (200 ms)
si l'attente est supprimée. Les révisions éventuelles sont déjà détectées (`candle_revised`).

**Quand calculer sans risque.** Dès que l'exchange a ouvert la bougie suivante, c'est-à-dire à la
première transaction après T. Sonde indépendante (1re clôture enregistrée, 04:45 UTC, marché calme) :

| | BTC | ETH |
|---|---|---|
| première transaction après T (heure de l'exchange) | + 1,16 s | + 0,06 s |
| premier message WebSocket de la nouvelle bougie | + 1,44 s | + 0,27 s |
| REST confirme selon la règle du bot (réponse reçue) | + 1,72 s | + 0,84 s |
| bougie reçue par le WebSocket juste avant = valeur REST définitive | oui | oui |

Aux instants de signal (chocs), l'activité est bien plus forte : médiane de 370 transactions
Binance dans les 5 s qui suivent la clôture. La première transaction arrive donc en quelques
millisecondes.

**Le WebSocket permet-il de réduire l'attente ?** Oui, et sans anticipation : le premier message
de la nouvelle bougie est la confirmation de l'exchange que la précédente est close. Deux options :
(a) déclencher la lecture REST à ce message, avec relecture rapide : il faut un aller-retour de plus,
≈ 0,01 s depuis Tokyo ; (b) utiliser directement l'état WebSocket de la bougie close, vérifié
ensuite par REST. L'option (b) n'est acceptable que si la sonde montre zéro écart sur au moins
1 000 clôtures par actif, ce qui borne le taux d'écart sous 0,3 % à 95 %. Recommandation : (a), car son coût
est négligeable une fois le serveur à Tokyo.

**Coût de la latence en points de base** (`latency-drift.json`, pré-enregistré, Binance,
dérive moyenne dans le sens de l'ordre depuis la clôture) :

| Délai après T | 0,5 s | 1 s | 2 s | 3 s | 5 s | 10 s |
|---|---|---|---|---|---|---|
| BTC (55 exécutions) | 1,05 | 1,94 | 2,82 | 3,17 | 4,40 | 6,36 |
| ETH (55) | 0,59 | 1,45 | 2,38 | 3,75 | 4,59 | 6,21 |
| volatilité 60 min, tiers bas (35) | 0,16 | 0,78 | 1,23 | 2,40 | 3,65 | 4,32 |
| tiers moyen (36) | 0,38 | 1,02 | 1,68 | 2,56 | 3,42 | 4,47 |
| tiers haut (39) | 1,80 | 3,15 | 4,69 | 5,25 | 6,24 | 9,71 |

Gain apparié de 5 s → 1 s : BTC 2,46 pb [0,80 ; 4,19], ETH 3,13 pb [0,32 ; 6,16], ensemble
2,79 pb [1,02 ; 4,59]. Gain de 5 s → 0,5 s : 3,67 pb [1,88 ; 5,75]. Les fermetures FLIP
(15 par actif) dérivent moins que les entrées, mais leurs intervalles sont larges. Limites : marché
Binance et non Hyperliquid (le décalage entre les deux sera mesuré par la sonde), dernier prix
échangé, 40 entrées par actif.

**Conséquence sur la capacité** (`latency-capacity.json`). C'est le modèle de l'étude de capacité, avec un ordre immédiat
après le délai et la dérive mesurée aux signaux (entrées et FLIP réunis par actif, choix fixé
avant lecture des mesures). Contrôle : la variante publiée est reproduite exactement.

| Hypothèse de dérive, scénario central | Sharpe 100 k$ | 250 k$ | 500 k$ | 1 M$ | 5 M$ | Capacité au Sharpe 1,5 (IC de la dérive) |
|---|---|---|---|---|---|---|
| variante publiée : 2 s, instants aléatoires | 1,69 | 1,65 | 1,60 | 1,54 | 1,28 | 1,44 M$ |
| **5 s aux signaux ≈ bot actuel** | 1,60 | 1,56 | 1,51 | **1,45** | 1,18 | **0,60 M$** (< 0,05 à 1,68) |
| 2 s aux signaux | 1,67 | 1,64 | 1,59 | 1,53 | 1,26 | 1,27 M$ (0,65 à 1,93) |
| 1 s aux signaux | 1,71 | 1,67 | 1,63 | 1,56 | 1,30 | 1,68 M$ (1,28 à 2,06) |
| 0,5 s aux signaux | 1,74 | 1,70 | 1,66 | 1,60 | 1,33 | 2,12 M$ (1,76 à 2,47) |

À 1 M$, de 5 s à 0,5 s : CAGR 39,3 % → 44,7 %, Sortino 3,05 → 3,41, drawdown maximal −20,3 % →
−19,8 %. Scénario optimiste : Sharpe 1,56 → 1,70. Scénario prudent : 0,71 → 0,86 (sous 1,5 dès
50 k$ dans tous les cas). L'écart entre scénarios (impact non calibré) reste plus grand que le gain
de latence.

## 4. Autres sources de latence

- **Compte en cache** : le compte est lu deux fois avant l'ordre (`live.ts:415`, `:656`). Il ne
  change qu'avec un fill, le financement (toutes les heures) ou le prix (equity). Il peut être tenu à jour
  par le flux WebSocket du compte et relu par REST juste avant T, puis vérifié après l'ordre, hors
  du chemin critique. La taille utilise l'equity de T − quelques secondes : l'écart est
  négligeable, mais doit être journalisé.
- **Appels REST séquentiels** : fills, financement, ordres ouverts et compte ne dépendent pas de la
  bougie. Ils peuvent être lus avant T (vers T − 5 s), en parallèle, puis revérifiés après
  l'ordre. Il ne reste alors sur le chemin critique que la confirmation de la bougie et l'ordre.
- **Préparation de l'ordre avant la clôture** : actif, pas de taille, equity, identifiant client
  et connexion peuvent être prêts avant T. **La décision, elle, n'est jamais calculée avant que la
  bougie soit confirmée.** Ce n'est pas une anticipation du signal.
- **Connexions persistantes** : le SDK utilise le `fetch` de Node, dont les connexions inactives
  ferment après 4 s par défaut. Après 15 minutes d'attente, la première requête de la clôture
  paie TCP + TLS, soit ≈ 2 allers-retours. Remèdes : agent HTTP gardant les connexions 60 s, ou
  requête de maintien à T − 2 s, ou envoi des ordres par le WebSocket (Hyperliquid accepte les
  requêtes et les actions sur le WebSocket).
- **Localisation du serveur** : les serveurs d'API de Hyperliquid sont donnés à Tokyo ; un aller-retour
  depuis l'Europe coûte ≈ 0,2–0,25 s, contre quelques millisecondes depuis Tokyo. Avec 7 à 9
  allers-retours séquentiels aujourd'hui, c'est ≈ 1,5–2 s ; après les changements ci-dessus (2
  allers-retours), ≈ 0,45 s depuis l'Europe et ≈ 0,02 s depuis Tokyo. **À mesurer depuis le
  serveur actuel et depuis un serveur de test à Tokyo** (§ 9).
- **File série** : une lecture des fills (toutes les 15 s) ou un déplacement du stop en cours à T
  retarde la clôture (`live.ts:113`) de 1 à 2 allers-retours.
- **Limite de requêtes** : 1 200 de poids par minute et par IP, dont le collecteur Market Flow
  utilise jusqu'à 600 sur la même machine. À surveiller dans le journal (`retry`, erreurs 429).

Latence visée (niveau 2) : ≈ 0,5–0,9 s depuis l'Europe, ≈ 0,1–0,3 s depuis Tokyo aux instants de
signal (première transaction + confirmation + ordre + bloc), contre ≈ 5 s.

## 5. Goulots d'étranglement, par ordre d'importance

| # | Goulot | Coût en temps | Coût en pb aux signaux (gain apparié, IC 95 %) |
|---|---|---|---|
| 1 | Attente fixe de 3 s | 3,0 s | 5 s → 2 s : 1,89 pb [0,57 ; 3,32] |
| 2 | 6 à 8 allers-retours REST séquentiels avant l'ordre, dont une connexion refaite (≈ 0,45 s) | 1,4–2,0 s (Europe) | 2 s → 0,5 s : 1,79 pb [0,94 ; 2,73] |
| 3 | Retournement en deux temps | + 1–1,5 s pour l'entrée | 5 s → 7 s : ≈ 1,2 pb de plus sur ces entrées |
| 4 | Garde de spread (attente jusqu'à 10 s, puis abandon de l'entrée) | rare, à mesurer | entrées perdues = sélection différente du backtest |
| 5 | File série à la clôture | 0–0,5 s | faible |

## 6. Risques opérationnels prioritaires

| # | Risque | Constat dans le code | Gravité à 1 M$ |
|---|---|---|---|
| R1 | **Fermeture incomplète** | `closePosition` annule stop, TP1 et stop de sécurité (`live.ts:615`), envoie un IOC, et si le remplissage est incomplet, arrête le bot (`:631`) : le reliquat reste ouvert, sans stop, jusqu'à intervention manuelle | élevée |
| R2 | **Aucun ordre de sortie pendant la bougie qui suit l'entrée** | comme le script (`broker.ts`, « la barre qui suit l'entrée n'a pas de stop ») : 899,8 s mesurées sur le testnet | moyenne (perte non bornée en cas de choc extrême) |
| R3 | **Stop au marché sur le prix mark, plafond 5 %** | déclenchement en retard sur le dernier prix (écart mark − milieu jusqu'à 3,3 pb mesuré sur ETH à une clôture calme), exécution jusqu'à 5 % du niveau ; un reliquat non exécuté est re-protégé après la lecture des fills (≈ 0,5 s) | moyenne |
| R4 | **Entrée partielle acceptée sans trace** | la position prend la taille remplie (`live.ts:667`) ; l'écart à la taille voulue n'est pas journalisé | faible en risque, coût d'opportunité non mesuré |
| R5 | **Garde de spread** | entrée abandonnée après 10 s si spread > 10 pb : les trades de choc peuvent être ceux qui sautent | à mesurer (`entry_skipped`) |
| R6 | **Retournement** | si la jambe de fermeture échoue, R1 ; si l'entrée échoue, le bot reste à plat (trade manqué) | moyenne |
| R7 | **Serveur unique, IP partagée** | limite de requêtes partagée avec le collecteur ; horloge contrôlée seulement au démarrage (tolérance 5 s) | faible |

Stop de sécurité pour R2 (`first-bar-exposure.json`, backtest E2 complet) : excursion défavorable
pendant la première bougie, médiane 0,25 % (BTC) et 0,32 % (ETH), P99 2,5 % et 2,2 %, maximum
7,2 % et 6,8 %. Un stop de sécurité à 8 % (`BOT_EMERGENCY_STOP_PCT`, aujourd'hui désactivé)
n'aurait touché **aucun** trade historique et borne la perte d'un choc extrême. Ce réglage dépend de
toi ; il est dans `live.env`, que je ne modifie pas.

## 7. Plan d'instrumentation non intrusive (demande ton accord)

Toute mesure interne au bot exige de modifier son code. Proposition **I1**, journalisation
seulement, sans aucun changement de décision, d'ordre ou de délai :

- un adaptateur `TimedExchange` autour de l'exchange (même interface) qui chronomètre chaque appel
  (début, fin, résultat, identifiant d'ordre) : il couvre les points 5, 7 et 8 côté local ;
- dans la boucle : heure du premier message WebSocket de la nouvelle bougie, avec l'état de la
  bougie close reçu juste avant (point 2) ; début et fin de la lecture REST (point 3) ;
- dans `closeBar` : deux horodatages autour du calcul du signal (points 4 et 6) ;
- **un seul** événement `exec_timing` écrit par bougie, après l'envoi des ordres, avec des heures
  en millisecondes relatives à T (horloge monotone) : aucune écriture disque ajoutée sur le chemin
  critique ;
- points 9 et 10 : rapprochés hors ligne des fills et de l'historique publics par identifiant d'ordre.

Validation avant déploiement : toute la suite de tests du bot, plus un test qui rejoue les mêmes
scénarios avec et sans `TimedExchange` et exige des ordres et des décisions identiques ; puis shadow
mode d'abord. Déploiement par `smp-bot update`, de préférence position à plat (redémarrage du bot
réel, état relu et réconcilié).

## 8. Reproduire fidèlement le bot actuel (niveau 1) : méthode

Simulateur événementiel, séparé du bot et du backtest, qui rejoue chaque décision du backtest
(mêmes signaux) avec l'exécution du bot :

- **heure d'arrivée** de chaque ordre = T + latence tirée de la distribution mesurée (par actif,
  type d'ordre et régime) ;
- **carnet à l'arrivée**, pas à T : IOC limité à ± 0,5 % du BBO consommant les niveaux visibles,
  moins une décote pour les annulations prioritaires (Hyperliquid traite annulations et ordres
  post-only avant les IOC du même bloc) ; reliquat abandonné (entrée) ou arrêt du bot (fermeture,
  comme aujourd'hui) ;
- **garde de spread**, frais du palier réellement atteint (le volume sur 14 jours dépend du capital),
  financement ;
- **stops** déclenchés sur le prix mark simulé, exécutés au marché avec plafond de 5 % ; **stop
  suiveur** sur le milieu, avec pas de 5 % et intervalle de 2 s ; **TP1** limite au repos, rempli
  seulement si des transactions passent à travers son prix au-delà de la file estimée, et non au
  simple contact comme dans le backtest ;
- **retournements** en deux ordres successifs ;
- **portefeuille rejoué** sur les quantités et prix simulés : une entrée partielle réduit la position,
  une entrée manquée perd son rendement, un stop en retard change le résultat.

Données et identifiabilité par capital :

| Capital (ordre = moitié) | Ce qui manque | Statut |
|---|---|---|
| 100 k$, 250 k$ | latence mesurée et carnet Hyperliquid aux signaux (enregistrement prospectif) | identifiable en quelques mois |
| 500 k$, 1 M$ | profondeur aux instants de choc et impact d'un ordre de 250–500 k$ | fourchette conditionnelle (scénarios d'impact) |
| 5 M$ | impact d'ordres de 2,5 M$, reconstitution du carnet | non identifiable sans historique L2 et sans exécutions réelles de cette taille |

Avant d'avoir ces données, la baseline publiable est celle du § 0 : modèle de capacité avec la
dérive mesurée à 5 s (Sharpe 1,45 à 1 M$ en scénario central). Elle ne compte encore ni le
coût des stops sur prix mark, ni le TP1 à la file, ni le palier de frais : c'est une borne haute
du bot actuel dans ce modèle.

## 9. Données L2 indispensables

1. **Hyperliquid, prospectif, gratuit** (à lancer en premier) : la sonde `close-probe.ts`, en mode
   WebSocket seul (`--rest 0`, sans poids pour la limite de requêtes). Elle enregistre le carnet rapide (5 niveaux,
   ≈ 0,5 s), le carnet 20 niveaux et ses agrégations (≈ 5 s), les transactions, le BBO, les prix
   mark et oracle et les bougies, de T − 10 s à T + 30 s à chaque clôture. À étendre à toute la
   durée d'une position ouverte pour les stops.
2. **Journaux du bot** (shadow et réel), puis instrumentation I1.
3. **Allers-retours mesurés** depuis le serveur actuel et depuis un serveur de test à Tokyo.
4. **Historique Binance L2 incrémental** (payant, Tardis) autour des ≈ 2 500 exécutions : impact,
   profondeur aux chocs, décalage Binance / Hyperliquid. À décider après les étapes gratuites.
5. **Historique Hyperliquid** (transactions avec adresses, carnet) : couverture et prix à vérifier
   avant tout achat.
6. **Fills réels du bot à petite taille** sur le mainnet : la seule mesure du comportement
   d'Hyperliquid avec nos ordres (sous ton autorisation explicite).

## 10. Plan de développement progressif

| Étape | Contenu | Touche au bot ? | Autorisation |
|---|---|---|---|
| 0 | Audit, scripts de mesure, dérive pré-enregistrée, capacité recalculée (ce document) | non | — |
| 1 | Journaux du serveur → distributions P50–P99 ; allers-retours depuis le serveur ; sonde en WebSocket seul | non (lecture, processus séparé) | lancer la sonde sur le serveur |
| 2 | Instrumentation I1, shadow puis réel | oui, journalisation seulement | **oui** |
| 3 | Simulateur de niveau 1, validé contre les fills réels et le shadow | non | — |
| 4 | Réduction de latence (niveau 2), chaque changement derrière une option désactivée par défaut | oui | **oui, changement par changement** |
| 5 | Politiques d'exécution (niveau 3 : fractionnement, TWAP, POV, maker/taker) | oui | phase 2 |

Ordre recommandé pour l'étape 4 : (1) corriger R1 (re-protéger un reliquat avant tout arrêt) ;
(2) lecture déclenchée par le WebSocket, relecture à 200 ms ; (3) état du compte en cache et lectures
avant T ; (4) connexion maintenue ; (5) serveur à Tokyo ; (6) retournement en un seul ordre.

## 11. Tests pour valider chaque amélioration

| Changement | Test avant déploiement | Critère en shadow puis en réel |
|---|---|---|
| Lecture au message WebSocket | rejeu des séquences enregistrées par la sonde : aucune bougie acceptée différente de sa valeur REST à T + 60 s, sur ≥ 1 000 clôtures par actif | zéro `candle_revised` ; parité backtest / moteur live inchangée |
| Compte en cache, lectures avant T | tests à fautes du faux exchange (messages perdus, fills retardés, ordre inconnu) | zéro écart de position à la réconciliation ; zéro ordre en double |
| Connexion maintenue, serveur à Tokyo | mesure des allers-retours avant / après | P50 et P99 de T → bloc de l'ordre |
| Retournement en un ordre | remplissage partiel simulé : position finale et frais corrects | taille et sens identiques au backtest |
| Correction R1 | fermeture partielle simulée : le reliquat a toujours un stop | jamais de position sans stop dans le journal |
| Toute amélioration | critère de succès écrit avant le test ; comparaison appariée sur les mêmes signaux | gain mesuré en pb avec intervalle de confiance, puis converti en Sharpe |

Le Sharpe historique ne valide aucune amélioration : ses intervalles sont trop larges (≈ ± 0,5).
Les gains se valident en points de base mesurés, avec intervalle de confiance, puis se traduisent
en Sharpe.

## 12. Résultats et scripts

- `research/execution/latency-audit.ts` : journaux du bot et données publiques du compte → distributions.
- `research/execution/close-probe.ts`, `close-probe-report.ts` : sonde de clôture et son analyse.
- `research/execution/latency-drift.ts` : dérive aux instants de signal (pré-enregistrée).
- `research/execution/latency-capacity.ts` : variante latence recalculée ; contrôle : la variante
  publiée est reproduite exactement.
- `research/execution/first-bar-exposure.ts` : exposition pendant la bougie sans stop.
- Résultats : `research/reports/execution/*.json`. Tests : `research/tests/latency-audit.test.ts`.
