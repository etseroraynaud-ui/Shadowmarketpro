# Shock Engine sur BTC/USD : synthèse du premier passage

Données : BTC/USD Bitstamp, janvier 2017 → octobre 2026, en 5, 15 et 30 minutes. Coûts du script
(0,02 % par ordre, 1 tick de glissement) sauf mention contraire. Rapports détaillés :
`shock-{5,15,30}m-diagnostic.md` et `shock-*-walkforward*.md`.

## 1. Le script tel quel perd de l'argent sur les trois timeframes

| timeframe | rendement 2017-2026 | Sharpe | positions / jour | sans aucun frais |
| --- | ---: | ---: | ---: | ---: |
| 5 min | -100 % | -2,55 | 3,0 | -82 % |
| 15 min | -83 % | -0,59 | 1,4 | +21 % |
| 30 min | -35 % | -0,04 | 0,8 | +108 % |

En 5 minutes, le signal n'a pas d'edge même sans frais. En 15 et 30 minutes, il y a un edge
brut, mais les frais l'absorbent. L'objectif de 10 à 25 trades par jour n'est pas atteint
(3 par jour en 5 min).

## 2. Ce qui ne va pas dans le script

- **Les shorts perdent partout** : 9 489 shorts contre 1 195 longs en 5 min, profit factor des
  shorts 0,61 à 0,92. Après un choc baissier, le BTC ne poursuit pas sa baisse en moyenne
  (légère reprise), et la hausse de fond joue contre.
- **Les longs sont bloqués par la pente du filtre 60 min** : `htfEmaValue > htfEmaValue[3]`
  compare avec 3 barres du graphique, alors que la valeur 60 min ne change qu'une fois par heure.
  En 5 min, 100 % des longs entrent à :55, :00 ou :05. Corriger la pente (3 barres de 60 min)
  ne change pourtant presque rien au résultat.
- **En mode High Activity, le seuil du choc principal ne sert à rien** : le micro-choc descend à
  1,1 écart type, ce qui couvre environ 20 % des barres. Changer `kMain` ne modifie aucune
  entrée, seulement les étiquettes IMP / μIMP.
- **Le stop suiveur coupe les gagnants** : il s'active à +1,8 ATR avec un écart de 1,8 ATR,
  donc il revient au prix d'entrée. Sans lui, Sharpe 0,47 au lieu de -0,04 en 30 min.
- **Les sorties** : 60 % des positions perdantes ont d'abord gagné 0,5 ATR, et un tiers 1 ATR,
  avant de toucher le stop.
- **Le flip exit ne se déclenche presque jamais** (moins de 10 fois en 10 ans).

## 3. Où est l'edge : les longs en 15 et 30 minutes

| variante | timeframe | Sharpe avant 2022 | Sharpe après 2022 | entrées au hasard battues (mêmes sorties) |
| --- | --- | ---: | ---: | ---: |
| Script tel quel | 30 min | -0,12 | 0,11 | 96 % |
| Longs seulement | 15 min | 0,53 | 0,46 | 100 % |
| Longs seulement | 30 min | 0,69 | 0,65 | 100 % |
| Longs seulement | 5 min | -1,77 | -0,27 | 19 % |

Le test « entrées au hasard, mêmes sorties » garde exactement le stop, TP1, le trailing et le
cooldown, et ne remplace que le moment d'entrée. En 15 et 30 minutes, les entrées longues du
Shock Engine font mieux que les 100 tirages : **le signal long a un vrai pouvoir de timing**.
L'edge est plus fort en volatilité basse ou normale, et quand le prix est au-dessus de sa
moyenne 200 en 60 min.

Limite : l'edge moyen par position (environ 0,05 % en 15 min et 0,10 % en 30 min) est de la
taille des frais réalistes. Avec 0,05 % de commission et 0,01 % de glissement par ordre, les
longs seuls en 30 min tombent à un Sharpe de 0,14, et à -0,34 en 15 min. Il faut des frais de
« maker » (ordres limites) ou des sorties qui laissent courir davantage.

## 4. La variante « longs seuls, sans stop suiveur » est une autre stratégie

Elle affiche +1 326 % en 30 min (Sharpe 1,16, pire baisse -29 %) et résiste aux frais réalistes
(Sharpe 1,09). Mais après TP1, la moitié restante n'a plus qu'un stop sous l'entrée : les
positions durent jusqu'à 400 jours, et la stratégie est investie 55 % du temps. C'est un
système de suivi de tendance de fond sur le BTC, pas un système intraday. Ses entrées battent
98 % des entrées au hasard à sorties identiques, mais l'essentiel du rendement vient de la
hausse du BTC.

## 5. Optimisation : réoptimiser beaucoup de paramètres ne marche pas

Walk-forward, 12 ou 24 mois d'entraînement, 3 mois de test, 200 à 300 jeux de paramètres.

| configuration | Sharpe hors échantillon | PBO |
| --- | ---: | ---: |
| 30 min, 17 réglages (structure comprise) | -0,02 | 50 % |
| 15 min, 17 réglages | 0,41 | 42 % |
| 5 min, 17 réglages | 0,26 | 39 % |
| 30 min, longs seuls sans trailing, 7 réglages | 0,50 | 41 % |
| 15 min, longs seuls sans trailing, 7 réglages | 0,95 | 50 % |

Le jeu choisi à l'entraînement finit à peu près au hasard parmi les autres en test (PBO de 40 à
50 %), et les réglages choisis sautent d'un bout à l'autre de leur intervalle d'un pli à
l'autre. **Les gains viennent de choix de structure (longs seuls, forme des sorties), pas du
réglage fin des seuils.** Optimiser les 17 réglages à chaque trimestre revient à suivre du bruit.

Biais à garder en tête : les choix « longs seuls » et « sans stop suiveur » ont été repérés sur
toute la période. Ils tiennent avant et après 2022, et ce ne sont que deux choix binaires, mais
ce ne sont pas des résultats hors échantillon au sens strict.

## 6. Pistes pour la suite

1. **Vérifier le port contre TradingView** : exporter la liste des trades du Strategy Tester sur
   BITSTAMP:BTCUSD (5, 15 ou 30 min), puis `npm run research:compare-tv -- --tf 15 --tv export.csv`.
2. **Longs en 15 et 30 min** : retravailler les sorties pour garder un système intraday (stop au
   prix d'entrée après +1 ATR, sortie au temps, TP1 plus loin), avec un filtre de régime
   (volatilité basse ou normale, tendance 60 min haussière). Chaque idée testée en walk-forward
   avec peu de réglages, plus le test des entrées au hasard.
3. **Frais** : mesurer l'effet d'entrées en ordre limite (frais maker) sur l'edge des longs.
4. **Shorts** : soit les couper, soit les reconstruire (le signal short fait mieux que des
   shorts au hasard, mais reste sous zéro après frais).
5. **Choisir le produit** : système intraday (longs, exposition de 3 à 4 %) ou système de
   tendance (variante sans trailing, exposition de 55 %).
