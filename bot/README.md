# Bot Shock Engine · Hyperliquid

Bot de trading du préréglage **Adaptatif volatilité · 15 min** sur BTC. Il utilise
exactement le moteur du backtest de Backtest Lab (`lib/strategies/shock/`), sans aucune
deuxième implémentation de la stratégie.

```
Hyperliquid (REST + WebSocket)
        ↓  bougies 15 min closes, journalier
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
   backtest, shadow mode                 testnet, mainnet
```

## Ce qui est garanti, et comment c'est vérifié

| Contrôle | Test |
| --- | --- |
| La séparation stratégie / exécution n'a changé aucun résultat du backtest | `research/tests/golden.test.ts` : 12 configurations, positions et capital barre par barre identiques aux empreintes prises avant |
| Rejouer un historique bougie par bougie = backtest d'un bloc | `research/tests/live.test.ts`, `bot/tests/parity.test.ts` : même décision à chaque barre (entrées, sorties, niveaux de stop, TP1, trailing), même régime, mêmes positions, même capital |
| Le moteur live, face à un exchange qui exécute comme le backtest, fait les mêmes trades | `bot/tests/live.test.ts` : mêmes entrées, sens, motifs de sortie (stop, flip, TP1, stop suiveur) et prix |
| Sur l'historique Hyperliquid | `npm run parity` (demande l'accès réseau à Hyperliquid) |

## Modes

1. **Shadow** (`BOT_MODE=shadow`, défaut) : aucun ordre. Les décisions sont exécutées par le
   broker simulé du backtest, sur les bougies Hyperliquid en temps réel. Le journal est ce que
   le backtest aurait fait.
2. **Testnet** (`BOT_MODE=testnet`) : ordres réels sur le testnet, avec les données du
   testnet (marché cohérent avec les ordres ; ses signaux n'ont pas de valeur de trading).
3. **Mainnet** (`BOT_MODE=mainnet`) : seulement après plusieurs semaines de shadow et de testnet.

## Installation

```
cd bot
npm install
npm test          # tests du bot
npm run check     # typage
```

## Wallet agent (testnet et mainnet)

Le bot signe avec un **wallet agent** dédié, approuvé sur ton compte depuis l'interface
Hyperliquid (API → générer un wallet API). Un agent peut trader mais pas retirer de fonds.

```
export HL_ACCOUNT_ADDRESS=0x...      # ton compte (adresse publique)
export HL_AGENT_PRIVATE_KEY=0x...    # clé privée de l'agent, jamais dans le code ni dans git
```

## Variables

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `BOT_MODE` | `shadow` | `shadow`, `testnet`, `mainnet` |
| `BOT_EQUITY_PCT` | 100 | part du capital par position (comme le backtest) |
| `BOT_LEVERAGE` | 1 | levier de la position |
| `BOT_MAX_NOTIONAL_USD` | 1000 | plafond de la valeur d'une position |
| `BOT_MAX_SLIPPAGE_PCT` | 0.5 | écart maximal d'un ordre au marché |
| `BOT_STOP_SLIPPAGE_PCT` | 5 | écart maximal d'un stop déclenché |
| `BOT_EMERGENCY_STOP_PCT` | désactivé | stop de sécurité entre l'entrée et la pose du stop du script |
| `BOT_KILL_FILE` | `bot/state/KILL` | s'il existe : plus aucune entrée |
| `BOT_RESET_STATE` | | `1` : repart de zéro (le compte doit être à plat) |
| `BOT_DATA_NETWORK` | réseau du mode | données mainnet ou testnet |
| `BOT_SHADOW_CAPITAL`, `BOT_SHADOW_FEE_PCT` | 10000, 0.045 | broker simulé du shadow mode |

## Lancement

```
BOT_MODE=shadow npm start
```

Le bot écrit :

- `bot/data/<réseau>/BTC-15m.csv`, `BTC-1d.csv` : cache des bougies closes (ajout seul) ;
- `bot/state/live-<mode>-BTC.json` : état (variables du script, position, ordres) ;
- `bot/logs/events-AAAA-MM.jsonl` : chaque bougie, signal, ordre, fill, erreur ;
- `bot/logs/trades-<mode>.csv` : un trade par ligne (heure, sens, entrée, sortie, quantité, ATR,
  régime, z-score du choc, z-score du volume, lambda, MAE, MFE, frais, financement, écart
  d'exécution, PnL).

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

## Écarts connus avec le backtest (inévitables en réel)

- **Exécution** : le backtest entre au prix de clôture ; le bot envoie l'ordre juste après la
  clôture. Les sorties dans la bougie suivent les vrais prix, pas le trajet supposé du backtest.
  L'écart est mesuré trade par trade (colonne `slippage`).
- **Pas de stop pendant la bougie qui suit l'entrée** : c'est le comportement du script
  (`strategy.exit` posé à la clôture suivante). `BOT_EMERGENCY_STOP_PCT` ajoute un stop de
  sécurité, désactivé par défaut.
- **Stop suiveur** : Hyperliquid n'en a pas ; le bot déplace son stop au fil des prix (au plus
  une fois par seconde).
- **Historique** : l'API ne donne que les 5000 dernières bougies 15 min (environ 52 jours) ; le
  cache local les garde ensuite. Le régime de volatilité vient des bougies journalières
  Hyperliquid (au moins un an nécessaire).
- **Financement** : payé chaque heure sur Hyperliquid ; compté dans les trades réels, pas dans
  le broker simulé du shadow mode.
