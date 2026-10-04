# Recherche : Shock Engine sur BTC

Espace de travail pour tester, diagnostiquer et optimiser le Shock Engine (script Pine
« Shock Engine Intraday 15/day ») sur BTC/USD, sans surajuster.

## Données

`research/data/btcusd_{5,15,30,60}m.csv.gz` : barres BTC/USD Bitstamp, 2012 → octobre 2026,
construites depuis l'historique à la minute de <https://github.com/ff137/bitstamp-btcusd-minute-data>.
Les minutes sans échange (bougies plates ajoutées par la source) sont ignorées, comme
TradingView n'affiche pas de barre sans échange. Barres complètes à 99,9 % à partir de 2017 :
la recherche porte sur 2017 → 2026.

Pour mettre les données à jour :

```
git clone --depth 1 https://github.com/ff137/bitstamp-btcusd-minute-data /tmp/bs
npm run research:data -- /tmp/bs/data/historical/btcusd_bitstamp_1min_2012-2025.csv.gz /tmp/bs/data/updates/btcusd_bitstamp_1min_latest.csv
```

## Le port du script

`shock/engine.ts` reproduit le script ligne à ligne, et la façon dont TradingView l'exécute :

- `process_orders_on_close` : entrées, flip et sortie VWAP exécutés à la clôture du signal ;
- les ordres de sortie (`strategy.exit`) ne sont posés qu'à la clôture de la barre qui suit
  l'entrée, comme dans le script (bloc `if isLong`) ;
- trajet intrabarre de TradingView (ouverture → extrême le plus proche → autre extrême →
  clôture) pour le stop, TP1 et le stop suiveur ; gaps exécutés à l'ouverture ;
- filtre 60 min sans lecture du futur : chaque barre ne voit que les barres horaires closes ;
- variables `var` (cooldown, `entryPrice`, `entryATR`, `tp1Hit`, `lastWasFade`) avec leurs
  particularités, y compris celles qui ressemblent à des oublis (voir plus bas).

Une différence connue reste à confirmer : quand deux `strategy.exit` visent la même entrée
(TP1 à 50 % et stop/trailing), TradingView répartit les quantités entre elles d'une façon
particulière. Le port applique le comportement voulu : TP1 ferme 50 % une fois, le stop et le
stop suiveur couvrent tout le reste.

Le moteur accepte aussi plusieurs jeux de réglages à la fois (`simulate`) : à chaque barre, un
jeu décide des entrées, et chaque position garde jusqu'à sa sortie les réglages du jeu qui
l'a ouverte. C'est la base de l'algo qui choisit ses réglages selon le régime.

Réglages de recherche ajoutés (valeur par défaut = script inchangé) : `htfMinutes` (timeframe
du filtre HTF : 60, 240, 1440, 4320), `htfSlopeMode`
(`chart` comme le script, `htf` pour mesurer la pente sur 3 barres de 60 min), `longLamPct`
(le 55 codé en dur), `allowLong`, `allowShort`, `useImpulse`.

## Commandes

```
npm run research:run -- --tf 30 [--from 2017-01-01] [--costs realistic] [--set allowShort=false --set atrTrailMult=50] [--trades trades.csv]
npm run research:diagnose -- --tf 30
npm run research:walkforward -- --tf 30 [--space reduced] [--train 24] [--test 3] [--samples 300] [--costs realistic]
npm run research:regimes -- --tf 15 [--regimes full|trend|vol] [--pool random|menu] [--samples 200] [--seed 5] [--costs realistic]
npm run research:compare-tv -- --tf 5 --tv liste_des_trades.csv
npm run test:research
```

Les rapports sont écrits dans `research/reports/`.

## Méthode contre le surajustement

- **Diagnostic** (`diagnose.ts`) : résultat avec trois niveaux de coûts (dont « nuls », qui
  isole l'edge brut du signal), découpage par année, sens, type de signal, heure, régime de
  volatilité, tendance de fond, intensité des chocs ; trajectoire moyenne du prix autour des
  signaux, comparée à la dérive du marché ; analyse des sorties ; variantes à une seule
  modification, mesurées séparément avant et après 2022.
- **Walk-forward** (`walkforward.ts`) : réoptimisation sur une fenêtre glissante, test sur la
  période suivante jamais vue, courbes de test mises bout à bout ; **PBO** (probabilité que le
  jeu choisi finisse sous la médiane en test) ; **Sharpe dégonflé** (corrige le nombre
  d'essais) ; stabilité des réglages choisis d'un pli à l'autre.
- **Entrées au hasard à sorties identiques** (`diagnose.ts`, section 10) : on garde les mêmes
  règles de sortie et on remplace seulement les entrées par des barres tirées au hasard. Seul
  test qui sépare le timing des entrées de la tendance du marché et de la forme des sorties.
- **Paramètres par régime** (`regime-wf.ts`) : classification causale des régimes (tendance
  journalière × volatilité), sélection du meilleur jeu par régime sur une fenêtre qui
  s'agrandit, test sur les 3 mois suivants avec le moteur qui change de réglages selon le
  régime ; bêta et alpha face au BTC ; rang en test des jeux choisis.
- **Vérification contre TradingView** (`compare-tv.ts`) : retrouve chaque trade de l'export du
  Strategy Tester dans le port.

## Résultats

Synthèse des deux passages (diagnostic, walk-forward, paramètres par régime) :
[`reports/SYNTHESE.md`](reports/SYNTHESE.md).
