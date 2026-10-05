# Mettre le bot sur un serveur

Le bot doit tourner 24 h/24 : il agit à la clôture de chaque bougie de 15 minutes et déplace son
stop suiveur au fil des prix. Le site (Vercel) ne peut pas le faire : il n'exécute du code que
quelques secondes quand quelqu'un ouvre une page. Il faut donc un petit serveur à soi.

Ce qu'il fait sur le serveur :

| Service | Rôle | Clé |
| --- | --- | --- |
| `shadow` | suit le marché mainnet et simule les trades (le backtest en temps réel) | aucune |
| `live` | trade pour de vrai, testnet puis mainnet | wallet agent |

Les deux tournent en parallèle : le shadow mode reste la référence à laquelle comparer le bot réel.
Ils redémarrent seuls après une panne ou un redémarrage du serveur.

## 1. Louer un serveur (quelques euros par mois)

N'importe quel VPS sous **Ubuntu 24.04** avec 1 Go de mémoire suffit. Par exemple Hetzner Cloud
(type CX22 ou équivalent, centre de données en Europe), OVH, Scaleway ou DigitalOcean.

À la création :

- image : **Ubuntu 24.04** ;
- accès : une **clé SSH** si tu sais en créer une, sinon le mot de passe root envoyé par e-mail ;
- note l'**adresse IP** du serveur.

## 2. Se connecter au serveur

- Mac ou Linux : Terminal ; Windows : PowerShell. Puis :
  ```
  ssh root@ADRESSE_IP
  ```
- Téléphone : une application SSH (Termius, par exemple), avec la même adresse et l'utilisateur
  `root`.

## 3. Installer et démarrer le shadow mode (une commande)

```
curl -fsSL https://raw.githubusercontent.com/etseroraynaud-ui/Shadowmarketpro/main/bot/deploy/install.sh | bash
```

Le script installe Docker, ferme tous les ports entrants sauf SSH, active les mises à jour de
sécurité automatiques, récupère le code dans `/opt/shadowmarketpro` et démarre le shadow mode.
Aucune clé n'est nécessaire à ce stade.

Vérifier :

```
smp-bot logs
```

Au bout de quelques secondes :

```
[shadow] history bars=4999 days=… gaps=0 …
[shadow] shadow_ready …
```

puis une ligne `bar …` après chaque clôture de 15 minutes (`Ctrl+C` pour quitter l'affichage ; le
bot continue de tourner).

## 4. Testnet : le vrai bot, avec de l'argent fictif

Le testnet vérifie la mécanique (ordres, stops, TP1, stop suiveur, reprise après redémarrage), pas
la stratégie : son marché est trop différent du vrai.

1. **Fonds de test** : sur [app.hyperliquid-testnet.xyz](https://app.hyperliquid-testnet.xyz),
   connecte ton wallet et récupère des USDC de test (faucet, « Drip »). Le faucet peut demander que
   l'adresse ait déjà fait un dépôt sur le mainnet.
2. **Sous-compte** (recommandé) : Portfolio → Sub-Accounts → créer un sous-compte et y transférer
   les USDC de test. Si Hyperliquid ne propose pas de sous-compte à ton compte, utilise un wallet
   séparé, dédié au bot : le track record reste aussi propre.
3. **Wallet agent** : page API de Hyperliquid (testnet) → générer un wallet API, nom
   `shock-engine`, puis l'autoriser. **Copie sa clé privée** : elle n'est affichée qu'une fois.
   L'agent peut trader mais pas retirer de fonds. Les agents du testnet et du mainnet sont
   distincts.
4. **Sur le serveur**, crée le fichier de configuration du bot réel, lisible par root seul :
   ```
   cd /opt/shadowmarketpro/bot/deploy
   cp live.env.example live.env
   chmod 600 live.env
   nano live.env
   ```
   Remplis `HL_ACCOUNT_ADDRESS` (ton compte), `HL_SUBACCOUNT_ADDRESS` (le sous-compte, ou vide)
   et `HL_AGENT_PRIVATE_KEY` (la clé de l'agent). Laisse `BOT_MODE=testnet`. Enregistrer :
   `Ctrl+O`, `Entrée`, puis `Ctrl+X`.
5. **Démarrer** :
   ```
   smp-bot live-start
   smp-bot logs live
   ```
   Au démarrage, le bot vérifie que le sous-compte appartient bien à ton compte (ligne
   `access … kind=sous-compte`). Il rejoue l'historique, attend que le backtest soit à plat
   (`handoff`), compare l'état de Hyperliquid au sien (`reconciled`), puis trade à chaque signal.
6. **Suivre sur le site** :
   `https://shadowmarketpro.vercel.app/live?address=ADRESSE_DU_SOUS_COMPTE&net=testnet`

**La clé de l'agent ne va que dans `live.env` sur le serveur** : jamais dans le code, jamais dans
git (le fichier est ignoré), jamais dans une conversation.

## 5. Mainnet, en petite taille

Seulement après plusieurs semaines de testnet sans arrêt inexpliqué (`HALT`) ni écart avec le
shadow mode.

1. Sur le mainnet : un sous-compte dédié avec **une somme que tu acceptes de perdre**, et un
   **nouveau** wallet agent (celui du testnet ne marche pas sur le mainnet).
2. Dans `live.env` : `BOT_MODE=mainnet`, les adresses et la clé du mainnet. Garde
   `BOT_MAX_NOTIONAL_USD` bas au début.
3. `smp-bot live-stop`, puis `smp-bot live-start`. L'état du testnet est conservé à part : le bot
   repart proprement sur le mainnet.
4. Pour publier le track record sur le site, il suffit d'ajouter l'adresse du sous-compte dans
   `app/live/accounts.ts` (une adresse Hyperliquid est publique ; elle ne donne aucun accès).

## Au quotidien

```
smp-bot status          état des services
smp-bot logs [live]     journal en direct
smp-bot trades [live]   trades fermés (CSV : entrée, sortie, régime, ATR, z-scores, MAE, MFE, frais…)
smp-bot pause           plus de nouvelle entrée (la position en cours reste gérée jusqu'à sa sortie)
smp-bot resume          entrées de nouveau permises
smp-bot live-stop       arrête le bot réel
smp-bot update          dernière version du code, puis redémarrage
```

**Si le bot s'arrête de lui-même (`HALT` dans le journal)** : il a vu un écart entre son état et
Hyperliquid (position inattendue, ordre qui ne vient pas de lui, stop absent) et n'envoie plus
aucun ordre. Lire la raison dans `smp-bot logs live`, vérifier le compte sur Hyperliquid, fermer
la position et annuler les ordres à la main, puis :

```
smp-bot live-reset
```

## Sécurité

- Le serveur n'accepte que les connexions SSH ; le bot ne fait que des connexions sortantes vers
  Hyperliquid.
- L'agent ne peut pas retirer de fonds. Au pire, quelqu'un qui volerait la clé pourrait trader le
  sous-compte : n'y mets que le capital du bot. En cas de doute, révoque l'agent sur la page API
  de Hyperliquid : plus aucun ordre signé par cette clé n'est accepté.
- Préfère une clé SSH à un mot de passe pour te connecter au serveur.
