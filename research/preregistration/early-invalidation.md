# Pré-spécification — invalidation précoce d'un choc qui ne confirme pas

Rédigé le 2026-10-13 et commité, avec les fonctions de mesure et la boucle de rejeu
(`research/lib/early-exit.ts`), **avant tout calcul de cette étude**. Script :
`research/shock/early-invalidation.ts` ; rapport : `research/reports/early-invalidation/`.

## 0. Cadre

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`, de `research/lib/e2.ts`
  ni du bot n'est modifié (empreintes vérifiées). La sortie précoce est une fermeture au marché à la
  clôture, injectée dans une copie de la boucle de `simulate` exactement comme le moteur exécute une
  fermeture décidée par le script (flip) ; la copie redonne `simulate` à l'identique sans la règle
  (contrôle bloquant).
- V0 (E2) reste la référence. Exploratoire : BTC/ETH sont les données de développement et les
  8 cryptos ont déjà été consultées. Une variante favorable ne serait qu'une candidate pour un test
  forward pré-enregistré à part.

## 1. Ce qui est connu

Anatomie des pertes (`research/reports/loss-anatomy/`) : 43–48 % de la somme des pertes viennent de
trades jamais passés à +0,5 R, la moitié sortie dans la première heure ; protéger les gains (point
mort après +1 R) coûte plus que cela ne rapporte. **Aucune** mesure ci-dessous n'a été calculée ;
la règle du § 4 n'a jamais été simulée.

## 2. Population : tous les trades encore ouverts au même instant

Pour k = 1, 2, 3, 4 bougies après l'entrée (entrée à la clôture de la bougie i), population P_k :
trades V0 dont la sortie a lieu **après** la clôture de la bougie i + k (encore ouverts une fois la
bougie i + k jouée), futurs gagnants et perdants confondus. Les trades déjà sortis ne sont pas
retirés après coup : ils sont simplement hors de P_k.

## 3. Mesures à la clôture de i + k (connues à cet instant)

- **Rendement directionnel** d·(c_{i+k} − prix d'entrée), en ATR d'entrée et en R.
- **Retracement du choc** : d·(c_i − c_{i+k}) / d·(c_i − c_{i−1}) (part du mouvement de la bougie de
  choc rendue ; > 1 : sous la clôture qui précédait le choc).
- **Réintégration** : clôture de i + k revenue de l'autre côté du niveau cassé (plus haut ou plus bas
  des `rangeWin` bougies du jeu qui décide).
- **Volume après le choc** : moyenne des volumes de i + 1 … i + k / volume de la bougie de choc.
- **Issue** (future) : R final, perdant (R ≤ 0), grand gagnant (R ≥ 3).
- **Valeur d'une sortie à k** pour chaque trade de P_k : R obtenu en fermant à la clôture de i + k
  (part du TP1 déjà exécutée conservée, commissions du trade réel) moins R final. Somme positive sur
  un groupe : couper ce groupe à k aurait rapporté.

Groupes de P_k : rendement ≤ 0 ou > 0 (**principal**) ; réintégré ou non ; retracement ≥ 0,5 ou non ;
volume après le choc sous ou au-dessus de sa médiane dans P_k. Pour chaque groupe : effectif, part de
P_k, P(perdant), P(grand gagnant), part des grands gagnants de P_k, R final moyen, valeur moyenne et
totale d'une sortie à k (IC bootstrap par mois, 95 %, 2 000 réplications, graine 20261013).

## 4. Hypothèse unique et variante (fixées ici)

**Un choc qui n'a pas confirmé son mouvement après une heure doit-il être invalidé ?**

- **V1** : à la clôture de la 4e bougie après l'entrée (i + 4), si la position est toujours ouverte et
  que d·(c_{i+4} − prix d'entrée) ≤ 0, fermeture au marché à cette clôture. Rien d'autre ne change ;
  les signaux suivants sont recalculés (rejeu complet).
- Sensibilité **descriptive** seulement (pas de décision) : même règle à i + 2 et à i + 8.

Mesures : CAGR, Sharpe, drawdown maximal, rendement total, profit factor, trades, temps en position,
conservation des 5 % meilleurs trades de V0 (même bougie d'entrée et même sens, part du rendement
conservée). BTC/ETH (portefeuille 50/50 sans rebalancement) et 8 cryptos ; coûts × 1 et × 2.

**Lecture** : V1 est « candidate pour un test forward » si Δ Sharpe BTC/ETH > 0, Δ moyen sur les
8 cryptos > 0 avec borne basse de l'IC à 90 % > 0 (bootstrap par mois communs, 5 000 réplications),
au moins 6 cryptos sur 8 améliorées, et Δ > 0 avec des coûts × 2 sur les deux échantillons. Sinon :
« pas de candidate ».
