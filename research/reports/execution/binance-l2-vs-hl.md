# Carnets L2 historiques Binance USDⓈ-M contre Hyperliquid, aux instants du Shock Engine

Rédigé le 2026-10-12. Jours gratuits de Tardis (1er du mois), mêmes 13 exécutions que
`hl-books-feasibility.md` : mêmes instants, sens et tailles. Script :
`research/execution/binance-l2-free-days.ts`. Lignes par exécution hors dépôt. Aucun abonnement,
aucun coût ; ≈ 0,6 Go de données gratuites téléchargées.

## 1. Accès et reconstruction (Binance)

- Flux `depth@0ms` de Binance enregistré par Tardis à Tokyo : chaque modification de chaque niveau,
  toutes les ≈ 50 ms, avec numéros de séquence (U, u, pu).
- **Reconstruction complète validée** (instantané Tardis de début de journée, 1 000 niveaux par côté,
  puis toutes les mises à jour) : 19 581 mises à jour (ETH) et 25 248 (BTC), **0 rupture de
  séquence**. Procédure Binance : mises à jour reçues avant l'instantané gardées puis rejouées
  (l'instantané arrive ≈ 1 s après elles).
- **Reconstruction par fenêtre de 10 min** (pour éviter de rejouer jusqu'à 22 h de flux) : comparée à
  la reconstruction complète, profondeur identique jusqu'à 20 pb, 1 % de moins à 50 pb (méthode
  prudente), coût des IOC identique à toutes les tailles.
- 13 exécutions : 12 sans rupture, **1 rupture** (ETH, 2026-05-01, entrée). Carnet Binance âgé de 1 à
  48 ms à T + 0,5 s ; carnet Hyperliquid de 27 à 781 ms (instantanés toutes les ≈ 0,55 s).
- À chaque instant simulé : mises à jour d'heure d'événement ≤ instant seulement.

## 2. Exemple : BTC, 2025-05-01, achat à la clôture, T + 0,5 s

| | Binance | Hyperliquid |
|---|---|---|
| meilleur vendeur | 96 291,1 (5,675 BTC = 0,55 M$) | 96 329 (0,0005 BTC) |
| vendeurs à moins de 0,1 pb | 0,77 M$ | ≈ 0 |
| vendeurs à moins de 3 / 5 / 10 pb | 6,9 / 10,6 / 29,3 M$ | 0 / 0 / 0 (20 niveaux de poussière, jusqu'à +2,1 pb) |
| IOC 2,5 M$, coût au-delà du meilleur prix | **0,60 pb**, rempli | non observable |
| écart de prix (milieu Binance − milieu Hyperliquid) | −4,8 pb | |

À cet instant, le meilleur acheteur de Hyperliquid (96 328) était au-dessus du meilleur vendeur de
Binance. Hyperliquid cotait 4,8 pb plus haut, ses vendeurs venaient d'être levés ; Binance absorbait
2,5 M$ à 0,6 pb.

## 3. Comparaison, médianes des 13 exécutions (T + 0,5 s)

Coût de profondeur = prix moyen de l'IOC par rapport au meilleur prix **de chaque plateforme**. La
différence de cotation entre plateformes est mesurée à part.

| | BTC Binance | BTC Hyperliquid | ETH Binance | ETH Hyperliquid |
|---|---|---|---|---|
| spread | 0,01 pb | 0,10 pb | 0,05 pb | 0,44 pb |
| profondeur < 3 pb (médiane, min.) | 5,6 M$ (3,5) | 0,9 M$ (0) | 2,3 M$ (0,4) | 0,7 M$ (0,01) |
| profondeur < 5 pb | 9,3 M$ (6,9) | 1,1 M$ (0) | 3,0 M$ (1,0) | 2,3 M$ (0,3) |
| profondeur < 10 pb | 21,5 M$ (14,9) | 1,1 M$ (0) | 6,5 M$ (2,5) | 5,8 M$ (2,1) |
| IOC 250 k$ : rempli, coût | 6/6, 0,00 pb | 5/6, 0,85 pb | 7/7, 0,17 pb | 7/7, 0,60 pb |
| IOC 500 k$ | 6/6, 0,00 pb (max 0,69) | 4/6, 1,16 pb | 7/7, 0,54 pb (max 1,95) | 7/7, 0,97 pb |
| IOC 1 M$ | 6/6, 0,28 pb (max 1,02) | 3/6, 1,45 pb | 7/7, 1,09 pb (max 2,88) | 7/7, 2,05 pb |
| IOC 2,5 M$ | 6/6, 0,78 pb (max 1,55) | 1/6, 2,71 pb | 7/7, 1,47 pb (max 5,63) | 6/7, 3,02 pb |
| retrait de 50 % des tailles affichées, IOC 1 M$ | 0,66 pb | — | 1,38 pb | — |
| milieu Binance − milieu Hyperliquid | médiane −2,1 pb (−4,8 ; +0,1) | | médiane −1,5 pb (−8,3 ; +0,3) | |

« Rempli » côté Hyperliquid = dans les 20 niveaux visibles. Une exécution non remplie y est **non
observable**, pas inexécutable. Sur BTC, les 20 niveaux couvrent 1,7 à 4 pb. Toutes les exécutions
sont gardées dans les médianes, y compris les cas difficiles.

Frais, à part et sans double compte : taker 0,050 % sur Binance (VIP 0) contre 0,045 % sur
Hyperliquid (palier de base), soit 0,5 pb de plus par exécution au marché sur Binance.

## 4. Les hypothèses de coût précédentes tiennent-elles ?

L'étude 500 k$ / 1 M$ estimait le coût immédiat par les ordres réels comparables (premiers dollars
des ordres agresseurs d'au moins Q $). Mêmes exécutions, même délai (0,5 s) :

| | BTC : L2 − ancienne méthode (médiane, max.) | ETH : L2 − ancienne méthode | ETH : L2 plus cher dans |
|---|---|---|---|
| 250 k$ | −0,00 pb (+0,48) | −0,01 pb (+0,94) | 3 / 7 |
| 500 k$ | −0,05 pb (+0,67) | **+0,35 pb (+1,56)** | 5 / 7 |
| 1 M$ | +0,09 pb (+0,88) | **+0,71 pb (+2,46)** | 5 / 7 |

- **BTC : confirmé.** L'ancienne méthode et le carnet L2 donnent le même coût, à quelques
  centièmes de pb près en médiane.
- **ETH : sous-estimation du coût de profondeur**, de l'ordre de 0,3 pb à 500 k$ et 0,7 pb à 1 M$ sur
  ces 7 cas. Les ordres réels de grande taille passent quand la liquidité est là ; un ordre envoyé à
  heure fixe tombe parfois sur un carnet plus mince.
- Ordre de grandeur, sans recalculer de Sharpe sur 13 cas : avec la sensibilité de l'étude P0
  (≈ 0,064 de Sharpe par pb sur toutes les exécutions), un surcoût de 0,35 pb (1 M$) à 0,7 pb
  (2 M$) sur les exécutions ETH au marché (≈ 45 % des exécutions) retirerait ≈ 0,01 à 0,02 de
  Sharpe. La dérive pendant la latence reste le coût dominant.
- **Hyperliquid est moins profond que Binance** : le coût de profondeur y est 1,5 à 4 fois plus élevé
  sur ETH, et sur BTC la profondeur au-delà de 2–4 pb n'est pas observable. Les projections Binance ne
  se transposent pas telles quelles ; elles doivent être réduites (ρ < 1 dans les bornes de
  `fills-500k-1m.md`).

## 5. Limites

- 13 exécutions, toutes un 1er du mois : aucune statistique de capacité.
- Carnet affiché seulement : annulations avant l'arrivée (sensibilité « retrait de 50 % »), réaction
  des autres participants et impact sur les prix suivants ne sont pas observés.
- Dérive à 0,5–1 s sur Hyperliquid : sous-estimée par l'âge des instantanés (jusqu'à 0,8 s).
- Fenêtre de 10 min : les niveaux immobiles depuis plus de 10 min manquent (−1 % à 50 pb sur le test
  de validation).

## 6. Recommandation

Étendre à **quelques centaines d'exécutions** (échantillon aléatoire pré-enregistré, ≈ 150 par
actif, toutes années, chocs inclus) sur le carnet L2 Binance. La méthode par fenêtre ne demande que
≈ 45 Mo par exécution (≈ 15 Go pour 300), mais hors 1er du mois il faut un accès payant à Tardis.
Cela fixerait la correction ETH et les queues (P95, P99) aux tailles de 1 M$ à 2,5 M$. Pour
Hyperliquid, seul un carnet plus profond que 20 niveaux (voir `hl-books-feasibility.md`) permettrait
de juger BTC au-delà de 1 M$.
