# Backtest Lab : moteur et plateforme de backtest

Page `/backtest` du site. Tout tourne dans le navigateur : aucune donnée ni stratégie n'est
envoyée sur un serveur.

## Ce que fait la plateforme

1. **Données** : exemples BTC/USD (journalier et 4 heures, 2012 → 2026, source Bitstamp via
   <https://github.com/ff137/bitstamp-btcusd-minute-data>, licence MIT), import d'un CSV OHLCV
   (TradingView, Binance, Yahoo, MetaTrader, formats européens), ou téléchargement public Binance.
2. **Stratégie**, au choix :
   - un **script** dans le langage de la plateforme (proche de Pine Script, voir plus bas) ;
   - une **stratégie Pine Script** de TradingView, convertie automatiquement (cas simples) ;
   - un **CSV de signaux** produit par n'importe quel outil (Python, Excel, EVMC…) ;
   - un des **modèles** fournis (croisement de moyennes, RSI, Donchian, Bollinger, Supertrend,
     MACD, momentum, achat conservé).
3. **Exécution** : capital, taille (% du capital, montant fixe, % risqué jusqu'au stop), sens
   (achat, vente, les deux), commission, frais fixes, glissement, exécution à l'ouverture
   suivante ou à la clôture, stop, objectif, stop suiveur, sortie après N barres, période de
   validation hors échantillon.
4. **Résultats** : verdict en une phrase, indicateurs clés expliqués, graphique des prix avec
   les trades et les indicateurs, courbe de capital contre l'achat conservé et drawdown, liste
   des trades (export CSV), statistiques complètes, rendements mensuels, robustesse,
   optimisation.

## Règles d'exécution

- Les signaux sont lus à la **clôture** d'une barre ; l'ordre part à l'**ouverture suivante**
  (ou à la clôture en mode « clôture », plus optimiste).
- Une seule position à la fois, pas de pyramidage. Un signal d'entrée opposé ferme la position
  (et la retourne si les deux sens sont autorisés).
- Stop et objectif testés sur le haut et le bas de chaque barre. Si l'ouverture a déjà franchi
  le niveau (gap), l'ordre est rempli à l'ouverture. Si le stop et l'objectif sont touchés dans
  la même barre, le **stop passe en premier** : l'ordre réel des prix dans la barre est inconnu.
- Glissement appliqué contre le trader sur les ordres au marché et les stops ; l'objectif est un
  ordre limite, rempli à son prix.
- Les indicateurs sont calculés sur tout l'historique ; la période testée limite seulement les
  trades, ce qui évite un préchauffage tronqué.

## Langage de stratégie

Chaque ligne donne un nom à une série calculée sur toutes les barres :

```
rapide = input(20, "EMA rapide", 2, 200)     // paramètre réglable et optimisable
lente  = input(50, "EMA lente", 5, 400)
f = ema(close, rapide)
s = ema(close, lente)
plot(f, "EMA rapide")

long     = crossover(f, s)       // entrée à l'achat
exitLong = crossunder(f, s)      // sortie
stopLoss = 2 * atr(14)           // distance du stop, en prix
```

Signaux reconnus : `long`, `exitLong`, `short`, `exitShort`, `stopLoss`, `takeProfit`.
Opérateurs : `+ - * / %`, comparaisons, `and or not`, `cond ? a : b`, historique `x[n]` (n ≥ 0),
tuples `[a, b, c] = bb(close, 20, 2)`. Les préfixes `ta.` et `math.`, `input.int`, les arguments
nommés et les couleurs `#rrggbb` de Pine sont acceptés. La liste complète des fonctions est dans
l'aide de l'éditeur (`app/backtest/docs.ts`).

Par construction, un script ne peut pas lire le futur : toutes les fonctions sont causales et
`x[-1]` est refusé. Un test le vérifie sur chaque modèle (signaux identiques sur des données
tronquées).

## Robustesse et optimisation

- **Face au hasard** : 1 000 stratégies aux entrées tirées au sort, avec le même nombre de trades,
  les mêmes durées, le même sens et la même taille. Le centile de la stratégie dit si son timing
  apporte quelque chose.
- **Échantillon / hors échantillon** : mesures séparées sur la période de réglage et sur la
  période mise de côté.
- **Tirage des trades** : rééchantillonnage avec remise des trades réalisés : probabilité de
  perte, fourchette du résultat final, drawdown à 1 chance sur 20.
- **Optimisation** : grille sur une ou deux variables `input()`, jusqu'à 900 combinaisons, dans
  un Web Worker. La recherche se fait sur l'échantillon seul ; la meilleure combinaison est
  ensuite rejouée hors échantillon.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `types.ts` | Types partagés, réglages par défaut |
| `data.ts` | Lecture des CSV OHLCV, dates, contrôle de cohérence, timeframe |
| `indicators.ts` | Indicateurs vectorisés (formules de Pine) |
| `script/parser.ts`, `script/compile.ts` | Langage de stratégie : analyse, évaluation, messages d'erreur FR/EN |
| `engine.ts` | Exécution barre par barre |
| `metrics.ts` | Mesures de performance, rendements mensuels |
| `robustness.ts` | Entrées au hasard, tirage des trades |
| `optimize.ts`, `optimizer.worker.ts` | Optimisation par grille |
| `signals.ts` | Stratégie importée en CSV de signaux |
| `pine.ts` | Conversion Pine Script → script |
| `templates.ts` | Stratégies modèles |
| `index.ts` | Point d'entrée : `runStrategy(bars, source, settings)` |

L'interface est dans `app/backtest/` (Next.js, graphiques `lightweight-charts`).

## Tests

```
npm test
```

49 tests : indicateurs comparés à un recalcul direct, exécution (entrée à l'ouverture suivante,
frais, glissement, stop, gap, stop et objectif dans la même barre, stop suiveur, vente à
découvert, retournement, taille par risque, sortie après N barres, fenêtre de dates), mesures,
langage (paramètres, tuples, erreurs avec numéro de ligne), causalité, lecture des CSV,
signaux, conversion Pine, robustesse et optimisation.

## Limites connues

- Une position à la fois ; pas de pyramidage, pas d'ordres limites à l'entrée.
- Pas de financement des positions à découvert, pas de liquidation sur marge.
- Le langage n'a ni `if`, ni `:=`, ni état d'une barre à l'autre : les stratégies Pine qui en
  dépendent ne se convertissent pas entièrement (les lignes concernées sont signalées).
- Un seul actif par backtest.
