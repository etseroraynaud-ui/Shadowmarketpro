# Avenant au pré-enregistrement de l'étude de capacité — jours gratuits Tardis

Rédigé le 2026-10-12 et commité **avant** tout calcul de représentativité et tout téléchargement de
carnet Tardis. Complète le § 10 de `research/preregistration/capacity-p0p1.md`.

## 1. Accès constaté

- Les fichiers CSV (`datasets.tardis.dev`) restent inaccessibles depuis l'environnement de calcul,
  même après autorisation du domaine : Cloudflare renvoie une page de vérification (HTTP 403).
- L'API de rejeu (`api.tardis.dev/v1/data-feeds`) répond pour le premier jour du mois, sans clé.
  Pour Binance USDⓈ-M, elle fournit **un seul** instantané complet du carnet par jour
  (`depthSnapshot`, 1 000 niveaux, à 00:00 UTC), puis les mises à jour (`depth`, environ 1,3 à
  2 Mo par minute et par actif). Reconstituer le carnet à l'instant t impose de rejouer toutes les
  mises à jour depuis 00:00.
- Coût d'une journée complète : ≈ 2,3 Go par actif ; 82 jours × 2 actifs ≈ 380 Go. Hors de portée.

## 2. Ensembles d'instants envisagés

- **A** : 00:00:00 UTC du premier jour de chaque mois, 2020-01 → 2026-10 (instantané seul).
- **A2** : A plus les 8 clôtures de quart d'heure de 00:15 à 02:00 UTC (carnet rejoué depuis
  l'instantané ; ≈ 200 Mo par actif et par jour).

## 3. Test de représentativité (avant tout téléchargement de carnet)

- Covariables, calculées sur les bougies 1 min et `bookDepth` Binance déjà téléchargés,
  strictement avant chaque instant : x = (log σ_J sur 24 h, log V_J sur 24 h) ; depuis 2023,
  x' = (log σ_J, log V_J, log profondeur à ±1 %), la profondeur étant le minimum des côtés acheteur
  et vendeur pour les instants, le côté consommé pour les exécutions.
- Exécutions comparées : toutes celles de la fenêtre Binance (entrées, stops, TP1, sorties).
- Couverture, par actif et par ensemble d'instants : une exécution est couverte si (i) chaque
  covariable est dans l'intervalle [1er ; 99e centile] des instants, et (ii) sa distance de
  Mahalanobis à la moyenne des instants (espace log standardisé, covariance des instants) est au
  plus le 99e centile des distances des instants eux-mêmes.
- **Critère** : couverture ≥ 90 % pour chaque actif, séparément sur x (2020–2026) et sur x'
  (2023–2026). Statistiques de Kolmogorov–Smirnov par covariable rapportées sans seuil ; couverture
  par année rapportée sans seuil.

## 4. Décision

- **Si A2 passe le critère** : téléchargement de A2, puis calibration pré-spécifiée ici :
  coût d'un ordre au marché immédiat (parcours du carnet, demi-spread compris, en pb du milieu)
  pour Q ∈ {50 k$, 125 k$, 250 k$, 500 k$, 2,5 M$}, achat et vente ; régression par moindres
  carrés par actif : log coût = a + b log Q + c₁ log σ_J + c₂ log V_J (+ c₃ log profondeur à ±1 %
  depuis 2023) ; prédiction aux exécutions comme variante « carnet immédiat » de l'impact, et
  distribution du Y implicite = coût / (σ_J √(Q / V_J)). La dérive mesurée n'est pas concernée.
- **Si seul A passe** : même calibration sur A seulement.
- **Si aucun ne passe** : aucune calibration. Les instantanés de A (≈ 42 ko chacun) sont téléchargés
  et décrits (coût d'un ordre immédiat à 00:00 le premier jour du mois), explicitement présentés
  comme non représentatifs des instants de signal.
