# Pré-spécification — un seul jeu de règles dans tous les régimes de volatilité

Rédigé le 2026-10-13 et commité **avant tout calcul**. Script : `research/shock/single-set.ts` ;
rapport : `research/reports/single-set/`.

## 0. Ce qui est déjà connu

Les règles publiées (V1, « calme ») n'ouvrent de positions qu'en régime calme. Les règles
précédentes (E2) tradent aussi le régime agité, avec un autre jeu de réglages (seuil du choc, stop,
stop suiveur, prise de profit partielle de 20 %, pas de shorts). Sur BTC/ETH : Sharpe 2,02 (V1)
contre 1,88 (E2) ; sur BTC seul les deux font 1,46 sur 2018-09 → 2026-09
(`research/reports/agitated-regime/`). La question, posée après avoir vu ces résultats : **et si les
entrées en régime agité suivaient exactement les mêmes règles que celles du régime calme ?** Cette
étude n'est donc pas aveugle, et la variante devient la 17e configuration essayée sur le portefeuille
(univers du risque de sélection, `research/preregistration/calm-only.md`).

## 1. Variante S (figée ici)

Le jeu de réglages du régime calme (`ADAPTIVE15.calm`, inchangé) s'applique à **toutes** les bougies
dont le régime est connu, calmes ou agitées : mêmes conditions d'entrée, même stop, même stop
suiveur, pas de prise de profit partielle, longs et shorts selon ce jeu, shorts seulement en tendance
journalière baissière (filtre E2 inchangé). Le régime de volatilité ne sert plus à rien. Mêmes
données, mêmes bornes, même règle d'entrée que `loadSleeve` (bougie qui suit un trou exclue),
mêmes coûts (commission 0,045 % par ordre, ×1 et ×2). Aucun paramètre n'est modifié ni optimisé.

## 2. Comparaisons et mesures

E2, V1 et S sur : BTC seul (2017 → 2026 et 2018-09 → 2026-09), ETH seul, portefeuille BTC/ETH 50/50
(2018-09-01 → 2026-09-30), et les 8 cryptos de `research/lib/regime-er.ts` (consultées dans l'étude
du régime agité, donc pas vierges). Mesures : Sharpe quotidien, CAGR, drawdown max., trades (dont
ouverts en régime agité), commissions ×2, rendements annuels de BTC, et intervalle à 95 % de l'écart
de Sharpe du portefeuille (S − V1, S − E2 ; bootstrap par mois, 5 000 tirages).

## 3. Contrôles bloquants

E2 et V1 doivent redonner leurs Sharpe publiés (portefeuille 1,8775665 et 2,0242079) ; sur la
période commune, les trades de S en régime calme doivent être ceux de V1 tant qu'aucune position
agitée ne les a précédés (vérifié par le nombre d'entrées calmes identiques).

## 4. Règle de lecture, fixée avant calcul

Résultat descriptif, en échantillon. S ne remplace pas les règles publiées sur cette seule base : il
faudrait que son écart de Sharpe avec V1 ait un intervalle à 95 % entièrement positif **et** qu'il
améliore les 8 cryptos en moyenne ; même alors, ce ne serait qu'une hypothèse à suivre en
conditions réelles, puisque la variante est proposée après avoir vu les résultats.
