# Shock Engine V1 sur les futures or (GC) — dossier

Protocole : `research/preregistration/futures-k-transfer.md` (commit `c7de6ab`, avant toute donnée).
Audit de la méthode historique : `research/futures-transfer/AUDIT.md`. Données :
`research/futures-transfer/DATA.md`.

## Conclusion : **D — les données disponibles ne permettent pas de conclure**

Aucune série GC en 15 min, longue et de provenance CME documentée, n'est accessible depuis
l'environnement d'exécution au 2026-10-20 (fournisseurs refusés par la politique réseau, pas de clé
d'API ; les seuls fichiers GC joignables couvrent 2026 seulement). Le protocole interdit de remplacer
GC par l'or au comptant, un CFD ou un ETF : les étapes qui dépendent des données n'ont pas été
calculées. Ce n'est ni un résultat positif ni un résultat négatif sur le phénomène.

## Sections du dossier

| section | état |
| --- | --- |
| Données utilisées et limites | aucune donnée GC ; sources examinées et raisons dans `DATA.md` |
| Étude événementielle avant optimisation (1, 4, 16, 64 bougies ; bootstrap ; t ajusté ; long / short ; régimes ; séances ; hasard et décalages) | **non calculée** (données) |
| Calibration de k (grille 1,5 – 4,0, configurations effectives) | **non calculée** |
| Courbes de robustesse selon k | **non calculées** |
| Walk-forward 2015 – 2022 et test final 2023 → | **non calculés** |
| Risque et performance après coûts (scénarios futures du § 7) | **non calculés** |
| Tests statistiques et corrections (Holm, Sharpe dégonflé, PBO) | **non calculés** |
| Comparaison seuil fixe (A) et seuil quantile (B) | **non calculée** |
| Configuration retenue | aucune (seule une conclusion A en donnerait une) |

## Ce qui est déjà connu, et qui ne vaut pas preuve sur GC

V1 a déjà été appliquée telle quelle à l'or **au comptant** XAU/USD (Dukascopy, 2013-01 → 2026-09,
`research/reports/shock-15m-zeroshot-xauusd-calm.md`) :
- étude d'événement : le critère pré-enregistré du projet (excès > 0 à 4 et 16 bougies, intervalle à
  90 % au-dessus de 0, deux moitiés positives, au moins 60 % des années) **n'est rempli ni par les
  entrées de V1 ni par les chocs bruts** : les entrées ont un excès positif à 16 et 64 bougies
  (intervalle à 90 % au-dessus de 0) mais pas à 4 bougies (−0,06 à +0,35 ATR), et l'excès à
  16 bougies vient surtout de la première moitié (+0,75 contre +0,15 ATR) ; les chocs bruts ne
  montrent pas de continuation ;
- stratégie à coûts de type crypto (0,045 % + 0,01 % par ordre) : 319 trades, Sharpe 0,40, profit
  factor 1,27, meilleure que 99,5 % des entrées au hasard ; Sharpe −0,12 à coûts doublés.

Ces chiffres portent sur un autre instrument (comptant, prix acheteur, volume en ticks), avec des
coûts bien plus élevés que ceux des futures. Ils rendent l'étude GC **non aveugle** pour la partie
au seuil figé (déclaré au § 0 du protocole) et ne remplacent pas l'étude.

## Reprendre l'étude

Fournir les données selon `DATA.md` (Databento GLBX.MDP3 recommandé, ou fichiers dans
`research/data/futures/`), puis écrire les scripts contre le protocole et les commiter avant le
premier calcul. Les seuils absolus resteront dans `research/private/futures-transfer/`.
