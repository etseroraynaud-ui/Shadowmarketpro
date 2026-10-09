# Pré-spécification — batterie de falsification Monte-Carlo de E2 (BTC/ETH historiques)

Rédigé le 2026-10-09 et commité **avant tout calcul** de ces trois tests. Scripts :
`research/shock/e2-falsification.ts` (tests A et B), `research/shock/e2-synthetic.ts` (test C) ;
rapports : `research/reports/e2-falsification/`.

**Ce qui était connu au moment de la rédaction.** Les diagnostics précédents
(`research/preregistration/e2-diagnostics.md`) venaient de se terminer. Seuls leur verdict global
(« non éliminée ») et deux alertes de continuité des données de funding avaient été vus ; aucun de
leurs chiffres. Les références historiques de E2 publiées plus tôt (avenant BTC/ETH, référence
historique du forward) étaient connues.

## Question

L'avantage historique de E2 est-il exceptionnel par rapport à des sélections, des régimes et des
marchés contrefactuels de propriétés comparables ?

Il ne s'agit pas d'optimiser E2. **E2 reste strictement figée** : régime de tendance baissier de
`classify` (`lib/strategies/shock/regimes.ts`), soit clôture journalière sous la moyenne 50 jours et
moyenne en baisse sur 10 jours, sur le dernier jour clos. Aucun paramètre ne change après les
résultats.

La validation forward (`research/preregistration/e2-forward.md`) reste enregistrée à part et n'est
pas modifiée. La v1 et le bot ne le sont pas non plus.

## Échantillon et mesures communes

- **Shorts** : les shorts de la v1 (BTC/USD Bitstamp depuis 2017-01-01, ETH/USDT Binance depuis
  2018-09-01, coûts 0,045 % par ordre), fermés par une vraie sortie, avec une barre de sortie close
  avant le 2026-10-01. C'est l'échantillon de la référence historique du forward (794 shorts).
- **R** = (PnL net / equity à l'entrée) / σ journalière des 30 jours précédents.
- **EV** = moyenne de R des shorts gardés.
- **D** = moyenne de R des shorts en régime baissier − moyenne de R des shorts hors régime.
- **PF** des shorts gardés = somme des PnL nets positifs / |somme des PnL nets négatifs|.
- **Payoff** = gain net moyen / |perte nette moyenne| des shorts gardés.
- **Stratégie complète** : Sharpe journalier et drawdown maximal de la sleeve BTC, de la sleeve ETH
  et du portefeuille 50/50 officiel (période commune 2018-09-01 → 2026-09-30).
- **p-value Monte-Carlo** : `(1 + nombre de contrefactuels ≥ E2) / (1 + nombre de contrefactuels)`,
  dans le sens « meilleur ». Pour le drawdown, « meilleur » veut dire moins profond.
- **Percentile de E2** : part des contrefactuels strictement inférieurs à E2.

## Test A — placebo par sélection aléatoire à fréquence égale

- **Tirage** : parmi les vrais shorts v1, **50 000 sélections aléatoires** gardant exactement autant
  de shorts que E2.
  - Tirage principal, **stratifié par actif et par année** : même nombre de shorts gardés que E2 dans
    chaque couple actif-année.
  - Tirage secondaire : stratifié par actif seulement.
  - Graine 20261014.
- **Mesures par réplication** :
  - EV, PF, payoff, D (gardés − rejetés) ;
  - Sharpe et drawdown de la stratégie complète (BTC, ETH, 50/50).
- **Calcul de la stratégie complète** : par retrait additif. Les rendements journaliers de la v1
  diminués de la contribution journalière des shorts non sélectionnés : PnL au prix de clôture de
  chaque jour, frais d'entrée et de sortie compris, en part de l'equity de la veille. E2 est calculée
  de la même façon.
- **Validation du retrait additif** : sur les 1 000 premières réplications, comparaison avec la
  re-simulation exacte (entrées short limitées aux barres des shorts sélectionnés). Si l'écart absolu
  moyen de Sharpe du 50/50 dépasse 0,02, la re-simulation exacte sur ces 1 000 réplications devient
  la référence pour le Sharpe et le drawdown.
- **Statistique principale** : EV, tirage stratifié par actif et par année.

## Test B — placebo par décalage du régime

- **Décalage** : la série E2 de chaque actif, au pas de 15 min sur sa fenêtre d'échantillon, est
  décalée circulairement de k jours entiers. On conserve exactement la part de temps baissier, la
  persistance, la longueur des phases baissières et non baissières et la structure temporelle du
  filtre, sauf à la couture (une phase coupée ou soudée).
- **Décalages admis** : `kmin ≤ k ≤ L − kmin`, où L est la longueur de la fenêtre en jours.
  - Principal : kmin = 180 jours, ce qui écarte les décalages qui laissent le régime presque
    inchangé.
  - Sensibilité : kmin = 90 et 365 jours.
  - Tous les décalages admis sont évalués.
- **Analyses séparées** :
  - **BTC** : décalage sur la fenêtre de BTC (2017-01 → 2026-10) ;
  - **ETH** : décalage sur la fenêtre d'ETH (2018-09 → 2026-10) ;
  - **portefeuille égal** : le même k pour les deux actifs, `D_eq = ½ (D_BTC + D_ETH)`, k limité par
    la fenêtre la plus courte.
- **Mesures rapportées en plus** : D des shorts mis en commun, et Sharpe du 50/50 par retrait
  additif des shorts hors régime décalé.
- **Propriétés du régime rapportées** : part du temps baissier, nombre de phases, durée moyenne et
  médiane des phases, autocorrélation de l'indicateur au décalage kmin.
- **Statistique principale** : D, et `D_eq` pour le portefeuille.

## Test C — marchés synthétiques par bootstrap de blocs empiriques

### Construction

- **Source** : les jours UTC du 2017-08-18 au 2026-09-30, où BTC (Bitstamp) et ETH (Binance) ont tous
  deux des données.
- **Trajectoire** :
  - suite de blocs de L jours calendaires consécutifs, tirés au hasard avec remise ;
  - **les mêmes blocs pour BTC et ETH**, ce qui préserve leur dépendance ;
  - début de bloc uniforme parmi les débuts possibles ;
  - longueur totale égale à celle de la source.
- **Longueurs de bloc prédéfinies** : **1, 3, 7, 14 et 30 jours**, toutes rapportées séparément,
  sans en choisir une après coup.
- **Calendrier** : le jour j de la trajectoire reçoit la date 2017-08-18 + j. Les bougies 15 min du
  jour source sont copiées à la même heure, ce qui garde la structure intrajournalière et OHLC. Une
  bougie absente de la source reste absente (trou).
- **Prix, reconstruits causalement** :
  - chaque bloc est la série source multipliée par une constante ;
  - cette constante raccorde la clôture source qui précède le bloc à la dernière clôture synthétique ;
  - cela équivaut à enchaîner les rapports OHLC / clôture précédente de la source, et préserve les
    queues épaisses et le regroupement de volatilité à l'intérieur des blocs ;
  - prix de départ : la clôture source du 2017-08-17.
- **Volume normalisé** : volume de la bougie / moyenne du volume des 2 880 bougies sources
  précédentes (30 jours). Cela évite les sauts de niveau entre époques ; le moteur n'utilise le volume
  qu'en z-score local.
- **mintick** : `10^(⌊log10(plus basse clôture de la trajectoire)⌋ − 4)`, comme pour les actifs
  vierges. Le moteur ne s'en sert que comme plancher du range et de l'ATR.

### Moteur, sur chaque trajectoire

1. Shock Engine complet recalculé avec le préréglage adaptatif 15 min de la v1.
2. Régime de volatilité et E2 recalculés à partir de zéro sur les barres journalières synthétiques.
3. Entrées comme dans la v1 (bougie qui suit un trou exclue) ; début de simulation au 2018-09-01
   synthétique (règle d'ETH) ; coûts, sizing et sorties de la v1.
4. Deux runs par actif :
   - **V0** ;
   - **E2** : entrées short masquées hors régime baissier.

### Mesures, par trajectoire et par actif, plus le portefeuille 50/50

- EV short (V0, E2), ΔEV = EV(E2) − EV(V0), et D.
- Sharpe et ΔSharpe ; CAGR et ΔCAGR ; PF de tous les trades et ΔPF ; drawdown maximal et
  ΔDD = DD(E2) − DD(V0) (positif quand E2 baisse moins).
- Nombre de shorts V0 et E2, et part des shorts V0 gardée par E2.

### Nombre de trajectoires

- **Premier passage** : 1 000 trajectoires par longueur de bloc, pour vérifier l'implémentation.
- **Extension** : vers 5 000 par longueur, selon le seul temps de calcul et jamais selon les
  résultats ; toutes les trajectoires calculées sont rapportées.
- **Graine** de la trajectoire j de longueur L : `20261014 + 1 000 003 · L + j`. Le résultat d'une
  trajectoire ne dépend donc pas du découpage des calculs.

### Rapporté, pour chaque longueur de bloc séparément

- `P(ΔEV > 0)`, `P(ΔSharpe > 0)`, `P(DD_E2 < DD_V0)` (drawdown moins profond).
- Médiane, P5, P10, P90 et P95 de chaque différence.
- Percentile de la valeur historique réelle de chaque différence dans la distribution synthétique.

### Contrôles

- **Trajectoire identité** (la source dans l'ordre, un seul bloc, volume brut, horodatages et mintick
  d'origine) : elle redonne exactement la v1 de chaque actif.
- **Même trajectoire identité, volume normalisé et mintick de la règle** : écart avec la v1 rapporté.
- **BTC et ETH** utilisent bien les mêmes blocs.

## Lecture (fixée d'avance, sans critère d'élimination)

- **Tests A et B** : l'avantage historique de E2 est dit « exceptionnel » face à un test si sa
  p-value Monte-Carlo sur la statistique principale est ≤ 0,05.
- **Test C, deux lectures par longueur de bloc** :
  1. **effet générique** : si `P(ΔEV > 0)` est élevé dans les marchés synthétiques, l'avantage de E2
     vient d'une propriété mécanique du filtre (il apparaît même sans la structure historique propre) ;
  2. **exceptionnel** : si la valeur historique réelle de ΔEV dépasse le P95 synthétique de cette
     longueur.
- **Pas de regroupement** des longueurs de bloc, ni des tests.
