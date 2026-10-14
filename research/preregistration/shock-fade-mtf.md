# Pré-enregistrement — Shock Fade multi-timeframe (M30, H1, H4)

Rédigé le 2026-10-13 et commité **avant tout calcul d'un rendement postérieur à un choc M30, H1 ou H4**. Le
commit qui ajoute ce fichier fait foi. Code : `research/fade/shockfade/{mtf,run_mtf,mtf_report}.py` ; sorties :
`research/reports/shock-fade/mtf/`. Suite de l'étude `shock-fade.md` (même code de base, mêmes conventions).

**Objet.** Comprendre si la dynamique d'un choc change avec sa durée — réversion, continuation ou rien — et
dans quelles conditions (régime calme ou agité, cassure tenue ou rejetée, choc abrupt ou graduel). **Ce n'est
pas une recherche de réglage** : aucune combinaison n'est choisie pour son Sharpe, aucun modèle de trading
n'est construit ici.

**Ce qui était connu au moment de la rédaction.**
- Tous les résultats de l'étude M5/M15 (`research/reports/shock-fade/00-dossier.md`) : pas d'espérance brute du
  Fade, chocs haussiers qui se prolongent, transitoire identifié < 1 min, H2b/H4a de même signe sur 2025–2026.
  La période 2025-01 → 2026-09 a été ouverte pour M5/M15, **pas** pour M30/H1/H4.
- Les comptages de chocs de `research/reports/shock-fade/mtf/00-counts.md` (aucun prix postérieur aux chocs) :
  par exemple 205 chocs H4 |Z| ≥ 4 indépendants sur P, 63 sur R ; « cassure rejetée » à la clôture du choc
  presque vide (9 en H4 sur P), d'où la définition B2 ci-dessous.
- L'échantillon R (comptant Binance 2017-08 → 2019-12) n'a servi à **aucun** calcul de résultat.

## 0. Ce qui ne change pas

Aucun fichier de V1, du bot ou du site n'est modifié (test `research/fade/tests/test_frozen_v1.py`). La règle
de régime de V1 est réimplémentée en Python, pas importée.

## 1. Données et échantillons

| Échantillon | Données | Chocs (clôture T) | Rôle |
|---|---|---|---|
| **P** principal | perpétuels Binance USDⓈ-M 1 min, BTCUSDT et ETHUSDT | 2020-07-01 → 2026-09-30 | tests primaires et secondaires |
| **R** réplication | comptant Binance 1 min, BTCUSDT et ETHUSDT (`fetch.py --tag pre2020`, SHA-256) | 2018-01-01 → 2019-12-31 | réplication indépendante, jamais utilisée pour décider |

Grilles complètes de minutes ; une fenêtre d'horizon n'est retenue que si au moins 98 % de ses minutes sont
utilisables et si les prix d'entrée et de sortie existent.

## 2. Chocs

- Barres de Δ ∈ {30, 60, 240} minutes alignées sur 00:00 UTC (M30, H1, H4) ; M5 et M15 recalculés avec le même
  code **en référence** (déjà connus, hors familles de tests).
- R_t = rendement log de clôture à clôture ; Z_t = R_t / σ_t avec σ_t² = (π/2)·BV_W·Σ_{i∈barre} s_i² : BV_W =
  variation bipuissance des rendements 1 min désaisonnalisés sur les **W minutes strictement avant la barre**,
  W = 20 barres bornées à [360 min ; 7 jours] (M30 : 10 h, H1 : 20 h, H4 : 80 h) ; s_i = saisonnalité
  intrajournalière des 60 jours précédents.
- **Deux seuils seulement : |Z| ≥ 3 et |Z| ≥ 4.** Normalisation alternative N2 (écart type des 100 rendements de
  barre précédents) : comptages seulement.
- **Indépendance** : par actif, les chocs à moins de r barres du précédent forment un groupe (r = horizon primaire
  maximal : M30 8, H1 16, H4 12, M5 8, M15 4) ; seul le premier choc de chaque groupe entre dans les tests.
  Les groupes BTC et ETH qui se chevauchent sont fusionnés en groupes croisés ; les erreurs types sont groupées
  par groupe croisé. Les résultats sur tous les chocs sont rapportés en complément.

## 3. Découpages pré-enregistrés (connus à l'instant de décision)

- **Régime** (règle de V1, `lib/strategies/shock/regimes.ts`) : écart type des rendements journaliers UTC sur 20
  jours, rang parmi les 365 jours précédents (au moins 60) ; **agité** au-dessus de la médiane, **calme** sinon ;
  valeur du dernier jour UTC clos avant T. La tendance journalière (clôture vs moyenne 50 jours et sa pente sur 10
  jours) est rapportée à titre descriptif.
- **Cassure B1 (en T)**, extrêmes des 20 barres précédentes de la même unité de temps, dans le sens d du choc :
  *propre* si la clôture dépasse l'extrême ; *rejetée* si la mèche le dépasse mais la clôture revient dedans ;
  *sans* si l'extrême n'est pas atteint. Descriptif (la catégorie « rejetée » est presque vide).
- **Cassure B2 (en D2 = clôture de t+2)**, parmi les cassures propres : *tenue* si la clôture de t+2 est encore
  au-delà du niveau cassé, *réintégrée* (rejet différé) si elle est revenue dans le range. Les rendements de B2
  partent de D2 + 1 min.
- **Structure** : *abrupt* si au moins 50 % du mouvement vient de sauts identifiés à 1 min (Lee–Mykland) dans le
  sens du choc, *graduel* sinon. Rapportés en plus : nombre de sauts, concentration (plus grande sous-barre de
  5 min / mouvement), efficacité du chemin, intensité Hawkes avant et après, tendance des 20 barres précédentes,
  déséquilibre agresseur.

## 4. Résultats mesurés

- Entrée à la clôture de la minute T+1, sortie à T+1+h·Δ. Fade = position −d ; g_h = rendement brut ; net =
  g_h − 14 pb + financement réel (P seulement).
- Horizons (barres) : grille {1, 2, 4, 8, 16, 32} pour tous ; H4 ajoute 6 et 12 ; horizons d'horloge 1 h, 4 h,
  16 h, 48 h pour la structure par terme. **Horizons primaires** : M30 {2, 4, 8} (1–4 h), H1 {1, 4, 16}
  (1–16 h), H4 {2, 6, 12} (8–48 h).
- **Course 50 %** : depuis la clôture du choc et jusqu'à l'horizon primaire maximal, la reprise de 50 % du
  mouvement survient-elle avant une extension de 50 % ? Sous une martingale, la probabilité vaut 0,5 ; > 0,5 =
  réversion, < 0,5 = continuation. Idem à 25 % (descriptif).
- MFE/MAE, atteinte de reprise et d'extension, fraction du choc reprise g_h/|R| (structure par terme), effet
  minimal détectable (2,8 × erreur type).

## 5. Tests et corrections

Tests **bilatéraux** (réversion ou continuation), échantillon P, chocs indépendants, BTC et ETH regroupés,
erreurs groupées par groupe croisé ; IC par bootstrap par blocs de 4 semaines.

| Famille | Tests | Correction |
|---|---|---|
| **Primaire** | moyenne de g_h ≠ 0 : 3 TF × 2 seuils × 3 horizons primaires (18) ; course 50 % ≠ 0,5 : 3 TF × 2 seuils (6) | Holm sur 24 |
| S-régime | différence calme − agité de g_h, 3 × 2 × 3 | Holm sur 18 |
| S-cassure | différence réintégrée − tenue de g_h (B2, depuis D2), 3 × 2 × 3 | Holm sur 18 |
| S-structure | différence abrupt − graduel de g_h, 3 × 2 × 3 | Holm sur 18 |

Tableaux croisés régime × cassure et moyennes par groupe : descriptifs, avec effectifs et effet minimal
détectable ; aucune conclusion n'en est tirée sans test.

**Réplication** : tout test significatif après Holm sur P est refait sur R ; il est **répliqué** si le signe est
le même avec p unilatéral < 0,05.

## 6. Règles de conclusion

- « La dynamique change avec la durée » si au moins un test primaire est significatif après Holm et répliqué,
  avec un signe ou une amplitude différents de M5/M15 (référence).
- Une **piste de trading** n'existe que si, en plus, la moyenne nette (14 pb + financement) du groupe concerné
  sur P a un IC bootstrap à 95 % entièrement positif. Elle ferait alors l'objet d'une étude séparée,
  pré-enregistrée, avec walk-forward et fenêtre prospective. Sinon, les résultats restent descriptifs.
- Résultats négatifs et cellules sous-dimensionnées sont rapportés tels quels.

## 7. Avenants

(aucun)
