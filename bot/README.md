# Bot Shock Engine · Hyperliquid

Bot de trading du préréglage **Adaptatif volatilité · 15 min** sur BTC. Il utilise
exactement le moteur du backtest de Backtest Lab (`lib/strategies/shock/`), sans aucune
deuxième implémentation de la stratégie.

```
Hyperliquid (REST + WebSocket)
        ↓  bougies 15 min closes, journalier, BBO, événements du compte
ShockRunner        lib/strategies/shock/live.ts      historique + recalcul à chaque clôture
        ↓
ShockStrategy      lib/strategies/shock/strategy.ts  décision du script (la même que le backtest)
        ↓  Decision : niveaux de sortie, fermeture, entrées
RiskEngine         bot/src/engine/risk.ts            taille, plafonds, arrêt manuel
        ↓
ExecutionEngine    bot/src/engine/live.ts            ordres, stops, TP1, stop suiveur, fills
        ↓
Hyperliquid        bot/src/hl/client.ts              API officielle via @nktkas/hyperliquid
```

Le backtest et le bot partagent la même stratégie :

```
                    ShockStrategy (strategy.ts)
                   /                           \
   SimBroker (broker.ts)                 ExecutionEngine (bot/src/engine/live.ts)
   backtest, shadow mode                 shadow mode (exchange papier), testnet, mainnet
```

## Ce qui est garanti, et comment c'est vérifié

| Contrôle | Test |
| --- | --- |
| La séparation stratégie / exécution n'a changé aucun résultat du backtest | `research/tests/golden.test.ts` : 12 configurations, positions et capital barre par barre identiques aux empreintes prises avant |
| Rejouer un historique bougie par bougie = backtest d'un bloc | `research/tests/live.test.ts`, `bot/tests/parity.test.ts` : même décision à chaque barre (entrées, sorties, niveaux de stop, TP1, trailing), même régime, mêmes positions, même capital |
| Le moteur live, face à un exchange qui exécute comme le backtest, fait les mêmes trades | `bot/tests/live.test.ts` : mêmes entrées, sens, motifs de sortie (stop, flip, TP1, stop suiveur) et prix |
| Sur l'historique Hyperliquid | `npm run parity` (demande l'accès réseau à Hyperliquid) |
| Seules les bougies closes entrent dans le moteur | `tests/candles.test.ts` : une bougie n'entre que si l'exchange a déjà ouvert la suivante (pas seulement d'après l'horloge locale) ; toute bougie relue différente est signalée (`candle_revised`) |
| Reconnexions | `tests/stream.test.ts` : signal de clôture en double, reconnexion, coupure de 45 min rattrapée par REST, chaque bougie une seule fois ; `npm run ws-check` : coupures forcées sur le vrai WebSocket |
| Condition de la version publique sur les shorts (`BOT_SHORT_TREND_FILTER=1`) | `bot/tests/short-trend.test.ts` : mêmes entrées que la recherche (`research/lib/e2.ts`), parité bougie par bougie avec le backtest filtré, shadow mode, moteur live et redémarrage identiques au backtest filtré |
| Pas d'ordre en double | `tests/orders.test.ts` : réponse perdue, requête perdue, arrêt brutal en plein envoi (entrée, déplacement du stop), ordre du bot en trop, stop disparu, deux instances |
| Exchange papier du shadow mode | `tests/paper.test.ts` : exécution au BBO, stops, limites, réduction seule |
| Moteur live complet sur l'historique Hyperliquid | `npm run paper-replay` : BBO reconstitué le long de chaque bougie, réglages de production du stop suiveur, trades comparés au backtest |

## Modes

1. **Shadow** (`BOT_MODE=shadow`, défaut) : aucun ordre, aucune clé. Deux moteurs tournent sur
   les bougies et le BBO réels de Hyperliquid :
   - le broker simulé du backtest : le journal est ce que le backtest aurait fait ;
   - le moteur live complet (ordres, stops, TP1, stop suiveur, anti-doublons) sur un **exchange
     papier** (`exec/paper.ts`) qui exécute au BBO réel sans rien envoyer.

   À chaque clôture, leurs positions sont comparées (événement `parity`). L'exchange papier
   repart à plat à chaque lancement.
2. **Testnet** (`BOT_MODE=testnet`) : ordres réels sur le testnet, avec les données du
   testnet (marché cohérent avec les ordres ; ses signaux n'ont pas de valeur de trading).
3. **Mainnet** (`BOT_MODE=mainnet`) : seulement après plusieurs semaines de shadow et de testnet,
   et seulement avec `BOT_ALLOW_MAINNET=1` (sans lui, le bot refuse de démarrer et ne lit aucune clé).

## Installation

```
cd bot
npm install
npm test          # tests du bot
npm run check     # typage
```

Derrière un proxy HTTPS (`HTTPS_PROXY`), lancer Node avec `NODE_USE_ENV_PROXY=1` (Node ≥ 22.21).

## Contrôles sur le vrai Hyperliquid

```
npm run parity -- --steps 4900          # backtest d'un bloc = moteur bougie par bougie, historique mainnet
npm run ws-check -- --network mainnet   # coupures WebSocket forcées : reconnexion, réabonnement
npm run testnet-check                   # testnet : métadonnées, lecture de compte, signature
npm run testnet-check -- --trade        # + aller-retour minimal avec le wallet agent du testnet
npm run source-compare                  # même stratégie sur Bitstamp (recherche) et Hyperliquid
npm run paper-replay                    # historique Hyperliquid → moteur live + exchange papier, trade par trade contre le backtest
npm run shadow-report                   # bilan de la dernière session (bougies, WS, parité, ordres)
```

## Wallet agent (testnet et mainnet)

Le bot signe avec un **wallet agent** dédié, approuvé sur ton compte depuis l'interface
Hyperliquid (API → générer un wallet API). Un agent peut trader mais pas retirer de fonds.

```
export HL_ACCOUNT_ADDRESS=0x...      # ton compte (adresse publique)
export HL_AGENT_PRIVATE_KEY=0x...    # clé privée de l'agent, jamais dans le code ni dans git
```

## Sous-compte dédié (recommandé)

Le bot peut trader un **sous-compte** du compte principal plutôt que le compte lui-même : son
historique ne contient alors que les trades du bot (un track record propre, vérifiable on-chain),
et une erreur du bot ne touche pas le reste du compte.

1. Sur Hyperliquid : Portfolio → Sub-Accounts → créer un sous-compte, puis y transférer le
   capital du bot (USDC).
2. Le wallet agent reste celui du compte principal ; aucune autre clé.
3. ```
   export HL_SUBACCOUNT_ADDRESS=0x...   # adresse du sous-compte
   ```

Chaque ordre porte alors l'adresse du sous-compte, et le bot lit position, ordres et fills du
sous-compte. Au démarrage, il vérifie que cette adresse est bien un sous-compte (ou un vault) du
compte principal, sinon il s'arrête. Plus tard, la même variable accepte l'adresse d'un vault.

## Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `BOT_MODE` | `shadow` | `shadow`, `testnet`, `mainnet` |
| `BOT_SHORT_TREND_FILTER` | 0 | `1` : version publique du Shock Engine, une entrée short seulement en régime de tendance journalier baissier (voir plus bas) ; `0` : moteur v1 |
| `HL_SUBACCOUNT_ADDRESS` | | sous-compte (ou vault) tradé ; vide : le compte principal |
| `BOT_EQUITY_PCT` | 100 | part du capital par position (comme le backtest) |
| `BOT_LEVERAGE` | 1 | levier de la position |
| `BOT_MAX_NOTIONAL_USD` | 1000 | plafond de la valeur d'une position |
| `BOT_MAX_SLIPPAGE_PCT` | 0.5 | écart maximal d'un ordre au marché |
| `BOT_STOP_SLIPPAGE_PCT` | 5 | écart maximal d'un stop déclenché |
| `BOT_EMERGENCY_STOP_PCT` | désactivé | stop de sécurité entre l'entrée et la pose du stop du script |
| `BOT_KILL_FILE` | `bot/state/KILL` | s'il existe : plus aucune entrée |
| `BOT_MAX_SPREAD_BPS` | 10 | spread maximal pour une entrée (attente de 10 s, puis abandon) ; jamais pour une sortie |
| `BOT_TRAIL_STEP_PCT` | 5 | pas minimal du stop suiveur entre deux clôtures, en % de la distance de suivi |
| `BOT_TRAIL_MIN_INTERVAL_MS` | 2000 | intervalle minimal entre deux déplacements du stop |
| `BOT_WS_STALE_MS` | 60000 (testnet 900000) | aucune donnée du WebSocket depuis ce délai : reconnexion forcée |
| `BOT_RESET_STATE` | | `1` : repart de zéro (le compte doit être à plat) |
| `BOT_DATA_NETWORK` | réseau du mode (shadow : mainnet) | données mainnet ou testnet |
| `BOT_ALLOW_MAINNET` | | `1` obligatoire pour `BOT_MODE=mainnet` |
| `BOT_SHADOW_CAPITAL`, `BOT_SHADOW_FEE_PCT` | 10000, 0.045 | broker simulé et exchange papier du shadow mode |
| `BOT_SHADOW_PAPER` | 1 | `0` : pas de moteur live sur exchange papier en shadow |
| `BOT_PAPER_MAKER_FEE_PCT` | 0.015 | frais des limites exécutées sur l'exchange papier |

## Version publique : shorts seulement en tendance journalière baissière

Depuis octobre 2026, la spécification publique du Shock Engine n'autorise une entrée short que
lorsque le régime de tendance journalier est baissier : clôture journalière sous sa moyenne
50 jours et moyenne en baisse sur 10 jours, au dernier jour clos (`classify`,
`lib/strategies/shock/regimes.ts`). `BOT_SHORT_TREND_FILTER=1` l'applique
(`bot/src/engine/short-trend.ts`) :

- le moteur figé (`lib/strategies/shock/*`) n'est pas modifié : la condition passe par la liste
  d'entrées de `ShockStrategy`, recalculée à chaque bougie close ; seules les entrées short
  changent, les longs, les sorties et le flip sur choc opposé restent ceux du moteur ;
- désactivée par défaut : sans la variable, le bot se comporte exactement comme avant ;
- à activer seulement compte à plat, avec `BOT_RESET_STATE=1` : l'état sauvegardé a été construit
  sans la condition ;
- `npm run parity` et `npm run paper-replay` lisent la même variable et comparent au backtest
  filtré.

## Lancement

```
BOT_MODE=shadow npm start
```

Sur un serveur, 24 h/24 (Docker, redémarrage automatique, shadow mode et bot réel en parallèle) :
voir **[DEPLOY.md](DEPLOY.md)**. Les trades réels se suivent sur la page Performance live du
site (`/live`), qui lit le compte directement sur Hyperliquid et compare chaque trade au backtest.

Le bot écrit :

- `bot/data/<réseau>/BTC-15m.csv`, `BTC-1d.csv` : cache des bougies closes (ajout seul) ;
- `bot/state/live-<mode>-BTC.json` : état (variables du script, position, ordres) ;
- `bot/logs/events-AAAA-MM.jsonl` : chaque bougie (`market_bar` : signal qui l'a fait lire,
  comparaison WebSocket / REST, spread pendant la bougie), signal, ordre, fill, reconnexion,
  erreur ; en shadow, `engine: "paper"` marque le moteur live sur l'exchange papier ;
- `bot/logs/trades-<mode>.csv` : un trade par ligne (heure, sens, entrée, sortie, quantité, ATR,
  régime, z-score du choc, z-score du volume, lambda, MAE, MFE, frais, financement, écart
  d'exécution, PnL, spread à l'entrée et à la sortie) ; en shadow, `trades-shadow.csv` (backtest) et
  `trades-shadow-paper.csv` (moteur live sur l'exchange papier).

Signal `SIGUSR2` : coupe et rétablit le WebSocket (test des reconnexions en conditions réelles).

## Sécurité

- Clés uniquement en variables d'environnement ; la clé de l'agent n'est lue qu'en testnet et
  mainnet, et n'apparaît jamais dans le journal.
- Au démarrage : position, ordres ouverts et fills de Hyperliquid comparés à l'état local. Au
  moindre écart (position inattendue, ordre qui ne vient pas du bot, stop absent), le bot
  **n'envoie plus aucun ordre** (`HALT` dans le journal) jusqu'à intervention manuelle : vérifier
  le compte, le mettre à plat, relancer avec `BOT_RESET_STATE=1`.
- Premier lancement : le bot rejoue l'historique avec le backtest et ne prend la main que
  lorsque ce backtest est à plat (et le compte aussi). L'état du script est alors exactement
  celui du backtest.
- Bougie manquée pendant un arrêt : rattrapée seulement si elle ne demandait aucun ordre, sinon
  arrêt.
- Stop refusé par l'exchange : position fermée au marché, puis arrêt.
- Un seul processus par mode et par actif (verrou `bot/state/live-<mode>-BTC.json.lock`).

## Pas d'ordre en double

- Chaque ordre porte un identifiant client (cloid : préfixe du bot, nature de l'ordre, partie
  aléatoire), écrit dans l'état **avant** l'envoi.
- Réponse incertaine (délai dépassé, connexion coupée) : le bot demande à Hyperliquid le statut de
  ce cloid et ses fills, et continue avec l'issue réelle. Il ne renvoie jamais un ordre. Un refus
  explicite de l'exchange n'est pas incertain.
- Redémarrage avec un ordre en suspens : retrouvé par son cloid. Jamais exécuté : oublié. Stop,
  TP1 ou stop de sécurité posés : adoptés par la position. Entrée ou fermeture exécutée : arrêt
  pour vérification.
- Stop déplacé (stop suiveur, retaille après TP1) : le nouveau est posé, puis l'ancien annulé ; la
  position n'est jamais sans stop, et deux stops en réduction seule ne peuvent pas fermer plus
  qu'elle. (Pas de `modify` : chez Hyperliquid, une modification annule puis repose l'ordre, et la documentation du SDK la réserve par défaut aux ordres non déclencheurs ; poser puis annuler ne dépend pas de ces règles.)
- Fills reconnus par numéro d'ordre ou par cloid.
- À chaque clôture : ordres du bot que l'état ne connaît pas annulés (`orphan_orders_canceled`),
  stop ou TP1 disparus sans exécution reposés (`stop_missing`), ordre étranger : arrêt.
- Bougies : une seule lecture à la fois, chaque bougie passée une seule fois au moteur.

## Écarts connus avec le backtest (inévitables en réel)

- **Exécution** : le backtest entre au prix de clôture ; le bot envoie l'ordre juste après la
  clôture. Les sorties dans la bougie suivent les vrais prix, pas le trajet supposé du backtest.
  L'écart est mesuré trade par trade (colonne `slippage`).
- **Pas de stop pendant la bougie qui suit l'entrée** : c'est le comportement du script
  (`strategy.exit` posé à la clôture suivante). `BOT_EMERGENCY_STOP_PCT` ajoute un stop de
  sécurité, désactivé par défaut.
- **Stop suiveur** : Hyperliquid n'en a pas ; le bot déplace son stop au fil du BBO, par pas d'au
  moins 5 % de la distance de suivi et au plus toutes les 2 s (limite d'ordres de Hyperliquid) ;
  à chaque clôture, au tick près.
- **Déclenchement des stops** : Hyperliquid déclenche ses stops sur son prix « mark » ; le backtest,
  sur les prix des bougies ; l'exchange papier, sur le milieu du BBO.
- **Lecture des bougies** : sur le mainnet, la bougie close est lue environ 3 s après la clôture ; sur
  le testnet, peu actif, elle attend la première transaction de la bougie suivante (au plus 60 s).
- **Prix de référence** : les ordres au marché partent du meilleur prix d'en face (BBO), limités à
  `BOT_MAX_SLIPPAGE_PCT` ; le spread est journalisé à chaque entrée et sortie.
- **Données** : le backtest de recherche utilise Bitstamp (spot), le bot Hyperliquid (perp). Sur la
  période commune (`npm run source-compare`), les prix diffèrent de quelques points de base et la
  grande majorité des signaux tombent sur la même bougie, mais pas tous.
- **Historique** : l'API ne donne que les 5000 dernières bougies 15 min (environ 52 jours) ; le
  cache local les garde ensuite. Le régime de volatilité vient des bougies journalières
  Hyperliquid (au moins un an nécessaire).
- **Financement** : payé chaque heure sur Hyperliquid ; compté dans les trades réels, pas dans
  le broker simulé du shadow mode.
