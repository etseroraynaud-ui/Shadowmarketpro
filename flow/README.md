# Market Flow

Page publique [/market-flow](https://www.shadowmarketpro.com/market-flow) : CVD par taille d'ordre
(Binance, Bybit, OKX), whales Hyperliquid contre retail, sur BTC et ETH.

```
serveur du bot (VPS)                     site (Vercel)                         Supabase
flow/collector.py ── chaque minute ──▶  POST /api/market-flow/ingest  ──▶  flow_bars, flow_whales,
 websockets CEX + Hyperliquid            (jeton FLOW_INGEST_TOKEN)          flow_status (RLS, privé)
 relevés de positions (600 poids/min)    GET /api/market-flow  ◀── fonctions flow_*_agg
                                          page /market-flow (cache 30 s)
```

- **Collecteur** : `collector.py`, version serveur du dashboard local `whale_dashboard.py` (même
  logique), sans interface, BTC et ETH dans un seul processus. Un relevé Hyperliquid sert aux deux
  actifs. Budget plafonné à 600 de poids par minute sur les 1 200 permis par IP, pour laisser de la
  marge au bot qui tourne sur la même machine.
- **Sécurité** : le serveur n'a aucun accès à la base. Il envoie ses données au site avec un jeton
  qui ne sert qu'à ça. Le site vérifie chaque envoi (forme, bornes, taille) avant d'écrire avec sa clé
  service. Les tables ne sont pas lisibles avec la clé publique.
- **Rétention** : 35 jours en base (plages 4H, 24H, 7D, 30D) ; 7 jours dans la base locale du collecteur.

## Mise en service (une fois)

1. **Supabase** → SQL Editor → coller le contenu de `flow/supabase.sql` → Run.
2. **Serveur** : `smp-bot update` (nouvelle version, nouvelles commandes), puis `smp-bot flow configure`.
   La commande affiche un jeton.
3. **Vercel** → projet → Settings → Environment Variables : `FLOW_INGEST_TOKEN` = le jeton,
   environnement Production → Deployments → Redeploy.
4. **Serveur** : `smp-bot flow check` doit répondre « OK » (sinon le message dit quoi corriger), puis
   `smp-bot flow start` et `smp-bot flow logs`. Toutes les 5 minutes, une ligne par
   actif donne le prix, la couverture, les flux reçus et `publication ok`.
5. La page se remplit dans les minutes qui suivent ; l'historique s'allonge ensuite.

Facultatif : reprendre la base du dashboard local pour démarrer avec le catalogue de comptes déjà
construit (couverture élevée dès le départ). Fermer le dashboard, copier `whale_BTC.db` sur le serveur
(`scp whale_BTC.db root@IP:/root/`), puis `smp-bot flow import /root/whale_BTC.db`.

Facultatif : envoyer au site l'historique de cette base (minutes et échantillons whales), depuis un
ordinateur qui l'a : `FLOW_INGEST_TOKEN=… python flow/tools/export_db.py whale_BTC.db --post`.

## Commandes

| commande | effet |
|---|---|
| `smp-bot flow configure` | crée le jeton (et `flow/deploy/flow.env`, lisible par root seul) |
| `smp-bot flow token` | réaffiche le jeton |
| `smp-bot flow check` | vérifie le jeton côté site et les tables Supabase |
| `smp-bot flow start` / `stop` | démarre / arrête le collecteur (le bot n'est pas touché) |
| `smp-bot flow logs` / `status` | journal en direct / état et santé du conteneur |
| `smp-bot flow import FICHIER` | reprend une base `whale_BTC.db` ou `whale_ETH.db` |
| `smp-bot update` | met à jour le bot et, s'il tourne, le collecteur |

## Développement

- Tests : `python -m unittest flow/test_collector.py` (collecteur) et `npm test` (validation des
  envois, regroupement, lecture de la page).
- Page avec des données locales : `python flow/tools/export_db.py whale_BTC.db --out DOSSIER/btc.json`,
  puis `FLOW_FIXTURE=DOSSIER npm run dev`.
- Les règles de lecture (seuils de divergence, de volume, de couverture) sont dans
  `lib/flow/aggregate.ts` ; elles reprennent celles du dashboard local.
