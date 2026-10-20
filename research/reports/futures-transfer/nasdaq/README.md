# Shock Engine V1 sur les futures E-mini Nasdaq-100 (NQ) — dossier

Protocole : `research/preregistration/futures-k-transfer.md` (commit `c7de6ab`, avant toute donnée).
Audit de la méthode historique : `research/futures-transfer/AUDIT.md`. Données :
`research/futures-transfer/DATA.md`.

## Conclusion : **D — les données disponibles ne permettent pas de conclure**

Aucune série NQ en 15 min, longue et de provenance CME documentée, n'est accessible depuis
l'environnement d'exécution au 2026-10-20 (fournisseurs refusés par la politique réseau, pas de clé
d'API ; les seuls fichiers NQ joignables couvrent 2026 seulement ; un jeu tiers 2022-12 → 2025-12 sur
Kaggle n'est ni joignable ni documenté). Le protocole interdit de remplacer NQ par un CFD d'indice, QQQ
ou un perpétuel : les étapes qui dépendent des données n'ont pas été calculées. Ce n'est ni un
résultat positif ni un résultat négatif sur le phénomène.

## Sections du dossier

| section | état |
| --- | --- |
| Données utilisées et limites | aucune donnée NQ ; sources examinées et raisons dans `DATA.md` |
| Étude événementielle avant optimisation (1, 4, 16, 64 bougies ; bootstrap ; t ajusté ; long / short ; régimes ; séances régulière et étendue ; hasard et décalages) | **non calculée** (données) |
| Calibration de k (grille 1,5 – 4,0, configurations effectives) | **non calculée** |
| Courbes de robustesse selon k | **non calculées** |
| Walk-forward 2015 – 2022 et test final 2023 → | **non calculés** |
| Risque et performance après coûts (scénarios futures du § 7) | **non calculés** |
| Tests statistiques et corrections (Holm, Sharpe dégonflé, PBO) | **non calculés** |
| Comparaison seuil fixe (A) et seuil quantile (B) | **non calculée** |
| Configuration retenue | aucune (seule une conclusion A en donnerait une) |

## Ce qui est déjà connu

Rien : le Nasdaq-100 n'a jamais été testé dans ce dépôt. Une fois les données disponibles, l'étude NQ
sera aveugle (protocole § 0).

## Reprendre l'étude

Fournir les données selon `DATA.md` (Databento GLBX.MDP3 recommandé, ou fichiers dans
`research/data/futures/`), puis écrire les scripts contre le protocole et les commiter avant le
premier calcul. Les seuils absolus resteront dans `research/private/futures-transfer/`.
