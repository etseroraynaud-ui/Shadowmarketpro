# Données GC et NQ : disponibilité au 2026-10-20

**Conclusion : aucune série de futures GC ou NQ en 15 min, longue et de provenance fiable, n'est
accessible depuis l'environnement d'exécution.** Conformément à la mission, aucun substitut (or au
comptant, CFD, ETF, perpétuel) n'a été utilisé et tous les calculs qui dépendent de ces données sont
arrêtés : étude d'événement, grille de k, walk-forward, mesures économiques et comparaison des
méthodes de seuil ne sont **pas** calculés.

## Ce qu'il faut

Prix CME Globex par contrat (GC : COMEX, 100 onces, pas 0,10 $ ; NQ : CME E-mini Nasdaq-100, 20 $ ×
indice, pas 0,25), minutes ou 15 min, horodatage UTC, volume par contrat, du 2012-01-01 au plus tard
jusqu'au 2026-06-30 au plus tôt ; ou une série continue accompagnée de sa table de roulement
(identifiant du contrat sur chaque barre, prix non ajustés). Le traitement (roulement, ajustement,
fuseaux, trous, séances, événements, contrôles bloquants) est fixé au § 1 du protocole
`research/preregistration/futures-k-transfer.md`.

## Sources examinées

Joignabilité mesurée par `probe-sources.sh` (résultat brut : `probe-2026-10-20.json`) ; « refusé » =
connexion refusée par la politique réseau de l'environnement avant toute réponse du serveur.

| source | produit | historique annoncé | depuis l'environnement | statut pour l'étude |
| --- | --- | --- | --- | --- |
| Databento GLBX.MDP3 | futures CME par contrat, OHLCV 1 min ; séries continues `GC.v.0`, `NQ.v.0` non ajustées | depuis 2010-06-06 | refusé (`hist.databento.com`) ; pas de clé d'API | source de référence, payante à l'usage |
| FirstRate Data | GC, NQ continus (non ajustés, ajustés) et par contrat ; 1, 5, 30 min, 1 h (pas de 15 min natif) | depuis 2008 | refusé | payant |
| Portara / CQG | NQ (ENQ) continu ajusté | depuis 1999 | refusé | payant |
| BacktestMarket | NQ ajusté 1 min | depuis 2009 | refusé | payant |
| MarketParquet | NQ, GC continus ratio-ajustés | historique complet payant, 30 jours gratuits | refusé | payant |
| CME DataMine | données officielles CME | complet | refusé | payant |
| Barchart, Polygon, Kibot, Tiingo, Stooq | divers | — | refusés | — |
| Yahoo Finance (GC=F, NQ=F) | continu Yahoo | 15 min limité aux 60 derniers jours | refusé | insuffisant de toute façon |
| Kaggle, Hugging Face | jeux tiers (par ex. NQ 1 min 2022-12 → 2025-12, provenance non documentée) | ≤ 3 ans | refusés | insuffisant |
| Dépôts GitHub publics (joignables) | `axb0306/cme-futures-ohlc` : GC, MGC, NQ, MNQ en 15 min via l'API TopstepX / ProjectX | 2026 seulement, roulement non documenté | joignable | moins d'un an : insuffisant |
| Dukascopy (joignable) | XAU/USD comptant, CFD d'indices (USATECH.IDX/USD) | plusieurs années | joignable | **substitut interdit** (pas des futures) |
| Binance, Hyperliquid (joignables) | perpétuels crypto sur or ou indices | récent | joignable | **substitut interdit** |
| Réserve fédérale, BLS, FRED | calendriers FOMC, CPI, emploi | — | refusés | les événements ne pourraient être étiquetés que par créneau horaire |

Le fichier `research/data/xauusd_15m.csv.gz` déjà présent dans le dépôt est de l'or **au comptant**
(Dukascopy, prix acheteur) : il n'a pas été utilisé.

## Pour débloquer l'étude

1. **Databento** (recommandé) : ajouter `hist.databento.com` aux domaines autorisés de
   l'environnement et fournir une clé d'API comme secret d'environnement ; jeu GLBX.MDP3, schéma
   `ohlcv-1m`, contrats ferme de GC et NQ (symboles parents `GC.FUT`, `NQ.FUT`) du 2010-06-06 au
   2026-09-30, plus le schéma `definition` (échéances, pas de cotation). Coût : devis sur le portail
   Databento (non estimé ici).
2. **Ou** déposer des fichiers d'un autre fournisseur dans `research/data/futures/` (exclu de git) au
   format décrit plus haut.
3. Dans les deux cas, les données ne sont pas commitées : les licences des fournisseurs interdisent en
   général la redistribution et le dépôt est public. Seules leurs empreintes SHA-256 et l'audit des
   données sont versionnés.

Une fois les données présentes, l'étude suit le protocole commité sans changement ; ses scripts seront
écrits contre ce protocole et commités avant le premier calcul sur GC ou NQ.
