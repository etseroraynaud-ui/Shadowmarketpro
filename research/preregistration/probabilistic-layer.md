# Pré-spécification — couche probabiliste du Shock Engine (« proba-v1 »)

Rédigé le 2026-10-12 et commité, avec la configuration `research/proba/config.ts`, **avant tout calcul
d'une relation entre une caractéristique d'entrée et un résultat de trade**. Code :
`research/proba/` ; sorties : `research/reports/proba/`.

**Ce qui était connu au moment de la rédaction.** Les chiffres publiés du portefeuille E2 (1 311
trades BTC/ETH entre le 2018-09-01 et le 2026-09-30, taux de gain 31,0 %, gain moyen / perte moyenne
4,37, Sharpe 1,88, commission 0,045 % par exécution). Pour choisir la fenêtre initiale, seuls des
**effectifs** ont été comptés (aucune caractéristique, aucune prévision) : sur les 1 311 trades,
406 ont R > 0, 294 R ≥ 1, 222 R ≥ 2, 174 R ≥ 3 ; avant le 2020-12-31 (labels connus), 397 trades
dont 132 R > 0, 90 R ≥ 1, 66 R ≥ 2, 54 R ≥ 3. **Aucune** corrélation, aucun coefficient, aucune
prévision n'a été calculé ou vu.

## 0. Ce qui ne change pas

- Aucun fichier de `lib/strategies/shock/`, de `research/lib/frozen-shock.ts`, de `research/lib/e2.ts`
  ni du bot n'est modifié. Les empreintes SHA-256 de `research/preregistration/e2-forward.md` § 0 sont
  vérifiées par un test automatique.
- La couche est **descriptive** : elle n'ajoute, ne retire et ne redimensionne aucun signal. Elle est
  désactivée par défaut pour toute décision de trading ; aucun code d'exécution ne la lit.
- Le résultat, positif ou négatif, ne modifie pas le Shock Engine.

## 1. Question

Les caractéristiques connues à la clôture de la bougie de signal permettent-elles d'estimer la
distribution du rendement d'un trade Shock Engine **mieux qu'une prévision naïve** (taux ou moyenne de
l'échantillon d'entraînement), sur des trades chronologiquement hors entraînement ?

Ce n'est pas un test prospectif : les règles du Shock Engine (dont E2) ont été choisies sur une
histoire qui couvre toute la période. Le walk-forward dit si la couche probabiliste généralise dans
le temps **à l'intérieur de l'historique de développement**. Le test prospectif est au § 9.

## 2. Observations

- Les 1 311 trades du portefeuille de référence : sleeves BTC (Bitstamp) et ETH (Binance) de
  `research/lib/frozen-shock.ts`, shorts limités au régime E2 (`research/lib/e2.ts`), commission
  0,045 % par exécution, entrée dans la fenêtre commune (bougie d'entrée ouverte entre le 2018-09-01
  et le 2026-09-30 inclus). Le jeu reproduit exactement les comptes publiés (644 + 667), sinon arrêt.
- Une ligne par trade ; identifiant `ACTIF-AAAAMMJJTHHMM-L|S` (clôture de la bougie de signal, UTC).
- Horodatages : entrée = clôture de la bougie de signal (l'ordre s'exécute à cette clôture) ; sortie =
  clôture de la bougie où la sortie s'exécute.

## 3. Caractéristiques (connues à la clôture de la bougie de signal i)

Toutes viennent des séries du jeu de réglages qui décide de l'entrée (calme ou agité), calculées par
les fonctions du moteur (`prepare`, `classify`, indicateurs de `lib/backtest/indicators.ts`). d = +1
long, −1 short.

| Nom | Définition | Transformation |
|---|---|---|
| `absZ` | \|z_i\|, rendement log standardisé du choc (fenêtre `volWin`) | ln |
| `volZ` | volume standardisé (fenêtre `volZWin`) | aucune |
| `breakAtr` | d·(c_i − niveau cassé)/ATR_i, niveau = plus haut (long) ou plus bas (short) des `rangeWin` bougies jusqu'à i−1 | ln(1 + max(0, ·)) |
| `closeQ` | position de la clôture dans la bougie, dans le sens du trade : (c−l)/(h−l) long, (h−c)/(h−l) short | aucune |
| `lamPct` | percentile de l'intensité de clustering des chocs (λ du moteur) / 100 | aucune |
| `rv` | écart type des rendements log 15 min sur `volWin` bougies (dénominateur de z) | ln |
| `volPct` | percentile de la volatilité journalière 20 j parmi les 365 jours précédents (régime de volatilité, jours clos) | aucune |
| `htfDist` | d·(c_i − moyenne 60 min du filtre HTF)/ATR_i | aucune |
| `isShort`, `isEth`, `agitated` | indicatrices : short, ETH, régime agité | aucune |

Variables quotidiennes : seulement des journées UTC entièrement closes avant la clôture de la bougie
de signal (même alignement que `classify`). Le jeu de données contient d'autres caractéristiques
descriptives (mèches, part du corps, compression ATR, distance et pente de la moyenne journalière
50 j, choc principal ou micro, ATR en % du prix), **non utilisées par les modèles**.

Exclusions absolues : tout prix postérieur à la clôture de la bougie i, MFE/MAE, durée, type de
sortie, résultat du stop.

## 4. Cibles

- **R** = PnL net / risque initial. Risque initial = quantité × |prix d'entrée − stop initial| =
  quantité × `atrStopMult` × ATR d'entrée (stop posé par le moteur à partir de la clôture de signal,
  égale au prix d'exécution, glissement nul). PnL net = PnL après les commissions d'entrée et de
  sortie (comptées une fois, par le moteur). Le stop n'est actif qu'à partir de la clôture de la
  bougie qui suit l'entrée (convention du script) : une perte peut dépasser 1 R ; ces cas sont
  comptés. Normalisation impossible (ATR ≤ 0 ou non fini) : trade exclu et rapporté. Normalisation
  ambiguë : commissions > 0,5 R ; rapporté, trade conservé.
- **Gain** : 1(R > 0). **Événements** : R ≥ 1, R ≥ 2, R ≥ 3.
- **Continuation** aux horizons h ∈ {1, 4, 16, 64} bougies (15 min, 1 h, 4 h, 16 h) :
  Y_h = d·ln(P_{t+h}/P_t), P_t = clôture de la bougie de signal (= prix d'entrée). P_{t+h} = dernière
  clôture connue au plus tard à la clôture prévue de la bougie i+h (jamais d'interpolation ; les trous
  sont marqués). Cible binaire : 1(Y_h > 0). Indépendante des règles de sortie.
- **MFE, MAE** en R (= excursion en ATR d'entrée / `atrStopMult`) : résultats à analyser seulement.
- **Date de connaissance du label** : clôture de la bougie de sortie (R, gain, événements) ; clôture
  prévue de la bougie i+h (continuation).

## 5. Modèles (pré-spécifiés)

- **naïf** : taux (ou moyenne de R) de l'échantillon d'entraînement.
- **contexte** (diagnostic) : régression logistique L2 sur `isShort`, `isEth`, `agitated`.
- **réduit** : régression logistique L2 sur `absZ`, `volZ`, `breakAtr` (le choc lui-même).
- **complet** : régression logistique L2 sur les 11 caractéristiques du § 3.
- **E[R]** :
  - `ridge` : régression ridge de R sur les 11 caractéristiques ;
  - `decomp-const` : P_complet(gain|X)·moyenne(R|gain) + (1 − P)·moyenne(R|perte), moyennes de
    l'entraînement ;
  - `decomp-ridge` : P_complet(gain|X)·ridge(R|gain, X) + (1 − P)·ridge(R|perte, X).
- **Règle de complexité (EPV)** : un modèle logistique à p variables n'est estimé pour une cible que
  si, dans l'entraînement du premier pli, min(positifs, négatifs) ≥ 10·p. Sinon il est déclaré « non
  estimable » pour toute l'étude. Probabilités affichées pour une cible : complet si estimable, sinon
  réduit, sinon naïf.
- **Pas** de XGBoost, de réseau de neurones, d'interactions ni de sélection de variables.

Estimation : logistique L2 par Newton–Raphson, minimisation de Σ log-loss + (λ/2)‖β‖² (constante non
pénalisée) ; ridge en forme fermée, Σ (y − ŷ)² + λ‖β‖². Variables continues écrêtées aux quantiles
1 % et 99 % de l'entraînement, puis toutes les variables centrées-réduites sur l'entraînement.
λ ∈ {0,1 ; 0,3 ; 1 ; 3 ; 10 ; 30 ; 100 ; 300 ; 1000 ; 3000}, choisi dans chaque entraînement par
validation interne chronologique (4 blocs d'effectifs égaux, 3 plis « expanding », même purge) :
log-loss (logistique) ou erreur quadratique (ridge) moyenne ; en cas d'égalité, le λ le plus grand.

## 6. Walk-forward

- Plis : trimestres civils de test, du 2021-01-01 au 2026-09-30 (23 plis, 912 trades hors
  entraînement). Entraînement « expanding » depuis le 2018-09-01.
- **Purge** : un trade entre dans l'entraînement du pli k (début T_k) seulement si son label est connu
  au plus tard à T_k − 1 jour (embargo d'un jour), avec la date de connaissance du § 4 propre à chaque
  cible. Aucun trade de test n'est dans l'entraînement.
- Écrêtage, standardisation, choix de λ, coefficients et calibration : seulement sur l'entraînement
  du pli.
- Un modèle par pli et par cible, utilisé pour tout le trimestre.
- Sorties : prévision de chaque trade hors entraînement, avec pli, date de coupure, λ, empreinte du
  modèle et résultat observé.

## 7. Calibration

Platt (régression logistique de y sur logit(p̂)) estimée au pli k sur les prévisions hors
entraînement des plis précédents dont le label est connu à T_k − 1 jour, si au moins 200 prévisions,
30 positifs et 30 négatifs ; sinon probabilité brute. Appliquée à P(gain) complet, P(R ≥ 2) affiché et
aux quatre continuations. Jamais estimée sur le pli évalué. Le modèle figé n'utilise la version
calibrée d'une cible que si, sur les plis où elle existe, l'amélioration de log-loss (brute −
calibrée) a un intervalle à 95 % strictement positif.

## 8. Évaluation et décision

Bootstrap par blocs de mois civils (mois UTC de l'entrée), apparié entre modèles, 2 000 réplications,
graine 20261012, intervalle percentile à 95 %, p unilatéral = (1 + #{Δ* ≤ 0}) / (1 + B).

- **Test principal (α = 0,05)** : Δ = log-loss(naïf) − log-loss(complet) pour P(gain) sur les 912
  prévisions hors entraînement. « Information supplémentaire démontrée sur l'historique de
  développement » si p < 0,05 **et** Δ Brier > 0. Sinon : « non démontrée ».
- **Famille secondaire (Holm, α = 0,05)** : E[R] `ridge`, `decomp-const`, `decomp-ridge` contre
  naïf (Δ erreur quadratique) ; P(R ≥ 2) modèle affiché contre naïf (Δ log-loss) ; continuation
  h = 1, 4, 16, 64, complet contre naïf (Δ log-loss).
- **Descriptif seulement** : AUC, Brier skill score, courbes de calibration (déciles, Wilson 95 %),
  quintiles, Spearman, écart Q5 − Q1, R ≥ 1 et R ≥ 3, modèle contexte, segments (actif, sens, régime
  de volatilité, régime de tendance), plis, coefficients par pli et intervalles du modèle figé,
  sensibilité aux plus grands gagnants (sans les 5 plus grands, sans le 1 % supérieur, R écrêté au
  99e centile pour l'évaluation), continuation brute contre résultat après sortie.
- Une courbe monotone ou un écart de quintiles sans test favorable ne vaut pas preuve.

## 9. Modèle figé et suivi prospectif

- Modèle figé : même procédure sur tous les trades dont le label est connu à la fin des données ;
  bootstrap par mois (300 tirages, graine 20261013, λ fixé) pour l'incertitude des paramètres
  (intervalle 90 % affiché sur la fiche du signal). Fichier `research/reports/proba/model.json` avec
  empreinte, configuration, données et statut de validation.
- Fiche du signal (précision ajoutée le 2026-10-12, avant tout calcul de prévision) : P(gain) du
  modèle complet, P(R ≥ 2) du modèle affiché (§ 5), E[R] du modèle `ridge`, continuations du modèle
  complet ; chaque valeur à côté de la valeur naïve et du verdict du walk-forward pour cette cible.
  Bootstrap du modèle figé : transformation des variables fixée sur l'échantillon complet,
  coefficients ré-estimés à λ fixé sur chaque tirage de mois.
- Journal prospectif : chaque signal noté par le modèle figé est ajouté à un fichier JSONL avec
  l'empreinte du modèle. Seuls les signaux dont la bougie d'entrée est postérieure à la date de gel
  du modèle sont « prospectifs » ; les autres sont marqués « rétrospectifs ».
- Test prospectif : même test principal que § 8 sur les signaux prospectifs fermés, au premier bilan
  où ils sont au moins 300 ; descriptif avant.

## 10. Interdits et écarts

Interdits pendant l'étude : changer les caractéristiques, transformations, modèles, grille de λ, plis,
purge, seuils ou tests après avoir vu un résultat ; choisir l'horizon ou le modèle qui « marche » ;
modifier le Shock Engine à cause de ce résultat. Tout écart (bogue corrigé, donnée défectueuse) est
consigné dans le rapport avec sa raison.
