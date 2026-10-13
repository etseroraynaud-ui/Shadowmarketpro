# Pré-spécification — V1-calme figée, surajustement de sélection (CSCV-PBO, walk-forward, DSR)

Rédigé le 2026-10-13 et commité, avec la règle figée (`research/lib/calm-only.ts`) et les fonctions
de mesure (`research/lib/overfit.ts`), **avant tout calcul de PBO, de walk-forward ou de Sharpe
dégonflé**. Script : `research/shock/calm-only.ts` ; rapport : `research/reports/calm-only/`.

## 0. Cadre

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`, de `research/lib/e2.ts`
  ni du bot n'est modifié (empreintes vérifiées). Le live ne change pas ; E2 reste la stratégie de
  référence de la recherche.
- **Ce qui est déjà connu.** V1-calme a été construite et mesurée dans `research/reports/agitated-regime/`
  (Sharpe BTC/ETH 2,02 contre 1,88 pour E2 ; 1,88 contre 1,61 avec des commissions doublées ;
  716 trades contre 1 311). Sur les 8 autres cryptos, l'écart moyen était +0,015 (5/8 améliorées).
  Cette étude n'est donc pas aveugle sur V1-calme contre E2 : elle mesure le **risque que ce choix
  soit le fruit de la sélection** parmi les configurations réellement essayées. Aucun résultat
  historique ne remplace un test forward.

## 1. V1-calme (figée ici)

E2 inchangée (mêmes deux jeux de réglages, même filtre de tendance journalière des shorts), **sans
nouvelles entrées en régime agité** : une entrée est retirée si la bougie de signal est en régime
agité (`select = 1`). Les positions ouvertes en régime calme gardent les sorties du jeu calme même si
le régime change. Aucun paramètre n'est modifié. Portefeuille BTC/ETH 50/50 sans rebalancement,
fenêtre de référence 2018-09-01 → 2026-10-01. Code : `calmOnly()` ; valeurs de référence à retrouver
à l'identique : `CALM_ONLY_REFERENCE` (contrôle bloquant).

## 2. Univers des configurations

UNIVERS_PLACEHOLDER

## 3. CSCV-PBO

- Matrice : rendements journaliers du portefeuille BTC/ETH 50/50 de chaque configuration de
  l'univers A, mêmes jours (fenêtre de référence, convention de `research/shock/portfolio.ts`).
- **S = 16 blocs contigus** (≈ 6 mois chacun), les C(16, 8) = 12 870 découpages ; critère : Sharpe.
  Pour chaque découpage, la configuration au meilleur Sharpe sur les 8 blocs d'entraînement est
  retenue ; λ = logit de son rang relatif parmi toutes les configurations sur les 8 autres blocs
  (ex aequo au rang moyen). **PBO = part des découpages avec λ ≤ 0.**
- Rapportés aussi : distribution de λ, probabilité de perte (Sharpe hors échantillon < 0), pente de
  dégradation (Sharpe hors échantillon sur Sharpe dans l'échantillon), nombre de fois où chaque
  configuration est retenue, rang relatif moyen hors échantillon de V1-calme et de E2.
- Sensibilités (descriptives) : S = 10 ; commissions × 2.

## 4. Walk-forward chronologique

- Recalage au 1er janvier de chaque année, de 2020 à 2026 ; à chaque recalage, la configuration au
  meilleur Sharpe sur **tous les jours précédents** (fenêtre croissante depuis 2018-09-01) est
  appliquée jusqu'au recalage suivant (la dernière jusqu'au 2026-09-30). Aucun jour postérieur au
  recalage n'est lu.
- Deux sélecteurs : (a) sur tout l'univers A ; (b) entre E2 et V1-calme seulement.
- Comparés, sur les mêmes jours hors échantillon (2020-01-01 → 2026-09-30) : courbe du sélecteur,
  E2 fixe, V1-calme fixe. Δ Sharpe (sélecteur − E2) avec IC 95 % par bootstrap des mois (5 000
  réplications, graine 20261013). Δ Sharpe annuel de V1-calme contre E2, année par année.
- Limite : les deux jeux de réglages ont été choisis sur un historique qui couvre toute cette
  période ; le walk-forward ne porte que sur le choix entre configurations, pas sur ces réglages.

## 5. Sharpe dégonflé (DSR)

- **(a) Sharpe absolu de V1-calme** : PSR(0) et DSR avec N = taille de l'univers A et l'écart type
  des Sharpe (journaliers) de ses configurations ; puis N de la lignée (§ 2, univers B) — DSR pour
  N ∈ {|A|, LIGNEE_PLACEHOLDER} et nombre d'essais N* au-delà duquel le DSR passe sous 0,95,
  pour l'écart type des Sharpe de l'univers A et pour celui de l'univers B quand il est calculable.
  Asymétrie et kurtosis des rendements journaliers prises en compte (formule de Bailey et López de
  Prado, 2014).
- **(b) Gain de V1-calme sur E2** (la question décisive) : série d_t = r_V1-calme,t − r_E2,t ;
  DSR de d avec N = nombre de configurations de l'univers A autres que E2 et l'écart type, sur ces
  configurations, du Sharpe de (r_k − r_E2). Mêmes calculs avec commissions × 2 (descriptif).

## 6. Lecture (fixée ici)

- **PBO** (univers A, S = 16, commissions × 1) : < 0,2 faible ; 0,2 à 0,5 ambigu ; ≥ 0,5 surajusté.
- **Walk-forward** favorable si le sélecteur (b) retient V1-calme à au moins 4 recalages sur 7 et si
  le Δ Sharpe hors échantillon du sélecteur (a) contre E2 est > 0.
- **DSR (b)** ≥ 0,95 : le gain sur E2 résiste au nombre d'essais ; sinon il n'est pas démontré.
- Verdict : **« candidate solide pour un test forward »** si les trois sont favorables ;
  **« candidate fragile »** si le PBO est < 0,5 mais que le walk-forward ou le DSR (b) ne l'est pas ;
  **« pas de candidate »** si le PBO est ≥ 0,5. Dans tous les cas : E2 reste la référence, rien ne
  change dans le live, et seul un test forward pré-enregistré à part peut valider V1-calme.

## 7. Interdits

Changer l'univers, S, les dates de recalage, la règle de lecture ou la définition de V1-calme après
avoir vu un résultat de cette étude ; ajouter ou retirer une configuration de l'univers A.
