# Pré-spécification — walk-forward Bitcoin à fenêtres plus longues

Rédigé le 2026-10-13 et commité **avant tout calcul** des configurations ci-dessous. Script :
`research/shock/wf-plateau.ts` (options ajoutées ici, sans changer la méthode) et synthèse
`research/shock/wf-longer.ts` ; rapport : `research/reports/wf-longer/`.

## 0. Ce qui est déjà connu

Le walk-forward publié (calibration sur les 36 mois précédents, test de 3 mois, 28 fenêtres de
2020-01-01 au 2026-10-04, règles publiées : entrées en régime calme seulement, shorts en tendance
baissière) donne un Sharpe de **0,83** contre **1,55** pour le préréglage fixe sur les mêmes fenêtres
(`research/reports/shock-15m-wf-plateau-36-3-calm.md`). Cette étude est demandée après avoir vu ce
résultat : elle n'est donc pas aveugle. Elle répond à une seule question : **la faiblesse du
walk-forward tient-elle à la longueur des fenêtres ?** Elle ne remplace pas la configuration 36/3,
qui reste la référence publiée parce qu'elle a été fixée avant de connaître son résultat.

## 1. Ce qui ne change pas

Méthode de `wf-plateau.ts` à l'identique : grille par régime (seuil du choc 2 / 2,4 / 2,8 / 3,2 ×
stop 0,8 / 1,2 / 1,8 / 2,6 / 3,6 ATR × stop suiveur 2 / 3,2 / 5 / sans), note = Sharpe quotidien sur
la calibration (0 sous 20 trades), choix du meilleur plateau (moyenne sur le point et ses voisins),
régime non tradé si le plateau n'est pas positif, une seule simulation hors échantillon, règles
publiées (`--calm`), frais 0,045 % par ordre, BTC/USD Bitstamp 15 min. **Même période de test pour
toutes les configurations : 2020-01-01 → 2026-10-04**, comparée au préréglage fixe sur la même
période (Sharpe 1,55, flatteur car choisi sur 2017–2026). Aucun paramètre de la stratégie n'est
modifié.

## 2. Configurations (12, toutes publiées)

| Calibration | Test 3 mois | Test 6 mois | Test 12 mois |
|---|---|---|---|
| 36 mois glissants (référence) | 36/3 (publié : 0,83) | 36/6 | 36/12 |
| 48 mois glissants | 48/3 | 48/6 | 48/12 |
| 60 mois glissants | 60/3 | 60/6 | 60/12 |
| croissante depuis le 2015-01-01 (60 mois au départ, 11 ans à la fin) | exp/3 | exp/6 | exp/12 |

Le pas entre deux tests est égal à la durée du test. Les calibrations de 48 et 60 mois et la fenêtre
croissante utilisent des données de 2015–2016 (Bitstamp, environ 99 % des bougies présentes), qui
n'ont jamais servi à régler la stratégie. Pour elles, les simulations de la grille commencent au
début de la plus ancienne calibration ; pour 36/x elles commencent au 2017-01-01 comme avant.

## 3. Mesures

Pour chaque configuration : Sharpe et Sortino (rendements par bougie de 15 min, comme le rapport
publié), CAGR, pire baisse, trades, et le **rapport walk-forward / préréglage fixe** sur la même
période. Résumé : médiane et étendue des 12 Sharpe walk-forward.

## 4. Contrôle bloquant

La configuration 36/3 doit redonner exactement le résultat publié (Sharpe 0,83, 390 trades) avec le
script modifié ; sinon rien n'est publié.

## 5. Règle de lecture, fixée avant calcul

- Les 12 résultats sont publiés ensemble. Aucune configuration n'est retenue parce qu'elle est la
  meilleure ; le site et les documents citent la référence 36/3 **et** la médiane et l'étendue des 12.
- Si la médiane des 12 Sharpe walk-forward est **≥ 1,20**, la faiblesse tient en partie à des
  fenêtres trop courtes (calibration bruitée) ; si elle est **≤ 1,00**, la longueur des fenêtres
  n'explique pas la faiblesse ; entre les deux, le résultat est mitigé.
- Dans tous les cas, un walk-forward reste un test sur l'historique déjà utilisé pour concevoir la
  stratégie : il mesure le coût de la re-sélection des réglages, pas la performance future.

## 6. Addendum du 2026-10-13 — mêmes configurations sur les règles à deux régimes (E2)

Ajouté et commité **avant tout calcul** de ces configurations, à la demande : les 12 configurations
du § 2, à l'identique, sur les règles précédentes à deux régimes (`--e2` : régimes calme et agité
tradés, chacun avec ses réglages re-sélectionnés ; shorts en tendance baissière). Même période de
test, même méthode, mêmes mesures. Contrôle bloquant : 36/3 doit redonner le rapport publié
(`research/reports/shock-15m-wf-plateau-36-3-e2.md` : Sharpe 1,11, 502 trades, préréglage fixe
1,49). Même règle de lecture (§ 5 : médiane ≥ 1,20, ≤ 1,00 ou entre les deux), appliquée à E2
seule. La comparaison avec les règles publiées est descriptive : elle ne sert pas à choisir des
règles, et le walk-forward ne re-sélectionne que les trois réglages de la grille, pas les règles
d'entrée. Rapport : `research/reports/wf-longer/wf-longer-e2.{md,json}`.
