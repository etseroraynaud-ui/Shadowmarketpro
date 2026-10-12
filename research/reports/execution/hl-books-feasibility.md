# Carnets Hyperliquid historiques aux instants du Shock Engine : accès et faisabilité

Rédigé le 2026-10-12. Test de faisabilité avant toute étude complète ; aucun abonnement, aucun
coût de transfert engagé. Script : `research/execution/hl-free-days.ts` (lignes par exécution hors
dépôt, `research/data/hl-tardis/`).

## 1. Sources vérifiées

| Source | Accès constaté | Couverture | Contenu | Coût |
|---|---|---|---|---|
| Archive S3 officielle `hyperliquid-archive` | bucket existant ; **refus anonyme** (« Requester Pays ») vérifié | non vérifiable sans compte AWS (exemple documenté : 2023-09-16) ; mise en ligne « environ une fois par mois », trous possibles | `market_data/[date]/[heure]/l2Book/[coin].lz4` ; profondeur et fréquence à vérifier | transfert payé par le demandeur (≈ 0,09 $/Go selon un tiers) ; ≈ 1 240 fichiers horaires pour nos 1 309 exécutions depuis 2023, soit ≈ 0,2–1,1 $ |
| Tardis.dev | API de métadonnées vérifiée ; **jours gratuits (1er du mois) vérifiés** ; autres jours : refus 401 | depuis le **2024-10-29** (BTC, ETH) ; un incident le 2026-08-13 | canaux `l2Book` (20 niveaux par côté), `fastBook`, `trades`, `bbo`, `activeAssetCtx` ; jeux CSV `incremental_book_L2`, `book_snapshot_25`, `derivative_ticker` (prix mark) | abonnement payant (montant non publié dans les sources consultées) |
| SonarX | site inaccessible depuis l'environnement de calcul ; aucune trace du jeu de données dans les recherches | inconnue | inconnu | inconnu |

Tardis indique que son enregistreur et les serveurs de Hyperliquid sont à Tokyo (GCP
asia-northeast1, AWS ap-northeast-1).

**Limite commune.** Le carnet de Hyperliquid est diffusé sur **20 niveaux par côté**. Sur BTC, au
pas de 1 $, ces 20 niveaux couvrent **1,7 à 4 pb** du meilleur prix, soit 0 à 2,8 M$ mesurés. La
liquidité plus lointaine n'apparaît dans aucun instantané l2Book. Sur ETH, au pas de 0,1 $, ils
couvrent 5 à 12 pb, soit 2 à 11 M$. À vérifier : il est probable que l'archive S3 et les
reconstructions de Tardis dérivées de ce canal héritent de la même limite. Pistes de profondeur
complète, non vérifiées : instantanés à la minute de Dune (`perp_orderbook_1m`, accès restreint),
différences L4 de Bitquery, données de nœud de Hyperliquid.

## 2. Couverture des 2 474 exécutions (livrable A)

| Actif, année | Exécutions | Ère Hyperliquid (2023+) | Tardis (depuis le 2024-10-29) | Jours gratuits Tardis |
|---|---|---|---|---|
| BTC 2020–2022 | 545 | — | — | — |
| BTC 2023 | 171 | 171 | — | — |
| BTC 2024 | 175 | 175 | 22 | 4 |
| BTC 2025 | 168 | 168 | 168 | 2 |
| BTC 2026 | 149 | 149 | 149 | 0 |
| ETH 2020–2022 | 620 | — | — | — |
| ETH 2023 | 167 | 167 | — | — |
| ETH 2024 | 193 | 193 | 22 | 0 |
| ETH 2025 | 170 | 170 | 170 | 4 |
| ETH 2026 | 116 | 116 | 116 | 3 |
| **Total** | **2 474** | **1 309** (S3, à vérifier) | **647** | **13** (TP1 exclus) |

Les 1 165 exécutions de 2020–2022 sont antérieures au carnet BTC/ETH de Hyperliquid utilisé ici : aucun carnet
n'est reconstruit pour elles.

## 3. Reconstruction aux instants des exécutions (livrable B)

13 exécutions tombant un jour gratuit (8 entrées, 5 stops ; 6 BTC, 7 ETH ; décembre 2024 → mai 2026).
Pour chacune, seules les minutes utiles ont été téléchargées : 39 minutes, sans refus.

- Instantanés reçus en moyenne toutes les **0,54 à 0,58 s** ; à T + 0,5 s, le dernier carnet
  disponible a de 27 à 781 ms (médiane ≈ 300 ms). Aucun instantané postérieur à l'instant simulé
  n'est utilisé.
- Instant de référence : clôture T pour les entrées ; pour les stops, franchissement repéré sur
  Binance (approximation : le franchissement sur Hyperliquid peut différer de quelques secondes).
- Exemple de choc (BTC, entrée) : à T + 3 ms, les 20 niveaux vendeurs visibles ne contenaient que
  320 $ de petits ordres au pas de 1 $ ; une seconde plus tard, le meilleur vendeur était 34 $ plus
  haut (+3,4 pb). La liquidité réelle était au-delà du 20e niveau.

## 4. Coûts théoriques préliminaires (livrables C et D, 13 exécutions)

Ordre IOC à T + 0,5 s, consommant les niveaux visibles, limité à 50 pb du meilleur prix.

| | Ordre | Rempli dans les niveaux visibles | Coût au-delà du meilleur prix, médiane (max) | Binance, mêmes exécutions (médiane) |
|---|---|---|---|---|
| BTC | 250 k$ | 5 / 6 | 0,85 pb (1,55) | 0,00 pb |
| BTC | 500 k$ | 4 / 6 | 1,16 pb (1,87) | 0,08 pb |
| BTC | 1 M$ | 3 / 6 | 1,45 pb (2,27) | 0,14 pb |
| BTC | 2,5 M$ | 1 / 6 | 2,71 pb | — |
| ETH | 250 k$ | 7 / 7 | 0,60 pb (3,79) | 0,11 pb |
| ETH | 500 k$ | 7 / 7 | 0,97 pb (4,13) | 0,33 pb |
| ETH | 1 M$ | 7 / 7 | 2,05 pb (4,68) | 0,46 pb |
| ETH | 2,5 M$ | 6 / 7 | 3,02 pb (5,73) | — |

Sur BTC, « non rempli dans les niveaux visibles » veut dire « au-delà de ce que montrent 20
niveaux » et non « non exécutable ». Dérive du milieu de Hyperliquid entre la décision et l'arrivée,
en médiane : BTC 0,36 pb à 0,5 s et 2,24 pb à 5 s ; ETH 0 pb et 4,63 pb.

Lecture : sur ces 13 cas, le carnet visible de Hyperliquid coûte plus cher que les ordres réels
observés sur Binance à taille égale, d'environ 1 pb à 500 k$. C'est un indice d'un rapport de
profondeur ρ inférieur à 1, à confirmer sur un échantillon plus large. 13 cas ne fondent aucune
statistique de capacité.

## 5. Ce qu'il faut pour l'étude complète (livrable E)

1. **Archive S3 officielle** (≈ 0,2–1,1 $ de transfert) : couvre potentiellement 1 309 exécutions
   depuis 2023. Il faut un compte AWS : clés d'un utilisateur limité à la lecture de
   `hyperliquid-archive`, ajoutées comme secrets de l'environnement. Un premier fichier vérifiera la
   couverture, la fréquence et la profondeur.
2. **Tardis payant** : 647 exécutions depuis le 2024-10-29, mêmes 20 niveaux (à vérifier).
3. **Profondeur au-delà de 20 niveaux sur BTC** : aucune des sources ci-dessus ne la donne a
   priori. Sans elle, les ordres BTC de 1 M$ et plus restent bornés (coût au moins égal à celui du
   20e niveau, liquidité au-delà inconnue).
