# EVMC : moteur de recherche Rust

Moteur d'évaluation de prévisions probabilistes multi-horizon, construit d'après la
spécification du MVP. Chaque modèle écrit dans la même table de prévisions ; chaque prévision
est jointe à son réalisé, notée contre des baselines, avec intervalles par bootstrap de blocs.

## État des jalons

| Jalon | Contenu | État |
| --- | --- | --- |
| M0 | Données, configuration, découpage figé, tables Parquet, manifest | fait |
| M1 | Outcomes multi-horizon, baselines fermées, scores, métriques, bootstrap, HAC, rapport | fait |
| M2 | Filtres de volatilité, pool FHS, noyau Monte Carlo, arrêt adaptatif, `bench` | fait |
| M3, M5 | Port du script Pine : facteurs, phases, chaîne de Markov, éventail dirigé, cible, chemin typique (`legacy_full`) | fait, non validé contre TradingView |
| — | Évaluation du chemin typique, pas par pas et par régime | fait |
| M4 | Alpha Ridge, `TrainView`, modèles `v2_*`, ouverture du holdout | à faire |
| M5 | Ablations `legacy_no_*` | à faire |
| M6 | Run complet en zone dev sur données réelles | fait sur BTC/USD journalier |

Modèles disponibles : `b1_coin`, `b2_clim`, `b3_zero`, `b4_rw`, `b5_drift`, `b6_ewma`,
`b7a_garch_gauss`, `b7_garch_fhs`, et `legacy_full`, le script Pine porté tel quel. Un
identifiant `v2_*` ou `legacy_no_*` dans la configuration est refusé avec le jalon auquel il
est prévu.

## Prérequis

Rust 1.97 (fixé par `rust-toolchain.toml`), dépendances fixées par `Cargo.lock`.

```
cargo build --release --locked
cargo test --release
```

## Données attendues

Un CSV avec en-tête. Colonnes reconnues, sans tenir compte de la casse :
`time` (ou `ts`, `timestamp`, `date`, `open_time`), `open`, `high`, `low`, `close`, `volume`.
Les autres colonnes sont ignorées, ce qui accepte un export TradingView tel quel.

`data.ts_convention` dit comment lire l'horodatage : `open_utc_ms`, `open_utc_s`,
`close_utc_ms` ou `open_iso` (ISO 8601, avec `Z` ou un décalage `+HH:MM`).

Un fichier est rejeté si un horodatage recule ou se répète, si une barre est incohérente
(High sous Open ou Close, prix nul, volume négatif, valeur non finie). Un trou de données est
signalé, jamais comblé ; aucune fenêtre d'outcome ne le traverse.

### Construire les barres depuis un historique à la minute

```
evmc data resample --input historique_1min.csv --input mises_a_jour_1min.csv \
                   --out data/btcusd_bitstamp_1d.csv --timeframe 1d
```

Les barres sont alignées sur les multiples du timeframe depuis l'époque Unix : minuit UTC en
journalier, 00 h, 04 h, 08 h… en 4 heures. Une barre n'est écrite que si toutes ses minutes
sont présentes et si son volume est strictement positif : un jour sans échange devient un
trou signalé, pas une barre plate. `--timeframe 4h`, `1h` ou `15m` donnent les autres
résolutions depuis la même source ; `--from AAAA-MM-JJ` fixe la première date gardée.
Le fichier écrit se lit avec `ts_convention = "open_utc_ms"`.

### Jeu de données BTC fourni

`configs/btc_1d.toml` pointe sur `data/btcusd_bitstamp_1d.csv` : BTC/USD Bitstamp, barres
journalières UTC du 2 janvier 2012 au 2 octobre 2026, 5 385 barres, un trou de trois jours
(6 au 8 janvier 2015, échange arrêté). `data/btcusd_bitstamp_4h.csv` contient les barres de
4 heures de la même source, pour l'ancre de VWAP « 4h » du script Pine. Source des barres à la minute :
<https://github.com/ff137/bitstamp-btcusd-minute-data> (licence MIT). Le symbole TradingView
correspondant est `BITSTAMP:BTCUSD` ; un export Pine de référence doit être fait sur ce
symbole pour être comparable barre à barre.

Le découpage de ce jeu est figé dans `configs/btc_1d.split.lock.toml` : zone notée du
13 février 2016 au 10 janvier 2025, holdout de 630 barres ensuite. Ajouter des barres au CSV
change son hash et invalide ce lock : un jeu prolongé est un autre jeu, avec son propre lock.

```
evmc run --config configs/btc_1d.toml
```

## Ordre d'exécution

```
evmc data check  --config configs/mvp.toml     # intégrité, hash logique
evmc split plan  --config configs/mvp.toml     # une seule fois : écrit le lock
evmc run         --config configs/mvp.toml     # features -> outcomes -> forecast -> evaluate -> report
evmc verify      --run runs/<run_id>           # recalcule les hash et les compare au manifest
evmc dashboard   --config configs/mvp.toml     # réécrit seulement le tableau de bord du run
evmc bench       --config configs/mvp.toml     # débit du noyau et convergence par profil
```

Options communes : `--profile fast|normal|validation`, `--models a,b`, `--threads N`, `--out dir`.
Les étapes `features`, `outcomes`, `forecast`, `evaluate`, `report` existent aussi séparément ;
chacune relance ses dépendances depuis le cache.

Essai immédiat sur une série synthétique :

```
evmc synth --out data/synth_1d.csv --n 4000 --seed 1 --t-df 5
evmc split plan && evmc run --profile fast
```

## Sorties

`runs/<run_id>/` contient `features`, `outcomes`, `forecasts`, `scores`, `metrics`,
`reliability` (Parquet), `manifest.json` et `report/` (`dashboard.html`, `summary.md`,
`metrics_dev.csv`, `metrics_folds.csv`, `reliability.csv`). `runs/cache/` garde chaque table sous la clé de ses
entrées : changer la section `[eval]` ne relance ni les features ni les prévisions.

## Port du script Pine

`src/legacy/` reprend le script « EVMC Directional » sous ses réglages par défaut
(`configs/legacy_defaults.toml`, une clé par input) : mêmes formules, même ordre de calcul,
même générateur aléatoire. `engine.rs` est `f_engine`, exécuté barre par barre ; `project.rs`
est le bloc que le script lance sur la dernière barre, exécuté ici à chaque origine notée comme
si le graphique venait d'être chargé ce jour-là. Activer le modèle : ajouter `"legacy_full"` à
`models.enabled`.

Tables produites : `legacy_paths` (chemin typique, squelette, mèches et éventail, par origine
et par pas de 1 à 120), `legacy_state` (régime, score, facteurs, phase, cible, murs, par
origine), `legacy_dist` (loi simulée aux horizons de la grille, jointe à `forecasts` sous
l'identifiant `legacy_full`), puis `path_metrics` et `path_select`.

L'ancre de VWAP « 4h » du script demande des barres de 4 heures quand le graphique est
journalier : `data.aux = [{ timeframe = "4h", path = "…" }]`. Sans elles, l'ancre est calculée
sur les barres du graphique. `[legacy] h24` et `mintick` remplacent ce que le script lit dans
`syminfo`.

Ce port n'a pas été comparé à TradingView : il manque un export de référence. Écarts connus :
`ta.ema` amorcée par une moyenne simple (effet éteint après le warm-up) ; pas de mémoire du
panier d'analogues d'une barre à l'autre ; `ta.stdev` et `ta.rma` égaux à l'arrondi près ;
profondeur de l'historique 4 heures de TradingView inconnue. Une relecture ligne à ligne,
indépendante, n'a pas relevé d'autre écart.

### Évaluation du chemin typique

Pour chaque pas h de 1 à 120 barres, sur toutes les origines notées : part des origines où le
chemin annonçait le bon sens, corrélation entre rendement annoncé et réalisé, erreur absolue
comparée à l'hypothèse « prix inchangé ». La référence de direction est la dérive historique :
sur un actif qui monte, annoncer « hausse » chaque jour donne déjà plus d'une fois sur deux
raison. Les mêmes mesures sont données par régime (volatilité, régime directionnel, phase,
état de Markov) et par pli. `path_select` choisit le meilleur pas sur les plis passés et le
note sur le pli suivant : choisir et noter sur les mêmes données flatte toujours le résultat.

## Tableau de bord

`runs/<run_id>/report/dashboard.html` s'ouvre par double-clic dans un navigateur. La page est
un seul fichier : données du run incluses, aucun serveur, aucune bibliothèque de graphiques.
Seules les polices viennent du réseau, avec repli sur celles du système. `evmc run` et
`evmc report` l'écrivent ; `evmc dashboard` la réécrit seule. L'option `--fragment` ajoute
`dashboard.fragment.html`, la même page sans l'enveloppe du document, pour l'inclure ailleurs.

Cinq vues :

- Graphique : bougies, chemin typique d'EVMC en bougies colorées avec son squelette et sa
  cible, murs de volume, éventail du modèle choisi, état du script à l'origine, tableau annoncé
  contre réalisé.
- Backtest : choix d'une stratégie, de ses réglages et de son exécution ; performance,
  drawdown, statistiques, comportement après l'entrée, liste des trades, rang face à 300
  stratégies aux entrées tirées au sort.
- Chemin typique : taux de bonne direction, avantage sur la dérive, corrélation et précision
  selon le nombre de barres ; par régime ; meilleur horizon choisi sur le passé ; stabilité par pli.
- Prévisions : écart à la baseline par modèle et horizon, couverture des intervalles, PIT,
  fiabilité de P(hausse), stabilité par pli, excursions.
- Données : identité du run, découpage, toutes les métriques avec filtre et tri.

Le bouton « Explications » affiche, dans chaque module, ce qu'il montre et comment le lire.

Stratégies intégrées : chemin typique d'EVMC, régime directionnel d'EVMC, probabilité de
hausse d'un modèle, croisement de moyennes mobiles, cassure de canal, RSI, achat conservé.
Import d'un CSV : liste de trades du Strategy Tester de TradingView (rejouée avec ses dates et
ses prix), ou série de signaux (une colonne de date, une colonne numérique, deux seuils).

La page ne contient aucune barre du holdout : l'export s'arrête à son début.

Le backtest est un outil d'exploration, calculé dans la page et non par le moteur Rust :
signal lu à la clôture d'une barre, entrée à l'ouverture suivante, une position à la fois, stop
testé avant l'objectif dans la barre, sortie après N barres ou à l'ouverture qui suit le
changement de signal, coûts par côté. Chaque réglage essayé est compté et affiché. Un résultat
obtenu là en réglant seuils, stop et objectif n'a pas de valeur de preuve ; la couche
d'exécution de la spécification reste à écrire.

Contrôles de la page, hors navigateur :

```
node tools/page_core_test.js runs/<run_id>/report/dashboard.html
python3 tools/page_xcheck.py runs/<run_id> tools/page_core_run.js data/btcusd_bitstamp_1d.csv
```

Au-delà de 4 millions de valeurs de prévision, les origines sont échantillonnées à pas régulier
et le pas est affiché ; les métriques, elles, portent toujours sur toutes les origines.

`run_id` est le hash de ce qui détermine les résultats : version du code, lockfile,
configuration, données, découpage. La date et le nombre de threads n'y entrent pas.

## Découpage et holdout

`split plan` calcule warm-up, amorçage, plis de test et holdout à partir du nombre réel de
barres, puis écrit `configs/<nom>.split.lock.toml`. Le lock ne se réécrit pas : toute étape
vérifie son hash, les données et la configuration. Aucune prévision, aucun outcome et aucune
métrique ne porte sur une origine du holdout ; son ouverture arrive avec le jalon M4.

## Écarts par rapport à la spécification

- `pipeline.rs` s'ajoute à l'arborescence : orchestration et cache des étapes.
- `features.parquet` ne porte que les colonnes de volatilité et du pool ; l'état du script
  Pine (facteurs, score, régime, phase) est dans `legacy_state.parquet`, une ligne par origine.
- Les fichiers Parquet portent `evmc.step_key` et `evmc.logical_hash` en métadonnées au lieu
  de `evmc.run_id` : une table en cache sert plusieurs runs. Le lien run -> table est dans le manifest.
- `se_q_max` est exprimée en unités de sigma_H, comme la tolérance qu'elle sert à contrôler.
- Le tableau de bord (`report/dashboard.rs`, `assets/dashboard.html`, commande `evmc dashboard`)
  s'ajoute à la spécification. Son backtest vit dans la page, hors du moteur.
- Le port du Pine est un module à part (`legacy/`) avec sa propre simulation, celle du script,
  et non un modèle branché sur le noyau Monte Carlo du moteur : c'est la condition pour
  reproduire ses nombres aléatoires. La cible legacy d'un horizon est la valeur du chemin
  typique à cet horizon ; `models.legacy_target` n'est pas encore lu.
- `evmc synth`, `evmc split show` et `evmc data resample` s'ajoutent à la CLI ; `fit` et `holdout open` arrivent au jalon M4.
- Tests de propriétés écrits avec le RNG du projet plutôt que `proptest` ; pas de `criterion`,
  `evmc bench` en tient lieu. Aucune dépendance de développement.
- Les trajectoires avancent par groupes de 8 dans le noyau : même arithmétique par trajectoire,
  débit presque doublé.

## Ce que les tests établissent, et leur limite

- Causalité : features et prévisions identiques après troncature de la série, et insensibles à
  toute modification des barres futures.
- Déterminisme : mêmes hash logiques à 1, 2 et 4 threads.
- Monte Carlo gaussien conforme à la variance cumulée analytique ; filtre de référence : z² moyen proche de 1.
- Sur des séries sans signal, le pipeline entier déclare à tort un modèle meilleur dans moins de 2 % des cas.
- Agrégation : barres journalières identiques à un recalcul indépendant (pandas) sur 7,76 millions
  de minutes ; agréger en deux étapes ou en une donne les mêmes barres.
- Port du script Pine : sortie identique après troncature de la série et insensible à toute
  modification des barres futures ; identique à 1 et 4 threads ; générateur aléatoire conforme
  à la suite de référence de Park et Miller. Ces tests établissent la causalité et le
  déterminisme, pas la parité avec TradingView.
- Évaluation des chemins : identique à un recalcul indépendant (pandas) sur le run BTC.
- Tableau de bord : l'export contient les barres jusqu'au début du holdout et pas une de plus,
  et les données relues depuis la page sont celles du run.
- Limite mesurée : sur des rendements chevauchants (H = 10, 800 lignes), l'intervalle par blocs
  nominal à 95 % couvre la vraie valeur 92 fois sur 100. Les intervalles sont un peu trop étroits
  quand les fenêtres disjointes sont peu nombreuses ; c'est le sens de l'avertissement `warn_low_n`.
