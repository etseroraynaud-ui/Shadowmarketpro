# Audit de la calibration historique de Shock Engine (BTC)

Fait le 2026-10-20 pour l'étude de transfert vers les futures GC et NQ
(`research/preregistration/futures-k-transfer.md`). Lecture seule : aucun fichier de V1, du bot ni du
site n'est modifié. **Aucune valeur absolue de seuil n'est écrite ici** (dépôt public) : le seuil de
choc du jeu calme de V1 est noté k_BTC ; sa valeur est dans `lib/strategies/shock/presets.ts`.

## 0. Périmètre et sources

- **`research/fade/` n'existe pas**, ni dans l'arbre actuel ni dans aucun des 167 commits du dépôt,
  toutes branches comprises (`git log --all -- 'research/fade*'` ne renvoie rien). Dans le code,
  « fade » désigne les entrées de retour à la moyenne (`fadeEntryLong/Short` de
  `lib/strategies/shock/market.ts`), désactivées dans les deux jeux de V1 (`directionalOnly = true`).
  La procédure demandée est `research/shock/regime-wf.ts`, introduite par le commit **`11e847f`**
  (2026-10-04, « Shock Engine research: regime-based parameter selection »).
- Fichiers lus : `research/shock/regime-wf.ts` (et son état à `11e847f`), `research/reports/shock-15m-regimes-vol*.md|json`,
  `research/reports/SYNTHESE.md`, `research/shock/export-presets.ts`, `lib/strategies/shock/{params,market,strategy,regimes,presets,live,engine}.ts`,
  `research/lib/{frozen-shock,e2,calm-only}.ts`, `research/preregistration/calm-only.md`,
  `research/reports/calm-only/calm-only.md`, `research/reports/shock-15m-robustness-local*.md`,
  `research/shock/wf-plateau.ts`, `research/reports/wf-longer/wf-longer.md`,
  `research/reports/reference/shock-engine-v1.md`, `research/shock/zero-shot.ts` et ses rapports.
- Vérifications exécutées (script jetable, résultats ci-dessous) : nombre de configurations
  distinctes, identité des jeux #178 et #38, part des tirages où `kMain` ne peut changer aucun choc.
  Interaction des seuils : `research/tests/futures-k-grid.test.ts` (7 tests, tous passent).

## 1. Génération des candidats

`candidates(200, graine)` de `regime-wf.ts` :
- **6 jeux fixes** : le script tel quel ; les réglages TradingView d'octobre 2026 (`USER_2026`) ;
  script longs seuls ; script shorts seuls ; réglages 2026 longs seuls ; réglages 2026 avec filtre
  60 min ;
- **200 tirages** uniformes sur une grille discrète de 26 réglages (générateur `rng(graine)` de
  `lib/backtest/robustness.ts`) : sens (long 1/3, short 1/3, les deux 1/3), mode High Activity
  (p = 0,4), `kMain` 1,8 – 3,4, `kMicro` 1,0 – 2,4, micro-chocs (p = 0,7), `volWin`, `rangeWin`,
  `wickThr`, `cooldownBars`, filtre de volume (p = 0,8) et son seuil, filtre HTF (p = 0,85), son
  timeframe (60 min, 4 h, 1 j, 3 j), sa longueur et le mode de pente, compression (p = 0,4) et son
  seuil, `atrLen`, stop, stop suiveur (coupé avec p = 0,3), TP1 (p = 0,75), sa distance et sa part,
  sortie inverse sur choc principal seulement (p = 0,5).

Trois graines ont été tirées : 5, 9 et 13. **Vérifié : 606 configurations distinctes** (6 fixes
communes + 3 × 200 tirages). Avec le menu court de 12 configurations, dont 6 déjà parmi les fixes, on
retrouve les 612 cités par `research/preregistration/calm-only.md`.

## 2. Évaluation

- Chaque candidat est simulé **une fois sur tout l'historique** BTC/USD Bitstamp 15 min depuis le
  2017-01-01, **comme jeu unique** (il trade dans tous les régimes), aux coûts du script (0,02 % par
  ordre et 1 pas de glissement).
- Chaque position est rattachée au **régime de sa bougie d'entrée** : classifieur causal
  (`lib/strategies/shock/regimes.ts`) sur les journées closes ; découpage retenu « volatilité seule » :
  écart type des rendements journaliers sur 20 jours comparé à ses valeurs des 365 jours précédents,
  calme jusqu'à la médiane, agité au-dessus.
- Conséquence à garder en tête : la note « calme » d'un candidat vient d'un run où il tradait aussi en
  régime agité (dépendance de chemin : cooldown, position déjà ouverte). V1 n'entre qu'en régime calme ;
  ce n'est pas exactement le run qui a été noté.

## 3. Le critère d'optimisation réellement utilisé

Fonction `choose` de `regime-wf.ts` :

- note d'un candidat dans un régime, sur une fenêtre d'entraînement [a, b) :
  **S = min(t₁, t₂)**, où t_h = moyenne / écart type (n − 1) × √n des **rendements par position**
  (`pnlPct`, nets des coûts du script) des positions entrées dans ce régime pendant la moitié h de la
  fenêtre, coupée au milieu **en nombre de bougies** ;
- au moins **15 positions par moitié** (45 pour le meilleur jeu unique tous régimes confondus), sinon
  le candidat est écarté ;
- le meilleur candidat est retenu si **S ≥ 1** (`tmin`), sinon le régime n'est pas tradé.

C'est donc **une statistique de trades et de leur stabilité entre deux sous-périodes**, pas le CAGR
ni le Sharpe journalier : le √n favorise les jeux qui tradent beaucoup, et le minimum des deux moitiés
écarte un jeu qui n'a marché que sur une moitié. Les rapports affichent aussi CAGR, Sharpe, alpha et
bêta, mais seulement en sortie, jamais pour choisir.

**Walk-forward de `regime-wf.ts`** : entraînement ancré et croissant depuis 2017-01-01, tests de
3 mois du 2019-01 au 2026-10 (32 plis), un jeu par régime à chaque pli. **Choix final** (ce que
l'algorithme utiliserait « aujourd'hui ») : entraînement sur **tout** l'historique 2017-01-01 →
2026-10-04 ; c'est ce choix que `export-presets.ts` a écrit dans `presets.ts` :

| régime | jeu retenu (graine 5) | S | positions | remarque |
| --- | --- | ---: | ---: | --- |
| calme | **#178** | 2,93 | 654 | retenu à chacun des 18 derniers plis (2022-07 → 2026-10) ; avant : 149, 179, 85, 47, 186, 8 |
| agité | #38 | 1,13 | 401 | juste au-dessus du seuil de 1 ; retenu au seul dernier pli |

Vérifié : `candidates(200, 5)[178]` est exactement le jeu calme de `ADAPTIVE15`, et `[38]` le jeu agité.

## 4. Choix faits après avoir vu des résultats hors échantillon

- Le même `regime-wf.ts` a été lancé en 15 et 30 min, avec 6 régimes, tendance seule, volatilité
  seule, menu court, coûts réalistes et trois graines (`research/reports/shock-{15,30}m-regimes*.md`).
  La configuration retenue (15 min, volatilité seule, graine 5) est **celle du meilleur Sharpe hors
  échantillon** : 1,48 contre 0,22 (graine 9) et 0,85 (graine 13), et contre 0,59 (6 régimes) et 0,00
  (tendance seule) en 15 min. Le 1,48 n'est donc pas une estimation hors échantillon du préréglage :
  c'est le maximum d'au moins neuf walk-forwards. La synthèse de l'époque le dit elle-même : « les
  résultats changent fortement d'un tirage de candidats à l'autre : c'est le signe qu'on choisit
  surtout parmi du bruit » (`SYNTHESE.md`).
- Les jeux finaux ont été choisis sur tout 2017 – 2026 : toutes les mesures BTC ultérieures du
  préréglage sont dans l'échantillon.
- Ensuite, sur la même structure : filtre E2 des shorts, puis V1 (pas d'entrée en régime agité),
  décidés après avoir vu BTC et ETH. `research/reports/calm-only/` : CSCV-PBO 19,2 % sur les 16
  configurations rejouées, Sharpe dégonflé du gain de V1 sur E2 de 18 %, Sharpe absolu sous 0,95
  au-delà d'environ 109 essais alors que la lignée en compte au moins 222 (6 266 configurations
  distinctes évaluées au total).

## 5. Robustesse, walk-forward et DSR déjà publiés : ce qu'ils disent du seuil

- **Robustesse locale, règles V1, sleeve BTC** (`shock-15m-robustness-local-calm.md`, 1 810
  simulations) : le seuil de choc du jeu calme est **le réglage le plus sensible**. Un réglage à la
  fois, Sharpe 1,59 au préréglage : 1,27 à −20 %, 1,33 à −10 %, 1,52 à −5 %, 1,38 à +5 %, 1,40 à
  +10 %, 1,37 à +20 % (pire écart −0,31). Carte seuil × `volWin` : le préréglage bat 100 % des autres
  cases, 28 % des cases restent à 90 % de son Sharpe. Sur BTC, k_BTC est **un pic local**, pas un
  plateau large, même si tous les voisins restent rentables (Sharpe ≥ 1,27).
- Tous les réglages du jeu agité y sont « sans effet » sur V1 : le jeu agité n'ouvre aucune position
  dans V1.
- **Walk-forward à plateaux** (`wf-plateau.ts`, référence 36 mois / 3 mois, seuil, stop et stop
  suiveur re-choisis par régime sur la moyenne des Sharpe d'un point et de ses voisins) : Sharpe hors
  échantillon 0,83 contre 1,55 pour le préréglage fixe sur 2020 – 2026 ; sur 12 découpages
  pré-enregistrés (`wf-longer`), médiane 0,97, tous sous le préréglage fixe. Re-choisir le seuil sur
  BTC coûte environ 40 % du Sharpe affiché par le préréglage choisi a posteriori.
- **Seule preuve quasi hors échantillon de la structure** : ETH (non utilisé pour choisir les
  réglages). Or au comptant : critère d'étude d'événement non rempli (§ 0 du protocole).

## 6. Interaction `kMain` / `kMicro` / `useMicroShock` / mode d'activité (code d'origine)

D'après `market.ts` (`prepare`) et `strategy.ts` :

```
seuil micro effectif = High Activity ? max(kMicro − 0,2 ; 0,8) : kMicro
choc            = |z| > kMain  ou  (useMicroShock et |z| > seuil micro effectif)
choc principal  = |z| > kMain        → étiquette IMP / μIMP ; sortie inverse si flipMainOnly
λ               = rang centile (lamNormWin) de la moyenne exponentielle (lamEmaWin) de « choc »
longs           : λ > longLamPct et volZ > 0, en plus du choc, de la cassure, de la bougie et de la tendance 60 min
High Activity   : compression coupée, onlyHighLam coupé, cooldown = max(⌊cooldownBars / 2⌋, 2)
```

Conséquences (vérifiées par `research/tests/futures-k-grid.test.ts`) :
- **Micro-chocs actifs et seuil micro effectif sous `kMain`** : `kMain` ne change **aucune entrée**,
  seulement l'étiquette et, avec `flipMainOnly`, les sorties inverses. C'est le cas de **144 des 206**
  candidats de la graine 5 (432 sur 618 tirages, trois graines) : la dimension effective des 606
  configurations est plus petite qu'il n'y paraît. C'est aussi le cas du jeu agité de V1 sur toute la
  zone où `kMain` dépasse son seuil micro effectif (déjà relevé par la robustesse locale).
- **Jeu calme de V1** : mode High Activity (valeur par défaut, non modifiée par le préréglage) et
  micro-chocs coupés : **k est le seul seuil de choc**. Le faire varier déplace ensemble le
  déclencheur, le filtre λ des longs (construit sur le même indicateur de choc) et les sorties sur
  signal inverse. Dans le même jeu, la compression et son seuil sont inactifs (High Activity) et tout
  cooldown de 2 à 5 donne 2 bougies.
- Pour la grille GC / NQ : chaque k peut changer les événements, mais deux valeurs de la grille ne
  comptent comme deux configurations que si leurs entrées et sorties inverses diffèrent sur les
  données (`effectiveConfigs`, protocole § 4).

## 7. Ce que l'étude GC / NQ reprend, et ce qu'elle ne reprend pas

- Repris tel quel : la statistique S = min(t₁, t₂) sur les rendements nets par position, 15 positions
  par moitié, seuil 1 ; l'entraînement ancré et croissant ; le classifieur de régime ; la philosophie
  de plateau de `wf-plateau.ts` (moyenne de la note sur ± 1 cran) ; les méthodes de falsification de
  `zero-shot.ts` (entrées au hasard, décalages, critère d'étude d'événement).
- Non repris : la recherche aléatoire dans 26 réglages (interdite par la mission : seul k varie) et le
  choix d'une graine ou d'un découpage sur le résultat hors échantillon.
- Adapté et déclaré : la note porte sur le seul k (une dimension), et le plateau sur ses deux voisins
  de grille ; les coûts sont ceux des futures, pas ceux des cryptos.
