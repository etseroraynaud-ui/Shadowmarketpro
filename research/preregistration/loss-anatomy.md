# Pré-spécification — anatomie des pertes : avant toute continuation ou après un gain rendu

Rédigé le 2026-10-13 et commité **avant tout calcul** de cette étude. Script :
`research/shock/loss-anatomy.ts` ; rapport : `research/reports/loss-anatomy/`. Étude descriptive :
elle ne modifie ni ne teste aucune règle du Shock Engine ; elle dit si la prochaine recherche doit
porter sur les **entrées** ou sur les **sorties**.

**Ce qui était connu.** Distributions publiées de R, de la MFE et de la MAE (rapport de la couche
probabiliste : 36 % des perdants ont d'abord été à +1 R ou mieux, sans découpage par sortie ni par
régime) ; études précédentes (`proba`, `regime-fakeout`) : ni les caractéristiques d'entrée ni le
régime avant le signal ne séparent gagnants et perdants. Aucun des calculs ci-dessous n'a été fait.

## Données

Trades V0 (Shock Engine E2 inchangé) : 1 311 trades BTC/ETH de référence (développement) et trades
des 8 actifs vierges de `research/lib/regime-er.ts` (réplication). R = PnL net / risque initial.
**MFE** et **MAE** : excursions mesurées par le moteur (`broker.ts` : extrêmes des bougies entières
tant que la position est ouverte, plus les prix d'exécution), en R.

## Classes (seuils fixés ici)

Perdants (R ≤ 0) :

| Classe | Définition | Lecture |
|---|---|---|
| **A · sans continuation** | MFE < 0,5 R | l'entrée a échoué tout de suite |
| **B · continuation partielle** | 0,5 R ≤ MFE < 1 R | le mouvement a démarré puis échoué |
| **C · gain rendu** | MFE ≥ 1 R | le trade a été gagnant d'au moins 1 R puis rendu |

Gagnants (R > 0) : **taux de capture** R / MFE et **gain rendu** MFE − R ; sous-classe « gros gain
rendu » : MFE ≥ 2 R et R < 1 R.

Pour chaque classe : trades, part des trades, ΣR et part de la somme des pertes, MFE, MAE et durée
médianes, sorties (SL, TP1+SL, FLIP…), part des pertes sorties dans la première heure (≤ 4 bougies).
Découpages : actif, sens, régime de volatilité (jeu calme / agité).

## Bornes et contrefactuel de premier ordre

- **Borne « entrées »** : somme des pertes de la classe A, soit ce qu'un filtre d'entrée parfait
  (qui n'écarterait aucun gagnant) récupérerait au mieux.
- **Borne « sorties »** : somme, sur la classe C, de (R contrefactuel − R) si la perte avait été
  ramenée au point mort, soit ce qu'une sortie parfaite des gains rendus récupérerait au mieux.
- **Contrefactuel unique : stop au point mort après +1 R.** Trajet intrabarre du moteur (ouverture →
  extrême le plus proche → l'autre → clôture) ; après le premier passage à +1 R, un retour au prix
  d'entrée avant la sortie réelle ferme la position au prix d'entrée (TP1 déjà exécuté conservé,
  commissions du trade réel). Bougie de sortie : seulement son ouverture. Approximation de premier
  ordre, trade par trade, sans rejouer la suite des signaux : elle mesure le gain sur les perdants
  **et le coût sur les gagnants**. Ce n'est pas un test de variante ; une règle de sortie nouvelle
  demanderait un plan et une simulation complète séparés.

Intervalles : bootstrap par mois civils d'entrée, 2 000 réplications, graine 20261013, pour la part
des pertes en classe A, la part en classe C et l'effet net du contrefactuel.

## Lecture prévue

- Pertes surtout en A, contrefactuel net ≤ 0 → la recherche suivante porte sur les **entrées**.
- Pertes surtout en C et contrefactuel net > 0 sur les deux échantillons → sur les **sorties**.
- Sinon : pas de cible dominante ; rapporter les deux bornes sans conclure.
