# Shock Fade Engine — audit préalable du dépôt

Rédigé le 2026-10-13, avant toute mesure de rendement après un choc sur les données de ce projet.
Shock Engine V1, son moteur, ses paramètres, ses rapports publiés, le bot et le site ne sont **pas
modifiés** ; ce projet vit dans `research/fade/` (code), `research/preregistration/shock-fade.md`
(protocole) et `research/reports/shock-fade/` (sorties).

## 1. Données disponibles

| Source | Contenu | Granularité | Couverture | Dans git | Utilité pour le Fade |
|---|---|---|---|---|---|
| `research/data/btcusd_{5,15,30,60}m.csv.gz` | BTC/USD Bitstamp, OHLCV | 5, 15, 30, 60 min | 2012 → 2026-10-04 | oui | réplication externe possible (pas de flux signé) |
| `research/data/ethusdt_15m.csv.gz`, `ethusd-dukascopy_15m.csv.gz` | ETH comptant Binance / Dukascopy, OHLCV | 15 min | 2017 → 2026-09 | oui | trop grossier pour les sauts et l'impact |
| `research/data/*usdt_15m.csv.gz` | 10 autres cryptos, comptant Binance | 15 min | 2017–2024 → 2026-09 | oui | hors périmètre (BTC/ETH seulement) |
| `research/data/funding/binance-{BTC,ETH}USDT.csv` | financement USDⓈ-M, toutes les 8 h | 8 h | 2020-01 → 2026-09 | oui | coût de portage dans le backtest |
| `research/data/funding/hyperliquid-*.csv` | financement Hyperliquid | 1 h | 2023-05 → | oui | contrôle |
| `research/data/hyperliquid/*` | bougies Hyperliquid | 15 min, 1 j | court historique | oui | non utilisé |
| `research/capacity/binance.ts` (archives hors git) | aggTrades, bookDepth (± 1…5 %, ≈ 30 s, depuis 2023), bougies 1 min USDⓈ-M | trade / 30 s / 1 min | fenêtres autour des trades E2 | non | méthode de téléchargement vérifié reprise ; pas d'historique complet en local |
| `flow/collector.py` (Market Flow) | CVD par taille d'ordre, perp et comptant, whales Hyperliquid | 1 min | **35 jours** glissants en base | non | pas d'historique exploitable pour une étude 2020–2026 |
| **Nouveau** : `research/fade/shockfade/fetch.py` | bougies 1 min Binance USDⓈ-M **et** comptant BTCUSDT, ETHUSDT, avec **volume acheteur agresseur** et nombre de transactions | 1 min | 2020-01-01 → 2026-09-30 | non (≈ 1,4 Go, manifeste SHA-256 commité) | sauts (Lee–Mykland), Hawkes, flux signé, base perp–comptant |

Le diagnostic chiffré (couverture, trous, volumes, base) est dans [`01-data-quality.md`](01-data-quality.md).
En bref : perpétuels complets à 100 % de la grille (≈ 300–370 minutes sans volume sur 3,55 M),
comptant 99,93 % (pannes Binance connues, jusqu'à 354 min), corrélation 1 min perp/comptant 0,985
(BTC) et 0,977 (ETH), base médiane de −5 à +5 pb selon l'année.

**Ce qui manque** et ne peut pas être reconstruit pour 2020–2026 dans ce dépôt : carnet d'ordres
complet (L2), trades individuels sur tout l'historique (les aggTrades existent chez Binance mais
pèsent plusieurs centaines de Go), liquidations, CVD historique multi-plateformes. Le flux signé
utilisé ici est donc **le déséquilibre acheteurs/vendeurs agresseurs agrégé à la minute**, un proxy
de l'order flow, pas le carnet.

## 2. Détecteurs de chocs et outils statistiques existants

- **Détecteur de V1** (`lib/strategies/shock/market.ts`) : z-score du rendement log de la barre
  (moyenne et écart type mobiles sur `volWin`, écart type **non robuste aux sauts**, fenêtre qui
  inclut la barre courante), choc principal |z| > `kMain`, micro-choc |z| > `kMicro`. Ce z-score
  n'est pas un test de saut : il n'a ni contrôle du taux de fausses détections, ni volatilité
  robuste aux sauts, ni saisonnalité intrajournalière.
- **« λ » de V1** : `percentrank(ema(1{choc}, 150), 300)`, rang centile d'une moyenne mobile du
  nombre de chocs. Ce n'est **pas** l'intensité d'un processus ponctuel : pas de direction, pas de
  noyau d'excitation, pas de vraisemblance, pas de prévision. Il ne peut pas tenir lieu de Hawkes.
- **Outils statistiques** : `research/lib/overfit.ts` (PSR, Sharpe dégonflé, CSCV-PBO,
  walk-forward), `research/lib/stats.ts` (entrées au hasard à sorties identiques), `research/proba/`
  (walk-forward trimestriel purgé, score contre prévision naïve), `evmc/` (Rust : bootstrap par
  blocs, HAC, scores de prévision). Ces outils sont en TypeScript/Rust et liés au moteur V1 ; la
  recherche Fade les réimplémente en Python (mêmes définitions) sans les importer.
- **Exécution** (`research/execution/`, `research/reports/execution/`) : coûts mesurés sur les
  transactions Binance réelles autour des 1 150 exécutions de E2 : demi-spread ≈ 0,02 pb, dérive
  pendant la latence 2,3 pb (médiane ; 2,8 pb BTC et 4,1 pb ETH à l'entrée), frais taker 5 pb
  (Binance VIP 0) ou 4,5 pb (Hyperliquid). Ces mesures portent sur des entrées **dans** le sens du
  choc ; elles servent ici d'ordre de grandeur, pas de modèle.

## 3. Moteur de backtest V1, frais, exécution, tests

- `lib/strategies/shock/{strategy,broker,engine}.ts` : port ligne à ligne du script Pine et de la
  sémantique TradingView : `process_orders_on_close` (entrée **à la clôture de la bougie de
  signal**), ordres de sortie posés à la clôture de la barre qui suit l'entrée, trajet intrabarre
  conventionnel pour stops/TP.
- Frais : `SCRIPT_COSTS` (0,02 % + 1 tick), `REALISTIC_COSTS` (0,05 % + 0,01 %), publication à
  0,045 % par exécution. Financement optionnel (`fundingPct`), levier 1 par défaut.
- Tests : `npm run test:research` (golden test du port, overfit, proba, portefeuille…) et
  `npm test` (moteur de backtest du site). Empreintes SHA-256 des fichiers figés de V1 dans
  `research/preregistration/e2-forward.md` § 0, vérifiées par `research/tests/e2-forward.test.ts`.

Le moteur V1 n'est **pas** réutilisé pour le Fade : il exécute à la clôture de la bougie de signal
et ne connaît que des barres ≥ 5 min, alors que le Fade exige une entrée postérieure à la
confirmation et un chemin intrabarre réel (1 min).

## 4. Logique Fade du script Shock Engine Intraday (port : `market.ts`, `strategy.ts`, `export-pine.ts`)

```
fadeLong       = negShock and (dnW > wickThr or close > llPrev)
fadeShort      = posShock and (upW > wickThr or close < hhPrev)
fadeLambdaOK   = not fadeOnlyLowLam or not highLam            // highLam = lamPct > lamPctThr (50)
allowLambda    = effOnlyHighLam ? highLam : true              // porte TOUTES les entrées
fadeEntryLong  = fadeLong and not directionalOnly and fadeLambdaOK and volFadeOK   // volFadeOK = volZ < volFadeMax
longRegimeOK   = lamPct > longLamPct (55) and volZ > 0        // n'est appliqué qu'aux impulse longs dans le port
vwapProxy      = ta.sma(hlc3, vwapLen)                        // sortie « VWAP » : close >= vwapProxy (long)
```

Défauts constatés, dont ceux que vous signalez :

1. **Conditions Lambda contradictoires.** `allowLambda` (gardien de toutes les entrées) exige
   `highLam` quand `onlyHighLam` est actif (hors High Activity Mode), tandis que `fadeLambdaOK` exige
   `not highLam` quand `fadeOnlyLowLam` est actif : les deux ensemble rendent toute entrée Fade
   impossible. Dans le port, `longRegimeOK` (λ > 55) ne s'applique qu'aux impulse longs ; si votre
   version Pine l'applique à tous les longs, le Fade Long exige λ > 55 **et** λ ≤ 50 : bloqué en
   permanence, exactement le défaut signalé. Plus fondamentalement, un régime « λ faible » de
   continuation n'a aucune raison d'être la bonne condition de réversion.
2. **Le « VWAP » n'est pas un VWAP** : moyenne arithmétique de hlc3 sur 30 barres, sans pondération
   par le volume, sans ancrage, qui inclut la barre du choc et se déplace avec lui. La cible de
   sortie n'est donc ni un prix moyen d'exécution ni une estimation de la valeur permanente.
3. **`fadeLong` n'est pas un failed breakout** : `close > llPrev` est vrai pour tout choc baissier
   qui ne clôture pas sous le plus bas des 20 barres, y compris un choc au milieu du range qui n'a
   jamais cassé d'extrême. Un failed breakout exige `low < llPrev` **et** `close > llPrev`.
4. **Filtre de volume inversé par construction** : `volFadeOK = volZ < 1` réserve le Fade aux chocs à
   faible volume, l'opposé d'un choc de liquidité (H2) qui s'accompagne en général d'un pic de flux.
5. **Fade désactivé dans V1** : `directionalOnly = true` par défaut et dans tous les préréglages
   publiés ; `flipIncludeFade` et la sortie VWAP (`lastWasFade`) sont donc du code mort dans V1.
6. **Exécution à la clôture de la bougie de signal** (`process_orders_on_close`) : impossible en
   temps réel sans latence ; pour un Fade, la réversion la plus rapide se joue précisément dans les
   premières secondes/minutes.
7. **Résultat antérieur connu** (`research/reports/shock-15m-diagnostic.md`, § 8–9, BTC 15 min,
   coûts du script) : « Fade seulement » −94 % (Sharpe −1,60, 9 401 positions, −0,028 % par
   position), « Fade seulement, longs » −70 % ; ces variantes battent néanmoins 95–97 % des tirages
   d'entrées au hasard. Lecture : une information de timing brute existe peut-être, mais elle est
   détruite par la fréquence de trading et les coûts. Ce résultat est connu avant le protocole et
   déclaré comme tel.

## 5. Conséquences pour le projet

- Aucun filtre de V1 (λ, HTF, compression, volume, cooldown) n'est repris comme filtre de
  réversion. Les seuls éléments repris sont des **idées testables** : rejet d'extrême (H1), intensité
  des chocs (remplacée par un vrai Hawkes), cible de prix moyen (remplacée par un vrai VWAP 1 min
  ou par la composante permanente estimée).
- Le choc est défini sur une volatilité **prévisible** (connue avant la barre), robuste aux sauts
  (variation bipuissance) et corrigée de la saisonnalité intrajournalière ; un saut n'est déclaré
  « identifié » que par le test de Lee–Mykland à 1 min, avec un seuil de Gumbel qui contrôle les
  fausses détections.
- L'exécution est simulée sur le chemin 1 min réel, **après** la clôture de la barre de décision.

## 6. Architecture proposée (avant codage des modèles)

```
research/fade/                      Python 3.13, numpy/scipy/pandas/statsmodels/numba (versions figées)
  shockfade/fetch.py                téléchargement vérifié SHA-256 (data.binance.vision), manifeste commité
  shockfade/data.py                 grille 1 min, agrégation causale en barres de 5 et 15 min, flux signé
  shockfade/quality.py              diagnostic de qualité (aucun rendement futur)
  shockfade/vol.py                  saisonnalité intrajournalière causale, variation bipuissance locale
  shockfade/jumps.py                Lee–Mykland (seuil de Gumbel), BNS journalier, tailles de sauts (Merton)
  shockfade/hawkes.py               Hawkes exponentiel bivarié ±, MLE contrainte, stabilité, GOF, simulation
  shockfade/ou.py                   état-espace prix = permanent + transitoire (OU discrétisé) piloté par le flux,
                                    filtre de Kalman, identifiabilité ; contrôle « OU naïf sur prix brut »
  shockfade/events.py               table d'événements, MFE/MAE, temps de récupération, horizons
  shockfade/features.py             caractéristiques causales H1–H4 et entrées des modèles M1–M7
  shockfade/stats.py                HAC Newey–West, erreurs groupées par jour, bootstrap par blocs, Holm/BH,
                                    Clark–West, Sharpe dégonflé
  shockfade/walkforward.py          recalibrage trimestriel, prévisions hors échantillon, sélection pré-enregistrée
  shockfade/backtest.py             backtest événementiel distinct de V1 (seulement si un signal passe les critères)
  shockfade/synthetic.py            simulateurs à paramètres connus (Merton, Hawkes, OU+flux) et contrôles du pipeline
  tests/                            récupération des paramètres simulés, non-fuite (troncature), empreintes V1
research/preregistration/shock-fade.md   protocole figé avant tout calcul de résultat
research/reports/shock-fade/             rapports .md/.json, journal des essais, dossier final
```

Rust/C++ ne sont pas utilisés au départ : les boucles critiques (variation bipuissance, récursion
de vraisemblance Hawkes, filtre de Kalman, simulation de Ogata) sont compilées avec numba. Un port
Rust ne se justifierait qu'après la démonstration d'un apport prédictif, pour une exécution live.
