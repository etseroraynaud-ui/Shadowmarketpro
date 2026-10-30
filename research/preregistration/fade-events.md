# Pré-spécification — étude d'événements contrarienne (« fade ») sur tous les chocs détectés

Rédigé le 2026-10-13 et commité **avant tout calcul** des rendements ci-dessous. Script :
`research/shock/fade-events.ts` ; rapport : `research/reports/fade-events/`. Module de recherche
indépendant : aucune règle, aucun paramètre ni aucun fichier de Shock Engine ou du bot n'est modifié,
et rien n'est branché sur une décision de trading.

## 0. Ce qui est déjà connu

- Shock Engine trade la **continuation** après des chocs qualifiés ; les études d'événements des
  transferts (`shock-15m-zeroshot-*`) montrent une continuation moyenne positive après les chocs dans
  le sens de la tendance sur BTC et ETH.
- Une stratégie « fade » complète, avec les sorties conçues pour la continuation, a perdu fortement en
  2025 (`research/reports/shock-15m-diagnostic.md`, § 8 : −94 %). Ce n'est pas une mesure du rendement
  contrarien brut : les sorties n'étaient pas faites pour lui.
- Aucune étude d'événements contrarienne conditionnelle (rejet, régime, liquidité) n'a été faite.

## 1. Univers des chocs (tous, sans filtre a posteriori)

Pour chaque bougie de 15 min i de la fenêtre simulée de l'actif, de régime connu (`select[i] ≥ 0`),
qui ne suit pas un trou de données : choc si le détecteur du moteur **du régime en vigueur** le
déclare (`prepare(m, jeu).shock[i] = 1` ; calme : |z| > 2,9, fenêtre 130 ; agité : |z| > 2,2,
fenêtre 150). Signe s = +1 si le rendement de la bougie est positif, −1 sinon. Aucun choc n'est
retiré selon son issue. Robustesse : univers à seuil unique |z| > 2,5 (fenêtre 130) dans tous les
régimes, et univers sans chevauchement (choc retiré si un autre choc a eu lieu dans les 16 bougies
précédentes).

## 2. Mesure

R_fade(h) = −s · ln(P_{t+h} / P_t), P_t = clôture de la bougie du choc, h ∈ {1, 2, 4, 8, 16} bougies
(15 min à 4 h). Un horizon est omis pour un choc si les bougies t+1 … t+h ne sont pas contiguës.
Statistique : moyenne de R_fade(h) en points de base, médiane, part positive. Incertitude : bootstrap
par mois calendaires (mêmes mois pour tous les actifs mis en commun), 5 000 tirages ; p unilatéral =
part des tirages du mauvais signe.

## 3. Conditions (toutes connues à la clôture du choc)

- **Rejet** (exclusives) : *mèche* si la mèche du côté du choc ≥ seuil de mèche du jeu (0,4 calme,
  0,45 agité) ; sinon *sans cassure* si la clôture reste dans le range des `rangeWin` bougies
  précédentes ; sinon *cassure propre*. (Mêmes définitions que les primitives `fadeLong` /
  `fadeShort` / `impulse*` du moteur.)
- **Régime** : calme / agité (régime de volatilité journalier du moteur).
- **Liquidité** : illiquidité d'Amihud de la bougie, |r| / (volume × prix), rang centile parmi les
  2 880 bougies précédentes (30 jours) ; terciles bas / moyen / haut (haut = mouvement cher en
  liquidité, déséquilibre temporaire). Descriptif : z-score du volume du moteur.

## 4. Coûts et entrée exécutable

Seuil de coût aller-retour : **10 pb** (2 × 4,5 pb de commission taker + 1 pb de glissement) ;
sensibilités 5 et 20 pb. Entrée exécutable (BTC et ETH, 2020-01 → 2026-09, perpétuels Binance à la
minute) : entrée à la clôture de la première minute après le choc (T + 1 min), sortie à la clôture
de la minute qui finit à T + h × 15 min ; R_exec(h) sur les mêmes chocs.

## 5. Données

Développement : BTC (Bitstamp, 2017 → 2026) et ETH (Binance, 2018-09 → 2026-09), mis en commun. Réplication : les 8 cryptos de
`research/lib/regime-er.ts` (XRP, BNB, DOGE, TRX, ADA, LINK, XLM, LTC), déjà consultées pour la
stratégie dans l'étude du régime agité mais jamais pour un rendement contrarien.

## 6. Hypothèses et règle de décision, fixées avant calcul

- **H_A (tous les chocs)** : E[R_fade(h)] > 0. Test unilatéral, correction de Holm sur les 5 horizons,
  BTC + ETH. Attendu : rejet (continuation).
- **H_B (principale, chocs rejetés par une mèche)** : E[R_fade(h)] − 10 pb > 0. Holm sur 5 horizons,
  BTC + ETH, seuil 5 %. **Réplication exigée** : sur les 8 cryptos mises en commun, au même horizon,
  E[R_fade(h)] − 10 pb > 0 avec p unilatéral < 0,05.
- **H_C (liquidité)** : parmi les chocs rejetés, E[R_fade | tercile haut d'Amihud] > E[R_fade | tercile
  bas], p unilatéral < 0,05 sur BTC + ETH et même signe sur les 8 cryptos (horizon de H_B le plus fort,
  ou h = 4 si H_B échoue partout).
- **Exécution** : pour tout horizon qui passe H_B et sa réplication, E[R_exec(h)] − 10 pb > 0 sur BTC/ETH
  2020+ (p unilatéral < 0,05).
- **Verdict** : « avantage contrarien exploitable » seulement si H_B passe, se réplique et survit à
  l'entrée exécutable ; sinon « pas d'avantage contrarien exploitable démontré ». Les autres cellules
  (régime × rejet × liquidité × horizon) sont descriptives et ne servent pas au verdict. Même en cas de
  succès, le résultat est historique : il ouvrirait un module distinct, désactivé, à suivre en
  conditions réelles.
