# Pré-enregistrement — inférence statistique sur Shock Engine V1 (IC, IR, appraisal ratio, intervalle du Sharpe)

Rédigé le 2026-10-14 et commité **avant tout calcul** des mesures ci-dessous. Étude **descriptive** de V1 figée :
- aucune nouvelle règle, aucune optimisation, aucun modèle entraîné ;
- tous les résultats sont rapportés, y compris défavorables.

Code : `research/fade/v1/v1-inference.ts`. Rapport : `research/reports/shock-fade/v1-inference/`.

**Déjà connu avant ce protocole.**
- Sharpe du portefeuille V1 : 2,02 (2018-09-01 → 2026-09-30, 2 952 jours).
- Buy & hold BTC/ETH 50/50 sans rebalancement : Sharpe 0,78.
- Alpha résiduel de V1 (modèle M2 de `research/reports/residual-alpha/`, déjà recalculé sur V1 le 2026-10-13) :
  44,8 % par an, t de Newey–West 4,94, ratio d'information résiduel 1,89.
- DSR de V1 : 98,9 % (scénario prudent, `research/reports/shock-fade/dsr-reeval/`).
- Pouvoir prédictif du score |z| sur les signaux : jamais mesuré par une corrélation de rang.

## 0. Cadre

- Mêmes rendements journaliers que la fiche publiée : portefeuille BTC/ETH 50/50 sans rebalancement, commissions
  de la fiche, V1 = E2 sans entrée en régime agité.
- Aucun fichier de V1, du bot ni du site n'est modifié.

**Contrôles bloquants avant tout résultat.**
- Sharpe de V1 = 2,0242.
- Sharpe du buy & hold 50/50 = celui de la fiche (0,7775).
- Alpha, t et ratio d'information résiduel de M2 = valeurs publiées (copie du code de `research/shock/residual-alpha.ts`).

## 1. Coefficient d'information (IC) du score du signal

**Événements.** Tous les signaux d'entrée de V1 (signaux E2 en régime calme) dans la fenêtre 2018-09-01 →
2026-10-01, BTC et ETH, qu'ils aient été exécutés ou non (un signal pendant une position ouverte reste un signal).

**Score et rendement.**
- **Score** S = |z| du choc à la clôture de la bougie de signal : le score de déclenchement du moteur
  (`absZ` de `research/proba/features.ts`). Le sens du trade est celui du choc.
- **Rendement futur ajusté** R_h = d · ln(c_{i+h} / c_i) / (ATR_i / c_i) : sens du trade d, ATR du jeu de V1 à la
  clôture du signal, horizons h = 1, 4, 16, 64 bougies (ceux de `research/proba/config.ts`, aucun autre).
  Fenêtres traversant un trou de données exclues et comptées.

**Mesure et dépendance.**
- **Mesure.** IC_h = corrélation de Spearman (S, R_h), sur tous les événements, puis par sens (long, short) et par
  actif.
- **Dépendance.** Les événements proches et les fenêtres qui se chevauchent sont corrélés. Les intervalles à 95 %
  et le p bilatéral viennent d'un bootstrap des mois calendaires d'événements (5 000 tirages). Holm sur les 4
  horizons de la mesure principale (tous événements).
- **Descriptif.**
  - Moyenne de R_h, avec son intervalle de confiance.
  - R_h moyen par quintile de S : vérification de non-linéarité, une continuation peut exister même avec un IC
    nul.

**Secondaire.** Les 716 trades exécutés : Spearman entre S et le R final du trade.

## 2. Ratio d'information contre le buy & hold

- a_t = r_V1,t − r_BH,t ; IR = √365,25 · moyenne(a) / écart type(a), sur les mêmes jours.
- BH = buy & hold BTC/ETH 50/50 sans rebalancement, sans frais, construit comme dans l'étude d'alpha résiduel.
- t de Newey–West (retard 8 = ⌊4 (T/100)^{2/9}⌋).
- Intervalle à 95 % par bootstrap circulaire par blocs (21 jours, 5 000 tirages).
- Sensibilité : blocs de 5 et 63 jours, mois calendaires.
- Rapportés aussi : tracking error et bêta de V1 sur le BH.
- Un IR faible contre un buy & hold très volatil n'est pas un échec en soi pour une stratégie exposée environ
  16 % du temps. Il est rapporté tel quel.

## 3. Appraisal ratio (ratio d'information résiduel)

- **Modèle principal** : M2 de l'étude d'alpha résiduel, c'est-à-dire buy & hold BTC et ETH, TSMOM 30/90/180,
  Donchian 55/20, EMA 20/100 et Donchian 15 min 96/48. Mêmes constructions, mêmes coûts.
- **Mesure** : AR = √365,25 · α / écart type des résidus.
- **Intervalles à 95 %** : bootstrap par blocs des jours (paires y, X rééchantillonnées ensemble, régression
  réestimée à chaque tirage). Blocs de 21 jours en principal ; 5, 63 jours et mois calendaires en sensibilité ;
  2 000 tirages.
- **Rapportés aussi** : M0 (buy & hold seul) et M1 (sans le Donchian 15 min), points seulement.

## 4. Intervalle de confiance et significativité du Sharpe de V1

**Estimations du Sharpe annualisé.**
- Sharpe journalier × √365,25.
- Sharpe des rendements hebdomadaires × √52,18 et mensuels × √12 (moins sensibles à l'autocorrélation
  journalière).
- Ajustement de Lo (2002) de l'annualisation par les autocorrélations journalières des retards 1 à 10.

**Erreurs types analytiques.**
- (a) iid normale : √((1 + SR²/2) / T).
- (b) iid non normale, Mertens : √((1 − γ₃ SR + (γ₄ − 1)/4 · SR²) / T).
- (c) Non iid : méthode delta sur les moments (r − μ, (r − μ)² − σ²) avec covariance de long terme de
  Newey–West. Retard 8 en principal, 21 et 63 en sensibilité.
- Intervalles SR ± 1,96 · erreur type.

**Bootstrap.**
- Bootstrap circulaire par blocs : 5, 21 (principal), 63 et 126 jours, et mois calendaires.
- 5 000 tirages, intervalles par percentiles.

**Diagnostic.** Autocorrélations des retards 1 à 5 et Q de Ljung–Box à 10 retards.

**PSR.** P(vrai Sharpe > SR*) pour deux références explicites :
- SR* = 0 ;
- SR* = Sharpe du buy & hold 50/50 sur la même période.

Chacun avec l'erreur type (b) (PSR standard) et avec (c) (non iid).

**DSR.** 98,9 % (scénario prudent) repris de `dsr-reeval`, avec ses hypothèses. Pas recalculé ici.

## 5. Lecture

Toutes les mesures portent sur l'historique qui a servi à concevoir V1 : elles décrivent la précision et la
significativité du résultat historique, pas sa persistance. Aucun seuil de décision n'est attaché à cette
étude. Un résultat défavorable (IC nul, IR négatif, intervalle large) est rapporté sans reformulation.

## 6. Addendum (2026-10-14, avant calcul) — croissance composée contre le buy & hold

Ajouté après les résultats des sections 1 à 4, **avant tout calcul de la mesure ci-dessous**.

**Mesure.**
- Écart des rendements logarithmiques annualisés : Δg = 365,25 · moyenne(ln(1 + r_V1,t) − ln(1 + r_BH,t)), sur les
  mêmes jours. C'est exactement ln((1 + CAGR_V1) / (1 + CAGR_BH)).
- Croissance relative équivalente : e^Δg − 1.

**Incertitude.**
- Intervalle à 95 % par bootstrap circulaire par blocs des jours appariés : 21 jours en principal ; 5, 63, 126 jours
  et mois calendaires en sensibilité ; 5 000 tirages. P(Δg ≤ 0) bootstrap.
- t de Newey–West (retard 8).

**Décomposition descriptive.** Δg ≈ Δ(rendement arithmétique annualisé) − ½ Δ(variance annualisée). Elle dit si
l'écart de croissance vient du rendement moyen ou de la moindre volatilité.

**Rapporté aussi.** Écart de Sharpe V1 − BH, avec son intervalle par le même bootstrap apparié. Aucun seuil de
décision.
