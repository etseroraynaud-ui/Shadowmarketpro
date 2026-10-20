# Additif n° 3 — suite exploratoire : chocs en 1 h (H1) et 4 h (H4) sur les substituts

Rédigé le 2026-10-20 à la demande du propriétaire (« on peut essayer avec des shocks en h1 ? voire
plus ? »), **après** la conclusion de l'étude 15 min (or et Nasdaq : D en principal, C en secondaire ;
commit `0adda74`), et commité **avant tout calcul en H1 ou H4**. Complète `futures-k-transfer.md`,
`-proxy.md` et `-proxy-2.md` ; tout ce que ce texte ne change pas reste identique.

## 0. Statut : exploratoire

- Cette suite est décidée après avoir vu les résultats à 15 min : c'est une bifurcation du chemin de
  recherche. Tous ses essais sont comptés avec ceux de 15 min (§ 4). Une conclusion favorable resterait
  exploratoire et devrait être confirmée sur de vraies données de futures.
- **Test final non vierge** : la période 2023-01 → 2026-09 a déjà été regardée à 15 min sur les mêmes
  substituts. Elle reste utilisée comme test final (aucune autre période n'existe), sous cette réserve.
- Conclusions sur futures inchangées : D.

## 1. Ce qui change

- **Timeframe** : bougies de 60 min (H1) et de 240 min (H4), construites depuis les fichiers 15 min de
  l'étude par `resample` (`lib/backtest/data.ts`, alignement sur l'époque Unix, comme les barres
  horaires du filtre de tendance de `marketFor`). Deux études distinctes, rapportées séparément.
- **Réglages de V1 inchangés, en nombre de bougies** (fenêtres du z-score, de l'ATR, de la cassure, du
  volume, du λ, cooldown) : leurs durées sont multipliées par 4 (H1) ou 16 (H4). Aucun réglage n'est
  redimensionné : ce serait de nouveaux paramètres. Seul `kMain` du jeu calme varie, sur la même grille
  1,5 – 4,0.
- **Filtre de tendance 60 min** : sur un graphique de 60 min ou plus, le port (`marketFor`) prend les
  bougies du graphique comme barres du filtre : en H1, c'est la même moyenne horaire qu'à 15 min ; en
  H4, la moyenne porte sur des bougies de 4 h. Comportement du port, déclaré, non modifié.
- Bougie qui suit un trou : écart de plus d'une bougie du timeframe ; pas d'entrée (règle de V1).
- Régime de volatilité et tendance E2 : jours de séance tirés des bougies du timeframe (mêmes jours).
- **Horizons de l'étude d'événement** : 1, 4, 16 et 64 bougies du timeframe (H1 : 1 h à 64 h ; H4 : 4 h
  à 256 h). Porte G1 à 4 et 16 bougies, G2 à 16 bougies, G3 au moins 150 événements : inchangées.
- Créneaux d'annonces : une bougie est étiquetée si elle contient le créneau. Plages horaires et séances
  : selon l'heure d'ouverture de la bougie.
- Fermeture traversée (lecture) : écart de plus de 45 min au-delà de la durée d'une bougie.

## 2. Inchangé

Données, D_ext, E0, plis (or 2016 – 2022, Nasdaq 2017 – 2022), test final, contrôles de données (faits
sur les bougies 15 min source : la conclusion principale sera donc D pour les deux substituts, ce qui
est connu d'avance ; l'analyse secondaire de l'additif n° 2 s'applique), statistique S (15 positions par
moitié, seuil 1), plateau, méthode B (Q99 % de |z| sur l'entraînement), coûts futures, critères C1 – C7,
règle A / B / C / D, confidentialité, étape finale après commit des résultats de développement.

## 3. Ce qu'on attend (déclaré avant calcul)

Moins de bougies, donc moins d'événements et de trades : en H4, la porte G3 (150 événements) et la note
S (15 positions par moitié d'entraînement) risquent de ne pas être atteintes ; c'est alors le résultat,
sans ajustement.

## 4. Tests multiples

- C4 : Holm sur les 8 hypothèses de cette suite (2 timeframes × 2 marchés × 2 méthodes).
- C7 : Sharpe dégonflé avec N = somme, sur 15 min, H1 et H4, des configurations effectives de la grille,
  + 3 (méthode B à chaque timeframe), par marché ; dispersion des essais de la grille du timeframe testé.

## 5. Interdits

Ceux des textes précédents, plus : tester un autre timeframe (5, 30 min, journalier…) ou redimensionner
les réglages dans cette suite ; choisir après coup entre H1 et H4.
