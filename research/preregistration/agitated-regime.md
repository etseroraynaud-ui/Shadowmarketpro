# Pré-spécification — architecture du régime agité

Rédigé le 2026-10-13 et commité, avec la boucle de simulation à taille par régime
(`research/lib/variant-eval.ts`), **avant toute simulation d'une variante de cette étude**. Script :
`research/shock/agitated-regime.ts` ; rapport : `research/reports/agitated-regime/`.

## 0. Ce qui ne change pas

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`, de `research/lib/e2.ts`
  ni du bot n'est modifié (empreintes vérifiées avant tout calcul).
- Les variantes passent par les arguments existants de `simulate` (liste d'entrées, jeux de réglages)
  et par la taille de position lue par le broker à chaque ouverture (`costs.qtyPct`), ajustée dans
  une copie de la boucle de `simulate`. Les décisions d'entrée et de sortie ne dépendent pas de la
  taille (levier 1, aucune liquidation possible) ; la copie redonne `simulate` à l'identique quand la
  taille est inchangée (contrôle bloquant).
- V0 (Shock Engine E2) reste la référence. Rien n'est changé dans le live. Une variante favorable
  serait au mieux une **candidate** pour un test forward pré-enregistré à part.

## 1. Ce qui est déjà connu (divulgation)

Résultats déjà vus, qui ont motivé l'étude : sur BTC/ETH, les trades du régime agité somment −30 R
(Σ ln(1 + rendement) −26 %, 597 trades) contre +766 R en régime calme ; sur les 8 cryptos, −94 R
(+24 %) contre +869 R (+738 %) (`research/reports/loss-anatomy/`). R moyen hors entraînement du
régime agité −0,08 (`research/reports/proba/`). Les 8 cryptos ont donc été consultées pour ce
découpage : elles servent ici de **vérification de transportabilité**, pas d'échantillon vierge.
**Aucune** variante ci-dessous n'a été simulée ; les diagnostics du § 3 n'ont pas été calculés.

## 2. Hypothèses

- **A** : le régime agité n'a pas assez d'alpha de continuation après les signaux.
- **B** : le stop de 1,1 ATR est trop rapproché ; les positions sont coupées avant de se développer.
- **C** : c'est la combinaison des réglages d'entrée et de sortie du jeu agité qui ne convient pas.

## 3. Diagnostics (descriptifs, V0)

Par régime (calme / agité), longs seulement (le jeu agité n'autorise pas les shorts), BTC/ETH et
8 cryptos :

- **D1, continuation après le signal** (indépendante des sorties) : d·(P_{t+h} − P_t) / ATR d'entrée
  aux horizons 1, 4, 16, 64 bougies (P_t = prix d'entrée) : moyenne (IC bootstrap par mois 95 %),
  médiane, part > 0. Soutient A si l'excès moyen du régime agité est nul ou négatif.
- **D2, après le stop** : pour les trades sortis au stop initial (SL seul), d·(P_{e+16} − P_t) / ATR
  et d·(P_{e+64} − P_t) / ATR, où e est la bougie de sortie : part des cas où le prix est ensuite
  au-delà de +1,1 ATR (le stop du jeu agité) et au-delà de +3,3 ATR. Soutient B si, en régime agité,
  une part importante des trades stoppés repart ensuite dans le sens du signal.
- **D3, excursions en ATR** : MFE et MAE en ATR d'entrée (et non en R, dont l'unité change avec le
  stop), médianes et quartiles.

## 4. Variantes (fixées ici)

| Variante | Définition | Question |
|---|---|---|
| **V0** | Shock Engine E2 inchangé | référence |
| **V1** | aucune nouvelle entrée quand le jeu agité décide ; positions ouvertes et sorties inchangées | contribution réelle du régime agité au portefeuille |
| **V2a** | jeu agité avec `atrStopMult` = 3,3 (valeur du jeu calme), tout le reste identique ; taille inchangée (100 % de l'equity) | stop moins serré, risque monétaire par trade multiplié par 3 |
| **V2b** | comme V2a, taille des entrées du jeu agité × 1,1 / 3,3 | stop moins serré, **même risque monétaire par trade** que V0 (exposition divisée par 3) |

Aucun autre réglage (TP1 0,9 ATR sur 20 %, stop suiveur 3,2 ATR, flip, entrées) n'est modifié.
Chaque variante est rejouée intégralement, mêmes coûts, signaux suivants recalculés après toute
sortie différente.

## 5. Mesures

Par actif et pour le portefeuille BTC/ETH 50/50 sans rebalancement (convention de
`research/shock/portfolio.ts`) : CAGR, Sharpe journalier, drawdown maximal, rendement total, profit
factor, trades, **temps en position** (part des bougies avec une position), **exposition brute
moyenne** (notionnel / equity), et **conservation des meilleurs trades** : parmi les 5 % meilleurs
trades de V0 (rendement / equity à l'entrée), part retrouvée dans la variante (même bougie d'entrée,
même sens) et part de leur rendement cumulé conservée. Coûts × 1 et × 2.

## 6. Lecture (exploratoire, aucun échantillon vierge)

- Écart de Sharpe du portefeuille BTC/ETH avec intervalle bootstrap par mois apparié (95 %), et
  écart moyen sur les 8 cryptos avec intervalle bootstrap par mois communs (90 %), nombre de cryptos
  améliorées.
- Une variante est notée **« candidate pour un test forward »** si : Δ Sharpe BTC/ETH > 0, Δ moyen
  sur les 8 cryptos > 0 avec borne basse à 90 % > 0, au moins 6 cryptos sur 8 améliorées, et Δ > 0
  avec des coûts × 2. Sinon : « pas de candidate ». Aucune conclusion n'est confirmatoire.
- Lecture des hypothèses : A soutenue si D1 agité ≤ 0 et V1 ≥ V0 ; B soutenue si D2 agité montre
  des reprises fréquentes et V2b > V0 ; C si ni A ni B ne rendent compte du résultat.

Bootstrap : 5 000 réplications, graine 20261013.
