# Pré-spécification — Transfert de Shock Engine V1 aux futures GC et NQ : étude d'événement, puis seuil k seul

Rédigé le 2026-10-20 et commité **avant toute donnée GC ou NQ** : aucune n'est disponible dans
l'environnement à cette date (`research/futures-transfer/DATA.md`). Les scripts de calcul seront
écrits après réception des données, conformément à ce plan ; tout écart fera l'objet d'un nouveau
protocole daté et commité avant le calcul concerné. Audit de la méthode historique dont ce plan
s'inspire : `research/futures-transfer/AUDIT.md`. Grille et contrôle de l'interaction des seuils :
`research/futures-transfer/lib/k-grid.ts`, `research/tests/futures-k-grid.test.ts`.

## 0. Cadre

- **V1 BTC/ETH figée.** Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`,
  `research/lib/e2.ts`, `research/lib/calm-only.ts`, du bot (`bot/`) ni du site n'est modifié ;
  leurs empreintes SHA-256 sont vérifiées avant et après chaque calcul (contrôle bloquant). Aucun
  ordre réel ni testnet.
- **Confidentialité.** Le dépôt est public. Aucun fichier versionné de cette étude n'écrit une valeur
  absolue de seuil (seuil BTC de V1, k retenus, seuil quantile). Les rapports versionnés donnent les
  seuils en écart à la valeur retenue (Δk = k − k*) ; les valeurs absolues vont dans
  `research/private/futures-transfer/` (exclu de git), sauf autorisation écrite du propriétaire.
- **Ce qui est déjà connu.** L'or n'est pas un marché vierge pour ce projet : V1 a déjà été appliquée
  telle quelle à l'or **comptant** XAU/USD (Dukascopy, 2013-01 → 2026-09,
  `research/reports/shock-15m-zeroshot-xauusd-calm.md`) : critère d'étude d'événement non rempli
  (signaux et chocs bruts), stratégie à coûts crypto × 1 : 319 trades, Sharpe 0,40, profit factor
  1,27, meilleure que 99,5 % des entrées au hasard ; Sharpe −0,12 à coûts × 2. Le comptant et GC
  sont très corrélés : l'étude GC n'est pas aveugle. Le Nasdaq-100 n'a jamais été testé dans le
  dépôt : l'étude NQ l'est.
- **Pas de substitution.** XAU/USD comptant, CFD (Dukascopy USATECH.IDX/USD…), ETF (GLD, QQQ),
  perpétuels crypto sur or ou indices : interdits comme données principales ou de remplacement.

## 1. Données (exigences ; sinon arrêt et conclusion D)

**Instruments.** GC : COMEX, 100 onces, pas 0,10 $ (10 $ par pas). NQ : CME E-mini Nasdaq-100,
20 $ × indice, pas 0,25 (5 $ par pas). Contrats ferme seulement (pas d'écarts entre échéances) ; les
micros (MGC, MNQ) ne servent pas de source principale.

**Source.** Prix CME Globex par contrat (par exemple Databento GLBX.MDP3, OHLCV 1 min, depuis
2010-06-06) ou fournisseur équivalent, avec volume de chaque contrat. Couverture minimale : du
2012-01-01 au plus tard jusqu'au 2026-06-30 au plus tôt. Horodatage UTC de l'ouverture de la barre.

**Construction de la série continue.**
- Barres de 15 min alignées sur les quarts d'heure UTC, construites depuis les minutes ; une minute
  sans transaction est absente (pas de bougie plate ajoutée, comme pour Bitstamp et Dukascopy).
- Roulement : contrat de tête = le plus échangé. Passage au contrat suivant à l'ouverture de la
  séance (17 h, heure de Chicago) qui suit la première séance où son volume dépasse celui du contrat
  de tête ; jamais de retour en arrière. Échéances éligibles : GC février, avril, juin, août,
  octobre, décembre ; NQ mars, juin, septembre, décembre.
- Ajustement multiplicatif : tous les prix antérieurs au passage sont multipliés par
  F = clôture du nouveau contrat / clôture de l'ancien, sur la dernière barre de 15 min où les deux
  ont traité avant le passage. Le rendement de la barre de passage est celui du nouveau contrat. Les
  prix non ajustés sont gardés en parallèle pour les coûts en pas de cotation.
- Fuseaux et heure d'été : tout est en UTC ; les séances sont dérivées de l'heure de Chicago et de
  New York par la base IANA (`Intl`), ce qui traite les changements d'heure américains et les
  semaines de décalage avec l'Europe.
- Trous : une barre ouverte plus de 15 min après la précédente suit une fermeture (pause quotidienne
  16 h – 17 h heure de Chicago, week-end, jour férié, incident). Règle déjà figée dans V1
  (`frozen-shock.ts`) : pas d'entrée sur cette barre ; les positions restent exposées au saut.
- Barres journalières du régime : jours de séance clos à 22 h UTC et datés du lendemain minuit UTC
  (fonction `sessionDays` de `research/shock/zero-shot.ts`, déjà utilisée pour les actifs non crypto),
  jamais lus avant leur clôture. Filtre 60 min : barres horaires tirées des barres de 15 min
  (`marketFor`), inchangé.
- Contrôles bloquants : horodatages strictement croissants ; bas ≤ min(ouverture, clôture) ≤
  max(ouverture, clôture) ≤ haut ; prix > 0 ; barres de 15 min manquantes pendant les heures Globex
  prévues (hors jours fériés et clôtures anticipées constatés comme séances entières absentes)
  < 1 % par an ; au plus 10 trous imprévus de plus de 60 min par an ; mauvais ticks : barres dont le
  haut ou le bas s'écarte de plus de 8 ATR(14) à la fois de la clôture précédente et de la clôture de
  la barre, listées, et arrêt pour revue (nouveau protocole) au-delà de 20 par instrument.
- Empreinte SHA-256 de chaque fichier d'entrée publiée dans l'audit des données. Les données ne sont
  jamais commitées (licence du fournisseur, dépôt public) : `research/data/futures/` est exclu de git.

**Séances (lecture seulement, jamais pour filtrer ni sélectionner).** Plages horaires de New York
déjà utilisées dans le projet : Asie 18 h – 2 h, Londres 2 h – 8 h, New York matin 8 h – 12 h (dont la
bougie de 8 h 30), New York après-midi 12 h – 18 h. En plus : NQ séance régulière 9 h 30 – 16 h ET
contre séance étendue ; GC séance de jour COMEX 8 h 20 – 13 h 30 ET contre le reste.

**Événements économiques (lecture et sensibilité seulement).** Étiquette par créneau de la bougie du
choc : 8 h 30 ET (publications macro américaines), 10 h ET, 14 h – 14 h 45 ET (communiqués et
conférences du FOMC). Si un calendrier officiel est obtenu (calendriers FOMC de la Réserve fédérale,
calendriers CPI et emploi du BLS), il sert à étiqueter les jours ; sinon, étiquette de créneau seule,
dite comme telle. Résultats donnés avec et sans les événements des créneaux étiquetés. Aucun filtre
d'événements n'est ajouté à la stratégie (ce serait un nouveau paramètre).

## 2. Détecteur et stratégie figés

Chemin de `research/shock/zero-shot.ts --calm` et de `research/lib/frozen-shock.ts` : préréglage
adaptatif 15 min (`adaptivePreset(15, pas)`), régime de volatilité sur les jours de séance, entrées
impulse seulement, bougie qui suit un trou exclue, shorts limités au régime de tendance journalier
baissier (E2), aucune nouvelle entrée en régime agité (V1), sorties, stop, absence de TP1 et de stop
suiveur, sortie sur signal inverse, taille 100 % du capital sans levier. Pas de cotation : GC 0,10,
NQ 0,25. Dans la grille, seul `kMain` du jeu calme change (`withK`).

**Contrôle de parité (bloquant), avant toute donnée futures :** le harnais, appliqué à BTC avec le
seuil figé, redonne exactement la sleeve BTC publiée de V1 (358 trades et Sharpe de
`research/reports/reference/reference.json`).

## 3. Étape 1 — étude d'événement au seuil figé de V1, avant toute calibration

Familles d'événements (période d'évaluation complète, du début de l'évaluation au dernier mois
complet) :
- **F1 (principale) :** entrées qualifiées de V1 au seuil figé (régime calme, E2, masque des trous).
- F2 : chocs bruts |z| > seuil figé en régime calme, hors bougies après trou, sens = signe du rendement.
- F3 : chocs bruts de F2 dans le sens de la tendance 60 min.
- F4 (descriptif) : chocs bruts en régime agité (V1 n'y entre pas).

Horizons : 1, 4, 16 et 64 bougies, comptées en barres de 15 min existantes (temps de cotation, les
fermetures sont sautées). Part des événements dont la fenêtre traverse une fermeture de plus d'1 h
rapportée.

Mesure : x = sens × (C[i+h] − C[i]) / ATR_i (ATR du jeu calme à la bougie de l'événement) ; excès =
x − sens × mouvement moyen de toute bougie de la même année au même quart d'heure **de New York**
(méthode de `zero-shot.ts`, créneau en heure de New York parce que les séances suivent l'heure d'été
américaine ; quart d'heure UTC en sensibilité).

Statistiques par famille et horizon : nombre d'événements ; moyenne et médiane de x et de l'excès ;
intervalles à 90 % et 95 % par bootstrap des mois civils (5 000 tirages, graine 20261020) ; t de la
moyenne de l'excès avec erreur type robuste par grappes de mois (principal) et t de Newey–West sur la
série journalière des excès sommés, retard ⌊4 (T/100)^(2/9)⌋ (secondaire) ; moitiés de la période
(coupure au milieu en nombre de bougies, comme `zero-shot.ts`) ; part des années positives. Découpages : long / short, régime calme /
agité (F2 – F4), plages horaires, créneaux d'événements.

Falsification (méthodes du projet) :
- **Événements au hasard** : 2 000 tirages, autant d'événements par (année × sens × régime) que
  l'observé, tirés uniformément parmi les bougies admissibles (hors trous, même régime, même année),
  sens de l'observé ; p unilatéral = part des tirages dont l'excès moyen ≥ l'observé.
- **Signaux décalés** : entrées décalées de +1, +2 et +4 bougies ; −1 et −2 (lisent le futur) en
  contrôle seulement.

**Porte « phénomène présent » (par marché, famille F1), toutes conditions requises :**
- G1 — critère de `zero-shot.ts` à 4 et à 16 bougies : excès > 0, borne basse de l'intervalle à 90 %
  > 0, deux moitiés > 0, au moins 60 % des années positives ;
- G2 — événements au hasard : p < 0,05 à 16 bougies ;
- G3 — au moins 150 événements F1.

Les deux horizons sont exigés ensemble (test d'intersection-union, sans correction). En lecture,
p ajustés de Holm sur les 4 familles × 4 horizons. Si la porte échoue, la conclusion est au mieux C ;
les étapes suivantes sont quand même calculées et rapportées en entier.

## 4. Étape 2 — grille du seuil k seul

- Grille : k de 1,5 à 4,0 par pas de 0,1 (26 valeurs), `kMain` du jeu calme seulement. Le jeu calme
  n'utilise pas les micro-chocs : k y est le seul seuil de choc, et il déplace ensemble le
  déclencheur, le filtre λ des longs et les sorties sur signal inverse (choc principal), comme dans
  le code d'origine ; ces trois effets restent couplés.
- **Configurations effectives** : deux valeurs de k dont les entrées long et short et les signaux de
  sortie inverse sont identiques sur toute la période d'évaluation forment une seule configuration
  (`effectiveConfigs`) ; N_eff est rapporté et seul il compte dans les corrections.
- Pour chaque k : simulation complète du chemin V1, enregistrements par position (entrée, sortie,
  rendement net), rendements journaliers. Courbes de robustesse selon k : note S par pli, Sharpe,
  profit factor, trades, excès d'étude d'événement à 16 bougies.

## 5. Méthode A — seuil z fixe par actif, choisi à l'entraînement

**Statistique principale (celle de `regime-wf.ts`, `choose`)** sur une fenêtre d'entraînement W :
- positions entrées dans W et sorties avant la fin de W (purge) ; la fin de W précède d'un jour civil
  le début du test (embargo) ;
- coupure de W en deux moitiés au milieu de la fenêtre en nombre de bougies (comme `choose`) ; t_h = moyenne / écart type (n − 1) × √n des
  rendements nets par position (pnl / capital à l'entrée) de la moitié h ; au moins 15 positions par
  moitié, sinon S = −∞ ;
- **S(k) = min(t_1, t_2).**

**Plateau** (philosophie de `wf-plateau.ts`) : P(k) = moyenne de S(k − 0,1), S(k), S(k + 0,1), pour
k de 1,6 à 3,9 seulement ; −∞ si l'une des trois est −∞. Choix : k* = argmax P, ex aequo vers le k le
plus grand ; le pli n'est tradé que si P(k*) ≥ 1 (seuil `tmin` de `regime-wf.ts`).

**Périodes.**
- Préchauffage : les 12 premiers mois de données ne sont jamais évalués. Début de l'évaluation E0 =
  le 1er janvier qui suit la fin du préchauffage, au plus tôt le 2012-01-01.
- **Validation (walk-forward)** : entraînement ancré et croissant depuis E0, tests annuels 2015, 2016,
  …, 2022 (8 plis), recalage au 1er janvier. Une seule simulation continue 2015-01-01 → 2022-12-31,
  où chaque bougie utilise le k* de son pli (moteur multi-jeux : une position garde le jeu qui l'a
  ouverte), masques V1 et E2 inchangés.
- **Modèle final** : k_final choisi sur E0 → 2022-12-30 (embargo), puis figé.
- **Test final (hold-out)** : 2023-01-01 → dernier mois complet, exécuté une seule fois, après le
  commit des résultats de développement (le script refuse de tourner si ce commit est absent).

## 6. Méthode B — seuil au quantile historique

- À chaque recalage (mêmes plis, même modèle final), k_B = Q_0,99(|z|), z = z-score du jeu calme
  (`prepare`), calculé sur les seules bougies de la fenêtre d'entraînement (hors trous, régime calme),
  jamais sur l'historique complet ; valeur continue, figée pendant le test.
- q = 0,99 est fixé ici (exemple de l'énoncé) ; aucun autre quantile n'est évalué dans l'analyse
  confirmatoire. En lecture seulement (fichier privé) : le niveau de quantile que représente le seuil
  BTC de V1 sur BTC 2017-01-01 → 2026-10-04.
- B n'a aucun paramètre libre sur GC ou NQ : il compte pour un essai.
- A et B sont deux stratégies distinctes évaluées sur les mêmes périodes ; ni hybride, ni choix entre A
  et B pli par pli. Leur comparaison est comptée dans les corrections (§ 9).

## 7. Évaluation économique

**Scénarios de coûts** (hypothèses explicites, pas des mesures) :

| scénario | frais par côté et par contrat (bourse, compensation, NFA, courtier) | glissement par ordre au marché ou stop |
| --- | ---: | ---: |
| bas | 2,00 $ | 0,5 pas |
| **référence** | **3,50 $** | **1 pas** |
| haut | 5,00 $ | 2 pas |
| stress | 5,00 $ | 4 pas |

Convertis en pourcentage du nominal au prix **non ajusté** d'entrée et de sortie (nominal = prix ×
multiplicateur : GC 100, NQ 20) et déduits position par position d'un run sans coûts, capital
recomposé à partir des rendements par position (exact pour une taille de 100 % du capital sans
positions simultanées). Taille : 100 % du capital en nominal, sans levier, fractions de contrat
admises (atteignables en pratique avec les micros à partir d'environ 40 à 50 k$ ; l'arrondi au contrat
entier n'est pas modélisé). Rendement de la trésorerie déposée en marge : 0 (non compté).

Mesures (fonctions du projet, `metricsOf`) : CAGR ; Sharpe journalier et Sharpe corrigé de
l'autocorrélation (Lo, 2002, autocorrélations des rendements journaliers jusqu'au retard 10) ;
Sortino ; Calmar ; drawdown maximal ; profit factor ; trades ; exposition ; taux de gain, gain et perte
moyens, payoff, asymétrie, part des 5 % meilleurs trades ; par année et par moitié ; courbe de coûts
(× 0 ; 0,5 ; 1 ; 2 ; 4 du scénario de référence) et coût de rentabilité nulle. Falsification au niveau
stratégie : 500 tirages d'entrées au hasard à sorties identiques et même nombre de trades ; entrées
décalées de +1, +2, +4 bougies.

## 8. Critères d'acceptation (fixés ici)

Pour chaque marché et chaque méthode M ∈ {A, B}, coûts de référence sauf mention :
- **C1** — porte « phénomène présent » du § 3 franchie par le marché.
- **C2** — validation 2015 – 2022 : Sharpe > 0,3 et profit factor > 1,1 (seuils de `zero-shot.ts`) ;
  au moins la moitié des années de validation positives.
- **C3** — test final : Sharpe > 0 et profit factor > 1,0 ; profit factor > 1,0 au scénario haut sur
  validation + test final.
- **C4** — hors échantillon complet (validation + test final) : Sharpe corrigé de Lo
  significativement > 0, test unilatéral, risque global 5 % par la méthode de Holm sur les 4
  hypothèses (2 marchés × 2 méthodes).
- **C5** — hors échantillon complet : meilleure qu'au moins 90 % des entrées au hasard ; entrée
  retardée d'une bougie : au moins 50 % du gain moyen par trade.
- **C6** (méthode A) — plateau : dans la calibration finale, k_final et ses deux voisins de chaque côté
  (± 0,1, ± 0,2) ont tous S ≥ 1 (plateau d'au moins 0,4 de large) ; CSCV-PBO (16 blocs, configurations
  effectives, Sharpe journalier sur la période de développement) < 0,5.
- **C7** — Sharpe dégonflé (Bailey et López de Prado, 2014) du hors échantillon complet ≥ 0,95 avec
  N = N_eff + 1 essais (les deux méthodes comptées) et la dispersion des Sharpe de la grille ; en
  lecture, N = 222 et N = 6 266 (lignée BTC).

**Conclusion par marché (une seule) :**
- **D** — exigences de données du § 1 non remplies (les étapes 1 à 7 ne sont pas calculées) ;
- **C** — C1 non remplie ;
- **A** — C1 remplie et, pour au moins une méthode, C2 à C7 toutes remplies (la méthode est nommée ;
  si les deux passent, aucune n'est choisie pour un usage réel sans nouveau protocole) ;
- **B** — C1 remplie, mais aucune méthode ne remplit C2 à C7.

La configuration retenue (k_final, ou la règle quantile) n'est rapportée, dans le fichier privé, qu'en
conclusion A.

## 9. Tests multiples (récapitulatif)

- Porte : intersection-union sur 4 et 16 bougies (pas de correction) ; Holm en lecture sur 16 tests.
- Grille : configurations identiques fusionnées (N_eff) ; critère min des deux moitiés ; plateau.
- Méthodes : Holm sur 2 marchés × 2 méthodes (C4) ; Sharpe dégonflé avec N_eff + 1 (C7) ; PBO (C6).
- Les résultats d'entraînement, de validation et de test final sont rapportés séparément ; aucun n'est
  présenté comme un autre.

## 10. Reproductibilité

- Graine 20261020 pour tous les tirages. Scripts, paramètres et rapports versionnés ; données et
  valeurs absolues de seuil hors de git (§ 0, § 1), avec empreintes.
- Rapports publics : `research/reports/futures-transfer/{gold,nasdaq}/` ; fichiers privés :
  `research/private/futures-transfer/`.

## 11. Interdits

Changer après avoir vu des données GC ou NQ : la grille, la statistique S, le plateau, le seuil 1, les
périodes, l'embargo, les scénarios de coûts, la porte, les horizons, q ; ajouter un filtre (séance,
événements, régime, volume) ou un réglage à la stratégie ; choisir entre A et B pli par pli ; utiliser
des données au comptant, CFD, ETF ou perpétuelles à la place des futures ; lancer le test final avant
le commit des résultats de développement ; lancer une optimisation multidimensionnelle des 606
configurations sur GC ou NQ.
