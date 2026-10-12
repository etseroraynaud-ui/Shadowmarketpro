# Pré-enregistrement — étude de capacité du Shock Engine, phases P0 et P1 (données gratuites)

Rédigé le 2026-10-12 et commité **avant tout calcul** de cette étude. Le commit qui ajoute ce
fichier fait foi : tout résultat est produit par un commit postérieur. Scripts prévus :
`research/capacity/` ; rapports : `research/reports/capacity/`.

## 0. Objet et ce qui ne change pas

Question : à partir de quel capital le Shock Engine (portefeuille BTC/ETH 50/50 publié, spécification
E2) perd-il son avantage, une fois ajoutés des coûts d'exécution réalistes ? Résultat attendu : une
courbe de capacité pour 100 k$, 250 k$, 500 k$, 1 M$ et 5 M$ (coûts estimés, CAGR net, Sharpe net,
limites de liquidité), avec plusieurs scénarios d'impact et des intervalles d'incertitude.

- **La stratégie n'est pas modifiée** : ni `lib/strategies/shock/*`, ni le préréglage, ni E2. Les
  trades sont ceux du portefeuille publié (`research/shock/portfolio.ts --variant e2`), reproduits
  à l'identique avant tout calcul (Sharpe 1,877566513 sur 2018-09-01 → 2026-09-30).
- Les coûts ajoutés sont appliqués **après coup** à chaque exécution du backtest ; ils ne changent
  aucune décision (le moteur ne lit pas l'equity pour décider ; la taille suit l'equity, ce que la
  correction multiplicative conserve). Cette correction est validée contre une relance du moteur
  avec glissement uniforme (`slippagePct`), qui doit redonner les Sharpe publiés à 1 pb, 2 pb et
  5 pb (1,8196 ; 1,7616 ; 1,5818) à 0,002 près.
- **Aucune donnée payante, aucun ordre réel.** Données : archive publique Binance
  (data.binance.vision), perpétuels USDⓈ-M BTCUSDT et ETHUSDT.

## 1. Marchés : signal et exécution restent distincts

- **Signaux** : ceux du backtest de recherche, calculés sur Bitstamp BTC/USD spot et Binance
  ETH/USDT spot, inchangés. Ils ne sont pas recalculés sur les perpétuels dans cette étude.
- **Exécution étudiée** : perpétuels Binance USDⓈ-M. Les coûts sont mesurés par rapport au prix du
  perpétuel à l'instant de décision. Le rendement net d'un trade = rendement du backtest (marché de
  signal) − coûts (marché d'exécution). L'écart de base entre les deux marchés n'est pas un coût dans
  ce modèle ; il est mesuré et rapporté comme limite.

## 2. Ce qui a déjà été vu (divulgation)

- Le stress de glissement uniforme publié (0, 1, 2, 5 pb par ordre → Sharpe 1,878 ; 1,820 ; 1,762 ;
  1,582), la concentration des gains (1 % des trades → 58 % de la croissance), les durées de
  détention, la rotation (≈ 157 × le capital par an en volume aller-retour) et le test d'entrée
  retardée d'une bougie (83 % du gain moyen gardé sur BTC, 94 % sur ETH).
- Une extrapolation linéaire de ce stress, faite dans l'audit : Sharpe 1,5 vers 6,4 pb et 1,0 vers
  14,8 pb par ordre. Elle sera recalculée ici, pas reprise.
- Le format des fichiers Binance (un fichier `bookDepth` et un fichier `aggTrades` du 2024-01-01,
  ouverts pour lire les colonnes). **Aucune donnée Binance n'a été lue aux instants des signaux.**

## 3. Capital, tailles d'ordre, frais

- Grille : 100 k$, 250 k$, 500 k$, 1 M$, 5 M$ ; grille fine pour situer les seuils : 30 points
  log-espacés de 50 k$ à 100 M$.
- **Capital fixe par niveau** : chaque sleeve vaut A/2 et investit 100 % sans levier, comme le
  backtest. Taille d'un ordre d'entrée Q = A/2 ; TP1 = part du TP1 × A/2 ; sortie finale = le reste.
  Les coûts en points de base sont calculés pour ces tailles, puis appliqués aux rendements du
  backtest (qui capitalise) : le capital est supposé maintenu autour de A.
- **Commissions : pas de double compte.** Le backtest paie déjà 0,045 % par exécution (entrées,
  sorties, TP1 compris). Les coûts ajoutés ici excluent toute commission. Paliers de frais et écart
  entre plateformes (taker Binance de base, paliers Hyperliquid) : sensibilité seulement, hors
  résultats principaux.

## 4. Périodes

- Budget de coûts (P0) : période officielle 2018-09-01 → 2026-09-30, et fenêtre Binance.
- Fenêtre Binance (P1) : 2020-01-01 → 2026-09-30 (les fichiers perpétuels commencent en
  janvier 2020). Toutes les comparaisons nettes / brutes se font sur la même fenêtre.
- `bookDepth` : depuis 2023-01-01 seulement.

## 5. Mesures (P0)

1. **Budget uniforme** : Sharpe, CAGR, Sortino, drawdown du portefeuille pour un coût ajouté
   c ∈ {0, 0,5, 1, 2, …, 40} pb par exécution ; c* pour Sharpe 1,5 et 1,0 (interpolation linéaire
   sur la grille), sur chaque période.
2. **Par type d'exécution** : c appliqué seulement (a) aux entrées, (b) aux stops (SL et stop
   suiveur), (c) aux TP1, (d) aux sorties à la clôture (retournement, flip, VWAP, fin de données).
   Même grille, mêmes seuils.
3. **Top 5 %** : trades classés par rendement net (ex post, descriptif) ; c appliqué seulement aux
   exécutions des 5 % meilleurs, puis seulement aux 95 % autres. Distribution du rendement des
   5 % meilleurs et coût par exécution qui les ramènerait à zéro.
4. **Incertitude** : bootstrap par blocs mensuels (mêmes mois tirés pour toutes les variantes,
   2 000 réplications, graine 20261012) ; intervalle à 90 % du Sharpe et de c*.

## 6. Mesures (P1, données Binance gratuites)

### 6.1 Instants

- Décision d'entrée : clôture de la bougie de signal, t0 = ouverture + 15 min. Prix de décision
  sur le perpétuel P0 = dernier prix avant t0 (clôture de la bougie 1 min qui finit à t0 ; dernier
  trade avant t0 avec `aggTrades`). Même règle pour les sorties à la clôture.
- Stops, stop suiveur et TP1 se déclenchent dans une bougie ; leur instant sur le perpétuel est la
  première minute (ou le premier trade, avec `aggTrades`) de cette bougie où le prix du perpétuel
  franchit le niveau converti, niveau × (P0 du perpétuel / prix d'entrée du backtest). Sans
  franchissement trouvé, l'exécution est marquée « non localisée » et comptée à part.

### 6.2 Pas de fuite d'information

- Toute variable de conditionnement (volatilité, volume, profondeur, régime) est calculée
  strictement avant l'instant de décision : volatilité des rendements 1 min sur les 24 h (et
  60 min) précédentes, volume des 24 h précédentes, dernier instantané `bookDepth` à ou avant t0.
- Les grandeurs postérieures (dérive du prix, volume réalisé) ne servent que de résultats.
  L'exécution en participation au volume (POV) suit le volume réalisé, comme un algorithme POV réel.
- Les strates du pilote utilisent le résultat des trades (ex post) : descriptif seulement.

### 6.3 Disparition de l'avantage (entrées)

D(τ) = sens × (P(t0 + τ) − P0) / P0, en pb, pour τ = 10 s, 30 s (pilote `aggTrades`), 1, 3, 5,
15 min (échantillon complet, bougies 1 min, et pilote). Rapportée en moyenne, médiane, intervalle à
95 % (bootstrap par trade), par actif, et en part du rendement brut moyen par trade. Même mesure
après le déclenchement des stops (poursuite défavorable). Dérive d'une exécution étalée :
sens × (VWAP[t0, t0 + τ] − P0) / P0.

### 6.4 Liquidité observable

Pour chaque niveau de capital et chaque exécution :
- participation Q / V(τ) au volume réalisé du perpétuel sur 1, 5 et 15 min après l'instant ;
- durée nécessaire à 10 % de participation : τ_req = premier τ (minutes) où le volume cumulé ≥ Q / 0,1 ;
  plafond 60 min (au-delà : « limité par la liquidité ») ;
- Q / profondeur du côté consommé à ±1 % (`bookDepth`, depuis 2023). **Cet indicateur n'est jamais
  converti en coût en points de base** : à ±1 %, la profondeur agrégée ne dit rien d'une exécution
  à quelques points de base.
- périodes de choc : instants dans les 5 % de volatilité 60 min la plus haute, ou dont la
  profondeur à ±1 % est inférieure à 50 % de sa médiane des 7 jours précédents ; liste datée.

### 6.5 Coûts estimés par modèle (pas mesurés)

Coût d'une exécution, en pb, hors commission :

coût = demi-spread + impact + dérive

- **Demi-spread** : estimé sur le pilote `aggTrades` (écart entre prix des achats et des ventes
  agresseurs dans la même seconde, médiane par actif) ; à défaut, un tick.
- **Impact** : loi en racine carrée, I = Y · σ_J · √(Q / V_J), σ_J = volatilité journalière
  (rendements 1 min des 24 h précédentes × √1440), V_J = volume en dollars des 24 h précédentes.
- **Dérive** : entrées et sorties à la clôture exécutées en POV 10 % sur τ_req ; dérive mesurée
  sur les données (6.3), trade par trade. Stops : exécution immédiate, sans dérive ni fractionnement.
- **Scénarios** (fixés ici, non calibrés) :

| Scénario | Y | Volatilité | TP1 | Stops |
|---|---|---|---|---|
| Optimiste | 0,5 | 24 h | ordre limite, sans coût (comme le backtest) | demi-spread + impact |
| Central | 1,0 | 24 h | ordre limite, sans coût | demi-spread + impact |
| Prudent | 2,0 | max(24 h, 60 min) | payé comme un ordre au marché | demi-spread + impact + poursuite moyenne à 10 s mesurée sur le pilote |

Y est de l'ordre de 1 dans la littérature (Tóth et al., 2011 ; Bouchaud et al., 2018) ; il n'est
**pas** calibré ici. Sensibilités : POV 5 % et 20 %, exécution immédiate des entrées.

- Exécution sans données (bougie manquante, stop non localisé) : coût de la médiane de son actif,
  de son type et de son niveau de capital ; nombre rapporté.

## 7. Critères (fixés ici)

Pour chaque scénario, sur la fenêtre Binance, le capital A* est le plus petit point de la grille fine
où le critère est atteint (interpolation log-linéaire entre deux points) :

- **C1** : Sharpe net < 1,5 ;
- **C2** : Sharpe net < 1,0 ;
- **C3, perte de l'avantage statistique** : la borne basse à 90 % du Sharpe net (bootstrap par mois)
  ≤ 0.

Les intervalles de A* viennent du bootstrap (C1, C2 : A où la borne haute, puis basse, du Sharpe
franchit le seuil). L'incertitude de modèle est l'écart entre scénarios ; les deux ne sont pas
fusionnés.

## 8. Pilote `aggTrades` (échantillon fixé ici)

- Univers : positions du portefeuille E2 entrées et sorties dans la fenêtre Binance.
- Par actif, 6 trades tirés au hasard (graine 20261012) dans chacune des strates : (a) 5 % meilleurs
  trades, (b) 20 % plus mauvais, (c) volatilité 60 min à l'entrée dans le décile le plus haut (hors
  a et b), (d) tous les autres. 48 trades au total ; jours téléchargés : jour d'entrée et jour de
  sortie.
- Mesures : D(τ) de 10 s à 15 min, demi-spread, volume par fenêtre, poursuite après stop à 10 s et
  30 s, cohérence avec les bougies 1 min (D(1 min) des deux sources).

## 9. Intégrité des données

- Chaque fichier : somme SHA-256 comparée au fichier `.CHECKSUM` de Binance ; refus sinon.
- Bougies 1 min : une ligne par minute, horodatages croissants sans doublon, trous comptés et listés.
- `aggTrades` : identifiants consécutifs, horodatages croissants ; trous comptés.
- `bookDepth` : cadence des instantanés, trous de plus de 5 min comptés.
- Données brutes hors git (`research/data/binance/`). Le dépôt ne garde que des agrégats : aucun
  horodatage de trade n'est publié.

## 10. Tardis (premier jour de chaque mois)

L'accès est bloqué depuis l'environnement de calcul. S'il est rétabli : test de représentativité
avant toute calibration — part des instants de signal dont (σ_J, V_J, profondeur à ±1 %) tombent
dans l'enveloppe couverte par les jours gratuits (critère : ≥ 90 %), et comparaison des
distributions (Kolmogorov–Smirnov, rapportée sans seuil de décision). Aucune calibration de l'impact
sur ces jours si le critère échoue.

## 11. Limites connues à l'avance

- La loi en racine carrée n'est pas calibrée sur ce marché ; Y est un scénario.
- Le volume et la profondeur visibles surestiment la liquidité disponible pour un preneur dans les
  chocs (annulations rapides) ; aucune donnée gratuite ne le mesure.
- Pas de carnet fin (0 à 100 pb) : aucun coût « carnet » n'est calculé.
- Écart de marché signal / exécution, et période en échantillon pour la stratégie.
- Les conclusions sur 1 M$ et 5 M$ sont des estimations de modèle ; seule une exécution réelle
  validerait l'impact.
